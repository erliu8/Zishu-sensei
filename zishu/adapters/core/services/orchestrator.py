"""
服务协调器

负责管理多个服务的生命周期、依赖关系和启动顺序。
"""

import asyncio
import logging
from typing import Dict, List, Optional, Set, Any, Callable, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from collections import defaultdict, deque

from .base import AsyncService, ServiceStatus, ServiceHealth, HealthCheckResult

logger = logging.getLogger(__name__)


# ================================
# 异常类定义
# ================================

class ServiceStartupError(Exception):
    """服务启动错误"""
    pass


class ServiceShutdownError(Exception):
    """服务关闭错误"""
    pass


class CircularDependencyError(Exception):
    """循环依赖错误"""
    pass


@dataclass
class ServiceDependency:
    """服务依赖关系"""

    service_name: str
    dependency_name: str
    is_hard: bool = True  # 硬依赖：必须等待依赖服务完全启动
    is_optional: bool = False  # 可选依赖：依赖服务失败不影响本服务启动


@dataclass
class OrchestratorConfig:
    """协调器配置"""

    startup_timeout: float = 30.0  # 启动超时时间（秒）
    shutdown_timeout: float = 10.0  # 关闭超时时间（秒）
    health_check_interval: float = 30.0  # 健康检查间隔（秒）
    max_concurrent_starts: int = 5  # 最大并发启动数
    retry_attempts: int = 3  # 重试次数
    retry_delay: float = 1.0  # 重试延迟（秒）
    enable_auto_recovery: bool = True  # 启用自动恢复
    dependency_check_interval: float = 5.0  # 依赖检查间隔（秒）


class ServiceNode:
    """服务节点，用于依赖图管理"""

    def __init__(self, service: AsyncService):
        self.service = service
        self.dependencies: Set[str] = set()  # 依赖的服务名称
        self.dependents: Set[str] = set()  # 依赖此服务的服务名称
        self.is_hard_dependency: Dict[str, bool] = {}  # 硬依赖映射
        self.is_optional_dependency: Dict[str, bool] = {}  # 可选依赖映射

        # 启动状态
        self.start_attempts = 0
        self.last_start_attempt: Optional[datetime] = None
        self.start_task: Optional[asyncio.Task] = None
    
    @property
    def name(self) -> str:
        """获取服务名称"""
        return self.service.name


class AdapterServiceOrchestrator:
    """
    适配器服务协调器

    负责管理多个服务的：
    - 依赖关系解析
    - 启动顺序控制
    - 生命周期协调
    - 健康监控
    - 故障恢复
    """

    def __init__(self, config: Optional[OrchestratorConfig] = None):
        """初始化协调器"""
        self.config = config or OrchestratorConfig()

        # 服务管理
        self._services: Dict[str, ServiceNode] = {}
        self._dependencies: List[ServiceDependency] = []

        # 状态管理
        self._status = ServiceStatus.CREATED
        self._lock = asyncio.Lock()
        self._startup_order: List[List[str]] = []  # 分层启动顺序

        # 任务管理
        self._health_check_task: Optional[asyncio.Task] = None
        self._recovery_task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()

        # 事件回调
        self._service_callbacks: Dict[str, List[Callable]] = defaultdict(list)

        logger.info("AdapterServiceOrchestrator initialized")

    @property
    def status(self) -> ServiceStatus:
        """获取协调器状态"""
        return self._status

    @property
    def services(self) -> Dict[str, AsyncService]:
        """获取所有服务"""
        return {name: node.service for name, node in self._services.items()}
    
    @property
    def is_initialized(self) -> bool:
        """检查协调器是否已初始化"""
        return self._status in [ServiceStatus.READY, ServiceStatus.RUNNING]
    
    @property
    def is_running(self) -> bool:
        """检查协调器是否正在运行"""
        return self._status == ServiceStatus.RUNNING

    def register_service(self, service: AsyncService) -> bool:
        """注册服务"""
        if service.name in self._services:
            logger.warning(f"Service '{service.name}' already registered")
            return False

        self._services[service.name] = ServiceNode(service)
        # 重新计算启动顺序
        self._startup_order = self._calculate_startup_order()
        logger.info(f"Service '{service.name}' registered with orchestrator")
        return True
    
    def unregister_service(self, service_name: str) -> bool:
        """注销服务"""
        if service_name not in self._services:
            logger.warning(f"Service '{service_name}' not found for unregistration")
            return False
        
        # 确保服务已停止
        service_node = self._services[service_name]
        if service_node.service.is_running:
            logger.warning(f"Cannot unregister running service '{service_name}'")
            return False
        
        del self._services[service_name]
        
        # 清理依赖关系
        self._dependencies = [
            dep for dep in self._dependencies 
            if dep.service_name != service_name and dep.dependency_name != service_name
        ]
        
        # 重新计算启动顺序
        self._startup_order = self._calculate_startup_order()
        
        logger.info(f"Service '{service_name}' unregistered")
        return True

    def add_dependency(
        self,
        service_name: str,
        dependency_name: str,
        is_hard: bool = True,
        is_optional: bool = False,
    ) -> bool:
        """添加服务依赖"""
        if service_name not in self._services:
            raise ValueError(f"Service '{service_name}' not registered")
        if dependency_name not in self._services:
            raise ValueError(f"Dependency service '{dependency_name}' not registered")

        # 检查循环依赖
        if self._has_circular_dependency(service_name, dependency_name):
            raise CircularDependencyError(
                f"Circular dependency detected: {service_name} -> {dependency_name}"
            )

        # 添加依赖关系
        service_node = self._services[service_name]
        dependency_node = self._services[dependency_name]

        service_node.dependencies.add(dependency_name)
        dependency_node.dependents.add(service_name)
        service_node.is_hard_dependency[dependency_name] = is_hard
        service_node.is_optional_dependency[dependency_name] = is_optional

        # 记录依赖关系
        dependency = ServiceDependency(
            service_name, dependency_name, is_hard, is_optional
        )
        self._dependencies.append(dependency)

        logger.info(
            f"Added dependency: {service_name} -> {dependency_name} "
            f"(hard={is_hard}, optional={is_optional})"
        )
        
        # 如果协调器已初始化，重新计算启动顺序
        if self._status != ServiceStatus.CREATED:
            self._startup_order = self._calculate_startup_order()
            logger.info(f"Recalculated startup order: {self._startup_order}")
        
        return True

    async def initialize(self) -> None:
        """初始化协调器"""
        async with self._lock:
            if self._status != ServiceStatus.CREATED:
                return

            try:
                self._status = ServiceStatus.INITIALIZING

                # 计算启动顺序
                self._startup_order = self._calculate_startup_order()
                logger.info(f"Calculated startup order: {self._startup_order}")

                # 初始化所有服务
                for service_name, node in self._services.items():
                    logger.info(f"Initializing service: {service_name}")
                    await node.service.initialize()

                self._status = ServiceStatus.READY
                logger.info("AdapterServiceOrchestrator initialized successfully")

            except Exception as e:
                self._status = ServiceStatus.ERROR
                logger.error(f"Failed to initialize orchestrator: {e}")
                raise

    async def start_all(self) -> None:
        """启动所有服务"""
        async with self._lock:
            if self._status != ServiceStatus.READY:
                raise RuntimeError(
                    f"Orchestrator must be initialized before starting, current status: {self._status}"
                )

            try:
                self._status = ServiceStatus.RUNNING
                logger.info("Starting all services...")

                # 按依赖顺序分层启动服务
                for layer in self._startup_order:
                    await self._start_service_layer(layer)

                # 启动健康检查任务
                if self.config.health_check_interval > 0:
                    self._health_check_task = asyncio.create_task(
                        self._health_check_loop()
                    )

                # 启动自动恢复任务
                if self.config.enable_auto_recovery:
                    self._recovery_task = asyncio.create_task(self._recovery_loop())

                logger.info("All services started successfully")

            except Exception as e:
                self._status = ServiceStatus.ERROR
                logger.error(f"Failed to start services: {e}")
                await self._emergency_shutdown()
                raise

    async def stop_all(self) -> None:
        """停止所有服务"""
        async with self._lock:
            if self._status not in [ServiceStatus.RUNNING, ServiceStatus.ERROR]:
                return

            try:
                self._status = ServiceStatus.STOPPING
                logger.info("Stopping all services...")

                # 设置关闭事件
                self._shutdown_event.set()

                # 停止后台任务
                if self._health_check_task:
                    self._health_check_task.cancel()
                    try:
                        await self._health_check_task
                    except asyncio.CancelledError:
                        pass

                if self._recovery_task:
                    self._recovery_task.cancel()
                    try:
                        await self._recovery_task
                    except asyncio.CancelledError:
                        pass

                # 按反向依赖顺序停止服务
                reversed_order = list(reversed(self._startup_order))
                for layer in reversed_order:
                    await self._stop_service_layer(layer)

                self._status = ServiceStatus.STOPPED
                logger.info("All services stopped successfully")

            except Exception as e:
                self._status = ServiceStatus.ERROR
                logger.error(f"Failed to stop services: {e}")
                raise

    async def get_service_health(self) -> Dict[str, HealthCheckResult]:
        """获取所有服务的健康状态"""
        results = {}

        for service_name, node in self._services.items():
            try:
                result = await node.service.health_check()
                results[service_name] = result
            except Exception as e:
                results[service_name] = HealthCheckResult(
                    is_healthy=False,
                    status=ServiceHealth.UNHEALTHY,
                    message=f"Health check failed: {str(e)}",
                )

        return results

    async def restart_service(self, service_name: str) -> None:
        """重启指定服务"""
        if service_name not in self._services:
            raise ValueError(f"Service '{service_name}' not found")

        node = self._services[service_name]

        try:
            logger.info(f"Restarting service: {service_name}")

            # 停止服务
            if node.service.is_running:
                await node.service.stop()

            # 重新启动服务
            await node.service.start()

            logger.info(f"Service '{service_name}' restarted successfully")

        except Exception as e:
            logger.error(f"Failed to restart service '{service_name}': {e}")
            raise

    @asynccontextmanager
    async def lifecycle(self):
        """协调器生命周期上下文管理器"""
        try:
            await self.initialize()
            await self.start_all()
            yield self
        finally:
            await self.stop_all()

    # 内部方法

    def _has_circular_dependency(self, service_name: str, dependency_name: str) -> bool:
        """检查是否存在循环依赖"""
        visited = set()

        def dfs(current: str, target: str) -> bool:
            if current == target:
                return True
            if current in visited:
                return False

            visited.add(current)

            if current in self._services:
                for dep in self._services[current].dependencies:
                    if dfs(dep, target):
                        return True

            return False

        return dfs(dependency_name, service_name)

    def _calculate_startup_order(self) -> List[List[str]]:
        """计算服务启动顺序（拓扑排序）"""
        # 计算入度
        in_degree = {name: 0 for name in self._services}
        for name, node in self._services.items():
            for dep in node.dependencies:
                if not node.is_optional_dependency.get(dep, False):
                    in_degree[name] += 1

        # 分层拓扑排序
        layers = []
        remaining = set(self._services.keys())

        while remaining:
            # 找到当前层（入度为0的节点）
            current_layer = [name for name in remaining if in_degree[name] == 0]

            if not current_layer:
                # 存在循环依赖
                raise ValueError(
                    f"Circular dependency detected in remaining services: {remaining}"
                )

            layers.append(current_layer)

            # 更新入度
            for name in current_layer:
                remaining.remove(name)
                if name in self._services:
                    for dependent in self._services[name].dependents:
                        if dependent in remaining:
                            in_degree[dependent] -= 1

        return layers

    async def _start_service_layer(self, layer: List[str]) -> None:
        """启动一层服务"""
        logger.info(f"Starting service layer: {layer}")

        # 限制并发启动数
        semaphore = asyncio.Semaphore(self.config.max_concurrent_starts)

        async def start_single_service(service_name: str):
            async with semaphore:
                await self._start_service_with_retry(service_name)

        # 并发启动这一层的所有服务
        tasks = [start_single_service(name) for name in layer]
        await asyncio.gather(*tasks)

        logger.info(f"Service layer started: {layer}")

    async def _start_service_with_retry(self, service_name: str) -> None:
        """带重试的服务启动"""
        node = self._services[service_name]

        for attempt in range(self.config.retry_attempts):
            try:
                # 检查依赖是否满足
                if not await self._check_dependencies(service_name):
                    raise RuntimeError(
                        f"Dependencies not satisfied for service '{service_name}'"
                    )

                # 确保服务已初始化
                if node.service.status in [ServiceStatus.CREATED, ServiceStatus.FAILED]:
                    await asyncio.wait_for(
                        node.service.initialize(), timeout=self.config.startup_timeout
                    )

                # 启动服务
                node.start_attempts += 1
                node.last_start_attempt = datetime.now(timezone.utc)

                await asyncio.wait_for(
                    node.service.start(), timeout=self.config.startup_timeout
                )

                logger.info(f"Service '{service_name}' started successfully")
                return

            except Exception as e:
                logger.warning(
                    f"Failed to start service '{service_name}' (attempt {attempt + 1}): {e}"
                )

                if attempt < self.config.retry_attempts - 1:
                    await asyncio.sleep(
                        self.config.retry_delay * (2**attempt)
                    )  # 指数退避
                else:
                    logger.error(
                        f"Failed to start service '{service_name}' after {self.config.retry_attempts} attempts"
                    )
                    raise

    async def _stop_service_layer(self, layer: List[str]) -> None:
        """停止一层服务"""
        logger.info(f"Stopping service layer: {layer}")

        async def stop_single_service(service_name: str):
            try:
                node = self._services[service_name]
                # 尝试停止服务，无论当前状态如何（除了已经停止的）
                if node.service.status != ServiceStatus.STOPPED:
                    await asyncio.wait_for(
                        node.service.stop(), timeout=self.config.shutdown_timeout
                    )
            except Exception as e:
                logger.error(f"Failed to stop service '{service_name}': {e}")

        # 并发停止这一层的所有服务
        tasks = [stop_single_service(name) for name in layer]
        await asyncio.gather(*tasks, return_exceptions=True)

        logger.info(f"Service layer stopped: {layer}")

    async def _check_dependencies(self, service_name: str) -> bool:
        """检查服务依赖是否满足"""
        node = self._services[service_name]

        for dep_name in node.dependencies:
            dep_node = self._services[dep_name]
            is_optional = node.is_optional_dependency.get(dep_name, False)

            if not dep_node.service.is_running and not is_optional:
                return False

        return True

    async def _health_check_loop(self) -> None:
        """健康检查循环"""
        logger.info("Starting health check loop")

        while not self._shutdown_event.is_set():
            try:
                await self._perform_health_checks()
                await asyncio.sleep(self.config.health_check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check loop error: {e}")
                await asyncio.sleep(self.config.health_check_interval)

        logger.info("Health check loop stopped")

    async def _perform_health_checks(self) -> None:
        """执行健康检查"""
        for service_name, node in self._services.items():
            try:
                if node.service.is_running:
                    result = await node.service.health_check()
                    if not result.is_healthy:
                        logger.warning(
                            f"Service '{service_name}' is unhealthy: {result.message}"
                        )
            except Exception as e:
                logger.error(f"Health check failed for service '{service_name}': {e}")

    async def _recovery_loop(self) -> None:
        """自动恢复循环"""
        logger.info("Starting recovery loop")

        while not self._shutdown_event.is_set():
            try:
                await self._perform_recovery_checks()
                await asyncio.sleep(self.config.dependency_check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Recovery loop error: {e}")
                await asyncio.sleep(self.config.dependency_check_interval)

        logger.info("Recovery loop stopped")

    async def _perform_recovery_checks(self) -> None:
        """执行恢复检查"""
        for service_name, node in self._services.items():
            try:
                # 检查服务是否需要恢复
                if (
                    node.service.status == ServiceStatus.ERROR
                    or node.service.health == ServiceHealth.UNHEALTHY
                ):
                    logger.info(f"Attempting to recover service: {service_name}")
                    await self.restart_service(service_name)

            except Exception as e:
                logger.error(f"Failed to recover service '{service_name}': {e}")

    async def _emergency_shutdown(self) -> None:
        """紧急关闭所有服务"""
        logger.warning("Performing emergency shutdown")

        tasks = []
        for service_name, node in self._services.items():
            if node.service.is_running:
                task = asyncio.create_task(node.service.stop())
                tasks.append(task)

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        logger.warning("Emergency shutdown completed")
    
    # 测试期望的方法
    
    def get_registered_services(self) -> Dict[str, AsyncService]:
        """获取已注册的服务"""
        return self.services
    
    def get_service_dependencies(self) -> Dict[str, Set[str]]:
        """获取服务依赖关系"""
        result = {}
        for service_name, node in self._services.items():
            result[service_name] = node.dependencies.copy()
        return result
    
    async def start_all_services(self) -> None:
        """启动所有服务（别名方法）"""
        await self.start_all()
    
    async def stop_all_services(self) -> None:
        """停止所有服务（别名方法）"""
        await self.stop_all()
    
    async def start_service(self, service_name: str) -> bool:
        """启动特定服务"""
        if service_name not in self._services:
            logger.error(f"Service '{service_name}' not found")
            return False
        
        try:
            await self._start_service_with_retry(service_name)
            return True
        except Exception as e:
            logger.error(f"Failed to start service '{service_name}': {e}")
            raise ServiceStartupError(f"Failed to start service '{service_name}': {e}")
    
    async def stop_service(self, service_name: str) -> bool:
        """停止特定服务"""
        if service_name not in self._services:
            logger.error(f"Service '{service_name}' not found")
            return False
        
        try:
            node = self._services[service_name]
            if node.service.is_running:
                await asyncio.wait_for(
                    node.service.stop(), timeout=self.config.shutdown_timeout
                )
            return True
        except Exception as e:
            logger.error(f"Failed to stop service '{service_name}': {e}")
            raise ServiceShutdownError(f"Failed to stop service '{service_name}': {e}")
    
    async def check_all_services_health(self) -> Dict[str, HealthCheckResult]:
        """检查所有服务健康状态（别名方法）"""
        return await self.get_service_health()
    
    async def start_health_monitoring(self) -> None:
        """启动健康监控"""
        if self._health_check_task is None or self._health_check_task.done():
            self._health_check_task = asyncio.create_task(self._health_check_loop())
            logger.info("Health monitoring started")
    
    async def stop_health_monitoring(self) -> None:
        """停止健康监控"""
        if self._health_check_task and not self._health_check_task.done():
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
            logger.info("Health monitoring stopped")
    
    def get_service_status(self, service_name: str) -> Optional[ServiceStatus]:
        """获取特定服务状态"""
        if service_name not in self._services:
            return None
        return self._services[service_name].service.status
    
    def get_all_services_status(self) -> Dict[str, ServiceStatus]:
        """获取所有服务状态"""
        return {
            name: node.service.status 
            for name, node in self._services.items()
        }
    
    async def check_service_health(self, service_name: str) -> Optional[HealthCheckResult]:
        """检查特定服务健康状态"""
        if service_name not in self._services:
            return None
        
        try:
            node = self._services[service_name]
            return await node.service.health_check()
        except Exception as e:
            return HealthCheckResult(
                is_healthy=False,
                status=ServiceHealth.UNHEALTHY,
                message=f"Health check failed: {str(e)}",
            )
    
    def get_orchestrator_metrics(self) -> Dict[str, Any]:
        """获取协调器指标"""
        total_services = len(self._services)
        running_services = sum(
            1 for node in self._services.values() 
            if node.service.status == ServiceStatus.RUNNING
        )
        failed_services = sum(
            1 for node in self._services.values() 
            if node.service.status == ServiceStatus.ERROR
        )
        
        return {
            "total_services": total_services,
            "running_services": running_services,
            "failed_services": failed_services,
            "orchestrator_status": self._status.value,
            "dependencies_count": len(self._dependencies)
        }
    
    async def shutdown(self) -> None:
        """关闭协调器（别名方法）"""
        await self.stop_all()
