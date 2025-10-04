"""
适配器系统 - 基础模块
=================================

这个包提供了适配器系统的核心基础设施。
已重构为微服务架构，旧的单体组件已移除。

主要组件现在位于：
- zishu.adapters.core: 核心微服务组件
- zishu.adapters.manager: 管理器组件

使用方法：
```python
from zishu.adapters.core import AdapterManager
from zishu.adapters.base import BaseAdapter

# 创建适配器
class MyAdapter(BaseAdapter):
    # 实现抽象方法...
    pass

# 使用新的微服务管理器
manager = AdapterManager()
await manager.start()
```
"""

# 版本信息
__version__ = "2.0.0"
__author__ = "紫舒老师团队"
__email__ = "adapters@zishu.team"

# ================================
# 核心类导入 (仅保留必要的基础组件)
# ================================

# 基础适配器
from .adapter import (
    BaseAdapter,
    ExecutionContext,
    ExecutionResult,
    HealthCheckResult
)

# 元数据管理 (仅基础组件)
from .metadata import (
    AdapterMetadata,
    AdapterCapability,
    AdapterDependency,
    AdapterPermissions,
    AdapterType,
    AdapterStatus,
    SecurityLevel
)

# 异常系统 (保留基础异常)
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
    DependencyMissingError,
    ErrorCode,
    ExceptionSeverity,
    handle_adapter_exceptions
)

# ================================
# 向后兼容性适配器
# ================================

# 为了保持向后兼容，提供简单的适配器类
# 这些类内部使用新的微服务架构

class AdapterRegistry:
    """向后兼容的适配器注册表
    
    注意：此类已废弃，请使用 zishu.adapters.core.AdapterRegistryService
    """
    def __init__(self, *args, **kwargs):
        import warnings
        warnings.warn(
            "AdapterRegistry已废弃，请使用zishu.adapters.core.AdapterRegistryService",
            DeprecationWarning,
            stacklevel=2
        )
        # 为了避免破坏现有代码，提供最小实现
        self._registry = {}
    
    def register_adapter(self, adapter_id: str, adapter_info: dict) -> bool:
        """注册适配器（向后兼容实现）"""
        self._registry[adapter_id] = adapter_info
        return True
    
    def get_adapter_info(self, adapter_id: str) -> dict:
        """获取适配器信息（向后兼容实现）"""
        return self._registry.get(adapter_id, {})
    
    def list_all(self) -> dict:
        """列出所有适配器（向后兼容实现）"""
        return self._registry.copy()

class HealthMonitor:
    """向后兼容的健康监控器
    
    注意：此类已废弃，请使用 zishu.adapters.core.AdapterHealthService
    """
    def __init__(self, registry=None):
        import warnings
        warnings.warn(
            "HealthMonitor已废弃，请使用zishu.adapters.core.AdapterHealthService",
            DeprecationWarning,
            stacklevel=2
        )
        self.registry = registry

class SecurityManager:
    """向后兼容的安全管理器
    
    注意：此类已废弃，请使用 zishu.adapters.core.AdapterSecurityService
    """
    def __init__(self, *args, **kwargs):
        import warnings
        warnings.warn(
            "SecurityManager已废弃，请使用zishu.adapters.core.AdapterSecurityService",
            DeprecationWarning,
            stacklevel=2
        )

class PerformanceMonitor:
    """向后兼容的性能监控器
    
    注意：此类已废弃，请使用 zishu.adapters.core.AdapterPerformanceService
    """
    def __init__(self, *args, **kwargs):
        import warnings
        warnings.warn(
            "PerformanceMonitor已废弃，请使用zishu.adapters.core.AdapterPerformanceService",
            DeprecationWarning,
            stacklevel=2
        )

# ================================
# 便利函数 (向后兼容)
# ================================

def create_adapter_registry(*args, **kwargs):
    """创建适配器注册表（向后兼容）"""
    import warnings
    warnings.warn(
        "create_adapter_registry已废弃，请使用zishu.adapters.core中的新API",
        DeprecationWarning,
        stacklevel=2
    )
    return AdapterRegistry()

def get_default_registry():
    """获取默认注册表（向后兼容）"""
    import warnings
    warnings.warn(
        "get_default_registry已废弃，请使用zishu.adapters.core中的新API",
        DeprecationWarning,
        stacklevel=2
    )
    return AdapterRegistry()

def set_default_registry(registry):
    """设置默认注册表（向后兼容）"""
    import warnings
    warnings.warn(
        "set_default_registry已废弃，请使用zishu.adapters.core中的新API",
        DeprecationWarning,
        stacklevel=2
    )
    pass

# ================================
# 导出列表 (大幅简化)
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
    
    # 元数据
    "AdapterMetadata",
    "AdapterCapability",
    "AdapterDependency",
    "AdapterPermissions",
    
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
    "DependencyMissingError",
    
    # 枚举类型
    "AdapterType",
    "AdapterStatus",
    "SecurityLevel",
    "ErrorCode",
    "ExceptionSeverity",
    
    # 向后兼容类 (已废弃)
    "AdapterRegistry",
    "HealthMonitor",
    "SecurityManager", 
    "PerformanceMonitor",
    
    # 向后兼容函数 (已废弃)
    "create_adapter_registry",
    "get_default_registry",
    "set_default_registry",
    
    # 异常处理
    "handle_adapter_exceptions",
]