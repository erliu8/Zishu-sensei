"""
分页工具函数
"""
from typing import TypeVar, List, Optional, Any, Callable
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.selectable import Select

from app.schemas.common import PaginatedResponse, PaginationParams


T = TypeVar("T")


async def paginate(
    db: AsyncSession,
    query: Select,
    page: int = 1,
    page_size: int = 20,
    **kwargs
) -> PaginatedResponse[Any]:
    """
    通用分页函数
    
    Args:
        db: 数据库会话
        query: SQLAlchemy 查询对象
        page: 页码（从1开始）
        page_size: 每页数量
        **kwargs: 其他参数
    
    Returns:
        PaginatedResponse: 分页响应对象
    """
    # 计算偏移量
    offset = (page - 1) * page_size
    
    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # 获取分页数据
    paginated_query = query.offset(offset).limit(page_size)
    result = await db.execute(paginated_query)
    items = result.scalars().all()
    
    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


async def paginate_with_transform(
    db: AsyncSession,
    query: Select,
    transform: Callable[[Any], T],
    page: int = 1,
    page_size: int = 20,
) -> PaginatedResponse[T]:
    """
    带转换函数的分页
    
    Args:
        db: 数据库会话
        query: SQLAlchemy 查询对象
        transform: 转换函数（将数据库模型转换为 Schema）
        page: 页码
        page_size: 每页数量
    
    Returns:
        PaginatedResponse: 分页响应对象
    """
    # 计算偏移量
    offset = (page - 1) * page_size
    
    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # 获取分页数据
    paginated_query = query.offset(offset).limit(page_size)
    result = await db.execute(paginated_query)
    items = result.scalars().all()
    
    # 转换数据
    transformed_items = [transform(item) for item in items]
    
    return PaginatedResponse.create(
        items=transformed_items,
        total=total,
        page=page,
        page_size=page_size,
    )


def get_pagination_params(
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    default_page: int = 1,
    default_page_size: int = 20,
    max_page_size: int = 100,
) -> PaginationParams:
    """
    获取并验证分页参数
    
    Args:
        page: 页码
        page_size: 每页数量
        default_page: 默认页码
        default_page_size: 默认每页数量
        max_page_size: 最大每页数量
    
    Returns:
        PaginationParams: 分页参数对象
    """
    # 使用默认值
    if page is None or page < 1:
        page = default_page
    
    if page_size is None or page_size < 1:
        page_size = default_page_size
    
    # 限制最大值
    if page_size > max_page_size:
        page_size = max_page_size
    
    return PaginationParams(page=page, page_size=page_size)


def paginate_list(
    items: List[T],
    page: int = 1,
    page_size: int = 20,
) -> PaginatedResponse[T]:
    """
    对列表进行分页
    
    Args:
        items: 数据列表
        page: 页码
        page_size: 每页数量
    
    Returns:
        PaginatedResponse: 分页响应对象
    """
    total = len(items)
    offset = (page - 1) * page_size
    paginated_items = items[offset:offset + page_size]
    
    return PaginatedResponse.create(
        items=paginated_items,
        total=total,
        page=page,
        page_size=page_size,
    )


class Paginator:
    """分页器类"""
    
    def __init__(
        self,
        page: int = 1,
        page_size: int = 20,
        max_page_size: int = 100,
    ):
        """
        初始化分页器
        
        Args:
            page: 页码
            page_size: 每页数量
            max_page_size: 最大每页数量
        """
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), max_page_size)
    
    @property
    def offset(self) -> int:
        """获取偏移量"""
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        """获取限制数量"""
        return self.page_size
    
    async def paginate(
        self,
        db: AsyncSession,
        query: Select,
    ) -> PaginatedResponse[Any]:
        """
        执行分页查询
        
        Args:
            db: 数据库会话
            query: SQLAlchemy 查询对象
        
        Returns:
            PaginatedResponse: 分页响应对象
        """
        return await paginate(
            db=db,
            query=query,
            page=self.page,
            page_size=self.page_size,
        )
    
    def paginate_list(self, items: List[T]) -> PaginatedResponse[T]:
        """
        对列表进行分页
        
        Args:
            items: 数据列表
        
        Returns:
            PaginatedResponse: 分页响应对象
        """
        return paginate_list(
            items=items,
            page=self.page,
            page_size=self.page_size,
        )

