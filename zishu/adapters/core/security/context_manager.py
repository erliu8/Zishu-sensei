"""
安全上下文管理器

提供安全上下文的创建、验证、管理和生命周期控制。
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set, Callable
from dataclasses import dataclass, field
from enum import Enum
from contextlib import asynccontextmanager
import json
import hashlib

from .security_service import SecurityContext, SecurityLevel
from .permissions import Permission, Role

logger = logging.getLogger(__name__)


class ContextValidationError(Exception):
    """上下文验证错误"""

    pass


class SessionStatus(str, Enum):
    """会话状态"""

    ACTIVE = "active"
    EXPIRED = "expired"
    SUSPENDED = "suspended"
    TERMINATED = "terminated"


@dataclass
class ContextValidationResult:
    """上下文验证结果"""

    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    context: Optional[SecurityContext] = None

    def add_error(self, error: str) -> None:
        """添加错误"""
        self.errors.append(error)
        self.is_valid = False

    def add_warning(self, warning: str) -> None:
        """添加警告"""
        self.warnings.append(warning)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "context": self.context.to_dict() if self.context else None,
        }


@dataclass
class SecuritySession:
    """安全会话"""

    session_id: str
    user_id: str
    context: SecurityContext
    status: SessionStatus = SessionStatus.ACTIVE
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_accessed: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    access_count: int = 0

    # 会话元数据
    client_info: Dict[str, Any] = field(default_factory=dict)
    security_flags: Set[str] = field(default_factory=set)

    def update_access(self) -> None:
        """更新访问时间"""
        self.last_accessed = datetime.now(timezone.utc)
        self.access_count += 1

    def is_expired(self) -> bool:
        """检查是否过期"""
        return self.context.is_expired()

    def is_active(self) -> bool:
        """检查是否活跃"""
        return self.status == SessionStatus.ACTIVE and not self.is_expired()

    def suspend(self) -> None:
        """暂停会话"""
        self.status = SessionStatus.SUSPENDED

    def terminate(self) -> None:
        """终止会话"""
        self.status = SessionStatus.TERMINATED

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "last_accessed": self.last_accessed.isoformat(),
            "access_count": self.access_count,
            "client_info": self.client_info,
            "security_flags": list(self.security_flags),
            "context": self.context.to_dict(),
        }


class SecurityContextManager:
    """
    安全上下文管理器

    负责安全上下文的创建、验证、缓存和生命周期管理。
    """

    def __init__(self, default_timeout: int = 3600):
        """初始化上下文管理器"""
        self.default_timeout = default_timeout

        # 上下文存储
        self._contexts: Dict[str, SecurityContext] = {}
        self._sessions: Dict[str, SecuritySession] = {}
        self._user_sessions: Dict[str, Set[str]] = {}

        # 线程安全
        self._lock = asyncio.Lock()

        # 验证器
        self._validators: List[
            Callable[[SecurityContext], ContextValidationResult]
        ] = []
        self._setup_default_validators()

        # 事件回调
        self._context_created_callbacks: List[Callable[[SecurityContext], None]] = []
        self._context_expired_callbacks: List[Callable[[SecurityContext], None]] = []
        self._context_validated_callbacks: List[
            Callable[[SecurityContext, bool], None]
        ] = []

        logger.info("SecurityContextManager initialized")

    def _setup_default_validators(self) -> None:
        """设置默认验证器"""
        self._validators.extend(
            [
                self._validate_basic_fields,
                self._validate_permissions,
                self._validate_expiration,
                self._validate_security_level,
            ]
        )

    async def create_context(
        self,
        user_id: str,
        permissions: List[str],
        security_level: SecurityLevel = SecurityLevel.INTERNAL,
        ip_address: str = "127.0.0.1",
        user_agent: Optional[str] = None,
        timeout: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SecurityContext:
        """创建安全上下文"""
        try:
            session_id = str(uuid.uuid4())
            expires_at = datetime.now(timezone.utc) + timedelta(
                seconds=timeout or self.default_timeout
            )

            context = SecurityContext(
                user_id=user_id,
                session_id=session_id,
                permissions=permissions,
                security_level=security_level,
                ip_address=ip_address,
                user_agent=user_agent,
                expires_at=expires_at,
                metadata=metadata or {},
            )

            # 验证上下文
            validation_result = await self.validate_context(context)
            if not validation_result.is_valid:
                raise ContextValidationError(
                    f"Context validation failed: {', '.join(validation_result.errors)}"
                )

            # 存储上下文和会话
            async with self._lock:
                self._contexts[session_id] = context

                session = SecuritySession(
                    session_id=session_id,
                    user_id=user_id,
                    context=context,
                    client_info={"ip_address": ip_address, "user_agent": user_agent},
                )
                self._sessions[session_id] = session

                # 更新用户会话映射
                if user_id not in self._user_sessions:
                    self._user_sessions[user_id] = set()
                self._user_sessions[user_id].add(session_id)

            # 触发创建回调
            for callback in self._context_created_callbacks:
                try:
                    callback(context)
                except Exception as e:
                    logger.error(f"Context created callback error: {e}")

            logger.info(
                f"Security context created for user {user_id}, session {session_id}"
            )
            return context

        except Exception as e:
            logger.error(f"Failed to create security context: {e}")
            raise

    async def get_context(self, session_id: str) -> Optional[SecurityContext]:
        """获取安全上下文"""
        async with self._lock:
            context = self._contexts.get(session_id)

            if context:
                # 更新会话访问时间
                session = self._sessions.get(session_id)
                if session:
                    session.update_access()

                # 检查是否过期
                if context.is_expired():
                    await self._remove_context_internal(session_id)
                    return None

            return context

    async def validate_context(
        self, context: SecurityContext
    ) -> ContextValidationResult:
        """验证安全上下文"""
        result = ContextValidationResult(is_valid=True, context=context)

        # 运行所有验证器
        for validator in self._validators:
            try:
                validator_result = validator(context)
                if not validator_result.is_valid:
                    result.is_valid = False
                    result.errors.extend(validator_result.errors)
                result.warnings.extend(validator_result.warnings)
            except Exception as e:
                result.add_error(f"Validator error: {e}")

        # 触发验证回调
        for callback in self._context_validated_callbacks:
            try:
                callback(context, result.is_valid)
            except Exception as e:
                logger.error(f"Context validated callback error: {e}")

        return result

    async def refresh_context(
        self, session_id: str, extend_timeout: Optional[int] = None
    ) -> bool:
        """刷新上下文（延长过期时间）"""
        async with self._lock:
            context = self._contexts.get(session_id)
            if not context:
                return False

            # 延长过期时间
            if extend_timeout:
                context.expires_at = datetime.now(timezone.utc) + timedelta(
                    seconds=extend_timeout
                )
            else:
                context.expires_at = datetime.now(timezone.utc) + timedelta(
                    seconds=self.default_timeout
                )

            # 更新会话
            session = self._sessions.get(session_id)
            if session:
                session.update_access()

            logger.debug(f"Context refreshed for session {session_id}")
            return True

    async def remove_context(self, session_id: str) -> bool:
        """移除安全上下文"""
        async with self._lock:
            return await self._remove_context_internal(session_id)

    async def _remove_context_internal(self, session_id: str) -> bool:
        """内部方法：移除安全上下文"""
        context = self._contexts.pop(session_id, None)
        session = self._sessions.pop(session_id, None)

        if context and session:
            # 更新用户会话映射
            user_sessions = self._user_sessions.get(context.user_id)
            if user_sessions:
                user_sessions.discard(session_id)
                if not user_sessions:
                    del self._user_sessions[context.user_id]

            # 触发过期回调
            for callback in self._context_expired_callbacks:
                try:
                    callback(context)
                except Exception as e:
                    logger.error(f"Context expired callback error: {e}")

            logger.debug(f"Context removed for session {session_id}")
            return True

        return False

    async def get_user_sessions(self, user_id: str) -> List[SecuritySession]:
        """获取用户的所有会话"""
        async with self._lock:
            session_ids = self._user_sessions.get(user_id, set())
            sessions = []

            for session_id in list(session_ids):  # 创建副本以避免修改时的问题
                session = self._sessions.get(session_id)
                if session:
                    if session.is_active():
                        sessions.append(session)
                    else:
                        # 清理无效会话
                        await self._remove_context_internal(session_id)

            return sessions

    async def terminate_user_sessions(
        self, user_id: str, exclude_session: Optional[str] = None
    ) -> int:
        """终止用户的所有会话"""
        sessions = await self.get_user_sessions(user_id)
        terminated_count = 0

        for session in sessions:
            if exclude_session and session.session_id == exclude_session:
                continue

            session.terminate()
            await self.remove_context(session.session_id)
            terminated_count += 1

        logger.info(f"Terminated {terminated_count} sessions for user {user_id}")
        return terminated_count

    async def cleanup_expired_contexts(self) -> int:
        """清理过期的上下文"""
        expired_sessions = []

        async with self._lock:
            for session_id, context in self._contexts.items():
                if context.is_expired():
                    expired_sessions.append(session_id)

        for session_id in expired_sessions:
            await self.remove_context(session_id)

        logger.debug(f"Cleaned up {len(expired_sessions)} expired contexts")
        return len(expired_sessions)

    # ================================
    # 验证器方法
    # ================================

    def _validate_basic_fields(
        self, context: SecurityContext
    ) -> ContextValidationResult:
        """验证基本字段"""
        result = ContextValidationResult(is_valid=True)

        if not context.user_id:
            result.add_error("user_id is required")

        if not context.session_id:
            result.add_error("session_id is required")

        if not context.permissions:
            result.add_warning("No permissions specified")

        if not context.ip_address:
            result.add_error("ip_address is required")

        return result

    def _validate_permissions(
        self, context: SecurityContext
    ) -> ContextValidationResult:
        """验证权限"""
        result = ContextValidationResult(is_valid=True)

        # 检查权限格式
        for permission in context.permissions:
            if not isinstance(permission, str):
                result.add_error(f"Invalid permission format: {permission}")
            elif not permission.strip():
                result.add_error("Empty permission string")

        # 检查权限组合的合理性
        if "admin" in context.permissions and len(context.permissions) == 1:
            result.add_warning(
                "Admin permission should be combined with specific permissions"
            )

        return result

    def _validate_expiration(self, context: SecurityContext) -> ContextValidationResult:
        """验证过期时间"""
        result = ContextValidationResult(is_valid=True)

        if context.expires_at:
            now = datetime.now(timezone.utc)
            if context.expires_at <= now:
                result.add_error("Context has already expired")
            elif (context.expires_at - now).total_seconds() > 86400:  # 24小时
                result.add_warning("Context expires in more than 24 hours")
        else:
            result.add_warning("No expiration time set")

        return result

    def _validate_security_level(
        self, context: SecurityContext
    ) -> ContextValidationResult:
        """验证安全级别"""
        result = ContextValidationResult(is_valid=True)

        # 检查安全级别与权限的匹配
        if context.security_level == SecurityLevel.CONFIDENTIAL:
            if "admin" not in context.permissions:
                result.add_warning(
                    "Confidential security level without admin permission"
                )

        return result

    # ================================
    # 回调管理
    # ================================

    def add_context_created_callback(
        self, callback: Callable[[SecurityContext], None]
    ) -> None:
        """添加上下文创建回调"""
        self._context_created_callbacks.append(callback)

    def add_context_expired_callback(
        self, callback: Callable[[SecurityContext], None]
    ) -> None:
        """添加上下文过期回调"""
        self._context_expired_callbacks.append(callback)

    def add_context_validated_callback(
        self, callback: Callable[[SecurityContext, bool], None]
    ) -> None:
        """添加上下文验证回调"""
        self._context_validated_callbacks.append(callback)

    def add_validator(
        self, validator: Callable[[SecurityContext], ContextValidationResult]
    ) -> None:
        """添加自定义验证器"""
        self._validators.append(validator)

    # ================================
    # 统计和监控
    # ================================

    async def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        async with self._lock:
            active_sessions = len([s for s in self._sessions.values() if s.is_active()])
            expired_sessions = len(
                [s for s in self._sessions.values() if s.is_expired()]
            )

            return {
                "total_contexts": len(self._contexts),
                "total_sessions": len(self._sessions),
                "active_sessions": active_sessions,
                "expired_sessions": expired_sessions,
                "unique_users": len(self._user_sessions),
                "average_session_duration": self._calculate_average_session_duration(),
            }

    def _calculate_average_session_duration(self) -> float:
        """计算平均会话持续时间"""
        if not self._sessions:
            return 0.0

        total_duration = 0.0
        active_sessions = 0

        for session in self._sessions.values():
            if session.is_active():
                duration = (session.last_accessed - session.created_at).total_seconds()
                total_duration += duration
                active_sessions += 1

        return total_duration / active_sessions if active_sessions > 0 else 0.0

    async def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """获取会话信息"""
        async with self._lock:
            session = self._sessions.get(session_id)
            return session.to_dict() if session else None

    async def list_active_sessions(self) -> List[Dict[str, Any]]:
        """列出所有活跃会话"""
        async with self._lock:
            return [
                session.to_dict()
                for session in self._sessions.values()
                if session.is_active()
            ]


class SessionManager:
    """
    会话管理器

    提供高级会话管理功能，包括会话池、自动清理和监控。
    """

    def __init__(self, context_manager: SecurityContextManager):
        """初始化会话管理器"""
        self.context_manager = context_manager

        # 配置
        self.cleanup_interval = 300  # 5分钟
        self.max_sessions_per_user = 10
        self.session_warning_threshold = 0.8  # 80%使用率时警告

        # 清理任务
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False

        logger.info("SessionManager initialized")

    async def start(self) -> None:
        """启动会话管理器"""
        if self._running:
            return

        self._running = True
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("SessionManager started")

    async def stop(self) -> None:
        """停止会话管理器"""
        if not self._running:
            return

        self._running = False

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        logger.info("SessionManager stopped")

    async def _cleanup_loop(self) -> None:
        """清理循环"""
        while self._running:
            try:
                await asyncio.sleep(self.cleanup_interval)

                # 清理过期上下文
                expired_count = await self.context_manager.cleanup_expired_contexts()

                # 检查会话使用率
                stats = await self.context_manager.get_stats()
                if stats["active_sessions"] > 0:
                    logger.debug(
                        f"Session cleanup: removed {expired_count} expired sessions, "
                        f"{stats['active_sessions']} active sessions remaining"
                    )

            except Exception as e:
                logger.error(f"Session cleanup error: {e}")

    @asynccontextmanager
    async def session_context(self, user_id: str, permissions: List[str], **kwargs):
        """会话上下文管理器"""
        context = None
        try:
            # 创建上下文
            context = await self.context_manager.create_context(
                user_id=user_id, permissions=permissions, **kwargs
            )
            yield context
        finally:
            # 清理上下文
            if context:
                await self.context_manager.remove_context(context.session_id)

    async def enforce_session_limits(self, user_id: str) -> None:
        """强制执行会话限制"""
        sessions = await self.context_manager.get_user_sessions(user_id)

        if len(sessions) > self.max_sessions_per_user:
            # 按访问时间排序，移除最旧的会话
            sessions.sort(key=lambda s: s.last_accessed)
            sessions_to_remove = sessions[: -self.max_sessions_per_user]

            for session in sessions_to_remove:
                await self.context_manager.remove_context(session.session_id)

            logger.info(
                f"Removed {len(sessions_to_remove)} excess sessions for user {user_id}"
            )

    async def get_session_health(self) -> Dict[str, Any]:
        """获取会话健康状态"""
        stats = await self.context_manager.get_stats()

        # 计算健康指标
        usage_ratio = stats["active_sessions"] / max(stats["total_sessions"], 1)
        is_healthy = usage_ratio < self.session_warning_threshold

        return {
            "is_healthy": is_healthy,
            "usage_ratio": usage_ratio,
            "warning_threshold": self.session_warning_threshold,
            "stats": stats,
            "recommendations": self._get_health_recommendations(stats, usage_ratio),
        }

    def _get_health_recommendations(
        self, stats: Dict[str, Any], usage_ratio: float
    ) -> List[str]:
        """获取健康建议"""
        recommendations = []

        if usage_ratio > self.session_warning_threshold:
            recommendations.append("Consider increasing cleanup frequency")

        if stats["expired_sessions"] > stats["active_sessions"]:
            recommendations.append(
                "Many expired sessions detected, check cleanup process"
            )

        if stats["unique_users"] > 0:
            avg_sessions_per_user = stats["active_sessions"] / stats["unique_users"]
            if avg_sessions_per_user > 5:
                recommendations.append(
                    "High average sessions per user, consider session limits"
                )

        return recommendations
