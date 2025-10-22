"""
通用 Schema
"""
from typing import Generic, TypeVar, List
from pydantic import BaseModel, Field


DataT = TypeVar("DataT")


class Response(BaseModel, Generic[DataT]):
    """通用响应模型"""
    code: int = Field(default=200, description="状态码")
    message: str = Field(default="success", description="消息")
    data: DataT = Field(description="数据")


class PaginationParams(BaseModel):
    """分页参数"""
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量")
    
    @property
    def skip(self) -> int:
        """计算跳过的记录数"""
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        """获取限制数量"""
        return self.page_size


class PaginatedResponse(BaseModel, Generic[DataT]):
    """分页响应模型"""
    items: List[DataT] = Field(description="数据列表")
    total: int = Field(description="总数")
    page: int = Field(description="当前页码")
    page_size: int = Field(description="每页数量")
    pages: int = Field(description="总页数")
    
    @classmethod
    def create(
        cls,
        items: List[DataT],
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedResponse[DataT]":
        """创建分页响应"""
        pages = (total + page_size - 1) // page_size
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

