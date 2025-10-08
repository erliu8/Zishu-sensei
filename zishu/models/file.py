"""
文件管理相关数据模型

包含文件系统的核心功能：
- File: 文件基础信息
- FileVersion: 文件版本控制
- FilePermission: 文件权限管理
- FileShare: 文件分享功能
"""

import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Integer,
    BigInteger,
    Text,
    ForeignKey,
    UniqueConstraint,
    Index,
    CheckConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pydantic import BaseModel, Field

from zishu.database.base import DatabaseBaseModel, MetadataMixin


# ================================
# 枚举定义
# ================================


class FileType(str, Enum):
    """文件类型"""

    DOCUMENT = "document"  # 文档
    IMAGE = "image"  # 图片
    VIDEO = "video"  # 视频
    AUDIO = "audio"  # 音频
    ARCHIVE = "archive"  # 压缩包
    CODE = "code"  # 代码文件
    CONFIG = "config"  # 配置文件
    DATA = "data"  # 数据文件
    EXECUTABLE = "executable"  # 可执行文件
    OTHER = "other"  # 其他


class FileStatus(str, Enum):
    """文件状态"""

    UPLOADING = "uploading"  # 上传中
    ACTIVE = "active"  # 活跃
    PROCESSING = "processing"  # 处理中
    ARCHIVED = "archived"  # 已归档
    QUARANTINED = "quarantined"  # 隔离中
    DELETED = "deleted"  # 已删除


class StorageProvider(str, Enum):
    """存储提供商"""

    LOCAL = "local"  # 本地存储
    S3 = "s3"  # AWS S3
    MINIO = "minio"  # MinIO
    OSS = "oss"  # 阿里云OSS
    COS = "cos"  # 腾讯云COS
    AZURE = "azure"  # Azure Blob


class PermissionLevel(str, Enum):
    """权限级别"""

    READ = "read"  # 只读
    WRITE = "write"  # 读写
    ADMIN = "admin"  # 管理员
    OWNER = "owner"  # 所有者


class ShareType(str, Enum):
    """分享类型"""

    PUBLIC = "public"  # 公开分享
    PRIVATE = "private"  # 私密分享
    PASSWORD = "password"  # 密码保护
    TIME_LIMITED = "time_limited"  # 时限分享


class VersionType(str, Enum):
    """版本类型"""

    MAJOR = "major"  # 主版本
    MINOR = "minor"  # 次版本
    PATCH = "patch"  # 补丁版本
    AUTO = "auto"  # 自动版本


# ================================
# SQLAlchemy 模型
# ================================


class File(DatabaseBaseModel, MetadataMixin):
    """
    文件基础模型

    存储文件的基础信息和元数据
    """

    __tablename__ = "files"

    # 基础信息
    filename: Mapped[str] = mapped_column(String(255), nullable=False, comment="文件名")

    original_filename: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="原始文件名"
    )

    display_name: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="显示名称"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="文件描述"
    )

    # 所有者信息
    owner_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="文件所有者ID",
    )

    # 文件类型和分类
    file_type: Mapped[FileType] = mapped_column(
        String(20), nullable=False, comment="文件类型"
    )

    mime_type: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="MIME类型"
    )

    file_extension: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="文件扩展名"
    )

    # 文件属性
    file_size: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="文件大小（字节）"
    )

    file_hash: Mapped[str] = mapped_column(
        String(128), nullable=False, comment="文件哈希值（SHA-256）"
    )

    checksum: Mapped[str] = mapped_column(
        String(64), nullable=False, comment="文件校验和（MD5）"
    )

    # 存储信息
    storage_provider: Mapped[StorageProvider] = mapped_column(
        String(20), default=StorageProvider.LOCAL, nullable=False, comment="存储提供商"
    )

    storage_path: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="存储路径"
    )

    storage_bucket: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="存储桶名称"
    )

    storage_region: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="存储区域"
    )

    # URL信息
    public_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="公开访问URL"
    )

    cdn_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="CDN加速URL"
    )

    # 状态管理
    file_status: Mapped[FileStatus] = mapped_column(
        String(20), default=FileStatus.ACTIVE, nullable=False, comment="文件状态"
    )

    is_public: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否公开可访问"
    )

    is_temporary: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为临时文件"
    )

    # 到期时间
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="文件过期时间"
    )

    # 分类和标签
    category: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="文件分类"
    )

    tags: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="文件标签"
    )

    # 关联信息
    parent_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("files.id", ondelete="SET NULL"),
        nullable=True,
        comment="父文件ID（用于变体或副本）",
    )

    related_adapter_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("adapters.id", ondelete="SET NULL"),
        nullable=True,
        comment="关联的适配器ID",
    )

    # 版本信息
    version_number: Mapped[str] = mapped_column(
        String(50), default="1.0.0", nullable=False, comment="当前版本号"
    )

    is_latest_version: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否为最新版本"
    )

    # 统计信息
    download_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="下载次数"
    )

    view_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="查看次数"
    )

    share_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="分享次数"
    )

    # 内容分析（图片/视频特有）
    content_analysis: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="内容分析结果（尺寸、时长等）"
    )

    # 安全扫描
    virus_scan_result: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="病毒扫描结果"
    )

    is_virus_scanned: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已进行病毒扫描"
    )

    # 关联关系
    parent: Mapped[Optional["File"]] = relationship(
        "File", remote_side="File.id", back_populates="children"
    )

    children: Mapped[List["File"]] = relationship(
        "File", back_populates="parent", cascade="all, delete-orphan"
    )

    versions: Mapped[List["FileVersion"]] = relationship(
        "FileVersion",
        back_populates="file",
        cascade="all, delete-orphan",
        order_by="FileVersion.created_at.desc()",
    )

    permissions: Mapped[List["FilePermission"]] = relationship(
        "FilePermission", back_populates="file", cascade="all, delete-orphan"
    )

    shares: Mapped[List["FileShare"]] = relationship(
        "FileShare", back_populates="file", cascade="all, delete-orphan"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_files_filename", "filename"),
        Index("idx_files_owner_id", "owner_id"),
        Index("idx_files_file_type", "file_type"),
        Index("idx_files_status", "file_status"),
        Index("idx_files_hash", "file_hash"),
        Index("idx_files_public", "is_public"),
        Index("idx_files_category", "category"),
        Index("idx_files_parent_id", "parent_id"),
        Index("idx_files_adapter_id", "related_adapter_id"),
        Index("idx_files_expires_at", "expires_at"),
        CheckConstraint("file_size >= 0", name="check_file_size_positive"),
        CheckConstraint(
            "length(filename) >= 1 AND length(filename) <= 255",
            name="check_filename_length",
        ),
    )

    @staticmethod
    def calculate_hash(file_content: bytes) -> tuple[str, str]:
        """计算文件哈希值和校验和"""
        sha256_hash = hashlib.sha256(file_content).hexdigest()
        md5_hash = hashlib.md5(file_content).hexdigest()
        return sha256_hash, md5_hash

    def is_expired(self) -> bool:
        """检查文件是否过期"""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at

    def get_file_type_from_extension(self, extension: str) -> FileType:
        """根据扩展名推断文件类型"""
        extension = extension.lower()

        image_exts = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp"}
        video_exts = {".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm"}
        audio_exts = {".mp3", ".wav", ".flac", ".aac", ".ogg"}
        document_exts = {".pdf", ".doc", ".docx", ".txt", ".md", ".rtf"}
        archive_exts = {".zip", ".rar", ".7z", ".tar", ".gz"}
        code_exts = {".py", ".js", ".html", ".css", ".java", ".cpp", ".c"}

        if extension in image_exts:
            return FileType.IMAGE
        elif extension in video_exts:
            return FileType.VIDEO
        elif extension in audio_exts:
            return FileType.AUDIO
        elif extension in document_exts:
            return FileType.DOCUMENT
        elif extension in archive_exts:
            return FileType.ARCHIVE
        elif extension in code_exts:
            return FileType.CODE
        else:
            return FileType.OTHER


class FileVersion(DatabaseBaseModel):
    """
    文件版本模型

    管理文件的版本历史
    """

    __tablename__ = "file_versions"

    # 关联文件
    file_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
        comment="文件ID",
    )

    # 版本信息
    version_number: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="版本号"
    )

    version_type: Mapped[VersionType] = mapped_column(
        String(20), default=VersionType.AUTO, nullable=False, comment="版本类型"
    )

    title: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, comment="版本标题"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="版本描述"
    )

    changelog: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="更新日志"
    )

    # 创建者
    created_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="版本创建者ID",
    )

    # 文件属性
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False, comment="文件大小")

    file_hash: Mapped[str] = mapped_column(String(128), nullable=False, comment="文件哈希值")

    # 存储信息
    storage_path: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="存储路径"
    )

    # 状态信息
    is_current: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为当前版本"
    )

    is_deleted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已删除"
    )

    # 统计信息
    download_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="下载次数"
    )

    # 差异信息
    diff_from_previous: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="与前一版本的差异"
    )

    # 关联关系
    file: Mapped["File"] = relationship("File", back_populates="versions")

    # 索引和约束
    __table_args__ = (
        Index("idx_file_versions_file_id", "file_id"),
        Index("idx_file_versions_version", "version_number"),
        Index("idx_file_versions_created_by", "created_by"),
        Index("idx_file_versions_current", "is_current"),
        Index("idx_file_versions_hash", "file_hash"),
        UniqueConstraint("file_id", "version_number", name="uk_file_versions_unique"),
    )


class FilePermission(DatabaseBaseModel):
    """
    文件权限模型

    管理用户对文件的访问权限
    """

    __tablename__ = "file_permissions"

    # 关联文件
    file_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
        comment="文件ID",
    )

    # 被授权用户
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="被授权用户ID",
    )

    # 权限级别
    permission_level: Mapped[PermissionLevel] = mapped_column(
        String(20), nullable=False, comment="权限级别"
    )

    # 授权信息
    granted_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="授权者ID",
    )

    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="授权时间",
    )

    # 权限有效期
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="权限过期时间"
    )

    # 权限范围
    can_read: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否可读取"
    )

    can_write: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否可写入"
    )

    can_delete: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否可删除"
    )

    can_share: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否可分享"
    )

    can_manage_permissions: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否可管理权限"
    )

    # 备注
    notes: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="权限备注"
    )

    # 关联关系
    file: Mapped["File"] = relationship("File", back_populates="permissions")

    # 索引和约束
    __table_args__ = (
        Index("idx_file_permissions_file_id", "file_id"),
        Index("idx_file_permissions_user_id", "user_id"),
        Index("idx_file_permissions_level", "permission_level"),
        Index("idx_file_permissions_expires_at", "expires_at"),
        UniqueConstraint("file_id", "user_id", name="uk_file_permissions_unique"),
    )

    def is_expired(self) -> bool:
        """检查权限是否过期"""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at


class FileShare(DatabaseBaseModel):
    """
    文件分享模型

    管理文件的公开分享
    """

    __tablename__ = "file_shares"

    # 关联文件
    file_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
        comment="文件ID",
    )

    # 分享者
    shared_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="分享者ID",
    )

    # 分享信息
    share_token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, comment="分享令牌"
    )

    share_type: Mapped[ShareType] = mapped_column(
        String(20), default=ShareType.PUBLIC, nullable=False, comment="分享类型"
    )

    share_name: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, comment="分享名称"
    )

    share_description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="分享描述"
    )

    # 访问控制
    password: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="访问密码（哈希）"
    )

    max_downloads: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="最大下载次数"
    )

    max_views: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="最大查看次数"
    )

    # 时间限制
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="分享过期时间"
    )

    # 权限设置
    allow_download: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否允许下载"
    )

    allow_preview: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否允许预览"
    )

    require_login: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否需要登录"
    )

    # 统计信息
    view_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="查看次数"
    )

    download_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="下载次数"
    )

    # 状态管理
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否激活"
    )

    # 访问日志
    access_log: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(
        JSONB, nullable=True, comment="访问日志"
    )

    # 关联关系
    file: Mapped["File"] = relationship("File", back_populates="shares")

    # 索引和约束
    __table_args__ = (
        Index("idx_file_shares_file_id", "file_id"),
        Index("idx_file_shares_shared_by", "shared_by"),
        Index("idx_file_shares_token", "share_token"),
        Index("idx_file_shares_type", "share_type"),
        Index("idx_file_shares_expires_at", "expires_at"),
        Index("idx_file_shares_active", "is_active"),
    )

    def is_expired(self) -> bool:
        """检查分享是否过期"""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at

    def is_download_limit_reached(self) -> bool:
        """检查下载次数是否达到限制"""
        if self.max_downloads is None:
            return False
        return self.download_count >= self.max_downloads

    def is_view_limit_reached(self) -> bool:
        """检查查看次数是否达到限制"""
        if self.max_views is None:
            return False
        return self.view_count >= self.max_views

    def can_access(self) -> bool:
        """检查是否可以访问"""
        return (
            self.is_active
            and not self.is_expired()
            and not self.is_view_limit_reached()
        )

    def can_download(self) -> bool:
        """检查是否可以下载"""
        return (
            self.can_access()
            and self.allow_download
            and not self.is_download_limit_reached()
        )


# ================================
# Pydantic 模式
# ================================


class FileBase(BaseModel):
    """文件基础模式"""

    filename: str = Field(..., min_length=1, max_length=255)
    display_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    file_type: FileType
    is_public: bool = False
    category: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = Field(None, max_items=20)


class FileCreate(FileBase):
    """文件创建模式"""

    original_filename: str = Field(..., max_length=255)
    mime_type: str = Field(..., max_length=100)
    file_size: int = Field(..., gt=0)
    storage_path: str = Field(..., max_length=500)
    parent_id: Optional[str] = None
    related_adapter_id: Optional[str] = None
    expires_at: Optional[datetime] = None


class FileUpdate(BaseModel):
    """文件更新模式"""

    display_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    is_public: Optional[bool] = None
    category: Optional[str] = Field(None, max_length=50)
    tags: Optional[List[str]] = Field(None, max_items=20)
    expires_at: Optional[datetime] = None


class FileResponse(FileBase):
    """文件响应模式"""

    id: str
    owner_id: str
    original_filename: str
    mime_type: str
    file_extension: str
    file_size: int
    file_hash: str
    storage_provider: StorageProvider
    public_url: Optional[str]
    file_status: FileStatus
    version_number: str
    is_latest_version: bool
    download_count: int
    view_count: int
    share_count: int
    is_virus_scanned: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FileVersionResponse(BaseModel):
    """文件版本响应模式"""

    id: str
    file_id: str
    version_number: str
    version_type: VersionType
    title: Optional[str]
    description: Optional[str]
    created_by: str
    file_size: int
    file_hash: str
    is_current: bool
    download_count: int
    created_at: datetime

    class Config:
        from_attributes = True
