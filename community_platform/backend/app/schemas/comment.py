"""
评论 Schema
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, computed_field

from app.schemas.user import UserPublic


class CommentBase(BaseModel):
    """评论基础模型"""
    content: str = Field(..., min_length=1, description="内容")


class CommentCreate(CommentBase):
    """创建评论"""
    post_id: int = Field(..., description="帖子 ID")
    parent_id: Optional[int] = Field(None, description="父评论 ID")


class CommentCreateForPost(CommentBase):
    """从帖子端点创建评论（post_id 来自路径参数）"""
    parent_id: Optional[int] = Field(None, description="父评论 ID")


class CommentUpdate(BaseModel):
    """更新评论"""
    content: str = Field(..., min_length=1, description="内容")


class CommentInDB(CommentBase):
    """数据库中的评论"""
    id: int
    post_id: int
    user_id: int
    parent_id: Optional[int]
    like_count: int
    created_at: datetime
    updated_at: datetime
    
    @computed_field  # type: ignore[misc]
    @property
    def author_id(self) -> int:
        """author_id 作为 user_id 的别名"""
        return self.user_id
    
    class Config:
        from_attributes = True


class CommentPublic(CommentInDB):
    """公开的评论信息"""
    author: UserPublic
    is_liked: bool = Field(default=False, description="是否已点赞")
    replies: List["CommentPublic"] = Field(default=[], description="回复列表")


# 更新前向引用
CommentPublic.model_rebuild()

