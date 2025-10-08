#! /usr/bin/env python3
# -*- coding: utf-8 -*-

"""
社区管理服务 - 提供全面的社区管理业务逻辑
这是整个社区系统的核心服务层，负责处理所有社区相关的业务逻辑
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple, Any, Union, Set
from enum import Enum
from dataclasses import dataclass, asdict

# 第三方库导入
try:
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy import select, update, delete, func, and_, or_, desc, asc, text
    from sqlalchemy.orm import selectinload, joinedload

    HAS_SQLALCHEMY = True
except ImportError:
    HAS_SQLALCHEMY = False

    # 提供占位符类型
    class AsyncSession:
        pass

    def select(*args, **kwargs):
        pass

    def update(*args, **kwargs):
        pass

    def delete(*args, **kwargs):
        pass

    def func(*args, **kwargs):
        pass

    def and_(*args, **kwargs):
        pass

    def or_(*args, **kwargs):
        pass

    def desc(*args, **kwargs):
        pass

    def asc(*args, **kwargs):
        pass

    def selectinload(*args, **kwargs):
        pass

    def joinedload(*args, **kwargs):
        pass

    def text(*args, **kwargs):
        pass

    logging.warning("SQLAlchemy 未安装，数据库功能将被禁用")

try:
    import aioredis

    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False
    logging.warning("aioredis 未安装，缓存功能将被禁用")

# 项目内部导入
from ..schemas.community import (
    # 枚举类型
    CommunityType,
    CommunityStatus,
    MemberRole,
    PostType,
    PostStatus,
    CommentStatus,
    ReactionType,
    NotificationType,
    ModerationAction,
    # 数据模型
    CommunityInfo,
    CommunitySettings,
    CommunityStats,
    CommunityMember,
    PostInfo,
    PostContent,
    PostStats,
    CommentInfo,
    ReactionInfo,
    NotificationInfo,
    ModerationRecord,
    CommunityActivity,
    # 请求/响应模型
    CommunityCreateRequest,
    CommunityUpdateRequest,
    CommunitySearchRequest,
    PostCreateRequest,
    PostUpdateRequest,
    PostSearchRequest,
    CommentCreateRequest,
    CommentUpdateRequest,
    ReactionRequest,
    MembershipRequest,
    ModerationRequest,
    NotificationRequest,
    CommunityListResponse,
    CommunityDetailResponse,
    PostListResponse,
    PostDetailResponse,
    CommentListResponse,
    MemberListResponse,
    NotificationListResponse,
    StatisticsResponse,
)

# 数据库模型导入
try:
    from ..models.community import (
        Community,
        CommunityMember as CommunityMemberModel,
        Post,
        Comment,
        Reaction,
        CommunityNotification,
        ModerationLog,
        CommunityActivity as CommunityActivityModel,
    )

    HAS_DATABASE = True
except ImportError:
    # 提供占位符类
    class Community:
        pass

    class CommunityMemberModel:
        pass

    class Post:
        pass

    class Comment:
        pass

    class Reaction:
        pass

    class CommunityNotification:
        pass

    class ModerationLog:
        pass

    class CommunityActivityModel:
        pass

    HAS_DATABASE = False
    logging.warning("数据库模型未找到，数据库功能将被禁用")


# 异常类定义
class CommunityNotFoundError(Exception):
    """社区未找到异常"""

    pass


class PermissionDeniedError(Exception):
    """权限拒绝异常"""

    pass


class MembershipError(Exception):
    """成员关系异常"""

    pass


class ContentModerationError(Exception):
    """内容审核异常"""

    pass


class BusinessLogicError(Exception):
    """业务逻辑异常"""

    pass


# 配置日志
logger = logging.getLogger(__name__)


@dataclass
class CommunityOperationResult:
    """社区操作结果"""

    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MembershipOperationResult:
    """成员关系操作结果"""

    success: bool
    action: str
    member_id: str
    community_id: str
    role: Optional[MemberRole] = None
    message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ContentModerationResult:
    """内容审核结果"""

    content_id: str
    content_type: str
    action: ModerationAction
    reason: str
    moderator_id: str
    automated: bool = False
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class CommunityService:
    """
    社区管理服务类

    提供完整的社区管理功能，包括：
    - 社区的增删改查
    - 成员管理和权限控制
    - 帖子和评论管理
    - 反应系统（点赞、表情等）
    - 通知系统
    - 内容审核和举报
    - 统计分析
    - 搜索和推荐
    """

    def __init__(
        self,
        db_session: Optional[AsyncSession] = None,
        redis_client: Optional[Any] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """
        初始化社区服务

        Args:
            db_session: 数据库会话
            redis_client: Redis客户端
            config: 服务配置
        """
        self.db_session = db_session
        self.redis_client = redis_client
        self.config = config or {}
        self.cache_ttl = self.config.get("cache_ttl", 3600)  # 1小时缓存

        # 初始化配置
        self.max_communities_per_user = self.config.get("max_communities_per_user", 10)
        self.max_posts_per_day = self.config.get("max_posts_per_day", 50)
        self.max_comments_per_day = self.config.get("max_comments_per_day", 200)
        self.auto_moderation_enabled = self.config.get("auto_moderation_enabled", True)

        logger.info("CommunityService 初始化完成")

    # ==================== 社区管理 ====================

    async def create_community(
        self, request: CommunityCreateRequest, creator_id: str
    ) -> CommunityOperationResult:
        """
        创建新社区

        Args:
            request: 社区创建请求
            creator_id: 创建者ID

        Returns:
            CommunityOperationResult: 创建结果
        """
        try:
            # 检查用户创建的社区数量限制
            user_communities_count = await self._get_user_communities_count(creator_id)
            if user_communities_count >= self.max_communities_per_user:
                return CommunityOperationResult(
                    success=False,
                    message=f"用户最多只能创建 {self.max_communities_per_user} 个社区",
                    error_code="COMMUNITY_LIMIT_EXCEEDED",
                )

            # 检查社区名称是否已存在
            existing_community = await self._get_community_by_name(request.name)
            if existing_community:
                return CommunityOperationResult(
                    success=False, message="社区名称已存在", error_code="COMMUNITY_NAME_EXISTS"
                )

            # 创建社区
            community_id = str(uuid.uuid4())
            community = Community(
                id=community_id,
                name=request.name,
                display_name=request.display_name,
                description=request.description,
                type=request.type,
                status=CommunityStatus.ACTIVE,
                creator_id=creator_id,
                settings=request.settings.dict() if request.settings else {},
                avatar_url=request.avatar_url,
                banner_url=request.banner_url,
                tags=request.tags or [],
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )

            if HAS_DATABASE and self.db_session:
                self.db_session.add(community)

                # 创建者自动成为管理员
                creator_member = CommunityMemberModel(
                    id=str(uuid.uuid4()),
                    community_id=community_id,
                    user_id=creator_id,
                    role=MemberRole.ADMIN,
                    status="active",
                    joined_at=datetime.now(timezone.utc),
                )
                self.db_session.add(creator_member)

                await self.db_session.commit()

                # 记录活动
                await self._log_community_activity(
                    community_id=community_id,
                    user_id=creator_id,
                    action="community_created",
                    metadata={"community_name": request.name},
                )

                # 清除相关缓存
                await self._clear_community_cache(community_id)

                return CommunityOperationResult(
                    success=True,
                    message="社区创建成功",
                    data={
                        "community_id": community_id,
                        "name": request.name,
                        "display_name": request.display_name,
                    },
                )
            else:
                return CommunityOperationResult(
                    success=False, message="数据库功能未启用", error_code="DATABASE_DISABLED"
                )

        except Exception as e:
            logger.error(f"创建社区失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return CommunityOperationResult(
                success=False, message=f"创建社区失败: {str(e)}", error_code="CREATION_FAILED"
            )

    async def get_community(
        self, community_id: str, user_id: Optional[str] = None
    ) -> Optional[CommunityDetailResponse]:
        """
        获取社区详情

        Args:
            community_id: 社区ID
            user_id: 用户ID（用于权限检查）

        Returns:
            Optional[CommunityDetailResponse]: 社区详情
        """
        try:
            # 尝试从缓存获取
            cache_key = f"community:{community_id}"
            if HAS_REDIS and self.redis_client:
                cached_data = await self.redis_client.get(cache_key)
                if cached_data:
                    community_data = json.loads(cached_data)
                    # 检查用户权限
                    if await self._check_community_access(community_id, user_id):
                        return CommunityDetailResponse(**community_data)

            if not HAS_DATABASE or not self.db_session:
                return None

            # 从数据库查询
            query = select(Community).where(Community.id == community_id)
            result = await self.db_session.execute(query)
            community = result.scalar_one_or_none()

            if not community:
                return None

            # 检查访问权限
            if not await self._check_community_access(community_id, user_id):
                return None

            # 获取社区统计信息
            stats = await self._get_community_stats(community_id)

            # 获取用户在社区中的角色
            user_role = None
            if user_id:
                user_role = await self._get_user_role_in_community(
                    community_id, user_id
                )

            # 构建响应
            response = CommunityDetailResponse(
                id=community.id,
                name=community.name,
                display_name=community.display_name,
                description=community.description,
                type=community.type,
                status=community.status,
                creator_id=community.creator_id,
                settings=community.settings,
                avatar_url=community.avatar_url,
                banner_url=community.banner_url,
                tags=community.tags,
                stats=stats,
                user_role=user_role,
                created_at=community.created_at,
                updated_at=community.updated_at,
            )

            # 缓存结果
            if HAS_REDIS and self.redis_client:
                await self.redis_client.setex(
                    cache_key, self.cache_ttl, json.dumps(response.dict(), default=str)
                )

            return response

        except Exception as e:
            logger.error(f"获取社区详情失败: {str(e)}")
            return None

    async def update_community(
        self, community_id: str, request: CommunityUpdateRequest, user_id: str
    ) -> CommunityOperationResult:
        """
        更新社区信息

        Args:
            community_id: 社区ID
            request: 更新请求
            user_id: 操作用户ID

        Returns:
            CommunityOperationResult: 更新结果
        """
        try:
            # 检查权限
            if not await self._check_community_permission(
                community_id, user_id, "manage"
            ):
                return CommunityOperationResult(
                    success=False, message="没有权限修改社区信息", error_code="PERMISSION_DENIED"
                )

            if not HAS_DATABASE or not self.db_session:
                return CommunityOperationResult(
                    success=False, message="数据库功能未启用", error_code="DATABASE_DISABLED"
                )

            # 构建更新数据
            update_data = {}
            if request.display_name is not None:
                update_data["display_name"] = request.display_name
            if request.description is not None:
                update_data["description"] = request.description
            if request.avatar_url is not None:
                update_data["avatar_url"] = request.avatar_url
            if request.banner_url is not None:
                update_data["banner_url"] = request.banner_url
            if request.tags is not None:
                update_data["tags"] = request.tags
            if request.settings is not None:
                update_data["settings"] = request.settings.dict()

            update_data["updated_at"] = datetime.now(timezone.utc)

            # 执行更新
            query = (
                update(Community)
                .where(Community.id == community_id)
                .values(**update_data)
            )
            await self.db_session.execute(query)
            await self.db_session.commit()

            # 记录活动
            await self._log_community_activity(
                community_id=community_id,
                user_id=user_id,
                action="community_updated",
                metadata={"updated_fields": list(update_data.keys())},
            )

            # 清除缓存
            await self._clear_community_cache(community_id)

            return CommunityOperationResult(
                success=True, message="社区信息更新成功", data={"community_id": community_id}
            )

        except Exception as e:
            logger.error(f"更新社区信息失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return CommunityOperationResult(
                success=False, message=f"更新社区信息失败: {str(e)}", error_code="UPDATE_FAILED"
            )

    async def delete_community(
        self, community_id: str, user_id: str
    ) -> CommunityOperationResult:
        """
        删除社区

        Args:
            community_id: 社区ID
            user_id: 操作用户ID

        Returns:
            CommunityOperationResult: 删除结果
        """
        try:
            # 检查权限（只有创建者或超级管理员可以删除）
            if not await self._check_community_permission(
                community_id, user_id, "delete"
            ):
                return CommunityOperationResult(
                    success=False, message="没有权限删除社区", error_code="PERMISSION_DENIED"
                )

            if not HAS_DATABASE or not self.db_session:
                return CommunityOperationResult(
                    success=False, message="数据库功能未启用", error_code="DATABASE_DISABLED"
                )

            # 软删除：更新状态为已删除
            query = (
                update(Community)
                .where(Community.id == community_id)
                .values(
                    status=CommunityStatus.DELETED,
                    updated_at=datetime.now(timezone.utc),
                )
            )
            await self.db_session.execute(query)
            await self.db_session.commit()

            # 记录活动
            await self._log_community_activity(
                community_id=community_id,
                user_id=user_id,
                action="community_deleted",
                metadata={},
            )

            # 清除缓存
            await self._clear_community_cache(community_id)

            return CommunityOperationResult(
                success=True, message="社区删除成功", data={"community_id": community_id}
            )

        except Exception as e:
            logger.error(f"删除社区失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return CommunityOperationResult(
                success=False, message=f"删除社区失败: {str(e)}", error_code="DELETE_FAILED"
            )

    async def search_communities(
        self, request: CommunitySearchRequest, user_id: Optional[str] = None
    ) -> CommunityListResponse:
        """
        搜索社区

        Args:
            request: 搜索请求
            user_id: 用户ID

        Returns:
            CommunityListResponse: 搜索结果
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return CommunityListResponse(
                    communities=[],
                    total=0,
                    page=request.page,
                    page_size=request.page_size,
                )

            # 构建查询
            query = select(Community).where(Community.status == CommunityStatus.ACTIVE)

            # 添加搜索条件
            if request.keyword:
                search_term = f"%{request.keyword}%"
                query = query.where(
                    or_(
                        Community.name.ilike(search_term),
                        Community.display_name.ilike(search_term),
                        Community.description.ilike(search_term),
                    )
                )

            if request.type:
                query = query.where(Community.type == request.type)

            if request.tags:
                for tag in request.tags:
                    query = query.where(Community.tags.contains([tag]))

            # 排序
            if request.sort_by == "created_at":
                query = query.order_by(
                    desc(Community.created_at)
                    if request.sort_desc
                    else asc(Community.created_at)
                )
            elif request.sort_by == "updated_at":
                query = query.order_by(
                    desc(Community.updated_at)
                    if request.sort_desc
                    else asc(Community.updated_at)
                )
            elif request.sort_by == "name":
                query = query.order_by(
                    desc(Community.name) if request.sort_desc else asc(Community.name)
                )
            else:
                query = query.order_by(desc(Community.created_at))

            # 分页
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await self.db_session.execute(total_query)
            total = total_result.scalar()

            offset = (request.page - 1) * request.page_size
            query = query.offset(offset).limit(request.page_size)

            # 执行查询
            result = await self.db_session.execute(query)
            communities = result.scalars().all()

            # 构建响应
            community_list = []
            for community in communities:
                # 获取基础统计信息
                stats = await self._get_community_basic_stats(community.id)

                community_info = CommunityInfo(
                    id=community.id,
                    name=community.name,
                    display_name=community.display_name,
                    description=community.description,
                    type=community.type,
                    status=community.status,
                    creator_id=community.creator_id,
                    avatar_url=community.avatar_url,
                    banner_url=community.banner_url,
                    tags=community.tags,
                    member_count=stats.get("member_count", 0),
                    post_count=stats.get("post_count", 0),
                    created_at=community.created_at,
                    updated_at=community.updated_at,
                )
                community_list.append(community_info)

            return CommunityListResponse(
                communities=community_list,
                total=total,
                page=request.page,
                page_size=request.page_size,
            )

        except Exception as e:
            logger.error(f"搜索社区失败: {str(e)}")
            return CommunityListResponse(
                communities=[], total=0, page=request.page, page_size=request.page_size
            )

    # ==================== 成员管理 ====================

    async def join_community(
        self,
        community_id: str,
        user_id: str,
        request: Optional[MembershipRequest] = None,
    ) -> MembershipOperationResult:
        """
        加入社区

        Args:
            community_id: 社区ID
            user_id: 用户ID
            request: 加入请求（可选）

        Returns:
            MembershipOperationResult: 操作结果
        """
        try:
            # 检查社区是否存在
            community = await self._get_community_by_id(community_id)
            if not community:
                return MembershipOperationResult(
                    success=False,
                    action="join",
                    member_id=user_id,
                    community_id=community_id,
                    message="社区不存在",
                )

            # 检查是否已经是成员
            existing_member = await self._get_community_member(community_id, user_id)
            if existing_member:
                return MembershipOperationResult(
                    success=False,
                    action="join",
                    member_id=user_id,
                    community_id=community_id,
                    message="已经是社区成员",
                )

            if not HAS_DATABASE or not self.db_session:
                return MembershipOperationResult(
                    success=False,
                    action="join",
                    member_id=user_id,
                    community_id=community_id,
                    message="数据库功能未启用",
                )

            # 创建成员记录
            member = CommunityMemberModel(
                id=str(uuid.uuid4()),
                community_id=community_id,
                user_id=user_id,
                role=MemberRole.MEMBER,
                status="active",
                joined_at=datetime.now(timezone.utc),
                application_message=request.message if request else None,
            )

            self.db_session.add(member)
            await self.db_session.commit()

            # 记录活动
            await self._log_community_activity(
                community_id=community_id,
                user_id=user_id,
                action="member_joined",
                metadata={"role": MemberRole.MEMBER.value},
            )

            # 清除相关缓存
            await self._clear_community_member_cache(community_id, user_id)

            return MembershipOperationResult(
                success=True,
                action="join",
                member_id=user_id,
                community_id=community_id,
                role=MemberRole.MEMBER,
                message="成功加入社区",
            )

        except Exception as e:
            logger.error(f"加入社区失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return MembershipOperationResult(
                success=False,
                action="join",
                member_id=user_id,
                community_id=community_id,
                message=f"加入社区失败: {str(e)}",
            )

    async def leave_community(
        self, community_id: str, user_id: str
    ) -> MembershipOperationResult:
        """
        离开社区

        Args:
            community_id: 社区ID
            user_id: 用户ID

        Returns:
            MembershipOperationResult: 操作结果
        """
        try:
            # 检查是否是成员
            member = await self._get_community_member(community_id, user_id)
            if not member:
                return MembershipOperationResult(
                    success=False,
                    action="leave",
                    member_id=user_id,
                    community_id=community_id,
                    message="不是社区成员",
                )

            # 检查是否是创建者（创建者不能离开）
            community = await self._get_community_by_id(community_id)
            if community and community.creator_id == user_id:
                return MembershipOperationResult(
                    success=False,
                    action="leave",
                    member_id=user_id,
                    community_id=community_id,
                    message="社区创建者不能离开社区",
                )

            if not HAS_DATABASE or not self.db_session:
                return MembershipOperationResult(
                    success=False,
                    action="leave",
                    member_id=user_id,
                    community_id=community_id,
                    message="数据库功能未启用",
                )

            # 删除成员记录
            query = delete(CommunityMemberModel).where(
                and_(
                    CommunityMemberModel.community_id == community_id,
                    CommunityMemberModel.user_id == user_id,
                )
            )
            await self.db_session.execute(query)
            await self.db_session.commit()

            # 记录活动
            await self._log_community_activity(
                community_id=community_id,
                user_id=user_id,
                action="member_left",
                metadata={
                    "role": member.role.value if hasattr(member, "role") else "member"
                },
            )

            # 清除相关缓存
            await self._clear_community_member_cache(community_id, user_id)

            return MembershipOperationResult(
                success=True,
                action="leave",
                member_id=user_id,
                community_id=community_id,
                message="成功离开社区",
            )

        except Exception as e:
            logger.error(f"离开社区失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return MembershipOperationResult(
                success=False,
                action="leave",
                member_id=user_id,
                community_id=community_id,
                message=f"离开社区失败: {str(e)}",
            )

    # ==================== 帖子管理 ====================

    async def create_post(
        self, request: PostCreateRequest, author_id: str
    ) -> CommunityOperationResult:
        """
        创建帖子

        Args:
            request: 帖子创建请求
            author_id: 作者ID

        Returns:
            CommunityOperationResult: 创建结果
        """
        try:
            # 检查是否是社区成员
            if not await self._is_community_member(request.community_id, author_id):
                return CommunityOperationResult(
                    success=False, message="只有社区成员才能发帖", error_code="NOT_MEMBER"
                )

            # 检查发帖频率限制
            if not await self._check_post_rate_limit(author_id):
                return CommunityOperationResult(
                    success=False,
                    message=f"今日发帖数量已达上限 ({self.max_posts_per_day})",
                    error_code="RATE_LIMIT_EXCEEDED",
                )

            if not HAS_DATABASE or not self.db_session:
                return CommunityOperationResult(
                    success=False, message="数据库功能未启用", error_code="DATABASE_DISABLED"
                )

            # 创建帖子
            post_id = str(uuid.uuid4())
            post = Post(
                id=post_id,
                community_id=request.community_id,
                author_id=author_id,
                title=request.title,
                content=request.content,
                type=request.type,
                status=PostStatus.PUBLISHED,
                tags=request.tags or [],
                attachments=request.attachments or [],
                is_pinned=False,
                is_locked=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )

            self.db_session.add(post)
            await self.db_session.commit()

            # 记录活动
            await self._log_community_activity(
                community_id=request.community_id,
                user_id=author_id,
                action="post_created",
                metadata={
                    "post_id": post_id,
                    "post_title": request.title,
                    "post_type": request.type.value,
                },
            )

            # 自动内容审核
            if self.auto_moderation_enabled:
                await self._auto_moderate_content(post_id, "post", request.content)

            return CommunityOperationResult(
                success=True,
                message="帖子创建成功",
                data={
                    "post_id": post_id,
                    "title": request.title,
                    "community_id": request.community_id,
                },
            )

        except Exception as e:
            logger.error(f"创建帖子失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return CommunityOperationResult(
                success=False, message=f"创建帖子失败: {str(e)}", error_code="CREATION_FAILED"
            )

    async def get_post(
        self, post_id: str, user_id: Optional[str] = None
    ) -> Optional[PostDetailResponse]:
        """
        获取帖子详情

        Args:
            post_id: 帖子ID
            user_id: 用户ID（用于权限检查）

        Returns:
            Optional[PostDetailResponse]: 帖子详情
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return None

            # 查询帖子
            query = select(Post).where(Post.id == post_id)
            result = await self.db_session.execute(query)
            post = result.scalar_one_or_none()

            if not post:
                return None

            # 检查访问权限
            if not await self._check_community_access(post.community_id, user_id):
                return None

            # 获取帖子统计信息
            stats = await self._get_post_stats(post_id)

            # 获取用户反应
            user_reaction = None
            if user_id:
                user_reaction = await self._get_user_reaction(post_id, user_id)

            # 构建响应
            response = PostDetailResponse(
                id=post.id,
                community_id=post.community_id,
                author_id=post.author_id,
                title=post.title,
                content=post.content,
                type=post.type,
                status=post.status,
                tags=post.tags,
                attachments=post.attachments,
                is_pinned=post.is_pinned,
                is_locked=post.is_locked,
                stats=stats,
                user_reaction=user_reaction,
                created_at=post.created_at,
                updated_at=post.updated_at,
            )

            return response

        except Exception as e:
            logger.error(f"获取帖子详情失败: {str(e)}")
            return None

    async def update_post(
        self, post_id: str, request: PostUpdateRequest, user_id: str
    ) -> CommunityOperationResult:
        """
        更新帖子

        Args:
            post_id: 帖子ID
            request: 更新请求
            user_id: 操作用户ID

        Returns:
            CommunityOperationResult: 更新结果
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return CommunityOperationResult(
                    success=False, message="数据库功能未启用", error_code="DATABASE_DISABLED"
                )

            # 获取帖子
            query = select(Post).where(Post.id == post_id)
            result = await self.db_session.execute(query)
            post = result.scalar_one_or_none()

            if not post:
                return CommunityOperationResult(
                    success=False, message="帖子不存在", error_code="POST_NOT_FOUND"
                )

            # 检查权限（作者或管理员可以编辑）
            can_edit = (
                post.author_id == user_id
                or await self._check_community_permission(
                    post.community_id, user_id, "moderate"
                )
            )

            if not can_edit:
                return CommunityOperationResult(
                    success=False, message="没有权限编辑此帖子", error_code="PERMISSION_DENIED"
                )

            # 构建更新数据
            update_data = {}
            if request.title is not None:
                update_data["title"] = request.title
            if request.content is not None:
                update_data["content"] = request.content
            if request.tags is not None:
                update_data["tags"] = request.tags
            if request.attachments is not None:
                update_data["attachments"] = request.attachments

            update_data["updated_at"] = datetime.now(timezone.utc)

            # 执行更新
            update_query = update(Post).where(Post.id == post_id).values(**update_data)
            await self.db_session.execute(update_query)
            await self.db_session.commit()

            # 记录活动
            await self._log_community_activity(
                community_id=post.community_id,
                user_id=user_id,
                action="post_updated",
                metadata={
                    "post_id": post_id,
                    "updated_fields": list(update_data.keys()),
                },
            )

            return CommunityOperationResult(
                success=True, message="帖子更新成功", data={"post_id": post_id}
            )

        except Exception as e:
            logger.error(f"更新帖子失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return CommunityOperationResult(
                success=False, message=f"更新帖子失败: {str(e)}", error_code="UPDATE_FAILED"
            )

    async def delete_post(self, post_id: str, user_id: str) -> CommunityOperationResult:
        """
        删除帖子

        Args:
            post_id: 帖子ID
            user_id: 操作用户ID

        Returns:
            CommunityOperationResult: 删除结果
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return CommunityOperationResult(
                    success=False, message="数据库功能未启用", error_code="DATABASE_DISABLED"
                )

            # 获取帖子
            query = select(Post).where(Post.id == post_id)
            result = await self.db_session.execute(query)
            post = result.scalar_one_or_none()

            if not post:
                return CommunityOperationResult(
                    success=False, message="帖子不存在", error_code="POST_NOT_FOUND"
                )

            # 检查权限
            can_delete = (
                post.author_id == user_id
                or await self._check_community_permission(
                    post.community_id, user_id, "moderate"
                )
            )

            if not can_delete:
                return CommunityOperationResult(
                    success=False, message="没有权限删除此帖子", error_code="PERMISSION_DENIED"
                )

            # 软删除
            update_query = (
                update(Post)
                .where(Post.id == post_id)
                .values(
                    status=PostStatus.DELETED, updated_at=datetime.now(timezone.utc)
                )
            )
            await self.db_session.execute(update_query)
            await self.db_session.commit()

            # 记录活动
            await self._log_community_activity(
                community_id=post.community_id,
                user_id=user_id,
                action="post_deleted",
                metadata={"post_id": post_id, "post_title": post.title},
            )

            return CommunityOperationResult(
                success=True, message="帖子删除成功", data={"post_id": post_id}
            )

        except Exception as e:
            logger.error(f"删除帖子失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return CommunityOperationResult(
                success=False, message=f"删除帖子失败: {str(e)}", error_code="DELETE_FAILED"
            )

    async def search_posts(
        self, request: PostSearchRequest, user_id: Optional[str] = None
    ) -> PostListResponse:
        """
        搜索帖子

        Args:
            request: 搜索请求
            user_id: 用户ID

        Returns:
            PostListResponse: 搜索结果
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return PostListResponse(
                    posts=[], total=0, page=request.page, page_size=request.page_size
                )

            # 构建查询
            query = select(Post).where(Post.status == PostStatus.PUBLISHED)

            # 社区过滤
            if request.community_id:
                # 检查社区访问权限
                if not await self._check_community_access(
                    request.community_id, user_id
                ):
                    return PostListResponse(
                        posts=[],
                        total=0,
                        page=request.page,
                        page_size=request.page_size,
                    )
                query = query.where(Post.community_id == request.community_id)

            # 关键词搜索
            if request.keyword:
                search_term = f"%{request.keyword}%"
                query = query.where(
                    or_(Post.title.ilike(search_term), Post.content.ilike(search_term))
                )

            # 类型过滤
            if request.type:
                query = query.where(Post.type == request.type)

            # 作者过滤
            if request.author_id:
                query = query.where(Post.author_id == request.author_id)

            # 标签过滤
            if request.tags:
                for tag in request.tags:
                    query = query.where(Post.tags.contains([tag]))

            # 时间范围过滤
            if request.date_from:
                query = query.where(Post.created_at >= request.date_from)
            if request.date_to:
                query = query.where(Post.created_at <= request.date_to)

            # 排序
            if request.sort_by == "created_at":
                query = query.order_by(
                    desc(Post.created_at) if request.sort_desc else asc(Post.created_at)
                )
            elif request.sort_by == "updated_at":
                query = query.order_by(
                    desc(Post.updated_at) if request.sort_desc else asc(Post.updated_at)
                )
            elif request.sort_by == "title":
                query = query.order_by(
                    desc(Post.title) if request.sort_desc else asc(Post.title)
                )
            else:
                # 默认按创建时间排序，置顶帖子优先
                query = query.order_by(desc(Post.is_pinned), desc(Post.created_at))

            # 分页
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await self.db_session.execute(total_query)
            total = total_result.scalar()

            offset = (request.page - 1) * request.page_size
            query = query.offset(offset).limit(request.page_size)

            # 执行查询
            result = await self.db_session.execute(query)
            posts = result.scalars().all()

            # 构建响应
            post_list = []
            for post in posts:
                # 获取基础统计信息
                stats = await self._get_post_basic_stats(post.id)

                post_info = PostInfo(
                    id=post.id,
                    community_id=post.community_id,
                    author_id=post.author_id,
                    title=post.title,
                    content=post.content[:200] + "..."
                    if len(post.content) > 200
                    else post.content,
                    type=post.type,
                    status=post.status,
                    tags=post.tags,
                    is_pinned=post.is_pinned,
                    is_locked=post.is_locked,
                    comment_count=stats.get("comment_count", 0),
                    like_count=stats.get("like_count", 0),
                    view_count=stats.get("view_count", 0),
                    created_at=post.created_at,
                    updated_at=post.updated_at,
                )
                post_list.append(post_info)

            return PostListResponse(
                posts=post_list,
                total=total,
                page=request.page,
                page_size=request.page_size,
            )

        except Exception as e:
            logger.error(f"搜索帖子失败: {str(e)}")
            return PostListResponse(
                posts=[], total=0, page=request.page, page_size=request.page_size
            )

    # ==================== 评论系统 ====================

    async def create_comment(
        self, request: CommentCreateRequest, author_id: str
    ) -> CommunityOperationResult:
        """
        创建评论

        Args:
            request: 评论创建请求
            author_id: 作者ID

        Returns:
            CommunityOperationResult: 创建结果
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return CommunityOperationResult(
                    success=False, message="数据库功能未启用", error_code="DATABASE_DISABLED"
                )

            # 获取帖子信息
            post_query = select(Post).where(Post.id == request.post_id)
            post_result = await self.db_session.execute(post_query)
            post = post_result.scalar_one_or_none()

            if not post:
                return CommunityOperationResult(
                    success=False, message="帖子不存在", error_code="POST_NOT_FOUND"
                )

            # 检查是否是社区成员
            if not await self._is_community_member(post.community_id, author_id):
                return CommunityOperationResult(
                    success=False, message="只有社区成员才能评论", error_code="NOT_MEMBER"
                )

            # 检查帖子是否被锁定
            if post.is_locked:
                can_comment = await self._check_community_permission(
                    post.community_id, author_id, "moderate"
                )
                if not can_comment:
                    return CommunityOperationResult(
                        success=False, message="帖子已被锁定，无法评论", error_code="POST_LOCKED"
                    )

            # 检查评论频率限制
            if not await self._check_comment_rate_limit(author_id):
                return CommunityOperationResult(
                    success=False,
                    message=f"今日评论数量已达上限 ({self.max_comments_per_day})",
                    error_code="RATE_LIMIT_EXCEEDED",
                )

            # 创建评论
            comment_id = str(uuid.uuid4())
            comment = Comment(
                id=comment_id,
                post_id=request.post_id,
                author_id=author_id,
                content=request.content,
                parent_id=request.parent_id,
                status=CommentStatus.PUBLISHED,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )

            self.db_session.add(comment)
            await self.db_session.commit()

            # 记录活动
            await self._log_community_activity(
                community_id=post.community_id,
                user_id=author_id,
                action="comment_created",
                metadata={
                    "comment_id": comment_id,
                    "post_id": request.post_id,
                    "parent_id": request.parent_id,
                },
            )

            # 自动内容审核
            if self.auto_moderation_enabled:
                await self._auto_moderate_content(
                    comment_id, "comment", request.content
                )

            return CommunityOperationResult(
                success=True,
                message="评论创建成功",
                data={"comment_id": comment_id, "post_id": request.post_id},
            )

        except Exception as e:
            logger.error(f"创建评论失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return CommunityOperationResult(
                success=False, message=f"创建评论失败: {str(e)}", error_code="CREATION_FAILED"
            )

    async def get_comments(
        self,
        post_id: str,
        page: int = 1,
        page_size: int = 20,
        user_id: Optional[str] = None,
    ) -> CommentListResponse:
        """
        获取评论列表

        Args:
            post_id: 帖子ID
            page: 页码
            page_size: 每页大小
            user_id: 用户ID

        Returns:
            CommentListResponse: 评论列表
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return CommentListResponse(
                    comments=[], total=0, page=page, page_size=page_size
                )

            # 检查帖子是否存在以及访问权限
            post_query = select(Post).where(Post.id == post_id)
            post_result = await self.db_session.execute(post_query)
            post = post_result.scalar_one_or_none()

            if not post:
                return CommentListResponse(
                    comments=[], total=0, page=page, page_size=page_size
                )

            if not await self._check_community_access(post.community_id, user_id):
                return CommentListResponse(
                    comments=[], total=0, page=page, page_size=page_size
                )

            # 构建查询
            query = (
                select(Comment)
                .where(
                    and_(
                        Comment.post_id == post_id,
                        Comment.status == CommentStatus.PUBLISHED,
                    )
                )
                .order_by(asc(Comment.created_at))
            )

            # 分页
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await self.db_session.execute(total_query)
            total = total_result.scalar()

            offset = (page - 1) * page_size
            query = query.offset(offset).limit(page_size)

            # 执行查询
            result = await self.db_session.execute(query)
            comments = result.scalars().all()

            # 构建响应
            comment_list = []
            for comment in comments:
                # 获取用户反应
                user_reaction = None
                if user_id:
                    user_reaction = await self._get_user_comment_reaction(
                        comment.id, user_id
                    )

                # 获取评论统计
                stats = await self._get_comment_stats(comment.id)

                comment_info = CommentInfo(
                    id=comment.id,
                    post_id=comment.post_id,
                    author_id=comment.author_id,
                    content=comment.content,
                    parent_id=comment.parent_id,
                    status=comment.status,
                    like_count=stats.get("like_count", 0),
                    reply_count=stats.get("reply_count", 0),
                    user_reaction=user_reaction,
                    created_at=comment.created_at,
                    updated_at=comment.updated_at,
                )
                comment_list.append(comment_info)

            return CommentListResponse(
                comments=comment_list, total=total, page=page, page_size=page_size
            )

        except Exception as e:
            logger.error(f"获取评论列表失败: {str(e)}")
            return CommentListResponse(
                comments=[], total=0, page=page, page_size=page_size
            )

    # ==================== 反应系统 ====================

    async def add_reaction(
        self, request: ReactionRequest, user_id: str
    ) -> CommunityOperationResult:
        """
        添加反应（点赞、表情等）

        Args:
            request: 反应请求
            user_id: 用户ID

        Returns:
            CommunityOperationResult: 操作结果
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return CommunityOperationResult(
                    success=False, message="数据库功能未启用", error_code="DATABASE_DISABLED"
                )

            # 检查目标内容是否存在
            target_exists = await self._check_target_exists(
                request.target_id, request.target_type
            )
            if not target_exists:
                return CommunityOperationResult(
                    success=False, message="目标内容不存在", error_code="TARGET_NOT_FOUND"
                )

            # 检查是否已经有反应
            existing_reaction = await self._get_user_target_reaction(
                user_id, request.target_id, request.target_type
            )

            if existing_reaction:
                if existing_reaction.type == request.type:
                    # 取消反应
                    delete_query = delete(Reaction).where(
                        and_(
                            Reaction.user_id == user_id,
                            Reaction.target_id == request.target_id,
                            Reaction.target_type == request.target_type,
                        )
                    )
                    await self.db_session.execute(delete_query)
                    action = "reaction_removed"
                else:
                    # 更新反应类型
                    update_query = (
                        update(Reaction)
                        .where(
                            and_(
                                Reaction.user_id == user_id,
                                Reaction.target_id == request.target_id,
                                Reaction.target_type == request.target_type,
                            )
                        )
                        .values(
                            type=request.type, updated_at=datetime.now(timezone.utc)
                        )
                    )
                    await self.db_session.execute(update_query)
                    action = "reaction_updated"
            else:
                # 添加新反应
                reaction = Reaction(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    target_id=request.target_id,
                    target_type=request.target_type,
                    type=request.type,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )

                self.db_session.add(reaction)
                action = "reaction_added"

            await self.db_session.commit()

            # 获取社区ID用于记录活动
            community_id = await self._get_community_id_by_target(
                request.target_id, request.target_type
            )
            if community_id:
                await self._log_community_activity(
                    community_id=community_id,
                    user_id=user_id,
                    action=action,
                    metadata={
                        "target_id": request.target_id,
                        "target_type": request.target_type,
                        "reaction_type": request.type.value,
                    },
                )

            return CommunityOperationResult(
                success=True,
                message="反应操作成功",
                data={
                    "target_id": request.target_id,
                    "target_type": request.target_type,
                    "reaction_type": request.type.value,
                    "action": action,
                },
            )

        except Exception as e:
            logger.error(f"添加反应失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return CommunityOperationResult(
                success=False, message=f"反应操作失败: {str(e)}", error_code="REACTION_FAILED"
            )

    # ==================== 辅助方法 ====================

    async def _get_user_communities_count(self, user_id: str) -> int:
        """获取用户创建的社区数量"""
        if not HAS_DATABASE or not self.db_session:
            return 0

        try:
            query = select(func.count()).where(
                and_(
                    Community.creator_id == user_id,
                    Community.status != CommunityStatus.DELETED,
                )
            )
            result = await self.db_session.execute(query)
            return result.scalar() or 0
        except Exception as e:
            logger.error(f"获取用户社区数量失败: {str(e)}")
            return 0

    async def _get_community_by_name(self, name: str) -> Optional[Community]:
        """根据名称获取社区"""
        if not HAS_DATABASE or not self.db_session:
            return None

        try:
            query = select(Community).where(Community.name == name)
            result = await self.db_session.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"根据名称获取社区失败: {str(e)}")
            return None

    async def _get_community_by_id(self, community_id: str) -> Optional[Community]:
        """根据ID获取社区"""
        if not HAS_DATABASE or not self.db_session:
            return None

        try:
            query = select(Community).where(Community.id == community_id)
            result = await self.db_session.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"根据ID获取社区失败: {str(e)}")
            return None

    async def _check_community_access(
        self, community_id: str, user_id: Optional[str]
    ) -> bool:
        """检查社区访问权限"""
        # 这里可以实现复杂的权限逻辑
        # 目前简化为：公开社区所有人可访问，私有社区需要是成员
        community = await self._get_community_by_id(community_id)
        if not community:
            return False

        if community.type == CommunityType.PUBLIC:
            return True

        if user_id:
            return await self._is_community_member(community_id, user_id)

        return False

    async def _check_community_permission(
        self, community_id: str, user_id: str, action: str
    ) -> bool:
        """检查社区操作权限"""
        member = await self._get_community_member(community_id, user_id)
        if not member:
            return False

        # 根据角色和操作类型检查权限
        if action == "manage":
            return member.role in [MemberRole.ADMIN, MemberRole.MODERATOR]
        elif action == "delete":
            community = await self._get_community_by_id(community_id)
            return community and community.creator_id == user_id
        elif action == "moderate":
            return member.role in [MemberRole.ADMIN, MemberRole.MODERATOR]

        return False

    async def _get_community_member(
        self, community_id: str, user_id: str
    ) -> Optional[CommunityMemberModel]:
        """获取社区成员信息"""
        if not HAS_DATABASE or not self.db_session:
            return None

        try:
            query = select(CommunityMemberModel).where(
                and_(
                    CommunityMemberModel.community_id == community_id,
                    CommunityMemberModel.user_id == user_id,
                    CommunityMemberModel.status == "active",
                )
            )
            result = await self.db_session.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"获取社区成员信息失败: {str(e)}")
            return None

    async def _is_community_member(self, community_id: str, user_id: str) -> bool:
        """检查是否是社区成员"""
        member = await self._get_community_member(community_id, user_id)
        return member is not None

    async def _get_user_role_in_community(
        self, community_id: str, user_id: str
    ) -> Optional[MemberRole]:
        """获取用户在社区中的角色"""
        member = await self._get_community_member(community_id, user_id)
        return member.role if member else None

    async def _get_community_stats(self, community_id: str) -> CommunityStats:
        """获取社区统计信息"""
        if not HAS_DATABASE or not self.db_session:
            return CommunityStats(
                member_count=0,
                post_count=0,
                comment_count=0,
                active_members_today=0,
                posts_today=0,
                comments_today=0,
            )

        try:
            # 成员数量
            member_query = select(func.count()).where(
                and_(
                    CommunityMemberModel.community_id == community_id,
                    CommunityMemberModel.status == "active",
                )
            )
            member_result = await self.db_session.execute(member_query)
            member_count = member_result.scalar() or 0

            # 帖子数量
            post_query = select(func.count()).where(
                and_(
                    Post.community_id == community_id,
                    Post.status == PostStatus.PUBLISHED,
                )
            )
            post_result = await self.db_session.execute(post_query)
            post_count = post_result.scalar() or 0

            # 评论数量
            comment_query = (
                select(func.count())
                .where(Post.community_id == community_id)
                .join(Comment, Comment.post_id == Post.id)
                .where(Comment.status == CommentStatus.PUBLISHED)
            )
            comment_result = await self.db_session.execute(comment_query)
            comment_count = comment_result.scalar() or 0

            # 今日活跃数据
            today = datetime.now(timezone.utc).date()

            # 今日帖子数
            posts_today_query = select(func.count()).where(
                and_(
                    Post.community_id == community_id,
                    Post.status == PostStatus.PUBLISHED,
                    func.date(Post.created_at) == today,
                )
            )
            posts_today_result = await self.db_session.execute(posts_today_query)
            posts_today = posts_today_result.scalar() or 0

            return CommunityStats(
                member_count=member_count,
                post_count=post_count,
                comment_count=comment_count,
                active_members_today=0,  # 需要更复杂的查询
                posts_today=posts_today,
                comments_today=0,  # 需要更复杂的查询
            )

        except Exception as e:
            logger.error(f"获取社区统计信息失败: {str(e)}")
            return CommunityStats(
                member_count=0,
                post_count=0,
                comment_count=0,
                active_members_today=0,
                posts_today=0,
                comments_today=0,
            )

    async def _get_community_basic_stats(self, community_id: str) -> Dict[str, int]:
        """获取社区基础统计信息"""
        if not HAS_DATABASE or not self.db_session:
            return {"member_count": 0, "post_count": 0}

        try:
            # 成员数量
            member_query = select(func.count()).where(
                and_(
                    CommunityMemberModel.community_id == community_id,
                    CommunityMemberModel.status == "active",
                )
            )
            member_result = await self.db_session.execute(member_query)
            member_count = member_result.scalar() or 0

            # 帖子数量
            post_query = select(func.count()).where(
                and_(
                    Post.community_id == community_id,
                    Post.status == PostStatus.PUBLISHED,
                )
            )
            post_result = await self.db_session.execute(post_query)
            post_count = post_result.scalar() or 0

            return {"member_count": member_count, "post_count": post_count}

        except Exception as e:
            logger.error(f"获取社区基础统计信息失败: {str(e)}")
            return {"member_count": 0, "post_count": 0}

    async def _check_post_rate_limit(self, user_id: str) -> bool:
        """检查发帖频率限制"""
        if not HAS_DATABASE or not self.db_session:
            return True

        try:
            today = datetime.now(timezone.utc).date()
            query = select(func.count()).where(
                and_(Post.author_id == user_id, func.date(Post.created_at) == today)
            )
            result = await self.db_session.execute(query)
            today_posts = result.scalar() or 0

            return today_posts < self.max_posts_per_day

        except Exception as e:
            logger.error(f"检查发帖频率限制失败: {str(e)}")
            return True

    async def _check_comment_rate_limit(self, user_id: str) -> bool:
        """检查评论频率限制"""
        if not HAS_DATABASE or not self.db_session:
            return True

        try:
            today = datetime.now(timezone.utc).date()
            query = select(func.count()).where(
                and_(
                    Comment.author_id == user_id, func.date(Comment.created_at) == today
                )
            )
            result = await self.db_session.execute(query)
            today_comments = result.scalar() or 0

            return today_comments < self.max_comments_per_day

        except Exception as e:
            logger.error(f"检查评论频率限制失败: {str(e)}")
            return True

    async def _get_post_stats(self, post_id: str) -> PostStats:
        """获取帖子统计信息"""
        if not HAS_DATABASE or not self.db_session:
            return PostStats(
                comment_count=0, like_count=0, view_count=0, reaction_counts={}
            )

        try:
            # 评论数量
            comment_query = select(func.count()).where(
                and_(
                    Comment.post_id == post_id,
                    Comment.status == CommentStatus.PUBLISHED,
                )
            )
            comment_result = await self.db_session.execute(comment_query)
            comment_count = comment_result.scalar() or 0

            # 点赞数量
            like_query = select(func.count()).where(
                and_(
                    Reaction.target_id == post_id,
                    Reaction.target_type == "post",
                    Reaction.type == ReactionType.LIKE,
                )
            )
            like_result = await self.db_session.execute(like_query)
            like_count = like_result.scalar() or 0

            # 所有反应统计
            reaction_query = (
                select(Reaction.type, func.count(Reaction.id))
                .where(
                    and_(Reaction.target_id == post_id, Reaction.target_type == "post")
                )
                .group_by(Reaction.type)
            )

            reaction_result = await self.db_session.execute(reaction_query)
            reaction_counts = {
                str(reaction_type): count
                for reaction_type, count in reaction_result.fetchall()
            }

            return PostStats(
                comment_count=comment_count,
                like_count=like_count,
                view_count=0,  # 需要单独的浏览记录表
                reaction_counts=reaction_counts,
            )

        except Exception as e:
            logger.error(f"获取帖子统计信息失败: {str(e)}")
            return PostStats(
                comment_count=0, like_count=0, view_count=0, reaction_counts={}
            )

    async def _get_post_basic_stats(self, post_id: str) -> Dict[str, int]:
        """获取帖子基础统计信息"""
        if not HAS_DATABASE or not self.db_session:
            return {"comment_count": 0, "like_count": 0, "view_count": 0}

        try:
            # 评论数量
            comment_query = select(func.count()).where(
                and_(
                    Comment.post_id == post_id,
                    Comment.status == CommentStatus.PUBLISHED,
                )
            )
            comment_result = await self.db_session.execute(comment_query)
            comment_count = comment_result.scalar() or 0

            # 点赞数量
            like_query = select(func.count()).where(
                and_(
                    Reaction.target_id == post_id,
                    Reaction.target_type == "post",
                    Reaction.type == ReactionType.LIKE,
                )
            )
            like_result = await self.db_session.execute(like_query)
            like_count = like_result.scalar() or 0

            return {
                "comment_count": comment_count,
                "like_count": like_count,
                "view_count": 0,
            }

        except Exception as e:
            logger.error(f"获取帖子基础统计信息失败: {str(e)}")
            return {"comment_count": 0, "like_count": 0, "view_count": 0}

    async def _get_comment_stats(self, comment_id: str) -> Dict[str, int]:
        """获取评论统计信息"""
        if not HAS_DATABASE or not self.db_session:
            return {"like_count": 0, "reply_count": 0}

        try:
            # 点赞数量
            like_query = select(func.count()).where(
                and_(
                    Reaction.target_id == comment_id,
                    Reaction.target_type == "comment",
                    Reaction.type == ReactionType.LIKE,
                )
            )
            like_result = await self.db_session.execute(like_query)
            like_count = like_result.scalar() or 0

            # 回复数量
            reply_query = select(func.count()).where(
                and_(
                    Comment.parent_id == comment_id,
                    Comment.status == CommentStatus.PUBLISHED,
                )
            )
            reply_result = await self.db_session.execute(reply_query)
            reply_count = reply_result.scalar() or 0

            return {"like_count": like_count, "reply_count": reply_count}

        except Exception as e:
            logger.error(f"获取评论统计信息失败: {str(e)}")
            return {"like_count": 0, "reply_count": 0}

    async def _get_user_reaction(
        self, target_id: str, user_id: str
    ) -> Optional[ReactionType]:
        """获取用户对帖子的反应"""
        if not HAS_DATABASE or not self.db_session:
            return None

        try:
            query = select(Reaction.type).where(
                and_(
                    Reaction.user_id == user_id,
                    Reaction.target_id == target_id,
                    Reaction.target_type == "post",
                )
            )
            result = await self.db_session.execute(query)
            reaction = result.scalar_one_or_none()
            return reaction

        except Exception as e:
            logger.error(f"获取用户反应失败: {str(e)}")
            return None

    async def _get_user_comment_reaction(
        self, comment_id: str, user_id: str
    ) -> Optional[ReactionType]:
        """获取用户对评论的反应"""
        if not HAS_DATABASE or not self.db_session:
            return None

        try:
            query = select(Reaction.type).where(
                and_(
                    Reaction.user_id == user_id,
                    Reaction.target_id == comment_id,
                    Reaction.target_type == "comment",
                )
            )
            result = await self.db_session.execute(query)
            reaction = result.scalar_one_or_none()
            return reaction

        except Exception as e:
            logger.error(f"获取用户评论反应失败: {str(e)}")
            return None

    async def _get_user_target_reaction(
        self, user_id: str, target_id: str, target_type: str
    ) -> Optional[Reaction]:
        """获取用户对目标的反应"""
        if not HAS_DATABASE or not self.db_session:
            return None

        try:
            query = select(Reaction).where(
                and_(
                    Reaction.user_id == user_id,
                    Reaction.target_id == target_id,
                    Reaction.target_type == target_type,
                )
            )
            result = await self.db_session.execute(query)
            return result.scalar_one_or_none()

        except Exception as e:
            logger.error(f"获取用户目标反应失败: {str(e)}")
            return None

    async def _check_target_exists(self, target_id: str, target_type: str) -> bool:
        """检查目标内容是否存在"""
        if not HAS_DATABASE or not self.db_session:
            return False

        try:
            if target_type == "post":
                query = select(func.count()).where(Post.id == target_id)
            elif target_type == "comment":
                query = select(func.count()).where(Comment.id == target_id)
            else:
                return False

            result = await self.db_session.execute(query)
            count = result.scalar() or 0
            return count > 0

        except Exception as e:
            logger.error(f"检查目标内容存在性失败: {str(e)}")
            return False

    async def _get_community_id_by_target(
        self, target_id: str, target_type: str
    ) -> Optional[str]:
        """根据目标获取社区ID"""
        if not HAS_DATABASE or not self.db_session:
            return None

        try:
            if target_type == "post":
                query = select(Post.community_id).where(Post.id == target_id)
                result = await self.db_session.execute(query)
                return result.scalar_one_or_none()
            elif target_type == "comment":
                query = (
                    select(Post.community_id)
                    .join(Comment, Comment.post_id == Post.id)
                    .where(Comment.id == target_id)
                )
                result = await self.db_session.execute(query)
                return result.scalar_one_or_none()

            return None

        except Exception as e:
            logger.error(f"根据目标获取社区ID失败: {str(e)}")
            return None

    # ==================== 统计分析功能 ====================

    async def get_community_analytics(
        self,
        community_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        user_id: Optional[str] = None,
    ) -> Optional[StatisticsResponse]:
        """
        获取社区分析数据

        Args:
            community_id: 社区ID
            start_date: 开始日期
            end_date: 结束日期
            user_id: 用户ID（用于权限检查）

        Returns:
            Optional[StatisticsResponse]: 统计数据
        """
        try:
            # 检查权限
            if not await self._check_community_permission(
                community_id, user_id, "manage"
            ):
                return None

            if not HAS_DATABASE or not self.db_session:
                return None

            # 设置默认时间范围（最近30天）
            if not end_date:
                end_date = datetime.now(timezone.utc)
            if not start_date:
                start_date = end_date - timedelta(days=30)

            # 基础统计
            basic_stats = await self._get_community_stats(community_id)

            # 时间范围内的活动统计
            activity_stats = await self._get_community_activity_stats(
                community_id, start_date, end_date
            )

            # 用户参与度统计
            engagement_stats = await self._get_community_engagement_stats(
                community_id, start_date, end_date
            )

            # 内容统计
            content_stats = await self._get_community_content_stats(
                community_id, start_date, end_date
            )

            return StatisticsResponse(
                basic_stats=basic_stats,
                activity_stats=activity_stats,
                engagement_stats=engagement_stats,
                content_stats=content_stats,
                period_start=start_date,
                period_end=end_date,
            )

        except Exception as e:
            logger.error(f"获取社区分析数据失败: {str(e)}")
            return None

    async def _get_community_activity_stats(
        self, community_id: str, start_date: datetime, end_date: datetime
    ) -> Dict[str, Any]:
        """获取社区活动统计"""
        if not HAS_DATABASE or not self.db_session:
            return {}

        try:
            # 每日活动统计
            daily_activity_query = (
                select(
                    func.date(CommunityActivityModel.created_at).label("date"),
                    func.count(CommunityActivityModel.id).label("count"),
                )
                .where(
                    and_(
                        CommunityActivityModel.community_id == community_id,
                        CommunityActivityModel.created_at >= start_date,
                        CommunityActivityModel.created_at <= end_date,
                    )
                )
                .group_by(func.date(CommunityActivityModel.created_at))
            )

            daily_result = await self.db_session.execute(daily_activity_query)
            daily_activities = [
                {"date": str(date), "count": count}
                for date, count in daily_result.fetchall()
            ]

            # 活动类型统计
            action_stats_query = (
                select(
                    CommunityActivityModel.action, func.count(CommunityActivityModel.id)
                )
                .where(
                    and_(
                        CommunityActivityModel.community_id == community_id,
                        CommunityActivityModel.created_at >= start_date,
                        CommunityActivityModel.created_at <= end_date,
                    )
                )
                .group_by(CommunityActivityModel.action)
            )

            action_result = await self.db_session.execute(action_stats_query)
            action_stats = {action: count for action, count in action_result.fetchall()}

            return {
                "daily_activities": daily_activities,
                "action_stats": action_stats,
                "total_activities": sum(action_stats.values()),
            }

        except Exception as e:
            logger.error(f"获取社区活动统计失败: {str(e)}")
            return {}

    async def _get_community_engagement_stats(
        self, community_id: str, start_date: datetime, end_date: datetime
    ) -> Dict[str, Any]:
        """获取社区参与度统计"""
        if not HAS_DATABASE or not self.db_session:
            return {}

        try:
            # 活跃用户统计
            active_users_query = select(
                func.count(func.distinct(CommunityActivityModel.user_id))
            ).where(
                and_(
                    CommunityActivityModel.community_id == community_id,
                    CommunityActivityModel.created_at >= start_date,
                    CommunityActivityModel.created_at <= end_date,
                )
            )

            active_users_result = await self.db_session.execute(active_users_query)
            active_users = active_users_result.scalar() or 0

            # 新成员统计
            new_members_query = select(func.count(CommunityMemberModel.id)).where(
                and_(
                    CommunityMemberModel.community_id == community_id,
                    CommunityMemberModel.joined_at >= start_date,
                    CommunityMemberModel.joined_at <= end_date,
                )
            )

            new_members_result = await self.db_session.execute(new_members_query)
            new_members = new_members_result.scalar() or 0

            # 用户活动排行
            top_users_query = (
                select(
                    CommunityActivityModel.user_id,
                    func.count(CommunityActivityModel.id).label("activity_count"),
                )
                .where(
                    and_(
                        CommunityActivityModel.community_id == community_id,
                        CommunityActivityModel.created_at >= start_date,
                        CommunityActivityModel.created_at <= end_date,
                    )
                )
                .group_by(CommunityActivityModel.user_id)
                .order_by(func.count(CommunityActivityModel.id).desc())
                .limit(10)
            )

            top_users_result = await self.db_session.execute(top_users_query)
            top_users = [
                {"user_id": user_id, "activity_count": count}
                for user_id, count in top_users_result.fetchall()
            ]

            return {
                "active_users": active_users,
                "new_members": new_members,
                "top_users": top_users,
            }

        except Exception as e:
            logger.error(f"获取社区参与度统计失败: {str(e)}")
            return {}

    async def _get_community_content_stats(
        self, community_id: str, start_date: datetime, end_date: datetime
    ) -> Dict[str, Any]:
        """获取社区内容统计"""
        if not HAS_DATABASE or not self.db_session:
            return {}

        try:
            # 帖子统计
            posts_query = (
                select(func.count(Post.id), Post.type)
                .where(
                    and_(
                        Post.community_id == community_id,
                        Post.created_at >= start_date,
                        Post.created_at <= end_date,
                        Post.status == PostStatus.PUBLISHED,
                    )
                )
                .group_by(Post.type)
            )

            posts_result = await self.db_session.execute(posts_query)
            posts_by_type = {
                str(post_type): count for count, post_type in posts_result.fetchall()
            }

            # 评论统计
            comments_query = (
                select(func.count(Comment.id))
                .join(Post, Comment.post_id == Post.id)
                .where(
                    and_(
                        Post.community_id == community_id,
                        Comment.created_at >= start_date,
                        Comment.created_at <= end_date,
                        Comment.status == CommentStatus.PUBLISHED,
                    )
                )
            )

            comments_result = await self.db_session.execute(comments_query)
            total_comments = comments_result.scalar() or 0

            # 反应统计
            reactions_query = (
                select(Reaction.type, func.count(Reaction.id))
                .join(Post, Reaction.target_id == Post.id)
                .where(
                    and_(
                        Post.community_id == community_id,
                        Reaction.target_type == "post",
                        Reaction.created_at >= start_date,
                        Reaction.created_at <= end_date,
                    )
                )
                .group_by(Reaction.type)
            )

            reactions_result = await self.db_session.execute(reactions_query)
            reactions_by_type = {
                str(reaction_type): count
                for reaction_type, count in reactions_result.fetchall()
            }

            return {
                "posts_by_type": posts_by_type,
                "total_posts": sum(posts_by_type.values()),
                "total_comments": total_comments,
                "reactions_by_type": reactions_by_type,
                "total_reactions": sum(reactions_by_type.values()),
            }

        except Exception as e:
            logger.error(f"获取社区内容统计失败: {str(e)}")
            return {}

    # ==================== 内容审核功能 ====================

    async def moderate_content(
        self, request: ModerationRequest, moderator_id: str
    ) -> ContentModerationResult:
        """
        审核内容

        Args:
            request: 审核请求
            moderator_id: 审核员ID

        Returns:
            ContentModerationResult: 审核结果
        """
        try:
            # 检查审核权限
            community_id = await self._get_community_id_by_target(
                request.content_id, request.content_type
            )
            if not community_id:
                return ContentModerationResult(
                    content_id=request.content_id,
                    content_type=request.content_type,
                    action=ModerationAction.NO_ACTION,
                    reason="内容不存在",
                    moderator_id=moderator_id,
                )

            if not await self._check_community_permission(
                community_id, moderator_id, "moderate"
            ):
                return ContentModerationResult(
                    content_id=request.content_id,
                    content_type=request.content_type,
                    action=ModerationAction.NO_ACTION,
                    reason="没有审核权限",
                    moderator_id=moderator_id,
                )

            if not HAS_DATABASE or not self.db_session:
                return ContentModerationResult(
                    content_id=request.content_id,
                    content_type=request.content_type,
                    action=ModerationAction.NO_ACTION,
                    reason="数据库功能未启用",
                    moderator_id=moderator_id,
                )

            # 执行审核操作
            if request.action == ModerationAction.HIDE:
                await self._hide_content(request.content_id, request.content_type)
            elif request.action == ModerationAction.DELETE:
                await self._delete_content(request.content_id, request.content_type)
            elif request.action == ModerationAction.LOCK:
                await self._lock_content(request.content_id, request.content_type)
            elif request.action == ModerationAction.PIN:
                await self._pin_content(request.content_id, request.content_type)

            # 记录审核日志
            moderation_log = ModerationLog(
                id=str(uuid.uuid4()),
                community_id=community_id,
                content_id=request.content_id,
                content_type=request.content_type,
                action=request.action,
                reason=request.reason,
                moderator_id=moderator_id,
                metadata=request.metadata or {},
                created_at=datetime.now(timezone.utc),
            )

            self.db_session.add(moderation_log)
            await self.db_session.commit()

            # 记录社区活动
            await self._log_community_activity(
                community_id=community_id,
                user_id=moderator_id,
                action="content_moderated",
                metadata={
                    "content_id": request.content_id,
                    "content_type": request.content_type,
                    "moderation_action": request.action.value,
                    "reason": request.reason,
                },
            )

            return ContentModerationResult(
                content_id=request.content_id,
                content_type=request.content_type,
                action=request.action,
                reason=request.reason,
                moderator_id=moderator_id,
                automated=False,
            )

        except Exception as e:
            logger.error(f"内容审核失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return ContentModerationResult(
                content_id=request.content_id,
                content_type=request.content_type,
                action=ModerationAction.NO_ACTION,
                reason=f"审核失败: {str(e)}",
                moderator_id=moderator_id,
            )

    async def _hide_content(self, content_id: str, content_type: str):
        """隐藏内容"""
        if content_type == "post":
            query = (
                update(Post)
                .where(Post.id == content_id)
                .values(status=PostStatus.HIDDEN, updated_at=datetime.now(timezone.utc))
            )
        elif content_type == "comment":
            query = (
                update(Comment)
                .where(Comment.id == content_id)
                .values(
                    status=CommentStatus.HIDDEN, updated_at=datetime.now(timezone.utc)
                )
            )
        else:
            return

        await self.db_session.execute(query)

    async def _delete_content(self, content_id: str, content_type: str):
        """删除内容"""
        if content_type == "post":
            query = (
                update(Post)
                .where(Post.id == content_id)
                .values(
                    status=PostStatus.DELETED, updated_at=datetime.now(timezone.utc)
                )
            )
        elif content_type == "comment":
            query = (
                update(Comment)
                .where(Comment.id == content_id)
                .values(
                    status=CommentStatus.DELETED, updated_at=datetime.now(timezone.utc)
                )
            )
        else:
            return

        await self.db_session.execute(query)

    async def _lock_content(self, content_id: str, content_type: str):
        """锁定内容"""
        if content_type == "post":
            query = (
                update(Post)
                .where(Post.id == content_id)
                .values(is_locked=True, updated_at=datetime.now(timezone.utc))
            )
            await self.db_session.execute(query)

    async def _pin_content(self, content_id: str, content_type: str):
        """置顶内容"""
        if content_type == "post":
            query = (
                update(Post)
                .where(Post.id == content_id)
                .values(is_pinned=True, updated_at=datetime.now(timezone.utc))
            )
            await self.db_session.execute(query)

    # ==================== 通知系统 ====================

    async def create_notification(
        self, request: NotificationRequest, sender_id: Optional[str] = None
    ) -> CommunityOperationResult:
        """
        创建通知

        Args:
            request: 通知请求
            sender_id: 发送者ID

        Returns:
            CommunityOperationResult: 创建结果
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return CommunityOperationResult(
                    success=False, message="数据库功能未启用", error_code="DATABASE_DISABLED"
                )

            # 创建通知
            notification_id = str(uuid.uuid4())
            notification = CommunityNotification(
                id=notification_id,
                community_id=request.community_id,
                recipient_id=request.recipient_id,
                sender_id=sender_id,
                type=request.type,
                title=request.title,
                content=request.content,
                data=request.data or {},
                is_read=False,
                created_at=datetime.now(timezone.utc),
            )

            self.db_session.add(notification)
            await self.db_session.commit()

            return CommunityOperationResult(
                success=True,
                message="通知创建成功",
                data={
                    "notification_id": notification_id,
                    "recipient_id": request.recipient_id,
                },
            )

        except Exception as e:
            logger.error(f"创建通知失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return CommunityOperationResult(
                success=False, message=f"创建通知失败: {str(e)}", error_code="CREATION_FAILED"
            )

    async def get_user_notifications(
        self,
        user_id: str,
        community_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        """
        获取用户通知列表

        Args:
            user_id: 用户ID
            community_id: 社区ID（可选）
            page: 页码
            page_size: 每页大小
            unread_only: 只获取未读通知

        Returns:
            NotificationListResponse: 通知列表
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return NotificationListResponse(
                    notifications=[],
                    total=0,
                    unread_count=0,
                    page=page,
                    page_size=page_size,
                )

            # 构建查询
            query = select(CommunityNotification).where(
                CommunityNotification.recipient_id == user_id
            )

            if community_id:
                query = query.where(CommunityNotification.community_id == community_id)

            if unread_only:
                query = query.where(CommunityNotification.is_read == False)

            query = query.order_by(desc(CommunityNotification.created_at))

            # 分页
            total_query = select(func.count()).select_from(query.subquery())
            total_result = await self.db_session.execute(total_query)
            total = total_result.scalar()

            offset = (page - 1) * page_size
            query = query.offset(offset).limit(page_size)

            # 执行查询
            result = await self.db_session.execute(query)
            notifications = result.scalars().all()

            # 获取未读数量
            unread_query = select(func.count()).where(
                and_(
                    CommunityNotification.recipient_id == user_id,
                    CommunityNotification.is_read == False,
                )
            )
            if community_id:
                unread_query = unread_query.where(
                    CommunityNotification.community_id == community_id
                )

            unread_result = await self.db_session.execute(unread_query)
            unread_count = unread_result.scalar() or 0

            # 构建响应
            notification_list = []
            for notification in notifications:
                notification_info = NotificationInfo(
                    id=notification.id,
                    community_id=notification.community_id,
                    recipient_id=notification.recipient_id,
                    sender_id=notification.sender_id,
                    type=notification.type,
                    title=notification.title,
                    content=notification.content,
                    data=notification.data,
                    is_read=notification.is_read,
                    created_at=notification.created_at,
                )
                notification_list.append(notification_info)

            return NotificationListResponse(
                notifications=notification_list,
                total=total,
                unread_count=unread_count,
                page=page,
                page_size=page_size,
            )

        except Exception as e:
            logger.error(f"获取用户通知列表失败: {str(e)}")
            return NotificationListResponse(
                notifications=[],
                total=0,
                unread_count=0,
                page=page,
                page_size=page_size,
            )

    async def mark_notification_read(
        self, notification_id: str, user_id: str
    ) -> CommunityOperationResult:
        """
        标记通知为已读

        Args:
            notification_id: 通知ID
            user_id: 用户ID

        Returns:
            CommunityOperationResult: 操作结果
        """
        try:
            if not HAS_DATABASE or not self.db_session:
                return CommunityOperationResult(
                    success=False, message="数据库功能未启用", error_code="DATABASE_DISABLED"
                )

            # 更新通知状态
            query = (
                update(CommunityNotification)
                .where(
                    and_(
                        CommunityNotification.id == notification_id,
                        CommunityNotification.recipient_id == user_id,
                    )
                )
                .values(is_read=True)
            )

            result = await self.db_session.execute(query)
            await self.db_session.commit()

            if result.rowcount > 0:
                return CommunityOperationResult(
                    success=True,
                    message="通知已标记为已读",
                    data={"notification_id": notification_id},
                )
            else:
                return CommunityOperationResult(
                    success=False,
                    message="通知不存在或没有权限",
                    error_code="NOTIFICATION_NOT_FOUND",
                )

        except Exception as e:
            logger.error(f"标记通知已读失败: {str(e)}")
            if HAS_DATABASE and self.db_session:
                await self.db_session.rollback()
            return CommunityOperationResult(
                success=False,
                message=f"标记通知已读失败: {str(e)}",
                error_code="MARK_READ_FAILED",
            )

    async def _log_community_activity(
        self, community_id: str, user_id: str, action: str, metadata: Dict[str, Any]
    ):
        """记录社区活动"""
        if not HAS_DATABASE or not self.db_session:
            return

        try:
            activity = CommunityActivityModel(
                id=str(uuid.uuid4()),
                community_id=community_id,
                user_id=user_id,
                action=action,
                metadata=metadata,
                created_at=datetime.now(timezone.utc),
            )

            self.db_session.add(activity)
            await self.db_session.commit()

        except Exception as e:
            logger.error(f"记录社区活动失败: {str(e)}")

    async def _auto_moderate_content(
        self, content_id: str, content_type: str, content: str
    ):
        """自动内容审核"""
        # 这里可以实现自动内容审核逻辑
        # 例如：敏感词检测、垃圾内容检测等
        try:
            # 简单的敏感词检测示例
            sensitive_words = ["垃圾", "广告", "欺诈", "违法"]

            for word in sensitive_words:
                if word in content:
                    # 发现敏感词，自动隐藏内容
                    await self._hide_content(content_id, content_type)

                    # 创建审核记录
                    community_id = await self._get_community_id_by_target(
                        content_id, content_type
                    )
                    if community_id:
                        moderation_log = ModerationLog(
                            id=str(uuid.uuid4()),
                            community_id=community_id,
                            content_id=content_id,
                            content_type=content_type,
                            action=ModerationAction.HIDE,
                            reason=f"自动检测到敏感词: {word}",
                            moderator_id="system",
                            metadata={"automated": True, "sensitive_word": word},
                            created_at=datetime.now(timezone.utc),
                        )

                        self.db_session.add(moderation_log)
                        await self.db_session.commit()
                    break

        except Exception as e:
            logger.error(f"自动内容审核失败: {str(e)}")

    async def _clear_community_cache(self, community_id: str):
        """清除社区相关缓存"""
        if not HAS_REDIS or not self.redis_client:
            return

        try:
            cache_keys = [
                f"community:{community_id}",
                f"community_stats:{community_id}",
                f"community_members:{community_id}:*",
            ]

            for key in cache_keys:
                if "*" in key:
                    # 删除匹配的所有键
                    keys = await self.redis_client.keys(key)
                    if keys:
                        await self.redis_client.delete(*keys)
                else:
                    await self.redis_client.delete(key)

        except Exception as e:
            logger.error(f"清除社区缓存失败: {str(e)}")

    async def _clear_community_member_cache(self, community_id: str, user_id: str):
        """清除社区成员相关缓存"""
        if not HAS_REDIS or not self.redis_client:
            return

        try:
            cache_keys = [
                f"community_member:{community_id}:{user_id}",
                f"user_communities:{user_id}",
                f"community_members:{community_id}",
            ]

            for key in cache_keys:
                await self.redis_client.delete(key)

        except Exception as e:
            logger.error(f"清除社区成员缓存失败: {str(e)}")


# 全局服务实例
_community_service_instance: Optional[CommunityService] = None


def get_community_service() -> CommunityService:
    """获取社区服务实例"""
    global _community_service_instance
    if _community_service_instance is None:
        _community_service_instance = CommunityService()
    return _community_service_instance


def set_community_service(service: CommunityService):
    """设置社区服务实例"""
    global _community_service_instance
    _community_service_instance = service


# 使用示例
async def example_usage():
    """社区服务使用示例"""
    try:
        # 初始化服务
        service = CommunityService()

        # 创建社区
        create_request = CommunityCreateRequest(
            name="tech_community",
            display_name="技术交流社区",
            description="一个专注于技术交流的社区",
            type=CommunityType.PUBLIC,
            tags=["技术", "编程", "交流"],
        )

        result = await service.create_community(create_request, "user123")
        if result.success:
            community_id = result.data["community_id"]
            print(f"社区创建成功: {community_id}")

            # 加入社区
            join_result = await service.join_community(community_id, "user456")
            if join_result.success:
                print("成功加入社区")

                # 创建帖子
                post_request = PostCreateRequest(
                    community_id=community_id,
                    title="欢迎大家来到技术社区",
                    content="这是我们的第一个帖子，欢迎大家积极参与讨论！",
                    type=PostType.DISCUSSION,
                    tags=["欢迎", "讨论"],
                )

                post_result = await service.create_post(post_request, "user456")
                if post_result.success:
                    print(f"帖子创建成功: {post_result.data['post_id']}")
                else:
                    print(f"帖子创建失败: {post_result.message}")
            else:
                print(f"加入社区失败: {join_result.message}")
        else:
            print(f"社区创建失败: {result.message}")

    except Exception as e:
        print(f"示例执行失败: {str(e)}")


if __name__ == "__main__":
    asyncio.run(example_usage())
