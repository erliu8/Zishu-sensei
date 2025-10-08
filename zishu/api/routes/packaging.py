#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
打包路由 - Zishu-sensei
提供包管理、构建、测试、发布等RESTful API接口
包含完整的CRUD操作和异步任务管理
"""

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Query,
    Path,
    Body,
    BackgroundTasks,
    File,
    UploadFile,
)
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Optional, Any, Union
from datetime import datetime, timedelta
import json
import asyncio
from pathlib import Path as PathLib
import tempfile
import shutil

# 项目内部导入
from ..core.database import get_db_session
from ..core.security import get_current_user, get_current_active_user
from ..core.logging import get_logger
from ..core.config import settings
from ..schemas.packaging import (
    # 请求响应模型
    PackageCreateRequest,
    PackageUpdateRequest,
    PackageDetailResponse,
    PackageListItem,
    BuildRequest,
    BuildTaskResponse,
    TestRequest,
    TestResultResponse,
    PublishRequest,
    PublishResultResponse,
    SignRequest,
    SignatureResponse,
    PackageStatistics,
    # 枚举和状态
    PackageStatus,
    BuildStatus,
    TestType,
    PackageType,
    DistributionChannel,
    PackageFormat,
    # 分页和过滤
    PaginatedResponse,
    SearchFilters,
    # 文件和版本
    FileInfo,
    VersionInfo,
    DependencyInfo,
)
from ..services.packaging_service import packaging_service
from ..services.build_service import build_service
from ..tasks.packaging_tasks import (
    build_package_task,
    test_package_task,
    publish_package_task,
    batch_build_task,
    package_pipeline_task,
    cleanup_task,
)
from ..models.user import User
from ..utils.file_utils import validate_file_upload, extract_archive
from ..utils.pagination import create_pagination_params
from ..utils.response import create_success_response, create_error_response

logger = get_logger(__name__)

# 创建路由器
router = APIRouter(
    prefix="/api/v1/packaging",
    tags=["packaging"],
    responses={
        404: {"description": "Not found"},
        422: {"description": "Validation error"},
        500: {"description": "Internal server error"},
    },
)

# ======================== 包管理接口 ========================


@router.post(
    "/packages",
    response_model=PackageDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_package(
    request: PackageCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    创建新包

    - **name**: 包名（唯一标识）
    - **display_name**: 显示名称
    - **description**: 包描述
    - **version**: 版本号
    - **package_type**: 包类型（适配器/插件/主题等）
    - **source_path**: 源码路径
    - **build_config**: 构建配置
    - **dependencies**: 依赖列表
    - **auto_build**: 是否自动构建
    """
    try:
        logger.info(f"用户 {current_user.id} 创建包: {request.metadata.name}")

        result = await packaging_service.create_package(
            request=request, user_id=current_user.id, db=db
        )

        return result

    except Exception as e:
        logger.error(f"创建包失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建包失败"
        )


@router.get("/packages/{package_id}", response_model=PackageDetailResponse)
async def get_package_detail(
    package_id: str = Path(..., description="包ID"),
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取包详情

    包含完整的包信息、版本历史、文件列表、统计数据等
    """
    try:
        result = await packaging_service.get_package_detail(
            package_id=package_id,
            user_id=current_user.id if current_user else None,
            db=db,
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取包详情失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取包详情失败"
        )


@router.put("/packages/{package_id}", response_model=PackageDetailResponse)
async def update_package(
    package_id: str = Path(..., description="包ID"),
    request: PackageUpdateRequest = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    更新包信息

    可以更新包的元数据、构建配置、测试配置、依赖等信息
    """
    try:
        result = await packaging_service.update_package(
            package_id=package_id, request=request, user_id=current_user.id, db=db
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新包失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新包失败"
        )


@router.delete("/packages/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_package(
    package_id: str = Path(..., description="包ID"),
    force: bool = Query(False, description="是否强制删除"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    删除包

    - **force**: 强制删除（包括已发布的包）
    """
    try:
        await packaging_service.delete_package(
            package_id=package_id, user_id=current_user.id, db=db, force=force
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除包失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除包失败"
        )


@router.get("/packages", response_model=PaginatedResponse)
async def list_packages(
    # 分页参数
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    # 搜索过滤参数
    search: Optional[str] = Query(None, description="搜索关键词"),
    package_types: Optional[List[PackageType]] = Query(None, description="包类型过滤"),
    statuses: Optional[List[PackageStatus]] = Query(None, description="状态过滤"),
    authors: Optional[List[str]] = Query(None, description="作者过滤"),
    tags: Optional[List[str]] = Query(None, description="标签过滤"),
    categories: Optional[List[str]] = Query(None, description="分类过滤"),
    # 日期过滤
    date_from: Optional[datetime] = Query(None, description="开始日期"),
    date_to: Optional[datetime] = Query(None, description="结束日期"),
    # 其他过滤
    min_downloads: Optional[int] = Query(None, ge=0, description="最小下载量"),
    verified_only: bool = Query(False, description="仅显示已验证的包"),
    # 排序
    sort_by: str = Query("updated_at", description="排序字段"),
    sort_order: str = Query("desc", regex="^(asc|desc)$", description="排序方向"),
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取包列表

    支持分页、搜索、过滤、排序等功能
    """
    try:
        # 构建过滤器
        filters = SearchFilters(
            search=search,
            package_types=package_types or [],
            statuses=statuses or [],
            authors=authors or [],
            tags=tags or [],
            categories=categories or [],
            date_from=date_from,
            date_to=date_to,
            min_downloads=min_downloads,
            verified_only=verified_only,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        result = await packaging_service.list_packages(
            filters=filters,
            page=page,
            size=size,
            user_id=current_user.id if current_user else None,
            db=db,
        )

        return result

    except Exception as e:
        logger.error(f"获取包列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取包列表失败"
        )


# ======================== 文件上传接口 ========================


@router.post("/packages/{package_id}/upload", response_model=Dict[str, Any])
async def upload_package_files(
    package_id: str = Path(..., description="包ID"),
    files: List[UploadFile] = File(..., description="上传的文件"),
    extract_archives: bool = Query(True, description="是否自动解压压缩文件"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    上传包文件

    支持多文件上传，自动解压压缩文件
    """
    try:
        # 验证包权限
        package = await packaging_service._get_package_by_id(package_id, db)
        await packaging_service._check_package_permission(package, current_user.id)

        uploaded_files = []
        total_size = 0

        # 创建临时目录
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = PathLib(temp_dir)

            for file in files:
                # 验证文件
                await validate_file_upload(file, max_size=100 * 1024 * 1024)  # 100MB限制

                # 保存文件
                file_path = temp_path / file.filename
                with open(file_path, "wb") as buffer:
                    content = await file.read()
                    buffer.write(content)
                    total_size += len(content)

                # 如果是压缩文件且需要解压
                if extract_archives and file.filename.endswith(
                    (".zip", ".tar.gz", ".tar")
                ):
                    extract_path = temp_path / f"extracted_{file.filename}"
                    await extract_archive(file_path, extract_path)
                    uploaded_files.append(
                        {
                            "filename": file.filename,
                            "size": len(content),
                            "type": "archive",
                            "extracted_to": str(extract_path),
                        }
                    )
                else:
                    uploaded_files.append(
                        {
                            "filename": file.filename,
                            "size": len(content),
                            "type": "file",
                            "path": str(file_path),
                        }
                    )

            # 更新包的源码路径
            await packaging_service.update_package(
                package_id=package_id,
                request=PackageUpdateRequest(source_path=str(temp_path)),
                user_id=current_user.id,
                db=db,
            )

        return {
            "uploaded_files": uploaded_files,
            "total_size": total_size,
            "total_count": len(uploaded_files),
            "message": "文件上传成功",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"文件上传失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="文件上传失败"
        )


@router.get("/packages/{package_id}/download")
async def download_package(
    package_id: str = Path(..., description="包ID"),
    version: Optional[str] = Query(None, description="版本号"),
    format: PackageFormat = Query(PackageFormat.ZIP, description="下载格式"),
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    下载包文件

    支持不同版本和格式的下载
    """
    try:
        # 获取包信息
        package = await packaging_service.get_package_detail(
            package_id=package_id,
            user_id=current_user.id if current_user else None,
            db=db,
        )

        # 查找对应版本的文件
        target_version = version or package.metadata.version.full

        # 构建文件路径
        package_file = (
            PathLib(settings.PACKAGES_DIR)
            / package_id
            / target_version
            / f"package.{format.value}"
        )

        if not package_file.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="包文件不存在")

        # 增加下载计数
        # TODO: 实现下载计数逻辑

        return FileResponse(
            path=str(package_file),
            filename=f"{package.metadata.name}-{target_version}.{format.value}",
            media_type="application/octet-stream",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载包失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="下载包失败"
        )


# ======================== 构建接口 ========================


@router.post(
    "/packages/{package_id}/build",
    response_model=BuildTaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def build_package(
    package_id: str = Path(..., description="包ID"),
    request: BuildRequest = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    构建包

    创建异步构建任务，返回任务ID用于查询构建状态
    """
    try:
        # 设置包ID
        request.package_id = package_id

        # 创建构建任务
        build_task = await packaging_service.build_package(
            request=request, user_id=current_user.id, db=db
        )

        # 添加后台任务
        background_tasks.add_task(
            build_package_task.delay, build_task.id, current_user.id
        )

        return build_task

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建构建任务失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建构建任务失败"
        )


@router.get("/builds/{build_id}", response_model=BuildTaskResponse)
async def get_build_status(
    build_id: str = Path(..., description="构建ID"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取构建状态

    查询构建任务的实时状态、进度、日志等信息
    """
    try:
        result = await packaging_service.get_build_status(
            build_id=build_id, user_id=current_user.id, db=db
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取构建状态失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取构建状态失败"
        )


@router.post(
    "/builds/batch", response_model=Dict[str, Any], status_code=status.HTTP_202_ACCEPTED
)
async def batch_build_packages(
    build_requests: List[BuildRequest] = Body(..., description="批量构建请求"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    批量构建包

    同时构建多个包，返回批量任务ID
    """
    try:
        # 创建构建任务列表
        build_tasks = []
        for request in build_requests:
            build_task = await packaging_service.build_package(
                request=request, user_id=current_user.id, db=db
            )
            build_tasks.append(
                {"package_id": request.package_id, "build_task_id": build_task.id}
            )

        # 添加批量构建后台任务
        batch_task = batch_build_task.delay(build_tasks, current_user.id)

        return {
            "batch_task_id": batch_task.id,
            "build_tasks": build_tasks,
            "total_count": len(build_tasks),
            "message": "批量构建任务已创建",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量构建失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="批量构建失败"
        )


# ======================== 测试接口 ========================


@router.post(
    "/packages/{package_id}/test",
    response_model=TestResultResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def test_package(
    package_id: str = Path(..., description="包ID"),
    request: TestRequest = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    测试包

    运行包的测试套件，支持单元测试、集成测试、性能测试等
    """
    try:
        # 设置包ID
        request.package_id = package_id

        # 创建测试任务
        test_result = await packaging_service.test_package(
            request=request, user_id=current_user.id, db=db
        )

        return test_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"测试包失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="测试包失败"
        )


# ======================== 发布接口 ========================


@router.post(
    "/packages/{package_id}/publish",
    response_model=PublishResultResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def publish_package(
    package_id: str = Path(..., description="包ID"),
    request: PublishRequest = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    发布包

    将包发布到指定的分发渠道
    """
    try:
        # 设置包ID
        request.package_id = package_id

        # 创建发布任务
        publish_result = await packaging_service.publish_package(
            request=request, user_id=current_user.id, db=db
        )

        return publish_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"发布包失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="发布包失败"
        )


# ======================== 流水线接口 ========================


@router.post(
    "/packages/{package_id}/pipeline",
    response_model=Dict[str, Any],
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_package_pipeline(
    package_id: str = Path(..., description="包ID"),
    pipeline_config: Dict[str, Any] = Body(..., description="流水线配置"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    运行包处理流水线

    按顺序执行构建、测试、发布等操作
    """
    try:
        # 验证包权限
        package = await packaging_service._get_package_by_id(package_id, db)
        await packaging_service._check_package_permission(package, current_user.id)

        # 设置包ID
        pipeline_config["package_id"] = package_id

        # 创建流水线任务
        pipeline_task = package_pipeline_task.delay(
            package_id, pipeline_config, current_user.id
        )

        return {
            "pipeline_task_id": pipeline_task.id,
            "package_id": package_id,
            "config": pipeline_config,
            "message": "流水线任务已创建",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建流水线任务失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建流水线任务失败"
        )


# ======================== 签名接口 ========================


@router.post("/packages/{package_id}/sign", response_model=SignatureResponse)
async def sign_package(
    package_id: str = Path(..., description="包ID"),
    request: SignRequest = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    签名包

    使用数字签名确保包的完整性和来源
    """
    try:
        # TODO: 实现包签名逻辑
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="包签名功能尚未实现"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"签名包失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="签名包失败"
        )


# ======================== 统计接口 ========================


@router.get("/statistics", response_model=PackageStatistics)
async def get_package_statistics(
    user_scope: bool = Query(False, description="是否仅统计当前用户的包"),
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取包统计信息

    包含包数量、下载量、构建统计、测试统计等
    """
    try:
        result = await packaging_service.get_package_statistics(
            user_id=current_user.id if user_scope and current_user else None, db=db
        )

        return result

    except Exception as e:
        logger.error(f"获取统计信息失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取统计信息失败"
        )


# ======================== 管理接口 ========================


@router.post("/cleanup", response_model=Dict[str, Any])
async def cleanup_packages(
    cleanup_config: Dict[str, Any] = Body(
        default={
            "clean_build_files": True,
            "clean_task_records": True,
            "clean_cache": True,
            "build_retention_days": 7,
            "task_retention_days": 30,
            "cache_retention_hours": 24,
        },
        description="清理配置",
    ),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_active_user),
):
    """
    清理包数据

    清理过期的构建文件、任务记录、缓存等
    需要管理员权限
    """
    try:
        # TODO: 添加管理员权限检查

        # 创建清理任务
        cleanup_task_result = cleanup_task.delay(cleanup_config)

        return {
            "cleanup_task_id": cleanup_task_result.id,
            "config": cleanup_config,
            "message": "清理任务已创建",
        }

    except Exception as e:
        logger.error(f"创建清理任务失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建清理任务失败"
        )


# ======================== WebSocket接口 ========================


@router.websocket("/packages/{package_id}/logs")
async def package_logs_websocket(websocket, package_id: str):
    """
    包日志WebSocket连接

    实时推送构建、测试、发布日志
    """
    await websocket.accept()
    try:
        # TODO: 实现WebSocket日志推送
        while True:
            # 模拟日志推送
            await asyncio.sleep(1)
            await websocket.send_json(
                {
                    "timestamp": datetime.now().isoformat(),
                    "level": "info",
                    "message": f"Package {package_id} status update",
                }
            )

    except Exception as e:
        logger.error(f"WebSocket连接错误: {e}")
    finally:
        await websocket.close()


# 导出路由器
__all__ = ["router"]
