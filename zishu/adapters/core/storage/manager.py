"""
存储管理器
统一管理存储后端和适配器存储
"""

import asyncio
from typing import Any, Dict, List, Optional, Type
from datetime import datetime
import logging

from .interfaces import (
    IStorageBackend,
    IAdapterStorage,
    StorageBackendType,
    StorageException,
    NotFoundError,
)
from .backends import MemoryStorageBackend, FileStorageBackend
from .adapter_storage import AdapterStorage


class StorageManager:
    """存储管理器"""

    # 后端类型映射
    BACKEND_CLASSES = {
        StorageBackendType.MEMORY: MemoryStorageBackend,
        StorageBackendType.FILE: FileStorageBackend,
    }

    def __init__(self):
        self._backends: Dict[str, IStorageBackend] = {}
        self._adapter_storages: Dict[str, IAdapterStorage] = {}
        self._default_backend: Optional[str] = None
        self._logger = logging.getLogger(__name__)
        self._initialized = False

    @property
    def is_initialized(self) -> bool:
        """是否已初始化"""
        return self._initialized

    @property
    def default_backend(self) -> Optional[IStorageBackend]:
        """默认后端"""
        if self._default_backend and self._default_backend in self._backends:
            return self._backends[self._default_backend]
        return None

    @property
    def default_adapter_storage(self) -> Optional[IAdapterStorage]:
        """默认适配器存储"""
        if self._default_backend and self._default_backend in self._adapter_storages:
            return self._adapter_storages[self._default_backend]
        return None

    async def initialize(self, config: Dict[str, Any]) -> bool:
        """初始化存储管理器"""
        try:
            self._logger.info("Initializing storage manager...")

            # 获取配置
            backends_config = config.get("backends", {})
            default_backend = config.get("default_backend", "memory")

            # 如果没有配置后端，使用默认内存后端
            if not backends_config:
                backends_config = {"memory": {"type": "memory", "config": {}}}

            # 初始化后端
            for backend_name, backend_config in backends_config.items():
                success = await self._initialize_backend(backend_name, backend_config)
                if not success:
                    self._logger.error(f"Failed to initialize backend: {backend_name}")
                    return False

            # 设置默认后端
            if default_backend in self._backends:
                self._default_backend = default_backend
                self._logger.info(f"Set default backend to: {default_backend}")
            else:
                # 如果指定的默认后端不存在，使用第一个可用的后端
                if self._backends:
                    self._default_backend = list(self._backends.keys())[0]
                    self._logger.warning(
                        f"Default backend '{default_backend}' not found, "
                        f"using '{self._default_backend}' instead"
                    )
                else:
                    self._logger.error("No backends available")
                    return False

            self._initialized = True
            self._logger.info("Storage manager initialized successfully")
            return True

        except Exception as e:
            self._logger.error(f"Failed to initialize storage manager: {e}")
            return False

    async def _initialize_backend(self, name: str, config: Dict[str, Any]) -> bool:
        """初始化后端"""
        try:
            backend_type_str = config.get("type", "memory")
            backend_config = config.get("config", {})

            # 获取后端类型
            try:
                backend_type = StorageBackendType(backend_type_str)
            except ValueError:
                self._logger.error(f"Unknown backend type: {backend_type_str}")
                return False

            # 获取后端类
            backend_class = self.BACKEND_CLASSES.get(backend_type)
            if not backend_class:
                self._logger.error(f"Backend class not found for type: {backend_type}")
                return False

            # 创建后端实例
            backend = backend_class()

            # 连接后端
            success = await backend.connect(backend_config)
            if not success:
                self._logger.error(f"Failed to connect backend: {name}")
                return False

            # 健康检查
            health = await backend.health_check()
            if health.get("status") != "healthy":
                self._logger.warning(f"Backend {name} health check failed: {health}")

            # 保存后端
            self._backends[name] = backend

            # 创建适配器存储
            adapter_storage = AdapterStorage(backend)
            await adapter_storage.initialize()
            self._adapter_storages[name] = adapter_storage

            self._logger.info(
                f"Backend '{name}' ({backend_type_str}) initialized successfully"
            )
            return True

        except Exception as e:
            self._logger.error(f"Failed to initialize backend '{name}': {e}")
            return False

    async def shutdown(self) -> bool:
        """关闭存储管理器"""
        try:
            self._logger.info("Shutting down storage manager...")

            # 断开所有后端连接
            for name, backend in self._backends.items():
                try:
                    await backend.disconnect()
                    self._logger.info(f"Backend '{name}' disconnected")
                except Exception as e:
                    self._logger.error(f"Failed to disconnect backend '{name}': {e}")

            # 清理
            self._backends.clear()
            self._adapter_storages.clear()
            self._default_backend = None
            self._initialized = False

            self._logger.info("Storage manager shut down successfully")
            return True

        except Exception as e:
            self._logger.error(f"Failed to shutdown storage manager: {e}")
            return False

    def get_backend(self, name: Optional[str] = None) -> Optional[IStorageBackend]:
        """获取后端"""
        if name is None:
            return self.default_backend
        return self._backends.get(name)

    def get_adapter_storage(
        self, backend_name: Optional[str] = None
    ) -> Optional[IAdapterStorage]:
        """获取适配器存储"""
        if backend_name is None:
            return self.default_adapter_storage
        return self._adapter_storages.get(backend_name)

    def list_backends(self) -> List[str]:
        """列出所有后端名称"""
        return list(self._backends.keys())

    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        try:
            backends_health = {}
            overall_status = "healthy"

            for name, backend in self._backends.items():
                try:
                    health = await backend.health_check()
                    backends_health[name] = health

                    if health.get("status") != "healthy":
                        overall_status = "degraded"

                except Exception as e:
                    backends_health[name] = {"status": "error", "error": str(e)}
                    overall_status = "unhealthy"

            return {
                "status": overall_status,
                "initialized": self._initialized,
                "default_backend": self._default_backend,
                "backends_count": len(self._backends),
                "backends": backends_health,
                "timestamp": datetime.utcnow().isoformat(),
            }

        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def create_backend(
        self, name: str, backend_type: StorageBackendType, config: Dict[str, Any]
    ) -> bool:
        """动态创建后端"""
        try:
            if name in self._backends:
                raise StorageException(f"Backend '{name}' already exists")

            backend_config = {"type": backend_type.value, "config": config}

            return await self._initialize_backend(name, backend_config)

        except Exception as e:
            self._logger.error(f"Failed to create backend '{name}': {e}")
            return False

    async def remove_backend(self, name: str) -> bool:
        """移除后端"""
        try:
            if name not in self._backends:
                return False

            # 不能移除默认后端
            if name == self._default_backend:
                raise StorageException("Cannot remove default backend")

            # 断开连接
            backend = self._backends[name]
            await backend.disconnect()

            # 移除
            del self._backends[name]
            if name in self._adapter_storages:
                del self._adapter_storages[name]

            self._logger.info(f"Backend '{name}' removed")
            return True

        except Exception as e:
            self._logger.error(f"Failed to remove backend '{name}': {e}")
            return False

    async def set_default_backend(self, name: str) -> bool:
        """设置默认后端"""
        try:
            if name not in self._backends:
                return False

            self._default_backend = name
            self._logger.info(f"Default backend changed to: {name}")
            return True

        except Exception as e:
            self._logger.error(f"Failed to set default backend to '{name}': {e}")
            return False

    async def migrate_data(
        self,
        source_backend: str,
        target_backend: str,
        collections: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """数据迁移"""
        try:
            source = self._backends.get(source_backend)
            target = self._backends.get(target_backend)

            if not source or not target:
                raise StorageException("Source or target backend not found")

            if source == target:
                raise StorageException("Source and target backends are the same")

            migration_stats = {
                "collections_migrated": 0,
                "records_migrated": 0,
                "errors": [],
            }

            # 如果没有指定集合，需要获取所有集合
            # 这里简化处理，假设已知集合名称
            if collections is None:
                collections = [
                    "adapter_registrations",
                    "adapter_configurations",
                    "adapter_states",
                    "adapter_metrics",
                ]

            for collection in collections:
                try:
                    # 获取源数据
                    result = await source.list(collection)
                    if not result.success:
                        migration_stats["errors"].append(
                            f"Failed to read collection '{collection}': {result.error}"
                        )
                        continue

                    records = result.data or []

                    # 批量写入目标
                    if records:
                        batch_result = await target.batch_create(collection, records)
                        if batch_result.success:
                            migration_stats["records_migrated"] += len(records)
                        else:
                            migration_stats["errors"].append(
                                f"Failed to migrate collection '{collection}': {batch_result.error}"
                            )
                            continue

                    migration_stats["collections_migrated"] += 1

                except Exception as e:
                    migration_stats["errors"].append(
                        f"Error migrating collection '{collection}': {e}"
                    )

            return migration_stats

        except Exception as e:
            return {
                "collections_migrated": 0,
                "records_migrated": 0,
                "errors": [str(e)],
            }

    async def backup_data(
        self, backend_name: Optional[str] = None, backup_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """备份数据"""
        try:
            backend = self.get_backend(backend_name)
            if not backend:
                raise StorageException("Backend not found")

            if backup_path is None:
                backup_path = (
                    f"backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
                )

            backup_data = {
                "metadata": {
                    "backend_type": backend.backend_type.value,
                    "backup_time": datetime.utcnow().isoformat(),
                    "version": "1.0",
                },
                "collections": {},
            }

            # 备份已知集合
            collections = [
                "adapter_registrations",
                "adapter_configurations",
                "adapter_states",
                "adapter_metrics",
            ]

            for collection in collections:
                try:
                    result = await backend.list(collection)
                    if result.success:
                        backup_data["collections"][collection] = result.data or []
                except Exception as e:
                    self._logger.warning(
                        f"Failed to backup collection '{collection}': {e}"
                    )

            # 写入备份文件
            import json

            with open(backup_path, "w", encoding="utf-8") as f:
                json.dump(backup_data, f, indent=2, ensure_ascii=False)

            return {
                "success": True,
                "backup_path": backup_path,
                "collections_count": len(backup_data["collections"]),
                "total_records": sum(
                    len(records) for records in backup_data["collections"].values()
                ),
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    async def restore_data(
        self,
        backup_path: str,
        backend_name: Optional[str] = None,
        overwrite: bool = False,
    ) -> Dict[str, Any]:
        """恢复数据"""
        try:
            backend = self.get_backend(backend_name)
            if not backend:
                raise StorageException("Backend not found")

            # 读取备份文件
            import json

            with open(backup_path, "r", encoding="utf-8") as f:
                backup_data = json.load(f)

            collections = backup_data.get("collections", {})
            restore_stats = {
                "collections_restored": 0,
                "records_restored": 0,
                "errors": [],
            }

            for collection, records in collections.items():
                try:
                    if not records:
                        continue

                    if overwrite:
                        # 清空现有数据（如果支持）
                        try:
                            existing_result = await backend.list(collection)
                            if existing_result.success and existing_result.data:
                                keys_to_delete = [
                                    record.get("_key") or record.get("id")
                                    for record in existing_result.data
                                ]
                                keys_to_delete = [k for k in keys_to_delete if k]
                                if keys_to_delete:
                                    await backend.batch_delete(
                                        collection, keys_to_delete
                                    )
                        except Exception:
                            pass  # 忽略清空错误

                    # 恢复数据
                    batch_result = await backend.batch_create(collection, records)
                    if batch_result.success:
                        restore_stats["records_restored"] += len(records)
                        restore_stats["collections_restored"] += 1
                    else:
                        restore_stats["errors"].append(
                            f"Failed to restore collection '{collection}': {batch_result.error}"
                        )

                except Exception as e:
                    restore_stats["errors"].append(
                        f"Error restoring collection '{collection}': {e}"
                    )

            return restore_stats

        except Exception as e:
            return {
                "collections_restored": 0,
                "records_restored": 0,
                "errors": [str(e)],
            }


# 全局存储管理器实例
_storage_manager: Optional[StorageManager] = None


def get_storage_manager() -> StorageManager:
    """获取全局存储管理器实例"""
    global _storage_manager
    if _storage_manager is None:
        _storage_manager = StorageManager()
    return _storage_manager


async def initialize_storage(config: Dict[str, Any]) -> bool:
    """初始化全局存储"""
    manager = get_storage_manager()
    return await manager.initialize(config)


async def shutdown_storage() -> bool:
    """关闭全局存储"""
    global _storage_manager
    if _storage_manager:
        result = await _storage_manager.shutdown()
        _storage_manager = None
        return result
    return True
