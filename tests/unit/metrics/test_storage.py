# -*- coding: utf-8 -*-
"""
指标存储测试

测试新架构的指标存储功能
"""

import pytest
import asyncio
import tempfile
import os
import json
import sqlite3
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from zishu.metrics.storage.base import BaseStorage, StorageConfig
from zishu.metrics.storage.memory import MemoryStorage
from zishu.metrics.storage.file import FileStorage
from zishu.metrics.storage.sqlite import SQLiteStorage
from zishu.metrics.storage.redis import RedisStorage
from zishu.metrics.storage.influxdb import InfluxDBStorage
from zishu.metrics.storage.elasticsearch import ElasticsearchStorage
from zishu.metrics.core.types import (
    Metric, MetricType, MetricValue, MetricSample,
    TimeRange, StorageQuery, StorageResult
)
from zishu.metrics.core.exceptions import StorageException

from tests.utils.metrics_test_utils import MetricsTestUtils


class TestBaseStorage:
    """基础存储测试类"""

    @pytest.fixture
    def storage_config(self):
        """创建存储配置"""
        return StorageConfig(
            name='test_storage',
            enabled=True,
            max_size_mb=1000,
            retention_days=30,
            compression_enabled=True,
            backup_enabled=True,
            backup_interval_hours=24,
            connection_pool_size=10,
            timeout_seconds=30
        )

    @pytest.fixture
    def base_storage(self, storage_config):
        """创建基础存储实例"""
        return BaseStorage(config=storage_config)

    @pytest.fixture
    def sample_metrics(self):
        """创建示例指标"""
        base_time = datetime.now(timezone.utc) - timedelta(minutes=30)
        metrics = []
        
        for i in range(100):
            timestamp = base_time + timedelta(seconds=i * 10)
            
            # 创建不同类型的指标
            if i % 3 == 0:
                metric = Metric(
                    name='test_counter',
                    type=MetricType.COUNTER,
                    description='Test counter metric',
                    labels={'service': 'api', 'instance': f'node-{i%3}'},
                    value=MetricValue(value=i * 10, timestamp=timestamp)
                )
            elif i % 3 == 1:
                metric = Metric(
                    name='test_gauge',
                    type=MetricType.GAUGE,
                    description='Test gauge metric',
                    labels={'service': 'web', 'instance': f'node-{i%3}'},
                    value=MetricValue(value=50 + i % 50, timestamp=timestamp)
                )
            else:
                metric = Metric(
                    name='test_histogram',
                    type=MetricType.HISTOGRAM,
                    description='Test histogram metric',
                    labels={'service': 'db', 'instance': f'node-{i%3}'},
                    value=MetricValue(value=1.0 + (i % 10) * 0.1, timestamp=timestamp)
                )
            
            metrics.append(metric)
        
        return metrics

    async def test_storage_initialization(self, storage_config):
        """测试存储初始化"""
        storage = BaseStorage(config=storage_config)
        
        # 验证初始状态
        assert storage.config == storage_config
        assert not storage.is_connected
        
        # 初始化存储
        await storage.initialize()
        assert storage.is_initialized
        
        # 清理存储
        await storage.cleanup()

    async def test_storage_lifecycle(self, base_storage):
        """测试存储生命周期"""
        # 初始化
        await base_storage.initialize()
        assert base_storage.is_initialized
        
        # 连接
        await base_storage.connect()
        assert base_storage.is_connected
        
        # 断开连接
        await base_storage.disconnect()
        assert not base_storage.is_connected
        
        # 清理
        await base_storage.cleanup()

    async def test_storage_health_check(self, base_storage):
        """测试存储健康检查"""
        await base_storage.initialize()
        await base_storage.connect()
        
        # 检查健康状态
        health_status = await base_storage.health_check()
        
        assert health_status is not None
        assert 'status' in health_status
        assert 'connection_status' in health_status
        assert 'storage_usage' in health_status


class TestMemoryStorage:
    """内存存储测试类"""

    @pytest.fixture
    def memory_config(self):
        """创建内存存储配置"""
        return StorageConfig(
            name='memory_storage',
            enabled=True,
            max_size_mb=100,
            retention_days=1,
            compression_enabled=False,
            backup_enabled=False,
            connection_pool_size=1,
            timeout_seconds=5,
            custom_settings={
                'max_metrics_count': 10000,
                'eviction_policy': 'lru',
                'enable_indexing': True
            }
        )

    @pytest.fixture
    async def memory_storage(self, memory_config):
        """创建内存存储实例"""
        storage = MemoryStorage(config=memory_config)
        await storage.initialize()
        await storage.connect()
        yield storage
        await storage.disconnect()
        await storage.cleanup()

    async def test_store_metrics(self, memory_storage, sample_metrics):
        """测试存储指标"""
        # 存储指标
        result = await memory_storage.store_metrics(sample_metrics)
        
        assert result is True
        
        # 验证存储计数
        storage_info = await memory_storage.get_storage_info()
        assert storage_info['metrics_count'] == len(sample_metrics)

    async def test_query_metrics_by_name(self, memory_storage, sample_metrics):
        """测试按名称查询指标"""
        # 先存储指标
        await memory_storage.store_metrics(sample_metrics)
        
        # 查询特定名称的指标
        query = StorageQuery(
            metric_names=['test_counter'],
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            )
        )
        
        result = await memory_storage.query_metrics(query)
        
        assert isinstance(result, StorageResult)
        assert len(result.metrics) > 0
        
        # 验证所有返回的指标都是test_counter
        for metric in result.metrics:
            assert metric.name == 'test_counter'

    async def test_query_metrics_by_labels(self, memory_storage, sample_metrics):
        """测试按标签查询指标"""
        # 先存储指标
        await memory_storage.store_metrics(sample_metrics)
        
        # 查询特定标签的指标
        query = StorageQuery(
            labels_filter={'service': 'api'},
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            )
        )
        
        result = await memory_storage.query_metrics(query)
        
        assert isinstance(result, StorageResult)
        assert len(result.metrics) > 0
        
        # 验证所有返回的指标都有service=api标签
        for metric in result.metrics:
            assert metric.labels.get('service') == 'api'

    async def test_query_metrics_by_time_range(self, memory_storage, sample_metrics):
        """测试按时间范围查询指标"""
        # 先存储指标
        await memory_storage.store_metrics(sample_metrics)
        
        # 查询特定时间范围的指标
        mid_time = sample_metrics[len(sample_metrics)//2].value.timestamp
        query = StorageQuery(
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=mid_time
            )
        )
        
        result = await memory_storage.query_metrics(query)
        
        assert isinstance(result, StorageResult)
        assert len(result.metrics) > 0
        assert len(result.metrics) < len(sample_metrics)  # 应该少于全部指标
        
        # 验证所有返回的指标都在时间范围内
        for metric in result.metrics:
            assert metric.value.timestamp <= mid_time

    async def test_delete_metrics(self, memory_storage, sample_metrics):
        """测试删除指标"""
        # 先存储指标
        await memory_storage.store_metrics(sample_metrics)
        
        # 验证存储了指标
        initial_info = await memory_storage.get_storage_info()
        assert initial_info['metrics_count'] == len(sample_metrics)
        
        # 删除特定指标
        delete_query = StorageQuery(
            metric_names=['test_counter']
        )
        
        deleted_count = await memory_storage.delete_metrics(delete_query)
        assert deleted_count > 0
        
        # 验证指标已删除
        final_info = await memory_storage.get_storage_info()
        assert final_info['metrics_count'] < initial_info['metrics_count']

    async def test_memory_eviction(self, memory_storage):
        """测试内存淘汰策略"""
        # 设置较小的最大指标数量
        memory_storage.config.custom_settings['max_metrics_count'] = 50
        
        # 创建超过限制的指标
        large_metrics = []
        base_time = datetime.now(timezone.utc)
        
        for i in range(100):  # 超过50的限制
            timestamp = base_time + timedelta(seconds=i)
            metric = Metric(
                name='eviction_test',
                type=MetricType.GAUGE,
                description='Eviction test metric',
                labels={'index': str(i)},
                value=MetricValue(value=i, timestamp=timestamp)
            )
            large_metrics.append(metric)
        
        # 存储指标
        await memory_storage.store_metrics(large_metrics)
        
        # 验证淘汰策略生效
        storage_info = await memory_storage.get_storage_info()
        assert storage_info['metrics_count'] <= 50


class TestFileStorage:
    """文件存储测试类"""

    @pytest.fixture
    def file_config(self):
        """创建文件存储配置"""
        return StorageConfig(
            name='file_storage',
            enabled=True,
            max_size_mb=500,
            retention_days=7,
            compression_enabled=True,
            backup_enabled=True,
            backup_interval_hours=12,
            connection_pool_size=1,
            timeout_seconds=10,
            custom_settings={
                'storage_directory': '/tmp/metrics_storage',
                'file_format': 'json',
                'rotation_size_mb': 10,
                'enable_compression': True
            }
        )

    @pytest.fixture
    async def file_storage(self, file_config):
        """创建文件存储实例"""
        storage = FileStorage(config=file_config)
        await storage.initialize()
        await storage.connect()
        yield storage
        await storage.disconnect()
        await storage.cleanup()
        
        # 清理测试文件
        import shutil
        storage_dir = file_config.custom_settings['storage_directory']
        if os.path.exists(storage_dir):
            shutil.rmtree(storage_dir)

    async def test_store_to_file(self, file_storage, sample_metrics):
        """测试存储到文件"""
        # 存储指标
        result = await file_storage.store_metrics(sample_metrics)
        
        assert result is True
        
        # 验证文件已创建
        storage_dir = file_storage.config.custom_settings['storage_directory']
        assert os.path.exists(storage_dir)
        
        # 检查文件内容
        files = os.listdir(storage_dir)
        assert len(files) > 0

    async def test_load_from_file(self, file_storage, sample_metrics):
        """测试从文件加载"""
        # 先存储指标
        await file_storage.store_metrics(sample_metrics)
        
        # 查询指标
        query = StorageQuery(
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            )
        )
        
        result = await file_storage.query_metrics(query)
        
        assert isinstance(result, StorageResult)
        assert len(result.metrics) == len(sample_metrics)

    async def test_file_rotation(self, file_storage):
        """测试文件轮转"""
        # 设置较小的轮转大小
        file_storage.config.custom_settings['rotation_size_mb'] = 0.1  # 100KB
        
        # 创建大量指标触发轮转
        large_metrics = []
        base_time = datetime.now(timezone.utc)
        
        for i in range(1000):  # 大量指标
            timestamp = base_time + timedelta(seconds=i)
            metric = Metric(
                name='rotation_test',
                type=MetricType.GAUGE,
                description='File rotation test metric with long description to increase size',
                labels={'index': str(i), 'category': f'category_{i%10}'},
                value=MetricValue(value=i * 1.5, timestamp=timestamp)
            )
            large_metrics.append(metric)
        
        # 存储指标
        await file_storage.store_metrics(large_metrics)
        
        # 验证创建了多个文件
        storage_dir = file_storage.config.custom_settings['storage_directory']
        files = os.listdir(storage_dir)
        assert len(files) > 1  # 应该有多个文件

    async def test_file_compression(self, file_storage, sample_metrics):
        """测试文件压缩"""
        # 启用压缩
        file_storage.config.custom_settings['enable_compression'] = True
        
        # 存储指标
        await file_storage.store_metrics(sample_metrics)
        
        # 检查压缩文件
        storage_dir = file_storage.config.custom_settings['storage_directory']
        files = os.listdir(storage_dir)
        
        # 应该有压缩文件（.gz扩展名）
        compressed_files = [f for f in files if f.endswith('.gz')]
        assert len(compressed_files) > 0

    async def test_backup_creation(self, file_storage, sample_metrics):
        """测试备份创建"""
        # 启用备份
        file_storage.config.backup_enabled = True
        
        # 存储指标
        await file_storage.store_metrics(sample_metrics)
        
        # 触发备份
        backup_result = await file_storage.create_backup()
        
        assert backup_result is True
        
        # 验证备份文件存在
        storage_dir = file_storage.config.custom_settings['storage_directory']
        backup_dir = os.path.join(storage_dir, 'backups')
        
        if os.path.exists(backup_dir):
            backup_files = os.listdir(backup_dir)
            assert len(backup_files) > 0


class TestSQLiteStorage:
    """SQLite存储测试类"""

    @pytest.fixture
    def sqlite_config(self):
        """创建SQLite存储配置"""
        return StorageConfig(
            name='sqlite_storage',
            enabled=True,
            max_size_mb=1000,
            retention_days=30,
            compression_enabled=False,
            backup_enabled=True,
            backup_interval_hours=24,
            connection_pool_size=5,
            timeout_seconds=30,
            custom_settings={
                'database_path': '/tmp/metrics.db',
                'wal_mode': True,
                'cache_size': 10000,
                'synchronous': 'NORMAL'
            }
        )

    @pytest.fixture
    async def sqlite_storage(self, sqlite_config):
        """创建SQLite存储实例"""
        storage = SQLiteStorage(config=sqlite_config)
        await storage.initialize()
        await storage.connect()
        yield storage
        await storage.disconnect()
        await storage.cleanup()
        
        # 清理测试数据库
        db_path = sqlite_config.custom_settings['database_path']
        if os.path.exists(db_path):
            os.unlink(db_path)

    async def test_create_tables(self, sqlite_storage):
        """测试创建表"""
        # 验证表已创建
        tables = await sqlite_storage.get_table_list()
        
        expected_tables = ['metrics', 'metric_labels', 'metric_values']
        for table in expected_tables:
            assert table in tables

    async def test_store_to_sqlite(self, sqlite_storage, sample_metrics):
        """测试存储到SQLite"""
        # 存储指标
        result = await sqlite_storage.store_metrics(sample_metrics)
        
        assert result is True
        
        # 验证数据已存储
        count = await sqlite_storage.get_metrics_count()
        assert count == len(sample_metrics)

    async def test_query_from_sqlite(self, sqlite_storage, sample_metrics):
        """测试从SQLite查询"""
        # 先存储指标
        await sqlite_storage.store_metrics(sample_metrics)
        
        # 查询指标
        query = StorageQuery(
            metric_names=['test_counter'],
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            )
        )
        
        result = await sqlite_storage.query_metrics(query)
        
        assert isinstance(result, StorageResult)
        assert len(result.metrics) > 0
        
        # 验证查询结果
        for metric in result.metrics:
            assert metric.name == 'test_counter'

    async def test_sqlite_indexing(self, sqlite_storage, sample_metrics):
        """测试SQLite索引"""
        # 存储指标
        await sqlite_storage.store_metrics(sample_metrics)
        
        # 创建索引
        await sqlite_storage.create_indexes()
        
        # 验证索引存在
        indexes = await sqlite_storage.get_index_list()
        
        expected_indexes = ['idx_metrics_name', 'idx_metrics_timestamp', 'idx_labels_metric_id']
        for index in expected_indexes:
            assert index in indexes

    async def test_sqlite_aggregation(self, sqlite_storage, sample_metrics):
        """测试SQLite聚合查询"""
        # 存储指标
        await sqlite_storage.store_metrics(sample_metrics)
        
        # 执行聚合查询
        aggregation_result = await sqlite_storage.aggregate_metrics(
            metric_name='test_gauge',
            aggregation_type='AVG',
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            ),
            group_by_labels=['service']
        )
        
        assert aggregation_result is not None
        assert len(aggregation_result) > 0

    async def test_sqlite_cleanup(self, sqlite_storage, sample_metrics):
        """测试SQLite清理"""
        # 存储指标
        await sqlite_storage.store_metrics(sample_metrics)
        
        # 验证数据存在
        initial_count = await sqlite_storage.get_metrics_count()
        assert initial_count == len(sample_metrics)
        
        # 执行清理（删除旧数据）
        cutoff_time = datetime.now(timezone.utc) - timedelta(days=1)
        cleaned_count = await sqlite_storage.cleanup_old_data(cutoff_time)
        
        # 验证清理结果
        final_count = await sqlite_storage.get_metrics_count()
        assert final_count <= initial_count


class TestRedisStorage:
    """Redis存储测试类"""

    @pytest.fixture
    def redis_config(self):
        """创建Redis存储配置"""
        return StorageConfig(
            name='redis_storage',
            enabled=True,
            max_size_mb=2000,
            retention_days=7,
            compression_enabled=True,
            backup_enabled=False,
            connection_pool_size=10,
            timeout_seconds=5,
            custom_settings={
                'host': 'localhost',
                'port': 6379,
                'db': 0,
                'password': None,
                'key_prefix': 'metrics:',
                'ttl_seconds': 604800  # 7天
            }
        )

    @pytest.fixture
    async def redis_storage(self, redis_config):
        """创建Redis存储实例"""
        storage = RedisStorage(config=redis_config)
        
        # 使用Mock Redis客户端进行测试
        with patch('redis.asyncio.Redis') as mock_redis_class:
            mock_redis = Mock()
            mock_redis.ping = AsyncMock(return_value=True)
            mock_redis.set = AsyncMock(return_value=True)
            mock_redis.get = AsyncMock(return_value=None)
            mock_redis.delete = AsyncMock(return_value=1)
            mock_redis.keys = AsyncMock(return_value=[])
            mock_redis.mget = AsyncMock(return_value=[])
            mock_redis.pipeline = Mock()
            mock_redis_class.return_value = mock_redis
            
            await storage.initialize()
            await storage.connect()
            
            # 设置mock客户端
            storage._redis_client = mock_redis
            
            yield storage
            
            await storage.disconnect()
            await storage.cleanup()

    async def test_store_to_redis(self, redis_storage, sample_metrics):
        """测试存储到Redis"""
        # 存储指标
        result = await redis_storage.store_metrics(sample_metrics)
        
        assert result is True
        
        # 验证Redis set方法被调用
        redis_storage._redis_client.set.assert_called()

    async def test_query_from_redis(self, redis_storage, sample_metrics):
        """测试从Redis查询"""
        # Mock Redis返回数据
        mock_data = []
        for metric in sample_metrics[:5]:  # 只返回前5个
            serialized = json.dumps({
                'name': metric.name,
                'type': metric.type.value,
                'value': metric.value.value,
                'timestamp': metric.value.timestamp.isoformat(),
                'labels': metric.labels
            })
            mock_data.append(serialized.encode())
        
        redis_storage._redis_client.mget.return_value = mock_data
        redis_storage._redis_client.keys.return_value = [f'metrics:key_{i}' for i in range(5)]
        
        # 查询指标
        query = StorageQuery(
            metric_names=['test_counter'],
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            )
        )
        
        result = await redis_storage.query_metrics(query)
        
        assert isinstance(result, StorageResult)
        assert len(result.metrics) > 0

    async def test_redis_expiration(self, redis_storage, sample_metrics):
        """测试Redis过期设置"""
        # 存储指标
        await redis_storage.store_metrics(sample_metrics)
        
        # 验证设置了TTL
        set_calls = redis_storage._redis_client.set.call_args_list
        for call in set_calls:
            # 检查是否设置了ex参数（过期时间）
            if 'ex' in call.kwargs:
                assert call.kwargs['ex'] == redis_storage.config.custom_settings['ttl_seconds']

    async def test_redis_pipeline(self, redis_storage, sample_metrics):
        """测试Redis管道操作"""
        # Mock管道
        mock_pipeline = Mock()
        mock_pipeline.set = Mock()
        mock_pipeline.execute = AsyncMock(return_value=[True] * len(sample_metrics))
        redis_storage._redis_client.pipeline.return_value = mock_pipeline
        
        # 使用管道存储大量指标
        result = await redis_storage.store_metrics_batch(sample_metrics)
        
        assert result is True
        redis_storage._redis_client.pipeline.assert_called()
        mock_pipeline.execute.assert_called()


class TestInfluxDBStorage:
    """InfluxDB存储测试类"""

    @pytest.fixture
    def influxdb_config(self):
        """创建InfluxDB存储配置"""
        return StorageConfig(
            name='influxdb_storage',
            enabled=True,
            max_size_mb=5000,
            retention_days=90,
            compression_enabled=True,
            backup_enabled=True,
            backup_interval_hours=12,
            connection_pool_size=5,
            timeout_seconds=30,
            custom_settings={
                'host': 'localhost',
                'port': 8086,
                'database': 'metrics',
                'username': 'admin',
                'password': 'password',
                'retention_policy': 'autogen',
                'precision': 'ms'
            }
        )

    @pytest.fixture
    async def influxdb_storage(self, influxdb_config):
        """创建InfluxDB存储实例"""
        storage = InfluxDBStorage(config=influxdb_config)
        
        # 使用Mock InfluxDB客户端
        with patch('influxdb.InfluxDBClient') as mock_client_class:
            mock_client = Mock()
            mock_client.ping.return_value = True
            mock_client.write_points.return_value = True
            mock_client.query.return_value = Mock()
            mock_client.create_database.return_value = True
            mock_client_class.return_value = mock_client
            
            await storage.initialize()
            await storage.connect()
            
            # 设置mock客户端
            storage._influx_client = mock_client
            
            yield storage
            
            await storage.disconnect()
            await storage.cleanup()

    async def test_store_to_influxdb(self, influxdb_storage, sample_metrics):
        """测试存储到InfluxDB"""
        # 存储指标
        result = await influxdb_storage.store_metrics(sample_metrics)
        
        assert result is True
        
        # 验证write_points被调用
        influxdb_storage._influx_client.write_points.assert_called()

    async def test_query_from_influxdb(self, influxdb_storage, sample_metrics):
        """测试从InfluxDB查询"""
        # Mock查询结果
        mock_result = Mock()
        mock_result.get_points.return_value = [
            {
                'time': sample_metrics[0].value.timestamp.isoformat(),
                'name': sample_metrics[0].name,
                'value': sample_metrics[0].value.value,
                'service': sample_metrics[0].labels.get('service', ''),
                'instance': sample_metrics[0].labels.get('instance', '')
            }
        ]
        influxdb_storage._influx_client.query.return_value = mock_result
        
        # 查询指标
        query = StorageQuery(
            metric_names=['test_counter'],
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            )
        )
        
        result = await influxdb_storage.query_metrics(query)
        
        assert isinstance(result, StorageResult)
        influxdb_storage._influx_client.query.assert_called()

    async def test_influxdb_retention_policy(self, influxdb_storage):
        """测试InfluxDB保留策略"""
        # 创建保留策略
        result = await influxdb_storage.create_retention_policy(
            name='test_policy',
            duration='30d',
            replication=1,
            default=False
        )
        
        assert result is True

    async def test_influxdb_continuous_query(self, influxdb_storage):
        """测试InfluxDB连续查询"""
        # 创建连续查询
        cq_query = '''
        CREATE CONTINUOUS QUERY "avg_cpu_1h" ON "metrics"
        BEGIN
          SELECT mean("value") AS "mean_value"
          INTO "metrics"."autogen"."avg_cpu_1h"
          FROM "metrics"."autogen"."cpu_usage"
          GROUP BY time(1h), *
        END
        '''
        
        result = await influxdb_storage.create_continuous_query(cq_query)
        
        assert result is True
        influxdb_storage._influx_client.query.assert_called()


class TestElasticsearchStorage:
    """Elasticsearch存储测试类"""

    @pytest.fixture
    def elasticsearch_config(self):
        """创建Elasticsearch存储配置"""
        return StorageConfig(
            name='elasticsearch_storage',
            enabled=True,
            max_size_mb=10000,
            retention_days=365,
            compression_enabled=True,
            backup_enabled=True,
            backup_interval_hours=6,
            connection_pool_size=10,
            timeout_seconds=60,
            custom_settings={
                'hosts': ['localhost:9200'],
                'username': 'elastic',
                'password': 'password',
                'index_pattern': 'metrics-{date}',
                'doc_type': '_doc',
                'refresh': 'wait_for'
            }
        )

    @pytest.fixture
    async def elasticsearch_storage(self, elasticsearch_config):
        """创建Elasticsearch存储实例"""
        storage = ElasticsearchStorage(config=elasticsearch_config)
        
        # 使用Mock Elasticsearch客户端
        with patch('elasticsearch.AsyncElasticsearch') as mock_es_class:
            mock_es = Mock()
            mock_es.ping = AsyncMock(return_value=True)
            mock_es.index = AsyncMock(return_value={'result': 'created'})
            mock_es.bulk = AsyncMock(return_value={'errors': False})
            mock_es.search = AsyncMock(return_value={'hits': {'hits': []}})
            mock_es.indices = Mock()
            mock_es.indices.create = AsyncMock(return_value={'acknowledged': True})
            mock_es.indices.exists = AsyncMock(return_value=False)
            mock_es_class.return_value = mock_es
            
            await storage.initialize()
            await storage.connect()
            
            # 设置mock客户端
            storage._es_client = mock_es
            
            yield storage
            
            await storage.disconnect()
            await storage.cleanup()

    async def test_store_to_elasticsearch(self, elasticsearch_storage, sample_metrics):
        """测试存储到Elasticsearch"""
        # 存储指标
        result = await elasticsearch_storage.store_metrics(sample_metrics)
        
        assert result is True
        
        # 验证bulk操作被调用
        elasticsearch_storage._es_client.bulk.assert_called()

    async def test_query_from_elasticsearch(self, elasticsearch_storage, sample_metrics):
        """测试从Elasticsearch查询"""
        # Mock搜索结果
        mock_hits = []
        for metric in sample_metrics[:3]:
            hit = {
                '_source': {
                    'metric_name': metric.name,
                    'metric_type': metric.type.value,
                    'value': metric.value.value,
                    'timestamp': metric.value.timestamp.isoformat(),
                    'labels': metric.labels
                }
            }
            mock_hits.append(hit)
        
        elasticsearch_storage._es_client.search.return_value = {
            'hits': {
                'hits': mock_hits,
                'total': {'value': len(mock_hits)}
            }
        }
        
        # 查询指标
        query = StorageQuery(
            metric_names=['test_counter'],
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            )
        )
        
        result = await elasticsearch_storage.query_metrics(query)
        
        assert isinstance(result, StorageResult)
        assert len(result.metrics) > 0
        elasticsearch_storage._es_client.search.assert_called()

    async def test_elasticsearch_index_management(self, elasticsearch_storage):
        """测试Elasticsearch索引管理"""
        # 创建索引
        index_name = 'metrics-2023-12-01'
        result = await elasticsearch_storage.create_index(index_name)
        
        assert result is True
        elasticsearch_storage._es_client.indices.create.assert_called()

    async def test_elasticsearch_mapping(self, elasticsearch_storage):
        """测试Elasticsearch映射"""
        # 获取映射模板
        mapping = await elasticsearch_storage.get_index_mapping()
        
        assert mapping is not None
        assert 'mappings' in mapping
        
        # 验证关键字段映射
        properties = mapping['mappings']['properties']
        assert 'metric_name' in properties
        assert 'timestamp' in properties
        assert 'value' in properties
        assert 'labels' in properties


class TestStorageIntegration:
    """存储集成测试类"""

    @pytest.fixture
    async def all_storages(self):
        """创建所有类型的存储"""
        storages = {}
        
        # 内存存储
        memory_config = StorageConfig(name='memory', enabled=True, max_size_mb=100)
        storages['memory'] = MemoryStorage(config=memory_config)
        
        # 文件存储
        file_config = StorageConfig(
            name='file', 
            enabled=True, 
            max_size_mb=200,
            custom_settings={'storage_directory': '/tmp/test_metrics'}
        )
        storages['file'] = FileStorage(config=file_config)
        
        # SQLite存储
        sqlite_config = StorageConfig(
            name='sqlite',
            enabled=True,
            max_size_mb=300,
            custom_settings={'database_path': '/tmp/test_metrics.db'}
        )
        storages['sqlite'] = SQLiteStorage(config=sqlite_config)
        
        # 初始化所有存储
        for storage in storages.values():
            await storage.initialize()
            await storage.connect()
        
        yield storages
        
        # 清理所有存储
        for storage in storages.values():
            await storage.disconnect()
            await storage.cleanup()
        
        # 清理测试文件
        import shutil
        for path in ['/tmp/test_metrics', '/tmp/test_metrics.db']:
            if os.path.exists(path):
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.unlink(path)

    async def test_multi_storage_consistency(self, all_storages, sample_metrics):
        """测试多存储一致性"""
        # 在所有存储中存储相同的指标
        for storage_name, storage in all_storages.items():
            result = await storage.store_metrics(sample_metrics)
            assert result is True, f"Failed to store in {storage_name}"
        
        # 从所有存储查询相同的指标
        query = StorageQuery(
            metric_names=['test_counter'],
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            )
        )
        
        results = {}
        for storage_name, storage in all_storages.items():
            result = await storage.query_metrics(query)
            results[storage_name] = result
            assert isinstance(result, StorageResult)
        
        # 验证所有存储返回的指标数量一致
        metric_counts = {name: len(result.metrics) for name, result in results.items()}
        assert len(set(metric_counts.values())) <= 1, f"Inconsistent metric counts: {metric_counts}"

    async def test_storage_failover(self, all_storages, sample_metrics):
        """测试存储故障转移"""
        primary_storage = all_storages['memory']
        backup_storage = all_storages['file']
        
        # 模拟主存储故障
        with patch.object(primary_storage, 'store_metrics', side_effect=Exception('Storage failed')):
            # 尝试使用主存储
            try:
                await primary_storage.store_metrics(sample_metrics)
                assert False, "Should have raised exception"
            except Exception:
                pass
            
            # 使用备用存储
            result = await backup_storage.store_metrics(sample_metrics)
            assert result is True

    async def test_storage_performance(self, all_storages):
        """测试存储性能"""
        import time
        
        # 创建大量指标数据
        large_metrics = []
        base_time = datetime.now(timezone.utc) - timedelta(hours=1)
        
        for i in range(1000):  # 1000个指标
            timestamp = base_time + timedelta(seconds=i * 3.6)
            metric = Metric(
                name='performance_test',
                type=MetricType.GAUGE,
                description='Performance test metric',
                labels={'index': str(i), 'batch': str(i // 100)},
                value=MetricValue(value=i * 1.5, timestamp=timestamp)
            )
            large_metrics.append(metric)
        
        # 测试每个存储的性能
        for storage_name, storage in all_storages.items():
            start_time = time.time()
            
            result = await storage.store_metrics(large_metrics)
            
            end_time = time.time()
            storage_time = end_time - start_time
            
            # 验证性能满足要求
            assert storage_time < 30.0  # 存储时间应小于30秒
            assert result is True
            
            throughput = len(large_metrics) / storage_time
            print(f"{storage_name} storage: {len(large_metrics)} metrics in {storage_time:.2f}s ({throughput:.0f} metrics/s)")

    async def test_storage_data_integrity(self, all_storages, sample_metrics):
        """测试存储数据完整性"""
        # 在所有存储中存储指标
        for storage in all_storages.values():
            await storage.store_metrics(sample_metrics)
        
        # 从所有存储查询并验证数据完整性
        query = StorageQuery(
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            )
        )
        
        for storage_name, storage in all_storages.items():
            result = await storage.query_metrics(query)
            
            # 验证数据完整性
            assert len(result.metrics) > 0, f"No metrics returned from {storage_name}"
            
            # 验证指标值的准确性
            for metric in result.metrics:
                assert metric.name is not None
                assert metric.value is not None
                assert metric.value.value is not None
                assert metric.value.timestamp is not None

    async def test_concurrent_storage_operations(self, all_storages, sample_metrics):
        """测试并发存储操作"""
        # 并发存储到所有存储
        store_tasks = []
        for storage in all_storages.values():
            task = asyncio.create_task(storage.store_metrics(sample_metrics))
            store_tasks.append(task)
        
        # 等待所有存储完成
        results = await asyncio.gather(*store_tasks, return_exceptions=True)
        
        # 验证所有存储操作成功
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                pytest.fail(f"Storage operation {i} failed: {result}")
            assert result is True
        
        # 并发查询所有存储
        query = StorageQuery(
            metric_names=['test_gauge'],
            time_range=TimeRange(
                start=sample_metrics[0].value.timestamp,
                end=sample_metrics[-1].value.timestamp
            )
        )
        
        query_tasks = []
        for storage in all_storages.values():
            task = asyncio.create_task(storage.query_metrics(query))
            query_tasks.append(task)
        
        # 等待所有查询完成
        query_results = await asyncio.gather(*query_tasks, return_exceptions=True)
        
        # 验证所有查询操作成功
        for i, result in enumerate(query_results):
            if isinstance(result, Exception):
                pytest.fail(f"Query operation {i} failed: {result}")
            assert isinstance(result, StorageResult)
