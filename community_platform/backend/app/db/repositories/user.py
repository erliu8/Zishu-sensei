"""
用户 Repository
"""
from typing import Optional
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.db.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    """用户 Repository"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(User, db)
    
    async def get_by_username(self, username: str) -> Optional[User]:
        """
        根据用户名获取用户
        
        Args:
            username: 用户名
        
        Returns:
            Optional[User]: 用户对象，不存在返回 None
        """
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """
        根据邮箱获取用户
        
        Args:
            email: 邮箱
        
        Returns:
            Optional[User]: 用户对象，不存在返回 None
        """
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_by_username_or_email(self, identifier: str) -> Optional[User]:
        """
        根据用户名或邮箱获取用户
        
        Args:
            identifier: 用户名或邮箱
        
        Returns:
            Optional[User]: 用户对象，不存在返回 None
        """
        result = await self.db.execute(
            select(User).where(
                or_(User.username == identifier, User.email == identifier)
            )
        )
        return result.scalar_one_or_none()
    
    async def username_exists(self, username: str) -> bool:
        """
        检查用户名是否存在
        
        Args:
            username: 用户名
        
        Returns:
            bool: 是否存在
        """
        return await self.exists(username=username)
    
    async def email_exists(self, email: str) -> bool:
        """
        检查邮箱是否存在
        
        Args:
            email: 邮箱
        
        Returns:
            bool: 是否存在
        """
        return await self.exists(email=email)

