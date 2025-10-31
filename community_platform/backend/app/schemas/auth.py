"""
认证 Schema
"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.schemas.user import UserPublic


class Token(BaseModel):
    """Token 响应"""
    access_token: str = Field(..., description="访问令牌")
    refresh_token: Optional[str] = Field(None, description="刷新令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
    expires_in: int = Field(..., description="过期时间（秒）")


class AuthResponse(BaseModel):
    """认证响应（包含用户信息和令牌）"""
    user: UserPublic = Field(..., description="用户信息")
    access_token: str = Field(..., description="访问令牌")
    refresh_token: Optional[str] = Field(None, description="刷新令牌")
    token_type: str = Field(default="bearer", description="令牌类型")
    expires_in: int = Field(..., description="过期时间（秒）")


class TokenData(BaseModel):
    """Token 数据"""
    user_id: Optional[int] = None
    username: Optional[str] = None


class LoginRequest(BaseModel):
    """登录请求"""
    username: str = Field(..., description="用户名或邮箱")
    password: str = Field(..., description="密码")


class RegisterRequest(BaseModel):
    """注册请求"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., min_length=6, max_length=100, description="密码")
    full_name: Optional[str] = Field(None, max_length=100, description="全名")


class RefreshTokenRequest(BaseModel):
    """刷新令牌请求"""
    refresh_token: str = Field(..., description="刷新令牌")


class PasswordResetRequest(BaseModel):
    """密码重置请求"""
    email: EmailStr = Field(..., description="邮箱")


class PasswordResetConfirm(BaseModel):
    """确认密码重置"""
    token: str = Field(..., description="重置令牌")
    new_password: str = Field(..., min_length=6, max_length=100, description="新密码")


class AuthStatusResponse(BaseModel):
    """认证状态响应"""
    authenticated: bool = Field(..., description="是否已认证")
    user_id: int = Field(..., description="用户 ID")
    username: str = Field(..., description="用户名")
    is_active: bool = Field(..., description="是否激活")

