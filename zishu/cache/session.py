"""
会话管理模块
基于 Redis 的分布式会话管理
"""

import json
import uuid
from typing import Any, Dict, Optional
from datetime import datetime, timedelta

from ..utils.logger import setup_logger
from .manager import cache_manager


class Session:
    """会话对象"""

    def __init__(
        self,
        session_id: str,
        data: Optional[Dict[str, Any]] = None,
        ttl: int = 7200,
    ):
        """
        Args:
            session_id: 会话ID
            data: 会话数据
            ttl: 会话过期时间（秒）
        """
        self.session_id = session_id
        self.data = data or {}
        self.ttl = ttl
        self._modified = False

    def get(self, key: str, default: Any = None) -> Any:
        """获取会话数据"""
        return self.data.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """设置会话数据"""
        self.data[key] = value
        self._modified = True

    def delete(self, key: str) -> None:
        """删除会话数据"""
        if key in self.data:
            del self.data[key]
            self._modified = True

    def clear(self) -> None:
        """清空会话数据"""
        self.data.clear()
        self._modified = True

    def __getitem__(self, key: str) -> Any:
        """字典式访问"""
        return self.data[key]

    def __setitem__(self, key: str, value: Any) -> None:
        """字典式设置"""
        self.set(key, value)

    def __delitem__(self, key: str) -> None:
        """字典式删除"""
        self.delete(key)

    def __contains__(self, key: str) -> bool:
        """检查键是否存在"""
        return key in self.data

    def __repr__(self) -> str:
        return f"Session(id={self.session_id}, data={self.data})"


class SessionManager:
    """会话管理器"""

    def __init__(
        self,
        key_prefix: str = "session",
        default_ttl: int = 7200,  # 2小时
        auto_refresh: bool = True,
    ):
        """
        Args:
            key_prefix: 会话键前缀
            default_ttl: 默认会话过期时间（秒）
            auto_refresh: 访问时是否自动刷新过期时间
        """
        self.key_prefix = key_prefix
        self.default_ttl = default_ttl
        self.auto_refresh = auto_refresh
        self.logger = setup_logger(f"{__name__}.SessionManager")

    def _get_session_key(self, session_id: str) -> str:
        """生成会话键"""
        return f"{self.key_prefix}:{session_id}"

    async def create_session(
        self, data: Optional[Dict[str, Any]] = None, ttl: Optional[int] = None
    ) -> Session:
        """
        创建新会话

        Args:
            data: 初始会话数据
            ttl: 会话过期时间（秒）

        Returns:
            会话对象
        """
        session_id = str(uuid.uuid4())
        session = Session(session_id, data or {}, ttl or self.default_ttl)

        # 保存到 Redis
        await self.save_session(session)

        self.logger.debug("Created session: %s (ttl=%s)", session_id, session.ttl)
        return session

    async def get_session(
        self, session_id: str, auto_create: bool = False
    ) -> Optional[Session]:
        """
        获取会话

        Args:
            session_id: 会话ID
            auto_create: 如果会话不存在是否自动创建

        Returns:
            会话对象或 None
        """
        await cache_manager.ensure_initialized()

        session_key = self._get_session_key(session_id)

        # 从 Redis 获取会话数据
        session_data = await cache_manager.get(session_key, deserialize=True)

        if session_data is None:
            if auto_create:
                return await self.create_session()
            return None

        # 创建会话对象
        session = Session(session_id, session_data, self.default_ttl)

        # 自动刷新过期时间
        if self.auto_refresh:
            ttl = await cache_manager.ttl(session_key)
            if ttl > 0:
                await cache_manager.expire(session_key, self.default_ttl)

        self.logger.debug("Retrieved session: %s", session_id)
        return session

    async def save_session(self, session: Session) -> bool:
        """
        保存会话

        Args:
            session: 会话对象

        Returns:
            是否成功
        """
        await cache_manager.ensure_initialized()

        session_key = self._get_session_key(session.session_id)

        # 保存到 Redis
        success = await cache_manager.set(
            session_key, session.data, ttl=session.ttl, serialize=True
        )

        if success:
            session._modified = False
            self.logger.debug("Saved session: %s", session.session_id)

        return success

    async def delete_session(self, session_id: str) -> bool:
        """
        删除会话

        Args:
            session_id: 会话ID

        Returns:
            是否成功
        """
        await cache_manager.ensure_initialized()

        session_key = self._get_session_key(session_id)
        deleted = await cache_manager.delete(session_key)

        self.logger.debug("Deleted session: %s (deleted=%s)", session_id, deleted)
        return deleted > 0

    async def refresh_session(self, session_id: str, ttl: Optional[int] = None) -> bool:
        """
        刷新会话过期时间

        Args:
            session_id: 会话ID
            ttl: 新的过期时间（秒），None 使用默认值

        Returns:
            是否成功
        """
        await cache_manager.ensure_initialized()

        session_key = self._get_session_key(session_id)
        ttl = ttl or self.default_ttl

        success = await cache_manager.expire(session_key, ttl)
        self.logger.debug("Refreshed session: %s (ttl=%s)", session_id, ttl)

        return success

    async def exists(self, session_id: str) -> bool:
        """
        检查会话是否存在

        Args:
            session_id: 会话ID

        Returns:
            是否存在
        """
        await cache_manager.ensure_initialized()

        session_key = self._get_session_key(session_id)
        return await cache_manager.exists(session_key) > 0

    async def get_ttl(self, session_id: str) -> int:
        """
        获取会话剩余时间

        Args:
            session_id: 会话ID

        Returns:
            剩余秒数，-1表示永不过期，-2表示不存在
        """
        await cache_manager.ensure_initialized()

        session_key = self._get_session_key(session_id)
        return await cache_manager.ttl(session_key)

    async def cleanup_expired_sessions(self) -> int:
        """
        清理过期会话（Redis 会自动清理，此方法主要用于手动触发）

        Returns:
            清理的会话数量
        """
        # Redis 会自动清理过期键，这里提供一个接口以备手动清理
        self.logger.info("Redis automatically cleans up expired sessions")
        return 0


# JWT Token 黑名单管理
class TokenBlacklist:
    """JWT Token 黑名单管理"""

    def __init__(self, key_prefix: str = "jwt:blacklist"):
        """
        Args:
            key_prefix: 黑名单键前缀
        """
        self.key_prefix = key_prefix
        self.logger = setup_logger(f"{__name__}.TokenBlacklist")

    def _get_token_key(self, token: str) -> str:
        """生成 Token 键"""
        # 使用 Token 的哈希值作为键
        import hashlib
        token_hash = hashlib.sha256(token.encode()).hexdigest()[:32]
        return f"{self.key_prefix}:{token_hash}"

    async def add_token(self, token: str, ttl: Optional[int] = None) -> bool:
        """
        添加 Token 到黑名单

        Args:
            token: JWT Token
            ttl: 过期时间（秒），应该设置为 Token 的剩余有效期

        Returns:
            是否成功
        """
        await cache_manager.ensure_initialized()

        token_key = self._get_token_key(token)
        
        # 存储 Token 信息
        token_info = {
            "token_hash": token_key.split(":")[-1],
            "blacklisted_at": datetime.utcnow().isoformat(),
        }

        success = await cache_manager.set(
            token_key, token_info, ttl=ttl, serialize=True
        )

        self.logger.debug("Added token to blacklist: %s", token_key)
        return success

    async def is_blacklisted(self, token: str) -> bool:
        """
        检查 Token 是否在黑名单中

        Args:
            token: JWT Token

        Returns:
            是否在黑名单中
        """
        await cache_manager.ensure_initialized()

        token_key = self._get_token_key(token)
        return await cache_manager.exists(token_key) > 0

    async def remove_token(self, token: str) -> bool:
        """
        从黑名单移除 Token

        Args:
            token: JWT Token

        Returns:
            是否成功
        """
        await cache_manager.ensure_initialized()

        token_key = self._get_token_key(token)
        deleted = await cache_manager.delete(token_key)

        self.logger.debug("Removed token from blacklist: %s", token_key)
        return deleted > 0


# 全局实例
session_manager = SessionManager()
token_blacklist = TokenBlacklist()

