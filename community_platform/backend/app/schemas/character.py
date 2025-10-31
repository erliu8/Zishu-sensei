"""
Character Schema 定义
"""
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


# ========== 枚举类型 ==========

class CharacterVisibility(str, Enum):
    """角色可见性"""
    PUBLIC = "public"
    PRIVATE = "private"
    UNLISTED = "unlisted"


class CharacterStatus(str, Enum):
    """角色状态"""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class DeploymentLocation(str, Enum):
    """部署位置"""
    CLOUD = "cloud"
    LOCAL = "local"


class ModelConfigType(str, Enum):
    """模型配置类型"""
    FULL_MODEL = "full_model"
    LORA_ADAPTER = "lora_adapter"
    PROMPT_ENGINEERING = "prompt_engineering"


class ThirdPartyModelProvider(str, Enum):
    """第三方模型提供商"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    OTHER = "other"


# ========== 部署配置 ==========

class DeploymentConfig(BaseModel):
    """部署配置"""
    location: DeploymentLocation
    localPath: Optional[str] = None
    cloudUrl: Optional[str] = None


# ========== AI模型配置 ==========

class LoraAdapterConfig(BaseModel):
    """Lora适配器配置"""
    type: Literal[ModelConfigType.LORA_ADAPTER] = ModelConfigType.LORA_ADAPTER
    loraAdapter: str  # Lora适配器ID
    baseModelId: str  # 基础模型ID
    baseModelName: str  # 基础模型名称
    deployment: DeploymentConfig


class PromptEngineeringConfig(BaseModel):
    """提示词工程配置"""
    type: Literal[ModelConfigType.PROMPT_ENGINEERING] = ModelConfigType.PROMPT_ENGINEERING
    provider: ThirdPartyModelProvider
    modelId: str
    modelName: str
    systemPrompt: str = ""
    characterPrompt: str = ""


class FullModelConfig(BaseModel):
    """完整微调模型配置"""
    type: Literal[ModelConfigType.FULL_MODEL] = ModelConfigType.FULL_MODEL
    fullModelId: str
    fullModelName: str
    deployment: DeploymentConfig


# ========== Live2D模型配置 ==========

class Live2DModelReference(BaseModel):
    """Live2D模型引用"""
    modelId: str
    modelName: str
    displayName: str
    deployment: DeploymentConfig


# ========== 角色完整配置 ==========

class CharacterFullConfig(BaseModel):
    """角色完整配置"""
    aiModel: LoraAdapterConfig | PromptEngineeringConfig | FullModelConfig
    live2dModel: Optional[Live2DModelReference] = None
    plugins: Optional[List[str]] = Field(default_factory=list)  # 插件ID列表


# ========== 统计信息 ==========

class CharacterStats(BaseModel):
    """角色统计信息"""
    downloads: int = 0
    favorites: int = 0
    likes: int = 0
    rating: float = 0.0
    ratingCount: int = 0
    comments: int = 0
    views: int = 0


# ========== Character Schema ==========

class CharacterBase(BaseModel):
    """角色基础Schema"""
    name: str = Field(..., min_length=1, max_length=100)
    displayName: Optional[str] = Field(None, max_length=100)
    description: str = Field(..., min_length=1, max_length=2000)
    avatarUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    tags: List[str] = Field(default_factory=list, max_items=20)
    visibility: CharacterVisibility = CharacterVisibility.PRIVATE
    version: str = "1.0.0"
    adapters: List[Dict[str, Any]] = Field(default_factory=list)  # 旧版适配器，保持兼容
    config: Optional[CharacterFullConfig] = None  # 新版配置


class CharacterCreate(CharacterBase):
    """创建角色Schema"""
    pass


class CharacterUpdate(BaseModel):
    """更新角色Schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    displayName: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, min_length=1, max_length=2000)
    avatarUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    tags: Optional[List[str]] = Field(None, max_items=20)
    visibility: Optional[CharacterVisibility] = None
    version: Optional[str] = None
    adapters: Optional[List[Dict[str, Any]]] = None
    config: Optional[CharacterFullConfig] = None
    personality: Optional[Dict[str, Any]] = None
    expressions: Optional[List[Dict[str, Any]]] = None
    voices: Optional[List[Dict[str, Any]]] = None
    models: Optional[List[Dict[str, Any]]] = None


class CharacterInDB(CharacterBase):
    """数据库中的角色Schema"""
    id: int
    status: CharacterStatus
    published: bool
    personality: Optional[Dict[str, Any]] = None
    expressions: List[Dict[str, Any]] = Field(default_factory=list)
    voices: List[Dict[str, Any]] = Field(default_factory=list)
    models: List[Dict[str, Any]] = Field(default_factory=list)
    stats: CharacterStats = Field(default_factory=CharacterStats)
    creatorId: int
    creatorName: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True


class CharacterResponse(CharacterInDB):
    """角色响应Schema"""
    pass


class CharacterListResponse(BaseModel):
    """角色列表响应"""
    items: List[CharacterResponse]
    total: int
    page: int
    pageSize: int
    totalPages: int


class CharacterQueryParams(BaseModel):
    """角色查询参数"""
    page: int = Field(1, ge=1)
    pageSize: int = Field(20, ge=1, le=100)
    search: Optional[str] = None
    tags: Optional[List[str]] = None
    visibility: Optional[CharacterVisibility] = None
    published: Optional[bool] = None
    creatorId: Optional[str] = None
    sortBy: str = "createdAt"
    sortOrder: Literal["asc", "desc"] = "desc"

