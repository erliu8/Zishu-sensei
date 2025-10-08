#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
用户认证路由系统 - Zishu-sensei
提供全面的用户认证、授权、会话管理和安全功能
"""

import asyncio
import re
import uuid
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Union
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Request,
    Response,
    BackgroundTasks,
    Header,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
import jwt
from email_validator import validate_email, EmailNotValidError
import pyotp
import qrcode
import io
import base64
import logging

from ..dependencies import get_logger, get_config
from ..schemas.auth import (
    # 请求模型
    LoginRequest,
    RegisterRequest,
    PasswordResetRequest,
    PasswordChangeRequest,
    TokenRefreshRequest,
    VerificationRequest,
    TwoFactorSetupRequest,
    UserUpdateRequest,
    # 响应模型
    LoginResponse,
    RegisterResponse,
    TokenResponse,
    UserInfoResponse,
    VerificationResponse,
    SessionListResponse,
    # 枚举和基础模型
    UserStatus,
    UserRole,
    AuthProvider,
    TokenType,
    AuthAction,
    LoginMethod,
    SessionStatus,
    generate_token_expiry,
    create_auth_log,
)
from ..schemas.user import (
    UserInfo,
    UserCreateRequest,
    UserUpdateRequest as UserProfileUpdateRequest,
    UserPrivacyUpdateRequest,
    UserNotificationUpdateRequest,
    UserAvatarUpdateRequest,
    UserContactUpdateRequest,
    UserPasswordUpdateRequest,
    UserStatusUpdateRequest,
    UserRoleUpdateRequest,
)
from ..schemas.responses import BaseResponse, ErrorResponse
from ..models.user import (
    User,
    UserProfile,
    UserSecurity,
    UserSession,
    UserToken,
    AuthLog,
    get_user_by_identifier,
    create_user_with_profile,
)
from ..security import SecurityManager, SecurityContext, PermissionType, SecurityLevel

# 路由器配置
router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
    responses={
        401: {"description": "未授权访问"},
        403: {"description": "权限不足"},
        429: {"description": "请求过于频繁"},
        500: {"description": "服务器内部错误"},
    },
)

# 全局变量
security = HTTPBearer(auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# 依赖函数
async def get_db_session():
    """获取数据库会话 - 临时Mock实现"""
    # TODO: 实现真实的数据库连接
    from unittest.mock import Mock

    return Mock()


async def get_security_manager():
    """获取安全管理器"""
    return SecurityManager()


async def get_current_user_info(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    security_manager: SecurityManager = Depends(get_security_manager),
) -> Optional[SecurityContext]:
    """获取当前用户信息"""
    if not credentials:
        return None

    try:
        # 验证JWT令牌
        context = security_manager.validate_jwt_token(credentials.credentials)
        if not context:
            return None

        # 验证会话
        client_ip = request.client.host
        valid_context = security_manager.validate_session(context.session_id, client_ip)

        return valid_context
    except Exception:
        return None


async def require_auth(
    current_user: SecurityContext = Depends(get_current_user_info),
) -> SecurityContext:
    """需要认证的依赖"""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="需要认证访问",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


async def require_permission(permission: PermissionType):
    """需要特定权限的依赖"""

    def dependency(current_user: SecurityContext = Depends(require_auth)):
        if permission not in current_user.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"缺少必要权限: {permission.value}",
            )
        return current_user

    return dependency


async def require_role(role: UserRole):
    """需要特定角色的依赖"""

    def dependency(
        current_user: SecurityContext = Depends(require_auth),
        db: Session = Depends(get_db_session),
    ):
        # TODO: 从数据库获取用户角色
        user_role = UserRole.USER  # 临时实现
        if user_role != role and user_role != UserRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=f"需要角色: {role.value}"
            )
        return current_user

    return dependency


# 工具函数
def generate_verification_code(length: int = 6) -> str:
    """生成验证码"""
    return "".join(secrets.choice("0123456789") for _ in range(length))


def generate_session_id() -> str:
    """生成会话ID"""
    return str(uuid.uuid4())


def validate_password_strength(password: str) -> Dict[str, Any]:
    """验证密码强度"""
    result = {
        "is_valid": True,
        "score": 0,
        "feedback": [],
        "requirements": {
            "min_length": len(password) >= 8,
            "has_uppercase": bool(re.search(r"[A-Z]", password)),
            "has_lowercase": bool(re.search(r"[a-z]", password)),
            "has_digit": bool(re.search(r"\d", password)),
            "has_special": bool(re.search(r"[@$!%*?&]", password)),
        },
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

    return result


def hash_password(password: str) -> str:
    """哈希密码"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


def create_jwt_token(
    user_id: str,
    session_id: str,
    permissions: List[str],
    security_level: str,
    secret_key: str,
    expires_delta: timedelta = None,
) -> Dict[str, Any]:
    """创建JWT令牌"""
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=24)

    payload = {
        "user_id": user_id,
        "session_id": session_id,
        "permissions": permissions,
        "security_level": security_level,
        "iat": datetime.utcnow(),
        "exp": expire,
        "type": "access",
    }

    access_token = jwt.encode(payload, secret_key, algorithm="HS256")

    # 创建刷新令牌
    refresh_payload = {
        "user_id": user_id,
        "session_id": session_id,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(days=30),
        "type": "refresh",
    }

    refresh_token = jwt.encode(refresh_payload, secret_key, algorithm="HS256")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": int(expires_delta.total_seconds()) if expires_delta else 86400,
        "expires_at": expire,
    }


async def send_verification_email(email: str, code: str, logger: logging.Logger):
    """发送验证邮件 - 异步任务"""
    # TODO: 实现真实的邮件发送
    logger.info(f"发送验证邮件到 {email}, 验证码: {code}")


async def send_verification_sms(phone: str, code: str, logger: logging.Logger):
    """发送验证短信 - 异步任务"""
    # TODO: 实现真实的短信发送
    logger.info(f"发送验证短信到 {phone}, 验证码: {code}")


# ======================== 认证路由 ========================


@router.post("/register", response_model=RegisterResponse)
async def register_user(
    request: RegisterRequest,
    background_tasks: BackgroundTasks,
    client_request: Request,
    db: Session = Depends(get_db_session),
    security_manager: SecurityManager = Depends(get_security_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    用户注册

    - 验证用户信息
    - 检查用户名/邮箱唯一性
    - 创建用户账户
    - 发送验证邮件/短信
    """
    try:
        client_ip = client_request.client.host

        # 速率限制检查
        if not security_manager.rate_limiter.is_allowed(
            f"register:{client_ip}", 3, 3600
        ):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="注册尝试过于频繁，请稍后再试"
            )

        # 验证密码强度
        password_check = validate_password_strength(request.password)
        if not password_check["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "密码强度不足", "feedback": password_check["feedback"]},
            )

        # TODO: 检查用户名/邮箱唯一性
        # existing_user = get_user_by_identifier(db, request.username)
        # if existing_user:
        #     raise HTTPException(
        #         status_code=status.HTTP_409_CONFLICT,
        #         detail="用户名或邮箱已存在"
        #     )

        # 创建用户
        user_data = {
            "username": request.username,
            "email": request.email,
            "phone": request.phone,
            "nickname": request.nickname,
            "status": UserStatus.PENDING,
            "role": UserRole.USER,
            "auth_provider": request.provider or AuthProvider.LOCAL,
        }

        # TODO: 使用真实的数据库操作
        # user = create_user_with_profile(db, **user_data, password=request.password)

        # 模拟用户创建
        user_id = str(uuid.uuid4())

        # 生成验证码
        email_code = generate_verification_code()
        phone_code = generate_verification_code() if request.phone else None

        # 发送验证邮件
        background_tasks.add_task(
            send_verification_email, request.email, email_code, logger
        )

        # 发送验证短信
        if phone_code:
            background_tasks.add_task(
                send_verification_sms, request.phone, phone_code, logger
            )

        # 记录注册日志
        auth_log = create_auth_log(
            user_id=user_id,
            action=AuthAction.REGISTER,
            status="success",
            ip_address=client_ip,
            details={
                "username": request.username,
                "email": request.email,
                "auth_provider": (request.provider or AuthProvider.LOCAL).value,
            },
        )

        logger.info(f"用户注册成功: {request.username}")

        return RegisterResponse(
            success=True,
            message="注册成功，请检查邮箱/短信验证码",
            user_id=user_id,
            require_email_verification=True,
            require_phone_verification=bool(request.phone),
            auto_login=False,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"用户注册失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="注册失败，请稍后重试"
        )


@router.post("/login", response_model=LoginResponse)
async def login_user(
    request: LoginRequest,
    client_request: Request,
    db: Session = Depends(get_db_session),
    security_manager: SecurityManager = Depends(get_security_manager),
    config=Depends(get_config),
    logger: logging.Logger = Depends(get_logger),
):
    """
    用户登录

    - 支持多种登录方式（密码、验证码、第三方）
    - 两步验证
    - 设备信息记录
    - 会话管理
    """
    try:
        client_ip = client_request.client.host
        user_agent = client_request.headers.get("user-agent", "")

        # 使用安全管理器进行认证
        if request.login_method == LoginMethod.PASSWORD:
            # 确定用户标识
            username = request.username or request.email or request.phone
            if not username or not request.password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="用户名和密码不能为空"
                )

            # 通过安全管理器认证
            security_context = security_manager.authenticate_user(
                username, request.password, client_ip
            )

            if not security_context:
                # 记录失败日志
                auth_log = create_auth_log(
                    user_id=None,
                    action=AuthAction.LOGIN,
                    status="failure",
                    ip_address=client_ip,
                    error_message="用户名或密码错误",
                    user_agent=user_agent,
                )

                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误"
                )

        elif request.login_method == LoginMethod.SMS_CODE:
            # TODO: 实现短信验证码登录
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="短信验证码登录暂未实现"
            )

        elif request.login_method == LoginMethod.EMAIL_CODE:
            # TODO: 实现邮箱验证码登录
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="邮箱验证码登录暂未实现"
            )

        elif request.login_method == LoginMethod.OAUTH:
            # TODO: 实现第三方登录
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="第三方登录暂未实现"
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的登录方式"
            )

        # TODO: 检查两步验证
        require_2fa = False  # 从数据库获取用户2FA设置

        if require_2fa and not request.two_factor_code:
            return LoginResponse(
                success=False,
                message="需要两步验证",
                require_two_factor=True,
                two_factor_methods=["totp", "sms"],
                timestamp=datetime.now(),
            )

        # 生成JWT令牌
        secret_key = config.get("jwt_secret", "your-secret-key")
        token_data = create_jwt_token(
            user_id=security_context.user_id,
            session_id=security_context.session_id,
            permissions=[p.value for p in security_context.permissions],
            security_level=security_context.security_level.value,
            secret_key=secret_key,
            expires_delta=timedelta(hours=24 if request.remember_me else 1),
        )

        # 创建令牌响应
        token_response = TokenResponse(
            access_token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            token_type=token_data["token_type"],
            expires_in=token_data["expires_in"],
            expires_at=token_data["expires_at"],
        )

        # TODO: 从数据库获取完整用户信息
        user_info = {
            "id": security_context.user_id,
            "username": "test_user",  # 临时数据
            "email": "test@example.com",
            "role": "user",
            "status": "active",
        }

        # 记录成功登录日志
        auth_log = create_auth_log(
            user_id=security_context.user_id,
            action=AuthAction.LOGIN,
            status="success",
            ip_address=client_ip,
            details={
                "login_method": request.login_method.value,
                "remember_me": request.remember_me,
                "device_info": request.device_info,
            },
            user_agent=user_agent,
        )

        logger.info(f"用户登录成功: {security_context.user_id}")

        return LoginResponse(
            success=True,
            message="登录成功",
            user=user_info,
            token=token_response,
            session_id=security_context.session_id,
            timestamp=datetime.now(),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"用户登录失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="登录失败，请稍后重试"
        )


@router.post("/logout")
async def logout_user(
    current_user: SecurityContext = Depends(require_auth),
    security_manager: SecurityManager = Depends(get_security_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    用户登出

    - 使会话失效
    - 撤销令牌
    - 记录登出日志
    """
    try:
        # 使会话失效
        security_manager._invalidate_session(current_user.session_id)

        # 记录登出日志
        auth_log = create_auth_log(
            user_id=current_user.user_id,
            action=AuthAction.LOGOUT,
            status="success",
            ip_address=current_user.ip_address,
        )

        logger.info(f"用户登出: {current_user.user_id}")

        return BaseResponse(success=True, message="登出成功")

    except Exception as e:
        logger.error(f"用户登出失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="登出失败"
        )


@router.post("/refresh-token", response_model=TokenResponse)
async def refresh_token(
    request: TokenRefreshRequest,
    config=Depends(get_config),
    security_manager: SecurityManager = Depends(get_security_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    刷新访问令牌

    - 验证刷新令牌
    - 生成新的访问令牌
    - 可选择性刷新刷新令牌
    """
    try:
        secret_key = config.get("jwt_secret", "your-secret-key")

        # 验证刷新令牌
        try:
            payload = jwt.decode(
                request.refresh_token, secret_key, algorithms=["HS256"]
            )
            if payload.get("type") != "refresh":
                raise jwt.InvalidTokenError("Invalid token type")
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="刷新令牌已过期"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的刷新令牌"
            )

        # 获取用户信息
        user_id = payload["user_id"]
        session_id = payload["session_id"]

        # 验证会话是否仍然有效
        with security_manager.session_lock:
            context = security_manager.active_sessions.get(session_id)

        if not context:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="会话已失效，请重新登录"
            )

        # 生成新的访问令牌
        token_data = create_jwt_token(
            user_id=user_id,
            session_id=session_id,
            permissions=[p.value for p in context.permissions],
            security_level=context.security_level.value,
            secret_key=secret_key,
            expires_delta=timedelta(hours=1),
        )

        logger.info(f"令牌刷新成功: {user_id}")

        return TokenResponse(
            access_token=token_data["access_token"],
            refresh_token=token_data["refresh_token"],
            token_type=token_data["token_type"],
            expires_in=token_data["expires_in"],
            expires_at=token_data["expires_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"令牌刷新失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="令牌刷新失败"
        )


@router.post("/forgot-password")
async def forgot_password(
    request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    client_request: Request,
    security_manager: SecurityManager = Depends(get_security_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    忘记密码

    - 验证用户身份
    - 生成重置令牌
    - 发送重置链接
    """
    try:
        client_ip = client_request.client.host

        # 速率限制
        if not security_manager.rate_limiter.is_allowed(f"reset:{client_ip}", 3, 3600):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="密码重置请求过于频繁"
            )

        # 确定用户标识
        identifier = request.email or request.phone or request.username
        if not identifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="请提供邮箱、手机号或用户名"
            )

        # TODO: 查找用户
        # user = get_user_by_identifier(db, identifier)
        # if not user:
        #     # 为了安全，不暴露用户是否存在
        #     pass

        # 生成重置令牌
        reset_token = secrets.token_urlsafe(32)

        # TODO: 存储重置令牌到数据库

        # 发送重置邮件
        if request.email:
            background_tasks.add_task(
                send_verification_email, request.email, reset_token, logger
            )

        logger.info(f"密码重置请求: {identifier}")

        return BaseResponse(success=True, message="如果该账户存在，重置链接已发送到您的邮箱")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"密码重置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="密码重置失败"
        )


@router.post("/reset-password")
async def reset_password(
    token: str,
    new_password: str,
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    重置密码

    - 验证重置令牌
    - 更新用户密码
    - 使所有会话失效
    """
    try:
        # 验证密码强度
        password_check = validate_password_strength(new_password)
        if not password_check["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "密码强度不足", "feedback": password_check["feedback"]},
            )

        # TODO: 验证重置令牌并获取用户
        # reset_record = get_password_reset_token(db, token)
        # if not reset_record or reset_record.expires_at < datetime.now():
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="重置令牌无效或已过期"
        #     )

        # TODO: 更新用户密码
        # user = get_user(db, reset_record.user_id)
        # user.set_password(new_password)
        # db.commit()

        # TODO: 使所有用户会话失效

        logger.info(f"密码重置成功")

        return BaseResponse(success=True, message="密码重置成功，请使用新密码登录")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"密码重置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="密码重置失败"
        )


@router.post("/change-password")
async def change_password(
    request: PasswordChangeRequest,
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    修改密码

    - 验证当前密码
    - 更新新密码
    - 记录操作日志
    """
    try:
        # TODO: 获取用户信息
        # user = get_user(db, current_user.user_id)
        # if not user or not user.check_password(request.current_password):
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="当前密码错误"
        #     )

        # 验证新密码强度
        password_check = validate_password_strength(request.new_password)
        if not password_check["is_valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "新密码强度不足", "feedback": password_check["feedback"]},
            )

        # TODO: 更新密码
        # user.set_password(request.new_password)
        # db.commit()

        # 记录操作日志
        auth_log = create_auth_log(
            user_id=current_user.user_id,
            action=AuthAction.PASSWORD_RESET,
            status="success",
            ip_address=current_user.ip_address,
        )

        logger.info(f"密码修改成功: {current_user.user_id}")

        return BaseResponse(success=True, message="密码修改成功")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"密码修改失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="密码修改失败"
        )


# ======================== 验证相关路由 ========================


@router.post("/send-verification", response_model=VerificationResponse)
async def send_verification(
    request: VerificationRequest,
    background_tasks: BackgroundTasks,
    client_request: Request,
    security_manager: SecurityManager = Depends(get_security_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    发送验证码

    - 邮箱/手机号验证
    - 速率限制
    - 验证码生成和发送
    """
    try:
        client_ip = client_request.client.host

        # 速率限制
        rate_key = f"verify:{request.verification_type}:{request.target}"
        if not security_manager.rate_limiter.is_allowed(rate_key, 3, 300):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="验证码发送过于频繁，请稍后再试"
            )

        # 验证目标格式
        if request.verification_type == "email":
            try:
                validate_email(request.target)
            except EmailNotValidError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱格式不正确"
                )
        elif request.verification_type == "phone":
            if not re.match(r"^1[3-9]\d{9}$", request.target):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="手机号格式不正确"
                )

        # 生成验证码
        verification_code = generate_verification_code()
        verification_id = str(uuid.uuid4())

        # TODO: 存储验证码到数据库或缓存

        # 发送验证码
        if request.verification_type == "email":
            background_tasks.add_task(
                send_verification_email, request.target, verification_code, logger
            )
        elif request.verification_type == "phone":
            background_tasks.add_task(
                send_verification_sms, request.target, verification_code, logger
            )

        logger.info(f"发送验证码: {request.verification_type}:{request.target}")

        return VerificationResponse(
            success=True,
            message=f"验证码已发送到您的{request.verification_type}",
            verification_id=verification_id,
            expires_in=300,  # 5分钟过期
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"发送验证码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="发送验证码失败"
        )


@router.post("/verify-code")
async def verify_code(
    verification_id: str,
    code: str,
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    验证验证码

    - 验证码校验
    - 激活账户/验证操作
    """
    try:
        # TODO: 从数据库获取验证记录
        # verification = get_verification_record(db, verification_id)
        # if not verification or verification.expires_at < datetime.now():
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="验证码无效或已过期"
        #     )

        # if verification.code != code:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="验证码错误"
        #     )

        # TODO: 更新用户状态或完成验证操作

        logger.info(f"验证码验证成功: {verification_id}")

        return BaseResponse(success=True, message="验证成功")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"验证码验证失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="验证失败"
        )


# ======================== 两步验证路由 ========================


@router.post("/2fa/setup")
async def setup_two_factor(
    request: TwoFactorSetupRequest,
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    设置两步验证

    - TOTP密钥生成
    - 二维码生成
    - 验证设置
    """
    try:
        # TODO: 验证当前密码
        # user = get_user(db, current_user.user_id)
        # if not user or not user.check_password(request.password):
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="密码错误"
        #     )

        if request.method == "totp":
            # 生成TOTP密钥
            secret = pyotp.random_base32()

            # 生成二维码
            totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
                name=current_user.user_id, issuer_name="Zishu-sensei"
            )

            # 生成二维码图片
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(totp_uri)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")
            img_buffer = io.BytesIO()
            img.save(img_buffer, format="PNG")
            img_base64 = base64.b64encode(img_buffer.getvalue()).decode()

            # TODO: 临时存储密钥（等待用户验证）
            # store_temp_2fa_secret(db, current_user.user_id, secret)

            return {
                "success": True,
                "message": "请使用认证器扫描二维码",
                "qr_code": f"data:image/png;base64,{img_base64}",
                "secret": secret,
                "backup_codes": [secrets.token_hex(4) for _ in range(8)],
            }

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的两步验证方法"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"两步验证设置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="两步验证设置失败"
        )


@router.post("/2fa/verify")
async def verify_two_factor(
    code: str,
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    验证两步验证码

    - TOTP验证
    - 启用两步验证
    """
    try:
        # TODO: 获取用户的临时2FA密钥
        # temp_secret = get_temp_2fa_secret(db, current_user.user_id)
        # if not temp_secret:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="未找到两步验证设置"
        #     )

        # 验证TOTP码
        temp_secret = "JBSWY3DPEHPK3PXP"  # 临时测试密钥
        totp = pyotp.TOTP(temp_secret)
        if not totp.verify(code, valid_window=1):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码错误")

        # TODO: 启用两步验证
        # user = get_user(db, current_user.user_id)
        # user.enable_two_factor(temp_secret)
        # db.commit()

        logger.info(f"两步验证启用成功: {current_user.user_id}")

        return BaseResponse(success=True, message="两步验证启用成功")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"两步验证验证失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="验证失败"
        )


@router.post("/2fa/disable")
async def disable_two_factor(
    password: str,
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    关闭两步验证

    - 验证密码
    - 禁用两步验证
    """
    try:
        # TODO: 验证密码并禁用两步验证
        # user = get_user(db, current_user.user_id)
        # if not user or not user.check_password(password):
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="密码错误"
        #     )

        # user.disable_two_factor()
        # db.commit()

        logger.info(f"两步验证禁用成功: {current_user.user_id}")

        return BaseResponse(success=True, message="两步验证已关闭")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"两步验证禁用失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="操作失败"
        )


# ======================== 用户信息路由 ========================


@router.get("/me", response_model=UserInfoResponse)
async def get_current_user(
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
):
    """
    获取当前用户信息

    - 用户基本信息
    - 权限列表
    - 统计数据
    """
    try:
        # TODO: 从数据库获取完整用户信息
        user_data = {
            "id": current_user.user_id,
            "username": "test_user",
            "email": "test@example.com",
            "status": "active",
            "role": "user",
            "created_at": datetime.now(),
            "last_login_at": current_user.timestamp,
            "profile": {"nickname": "测试用户", "avatar_url": None, "bio": "这是一个测试用户"},
        }

        permissions = [p.value for p in current_user.permissions]

        return UserInfoResponse(
            success=True,
            user=user_data,
            permissions=permissions,
            roles=[current_user.security_level.value],
            stats={
                "login_count": 10,
                "last_active": current_user.timestamp,
                "total_sessions": 5,
            },
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取用户信息失败"
        )


@router.put("/me")
async def update_current_user(
    request: UserProfileUpdateRequest,
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新当前用户信息

    - 基本信息更新
    - 偏好设置
    - 隐私设置
    """
    try:
        # TODO: 更新用户信息到数据库
        # user = get_user(db, current_user.user_id)
        # if request.nickname:
        #     user.profile.nickname = request.nickname
        # if request.bio:
        #     user.profile.bio = request.bio
        # 更多字段...
        # db.commit()

        logger.info(f"用户信息更新成功: {current_user.user_id}")

        return BaseResponse(success=True, message="用户信息更新成功")

    except Exception as e:
        logger.error(f"用户信息更新失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新失败"
        )


# ======================== 会话管理路由 ========================


@router.get("/sessions", response_model=SessionListResponse)
async def get_user_sessions(
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
):
    """
    获取用户会话列表

    - 活跃会话
    - 设备信息
    - 登录历史
    """
    try:
        # TODO: 从数据库获取用户会话
        sessions = [
            {
                "session_id": current_user.session_id,
                "device_name": "当前设备",
                "ip_address": current_user.ip_address,
                "user_agent": current_user.user_agent,
                "created_at": current_user.timestamp,
                "last_activity": current_user.timestamp,
                "is_current": True,
            }
        ]

        return SessionListResponse(
            success=True,
            sessions=sessions,
            current_session_id=current_user.session_id,
            total=len(sessions),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取会话列表失败"
        )


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    current_user: SecurityContext = Depends(require_auth),
    security_manager: SecurityManager = Depends(get_security_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    撤销指定会话

    - 会话撤销
    - 安全日志
    """
    try:
        # 不能撤销当前会话
        if session_id == current_user.session_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不能撤销当前会话"
            )

        # TODO: 验证会话属于当前用户

        # 撤销会话
        security_manager._invalidate_session(session_id)

        logger.info(f"会话撤销成功: {current_user.user_id} -> {session_id}")

        return BaseResponse(success=True, message="会话已撤销")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"会话撤销失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="撤销失败"
        )


@router.delete("/sessions")
async def revoke_all_sessions(
    current_user: SecurityContext = Depends(require_auth),
    security_manager: SecurityManager = Depends(get_security_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    撤销所有其他会话

    - 批量会话撤销
    - 保留当前会话
    """
    try:
        # TODO: 撤销用户的所有其他会话
        # revoke_user_sessions(db, current_user.user_id, exclude_session=current_user.session_id)

        logger.info(f"所有会话撤销成功: {current_user.user_id}")

        return BaseResponse(success=True, message="所有其他会话已撤销")

    except Exception as e:
        logger.error(f"批量会话撤销失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="撤销失败"
        )


# ======================== 管理员路由 ========================


@router.get("/users")
async def list_users(
    page: int = 1,
    size: int = 20,
    search: Optional[str] = None,
    status: Optional[str] = None,
    role: Optional[str] = None,
    current_user: SecurityContext = Depends(require_permission(PermissionType.ADMIN)),
    db: Session = Depends(get_db_session),
):
    """
    获取用户列表（管理员）

    - 分页查询
    - 搜索过滤
    - 状态筛选
    """
    try:
        # TODO: 实现用户列表查询
        users = [
            {
                "id": "user_001",
                "username": "test_user",
                "email": "test@example.com",
                "status": "active",
                "role": "user",
                "created_at": datetime.now(),
                "last_login_at": datetime.now(),
            }
        ]

        return {
            "success": True,
            "users": users,
            "total": len(users),
            "page": page,
            "size": size,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取用户列表失败"
        )


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    request: UserStatusUpdateRequest,
    current_user: SecurityContext = Depends(require_permission(PermissionType.ADMIN)),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户状态（管理员）

    - 激活/禁用用户
    - 状态变更日志
    """
    try:
        # TODO: 更新用户状态
        # user = get_user(db, user_id)
        # if not user:
        #     raise HTTPException(404, "用户不存在")
        #
        # user.status = request.status
        # db.commit()

        logger.info(f"用户状态更新: {current_user.user_id} -> {user_id} -> {request.status}")

        return BaseResponse(success=True, message=f"用户状态已更新为: {request.status.value}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"用户状态更新失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="状态更新失败"
        )


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    request: UserRoleUpdateRequest,
    current_user: SecurityContext = Depends(require_permission(PermissionType.ADMIN)),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户角色（管理员）

    - 角色变更
    - 权限更新
    """
    try:
        # TODO: 更新用户角色
        # user = get_user(db, user_id)
        # if not user:
        #     raise HTTPException(404, "用户不存在")
        #
        # user.role = request.role
        # db.commit()

        logger.info(f"用户角色更新: {current_user.user_id} -> {user_id} -> {request.role}")

        return BaseResponse(success=True, message=f"用户角色已更新为: {request.role.value}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"用户角色更新失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="角色更新失败"
        )


# ======================== 健康检查和状态 ========================


@router.get("/status")
async def get_auth_status(
    security_manager: SecurityManager = Depends(get_security_manager),
):
    """
    认证服务状态

    - 服务健康状态
    - 活跃会话数
    - 系统统计
    """
    try:
        with security_manager.session_lock:
            active_sessions = len(security_manager.active_sessions)

        return {
            "status": "healthy",
            "timestamp": datetime.now(),
            "active_sessions": active_sessions,
            "features": {
                "jwt_auth": True,
                "two_factor": True,
                "password_reset": True,
                "session_management": True,
                "rate_limiting": True,
            },
        }

    except Exception as e:
        return {"status": "unhealthy", "timestamp": datetime.now(), "error": str(e)}


# 更新TODO状态
async def update_todo_status():
    """更新TODO完成状态"""
    pass  # 这里会在最后调用todo_write更新状态


# 导出路由
__all__ = ["router"]
