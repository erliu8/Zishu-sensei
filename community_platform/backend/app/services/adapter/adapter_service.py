"""
适配器服务
"""
import os
import hashlib
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_, or_
from sqlalchemy.orm import selectinload
from datetime import datetime
import uuid

from app.models.adapter import (
    Adapter,
    AdapterReview,
    AdapterComment,
    AdapterFavorite,
    AdapterDownload,
    AdapterCategory,
    AdapterStatus,
)
from app.models.user import User
from app.schemas.adapter import (
    AdapterCreate,
    AdapterUpdate,
    ReviewCreate,
    CommentCreate,
)
from app.core.exceptions import NotFoundException, BadRequestException, ForbiddenException
from app.db.redis import redis_client
from app.db.qdrant import qdrant_manager


class AdapterService:
    """适配器业务逻辑服务"""
    
    @staticmethod
    async def create_adapter(
        db: AsyncSession,
        adapter_data: AdapterCreate,
        user: User
    ) -> Adapter:
        """创建适配器"""
        # 生成适配器ID
        adapter_id = f"adapter_{uuid.uuid4().hex[:12]}"
        
        # 创建适配器对象
        adapter = Adapter(
            id=adapter_id,
            name=adapter_data.name,
            display_name=adapter_data.display_name,
            description=adapter_data.description,
            long_description=adapter_data.long_description,
            category=adapter_data.category,
            type=adapter_data.type,
            version=adapter_data.version,
            min_app_version=adapter_data.min_app_version,
            author_id=user.id,
            file_url=adapter_data.file_url,
            file_size=adapter_data.file_size,
            file_hash=adapter_data.file_hash,
            icon_url=adapter_data.icon_url,
            tags=adapter_data.tags,
            dependencies=adapter_data.dependencies,
            requirements=adapter_data.requirements,
            permissions=adapter_data.permissions,
            screenshots=adapter_data.screenshots,
            config_schema=adapter_data.config_schema,
            default_config=adapter_data.default_config,
            readme=adapter_data.readme,
            changelog=adapter_data.changelog,
            repository_url=adapter_data.repository_url,
            homepage_url=adapter_data.homepage_url,
            status=AdapterStatus.DRAFT,
        )
        
        db.add(adapter)
        await db.commit()
        await db.refresh(adapter)
        
        # 异步：添加到向量数据库（用于搜索）
        # asyncio.create_task(qdrant_manager.add_adapter(adapter))
        
        return adapter
    
    @staticmethod
    async def get_adapter(
        db: AsyncSession,
        adapter_id: str,
        user: Optional[User] = None,
        increment_views: bool = True
    ) -> Adapter:
        """获取适配器详情"""
        result = await db.execute(
            select(Adapter)
            .options(selectinload(Adapter.author))
            .where(Adapter.id == adapter_id)
        )
        adapter = result.scalar_one_or_none()
        
        if not adapter:
            raise NotFoundException(f"适配器 {adapter_id} 不存在")
        
        # 检查权限
        if adapter.status != AdapterStatus.PUBLISHED:
            if not user or (adapter.author_id != user.id and user.role != "admin"):
                raise ForbiddenException("无权访问此适配器")
        
        # 增加浏览量
        if increment_views and adapter.status == AdapterStatus.PUBLISHED:
            adapter.views += 1
            await db.commit()
        
        return adapter
    
    @staticmethod
    async def list_adapters(
        db: AsyncSession,
        page: int = 1,
        size: int = 20,
        category: Optional[AdapterCategory] = None,
        search: Optional[str] = None,
        tags: Optional[List[str]] = None,
        sort_by: str = "created_at",
        order: str = "desc",
        featured_only: bool = False,
        verified_only: bool = False,
    ) -> Tuple[List[Adapter], int]:
        """获取适配器列表"""
        # 构建基础查询
        query = select(Adapter).options(selectinload(Adapter.author)).where(
            Adapter.status == AdapterStatus.PUBLISHED
        )
        
        # 分类筛选
        if category:
            query = query.where(Adapter.category == category)
        
        # 关键词搜索
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Adapter.name.ilike(search_pattern),
                    Adapter.display_name.ilike(search_pattern),
                    Adapter.description.ilike(search_pattern),
                )
            )
        
        # 标签筛选
        if tags:
            for tag in tags:
                query = query.where(Adapter.tags.contains([tag]))
        
        # 特色筛选
        if featured_only:
            query = query.where(Adapter.is_featured == True)
        
        # 认证筛选
        if verified_only:
            query = query.where(Adapter.is_verified == True)
        
        # 总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # 排序
        if sort_by == "downloads":
            order_col = Adapter.downloads
        elif sort_by == "rating":
            order_col = Adapter.rating
        elif sort_by == "created_at":
            order_col = Adapter.created_at
        elif sort_by == "updated_at":
            order_col = Adapter.updated_at
        else:
            order_col = Adapter.created_at
        
        if order == "desc":
            query = query.order_by(desc(order_col))
        else:
            query = query.order_by(order_col)
        
        # 分页
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)
        
        result = await db.execute(query)
        adapters = result.scalars().all()
        
        return list(adapters), total
    
    @staticmethod
    async def update_adapter(
        db: AsyncSession,
        adapter_id: str,
        adapter_data: AdapterUpdate,
        user: User
    ) -> Adapter:
        """更新适配器"""
        adapter = await AdapterService.get_adapter(db, adapter_id, user=user, increment_views=False)
        
        # 检查权限
        if adapter.author_id != user.id and user.role != "admin":
            raise ForbiddenException("无权编辑此适配器")
        
        # 更新字段
        update_data = adapter_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(adapter, field, value)
        
        adapter.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(adapter)
        
        # 清除缓存
        redis_client.delete(f"adapter:{adapter_id}")
        
        return adapter
    
    @staticmethod
    async def delete_adapter(
        db: AsyncSession,
        adapter_id: str,
        user: User
    ):
        """删除适配器"""
        adapter = await AdapterService.get_adapter(db, adapter_id, user=user, increment_views=False)
        
        # 检查权限
        if adapter.author_id != user.id and user.role != "admin":
            raise ForbiddenException("无权删除此适配器")
        
        # 归档而不是真正删除
        adapter.status = AdapterStatus.ARCHIVED
        await db.commit()
        
        # 清除缓存
        redis_client.delete(f"adapter:{adapter_id}")
    
    @staticmethod
    async def publish_adapter(
        db: AsyncSession,
        adapter_id: str,
        user: User
    ) -> Adapter:
        """发布适配器"""
        adapter = await AdapterService.get_adapter(db, adapter_id, user=user, increment_views=False)
        
        # 检查权限
        if adapter.author_id != user.id:
            raise ForbiddenException("无权发布此适配器")
        
        # 验证必要字段
        if not adapter.description or not adapter.file_url:
            raise BadRequestException("适配器信息不完整")
        
        adapter.status = AdapterStatus.PENDING_REVIEW
        adapter.published_at = datetime.utcnow()
        await db.commit()
        await db.refresh(adapter)
        
        return adapter
    
    @staticmethod
    async def download_adapter(
        db: AsyncSession,
        adapter_id: str,
        user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        platform: Optional[str] = None,
    ) -> str:
        """下载适配器"""
        adapter = await AdapterService.get_adapter(db, adapter_id, user=user, increment_views=False)
        
        # 增加下载计数
        adapter.downloads += 1
        
        # 记录下载
        download_record = AdapterDownload(
            id=f"dl_{uuid.uuid4().hex[:12]}",
            adapter_id=adapter_id,
            user_id=user.id if user else None,
            ip_address=ip_address,
            user_agent=user_agent,
            platform=platform,
        )
        db.add(download_record)
        
        await db.commit()
        
        # 返回下载URL
        return adapter.file_url
    
    @staticmethod
    async def favorite_adapter(
        db: AsyncSession,
        adapter_id: str,
        user: User
    ):
        """收藏适配器"""
        adapter = await AdapterService.get_adapter(db, adapter_id, user=user, increment_views=False)
        
        # 检查是否已收藏
        result = await db.execute(
            select(AdapterFavorite).where(
                and_(
                    AdapterFavorite.adapter_id == adapter_id,
                    AdapterFavorite.user_id == user.id
                )
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise BadRequestException("已经收藏过此适配器")
        
        # 创建收藏记录
        favorite = AdapterFavorite(
            id=f"fav_{uuid.uuid4().hex[:12]}",
            adapter_id=adapter_id,
            user_id=user.id,
        )
        db.add(favorite)
        
        # 增加收藏计数
        adapter.favorites += 1
        
        await db.commit()
    
    @staticmethod
    async def unfavorite_adapter(
        db: AsyncSession,
        adapter_id: str,
        user: User
    ):
        """取消收藏适配器"""
        result = await db.execute(
            select(AdapterFavorite).where(
                and_(
                    AdapterFavorite.adapter_id == adapter_id,
                    AdapterFavorite.user_id == user.id
                )
            )
        )
        favorite = result.scalar_one_or_none()
        
        if not favorite:
            raise NotFoundException("未收藏此适配器")
        
        # 删除收藏记录
        await db.delete(favorite)
        
        # 减少收藏计数
        result = await db.execute(
            select(Adapter).where(Adapter.id == adapter_id)
        )
        adapter = result.scalar_one_or_none()
        if adapter and adapter.favorites > 0:
            adapter.favorites -= 1
        
        await db.commit()
    
    @staticmethod
    async def create_review(
        db: AsyncSession,
        adapter_id: str,
        review_data: ReviewCreate,
        user: User
    ) -> AdapterReview:
        """创建评价"""
        adapter = await AdapterService.get_adapter(db, adapter_id, user=user, increment_views=False)
        
        # 检查是否已评价
        result = await db.execute(
            select(AdapterReview).where(
                and_(
                    AdapterReview.adapter_id == adapter_id,
                    AdapterReview.user_id == user.id
                )
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            raise BadRequestException("已经评价过此适配器")
        
        # 创建评价
        review = AdapterReview(
            id=f"rev_{uuid.uuid4().hex[:12]}",
            adapter_id=adapter_id,
            user_id=user.id,
            rating=review_data.rating,
            title=review_data.title,
            content=review_data.content,
            ease_of_use=review_data.ease_of_use,
            performance=review_data.performance,
            stability=review_data.stability,
            documentation=review_data.documentation,
        )
        db.add(review)
        
        # 更新适配器评分
        result = await db.execute(
            select(AdapterReview).where(AdapterReview.adapter_id == adapter_id)
        )
        reviews = result.scalars().all()
        
        total_rating = sum(r.rating for r in reviews) + review_data.rating
        adapter.rating_count = len(reviews) + 1
        adapter.rating = total_rating / adapter.rating_count
        
        await db.commit()
        await db.refresh(review)
        
        return review
    
    @staticmethod
    async def create_comment(
        db: AsyncSession,
        adapter_id: str,
        comment_data: CommentCreate,
        user: User
    ) -> AdapterComment:
        """创建评论"""
        adapter = await AdapterService.get_adapter(db, adapter_id, user=user, increment_views=False)
        
        comment = AdapterComment(
            id=f"cmt_{uuid.uuid4().hex[:12]}",
            adapter_id=adapter_id,
            user_id=user.id,
            parent_id=comment_data.parent_id,
            content=comment_data.content,
        )
        db.add(comment)
        await db.commit()
        await db.refresh(comment)
        
        return comment
    
    @staticmethod
    async def get_user_favorites(
        db: AsyncSession,
        user: User,
        page: int = 1,
        size: int = 20
    ) -> Tuple[List[Adapter], int]:
        """获取用户收藏的适配器"""
        # 构建查询
        query = (
            select(Adapter)
            .join(AdapterFavorite, Adapter.id == AdapterFavorite.adapter_id)
            .where(AdapterFavorite.user_id == user.id)
            .order_by(desc(AdapterFavorite.created_at))
        )
        
        # 总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # 分页
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)
        
        result = await db.execute(query)
        adapters = result.scalars().all()
        
        return list(adapters), total
    
    @staticmethod
    async def get_user_adapters(
        db: AsyncSession,
        user_id: str,
        page: int = 1,
        size: int = 20
    ) -> Tuple[List[Adapter], int]:
        """获取用户创建的适配器"""
        query = (
            select(Adapter)
            .where(Adapter.author_id == user_id)
            .order_by(desc(Adapter.created_at))
        )
        
        # 总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # 分页
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)
        
        result = await db.execute(query)
        adapters = result.scalars().all()
        
        return list(adapters), total
    
    @staticmethod
    async def get_stats(db: AsyncSession) -> Dict[str, Any]:
        """获取统计信息"""
        # 总适配器数
        total_result = await db.execute(
            select(func.count(Adapter.id)).where(
                Adapter.status == AdapterStatus.PUBLISHED
            )
        )
        total_adapters = total_result.scalar()
        
        # 总下载数
        downloads_result = await db.execute(
            select(func.sum(Adapter.downloads))
        )
        total_downloads = downloads_result.scalar() or 0
        
        # 总作者数
        authors_result = await db.execute(
            select(func.count(func.distinct(Adapter.author_id)))
        )
        total_authors = authors_result.scalar()
        
        stats = {
            "total_adapters": total_adapters,
            "total_downloads": total_downloads,
            "total_authors": total_authors,
            "categories": {},
            "popular_tags": [],
        }
        
        # 各分类数量
        categories_result = await db.execute(
            select(Adapter.category, func.count(Adapter.id))
            .where(Adapter.status == AdapterStatus.PUBLISHED)
            .group_by(Adapter.category)
        )
        categories = categories_result.all()
        
        stats["categories"] = {cat.value: count for cat, count in categories}
        
        return stats
