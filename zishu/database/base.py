# zishu/database/base.py

"""
数据库基础模型类
提供通用的数据库操作、审计功能、软删除等
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Type, TypeVar
from enum import Enum
import json

from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Integer,
    func,
    select,
    delete,
    and_,
    or_,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase
from sqlalchemy.sql import Select
from pydantic import BaseModel, ConfigDict

from ..utils.logger import setup_logger

# 类型变量
ModelType = TypeVar("ModelType", bound="BaseModel")
DatabaseModelType = TypeVar("DatabaseModelType", bound="DatabaseBaseModel")

logger = setup_logger(__name__)


class RecordStatus(str, Enum):
    """记录状态枚举"""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DELETED = "deleted"
    ARCHIVED = "archived"


class AuditAction(str, Enum):
    """审计操作枚举"""

    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    RESTORE = "restore"


# SQLAlchemy 2.0 声明式基类
class Base(DeclarativeBase):
    """SQLAlchemy 2.0 声明式基类"""

    pass


# 混入类定义
class TimestampMixin:
    """时间戳混入类"""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="创建时间",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="更新时间",
    )


class SoftDeleteMixin:
    """软删除混入类"""

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="删除时间"
    )

    is_deleted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已删除"
    )


class StatusMixin:
    """状态混入类"""

    status: Mapped[RecordStatus] = mapped_column(
        String(20), default=RecordStatus.ACTIVE, nullable=False, comment="记录状态"
    )


class AuditMixin:
    """审计混入类"""

    created_by: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="创建者"
    )

    updated_by: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="更新者"
    )

    version: Mapped[int] = mapped_column(
        Integer, default=1, nullable=False, comment="版本号"
    )


class MetadataMixin:
    """元数据混入类"""

    metadata_: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        "metadata", JSONB, nullable=True, comment="元数据"  # 数据库列名
    )

    tags: Mapped[Optional[List[str]]] = mapped_column(
        JSONB, nullable=True, comment="标签"
    )


class DatabaseBaseModel(Base, TimestampMixin, SoftDeleteMixin, StatusMixin, AuditMixin):
    """数据库基础模型类"""

    __abstract__ = True

    # 主键使用UUID
    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        comment="主键ID",
    )

    @declared_attr
    @classmethod
    def __tablename__(cls) -> str:
        """自动生成表名"""
        # 将类名从驼峰转换为下划线形式
        import re

        name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", cls.__name__)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", name).lower()

    def __init__(self, **kwargs):
        """初始化模型"""
        # 自动设置创建时间和更新时间
        now = datetime.now(timezone.utc)
        if "created_at" not in kwargs:
            kwargs["created_at"] = now
        if "updated_at" not in kwargs:
            kwargs["updated_at"] = now

        # 设置默认状态
        if "status" not in kwargs:
            kwargs["status"] = RecordStatus.ACTIVE

        # 设置版本号
        if "version" not in kwargs:
            kwargs["version"] = 1

        super().__init__(**kwargs)

    def to_dict(
        self, exclude_none: bool = True, exclude_deleted: bool = True
    ) -> Dict[str, Any]:
        """转换为字典"""
        result = {}

        for column in self.__table__.columns:
            value = getattr(self, column.name)

            # 排除None值
            if exclude_none and value is None:
                continue

            # 排除软删除字段
            if (
                exclude_deleted
                and column.name in ("deleted_at", "is_deleted")
                and not value
            ):
                continue

            # 处理特殊类型
            if isinstance(value, datetime):
                result[column.name] = value.isoformat()
            elif isinstance(value, Enum):
                result[column.name] = value.value
            else:
                result[column.name] = value

        return result

    def to_json(self, **kwargs) -> str:
        """转换为JSON字符串"""
        return json.dumps(self.to_dict(**kwargs), ensure_ascii=False, default=str)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DatabaseBaseModel":
        """从字典创建实例"""
        # 过滤掉不存在的字段
        valid_fields = {c.name for c in cls.__table__.columns}
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}

        return cls(**filtered_data)

    def update_from_dict(
        self, data: Dict[str, Any], exclude_fields: Optional[List[str]] = None
    ) -> None:
        """从字典更新字段"""
        exclude_fields = exclude_fields or ["id", "created_at"]

        for key, value in data.items():
            if key not in exclude_fields and hasattr(self, key):
                setattr(self, key, value)

        # 自动更新时间戳和版本
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1

    def soft_delete(self, deleted_by: Optional[str] = None) -> None:
        """软删除"""
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        self.status = RecordStatus.DELETED
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1

        if deleted_by:
            self.updated_by = deleted_by

    def restore(self, restored_by: Optional[str] = None) -> None:
        """恢复软删除"""
        self.is_deleted = False
        self.deleted_at = None
        self.status = RecordStatus.ACTIVE
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1

        if restored_by:
            self.updated_by = restored_by

    def archive(self, archived_by: Optional[str] = None) -> None:
        """归档记录"""
        self.status = RecordStatus.ARCHIVED
        self.updated_at = datetime.now(timezone.utc)
        self.version += 1

        if archived_by:
            self.updated_by = archived_by

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id}, status={self.status})>"


class QueryBuilder:
    """查询构建器"""

    def __init__(self, model_class: Type[DatabaseBaseModel]):
        self.model_class = model_class
        self.query = select(model_class)
        self._where_conditions = []
        self._order_by = []
        self._limit_value = None
        self._offset_value = None

    def where(self, *conditions) -> "QueryBuilder":
        """添加WHERE条件"""
        self._where_conditions.extend(conditions)
        return self

    def filter_active(self) -> "QueryBuilder":
        """过滤活跃记录"""
        return self.where(
            self.model_class.is_deleted.is_(False),
            self.model_class.status == RecordStatus.ACTIVE,
        )

    def filter_not_deleted(self) -> "QueryBuilder":
        """过滤未删除记录"""
        return self.where(self.model_class.is_deleted.is_(False))

    def filter_by_status(self, status: RecordStatus) -> "QueryBuilder":
        """按状态过滤"""
        return self.where(self.model_class.status == status)

    def filter_by_created_date(
        self, start_date: datetime, end_date: Optional[datetime] = None
    ) -> "QueryBuilder":
        """按创建时间过滤"""
        conditions = [self.model_class.created_at >= start_date]
        if end_date:
            conditions.append(self.model_class.created_at <= end_date)
        return self.where(*conditions)

    def search(self, search_term: str, search_fields: List[str]) -> "QueryBuilder":
        """搜索功能"""
        if not search_term or not search_fields:
            return self

        search_conditions = []
        for field_name in search_fields:
            if hasattr(self.model_class, field_name):
                field = getattr(self.model_class, field_name)
                search_conditions.append(field.ilike(f"%{search_term}%"))

        if search_conditions:
            self.where(or_(*search_conditions))

        return self

    def order_by(self, *columns) -> "QueryBuilder":
        """排序"""
        self._order_by.extend(columns)
        return self

    def order_by_created_desc(self) -> "QueryBuilder":
        """按创建时间倒序"""
        return self.order_by(self.model_class.created_at.desc())

    def order_by_updated_desc(self) -> "QueryBuilder":
        """按更新时间倒序"""
        return self.order_by(self.model_class.updated_at.desc())

    def limit(self, limit: int) -> "QueryBuilder":
        """限制数量"""
        self._limit_value = limit
        return self

    def offset(self, offset: int) -> "QueryBuilder":
        """偏移量"""
        self._offset_value = offset
        return self

    def paginate(self, page: int, per_page: int) -> "QueryBuilder":
        """分页"""
        offset = (page - 1) * per_page
        return self.offset(offset).limit(per_page)

    def build(self) -> Select:
        """构建查询"""
        query = self.query

        # 应用WHERE条件
        if self._where_conditions:
            query = query.where(and_(*self._where_conditions))

        # 应用排序
        if self._order_by:
            query = query.order_by(*self._order_by)

        # 应用分页
        if self._offset_value is not None:
            query = query.offset(self._offset_value)
        if self._limit_value is not None:
            query = query.limit(self._limit_value)

        return query


class BaseRepository:
    """基础仓储类"""

    def __init__(self, model_class: Type[DatabaseBaseModel]):
        self.model_class = model_class
        self.logger = setup_logger(f"{__name__}.{model_class.__name__}Repository")

    def query(self) -> QueryBuilder:
        """创建查询构建器"""
        return QueryBuilder(self.model_class)

    async def create(
        self, session: AsyncSession, obj_data: Dict[str, Any], **kwargs
    ) -> DatabaseBaseModel:
        """创建记录"""
        try:
            # 合并数据
            data = {**obj_data, **kwargs}

            # 创建实例
            db_obj = self.model_class(**data)

            session.add(db_obj)
            await session.flush()  # 获取ID但不提交
            await session.refresh(db_obj)

            self.logger.info(
                f"Created {self.model_class.__name__} with id: {db_obj.id}"
            )
            return db_obj

        except Exception as e:
            self.logger.error(f"Failed to create {self.model_class.__name__}: {e}")
            raise

    async def get_by_id(
        self, session: AsyncSession, obj_id: str, include_deleted: bool = False
    ) -> Optional[DatabaseBaseModel]:
        """根据ID获取记录"""
        try:
            query = self.query().where(self.model_class.id == obj_id)

            if not include_deleted:
                query = query.filter_not_deleted()

            result = await session.execute(query.build())
            return result.scalar_one_or_none()

        except Exception as e:
            self.logger.error(
                f"Failed to get {self.model_class.__name__} by id {obj_id}: {e}"
            )
            raise

    async def get_all(
        self,
        session: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        include_deleted: bool = False,
        **filters,
    ) -> List[DatabaseBaseModel]:
        """获取所有记录"""
        try:
            query = self.query()

            if not include_deleted:
                query = query.filter_not_deleted()

            # 应用过滤条件
            for key, value in filters.items():
                if hasattr(self.model_class, key):
                    query = query.where(getattr(self.model_class, key) == value)

            query = query.order_by_created_desc().offset(skip).limit(limit)

            result = await session.execute(query.build())
            return result.scalars().all()

        except Exception as e:
            self.logger.error(f"Failed to get all {self.model_class.__name__}: {e}")
            raise

    async def update(
        self,
        session: AsyncSession,
        obj_id: str,
        update_data: Dict[str, Any],
        updated_by: Optional[str] = None,
    ) -> Optional[DatabaseBaseModel]:
        """更新记录"""
        try:
            db_obj = await self.get_by_id(session, obj_id)
            if not db_obj:
                return None

            # 更新数据
            update_data = update_data.copy()
            if updated_by:
                update_data["updated_by"] = updated_by

            db_obj.update_from_dict(update_data)

            await session.flush()
            await session.refresh(db_obj)

            self.logger.info(f"Updated {self.model_class.__name__} with id: {obj_id}")
            return db_obj

        except Exception as e:
            self.logger.error(
                f"Failed to update {self.model_class.__name__} {obj_id}: {e}"
            )
            raise

    async def soft_delete(
        self, session: AsyncSession, obj_id: str, deleted_by: Optional[str] = None
    ) -> bool:
        """软删除记录"""
        try:
            db_obj = await self.get_by_id(session, obj_id)
            if not db_obj:
                return False

            db_obj.soft_delete(deleted_by)

            await session.flush()

            self.logger.info(
                f"Soft deleted {self.model_class.__name__} with id: {obj_id}"
            )
            return True

        except Exception as e:
            self.logger.error(
                f"Failed to soft delete {self.model_class.__name__} {obj_id}: {e}"
            )
            raise

    async def hard_delete(self, session: AsyncSession, obj_id: str) -> bool:
        """硬删除记录"""
        try:
            query = delete(self.model_class).where(self.model_class.id == obj_id)
            result = await session.execute(query)

            success = result.rowcount > 0
            if success:
                self.logger.info(
                    f"Hard deleted {self.model_class.__name__} with id: {obj_id}"
                )

            return success

        except Exception as e:
            self.logger.error(
                f"Failed to hard delete {self.model_class.__name__} {obj_id}: {e}"
            )
            raise

    async def restore(
        self, session: AsyncSession, obj_id: str, restored_by: Optional[str] = None
    ) -> bool:
        """恢复软删除记录"""
        try:
            # 包含已删除记录
            db_obj = await self.get_by_id(session, obj_id, include_deleted=True)
            if not db_obj or not db_obj.is_deleted:
                return False

            db_obj.restore(restored_by)

            await session.flush()

            self.logger.info(f"Restored {self.model_class.__name__} with id: {obj_id}")
            return True

        except Exception as e:
            self.logger.error(
                f"Failed to restore {self.model_class.__name__} {obj_id}: {e}"
            )
            raise

    async def count(
        self, session: AsyncSession, include_deleted: bool = False, **filters
    ) -> int:
        """统计记录数"""
        try:
            query = select(func.count(self.model_class.id))

            conditions = []
            if not include_deleted:
                conditions.append(self.model_class.is_deleted.is_(False))

            # 应用过滤条件
            for key, value in filters.items():
                if hasattr(self.model_class, key):
                    conditions.append(getattr(self.model_class, key) == value)

            if conditions:
                query = query.where(and_(*conditions))

            result = await session.execute(query)
            return result.scalar()

        except Exception as e:
            self.logger.error(f"Failed to count {self.model_class.__name__}: {e}")
            raise

    async def exists(
        self, session: AsyncSession, obj_id: str, include_deleted: bool = False
    ) -> bool:
        """检查记录是否存在"""
        try:
            obj = await self.get_by_id(session, obj_id, include_deleted)
            return obj is not None

        except Exception as e:
            self.logger.error(
                f"Failed to check if {self.model_class.__name__} {obj_id} exists: {e}"
            )
            raise


# Pydantic 基础模型用于API序列化
class BaseSchema(BaseModel):
    """基础Pydantic模型"""

    model_config = ConfigDict(
        from_attributes=True,
        use_enum_values=True,
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None,
        },
    )


class TimestampSchema(BaseSchema):
    """时间戳模式"""

    created_at: datetime
    updated_at: datetime


class BaseResponseSchema(TimestampSchema):
    """基础响应模式"""

    id: str
    status: RecordStatus
    version: int


class BaseCreateSchema(BaseSchema):
    """基础创建模式"""

    pass


class BaseUpdateSchema(BaseSchema):
    """基础更新模式"""

    pass
