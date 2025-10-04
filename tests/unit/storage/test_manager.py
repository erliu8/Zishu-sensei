# -*- coding: utf-8 -*-
"""
存储管理器测试

测试存储系统的核心管理功能
"""

import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

from zishu.storage.manager import StorageManager, StorageManagerConfig
from zishu.storage.factory import StorageFactory
from zishu.storage.backends.base import BaseStorageBackend, StorageConfig
from zishu.storage.backends.memory import MemoryStorageBackend, MemoryStorageConfig
from zishu.storage.backends.file import FileStorageBackend, FileStorageConfig
from zishu.storage.backends.sqlite import SQLiteStorageBackend, SQLiteStorageConfig
from zishu.storage.core.types import (
    StorageKey, StorageValue, StorageQuery, StorageResult,
    StorageTransaction, StorageIndex, StorageSchema,
    StorageBackendType, CompressionType, EncryptionType,
    ConsistencyLevel, ReplicationMode, ShardingStrategy
)
from zishu.storage.core.exceptions import (
    StorageException, ManagerException, ConfigurationException,
    BackendException, TransactionException, ReplicationException,
    ShardingException, LoadBalancingException
)
from zishu.storage.replication import ReplicationManager, ReplicationConfig
from zishu.storage.sharding import ShardingManager, ShardingConfig
from zishu.storage.load_balancer import LoadBalancer, LoadBalancingConfig
from zishu.storage.migration import MigrationManager, MigrationConfig

from tests.utils.storage_test_utils import StorageTestUtils


class TestStorageManagerConfig:
    """存储管理器配置测试类"""

    def test_config_initialization(self):
        """测试配置初始化"""
        config = StorageManagerConfig(
            name='test_manager',
            enabled=True,
            default_backend='memory',
            enable_replication=True,
            enable_sharding=False,
            enable_load_balancing=True,
            enable_caching=True,
            cache_size_mb=100,
            enable_compression=True,
            enable_encryption=False,
            consistency_level=ConsistencyLevel.EVENTUAL,
            transaction_timeout=30,
            connection_pool_size=10,
            health_check_interval=60,
            metrics_enabled=True
        )
        
        assert config.name == 'test_manager'
        assert config.enabled is True
        assert config.default_backend == 'memory'
        assert config.enable_replication is True
        assert config.enable_sharding is False
        assert config.enable_load_balancing is True
        assert config.consistency_level == ConsistencyLevel.EVENTUAL

    def test_config_validation(self):
        """测试配置验证"""
        # 有效配置
        valid_config = StorageManagerConfig(
            name='valid_manager',
            default_backend='memory'
        )
        
        assert valid_config.validate() is True
        
        # 无效配置 - 空名称
        invalid_config = StorageManagerConfig(
            name='',
            default_backend='memory'
        )
        
        assert invalid_config.validate() is False

    def test_config_serialization(self):
        """测试配置序列化"""
        config = StorageManagerConfig(
            name='test_manager',
            default_backend='memory',
            enable_replication=True
        )
        
        # 序列化
        config_dict = config.to_dict()
        assert isinstance(config_dict, dict)
        assert config_dict['name'] == 'test_manager'
        assert config_dict['default_backend'] == 'memory'
        
        # 反序列化
        restored_config = StorageManagerConfig.from_dict(config_dict)
        assert restored_config.name == config.name
        assert restored_config.default_backend == config.default_backend
        assert restored_config.enable_replication == config.enable_replication


class TestStorageManager:
    """存储管理器测试类"""

    @pytest.fixture
    def manager_config(self):
        """创建存储管理器配置"""
        return StorageManagerConfig(
            name='test_storage_manager',
            enabled=True,
            default_backend='memory',
            enable_replication=False,
            enable_sharding=False,
            enable_load_balancing=False,
            enable_caching=True,
            cache_size_mb=50,
            consistency_level=ConsistencyLevel.STRONG,
            transaction_timeout=30,
            health_check_interval=60,
            metrics_enabled=True
        )

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    @pytest.fixture
    async def storage_manager(self, manager_config):
        """创建存储管理器实例"""
        manager = StorageManager(config=manager_config)
        await manager.initialize()
        yield manager
        await manager.shutdown()

    async def test_manager_initialization(self, manager_config):
        """测试管理器初始化"""
        manager = StorageManager(config=manager_config)
        
        assert manager.config == manager_config
        assert not manager.is_initialized
        
        await manager.initialize()
        assert manager.is_initialized
        
        await manager.shutdown()
        assert not manager.is_initialized

    async def test_backend_registration(self, storage_manager):
        """测试后端注册"""
        # 注册内存后端
        memory_config = MemoryStorageConfig(
            name='test_memory',
            max_memory_mb=100
        )
        
        backend_id = await storage_manager.register_backend('memory', memory_config)
        assert backend_id is not None
        
        # 验证后端已注册
        backends = storage_manager.list_backends()
        assert backend_id in backends
        
        # 获取后端信息
        backend_info = storage_manager.get_backend_info(backend_id)
        assert backend_info is not None
        assert backend_info['type'] == 'memory'
        assert backend_info['config']['name'] == 'test_memory'

    async def test_backend_unregistration(self, storage_manager):
        """测试后端注销"""
        # 注册后端
        memory_config = MemoryStorageConfig(name='test_memory')
        backend_id = await storage_manager.register_backend('memory', memory_config)
        
        # 验证后端存在
        assert backend_id in storage_manager.list_backends()
        
        # 注销后端
        result = await storage_manager.unregister_backend(backend_id)
        assert result is True
        
        # 验证后端已移除
        assert backend_id not in storage_manager.list_backends()

    async def test_default_backend_operations(self, storage_manager):
        """测试默认后端操作"""
        # 注册默认后端
        memory_config = MemoryStorageConfig(name='default_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 使用默认后端进行操作
        key = StorageKey(key='test_key', namespace='test')
        value = StorageValue(data={'message': 'hello world'})
        
        # 设置值
        result = await storage_manager.set(key, value)
        assert result is True
        
        # 获取值
        retrieved_value = await storage_manager.get(key)
        assert retrieved_value is not None
        assert retrieved_value.data == value.data
        
        # 检查存在
        exists = await storage_manager.exists(key)
        assert exists is True
        
        # 删除值
        result = await storage_manager.delete(key)
        assert result is True
        
        # 验证删除
        exists = await storage_manager.exists(key)
        assert exists is False

    async def test_multiple_backend_operations(self, storage_manager, temp_dir):
        """测试多后端操作"""
        # 注册多个后端
        memory_config = MemoryStorageConfig(name='memory_backend')
        file_config = FileStorageConfig(name='file_backend', storage_path=temp_dir)
        
        memory_id = await storage_manager.register_backend('memory', memory_config)
        file_id = await storage_manager.register_backend('file', file_config)
        
        # 在不同后端存储数据
        key1 = StorageKey(key='memory_key', namespace='test')
        key2 = StorageKey(key='file_key', namespace='test')
        value1 = StorageValue(data={'backend': 'memory'})
        value2 = StorageValue(data={'backend': 'file'})
        
        # 指定后端存储
        await storage_manager.set(key1, value1, backend_id=memory_id)
        await storage_manager.set(key2, value2, backend_id=file_id)
        
        # 从指定后端获取
        retrieved1 = await storage_manager.get(key1, backend_id=memory_id)
        retrieved2 = await storage_manager.get(key2, backend_id=file_id)
        
        assert retrieved1.data['backend'] == 'memory'
        assert retrieved2.data['backend'] == 'file'

    async def test_batch_operations(self, storage_manager):
        """测试批量操作"""
        # 注册后端
        memory_config = MemoryStorageConfig(name='batch_memory')
        backend_id = await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 准备批量数据
        keys_values = []
        for i in range(10):
            key = StorageKey(key=f'batch_key_{i}', namespace='batch')
            value = StorageValue(data={'index': i, 'value': f'data_{i}'})
            keys_values.append((key, value))
        
        keys = [kv[0] for kv in keys_values]
        values = [kv[1] for kv in keys_values]
        
        # 批量设置
        result = await storage_manager.batch_set(keys, values)
        assert result is True
        
        # 批量获取
        retrieved_values = await storage_manager.batch_get(keys)
        assert len(retrieved_values) == 10
        
        for i, value in enumerate(retrieved_values):
            assert value is not None
            assert value.data['index'] == i
        
        # 批量删除
        result = await storage_manager.batch_delete(keys[:5])
        assert result is True
        
        # 验证部分删除
        retrieved_values = await storage_manager.batch_get(keys)
        non_null_values = [v for v in retrieved_values if v is not None]
        assert len(non_null_values) == 5

    async def test_transaction_management(self, storage_manager):
        """测试事务管理"""
        # 注册支持事务的后端
        memory_config = MemoryStorageConfig(name='tx_memory')
        backend_id = await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        key1 = StorageKey(key='tx_key_1', namespace='test')
        key2 = StorageKey(key='tx_key_2', namespace='test')
        value1 = StorageValue(data={'tx': 1})
        value2 = StorageValue(data={'tx': 2})
        
        # 开始事务
        tx = await storage_manager.begin_transaction()
        assert tx is not None
        
        try:
            # 在事务中执行操作
            await storage_manager.set(key1, value1, transaction=tx)
            await storage_manager.set(key2, value2, transaction=tx)
            
            # 提交事务
            await storage_manager.commit_transaction(tx)
            
            # 验证数据已提交
            retrieved1 = await storage_manager.get(key1)
            retrieved2 = await storage_manager.get(key2)
            
            assert retrieved1.data['tx'] == 1
            assert retrieved2.data['tx'] == 2
            
        except Exception:
            await storage_manager.rollback_transaction(tx)
            raise

    async def test_transaction_rollback(self, storage_manager):
        """测试事务回滚"""
        # 注册后端
        memory_config = MemoryStorageConfig(name='rollback_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        key = StorageKey(key='rollback_key', namespace='test')
        value = StorageValue(data={'rollback': True})
        
        # 开始事务
        tx = await storage_manager.begin_transaction()
        
        try:
            # 在事务中设置值
            await storage_manager.set(key, value, transaction=tx)
            
            # 回滚事务
            await storage_manager.rollback_transaction(tx)
            
            # 验证数据未提交
            exists = await storage_manager.exists(key)
            assert exists is False
            
        except Exception:
            await storage_manager.rollback_transaction(tx)
            raise

    async def test_query_operations(self, storage_manager):
        """测试查询操作"""
        # 注册支持查询的后端
        memory_config = MemoryStorageConfig(name='query_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 添加可查询的数据
        for i in range(20):
            key = StorageKey(key=f'query_key_{i}', namespace='query')
            value = StorageValue(data={
                'index': i,
                'category': f'cat_{i % 5}',
                'active': i % 2 == 0
            })
            await storage_manager.set(key, value)
        
        # 执行查询
        query = StorageQuery(
            namespace='query',
            filters={'data.category': 'cat_1'},
            limit=10
        )
        
        result = await storage_manager.query(query)
        assert isinstance(result, StorageResult)
        assert len(result.items) > 0
        
        # 验证查询结果
        for item in result.items:
            assert item.value.data['category'] == 'cat_1'

    async def test_indexing_operations(self, storage_manager):
        """测试索引操作"""
        # 注册支持索引的后端
        memory_config = MemoryStorageConfig(name='index_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 创建索引
        index = StorageIndex(
            name='category_index',
            fields=['data.category'],
            unique=False
        )
        
        result = await storage_manager.create_index(index)
        assert result is True
        
        # 列出索引
        indexes = await storage_manager.list_indexes()
        assert 'category_index' in [idx.name for idx in indexes]
        
        # 删除索引
        result = await storage_manager.drop_index('category_index')
        assert result is True
        
        # 验证索引已删除
        indexes = await storage_manager.list_indexes()
        assert 'category_index' not in [idx.name for idx in indexes]

    async def test_caching_functionality(self, storage_manager):
        """测试缓存功能"""
        # 注册后端
        memory_config = MemoryStorageConfig(name='cache_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        key = StorageKey(key='cache_key', namespace='test')
        value = StorageValue(data={'cached': True})
        
        # 设置值（应该被缓存）
        await storage_manager.set(key, value)
        
        # 多次获取（应该从缓存返回）
        for _ in range(5):
            retrieved = await storage_manager.get(key)
            assert retrieved.data['cached'] is True
        
        # 获取缓存统计
        cache_stats = storage_manager.get_cache_stats()
        assert cache_stats is not None
        assert 'hit_count' in cache_stats
        assert 'miss_count' in cache_stats
        assert cache_stats['hit_count'] > 0

    async def test_health_monitoring(self, storage_manager):
        """测试健康监控"""
        # 注册后端
        memory_config = MemoryStorageConfig(name='health_memory')
        backend_id = await storage_manager.register_backend('memory', memory_config)
        
        # 检查管理器健康状态
        health = await storage_manager.health_check()
        assert health is not None
        assert 'status' in health
        assert 'backends' in health
        assert health['status'] in ['healthy', 'unhealthy', 'degraded']
        
        # 检查特定后端健康状态
        backend_health = await storage_manager.check_backend_health(backend_id)
        assert backend_health is not None
        assert 'status' in backend_health

    async def test_metrics_collection(self, storage_manager):
        """测试指标收集"""
        # 注册后端
        memory_config = MemoryStorageConfig(name='metrics_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 执行一些操作以生成指标
        for i in range(10):
            key = StorageKey(key=f'metrics_key_{i}', namespace='metrics')
            value = StorageValue(data={'index': i})
            await storage_manager.set(key, value)
            await storage_manager.get(key)
        
        # 获取指标
        metrics = storage_manager.get_metrics()
        assert metrics is not None
        assert isinstance(metrics, dict)
        
        # 验证基本指标存在
        expected_metrics = [
            'operations_total',
            'operation_duration_seconds',
            'backend_count',
            'cache_hit_ratio'
        ]
        
        for metric in expected_metrics:
            assert any(metric in key for key in metrics.keys())

    async def test_backup_operations(self, storage_manager, temp_dir):
        """测试备份操作"""
        # 注册支持备份的后端
        file_config = FileStorageConfig(name='backup_file', storage_path=temp_dir)
        await storage_manager.register_backend('file', file_config, is_default=True)
        
        # 添加测试数据
        for i in range(5):
            key = StorageKey(key=f'backup_key_{i}', namespace='backup')
            value = StorageValue(data={'index': i})
            await storage_manager.set(key, value)
        
        # 创建备份
        backup_path = await storage_manager.create_backup()
        assert backup_path is not None
        assert Path(backup_path).exists()
        
        # 清空数据
        await storage_manager.clear()
        
        # 从备份恢复
        result = await storage_manager.restore_from_backup(backup_path)
        assert result is True
        
        # 验证数据恢复
        for i in range(5):
            key = StorageKey(key=f'backup_key_{i}', namespace='backup')
            retrieved = await storage_manager.get(key)
            assert retrieved is not None
            assert retrieved.data['index'] == i

    async def test_namespace_management(self, storage_manager):
        """测试命名空间管理"""
        # 注册后端
        memory_config = MemoryStorageConfig(name='namespace_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 在不同命名空间添加数据
        namespaces = ['ns1', 'ns2', 'ns3']
        for ns in namespaces:
            for i in range(3):
                key = StorageKey(key=f'key_{i}', namespace=ns)
                value = StorageValue(data={'namespace': ns, 'index': i})
                await storage_manager.set(key, value)
        
        # 列出命名空间
        listed_namespaces = await storage_manager.list_namespaces()
        for ns in namespaces:
            assert ns in listed_namespaces
        
        # 获取命名空间统计
        for ns in namespaces:
            stats = await storage_manager.get_namespace_stats(ns)
            assert stats is not None
            assert stats['key_count'] == 3
        
        # 清空特定命名空间
        result = await storage_manager.clear_namespace('ns1')
        assert result is True
        
        # 验证命名空间已清空
        stats = await storage_manager.get_namespace_stats('ns1')
        assert stats['key_count'] == 0

    async def test_configuration_management(self, storage_manager):
        """测试配置管理"""
        # 获取当前配置
        current_config = storage_manager.get_config()
        assert current_config is not None
        assert current_config.name == 'test_storage_manager'
        
        # 更新配置
        new_config = StorageManagerConfig(
            name='updated_manager',
            cache_size_mb=200,
            health_check_interval=120
        )
        
        result = await storage_manager.update_config(new_config)
        assert result is True
        
        # 验证配置已更新
        updated_config = storage_manager.get_config()
        assert updated_config.cache_size_mb == 200
        assert updated_config.health_check_interval == 120

    async def test_error_handling(self, storage_manager):
        """测试错误处理"""
        # 测试访问不存在的后端
        with pytest.raises(BackendException):
            await storage_manager.get(
                StorageKey(key='test', namespace='test'),
                backend_id='nonexistent'
            )
        
        # 测试无效的事务操作
        with pytest.raises(TransactionException):
            fake_tx = Mock()
            await storage_manager.commit_transaction(fake_tx)

    async def test_concurrent_operations(self, storage_manager):
        """测试并发操作"""
        # 注册后端
        memory_config = MemoryStorageConfig(name='concurrent_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 并发写入操作
        async def write_data(index):
            key = StorageKey(key=f'concurrent_key_{index}', namespace='concurrent')
            value = StorageValue(data={'index': index})
            await storage_manager.set(key, value)
            return index
        
        # 执行并发操作
        tasks = [write_data(i) for i in range(20)]
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 20
        assert sorted(results) == list(range(20))
        
        # 验证所有数据都已写入
        for i in range(20):
            key = StorageKey(key=f'concurrent_key_{i}', namespace='concurrent')
            retrieved = await storage_manager.get(key)
            assert retrieved is not None
            assert retrieved.data['index'] == i

    async def test_performance_monitoring(self, storage_manager):
        """测试性能监控"""
        # 注册后端
        memory_config = MemoryStorageConfig(name='perf_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 启用性能监控
        storage_manager.enable_performance_monitoring(True)
        
        # 执行操作
        start_time = datetime.now()
        for i in range(100):
            key = StorageKey(key=f'perf_key_{i}', namespace='performance')
            value = StorageValue(data={'index': i})
            await storage_manager.set(key, value)
        end_time = datetime.now()
        
        # 获取性能统计
        perf_stats = storage_manager.get_performance_stats()
        assert perf_stats is not None
        assert 'operation_count' in perf_stats
        assert 'avg_operation_time_ms' in perf_stats
        assert 'throughput_ops_per_sec' in perf_stats
        
        assert perf_stats['operation_count'] >= 100
        
        # 禁用性能监控
        storage_manager.enable_performance_monitoring(False)

    async def test_storage_quotas(self, storage_manager):
        """测试存储配额"""
        # 注册带配额限制的后端
        memory_config = MemoryStorageConfig(
            name='quota_memory',
            max_memory_mb=1  # 限制为1MB
        )
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 设置命名空间配额
        await storage_manager.set_namespace_quota('quota_test', max_size_mb=0.5)
        
        # 尝试写入数据直到达到配额
        large_data = {'data': 'x' * 10000}  # 约10KB数据
        
        written_count = 0
        try:
            for i in range(100):  # 尝试写入大量数据
                key = StorageKey(key=f'quota_key_{i}', namespace='quota_test')
                value = StorageValue(data=large_data)
                await storage_manager.set(key, value)
                written_count += 1
        except Exception:
            # 预期会因为配额限制而失败
            pass
        
        # 获取配额使用情况
        quota_usage = await storage_manager.get_quota_usage('quota_test')
        assert quota_usage is not None
        assert 'used_size_mb' in quota_usage
        assert 'max_size_mb' in quota_usage
        assert quota_usage['max_size_mb'] == 0.5

    async def test_data_lifecycle_management(self, storage_manager):
        """测试数据生命周期管理"""
        # 注册后端
        memory_config = MemoryStorageConfig(name='lifecycle_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 设置TTL策略
        ttl_policy = {
            'default_ttl': 3600,  # 1小时
            'max_ttl': 86400,     # 24小时
            'cleanup_interval': 300  # 5分钟
        }
        
        await storage_manager.set_ttl_policy(ttl_policy)
        
        # 添加带TTL的数据
        key = StorageKey(key='ttl_key', namespace='lifecycle')
        value = StorageValue(data={'test': 'ttl'}, ttl=2)  # 2秒TTL
        
        await storage_manager.set(key, value)
        
        # 立即获取应该存在
        retrieved = await storage_manager.get(key)
        assert retrieved is not None
        
        # 等待TTL过期
        await asyncio.sleep(2.1)
        
        # 触发清理
        await storage_manager.cleanup_expired_data()
        
        # 现在应该不存在
        retrieved = await storage_manager.get(key)
        assert retrieved is None

    async def test_schema_management(self, storage_manager):
        """测试模式管理"""
        # 注册支持模式的后端
        memory_config = MemoryStorageConfig(name='schema_memory')
        await storage_manager.register_backend('memory', memory_config, is_default=True)
        
        # 定义数据模式
        schema = StorageSchema(
            name='user_schema',
            version='1.0',
            fields={
                'id': {'type': 'string', 'required': True},
                'name': {'type': 'string', 'required': True},
                'age': {'type': 'integer', 'required': False},
                'email': {'type': 'string', 'required': False}
            }
        )
        
        # 注册模式
        result = await storage_manager.register_schema(schema)
        assert result is True
        
        # 使用模式验证数据
        valid_data = {
            'id': 'user_001',
            'name': 'John Doe',
            'age': 30,
            'email': 'john@example.com'
        }
        
        key = StorageKey(key='user_001', namespace='users')
        value = StorageValue(data=valid_data, schema='user_schema')
        
        # 设置数据（应该通过验证）
        result = await storage_manager.set(key, value)
        assert result is True
        
        # 尝试设置无效数据
        invalid_data = {
            'name': 'Jane Doe'  # 缺少必需的id字段
        }
        
        invalid_value = StorageValue(data=invalid_data, schema='user_schema')
        
        with pytest.raises(Exception):  # 应该因为模式验证失败而抛出异常
            await storage_manager.set(
                StorageKey(key='user_002', namespace='users'),
                invalid_value
            )
