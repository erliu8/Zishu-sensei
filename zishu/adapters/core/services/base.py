"""
异步服务基础设施

提供适配器系统中所有服务的基类和核心抽象。
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class ServiceStatus(str, Enum):
    """服务状态枚举"""

    CREATED = "created"  # 已创建
    INITIALIZING = "initializing"  # 初始化中
    READY = "ready"  # 就绪
    RUNNING = "running"  # 运行中
    PAUSED = "paused"  # 已暂停
    STOPPING = "stopping"  # 停止中
    STOPPED = "stopped"  # 已停止
    ERROR = "error"  # 错误状态
    FAILED = "failed"  # 失败状态


class ServiceHealth(str, Enum):
    """服务健康状态"""

    HEALTHY = "healthy"  # 健康
    DEGRADED = "degraded"  # 降级
    UNHEALTHY = "unhealthy"  # 不健康
    UNKNOWN = "unknown"  # 未知


@dataclass
class ServiceMetrics:
    """服务性能指标"""

    request_count: int = 0
    error_count: int = 0
    avg_response_time: float = 0.0
    memory_usage: int = 0
    cpu_usage: float = 0.0
    last_activity: Optional[datetime] = None
    uptime: float = 0.0
    custom_metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthCheckResult:
    """健康检查结果"""

    is_healthy: bool
    status: ServiceHealth
    message: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AsyncService(ABC):
    """
    异步服务基类

    所有适配器系统中的服务都应该继承此基类，提供：
    - 标准化的生命周期管理
    - 统一的健康检查接口
    - 异步初始化和清理
    - 性能指标收集
    - 错误处理和恢复
    """

    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None):
        """初始化服务"""
        self.name = name
        self.config = config or {}

        # 状态管理
        self._status = ServiceStatus.CREATED
        self._health = ServiceHealth.UNKNOWN
        self._lock = asyncio.Lock()

        # 性能指标
        self._metrics = ServiceMetrics()
        self._start_time: Optional[datetime] = None

        # 事件回调
        self._status_callbacks: List[
            Callable[[ServiceStatus, ServiceStatus], None]
        ] = []
        self._health_callbacks: List[
            Callable[[ServiceHealth, ServiceHealth], None]
        ] = []

        # 错误处理
        self._error_handlers: List[Callable[[Exception], None]] = []
        self._last_error: Optional[Exception] = None

        logger.info(f"Service '{self.name}' created with config: {self.config}")

    @property
    def status(self) -> ServiceStatus:
        """获取服务状态"""
        return self._status

    @property
    def health(self) -> ServiceHealth:
        """获取健康状态"""
        return self._health

    @property
    def metrics(self) -> ServiceMetrics:
        """获取性能指标"""
        if self._start_time:
            self._metrics.uptime = (
                datetime.now(timezone.utc) - self._start_time
            ).total_seconds()
        return self._metrics

    @property
    def is_running(self) -> bool:
        """检查服务是否正在运行"""
        return self._status == ServiceStatus.RUNNING

    @property
    def is_healthy(self) -> bool:
        """检查服务是否健康"""
        return self._health == ServiceHealth.HEALTHY

    async def initialize(self) -> None:
        """初始化服务"""
        async with self._lock:
            if self._status != ServiceStatus.CREATED:
                logger.warning(
                    f"Service '{self.name}' already initialized, current status: {self._status}"
                )
                return

            try:
                await self._set_status(ServiceStatus.INITIALIZING)
                logger.info(f"Initializing service '{self.name}'...")

                # 调用具体实现的初始化逻辑
                await self._initialize_impl()

                await self._set_status(ServiceStatus.READY)
                await self._set_health(ServiceHealth.HEALTHY)

                logger.info(f"Service '{self.name}' initialized successfully")

            except Exception as e:
                logger.error(f"Failed to initialize service '{self.name}': {e}")
                await self._set_status(ServiceStatus.ERROR)
                await self._set_health(ServiceHealth.UNHEALTHY)
                await self._handle_error(e)
                raise

    async def start(self) -> None:
        """启动服务"""
        async with self._lock:
            if self._status == ServiceStatus.RUNNING:
                logger.warning(f"Service '{self.name}' is already running")
                return

            if self._status != ServiceStatus.READY:
                raise RuntimeError(
                    f"Service '{self.name}' must be initialized before starting"
                )

            try:
                logger.info(f"Starting service '{self.name}'...")

                # 调用具体实现的启动逻辑
                await self._start_impl()

                self._start_time = datetime.now(timezone.utc)
                await self._set_status(ServiceStatus.RUNNING)

                logger.info(f"Service '{self.name}' started successfully")

            except Exception as e:
                logger.error(f"Failed to start service '{self.name}': {e}")
                await self._set_status(ServiceStatus.ERROR)
                await self._set_health(ServiceHealth.UNHEALTHY)
                await self._handle_error(e)
                raise

    async def stop(self) -> None:
        """停止服务"""
        async with self._lock:
            if self._status == ServiceStatus.STOPPED:
                logger.warning(f"Service '{self.name}' is already stopped")
                return

            try:
                await self._set_status(ServiceStatus.STOPPING)
                logger.info(f"Stopping service '{self.name}'...")

                # 调用具体实现的停止逻辑
                await self._stop_impl()

                await self._set_status(ServiceStatus.STOPPED)
                await self._set_health(ServiceHealth.UNKNOWN)

                logger.info(f"Service '{self.name}' stopped successfully")

            except Exception as e:
                logger.error(f"Failed to stop service '{self.name}': {e}")
                await self._set_status(ServiceStatus.ERROR)
                await self._handle_error(e)
                raise

    async def pause(self) -> None:
        """暂停服务"""
        async with self._lock:
            if self._status != ServiceStatus.RUNNING:
                raise RuntimeError(
                    f"Cannot pause service '{self.name}' in status: {self._status}"
                )

            try:
                logger.info(f"Pausing service '{self.name}'...")

                # 调用具体实现的暂停逻辑
                await self._pause_impl()

                await self._set_status(ServiceStatus.PAUSED)

                logger.info(f"Service '{self.name}' paused successfully")

            except Exception as e:
                logger.error(f"Failed to pause service '{self.name}': {e}")
                await self._handle_error(e)
                raise

    async def resume(self) -> None:
        """恢复服务"""
        async with self._lock:
            if self._status != ServiceStatus.PAUSED:
                raise RuntimeError(
                    f"Cannot resume service '{self.name}' in status: {self._status}"
                )

            try:
                logger.info(f"Resuming service '{self.name}'...")

                # 调用具体实现的恢复逻辑
                await self._resume_impl()

                await self._set_status(ServiceStatus.RUNNING)

                logger.info(f"Service '{self.name}' resumed successfully")

            except Exception as e:
                logger.error(f"Failed to resume service '{self.name}': {e}")
                await self._handle_error(e)
                raise

    async def health_check(self) -> HealthCheckResult:
        """执行健康检查"""
        try:
            # 调用具体实现的健康检查逻辑
            result = await self._health_check_impl()

            # 更新健康状态
            await self._set_health(result.status)

            return result

        except Exception as e:
            logger.error(f"Health check failed for service '{self.name}': {e}")
            await self._set_health(ServiceHealth.UNHEALTHY)
            await self._handle_error(e)

            return HealthCheckResult(
                is_healthy=False,
                status=ServiceHealth.UNHEALTHY,
                message=f"Health check error: {str(e)}",
                details={"error": str(e)},
            )

    def add_status_callback(
        self, callback: Callable[[ServiceStatus, ServiceStatus], None]
    ) -> None:
        """添加状态变化回调"""
        self._status_callbacks.append(callback)

    def add_health_callback(
        self, callback: Callable[[ServiceHealth, ServiceHealth], None]
    ) -> None:
        """添加健康状态变化回调"""
        self._health_callbacks.append(callback)

    def add_error_handler(self, handler: Callable[[Exception], None]) -> None:
        """添加错误处理器"""
        self._error_handlers.append(handler)

    @asynccontextmanager
    async def lifecycle(self):
        """服务生命周期上下文管理器"""
        try:
            await self.initialize()
            await self.start()
            yield self
        finally:
            await self.stop()

    # 需要具体服务实现的抽象方法

    @abstractmethod
    async def _initialize_impl(self) -> None:
        """具体的初始化实现"""
        pass

    @abstractmethod
    async def _start_impl(self) -> None:
        """具体的启动实现"""
        pass

    @abstractmethod
    async def _stop_impl(self) -> None:
        """具体的停止实现"""
        pass

    async def _pause_impl(self) -> None:
        """具体的暂停实现（可选）"""
        pass

    async def _resume_impl(self) -> None:
        """具体的恢复实现（可选）"""
        pass

    @abstractmethod
    async def _health_check_impl(self) -> HealthCheckResult:
        """具体的健康检查实现"""
        pass

    # 内部方法

    async def _set_status(self, new_status: ServiceStatus) -> None:
        """设置服务状态"""
        old_status = self._status
        self._status = new_status

        # 触发状态变化回调
        for callback in self._status_callbacks:
            try:
                callback(old_status, new_status)
            except Exception as e:
                logger.error(f"Status callback error in service '{self.name}': {e}")

    async def _set_health(self, new_health: ServiceHealth) -> None:
        """设置健康状态"""
        old_health = self._health
        self._health = new_health

        # 触发健康状态变化回调
        for callback in self._health_callbacks:
            try:
                callback(old_health, new_health)
            except Exception as e:
                logger.error(f"Health callback error in service '{self.name}': {e}")

    async def _handle_error(self, error: Exception) -> None:
        """处理错误"""
        self._last_error = error
        self._metrics.error_count += 1

        # 触发错误处理器
        for handler in self._error_handlers:
            try:
                handler(error)
            except Exception as e:
                logger.error(f"Error handler failed in service '{self.name}': {e}")

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(name='{self.name}', status='{self._status}', health='{self._health}')>"
