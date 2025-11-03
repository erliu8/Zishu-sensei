"""
打包服务 API 端点
"""
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.core.response import create_response, ApiResponse
from app.models.user import User
from app.schemas.adapter import (
    PackagingTaskCreate,
    PackagingTaskInDB,
    PackagingTaskStatus,
)
from app.services.adapter import PackagingService

router = APIRouter()


@router.post("", response_model=ApiResponse[PackagingTaskInDB])
async def create_packaging_task(
    task_data: PackagingTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """创建打包任务"""
    task = await PackagingService.create_task(db, task_data, current_user)
    return create_response(
        data=PackagingTaskInDB.model_validate(task),
        message="打包任务已创建"
    )


@router.get("/{task_id}", response_model=ApiResponse[PackagingTaskInDB])
async def get_packaging_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取打包任务详情"""
    task = await PackagingService.get_task(db, task_id, user=current_user)
    return create_response(data=PackagingTaskInDB.model_validate(task))


@router.get("/{task_id}/status", response_model=ApiResponse[PackagingTaskStatus])
async def get_packaging_task_status(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取打包任务状态（轮询使用）"""
    task = await PackagingService.get_task(db, task_id, user=current_user)
    
    status = PackagingTaskStatus(
        id=task.id,
        status=task.status,
        progress=task.progress,
        download_url=task.download_url,
        error_message=task.error_message,
    )
    
    return create_response(data=status)


@router.get("/user/tasks", response_model=ApiResponse[List[PackagingTaskInDB]])
async def get_user_packaging_tasks(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取用户的打包任务列表"""
    tasks, total = await PackagingService.get_user_tasks(db, current_user, page, size)
    
    items = [PackagingTaskInDB.model_validate(task) for task in tasks]
    
    return create_response(data=items)


@router.delete("/{task_id}")
async def cancel_packaging_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """取消打包任务"""
    await PackagingService.cancel_task(db, task_id, current_user)
    return create_response(message="打包任务已取消")


@router.get("/models/available", response_model=ApiResponse[List[dict]])
async def get_available_models():
    """获取可用的AI模型列表"""
    models = PackagingService.get_available_models()
    return create_response(data=models)


@router.get("/characters/available", response_model=ApiResponse[List[dict]])
async def get_available_characters():
    """获取可用的角色列表"""
    characters = PackagingService.get_available_characters()
    return create_response(data=characters)

