"""
适配器核心类型定义

定义了适配器系统中使用的核心数据类型、枚举和数据结构。
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Union, Callable, Type, Protocol
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path


# ================================
# 核心枚举定义
# ================================


class AdapterType(str, Enum):
    """适配器类型"""

    SOFT = "soft"  # 软适配器（基于提示词）
    HARD = "hard"  # 硬适配器（基于代码）
    INTELLIGENT = "intelligent"  # 智能适配器（基于微调模型）
    HYBRID = "hybrid"  # 混合适配器


class AdapterStatus(str, Enum):
    """适配器状态"""

    UNKNOWN = "unknown"  # 未知状态
    REGISTERED = "registered"  # 已注册
    INITIALIZING = "initializing"  # 初始化中
    READY = "ready"  # 就绪
    RUNNING = "running"  # 运行中
    PAUSED = "paused"  # 已暂停
    STOPPING = "stopping"  # 停止中
    STOPPED = "stopped"  # 已停止
    ERROR = "error"  # 错误状态
    FAILED = "failed"  # 失败状态


class LifecycleState(str, Enum):
    """生命周期状态"""

    CREATED = "created"  # 已创建
    INITIALIZING = "initializing"  # 初始化中
    INITIALIZED = "initialized"  # 已初始化
    STARTING = "starting"  # 启动中
    RUNNING = "running"  # 运行中
    PAUSING = "pausing"  # 暂停中
    PAUSED = "paused"  # 已暂停
    RESUMING = "resuming"  # 恢复中
    STOPPING = "stopping"  # 停止中
    STOPPED = "stopped"  # 已停止
    DESTROYING = "destroying"  # 销毁中
    DESTROYED = "destroyed"  # 已销毁
    ERROR = "error"  # 错误状态


class EventType(str, Enum):
    """事件类型"""

    # 生命周期事件
    LIFECYCLE_STATE_CHANGED = "lifecycle.state_changed"
    LIFECYCLE_ERROR = "lifecycle.error"

    # 注册事件
    ADAPTER_REGISTERED = "adapter.registered"
    ADAPTER_UNREGISTERED = "adapter.unregistered"
    ADAPTER_UPDATED = "adapter.updated"

    # 运行时事件
    ADAPTER_STARTED = "adapter.started"
    ADAPTER_STOPPED = "adapter.stopped"
    ADAPTER_PAUSED = "adapter.paused"
    ADAPTER_RESUMED = "adapter.resumed"
    ADAPTER_ERROR = "adapter.error"

    # 健康检查事件
    HEALTH_CHECK_PASSED = "health.check_passed"
    HEALTH_CHECK_FAILED = "health.check_failed"
    HEALTH_STATUS_CHANGED = "health.status_changed"

    # 性能事件
    PERFORMANCE_THRESHOLD_EXCEEDED = "performance.threshold_exceeded"
    RESOURCE_USAGE_HIGH = "performance.resource_usage_high"

    # 安全事件
    SECURITY_VIOLATION = "security.violation"
    PERMISSION_DENIED = "security.permission_denied"


class HealthStatus(str, Enum):
    """健康状态"""

    HEALTHY = "healthy"  # 健康
    DEGRADED = "degraded"  # 降级
    UNHEALTHY = "unhealthy"  # 不健康
    UNKNOWN = "unknown"  # 未知


class SecurityLevel(str, Enum):
    """安全级别"""

    PUBLIC = "public"  # 公开
    INTERNAL = "internal"  # 内部
    RESTRICTED = "restricted"  # 受限
    CONFIDENTIAL = "confidential"  # 机密


class Priority(int, Enum):
    """优先级"""

    CRITICAL = 1  # 关键
    HIGH = 2  # 高
    MEDIUM = 3  # 中等
    LOW = 4  # 低
    BACKGROUND = 5  # 后台


# ================================
# 核心数据结构
# ================================


@dataclass
class AdapterIdentity:
    """适配器身份信息"""

    adapter_id: str
    name: str
    version: str
    adapter_type: AdapterType
    description: Optional[str] = None
    author: Optional[str] = None
    tags: Set[str] = field(default_factory=set)

    def __post_init__(self):
        """验证身份信息"""
        if not self.adapter_id:
            raise ValueError("adapter_id cannot be empty")
        if not self.name:
            raise ValueError("name cannot be empty")
        if not self.version:
            raise ValueError("version cannot be empty")


@dataclass
class AdapterConfiguration:
    """适配器配置"""

    config: Dict[str, Any] = field(default_factory=dict)
    environment: Dict[str, str] = field(default_factory=dict)
    resources: Dict[str, Any] = field(default_factory=dict)
    security_level: SecurityLevel = SecurityLevel.INTERNAL
    priority: Priority = Priority.MEDIUM

    def get(self, key: str, default: Any = None) -> Any:
        """获取配置值"""
        return self.config.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """设置配置值"""
        self.config[key] = value

    def update(self, config: Dict[str, Any]) -> None:
        """更新配置"""
        self.config.update(config)


@dataclass
class AdapterMetrics:
    """适配器指标"""

    execution_count: int = 0
    success_count: int = 0
    error_count: int = 0
    total_execution_time: float = 0.0
    average_execution_time: float = 0.0
    last_execution_time: Optional[datetime] = None
    memory_usage: int = 0
    cpu_usage: float = 0.0

    def record_execution(self, execution_time: float, success: bool = True) -> None:
        """记录执行指标"""
        self.execution_count += 1
        self.total_execution_time += execution_time
        self.average_execution_time = self.total_execution_time / self.execution_count
        self.last_execution_time = datetime.now(timezone.utc)

        if success:
            self.success_count += 1
        else:
            self.error_count += 1

    @property
    def success_rate(self) -> float:
        """成功率"""
        if self.execution_count == 0:
            return 0.0
        return self.success_count / self.execution_count

    @property
    def error_rate(self) -> float:
        """错误率"""
        if self.execution_count == 0:
            return 0.0
        return self.error_count / self.execution_count


@dataclass
class AdapterRegistration:
    """适配器注册信息"""

    identity: AdapterIdentity
    adapter_class: Type
    configuration: AdapterConfiguration

    # 运行时状态
    status: AdapterStatus = AdapterStatus.REGISTERED
    lifecycle_state: LifecycleState = LifecycleState.CREATED
    instance: Optional[Any] = None

    # 时间戳
    registered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    last_health_check: Optional[datetime] = None

    # 依赖关系
    dependencies: Set[str] = field(default_factory=set)
    dependents: Set[str] = field(default_factory=set)

    # 指标和健康状态
    metrics: AdapterMetrics = field(default_factory=AdapterMetrics)
    health_status: HealthStatus = HealthStatus.UNKNOWN
    health_details: Dict[str, Any] = field(default_factory=dict)

    # 错误信息
    last_error: Optional[str] = None
    error_count: int = 0
    restart_count: int = 0

    @property
    def adapter_id(self) -> str:
        """适配器ID"""
        return self.identity.adapter_id

    @property
    def name(self) -> str:
        """适配器名称"""
        return self.identity.name

    @property
    def adapter_type(self) -> AdapterType:
        """适配器类型"""
        return self.identity.adapter_type

    def is_running(self) -> bool:
        """是否正在运行"""
        return self.lifecycle_state == LifecycleState.RUNNING

    def is_healthy(self) -> bool:
        """是否健康"""
        return self.health_status == HealthStatus.HEALTHY

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "adapter_id": self.adapter_id,
            "name": self.name,
            "version": self.identity.version,
            "adapter_type": self.adapter_type.value,
            "status": self.status.value,
            "lifecycle_state": self.lifecycle_state.value,
            "health_status": self.health_status.value,
            "registered_at": self.registered_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "stopped_at": self.stopped_at.isoformat() if self.stopped_at else None,
            "dependencies": list(self.dependencies),
            "dependents": list(self.dependents),
            "metrics": {
                "execution_count": self.metrics.execution_count,
                "success_count": self.metrics.success_count,
                "error_count": self.metrics.error_count,
                "success_rate": self.metrics.success_rate,
                "average_execution_time": self.metrics.average_execution_time,
            },
            "error_count": self.error_count,
            "restart_count": self.restart_count,
            "last_error": self.last_error,
        }


@dataclass
class Event:
    """事件数据结构"""

    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    event_type: EventType = EventType.LIFECYCLE_STATE_CHANGED
    source: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    data: Dict[str, Any] = field(default_factory=dict)
    priority: Priority = Priority.MEDIUM

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "event_id": self.event_id,
            "event_type": self.event_type.value,
            "source": self.source,
            "timestamp": self.timestamp.isoformat(),
            "data": self.data,
            "priority": self.priority.value,
        }


@dataclass
class HealthCheckResult:
    """健康检查结果"""

    status: HealthStatus
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    checks: Dict[str, bool] = field(default_factory=dict)
    details: Dict[str, Any] = field(default_factory=dict)
    message: Optional[str] = None

    @property
    def is_healthy(self) -> bool:
        """是否健康"""
        return self.status == HealthStatus.HEALTHY

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "status": self.status.value,
            "timestamp": self.timestamp.isoformat(),
            "checks": self.checks,
            "details": self.details,
            "message": self.message,
            "is_healthy": self.is_healthy,
        }


# ================================
# 协议定义
# ================================


class EventHandler(Protocol):
    """事件处理器协议"""

    async def handle_event(self, event: Event) -> None:
        """处理事件"""
        ...


class HealthChecker(Protocol):
    """健康检查器协议"""

    async def check_health(self, adapter_id: str) -> HealthCheckResult:
        """执行健康检查"""
        ...


class MetricsCollector(Protocol):
    """指标收集器协议"""

    async def collect_metrics(self, adapter_id: str) -> Dict[str, Any]:
        """收集指标"""
        ...


# ================================
# 工厂函数
# ================================


def create_adapter_identity(
    adapter_id: str, name: str, version: str, adapter_type: AdapterType, **kwargs
) -> AdapterIdentity:
    """创建适配器身份信息"""
    return AdapterIdentity(
        adapter_id=adapter_id,
        name=name,
        version=version,
        adapter_type=adapter_type,
        **kwargs,
    )


def create_adapter_configuration(
    config: Optional[Dict[str, Any]] = None, **kwargs
) -> AdapterConfiguration:
    """创建适配器配置"""
    return AdapterConfiguration(config=config or {}, **kwargs)


def create_adapter_registration(
    identity: AdapterIdentity,
    adapter_class: Type,
    configuration: Optional[AdapterConfiguration] = None,
) -> AdapterRegistration:
    """创建适配器注册信息"""
    if configuration is None:
        configuration = create_adapter_configuration()

    return AdapterRegistration(
        identity=identity, adapter_class=adapter_class, configuration=configuration
    )


def create_event(
    event_type: EventType,
    source: str,
    data: Optional[Dict[str, Any]] = None,
    priority: Priority = Priority.MEDIUM,
) -> Event:
    """创建事件"""
    return Event(
        event_type=event_type, source=source, data=data or {}, priority=priority
    )
