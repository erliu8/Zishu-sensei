#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
用户数据模型 - Pydantic 接口层模型
提供完整的用户API接口数据验证和序列化
"""

from pydantic import BaseModel, Field, EmailStr, field_validator, model_validator
from typing import Optional, List, Any, Dict, Union, Literal
from datetime import datetime, timedelta
from enum import Enum
import uuid
import re

# 从认证模块导入基础枚举和模型
from .auth import (
    UserStatus,
    UserRole,
    AuthProvider,
    TokenType,
    AuthAction,
    LoginMethod,
    SessionStatus,
    BaseUserModel,
    UserProfile as AuthUserProfile,
    UserSecurity as AuthUserSecurity,
)

# ======================== 扩展枚举定义 ========================


class UserGender(str, Enum):
    """用户性别枚举"""

    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    PREFER_NOT_SAY = "prefer_not_say"


class ProfileVisibility(str, Enum):
    """档案可见性枚举"""

    PUBLIC = "public"  # 公开
    FRIENDS = "friends"  # 仅好友
    PRIVATE = "private"  # 私密


class NotificationChannel(str, Enum):
    """通知渠道枚举"""

    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    IN_APP = "in_app"
    WECHAT = "wechat"


class SubscriptionType(str, Enum):
    """订阅类型枚举"""

    FREE = "free"
    BASIC = "basic"
    PREMIUM = "premium"
    VIP = "vip"
    ENTERPRISE = "enterprise"


class UserPreference(str, Enum):
    """用户偏好枚举"""

    LANGUAGE = "language"
    TIMEZONE = "timezone"
    THEME = "theme"
    DATE_FORMAT = "date_format"
    TIME_FORMAT = "time_format"
    CHARACTER_STYLE = "character_style"
    INTERACTION_MODE = "interaction_mode"


# ======================== 基础模型 ========================


class UserProfileDetail(BaseModel):
    """详细用户档案模型"""

    # 基础信息
    nickname: Optional[str] = Field(
        None, min_length=1, max_length=50, description="用户昵称"
    )
    first_name: Optional[str] = Field(None, max_length=50, description="名字")
    last_name: Optional[str] = Field(None, max_length=50, description="姓氏")
    bio: Optional[str] = Field(None, max_length=500, description="个人简介")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    cover_image_url: Optional[str] = Field(None, description="封面图片URL")

    # 个人信息
    gender: Optional[UserGender] = Field(None, description="性别")
    birthday: Optional[datetime] = Field(None, description="生日")
    location: Optional[str] = Field(None, max_length=100, description="所在地区")
    website: Optional[str] = Field(None, description="个人网站")
    occupation: Optional[str] = Field(None, max_length=100, description="职业")
    company: Optional[str] = Field(None, max_length=100, description="公司")

    # 社交链接
    social_links: Dict[str, str] = Field(default_factory=dict, description="社交媒体链接")

    # 偏好设置
    language: str = Field(default="zh-CN", description="首选语言")
    timezone: str = Field(default="Asia/Shanghai", description="时区")
    theme: str = Field(default="light", description="主题偏好")
    date_format: str = Field(default="YYYY-MM-DD", description="日期格式")
    time_format: str = Field(default="24h", description="时间格式")

    # 隐私设置
    profile_visibility: ProfileVisibility = Field(
        default=ProfileVisibility.PUBLIC, description="档案可见性"
    )
    show_email: bool = Field(default=False, description="是否显示邮箱")
    show_phone: bool = Field(default=False, description="是否显示手机")
    show_last_seen: bool = Field(default=True, description="是否显示最后在线时间")
    allow_friend_requests: bool = Field(default=True, description="是否允许好友请求")

    # 通知设置
    email_notifications: bool = Field(default=True, description="邮件通知")
    sms_notifications: bool = Field(default=False, description="短信通知")
    push_notifications: bool = Field(default=True, description="推送通知")
    marketing_emails: bool = Field(default=False, description="营销邮件")

    # AI偏好设置
    preferred_character: Optional[str] = Field(
        None, max_length=100, description="偏好的AI角色"
    )
    interaction_style: Optional[str] = Field(None, max_length=50, description="交互风格偏好")
    voice_preference: Optional[str] = Field(None, description="语音偏好")

    # 验证器
    @field_validator("bio")
    @classmethod
    def validate_bio(cls, v):
        if v and len(v.strip()) == 0:
            return None
        return v

    @field_validator("social_links")
    @classmethod
    def validate_social_links(cls, v):
        if not isinstance(v, dict):
            return {}
        # 限制社交链接数量
        if len(v) > 10:
            raise ValueError("社交链接不能超过10个")
        return v

    @field_validator("website")
    @classmethod
    def validate_website(cls, v):
        if v:
            # 简单的URL验证
            if not re.match(r"^https?://", v):
                v = f"https://{v}"
            if not re.match(r"^https?://[^\s/$.?#].[^\s]*$", v):
                raise ValueError("网站URL格式不正确")
        return v


class UserSecurityInfo(BaseModel):
    """用户安全信息模型（脱敏版）"""

    password_updated_at: datetime = Field(..., description="密码更新时间")
    two_factor_enabled: bool = Field(default=False, description="是否启用两步验证")
    backup_codes_count: int = Field(default=0, description="备用验证码数量")
    has_recovery_email: bool = Field(default=False, description="是否设置恢复邮箱")
    security_questions_count: int = Field(default=0, description="安全问题数量")
    api_key_exists: bool = Field(default=False, description="是否有API密钥")
    api_key_last_used: Optional[datetime] = Field(None, description="API密钥最后使用时间")

    # 登录安全
    failed_login_attempts: int = Field(default=0, description="失败登录次数")
    last_failed_login: Optional[datetime] = Field(None, description="最后失败登录时间")
    account_locked_until: Optional[datetime] = Field(None, description="账户锁定到期时间")


class UserStatistics(BaseModel):
    """用户统计信息模型"""

    # 登录统计
    login_count: int = Field(default=0, description="总登录次数")
    last_login_at: Optional[datetime] = Field(None, description="最后登录时间")
    last_active_at: Optional[datetime] = Field(None, description="最后活跃时间")

    # 使用统计
    total_messages: int = Field(default=0, description="总消息数")
    total_tokens: int = Field(default=0, description="总token使用量")
    total_sessions: int = Field(default=0, description="总会话数")
    total_api_calls: int = Field(default=0, description="总API调用次数")

    # 今日使用
    api_calls_today: int = Field(default=0, description="今日API调用次数")
    tokens_used_today: int = Field(default=0, description="今日token使用量")
    messages_today: int = Field(default=0, description="今日消息数量")

    # 订阅信息
    subscription_plan: Optional[SubscriptionType] = Field(None, description="订阅计划")
    subscription_expires_at: Optional[datetime] = Field(None, description="订阅到期时间")
    subscription_auto_renew: bool = Field(default=False, description="是否自动续费")

    # 计算属性
    @property
    def days_since_registration(self) -> Optional[int]:
        """注册天数"""
        if hasattr(self, "created_at") and self.created_at:
            return (datetime.now() - self.created_at).days
        return None

    @property
    def is_subscription_active(self) -> bool:
        """订阅是否有效"""
        if not self.subscription_expires_at:
            return False
        return datetime.now() < self.subscription_expires_at


class UserBase(BaseModel):
    """用户基础模型"""

    id: str = Field(..., description="用户唯一ID")
    username: str = Field(..., min_length=3, max_length=30, description="用户名")
    email: Optional[EmailStr] = Field(None, description="邮箱地址")
    phone: Optional[str] = Field(None, description="手机号码")
    status: UserStatus = Field(default=UserStatus.PENDING, description="用户状态")
    role: UserRole = Field(default=UserRole.USER, description="用户角色")
    auth_provider: AuthProvider = Field(default=AuthProvider.LOCAL, description="认证提供商")
    provider_id: Optional[str] = Field(None, description="第三方提供商用户ID")

    # 时间戳
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    # 验证器
    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if not re.match(r"^[a-zA-Z0-9_\u4e00-\u9fff]+$", v):
            raise ValueError("用户名只能包含字母、数字、下划线和中文字符")
        return v.strip()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if v and not re.match(r"^1[3-9]\d{9}$", v):
            raise ValueError("手机号格式不正确")
        return v


class UserInfo(UserBase):
    """完整用户信息模型"""

    profile: UserProfileDetail = Field(
        default_factory=UserProfileDetail, description="用户档案"
    )
    security: Optional[UserSecurityInfo] = Field(None, description="安全信息")
    statistics: UserStatistics = Field(
        default_factory=UserStatistics, description="统计信息"
    )

    # 标签和分组
    tags: List[str] = Field(default_factory=list, description="用户标签")
    groups: List[str] = Field(default_factory=list, description="用户组")
    permissions: List[str] = Field(default_factory=list, description="用户权限")

    # 元数据
    metadata: Dict[str, Any] = Field(default_factory=dict, description="扩展元数据")

    # 验证器
    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v):
        if len(v) > 20:
            raise ValueError("用户标签不能超过20个")
        return v


class UserPublicInfo(BaseModel):
    """用户公开信息模型（用于显示给其他用户）"""

    id: str = Field(..., description="用户ID")
    username: str = Field(..., description="用户名")
    nickname: Optional[str] = Field(None, description="昵称")
    avatar_url: Optional[str] = Field(None, description="头像URL")
    bio: Optional[str] = Field(None, description="个人简介")
    location: Optional[str] = Field(None, description="位置")
    website: Optional[str] = Field(None, description="个人网站")
    social_links: Dict[str, str] = Field(default_factory=dict, description="社交链接")
    joined_at: datetime = Field(..., description="注册时间")
    last_seen: Optional[datetime] = Field(None, description="最后在线时间")
    status: UserStatus = Field(..., description="用户状态")

    # 根据隐私设置决定是否显示的字段将在业务逻辑中处理


# ======================== 请求模型 ========================


class UserCreateRequest(BaseModel):
    """创建用户请求模型"""

    username: str = Field(..., min_length=3, max_length=30, description="用户名")
    email: EmailStr = Field(..., description="邮箱地址")
    password: str = Field(..., min_length=8, max_length=128, description="密码")

    # 可选基础信息
    phone: Optional[str] = Field(None, description="手机号码")
    nickname: Optional[str] = Field(None, min_length=1, max_length=50, description="昵称")

    # 可选档案信息
    first_name: Optional[str] = Field(None, max_length=50, description="名字")
    last_name: Optional[str] = Field(None, max_length=50, description="姓氏")
    bio: Optional[str] = Field(None, max_length=500, description="个人简介")
    gender: Optional[UserGender] = Field(None, description="性别")
    birthday: Optional[datetime] = Field(None, description="生日")
    location: Optional[str] = Field(None, max_length=100, description="位置")

    # 偏好设置
    language: str = Field(default="zh-CN", description="首选语言")
    timezone: str = Field(default="Asia/Shanghai", description="时区")

    # 邀请和推荐
    invitation_code: Optional[str] = Field(None, description="邀请码")
    referral_code: Optional[str] = Field(None, description="推荐人代码")

    # 同意条款
    agree_to_terms: bool = Field(..., description="同意服务条款")
    agree_to_privacy: bool = Field(..., description="同意隐私政策")

    # 验证器
    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if not re.search(
            r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$", v
        ):
            raise ValueError("密码必须包含大小写字母、数字和特殊字符，长度至少8位")
        return v

    @model_validator(mode="after")
    def validate_agreements(self):
        if not self.agree_to_terms or not self.agree_to_privacy:
            raise ValueError("必须同意服务条款和隐私政策")
        return self


class UserUpdateRequest(BaseModel):
    """用户信息更新请求模型"""

    # 基础信息
    nickname: Optional[str] = Field(None, min_length=1, max_length=50, description="昵称")
    first_name: Optional[str] = Field(None, max_length=50, description="名字")
    last_name: Optional[str] = Field(None, max_length=50, description="姓氏")
    bio: Optional[str] = Field(None, max_length=500, description="个人简介")
    gender: Optional[UserGender] = Field(None, description="性别")
    birthday: Optional[datetime] = Field(None, description="生日")
    location: Optional[str] = Field(None, max_length=100, description="位置")
    website: Optional[str] = Field(None, description="个人网站")
    occupation: Optional[str] = Field(None, max_length=100, description="职业")
    company: Optional[str] = Field(None, max_length=100, description="公司")

    # 偏好设置
    language: Optional[str] = Field(None, description="首选语言")
    timezone: Optional[str] = Field(None, description="时区")
    theme: Optional[str] = Field(None, description="主题偏好")
    date_format: Optional[str] = Field(None, description="日期格式")
    time_format: Optional[str] = Field(None, description="时间格式")

    # AI偏好
    preferred_character: Optional[str] = Field(None, description="偏好的AI角色")
    interaction_style: Optional[str] = Field(None, description="交互风格")
    voice_preference: Optional[str] = Field(None, description="语音偏好")

    # 社交链接
    social_links: Optional[Dict[str, str]] = Field(None, description="社交链接")


class UserPrivacyUpdateRequest(BaseModel):
    """用户隐私设置更新请求"""

    profile_visibility: Optional[ProfileVisibility] = Field(None, description="档案可见性")
    show_email: Optional[bool] = Field(None, description="是否显示邮箱")
    show_phone: Optional[bool] = Field(None, description="是否显示手机")
    show_last_seen: Optional[bool] = Field(None, description="是否显示最后在线时间")
    allow_friend_requests: Optional[bool] = Field(None, description="是否允许好友请求")


class UserNotificationUpdateRequest(BaseModel):
    """用户通知设置更新请求"""

    email_notifications: Optional[bool] = Field(None, description="邮件通知")
    sms_notifications: Optional[bool] = Field(None, description="短信通知")
    push_notifications: Optional[bool] = Field(None, description="推送通知")
    marketing_emails: Optional[bool] = Field(None, description="营销邮件")

    # 具体通知类型
    notification_preferences: Optional[Dict[str, bool]] = Field(
        None, description="具体通知偏好"
    )


class UserAvatarUpdateRequest(BaseModel):
    """用户头像更新请求"""

    avatar_url: Optional[str] = Field(None, description="头像URL")
    cover_image_url: Optional[str] = Field(None, description="封面图片URL")


class UserContactUpdateRequest(BaseModel):
    """用户联系方式更新请求"""

    email: Optional[EmailStr] = Field(None, description="新邮箱地址")
    phone: Optional[str] = Field(None, description="新手机号码")
    verification_code: Optional[str] = Field(None, description="验证码")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if v and not re.match(r"^1[3-9]\d{9}$", v):
            raise ValueError("手机号格式不正确")
        return v


class UserPasswordUpdateRequest(BaseModel):
    """用户密码更新请求"""

    current_password: str = Field(..., description="当前密码")
    new_password: str = Field(..., min_length=8, max_length=128, description="新密码")
    confirm_password: str = Field(..., description="确认新密码")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v):
        if not re.search(
            r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$", v
        ):
            raise ValueError("密码必须包含大小写字母、数字和特殊字符，长度至少8位")
        return v

    @model_validator(mode="after")
    def validate_password_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("新密码和确认密码不匹配")
        if self.current_password == self.new_password:
            raise ValueError("新密码不能与当前密码相同")
        return self


class UserStatusUpdateRequest(BaseModel):
    """用户状态更新请求（管理员使用）"""

    status: UserStatus = Field(..., description="新用户状态")
    reason: Optional[str] = Field(None, max_length=200, description="状态变更原因")
    notify_user: bool = Field(default=True, description="是否通知用户")


class UserRoleUpdateRequest(BaseModel):
    """用户角色更新请求（管理员使用）"""

    role: UserRole = Field(..., description="新用户角色")
    reason: Optional[str] = Field(None, max_length=200, description="角色变更原因")
    notify_user: bool = Field(default=True, description="是否通知用户")


class UserQueryParams(BaseModel):
    """用户查询参数"""

    # 分页参数
    page: int = Field(default=1, ge=1, description="页码")
    size: int = Field(default=20, ge=1, le=100, description="每页大小")

    # 排序参数
    sort_by: Optional[str] = Field(default="created_at", description="排序字段")
    sort_order: Literal["asc", "desc"] = Field(default="desc", description="排序顺序")

    # 过滤参数
    status: Optional[List[UserStatus]] = Field(None, description="用户状态过滤")
    role: Optional[List[UserRole]] = Field(None, description="用户角色过滤")
    auth_provider: Optional[List[AuthProvider]] = Field(None, description="认证提供商过滤")

    # 搜索参数
    search: Optional[str] = Field(None, min_length=1, description="搜索关键词")
    email_domain: Optional[str] = Field(None, description="邮箱域名过滤")
    location: Optional[str] = Field(None, description="地区过滤")

    # 时间范围
    created_after: Optional[datetime] = Field(None, description="注册时间起始")
    created_before: Optional[datetime] = Field(None, description="注册时间结束")
    last_active_after: Optional[datetime] = Field(None, description="最后活跃时间起始")
    last_active_before: Optional[datetime] = Field(None, description="最后活跃时间结束")

    # 标签和分组
    tags: Optional[List[str]] = Field(None, description="标签过滤")
    groups: Optional[List[str]] = Field(None, description="用户组过滤")

    # 包含字段控制
    include_profile: bool = Field(default=True, description="是否包含档案信息")
    include_statistics: bool = Field(default=False, description="是否包含统计信息")
    include_security: bool = Field(default=False, description="是否包含安全信息")


class UserBatchOperationRequest(BaseModel):
    """用户批量操作请求"""

    user_ids: List[str] = Field(..., min_length=1, max_length=100, description="用户ID列表")
    operation: Literal[
        "activate",
        "deactivate",
        "suspend",
        "delete",
        "export",
        "send_notification",
        "update_role",
        "add_tags",
        "remove_tags",
    ] = Field(..., description="操作类型")
    parameters: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="操作参数"
    )
    reason: Optional[str] = Field(None, max_length=200, description="操作原因")
    notify_users: bool = Field(default=False, description="是否通知用户")


# ======================== 响应模型 ========================


class UserResponse(BaseModel):
    """单用户响应模型"""

    success: bool = Field(..., description="操作是否成功")
    message: str = Field(..., description="响应消息")
    user: Optional[UserInfo] = Field(None, description="用户信息")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")


class UserListResponse(BaseModel):
    """用户列表响应模型"""

    success: bool = Field(..., description="操作是否成功")
    message: str = Field(..., description="响应消息")
    users: List[UserInfo] = Field(..., description="用户列表")

    # 分页信息
    total: int = Field(..., description="总用户数")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页大小")
    pages: int = Field(..., description="总页数")

    # 统计信息
    filters_applied: Dict[str, Any] = Field(default_factory=dict, description="应用的过滤条件")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")


class UserPublicResponse(BaseModel):
    """用户公开信息响应模型"""

    success: bool = Field(..., description="操作是否成功")
    user: UserPublicInfo = Field(..., description="用户公开信息")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")


class UserStatsResponse(BaseModel):
    """用户统计响应模型"""

    success: bool = Field(..., description="操作是否成功")
    stats: UserStatistics = Field(..., description="用户统计信息")

    # 扩展统计
    usage_trends: Optional[Dict[str, Any]] = Field(None, description="使用趋势")
    comparison: Optional[Dict[str, Any]] = Field(None, description="对比数据")
    recommendations: List[str] = Field(default_factory=list, description="使用建议")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")


class UserActivityResponse(BaseModel):
    """用户活动响应模型"""

    success: bool = Field(..., description="操作是否成功")
    activities: List[Dict[str, Any]] = Field(..., description="活动记录")
    total: int = Field(..., description="总活动数")
    page: int = Field(..., description="当前页码")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")


class UserBatchOperationResponse(BaseModel):
    """批量操作响应模型"""

    success: bool = Field(..., description="整体操作是否成功")
    operation: str = Field(..., description="操作类型")
    total_count: int = Field(..., description="总操作数")
    success_count: int = Field(..., description="成功数")
    failed_count: int = Field(..., description="失败数")

    # 详细结果
    results: List[Dict[str, Any]] = Field(..., description="详细操作结果")
    errors: List[str] = Field(default_factory=list, description="错误列表")

    execution_time: float = Field(..., description="执行时间（秒）")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")


class UserValidationResponse(BaseModel):
    """用户验证响应模型"""

    success: bool = Field(..., description="验证是否成功")
    field: str = Field(..., description="验证字段")
    valid: bool = Field(..., description="是否有效")
    message: str = Field(..., description="验证消息")
    suggestions: List[str] = Field(default_factory=list, description="建议")
    timestamp: datetime = Field(default_factory=datetime.now, description="响应时间")


class SystemUserStatsResponse(BaseModel):
    """系统用户统计响应模型"""

    success: bool = Field(..., description="操作是否成功")

    # 总体统计
    total_users: int = Field(..., description="总用户数")
    active_users: int = Field(..., description="活跃用户数")
    new_users_today: int = Field(..., description="今日新增用户")
    new_users_this_week: int = Field(..., description="本周新增用户")
    new_users_this_month: int = Field(..., description="本月新增用户")

    # 状态分布
    status_distribution: Dict[UserStatus, int] = Field(..., description="用户状态分布")
    role_distribution: Dict[UserRole, int] = Field(..., description="用户角色分布")
    provider_distribution: Dict[AuthProvider, int] = Field(..., description="认证提供商分布")

    # 地理分布
    location_distribution: Dict[str, int] = Field(
        default_factory=dict, description="地区分布"
    )

    # 趋势数据
    growth_trend: List[Dict[str, Any]] = Field(default_factory=list, description="增长趋势")
    activity_trend: List[Dict[str, Any]] = Field(
        default_factory=list, description="活跃趋势"
    )

    timestamp: datetime = Field(default_factory=datetime.now, description="统计时间")


# ======================== 工具函数 ========================


def validate_user_permissions(
    user_role: UserRole, required_permissions: List[str]
) -> bool:
    """验证用户权限"""
    # 从认证模块导入权限配置
    from .auth import DEFAULT_ROLE_PERMISSIONS

    role_perms = DEFAULT_ROLE_PERMISSIONS.get(user_role)
    if not role_perms:
        return False

    # 超级管理员拥有所有权限
    if user_role == UserRole.SUPER_ADMIN:
        return True

    # 检查权限
    for perm in required_permissions:
        if perm not in role_perms.permissions and "*:*" not in role_perms.permissions:
            return False

    return True


def generate_username_suggestions(base_username: str, count: int = 5) -> List[str]:
    """生成用户名建议"""
    suggestions = []

    # 清理基础用户名
    clean_base = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]", "", base_username)

    # 生成建议
    for i in range(count):
        if i == 0:
            suggestions.append(clean_base)
        elif i <= 3:
            suggestions.append(f"{clean_base}{i + 1}")
        else:
            import random

            suggestions.append(f"{clean_base}{random.randint(100, 999)}")

    return suggestions


def calculate_user_score(user: UserInfo) -> Dict[str, float]:
    """计算用户评分"""
    scores = {
        "profile_completeness": 0.0,
        "activity_level": 0.0,
        "engagement": 0.0,
        "overall": 0.0,
    }

    # 档案完整度评分
    profile_fields = [
        user.profile.nickname,
        user.profile.bio,
        user.profile.avatar_url,
        user.profile.location,
        user.profile.birthday,
    ]
    completed_fields = sum(1 for field in profile_fields if field)
    scores["profile_completeness"] = completed_fields / len(profile_fields)

    # 活跃度评分（基于最后活跃时间）
    if user.statistics.last_active_at:
        days_inactive = (datetime.now() - user.statistics.last_active_at).days
        scores["activity_level"] = max(0, 1 - (days_inactive / 30))  # 30天内活跃为1分

    # 参与度评分（基于消息数量和会话数）
    if user.statistics.total_messages > 0:
        scores["engagement"] = min(
            1.0, user.statistics.total_messages / 100
        )  # 100条消息为满分

    # 综合评分
    scores["overall"] = (
        scores["profile_completeness"] * 0.3
        + scores["activity_level"] * 0.4
        + scores["engagement"] * 0.3
    )

    return scores


def format_user_display_name(user: UserInfo) -> str:
    """格式化用户显示名称"""
    if user.profile.nickname:
        return user.profile.nickname
    elif user.profile.first_name or user.profile.last_name:
        return f"{user.profile.first_name or ''} {user.profile.last_name or ''}".strip()
    else:
        return user.username


def check_username_availability(username: str) -> Dict[str, Any]:
    """检查用户名可用性（模拟函数，实际需要查询数据库）"""
    # 基础格式验证
    if not re.match(r"^[a-zA-Z0-9_\u4e00-\u9fff]+$", username):
        return {
            "available": False,
            "reason": "用户名只能包含字母、数字、下划线和中文字符",
            "suggestions": generate_username_suggestions(username),
        }

    if len(username) < 3 or len(username) > 30:
        return {
            "available": False,
            "reason": "用户名长度必须在3-30个字符之间",
            "suggestions": generate_username_suggestions(username),
        }

    # 保留词检查
    reserved_words = ["admin", "root", "system", "api", "www", "mail", "ftp"]
    if username.lower() in reserved_words:
        return {
            "available": False,
            "reason": "该用户名为保留词，不可使用",
            "suggestions": generate_username_suggestions(username),
        }

    # 模拟数据库查询
    # 实际实现中需要查询数据库
    return {"available": True, "reason": "用户名可用"}


def create_user_activity_log(
    user_id: str, action: str, details: Dict[str, Any]
) -> Dict[str, Any]:
    """创建用户活动日志"""
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "details": details,
        "timestamp": datetime.now(),
        "ip_address": details.get("ip_address"),
        "user_agent": details.get("user_agent"),
    }


# ======================== 默认配置 ========================

DEFAULT_USER_PREFERENCES = {
    "language": "zh-CN",
    "timezone": "Asia/Shanghai",
    "theme": "light",
    "date_format": "YYYY-MM-DD",
    "time_format": "24h",
}

DEFAULT_PRIVACY_SETTINGS = {
    "profile_visibility": ProfileVisibility.PUBLIC,
    "show_email": False,
    "show_phone": False,
    "show_last_seen": True,
    "allow_friend_requests": True,
}

DEFAULT_NOTIFICATION_SETTINGS = {
    "email_notifications": True,
    "sms_notifications": False,
    "push_notifications": True,
    "marketing_emails": False,
}

# 用户名建议模板
USERNAME_SUGGESTION_TEMPLATES = [
    "{base}",
    "{base}{number}",
    "{base}_{number}",
    "{base}_{adjective}",
    "{adjective}_{base}",
]

USERNAME_ADJECTIVES = [
    "cool",
    "smart",
    "happy",
    "lucky",
    "super",
    "great",
    "awesome",
    "best",
]
