"""
适配器性能监控工具
"""

import asyncio
import functools
import gc
import json
import logging
import os
import platform
import socket
import sys
import threading
import time
import traceback
import uuid
import warnings
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager, asynccontextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum, auto
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union, TypeVar, Generic
import weakref

# 第三方库导入
import psutil
from loguru import logger

# 项目内部导入
try:
    import torch
    import torch.cuda
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch不可用，GPU监控功能将被禁用")

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("NumPy不可用，部分数值分析功能将被限制")

# ================== 核心枚举和数据结构 ==================

class PerformanceLevel(Enum):
    """性能级别枚举"""
    EXCELLENT = "excellent"    # 优秀 (< P75)
    GOOD = "good"             # 良好 (P75-P90)
    NORMAL = "normal"         # 正常 (P90-P95)
    POOR = "poor"             # 较差 (P95-P99)
    CRITICAL = "critical"     # 严重 (> P99)

class MetricType(Enum):
    """指标类型枚举"""
    COUNTER = "counter"       # 计数器
    GAUGE = "gauge"          # 仪表盘
    HISTOGRAM = "histogram"   # 直方图
    TIMER = "timer"          # 计时器
    RATE = "rate"            # 速率

class ResourceType(Enum):
    """资源类型枚举"""
    CPU = "cpu"
    MEMORY = "memory"
    GPU = "gpu"
    DISK = "disk"
    NETWORK = "network"
    ADAPTER = "adapter"

class AlertLevel(Enum):
    """告警级别枚举"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

@dataclass
class PerformanceMetric:
    """性能指标数据结构"""
    name: str
    value: float
    metric_type: MetricType
    timestamp: datetime = field(default_factory=datetime.now)
    labels: Dict[str, str] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    resource_type: Optional[ResourceType] = None

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'name': self.name,
            'value': self.value,
            'metric_type': self.metric_type.value,
            'timestamp': self.timestamp.isoformat(),
            'labels': self.labels,
            'metadata': self.metadata,
            'resource_type': self.resource_type.value if self.resource_type else None
        }

@dataclass
class AdapterPerformanceInfo:
    """适配器性能信息"""
    adapter_name: str
    execution_time: float
    memory_used: float
    cpu_usage: float
    gpu_usage: Optional[float] = None
    success: bool = True
    error_message: Optional[str] = None
    input_size: Optional[int] = None
    output_size: Optional[int] = None
    model_info: Optional[Dict[str, Any]] = None
    
    @property
    def performance_level(self) -> PerformanceLevel:
        """计算性能级别"""
        if self.execution_time < 0.1:
            return PerformanceLevel.EXCELLENT
        elif self.execution_time < 0.5:
            return PerformanceLevel.GOOD
        elif self.execution_time < 1.0:
            return PerformanceLevel.NORMAL
        elif self.execution_time < 3.0:
            return PerformanceLevel.POOR
        else:
            return PerformanceLevel.CRITICAL

@dataclass
class SystemSnapshot:
    """系统快照"""
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    disk_usage: float
    gpu_memory: Optional[float] = None
    gpu_utilization: Optional[float] = None
    process_count: int = 0
    thread_count: int = 0
    network_io: Optional[Dict[str, float]] = None

# ================== 性能监控组件 ==================

class MetricsCollector:
    """指标收集器 - 线程安全的高性能指标存储"""
    
    def __init__(self, max_metrics: int = 10000, retention_hours: int = 24):
        self.max_metrics = max_metrics
        self.retention_hours = retention_hours
        self._metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=max_metrics))
        self._lock = threading.RLock()
        self._cleanup_interval = 3600  # 1小时清理一次
        self._last_cleanup = time.time()
    
    def record(self, metric: PerformanceMetric) -> None:
        """记录性能指标"""
        with self._lock:
            self._metrics[metric.name].append(metric)
            
            # 定期清理过期数据
            current_time = time.time()
            if current_time - self._last_cleanup > self._cleanup_interval:
                self._cleanup_expired_metrics()
                self._last_cleanup = current_time
    
    def get_latest(self, metric_name: str) -> Optional[PerformanceMetric]:
        """获取最新指标"""
        with self._lock:
            metrics = self._metrics.get(metric_name)
            return metrics[-1] if metrics else None
    
    def get_history(self, metric_name: str, hours: int = 1) -> List[PerformanceMetric]:
        """获取历史数据"""
        cutoff = datetime.now() - timedelta(hours=hours)
        with self._lock:
            metrics = self._metrics.get(metric_name, deque())
            return [m for m in metrics if m.timestamp > cutoff]
    
    def get_statistics(self, metric_name: str, hours: int = 1) -> Dict[str, float]:
        """获取统计信息"""
        history = self.get_history(metric_name, hours)
        if not history:
            return {}
        
        values = [m.value for m in history]
        values.sort()
        n = len(values)
        
        return {
            'count': n,
            'min': values[0],
            'max': values[-1],
            'mean': sum(values) / n,
            'median': values[n // 2],
            'p90': values[int(n * 0.9)] if n > 10 else values[-1],
            'p95': values[int(n * 0.95)] if n > 20 else values[-1],
            'p99': values[int(n * 0.99)] if n > 100 else values[-1],
        }
    
    def _cleanup_expired_metrics(self) -> int:
        """清理过期指标"""
        cutoff = datetime.now() - timedelta(hours=self.retention_hours)
        cleaned_count = 0
        
        for metric_name, metrics in self._metrics.items():
            original_len = len(metrics)
            # 保留未过期的指标
            while metrics and metrics[0].timestamp < cutoff:
                metrics.popleft()
                cleaned_count += 1
        
        return cleaned_count
    
    def get_all_metric_names(self) -> List[str]:
        """获取所有指标名称"""
        with self._lock:
            return list(self._metrics.keys())
    
    def clear_metrics(self, metric_name: Optional[str] = None) -> None:
        """清除指标数据"""
        with self._lock:
            if metric_name:
                self._metrics[metric_name].clear()
            else:
                self._metrics.clear()

class SystemMonitor:
    """系统监控器 - 监控系统资源使用情况"""
    
    def __init__(self, collector: MetricsCollector):
        self.collector = collector
        self._last_network_io = None
        self._last_network_time = None
        self._process = psutil.Process()
    
    def collect_system_metrics(self) -> SystemSnapshot:
        """收集系统指标"""
        try:
            # CPU指标
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            # 内存指标
            memory = psutil.virtual_memory()
            
            # 磁盘指标
            disk = psutil.disk_usage('/')
            
            # 进程和线程数
            process_count = len(psutil.pids())
            thread_count = self._process.num_threads()
            
            # GPU指标
            gpu_memory = None
            gpu_utilization = None
            if TORCH_AVAILABLE and torch.cuda.is_available():
                try:
                    gpu_memory = torch.cuda.memory_allocated() / torch.cuda.max_memory_allocated() * 100 if torch.cuda.max_memory_allocated() > 0 else 0
                except Exception:
                    gpu_memory = 0
            
            # 网络IO
            network_io = self._calculate_network_rate()
            
            snapshot = SystemSnapshot(
                timestamp=datetime.now(),
                cpu_percent=cpu_percent,
                memory_percent=memory.percent,
                disk_usage=disk.percent,
                gpu_memory=gpu_memory,
                gpu_utilization=gpu_utilization,
                process_count=process_count,
                thread_count=thread_count,
                network_io=network_io
            )
            
            # 记录到收集器
            self._record_system_metrics(snapshot)
            
            return snapshot
            
        except Exception as e:
            logger.error(f"收集系统指标失败: {e}")
            return SystemSnapshot(timestamp=datetime.now(), cpu_percent=0, memory_percent=0, disk_usage=0)
    
    def _calculate_network_rate(self) -> Optional[Dict[str, float]]:
        """计算网络速率"""
        try:
            current_io = psutil.net_io_counters()
            current_time = time.time()
            
            if self._last_network_io and self._last_network_time:
                time_delta = current_time - self._last_network_time
                if time_delta > 0:
                    bytes_sent_rate = (current_io.bytes_sent - self._last_network_io.bytes_sent) / time_delta
                    bytes_recv_rate = (current_io.bytes_recv - self._last_network_io.bytes_recv) / time_delta
                    
                    network_rate = {
                        'bytes_sent_per_sec': bytes_sent_rate,
                        'bytes_recv_per_sec': bytes_recv_rate,
                        'total_bytes_per_sec': bytes_sent_rate + bytes_recv_rate
                    }
                else:
                    network_rate = None
            else:
                network_rate = None
            
            self._last_network_io = current_io
            self._last_network_time = current_time
            
            return network_rate
            
        except Exception:
            return None
    
    def _record_system_metrics(self, snapshot: SystemSnapshot) -> None:
        """记录系统指标到收集器"""
        metrics = [
            PerformanceMetric("system.cpu.percent", snapshot.cpu_percent, MetricType.GAUGE, resource_type=ResourceType.CPU),
            PerformanceMetric("system.memory.percent", snapshot.memory_percent, MetricType.GAUGE, resource_type=ResourceType.MEMORY),
            PerformanceMetric("system.disk.percent", snapshot.disk_usage, MetricType.GAUGE, resource_type=ResourceType.DISK),
            PerformanceMetric("system.process.count", snapshot.process_count, MetricType.GAUGE),
            PerformanceMetric("system.thread.count", snapshot.thread_count, MetricType.GAUGE),
        ]
        
        if snapshot.gpu_memory is not None:
            metrics.append(PerformanceMetric("system.gpu.memory_percent", snapshot.gpu_memory, MetricType.GAUGE, resource_type=ResourceType.GPU))
        
        if snapshot.gpu_utilization is not None:
            metrics.append(PerformanceMetric("system.gpu.utilization", snapshot.gpu_utilization, MetricType.GAUGE, resource_type=ResourceType.GPU))
        
        if snapshot.network_io:
            for key, value in snapshot.network_io.items():
                metrics.append(PerformanceMetric(f"system.network.{key}", value, MetricType.GAUGE, resource_type=ResourceType.NETWORK))
        
        for metric in metrics:
            self.collector.record(metric)

class AdapterMonitor:
    """适配器监控器 - 专门监控适配器性能"""
    
    def __init__(self, collector: MetricsCollector):
        self.collector = collector
        self.active_executions: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
    
    @contextmanager
    def monitor_execution(self, adapter_name: str, metadata: Optional[Dict[str, Any]] = None):
        """监控适配器执行的上下文管理器"""
        execution_id = str(uuid.uuid4())
        start_time = time.time()
        start_memory = self._get_memory_usage()
        start_cpu_time = self._get_cpu_time()
        
        # GPU监控
        start_gpu_memory = None
        if TORCH_AVAILABLE and torch.cuda.is_available():
            start_gpu_memory = torch.cuda.memory_allocated()
        
        # 记录开始执行
        with self._lock:
            self.active_executions[execution_id] = {
                'adapter_name': adapter_name,
                'start_time': start_time,
                'start_memory': start_memory,
                'start_cpu_time': start_cpu_time,
                'start_gpu_memory': start_gpu_memory,
                'metadata': metadata or {}
            }
        
        try:
            yield execution_id
            success = True
            error_message = None
        except Exception as e:
            success = False
            error_message = str(e)
            raise
        finally:
            # 计算性能指标
            end_time = time.time()
            end_memory = self._get_memory_usage()
            end_cpu_time = self._get_cpu_time()
            
            execution_time = end_time - start_time
            memory_delta = end_memory - start_memory
            cpu_usage = (end_cpu_time - start_cpu_time) / execution_time * 100 if execution_time > 0 else 0
            
            gpu_usage = None
            if start_gpu_memory is not None and TORCH_AVAILABLE and torch.cuda.is_available():
                end_gpu_memory = torch.cuda.memory_allocated()
                gpu_usage = end_gpu_memory - start_gpu_memory
            
            # 创建性能信息
            perf_info = AdapterPerformanceInfo(
                adapter_name=adapter_name,
                execution_time=execution_time,
                memory_used=memory_delta,
                cpu_usage=cpu_usage,
                gpu_usage=gpu_usage,
                success=success,
                error_message=error_message,
                **(self.active_executions[execution_id].get('metadata', {}))
            )
            
            # 记录性能指标
            self._record_adapter_metrics(perf_info)
            
            # 清理执行记录
            with self._lock:
                del self.active_executions[execution_id]
    
    async def monitor_async_execution(self, adapter_name: str, metadata: Optional[Dict[str, Any]] = None):
        """异步适配器执行监控的上下文管理器"""
        execution_id = str(uuid.uuid4())
        start_time = time.time()
        start_memory = self._get_memory_usage()
        
        # 记录开始执行
        with self._lock:
            self.active_executions[execution_id] = {
                'adapter_name': adapter_name,
                'start_time': start_time,
                'start_memory': start_memory,
                'metadata': metadata or {}
            }
        
        class AsyncMonitorContext:
            def __init__(self, monitor, execution_id):
                self.monitor = monitor
                self.execution_id = execution_id
                self.success = True
                self.error_message = None
            
            async def __aenter__(self):
                return self.execution_id
            
            async def __aexit__(self, exc_type, exc_val, exc_tb):
                if exc_type is not None:
                    self.success = False
                    self.error_message = str(exc_val)
                
                end_time = time.time()
                end_memory = self.monitor._get_memory_usage()
                
                execution_info = self.monitor.active_executions[self.execution_id]
                execution_time = end_time - execution_info['start_time']
                memory_delta = end_memory - execution_info['start_memory']
                
                perf_info = AdapterPerformanceInfo(
                    adapter_name=execution_info['adapter_name'],
                    execution_time=execution_time,
                    memory_used=memory_delta,
                    cpu_usage=0,  # 异步执行时CPU使用率计算复杂，暂时设为0
                    success=self.success,
                    error_message=self.error_message,
                    **(execution_info.get('metadata', {}))
                )
                
                self.monitor._record_adapter_metrics(perf_info)
                
                with self.monitor._lock:
                    del self.monitor.active_executions[self.execution_id]
        
        return AsyncMonitorContext(self, execution_id)
    
    def _get_memory_usage(self) -> float:
        """获取当前内存使用量(MB)"""
        try:
            process = psutil.Process()
            return process.memory_info().rss / (1024 * 1024)
        except:
            return 0.0
    
    def _get_cpu_time(self) -> float:
        """获取CPU时间"""
        try:
            process = psutil.Process()
            cpu_times = process.cpu_times()
            return cpu_times.user + cpu_times.system
        except:
            return 0.0
    
    def _record_adapter_metrics(self, perf_info: AdapterPerformanceInfo) -> None:
        """记录适配器性能指标"""
        base_labels = {'adapter': perf_info.adapter_name, 'success': str(perf_info.success)}
        
        metrics = [
            PerformanceMetric(
                f"adapter.{perf_info.adapter_name}.execution_time",
                perf_info.execution_time,
                MetricType.TIMER,
                labels=base_labels,
                resource_type=ResourceType.ADAPTER
            ),
            PerformanceMetric(
                f"adapter.{perf_info.adapter_name}.memory_used",
                perf_info.memory_used,
                MetricType.GAUGE,
                labels=base_labels,
                resource_type=ResourceType.ADAPTER
            ),
            PerformanceMetric(
                f"adapter.{perf_info.adapter_name}.cpu_usage",
                perf_info.cpu_usage,
                MetricType.GAUGE,
                labels=base_labels,
                resource_type=ResourceType.ADAPTER
            ),
        ]
        
        if perf_info.gpu_usage is not None:
            metrics.append(
                PerformanceMetric(
                    f"adapter.{perf_info.adapter_name}.gpu_memory",
                    perf_info.gpu_usage,
                    MetricType.GAUGE,
                    labels=base_labels,
                    resource_type=ResourceType.ADAPTER
                )
            )
        
        # 记录执行计数
        metrics.append(
            PerformanceMetric(
                f"adapter.{perf_info.adapter_name}.executions",
                1,
                MetricType.COUNTER,
                labels=base_labels,
                resource_type=ResourceType.ADAPTER
            )
        )
        
        # 如果执行失败，记录错误计数
        if not perf_info.success:
            metrics.append(
                PerformanceMetric(
                    f"adapter.{perf_info.adapter_name}.errors",
                    1,
                    MetricType.COUNTER,
                    labels={**base_labels, 'error': perf_info.error_message or 'unknown'},
                    resource_type=ResourceType.ADAPTER
                )
            )
        
        for metric in metrics:
            self.collector.record(metric)
    
    def get_active_executions(self) -> Dict[str, Dict[str, Any]]:
        """获取当前活跃的执行"""
        with self._lock:
            return dict(self.active_executions)
    
    def get_adapter_statistics(self, adapter_name: str, hours: int = 24) -> Dict[str, Any]:
        """获取适配器统计信息"""
        execution_stats = self.collector.get_statistics(f"adapter.{adapter_name}.execution_time", hours)
        memory_stats = self.collector.get_statistics(f"adapter.{adapter_name}.memory_used", hours)
        
        # 计算成功率
        execution_history = self.collector.get_history(f"adapter.{adapter_name}.executions", hours)
        error_history = self.collector.get_history(f"adapter.{adapter_name}.errors", hours)
        
        total_executions = len(execution_history)
        failed_executions = len(error_history)
        success_rate = ((total_executions - failed_executions) / total_executions * 100) if total_executions > 0 else 0
        
        return {
            'adapter_name': adapter_name,
            'execution_time': execution_stats,
            'memory_usage': memory_stats,
            'success_rate': success_rate,
            'total_executions': total_executions,
            'failed_executions': failed_executions,
        }

# ================== 主要性能监控类 ==================

class PerformanceMonitor:
    """主性能监控器 - 统一管理所有监控功能"""
    
    def __init__(self, 
                 max_metrics: int = 10000,
                 retention_hours: int = 24,
                 collection_interval: int = 60,
                 enable_gpu_monitoring: bool = True):
        """
        初始化性能监控器
        
        Args:
            max_metrics: 最大指标数量
            retention_hours: 数据保留小时数
            collection_interval: 数据收集间隔(秒)
            enable_gpu_monitoring: 是否启用GPU监控
        """
        self.max_metrics = max_metrics
        self.retention_hours = retention_hours
        self.collection_interval = collection_interval
        self.enable_gpu_monitoring = enable_gpu_monitoring and TORCH_AVAILABLE
        
        # 初始化组件
        self.collector = MetricsCollector(max_metrics, retention_hours)
        self.system_monitor = SystemMonitor(self.collector)
        self.adapter_monitor = AdapterMonitor(self.collector)
        
        # 监控状态
        self._monitoring_active = False
        self._monitoring_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        
        logger.info(f"性能监控器初始化完成 - GPU监控: {'启用' if self.enable_gpu_monitoring else '禁用'}")
    
    def start_monitoring(self) -> None:
        """启动性能监控"""
        if self._monitoring_active:
            logger.warning("性能监控已经启动")
            return
        
        self._monitoring_active = True
        self._stop_event.clear()
        
        self._monitoring_thread = threading.Thread(
            target=self._monitoring_loop,
            daemon=True,
            name="PerformanceMonitor"
        )
        self._monitoring_thread.start()
        
        logger.info(f"性能监控启动 - 收集间隔: {self.collection_interval}秒")
    
    def stop_monitoring(self) -> None:
        """停止性能监控"""
        if not self._monitoring_active:
            logger.warning("性能监控未启动")
            return
        
        self._monitoring_active = False
        self._stop_event.set()
        
        if self._monitoring_thread:
            self._monitoring_thread.join(timeout=5)
        
        logger.info("性能监控已停止")
    
    def _monitoring_loop(self) -> None:
        """监控循环"""
        while self._monitoring_active and not self._stop_event.is_set():
            try:
                # 收集系统指标
                self.system_monitor.collect_system_metrics()
                
            except Exception as e:
                logger.error(f"监控循环发生错误: {e}")
                logger.error(traceback.format_exc())
            
            # 等待下一次收集
            self._stop_event.wait(self.collection_interval)
    
    # ================== 装饰器支持 ==================
    
    def monitor_adapter(self, adapter_name: Optional[str] = None, **metadata):
        """适配器监控装饰器"""
        def decorator(func):
            nonlocal adapter_name
            if adapter_name is None:
                adapter_name = f"{func.__module__}.{func.__name__}"
            
            if asyncio.iscoroutinefunction(func):
                @functools.wraps(func)
                async def async_wrapper(*args, **kwargs):
                    async with await self.adapter_monitor.monitor_async_execution(adapter_name, metadata):
                        return await func(*args, **kwargs)
                return async_wrapper
            else:
                @functools.wraps(func)
                def sync_wrapper(*args, **kwargs):
                    with self.adapter_monitor.monitor_execution(adapter_name, metadata):
                        return func(*args, **kwargs)
                return sync_wrapper
        
        return decorator
    
    def time_it(self, metric_name: Optional[str] = None):
        """执行时间监控装饰器"""
        def decorator(func):
            nonlocal metric_name
            if metric_name is None:
                metric_name = f"timer.{func.__module__}.{func.__name__}"
            
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                try:
                    result = func(*args, **kwargs)
                    execution_time = time.time() - start_time
                    
                    self.collector.record(
                        PerformanceMetric(
                            metric_name,
                            execution_time,
                            MetricType.TIMER,
                            labels={'function': func.__name__, 'success': 'true'}
                        )
                    )
                    return result
                except Exception as e:
                    execution_time = time.time() - start_time
                    self.collector.record(
                        PerformanceMetric(
                            metric_name,
                            execution_time,
                            MetricType.TIMER,
                            labels={'function': func.__name__, 'success': 'false', 'error': str(e)}
                        )
                    )
                    raise
            
            return wrapper
        return decorator
    
    # ================== 上下文管理器 ==================
    
    @contextmanager
    def measure_time(self, metric_name: str, labels: Optional[Dict[str, str]] = None):
        """测量执行时间的上下文管理器"""
        start_time = time.time()
        try:
            yield
        finally:
            execution_time = time.time() - start_time
            self.collector.record(
                PerformanceMetric(
                    metric_name,
                    execution_time,
                    MetricType.TIMER,
                    labels=labels or {}
                )
            )
    
    @contextmanager
    def measure_memory(self, metric_name: str, labels: Optional[Dict[str, str]] = None):
        """测量内存使用的上下文管理器"""
        gc.collect()  # 强制垃圾回收
        start_memory = psutil.Process().memory_info().rss
        
        try:
            yield
        finally:
            gc.collect()
            end_memory = psutil.Process().memory_info().rss
            memory_delta = (end_memory - start_memory) / (1024 * 1024)  # MB
            
            self.collector.record(
                PerformanceMetric(
                    metric_name,
                    memory_delta,
                    MetricType.GAUGE,
                    labels=labels or {}
                )
            )
    
    # ================== 查询接口 ==================
    
    def get_system_status(self) -> Dict[str, Any]:
        """获取系统状态"""
        latest_cpu = self.collector.get_latest("system.cpu.percent")
        latest_memory = self.collector.get_latest("system.memory.percent")
        active_executions = self.adapter_monitor.get_active_executions()
        
        return {
            'timestamp': datetime.now(),
            'system': {
                'cpu_percent': latest_cpu.value if latest_cpu else 0,
                'memory_percent': latest_memory.value if latest_memory else 0,
                'active_executions': len(active_executions),
            },
            'monitoring_active': self._monitoring_active
        }
    
    def get_adapter_metrics(self, adapter_name: str, hours: int = 1) -> Dict[str, Any]:
        """获取适配器指标"""
        return self.adapter_monitor.get_adapter_statistics(adapter_name, hours)
    
    def export_metrics(self, format: str = 'json', file_path: Optional[str] = None) -> Union[str, None]:
        """导出指标数据"""
        all_metrics = {}
        
        for metric_name in self.collector.get_all_metric_names():
            history = self.collector.get_history(metric_name, 24)  # 最近24小时
            all_metrics[metric_name] = [m.to_dict() for m in history]
        
        if format.lower() == 'json':
            data = json.dumps(all_metrics, ensure_ascii=False, indent=2, default=str)
            
            if file_path:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(data)
                return None
            else:
                return data
        
        raise ValueError(f"不支持的导出格式: {format}")
    
    def cleanup(self) -> None:
        """清理资源"""
        self.stop_monitoring()
        self.collector.clear_metrics()
        
        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        gc.collect()
        logger.info("性能监控器资源清理完成")
    
    def __enter__(self):
        self.start_monitoring()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.cleanup()

# ================== 便捷函数 ==================

# 全局性能监控器实例
_global_monitor: Optional[PerformanceMonitor] = None

def get_global_monitor() -> PerformanceMonitor:
    """获取全局性能监控器实例"""
    global _global_monitor
    if _global_monitor is None:
        _global_monitor = PerformanceMonitor()
    return _global_monitor

def start_global_monitoring(**kwargs) -> None:
    """启动全局性能监控"""
    monitor = get_global_monitor()
    monitor.start_monitoring()

def stop_global_monitoring() -> None:
    """停止全局性能监控"""
    global _global_monitor
    if _global_monitor:
        _global_monitor.stop_monitoring()

def monitor_adapter_function(adapter_name: Optional[str] = None, **metadata):
    """适配器监控装饰器 - 全局版本"""
    return get_global_monitor().monitor_adapter(adapter_name, **metadata)

def time_function(metric_name: Optional[str] = None):
    """函数执行时间监控装饰器 - 全局版本"""
    return get_global_monitor().time_it(metric_name)

@contextmanager
def measure_execution_time(metric_name: str, labels: Optional[Dict[str, str]] = None):
    """测量执行时间 - 全局版本"""
    with get_global_monitor().measure_time(metric_name, labels):
        yield

@contextmanager
def measure_memory_usage(metric_name: str, labels: Optional[Dict[str, str]] = None):
    """测量内存使用 - 全局版本"""
    with get_global_monitor().measure_memory(metric_name, labels):
        yield

def get_system_health() -> Dict[str, Any]:
    """获取系统健康状态 - 全局版本"""
    return get_global_monitor().get_system_status()

def create_performance_monitor(config: Optional[Dict[str, Any]] = None) -> PerformanceMonitor:
    """创建性能监控器实例"""
    default_config = {
        'max_metrics': 10000,
        'retention_hours': 24,
        'collection_interval': 60,
        'enable_gpu_monitoring': True
    }
    
    if config:
        default_config.update(config)
    
    return PerformanceMonitor(**default_config)

def setup_performance_logging():
    """设置性能监控日志"""
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    logger.add(
        log_dir / "performance_{time}.log",
        rotation="1 day",
        retention="7 days",
        level="INFO",
        format="{time} | {level} | {name} | {message}",
        encoding="utf-8"
    )

# ================== 示例用法 ==================

if __name__ == "__main__":
    # 设置日志
    setup_performance_logging()
    
    # 创建性能监控器
    monitor = create_performance_monitor({
        'collection_interval': 30,  # 30秒收集一次
        'retention_hours': 48       # 保留48小时数据
    })
    
    # 启动监控
    print("启动性能监控...")
    monitor.start_monitoring()
    
    # 使用装饰器监控函数
    @monitor.monitor_adapter("example_adapter")
    def example_adapter_function():
        time.sleep(0.1)
        return "success"
    
    # 测试适配器
    print("测试适配器...")
    for i in range(5):
        result = example_adapter_function()
        print(f"执行 {i+1}: {result}")
        time.sleep(1)
    
    # 获取系统状态
    print("\n系统状态:")
    status = monitor.get_system_status()
    print(f"CPU使用率: {status['system']['cpu_percent']:.1f}%")
    print(f"内存使用率: {status['system']['memory_percent']:.1f}%")
    
    # 获取适配器指标
    print("\n适配器性能指标:")
    metrics = monitor.get_adapter_metrics("example_adapter")
    if metrics['execution_time']:
        print(f"平均执行时间: {metrics['execution_time']['mean']:.3f}秒")
        print(f"成功率: {metrics['success_rate']:.1f}%")
    
    # 清理资源
    print("\n清理资源...")
    monitor.cleanup()
    print("性能监控示例完成！")