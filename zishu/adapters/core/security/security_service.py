"""
适配器安全服务

提供全面的安全管理，包括：
- 安全上下文管理
- 权限验证和访问控制
- 威胁检测和防护
- 安全审计和监控
- 资源隔离和沙箱执行
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager
import json
import hashlib
import ipaddress
from collections import defaultdict, deque

from ..services.base import (
    AsyncService,
    ServiceStatus,
    ServiceHealth,
    HealthCheckResult,
)
from ..types import AdapterRegistration, SecurityLevel, EventType, Event, Priority
from .permissions import EnhancedPermissionManager, AccessRequest, AccessResult
from .audit import AuditLogger, AuditEventType, AuditSeverity, get_audit_logger

logger = logging.getLogger(__name__)


class SecurityViolationType(str, Enum):
    """安全违规类型"""

    UNAUTHORIZED_ACCESS = "unauthorized_access"
    PERMISSION_DENIED = "permission_denied"
    RESOURCE_LIMIT_EXCEEDED = "resource_limit_exceeded"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    MALICIOUS_CODE = "malicious_code"
    DATA_BREACH_ATTEMPT = "data_breach_attempt"
    SYSTEM_CALL_DENIED = "system_call_denied"
    FORBIDDEN_IMPORT = "forbidden_import"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"


@dataclass
class SecurityViolation:
    """安全违规记录"""

    violation_type: SecurityViolationType
    severity: AuditSeverity
    message: str
    user_id: Optional[str] = None
    adapter_id: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "violation_type": self.violation_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "user_id": self.user_id,
            "adapter_id": self.adapter_id,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
        }


@dataclass
class SecurityContext:
    """安全上下文"""

    user_id: str
    session_id: str
    permissions: List[str]
    security_level: SecurityLevel
    ip_address: str
    user_agent: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        """检查是否已过期"""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at

    def has_permission(self, permission: str) -> bool:
        """检查是否有指定权限"""
        return permission in self.permissions

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "session_id": self.session_id,
            "permissions": self.permissions,
            "security_level": self.security_level.value,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "metadata": self.metadata,
        }


@dataclass
class SecurityPolicy:
    """安全策略"""

    name: str
    description: str
    rules: List[Dict[str, Any]] = field(default_factory=list)
    enabled: bool = True
    priority: int = 100
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class SecurityServiceConfig:
    """安全服务配置"""

    # 基础配置
    enable_audit_logging: bool = True
    enable_threat_detection: bool = True
    enable_rate_limiting: bool = True
    enable_ip_filtering: bool = True

    # 会话管理
    session_timeout: int = 3600  # 1小时
    max_sessions_per_user: int = 10

    # 速率限制
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # 1分钟

    # IP过滤
    allowed_ip_ranges: List[str] = field(default_factory=list)
    blocked_ip_ranges: List[str] = field(default_factory=list)

    # 威胁检测
    max_failed_attempts: int = 5
    lockout_duration: int = 300  # 5分钟

    # 资源限制
    max_memory_usage: int = 1024 * 1024 * 1024  # 1GB
    max_cpu_usage: float = 80.0  # 80%
    max_execution_time: int = 300  # 5分钟

    # 安全策略
    default_security_level: SecurityLevel = SecurityLevel.INTERNAL
    require_mfa: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "enable_audit_logging": self.enable_audit_logging,
            "enable_threat_detection": self.enable_threat_detection,
            "enable_rate_limiting": self.enable_rate_limiting,
            "enable_ip_filtering": self.enable_ip_filtering,
            "session_timeout": self.session_timeout,
            "max_sessions_per_user": self.max_sessions_per_user,
            "rate_limit_requests": self.rate_limit_requests,
            "rate_limit_window": self.rate_limit_window,
            "allowed_ip_ranges": self.allowed_ip_ranges,
            "blocked_ip_ranges": self.blocked_ip_ranges,
            "max_failed_attempts": self.max_failed_attempts,
            "lockout_duration": self.lockout_duration,
            "max_memory_usage": self.max_memory_usage,
            "max_cpu_usage": self.max_cpu_usage,
            "max_execution_time": self.max_execution_time,
            "default_security_level": self.default_security_level.value,
            "require_mfa": self.require_mfa,
        }


class AdapterSecurityService(AsyncService):
    """
    适配器安全服务

    提供全面的安全管理功能，包括：
    - 安全上下文管理和验证
    - 权限控制和访问管理
    - 威胁检测和防护
    - 安全审计和监控
    - 资源隔离和限制
    """

    def __init__(self, config: Optional[SecurityServiceConfig] = None):
        """初始化安全服务"""
        super().__init__("adapter_security", config.to_dict() if config else {})

        self.security_config = config or SecurityServiceConfig()
        self.permission_manager = EnhancedPermissionManager()
        self.audit_logger = get_audit_logger()

        # 安全上下文管理
        self._security_contexts: Dict[str, SecurityContext] = {}
        self._user_sessions: Dict[str, Set[str]] = defaultdict(set)
        self._context_lock = asyncio.Lock()

        # 威胁检测
        self._failed_attempts: Dict[str, List[datetime]] = defaultdict(list)
        self._locked_accounts: Dict[str, datetime] = {}
        self._suspicious_ips: Set[str] = set()

        # 速率限制
        self._rate_limits: Dict[str, deque] = defaultdict(lambda: deque())

        # 安全策略
        self._security_policies: Dict[str, SecurityPolicy] = {}
        self._load_default_policies()

        # 安全违规记录
        self._violations: deque = deque(maxlen=10000)

        # 统计信息
        self._stats = {
            "total_requests": 0,
            "blocked_requests": 0,
            "security_violations": 0,
            "active_sessions": 0,
            "threat_detections": 0,
        }

        logger.info("AdapterSecurityService initialized")

    async def _initialize_impl(self) -> None:
        """初始化安全服务实现"""
        try:
            # 初始化审计日志
            if self.audit_logger:
                await self.audit_logger.log_event(
                    AuditEventType.SYSTEM_START,
                    "Security service initializing",
                    component="security_service",
                )

            # 加载安全策略
            await self._load_security_policies()

            # 启动清理任务
            asyncio.create_task(self._cleanup_task())

            logger.info("Security service initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize security service: {e}")
            raise

    async def _start_impl(self) -> None:
        """启动安全服务实现"""
        try:
            # 记录启动事件
            if self.audit_logger:
                await self.audit_logger.log_event(
                    AuditEventType.SYSTEM_START,
                    "Security service started",
                    component="security_service",
                )

            logger.info("Security service started")

        except Exception as e:
            logger.error(f"Failed to start security service: {e}")
            raise

    async def _stop_impl(self) -> None:
        """停止安全服务实现"""
        try:
            # 清理所有会话
            async with self._context_lock:
                self._security_contexts.clear()
                self._user_sessions.clear()

            # 记录停止事件
            if self.audit_logger:
                await self.audit_logger.log_event(
                    AuditEventType.SYSTEM_STOP,
                    "Security service stopped",
                    component="security_service",
                )

            logger.info("Security service stopped")

        except Exception as e:
            logger.error(f"Failed to stop security service: {e}")
            raise

    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查实现"""
        checks = {}
        details = {}

        try:
            # 检查审计日志
            checks["audit_logger"] = self.audit_logger is not None

            # 检查权限管理器
            checks["permission_manager"] = self.permission_manager is not None

            # 检查活跃会话数
            active_sessions = len(self._security_contexts)
            checks["sessions_healthy"] = active_sessions < 1000
            details["active_sessions"] = active_sessions

            # 检查违规数量
            recent_violations = len(
                [
                    v
                    for v in self._violations
                    if (datetime.now(timezone.utc) - v.timestamp).seconds < 300
                ]
            )
            checks["violations_normal"] = recent_violations < 10
            details["recent_violations"] = recent_violations

            # 检查威胁检测
            checks["threat_detection"] = len(self._suspicious_ips) < 100
            details["suspicious_ips"] = len(self._suspicious_ips)

            # 整体健康状态
            all_healthy = all(checks.values())
            status = ServiceHealth.HEALTHY if all_healthy else ServiceHealth.DEGRADED

            return HealthCheckResult(
                status=status,
                checks=checks,
                details=details,
                message="Security service health check completed",
            )

        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return HealthCheckResult(
                status=ServiceHealth.UNHEALTHY,
                checks={"error": False},
                details={"error": str(e)},
                message=f"Health check failed: {e}",
            )

    # ================================
    # 安全上下文管理
    # ================================

    async def create_security_context(
        self,
        user_id: str,
        permissions: List[str],
        ip_address: str,
        user_agent: Optional[str] = None,
        session_timeout: Optional[int] = None,
    ) -> SecurityContext:
        """创建安全上下文"""
        try:
            # 验证IP地址
            if not await self._validate_ip_address(ip_address):
                raise SecurityViolation(
                    SecurityViolationType.UNAUTHORIZED_ACCESS,
                    AuditSeverity.HIGH,
                    f"Access denied from blocked IP: {ip_address}",
                    user_id=user_id,
                    ip_address=ip_address,
                )

            # 检查用户是否被锁定
            if await self._is_user_locked(user_id):
                raise SecurityViolation(
                    SecurityViolationType.UNAUTHORIZED_ACCESS,
                    AuditSeverity.HIGH,
                    f"User {user_id} is locked due to security violations",
                    user_id=user_id,
                    ip_address=ip_address,
                )

            # 检查会话数限制
            if (
                len(self._user_sessions[user_id])
                >= self.security_config.max_sessions_per_user
            ):
                # 清理最旧的会话
                await self._cleanup_user_sessions(user_id)

            # 创建会话
            session_id = str(uuid.uuid4())
            timeout = session_timeout or self.security_config.session_timeout
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=timeout)

            context = SecurityContext(
                user_id=user_id,
                session_id=session_id,
                permissions=permissions,
                security_level=self.security_config.default_security_level,
                ip_address=ip_address,
                user_agent=user_agent,
                expires_at=expires_at,
            )

            # 存储上下文
            async with self._context_lock:
                self._security_contexts[session_id] = context
                self._user_sessions[user_id].add(session_id)

            # 记录审计日志
            if self.audit_logger:
                await self.audit_logger.log_event(
                    AuditEventType.AUTH_LOGIN,
                    f"Security context created for user {user_id}",
                    user_id=user_id,
                    session_id=session_id,
                    component="security_service",
                    details={
                        "permissions": permissions,
                        "ip_address": ip_address,
                        "user_agent": user_agent,
                    },
                )

            self._stats["active_sessions"] = len(self._security_contexts)

            logger.info(
                f"Security context created for user {user_id}, session {session_id}"
            )
            return context

        except Exception as e:
            logger.error(f"Failed to create security context: {e}")
            raise

    async def get_security_context(self, session_id: str) -> Optional[SecurityContext]:
        """获取安全上下文"""
        async with self._context_lock:
            context = self._security_contexts.get(session_id)

            if context and context.is_expired():
                # 清理过期上下文
                await self._remove_security_context(session_id)
                return None

            return context

    async def validate_security_context(self, session_id: str) -> bool:
        """验证安全上下文"""
        context = await self.get_security_context(session_id)
        return context is not None and not context.is_expired()

    async def remove_security_context(self, session_id: str) -> bool:
        """移除安全上下文"""
        return await self._remove_security_context(session_id)

    async def _remove_security_context(self, session_id: str) -> bool:
        """内部方法：移除安全上下文"""
        async with self._context_lock:
            context = self._security_contexts.pop(session_id, None)
            if context:
                self._user_sessions[context.user_id].discard(session_id)

                # 记录审计日志
                if self.audit_logger:
                    await self.audit_logger.log_event(
                        AuditEventType.AUTH_LOGOUT,
                        f"Security context removed for user {context.user_id}",
                        user_id=context.user_id,
                        session_id=session_id,
                        component="security_service",
                    )

                self._stats["active_sessions"] = len(self._security_contexts)
                return True

            return False

    # ================================
    # 权限验证
    # ================================

    async def check_permission(
        self,
        session_id: str,
        resource: str,
        action: str,
        adapter_id: Optional[str] = None,
    ) -> bool:
        """检查权限"""
        try:
            self._stats["total_requests"] += 1

            # 获取安全上下文
            context = await self.get_security_context(session_id)
            if not context:
                await self._record_violation(
                    SecurityViolationType.UNAUTHORIZED_ACCESS,
                    "Invalid or expired session",
                    session_id=session_id,
                    adapter_id=adapter_id,
                )
                return False

            # 速率限制检查
            if not await self._check_rate_limit(context.user_id, context.ip_address):
                await self._record_violation(
                    SecurityViolationType.RATE_LIMIT_EXCEEDED,
                    f"Rate limit exceeded for user {context.user_id}",
                    user_id=context.user_id,
                    ip_address=context.ip_address,
                    adapter_id=adapter_id,
                )
                return False

            # 权限检查
            result = self.permission_manager.check_permission(context, resource, action)

            # 记录访问日志
            if self.audit_logger:
                await self.audit_logger.log_event(
                    AuditEventType.PERMISSION_CHECK,
                    f"Permission check: {action} on {resource} - {'granted' if result.granted else 'denied'}",
                    user_id=context.user_id,
                    session_id=session_id,
                    component="security_service",
                    details={
                        "resource": resource,
                        "action": action,
                        "granted": result.granted,
                        "adapter_id": adapter_id,
                    },
                )

            if not result.granted:
                await self._record_violation(
                    SecurityViolationType.PERMISSION_DENIED,
                    f"Permission denied: {action} on {resource}",
                    user_id=context.user_id,
                    ip_address=context.ip_address,
                    adapter_id=adapter_id,
                )
                self._stats["blocked_requests"] += 1

            return result.granted

        except Exception as e:
            logger.error(f"Permission check failed: {e}")
            return False

    # ================================
    # 威胁检测
    # ================================

    async def detect_threats(
        self, user_id: str, ip_address: str, request_data: Dict[str, Any]
    ) -> List[SecurityViolation]:
        """威胁检测"""
        violations = []

        try:
            # 检查可疑IP
            if ip_address in self._suspicious_ips:
                violations.append(
                    SecurityViolation(
                        SecurityViolationType.SUSPICIOUS_ACTIVITY,
                        AuditSeverity.HIGH,
                        f"Request from suspicious IP: {ip_address}",
                        user_id=user_id,
                        ip_address=ip_address,
                    )
                )

            # 检查恶意代码模式
            if "code" in request_data:
                code_violations = await self._detect_malicious_code(
                    request_data["code"]
                )
                violations.extend(code_violations)

            # 检查异常行为模式
            behavior_violations = await self._detect_suspicious_behavior(
                user_id, request_data
            )
            violations.extend(behavior_violations)

            # 记录威胁检测结果
            if violations:
                self._stats["threat_detections"] += len(violations)
                for violation in violations:
                    await self._record_violation_obj(violation)

            return violations

        except Exception as e:
            logger.error(f"Threat detection failed: {e}")
            return []

    async def _detect_malicious_code(self, code: str) -> List[SecurityViolation]:
        """检测恶意代码"""
        violations = []

        # 危险关键词检测
        dangerous_patterns = [
            "eval(",
            "exec(",
            "__import__",
            "subprocess",
            "os.system",
            "open(",
            "file(",
            "input(",
            "raw_input(",
            "compile(",
            "globals(",
            "locals(",
            "vars(",
            "dir(",
            "getattr(",
            "setattr(",
            "delattr(",
            "hasattr(",
        ]

        for pattern in dangerous_patterns:
            if pattern in code:
                violations.append(
                    SecurityViolation(
                        SecurityViolationType.MALICIOUS_CODE,
                        AuditSeverity.HIGH,
                        f"Dangerous code pattern detected: {pattern}",
                        details={"pattern": pattern, "code_snippet": code[:100]},
                    )
                )

        return violations

    async def _detect_suspicious_behavior(
        self, user_id: str, request_data: Dict[str, Any]
    ) -> List[SecurityViolation]:
        """检测可疑行为"""
        violations = []

        # 检查请求频率
        current_time = datetime.now(timezone.utc)
        user_requests = self._rate_limits.get(user_id, deque())

        # 清理旧请求
        while user_requests and (current_time - user_requests[0]).seconds > 60:
            user_requests.popleft()

        if len(user_requests) > 50:  # 1分钟内超过50个请求
            violations.append(
                SecurityViolation(
                    SecurityViolationType.SUSPICIOUS_ACTIVITY,
                    AuditSeverity.MEDIUM,
                    f"High request frequency detected for user {user_id}",
                    user_id=user_id,
                    details={"request_count": len(user_requests)},
                )
            )

        return violations

    # ================================
    # 辅助方法
    # ================================

    async def _validate_ip_address(self, ip_address: str) -> bool:
        """验证IP地址"""
        try:
            ip = ipaddress.ip_address(ip_address)

            # 检查黑名单
            for blocked_range in self.security_config.blocked_ip_ranges:
                if ip in ipaddress.ip_network(blocked_range, strict=False):
                    return False

            # 检查白名单（如果配置了）
            if self.security_config.allowed_ip_ranges:
                for allowed_range in self.security_config.allowed_ip_ranges:
                    if ip in ipaddress.ip_network(allowed_range, strict=False):
                        return True
                return False  # 配置了白名单但不在其中

            return True

        except ValueError:
            return False

    async def _is_user_locked(self, user_id: str) -> bool:
        """检查用户是否被锁定"""
        if user_id in self._locked_accounts:
            lock_time = self._locked_accounts[user_id]
            if (
                datetime.now(timezone.utc) - lock_time
            ).seconds < self.security_config.lockout_duration:
                return True
            else:
                # 锁定时间已过，解除锁定
                del self._locked_accounts[user_id]

        return False

    async def _check_rate_limit(self, user_id: str, ip_address: str) -> bool:
        """检查速率限制"""
        if not self.security_config.enable_rate_limiting:
            return True

        current_time = datetime.now(timezone.utc)

        # 检查用户级别的速率限制
        user_key = f"user:{user_id}"
        if not self._check_rate_limit_key(user_key, current_time):
            return False

        # 检查IP级别的速率限制
        ip_key = f"ip:{ip_address}"
        if not self._check_rate_limit_key(ip_key, current_time):
            return False

        return True

    def _check_rate_limit_key(self, key: str, current_time: datetime) -> bool:
        """检查特定键的速率限制"""
        requests = self._rate_limits[key]

        # 清理过期请求
        window_start = current_time - timedelta(
            seconds=self.security_config.rate_limit_window
        )
        while requests and requests[0] < window_start:
            requests.popleft()

        # 检查是否超过限制
        if len(requests) >= self.security_config.rate_limit_requests:
            return False

        # 记录当前请求
        requests.append(current_time)
        return True

    async def _record_violation(
        self,
        violation_type: SecurityViolationType,
        message: str,
        user_id: Optional[str] = None,
        adapter_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        session_id: Optional[str] = None,
        severity: AuditSeverity = AuditSeverity.MEDIUM,
    ) -> None:
        """记录安全违规"""
        violation = SecurityViolation(
            violation_type=violation_type,
            severity=severity,
            message=message,
            user_id=user_id,
            adapter_id=adapter_id,
            ip_address=ip_address,
            details={"session_id": session_id} if session_id else {},
        )

        await self._record_violation_obj(violation)

    async def _record_violation_obj(self, violation: SecurityViolation) -> None:
        """记录安全违规对象"""
        self._violations.append(violation)
        self._stats["security_violations"] += 1

        # 记录审计日志
        if self.audit_logger:
            await self.audit_logger.log_event(
                AuditEventType.SECURITY_VIOLATION,
                violation.message,
                user_id=violation.user_id,
                component="security_service",
                details=violation.to_dict(),
            )

        # 检查是否需要锁定用户
        if violation.user_id and violation.violation_type in [
            SecurityViolationType.UNAUTHORIZED_ACCESS,
            SecurityViolationType.PERMISSION_DENIED,
        ]:
            await self._check_user_lockout(violation.user_id)

        # 检查是否需要标记可疑IP
        if violation.ip_address and violation.severity in [
            AuditSeverity.HIGH,
            AuditSeverity.CRITICAL,
        ]:
            self._suspicious_ips.add(violation.ip_address)

    async def _check_user_lockout(self, user_id: str) -> None:
        """检查是否需要锁定用户"""
        # 统计最近的失败尝试
        recent_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        recent_failures = [
            v
            for v in self._violations
            if (
                v.user_id == user_id
                and v.timestamp > recent_time
                and v.violation_type
                in [
                    SecurityViolationType.UNAUTHORIZED_ACCESS,
                    SecurityViolationType.PERMISSION_DENIED,
                ]
            )
        ]

        if len(recent_failures) >= self.security_config.max_failed_attempts:
            self._locked_accounts[user_id] = datetime.now(timezone.utc)

            # 记录锁定事件
            if self.audit_logger:
                await self.audit_logger.log_event(
                    AuditEventType.SECURITY_VIOLATION,
                    f"User {user_id} locked due to multiple security violations",
                    user_id=user_id,
                    component="security_service",
                    details={"failure_count": len(recent_failures)},
                )

    async def _cleanup_user_sessions(self, user_id: str) -> None:
        """清理用户的旧会话"""
        sessions = list(self._user_sessions[user_id])
        sessions_to_remove = sessions[: -self.security_config.max_sessions_per_user + 1]

        for session_id in sessions_to_remove:
            await self._remove_security_context(session_id)

    def _load_default_policies(self) -> None:
        """加载默认安全策略"""
        # 基础访问策略
        self._security_policies["basic_access"] = SecurityPolicy(
            name="basic_access",
            description="Basic access control policy",
            rules=[
                {
                    "type": "permission_required",
                    "resource": "*",
                    "action": "read",
                    "permission": "read",
                },
                {
                    "type": "permission_required",
                    "resource": "*",
                    "action": "write",
                    "permission": "write",
                },
            ],
        )

        # 适配器管理策略
        self._security_policies["adapter_management"] = SecurityPolicy(
            name="adapter_management",
            description="Adapter management security policy",
            rules=[
                {
                    "type": "permission_required",
                    "resource": "adapter",
                    "action": "install",
                    "permission": "adapter_manage",
                },
                {
                    "type": "permission_required",
                    "resource": "adapter",
                    "action": "uninstall",
                    "permission": "adapter_manage",
                },
            ],
        )

    async def _load_security_policies(self) -> None:
        """加载安全策略"""
        # 这里可以从配置文件或数据库加载策略
        pass

    async def _cleanup_task(self) -> None:
        """清理任务"""
        while self.is_running:
            try:
                await asyncio.sleep(60)  # 每分钟清理一次

                # 清理过期会话
                current_time = datetime.now(timezone.utc)
                expired_sessions = []

                async with self._context_lock:
                    for session_id, context in self._security_contexts.items():
                        if context.is_expired():
                            expired_sessions.append(session_id)

                for session_id in expired_sessions:
                    await self._remove_security_context(session_id)

                # 清理旧的速率限制记录
                for key in list(self._rate_limits.keys()):
                    requests = self._rate_limits[key]
                    window_start = current_time - timedelta(
                        seconds=self.security_config.rate_limit_window * 2
                    )
                    while requests and requests[0] < window_start:
                        requests.popleft()

                    if not requests:
                        del self._rate_limits[key]

                # 清理旧的锁定记录
                expired_locks = []
                for user_id, lock_time in self._locked_accounts.items():
                    if (
                        current_time - lock_time
                    ).seconds > self.security_config.lockout_duration:
                        expired_locks.append(user_id)

                for user_id in expired_locks:
                    del self._locked_accounts[user_id]

                logger.debug(
                    f"Cleanup completed: removed {len(expired_sessions)} expired sessions"
                )

            except Exception as e:
                logger.error(f"Cleanup task error: {e}")

    # ================================
    # 公共API
    # ================================

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return self._stats.copy()

    def get_security_config(self) -> SecurityServiceConfig:
        """获取安全配置"""
        return self.security_config

    async def get_recent_violations(self, limit: int = 100) -> List[SecurityViolation]:
        """获取最近的安全违规"""
        return list(self._violations)[-limit:]

    async def get_active_sessions(self) -> List[Dict[str, Any]]:
        """获取活跃会话"""
        async with self._context_lock:
            return [context.to_dict() for context in self._security_contexts.values()]

    async def force_logout_user(self, user_id: str) -> int:
        """强制用户登出"""
        sessions_removed = 0
        sessions_to_remove = list(self._user_sessions[user_id])

        for session_id in sessions_to_remove:
            if await self._remove_security_context(session_id):
                sessions_removed += 1

        return sessions_removed

    async def unlock_user(self, user_id: str) -> bool:
        """解锁用户"""
        if user_id in self._locked_accounts:
            del self._locked_accounts[user_id]

            # 记录解锁事件
            if self.audit_logger:
                await self.audit_logger.log_event(
                    AuditEventType.ADMIN_ACTION,
                    f"User {user_id} unlocked by administrator",
                    user_id=user_id,
                    component="security_service",
                )

            return True

        return False

    async def add_suspicious_ip(self, ip_address: str) -> None:
        """添加可疑IP"""
        self._suspicious_ips.add(ip_address)

        # 记录事件
        if self.audit_logger:
            await self.audit_logger.log_event(
                AuditEventType.SECURITY_VIOLATION,
                f"IP {ip_address} marked as suspicious",
                component="security_service",
                details={"ip_address": ip_address},
            )

    async def remove_suspicious_ip(self, ip_address: str) -> bool:
        """移除可疑IP"""
        if ip_address in self._suspicious_ips:
            self._suspicious_ips.remove(ip_address)

            # 记录事件
            if self.audit_logger:
                await self.audit_logger.log_event(
                    AuditEventType.ADMIN_ACTION,
                    f"IP {ip_address} removed from suspicious list",
                    component="security_service",
                    details={"ip_address": ip_address},
                )

            return True

        return False
