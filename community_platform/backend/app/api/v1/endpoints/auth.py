"""
认证 API 端点
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    Token,
    RefreshTokenRequest,
)
from app.schemas.user import UserPublic
from app.db.repositories.user import UserRepository
from app.services.auth import JWTService, PasswordService

router = APIRouter()


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(
    register_data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    用户注册
    
    - **username**: 用户名（3-50 字符）
    - **email**: 邮箱
    - **password**: 密码（最少 6 字符）
    - **full_name**: 全名（可选）
    """
    user_repo = UserRepository(db)
    
    # 检查用户名是否已存在
    if await user_repo.username_exists(register_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已被注册"
        )
    
    # 检查邮箱是否已存在
    if await user_repo.email_exists(register_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )
    
    # 哈希密码
    hashed_password = PasswordService.hash_password(register_data.password)
    
    # 创建用户
    user = await user_repo.create({
        "username": register_data.username,
        "email": register_data.email,
        "password_hash": hashed_password,
        "full_name": register_data.full_name,
    })
    
    return user


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    用户登录
    
    - **username**: 用户名或邮箱
    - **password**: 密码
    
    返回访问令牌和刷新令牌
    """
    user_repo = UserRepository(db)
    
    # 查找用户（支持用户名或邮箱登录）
    user = await user_repo.get_by_username_or_email(login_data.username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 验证密码
    if not PasswordService.verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 检查用户是否被禁用
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )
    
    # 创建令牌
    tokens = JWTService.create_tokens(user.id, user.username)
    
    return tokens


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    刷新访问令牌
    
    - **refresh_token**: 刷新令牌
    
    返回新的访问令牌
    """
    # 验证刷新令牌
    user_id = JWTService.verify_refresh_token(refresh_data.refresh_token)
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的刷新令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 获取用户信息
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )
    
    # 创建新的访问令牌
    tokens = JWTService.refresh_access_token(
        refresh_data.refresh_token,
        user.username
    )
    
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无法刷新令牌"
        )
    
    return tokens


@router.post("/logout")
async def logout():
    """
    用户登出
    
    客户端应该删除本地存储的令牌
    """
    return {"message": "登出成功"}

