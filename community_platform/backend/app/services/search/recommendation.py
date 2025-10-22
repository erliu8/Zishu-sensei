"""
内容推荐服务

基于用户行为和内容相似度的个性化推荐
"""
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_
from sqlalchemy.orm import selectinload

from app.models.post import Post
from app.models.user import User
from app.models.like import Like
from app.models.comment import Comment
from app.db.redis import redis_manager
from app.services.search.vector_search import VectorSearchService


class RecommendationService:
    """内容推荐服务"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.vector_service = VectorSearchService(db)
        self.redis = redis_manager
    
    async def get_personalized_recommendations(
        self,
        user_id: int,
        limit: int = 20,
        refresh: bool = False,
    ) -> List[Post]:
        """
        获取个性化推荐
        
        基于用户的历史行为（点赞、评论、浏览）推荐相似内容
        
        Args:
            user_id: 用户 ID
            limit: 返回数量
            refresh: 是否刷新缓存
        
        Returns:
            推荐帖子列表
        """
        # 检查缓存
        cache_key = f"recommendations:user:{user_id}"
        if not refresh:
            cached = await self.redis.get_json(cache_key)
            if cached and isinstance(cached, list):
                # 从缓存的 ID 列表获取帖子
                post_ids = cached[:limit]
                if post_ids:
                    query = (
                        select(Post)
                        .options(selectinload(Post.author))
                        .where(Post.id.in_(post_ids))
                    )
                    result = await self.db.execute(query)
                    posts = list(result.scalars().all())
                    # 按原始顺序返回
                    post_map = {post.id: post for post in posts}
                    return [post_map[pid] for pid in post_ids if pid in post_map]
        
        # 获取用户兴趣帖子（最近点赞和评论的帖子）
        interest_posts = await self._get_user_interest_posts(user_id, limit=10)
        
        if not interest_posts:
            # 如果没有历史行为，返回热门帖子
            return await self.get_trending_posts(limit=limit)
        
        # 基于兴趣帖子找相似内容
        recommended_post_ids = set()
        for post in interest_posts:
            similar_posts = await self.vector_service.find_similar_posts(
                post_id=post.id,
                limit=5,
                score_threshold=0.6,
            )
            
            for similar_post, score in similar_posts:
                if similar_post.id not in recommended_post_ids:
                    recommended_post_ids.add(similar_post.id)
        
        # 获取推荐帖子
        if recommended_post_ids:
            query = (
                select(Post)
                .options(selectinload(Post.author))
                .where(
                    Post.id.in_(recommended_post_ids),
                    Post.is_published == True,
                )
                .order_by(desc(Post.created_at))
                .limit(limit)
            )
            result = await self.db.execute(query)
            recommended_posts = list(result.scalars().all())
        else:
            recommended_posts = []
        
        # 如果推荐不足，补充热门帖子
        if len(recommended_posts) < limit:
            trending = await self.get_trending_posts(
                limit=limit - len(recommended_posts),
                exclude_ids=[p.id for p in recommended_posts],
            )
            recommended_posts.extend(trending)
        
        # 缓存结果（30分钟）
        post_ids = [post.id for post in recommended_posts]
        await self.redis.set_json(cache_key, post_ids, expire=1800)
        
        return recommended_posts
    
    async def get_similar_posts(
        self,
        post_id: int,
        limit: int = 10,
    ) -> List[Tuple[Post, float]]:
        """
        获取相似帖子
        
        Args:
            post_id: 帖子 ID
            limit: 返回数量
        
        Returns:
            (帖子, 相似度分数) 元组列表
        """
        # 检查缓存
        cache_key = f"similar_posts:{post_id}"
        cached = await self.redis.get_json(cache_key)
        if cached and isinstance(cached, list):
            # 从缓存获取
            post_ids = [item["post_id"] for item in cached[:limit]]
            if post_ids:
                query = (
                    select(Post)
                    .options(selectinload(Post.author))
                    .where(Post.id.in_(post_ids))
                )
                result = await self.db.execute(query)
                posts = list(result.scalars().all())
                
                # 恢复分数
                post_map = {post.id: post for post in posts}
                score_map = {item["post_id"]: item["score"] for item in cached}
                
                return [
                    (post_map[pid], score_map[pid])
                    for pid in post_ids
                    if pid in post_map
                ]
        
        # 使用向量搜索查找相似帖子
        similar_posts = await self.vector_service.find_similar_posts(
            post_id=post_id,
            limit=limit,
            score_threshold=0.5,
        )
        
        # 缓存结果（1小时）
        cache_data = [
            {"post_id": post.id, "score": score}
            for post, score in similar_posts
        ]
        await self.redis.set_json(cache_key, cache_data, expire=3600)
        
        return similar_posts
    
    async def get_trending_posts(
        self,
        limit: int = 20,
        hours: int = 24,
        exclude_ids: Optional[List[int]] = None,
    ) -> List[Post]:
        """
        获取热门帖子
        
        基于最近的点赞、评论、浏览量计算热度
        
        Args:
            limit: 返回数量
            hours: 时间范围（小时）
            exclude_ids: 排除的帖子 ID 列表
        
        Returns:
            热门帖子列表
        """
        # 检查缓存
        cache_key = f"trending_posts:{hours}h"
        cached = await self.redis.get_json(cache_key)
        if cached and isinstance(cached, list):
            post_ids = cached[:limit]
            # 过滤排除的 ID
            if exclude_ids:
                post_ids = [pid for pid in post_ids if pid not in exclude_ids]
            
            if post_ids:
                query = (
                    select(Post)
                    .options(selectinload(Post.author))
                    .where(Post.id.in_(post_ids))
                )
                result = await self.db.execute(query)
                posts = list(result.scalars().all())
                # 按原始顺序返回
                post_map = {post.id: post for post in posts}
                return [post_map[pid] for pid in post_ids if pid in post_map]
        
        # 计算热度分数
        # 热度 = 点赞数 * 2 + 评论数 * 3 + 浏览数 * 0.1
        time_threshold = datetime.utcnow() - timedelta(hours=hours)
        
        query = (
            select(Post)
            .options(selectinload(Post.author))
            .where(
                Post.is_published == True,
                Post.created_at >= time_threshold,
            )
            .order_by(
                desc(
                    Post.like_count * 2 +
                    Post.comment_count * 3 +
                    Post.view_count * 0.1
                )
            )
        )
        
        if exclude_ids:
            query = query.where(~Post.id.in_(exclude_ids))
        
        query = query.limit(limit)
        
        result = await self.db.execute(query)
        posts = list(result.scalars().all())
        
        # 缓存结果（15分钟）
        post_ids = [post.id for post in posts]
        await self.redis.set_json(cache_key, post_ids, expire=900)
        
        return posts
    
    async def get_posts_by_category(
        self,
        category: str,
        limit: int = 20,
        sort_by: str = "latest",
    ) -> List[Post]:
        """
        按分类获取帖子
        
        Args:
            category: 分类
            limit: 返回数量
            sort_by: 排序方式 (latest: 最新, popular: 最热)
        
        Returns:
            帖子列表
        """
        query = (
            select(Post)
            .options(selectinload(Post.author))
            .where(
                Post.category == category,
                Post.is_published == True,
            )
        )
        
        if sort_by == "popular":
            query = query.order_by(
                desc(Post.like_count * 2 + Post.comment_count * 3)
            )
        else:  # latest
            query = query.order_by(desc(Post.created_at))
        
        query = query.limit(limit)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def get_posts_by_tags(
        self,
        tags: List[str],
        limit: int = 20,
    ) -> List[Post]:
        """
        按标签获取帖子
        
        Args:
            tags: 标签列表
            limit: 返回数量
        
        Returns:
            帖子列表
        """
        query = (
            select(Post)
            .options(selectinload(Post.author))
            .where(
                Post.is_published == True,
                Post.tags.overlap(tags),  # 包含任一标签
            )
            .order_by(desc(Post.created_at))
            .limit(limit)
        )
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def _get_user_interest_posts(
        self,
        user_id: int,
        limit: int = 10,
    ) -> List[Post]:
        """
        获取用户感兴趣的帖子（内部方法）
        
        基于用户最近的点赞和评论
        
        Args:
            user_id: 用户 ID
            limit: 返回数量
        
        Returns:
            帖子列表
        """
        # 获取最近点赞的帖子
        liked_query = (
            select(Post)
            .join(Like, and_(
                Like.target_id == Post.id,
                Like.target_type == "post",
            ))
            .where(Like.user_id == user_id)
            .order_by(desc(Like.created_at))
            .limit(limit // 2)
        )
        liked_result = await self.db.execute(liked_query)
        liked_posts = list(liked_result.scalars().all())
        
        # 获取最近评论的帖子
        commented_query = (
            select(Post)
            .join(Comment, Comment.post_id == Post.id)
            .where(Comment.user_id == user_id)
            .order_by(desc(Comment.created_at))
            .limit(limit // 2)
        )
        commented_result = await self.db.execute(commented_query)
        commented_posts = list(commented_result.scalars().all())
        
        # 合并去重
        post_ids = set()
        interest_posts = []
        
        for post in liked_posts + commented_posts:
            if post.id not in post_ids:
                post_ids.add(post.id)
                interest_posts.append(post)
        
        return interest_posts[:limit]


def get_recommendation_service(db: AsyncSession) -> RecommendationService:
    """获取推荐服务实例"""
    return RecommendationService(db)

