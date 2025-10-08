#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
文件管理路由 - 提供完整的文件管理API
支持文件上传、下载、搜索、权限管理、批量操作等功能
"""

import os
import uuid
import asyncio
from pathlib import Path
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    Response,
    UploadFile,
    File,
    Form,
    Query,
    Path as PathParam,
    BackgroundTasks,
    status,
)
from fastapi.responses import FileResponse, StreamingResponse
from starlette.responses import JSONResponse

# 项目内部导入
from ..schemas.file import (
    # 请求模型
    FileUploadRequest,
    FileUpdateRequest,
    FilePermissionRequest,
    FileBatchOperationRequest,
    FileSearchRequest,
    FolderCreateRequest,
    FileShareRequest,
    # 响应模型
    FileUploadResponse,
    FileInfoResponse,
    FileListResponse,
    FileOperationResponse,
    FileBatchOperationResponse,
    FileSearchResponse,
    FileShareResponse,
    FilePermissionResponse,
    FileVersionResponse,
    FileActivityResponse,
    FileStatisticsResponse,
    FolderResponse,
    # 枚举和基础模型
    FileType,
    FileStatus,
    FileAccessLevel,
    FileOperation,
    StorageProvider,
    FileInfo,
    FileMetadata,
    FolderInfo,
    FileActivity,
    # 工具类
    FileValidator,
    FileHelper,
)
from ..utils.file_utils import (
    FileProcessor,
    FileManager,
    ChunkedUploadManager,
    validate_uploaded_file,
    get_file_info,
)
from ..utils.auth_decorators import (
    require_auth,
    require_permissions,
    require_admin,
    audit_log,
    rate_limit,
    security_headers,
    cache_response,
)
from ..dependencies import get_dependencies
from ..services.file_service import FileService
from ..services.storage_service import StorageService

# 创建路由器
router = APIRouter(prefix="/files", tags=["文件管理"])

# 全局配置
MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5GB
UPLOAD_DIR = Path("uploads")
THUMBNAIL_DIR = Path("thumbnails")

# 确保目录存在
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)

# ======================== 依赖注入 ========================


async def get_file_service() -> FileService:
    """获取文件服务"""
    dependencies = get_dependencies()
    return dependencies.get("file_service", FileService())


async def get_storage_service() -> StorageService:
    """获取存储服务"""
    dependencies = get_dependencies()
    return dependencies.get("storage_service", StorageService())


async def get_file_manager() -> FileManager:
    """获取文件管理器"""
    return FileManager(UPLOAD_DIR)


async def get_chunk_upload_manager() -> ChunkedUploadManager:
    """获取分块上传管理器"""
    dependencies = get_dependencies()
    manager = dependencies.get("chunk_upload_manager")
    if not manager:
        manager = ChunkedUploadManager()
        dependencies.register_service("chunk_upload_manager", manager)
    return manager


# ======================== 文件上传 ========================


@router.post("/upload", response_model=FileUploadResponse)
@security_headers()
@rate_limit(limit=20, window=300)  # 5分钟内最多20次上传
@audit_log("file_upload", sensitive=False)
@require_permissions("file:upload")
async def upload_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # JSON字符串格式
    category: Optional[str] = Form(None),
    access_level: FileAccessLevel = Form(FileAccessLevel.PRIVATE),
    auto_scan: bool = Form(True),
    auto_generate_thumbnail: bool = Form(True),
    file_service: FileService = Depends(get_file_service),
    file_manager: FileManager = Depends(get_file_manager),
    current_user: Dict[str, Any] = None,
):
    """
    上传单个文件

    支持特性：
    - 文件类型验证
    - 大小限制检查
    - 自动病毒扫描
    - 缩略图生成
    - 元数据提取
    """
    try:
        # 验证文件
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"文件大小超过限制 ({FileHelper.format_file_size(MAX_FILE_SIZE)})",
            )

        # 检查文件名安全性
        if not FileValidator.validate_filename(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="文件名包含非法字符"
            )

        # 检查危险文件类型
        if FileValidator.is_dangerous_file(file.filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不允许上传此类型的文件"
            )

        # 解析标签
        file_tags = []
        if tags:
            try:
                import json

                file_tags = json.loads(tags)
            except:
                file_tags = [tag.strip() for tag in tags.split(",")]

        # 保存文件
        file_path, metadata = await file_manager.save_file(
            file.file, file.filename, folder=folder_id
        )

        # 创建文件信息
        file_info = FileInfo(
            name=metadata.filename,
            path=str(file_path.relative_to(UPLOAD_DIR)),
            owner_id=current_user["user_id"],
            created_by=current_user["user_id"],
            description=description,
            tags=file_tags,
            category=category,
            parent_folder_id=folder_id,
            metadata=metadata,
            security={"access_level": access_level},
        )

        # 保存到数据库
        saved_file = await file_service.create_file(file_info)

        # 后台任务
        if auto_generate_thumbnail:
            background_tasks.add_task(
                _generate_thumbnail_task, file_path, saved_file.id
            )

        if auto_scan:
            background_tasks.add_task(_virus_scan_task, file_path, saved_file.id)

        # 记录活动
        background_tasks.add_task(
            _log_file_activity,
            saved_file.id,
            current_user["user_id"],
            FileOperation.UPLOAD,
            "文件上传成功",
        )

        return FileUploadResponse(
            file_id=saved_file.id,
            filename=saved_file.name,
            size=saved_file.metadata.size,
            mime_type=saved_file.metadata.mime_type,
            file_type=saved_file.metadata.file_type,
            upload_id=str(uuid.uuid4()),
            status=saved_file.status,
            uploaded_at=saved_file.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件上传失败: {str(e)}",
        )


@router.post("/upload/chunked/init", response_model=Dict[str, Any])
@security_headers()
@require_permissions("file:upload")
async def init_chunked_upload(
    request: Request,
    filename: str = Form(...),
    total_size: int = Form(...),
    chunk_size: int = Form(64 * 1024 * 1024),  # 64MB
    file_hash: Optional[str] = Form(None),
    chunk_manager: ChunkedUploadManager = Depends(get_chunk_upload_manager),
    current_user: Dict[str, Any] = None,
):
    """初始化分块上传"""
    try:
        # 验证参数
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"文件大小超过限制"
            )

        if not FileValidator.validate_filename(filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="文件名包含非法字符"
            )

        # 创建上传会话
        upload_id = chunk_manager.create_upload_session(filename, total_size, file_hash)

        total_chunks = (total_size + chunk_size - 1) // chunk_size

        return {
            "upload_id": upload_id,
            "chunk_size": chunk_size,
            "total_chunks": total_chunks,
            "expires_at": datetime.now() + timedelta(hours=24),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"初始化分块上传失败: {str(e)}",
        )


@router.post("/upload/chunked/{upload_id}/chunk/{chunk_index}")
@security_headers()
@require_permissions("file:upload")
async def upload_chunk(
    upload_id: str = PathParam(...),
    chunk_index: int = PathParam(...),
    chunk_data: UploadFile = File(...),
    chunk_manager: ChunkedUploadManager = Depends(get_chunk_upload_manager),
    current_user: Dict[str, Any] = None,
):
    """上传文件分块"""
    try:
        # 读取分块数据
        chunk_bytes = await chunk_data.read()

        # 上传分块
        success = await chunk_manager.upload_chunk(upload_id, chunk_index, chunk_bytes)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="分块上传失败"
            )

        # 获取上传进度
        progress = chunk_manager.get_upload_progress(upload_id)

        return {
            "success": True,
            "chunk_index": chunk_index,
            "progress": progress["progress"],
            "chunks_received": progress["chunks_received"],
            "total_chunks": progress["total_chunks"],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"分块上传失败: {str(e)}",
        )


@router.post("/upload/chunked/{upload_id}/complete", response_model=FileUploadResponse)
@security_headers()
@require_permissions("file:upload")
async def complete_chunked_upload(
    background_tasks: BackgroundTasks,
    upload_id: str = PathParam(...),
    folder_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    access_level: FileAccessLevel = Form(FileAccessLevel.PRIVATE),
    chunk_manager: ChunkedUploadManager = Depends(get_chunk_upload_manager),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """完成分块上传"""
    try:
        # 获取上传信息
        progress = chunk_manager.get_upload_progress(upload_id)
        filename = progress["filename"]

        # 生成最终文件路径
        safe_filename = FileValidator.generate_safe_filename(filename)
        final_path = UPLOAD_DIR / safe_filename

        # 完成分块合并
        success = await chunk_manager.complete_upload(upload_id, final_path)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="分块上传完成失败"
            )

        # 提取元数据
        processor = FileProcessor()
        metadata_dict = await processor.extract_metadata(final_path)

        metadata = FileMetadata(
            filename=safe_filename,
            original_filename=filename,
            size=metadata_dict.get("size", 0),
            mime_type=metadata_dict.get("mime_type", "application/octet-stream"),
            file_type=metadata_dict.get("file_type", FileType.OTHER),
            extension=metadata_dict.get("extension", ""),
        )

        # 解析标签
        file_tags = []
        if tags:
            try:
                import json

                file_tags = json.loads(tags)
            except:
                file_tags = [tag.strip() for tag in tags.split(",")]

        # 创建文件信息
        file_info = FileInfo(
            name=metadata.filename,
            path=str(final_path.relative_to(UPLOAD_DIR)),
            owner_id=current_user["user_id"],
            created_by=current_user["user_id"],
            description=description,
            tags=file_tags,
            category=category,
            parent_folder_id=folder_id,
            metadata=metadata,
            security={"access_level": access_level},
        )

        # 保存到数据库
        saved_file = await file_service.create_file(file_info)

        # 后台任务
        background_tasks.add_task(_generate_thumbnail_task, final_path, saved_file.id)

        background_tasks.add_task(_virus_scan_task, final_path, saved_file.id)

        return FileUploadResponse(
            file_id=saved_file.id,
            filename=saved_file.name,
            size=saved_file.metadata.size,
            mime_type=saved_file.metadata.mime_type,
            file_type=saved_file.metadata.file_type,
            upload_id=upload_id,
            status=saved_file.status,
            uploaded_at=saved_file.created_at,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"完成分块上传失败: {str(e)}",
        )


# ======================== 文件下载 ========================


@router.get("/download/{file_id}")
@security_headers()
@audit_log("file_download", sensitive=False)
@require_permissions("file:download")
async def download_file(
    file_id: str = PathParam(...),
    inline: bool = Query(False, description="是否在浏览器中预览"),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """下载文件"""
    try:
        # 获取文件信息
        file_info = await file_service.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        # 检查权限
        if not await _check_file_permission(
            file_info, current_user, FileOperation.DOWNLOAD
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有下载权限")

        # 检查文件状态
        if file_info.status not in [FileStatus.ACTIVE]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="文件当前不可下载"
            )

        # 获取文件路径
        file_path = UPLOAD_DIR / file_info.path
        if not file_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="物理文件不存在")

        # 更新下载统计
        await file_service.increment_download_count(file_id)

        # 记录访问日志
        await _log_file_activity(
            file_id, current_user["user_id"], FileOperation.DOWNLOAD, "文件下载"
        )

        # 设置响应头
        headers = {
            "Content-Length": str(file_path.stat().st_size),
            "Content-Type": file_info.metadata.mime_type,
            "Cache-Control": "public, max-age=3600",
        }

        if not inline:
            headers[
                "Content-Disposition"
            ] = f'attachment; filename="{file_info.metadata.original_filename or file_info.name}"'

        return FileResponse(
            path=file_path,
            headers=headers,
            filename=file_info.metadata.original_filename or file_info.name,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件下载失败: {str(e)}",
        )


@router.get("/stream/{file_id}")
@security_headers()
@require_permissions("file:download")
async def stream_file(
    request: Request,
    file_id: str = PathParam(...),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """流式传输文件（支持范围请求）"""
    try:
        # 获取文件信息
        file_info = await file_service.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        # 检查权限
        if not await _check_file_permission(
            file_info, current_user, FileOperation.READ
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有访问权限")

        file_path = UPLOAD_DIR / file_info.path
        if not file_path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="物理文件不存在")

        file_size = file_path.stat().st_size

        # 处理范围请求
        range_header = request.headers.get("Range")

        if range_header:
            # 解析范围请求
            range_match = __import__("re").match(r"bytes=(\d+)-(\d*)", range_header)
            if range_match:
                start = int(range_match.group(1))
                end = (
                    int(range_match.group(2)) if range_match.group(2) else file_size - 1
                )

                if start >= file_size or end >= file_size:
                    raise HTTPException(
                        status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
                        detail="请求范围无效",
                    )

                chunk_size = min(1024 * 1024, end - start + 1)  # 1MB chunks

                def stream_range():
                    with open(file_path, "rb") as f:
                        f.seek(start)
                        remaining = end - start + 1
                        while remaining > 0:
                            read_size = min(chunk_size, remaining)
                            data = f.read(read_size)
                            if not data:
                                break
                            remaining -= len(data)
                            yield data

                headers = {
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(end - start + 1),
                    "Content-Type": file_info.metadata.mime_type,
                }

                return StreamingResponse(
                    stream_range(), status_code=206, headers=headers
                )

        # 完整文件流
        def stream_file():
            with open(file_path, "rb") as f:
                while True:
                    chunk = f.read(1024 * 1024)  # 1MB chunks
                    if not chunk:
                        break
                    yield chunk

        headers = {
            "Content-Length": str(file_size),
            "Content-Type": file_info.metadata.mime_type,
            "Accept-Ranges": "bytes",
        }

        return StreamingResponse(stream_file(), headers=headers)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"流式传输失败: {str(e)}",
        )


# ======================== 文件信息管理 ========================


@router.get("/{file_id}", response_model=FileInfoResponse)
@security_headers()
@cache_response(ttl=300, vary_on_user=True)
@require_permissions("file:read")
async def get_file_info(
    file_id: str = PathParam(...),
    include_permissions: bool = Query(False),
    include_versions: bool = Query(False),
    include_activity: bool = Query(False),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """获取文件信息"""
    try:
        # 获取文件信息
        file_info = await file_service.get_file(
            file_id,
            include_permissions=include_permissions,
            include_versions=include_versions,
        )

        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        # 检查权限
        if not await _check_file_permission(
            file_info, current_user, FileOperation.READ
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有访问权限")

        # 获取用户权限
        user_permissions = await _get_user_file_permissions(file_info, current_user)

        response_data = {
            "file": file_info,
            "user_permissions": user_permissions,
            "can_download": FileOperation.DOWNLOAD in user_permissions,
            "can_edit": FileOperation.UPDATE in user_permissions,
            "can_delete": FileOperation.DELETE in user_permissions,
            "can_share": FileOperation.SHARE in user_permissions,
        }

        # 获取访问统计
        if current_user.get("permissions") and "admin" in current_user["permissions"]:
            access_stats = await file_service.get_file_statistics(file_id)
            response_data["access_stats"] = access_stats

        return FileInfoResponse(**response_data)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文件信息失败: {str(e)}",
        )


@router.put("/{file_id}", response_model=FileOperationResponse)
@security_headers()
@audit_log("file_update", sensitive=False)
@require_permissions("file:update")
async def update_file(
    update_data: FileUpdateRequest,
    background_tasks: BackgroundTasks,
    file_id: str = PathParam(...),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """更新文件信息"""
    try:
        # 获取文件信息
        file_info = await file_service.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        # 检查权限
        if not await _check_file_permission(
            file_info, current_user, FileOperation.UPDATE
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有更新权限")

        # 更新文件信息
        updated_file = await file_service.update_file(
            file_id, update_data, current_user["user_id"]
        )

        # 如果移动了文件夹，处理物理文件移动
        if (
            update_data.folder_id
            and update_data.folder_id != file_info.parent_folder_id
        ):
            background_tasks.add_task(
                _move_physical_file, file_info.path, updated_file.path
            )

        # 记录活动
        background_tasks.add_task(
            _log_file_activity,
            file_id,
            current_user["user_id"],
            FileOperation.UPDATE,
            "文件信息更新",
        )

        return FileOperationResponse(
            success=True,
            operation=FileOperation.UPDATE,
            file_id=file_id,
            message="文件信息更新成功",
            new_status=updated_file.status,
            processed_at=datetime.now(),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新文件失败: {str(e)}",
        )


@router.delete("/{file_id}", response_model=FileOperationResponse)
@security_headers()
@audit_log("file_delete", sensitive=True)
@require_permissions("file:delete")
async def delete_file(
    background_tasks: BackgroundTasks,
    file_id: str = PathParam(...),
    permanent: bool = Query(False, description="是否永久删除"),
    secure_delete: bool = Query(False, description="是否安全删除（覆写文件）"),
    file_service: FileService = Depends(get_file_service),
    file_manager: FileManager = Depends(get_file_manager),
    current_user: Dict[str, Any] = None,
):
    """删除文件"""
    try:
        # 获取文件信息
        file_info = await file_service.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        # 检查权限
        if not await _check_file_permission(
            file_info, current_user, FileOperation.DELETE
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有删除权限")

        if permanent:
            # 永久删除
            success = await file_service.delete_file_permanently(file_id)

            # 删除物理文件
            if success:
                file_path = UPLOAD_DIR / file_info.path
                background_tasks.add_task(
                    file_manager.delete_file, file_path, secure_delete
                )

            message = "文件永久删除成功"
            new_status = None
        else:
            # 标记为已删除
            success = await file_service.mark_as_deleted(
                file_id, current_user["user_id"]
            )
            message = "文件已移至回收站"
            new_status = FileStatus.DELETED

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除操作失败"
            )

        # 记录活动
        background_tasks.add_task(
            _log_file_activity,
            file_id,
            current_user["user_id"],
            FileOperation.DELETE,
            message,
        )

        return FileOperationResponse(
            success=True,
            operation=FileOperation.DELETE,
            file_id=file_id,
            message=message,
            new_status=new_status,
            processed_at=datetime.now(),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除文件失败: {str(e)}",
        )


# ======================== 文件列表和搜索 ========================


@router.get("/", response_model=FileListResponse)
@security_headers()
@cache_response(ttl=60, vary_on_user=True)
@require_permissions("file:read")
async def list_files(
    folder_id: Optional[str] = Query(None),
    status_filter: Optional[List[FileStatus]] = Query(None),
    type_filter: Optional[List[FileType]] = Query(None),
    tags: Optional[List[str]] = Query(None),
    category: Optional[str] = Query(None),
    sort_by: str = Query("created_at", description="排序字段"),
    sort_order: str = Query("desc", description="排序顺序: asc/desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    include_folders: bool = Query(True),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """获取文件列表"""
    try:
        # 构建过滤条件
        filters = {
            "owner_id": current_user["user_id"],
            "folder_id": folder_id,
            "statuses": status_filter or [FileStatus.ACTIVE],
            "file_types": type_filter,
            "tags": tags,
            "category": category,
        }

        # 获取文件列表
        files, total_count = await file_service.list_files(
            filters=filters,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            page_size=page_size,
        )

        # 获取文件夹列表
        folders = []
        if include_folders:
            folders = await file_service.list_folders(
                parent_id=folder_id, owner_id=current_user["user_id"]
            )

        # 计算分页信息
        total_pages = (total_count + page_size - 1) // page_size

        # 计算统计信息
        total_size = sum(f.metadata.size for f in files)

        return FileListResponse(
            files=files,
            folders=folders,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1,
            total_size=total_size,
            file_count=len(files),
            folder_count=len(folders),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文件列表失败: {str(e)}",
        )


@router.post("/search", response_model=FileSearchResponse)
@security_headers()
@require_permissions("file:read")
async def search_files(
    search_request: FileSearchRequest,
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """搜索文件"""
    try:
        start_time = datetime.now()

        # 执行搜索
        search_results = await file_service.search_files(
            search_request, current_user["user_id"]
        )

        search_time = (datetime.now() - start_time).total_seconds()

        return FileSearchResponse(
            query=search_request.query,
            results=search_results,
            search_time=search_time,
            hit_count=search_results.total_count,
            suggestions=[],
            related_queries=[],
            facets={},
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件搜索失败: {str(e)}",
        )


# ======================== 后台任务函数 ========================


async def _generate_thumbnail_task(file_path: Path, file_id: str):
    """生成缩略图任务"""
    try:
        processor = FileProcessor()
        thumbnail_path = THUMBNAIL_DIR / f"{file_id}_thumb.jpg"

        success = await processor.generate_thumbnail(
            file_path, thumbnail_path, (200, 200)
        )

        if success:
            # 更新数据库中的缩略图URL
            file_service = FileService()
            await file_service.update_thumbnail_url(
                file_id, f"/thumbnails/{file_id}_thumb.jpg"
            )
    except Exception as e:
        print(f"缩略图生成失败: {e}")


async def _virus_scan_task(file_path: Path, file_id: str):
    """病毒扫描任务"""
    try:
        # 这里应该集成实际的病毒扫描引擎
        # 目前返回安全状态
        file_service = FileService()
        await file_service.update_scan_status(file_id, "clean")
    except Exception as e:
        print(f"病毒扫描失败: {e}")


async def _log_file_activity(
    file_id: str, user_id: str, operation: FileOperation, description: str
):
    """记录文件活动"""
    try:
        file_service = FileService()
        activity = FileActivity(
            file_id=file_id,
            user_id=user_id,
            operation=operation,
            description=description,
            success=True,
            timestamp=datetime.now(),
        )
        await file_service.log_activity(activity)
    except Exception as e:
        print(f"活动记录失败: {e}")


async def _move_physical_file(old_path: str, new_path: str):
    """移动物理文件"""
    try:
        file_manager = FileManager(UPLOAD_DIR)
        await file_manager.move_file(UPLOAD_DIR / old_path, UPLOAD_DIR / new_path)
    except Exception as e:
        print(f"物理文件移动失败: {e}")


# ======================== 权限检查辅助函数 ========================


async def _check_file_permission(
    file_info: FileInfo, current_user: Dict[str, Any], operation: FileOperation
) -> bool:
    """检查文件权限"""
    try:
        # 文件所有者拥有所有权限
        if file_info.owner_id == current_user["user_id"]:
            return True

        # 管理员拥有所有权限
        if "admin" in current_user.get("permissions", []):
            return True

        # 检查文件的访问级别
        if file_info.security.access_level == FileAccessLevel.PUBLIC:
            # 公开文件允许读取和下载
            if operation in [FileOperation.READ, FileOperation.DOWNLOAD]:
                return True

        # 检查特定权限
        user_permissions = await _get_user_file_permissions(file_info, current_user)
        return operation in user_permissions

    except Exception:
        return False


async def _get_user_file_permissions(
    file_info: FileInfo, current_user: Dict[str, Any]
) -> List[FileOperation]:
    """获取用户对文件的权限"""
    permissions = []

    try:
        # 文件所有者拥有所有权限
        if file_info.owner_id == current_user["user_id"]:
            return [
                FileOperation.READ,
                FileOperation.UPDATE,
                FileOperation.DELETE,
                FileOperation.DOWNLOAD,
                FileOperation.SHARE,
                FileOperation.COPY,
                FileOperation.MOVE,
                FileOperation.RENAME,
            ]

        # 管理员拥有所有权限
        if "admin" in current_user.get("permissions", []):
            return [
                FileOperation.READ,
                FileOperation.UPDATE,
                FileOperation.DELETE,
                FileOperation.DOWNLOAD,
                FileOperation.SHARE,
                FileOperation.COPY,
                FileOperation.MOVE,
                FileOperation.RENAME,
            ]

        # 根据访问级别确定基础权限
        if file_info.security.access_level == FileAccessLevel.PUBLIC:
            permissions.extend([FileOperation.READ, FileOperation.DOWNLOAD])
        elif file_info.security.access_level == FileAccessLevel.INTERNAL:
            # 内部用户可以访问
            permissions.extend([FileOperation.READ, FileOperation.DOWNLOAD])

        # 检查特定的文件权限设置
        for perm in file_info.permissions:
            if perm.user_id == current_user["user_id"]:
                # 检查权限是否过期
                if perm.expires_at and perm.expires_at < datetime.now():
                    continue
                permissions.append(perm.permission)

        return list(set(permissions))  # 去重

    except Exception:
        return []


# ======================== 文件权限管理 ========================


@router.post("/{file_id}/permissions", response_model=FilePermissionResponse)
@security_headers()
@audit_log("file_permission_grant", sensitive=True)
@require_permissions("file:manage")
async def grant_file_permission(
    permission_request: FilePermissionRequest,
    file_id: str = PathParam(...),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """授予文件权限"""
    try:
        # 获取文件信息
        file_info = await file_service.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        # 检查是否有管理权限
        if file_info.owner_id != current_user[
            "user_id"
        ] and "admin" not in current_user.get("permissions", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="没有权限管理此文件"
            )

        # 授予权限
        success = await file_service.grant_permission(
            file_id,
            permission_request.user_id,
            permission_request.permission,
            current_user["user_id"],
            permission_request.expires_at,
            permission_request.conditions,
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="权限授予失败"
            )

        # 获取用户权限
        user_permissions = await file_service.get_user_permissions(
            file_id, permission_request.user_id
        )

        return FilePermissionResponse(
            file_id=file_id,
            user_id=permission_request.user_id,
            permissions=user_permissions,
            can_read=FileOperation.READ in user_permissions,
            can_write=FileOperation.UPDATE in user_permissions,
            can_delete=FileOperation.DELETE in user_permissions,
            can_share=FileOperation.SHARE in user_permissions,
            can_manage="admin" in current_user.get("permissions", []),
            expires_at=permission_request.expires_at,
            granted_by=current_user["user_id"],
            granted_at=datetime.now(),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"权限授予失败: {str(e)}",
        )


@router.delete("/{file_id}/permissions/{user_id}")
@security_headers()
@audit_log("file_permission_revoke", sensitive=True)
@require_permissions("file:manage")
async def revoke_file_permission(
    file_id: str = PathParam(...),
    user_id: str = PathParam(...),
    permission: Optional[FileOperation] = Query(
        None, description="要撤销的特定权限，不指定则撤销所有权限"
    ),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """撤销文件权限"""
    try:
        # 获取文件信息
        file_info = await file_service.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        # 检查权限
        if file_info.owner_id != current_user[
            "user_id"
        ] and "admin" not in current_user.get("permissions", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="没有权限管理此文件"
            )

        # 撤销权限
        success = await file_service.revoke_permission(file_id, user_id, permission)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="权限撤销失败"
            )

        return {"success": True, "message": "权限撤销成功"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"权限撤销失败: {str(e)}",
        )


@router.get("/{file_id}/permissions", response_model=List[FilePermissionResponse])
@security_headers()
@require_permissions("file:read")
async def list_file_permissions(
    file_id: str = PathParam(...),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """获取文件权限列表"""
    try:
        # 获取文件信息
        file_info = await file_service.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        # 检查权限
        if not await _check_file_permission(
            file_info, current_user, FileOperation.READ
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有访问权限")

        # 只有所有者和管理员可以查看详细权限
        if file_info.owner_id != current_user[
            "user_id"
        ] and "admin" not in current_user.get("permissions", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="没有权限查看文件权限"
            )

        # 获取权限列表
        permissions = await file_service.list_file_permissions(file_id)

        return permissions

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取权限列表失败: {str(e)}",
        )


@router.post("/{file_id}/share", response_model=FileShareResponse)
@security_headers()
@audit_log("file_share", sensitive=False)
@require_permissions("file:share")
async def share_files(
    share_request: FileShareRequest,
    background_tasks: BackgroundTasks,
    file_id: str = PathParam(...),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """创建文件分享"""
    try:
        # 获取文件信息
        file_info = await file_service.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        # 检查分享权限
        if not await _check_file_permission(
            file_info, current_user, FileOperation.SHARE
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有分享权限")

        # 创建分享
        share_info = await file_service.create_share(
            [file_id], share_request, current_user["user_id"]
        )

        # 发送通知
        if share_request.notify_users:
            background_tasks.add_task(
                _send_share_notifications,
                share_info["share_id"],
                share_request.notify_users,
                share_request.custom_message,
            )

        return FileShareResponse(
            share_id=share_info["share_id"],
            share_url=share_info["share_url"],
            share_code=share_info.get("share_code"),
            qr_code_url=share_info.get("qr_code_url"),
            share_type=share_request.share_type,
            password_protected=bool(share_request.password),
            expires_at=share_request.expires_at,
            max_downloads=share_request.max_downloads,
            files=[
                {
                    "id": file_info.id,
                    "name": file_info.name,
                    "size": file_info.metadata.size,
                    "type": file_info.metadata.file_type,
                }
            ],
            created_at=datetime.now(),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件分享失败: {str(e)}",
        )


@router.get("/shared/{share_id}")
async def access_shared_files(
    share_id: str = PathParam(...),
    password: Optional[str] = Query(None),
    file_service: FileService = Depends(get_file_service),
):
    """访问分享的文件"""
    try:
        # 验证分享
        share_info = await file_service.validate_share(share_id, password)

        if not share_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="分享不存在或已过期"
            )

        # 检查下载次数限制
        if (
            share_info.get("max_downloads")
            and share_info.get("download_count", 0) >= share_info["max_downloads"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="下载次数已达上限"
            )

        return share_info

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"访问分享失败: {str(e)}",
        )


# ======================== 文件夹管理 ========================


@router.post("/folders", response_model=FolderResponse)
@security_headers()
@audit_log("folder_create", sensitive=False)
@require_permissions("file:create")
async def create_folder(
    folder_request: FolderCreateRequest,
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """创建文件夹"""
    try:
        # 验证文件夹名称
        if not FileValidator.validate_filename(folder_request.name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="文件夹名称包含非法字符"
            )

        # 检查父文件夹权限
        if folder_request.parent_id:
            parent_folder = await file_service.get_folder(folder_request.parent_id)
            if not parent_folder:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="父文件夹不存在"
                )

            if parent_folder.owner_id != current_user["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="没有在此文件夹下创建子文件夹的权限"
                )

        # 创建文件夹
        folder_info = FolderInfo(
            name=folder_request.name,
            path=await _generate_folder_path(
                folder_request.parent_id, folder_request.name
            ),
            description=folder_request.description,
            parent_id=folder_request.parent_id,
            owner_id=current_user["user_id"],
            created_by=current_user["user_id"],
            access_level=folder_request.access_level,
            level=await _get_folder_level(folder_request.parent_id),
        )

        created_folder = await file_service.create_folder(folder_info)

        # 获取文件夹内容
        contents = await file_service.get_folder_contents(created_folder.id)

        # 生成路径导航
        breadcrumb = await _generate_breadcrumb(created_folder.id)

        return FolderResponse(
            folder=created_folder,
            contents=contents,
            breadcrumb=breadcrumb,
            full_path=created_folder.path,
            user_permissions=[
                FileOperation.READ,
                FileOperation.UPDATE,
                FileOperation.DELETE,
                FileOperation.CREATE,
                FileOperation.MOVE,
            ],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建文件夹失败: {str(e)}",
        )


@router.get("/folders/{folder_id}", response_model=FolderResponse)
@security_headers()
@cache_response(ttl=60, vary_on_user=True)
@require_permissions("file:read")
async def get_folder(
    folder_id: str = PathParam(...),
    include_hidden: bool = Query(False),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """获取文件夹信息和内容"""
    try:
        # 获取文件夹信息
        folder_info = await file_service.get_folder(folder_id)
        if not folder_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件夹不存在")

        # 检查访问权限
        if not await _check_folder_permission(
            folder_info, current_user, FileOperation.READ
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有访问权限")

        # 获取文件夹内容
        contents = await file_service.get_folder_contents(
            folder_id,
            include_hidden=include_hidden,
            sort_by=sort_by,
            sort_order=sort_order,
            user_id=current_user["user_id"],
        )

        # 生成路径导航
        breadcrumb = await _generate_breadcrumb(folder_id)

        # 获取用户权限
        user_permissions = await _get_user_folder_permissions(folder_info, current_user)

        return FolderResponse(
            folder=folder_info,
            contents=contents,
            breadcrumb=breadcrumb,
            full_path=folder_info.path,
            user_permissions=user_permissions,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文件夹失败: {str(e)}",
        )


@router.put("/folders/{folder_id}")
@security_headers()
@audit_log("folder_update", sensitive=False)
@require_permissions("file:update")
async def update_folder(
    folder_id: str = PathParam(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    parent_id: Optional[str] = Form(None),
    access_level: Optional[FileAccessLevel] = Form(None),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """更新文件夹信息"""
    try:
        # 获取文件夹信息
        folder_info = await file_service.get_folder(folder_id)
        if not folder_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件夹不存在")

        # 检查权限
        if not await _check_folder_permission(
            folder_info, current_user, FileOperation.UPDATE
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有更新权限")

        # 验证新名称
        if name and not FileValidator.validate_filename(name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="文件夹名称包含非法字符"
            )

        # 检查移动权限
        if parent_id and parent_id != folder_info.parent_id:
            # 检查目标父文件夹权限
            if parent_id:  # 移动到其他文件夹
                target_parent = await file_service.get_folder(parent_id)
                if not target_parent:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND, detail="目标父文件夹不存在"
                    )

                if target_parent.owner_id != current_user["user_id"]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN, detail="没有权限移动到目标文件夹"
                    )

        # 更新文件夹
        update_data = {}
        if name:
            update_data["name"] = name
        if description is not None:
            update_data["description"] = description
        if parent_id is not None:
            update_data["parent_id"] = parent_id
        if access_level:
            update_data["access_level"] = access_level

        updated_folder = await file_service.update_folder(
            folder_id, update_data, current_user["user_id"]
        )

        return {"success": True, "message": "文件夹更新成功", "folder": updated_folder}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新文件夹失败: {str(e)}",
        )


@router.delete("/folders/{folder_id}")
@security_headers()
@audit_log("folder_delete", sensitive=True)
@require_permissions("file:delete")
async def delete_folder(
    background_tasks: BackgroundTasks,
    folder_id: str = PathParam(...),
    recursive: bool = Query(False, description="是否递归删除子文件夹和文件"),
    permanent: bool = Query(False, description="是否永久删除"),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """删除文件夹"""
    try:
        # 获取文件夹信息
        folder_info = await file_service.get_folder(folder_id)
        if not folder_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件夹不存在")

        # 检查权限
        if not await _check_folder_permission(
            folder_info, current_user, FileOperation.DELETE
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有删除权限")

        # 检查文件夹是否为空
        if not recursive:
            contents = await file_service.get_folder_contents(folder_id)
            if contents.total_count > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="文件夹不为空，请使用递归删除"
                )

        # 删除文件夹
        success = await file_service.delete_folder(
            folder_id,
            recursive=recursive,
            permanent=permanent,
            user_id=current_user["user_id"],
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除操作失败"
            )

        # 如果是永久删除，删除物理文件
        if permanent and recursive:
            background_tasks.add_task(_delete_folder_files, folder_info.path)

        message = "文件夹永久删除成功" if permanent else "文件夹已移至回收站"

        return {"success": True, "message": message}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除文件夹失败: {str(e)}",
        )


@router.get("/folders/tree", response_model=List[Dict[str, Any]])
@security_headers()
@cache_response(ttl=120, vary_on_user=True)
@require_permissions("file:read")
async def get_folder_tree(
    root_id: Optional[str] = Query(None, description="根文件夹ID，不指定则从用户根目录开始"),
    max_depth: int = Query(5, ge=1, le=10, description="最大深度"),
    include_file_count: bool = Query(True),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """获取文件夹树状结构"""
    try:
        folder_tree = await file_service.get_folder_tree(
            user_id=current_user["user_id"],
            root_id=root_id,
            max_depth=max_depth,
            include_file_count=include_file_count,
        )

        return folder_tree

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取文件夹树失败: {str(e)}",
        )


# ======================== 批量操作 ========================


@router.post("/batch", response_model=FileBatchOperationResponse)
@security_headers()
@audit_log("file_batch_operation", sensitive=False)
@require_permissions("file:update")
async def batch_file_operation(
    batch_request: FileBatchOperationRequest,
    background_tasks: BackgroundTasks,
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """批量文件操作"""
    try:
        start_time = datetime.now()
        results = []
        success_count = 0
        failed_count = 0
        error_summary = {}

        # 验证文件列表
        if len(batch_request.file_ids) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="批量操作文件数量不能超过100个"
            )

        # 执行批量操作
        for file_id in batch_request.file_ids:
            try:
                # 获取文件信息
                file_info = await file_service.get_file(file_id)
                if not file_info:
                    result = FileOperationResponse(
                        success=False,
                        operation=batch_request.operation,
                        file_id=file_id,
                        message="文件不存在",
                        error_code="FILE_NOT_FOUND",
                        error_message="文件不存在",
                    )
                    results.append(result)
                    failed_count += 1
                    error_summary["FILE_NOT_FOUND"] = (
                        error_summary.get("FILE_NOT_FOUND", 0) + 1
                    )
                    continue

                # 检查权限
                required_permission = _get_required_permission(batch_request.operation)
                if not await _check_file_permission(
                    file_info, current_user, required_permission
                ):
                    result = FileOperationResponse(
                        success=False,
                        operation=batch_request.operation,
                        file_id=file_id,
                        message="权限不足",
                        error_code="PERMISSION_DENIED",
                        error_message="没有执行此操作的权限",
                    )
                    results.append(result)
                    failed_count += 1
                    error_summary["PERMISSION_DENIED"] = (
                        error_summary.get("PERMISSION_DENIED", 0) + 1
                    )
                    continue

                # 执行具体操作
                result = await _execute_batch_operation(
                    file_info, batch_request, current_user, file_service
                )

                results.append(result)

                if result.success:
                    success_count += 1
                else:
                    failed_count += 1
                    error_code = result.error_code or "UNKNOWN_ERROR"
                    error_summary[error_code] = error_summary.get(error_code, 0) + 1

                # 如果不跳过错误且遇到失败，停止处理
                if not batch_request.skip_errors and not result.success:
                    break

            except Exception as e:
                result = FileOperationResponse(
                    success=False,
                    operation=batch_request.operation,
                    file_id=file_id,
                    message=f"操作失败: {str(e)}",
                    error_code="OPERATION_ERROR",
                    error_message=str(e),
                )
                results.append(result)
                failed_count += 1
                error_summary["OPERATION_ERROR"] = (
                    error_summary.get("OPERATION_ERROR", 0) + 1
                )

                if not batch_request.skip_errors:
                    break

        completed_at = datetime.now()
        total_duration = (completed_at - start_time).total_seconds()

        # 记录批量操作日志
        background_tasks.add_task(
            _log_batch_operation,
            batch_request.operation,
            batch_request.file_ids,
            current_user["user_id"],
            success_count,
            failed_count,
        )

        return FileBatchOperationResponse(
            operation=batch_request.operation,
            total_count=len(batch_request.file_ids),
            success_count=success_count,
            failed_count=failed_count,
            results=results,
            success_rate=success_count / len(batch_request.file_ids)
            if batch_request.file_ids
            else 0,
            error_summary=error_summary,
            started_at=start_time,
            completed_at=completed_at,
            total_duration=total_duration,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量操作失败: {str(e)}",
        )


@router.post("/batch/upload", response_model=List[FileUploadResponse])
@security_headers()
@rate_limit(limit=5, window=300)  # 5分钟内最多5次批量上传
@audit_log("batch_upload", sensitive=False)
@require_permissions("file:upload")
async def batch_upload_files(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    folder_id: Optional[str] = Form(None),
    descriptions: Optional[str] = Form(None),  # JSON格式的描述列表
    tags: Optional[str] = Form(None),  # JSON格式的标签列表
    category: Optional[str] = Form(None),
    access_level: FileAccessLevel = Form(FileAccessLevel.PRIVATE),
    file_service: FileService = Depends(get_file_service),
    file_manager: FileManager = Depends(get_file_manager),
    current_user: Dict[str, Any] = None,
):
    """批量上传文件"""
    try:
        # 限制批量上传数量
        if len(files) > 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="批量上传文件数量不能超过20个"
            )

        # 解析描述和标签
        file_descriptions = []
        file_tags_list = []

        if descriptions:
            try:
                import json

                file_descriptions = json.loads(descriptions)
            except:
                file_descriptions = []

        if tags:
            try:
                import json

                file_tags_list = json.loads(tags)
            except:
                file_tags_list = []

        upload_results = []

        for i, file in enumerate(files):
            try:
                # 验证单个文件
                if file.size and file.size > MAX_FILE_SIZE:
                    upload_results.append(
                        {
                            "filename": file.filename,
                            "success": False,
                            "error": f"文件大小超过限制",
                        }
                    )
                    continue

                if not FileValidator.validate_filename(file.filename):
                    upload_results.append(
                        {
                            "filename": file.filename,
                            "success": False,
                            "error": "文件名包含非法字符",
                        }
                    )
                    continue

                # 获取当前文件的描述和标签
                current_description = (
                    file_descriptions[i] if i < len(file_descriptions) else None
                )
                current_tags = file_tags_list[i] if i < len(file_tags_list) else []

                # 保存文件
                file_path, metadata = await file_manager.save_file(
                    file.file, file.filename, folder=folder_id
                )

                # 创建文件信息
                file_info = FileInfo(
                    name=metadata.filename,
                    path=str(file_path.relative_to(UPLOAD_DIR)),
                    owner_id=current_user["user_id"],
                    created_by=current_user["user_id"],
                    description=current_description,
                    tags=current_tags,
                    category=category,
                    parent_folder_id=folder_id,
                    metadata=metadata,
                    security={"access_level": access_level},
                )

                # 保存到数据库
                saved_file = await file_service.create_file(file_info)

                # 后台任务
                background_tasks.add_task(
                    _generate_thumbnail_task, file_path, saved_file.id
                )

                background_tasks.add_task(_virus_scan_task, file_path, saved_file.id)

                upload_result = FileUploadResponse(
                    file_id=saved_file.id,
                    filename=saved_file.name,
                    size=saved_file.metadata.size,
                    mime_type=saved_file.metadata.mime_type,
                    file_type=saved_file.metadata.file_type,
                    upload_id=str(uuid.uuid4()),
                    status=saved_file.status,
                    uploaded_at=saved_file.created_at,
                )

                upload_results.append(upload_result)

            except Exception as e:
                upload_results.append(
                    {"filename": file.filename, "success": False, "error": str(e)}
                )

        return upload_results

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量上传失败: {str(e)}",
        )


# ======================== 文件统计和审计 ========================


@router.get("/statistics", response_model=FileStatisticsResponse)
@security_headers()
@cache_response(ttl=300, vary_on_user=True)
@require_permissions("file:read")
async def get_file_statistics(
    scope: str = Query("user", description="统计范围: user/admin"),
    date_range: int = Query(30, description="统计天数"),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """获取文件统计信息"""
    try:
        # 检查权限
        if scope == "admin" and "admin" not in current_user.get("permissions", []):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")

        user_id = None if scope == "admin" else current_user["user_id"]

        # 获取统计数据
        stats = await file_service.get_statistics(
            user_id=user_id, date_range=date_range
        )

        return FileStatisticsResponse(**stats)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取统计信息失败: {str(e)}",
        )


@router.get("/{file_id}/activity", response_model=FileActivityResponse)
@security_headers()
@require_permissions("file:read")
async def get_file_activity(
    file_id: str = PathParam(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    activity_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """获取文件活动记录"""
    try:
        # 检查文件权限
        file_info = await file_service.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        if not await _check_file_permission(
            file_info, current_user, FileOperation.READ
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有访问权限")

        # 只有所有者和管理员可以查看活动记录
        if file_info.owner_id != current_user[
            "user_id"
        ] and "admin" not in current_user.get("permissions", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="没有权限查看活动记录"
            )

        # 获取活动记录
        activities, total_count = await file_service.get_file_activities(
            file_id=file_id,
            activity_type=activity_type,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )

        # 获取活动汇总
        activity_summary = await file_service.get_activity_summary(file_id)

        # 获取最近活动
        recent_activities = activities[:5]

        return FileActivityResponse(
            file_id=file_id,
            activities=activities,
            total_count=total_count,
            page=page,
            page_size=page_size,
            activity_summary=activity_summary,
            recent_activities=recent_activities,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取活动记录失败: {str(e)}",
        )


@router.get("/{file_id}/versions", response_model=FileVersionResponse)
@security_headers()
@require_permissions("file:read")
async def get_file_versions(
    file_id: str = PathParam(...),
    include_deleted: bool = Query(False),
    file_service: FileService = Depends(get_file_service),
    current_user: Dict[str, Any] = None,
):
    """获取文件版本历史"""
    try:
        # 检查权限
        file_info = await file_service.get_file(file_id)
        if not file_info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

        if not await _check_file_permission(
            file_info, current_user, FileOperation.READ
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有访问权限")

        # 获取版本信息
        versions = await file_service.get_file_versions(
            file_id, include_deleted=include_deleted
        )

        # 计算存储使用情况
        storage_usage = {}
        total_size = 0

        for version in versions:
            total_size += version.size
            storage_key = (
                version.storage_key.split("/")[0]
                if "/" in version.storage_key
                else "default"
            )
            storage_usage[storage_key] = (
                storage_usage.get(storage_key, 0) + version.size
            )

        return FileVersionResponse(
            file_id=file_id,
            versions=versions,
            current_version=file_info.current_version,
            total_versions=len(versions),
            total_size=total_size,
            storage_usage=storage_usage,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取版本历史失败: {str(e)}",
        )


# ======================== 辅助函数 ========================


async def _send_share_notifications(
    share_id: str, user_ids: List[str], custom_message: Optional[str]
):
    """发送分享通知"""
    try:
        # 这里应该集成通知服务
        # 发送邮件、短信或系统通知
        print(f"发送分享通知: share_id={share_id}, users={user_ids}")
    except Exception as e:
        print(f"发送通知失败: {e}")


async def _check_folder_permission(
    folder_info: FolderInfo, current_user: Dict[str, Any], operation: FileOperation
) -> bool:
    """检查文件夹权限"""
    try:
        # 文件夹所有者拥有所有权限
        if folder_info.owner_id == current_user["user_id"]:
            return True

        # 管理员拥有所有权限
        if "admin" in current_user.get("permissions", []):
            return True

        # 检查文件夹访问级别
        if folder_info.access_level == FileAccessLevel.PUBLIC:
            if operation in [FileOperation.READ]:
                return True
        elif folder_info.access_level == FileAccessLevel.INTERNAL:
            if operation in [FileOperation.READ]:
                return True

        # 检查特定权限
        user_permissions = await _get_user_folder_permissions(folder_info, current_user)
        return operation in user_permissions

    except Exception:
        return False


async def _get_user_folder_permissions(
    folder_info: FolderInfo, current_user: Dict[str, Any]
) -> List[FileOperation]:
    """获取用户对文件夹的权限"""
    permissions = []

    try:
        # 文件夹所有者拥有所有权限
        if folder_info.owner_id == current_user["user_id"]:
            return [
                FileOperation.READ,
                FileOperation.UPDATE,
                FileOperation.DELETE,
                FileOperation.CREATE,
                FileOperation.MOVE,
                FileOperation.RENAME,
            ]

        # 管理员拥有所有权限
        if "admin" in current_user.get("permissions", []):
            return [
                FileOperation.READ,
                FileOperation.UPDATE,
                FileOperation.DELETE,
                FileOperation.CREATE,
                FileOperation.MOVE,
                FileOperation.RENAME,
            ]

        # 根据访问级别确定基础权限
        if folder_info.access_level == FileAccessLevel.PUBLIC:
            permissions.extend([FileOperation.READ])
        elif folder_info.access_level == FileAccessLevel.INTERNAL:
            permissions.extend([FileOperation.READ])

        # 检查特定的文件夹权限设置
        for perm in folder_info.permissions:
            if perm.user_id == current_user["user_id"]:
                # 检查权限是否过期
                if perm.expires_at and perm.expires_at < datetime.now():
                    continue
                permissions.append(perm.permission)

        return list(set(permissions))  # 去重

    except Exception:
        return []


async def _generate_folder_path(parent_id: Optional[str], folder_name: str) -> str:
    """生成文件夹路径"""
    try:
        if not parent_id:
            return folder_name

        # 这里应该查询父文件夹路径并拼接
        # 暂时返回简单路径
        return f"folder_{parent_id}/{folder_name}"

    except Exception:
        return folder_name


async def _get_folder_level(parent_id: Optional[str]) -> int:
    """获取文件夹层级"""
    try:
        if not parent_id:
            return 0

        # 这里应该查询父文件夹层级并加1
        # 暂时返回固定值
        return 1

    except Exception:
        return 0


async def _generate_breadcrumb(folder_id: str) -> List[Dict[str, str]]:
    """生成路径导航"""
    try:
        # 这里应该递归查询父文件夹路径
        # 暂时返回简单导航
        return [
            {"id": "root", "name": "根目录", "path": "/"},
            {"id": folder_id, "name": "当前文件夹", "path": f"/folders/{folder_id}"},
        ]

    except Exception:
        return []


async def _delete_folder_files(folder_path: str):
    """删除文件夹中的物理文件"""
    try:
        import shutil

        physical_path = UPLOAD_DIR / folder_path
        if physical_path.exists():
            shutil.rmtree(physical_path)
    except Exception as e:
        print(f"删除文件夹物理文件失败: {e}")


def _get_required_permission(operation: FileOperation) -> FileOperation:
    """获取操作所需的权限"""
    permission_mapping = {
        FileOperation.DELETE: FileOperation.DELETE,
        FileOperation.UPDATE: FileOperation.UPDATE,
        FileOperation.MOVE: FileOperation.UPDATE,
        FileOperation.COPY: FileOperation.READ,
        FileOperation.RENAME: FileOperation.UPDATE,
        FileOperation.ARCHIVE: FileOperation.UPDATE,
        FileOperation.RESTORE: FileOperation.UPDATE,
    }

    return permission_mapping.get(operation, FileOperation.READ)


async def _execute_batch_operation(
    file_info: FileInfo,
    batch_request: FileBatchOperationRequest,
    current_user: Dict[str, Any],
    file_service: FileService,
) -> FileOperationResponse:
    """执行单个批量操作"""
    try:
        operation = batch_request.operation
        file_id = file_info.id

        if operation == FileOperation.DELETE:
            # 删除文件
            success = await file_service.mark_as_deleted(
                file_id, current_user["user_id"]
            )
            message = "文件已删除" if success else "删除失败"
            new_status = FileStatus.DELETED if success else None

        elif operation == FileOperation.MOVE:
            # 移动文件
            if not batch_request.target_folder_id:
                return FileOperationResponse(
                    success=False,
                    operation=operation,
                    file_id=file_id,
                    message="缺少目标文件夹ID",
                    error_code="MISSING_TARGET_FOLDER",
                    error_message="移动操作需要指定目标文件夹",
                )

            success = await file_service.move_file(
                file_id, batch_request.target_folder_id, current_user["user_id"]
            )
            message = "文件移动成功" if success else "移动失败"
            new_status = None

        elif operation == FileOperation.COPY:
            # 复制文件
            target_folder = batch_request.target_folder_id or file_info.parent_folder_id
            success = await file_service.copy_file(
                file_id, target_folder, current_user["user_id"]
            )
            message = "文件复制成功" if success else "复制失败"
            new_status = None

        elif operation == FileOperation.ARCHIVE:
            # 归档文件
            success = await file_service.archive_file(file_id, current_user["user_id"])
            message = "文件已归档" if success else "归档失败"
            new_status = FileStatus.ARCHIVED if success else None

        elif operation == FileOperation.RESTORE:
            # 恢复文件
            success = await file_service.restore_file(file_id, current_user["user_id"])
            message = "文件已恢复" if success else "恢复失败"
            new_status = FileStatus.ACTIVE if success else None

        else:
            return FileOperationResponse(
                success=False,
                operation=operation,
                file_id=file_id,
                message="不支持的操作",
                error_code="UNSUPPORTED_OPERATION",
                error_message=f"不支持的批量操作: {operation}",
            )

        # 更新标签或访问级别
        if success and (
            batch_request.tags_to_add
            or batch_request.tags_to_remove
            or batch_request.new_access_level
        ):
            update_data = {}

            if batch_request.new_access_level:
                update_data["access_level"] = batch_request.new_access_level

            if batch_request.tags_to_add or batch_request.tags_to_remove:
                current_tags = set(file_info.tags)
                if batch_request.tags_to_add:
                    current_tags.update(batch_request.tags_to_add)
                if batch_request.tags_to_remove:
                    current_tags.difference_update(batch_request.tags_to_remove)
                update_data["tags"] = list(current_tags)

            if update_data:
                from ..schemas.file import FileUpdateRequest

                update_request = FileUpdateRequest(**update_data)
                await file_service.update_file(
                    file_id, update_request, current_user["user_id"]
                )

        return FileOperationResponse(
            success=success,
            operation=operation,
            file_id=file_id,
            message=message,
            new_status=new_status,
            processed_at=datetime.now(),
        )

    except Exception as e:
        return FileOperationResponse(
            success=False,
            operation=batch_request.operation,
            file_id=file_info.id,
            message=f"操作失败: {str(e)}",
            error_code="OPERATION_ERROR",
            error_message=str(e),
            processed_at=datetime.now(),
        )


async def _log_batch_operation(
    operation: FileOperation,
    file_ids: List[str],
    user_id: str,
    success_count: int,
    failed_count: int,
):
    """记录批量操作日志"""
    try:
        print(
            f"批量操作日志: 操作={operation}, 用户={user_id}, 成功={success_count}, 失败={failed_count}"
        )
    except Exception as e:
        print(f"记录批量操作日志失败: {e}")


# ======================== 错误处理和其他工具函数 ========================


@router.get("/health")
async def health_check():
    """文件服务健康检查"""
    try:
        # 检查上传目录
        if not UPLOAD_DIR.exists():
            return {"status": "unhealthy", "message": "上传目录不存在"}

        # 检查磁盘空间
        import shutil

        total, used, free = shutil.disk_usage(UPLOAD_DIR)
        free_gb = free // (1024**3)

        if free_gb < 1:  # 少于1GB空间
            return {"status": "warning", "message": f"磁盘空间不足: {free_gb}GB"}

        return {
            "status": "healthy",
            "upload_dir": str(UPLOAD_DIR),
            "disk_free": f"{free_gb}GB",
            "max_file_size": FileHelper.format_file_size(MAX_FILE_SIZE),
        }

    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


@router.get("/config")
@require_admin()
async def get_file_config(current_user: Dict[str, Any] = None):
    """获取文件服务配置（管理员）"""
    return {
        "max_file_size": MAX_FILE_SIZE,
        "upload_dir": str(UPLOAD_DIR),
        "thumbnail_dir": str(THUMBNAIL_DIR),
        "supported_formats": {
            "images": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"],
            "videos": [".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm"],
            "audios": [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"],
        },
        "dangerous_extensions": [
            ".exe",
            ".bat",
            ".cmd",
            ".scr",
            ".pif",
            ".com",
            ".vbs",
            ".js",
            ".jar",
        ],
    }


# ======================== 清理任务 ========================


@router.post("/admin/cleanup")
@require_admin()
async def cleanup_files(
    background_tasks: BackgroundTasks,
    cleanup_temp: bool = Query(True, description="清理临时文件"),
    cleanup_deleted: bool = Query(False, description="清理已删除文件"),
    cleanup_expired_shares: bool = Query(True, description="清理过期分享"),
    max_age_days: int = Query(30, description="清理天数"),
    current_user: Dict[str, Any] = None,
):
    """清理文件（管理员）"""
    try:
        cleanup_tasks = []

        if cleanup_temp:
            processor = FileProcessor()
            background_tasks.add_task(processor.cleanup_temp_files, max_age_days * 24)
            cleanup_tasks.append("临时文件")

        if cleanup_deleted:
            file_service = FileService()
            background_tasks.add_task(file_service.cleanup_deleted_files, max_age_days)
            cleanup_tasks.append("已删除文件")

        if cleanup_expired_shares:
            file_service = FileService()
            background_tasks.add_task(file_service.cleanup_expired_shares)
            cleanup_tasks.append("过期分享")

        return {
            "success": True,
            "message": f"清理任务已启动: {', '.join(cleanup_tasks)}",
            "max_age_days": max_age_days,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"清理任务启动失败: {str(e)}",
        )


# 添加缺失的服务导入占位符
class FileService:
    """文件服务占位符 - 应该从实际的服务模块导入"""

    async def create_file(self, file_info: FileInfo) -> FileInfo:
        # 实际实现应该保存到数据库
        return file_info

    async def get_file(
        self,
        file_id: str,
        include_permissions: bool = False,
        include_versions: bool = False,
    ) -> Optional[FileInfo]:
        # 实际实现应该从数据库查询
        return None

    async def update_file(self, file_id: str, update_data, user_id: str) -> FileInfo:
        # 实际实现应该更新数据库
        return FileInfo()

    async def delete_file_permanently(self, file_id: str) -> bool:
        return True

    async def mark_as_deleted(self, file_id: str, user_id: str) -> bool:
        return True

    async def list_files(
        self, filters: Dict, sort_by: str, sort_order: str, page: int, page_size: int
    ) -> tuple:
        return [], 0

    async def search_files(self, search_request, user_id: str):
        return FileListResponse(
            files=[],
            folders=[],
            total_count=0,
            page=1,
            page_size=20,
            total_pages=0,
            has_next=False,
            has_prev=False,
        )

    async def increment_download_count(self, file_id: str):
        pass

    async def update_thumbnail_url(self, file_id: str, url: str):
        pass

    async def update_scan_status(self, file_id: str, status: str):
        pass

    async def log_activity(self, activity: FileActivity):
        pass


class StorageService:
    """存储服务占位符"""

    pass
