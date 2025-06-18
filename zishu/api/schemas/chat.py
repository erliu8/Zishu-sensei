#! /usr/bin/env python3
# -*- coding: utf-8 -*-

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any, Dict, Union, Literal
from datetime import datetime
from enum import Enum
import uuid

class MessageRole(str, Enum):
    """消息角色枚举"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"

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
EmotionType = Union[EmotionType, str]

class Message(BaseModel):
    """单条消息模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="消息唯一ID")
    role: MessageRole = Field(..., description="消息角色")
    content: str = Field(...,min_length=1,max_length=10000, description="消息内容")
    message_type: MessageType = Field(default=MessageType.TEXT, description="消息类型")
    timestamp: datetime = Field(default_factory=datetime.now, description="消息时间戳")
    
    #角色情绪状态 -支持自定义
    emotion: Optional[EmotionType] = Field(None, description="角色情绪状态")
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
        if not v.strip():
            raise ValueError("消息内容不能为空")
        return v.strip()
    
class CharacterConfig(BaseModel):
    """角色配置模型"""
    name: str = Field(..., description="角色名称")
    personality: str = Field(..., description="角色性格")
    
    #情绪配置
    available_emotions: List[str] = Field(default_factory=lambda: [e.value for e in EmotionType], description="可用情绪列表")
    default_emotion: str = Field(default="neutral", description="默认情绪")
    emotion_transitions: Dict[str, List[str]] = Field(default_factory=dict, description="情绪转换规则")
    
    #语音和动画
    voice_style: List[str] = Field(default_factory=list, description="可用语音风格")
    animations: List[str] = Field(default_factory=list, description="可用动画表情")
    
    

    
    

    