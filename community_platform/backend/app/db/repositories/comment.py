"""
评论 Repository
"""
from typing import List, Optional
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.db.repositories.base import BaseRepository


class CommentRepository(BaseRepository[Comment]):
    """评论 Repository"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Comment, db)
    
    async def get_with_author(self, comment_id: int) -> Optional[Comment]:
        """
        获取评论及作者信息
        
        Args:
            comment_id: 评论 ID
        
        Returns:
            Optional[Comment]: 评论对象，不存在返回 None
        """
        result = await self.db.execute(
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.id == comment_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_post(
        self,
        post_id: int,
        skip: int = 0,
        limit: int = 50
    ) -> List[Comment]:
        """
        获取帖子的评论列表
        
        Args:
            post_id: 帖子 ID
            skip: 跳过的记录数
            limit: 限制返回的记录数
        
        Returns:
            List[Comment]: 评论列表
        """
        result = await self.db.execute(
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.post_id == post_id, Comment.parent_id.is_(None))
            .order_by(desc(Comment.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def get_replies(
        self,
        parent_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> List[Comment]:
        """
        获取评论的回复列表
        
        Args:
            parent_id: 父评论 ID
            skip: 跳过的记录数
            limit: 限制返回的记录数
        
        Returns:
            List[Comment]: 回复列表
        """
        result = await self.db.execute(
            select(Comment)
            .options(selectinload(Comment.author))
            .where(Comment.parent_id == parent_id)
            .order_by(Comment.created_at)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def get_by_user(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> List[Comment]:
        """
        获取用户的评论列表
        
        Args:
            user_id: 用户 ID
            skip: 跳过的记录数
            limit: 限制返回的记录数
        
        Returns:
            List[Comment]: 评论列表
        """
        result = await self.db.execute(
            select(Comment)
            .where(Comment.user_id == user_id)
            .order_by(desc(Comment.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def increment_like_count(self, comment_id: int, delta: int = 1) -> bool:
        """
        增加/减少评论点赞数
        
        Args:
            comment_id: 评论 ID
            delta: 变化量（正数增加，负数减少）
        
        Returns:
            bool: 是否成功
        """
        result = await self.db.execute(
            select(Comment).where(Comment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        
        if comment:
            comment.like_count = max(0, comment.like_count + delta)
            await self.db.flush()
            return True
        return False

