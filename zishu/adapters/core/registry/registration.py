"""
适配器注册服务

负责适配器的注册和注销操作。
"""

import asyncio
import logging
import inspect
from typing import Dict, Optional, Type, Any
from datetime import datetime, timezone

from ..types import (
    AdapterRegistration,
    AdapterIdentity,
    AdapterConfiguration,
    AdapterStatus,
    LifecycleState,
    EventType,
    Event,
    Priority,
    create_adapter_configuration,
)

logger = logging.getLogger(__name__)


class RegistrationService:
    """
    适配器注册服务

    负责处理适配器的注册和注销操作，包括：
    - 验证适配器类和配置
    - 创建适配器实例
    - 管理注册状态
    - 处理注册事件
    """

    def __init__(self, registry_core):
        """初始化注册服务"""
        self._registry_core = registry_core
        self._lock = asyncio.Lock()
        self._is_initialized = False
        self._is_running = False

        logger.info("RegistrationService initialized")

    async def initialize(self) -> None:
        """初始化服务"""
        if self._is_initialized:
            return

        async with self._lock:
            if self._is_initialized:
                return

            self._is_initialized = True
            logger.info("RegistrationService initialized successfully")

    async def start(self) -> None:
        """启动服务"""
        if not self._is_initialized:
            await self.initialize()

        if self._is_running:
            return

        async with self._lock:
            if self._is_running:
                return

            self._is_running = True
            logger.info("RegistrationService started successfully")

    async def stop(self) -> None:
        """停止服务"""
        if not self._is_running:
            return

        async with self._lock:
            if not self._is_running:
                return

            self._is_running = False
            logger.info("RegistrationService stopped successfully")

    async def register_adapter(
        self,
        identity: AdapterIdentity,
        adapter_class: Type,
        configuration: Optional[AdapterConfiguration] = None,
    ) -> AdapterRegistration:
        """
        注册适配器

        Args:
            identity: 适配器身份信息
            adapter_class: 适配器类
            configuration: 适配器配置

        Returns:
            AdapterRegistration: 注册信息

        Raises:
            ValueError: 参数无效
            RuntimeError: 注册失败
        """
        if not self._is_running:
            raise RuntimeError("Registration service is not running")

        # 验证参数
        if not identity:
            raise ValueError("Identity is required")
        if not adapter_class:
            raise ValueError("Adapter class is required")

        adapter_id = identity.adapter_id

        # 检查是否已存在
        if self._registry_core.has_adapter(adapter_id):
            raise ValueError(f"Adapter {adapter_id} already exists")

        # 创建配置
        if configuration is None:
            configuration = create_adapter_configuration()

        # 验证适配器类
        await self._validate_adapter_class(adapter_class)

        # 创建注册信息
        registration = AdapterRegistration(
            identity=identity,
            adapter_class=adapter_class,
            configuration=configuration,
            status=AdapterStatus.REGISTERED,
            lifecycle_state=LifecycleState.CREATED,
        )

        try:
            # 创建适配器实例（如果不是抽象类）
            if not inspect.isabstract(adapter_class):
                instance = await self._create_adapter_instance(
                    adapter_class, configuration
                )
                registration.instance = instance
                registration.lifecycle_state = LifecycleState.INITIALIZED
            else:
                logger.warning(
                    f"Skipping instance creation for abstract class {adapter_class.__name__}"
                )

            # 添加到注册表
            self._registry_core._add_registration(registration)

            logger.info(f"Adapter {adapter_id} registered successfully")

            # 发送注册事件
            await self._registry_core._emit_event(
                Event(
                    event_type=EventType.ADAPTER_REGISTERED,
                    source="registration_service",
                    data={
                        "adapter_id": adapter_id,
                        "name": identity.name,
                        "adapter_type": identity.adapter_type.value,
                        "status": registration.status.value,
                    },
                    priority=Priority.MEDIUM,
                )
            )

            return registration

        except Exception as e:
            logger.error(f"Failed to register adapter {adapter_id}: {e}")
            raise RuntimeError(f"Registration failed: {e}") from e

    async def unregister_adapter(self, adapter_id: str) -> bool:
        """
        注销适配器

        Args:
            adapter_id: 适配器ID

        Returns:
            bool: 是否成功注销
        """
        if not self._is_running:
            raise RuntimeError("Registration service is not running")

        if not adapter_id:
            raise ValueError("Adapter ID is required")

        # 获取注册信息
        registration = self._registry_core.get_adapter(adapter_id)
        if not registration:
            logger.warning(f"Adapter {adapter_id} not found for unregistration")
            return False

        try:
            # 更新状态
            registration.status = AdapterStatus.STOPPED
            registration.lifecycle_state = LifecycleState.DESTROYING
            registration.stopped_at = datetime.now(timezone.utc)

            # 清理适配器实例
            if registration.instance:
                await self._cleanup_adapter_instance(registration.instance)
                registration.instance = None

            # 从注册表移除
            self._registry_core._remove_registration(adapter_id)

            logger.info(f"Adapter {adapter_id} unregistered successfully")

            # 发送注销事件
            await self._registry_core._emit_event(
                Event(
                    event_type=EventType.ADAPTER_UNREGISTERED,
                    source="registration_service",
                    data={
                        "adapter_id": adapter_id,
                        "name": registration.name,
                        "adapter_type": registration.adapter_type.value,
                    },
                    priority=Priority.MEDIUM,
                )
            )

            return True

        except Exception as e:
            logger.error(f"Failed to unregister adapter {adapter_id}: {e}")
            return False

    async def _validate_adapter_class(self, adapter_class: Type) -> None:
        """验证适配器类"""
        if not inspect.isclass(adapter_class):
            raise ValueError("Adapter class must be a class")

        # 检查是否继承自BaseAdapter（如果BaseAdapter存在）
        try:
            from ...base.adapter import BaseAdapter

            if not issubclass(adapter_class, BaseAdapter):
                raise ValueError("Adapter class must inherit from BaseAdapter")
        except ImportError:
            # BaseAdapter不存在时跳过检查
            pass

        # 检查必需的方法
        required_methods = ["initialize", "process", "cleanup"]
        for method_name in required_methods:
            if not hasattr(adapter_class, method_name):
                logger.warning(f"Adapter class missing method: {method_name}")

    async def _create_adapter_instance(
        self, adapter_class: Type, configuration: AdapterConfiguration
    ) -> Any:
        """创建适配器实例"""
        try:
            # 创建实例
            if asyncio.iscoroutinefunction(adapter_class.__init__):
                instance = await adapter_class(configuration.config)
            else:
                instance = adapter_class(configuration.config)

            # 初始化实例
            if hasattr(instance, "initialize"):
                if asyncio.iscoroutinefunction(instance.initialize):
                    await instance.initialize()
                else:
                    instance.initialize()

            return instance

        except Exception as e:
            logger.error(f"Failed to create adapter instance: {e}")
            raise

    async def _cleanup_adapter_instance(self, instance: Any) -> None:
        """清理适配器实例"""
        try:
            if hasattr(instance, "cleanup"):
                if asyncio.iscoroutinefunction(instance.cleanup):
                    await instance.cleanup()
                else:
                    instance.cleanup()
        except Exception as e:
            logger.error(f"Failed to cleanup adapter instance: {e}")

    @property
    def is_running(self) -> bool:
        """是否正在运行"""
        return self._is_running

    @property
    def is_initialized(self) -> bool:
        """是否已初始化"""
        return self._is_initialized
