"""
适配器相关 API 端点
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user, get_optional_current_user
from app.core.response import create_response, ApiResponse
from app.models.user import User
from app.schemas.adapter import (
    AdapterCreate,
    AdapterUpdate,
    AdapterInDB,
    AdapterDetail,
    AdapterListItem,
    AdapterListResponse,
    AdapterCategory,
    ReviewCreate,
    ReviewInDB,
    CommentCreate,
    CommentInDB,
    AdapterStats,
)
from app.services.adapter import AdapterService

router = APIRouter()


# ==================== 适配器 CRUD ====================

@router.get("", response_model=ApiResponse[AdapterListResponse])
async def get_adapters(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    category: Optional[AdapterCategory] = Query(None, description="分类筛选"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    tags: Optional[str] = Query(None, description="标签筛选，逗号分隔"),
    sort_by: str = Query("created_at", description="排序字段"),
    order: str = Query("desc", description="排序方向"),
    featured_only: bool = Query(False, description="只显示特色"),
    verified_only: bool = Query(False, description="只显示认证"),
    db: Session = Depends(get_db)
):
    """获取适配器列表"""
    tag_list = tags.split(",") if tags else None
    
    adapters, total = await AdapterService.list_adapters(
        db=db,
        page=page,
        size=size,
        category=category,
        search=search,
        tags=tag_list,
        sort_by=sort_by,
        order=order,
        featured_only=featured_only,
        verified_only=verified_only,
    )
    
    items = [AdapterListItem.model_validate(adapter) for adapter in adapters]
    
    response_data = AdapterListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        has_more=(page * size) < total,
    )
    
    return create_response(data=response_data)


@router.get("/stats", response_model=ApiResponse[AdapterStats])
async def get_adapter_stats(db: Session = Depends(get_db)):
    """获取适配器统计信息"""
    stats = await AdapterService.get_stats(db)
    return create_response(data=stats)


@router.get("/featured", response_model=ApiResponse[List[AdapterListItem]])
async def get_featured_adapters(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """获取特色适配器"""
    adapters, _ = await AdapterService.list_adapters(
        db=db,
        page=1,
        size=limit,
        featured_only=True,
        sort_by="downloads",
        order="desc",
    )
    
    items = [AdapterListItem.model_validate(adapter) for adapter in adapters]
    return create_response(data=items)


@router.get("/trending", response_model=ApiResponse[List[AdapterListItem]])
async def get_trending_adapters(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """获取热门适配器"""
    adapters, _ = await AdapterService.list_adapters(
        db=db,
        page=1,
        size=limit,
        sort_by="downloads",
        order="desc",
    )
    
    items = [AdapterListItem.model_validate(adapter) for adapter in adapters]
    return create_response(data=items)


@router.get("/latest", response_model=ApiResponse[List[AdapterListItem]])
async def get_latest_adapters(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """获取最新适配器"""
    adapters, _ = await AdapterService.list_adapters(
        db=db,
        page=1,
        size=limit,
        sort_by="created_at",
        order="desc",
    )
    
    items = [AdapterListItem.model_validate(adapter) for adapter in adapters]
    return create_response(data=items)


@router.get("/{adapter_id}", response_model=ApiResponse[AdapterDetail])
async def get_adapter(
    adapter_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """获取适配器详情"""
    adapter = await AdapterService.get_adapter(db, adapter_id, user=current_user)
    
    # 转换为详情模型
    adapter_dict = AdapterInDB.model_validate(adapter).model_dump()
    
    # 添加额外信息
    # TODO: 查询评论数、是否收藏等
    adapter_dict["review_count"] = 0
    adapter_dict["comment_count"] = 0
    adapter_dict["is_favorited"] = False
    adapter_dict["is_downloaded"] = False
    
    return create_response(data=AdapterDetail(**adapter_dict))


@router.post("", response_model=ApiResponse[AdapterInDB])
async def create_adapter(
    adapter_data: AdapterCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """创建适配器"""
    adapter = await AdapterService.create_adapter(db, adapter_data, current_user)
    return create_response(data=AdapterInDB.model_validate(adapter))


@router.patch("/{adapter_id}", response_model=ApiResponse[AdapterInDB])
async def update_adapter(
    adapter_id: str,
    adapter_data: AdapterUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新适配器"""
    adapter = await AdapterService.update_adapter(db, adapter_id, adapter_data, current_user)
    return create_response(data=AdapterInDB.model_validate(adapter))


@router.delete("/{adapter_id}")
async def delete_adapter(
    adapter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """删除适配器"""
    await AdapterService.delete_adapter(db, adapter_id, current_user)
    return create_response(message="适配器已删除")


@router.post("/{adapter_id}/publish", response_model=ApiResponse[AdapterInDB])
async def publish_adapter(
    adapter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """发布适配器"""
    adapter = await AdapterService.publish_adapter(db, adapter_id, current_user)
    return create_response(data=AdapterInDB.model_validate(adapter))


# ==================== 下载功能 ====================

@router.get("/{adapter_id}/download")
async def download_adapter(
    adapter_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """下载适配器"""
    # 获取请求信息
    ip_address = request.client.host
    user_agent = request.headers.get("user-agent")
    platform = request.query_params.get("platform")
    
    # 记录下载并获取下载URL
    download_url = await AdapterService.download_adapter(
        db=db,
        adapter_id=adapter_id,
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
        platform=platform,
    )
    
    # 重定向到实际下载URL
    return RedirectResponse(url=download_url, status_code=302)


# ==================== 收藏功能 ====================

@router.post("/{adapter_id}/favorite")
async def favorite_adapter(
    adapter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """收藏适配器"""
    await AdapterService.favorite_adapter(db, adapter_id, current_user)
    return create_response(message="收藏成功")


@router.delete("/{adapter_id}/favorite")
async def unfavorite_adapter(
    adapter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取消收藏适配器"""
    await AdapterService.unfavorite_adapter(db, adapter_id, current_user)
    return create_response(message="已取消收藏")


@router.get("/user/favorites", response_model=ApiResponse[AdapterListResponse])
async def get_user_favorites(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取用户收藏的适配器"""
    adapters, total = await AdapterService.get_user_favorites(db, current_user, page, size)
    
    items = [AdapterListItem.model_validate(adapter) for adapter in adapters]
    
    response_data = AdapterListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        has_more=(page * size) < total,
    )
    
    return create_response(data=response_data)


# ==================== 评价功能 ====================

@router.post("/{adapter_id}/reviews", response_model=ApiResponse[ReviewInDB])
async def create_review(
    adapter_id: str,
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """创建评价"""
    review = await AdapterService.create_review(db, adapter_id, review_data, current_user)
    return create_response(data=ReviewInDB.model_validate(review))


# ==================== 评论功能 ====================

@router.post("/{adapter_id}/comments", response_model=ApiResponse[CommentInDB])
async def create_comment(
    adapter_id: str,
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """创建评论"""
    comment = await AdapterService.create_comment(db, adapter_id, comment_data, current_user)
    return create_response(data=CommentInDB.model_validate(comment))

