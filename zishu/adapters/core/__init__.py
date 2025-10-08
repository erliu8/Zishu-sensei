"""
适配器核心模块 - 微服务架构版本

这个模块包含了基于微服务架构重构的适配器系统核心组件：
- manager: 适配器管理器 - 统一的适配器管理入口
- services: 微服务组件 - 各种专门的服务
- events: 事件系统 - 事件总线和处理器
- types: 类型定义 - 数据结构和接口定义
"""

# 主要管理器
from .manager import AdapterManager, AdapterManagerConfig

# 服务组件
from .services import (
    AsyncService,
    ServiceStatus,
    ServiceHealth,
    AdapterServiceOrchestrator,
    OrchestratorConfig,
    AdapterRegistryService,
    AdapterValidationService,
    AdapterHealthService,
    AdapterEventService,
)

# 事件系统
from .events import (
    EventBus,
    Event,
    EventType,
    Priority,
    AdapterEventHandler,
    LifecycleEventHandler,
    HealthEventHandler,
    ErrorEventHandler,
)

# 类型定义
from .types import (
    AdapterConfiguration,
    AdapterRegistration,
    AdapterIdentity,
    AdapterStatus,
    LifecycleState,
    HealthCheckResult,
    ValidationResult,
    ServiceMetrics,
)

# 安全模块
from .security import SecurityManager, SecurityServiceConfig

__all__ = [
    # 管理器
    "AdapterManager",
    "AdapterManagerConfig",
    # 服务基础
    "AsyncService",
    "ServiceStatus",
    "ServiceHealth",
    # 服务组件
    "AdapterServiceOrchestrator",
    "OrchestratorConfig",
    "AdapterRegistryService",
    "AdapterValidationService",
    "AdapterHealthService",
    "AdapterEventService",
    # 事件系统
    "EventBus",
    "Event",
    "EventType",
    "Priority",
    "AdapterEventHandler",
    "LifecycleEventHandler",
    "HealthEventHandler",
    "ErrorEventHandler",
    # 类型定义
    "AdapterConfiguration",
    "AdapterRegistration",
    "AdapterIdentity",
    "AdapterStatus",
    "LifecycleState",
    "HealthCheckResult",
    "ValidationResult",
    "ServiceMetrics",
    # 安全模块
    "SecurityManager",
    "SecurityServiceConfig",
]
