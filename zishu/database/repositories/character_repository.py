"""
角色数据访问层

提供角色相关的数据库操作
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ...models.character import (
    Character,
    CharacterType,
)
from ..base import BaseRepository


class CharacterRepository(BaseRepository):
    """角色仓储类"""

    def __init__(self):
        super().__init__(Character)

    async def get_by_slug(
        self, session: AsyncSession, author_id: str, slug: str
    ) -> Optional[Character]:
        """根据作者和slug获取角色"""
        query = (
            self.query()
            .where(Character.author_id == author_id, Character.slug == slug)
            .filter_not_deleted()
        )
        result = await session.execute(query.build())
        return result.scalar_one_or_none()

    async def get_with_full_config(
        self, session: AsyncSession, character_id: str
    ) -> Optional[Character]:
        """获取角色完整配置"""
        query = (
            select(Character)
            .where(Character.id == character_id, Character.is_deleted.is_(False))
            .options(
                selectinload(Character.personality),
                selectinload(Character.expressions),
                selectinload(Character.voices),
                selectinload(Character.models),
            )
        )
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def get_public_characters(
        self,
        session: AsyncSession,
        skip: int = 0,
        limit: int = 20,
    ) -> List[Character]:
        """获取公开角色列表"""
        query = (
            self.query()
            .where(Character.is_public.is_(True))
            .filter_not_deleted()
            .order_by(Character.usage_count.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def get_official_characters(
        self, session: AsyncSession, limit: int = 10
    ) -> List[Character]:
        """获取官方角色"""
        query = (
            self.query()
            .where(Character.character_type == CharacterType.OFFICIAL)
            .filter_not_deleted()
            .order_by(Character.created_at.asc())
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def increment_usage_count(
        self, session: AsyncSession, character_id: str
    ) -> None:
        """增加使用计数"""
        character = await self.get_by_id(session, character_id)
        if character:
            character.usage_count += 1
            await session.flush()

