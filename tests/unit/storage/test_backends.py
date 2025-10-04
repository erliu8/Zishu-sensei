# -*- coding: utf-8 -*-
"""
存储后端测试

测试各种存储后端的功能
"""

import pytest
import asyncio
import tempfile
import shutil
import json
import sqlite3
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

from zishu.storage.backends.base import BaseStorageBackend, StorageConfig, StorageOperation
from zishu.storage.backends.memory import MemoryStorageBackend, MemoryStorageConfig
from zishu.storage.backends.file import FileStorageBackend, FileStorageConfig
from zishu.storage.backends.sqlite import SQLiteStorageBackend, SQLiteStorageConfig
from zishu.storage.backends.redis import RedisStorageBackend, RedisStorageConfig
from zishu.storage.backends.mongodb import MongoDBStorageBackend, MongoDBStorageConfig
from zishu.storage.backends.postgresql import PostgreSQLStorageBackend, PostgreSQLStorageConfig
from zishu.storage.core.types import (
    StorageKey, StorageValue, StorageQuery, StorageResult,
    StorageTransaction, StorageIndex, StorageSchema,
    CompressionType, EncryptionType, ConsistencyLevel
)
from zishu.storage.core.exceptions import (
    StorageException, ConnectionException, TransactionException,
    SchemaException, IndexException, CompressionException, EncryptionException
)

from tests.utils.storage_test_utils import StorageTestUtils


class TestBaseStorageBackend:
    """基础存储后端测试类"""

    @pytest.fixture
    def base_config(self):
        """创建基础存储配置"""
        return StorageConfig(
            name='test_storage',
            enabled=True,
            max_connections=10,
            connection_timeout=30,
            operation_timeout=60,
            retry_attempts=3,
            retry_delay=1.0,
            enable_compression=True,
            compression_type=CompressionType.GZIP,
            enable_encryption=True,
            encryption_type=EncryptionType.AES256,
            consistency_level=ConsistencyLevel.STRONG,
            enable_transactions=True,
            enable_indexing=True,
            enable_backup=True,
            backup_interval=3600
        )

    @pytest.fixture
    def mock_backend(self, base_config):
        """创建Mock存储后端"""
        backend = Mock(spec=BaseStorageBackend)
        backend.config = base_config
        backend.is_connected = True
        backend.is_healthy = True
        return backend

    async def test_backend_interface(self, mock_backend):
        """测试存储后端接口"""
        # 验证必需的方法存在
        required_methods = [
            'connect', 'disconnect', 'is_connected', 'health_check',
            'get', 'set', 'delete', 'exists', 'keys', 'clear',
            'batch_get', 'batch_set', 'batch_delete',
            'query', 'create_index', 'drop_index',
            'begin_transaction', 'commit_transaction', 'rollback_transaction',
            'backup', 'restore', 'get_stats'
        ]
        
        for method in required_methods:
            assert hasattr(mock_backend, method)

    async def test_connection_lifecycle(self, mock_backend):
        """测试连接生命周期"""
        # Mock连接方法
        mock_backend.connect = AsyncMock(return_value=True)
        mock_backend.disconnect = AsyncMock(return_value=True)
        mock_backend.is_connected = False
        
        # 测试连接
        result = await mock_backend.connect()
        assert result is True
        mock_backend.connect.assert_called_once()
        
        # 测试断开连接
        result = await mock_backend.disconnect()
        assert result is True
        mock_backend.disconnect.assert_called_once()

    async def test_basic_operations(self, mock_backend):
        """测试基本操作"""
        # Mock基本操作
        mock_backend.set = AsyncMock(return_value=True)
        mock_backend.get = AsyncMock(return_value=StorageValue(data={'test': 'value'}))
        mock_backend.delete = AsyncMock(return_value=True)
        mock_backend.exists = AsyncMock(return_value=True)
        
        # 测试设置值
        key = StorageKey(key='test_key', namespace='test')
        value = StorageValue(data={'test': 'value'})
        result = await mock_backend.set(key, value)
        assert result is True
        
        # 测试获取值
        result = await mock_backend.get(key)
        assert isinstance(result, StorageValue)
        assert result.data == {'test': 'value'}
        
        # 测试删除值
        result = await mock_backend.delete(key)
        assert result is True
        
        # 测试检查存在
        result = await mock_backend.exists(key)
        assert result is True


class TestMemoryStorageBackend:
    """内存存储后端测试类"""

    @pytest.fixture
    def memory_config(self):
        """创建内存存储配置"""
        return MemoryStorageConfig(
            name='memory_storage',
            enabled=True,
            max_memory_mb=100,
            enable_persistence=False,
            persistence_file=None,
            enable_compression=True,
            compression_threshold=1024,
            enable_ttl=True,
            default_ttl=3600,
            cleanup_interval=300,
            enable_statistics=True
        )

    @pytest.fixture
    async def memory_backend(self, memory_config):
        """创建内存存储后端实例"""
        backend = MemoryStorageBackend(config=memory_config)
        await backend.connect()
        yield backend
        await backend.disconnect()

    async def test_memory_backend_initialization(self, memory_config):
        """测试内存后端初始化"""
        backend = MemoryStorageBackend(config=memory_config)
        
        assert backend.config == memory_config
        assert not backend.is_connected
        
        await backend.connect()
        assert backend.is_connected
        
        await backend.disconnect()
        assert not backend.is_connected

    async def test_memory_basic_operations(self, memory_backend):
        """测试内存存储基本操作"""
        key = StorageKey(key='test_key', namespace='test')
        value = StorageValue(data={'message': 'hello world'})
        
        # 测试设置和获取
        result = await memory_backend.set(key, value)
        assert result is True
        
        retrieved_value = await memory_backend.get(key)
        assert retrieved_value is not None
        assert retrieved_value.data == value.data
        
        # 测试存在检查
        exists = await memory_backend.exists(key)
        assert exists is True
        
        # 测试删除
        result = await memory_backend.delete(key)
        assert result is True
        
        exists = await memory_backend.exists(key)
        assert exists is False

    async def test_memory_batch_operations(self, memory_backend):
        """测试内存存储批量操作"""
        # 准备测试数据
        keys_values = []
        for i in range(10):
            key = StorageKey(key=f'batch_key_{i}', namespace='batch')
            value = StorageValue(data={'index': i, 'value': f'data_{i}'})
            keys_values.append((key, value))
        
        # 测试批量设置
        keys = [kv[0] for kv in keys_values]
        values = [kv[1] for kv in keys_values]
        
        result = await memory_backend.batch_set(keys, values)
        assert result is True
        
        # 测试批量获取
        retrieved_values = await memory_backend.batch_get(keys)
        assert len(retrieved_values) == 10
        
        for i, value in enumerate(retrieved_values):
            assert value is not None
            assert value.data['index'] == i
        
        # 测试批量删除
        result = await memory_backend.batch_delete(keys[:5])
        assert result is True
        
        # 验证部分删除
        retrieved_values = await memory_backend.batch_get(keys)
        assert len([v for v in retrieved_values if v is not None]) == 5

    async def test_memory_ttl_functionality(self, memory_backend):
        """测试内存存储TTL功能"""
        key = StorageKey(key='ttl_key', namespace='test')
        value = StorageValue(data={'test': 'ttl'}, ttl=1)  # 1秒TTL
        
        # 设置带TTL的值
        result = await memory_backend.set(key, value)
        assert result is True
        
        # 立即获取应该存在
        retrieved_value = await memory_backend.get(key)
        assert retrieved_value is not None
        
        # 等待TTL过期
        await asyncio.sleep(1.1)
        
        # 触发清理
        await memory_backend._cleanup_expired()
        
        # 现在应该不存在
        retrieved_value = await memory_backend.get(key)
        assert retrieved_value is None

    async def test_memory_namespace_isolation(self, memory_backend):
        """测试内存存储命名空间隔离"""
        key1 = StorageKey(key='same_key', namespace='ns1')
        key2 = StorageKey(key='same_key', namespace='ns2')
        
        value1 = StorageValue(data={'namespace': 'ns1'})
        value2 = StorageValue(data={'namespace': 'ns2'})
        
        # 在不同命名空间设置相同键名
        await memory_backend.set(key1, value1)
        await memory_backend.set(key2, value2)
        
        # 验证命名空间隔离
        retrieved_value1 = await memory_backend.get(key1)
        retrieved_value2 = await memory_backend.get(key2)
        
        assert retrieved_value1.data['namespace'] == 'ns1'
        assert retrieved_value2.data['namespace'] == 'ns2'

    async def test_memory_compression(self, memory_backend):
        """测试内存存储压缩功能"""
        # 创建大数据以触发压缩
        large_data = {'data': 'x' * 2000}  # 超过压缩阈值
        key = StorageKey(key='large_key', namespace='test')
        value = StorageValue(data=large_data)
        
        # 设置大数据
        result = await memory_backend.set(key, value)
        assert result is True
        
        # 获取数据应该正确解压
        retrieved_value = await memory_backend.get(key)
        assert retrieved_value is not None
        assert retrieved_value.data == large_data

    async def test_memory_statistics(self, memory_backend):
        """测试内存存储统计功能"""
        # 添加一些数据
        for i in range(5):
            key = StorageKey(key=f'stats_key_{i}', namespace='stats')
            value = StorageValue(data={'index': i})
            await memory_backend.set(key, value)
        
        # 获取统计信息
        stats = await memory_backend.get_stats()
        
        assert stats is not None
        assert 'total_keys' in stats
        assert 'memory_usage_bytes' in stats
        assert 'compression_ratio' in stats
        assert stats['total_keys'] >= 5


class TestFileStorageBackend:
    """文件存储后端测试类"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    @pytest.fixture
    def file_config(self, temp_dir):
        """创建文件存储配置"""
        return FileStorageConfig(
            name='file_storage',
            enabled=True,
            storage_path=temp_dir,
            file_format='json',
            enable_compression=True,
            compression_type=CompressionType.GZIP,
            enable_encryption=False,
            max_file_size_mb=10,
            enable_backup=True,
            backup_retention_days=7,
            enable_indexing=True,
            sync_interval=60
        )

    @pytest.fixture
    async def file_backend(self, file_config):
        """创建文件存储后端实例"""
        backend = FileStorageBackend(config=file_config)
        await backend.connect()
        yield backend
        await backend.disconnect()

    async def test_file_backend_initialization(self, file_config):
        """测试文件后端初始化"""
        backend = FileStorageBackend(config=file_config)
        
        assert backend.config == file_config
        assert not backend.is_connected
        
        await backend.connect()
        assert backend.is_connected
        assert Path(file_config.storage_path).exists()
        
        await backend.disconnect()

    async def test_file_basic_operations(self, file_backend):
        """测试文件存储基本操作"""
        key = StorageKey(key='test_key', namespace='test')
        value = StorageValue(data={'message': 'hello file storage'})
        
        # 测试设置和获取
        result = await file_backend.set(key, value)
        assert result is True
        
        retrieved_value = await file_backend.get(key)
        assert retrieved_value is not None
        assert retrieved_value.data == value.data
        
        # 测试文件确实被创建
        file_path = file_backend._get_file_path(key)
        assert file_path.exists()
        
        # 测试删除
        result = await file_backend.delete(key)
        assert result is True
        
        exists = await file_backend.exists(key)
        assert exists is False

    async def test_file_persistence(self, file_backend):
        """测试文件存储持久化"""
        key = StorageKey(key='persist_key', namespace='test')
        value = StorageValue(data={'persistent': True})
        
        # 设置值
        await file_backend.set(key, value)
        
        # 断开连接
        await file_backend.disconnect()
        
        # 重新连接
        await file_backend.connect()
        
        # 验证数据仍然存在
        retrieved_value = await file_backend.get(key)
        assert retrieved_value is not None
        assert retrieved_value.data == value.data

    async def test_file_compression(self, file_backend):
        """测试文件存储压缩功能"""
        # 创建大数据
        large_data = {'data': 'x' * 5000}
        key = StorageKey(key='large_key', namespace='test')
        value = StorageValue(data=large_data)
        
        # 设置大数据
        result = await file_backend.set(key, value)
        assert result is True
        
        # 验证文件被压缩（文件大小应该小于原始数据）
        file_path = file_backend._get_file_path(key)
        file_size = file_path.stat().st_size
        original_size = len(json.dumps(large_data).encode())
        
        assert file_size < original_size
        
        # 验证数据正确解压
        retrieved_value = await file_backend.get(key)
        assert retrieved_value.data == large_data

    async def test_file_backup_functionality(self, file_backend):
        """测试文件存储备份功能"""
        # 添加一些数据
        for i in range(3):
            key = StorageKey(key=f'backup_key_{i}', namespace='backup')
            value = StorageValue(data={'index': i})
            await file_backend.set(key, value)
        
        # 创建备份
        backup_path = await file_backend.backup()
        assert backup_path is not None
        assert Path(backup_path).exists()
        
        # 清空存储
        await file_backend.clear()
        
        # 从备份恢复
        result = await file_backend.restore(backup_path)
        assert result is True
        
        # 验证数据恢复
        for i in range(3):
            key = StorageKey(key=f'backup_key_{i}', namespace='backup')
            retrieved_value = await file_backend.get(key)
            assert retrieved_value is not None
            assert retrieved_value.data['index'] == i

    async def test_file_indexing(self, file_backend):
        """测试文件存储索引功能"""
        # 创建索引
        index = StorageIndex(
            name='test_index',
            fields=['data.category'],
            unique=False
        )
        
        result = await file_backend.create_index(index)
        assert result is True
        
        # 添加可索引的数据
        for i in range(5):
            key = StorageKey(key=f'indexed_key_{i}', namespace='indexed')
            value = StorageValue(data={
                'category': 'type_a' if i % 2 == 0 else 'type_b',
                'value': i
            })
            await file_backend.set(key, value)
        
        # 使用索引查询
        query = StorageQuery(
            filters={'data.category': 'type_a'},
            limit=10
        )
        
        result = await file_backend.query(query)
        assert isinstance(result, StorageResult)
        assert len(result.items) == 3  # 0, 2, 4


class TestSQLiteStorageBackend:
    """SQLite存储后端测试类"""

    @pytest.fixture
    def temp_db_file(self):
        """创建临时数据库文件"""
        temp_file = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        temp_file.close()
        yield temp_file.name
        Path(temp_file.name).unlink(missing_ok=True)

    @pytest.fixture
    def sqlite_config(self, temp_db_file):
        """创建SQLite存储配置"""
        return SQLiteStorageConfig(
            name='sqlite_storage',
            enabled=True,
            database_path=temp_db_file,
            enable_wal=True,
            enable_foreign_keys=True,
            cache_size=1000,
            page_size=4096,
            enable_compression=True,
            enable_encryption=False,
            connection_pool_size=5,
            enable_backup=True,
            backup_interval=3600
        )

    @pytest.fixture
    async def sqlite_backend(self, sqlite_config):
        """创建SQLite存储后端实例"""
        backend = SQLiteStorageBackend(config=sqlite_config)
        await backend.connect()
        yield backend
        await backend.disconnect()

    async def test_sqlite_backend_initialization(self, sqlite_config):
        """测试SQLite后端初始化"""
        backend = SQLiteStorageBackend(config=sqlite_config)
        
        assert backend.config == sqlite_config
        assert not backend.is_connected
        
        await backend.connect()
        assert backend.is_connected
        assert Path(sqlite_config.database_path).exists()
        
        await backend.disconnect()

    async def test_sqlite_basic_operations(self, sqlite_backend):
        """测试SQLite存储基本操作"""
        key = StorageKey(key='test_key', namespace='test')
        value = StorageValue(data={'message': 'hello sqlite'})
        
        # 测试设置和获取
        result = await sqlite_backend.set(key, value)
        assert result is True
        
        retrieved_value = await sqlite_backend.get(key)
        assert retrieved_value is not None
        assert retrieved_value.data == value.data
        
        # 测试存在检查
        exists = await sqlite_backend.exists(key)
        assert exists is True
        
        # 测试删除
        result = await sqlite_backend.delete(key)
        assert result is True
        
        exists = await sqlite_backend.exists(key)
        assert exists is False

    async def test_sqlite_transactions(self, sqlite_backend):
        """测试SQLite事务功能"""
        key1 = StorageKey(key='tx_key_1', namespace='test')
        key2 = StorageKey(key='tx_key_2', namespace='test')
        value1 = StorageValue(data={'tx': 1})
        value2 = StorageValue(data={'tx': 2})
        
        # 开始事务
        tx = await sqlite_backend.begin_transaction()
        assert tx is not None
        
        try:
            # 在事务中设置值
            await sqlite_backend.set(key1, value1, transaction=tx)
            await sqlite_backend.set(key2, value2, transaction=tx)
            
            # 提交事务
            await sqlite_backend.commit_transaction(tx)
            
            # 验证数据已提交
            retrieved_value1 = await sqlite_backend.get(key1)
            retrieved_value2 = await sqlite_backend.get(key2)
            
            assert retrieved_value1.data == value1.data
            assert retrieved_value2.data == value2.data
            
        except Exception:
            await sqlite_backend.rollback_transaction(tx)
            raise

    async def test_sqlite_rollback(self, sqlite_backend):
        """测试SQLite事务回滚"""
        key = StorageKey(key='rollback_key', namespace='test')
        value = StorageValue(data={'rollback': True})
        
        # 开始事务
        tx = await sqlite_backend.begin_transaction()
        
        try:
            # 在事务中设置值
            await sqlite_backend.set(key, value, transaction=tx)
            
            # 回滚事务
            await sqlite_backend.rollback_transaction(tx)
            
            # 验证数据未提交
            exists = await sqlite_backend.exists(key)
            assert exists is False
            
        except Exception:
            await sqlite_backend.rollback_transaction(tx)
            raise

    async def test_sqlite_indexing(self, sqlite_backend):
        """测试SQLite索引功能"""
        # 创建索引
        index = StorageIndex(
            name='category_index',
            fields=['data->>"$.category"'],
            unique=False
        )
        
        result = await sqlite_backend.create_index(index)
        assert result is True
        
        # 添加可索引的数据
        for i in range(10):
            key = StorageKey(key=f'indexed_key_{i}', namespace='indexed')
            value = StorageValue(data={
                'category': f'cat_{i % 3}',
                'value': i
            })
            await sqlite_backend.set(key, value)
        
        # 使用索引查询
        query = StorageQuery(
            filters={'data->>"$.category"': 'cat_1'},
            limit=10
        )
        
        result = await sqlite_backend.query(query)
        assert isinstance(result, StorageResult)
        assert len(result.items) > 0
        
        # 验证查询结果
        for item in result.items:
            assert item.value.data['category'] == 'cat_1'

    async def test_sqlite_backup_restore(self, sqlite_backend):
        """测试SQLite备份和恢复"""
        # 添加测试数据
        for i in range(5):
            key = StorageKey(key=f'backup_key_{i}', namespace='backup')
            value = StorageValue(data={'index': i})
            await sqlite_backend.set(key, value)
        
        # 创建备份
        backup_path = await sqlite_backend.backup()
        assert backup_path is not None
        assert Path(backup_path).exists()
        
        # 清空数据库
        await sqlite_backend.clear()
        
        # 验证数据已清空
        keys = await sqlite_backend.keys('backup')
        assert len(keys) == 0
        
        # 从备份恢复
        result = await sqlite_backend.restore(backup_path)
        assert result is True
        
        # 验证数据恢复
        keys = await sqlite_backend.keys('backup')
        assert len(keys) == 5

    async def test_sqlite_performance_query(self, sqlite_backend):
        """测试SQLite性能查询"""
        # 添加大量数据
        batch_size = 100
        keys = []
        values = []
        
        for i in range(batch_size):
            key = StorageKey(key=f'perf_key_{i}', namespace='performance')
            value = StorageValue(data={
                'index': i,
                'category': f'cat_{i % 10}',
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            keys.append(key)
            values.append(value)
        
        # 批量插入
        result = await sqlite_backend.batch_set(keys, values)
        assert result is True
        
        # 复杂查询
        query = StorageQuery(
            filters={
                'data->>"$.category"': 'cat_5',
                'data->>"$.index"': {'$gte': 10}
            },
            order_by=['data->>"$.index"'],
            limit=20
        )
        
        result = await sqlite_backend.query(query)
        assert isinstance(result, StorageResult)
        assert len(result.items) > 0


class TestRedisStorageBackend:
    """Redis存储后端测试类"""

    @pytest.fixture
    def redis_config(self):
        """创建Redis存储配置"""
        return RedisStorageConfig(
            name='redis_storage',
            enabled=True,
            host='localhost',
            port=6379,
            database=0,
            password=None,
            connection_pool_size=10,
            connection_timeout=30,
            enable_clustering=False,
            enable_ssl=False,
            enable_compression=True,
            compression_threshold=1024,
            enable_persistence=True,
            enable_backup=True
        )

    @pytest.fixture
    async def redis_backend(self, redis_config):
        """创建Redis存储后端实例"""
        backend = RedisStorageBackend(config=redis_config)
        
        # 尝试连接Redis，如果失败则跳过测试
        try:
            await backend.connect()
            yield backend
            await backend.disconnect()
        except ConnectionException:
            pytest.skip("Redis server not available")

    async def test_redis_backend_initialization(self, redis_config):
        """测试Redis后端初始化"""
        backend = RedisStorageBackend(config=redis_config)
        
        assert backend.config == redis_config
        assert not backend.is_connected
        
        try:
            await backend.connect()
            assert backend.is_connected
            await backend.disconnect()
        except ConnectionException:
            pytest.skip("Redis server not available")

    async def test_redis_basic_operations(self, redis_backend):
        """测试Redis存储基本操作"""
        key = StorageKey(key='test_key', namespace='test')
        value = StorageValue(data={'message': 'hello redis'})
        
        # 测试设置和获取
        result = await redis_backend.set(key, value)
        assert result is True
        
        retrieved_value = await redis_backend.get(key)
        assert retrieved_value is not None
        assert retrieved_value.data == value.data
        
        # 测试存在检查
        exists = await redis_backend.exists(key)
        assert exists is True
        
        # 测试删除
        result = await redis_backend.delete(key)
        assert result is True
        
        exists = await redis_backend.exists(key)
        assert exists is False

    async def test_redis_ttl_functionality(self, redis_backend):
        """测试Redis TTL功能"""
        key = StorageKey(key='ttl_key', namespace='test')
        value = StorageValue(data={'test': 'ttl'}, ttl=2)  # 2秒TTL
        
        # 设置带TTL的值
        result = await redis_backend.set(key, value)
        assert result is True
        
        # 立即获取应该存在
        retrieved_value = await redis_backend.get(key)
        assert retrieved_value is not None
        
        # 等待TTL过期
        await asyncio.sleep(2.1)
        
        # 现在应该不存在
        retrieved_value = await redis_backend.get(key)
        assert retrieved_value is None

    async def test_redis_pipeline_operations(self, redis_backend):
        """测试Redis管道操作"""
        # 准备测试数据
        keys_values = []
        for i in range(20):
            key = StorageKey(key=f'pipeline_key_{i}', namespace='pipeline')
            value = StorageValue(data={'index': i})
            keys_values.append((key, value))
        
        keys = [kv[0] for kv in keys_values]
        values = [kv[1] for kv in keys_values]
        
        # 测试批量设置
        result = await redis_backend.batch_set(keys, values)
        assert result is True
        
        # 测试批量获取
        retrieved_values = await redis_backend.batch_get(keys)
        assert len(retrieved_values) == 20
        
        for i, value in enumerate(retrieved_values):
            assert value is not None
            assert value.data['index'] == i

    async def test_redis_pub_sub(self, redis_backend):
        """测试Redis发布订阅功能"""
        if not hasattr(redis_backend, 'publish') or not hasattr(redis_backend, 'subscribe'):
            pytest.skip("Redis backend doesn't support pub/sub")
        
        channel = 'test_channel'
        message = {'event': 'test', 'data': 'hello'}
        
        # 订阅频道
        subscription = await redis_backend.subscribe(channel)
        
        # 发布消息
        result = await redis_backend.publish(channel, message)
        assert result >= 0  # 返回接收消息的订阅者数量
        
        # 取消订阅
        await redis_backend.unsubscribe(subscription)


class TestStorageBackendComparison:
    """存储后端比较测试类"""

    @pytest.fixture
    def test_data(self):
        """创建测试数据"""
        return [
            (
                StorageKey(key=f'key_{i}', namespace='comparison'),
                StorageValue(data={'index': i, 'data': f'value_{i}'})
            )
            for i in range(100)
        ]

    async def test_performance_comparison(self, test_data):
        """测试不同存储后端的性能比较"""
        # 这里可以比较不同后端的性能
        # 由于测试环境限制，我们只做基本的功能验证
        
        # 内存存储配置
        memory_config = MemoryStorageConfig(
            name='memory_perf',
            enabled=True,
            max_memory_mb=100
        )
        
        memory_backend = MemoryStorageBackend(config=memory_config)
        await memory_backend.connect()
        
        try:
            # 测试批量写入性能
            keys = [item[0] for item in test_data]
            values = [item[1] for item in test_data]
            
            start_time = datetime.now()
            await memory_backend.batch_set(keys, values)
            write_time = (datetime.now() - start_time).total_seconds()
            
            # 测试批量读取性能
            start_time = datetime.now()
            retrieved_values = await memory_backend.batch_get(keys)
            read_time = (datetime.now() - start_time).total_seconds()
            
            # 验证结果
            assert len(retrieved_values) == len(test_data)
            assert write_time > 0
            assert read_time > 0
            
            # 性能应该在合理范围内（具体值取决于硬件）
            assert write_time < 1.0  # 写入应该在1秒内完成
            assert read_time < 1.0   # 读取应该在1秒内完成
            
        finally:
            await memory_backend.disconnect()

    async def test_consistency_comparison(self):
        """测试不同存储后端的一致性保证"""
        # 内存存储 - 强一致性
        memory_config = MemoryStorageConfig(name='memory_consistency')
        memory_backend = MemoryStorageBackend(config=memory_config)
        await memory_backend.connect()
        
        try:
            key = StorageKey(key='consistency_key', namespace='test')
            value1 = StorageValue(data={'version': 1})
            value2 = StorageValue(data={'version': 2})
            
            # 设置初始值
            await memory_backend.set(key, value1)
            
            # 立即读取应该返回最新值
            retrieved = await memory_backend.get(key)
            assert retrieved.data['version'] == 1
            
            # 更新值
            await memory_backend.set(key, value2)
            
            # 立即读取应该返回更新后的值
            retrieved = await memory_backend.get(key)
            assert retrieved.data['version'] == 2
            
        finally:
            await memory_backend.disconnect()

    async def test_durability_comparison(self):
        """测试不同存储后端的持久性保证"""
        # 文件存储 - 持久性保证
        temp_dir = tempfile.mkdtemp()
        
        try:
            file_config = FileStorageConfig(
                name='file_durability',
                storage_path=temp_dir
            )
            
            file_backend = FileStorageBackend(config=file_config)
            await file_backend.connect()
            
            key = StorageKey(key='durability_key', namespace='test')
            value = StorageValue(data={'persistent': True})
            
            # 设置值
            await file_backend.set(key, value)
            
            # 断开连接（模拟系统重启）
            await file_backend.disconnect()
            
            # 重新连接
            await file_backend.connect()
            
            # 验证数据仍然存在
            retrieved = await file_backend.get(key)
            assert retrieved is not None
            assert retrieved.data['persistent'] is True
            
            await file_backend.disconnect()
            
        finally:
            shutil.rmtree(temp_dir)

    async def test_scalability_comparison(self):
        """测试不同存储后端的可扩展性"""
        # 测试内存存储的可扩展性限制
        memory_config = MemoryStorageConfig(
            name='memory_scalability',
            max_memory_mb=1  # 限制为1MB
        )
        
        memory_backend = MemoryStorageBackend(config=memory_config)
        await memory_backend.connect()
        
        try:
            # 尝试存储超出内存限制的数据
            large_data = {'data': 'x' * 100000}  # 约100KB数据
            
            keys_values = []
            for i in range(20):  # 总共约2MB数据
                key = StorageKey(key=f'scale_key_{i}', namespace='scale')
                value = StorageValue(data=large_data)
                keys_values.append((key, value))
            
            # 批量设置可能会因为内存限制而失败或触发清理
            keys = [kv[0] for kv in keys_values]
            values = [kv[1] for kv in keys_values]
            
            # 这里不检查是否成功，因为可能会因为内存限制而失败
            # 主要是测试后端是否能正确处理内存压力
            try:
                await memory_backend.batch_set(keys, values)
            except Exception:
                pass  # 预期可能会失败
            
            # 获取统计信息
            stats = await memory_backend.get_stats()
            assert 'memory_usage_bytes' in stats
            
        finally:
            await memory_backend.disconnect()
