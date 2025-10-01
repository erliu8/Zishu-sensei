#! /usr/bin/env python3
# -*- coding: utf-8 -*-

from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Any, Dict, Union, Literal
from datetime import datetime
from enum import Enum
import uuid

class MessageRole(str, Enum):
    """消息角色枚举"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    FUNCTION = "function"

class MessageType(str, Enum):
    """消息类型枚举"""
    TEXT = "text"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    FILE = "file"
    EMOTION = "emotion"
    ACTION = "action"
    
class EmotionType(str, Enum):
    """情绪类型枚举"""
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    SURPRISED = "surprised"
    DISGUSTED = "disgusted"
    FEARFUL = "fearful"
    NEUTRAL = "neutral"
    EXCITED = "excited"
    CALM = "calm"
    CONFUSED = "confused"
    CURIOUS = "curious"
    BORED = "bored"
    LAUGHING = "laughing"
    SLEEPY = "sleepy"
    THINKING = "thinking"
    SCARED = "scared"
    ANXIOUS = "anxious"
    TIRED = "tired"
    SICK = "sick"
    DEPRESSED = "depressed"
    
class ChatModel(str, Enum):
    """对话模式"""
    NORMAL = "normal"
    ROLEPLAY = "roleplay"
    TEACHING = "teaching"
    CASUAL = "casual"
    
#支持基础情绪或自定义情绪字符串
EmotionValue = Union[EmotionType, str]

class Message(BaseModel):
    """单条消息模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="消息唯一ID")
    role: MessageRole = Field(..., description="消息角色")
    content: Optional[str] = Field(None, max_length=10000, description="消息内容")
    message_type: MessageType = Field(default=MessageType.TEXT, description="消息类型")
    name: Optional[str] = Field(None, description="消息发送者名称(用于函数调用等)")
    function_call: Optional[Dict[str, Any]] = Field(None, description="函数调用信息")
    timestamp: datetime = Field(default_factory=datetime.now, description="消息时间戳")
    
    #角色情绪状态 -支持自定义
    emotion: Optional[EmotionValue] = Field(None, description="角色情绪状态")
    emotion_intensity: Optional[float] = Field(None, ge=0.0, le=1, description="情绪强度")
    
    #多媒体扩展
    voice_style: Optional[str] = Field(None, description="语音风格")
    animation: Optional[str] = Field(None, description="动画表情")
    avatar: Optional[str] = Field(None, description="头像表情")
    
    #扩展字段
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="元数据")
    tokens: Optional[int] = Field(None, description="token数量")
    processing_time: Optional[float] = Field(None, description="处理时间(秒)")
    
    
    #验证器
    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        if v is None:
            return v
        # 仅做去空白处理；是否允许为空由模型级校验决定
        return v.strip()
    
    @model_validator(mode='after')
    def validate_message(self):
        """验证消息的完整性"""
        # 如果没有function_call，则content不能为空
        if not self.function_call and (not self.content or not self.content.strip()):
            raise ValueError("消息内容不能为空")
        return self
    
class PersonalityType(str, Enum):
    """角色性格类型枚举"""
    SHY = "shy"              # 害羞型
    CHEERFUL = "cheerful"    # 开朗型
    CALM = "calm"           # 冷静型
    ENERGETIC = "energetic"  # 活泼型
    INTELLECTUAL = "intellectual" # 理智型
    CARING = "caring"        # 温柔型
    PLAYFUL = "playful"      # 顽皮型
    SERIOUS = "serious"      # 严肃型
    MYSTERIOUS = "mysterious" # 神秘型
    FRIENDLY = "friendly"    # 友善型
    SARCASTIC = "sarcastic"  # 毒舌型
    ELEGANT = "elegant"      # 优雅型
    NAIVE = "naive"          # 天然型
    TSUNDERE = "tsundere"    # 傲娇型
    CUSTOM = "custom"        # 自定义

class VoiceStyle(str, Enum):
    """语音风格枚举"""
    CUTE = "cute"           # 可爱
    SWEET = "sweet"         # 甜美
    MATURE = "mature"       # 成熟
    ENERGETIC = "energetic" # 活力
    CALM = "calm"          # 平静
    WHISPERING = "whispering" # 轻语
    CHEERFUL = "cheerful"   # 开朗
    SOFT = "soft"          # 轻柔
    CLEAR = "clear"        # 清晰
    WARM = "warm"          # 温暖

class AnimationType(str, Enum):
    """动画表情类型枚举"""
    IDLE = "idle"           # 待机
    TALKING = "talking"     # 说话
    HAPPY = "happy"         # 开心
    SAD = "sad"            # 伤心
    ANGRY = "angry"         # 生气
    SURPRISED = "surprised" # 惊讶
    THINKING = "thinking"   # 思考
    LAUGHING = "laughing"   # 大笑
    CRYING = "crying"       # 哭泣
    SLEEPING = "sleeping"   # 睡觉
    WAVING = "waving"       # 挥手
    NODDING = "nodding"     # 点头
    SHAKING = "shaking"     # 摇头
    CONFUSED = "confused"   # 困惑

class CharacterTemplate(str, Enum):
    """角色模板枚举"""
    ZISHU_BASE = "zishu_base"           # 基础版
    ZISHU_CARING = "zishu_caring"       # 关怀版
    ZISHU_PLAYFUL = "zishu_playful"     # 活泼版
    ASSISTANT = "assistant"              # 通用助手
    TEACHER = "teacher"                 # 教师模式
    FRIEND = "friend"                   # 朋友模式
    PROFESSIONAL = "professional"       # 专业模式
    CUSTOM = "custom"                   # 自定义模板

class InteractionStyle(str, Enum):
    """交互风格枚举"""
    FORMAL = "formal"       # 正式
    CASUAL = "casual"       # 随意
    INTIMATE = "intimate"   # 亲密
    PROFESSIONAL = "professional" # 专业
    PLAYFUL = "playful"     # 玩乐
    SUPPORTIVE = "supportive" # 支持

class ResponseStrategy(str, Enum):
    """回复策略枚举"""
    DETAILED = "detailed"     # 详细回复
    CONCISE = "concise"      # 简洁回复
    CREATIVE = "creative"     # 创意回复
    ANALYTICAL = "analytical" # 分析型回复
    EMPATHETIC = "empathetic" # 共情回复
    HUMOROUS = "humorous"     # 幽默回复

class CharacterConfig(BaseModel):
    """角色配置模型"""
    # 基础信息
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="角色配置ID")
    name: str = Field(..., min_length=1, max_length=50, description="角色名称")
    display_name: str = Field(..., min_length=1, max_length=50, description="显示名称")
    description: str = Field("", max_length=500, description="角色描述")
    
    # 角色特征
    personality_type: PersonalityType = Field(default=PersonalityType.FRIENDLY, description="主要性格类型")
    personality_traits: List[str] = Field(default_factory=list, description="性格特质列表")
    interaction_style: InteractionStyle = Field(default=InteractionStyle.CASUAL, description="交互风格")
    
    # 行为配置
    response_strategy: ResponseStrategy = Field(default=ResponseStrategy.EMPATHETIC, description="回复策略")
    verbosity_level: float = Field(default=0.7, ge=0.0, le=1.0, description="详细程度 0-1")
    formality_level: float = Field(default=0.3, ge=0.0, le=1.0, description="正式程度 0-1")
    creativity_level: float = Field(default=0.6, ge=0.0, le=1.0, description="创意程度 0-1")
    
    # 情绪配置
    available_emotions: List[EmotionValue] = Field(
        default_factory=lambda: [e.value for e in EmotionType], 
        description="可用情绪列表"
    )
    default_emotion: EmotionValue = Field(default="neutral", description="默认情绪")
    emotion_transitions: Dict[str, List[str]] = Field(default_factory=dict, description="情绪转换规则")
    emotion_stability: float = Field(default=0.7, ge=0.0, le=1.0, description="情绪稳定性")
    
    # 多媒体配置
    voice_styles: List[VoiceStyle] = Field(default_factory=list, description="可用语音风格")
    default_voice: Optional[VoiceStyle] = Field(default="sweet", description="默认语音风格")
    animations: List[AnimationType] = Field(default_factory=list, description="可用动画表情")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    
    # 知识和能力
    knowledge_domains: List[str] = Field(default_factory=list, description="知识领域")
    special_abilities: List[str] = Field(default_factory=list, description="特殊能力")
    language_preferences: List[str] = Field(default_factory=lambda: ["zh-CN"], description="语言偏好")
    
    # 适配器集成
    preferred_adapters: List[str] = Field(default_factory=list, description="偏好的适配器ID")
    adapter_configs: Dict[str, Any] = Field(default_factory=dict, description="适配器特定配置")
    
    # 学习和记忆
    memory_enabled: bool = Field(default=True, description="是否启用记忆")
    learning_enabled: bool = Field(default=True, description="是否启用学习")
    personalization_level: float = Field(default=0.5, ge=0.0, le=1.0, description="个性化程度")
    
    # 安全和限制
    content_filter_level: float = Field(default=0.7, ge=0.0, le=1.0, description="内容过滤级别")
    max_response_length: int = Field(default=2000, ge=100, le=10000, description="最大回复长度")
    allowed_topics: List[str] = Field(default_factory=list, description="允许的话题")
    forbidden_topics: List[str] = Field(default_factory=list, description="禁止的话题")
    
    # 系统配置
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    version: str = Field(default="1.0.0", description="配置版本")
    template: CharacterTemplate = Field(default=CharacterTemplate.ZISHU_BASE, description="基于的模板")
    
    # 运行时状态
    is_active: bool = Field(default=True, description="是否激活")
    current_emotion: Optional[EmotionValue] = Field(None, description="当前情绪状态")
    emotion_history: List[Dict[str, Any]] = Field(default_factory=list, description="情绪历史")
    
    # 扩展字段
    custom_prompts: Dict[str, str] = Field(default_factory=dict, description="自定义提示词")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="扩展元数据")
    
    # 验证器
    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("角色名称不能为空")
        return v.strip()
    
    @field_validator("personality_traits")
    @classmethod
    def validate_personality_traits(cls, v):
        if len(v) > 10:
            raise ValueError("性格特质不能超过10个")
        return v
    
    @field_validator("emotion_history")
    @classmethod
    def validate_emotion_history(cls, v):
        # 限制历史记录长度
        if len(v) > 100:
            return v[-100:]  # 只保留最近100条
        return v

class CharacterState(BaseModel):
    """角色运行时状态模型"""
    character_id: str = Field(..., description="角色配置ID")
    current_emotion: EmotionValue = Field(default="neutral", description="当前情绪")
    emotion_intensity: float = Field(default=0.5, ge=0.0, le=1.0, description="情绪强度")
    energy_level: float = Field(default=0.8, ge=0.0, le=1.0, description="精力水平")
    mood: Optional[str] = Field(None, description="当前心情描述")
    
    # 对话上下文
    conversation_count: int = Field(default=0, description="对话轮数")
    last_interaction: Optional[datetime] = Field(None, description="最后交互时间")
    active_topics: List[str] = Field(default_factory=list, description="当前活跃话题")
    
    # 学习状态
    learned_preferences: Dict[str, Any] = Field(default_factory=dict, description="学习到的偏好")
    interaction_patterns: Dict[str, Any] = Field(default_factory=dict, description="交互模式")
    
    # 适配器状态
    active_adapters: List[str] = Field(default_factory=list, description="当前活跃的适配器")
    adapter_states: Dict[str, Any] = Field(default_factory=dict, description="适配器状态")
    
    updated_at: datetime = Field(default_factory=datetime.now, description="状态更新时间")

class EmotionTransition(BaseModel):
    """情绪转换模型"""
    from_emotion: EmotionValue = Field(..., description="源情绪")
    to_emotion: EmotionValue = Field(..., description="目标情绪")
    trigger: str = Field(..., description="触发条件")
    probability: float = Field(default=1.0, ge=0.0, le=1.0, description="转换概率")
    duration: Optional[int] = Field(None, description="持续时间(秒)")
    
class CharacterTemplate_Model(BaseModel):
    """角色模板模型"""
    template_id: CharacterTemplate = Field(..., description="模板ID")
    name: str = Field(..., description="模板名称")
    description: str = Field(..., description="模板描述")
    config: CharacterConfig = Field(..., description="默认配置")
    preview_image: Optional[str] = Field(None, description="预览图片URL")
    tags: List[str] = Field(default_factory=list, description="标签")
    popularity: int = Field(default=0, description="受欢迎程度")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")

# ======================== 请求模型 ========================

class CreateCharacterRequest(BaseModel):
    """创建角色请求模型"""
    name: str = Field(..., min_length=1, max_length=50, description="角色名称")
    display_name: str = Field(..., min_length=1, max_length=50, description="显示名称")
    description: Optional[str] = Field("", max_length=500, description="角色描述")
    template: Optional[CharacterTemplate] = Field(CharacterTemplate.ZISHU_BASE, description="基于的模板")
    personality_type: Optional[PersonalityType] = Field(PersonalityType.FRIENDLY, description="主要性格类型")
    interaction_style: Optional[InteractionStyle] = Field(InteractionStyle.CASUAL, description="交互风格")
    custom_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="自定义配置")

class UpdateCharacterRequest(BaseModel):
    """更新角色请求模型"""
    name: Optional[str] = Field(None, min_length=1, max_length=50, description="角色名称")
    display_name: Optional[str] = Field(None, min_length=1, max_length=50, description="显示名称")
    description: Optional[str] = Field(None, max_length=500, description="角色描述")
    personality_type: Optional[PersonalityType] = Field(None, description="主要性格类型")
    personality_traits: Optional[List[str]] = Field(None, description="性格特质列表")
    interaction_style: Optional[InteractionStyle] = Field(None, description="交互风格")
    response_strategy: Optional[ResponseStrategy] = Field(None, description="回复策略")
    
    # 行为参数调整
    verbosity_level: Optional[float] = Field(None, ge=0.0, le=1.0, description="详细程度")
    formality_level: Optional[float] = Field(None, ge=0.0, le=1.0, description="正式程度")
    creativity_level: Optional[float] = Field(None, ge=0.0, le=1.0, description="创意程度")
    emotion_stability: Optional[float] = Field(None, ge=0.0, le=1.0, description="情绪稳定性")
    
    # 多媒体配置
    voice_styles: Optional[List[VoiceStyle]] = Field(None, description="可用语音风格")
    default_voice: Optional[VoiceStyle] = Field(None, description="默认语音风格")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    
    # 能力和知识
    knowledge_domains: Optional[List[str]] = Field(None, description="知识领域")
    special_abilities: Optional[List[str]] = Field(None, description="特殊能力")
    preferred_adapters: Optional[List[str]] = Field(None, description="偏好的适配器ID")
    
    # 学习和记忆设置
    memory_enabled: Optional[bool] = Field(None, description="是否启用记忆")
    learning_enabled: Optional[bool] = Field(None, description="是否启用学习")
    personalization_level: Optional[float] = Field(None, ge=0.0, le=1.0, description="个性化程度")
    
    # 安全设置
    content_filter_level: Optional[float] = Field(None, ge=0.0, le=1.0, description="内容过滤级别")
    max_response_length: Optional[int] = Field(None, ge=100, le=10000, description="最大回复长度")
    
    # 自定义配置
    custom_prompts: Optional[Dict[str, str]] = Field(None, description="自定义提示词")
    metadata: Optional[Dict[str, Any]] = Field(None, description="扩展元数据")

class SetEmotionRequest(BaseModel):
    """设置情绪请求模型"""
    emotion: EmotionValue = Field(..., description="目标情绪")
    intensity: Optional[float] = Field(0.7, ge=0.0, le=1.0, description="情绪强度")
    duration: Optional[int] = Field(None, ge=1, description="持续时间(秒)")
    reason: Optional[str] = Field(None, description="情绪变化原因")
    transition_type: Optional[str] = Field("natural", description="转换类型")

class EmotionAnalysisRequest(BaseModel):
    """情绪分析请求模型"""
    text: str = Field(..., min_length=1, description="待分析文本")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="上下文信息")
    current_emotion: Optional[EmotionValue] = Field(None, description="当前情绪状态")

class CharacterInteractionRequest(BaseModel):
    """角色交互请求模型"""
    character_id: str = Field(..., description="角色ID")
    message: str = Field(..., min_length=1, description="用户消息")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="交互上下文")
    preferred_emotion: Optional[EmotionValue] = Field(None, description="期望的回复情绪")
    adapter_preferences: Optional[List[str]] = Field(None, description="偏好的适配器")

class BatchCharacterOperation(BaseModel):
    """批量角色操作请求模型"""
    character_ids: List[str] = Field(..., min_items=1, description="角色ID列表")
    operation: Literal["activate", "deactivate", "delete", "export"] = Field(..., description="操作类型")
    parameters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="操作参数")

# ======================== 响应模型 ========================

class CharacterResponse(BaseModel):
    """角色响应模型"""
    success: bool = Field(..., description="操作是否成功")
    message: str = Field(..., description="响应消息")
    character: Optional[CharacterConfig] = Field(None, description="角色配置")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")

class CharacterListResponse(BaseModel):
    """角色列表响应模型"""
    success: bool = Field(..., description="操作是否成功")
    characters: List[CharacterConfig] = Field(..., description="角色配置列表")
    total: int = Field(..., description="总数量")
    page: int = Field(default=1, description="当前页码")
    page_size: int = Field(default=20, description="页面大小")
    message: Optional[str] = Field(None, description="响应消息")

class EmotionResponse(BaseModel):
    """情绪响应模型"""
    success: bool = Field(..., description="操作是否成功")
    current_emotion: EmotionValue = Field(..., description="当前情绪")
    emotion_intensity: float = Field(..., ge=0.0, le=1.0, description="情绪强度")
    previous_emotion: Optional[EmotionValue] = Field(None, description="之前的情绪")
    transition_reason: Optional[str] = Field(None, description="转换原因")
    suggested_responses: List[str] = Field(default_factory=list, description="建议回复")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")

class EmotionAnalysisResponse(BaseModel):
    """情绪分析响应模型"""
    success: bool = Field(..., description="分析是否成功")
    detected_emotions: List[Dict[str, Any]] = Field(..., description="检测到的情绪")
    primary_emotion: EmotionValue = Field(..., description="主要情绪")
    confidence: float = Field(..., ge=0.0, le=1.0, description="置信度")
    emotion_keywords: List[str] = Field(default_factory=list, description="情绪关键词")
    suggested_response_emotion: Optional[EmotionValue] = Field(None, description="建议的回复情绪")
    analysis_details: Dict[str, Any] = Field(default_factory=dict, description="分析详情")

class CharacterStateResponse(BaseModel):
    """角色状态响应模型"""
    success: bool = Field(..., description="操作是否成功")
    character_id: str = Field(..., description="角色ID")
    state: CharacterState = Field(..., description="角色状态")
    performance_metrics: Optional[Dict[str, Any]] = Field(None, description="性能指标")
    recommendations: List[str] = Field(default_factory=list, description="优化建议")

class TemplateListResponse(BaseModel):
    """模板列表响应模型"""
    success: bool = Field(..., description="操作是否成功")
    templates: List[CharacterTemplate_Model] = Field(..., description="模板列表")
    categories: List[str] = Field(default_factory=list, description="模板分类")
    popular_templates: List[str] = Field(default_factory=list, description="热门模板")

class CharacterInteractionResponse(BaseModel):
    """角色交互响应模型"""
    success: bool = Field(..., description="交互是否成功")
    response: str = Field(..., description="角色回复")
    emotion: EmotionValue = Field(..., description="回复时的情绪")
    voice_style: Optional[VoiceStyle] = Field(None, description="语音风格")
    animation: Optional[AnimationType] = Field(None, description="动画表情")
    
    # 元数据
    processing_time: float = Field(..., description="处理时间(秒)")
    tokens_used: Optional[int] = Field(None, description="使用的token数")
    adapters_used: List[str] = Field(default_factory=list, description="使用的适配器")
    
    # 学习信息
    learned_info: Optional[Dict[str, Any]] = Field(None, description="学习到的信息")
    personality_update: Optional[Dict[str, Any]] = Field(None, description="性格更新信息")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="回复时间")

class BatchOperationResponse(BaseModel):
    """批量操作响应模型"""
    success: bool = Field(..., description="批量操作是否成功")
    operation: str = Field(..., description="操作类型")
    total_count: int = Field(..., description="总操作数")
    success_count: int = Field(..., description="成功数")
    failed_count: int = Field(..., description="失败数")
    results: List[Dict[str, Any]] = Field(..., description="详细结果")
    errors: List[str] = Field(default_factory=list, description="错误列表")
    
class SystemStatsResponse(BaseModel):
    """系统统计响应模型"""
    success: bool = Field(..., description="获取是否成功")
    total_characters: int = Field(..., description="总角色数")
    active_characters: int = Field(..., description="活跃角色数")
    total_interactions: int = Field(..., description="总交互次数")
    popular_personalities: List[Dict[str, Any]] = Field(..., description="热门性格类型")
    emotion_distribution: Dict[str, int] = Field(..., description="情绪分布")
    system_health: Dict[str, Any] = Field(..., description="系统健康状态")
    timestamp: datetime = Field(default_factory=datetime.now, description="统计时间")