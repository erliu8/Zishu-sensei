"""
通知服务
"""
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.notification import Notification
from app.schemas.notification import NotificationCreate
from app.db.redis import redis_client
from app.services.websocket import manager


class NotificationService:
    """通知服务"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_notification(
        self,
        notification_data: NotificationCreate,
        send_realtime: bool = True
    ) -> Notification:
        """
        创建通知
        
        Args:
            notification_data: 通知数据
            send_realtime: 是否发送实时推送
        
        Returns:
            Notification: 创建的通知
        """
        # 创建通知记录
        notification = Notification(
            user_id=notification_data.user_id,
            type=notification_data.type,
            title=notification_data.title,
            message=notification_data.message,
            data=notification_data.data,
            link=notification_data.link,
        )
        
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)
        
        # 实时推送
        if send_realtime:
            await self._send_realtime_notification(notification)
        
        # 更新未读计数缓存
        await self._increment_unread_count(notification.user_id)
        
        return notification
    
    async def create_batch_notifications(
        self,
        notifications_data: List[NotificationCreate],
        send_realtime: bool = True
    ) -> List[Notification]:
        """
        批量创建通知
        
        Args:
            notifications_data: 通知数据列表
            send_realtime: 是否发送实时推送
        
        Returns:
            List[Notification]: 创建的通知列表
        """
        notifications = []
        user_ids = set()
        
        for notification_data in notifications_data:
            notification = Notification(
                user_id=notification_data.user_id,
                type=notification_data.type,
                title=notification_data.title,
                message=notification_data.message,
                data=notification_data.data,
                link=notification_data.link,
            )
            notifications.append(notification)
            user_ids.add(notification_data.user_id)
        
        self.db.add_all(notifications)
        await self.db.commit()
        
        # 刷新所有通知
        for notification in notifications:
            await self.db.refresh(notification)
        
        # 实时推送
        if send_realtime:
            for notification in notifications:
                await self._send_realtime_notification(notification)
        
        # 更新未读计数缓存
        for user_id in user_ids:
            await self._increment_unread_count(user_id)
        
        return notifications
    
    async def get_user_notifications(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
        unread_only: bool = False
    ) -> List[Notification]:
        """
        获取用户的通知列表
        
        Args:
            user_id: 用户 ID
            skip: 跳过数量
            limit: 返回数量
            unread_only: 是否只返回未读通知
        
        Returns:
            List[Notification]: 通知列表
        """
        query = select(Notification).where(Notification.user_id == user_id)
        
        if unread_only:
            query = query.where(Notification.is_read == False)
        
        query = query.order_by(Notification.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        return list(notifications)
    
    async def get_notification(
        self,
        notification_id: int,
        user_id: Optional[int] = None
    ) -> Optional[Notification]:
        """
        获取单个通知
        
        Args:
            notification_id: 通知 ID
            user_id: 用户 ID（可选，用于权限检查）
        
        Returns:
            Optional[Notification]: 通知对象
        """
        query = select(Notification).where(Notification.id == notification_id)
        
        if user_id is not None:
            query = query.where(Notification.user_id == user_id)
        
        result = await self.db.execute(query)
        notification = result.scalar_one_or_none()
        
        return notification
    
    async def mark_as_read(
        self,
        notification_id: int,
        user_id: int
    ) -> Optional[Notification]:
        """
        标记通知为已读
        
        Args:
            notification_id: 通知 ID
            user_id: 用户 ID
        
        Returns:
            Optional[Notification]: 更新后的通知
        """
        notification = await self.get_notification(notification_id, user_id)
        
        if notification and not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            
            await self.db.commit()
            await self.db.refresh(notification)
            
            # 更新未读计数缓存
            await self._decrement_unread_count(user_id)
        
        return notification
    
    async def mark_all_as_read(self, user_id: int) -> int:
        """
        标记所有通知为已读
        
        Args:
            user_id: 用户 ID
        
        Returns:
            int: 更新的通知数量
        """
        query = select(Notification).where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        )
        
        result = await self.db.execute(query)
        notifications = result.scalars().all()
        
        count = 0
        now = datetime.utcnow()
        
        for notification in notifications:
            notification.is_read = True
            notification.read_at = now
            count += 1
        
        if count > 0:
            await self.db.commit()
            
            # 重置未读计数缓存
            await self._reset_unread_count(user_id)
        
        return count
    
    async def delete_notification(
        self,
        notification_id: int,
        user_id: int
    ) -> bool:
        """
        删除通知
        
        Args:
            notification_id: 通知 ID
            user_id: 用户 ID
        
        Returns:
            bool: 是否删除成功
        """
        notification = await self.get_notification(notification_id, user_id)
        
        if notification:
            was_unread = not notification.is_read
            
            await self.db.delete(notification)
            await self.db.commit()
            
            # 如果是未读通知，更新未读计数
            if was_unread:
                await self._decrement_unread_count(user_id)
            
            return True
        
        return False
    
    async def get_unread_count(self, user_id: int) -> int:
        """
        获取未读通知数量
        
        Args:
            user_id: 用户 ID
        
        Returns:
            int: 未读通知数量
        """
        # 先尝试从缓存获取
        cache_key = f"notification:unread:{user_id}"
        cached_count = await redis_client.get(cache_key)
        
        if cached_count is not None:
            return int(cached_count)
        
        # 从数据库查询
        query = select(func.count()).select_from(Notification).where(
            and_(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
        )
        
        result = await self.db.execute(query)
        count = result.scalar() or 0
        
        # 缓存结果
        await redis_client.set(cache_key, count, expire=300)  # 5分钟
        
        return count
    
    async def _send_realtime_notification(self, notification: Notification):
        """
        发送实时通知
        
        Args:
            notification: 通知对象
        """
        try:
            # 检查用户是否在线
            if manager.is_user_online(notification.user_id):
                # 发送 WebSocket 消息
                await manager.send_notification(
                    user_id=notification.user_id,
                    notification_type=notification.type,
                    data={
                        "id": notification.id,
                        "type": notification.type,
                        "title": notification.title,
                        "message": notification.message,
                        "data": notification.data,
                        "link": notification.link,
                        "created_at": notification.created_at.isoformat() if notification.created_at else None,
                    }
                )
        except Exception as e:
            print(f"发送实时通知失败: {e}")
    
    async def _increment_unread_count(self, user_id: int):
        """
        增加未读计数缓存
        
        Args:
            user_id: 用户 ID
        """
        try:
            cache_key = f"notification:unread:{user_id}"
            await redis_client.incr(cache_key)
            await redis_client.expire(cache_key, 300)  # 5分钟
        except Exception as e:
            print(f"增加未读计数失败: {e}")
    
    async def _decrement_unread_count(self, user_id: int):
        """
        减少未读计数缓存
        
        Args:
            user_id: 用户 ID
        """
        try:
            cache_key = f"notification:unread:{user_id}"
            count = await redis_client.get(cache_key)
            
            if count is not None and int(count) > 0:
                await redis_client.decr(cache_key)
                await redis_client.expire(cache_key, 300)  # 5分钟
        except Exception as e:
            print(f"减少未读计数失败: {e}")
    
    async def _reset_unread_count(self, user_id: int):
        """
        重置未读计数缓存
        
        Args:
            user_id: 用户 ID
        """
        try:
            cache_key = f"notification:unread:{user_id}"
            await redis_client.set(cache_key, 0, expire=300)  # 5分钟
        except Exception as e:
            print(f"重置未读计数失败: {e}")


# 辅助函数：快速创建通知

async def notify_new_follower(
    db: AsyncSession,
    user_id: int,
    follower_username: str,
    follower_id: int
):
    """
    通知用户有新粉丝
    
    Args:
        db: 数据库会话
        user_id: 被关注用户 ID
        follower_username: 粉丝用户名
        follower_id: 粉丝 ID
    """
    service = NotificationService(db)
    await service.create_notification(
        NotificationCreate(
            user_id=user_id,
            type="new_follower",
            title="新粉丝",
            message=f"{follower_username} 关注了你",
            data={"follower_id": follower_id},
            link=f"/users/{follower_id}"
        )
    )


async def notify_new_like(
    db: AsyncSession,
    user_id: int,
    liker_username: str,
    liker_id: int,
    post_id: int,
    post_title: str
):
    """
    通知用户帖子被点赞
    
    Args:
        db: 数据库会话
        user_id: 帖子作者 ID
        liker_username: 点赞用户名
        liker_id: 点赞用户 ID
        post_id: 帖子 ID
        post_title: 帖子标题
    """
    service = NotificationService(db)
    await service.create_notification(
        NotificationCreate(
            user_id=user_id,
            type="new_like",
            title="新点赞",
            message=f"{liker_username} 赞了你的帖子：{post_title}",
            data={"liker_id": liker_id, "post_id": post_id},
            link=f"/posts/{post_id}"
        )
    )


async def notify_new_comment(
    db: AsyncSession,
    user_id: int,
    commenter_username: str,
    commenter_id: int,
    post_id: int,
    post_title: str,
    comment_preview: str
):
    """
    通知用户帖子有新评论
    
    Args:
        db: 数据库会话
        user_id: 帖子作者 ID
        commenter_username: 评论用户名
        commenter_id: 评论用户 ID
        post_id: 帖子 ID
        post_title: 帖子标题
        comment_preview: 评论预览
    """
    service = NotificationService(db)
    await service.create_notification(
        NotificationCreate(
            user_id=user_id,
            type="new_comment",
            title="新评论",
            message=f"{commenter_username} 评论了你的帖子：{comment_preview[:50]}",
            data={
                "commenter_id": commenter_id,
                "post_id": post_id,
                "post_title": post_title
            },
            link=f"/posts/{post_id}"
        )
    )


async def notify_comment_reply(
    db: AsyncSession,
    user_id: int,
    replier_username: str,
    replier_id: int,
    comment_id: int,
    post_id: int,
    reply_preview: str
):
    """
    通知用户评论被回复
    
    Args:
        db: 数据库会话
        user_id: 原评论作者 ID
        replier_username: 回复用户名
        replier_id: 回复用户 ID
        comment_id: 原评论 ID
        post_id: 帖子 ID
        reply_preview: 回复预览
    """
    service = NotificationService(db)
    await service.create_notification(
        NotificationCreate(
            user_id=user_id,
            type="comment_reply",
            title="新回复",
            message=f"{replier_username} 回复了你的评论：{reply_preview[:50]}",
            data={
                "replier_id": replier_id,
                "comment_id": comment_id,
                "post_id": post_id
            },
            link=f"/posts/{post_id}#comment-{comment_id}"
        )
    )


async def notify_mention(
    db: AsyncSession,
    user_id: int,
    mentioner_username: str,
    mentioner_id: int,
    context_type: str,  # "post" or "comment"
    context_id: int,
    content_preview: str
):
    """
    通知用户被提及
    
    Args:
        db: 数据库会话
        user_id: 被提及用户 ID
        mentioner_username: 提及用户名
        mentioner_id: 提及用户 ID
        context_type: 上下文类型（帖子或评论）
        context_id: 上下文 ID
        content_preview: 内容预览
    """
    service = NotificationService(db)
    await service.create_notification(
        NotificationCreate(
            user_id=user_id,
            type="mention",
            title="提及",
            message=f"{mentioner_username} 在{context_type}中提到了你：{content_preview[:50]}",
            data={
                "mentioner_id": mentioner_id,
                "context_type": context_type,
                "context_id": context_id
            },
            link=f"/{context_type}s/{context_id}"
        )
    )

