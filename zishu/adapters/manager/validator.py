"""
适配器验证器
"""

import asyncio
import inspect
import ast
import re
import time
import traceback
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Set, Union, Callable, Tuple, Type
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timezone, timedelta
from pathlib import Path
import logging
import weakref
from contextlib import asynccontextmanager

# 本地模块导入
from .adapter import BaseAdapter, ExecutionContext, ExecutionResult, HealthCheckResult
from .metadata import (
    AdapterMetadata, AdapterType, AdapterStatus, SecurityLevel,
    AdapterCapability, AdapterDependency, AdapterConfiguration,
    CapabilityCategory, MetadataManager, get_default_metadata_manager
)
from .exceptions import (
    BaseAdapterException, AdapterValidationError, AdapterConfigurationError,
    AdapterLoadingError, SecurityViolationError, DependencyMissingError,
    ErrorCode, ExceptionSeverity, handle_adapter_exceptions
)
from .registry import AdapterRegistry, get_default_registry

# 配置日志
logger = logging.getLogger(__name__)

# ================================
# 常量和枚举定义
# ================================

class ValidationSeverity(str, Enum):
    """验证问题严重程度"""
    INFO = "info"                   # 信息提示
    WARNING = "warning"             # 警告
    ERROR = "error"                 # 错误
    CRITICAL = "critical"           # 严重错误

class ValidationCategory(str, Enum):
    """验证类别"""
    STRUCTURE = "structure"         # 结构验证
    METADATA = "metadata"           # 元数据验证
    CONFIGURATION = "configuration" # 配置验证
    DEPENDENCIES = "dependencies"   # 依赖验证
    SECURITY = "security"           # 安全验证
    PERFORMANCE = "performance"     # 性能验证
    COMPATIBILITY = "compatibility" # 兼容性验证
    RUNTIME = "runtime"             # 运行时验证

class ValidatorMode(str, Enum):
    """验证器模式"""
    STRICT = "strict"               # 严格模式：所有错误都阻止继续
    PERMISSIVE = "permissive"       # 宽松模式：只有严重错误阻止继续
    DEVELOPMENT = "development"     # 开发模式：记录所有问题但不阻止
    PRODUCTION = "production"       # 生产模式：严格验证，优化性能

# ================================
# 核心数据结构
# ================================

@dataclass
class ValidationIssue:
    """验证问题"""
    severity: ValidationSeverity
    category: ValidationCategory
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    location: Optional[str] = None
    suggestion: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "severity": self.severity.value,
            "category": self.category.value,
            "code": self.code,
            "message": self.message,
            "details": self.details,
            "location": self.location,
            "suggestion": self.suggestion,
            "timestamp": self.timestamp.isoformat()
        }
    
    def __str__(self) -> str:
        location_str = f" ({self.location})" if self.location else ""
        return f"[{self.severity.value.upper()}] {self.message}{location_str}"

@dataclass
class ValidationResult:
    """验证结果"""
    is_valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    warnings: List[ValidationIssue] = field(default_factory=list)
    errors: List[ValidationIssue] = field(default_factory=list)
    critical_errors: List[ValidationIssue] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    validation_time: float = 0.0
    validator_version: str = "1.0.0"
    
    def __post_init__(self):
        """后处理初始化"""
        # 按严重程度分类问题
        for issue in self.issues:
            if issue.severity == ValidationSeverity.WARNING:
                self.warnings.append(issue)
            elif issue.severity == ValidationSeverity.ERROR:
                self.errors.append(issue)
            elif issue.severity == ValidationSeverity.CRITICAL:
                self.critical_errors.append(issue)
    
    def add_issue(self, issue: ValidationIssue):
        """添加验证问题"""
        self.issues.append(issue)
        
        # 更新分类列表
        if issue.severity == ValidationSeverity.WARNING:
            self.warnings.append(issue)
        elif issue.severity == ValidationSeverity.ERROR:
            self.errors.append(issue)
        elif issue.severity == ValidationSeverity.CRITICAL:
            self.critical_errors.append(issue)
            
        # 更新整体有效性
        if issue.severity in (ValidationSeverity.ERROR, ValidationSeverity.CRITICAL):
            self.is_valid = False
    
    def has_errors(self) -> bool:
        """是否有错误"""
        return len(self.errors) > 0 or len(self.critical_errors) > 0
    
    def has_warnings(self) -> bool:
        """是否有警告"""
        return len(self.warnings) > 0
    
    def get_summary(self) -> Dict[str, Any]:
        """获取验证摘要"""
        return {
            "is_valid": self.is_valid,
            "total_issues": len(self.issues),
            "warnings": len(self.warnings),
            "errors": len(self.errors),
            "critical_errors": len(self.critical_errors),
            "validation_time": self.validation_time,
            "categories": self._get_category_summary()
        }
    
    def _get_category_summary(self) -> Dict[str, int]:
        """获取分类摘要"""
        category_counts = {}
        for issue in self.issues:
            category = issue.category.value
            category_counts[category] = category_counts.get(category, 0) + 1
        return category_counts
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            "is_valid": self.is_valid,
            "summary": self.get_summary(),
            "issues": [issue.to_dict() for issue in self.issues],
            "metadata": self.metadata,
            "validator_version": self.validator_version
        }

@dataclass
class ValidationConfig:
    """验证配置"""
    mode: ValidatorMode = ValidatorMode.STRICT
    enabled_categories: Set[ValidationCategory] = field(default_factory=lambda: set(ValidationCategory))
    disabled_rules: Set[str] = field(default_factory=set)
    custom_rules: List['ValidationRule'] = field(default_factory=list)
    timeout_seconds: float = 30.0
    max_issues: int = 100
    enable_performance_validation: bool = True
    enable_security_validation: bool = True
    enable_runtime_validation: bool = True
    security_level_threshold: SecurityLevel = SecurityLevel.INTERNAL
    performance_thresholds: Dict[str, float] = field(default_factory=lambda: {
        "max_initialization_time": 5.0,
        "max_processing_time": 10.0,
        "max_memory_usage_mb": 100.0,
        "min_success_rate": 0.95
    })

# ================================
# 验证规则基类
# ================================

class ValidationRule(ABC):
    """验证规则基类"""
    
    def __init__(self, rule_id: str, category: ValidationCategory, severity: ValidationSeverity = ValidationSeverity.ERROR):
        self.rule_id = rule_id
        self.category = category
        self.severity = severity
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    async def validate(self, adapter_class: Type[BaseAdapter], metadata: Optional[AdapterMetadata] = None, config: Optional[Dict[str, Any]] = None) -> List[ValidationIssue]:
        """执行验证"""
        pass
    
    def create_issue(self, code: str, message: str, details: Optional[Dict[str, Any]] = None, location: Optional[str] = None, suggestion: Optional[str] = None) -> ValidationIssue:
        """创建验证问题"""
        return ValidationIssue(
            severity=self.severity,
            category=self.category,
            code=code,
            message=message,
            details=details,
            location=location,
            suggestion=suggestion
        )

# ================================
# 内置验证规则
# ================================

class AdapterStructureRule(ValidationRule):
    """适配器结构验证规则"""
    
    def __init__(self):
        super().__init__("adapter_structure", ValidationCategory.STRUCTURE, ValidationSeverity.CRITICAL)
    
    async def validate(self, adapter_class: Type[BaseAdapter], metadata: Optional[AdapterMetadata] = None, config: Optional[Dict[str, Any]] = None) -> List[ValidationIssue]:
        issues = []
        
        # 检查是否继承自BaseAdapter
        if not issubclass(adapter_class, BaseAdapter):
            issues.append(self.create_issue(
                "not_base_adapter",
                f"Class {adapter_class.__name__} does not inherit from BaseAdapter",
                details={"class_name": adapter_class.__name__, "mro": [cls.__name__ for cls in adapter_class.__mro__]},
                suggestion="Make sure your adapter class inherits from BaseAdapter"
            ))
            return issues
        
        # 检查必需的抽象方法实现
        required_methods = ["_load_metadata", "_initialize_impl", "_process_impl", "_get_capabilities_impl", "_health_check_impl", "_cleanup_impl"]
        
        for method_name in required_methods:
            if not hasattr(adapter_class, method_name):
                issues.append(self.create_issue(
                    "missing_method",
                    f"Required method '{method_name}' is not implemented",
                    details={"method_name": method_name, "class_name": adapter_class.__name__},
                    suggestion=f"Implement the {method_name} method in your adapter class"
                ))
            else:
                method = getattr(adapter_class, method_name)
                if not callable(method):
                    issues.append(self.create_issue(
                        "method_not_callable",
                        f"Method '{method_name}' is not callable",
                        details={"method_name": method_name, "type": type(method).__name__}
                    ))
                elif method_name.endswith("_impl") and not asyncio.iscoroutinefunction(method):
                    # 检查异步方法
                    if method_name in ["_initialize_impl", "_process_impl", "_health_check_impl", "_cleanup_impl"]:
                        issues.append(self.create_issue(
                            "method_not_async",
                            f"Method '{method_name}' should be async",
                            details={"method_name": method_name},
                            suggestion=f"Make {method_name} an async method"
                        ))
        
        # 检查方法签名
        await self._validate_method_signatures(adapter_class, issues)
        
        return issues
    
    async def _validate_method_signatures(self, adapter_class: Type[BaseAdapter], issues: List[ValidationIssue]):
        """验证方法签名"""
        try:
            # 检查_process_impl方法签名
            if hasattr(adapter_class, '_process_impl'):
                sig = inspect.signature(adapter_class._process_impl)
                params = list(sig.parameters.keys())
                
                expected_params = ['self', 'input_data', 'context']
                if params != expected_params:
                    issues.append(self.create_issue(
                        "invalid_process_signature",
                        f"_process_impl method has invalid signature. Expected: {expected_params}, Got: {params}",
                        details={"expected": expected_params, "actual": params},
                        suggestion="Use signature: async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any"
                    ))
            
            # 检查_health_check_impl方法签名
            if hasattr(adapter_class, '_health_check_impl'):
                sig = inspect.signature(adapter_class._health_check_impl)
                params = list(sig.parameters.keys())
                
                if len(params) != 1 or params[0] != 'self':
                    issues.append(self.create_issue(
                        "invalid_health_check_signature",
                        f"_health_check_impl method has invalid signature. Expected: ['self'], Got: {params}",
                        details={"expected": ['self'], "actual": params},
                        suggestion="Use signature: async def _health_check_impl(self) -> HealthCheckResult"
                    ))
                    
        except Exception as e:
            issues.append(self.create_issue(
                "signature_validation_error",
                f"Error validating method signatures: {str(e)}",
                details={"error": str(e)}
            ))

class MetadataValidationRule(ValidationRule):
    """元数据验证规则"""
    
    def __init__(self):
        super().__init__("metadata_validation", ValidationCategory.METADATA, ValidationSeverity.ERROR)
    
    async def validate(self, adapter_class: Type[BaseAdapter], metadata: Optional[AdapterMetadata] = None, config: Optional[Dict[str, Any]] = None) -> List[ValidationIssue]:
        issues = []
        
        if metadata is None:
            # 尝试从适配器类加载元数据
            try:
                temp_instance = adapter_class(config or {})
                metadata = temp_instance._load_metadata()
            except Exception as e:
                issues.append(self.create_issue(
                    "metadata_load_failed",
                    f"Failed to load metadata from adapter: {str(e)}",
                    details={"error": str(e), "error_type": type(e).__name__}
                ))
                return issues
        
        if metadata is None:
            issues.append(self.create_issue(
                "no_metadata",
                "Adapter metadata is None",
                suggestion="Implement _load_metadata method to return valid AdapterMetadata"
            ))
            return issues
        
        # 验证必需字段
        required_fields = ["adapter_id", "name", "version", "adapter_type"]
        for field in required_fields:
            if not hasattr(metadata, field) or getattr(metadata, field) is None:
                issues.append(self.create_issue(
                    "missing_required_field",
                    f"Required metadata field '{field}' is missing or None",
                    details={"field": field},
                    suggestion=f"Set the {field} field in your metadata"
                ))
        
        # 验证adapter_id格式
        if hasattr(metadata, 'adapter_id') and metadata.adapter_id:
            if not re.match(r'^[a-zA-Z0-9_-]+$', metadata.adapter_id):
                issues.append(self.create_issue(
                    "invalid_adapter_id_format",
                    f"Adapter ID '{metadata.adapter_id}' contains invalid characters",
                    details={"adapter_id": metadata.adapter_id},
                    suggestion="Use only letters, numbers, underscores and hyphens in adapter ID"
                ))
        
        # 验证版本格式
        if hasattr(metadata, 'version') and metadata.version:
            version_str = metadata.version.version if hasattr(metadata.version, 'version') else str(metadata.version)
            if not re.match(r'^\d+\.\d+(\.\d+)?(-\w+)?$', version_str):
                issues.append(self.create_issue(
                    "invalid_version_format",
                    f"Version '{version_str}' is not in valid semantic version format",
                    details={"version": version_str},
                    suggestion="Use semantic versioning format like '1.0.0' or '1.0.0-beta'"
                ))
        
        # 验证能力列表
        if hasattr(metadata, 'capabilities') and isinstance(metadata.capabilities, list):
            if len(metadata.capabilities) == 0:
                issues.append(self.create_issue(
                    "no_capabilities",
                    "Adapter has no capabilities defined",
                    severity=ValidationSeverity.WARNING,
                    suggestion="Define at least one capability for your adapter"
                ))
            
            # 验证每个能力
            for i, capability in enumerate(metadata.capabilities):
                if not hasattr(capability, 'name') or not capability.name:
                    issues.append(self.create_issue(
                        "capability_missing_name",
                        f"Capability at index {i} is missing name",
                        details={"index": i}
                    ))
                
                if not hasattr(capability, 'category'):
                    issues.append(self.create_issue(
                        "capability_missing_category",
                        f"Capability '{capability.name}' is missing category",
                        details={"capability_name": capability.name if hasattr(capability, 'name') else f"index_{i}"}
                    ))
        
        return issues

class ConfigurationValidationRule(ValidationRule):
    """配置验证规则"""
    
    def __init__(self):
        super().__init__("configuration_validation", ValidationCategory.CONFIGURATION, ValidationSeverity.ERROR)
    
    async def validate(self, adapter_class: Type[BaseAdapter], metadata: Optional[AdapterMetadata] = None, config: Optional[Dict[str, Any]] = None) -> List[ValidationIssue]:
        issues = []
        
        if config is None:
            config = {}
        
        # 验证必需的配置项
        required_config_keys = ["adapter_id"]
        for key in required_config_keys:
            if key not in config:
                issues.append(self.create_issue(
                    "missing_required_config",
                    f"Required configuration key '{key}' is missing",
                    details={"key": key},
                    suggestion=f"Add '{key}' to the adapter configuration"
                ))
        
        # 如果有元数据，验证配置项
        if metadata and hasattr(metadata, 'configuration') and isinstance(metadata.configuration, list):
            for config_item in metadata.configuration:
                if hasattr(config_item, 'required') and config_item.required:
                    config_name = config_item.name if hasattr(config_item, 'name') else 'unknown'
                    if config_name not in config:
                        # 检查是否有默认值
                        has_default = hasattr(config_item, 'default_value') and config_item.default_value is not None
                        if not has_default:
                            issues.append(self.create_issue(
                                "missing_required_config_item",
                                f"Required configuration item '{config_name}' is missing and has no default value",
                                details={"config_name": config_name},
                                suggestion=f"Provide a value for '{config_name}' in the configuration or set a default value"
                            ))
                
                # 验证配置项类型
                if hasattr(config_item, 'name') and config_item.name in config:
                    await self._validate_config_type(config_item, config[config_item.name], issues)
        
        # 验证敏感配置项
        await self._validate_sensitive_config(config, issues)
        
        return issues
    
    async def _validate_config_type(self, config_item, value, issues: List[ValidationIssue]):
        """验证配置项类型"""
        try:
            if hasattr(config_item, 'type'):
                expected_type = config_item.type
                config_name = config_item.name if hasattr(config_item, 'name') else 'unknown'
                
                type_mapping = {
                    'string': str,
                    'int': int,
                    'float': float,
                    'bool': bool,
                    'list': list,
                    'dict': dict
                }
                
                if expected_type in type_mapping:
                    expected_python_type = type_mapping[expected_type]
                    if not isinstance(value, expected_python_type):
                        issues.append(self.create_issue(
                            "config_type_mismatch",
                            f"Configuration '{config_name}' expected type {expected_type}, got {type(value).__name__}",
                            details={
                                "config_name": config_name,
                                "expected_type": expected_type,
                                "actual_type": type(value).__name__,
                                "value": str(value)
                            },
                            suggestion=f"Convert the value to {expected_type} type"
                        ))
        except Exception as e:
            issues.append(self.create_issue(
                "config_type_validation_error",
                f"Error validating configuration type: {str(e)}",
                details={"error": str(e)}
            ))
    
    async def _validate_sensitive_config(self, config: Dict[str, Any], issues: List[ValidationIssue]):
        """验证敏感配置项"""
        sensitive_patterns = ['password', 'secret', 'token', 'key', 'credential', 'api_key']
        
        for key, value in config.items():
            key_lower = key.lower()
            if any(pattern in key_lower for pattern in sensitive_patterns):
                if isinstance(value, str) and len(value) < 8:
                    issues.append(self.create_issue(
                        "weak_sensitive_config",
                        f"Sensitive configuration '{key}' appears to have a weak value (too short)",
                        details={"config_key": key, "value_length": len(value)},
                        severity=ValidationSeverity.WARNING,
                        suggestion="Use strong passwords/tokens for sensitive configurations"
                    ))

class DependencyValidationRule(ValidationRule):
    """依赖关系验证规则"""
    
    def __init__(self):
        super().__init__("dependency_validation", ValidationCategory.DEPENDENCIES, ValidationSeverity.ERROR)
    
    async def validate(self, adapter_class: Type[BaseAdapter], metadata: Optional[AdapterMetadata] = None, config: Optional[Dict[str, Any]] = None) -> List[ValidationIssue]:
        issues = []
        
        if not metadata or not hasattr(metadata, 'dependencies'):
            return issues
        
        dependencies = metadata.dependencies
        if not isinstance(dependencies, list):
            return issues
        
        # 验证依赖项格式
        for i, dep in enumerate(dependencies):
            if not hasattr(dep, 'name') or not dep.name:
                issues.append(self.create_issue(
                    "dependency_missing_name",
                    f"Dependency at index {i} is missing name",
                    details={"index": i}
                ))
                continue
            
            # 验证依赖类型
            if hasattr(dep, 'type'):
                valid_types = ['package', 'service', 'adapter', 'system']
                if dep.type not in valid_types:
                    issues.append(self.create_issue(
                        "invalid_dependency_type",
                        f"Dependency '{dep.name}' has invalid type '{dep.type}'",
                        details={"dependency_name": dep.name, "type": dep.type, "valid_types": valid_types},
                        suggestion=f"Use one of: {', '.join(valid_types)}"
                    ))
            
            # 检查Python包依赖
            if hasattr(dep, 'type') and dep.type == 'package':
                await self._validate_python_package(dep, issues)
            
            # 检查适配器依赖
            elif hasattr(dep, 'type') and dep.type == 'adapter':
                await self._validate_adapter_dependency(dep, issues)
        
        # 检查循环依赖
        await self._check_circular_dependencies(metadata, issues)
        
        return issues
    
    async def _validate_python_package(self, dependency, issues: List[ValidationIssue]):
        """验证Python包依赖"""
        try:
            import importlib.util
            
            package_name = dependency.name
            
            # 尝试查找包
            spec = importlib.util.find_spec(package_name)
            if spec is None:
                severity = ValidationSeverity.WARNING if hasattr(dependency, 'optional') and dependency.optional else ValidationSeverity.ERROR
                issues.append(self.create_issue(
                    "package_not_found",
                    f"Python package '{package_name}' is not installed",
                    details={"package_name": package_name, "optional": getattr(dependency, 'optional', False)},
                    severity=severity,
                    suggestion=f"Install the package with: pip install {package_name}"
                ))
        except Exception as e:
            issues.append(self.create_issue(
                "package_validation_error",
                f"Error validating package dependency '{dependency.name}': {str(e)}",
                details={"package_name": dependency.name, "error": str(e)}
            ))
    
    async def _validate_adapter_dependency(self, dependency, issues: List[ValidationIssue]):
        """验证适配器依赖"""
        try:
            registry = get_default_registry()
            adapter_name = dependency.name
            
            # 检查适配器是否已注册
            registration = registry.get_registration(adapter_name)
            if not registration:
                severity = ValidationSeverity.WARNING if hasattr(dependency, 'optional') and dependency.optional else ValidationSeverity.ERROR
                issues.append(self.create_issue(
                    "adapter_dependency_not_found",
                    f"Adapter dependency '{adapter_name}' is not registered",
                    details={"adapter_name": adapter_name, "optional": getattr(dependency, 'optional', False)},
                    severity=severity,
                    suggestion=f"Register the adapter '{adapter_name}' before using this adapter"
                ))
        except Exception as e:
            issues.append(self.create_issue(
                "adapter_dependency_validation_error",
                f"Error validating adapter dependency '{dependency.name}': {str(e)}",
                details={"adapter_name": dependency.name, "error": str(e)}
            ))
    
    async def _check_circular_dependencies(self, metadata: AdapterMetadata, issues: List[ValidationIssue]):
        """检查循环依赖"""
        try:
            if not hasattr(metadata, 'adapter_id') or not hasattr(metadata, 'dependencies'):
                return
            
            # 构建简单的依赖图
            adapter_id = metadata.adapter_id
            dependencies = [dep.name for dep in metadata.dependencies if hasattr(dep, 'type') and dep.type == 'adapter']
            
            # 检查直接循环依赖（自己依赖自己）
            if adapter_id in dependencies:
                issues.append(self.create_issue(
                    "self_dependency",
                    f"Adapter '{adapter_id}' depends on itself",
                    details={"adapter_id": adapter_id},
                    suggestion="Remove self-dependency from the dependency list"
                ))
            
            # 更复杂的循环依赖检查需要访问注册中心中的其他适配器
            # 这里可以进一步扩展
            
        except Exception as e:
            issues.append(self.create_issue(
                "circular_dependency_check_error",
                f"Error checking circular dependencies: {str(e)}",
                details={"error": str(e)}
            ))

class SecurityValidationRule(ValidationRule):
    """安全验证规则"""
    
    def __init__(self, security_threshold: SecurityLevel = SecurityLevel.INTERNAL):
        super().__init__("security_validation", ValidationCategory.SECURITY, ValidationSeverity.ERROR)
        self.security_threshold = security_threshold
    
    async def validate(self, adapter_class: Type[BaseAdapter], metadata: Optional[AdapterMetadata] = None, config: Optional[Dict[str, Any]] = None) -> List[ValidationIssue]:
        issues = []
        
        # 验证安全级别
        if metadata and hasattr(metadata, 'permissions'):
            await self._validate_security_level(metadata.permissions, issues)
        
        # 验证代码安全性
        await self._validate_code_security(adapter_class, issues)
        
        # 验证配置安全性
        if config:
            await self._validate_config_security(config, issues)
        
        return issues
    
    async def _validate_security_level(self, permissions, issues: List[ValidationIssue]):
        """验证安全级别"""
        try:
            if hasattr(permissions, 'security_level'):
                security_level = permissions.security_level
                
                # 检查安全级别是否符合要求
                security_order = [SecurityLevel.PUBLIC, SecurityLevel.INTERNAL, SecurityLevel.RESTRICTED, SecurityLevel.CLASSIFIED]
                
                if security_level not in security_order:
                    issues.append(self.create_issue(
                        "invalid_security_level",
                        f"Invalid security level: {security_level}",
                        details={"security_level": security_level, "valid_levels": [level.value for level in security_order]}
                    ))
                elif security_order.index(security_level) < security_order.index(self.security_threshold):
                    issues.append(self.create_issue(
                        "insufficient_security_level",
                        f"Security level {security_level} is below required threshold {self.security_threshold}",
                        details={"current_level": security_level.value, "required_level": self.security_threshold.value},
                        severity=ValidationSeverity.WARNING
                    ))
            
            # 验证权限要求
            if hasattr(permissions, 'required_roles') and permissions.required_roles:
                if len(permissions.required_roles) == 0 and permissions.security_level != SecurityLevel.PUBLIC:
                    issues.append(self.create_issue(
                        "no_required_roles",
                        f"Non-public adapter has no required roles defined",
                        severity=ValidationSeverity.WARNING,
                        suggestion="Define required roles for non-public adapters"
                    ))
        except Exception as e:
            issues.append(self.create_issue(
                "security_level_validation_error",
                f"Error validating security level: {str(e)}",
                details={"error": str(e)}
            ))
    
    async def _validate_code_security(self, adapter_class: Type[BaseAdapter], issues: List[ValidationIssue]):
        """验证代码安全性"""
        try:
            # 获取类的源代码
            source_code = inspect.getsource(adapter_class)
            
            # 检查危险的导入和函数调用
            dangerous_patterns = [
                (r'import\s+os\s*', "os module import", "Be careful with os module usage"),
                (r'import\s+subprocess\s*', "subprocess module import", "Subprocess usage can be dangerous"),
                (r'eval\s*\(', "eval() function call", "Avoid using eval() function"),
                (r'exec\s*\(', "exec() function call", "Avoid using exec() function"),
                (r'__import__\s*\(', "__import__ function call", "Direct __import__ usage can be risky"),
                (r'open\s*\([^)]*[\'"]w[\'"]', "file write operation", "File write operations should be carefully reviewed"),
            ]
            
            for pattern, description, suggestion in dangerous_patterns:
                if re.search(pattern, source_code, re.IGNORECASE):
                    issues.append(self.create_issue(
                        "potentially_dangerous_code",
                        f"Potentially dangerous code detected: {description}",
                        details={"pattern": pattern, "description": description},
                        severity=ValidationSeverity.WARNING,
                        suggestion=suggestion
                    ))
        except Exception as e:
            # 无法获取源代码不是错误，可能是动态生成的类
            pass
    
    async def _validate_config_security(self, config: Dict[str, Any], issues: List[ValidationIssue]):
        """验证配置安全性"""
        try:
            # 检查是否有明文密码
            for key, value in config.items():
                if isinstance(value, str):
                    key_lower = key.lower()
                    if 'password' in key_lower and len(value) < 8:
                        issues.append(self.create_issue(
                            "weak_password",
                            f"Configuration '{key}' appears to contain a weak password",
                            details={"config_key": key},
                            severity=ValidationSeverity.WARNING,
                            suggestion="Use strong passwords (at least 8 characters)"
                        ))
        except Exception as e:
            issues.append(self.create_issue(
                "config_security_validation_error",
                f"Error validating configuration security: {str(e)}",
                details={"error": str(e)}
            ))

class PerformanceValidationRule(ValidationRule):
    """性能验证规则"""
    
    def __init__(self, thresholds: Optional[Dict[str, float]] = None):
        super().__init__("performance_validation", ValidationCategory.PERFORMANCE, ValidationSeverity.WARNING)
        self.thresholds = thresholds or {
            "max_initialization_time": 5.0,
            "max_processing_time": 10.0,
            "max_memory_usage_mb": 100.0
        }
    
    async def validate(self, adapter_class: Type[BaseAdapter], metadata: Optional[AdapterMetadata] = None, config: Optional[Dict[str, Any]] = None) -> List[ValidationIssue]:
        issues = []
        
        # 测试初始化性能
        await self._test_initialization_performance(adapter_class, config or {}, issues)
        
        # 测试处理性能
        await self._test_processing_performance(adapter_class, config or {}, issues)
        
        return issues
    
    async def _test_initialization_performance(self, adapter_class: Type[BaseAdapter], config: Dict[str, Any], issues: List[ValidationIssue]):
        """测试初始化性能"""
        try:
            start_time = time.time()
            
            # 创建实例并初始化
            instance = adapter_class(config)
            await instance.initialize()
            
            initialization_time = time.time() - start_time
            
            if initialization_time > self.thresholds["max_initialization_time"]:
                issues.append(self.create_issue(
                    "slow_initialization",
                    f"Adapter initialization took {initialization_time:.2f}s, exceeding threshold of {self.thresholds['max_initialization_time']}s",
                    details={
                        "initialization_time": initialization_time,
                        "threshold": self.thresholds["max_initialization_time"]
                    },
                    suggestion="Optimize adapter initialization code"
                ))
            
            # 清理
            await instance.cleanup()
            
        except Exception as e:
            issues.append(self.create_issue(
                "initialization_performance_test_failed",
                f"Failed to test initialization performance: {str(e)}",
                details={"error": str(e)},
                severity=ValidationSeverity.WARNING
            ))
    
    async def _test_processing_performance(self, adapter_class: Type[BaseAdapter], config: Dict[str, Any], issues: List[ValidationIssue]):
        """测试处理性能"""
        try:
            # 创建实例
            instance = adapter_class(config)
            await instance.initialize()
            
            # 测试简单处理
            test_data = "test input"
            context = ExecutionContext()
            
            start_time = time.time()
            result = await instance.process(test_data, context)
            processing_time = time.time() - start_time
            
            if processing_time > self.thresholds["max_processing_time"]:
                issues.append(self.create_issue(
                    "slow_processing",
                    f"Adapter processing took {processing_time:.2f}s, exceeding threshold of {self.thresholds['max_processing_time']}s",
                    details={
                        "processing_time": processing_time,
                        "threshold": self.thresholds["max_processing_time"]
                    },
                    suggestion="Optimize adapter processing code"
                ))
            
            # 清理
            await instance.cleanup()
            
        except Exception as e:
            # 处理失败不一定是性能问题，可能是输入数据不合适
            pass

class RuntimeValidationRule(ValidationRule):
    """运行时验证规则"""
    
    def __init__(self):
        super().__init__("runtime_validation", ValidationCategory.RUNTIME, ValidationSeverity.ERROR)
    
    async def validate(self, adapter_class: Type[BaseAdapter], metadata: Optional[AdapterMetadata] = None, config: Optional[Dict[str, Any]] = None) -> List[ValidationIssue]:
        issues = []
        
        # 测试基本生命周期
        await self._test_lifecycle(adapter_class, config or {}, issues)
        
        # 测试健康检查
        await self._test_health_check(adapter_class, config or {}, issues)
        
        # 测试错误处理
        await self._test_error_handling(adapter_class, config or {}, issues)
        
        return issues
    
    async def _test_lifecycle(self, adapter_class: Type[BaseAdapter], config: Dict[str, Any], issues: List[ValidationIssue]):
        """测试适配器生命周期"""
        try:
            # 创建实例
            instance = adapter_class(config)
            
            # 测试初始化
            init_result = await instance.initialize()
            if not init_result:
                issues.append(self.create_issue(
                    "initialization_failed",
                    "Adapter initialization returned False",
                    suggestion="Check initialization logic and ensure it returns True on success"
                ))
            
            # 测试基本信息获取
            try:
                basic_info = instance.get_basic_info()
                if not isinstance(basic_info, dict):
                    issues.append(self.create_issue(
                        "invalid_basic_info_type",
                        f"get_basic_info() should return dict, got {type(basic_info).__name__}",
                        details={"returned_type": type(basic_info).__name__}
                    ))
            except Exception as e:
                issues.append(self.create_issue(
                    "basic_info_error",
                    f"get_basic_info() raised exception: {str(e)}",
                    details={"error": str(e)}
                ))
            
            # 测试能力获取
            try:
                capabilities = instance.get_capabilities()
                if not isinstance(capabilities, list):
                    issues.append(self.create_issue(
                        "invalid_capabilities_type",
                        f"get_capabilities() should return list, got {type(capabilities).__name__}",
                        details={"returned_type": type(capabilities).__name__}
                    ))
            except Exception as e:
                issues.append(self.create_issue(
                    "capabilities_error",
                    f"get_capabilities() raised exception: {str(e)}",
                    details={"error": str(e)}
                ))
            
            # 测试清理
            try:
                await instance.cleanup()
            except Exception as e:
                issues.append(self.create_issue(
                    "cleanup_error",
                    f"cleanup() raised exception: {str(e)}",
                    details={"error": str(e)}
                ))
            
        except Exception as e:
            issues.append(self.create_issue(
                "lifecycle_test_failed",
                f"Lifecycle test failed: {str(e)}",
                details={"error": str(e), "error_type": type(e).__name__}
            ))
    
    async def _test_health_check(self, adapter_class: Type[BaseAdapter], config: Dict[str, Any], issues: List[ValidationIssue]):
        """测试健康检查"""
        try:
            instance = adapter_class(config)
            await instance.initialize()
            
            # 执行健康检查
            health_result = await instance.health_check()
            
            # 验证健康检查结果
            if not isinstance(health_result, HealthCheckResult):
                issues.append(self.create_issue(
                    "invalid_health_check_result_type",
                    f"health_check() should return HealthCheckResult, got {type(health_result).__name__}",
                    details={"returned_type": type(health_result).__name__}
                ))
            else:
                # 验证健康检查结果的必需字段
                required_fields = ["is_healthy", "status"]
                for field in required_fields:
                    if not hasattr(health_result, field):
                        issues.append(self.create_issue(
                            "health_check_missing_field",
                            f"HealthCheckResult is missing required field '{field}'",
                            details={"field": field}
                        ))
            
            await instance.cleanup()
            
        except Exception as e:
            issues.append(self.create_issue(
                "health_check_test_failed",
                f"Health check test failed: {str(e)}",
                details={"error": str(e)}
            ))
    
    async def _test_error_handling(self, adapter_class: Type[BaseAdapter], config: Dict[str, Any], issues: List[ValidationIssue]):
        """测试错误处理"""
        try:
            instance = adapter_class(config)
            await instance.initialize()
            
            # 测试无效输入处理
            try:
                context = ExecutionContext()
                # 尝试传入None作为输入
                result = await instance.process(None, context)
                # 如果没有抛出异常，检查结果是否合理
                if hasattr(result, 'status') and result.status == 'success':
                    issues.append(self.create_issue(
                        "poor_error_handling",
                        "Adapter accepted None input without proper error handling",
                        severity=ValidationSeverity.WARNING,
                        suggestion="Add input validation to handle invalid inputs gracefully"
                    ))
            except Exception:
                # 抛出异常是正常的错误处理行为
                pass
            
            await instance.cleanup()
            
        except Exception as e:
            # 错误处理测试失败不一定是问题
            pass

# ================================
# 适配器验证器主类
# ================================

class AdapterValidator:
    """
    适配器验证器
    
    这是适配器验证系统的核心类，提供了完整的适配器验证功能。
    """
    
    def __init__(self, config: Optional[ValidationConfig] = None):
        """
        初始化验证器
        
        Args:
            config: 验证配置
        """
        self.config = config or ValidationConfig()
        self.logger = logging.getLogger(__name__)
        
        # 初始化内置验证规则
        self._rules: List[ValidationRule] = []
        self._initialize_builtin_rules()
        
        # 添加自定义规则
        for rule in self.config.custom_rules:
            self.add_rule(rule)
    
    def _initialize_builtin_rules(self):
        """初始化内置验证规则"""
        # 结构验证规则
        if ValidationCategory.STRUCTURE in self.config.enabled_categories:
            self.add_rule(AdapterStructureRule())
        
        # 元数据验证规则
        if ValidationCategory.METADATA in self.config.enabled_categories:
            self.add_rule(MetadataValidationRule())
        
        # 配置验证规则
        if ValidationCategory.CONFIGURATION in self.config.enabled_categories:
            self.add_rule(ConfigurationValidationRule())
        
        # 依赖验证规则
        if ValidationCategory.DEPENDENCIES in self.config.enabled_categories:
            self.add_rule(DependencyValidationRule())
        
        # 安全验证规则
        if ValidationCategory.SECURITY in self.config.enabled_categories and self.config.enable_security_validation:
            self.add_rule(SecurityValidationRule(self.config.security_level_threshold))
        
        # 性能验证规则
        if ValidationCategory.PERFORMANCE in self.config.enabled_categories and self.config.enable_performance_validation:
            self.add_rule(PerformanceValidationRule(self.config.performance_thresholds))
        
        # 运行时验证规则
        if ValidationCategory.RUNTIME in self.config.enabled_categories and self.config.enable_runtime_validation:
            self.add_rule(RuntimeValidationRule())
    
    def add_rule(self, rule: ValidationRule):
        """添加验证规则"""
        if rule.rule_id not in self.config.disabled_rules:
            self._rules.append(rule)
            self.logger.debug(f"Added validation rule: {rule.rule_id}")
    
    def remove_rule(self, rule_id: str):
        """移除验证规则"""
        self._rules = [rule for rule in self._rules if rule.rule_id != rule_id]
        self.logger.debug(f"Removed validation rule: {rule_id}")
    
    @handle_adapter_exceptions(
        catch=Exception,
        reraise_as=AdapterValidationError,
        message="Adapter validation failed"
    )
    async def validate_adapter(
        self,
        adapter_class: Type[BaseAdapter],
        config: Optional[Dict[str, Any]] = None,
        metadata: Optional[AdapterMetadata] = None
    ) -> ValidationResult:
        """
        验证适配器
        
        Args:
            adapter_class: 适配器类
            config: 适配器配置
            metadata: 适配器元数据
            
        Returns:
            验证结果
        """
        start_time = time.time()
        result = ValidationResult(is_valid=True)
        
        try:
            self.logger.info(f"Starting validation for adapter class: {adapter_class.__name__}")
            
            # 按类别执行验证规则
            for rule in self._rules:
                try:
                    # 检查超时
                    if time.time() - start_time > self.config.timeout_seconds:
                        result.add_issue(ValidationIssue(
                            severity=ValidationSeverity.WARNING,
                            category=ValidationCategory.RUNTIME,
                            code="validation_timeout",
                            message=f"Validation timeout after {self.config.timeout_seconds}s"
                        ))
                        break
                    
                    # 执行规则验证
                    rule_issues = await rule.validate(adapter_class, metadata, config)
                    
                    # 添加问题到结果
                    for issue in rule_issues:
                        result.add_issue(issue)
                        
                        # 检查问题数量限制
                        if len(result.issues) >= self.config.max_issues:
                            result.add_issue(ValidationIssue(
                                severity=ValidationSeverity.WARNING,
                                category=ValidationCategory.RUNTIME,
                                code="max_issues_reached",
                                message=f"Maximum number of issues ({self.config.max_issues}) reached"
                            ))
                            break
                    
                    self.logger.debug(f"Rule {rule.rule_id} completed with {len(rule_issues)} issues")
                    
                except Exception as e:
                    result.add_issue(ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        category=ValidationCategory.RUNTIME,
                        code="rule_execution_error",
                        message=f"Error executing validation rule '{rule.rule_id}': {str(e)}",
                        details={"rule_id": rule.rule_id, "error": str(e)}
                    ))
                    self.logger.error(f"Error executing rule {rule.rule_id}: {e}")
            
            # 根据验证模式确定最终结果
            result.is_valid = self._determine_validity(result)
            
            # 设置验证时间和元数据
            result.validation_time = time.time() - start_time
            result.metadata = {
                "adapter_class": adapter_class.__name__,
                "validation_mode": self.config.mode.value,
                "rules_executed": len(self._rules),
                "categories_enabled": [cat.value for cat in self.config.enabled_categories]
            }
            
            self.logger.info(
                f"Validation completed for {adapter_class.__name__}: "
                f"valid={result.is_valid}, issues={len(result.issues)}, "
                f"time={result.validation_time:.3f}s"
            )
            
            return result
            
        except Exception as e:
            result.add_issue(ValidationIssue(
                severity=ValidationSeverity.CRITICAL,
                category=ValidationCategory.RUNTIME,
                code="validation_failed",
                message=f"Validation failed with exception: {str(e)}",
                details={"error": str(e), "traceback": traceback.format_exc()}
            ))
            result.is_valid = False
            result.validation_time = time.time() - start_time
            
            self.logger.error(f"Validation failed for {adapter_class.__name__}: {e}")
            return result
    
    def _determine_validity(self, result: ValidationResult) -> bool:
        """根据验证模式确定有效性"""
        if self.config.mode == ValidatorMode.DEVELOPMENT:
            # 开发模式：只有严重错误才无效
            return len(result.critical_errors) == 0
        elif self.config.mode == ValidatorMode.PERMISSIVE:
            # 宽松模式：只有错误和严重错误才无效
            return len(result.errors) == 0 and len(result.critical_errors) == 0
        elif self.config.mode in (ValidatorMode.STRICT, ValidatorMode.PRODUCTION):
            # 严格模式和生产模式：任何错误都无效
            return len(result.errors) == 0 and len(result.critical_errors) == 0
        else:
            return result.is_valid
    
    async def validate_adapter_instance(self, adapter_instance: BaseAdapter) -> ValidationResult:
        """
        验证适配器实例
        
        Args:
            adapter_instance: 适配器实例
            
        Returns:
            验证结果
        """
        adapter_class = type(adapter_instance)
        config = adapter_instance.config if hasattr(adapter_instance, 'config') else {}
        
        # 尝试获取元数据
        metadata = None
        try:
            metadata = adapter_instance._load_metadata()
        except Exception as e:
            self.logger.warning(f"Could not load metadata from instance: {e}")
        
        return await self.validate_adapter(adapter_class, config, metadata)
    
    def get_validation_summary(self, result: ValidationResult) -> str:
        """获取验证摘要字符串"""
        summary = result.get_summary()
        
        lines = [
            f"Validation Result: {'VALID' if result.is_valid else 'INVALID'}",
            f"Total Issues: {summary['total_issues']}",
            f"  - Warnings: {summary['warnings']}",
            f"  - Errors: {summary['errors']}",
            f"  - Critical: {summary['critical_errors']}",
            f"Validation Time: {result.validation_time:.3f}s"
        ]
        
        if summary['categories']:
            lines.append("Issues by Category:")
            for category, count in summary['categories'].items():
                lines.append(f"  - {category}: {count}")
        
        return "\n".join(lines)
    
    def get_detailed_report(self, result: ValidationResult) -> str:
        """获取详细验证报告"""
        lines = [
            "=" * 60,
            "ADAPTER VALIDATION REPORT",
            "=" * 60,
            "",
            self.get_validation_summary(result),
            ""
        ]
        
        if result.issues:
            lines.extend([
                "DETAILED ISSUES:",
                "-" * 40
            ])
            
            # 按严重程度分组显示
            for severity in [ValidationSeverity.CRITICAL, ValidationSeverity.ERROR, ValidationSeverity.WARNING, ValidationSeverity.INFO]:
                severity_issues = [issue for issue in result.issues if issue.severity == severity]
                
                if severity_issues:
                    lines.extend([
                        f"",
                        f"{severity.value.upper()} ({len(severity_issues)}):",
                        "-" * 20
                    ])
                    
                    for issue in severity_issues:
                        lines.append(f"• {issue.message}")
                        if issue.location:
                            lines.append(f"  Location: {issue.location}")
                        if issue.suggestion:
                            lines.append(f"  Suggestion: {issue.suggestion}")
                        if issue.details:
                            lines.append(f"  Details: {issue.details}")
                        lines.append("")
        
        lines.extend([
            "=" * 60,
            f"Report generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "=" * 60
        ])
        
        return "\n".join(lines)

# ================================
# 工厂函数和便利方法
# ================================

def create_validator(
    mode: ValidatorMode = ValidatorMode.STRICT,
    enabled_categories: Optional[Set[ValidationCategory]] = None,
    enable_security: bool = True,
    enable_performance: bool = True,
    enable_runtime: bool = True,
    **kwargs
) -> AdapterValidator:
    """
    创建适配器验证器
    
    Args:
        mode: 验证模式
        enabled_categories: 启用的验证类别
        enable_security: 是否启用安全验证
        enable_performance: 是否启用性能验证
        enable_runtime: 是否启用运行时验证
        **kwargs: 其他配置选项
        
    Returns:
        验证器实例
    """
    if enabled_categories is None:
        enabled_categories = set(ValidationCategory)
    
    config = ValidationConfig(
        mode=mode,
        enabled_categories=enabled_categories,
        enable_security_validation=enable_security,
        enable_performance_validation=enable_performance,
        enable_runtime_validation=enable_runtime,
        **kwargs
    )
    
    return AdapterValidator(config)

def create_development_validator() -> AdapterValidator:
    """创建开发环境验证器"""
    return create_validator(
        mode=ValidatorMode.DEVELOPMENT,
        enable_performance=False,  # 开发时不检查性能
        timeout_seconds=60.0       # 更长的超时时间
    )

def create_production_validator() -> AdapterValidator:
    """创建生产环境验证器"""
    return create_validator(
        mode=ValidatorMode.PRODUCTION,
        enable_security=True,
        enable_performance=True,
        enable_runtime=True,
        timeout_seconds=15.0       # 较短的超时时间
    )

# 全局默认验证器实例
_default_validator: Optional[AdapterValidator] = None

def get_default_validator() -> AdapterValidator:
    """获取默认验证器实例"""
    global _default_validator
    if _default_validator is None:
        _default_validator = create_validator()
    return _default_validator

def set_default_validator(validator: AdapterValidator):
    """设置默认验证器实例"""
    global _default_validator
    _default_validator = validator

# ================================
# 便利函数
# ================================

async def validate_adapter_class(
    adapter_class: Type[BaseAdapter],
    config: Optional[Dict[str, Any]] = None,
    validator: Optional[AdapterValidator] = None
) -> ValidationResult:
    """便利函数：验证适配器类"""
    validator = validator or get_default_validator()
    return await validator.validate_adapter(adapter_class, config)

async def validate_adapter_instance(
    adapter_instance: BaseAdapter,
    validator: Optional[AdapterValidator] = None
) -> ValidationResult:
    """便利函数：验证适配器实例"""
    validator = validator or get_default_validator()
    return await validator.validate_adapter_instance(adapter_instance)

async def quick_validate(
    adapter_class: Type[BaseAdapter],
    config: Optional[Dict[str, Any]] = None,
    print_report: bool = True
) -> bool:
    """快速验证适配器并打印报告"""
    validator = get_default_validator()
    result = await validator.validate_adapter(adapter_class, config)
    
    if print_report:
        print(validator.get_detailed_report(result))
    
    return result.is_valid

# ================================
# 导出列表
# ================================

__all__ = [
    # 枚举
    'ValidationSeverity', 'ValidationCategory', 'ValidatorMode',
    
    # 数据结构
    'ValidationIssue', 'ValidationResult', 'ValidationConfig',
    
    # 验证规则
    'ValidationRule', 'AdapterStructureRule', 'MetadataValidationRule',
    'ConfigurationValidationRule', 'DependencyValidationRule',
    'SecurityValidationRule', 'PerformanceValidationRule', 'RuntimeValidationRule',
    
    # 验证器
    'AdapterValidator',
    
    # 工厂函数
    'create_validator', 'create_development_validator', 'create_production_validator',
    'get_default_validator', 'set_default_validator',
    
    # 便利函数
    'validate_adapter_class', 'validate_adapter_instance', 'quick_validate'
]
