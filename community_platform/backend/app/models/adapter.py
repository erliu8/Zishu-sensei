"""
适配器模型
"""
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, BigInteger, JSON, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.db.session import Base


class AdapterCategory(str, enum.Enum):
    """适配器类别"""
    FILE_OPERATION = "file_operation"
    WEB_AUTOMATION = "web_automation"
    SYSTEM_CONTROL = "system_control"
    DATA_ANALYSIS = "data_analysis"
    COMMUNICATION = "communication"
    PRODUCTIVITY = "productivity"
    ENTERTAINMENT = "entertainment"
    DEVELOPMENT = "development"
    CUSTOM = "custom"


class AdapterStatus(str, enum.Enum):
    """适配器状态"""
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PUBLISHED = "published"
    REJECTED = "rejected"
    ARCHIVED = "archived"
    DISABLED = "disabled"


class AdapterType(str, enum.Enum):
    """适配器类型"""
    SOFT = "soft"  # 基于提示词和RAG
    HARD = "hard"  # 基于原生代码
    INTELLIGENT = "intelligent"  # 基于微调模型


class Adapter(Base):
    """适配器模型"""
    __tablename__ = "adapters"

    id = Column(String(50), primary_key=True, index=True)
    
    # 基本信息
    name = Column(String(100), nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    long_description = Column(Text)
    
    # 分类和类型
    category = Column(SQLEnum(AdapterCategory), nullable=False, index=True)
    type = Column(SQLEnum(AdapterType), default=AdapterType.SOFT)
    
    # 版本信息
    version = Column(String(20), nullable=False)
    min_app_version = Column(String(20))  # 最低支持的应用版本
    
    # 作者信息
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author = relationship("User", foreign_keys=[author_id], back_populates="adapters")
    
    # 统计数据
    downloads = Column(Integer, default=0, index=True)
    views = Column(Integer, default=0)
    favorites = Column(Integer, default=0)
    rating = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)
    
    # 文件信息
    file_url = Column(String(500), nullable=False)
    file_size = Column(BigInteger)
    file_hash = Column(String(64))  # SHA-256
    icon_url = Column(String(500))
    
    # 元数据 (JSON格式)
    tags = Column(JSON, default=list)  # ["tag1", "tag2"]
    dependencies = Column(JSON, default=list)  # [{"name": "adapter-id", "version": ">=1.0.0"}]
    requirements = Column(JSON, default=dict)  # {"python": ">=3.9", "memory": "512MB"}
    permissions = Column(JSON, default=list)  # ["FileRead", "NetworkHttp"]
    screenshots = Column(JSON, default=list)  # ["url1", "url2"]
    
    # 配置
    config_schema = Column(JSON, default=dict)  # JSON Schema for adapter config
    default_config = Column(JSON, default=dict)  # Default configuration
    
    # 状态和标记
    status = Column(SQLEnum(AdapterStatus), default=AdapterStatus.DRAFT, index=True)
    is_featured = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)  # 官方认证
    is_official = Column(Boolean, default=False)  # 官方适配器
    
    # 文档
    readme = Column(Text)  # README 内容
    changelog = Column(Text)  # 更新日志
    documentation_url = Column(String(500))
    repository_url = Column(String(500))
    homepage_url = Column(String(500))
    
    # 审核信息
    review_notes = Column(Text)  # 审核备注
    reviewed_by = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime(timezone=True))
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    published_at = Column(DateTime(timezone=True))
    
    # 关系
    reviews = relationship("AdapterReview", back_populates="adapter", cascade="all, delete-orphan")
    comments = relationship("AdapterComment", back_populates="adapter", cascade="all, delete-orphan")


class AdapterReview(Base):
    """适配器评价"""
    __tablename__ = "adapter_reviews"

    id = Column(String(50), primary_key=True, index=True)
    adapter_id = Column(String(50), ForeignKey("adapters.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    rating = Column(Integer, nullable=False)  # 1-5 星
    title = Column(String(200))
    content = Column(Text)
    
    # 评价维度
    ease_of_use = Column(Integer)  # 易用性 1-5
    performance = Column(Integer)  # 性能 1-5
    stability = Column(Integer)  # 稳定性 1-5
    documentation = Column(Integer)  # 文档质量 1-5
    
    # 有用性投票
    helpful_count = Column(Integer, default=0)
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    adapter = relationship("Adapter", back_populates="reviews")
    user = relationship("User")


class AdapterComment(Base):
    """适配器评论"""
    __tablename__ = "adapter_comments"

    id = Column(String(50), primary_key=True, index=True)
    adapter_id = Column(String(50), ForeignKey("adapters.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    parent_id = Column(String(50), ForeignKey("adapter_comments.id"))  # 回复评论
    
    content = Column(Text, nullable=False)
    likes = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # 关系
    adapter = relationship("Adapter", back_populates="comments")
    user = relationship("User")
    parent = relationship("AdapterComment", remote_side=[id])


class AdapterFavorite(Base):
    """适配器收藏"""
    __tablename__ = "adapter_favorites"

    id = Column(String(50), primary_key=True, index=True)
    adapter_id = Column(String(50), ForeignKey("adapters.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # 关系
    user = relationship("User")


class AdapterDownload(Base):
    """适配器下载记录"""
    __tablename__ = "adapter_downloads"

    id = Column(String(50), primary_key=True, index=True)
    adapter_id = Column(String(50), ForeignKey("adapters.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"))  # 可为空（匿名下载）
    
    # 下载信息
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    platform = Column(String(50))  # windows, macos, linux
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PackagingTask(Base):
    """打包任务"""
    __tablename__ = "packaging_tasks"

    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 配置
    config = Column(JSON, nullable=False)  # 打包配置
    platform = Column(String(20), nullable=False)  # windows, macos, linux
    
    # 状态
    status = Column(String(20), default="pending")  # pending, packaging, completed, failed
    progress = Column(Integer, default=0)  # 0-100
    
    # 结果
    download_url = Column(String(500))
    file_size = Column(BigInteger)
    file_hash = Column(String(64))
    error_message = Column(Text)
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    
    # 关系
    user = relationship("User")

