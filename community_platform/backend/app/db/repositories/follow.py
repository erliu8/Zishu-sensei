"""
关注 Repository
"""
from typing import List, Optional
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.follow import Follow
from app.db.repositories.base import BaseRepository


class FollowRepository(BaseRepository[Follow]):
    """关注 Repository"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Follow, db)
    
    async def get_follow(
        self,
        follower_id: int,
        following_id: int
    ) -> Optional[Follow]:
        """
        获取关注记录
        
        Args:
            follower_id: 关注者 ID
            following_id: 被关注者 ID
        
        Returns:
            Optional[Follow]: 关注对象，不存在返回 None
        """
        result = await self.db.execute(
            select(Follow).where(
                and_(
                    Follow.follower_id == follower_id,
                    Follow.following_id == following_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def is_following(
        self,
        follower_id: int,
        following_id: int
    ) -> bool:
        """
        检查是否已关注
        
        Args:
            follower_id: 关注者 ID
            following_id: 被关注者 ID
        
        Returns:
            bool: 是否已关注
        """
        follow = await self.get_follow(follower_id, following_id)
        return follow is not None
    
    async def follow(
        self,
        follower_id: int,
        following_id: int
    ) -> Follow:
        """
        关注用户
        
        Args:
            follower_id: 关注者 ID
            following_id: 被关注者 ID
        
        Returns:
            Follow: 关注对象
        """
        return await self.create({
            "follower_id": follower_id,
            "following_id": following_id,
        })
    
    async def unfollow(
        self,
        follower_id: int,
        following_id: int
    ) -> bool:
        """
        取消关注
        
        Args:
            follower_id: 关注者 ID
            following_id: 被关注者 ID
        
        Returns:
            bool: 是否成功
        """
        follow = await self.get_follow(follower_id, following_id)
        if follow:
            return await self.delete(follow.id)
        return False
    
    async def get_follower_count(self, user_id: int) -> int:
        """
        获取粉丝数
        
        Args:
            user_id: 用户 ID
        
        Returns:
            int: 粉丝数
        """
        result = await self.db.execute(
            select(func.count()).select_from(Follow)
            .where(Follow.following_id == user_id)
        )
        return result.scalar_one()
    
    async def get_following_count(self, user_id: int) -> int:
        """
        获取关注数
        
        Args:
            user_id: 用户 ID
        
        Returns:
            int: 关注数
        """
        result = await self.db.execute(
            select(func.count()).select_from(Follow)
            .where(Follow.follower_id == user_id)
        )
        return result.scalar_one()
    
    async def get_followers(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> List[int]:
        """
        获取粉丝列表
        
        Args:
            user_id: 用户 ID
            skip: 跳过的记录数
            limit: 限制返回的记录数
        
        Returns:
            List[int]: 粉丝用户 ID 列表
        """
        result = await self.db.execute(
            select(Follow.follower_id)
            .where(Follow.following_id == user_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
    
    async def get_following(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20
    ) -> List[int]:
        """
        获取关注列表
        
        Args:
            user_id: 用户 ID
            skip: 跳过的记录数
            limit: 限制返回的记录数
        
        Returns:
            List[int]: 关注用户 ID 列表
        """
        result = await self.db.execute(
            select(Follow.following_id)
            .where(Follow.follower_id == user_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

