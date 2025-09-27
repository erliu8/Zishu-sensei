"""
紫舒老师适配器系统 - 基础模块
=================================

这个包提供了适配器系统的核心基础设施：
- 基础适配器类
- 注册中心
- 元数据管理
- 异常处理
- 事件系统

主要组件：
- BaseAdapter: 适配器基类
- AdapterRegistry: 适配器注册中心
- MetadataManager: 元数据管理器
- 异常处理系统
- 事件总线系统

使用方法：
```python
from zishu.adapters.base import BaseAdapter, AdapterRegistry

# 创建适配器
class MyAdapter(BaseAdapter):
    # 实现抽象方法...
    pass

# 创建注册中心
registry = AdapterRegistry()
await registry.start()

# 注册适配器
await registry.register_adapter("my_adapter", MyAdapter, config)
```
"""

# 版本信息
__version__ = "1.0.0"
__author__ = "紫舒老师适配器团队"
__email__ = "adapters@zishu.team"

# ================================
# 核心类导入
# ================================

# 基础适配器
from .adapter import (
    BaseAdapter,
    ExecutionContext,
    ExecutionResult,
    HealthCheckResult
)

# 注册中心
from .registry import (
    AdapterRegistry,
    AdapterRegistration,
    RegistryEvent,
    EventBus,
    HealthMonitor,
    SecurityManager,
    PerformanceMonitor,
    DependencyGraph,
    create_adapter_registry,
    get_default_registry,
    set_default_registry,
    register_adapter_from_class,
    quick_start_adapters
)

# 元数据管理
from .metadata import (
    AdapterMetadata,
    AdapterCapability,
    AdapterDependency,
    AdapterPermissions,
    MetadataManager,
    get_default_metadata_manager,
    create_metadata_manager
)

# 异常系统
from .exceptions import (
    BaseAdapterException,
    AdapterRegistrationError,
    AdapterNotFoundError,
    AdapterAlreadyExistsError,
    AdapterLoadingError,
    AdapterExecutionError,
    AdapterValidationError,
    AdapterConfigurationError,
    AdapterTimeoutError,
    AdapterDependencyError,
    ErrorCode,
    ExceptionSeverity,
    handle_adapter_exceptions
)

# 验证器系统
from .validator import (
    AdapterValidator,
    ValidationResult,
    ValidationIssue,
    ValidationConfig,
    ValidationSeverity,
    ValidationCategory,
    ValidatorMode,
    ValidationRule,
    create_validator,
    create_development_validator,
    create_production_validator,
    get_default_validator,
    set_default_validator,
    validate_adapter_class,
    validate_adapter_instance,
    quick_validate
)

# 枚举类型
from .metadata import (
    AdapterType,
    AdapterStatus,
    SecurityLevel,
    DependencyType
)

from .registry import (
    RegistryStatus,
    AdapterRegistrationStatus,
    EventType
)

# ================================
# 便利函数和工厂方法
# ================================

def create_simple_registry():
    """创建简单的注册中心实例（默认配置）"""
    return create_adapter_registry(
        enable_health_monitoring=True,
        enable_security=False,
        max_concurrent_operations=5
    )

def create_production_registry():
    """创建生产环境注册中心实例（完整功能）"""
    return create_adapter_registry(
        enable_health_monitoring=True,
        enable_security=True,
        enable_auto_recovery=True,
        max_concurrent_operations=10,
        health_check_interval=30
    )

def create_development_registry():
    """创建开发环境注册中心实例（调试友好）"""
    return create_adapter_registry(
        enable_health_monitoring=True,
        enable_security=False,
        enable_auto_recovery=False,
        max_concurrent_operations=3,
        health_check_interval=10
    )

# ================================
# 导出列表
# ================================

__all__ = [
    # 版本信息
    "__version__",
    "__author__", 
    "__email__",
    
    # 核心类 - 适配器
    "BaseAdapter",
    "ExecutionContext",
    "ExecutionResult",
    "HealthCheckResult",
    
    # 核心类 - 注册中心
    "AdapterRegistry",
    "AdapterRegistration",
    "RegistryEvent", 
    "EventBus",
    "HealthMonitor",
    "SecurityManager",
    "PerformanceMonitor",
    "DependencyGraph",
    
    # 核心类 - 元数据
    "AdapterMetadata",
    "AdapterCapability",
    "AdapterDependency",
    "AdapterPermissions",
    "MetadataManager",
    
    # 异常类
    "BaseAdapterException",
    "AdapterRegistrationError",
    "AdapterNotFoundError",
    "AdapterAlreadyExistsError",
    "AdapterLoadingError",
    "AdapterExecutionError",
    "AdapterValidationError",
    "AdapterConfigurationError",
    "AdapterTimeoutError",
    "AdapterDependencyError",
    
    # 验证器类
    "AdapterValidator",
    "ValidationResult",
    "ValidationIssue",
    "ValidationConfig",
    "ValidationRule",
    
    # 枚举类型
    "AdapterType",
    "AdapterStatus",
    "SecurityLevel",
    "DependencyType",
    "RegistryStatus",
    "AdapterRegistrationStatus",
    "EventType",
    "ErrorCode",
    "ExceptionSeverity",
    "ValidationSeverity",
    "ValidationCategory", 
    "ValidatorMode",
    
    # 工厂函数
    "create_adapter_registry",
    "get_default_registry",
    "set_default_registry",
    "create_metadata_manager",
    "get_default_metadata_manager",
    "create_simple_registry",
    "create_production_registry", 
    "create_development_registry",
    
    # 便利函数
    "register_adapter_from_class",
    "quick_start_adapters",
    "handle_adapter_exceptions",
    
    # 验证器函数
    "create_validator",
    "create_development_validator", 
    "create_production_validator",
    "get_default_validator",
    "set_default_validator",
    "validate_adapter_class",
    "validate_adapter_instance",
    "quick_validate",
]