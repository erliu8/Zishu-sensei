"""
增强型安全管理器

统一管理所有安全组件，提供集成的安全服务接口。
集成增强型安全功能：沙箱隔离、权限管理、安全验证等。
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional, Callable, Tuple
from datetime import datetime, timezone

from .security_service import AdapterSecurityService, SecurityServiceConfig
from .context_manager import SecurityContextManager, SessionManager
from .threat_detector import ThreatDetector
from .security_middleware import (
    SecurityInterceptor,
    AuthenticationMiddleware,
    AuthorizationMiddleware,
    ThreatDetectionMiddleware,
    RateLimitMiddleware,
    IPFilterMiddleware,
    RequestSecurityContext,
)
from .resource_monitor import ResourceMonitor
from .audit import AuditLogger, get_audit_logger

# 增强型安全组件
from .sandbox import (
    EnhancedSandboxManager,
    get_sandbox_manager,
    SandboxConfiguration,
    SANDBOX_CONFIGS,
)
from .permissions import (
    EnhancedPermissionManager,
    get_permission_manager,
    AccessRequest,
    AccessResult,
)
from .security_validator import (
    ComprehensiveSecurityValidator,
    get_security_validator,
    ValidationContext,
    ValidationLevel,
)

logger = logging.getLogger(__name__)


class SecurityManager:
    """
    增强型安全管理器

    统一管理和协调所有安全组件，提供集成的安全服务。
    集成增强型安全功能：沙箱隔离、权限管理、安全验证等。
    """

    def __init__(
        self,
        config: Optional[SecurityServiceConfig] = None,
        audit_logger: Optional[AuditLogger] = None,
    ):
        """初始化增强型安全管理器"""
        self.config = config or SecurityServiceConfig()
        self.audit_logger = audit_logger or get_audit_logger()

        # 初始化核心组件
        self.security_service = AdapterSecurityService(self.config)
        self.context_manager = SecurityContextManager()
        self.session_manager = SessionManager(self.context_manager)
        self.threat_detector = ThreatDetector()
        self.resource_monitor = ResourceMonitor()

        # 初始化增强型安全组件
        self.sandbox_manager = get_sandbox_manager()
        self.permission_manager = get_permission_manager()
        self.security_validator = get_security_validator()

        # 初始化安全拦截器
        self.security_interceptor = SecurityInterceptor(self.audit_logger)
        self._setup_security_middleware()

        # 组件状态
        self._initialized = False
        self._running = False

        logger.info("Enhanced SecurityManager initialized with integrated components")

    def _setup_security_middleware(self) -> None:
        """设置增强型安全中间件"""
        # IP过滤中间件（最高优先级）
        ip_filter = IPFilterMiddleware()
        self.security_interceptor.add_middleware(ip_filter)

        # 速率限制中间件
        rate_limiter = RateLimitMiddleware(requests_per_minute=100)
        self.security_interceptor.add_middleware(rate_limiter)

        # 身份验证中间件
        auth_middleware = AuthenticationMiddleware(self.security_service)
        self.security_interceptor.add_middleware(auth_middleware)

        # 增强型授权中间件（使用新的权限管理器）
        authz_middleware = AuthorizationMiddleware(self.security_service)
        self.security_interceptor.add_middleware(authz_middleware)

        # 威胁检测中间件
        threat_middleware = ThreatDetectionMiddleware(self.threat_detector)
        self.security_interceptor.add_middleware(threat_middleware)

    async def initialize(self) -> None:
        """初始化增强型安全管理器"""
        if self._initialized:
            return

        try:
            # 初始化安全服务
            await self.security_service.initialize()

            # 启动会话管理器
            await self.session_manager.start()

            # 启动资源监控
            await self.resource_monitor.start_monitoring()

            # 初始化增强型组件
            # 沙箱管理器已经是单例，无需额外初始化
            # 权限管理器已经是单例，无需额外初始化
            # 安全验证器已经是单例，无需额外初始化

            # 设置组件间的回调
            self._setup_component_callbacks()

            self._initialized = True
            self._running = True

            logger.info("Enhanced SecurityManager initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize SecurityManager: {e}")
            raise

    async def shutdown(self) -> None:
        """关闭安全管理器"""
        if not self._running:
            return

        try:
            # 停止资源监控
            await self.resource_monitor.stop_monitoring()

            # 停止会话管理器
            await self.session_manager.stop()

            # 关闭安全服务
            await self.security_service.shutdown()

            self._running = False

            logger.info("SecurityManager shutdown successfully")

        except Exception as e:
            logger.error(f"Failed to shutdown SecurityManager: {e}")
            raise

    def _setup_component_callbacks(self) -> None:
        """设置组件间的回调"""

        # 威胁检测回调
        async def on_threat_detected(threat_event):
            """威胁检测回调"""
            try:
                # 记录威胁事件
                await self.audit_logger.log_event(
                    "THREAT_DETECTED",
                    f"Threat detected: {threat_event.title}",
                    user_id=threat_event.user_id,
                    session_id=threat_event.session_id,
                    component="threat_detector",
                    severity="HIGH",
                    details=threat_event.to_dict(),
                )

                # 如果是高危威胁，自动阻止用户
                if threat_event.threat_level.value in ["high", "critical"]:
                    if threat_event.user_id:
                        await self.security_service.suspend_user(
                            threat_event.user_id,
                            f"Automatic suspension due to threat: {threat_event.title}",
                        )

            except Exception as e:
                logger.error(f"Threat detection callback error: {e}")

        # 资源警报回调
        def on_resource_alert(alert):
            """资源警报回调"""
            try:
                logger.warning(f"Resource alert: {alert.message}")

                # 如果是严重警报，可以采取自动措施
                if alert.level.value == "critical":
                    # 例如：限制新的会话创建
                    pass

            except Exception as e:
                logger.error(f"Resource alert callback error: {e}")

        # 注册回调
        self.threat_detector.add_context_created_callback = (
            lambda cb: None
        )  # 威胁检测器没有这个方法
        self.resource_monitor.add_alert_callback(on_resource_alert)

    # ================================
    # 统一安全接口
    # ================================

    async def authenticate_user(
        self,
        user_id: str,
        credentials: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """用户认证"""
        return await self.security_service.authenticate_user(
            user_id, credentials, context
        )

    async def create_security_session(
        self, user_id: str, permissions: List[str], **kwargs
    ) -> str:
        """创建安全会话"""
        context = await self.context_manager.create_context(
            user_id=user_id, permissions=permissions, **kwargs
        )
        return context.session_id

    async def validate_request(self, request_context: RequestSecurityContext) -> bool:
        """验证请求"""
        result = await self.security_interceptor.intercept(request_context)
        return result.is_allowed()

    async def check_permission(
        self,
        session_id: str,
        resource: str,
        action: str,
        adapter_id: Optional[str] = None,
    ) -> bool:
        """检查权限"""
        return await self.security_service.check_permission(
            session_id, resource, action, adapter_id
        )

    async def analyze_code_security(
        self, code: str, context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """分析代码安全性"""
        result = await self.threat_detector.analyze_code(code, context)
        return result.to_dict()

    async def get_security_status(self) -> Dict[str, Any]:
        """获取安全状态"""
        return {
            "security_service": {
                "initialized": self.security_service._initialized,
                "stats": await self.security_service.get_security_stats(),
            },
            "context_manager": {"stats": await self.context_manager.get_stats()},
            "threat_detector": {"stats": self.threat_detector.get_detection_stats()},
            "resource_monitor": {
                "stats": self.resource_monitor.get_stats(),
                "current_metrics": self.resource_monitor.get_current_metrics().to_dict()
                if self.resource_monitor.get_current_metrics()
                else None,
            },
            "security_interceptor": {"stats": self.security_interceptor.get_stats()},
        }

    # ================================
    # 配置管理
    # ================================

    def configure_rate_limiting(self, requests_per_minute: int) -> None:
        """配置速率限制"""
        rate_limiter = self.security_interceptor.get_middleware("rate_limit")
        if rate_limiter:
            rate_limiter.requests_per_minute = requests_per_minute

    def add_blocked_ip(self, ip_address: str) -> None:
        """添加阻止的IP"""
        ip_filter = self.security_interceptor.get_middleware("ip_filter")
        if ip_filter:
            ip_filter.add_blocked_ip(ip_address)

    def remove_blocked_ip(self, ip_address: str) -> None:
        """移除阻止的IP"""
        ip_filter = self.security_interceptor.get_middleware("ip_filter")
        if ip_filter:
            ip_filter.remove_blocked_ip(ip_address)

    def configure_resource_limits(
        self, resource_type: str, warning_threshold: float, critical_threshold: float
    ) -> None:
        """配置资源限制"""
        from .resource_monitor import ResourceType

        try:
            rt = ResourceType(resource_type)
            self.resource_monitor.set_resource_limit(
                rt, warning_threshold, critical_threshold
            )
        except ValueError:
            logger.error(f"Invalid resource type: {resource_type}")

    # ================================
    # 监控和报告
    # ================================

    async def get_active_sessions(self) -> List[Dict[str, Any]]:
        """获取活跃会话"""
        return await self.context_manager.list_active_sessions()

    async def get_recent_threats(self, limit: int = 50) -> List[Dict[str, Any]]:
        """获取最近的威胁"""
        threats = self.threat_detector.get_recent_threats(limit)
        return [threat.to_dict() for threat in threats]

    async def get_security_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """获取安全警报"""
        alerts = self.threat_detector.get_security_alerts(limit)
        return [alert.to_dict() for alert in alerts]

    async def get_resource_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """获取资源警报"""
        alerts = self.resource_monitor.get_alert_history(limit)
        return [alert.to_dict() for alert in alerts]

    async def export_security_report(
        self, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """导出安全报告"""
        return {
            "report_period": {
                "start_time": start_time.isoformat() if start_time else None,
                "end_time": end_time.isoformat() if end_time else None,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
            "security_status": await self.get_security_status(),
            "active_sessions": await self.get_active_sessions(),
            "recent_threats": await self.get_recent_threats(100),
            "security_alerts": await self.get_security_alerts(100),
            "resource_alerts": await self.get_resource_alerts(100),
            "resource_metrics": self.resource_monitor.export_metrics(
                start_time, end_time
            ),
            "middleware_stats": self.security_interceptor.get_middleware_list(),
        }

    # ================================
    # 紧急响应
    # ================================

    async def emergency_lockdown(self, reason: str) -> None:
        """紧急锁定"""
        try:
            logger.critical(f"Emergency lockdown initiated: {reason}")

            # 禁用所有中间件除了IP过滤
            for middleware in self.security_interceptor.middlewares:
                if middleware.name != "ip_filter":
                    await self.security_interceptor.disable_middleware(middleware.name)

            # 终止所有活跃会话
            sessions = await self.get_active_sessions()
            for session in sessions:
                await self.context_manager.remove_context(session["session_id"])

            # 记录紧急事件
            await self.audit_logger.log_event(
                "EMERGENCY_LOCKDOWN",
                f"Emergency lockdown: {reason}",
                component="security_manager",
                severity="CRITICAL",
                details={"reason": reason, "terminated_sessions": len(sessions)},
            )

        except Exception as e:
            logger.error(f"Emergency lockdown failed: {e}")
            raise

    async def lift_emergency_lockdown(self) -> None:
        """解除紧急锁定"""
        try:
            logger.info("Lifting emergency lockdown")

            # 重新启用所有中间件
            for middleware in self.security_interceptor.middlewares:
                await self.security_interceptor.enable_middleware(middleware.name)

            # 记录解除事件
            await self.audit_logger.log_event(
                "EMERGENCY_LOCKDOWN_LIFTED",
                "Emergency lockdown lifted",
                component="security_manager",
                severity="HIGH",
            )

        except Exception as e:
            logger.error(f"Failed to lift emergency lockdown: {e}")
            raise

    # ================================
    # 健康检查
    # ================================

    async def health_check(self) -> Dict[str, Any]:
        """健康检查"""
        health = {
            "overall_status": "healthy",
            "components": {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            # 检查各组件状态
            components = {
                "security_service": self.security_service._initialized,
                "context_manager": True,  # 总是可用
                "session_manager": self.session_manager._running,
                "threat_detector": True,  # 总是可用
                "resource_monitor": self.resource_monitor._monitoring,
                "security_interceptor": True,  # 总是可用
            }

            for component, status in components.items():
                health["components"][component] = {
                    "status": "healthy" if status else "unhealthy",
                    "available": status,
                }

                if not status:
                    health["overall_status"] = "degraded"

            # 检查资源状态
            resource_health = await self.resource_monitor.get_session_health()
            if not resource_health["is_healthy"]:
                health["overall_status"] = "warning"

            health["resource_health"] = resource_health

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            health["overall_status"] = "error"
            health["error"] = str(e)

        return health

    @property
    def is_initialized(self) -> bool:
        """是否已初始化"""
        return self._initialized

    @property
    def is_running(self) -> bool:
        """是否正在运行"""
        return self._running

    # ================================
    # 增强型安全功能接口
    # ================================

    async def execute_in_sandbox(
        self, code: str, user_id: str, sandbox_tier: str = "BASIC", timeout: int = 30
    ) -> Dict[str, Any]:
        """在沙箱中执行代码"""
        try:
            # 首先进行权限检查
            access_request = AccessRequest(
                user_id=user_id,
                resource=f"sandbox.execute.{sandbox_tier}",
                action="execute",
                context={"code_length": len(code)},
            )

            access_result = await self.permission_manager.check_access(access_request)
            if access_result.decision != AccessDecision.ALLOW:
                raise PermissionError(f"Access denied: {access_result.reason}")

            # 进行输入验证
            validation_context = ValidationContext(
                request_id=f"sandbox_{user_id}_{datetime.now().timestamp()}",
                user_id=user_id,
            )

            passed, violations = await self.security_validator.validate_request(
                {"code": code}, validation_context, False
            )

            if not passed:
                from .security_validator import SecurityEventSeverity

                critical_violations = [
                    v
                    for v in violations
                    if v.severity
                    in [SecurityEventSeverity.HIGH, SecurityEventSeverity.CRITICAL]
                ]
                if critical_violations:
                    from .security_validator import SecurityError

                    raise SecurityError(
                        f"Code validation failed: {critical_violations[0].message}"
                    )

            # 在沙箱中执行
            from .sandbox import execute_in_sandbox

            result = await execute_in_sandbox(code, sandbox_tier, timeout)

            return {
                "success": True,
                "result": result,
                "sandbox_tier": sandbox_tier,
                "user_id": user_id,
            }

        except Exception as e:
            logger.error(f"Sandbox execution failed for user {user_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "sandbox_tier": sandbox_tier,
                "user_id": user_id,
            }

    async def validate_user_input(
        self,
        data: Any,
        user_id: str,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Tuple[bool, List[Dict[str, Any]]]:
        """验证用户输入"""
        validation_context = ValidationContext(
            request_id=f"input_{user_id}_{datetime.now().timestamp()}",
            user_id=user_id,
            session_id=session_id,
            ip_address=ip_address,
        )

        passed, violations = await self.security_validator.validate_request(
            data, validation_context, False
        )

        # 转换违规信息为字典格式
        violation_dicts = [v.to_dict() for v in violations]

        return passed, violation_dicts

    async def check_user_permission(
        self,
        user_id: str,
        resource: str,
        action: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """检查用户权限"""
        access_request = AccessRequest(
            user_id=user_id, resource=resource, action=action, context=context or {}
        )

        access_result = await self.permission_manager.check_access(access_request)

        return {
            "allowed": access_result.decision == AccessDecision.ALLOW,
            "decision": access_result.decision.value,
            "reason": access_result.reason,
            "applied_policies": access_result.applied_policies,
            "user_id": user_id,
            "resource": resource,
            "action": action,
        }

    def get_user_risk_score(self, user_id: str) -> float:
        """获取用户风险分数"""
        return self.security_validator.get_user_risk_score(user_id)

    def get_enhanced_security_statistics(self) -> Dict[str, Any]:
        """获取增强型安全统计信息"""
        stats = {
            "security_manager": {
                "initialized": self._initialized,
                "running": self._running,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            "sandbox": self.sandbox_manager.get_statistics(),
            "permissions": self.permission_manager.get_statistics(),
            "validator": self.security_validator.get_statistics(),
        }

        return stats

    def get_user_security_profile(self, user_id: str) -> Dict[str, Any]:
        """获取用户安全档案"""
        from .security_validator import get_user_security_profile

        profile = get_user_security_profile(user_id)

        # 添加权限信息
        try:
            user_permissions = self.permission_manager.get_user_effective_permissions(
                user_id
            )
            profile["permissions"] = {
                "effective_permissions": [p.to_dict() for p in user_permissions],
                "roles": [
                    role.name
                    for role in self.permission_manager.get_user_roles(user_id)
                ],
            }
        except Exception as e:
            logger.warning(f"Failed to get user permissions for {user_id}: {e}")
            profile["permissions"] = {"error": str(e)}

        return profile
