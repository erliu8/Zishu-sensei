# ! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
社区功能路由系统 - Zishu-sensei
提供全面的社区管理、内容发布、互动系统、搜索推荐等功能
"""

import asyncio
import re
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Literal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import (
    APIRouter, Depends, HTTPException, status, 
    Request, Response, BackgroundTasks, Query, Path, Body
)
from fastapi.responses import JSONResponse
import logging
from cachetools import TTLCache

from ..dependencies import get_logger, get_config
from ..schemas.community import (
    # 枚举类型
    CommunityType, CommunityStatus, MemberRole, PostType, PostStatus,
    CommentStatus, ReactionType, ReportReason, AdapterCategory, NotificationType,
    
    # 请求模型
    CommunityCreateRequest, CommunityUpdateRequest, PostCreateRequest, PostUpdateRequest,
    CommentCreateRequest, CommentUpdateRequest, CommunityJoinRequest, CommunityInviteRequest,
    ReactionCreateRequest, FollowCreateRequest, ReportCreateRequest,
    
    # 响应模型
    CommunityListItem, PostListItem, CommentListItem, CommunityDetailResponse,
    PostDetailResponse, CommentDetailResponse, PaginatedResponse, SearchFilters,
    CommunityStats, 
    
    # 基础模型
    Community, Post, Comment, CommunityMember, Reaction, Follow, Report, Notification,
    
    # 辅助函数
    create_community_slug, validate_community_permissions, calculate_trending_score
)
from ..schemas.responses import BaseResponse, ErrorResponse
from ..security import SecurityManager, SecurityContext, PermissionType
from ..auth import require_auth, require_permission, get_current_user_info

# 路由器配置
router = APIRouter(
    prefix="/community",
    tags=["community"],
    responses={
        401: {"description": "未授权访问"},
        403: {"description": "权限不足"},
        404: {"description": "资源不存在"},
        429: {"description": "请求过于频繁"},
        500: {"description": "服务器内部错误"}
    }
)

# 全局缓存配置
CACHE_TTL = 3600  # 1小时缓存
community_cache = TTLCache(maxsize=1000, ttl=CACHE_TTL)
post_cache = TTLCache(maxsize=5000, ttl=CACHE_TTL)
comment_cache = TTLCache(maxsize=10000, ttl=300)  # 评论5分钟缓存

# 依赖函数
async def get_db_session():
    """获取数据库会话 - 临时Mock实现"""
    # TODO: 实现真实的数据库连接
    from unittest.mock import Mock
    return Mock()

async def get_community_service():
    """获取社区服务 - 临时Mock实现"""
    # TODO: 实现真实的社区服务
    from unittest.mock import Mock
    return Mock()

async def get_notification_service():
    """获取通知服务 - 临时Mock实现"""
    # TODO: 实现真实的通知服务
    from unittest.mock import Mock
    return Mock()

async def get_search_service():
    """获取搜索服务 - 临时Mock实现"""
    # TODO: 实现真实的搜索服务
    from unittest.mock import Mock
    return Mock()

def require_community_permission(
    required_role: MemberRole = MemberRole.MEMBER
):
    """需要特定社区权限的依赖"""
    def dependency(
        current_user: SecurityContext = Depends(require_auth),
        db: Session = Depends(get_db_session)
    ):
        # TODO: 从数据库获取用户在社区中的角色
        user_role = MemberRole.MEMBER  # 临时实现
        if not validate_community_permissions(user_role, required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"需要 {required_role.value} 或更高权限"
            )
        return current_user
    return dependency

# 工具函数
def calculate_post_score(post: Post) -> float:
    """计算帖子评分"""
    return calculate_trending_score(post, time_weight=0.8)

def generate_post_excerpt(content: str, max_length: int = 200) -> str:
    """生成帖子摘要"""
    if len(content) <= max_length:
        return content
    return content[:max_length-3] + "..."

def validate_community_slug(slug: str) -> bool:
    """验证社区标识符"""
    return bool(re.match(r"^[a-z0-9\-]{3,30}$", slug))

def sanitize_content(content: str) -> str:
    """清理用户输入内容"""
    # TODO: 实现更严格的内容过滤
    return content.strip()

async def send_notification(
    user_id: str,
    notification_type: NotificationType,
    title: str,
    content: str,
    data: Dict[str, Any] = None,
    notification_service=None
):
    """发送通知"""
    if notification_service:
        # TODO: 实现真实的通知发送逻辑
        pass

# ======================== 社区基础管理路由 ========================

@router.get("/", response_model=PaginatedResponse)
async def list_communities(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    type: Optional[CommunityType] = Query(None, description="社区类型"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    tags: Optional[List[str]] = Query(None, description="标签过滤"),
    sort_by: str = Query("created_at", description="排序字段"),
    sort_order: Literal["asc", "desc"] = Query("desc", description="排序方向"),
    featured_only: bool = Query(False, description="仅显示精选"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    获取社区列表
    
    支持分页、搜索、过滤和排序功能
    """
    try:
        # 构建缓存键
        cache_key = f"communities:{page}:{size}:{type}:{search}:{tags}:{sort_by}:{sort_order}:{featured_only}"
        
        # 检查缓存
        if cache_key in community_cache:
            logger.info(f"从缓存返回社区列表: {cache_key}")
            return community_cache[cache_key]
        
        # TODO: 实现真实的数据库查询逻辑
        # 模拟数据
        communities = [
            CommunityListItem(
                id=str(uuid.uuid4()),
                name="AI Agent开发者",
                description="专注于AI Agent开发的社区",
                slug="ai-agent-dev",
                community_type=CommunityType.DEVELOPMENT,
                member_count=1250,
                post_count=3420,
                is_verified=True,
                is_featured=True,
                tags=["ai", "agent", "development"],
                created_at=datetime.now()
            ),
            CommunityListItem(
                id=str(uuid.uuid4()),
                name="适配器分享",
                description="分享和讨论各种适配器的社区",
                slug="adapter-sharing",
                community_type=CommunityType.ADAPTER_HUB,
                member_count=850,
                post_count=1890,
                is_verified=True,
                is_featured=False,
                tags=["adapter", "sharing", "community"],
                created_at=datetime.now()
            )
        ]
        
        # 过滤逻辑
        if type:
            communities = [c for c in communities if c.community_type == type]
        
        if search:
            communities = [
                c for c in communities 
                if search.lower() in c.name.lower() or search.lower() in c.description.lower()
            ]
        
        if tags:
            communities = [
                c for c in communities 
                if any(tag in c.tags for tag in tags)
            ]
        
        if featured_only:
            communities = [c for c in communities if c.is_featured]
        
        # 分页
        total = len(communities)
        start = (page - 1) * size
        end = start + size
        communities = communities[start:end]
        
        response = PaginatedResponse(
            items=communities,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1
        )
        
        # 缓存结果
        community_cache[cache_key] = response
        
        logger.info(f"返回社区列表: 总数={total}, 页码={page}")
        return response
        
    except Exception as e:
        logger.error(f"获取社区列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取社区列表失败"
        )

@router.post("/", response_model=CommunityDetailResponse)
async def create_community(
    request: CommunityCreateRequest,
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    创建新社区
    
    需要用户认证，会自动设置创建者为社区所有者
    """
    try:
        # 验证社区标识符
        if not validate_community_slug(request.slug):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="社区标识符格式不正确，只能包含小写字母、数字和连字符，长度3-30位"
            )
        
        # TODO: 检查标识符是否已存在
        # existing = get_community_by_slug(db, request.slug)
        # if existing:
        #     raise HTTPException(409, "社区标识符已存在")
        
        # 创建社区
        community_id = str(uuid.uuid4())
        community_data = {
            **request.model_dump(),
            "id": community_id,
            "owner_id": current_user.user_id,
            "status": CommunityStatus.ACTIVE,
            "member_count": 1,
            "post_count": 0,
            "is_verified": False,
            "is_featured": False,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # TODO: 保存到数据库
        # community = create_community_in_db(db, **community_data)
        
        # 创建所有者成员关系
        # TODO: 添加创建者为所有者
        # add_community_member(db, community_id, current_user.user_id, MemberRole.OWNER)
        
        # 清理缓存
        community_cache.clear()
        
        logger.info(f"创建社区成功: {request.name} ({request.slug}) by {current_user.user_id}")
        
        # 构建响应（模拟数据）
        community = Community(**community_data)
        
        return CommunityDetailResponse(
            **community.model_dump(),
            owner={
                "id": current_user.user_id,
                "username": "current_user",
                "nickname": "当前用户",
                "avatar_url": None
            },
            user_role=MemberRole.OWNER,
            is_member=True,
            recent_posts=[]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建社区失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建社区失败"
        )

@router.get("/{community_id}", response_model=CommunityDetailResponse)
async def get_community(
    community_id: str = Path(..., description="社区ID"),
    current_user: Optional[SecurityContext] = Depends(get_current_user_info),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    获取社区详情
    
    包含社区信息、用户角色、最近帖子等
    """
    try:
        # 检查缓存
        cache_key = f"community_detail:{community_id}"
        if cache_key in community_cache:
            cached_response = community_cache[cache_key]
            # 如果用户已认证，更新用户相关信息
            if current_user:
                cached_response.user_role = MemberRole.MEMBER  # TODO: 从数据库获取真实角色
                cached_response.is_member = True
            return cached_response
        
        # TODO: 从数据库获取社区信息
        # community = get_community_by_id(db, community_id)
        # if not community:
        #     raise HTTPException(404, "社区不存在")
        
        # 模拟社区数据
        community_data = {
            "id": community_id,
            "name": "AI Agent开发者",
            "description": "专注于AI Agent开发的技术社区",
            "slug": "ai-agent-dev",
            "owner_id": str(uuid.uuid4()),
            "avatar_url": None,
            "banner_url": None,
            "community_type": CommunityType.DEVELOPMENT,
            "status": CommunityStatus.ACTIVE,
            "rules": "1. 保持友善交流\n2. 分享高质量内容\n3. 禁止广告信息",
            "tags": ["ai", "agent", "development"],
            "settings": {"allow_guest_post": False, "require_approval": True},
            "member_count": 1250,
            "post_count": 3420,
            "is_verified": True,
            "is_featured": True,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # 模拟最近帖子
        recent_posts = [
            PostListItem(
                id=str(uuid.uuid4()),
                title="如何构建高效的AI Agent适配器",
                post_type=PostType.TUTORIAL,
                author_id=str(uuid.uuid4()),
                author_name="技术专家",
                author_avatar=None,
                community_id=community_id,
                community_name="AI Agent开发者",
                view_count=245,
                like_count=32,
                comment_count=18,
                is_pinned=True,
                is_locked=False,
                tags=["tutorial", "adapter", "best-practice"],
                last_activity_at=datetime.now(),
                created_at=datetime.now()
            )
        ]
        
        # 获取用户角色
        user_role = None
        is_member = False
        if current_user:
            # TODO: 从数据库获取用户在社区中的角色
            user_role = MemberRole.MEMBER
            is_member = True
        
        response = CommunityDetailResponse(
            **community_data,
            owner={
                "id": community_data["owner_id"],
                "username": "community_owner",
                "nickname": "社区创建者",
                "avatar_url": None
            },
            user_role=user_role,
            is_member=is_member,
            recent_posts=recent_posts
        )
        
        # 缓存结果（不包含用户特定信息）
        base_response = response.model_copy()
        base_response.user_role = None
        base_response.is_member = False
        community_cache[cache_key] = base_response
        
        logger.info(f"获取社区详情: {community_id}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取社区详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取社区详情失败"
        )

@router.put("/{community_id}", response_model=CommunityDetailResponse)
async def update_community(
    community_id: str = Path(..., description="社区ID"),
    request: CommunityUpdateRequest = Body(...),
    current_user: SecurityContext = Depends(require_community_permission(
        MemberRole.ADMIN
    )),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    更新社区信息
    
    需要管理员或更高权限
    """
    try:
        # TODO: 获取并更新社区信息
        # community = get_community_by_id(db, community_id)
        # if not community:
        #     raise HTTPException(404, "社区不存在")
        
        # 构建更新数据
        update_data = {k: v for k, v in request.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now()
        
        # TODO: 更新数据库
        # update_community_in_db(db, community_id, **update_data)
        
        # 清理缓存
        community_cache.clear()
        
        logger.info(f"更新社区成功: {community_id} by {current_user.user_id}")
        
        # 返回更新后的社区详情
        return await get_community(community_id, current_user, db, logger)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新社区失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新社区失败"
        )

@router.delete("/{community_id}")
async def delete_community(
    community_id: str = Path(..., description="社区ID"),
    current_user: SecurityContext = Depends(require_community_permission(
        MemberRole.OWNER
    )),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    删除社区
    
    仅社区所有者可以删除，会软删除社区及其所有内容
    """
    try:
        # TODO: 实现软删除逻辑
        # community = get_community_by_id(db, community_id)
        # if not community:
        #     raise HTTPException(404, "社区不存在")
        
        # soft_delete_community(db, community_id)
        
        # 清理缓存
        community_cache.clear()
        post_cache.clear()
        comment_cache.clear()
        
        logger.info(f"删除社区: {community_id} by {current_user.user_id}")
        
        return BaseResponse(
            success=True,
            message="社区已删除"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除社区失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除社区失败"
        )

# ======================== 社区成员管理路由 ========================

@router.post("/{community_id}/join")
async def join_community(
    community_id: str = Path(..., description="社区ID"),
    request: Optional[CommunityJoinRequest] = Body(None),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    notification_service = Depends(get_notification_service),
    logger: logging.Logger = Depends(get_logger)
):
    """
    加入社区
    
    根据社区设置可能需要审核
    """
    try:
        # TODO: 检查社区是否存在和用户是否已加入
        # community = get_community_by_id(db, community_id)
        # if not community:
        #     raise HTTPException(404, "社区不存在")
        
        # existing_member = get_community_member(db, community_id, current_user.user_id)
        # if existing_member:
        #     raise HTTPException(409, "已经是社区成员")
        
        # 模拟加入逻辑
        member_data = {
            "id": str(uuid.uuid4()),
            "community_id": community_id,
            "user_id": current_user.user_id,
            "role": MemberRole.MEMBER,
            "join_reason": request.reason if request else None,
            "joined_at": datetime.now()
        }
        
        # TODO: 保存到数据库
        # create_community_member(db, **member_data)
        
        # 发送通知给社区管理员
        await send_notification(
            user_id="admin_user_id",  # TODO: 获取社区管理员ID
            notification_type=NotificationType.JOIN_REQUEST,
            title="新成员加入",
            content=f"用户 {current_user.user_id} 加入了社区",
            notification_service=notification_service
        )
        
        # 清理缓存
        community_cache.clear()
        
        logger.info(f"用户加入社区: {current_user.user_id} -> {community_id}")
        
        return BaseResponse(
            success=True,
            message="成功加入社区"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"加入社区失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="加入社区失败"
        )

@router.delete("/{community_id}/leave")
async def leave_community(
    community_id: str = Path(..., description="社区ID"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    离开社区
    
    社区所有者不能离开自己的社区
    """
    try:
        # TODO: 检查成员关系
        # member = get_community_member(db, community_id, current_user.user_id)
        # if not member:
        #     raise HTTPException(404, "不是社区成员")
        
        # if member.role == MemberRole.OWNER:
        #     raise HTTPException(400, "社区所有者不能离开社区")
        
        # TODO: 删除成员关系
        # delete_community_member(db, community_id, current_user.user_id)
        
        # 清理缓存
        community_cache.clear()
        
        logger.info(f"用户离开社区: {current_user.user_id} <- {community_id}")
        
        return BaseResponse(
            success=True,
            message="已离开社区"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"离开社区失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="离开社区失败"
        )

@router.get("/{community_id}/members", response_model=PaginatedResponse)
async def list_community_members(
    community_id: str = Path(..., description="社区ID"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    role: Optional[MemberRole] = Query(None, description="角色过滤"),
    search: Optional[str] = Query(None, description="搜索用户名"),
    current_user: Optional[SecurityContext] = Depends(get_current_user_info),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    获取社区成员列表
    
    支持按角色过滤和用户名搜索
    """
    try:
        # TODO: 实现真实的成员查询逻辑
        # members = get_community_members(db, community_id, page, size, role, search)
        
        # 模拟成员数据
        members = [
            {
                "id": str(uuid.uuid4()),
                "user_id": str(uuid.uuid4()),
                "username": "tech_expert",
                "nickname": "技术专家",
                "avatar_url": None,
                "role": MemberRole.ADMIN,
                "custom_title": "社区管理员",
                "joined_at": datetime.now(),
                "last_activity_at": datetime.now(),
                "post_count": 45,
                "contribution_score": 1250
            },
            {
                "id": str(uuid.uuid4()),
                "user_id": str(uuid.uuid4()),
                "username": "active_member",
                "nickname": "活跃成员",
                "avatar_url": None,
                "role": MemberRole.MEMBER,
                "custom_title": None,
                "joined_at": datetime.now(),
                "last_activity_at": datetime.now(),
                "post_count": 12,
                "contribution_score": 380
            }
        ]
        
        # 过滤逻辑
        if role:
            members = [m for m in members if m["role"] == role]
        
        if search:
            members = [
                m for m in members 
                if search.lower() in m["username"].lower() or 
                   search.lower() in (m["nickname"] or "").lower()
            ]
        
        # 分页
        total = len(members)
        start = (page - 1) * size
        end = start + size
        members = members[start:end]
        
        response = PaginatedResponse(
            items=members,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1
        )
        
        logger.info(f"获取社区成员列表: {community_id}, 总数={total}")
        return response
        
    except Exception as e:
        logger.error(f"获取社区成员列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取成员列表失败"
        )

# ======================== 帖子管理路由 ========================

@router.get("/{community_id}/posts", response_model=PaginatedResponse)
async def list_community_posts(
    community_id: str = Path(..., description="社区ID"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    post_type: Optional[PostType] = Query(None, description="帖子类型"),
    tag: Optional[List[str]] = Query(None, description="标签过滤"),
    sort_by: str = Query("created_at", description="排序字段"),
    sort_order: Literal["asc", "desc"] = Query("desc", description="排序方向"),
    pinned_first: bool = Query(True, description="置顶帖优先"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    获取社区帖子列表
    
    支持分页、过滤、排序等功能
    """
    try:
        # 构建缓存键
        cache_key = f"posts:{community_id}:{page}:{size}:{post_type}:{tag}:{sort_by}:{sort_order}:{pinned_first}"
        
        # 检查缓存
        if cache_key in post_cache:
            logger.info(f"从缓存返回帖子列表: {cache_key}")
            return post_cache[cache_key]
        
        # TODO: 实现真实的帖子查询逻辑
        # posts = get_community_posts(db, community_id, page, size, post_type, tag, sort_by, sort_order, pinned_first)
        
        # 模拟帖子数据
        posts = [
            PostListItem(
                id=str(uuid.uuid4()),
                title="如何构建高效的AI Agent适配器",
                post_type=PostType.TUTORIAL,
                author_id=str(uuid.uuid4()),
                author_name="技术专家",
                author_avatar=None,
                community_id=community_id,
                community_name="AI Agent开发者",
                view_count=245,
                like_count=32,
                comment_count=18,
                is_pinned=True,
                is_locked=False,
                tags=["tutorial", "adapter", "best-practice"],
                last_activity_at=datetime.now(),
                created_at=datetime.now()
            ),
            PostListItem(
                id=str(uuid.uuid4()),
                title="分享一个有趣的对话适配器",
                post_type=PostType.SHOWCASE,
                author_id=str(uuid.uuid4()),
                author_name="创意开发者",
                author_avatar=None,
                community_id=community_id,
                community_name="AI Agent开发者",
                view_count=156,
                like_count=28,
                comment_count=9,
                is_pinned=False,
                is_locked=False,
                tags=["showcase", "adapter", "creative"],
                last_activity_at=datetime.now() - timedelta(hours=2),
                created_at=datetime.now() - timedelta(hours=2)
            )
        ]
        
        # 过滤逻辑
        if post_type:
            posts = [p for p in posts if p.post_type == post_type]
        
        if tag:
            posts = [
                p for p in posts 
                if any(t in p.tags for t in tag)
            ]
        
        # 排序逻辑（置顶优先）
        if pinned_first:
            posts = sorted(posts, key=lambda x: (not x.is_pinned, x.created_at), reverse=(sort_order == "desc"))
        else:
            posts = sorted(posts, key=lambda x: getattr(x, sort_by), reverse=(sort_order == "desc"))
        
        # 分页
        total = len(posts)
        start = (page - 1) * size
        end = start + size
        posts = posts[start:end]
        
        response = PaginatedResponse(
            items=posts,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1
        )
        
        # 缓存结果
        post_cache[cache_key] = response
        
        logger.info(f"获取社区帖子列表: {community_id}, 总数={total}")
        return response
        
    except Exception as e:
        logger.error(f"获取社区帖子列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取帖子列表失败"
        )

@router.post("/{community_id}/posts", response_model=PostDetailResponse)
async def create_post(
    community_id: str = Path(..., description="社区ID"),
    request: PostCreateRequest = Body(...),
    current_user: SecurityContext = Depends(require_community_permission(
        MemberRole.MEMBER
    )),
    db: Session = Depends(get_db_session),
    notification_service = Depends(get_notification_service),
    logger: logging.Logger = Depends(get_logger)
):
    """
    创建新帖子
    
    需要社区成员权限
    """
    try:
        # 验证社区ID
        if request.community_id != community_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="社区ID不匹配"
            )
        
        # 清理内容
        clean_title = sanitize_content(request.title)
        clean_content = sanitize_content(request.content)
        
        # 创建帖子
        post_id = str(uuid.uuid4())
        post_data = {
            **request.model_dump(),
            "id": post_id,
            "author_id": current_user.user_id,
            "status": PostStatus.PUBLISHED,
            "title": clean_title,
            "content": clean_content,
            "view_count": 0,
            "like_count": 0,
            "comment_count": 0,
            "share_count": 0,
            "is_pinned": False,
            "is_locked": False,
            "is_featured": False,
            "last_activity_at": datetime.now(),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # TODO: 保存到数据库
        # post = create_post_in_db(db, **post_data)
        
        # 清理缓存
        post_cache.clear()
        community_cache.clear()
        
        # 发送通知给社区关注者
        # TODO: 获取社区关注者并发送通知
        
        logger.info(f"创建帖子成功: {clean_title} by {current_user.user_id} in {community_id}")
        
        # 构建响应
        post = Post(**post_data)
        
        return PostDetailResponse(
            **post.model_dump(),
            author={
                "id": current_user.user_id,
                "username": "current_user",
                "nickname": "当前用户",
                "avatar_url": None
            },
            community=CommunityListItem(
                id=community_id,
                name="社区名称",
                description="社区描述",
                slug="community-slug",
                community_type=CommunityType.PUBLIC,
                member_count=100,
                post_count=50,
                is_verified=False,
                is_featured=False,
                tags=[],
                created_at=datetime.now()
            ),
            reactions={},
            user_reaction=None,
            is_bookmarked=False
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建帖子失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建帖子失败"
        )

@router.get("/{community_id}/posts/{post_id}", response_model=PostDetailResponse)
async def get_post(
    community_id: str = Path(..., description="社区ID"),
    post_id: str = Path(..., description="帖子ID"),
    current_user: Optional[SecurityContext] = Depends(get_current_user_info),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    获取帖子详情
    
    包含帖子内容、作者信息、评论等
    """
    try:
        # 检查缓存
        cache_key = f"post_detail:{post_id}"
        if cache_key in post_cache:
            cached_response = post_cache[cache_key]
            # 增加浏览量（实际应该在数据库中更新）
            cached_response.view_count += 1
            return cached_response
        
        # TODO: 从数据库获取帖子信息
        # post = get_post_by_id(db, post_id)
        # if not post or post.community_id != community_id:
        #     raise HTTPException(404, "帖子不存在")
        
        # 模拟帖子数据
        post_data = {
            "id": post_id,
            "community_id": community_id,
            "author_id": str(uuid.uuid4()),
            "title": "如何构建高效的AI Agent适配器",
            "content": """# AI Agent适配器开发指南

## 概述
适配器是AI Agent系统的核心组件，负责处理不同类型的输入和输出...

## 核心原理
1. **接口抽象**: 定义统一的接口规范
2. **插件机制**: 支持动态加载和卸载
3. **配置管理**: 灵活的参数配置系统

## 实现步骤
### 1. 定义适配器接口
```python
class BaseAdapter:
    def process(self, input_data):
        raise NotImplementedError
```

### 2. 实现具体适配器
继承基础接口，实现具体的处理逻辑...

## 最佳实践
- 保持接口简洁
- 做好错误处理
- 添加完整的文档

希望这个指南对大家有帮助！""",
            "post_type": PostType.TUTORIAL,
            "status": PostStatus.PUBLISHED,
            "tags": ["tutorial", "adapter", "best-practice"],
            "attachments": [],
            "metadata": {"reading_time": 5, "difficulty": "intermediate"},
            "view_count": 245,
            "like_count": 32,
            "comment_count": 18,
            "share_count": 5,
            "is_pinned": True,
            "is_locked": False,
            "is_featured": False,
            "last_activity_at": datetime.now(),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # 构建响应
        response = PostDetailResponse(
            **post_data,
            author={
                "id": post_data["author_id"],
                "username": "tech_expert",
                "nickname": "技术专家",
                "avatar_url": None
            },
            community=CommunityListItem(
                id=community_id,
                name="AI Agent开发者",
                description="专注于AI Agent开发的技术社区",
                slug="ai-agent-dev",
                community_type=CommunityType.DEVELOPMENT,
                member_count=1250,
                post_count=3420,
                is_verified=True,
                is_featured=True,
                tags=["ai", "agent", "development"],
                created_at=datetime.now()
            ),
            reactions={
                "like": 28,
                "love": 4,
                "wow": 2
            },
            user_reaction=ReactionType.LIKE if current_user else None,
            is_bookmarked=False
        )
        
        # 缓存结果
        post_cache[cache_key] = response
        
        logger.info(f"获取帖子详情: {post_id}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取帖子详情失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取帖子详情失败"
        )

@router.put("/{community_id}/posts/{post_id}", response_model=PostDetailResponse)
async def update_post(
    community_id: str = Path(..., description="社区ID"),
    post_id: str = Path(..., description="帖子ID"),
    request: PostUpdateRequest = Body(...),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    更新帖子
    
    只有作者或管理员可以更新帖子
    """
    try:
        # TODO: 检查帖子是否存在和权限
        # post = get_post_by_id(db, post_id)
        # if not post or post.community_id != community_id:
        #     raise HTTPException(404, "帖子不存在")
        
        # if post.author_id != current_user.user_id:
        #     # 检查是否是社区管理员
        #     member = get_community_member(db, community_id, current_user.user_id)
        #     if not member or not validate_community_permissions(member.role, MemberRole.MODERATOR):
        #         raise HTTPException(403, "没有权限更新此帖子")
        
        # 构建更新数据
        update_data = {k: v for k, v in request.model_dump().items() if v is not None}
        if update_data:
            update_data["updated_at"] = datetime.now()
            
            # 清理内容
            if "title" in update_data:
                update_data["title"] = sanitize_content(update_data["title"])
            if "content" in update_data:
                update_data["content"] = sanitize_content(update_data["content"])
        
        # TODO: 更新数据库
        # update_post_in_db(db, post_id, **update_data)
        
        # 清理缓存
        post_cache.clear()
        
        logger.info(f"更新帖子成功: {post_id} by {current_user.user_id}")
        
        # 返回更新后的帖子详情
        return await get_post(community_id, post_id, current_user, db, logger)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新帖子失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新帖子失败"
        )

@router.delete("/{community_id}/posts/{post_id}")
async def delete_post(
    community_id: str = Path(..., description="社区ID"),
    post_id: str = Path(..., description="帖子ID"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    删除帖子
    
    只有作者或管理员可以删除帖子
    """
    try:
        # TODO: 检查帖子是否存在和权限
        # post = get_post_by_id(db, post_id)
        # if not post or post.community_id != community_id:
        #     raise HTTPException(404, "帖子不存在")
        
        # if post.author_id != current_user.user_id:
        #     member = get_community_member(db, community_id, current_user.user_id)
        #     if not member or not validate_community_permissions(member.role, MemberRole.MODERATOR):
        #         raise HTTPException(403, "没有权限删除此帖子")
        
        # TODO: 软删除帖子
        # soft_delete_post(db, post_id)
        
        # 清理缓存
        post_cache.clear()
        comment_cache.clear()
        
        logger.info(f"删除帖子: {post_id} by {current_user.user_id}")
        
        return BaseResponse(
            success=True,
            message="帖子已删除"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除帖子失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除帖子失败"
        )

# ======================== 评论管理路由 ========================

@router.get("/{community_id}/posts/{post_id}/comments", response_model=PaginatedResponse)
async def list_post_comments(
    community_id: str = Path(..., description="社区ID"),
    post_id: str = Path(..., description="帖子ID"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    sort_by: str = Query("created_at", description="排序字段"),
    sort_order: Literal["asc", "desc"] = Query("asc", description="排序方向"),
    parent_id: Optional[str] = Query(None, description="父评论ID（获取回复）"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    获取帖子评论列表
    
    支持分页和嵌套评论
    """
    try:
        # 构建缓存键
        cache_key = f"comments:{post_id}:{page}:{size}:{sort_by}:{sort_order}:{parent_id}"
        
        # 检查缓存
        if cache_key in comment_cache:
            logger.info(f"从缓存返回评论列表: {cache_key}")
            return comment_cache[cache_key]
        
        # TODO: 实现真实的评论查询逻辑
        # comments = get_post_comments(db, post_id, page, size, sort_by, sort_order, parent_id)
        
        # 模拟评论数据
        comments = [
            CommentListItem(
                id=str(uuid.uuid4()),
                content="非常有用的教程！我按照步骤实现了一个简单的适配器，效果很好。",
                author_id=str(uuid.uuid4()),
                author_name="学习者",
                author_avatar=None,
                parent_id=parent_id,
                like_count=5,
                reply_count=2,
                is_pinned=False,
                created_at=datetime.now()
            ),
            CommentListItem(
                id=str(uuid.uuid4()),
                content="请问在第二步中，如果遇到配置文件解析错误应该怎么处理？",
                author_id=str(uuid.uuid4()),
                author_name="新手开发者",
                author_avatar=None,
                parent_id=parent_id,
                like_count=1,
                reply_count=1,
                is_pinned=False,
                created_at=datetime.now() - timedelta(minutes=30)
            )
        ]
        
        # 排序
        comments = sorted(
            comments, 
            key=lambda x: getattr(x, sort_by), 
            reverse=(sort_order == "desc")
        )
        
        # 分页
        total = len(comments)
        start = (page - 1) * size
        end = start + size
        comments = comments[start:end]
        
        response = PaginatedResponse(
            items=comments,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1
        )
        
        # 缓存结果
        comment_cache[cache_key] = response
        
        logger.info(f"获取帖子评论列表: {post_id}, 总数={total}")
        return response
        
    except Exception as e:
        logger.error(f"获取帖子评论列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取评论列表失败"
        )

@router.post("/{community_id}/posts/{post_id}/comments", response_model=CommentDetailResponse)
async def create_comment(
    community_id: str = Path(..., description="社区ID"),
    post_id: str = Path(..., description="帖子ID"),
    request: CommentCreateRequest = Body(...),
    current_user: SecurityContext = Depends(require_community_permission(
        MemberRole.MEMBER
    )),
    db: Session = Depends(get_db_session),
    notification_service = Depends(get_notification_service),
    logger: logging.Logger = Depends(get_logger)
):
    """
    创建评论
    
    需要社区成员权限
    """
    try:
        # 验证帖子ID
        if request.post_id != post_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="帖子ID不匹配"
            )
        
        # 清理内容
        clean_content = sanitize_content(request.content)
        
        # 创建评论
        comment_id = str(uuid.uuid4())
        comment_data = {
            **request.model_dump(),
            "id": comment_id,
            "author_id": current_user.user_id,
            "content": clean_content,
            "status": CommentStatus.PUBLISHED,
            "like_count": 0,
            "reply_count": 0,
            "is_pinned": False,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        # TODO: 保存到数据库
        # comment = create_comment_in_db(db, **comment_data)
        
        # 如果是回复，发送通知给被回复的用户
        if request.parent_id:
            # TODO: 获取父评论作者并发送通知
            await send_notification(
                user_id="parent_comment_author_id",
                notification_type=NotificationType.REPLY,
                title="收到新回复",
                content=f"用户 {current_user.user_id} 回复了您的评论",
                notification_service=notification_service
            )
        
        # 发送通知给帖子作者
        # TODO: 获取帖子作者并发送通知
        await send_notification(
            user_id="post_author_id",
            notification_type=NotificationType.REPLY,
            title="收到新评论",
            content=f"用户 {current_user.user_id} 评论了您的帖子",
            notification_service=notification_service
        )
        
        # 清理缓存
        comment_cache.clear()
        post_cache.clear()
        
        logger.info(f"创建评论成功: {comment_id} by {current_user.user_id} on {post_id}")
        
        # 构建响应
        comment = Comment(**comment_data)
        
        return CommentDetailResponse(
            **comment.model_dump(),
            author={
                "id": current_user.user_id,
                "username": "current_user",
                "nickname": "当前用户",
                "avatar_url": None
            },
            replies=[],
            reactions={},
            user_reaction=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建评论失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建评论失败"
        )

@router.put("/{community_id}/posts/{post_id}/comments/{comment_id}", response_model=CommentDetailResponse)
async def update_comment(
    community_id: str = Path(..., description="社区ID"),
    post_id: str = Path(..., description="帖子ID"),
    comment_id: str = Path(..., description="评论ID"),
    request: CommentUpdateRequest = Body(...),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    更新评论
    
    只有作者或管理员可以更新评论
    """
    try:
        # TODO: 检查评论是否存在和权限
        # comment = get_comment_by_id(db, comment_id)
        # if not comment or comment.post_id != post_id:
        #     raise HTTPException(404, "评论不存在")
        
        # if comment.author_id != current_user.user_id:
        #     member = get_community_member(db, community_id, current_user.user_id)
        #     if not member or not validate_community_permissions(member.role, MemberRole.MODERATOR):
        #         raise HTTPException(403, "没有权限更新此评论")
        
        # 构建更新数据
        update_data = {k: v for k, v in request.model_dump().items() if v is not None}
        if update_data:
            update_data["updated_at"] = datetime.now()
            
            # 清理内容
            if "content" in update_data:
                update_data["content"] = sanitize_content(update_data["content"])
        
        # TODO: 更新数据库
        # update_comment_in_db(db, comment_id, **update_data)
        
        # 清理缓存
        comment_cache.clear()
        
        logger.info(f"更新评论成功: {comment_id} by {current_user.user_id}")
        
        # 构建响应（模拟数据）
        comment_data = {
            "id": comment_id,
            "post_id": post_id,
            "parent_id": None,
            "author_id": current_user.user_id,
            "content": update_data.get("content", "更新后的评论内容"),
            "status": CommentStatus.PUBLISHED,
            "attachments": update_data.get("attachments", []),
            "metadata": update_data.get("metadata", {}),
            "like_count": 0,
            "reply_count": 0,
            "is_pinned": False,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        return CommentDetailResponse(
            **comment_data,
            author={
                "id": current_user.user_id,
                "username": "current_user",
                "nickname": "当前用户",
                "avatar_url": None
            },
            replies=[],
            reactions={},
            user_reaction=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新评论失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新评论失败"
        )

@router.delete("/{community_id}/posts/{post_id}/comments/{comment_id}")
async def delete_comment(
    community_id: str = Path(..., description="社区ID"),
    post_id: str = Path(..., description="帖子ID"),
    comment_id: str = Path(..., description="评论ID"),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    删除评论
    
    只有作者或管理员可以删除评论
    """
    try:
        # TODO: 检查评论是否存在和权限
        # comment = get_comment_by_id(db, comment_id)
        # if not comment or comment.post_id != post_id:
        #     raise HTTPException(404, "评论不存在")
        
        # if comment.author_id != current_user.user_id:
        #     member = get_community_member(db, community_id, current_user.user_id)
        #     if not member or not validate_community_permissions(member.role, MemberRole.MODERATOR):
        #         raise HTTPException(403, "没有权限删除此评论")
        
        # TODO: 软删除评论
        # soft_delete_comment(db, comment_id)
        
        # 清理缓存
        comment_cache.clear()
        post_cache.clear()
        
        logger.info(f"删除评论: {comment_id} by {current_user.user_id}")
        
        return BaseResponse(
            success=True,
            message="评论已删除"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除评论失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除评论失败"
        )

# ======================== 互动功能路由 ========================

@router.post("/reactions", response_model=BaseResponse)
async def create_reaction(
    request: ReactionCreateRequest = Body(...),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    notification_service = Depends(get_notification_service),
    logger: logging.Logger = Depends(get_logger)
):
    """
    创建或更新反应（点赞、喜爱等）
    
    如果已存在相同类型的反应则取消，不同类型则更新
    """
    try:
        # TODO: 检查目标是否存在
        # if request.target_type == "post":
        #     target = get_post_by_id(db, request.target_id)
        # elif request.target_type == "comment":
        #     target = get_comment_by_id(db, request.target_id)
        # else:
        #     raise HTTPException(400, "不支持的目标类型")
        
        # if not target:
        #     raise HTTPException(404, "目标不存在")
        
        # TODO: 检查是否已存在反应
        # existing_reaction = get_user_reaction(db, current_user.user_id, request.target_type, request.target_id)
        
        # 模拟反应逻辑
        reaction_id = str(uuid.uuid4())
        reaction_data = {
            "id": reaction_id,
            "user_id": current_user.user_id,
            "target_type": request.target_type,
            "target_id": request.target_id,
            "reaction_type": request.reaction_type,
            "created_at": datetime.now()
        }
        
        # TODO: 保存或更新反应
        # if existing_reaction:
        #     if existing_reaction.reaction_type == request.reaction_type:
        #         # 取消反应
        #         delete_reaction(db, existing_reaction.id)
        #         message = "反应已取消"
        #     else:
        #         # 更新反应
        #         update_reaction(db, existing_reaction.id, reaction_type=request.reaction_type)
        #         message = "反应已更新"
        # else:
        #     # 创建新反应
        #     create_reaction_in_db(db, **reaction_data)
        #     message = "反应已添加"
        
        # 发送通知给目标作者
        if request.reaction_type in [ReactionType.LIKE, ReactionType.LOVE, ReactionType.WOW]:
            await send_notification(
                user_id="target_author_id",  # TODO: 获取目标作者ID
                notification_type=NotificationType.LIKE,
                title="收到新反应",
                content=f"用户 {current_user.user_id} 对您的内容表示了 {request.reaction_type.value}",
                notification_service=notification_service
            )
        
        # 清理缓存
        post_cache.clear()
        comment_cache.clear()
        
        logger.info(f"创建反应: {request.reaction_type.value} by {current_user.user_id} on {request.target_type}:{request.target_id}")
        
        return BaseResponse(
            success=True,
            message="反应已添加"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建反应失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败"
        )

@router.post("/follow", response_model=BaseResponse)
async def create_follow(
    request: FollowCreateRequest = Body(...),
    current_user: SecurityContext = Depends(require_auth),
    db: Session = Depends(get_db_session),
    notification_service = Depends(get_notification_service),
    logger: logging.Logger = Depends(get_logger)
):
    """
    关注用户、社区或适配器
    
    如果已关注则取消关注
    """
    try:
        # TODO: 检查目标是否存在
        # if request.target_type == "user":
        #     target = get_user_by_id(db, request.target_id)
        # elif request.target_type == "community":
        #     target = get_community_by_id(db, request.target_id)
        # elif request.target_type == "adapter":
        #     target = get_adapter_by_id(db, request.target_id)
        # else:
        #     raise HTTPException(400, "不支持的关注目标类型")
        
        # if not target:
        #     raise HTTPException(404, "关注目标不存在")
        
        # 不能关注自己
        if request.target_type == "user" and request.target_id == current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能关注自己"
            )
        
        # TODO: 检查是否已关注
        # existing_follow = get_follow_relation(db, current_user.user_id, request.target_type, request.target_id)
        
        # 模拟关注逻辑
        follow_id = str(uuid.uuid4())
        follow_data = {
            "id": follow_id,
            "follower_id": current_user.user_id,
            "target_type": request.target_type,
            "target_id": request.target_id,
            "created_at": datetime.now()
        }
        
        # TODO: 保存或删除关注关系
        # if existing_follow:
        #     delete_follow(db, existing_follow.id)
        #     message = "已取消关注"
        # else:
        #     create_follow_in_db(db, **follow_data)
        #     message = "关注成功"
        
        # 发送通知
        if request.target_type == "user":
            await send_notification(
                user_id=request.target_id,
                notification_type=NotificationType.FOLLOW,
                title="新的关注者",
                content=f"用户 {current_user.user_id} 关注了您",
                notification_service=notification_service
            )
        
        # 清理缓存
        community_cache.clear()
        
        logger.info(f"关注操作: {current_user.user_id} -> {request.target_type}:{request.target_id}")
        
        return BaseResponse(
            success=True,
            message="关注成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"关注操作失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败"
        )

@router.post("/report", response_model=BaseResponse)
async def create_report(
    request: ReportCreateRequest = Body(...),
    current_user: SecurityContext = Depends(require_auth),
    client_request: Request = None,
    db: Session = Depends(get_db_session),
    notification_service = Depends(get_notification_service),
    logger: logging.Logger = Depends(get_logger)
):
    """
    举报内容
    
    支持举报帖子、评论、用户、社区
    """
    try:
        client_ip = "127.0.0.1"  # 默认IP
        if client_request:
            client_ip = client_request.client.host
        
        # TODO: 检查目标是否存在
        # if request.target_type == "post":
        #     target = get_post_by_id(db, request.target_id)
        # elif request.target_type == "comment":
        #     target = get_comment_by_id(db, request.target_id)
        # elif request.target_type == "user":
        #     target = get_user_by_id(db, request.target_id)
        # elif request.target_type == "community":
        #     target = get_community_by_id(db, request.target_id)
        # else:
        #     raise HTTPException(400, "不支持的举报目标类型")
        
        # if not target:
        #     raise HTTPException(404, "举报目标不存在")
        
        # 不能举报自己
        if request.target_type == "user" and request.target_id == current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="不能举报自己"
            )
        
        # TODO: 检查是否已举报过
        # existing_report = get_user_report(db, current_user.user_id, request.target_type, request.target_id)
        # if existing_report:
        #     raise HTTPException(409, "您已经举报过此内容")
        
        # 创建举报
        report_id = str(uuid.uuid4())
        report_data = {
            "id": report_id,
            "reporter_id": current_user.user_id,
            "target_type": request.target_type,
            "target_id": request.target_id,
            "reason": request.reason,
            "description": sanitize_content(request.description) if request.description else None,
            "status": "pending",
            "created_at": datetime.now()
        }
        
        # TODO: 保存举报
        # create_report_in_db(db, **report_data)
        
        # 发送通知给管理员
        await send_notification(
            user_id="admin_user_id",  # TODO: 获取管理员ID
            notification_type=NotificationType.SYSTEM,
            title="新的举报",
            content=f"用户 {current_user.user_id} 举报了 {request.target_type}: {request.reason.value}",
            data={"report_id": report_id, "ip_address": client_ip},
            notification_service=notification_service
        )
        
        logger.info(f"创建举报: {request.target_type}:{request.target_id} reason:{request.reason.value} by {current_user.user_id}")
        
        return BaseResponse(
            success=True,
            message="举报已提交，我们会尽快处理"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建举报失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="举报失败"
        )

# ======================== 搜索和推荐路由 ========================

@router.get("/search", response_model=PaginatedResponse)
async def search_content(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    type: Literal["all", "communities", "posts", "users"] = Query("all", description="搜索类型"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    sort_by: str = Query("relevance", description="排序方式"),
    date_filter: Optional[str] = Query(None, description="时间过滤"),
    search_service = Depends(get_search_service),
    logger: logging.Logger = Depends(get_logger)
):
    """
    全局搜索
    
    支持搜索社区、帖子、用户等内容
    """
    try:
        # TODO: 实现真实的搜索逻辑
        # results = search_service.search(
        #     query=q,
        #     content_type=type,
        #     page=page,
        #     size=size,
        #     sort_by=sort_by,
        #     date_filter=date_filter
        # )
        
        # 模拟搜索结果
        if type in ["all", "communities"]:
            communities = [
                {
                    "type": "community",
                    "id": str(uuid.uuid4()),
                    "name": f"包含'{q}'的社区",
                    "description": f"这是一个关于{q}的专业社区",
                    "member_count": 150,
                    "relevance_score": 0.95
                }
            ]
        else:
            communities = []
        
        if type in ["all", "posts"]:
            posts = [
                {
                    "type": "post",
                    "id": str(uuid.uuid4()),
                    "title": f"关于{q}的详细教程",
                    "content": f"这篇文章详细介绍了{q}的相关知识...",
                    "author_name": "技术专家",
                    "community_name": "技术社区",
                    "like_count": 25,
                    "relevance_score": 0.88
                }
            ]
        else:
            posts = []
        
        if type in ["all", "users"]:
            users = [
                {
                    "type": "user",
                    "id": str(uuid.uuid4()),
                    "username": f"{q}_expert",
                    "nickname": f"{q}专家",
                    "bio": f"专注于{q}领域的研究和开发",
                    "follower_count": 320,
                    "relevance_score": 0.75
                }
            ]
        else:
            users = []
        
        # 合并结果
        all_results = communities + posts + users
        
        # 按相关性排序
        if sort_by == "relevance":
            all_results = sorted(all_results, key=lambda x: x.get("relevance_score", 0), reverse=True)
        elif sort_by == "date":
            # TODO: 按时间排序
            pass
        
        # 分页
        total = len(all_results)
        start = (page - 1) * size
        end = start + size
        results = all_results[start:end]
        
        response = PaginatedResponse(
            items=results,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1
        )
        
        logger.info(f"搜索完成: '{q}' type={type}, 结果数={total}")
        return response
        
    except Exception as e:
        logger.error(f"搜索失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="搜索失败"
        )

@router.get("/trending", response_model=PaginatedResponse)
async def get_trending_content(
    type: Literal["posts", "communities", "tags"] = Query("posts", description="内容类型"),
    timeframe: Literal["hour", "day", "week", "month"] = Query("day", description="时间范围"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    获取热门内容
    
    基于互动量和时间计算热度
    """
    try:
        # TODO: 实现真实的热门内容算法
        # trending_content = get_trending_content_from_db(db, type, timeframe, page, size)
        
        # 模拟热门内容
        if type == "posts":
            items = [
                {
                    "id": str(uuid.uuid4()),
                    "title": "AI Agent开发的最佳实践",
                    "author_name": "技术大牛",
                    "community_name": "AI开发者",
                    "view_count": 1250,
                    "like_count": 89,
                    "comment_count": 34,
                    "trending_score": 156.7,
                    "created_at": datetime.now() - timedelta(hours=6)
                },
                {
                    "id": str(uuid.uuid4()),
                    "title": "分享一个超实用的对话适配器",
                    "author_name": "创意开发者",
                    "community_name": "适配器分享",
                    "view_count": 890,
                    "like_count": 67,
                    "comment_count": 28,
                    "trending_score": 134.2,
                    "created_at": datetime.now() - timedelta(hours=4)
                }
            ]
        elif type == "communities":
            items = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "AI Agent开发者",
                    "description": "专注于AI Agent开发的技术社区",
                    "member_count": 1250,
                    "daily_active_users": 234,
                    "new_posts_today": 15,
                    "trending_score": 89.5
                }
            ]
        else:  # tags
            items = [
                {
                    "tag": "ai-agent",
                    "post_count": 45,
                    "weekly_growth": 23,
                    "trending_score": 78.3
                },
                {
                    "tag": "adapter",
                    "post_count": 38,
                    "weekly_growth": 19,
                    "trending_score": 65.7
                }
            ]
        
        response = PaginatedResponse(
            items=items,
            total=len(items),
            page=page,
            size=size,
            has_next=False,
            has_prev=False
        )
        
        logger.info(f"获取热门内容: type={type}, timeframe={timeframe}")
        return response
        
    except Exception as e:
        logger.error(f"获取热门内容失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取热门内容失败"
        )

@router.get("/recommendations", response_model=PaginatedResponse)
async def get_recommendations(
    type: Literal["posts", "communities", "users"] = Query("posts", description="推荐类型"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    current_user: Optional[SecurityContext] = Depends(get_current_user_info),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    个性化推荐
    
    基于用户行为和兴趣推荐内容
    """
    try:
        # TODO: 实现真实的推荐算法
        # if current_user:
        #     recommendations = get_personalized_recommendations(db, current_user.user_id, type, page, size)
        # else:
        #     recommendations = get_general_recommendations(db, type, page, size)
        
        # 模拟推荐内容
        if type == "posts":
            items = [
                {
                    "id": str(uuid.uuid4()),
                    "title": "推荐：基于您的兴趣的AI教程",
                    "author_name": "AI导师",
                    "community_name": "AI学习",
                    "reason": "基于您对AI开发的兴趣",
                    "confidence_score": 0.87
                }
            ]
        elif type == "communities":
            items = [
                {
                    "id": str(uuid.uuid4()),
                    "name": "推荐社区：机器学习实践",
                    "description": "分享机器学习实践经验",
                    "member_count": 856,
                    "reason": "与您关注的内容相似",
                    "confidence_score": 0.92
                }
            ]
        else:  # users
            items = [
                {
                    "id": str(uuid.uuid4()),
                    "username": "ml_expert",
                    "nickname": "机器学习专家",
                    "bio": "专注于机器学习算法研究",
                    "follower_count": 1200,
                    "reason": "发布了您可能感兴趣的内容",
                    "confidence_score": 0.78
                }
            ]
        
        response = PaginatedResponse(
            items=items,
            total=len(items),
            page=page,
            size=size,
            has_next=False,
            has_prev=False
        )
        
        user_id = current_user.user_id if current_user else "anonymous"
        logger.info(f"获取个性化推荐: user={user_id}, type={type}")
        return response
        
    except Exception as e:
        logger.error(f"获取推荐内容失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取推荐失败"
        )

# ======================== 统计和分析路由 ========================

@router.get("/{community_id}/stats", response_model=CommunityStats)
async def get_community_stats(
    community_id: str = Path(..., description="社区ID"),
    timeframe: Literal["day", "week", "month", "year"] = Query("month", description="统计时间范围"),
    current_user: Optional[SecurityContext] = Depends(get_current_user_info),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    获取社区统计数据
    
    包括成员数、帖子数、活跃度等统计信息
    """
    try:
        # TODO: 从数据库获取真实统计数据
        # stats = calculate_community_stats(db, community_id, timeframe)
        
        # 模拟统计数据
        stats = CommunityStats(
            total_members=1250,
            active_members=234,
            total_posts=3420,
            total_comments=8750,
            posts_today=15,
            posts_this_week=89,
            posts_this_month=342,
            top_contributors=[
                {"user_id": str(uuid.uuid4()), "username": "tech_expert", "post_count": 45, "score": 1250},
                {"user_id": str(uuid.uuid4()), "username": "active_member", "post_count": 32, "score": 890},
                {"user_id": str(uuid.uuid4()), "username": "helpful_user", "post_count": 28, "score": 750}
            ],
            popular_tags=[
                {"tag": "ai-agent", "count": 156, "growth": 23},
                {"tag": "tutorial", "count": 134, "growth": 18},
                {"tag": "adapter", "count": 112, "growth": 15},
                {"tag": "best-practice", "count": 89, "growth": 12}
            ]
        )
        
        logger.info(f"获取社区统计: {community_id}, timeframe={timeframe}")
        return stats
        
    except Exception as e:
        logger.error(f"获取社区统计失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取统计数据失败"
        )

@router.get("/analytics/overview")
async def get_analytics_overview(
    timeframe: Literal["day", "week", "month"] = Query("week", description="时间范围"),
    current_user: SecurityContext = Depends(require_permission(PermissionType.ADMIN)),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    获取平台分析概览
    
    仅管理员可访问
    """
    try:
        # TODO: 实现真实的分析数据获取
        # analytics = get_platform_analytics(db, timeframe)
        
        # 模拟分析数据
        analytics = {
            "overview": {
                "total_communities": 45,
                "total_users": 12500,
                "total_posts": 34200,
                "total_comments": 87500,
                "active_users_today": 1250,
                "new_users_today": 23,
                "new_posts_today": 156,
                "growth_rate": 12.5
            },
            "trending": {
                "top_communities": [
                    {"name": "AI Agent开发者", "growth": 25.3, "new_members": 45},
                    {"name": "适配器分享", "growth": 18.7, "new_members": 32}
                ],
                "popular_topics": [
                    {"tag": "ai-agent", "mentions": 234, "growth": 15.2},
                    {"tag": "tutorial", "mentions": 189, "growth": 12.8}
                ]
            },
            "engagement": {
                "avg_posts_per_user": 2.7,
                "avg_comments_per_post": 2.6,
                "avg_session_duration": 18.5,
                "bounce_rate": 23.4
            },
            "content_quality": {
                "avg_post_score": 4.2,
                "helpful_content_ratio": 0.78,
                "reported_content_ratio": 0.02
            }
        }
        
        logger.info(f"获取平台分析概览: timeframe={timeframe}")
        return analytics
        
    except Exception as e:
        logger.error(f"获取分析概览失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取分析数据失败"
        )

# ======================== 管理功能路由 ========================

@router.put("/{community_id}/posts/{post_id}/pin")
async def pin_post(
    community_id: str = Path(..., description="社区ID"),
    post_id: str = Path(..., description="帖子ID"),
    current_user: SecurityContext = Depends(require_community_permission(
        MemberRole.MODERATOR
    )),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    置顶/取消置顶帖子
    
    需要版主或更高权限
    """
    try:
        # TODO: 更新帖子置顶状态
        # post = get_post_by_id(db, post_id)
        # if not post or post.community_id != community_id:
        #     raise HTTPException(404, "帖子不存在")
        
        # new_pin_status = not post.is_pinned
        # update_post_in_db(db, post_id, is_pinned=new_pin_status)
        
        # 清理缓存
        post_cache.clear()
        
        logger.info(f"帖子置顶操作: {post_id} by {current_user.user_id}")
        
        return BaseResponse(
            success=True,
            message="帖子已置顶" if True else "帖子已取消置顶"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"帖子置顶操作失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败"
        )

@router.put("/{community_id}/posts/{post_id}/lock")
async def lock_post(
    community_id: str = Path(..., description="社区ID"),
    post_id: str = Path(..., description="帖子ID"),
    current_user: SecurityContext = Depends(require_community_permission(
        MemberRole.MODERATOR
    )),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    锁定/解锁帖子
    
    锁定后禁止新评论，需要版主或更高权限
    """
    try:
        # TODO: 更新帖子锁定状态
        # post = get_post_by_id(db, post_id)
        # if not post or post.community_id != community_id:
        #     raise HTTPException(404, "帖子不存在")
        
        # new_lock_status = not post.is_locked
        # update_post_in_db(db, post_id, is_locked=new_lock_status)
        
        # 清理缓存
        post_cache.clear()
        
        logger.info(f"帖子锁定操作: {post_id} by {current_user.user_id}")
        
        return BaseResponse(
            success=True,
            message="帖子已锁定" if True else "帖子已解锁"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"帖子锁定操作失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="操作失败"
        )

@router.get("/reports", response_model=PaginatedResponse)
async def list_reports(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页大小"),
    status: Optional[str] = Query(None, description="处理状态"),
    target_type: Optional[str] = Query(None, description="举报目标类型"),
    current_user: SecurityContext = Depends(require_permission(PermissionType.ADMIN)),
    db: Session = Depends(get_db_session),
    logger: logging.Logger = Depends(get_logger)
):
    """
    获取举报列表
    
    仅管理员可访问
    """
    try:
        # TODO: 从数据库获取举报列表
        # reports = get_reports_list(db, page, size, status, target_type)
        
        # 模拟举报数据
        reports = [
            {
                "id": str(uuid.uuid4()),
                "reporter_id": str(uuid.uuid4()),
                "reporter_username": "concerned_user",
                "target_type": "post",
                "target_id": str(uuid.uuid4()),
                "target_title": "某个可能有问题的帖子",
                "reason": "inappropriate",
                "description": "这个帖子包含不当内容",
                "status": "pending",
                "created_at": datetime.now() - timedelta(hours=2),
                "priority": "medium"
            },
            {
                "id": str(uuid.uuid4()),
                "reporter_id": str(uuid.uuid4()),
                "reporter_username": "vigilant_member",
                "target_type": "comment",
                "target_id": str(uuid.uuid4()),
                "target_title": "某个评论",
                "reason": "spam",
                "description": "明显的垃圾信息",
                "status": "pending",
                "created_at": datetime.now() - timedelta(hours=1),
                "priority": "high"
            }
        ]
        
        # 过滤
        if status:
            reports = [r for r in reports if r["status"] == status]
        if target_type:
            reports = [r for r in reports if r["target_type"] == target_type]
        
        # 分页
        total = len(reports)
        start = (page - 1) * size
        end = start + size
        reports = reports[start:end]
        
        response = PaginatedResponse(
            items=reports,
            total=total,
            page=page,
            size=size,
            has_next=end < total,
            has_prev=page > 1
        )
        
        logger.info(f"获取举报列表: 总数={total}")
        return response
        
    except Exception as e:
        logger.error(f"获取举报列表失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取举报列表失败"
        )

# 导出路由
__all__ = ["router"]
