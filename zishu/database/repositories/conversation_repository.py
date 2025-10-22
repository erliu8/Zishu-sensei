"""
对话数据访问层

提供对话相关的数据库操作
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from ...models.conversation import (
    Conversation,
    Message,
    ConversationStatus,
    MessageRole,
)
from ..base import BaseRepository


class ConversationRepository(BaseRepository):
    """对话仓储类"""

    def __init__(self):
        super().__init__(Conversation)

    async def get_user_conversations(
        self,
        session: AsyncSession,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> List[Conversation]:
        """获取用户的对话列表"""
        query = (
            self.query()
            .where(Conversation.user_id == user_id)
            .filter_not_deleted()
            .order_by(Conversation.last_message_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def get_with_messages(
        self,
        session: AsyncSession,
        conversation_id: str,
        message_limit: int = 50,
    ) -> Optional[Conversation]:
        """获取对话及其消息"""
        query = (
            select(Conversation)
            .where(
                Conversation.id == conversation_id,
                Conversation.is_deleted.is_(False),
            )
            .options(selectinload(Conversation.messages).limit(message_limit))
        )
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def increment_message_count(
        self, session: AsyncSession, conversation_id: str
    ) -> None:
        """增加消息计数"""
        conversation = await self.get_by_id(session, conversation_id)
        if conversation:
            conversation.message_count += 1
            await session.flush()


class MessageRepository(BaseRepository):
    """消息仓储类"""

    def __init__(self):
        super().__init__(Message)

    async def get_conversation_messages(
        self,
        session: AsyncSession,
        conversation_id: str,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Message]:
        """获取对话的消息列表"""
        query = (
            self.query()
            .where(Message.conversation_id == conversation_id)
            .filter_not_deleted()
            .order_by(Message.sequence.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def get_last_messages(
        self,
        session: AsyncSession,
        conversation_id: str,
        count: int = 10,
    ) -> List[Message]:
        """获取最后N条消息"""
        query = (
            self.query()
            .where(Message.conversation_id == conversation_id)
            .filter_not_deleted()
            .order_by(Message.sequence.desc())
            .limit(count)
        )
        result = await session.execute(query.build())
        messages = list(result.scalars().all())
        return list(reversed(messages))  # 返回正序

    async def get_next_sequence(
        self, session: AsyncSession, conversation_id: str
    ) -> int:
        """获取下一个消息序号"""
        result = await session.execute(
            select(func.max(Message.sequence)).where(
                Message.conversation_id == conversation_id
            )
        )
        max_seq = result.scalar()
        return (max_seq or 0) + 1

