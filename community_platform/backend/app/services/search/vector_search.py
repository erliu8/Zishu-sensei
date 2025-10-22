"""
向量搜索服务

基于 Qdrant 的语义搜索服务
"""
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.qdrant import qdrant_manager
from app.services.search.embedding_service import get_embedding_service
from app.models.post import Post
from app.models.user import User


class VectorSearchService:
    """向量搜索服务"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedding_service = get_embedding_service()
        self.qdrant = qdrant_manager
    
    async def index_post(self, post: Post) -> bool:
        """
        为帖子创建向量索引
        
        Args:
            post: 帖子对象
        
        Returns:
            是否成功
        """
        try:
            # 生成向量
            vector = await self.embedding_service.encode_post(
                title=post.title,
                content=post.content,
                tags=post.tags,
            )
            
            # 构建 payload（存储帖子元数据）
            payload = {
                "post_id": post.id,
                "user_id": post.user_id,
                "title": post.title,
                "category": post.category,
                "tags": post.tags or [],
                "is_published": post.is_published,
                "created_at": post.created_at.isoformat() if post.created_at else None,
            }
            
            # 插入向量
            success = await self.qdrant.insert_vector(
                point_id=post.id,
                vector=vector,
                payload=payload,
            )
            
            if success:
                print(f"✅ 索引帖子: {post.id} - {post.title[:30]}")
            
            return success
            
        except Exception as e:
            print(f"❌ 索引帖子失败 (ID: {post.id}): {e}")
            return False
    
    async def batch_index_posts(self, posts: List[Post], batch_size: int = 32) -> int:
        """
        批量为帖子创建向量索引
        
        Args:
            posts: 帖子列表
            batch_size: 批处理大小
        
        Returns:
            成功索引的数量
        """
        if not posts:
            return 0
        
        success_count = 0
        
        # 分批处理
        for i in range(0, len(posts), batch_size):
            batch = posts[i:i + batch_size]
            
            # 批量生成向量
            texts = [
                f"标题: {post.title}\n内容: {post.content[:500]}\n标签: {', '.join(post.tags or [])}"
                for post in batch
            ]
            
            try:
                vectors = await self.embedding_service.encode(texts)
                
                # 构建批量插入数据
                points = []
                for post, vector in zip(batch, vectors):
                    payload = {
                        "post_id": post.id,
                        "user_id": post.user_id,
                        "title": post.title,
                        "category": post.category,
                        "tags": post.tags or [],
                        "is_published": post.is_published,
                        "created_at": post.created_at.isoformat() if post.created_at else None,
                    }
                    
                    points.append({
                        "id": post.id,
                        "vector": vector,
                        "payload": payload,
                    })
                
                # 批量插入
                if await self.qdrant.batch_insert_vectors(points):
                    success_count += len(batch)
                    print(f"✅ 批量索引 {len(batch)} 个帖子")
                
            except Exception as e:
                print(f"❌ 批量索引失败: {e}")
        
        return success_count
    
    async def search_similar_posts(
        self,
        query: str,
        limit: int = 10,
        score_threshold: float = 0.7,
        category: Optional[str] = None,
        exclude_post_ids: Optional[List[int]] = None,
    ) -> List[Tuple[Post, float]]:
        """
        语义搜索帖子
        
        Args:
            query: 搜索查询
            limit: 返回数量
            score_threshold: 相似度阈值 (0-1)
            category: 分类筛选
            exclude_post_ids: 排除的帖子 ID 列表
        
        Returns:
            (帖子, 相似度分数) 元组列表
        """
        # 生成查询向量
        query_vector = await self.embedding_service.encode_single(query)
        
        # 构建过滤器
        filter_dict = {"is_published": True}
        if category:
            filter_dict["category"] = category
        
        # 搜索相似向量
        results = await self.qdrant.search_similar(
            query_vector=query_vector,
            limit=limit * 2,  # 获取更多结果，用于过滤
            score_threshold=score_threshold,
            filter_dict=filter_dict,
        )
        
        if not results:
            return []
        
        # 获取帖子 ID
        post_ids = [r["payload"]["post_id"] for r in results]
        
        # 过滤排除的帖子
        if exclude_post_ids:
            post_ids = [pid for pid in post_ids if pid not in exclude_post_ids]
        
        # 限制数量
        post_ids = post_ids[:limit]
        
        if not post_ids:
            return []
        
        # 从数据库获取帖子详情
        query_posts = (
            select(Post)
            .options(selectinload(Post.author))
            .where(Post.id.in_(post_ids))
        )
        result = await self.db.execute(query_posts)
        posts = list(result.scalars().all())
        
        # 创建 ID 到帖子的映射
        post_map = {post.id: post for post in posts}
        
        # 创建 ID 到分数的映射
        score_map = {r["payload"]["post_id"]: r["score"] for r in results}
        
        # 按原始顺序返回结果
        results_with_scores = []
        for post_id in post_ids:
            if post_id in post_map:
                results_with_scores.append((post_map[post_id], score_map[post_id]))
        
        return results_with_scores
    
    async def find_similar_posts(
        self,
        post_id: int,
        limit: int = 10,
        score_threshold: float = 0.7,
    ) -> List[Tuple[Post, float]]:
        """
        查找相似帖子
        
        Args:
            post_id: 帖子 ID
            limit: 返回数量
            score_threshold: 相似度阈值
        
        Returns:
            (帖子, 相似度分数) 元组列表
        """
        # 获取原帖子
        query = select(Post).where(Post.id == post_id)
        result = await self.db.execute(query)
        original_post = result.scalar_one_or_none()
        
        if not original_post:
            return []
        
        # 使用原帖子的标题和内容进行搜索
        query_text = f"{original_post.title} {original_post.content[:500]}"
        
        # 搜索相似帖子，排除自己
        return await self.search_similar_posts(
            query=query_text,
            limit=limit,
            score_threshold=score_threshold,
            category=original_post.category,  # 同类别推荐
            exclude_post_ids=[post_id],
        )
    
    async def update_post_index(self, post: Post) -> bool:
        """
        更新帖子索引
        
        Args:
            post: 帖子对象
        
        Returns:
            是否成功
        """
        # 直接重新索引（upsert）
        return await self.index_post(post)
    
    async def delete_post_index(self, post_id: int) -> bool:
        """
        删除帖子索引
        
        Args:
            post_id: 帖子 ID
        
        Returns:
            是否成功
        """
        try:
            success = await self.qdrant.delete_vector(post_id)
            if success:
                print(f"✅ 删除索引: {post_id}")
            return success
        except Exception as e:
            print(f"❌ 删除索引失败 (ID: {post_id}): {e}")
            return False
    
    async def reindex_all_posts(self, batch_size: int = 100) -> int:
        """
        重新索引所有已发布的帖子
        
        Args:
            batch_size: 批处理大小
        
        Returns:
            成功索引的数量
        """
        # 获取所有已发布的帖子
        query = select(Post).where(Post.is_published == True)
        result = await self.db.execute(query)
        posts = list(result.scalars().all())
        
        print(f"🔄 开始重新索引 {len(posts)} 个帖子...")
        
        # 批量索引
        success_count = await self.batch_index_posts(posts, batch_size)
        
        print(f"✅ 完成重新索引: {success_count}/{len(posts)} 个帖子")
        
        return success_count


def get_vector_search_service(db: AsyncSession) -> VectorSearchService:
    """获取向量搜索服务实例"""
    return VectorSearchService(db)

