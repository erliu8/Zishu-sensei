"""
Character 数据库模型
"""
from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, DateTime, JSON, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from app.db.session import Base


class CharacterVisibility(str, enum.Enum):
    """角色可见性枚举"""
    PUBLIC = "public"
    PRIVATE = "private"
    UNLISTED = "unlisted"


class CharacterStatus(str, enum.Enum):
    """角色状态枚举"""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class Character(Base):
    """角色模型"""
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    display_name = Column(String(100), nullable=True)
    description = Column(Text, nullable=False)
    
    # 媒体资源
    avatar_url = Column(String(500), nullable=True)
    cover_url = Column(String(500), nullable=True)
    
    # 标签和分类
    tags = Column(JSON, default=list)  # List[str]
    
    # 状态和可见性
    status = Column(SQLEnum(CharacterStatus), default=CharacterStatus.DRAFT, nullable=False)
    visibility = Column(SQLEnum(CharacterVisibility), default=CharacterVisibility.PRIVATE, nullable=False)
    published = Column(Boolean, default=False, nullable=False)
    
    # 版本信息
    version = Column(String(20), default="1.0.0", nullable=False)
    
    # 旧版适配器配置（保持向后兼容）
    adapters = Column(JSON, default=list)  # List[AdapterReference]
    
    # 新版配置字段
    config = Column(JSON, nullable=True)  # CharacterFullConfig
    # config 结构：
    # {
    #   "aiModel": {
    #     "type": "lora_adapter" | "prompt_engineering" | "full_model",
    #     // Lora 配置
    #     "loraAdapter": "lora-id",
    #     "baseModelId": "base-model-id",
    #     "baseModelName": "Qwen3",
    #     "deployment": {
    #       "location": "cloud" | "local",
    #       "localPath": "/path/to/lora",
    #       "cloudUrl": "https://..."
    #     },
    #     // 提示词工程配置
    #     "provider": "openai" | "anthropic" | "google" | "other",
    #     "modelId": "gpt-4",
    #     "modelName": "GPT-4",
    #     "systemPrompt": "...",
    #     "characterPrompt": "...",
    #     // 完整模型配置
    #     "fullModelId": "model-id",
    #     "fullModelName": "Model Name",
    #   },
    #   "live2dModel": {
    #     "modelId": "live2d-id",
    #     "modelName": "model-name",
    #     "displayName": "Display Name",
    #     "deployment": {
    #       "location": "cloud" | "local",
    #       "localPath": "/path/to/model",
    #       "cloudUrl": "https://..."
    #     }
    #   },
    #   "plugins": ["plugin-id-1", "plugin-id-2"]
    # }
    
    # 人格配置
    personality = Column(JSON, nullable=True)  # PersonalityConfig
    
    # 表情配置
    expressions = Column(JSON, default=list)  # List[Expression]
    
    # 语音配置
    voices = Column(JSON, default=list)  # List[VoiceConfig]
    
    # 模型配置
    models = Column(JSON, default=list)  # List[ModelConfig]
    
    # 统计信息
    stats = Column(JSON, default={
        "downloads": 0,
        "favorites": 0,
        "likes": 0,
        "rating": 0.0,
        "ratingCount": 0,
        "comments": 0,
        "views": 0
    })
    
    # 创建者信息
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    creator_name = Column(String(100), nullable=True)
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 关系
    creator = relationship("User", back_populates="characters")
    
    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "displayName": self.display_name,
            "description": self.description,
            "avatarUrl": self.avatar_url,
            "coverUrl": self.cover_url,
            "tags": self.tags or [],
            "status": self.status.value if self.status else "draft",
            "visibility": self.visibility.value if self.visibility else "private",
            "published": self.published,
            "version": self.version,
            "adapters": self.adapters or [],
            "config": self.config,
            "personality": self.personality,
            "expressions": self.expressions or [],
            "voices": self.voices or [],
            "models": self.models or [],
            "stats": self.stats or {},
            "creatorId": self.creator_id,
            "creatorName": self.creator_name,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }

