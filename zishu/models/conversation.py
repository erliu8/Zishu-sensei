"""
对话系统相关数据模型

包含对话管理的核心实体：
- Conversation: 对话会话
- Message: 消息记录
- MessageAttachment: 消息附件
- ConversationParticipant: 对话参与者
- ConversationContext: 对话上下文
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
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
from pydantic import BaseModel, Field

from ..database.base import DatabaseBaseModel, MetadataMixin


# ================================
# 枚举定义
# ================================


class ConversationStatus(str, Enum):
    """对话状态"""

    ACTIVE = "active"  # 活跃
    PAUSED = "paused"  # 暂停
    COMPLETED = "completed"  # 已完成
    ARCHIVED = "archived"  # 已归档
    DELETED = "deleted"  # 已删除


class MessageRole(str, Enum):
    """消息角色"""

    USER = "user"  # 用户消息
    ASSISTANT = "assistant"  # AI助手消息
    SYSTEM = "system"  # 系统消息
    FUNCTION = "function"  # 函数调用结果
    TOOL = "tool"  # 工具调用结果


class MessageType(str, Enum):
    """消息类型"""

    TEXT = "text"  # 纯文本
    IMAGE = "image"  # 图片
    FILE = "file"  # 文件
    AUDIO = "audio"  # 音频
    VIDEO = "video"  # 视频
    CODE = "code"  # 代码
    MARKDOWN = "markdown"  # Markdown
    MIXED = "mixed"  # 混合类型


class MessageStatus(str, Enum):
    """消息状态"""

    PENDING = "pending"  # 等待中
    PROCESSING = "processing"  # 处理中
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 失败
    CANCELLED = "cancelled"  # 已取消


class AttachmentType(str, Enum):
    """附件类型"""

    IMAGE = "image"
    DOCUMENT = "document"
    AUDIO = "audio"
    VIDEO = "video"
    CODE = "code"
    OTHER = "other"


# ================================
# SQLAlchemy 模型
# ================================


class Conversation(DatabaseBaseModel, MetadataMixin):
    """
    对话会话模型

    管理用户与AI的对话会话
    """

    __tablename__ = "conversations"

    # 基础信息
    title: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, comment="对话标题"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="对话描述"
    )

    # 所有者
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户ID",
    )

    # 角色和适配器
    character_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("characters.id", ondelete="SET NULL"),
        nullable=True,
        comment="使用的角色ID",
    )

    active_adapters: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="启用的适配器ID列表"
    )

    # 对话状态
    conversation_status: Mapped[ConversationStatus] = mapped_column(
        String(20),
        default=ConversationStatus.ACTIVE,
        nullable=False,
        comment="对话状态",
    )

    # 统计信息
    message_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="消息总数"
    )

    token_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="Token总消耗"
    )

    total_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 6), nullable=True, comment="总花费（美元）"
    )

    # 上下文设置
    max_context_length: Mapped[int] = mapped_column(
        Integer, default=4000, nullable=False, comment="最大上下文长度"
    )

    system_prompt: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="系统提示词"
    )

    temperature: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(3, 2), nullable=True, comment="温度参数"
    )

    # 时间信息
    last_message_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="最后消息时间"
    )

    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="归档时间"
    )

    # 分享和协作
    is_shared: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否分享"
    )

    share_token: Mapped[Optional[str]] = mapped_column(
        String(64), unique=True, nullable=True, comment="分享令牌"
    )

    # 关联关系
    messages: Mapped[List["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at.asc()",
    )

    participants: Mapped[List["ConversationParticipant"]] = relationship(
        "ConversationParticipant",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )

    contexts: Mapped[List["ConversationContext"]] = relationship(
        "ConversationContext",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )

    # 索引
    __table_args__ = (
        Index("idx_conversations_user_id", "user_id"),
        Index("idx_conversations_character_id", "character_id"),
        Index("idx_conversations_status", "conversation_status"),
        Index("idx_conversations_last_message_at", "last_message_at"),
        Index("idx_conversations_share_token", "share_token"),
        CheckConstraint(
            "max_context_length >= 100 AND max_context_length <= 100000",
            name="check_max_context_length",
        ),
        CheckConstraint(
            "temperature IS NULL OR (temperature >= 0.00 AND temperature <= 2.00)",
            name="check_temperature_range",
        ),
    )


class Message(DatabaseBaseModel, MetadataMixin):
    """
    消息记录模型

    存储对话中的每条消息
    """

    __tablename__ = "messages"

    # 关联对话
    conversation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        comment="对话ID",
    )

    # 消息基础信息
    role: Mapped[MessageRole] = mapped_column(
        String(20), nullable=False, comment="消息角色"
    )

    message_type: Mapped[MessageType] = mapped_column(
        String(20), default=MessageType.TEXT, nullable=False, comment="消息类型"
    )

    content: Mapped[str] = mapped_column(Text, nullable=False, comment="消息内容")

    # 消息状态
    message_status: Mapped[MessageStatus] = mapped_column(
        String(20),
        default=MessageStatus.COMPLETED,
        nullable=False,
        comment="消息状态",
    )

    # 模型信息（AI消息）
    model: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="使用的模型"
    )

    model_provider: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="模型提供商"
    )

    # Token和成本
    prompt_tokens: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="输入Token数"
    )

    completion_tokens: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="输出Token数"
    )

    total_tokens: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="总Token数"
    )

    cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 6), nullable=True, comment="消息成本（美元）"
    )

    # 适配器信息
    adapter_used: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="使用的适配器"
    )

    adapter_result: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="适配器执行结果"
    )

    # 函数调用（Function Calling）
    function_name: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="调用的函数名"
    )

    function_arguments: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="函数参数"
    )

    function_result: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="函数返回结果"
    )

    # 错误信息
    error_code: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="错误代码"
    )

    error_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="错误信息"
    )

    # 消息顺序
    sequence: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="消息序号"
    )

    # 父消息（用于消息树）
    parent_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        comment="父消息ID",
    )

    # 关联关系
    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="messages"
    )

    parent: Mapped[Optional["Message"]] = relationship(
        "Message", remote_side="Message.id", back_populates="children"
    )

    children: Mapped[List["Message"]] = relationship(
        "Message", back_populates="parent", cascade="all, delete-orphan"
    )

    attachments: Mapped[List["MessageAttachment"]] = relationship(
        "MessageAttachment", back_populates="message", cascade="all, delete-orphan"
    )

    # 索引
    __table_args__ = (
        Index("idx_messages_conversation_id", "conversation_id"),
        Index("idx_messages_conversation_created", "conversation_id", "created_at"),
        Index("idx_messages_role", "role"),
        Index("idx_messages_status", "message_status"),
        Index("idx_messages_sequence", "sequence"),
        Index("idx_messages_parent_id", "parent_id"),
        CheckConstraint(
            "total_tokens IS NULL OR total_tokens >= 0",
            name="check_total_tokens",
        ),
    )


class MessageAttachment(DatabaseBaseModel):
    """
    消息附件模型

    管理消息中的附件文件
    """

    __tablename__ = "message_attachments"

    # 关联消息
    message_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        comment="消息ID",
    )

    # 附件信息
    attachment_type: Mapped[AttachmentType] = mapped_column(
        String(20), nullable=False, comment="附件类型"
    )

    filename: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="文件名"
    )

    original_filename: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="原始文件名"
    )

    file_size: Mapped[int] = mapped_column(
        Integer, nullable=False, comment="文件大小（字节）"
    )

    mime_type: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="MIME类型"
    )

    # 存储信息
    storage_path: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="存储路径"
    )

    storage_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="访问URL"
    )

    # 元数据
    file_metadata: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="文件元数据"
    )

    # 关联关系
    message: Mapped["Message"] = relationship(
        "Message", back_populates="attachments"
    )

    # 索引
    __table_args__ = (
        Index("idx_message_attachments_message_id", "message_id"),
        Index("idx_message_attachments_type", "attachment_type"),
    )


class ConversationParticipant(DatabaseBaseModel):
    """
    对话参与者模型

    管理对话的参与者和权限
    """

    __tablename__ = "conversation_participants"

    # 关联对话和用户
    conversation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        comment="对话ID",
    )

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户ID",
    )

    # 角色和权限
    role: Mapped[str] = mapped_column(
        String(20), default="participant", nullable=False, comment="角色"
    )

    permissions: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="权限列表"
    )

    # 参与信息
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="加入时间",
    )

    last_read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="最后阅读时间"
    )

    last_read_message_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), nullable=True, comment="最后阅读的消息ID"
    )

    # 通知设置
    notifications_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否启用通知"
    )

    # 关联关系
    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="participants"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_conversation_participants_conversation_id", "conversation_id"),
        Index("idx_conversation_participants_user_id", "user_id"),
        UniqueConstraint(
            "conversation_id",
            "user_id",
            name="uk_conversation_participants_unique",
        ),
    )


class ConversationContext(DatabaseBaseModel):
    """
    对话上下文模型

    存储对话的上下文信息和记忆
    """

    __tablename__ = "conversation_contexts"

    # 关联对话
    conversation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        comment="对话ID",
    )

    # 上下文信息
    context_key: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="上下文键"
    )

    context_value: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="上下文值"
    )

    context_type: Mapped[str] = mapped_column(
        String(50), default="memory", nullable=False, comment="上下文类型"
    )

    # 优先级和过期
    priority: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="优先级"
    )

    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="过期时间"
    )

    # 来源
    source: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="上下文来源"
    )

    # 关联关系
    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="contexts"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_conversation_contexts_conversation_id", "conversation_id"),
        Index("idx_conversation_contexts_key", "context_key"),
        Index("idx_conversation_contexts_type", "context_type"),
        UniqueConstraint(
            "conversation_id",
            "context_key",
            name="uk_conversation_contexts_unique",
        ),
    )


# ================================
# Pydantic 模式
# ================================


class ConversationCreate(BaseModel):
    """对话创建模式"""

    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    character_id: Optional[str] = None
    active_adapters: Optional[List[str]] = None
    system_prompt: Optional[str] = None
    max_context_length: int = Field(4000, ge=100, le=100000)


class ConversationUpdate(BaseModel):
    """对话更新模式"""

    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    active_adapters: Optional[List[str]] = None
    system_prompt: Optional[str] = None


class ConversationResponse(BaseModel):
    """对话响应模式"""

    id: str
    user_id: str
    title: Optional[str]
    character_id: Optional[str]
    conversation_status: ConversationStatus
    message_count: int
    token_count: int
    total_cost: Optional[Decimal]
    last_message_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    """消息创建模式"""

    role: MessageRole
    content: str
    message_type: MessageType = MessageType.TEXT
    adapter_used: Optional[str] = None


class MessageResponse(BaseModel):
    """消息响应模式"""

    id: str
    conversation_id: str
    role: MessageRole
    content: str
    message_type: MessageType
    message_status: MessageStatus
    model: Optional[str]
    total_tokens: Optional[int]
    cost: Optional[Decimal]
    sequence: int
    created_at: datetime

    class Config:
        from_attributes = True

