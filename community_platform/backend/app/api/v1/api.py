"""
API v1 路由汇总
"""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    posts,
    comments,
    search,
    notifications,
    websocket,
)

api_router = APIRouter()

# 认证路由
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["认证 Authentication"],
)

# 用户路由
api_router.include_router(
    users.router,
    prefix="/users",
    tags=["用户 Users"],
)

# 帖子路由
api_router.include_router(
    posts.router,
    prefix="/posts",
    tags=["帖子 Posts"],
)

# 评论路由
api_router.include_router(
    comments.router,
    prefix="/comments",
    tags=["评论 Comments"],
)

# 搜索路由
api_router.include_router(
    search.router,
    prefix="/search",
    tags=["搜索 Search"],
)

# 通知路由
api_router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=["通知 Notifications"],
)

# WebSocket 路由
api_router.include_router(
    websocket.router,
    tags=["WebSocket"],
)

