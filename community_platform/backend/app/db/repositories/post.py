"""
帖子 Repository
"""
from typing import List, Optional
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.post import Post
from app.models.user import User
from app.db.repositories.base import BaseRepository


class PostRepository(BaseRepository[Post]):
    """帖子 Repository"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Post, db)
    
    async def get_with_author(self, post_id: int) -> Optional[Post]:
        """
        获取帖子及作者信息
        
        Args:
            post_id: 帖子 ID
        
        Returns:
            Optional[Post]: 帖子对象，不存在返回 None
        """
        result = await self.db.execute(
            select(Post)
            .options(selectinload(Post.author))
            .where(Post.id == post_id)
        )
        return result.scalar_one_or_none()
    
    async def get_by_user(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
        published_only: bool = True
    ) -> List[Post]:
        """
        获取用户的帖子列表
        
        Args:
            user_id: 用户 ID
            skip: 跳过的记录数
            limit: 限制返回的记录数
            published_only: 是否只返回已发布的帖子
        
        Returns:
            List[Post]: 帖子列表
        """
        query = select(Post).where(Post.user_id == user_id)
        
        if published_only:
            query = query.where(Post.is_published == True)
        
        query = query.order_by(desc(Post.created_at)).offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_by_category(
        self,
        category: str,
        skip: int = 0,
        limit: int = 20
    ) -> List[Post]:
        """
        获取指定分类的帖子列表
        
        Args:
            category: 分类
            skip: 跳过的记录数
            limit: 限制返回的记录数
        
        Returns:
            List[Post]: 帖子列表
        """
        result = await self.db.execute(
            select(Post)
            .where(Post.category == category, Post.is_published == True)
            .order_by(desc(Post.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def get_popular(
        self,
        skip: int = 0,
        limit: int = 20
    ) -> List[Post]:
        """
        获取热门帖子（按点赞数和查看数排序）
        
        Args:
            skip: 跳过的记录数
            limit: 限制返回的记录数
        
        Returns:
            List[Post]: 帖子列表
        """
        result = await self.db.execute(
            select(Post)
            .where(Post.is_published == True)
            .order_by(
                desc(Post.like_count + Post.view_count * 0.1)
            )
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def increment_view_count(self, post_id: int) -> bool:
        """
        增加帖子查看数
        
        Args:
            post_id: 帖子 ID
        
        Returns:
            bool: 是否成功
        """
        result = await self.db.execute(
            select(Post).where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        
        if post:
            post.view_count += 1
            await self.db.flush()
            return True
        return False
    
    async def increment_like_count(self, post_id: int, delta: int = 1) -> bool:
        """
        增加/减少帖子点赞数
        
        Args:
            post_id: 帖子 ID
            delta: 变化量（正数增加，负数减少）
        
        Returns:
            bool: 是否成功
        """
        result = await self.db.execute(
            select(Post).where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        
        if post:
            post.like_count = max(0, post.like_count + delta)
            await self.db.flush()
            return True
        return False
    
    async def increment_comment_count(self, post_id: int, delta: int = 1) -> bool:
        """
        增加/减少帖子评论数
        
        Args:
            post_id: 帖子 ID
            delta: 变化量（正数增加，负数减少）
        
        Returns:
            bool: 是否成功
        """
        result = await self.db.execute(
            select(Post).where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        
        if post:
            post.comment_count = max(0, post.comment_count + delta)
            await self.db.flush()
            return True
        return False

