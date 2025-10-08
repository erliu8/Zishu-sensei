#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
会话工具类 - 处理用户会话管理、跟踪和安全
"""

import secrets
import time
import json
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, asdict
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class SessionStatus(Enum):
    """会话状态"""

    ACTIVE = "active"
    EXPIRED = "expired"
    TERMINATED = "terminated"
    SUSPENDED = "suspended"


class DeviceType(Enum):
    """设备类型"""

    DESKTOP = "desktop"
    MOBILE = "mobile"
    TABLET = "tablet"
    API = "api"
    UNKNOWN = "unknown"


@dataclass
class SessionInfo:
    """会话信息"""

    session_id: str
    user_id: str
    device_id: str
    device_type: DeviceType
    ip_address: str
    user_agent: str
    created_at: datetime
    last_activity: datetime
    expires_at: datetime
    status: SessionStatus
    location: Optional[Dict[str, str]] = None
    security_flags: Optional[Dict[str, bool]] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = asdict(self)
        data["device_type"] = self.device_type.value
        data["status"] = self.status.value
        data["created_at"] = self.created_at.isoformat()
        data["last_activity"] = self.last_activity.isoformat()
        data["expires_at"] = self.expires_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionInfo":
        """从字典创建"""
        data["device_type"] = DeviceType(data["device_type"])
        data["status"] = SessionStatus(data["status"])
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["last_activity"] = datetime.fromisoformat(data["last_activity"])
        data["expires_at"] = datetime.fromisoformat(data["expires_at"])
        return cls(**data)


class SessionConfig:
    """会话配置"""

    def __init__(
        self,
        default_timeout_minutes: int = 60,
        max_timeout_minutes: int = 480,  # 8小时
        remember_me_days: int = 30,
        max_concurrent_sessions: int = 5,
        session_cleanup_interval: int = 3600,  # 1小时
        track_location: bool = True,
        require_device_verification: bool = False,
        allow_session_sharing: bool = False,
    ):
        self.default_timeout_minutes = default_timeout_minutes
        self.max_timeout_minutes = max_timeout_minutes
        self.remember_me_days = remember_me_days
        self.max_concurrent_sessions = max_concurrent_sessions
        self.session_cleanup_interval = session_cleanup_interval
        self.track_location = track_location
        self.require_device_verification = require_device_verification
        self.allow_session_sharing = allow_session_sharing


class SessionManager:
    """会话管理器"""

    def __init__(self, config: Optional[SessionConfig] = None):
        self.config = config or SessionConfig()
        self._sessions: Dict[str, SessionInfo] = {}
        self._user_sessions: Dict[str, Set[str]] = {}  # user_id -> session_ids
        self._last_cleanup = time.time()

    def create_session(
        self,
        user_id: str,
        ip_address: str,
        user_agent: str,
        device_id: Optional[str] = None,
        remember_me: bool = False,
        timeout_minutes: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> SessionInfo:
        """创建新会话"""
        # 生成会话ID
        session_id = self._generate_session_id()

        # 生成或使用设备ID
        if not device_id:
            device_id = self._generate_device_id(user_agent, ip_address)

        # 确定设备类型
        device_type = self._detect_device_type(user_agent)

        # 计算过期时间
        if remember_me:
            timeout = timedelta(days=self.config.remember_me_days)
        else:
            timeout_mins = timeout_minutes or self.config.default_timeout_minutes
            timeout_mins = min(timeout_mins, self.config.max_timeout_minutes)
            timeout = timedelta(minutes=timeout_mins)

        now = datetime.now(timezone.utc)
        expires_at = now + timeout

        # 获取位置信息
        location = None
        if self.config.track_location:
            location = self._get_location_info(ip_address)

        # 创建会话信息
        session_info = SessionInfo(
            session_id=session_id,
            user_id=user_id,
            device_id=device_id,
            device_type=device_type,
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=now,
            last_activity=now,
            expires_at=expires_at,
            status=SessionStatus.ACTIVE,
            location=location,
            security_flags={
                "remember_me": remember_me,
                "verified_device": not self.config.require_device_verification,
                "secure_connection": ip_address != "127.0.0.1",  # 简化检查
            },
            metadata=metadata or {},
        )

        # 检查并清理用户的旧会话
        self._enforce_session_limits(user_id)

        # 存储会话
        self._sessions[session_id] = session_info

        # 更新用户会话索引
        if user_id not in self._user_sessions:
            self._user_sessions[user_id] = set()
        self._user_sessions[user_id].add(session_id)

        logger.info(f"创建会话: {session_id} for user {user_id}")
        return session_info

    def get_session(self, session_id: str) -> Optional[SessionInfo]:
        """获取会话信息"""
        session = self._sessions.get(session_id)
        if not session:
            return None

        # 检查会话是否过期
        if self._is_session_expired(session):
            self._expire_session(session_id)
            return None

        return session

    def validate_session(
        self, session_id: str, ip_address: str, user_agent: Optional[str] = None
    ) -> Optional[SessionInfo]:
        """验证会话"""
        session = self.get_session(session_id)
        if not session:
            return None

        # IP地址检查
        if not self.config.allow_session_sharing and session.ip_address != ip_address:
            logger.warning(
                f"会话IP不匹配: {session_id}, 期望 {session.ip_address}, 实际 {ip_address}"
            )
            self._suspend_session(session_id, "ip_mismatch")
            return None

        # User-Agent检查（可选）
        if user_agent and session.user_agent != user_agent:
            # 记录但不阻止（User-Agent可能会变化）
            logger.info(f"会话User-Agent变化: {session_id}")

        # 更新最后活动时间
        self._update_session_activity(session_id)

        return session

    def refresh_session(
        self, session_id: str, extend_minutes: Optional[int] = None
    ) -> bool:
        """刷新会话"""
        session = self._sessions.get(session_id)
        if not session or session.status != SessionStatus.ACTIVE:
            return False

        now = datetime.now(timezone.utc)

        # 计算新的过期时间
        if extend_minutes:
            extend_minutes = min(extend_minutes, self.config.max_timeout_minutes)
            new_expires = now + timedelta(minutes=extend_minutes)
        else:
            # 使用默认超时时间
            new_expires = now + timedelta(minutes=self.config.default_timeout_minutes)

        # 更新会话
        session.expires_at = new_expires
        session.last_activity = now

        logger.info(f"刷新会话: {session_id}, 新过期时间: {new_expires}")
        return True

    def terminate_session(self, session_id: str, reason: str = "user_logout") -> bool:
        """终止会话"""
        session = self._sessions.get(session_id)
        if not session:
            return False

        session.status = SessionStatus.TERMINATED
        session.metadata = session.metadata or {}
        session.metadata["termination_reason"] = reason
        session.metadata["terminated_at"] = datetime.now(timezone.utc).isoformat()

        # 从用户会话索引中移除
        if session.user_id in self._user_sessions:
            self._user_sessions[session.user_id].discard(session_id)

        logger.info(f"终止会话: {session_id}, 原因: {reason}")
        return True

    def terminate_user_sessions(
        self,
        user_id: str,
        exclude_session_id: Optional[str] = None,
        reason: str = "admin_action",
    ) -> int:
        """终止用户的所有会话"""
        if user_id not in self._user_sessions:
            return 0

        session_ids = list(self._user_sessions[user_id])
        terminated_count = 0

        for session_id in session_ids:
            if session_id != exclude_session_id:
                if self.terminate_session(session_id, reason):
                    terminated_count += 1

        logger.info(f"终止用户 {user_id} 的 {terminated_count} 个会话")
        return terminated_count

    def get_user_sessions(
        self, user_id: str, active_only: bool = True
    ) -> List[SessionInfo]:
        """获取用户的所有会话"""
        if user_id not in self._user_sessions:
            return []

        sessions = []
        for session_id in self._user_sessions[user_id]:
            session = self._sessions.get(session_id)
            if session:
                if not active_only or session.status == SessionStatus.ACTIVE:
                    sessions.append(session)

        # 按最后活动时间排序
        sessions.sort(key=lambda s: s.last_activity, reverse=True)
        return sessions

    def get_session_stats(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """获取会话统计信息"""
        if user_id:
            user_sessions = self.get_user_sessions(user_id, active_only=False)
            active_sessions = [
                s for s in user_sessions if s.status == SessionStatus.ACTIVE
            ]

            return {
                "user_id": user_id,
                "total_sessions": len(user_sessions),
                "active_sessions": len(active_sessions),
                "device_types": list(set(s.device_type.value for s in user_sessions)),
                "locations": list(
                    set(
                        s.location.get("country", "Unknown")
                        if s.location
                        else "Unknown"
                        for s in user_sessions
                    )
                ),
                "oldest_session": min(
                    user_sessions, key=lambda s: s.created_at
                ).created_at
                if user_sessions
                else None,
                "newest_session": max(
                    user_sessions, key=lambda s: s.created_at
                ).created_at
                if user_sessions
                else None,
            }
        else:
            # 全局统计
            all_sessions = list(self._sessions.values())
            active_sessions = [
                s for s in all_sessions if s.status == SessionStatus.ACTIVE
            ]

            return {
                "total_sessions": len(all_sessions),
                "active_sessions": len(active_sessions),
                "unique_users": len(self._user_sessions),
                "device_types": dict(
                    self._count_by_field(all_sessions, lambda s: s.device_type.value)
                ),
                "status_distribution": dict(
                    self._count_by_field(all_sessions, lambda s: s.status.value)
                ),
                "sessions_by_hour": self._get_sessions_by_hour(all_sessions),
            }

    def cleanup_expired_sessions(self) -> int:
        """清理过期会话"""
        current_time = time.time()
        if current_time - self._last_cleanup < self.config.session_cleanup_interval:
            return 0

        expired_sessions = []
        for session_id, session in self._sessions.items():
            if (
                self._is_session_expired(session)
                or session.status != SessionStatus.ACTIVE
            ):
                expired_sessions.append(session_id)

        # 清理过期会话
        cleaned_count = 0
        for session_id in expired_sessions:
            if self._remove_session(session_id):
                cleaned_count += 1

        self._last_cleanup = current_time

        if cleaned_count > 0:
            logger.info(f"清理了 {cleaned_count} 个过期会话")

        return cleaned_count

    def _generate_session_id(self) -> str:
        """生成会话ID"""
        return f"sess_{secrets.token_urlsafe(32)}"

    def _generate_device_id(self, user_agent: str, ip_address: str) -> str:
        """生成设备ID"""
        # 简化的设备指纹
        import hashlib

        fingerprint = f"{user_agent}:{ip_address}"
        device_hash = hashlib.sha256(fingerprint.encode()).hexdigest()[:16]
        return f"dev_{device_hash}"

    def _detect_device_type(self, user_agent: str) -> DeviceType:
        """检测设备类型"""
        if not user_agent:
            return DeviceType.UNKNOWN

        user_agent_lower = user_agent.lower()

        if any(
            mobile in user_agent_lower for mobile in ["mobile", "android", "iphone"]
        ):
            return DeviceType.MOBILE
        elif any(tablet in user_agent_lower for tablet in ["tablet", "ipad"]):
            return DeviceType.TABLET
        elif any(
            desktop in user_agent_lower for desktop in ["windows", "macintosh", "linux"]
        ):
            return DeviceType.DESKTOP
        elif "api" in user_agent_lower or "bot" in user_agent_lower:
            return DeviceType.API
        else:
            return DeviceType.UNKNOWN

    def _get_location_info(self, ip_address: str) -> Optional[Dict[str, str]]:
        """获取IP位置信息"""
        # 这里应该集成真实的IP地理位置服务
        # 例如：MaxMind GeoIP2, ipapi.co 等

        # 简化的示例实现
        if (
            ip_address.startswith("192.168.")
            or ip_address.startswith("10.")
            or ip_address == "127.0.0.1"
        ):
            return {
                "country": "Local",
                "region": "Private Network",
                "city": "Localhost",
            }

        # 返回模拟数据
        return {"country": "Unknown", "region": "Unknown", "city": "Unknown"}

    def _is_session_expired(self, session: SessionInfo) -> bool:
        """检查会话是否过期"""
        now = datetime.now(timezone.utc)
        return now > session.expires_at

    def _expire_session(self, session_id: str):
        """标记会话为过期"""
        session = self._sessions.get(session_id)
        if session:
            session.status = SessionStatus.EXPIRED
            logger.info(f"会话过期: {session_id}")

    def _suspend_session(self, session_id: str, reason: str):
        """暂停会话"""
        session = self._sessions.get(session_id)
        if session:
            session.status = SessionStatus.SUSPENDED
            session.metadata = session.metadata or {}
            session.metadata["suspension_reason"] = reason
            session.metadata["suspended_at"] = datetime.now(timezone.utc).isoformat()
            logger.warning(f"暂停会话: {session_id}, 原因: {reason}")

    def _update_session_activity(self, session_id: str):
        """更新会话活动时间"""
        session = self._sessions.get(session_id)
        if session:
            session.last_activity = datetime.now(timezone.utc)

    def _enforce_session_limits(self, user_id: str):
        """强制执行会话限制"""
        if user_id not in self._user_sessions:
            return

        user_session_ids = list(self._user_sessions[user_id])
        active_sessions = []

        # 收集活跃会话
        for session_id in user_session_ids:
            session = self._sessions.get(session_id)
            if (
                session
                and session.status == SessionStatus.ACTIVE
                and not self._is_session_expired(session)
            ):
                active_sessions.append(session)

        # 如果超过限制，终止最旧的会话
        if len(active_sessions) >= self.config.max_concurrent_sessions:
            # 按最后活动时间排序，终止最旧的
            active_sessions.sort(key=lambda s: s.last_activity)
            sessions_to_terminate = active_sessions[
                : -self.config.max_concurrent_sessions + 1
            ]

            for session in sessions_to_terminate:
                self.terminate_session(session.session_id, "session_limit_exceeded")

    def _remove_session(self, session_id: str) -> bool:
        """移除会话"""
        session = self._sessions.get(session_id)
        if not session:
            return False

        # 从会话存储中移除
        del self._sessions[session_id]

        # 从用户会话索引中移除
        if session.user_id in self._user_sessions:
            self._user_sessions[session.user_id].discard(session_id)

            # 如果用户没有其他会话，移除用户索引
            if not self._user_sessions[session.user_id]:
                del self._user_sessions[session.user_id]

        return True

    def _count_by_field(
        self, sessions: List[SessionInfo], field_func
    ) -> Dict[str, int]:
        """按字段统计"""
        counts = {}
        for session in sessions:
            field_value = field_func(session)
            counts[field_value] = counts.get(field_value, 0) + 1
        return counts

    def _get_sessions_by_hour(self, sessions: List[SessionInfo]) -> Dict[int, int]:
        """按小时统计会话创建"""
        hour_counts = {i: 0 for i in range(24)}

        for session in sessions:
            hour = session.created_at.hour
            hour_counts[hour] += 1

        return hour_counts


# 工具函数
def parse_user_agent(user_agent: str) -> Dict[str, str]:
    """解析User-Agent字符串"""
    # 简化的User-Agent解析
    info = {
        "browser": "Unknown",
        "version": "Unknown",
        "os": "Unknown",
        "device": "Unknown",
    }

    if not user_agent:
        return info

    ua_lower = user_agent.lower()

    # 检测浏览器
    if "chrome" in ua_lower:
        info["browser"] = "Chrome"
    elif "firefox" in ua_lower:
        info["browser"] = "Firefox"
    elif "safari" in ua_lower:
        info["browser"] = "Safari"
    elif "edge" in ua_lower:
        info["browser"] = "Edge"

    # 检测操作系统
    if "windows" in ua_lower:
        info["os"] = "Windows"
    elif "macintosh" in ua_lower or "mac os" in ua_lower:
        info["os"] = "macOS"
    elif "linux" in ua_lower:
        info["os"] = "Linux"
    elif "android" in ua_lower:
        info["os"] = "Android"
    elif "ios" in ua_lower or "iphone" in ua_lower or "ipad" in ua_lower:
        info["os"] = "iOS"

    return info


def generate_session_token() -> str:
    """生成会话令牌"""
    return secrets.token_urlsafe(32)


# 示例用法
if __name__ == "__main__":
    # 创建会话管理器
    config = SessionConfig(default_timeout_minutes=60, max_concurrent_sessions=3)
    session_manager = SessionManager(config)

    # 创建会话
    session = session_manager.create_session(
        user_id="user_123",
        ip_address="192.168.1.100",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    )

    print(f"创建会话: {session.session_id}")
    print(f"设备类型: {session.device_type.value}")
    print(f"过期时间: {session.expires_at}")

    # 验证会话
    validated_session = session_manager.validate_session(
        session.session_id, "192.168.1.100"
    )

    if validated_session:
        print("会话验证成功")
    else:
        print("会话验证失败")

    # 获取会话统计
    stats = session_manager.get_session_stats("user_123")
    print(f"用户会话统计: {stats}")
