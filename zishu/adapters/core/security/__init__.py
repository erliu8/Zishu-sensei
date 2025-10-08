"""
适配器安全服务模块

提供全面的安全服务，包括：
- 安全上下文管理
- 权限验证和访问控制
- 沙箱执行环境
- 威胁检测和防护
- 安全审计和监控
- 增强型安全组件
"""

from .security_service import (
    AdapterSecurityService,
    SecurityServiceConfig,
    SecurityContext,
    SecurityLevel,
    SecurityPolicy,
    SecurityViolation,
    SecurityViolationType,
)

from .context_manager import (
    SecurityContextManager,
    ContextValidationResult,
    SecuritySession,
    SessionManager,
)

from .threat_detector import (
    ThreatDetector,
    ThreatType,
    ThreatLevel,
    ThreatEvent,
    SecurityAlert,
    ThreatAnalysisResult,
)

from .security_middleware import (
    SecurityMiddleware,
    SecurityInterceptor,
    AuthenticationMiddleware,
    AuthorizationMiddleware,
    ThreatDetectionMiddleware,
    RateLimitMiddleware,
    IPFilterMiddleware,
    RequestSecurityContext,
    SecurityMiddlewareResult,
    SecurityDecision,
    SecurityAction,
)

from .resource_monitor import (
    ResourceMonitor,
    ResourceType,
    ResourceUsage,
    ResourceLimit,
    ResourceAlert,
    AlertLevel,
    SystemMetrics,
    ProcessInfo,
)

from .security_manager import SecurityManager

# 增强型安全组件
from .sandbox import (
    SandboxTier,
    IsolationMode,
    SecurityPolicy as SandboxSecurityPolicy,
    ThreatLevel as SandboxThreatLevel,
    ResourceQuota,
    SandboxConfiguration,
    ExecutionEnvironment,
    ExecutionResult,
    CodeAnalyzer,
    ResourceMonitor as SandboxResourceMonitor,
    SandboxExecutor,
    ProcessSandboxExecutor,
    EnhancedSandboxManager,
    get_sandbox_manager,
    execute_in_sandbox,
    SANDBOX_CONFIGS,
)

from .permissions import (
    PermissionType,
    RoleType,
    AccessDecision,
    PolicyEffect,
    PermissionScope,
    Permission,
    Role,
    AccessRequest,
    AccessResult,
    PolicyRule,
    ConditionEvaluator,
    PermissionCache,
    EnhancedPermissionManager,
    get_permission_manager,
    require_permission,
    require_role,
    check_user_permission,
    has_role,
    get_user_effective_permissions,
)

from .security_validator import (
    ValidationLevel,
    ThreatType as ValidatorThreatType,
    SecurityEventSeverity,
    ValidationResult,
    SecurityViolation as ValidatorSecurityViolation,
    ValidationContext,
    SecurityValidator,
    InputValidator,
    BusinessLogicValidator,
    OutputValidator,
    SecurityAuditor,
    ComprehensiveSecurityValidator,
    get_security_validator,
    validate_input,
    SecurityError,
    validate_user_input,
    validate_system_output,
    get_security_statistics,
    get_user_security_profile,
)

# 审计系统
from .audit import (
    AuditLogger,
    AuditEvent,
    AuditEventType,
    AuditLevel,
    AuditSeverity,
    AuditStorage,
    FileAuditStorage,
    AuditConfig,
    get_audit_logger,
    initialize_audit_system,
    shutdown_audit_system,
    audit_operation,
    audit_adapter_operation,
)

__all__ = [
    # 核心安全服务
    "AdapterSecurityService",
    "SecurityServiceConfig",
    # 安全上下文
    "SecurityContext",
    "SecurityLevel",
    "SecurityPolicy",
    "SecurityViolation",
    "SecurityViolationType",
    # 上下文管理
    "SecurityContextManager",
    "ContextValidationResult",
    "SecuritySession",
    "SessionManager",
    # 威胁检测
    "ThreatDetector",
    "ThreatType",
    "ThreatLevel",
    "ThreatEvent",
    "SecurityAlert",
    "ThreatAnalysisResult",
    # 安全中间件
    "SecurityMiddleware",
    "SecurityInterceptor",
    "AuthenticationMiddleware",
    "AuthorizationMiddleware",
    "ThreatDetectionMiddleware",
    "RateLimitMiddleware",
    "IPFilterMiddleware",
    "RequestSecurityContext",
    "SecurityMiddlewareResult",
    "SecurityDecision",
    "SecurityAction",
    # 资源监控
    "ResourceMonitor",
    "ResourceType",
    "ResourceUsage",
    "ResourceLimit",
    "ResourceAlert",
    "AlertLevel",
    "SystemMetrics",
    "ProcessInfo",
    # 安全管理器
    "SecurityManager",
    # 增强型沙箱系统
    "SandboxTier",
    "IsolationMode",
    "SandboxSecurityPolicy",
    "SandboxThreatLevel",
    "ResourceQuota",
    "SandboxConfiguration",
    "ExecutionEnvironment",
    "ExecutionResult",
    "CodeAnalyzer",
    "SandboxResourceMonitor",
    "SandboxExecutor",
    "ProcessSandboxExecutor",
    "EnhancedSandboxManager",
    "get_sandbox_manager",
    "execute_in_sandbox",
    "SANDBOX_CONFIGS",
    # 增强型权限管理
    "PermissionType",
    "RoleType",
    "AccessDecision",
    "PolicyEffect",
    "PermissionScope",
    "Permission",
    "Role",
    "AccessRequest",
    "AccessResult",
    "PolicyRule",
    "ConditionEvaluator",
    "PermissionCache",
    "EnhancedPermissionManager",
    "get_permission_manager",
    "require_permission",
    "require_role",
    "check_user_permission",
    "has_role",
    "get_user_effective_permissions",
    # 安全验证器和审计
    "ValidationLevel",
    "ValidatorThreatType",
    "SecurityEventSeverity",
    "ValidationResult",
    "ValidatorSecurityViolation",
    "ValidationContext",
    "SecurityValidator",
    "InputValidator",
    "BusinessLogicValidator",
    "OutputValidator",
    "SecurityAuditor",
    "ComprehensiveSecurityValidator",
    "get_security_validator",
    "validate_input",
    "SecurityError",
    "validate_user_input",
    "validate_system_output",
    "get_security_statistics",
    "get_user_security_profile",
    # 审计系统
    "AuditLogger",
    "AuditEvent",
    "AuditEventType",
    "AuditLevel",
    "AuditSeverity",
    "AuditStorage",
    "FileAuditStorage",
    "AuditConfig",
    "get_audit_logger",
    "initialize_audit_system",
    "shutdown_audit_system",
    "audit_operation",
    "audit_adapter_operation",
]
