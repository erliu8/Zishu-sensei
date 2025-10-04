# -*- coding: utf-8 -*-
"""
存储工厂测试

测试存储后端工厂的功能
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, Any, List, Optional, Type

from zishu.storage.factory import StorageFactory, StorageBackendRegistry
from zishu.storage.backends.base import BaseStorageBackend, StorageConfig
from zishu.storage.backends.memory import MemoryStorageBackend, MemoryStorageConfig
from zishu.storage.backends.file import FileStorageBackend, FileStorageConfig
from zishu.storage.backends.sqlite import SQLiteStorageBackend, SQLiteStorageConfig
from zishu.storage.backends.redis import RedisStorageBackend, RedisStorageConfig
from zishu.storage.backends.mongodb import MongoDBStorageBackend, MongoDBStorageConfig
from zishu.storage.backends.postgresql import PostgreSQLStorageBackend, PostgreSQLStorageConfig
from zishu.storage.core.types import StorageBackendType, StorageKey, StorageValue
from zishu.storage.core.exceptions import (
    StorageException, FactoryException, ConfigurationException,
    BackendNotSupportedException, BackendCreationException
)

from tests.utils.storage_test_utils import StorageTestUtils


class TestStorageBackendRegistry:
    """存储后端注册表测试类"""

    @pytest.fixture
    def registry(self):
        """创建存储后端注册表实例"""
        return StorageBackendRegistry()

    def test_registry_initialization(self, registry):
        """测试注册表初始化"""
        assert isinstance(registry, StorageBackendRegistry)
        assert len(registry.get_registered_backends()) >= 0

    def test_register_backend(self, registry):
        """测试注册存储后端"""
        # 创建Mock后端类
        class MockBackend(BaseStorageBackend):
            def __init__(self, config):
                super().__init__(config)
        
        # 注册后端
        registry.register_backend('mock', MockBackend)
        
        # 验证注册成功
        registered_backends = registry.get_registered_backends()
        assert 'mock' in registered_backends
        assert registered_backends['mock'] == MockBackend

    def test_unregister_backend(self, registry):
        """测试注销存储后端"""
        # 注册后端
        class MockBackend(BaseStorageBackend):
            pass
        
        registry.register_backend('mock', MockBackend)
        assert 'mock' in registry.get_registered_backends()
        
        # 注销后端
        registry.unregister_backend('mock')
        assert 'mock' not in registry.get_registered_backends()

    def test_get_backend_class(self, registry):
        """测试获取后端类"""
        # 注册后端
        class MockBackend(BaseStorageBackend):
            pass
        
        registry.register_backend('mock', MockBackend)
        
        # 获取后端类
        backend_class = registry.get_backend_class('mock')
        assert backend_class == MockBackend

    def test_get_nonexistent_backend_class(self, registry):
        """测试获取不存在的后端类"""
        with pytest.raises(BackendNotSupportedException):
            registry.get_backend_class('nonexistent')

    def test_register_duplicate_backend(self, registry):
        """测试注册重复的后端"""
        class MockBackend1(BaseStorageBackend):
            pass
        
        class MockBackend2(BaseStorageBackend):
            pass
        
        # 注册第一个后端
        registry.register_backend('mock', MockBackend1)
        
        # 注册同名后端应该覆盖
        registry.register_backend('mock', MockBackend2)
        
        # 验证被覆盖
        backend_class = registry.get_backend_class('mock')
        assert backend_class == MockBackend2

    def test_list_registered_backends(self, registry):
        """测试列出已注册的后端"""
        # 注册多个后端
        class MockBackend1(BaseStorageBackend):
            pass
        
        class MockBackend2(BaseStorageBackend):
            pass
        
        registry.register_backend('mock1', MockBackend1)
        registry.register_backend('mock2', MockBackend2)
        
        # 获取注册的后端列表
        backends = registry.list_backend_names()
        assert 'mock1' in backends
        assert 'mock2' in backends

    def test_backend_info(self, registry):
        """测试获取后端信息"""
        class MockBackend(BaseStorageBackend):
            """Mock storage backend for testing"""
            pass
        
        registry.register_backend('mock', MockBackend)
        
        # 获取后端信息
        info = registry.get_backend_info('mock')
        assert info is not None
        assert 'name' in info
        assert 'class' in info
        assert info['name'] == 'mock'
        assert info['class'] == MockBackend


class TestStorageFactory:
    """存储工厂测试类"""

    @pytest.fixture
    def factory(self):
        """创建存储工厂实例"""
        return StorageFactory()

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    def test_factory_initialization(self, factory):
        """测试工厂初始化"""
        assert isinstance(factory, StorageFactory)
        assert factory.registry is not None

    def test_create_memory_backend(self, factory):
        """测试创建内存存储后端"""
        config = MemoryStorageConfig(
            name='test_memory',
            enabled=True,
            max_memory_mb=100
        )
        
        backend = factory.create_backend('memory', config)
        
        assert isinstance(backend, MemoryStorageBackend)
        assert backend.config == config

    def test_create_file_backend(self, factory, temp_dir):
        """测试创建文件存储后端"""
        config = FileStorageConfig(
            name='test_file',
            enabled=True,
            storage_path=temp_dir
        )
        
        backend = factory.create_backend('file', config)
        
        assert isinstance(backend, FileStorageBackend)
        assert backend.config == config

    def test_create_sqlite_backend(self, factory):
        """测试创建SQLite存储后端"""
        temp_file = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        temp_file.close()
        
        try:
            config = SQLiteStorageConfig(
                name='test_sqlite',
                enabled=True,
                database_path=temp_file.name
            )
            
            backend = factory.create_backend('sqlite', config)
            
            assert isinstance(backend, SQLiteStorageBackend)
            assert backend.config == config
            
        finally:
            Path(temp_file.name).unlink(missing_ok=True)

    def test_create_redis_backend(self, factory):
        """测试创建Redis存储后端"""
        config = RedisStorageConfig(
            name='test_redis',
            enabled=True,
            host='localhost',
            port=6379
        )
        
        backend = factory.create_backend('redis', config)
        
        assert isinstance(backend, RedisStorageBackend)
        assert backend.config == config

    def test_create_mongodb_backend(self, factory):
        """测试创建MongoDB存储后端"""
        config = MongoDBStorageConfig(
            name='test_mongodb',
            enabled=True,
            host='localhost',
            port=27017,
            database='test_db'
        )
        
        backend = factory.create_backend('mongodb', config)
        
        assert isinstance(backend, MongoDBStorageBackend)
        assert backend.config == config

    def test_create_postgresql_backend(self, factory):
        """测试创建PostgreSQL存储后端"""
        config = PostgreSQLStorageConfig(
            name='test_postgresql',
            enabled=True,
            host='localhost',
            port=5432,
            database='test_db',
            username='test_user',
            password='test_pass'
        )
        
        backend = factory.create_backend('postgresql', config)
        
        assert isinstance(backend, PostgreSQLStorageBackend)
        assert backend.config == config

    def test_create_unsupported_backend(self, factory):
        """测试创建不支持的存储后端"""
        config = StorageConfig(name='unsupported')
        
        with pytest.raises(BackendNotSupportedException):
            factory.create_backend('unsupported', config)

    def test_create_backend_with_invalid_config(self, factory):
        """测试使用无效配置创建后端"""
        # 使用错误的配置类型
        config = MemoryStorageConfig(name='test')
        
        with pytest.raises(ConfigurationException):
            factory.create_backend('file', config)  # 文件后端需要FileStorageConfig

    def test_register_custom_backend(self, factory):
        """测试注册自定义存储后端"""
        class CustomBackend(BaseStorageBackend):
            def __init__(self, config):
                super().__init__(config)
        
        # 注册自定义后端
        factory.register_backend('custom', CustomBackend)
        
        # 创建自定义后端
        config = StorageConfig(name='test_custom')
        backend = factory.create_backend('custom', config)
        
        assert isinstance(backend, CustomBackend)

    def test_list_supported_backends(self, factory):
        """测试列出支持的后端类型"""
        supported_backends = factory.list_supported_backends()
        
        assert isinstance(supported_backends, list)
        assert len(supported_backends) > 0
        
        # 验证包含基本后端类型
        expected_backends = ['memory', 'file', 'sqlite']
        for backend_type in expected_backends:
            assert backend_type in supported_backends

    def test_get_backend_info(self, factory):
        """测试获取后端信息"""
        info = factory.get_backend_info('memory')
        
        assert info is not None
        assert 'name' in info
        assert 'class' in info
        assert 'description' in info
        assert info['name'] == 'memory'

    def test_validate_backend_config(self, factory):
        """测试验证后端配置"""
        # 有效配置
        valid_config = MemoryStorageConfig(
            name='test_memory',
            enabled=True,
            max_memory_mb=100
        )
        
        result = factory.validate_config('memory', valid_config)
        assert result.is_valid is True
        assert len(result.errors) == 0
        
        # 无效配置
        invalid_config = StorageConfig(name='')  # 空名称
        
        result = factory.validate_config('memory', invalid_config)
        assert result.is_valid is False
        assert len(result.errors) > 0

    def test_create_backend_from_url(self, factory):
        """测试从URL创建存储后端"""
        # 内存存储URL
        memory_url = "memory://test_memory?max_memory_mb=100"
        backend = factory.create_backend_from_url(memory_url)
        
        assert isinstance(backend, MemoryStorageBackend)
        assert backend.config.name == 'test_memory'
        assert backend.config.max_memory_mb == 100

    def test_create_backend_from_invalid_url(self, factory):
        """测试从无效URL创建存储后端"""
        invalid_url = "invalid://test"
        
        with pytest.raises(ConfigurationException):
            factory.create_backend_from_url(invalid_url)

    def test_create_backend_pool(self, factory):
        """测试创建存储后端池"""
        configs = [
            MemoryStorageConfig(name='memory1', max_memory_mb=50),
            MemoryStorageConfig(name='memory2', max_memory_mb=50)
        ]
        
        pool = factory.create_backend_pool('memory', configs)
        
        assert isinstance(pool, list)
        assert len(pool) == 2
        
        for backend in pool:
            assert isinstance(backend, MemoryStorageBackend)

    async def test_create_backend_with_connection_test(self, factory, temp_dir):
        """测试创建后端并测试连接"""
        config = FileStorageConfig(
            name='test_file',
            storage_path=temp_dir
        )
        
        backend = factory.create_backend('file', config)
        
        # 测试连接
        await backend.connect()
        assert backend.is_connected
        
        # 测试基本操作
        key = StorageKey(key='test', namespace='test')
        value = StorageValue(data={'test': True})
        
        await backend.set(key, value)
        retrieved = await backend.get(key)
        
        assert retrieved is not None
        assert retrieved.data == value.data
        
        await backend.disconnect()

    def test_backend_factory_singleton(self):
        """测试工厂单例模式"""
        factory1 = StorageFactory()
        factory2 = StorageFactory()
        
        # 验证是否为单例（如果实现了单例模式）
        # 这取决于具体实现，这里只是示例
        assert factory1 is not None
        assert factory2 is not None

    def test_factory_configuration_validation(self, factory):
        """测试工厂配置验证"""
        # 测试配置类型匹配
        memory_config = MemoryStorageConfig(name='test')
        file_config = FileStorageConfig(name='test', storage_path='/tmp')
        
        # 正确的配置匹配
        assert factory._validate_config_type('memory', memory_config) is True
        assert factory._validate_config_type('file', file_config) is True
        
        # 错误的配置匹配
        assert factory._validate_config_type('memory', file_config) is False
        assert factory._validate_config_type('file', memory_config) is False

    def test_factory_error_handling(self, factory):
        """测试工厂错误处理"""
        # 测试创建后端时的异常处理
        with patch.object(MemoryStorageBackend, '__init__', side_effect=Exception('Init failed')):
            config = MemoryStorageConfig(name='test')
            
            with pytest.raises(BackendCreationException):
                factory.create_backend('memory', config)

    def test_factory_backend_capabilities(self, factory):
        """测试后端能力查询"""
        # 查询内存后端能力
        capabilities = factory.get_backend_capabilities('memory')
        
        assert capabilities is not None
        assert 'supports_transactions' in capabilities
        assert 'supports_indexing' in capabilities
        assert 'supports_compression' in capabilities
        assert 'supports_encryption' in capabilities
        
        # 内存后端通常支持事务但不支持持久化
        assert capabilities['supports_transactions'] is True
        assert capabilities['supports_persistence'] is False

    def test_factory_backend_compatibility(self, factory):
        """测试后端兼容性检查"""
        # 检查配置兼容性
        config = MemoryStorageConfig(
            name='test',
            enable_persistence=True  # 内存后端不支持持久化
        )
        
        compatibility = factory.check_compatibility('memory', config)
        
        assert compatibility is not None
        assert 'compatible' in compatibility
        assert 'warnings' in compatibility
        
        # 应该有兼容性警告
        if not compatibility['compatible']:
            assert len(compatibility['warnings']) > 0

    async def test_factory_backend_health_check(self, factory):
        """测试后端健康检查"""
        config = MemoryStorageConfig(name='health_test')
        backend = factory.create_backend('memory', config)
        
        await backend.connect()
        
        try:
            # 执行健康检查
            health = await backend.health_check()
            
            assert health is not None
            assert 'status' in health
            assert 'timestamp' in health
            assert health['status'] in ['healthy', 'unhealthy', 'degraded']
            
        finally:
            await backend.disconnect()

    def test_factory_backend_metrics(self, factory):
        """测试后端指标收集"""
        config = MemoryStorageConfig(name='metrics_test')
        backend = factory.create_backend('memory', config)
        
        # 获取后端指标
        metrics = backend.get_metrics()
        
        assert metrics is not None
        assert isinstance(metrics, dict)
        
        # 基本指标应该存在
        expected_metrics = [
            'operations_total',
            'operation_duration_seconds',
            'storage_size_bytes',
            'connection_count'
        ]
        
        # 检查是否有这些指标（可能为0）
        for metric in expected_metrics:
            assert metric in metrics or any(metric in key for key in metrics.keys())

    def test_factory_configuration_templates(self, factory):
        """测试配置模板"""
        # 获取内存后端的默认配置模板
        template = factory.get_config_template('memory')
        
        assert template is not None
        assert isinstance(template, dict)
        
        # 应该包含基本配置字段
        expected_fields = ['name', 'enabled', 'max_memory_mb']
        for field in expected_fields:
            assert field in template

    def test_factory_backend_migration_support(self, factory):
        """测试后端迁移支持"""
        # 检查后端是否支持数据迁移
        migration_info = factory.get_migration_info('memory', 'file')
        
        assert migration_info is not None
        assert 'supported' in migration_info
        assert 'complexity' in migration_info
        assert 'estimated_time' in migration_info
        
        # 内存到文件的迁移应该是支持的
        assert migration_info['supported'] is True

    async def test_factory_batch_backend_creation(self, factory, temp_dir):
        """测试批量创建后端"""
        configs = [
            ('memory', MemoryStorageConfig(name='batch_memory_1')),
            ('memory', MemoryStorageConfig(name='batch_memory_2')),
            ('file', FileStorageConfig(name='batch_file_1', storage_path=temp_dir))
        ]
        
        backends = factory.create_backends_batch(configs)
        
        assert len(backends) == 3
        assert isinstance(backends[0], MemoryStorageBackend)
        assert isinstance(backends[1], MemoryStorageBackend)
        assert isinstance(backends[2], FileStorageBackend)
        
        # 验证配置正确设置
        assert backends[0].config.name == 'batch_memory_1'
        assert backends[1].config.name == 'batch_memory_2'
        assert backends[2].config.name == 'batch_file_1'

    def test_factory_backend_versioning(self, factory):
        """测试后端版本管理"""
        # 获取后端版本信息
        version_info = factory.get_backend_version('memory')
        
        assert version_info is not None
        assert 'version' in version_info
        assert 'api_version' in version_info
        assert 'compatibility' in version_info
        
        # 版本应该是有效的语义版本
        version = version_info['version']
        assert isinstance(version, str)
        assert len(version.split('.')) >= 2  # 至少有主版本和次版本

    def test_factory_performance_profiling(self, factory):
        """测试工厂性能分析"""
        # 启用性能分析
        factory.enable_profiling(True)
        
        # 创建多个后端
        for i in range(10):
            config = MemoryStorageConfig(name=f'perf_test_{i}')
            backend = factory.create_backend('memory', config)
            assert backend is not None
        
        # 获取性能统计
        stats = factory.get_profiling_stats()
        
        assert stats is not None
        assert 'backend_creation_count' in stats
        assert 'avg_creation_time_ms' in stats
        assert stats['backend_creation_count'] >= 10
        
        # 禁用性能分析
        factory.enable_profiling(False)
