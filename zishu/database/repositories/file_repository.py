"""
文件数据访问层

提供文件管理相关的数据库操作
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.file import File
from ..base import BaseRepository


class FileRepository(BaseRepository):
    """文件仓储类"""

    def __init__(self):
        super().__init__(File)

    async def get_user_files(
        self,
        session: AsyncSession,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> List[File]:
        """获取用户的文件列表"""
        query = (
            self.query()
            .where(File.user_id == user_id)
            .filter_not_deleted()
            .order_by(File.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

