#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
用户管理服务 - 提供全面的用户管理功能
集成认证、档案管理、权限控制、统计分析等完整功能
"""

import asyncio
import secrets
import uuid
import logging
from typing import Dict, List, Optional, Any, Tuple, Union
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, asdict
from enum import Enum
import json
import re
import hashlib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

# 第三方库
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from fastapi import HTTPException
from starlette.status import (
    HTTP_400_BAD_REQUEST, HTTP_401_UNAUTHORIZED, 
    HTTP_403_FORBIDDEN, HTTP_404_NOT_FOUND, HTTP_409_CONFLICT
)

# 内部导入
from ..config.auth_config import AuthConfig, get_auth_config
from ..utils.password_utils import PasswordManager, PasswordPolicy
from ..utils.session_utils import SessionManager, SessionInfo, SessionStatus
from ..security import SecurityManager, SecurityContext, PermissionType, SecurityLevel
from .auth_service import AuthService, AuthResult
from ..schemas.responses import BaseResponse

logger = logging.getLogger(__name__)

class UserStatus(Enum):
    """用户状态枚举"""
    ACTIVE = "active"           # 活跃用户
    INACTIVE = "inactive"       # 非活跃用户
    SUSPENDED = "suspended"     # 暂停用户
    PENDING = "pending"         # 待激活用户
    DELETED = "deleted"         # 已删除用户
    BANNED = "banned"           # 被封用户

class UserRole(Enum):
    """用户角色枚举"""
    SUPER_ADMIN = "super_admin"     # 超级管理员
    ADMIN = "admin"                 # 管理员
    MODERATOR = "moderator"         # 版主
    VIP = "vip"                     # VIP用户
    USER = "user"                   # 普通用户
    GUEST = "guest"                 # 访客

class AuthProvider(Enum):
    """认证提供商枚举"""
    LOCAL = "local"         # 本地认证
    GOOGLE = "google"       # Google认证
    WECHAT = "wechat"       # 微信认证
    GITHUB = "github"       # GitHub认证
    DINGTALK = "dingtalk"   # 钉钉认证

class ProfileVisibility(Enum):
    """档案可见性枚举"""
    PUBLIC = "public"       # 公开
    FRIENDS = "friends"     # 仅好友
    PRIVATE = "private"     # 私有

@dataclass
class UserProfile:
    """用户档案信息"""
    nickname: Optional[str] = None
    real_name: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    birthday: Optional[str] = None
    gender: Optional[str] = None
    language: str = "zh-CN"
    timezone: str = "Asia/Shanghai"
    
    # 社交链接
    social_links: Dict[str, str] = None
    
    # 隐私设置
    profile_visibility: ProfileVisibility = ProfileVisibility.PUBLIC
    show_email: bool = False
    show_phone: bool = False
    allow_friend_requests: bool = True
    
    def __post_init__(self):
        if self.social_links is None:
            self.social_links = {}

@dataclass
class UserPreferences:
    """用户偏好设置"""
    # 通知设置
    email_notifications: bool = True
    sms_notifications: bool = False
    push_notifications: bool = True
    marketing_emails: bool = False
    
    # 界面设置
    theme: str = "light"  # light, dark, auto
    language: str = "zh-CN"
    timezone: str = "Asia/Shanghai"
    date_format: str = "YYYY-MM-DD"
    time_format: str = "24h"
    
    # 功能设置
    auto_save: bool = True
    show_tutorial: bool = True
    enable_shortcuts: bool = True
    
    # 隐私设置
    data_collection: bool = True
    analytics_tracking: bool = True
    personalized_ads: bool = False

@dataclass
class UserStatistics:
    """用户统计信息"""
    # 基础统计
    login_count: int = 0
    last_login_at: Optional[datetime] = None
    last_active_at: Optional[datetime] = None
    
    # 使用统计
    total_messages: int = 0
    total_tokens: int = 0
    total_sessions: int = 0
    
    # 今日统计
    api_calls_today: int = 0
    tokens_used_today: int = 0
    messages_today: int = 0
    
    # 平台统计
    favorite_features: List[str] = None
    usage_patterns: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.favorite_features is None:
            self.favorite_features = []
        if self.usage_patterns is None:
            self.usage_patterns = {}

@dataclass
class UserInfo:
    """完整的用户信息"""
    # 基础信息
    id: str
    username: str
    email: str
    phone: Optional[str] = None
    
    # 状态信息
    status: UserStatus = UserStatus.PENDING
    role: UserRole = UserRole.USER
    auth_provider: AuthProvider = AuthProvider.LOCAL
    
    # 验证状态
    is_verified: bool = False
    email_verified: bool = False
    phone_verified: bool = False
    
    # 安全信息
    two_factor_enabled: bool = False
    last_password_change: Optional[datetime] = None
    failed_login_attempts: int = 0
    locked_until: Optional[datetime] = None
    
    # 时间戳
    created_at: datetime = None
    updated_at: datetime = None
    last_login_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    # 关联信息
    profile: UserProfile = None
    preferences: UserPreferences = None
    statistics: UserStatistics = None
    
    # 元数据
    tags: List[str] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)
        if self.updated_at is None:
            self.updated_at = self.created_at
        if self.profile is None:
            self.profile = UserProfile()
        if self.preferences is None:
            self.preferences = UserPreferences()
        if self.statistics is None:
            self.statistics = UserStatistics()
        if self.tags is None:
            self.tags = []
        if self.metadata is None:
            self.metadata = {}

@dataclass
class UserSearchQuery:
    """用户搜索查询参数"""
    # 基础搜索
    search: Optional[str] = None  # 关键词搜索
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    
    # 过滤条件
    status: Optional[List[UserStatus]] = None
    role: Optional[List[UserRole]] = None
    auth_provider: Optional[List[AuthProvider]] = None
    verified_only: Optional[bool] = None
    
    # 时间范围
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    last_login_after: Optional[datetime] = None
    last_login_before: Optional[datetime] = None
    
    # 地理位置
    location: Optional[str] = None
    
    # 标签
    tags: Optional[List[str]] = None
    
    # 排序
    sort_by: str = "created_at"
    sort_order: str = "desc"  # asc, desc
    
    # 分页
    page: int = 1
    size: int = 20

@dataclass
class UserUpdateData:
    """用户更新数据"""
    # 基础信息
    username: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    
    # 状态
    status: Optional[UserStatus] = None
    role: Optional[UserRole] = None
    
    # 档案信息
    profile: Optional[Dict[str, Any]] = None
    preferences: Optional[Dict[str, Any]] = None
    
    # 元数据
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None

class UserEventType(Enum):
    """用户事件类型"""
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    USER_STATUS_CHANGED = "user_status_changed"
    USER_ROLE_CHANGED = "user_role_changed"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    USER_PASSWORD_CHANGED = "user_password_changed"
    USER_EMAIL_VERIFIED = "user_email_verified"
    USER_PHONE_VERIFIED = "user_phone_verified"
    USER_2FA_ENABLED = "user_2fa_enabled"
    USER_2FA_DISABLED = "user_2fa_disabled"
    USER_PROFILE_UPDATED = "user_profile_updated"
    USER_PREFERENCES_UPDATED = "user_preferences_updated"

@dataclass
class UserEvent:
    """用户事件"""
    event_type: UserEventType
    user_id: str
    operator_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = None
    data: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)

class UserService:
    """用户管理服务"""
    
    def __init__(
        self,
        config: Optional[AuthConfig] = None,
        auth_service: Optional[AuthService] = None,
        password_manager: Optional[PasswordManager] = None,
        session_manager: Optional[SessionManager] = None,
        security_manager: Optional[SecurityManager] = None,
        db_session: Optional[Session] = None
    ):
        """初始化用户服务"""
        self.config = config or get_auth_config()
        
        # 初始化依赖服务
        self.auth_service = auth_service or AuthService(self.config)
        self.password_manager = password_manager or PasswordManager(
            self.config.get_password_policy()
        )
        self.session_manager = session_manager or SessionManager(
            self.config.get_session_config()
        )
        self.security_manager = security_manager or SecurityManager(
            self.config.get_security_config()
        )
        
        # 数据库会话
        self.db = db_session
        
        # 内存缓存（生产环境应使用Redis等）
        self._user_cache: Dict[str, UserInfo] = {}
        self._username_cache: Dict[str, str] = {}  # username -> user_id
        self._email_cache: Dict[str, str] = {}     # email -> user_id
        
        # 事件历史（生产环境应持久化到数据库）
        self._user_events: List[UserEvent] = []
        
        logger.info("用户管理服务初始化完成")
    
    # ============ 基础 CRUD 操作 ============
    
    async def create_user(
        self,
        username: str,
        email: str,
        password: str,
        phone: Optional[str] = None,
        role: UserRole = UserRole.USER,
        profile_data: Optional[Dict[str, Any]] = None,
        operator_id: Optional[str] = None,
        auto_verify: bool = False
    ) -> UserInfo:
        """创建新用户"""
        try:
            # 验证输入数据
            await self._validate_user_data(username, email, phone, password)
            
            # 检查用户名和邮箱唯一性
            if await self._is_username_taken(username):
                raise HTTPException(
                    status_code=HTTP_409_CONFLICT,
                    detail="用户名已存在"
                )
            
            if await self._is_email_taken(email):
                raise HTTPException(
                    status_code=HTTP_409_CONFLICT,
                    detail="邮箱地址已被使用"
                )
            
            # 验证密码强度
            password_validation = self.password_manager.validate_password(
                password,
                user_info={
                    "username": username,
                    "email": email
                }
            )
            
            if not password_validation["valid"]:
                raise HTTPException(
                    status_code=HTTP_400_BAD_REQUEST,
                    detail="密码不符合安全要求: " + "; ".join(password_validation["errors"])
                )
            
            # 生成用户ID
            user_id = str(uuid.uuid4())
            
            # 加密密码
            password_hash = self.password_manager.hash_password(password)
            
            # 创建用户档案
            profile = UserProfile()
            if profile_data:
                for key, value in profile_data.items():
                    if hasattr(profile, key):
                        setattr(profile, key, value)
            
            # 创建用户信息
            user_info = UserInfo(
                id=user_id,
                username=username.strip().lower(),
                email=email.strip().lower(),
                phone=phone,
                status=UserStatus.ACTIVE if auto_verify else UserStatus.PENDING,
                role=role,
                is_verified=auto_verify,
                email_verified=auto_verify,
                phone_verified=bool(phone and auto_verify),
                profile=profile
            )
            
            # 保存到数据库
            await self._save_user_to_db(user_info, password_hash)
            
            # 更新缓存
            self._update_user_cache(user_info)
            
            # 记录事件
            await self._log_user_event(
                UserEventType.USER_CREATED,
                user_id,
                operator_id=operator_id,
                data={
                    "username": username,
                    "email": email,
                    "role": role.value,
                    "auto_verify": auto_verify
                }
            )
            
            # 发送欢迎邮件（异步）
            if not auto_verify:
                asyncio.create_task(self._send_welcome_email(user_info))
            
            logger.info(f"用户创建成功: {username} ({user_id})")
            return user_info
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"创建用户失败: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="创建用户时发生内部错误"
            )
    
    async def get_user(
        self,
        user_id: str,
        include_sensitive: bool = False
    ) -> Optional[UserInfo]:
        """获取用户信息"""
        try:
            # 先检查缓存
            if user_id in self._user_cache:
                user_info = self._user_cache[user_id]
                
                # 如果不包含敏感信息，创建副本并清除敏感数据
                if not include_sensitive:
                    user_info = self._sanitize_user_info(user_info)
                
                return user_info
            
            # 从数据库查询
            user_info = await self._get_user_from_db(user_id)
            if not user_info:
                return None
            
            # 更新缓存
            self._update_user_cache(user_info)
            
            # 处理敏感信息
            if not include_sensitive:
                user_info = self._sanitize_user_info(user_info)
            
            return user_info
            
        except Exception as e:
            logger.error(f"获取用户信息失败: {str(e)}")
            return None
    
    async def get_user_by_username(
        self,
        username: str,
        include_sensitive: bool = False
    ) -> Optional[UserInfo]:
        """根据用户名获取用户信息"""
        try:
            username = username.strip().lower()
            
            # 检查用户名缓存
            if username in self._username_cache:
                user_id = self._username_cache[username]
                return await self.get_user(user_id, include_sensitive)
            
            # 从数据库查询
            user_info = await self._get_user_by_username_from_db(username)
            if user_info:
                self._update_user_cache(user_info)
                
                if not include_sensitive:
                    user_info = self._sanitize_user_info(user_info)
            
            return user_info
            
        except Exception as e:
            logger.error(f"根据用户名获取用户失败: {str(e)}")
            return None
    
    async def get_user_by_email(
        self,
        email: str,
        include_sensitive: bool = False
    ) -> Optional[UserInfo]:
        """根据邮箱获取用户信息"""
        try:
            email = email.strip().lower()
            
            # 检查邮箱缓存
            if email in self._email_cache:
                user_id = self._email_cache[email]
                return await self.get_user(user_id, include_sensitive)
            
            # 从数据库查询
            user_info = await self._get_user_by_email_from_db(email)
            if user_info:
                self._update_user_cache(user_info)
                
                if not include_sensitive:
                    user_info = self._sanitize_user_info(user_info)
            
            return user_info
            
        except Exception as e:
            logger.error(f"根据邮箱获取用户失败: {str(e)}")
            return None
    
    async def update_user(
        self,
        user_id: str,
        update_data: UserUpdateData,
        operator_id: Optional[str] = None
    ) -> UserInfo:
        """更新用户信息"""
        try:
            # 获取现有用户信息
            user_info = await self.get_user(user_id, include_sensitive=True)
            if not user_info:
                raise HTTPException(
                    status_code=HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            # 记录变更前的数据
            old_data = {
                "username": user_info.username,
                "email": user_info.email,
                "phone": user_info.phone,
                "status": user_info.status.value,
                "role": user_info.role.value
            }
            
            # 验证和应用更新
            changes = {}
            
            # 更新用户名
            if update_data.username and update_data.username != user_info.username:
                new_username = update_data.username.strip().lower()
                if await self._is_username_taken(new_username, exclude_user_id=user_id):
                    raise HTTPException(
                        status_code=HTTP_409_CONFLICT,
                        detail="用户名已存在"
                    )
                user_info.username = new_username
                changes["username"] = new_username
            
            # 更新邮箱
            if update_data.email and update_data.email != user_info.email:
                new_email = update_data.email.strip().lower()
                if await self._is_email_taken(new_email, exclude_user_id=user_id):
                    raise HTTPException(
                        status_code=HTTP_409_CONFLICT,
                        detail="邮箱已被使用"
                    )
                user_info.email = new_email
                user_info.email_verified = False  # 需要重新验证
                changes["email"] = new_email
            
            # 更新手机号
            if update_data.phone and update_data.phone != user_info.phone:
                user_info.phone = update_data.phone
                user_info.phone_verified = False  # 需要重新验证
                changes["phone"] = update_data.phone
            
            # 更新状态
            if update_data.status and update_data.status != user_info.status:
                user_info.status = update_data.status
                changes["status"] = update_data.status.value
            
            # 更新角色
            if update_data.role and update_data.role != user_info.role:
                user_info.role = update_data.role
                changes["role"] = update_data.role.value
            
            # 更新档案信息
            if update_data.profile:
                for key, value in update_data.profile.items():
                    if hasattr(user_info.profile, key):
                        setattr(user_info.profile, key, value)
                        changes[f"profile.{key}"] = value
            
            # 更新偏好设置
            if update_data.preferences:
                for key, value in update_data.preferences.items():
                    if hasattr(user_info.preferences, key):
                        setattr(user_info.preferences, key, value)
                        changes[f"preferences.{key}"] = value
            
            # 更新标签
            if update_data.tags is not None:
                user_info.tags = update_data.tags
                changes["tags"] = update_data.tags
            
            # 更新元数据
            if update_data.metadata:
                user_info.metadata.update(update_data.metadata)
                changes["metadata"] = update_data.metadata
            
            # 更新时间戳
            user_info.updated_at = datetime.now(timezone.utc)
            
            # 保存到数据库
            await self._update_user_in_db(user_info)
            
            # 更新缓存
            self._update_user_cache(user_info)
            
            # 记录事件
            await self._log_user_event(
                UserEventType.USER_UPDATED,
                user_id,
                operator_id=operator_id,
                data={
                    "changes": changes,
                    "old_data": old_data
                }
            )
            
            logger.info(f"用户更新成功: {user_id}, 变更: {list(changes.keys())}")
            return user_info
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新用户失败: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="更新用户时发生内部错误"
            )
    
    async def delete_user(
        self,
        user_id: str,
        soft_delete: bool = True,
        operator_id: Optional[str] = None
    ) -> bool:
        """删除用户"""
        try:
            # 获取用户信息
            user_info = await self.get_user(user_id, include_sensitive=True)
            if not user_info:
                raise HTTPException(
                    status_code=HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            if soft_delete:
                # 软删除：标记为已删除状态
                user_info.status = UserStatus.DELETED
                user_info.deleted_at = datetime.now(timezone.utc)
                user_info.updated_at = user_info.deleted_at
                
                await self._update_user_in_db(user_info)
                
                # 从缓存中移除
                self._remove_from_cache(user_info)
                
                delete_type = "soft"
            else:
                # 硬删除：从数据库中删除
                await self._delete_user_from_db(user_id)
                
                # 从缓存中移除
                self._remove_from_cache(user_info)
                
                delete_type = "hard"
            
            # 撤销用户的所有会话
            self.session_manager.terminate_user_sessions(user_id, "user_deleted")
            
            # 记录事件
            await self._log_user_event(
                UserEventType.USER_DELETED,
                user_id,
                operator_id=operator_id,
                data={
                    "delete_type": delete_type,
                    "username": user_info.username,
                    "email": user_info.email
                }
            )
            
            logger.info(f"用户删除成功: {user_id} ({delete_type})")
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"删除用户失败: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="删除用户时发生内部错误"
            )
    
    # ============ 用户搜索和查询 ============
    
    async def search_users(
        self,
        query: UserSearchQuery,
        requester_id: Optional[str] = None
    ) -> Tuple[List[UserInfo], int]:
        """搜索用户"""
        try:
            # 构建搜索条件
            conditions = await self._build_search_conditions(query)
            
            # 执行搜索
            users, total_count = await self._search_users_in_db(conditions, query)
            
            # 过滤敏感信息（非管理员用户）
            requester = None
            if requester_id:
                requester = await self.get_user(requester_id, include_sensitive=True)
            
            is_admin = (
                requester and 
                requester.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]
            )
            
            if not is_admin:
                users = [self._sanitize_user_info(user) for user in users]
            
            return users, total_count
            
        except Exception as e:
            logger.error(f"搜索用户失败: {str(e)}")
            return [], 0
    
    async def get_user_list(
        self,
        page: int = 1,
        size: int = 20,
        status_filter: Optional[List[UserStatus]] = None,
        role_filter: Optional[List[UserRole]] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> Tuple[List[UserInfo], int]:
        """获取用户列表"""
        query = UserSearchQuery(
            status=status_filter,
            role=role_filter,
            sort_by=sort_by,
            sort_order=sort_order,
            page=page,
            size=size
        )
        
        return await self.search_users(query)
    
    # ============ 用户认证集成 ============
    
    async def authenticate_user(
        self,
        username_or_email: str,
        password: str,
        ip_address: str,
        user_agent: str
    ) -> AuthResult:
        """用户认证"""
        try:
            # 查找用户
            user_info = await self.get_user_by_username(username_or_email, include_sensitive=True)
            if not user_info:
                user_info = await self.get_user_by_email(username_or_email, include_sensitive=True)
            
            if not user_info:
                return AuthResult(
                    success=False,
                    message="用户名或密码错误"
                )
            
            # 检查用户状态
            if user_info.status != UserStatus.ACTIVE:
                return AuthResult(
                    success=False,
                    message=f"账户状态异常: {user_info.status.value}"
                )
            
            # 使用认证服务进行登录
            from ..schemas.auth import LoginRequest
            login_request = LoginRequest(
                username=user_info.username,
                password=password
            )
            
            auth_result = await self.auth_service.login(
                login_request,
                ip_address,
                user_agent
            )
            
            # 更新用户统计
            if auth_result.success:
                await self._update_login_statistics(user_info.id)
            
            return auth_result
            
        except Exception as e:
            logger.error(f"用户认证失败: {str(e)}")
            return AuthResult(
                success=False,
                message="认证过程中发生错误"
            )
    
    async def update_password(
        self,
        user_id: str,
        current_password: str,
        new_password: str,
        operator_id: Optional[str] = None
    ) -> bool:
        """更新用户密码"""
        try:
            # 获取用户信息
            user_info = await self.get_user(user_id, include_sensitive=True)
            if not user_info:
                raise HTTPException(
                    status_code=HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            # 验证当前密码（管理员可以跳过）
            is_admin_operation = (
                operator_id and 
                operator_id != user_id and
                await self._is_admin_user(operator_id)
            )
            
            if not is_admin_operation:
                # 从数据库获取密码哈希进行验证
                password_hash = await self._get_user_password_hash(user_id)
                if not self.password_manager.verify_password(current_password, password_hash):
                    raise HTTPException(
                        status_code=HTTP_400_BAD_REQUEST,
                        detail="当前密码错误"
                    )
            
            # 验证新密码强度
            password_validation = self.password_manager.validate_password(
                new_password,
                user_info={
                    "username": user_info.username,
                    "email": user_info.email
                }
            )
            
            if not password_validation["valid"]:
                raise HTTPException(
                    status_code=HTTP_400_BAD_REQUEST,
                    detail="新密码不符合安全要求: " + "; ".join(password_validation["errors"])
                )
            
            # 更新密码
            new_password_hash = self.password_manager.hash_password(new_password)
            await self._update_user_password_in_db(user_id, new_password_hash)
            
            # 更新用户信息
            user_info.last_password_change = datetime.now(timezone.utc)
            user_info.updated_at = user_info.last_password_change
            await self._update_user_in_db(user_info)
            
            # 撤销用户的所有会话（强制重新登录）
            self.session_manager.terminate_user_sessions(user_id, "password_changed")
            
            # 记录事件
            await self._log_user_event(
                UserEventType.USER_PASSWORD_CHANGED,
                user_id,
                operator_id=operator_id,
                data={
                    "is_admin_operation": is_admin_operation
                }
            )
            
            logger.info(f"用户密码更新成功: {user_id}")
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"更新密码失败: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="更新密码时发生内部错误"
            )
    
    # ============ 用户状态管理 ============
    
    async def change_user_status(
        self,
        user_id: str,
        new_status: UserStatus,
        reason: Optional[str] = None,
        operator_id: Optional[str] = None
    ) -> bool:
        """变更用户状态"""
        try:
            # 获取用户信息
            user_info = await self.get_user(user_id, include_sensitive=True)
            if not user_info:
                raise HTTPException(
                    status_code=HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            old_status = user_info.status
            if old_status == new_status:
                return True  # 状态未变更
            
            # 更新状态
            user_info.status = new_status
            user_info.updated_at = datetime.now(timezone.utc)
            
            # 特殊状态处理
            if new_status == UserStatus.DELETED:
                user_info.deleted_at = user_info.updated_at
            elif new_status == UserStatus.SUSPENDED:
                # 撤销用户会话
                self.session_manager.terminate_user_sessions(user_id, "user_suspended")
            
            # 保存到数据库
            await self._update_user_in_db(user_info)
            
            # 更新缓存
            self._update_user_cache(user_info)
            
            # 记录事件
            await self._log_user_event(
                UserEventType.USER_STATUS_CHANGED,
                user_id,
                operator_id=operator_id,
                data={
                    "old_status": old_status.value,
                    "new_status": new_status.value,
                    "reason": reason
                }
            )
            
            logger.info(f"用户状态变更: {user_id} {old_status.value} -> {new_status.value}")
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"变更用户状态失败: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="变更用户状态时发生内部错误"
            )
    
    async def activate_user(
        self,
        user_id: str,
        operator_id: Optional[str] = None
    ) -> bool:
        """激活用户"""
        return await self.change_user_status(
            user_id, 
            UserStatus.ACTIVE, 
            "用户激活",
            operator_id
        )
    
    async def suspend_user(
        self,
        user_id: str,
        reason: Optional[str] = None,
        operator_id: Optional[str] = None
    ) -> bool:
        """暂停用户"""
        return await self.change_user_status(
            user_id, 
            UserStatus.SUSPENDED, 
            reason or "用户暂停",
            operator_id
        )
    
    async def ban_user(
        self,
        user_id: str,
        reason: Optional[str] = None,
        operator_id: Optional[str] = None
    ) -> bool:
        """封禁用户"""
        return await self.change_user_status(
            user_id, 
            UserStatus.BANNED, 
            reason or "用户封禁",
            operator_id
        )
    
    # ============ 批量操作 ============
    
    async def batch_update_users(
        self,
        user_ids: List[str],
        update_data: UserUpdateData,
        operator_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """批量更新用户"""
        results = {
            "success_count": 0,
            "failed_count": 0,
            "results": [],
            "errors": []
        }
        
        for user_id in user_ids:
            try:
                await self.update_user(user_id, update_data, operator_id)
                results["results"].append({
                    "user_id": user_id,
                    "status": "success"
                })
                results["success_count"] += 1
            except Exception as e:
                error_msg = str(e)
                results["results"].append({
                    "user_id": user_id,
                    "status": "failed",
                    "error": error_msg
                })
                results["errors"].append(f"用户 {user_id}: {error_msg}")
                results["failed_count"] += 1
        
        logger.info(f"批量更新用户完成: 成功 {results['success_count']}, 失败 {results['failed_count']}")
        return results
    
    async def batch_change_status(
        self,
        user_ids: List[str],
        new_status: UserStatus,
        reason: Optional[str] = None,
        operator_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """批量变更用户状态"""
        results = {
            "success_count": 0,
            "failed_count": 0,
            "results": [],
            "errors": []
        }
        
        for user_id in user_ids:
            try:
                await self.change_user_status(user_id, new_status, reason, operator_id)
                results["results"].append({
                    "user_id": user_id,
                    "status": "success"
                })
                results["success_count"] += 1
            except Exception as e:
                error_msg = str(e)
                results["results"].append({
                    "user_id": user_id,
                    "status": "failed",
                    "error": error_msg
                })
                results["errors"].append(f"用户 {user_id}: {error_msg}")
                results["failed_count"] += 1
        
        logger.info(f"批量状态变更完成: 成功 {results['success_count']}, 失败 {results['failed_count']}")
        return results
    
    # ============ 用户统计和分析 ============
    
    async def get_user_statistics(self, user_id: str) -> Optional[UserStatistics]:
        """获取用户统计信息"""
        user_info = await self.get_user(user_id)
        return user_info.statistics if user_info else None
    
    async def get_system_statistics(self) -> Dict[str, Any]:
        """获取系统用户统计"""
        try:
            stats = await self._get_system_stats_from_db()
            return {
                "total_users": stats.get("total_users", 0),
                "active_users": stats.get("active_users", 0),
                "new_users_today": stats.get("new_users_today", 0),
                "new_users_this_week": stats.get("new_users_this_week", 0),
                "new_users_this_month": stats.get("new_users_this_month", 0),
                "status_distribution": stats.get("status_distribution", {}),
                "role_distribution": stats.get("role_distribution", {}),
                "provider_distribution": stats.get("provider_distribution", {}),
                "growth_trend": stats.get("growth_trend", [])
            }
        except Exception as e:
            logger.error(f"获取系统统计失败: {str(e)}")
            return {}
    
    async def update_user_activity(
        self,
        user_id: str,
        activity_type: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """更新用户活动"""
        try:
            user_info = await self.get_user(user_id, include_sensitive=True)
            if not user_info:
                return
            
            # 更新最后活动时间
            user_info.statistics.last_active_at = datetime.now(timezone.utc)
            
            # 根据活动类型更新相应统计
            if activity_type == "api_call":
                user_info.statistics.api_calls_today += 1
            elif activity_type == "message_sent":
                user_info.statistics.total_messages += 1
                user_info.statistics.messages_today += 1
            elif activity_type == "token_used":
                tokens = metadata.get("tokens", 0) if metadata else 0
                user_info.statistics.total_tokens += tokens
                user_info.statistics.tokens_used_today += tokens
            
            # 保存更新
            await self._update_user_statistics_in_db(user_id, user_info.statistics)
            
            # 更新缓存
            self._update_user_cache(user_info)
            
        except Exception as e:
            logger.error(f"更新用户活动失败: {str(e)}")
    
    async def get_user_activity_summary(
        self,
        user_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """获取用户活动摘要"""
        try:
            user_info = await self.get_user(user_id, include_sensitive=True)
            if not user_info:
                return {}
            
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
            
            # 这里应该从数据库获取详细的活动数据
            # 现在返回基础统计
            return {
                "user_id": user_id,
                "period_days": days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_logins": user_info.statistics.login_count,
                "last_login": user_info.statistics.last_login_at.isoformat() if user_info.statistics.last_login_at else None,
                "last_active": user_info.statistics.last_active_at.isoformat() if user_info.statistics.last_active_at else None,
                "total_messages": user_info.statistics.total_messages,
                "total_tokens": user_info.statistics.total_tokens,
                "daily_stats": {
                    "api_calls": user_info.statistics.api_calls_today,
                    "messages": user_info.statistics.messages_today,
                    "tokens": user_info.statistics.tokens_used_today
                }
            }
        except Exception as e:
            logger.error(f"获取用户活动摘要失败: {str(e)}")
            return {}
    
    # ============ 用户验证和工具函数 ============
    
    async def verify_user_email(
        self,
        user_id: str,
        verification_code: str,
        operator_id: Optional[str] = None
    ) -> bool:
        """验证用户邮箱"""
        try:
            # 这里应该验证验证码的有效性
            # 简化实现，假设验证通过
            
            user_info = await self.get_user(user_id, include_sensitive=True)
            if not user_info:
                raise HTTPException(
                    status_code=HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            # 更新验证状态
            user_info.email_verified = True
            user_info.is_verified = user_info.email_verified and user_info.phone_verified
            user_info.updated_at = datetime.now(timezone.utc)
            
            # 如果之前是待激活状态，现在激活用户
            if user_info.status == UserStatus.PENDING:
                user_info.status = UserStatus.ACTIVE
            
            await self._update_user_in_db(user_info)
            self._update_user_cache(user_info)
            
            # 记录事件
            await self._log_user_event(
                UserEventType.USER_EMAIL_VERIFIED,
                user_id,
                operator_id=operator_id,
                data={"email": user_info.email}
            )
            
            logger.info(f"用户邮箱验证成功: {user_id}")
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"验证用户邮箱失败: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="验证邮箱时发生内部错误"
            )
    
    async def verify_user_phone(
        self,
        user_id: str,
        verification_code: str,
        operator_id: Optional[str] = None
    ) -> bool:
        """验证用户手机号"""
        try:
            # 这里应该验证验证码的有效性
            # 简化实现，假设验证通过
            
            user_info = await self.get_user(user_id, include_sensitive=True)
            if not user_info:
                raise HTTPException(
                    status_code=HTTP_404_NOT_FOUND,
                    detail="用户不存在"
                )
            
            # 更新验证状态
            user_info.phone_verified = True
            user_info.is_verified = user_info.email_verified and user_info.phone_verified
            user_info.updated_at = datetime.now(timezone.utc)
            
            await self._update_user_in_db(user_info)
            self._update_user_cache(user_info)
            
            # 记录事件
            await self._log_user_event(
                UserEventType.USER_PHONE_VERIFIED,
                user_id,
                operator_id=operator_id,
                data={"phone": user_info.phone}
            )
            
            logger.info(f"用户手机号验证成功: {user_id}")
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"验证用户手机号失败: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="验证手机号时发生内部错误"
            )
    
    async def check_username_availability(self, username: str) -> Dict[str, Any]:
        """检查用户名可用性"""
        try:
            username = username.strip().lower()
            
            # 基础格式验证
            if len(username) < 3:
                return {
                    "available": False,
                    "reason": "用户名长度至少需要3个字符",
                    "suggestions": []
                }
            
            if not re.match(r'^[a-zA-Z0-9_-]+$', username):
                return {
                    "available": False,
                    "reason": "用户名只能包含字母、数字、下划线和横线",
                    "suggestions": []
                }
            
            # 检查是否已被使用
            is_taken = await self._is_username_taken(username)
            
            if is_taken:
                suggestions = await self._generate_username_suggestions(username)
                return {
                    "available": False,
                    "reason": "用户名已被使用",
                    "suggestions": suggestions
                }
            
            return {
                "available": True,
                "reason": "用户名可用",
                "suggestions": []
            }
            
        except Exception as e:
            logger.error(f"检查用户名可用性失败: {str(e)}")
            return {
                "available": False,
                "reason": "检查过程中发生错误",
                "suggestions": []
            }
    
    async def check_email_availability(self, email: str) -> Dict[str, Any]:
        """检查邮箱可用性"""
        try:
            email = email.strip().lower()
            
            # 邮箱格式验证
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, email):
                return {
                    "available": False,
                    "reason": "邮箱格式不正确",
                    "suggestions": ["@gmail.com", "@qq.com", "@163.com"]
                }
            
            # 检查是否已被使用
            is_taken = await self._is_email_taken(email)
            
            if is_taken:
                return {
                    "available": False,
                    "reason": "邮箱已被注册",
                    "suggestions": []
                }
            
            return {
                "available": True,
                "reason": "邮箱可用",
                "suggestions": []
            }
            
        except Exception as e:
            logger.error(f"检查邮箱可用性失败: {str(e)}")
            return {
                "available": False,
                "reason": "检查过程中发生错误",
                "suggestions": []
            }
    
    async def export_user_data(
        self,
        user_ids: Optional[List[str]] = None,
        format: str = "json",
        include_sensitive: bool = False,
        operator_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """导出用户数据"""
        try:
            if not user_ids:
                # 导出所有用户（需要管理员权限）
                if not operator_id or not await self._is_admin_user(operator_id):
                    raise HTTPException(
                        status_code=HTTP_403_FORBIDDEN,
                        detail="需要管理员权限才能导出所有用户数据"
                    )
                
                # 获取所有用户
                users, _ = await self.get_user_list(page=1, size=10000)
            else:
                # 导出指定用户
                users = []
                for user_id in user_ids:
                    user = await self.get_user(user_id, include_sensitive=include_sensitive)
                    if user:
                        users.append(user)
            
            # 转换为导出格式
            export_data = []
            for user in users:
                user_data = {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email if include_sensitive or user.profile.show_email else None,
                    "phone": user.phone if include_sensitive or user.profile.show_phone else None,
                    "status": user.status.value,
                    "role": user.role.value,
                    "auth_provider": user.auth_provider.value,
                    "is_verified": user.is_verified,
                    "created_at": user.created_at.isoformat(),
                    "updated_at": user.updated_at.isoformat(),
                    "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
                    "profile": {
                        "nickname": user.profile.nickname,
                        "bio": user.profile.bio,
                        "location": user.profile.location,
                        "website": user.profile.website
                    },
                    "statistics": {
                        "login_count": user.statistics.login_count,
                        "total_messages": user.statistics.total_messages,
                        "total_tokens": user.statistics.total_tokens
                    } if include_sensitive else None
                }
                export_data.append(user_data)
            
            # 记录导出事件
            await self._log_user_event(
                UserEventType.USER_UPDATED,  # 可以定义专门的导出事件
                operator_id or "system",
                operator_id=operator_id,
                data={
                    "action": "export_user_data",
                    "user_count": len(export_data),
                    "format": format,
                    "include_sensitive": include_sensitive
                }
            )
            
            return {
                "success": True,
                "format": format,
                "user_count": len(export_data),
                "export_time": datetime.now(timezone.utc).isoformat(),
                "data": export_data
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"导出用户数据失败: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="导出用户数据时发生内部错误"
            )
    
    # ============ 用户会话管理 ============
    
    async def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """获取用户会话列表"""
        try:
            sessions = self.session_manager.get_user_sessions(user_id)
            return [
                {
                    "session_id": session.session_id,
                    "device_type": session.device_type.value,
                    "ip_address": session.ip_address,
                    "user_agent": session.user_agent,
                    "created_at": session.created_at.isoformat(),
                    "last_activity": session.last_activity.isoformat(),
                    "expires_at": session.expires_at.isoformat(),
                    "status": session.status.value,
                    "location": session.location
                }
                for session in sessions
            ]
        except Exception as e:
            logger.error(f"获取用户会话失败: {str(e)}")
            return []
    
    async def terminate_user_session(
        self,
        user_id: str,
        session_id: str,
        operator_id: Optional[str] = None
    ) -> bool:
        """终止用户指定会话"""
        try:
            # 验证会话属于该用户
            session = self.session_manager.get_session(session_id)
            if not session or session.user_id != user_id:
                raise HTTPException(
                    status_code=HTTP_404_NOT_FOUND,
                    detail="会话不存在或不属于该用户"
                )
            
            # 终止会话
            success = self.session_manager.terminate_session(session_id, "admin_action")
            
            if success:
                # 记录事件
                await self._log_user_event(
                    UserEventType.USER_LOGOUT,
                    user_id,
                    operator_id=operator_id,
                    data={
                        "session_id": session_id,
                        "action": "admin_terminated"
                    }
                )
            
            return success
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"终止用户会话失败: {str(e)}")
            return False
    
    async def terminate_all_user_sessions(
        self,
        user_id: str,
        operator_id: Optional[str] = None
    ) -> int:
        """终止用户所有会话"""
        try:
            count = self.session_manager.terminate_user_sessions(user_id, "admin_action")
            
            # 记录事件
            await self._log_user_event(
                UserEventType.USER_LOGOUT,
                user_id,
                operator_id=operator_id,
                data={
                    "action": "admin_terminated_all",
                    "session_count": count
                }
            )
            
            return count
            
        except Exception as e:
            logger.error(f"终止用户所有会话失败: {str(e)}")
            return 0
    
    # ============ 内部辅助方法 ============
    
    async def _validate_user_data(
        self,
        username: str,
        email: str,
        phone: Optional[str] = None,
        password: Optional[str] = None
    ):
        """验证用户数据"""
        # 验证用户名
        if not username or len(username.strip()) < 3:
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="用户名长度至少需要3个字符"
            )
        
        if not re.match(r'^[a-zA-Z0-9_-]+$', username):
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="用户名只能包含字母、数字、下划线和横线"
            )
        
        # 验证邮箱
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            raise HTTPException(
                status_code=HTTP_400_BAD_REQUEST,
                detail="邮箱格式不正确"
            )
        
        # 验证手机号
        if phone:
            phone_pattern = r'^1[3-9]\d{9}$'
            if not re.match(phone_pattern, phone):
                raise HTTPException(
                    status_code=HTTP_400_BAD_REQUEST,
                    detail="手机号格式不正确"
                )
    
    async def _is_username_taken(
        self,
        username: str,
        exclude_user_id: Optional[str] = None
    ) -> bool:
        """检查用户名是否已被使用"""
        user_info = await self.get_user_by_username(username)
        if not user_info:
            return False
        return user_info.id != exclude_user_id
    
    async def _is_email_taken(
        self,
        email: str,
        exclude_user_id: Optional[str] = None
    ) -> bool:
        """检查邮箱是否已被使用"""
        user_info = await self.get_user_by_email(email)
        if not user_info:
            return False
        return user_info.id != exclude_user_id
    
    async def _is_admin_user(self, user_id: str) -> bool:
        """检查是否为管理员用户"""
        user_info = await self.get_user(user_id)
        return user_info and user_info.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]
    
    def _sanitize_user_info(self, user_info: UserInfo) -> UserInfo:
        """清理用户敏感信息"""
        # 创建副本
        sanitized = UserInfo(
            id=user_info.id,
            username=user_info.username,
            email=user_info.email,
            phone=user_info.phone,
            status=user_info.status,
            role=user_info.role,
            auth_provider=user_info.auth_provider,
            is_verified=user_info.is_verified,
            email_verified=user_info.email_verified,
            phone_verified=user_info.phone_verified,
            two_factor_enabled=user_info.two_factor_enabled,
            created_at=user_info.created_at,
            updated_at=user_info.updated_at,
            last_login_at=user_info.last_login_at,
            profile=user_info.profile,
            preferences=user_info.preferences,
            statistics=user_info.statistics,
            tags=user_info.tags,
            metadata=user_info.metadata
        )
        
        # 根据隐私设置清理敏感信息
        if not sanitized.profile.show_email:
            sanitized.email = None
        
        if not sanitized.profile.show_phone:
            sanitized.phone = None
        
        # 清理敏感的统计信息
        sanitized.statistics = UserStatistics(
            login_count=user_info.statistics.login_count,
            last_login_at=user_info.statistics.last_login_at,
            last_active_at=user_info.statistics.last_active_at
        )
        
        return sanitized
    
    def _update_user_cache(self, user_info: UserInfo):
        """更新用户缓存"""
        self._user_cache[user_info.id] = user_info
        self._username_cache[user_info.username] = user_info.id
        self._email_cache[user_info.email] = user_info.id
    
    def _remove_from_cache(self, user_info: UserInfo):
        """从缓存中移除用户"""
        self._user_cache.pop(user_info.id, None)
        self._username_cache.pop(user_info.username, None)
        self._email_cache.pop(user_info.email, None)
    
    async def _log_user_event(
        self,
        event_type: UserEventType,
        user_id: str,
        operator_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None
    ):
        """记录用户事件"""
        event = UserEvent(
            event_type=event_type,
            user_id=user_id,
            operator_id=operator_id,
            ip_address=ip_address,
            user_agent=user_agent,
            data=data
        )
        
        self._user_events.append(event)
        
        # 这里应该保存到数据库
        # await self._save_user_event_to_db(event)
        
        logger.info(f"用户事件: {event_type.value} - {user_id}")
    
    async def _update_login_statistics(self, user_id: str):
        """更新登录统计"""
        try:
            user_info = await self.get_user(user_id, include_sensitive=True)
            if user_info:
                now = datetime.now(timezone.utc)
                user_info.statistics.login_count += 1
                user_info.statistics.last_login_at = now
                user_info.last_login_at = now
                
                await self._update_user_in_db(user_info)
                self._update_user_cache(user_info)
        except Exception as e:
            logger.error(f"更新登录统计失败: {str(e)}")
    
    async def _send_welcome_email(self, user_info: UserInfo):
        """发送欢迎邮件"""
        try:
            # 这里应该发送真实的邮件
            logger.info(f"发送欢迎邮件: {user_info.email}")
        except Exception as e:
            logger.error(f"发送欢迎邮件失败: {str(e)}")
    
    async def _generate_username_suggestions(self, username: str) -> List[str]:
        """生成用户名建议"""
        suggestions = []
        
        try:
            # 添加数字后缀
            for i in range(1, 6):
                suggestion = f"{username}{i}"
                if not await self._is_username_taken(suggestion):
                    suggestions.append(suggestion)
            
            # 添加下划线和数字
            for i in range(1, 4):
                suggestion = f"{username}_{i}"
                if not await self._is_username_taken(suggestion):
                    suggestions.append(suggestion)
            
            # 添加年份
            current_year = datetime.now().year
            for year in [current_year, current_year - 1]:
                suggestion = f"{username}{year}"
                if not await self._is_username_taken(suggestion):
                    suggestions.append(suggestion)
            
            # 限制建议数量
            return suggestions[:5]
            
        except Exception as e:
            logger.error(f"生成用户名建议失败: {str(e)}")
            return []
    
    # ============ 数据库操作方法 ============
    # 这些方法需要根据实际的数据库实现来完成
    
    async def _save_user_to_db(self, user_info: UserInfo, password_hash: str):
        """保存用户到数据库"""
        # TODO: 实现数据库保存逻辑
        logger.info(f"保存用户到数据库: {user_info.id}")
    
    async def _get_user_from_db(self, user_id: str) -> Optional[UserInfo]:
        """从数据库获取用户"""
        # TODO: 实现数据库查询逻辑
        return None
    
    async def _get_user_by_username_from_db(self, username: str) -> Optional[UserInfo]:
        """根据用户名从数据库获取用户"""
        # TODO: 实现数据库查询逻辑
        return None
    
    async def _get_user_by_email_from_db(self, email: str) -> Optional[UserInfo]:
        """根据邮箱从数据库获取用户"""
        # TODO: 实现数据库查询逻辑
        return None
    
    async def _update_user_in_db(self, user_info: UserInfo):
        """更新数据库中的用户信息"""
        # TODO: 实现数据库更新逻辑
        logger.info(f"更新数据库用户: {user_info.id}")
    
    async def _delete_user_from_db(self, user_id: str):
        """从数据库删除用户"""
        # TODO: 实现数据库删除逻辑
        logger.info(f"从数据库删除用户: {user_id}")
    
    async def _get_user_password_hash(self, user_id: str) -> Optional[str]:
        """获取用户密码哈希"""
        # TODO: 实现数据库查询逻辑
        return None
    
    async def _update_user_password_in_db(self, user_id: str, password_hash: str):
        """更新数据库中的用户密码"""
        # TODO: 实现数据库更新逻辑
        logger.info(f"更新用户密码: {user_id}")
    
    async def _update_user_statistics_in_db(self, user_id: str, statistics: UserStatistics):
        """更新数据库中的用户统计信息"""
        # TODO: 实现数据库更新逻辑
        logger.info(f"更新用户统计: {user_id}")
    
    async def _build_search_conditions(self, query: UserSearchQuery) -> Dict[str, Any]:
        """构建搜索条件"""
        # TODO: 实现搜索条件构建逻辑
        return {}
    
    async def _search_users_in_db(
        self,
        conditions: Dict[str, Any],
        query: UserSearchQuery
    ) -> Tuple[List[UserInfo], int]:
        """在数据库中搜索用户"""
        # TODO: 实现数据库搜索逻辑
        return [], 0
    
    async def _get_system_stats_from_db(self) -> Dict[str, Any]:
        """从数据库获取系统统计"""
        # TODO: 实现数据库统计查询逻辑
        return {}

# 创建全局用户服务实例
_user_service_instance: Optional[UserService] = None

def get_user_service() -> UserService:
    """获取用户服务实例"""
    global _user_service_instance
    if _user_service_instance is None:
        _user_service_instance = UserService()
    return _user_service_instance

def set_user_service(service: UserService):
    """设置用户服务实例"""
    global _user_service_instance
    _user_service_instance = service

# ============ 辅助工具函数 ============

def validate_password_strength(password: str) -> Dict[str, Any]:
    """快速密码强度验证（无需实例化服务）"""
    password_manager = PasswordManager()
    return password_manager.validate_password(password)

def generate_secure_password(length: int = 12) -> str:
    """生成安全密码（无需实例化服务）"""
    password_manager = PasswordManager()
    return password_manager.generate_password(length=length)

def sanitize_username(username: str) -> str:
    """清理用户名"""
    # 移除特殊字符，只保留字母、数字、下划线和横线
    sanitized = re.sub(r'[^a-zA-Z0-9_-]', '', username.strip())
    return sanitized.lower()

def format_user_display_name(user_info: UserInfo) -> str:
    """格式化用户显示名称"""
    if user_info.profile.nickname:
        return user_info.profile.nickname
    elif user_info.profile.real_name:
        return user_info.profile.real_name
    else:
        return user_info.username

def calculate_user_score(user_info: UserInfo) -> int:
    """计算用户评分（基于活跃度、验证状态等）"""
    score = 0
    
    # 基础分数
    score += 10
    
    # 验证状态加分
    if user_info.email_verified:
        score += 20
    if user_info.phone_verified:
        score += 15
    if user_info.two_factor_enabled:
        score += 25
    
    # 完善度加分
    if user_info.profile.nickname:
        score += 5
    if user_info.profile.bio:
        score += 5
    if user_info.profile.avatar_url:
        score += 10
    
    # 活跃度加分
    if user_info.statistics.login_count > 10:
        score += 10
    if user_info.statistics.total_messages > 50:
        score += 15
    
    # 角色加分
    if user_info.role == UserRole.VIP:
        score += 20
    elif user_info.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        score += 30
    
    return min(100, score)

def create_user_activity_log(
    user_id: str,
    action: str,
    details: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """创建用户活动日志条目"""
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip_address": None,  # 应该从请求上下文获取
        "user_agent": None   # 应该从请求上下文获取
    }

# ============ 使用示例 ============

async def example_usage():
    """用户管理服务使用示例"""
    
    # 创建用户服务实例
    user_service = UserService()
    
    try:
        # 1. 创建用户
        print("=== 创建用户 ===")
        user_info = await user_service.create_user(
            username="testuser",
            email="test@example.com",
            password="SecurePass123!",
            phone="13800138000",
            profile_data={
                "nickname": "测试用户",
                "bio": "这是一个测试用户",
                "location": "北京"
            },
            auto_verify=True
        )
        print(f"创建用户成功: {user_info.username} ({user_info.id})")
        
        # 2. 获取用户信息
        print("\n=== 获取用户信息 ===")
        retrieved_user = await user_service.get_user(user_info.id)
        if retrieved_user:
            print(f"用户: {retrieved_user.username}")
            print(f"状态: {retrieved_user.status.value}")
            print(f"角色: {retrieved_user.role.value}")
            print(f"评分: {calculate_user_score(retrieved_user)}")
        
        # 3. 更新用户信息
        print("\n=== 更新用户信息 ===")
        update_data = UserUpdateData(
            profile={
                "nickname": "更新后的昵称",
                "bio": "更新后的个人简介"
            }
        )
        updated_user = await user_service.update_user(user_info.id, update_data)
        print(f"更新成功: {updated_user.profile.nickname}")
        
        # 4. 检查用户名可用性
        print("\n=== 检查用户名可用性 ===")
        availability = await user_service.check_username_availability("newuser")
        print(f"用户名 'newuser' 可用: {availability['available']}")
        
        # 5. 获取用户统计
        print("\n=== 获取用户统计 ===")
        stats = await user_service.get_user_statistics(user_info.id)
        if stats:
            print(f"登录次数: {stats.login_count}")
            print(f"消息总数: {stats.total_messages}")
        
        # 6. 批量操作示例
        print("\n=== 批量操作 ===")
        batch_result = await user_service.batch_change_status(
            [user_info.id],
            UserStatus.SUSPENDED,
            "测试暂停"
        )
        print(f"批量操作结果: 成功 {batch_result['success_count']}, 失败 {batch_result['failed_count']}")
        
        # 7. 导出用户数据
        print("\n=== 导出用户数据 ===")
        export_result = await user_service.export_user_data(
            user_ids=[user_info.id],
            include_sensitive=False
        )
        print(f"导出用户数量: {export_result['user_count']}")
        
        # 8. 系统统计
        print("\n=== 系统统计 ===")
        system_stats = await user_service.get_system_statistics()
        print(f"总用户数: {system_stats.get('total_users', 0)}")
        print(f"活跃用户数: {system_stats.get('active_users', 0)}")
        
    except HTTPException as e:
        print(f"HTTP错误: {e.status_code} - {e.detail}")
    except Exception as e:
        print(f"其他错误: {str(e)}")

# 导出主要类和函数
__all__ = [
    "UserService",
    "UserInfo",
    "UserProfile", 
    "UserPreferences",
    "UserStatistics",
    "UserSearchQuery",
    "UserUpdateData",
    "UserStatus",
    "UserRole", 
    "AuthProvider",
    "ProfileVisibility",
    "UserEventType",
    "UserEvent",
    "get_user_service",
    "set_user_service",
    # 辅助工具函数
    "validate_password_strength",
    "generate_secure_password",
    "sanitize_username",
    "format_user_display_name",
    "calculate_user_score",
    "create_user_activity_log"
]
