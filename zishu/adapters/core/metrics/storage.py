"""
指标存储系统

提供多种存储后端的指标持久化和查询功能。
"""

import asyncio
import logging
import json
import pickle
import gzip
import sqlite3
import threading
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from dataclasses import dataclass, field
from pathlib import Path
from collections import defaultdict, deque
import weakref

from .core import Metric, MetricFamily, MetricSample, MetricType, AggregationType

# 尝试导入可选依赖
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

try:
    from influxdb_client import InfluxDBClient, Point, WritePrecision
    from influxdb_client.client.write_api import SYNCHRONOUS
    INFLUXDB_AVAILABLE = True
except ImportError:
    INFLUXDB_AVAILABLE = False

logger = logging.getLogger(__name__)


# ================================
# 存储接口
# ================================

class MetricsStorage(ABC):
    """指标存储接口"""
    
    def __init__(self, config: Dict[str, Any]):
        """初始化存储"""
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        
        # 统计信息
        self.write_count = 0
        self.read_count = 0
        self.error_count = 0
        self.last_write_time: Optional[datetime] = None
        self.last_read_time: Optional[datetime] = None
        
        # 线程安全
        self._lock = threading.RLock()
    
    @abstractmethod
    async def initialize(self) -> None:
        """初始化存储"""
        pass
    
    @abstractmethod
    async def close(self) -> None:
        """关闭存储"""
        pass
    
    @abstractmethod
    async def write_metrics(self, metrics: List[MetricFamily]) -> bool:
        """写入指标"""
        pass
    
    @abstractmethod
    async def read_metrics(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        labels: Optional[Dict[str, str]] = None,
        limit: Optional[int] = None
    ) -> List[MetricFamily]:
        """读取指标"""
        pass
    
    @abstractmethod
    async def delete_metrics(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> int:
        """删除指标"""
        pass
    
    @abstractmethod
    async def get_metric_names(self) -> List[str]:
        """获取所有指标名称"""
        pass
    
    @abstractmethod
    async def get_storage_info(self) -> Dict[str, Any]:
        """获取存储信息"""
        pass
    
    def _update_write_stats(self, success: bool = True) -> None:
        """更新写入统计"""
        with self._lock:
            if success:
                self.write_count += 1
                self.last_write_time = datetime.now(timezone.utc)
            else:
                self.error_count += 1
    
    def _update_read_stats(self, success: bool = True) -> None:
        """更新读取统计"""
        with self._lock:
            if success:
                self.read_count += 1
                self.last_read_time = datetime.now(timezone.utc)
            else:
                self.error_count += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        with self._lock:
            return {
                'write_count': self.write_count,
                'read_count': self.read_count,
                'error_count': self.error_count,
                'last_write_time': self.last_write_time.isoformat() if self.last_write_time else None,
                'last_read_time': self.last_read_time.isoformat() if self.last_read_time else None
            }


# ================================
# 内存存储
# ================================

class MemoryMetricsStorage(MetricsStorage):
    """内存指标存储 - 适用于开发和测试"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        
        # 存储配置
        self.max_metrics = config.get('max_metrics', 10000)
        self.max_samples_per_metric = config.get('max_samples_per_metric', 1000)
        self.retention_hours = config.get('retention_hours', 24)
        
        # 内存存储
        self._metrics: Dict[str, MetricFamily] = {}
        self._storage_lock = threading.RLock()
        
        # 清理任务
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def initialize(self) -> None:
        """初始化存储"""
        self.logger.info("Initializing memory metrics storage")
        
        # 启动清理任务
        self._running = True
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        self.logger.info("Memory metrics storage initialized")
    
    async def close(self) -> None:
        """关闭存储"""
        self.logger.info("Closing memory metrics storage")
        
        self._running = False
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        with self._storage_lock:
            self._metrics.clear()
        
        self.logger.info("Memory metrics storage closed")
    
    async def write_metrics(self, metrics: List[MetricFamily]) -> bool:
        """写入指标"""
        try:
            with self._storage_lock:
                for family in metrics:
                    if family.name in self._metrics:
                        # 合并到现有指标族
                        existing_family = self._metrics[family.name]
                        for metric in family.get_all_metrics():
                            labels_key = self._labels_to_key(metric.labels)
                            if labels_key in existing_family.metrics:
                                # 合并样本
                                existing_metric = existing_family.metrics[labels_key]
                                existing_metric.samples.extend(metric.samples)
                                
                                # 限制样本数量
                                if len(existing_metric.samples) > self.max_samples_per_metric:
                                    existing_metric.samples = existing_metric.samples[-self.max_samples_per_metric:]
                            else:
                                # 添加新指标
                                existing_family.metrics[labels_key] = metric
                    else:
                        # 添加新指标族
                        self._metrics[family.name] = family
                
                # 检查存储限制
                if len(self._metrics) > self.max_metrics:
                    await self._cleanup_old_metrics()
            
            self._update_write_stats(True)
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to write metrics: {e}")
            self._update_write_stats(False)
            return False
    
    async def read_metrics(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        labels: Optional[Dict[str, str]] = None,
        limit: Optional[int] = None
    ) -> List[MetricFamily]:
        """读取指标"""
        try:
            with self._storage_lock:
                result_families = []
                
                # 确定要查询的指标名称
                target_names = names if names else list(self._metrics.keys())
                
                for name in target_names:
                    if name not in self._metrics:
                        continue
                    
                    family = self._metrics[name]
                    filtered_family = MetricFamily(
                        name=family.name,
                        metric_type=family.metric_type,
                        description=family.description,
                        unit=family.unit
                    )
                    
                    for metric in family.get_all_metrics():
                        # 过滤标签
                        if labels and not self._match_labels(metric.labels, labels):
                            continue
                        
                        # 过滤时间范围
                        filtered_samples = []
                        for sample in metric.samples:
                            if start_time and sample.timestamp < start_time:
                                continue
                            if end_time and sample.timestamp > end_time:
                                continue
                            filtered_samples.append(sample)
                        
                        if filtered_samples:
                            filtered_metric = Metric(
                                name=metric.name,
                                metric_type=metric.metric_type,
                                description=metric.description,
                                unit=metric.unit,
                                labels=metric.labels,
                                samples=filtered_samples
                            )
                            
                            labels_key = self._labels_to_key(metric.labels)
                            filtered_family.metrics[labels_key] = filtered_metric
                    
                    if filtered_family.metrics:
                        result_families.append(filtered_family)
                
                # 应用限制
                if limit and len(result_families) > limit:
                    result_families = result_families[:limit]
            
            self._update_read_stats(True)
            return result_families
            
        except Exception as e:
            self.logger.error(f"Failed to read metrics: {e}")
            self._update_read_stats(False)
            return []
    
    async def delete_metrics(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> int:
        """删除指标"""
        deleted_count = 0
        
        try:
            with self._storage_lock:
                if names:
                    # 删除指定名称的指标
                    for name in names:
                        if name in self._metrics:
                            if start_time or end_time:
                                # 删除时间范围内的样本
                                family = self._metrics[name]
                                for metric in family.get_all_metrics():
                                    original_count = len(metric.samples)
                                    metric.samples = [
                                        s for s in metric.samples
                                        if not (
                                            (start_time is None or s.timestamp >= start_time) and
                                            (end_time is None or s.timestamp <= end_time)
                                        )
                                    ]
                                    deleted_count += original_count - len(metric.samples)
                            else:
                                # 删除整个指标族
                                deleted_count += sum(
                                    len(m.samples) for m in self._metrics[name].get_all_metrics()
                                )
                                del self._metrics[name]
                else:
                    # 删除所有指标
                    if start_time or end_time:
                        # 删除时间范围内的样本
                        for family in self._metrics.values():
                            for metric in family.get_all_metrics():
                                original_count = len(metric.samples)
                                metric.samples = [
                                    s for s in metric.samples
                                    if not (
                                        (start_time is None or s.timestamp >= start_time) and
                                        (end_time is None or s.timestamp <= end_time)
                                    )
                                ]
                                deleted_count += original_count - len(metric.samples)
                    else:
                        # 删除所有指标
                        deleted_count = sum(
                            len(m.samples) 
                            for family in self._metrics.values()
                            for m in family.get_all_metrics()
                        )
                        self._metrics.clear()
            
            return deleted_count
            
        except Exception as e:
            self.logger.error(f"Failed to delete metrics: {e}")
            return 0
    
    async def get_metric_names(self) -> List[str]:
        """获取所有指标名称"""
        with self._storage_lock:
            return list(self._metrics.keys())
    
    async def get_storage_info(self) -> Dict[str, Any]:
        """获取存储信息"""
        with self._storage_lock:
            total_samples = sum(
                len(m.samples)
                for family in self._metrics.values()
                for m in family.get_all_metrics()
            )
            
            return {
                'type': 'memory',
                'metric_families': len(self._metrics),
                'total_samples': total_samples,
                'max_metrics': self.max_metrics,
                'max_samples_per_metric': self.max_samples_per_metric,
                'retention_hours': self.retention_hours,
                'stats': self.get_stats()
            }
    
    def _labels_to_key(self, labels: Dict[str, str]) -> str:
        """将标签转换为键"""
        return json.dumps(sorted(labels.items()), ensure_ascii=False)
    
    def _match_labels(self, metric_labels: Dict[str, str], filter_labels: Dict[str, str]) -> bool:
        """检查标签是否匹配"""
        for key, value in filter_labels.items():
            if metric_labels.get(key) != value:
                return False
        return True
    
    async def _cleanup_loop(self) -> None:
        """清理循环"""
        while self._running:
            try:
                await self._cleanup_expired_samples()
                
            except Exception as e:
                self.logger.error(f"Cleanup error: {e}")
            
            # 每小时清理一次
            await asyncio.sleep(3600)
    
    async def _cleanup_expired_samples(self) -> None:
        """清理过期样本"""
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=self.retention_hours)
        cleaned_count = 0
        
        with self._storage_lock:
            for family in self._metrics.values():
                for metric in family.get_all_metrics():
                    original_count = len(metric.samples)
                    metric.samples = [
                        s for s in metric.samples
                        if s.timestamp > cutoff_time
                    ]
                    cleaned_count += original_count - len(metric.samples)
        
        if cleaned_count > 0:
            self.logger.info(f"Cleaned up {cleaned_count} expired samples")
    
    async def _cleanup_old_metrics(self) -> None:
        """清理旧指标以释放空间"""
        with self._storage_lock:
            # 按最后更新时间排序，删除最旧的指标
            families_by_time = []
            for name, family in self._metrics.items():
                latest_time = datetime.min.replace(tzinfo=timezone.utc)
                for metric in family.get_all_metrics():
                    if metric.samples:
                        metric_latest = max(s.timestamp for s in metric.samples)
                        latest_time = max(latest_time, metric_latest)
                
                families_by_time.append((latest_time, name))
            
            families_by_time.sort()  # 按时间升序排序
            
            # 删除最旧的指标，直到数量在限制内
            while len(self._metrics) > self.max_metrics * 0.8:  # 保留80%的空间
                if families_by_time:
                    _, name_to_delete = families_by_time.pop(0)
                    if name_to_delete in self._metrics:
                        del self._metrics[name_to_delete]
                        self.logger.info(f"Cleaned up old metric family: {name_to_delete}")
                else:
                    break


# ================================
# 文件存储
# ================================

class FileMetricsStorage(MetricsStorage):
    """文件指标存储 - 使用SQLite数据库"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        
        # 文件配置
        self.db_path = Path(config.get('db_path', '/tmp/metrics.db'))
        self.compression = config.get('compression', True)
        self.batch_size = config.get('batch_size', 1000)
        
        # 数据库连接
        self._db_lock = threading.RLock()
        self._connection: Optional[sqlite3.Connection] = None
    
    async def initialize(self) -> None:
        """初始化存储"""
        self.logger.info(f"Initializing file metrics storage: {self.db_path}")
        
        # 确保目录存在
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 创建数据库连接
        with self._db_lock:
            self._connection = sqlite3.connect(
                str(self.db_path),
                check_same_thread=False,
                timeout=30.0
            )
            self._connection.row_factory = sqlite3.Row
            
            # 创建表结构
            await self._create_tables()
        
        self.logger.info("File metrics storage initialized")
    
    async def close(self) -> None:
        """关闭存储"""
        self.logger.info("Closing file metrics storage")
        
        with self._db_lock:
            if self._connection:
                self._connection.close()
                self._connection = None
        
        self.logger.info("File metrics storage closed")
    
    async def _create_tables(self) -> None:
        """创建数据库表"""
        cursor = self._connection.cursor()
        
        # 指标族表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS metric_families (
                name TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                description TEXT,
                unit TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 指标表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                family_name TEXT NOT NULL,
                labels TEXT,  -- JSON格式的标签
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (family_name) REFERENCES metric_families (name),
                UNIQUE(family_name, labels)
            )
        ''')
        
        # 样本表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS samples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                metric_id INTEGER NOT NULL,
                value REAL NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                FOREIGN KEY (metric_id) REFERENCES metrics (id)
            )
        ''')
        
        # 创建索引
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_samples_timestamp ON samples (timestamp)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_samples_metric_id ON samples (metric_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_metrics_family ON metrics (family_name)')
        
        self._connection.commit()
    
    async def write_metrics(self, metrics: List[MetricFamily]) -> bool:
        """写入指标"""
        try:
            with self._db_lock:
                cursor = self._connection.cursor()
                
                for family in metrics:
                    # 插入或更新指标族
                    cursor.execute('''
                        INSERT OR REPLACE INTO metric_families (name, type, description, unit)
                        VALUES (?, ?, ?, ?)
                    ''', (family.name, family.metric_type.value, family.description, family.unit))
                    
                    # 处理指标和样本
                    for metric in family.get_all_metrics():
                        labels_json = json.dumps(sorted(metric.labels.items()), ensure_ascii=False)
                        
                        # 插入或获取指标ID
                        cursor.execute('''
                            INSERT OR IGNORE INTO metrics (family_name, labels)
                            VALUES (?, ?)
                        ''', (family.name, labels_json))
                        
                        cursor.execute('''
                            SELECT id FROM metrics WHERE family_name = ? AND labels = ?
                        ''', (family.name, labels_json))
                        
                        metric_id = cursor.fetchone()[0]
                        
                        # 批量插入样本
                        sample_data = [
                            (metric_id, sample.value, sample.timestamp.isoformat())
                            for sample in metric.samples
                        ]
                        
                        if sample_data:
                            cursor.executemany('''
                                INSERT INTO samples (metric_id, value, timestamp)
                                VALUES (?, ?, ?)
                            ''', sample_data)
                
                self._connection.commit()
            
            self._update_write_stats(True)
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to write metrics: {e}")
            self._update_write_stats(False)
            return False
    
    async def read_metrics(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        labels: Optional[Dict[str, str]] = None,
        limit: Optional[int] = None
    ) -> List[MetricFamily]:
        """读取指标"""
        try:
            with self._db_lock:
                cursor = self._connection.cursor()
                
                # 构建查询
                query_parts = []
                params = []
                
                # 基础查询
                query = '''
                    SELECT DISTINCT mf.name, mf.type, mf.description, mf.unit,
                           m.labels, s.value, s.timestamp
                    FROM metric_families mf
                    JOIN metrics m ON mf.name = m.family_name
                    JOIN samples s ON m.id = s.metric_id
                    WHERE 1=1
                '''
                
                # 添加过滤条件
                if names:
                    placeholders = ','.join('?' * len(names))
                    query += f' AND mf.name IN ({placeholders})'
                    params.extend(names)
                
                if start_time:
                    query += ' AND s.timestamp >= ?'
                    params.append(start_time.isoformat())
                
                if end_time:
                    query += ' AND s.timestamp <= ?'
                    params.append(end_time.isoformat())
                
                # 标签过滤需要在Python中处理，因为SQLite的JSON支持有限
                
                query += ' ORDER BY mf.name, m.labels, s.timestamp'
                
                if limit:
                    query += f' LIMIT {limit * 1000}'  # 预估每个指标的样本数
                
                cursor.execute(query, params)
                rows = cursor.fetchall()
                
                # 组织数据
                families_dict = {}
                
                for row in rows:
                    family_name = row['name']
                    metric_labels = json.loads(row['labels']) if row['labels'] else {}
                    
                    # 标签过滤
                    if labels and not self._match_labels(dict(metric_labels), labels):
                        continue
                    
                    # 创建或获取指标族
                    if family_name not in families_dict:
                        families_dict[family_name] = MetricFamily(
                            name=family_name,
                            metric_type=MetricType(row['type']),
                            description=row['description'] or '',
                            unit=row['unit'] or ''
                        )
                    
                    family = families_dict[family_name]
                    
                    # 创建或获取指标
                    labels_key = json.dumps(sorted(metric_labels), ensure_ascii=False)
                    if labels_key not in family.metrics:
                        family.metrics[labels_key] = Metric(
                            name=family_name,
                            metric_type=family.metric_type,
                            description=family.description,
                            unit=family.unit,
                            labels=dict(metric_labels)
                        )
                    
                    metric = family.metrics[labels_key]
                    
                    # 添加样本
                    timestamp = datetime.fromisoformat(row['timestamp'])
                    sample = MetricSample(
                        value=row['value'],
                        timestamp=timestamp,
                        labels=dict(metric_labels)
                    )
                    metric.samples.append(sample)
                
                result = list(families_dict.values())
                
                # 应用限制
                if limit and len(result) > limit:
                    result = result[:limit]
            
            self._update_read_stats(True)
            return result
            
        except Exception as e:
            self.logger.error(f"Failed to read metrics: {e}")
            self._update_read_stats(False)
            return []
    
    async def delete_metrics(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> int:
        """删除指标"""
        try:
            with self._db_lock:
                cursor = self._connection.cursor()
                
                if names:
                    # 删除指定名称的指标
                    for name in names:
                        if start_time or end_time:
                            # 删除时间范围内的样本
                            query = '''
                                DELETE FROM samples 
                                WHERE metric_id IN (
                                    SELECT m.id FROM metrics m 
                                    JOIN metric_families mf ON m.family_name = mf.name 
                                    WHERE mf.name = ?
                                )
                            '''
                            params = [name]
                            
                            if start_time:
                                query += ' AND timestamp >= ?'
                                params.append(start_time.isoformat())
                            
                            if end_time:
                                query += ' AND timestamp <= ?'
                                params.append(end_time.isoformat())
                            
                            cursor.execute(query, params)
                        else:
                            # 删除整个指标族
                            cursor.execute('''
                                DELETE FROM samples 
                                WHERE metric_id IN (
                                    SELECT m.id FROM metrics m 
                                    JOIN metric_families mf ON m.family_name = mf.name 
                                    WHERE mf.name = ?
                                )
                            ''', (name,))
                            
                            cursor.execute('DELETE FROM metrics WHERE family_name = ?', (name,))
                            cursor.execute('DELETE FROM metric_families WHERE name = ?', (name,))
                else:
                    # 删除所有指标
                    if start_time or end_time:
                        query = 'DELETE FROM samples WHERE 1=1'
                        params = []
                        
                        if start_time:
                            query += ' AND timestamp >= ?'
                            params.append(start_time.isoformat())
                        
                        if end_time:
                            query += ' AND timestamp <= ?'
                            params.append(end_time.isoformat())
                        
                        cursor.execute(query, params)
                    else:
                        cursor.execute('DELETE FROM samples')
                        cursor.execute('DELETE FROM metrics')
                        cursor.execute('DELETE FROM metric_families')
                
                deleted_count = cursor.rowcount
                self._connection.commit()
                
                return deleted_count
                
        except Exception as e:
            self.logger.error(f"Failed to delete metrics: {e}")
            return 0
    
    async def get_metric_names(self) -> List[str]:
        """获取所有指标名称"""
        try:
            with self._db_lock:
                cursor = self._connection.cursor()
                cursor.execute('SELECT name FROM metric_families ORDER BY name')
                return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            self.logger.error(f"Failed to get metric names: {e}")
            return []
    
    async def get_storage_info(self) -> Dict[str, Any]:
        """获取存储信息"""
        try:
            with self._db_lock:
                cursor = self._connection.cursor()
                
                # 统计信息
                cursor.execute('SELECT COUNT(*) FROM metric_families')
                families_count = cursor.fetchone()[0]
                
                cursor.execute('SELECT COUNT(*) FROM metrics')
                metrics_count = cursor.fetchone()[0]
                
                cursor.execute('SELECT COUNT(*) FROM samples')
                samples_count = cursor.fetchone()[0]
                
                # 文件大小
                file_size = self.db_path.stat().st_size if self.db_path.exists() else 0
                
                return {
                    'type': 'file',
                    'db_path': str(self.db_path),
                    'file_size': file_size,
                    'metric_families': families_count,
                    'metrics': metrics_count,
                    'samples': samples_count,
                    'compression': self.compression,
                    'batch_size': self.batch_size,
                    'stats': self.get_stats()
                }
        except Exception as e:
            self.logger.error(f"Failed to get storage info: {e}")
            return {'type': 'file', 'error': str(e)}
    
    def _match_labels(self, metric_labels: Dict[str, str], filter_labels: Dict[str, str]) -> bool:
        """检查标签是否匹配"""
        for key, value in filter_labels.items():
            if metric_labels.get(key) != value:
                return False
        return True


# ================================
# Redis存储
# ================================

class RedisMetricsStorage(MetricsStorage):
    """Redis指标存储 - 适用于分布式环境"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        
        if not REDIS_AVAILABLE:
            raise ImportError("Redis not available. Install with: pip install redis")
        
        # Redis配置
        self.host = config.get('host', 'localhost')
        self.port = config.get('port', 6379)
        self.db = config.get('db', 0)
        self.password = config.get('password')
        self.key_prefix = config.get('key_prefix', 'metrics:')
        self.ttl = config.get('ttl', 7 * 24 * 3600)  # 7天
        
        # Redis连接
        self._redis: Optional[redis.Redis] = None
    
    async def initialize(self) -> None:
        """初始化存储"""
        self.logger.info(f"Initializing Redis metrics storage: {self.host}:{self.port}")
        
        self._redis = redis.Redis(
            host=self.host,
            port=self.port,
            db=self.db,
            password=self.password,
            decode_responses=True,
            socket_timeout=30,
            socket_connect_timeout=10
        )
        
        # 测试连接
        await asyncio.get_event_loop().run_in_executor(None, self._redis.ping)
        
        self.logger.info("Redis metrics storage initialized")
    
    async def close(self) -> None:
        """关闭存储"""
        self.logger.info("Closing Redis metrics storage")
        
        if self._redis:
            await asyncio.get_event_loop().run_in_executor(None, self._redis.close)
            self._redis = None
        
        self.logger.info("Redis metrics storage closed")
    
    async def write_metrics(self, metrics: List[MetricFamily]) -> bool:
        """写入指标"""
        try:
            loop = asyncio.get_event_loop()
            
            # 使用管道批量写入
            pipe = self._redis.pipeline()
            
            for family in metrics:
                # 存储指标族信息
                family_key = f"{self.key_prefix}family:{family.name}"
                family_data = {
                    'type': family.metric_type.value,
                    'description': family.description,
                    'unit': family.unit
                }
                pipe.hset(family_key, mapping=family_data)
                pipe.expire(family_key, self.ttl)
                
                # 存储指标和样本
                for metric in family.get_all_metrics():
                    labels_key = json.dumps(sorted(metric.labels.items()), ensure_ascii=False)
                    metric_key = f"{self.key_prefix}metric:{family.name}:{hash(labels_key)}"
                    
                    # 存储指标信息
                    metric_data = {
                        'labels': labels_key,
                        'name': metric.name
                    }
                    pipe.hset(metric_key, mapping=metric_data)
                    pipe.expire(metric_key, self.ttl)
                    
                    # 存储样本(使用有序集合，按时间戳排序)
                    samples_key = f"{metric_key}:samples"
                    for sample in metric.samples:
                        timestamp_score = sample.timestamp.timestamp()
                        sample_data = json.dumps({
                            'value': sample.value,
                            'timestamp': sample.timestamp.isoformat(),
                            'labels': sample.labels
                        }, ensure_ascii=False)
                        pipe.zadd(samples_key, {sample_data: timestamp_score})
                    
                    pipe.expire(samples_key, self.ttl)
            
            # 执行管道
            await loop.run_in_executor(None, pipe.execute)
            
            self._update_write_stats(True)
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to write metrics to Redis: {e}")
            self._update_write_stats(False)
            return False
    
    async def read_metrics(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        labels: Optional[Dict[str, str]] = None,
        limit: Optional[int] = None
    ) -> List[MetricFamily]:
        """读取指标"""
        try:
            loop = asyncio.get_event_loop()
            
            # 获取指标族名称
            if names:
                family_names = names
            else:
                pattern = f"{self.key_prefix}family:*"
                keys = await loop.run_in_executor(None, self._redis.keys, pattern)
                family_names = [key.split(':')[-1] for key in keys]
            
            families = []
            
            for family_name in family_names:
                # 获取指标族信息
                family_key = f"{self.key_prefix}family:{family_name}"
                family_data = await loop.run_in_executor(None, self._redis.hgetall, family_key)
                
                if not family_data:
                    continue
                
                family = MetricFamily(
                    name=family_name,
                    metric_type=MetricType(family_data['type']),
                    description=family_data.get('description', ''),
                    unit=family_data.get('unit', '')
                )
                
                # 获取指标
                metric_pattern = f"{self.key_prefix}metric:{family_name}:*"
                metric_keys = await loop.run_in_executor(None, self._redis.keys, metric_pattern)
                
                for metric_key in metric_keys:
                    # 获取指标信息
                    metric_data = await loop.run_in_executor(None, self._redis.hgetall, metric_key)
                    if not metric_data:
                        continue
                    
                    metric_labels = json.loads(metric_data['labels'])
                    
                    # 标签过滤
                    if labels and not self._match_labels(dict(metric_labels), labels):
                        continue
                    
                    # 获取样本
                    samples_key = f"{metric_key}:samples"
                    
                    # 时间范围过滤
                    min_score = start_time.timestamp() if start_time else '-inf'
                    max_score = end_time.timestamp() if end_time else '+inf'
                    
                    sample_data_list = await loop.run_in_executor(
                        None, 
                        self._redis.zrangebyscore, 
                        samples_key, 
                        min_score, 
                        max_score
                    )
                    
                    # 解析样本
                    samples = []
                    for sample_json in sample_data_list:
                        sample_dict = json.loads(sample_json)
                        sample = MetricSample(
                            value=sample_dict['value'],
                            timestamp=datetime.fromisoformat(sample_dict['timestamp']),
                            labels=sample_dict['labels']
                        )
                        samples.append(sample)
                    
                    if samples:
                        metric = Metric(
                            name=family_name,
                            metric_type=family.metric_type,
                            description=family.description,
                            unit=family.unit,
                            labels=dict(metric_labels),
                            samples=samples
                        )
                        
                        labels_key = json.dumps(sorted(metric_labels), ensure_ascii=False)
                        family.metrics[labels_key] = metric
                
                if family.metrics:
                    families.append(family)
            
            # 应用限制
            if limit and len(families) > limit:
                families = families[:limit]
            
            self._update_read_stats(True)
            return families
            
        except Exception as e:
            self.logger.error(f"Failed to read metrics from Redis: {e}")
            self._update_read_stats(False)
            return []
    
    async def delete_metrics(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> int:
        """删除指标"""
        try:
            loop = asyncio.get_event_loop()
            deleted_count = 0
            
            if names:
                # 删除指定名称的指标
                for name in names:
                    if start_time or end_time:
                        # 删除时间范围内的样本
                        metric_pattern = f"{self.key_prefix}metric:{name}:*"
                        metric_keys = await loop.run_in_executor(None, self._redis.keys, metric_pattern)
                        
                        for metric_key in metric_keys:
                            samples_key = f"{metric_key}:samples"
                            min_score = start_time.timestamp() if start_time else '-inf'
                            max_score = end_time.timestamp() if end_time else '+inf'
                            
                            count = await loop.run_in_executor(
                                None,
                                self._redis.zremrangebyscore,
                                samples_key,
                                min_score,
                                max_score
                            )
                            deleted_count += count
                    else:
                        # 删除整个指标族
                        keys_to_delete = []
                        
                        # 指标族键
                        keys_to_delete.append(f"{self.key_prefix}family:{name}")
                        
                        # 指标键
                        metric_pattern = f"{self.key_prefix}metric:{name}:*"
                        metric_keys = await loop.run_in_executor(None, self._redis.keys, metric_pattern)
                        keys_to_delete.extend(metric_keys)
                        
                        # 样本键
                        for metric_key in metric_keys:
                            keys_to_delete.append(f"{metric_key}:samples")
                        
                        if keys_to_delete:
                            deleted_count += await loop.run_in_executor(None, self._redis.delete, *keys_to_delete)
            else:
                # 删除所有指标
                pattern = f"{self.key_prefix}*"
                keys = await loop.run_in_executor(None, self._redis.keys, pattern)
                
                if keys:
                    if start_time or end_time:
                        # 只删除样本
                        sample_keys = [key for key in keys if key.endswith(':samples')]
                        for samples_key in sample_keys:
                            min_score = start_time.timestamp() if start_time else '-inf'
                            max_score = end_time.timestamp() if end_time else '+inf'
                            
                            count = await loop.run_in_executor(
                                None,
                                self._redis.zremrangebyscore,
                                samples_key,
                                min_score,
                                max_score
                            )
                            deleted_count += count
                    else:
                        # 删除所有键
                        deleted_count = await loop.run_in_executor(None, self._redis.delete, *keys)
            
            return deleted_count
            
        except Exception as e:
            self.logger.error(f"Failed to delete metrics from Redis: {e}")
            return 0
    
    async def get_metric_names(self) -> List[str]:
        """获取所有指标名称"""
        try:
            loop = asyncio.get_event_loop()
            pattern = f"{self.key_prefix}family:*"
            keys = await loop.run_in_executor(None, self._redis.keys, pattern)
            return [key.split(':')[-1] for key in keys]
        except Exception as e:
            self.logger.error(f"Failed to get metric names from Redis: {e}")
            return []
    
    async def get_storage_info(self) -> Dict[str, Any]:
        """获取存储信息"""
        try:
            loop = asyncio.get_event_loop()
            
            # Redis信息
            info = await loop.run_in_executor(None, self._redis.info)
            
            # 指标统计
            pattern = f"{self.key_prefix}*"
            keys = await loop.run_in_executor(None, self._redis.keys, pattern)
            
            family_keys = [k for k in keys if k.startswith(f"{self.key_prefix}family:")]
            metric_keys = [k for k in keys if k.startswith(f"{self.key_prefix}metric:") and not k.endswith(':samples')]
            sample_keys = [k for k in keys if k.endswith(':samples')]
            
            return {
                'type': 'redis',
                'host': self.host,
                'port': self.port,
                'db': self.db,
                'key_prefix': self.key_prefix,
                'ttl': self.ttl,
                'metric_families': len(family_keys),
                'metrics': len(metric_keys),
                'sample_collections': len(sample_keys),
                'redis_info': {
                    'used_memory': info.get('used_memory'),
                    'used_memory_human': info.get('used_memory_human'),
                    'connected_clients': info.get('connected_clients'),
                    'uptime_in_seconds': info.get('uptime_in_seconds')
                },
                'stats': self.get_stats()
            }
        except Exception as e:
            self.logger.error(f"Failed to get Redis storage info: {e}")
            return {'type': 'redis', 'error': str(e)}
    
    def _match_labels(self, metric_labels: Dict[str, str], filter_labels: Dict[str, str]) -> bool:
        """检查标签是否匹配"""
        for key, value in filter_labels.items():
            if metric_labels.get(key) != value:
                return False
        return True


# ================================
# InfluxDB存储
# ================================

class InfluxDBMetricsStorage(MetricsStorage):
    """InfluxDB指标存储 - 适用于时序数据"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        
        if not INFLUXDB_AVAILABLE:
            raise ImportError("InfluxDB client not available. Install with: pip install influxdb-client")
        
        # InfluxDB配置
        self.url = config.get('url', 'http://localhost:8086')
        self.token = config.get('token')
        self.org = config.get('org', 'zishu')
        self.bucket = config.get('bucket', 'metrics')
        
        # 客户端
        self._client: Optional[InfluxDBClient] = None
        self._write_api = None
        self._query_api = None
    
    async def initialize(self) -> None:
        """初始化存储"""
        self.logger.info(f"Initializing InfluxDB metrics storage: {self.url}")
        
        self._client = InfluxDBClient(
            url=self.url,
            token=self.token,
            org=self.org
        )
        
        self._write_api = self._client.write_api(write_options=SYNCHRONOUS)
        self._query_api = self._client.query_api()
        
        # 测试连接
        try:
            await asyncio.get_event_loop().run_in_executor(
                None, 
                self._client.ping
            )
        except Exception as e:
            raise ConnectionError(f"Failed to connect to InfluxDB: {e}")
        
        self.logger.info("InfluxDB metrics storage initialized")
    
    async def close(self) -> None:
        """关闭存储"""
        self.logger.info("Closing InfluxDB metrics storage")
        
        if self._client:
            self._client.close()
            self._client = None
            self._write_api = None
            self._query_api = None
        
        self.logger.info("InfluxDB metrics storage closed")
    
    async def write_metrics(self, metrics: List[MetricFamily]) -> bool:
        """写入指标"""
        try:
            loop = asyncio.get_event_loop()
            points = []
            
            for family in metrics:
                for metric in family.get_all_metrics():
                    for sample in metric.samples:
                        # 创建InfluxDB Point
                        point = Point(metric.name)
                        
                        # 添加标签
                        for key, value in sample.labels.items():
                            point = point.tag(key, value)
                        
                        # 添加字段
                        point = point.field("value", sample.value)
                        
                        # 设置时间戳
                        point = point.time(sample.timestamp, WritePrecision.NS)
                        
                        points.append(point)
            
            # 批量写入
            if points:
                await loop.run_in_executor(
                    None,
                    self._write_api.write,
                    self.bucket,
                    self.org,
                    points
                )
            
            self._update_write_stats(True)
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to write metrics to InfluxDB: {e}")
            self._update_write_stats(False)
            return False
    
    async def read_metrics(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        labels: Optional[Dict[str, str]] = None,
        limit: Optional[int] = None
    ) -> List[MetricFamily]:
        """读取指标"""
        try:
            loop = asyncio.get_event_loop()
            
            # 构建Flux查询
            query_parts = [f'from(bucket: "{self.bucket}")']
            
            # 时间范围
            if start_time:
                query_parts.append(f'|> range(start: {start_time.isoformat()})')
            else:
                query_parts.append('|> range(start: -7d)')  # 默认7天
            
            if end_time:
                query_parts[-1] = query_parts[-1].replace(')', f', stop: {end_time.isoformat()})')
            
            # 指标名称过滤
            if names:
                measurement_filter = ' or '.join([f'r._measurement == "{name}"' for name in names])
                query_parts.append(f'|> filter(fn: (r) => {measurement_filter})')
            
            # 标签过滤
            if labels:
                for key, value in labels.items():
                    query_parts.append(f'|> filter(fn: (r) => r.{key} == "{value}")')
            
            # 限制
            if limit:
                query_parts.append(f'|> limit(n: {limit})')
            
            query = ' '.join(query_parts)
            
            # 执行查询
            tables = await loop.run_in_executor(
                None,
                self._query_api.query,
                query,
                self.org
            )
            
            # 组织数据
            families_dict = {}
            
            for table in tables:
                for record in table.records:
                    measurement = record.get_measurement()
                    
                    # 创建或获取指标族
                    if measurement not in families_dict:
                        families_dict[measurement] = MetricFamily(
                            name=measurement,
                            metric_type=MetricType.GAUGE,  # InfluxDB中默认为GAUGE
                            description='',
                            unit=''
                        )
                    
                    family = families_dict[measurement]
                    
                    # 获取标签
                    metric_labels = {}
                    for key, value in record.values.items():
                        if key not in ['_time', '_value', '_field', '_measurement', '_start', '_stop']:
                            metric_labels[key] = str(value)
                    
                    # 创建或获取指标
                    labels_key = json.dumps(sorted(metric_labels.items()), ensure_ascii=False)
                    if labels_key not in family.metrics:
                        family.metrics[labels_key] = Metric(
                            name=measurement,
                            metric_type=family.metric_type,
                            description=family.description,
                            unit=family.unit,
                            labels=metric_labels
                        )
                    
                    metric = family.metrics[labels_key]
                    
                    # 添加样本
                    sample = MetricSample(
                        value=float(record.get_value()),
                        timestamp=record.get_time(),
                        labels=metric_labels
                    )
                    metric.samples.append(sample)
            
            result = list(families_dict.values())
            
            self._update_read_stats(True)
            return result
            
        except Exception as e:
            self.logger.error(f"Failed to read metrics from InfluxDB: {e}")
            self._update_read_stats(False)
            return []
    
    async def delete_metrics(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> int:
        """删除指标"""
        try:
            loop = asyncio.get_event_loop()
            
            # InfluxDB删除API
            delete_api = self._client.delete_api()
            
            # 时间范围
            start = start_time or datetime(1970, 1, 1, tzinfo=timezone.utc)
            stop = end_time or datetime.now(timezone.utc)
            
            # 构建删除谓词
            if names:
                predicates = []
                for name in names:
                    predicates.append(f'_measurement="{name}"')
                predicate = ' OR '.join(predicates)
            else:
                predicate = '_measurement!=""'  # 删除所有测量值
            
            # 执行删除
            await loop.run_in_executor(
                None,
                delete_api.delete,
                start,
                stop,
                predicate,
                self.bucket,
                self.org
            )
            
            # InfluxDB不返回删除计数，返回估计值
            return 1  # 表示操作成功
            
        except Exception as e:
            self.logger.error(f"Failed to delete metrics from InfluxDB: {e}")
            return 0
    
    async def get_metric_names(self) -> List[str]:
        """获取所有指标名称"""
        try:
            loop = asyncio.get_event_loop()
            
            query = f'''
                from(bucket: "{self.bucket}")
                |> range(start: -30d)
                |> group(columns: ["_measurement"])
                |> distinct(column: "_measurement")
            '''
            
            tables = await loop.run_in_executor(
                None,
                self._query_api.query,
                query,
                self.org
            )
            
            names = []
            for table in tables:
                for record in table.records:
                    measurement = record.get_measurement()
                    if measurement not in names:
                        names.append(measurement)
            
            return sorted(names)
            
        except Exception as e:
            self.logger.error(f"Failed to get metric names from InfluxDB: {e}")
            return []
    
    async def get_storage_info(self) -> Dict[str, Any]:
        """获取存储信息"""
        try:
            loop = asyncio.get_event_loop()
            
            # 获取bucket信息
            buckets_api = self._client.buckets_api()
            bucket_info = await loop.run_in_executor(
                None,
                buckets_api.find_bucket_by_name,
                self.bucket
            )
            
            return {
                'type': 'influxdb',
                'url': self.url,
                'org': self.org,
                'bucket': self.bucket,
                'bucket_info': {
                    'id': bucket_info.id if bucket_info else None,
                    'name': bucket_info.name if bucket_info else None,
                    'retention_rules': [
                        {
                            'type': rule.type,
                            'every_seconds': rule.every_seconds
                        }
                        for rule in (bucket_info.retention_rules or [])
                    ] if bucket_info else []
                },
                'stats': self.get_stats()
            }
        except Exception as e:
            self.logger.error(f"Failed to get InfluxDB storage info: {e}")
            return {'type': 'influxdb', 'error': str(e)}


# ================================
# 存储管理器
# ================================

class MetricsStorageManager:
    """指标存储管理器 - 统一管理多种存储后端"""
    
    def __init__(self):
        """初始化存储管理器"""
        self._storages: Dict[str, MetricsStorage] = {}
        self._primary_storage: Optional[str] = None
        self.logger = logging.getLogger(f"{__name__}.MetricsStorageManager")
    
    def register_storage(self, name: str, storage: MetricsStorage, is_primary: bool = False) -> None:
        """注册存储后端"""
        self._storages[name] = storage
        
        if is_primary or not self._primary_storage:
            self._primary_storage = name
        
        self.logger.info(f"Registered storage backend: {name} (primary: {is_primary})")
    
    def get_storage(self, name: str) -> Optional[MetricsStorage]:
        """获取存储后端"""
        return self._storages.get(name)
    
    def get_primary_storage(self) -> Optional[MetricsStorage]:
        """获取主存储后端"""
        if self._primary_storage:
            return self._storages.get(self._primary_storage)
        return None
    
    def list_storages(self) -> List[str]:
        """列出所有存储后端"""
        return list(self._storages.keys())
    
    async def initialize_all(self) -> None:
        """初始化所有存储后端"""
        for name, storage in self._storages.items():
            try:
                await storage.initialize()
                self.logger.info(f"Initialized storage: {name}")
            except Exception as e:
                self.logger.error(f"Failed to initialize storage {name}: {e}")
    
    async def close_all(self) -> None:
        """关闭所有存储后端"""
        for name, storage in self._storages.items():
            try:
                await storage.close()
                self.logger.info(f"Closed storage: {name}")
            except Exception as e:
                self.logger.error(f"Failed to close storage {name}: {e}")
    
    async def write_to_all(self, metrics: List[MetricFamily]) -> Dict[str, bool]:
        """写入到所有存储后端"""
        results = {}
        
        for name, storage in self._storages.items():
            try:
                success = await storage.write_metrics(metrics)
                results[name] = success
            except Exception as e:
                self.logger.error(f"Failed to write to storage {name}: {e}")
                results[name] = False
        
        return results
    
    async def read_from_primary(
        self,
        names: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        labels: Optional[Dict[str, str]] = None,
        limit: Optional[int] = None
    ) -> List[MetricFamily]:
        """从主存储读取指标"""
        primary = self.get_primary_storage()
        if primary:
            return await primary.read_metrics(names, start_time, end_time, labels, limit)
        return []
    
    def create_storage(self, storage_type: str, config: Dict[str, Any]) -> MetricsStorage:
        """创建存储实例"""
        if storage_type == 'memory':
            return MemoryMetricsStorage(config)
        elif storage_type == 'file':
            return FileMetricsStorage(config)
        elif storage_type == 'redis':
            return RedisMetricsStorage(config)
        elif storage_type == 'influxdb':
            return InfluxDBMetricsStorage(config)
        else:
            raise ValueError(f"Unsupported storage type: {storage_type}")
    
    async def get_all_storage_info(self) -> Dict[str, Any]:
        """获取所有存储信息"""
        info = {
            'primary_storage': self._primary_storage,
            'storages': {}
        }
        
        for name, storage in self._storages.items():
            try:
                storage_info = await storage.get_storage_info()
                info['storages'][name] = storage_info
            except Exception as e:
                info['storages'][name] = {'error': str(e)}
        
        return info
