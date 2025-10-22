"""
点赞 Repository
"""
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.like import Like
from app.db.repositories.base import BaseRepository


class LikeRepository(BaseRepository[Like]):
    """点赞 Repository"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Like, db)
    
    async def get_like(
        self,
        user_id: int,
        target_type: str,
        target_id: int
    ) -> Optional[Like]:
        """
        获取点赞记录
        
        Args:
            user_id: 用户 ID
            target_type: 目标类型 ('post' 或 'comment')
            target_id: 目标 ID
        
        Returns:
            Optional[Like]: 点赞对象，不存在返回 None
        """
        result = await self.db.execute(
            select(Like).where(
                and_(
                    Like.user_id == user_id,
                    Like.target_type == target_type,
                    Like.target_id == target_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def has_liked(
        self,
        user_id: int,
        target_type: str,
        target_id: int
    ) -> bool:
        """
        检查用户是否已点赞
        
        Args:
            user_id: 用户 ID
            target_type: 目标类型
            target_id: 目标 ID
        
        Returns:
            bool: 是否已点赞
        """
        like = await self.get_like(user_id, target_type, target_id)
        return like is not None
    
    async def add_like(
        self,
        user_id: int,
        target_type: str,
        target_id: int
    ) -> Like:
        """
        添加点赞
        
        Args:
            user_id: 用户 ID
            target_type: 目标类型
            target_id: 目标 ID
        
        Returns:
            Like: 点赞对象
        """
        return await self.create({
            "user_id": user_id,
            "target_type": target_type,
            "target_id": target_id,
        })
    
    async def remove_like(
        self,
        user_id: int,
        target_type: str,
        target_id: int
    ) -> bool:
        """
        移除点赞
        
        Args:
            user_id: 用户 ID
            target_type: 目标类型
            target_id: 目标 ID
        
        Returns:
            bool: 是否成功
        """
        like = await self.get_like(user_id, target_type, target_id)
        if like:
            return await self.delete(like.id)
        return False

