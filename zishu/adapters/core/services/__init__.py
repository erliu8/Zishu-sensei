"""
适配器服务模块

提供异步服务基础设施，包括：
- AsyncService基类
- ServiceOrchestrator协调器
- 服务健康检查
- 生命周期管理
"""

from .base import (
    AsyncService,
    ServiceStatus,
    ServiceHealth,
    HealthCheckResult,
    ServiceMetrics,
)
from .orchestrator import AdapterOrchestrator
from .registry_service import AdapterRegistryService
from .validation_service import (
    AdapterValidationService,
    ValidationRule,
    ValidationResult,
    ValidationIssue,
    ValidationSeverity,
    ValidationCategory,
)
from .health_service import (
    AdapterHealthService,
    HealthMonitor,
    HealthMetric,
    HealthThreshold,
    AdapterHealthStatus,
    HealthMetricType,
)
from .event_service import (
    AdapterEventService,
    EventSubscription,
    EventDeliveryResult,
    EventMetrics,
    EventDeliveryMode,
    EventPersistenceMode,
    LoggingEventHandler,
    MetricsEventHandler,
    FilterEventHandler,
)

__all__ = [
    # 基础服务
    "AsyncService",
    "ServiceStatus",
    "ServiceHealth",
    "HealthCheckResult",
    "ServiceMetrics",
    # 核心服务
    "AdapterOrchestrator",
    "AdapterRegistryService",
    # 验证服务
    "AdapterValidationService",
    "ValidationRule",
    "ValidationResult",
    "ValidationIssue",
    "ValidationSeverity",
    "ValidationCategory",
    # 健康服务
    "AdapterHealthService",
    "HealthMonitor",
    "HealthMetric",
    "HealthThreshold",
    "AdapterHealthStatus",
    "HealthMetricType",
    # 事件服务
    "AdapterEventService",
    "EventSubscription",
    "EventDeliveryResult",
    "EventMetrics",
    "EventDeliveryMode",
    "EventPersistenceMode",
    "LoggingEventHandler",
    "MetricsEventHandler",
    "FilterEventHandler",
]
