"""
存储模块
提供适配器数据的持久化存储功能

主要功能：
1. 统一的存储接口
2. 多后端支持（内存、文件等）
3. 适配器数据管理
4. 事务支持
5. 数据迁移和备份
"""

from .interfaces import (
    IStorageBackend,
    IAdapterStorage, 
    StorageBackendType,
    StorageQuery,
    StorageResult,
    StorageTransaction,
    StorageException,
    NotFoundError,
    DuplicateError,
    ValidationError
)

from .backends import MemoryStorageBackend, FileStorageBackend
from .backends.sqlite import SQLiteStorageBackend
from .backends.postgresql import PostgreSQLStorageBackend
from .backends.redis import RedisStorageBackend
from .backends.mongodb import MongoDBStorageBackend
from .adapter_storage import AdapterStorage
from .manager import StorageManager, get_storage_manager, initialize_storage, shutdown_storage
from .factory import StorageFactory, StorageConfig, StorageManager as StorageManagerNew

__all__ = [
    # 接口
    'IStorageBackend',
    'IAdapterStorage',
    
    # 类型和枚举
    'StorageBackendType',
    'StorageQuery',
    'StorageResult', 
    'StorageTransaction',
    
    # 异常
    'StorageException',
    'NotFoundError',
    'DuplicateError',
    'ValidationError',
    
    # 实现类
    'MemoryStorageBackend',
    'FileStorageBackend',
    'SQLiteStorageBackend',
    'PostgreSQLStorageBackend',
    'RedisStorageBackend',
    'MongoDBStorageBackend',
    'AdapterStorage',
    'StorageManager',
    'StorageManagerNew',
    'StorageFactory',
    'StorageConfig',
    'get_storage_manager',
    
    # 工具函数
    'initialize_storage',
    'shutdown_storage',
    'create_default_storage_config',
    'cleanup_storage',
]


def create_default_storage_config():
    """创建默认存储配置"""
    return {
        'backends': {
            'memory': {
                'type': 'memory',
                'config': {}
            }
        },
        'default_backend': 'memory'
    }


