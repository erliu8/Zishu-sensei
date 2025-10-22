"""
用户数据访问层

提供用户相关的数据库操作
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from ...models.user import (
    User,
    UserProfile,
    UserPermission,
    UserSession,
    UserPreference,
    UserStatus,
    UserRole,
)
from ..base import BaseRepository, QueryBuilder


class UserRepository(BaseRepository):
    """用户仓储类"""

    def __init__(self):
        super().__init__(User)

    async def get_by_username(
        self, session: AsyncSession, username: str
    ) -> Optional[User]:
        """根据用户名获取用户"""
        query = self.query().where(User.username == username).filter_not_deleted()
        result = await session.execute(query.build())
        return result.scalar_one_or_none()

    async def get_by_email(
        self, session: AsyncSession, email: str
    ) -> Optional[User]:
        """根据邮箱获取用户"""
        query = self.query().where(User.email == email).filter_not_deleted()
        result = await session.execute(query.build())
        return result.scalar_one_or_none()

    async def get_with_profile(
        self, session: AsyncSession, user_id: str
    ) -> Optional[User]:
        """获取用户及其资料"""
        query = (
            select(User)
            .where(User.id == user_id, User.is_deleted.is_(False))
            .options(selectinload(User.profile))
        )
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def search_users(
        self,
        session: AsyncSession,
        search_term: str,
        skip: int = 0,
        limit: int = 20,
    ) -> List[User]:
        """搜索用户"""
        query = (
            self.query()
            .search(search_term, ["username", "email"])
            .filter_not_deleted()
            .order_by_created_desc()
            .offset(skip)
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def get_by_role(
        self,
        session: AsyncSession,
        role: UserRole,
        skip: int = 0,
        limit: int = 100,
    ) -> List[User]:
        """根据角色获取用户列表"""
        query = (
            self.query()
            .where(User.user_role == role)
            .filter_not_deleted()
            .order_by_created_desc()
            .offset(skip)
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def verify_email(
        self, session: AsyncSession, user_id: str
    ) -> bool:
        """验证用户邮箱"""
        user = await self.get_by_id(session, user_id)
        if not user:
            return False

        user.is_verified = True
        user.verification_token = None
        user.verification_expires_at = None
        user.user_status = UserStatus.ACTIVE
        user.version += 1

        await session.flush()
        return True

    async def increment_login_attempts(
        self, session: AsyncSession, user_id: str
    ) -> int:
        """增加登录尝试次数"""
        user = await self.get_by_id(session, user_id)
        if not user:
            return 0

        user.login_attempts += 1
        await session.flush()
        return user.login_attempts

    async def reset_login_attempts(
        self, session: AsyncSession, user_id: str
    ) -> None:
        """重置登录尝试次数"""
        user = await self.get_by_id(session, user_id)
        if user:
            user.login_attempts = 0
            user.locked_until = None
            await session.flush()

