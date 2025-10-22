"""
社区数据访问层

提供社区功能相关的数据库操作
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.community import Post, Comment
from ..base import BaseRepository


class CommunityRepository(BaseRepository):
    """社区仓储类"""

    def __init__(self):
        super().__init__(Post)

    async def get_posts(
        self,
        session: AsyncSession,
        skip: int = 0,
        limit: int = 20,
        category: Optional[str] = None,
    ) -> List[Post]:
        """获取帖子列表"""
        query = self.query().filter_not_deleted()

        if category:
            query = query.where(Post.category == category)

        query = query.order_by(Post.created_at.desc()).offset(skip).limit(limit)

        result = await session.execute(query.build())
        return list(result.scalars().all())

