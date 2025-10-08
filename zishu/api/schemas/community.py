#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
社区数据模型 - Zishu-sensei
提供全面的社区系统API接口数据验证和序列化
包含社区管理、内容发布、互动系统、适配器市场等功能
"""

from pydantic import BaseModel, Field, field_validator, model_validator, HttpUrl
from typing import Optional, List, Any, Dict, Union, Literal
from datetime import datetime, timedelta
from enum import Enum
import uuid
import re

# 从认证和用户模块导入基础枚举
from .auth import UserRole, UserStatus
from .user import UserProfileDetail

# ======================== 枚举定义 ========================


class CommunityType(str, Enum):
    """社区类型枚举"""

    PUBLIC = "public"  # 公开社区
    PRIVATE = "private"  # 私密社区
    INVITE_ONLY = "invite_only"  # 仅邀请
    OFFICIAL = "official"  # 官方社区
    ADAPTER_HUB = "adapter_hub"  # 适配器中心
    DEVELOPMENT = "development"  # 开发者社区
    FEEDBACK = "feedback"  # 反馈社区
    SUPPORT = "support"  # 技术支持
    GENERAL = "general"  # 通用讨论


class CommunityStatus(str, Enum):
    """社区状态枚举"""

    ACTIVE = "active"  # 活跃
    ARCHIVED = "archived"  # 已归档
    SUSPENDED = "suspended"  # 暂停
    DELETED = "deleted"  # 已删除
    PRIVATE_MODE = "private_mode"  # 私密模式
    MAINTENANCE = "maintenance"  # 维护中


class MemberRole(str, Enum):
    """社区成员角色枚举"""

    OWNER = "owner"  # 社区所有者
    ADMIN = "admin"  # 管理员
    MODERATOR = "moderator"  # 版主
    VIP_MEMBER = "vip_member"  # VIP成员
    MEMBER = "member"  # 普通成员
    GUEST = "guest"  # 访客
    BANNED = "banned"  # 被封禁


class PostType(str, Enum):
    """帖子类型枚举"""

    DISCUSSION = "discussion"  # 讨论帖
    ANNOUNCEMENT = "announcement"  # 公告
    QUESTION = "question"  # 问题
    SHOWCASE = "showcase"  # 作品展示
    TUTORIAL = "tutorial"  # 教程
    ADAPTER_RELEASE = "adapter_release"  # 适配器发布
    BUG_REPORT = "bug_report"  # Bug报告
    FEATURE_REQUEST = "feature_request"  # 功能请求
    POLL = "poll"  # 投票
    EVENT = "event"  # 活动


class PostStatus(str, Enum):
    """帖子状态枚举"""

    DRAFT = "draft"  # 草稿
    PUBLISHED = "published"  # 已发布
    PINNED = "pinned"  # 置顶
    LOCKED = "locked"  # 锁定
    ARCHIVED = "archived"  # 已归档
    DELETED = "deleted"  # 已删除
    PENDING_REVIEW = "pending_review"  # 待审核
    REJECTED = "rejected"  # 被拒绝


class CommentStatus(str, Enum):
    """评论状态枚举"""

    PUBLISHED = "published"  # 已发布
    PENDING = "pending"  # 待审核
    HIDDEN = "hidden"  # 已隐藏
    DELETED = "deleted"  # 已删除
    FLAGGED = "flagged"  # 被举报


class ReactionType(str, Enum):
    """互动类型枚举"""

    LIKE = "like"  # 点赞
    LOVE = "love"  # 喜爱
    LAUGH = "laugh"  # 大笑
    WOW = "wow"  # 惊叹
    ANGRY = "angry"  # 生气
    CONFUSED = "confused"  # 困惑
    HEART = "heart"  # 爱心
    THUMBS_UP = "thumbs_up"  # 赞同
    THUMBS_DOWN = "thumbs_down"  # 反对


class ReportReason(str, Enum):
    """举报原因枚举"""

    SPAM = "spam"  # 垃圾信息
    HARASSMENT = "harassment"  # 骚扰
    INAPPROPRIATE = "inappropriate"  # 不当内容
    COPYRIGHT = "copyright"  # 版权侵犯
    FALSE_INFO = "false_info"  # 虚假信息
    HATE_SPEECH = "hate_speech"  # 仇恨言论
    VIOLENCE = "violence"  # 暴力内容
    ADULT_CONTENT = "adult_content"  # 成人内容
    OTHER = "other"  # 其他


class AdapterCategory(str, Enum):
    """适配器分类枚举"""

    CHAT = "chat"  # 对话类
    PRODUCTIVITY = "productivity"  # 效率工具
    ENTERTAINMENT = "entertainment"  # 娱乐
    EDUCATION = "education"  # 教育
    BUSINESS = "business"  # 商务
    CREATIVE = "creative"  # 创意
    DEVELOPER_TOOLS = "developer_tools"  # 开发工具
    LIFESTYLE = "lifestyle"  # 生活方式
    GAMES = "games"  # 游戏
    OTHER = "other"  # 其他


class AdapterStatus(str, Enum):
    """适配器状态枚举"""

    DRAFT = "draft"  # 草稿
    PENDING_REVIEW = "pending_review"  # 待审核
    APPROVED = "approved"  # 已批准
    PUBLISHED = "published"  # 已发布
    REJECTED = "rejected"  # 被拒绝
    DEPRECATED = "deprecated"  # 已弃用
    REMOVED = "removed"  # 已移除


class NotificationType(str, Enum):
    """通知类型枚举"""

    MENTION = "mention"  # 提及
    REPLY = "reply"  # 回复
    LIKE = "like"  # 点赞
    FOLLOW = "follow"  # 关注
    JOIN_REQUEST = "join_request"  # 入群申请
    COMMUNITY_INVITE = "community_invite"  # 社区邀请
    POST_APPROVED = "post_approved"  # 帖子通过
    POST_REJECTED = "post_rejected"  # 帖子被拒
    ADAPTER_UPDATE = "adapter_update"  # 适配器更新
    SYSTEM = "system"  # 系统通知


# ======================== 基础模型 ========================


class CommunityBase(BaseModel):
    """社区基础模型"""

    name: str = Field(..., min_length=2, max_length=100, description="社区名称")
    description: Optional[str] = Field(None, max_length=500, description="社区描述")
    avatar_url: Optional[HttpUrl] = Field(None, description="社区头像")
    banner_url: Optional[HttpUrl] = Field(None, description="社区横幅")
    community_type: CommunityType = Field(
        default=CommunityType.PUBLIC, description="社区类型"
    )
    rules: Optional[str] = Field(None, max_length=2000, description="社区规则")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    settings: Dict[str, Any] = Field(default_factory=dict, description="社区设置")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if not re.match(r"^[a-zA-Z0-9\u4e00-\u9fff_\-\s]+$", v):
            raise ValueError("社区名称只能包含字母、数字、中文、下划线和连字符")
        return v.strip()

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if len(v) > 10:
            raise ValueError("标签数量不能超过10个")
        return [tag.strip().lower() for tag in v if tag.strip()]


class PostBase(BaseModel):
    """帖子基础模型"""

    title: str = Field(..., min_length=1, max_length=200, description="帖子标题")
    content: str = Field(..., min_length=1, max_length=50000, description="帖子内容")
    post_type: PostType = Field(default=PostType.DISCUSSION, description="帖子类型")
    tags: List[str] = Field(default_factory=list, description="标签列表")
    attachments: List[str] = Field(default_factory=list, description="附件列表")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v):
        return v.strip()

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if len(v) > 5:
            raise ValueError("标签数量不能超过5个")
        return [tag.strip().lower() for tag in v if tag.strip()]


class CommentBase(BaseModel):
    """评论基础模型"""

    content: str = Field(..., min_length=1, max_length=10000, description="评论内容")
    attachments: List[str] = Field(default_factory=list, description="附件列表")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v):
        return v.strip()


class AdapterBase(BaseModel):
    """适配器基础模型"""

    name: str = Field(..., min_length=2, max_length=100, description="适配器名称")
    display_name: str = Field(..., min_length=2, max_length=100, description="显示名称")
    description: str = Field(..., min_length=10, max_length=1000, description="适配器描述")
    version: str = Field(..., description="版本号")
    category: AdapterCategory = Field(..., description="分类")
    tags: List[str] = Field(default_factory=list, description="标签")
    icon_url: Optional[HttpUrl] = Field(None, description="图标URL")
    screenshots: List[HttpUrl] = Field(default_factory=list, description="截图列表")
    download_url: Optional[HttpUrl] = Field(None, description="下载链接")
    github_url: Optional[HttpUrl] = Field(None, description="GitHub链接")
    documentation_url: Optional[HttpUrl] = Field(None, description="文档链接")
    requirements: List[str] = Field(default_factory=list, description="依赖要求")
    compatibility: Dict[str, str] = Field(default_factory=dict, description="兼容性信息")
    pricing: Dict[str, Any] = Field(default_factory=dict, description="定价信息")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if not re.match(r"^[a-z][a-z0-9\-_]*$", v):
            raise ValueError("适配器名称必须以小写字母开头，只能包含小写字母、数字、连字符和下划线")
        return v

    @field_validator("version")
    @classmethod
    def validate_version(cls, v):
        if not re.match(r"^\d+\.\d+\.\d+(?:-[a-zA-Z0-9\-]+)?$", v):
            raise ValueError("版本号格式不正确，应为 x.y.z 或 x.y.z-suffix")
        return v


# ======================== 详细模型 ========================


class Community(CommunityBase):
    """社区完整模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="社区ID")
    slug: str = Field(..., description="社区标识符")
    owner_id: str = Field(..., description="所有者ID")
    status: CommunityStatus = Field(default=CommunityStatus.ACTIVE, description="社区状态")
    member_count: int = Field(default=0, ge=0, description="成员数量")
    post_count: int = Field(default=0, ge=0, description="帖子数量")
    is_verified: bool = Field(default=False, description="是否已验证")
    is_featured: bool = Field(default=False, description="是否精选")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v):
        if not re.match(r"^[a-z0-9\-]+$", v):
            raise ValueError("社区标识符只能包含小写字母、数字和连字符")
        return v


class Post(PostBase):
    """帖子完整模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="帖子ID")
    community_id: str = Field(..., description="所属社区ID")
    author_id: str = Field(..., description="作者ID")
    status: PostStatus = Field(default=PostStatus.PUBLISHED, description="帖子状态")
    view_count: int = Field(default=0, ge=0, description="浏览次数")
    like_count: int = Field(default=0, ge=0, description="点赞数")
    comment_count: int = Field(default=0, ge=0, description="评论数")
    share_count: int = Field(default=0, ge=0, description="分享数")
    is_pinned: bool = Field(default=False, description="是否置顶")
    is_locked: bool = Field(default=False, description="是否锁定")
    is_featured: bool = Field(default=False, description="是否精选")
    last_activity_at: datetime = Field(
        default_factory=datetime.now, description="最后活动时间"
    )
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")


class Comment(CommentBase):
    """评论完整模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="评论ID")
    post_id: str = Field(..., description="所属帖子ID")
    parent_id: Optional[str] = Field(None, description="父评论ID")
    author_id: str = Field(..., description="作者ID")
    status: CommentStatus = Field(default=CommentStatus.PUBLISHED, description="评论状态")
    like_count: int = Field(default=0, ge=0, description="点赞数")
    reply_count: int = Field(default=0, ge=0, description="回复数")
    is_pinned: bool = Field(default=False, description="是否置顶")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")


class CommunityMember(BaseModel):
    """社区成员模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="成员关系ID")
    community_id: str = Field(..., description="社区ID")
    user_id: str = Field(..., description="用户ID")
    role: MemberRole = Field(default=MemberRole.MEMBER, description="成员角色")
    status: UserStatus = Field(default=UserStatus.ACTIVE, description="成员状态")
    join_reason: Optional[str] = Field(None, max_length=200, description="加入原因")
    custom_title: Optional[str] = Field(None, max_length=50, description="自定义头衔")
    permissions: List[str] = Field(default_factory=list, description="特殊权限")
    joined_at: datetime = Field(default_factory=datetime.now, description="加入时间")
    last_activity_at: Optional[datetime] = Field(None, description="最后活动时间")


class Reaction(BaseModel):
    """互动反应模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="反应ID")
    user_id: str = Field(..., description="用户ID")
    target_type: Literal["post", "comment"] = Field(..., description="目标类型")
    target_id: str = Field(..., description="目标ID")
    reaction_type: ReactionType = Field(..., description="反应类型")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")


class Follow(BaseModel):
    """关注关系模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="关注ID")
    follower_id: str = Field(..., description="关注者ID")
    target_type: Literal["user", "community", "adapter"] = Field(
        ..., description="关注目标类型"
    )
    target_id: str = Field(..., description="关注目标ID")
    created_at: datetime = Field(default_factory=datetime.now, description="关注时间")


class Report(BaseModel):
    """举报模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="举报ID")
    reporter_id: str = Field(..., description="举报者ID")
    target_type: Literal["post", "comment", "user", "community"] = Field(
        ..., description="举报目标类型"
    )
    target_id: str = Field(..., description="举报目标ID")
    reason: ReportReason = Field(..., description="举报原因")
    description: Optional[str] = Field(None, max_length=1000, description="详细描述")
    status: Literal["pending", "resolved", "rejected"] = Field(
        default="pending", description="处理状态"
    )
    resolved_by: Optional[str] = Field(None, description="处理人ID")
    resolved_at: Optional[datetime] = Field(None, description="处理时间")
    created_at: datetime = Field(default_factory=datetime.now, description="举报时间")


class Adapter(AdapterBase):
    """适配器完整模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="适配器ID")
    slug: str = Field(..., description="适配器唯一标识")
    author_id: str = Field(..., description="作者ID")
    community_id: Optional[str] = Field(None, description="所属社区ID")
    status: AdapterStatus = Field(default=AdapterStatus.DRAFT, description="适配器状态")
    download_count: int = Field(default=0, ge=0, description="下载次数")
    rating: float = Field(default=0.0, ge=0.0, le=5.0, description="评分")
    rating_count: int = Field(default=0, ge=0, description="评分数量")
    like_count: int = Field(default=0, ge=0, description="点赞数")
    file_size: int = Field(default=0, ge=0, description="文件大小（字节）")
    is_featured: bool = Field(default=False, description="是否精选")
    is_verified: bool = Field(default=False, description="是否已验证")
    last_updated: datetime = Field(default_factory=datetime.now, description="最后更新时间")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v):
        if not re.match(r"^[a-z0-9\-]+$", v):
            raise ValueError("适配器标识符只能包含小写字母、数字和连字符")
        return v


class AdapterReview(BaseModel):
    """适配器评论模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="评论ID")
    adapter_id: str = Field(..., description="适配器ID")
    user_id: str = Field(..., description="用户ID")
    rating: int = Field(..., ge=1, le=5, description="评分")
    title: Optional[str] = Field(None, max_length=100, description="评论标题")
    content: Optional[str] = Field(None, max_length=2000, description="评论内容")
    pros: List[str] = Field(default_factory=list, description="优点")
    cons: List[str] = Field(default_factory=list, description="缺点")
    is_verified_purchase: bool = Field(default=False, description="是否已验证使用")
    helpful_count: int = Field(default=0, ge=0, description="有用数")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")


class Notification(BaseModel):
    """通知模型"""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="通知ID")
    user_id: str = Field(..., description="接收用户ID")
    type: NotificationType = Field(..., description="通知类型")
    title: str = Field(..., max_length=200, description="通知标题")
    content: str = Field(..., max_length=500, description="通知内容")
    data: Dict[str, Any] = Field(default_factory=dict, description="额外数据")
    is_read: bool = Field(default=False, description="是否已读")
    read_at: Optional[datetime] = Field(None, description="阅读时间")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")


# ======================== 请求模型 ========================


class CommunityCreateRequest(CommunityBase):
    """创建社区请求"""

    slug: str = Field(..., description="社区标识符")


class CommunityUpdateRequest(BaseModel):
    """更新社区请求"""

    name: Optional[str] = Field(None, min_length=2, max_length=100, description="社区名称")
    description: Optional[str] = Field(None, max_length=500, description="社区描述")
    avatar_url: Optional[HttpUrl] = Field(None, description="社区头像")
    banner_url: Optional[HttpUrl] = Field(None, description="社区横幅")
    community_type: Optional[CommunityType] = Field(None, description="社区类型")
    rules: Optional[str] = Field(None, max_length=2000, description="社区规则")
    tags: Optional[List[str]] = Field(None, description="标签列表")
    settings: Optional[Dict[str, Any]] = Field(None, description="社区设置")


class PostCreateRequest(PostBase):
    """创建帖子请求"""

    community_id: str = Field(..., description="所属社区ID")


class PostUpdateRequest(BaseModel):
    """更新帖子请求"""

    title: Optional[str] = Field(None, min_length=1, max_length=200, description="帖子标题")
    content: Optional[str] = Field(
        None, min_length=1, max_length=50000, description="帖子内容"
    )
    post_type: Optional[PostType] = Field(None, description="帖子类型")
    tags: Optional[List[str]] = Field(None, description="标签列表")
    attachments: Optional[List[str]] = Field(None, description="附件列表")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")


class CommentCreateRequest(CommentBase):
    """创建评论请求"""

    post_id: str = Field(..., description="所属帖子ID")
    parent_id: Optional[str] = Field(None, description="父评论ID")


class CommentUpdateRequest(BaseModel):
    """更新评论请求"""

    content: Optional[str] = Field(
        None, min_length=1, max_length=10000, description="评论内容"
    )
    attachments: Optional[List[str]] = Field(None, description="附件列表")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据")


class CommunityJoinRequest(BaseModel):
    """加入社区请求"""

    community_id: str = Field(..., description="社区ID")
    reason: Optional[str] = Field(None, max_length=200, description="加入原因")


class CommunityInviteRequest(BaseModel):
    """邀请加入社区请求"""

    community_id: str = Field(..., description="社区ID")
    user_ids: List[str] = Field(..., min_length=1, max_length=50, description="用户ID列表")
    message: Optional[str] = Field(None, max_length=500, description="邀请消息")


class ReactionCreateRequest(BaseModel):
    """创建反应请求"""

    target_type: Literal["post", "comment"] = Field(..., description="目标类型")
    target_id: str = Field(..., description="目标ID")
    reaction_type: ReactionType = Field(..., description="反应类型")


class FollowCreateRequest(BaseModel):
    """创建关注请求"""

    target_type: Literal["user", "community", "adapter"] = Field(
        ..., description="关注目标类型"
    )
    target_id: str = Field(..., description="关注目标ID")


class ReportCreateRequest(BaseModel):
    """创建举报请求"""

    target_type: Literal["post", "comment", "user", "community"] = Field(
        ..., description="举报目标类型"
    )
    target_id: str = Field(..., description="举报目标ID")
    reason: ReportReason = Field(..., description="举报原因")
    description: Optional[str] = Field(None, max_length=1000, description="详细描述")


class AdapterCreateRequest(AdapterBase):
    """创建适配器请求"""

    slug: str = Field(..., description="适配器唯一标识")
    community_id: Optional[str] = Field(None, description="所属社区ID")


class AdapterUpdateRequest(BaseModel):
    """更新适配器请求"""

    name: Optional[str] = Field(None, min_length=2, max_length=100, description="适配器名称")
    display_name: Optional[str] = Field(
        None, min_length=2, max_length=100, description="显示名称"
    )
    description: Optional[str] = Field(
        None, min_length=10, max_length=1000, description="适配器描述"
    )
    version: Optional[str] = Field(None, description="版本号")
    category: Optional[AdapterCategory] = Field(None, description="分类")
    tags: Optional[List[str]] = Field(None, description="标签")
    icon_url: Optional[HttpUrl] = Field(None, description="图标URL")
    screenshots: Optional[List[HttpUrl]] = Field(None, description="截图列表")
    download_url: Optional[HttpUrl] = Field(None, description="下载链接")
    github_url: Optional[HttpUrl] = Field(None, description="GitHub链接")
    documentation_url: Optional[HttpUrl] = Field(None, description="文档链接")
    requirements: Optional[List[str]] = Field(None, description="依赖要求")
    compatibility: Optional[Dict[str, str]] = Field(None, description="兼容性信息")
    pricing: Optional[Dict[str, Any]] = Field(None, description="定价信息")


class AdapterReviewCreateRequest(BaseModel):
    """创建适配器评论请求"""

    adapter_id: str = Field(..., description="适配器ID")
    rating: int = Field(..., ge=1, le=5, description="评分")
    title: Optional[str] = Field(None, max_length=100, description="评论标题")
    content: Optional[str] = Field(None, max_length=2000, description="评论内容")
    pros: List[str] = Field(default_factory=list, description="优点")
    cons: List[str] = Field(default_factory=list, description="缺点")


# ======================== 响应模型 ========================


class CommunityListItem(BaseModel):
    """社区列表项"""

    id: str = Field(..., description="社区ID")
    name: str = Field(..., description="社区名称")
    description: Optional[str] = Field(None, description="社区描述")
    slug: str = Field(..., description="社区标识符")
    avatar_url: Optional[HttpUrl] = Field(None, description="社区头像")
    community_type: CommunityType = Field(..., description="社区类型")
    member_count: int = Field(..., description="成员数量")
    post_count: int = Field(..., description="帖子数量")
    is_verified: bool = Field(..., description="是否已验证")
    is_featured: bool = Field(..., description="是否精选")
    tags: List[str] = Field(..., description="标签列表")
    created_at: datetime = Field(..., description="创建时间")


class PostListItem(BaseModel):
    """帖子列表项"""

    id: str = Field(..., description="帖子ID")
    title: str = Field(..., description="帖子标题")
    post_type: PostType = Field(..., description="帖子类型")
    author_id: str = Field(..., description="作者ID")
    author_name: str = Field(..., description="作者名称")
    author_avatar: Optional[HttpUrl] = Field(None, description="作者头像")
    community_id: str = Field(..., description="所属社区ID")
    community_name: str = Field(..., description="社区名称")
    view_count: int = Field(..., description="浏览次数")
    like_count: int = Field(..., description="点赞数")
    comment_count: int = Field(..., description="评论数")
    is_pinned: bool = Field(..., description="是否置顶")
    is_locked: bool = Field(..., description="是否锁定")
    tags: List[str] = Field(..., description="标签列表")
    last_activity_at: datetime = Field(..., description="最后活动时间")
    created_at: datetime = Field(..., description="创建时间")


class CommentListItem(BaseModel):
    """评论列表项"""

    id: str = Field(..., description="评论ID")
    content: str = Field(..., description="评论内容")
    author_id: str = Field(..., description="作者ID")
    author_name: str = Field(..., description="作者名称")
    author_avatar: Optional[HttpUrl] = Field(None, description="作者头像")
    parent_id: Optional[str] = Field(None, description="父评论ID")
    like_count: int = Field(..., description="点赞数")
    reply_count: int = Field(..., description="回复数")
    is_pinned: bool = Field(..., description="是否置顶")
    created_at: datetime = Field(..., description="创建时间")


class AdapterListItem(BaseModel):
    """适配器列表项"""

    id: str = Field(..., description="适配器ID")
    name: str = Field(..., description="适配器名称")
    display_name: str = Field(..., description="显示名称")
    description: str = Field(..., description="适配器描述")
    slug: str = Field(..., description="适配器标识符")
    version: str = Field(..., description="版本号")
    category: AdapterCategory = Field(..., description="分类")
    author_id: str = Field(..., description="作者ID")
    author_name: str = Field(..., description="作者名称")
    icon_url: Optional[HttpUrl] = Field(None, description="图标URL")
    download_count: int = Field(..., description="下载次数")
    rating: float = Field(..., description="评分")
    rating_count: int = Field(..., description="评分数量")
    is_featured: bool = Field(..., description="是否精选")
    is_verified: bool = Field(..., description="是否已验证")
    tags: List[str] = Field(..., description="标签")
    created_at: datetime = Field(..., description="创建时间")


class CommunityDetailResponse(Community):
    """社区详情响应"""

    owner: UserProfileDetail = Field(..., description="所有者信息")
    user_role: Optional[MemberRole] = Field(None, description="当前用户角色")
    is_member: bool = Field(default=False, description="是否已加入")
    recent_posts: List[PostListItem] = Field(default_factory=list, description="最近帖子")


class PostDetailResponse(Post):
    """帖子详情响应"""

    author: UserProfileDetail = Field(..., description="作者信息")
    community: CommunityListItem = Field(..., description="所属社区")
    reactions: Dict[str, int] = Field(default_factory=dict, description="反应统计")
    user_reaction: Optional[ReactionType] = Field(None, description="用户反应")
    is_bookmarked: bool = Field(default=False, description="是否已收藏")


class CommentDetailResponse(Comment):
    """评论详情响应"""

    author: UserProfileDetail = Field(..., description="作者信息")
    replies: List["CommentDetailResponse"] = Field(
        default_factory=list, description="回复列表"
    )
    reactions: Dict[str, int] = Field(default_factory=dict, description="反应统计")
    user_reaction: Optional[ReactionType] = Field(None, description="用户反应")


class AdapterDetailResponse(Adapter):
    """适配器详情响应"""

    author: UserProfileDetail = Field(..., description="作者信息")
    community: Optional[CommunityListItem] = Field(None, description="所属社区")
    recent_reviews: List[AdapterReview] = Field(
        default_factory=list, description="最近评论"
    )
    is_following: bool = Field(default=False, description="是否已关注")
    is_liked: bool = Field(default=False, description="是否已点赞")
    is_downloaded: bool = Field(default=False, description="是否已下载")


class PaginatedResponse(BaseModel):
    """分页响应基类"""

    items: List[Any] = Field(..., description="数据列表")
    total: int = Field(..., ge=0, description="总数量")
    page: int = Field(..., ge=1, description="当前页码")
    size: int = Field(..., ge=1, le=100, description="页面大小")
    has_next: bool = Field(..., description="是否有下一页")
    has_prev: bool = Field(..., description="是否有上一页")


class SearchFilters(BaseModel):
    """搜索过滤器"""

    query: Optional[str] = Field(None, description="搜索关键词")
    tags: Optional[List[str]] = Field(None, description="标签过滤")
    category: Optional[str] = Field(None, description="分类过滤")
    date_from: Optional[datetime] = Field(None, description="开始时间")
    date_to: Optional[datetime] = Field(None, description="结束时间")
    sort_by: str = Field(default="created_at", description="排序字段")
    sort_order: Literal["asc", "desc"] = Field(default="desc", description="排序方向")


# ======================== 统计模型 ========================


class CommunityStats(BaseModel):
    """社区统计信息"""

    total_members: int = Field(..., ge=0, description="总成员数")
    active_members: int = Field(..., ge=0, description="活跃成员数")
    total_posts: int = Field(..., ge=0, description="总帖子数")
    total_comments: int = Field(..., ge=0, description="总评论数")
    posts_today: int = Field(..., ge=0, description="今日帖子数")
    posts_this_week: int = Field(..., ge=0, description="本周帖子数")
    posts_this_month: int = Field(..., ge=0, description="本月帖子数")
    top_contributors: List[Dict[str, Any]] = Field(
        default_factory=list, description="贡献者排行"
    )
    popular_tags: List[Dict[str, Any]] = Field(default_factory=list, description="热门标签")


class AdapterStats(BaseModel):
    """适配器统计信息"""

    total_downloads: int = Field(..., ge=0, description="总下载数")
    downloads_today: int = Field(..., ge=0, description="今日下载数")
    downloads_this_week: int = Field(..., ge=0, description="本周下载数")
    downloads_this_month: int = Field(..., ge=0, description="本月下载数")
    rating_distribution: Dict[str, int] = Field(
        default_factory=dict, description="评分分布"
    )
    version_distribution: Dict[str, int] = Field(
        default_factory=dict, description="版本分布"
    )
    platform_distribution: Dict[str, int] = Field(
        default_factory=dict, description="平台分布"
    )


# ======================== 辅助函数 ========================


def create_community_slug(name: str) -> str:
    """创建社区标识符"""
    import re

    slug = re.sub(r"[^\w\s-]", "", name.lower())
    slug = re.sub(r"[-\s]+", "-", slug)
    return slug.strip("-")


def validate_community_permissions(
    user_role: MemberRole, required_role: MemberRole
) -> bool:
    """验证社区权限"""
    role_hierarchy = {
        MemberRole.GUEST: 0,
        MemberRole.MEMBER: 1,
        MemberRole.VIP_MEMBER: 2,
        MemberRole.MODERATOR: 3,
        MemberRole.ADMIN: 4,
        MemberRole.OWNER: 5,
    }
    return role_hierarchy.get(user_role, 0) >= role_hierarchy.get(required_role, 0)


def calculate_trending_score(post: Post, time_weight: float = 0.8) -> float:
    """计算帖子热度分数"""
    from datetime import datetime, timedelta

    # 时间衰减因子
    hours_old = (datetime.now() - post.created_at).total_seconds() / 3600
    time_decay = (1 / (1 + hours_old)) ** time_weight

    # 互动分数
    interaction_score = (
        post.like_count * 1.0
        + post.comment_count * 2.0
        + post.view_count * 0.1
        + post.share_count * 3.0
    )

    return interaction_score * time_decay


# 为递归模型添加前向引用
CommentDetailResponse.model_rebuild()

# ======================== 导出列表 ========================

__all__ = [
    # 枚举
    "CommunityType",
    "CommunityStatus",
    "MemberRole",
    "PostType",
    "PostStatus",
    "CommentStatus",
    "ReactionType",
    "ReportReason",
    "AdapterCategory",
    "AdapterStatus",
    "NotificationType",
    # 基础模型
    "CommunityBase",
    "PostBase",
    "CommentBase",
    "AdapterBase",
    # 完整模型
    "Community",
    "Post",
    "Comment",
    "CommunityMember",
    "Reaction",
    "Follow",
    "Report",
    "Adapter",
    "AdapterReview",
    "Notification",
    # 请求模型
    "CommunityCreateRequest",
    "CommunityUpdateRequest",
    "PostCreateRequest",
    "PostUpdateRequest",
    "CommentCreateRequest",
    "CommentUpdateRequest",
    "CommunityJoinRequest",
    "CommunityInviteRequest",
    "ReactionCreateRequest",
    "FollowCreateRequest",
    "ReportCreateRequest",
    "AdapterCreateRequest",
    "AdapterUpdateRequest",
    "AdapterReviewCreateRequest",
    # 响应模型
    "CommunityListItem",
    "PostListItem",
    "CommentListItem",
    "AdapterListItem",
    "CommunityDetailResponse",
    "PostDetailResponse",
    "CommentDetailResponse",
    "AdapterDetailResponse",
    "PaginatedResponse",
    "SearchFilters",
    # 统计模型
    "CommunityStats",
    "AdapterStats",
    # 辅助函数
    "create_community_slug",
    "validate_community_permissions",
    "calculate_trending_score",
]
