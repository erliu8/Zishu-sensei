"""
帖子 Schema
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.user import UserPublic


class PostBase(BaseModel):
    """帖子基础模型"""
    title: str = Field(..., min_length=1, max_length=255, description="标题")
    content: str = Field(..., min_length=1, description="内容")
    category: Optional[str] = Field(None, max_length=50, description="分类")
    tags: Optional[List[str]] = Field(default=[], description="标签")


class PostCreate(PostBase):
    """创建帖子"""
    is_published: bool = Field(default=True, description="是否发布")


class PostUpdate(BaseModel):
    """更新帖子"""
    title: Optional[str] = Field(None, min_length=1, max_length=255, description="标题")
    content: Optional[str] = Field(None, min_length=1, description="内容")
    category: Optional[str] = Field(None, max_length=50, description="分类")
    tags: Optional[List[str]] = Field(None, description="标签")
    is_published: Optional[bool] = Field(None, description="是否发布")


class PostInDB(PostBase):
    """数据库中的帖子"""
    id: int
    user_id: int
    view_count: int
    like_count: int
    comment_count: int
    is_published: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PostPublic(PostInDB):
    """公开的帖子信息"""
    author: UserPublic
    is_liked: bool = Field(default=False, description="是否已点赞")


class PostDetail(PostPublic):
    """帖子详情"""
    pass


class PostStats(BaseModel):
    """帖子统计"""
    total_posts: int
    published_posts: int
    draft_posts: int
    posts_today: int
    total_views: int
    total_likes: int
    total_comments: int

