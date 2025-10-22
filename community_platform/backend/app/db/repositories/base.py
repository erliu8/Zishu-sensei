"""
基础 Repository
"""
from typing import Generic, TypeVar, Type, Optional, List, Any, Dict
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """基础 Repository 类"""
    
    def __init__(self, model: Type[ModelType], db: AsyncSession):
        self.model = model
        self.db = db
    
    async def get_by_id(self, id: int) -> Optional[ModelType]:
        """
        根据 ID 获取记录
        
        Args:
            id: 记录 ID
        
        Returns:
            Optional[ModelType]: 记录对象，不存在返回 None
        """
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()
    
    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        **filters
    ) -> List[ModelType]:
        """
        获取多条记录
        
        Args:
            skip: 跳过的记录数
            limit: 限制返回的记录数
            **filters: 过滤条件
        
        Returns:
            List[ModelType]: 记录列表
        """
        query = select(self.model)
        
        # 应用过滤条件
        for key, value in filters.items():
            if hasattr(self.model, key):
                query = query.where(getattr(self.model, key) == value)
        
        query = query.offset(skip).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create(self, obj_in: Dict[str, Any]) -> ModelType:
        """
        创建记录
        
        Args:
            obj_in: 创建数据
        
        Returns:
            ModelType: 创建的记录
        """
        db_obj = self.model(**obj_in)
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj
    
    async def update(
        self,
        obj_or_id,
        obj_in: Dict[str, Any]
    ) -> Optional[ModelType]:
        """
        更新记录
        
        Args:
            obj_or_id: 记录对象或 ID
            obj_in: 更新数据
        
        Returns:
            Optional[ModelType]: 更新后的记录，不存在返回 None
        """
        # 获取 ID（支持传递对象或 ID）
        if isinstance(obj_or_id, int):
            record_id = obj_or_id
        else:
            record_id = obj_or_id.id
        
        # 过滤掉 None 值
        update_data = {k: v for k, v in obj_in.items() if v is not None}
        
        if not update_data:
            return await self.get_by_id(record_id)
        
        await self.db.execute(
            update(self.model)
            .where(self.model.id == record_id)
            .values(**update_data)
        )
        await self.db.flush()
        
        return await self.get_by_id(record_id)
    
    async def delete(self, obj_or_id) -> bool:
        """
        删除记录
        
        Args:
            obj_or_id: 记录对象或 ID
        
        Returns:
            bool: 是否删除成功
        """
        # 获取 ID（支持传递对象或 ID）
        if isinstance(obj_or_id, int):
            record_id = obj_or_id
        else:
            record_id = obj_or_id.id
        
        result = await self.db.execute(
            delete(self.model).where(self.model.id == record_id)
        )
        await self.db.flush()
        return result.rowcount > 0
    
    async def count(self, **filters) -> int:
        """
        统计记录数
        
        Args:
            **filters: 过滤条件
        
        Returns:
            int: 记录数
        """
        query = select(func.count()).select_from(self.model)
        
        # 应用过滤条件
        for key, value in filters.items():
            if hasattr(self.model, key):
                query = query.where(getattr(self.model, key) == value)
        
        result = await self.db.execute(query)
        return result.scalar_one()
    
    async def exists(self, **filters) -> bool:
        """
        检查记录是否存在
        
        Args:
            **filters: 过滤条件
        
        Returns:
            bool: 是否存在
        """
        count = await self.count(**filters)
        return count > 0

