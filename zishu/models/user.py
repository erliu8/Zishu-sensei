"""
用户管理相关数据模型

包含用户认证、授权、资料管理等核心功能：
- User: 用户基础信息和认证
- UserProfile: 用户详细资料  
- UserRole: 用户角色管理
- UserPermission: 权限控制
- UserSession: 会话管理
- UserPreference: 用户偏好设置
"""

import re
import secrets
from datetime import datetime, timezone, timedelta
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
from pydantic import BaseModel, EmailStr, Field, validator

try:
    from werkzeug.security import generate_password_hash, check_password_hash
except ImportError:
    # 如果werkzeug不可用，使用简单的哈希实现
    import hashlib

    def generate_password_hash(password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

    def check_password_hash(pwhash: str, password: str) -> bool:
        return pwhash == hashlib.sha256(password.encode()).hexdigest()


from zishu.database.base import DatabaseBaseModel, MetadataMixin


# ================================
# 枚举定义
# ================================


class UserStatus(str, Enum):
    """用户状态"""

    PENDING = "pending"  # 待激活
    ACTIVE = "active"  # 激活
    SUSPENDED = "suspended"  # 暂停
    BANNED = "banned"  # 封禁
    DELETED = "deleted"  # 已删除


class UserRole(str, Enum):
    """用户角色"""

    GUEST = "guest"  # 访客
    USER = "user"  # 普通用户
    DEVELOPER = "developer"  # 开发者
    MODERATOR = "moderator"  # 管理员
    ADMIN = "admin"  # 超级管理员


class PermissionType(str, Enum):
    """权限类型"""

    # 基础权限
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"

    # 适配器权限
    ADAPTER_CREATE = "adapter.create"
    ADAPTER_PUBLISH = "adapter.publish"
    ADAPTER_REVIEW = "adapter.review"
    ADAPTER_MODERATE = "adapter.moderate"

    # 社区权限
    COMMUNITY_POST = "community.post"
    COMMUNITY_MODERATE = "community.moderate"
    COMMUNITY_ADMIN = "community.admin"

    # 系统权限
    SYSTEM_CONFIG = "system.config"
    SYSTEM_MONITOR = "system.monitor"
    USER_MANAGE = "user.manage"


class SessionStatus(str, Enum):
    """会话状态"""

    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class ThemeMode(str, Enum):
    """主题模式"""

    LIGHT = "light"
    DARK = "dark"
    AUTO = "auto"


class Language(str, Enum):
    """支持的语言"""

    ZH_CN = "zh-CN"
    EN_US = "en-US"
    JA_JP = "ja-JP"


# ================================
# SQLAlchemy 模型
# ================================


class User(DatabaseBaseModel):
    """
    用户基础模型

    管理用户认证信息和基础状态
    """

    __tablename__ = "users"

    # 基础信息
    username: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, comment="用户名"
    )

    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, comment="邮箱地址"
    )

    # 认证信息
    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="密码哈希"
    )

    salt: Mapped[str] = mapped_column(String(32), nullable=False, comment="密码盐值")

    # 状态信息
    user_status: Mapped[UserStatus] = mapped_column(
        String(20), default=UserStatus.PENDING, nullable=False, comment="用户状态"
    )

    user_role: Mapped[UserRole] = mapped_column(
        String(20), default=UserRole.USER, nullable=False, comment="用户角色"
    )

    # 激活和验证
    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="邮箱是否已验证"
    )

    verification_token: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="邮箱验证令牌"
    )

    verification_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="验证令牌过期时间"
    )

    # 密码重置
    reset_token: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="密码重置令牌"
    )

    reset_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="重置令牌过期时间"
    )

    # 登录信息
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="最后登录时间"
    )

    last_login_ip: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True, comment="最后登录IP"  # 支持IPv6
    )

    login_attempts: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="登录尝试次数"
    )

    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="账户锁定到期时间"
    )

    # 关联关系
    profile: Mapped[Optional["UserProfile"]] = relationship(
        "UserProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    permissions: Mapped[List["UserPermission"]] = relationship(
        "UserPermission", back_populates="user", cascade="all, delete-orphan"
    )

    sessions: Mapped[List["UserSession"]] = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )

    preferences: Mapped[Optional["UserPreference"]] = relationship(
        "UserPreference",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_users_username", "username"),
        Index("idx_users_email", "email"),
        Index("idx_users_status", "user_status"),
        Index("idx_users_role", "user_role"),
        Index("idx_users_verification_token", "verification_token"),
        Index("idx_users_reset_token", "reset_token"),
        CheckConstraint(
            "length(username) >= 3 AND length(username) <= 50",
            name="check_username_length",
        ),
        CheckConstraint(
            "email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'",
            name="check_email_format",
        ),
    )

    def set_password(self, password: str) -> None:
        """设置密码"""
        self.salt = secrets.token_hex(16)
        self.password_hash = generate_password_hash(password + self.salt)

    def check_password(self, password: str) -> bool:
        """验证密码"""
        return check_password_hash(self.password_hash, password + self.salt)

    def generate_verification_token(self) -> str:
        """生成邮箱验证令牌"""
        self.verification_token = secrets.token_urlsafe(32)
        self.verification_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        return self.verification_token

    def generate_reset_token(self) -> str:
        """生成密码重置令牌"""
        self.reset_token = secrets.token_urlsafe(32)
        self.reset_expires_at = datetime.now(timezone.utc) + timedelta(hours=2)
        return self.reset_token

    def is_locked(self) -> bool:
        """检查账户是否被锁定"""
        if self.locked_until is None:
            return False
        return datetime.now(timezone.utc) < self.locked_until

    def can_login(self) -> bool:
        """检查是否可以登录"""
        return (
            self.user_status in [UserStatus.ACTIVE, UserStatus.PENDING]
            and not self.is_locked()
        )


class UserProfile(DatabaseBaseModel, MetadataMixin):
    """
    用户资料模型

    存储用户的详细个人信息
    """

    __tablename__ = "user_profiles"

    # 关联用户
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户ID",
    )

    # 基础资料
    display_name: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="显示名称"
    )

    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="头像URL"
    )

    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="个人简介")

    location: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="地理位置"
    )

    website: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="个人网站"
    )

    # 开发者信息
    github_username: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="GitHub用户名"
    )

    preferred_adapter_types: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="偏好的适配器类型"
    )

    skills: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="技能标签"
    )

    # 统计信息
    reputation_score: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="声誉分数"
    )

    adapter_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="发布的适配器数量"
    )

    download_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="适配器总下载量"
    )

    # 关联关系
    user: Mapped["User"] = relationship("User", back_populates="profile")

    # 索引
    __table_args__ = (
        Index("idx_user_profiles_user_id", "user_id"),
        Index("idx_user_profiles_github", "github_username"),
        UniqueConstraint("user_id", name="uk_user_profiles_user_id"),
    )


class UserPermission(DatabaseBaseModel):
    """
    用户权限模型

    管理用户的细粒度权限
    """

    __tablename__ = "user_permissions"

    # 关联用户
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户ID",
    )

    # 权限信息
    permission: Mapped[PermissionType] = mapped_column(
        String(50), nullable=False, comment="权限类型"
    )

    resource_type: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="资源类型"
    )

    resource_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="资源ID"
    )

    # 权限有效期
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="权限过期时间"
    )

    # 授权信息
    granted_by: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="权限授予者"
    )

    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="权限授予时间",
    )

    # 关联关系
    user: Mapped["User"] = relationship("User", back_populates="permissions")

    # 索引和约束
    __table_args__ = (
        Index("idx_user_permissions_user_id", "user_id"),
        Index("idx_user_permissions_permission", "permission"),
        Index("idx_user_permissions_resource", "resource_type", "resource_id"),
        UniqueConstraint(
            "user_id",
            "permission",
            "resource_type",
            "resource_id",
            name="uk_user_permissions_unique",
        ),
    )

    def is_expired(self) -> bool:
        """检查权限是否过期"""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at


class UserSession(DatabaseBaseModel):
    """
    用户会话模型

    管理用户登录会话
    """

    __tablename__ = "user_sessions"

    # 关联用户
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户ID",
    )

    # 会话信息
    session_token: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, comment="会话令牌"
    )

    refresh_token: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, comment="刷新令牌"
    )

    session_status: Mapped[SessionStatus] = mapped_column(
        String(20), default=SessionStatus.ACTIVE, nullable=False, comment="会话状态"
    )

    # 时间信息
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, comment="会话过期时间"
    )

    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="最后活动时间",
    )

    # 客户端信息
    ip_address: Mapped[str] = mapped_column(
        String(45), nullable=False, comment="客户端IP地址"
    )

    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="用户代理"
    )

    device_info: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="设备信息"
    )

    # 关联关系
    user: Mapped["User"] = relationship("User", back_populates="sessions")

    # 索引
    __table_args__ = (
        Index("idx_user_sessions_user_id", "user_id"),
        Index("idx_user_sessions_token", "session_token"),
        Index("idx_user_sessions_refresh_token", "refresh_token"),
        Index("idx_user_sessions_status", "session_status"),
        Index("idx_user_sessions_expires_at", "expires_at"),
    )

    def is_expired(self) -> bool:
        """检查会话是否过期"""
        return datetime.now(timezone.utc) > self.expires_at

    def is_active(self) -> bool:
        """检查会话是否活跃"""
        return self.session_status == SessionStatus.ACTIVE and not self.is_expired()

    def revoke(self) -> None:
        """撤销会话"""
        self.session_status = SessionStatus.REVOKED


class UserPreference(DatabaseBaseModel):
    """
    用户偏好设置模型

    存储用户的个性化配置
    """

    __tablename__ = "user_preferences"

    # 关联用户
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户ID",
    )

    # 界面设置
    theme_mode: Mapped[ThemeMode] = mapped_column(
        String(10), default=ThemeMode.AUTO, nullable=False, comment="主题模式"
    )

    language: Mapped[Language] = mapped_column(
        String(10), default=Language.ZH_CN, nullable=False, comment="界面语言"
    )

    timezone: Mapped[str] = mapped_column(
        String(50), default="Asia/Shanghai", nullable=False, comment="时区设置"
    )

    # 通知设置
    email_notifications: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否接收邮件通知"
    )

    push_notifications: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否接收推送通知"
    )

    notification_types: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="通知类型偏好"
    )

    # 隐私设置
    public_profile: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否公开个人资料"
    )

    show_email: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否公开邮箱地址"
    )

    allow_messages: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否允许私信"
    )

    # 开发者设置
    default_adapter_visibility: Mapped[str] = mapped_column(
        String(20), default="public", nullable=False, comment="默认适配器可见性"
    )

    auto_publish: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否自动发布适配器"
    )

    # 扩展设置
    custom_settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="自定义设置"
    )

    # 关联关系
    user: Mapped["User"] = relationship("User", back_populates="preferences")

    # 索引和约束
    __table_args__ = (
        Index("idx_user_preferences_user_id", "user_id"),
        UniqueConstraint("user_id", name="uk_user_preferences_user_id"),
    )


# ================================
# Pydantic 模式
# ================================


class UserBase(BaseModel):
    """用户基础模式"""

    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr


class UserCreate(UserBase):
    """用户创建模式"""

    password: str = Field(..., min_length=8, max_length=128)
    display_name: Optional[str] = Field(None, max_length=100)

    @validator("password")
    def validate_password(cls, v):
        """密码强度验证"""
        if len(v) < 8:
            raise ValueError("密码长度至少8位")
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("密码必须包含字母")
        if not re.search(r"\d", v):
            raise ValueError("密码必须包含数字")
        return v


class UserUpdate(BaseModel):
    """用户更新模式"""

    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    avatar_url: Optional[str] = Field(None, max_length=500)


class UserResponse(UserBase):
    """用户响应模式"""

    id: str
    user_status: UserStatus
    user_role: UserRole
    is_verified: bool
    last_login_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    """用户资料响应模式"""

    id: str
    user_id: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    bio: Optional[str]
    location: Optional[str]
    website: Optional[str]
    github_username: Optional[str]
    skills: Optional[List[str]]
    reputation_score: int
    adapter_count: int
    download_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserSessionResponse(BaseModel):
    """用户会话响应模式"""

    id: str
    session_status: SessionStatus
    expires_at: datetime
    last_activity_at: datetime
    ip_address: str
    device_info: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True
