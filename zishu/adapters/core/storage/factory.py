"""
存储工厂和配置管理器
提供统一的存储后端创建和管理功能
"""

import logging
from typing import Dict, Any, Optional, Type, Union
from enum import Enum
import os
import json
import yaml
from pathlib import Path

from .interfaces import IStorageBackend, StorageBackendType, StorageException
from .backends.sqlite import SQLiteStorageBackend
from .backends.postgresql import PostgreSQLStorageBackend
from .backends.redis import RedisStorageBackend
from .backends.mongodb import MongoDBStorageBackend

logger = logging.getLogger(__name__)


class StorageConfigError(StorageException):
    """存储配置错误"""
    pass


class StorageConfig:
    """存储配置管理器"""
    
    def __init__(self, config_data: Dict[str, Any] = None):
        self._config = config_data or {}
        self._validate_config()
    
    def _validate_config(self):
        """验证配置"""
        if not isinstance(self._config, dict):
            raise StorageConfigError("Configuration must be a dictionary")
        
        # 验证后端类型
        backend_type = self._config.get('backend_type')
        if backend_type:
            try:
                StorageBackendType(backend_type)
            except ValueError:
                raise StorageConfigError(f"Invalid backend type: {backend_type}")
    
    @classmethod
    def from_file(cls, config_path: Union[str, Path]) -> 'StorageConfig':
        """从文件加载配置"""
        config_path = Path(config_path)
        
        if not config_path.exists():
            raise StorageConfigError(f"Configuration file not found: {config_path}")
        
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                if config_path.suffix.lower() in ['.yml', '.yaml']:
                    config_data = yaml.safe_load(f)
                elif config_path.suffix.lower() == '.json':
                    config_data = json.load(f)
                else:
                    raise StorageConfigError(f"Unsupported configuration file format: {config_path.suffix}")
            
            return cls(config_data)
            
        except Exception as e:
            raise StorageConfigError(f"Failed to load configuration from {config_path}: {e}")
    
    @classmethod
    def from_env(cls, prefix: str = "ZISHU_STORAGE") -> 'StorageConfig':
        """从环境变量加载配置"""
        config_data = {}
        
        # 基本配置
        backend_type = os.getenv(f"{prefix}_BACKEND_TYPE")
        if backend_type:
            config_data['backend_type'] = backend_type
        
        # SQLite配置
        sqlite_path = os.getenv(f"{prefix}_SQLITE_PATH")
        if sqlite_path:
            config_data['sqlite'] = {'database_path': sqlite_path}
        
        # PostgreSQL配置
        pg_host = os.getenv(f"{prefix}_PG_HOST")
        if pg_host:
            config_data['postgresql'] = {
                'host': pg_host,
                'port': int(os.getenv(f"{prefix}_PG_PORT", 5432)),
                'database': os.getenv(f"{prefix}_PG_DATABASE", 'zishu_storage'),
                'username': os.getenv(f"{prefix}_PG_USERNAME"),
                'password': os.getenv(f"{prefix}_PG_PASSWORD"),
                'pool_size': int(os.getenv(f"{prefix}_PG_POOL_SIZE", 10)),
                'ssl_mode': os.getenv(f"{prefix}_PG_SSL_MODE", 'prefer')
            }
        
        # Redis配置
        redis_host = os.getenv(f"{prefix}_REDIS_HOST")
        if redis_host:
            config_data['redis'] = {
                'host': redis_host,
                'port': int(os.getenv(f"{prefix}_REDIS_PORT", 6379)),
                'database': int(os.getenv(f"{prefix}_REDIS_DATABASE", 0)),
                'password': os.getenv(f"{prefix}_REDIS_PASSWORD"),
                'max_connections': int(os.getenv(f"{prefix}_REDIS_MAX_CONNECTIONS", 100)),
                'decode_responses': os.getenv(f"{prefix}_REDIS_DECODE_RESPONSES", 'true').lower() == 'true'
            }
        
        # MongoDB配置
        mongo_host = os.getenv(f"{prefix}_MONGO_HOST")
        if mongo_host:
            config_data['mongodb'] = {
                'host': mongo_host,
                'port': int(os.getenv(f"{prefix}_MONGO_PORT", 27017)),
                'database': os.getenv(f"{prefix}_MONGO_DATABASE", 'zishu_storage'),
                'username': os.getenv(f"{prefix}_MONGO_USERNAME"),
                'password': os.getenv(f"{prefix}_MONGO_PASSWORD"),
                'max_pool_size': int(os.getenv(f"{prefix}_MONGO_MAX_POOL_SIZE", 100))
            }
        
        return cls(config_data)
    
    @classmethod
    def default(cls, backend_type: StorageBackendType = StorageBackendType.SQLITE) -> 'StorageConfig':
        """创建默认配置"""
        config_data = {'backend_type': backend_type.value}
        
        if backend_type == StorageBackendType.SQLITE:
            config_data['sqlite'] = {
                'database_path': './storage/zishu_storage.db',
                'timeout': 30.0,
                'check_same_thread': False
            }
        elif backend_type == StorageBackendType.POSTGRESQL:
            config_data['postgresql'] = {
                'host': 'localhost',
                'port': 5432,
                'database': 'zishu_storage',
                'username': 'zishu',
                'password': 'password',
                'pool_size': 10,
                'ssl_mode': 'prefer'
            }
        elif backend_type == StorageBackendType.REDIS:
            config_data['redis'] = {
                'host': 'localhost',
                'port': 6379,
                'database': 0,
                'max_connections': 100,
                'decode_responses': True
            }
        elif backend_type == StorageBackendType.MONGODB:
            config_data['mongodb'] = {
                'host': 'localhost',
                'port': 27017,
                'database': 'zishu_storage',
                'max_pool_size': 100
            }
        
        return cls(config_data)
    
    def get_backend_type(self) -> StorageBackendType:
        """获取后端类型"""
        backend_type = self._config.get('backend_type')
        if not backend_type:
            raise StorageConfigError("Backend type not specified in configuration")
        
        try:
            return StorageBackendType(backend_type)
        except ValueError:
            raise StorageConfigError(f"Invalid backend type: {backend_type}")
    
    def get_backend_config(self, backend_type: StorageBackendType = None) -> Dict[str, Any]:
        """获取特定后端的配置"""
        if backend_type is None:
            backend_type = self.get_backend_type()
        
        backend_key = backend_type.value.lower()
        backend_config = self._config.get(backend_key, {})
        
        if not backend_config:
            logger.warning(f"No configuration found for backend type: {backend_type.value}")
        
        return backend_config
    
    def get_all_configs(self) -> Dict[str, Any]:
        """获取所有配置"""
        return self._config.copy()
    
    def update_config(self, updates: Dict[str, Any]):
        """更新配置"""
        self._config.update(updates)
        self._validate_config()
    
    def save_to_file(self, config_path: Union[str, Path], format: str = 'yaml'):
        """保存配置到文件"""
        config_path = Path(config_path)
        config_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            with open(config_path, 'w', encoding='utf-8') as f:
                if format.lower() in ['yml', 'yaml']:
                    yaml.dump(self._config, f, default_flow_style=False, indent=2)
                elif format.lower() == 'json':
                    json.dump(self._config, f, indent=2, ensure_ascii=False)
                else:
                    raise StorageConfigError(f"Unsupported format: {format}")
            
            logger.info(f"Configuration saved to {config_path}")
            
        except Exception as e:
            raise StorageConfigError(f"Failed to save configuration to {config_path}: {e}")


class StorageFactory:
    """存储后端工厂"""
    
    # 注册的后端类型
    _backends: Dict[StorageBackendType, Type[IStorageBackend]] = {
        StorageBackendType.SQLITE: SQLiteStorageBackend,
        StorageBackendType.POSTGRESQL: PostgreSQLStorageBackend,
        StorageBackendType.REDIS: RedisStorageBackend,
        StorageBackendType.MONGODB: MongoDBStorageBackend,
    }
    
    # 实例缓存
    _instances: Dict[str, IStorageBackend] = {}
    
    @classmethod
    def register_backend(cls, backend_type: StorageBackendType, 
                        backend_class: Type[IStorageBackend]):
        """注册新的存储后端类型"""
        cls._backends[backend_type] = backend_class
        logger.info(f"Registered storage backend: {backend_type.value}")
    
    @classmethod
    def get_available_backends(cls) -> Dict[StorageBackendType, Type[IStorageBackend]]:
        """获取可用的存储后端"""
        return cls._backends.copy()
    
    @classmethod
    def create_backend(cls, config: StorageConfig, 
                      instance_name: str = "default") -> IStorageBackend:
        """创建存储后端实例"""
        backend_type = config.get_backend_type()
        
        if backend_type not in cls._backends:
            raise StorageConfigError(f"Unsupported backend type: {backend_type.value}")
        
        # 检查是否已有实例
        cache_key = f"{backend_type.value}_{instance_name}"
        if cache_key in cls._instances:
            logger.debug(f"Returning cached storage backend instance: {cache_key}")
            return cls._instances[cache_key]
        
        # 创建新实例
        backend_class = cls._backends[backend_type]
        backend_instance = backend_class()
        
        # 缓存实例
        cls._instances[cache_key] = backend_instance
        
        logger.info(f"Created storage backend instance: {backend_type.value} ({instance_name})")
        return backend_instance
    
    @classmethod
    async def create_and_connect(cls, config: StorageConfig, 
                               instance_name: str = "default") -> IStorageBackend:
        """创建并连接存储后端"""
        backend = cls.create_backend(config, instance_name)
        
        # 获取后端配置
        backend_config = config.get_backend_config()
        
        # 连接到后端
        success = await backend.connect(backend_config)
        if not success:
            raise StorageException(f"Failed to connect to storage backend: {config.get_backend_type().value}")
        
        logger.info(f"Successfully connected to storage backend: {config.get_backend_type().value}")
        return backend
    
    @classmethod
    def get_instance(cls, backend_type: StorageBackendType, 
                    instance_name: str = "default") -> Optional[IStorageBackend]:
        """获取已创建的实例"""
        cache_key = f"{backend_type.value}_{instance_name}"
        return cls._instances.get(cache_key)
    
    @classmethod
    async def close_instance(cls, backend_type: StorageBackendType, 
                           instance_name: str = "default") -> bool:
        """关闭并移除实例"""
        cache_key = f"{backend_type.value}_{instance_name}"
        
        if cache_key in cls._instances:
            backend = cls._instances[cache_key]
            try:
                await backend.disconnect()
                del cls._instances[cache_key]
                logger.info(f"Closed storage backend instance: {cache_key}")
                return True
            except Exception as e:
                logger.error(f"Failed to close storage backend instance {cache_key}: {e}")
                return False
        
        return True
    
    @classmethod
    async def close_all_instances(cls) -> bool:
        """关闭所有实例"""
        success = True
        
        for cache_key, backend in list(cls._instances.items()):
            try:
                await backend.disconnect()
                logger.info(f"Closed storage backend instance: {cache_key}")
            except Exception as e:
                logger.error(f"Failed to close storage backend instance {cache_key}: {e}")
                success = False
        
        cls._instances.clear()
        return success
    
    @classmethod
    def clear_cache(cls):
        """清空实例缓存（不关闭连接）"""
        cls._instances.clear()
        logger.info("Cleared storage backend instance cache")


class StorageManager:
    """存储管理器 - 高级存储管理功能"""
    
    def __init__(self, config: StorageConfig):
        self.config = config
        self.backend: Optional[IStorageBackend] = None
        self._connected = False
    
    async def initialize(self, instance_name: str = "default") -> bool:
        """初始化存储管理器"""
        try:
            self.backend = await StorageFactory.create_and_connect(
                self.config, instance_name
            )
            self._connected = True
            return True
        except Exception as e:
            logger.error(f"Failed to initialize storage manager: {e}")
            return False
    
    async def shutdown(self) -> bool:
        """关闭存储管理器"""
        if self.backend:
            try:
                await self.backend.disconnect()
                self._connected = False
                return True
            except Exception as e:
                logger.error(f"Failed to shutdown storage manager: {e}")
                return False
        return True
    
    @property
    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self._connected and self.backend and self.backend.is_connected
    
    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        if not self.backend:
            return {"status": "error", "error": "Backend not initialized"}
        
        try:
            return await self.backend.health_check()
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    async def get_backend_info(self) -> Dict[str, Any]:
        """获取后端信息"""
        if not self.backend:
            return {"error": "Backend not initialized"}
        
        return {
            "backend_type": self.backend.backend_type.value,
            "is_connected": self.backend.is_connected,
            "config": self.config.get_backend_config()
        }
    
    async def migrate_data(self, target_config: StorageConfig, 
                          collections: List[str] = None) -> bool:
        """数据迁移到另一个存储后端"""
        if not self.backend:
            logger.error("Source backend not initialized")
            return False
        
        try:
            # 创建目标后端
            target_backend = await StorageFactory.create_and_connect(target_config, "migration_target")
            
            # 如果没有指定集合，尝试获取所有集合
            if collections is None:
                # 这里需要根据具体后端实现获取集合列表的方法
                collections = ["default"]  # 默认集合
            
            # 执行数据迁移
            for collection in collections:
                logger.info(f"Migrating collection: {collection}")
                
                # 从源后端读取所有数据
                from .interfaces import StorageQuery
                result = await self.backend.list(collection, StorageQuery(filters={}))
                
                if not result.success:
                    logger.error(f"Failed to read from source collection {collection}: {result.error}")
                    continue
                
                # 批量写入目标后端
                if result.data:
                    batch_result = await target_backend.batch_create(collection, result.data)
                    if not batch_result.success:
                        logger.error(f"Failed to write to target collection {collection}: {batch_result.error}")
                        continue
                
                logger.info(f"Migrated {len(result.data)} records from collection {collection}")
            
            # 关闭目标后端
            await target_backend.disconnect()
            
            logger.info("Data migration completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Data migration failed: {e}")
            return False
    
    async def backup_data(self, backup_path: str, collections: List[str] = None) -> bool:
        """备份数据"""
        if not self.backend:
            logger.error("Backend not initialized")
            return False
        
        try:
            backup_data = {}
            
            # 如果没有指定集合，使用默认集合
            if collections is None:
                collections = ["default"]
            
            # 备份每个集合的数据
            for collection in collections:
                from .interfaces import StorageQuery
                result = await self.backend.list(collection, StorageQuery(filters={}))
                
                if result.success:
                    backup_data[collection] = result.data
                else:
                    logger.error(f"Failed to backup collection {collection}: {result.error}")
            
            # 保存备份文件
            backup_path = Path(backup_path)
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(backup_path, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, indent=2, ensure_ascii=False, default=str)
            
            logger.info(f"Data backup saved to {backup_path}")
            return True
            
        except Exception as e:
            logger.error(f"Data backup failed: {e}")
            return False
    
    async def restore_data(self, backup_path: str) -> bool:
        """恢复数据"""
        if not self.backend:
            logger.error("Backend not initialized")
            return False
        
        try:
            backup_path = Path(backup_path)
            if not backup_path.exists():
                logger.error(f"Backup file not found: {backup_path}")
                return False
            
            # 加载备份数据
            with open(backup_path, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)
            
            # 恢复每个集合的数据
            for collection, data in backup_data.items():
                if data:
                    result = await self.backend.batch_create(collection, data)
                    if not result.success:
                        logger.error(f"Failed to restore collection {collection}: {result.error}")
                    else:
                        logger.info(f"Restored {len(data)} records to collection {collection}")
            
            logger.info("Data restoration completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Data restoration failed: {e}")
            return False
