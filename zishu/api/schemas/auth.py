#! /usr/bin/env python3
# -*- coding: utf-8 -*-

from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from typing import Optional, List, Any, Dict, Union, Literal
from datetime import datetime, timedelta
from enum import Enum
import uuid
import re

# ======================== 枚举定义 ========================

class UserStatus(str, Enum):
    """用户状态枚举"""
    ACTIVE = "active"              # 激活状态
    INACTIVE = "inactive"          # 未激活
    SUSPENDED = "suspended"        # 暂停使用
    BANNED = "banned"             # 封禁状态
    PENDING = "pending"           # 待审核
    DELETED = "deleted"           # 已删除

class UserRole(str, Enum):
    """用户角色枚举"""
    USER = "user"                 # 普通用户
    VIP = "vip"                   # VIP用户
    MODERATOR = "moderator"       # 版主
    ADMIN = "admin"               # 管理员
    SUPER_ADMIN = "super_admin"   # 超级管理员
    DEVELOPER = "developer"       # 开发者
    TESTER = "tester"            # 测试用户

class AuthProvider(str, Enum):
    """认证提供商枚举"""
    LOCAL = "local"               # 本地认证
    GOOGLE = "google"             # Google OAuth
    GITHUB = "github"             # GitHub OAuth
    WECHAT = "wechat"            # 微信登录
    QQ = "qq"                    # QQ登录
    PHONE = "phone"              # 手机号登录
    EMAIL = "email"              # 邮箱登录

class TokenType(str, Enum):
    """令牌类型枚举"""
    ACCESS = "access"             # 访问令牌
    REFRESH = "refresh"           # 刷新令牌
    RESET_PASSWORD = "reset_password"  # 密码重置令牌
    EMAIL_VERIFICATION = "email_verification"  # 邮箱验证令牌
    PHONE_VERIFICATION = "phone_verification"  # 手机验证令牌
    API_KEY = "api_key"          # API密钥

class AuthAction(str, Enum):
    """认证动作枚举"""
    LOGIN = "login"               # 登录
    LOGOUT = "logout"             # 登出
    REGISTER = "register"         # 注册
    PASSWORD_RESET = "password_reset"  # 密码重置
    EMAIL_VERIFY = "email_verify" # 邮箱验证
    PHONE_VERIFY = "phone_verify" # 手机验证
    PROFILE_UPDATE = "profile_update"  # 资料更新
    PERMISSION_CHANGE = "permission_change"  # 权限变更

class LoginMethod(str, Enum):
    """登录方式枚举"""
    PASSWORD = "password"         # 密码登录
    SMS_CODE = "sms_code"        # 短信验证码
    EMAIL_CODE = "email_code"     # 邮箱验证码
    OAUTH = "oauth"              # 第三方OAuth
    QRCODE = "qrcode"            # 二维码登录
    BIOMETRIC = "biometric"       # 生物识别

class SessionStatus(str, Enum):
    """会话状态枚举"""
    ACTIVE = "active"             # 活跃
    EXPIRED = "expired"           # 已过期
    REVOKED = "revoked"           # 已撤销
    LOGGED_OUT = "logged_out"     # 已登出

# ======================== 基础模型 ========================

class BaseUserModel(BaseModel):
    """用户基础模型"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="用户唯一ID")
    username: str = Field(..., min_length=3, max_length=30, description="用户名")
    email: Optional[EmailStr] = Field(None, description="邮箱地址")
    phone: Optional[str] = Field(None, description="手机号码")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

class UserProfile(BaseModel):
    """用户档案模型"""
    nickname: Optional[str] = Field(None, min_length=1, max_length=50, description="昵称")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    bio: Optional[str] = Field(None, max_length=500, description="个人简介")
    gender: Optional[Literal["male", "female", "other"]] = Field(None, description="性别")
    birthday: Optional[datetime] = Field(None, description="生日")
    location: Optional[str] = Field(None, max_length=100, description="位置")
    website: Optional[str] = Field(None, description="个人网站")
    social_links: Dict[str, str] = Field(default_factory=dict, description="社交媒体链接")
    
    # 偏好设置
    language: str = Field(default="zh-CN", description="首选语言")
    timezone: str = Field(default="Asia/Shanghai", description="时区")
    theme: str = Field(default="light", description="主题偏好")
    
    # 隐私设置
    profile_visibility: Literal["public", "friends", "private"] = Field(default="public", description="档案可见性")
    email_notifications: bool = Field(default=True, description="邮件通知")
    sms_notifications: bool = Field(default=False, description="短信通知")

class UserSecurity(BaseModel):
    """用户安全信息模型"""
    password_hash: str = Field(..., description="密码哈希")
    salt: str = Field(..., description="密码盐值")
    password_updated_at: datetime = Field(default_factory=datetime.now, description="密码更新时间")
    failed_login_attempts: int = Field(default=0, description="失败登录次数")
    last_failed_login: Optional[datetime] = Field(None, description="最后失败登录时间")
    account_locked_until: Optional[datetime] = Field(None, description="账户锁定到期时间")
    
    # 两步验证
    two_factor_enabled: bool = Field(default=False, description="是否启用两步验证")
    two_factor_secret: Optional[str] = Field(None, description="两步验证密钥")
    backup_codes: List[str] = Field(default_factory=list, description="备用验证码")
    
    # 安全问题
    security_questions: List[Dict[str, str]] = Field(default_factory=list, description="安全问题")

class User(BaseUserModel):
    """完整用户模型"""
    status: UserStatus = Field(default=UserStatus.PENDING, description="用户状态")
    role: UserRole = Field(default=UserRole.USER, description="用户角色")
    auth_provider: AuthProvider = Field(default=AuthProvider.LOCAL, description="认证提供商")
    provider_id: Optional[str] = Field(None, description="第三方提供商用户ID")
    
    # 用户档案
    profile: UserProfile = Field(default_factory=UserProfile, description="用户档案")
    security: UserSecurity = Field(..., description="安全信息")
    
    # 统计信息
    last_login_at: Optional[datetime] = Field(None, description="最后登录时间")
    last_active_at: Optional[datetime] = Field(None, description="最后活跃时间")
    login_count: int = Field(default=0, description="登录次数")
    
    # 订阅信息
    subscription_plan: Optional[str] = Field(None, description="订阅计划")
    subscription_expires_at: Optional[datetime] = Field(None, description="订阅到期时间")
    
    # 使用统计
    total_messages: int = Field(default=0, description="总消息数")
    total_tokens: int = Field(default=0, description="总token使用量")
    total_sessions: int = Field(default=0, description="总会话数")
    
    # 标签和分组
    tags: List[str] = Field(default_factory=list, description="用户标签")
    groups: List[str] = Field(default_factory=list, description="用户组")
    
    # 元数据
    metadata: Dict[str, Any] = Field(default_factory=dict, description="扩展元数据")
    
    # 验证器
    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if not re.match(r'^[a-zA-Z0-9_\u4e00-\u9fff]+$', v):
            raise ValueError("用户名只能包含字母、数字、下划线和中文字符")
        return v.strip()
    
    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if v and not re.match(r'^1[3-9]\d{9}$', v):
            raise ValueError("手机号格式不正确")
        return v
    
    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if len(v) > 20:
            raise ValueError("标签数量不能超过20个")
        return v

# ======================== 令牌模型 ========================

class TokenInfo(BaseModel):
    """令牌信息模型"""
    token_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="令牌ID")
    user_id: str = Field(..., description="用户ID")
    token_type: TokenType = Field(..., description="令牌类型")
    token_hash: str = Field(..., description="令牌哈希")
    
    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    expires_at: datetime = Field(..., description="过期时间")
    last_used_at: Optional[datetime] = Field(None, description="最后使用时间")
    
    # 状态信息
    is_revoked: bool = Field(default=False, description="是否已撤销")
    revoked_at: Optional[datetime] = Field(None, description="撤销时间")
    revoked_reason: Optional[str] = Field(None, description="撤销原因")
    
    # 使用信息
    usage_count: int = Field(default=0, description="使用次数")
    max_usage: Optional[int] = Field(None, description="最大使用次数")
    
    # 设备和位置信息
    device_info: Optional[Dict[str, Any]] = Field(None, description="设备信息")
    ip_address: Optional[str] = Field(None, description="IP地址")
    user_agent: Optional[str] = Field(None, description="用户代理")
    location: Optional[Dict[str, Any]] = Field(None, description="位置信息")
    
    # 权限范围
    scopes: List[str] = Field(default_factory=list, description="权限范围")
    
    @field_validator("expires_at")
    @classmethod
    def validate_expires_at(cls, v, info):
        if v <= datetime.now():
            raise ValueError("过期时间必须在未来")
        return v

class UserSession(BaseModel):
    """用户会话模型"""
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="会话ID")
    user_id: str = Field(..., description="用户ID")
    status: SessionStatus = Field(default=SessionStatus.ACTIVE, description="会话状态")
    
    # 时间信息
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    expires_at: datetime = Field(..., description="过期时间")
    last_activity_at: datetime = Field(default_factory=datetime.now, description="最后活动时间")
    
    # 设备信息
    device_id: Optional[str] = Field(None, description="设备ID")
    device_name: Optional[str] = Field(None, description="设备名称")
    device_type: Optional[str] = Field(None, description="设备类型")
    os: Optional[str] = Field(None, description="操作系统")
    browser: Optional[str] = Field(None, description="浏览器")
    
    # 网络信息
    ip_address: str = Field(..., description="IP地址")
    user_agent: str = Field(..., description="用户代理")
    location: Optional[Dict[str, Any]] = Field(None, description="地理位置")
    
    # 会话数据
    session_data: Dict[str, Any] = Field(default_factory=dict, description="会话数据")
    
    # 安全标记
    is_trusted: bool = Field(default=False, description="是否为可信设备")
    risk_score: float = Field(default=0.0, ge=0.0, le=1.0, description="风险评分")

# ======================== 权限模型 ========================

class Permission(BaseModel):
    """权限模型"""
    permission_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="权限ID")
    name: str = Field(..., description="权限名称")
    code: str = Field(..., description="权限代码")
    description: Optional[str] = Field(None, description="权限描述")
    resource: str = Field(..., description="资源标识")
    action: str = Field(..., description="动作标识")
    
    # 权限级别
    level: int = Field(default=1, ge=1, le=10, description="权限级别")
    is_system: bool = Field(default=False, description="是否为系统权限")
    
    # 时间限制
    valid_from: Optional[datetime] = Field(None, description="生效时间")
    valid_until: Optional[datetime] = Field(None, description="失效时间")
    
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    
    @field_validator("code")
    @classmethod
    def validate_code(cls, v):
        if not re.match(r'^[a-z0-9_:]+$', v):
            raise ValueError("权限代码只能包含小写字母、数字、下划线和冒号")
        return v

class RolePermissions(BaseModel):
    """角色权限模型"""
    role: UserRole = Field(..., description="用户角色")
    permissions: List[str] = Field(..., description="权限代码列表")
    inherited_roles: List[UserRole] = Field(default_factory=list, description="继承的角色")
    
    # 限制条件
    max_api_calls_per_hour: Optional[int] = Field(None, description="每小时最大API调用次数")
    max_tokens_per_day: Optional[int] = Field(None, description="每日最大token数")
    max_sessions: Optional[int] = Field(None, description="最大并发会话数")
    
    # 功能限制
    allowed_features: List[str] = Field(default_factory=list, description="允许使用的功能")
    forbidden_features: List[str] = Field(default_factory=list, description="禁止使用的功能")

# ======================== 请求模型 ========================

class LoginRequest(BaseModel):
    """登录请求模型"""
    username: Optional[str] = Field(None, description="用户名")
    email: Optional[EmailStr] = Field(None, description="邮箱")
    phone: Optional[str] = Field(None, description="手机号")
    password: Optional[str] = Field(None, min_length=6, description="密码")
    
    # 验证码登录
    verification_code: Optional[str] = Field(None, description="验证码")
    login_method: LoginMethod = Field(default=LoginMethod.PASSWORD, description="登录方式")
    
    # 第三方登录
    provider: Optional[AuthProvider] = Field(None, description="认证提供商")
    provider_token: Optional[str] = Field(None, description="第三方令牌")
    
    # 设备信息
    device_info: Optional[Dict[str, Any]] = Field(None, description="设备信息")
    remember_me: bool = Field(default=False, description="记住登录状态")
    
    # 两步验证
    two_factor_code: Optional[str] = Field(None, description="两步验证码")
    
    @model_validator(mode='after')
    def validate_login_credentials(self):
        """验证登录凭据"""
        # 至少提供一种身份标识
        if not any([self.username, self.email, self.phone]):
            raise ValueError("必须提供用户名、邮箱或手机号中的一种")
        
        # 根据登录方式验证必要字段
        if self.login_method == LoginMethod.PASSWORD and not self.password:
            raise ValueError("密码登录需要提供密码")
        elif self.login_method in [LoginMethod.SMS_CODE, LoginMethod.EMAIL_CODE] and not self.verification_code:
            raise ValueError("验证码登录需要提供验证码")
        elif self.login_method == LoginMethod.OAUTH and not all([self.provider, self.provider_token]):
            raise ValueError("第三方登录需要提供认证提供商和令牌")
        
        return self

class RegisterRequest(BaseModel):
    """注册请求模型"""
    username: str = Field(..., min_length=3, max_length=30, description="用户名")
    email: EmailStr = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=8, max_length=128, description="密码")
    confirm_password: str = Field(..., description="确认密码")
    
    # 可选信息
    phone: Optional[str] = Field(None, description="手机号码")
    nickname: Optional[str] = Field(None, min_length=1, max_length=50, description="昵称")
    
    # 验证码
    email_verification_code: Optional[str] = Field(None, description="邮箱验证码")
    phone_verification_code: Optional[str] = Field(None, description="手机验证码")
    
    # 第三方注册
    provider: Optional[AuthProvider] = Field(None, description="认证提供商")
    provider_token: Optional[str] = Field(None, description="第三方令牌")
    provider_user_info: Optional[Dict[str, Any]] = Field(None, description="第三方用户信息")
    
    # 邀请码
    invitation_code: Optional[str] = Field(None, description="邀请码")
    
    # 同意条款
    agree_to_terms: bool = Field(..., description="同意服务条款")
    agree_to_privacy: bool = Field(..., description="同意隐私政策")
    
    # 设备信息
    device_info: Optional[Dict[str, Any]] = Field(None, description="设备信息")
    
    @model_validator(mode='after')
    def validate_registration(self):
        """验证注册信息"""
        if self.password != self.confirm_password:
            raise ValueError("密码和确认密码不匹配")
        
        if not self.agree_to_terms or not self.agree_to_privacy:
            raise ValueError("必须同意服务条款和隐私政策")
        
        # 验证密码强度
        if not re.search(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$', self.password):
            raise ValueError("密码必须包含大小写字母、数字和特殊字符，长度至少8位")
        
        return self

class PasswordResetRequest(BaseModel):
    """密码重置请求模型"""
    email: Optional[EmailStr] = Field(None, description="邮箱地址")
    phone: Optional[str] = Field(None, description="手机号码")
    username: Optional[str] = Field(None, description="用户名")
    
    @model_validator(mode='after')
    def validate_reset_info(self):
        """验证重置信息"""
        if not any([self.email, self.phone, self.username]):
            raise ValueError("必须提供邮箱、手机号或用户名中的一种")
        return self

class PasswordChangeRequest(BaseModel):
    """密码修改请求模型"""
    current_password: str = Field(..., description="当前密码")
    new_password: str = Field(..., min_length=8, max_length=128, description="新密码")
    confirm_new_password: str = Field(..., description="确认新密码")
    
    @model_validator(mode='after')
    def validate_password_change(self):
        """验证密码修改"""
        if self.new_password != self.confirm_new_password:
            raise ValueError("新密码和确认密码不匹配")
        
        if self.current_password == self.new_password:
            raise ValueError("新密码不能与当前密码相同")
            
        # 验证新密码强度
        if not re.search(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$', self.new_password):
            raise ValueError("新密码必须包含大小写字母、数字和特殊字符，长度至少8位")
        
        return self

class TokenRefreshRequest(BaseModel):
    """令牌刷新请求模型"""
    refresh_token: str = Field(..., description="刷新令牌")
    device_info: Optional[Dict[str, Any]] = Field(None, description="设备信息")

class VerificationRequest(BaseModel):
    """验证请求模型"""
    verification_type: Literal["email", "phone"] = Field(..., description="验证类型")
    target: str = Field(..., description="验证目标（邮箱或手机号）")
    purpose: Literal["registration", "login", "reset_password", "change_info"] = Field(..., description="验证目的")

class TwoFactorSetupRequest(BaseModel):
    """两步验证设置请求模型"""
    password: str = Field(..., description="当前密码")
    method: Literal["totp", "sms", "email"] = Field(..., description="验证方式")
    verification_code: Optional[str] = Field(None, description="验证码")

class UserUpdateRequest(BaseModel):
    """用户信息更新请求模型"""
    # 基础信息
    nickname: Optional[str] = Field(None, min_length=1, max_length=50, description="昵称")
    bio: Optional[str] = Field(None, max_length=500, description="个人简介")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    gender: Optional[Literal["male", "female", "other"]] = Field(None, description="性别")
    birthday: Optional[datetime] = Field(None, description="生日")
    location: Optional[str] = Field(None, max_length=100, description="位置")
    website: Optional[str] = Field(None, description="个人网站")
    
    # 偏好设置
    language: Optional[str] = Field(None, description="首选语言")
    timezone: Optional[str] = Field(None, description="时区")
    theme: Optional[str] = Field(None, description="主题偏好")
    
    # 隐私设置
    profile_visibility: Optional[Literal["public", "friends", "private"]] = Field(None, description="档案可见性")
    email_notifications: Optional[bool] = Field(None, description="邮件通知")
    sms_notifications: Optional[bool] = Field(None, description="短信通知")

# ======================== 响应模型 ========================

class TokenResponse(BaseModel):
    """令牌响应模型"""
    access_token: str = Field(..., description="访问令牌")
    refresh_token: str = Field(..., description="刷新令牌")
    token_type: str = Field(default="Bearer", description="令牌类型")
    expires_in: int = Field(..., description="过期时间（秒）")
    expires_at: datetime = Field(..., description="过期时间戳")
    scope: List[str] = Field(default_factory=list, description="权限范围")

class LoginResponse(BaseModel):
    """登录响应模型"""
    success: bool = Field(..., description="登录是否成功")
    message: str = Field(..., description="响应消息")
    user: Optional[Dict[str, Any]] = Field(None, description="用户信息")
    token: Optional[TokenResponse] = Field(None, description="令牌信息")
    
    # 安全信息
    require_two_factor: bool = Field(default=False, description="是否需要两步验证")
    two_factor_methods: List[str] = Field(default_factory=list, description="可用的两步验证方法")
    
    # 会话信息
    session_id: Optional[str] = Field(None, description="会话ID")
    
    # 警告信息
    warnings: List[str] = Field(default_factory=list, description="警告信息")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")

class RegisterResponse(BaseModel):
    """注册响应模型"""
    success: bool = Field(..., description="注册是否成功")
    message: str = Field(..., description="响应消息")
    user_id: Optional[str] = Field(None, description="用户ID")
    
    # 验证信息
    require_email_verification: bool = Field(default=False, description="是否需要邮箱验证")
    require_phone_verification: bool = Field(default=False, description="是否需要手机验证")
    
    # 自动登录
    auto_login: bool = Field(default=False, description="是否自动登录")
    token: Optional[TokenResponse] = Field(None, description="令牌信息")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")

class UserInfoResponse(BaseModel):
    """用户信息响应模型"""
    success: bool = Field(..., description="获取是否成功")
    user: Dict[str, Any] = Field(..., description="用户信息")
    permissions: List[str] = Field(default_factory=list, description="用户权限")
    roles: List[UserRole] = Field(default_factory=list, description="用户角色")
    
    # 统计信息
    stats: Optional[Dict[str, Any]] = Field(None, description="用户统计")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")

class VerificationResponse(BaseModel):
    """验证响应模型"""
    success: bool = Field(..., description="验证是否成功")
    message: str = Field(..., description="响应消息")
    verification_id: Optional[str] = Field(None, description="验证ID")
    expires_in: Optional[int] = Field(None, description="验证码有效期（秒）")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")

class SessionListResponse(BaseModel):
    """会话列表响应模型"""
    success: bool = Field(..., description="获取是否成功")
    sessions: List[Dict[str, Any]] = Field(..., description="会话列表")
    current_session_id: str = Field(..., description="当前会话ID")
    total: int = Field(..., description="总会话数")

class AuthLogEntry(BaseModel):
    """认证日志条目模型"""
    log_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="日志ID")
    user_id: Optional[str] = Field(None, description="用户ID")
    action: AuthAction = Field(..., description="认证动作")
    status: Literal["success", "failure", "pending"] = Field(..., description="操作状态")
    
    # 详细信息
    details: Dict[str, Any] = Field(default_factory=dict, description="详细信息")
    error_message: Optional[str] = Field(None, description="错误信息")
    
    # 环境信息
    ip_address: str = Field(..., description="IP地址")
    user_agent: Optional[str] = Field(None, description="用户代理")
    device_info: Optional[Dict[str, Any]] = Field(None, description="设备信息")
    location: Optional[Dict[str, Any]] = Field(None, description="地理位置")
    
    # 风险评估
    risk_score: float = Field(default=0.0, ge=0.0, le=1.0, description="风险评分")
    risk_factors: List[str] = Field(default_factory=list, description="风险因素")
    
    timestamp: datetime = Field(default_factory=datetime.now, description="日志时间")

# ======================== 工具函数 ========================

def generate_token_expiry(token_type: TokenType, remember_me: bool = False) -> datetime:
    """生成令牌过期时间"""
    now = datetime.now()
    
    if token_type == TokenType.ACCESS:
        # 访问令牌默认1小时，记住登录则12小时
        hours = 12 if remember_me else 1
        return now + timedelta(hours=hours)
    elif token_type == TokenType.REFRESH:
        # 刷新令牌默认30天，记住登录则90天
        days = 90 if remember_me else 30
        return now + timedelta(days=days)
    elif token_type == TokenType.RESET_PASSWORD:
        # 密码重置令牌1小时
        return now + timedelta(hours=1)
    elif token_type in [TokenType.EMAIL_VERIFICATION, TokenType.PHONE_VERIFICATION]:
        # 验证令牌15分钟
        return now + timedelta(minutes=15)
    elif token_type == TokenType.API_KEY:
        # API密钥1年
        return now + timedelta(days=365)
    else:
        # 默认1小时
        return now + timedelta(hours=1)

def create_auth_log(
    user_id: Optional[str],
    action: AuthAction,
    status: Literal["success", "failure", "pending"],
    ip_address: str,
    details: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
    user_agent: Optional[str] = None,
    device_info: Optional[Dict[str, Any]] = None,
    risk_score: float = 0.0,
    risk_factors: Optional[List[str]] = None
) -> AuthLogEntry:
    """创建认证日志条目"""
    return AuthLogEntry(
        user_id=user_id,
        action=action,
        status=status,
        ip_address=ip_address,
        details=details or {},
        error_message=error_message,
        user_agent=user_agent,
        device_info=device_info,
        risk_score=risk_score,
        risk_factors=risk_factors or []
    )

def validate_password_strength(password: str) -> Dict[str, Any]:
    """验证密码强度"""
    result = {
        "is_valid": True,
        "score": 0,
        "feedback": [],
        "requirements": {
            "min_length": len(password) >= 8,
            "has_uppercase": bool(re.search(r'[A-Z]', password)),
            "has_lowercase": bool(re.search(r'[a-z]', password)),
            "has_digit": bool(re.search(r'\d', password)),
            "has_special": bool(re.search(r'[@$!%*?&]', password)),
        }
    }
    
    # 计算得分
    score = sum(result["requirements"].values())
    result["score"] = score
    
    # 检查是否满足基本要求
    if not all(result["requirements"].values()):
        result["is_valid"] = False
        if not result["requirements"]["min_length"]:
            result["feedback"].append("密码长度至少需要8位")
        if not result["requirements"]["has_uppercase"]:
            result["feedback"].append("需要包含大写字母")
        if not result["requirements"]["has_lowercase"]:
            result["feedback"].append("需要包含小写字母")
        if not result["requirements"]["has_digit"]:
            result["feedback"].append("需要包含数字")
        if not result["requirements"]["has_special"]:
            result["feedback"].append("需要包含特殊字符")
    
    # 检查常见弱密码
    common_passwords = ["password", "123456", "qwerty", "admin", "root"]
    if password.lower() in common_passwords:
        result["is_valid"] = False
        result["feedback"].append("不能使用常见弱密码")
    
    return result

# 默认角色权限配置
DEFAULT_ROLE_PERMISSIONS = {
    UserRole.USER: RolePermissions(
        role=UserRole.USER,
        permissions=[
            "chat:basic",
            "profile:read",
            "profile:update",
            "session:manage"
        ],
        max_api_calls_per_hour=100,
        max_tokens_per_day=10000,
        max_sessions=3,
        allowed_features=["basic_chat", "profile_management"]
    ),
    UserRole.VIP: RolePermissions(
        role=UserRole.VIP,
        permissions=[
            "chat:basic",
            "chat:advanced",
            "profile:read",
            "profile:update",
            "session:manage",
            "voice:use",
            "emotion:advanced"
        ],
        inherited_roles=[UserRole.USER],
        max_api_calls_per_hour=500,
        max_tokens_per_day=50000,
        max_sessions=10,
        allowed_features=["basic_chat", "advanced_chat", "voice_interaction", "profile_management"]
    ),
    UserRole.ADMIN: RolePermissions(
        role=UserRole.ADMIN,
        permissions=[
            "*:*"  # 所有权限
        ],
        inherited_roles=[UserRole.VIP, UserRole.USER],
        allowed_features=["*"]  # 所有功能
    )
}
