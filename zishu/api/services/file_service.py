#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
文件管理服务 - 提供全面的文件管理业务逻辑
这是整个文件系统的核心服务层，负责处理所有文件相关的业务逻辑
"""

import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Union, Set
from urllib.parse import quote

# 第三方库导入 - 这些是可选依赖，在实际部署时需要安装
try:
    import aiofiles
    HAS_AIOFILES = True
except ImportError:
    HAS_AIOFILES = False
    logging.warning("aiofiles 未安装，将使用同步文件操作")

try:
    import aioredis
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    logging.warning("aioredis 未安装，缓存功能将被禁用")

try:
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select, update, delete, func, and_, or_, desc, asc
    from sqlalchemy.orm import selectinload, joinedload
    HAS_SQLALCHEMY = True
except ImportError:
    HAS_SQLALCHEMY = False
    # 提供占位符类型
    class AsyncSession: pass
    def select(*args, **kwargs): pass
    def update(*args, **kwargs): pass
    def delete(*args, **kwargs): pass
    def func(*args, **kwargs): pass
    def and_(*args, **kwargs): pass
    def or_(*args, **kwargs): pass
    def desc(*args, **kwargs): pass
    def asc(*args, **kwargs): pass
    def selectinload(*args, **kwargs): pass
    def joinedload(*args, **kwargs): pass
    logging.warning("SQLAlchemy 未安装，数据库功能将被禁用")

# 项目内部导入
from ..schemas.file import (
    # 枚举类型
    FileType, FileStatus, FileAccessLevel, FileOperation, StorageProvider, 
    ScanStatus, FileEvent,
    
    # 数据模型
    FileInfo, FileMetadata, FilePermission, FileSecurityInfo, FileStorageInfo,
    FileVersion, FileActivity, FolderInfo,
    
    # 请求/响应模型
    FileUpdateRequest, FileSearchRequest, FilePermissionRequest,
    FileBatchOperationRequest, FolderCreateRequest, FileShareRequest,
    FileListResponse, FileSearchResponse, FileOperationResponse,
    
    # 工具类
    FileValidator, FileHelper
)
from ..utils.file_utils import FileProcessor, FileManager, ChunkedUploadManager
# 数据库相关导入 - 这些是项目特定的模块
try:
    from ..database.models import File, Folder, FilePermissionModel, FileActivityModel
    from ..database.connection import get_async_session
    HAS_DATABASE = True
except ImportError:
    # 提供占位符类
    class File: pass
    class Folder: pass
    class FilePermissionModel: pass
    class FileActivityModel: pass
    def get_async_session(): pass
    HAS_DATABASE = False
    logging.warning("数据库模块未找到，数据库功能将被禁用")

# 异常类定义（如果项目中没有这些异常类）
class FileNotFoundError(Exception):
    """文件未找到异常"""
    pass

class PermissionDeniedError(Exception):
    """权限拒绝异常"""
    pass

class StorageError(Exception):
    """存储异常"""
    pass

class ValidationError(Exception):
    """验证异常"""
    pass

class BusinessLogicError(Exception):
    """业务逻辑异常"""
    pass

# 配置日志
logger = logging.getLogger(__name__)

class FileService:
    """
    文件管理服务类
    
    提供完整的文件管理功能，包括：
    - 文件的增删改查
    - 权限管理
    - 搜索和过滤
    - 活动记录
    - 统计分析
    - 存储管理
    - 安全扫描
    """
    
    def __init__(self, 
                 db_session: Optional[AsyncSession] = None,
                 redis_client: Optional[Any] = None,
                 storage_config: Optional[Dict[str, Any]] = None,
                 file_processor: Optional[FileProcessor] = None):
        """
        初始化文件服务
        
        Args:
            db_session: 数据库会话
            redis_client: Redis客户端
            storage_config: 存储配置
            file_processor: 文件处理器
        """
        self.db_session = db_session
        self.redis_client = redis_client
        self.storage_config = storage_config or {}
        self.file_processor = file_processor or FileProcessor()
        self.cache_ttl = 3600  # 1小时缓存
        
        # 初始化存储管理器
        self._storage_managers = {}
        self._init_storage_managers()
        
        logger.info("FileService 初始化完成")
    
    def _init_storage_managers(self):
        """初始化存储管理器"""
        # 根据配置初始化不同的存储后端
        for provider, config in self.storage_config.items():
            if provider == StorageProvider.LOCAL:
                self._storage_managers[provider] = LocalStorageManager(config)
            elif provider == StorageProvider.AWS_S3:
                self._storage_managers[provider] = S3StorageManager(config)
            elif provider == StorageProvider.ALIYUN_OSS:
                self._storage_managers[provider] = OSSStorageManager(config)
            # 可以添加更多存储后端
        
        # 确保至少有本地存储
        if StorageProvider.LOCAL not in self._storage_managers:
            self._storage_managers[StorageProvider.LOCAL] = LocalStorageManager({
                "base_path": "uploads"
            })
    
    # ======================== 核心文件操作 ========================
    
    async def create_file(self, file_info: FileInfo) -> FileInfo:
        """
        创建新文件记录
        
        Args:
            file_info: 文件信息
            
        Returns:
            创建的文件信息
        """
        try:
            # 数据验证
            await self._validate_file_creation(file_info)
            
            # 生成文件ID
            if not file_info.id:
                file_info.id = str(uuid.uuid4())
            
            # 设置默认值
            now = datetime.now()
            file_info.created_at = now
            file_info.updated_at = now
            file_info.status = file_info.status or FileStatus.PROCESSING
            
            # 检查存储配额
            await self._check_storage_quota(file_info.owner_id, file_info.metadata.size)
            
            # 保存到数据库
            db_file = File(
                id=file_info.id,
                name=file_info.name,
                path=file_info.path,
                owner_id=file_info.owner_id,
                created_by=file_info.created_by,
                status=file_info.status,
                file_type=file_info.metadata.file_type,
                size=file_info.metadata.size,
                mime_type=file_info.metadata.mime_type,
                parent_folder_id=file_info.parent_folder_id,
                metadata=file_info.metadata.model_dump(),
                security=file_info.security.model_dump() if file_info.security else {},
                tags=file_info.tags,
                category=file_info.category,
                description=file_info.description,
                created_at=file_info.created_at,
                updated_at=file_info.updated_at
            )
            
            if self.db_session:
                self.db_session.add(db_file)
                await self.db_session.commit()
                await self.db_session.refresh(db_file)
            
            # 更新文件夹统计
            if file_info.parent_folder_id:
                await self._update_folder_stats(file_info.parent_folder_id, size_delta=file_info.metadata.size, file_delta=1)
            
            # 记录创建活动
            await self.log_activity(FileActivity(
                file_id=file_info.id,
                user_id=file_info.created_by,
                event_type=FileEvent.CREATED,
                operation=FileOperation.CREATE,
                description="文件创建成功",
                success=True
            ))
            
            # 清除相关缓存
            await self._clear_file_cache(file_info.id, file_info.owner_id)
            
            logger.info(f"文件创建成功: {file_info.id} - {file_info.name}")
            return file_info
            
        except Exception as e:
            logger.error(f"创建文件失败: {str(e)}")
            if self.db_session:
                await self.db_session.rollback()
            raise BusinessLogicError(f"创建文件失败: {str(e)}")
    
    async def get_file(self, file_id: str, 
                      include_permissions: bool = False,
                      include_versions: bool = False,
                      user_id: Optional[str] = None) -> Optional[FileInfo]:
        """
        获取文件信息
        
        Args:
            file_id: 文件ID
            include_permissions: 是否包含权限信息
            include_versions: 是否包含版本信息
            user_id: 请求用户ID（用于权限检查）
            
        Returns:
            文件信息，如果不存在则返回None
        """
        try:
            # 尝试从缓存获取
            cache_key = f"file:{file_id}"
            if self.redis_client:
                cached_data = await self.redis_client.get(cache_key)
                if cached_data:
                    file_data = json.loads(cached_data)
                    file_info = FileInfo(**file_data)
                    
                    # 权限检查
                    if user_id and not await self._check_file_access(file_info, user_id, FileOperation.READ):
                        raise PermissionDeniedError("没有访问权限")
                    
                    return file_info
            
            # 从数据库查询
            if not self.db_session:
                return None
            
            query = select(File).where(File.id == file_id)
            
            if include_permissions:
                query = query.options(selectinload(File.permissions))
            
            result = await self.db_session.execute(query)
            db_file = result.scalar_one_or_none()
            
            if not db_file:
                return None
            
            # 转换为FileInfo对象
            file_info = await self._db_file_to_file_info(db_file)
            
            # 权限检查
            if user_id and not await self._check_file_access(file_info, user_id, FileOperation.READ):
                raise PermissionDeniedError("没有访问权限")
            
            # 包含版本信息
            if include_versions:
                file_info.versions = await self._get_file_versions(file_id)
            
            # 缓存结果
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key, 
                    self.cache_ttl, 
                    json.dumps(file_info.model_dump(), default=str)
                )
            
            return file_info
            
        except PermissionDeniedError:
            raise
        except Exception as e:
            logger.error(f"获取文件失败: {str(e)}")
            raise BusinessLogicError(f"获取文件失败: {str(e)}")
    
    async def update_file(self, file_id: str, 
                         update_data: FileUpdateRequest, 
                         user_id: str) -> FileInfo:
        """
        更新文件信息
        
        Args:
            file_id: 文件ID
            update_data: 更新数据
            user_id: 操作用户ID
            
        Returns:
            更新后的文件信息
        """
        try:
            # 获取现有文件
            file_info = await self.get_file(file_id, user_id=user_id)
            if not file_info:
                raise FileNotFoundError(f"文件不存在: {file_id}")
            
            # 权限检查
            if not await self._check_file_access(file_info, user_id, FileOperation.UPDATE):
                raise PermissionDeniedError("没有更新权限")
            
            # 构建更新字段
            update_fields = {}
            changes = []
            
            if update_data.name and update_data.name != file_info.name:
                if not FileValidator.validate_filename(update_data.name):
                    raise ValidationError("无效的文件名")
                update_fields["name"] = update_data.name
                changes.append(f"名称: {file_info.name} -> {update_data.name}")
            
            if update_data.description is not None and update_data.description != file_info.description:
                update_fields["description"] = update_data.description
                changes.append("描述已更新")
            
            if update_data.tags is not None and update_data.tags != file_info.tags:
                update_fields["tags"] = update_data.tags
                changes.append("标签已更新")
            
            if update_data.category and update_data.category != file_info.category:
                update_fields["category"] = update_data.category
                changes.append(f"分类: {file_info.category} -> {update_data.category}")
            
            if update_data.folder_id is not None and update_data.folder_id != file_info.parent_folder_id:
                # 验证目标文件夹
                if update_data.folder_id:
                    target_folder = await self.get_folder(update_data.folder_id)
                    if not target_folder:
                        raise ValidationError("目标文件夹不存在")
                    if not await self._check_folder_access(target_folder, user_id, FileOperation.CREATE):
                        raise PermissionDeniedError("没有权限移动到目标文件夹")
                
                # 更新文件夹统计
                old_folder_id = file_info.parent_folder_id
                if old_folder_id:
                    await self._update_folder_stats(old_folder_id, size_delta=-file_info.metadata.size, file_delta=-1)
                if update_data.folder_id:
                    await self._update_folder_stats(update_data.folder_id, size_delta=file_info.metadata.size, file_delta=1)
                
                update_fields["parent_folder_id"] = update_data.folder_id
                changes.append("文件夹已移动")
            
            if update_data.access_level and update_data.access_level != file_info.security.access_level:
                # 更新安全信息
                security_info = file_info.security.model_copy()
                security_info.access_level = update_data.access_level
                update_fields["security"] = security_info.model_dump()
                changes.append(f"访问级别: {file_info.security.access_level} -> {update_data.access_level}")
            
            if update_data.custom_fields:
                update_fields["custom_fields"] = update_data.custom_fields
                changes.append("自定义字段已更新")
            
            # 如果没有更改，直接返回
            if not update_fields:
                return file_info
            
            # 添加更新时间和更新者
            update_fields["updated_at"] = datetime.now()
            update_fields["updated_by"] = user_id
            
            # 执行数据库更新
            if self.db_session:
                await self.db_session.execute(
                    update(File).where(File.id == file_id).values(**update_fields)
                )
                await self.db_session.commit()
            
            # 记录更新活动
            await self.log_activity(FileActivity(
                file_id=file_id,
                user_id=user_id,
                event_type=FileEvent.UPDATED,
                operation=FileOperation.UPDATE,
                description=f"文件更新: {', '.join(changes)}",
                details={"changes": changes},
                success=True
            ))
            
            # 清除缓存
            await self._clear_file_cache(file_id, file_info.owner_id)
            
            # 获取更新后的文件信息
            updated_file = await self.get_file(file_id, user_id=user_id)
            
            logger.info(f"文件更新成功: {file_id} - {', '.join(changes)}")
            return updated_file
            
        except (FileNotFoundError, PermissionDeniedError, ValidationError):
            raise
        except Exception as e:
            logger.error(f"更新文件失败: {str(e)}")
            if self.db_session:
                await self.db_session.rollback()
            raise BusinessLogicError(f"更新文件失败: {str(e)}")
    
    async def delete_file_permanently(self, file_id: str, user_id: str) -> bool:
        """
        永久删除文件
        
        Args:
            file_id: 文件ID
            user_id: 操作用户ID
            
        Returns:
            是否删除成功
        """
        try:
            # 获取文件信息
            file_info = await self.get_file(file_id, user_id=user_id)
            if not file_info:
                raise FileNotFoundError(f"文件不存在: {file_id}")
            
            # 权限检查
            if not await self._check_file_access(file_info, user_id, FileOperation.DELETE):
                raise PermissionDeniedError("没有删除权限")
            
            # 删除物理文件
            try:
                storage_manager = self._get_storage_manager(file_info.storage.provider)
                await storage_manager.delete_file(file_info.storage.key)
            except Exception as e:
                logger.warning(f"删除物理文件失败: {e}")
            
            # 删除数据库记录
            if self.db_session:
                # 删除相关的权限记录
                await self.db_session.execute(
                    delete(FilePermissionModel).where(FilePermissionModel.file_id == file_id)
                )
                
                # 删除活动记录（可选，根据业务需求）
                # await self.db_session.execute(
                #     delete(FileActivityModel).where(FileActivityModel.file_id == file_id)
                # )
                
                # 删除文件记录
                await self.db_session.execute(
                    delete(File).where(File.id == file_id)
                )
                
                await self.db_session.commit()
            
            # 更新文件夹统计
            if file_info.parent_folder_id:
                await self._update_folder_stats(
                    file_info.parent_folder_id, 
                    size_delta=-file_info.metadata.size, 
                    file_delta=-1
                )
            
            # 记录删除活动
            await self.log_activity(FileActivity(
                file_id=file_id,
                user_id=user_id,
                event_type=FileEvent.DELETED,
                operation=FileOperation.DELETE,
                description="文件永久删除",
                success=True
            ))
            
            # 清除缓存
            await self._clear_file_cache(file_id, file_info.owner_id)
            
            logger.info(f"文件永久删除成功: {file_id}")
            return True
            
        except (FileNotFoundError, PermissionDeniedError):
            raise
        except Exception as e:
            logger.error(f"永久删除文件失败: {str(e)}")
            if self.db_session:
                await self.db_session.rollback()
            raise BusinessLogicError(f"永久删除文件失败: {str(e)}")
    
    async def mark_as_deleted(self, file_id: str, user_id: str) -> bool:
        """
        标记文件为已删除（软删除）
        
        Args:
            file_id: 文件ID
            user_id: 操作用户ID
            
        Returns:
            是否操作成功
        """
        try:
            # 获取文件信息
            file_info = await self.get_file(file_id, user_id=user_id)
            if not file_info:
                raise FileNotFoundError(f"文件不存在: {file_id}")
            
            # 权限检查
            if not await self._check_file_access(file_info, user_id, FileOperation.DELETE):
                raise PermissionDeniedError("没有删除权限")
            
            # 更新状态
            if self.db_session:
                await self.db_session.execute(
                    update(File)
                    .where(File.id == file_id)
                    .values(
                        status=FileStatus.DELETED,
                        updated_at=datetime.now(),
                        updated_by=user_id
                    )
                )
                await self.db_session.commit()
            
            # 更新文件夹统计（从活跃文件统计中移除）
            if file_info.parent_folder_id:
                await self._update_folder_stats(
                    file_info.parent_folder_id, 
                    size_delta=-file_info.metadata.size, 
                    file_delta=-1
                )
            
            # 记录删除活动
            await self.log_activity(FileActivity(
                file_id=file_id,
                user_id=user_id,
                event_type=FileEvent.DELETED,
                operation=FileOperation.DELETE,
                description="文件移至回收站",
                success=True
            ))
            
            # 清除缓存
            await self._clear_file_cache(file_id, file_info.owner_id)
            
            logger.info(f"文件标记为已删除: {file_id}")
            return True
            
        except (FileNotFoundError, PermissionDeniedError):
            raise
        except Exception as e:
            logger.error(f"标记文件删除失败: {str(e)}")
            if self.db_session:
                await self.db_session.rollback()
            raise BusinessLogicError(f"标记文件删除失败: {str(e)}")
    
    # ======================== 文件列表和搜索 ========================
    
    async def list_files(self, 
                        filters: Dict[str, Any],
                        sort_by: str = "created_at",
                        sort_order: str = "desc",
                        page: int = 1,
                        page_size: int = 20) -> Tuple[List[FileInfo], int]:
        """
        获取文件列表
        
        Args:
            filters: 过滤条件
            sort_by: 排序字段
            sort_order: 排序顺序
            page: 页码
            page_size: 每页大小
            
        Returns:
            (文件列表, 总数量)
        """
        try:
            if not self.db_session:
                return [], 0
            
            # 构建查询条件
            query = select(File)
            count_query = select(func.count(File.id))
            
            # 应用过滤条件
            conditions = []
            
            if filters.get("owner_id"):
                conditions.append(File.owner_id == filters["owner_id"])
            
            if filters.get("folder_id") is not None:
                conditions.append(File.parent_folder_id == filters["folder_id"])
            
            if filters.get("statuses"):
                conditions.append(File.status.in_(filters["statuses"]))
            else:
                # 默认排除已删除的文件
                conditions.append(File.status != FileStatus.DELETED)
            
            if filters.get("file_types"):
                conditions.append(File.file_type.in_(filters["file_types"]))
            
            if filters.get("category"):
                conditions.append(File.category == filters["category"])
            
            if filters.get("tags"):
                # 标签查询 - 包含任意指定标签
                for tag in filters["tags"]:
                    conditions.append(File.tags.contains([tag]))
            
            if filters.get("name_pattern"):
                conditions.append(File.name.ilike(f"%{filters['name_pattern']}%"))
            
            if filters.get("size_min"):
                conditions.append(File.size >= filters["size_min"])
            
            if filters.get("size_max"):
                conditions.append(File.size <= filters["size_max"])
            
            if filters.get("created_after"):
                conditions.append(File.created_at >= filters["created_after"])
            
            if filters.get("created_before"):
                conditions.append(File.created_at <= filters["created_before"])
            
            # 应用条件
            if conditions:
                query = query.where(and_(*conditions))
                count_query = count_query.where(and_(*conditions))
            
            # 获取总数
            count_result = await self.db_session.execute(count_query)
            total_count = count_result.scalar()
            
            # 排序
            sort_column = getattr(File, sort_by, File.created_at)
            if sort_order.lower() == "desc":
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(asc(sort_column))
            
            # 分页
            offset = (page - 1) * page_size
            query = query.offset(offset).limit(page_size)
            
            # 执行查询
            result = await self.db_session.execute(query)
            db_files = result.scalars().all()
            
            # 转换为FileInfo对象
            files = []
            for db_file in db_files:
                file_info = await self._db_file_to_file_info(db_file)
                files.append(file_info)
            
            logger.info(f"文件列表查询成功: {len(files)} 条记录, 总数: {total_count}")
            return files, total_count
            
        except Exception as e:
            logger.error(f"获取文件列表失败: {str(e)}")
            raise BusinessLogicError(f"获取文件列表失败: {str(e)}")
    
    async def search_files(self, search_request: FileSearchRequest, user_id: str) -> FileListResponse:
        """
        搜索文件
        
        Args:
            search_request: 搜索请求
            user_id: 用户ID
            
        Returns:
            搜索结果
        """
        try:
            # 构建过滤条件
            filters = {
                "owner_id": user_id,  # 限制为用户自己的文件
                "folder_id": search_request.folder_id,
                "statuses": search_request.statuses,
                "file_types": search_request.file_types,
                "category": search_request.category,
                "tags": search_request.tags,
                "size_min": search_request.min_size,
                "size_max": search_request.max_size,
                "created_after": search_request.created_after,
                "created_before": search_request.created_before,
            }
            
            # 添加关键词搜索
            if search_request.query:
                filters["name_pattern"] = search_request.query
            
            # 执行搜索
            files, total_count = await self.list_files(
                filters=filters,
                sort_by=search_request.sort_by,
                sort_order=search_request.sort_order,
                page=search_request.page,
                page_size=search_request.page_size
            )
            
            # 构建响应
            total_pages = (total_count + search_request.page_size - 1) // search_request.page_size
            
            return FileListResponse(
                files=files,
                folders=[],  # 搜索结果中不包含文件夹
                total_count=total_count,
                page=search_request.page,
                page_size=search_request.page_size,
                total_pages=total_pages,
                has_next=search_request.page < total_pages,
                has_prev=search_request.page > 1,
                total_size=sum(f.metadata.size for f in files),
                file_count=len(files),
                folder_count=0
            )
            
        except Exception as e:
            logger.error(f"文件搜索失败: {str(e)}")
            raise BusinessLogicError(f"文件搜索失败: {str(e)}")
    
    # ======================== 文件夹管理 ========================
    
    async def create_folder(self, folder_info: FolderInfo) -> FolderInfo:
        """创建文件夹"""
        try:
            # 生成文件夹ID
            if not folder_info.id:
                folder_info.id = str(uuid.uuid4())
            
            # 设置默认值
            now = datetime.now()
            folder_info.created_at = now
            folder_info.updated_at = now
            
            # 验证父文件夹
            if folder_info.parent_id:
                parent_folder = await self.get_folder(folder_info.parent_id)
                if not parent_folder:
                    raise ValidationError("父文件夹不存在")
                folder_info.level = parent_folder.level + 1
            else:
                folder_info.level = 0
            
            # 保存到数据库
            db_folder = Folder(
                id=folder_info.id,
                name=folder_info.name,
                path=folder_info.path,
                description=folder_info.description,
                parent_id=folder_info.parent_id,
                level=folder_info.level,
                owner_id=folder_info.owner_id,
                created_by=folder_info.created_by,
                access_level=folder_info.access_level,
                created_at=folder_info.created_at,
                updated_at=folder_info.updated_at
            )
            
            if self.db_session:
                self.db_session.add(db_folder)
                await self.db_session.commit()
                await self.db_session.refresh(db_folder)
            
            logger.info(f"文件夹创建成功: {folder_info.id} - {folder_info.name}")
            return folder_info
            
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"创建文件夹失败: {str(e)}")
            if self.db_session:
                await self.db_session.rollback()
            raise BusinessLogicError(f"创建文件夹失败: {str(e)}")
    
    async def get_folder(self, folder_id: str) -> Optional[FolderInfo]:
        """获取文件夹信息"""
        try:
            if not self.db_session:
                return None
            
            result = await self.db_session.execute(
                select(Folder).where(Folder.id == folder_id)
            )
            db_folder = result.scalar_one_or_none()
            
            if not db_folder:
                return None
            
            # 转换为FolderInfo对象
            return FolderInfo(
                id=db_folder.id,
                name=db_folder.name,
                path=db_folder.path,
                description=db_folder.description,
                parent_id=db_folder.parent_id,
                level=db_folder.level,
                owner_id=db_folder.owner_id,
                created_by=db_folder.created_by,
                access_level=db_folder.access_level,
                file_count=db_folder.file_count or 0,
                subfolder_count=db_folder.subfolder_count or 0,
                total_size=db_folder.total_size or 0,
                created_at=db_folder.created_at,
                updated_at=db_folder.updated_at
            )
            
        except Exception as e:
            logger.error(f"获取文件夹失败: {str(e)}")
            return None
    
    async def list_folders(self, parent_id: Optional[str] = None, 
                          owner_id: Optional[str] = None) -> List[FolderInfo]:
        """获取文件夹列表"""
        try:
            if not self.db_session:
                return []
            
            query = select(Folder)
            conditions = []
            
            if parent_id is not None:
                conditions.append(Folder.parent_id == parent_id)
            
            if owner_id:
                conditions.append(Folder.owner_id == owner_id)
            
            if conditions:
                query = query.where(and_(*conditions))
            
            query = query.order_by(Folder.name)
            
            result = await self.db_session.execute(query)
            db_folders = result.scalars().all()
            
            folders = []
            for db_folder in db_folders:
                folder_info = FolderInfo(
                    id=db_folder.id,
                    name=db_folder.name,
                    path=db_folder.path,
                    description=db_folder.description,
                    parent_id=db_folder.parent_id,
                    level=db_folder.level,
                    owner_id=db_folder.owner_id,
                    created_by=db_folder.created_by,
                    access_level=db_folder.access_level,
                    file_count=db_folder.file_count or 0,
                    subfolder_count=db_folder.subfolder_count or 0,
                    total_size=db_folder.total_size or 0,
                    created_at=db_folder.created_at,
                    updated_at=db_folder.updated_at
                )
                folders.append(folder_info)
            
            return folders
            
        except Exception as e:
            logger.error(f"获取文件夹列表失败: {str(e)}")
            return []
    
    # ======================== 权限管理 ========================
    
    async def grant_permission(self, file_id: str, user_id: str, 
                              permission: FileOperation, granted_by: str,
                              expires_at: Optional[datetime] = None,
                              conditions: Optional[Dict[str, Any]] = None) -> bool:
        """授予文件权限"""
        try:
            # 验证文件存在
            file_info = await self.get_file(file_id)
            if not file_info:
                raise FileNotFoundError(f"文件不存在: {file_id}")
            
            # 创建权限记录
            permission_record = FilePermissionModel(
                id=str(uuid.uuid4()),
                file_id=file_id,
                user_id=user_id,
                permission=permission,
                granted_by=granted_by,
                granted_at=datetime.now(),
                expires_at=expires_at,
                conditions=conditions or {}
            )
            
            if self.db_session:
                # 检查是否已存在相同权限
                existing = await self.db_session.execute(
                    select(FilePermissionModel).where(
                        and_(
                            FilePermissionModel.file_id == file_id,
                            FilePermissionModel.user_id == user_id,
                            FilePermissionModel.permission == permission
                        )
                    )
                )
                
                if existing.scalar_one_or_none():
                    # 更新现有权限
                    await self.db_session.execute(
                        update(FilePermissionModel)
                        .where(
                            and_(
                                FilePermissionModel.file_id == file_id,
                                FilePermissionModel.user_id == user_id,
                                FilePermissionModel.permission == permission
                            )
                        )
                        .values(
                            granted_by=granted_by,
                            granted_at=datetime.now(),
                            expires_at=expires_at,
                            conditions=conditions or {}
                        )
                    )
                else:
                    # 添加新权限
                    self.db_session.add(permission_record)
                
                await self.db_session.commit()
            
            # 记录权限授予活动
            await self.log_activity(FileActivity(
                file_id=file_id,
                user_id=granted_by,
                event_type=FileEvent.SHARED,
                operation=FileOperation.SHARE,
                description=f"授予用户 {user_id} {permission} 权限",
                details={"target_user": user_id, "permission": permission},
                success=True
            ))
            
            logger.info(f"权限授予成功: 文件 {file_id}, 用户 {user_id}, 权限 {permission}")
            return True
            
        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"授予权限失败: {str(e)}")
            if self.db_session:
                await self.db_session.rollback()
            raise BusinessLogicError(f"授予权限失败: {str(e)}")
    
    async def revoke_permission(self, file_id: str, user_id: str, 
                               permission: Optional[FileOperation] = None) -> bool:
        """撤销文件权限"""
        try:
            if not self.db_session:
                return False
            
            # 构建删除条件
            conditions = [
                FilePermissionModel.file_id == file_id,
                FilePermissionModel.user_id == user_id
            ]
            
            if permission:
                conditions.append(FilePermissionModel.permission == permission)
            
            # 执行删除
            await self.db_session.execute(
                delete(FilePermissionModel).where(and_(*conditions))
            )
            await self.db_session.commit()
            
            logger.info(f"权限撤销成功: 文件 {file_id}, 用户 {user_id}, 权限 {permission or '全部'}")
            return True
            
        except Exception as e:
            logger.error(f"撤销权限失败: {str(e)}")
            if self.db_session:
                await self.db_session.rollback()
            return False
    
    async def get_user_permissions(self, file_id: str, user_id: str) -> List[FileOperation]:
        """获取用户对文件的权限"""
        try:
            if not self.db_session:
                return []
            
            result = await self.db_session.execute(
                select(FilePermissionModel.permission)
                .where(
                    and_(
                        FilePermissionModel.file_id == file_id,
                        FilePermissionModel.user_id == user_id,
                        or_(
                            FilePermissionModel.expires_at.is_(None),
                            FilePermissionModel.expires_at > datetime.now()
                        )
                    )
                )
            )
            
            permissions = [row[0] for row in result.fetchall()]
            return permissions
            
        except Exception as e:
            logger.error(f"获取用户权限失败: {str(e)}")
            return []
    
    # ======================== 活动记录 ========================
    
    async def log_activity(self, activity: FileActivity):
        """记录文件活动"""
        try:
            if not activity.id:
                activity.id = str(uuid.uuid4())
            
            if not activity.timestamp:
                activity.timestamp = datetime.now()
            
            # 保存到数据库
            if self.db_session:
                db_activity = FileActivityModel(
                    id=activity.id,
                    file_id=activity.file_id,
                    user_id=activity.user_id,
                    event_type=activity.event_type,
                    operation=activity.operation,
                    description=activity.description,
                    details=activity.details,
                    ip_address=activity.ip_address,
                    user_agent=activity.user_agent,
                    session_id=activity.session_id,
                    success=activity.success,
                    error_message=activity.error_message,
                    duration=activity.duration,
                    timestamp=activity.timestamp
                )
                
                self.db_session.add(db_activity)
                await self.db_session.commit()
            
            # 异步写入日志（不阻塞主流程）
            asyncio.create_task(self._write_activity_log(activity))
            
        except Exception as e:
            logger.error(f"记录活动失败: {str(e)}")
            # 活动记录失败不应该影响主业务流程
    
    async def get_file_activities(self, file_id: str, 
                                 activity_type: Optional[str] = None,
                                 date_from: Optional[datetime] = None,
                                 date_to: Optional[datetime] = None,
                                 page: int = 1,
                                 page_size: int = 20) -> Tuple[List[FileActivity], int]:
        """获取文件活动记录"""
        try:
            if not self.db_session:
                return [], 0
            
            # 构建查询条件
            query = select(FileActivityModel).where(FileActivityModel.file_id == file_id)
            count_query = select(func.count(FileActivityModel.id)).where(FileActivityModel.file_id == file_id)
            
            conditions = [FileActivityModel.file_id == file_id]
            
            if activity_type:
                conditions.append(FileActivityModel.event_type == activity_type)
            
            if date_from:
                conditions.append(FileActivityModel.timestamp >= date_from)
            
            if date_to:
                conditions.append(FileActivityModel.timestamp <= date_to)
            
            if len(conditions) > 1:
                query = query.where(and_(*conditions))
                count_query = count_query.where(and_(*conditions))
            
            # 获取总数
            count_result = await self.db_session.execute(count_query)
            total_count = count_result.scalar()
            
            # 分页和排序
            offset = (page - 1) * page_size
            query = query.order_by(desc(FileActivityModel.timestamp)).offset(offset).limit(page_size)
            
            result = await self.db_session.execute(query)
            db_activities = result.scalars().all()
            
            # 转换为FileActivity对象
            activities = []
            for db_activity in db_activities:
                activity = FileActivity(
                    id=db_activity.id,
                    file_id=db_activity.file_id,
                    user_id=db_activity.user_id,
                    event_type=db_activity.event_type,
                    operation=db_activity.operation,
                    description=db_activity.description,
                    details=db_activity.details or {},
                    ip_address=db_activity.ip_address,
                    user_agent=db_activity.user_agent,
                    session_id=db_activity.session_id,
                    success=db_activity.success,
                    error_message=db_activity.error_message,
                    duration=db_activity.duration,
                    timestamp=db_activity.timestamp
                )
                activities.append(activity)
            
            return activities, total_count
            
        except Exception as e:
            logger.error(f"获取活动记录失败: {str(e)}")
            return [], 0
    
    # ======================== 统计分析 ========================
    
    async def get_statistics(self, user_id: Optional[str] = None, 
                           date_range: int = 30) -> Dict[str, Any]:
        """获取文件统计信息"""
        try:
            if not self.db_session:
                return {}
            
            # 计算日期范围
            end_date = datetime.now()
            start_date = end_date - timedelta(days=date_range)
            
            # 基础统计查询
            base_query = select(File)
            if user_id:
                base_query = base_query.where(File.owner_id == user_id)
            
            # 总文件数和大小
            total_result = await self.db_session.execute(
                select(func.count(File.id), func.sum(File.size))
                .select_from(base_query.subquery())
                .where(File.status != FileStatus.DELETED)
            )
            total_files, total_size = total_result.fetchone()
            total_size = total_size or 0
            
            # 按类型统计
            type_result = await self.db_session.execute(
                select(File.file_type, func.count(File.id))
                .select_from(base_query.subquery())
                .where(File.status != FileStatus.DELETED)
                .group_by(File.file_type)
            )
            by_type = {row[0]: row[1] for row in type_result.fetchall()}
            
            # 按状态统计
            status_result = await self.db_session.execute(
                select(File.status, func.count(File.id))
                .select_from(base_query.subquery())
                .group_by(File.status)
            )
            by_status = {row[0]: row[1] for row in status_result.fetchall()}
            
            # 时间范围内的活动统计
            activity_result = await self.db_session.execute(
                select(func.count(FileActivityModel.id))
                .where(
                    and_(
                        FileActivityModel.timestamp >= start_date,
                        FileActivityModel.timestamp <= end_date,
                        FileActivityModel.operation == FileOperation.DOWNLOAD
                    )
                )
            )
            total_downloads = activity_result.scalar() or 0
            
            # 按日期统计（最近7天）
            daily_stats = {}
            for i in range(7):
                day = end_date - timedelta(days=i)
                day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
                day_end = day_start + timedelta(days=1)
                
                day_result = await self.db_session.execute(
                    select(func.count(File.id))
                    .select_from(base_query.subquery())
                    .where(
                        and_(
                            File.created_at >= day_start,
                            File.created_at < day_end
                        )
                    )
                )
                daily_stats[day.strftime('%Y-%m-%d')] = day_result.scalar() or 0
            
            return {
                "total_files": total_files or 0,
                "total_size": total_size,
                "total_downloads": total_downloads,
                "by_type": by_type,
                "by_status": by_status,
                "by_date": daily_stats,
                "date_range": date_range,
                "generated_at": datetime.now()
            }
            
        except Exception as e:
            logger.error(f"获取统计信息失败: {str(e)}")
            return {}
    
    # ======================== 辅助和工具方法 ========================
    
    async def increment_download_count(self, file_id: str):
        """增加下载计数"""
        try:
            if self.db_session:
                await self.db_session.execute(
                    update(File)
                    .where(File.id == file_id)
                    .values(download_count=File.download_count + 1)
                )
                await self.db_session.commit()
            
            # 更新缓存中的计数
            if self.redis_client:
                cache_key = f"download_count:{file_id}"
                await self.redis_client.incr(cache_key)
                await self.redis_client.expire(cache_key, 3600)
                
        except Exception as e:
            logger.error(f"增加下载计数失败: {str(e)}")
    
    async def update_thumbnail_url(self, file_id: str, thumbnail_url: str):
        """更新缩略图URL"""
        try:
            if self.db_session:
                await self.db_session.execute(
                    update(File)
                    .where(File.id == file_id)
                    .values(thumbnail_url=thumbnail_url)
                )
                await self.db_session.commit()
            
            # 清除文件缓存
            await self._clear_file_cache(file_id)
            
        except Exception as e:
            logger.error(f"更新缩略图URL失败: {str(e)}")
    
    async def update_scan_status(self, file_id: str, scan_status: str):
        """更新扫描状态"""
        try:
            if self.db_session:
                # 更新文件的安全信息
                result = await self.db_session.execute(
                    select(File.security).where(File.id == file_id)
                )
                security_data = result.scalar_one_or_none()
                
                if security_data:
                    security_data["scan_status"] = scan_status
                    security_data["last_scanned_at"] = datetime.now().isoformat()
                    
                    await self.db_session.execute(
                        update(File)
                        .where(File.id == file_id)
                        .values(security=security_data)
                    )
                    await self.db_session.commit()
                
                # 如果发现病毒，标记文件为隔离状态
                if scan_status == ScanStatus.INFECTED:
                    await self.db_session.execute(
                        update(File)
                        .where(File.id == file_id)
                        .values(status=FileStatus.QUARANTINE)
                    )
                    await self.db_session.commit()
            
            # 清除文件缓存
            await self._clear_file_cache(file_id)
            
        except Exception as e:
            logger.error(f"更新扫描状态失败: {str(e)}")
    
    async def update_file_status(self, file_id: str, status: FileStatus):
        """更新文件状态"""
        try:
            if self.db_session:
                await self.db_session.execute(
                    update(File)
                    .where(File.id == file_id)
                    .values(status=status, updated_at=datetime.now())
                )
                await self.db_session.commit()
            
            # 清除文件缓存
            await self._clear_file_cache(file_id)
            
        except Exception as e:
            logger.error(f"更新文件状态失败: {str(e)}")
    
    # ======================== 文件分享功能 ========================
    
    async def create_share(self, file_ids: List[str], 
                          share_request: FileShareRequest,
                          user_id: str) -> Dict[str, Any]:
        """
        创建文件分享
        
        Args:
            file_ids: 要分享的文件ID列表
            share_request: 分享请求
            user_id: 创建分享的用户ID
            
        Returns:
            分享信息
        """
        try:
            # 验证文件权限
            for file_id in file_ids:
                file_info = await self.get_file(file_id, user_id=user_id)
                if not file_info:
                    raise FileNotFoundError(f"文件不存在: {file_id}")
                
                if not await self._check_file_access(file_info, user_id, FileOperation.SHARE):
                    raise PermissionDeniedError(f"没有分享权限: {file_id}")
            
            # 生成分享信息
            share_id = str(uuid.uuid4())
            share_code = None
            
            if share_request.share_type == "private":
                share_code = self._generate_share_code()
            
            # 创建分享记录
            share_data = {
                "id": share_id,
                "file_ids": file_ids,
                "created_by": user_id,
                "share_type": share_request.share_type,
                "password": self._hash_password(share_request.password) if share_request.password else None,
                "expires_at": share_request.expires_at,
                "max_downloads": share_request.max_downloads,
                "allow_preview": share_request.allow_preview,
                "download_count": 0,
                "view_count": 0,
                "created_at": datetime.now(),
                "is_active": True
            }
            
            # 保存分享记录（这里应该有一个Share表）
            if self.redis_client:
                # 使用Redis临时存储分享信息
                share_key = f"share:{share_id}"
                await self.redis_client.setex(
                    share_key,
                    int((share_request.expires_at - datetime.now()).total_seconds()) if share_request.expires_at else 86400 * 7,  # 默认7天
                    json.dumps(share_data, default=str)
                )
            
            # 生成分享URL
            base_url = "https://your-domain.com"  # 应该从配置获取
            share_url = f"{base_url}/files/shared/{share_id}"
            
            if share_code:
                share_url += f"?code={share_code}"
            
            # 记录分享活动
            for file_id in file_ids:
                await self.log_activity(FileActivity(
                    file_id=file_id,
                    user_id=user_id,
                    event_type=FileEvent.SHARED,
                    operation=FileOperation.SHARE,
                    description=f"文件分享创建: {share_request.share_type}",
                    details={
                        "share_id": share_id,
                        "share_type": share_request.share_type,
                        "expires_at": share_request.expires_at.isoformat() if share_request.expires_at else None
                    },
                    success=True
                ))
            
            # 更新文件分享计数
            if self.db_session:
                for file_id in file_ids:
                    await self.db_session.execute(
                        update(File)
                        .where(File.id == file_id)
                        .values(share_count=File.share_count + 1)
                    )
                await self.db_session.commit()
            
            return {
                "share_id": share_id,
                "share_url": share_url,
                "share_code": share_code,
                "qr_code_url": f"{base_url}/api/qr?url={quote(share_url)}"
            }
            
        except (FileNotFoundError, PermissionDeniedError):
            raise
        except Exception as e:
            logger.error(f"创建分享失败: {str(e)}")
            raise BusinessLogicError(f"创建分享失败: {str(e)}")
    
    async def validate_share(self, share_id: str, password: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        验证分享链接
        
        Args:
            share_id: 分享ID
            password: 分享密码
            
        Returns:
            分享信息，如果无效则返回None
        """
        try:
            if not self.redis_client:
                return None
            
            # 从Redis获取分享信息
            share_key = f"share:{share_id}"
            share_data = await self.redis_client.get(share_key)
            
            if not share_data:
                return None
            
            share_info = json.loads(share_data)
            
            # 检查是否已过期
            if share_info.get("expires_at"):
                expires_at = datetime.fromisoformat(share_info["expires_at"])
                if datetime.now() > expires_at:
                    return None
            
            # 检查密码
            if share_info.get("password"):
                if not password or not self._verify_password(password, share_info["password"]):
                    raise PermissionDeniedError("分享密码错误")
            
            # 检查下载次数限制
            if (share_info.get("max_downloads") and 
                share_info.get("download_count", 0) >= share_info["max_downloads"]):
                return None
            
            # 获取文件信息
            files_info = []
            for file_id in share_info["file_ids"]:
                file_info = await self.get_file(file_id)
                if file_info and file_info.status == FileStatus.ACTIVE:
                    files_info.append({
                        "id": file_info.id,
                        "name": file_info.name,
                        "size": file_info.metadata.size,
                        "type": file_info.metadata.file_type,
                        "mime_type": file_info.metadata.mime_type
                    })
            
            share_info["files"] = files_info
            return share_info
            
        except PermissionDeniedError:
            raise
        except Exception as e:
            logger.error(f"验证分享失败: {str(e)}")
            return None
    
    # ======================== 批量操作功能 ========================
    
    async def batch_operation(self, operation: FileOperation, file_ids: List[str], 
                             user_id: str, **kwargs) -> List[FileOperationResponse]:
        """
        批量文件操作
        
        Args:
            operation: 操作类型
            file_ids: 文件ID列表
            user_id: 操作用户ID
            **kwargs: 操作参数
            
        Returns:
            操作结果列表
        """
        results = []
        
        for file_id in file_ids:
            try:
                if operation == FileOperation.DELETE:
                    success = await self.mark_as_deleted(file_id, user_id)
                    result = FileOperationResponse(
                        success=success,
                        operation=operation,
                        file_id=file_id,
                        message="删除成功" if success else "删除失败",
                        new_status=FileStatus.DELETED if success else None
                    )
                
                elif operation == FileOperation.MOVE:
                    target_folder_id = kwargs.get("target_folder_id")
                    if not target_folder_id:
                        raise ValidationError("缺少目标文件夹ID")
                    
                    update_request = FileUpdateRequest(folder_id=target_folder_id)
                    updated_file = await self.update_file(file_id, update_request, user_id)
                    
                    result = FileOperationResponse(
                        success=True,
                        operation=operation,
                        file_id=file_id,
                        message="移动成功",
                        new_path=updated_file.parent_folder_id
                    )
                
                elif operation == FileOperation.COPY:
                    # 复制文件逻辑
                    copied_file = await self._copy_file(file_id, user_id, kwargs)
                    result = FileOperationResponse(
                        success=True,
                        operation=operation,
                        file_id=file_id,
                        message="复制成功",
                        details={"new_file_id": copied_file.id}
                    )
                
                elif operation == FileOperation.ARCHIVE:
                    success = await self.update_file_status(file_id, FileStatus.ARCHIVED)
                    result = FileOperationResponse(
                        success=True,
                        operation=operation,
                        file_id=file_id,
                        message="归档成功",
                        new_status=FileStatus.ARCHIVED
                    )
                
                else:
                    result = FileOperationResponse(
                        success=False,
                        operation=operation,
                        file_id=file_id,
                        message="不支持的操作",
                        error_code="UNSUPPORTED_OPERATION"
                    )
                
                results.append(result)
                
            except Exception as e:
                result = FileOperationResponse(
                    success=False,
                    operation=operation,
                    file_id=file_id,
                    message=f"操作失败: {str(e)}",
                    error_code="OPERATION_ERROR",
                    error_message=str(e)
                )
                results.append(result)
        
        return results
    
    async def move_file(self, file_id: str, target_folder_id: Optional[str], user_id: str) -> bool:
        """移动文件到指定文件夹"""
        try:
            update_request = FileUpdateRequest(folder_id=target_folder_id)
            await self.update_file(file_id, update_request, user_id)
            return True
        except Exception as e:
            logger.error(f"文件移动失败: {str(e)}")
            return False
    
    async def copy_file(self, file_id: str, target_folder_id: Optional[str], user_id: str) -> FileInfo:
        """复制文件"""
        return await self._copy_file(file_id, user_id, {"target_folder_id": target_folder_id})
    
    async def archive_file(self, file_id: str, user_id: str) -> bool:
        """归档文件"""
        try:
            file_info = await self.get_file(file_id, user_id=user_id)
            if not file_info:
                return False
            
            if not await self._check_file_access(file_info, user_id, FileOperation.UPDATE):
                return False
            
            await self.update_file_status(file_id, FileStatus.ARCHIVED)
            
            # 记录归档活动
            await self.log_activity(FileActivity(
                file_id=file_id,
                user_id=user_id,
                event_type=FileEvent.UPDATED,
                operation=FileOperation.ARCHIVE,
                description="文件已归档",
                success=True
            ))
            
            return True
        except Exception as e:
            logger.error(f"归档文件失败: {str(e)}")
            return False
    
    async def restore_file(self, file_id: str, user_id: str) -> bool:
        """恢复文件"""
        try:
            file_info = await self.get_file(file_id, user_id=user_id)
            if not file_info:
                return False
            
            if not await self._check_file_access(file_info, user_id, FileOperation.UPDATE):
                return False
            
            await self.update_file_status(file_id, FileStatus.ACTIVE)
            
            # 记录恢复活动
            await self.log_activity(FileActivity(
                file_id=file_id,
                user_id=user_id,
                event_type=FileEvent.UPDATED,
                operation=FileOperation.RESTORE,
                description="文件已恢复",
                success=True
            ))
            
            return True
        except Exception as e:
            logger.error(f"恢复文件失败: {str(e)}")
            return False
    
    # ======================== 文件夹树状结构 ========================
    
    async def get_folder_tree(self, user_id: str, root_id: Optional[str] = None, 
                             max_depth: int = 5, include_file_count: bool = False) -> List[Dict[str, Any]]:
        """
        获取文件夹树状结构
        
        Args:
            user_id: 用户ID
            root_id: 根文件夹ID，None表示从用户根目录开始
            max_depth: 最大深度
            include_file_count: 是否包含文件数量
            
        Returns:
            树状结构数据
        """
        try:
            async def build_tree(parent_id: Optional[str], current_depth: int) -> List[Dict[str, Any]]:
                if current_depth >= max_depth:
                    return []
                
                # 获取子文件夹
                folders = await self.list_folders(parent_id=parent_id, owner_id=user_id)
                tree = []
                
                for folder in folders:
                    node = {
                        "id": folder.id,
                        "name": folder.name,
                        "path": folder.path,
                        "level": folder.level,
                        "type": "folder",
                        "parent_id": folder.parent_id,
                        "created_at": folder.created_at.isoformat(),
                        "children": []
                    }
                    
                    if include_file_count:
                        node["file_count"] = folder.file_count
                        node["subfolder_count"] = folder.subfolder_count
                        node["total_size"] = folder.total_size
                    
                    # 递归获取子树
                    if current_depth < max_depth - 1:
                        node["children"] = await build_tree(folder.id, current_depth + 1)
                    
                    tree.append(node)
                
                return tree
            
            return await build_tree(root_id, 0)
            
        except Exception as e:
            logger.error(f"获取文件夹树失败: {str(e)}")
            return []
    
    async def get_folder_contents(self, folder_id: str, include_hidden: bool = False,
                                 sort_by: str = "name", sort_order: str = "asc",
                                 user_id: Optional[str] = None) -> FileListResponse:
        """
        获取文件夹内容
        
        Args:
            folder_id: 文件夹ID
            include_hidden: 是否包含隐藏文件
            sort_by: 排序字段
            sort_order: 排序顺序
            user_id: 用户ID
            
        Returns:
            文件夹内容
        """
        try:
            # 获取文件列表
            filters = {
                "folder_id": folder_id,
                "statuses": [FileStatus.ACTIVE, FileStatus.PROCESSING] if not include_hidden else None
            }
            
            if user_id:
                filters["owner_id"] = user_id
            
            files, total_count = await self.list_files(
                filters=filters,
                sort_by=sort_by,
                sort_order=sort_order,
                page=1,
                page_size=1000  # 获取所有文件
            )
            
            # 获取子文件夹
            folders = await self.list_folders(parent_id=folder_id, owner_id=user_id)
            
            return FileListResponse(
                files=files,
                folders=folders,
                total_count=total_count + len(folders),
                page=1,
                page_size=1000,
                total_pages=1,
                has_next=False,
                has_prev=False,
                total_size=sum(f.metadata.size for f in files),
                file_count=len(files),
                folder_count=len(folders)
            )
            
        except Exception as e:
            logger.error(f"获取文件夹内容失败: {str(e)}")
            return FileListResponse(
                files=[], folders=[], total_count=0, page=1, page_size=0,
                total_pages=0, has_next=False, has_prev=False
            )
    
    async def delete_folder(self, folder_id: str, recursive: bool = False, 
                           permanent: bool = False, user_id: str = None) -> bool:
        """
        删除文件夹
        
        Args:
            folder_id: 文件夹ID
            recursive: 是否递归删除
            permanent: 是否永久删除
            user_id: 操作用户ID
            
        Returns:
            是否删除成功
        """
        try:
            # 获取文件夹信息
            folder_info = await self.get_folder(folder_id)
            if not folder_info:
                raise FileNotFoundError(f"文件夹不存在: {folder_id}")
            
            # 权限检查
            if user_id and not await self._check_folder_access(folder_info, user_id, FileOperation.DELETE):
                raise PermissionDeniedError("没有删除权限")
            
            if recursive:
                # 递归删除所有文件和子文件夹
                await self._delete_folder_recursive(folder_id, permanent, user_id)
            else:
                # 检查文件夹是否为空
                contents = await self.get_folder_contents(folder_id, user_id=user_id)
                if contents.total_count > 0:
                    raise ValidationError("文件夹不为空，无法删除")
            
            # 删除文件夹记录
            if self.db_session:
                if permanent:
                    await self.db_session.execute(
                        delete(Folder).where(Folder.id == folder_id)
                    )
                else:
                    # 标记为已删除（如果有删除状态字段）
                    await self.db_session.execute(
                        update(Folder)
                        .where(Folder.id == folder_id)
                        .values(updated_at=datetime.now())
                    )
                
                await self.db_session.commit()
            
            logger.info(f"文件夹删除成功: {folder_id}")
            return True
            
        except (FileNotFoundError, PermissionDeniedError, ValidationError):
            raise
        except Exception as e:
            logger.error(f"删除文件夹失败: {str(e)}")
            if self.db_session:
                await self.db_session.rollback()
            return False
    
    async def update_folder(self, folder_id: str, update_data: Dict[str, Any], user_id: str) -> FolderInfo:
        """更新文件夹信息"""
        try:
            folder_info = await self.get_folder(folder_id)
            if not folder_info:
                raise FileNotFoundError(f"文件夹不存在: {folder_id}")
            
            # 权限检查
            if not await self._check_folder_access(folder_info, user_id, FileOperation.UPDATE):
                raise PermissionDeniedError("没有更新权限")
            
            # 构建更新字段
            update_fields = {
                "updated_at": datetime.now()
            }
            
            if "name" in update_data:
                if not FileValidator.validate_filename(update_data["name"]):
                    raise ValidationError("无效的文件夹名称")
                update_fields["name"] = update_data["name"]
            
            if "description" in update_data:
                update_fields["description"] = update_data["description"]
            
            if "parent_id" in update_data:
                # 验证新的父文件夹
                if update_data["parent_id"]:
                    parent_folder = await self.get_folder(update_data["parent_id"])
                    if not parent_folder:
                        raise ValidationError("父文件夹不存在")
                    update_fields["level"] = parent_folder.level + 1
                else:
                    update_fields["level"] = 0
                
                update_fields["parent_id"] = update_data["parent_id"]
            
            if "access_level" in update_data:
                update_fields["access_level"] = update_data["access_level"]
            
            # 执行更新
            if self.db_session:
                await self.db_session.execute(
                    update(Folder).where(Folder.id == folder_id).values(**update_fields)
                )
                await self.db_session.commit()
            
            # 获取更新后的文件夹信息
            updated_folder = await self.get_folder(folder_id)
            
            logger.info(f"文件夹更新成功: {folder_id}")
            return updated_folder
            
        except (FileNotFoundError, PermissionDeniedError, ValidationError):
            raise
        except Exception as e:
            logger.error(f"更新文件夹失败: {str(e)}")
            if self.db_session:
                await self.db_session.rollback()
            raise BusinessLogicError(f"更新文件夹失败: {str(e)}")
    
    # ======================== 清理和维护功能 ========================
    
    async def cleanup_deleted_files(self, max_age_days: int = 30):
        """清理已删除的文件"""
        try:
            cutoff_date = datetime.now() - timedelta(days=max_age_days)
            
            if self.db_session:
                # 查找需要清理的文件
                result = await self.db_session.execute(
                    select(File)
                    .where(
                        and_(
                            File.status == FileStatus.DELETED,
                            File.updated_at < cutoff_date
                        )
                    )
                )
                
                files_to_delete = result.scalars().all()
                
                for db_file in files_to_delete:
                    try:
                        # 删除物理文件
                        storage_manager = self._get_storage_manager(StorageProvider.LOCAL)
                        await storage_manager.delete_file(db_file.path)
                        
                        # 删除数据库记录
                        await self.db_session.execute(
                            delete(File).where(File.id == db_file.id)
                        )
                        
                        logger.info(f"清理已删除文件: {db_file.id}")
                        
                    except Exception as e:
                        logger.warning(f"清理文件失败: {db_file.id}, 错误: {e}")
                
                await self.db_session.commit()
                logger.info(f"清理已删除文件完成，共处理 {len(files_to_delete)} 个文件")
                
        except Exception as e:
            logger.error(f"清理已删除文件失败: {str(e)}")
            if self.db_session:
                await self.db_session.rollback()
    
    async def cleanup_expired_shares(self):
        """清理过期的分享"""
        try:
            if self.redis_client:
                # Redis会自动过期，这里可以做一些清理工作
                # 比如清理数据库中的分享记录
                pass
            
            logger.info("清理过期分享完成")
            
        except Exception as e:
            logger.error(f"清理过期分享失败: {str(e)}")
    
    async def get_activity_summary(self, file_id: str) -> Dict[str, int]:
        """获取文件活动汇总"""
        try:
            if not self.db_session:
                return {}
            
            result = await self.db_session.execute(
                select(
                    FileActivityModel.operation,
                    func.count(FileActivityModel.id)
                )
                .where(FileActivityModel.file_id == file_id)
                .group_by(FileActivityModel.operation)
            )
            
            summary = {}
            for operation, count in result.fetchall():
                summary[operation] = count
            
            return summary
            
        except Exception as e:
            logger.error(f"获取活动汇总失败: {str(e)}")
            return {}
    
    async def get_file_statistics(self, file_id: str) -> Dict[str, Any]:
        """获取单个文件的统计信息"""
        try:
            file_info = await self.get_file(file_id)
            if not file_info:
                return {}
            
            # 获取活动统计
            activity_summary = await self.get_activity_summary(file_id)
            
            # 获取下载统计
            download_count = file_info.download_count
            
            # 获取分享统计
            share_count = file_info.share_count
            
            return {
                "file_id": file_id,
                "download_count": download_count,
                "share_count": share_count,
                "view_count": file_info.view_count,
                "activity_summary": activity_summary,
                "last_accessed": None,  # 从活动记录中获取
                "total_activities": sum(activity_summary.values())
            }
            
        except Exception as e:
            logger.error(f"获取文件统计失败: {str(e)}")
            return {}
    
    async def list_file_permissions(self, file_id: str) -> List[Dict[str, Any]]:
        """获取文件权限列表"""
        try:
            if not self.db_session:
                return []
            
            result = await self.db_session.execute(
                select(FilePermissionModel)
                .where(FilePermissionModel.file_id == file_id)
                .order_by(FilePermissionModel.granted_at)
            )
            
            permissions = []
            for perm in result.scalars().all():
                permissions.append({
                    "user_id": perm.user_id,
                    "permission": perm.permission,
                    "granted_by": perm.granted_by,
                    "granted_at": perm.granted_at,
                    "expires_at": perm.expires_at,
                    "conditions": perm.conditions
                })
            
            return permissions
            
        except Exception as e:
            logger.error(f"获取权限列表失败: {str(e)}")
            return []
    
    # ======================== 内部辅助方法 ========================
    
    async def _validate_file_creation(self, file_info: FileInfo):
        """验证文件创建请求"""
        # 验证文件名
        if not FileValidator.validate_filename(file_info.name):
            raise ValidationError("无效的文件名")
        
        # 验证文件大小
        if not FileValidator.validate_file_size(file_info.metadata.size, file_info.metadata.file_type):
            raise ValidationError("文件大小超过限制")
        
        # 验证危险文件
        if FileValidator.is_dangerous_file(file_info.name):
            raise ValidationError("不允许上传此类型的文件")
        
        # 验证父文件夹（如果指定）
        if file_info.parent_folder_id:
            parent_folder = await self.get_folder(file_info.parent_folder_id)
            if not parent_folder:
                raise ValidationError("指定的父文件夹不存在")
            
            if parent_folder.owner_id != file_info.owner_id:
                raise ValidationError("没有权限在此文件夹中创建文件")
    
    async def _check_storage_quota(self, user_id: str, file_size: int):
        """检查存储配额"""
        try:
            # 获取用户当前使用的存储空间
            if self.db_session:
                result = await self.db_session.execute(
                    select(func.sum(File.size))
                    .where(
                        and_(
                            File.owner_id == user_id,
                            File.status != FileStatus.DELETED
                        )
                    )
                )
                current_usage = result.scalar() or 0
                
                # 这里应该从用户配置或系统配置中获取配额限制
                # 暂时设置为100GB
                quota_limit = 100 * 1024 * 1024 * 1024
                
                if current_usage + file_size > quota_limit:
                    raise ValidationError(f"存储空间不足，当前使用: {FileHelper.format_file_size(current_usage)}, 配额: {FileHelper.format_file_size(quota_limit)}")
                
        except ValidationError:
            raise
        except Exception as e:
            logger.warning(f"检查存储配额失败: {str(e)}")
            # 配额检查失败时允许继续，但记录警告
    
    async def _db_file_to_file_info(self, db_file) -> FileInfo:
        """将数据库文件记录转换为FileInfo对象"""
        # 构建元数据
        metadata_dict = db_file.metadata or {}
        metadata = FileMetadata(
            filename=db_file.name,
            original_filename=metadata_dict.get("original_filename", db_file.name),
            size=db_file.size,
            mime_type=db_file.mime_type,
            file_type=db_file.file_type,
            extension=metadata_dict.get("extension", ""),
            md5_hash=metadata_dict.get("md5_hash"),
            sha256_hash=metadata_dict.get("sha256_hash"),
            created_at=db_file.created_at,
            updated_at=db_file.updated_at,
            duration=metadata_dict.get("duration"),
            width=metadata_dict.get("width"),
            height=metadata_dict.get("height"),
            bitrate=metadata_dict.get("bitrate"),
            custom_metadata=metadata_dict.get("custom_metadata", {})
        )
        
        # 构建安全信息
        security_dict = db_file.security or {}
        security = FileSecurityInfo(
            access_level=security_dict.get("access_level", FileAccessLevel.PRIVATE),
            encryption_enabled=security_dict.get("encryption_enabled", False),
            scan_status=security_dict.get("scan_status", ScanStatus.PENDING),
            scan_result=security_dict.get("scan_result"),
            last_scanned_at=security_dict.get("last_scanned_at")
        )
        
        # 构建存储信息
        storage = FileStorageInfo(
            provider=StorageProvider.LOCAL,  # 默认本地存储
            key=db_file.path,
            storage_class="standard"
        )
        
        # 构建文件信息
        file_info = FileInfo(
            id=db_file.id,
            name=db_file.name,
            path=db_file.path,
            status=db_file.status,
            owner_id=db_file.owner_id,
            created_by=db_file.created_by,
            updated_by=getattr(db_file, 'updated_by', None),
            category=db_file.category,
            tags=db_file.tags or [],
            description=db_file.description,
            parent_folder_id=db_file.parent_folder_id,
            created_at=db_file.created_at,
            updated_at=db_file.updated_at,
            metadata=metadata,
            security=security,
            storage=storage,
            download_count=getattr(db_file, 'download_count', 0),
            view_count=getattr(db_file, 'view_count', 0),
            share_count=getattr(db_file, 'share_count', 0),
            thumbnail_url=getattr(db_file, 'thumbnail_url', None),
            custom_fields=getattr(db_file, 'custom_fields', {})
        )
        
        return file_info
    
    async def _check_file_access(self, file_info: FileInfo, user_id: str, 
                                operation: FileOperation) -> bool:
        """检查文件访问权限"""
        try:
            # 文件所有者拥有所有权限
            if file_info.owner_id == user_id:
                return True
            
            # 检查公开文件的读取权限
            if (file_info.security.access_level == FileAccessLevel.PUBLIC and 
                operation in [FileOperation.READ, FileOperation.DOWNLOAD]):
                return True
            
            # 检查特定权限
            user_permissions = await self.get_user_permissions(file_info.id, user_id)
            return operation in user_permissions
            
        except Exception as e:
            logger.error(f"权限检查失败: {str(e)}")
            return False
    
    async def _check_folder_access(self, folder_info: FolderInfo, user_id: str,
                                  operation: FileOperation) -> bool:
        """检查文件夹访问权限"""
        # 文件夹所有者拥有所有权限
        if folder_info.owner_id == user_id:
            return True
        
        # 检查公开文件夹的读取权限
        if (folder_info.access_level == FileAccessLevel.PUBLIC and 
            operation == FileOperation.READ):
            return True
        
        # 其他权限检查逻辑...
        return False
    
    async def _update_folder_stats(self, folder_id: str, 
                                  size_delta: int = 0, file_delta: int = 0):
        """更新文件夹统计信息"""
        try:
            if self.db_session:
                await self.db_session.execute(
                    update(Folder)
                    .where(Folder.id == folder_id)
                    .values(
                        file_count=Folder.file_count + file_delta,
                        total_size=Folder.total_size + size_delta,
                        updated_at=datetime.now()
                    )
                )
                await self.db_session.commit()
                
        except Exception as e:
            logger.error(f"更新文件夹统计失败: {str(e)}")
    
    async def _get_file_versions(self, file_id: str) -> List[FileVersion]:
        """获取文件版本历史"""
        # 这里应该从版本表中查询
        # 暂时返回空列表
        return []
    
    async def _clear_file_cache(self, file_id: str, owner_id: Optional[str] = None):
        """清除文件相关缓存"""
        if self.redis_client:
            try:
                # 清除文件信息缓存
                await self.redis_client.delete(f"file:{file_id}")
                
                # 清除用户文件列表缓存
                if owner_id:
                    keys_pattern = f"file_list:{owner_id}:*"
                    keys = await self.redis_client.keys(keys_pattern)
                    if keys:
                        await self.redis_client.delete(*keys)
                        
            except Exception as e:
                logger.error(f"清除缓存失败: {str(e)}")
    
    async def _write_activity_log(self, activity: FileActivity):
        """写入活动日志到外部系统"""
        try:
            # 这里可以集成外部日志系统，如ELK、Splunk等
            log_data = {
                "timestamp": activity.timestamp.isoformat(),
                "file_id": activity.file_id,
                "user_id": activity.user_id,
                "operation": activity.operation,
                "success": activity.success,
                "ip_address": activity.ip_address,
                "user_agent": activity.user_agent
            }
            
            # 异步写入日志
            logger.info(f"文件活动: {json.dumps(log_data)}")
            
        except Exception as e:
            logger.error(f"写入活动日志失败: {str(e)}")
    
    def _get_storage_manager(self, provider: StorageProvider):
        """获取存储管理器"""
        manager = self._storage_managers.get(provider)
        if not manager:
            # 回退到本地存储
            manager = self._storage_managers.get(StorageProvider.LOCAL)
        return manager
    
    async def _copy_file(self, file_id: str, user_id: str, kwargs: Dict[str, Any]) -> FileInfo:
        """复制文件内部方法"""
        try:
            # 获取原文件信息
            original_file = await self.get_file(file_id, user_id=user_id)
            if not original_file:
                raise FileNotFoundError(f"文件不存在: {file_id}")
            
            # 检查复制权限
            if not await self._check_file_access(original_file, user_id, FileOperation.COPY):
                raise PermissionDeniedError("没有复制权限")
            
            # 创建新的文件信息
            new_file_id = str(uuid.uuid4())
            target_folder_id = kwargs.get("target_folder_id", original_file.parent_folder_id)
            
            # 生成新的文件名（避免重名）
            new_name = f"副本_{original_file.name}"
            
            # 复制物理文件
            storage_manager = self._get_storage_manager(original_file.storage.provider)
            original_data = await storage_manager.get_file(original_file.storage.key)
            
            # 生成新的存储键
            new_storage_key = f"files/{user_id}/{new_file_id}_{new_name}"
            await storage_manager.save_file(original_data, new_storage_key)
            
            # 创建新文件记录
            new_file_info = FileInfo(
                id=new_file_id,
                name=new_name,
                path=new_storage_key,
                owner_id=user_id,
                created_by=user_id,
                parent_folder_id=target_folder_id,
                metadata=original_file.metadata.model_copy(),
                security=original_file.security.model_copy(),
                storage=original_file.storage.model_copy(),
                tags=original_file.tags.copy(),
                category=original_file.category,
                description=f"复制自: {original_file.name}",
                status=FileStatus.ACTIVE
            )
            
            # 更新存储信息
            new_file_info.storage.key = new_storage_key
            
            # 保存新文件记录
            created_file = await self.create_file(new_file_info)
            
            # 记录复制活动
            await self.log_activity(FileActivity(
                file_id=file_id,
                user_id=user_id,
                event_type=FileEvent.COPIED,
                operation=FileOperation.COPY,
                description=f"文件已复制，新文件ID: {new_file_id}",
                details={"new_file_id": new_file_id, "target_folder_id": target_folder_id},
                success=True
            ))
            
            return created_file
            
        except (FileNotFoundError, PermissionDeniedError):
            raise
        except Exception as e:
            logger.error(f"复制文件失败: {str(e)}")
            raise BusinessLogicError(f"复制文件失败: {str(e)}")
    
    async def _delete_folder_recursive(self, folder_id: str, permanent: bool, user_id: Optional[str]):
        """递归删除文件夹内容"""
        try:
            # 获取文件夹内容
            contents = await self.get_folder_contents(folder_id, include_hidden=True, user_id=user_id)
            
            # 删除所有文件
            for file_info in contents.files:
                try:
                    if permanent:
                        await self.delete_file_permanently(file_info.id, user_id)
                    else:
                        await self.mark_as_deleted(file_info.id, user_id)
                except Exception as e:
                    logger.warning(f"删除文件失败: {file_info.id}, 错误: {e}")
            
            # 递归删除子文件夹
            for subfolder in contents.folders:
                try:
                    await self._delete_folder_recursive(subfolder.id, permanent, user_id)
                    
                    # 删除子文件夹记录
                    if self.db_session:
                        if permanent:
                            await self.db_session.execute(
                                delete(Folder).where(Folder.id == subfolder.id)
                            )
                        else:
                            await self.db_session.execute(
                                update(Folder)
                                .where(Folder.id == subfolder.id)
                                .values(updated_at=datetime.now())
                            )
                        await self.db_session.commit()
                        
                except Exception as e:
                    logger.warning(f"删除子文件夹失败: {subfolder.id}, 错误: {e}")
                    
        except Exception as e:
            logger.error(f"递归删除文件夹内容失败: {str(e)}")
            raise
    
    def _generate_share_code(self, length: int = 6) -> str:
        """生成分享码"""
        import random
        import string
        
        chars = string.ascii_uppercase + string.digits
        return ''.join(random.choices(chars, k=length))
    
    def _hash_password(self, password: str) -> str:
        """哈希密码"""
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest()
    
    def _verify_password(self, password: str, hashed: str) -> bool:
        """验证密码"""
        return self._hash_password(password) == hashed

# ======================== 存储管理器 ========================

class StorageManager:
    """存储管理器基类"""
    
    async def save_file(self, file_data: bytes, key: str) -> str:
        """保存文件"""
        raise NotImplementedError
    
    async def get_file(self, key: str) -> bytes:
        """获取文件"""
        raise NotImplementedError
    
    async def delete_file(self, key: str) -> bool:
        """删除文件"""
        raise NotImplementedError
    
    async def get_file_url(self, key: str, expires_in: int = 3600) -> str:
        """获取文件访问URL"""
        raise NotImplementedError

class LocalStorageManager(StorageManager):
    """本地存储管理器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.base_path = Path(config.get("base_path", "uploads"))
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    async def save_file(self, file_data: bytes, key: str) -> str:
        file_path = self.base_path / key
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        if HAS_AIOFILES:
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(file_data)
        else:
            # 回退到同步操作
            with open(file_path, 'wb') as f:
                f.write(file_data)
        
        return str(file_path)
    
    async def get_file(self, key: str) -> bytes:
        file_path = self.base_path / key
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {key}")
        
        if HAS_AIOFILES:
            async with aiofiles.open(file_path, 'rb') as f:
                return await f.read()
        else:
            # 回退到同步操作
            with open(file_path, 'rb') as f:
                return f.read()
    
    async def delete_file(self, key: str) -> bool:
        file_path = self.base_path / key
        try:
            file_path.unlink()
            return True
        except FileNotFoundError:
            return True
        except Exception:
            return False
    
    async def get_file_url(self, key: str, expires_in: int = 3600) -> str:
        # 本地存储返回相对路径
        return f"/files/download/{key}"
    
    async def file_exists(self, key: str) -> bool:
        """检查文件是否存在"""
        file_path = self.base_path / key
        return file_path.exists()
    
    async def get_file_info(self, key: str) -> Dict[str, Any]:
        """获取文件信息"""
        file_path = self.base_path / key
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {key}")
        
        stat = file_path.stat()
        return {
            "size": stat.st_size,
            "modified_time": datetime.fromtimestamp(stat.st_mtime),
            "created_time": datetime.fromtimestamp(stat.st_ctime),
            "path": str(file_path)
        }

class S3StorageManager(StorageManager):
    """AWS S3存储管理器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        # 这里应该初始化S3客户端
        # self.s3_client = boto3.client('s3', ...)
    
    async def save_file(self, file_data: bytes, key: str) -> str:
        """保存文件到S3 - 需要boto3支持"""
        # 实际实现需要boto3:
        # self.s3_client.put_object(
        #     Bucket=self.bucket_name,
        #     Key=key,
        #     Body=file_data
        # )
        logger.warning("S3存储管理器需要boto3支持，当前为占位符实现")
        return f"s3://{self.config.get('bucket_name', 'default')}/{key}"
    
    async def get_file(self, key: str) -> bytes:
        """从S3获取文件 - 需要boto3支持"""
        # 实际实现需要boto3:
        # response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
        # return response['Body'].read()
        logger.warning("S3存储管理器需要boto3支持，当前为占位符实现")
        raise NotImplementedError("S3存储管理器需要boto3支持")
    
    async def delete_file(self, key: str) -> bool:
        """从S3删除文件 - 需要boto3支持"""
        # 实际实现需要boto3:
        # self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
        logger.warning("S3存储管理器需要boto3支持，当前为占位符实现")
        return True
    
    async def get_file_url(self, key: str, expires_in: int = 3600) -> str:
        """生成S3预签名URL - 需要boto3支持"""
        # 实际实现需要boto3:
        # return self.s3_client.generate_presigned_url(
        #     'get_object',
        #     Params={'Bucket': self.bucket_name, 'Key': key},
        #     ExpiresIn=expires_in
        # )
        bucket_name = self.config.get('bucket_name', 'default')
        region = self.config.get('region', 'us-east-1')
        return f"https://{bucket_name}.s3.{region}.amazonaws.com/{key}"

class OSSStorageManager(StorageManager):
    """阿里云OSS存储管理器"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        # 这里应该初始化OSS客户端
    
    async def save_file(self, file_data: bytes, key: str) -> str:
        """保存文件到阿里云OSS - 需要oss2支持"""
        # 实际实现需要oss2:
        # result = self.bucket.put_object(key, file_data)
        # return result.resp.response.url
        logger.warning("OSS存储管理器需要oss2支持，当前为占位符实现")
        bucket_name = self.config.get('bucket_name', 'default')
        endpoint = self.config.get('endpoint', 'oss-cn-hangzhou.aliyuncs.com')
        return f"https://{bucket_name}.{endpoint}/{key}"
    
    async def get_file(self, key: str) -> bytes:
        """从阿里云OSS获取文件 - 需要oss2支持"""
        # 实际实现需要oss2:
        # result = self.bucket.get_object(key)
        # return result.read()
        logger.warning("OSS存储管理器需要oss2支持，当前为占位符实现")
        raise NotImplementedError("OSS存储管理器需要oss2支持")
    
    async def delete_file(self, key: str) -> bool:
        """从阿里云OSS删除文件 - 需要oss2支持"""
        # 实际实现需要oss2:
        # result = self.bucket.delete_object(key)
        # return result.status == 204
        logger.warning("OSS存储管理器需要oss2支持，当前为占位符实现")
        return True
    
    async def get_file_url(self, key: str, expires_in: int = 3600) -> str:
        """生成阿里云OSS预签名URL - 需要oss2支持"""
        # 实际实现需要oss2:
        # return self.bucket.sign_url('GET', key, expires_in)
        bucket_name = self.config.get('bucket_name', 'default')
        endpoint = self.config.get('endpoint', 'oss-cn-hangzhou.aliyuncs.com')
        return f"https://{bucket_name}.{endpoint}/{key}"

# ======================== EXPORT ========================

__all__ = [
    'FileService',
    'StorageManager',
    'LocalStorageManager',
    'S3StorageManager', 
    'OSSStorageManager'
]
