#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
认证业务逻辑服务 - 提供完整的用户认证和授权功能
"""

import asyncio
import secrets
import logging
from typing import Dict, List, Optional, Any, Tuple, Union
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass, asdict
from enum import Enum
import json
import qrcode
import io
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

# 第三方库
import pyotp
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, Request
from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_401_UNAUTHORIZED,
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
)

# 内部导入
from ..config.auth_config import AuthConfig, get_auth_config
from ..utils.password_utils import PasswordManager, PasswordPolicy
from ..utils.session_utils import SessionManager, SessionInfo, SessionStatus
from ..utils.jwt_utils import JWTManager
from ..security import SecurityManager, SecurityContext, PermissionType, SecurityLevel
from ..middleware.auth_middleware import AuthenticationMiddleware
from ..schemas.auth import (
    LoginRequest,
    RegisterRequest,
    PasswordResetRequest,
    PasswordChangeRequest,
)
from ..schemas.responses import BaseResponse

logger = logging.getLogger(__name__)


class AuthEventType(Enum):
    """认证事件类型"""

    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    REGISTER_SUCCESS = "register_success"
    REGISTER_FAILED = "register_failed"
    PASSWORD_RESET = "password_reset"
    PASSWORD_CHANGE = "password_change"
    TWO_FACTOR_SETUP = "two_factor_setup"
    TWO_FACTOR_VERIFY = "two_factor_verify"
    SESSION_CREATED = "session_created"
    SESSION_TERMINATED = "session_terminated"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"


@dataclass
class AuthResult:
    """认证结果"""

    success: bool
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    message: Optional[str] = None
    requires_2fa: bool = False
    requires_verification: bool = False
    security_context: Optional[SecurityContext] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class PasswordResetResult:
    """密码重置结果"""

    success: bool
    reset_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    message: Optional[str] = None


@dataclass
class TwoFactorSetupResult:
    """双因子设置结果"""

    success: bool
    secret_key: Optional[str] = None
    qr_code: Optional[str] = None
    backup_codes: Optional[List[str]] = None
    message: Optional[str] = None


@dataclass
class PasswordUpdateRequest:
    """密码更新请求"""

    current_password: str
    new_password: str
    logout_other_sessions: bool = False


@dataclass
class TwoFactorSetupRequest:
    """双因子设置请求"""

    password: str


@dataclass
class TwoFactorVerifyRequest:
    """双因子验证请求"""

    code: str


@dataclass
class SecurityEvent:
    """安全事件"""

    event_type: str
    username: str
    ip_address: str
    user_agent: str
    timestamp: datetime
    metadata: Dict[str, Any]


class AuthService:
    """认证业务逻辑服务"""

    def __init__(
        self,
        config: Optional[AuthConfig] = None,
        password_manager: Optional[PasswordManager] = None,
        session_manager: Optional[SessionManager] = None,
        jwt_manager: Optional[JWTManager] = None,
        security_manager: Optional[SecurityManager] = None,
        db_session: Optional[Session] = None,
    ):
        """初始化认证服务"""
        self.config = config or get_auth_config()

        # 初始化组件
        self.password_manager = password_manager or PasswordManager(
            self.config.get_password_policy()
        )
        self.session_manager = session_manager or SessionManager(
            self.config.get_session_config()
        )
        self.jwt_manager = jwt_manager or JWTManager(self.config.get_jwt_config())
        self.security_manager = security_manager or SecurityManager(
            self.config.get_security_config()
        )

        # 数据库会话
        self.db = db_session

        # 认证状态追踪
        self._failed_attempts: Dict[str, List[datetime]] = {}
        self._locked_accounts: Dict[str, datetime] = {}
        self._password_reset_tokens: Dict[str, Dict[str, Any]] = {}
        self._verification_tokens: Dict[str, Dict[str, Any]] = {}

        # 双因子认证配置
        self._totp_secrets: Dict[str, str] = {}
        self._backup_codes: Dict[str, List[str]] = {}

        logger.info("认证服务初始化完成")

    async def login(
        self,
        request: LoginRequest,
        ip_address: str,
        user_agent: str,
        request_obj: Optional[Request] = None,
    ) -> AuthResult:
        """用户登录"""
        try:
            username = request.username.strip().lower()
            password = request.password

            # 检查账户是否被锁定
            if self._is_account_locked(username):
                await self._log_auth_event(
                    AuthEventType.LOGIN_FAILED,
                    username,
                    ip_address,
                    {"reason": "account_locked"},
                )
                return AuthResult(success=False, message="账户已被锁定，请稍后再试")

            # 验证用户凭据
            user = await self._validate_user_credentials(username, password)
            if not user:
                await self._handle_failed_login(username, ip_address)
                return AuthResult(success=False, message="用户名或密码错误")

            # 检查用户状态
            if not user.get("is_active", True):
                return AuthResult(success=False, message="账户已被禁用")

            # 检查是否需要邮箱验证
            if not user.get("is_verified", False):
                return AuthResult(
                    success=False, message="请先验证您的邮箱地址", requires_verification=True
                )

            # 检查是否启用2FA
            if user.get("two_factor_enabled", False):
                if not request.two_factor_code:
                    return AuthResult(
                        success=False, message="请输入双因子认证码", requires_2fa=True
                    )

                # 验证2FA码
                if not await self._verify_2fa_code(user["id"], request.two_factor_code):
                    await self._handle_failed_login(username, ip_address)
                    return AuthResult(success=False, message="双因子认证码错误")

            # 创建安全上下文
            security_context = await self._create_security_context(
                user, ip_address, user_agent
            )

            # 创建会话
            session_info = self.session_manager.create_session(
                user_id=user["id"],
                ip_address=ip_address,
                user_agent=user_agent,
                remember_me=request.remember_me,
                metadata={
                    "login_method": "password",
                    "two_factor_used": user.get("two_factor_enabled", False),
                },
            )

            # 生成JWT令牌
            access_token = self.jwt_manager.create_access_token(
                security_context, session_info.session_id
            )
            refresh_token = self.jwt_manager.create_refresh_token(
                security_context, session_info.session_id
            )

            # 清除失败登录记录
            self._clear_failed_attempts(username)

            # 记录成功登录事件
            await self._log_auth_event(
                AuthEventType.LOGIN_SUCCESS,
                username,
                ip_address,
                {
                    "session_id": session_info.session_id,
                    "two_factor_used": user.get("two_factor_enabled", False),
                },
            )

            return AuthResult(
                success=True,
                user_id=user["id"],
                session_id=session_info.session_id,
                access_token=access_token,
                refresh_token=refresh_token,
                message="登录成功",
                security_context=security_context,
                metadata={
                    "session_expires_at": session_info.expires_at.isoformat(),
                    "permissions": [p.value for p in security_context.permissions],
                },
            )

        except Exception as e:
            logger.error(f"登录过程发生错误: {str(e)}")
            return AuthResult(success=False, message="登录过程中发生错误，请稍后再试")

    async def register(
        self, request: RegisterRequest, ip_address: str, user_agent: str
    ) -> AuthResult:
        """用户注册"""
        try:
            username = request.username.strip().lower()
            email = request.email.strip().lower()
            password = request.password

            # 验证用户名和邮箱可用性
            if await self._is_username_taken(username):
                return AuthResult(success=False, message="用户名已存在")

            if await self._is_email_taken(email):
                return AuthResult(success=False, message="邮箱地址已被使用")

            # 验证密码强度
            password_validation = self.password_manager.validate_password(
                password,
                user_info={
                    "username": username,
                    "email": email,
                    "name": request.display_name,
                },
            )

            if not password_validation["valid"]:
                return AuthResult(
                    success=False,
                    message="密码不符合安全要求: " + "; ".join(password_validation["errors"]),
                )

            # 加密密码
            password_hash = self.password_manager.hash_password(password)

            # 创建用户
            user_data = {
                "id": str(secrets.token_urlsafe(16)),
                "username": username,
                "email": email,
                "display_name": request.display_name or username,
                "password_hash": password_hash,
                "is_active": True,
                "is_verified": False,  # 需要邮箱验证
                "two_factor_enabled": False,
                "created_at": datetime.now(timezone.utc),
                "last_login": None,
                "failed_login_attempts": 0,
                "permissions": [PermissionType.USER.value],
                "security_level": SecurityLevel.STANDARD.value,
            }

            # 保存用户到数据库
            user = await self._create_user(user_data)
            if not user:
                return AuthResult(success=False, message="注册失败，请稍后再试")

            # 生成邮箱验证令牌
            verification_token = await self._generate_verification_token(user["id"])

            # 发送验证邮件
            await self._send_verification_email(email, username, verification_token)

            # 记录注册事件
            await self._log_auth_event(
                AuthEventType.REGISTER_SUCCESS,
                username,
                ip_address,
                {"user_id": user["id"]},
            )

            return AuthResult(
                success=True,
                user_id=user["id"],
                message="注册成功，请检查您的邮箱并验证账户",
                requires_verification=True,
            )

        except Exception as e:
            logger.error(f"注册过程发生错误: {str(e)}")
            await self._log_auth_event(
                AuthEventType.REGISTER_FAILED,
                request.username,
                ip_address,
                {"error": str(e)},
            )
            return AuthResult(success=False, message="注册过程中发生错误，请稍后再试")

    async def logout(
        self, session_id: str, user_id: str, ip_address: str, all_sessions: bool = False
    ) -> BaseResponse:
        """用户登出"""
        try:
            if all_sessions:
                # 终止用户的所有会话
                terminated_count = self.session_manager.terminate_user_sessions(
                    user_id, reason="user_logout_all"
                )
                message = f"已终止 {terminated_count} 个会话"
            else:
                # 只终止当前会话
                if self.session_manager.terminate_session(session_id, "user_logout"):
                    message = "登出成功"
                else:
                    message = "会话已失效"

            # 记录登出事件
            await self._log_auth_event(
                AuthEventType.SESSION_TERMINATED,
                user_id,
                ip_address,
                {"session_id": session_id, "all_sessions": all_sessions},
            )

            return BaseResponse(success=True, message=message)

        except Exception as e:
            logger.error(f"登出过程发生错误: {str(e)}")
            return BaseResponse(success=False, message="登出过程中发生错误")

    async def reset_password_request(
        self, request: PasswordResetRequest, ip_address: str
    ) -> PasswordResetResult:
        """密码重置请求"""
        try:
            email = request.email.strip().lower()

            # 查找用户
            user = await self._find_user_by_email(email)
            if not user:
                # 为了安全，即使用户不存在也返回成功消息
                return PasswordResetResult(success=True, message="如果该邮箱存在，重置链接已发送")

            # 检查重置频率限制
            if not await self._can_request_password_reset(user["id"]):
                return PasswordResetResult(success=False, message="重置请求过于频繁，请稍后再试")

            # 生成重置令牌
            reset_token = secrets.token_urlsafe(32)
            expires_at = datetime.now(timezone.utc) + timedelta(
                minutes=self.config.reset_token_expire_minutes
            )

            # 存储重置令牌
            self._password_reset_tokens[reset_token] = {
                "user_id": user["id"],
                "email": email,
                "expires_at": expires_at,
                "ip_address": ip_address,
                "used": False,
            }

            # 发送重置邮件
            await self._send_password_reset_email(email, user["username"], reset_token)

            # 记录事件
            await self._log_auth_event(
                AuthEventType.PASSWORD_RESET,
                user["username"],
                ip_address,
                {"action": "request_sent"},
            )

            return PasswordResetResult(
                success=True,
                reset_token=reset_token,
                expires_at=expires_at,
                message="重置链接已发送到您的邮箱",
            )

        except Exception as e:
            logger.error(f"密码重置请求错误: {str(e)}")
            return PasswordResetResult(success=False, message="处理重置请求时发生错误")

    async def reset_password_confirm(
        self, reset_token: str, new_password: str, ip_address: str
    ) -> BaseResponse:
        """确认密码重置"""
        try:
            # 验证重置令牌
            token_data = self._password_reset_tokens.get(reset_token)
            if not token_data:
                return BaseResponse(success=False, message="无效的重置令牌")

            if token_data["used"]:
                return BaseResponse(success=False, message="重置令牌已被使用")

            if datetime.now(timezone.utc) > token_data["expires_at"]:
                return BaseResponse(success=False, message="重置令牌已过期")

            # 获取用户信息
            user = await self._find_user_by_id(token_data["user_id"])
            if not user:
                return BaseResponse(success=False, message="用户不存在")

            # 验证新密码
            password_validation = self.password_manager.validate_password(
                new_password,
                user_info={"username": user["username"], "email": user["email"]},
                password_history=user.get("password_history", []),
            )

            if not password_validation["valid"]:
                return BaseResponse(
                    success=False,
                    message="新密码不符合安全要求: " + "; ".join(password_validation["errors"]),
                )

            # 更新密码
            password_hash = self.password_manager.hash_password(new_password)
            await self._update_user_password(
                user["id"], password_hash, user.get("password_hash")  # 添加到密码历史
            )

            # 标记令牌为已使用
            token_data["used"] = True
            token_data["used_at"] = datetime.now(timezone.utc)

            # 终止用户的所有会话（强制重新登录）
            self.session_manager.terminate_user_sessions(
                user["id"], reason="password_reset"
            )

            # 记录事件
            await self._log_auth_event(
                AuthEventType.PASSWORD_CHANGE,
                user["username"],
                ip_address,
                {"action": "reset_completed"},
            )

            return BaseResponse(success=True, message="密码重置成功，请使用新密码登录")

        except Exception as e:
            logger.error(f"密码重置确认错误: {str(e)}")
            return BaseResponse(success=False, message="密码重置过程中发生错误")

    async def update_password(
        self, user_id: str, request: PasswordUpdateRequest, ip_address: str
    ) -> BaseResponse:
        """更新密码"""
        try:
            # 获取用户信息
            user = await self._find_user_by_id(user_id)
            if not user:
                return BaseResponse(success=False, message="用户不存在")

            # 验证当前密码
            if not self.password_manager.verify_password(
                request.current_password, user["password_hash"]
            ):
                return BaseResponse(success=False, message="当前密码错误")

            # 验证新密码
            password_validation = self.password_manager.validate_password(
                request.new_password,
                user_info={"username": user["username"], "email": user["email"]},
                password_history=user.get("password_history", []),
            )

            if not password_validation["valid"]:
                return BaseResponse(
                    success=False,
                    message="新密码不符合安全要求: " + "; ".join(password_validation["errors"]),
                )

            # 更新密码
            password_hash = self.password_manager.hash_password(request.new_password)
            await self._update_user_password(
                user_id, password_hash, user["password_hash"]  # 添加到密码历史
            )

            # 如果需要，终止其他会话
            if request.logout_other_sessions:
                self.session_manager.terminate_user_sessions(
                    user_id, reason="password_change"
                )

            # 记录事件
            await self._log_auth_event(
                AuthEventType.PASSWORD_CHANGE,
                user["username"],
                ip_address,
                {"action": "user_initiated"},
            )

            return BaseResponse(success=True, message="密码更新成功")

        except Exception as e:
            logger.error(f"密码更新错误: {str(e)}")
            return BaseResponse(success=False, message="密码更新过程中发生错误")

    async def setup_two_factor(
        self, user_id: str, request: TwoFactorSetupRequest, ip_address: str
    ) -> TwoFactorSetupResult:
        """设置双因子认证"""
        try:
            # 获取用户信息
            user = await self._find_user_by_id(user_id)
            if not user:
                return TwoFactorSetupResult(success=False, message="用户不存在")

            # 验证密码
            if not self.password_manager.verify_password(
                request.password, user["password_hash"]
            ):
                return TwoFactorSetupResult(success=False, message="密码错误")

            # 生成TOTP密钥
            secret_key = pyotp.random_base32()

            # 生成QR码
            totp_uri = pyotp.totp.TOTP(secret_key).provisioning_uri(
                name=user["email"], issuer_name=self.config.security_2fa_issuer
            )

            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(totp_uri)
            qr.make(fit=True)

            qr_img = qr.make_image(fill_color="black", back_color="white")
            qr_buffer = io.BytesIO()
            qr_img.save(qr_buffer, format="PNG")
            qr_code_b64 = base64.b64encode(qr_buffer.getvalue()).decode()

            # 生成备用码
            backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]

            # 临时存储（等待验证）
            self._totp_secrets[user_id] = secret_key
            self._backup_codes[user_id] = backup_codes

            # 记录事件
            await self._log_auth_event(
                AuthEventType.TWO_FACTOR_SETUP,
                user["username"],
                ip_address,
                {"action": "setup_initiated"},
            )

            return TwoFactorSetupResult(
                success=True,
                secret_key=secret_key,
                qr_code=f"data:image/png;base64,{qr_code_b64}",
                backup_codes=backup_codes,
                message="请使用认证应用扫描二维码，然后输入验证码确认设置",
            )

        except Exception as e:
            logger.error(f"双因子认证设置错误: {str(e)}")
            return TwoFactorSetupResult(success=False, message="设置过程中发生错误")

    async def verify_two_factor_setup(
        self, user_id: str, request: TwoFactorVerifyRequest, ip_address: str
    ) -> BaseResponse:
        """验证并启用双因子认证"""
        try:
            # 获取临时存储的密钥
            secret_key = self._totp_secrets.get(user_id)
            backup_codes = self._backup_codes.get(user_id)

            if not secret_key or not backup_codes:
                return BaseResponse(success=False, message="请先初始化双因子认证设置")

            # 验证TOTP码
            totp = pyotp.TOTP(secret_key)
            if not totp.verify(request.code, valid_window=1):
                return BaseResponse(success=False, message="验证码错误")

            # 保存2FA设置到数据库
            await self._enable_two_factor(user_id, secret_key, backup_codes)

            # 清理临时存储
            self._totp_secrets.pop(user_id, None)
            self._backup_codes.pop(user_id, None)

            # 获取用户信息用于记录
            user = await self._find_user_by_id(user_id)

            # 记录事件
            await self._log_auth_event(
                AuthEventType.TWO_FACTOR_SETUP,
                user["username"] if user else "unknown",
                ip_address,
                {"action": "setup_completed"},
            )

            return BaseResponse(success=True, message="双因子认证已成功启用")

        except Exception as e:
            logger.error(f"双因子认证验证错误: {str(e)}")
            return BaseResponse(success=False, message="验证过程中发生错误")

    async def disable_two_factor(
        self, user_id: str, password: str, ip_address: str
    ) -> BaseResponse:
        """禁用双因子认证"""
        try:
            # 获取用户信息
            user = await self._find_user_by_id(user_id)
            if not user:
                return BaseResponse(success=False, message="用户不存在")

            # 验证密码
            if not self.password_manager.verify_password(
                password, user["password_hash"]
            ):
                return BaseResponse(success=False, message="密码错误")

            # 禁用2FA
            await self._disable_two_factor(user_id)

            # 记录事件
            await self._log_auth_event(
                AuthEventType.TWO_FACTOR_SETUP,
                user["username"],
                ip_address,
                {"action": "disabled"},
            )

            return BaseResponse(success=True, message="双因子认证已禁用")

        except Exception as e:
            logger.error(f"禁用双因子认证错误: {str(e)}")
            return BaseResponse(success=False, message="禁用过程中发生错误")

    async def verify_email(
        self, verification_token: str, ip_address: str
    ) -> BaseResponse:
        """验证邮箱地址"""
        try:
            # 验证令牌
            token_data = self._verification_tokens.get(verification_token)
            if not token_data:
                return BaseResponse(success=False, message="无效的验证令牌")

            if token_data["used"]:
                return BaseResponse(success=False, message="验证令牌已被使用")

            if datetime.now(timezone.utc) > token_data["expires_at"]:
                return BaseResponse(success=False, message="验证令牌已过期")

            # 更新用户验证状态
            await self._verify_user_email(token_data["user_id"])

            # 标记令牌为已使用
            token_data["used"] = True
            token_data["used_at"] = datetime.now(timezone.utc)

            return BaseResponse(success=True, message="邮箱验证成功，您现在可以登录了")

        except Exception as e:
            logger.error(f"邮箱验证错误: {str(e)}")
            return BaseResponse(success=False, message="验证过程中发生错误")

    async def refresh_token(
        self, refresh_token: str, ip_address: str, user_agent: str
    ) -> AuthResult:
        """刷新访问令牌"""
        try:
            # 验证刷新令牌
            payload = self.jwt_manager.verify_refresh_token(refresh_token)
            if not payload:
                return AuthResult(success=False, message="无效的刷新令牌")

            user_id = payload.get("user_id")
            session_id = payload.get("session_id")

            # 验证会话
            session_info = self.session_manager.validate_session(
                session_id, ip_address, user_agent
            )
            if not session_info:
                return AuthResult(success=False, message="会话已失效")

            # 获取用户信息
            user = await self._find_user_by_id(user_id)
            if not user or not user.get("is_active", True):
                return AuthResult(success=False, message="用户账户不可用")

            # 创建新的安全上下文
            security_context = await self._create_security_context(
                user, ip_address, user_agent
            )

            # 生成新的访问令牌
            new_access_token = self.jwt_manager.create_access_token(
                security_context, session_id
            )

            # 可选：生成新的刷新令牌（轮换策略）
            new_refresh_token = self.jwt_manager.create_refresh_token(
                security_context, session_id
            )

            return AuthResult(
                success=True,
                user_id=user_id,
                session_id=session_id,
                access_token=new_access_token,
                refresh_token=new_refresh_token,
                message="令牌刷新成功",
                security_context=security_context,
            )

        except Exception as e:
            logger.error(f"令牌刷新错误: {str(e)}")
            return AuthResult(success=False, message="令牌刷新失败")

    async def validate_session(
        self, session_id: str, ip_address: str, user_agent: Optional[str] = None
    ) -> Optional[SecurityContext]:
        """验证会话"""
        try:
            # 验证会话
            session_info = self.session_manager.validate_session(
                session_id, ip_address, user_agent
            )

            if not session_info:
                return None

            # 获取用户信息
            user = await self._find_user_by_id(session_info.user_id)
            if not user or not user.get("is_active", True):
                return None

            # 创建安全上下文
            return await self._create_security_context(user, ip_address, user_agent)

        except Exception as e:
            logger.error(f"会话验证错误: {str(e)}")
            return None

    async def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """获取用户的所有会话"""
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
                    "location": session.location,
                    "is_current": session.session_id == self._get_current_session_id(),
                }
                for session in sessions
            ]
        except Exception as e:
            logger.error(f"获取用户会话错误: {str(e)}")
            return []

    async def terminate_session(
        self, session_id: str, user_id: str, ip_address: str
    ) -> BaseResponse:
        """终止指定会话"""
        try:
            if self.session_manager.terminate_session(session_id, "user_action"):
                await self._log_auth_event(
                    AuthEventType.SESSION_TERMINATED,
                    user_id,
                    ip_address,
                    {"session_id": session_id, "action": "user_terminated"},
                )

                return BaseResponse(success=True, message="会话已终止")
            else:
                return BaseResponse(success=False, message="会话不存在或已失效")

        except Exception as e:
            logger.error(f"终止会话错误: {str(e)}")
            return BaseResponse(success=False, message="终止会话时发生错误")

    # ============ 内部辅助方法 ============

    async def _validate_user_credentials(
        self, username: str, password: str
    ) -> Optional[Dict[str, Any]]:
        """验证用户凭据"""
        # 这里应该从数据库查询用户
        # 示例实现
        user = await self._find_user_by_username(username)
        if not user:
            return None

        if self.password_manager.verify_password(password, user["password_hash"]):
            return user

        return None

    async def _create_security_context(
        self, user: Dict[str, Any], ip_address: str, user_agent: str
    ) -> SecurityContext:
        """创建安全上下文"""
        permissions = [
            PermissionType(perm)
            for perm in user.get("permissions", [PermissionType.USER.value])
        ]

        security_level = SecurityLevel(
            user.get("security_level", SecurityLevel.STANDARD.value)
        )

        return SecurityContext(
            user_id=user["id"],
            session_id=secrets.token_urlsafe(32),
            permissions=permissions,
            security_level=security_level,
            ip_address=ip_address,
            user_agent=user_agent,
            is_verified=user.get("is_verified", False),
            two_factor_verified=user.get("two_factor_enabled", False),
            timestamp=datetime.now(timezone.utc),
        )

    def _is_account_locked(self, username: str) -> bool:
        """检查账户是否被锁定"""
        if username not in self._locked_accounts:
            return False

        lock_time = self._locked_accounts[username]
        unlock_time = lock_time + timedelta(
            seconds=self.config.security_lockout_duration
        )

        if datetime.now(timezone.utc) > unlock_time:
            # 锁定已过期，移除锁定
            del self._locked_accounts[username]
            return False

        return True

    async def _handle_failed_login(self, username: str, ip_address: str):
        """处理登录失败"""
        now = datetime.now(timezone.utc)

        # 记录失败尝试
        if username not in self._failed_attempts:
            self._failed_attempts[username] = []

        self._failed_attempts[username].append(now)

        # 清理过期的失败记录
        cutoff_time = now - timedelta(minutes=15)  # 15分钟窗口
        self._failed_attempts[username] = [
            attempt
            for attempt in self._failed_attempts[username]
            if attempt > cutoff_time
        ]

        # 检查是否需要锁定账户
        if (
            len(self._failed_attempts[username])
            >= self.config.security_max_login_attempts
        ):
            self._locked_accounts[username] = now

            await self._log_auth_event(
                AuthEventType.ACCOUNT_LOCKED,
                username,
                ip_address,
                {"attempts": len(self._failed_attempts[username])},
            )

    def _clear_failed_attempts(self, username: str):
        """清除失败登录记录"""
        self._failed_attempts.pop(username, None)
        self._locked_accounts.pop(username, None)

    async def _verify_2fa_code(self, user_id: str, code: str) -> bool:
        """验证双因子认证码"""
        try:
            # 从数据库获取用户的2FA密钥
            user_2fa_data = await self._get_user_2fa_data(user_id)
            if not user_2fa_data:
                return False

            secret_key = user_2fa_data.get("secret_key")
            backup_codes = user_2fa_data.get("backup_codes", [])

            # 验证TOTP码
            totp = pyotp.TOTP(secret_key)
            if totp.verify(code, valid_window=1):
                return True

            # 检查备用码
            if code.upper() in backup_codes:
                # 使用后移除备用码
                backup_codes.remove(code.upper())
                await self._update_user_backup_codes(user_id, backup_codes)
                return True

            return False

        except Exception as e:
            logger.error(f"2FA验证错误: {str(e)}")
            return False

    async def _generate_verification_token(self, user_id: str) -> str:
        """生成邮箱验证令牌"""
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=self.config.verification_token_expire_minutes
        )

        self._verification_tokens[token] = {
            "user_id": user_id,
            "expires_at": expires_at,
            "used": False,
        }

        return token

    async def _send_verification_email(self, email: str, username: str, token: str):
        """发送验证邮件"""
        try:
            # 构建验证链接
            verification_url = f"https://your-domain.com/verify-email?token={token}"

            # 邮件内容
            subject = "验证您的邮箱地址 - Zishu Sensei"
            html_content = f"""
            <html>
            <body>
                <h2>欢迎注册 Zishu Sensei！</h2>
                <p>您好 {username}，</p>
                <p>请点击下面的链接验证您的邮箱地址：</p>
                <p><a href="{verification_url}">验证邮箱</a></p>
                <p>如果链接无法点击，请复制以下URL到浏览器：</p>
                <p>{verification_url}</p>
                <p>此链接将在 {self.config.verification_token_expire_minutes} 分钟后过期。</p>
                <p>如果这不是您的操作，请忽略此邮件。</p>
                <br>
                <p>Zishu Sensei 团队</p>
            </body>
            </html>
            """

            await self._send_email(email, subject, html_content)

        except Exception as e:
            logger.error(f"发送验证邮件错误: {str(e)}")

    async def _send_password_reset_email(self, email: str, username: str, token: str):
        """发送密码重置邮件"""
        try:
            # 构建重置链接
            reset_url = f"https://your-domain.com/reset-password?token={token}"

            # 邮件内容
            subject = "密码重置请求 - Zishu Sensei"
            html_content = f"""
            <html>
            <body>
                <h2>密码重置请求</h2>
                <p>您好 {username}，</p>
                <p>我们收到了您的密码重置请求。请点击下面的链接重置您的密码：</p>
                <p><a href="{reset_url}">重置密码</a></p>
                <p>如果链接无法点击，请复制以下URL到浏览器：</p>
                <p>{reset_url}</p>
                <p>此链接将在 {self.config.reset_token_expire_minutes} 分钟后过期。</p>
                <p>如果这不是您的操作，请忽略此邮件。您的账户仍然安全。</p>
                <br>
                <p>Zishu Sensei 团队</p>
            </body>
            </html>
            """

            await self._send_email(email, subject, html_content)

        except Exception as e:
            logger.error(f"发送密码重置邮件错误: {str(e)}")

    async def _send_email(self, to_email: str, subject: str, html_content: str):
        """发送邮件"""
        try:
            if not self.config.email_username or not self.config.email_password:
                logger.warning("邮件配置不完整，无法发送邮件")
                return

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg[
                "From"
            ] = f"{self.config.email_from_name} <{self.config.email_from_address}>"
            msg["To"] = to_email

            html_part = MIMEText(html_content, "html")
            msg.attach(html_part)

            # 发送邮件
            with smtplib.SMTP(
                self.config.email_smtp_server, self.config.email_smtp_port
            ) as server:
                server.starttls()
                server.login(self.config.email_username, self.config.email_password)
                server.send_message(msg)

        except Exception as e:
            logger.error(f"发送邮件错误: {str(e)}")

    async def _log_auth_event(
        self,
        event_type: AuthEventType,
        username: str,
        ip_address: str,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """记录认证事件"""
        try:
            event = SecurityEvent(
                event_type=event_type.value,
                username=username,
                ip_address=ip_address,
                user_agent="",  # 可以从上下文获取
                timestamp=datetime.now(timezone.utc),
                metadata=metadata or {},
            )

            # 这里应该保存到数据库或发送到审计系统
            logger.info(
                f"认证事件: {event_type.value} - {username} - {ip_address} - {metadata}"
            )

        except Exception as e:
            logger.error(f"记录认证事件错误: {str(e)}")

    def _get_current_session_id(self) -> Optional[str]:
        """获取当前会话ID（从请求上下文）"""
        # 这里应该从请求上下文获取当前会话ID
        # 简化实现
        return None

    # ============ 数据库操作方法（需要根据实际数据库实现） ============

    async def _find_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """根据用户名查找用户"""
        # TODO: 实现数据库查询
        pass

    async def _find_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """根据邮箱查找用户"""
        # TODO: 实现数据库查询
        pass

    async def _find_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """根据ID查找用户"""
        # TODO: 实现数据库查询
        pass

    async def _is_username_taken(self, username: str) -> bool:
        """检查用户名是否已被使用"""
        user = await self._find_user_by_username(username)
        return user is not None

    async def _is_email_taken(self, email: str) -> bool:
        """检查邮箱是否已被使用"""
        user = await self._find_user_by_email(email)
        return user is not None

    async def _create_user(self, user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """创建新用户"""
        # TODO: 实现数据库插入
        pass

    async def _update_user_password(
        self, user_id: str, password_hash: str, old_password_hash: Optional[str] = None
    ):
        """更新用户密码"""
        # TODO: 实现数据库更新
        # 需要更新密码哈希并维护密码历史
        pass

    async def _verify_user_email(self, user_id: str):
        """设置用户邮箱为已验证"""
        # TODO: 实现数据库更新
        pass

    async def _enable_two_factor(
        self, user_id: str, secret_key: str, backup_codes: List[str]
    ):
        """启用用户的双因子认证"""
        # TODO: 实现数据库更新
        pass

    async def _disable_two_factor(self, user_id: str):
        """禁用用户的双因子认证"""
        # TODO: 实现数据库更新
        pass

    async def _get_user_2fa_data(self, user_id: str) -> Optional[Dict[str, Any]]:
        """获取用户的2FA数据"""
        # TODO: 实现数据库查询
        pass

    async def _update_user_backup_codes(self, user_id: str, backup_codes: List[str]):
        """更新用户的备用码"""
        # TODO: 实现数据库更新
        pass

    async def _can_request_password_reset(self, user_id: str) -> bool:
        """检查是否可以请求密码重置（频率限制）"""
        # TODO: 实现频率限制检查
        return True
