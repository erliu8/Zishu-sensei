"""
适配器注册服务

基于新架构的适配器注册和管理服务。
"""

import asyncio
import logging
from typing import Dict, List, Optional, Type, Any, Set
from datetime import datetime, timezone

from .base import AsyncService, ServiceStatus, ServiceHealth, HealthCheckResult, ServiceMetrics
from ..types import (
    AdapterRegistration,
    AdapterIdentity,
    AdapterConfiguration,
    AdapterStatus,
    LifecycleState,
    EventType,
    Event,
    Priority,
    AdapterType,
)
from ..events import EventBus

logger = logging.getLogger(__name__)


class AdapterRegistryService(AsyncService):
    """
    适配器注册服务

    负责：
    - 适配器注册和注销
    - 适配器发现和查询
    - 注册状态管理
    - 注册事件发布
    """

    def __init__(
        self,
        event_bus: Optional[EventBus] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """初始化注册服务"""
        super().__init__("adapter_registry", config)

        self._event_bus = event_bus
        self._registrations: Dict[str, AdapterRegistration] = {}
        self._adapters_by_type: Dict[str, Set[str]] = {}
        self._adapters_by_category: Dict[str, Set[str]] = {}
        self._registration_lock = asyncio.Lock()

        # 配置参数
        self._max_registrations = self.config.get("max_registrations", 1000)
        self._enable_validation = self.config.get("enable_validation", True)
        self._auto_cleanup = self.config.get("auto_cleanup", True)
        self._cleanup_interval = self.config.get("cleanup_interval", 300)  # 5分钟

        # 清理任务
        self._cleanup_task: Optional[asyncio.Task] = None

        logger.info(f"AdapterRegistryService initialized with config: {self.config}")

    async def _initialize_impl(self) -> None:
        """初始化实现"""
        logger.info("Initializing adapter registry service...")

        # 初始化内部数据结构
        self._registrations.clear()
        self._adapters_by_type.clear()
        self._adapters_by_category.clear()

        logger.info("Adapter registry service initialized")

    async def _start_impl(self) -> None:
        """启动实现"""
        logger.info("Starting adapter registry service...")

        # 启动自动清理任务
        if self._auto_cleanup:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        # 发送服务启动事件
        if self._event_bus:
            await self._event_bus.emit(
                Event(
                    event_type=EventType.SERVICE_STARTED,
                    source="adapter_registry_service",
                    data={
                        "service": "adapter_registry",
                        "timestamp": datetime.now(timezone.utc),
                    },
                )
            )

        logger.info("Adapter registry service started")

    async def _stop_impl(self) -> None:
        """停止实现"""
        logger.info("Stopping adapter registry service...")

        # 停止清理任务
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        # 发送服务停止事件
        if self._event_bus:
            await self._event_bus.emit(
                Event(
                    event_type=EventType.SERVICE_STOPPED,
                    source="adapter_registry_service",
                    data={
                        "service": "adapter_registry",
                        "timestamp": datetime.now(timezone.utc),
                    },
                )
            )

        logger.info("Adapter registry service stopped")

    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查实现"""
        try:
            # 检查基本状态
            if not self.is_running:
                return HealthCheckResult(
                    is_healthy=False,
                    service_name="adapter_registry",
                    message="Service is not running",
                )

            # 检查注册数量
            registration_count = len(self._registrations)
            if registration_count > self._max_registrations:
                return HealthCheckResult(
                    is_healthy=False,
                    service_name="adapter_registry",
                    message=f"Too many registrations: {registration_count}/{self._max_registrations}",
                )

            # 检查内存使用
            memory_usage = self._estimate_memory_usage()
            max_memory = self.config.get("max_memory_mb", 100) * 1024 * 1024  # 默认100MB

            if memory_usage > max_memory:
                return HealthCheckResult(
                    is_healthy=False,
                    service_name="adapter_registry",
                    message=f"High memory usage: {memory_usage / 1024 / 1024:.1f}MB",
                )

            return HealthCheckResult(
                is_healthy=True,
                service_name="adapter_registry",
                message=f"Registry healthy with {registration_count} registrations",
                details={
                    "registration_count": registration_count,
                    "registrations_count": registration_count,
                    "memory_usage_mb": memory_usage / 1024 / 1024,
                    "types_count": len(self._adapters_by_type),
                    "categories_count": len(self._adapters_by_category),
                },
            )

        except Exception as e:
            return HealthCheckResult(
                is_healthy=False,
                service_name="adapter_registry",
                message=f"Health check failed: {str(e)}",
            )

    async def register_adapter(self, config: AdapterConfiguration) -> bool:
        """注册适配器"""
        try:
            # 检查服务是否正在运行
            if not self.is_running:
                raise RuntimeError(
                    f"Service '{self.name}' is not running (current status: {self._status})"
                )
            
            async with self._registration_lock:
                # 检查是否已注册
                if config.identity in self._registrations:
                    logger.warning(f"Adapter '{config.identity}' already registered")
                    return False

                # 检查注册数量限制
                if len(self._registrations) >= self._max_registrations:
                    raise RuntimeError(
                        f"Maximum registrations limit reached: {self._max_registrations}"
                    )

                # 验证配置信息
                if self._enable_validation:
                    await self._validate_configuration(config)

                # 创建注册信息
                registration = AdapterRegistration(
                    identity=AdapterIdentity(
                        adapter_id=config.identity,
                        name=config.name or config.identity,
                        version=config.version or "1.0.0",
                        adapter_type=config.adapter_type or AdapterType.SOFT,
                        description=config.description,
                        author=config.author,
                        tags=set(config.tags or []),
                    ),
                    adapter_class=config.adapter_class,
                    configuration=config,
                )

                # 执行注册
                self._registrations[config.identity] = registration

                # 更新索引
                self._update_indexes(registration, add=True)

                # 更新指标
                self._metrics.request_count += 1
                self._metrics.last_activity = datetime.now(timezone.utc)

                logger.info(f"Adapter '{config.identity}' registered successfully")

                # 发送注册事件
                if self._event_bus:
                    await self._event_bus.emit(
                        Event(
                            event_type=EventType.ADAPTER_REGISTERED,
                            source="adapter_registry_service",
                            data={
                                "adapter_id": config.identity,
                                "adapter_type": registration.identity.adapter_type.value,
                                "timestamp": datetime.now(timezone.utc),
                            },
                        )
                    )

                return True

        except (ValueError, TypeError, AttributeError) as e:
            # 配置验证错误应该抛出异常
            logger.error(f"Invalid adapter configuration: {e}")
            raise
        except RuntimeError as e:
            # 运行时错误（如超出最大注册数）也应该抛出
            logger.error(f"Failed to register adapter '{getattr(config, 'identity', 'unknown')}': {e}")
            raise
        except Exception as e:
            # 其他错误返回False
            logger.error(f"Failed to register adapter '{getattr(config, 'identity', 'unknown')}': {e}")
            return False

    async def unregister_adapter(self, adapter_id: str) -> bool:
        """注销适配器"""
        try:
            async with self._registration_lock:
                if adapter_id not in self._registrations:
                    logger.warning(f"Adapter '{adapter_id}' not found")
                    return False

                registration = self._registrations[adapter_id]

                # 移除注册
                del self._registrations[adapter_id]

                # 更新索引
                self._update_indexes(registration, add=False)

                # 更新指标
                self._metrics.request_count += 1
                self._metrics.last_activity = datetime.now(timezone.utc)

                logger.info(f"Adapter '{adapter_id}' unregistered successfully")

                # 发送注销事件
                if self._event_bus:
                    await self._event_bus.emit(
                        Event(
                            event_type=EventType.ADAPTER_UNREGISTERED,
                            source="adapter_registry_service",
                            data={
                                "adapter_id": adapter_id,
                                "adapter_type": registration.identity.adapter_type.value,
                                "timestamp": datetime.now(timezone.utc),
                            },
                        )
                    )

                return True

        except Exception as e:
            logger.error(f"Failed to unregister adapter '{adapter_id}': {e}")
            return False

    async def get_adapter(self, adapter_id: str) -> Optional[AdapterRegistration]:
        """获取适配器注册信息"""
        self._metrics.request_count += 1
        return self._registrations.get(adapter_id)

    async def list_adapters(
        self,
        adapter_type: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[AdapterStatus] = None,
    ) -> List[AdapterRegistration]:
        """列出适配器"""
        self._metrics.request_count += 1

        # 获取候选适配器ID
        if adapter_type:
            candidate_ids = self._adapters_by_type.get(adapter_type, set())
        elif category:
            candidate_ids = self._adapters_by_category.get(category, set())
        else:
            candidate_ids = set(self._registrations.keys())

        # 过滤结果
        result = []
        for adapter_id in candidate_ids:
            registration = self._registrations.get(adapter_id)
            if registration:
                # 状态过滤
                if status and registration.status != status:
                    continue
                result.append(registration)

        return result

    async def find_adapters_by_capability(
        self, capability: str
    ) -> List[AdapterRegistration]:
        """根据能力查找适配器"""
        self._metrics.request_count += 1

        result = []
        for registration in self._registrations.values():
            # 检查配置中的能力列表
            capabilities = registration.configuration.capabilities
            if capability in capabilities:
                result.append(registration)

        return result

    async def find_adapters_by_type(
        self, adapter_type: str
    ) -> List[AdapterRegistration]:
        """根据类型查找适配器"""
        self._metrics.request_count += 1

        adapter_ids = self._adapters_by_type.get(adapter_type, set())
        result = []
        for adapter_id in adapter_ids:
            registration = self._registrations.get(adapter_id)
            if registration:
                result.append(registration)

        return result

    async def get_registration(self, adapter_id: str) -> Optional[AdapterRegistration]:
        """获取适配器注册信息 (别名方法，与get_adapter相同)"""
        return await self.get_adapter(adapter_id)

    async def find_adapters_by_tags(self, tags: List[str]) -> List[AdapterRegistration]:
        """根据标签查找适配器"""
        self._metrics.request_count += 1

        result = []
        for registration in self._registrations.values():
            # 检查配置中的标签列表
            adapter_tags = getattr(registration.configuration, 'tags', [])
            if not adapter_tags:
                continue
            
            # 检查是否有匹配的标签
            if any(tag in adapter_tags for tag in tags):
                result.append(registration)

        return result

    async def get_all_registrations(self) -> Dict[str, AdapterRegistration]:
        """获取所有适配器注册信息"""
        self._metrics.request_count += 1
        return dict(self._registrations)

    def get_metrics(self) -> ServiceMetrics:
        """获取服务指标 (方法形式)"""
        return self.metrics

    async def update_adapter_status(
        self, adapter_id: str, status: AdapterStatus
    ) -> bool:
        """更新适配器状态"""
        try:
            async with self._registration_lock:
                if adapter_id not in self._registrations:
                    logger.warning(f"Adapter '{adapter_id}' not found")
                    return False

                registration = self._registrations[adapter_id]
                old_status = registration.status
                registration.status = status

                # 更新时间戳（需要添加到AdapterRegistration）
                if hasattr(registration, "last_updated"):
                    registration.last_updated = datetime.now(timezone.utc)

                logger.info(
                    f"Adapter '{adapter_id}' status updated: {old_status} -> {status}"
                )

                # 发送状态变化事件
                if self._event_bus:
                    await self._event_bus.emit(
                        Event(
                            event_type=EventType.ADAPTER_UPDATED,  # 使用现有的事件类型
                            source="adapter_registry_service",
                            data={
                                "adapter_id": adapter_id,
                                "old_status": old_status.value,
                                "new_status": status.value,
                                "timestamp": datetime.now(timezone.utc),
                            },
                        )
                    )

                return True

        except Exception as e:
            logger.error(f"Failed to update adapter status '{adapter_id}': {e}")
            return False

    async def get_registry_stats(self) -> Dict[str, Any]:
        """获取注册表统计信息"""
        return {
            "total_registrations": len(self._registrations),
            "types_count": len(self._adapters_by_type),
            "categories_count": len(self._adapters_by_category),
            "status_distribution": self._get_status_distribution(),
            "memory_usage_mb": self._estimate_memory_usage() / 1024 / 1024,
            "service_uptime": self.metrics.uptime,
            "request_count": self.metrics.request_count,
            "error_count": self.metrics.error_count,
        }

    # 内部方法

    async def _validate_configuration(self, config: AdapterConfiguration) -> None:
        """验证配置信息"""
        # 验证身份信息
        if not config.identity:
            raise ValueError("Adapter identity cannot be empty")

        if not hasattr(config, "adapter_class") or not config.adapter_class:
            raise ValueError("Adapter class cannot be None")

        # 验证基本配置
        if not hasattr(config, "name") or not config.name:
            logger.warning(
                f"Adapter name not provided for {config.identity}, using identity as name"
            )

        # 可以添加更多验证逻辑
        logger.debug(f"Configuration validation passed for adapter: {config.identity}")

    def _update_indexes(
        self, registration: AdapterRegistration, add: bool = True
    ) -> None:
        """更新索引"""
        adapter_id = registration.identity.adapter_id
        adapter_type = registration.identity.adapter_type.value
        category = registration.configuration.get("category")

        if add:
            # 添加到类型索引
            if adapter_type not in self._adapters_by_type:
                self._adapters_by_type[adapter_type] = set()
            self._adapters_by_type[adapter_type].add(adapter_id)

            # 添加到分类索引
            if category:
                if category not in self._adapters_by_category:
                    self._adapters_by_category[category] = set()
                self._adapters_by_category[category].add(adapter_id)
        else:
            # 从类型索引移除
            if adapter_type in self._adapters_by_type:
                self._adapters_by_type[adapter_type].discard(adapter_id)
                if not self._adapters_by_type[adapter_type]:
                    del self._adapters_by_type[adapter_type]

            # 从分类索引移除
            if category and category in self._adapters_by_category:
                self._adapters_by_category[category].discard(adapter_id)
                if not self._adapters_by_category[category]:
                    del self._adapters_by_category[category]

    def _get_status_distribution(self) -> Dict[str, int]:
        """获取状态分布"""
        distribution = {}
        for registration in self._registrations.values():
            status = registration.status.value
            distribution[status] = distribution.get(status, 0) + 1
        return distribution

    def _estimate_memory_usage(self) -> int:
        """估算内存使用量（字节）"""
        # 简单的内存估算
        base_size = 1000  # 基础开销
        registration_size = 500  # 每个注册项的平均大小
        index_size = 100  # 每个索引项的平均大小

        total_size = base_size
        total_size += len(self._registrations) * registration_size
        total_size += (
            sum(len(adapters) for adapters in self._adapters_by_type.values())
            * index_size
        )
        total_size += (
            sum(len(adapters) for adapters in self._adapters_by_category.values())
            * index_size
        )

        return total_size

    async def _cleanup_loop(self) -> None:
        """清理循环"""
        logger.info("Starting registry cleanup loop")

        while self.is_running:
            try:
                await self._perform_cleanup()
                await asyncio.sleep(self._cleanup_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(self._cleanup_interval)

        logger.info("Registry cleanup loop stopped")

    async def _perform_cleanup(self) -> None:
        """执行清理操作"""
        # 清理过期或无效的注册
        expired_adapters = []
        current_time = datetime.now(timezone.utc)

        for adapter_id, registration in self._registrations.items():
            # 检查是否过期（如果有过期时间配置）
            if hasattr(registration, "expires_at") and registration.expires_at:
                if current_time > registration.expires_at:
                    expired_adapters.append(adapter_id)
                    continue

            # 检查是否长时间未活动
            max_inactive_time = self.config.get("max_inactive_time", 3600)  # 1小时
            if registration.last_updated:
                inactive_time = (
                    current_time - registration.last_updated
                ).total_seconds()
                if (
                    inactive_time > max_inactive_time
                    and registration.status == AdapterStatus.INACTIVE
                ):
                    expired_adapters.append(adapter_id)

        # 移除过期的适配器
        for adapter_id in expired_adapters:
            try:
                await self.unregister_adapter(adapter_id)
                logger.info(f"Cleaned up expired adapter: {adapter_id}")
            except Exception as e:
                logger.error(f"Failed to cleanup adapter '{adapter_id}': {e}")

        if expired_adapters:
            logger.info(
                f"Cleanup completed, removed {len(expired_adapters)} expired adapters"
            )
