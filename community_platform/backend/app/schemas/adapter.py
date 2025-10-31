"""
适配器相关 Pydantic Schemas
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, HttpUrl, field_validator
from datetime import datetime
from enum import Enum


# ==================== 枚举类型 ====================

class AdapterCategory(str, Enum):
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


class AdapterStatus(str, Enum):
    """适配器状态"""
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PUBLISHED = "published"
    REJECTED = "rejected"
    ARCHIVED = "archived"
    DISABLED = "disabled"


class AdapterType(str, Enum):
    """适配器类型"""
    SOFT = "soft"
    HARD = "hard"
    INTELLIGENT = "intelligent"


class PackagingStatus(str, Enum):
    """打包状态"""
    PENDING = "pending"
    PACKAGING = "packaging"
    COMPLETED = "completed"
    FAILED = "failed"


class Platform(str, Enum):
    """平台类型"""
    WINDOWS = "windows"
    MACOS = "macos"
    LINUX = "linux"


# ==================== 适配器 Schemas ====================

class AdapterBase(BaseModel):
    """适配器基础信息"""
    name: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    long_description: Optional[str] = None
    category: AdapterCategory
    type: AdapterType = AdapterType.SOFT
    version: str = Field(..., pattern=r'^\d+\.\d+\.\d+$')
    min_app_version: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    icon_url: Optional[str] = None
    repository_url: Optional[str] = None
    homepage_url: Optional[str] = None


class AdapterCreate(AdapterBase):
    """创建适配器"""
    file_url: str
    file_size: int
    file_hash: str
    dependencies: List[Dict[str, str]] = Field(default_factory=list)
    requirements: Dict[str, Any] = Field(default_factory=dict)
    permissions: List[str] = Field(default_factory=list)
    screenshots: List[str] = Field(default_factory=list)
    config_schema: Dict[str, Any] = Field(default_factory=dict)
    default_config: Dict[str, Any] = Field(default_factory=dict)
    readme: Optional[str] = None
    changelog: Optional[str] = None


class AdapterUpdate(BaseModel):
    """更新适配器"""
    display_name: Optional[str] = None
    description: Optional[str] = None
    long_description: Optional[str] = None
    tags: Optional[List[str]] = None
    icon_url: Optional[str] = None
    repository_url: Optional[str] = None
    homepage_url: Optional[str] = None
    readme: Optional[str] = None
    changelog: Optional[str] = None


class AdapterAuthor(BaseModel):
    """适配器作者信息"""
    id: str
    username: str
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class AdapterInDB(AdapterBase):
    """数据库中的适配器"""
    id: str
    author_id: str
    author: Optional[AdapterAuthor] = None
    
    downloads: int = 0
    views: int = 0
    favorites: int = 0
    rating: float = 0.0
    rating_count: int = 0
    
    file_url: str
    file_size: Optional[int] = None
    file_hash: Optional[str] = None
    
    dependencies: List[Dict[str, str]] = Field(default_factory=list)
    requirements: Dict[str, Any] = Field(default_factory=dict)
    permissions: List[str] = Field(default_factory=list)
    screenshots: List[str] = Field(default_factory=list)
    
    config_schema: Dict[str, Any] = Field(default_factory=dict)
    default_config: Dict[str, Any] = Field(default_factory=dict)
    
    status: AdapterStatus = AdapterStatus.DRAFT
    is_featured: bool = False
    is_verified: bool = False
    is_official: bool = False
    
    readme: Optional[str] = None
    changelog: Optional[str] = None
    documentation_url: Optional[str] = None
    
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class AdapterDetail(AdapterInDB):
    """适配器详情（包含更多信息）"""
    review_count: int = 0
    comment_count: int = 0
    is_favorited: bool = False  # 当前用户是否收藏
    is_downloaded: bool = False  # 当前用户是否下载


class AdapterListItem(BaseModel):
    """适配器列表项"""
    id: str
    name: str
    display_name: str
    description: Optional[str] = None
    category: AdapterCategory
    type: AdapterType
    version: str
    author: AdapterAuthor
    downloads: int
    rating: float
    rating_count: int
    icon_url: Optional[str] = None
    tags: List[str]
    is_featured: bool
    is_verified: bool
    is_official: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AdapterListResponse(BaseModel):
    """适配器列表响应"""
    items: List[AdapterListItem]
    total: int
    page: int
    size: int
    has_more: bool


# ==================== 评价 Schemas ====================

class ReviewCreate(BaseModel):
    """创建评价"""
    rating: int = Field(..., ge=1, le=5)
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    ease_of_use: Optional[int] = Field(None, ge=1, le=5)
    performance: Optional[int] = Field(None, ge=1, le=5)
    stability: Optional[int] = Field(None, ge=1, le=5)
    documentation: Optional[int] = Field(None, ge=1, le=5)


class ReviewInDB(ReviewCreate):
    """数据库中的评价"""
    id: str
    adapter_id: str
    user_id: str
    helpful_count: int = 0
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ==================== 评论 Schemas ====================

class CommentCreate(BaseModel):
    """创建评论"""
    content: str = Field(..., min_length=1, max_length=5000)
    parent_id: Optional[str] = None


class CommentInDB(BaseModel):
    """数据库中的评论"""
    id: str
    adapter_id: str
    user_id: str
    parent_id: Optional[str] = None
    content: str
    likes: int = 0
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ==================== 打包任务 Schemas ====================

class PackagingConfig(BaseModel):
    """打包配置"""
    app_name: str = Field(..., min_length=1, max_length=100)
    version: str = Field(default="1.0.0", pattern=r'^\d+\.\d+\.\d+$')
    
    # 选择的组件
    models: List[str] = Field(default_factory=list)  # AI模型列表
    adapters: List[str] = Field(default_factory=list)  # 适配器ID列表
    character: Optional[Dict[str, Any]] = None  # 角色配置
    
    # 应用设置
    settings: Dict[str, Any] = Field(default_factory=dict)
    
    # 品牌定制
    branding: Optional[Dict[str, Any]] = None


class PackagingTaskCreate(BaseModel):
    """创建打包任务"""
    config: PackagingConfig
    platform: Platform


class PackagingTaskInDB(BaseModel):
    """数据库中的打包任务"""
    id: str
    user_id: str
    config: PackagingConfig
    platform: Platform
    status: PackagingStatus
    progress: int = 0
    download_url: Optional[str] = None
    file_size: Optional[int] = None
    file_hash: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class PackagingTaskStatus(BaseModel):
    """打包任务状态"""
    id: str
    status: PackagingStatus
    progress: int
    download_url: Optional[str] = None
    error_message: Optional[str] = None


# ==================== 统计 Schemas ====================

class AdapterStats(BaseModel):
    """适配器统计"""
    total_adapters: int
    total_downloads: int
    total_authors: int
    categories: Dict[str, int]
    popular_tags: List[Dict[str, Any]]

