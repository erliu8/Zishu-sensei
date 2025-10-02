"""
适配器注册中心
"""

import asyncio
import uuid
import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Union, Callable, Tuple, Type
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager
from collections import defaultdict, deque
import logging
import weakref
from pathlib import Path
import json
import traceback

# 本地模块导入
from .adapter import BaseAdapter, ExecutionContext, ExecutionResult, HealthCheckResult
from .metadata import (
    AdapterMetadata, AdapterStatus, AdapterType, SecurityLevel, 
    MetadataManager, get_default_metadata_manager
)
from .exceptions import (
    BaseAdapterException, AdapterRegistrationError, AdapterNotFoundError,
    AdapterAlreadyExistsError, AdapterLoadingError, AdapterExecutionError,
    ErrorCode, ExceptionSeverity, handle_adapter_exceptions
)

# 配置日志
logger = logging.getLogger(__name__)

# ================================
# 常量和枚举定义
# ================================

class RegistryStatus(str, Enum):
    """注册中心状态"""
    INITIALIZING = "initializing"       # 初始化中
    RUNNING = "running"                 # 正常运行
    PAUSED = "paused"                   # 已暂停
    SHUTTING_DOWN = "shutting_down"     # 关闭中
    STOPPED = "stopped"                 # 已停止
    ERROR = "error"                     # 错误状态


class AdapterRegistrationStatus(str, Enum):
    """适配器注册状态"""
    REGISTERING = "registering"         # 注册中
    REGISTERED = "registered"           # 已注册
    INITIALIZING = "initializing"       # 初始化中
    RUNNING = "running"                 # 运行中
    PAUSED = "paused"                   # 已暂停
    STOPPING = "stopping"               # 停止中
    STOPPED = "stopped"                 # 已停止
    FAILED = "failed"                   # 失败状态
    ERROR = "error"                     # 错误状态
    UNREGISTERING = "unregistering"     # 卸载中


class EventType(str, Enum):
    """事件类型"""
    ADAPTER_REGISTERED = "adapter_registered"
    ADAPTER_UNREGISTERED = "adapter_unregistered"
    ADAPTER_STARTED = "adapter_started"
    ADAPTER_STOPPED = "adapter_stopped"
    ADAPTER_ERROR = "adapter_error"
    ADAPTER_HEALTH_CHANGED = "adapter_health_changed"
    DEPENDENCY_RESOLVED = "dependency_resolved"
    DEPENDENCY_FAILED = "dependency_failed"


# ================================
# 核心数据结构
# ================================

@dataclass
class AdapterRegistration:
    """适配器注册信息"""
    adapter_id: str
    adapter_class: Type[BaseAdapter]
    config: Dict[str, Any]
    name: Optional[str] = None
    instance: Optional[BaseAdapter] = None
    status: AdapterRegistrationStatus = AdapterRegistrationStatus.REGISTERED
    registration_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    start_time: Optional[datetime] = None
    last_health_check: Optional[datetime] = None
    health_status: str = "unknown"
    error_count: int = 0
    restart_count: int = 0
    dependencies: Set[str] = field(default_factory=set)
    dependents: Set[str] = field(default_factory=set)
    tags: Set[str] = field(default_factory=set)
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "adapter_id": self.adapter_id,
            "name": self.name,
            "adapter_class": self.adapter_class.__name__ if self.adapter_class else None,
            "config": self._safe_config_repr(),
            "status": self.status.value,
            "registration_time": self.registration_time.isoformat(),
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "last_health_check": self.last_health_check.isoformat() if self.last_health_check else None,
            "health_status": self.health_status,
            "error_count": self.error_count,
            "restart_count": self.restart_count,
            "dependencies": list(self.dependencies),
            "dependents": list(self.dependents),
            "tags": list(self.tags),
            "metadata": self.metadata
        }
    
    def _safe_config_repr(self) -> Dict[str, Any]:
        """安全的配置表示（隐藏敏感信息）"""
        safe_config = self.config.copy()
        sensitive_keys = ['password', 'token', 'secret', 'key', 'credential']
        
        for key in list(safe_config.keys()):
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                safe_config[key] = "***HIDDEN***"
        
        return safe_config


@dataclass
class RegistryEvent:
    """注册中心事件"""
    event_id: str = field(default_factory=lambda: f"event_{uuid.uuid4().hex[:8]}")
    event_type: EventType = EventType.ADAPTER_REGISTERED
    adapter_id: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    data: Dict[str, Any] = field(default_factory=dict)
    source: str = "registry"
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "adapter_id": self.adapter_id,
            "timestamp": self.timestamp.isoformat(),
            "data": self.data,
            "source": self.source
        }


@dataclass
class DependencyGraph:
    """依赖关系图"""
    nodes: Dict[str, Set[str]] = field(default_factory=dict)  # adapter_id -> dependencies
    reverse_nodes: Dict[str, Set[str]] = field(default_factory=dict)  # adapter_id -> dependents
    
    def add_adapter(self, adapter_id: str, dependencies: Optional[Set[str]] = None):
        """添加适配器节点"""
        dependencies = dependencies or set()
        self.nodes[adapter_id] = dependencies.copy()
        
        # 更新反向图
        if adapter_id not in self.reverse_nodes:
            self.reverse_nodes[adapter_id] = set()
        
        for dep in dependencies:
            if dep not in self.reverse_nodes:
                self.reverse_nodes[dep] = set()
            self.reverse_nodes[dep].add(adapter_id)
    
    def remove_adapter(self, adapter_id: str):
        """移除适配器节点"""
        if adapter_id in self.nodes:
            # 移除其依赖关系
            for dep in self.nodes[adapter_id]:
                if dep in self.reverse_nodes:
                    self.reverse_nodes[dep].discard(adapter_id)
            del self.nodes[adapter_id]
        
        if adapter_id in self.reverse_nodes:
            # 移除被依赖关系
            for dependent in self.reverse_nodes[adapter_id]:
                if dependent in self.nodes:
                    self.nodes[dependent].discard(adapter_id)
            del self.reverse_nodes[adapter_id]
    
    def get_dependencies(self, adapter_id: str) -> Set[str]:
        """获取适配器的依赖"""
        return self.nodes.get(adapter_id, set()).copy()
    
    def get_dependents(self, adapter_id: str) -> Set[str]:
        """获取依赖于该适配器的其他适配器"""
        return self.reverse_nodes.get(adapter_id, set()).copy()
    
    def has_circular_dependency(self) -> List[List[str]]:
        """检测循环依赖，返回循环依赖链"""
        visited = set()
        recursion_stack = set()
        cycles = []
        
        def dfs(node: str, path: List[str]):
            if node in recursion_stack:
                # 找到循环
                cycle_start = path.index(node)
                cycle = path[cycle_start:] + [node]
                cycles.append(cycle)
                return
            
            if node in visited:
                return
            
            visited.add(node)
            recursion_stack.add(node)
            
            for neighbor in self.nodes.get(node, set()):
                dfs(neighbor, path + [neighbor])
            
            recursion_stack.remove(node)
        
        for node in self.nodes:
            if node not in visited:
                dfs(node, [node])
        
        return cycles
    
    def get_startup_order(self) -> List[List[str]]:
        """获取启动顺序（拓扑排序）"""
        # Kahn算法进行拓扑排序
        in_degree = {}
        for node in self.nodes:
            in_degree[node] = len(self.nodes[node])
        
        queue = [node for node, degree in in_degree.items() if degree == 0]
        result = []
        
        while queue:
            # 同一层级的可以并行启动
            current_level = queue.copy()
            queue.clear()
            result.append(current_level)
            
            for node in current_level:
                for dependent in self.reverse_nodes.get(node, set()):
                    in_degree[dependent] -= 1
                    if in_degree[dependent] == 0:
                        queue.append(dependent)
        
        return result


# ================================
# 事件系统
# ================================

class EventBus:
    """事件总线"""
    
    def __init__(self):
        self._listeners: Dict[EventType, List[Callable]] = defaultdict(list)
        self._event_history: deque = deque(maxlen=1000)
        self._lock = threading.RLock()
        self.logger = logging.getLogger(f"{__name__}.EventBus")
    
    @property
    def lock(self) -> threading.RLock:
        """获取锁"""
        return self._lock
    
    def subscribe(self, event_type: EventType, listener: Callable[[RegistryEvent], None]):
        """订阅事件"""
        with self.lock:
            self._listeners[event_type].append(listener)
            self.logger.debug(f"Subscribed to event type: {event_type.value}")
    
    def unsubscribe(self, event_type: EventType, listener: Callable):
        """取消订阅"""
        with self.lock:
            if listener in self._listeners[event_type]:
                self._listeners[event_type].remove(listener)
                self.logger.debug(f"Unsubscribed from event type: {event_type.value}")
    
    def emit(self, event: RegistryEvent):
        """发布事件"""
        with self.lock:
            self._event_history.append(event)
            listeners = self._listeners.get(event.event_type, []).copy()
        
        # 异步通知监听器
        for listener in listeners:
            try:
                if asyncio.iscoroutinefunction(listener):
                    # 对于异步监听器，创建任务
                    try:
                        loop = asyncio.get_running_loop()
                        loop.create_task(listener(event))
                    except RuntimeError:
                        # 如果没有运行的事件循环，跳过异步监听器
                        pass
                else:
                    # 同步监听器直接调用
                    listener(event)
            except Exception as e:
                self.logger.error(f"Error in event listener for {event.event_type.value}: {e}")
    
    def publish(self, event: RegistryEvent):
        """发布事件（emit的别名）"""
        self.emit(event)
    
    def get_recent_events(self, limit: int = 50, event_type: Optional[EventType] = None) -> List[RegistryEvent]:
        """获取最近的事件"""
        with self.lock:
            events = list(self._event_history)
            
            if event_type:
                events = [e for e in events if e.event_type == event_type]
            
            return events[-limit:] if limit > 0 else events


# ================================
# 健康监控系统
# ================================

class HealthMonitor:
    """健康监控器"""
    
    def __init__(self, registry: 'AdapterRegistry'):
        self.registry = registry
        self.check_interval = 30  # 检查间隔（秒）
        self.unhealthy_threshold = 3  # 不健康阈值
        self.recovery_attempts = 3  # 恢复尝试次数
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self.logger = logging.getLogger(f"{__name__}.HealthMonitor")
        self._health_cache: Dict[str, Tuple[HealthCheckResult, datetime]] = {}
        self._lock: Optional[asyncio.Lock] = None
    
    @property
    def lock(self) -> asyncio.Lock:
        """延迟初始化锁"""
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock
    
    async def start(self):
        """启动健康监控"""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        self.logger.info("Health monitor started")
    
    async def stop(self):
        """停止健康监控"""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self.logger.info("Health monitor stopped")
    
    async def _monitor_loop(self):
        """监控循环"""
        while self._running:
            try:
                await self._check_all_adapters()
                await asyncio.sleep(self.check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in health monitor loop: {e}")
                await asyncio.sleep(self.check_interval)
    
    async def _check_all_adapters(self):
        """检查所有适配器的健康状态"""
        registrations = self.registry.list_adapters()
        
        for registration in registrations:
            if registration.status == AdapterRegistrationStatus.RUNNING:
                await self._check_adapter_health(registration)
    
    async def _check_adapter_health(self, registration: AdapterRegistration):
        """检查单个适配器的健康状态"""
        try:
            if not registration.instance:
                return
            
            # 执行健康检查
            health_result = await registration.instance.health_check()
            previous_status = registration.health_status
            
            # 更新健康状态
            registration.health_status = health_result.status
            registration.last_health_check = datetime.now(timezone.utc)
            
            async with self.lock:
                self._health_cache[registration.adapter_id] = (health_result, registration.last_health_check)
            
            # 如果健康状态发生变化，发布事件
            if previous_status != health_result.status:
                event = RegistryEvent(
                    event_type=EventType.ADAPTER_HEALTH_CHANGED,
                    adapter_id=registration.adapter_id,
                    data={
                        "previous_status": previous_status,
                        "current_status": health_result.status,
                        "health_result": health_result.__dict__ if hasattr(health_result, '__dict__') else str(health_result)
                    }
                )
                self.registry.event_bus.emit(event)
            
            # 处理不健康状态
            if not health_result.is_healthy:
                await self._handle_unhealthy_adapter(registration, health_result)
                
        except Exception as e:
            self.logger.error(f"Health check failed for adapter {registration.adapter_id}: {e}")
            registration.health_status = "error"
            registration.error_count += 1
    
    async def _handle_unhealthy_adapter(self, registration: AdapterRegistration, health_result: HealthCheckResult):
        """处理不健康的适配器"""
        registration.error_count += 1
        
        # 如果错误次数超过阈值，尝试重启
        if registration.error_count >= self.unhealthy_threshold:
            if registration.restart_count < self.recovery_attempts:
                self.logger.warning(
                    f"Attempting to restart unhealthy adapter {registration.adapter_id} "
                    f"(attempt {registration.restart_count + 1}/{self.recovery_attempts})"
                )
                await self._restart_adapter(registration)
            else:
                self.logger.error(
                    f"Adapter {registration.adapter_id} exceeded maximum recovery attempts, "
                    f"stopping adapter"
                )
                await self.registry.stop_adapter(registration.adapter_id)
    
    async def _restart_adapter(self, registration: AdapterRegistration):
        """重启适配器"""
        try:
            await self.registry.stop_adapter(registration.adapter_id)
            await asyncio.sleep(1)  # 短暂等待
            await self.registry.start_adapter(registration.adapter_id)
            registration.restart_count += 1
            registration.error_count = 0  # 重置错误计数
        except Exception as e:
            self.logger.error(f"Failed to restart adapter {registration.adapter_id}: {e}")
    
    async def get_health_summary(self) -> Dict[str, Any]:
        """获取健康状态摘要"""
        async with self.lock:
            healthy_count = 0
            unhealthy_count = 0
            unknown_count = 0
            total_count = 0
            
            for adapter_id, (health_result, _) in self._health_cache.items():
                total_count += 1
                if health_result.is_healthy:
                    healthy_count += 1
                elif health_result.status == "unknown":
                    unknown_count += 1
                else:
                    unhealthy_count += 1
            
            return {
                "total_adapters": total_count,
                "healthy": healthy_count,
                "unhealthy": unhealthy_count,
                "unknown": unknown_count,
                "health_rate": healthy_count / total_count if total_count > 0 else 0,
                "last_check": datetime.now(timezone.utc).isoformat()
            }


# ================================
# 安全管理器
# ================================

class SecurityManager:
    """安全管理器"""
    
    def __init__(self):
        self.logger = logging.getLogger(f"{__name__}.SecurityManager")
        self._permission_cache: Dict[str, Set[str]] = {}
        self._security_policies: Dict[SecurityLevel, Set[str]] = {
            SecurityLevel.PUBLIC: set(),
            SecurityLevel.INTERNAL: {"basic_auth"},
            SecurityLevel.RESTRICTED: {"basic_auth", "role_based"},
            SecurityLevel.CLASSIFIED: {"basic_auth", "role_based", "multi_factor"}
        }
    
    def validate_adapter_permissions(self, adapter_metadata: AdapterMetadata, user_permissions: Set[str]) -> bool:
        """验证适配器权限"""
        try:
            required_permissions = adapter_metadata.get_required_permissions()
            security_level = adapter_metadata.permissions.security_level
            
            # 检查安全级别要求
            required_security_permissions = self._security_policies.get(security_level, set())
            
            # 验证用户是否具有所需权限
            if not required_security_permissions.issubset(user_permissions):
                missing = required_security_permissions - user_permissions
                self.logger.warning(f"Missing security permissions for adapter {adapter_metadata.adapter_id}: {missing}")
                return False
            
            # 验证适配器特定权限
            if not required_permissions.issubset(user_permissions):
                missing = required_permissions - user_permissions
                self.logger.warning(f"Missing adapter permissions for {adapter_metadata.adapter_id}: {missing}")
                return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error validating permissions for adapter {adapter_metadata.adapter_id}: {e}")
            return False
    
    def get_security_context(self, adapter_id: str, user_id: str) -> Dict[str, Any]:
        """获取安全上下文"""
        return {
            "adapter_id": adapter_id,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "session_id": f"sec_{uuid.uuid4().hex[:8]}"
        }


# ================================
# 性能监控器
# ================================

class PerformanceMonitor:
    """性能监控器"""
    
    def __init__(self):
        self.logger = logging.getLogger(f"{__name__}.PerformanceMonitor")
        self._metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self._lock = threading.RLock()
    
    @property
    def lock(self) -> threading.RLock:
        """获取锁"""
        return self._lock
        
    def record_operation(self, adapter_id: str, operation: str, duration: float, success: bool):
        """记录操作性能"""
        with self.lock:
            metric_key = f"{adapter_id}.{operation}"
            self._metrics[metric_key].append({
                "timestamp": datetime.now(timezone.utc),
                "duration": duration,
                "success": success
            })
    
    def get_adapter_metrics(self, adapter_id: str) -> Dict[str, Any]:
        """获取适配器性能指标"""
        with self.lock:
            metrics = {}
            for key, values in self._metrics.items():
                if key.startswith(f"{adapter_id}."):
                    operation = key.split(".", 1)[1]
                    if values:
                        recent_values = list(values)[-100:]  # 最近100次操作
                        durations = [v["duration"] for v in recent_values]
                        successes = [v["success"] for v in recent_values]
                        
                        metrics[operation] = {
                            "total_operations": len(values),
                            "recent_operations": len(recent_values),
                            "avg_duration": sum(durations) / len(durations) if durations else 0,
                            "success_rate": sum(successes) / len(successes) if successes else 0,
                            "last_operation": recent_values[-1]["timestamp"].isoformat() if recent_values else None
                        }
            return metrics
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """获取系统性能指标"""
        with self.lock:
            total_operations = sum(len(values) for values in self._metrics.values())
            adapter_count = len(set(key.split(".", 1)[0] for key in self._metrics.keys()))
            
            return {
                "total_operations": total_operations,
                "active_adapters": adapter_count,
                "metrics_collected": len(self._metrics),
                "collection_time": datetime.now(timezone.utc).isoformat()
            }


# ================================
# 适配器注册中心主类
# ================================

class AdapterRegistry:
    """
    适配器注册中心
    
    负责管理所有适配器的注册、生命周期、依赖关系和健康状态。
    这是适配器系统的核心组件，提供统一的适配器管理接口。
    """
    
    def __init__(
        self,
        metadata_manager: Optional[MetadataManager] = None,
        enable_health_monitoring: bool = True,
        health_check_interval: int = 30,
        max_concurrent_operations: int = 10,
        enable_auto_recovery: bool = True,
        enable_security: bool = True
    ):
        """
        初始化适配器注册中心
        
        Args:
            metadata_manager: 元数据管理器
            enable_health_monitoring: 是否启用健康监控
            health_check_interval: 健康检查间隔（秒）
            max_concurrent_operations: 最大并发操作数
            enable_auto_recovery: 是否启用自动恢复
            enable_security: 是否启用安全管理
        """
        # 核心组件
        self.metadata_manager = metadata_manager or get_default_metadata_manager()
        self.event_bus = EventBus()
        self.security_manager = SecurityManager() if enable_security else None
        self.performance_monitor = PerformanceMonitor()
        
        # 注册信息存储
        self._registrations: Dict[str, AdapterRegistration] = {}
        self._adapter_classes: Dict[str, Type[BaseAdapter]] = {}
        self._dependency_graph = DependencyGraph()
        
        # 状态管理
        self.status = RegistryStatus.INITIALIZING
        # Python 3.8 兼容性：使用延迟初始化的 asyncio.Lock
        self._lock: Optional[asyncio.Lock] = None
        self._operation_semaphore = asyncio.Semaphore(max_concurrent_operations)
        
        # 健康监控
        self.enable_health_monitoring = enable_health_monitoring
        self.health_monitor = HealthMonitor(self) if enable_health_monitoring else None
        if self.health_monitor:
            self.health_monitor.check_interval = health_check_interval
        
        # 配置选项
        self._config = {
            "enable_health_monitoring": enable_health_monitoring,
            "health_check_interval": health_check_interval,
            "max_concurrent_operations": max_concurrent_operations,
            "enable_auto_recovery": enable_auto_recovery,
            "enable_security": enable_security
        }
        self.enable_auto_recovery = enable_auto_recovery
        self.enable_security = enable_security
        
        # 统计信息
        self._stats = {
            "total_registered": 0,
            "total_started": 0,
            "total_stopped": 0,
            "total_errors": 0,
            "start_time": None
        }
        
        self.logger = logging.getLogger(__name__)
        self.logger.info("Adapter registry initialized")
    
    @property
    def lock(self) -> asyncio.Lock:
        """延迟初始化锁"""
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock
    
    async def start(self):
        """启动注册中心"""
        async with self.lock:
            if self.status != RegistryStatus.INITIALIZING:
                self.logger.warning(f"Registry already started or in invalid state: {self.status}")
                return
            
            try:
                self.logger.info("Starting adapter registry...")
                self.status = RegistryStatus.RUNNING
                self._stats["start_time"] = datetime.now(timezone.utc)
                
                # 启动健康监控
                if self.health_monitor:
                    await self.health_monitor.start()
                
                self.logger.info("Adapter registry started successfully")
                
            except Exception as e:
                self.status = RegistryStatus.ERROR
                self.logger.error(f"Failed to start registry: {e}")
                raise AdapterRegistrationError(f"Failed to start registry: {str(e)}")
    
    async def stop(self):
        """停止注册中心"""
        async with self.lock:
            if self.status not in [RegistryStatus.RUNNING, RegistryStatus.PAUSED]:
                return
            
            try:
                self.logger.info("Stopping adapter registry...")
                self.status = RegistryStatus.SHUTTING_DOWN
                
                # 停止健康监控
                if self.health_monitor:
                    await self.health_monitor.stop()
                
                # 停止所有适配器
                running_adapters = [
                    reg.adapter_id for reg in self._registrations.values()
                    if reg.status == AdapterRegistrationStatus.RUNNING
                ]
                
                for adapter_id in running_adapters:
                    try:
                        await self.stop_adapter(adapter_id)
                    except Exception as e:
                        self.logger.error(f"Failed to stop adapter {adapter_id}: {e}")
                
                self.status = RegistryStatus.STOPPED
                self.logger.info("Adapter registry stopped")
                
            except Exception as e:
                self.status = RegistryStatus.ERROR
                self.logger.error(f"Error stopping registry: {e}")
                raise
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=AdapterRegistrationError,
        message="Failed to register adapter"
    )
    async def register_adapter(
        self,
        adapter_id: str,
        adapter_class: Type[BaseAdapter],
        config: Dict[str, Any],
        auto_start: bool = False,
        tags: Optional[Set[str]] = None,
        user_permissions: Optional[Set[str]] = None
    ) -> AdapterRegistration:
        """
        注册适配器
        
        Args:
            adapter_id: 适配器ID
            adapter_class: 适配器类
            config: 适配器配置
            auto_start: 是否自动启动
            tags: 适配器标签
            user_permissions: 用户权限集合
            
        Returns:
            AdapterRegistration: 注册信息
            
        Raises:
            AdapterAlreadyExistsError: 适配器已存在
            AdapterRegistrationError: 注册失败
        """
        start_time = time.time()
        
        async with self._operation_semaphore:
            async with self.lock:
                # 检查适配器是否已存在
                if adapter_id in self._registrations:
                    raise AdapterAlreadyExistsError(adapter_id)
                
                # 验证适配器类
                if not issubclass(adapter_class, BaseAdapter):
                    raise AdapterRegistrationError(
                        f"Adapter class must inherit from BaseAdapter",
                        adapter_id=adapter_id
                    )
                
                try:
                    self.logger.info(f"Registering adapter: {adapter_id}")
                    
                    # 创建配置副本并添加必要字段
                    adapter_config = config.copy()
                    adapter_config['adapter_id'] = adapter_id
                    
                    # 创建注册记录
                    registration = AdapterRegistration(
                        adapter_id=adapter_id,
                        adapter_class=adapter_class,
                        config=adapter_config,
                        status=AdapterRegistrationStatus.REGISTERING,
                        tags=tags or set()
                    )
                    
                    # 检查是否为抽象类
                    import inspect
                    if inspect.isabstract(adapter_class):
                        # 对于抽象类，创建最小的元数据验证
                        metadata = None
                        if hasattr(adapter_class, '_load_metadata'):
                            # 尝试从类属性获取静态元数据
                            try:
                                # 创建一个空的适配器配置用于元数据加载
                                temp_config = adapter_config.copy()
                                temp_config.setdefault('adapter_id', adapter_id)
                                temp_config.setdefault('name', adapter_id)
                                temp_config.setdefault('version', '1.0.0')
                                
                                # 如果是抽象类，跳过实例创建
                                self.logger.warning(f"Skipping instance creation for abstract class {adapter_class.__name__}")
                                metadata = None
                                
                            except Exception as e:
                                self.logger.warning(f"Failed to load metadata from abstract class {adapter_class.__name__}: {e}")
                                metadata = None
                    else:
                        # 创建适配器实例进行验证（仅对具体类）
                        temp_instance = adapter_class(adapter_config)
                        
                        # 加载元数据
                        metadata = temp_instance._load_metadata()
                    if metadata:
                        registration.metadata = metadata.dict() if hasattr(metadata, 'dict') else metadata.__dict__
                        
                        # 安全检查
                        if self.security_manager and user_permissions is not None:
                            if not self.security_manager.validate_adapter_permissions(metadata, user_permissions):
                                raise AdapterRegistrationError(
                                    f"Insufficient permissions to register adapter {adapter_id}",
                                    adapter_id=adapter_id
                                )
                        
                        # 提取依赖关系
                        if hasattr(metadata, 'dependencies'):
                            registration.dependencies = {
                                dep.name for dep in metadata.dependencies 
                                if hasattr(dep, 'type') and dep.type == 'adapter'
                            }
                    
                    # 更新依赖图
                    self._dependency_graph.add_adapter(adapter_id, registration.dependencies)
                    
                    # 检查循环依赖
                    cycles = self._dependency_graph.has_circular_dependency()
                    if cycles:
                        # 回滚依赖图变更
                        self._dependency_graph.remove_adapter(adapter_id)
                        raise AdapterRegistrationError(
                            f"Circular dependency detected: {cycles}",
                            adapter_id=adapter_id,
                            context={"cycles": cycles}
                        )
                    
                    # 保存注册信息
                    self._registrations[adapter_id] = registration
                    self._adapter_classes[adapter_id] = adapter_class
                    
                    # 更新状态
                    registration.status = AdapterRegistrationStatus.REGISTERED
                    
                    # 更新统计信息
                    self._stats["total_registered"] += 1
                    
                    # 保存元数据到持久化存储
                    if metadata:
                        await self.metadata_manager.save_metadata(metadata, notify=False)
                    
                    # 记录性能
                    duration = time.time() - start_time
                    self.performance_monitor.record_operation(adapter_id, "register", duration, True)
                    
                    # 发布事件
                    event = RegistryEvent(
                        event_type=EventType.ADAPTER_REGISTERED,
                        adapter_id=adapter_id,
                        data={
                            "adapter_class": adapter_class.__name__,
                            "config": registration._safe_config_repr(),
                            "dependencies": list(registration.dependencies),
                            "tags": list(registration.tags),
                            "duration": duration
                        }
                    )
                    self.event_bus.emit(event)
                    
                    self.logger.info(f"Successfully registered adapter: {adapter_id} in {duration:.3f}s")
                    
                    # 自动启动
                    if auto_start:
                        await self.start_adapter(adapter_id, user_permissions=user_permissions)
                    
                    return registration
                    
                except Exception as e:
                    # 记录性能（失败）
                    duration = time.time() - start_time
                    self.performance_monitor.record_operation(adapter_id, "register", duration, False)
                    
                    # 清理部分注册状态
                    if adapter_id in self._registrations:
                        del self._registrations[adapter_id]
                    if adapter_id in self._adapter_classes:
                        del self._adapter_classes[adapter_id]
                    self._dependency_graph.remove_adapter(adapter_id)
                    
                    self.logger.error(f"Failed to register adapter {adapter_id}: {e}")
                    raise
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=AdapterRegistrationError,
        message="Failed to unregister adapter"
    )
    async def unregister_adapter(self, adapter_id: str, force: bool = False) -> bool:
        """
        卸载适配器
        
        Args:
            adapter_id: 适配器ID
            force: 是否强制卸载（忽略依赖关系）
            
        Returns:
            bool: 卸载是否成功
        """
        start_time = time.time()
        
        async with self._operation_semaphore:
            async with self.lock:
                if adapter_id not in self._registrations:
                    raise AdapterNotFoundError(adapter_id)
                
                registration = self._registrations[adapter_id]
                
                try:
                    self.logger.info(f"Unregistering adapter: {adapter_id}")
                    registration.status = AdapterRegistrationStatus.UNREGISTERING
                    
                    # 检查依赖关系
                    dependents = self._dependency_graph.get_dependents(adapter_id)
                    if dependents and not force:
                        running_dependents = [
                            dep for dep in dependents 
                            if self._registrations[dep].status == AdapterRegistrationStatus.RUNNING
                        ]
                        if running_dependents:
                            raise AdapterRegistrationError(
                                f"Cannot unregister adapter {adapter_id}: "
                                f"still has running dependents: {running_dependents}",
                                adapter_id=adapter_id,
                                context={"dependents": running_dependents}
                            )
                    
                    # 停止适配器实例
                    if registration.instance and registration.status == AdapterRegistrationStatus.RUNNING:
                        await self.stop_adapter(adapter_id)
                    
                    # 清理依赖关系
                    self._dependency_graph.remove_adapter(adapter_id)
                    
                    # 从注册表中移除
                    del self._registrations[adapter_id]
                    if adapter_id in self._adapter_classes:
                        del self._adapter_classes[adapter_id]
                    
                    # 从元数据存储中删除
                    await self.metadata_manager.delete_metadata(adapter_id, notify=False)
                    
                    # 记录性能
                    duration = time.time() - start_time
                    self.performance_monitor.record_operation(adapter_id, "unregister", duration, True)
                    
                    # 发布事件
                    event = RegistryEvent(
                        event_type=EventType.ADAPTER_UNREGISTERED,
                        adapter_id=adapter_id,
                        data={"force": force, "duration": duration}
                    )
                    self.event_bus.emit(event)
                    
                    self.logger.info(f"Successfully unregistered adapter: {adapter_id} in {duration:.3f}s")
                    return True
                    
                except Exception as e:
                    # 记录性能（失败）
                    duration = time.time() - start_time
                    self.performance_monitor.record_operation(adapter_id, "unregister", duration, False)
                    
                    # 恢复状态
                    registration.status = AdapterRegistrationStatus.REGISTERED
                    self.logger.error(f"Failed to unregister adapter {adapter_id}: {e}")
                    raise
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=AdapterLoadingError,
        message="Failed to start adapter"
    )
    async def start_adapter(self, adapter_id: str, user_permissions: Optional[Set[str]] = None) -> bool:
        """
        启动适配器
        
        Args:
            adapter_id: 适配器ID
            user_permissions: 用户权限集合
            
        Returns:
            bool: 启动是否成功
        """
        start_time = time.time()
        
        async with self._operation_semaphore:
            async with self.lock:
                if adapter_id not in self._registrations:
                    raise AdapterNotFoundError(adapter_id)
                
                registration = self._registrations[adapter_id]
                
                # 检查状态
                if registration.status == AdapterRegistrationStatus.RUNNING:
                    self.logger.warning(f"Adapter {adapter_id} is already running")
                    return True
                
                try:
                    self.logger.info(f"Starting adapter: {adapter_id}")
                    registration.status = AdapterRegistrationStatus.INITIALIZING
                    
                    # 安全检查
                    if self.security_manager and user_permissions is not None and registration.metadata:
                        metadata = AdapterMetadata.parse_obj(registration.metadata) if isinstance(registration.metadata, dict) else registration.metadata
                        if not self.security_manager.validate_adapter_permissions(metadata, user_permissions):
                            raise AdapterLoadingError(
                                f"Insufficient permissions to start adapter {adapter_id}",
                                adapter_id=adapter_id
                            )
                    
                    # 检查依赖关系
                    await self._ensure_dependencies_started(adapter_id)
                    
                    # 创建适配器实例
                    if not registration.instance:
                        registration.instance = registration.adapter_class(registration.config)
                    
                    # 初始化适配器
                    success = await registration.instance.initialize()
                    if not success:
                        raise AdapterLoadingError(
                            f"Adapter {adapter_id} initialization returned False",
                            adapter_id=adapter_id
                        )
                    
                    # 更新状态
                    registration.status = AdapterRegistrationStatus.RUNNING
                    registration.start_time = datetime.now(timezone.utc)
                    registration.error_count = 0  # 重置错误计数
                    
                    # 更新统计信息
                    self._stats["total_started"] += 1
                    
                    # 更新元数据状态
                    await self.metadata_manager.update_adapter_status(adapter_id, AdapterStatus.RUNNING)
                    
                    # 记录性能
                    duration = time.time() - start_time
                    self.performance_monitor.record_operation(adapter_id, "start", duration, True)
                    
                    # 发布事件
                    event = RegistryEvent(
                        event_type=EventType.ADAPTER_STARTED,
                        adapter_id=adapter_id,
                        data={
                            "start_time": registration.start_time.isoformat(),
                            "duration": duration
                        }
                    )
                    self.event_bus.emit(event)
                    
                    self.logger.info(f"Successfully started adapter: {adapter_id} in {duration:.3f}s")
                    return True
                    
                except Exception as e:
                    # 记录性能（失败）
                    duration = time.time() - start_time
                    self.performance_monitor.record_operation(adapter_id, "start", duration, False)
                    
                    # 更新状态和错误计数
                    registration.status = AdapterRegistrationStatus.ERROR
                    registration.error_count += 1
                    self._stats["total_errors"] += 1
                    
                    # 发布错误事件
                    error_event = RegistryEvent(
                        event_type=EventType.ADAPTER_ERROR,
                        adapter_id=adapter_id,
                        data={
                            "error": str(e),
                            "error_type": type(e).__name__,
                            "operation": "start",
                            "duration": duration
                        }
                    )
                    self.event_bus.emit(error_event)
                    
                    self.logger.error(f"Failed to start adapter {adapter_id}: {e}")
                    raise
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=AdapterExecutionError,
        message="Failed to stop adapter"
    )
    async def stop_adapter(self, adapter_id: str, graceful: bool = True) -> bool:
        """
        停止适配器
        
        Args:
            adapter_id: 适配器ID
            graceful: 是否优雅停止
            
        Returns:
            bool: 停止是否成功
        """
        start_time = time.time()
        
        async with self._operation_semaphore:
            async with self.lock:
                if adapter_id not in self._registrations:
                    raise AdapterNotFoundError(adapter_id)
                
                registration = self._registrations[adapter_id]
                
                # 检查状态
                if registration.status != AdapterRegistrationStatus.RUNNING:
                    self.logger.warning(f"Adapter {adapter_id} is not running (status: {registration.status})")
                    return True
                
                try:
                    self.logger.info(f"Stopping adapter: {adapter_id}")
                    registration.status = AdapterRegistrationStatus.STOPPING
                    
                    # 检查依赖关系
                    dependents = self._dependency_graph.get_dependents(adapter_id)
                    running_dependents = [
                        dep for dep in dependents
                        if self._registrations[dep].status == AdapterRegistrationStatus.RUNNING
                    ]
                    
                    if running_dependents and graceful:
                        self.logger.warning(
                            f"Stopping dependent adapters first: {running_dependents}"
                        )
                        for dependent in running_dependents:
                            await self.stop_adapter(dependent, graceful=True)
                    
                    # 清理适配器实例
                    if registration.instance:
                        await registration.instance.cleanup()
                        registration.instance = None
                    
                    # 更新状态
                    registration.status = AdapterRegistrationStatus.STOPPED
                    
                    # 更新统计信息
                    self._stats["total_stopped"] += 1
                    
                    # 更新元数据状态
                    await self.metadata_manager.update_adapter_status(adapter_id, AdapterStatus.LOADED)
                    
                    # 记录性能
                    duration = time.time() - start_time
                    self.performance_monitor.record_operation(adapter_id, "stop", duration, True)
                    
                    # 发布事件
                    event = RegistryEvent(
                        event_type=EventType.ADAPTER_STOPPED,
                        adapter_id=adapter_id,
                        data={
                            "graceful": graceful,
                            "duration": duration
                        }
                    )
                    self.event_bus.emit(event)
                    
                    self.logger.info(f"Successfully stopped adapter: {adapter_id} in {duration:.3f}s")
                    return True
                    
                except Exception as e:
                    # 记录性能（失败）
                    duration = time.time() - start_time
                    self.performance_monitor.record_operation(adapter_id, "stop", duration, False)
                    
                    # 更新状态和错误计数
                    registration.status = AdapterRegistrationStatus.ERROR
                    registration.error_count += 1
                    self._stats["total_errors"] += 1
                    
                    self.logger.error(f"Failed to stop adapter {adapter_id}: {e}")
                    raise
    
    async def _ensure_dependencies_started(self, adapter_id: str):
        """确保依赖的适配器已启动"""
        dependencies = self._dependency_graph.get_dependencies(adapter_id)
        
        for dep_id in dependencies:
            if dep_id not in self._registrations:
                raise AdapterLoadingError(
                    f"Dependency {dep_id} is not registered",
                    adapter_id=adapter_id,
                    context={"missing_dependency": dep_id}
                )
            
            dep_registration = self._registrations[dep_id]
            if dep_registration.status != AdapterRegistrationStatus.RUNNING:
                self.logger.info(f"Starting dependency: {dep_id}")
                await self.start_adapter(dep_id)
    
    def get_adapter(self, adapter_id: str) -> Optional[BaseAdapter]:
        """获取适配器实例"""
        if adapter_id in self._registrations:
            return self._registrations[adapter_id].instance
        return None
    
    def has_adapter(self, adapter_id: str) -> bool:
        """检查是否存在指定的适配器"""
        return adapter_id in self._registrations
    
    def get_registration(self, adapter_id: str) -> Optional[AdapterRegistration]:
        """获取适配器注册信息"""
        return self._registrations.get(adapter_id)
    
    def list_adapters(
        self, 
        status_filter: Optional[AdapterRegistrationStatus] = None,
        tag_filter: Optional[Set[str]] = None
    ) -> List[AdapterRegistration]:
        """列出适配器"""
        registrations = list(self._registrations.values())
        
        # 状态过滤
        if status_filter:
            registrations = [r for r in registrations if r.status == status_filter]
        
        # 标签过滤
        if tag_filter:
            registrations = [
                r for r in registrations
                if r.tags and tag_filter.intersection(r.tags)
            ]
        
        return registrations
    
    def get_dependency_graph(self) -> Dict[str, Dict[str, List[str]]]:
        """获取依赖关系图"""
        return {
            "dependencies": {k: list(v) for k, v in self._dependency_graph.nodes.items()},
            "dependents": {k: list(v) for k, v in self._dependency_graph.reverse_nodes.items()}
        }
    
    def get_startup_order(self) -> List[List[str]]:
        """获取启动顺序"""
        return self._dependency_graph.get_startup_order()
    
    async def start_all_adapters(self, parallel_groups: bool = True) -> Dict[str, bool]:
        """启动所有适配器"""
        startup_order = self.get_startup_order()
        results = {}
        
        for level in startup_order:
            if parallel_groups:
                # 并行启动同一层级的适配器
                tasks = []
                for adapter_id in level:
                    if adapter_id in self._registrations:
                        task = asyncio.create_task(self._start_adapter_safe(adapter_id))
                        tasks.append((adapter_id, task))
                
                # 等待所有任务完成
                for adapter_id, task in tasks:
                    try:
                        results[adapter_id] = await task
                    except Exception as e:
                        self.logger.error(f"Failed to start adapter {adapter_id}: {e}")
                        results[adapter_id] = False
            else:
                # 串行启动
                for adapter_id in level:
                    if adapter_id in self._registrations:
                        try:
                            results[adapter_id] = await self.start_adapter(adapter_id)
                        except Exception as e:
                            self.logger.error(f"Failed to start adapter {adapter_id}: {e}")
                            results[adapter_id] = False
        
        return results
    
    async def _start_adapter_safe(self, adapter_id: str) -> bool:
        """安全启动适配器（不抛出异常）"""
        try:
            return await self.start_adapter(adapter_id)
        except Exception:
            return False
    
    async def stop_all_adapters(self, parallel: bool = True) -> Dict[str, bool]:
        """停止所有运行中的适配器"""
        running_adapters = [
            reg.adapter_id for reg in self._registrations.values()
            if reg.status == AdapterRegistrationStatus.RUNNING
        ]
        
        results = {}
        
        if parallel:
            # 并行停止
            tasks = []
            for adapter_id in running_adapters:
                task = asyncio.create_task(self._stop_adapter_safe(adapter_id))
                tasks.append((adapter_id, task))
            
            # 等待所有任务完成
            for adapter_id, task in tasks:
                results[adapter_id] = await task
        else:
            # 串行停止
            for adapter_id in running_adapters:
                results[adapter_id] = await self._stop_adapter_safe(adapter_id)
        
        return results
    
    async def _stop_adapter_safe(self, adapter_id: str) -> bool:
        """安全停止适配器（不抛出异常）"""
        try:
            return await self.stop_adapter(adapter_id)
        except Exception:
            return False
    
    def get_registry_status(self) -> Dict[str, Any]:
        """获取注册中心状态"""
        registered_count = len(self._registrations)
        running_count = len([
            r for r in self._registrations.values()
            if r.status == AdapterRegistrationStatus.RUNNING
        ])
        error_count = len([
            r for r in self._registrations.values()
            if r.status == AdapterRegistrationStatus.ERROR
        ])
        
        return {
            "status": self.status.value,
            "registered_adapters": registered_count,
            "running_adapters": running_count,
            "error_adapters": error_count,
            "health_monitoring_enabled": self.enable_health_monitoring,
            "auto_recovery_enabled": self.enable_auto_recovery,
            "security_enabled": self.enable_security,
            "stats": self._stats.copy(),
            "uptime": (
                datetime.now(timezone.utc) - self._stats["start_time"]
            ).total_seconds() if self._stats["start_time"] else 0
        }
    
    async def get_health_summary(self) -> Dict[str, Any]:
        """获取健康状态摘要"""
        if self.health_monitor:
            return await self.health_monitor.get_health_summary()
        else:
            return {
                "message": "Health monitoring is disabled",
                "total_adapters": len(self._registrations),
                "last_check": None
            }
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """获取性能摘要"""
        return self.performance_monitor.get_system_metrics()
    
    def get_adapter_performance(self, adapter_id: str) -> Dict[str, Any]:
        """获取适配器性能指标"""
        return self.performance_monitor.get_adapter_metrics(adapter_id)
    
    async def get_adapter_info(self, adapter_id: str) -> Dict[str, Any]:
        """
        获取适配器详细信息
        
        Args:
            adapter_id: 适配器ID
            
        Returns:
            包含适配器信息的字典
            
        Raises:
            AdapterNotFoundError: 适配器不存在
        """
        registration = self.get_registration(adapter_id)
        if not registration:
            raise AdapterNotFoundError(f"Adapter {adapter_id} not found")
        
        adapter = self.get_adapter(adapter_id)
        
        info = {
            "id": adapter_id,
            "name": registration.name,
            "version": registration.version,
            "status": registration.status.value,
            "adapter_type": registration.adapter_type.value if registration.adapter_type else None,
            "created_at": registration.created_at.isoformat() if registration.created_at else None,
            "last_updated": registration.last_updated.isoformat() if registration.last_updated else None,
            "dependencies": list(registration.dependencies),
            "tags": list(registration.tags),
            "metadata": registration.metadata or {}
        }
        
        # 添加运行时信息
        if adapter:
            info["instance_id"] = id(adapter)
            info["is_initialized"] = getattr(adapter, '_initialized', False)
        
        # 添加性能指标
        try:
            performance_metrics = self.get_adapter_performance(adapter_id)
            info["performance"] = performance_metrics
        except Exception:
            info["performance"] = {}
        
        return info
    
    async def health_check_adapter(self, adapter_id: str) -> HealthCheckResult:
        """
        对指定适配器执行健康检查
        
        Args:
            adapter_id: 适配器ID
            
        Returns:
            健康检查结果
            
        Raises:
            AdapterNotFoundError: 适配器不存在
        """
        registration = self.get_registration(adapter_id)
        if not registration:
            raise AdapterNotFoundError(f"Adapter {adapter_id} not found")
        
        adapter = self.get_adapter(adapter_id)
        if not adapter:
            return HealthCheckResult(
                is_healthy=False,
                status="not_running",
                message=f"Adapter {adapter_id} is not running",
                timestamp=datetime.now(timezone.utc)
            )
        
        try:
            # 调用适配器的健康检查方法
            if hasattr(adapter, 'health_check'):
                result = await adapter.health_check()
                if isinstance(result, HealthCheckResult):
                    return result
                else:
                    # 如果返回的不是HealthCheckResult，创建一个
                    return HealthCheckResult(
                        is_healthy=bool(result),
                        status="healthy" if result else "unhealthy",
                        timestamp=datetime.now(timezone.utc)
                    )
            else:
                # 如果适配器没有健康检查方法，检查基本状态
                is_healthy = (
                    registration.status == AdapterRegistrationStatus.RUNNING and
                    getattr(adapter, '_initialized', False)
                )
                return HealthCheckResult(
                    is_healthy=is_healthy,
                    status="healthy" if is_healthy else "unhealthy",
                    message="Basic status check",
                    timestamp=datetime.now(timezone.utc)
                )
        
        except Exception as e:
            self.logger.error(f"Health check failed for adapter {adapter_id}: {e}")
            return HealthCheckResult(
                is_healthy=False,
                status="error",
                message=f"Health check error: {str(e)}",
                timestamp=datetime.now(timezone.utc)
            )
    
    async def execute_adapter(
        self, 
        adapter_id: str, 
        input_data: Any, 
        context: Optional[ExecutionContext] = None
    ) -> ExecutionResult:
        """
        执行指定适配器
        
        Args:
            adapter_id: 适配器ID
            input_data: 输入数据
            context: 执行上下文
            
        Returns:
            执行结果
            
        Raises:
            AdapterNotFoundError: 适配器不存在
            AdapterLoadingError: 适配器未运行
        """
        registration = self.get_registration(adapter_id)
        if not registration:
            raise AdapterNotFoundError(f"Adapter {adapter_id} not found")
        
        adapter = self.get_adapter(adapter_id)
        if not adapter:
            raise AdapterLoadingError(f"Adapter {adapter_id} is not running")
        
        # 检查适配器状态
        if registration.status != AdapterRegistrationStatus.RUNNING:
            raise AdapterLoadingError(f"Adapter {adapter_id} is not in running state")
        
        # 创建默认执行上下文
        if context is None:
            context = ExecutionContext()
        
        start_time = time.time()
        
        try:
            # 记录操作开始
            self.performance_monitor.record_operation(
                adapter_id, "execute", 0, True  # 临时记录，稍后更新
            )
            
            # 执行适配器
            if hasattr(adapter, 'execute'):
                result = await adapter.execute(input_data, context)
            elif hasattr(adapter, 'process'):
                result = await adapter.process(input_data, context)
            elif hasattr(adapter, '__call__'):
                result = await adapter(input_data, context)
            else:
                raise AdapterLoadingError(f"Adapter {adapter_id} has no execute method")
            
            # 确保返回ExecutionResult
            if not isinstance(result, ExecutionResult):
                result = ExecutionResult(
                    status="success",
                    output=result,
                    adapter_id=adapter_id,
                    execution_time=time.time() - start_time,
                    context=context
                )
            
            # 记录成功操作
            duration = time.time() - start_time
            self.performance_monitor.record_operation(
                adapter_id, "execute", duration, True
            )
            
            return result
            
        except Exception as e:
            # 记录失败操作
            duration = time.time() - start_time
            self.performance_monitor.record_operation(
                adapter_id, "execute", duration, False
            )
            
            self.logger.error(f"Execution failed for adapter {adapter_id}: {e}")
            
            return ExecutionResult(
                status="error",
                output=None,
                error=str(e),
                adapter_id=adapter_id,
                execution_time=duration,
                context=context
            )
    
    async def get_statistics(self) -> Dict[str, Any]:
        """
        获取注册中心统计信息
        
        Returns:
            包含统计信息的字典
        """
        # 基本统计
        total_adapters = len(self._registrations)
        running_adapters = sum(
            1 for reg in self._registrations.values() 
            if reg.status == AdapterRegistrationStatus.RUNNING
        )
        stopped_adapters = sum(
            1 for reg in self._registrations.values() 
            if reg.status == AdapterRegistrationStatus.STOPPED
        )
        failed_adapters = sum(
            1 for reg in self._registrations.values() 
            if reg.status == AdapterRegistrationStatus.FAILED
        )
        
        # 按类型统计
        type_stats = {}
        for reg in self._registrations.values():
            if reg.adapter_type:
                type_name = reg.adapter_type.value
                type_stats[type_name] = type_stats.get(type_name, 0) + 1
        
        # 依赖关系统计
        dependency_stats = {
            "total_dependencies": sum(len(reg.dependencies) for reg in self._registrations.values()),
            "adapters_with_dependencies": sum(
                1 for reg in self._registrations.values() 
                if reg.dependencies
            ),
            "circular_dependencies": len(self._dependency_graph.has_circular_dependency())
        }
        
        # 性能统计
        performance_stats = self.get_performance_summary()
        
        # 健康状态统计
        health_stats = {"healthy": 0, "unhealthy": 0, "unknown": 0}
        if self.health_monitor:
            try:
                health_summary = await self.get_health_summary()
                for adapter_health in health_summary.get("adapters", {}).values():
                    if adapter_health.get("is_healthy"):
                        health_stats["healthy"] += 1
                    else:
                        health_stats["unhealthy"] += 1
            except Exception:
                health_stats["unknown"] = total_adapters
        else:
            health_stats["unknown"] = total_adapters
        
        # 事件统计
        event_stats = {}
        if hasattr(self.event_bus, '_event_history'):
            recent_events = self.event_bus.get_recent_events(limit=1000)
            for event in recent_events:
                event_type = event.event_type.value
                event_stats[event_type] = event_stats.get(event_type, 0) + 1
        
        return {
            "total_adapters": total_adapters,
            "running_adapters": running_adapters,
            "stopped_adapters": stopped_adapters,
            "failed_adapters": failed_adapters,
            "registry_status": self.status.value,
            "adapter_types": type_stats,
            "dependencies": dependency_stats,
            "health": health_stats,
            "performance": performance_stats,
            "events": event_stats,
            "uptime": (datetime.now(timezone.utc) - self._start_time).total_seconds() if hasattr(self, '_start_time') else 0
        }
    
    # ================================
    # 上下文管理器支持
    # ================================
    
    async def __aenter__(self):
        """异步上下文管理器入口"""
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        await self.stop()
    
    def __str__(self) -> str:
        return f"AdapterRegistry(status={self.status.value}, adapters={len(self._registrations)})"
    
    def __repr__(self) -> str:
        return (f"{self.__class__.__name__}(status={self.status.value}, "
                f"adapters={len(self._registrations)}, running={self.status == RegistryStatus.RUNNING})")


# ================================
# 工厂函数和默认实例
# ================================

def create_adapter_registry(
    metadata_manager: Optional[MetadataManager] = None,
    enable_health_monitoring: bool = True,
    health_check_interval: int = 30,
    max_concurrent_operations: int = 10,
    enable_auto_recovery: bool = True,
    enable_security: bool = True,
    **kwargs
) -> AdapterRegistry:
    """创建适配器注册中心实例"""
    return AdapterRegistry(
        metadata_manager=metadata_manager,
        enable_health_monitoring=enable_health_monitoring,
        health_check_interval=health_check_interval,
        max_concurrent_operations=max_concurrent_operations,
        enable_auto_recovery=enable_auto_recovery,
        enable_security=enable_security,
        **kwargs
    )


# 默认的全局注册中心实例
_default_registry: Optional[AdapterRegistry] = None

def get_default_registry() -> AdapterRegistry:
    """获取默认的注册中心实例"""
    global _default_registry
    if _default_registry is None:
        _default_registry = create_adapter_registry()
    return _default_registry

def set_default_registry(registry: AdapterRegistry):
    """设置默认的注册中心实例"""
    global _default_registry
    _default_registry = registry


# ================================
# 便利函数
# ================================

async def register_adapter_from_class(
    adapter_class: Type[BaseAdapter],
    config: Dict[str, Any],
    auto_start: bool = False,
    registry: Optional[AdapterRegistry] = None
) -> AdapterRegistration:
    """便利函数：从适配器类注册适配器"""
    registry = registry or get_default_registry()
    adapter_id = config.get('adapter_id') or f"{adapter_class.__name__.lower()}_{uuid.uuid4().hex[:8]}"
    
    return await registry.register_adapter(
        adapter_id=adapter_id,
        adapter_class=adapter_class,
        config=config,
        auto_start=auto_start
    )


async def quick_start_adapters(
    adapter_configs: List[Dict[str, Any]],
    registry: Optional[AdapterRegistry] = None
) -> Dict[str, bool]:
    """便利函数：快速启动多个适配器"""
    registry = registry or get_default_registry()
    results = {}
    
    # 确保注册中心已启动
    if registry.status == RegistryStatus.INITIALIZING:
        await registry.start()
    
    # 注册并启动适配器
    for config in adapter_configs:
        adapter_id = config.get('adapter_id')
        adapter_class = config.get('adapter_class')
        
        if not adapter_id or not adapter_class:
            results[f"invalid_config_{len(results)}"] = False
            continue
        
        try:
            await registry.register_adapter(
                adapter_id=adapter_id,
                adapter_class=adapter_class,
                config=config,
                auto_start=True
            )
            results[adapter_id] = True
        except Exception as e:
            logger.error(f"Failed to start adapter {adapter_id}: {e}")
            results[adapter_id] = False
    
    return results


# ================================
# 导出列表
# ================================

__all__ = [
    # 枚举类
    'RegistryStatus',
    'AdapterRegistrationStatus', 
    'EventType',
    
    # 数据结构
    'AdapterRegistration',
    'RegistryEvent',
    'DependencyGraph',
    
    # 核心组件
    'EventBus',
    'HealthMonitor',
    'SecurityManager',
    'PerformanceMonitor',
    'AdapterRegistry',
    
    # 工厂函数
    'create_adapter_registry',
    'get_default_registry',
    'set_default_registry',
    
    # 便利函数
    'register_adapter_from_class',
    'quick_start_adapters',
]
