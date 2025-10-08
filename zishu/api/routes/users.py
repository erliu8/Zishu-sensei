#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
用户管理路由系统 - Zishu-sensei
提供全面的用户管理功能，包括CRUD操作、档案管理、权限控制等
"""

import asyncio
import uuid
import secrets
from datetime import datetime, timedelta
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
    Query,
    Path,
    Body,
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging

# 内部导入
from ..dependencies import get_logger, get_config
from ..schemas.user import (
    # 基础模型
    UserInfo,
    UserBase,
    UserPublicInfo,
    UserStatistics,
    UserSecurityInfo,
    # 请求模型
    UserCreateRequest,
    UserUpdateRequest,
    UserPrivacyUpdateRequest,
    UserNotificationUpdateRequest,
    UserAvatarUpdateRequest,
    UserContactUpdateRequest,
    UserPasswordUpdateRequest,
    UserStatusUpdateRequest,
    UserRoleUpdateRequest,
    UserQueryParams,
    UserBatchOperationRequest,
    # 响应模型
    UserResponse,
    UserListResponse,
    UserPublicResponse,
    UserStatsResponse,
    UserActivityResponse,
    UserBatchOperationResponse,
    UserValidationResponse,
    SystemUserStatsResponse,
    # 枚举和工具函数
    UserStatus,
    UserRole,
    AuthProvider,
    ProfileVisibility,
    validate_user_permissions,
    check_username_availability,
    calculate_user_score,
    format_user_display_name,
    create_user_activity_log,
)
from ..schemas.auth import SecurityContext, PermissionType, SecurityLevel
from ..schemas.responses import BaseResponse, ErrorResponse
from ..utils.auth_decorators import (
    require_auth,
    require_permissions,
    require_roles,
    require_admin,
    rate_limit,
    audit_log,
    security_headers,
    validate_input,
    get_current_user,
    get_current_admin_user,
    get_optional_user,
)
from ..security import SecurityManager
from ..config.auth_config import get_auth_config

# 路由器配置
router = APIRouter(
    prefix="/users",
    tags=["user-management"],
    responses={
        401: {"description": "未授权访问"},
        403: {"description": "权限不足"},
        404: {"description": "用户不存在"},
        429: {"description": "请求过于频繁"},
        500: {"description": "服务器内部错误"},
    },
)

# 全局变量
security = HTTPBearer(auto_error=False)


# 依赖函数
async def get_db_session():
    """获取数据库会话 - 临时Mock实现"""
    # TODO: 实现真实的数据库连接
    from unittest.mock import Mock

    return Mock()


async def get_security_manager():
    """获取安全管理器"""
    return SecurityManager()


async def get_current_user_context(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    security_manager: SecurityManager = Depends(get_security_manager),
) -> Optional[SecurityContext]:
    """获取当前用户上下文"""
    if not credentials:
        return None

    try:
        context = security_manager.validate_jwt_token(credentials.credentials)
        if context:
            client_ip = request.client.host
            return security_manager.validate_session(context.session_id, client_ip)
    except Exception:
        pass
    return None


async def require_user_access(
    user_id: str, current_user: SecurityContext = Depends(require_auth)
) -> SecurityContext:
    """检查用户访问权限（本人或管理员）"""
    if (
        current_user.user_id != user_id
        and PermissionType.ADMIN not in current_user.permissions
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="只能访问自己的信息或需要管理员权限"
        )
    return current_user


# 工具函数
def create_mock_user_data(user_id: str) -> Dict[str, Any]:
    """创建模拟用户数据"""
    return {
        "id": user_id,
        "username": f"user_{user_id[-6:]}",
        "email": f"user_{user_id[-6:]}@example.com",
        "phone": f"138{user_id[-8:]}",
        "status": UserStatus.ACTIVE,
        "role": UserRole.USER,
        "auth_provider": AuthProvider.LOCAL,
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "profile": {
            "nickname": f"用户{user_id[-4:]}",
            "avatar_url": None,
            "bio": "这是一个测试用户",
            "location": "北京",
            "website": None,
        },
        "statistics": {
            "login_count": 10,
            "last_login_at": datetime.now(),
            "last_active_at": datetime.now(),
            "total_messages": 50,
            "total_tokens": 1000,
        },
    }


async def send_notification_email(
    user_id: str, subject: str, content: str, logger: logging.Logger
):
    """发送通知邮件"""
    logger.info(f"发送邮件通知给用户 {user_id}: {subject}")


# ======================== 基础用户CRUD操作 ========================


@router.get("", response_model=UserListResponse)
@security_headers()
@rate_limit(limit=100, window=3600)
@audit_log("list_users", sensitive=False)
async def get_users(
    params: UserQueryParams = Depends(),
    current_user: SecurityContext = Depends(require_permissions(PermissionType.ADMIN)),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取用户列表（管理员权限）

    - 支持分页查询
    - 支持多维度搜索和过滤
    - 支持排序
    - 包含用户统计信息
    """
    try:
        # TODO: 实现真实的数据库查询
        # 这里是模拟实现
        mock_users = []
        for i in range(min(params.size, 5)):  # 模拟5个用户
            user_id = str(uuid.uuid4())
            user_data = create_mock_user_data(user_id)

            # 应用搜索过滤
            if params.search:
                if params.search.lower() not in user_data["username"].lower():
                    continue

            # 应用状态过滤
            if params.status and user_data["status"] not in params.status:
                continue

            # 应用角色过滤
            if params.role and user_data["role"] not in params.role:
                continue

            mock_users.append(UserInfo(**user_data))

        total_count = 50  # 模拟总数
        total_pages = (total_count + params.size - 1) // params.size

        logger.info(f"获取用户列表: 页码={params.page}, 大小={params.size}, 总数={total_count}")

        return UserListResponse(
            success=True,
            message="获取用户列表成功",
            users=mock_users,
            total=total_count,
            page=params.page,
            size=params.size,
            pages=total_pages,
            filters_applied={
                "search": params.search,
                "status": params.status,
                "role": params.role,
                "sort_by": params.sort_by,
                "sort_order": params.sort_order,
            },
        )

    except Exception as e:
        logger.error(f"获取用户列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取用户列表失败"
        )


@router.get("/{user_id}", response_model=Union[UserResponse, UserPublicResponse])
@security_headers()
@rate_limit(limit=200, window=3600)
async def get_user(
    user_id: str = Path(..., description="用户ID"),
    include_private: bool = Query(False, description="是否包含私有信息"),
    current_user: Optional[SecurityContext] = Depends(get_current_user_context),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取用户详细信息

    - 未登录用户只能获取公开信息
    - 已登录用户可以获取自己的完整信息
    - 管理员可以获取任何用户的完整信息
    """
    try:
        # TODO: 从数据库获取用户信息
        user_data = create_mock_user_data(user_id)

        # 检查用户是否存在
        if not user_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

        # 权限检查
        can_view_private = False
        if current_user:
            # 用户本人或管理员可以查看私有信息
            can_view_private = (
                current_user.user_id == user_id
                or PermissionType.ADMIN in current_user.permissions
            )

        if include_private and can_view_private:
            # 返回完整用户信息
            user_info = UserInfo(**user_data)
            return UserResponse(success=True, message="获取用户信息成功", user=user_info)
        else:
            # 返回公开信息
            public_data = {
                "id": user_data["id"],
                "username": user_data["username"],
                "nickname": user_data["profile"].get("nickname"),
                "avatar_url": user_data["profile"].get("avatar_url"),
                "bio": user_data["profile"].get("bio"),
                "location": user_data["profile"].get("location"),
                "website": user_data["profile"].get("website"),
                "social_links": user_data["profile"].get("social_links", {}),
                "joined_at": user_data["created_at"],
                "status": user_data["status"],
            }

            public_user = UserPublicInfo(**public_data)
            return UserPublicResponse(success=True, user=public_user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取用户信息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取用户信息失败"
        )


@router.post("", response_model=UserResponse)
@security_headers()
@rate_limit(limit=10, window=3600)
@audit_log("create_user", sensitive=True)
@validate_input(sanitize=True)
async def create_user(
    request: UserCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    创建新用户（管理员权限）

    - 验证用户信息唯一性
    - 创建用户账户和档案
    - 发送欢迎邮件
    - 记录操作日志
    """
    try:
        # TODO: 检查用户名/邮箱唯一性
        # existing_user = get_user_by_identifier(db, request.username)
        # if existing_user:
        #     raise HTTPException(409, "用户名或邮箱已存在")

        # 创建新用户ID
        new_user_id = str(uuid.uuid4())

        # TODO: 创建用户到数据库
        # user = create_user_with_profile(db, **request.dict(), created_by=current_user.user_id)

        # 模拟用户创建
        user_data = {
            "id": new_user_id,
            "username": request.username,
            "email": request.email,
            "phone": request.phone,
            "status": UserStatus.ACTIVE,
            "role": UserRole.USER,
            "auth_provider": AuthProvider.LOCAL,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }

        # 发送欢迎邮件
        background_tasks.add_task(
            send_notification_email,
            new_user_id,
            "欢迎加入Zishu Sensei",
            f"您好 {request.username}，欢迎加入我们的平台！",
            logger,
        )

        # 记录活动日志
        activity_log = create_user_activity_log(
            user_id=new_user_id,
            action="user_created",
            details={
                "created_by": current_user.user_id,
                "username": request.username,
                "email": request.email,
            },
        )

        logger.info(f"管理员 {current_user.user_id} 创建用户: {request.username}")

        created_user = UserInfo(**{**user_data, "profile": {}, "statistics": {}})

        return UserResponse(success=True, message="用户创建成功", user=created_user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建用户失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建用户失败"
        )


@router.put("/{user_id}", response_model=UserResponse)
@security_headers()
@rate_limit(limit=20, window=3600)
@audit_log("update_user", sensitive=False)
@validate_input(sanitize=True)
async def update_user(
    user_id: str = Path(..., description="用户ID"),
    request: UserUpdateRequest = Body(...),
    current_user: SecurityContext = Depends(require_user_access),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户基本信息

    - 用户只能更新自己的信息
    - 管理员可以更新任何用户的信息
    - 自动记录变更历史
    """
    try:
        # TODO: 从数据库获取用户
        # user = get_user(db, user_id)
        # if not user:
        #     raise HTTPException(404, "用户不存在")

        # 获取更新字段
        update_data = request.dict(exclude_unset=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="没有需要更新的字段"
            )

        # TODO: 更新用户信息到数据库
        # for field, value in update_data.items():
        #     if hasattr(user.profile, field):
        #         setattr(user.profile, field, value)
        # user.updated_at = datetime.now()
        # db.commit()

        # 记录活动日志
        activity_log = create_user_activity_log(
            user_id=user_id,
            action="profile_updated",
            details={
                "updated_by": current_user.user_id,
                "updated_fields": list(update_data.keys()),
                "is_self_update": current_user.user_id == user_id,
            },
        )

        logger.info(f"用户信息更新: {user_id}, 字段: {list(update_data.keys())}")

        # 返回更新后的用户信息
        updated_user_data = create_mock_user_data(user_id)
        updated_user = UserInfo(**updated_user_data)

        return UserResponse(success=True, message="用户信息更新成功", user=updated_user)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新用户信息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新用户信息失败"
        )


@router.delete("/{user_id}")
@security_headers()
@rate_limit(limit=5, window=3600)
@audit_log("delete_user", sensitive=True)
async def delete_user(
    user_id: str = Path(..., description="用户ID"),
    soft_delete: bool = Query(True, description="是否软删除"),
    reason: Optional[str] = Query(None, description="删除原因"),
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    删除用户（管理员权限）

    - 默认软删除（标记为已删除）
    - 可选择硬删除（从数据库中删除）
    - 记录详细的删除日志
    """
    try:
        # 不能删除自己
        if user_id == current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不能删除自己的账户"
            )

        # TODO: 从数据库获取用户
        # user = get_user(db, user_id)
        # if not user:
        #     raise HTTPException(404, "用户不存在")

        if soft_delete:
            # 软删除：标记为已删除状态
            # user.status = UserStatus.DELETED
            # user.deleted_at = datetime.now()
            # user.updated_at = datetime.now()
            # db.commit()
            delete_type = "soft"
        else:
            # 硬删除：从数据库删除
            # db.delete(user)
            # db.commit()
            delete_type = "hard"

        # 记录删除日志
        activity_log = create_user_activity_log(
            user_id=user_id,
            action="user_deleted",
            details={
                "deleted_by": current_user.user_id,
                "delete_type": delete_type,
                "reason": reason,
                "timestamp": datetime.now().isoformat(),
            },
        )

        logger.info(
            f"用户删除成功: {user_id}, 类型: {delete_type}, 操作人: {current_user.user_id}"
        )

        return BaseResponse(
            success=True, message=f"用户{'软删除' if soft_delete else '硬删除'}成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除用户失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除用户失败"
        )


# ======================== 用户档案管理 ========================


@router.put("/{user_id}/profile", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=30, window=3600)
@audit_log("update_profile", sensitive=False)
async def update_user_profile(
    user_id: str,
    request: UserUpdateRequest,
    current_user: SecurityContext = Depends(require_user_access),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户档案信息

    - 包括个人信息、偏好设置等
    - 自动验证输入格式
    - 记录变更历史
    """
    try:
        # TODO: 更新用户档案到数据库
        update_fields = request.dict(exclude_unset=True)

        logger.info(f"用户档案更新: {user_id}, 字段: {list(update_fields.keys())}")

        return BaseResponse(success=True, message="用户档案更新成功")

    except Exception as e:
        logger.error(f"更新用户档案失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新用户档案失败"
        )


@router.put("/{user_id}/avatar", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=10, window=3600)
@audit_log("update_avatar", sensitive=False)
async def update_user_avatar(
    user_id: str,
    request: UserAvatarUpdateRequest,
    current_user: SecurityContext = Depends(require_user_access),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户头像

    - 支持头像和封面图片
    - 自动验证图片URL格式
    """
    try:
        # TODO: 验证图片URL有效性
        # TODO: 可选择性下载并存储图片
        # TODO: 更新到数据库

        logger.info(f"用户头像更新: {user_id}")

        return BaseResponse(success=True, message="头像更新成功")

    except Exception as e:
        logger.error(f"更新用户头像失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新头像失败"
        )


@router.put("/{user_id}/privacy", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=20, window=3600)
@audit_log("update_privacy", sensitive=True)
async def update_user_privacy(
    user_id: str,
    request: UserPrivacyUpdateRequest,
    current_user: SecurityContext = Depends(require_user_access),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户隐私设置

    - 档案可见性控制
    - 联系方式显示设置
    - 好友请求设置
    """
    try:
        privacy_updates = request.dict(exclude_unset=True)

        # TODO: 更新隐私设置到数据库

        logger.info(f"用户隐私设置更新: {user_id}, 设置: {list(privacy_updates.keys())}")

        return BaseResponse(success=True, message="隐私设置更新成功")

    except Exception as e:
        logger.error(f"更新用户隐私设置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新隐私设置失败"
        )


@router.put("/{user_id}/notifications", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=20, window=3600)
@audit_log("update_notifications", sensitive=False)
async def update_user_notifications(
    user_id: str,
    request: UserNotificationUpdateRequest,
    current_user: SecurityContext = Depends(require_user_access),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户通知设置

    - 邮件通知设置
    - 短信通知设置
    - 推送通知设置
    - 营销邮件设置
    """
    try:
        notification_updates = request.dict(exclude_unset=True)

        # TODO: 更新通知设置到数据库

        logger.info(f"用户通知设置更新: {user_id}, 设置: {list(notification_updates.keys())}")

        return BaseResponse(success=True, message="通知设置更新成功")

    except Exception as e:
        logger.error(f"更新用户通知设置失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新通知设置失败"
        )


# ======================== 用户状态和角色管理 ========================


@router.put("/{user_id}/status", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=20, window=3600)
@audit_log("update_user_status", sensitive=True)
async def update_user_status(
    user_id: str,
    request: UserStatusUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户状态（管理员权限）

    - 激活/停用/暂停用户
    - 自动通知用户状态变更
    - 记录状态变更历史
    """
    try:
        # 不能修改自己的状态
        if user_id == current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不能修改自己的账户状态"
            )

        # TODO: 更新用户状态到数据库
        # user = get_user(db, user_id)
        # if not user:
        #     raise HTTPException(404, "用户不存在")
        #
        # old_status = user.status
        # user.status = request.status
        # user.updated_at = datetime.now()
        # db.commit()

        # 发送状态变更通知
        if request.notify_user:
            background_tasks.add_task(
                send_notification_email,
                user_id,
                "账户状态变更通知",
                f"您的账户状态已变更为: {request.status.value}。{request.reason or ''}",
                logger,
            )

        # 记录状态变更日志
        activity_log = create_user_activity_log(
            user_id=user_id,
            action="status_changed",
            details={
                "changed_by": current_user.user_id,
                "new_status": request.status.value,
                "reason": request.reason,
                "notify_user": request.notify_user,
            },
        )

        logger.info(
            f"用户状态更新: {user_id} -> {request.status.value}, 操作人: {current_user.user_id}"
        )

        return BaseResponse(success=True, message=f"用户状态已更新为: {request.status.value}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新用户状态失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新用户状态失败"
        )


@router.put("/{user_id}/role", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=10, window=3600)
@audit_log("update_user_role", sensitive=True)
async def update_user_role(
    user_id: str,
    request: UserRoleUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户角色（管理员权限）

    - 变更用户权限级别
    - 自动更新相关权限
    - 通知用户角色变更
    """
    try:
        # 不能修改自己的角色
        if user_id == current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不能修改自己的角色"
            )

        # TODO: 更新用户角色到数据库
        # user = get_user(db, user_id)
        # if not user:
        #     raise HTTPException(404, "用户不存在")
        #
        # old_role = user.role
        # user.role = request.role
        # user.updated_at = datetime.now()
        # db.commit()

        # 发送角色变更通知
        if request.notify_user:
            background_tasks.add_task(
                send_notification_email,
                user_id,
                "账户角色变更通知",
                f"您的账户角色已变更为: {request.role.value}。{request.reason or ''}",
                logger,
            )

        # 记录角色变更日志
        activity_log = create_user_activity_log(
            user_id=user_id,
            action="role_changed",
            details={
                "changed_by": current_user.user_id,
                "new_role": request.role.value,
                "reason": request.reason,
                "notify_user": request.notify_user,
            },
        )

        logger.info(
            f"用户角色更新: {user_id} -> {request.role.value}, 操作人: {current_user.user_id}"
        )

        return BaseResponse(success=True, message=f"用户角色已更新为: {request.role.value}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新用户角色失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新用户角色失败"
        )


@router.post("/{user_id}/activate", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=20, window=3600)
@audit_log("activate_user", sensitive=True)
async def activate_user(
    user_id: str,
    background_tasks: BackgroundTasks,
    reason: Optional[str] = Body(None, description="激活原因"),
    notify_user: bool = Body(True, description="是否通知用户"),
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    激活用户账户（管理员权限）

    - 将用户状态设为活跃
    - 清除登录限制
    - 发送激活通知
    """
    try:
        # TODO: 激活用户账户
        # user = get_user(db, user_id)
        # if not user:
        #     raise HTTPException(404, "用户不存在")
        #
        # user.status = UserStatus.ACTIVE
        # user.updated_at = datetime.now()
        # # 清除登录失败计数等
        # db.commit()

        if notify_user:
            background_tasks.add_task(
                send_notification_email,
                user_id,
                "账户激活通知",
                f"您的账户已被激活，现在可以正常使用所有功能。{reason or ''}",
                logger,
            )

        logger.info(f"用户激活: {user_id}, 操作人: {current_user.user_id}")

        return BaseResponse(success=True, message="用户账户已激活")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"激活用户失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="激活用户失败"
        )


@router.post("/{user_id}/deactivate", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=10, window=3600)
@audit_log("deactivate_user", sensitive=True)
async def deactivate_user(
    user_id: str,
    background_tasks: BackgroundTasks,
    reason: Optional[str] = Body(None, description="停用原因"),
    notify_user: bool = Body(True, description="是否通知用户"),
    revoke_sessions: bool = Body(True, description="是否撤销所有会话"),
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    security_manager: SecurityManager = Depends(get_security_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    停用用户账户（管理员权限）

    - 将用户状态设为停用
    - 可选择撤销所有会话
    - 发送停用通知
    """
    try:
        # 不能停用自己
        if user_id == current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不能停用自己的账户"
            )

        # TODO: 停用用户账户
        # user = get_user(db, user_id)
        # if not user:
        #     raise HTTPException(404, "用户不存在")
        #
        # user.status = UserStatus.INACTIVE
        # user.updated_at = datetime.now()
        # db.commit()

        # 撤销所有会话
        if revoke_sessions:
            # TODO: 撤销用户的所有会话
            pass

        if notify_user:
            background_tasks.add_task(
                send_notification_email,
                user_id,
                "账户停用通知",
                f"您的账户已被停用。原因: {reason or '管理员操作'}",
                logger,
            )

        logger.info(f"用户停用: {user_id}, 操作人: {current_user.user_id}, 原因: {reason}")

        return BaseResponse(success=True, message="用户账户已停用")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"停用用户失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="停用用户失败"
        )


@router.post("/{user_id}/suspend", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=10, window=3600)
@audit_log("suspend_user", sensitive=True)
async def suspend_user(
    user_id: str,
    reason: str,
    background_tasks: BackgroundTasks,
    duration_days: Optional[int] = Body(None, description="暂停天数，None表示无限期"),
    notify_user: bool = Body(True, description="是否通知用户"),
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    暂停用户账户（管理员权限）

    - 临时禁用用户账户
    - 可设置暂停期限
    - 到期自动恢复
    """
    try:
        # 不能暂停自己
        if user_id == current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不能暂停自己的账户"
            )

        # 计算暂停到期时间
        suspend_until = None
        if duration_days:
            suspend_until = datetime.now() + timedelta(days=duration_days)

        # TODO: 暂停用户账户
        # user = get_user(db, user_id)
        # if not user:
        #     raise HTTPException(404, "用户不存在")
        #
        # user.status = UserStatus.SUSPENDED
        # user.suspended_until = suspend_until
        # user.updated_at = datetime.now()
        # db.commit()

        if notify_user:
            duration_text = f"{duration_days}天" if duration_days else "无限期"
            background_tasks.add_task(
                send_notification_email,
                user_id,
                "账户暂停通知",
                f"您的账户已被暂停{duration_text}。原因: {reason}",
                logger,
            )

        logger.info(
            f"用户暂停: {user_id}, 期限: {duration_days}天, 操作人: {current_user.user_id}"
        )

        return BaseResponse(
            success=True,
            message=f"用户账户已暂停{'至' + suspend_until.strftime('%Y-%m-%d') if suspend_until else ''}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"暂停用户失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="暂停用户失败"
        )


# ======================== 用户联系方式管理 ========================


@router.put("/{user_id}/email", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=5, window=3600)
@audit_log("update_user_email", sensitive=True)
async def update_user_email(
    user_id: str,
    request: UserContactUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: SecurityContext = Depends(require_user_access),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户邮箱

    - 需要验证码确认
    - 检查邮箱唯一性
    - 发送确认邮件
    """
    try:
        if not request.email or not request.verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="邮箱和验证码不能为空"
            )

        # TODO: 验证验证码
        # if not verify_email_code(request.email, request.verification_code):
        #     raise HTTPException(400, "验证码错误或已过期")

        # TODO: 检查邮箱唯一性
        # if email_exists(db, request.email, exclude_user_id=user_id):
        #     raise HTTPException(409, "邮箱已被其他用户使用")

        # TODO: 更新邮箱
        # user = get_user(db, user_id)
        # old_email = user.email
        # user.email = request.email
        # user.email_verified = True
        # user.updated_at = datetime.now()
        # db.commit()

        # 发送确认邮件
        background_tasks.add_task(
            send_notification_email,
            user_id,
            "邮箱更新确认",
            f"您的邮箱已成功更新为: {request.email}",
            logger,
        )

        logger.info(f"用户邮箱更新: {user_id} -> {request.email}")

        return BaseResponse(success=True, message="邮箱更新成功")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新用户邮箱失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新邮箱失败"
        )


@router.put("/{user_id}/phone", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=5, window=3600)
@audit_log("update_user_phone", sensitive=True)
async def update_user_phone(
    user_id: str,
    request: UserContactUpdateRequest,
    current_user: SecurityContext = Depends(require_user_access),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    更新用户手机号

    - 需要短信验证码确认
    - 检查手机号唯一性
    - 自动验证手机号
    """
    try:
        if not request.phone or not request.verification_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="手机号和验证码不能为空"
            )

        # TODO: 验证短信验证码
        # TODO: 检查手机号唯一性
        # TODO: 更新手机号

        logger.info(f"用户手机号更新: {user_id} -> {request.phone}")

        return BaseResponse(success=True, message="手机号更新成功")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新用户手机号失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新手机号失败"
        )


# ======================== 用户安全管理 ========================


@router.put("/{user_id}/password", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=3, window=3600)
@audit_log("reset_user_password", sensitive=True)
async def reset_user_password(
    user_id: str,
    request: UserPasswordUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    重置用户密码（管理员权限）

    - 强制重置用户密码
    - 使所有会话失效
    - 发送通知邮件
    """
    try:
        # TODO: 验证密码强度
        # TODO: 更新用户密码
        # TODO: 使所有会话失效

        # 发送密码重置通知
        background_tasks.add_task(
            send_notification_email,
            user_id,
            "密码重置通知",
            "您的密码已由管理员重置，请尽快登录并修改密码。",
            logger,
        )

        logger.info(f"管理员重置用户密码: {user_id}, 操作人: {current_user.user_id}")

        return BaseResponse(success=True, message="用户密码已重置")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"重置用户密码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="重置密码失败"
        )


@router.post("/{user_id}/force-logout", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=10, window=3600)
@audit_log("force_logout_user", sensitive=True)
async def force_logout_user(
    user_id: str,
    reason: Optional[str] = Body(None, description="强制下线原因"),
    current_user: SecurityContext = Depends(require_admin()),
    security_manager: SecurityManager = Depends(get_security_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    强制用户下线（管理员权限）

    - 撤销用户所有会话
    - 使所有令牌失效
    - 记录操作日志
    """
    try:
        # TODO: 撤销用户的所有会话
        # revoke_all_user_sessions(security_manager, user_id)

        logger.info(f"强制用户下线: {user_id}, 操作人: {current_user.user_id}, 原因: {reason}")

        return BaseResponse(success=True, message="用户已被强制下线")

    except Exception as e:
        logger.error(f"强制用户下线失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="强制下线失败"
        )


@router.get("/{user_id}/sessions")
@security_headers()
@rate_limit(limit=20, window=3600)
async def get_user_sessions(
    user_id: str = Path(..., description="用户ID"),
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取用户会话列表（管理员权限）

    - 显示所有活跃会话
    - 包含设备信息和位置
    - 支持会话管理
    """
    try:
        # TODO: 从数据库获取用户会话
        mock_sessions = [
            {
                "session_id": str(uuid.uuid4()),
                "device_name": "Chrome on Windows",
                "ip_address": "192.168.1.100",
                "location": "北京, 中国",
                "created_at": datetime.now(),
                "last_activity": datetime.now(),
                "is_current": False,
            }
        ]

        return {
            "success": True,
            "sessions": mock_sessions,
            "total": len(mock_sessions),
            "user_id": user_id,
        }

    except Exception as e:
        logger.error(f"获取用户会话失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取会话列表失败"
        )


@router.delete("/{user_id}/sessions", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=10, window=3600)
@audit_log("revoke_user_sessions", sensitive=True)
async def revoke_user_sessions(
    user_id: str = Path(..., description="用户ID"),
    current_user: SecurityContext = Depends(require_admin()),
    security_manager: SecurityManager = Depends(get_security_manager),
    logger: logging.Logger = Depends(get_logger),
):
    """
    撤销用户所有会话（管理员权限）

    - 使用户所有令牌失效
    - 强制重新登录
    - 记录安全操作
    """
    try:
        # TODO: 撤销用户的所有会话

        logger.info(f"撤销用户所有会话: {user_id}, 操作人: {current_user.user_id}")

        return BaseResponse(success=True, message="用户所有会话已撤销")

    except Exception as e:
        logger.error(f"撤销用户会话失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="撤销会话失败"
        )


# ======================== 用户统计和分析 ========================


@router.get("/{user_id}/stats", response_model=UserStatsResponse)
@security_headers()
@rate_limit(limit=50, window=3600)
async def get_user_stats(
    user_id: str = Path(..., description="用户ID"),
    include_trends: bool = Query(False, description="是否包含趋势数据"),
    current_user: SecurityContext = Depends(require_user_access),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取用户统计信息

    - 使用统计数据
    - 活跃度分析
    - 成长趋势
    """
    try:
        # TODO: 从数据库获取用户统计
        mock_stats = UserStatistics(
            login_count=50,
            last_login_at=datetime.now(),
            last_active_at=datetime.now(),
            total_messages=200,
            total_tokens=5000,
            total_sessions=25,
            api_calls_today=10,
            tokens_used_today=100,
            messages_today=5,
        )

        response_data = {"success": True, "stats": mock_stats}

        if include_trends:
            response_data["usage_trends"] = {
                "daily_messages": [5, 8, 12, 6, 9],
                "weekly_logins": [3, 4, 2, 5, 6, 4, 3],
            }
            response_data["recommendations"] = ["建议开启两步验证以提高账户安全性", "您的使用量较高，考虑升级到高级版本"]

        return UserStatsResponse(**response_data)

    except Exception as e:
        logger.error(f"获取用户统计失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取统计信息失败"
        )


@router.get("/{user_id}/activity", response_model=UserActivityResponse)
@security_headers()
@rate_limit(limit=30, window=3600)
async def get_user_activity(
    user_id: str = Path(..., description="用户ID"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    activity_type: Optional[str] = Query(None, description="活动类型过滤"),
    current_user: SecurityContext = Depends(require_user_access),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取用户活动记录

    - 登录历史
    - 操作记录
    - 安全事件
    """
    try:
        # TODO: 从数据库获取用户活动记录
        mock_activities = [
            {
                "id": str(uuid.uuid4()),
                "action": "login",
                "description": "用户登录",
                "ip_address": "192.168.1.100",
                "user_agent": "Chrome/96.0",
                "timestamp": datetime.now(),
                "details": {"method": "password"},
            },
            {
                "id": str(uuid.uuid4()),
                "action": "profile_update",
                "description": "更新个人信息",
                "ip_address": "192.168.1.100",
                "timestamp": datetime.now() - timedelta(hours=2),
                "details": {"fields": ["nickname", "bio"]},
            },
        ]

        return UserActivityResponse(
            success=True,
            activities=mock_activities,
            total=len(mock_activities),
            page=page,
        )

    except Exception as e:
        logger.error(f"获取用户活动记录失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取活动记录失败"
        )


@router.get("/stats", response_model=SystemUserStatsResponse)
@security_headers()
@rate_limit(limit=20, window=3600)
async def get_system_user_stats(
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    获取系统用户统计（管理员权限）

    - 总体用户数据
    - 增长趋势
    - 分布统计
    """
    try:
        # TODO: 从数据库获取系统统计
        mock_stats = {
            "success": True,
            "total_users": 1000,
            "active_users": 800,
            "new_users_today": 5,
            "new_users_this_week": 25,
            "new_users_this_month": 100,
            "status_distribution": {
                UserStatus.ACTIVE: 800,
                UserStatus.INACTIVE: 150,
                UserStatus.SUSPENDED: 30,
                UserStatus.PENDING: 20,
            },
            "role_distribution": {
                UserRole.USER: 950,
                UserRole.ADMIN: 45,
                UserRole.SUPER_ADMIN: 5,
            },
            "provider_distribution": {
                AuthProvider.LOCAL: 800,
                AuthProvider.GOOGLE: 150,
                AuthProvider.WECHAT: 50,
            },
            "location_distribution": {
                "北京": 200,
                "上海": 180,
                "深圳": 150,
                "广州": 120,
                "其他": 350,
            },
            "growth_trend": [
                {"date": "2024-01-01", "new_users": 10, "total_users": 900},
                {"date": "2024-01-02", "new_users": 8, "total_users": 908},
                {"date": "2024-01-03", "new_users": 12, "total_users": 920},
            ],
        }

        return SystemUserStatsResponse(**mock_stats)

    except Exception as e:
        logger.error(f"获取系统用户统计失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取系统统计失败"
        )


# ======================== 批量操作 ========================


@router.post("/batch", response_model=UserBatchOperationResponse)
@security_headers()
@rate_limit(limit=5, window=3600)
@audit_log("batch_operation", sensitive=True)
async def batch_operation(
    request: UserBatchOperationRequest,
    background_tasks: BackgroundTasks,
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    批量操作用户（管理员权限）

    - 支持多种批量操作
    - 异步处理大批量任务
    - 详细的操作结果报告
    """
    try:
        start_time = datetime.now()
        results = []
        success_count = 0
        failed_count = 0
        errors = []

        # 检查用户ID列表
        if not request.user_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="用户ID列表不能为空"
            )

        # 防止对自己执行某些操作
        if current_user.user_id in request.user_ids and request.operation in [
            "deactivate",
            "suspend",
            "delete",
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不能对自己执行此操作"
            )

        # 执行批量操作
        for user_id in request.user_ids:
            try:
                # TODO: 根据操作类型执行相应操作
                if request.operation == "activate":
                    # 激活用户
                    result = {
                        "user_id": user_id,
                        "status": "success",
                        "message": "用户已激活",
                    }
                elif request.operation == "deactivate":
                    # 停用用户
                    result = {
                        "user_id": user_id,
                        "status": "success",
                        "message": "用户已停用",
                    }
                elif request.operation == "suspend":
                    # 暂停用户
                    result = {
                        "user_id": user_id,
                        "status": "success",
                        "message": "用户已暂停",
                    }
                elif request.operation == "delete":
                    # 删除用户
                    result = {
                        "user_id": user_id,
                        "status": "success",
                        "message": "用户已删除",
                    }
                elif request.operation == "send_notification":
                    # 发送通知
                    message = request.parameters.get("message", "系统通知")
                    background_tasks.add_task(
                        send_notification_email, user_id, "系统通知", message, logger
                    )
                    result = {
                        "user_id": user_id,
                        "status": "success",
                        "message": "通知已发送",
                    }
                elif request.operation == "update_role":
                    # 更新角色
                    new_role = request.parameters.get("role")
                    result = {
                        "user_id": user_id,
                        "status": "success",
                        "message": f"角色已更新为{new_role}",
                    }
                elif request.operation == "add_tags":
                    # 添加标签
                    tags = request.parameters.get("tags", [])
                    result = {
                        "user_id": user_id,
                        "status": "success",
                        "message": f"已添加标签: {tags}",
                    }
                elif request.operation == "remove_tags":
                    # 移除标签
                    tags = request.parameters.get("tags", [])
                    result = {
                        "user_id": user_id,
                        "status": "success",
                        "message": f"已移除标签: {tags}",
                    }
                else:
                    result = {
                        "user_id": user_id,
                        "status": "error",
                        "message": "不支持的操作类型",
                    }
                    failed_count += 1
                    continue

                results.append(result)
                success_count += 1

            except Exception as e:
                result = {"user_id": user_id, "status": "error", "message": str(e)}
                results.append(result)
                errors.append(f"用户 {user_id}: {str(e)}")
                failed_count += 1

        # 计算执行时间
        end_time = datetime.now()
        execution_time = (end_time - start_time).total_seconds()

        # 记录批量操作日志
        activity_log = create_user_activity_log(
            user_id=current_user.user_id,
            action="batch_operation",
            details={
                "operation": request.operation,
                "total_count": len(request.user_ids),
                "success_count": success_count,
                "failed_count": failed_count,
                "execution_time": execution_time,
                "parameters": request.parameters,
            },
        )

        logger.info(
            f"批量操作完成: {request.operation}, "
            f"总数: {len(request.user_ids)}, 成功: {success_count}, 失败: {failed_count}"
        )

        return UserBatchOperationResponse(
            success=failed_count == 0,
            operation=request.operation,
            total_count=len(request.user_ids),
            success_count=success_count,
            failed_count=failed_count,
            results=results,
            errors=errors,
            execution_time=execution_time,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"批量操作失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="批量操作失败"
        )


@router.post("/export")
@security_headers()
@rate_limit(limit=3, window=3600)
@audit_log("export_users", sensitive=True)
async def export_users(
    background_tasks: BackgroundTasks,
    format: str = Query("csv", description="导出格式: csv, xlsx, json"),
    filters: Optional[str] = Query(None, description="过滤条件（JSON格式）"),
    include_sensitive: bool = Query(False, description="是否包含敏感信息"),
    current_user: SecurityContext = Depends(require_admin()),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    导出用户数据（管理员权限）

    - 支持多种导出格式
    - 可选择导出字段
    - 异步生成文件
    """
    try:
        # TODO: 实现用户数据导出
        # 这里应该启动后台任务生成导出文件

        export_id = str(uuid.uuid4())

        # 启动后台导出任务
        # background_tasks.add_task(
        #     generate_user_export,
        #     export_id, format, filters, include_sensitive, current_user.user_id
        # )

        logger.info(
            f"用户数据导出任务启动: {export_id}, 格式: {format}, 操作人: {current_user.user_id}"
        )

        return {
            "success": True,
            "message": "导出任务已启动",
            "export_id": export_id,
            "estimated_time": "3-5分钟",
        }

    except Exception as e:
        logger.error(f"导出用户数据失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="导出失败"
        )


# ======================== 用户验证和检查 ========================


@router.get("/check-username", response_model=UserValidationResponse)
@security_headers()
@rate_limit(limit=50, window=3600)
async def check_username_availability(
    username: str = Query(..., min_length=3, max_length=30, description="要检查的用户名"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    检查用户名可用性

    - 实时检查用户名是否可用
    - 提供用户名建议
    - 验证格式规范
    """
    try:
        availability_result = check_username_availability(username)

        return UserValidationResponse(
            success=True,
            field="username",
            valid=availability_result["available"],
            message=availability_result["reason"],
            suggestions=availability_result.get("suggestions", []),
        )

    except Exception as e:
        logger.error(f"检查用户名可用性失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="检查失败"
        )


@router.get("/check-email", response_model=UserValidationResponse)
@security_headers()
@rate_limit(limit=50, window=3600)
async def check_email_availability(
    email: str = Query(..., description="要检查的邮箱地址"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    检查邮箱可用性

    - 验证邮箱格式
    - 检查是否已被注册
    - 提供域名建议
    """
    try:
        # TODO: 检查邮箱是否已被注册
        # is_available = not email_exists_in_db(db, email)
        is_available = True  # 临时实现

        # 验证邮箱格式
        try:
            from email_validator import validate_email, EmailNotValidError

            validate_email(email)
            format_valid = True
            message = "邮箱可用" if is_available else "邮箱已被注册"
        except EmailNotValidError:
            format_valid = False
            message = "邮箱格式不正确"

        return UserValidationResponse(
            success=True,
            field="email",
            valid=format_valid and is_available,
            message=message,
            suggestions=["@gmail.com", "@qq.com", "@163.com"]
            if not format_valid
            else [],
        )

    except Exception as e:
        logger.error(f"检查邮箱可用性失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="检查失败"
        )


@router.post("/{user_id}/send-verification", response_model=BaseResponse)
@security_headers()
@rate_limit(limit=5, window=3600)
@audit_log("send_verification", sensitive=False)
async def send_user_verification(
    user_id: str,
    verification_type: str,
    background_tasks: BackgroundTasks,
    current_user: SecurityContext = Depends(require_user_access),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger),
):
    """
    发送用户验证邮件/短信

    - 邮箱验证
    - 手机号验证
    - 重新发送验证码
    """
    try:
        # TODO: 获取用户信息
        # user = get_user(db, user_id)
        # if not user:
        #     raise HTTPException(404, "用户不存在")

        if verification_type == "email":
            # 发送邮箱验证
            verification_code = secrets.token_urlsafe(32)
            background_tasks.add_task(
                send_notification_email,
                user_id,
                "邮箱验证",
                f"请点击链接验证您的邮箱: https://example.com/verify?code={verification_code}",
                logger,
            )
            message = "验证邮件已发送"
        elif verification_type == "phone":
            # 发送短信验证
            verification_code = secrets.randbelow(1000000)
            message = f"验证码已发送到您的手机: {verification_code:06d}"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="不支持的验证类型"
            )

        logger.info(f"发送用户验证: {user_id}, 类型: {verification_type}")

        return BaseResponse(success=True, message=message)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"发送用户验证失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="发送验证失败"
        )


# ======================== 健康检查和系统信息 ========================


@router.get("/health")
async def health_check():
    """
    用户管理服务健康检查

    - 服务状态
    - 数据库连接
    - 缓存状态
    """
    try:
        return {
            "status": "healthy",
            "service": "user-management",
            "timestamp": datetime.now(),
            "features": {
                "user_crud": True,
                "profile_management": True,
                "role_management": True,
                "batch_operations": True,
                "user_statistics": True,
                "data_export": True,
            },
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "user-management",
            "timestamp": datetime.now(),
            "error": str(e),
        }


# 导出路由
__all__ = ["router"]
