"""
社区交互相关数据模型

包含社区功能的核心实体：
- Forum: 论坛板块
- Topic: 话题/主题
- Post: 帖子内容
- Comment: 评论回复
- Like: 点赞系统
- Follow: 关注关系
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
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
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pydantic import BaseModel, Field, validator

from ..database.base import DatabaseBaseModel, MetadataMixin


# ================================
# 枚举定义
# ================================


class ForumType(str, Enum):
    """论坛类型"""

    GENERAL = "general"  # 综合讨论
    TECHNICAL = "technical"  # 技术讨论
    ADAPTER = "adapter"  # 适配器相关
    FEEDBACK = "feedback"  # 反馈建议
    SHOWCASE = "showcase"  # 作品展示
    HELP = "help"  # 帮助支持
    ANNOUNCEMENT = "announcement"  # 公告通知


class TopicStatus(str, Enum):
    """主题状态"""

    ACTIVE = "active"  # 活跃
    CLOSED = "closed"  # 已关闭
    LOCKED = "locked"  # 已锁定
    PINNED = "pinned"  # 置顶
    ARCHIVED = "archived"  # 已归档
    DELETED = "deleted"  # 已删除


class PostType(str, Enum):
    """帖子类型"""

    ORIGINAL = "original"  # 原创帖
    QUESTION = "question"  # 提问
    DISCUSSION = "discussion"  # 讨论
    TUTORIAL = "tutorial"  # 教程
    SHOWCASE = "showcase"  # 展示
    NEWS = "news"  # 新闻
    POLL = "poll"  # 投票


class PostStatus(str, Enum):
    """帖子状态"""

    PUBLISHED = "published"  # 已发布
    DRAFT = "draft"  # 草稿
    HIDDEN = "hidden"  # 已隐藏
    DELETED = "deleted"  # 已删除
    FEATURED = "featured"  # 精选


class CommentStatus(str, Enum):
    """评论状态"""

    PUBLISHED = "published"  # 已发布
    PENDING = "pending"  # 待审核
    HIDDEN = "hidden"  # 已隐藏
    DELETED = "deleted"  # 已删除


class LikeType(str, Enum):
    """点赞类型"""

    LIKE = "like"  # 点赞
    DISLIKE = "dislike"  # 踩
    LOVE = "love"  # 喜爱
    LAUGH = "laugh"  # 哈哈
    ANGRY = "angry"  # 愤怒
    SAD = "sad"  # 伤心


class FollowType(str, Enum):
    """关注类型"""

    USER = "user"  # 关注用户
    TOPIC = "topic"  # 关注主题
    FORUM = "forum"  # 关注论坛
    ADAPTER = "adapter"  # 关注适配器


# ================================
# SQLAlchemy 模型
# ================================


class Forum(DatabaseBaseModel, MetadataMixin):
    """
    论坛板块模型

    管理不同的讨论区域
    """

    __tablename__ = "forums"

    # 基础信息
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="论坛名称")

    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, comment="论坛标识符"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="论坛描述"
    )

    forum_type: Mapped[ForumType] = mapped_column(
        String(20), default=ForumType.GENERAL, nullable=False, comment="论坛类型"
    )

    # 层级结构
    parent_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("forums.id", ondelete="SET NULL"),
        nullable=True,
        comment="父论坛ID",
    )

    sort_order: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="排序顺序"
    )

    # 权限和设置
    is_public: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否公开可见"
    )

    allow_topics: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否允许发布主题"
    )

    allow_posts: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否允许发布帖子"
    )

    require_approval: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否需要审核"
    )

    # 管理员
    moderators: Mapped[Optional[List[str]]] = mapped_column(
        JSONB, nullable=True, comment="版主用户ID列表"
    )

    # 样式设置
    icon: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="论坛图标"
    )

    color: Mapped[Optional[str]] = mapped_column(
        String(7), nullable=True, comment="论坛颜色"  # #RRGGBB
    )

    banner_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="横幅图片URL"
    )

    # 统计信息
    topic_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="主题数量"
    )

    post_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="帖子数量"
    )

    last_activity_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="最后活动时间"
    )

    # 关联关系
    parent: Mapped[Optional["Forum"]] = relationship(
        "Forum", remote_side="Forum.id", back_populates="children"
    )

    children: Mapped[List["Forum"]] = relationship(
        "Forum", back_populates="parent", cascade="all, delete-orphan"
    )

    topics: Mapped[List["Topic"]] = relationship(
        "Topic", back_populates="forum", cascade="all, delete-orphan"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_forums_slug", "slug"),
        Index("idx_forums_type", "forum_type"),
        Index("idx_forums_parent_id", "parent_id"),
        Index("idx_forums_public", "is_public"),
        CheckConstraint(
            "length(name) >= 1 AND length(name) <= 100", name="check_forum_name_length"
        ),
        CheckConstraint(
            "color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'",
            name="check_forum_color_format",
        ),
    )


class Topic(DatabaseBaseModel, MetadataMixin):
    """
    话题模型

    论坛中的讨论主题
    """

    __tablename__ = "topics"

    # 关联论坛
    forum_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("forums.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属论坛ID",
    )

    # 基础信息
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="主题标题")

    slug: Mapped[str] = mapped_column(String(200), nullable=False, comment="主题标识符")

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="主题描述"
    )

    # 作者信息
    author_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="主题作者ID",
    )

    # 状态管理
    topic_status: Mapped[TopicStatus] = mapped_column(
        String(20), default=TopicStatus.ACTIVE, nullable=False, comment="主题状态"
    )

    is_sticky: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否置顶"
    )

    is_locked: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否锁定"
    )

    is_featured: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否精选"
    )

    # 标签和分类
    tags: Mapped[Optional[List[str]]] = mapped_column(
        JSONB, nullable=True, comment="主题标签"
    )

    # 统计信息
    view_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="浏览次数"
    )

    post_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="帖子数量"
    )

    like_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="点赞数量"
    )

    follow_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="关注数量"
    )

    # 最后活动
    last_post_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="最后发帖时间"
    )

    last_post_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="最后发帖用户ID",
    )

    # 关联关系
    forum: Mapped["Forum"] = relationship("Forum", back_populates="topics")

    posts: Mapped[List["Post"]] = relationship(
        "Post",
        back_populates="topic",
        cascade="all, delete-orphan",
        order_by="Post.created_at.asc()",
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_topics_forum_id", "forum_id"),
        Index("idx_topics_author_id", "author_id"),
        Index("idx_topics_slug", "slug"),
        Index("idx_topics_status", "topic_status"),
        Index("idx_topics_sticky", "is_sticky"),
        Index("idx_topics_featured", "is_featured"),
        Index("idx_topics_last_post_at", "last_post_at"),
        UniqueConstraint("forum_id", "slug", name="uk_topics_forum_slug"),
        CheckConstraint(
            "length(title) >= 1 AND length(title) <= 200",
            name="check_topic_title_length",
        ),
    )


class Post(DatabaseBaseModel, MetadataMixin):
    """
    帖子模型

    话题中的具体内容
    """

    __tablename__ = "posts"

    # 关联话题
    topic_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("topics.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属话题ID",
    )

    # 基础信息
    title: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True, comment="帖子标题"
    )

    content: Mapped[str] = mapped_column(
        Text, nullable=False, comment="帖子内容（Markdown格式）"
    )

    content_html: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="帖子内容（HTML格式）"
    )

    # 作者信息
    author_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="帖子作者ID",
    )

    # 帖子类型和状态
    post_type: Mapped[PostType] = mapped_column(
        String(20), default=PostType.ORIGINAL, nullable=False, comment="帖子类型"
    )

    post_status: Mapped[PostStatus] = mapped_column(
        String(20), default=PostStatus.PUBLISHED, nullable=False, comment="帖子状态"
    )

    # 回复关系
    parent_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("posts.id", ondelete="SET NULL"),
        nullable=True,
        comment="父帖子ID（回复关系）",
    )

    reply_to_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="回复目标用户ID",
    )

    # 内容属性
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否匿名发布"
    )

    allow_comments: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否允许评论"
    )

    # 附件信息
    attachments: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(
        JSONB, nullable=True, comment="附件信息"
    )

    images: Mapped[Optional[List[str]]] = mapped_column(
        JSONB, nullable=True, comment="图片URL列表"
    )

    # 编辑历史
    edit_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="编辑次数"
    )

    last_edited_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="最后编辑时间"
    )

    last_edited_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="最后编辑者ID",
    )

    edit_reason: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="编辑原因"
    )

    # 统计信息
    view_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="浏览次数"
    )

    like_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="点赞数量"
    )

    comment_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="评论数量"
    )

    # 发布时间
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="发布时间"
    )

    # 关联关系
    topic: Mapped["Topic"] = relationship("Topic", back_populates="posts")

    parent: Mapped[Optional["Post"]] = relationship(
        "Post", remote_side="Post.id", back_populates="replies"
    )

    replies: Mapped[List["Post"]] = relationship(
        "Post", back_populates="parent", cascade="all, delete-orphan"
    )

    comments: Mapped[List["Comment"]] = relationship(
        "Comment", back_populates="post", cascade="all, delete-orphan"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_posts_topic_id", "topic_id"),
        Index("idx_posts_author_id", "author_id"),
        Index("idx_posts_parent_id", "parent_id"),
        Index("idx_posts_type", "post_type"),
        Index("idx_posts_status", "post_status"),
        Index("idx_posts_published_at", "published_at"),
        Index("idx_posts_created_at", "created_at"),
    )


class Comment(DatabaseBaseModel):
    """
    评论模型

    对帖子的评论回复
    """

    __tablename__ = "comments"

    # 关联帖子
    post_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("posts.id", ondelete="CASCADE"),
        nullable=False,
        comment="所属帖子ID",
    )

    # 基础信息
    content: Mapped[str] = mapped_column(Text, nullable=False, comment="评论内容")

    # 作者信息
    author_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="评论作者ID",
    )

    # 回复关系
    parent_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("comments.id", ondelete="CASCADE"),
        nullable=True,
        comment="父评论ID",
    )

    reply_to_user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="回复目标用户ID",
    )

    # 状态管理
    comment_status: Mapped[CommentStatus] = mapped_column(
        String(20), default=CommentStatus.PUBLISHED, nullable=False, comment="评论状态"
    )

    is_anonymous: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否匿名评论"
    )

    # 编辑信息
    is_edited: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已编辑"
    )

    edited_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="编辑时间"
    )

    # 统计信息
    like_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="点赞数量"
    )

    # 关联关系
    post: Mapped["Post"] = relationship("Post", back_populates="comments")

    parent: Mapped[Optional["Comment"]] = relationship(
        "Comment", remote_side="Comment.id", back_populates="replies"
    )

    replies: Mapped[List["Comment"]] = relationship(
        "Comment", back_populates="parent", cascade="all, delete-orphan"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_comments_post_id", "post_id"),
        Index("idx_comments_author_id", "author_id"),
        Index("idx_comments_parent_id", "parent_id"),
        Index("idx_comments_status", "comment_status"),
        Index("idx_comments_created_at", "created_at"),
    )


class Like(DatabaseBaseModel):
    """
    点赞模型

    用户对内容的反应表态
    """

    __tablename__ = "likes"

    # 用户信息
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="点赞用户ID",
    )

    # 目标内容
    target_type: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="目标类型（post/comment/topic）"
    )

    target_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), nullable=False, comment="目标内容ID"
    )

    # 点赞类型
    like_type: Mapped[LikeType] = mapped_column(
        String(20), default=LikeType.LIKE, nullable=False, comment="点赞类型"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_likes_user_id", "user_id"),
        Index("idx_likes_target", "target_type", "target_id"),
        Index("idx_likes_type", "like_type"),
        UniqueConstraint("user_id", "target_type", "target_id", name="uk_likes_unique"),
    )


class Follow(DatabaseBaseModel):
    """
    关注模型

    用户对内容的关注关系
    """

    __tablename__ = "follows"

    # 关注者
    follower_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="关注者用户ID",
    )

    # 关注目标
    target_type: Mapped[FollowType] = mapped_column(
        String(20), nullable=False, comment="关注目标类型"
    )

    target_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), nullable=False, comment="关注目标ID"
    )

    # 通知设置
    notify_on_update: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否在更新时通知"
    )

    notify_on_reply: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否在回复时通知"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_follows_follower_id", "follower_id"),
        Index("idx_follows_target", "target_type", "target_id"),
        UniqueConstraint(
            "follower_id", "target_type", "target_id", name="uk_follows_unique"
        ),
    )


# ================================
# Pydantic 模式
# ================================


class ForumBase(BaseModel):
    """论坛基础模式"""

    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100, regex=r"^[a-z0-9-]+$")
    description: Optional[str] = None
    forum_type: ForumType = ForumType.GENERAL
    is_public: bool = True


class ForumCreate(ForumBase):
    """论坛创建模式"""

    parent_id: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = Field(None, regex=r"^#[0-9A-Fa-f]{6}$")


class ForumResponse(ForumBase):
    """论坛响应模式"""

    id: str
    parent_id: Optional[str]
    sort_order: int
    topic_count: int
    post_count: int
    last_activity_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class TopicBase(BaseModel):
    """话题基础模式"""

    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    tags: Optional[List[str]] = Field(None, max_items=10)


class TopicCreate(TopicBase):
    """话题创建模式"""

    forum_id: str


class TopicResponse(TopicBase):
    """话题响应模式"""

    id: str
    forum_id: str
    author_id: str
    slug: str
    topic_status: TopicStatus
    is_sticky: bool
    is_locked: bool
    is_featured: bool
    view_count: int
    post_count: int
    like_count: int
    follow_count: int
    last_post_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PostBase(BaseModel):
    """帖子基础模式"""

    title: Optional[str] = Field(None, max_length=200)
    content: str = Field(..., min_length=1)
    post_type: PostType = PostType.ORIGINAL
    is_anonymous: bool = False


class PostCreate(PostBase):
    """帖子创建模式"""

    topic_id: str
    parent_id: Optional[str] = None
    reply_to_user_id: Optional[str] = None


class PostResponse(PostBase):
    """帖子响应模式"""

    id: str
    topic_id: str
    author_id: str
    post_status: PostStatus
    parent_id: Optional[str]
    view_count: int
    like_count: int
    comment_count: int
    edit_count: int
    published_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CommentBase(BaseModel):
    """评论基础模式"""

    content: str = Field(..., min_length=1, max_length=1000)
    is_anonymous: bool = False


class CommentCreate(CommentBase):
    """评论创建模式"""

    post_id: str
    parent_id: Optional[str] = None
    reply_to_user_id: Optional[str] = None


class CommentResponse(CommentBase):
    """评论响应模式"""

    id: str
    post_id: str
    author_id: str
    parent_id: Optional[str]
    comment_status: CommentStatus
    like_count: int
    is_edited: bool
    created_at: datetime

    class Config:
        from_attributes = True
