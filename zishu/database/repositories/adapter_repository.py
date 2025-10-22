"""
适配器数据访问层

提供适配器相关的数据库操作
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from ...models.adapter import (
    Adapter,
    AdapterVersion,
    AdapterCategory,
    AdapterDownload,
    AdapterRating,
    AdapterStatus,
    AdapterVisibility,
)
from ..base import BaseRepository


class AdapterRepository(BaseRepository):
    """适配器仓储类"""

    def __init__(self):
        super().__init__(Adapter)

    async def get_by_slug(
        self, session: AsyncSession, author_id: str, slug: str
    ) -> Optional[Adapter]:
        """根据作者和slug获取适配器"""
        query = (
            self.query()
            .where(Adapter.author_id == author_id, Adapter.slug == slug)
            .filter_not_deleted()
        )
        result = await session.execute(query.build())
        return result.scalar_one_or_none()

    async def get_with_versions(
        self, session: AsyncSession, adapter_id: str
    ) -> Optional[Adapter]:
        """获取适配器及其所有版本"""
        query = (
            select(Adapter)
            .where(Adapter.id == adapter_id, Adapter.is_deleted.is_(False))
            .options(selectinload(Adapter.versions))
        )
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def get_public_adapters(
        self,
        session: AsyncSession,
        skip: int = 0,
        limit: int = 20,
        category_id: Optional[str] = None,
    ) -> List[Adapter]:
        """获取公开的适配器列表"""
        query = (
            self.query()
            .where(
                Adapter.visibility == AdapterVisibility.PUBLIC,
                Adapter.adapter_status == AdapterStatus.ACTIVE,
            )
            .filter_not_deleted()
        )

        if category_id:
            query = query.where(Adapter.primary_category_id == category_id)

        query = query.order_by(Adapter.download_count.desc()).offset(skip).limit(limit)

        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def search_adapters(
        self,
        session: AsyncSession,
        search_term: str,
        skip: int = 0,
        limit: int = 20,
    ) -> List[Adapter]:
        """搜索适配器"""
        query = (
            self.query()
            .search(search_term, ["name", "description"])
            .where(Adapter.visibility == AdapterVisibility.PUBLIC)
            .filter_not_deleted()
            .order_by(Adapter.download_count.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def get_featured_adapters(
        self, session: AsyncSession, limit: int = 10
    ) -> List[Adapter]:
        """获取推荐适配器"""
        query = (
            self.query()
            .where(Adapter.is_featured.is_(True))
            .filter_not_deleted()
            .order_by(Adapter.created_at.desc())
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def increment_download_count(
        self, session: AsyncSession, adapter_id: str
    ) -> None:
        """增加下载计数"""
        adapter = await self.get_by_id(session, adapter_id)
        if adapter:
            adapter.download_count += 1
            await session.flush()

    async def update_rating(
        self, session: AsyncSession, adapter_id: str
    ) -> None:
        """更新适配器评分"""
        # 计算平均评分
        result = await session.execute(
            select(func.avg(AdapterRating.rating), func.count(AdapterRating.id)).where(
                AdapterRating.adapter_id == adapter_id
            )
        )
        avg_rating, count = result.one()

        adapter = await self.get_by_id(session, adapter_id)
        if adapter:
            adapter.rating_average = avg_rating
            adapter.rating_count = count or 0
            await session.flush()


class AdapterVersionRepository(BaseRepository):
    """适配器版本仓储类"""

    def __init__(self):
        super().__init__(AdapterVersion)

    async def get_latest_version(
        self, session: AsyncSession, adapter_id: str
    ) -> Optional[AdapterVersion]:
        """获取最新版本"""
        query = (
            self.query()
            .where(AdapterVersion.adapter_id == adapter_id)
            .filter_not_deleted()
            .order_by(AdapterVersion.created_at.desc())
            .limit(1)
        )
        result = await session.execute(query.build())
        return result.scalar_one_or_none()

    async def get_by_version(
        self, session: AsyncSession, adapter_id: str, version: str
    ) -> Optional[AdapterVersion]:
        """根据版本号获取"""
        query = (
            self.query()
            .where(
                AdapterVersion.adapter_id == adapter_id,
                AdapterVersion.version == version,
            )
            .filter_not_deleted()
        )
        result = await session.execute(query.build())
        return result.scalar_one_or_none()

