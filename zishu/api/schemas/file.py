#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
文件相关数据模型 - Pydantic 接口层模型
提供完整的文件API接口数据验证和序列化
"""

from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from typing import Optional, List, Any, Dict, Union, Literal, BinaryIO
from datetime import datetime, timedelta
from enum import Enum
import uuid
import re
import os
import mimetypes
from pathlib import Path

# ======================== 枚举定义 ========================


class FileType(str, Enum):
    """文件类型枚举"""

    # 文档类型
    DOCUMENT = "document"
    TEXT = "text"
    PDF = "pdf"
    WORD = "word"
    EXCEL = "excel"
    POWERPOINT = "powerpoint"

    # 图片类型
    IMAGE = "image"
    PHOTO = "photo"
    AVATAR = "avatar"
    ICON = "icon"

    # 音频类型
    AUDIO = "audio"
    MUSIC = "music"
    VOICE = "voice"
    PODCAST = "podcast"

    # 视频类型
    VIDEO = "video"
    MOVIE = "movie"
    CLIP = "clip"
    TUTORIAL = "tutorial"

    # 代码类型
    CODE = "code"
    SCRIPT = "script"
    CONFIG = "config"

    # 数据类型
    DATA = "data"
    DATABASE = "database"
    JSON = "json"
    XML = "xml"
    CSV = "csv"

    # 压缩文件
    ARCHIVE = "archive"
    ZIP = "zip"
    RAR = "rar"

    # 其他
    BINARY = "binary"
    OTHER = "other"
    UNKNOWN = "unknown"


class FileStatus(str, Enum):
    """文件状态枚举"""

    UPLOADING = "uploading"  # 上传中
    PROCESSING = "processing"  # 处理中
    ACTIVE = "active"  # 正常可用
    ARCHIVED = "archived"  # 已归档
    LOCKED = "locked"  # 已锁定
    CORRUPTED = "corrupted"  # 已损坏
    DELETED = "deleted"  # 已删除
    QUARANTINE = "quarantine"  # 隔离状态（疑似病毒）


class FileAccessLevel(str, Enum):
    """文件访问级别枚举"""

    PUBLIC = "public"  # 公开访问
    INTERNAL = "internal"  # 内部访问
    PRIVATE = "private"  # 私有访问
    RESTRICTED = "restricted"  # 受限访问
    CONFIDENTIAL = "confidential"  # 机密文件


class FileOperation(str, Enum):
    """文件操作类型枚举"""

    CREATE = "create"  # 创建
    READ = "read"  # 读取
    UPDATE = "update"  # 更新
    DELETE = "delete"  # 删除
    COPY = "copy"  # 复制
    MOVE = "move"  # 移动
    RENAME = "rename"  # 重命名
    DOWNLOAD = "download"  # 下载
    UPLOAD = "upload"  # 上传
    SHARE = "share"  # 分享
    ARCHIVE = "archive"  # 归档
    RESTORE = "restore"  # 恢复


class StorageProvider(str, Enum):
    """存储提供商枚举"""

    LOCAL = "local"  # 本地存储
    AWS_S3 = "aws_s3"  # Amazon S3
    ALIYUN_OSS = "aliyun_oss"  # 阿里云OSS
    QCLOUD_COS = "qcloud_cos"  # 腾讯云COS
    BAIDU_BOS = "baidu_bos"  # 百度云BOS
    MINIO = "minio"  # MinIO
    FTP = "ftp"  # FTP服务器
    SFTP = "sftp"  # SFTP服务器


class ScanStatus(str, Enum):
    """文件扫描状态枚举"""

    PENDING = "pending"  # 待扫描
    SCANNING = "scanning"  # 扫描中
    CLEAN = "clean"  # 干净无毒
    INFECTED = "infected"  # 发现病毒
    SUSPICIOUS = "suspicious"  # 可疑文件
    ERROR = "error"  # 扫描出错
    SKIPPED = "skipped"  # 跳过扫描


class FileEvent(str, Enum):
    """文件事件类型枚举"""

    CREATED = "created"  # 文件创建
    UPDATED = "updated"  # 文件更新
    DELETED = "deleted"  # 文件删除
    ACCESSED = "accessed"  # 文件访问
    SHARED = "shared"  # 文件分享
    DOWNLOADED = "downloaded"  # 文件下载
    RENAMED = "renamed"  # 文件重命名
    MOVED = "moved"  # 文件移动
    COPIED = "copied"  # 文件复制
    SCANNED = "scanned"  # 文件扫描


# ======================== 基础模型 ========================


class FileMetadata(BaseModel):
    """文件元数据模型"""

    # 基本信息
    filename: str = Field(..., min_length=1, max_length=255, description="文件名")
    original_filename: Optional[str] = Field(None, description="原始文件名")
    size: int = Field(..., ge=0, description="文件大小(字节)")
    mime_type: str = Field(..., description="MIME类型")
    file_type: FileType = Field(..., description="文件类型")
    extension: str = Field(..., description="文件扩展名")

    # 哈希值
    md5_hash: Optional[str] = Field(None, description="MD5哈希值")
    sha256_hash: Optional[str] = Field(None, description="SHA256哈希值")

    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    accessed_at: Optional[datetime] = Field(None, description="最后访问时间")

    # 媒体文件特有信息
    duration: Optional[float] = Field(None, description="音视频时长(秒)")
    width: Optional[int] = Field(None, description="图片/视频宽度")
    height: Optional[int] = Field(None, description="图片/视频高度")
    bitrate: Optional[int] = Field(None, description="比特率")

    # 文档文件特有信息
    page_count: Optional[int] = Field(None, description="页数")
    word_count: Optional[int] = Field(None, description="字数")
    language: Optional[str] = Field(None, description="文档语言")

    # 扩展信息
    custom_metadata: Dict[str, Any] = Field(default_factory=dict, description="自定义元数据")

    # 验证器
    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v):
        # 文件名不能包含特殊字符
        if re.search(r'[<>:"/\\|?*]', v):
            raise ValueError('文件名不能包含特殊字符: <>:"/\\|?*')
        return v.strip()

    @field_validator("extension")
    @classmethod
    def validate_extension(cls, v):
        # 扩展名应该以点开头
        if v and not v.startswith("."):
            v = "." + v
        return v.lower()


class FilePermission(BaseModel):
    """文件权限模型"""

    user_id: str = Field(..., description="用户ID")
    permission: FileOperation = Field(..., description="权限类型")
    granted_by: str = Field(..., description="授权者ID")
    granted_at: datetime = Field(default_factory=datetime.now, description="授权时间")
    expires_at: Optional[datetime] = Field(None, description="权限过期时间")
    conditions: Optional[Dict[str, Any]] = Field(None, description="权限条件")


class FileSecurityInfo(BaseModel):
    """文件安全信息模型"""

    access_level: FileAccessLevel = Field(
        default=FileAccessLevel.PRIVATE, description="访问级别"
    )
    encryption_enabled: bool = Field(default=False, description="是否启用加密")
    encryption_algorithm: Optional[str] = Field(None, description="加密算法")

    # 病毒扫描
    scan_status: ScanStatus = Field(default=ScanStatus.PENDING, description="扫描状态")
    scan_result: Optional[Dict[str, Any]] = Field(None, description="扫描结果")
    last_scanned_at: Optional[datetime] = Field(None, description="最后扫描时间")

    # 访问控制
    allowed_users: List[str] = Field(default_factory=list, description="允许访问的用户ID列表")
    blocked_users: List[str] = Field(default_factory=list, description="禁止访问的用户ID列表")
    ip_whitelist: List[str] = Field(default_factory=list, description="IP白名单")
    ip_blacklist: List[str] = Field(default_factory=list, description="IP黑名单")

    # 审计
    audit_enabled: bool = Field(default=False, description="是否启用审计")
    retention_days: Optional[int] = Field(None, description="保留天数")


class FileStorageInfo(BaseModel):
    """文件存储信息模型"""

    provider: StorageProvider = Field(..., description="存储提供商")
    bucket: Optional[str] = Field(None, description="存储桶/容器名")
    key: str = Field(..., description="存储键/路径")
    region: Optional[str] = Field(None, description="存储区域")
    storage_class: Optional[str] = Field(None, description="存储类别")
    cdn_url: Optional[str] = Field(None, description="CDN访问URL")
    backup_locations: List[str] = Field(default_factory=list, description="备份位置")

    # 存储配置
    auto_backup: bool = Field(default=False, description="是否自动备份")
    compression_enabled: bool = Field(default=False, description="是否启用压缩")
    versioning_enabled: bool = Field(default=False, description="是否启用版本控制")


class FileVersion(BaseModel):
    """文件版本模型"""

    version_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), description="版本ID"
    )
    version_number: int = Field(..., ge=1, description="版本号")
    created_by: str = Field(..., description="创建者ID")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    size: int = Field(..., ge=0, description="文件大小")

    # 变更信息
    change_summary: Optional[str] = Field(None, max_length=500, description="变更摘要")
    change_type: Literal["major", "minor", "patch"] = Field(
        default="minor", description="变更类型"
    )

    # 存储信息
    storage_key: str = Field(..., description="存储键")
    is_current: bool = Field(default=False, description="是否为当前版本")
    is_deleted: bool = Field(default=False, description="是否已删除")


class FileBase(BaseModel):
    """文件基础模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="文件唯一ID")
    name: str = Field(..., min_length=1, max_length=255, description="文件名")
    path: str = Field(..., description="文件路径")
    status: FileStatus = Field(default=FileStatus.ACTIVE, description="文件状态")

    # 所有者信息
    owner_id: str = Field(..., description="文件所有者ID")
    created_by: str = Field(..., description="创建者ID")
    updated_by: Optional[str] = Field(None, description="最后更新者ID")

    # 分类和标签
    category: Optional[str] = Field(None, max_length=100, description="文件分类")
    tags: List[str] = Field(default_factory=list, description="文件标签")
    description: Optional[str] = Field(None, max_length=1000, description="文件描述")

    # 关联信息
    parent_folder_id: Optional[str] = Field(None, description="父文件夹ID")
    project_id: Optional[str] = Field(None, description="关联项目ID")

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

    # 验证器
    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if len(v) > 20:
            raise ValueError("标签数量不能超过20个")
        return [tag.strip().lower() for tag in v if tag.strip()]


class FileInfo(FileBase):
    """完整文件信息模型"""

    metadata: FileMetadata = Field(..., description="文件元数据")
    security: FileSecurityInfo = Field(
        default_factory=FileSecurityInfo, description="安全信息"
    )
    storage: FileStorageInfo = Field(..., description="存储信息")

    # 版本信息
    current_version: int = Field(default=1, description="当前版本号")
    versions: List[FileVersion] = Field(default_factory=list, description="版本历史")

    # 权限
    permissions: List[FilePermission] = Field(default_factory=list, description="文件权限")

    # 统计信息
    download_count: int = Field(default=0, description="下载次数")
    view_count: int = Field(default=0, description="查看次数")
    share_count: int = Field(default=0, description="分享次数")

    # 扩展信息
    thumbnail_url: Optional[str] = Field(None, description="缩略图URL")
    preview_url: Optional[str] = Field(None, description="预览URL")
    download_url: Optional[str] = Field(None, description="下载URL")

    # 关联文件
    related_files: List[str] = Field(default_factory=list, description="相关文件ID列表")

    # 自定义属性
    custom_fields: Dict[str, Any] = Field(default_factory=dict, description="自定义字段")


class FileActivity(BaseModel):
    """文件活动记录模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="活动记录ID")
    file_id: str = Field(..., description="文件ID")
    user_id: str = Field(..., description="操作用户ID")
    event_type: FileEvent = Field(..., description="事件类型")
    operation: FileOperation = Field(..., description="操作类型")

    # 操作详情
    description: str = Field(..., description="操作描述")
    details: Dict[str, Any] = Field(default_factory=dict, description="操作详情")

    # 环境信息
    ip_address: Optional[str] = Field(None, description="IP地址")
    user_agent: Optional[str] = Field(None, description="用户代理")
    session_id: Optional[str] = Field(None, description="会话ID")

    # 结果信息
    success: bool = Field(..., description="操作是否成功")
    error_message: Optional[str] = Field(None, description="错误信息")
    duration: Optional[float] = Field(None, description="操作耗时(秒)")

    # 时间戳
    timestamp: datetime = Field(default_factory=datetime.now, description="操作时间")


# ======================== 文件夹模型 ========================


class FolderInfo(BaseModel):
    """文件夹信息模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="文件夹ID")
    name: str = Field(..., min_length=1, max_length=255, description="文件夹名称")
    path: str = Field(..., description="文件夹路径")
    description: Optional[str] = Field(None, max_length=1000, description="文件夹描述")

    # 层级信息
    parent_id: Optional[str] = Field(None, description="父文件夹ID")
    level: int = Field(default=0, ge=0, description="层级深度")

    # 所有者信息
    owner_id: str = Field(..., description="文件夹所有者ID")
    created_by: str = Field(..., description="创建者ID")

    # 权限和访问控制
    access_level: FileAccessLevel = Field(
        default=FileAccessLevel.PRIVATE, description="访问级别"
    )
    permissions: List[FilePermission] = Field(default_factory=list, description="文件夹权限")

    # 统计信息
    file_count: int = Field(default=0, description="文件数量")
    subfolder_count: int = Field(default=0, description="子文件夹数量")
    total_size: int = Field(default=0, description="总大小(字节)")

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

    # 验证器
    @field_validator("name")
    @classmethod
    def validate_folder_name(cls, v):
        if re.search(r'[<>:"/\\|?*]', v):
            raise ValueError('文件夹名称不能包含特殊字符: <>:"/\\|?*')
        return v.strip()


# ======================== 请求模型 ========================


class FileUploadRequest(BaseModel):
    """文件上传请求模型"""

    filename: str = Field(..., min_length=1, max_length=255, description="文件名")
    size: int = Field(
        ..., ge=1, le=5 * 1024 * 1024 * 1024, description="文件大小(字节,最大5GB)"
    )
    mime_type: Optional[str] = Field(None, description="MIME类型")

    # 存储选项
    folder_id: Optional[str] = Field(None, description="目标文件夹ID")
    storage_provider: Optional[StorageProvider] = Field(
        StorageProvider.LOCAL, description="存储提供商"
    )

    # 文件信息
    description: Optional[str] = Field(None, max_length=1000, description="文件描述")
    tags: List[str] = Field(default_factory=list, description="文件标签")
    category: Optional[str] = Field(None, max_length=100, description="文件分类")

    # 权限设置
    access_level: FileAccessLevel = Field(
        default=FileAccessLevel.PRIVATE, description="访问级别"
    )
    auto_scan: bool = Field(default=True, description="是否自动病毒扫描")

    # 处理选项
    auto_generate_thumbnail: bool = Field(default=True, description="是否自动生成缩略图")
    auto_extract_metadata: bool = Field(default=True, description="是否自动提取元数据")

    # 自定义字段
    custom_fields: Optional[Dict[str, Any]] = Field(None, description="自定义字段")


class FileUpdateRequest(BaseModel):
    """文件更新请求模型"""

    name: Optional[str] = Field(None, min_length=1, max_length=255, description="新文件名")
    description: Optional[str] = Field(None, max_length=1000, description="文件描述")
    tags: Optional[List[str]] = Field(None, description="文件标签")
    category: Optional[str] = Field(None, max_length=100, description="文件分类")

    # 移动操作
    folder_id: Optional[str] = Field(None, description="目标文件夹ID")

    # 权限更新
    access_level: Optional[FileAccessLevel] = Field(None, description="访问级别")

    # 自定义字段更新
    custom_fields: Optional[Dict[str, Any]] = Field(None, description="自定义字段")


class FilePermissionRequest(BaseModel):
    """文件权限请求模型"""

    user_id: str = Field(..., description="用户ID")
    permission: FileOperation = Field(..., description="权限类型")
    expires_at: Optional[datetime] = Field(None, description="权限过期时间")
    conditions: Optional[Dict[str, Any]] = Field(None, description="权限条件")


class FileBatchOperationRequest(BaseModel):
    """文件批量操作请求模型"""

    file_ids: List[str] = Field(..., min_length=1, max_length=100, description="文件ID列表")
    operation: FileOperation = Field(..., description="操作类型")

    # 操作参数
    target_folder_id: Optional[str] = Field(None, description="目标文件夹ID(用于移动操作)")
    new_access_level: Optional[FileAccessLevel] = Field(None, description="新访问级别")
    tags_to_add: Optional[List[str]] = Field(None, description="要添加的标签")
    tags_to_remove: Optional[List[str]] = Field(None, description="要移除的标签")

    # 其他参数
    force_operation: bool = Field(default=False, description="是否强制执行")
    skip_errors: bool = Field(default=True, description="是否跳过错误继续执行")


class FileSearchRequest(BaseModel):
    """文件搜索请求模型"""

    # 搜索条件
    query: Optional[str] = Field(None, min_length=1, description="搜索关键词")
    file_types: Optional[List[FileType]] = Field(None, description="文件类型过滤")
    statuses: Optional[List[FileStatus]] = Field(None, description="文件状态过滤")

    # 范围过滤
    folder_id: Optional[str] = Field(None, description="搜索文件夹ID")
    owner_id: Optional[str] = Field(None, description="文件所有者ID")
    tags: Optional[List[str]] = Field(None, description="标签过滤")
    category: Optional[str] = Field(None, description="分类过滤")

    # 大小过滤
    min_size: Optional[int] = Field(None, ge=0, description="最小文件大小")
    max_size: Optional[int] = Field(None, ge=0, description="最大文件大小")

    # 时间过滤
    created_after: Optional[datetime] = Field(None, description="创建时间起始")
    created_before: Optional[datetime] = Field(None, description="创建时间结束")
    updated_after: Optional[datetime] = Field(None, description="更新时间起始")
    updated_before: Optional[datetime] = Field(None, description="更新时间结束")

    # 排序和分页
    sort_by: Optional[str] = Field("created_at", description="排序字段")
    sort_order: Literal["asc", "desc"] = Field("desc", description="排序顺序")
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页大小")

    # 包含选项
    include_metadata: bool = Field(default=True, description="是否包含元数据")
    include_permissions: bool = Field(default=False, description="是否包含权限信息")
    include_versions: bool = Field(default=False, description="是否包含版本历史")


class FolderCreateRequest(BaseModel):
    """文件夹创建请求模型"""

    name: str = Field(..., min_length=1, max_length=255, description="文件夹名称")
    parent_id: Optional[str] = Field(None, description="父文件夹ID")
    description: Optional[str] = Field(None, max_length=1000, description="文件夹描述")
    access_level: FileAccessLevel = Field(
        default=FileAccessLevel.PRIVATE, description="访问级别"
    )


class FileShareRequest(BaseModel):
    """文件分享请求模型"""

    file_ids: List[str] = Field(..., min_length=1, description="要分享的文件ID列表")
    share_type: Literal["public", "private", "password"] = Field(
        ..., description="分享类型"
    )

    # 分享选项
    password: Optional[str] = Field(None, min_length=6, description="分享密码")
    expires_at: Optional[datetime] = Field(None, description="分享过期时间")
    max_downloads: Optional[int] = Field(None, ge=1, description="最大下载次数")
    allow_preview: bool = Field(default=True, description="是否允许预览")

    # 通知选项
    notify_users: List[str] = Field(default_factory=list, description="通知用户ID列表")
    custom_message: Optional[str] = Field(None, max_length=500, description="自定义消息")


# ======================== 响应模型 ========================


class FileUploadResponse(BaseModel):
    """文件上传响应模型"""

    file_id: str = Field(..., description="文件ID")
    filename: str = Field(..., description="文件名")
    size: int = Field(..., description="文件大小")
    mime_type: str = Field(..., description="MIME类型")
    file_type: FileType = Field(..., description="文件类型")

    # 上传信息
    upload_id: str = Field(..., description="上传ID")
    upload_url: Optional[str] = Field(None, description="上传URL")
    chunk_upload: bool = Field(default=False, description="是否分块上传")
    chunk_size: Optional[int] = Field(None, description="分块大小")

    # 状态信息
    status: FileStatus = Field(..., description="文件状态")
    processing_status: Optional[str] = Field(None, description="处理状态")

    # URL信息
    access_url: Optional[str] = Field(None, description="访问URL")
    download_url: Optional[str] = Field(None, description="下载URL")
    preview_url: Optional[str] = Field(None, description="预览URL")

    # 时间信息
    uploaded_at: datetime = Field(default_factory=datetime.now, description="上传时间")
    expires_at: Optional[datetime] = Field(None, description="过期时间")


class FileInfoResponse(BaseModel):
    """文件信息响应模型"""

    file: FileInfo = Field(..., description="文件信息")

    # 权限信息
    user_permissions: List[FileOperation] = Field(
        default_factory=list, description="用户权限"
    )
    can_download: bool = Field(..., description="是否可下载")
    can_edit: bool = Field(..., description="是否可编辑")
    can_delete: bool = Field(..., description="是否可删除")
    can_share: bool = Field(..., description="是否可分享")

    # 统计信息
    access_stats: Dict[str, Any] = Field(default_factory=dict, description="访问统计")


class FileListResponse(BaseModel):
    """文件列表响应模型"""

    files: List[FileInfo] = Field(..., description="文件列表")
    folders: List[FolderInfo] = Field(default_factory=list, description="文件夹列表")

    # 分页信息
    total_count: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页")
    page_size: int = Field(..., description="每页大小")
    total_pages: int = Field(..., description="总页数")
    has_next: bool = Field(..., description="是否有下一页")
    has_prev: bool = Field(..., description="是否有上一页")

    # 统计信息
    total_size: int = Field(default=0, description="总大小")
    file_count: int = Field(default=0, description="文件数量")
    folder_count: int = Field(default=0, description="文件夹数量")


class FileOperationResponse(BaseModel):
    """文件操作响应模型"""

    success: bool = Field(..., description="操作是否成功")
    operation: FileOperation = Field(..., description="操作类型")
    file_id: str = Field(..., description="文件ID")

    # 操作结果
    message: str = Field(..., description="操作消息")
    details: Optional[Dict[str, Any]] = Field(None, description="操作详情")

    # 错误信息
    error_code: Optional[str] = Field(None, description="错误代码")
    error_message: Optional[str] = Field(None, description="错误消息")

    # 新状态
    new_status: Optional[FileStatus] = Field(None, description="新状态")
    new_path: Optional[str] = Field(None, description="新路径")

    # 时间信息
    processed_at: datetime = Field(default_factory=datetime.now, description="处理时间")
    duration: Optional[float] = Field(None, description="处理耗时")


class FileBatchOperationResponse(BaseModel):
    """文件批量操作响应模型"""

    operation: FileOperation = Field(..., description="操作类型")
    total_count: int = Field(..., description="总操作数")
    success_count: int = Field(..., description="成功数")
    failed_count: int = Field(..., description="失败数")

    # 操作结果
    results: List[FileOperationResponse] = Field(..., description="操作结果列表")
    success_rate: float = Field(..., description="成功率")

    # 错误汇总
    error_summary: Dict[str, int] = Field(default_factory=dict, description="错误汇总")

    # 时间信息
    started_at: datetime = Field(..., description="开始时间")
    completed_at: datetime = Field(default_factory=datetime.now, description="完成时间")
    total_duration: float = Field(..., description="总耗时")


class FileSearchResponse(BaseModel):
    """文件搜索响应模型"""

    query: Optional[str] = Field(None, description="搜索查询")
    results: FileListResponse = Field(..., description="搜索结果")

    # 搜索统计
    search_time: float = Field(..., description="搜索耗时")
    hit_count: int = Field(..., description="命中数量")

    # 建议
    suggestions: List[str] = Field(default_factory=list, description="搜索建议")
    related_queries: List[str] = Field(default_factory=list, description="相关查询")

    # 分面统计
    facets: Dict[str, Dict[str, int]] = Field(default_factory=dict, description="分面统计")


class FileShareResponse(BaseModel):
    """文件分享响应模型"""

    share_id: str = Field(..., description="分享ID")
    share_url: str = Field(..., description="分享URL")
    share_code: Optional[str] = Field(None, description="分享码")
    qr_code_url: Optional[str] = Field(None, description="二维码URL")

    # 分享配置
    share_type: str = Field(..., description="分享类型")
    password_protected: bool = Field(..., description="是否密码保护")
    expires_at: Optional[datetime] = Field(None, description="过期时间")
    max_downloads: Optional[int] = Field(None, description="最大下载次数")

    # 统计信息
    view_count: int = Field(default=0, description="查看次数")
    download_count: int = Field(default=0, description="下载次数")

    # 文件信息
    files: List[Dict[str, Any]] = Field(..., description="分享文件信息")

    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")


class FilePermissionResponse(BaseModel):
    """文件权限响应模型"""

    file_id: str = Field(..., description="文件ID")
    user_id: str = Field(..., description="用户ID")
    permissions: List[FileOperation] = Field(..., description="权限列表")

    # 权限详情
    can_read: bool = Field(..., description="是否可读")
    can_write: bool = Field(..., description="是否可写")
    can_delete: bool = Field(..., description="是否可删除")
    can_share: bool = Field(..., description="是否可分享")
    can_manage: bool = Field(..., description="是否可管理")

    # 限制信息
    restrictions: Dict[str, Any] = Field(default_factory=dict, description="访问限制")
    expires_at: Optional[datetime] = Field(None, description="权限过期时间")

    # 授权信息
    granted_by: str = Field(..., description="授权者")
    granted_at: datetime = Field(..., description="授权时间")


class FileVersionResponse(BaseModel):
    """文件版本响应模型"""

    file_id: str = Field(..., description="文件ID")
    versions: List[FileVersion] = Field(..., description="版本列表")
    current_version: int = Field(..., description="当前版本")
    total_versions: int = Field(..., description="总版本数")

    # 版本统计
    total_size: int = Field(..., description="所有版本总大小")
    storage_usage: Dict[str, int] = Field(default_factory=dict, description="存储使用情况")


class FileActivityResponse(BaseModel):
    """文件活动响应模型"""

    file_id: str = Field(..., description="文件ID")
    activities: List[FileActivity] = Field(..., description="活动列表")

    # 分页信息
    total_count: int = Field(..., description="总活动数")
    page: int = Field(..., description="当前页")
    page_size: int = Field(..., description="每页大小")

    # 统计信息
    activity_summary: Dict[str, int] = Field(default_factory=dict, description="活动汇总")
    recent_activities: List[FileActivity] = Field(
        default_factory=list, description="最近活动"
    )


class FileStatisticsResponse(BaseModel):
    """文件统计响应模型"""

    # 基础统计
    total_files: int = Field(..., description="总文件数")
    total_size: int = Field(..., description="总大小")
    total_downloads: int = Field(..., description="总下载数")

    # 按类型统计
    by_type: Dict[str, int] = Field(default_factory=dict, description="按类型统计")
    by_status: Dict[str, int] = Field(default_factory=dict, description="按状态统计")
    by_size_range: Dict[str, int] = Field(default_factory=dict, description="按大小范围统计")

    # 时间统计
    by_date: Dict[str, int] = Field(default_factory=dict, description="按日期统计")
    by_month: Dict[str, int] = Field(default_factory=dict, description="按月份统计")

    # 用户统计
    top_uploaders: List[Dict[str, Any]] = Field(
        default_factory=list, description="上传用户排行"
    )
    top_downloaders: List[Dict[str, Any]] = Field(
        default_factory=list, description="下载用户排行"
    )

    # 存储统计
    storage_usage: Dict[str, int] = Field(default_factory=dict, description="存储使用情况")
    storage_by_provider: Dict[str, int] = Field(
        default_factory=dict, description="按存储商统计"
    )

    # 更新时间
    generated_at: datetime = Field(default_factory=datetime.now, description="生成时间")


class FolderResponse(BaseModel):
    """文件夹响应模型"""

    folder: FolderInfo = Field(..., description="文件夹信息")
    contents: FileListResponse = Field(..., description="文件夹内容")

    # 路径信息
    breadcrumb: List[Dict[str, str]] = Field(default_factory=list, description="路径导航")
    full_path: str = Field(..., description="完整路径")

    # 权限信息
    user_permissions: List[FileOperation] = Field(
        default_factory=list, description="用户权限"
    )


# ======================== 工具和验证函数 ========================


class FileValidator:
    """文件验证器工具类"""

    # 允许的文件扩展名映射
    ALLOWED_EXTENSIONS = {
        FileType.IMAGE: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"],
        FileType.DOCUMENT: [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt"],
        FileType.AUDIO: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a"],
        FileType.VIDEO: [".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm"],
        FileType.ARCHIVE: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"],
        FileType.CODE: [
            ".py",
            ".js",
            ".html",
            ".css",
            ".java",
            ".cpp",
            ".php",
            ".go",
            ".rs",
        ],
    }

    # 危险文件扩展名
    DANGEROUS_EXTENSIONS = [
        ".exe",
        ".bat",
        ".cmd",
        ".scr",
        ".pif",
        ".com",
        ".vbs",
        ".js",
        ".jar",
        ".ps1",
        ".sh",
        ".app",
        ".deb",
        ".rpm",
        ".dmg",
        ".pkg",
    ]

    @classmethod
    def validate_filename(cls, filename: str) -> bool:
        """验证文件名"""
        if not filename or len(filename) > 255:
            return False

        # 检查非法字符
        if re.search(r'[<>:"/\\|?*\x00-\x1f]', filename):
            return False

        # 检查保留名称
        reserved_names = [
            "CON",
            "PRN",
            "AUX",
            "NUL",
            "COM1",
            "COM2",
            "COM3",
            "COM4",
            "COM5",
            "COM6",
            "COM7",
            "COM8",
            "COM9",
            "LPT1",
            "LPT2",
            "LPT3",
            "LPT4",
            "LPT5",
            "LPT6",
            "LPT7",
            "LPT8",
            "LPT9",
        ]
        if filename.upper() in reserved_names:
            return False

        return True

    @classmethod
    def detect_file_type(cls, filename: str, mime_type: str = None) -> FileType:
        """检测文件类型"""
        if not filename:
            return FileType.UNKNOWN

        extension = Path(filename).suffix.lower()

        # 根据扩展名检测
        for file_type, extensions in cls.ALLOWED_EXTENSIONS.items():
            if extension in extensions:
                return file_type

        # 根据MIME类型检测
        if mime_type:
            if mime_type.startswith("image/"):
                return FileType.IMAGE
            elif mime_type.startswith("video/"):
                return FileType.VIDEO
            elif mime_type.startswith("audio/"):
                return FileType.AUDIO
            elif mime_type.startswith("text/"):
                return FileType.TEXT
            elif mime_type == "application/pdf":
                return FileType.PDF
            elif mime_type in ["application/zip", "application/x-rar-compressed"]:
                return FileType.ARCHIVE

        return FileType.OTHER

    @classmethod
    def is_dangerous_file(cls, filename: str) -> bool:
        """检查是否为危险文件"""
        extension = Path(filename).suffix.lower()
        return extension in cls.DANGEROUS_EXTENSIONS

    @classmethod
    def validate_file_size(cls, size: int, file_type: FileType = None) -> bool:
        """验证文件大小"""
        if size <= 0:
            return False

        # 全局最大大小限制 (5GB)
        MAX_SIZE = 5 * 1024 * 1024 * 1024

        # 按类型的大小限制
        TYPE_SIZE_LIMITS = {
            FileType.IMAGE: 50 * 1024 * 1024,  # 50MB
            FileType.DOCUMENT: 100 * 1024 * 1024,  # 100MB
            FileType.AUDIO: 200 * 1024 * 1024,  # 200MB
            FileType.VIDEO: 2 * 1024 * 1024 * 1024,  # 2GB
            FileType.ARCHIVE: 1 * 1024 * 1024 * 1024,  # 1GB
        }

        if file_type and file_type in TYPE_SIZE_LIMITS:
            return size <= TYPE_SIZE_LIMITS[file_type]

        return size <= MAX_SIZE

    @classmethod
    def generate_safe_filename(cls, filename: str) -> str:
        """生成安全的文件名"""
        if not filename:
            return f"file_{uuid.uuid4().hex[:8]}"

        # 移除非法字符
        safe_name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", filename)

        # 限制长度
        if len(safe_name) > 255:
            name, ext = os.path.splitext(safe_name)
            safe_name = name[: 255 - len(ext)] + ext

        # 避免保留名称
        reserved_names = ["CON", "PRN", "AUX", "NUL"]
        if safe_name.upper() in reserved_names:
            safe_name = f"file_{safe_name}"

        return safe_name


class FileHelper:
    """文件帮助工具类"""

    @staticmethod
    def format_file_size(size: int) -> str:
        """格式化文件大小"""
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        elif size < 1024 * 1024 * 1024:
            return f"{size / (1024 * 1024):.1f} MB"
        else:
            return f"{size / (1024 * 1024 * 1024):.1f} GB"

    @staticmethod
    def get_mime_type(filename: str) -> str:
        """获取MIME类型"""
        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type or "application/octet-stream"

    @staticmethod
    def generate_file_hash(content: bytes, algorithm: str = "md5") -> str:
        """生成文件哈希"""
        import hashlib

        if algorithm == "md5":
            return hashlib.md5(content).hexdigest()
        elif algorithm == "sha256":
            return hashlib.sha256(content).hexdigest()
        else:
            raise ValueError(f"Unsupported hash algorithm: {algorithm}")

    @staticmethod
    def extract_media_metadata(file_path: str) -> Dict[str, Any]:
        """提取媒体文件元数据"""
        # 这里应该使用专门的库如 ffprobe, Pillow 等来提取元数据
        # 现在返回空字典作为占位符
        return {}

    @staticmethod
    def generate_thumbnail(
        file_path: str, output_path: str, size: tuple = (200, 200)
    ) -> bool:
        """生成缩略图"""
        # 这里应该使用 Pillow 或其他图像处理库
        # 现在返回 False 作为占位符
        return False


# ======================== 配置模型 ========================


class FileStorageConfig(BaseModel):
    """文件存储配置模型"""

    # 默认存储提供商
    default_provider: StorageProvider = Field(
        default=StorageProvider.LOCAL, description="默认存储提供商"
    )

    # 存储提供商配置
    providers: Dict[str, Dict[str, Any]] = Field(
        default_factory=dict, description="存储提供商配置"
    )

    # 文件大小限制
    max_file_size: int = Field(default=5 * 1024 * 1024 * 1024, description="最大文件大小")
    max_total_size: int = Field(default=100 * 1024 * 1024 * 1024, description="最大总存储大小")

    # 允许的文件类型
    allowed_types: List[FileType] = Field(default_factory=list, description="允许的文件类型")
    blocked_extensions: List[str] = Field(default_factory=list, description="禁止的文件扩展名")

    # 安全配置
    enable_virus_scan: bool = Field(default=True, description="是否启用病毒扫描")
    quarantine_infected: bool = Field(default=True, description="是否隔离感染文件")

    # 自动处理
    auto_generate_thumbnails: bool = Field(default=True, description="是否自动生成缩略图")
    auto_extract_metadata: bool = Field(default=True, description="是否自动提取元数据")

    # 清理配置
    auto_cleanup_temp: bool = Field(default=True, description="是否自动清理临时文件")
    temp_file_ttl: int = Field(default=3600, description="临时文件生存时间(秒)")

    # 备份配置
    enable_backup: bool = Field(default=False, description="是否启用备份")
    backup_providers: List[StorageProvider] = Field(
        default_factory=list, description="备份存储提供商"
    )


class FileApiConfig(BaseModel):
    """文件API配置模型"""

    # 上传配置
    chunk_size: int = Field(default=5 * 1024 * 1024, description="分块上传大小")
    max_chunks: int = Field(default=1000, description="最大分块数")
    upload_timeout: int = Field(default=3600, description="上传超时时间")

    # 下载配置
    enable_range_requests: bool = Field(default=True, description="是否支持范围请求")
    max_download_connections: int = Field(default=10, description="最大并发下载连接数")

    # 缓存配置
    enable_cache: bool = Field(default=True, description="是否启用缓存")
    cache_ttl: int = Field(default=3600, description="缓存生存时间")

    # 限流配置
    rate_limit_enabled: bool = Field(default=True, description="是否启用限流")
    max_requests_per_minute: int = Field(default=100, description="每分钟最大请求数")

    # 日志配置
    log_file_operations: bool = Field(default=True, description="是否记录文件操作日志")
    log_access_details: bool = Field(default=False, description="是否记录访问详情")


# ======================== 错误模型 ========================


class FileError(BaseModel):
    """文件错误模型"""

    code: str = Field(..., description="错误代码")
    message: str = Field(..., description="错误消息")
    details: Optional[Dict[str, Any]] = Field(None, description="错误详情")
    file_id: Optional[str] = Field(None, description="相关文件ID")
    operation: Optional[FileOperation] = Field(None, description="相关操作")
    timestamp: datetime = Field(default_factory=datetime.now, description="错误时间")
