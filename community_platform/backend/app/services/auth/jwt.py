"""
JWT 认证服务
"""
from datetime import timedelta
from typing import Optional, Dict, Any
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token,
)
from app.core.config.settings import settings


class JWTService:
    """JWT 服务"""
    
    @staticmethod
    def create_tokens(user_id: int, username: str) -> Dict[str, Any]:
        """
        创建访问令牌和刷新令牌
        
        Args:
            user_id: 用户 ID
            username: 用户名
        
        Returns:
            Dict: 包含 access_token 和 refresh_token
        """
        # 令牌数据
        token_data = {
            "sub": str(user_id),
            "username": username,
        }
        
        # 创建访问令牌
        access_token_expires = timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        access_token = create_access_token(
            data=token_data,
            expires_delta=access_token_expires
        )
        
        # 创建刷新令牌
        refresh_token_expires = timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        refresh_token = create_refresh_token(
            data=token_data,
            expires_delta=refresh_token_expires
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
    
    @staticmethod
    def verify_access_token(token: str) -> Optional[int]:
        """
        验证访问令牌
        
        Args:
            token: JWT token
        
        Returns:
            Optional[int]: 用户 ID，验证失败返回 None
        """
        return verify_token(token, token_type="access")
    
    @staticmethod
    def verify_refresh_token(token: str) -> Optional[int]:
        """
        验证刷新令牌
        
        Args:
            token: JWT token
        
        Returns:
            Optional[int]: 用户 ID，验证失败返回 None
        """
        return verify_token(token, token_type="refresh")
    
    @staticmethod
    def refresh_access_token(refresh_token: str, username: str) -> Optional[Dict[str, Any]]:
        """
        使用刷新令牌获取新的访问令牌
        
        Args:
            refresh_token: 刷新令牌
            username: 用户名
        
        Returns:
            Optional[Dict]: 新的令牌信息，验证失败返回 None
        """
        user_id = JWTService.verify_refresh_token(refresh_token)
        
        if user_id is None:
            return None
        
        # 创建新的访问令牌
        token_data = {
            "sub": str(user_id),
            "username": username,
        }
        
        access_token_expires = timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        access_token = create_access_token(
            data=token_data,
            expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }

