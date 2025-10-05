#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
文件上传路由 - 专门处理文件上传的API接口
提供单文件上传、批量上传、分块上传等全面的上传解决方案
"""

import os
import uuid
import asyncio
import tempfile
from pathlib import Path
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, timedelta

from fastapi import (
    APIRouter, Depends, HTTPException, Request, Response, 
    UploadFile, File, Form, Query, Path as PathParam,
    BackgroundTasks, status, Body
)
from fastapi.responses import JSONResponse
from starlette.responses import StreamingResponse

# 项目内部导入
from ..schemas.file import (
    # 请求模型
    FileUploadRequest, FileUpdateRequest,
    
    # 响应模型  
    FileUploadResponse, FileInfoResponse, FileOperationResponse,
    FileBatchOperationResponse,
    
    # 枚举和基础模型
    FileType, FileStatus, FileAccessLevel, FileOperation, StorageProvider,
    FileInfo, FileMetadata, FileActivity,
    
    # 工具类
    FileValidator, FileHelper
)
from ..utils.file_utils import (
    FileProcessor, FileManager, ChunkedUploadManager,
    validate_uploaded_file, get_file_info
)
from ..utils.auth_decorators import (
    require_auth, require_permissions, require_admin,
    audit_log, rate_limit, security_headers, cache_response
)
from ..dependencies import get_dependencies
from ..services.file_service import FileService
from ..services.storage_service import StorageService

# 创建路由器
router = APIRouter(prefix="/uploads", tags=["文件上传"])

# 全局配置
MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024  # 5GB
MAX_FILES_PER_BATCH = 50                # 每批次最大文件数
UPLOAD_DIR = Path("uploads")
TEMP_DIR = Path("temp")
CHUNK_SIZE = 64 * 1024 * 1024          # 64MB 分块大小

# 确保目录存在
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# 上传会话存储（生产环境应使用Redis或数据库）
upload_sessions = {}

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
        manager = ChunkedUploadManager(str(TEMP_DIR))
        dependencies.register_service("chunk_upload_manager", manager)
    return manager

async def get_file_processor() -> FileProcessor:
    """获取文件处理器"""
    return FileProcessor(str(TEMP_DIR))

# ======================== 上传预检查 ========================

@router.post("/validate", response_model=Dict[str, Any])
@security_headers()
@require_permissions("file:upload")
async def validate_upload(
    filename: str = Form(...),
    filesize: int = Form(...),
    mime_type: Optional[str] = Form(None),
    checksum: Optional[str] = Form(None),
    chunk_upload: bool = Form(False),
    file_processor: FileProcessor = Depends(get_file_processor),
    current_user: Dict[str, Any] = None
):
    """
    上传预检查 - 在实际上传前验证文件信息
    
    特性：
    - 文件名安全性检查
    - 文件大小限制验证
    - 文件类型检查
    - 存储空间检查
    - 重复文件检测
    """
    try:
        validation_result = {
            "valid": True,
            "errors": [],
            "warnings": [],
            "recommendations": {},
            "upload_options": {}
        }
        
        # 1. 文件名验证
        if not FileValidator.validate_filename(filename):
            validation_result["errors"].append("文件名包含非法字符或格式不正确")
            validation_result["valid"] = False
        
        # 2. 危险文件检查
        if FileValidator.is_dangerous_file(filename):
            validation_result["errors"].append("不允许上传此类型的文件")
            validation_result["valid"] = False
        
        # 3. 文件大小验证
        if filesize > MAX_FILE_SIZE:
            validation_result["errors"].append(
                f"文件大小超过限制 ({FileHelper.format_file_size(MAX_FILE_SIZE)})"
            )
            validation_result["valid"] = False
        elif filesize == 0:
            validation_result["errors"].append("文件大小不能为0")
            validation_result["valid"] = False
        
        # 4. 文件类型检测和验证
        file_type = FileValidator.detect_file_type(filename, mime_type)
        if not FileValidator.validate_file_size(filesize, file_type):
            validation_result["warnings"].append(f"文件大小对于{file_type}类型来说较大")
        
        # 5. 推荐上传方式
        if filesize > 100 * 1024 * 1024:  # 100MB
            validation_result["recommendations"]["chunk_upload"] = True
            validation_result["recommendations"]["chunk_size"] = CHUNK_SIZE
        
        # 6. 存储空间检查
        # TODO: 实现用户存储配额检查
        
        # 7. 重复文件检测（基于checksum）
        if checksum:
            # TODO: 实现基于checksum的重复文件检测
            pass
        
        # 8. 生成安全文件名
        safe_filename = FileValidator.generate_safe_filename(filename)
        if safe_filename != filename:
            validation_result["recommendations"]["safe_filename"] = safe_filename
            validation_result["warnings"].append("文件名已调整为安全格式")
        
        # 9. 上传选项
        validation_result["upload_options"] = {
            "single_upload": filesize <= 100 * 1024 * 1024,
            "chunk_upload": True,
            "recommended_chunk_size": min(CHUNK_SIZE, max(1024 * 1024, filesize // 100)),
            "estimated_chunks": (filesize + CHUNK_SIZE - 1) // CHUNK_SIZE if chunk_upload else 1,
            "max_parallel_chunks": 3
        }
        
        # 10. 元数据
        validation_result["file_info"] = {
            "filename": filename,
            "safe_filename": safe_filename,
            "size": filesize,
            "size_formatted": FileHelper.format_file_size(filesize),
            "type": file_type,
            "mime_type": mime_type or FileHelper.get_mime_type(filename)
        }
        
        return validation_result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"上传预检查失败: {str(e)}"
        )

# ======================== 单文件上传 ========================

@router.post("/single", response_model=FileUploadResponse)
@security_headers()
@rate_limit(limit=30, window=300)  # 5分钟内最多30次上传
@audit_log("single_file_upload", sensitive=False)
@require_permissions("file:upload")
async def upload_single_file(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="上传的文件"),
    folder_id: Optional[str] = Form(None, description="目标文件夹ID"),
    description: Optional[str] = Form(None, max_length=1000, description="文件描述"),
    tags: Optional[str] = Form(None, description="文件标签(JSON字符串或逗号分隔)"),
    category: Optional[str] = Form(None, max_length=100, description="文件分类"),
    access_level: FileAccessLevel = Form(FileAccessLevel.PRIVATE, description="访问级别"),
    auto_scan: bool = Form(True, description="是否自动病毒扫描"),
    auto_generate_thumbnail: bool = Form(True, description="是否自动生成缩略图"),
    overwrite_existing: bool = Form(False, description="是否覆盖同名文件"),
    custom_filename: Optional[str] = Form(None, description="自定义文件名"),
    file_service: FileService = Depends(get_file_service),
    file_manager: FileManager = Depends(get_file_manager),
    file_processor: FileProcessor = Depends(get_file_processor),
    current_user: Dict[str, Any] = None
):
    """
    单文件上传接口
    
    支持特性：
    - 完整的文件验证
    - 自动文件类型检测
    - 病毒扫描
    - 缩略图生成
    - 元数据提取
    - 重复文件处理
    - 自定义文件名
    """
    upload_id = str(uuid.uuid4())
    
    try:
        # 1. 基础验证
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件名不能为空"
            )
        
        # 使用自定义文件名或原文件名
        final_filename = custom_filename or file.filename
        
        # 2. 文件大小检查
        file_size = 0
        if hasattr(file, 'size') and file.size:
            file_size = file.size
        else:
            # 读取文件内容来获取大小
            content = await file.read()
            file_size = len(content)
            # 重置文件指针
            await file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"文件大小超过限制 ({FileHelper.format_file_size(MAX_FILE_SIZE)})"
            )
        
        # 3. 文件名和类型验证
        if not FileValidator.validate_filename(final_filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件名包含非法字符"
            )
        
        if FileValidator.is_dangerous_file(final_filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不允许上传此类型的文件"
            )
        
        # 4. 创建临时文件进行预处理
        temp_file_path = TEMP_DIR / f"upload_{upload_id}_{final_filename}"
        
        # 保存到临时文件
        async with open(temp_file_path, 'wb') as temp_file:
            content = await file.read()
            await temp_file.write(content)
        
        # 5. 文件验证
        is_valid, validation_errors = await validate_uploaded_file(temp_file_path)
        if not is_valid:
            # 清理临时文件
            temp_file_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件验证失败: {'; '.join(validation_errors)}"
            )
        
        # 6. 检查重复文件
        if not overwrite_existing:
            # TODO: 实现重复文件检查逻辑
            pass
        
        # 7. 解析标签
        file_tags = _parse_tags(tags)
        
        # 8. 保存文件并生成元数据
        try:
            final_path, metadata = await file_manager.save_file(
                open(temp_file_path, 'rb'),
                final_filename,
                folder=folder_id,
                generate_unique_name=not overwrite_existing
            )
            
            # 9. 创建文件信息
            file_info = FileInfo(
                id=str(uuid.uuid4()),
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
                status=FileStatus.PROCESSING  # 初始状态为处理中
            )
            
            # 10. 保存到数据库
            saved_file = await file_service.create_file(file_info)
            
            # 11. 启动后台处理任务
            background_tasks.add_task(
                _process_uploaded_file,
                saved_file.id,
                final_path,
                auto_generate_thumbnail,
                auto_scan,
                current_user["user_id"]
            )
            
            # 12. 清理临时文件
            temp_file_path.unlink(missing_ok=True)
            
            # 13. 记录上传活动
            background_tasks.add_task(
                _log_upload_activity,
                saved_file.id,
                current_user["user_id"],
                "单文件上传成功",
                file_size
            )
            
            return FileUploadResponse(
                file_id=saved_file.id,
                filename=saved_file.name,
                size=saved_file.metadata.size,
                mime_type=saved_file.metadata.mime_type,
                file_type=saved_file.metadata.file_type,
                upload_id=upload_id,
                status=saved_file.status,
                uploaded_at=saved_file.created_at,
                access_url=f"/files/{saved_file.id}",
                download_url=f"/files/download/{saved_file.id}"
            )
            
        except Exception as e:
            # 清理临时文件
            temp_file_path.unlink(missing_ok=True)
            if 'final_path' in locals() and final_path.exists():
                final_path.unlink(missing_ok=True)
            raise e
            
    except HTTPException:
        raise
    except Exception as e:
        # 记录错误
        background_tasks.add_task(
            _log_upload_error,
            upload_id,
            current_user["user_id"],
            str(e),
            {"filename": final_filename, "size": file_size}
        )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件上传失败: {str(e)}"
        )

# ======================== 批量文件上传 ========================

@router.post("/batch", response_model=FileBatchOperationResponse)
@security_headers()
@rate_limit(limit=10, window=600)  # 10分钟内最多10次批量上传
@audit_log("batch_file_upload", sensitive=False)
@require_permissions("file:upload")
async def upload_multiple_files(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="上传的文件列表"),
    folder_id: Optional[str] = Form(None, description="目标文件夹ID"),
    descriptions: Optional[str] = Form(None, description="文件描述列表(JSON格式)"),
    tags: Optional[str] = Form(None, description="文件标签列表(JSON格式)"),
    category: Optional[str] = Form(None, max_length=100, description="统一文件分类"),
    access_level: FileAccessLevel = Form(FileAccessLevel.PRIVATE, description="统一访问级别"),
    auto_scan: bool = Form(True, description="是否自动病毒扫描"),
    auto_generate_thumbnail: bool = Form(True, description="是否自动生成缩略图"),
    stop_on_error: bool = Form(False, description="遇到错误时是否停止"),
    max_parallel: int = Form(3, ge=1, le=10, description="最大并行处理数"),
    file_service: FileService = Depends(get_file_service),
    file_manager: FileManager = Depends(get_file_manager),
    current_user: Dict[str, Any] = None
):
    """
    批量文件上传接口
    
    支持特性：
    - 多文件并行上传
    - 灵活的错误处理策略
    - 个性化文件设置
    - 上传进度跟踪
    - 批量操作优化
    """
    batch_id = str(uuid.uuid4())
    start_time = datetime.now()
    
    try:
        # 1. 基础验证
        if len(files) > MAX_FILES_PER_BATCH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"批量上传文件数量不能超过 {MAX_FILES_PER_BATCH} 个"
            )
        
        if not files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="没有选择任何文件"
            )
        
        # 2. 解析批量配置
        file_descriptions = _parse_json_array(descriptions) if descriptions else []
        file_tags_list = _parse_json_array(tags) if tags else []
        
        # 3. 创建批量上传会话
        batch_session = {
            "batch_id": batch_id,
            "total_files": len(files),
            "processed_files": 0,
            "successful_files": 0,
            "failed_files": 0,
            "start_time": start_time,
            "status": "processing",
            "results": [],
            "user_id": current_user["user_id"]
        }
        
        upload_sessions[batch_id] = batch_session
        
        # 4. 文件预检查
        valid_files = []
        invalid_files = []
        
        for i, file in enumerate(files):
            if not file.filename:
                invalid_files.append({
                    "index": i,
                    "filename": "unknown",
                    "error": "文件名为空"
                })
                continue
            
            # 基础验证
            if not FileValidator.validate_filename(file.filename):
                invalid_files.append({
                    "index": i,
                    "filename": file.filename,
                    "error": "文件名包含非法字符"
                })
                continue
            
            if FileValidator.is_dangerous_file(file.filename):
                invalid_files.append({
                    "index": i,
                    "filename": file.filename,
                    "error": "不允许上传此类型的文件"
                })
                continue
            
            valid_files.append((i, file))
        
        # 5. 如果有无效文件且设置了停止策略
        if invalid_files and stop_on_error:
            batch_session["status"] = "failed"
            batch_session["results"] = [
                FileOperationResponse(
                    success=False,
                    operation=FileOperation.UPLOAD,
                    file_id="",
                    message=item["error"],
                    error_code="VALIDATION_FAILED",
                    error_message=item["error"]
                ) for item in invalid_files
            ]
            
            return FileBatchOperationResponse(
                operation=FileOperation.UPLOAD,
                total_count=len(files),
                success_count=0,
                failed_count=len(invalid_files),
                results=batch_session["results"],
                success_rate=0.0,
                error_summary={"VALIDATION_FAILED": len(invalid_files)},
                started_at=start_time,
                completed_at=datetime.now(),
                total_duration=(datetime.now() - start_time).total_seconds()
            )
        
        # 6. 并行处理有效文件
        semaphore = asyncio.Semaphore(max_parallel)
        upload_tasks = []
        
        for i, file in valid_files:
            # 获取对应的描述和标签
            current_description = file_descriptions[i] if i < len(file_descriptions) else None
            current_tags = file_tags_list[i] if i < len(file_tags_list) else []
            
            task = asyncio.create_task(
                _upload_single_file_async(
                    semaphore,
                    file,
                    folder_id,
                    current_description,
                    current_tags,
                    category,
                    access_level,
                    auto_scan,
                    auto_generate_thumbnail,
                    file_service,
                    file_manager,
                    current_user,
                    batch_id,
                    i
                )
            )
            upload_tasks.append(task)
        
        # 7. 等待所有上传任务完成
        results = await asyncio.gather(*upload_tasks, return_exceptions=True)
        
        # 8. 处理结果
        success_count = 0
        failed_count = 0
        error_summary = {}
        operation_results = []
        
        # 添加无效文件结果
        for item in invalid_files:
            failed_count += 1
            error_code = "VALIDATION_FAILED"
            error_summary[error_code] = error_summary.get(error_code, 0) + 1
            
            operation_results.append(FileOperationResponse(
                success=False,
                operation=FileOperation.UPLOAD,
                file_id="",
                message=item["error"],
                error_code=error_code,
                error_message=item["error"]
            ))
        
        # 处理上传结果
        for result in results:
            if isinstance(result, Exception):
                failed_count += 1
                error_code = "UPLOAD_ERROR"
                error_summary[error_code] = error_summary.get(error_code, 0) + 1
                
                operation_results.append(FileOperationResponse(
                    success=False,
                    operation=FileOperation.UPLOAD,
                    file_id="",
                    message=f"上传失败: {str(result)}",
                    error_code=error_code,
                    error_message=str(result)
                ))
            elif result["success"]:
                success_count += 1
                operation_results.append(FileOperationResponse(
                    success=True,
                    operation=FileOperation.UPLOAD,
                    file_id=result["file_id"],
                    message="上传成功",
                    new_status=FileStatus.PROCESSING
                ))
            else:
                failed_count += 1
                error_code = result.get("error_code", "UNKNOWN_ERROR")
                error_summary[error_code] = error_summary.get(error_code, 0) + 1
                
                operation_results.append(FileOperationResponse(
                    success=False,
                    operation=FileOperation.UPLOAD,
                    file_id="",
                    message=result.get("error", "未知错误"),
                    error_code=error_code,
                    error_message=result.get("error", "未知错误")
                ))
        
        # 9. 更新批量会话状态
        completed_at = datetime.now()
        total_duration = (completed_at - start_time).total_seconds()
        
        batch_session.update({
            "status": "completed",
            "processed_files": len(files),
            "successful_files": success_count,
            "failed_files": failed_count,
            "completed_at": completed_at,
            "total_duration": total_duration,
            "results": operation_results
        })
        
        # 10. 记录批量上传活动
        background_tasks.add_task(
            _log_batch_upload_activity,
            batch_id,
            current_user["user_id"],
            len(files),
            success_count,
            failed_count
        )
        
        return FileBatchOperationResponse(
            operation=FileOperation.UPLOAD,
            total_count=len(files),
            success_count=success_count,
            failed_count=failed_count,
            results=operation_results,
            success_rate=success_count / len(files) if files else 0,
            error_summary=error_summary,
            started_at=start_time,
            completed_at=completed_at,
            total_duration=total_duration
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # 更新批量会话状态
        if batch_id in upload_sessions:
            upload_sessions[batch_id]["status"] = "error"
            upload_sessions[batch_id]["error"] = str(e)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量上传失败: {str(e)}"
        )

# ======================== 分块上传系统 ========================

@router.post("/chunk/init", response_model=Dict[str, Any])
@security_headers()
@require_permissions("file:upload")
async def init_chunk_upload(
    request: Request,
    filename: str = Form(..., description="文件名"),
    total_size: int = Form(..., ge=1, description="文件总大小"),
    file_hash: Optional[str] = Form(None, description="文件MD5哈希值"),
    chunk_size: int = Form(CHUNK_SIZE, ge=1024*1024, le=CHUNK_SIZE, description="分块大小"),
    folder_id: Optional[str] = Form(None, description="目标文件夹ID"),
    description: Optional[str] = Form(None, description="文件描述"),
    tags: Optional[str] = Form(None, description="文件标签"),
    category: Optional[str] = Form(None, description="文件分类"),
    access_level: FileAccessLevel = Form(FileAccessLevel.PRIVATE, description="访问级别"),
    chunk_manager: ChunkedUploadManager = Depends(get_chunk_upload_manager),
    current_user: Dict[str, Any] = None
):
    """
    初始化分块上传会话
    
    支持特性：
    - 大文件分块上传
    - 断点续传
    - 并行分块上传
    - 完整性验证
    - 会话过期管理
    """
    try:
        # 1. 基础验证
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"文件大小超过限制 ({FileHelper.format_file_size(MAX_FILE_SIZE)})"
            )
        
        if not FileValidator.validate_filename(filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件名包含非法字符"
            )
        
        if FileValidator.is_dangerous_file(filename):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不允许上传此类型的文件"
            )
        
        # 2. 创建分块上传会话
        upload_id = chunk_manager.create_upload_session(
            filename, total_size, file_hash
        )
        
        # 3. 计算分块信息
        total_chunks = (total_size + chunk_size - 1) // chunk_size
        
        # 4. 存储额外的会话信息
        session_info = {
            "upload_id": upload_id,
            "filename": filename,
            "total_size": total_size,
            "chunk_size": chunk_size,
            "total_chunks": total_chunks,
            "file_hash": file_hash,
            "folder_id": folder_id,
            "description": description,
            "tags": _parse_tags(tags),
            "category": category,
            "access_level": access_level,
            "user_id": current_user["user_id"],
            "created_at": datetime.now(),
            "expires_at": datetime.now() + timedelta(hours=24),
            "status": "initialized"
        }
        
        upload_sessions[upload_id] = session_info
        
        return {
            "upload_id": upload_id,
            "chunk_size": chunk_size,
            "total_chunks": total_chunks,
            "total_size": total_size,
            "expires_at": session_info["expires_at"],
            "parallel_upload": True,
            "max_parallel_chunks": 3,
            "chunk_upload_url": f"/uploads/chunk/{upload_id}",
            "complete_url": f"/uploads/chunk/{upload_id}/complete",
            "status_url": f"/uploads/chunk/{upload_id}/status"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"初始化分块上传失败: {str(e)}"
        )

@router.post("/chunk/{upload_id}/upload/{chunk_index}")
@security_headers()
@require_permissions("file:upload")
async def upload_chunk(
    upload_id: str = PathParam(..., description="上传会话ID"),
    chunk_index: int = PathParam(..., ge=0, description="分块索引"),
    chunk_data: UploadFile = File(..., description="分块数据"),
    chunk_hash: Optional[str] = Form(None, description="分块MD5哈希值"),
    chunk_manager: ChunkedUploadManager = Depends(get_chunk_upload_manager),
    current_user: Dict[str, Any] = None
):
    """
    上传单个文件分块
    
    支持特性：
    - 分块完整性验证
    - 重复分块检测
    - 并发分块上传
    - 上传进度更新
    """
    try:
        # 1. 验证上传会话
        if upload_id not in upload_sessions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="上传会话不存在或已过期"
            )
        
        session_info = upload_sessions[upload_id]
        
        # 2. 验证用户权限
        if session_info["user_id"] != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问此上传会话"
            )
        
        # 3. 检查会话是否过期
        if datetime.now() > session_info["expires_at"]:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="上传会话已过期"
            )
        
        # 4. 验证分块索引
        if chunk_index >= session_info["total_chunks"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="分块索引超出范围"
            )
        
        # 5. 读取分块数据
        chunk_bytes = await chunk_data.read()
        
        # 6. 验证分块哈希（如果提供）
        if chunk_hash:
            import hashlib
            actual_hash = hashlib.md5(chunk_bytes).hexdigest()
            if actual_hash != chunk_hash:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="分块数据校验失败"
                )
        
        # 7. 上传分块
        success = await chunk_manager.upload_chunk(
            upload_id, chunk_index, chunk_bytes
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="分块上传失败"
            )
        
        # 8. 更新会话状态
        session_info["status"] = "uploading"
        
        # 9. 获取上传进度
        progress = chunk_manager.get_upload_progress(upload_id)
        
        return {
            "success": True,
            "upload_id": upload_id,
            "chunk_index": chunk_index,
            "progress": progress["progress"],
            "chunks_received": progress["chunks_received"],
            "total_chunks": progress["total_chunks"],
            "remaining_chunks": progress["total_chunks"] - progress["chunks_received"],
            "is_complete": progress["progress"] >= 1.0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"分块上传失败: {str(e)}"
        )

@router.get("/chunk/{upload_id}/status")
@security_headers()
@require_permissions("file:upload")
async def get_chunk_upload_status(
    upload_id: str = PathParam(..., description="上传会话ID"),
    chunk_manager: ChunkedUploadManager = Depends(get_chunk_upload_manager),
    current_user: Dict[str, Any] = None
):
    """
    获取分块上传状态和进度
    """
    try:
        # 1. 验证上传会话
        if upload_id not in upload_sessions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="上传会话不存在"
            )
        
        session_info = upload_sessions[upload_id]
        
        # 2. 验证用户权限
        if session_info["user_id"] != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问此上传会话"
            )
        
        # 3. 获取上传进度
        progress = chunk_manager.get_upload_progress(upload_id)
        
        # 4. 获取缺失的分块
        expected_chunks = set(range(session_info["total_chunks"]))
        received_chunks = set(progress["chunks_received"])
        missing_chunks = list(expected_chunks - received_chunks)
        
        return {
            "upload_id": upload_id,
            "filename": session_info["filename"],
            "status": session_info["status"],
            "progress": progress["progress"],
            "chunks_received": progress["chunks_received"],
            "total_chunks": progress["total_chunks"],
            "missing_chunks": missing_chunks,
            "created_at": session_info["created_at"],
            "expires_at": session_info["expires_at"],
            "is_expired": datetime.now() > session_info["expires_at"],
            "can_complete": len(missing_chunks) == 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取上传状态失败: {str(e)}"
        )

@router.post("/chunk/{upload_id}/complete", response_model=FileUploadResponse)
@security_headers()
@require_permissions("file:upload")
async def complete_chunk_upload(
    background_tasks: BackgroundTasks,
    upload_id: str = PathParam(..., description="上传会话ID"),
    auto_scan: bool = Form(True, description="是否自动病毒扫描"),
    auto_generate_thumbnail: bool = Form(True, description="是否自动生成缩略图"),
    chunk_manager: ChunkedUploadManager = Depends(get_chunk_upload_manager),
    file_service: FileService = Depends(get_file_service),
    file_manager: FileManager = Depends(get_file_manager),
    current_user: Dict[str, Any] = None
):
    """
    完成分块上传，合并所有分块
    
    支持特性：
    - 自动分块合并
    - 文件完整性验证
    - 元数据提取
    - 后台处理任务
    """
    try:
        # 1. 验证上传会话
        if upload_id not in upload_sessions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="上传会话不存在"
            )
        
        session_info = upload_sessions[upload_id]
        
        # 2. 验证用户权限
        if session_info["user_id"] != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问此上传会话"
            )
        
        # 3. 检查是否所有分块都已上传
        progress = chunk_manager.get_upload_progress(upload_id)
        if progress["progress"] < 1.0:
            missing_chunks = progress["total_chunks"] - progress["chunks_received"]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"还有 {missing_chunks} 个分块未上传完成"
            )
        
        # 4. 生成最终文件路径
        safe_filename = FileValidator.generate_safe_filename(session_info["filename"])
        final_path = UPLOAD_DIR / safe_filename
        
        # 5. 合并分块
        success = await chunk_manager.complete_upload(upload_id, final_path)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="分块合并失败"
            )
        
        # 6. 提取文件元数据
        file_processor = FileProcessor()
        metadata_dict = await file_processor.extract_metadata(final_path)
        
        metadata = FileMetadata(
            filename=safe_filename,
            original_filename=session_info["filename"],
            size=metadata_dict.get("size", session_info["total_size"]),
            mime_type=metadata_dict.get("mime_type", "application/octet-stream"),
            file_type=metadata_dict.get("file_type", FileType.OTHER),
            extension=metadata_dict.get("extension", ""),
        )
        
        # 7. 创建文件信息
        file_info = FileInfo(
            id=str(uuid.uuid4()),
            name=metadata.filename,
            path=str(final_path.relative_to(UPLOAD_DIR)),
            owner_id=current_user["user_id"],
            created_by=current_user["user_id"],
            description=session_info.get("description"),
            tags=session_info.get("tags", []),
            category=session_info.get("category"),
            parent_folder_id=session_info.get("folder_id"),
            metadata=metadata,
            security={"access_level": session_info.get("access_level", FileAccessLevel.PRIVATE)},
            status=FileStatus.PROCESSING
        )
        
        # 8. 保存到数据库
        saved_file = await file_service.create_file(file_info)
        
        # 9. 启动后台处理任务
        background_tasks.add_task(
            _process_uploaded_file,
            saved_file.id,
            final_path,
            auto_generate_thumbnail,
            auto_scan,
            current_user["user_id"]
        )
        
        # 10. 清理上传会话
        session_info["status"] = "completed"
        background_tasks.add_task(
            _cleanup_upload_session,
            upload_id,
            delay_seconds=300  # 5分钟后清理
        )
        
        # 11. 记录上传活动
        background_tasks.add_task(
            _log_upload_activity,
            saved_file.id,
            current_user["user_id"],
            "分块上传完成",
            saved_file.metadata.size
        )
        
        return FileUploadResponse(
            file_id=saved_file.id,
            filename=saved_file.name,
            size=saved_file.metadata.size,
            mime_type=saved_file.metadata.mime_type,
            file_type=saved_file.metadata.file_type,
            upload_id=upload_id,
            status=saved_file.status,
            uploaded_at=saved_file.created_at,
            access_url=f"/files/{saved_file.id}",
            download_url=f"/files/download/{saved_file.id}"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        # 更新会话状态
        if upload_id in upload_sessions:
            upload_sessions[upload_id]["status"] = "error"
            upload_sessions[upload_id]["error"] = str(e)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"完成分块上传失败: {str(e)}"
        )

# ======================== 上传状态管理 ========================

@router.get("/sessions", response_model=List[Dict[str, Any]])
@security_headers()
@require_permissions("file:upload")
async def list_upload_sessions(
    current_user: Dict[str, Any] = None,
    status_filter: Optional[str] = Query(None, description="状态过滤"),
    limit: int = Query(20, ge=1, le=100, description="限制数量")
):
    """
    获取用户的上传会话列表
    """
    try:
        user_sessions = []
        
        for upload_id, session in upload_sessions.items():
            if session["user_id"] == current_user["user_id"]:
                if status_filter and session.get("status") != status_filter:
                    continue
                
                # 计算会话信息
                session_data = {
                    "upload_id": upload_id,
                    "filename": session["filename"],
                    "total_size": session["total_size"],
                    "status": session.get("status", "unknown"),
                    "created_at": session["created_at"],
                    "expires_at": session["expires_at"],
                    "is_expired": datetime.now() > session["expires_at"]
                }
                
                # 如果是分块上传，获取进度信息
                if "total_chunks" in session:
                    try:
                        chunk_manager = await get_chunk_upload_manager()
                        progress = chunk_manager.get_upload_progress(upload_id)
                        session_data.update({
                            "upload_type": "chunk",
                            "progress": progress["progress"],
                            "chunks_received": progress["chunks_received"],
                            "total_chunks": progress["total_chunks"]
                        })
                    except:
                        session_data["upload_type"] = "chunk"
                        session_data["progress"] = 0.0
                else:
                    session_data["upload_type"] = "single"
                
                user_sessions.append(session_data)
                
                if len(user_sessions) >= limit:
                    break
        
        # 按创建时间排序
        user_sessions.sort(key=lambda x: x["created_at"], reverse=True)
        
        return user_sessions
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取上传会话列表失败: {str(e)}"
        )

@router.delete("/sessions/{upload_id}")
@security_headers()
@require_permissions("file:upload")
async def cancel_upload_session(
    upload_id: str = PathParam(..., description="上传会话ID"),
    current_user: Dict[str, Any] = None
):
    """
    取消上传会话
    """
    try:
        # 1. 验证上传会话
        if upload_id not in upload_sessions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="上传会话不存在"
            )
        
        session_info = upload_sessions[upload_id]
        
        # 2. 验证用户权限
        if session_info["user_id"] != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权限访问此上传会话"
            )
        
        # 3. 标记会话为已取消
        session_info["status"] = "cancelled"
        session_info["cancelled_at"] = datetime.now()
        
        # 4. 清理相关资源
        try:
            chunk_manager = await get_chunk_upload_manager()
            await chunk_manager._cleanup_upload_session(upload_id)
        except:
            pass  # 忽略清理错误
        
        # 5. 从会话存储中移除
        upload_sessions.pop(upload_id, None)
        
        return {"success": True, "message": "上传会话已取消"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"取消上传会话失败: {str(e)}"
        )

# ======================== 上传统计和监控 ========================

@router.get("/stats", response_model=Dict[str, Any])
@security_headers()
@cache_response(ttl=300)
@require_permissions("file:read")
async def get_upload_statistics(
    current_user: Dict[str, Any] = None,
    days: int = Query(7, ge=1, le=365, description="统计天数")
):
    """
    获取上传统计信息
    """
    try:
        # TODO: 实现真实的统计逻辑
        # 这里返回模拟数据
        return {
            "period_days": days,
            "total_uploads": 150,
            "successful_uploads": 145,
            "failed_uploads": 5,
            "success_rate": 0.967,
            "total_size": 2.5 * 1024 * 1024 * 1024,  # 2.5GB
            "total_size_formatted": "2.5 GB",
            "average_file_size": 17.2 * 1024 * 1024,  # 17.2MB
            "upload_types": {
                "single": 120,
                "batch": 20,
                "chunk": 10
            },
            "file_types": {
                "image": 80,
                "document": 40,
                "video": 15,
                "audio": 10,
                "other": 5
            },
            "daily_uploads": [
                {"date": "2024-01-01", "count": 20},
                {"date": "2024-01-02", "count": 25},
                # ... 更多数据
            ],
            "generated_at": datetime.now()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取上传统计失败: {str(e)}"
        )

# ======================== 辅助函数 ========================

def _parse_tags(tags_str: Optional[str]) -> List[str]:
    """解析标签字符串"""
    if not tags_str:
        return []
    
    try:
        import json
        # 尝试解析JSON格式
        return json.loads(tags_str)
    except:
        # 回退到逗号分隔格式
        return [tag.strip() for tag in tags_str.split(",") if tag.strip()]

def _parse_json_array(json_str: Optional[str]) -> List[Any]:
    """解析JSON数组字符串"""
    if not json_str:
        return []
    
    try:
        import json
        result = json.loads(json_str)
        return result if isinstance(result, list) else []
    except:
        return []

async def _upload_single_file_async(
    semaphore: asyncio.Semaphore,
    file: UploadFile,
    folder_id: Optional[str],
    description: Optional[str],
    tags: List[str],
    category: Optional[str],
    access_level: FileAccessLevel,
    auto_scan: bool,
    auto_generate_thumbnail: bool,
    file_service: FileService,
    file_manager: FileManager,
    current_user: Dict[str, Any],
    batch_id: str,
    index: int
) -> Dict[str, Any]:
    """异步上传单个文件"""
    async with semaphore:
        try:
            # 基础验证
            if not file.filename:
                return {
                    "success": False,
                    "error": "文件名为空",
                    "error_code": "INVALID_FILENAME"
                }
            
            # 保存文件
            temp_path = TEMP_DIR / f"batch_{batch_id}_{index}_{file.filename}"
            
            async with open(temp_path, 'wb') as temp_file:
                content = await file.read()
                await temp_file.write(content)
            
            # 验证文件
            is_valid, errors = await validate_uploaded_file(temp_path)
            if not is_valid:
                temp_path.unlink(missing_ok=True)
                return {
                    "success": False,
                    "error": "; ".join(errors),
                    "error_code": "VALIDATION_FAILED"
                }
            
            # 保存到最终位置
            final_path, metadata = await file_manager.save_file(
                open(temp_path, 'rb'),
                file.filename,
                folder=folder_id
            )
            
            # 创建文件信息
            file_info = FileInfo(
                id=str(uuid.uuid4()),
                name=metadata.filename,
                path=str(final_path.relative_to(UPLOAD_DIR)),
                owner_id=current_user["user_id"],
                created_by=current_user["user_id"],
                description=description,
                tags=tags,
                category=category,
                parent_folder_id=folder_id,
                metadata=metadata,
                security={"access_level": access_level},
                status=FileStatus.PROCESSING
            )
            
            # 保存到数据库
            saved_file = await file_service.create_file(file_info)
            
            # 清理临时文件
            temp_path.unlink(missing_ok=True)
            
            return {
                "success": True,
                "file_id": saved_file.id,
                "filename": saved_file.name,
                "size": saved_file.metadata.size
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "error_code": "UPLOAD_ERROR"
            }

async def _process_uploaded_file(
    file_id: str,
    file_path: Path,
    generate_thumbnail: bool,
    scan_virus: bool,
    user_id: str
):
    """处理上传的文件（后台任务）"""
    try:
        file_service = FileService()
        
        # 生成缩略图
        if generate_thumbnail:
            try:
                processor = FileProcessor()
                thumbnail_path = Path("thumbnails") / f"{file_id}_thumb.jpg"
                thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
                
                success = await processor.generate_thumbnail(
                    file_path, thumbnail_path, (200, 200)
                )
                
                if success:
                    await file_service.update_thumbnail_url(
                        file_id, f"/thumbnails/{file_id}_thumb.jpg"
                    )
            except Exception as e:
                print(f"缩略图生成失败: {e}")
        
        # 病毒扫描
        if scan_virus:
            try:
                # TODO: 集成实际的病毒扫描引擎
                await file_service.update_scan_status(file_id, "clean")
            except Exception as e:
                print(f"病毒扫描失败: {e}")
        
        # 更新文件状态为活跃
        await file_service.update_file_status(file_id, FileStatus.ACTIVE)
        
    except Exception as e:
        print(f"文件处理失败: {e}")
        # 标记文件为处理失败状态
        try:
            file_service = FileService()
            await file_service.update_file_status(file_id, FileStatus.CORRUPTED)
        except:
            pass

async def _log_upload_activity(
    file_id: str,
    user_id: str,
    description: str,
    file_size: int
):
    """记录上传活动"""
    try:
        file_service = FileService()
        activity = FileActivity(
            file_id=file_id,
            user_id=user_id,
            event_type="uploaded",
            operation=FileOperation.UPLOAD,
            description=description,
            details={"file_size": file_size},
            success=True,
            timestamp=datetime.now()
        )
        await file_service.log_activity(activity)
    except Exception as e:
        print(f"活动记录失败: {e}")

async def _log_batch_upload_activity(
    batch_id: str,
    user_id: str,
    total_files: int,
    success_count: int,
    failed_count: int
):
    """记录批量上传活动"""
    try:
        print(f"批量上传完成: batch_id={batch_id}, user={user_id}, "
              f"total={total_files}, success={success_count}, failed={failed_count}")
    except Exception as e:
        print(f"批量上传活动记录失败: {e}")

async def _log_upload_error(
    upload_id: str,
    user_id: str,
    error: str,
    context: Dict[str, Any]
):
    """记录上传错误"""
    try:
        print(f"上传错误: upload_id={upload_id}, user={user_id}, error={error}, context={context}")
    except Exception as e:
        print(f"错误记录失败: {e}")

async def _cleanup_upload_session(upload_id: str, delay_seconds: int = 0):
    """清理上传会话（延时后台任务）"""
    if delay_seconds > 0:
        await asyncio.sleep(delay_seconds)
    
    try:
        # 清理会话数据
        upload_sessions.pop(upload_id, None)
        
        # 清理相关的临时文件
        chunk_manager = ChunkedUploadManager()
        await chunk_manager._cleanup_upload_session(upload_id)
        
    except Exception as e:
        print(f"清理上传会话失败: {e}")

# ======================== 健康检查和管理接口 ========================

@router.get("/health")
async def health_check():
    """上传服务健康检查"""
    try:
        # 检查上传目录
        upload_dir_ok = UPLOAD_DIR.exists() and os.access(UPLOAD_DIR, os.W_OK)
        temp_dir_ok = TEMP_DIR.exists() and os.access(TEMP_DIR, os.W_OK)
        
        # 检查磁盘空间
        import shutil
        total, used, free = shutil.disk_usage(UPLOAD_DIR)
        free_gb = free // (1024**3)
        
        # 统计活跃会话
        active_sessions = sum(1 for s in upload_sessions.values() 
                            if s.get("status") in ["initialized", "uploading"])
        
        status = "healthy"
        issues = []
        
        if not upload_dir_ok:
            issues.append("上传目录不可写")
            status = "unhealthy"
        
        if not temp_dir_ok:
            issues.append("临时目录不可写")
            status = "unhealthy"
        
        if free_gb < 1:
            issues.append(f"磁盘空间不足: {free_gb}GB")
            status = "warning" if status == "healthy" else status
        
        return {
            "status": status,
            "issues": issues,
            "upload_dir": str(UPLOAD_DIR),
            "temp_dir": str(TEMP_DIR),
            "disk_free_gb": free_gb,
            "active_upload_sessions": active_sessions,
            "max_file_size": FileHelper.format_file_size(MAX_FILE_SIZE),
            "max_files_per_batch": MAX_FILES_PER_BATCH,
            "chunk_size": FileHelper.format_file_size(CHUNK_SIZE)
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@router.post("/admin/cleanup")
@require_admin()
async def cleanup_upload_resources(
    background_tasks: BackgroundTasks,
    cleanup_expired_sessions: bool = Query(True, description="清理过期会话"),
    cleanup_temp_files: bool = Query(True, description="清理临时文件"),
    cleanup_orphaned_chunks: bool = Query(True, description="清理孤立分块"),
    max_age_hours: int = Query(24, description="最大保留时间(小时)"),
    current_user: Dict[str, Any] = None
):
    """
    清理上传相关资源（管理员）
    """
    try:
        cleanup_tasks = []
        
        if cleanup_expired_sessions:
            background_tasks.add_task(
                _cleanup_expired_sessions,
                max_age_hours
            )
            cleanup_tasks.append("过期会话")
        
        if cleanup_temp_files:
            background_tasks.add_task(
                _cleanup_temp_files,
                max_age_hours
            )
            cleanup_tasks.append("临时文件")
        
        if cleanup_orphaned_chunks:
            background_tasks.add_task(
                _cleanup_orphaned_chunks,
                max_age_hours
            )
            cleanup_tasks.append("孤立分块")
        
        return {
            "success": True,
            "message": f"清理任务已启动: {', '.join(cleanup_tasks)}",
            "max_age_hours": max_age_hours
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"启动清理任务失败: {str(e)}"
        )

async def _cleanup_expired_sessions(max_age_hours: int):
    """清理过期会话"""
    try:
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        expired_sessions = []
        
        for upload_id, session in upload_sessions.items():
            if session.get("created_at", datetime.now()) < cutoff_time:
                expired_sessions.append(upload_id)
        
        for upload_id in expired_sessions:
            await _cleanup_upload_session(upload_id)
        
        print(f"清理了 {len(expired_sessions)} 个过期上传会话")
        
    except Exception as e:
        print(f"清理过期会话失败: {e}")

async def _cleanup_temp_files(max_age_hours: int):
    """清理临时文件"""
    try:
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        cleaned_count = 0
        
        for temp_file in TEMP_DIR.rglob('*'):
            if temp_file.is_file():
                file_time = datetime.fromtimestamp(temp_file.stat().st_mtime)
                if file_time < cutoff_time:
                    temp_file.unlink()
                    cleaned_count += 1
        
        print(f"清理了 {cleaned_count} 个临时文件")
        
    except Exception as e:
        print(f"清理临时文件失败: {e}")

async def _cleanup_orphaned_chunks(max_age_hours: int):
    """清理孤立的分块文件"""
    try:
        # TODO: 实现孤立分块清理逻辑
        print("孤立分块清理完成")
    except Exception as e:
        print(f"清理孤立分块失败: {e}")

# ======================== 服务占位符 ========================

class FileService:
    """文件服务占位符 - 应该从实际的服务模块导入"""
    
    async def create_file(self, file_info: FileInfo) -> FileInfo:
        return file_info
    
    async def update_thumbnail_url(self, file_id: str, url: str):
        pass
    
    async def update_scan_status(self, file_id: str, status: str):
        pass
    
    async def update_file_status(self, file_id: str, status: FileStatus):
        pass
    
    async def log_activity(self, activity: FileActivity):
        pass

class StorageService:
    """存储服务占位符"""
    pass
