"""
适配器相关数据模型

包含适配器生态系统的核心实体：
- Adapter: 适配器基础信息
- AdapterVersion: 适配器版本管理
- AdapterDependency: 依赖关系管理
- AdapterCategory: 分类体系
- AdapterDownload: 下载统计
- AdapterRating: 评分系统
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from enum import Enum
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Integer,
    Text,
    ForeignKey,
    UniqueConstraint,
    Index,
    CheckConstraint,
    func,
    Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pydantic import BaseModel, Field, validator, HttpUrl
from semantic_version import Version

from ..database.base import DatabaseBaseModel, MetadataMixin
from ..adapters.core.types import AdapterType, AdapterStatus


# ================================
# 枚举定义
# ================================


class AdapterVisibility(str, Enum):
    """适配器可见性"""

    PUBLIC = "public"  # 公开
    PRIVATE = "private"  # 私有
    UNLISTED = "unlisted"  # 不公开列出但可通过链接访问
    DRAFT = "draft"  # 草稿


class AdapterLicense(str, Enum):
    """适配器许可证"""

    MIT = "MIT"
    GPL_V3 = "GPL-3.0"
    APACHE_2 = "Apache-2.0"
    BSD_3 = "BSD-3-Clause"
    CC0 = "CC0-1.0"
    PROPRIETARY = "Proprietary"
    CUSTOM = "Custom"


class DependencyType(str, Enum):
    """依赖类型"""

    RUNTIME = "runtime"  # 运行时依赖
    DEVELOPMENT = "development"  # 开发依赖
    OPTIONAL = "optional"  # 可选依赖
    PEER = "peer"  # 同级依赖


class VersionConstraint(str, Enum):
    """版本约束类型"""

    EXACT = "exact"  # 精确版本
    MINIMUM = "minimum"  # 最小版本
    RANGE = "range"  # 版本范围
    COMPATIBLE = "compatible"  # 兼容版本


class CategoryType(str, Enum):
    """分类类型"""

    PRIMARY = "primary"  # 主分类
    SECONDARY = "secondary"  # 次分类
    TAG = "tag"  # 标签


class RatingType(str, Enum):
    """评分类型"""

    OVERALL = "overall"  # 综合评分
    FUNCTIONALITY = "functionality"  # 功能性
    USABILITY = "usability"  # 易用性
    PERFORMANCE = "performance"  # 性能
    DOCUMENTATION = "documentation"  # 文档质量


# ================================
# SQLAlchemy 模型
# ================================


class AdapterCategory(DatabaseBaseModel):
    """
    适配器分类模型

    管理适配器的分类体系
    """

    __tablename__ = "adapter_categories"

    # 分类信息
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="分类名称")

    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, comment="分类标识符"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="分类描述"
    )

    category_type: Mapped[CategoryType] = mapped_column(
        String(20), default=CategoryType.PRIMARY, nullable=False, comment="分类类型"
    )

    # 层级结构
    parent_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("adapter_categories.id", ondelete="SET NULL"),
        nullable=True,
        comment="父分类ID",
    )

    sort_order: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="排序顺序"
    )

    # 图标和颜色
    icon: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="分类图标"
    )

    color: Mapped[Optional[str]] = mapped_column(
        String(7), nullable=True, comment="分类颜色"  # #RRGGBB
    )

    # 统计信息
    adapter_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="分类下适配器数量"
    )

    # 关联关系
    parent: Mapped[Optional["AdapterCategory"]] = relationship(
        "AdapterCategory", remote_side="AdapterCategory.id", back_populates="children"
    )

    children: Mapped[List["AdapterCategory"]] = relationship(
        "AdapterCategory", back_populates="parent", cascade="all, delete-orphan"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_adapter_categories_slug", "slug"),
        Index("idx_adapter_categories_parent_id", "parent_id"),
        Index("idx_adapter_categories_type", "category_type"),
        CheckConstraint(
            "length(name) >= 1 AND length(name) <= 100",
            name="check_category_name_length",
        ),
        CheckConstraint(
            "color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'",
            name="check_category_color_format",
        ),
    )


class Adapter(DatabaseBaseModel, MetadataMixin):
    """
    适配器基础模型

    存储适配器的核心信息
    """

    __tablename__ = "adapters"

    # 基础信息
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="适配器名称")

    slug: Mapped[str] = mapped_column(String(100), nullable=False, comment="适配器标识符")

    display_name: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="显示名称"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="适配器描述"
    )

    long_description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="详细描述（支持Markdown）"
    )

    # 作者信息
    author_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="作者用户ID",
    )

    maintainers: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="维护者用户ID列表"
    )

    # 类型和状态
    adapter_type: Mapped[AdapterType] = mapped_column(
        String(20), nullable=False, comment="适配器类型"
    )

    adapter_status: Mapped[AdapterStatus] = mapped_column(
        String(20), default=AdapterStatus.REGISTERED, nullable=False, comment="适配器状态"
    )

    visibility: Mapped[AdapterVisibility] = mapped_column(
        String(20), default=AdapterVisibility.PUBLIC, nullable=False, comment="可见性"
    )

    # 许可证和法律
    license: Mapped[AdapterLicense] = mapped_column(
        String(50), default=AdapterLicense.MIT, nullable=False, comment="许可证"
    )

    license_text: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="自定义许可证文本"
    )

    # 仓库信息
    repository_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="代码仓库URL"
    )

    homepage_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="主页URL"
    )

    documentation_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="文档URL"
    )

    # 分类和标签
    primary_category_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("adapter_categories.id", ondelete="SET NULL"),
        nullable=True,
        comment="主分类ID",
    )

    secondary_categories: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="次分类ID列表"
    )

    keywords: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="关键词标签"
    )

    # 统计信息
    download_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="总下载量"
    )

    star_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="收藏数"
    )

    rating_average: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2), nullable=True, comment="平均评分"  # 0.00 到 5.00
    )

    rating_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="评分数量"
    )

    # 版本信息
    latest_version: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="最新版本号"
    )

    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="首次发布时间"
    )

    # 审核信息
    is_featured: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为推荐适配器"
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已验证"
    )

    moderation_status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, comment="审核状态"
    )

    moderation_notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="审核备注"
    )

    # 关联关系
    primary_category: Mapped[Optional["AdapterCategory"]] = relationship(
        "AdapterCategory"
    )

    versions: Mapped[List["AdapterVersion"]] = relationship(
        "AdapterVersion",
        back_populates="adapter",
        cascade="all, delete-orphan",
        order_by="AdapterVersion.created_at.desc()",
    )

    dependencies: Mapped[List["AdapterDependency"]] = relationship(
        "AdapterDependency", back_populates="adapter", cascade="all, delete-orphan"
    )

    downloads: Mapped[List["AdapterDownload"]] = relationship(
        "AdapterDownload", back_populates="adapter", cascade="all, delete-orphan"
    )

    ratings: Mapped[List["AdapterRating"]] = relationship(
        "AdapterRating", back_populates="adapter", cascade="all, delete-orphan"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_adapters_name", "name"),
        Index("idx_adapters_slug", "slug"),
        Index("idx_adapters_author_id", "author_id"),
        Index("idx_adapters_type", "adapter_type"),
        Index("idx_adapters_status", "adapter_status"),
        Index("idx_adapters_visibility", "visibility"),
        Index("idx_adapters_category", "primary_category_id"),
        Index("idx_adapters_featured", "is_featured"),
        Index("idx_adapters_verified", "is_verified"),
        Index("idx_adapters_published_at", "published_at"),
        UniqueConstraint("author_id", "slug", name="uk_adapters_author_slug"),
        CheckConstraint(
            "length(name) >= 1 AND length(name) <= 100",
            name="check_adapter_name_length",
        ),
        CheckConstraint(
            "rating_average IS NULL OR (rating_average >= 0.00 AND rating_average <= 5.00)",
            name="check_adapter_rating_range",
        ),
    )


class AdapterVersion(DatabaseBaseModel, MetadataMixin):
    """
    适配器版本模型

    管理适配器的版本发布历史
    """

    __tablename__ = "adapter_versions"

    # 关联适配器
    adapter_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("adapters.id", ondelete="CASCADE"),
        nullable=False,
        comment="适配器ID",
    )

    # 版本信息
    version: Mapped[str] = mapped_column(String(50), nullable=False, comment="版本号")

    title: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, comment="版本标题"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="版本描述"
    )

    changelog: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="更新日志"
    )

    # 发布信息
    is_prerelease: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为预发布版本"
    )

    is_deprecated: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已废弃"
    )

    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="发布时间"
    )

    # 文件信息
    file_size: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="文件大小（字节）"
    )

    file_hash: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True, comment="文件哈希值"
    )

    download_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="下载URL"
    )

    # 兼容性信息
    min_zishu_version: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="最小支持的紫舒版本"
    )

    max_zishu_version: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="最大支持的紫舒版本"
    )

    supported_platforms: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="支持的平台"
    )

    # 技术信息
    entry_point: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="入口点"
    )

    configuration_schema: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="配置模式"
    )

    api_specification: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="API规范"
    )

    # 统计信息
    download_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="版本下载量"
    )

    # 关联关系
    adapter: Mapped["Adapter"] = relationship("Adapter", back_populates="versions")

    # 索引和约束
    __table_args__ = (
        Index("idx_adapter_versions_adapter_id", "adapter_id"),
        Index("idx_adapter_versions_version", "version"),
        Index("idx_adapter_versions_published_at", "published_at"),
        UniqueConstraint("adapter_id", "version", name="uk_adapter_versions_unique"),
        CheckConstraint(
            "length(version) >= 1 AND length(version) <= 50",
            name="check_version_length",
        ),
    )

    def is_compatible_with(self, zishu_version: str) -> bool:
        """检查版本兼容性"""
        try:
            target = Version(zishu_version)

            if self.min_zishu_version:
                min_ver = Version(self.min_zishu_version)
                if target < min_ver:
                    return False

            if self.max_zishu_version:
                max_ver = Version(self.max_zishu_version)
                if target > max_ver:
                    return False

            return True
        except Exception:
            return False


class AdapterDependency(DatabaseBaseModel):
    """
    适配器依赖关系模型

    管理适配器间的依赖关系
    """

    __tablename__ = "adapter_dependencies"

    # 关联适配器
    adapter_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("adapters.id", ondelete="CASCADE"),
        nullable=False,
        comment="适配器ID",
    )

    # 依赖信息
    dependency_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="依赖名称"
    )

    dependency_type: Mapped[DependencyType] = mapped_column(
        String(20), default=DependencyType.RUNTIME, nullable=False, comment="依赖类型"
    )

    # 版本约束
    version_constraint: Mapped[VersionConstraint] = mapped_column(
        String(20), default=VersionConstraint.MINIMUM, nullable=False, comment="版本约束类型"
    )

    version_spec: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="版本规范"
    )

    # 是否可选
    is_optional: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为可选依赖"
    )

    # 描述信息
    description: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="依赖描述"
    )

    # 关联关系
    adapter: Mapped["Adapter"] = relationship("Adapter", back_populates="dependencies")

    # 索引和约束
    __table_args__ = (
        Index("idx_adapter_dependencies_adapter_id", "adapter_id"),
        Index("idx_adapter_dependencies_name", "dependency_name"),
        Index("idx_adapter_dependencies_type", "dependency_type"),
        UniqueConstraint(
            "adapter_id",
            "dependency_name",
            "dependency_type",
            name="uk_adapter_dependencies_unique",
        ),
    )


class AdapterDownload(DatabaseBaseModel):
    """
    适配器下载记录模型

    统计适配器下载数据
    """

    __tablename__ = "adapter_downloads"

    # 关联适配器
    adapter_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("adapters.id", ondelete="CASCADE"),
        nullable=False,
        comment="适配器ID",
    )

    # 下载信息
    version: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="下载的版本号"
    )

    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="下载用户ID",
    )

    # 客户端信息
    ip_address: Mapped[str] = mapped_column(
        String(45), nullable=False, comment="下载IP地址"
    )

    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="用户代理"
    )

    referer: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="来源页面"
    )

    # 地理信息
    country: Mapped[Optional[str]] = mapped_column(
        String(2), nullable=True, comment="国家代码"  # ISO 3166-1 alpha-2
    )

    region: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="地区"
    )

    city: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="城市"
    )

    # 下载状态
    is_successful: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否下载成功"
    )

    error_message: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="错误信息"
    )

    # 关联关系
    adapter: Mapped["Adapter"] = relationship("Adapter", back_populates="downloads")

    # 索引
    __table_args__ = (
        Index("idx_adapter_downloads_adapter_id", "adapter_id"),
        Index("idx_adapter_downloads_user_id", "user_id"),
        Index("idx_adapter_downloads_ip", "ip_address"),
        Index("idx_adapter_downloads_created_at", "created_at"),
        Index("idx_adapter_downloads_country", "country"),
    )


class AdapterRating(DatabaseBaseModel):
    """
    适配器评分模型

    管理用户对适配器的评分和评论
    """

    __tablename__ = "adapter_ratings"

    # 关联适配器和用户
    adapter_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("adapters.id", ondelete="CASCADE"),
        nullable=False,
        comment="适配器ID",
    )

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="评分用户ID",
    )

    # 评分信息
    rating_type: Mapped[RatingType] = mapped_column(
        String(20), default=RatingType.OVERALL, nullable=False, comment="评分类型"
    )

    rating: Mapped[Decimal] = mapped_column(
        Numeric(3, 2), nullable=False, comment="评分分数"  # 0.00 到 5.00
    )

    # 评论内容
    title: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, comment="评论标题"
    )

    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="评论内容")

    # 评论状态
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否匿名评论"
    )

    is_verified_download: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为验证下载后的评分"
    )

    # 有用性统计
    helpful_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="有用标记数"
    )

    unhelpful_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="无用标记数"
    )

    # 审核信息
    is_moderated: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已审核"
    )

    moderation_reason: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="审核原因"
    )

    # 关联关系
    adapter: Mapped["Adapter"] = relationship("Adapter", back_populates="ratings")

    # 索引和约束
    __table_args__ = (
        Index("idx_adapter_ratings_adapter_id", "adapter_id"),
        Index("idx_adapter_ratings_user_id", "user_id"),
        Index("idx_adapter_ratings_type", "rating_type"),
        Index("idx_adapter_ratings_rating", "rating"),
        Index("idx_adapter_ratings_created_at", "created_at"),
        UniqueConstraint(
            "adapter_id", "user_id", "rating_type", name="uk_adapter_ratings_unique"
        ),
        CheckConstraint("rating >= 0.00 AND rating <= 5.00", name="check_rating_range"),
    )


# ================================
# Pydantic 模式
# ================================


class AdapterBase(BaseModel):
    """适配器基础模式"""

    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    display_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    adapter_type: AdapterType
    visibility: AdapterVisibility = AdapterVisibility.PUBLIC
    license: AdapterLicense = AdapterLicense.MIT


class AdapterCreate(AdapterBase):
    """适配器创建模式"""

    long_description: Optional[str] = None
    repository_url: Optional[HttpUrl] = None
    homepage_url: Optional[HttpUrl] = None
    documentation_url: Optional[HttpUrl] = None
    primary_category_id: Optional[str] = None
    keywords: Optional[List[str]] = Field(None, max_items=20)


class AdapterUpdate(BaseModel):
    """适配器更新模式"""

    display_name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    long_description: Optional[str] = None
    visibility: Optional[AdapterVisibility] = None
    repository_url: Optional[HttpUrl] = None
    homepage_url: Optional[HttpUrl] = None
    documentation_url: Optional[HttpUrl] = None
    primary_category_id: Optional[str] = None
    keywords: Optional[List[str]] = Field(None, max_items=20)


class AdapterResponse(AdapterBase):
    """适配器响应模式"""

    id: str
    author_id: str
    adapter_status: AdapterStatus
    download_count: int
    star_count: int
    rating_average: Optional[Decimal]
    rating_count: int
    latest_version: Optional[str]
    published_at: Optional[datetime]
    is_featured: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AdapterVersionCreate(BaseModel):
    """适配器版本创建模式"""

    version: str = Field(..., min_length=1, max_length=50)
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    changelog: Optional[str] = None
    is_prerelease: bool = False
    min_zishu_version: Optional[str] = None
    max_zishu_version: Optional[str] = None
    supported_platforms: Optional[List[str]] = None
    entry_point: Optional[str] = None

    @validator("version")
    def validate_version(cls, v):
        """版本号格式验证"""
        try:
            Version(v)
            return v
        except Exception:
            raise ValueError("版本号格式无效")


class AdapterVersionResponse(BaseModel):
    """适配器版本响应模式"""

    id: str
    adapter_id: str
    version: str
    title: Optional[str]
    description: Optional[str]
    changelog: Optional[str]
    is_prerelease: bool
    is_deprecated: bool
    published_at: Optional[datetime]
    file_size: Optional[int]
    download_count: int
    min_zishu_version: Optional[str]
    max_zishu_version: Optional[str]
    supported_platforms: Optional[List[str]]
    created_at: datetime

    class Config:
        from_attributes = True
