"""
用户 Schema
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, validator


class UserBase(BaseModel):
    """用户基础模型"""
    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    email: EmailStr = Field(..., description="邮箱")
    full_name: Optional[str] = Field(None, max_length=100, description="全名")
    bio: Optional[str] = Field(None, description="个人简介")


class UserCreate(UserBase):
    """创建用户"""
    password: str = Field(..., min_length=6, max_length=100, description="密码")
    
    @validator("password")
    def validate_password(cls, v):
        """验证密码强度"""
        if len(v) < 6:
            raise ValueError("密码长度至少为 6 位")
        return v


class UserUpdate(BaseModel):
    """更新用户"""
    full_name: Optional[str] = Field(None, max_length=100, description="全名")
    bio: Optional[str] = Field(None, description="个人简介")
    avatar_url: Optional[str] = Field(None, description="头像 URL")


class UserChangePassword(BaseModel):
    """修改密码"""
    old_password: str = Field(..., description="旧密码")
    new_password: str = Field(..., min_length=6, max_length=100, description="新密码")


class UserInDB(UserBase):
    """数据库中的用户"""
    id: int
    avatar_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class UserPublic(BaseModel):
    """公开的用户信息"""
    id: int
    username: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserSelf(UserPublic):
    """当前用户自己的信息（包含敏感信息如 email）"""
    email: EmailStr


class UserProfile(UserPublic):
    """用户详细资料"""
    follower_count: int = Field(default=0, description="粉丝数")
    following_count: int = Field(default=0, description="关注数")
    post_count: int = Field(default=0, description="帖子数")
    is_following: bool = Field(default=False, description="是否已关注")


class UserStats(BaseModel):
    """用户统计"""
    total_users: int
    active_users: int
    verified_users: int
    new_users_today: int

