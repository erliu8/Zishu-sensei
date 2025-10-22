"""
角色系统相关数据模型

包含AI角色和人格管理的核心实体：
- Character: AI角色基础信息
- CharacterPersonality: 角色人格配置
- CharacterExpression: 角色表情配置
- CharacterVoice: 角色语音配置
- CharacterModel: Live2D模型配置
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from enum import Enum

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
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pydantic import BaseModel, Field, HttpUrl

from ..database.base import DatabaseBaseModel, MetadataMixin


# ================================
# 枚举定义
# ================================


class CharacterType(str, Enum):
    """角色类型"""

    OFFICIAL = "official"  # 官方角色
    COMMUNITY = "community"  # 社区角色
    CUSTOM = "custom"  # 用户自定义


class CharacterGender(str, Enum):
    """角色性别"""

    FEMALE = "female"
    MALE = "male"
    OTHER = "other"
    UNSPECIFIED = "unspecified"


class PersonalityTrait(str, Enum):
    """人格特征"""

    FRIENDLY = "friendly"  # 友好
    PROFESSIONAL = "professional"  # 专业
    HUMOROUS = "humorous"  # 幽默
    SERIOUS = "serious"  # 严肃
    ENERGETIC = "energetic"  # 活力
    CALM = "calm"  # 冷静
    CREATIVE = "creative"  # 创造性
    LOGICAL = "logical"  # 逻辑性


class ExpressionType(str, Enum):
    """表情类型"""

    NEUTRAL = "neutral"  # 中性
    HAPPY = "happy"  # 开心
    SAD = "sad"  # 伤心
    ANGRY = "angry"  # 生气
    SURPRISED = "surprised"  # 惊讶
    CONFUSED = "confused"  # 困惑
    THINKING = "thinking"  # 思考
    EXCITED = "excited"  # 兴奋
    SHY = "shy"  # 害羞
    SLEEPY = "sleepy"  # 困倦


class VoiceGender(str, Enum):
    """语音性别"""

    FEMALE = "female"
    MALE = "male"
    NEUTRAL = "neutral"


class ModelType(str, Enum):
    """模型类型"""

    LIVE2D = "live2d"  # Live2D模型
    VRM = "vrm"  # VRM模型
    SPRITE = "sprite"  # 2D精灵
    AVATAR = "avatar"  # 头像


# ================================
# SQLAlchemy 模型
# ================================


class Character(DatabaseBaseModel, MetadataMixin):
    """
    AI角色基础模型

    管理AI助手的角色信息
    """

    __tablename__ = "characters"

    # 基础信息
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="角色名称"
    )

    slug: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="角色标识符"
    )

    display_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="显示名称"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="角色描述"
    )

    biography: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="角色背景故事"
    )

    # 作者信息
    author_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="作者用户ID",
    )

    # 角色类型
    character_type: Mapped[CharacterType] = mapped_column(
        String(20), default=CharacterType.CUSTOM, nullable=False, comment="角色类型"
    )

    # 基础属性
    gender: Mapped[CharacterGender] = mapped_column(
        String(20), default=CharacterGender.UNSPECIFIED, nullable=False, comment="性别"
    )

    age: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="年龄"
    )

    height: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="身高（cm）"
    )

    birthday: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, comment="生日（MM-DD）"
    )

    # 外观描述
    appearance: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="外观描述"
    )

    clothing: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="服装描述"
    )

    hair_color: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="发色"
    )

    eye_color: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="瞳色"
    )

    # 媒体资源
    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="头像URL"
    )

    thumbnail_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="缩略图URL"
    )

    banner_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="横幅URL"
    )

    # AI配置
    system_prompt: Mapped[str] = mapped_column(
        Text, nullable=False, comment="系统提示词"
    )

    greeting_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="问候消息"
    )

    example_dialogues: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(
        JSONB, nullable=True, comment="示例对话"
    )

    personality_traits: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="人格特征列表"
    )

    speaking_style: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="说话风格描述"
    )

    # 可见性和分享
    is_public: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否公开"
    )

    is_featured: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否推荐"
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否官方验证"
    )

    # 统计信息
    usage_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="使用次数"
    )

    favorite_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="收藏次数"
    )

    # 版本信息
    version: Mapped[str] = mapped_column(
        String(20), default="1.0.0", nullable=False, comment="版本号"
    )

    # 关联关系
    personality: Mapped[Optional["CharacterPersonality"]] = relationship(
        "CharacterPersonality",
        back_populates="character",
        uselist=False,
        cascade="all, delete-orphan",
    )

    expressions: Mapped[List["CharacterExpression"]] = relationship(
        "CharacterExpression",
        back_populates="character",
        cascade="all, delete-orphan",
    )

    voices: Mapped[List["CharacterVoice"]] = relationship(
        "CharacterVoice",
        back_populates="character",
        cascade="all, delete-orphan",
    )

    models: Mapped[List["CharacterModel"]] = relationship(
        "CharacterModel",
        back_populates="character",
        cascade="all, delete-orphan",
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_characters_name", "name"),
        Index("idx_characters_slug", "slug"),
        Index("idx_characters_author_id", "author_id"),
        Index("idx_characters_type", "character_type"),
        Index("idx_characters_public", "is_public"),
        Index("idx_characters_featured", "is_featured"),
        UniqueConstraint("author_id", "slug", name="uk_characters_author_slug"),
        CheckConstraint(
            "length(name) >= 1 AND length(name) <= 100",
            name="check_character_name_length",
        ),
        CheckConstraint(
            "age IS NULL OR (age >= 1 AND age <= 1000)",
            name="check_character_age",
        ),
    )


class CharacterPersonality(DatabaseBaseModel):
    """
    角色人格配置模型

    详细配置角色的人格特征和行为模式
    """

    __tablename__ = "character_personalities"

    # 关联角色
    character_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
        comment="角色ID",
    )

    # MBTI人格类型
    mbti_type: Mapped[Optional[str]] = mapped_column(
        String(4), nullable=True, comment="MBTI类型"
    )

    # 大五人格特征（0-100）
    openness: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="开放性"
    )

    conscientiousness: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="尽责性"
    )

    extraversion: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="外向性"
    )

    agreeableness: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="亲和性"
    )

    neuroticism: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="神经质"
    )

    # 行为倾向
    formality_level: Mapped[int] = mapped_column(
        Integer, default=50, nullable=False, comment="正式程度（0-100）"
    )

    humor_level: Mapped[int] = mapped_column(
        Integer, default=50, nullable=False, comment="幽默程度（0-100）"
    )

    empathy_level: Mapped[int] = mapped_column(
        Integer, default=50, nullable=False, comment="共情能力（0-100）"
    )

    verbosity_level: Mapped[int] = mapped_column(
        Integer, default=50, nullable=False, comment="话语详细度（0-100）"
    )

    # 兴趣和爱好
    interests: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="兴趣列表"
    )

    hobbies: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="爱好列表"
    )

    likes: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="喜欢的事物"
    )

    dislikes: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="讨厌的事物"
    )

    # 价值观和信念
    values: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="价值观"
    )

    beliefs: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="信念系统"
    )

    # 关联关系
    character: Mapped["Character"] = relationship(
        "Character", back_populates="personality"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_character_personalities_character_id", "character_id"),
        UniqueConstraint(
            "character_id", name="uk_character_personalities_character_id"
        ),
        CheckConstraint(
            "openness IS NULL OR (openness >= 0 AND openness <= 100)",
            name="check_openness",
        ),
        CheckConstraint(
            "conscientiousness IS NULL OR (conscientiousness >= 0 AND conscientiousness <= 100)",
            name="check_conscientiousness",
        ),
        CheckConstraint(
            "formality_level >= 0 AND formality_level <= 100",
            name="check_formality_level",
        ),
    )


class CharacterExpression(DatabaseBaseModel):
    """
    角色表情配置模型

    管理角色的表情动画和触发条件
    """

    __tablename__ = "character_expressions"

    # 关联角色
    character_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
        comment="角色ID",
    )

    # 表情信息
    expression_type: Mapped[ExpressionType] = mapped_column(
        String(20), nullable=False, comment="表情类型"
    )

    expression_name: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="表情名称"
    )

    description: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, comment="表情描述"
    )

    # 动画配置
    animation_file: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="动画文件路径"
    )

    animation_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="动画配置"
    )

    # 触发条件
    trigger_keywords: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="触发关键词"
    )

    trigger_emotions: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="触发情绪"
    )

    trigger_probability: Mapped[int] = mapped_column(
        Integer, default=100, nullable=False, comment="触发概率（0-100）"
    )

    # 优先级
    priority: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="优先级"
    )

    # 关联关系
    character: Mapped["Character"] = relationship(
        "Character", back_populates="expressions"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_character_expressions_character_id", "character_id"),
        Index("idx_character_expressions_type", "expression_type"),
        UniqueConstraint(
            "character_id",
            "expression_name",
            name="uk_character_expressions_unique",
        ),
        CheckConstraint(
            "trigger_probability >= 0 AND trigger_probability <= 100",
            name="check_trigger_probability",
        ),
    )


class CharacterVoice(DatabaseBaseModel):
    """
    角色语音配置模型

    管理角色的语音设置和TTS配置
    """

    __tablename__ = "character_voices"

    # 关联角色
    character_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
        comment="角色ID",
    )

    # 语音基础信息
    voice_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="语音名称"
    )

    voice_provider: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="语音提供商"
    )

    voice_id: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="语音ID"
    )

    # 语音特征
    voice_gender: Mapped[VoiceGender] = mapped_column(
        String(20), nullable=False, comment="语音性别"
    )

    language: Mapped[str] = mapped_column(
        String(10), default="zh-CN", nullable=False, comment="语言"
    )

    accent: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="口音"
    )

    # TTS参数
    speaking_rate: Mapped[int] = mapped_column(
        Integer, default=100, nullable=False, comment="语速（50-200）"
    )

    pitch: Mapped[int] = mapped_column(
        Integer, default=100, nullable=False, comment="音调（50-200）"
    )

    volume: Mapped[int] = mapped_column(
        Integer, default=100, nullable=False, comment="音量（0-100）"
    )

    # 额外配置
    voice_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="语音配置"
    )

    # 是否默认
    is_default: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为默认语音"
    )

    # 关联关系
    character: Mapped["Character"] = relationship(
        "Character", back_populates="voices"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_character_voices_character_id", "character_id"),
        Index("idx_character_voices_provider", "voice_provider"),
        CheckConstraint(
            "speaking_rate >= 50 AND speaking_rate <= 200",
            name="check_speaking_rate",
        ),
        CheckConstraint(
            "pitch >= 50 AND pitch <= 200",
            name="check_pitch",
        ),
        CheckConstraint(
            "volume >= 0 AND volume <= 100",
            name="check_volume",
        ),
    )


class CharacterModel(DatabaseBaseModel):
    """
    角色模型配置（Live2D/VRM等）

    管理角色的3D/2D模型资源
    """

    __tablename__ = "character_models"

    # 关联角色
    character_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("characters.id", ondelete="CASCADE"),
        nullable=False,
        comment="角色ID",
    )

    # 模型信息
    model_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="模型名称"
    )

    model_type: Mapped[ModelType] = mapped_column(
        String(20), default=ModelType.LIVE2D, nullable=False, comment="模型类型"
    )

    description: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="模型描述"
    )

    # 文件信息
    model_url: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="模型文件URL"
    )

    model_size: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="模型文件大小（字节）"
    )

    model_hash: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="模型文件哈希"
    )

    # 配置信息
    model_config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="模型配置"
    )

    # Live2D特定配置
    expressions_mapping: Mapped[Optional[Dict[str, str]]] = mapped_column(
        JSONB, nullable=True, comment="表情映射"
    )

    motions_mapping: Mapped[Optional[Dict[str, str]]] = mapped_column(
        JSONB, nullable=True, comment="动作映射"
    )

    idle_motions: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="空闲动作列表"
    )

    # 物理参数
    physics_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="物理配置"
    )

    # 渲染参数
    scale: Mapped[int] = mapped_column(
        Integer, default=100, nullable=False, comment="缩放比例（10-300）"
    )

    position_x: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="X位置"
    )

    position_y: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="Y位置"
    )

    # 是否默认
    is_default: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为默认模型"
    )

    # 关联关系
    character: Mapped["Character"] = relationship(
        "Character", back_populates="models"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_character_models_character_id", "character_id"),
        Index("idx_character_models_type", "model_type"),
        CheckConstraint(
            "scale >= 10 AND scale <= 300",
            name="check_scale",
        ),
    )


# ================================
# Pydantic 模式
# ================================


class CharacterCreate(BaseModel):
    """角色创建模式"""

    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    display_name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    character_type: CharacterType = CharacterType.CUSTOM
    gender: CharacterGender = CharacterGender.UNSPECIFIED
    system_prompt: str
    greeting_message: Optional[str] = None
    avatar_url: Optional[HttpUrl] = None


class CharacterUpdate(BaseModel):
    """角色更新模式"""

    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    greeting_message: Optional[str] = None
    avatar_url: Optional[HttpUrl] = None
    is_public: Optional[bool] = None


class CharacterResponse(BaseModel):
    """角色响应模式"""

    id: str
    name: str
    display_name: str
    description: Optional[str]
    character_type: CharacterType
    gender: CharacterGender
    avatar_url: Optional[str]
    is_public: bool
    is_featured: bool
    is_verified: bool
    usage_count: int
    favorite_count: int
    version: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

