"""
通知 API 端点
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.schemas.notification import NotificationPublic, NotificationStats
from app.schemas.common import PaginatedResponse
from app.db.repositories.notification import NotificationRepository
from app.models.user import User

router = APIRouter()


@router.get("", response_model=PaginatedResponse[NotificationPublic])
async def get_notifications(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    unread_only: bool = Query(False, description="只显示未读通知"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取通知列表
    
    获取当前用户的通知列表
    
    - **page**: 页码
    - **page_size**: 每页数量
    - **unread_only**: 只显示未读通知
    """
    notification_repo = NotificationRepository(db)
    
    # 获取通知列表
    skip = (page - 1) * page_size
    notifications = await notification_repo.get_user_notifications(
        current_user.id,
        skip,
        page_size,
        unread_only
    )
    
    # 获取总数
    if unread_only:
        total = await notification_repo.count(user_id=current_user.id, is_read=False)
    else:
        total = await notification_repo.count(user_id=current_user.id)
    
    return PaginatedResponse.create(
        items=notifications,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=NotificationStats)
async def get_notification_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取通知统计
    
    返回总通知数和未读通知数
    """
    notification_repo = NotificationRepository(db)
    
    total_notifications = await notification_repo.count(user_id=current_user.id)
    unread_notifications = await notification_repo.get_unread_count(current_user.id)
    
    return NotificationStats(
        total_notifications=total_notifications,
        unread_notifications=unread_notifications,
    )


@router.get("/{notification_id}", response_model=NotificationPublic)
async def get_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取通知详情
    
    返回指定ID的通知详细信息
    """
    notification_repo = NotificationRepository(db)
    
    # 获取通知
    notification = await notification_repo.get_by_id(notification_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在"
        )
    
    # 检查权限
    if notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限查看此通知"
        )
    
    return notification


@router.put("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    标记通知为已读
    
    将指定通知标记为已读
    """
    notification_repo = NotificationRepository(db)
    
    # 获取通知
    notification = await notification_repo.get_by_id(notification_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在"
        )
    
    # 检查权限
    if notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限操作此通知"
        )
    
    # 标记为已读
    await notification_repo.mark_as_read(notification_id)
    await db.commit()
    
    return {"message": "标记成功"}


@router.put("/read-all")
async def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    标记所有通知为已读
    
    将当前用户的所有未读通知标记为已读
    """
    notification_repo = NotificationRepository(db)
    
    # 标记所有通知为已读
    await notification_repo.mark_all_as_read(current_user.id)
    await db.commit()
    
    return {"message": "所有通知已标记为已读"}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    删除通知
    
    删除指定的通知
    """
    notification_repo = NotificationRepository(db)
    
    # 获取通知
    notification = await notification_repo.get_by_id(notification_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="通知不存在"
        )
    
    # 检查权限
    if notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限删除此通知"
        )
    
    # 删除通知
    await notification_repo.delete(notification_id)
    await db.commit()
    
    return None

