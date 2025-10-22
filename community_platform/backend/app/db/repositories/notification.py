"""
通知 Repository
"""
from typing import List
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.db.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    """通知 Repository"""
    
    def __init__(self, db: AsyncSession):
        super().__init__(Notification, db)
    
    async def get_user_notifications(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
        unread_only: bool = False
    ) -> List[Notification]:
        """
        获取用户通知列表
        
        Args:
            user_id: 用户 ID
            skip: 跳过的记录数
            limit: 限制返回的记录数
            unread_only: 是否只返回未读通知
        
        Returns:
            List[Notification]: 通知列表
        """
        query = select(Notification).where(Notification.user_id == user_id)
        
        if unread_only:
            query = query.where(Notification.is_read == False)
        
        query = query.order_by(desc(Notification.created_at)).offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_unread_count(self, user_id: int) -> int:
        """
        获取未读通知数
        
        Args:
            user_id: 用户 ID
        
        Returns:
            int: 未读通知数
        """
        result = await self.db.execute(
            select(func.count()).select_from(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
        )
        return result.scalar_one()
    
    async def mark_as_read(self, notification_id: int) -> bool:
        """
        标记通知为已读
        
        Args:
            notification_id: 通知 ID
        
        Returns:
            bool: 是否成功
        """
        notification = await self.get_by_id(notification_id)
        if notification:
            await self.update(notification_id, {"is_read": True})
            return True
        return False
    
    async def mark_all_as_read(self, user_id: int) -> bool:
        """
        标记所有通知为已读
        
        Args:
            user_id: 用户 ID
        
        Returns:
            bool: 是否成功
        """
        from sqlalchemy import update
        await self.db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True)
        )
        await self.db.flush()
        return True

