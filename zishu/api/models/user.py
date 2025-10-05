#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
用户数据模型 - SQLAlchemy ORM模型
提供完整的用户数据库层模型，与Pydantic schemas配合使用
"""

import uuid
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union
from sqlalchemy import (
    Column, String, Boolean, DateTime, Text, Integer, Float, 
    ForeignKey, Index, UniqueConstraint, CheckConstraint,
    JSON, LargeBinary, Enum as SQLEnum, Table
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, backref, validates, Session
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIME
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.sql import func
from werkzeug.security import generate_password_hash, check_password_hash
import re

from .auth import (
    UserStatus, UserRole, AuthProvider, 
    User as UserSchema, UserProfile as UserProfileSchema,
    UserSecurity as UserSecuritySchema
)

# 创建基础类
Base = declarative_base()

# ======================== 关联表定义 ========================

# 用户标签关联表
user_tags_association = Table(
    'user_tags',
    Base.metadata,
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id'), primary_key=True),
    Column('created_at', DateTime(timezone=True), default=func.now()),
    schema='zishu'
)

# 用户组关联表
user_groups_association = Table(
    'user_groups',
    Base.metadata,
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True),
    Column('group_id', UUID(as_uuid=True), ForeignKey('groups.id'), primary_key=True),
    Column('joined_at', DateTime(timezone=True), default=func.now()),
    Column('role', String(50), default='member'),
    schema='zishu'
)

# 用户权限关联表
user_permissions_association = Table(
    'user_permissions',
    Base.metadata,
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True),
    Column('permission_id', UUID(as_uuid=True), ForeignKey('permissions.id'), primary_key=True),
    Column('granted_at', DateTime(timezone=True), default=func.now()),
    Column('granted_by', UUID(as_uuid=True), ForeignKey('users.id')),
    Column('expires_at', DateTime(timezone=True), nullable=True),
    schema='zishu'
)

# ======================== 主要模型类 ========================

class User(Base):
    """用户主表 - 核心用户信息"""
    __tablename__ = 'users'
    __table_args__ = (
        Index('idx_users_username', 'username'),
        Index('idx_users_email', 'email'),
        Index('idx_users_phone', 'phone'),
        Index('idx_users_status', 'status'),
        Index('idx_users_role', 'role'),
        Index('idx_users_created_at', 'created_at'),
        Index('idx_users_last_login', 'last_login_at'),
        CheckConstraint('char_length(username) >= 3', name='ck_username_length'),
        CheckConstraint('char_length(username) <= 30', name='ck_username_max_length'),
        UniqueConstraint('username', name='uq_users_username'),
        UniqueConstraint('email', name='uq_users_email'),
        UniqueConstraint('phone', name='uq_users_phone'),
        {'schema': 'zishu'}
    )

    # 基础字段
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String(30), nullable=False, unique=True)
    email = Column(String(255), nullable=True, unique=True)
    phone = Column(String(20), nullable=True, unique=True)
    
    # 状态和角色
    status = Column(SQLEnum(UserStatus), nullable=False, default=UserStatus.PENDING)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.USER)
    
    # 认证信息
    auth_provider = Column(SQLEnum(AuthProvider), nullable=False, default=AuthProvider.LOCAL)
    provider_id = Column(String(255), nullable=True)  # 第三方提供商用户ID
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_active_at = Column(DateTime(timezone=True), nullable=True)
    
    # 登录统计
    login_count = Column(Integer, nullable=False, default=0)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    last_failed_login = Column(DateTime(timezone=True), nullable=True)
    account_locked_until = Column(DateTime(timezone=True), nullable=True)
    
    # 订阅信息
    subscription_plan = Column(String(50), nullable=True)
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    subscription_auto_renew = Column(Boolean, nullable=False, default=False)
    
    # 使用统计
    total_messages = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    total_sessions = Column(Integer, nullable=False, default=0)
    total_api_calls = Column(Integer, nullable=False, default=0)
    
    # API使用限制跟踪
    api_calls_today = Column(Integer, nullable=False, default=0)
    tokens_used_today = Column(Integer, nullable=False, default=0)
    last_api_reset = Column(DateTime(timezone=True), default=func.now())
    
    # 扩展元数据
    metadata = Column(JSONB, nullable=False, default=dict)
    
    # 软删除标记
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)

    # 关系
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    security = relationship("UserSecurity", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    tokens = relationship("UserToken", back_populates="user", cascade="all, delete-orphan")
    auth_logs = relationship("AuthLog", back_populates="user", cascade="all, delete-orphan")
    
    # 多对多关系
    tags = relationship("Tag", secondary=user_tags_association, back_populates="users")
    groups = relationship("Group", secondary=user_groups_association, back_populates="users")
    permissions = relationship("Permission", secondary=user_permissions_association, back_populates="users")
    
    # 自引用关系（用于管理层级）
    invited_users = relationship("User", backref=backref("invited_by", remote_side=[id]))

    # 验证器
    @validates('username')
    def validate_username(self, key, username):
        """验证用户名格式"""
        if not username:
            raise ValueError("用户名不能为空")
        if not re.match(r'^[a-zA-Z0-9_\u4e00-\u9fff]+$', username):
            raise ValueError("用户名只能包含字母、数字、下划线和中文字符")
        return username.strip()

    @validates('email')
    def validate_email(self, key, email):
        """验证邮箱格式"""
        if email:
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, email):
                raise ValueError("邮箱格式不正确")
            return email.strip().lower()
        return email

    @validates('phone')
    def validate_phone(self, key, phone):
        """验证手机号格式"""
        if phone:
            if not re.match(r'^1[3-9]\d{9}$', phone):
                raise ValueError("手机号格式不正确")
        return phone

    # 混合属性
    @hybrid_property
    def is_active(self):
        """用户是否激活"""
        return self.status == UserStatus.ACTIVE and not self.is_deleted

    @hybrid_property
    def is_locked(self):
        """账户是否被锁定"""
        if self.account_locked_until:
            return datetime.utcnow() < self.account_locked_until
        return False

    @hybrid_property
    def display_name(self):
        """显示名称"""
        if self.profile and self.profile.nickname:
            return self.profile.nickname
        return self.username

    @hybrid_property
    def full_name(self):
        """完整姓名"""
        if self.profile:
            return f"{self.profile.first_name or ''} {self.profile.last_name or ''}".strip()
        return ""

    # 业务方法
    def check_password(self, password: str) -> bool:
        """验证密码"""
        if not self.security:
            return False
        return check_password_hash(self.security.password_hash, password)

    def set_password(self, password: str):
        """设置密码"""
        if not self.security:
            self.security = UserSecurity(user_id=self.id)
        self.security.set_password(password)
        self.security.password_updated_at = func.now()

    def update_last_login(self):
        """更新最后登录时间"""
        self.last_login_at = func.now()
        self.last_active_at = func.now()
        self.login_count += 1
        self.failed_login_attempts = 0

    def increment_failed_login(self):
        """增加失败登录次数"""
        self.failed_login_attempts += 1
        self.last_failed_login = func.now()
        
        # 如果失败次数过多，锁定账户
        if self.failed_login_attempts >= 5:
            self.account_locked_until = datetime.utcnow() + timedelta(minutes=30)

    def unlock_account(self):
        """解锁账户"""
        self.account_locked_until = None
        self.failed_login_attempts = 0

    def soft_delete(self, deleted_by_user_id: Optional[uuid.UUID] = None):
        """软删除用户"""
        self.is_deleted = True
        self.deleted_at = func.now()
        self.deleted_by = deleted_by_user_id
        self.status = UserStatus.DELETED

    def restore(self):
        """恢复已删除用户"""
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.status = UserStatus.ACTIVE

    def update_api_usage(self, tokens_used: int = 0, api_calls: int = 1):
        """更新API使用统计"""
        now = datetime.utcnow()
        
        # 检查是否需要重置每日统计
        if self.last_api_reset and (now.date() > self.last_api_reset.date()):
            self.api_calls_today = 0
            self.tokens_used_today = 0
            self.last_api_reset = now
        
        # 更新统计
        self.total_api_calls += api_calls
        self.total_tokens += tokens_used
        self.api_calls_today += api_calls
        self.tokens_used_today += tokens_used
        self.last_active_at = now

    def has_permission(self, permission_code: str) -> bool:
        """检查用户是否有指定权限"""
        # 超级管理员拥有所有权限
        if self.role == UserRole.SUPER_ADMIN:
            return True
        
        # 检查直接权限
        for permission in self.permissions:
            if permission.code == permission_code or permission.code == "*:*":
                return True
        
        # 检查角色权限
        from .auth import DEFAULT_ROLE_PERMISSIONS
        role_perms = DEFAULT_ROLE_PERMISSIONS.get(self.role)
        if role_perms and permission_code in role_perms.permissions:
            return True
        
        return False

    def get_effective_permissions(self) -> List[str]:
        """获取用户的有效权限列表"""
        permissions = set()
        
        # 超级管理员拥有所有权限
        if self.role == UserRole.SUPER_ADMIN:
            return ["*:*"]
        
        # 添加直接权限
        for permission in self.permissions:
            permissions.add(permission.code)
        
        # 添加角色权限
        from .auth import DEFAULT_ROLE_PERMISSIONS
        role_perms = DEFAULT_ROLE_PERMISSIONS.get(self.role)
        if role_perms:
            permissions.update(role_perms.permissions)
        
        return list(permissions)

    def to_schema(self) -> UserSchema:
        """转换为Pydantic Schema"""
        return UserSchema(
            id=str(self.id),
            username=self.username,
            email=self.email,
            phone=self.phone,
            status=self.status,
            role=self.role,
            auth_provider=self.auth_provider,
            provider_id=self.provider_id,
            created_at=self.created_at,
            updated_at=self.updated_at,
            last_login_at=self.last_login_at,
            last_active_at=self.last_active_at,
            login_count=self.login_count,
            subscription_plan=self.subscription_plan,
            subscription_expires_at=self.subscription_expires_at,
            total_messages=self.total_messages,
            total_tokens=self.total_tokens,
            total_sessions=self.total_sessions,
            tags=[tag.name for tag in self.tags],
            groups=[group.name for group in self.groups],
            metadata=self.metadata,
            profile=self.profile.to_schema() if self.profile else UserProfileSchema(),
            security=self.security.to_schema() if self.security else None
        )

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"


class UserProfile(Base):
    """用户档案表 - 详细个人信息"""
    __tablename__ = 'user_profiles'
    __table_args__ = (
        Index('idx_profiles_user_id', 'user_id'),
        Index('idx_profiles_nickname', 'nickname'),
        Index('idx_profiles_visibility', 'profile_visibility'),
        {'schema': 'zishu'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    
    # 基本信息
    nickname = Column(String(50), nullable=True)
    first_name = Column(String(50), nullable=True)
    last_name = Column(String(50), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    cover_image_url = Column(String(500), nullable=True)
    
    # 个人详情
    gender = Column(String(10), nullable=True)  # male, female, other
    birthday = Column(DateTime(timezone=True), nullable=True)
    location = Column(String(100), nullable=True)
    website = Column(String(500), nullable=True)
    occupation = Column(String(100), nullable=True)
    company = Column(String(100), nullable=True)
    
    # 社交媒体链接
    social_links = Column(JSONB, nullable=False, default=dict)
    
    # 偏好设置
    language = Column(String(10), nullable=False, default='zh-CN')
    timezone = Column(String(50), nullable=False, default='Asia/Shanghai')
    theme = Column(String(20), nullable=False, default='light')
    date_format = Column(String(20), nullable=False, default='YYYY-MM-DD')
    time_format = Column(String(10), nullable=False, default='24h')
    
    # 隐私设置
    profile_visibility = Column(String(20), nullable=False, default='public')  # public, friends, private
    show_email = Column(Boolean, nullable=False, default=False)
    show_phone = Column(Boolean, nullable=False, default=False)
    show_last_seen = Column(Boolean, nullable=False, default=True)
    allow_friend_requests = Column(Boolean, nullable=False, default=True)
    
    # 通知设置
    email_notifications = Column(Boolean, nullable=False, default=True)
    sms_notifications = Column(Boolean, nullable=False, default=False)
    push_notifications = Column(Boolean, nullable=False, default=True)
    marketing_emails = Column(Boolean, nullable=False, default=False)
    
    # 用户偏好
    preferred_character = Column(String(100), nullable=True)  # 偏好的AI角色
    interaction_style = Column(String(50), nullable=True)  # 交互风格偏好
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # 关系
    user = relationship("User", back_populates="profile")

    # 验证器
    @validates('bio')
    def validate_bio(self, key, bio):
        """验证个人简介长度"""
        if bio and len(bio) > 500:
            raise ValueError("个人简介不能超过500个字符")
        return bio

    @validates('nickname')
    def validate_nickname(self, key, nickname):
        """验证昵称"""
        if nickname:
            if len(nickname.strip()) == 0:
                raise ValueError("昵称不能为空")
            if len(nickname) > 50:
                raise ValueError("昵称不能超过50个字符")
            return nickname.strip()
        return nickname

    def to_schema(self) -> UserProfileSchema:
        """转换为Pydantic Schema"""
        return UserProfileSchema(
            nickname=self.nickname,
            avatar_url=self.avatar_url,
            bio=self.bio,
            gender=self.gender,
            birthday=self.birthday,
            location=self.location,
            website=self.website,
            social_links=self.social_links,
            language=self.language,
            timezone=self.timezone,
            theme=self.theme,
            profile_visibility=self.profile_visibility,
            email_notifications=self.email_notifications,
            sms_notifications=self.sms_notifications
        )

    def __repr__(self):
        return f"<UserProfile(user_id={self.user_id}, nickname='{self.nickname}')>"


class UserSecurity(Base):
    """用户安全信息表 - 密码和安全相关"""
    __tablename__ = 'user_security'
    __table_args__ = (
        Index('idx_security_user_id', 'user_id'),
        Index('idx_security_password_updated', 'password_updated_at'),
        {'schema': 'zishu'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, unique=True)
    
    # 密码信息
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(255), nullable=False)
    password_updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    password_history = Column(JSONB, nullable=False, default=list)  # 存储历史密码hash
    
    # 两步验证
    two_factor_enabled = Column(Boolean, nullable=False, default=False)
    two_factor_secret = Column(String(255), nullable=True)
    backup_codes = Column(JSONB, nullable=False, default=list)
    recovery_email = Column(String(255), nullable=True)
    
    # 安全问题
    security_questions = Column(JSONB, nullable=False, default=list)
    
    # 密码策略
    require_password_change = Column(Boolean, nullable=False, default=False)
    password_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # API密钥
    api_key_hash = Column(String(255), nullable=True)
    api_key_created_at = Column(DateTime(timezone=True), nullable=True)
    api_key_last_used = Column(DateTime(timezone=True), nullable=True)
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # 关系
    user = relationship("User", back_populates="security")

    def set_password(self, password: str):
        """设置密码"""
        # 生成盐值
        self.salt = secrets.token_hex(32)
        # 生成密码hash
        self.password_hash = generate_password_hash(password + self.salt)
        self.password_updated_at = func.now()
        
        # 保存到历史记录（最多保存5个）
        if not self.password_history:
            self.password_history = []
        self.password_history.append({
            'hash': self.password_hash,
            'created_at': datetime.utcnow().isoformat()
        })
        if len(self.password_history) > 5:
            self.password_history = self.password_history[-5:]

    def check_password(self, password: str) -> bool:
        """验证密码"""
        return check_password_hash(self.password_hash, password + self.salt)

    def is_password_in_history(self, password: str) -> bool:
        """检查密码是否在历史记录中"""
        for hist in self.password_history:
            if check_password_hash(hist['hash'], password + self.salt):
                return True
        return False

    def generate_api_key(self) -> str:
        """生成API密钥"""
        api_key = secrets.token_urlsafe(32)
        self.api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        self.api_key_created_at = func.now()
        return api_key

    def verify_api_key(self, api_key: str) -> bool:
        """验证API密钥"""
        if not self.api_key_hash:
            return False
        
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()
        if key_hash == self.api_key_hash:
            self.api_key_last_used = func.now()
            return True
        return False

    def to_schema(self) -> UserSecuritySchema:
        """转换为Pydantic Schema（敏感信息已隐藏）"""
        return UserSecuritySchema(
            password_hash="[HIDDEN]",
            salt="[HIDDEN]",
            password_updated_at=self.password_updated_at,
            failed_login_attempts=0,  # 这个字段在User模型中
            two_factor_enabled=self.two_factor_enabled,
            backup_codes=["[HIDDEN]"] if self.backup_codes else []
        )

    def __repr__(self):
        return f"<UserSecurity(user_id={self.user_id}, 2fa_enabled={self.two_factor_enabled})>"


# ======================== 辅助模型 ========================

class Tag(Base):
    """标签表"""
    __tablename__ = 'tags'
    __table_args__ = (
        Index('idx_tags_name', 'name'),
        Index('idx_tags_category', 'category'),
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
    users = relationship("User", secondary=user_tags_association, back_populates="tags")

    def __repr__(self):
        return f"<Tag(name='{self.name}', category='{self.category}')>"


class Group(Base):
    """用户组表"""
    __tablename__ = 'groups'
    __table_args__ = (
        Index('idx_groups_name', 'name'),
        Index('idx_groups_type', 'group_type'),
        UniqueConstraint('name', name='uq_groups_name'),
        {'schema': 'zishu'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    group_type = Column(String(50), nullable=False, default='custom')  # system, custom, role
    is_system = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # 权限和限制
    permissions = Column(JSONB, nullable=False, default=list)
    max_members = Column(Integer, nullable=True)
    
    # 创建信息
    created_by = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # 关系
    users = relationship("User", secondary=user_groups_association, back_populates="groups")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<Group(name='{self.name}', type='{self.group_type}')>"


class Permission(Base):
    """权限表"""
    __tablename__ = 'permissions'
    __table_args__ = (
        Index('idx_permissions_code', 'code'),
        Index('idx_permissions_resource', 'resource'),
        UniqueConstraint('code', name='uq_permissions_code'),
        {'schema': 'zishu'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    code = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    resource = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    level = Column(Integer, nullable=False, default=1)
    is_system = Column(Boolean, nullable=False, default=False)
    
    # 时间限制
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())

    # 关系
    users = relationship("User", secondary=user_permissions_association, back_populates="permissions")

    @validates('code')
    def validate_code(self, key, code):
        """验证权限代码格式"""
        if not re.match(r'^[a-z0-9_:]+$', code):
            raise ValueError("权限代码只能包含小写字母、数字、下划线和冒号")
        return code

    def __repr__(self):
        return f"<Permission(code='{self.code}', resource='{self.resource}')>"


class UserSession(Base):
    """用户会话表"""
    __tablename__ = 'user_sessions'
    __table_args__ = (
        Index('idx_sessions_user_id', 'user_id'),
        Index('idx_sessions_session_id', 'session_id'),
        Index('idx_sessions_status', 'status'),
        Index('idx_sessions_created_at', 'created_at'),
        {'schema': 'zishu'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(255), nullable=False, unique=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # 会话状态
    status = Column(String(20), nullable=False, default='active')  # active, expired, revoked
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_activity_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    
    # 设备信息
    device_id = Column(String(255), nullable=True)
    device_name = Column(String(255), nullable=True)
    device_type = Column(String(50), nullable=True)
    os = Column(String(100), nullable=True)
    browser = Column(String(100), nullable=True)
    
    # 网络信息
    ip_address = Column(String(45), nullable=False)  # 支持IPv6
    user_agent = Column(Text, nullable=True)
    location = Column(JSONB, nullable=True)
    
    # 会话数据
    session_data = Column(JSONB, nullable=False, default=dict)
    
    # 安全标记
    is_trusted = Column(Boolean, nullable=False, default=False)
    risk_score = Column(Float, nullable=False, default=0.0)

    # 关系
    user = relationship("User", back_populates="sessions")

    def is_expired(self) -> bool:
        """检查会话是否过期"""
        return datetime.utcnow() > self.expires_at

    def extend_session(self, hours: int = 24):
        """延长会话时间"""
        self.expires_at = datetime.utcnow() + timedelta(hours=hours)
        self.last_activity_at = func.now()

    def revoke(self):
        """撤销会话"""
        self.status = 'revoked'

    def __repr__(self):
        return f"<UserSession(session_id='{self.session_id}', user_id={self.user_id}, status='{self.status}')>"


class UserToken(Base):
    """用户令牌表"""
    __tablename__ = 'user_tokens'
    __table_args__ = (
        Index('idx_tokens_user_id', 'user_id'),
        Index('idx_tokens_token_type', 'token_type'),
        Index('idx_tokens_created_at', 'created_at'),
        Index('idx_tokens_expires_at', 'expires_at'),
        {'schema': 'zishu'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    token_type = Column(String(50), nullable=False)  # access, refresh, reset_password, etc.
    token_hash = Column(String(255), nullable=False)
    
    # 时间信息
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    
    # 状态信息
    is_revoked = Column(Boolean, nullable=False, default=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_reason = Column(String(255), nullable=True)
    
    # 使用信息
    usage_count = Column(Integer, nullable=False, default=0)
    max_usage = Column(Integer, nullable=True)
    
    # 权限范围
    scopes = Column(JSONB, nullable=False, default=list)
    
    # 设备和位置信息
    device_info = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

    # 关系
    user = relationship("User", back_populates="tokens")

    def is_expired(self) -> bool:
        """检查令牌是否过期"""
        return datetime.utcnow() > self.expires_at

    def is_valid(self) -> bool:
        """检查令牌是否有效"""
        return not self.is_revoked and not self.is_expired()

    def revoke(self, reason: str = None):
        """撤销令牌"""
        self.is_revoked = True
        self.revoked_at = func.now()
        self.revoked_reason = reason

    def use_token(self):
        """使用令牌"""
        self.usage_count += 1
        self.last_used_at = func.now()

    def __repr__(self):
        return f"<UserToken(user_id={self.user_id}, type='{self.token_type}', revoked={self.is_revoked})>"


class AuthLog(Base):
    """认证日志表"""
    __tablename__ = 'auth_logs'
    __table_args__ = (
        Index('idx_auth_logs_user_id', 'user_id'),
        Index('idx_auth_logs_action', 'action'), 
        Index('idx_auth_logs_status', 'status'),
        Index('idx_auth_logs_timestamp', 'timestamp'),
        Index('idx_auth_logs_ip', 'ip_address'),
        {'schema': 'zishu'}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    action = Column(String(50), nullable=False)  # login, logout, register, etc.
    status = Column(String(20), nullable=False)  # success, failure, pending
    
    # 详细信息
    details = Column(JSONB, nullable=False, default=dict)
    error_message = Column(Text, nullable=True)
    
    # 环境信息
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(Text, nullable=True)
    device_info = Column(JSONB, nullable=True)
    location = Column(JSONB, nullable=True)
    
    # 风险评估
    risk_score = Column(Float, nullable=False, default=0.0)
    risk_factors = Column(JSONB, nullable=False, default=list)
    
    timestamp = Column(DateTime(timezone=True), nullable=False, default=func.now())

    # 关系
    user = relationship("User", back_populates="auth_logs")

    def __repr__(self):
        return f"<AuthLog(user_id={self.user_id}, action='{self.action}', status='{self.status}')>"


# ======================== 工具函数 ========================

def create_user_with_profile(
    session: Session,
    username: str,
    email: str,
    password: str,
    **profile_data
) -> User:
    """创建用户及其档案"""
    # 创建用户
    user = User(
        username=username,
        email=email,
        status=UserStatus.PENDING
    )
    
    # 创建安全信息
    security = UserSecurity(user=user)
    security.set_password(password)
    
    # 创建档案
    profile = UserProfile(
        user=user,
        **profile_data
    )
    
    session.add(user)
    session.add(security)
    session.add(profile)
    session.flush()  # 获取ID
    
    return user


def get_user_by_identifier(session: Session, identifier: str) -> Optional[User]:
    """根据用户名、邮箱或手机号查找用户"""
    return session.query(User).filter(
        (User.username == identifier) |
        (User.email == identifier) |
        (User.phone == identifier)
    ).filter(User.is_deleted == False).first()


def cleanup_expired_tokens(session: Session) -> int:
    """清理过期令牌"""
    count = session.query(UserToken).filter(
        UserToken.expires_at < datetime.utcnow()
    ).delete()
    return count


def cleanup_expired_sessions(session: Session) -> int:
    """清理过期会话"""
    count = session.query(UserSession).filter(
        UserSession.expires_at < datetime.utcnow()
    ).update({'status': 'expired'})
    return count


# ======================== 初始化数据 ========================

def init_default_permissions(session: Session):
    """初始化默认权限"""
    default_permissions = [
        # 聊天权限
        {"code": "chat:basic", "name": "基础聊天", "resource": "chat", "action": "basic"},
        {"code": "chat:advanced", "name": "高级聊天", "resource": "chat", "action": "advanced"},
        {"code": "chat:voice", "name": "语音聊天", "resource": "chat", "action": "voice"},
        
        # 用户权限
        {"code": "profile:read", "name": "读取档案", "resource": "profile", "action": "read"},
        {"code": "profile:update", "name": "更新档案", "resource": "profile", "action": "update"},
        
        # 会话权限
        {"code": "session:manage", "name": "管理会话", "resource": "session", "action": "manage"},
        
        # 管理权限
        {"code": "admin:users", "name": "用户管理", "resource": "admin", "action": "users"},
        {"code": "admin:system", "name": "系统管理", "resource": "admin", "action": "system"},
    ]
    
    for perm_data in default_permissions:
        existing = session.query(Permission).filter_by(code=perm_data["code"]).first()
        if not existing:
            permission = Permission(**perm_data, is_system=True)
            session.add(permission)
    
    session.commit()


def create_default_groups(session: Session):
    """创建默认用户组"""
    default_groups = [
        {"name": "users", "display_name": "普通用户", "group_type": "system"},
        {"name": "vip", "display_name": "VIP用户", "group_type": "system"},
        {"name": "moderators", "display_name": "版主", "group_type": "system"},
        {"name": "administrators", "display_name": "管理员", "group_type": "system"},
    ]
    
    for group_data in default_groups:
        existing = session.query(Group).filter_by(name=group_data["name"]).first()
        if not existing:
            group = Group(**group_data, is_system=True)
            session.add(group)
    
    session.commit()
