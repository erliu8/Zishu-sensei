"""
搜索 Schema
"""
from typing import Optional, List, Literal
from pydantic import BaseModel, Field

from app.schemas.post import PostPublic
from app.schemas.user import UserPublic


class SearchRequest(BaseModel):
    """搜索请求"""
    query: str = Field(..., min_length=1, description="搜索关键词")
    type: Optional[Literal["post", "user", "all"]] = Field(default="all", description="搜索类型")
    category: Optional[str] = Field(None, description="分类过滤")
    tags: Optional[List[str]] = Field(None, description="标签过滤")
    page: int = Field(default=1, ge=1, description="页码")
    page_size: int = Field(default=20, ge=1, le=100, description="每页数量")


class VectorSearchRequest(BaseModel):
    """向量搜索请求"""
    query: str = Field(..., min_length=1, description="搜索查询")
    limit: int = Field(default=10, ge=1, le=50, description="返回数量")
    score_threshold: float = Field(default=0.7, ge=0.0, le=1.0, description="相似度阈值")
    category: Optional[str] = Field(None, description="分类过滤")


class SearchResult(BaseModel):
    """搜索结果"""
    posts: List[PostPublic] = Field(default=[], description="帖子结果")
    users: List[UserPublic] = Field(default=[], description="用户结果")
    total: int = Field(description="总数")


class VectorSearchResult(BaseModel):
    """向量搜索结果"""
    post_id: int = Field(description="帖子 ID")
    score: float = Field(description="相似度分数")
    post: PostPublic = Field(description="帖子信息")

