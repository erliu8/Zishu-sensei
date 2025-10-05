#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
社区数据模型 - SQLAlchemy ORM模型
提供完整的社区数据库层模型，与Pydantic schemas配合使用
包含社区管理、内容发布、互动系统、适配器市场等功能
"""

import uuid
import re
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union
from decimal import Decimal
from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Integer, Float, 
    ForeignKey, Index, UniqueConstraint, CheckConstraint,
    JSON, Enum as SQLEnum, Table, Numeric
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, backref, validates, Session
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql import func
import hashlib

# 从schemas导入枚举和模型
from ..schemas.community import (
    CommunityType, CommunityStatus, MemberRole, PostType, PostStatus,
    CommentStatus, ReactionType, ReportReason, AdapterCategory, 
    AdapterStatus, NotificationType,
    # 导入Pydantic模型用于转换
    Community as CommunitySchema,
    Post as PostSchema,
    Comment as CommentSchema,
    CommunityMember as CommunityMemberSchema,
    Reaction as ReactionSchema,
    Follow as FollowSchema,
    Report as ReportSchema,
    Adapter as AdapterSchema,
    AdapterReview as AdapterReviewSchema,
    Notification as NotificationSchema
)

# 创建基础类
Base = declarative_base()

# ======================== 关联表定义 ========================

# 社区标签关联表
community_tags_association = Table(
    'community_tags',
    Base.metadata,
    Column('community_id', UUID(as_uuid=True), ForeignKey('communities.id'), primary_key=True),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id'), primary_key=True),
    Column('created_at', DateTime(timezone=True), default=func.now()),
    schema='zishu'
)

# 帖子标签关联表
post_tags_association = Table(
    'post_tags',
    Base.metadata,
    Column('post_id', UUID(as_uuid=True), ForeignKey('posts.id'), primary_key=True),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id'), primary_key=True),
    Column('created_at', DateTime(timezone=True), default=func.now()),
    schema='zishu'
)

# 适配器标签关联表
adapter_tags_association = Table(
    'adapter_tags',
    Base.metadata,
    Column('adapter_id', UUID(as_uuid=True), ForeignKey('adapters.id'), primary_key=True),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id'), primary_key=True),
    Column('created_at', DateTime(timezone=True), default=func.now()),
    schema='zishu'
)

# ======================== 主要模型类 ========================

class Community(Base):
    """社区主表"""
    __tablename__ = 'communities'
    __table_args__ = (
        Index('idx_communities_slug', 'slug'),
        Index('idx_communities_owner_id', 'owner_id'),
        Index('idx_communities_status', 'status'),
        Index('idx_communities_type', 'community_type'),
        Index('idx_communities_created_at', 'created_at'),
        Index('idx_communities_member_count', 'member_count'),
        Index('idx_communities_featured', 'is_featured'),
        UniqueConstraint('slug', name='uq_communities_slug'),
        CheckConstraint('char_length(name) >= 2', name='ck_community_name_length'),
        CheckConstraint('char_length(slug) >= 2', name='ck_community_slug_length'),
        CheckConstraint('member_count >= 0', name='ck_community_member_count'),
        CheckConstraint('post_count >= 0', name='ck_community_post_count'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    slug = Column(String(100), nullable=False, unique=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # 媒体资源
    avatar_url = Column(String(500), nullable=True)
    banner_url = Column(String(500), nullable=True)
    
    # 社区属性
    community_type = Column(SQLEnum(CommunityType), nullable=False, default=CommunityType.PUBLIC)
    status = Column(SQLEnum(CommunityStatus), nullable=False, default=CommunityStatus.ACTIVE)
    rules = Column(Text, nullable=True)
    settings = Column(JSONB, nullable=False, default=dict)
    
    # 统计信息
    member_count = Column(Integer, nullable=False, default=0)
    post_count = Column(Integer, nullable=False, default=0)
    
    # 状态标记
    is_verified = Column(Boolean, nullable=False, default=False)
    is_featured = Column(Boolean, nullable=False, default=False)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    
    # 软删除
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    owner = relationship("User", foreign_keys=[owner_id])
    members = relationship("CommunityMember", back_populates="community", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="community", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=community_tags_association, back_populates="communities")
    adapters = relationship("Adapter", back_populates="community")

    # 验证器
    @validates('name')
    def validate_name(self, key, name):
        """验证社区名称"""
        if not name or len(name.strip()) < 2:
            raise ValueError("社区名称至少需要2个字符")
        if not re.match(r"^[a-zA-Z0-9\u4e00-\u9fff_\-\s]+$", name):
            raise ValueError("社区名称只能包含字母、数字、中文、下划线和连字符")
        return name.strip()

    @validates('slug')
    def validate_slug(self, key, slug):
        """验证社区标识符"""
        if not slug or len(slug.strip()) < 2:
            raise ValueError("社区标识符至少需要2个字符")
        if not re.match(r"^[a-z0-9\-]+$", slug):
            raise ValueError("社区标识符只能包含小写字母、数字和连字符")
        return slug.strip().lower()

    # 混合属性
    @hybrid_property
    def is_active(self):
        """社区是否活跃"""
        return self.status == CommunityStatus.ACTIVE and not self.is_deleted

    # 业务方法
    def add_member(self, user_id: uuid.UUID, role: MemberRole = MemberRole.MEMBER):
        """添加成员"""
        # 检查是否已是成员
        existing = next((m for m in self.members if m.user_id == user_id), None)
        if existing:
            return existing
        
        member = CommunityMember(
            community_id=self.id,
            user_id=user_id,
            role=role
        )
        self.members.append(member)
        self.member_count += 1
        return member

    def remove_member(self, user_id: uuid.UUID):
        """移除成员"""
        member = next((m for m in self.members if m.user_id == user_id), None)
        if member:
            self.members.remove(member)
            self.member_count = max(0, self.member_count - 1)
            return True
        return False

    def get_member_role(self, user_id: uuid.UUID) -> Optional[MemberRole]:
        """获取用户在社区中的角色"""
        if self.owner_id == user_id:
            return MemberRole.OWNER
        
        member = next((m for m in self.members if m.user_id == user_id), None)
        return member.role if member else None

    def can_user_post(self, user_id: uuid.UUID) -> bool:
        """检查用户是否可以在社区发帖"""
        if self.community_type == CommunityType.PRIVATE:
            role = self.get_member_role(user_id)
            return role is not None
        return True

    def update_post_count(self):
        """更新帖子数量"""
        self.post_count = len([p for p in self.posts if p.status == PostStatus.PUBLISHED])

    def soft_delete(self):
        """软删除社区"""
        self.is_deleted = True
        self.deleted_at = func.now()
        self.status = CommunityStatus.DELETED

    def restore(self):
        """恢复已删除社区"""
        self.is_deleted = False
        self.deleted_at = None
        self.status = CommunityStatus.ACTIVE

    def to_schema(self) -> CommunitySchema:
        """转换为Pydantic Schema"""
        return CommunitySchema(
            id=str(self.id),
            name=self.name,
            description=self.description,
            slug=self.slug,
            owner_id=str(self.owner_id),
            avatar_url=self.avatar_url,
            banner_url=self.banner_url,
            community_type=self.community_type,
            status=self.status,
            rules=self.rules,
            tags=[tag.name for tag in self.tags],
            settings=self.settings,
            member_count=self.member_count,
            post_count=self.post_count,
            is_verified=self.is_verified,
            is_featured=self.is_featured,
            created_at=self.created_at,
            updated_at=self.updated_at
        )

    def __repr__(self):
        return f"<Community(id={self.id}, slug='{self.slug}', name='{self.name}')>"


class Post(Base):
    """帖子表"""
    __tablename__ = 'posts'
    __table_args__ = (
        Index('idx_posts_community_id', 'community_id'),
        Index('idx_posts_author_id', 'author_id'),
        Index('idx_posts_status', 'status'),
        Index('idx_posts_type', 'post_type'),
        Index('idx_posts_created_at', 'created_at'),
        Index('idx_posts_last_activity', 'last_activity_at'),
        Index('idx_posts_pinned', 'is_pinned'),
        Index('idx_posts_featured', 'is_featured'),
        CheckConstraint('char_length(title) >= 1', name='ck_post_title_length'),
        CheckConstraint('view_count >= 0', name='ck_post_view_count'),
        CheckConstraint('like_count >= 0', name='ck_post_like_count'),
        CheckConstraint('comment_count >= 0', name='ck_post_comment_count'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    community_id = Column(UUID(as_uuid=True), ForeignKey('communities.id'), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # 内容信息
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    post_type = Column(SQLEnum(PostType), nullable=False, default=PostType.DISCUSSION)
    status = Column(SQLEnum(PostStatus), nullable=False, default=PostStatus.PUBLISHED)
    
    # 附件和元数据
    attachments = Column(JSONB, nullable=False, default=list)
    metadata = Column(JSONB, nullable=False, default=dict)
    
    # 统计信息
    view_count = Column(Integer, nullable=False, default=0)
    like_count = Column(Integer, nullable=False, default=0)
    comment_count = Column(Integer, nullable=False, default=0)
    share_count = Column(Integer, nullable=False, default=0)
    
    # 状态标记
    is_pinned = Column(Boolean, nullable=False, default=False)
    is_locked = Column(Boolean, nullable=False, default=False)
    is_featured = Column(Boolean, nullable=False, default=False)
    
    # 时间信息
    last_activity_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    
    # 软删除
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    community = relationship("Community", back_populates="posts")
    author = relationship("User", foreign_keys=[author_id])
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    reactions = relationship("Reaction", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=post_tags_association, back_populates="posts")
    reports = relationship("Report", cascade="all, delete-orphan")

    # 验证器
    @validates('title')
    def validate_title(self, key, title):
        """验证帖子标题"""
        if not title or len(title.strip()) == 0:
            raise ValueError("帖子标题不能为空")
        if len(title) > 200:
            raise ValueError("帖子标题不能超过200个字符")
        return title.strip()

    @validates('content')
    def validate_content(self, key, content):
        """验证帖子内容"""
        if not content or len(content.strip()) == 0:
            raise ValueError("帖子内容不能为空")
        if len(content) > 50000:
            raise ValueError("帖子内容不能超过50000个字符")
        return content.strip()

    # 业务方法
    def increment_view(self):
        """增加浏览次数"""
        self.view_count += 1
        self.last_activity_at = func.now()

    def add_reaction(self, user_id: uuid.UUID, reaction_type: ReactionType):
        """添加反应"""
        # 检查是否已有反应
        existing = next((r for r in self.reactions 
                        if r.user_id == user_id and r.target_type == "post"), None)
        if existing:
            if existing.reaction_type != reaction_type:
                existing.reaction_type = reaction_type
            return existing
        
        reaction = Reaction(
            user_id=user_id,
            target_type="post",
            target_id=self.id,
            reaction_type=reaction_type
        )
        self.reactions.append(reaction)
        if reaction_type == ReactionType.LIKE:
            self.like_count += 1
        return reaction

    def remove_reaction(self, user_id: uuid.UUID):
        """移除反应"""
        reaction = next((r for r in self.reactions 
                        if r.user_id == user_id and r.target_type == "post"), None)
        if reaction:
            if reaction.reaction_type == ReactionType.LIKE:
                self.like_count = max(0, self.like_count - 1)
            self.reactions.remove(reaction)
            return True
        return False

    def update_comment_count(self):
        """更新评论数量"""
        self.comment_count = len([c for c in self.comments if c.status == CommentStatus.PUBLISHED])
        self.last_activity_at = func.now()

    def can_user_edit(self, user_id: uuid.UUID, user_role: MemberRole = None) -> bool:
        """检查用户是否可以编辑帖子"""
        # 作者可以编辑
        if self.author_id == user_id:
            return True
        
        # 管理员和版主可以编辑
        if user_role in [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR]:
            return True
            
        return False

    def soft_delete(self):
        """软删除帖子"""
        self.is_deleted = True
        self.deleted_at = func.now()
        self.status = PostStatus.DELETED

    def to_schema(self) -> PostSchema:
        """转换为Pydantic Schema"""
        return PostSchema(
            id=str(self.id),
            community_id=str(self.community_id),
            author_id=str(self.author_id),
            title=self.title,
            content=self.content,
            post_type=self.post_type,
            status=self.status,
            tags=[tag.name for tag in self.tags],
            attachments=self.attachments,
            metadata=self.metadata,
            view_count=self.view_count,
            like_count=self.like_count,
            comment_count=self.comment_count,
            share_count=self.share_count,
            is_pinned=self.is_pinned,
            is_locked=self.is_locked,
            is_featured=self.is_featured,
            last_activity_at=self.last_activity_at,
            created_at=self.created_at,
            updated_at=self.updated_at
        )

    def __repr__(self):
        return f"<Post(id={self.id}, title='{self.title[:30]}...')>"


class Comment(Base):
    """评论表"""
    __tablename__ = 'comments'
    __table_args__ = (
        Index('idx_comments_post_id', 'post_id'),
        Index('idx_comments_author_id', 'author_id'),
        Index('idx_comments_parent_id', 'parent_id'),
        Index('idx_comments_status', 'status'),
        Index('idx_comments_created_at', 'created_at'),
        CheckConstraint('like_count >= 0', name='ck_comment_like_count'),
        CheckConstraint('reply_count >= 0', name='ck_comment_reply_count'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    post_id = Column(UUID(as_uuid=True), ForeignKey('posts.id'), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey('comments.id'), nullable=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # 内容信息
    content = Column(Text, nullable=False)
    status = Column(SQLEnum(CommentStatus), nullable=False, default=CommentStatus.PUBLISHED)
    
    # 附件和元数据
    attachments = Column(JSONB, nullable=False, default=list)
    metadata = Column(JSONB, nullable=False, default=dict)
    
    # 统计信息
    like_count = Column(Integer, nullable=False, default=0)
    reply_count = Column(Integer, nullable=False, default=0)
    
    # 状态标记
    is_pinned = Column(Boolean, nullable=False, default=False)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    
    # 软删除
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    post = relationship("Post", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
    parent = relationship("Comment", remote_side=[id], backref="replies")
    reactions = relationship("Reaction", cascade="all, delete-orphan")
    reports = relationship("Report", cascade="all, delete-orphan")

    # 验证器
    @validates('content')
    def validate_content(self, key, content):
        """验证评论内容"""
        if not content or len(content.strip()) == 0:
            raise ValueError("评论内容不能为空")
        if len(content) > 10000:
            raise ValueError("评论内容不能超过10000个字符")
        return content.strip()

    # 业务方法
    def add_reaction(self, user_id: uuid.UUID, reaction_type: ReactionType):
        """添加反应"""
        existing = next((r for r in self.reactions 
                        if r.user_id == user_id and r.target_type == "comment"), None)
        if existing:
            if existing.reaction_type != reaction_type:
                existing.reaction_type = reaction_type
            return existing
        
        reaction = Reaction(
            user_id=user_id,
            target_type="comment",
            target_id=self.id,
            reaction_type=reaction_type
        )
        self.reactions.append(reaction)
        if reaction_type == ReactionType.LIKE:
            self.like_count += 1
        return reaction

    def update_reply_count(self):
        """更新回复数量"""
        self.reply_count = len([r for r in self.replies if r.status == CommentStatus.PUBLISHED])

    def soft_delete(self):
        """软删除评论"""
        self.is_deleted = True
        self.deleted_at = func.now()
        self.status = CommentStatus.DELETED

    def to_schema(self) -> CommentSchema:
        """转换为Pydantic Schema"""
        return CommentSchema(
            id=str(self.id),
            post_id=str(self.post_id),
            parent_id=str(self.parent_id) if self.parent_id else None,
            author_id=str(self.author_id),
            content=self.content,
            status=self.status,
            attachments=self.attachments,
            metadata=self.metadata,
            like_count=self.like_count,
            reply_count=self.reply_count,
            is_pinned=self.is_pinned,
            created_at=self.created_at,
            updated_at=self.updated_at
        )

    def __repr__(self):
        return f"<Comment(id={self.id}, post_id={self.post_id})>"


class CommunityMember(Base):
    """社区成员关系表"""
    __tablename__ = 'community_members'
    __table_args__ = (
        Index('idx_community_members_community_id', 'community_id'),
        Index('idx_community_members_user_id', 'user_id'),
        Index('idx_community_members_role', 'role'),
        Index('idx_community_members_joined_at', 'joined_at'),
        UniqueConstraint('community_id', 'user_id', name='uq_community_members'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    community_id = Column(UUID(as_uuid=True), ForeignKey('communities.id'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # 成员信息
    role = Column(SQLEnum(MemberRole), nullable=False, default=MemberRole.MEMBER)
    join_reason = Column(String(200), nullable=True)
    custom_title = Column(String(50), nullable=True)
    permissions = Column(JSONB, nullable=False, default=list)
    
    # 时间信息
    joined_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    last_activity_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    community = relationship("Community", back_populates="members")
    user = relationship("User")

    # 业务方法
    def update_activity(self):
        """更新最后活动时间"""
        self.last_activity_at = func.now()

    def has_permission(self, permission: str) -> bool:
        """检查是否有特定权限"""
        return permission in self.permissions

    def add_permission(self, permission: str):
        """添加权限"""
        if permission not in self.permissions:
            self.permissions = self.permissions + [permission]

    def remove_permission(self, permission: str):
        """移除权限"""
        if permission in self.permissions:
            perms = self.permissions.copy()
            perms.remove(permission)
            self.permissions = perms

    def to_schema(self) -> CommunityMemberSchema:
        """转换为Pydantic Schema"""
        return CommunityMemberSchema(
            id=str(self.id),
            community_id=str(self.community_id),
            user_id=str(self.user_id),
            role=self.role,
            join_reason=self.join_reason,
            custom_title=self.custom_title,
            permissions=self.permissions,
            joined_at=self.joined_at,
            last_activity_at=self.last_activity_at
        )

    def __repr__(self):
        return f"<CommunityMember(community_id={self.community_id}, user_id={self.user_id}, role={self.role})>"


class Reaction(Base):
    """反应表"""
    __tablename__ = 'reactions'
    __table_args__ = (
        Index('idx_reactions_user_id', 'user_id'),
        Index('idx_reactions_target', 'target_type', 'target_id'),
        Index('idx_reactions_type', 'reaction_type'),
        Index('idx_reactions_created_at', 'created_at'),
        UniqueConstraint('user_id', 'target_type', 'target_id', name='uq_reactions'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    target_type = Column(String(20), nullable=False)  # post, comment
    target_id = Column(UUID(as_uuid=True), nullable=False)
    reaction_type = Column(SQLEnum(ReactionType), nullable=False)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    # 关系
    user = relationship("User")

    def to_schema(self) -> ReactionSchema:
        """转换为Pydantic Schema"""
        return ReactionSchema(
            id=str(self.id),
            user_id=str(self.user_id),
            target_type=self.target_type,
            target_id=str(self.target_id),
            reaction_type=self.reaction_type,
            created_at=self.created_at
        )

    def __repr__(self):
        return f"<Reaction(user_id={self.user_id}, target={self.target_type}:{self.target_id}, type={self.reaction_type})>"


class Follow(Base):
    """关注关系表"""
    __tablename__ = 'follows'
    __table_args__ = (
        Index('idx_follows_follower_id', 'follower_id'),
        Index('idx_follows_target', 'target_type', 'target_id'),
        Index('idx_follows_created_at', 'created_at'),
        UniqueConstraint('follower_id', 'target_type', 'target_id', name='uq_follows'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    follower_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    target_type = Column(String(20), nullable=False)  # user, community, adapter
    target_id = Column(UUID(as_uuid=True), nullable=False)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    # 关系
    follower = relationship("User")

    def to_schema(self) -> FollowSchema:
        """转换为Pydantic Schema"""
        return FollowSchema(
            id=str(self.id),
            follower_id=str(self.follower_id),
            target_type=self.target_type,
            target_id=str(self.target_id),
            created_at=self.created_at
        )

    def __repr__(self):
        return f"<Follow(follower_id={self.follower_id}, target={self.target_type}:{self.target_id})>"


class Report(Base):
    """举报表"""
    __tablename__ = 'reports'
    __table_args__ = (
        Index('idx_reports_reporter_id', 'reporter_id'),
        Index('idx_reports_target', 'target_type', 'target_id'),
        Index('idx_reports_reason', 'reason'),
        Index('idx_reports_status', 'status'),
        Index('idx_reports_created_at', 'created_at'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    target_type = Column(String(20), nullable=False)  # post, comment, user, community
    target_id = Column(UUID(as_uuid=True), nullable=False)
    reason = Column(SQLEnum(ReportReason), nullable=False)
    description = Column(String(1000), nullable=True)
    status = Column(String(20), nullable=False, default='pending')  # pending, resolved, rejected
    
    # 处理信息
    resolved_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    # 关系
    reporter = relationship("User", foreign_keys=[reporter_id])
    resolver = relationship("User", foreign_keys=[resolved_by])

    def resolve(self, resolved_by_id: uuid.UUID, status: str = 'resolved'):
        """处理举报"""
        self.status = status
        self.resolved_by = resolved_by_id
        self.resolved_at = func.now()

    def to_schema(self) -> ReportSchema:
        """转换为Pydantic Schema"""
        return ReportSchema(
            id=str(self.id),
            reporter_id=str(self.reporter_id),
            target_type=self.target_type,
            target_id=str(self.target_id),
            reason=self.reason,
            description=self.description,
            status=self.status,
            resolved_by=str(self.resolved_by) if self.resolved_by else None,
            resolved_at=self.resolved_at,
            created_at=self.created_at
        )

    def __repr__(self):
        return f"<Report(target={self.target_type}:{self.target_id}, reason={self.reason}, status={self.status})>"


class Adapter(Base):
    """适配器表"""
    __tablename__ = 'adapters'
    __table_args__ = (
        Index('idx_adapters_slug', 'slug'),
        Index('idx_adapters_author_id', 'author_id'),
        Index('idx_adapters_community_id', 'community_id'),
        Index('idx_adapters_status', 'status'),
        Index('idx_adapters_category', 'category'),
        Index('idx_adapters_featured', 'is_featured'),
        Index('idx_adapters_verified', 'is_verified'),
        Index('idx_adapters_created_at', 'created_at'),
        UniqueConstraint('slug', name='uq_adapters_slug'),
        CheckConstraint('download_count >= 0', name='ck_adapter_download_count'),
        CheckConstraint('rating >= 0 AND rating <= 5', name='ck_adapter_rating'),
        CheckConstraint('rating_count >= 0', name='ck_adapter_rating_count'),
        CheckConstraint('like_count >= 0', name='ck_adapter_like_count'),
        CheckConstraint('file_size >= 0', name='ck_adapter_file_size'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(String(1000), nullable=False)
    slug = Column(String(100), nullable=False, unique=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    community_id = Column(UUID(as_uuid=True), ForeignKey('communities.id'), nullable=True)
    
    # 技术信息
    version = Column(String(50), nullable=False)
    category = Column(SQLEnum(AdapterCategory), nullable=False)
    status = Column(SQLEnum(AdapterStatus), nullable=False, default=AdapterStatus.DRAFT)
    
    # 媒体资源
    icon_url = Column(String(500), nullable=True)
    screenshots = Column(JSONB, nullable=False, default=list)
    download_url = Column(String(500), nullable=True)
    github_url = Column(String(500), nullable=True)
    documentation_url = Column(String(500), nullable=True)
    
    # 技术规格
    requirements = Column(JSONB, nullable=False, default=list)
    compatibility = Column(JSONB, nullable=False, default=dict)
    pricing = Column(JSONB, nullable=False, default=dict)
    file_size = Column(Integer, nullable=False, default=0)
    
    # 统计信息
    download_count = Column(Integer, nullable=False, default=0)
    rating = Column(Float, nullable=False, default=0.0)
    rating_count = Column(Integer, nullable=False, default=0)
    like_count = Column(Integer, nullable=False, default=0)
    
    # 状态标记
    is_featured = Column(Boolean, nullable=False, default=False)
    is_verified = Column(Boolean, nullable=False, default=False)
    
    # 时间信息
    last_updated = Column(DateTime(timezone=True), nullable=False, default=func.now())
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    
    # 软删除
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # 关系
    author = relationship("User", foreign_keys=[author_id])
    community = relationship("Community", back_populates="adapters")
    reviews = relationship("AdapterReview", back_populates="adapter", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=adapter_tags_association, back_populates="adapters")
    follows = relationship("Follow", cascade="all, delete-orphan")

    # 验证器
    @validates('name')
    def validate_name(self, key, name):
        """验证适配器名称"""
        if not re.match(r"^[a-z][a-z0-9\-_]*$", name):
            raise ValueError("适配器名称必须以小写字母开头，只能包含小写字母、数字、连字符和下划线")
        return name

    @validates('slug')
    def validate_slug(self, key, slug):
        """验证适配器标识符"""
        if not re.match(r"^[a-z0-9\-]+$", slug):
            raise ValueError("适配器标识符只能包含小写字母、数字和连字符")
        return slug.lower()

    @validates('version')
    def validate_version(self, key, version):
        """验证版本号格式"""
        if not re.match(r"^\d+\.\d+\.\d+(?:-[a-zA-Z0-9\-]+)?$", version):
            raise ValueError("版本号格式不正确，应为 x.y.z 或 x.y.z-suffix")
        return version

    # 业务方法
    def increment_download(self):
        """增加下载次数"""
        self.download_count += 1

    def add_review(self, user_id: uuid.UUID, rating: int, title: str = None, content: str = None):
        """添加评价"""
        review = AdapterReview(
            adapter_id=self.id,
            user_id=user_id,
            rating=rating,
            title=title,
            content=content
        )
        self.reviews.append(review)
        self.update_rating()
        return review

    def update_rating(self):
        """更新平均评分"""
        if self.reviews:
            total_rating = sum(r.rating for r in self.reviews)
            self.rating = round(total_rating / len(self.reviews), 2)
            self.rating_count = len(self.reviews)
        else:
            self.rating = 0.0
            self.rating_count = 0

    def soft_delete(self):
        """软删除适配器"""
        self.is_deleted = True
        self.deleted_at = func.now()
        self.status = AdapterStatus.REMOVED

    def to_schema(self) -> AdapterSchema:
        """转换为Pydantic Schema"""
        return AdapterSchema(
            id=str(self.id),
            name=self.name,
            display_name=self.display_name,
            description=self.description,
            slug=self.slug,
            author_id=str(self.author_id),
            community_id=str(self.community_id) if self.community_id else None,
            version=self.version,
            category=self.category,
            status=self.status,
            tags=[tag.name for tag in self.tags],
            icon_url=self.icon_url,
            screenshots=self.screenshots,
            download_url=self.download_url,
            github_url=self.github_url,
            documentation_url=self.documentation_url,
            requirements=self.requirements,
            compatibility=self.compatibility,
            pricing=self.pricing,
            download_count=self.download_count,
            rating=self.rating,
            rating_count=self.rating_count,
            like_count=self.like_count,
            file_size=self.file_size,
            is_featured=self.is_featured,
            is_verified=self.is_verified,
            last_updated=self.last_updated,
            created_at=self.created_at
        )

    def __repr__(self):
        return f"<Adapter(id={self.id}, slug='{self.slug}', name='{self.name}')>"


class AdapterReview(Base):
    """适配器评价表"""
    __tablename__ = 'adapter_reviews'
    __table_args__ = (
        Index('idx_adapter_reviews_adapter_id', 'adapter_id'),
        Index('idx_adapter_reviews_user_id', 'user_id'),
        Index('idx_adapter_reviews_rating', 'rating'),
        Index('idx_adapter_reviews_created_at', 'created_at'),
        UniqueConstraint('adapter_id', 'user_id', name='uq_adapter_reviews'),
        CheckConstraint('rating >= 1 AND rating <= 5', name='ck_adapter_review_rating'),
        CheckConstraint('helpful_count >= 0', name='ck_adapter_review_helpful_count'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    adapter_id = Column(UUID(as_uuid=True), ForeignKey('adapters.id'), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # 评价内容
    rating = Column(Integer, nullable=False)
    title = Column(String(100), nullable=True)
    content = Column(String(2000), nullable=True)
    pros = Column(JSONB, nullable=False, default=list)
    cons = Column(JSONB, nullable=False, default=list)
    
    # 状态信息
    is_verified_purchase = Column(Boolean, nullable=False, default=False)
    helpful_count = Column(Integer, nullable=False, default=0)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # 关系
    adapter = relationship("Adapter", back_populates="reviews")
    user = relationship("User")

    def to_schema(self) -> AdapterReviewSchema:
        """转换为Pydantic Schema"""
        return AdapterReviewSchema(
            id=str(self.id),
            adapter_id=str(self.adapter_id),
            user_id=str(self.user_id),
            rating=self.rating,
            title=self.title,
            content=self.content,
            pros=self.pros,
            cons=self.cons,
            is_verified_purchase=self.is_verified_purchase,
            helpful_count=self.helpful_count,
            created_at=self.created_at,
            updated_at=self.updated_at
        )

    def __repr__(self):
        return f"<AdapterReview(adapter_id={self.adapter_id}, user_id={self.user_id}, rating={self.rating})>"


class Notification(Base):
    """通知表"""
    __tablename__ = 'notifications'
    __table_args__ = (
        Index('idx_notifications_user_id', 'user_id'),
        Index('idx_notifications_type', 'type'),
        Index('idx_notifications_read', 'is_read'),
        Index('idx_notifications_created_at', 'created_at'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    type = Column(SQLEnum(NotificationType), nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(String(500), nullable=False)
    data = Column(JSONB, nullable=False, default=dict)
    
    # 状态信息
    is_read = Column(Boolean, nullable=False, default=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    # 关系
    user = relationship("User")

    def mark_read(self):
        """标记为已读"""
        self.is_read = True
        self.read_at = func.now()

    def to_schema(self) -> NotificationSchema:
        """转换为Pydantic Schema"""
        return NotificationSchema(
            id=str(self.id),
            user_id=str(self.user_id),
            type=self.type,
            title=self.title,
            content=self.content,
            data=self.data,
            is_read=self.is_read,
            read_at=self.read_at,
            created_at=self.created_at
        )

    def __repr__(self):
        return f"<Notification(user_id={self.user_id}, type={self.type}, read={self.is_read})>"


# ======================== 辅助模型 ========================

class Tag(Base):
    """标签表"""
    __tablename__ = 'tags'
    __table_args__ = (
        Index('idx_tags_name', 'name'),
        Index('idx_tags_category', 'category'),
        Index('idx_tags_usage_count', 'usage_count'),
        UniqueConstraint('name', name='uq_tags_name'),
        {'schema': 'zishu'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False, unique=True)
    category = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    color = Column(String(7), nullable=True)  # HEX颜色值
    is_system = Column(Boolean, nullable=False, default=False)
    usage_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    # 关系
    communities = relationship("Community", secondary=community_tags_association, back_populates="tags")
    posts = relationship("Post", secondary=post_tags_association, back_populates="tags")
    adapters = relationship("Adapter", secondary=adapter_tags_association, back_populates="tags")

    def increment_usage(self):
        """增加使用次数"""
        self.usage_count += 1

    def decrement_usage(self):
        """减少使用次数"""
        self.usage_count = max(0, self.usage_count - 1)

    def __repr__(self):
        return f"<Tag(name='{self.name}', category='{self.category}')>"


# ======================== 工具函数 ========================

def create_community_with_owner(
    session: Session,
    name: str,
    slug: str,
    owner_id: uuid.UUID,
    **kwargs
) -> Community:
    """创建社区并设置所有者"""
    community = Community(
        name=name,
        slug=slug,
        owner_id=owner_id,
        **kwargs
    )
    
    session.add(community)
    session.flush()  # 获取ID
    
    # 添加所有者为成员
    member = CommunityMember(
        community_id=community.id,
        user_id=owner_id,
        role=MemberRole.OWNER
    )
    session.add(member)
    community.member_count = 1
    
    return community


def get_user_communities(session: Session, user_id: uuid.UUID) -> List[Community]:
    """获取用户参与的所有社区"""
    return session.query(Community).join(CommunityMember).filter(
        CommunityMember.user_id == user_id,
        Community.is_deleted == False
    ).all()


def get_trending_posts(session: Session, community_id: uuid.UUID = None, limit: int = 10) -> List[Post]:
    """获取热门帖子"""
    query = session.query(Post).filter(
        Post.status == PostStatus.PUBLISHED,
        Post.is_deleted == False
    )
    
    if community_id:
        query = query.filter(Post.community_id == community_id)
    
    # 简单的热度算法：按点赞数和评论数排序
    return query.order_by(
        (Post.like_count + Post.comment_count * 2).desc(),
        Post.created_at.desc()
    ).limit(limit).all()


def get_popular_adapters(session: Session, category: AdapterCategory = None, limit: int = 10) -> List[Adapter]:
    """获取热门适配器"""
    query = session.query(Adapter).filter(
        Adapter.status == AdapterStatus.PUBLISHED,
        Adapter.is_deleted == False
    )
    
    if category:
        query = query.filter(Adapter.category == category)
    
    return query.order_by(
        Adapter.download_count.desc(),
        Adapter.rating.desc()
    ).limit(limit).all()


def search_communities(session: Session, query: str, limit: int = 20) -> List[Community]:
    """搜索社区"""
    return session.query(Community).filter(
        Community.is_deleted == False,
        Community.status == CommunityStatus.ACTIVE,
        Community.name.ilike(f'%{query}%') | 
        Community.description.ilike(f'%{query}%')
    ).order_by(
        Community.member_count.desc(),
        Community.is_featured.desc()
    ).limit(limit).all()


def cleanup_soft_deleted_data(session: Session, days_old: int = 30) -> Dict[str, int]:
    """清理软删除的数据"""
    cutoff_date = datetime.utcnow() - timedelta(days=days_old)
    
    results = {}
    
    # 清理社区
    results['communities'] = session.query(Community).filter(
        Community.is_deleted == True,
        Community.deleted_at < cutoff_date
    ).delete()
    
    # 清理帖子
    results['posts'] = session.query(Post).filter(
        Post.is_deleted == True,
        Post.deleted_at < cutoff_date
    ).delete()
    
    # 清理评论
    results['comments'] = session.query(Comment).filter(
        Comment.is_deleted == True,
        Comment.deleted_at < cutoff_date
    ).delete()
    
    # 清理适配器
    results['adapters'] = session.query(Adapter).filter(
        Adapter.is_deleted == True,
        Adapter.deleted_at < cutoff_date
    ).delete()
    
    return results


def create_default_tags(session: Session):
    """创建默认标签"""
    default_tags = [
        # 社区类型标签
        {"name": "官方", "category": "community_type", "color": "#007bff", "is_system": True},
        {"name": "开发", "category": "community_type", "color": "#28a745", "is_system": True},
        {"name": "讨论", "category": "community_type", "color": "#6f42c1", "is_system": True},
        {"name": "支持", "category": "community_type", "color": "#fd7e14", "is_system": True},
        
        # 帖子类型标签
        {"name": "问题", "category": "post_type", "color": "#dc3545", "is_system": True},
        {"name": "教程", "category": "post_type", "color": "#20c997", "is_system": True},
        {"name": "展示", "category": "post_type", "color": "#e83e8c", "is_system": True},
        {"name": "公告", "category": "post_type", "color": "#ffc107", "is_system": True},
        
        # 适配器分类标签
        {"name": "对话", "category": "adapter_category", "color": "#17a2b8", "is_system": True},
        {"name": "工具", "category": "adapter_category", "color": "#6c757d", "is_system": True},
        {"name": "娱乐", "category": "adapter_category", "color": "#fd7e14", "is_system": True},
        {"name": "教育", "category": "adapter_category", "color": "#20c997", "is_system": True},
    ]
    
    for tag_data in default_tags:
        existing = session.query(Tag).filter_by(name=tag_data["name"]).first()
        if not existing:
            tag = Tag(**tag_data)
            session.add(tag)
    
    session.commit()


# ======================== 统计和分析函数 ========================

def get_community_stats(session: Session, community_id: uuid.UUID) -> Dict[str, Any]:
    """获取社区统计信息"""
    community = session.query(Community).filter_by(id=community_id).first()
    if not community:
        return {}
    
    # 基础统计
    stats = {
        "total_members": community.member_count,
        "total_posts": community.post_count,
        "total_comments": session.query(Comment).join(Post).filter(
            Post.community_id == community_id,
            Comment.status == CommentStatus.PUBLISHED
        ).count()
    }
    
    # 时间段统计
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    stats.update({
        "posts_today": session.query(Post).filter(
            Post.community_id == community_id,
            Post.created_at >= today,
            Post.status == PostStatus.PUBLISHED
        ).count(),
        
        "posts_this_week": session.query(Post).filter(
            Post.community_id == community_id,
            Post.created_at >= week_ago,
            Post.status == PostStatus.PUBLISHED
        ).count(),
        
        "posts_this_month": session.query(Post).filter(
            Post.community_id == community_id,
            Post.created_at >= month_ago,
            Post.status == PostStatus.PUBLISHED
        ).count()
    })
    
    return stats


def get_adapter_stats(session: Session, adapter_id: uuid.UUID) -> Dict[str, Any]:
    """获取适配器统计信息"""
    adapter = session.query(Adapter).filter_by(id=adapter_id).first()
    if not adapter:
        return {}
    
    # 评分分布
    rating_distribution = {}
    for i in range(1, 6):
        count = session.query(AdapterReview).filter(
            AdapterReview.adapter_id == adapter_id,
            AdapterReview.rating == i
        ).count()
        rating_distribution[str(i)] = count
    
    return {
        "total_downloads": adapter.download_count,
        "total_reviews": adapter.rating_count,
        "average_rating": adapter.rating,
        "rating_distribution": rating_distribution,
        "total_likes": adapter.like_count
    }


# ======================== 导出列表 ========================

__all__ = [
    # 主要模型
    "Community", "Post", "Comment", "CommunityMember", "Reaction", "Follow",
    "Report", "Adapter", "AdapterReview", "Notification", "Tag",
    
    # 关联表
    "community_tags_association", "post_tags_association", "adapter_tags_association",
    
    # 工具函数
    "create_community_with_owner", "get_user_communities", "get_trending_posts",
    "get_popular_adapters", "search_communities", "cleanup_soft_deleted_data",
    "create_default_tags", "get_community_stats", "get_adapter_stats"
]
