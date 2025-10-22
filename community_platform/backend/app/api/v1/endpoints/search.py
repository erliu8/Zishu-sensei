"""
搜索 API 端点
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, get_current_user
from app.schemas.search import SearchResult
from app.schemas.post import PostPublic
from app.schemas.user import UserPublic
from app.models.user import User
from app.models.post import Post
from app.db.repositories.like import LikeRepository

router = APIRouter()


@router.get("", response_model=SearchResult)
async def search(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    type: str = Query("all", description="搜索类型: all, post, user"),
    category: Optional[str] = Query(None, description="分类筛选（仅帖子）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    文本搜索
    
    搜索帖子和用户
    
    - **q**: 搜索关键词（必需）
    - **type**: 搜索类型 (all: 全部, post: 仅帖子, user: 仅用户)
    - **category**: 分类筛选（可选，仅用于帖子搜索）
    - **page**: 页码
    - **page_size**: 每页数量
    """
    skip = (page - 1) * page_size
    posts = []
    users = []
    total = 0
    
    # 搜索帖子
    if type in ["all", "post"]:
        query = (
            select(Post)
            .options(selectinload(Post.author))
            .where(
                Post.is_published == True,
                or_(
                    Post.title.ilike(f"%{q}%"),
                    Post.content.ilike(f"%{q}%")
                )
            )
        )
        
        if category:
            query = query.where(Post.category == category)
        
        # 获取总数
        from sqlalchemy import func
        count_query = select(func.count()).select_from(Post).where(
            Post.is_published == True,
            or_(
                Post.title.ilike(f"%{q}%"),
                Post.content.ilike(f"%{q}%")
            )
        )
        if category:
            count_query = count_query.where(Post.category == category)
        
        count_result = await db.execute(count_query)
        post_count = count_result.scalar_one()
        
        # 获取帖子列表
        query = query.order_by(desc(Post.created_at))
        if type == "all":
            query = query.limit(page_size // 2)  # 全部搜索时各占一半
        else:
            query = query.offset(skip).limit(page_size)
        
        result = await db.execute(query)
        post_list = list(result.scalars().all())
        
        # 构建帖子响应
        like_repo = LikeRepository(db)
        for post in post_list:
            is_liked = False
            if current_user:
                is_liked = await like_repo.has_liked(current_user.id, "post", post.id)
            
            posts.append(PostPublic(
                id=post.id,
                user_id=post.user_id,
                title=post.title,
                content=post.content,
                category=post.category,
                tags=post.tags or [],
                view_count=post.view_count,
                like_count=post.like_count,
                comment_count=post.comment_count,
                is_published=post.is_published,
                created_at=post.created_at,
                updated_at=post.updated_at,
                author=post.author,
                is_liked=is_liked,
            ))
        
        if type == "post":
            total = post_count
    
    # 搜索用户
    if type in ["all", "user"]:
        query = (
            select(User)
            .where(
                User.is_active == True,
                or_(
                    User.username.ilike(f"%{q}%"),
                    User.full_name.ilike(f"%{q}%")
                )
            )
        )
        
        # 获取总数
        from sqlalchemy import func
        count_query = select(func.count()).select_from(User).where(
            User.is_active == True,
            or_(
                User.username.ilike(f"%{q}%"),
                User.full_name.ilike(f"%{q}%")
            )
        )
        count_result = await db.execute(count_query)
        user_count = count_result.scalar_one()
        
        # 获取用户列表
        if type == "all":
            query = query.limit(page_size // 2)  # 全部搜索时各占一半
        else:
            query = query.offset(skip).limit(page_size)
        
        result = await db.execute(query)
        user_list = list(result.scalars().all())
        
        # 构建用户响应
        for user in user_list:
            users.append(UserPublic(
                id=user.id,
                username=user.username,
                full_name=user.full_name,
                avatar_url=user.avatar_url,
                bio=user.bio,
                is_verified=user.is_verified,
                created_at=user.created_at,
            ))
        
        if type == "user":
            total = user_count
    
    # 全部搜索时的总数
    if type == "all":
        total = len(posts) + len(users)
    
    return SearchResult(
        posts=posts,
        users=users,
        total=total,
    )


@router.post("/vector", response_model=List[PostPublic])
async def vector_search(
    query: str = Query(..., min_length=1, description="搜索查询"),
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
    score_threshold: float = Query(0.7, ge=0.0, le=1.0, description="相似度阈值"),
    category: Optional[str] = Query(None, description="分类筛选"),
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    向量搜索（语义搜索）
    
    使用 Qdrant 向量数据库进行语义搜索
    基于深度学习的文本嵌入，理解查询的语义含义
    
    - **query**: 搜索查询
    - **limit**: 返回数量
    - **score_threshold**: 相似度阈值 (0-1)，值越高要求越相似
    - **category**: 分类筛选（可选）
    """
    from app.services.search import get_vector_search_service
    
    # 使用向量搜索服务
    vector_service = get_vector_search_service(db)
    
    try:
        results = await vector_service.search_similar_posts(
            query=query,
            limit=limit,
            score_threshold=score_threshold,
            category=category,
        )
    except Exception as e:
        print(f"❌ 向量搜索失败，回退到文本搜索: {e}")
        # 回退到文本搜索
        query_obj = (
            select(Post)
            .options(selectinload(Post.author))
            .where(
                Post.is_published == True,
                or_(
                    Post.title.ilike(f"%{query}%"),
                    Post.content.ilike(f"%{query}%")
                )
            )
        )
        
        if category:
            query_obj = query_obj.where(Post.category == category)
        
        query_obj = query_obj.order_by(desc(Post.created_at)).limit(limit)
        
        result = await db.execute(query_obj)
        results = [(post, 1.0) for post in result.scalars().all()]
    
    # 构建响应
    posts = []
    like_repo = LikeRepository(db)
    
    for post, score in results:
        is_liked = False
        if current_user:
            is_liked = await like_repo.has_liked(current_user.id, "post", post.id)
        
        posts.append(PostPublic(
            id=post.id,
            user_id=post.user_id,
            title=post.title,
            content=post.content,
            category=post.category,
            tags=post.tags or [],
            view_count=post.view_count,
            like_count=post.like_count,
            comment_count=post.comment_count,
            is_published=post.is_published,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author=post.author,
            is_liked=is_liked,
        ))
    
    return posts


@router.get("/recommendations", response_model=List[PostPublic])
async def get_recommendations(
    limit: int = Query(20, ge=1, le=50, description="返回数量"),
    refresh: bool = Query(False, description="刷新推荐缓存"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取个性化推荐
    
    基于用户的历史行为（点赞、评论）推荐相关内容
    
    - **limit**: 返回数量
    - **refresh**: 是否刷新缓存
    """
    from app.services.search import get_recommendation_service
    
    # 使用推荐服务
    rec_service = get_recommendation_service(db)
    
    recommended_posts = await rec_service.get_personalized_recommendations(
        user_id=current_user.id,
        limit=limit,
        refresh=refresh,
    )
    
    # 构建响应
    posts = []
    like_repo = LikeRepository(db)
    
    for post in recommended_posts:
        is_liked = False
        if current_user:
            is_liked = await like_repo.has_liked(current_user.id, "post", post.id)
        
        posts.append(PostPublic(
            id=post.id,
            user_id=post.user_id,
            title=post.title,
            content=post.content,
            category=post.category,
            tags=post.tags or [],
            view_count=post.view_count,
            like_count=post.like_count,
            comment_count=post.comment_count,
            is_published=post.is_published,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author=post.author,
            is_liked=is_liked,
        ))
    
    return posts


@router.get("/similar/{post_id}", response_model=List[PostPublic])
async def get_similar_posts(
    post_id: int,
    limit: int = Query(10, ge=1, le=20, description="返回数量"),
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取相似帖子
    
    基于向量相似度推荐相关帖子
    
    - **post_id**: 帖子 ID
    - **limit**: 返回数量
    """
    from app.services.search import get_recommendation_service
    
    # 检查帖子是否存在
    query = select(Post).where(Post.id == post_id)
    result = await db.execute(query)
    post = result.scalar_one_or_none()
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 使用推荐服务
    rec_service = get_recommendation_service(db)
    
    similar_posts_with_scores = await rec_service.get_similar_posts(
        post_id=post_id,
        limit=limit,
    )
    
    # 构建响应
    posts = []
    like_repo = LikeRepository(db)
    
    for post, score in similar_posts_with_scores:
        is_liked = False
        if current_user:
            is_liked = await like_repo.has_liked(current_user.id, "post", post.id)
        
        posts.append(PostPublic(
            id=post.id,
            user_id=post.user_id,
            title=post.title,
            content=post.content,
            category=post.category,
            tags=post.tags or [],
            view_count=post.view_count,
            like_count=post.like_count,
            comment_count=post.comment_count,
            is_published=post.is_published,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author=post.author,
            is_liked=is_liked,
        ))
    
    return posts


@router.get("/trending", response_model=List[PostPublic])
async def get_trending_posts(
    limit: int = Query(20, ge=1, le=50, description="返回数量"),
    hours: int = Query(24, ge=1, le=168, description="时间范围（小时）"),
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取热门帖子
    
    基于点赞、评论、浏览量计算的热度排序
    
    - **limit**: 返回数量
    - **hours**: 时间范围（小时），默认24小时
    """
    from app.services.search import get_recommendation_service
    
    # 使用推荐服务
    rec_service = get_recommendation_service(db)
    
    trending_posts = await rec_service.get_trending_posts(
        limit=limit,
        hours=hours,
    )
    
    # 构建响应
    posts = []
    like_repo = LikeRepository(db)
    
    for post in trending_posts:
        is_liked = False
        if current_user:
            is_liked = await like_repo.has_liked(current_user.id, "post", post.id)
        
        posts.append(PostPublic(
            id=post.id,
            user_id=post.user_id,
            title=post.title,
            content=post.content,
            category=post.category,
            tags=post.tags or [],
            view_count=post.view_count,
            like_count=post.like_count,
            comment_count=post.comment_count,
            is_published=post.is_published,
            created_at=post.created_at,
            updated_at=post.updated_at,
            author=post.author,
            is_liked=is_liked,
        ))
    
    return posts

