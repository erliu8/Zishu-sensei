"""
依赖注入函数
"""
from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config.settings import settings
from app.db.session import get_db
from app.db.redis import redis_client
from app.db.qdrant import qdrant_manager
from app.models.user import User
from app.db.repositories.user import UserRepository

# OAuth2 认证方案
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")
# 可选的 OAuth2 认证方案
optional_oauth2_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    获取当前登录用户
    
    从 JWT token 中解析用户信息并从数据库获取完整用户数据
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 解码 JWT token
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # 从数据库获取用户
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(int(user_id))
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """获取当前活跃用户"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )
    return current_user


async def get_current_verified_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """获取当前已验证用户"""
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户未验证"
        )
    return current_user


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    获取可选的当前用户（用于不需要强制登录的接口）
    
    如果没有提供 token 或 token 无效，返回 None 而不是抛出异常
    """
    if credentials is None:
        return None
    
    try:
        # 解码 JWT token
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    
    # 从数据库获取用户
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(int(user_id))
    
    if user is None or not user.is_active:
        return None
    
    return user

