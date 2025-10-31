"""
帖子 API 端点
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, desc, func, or_

from app.core.deps import get_db, get_current_user, get_optional_current_user
from app.core.response import create_success_response
from app.schemas.post import PostCreate, PostUpdate, PostPublic, PostDetail
from app.schemas.comment import CommentCreate, CommentCreateForPost, CommentPublic
from app.schemas.common import PaginatedResponse
from app.db.repositories.post import PostRepository
from app.db.repositories.like import LikeRepository
from app.db.repositories.comment import CommentRepository
from app.models.user import User
from app.models.post import Post

router = APIRouter()


async def build_post_public(
    post: Post,
    current_user: Optional[User],
    db: AsyncSession
) -> PostPublic:
    """构建公开帖子响应"""
    like_repo = LikeRepository(db)
    
    # 检查当前用户是否已点赞
    is_liked = False
    if current_user:
        is_liked = await like_repo.has_liked(current_user.id, "post", post.id)
    
    return PostPublic(
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
    )


@router.get("")
async def get_posts(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    category: Optional[str] = Query(None, description="分类筛选"),
    user_id: Optional[int] = Query(None, description="用户ID筛选"),
    sort: str = Query("latest", description="排序方式: latest, popular"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取帖子列表
    
    - **page**: 页码
    - **page_size**: 每页数量
    - **category**: 分类筛选（可选）
    - **user_id**: 用户ID筛选（可选）
    - **sort**: 排序方式 (latest: 最新, popular: 热门)
    """
    post_repo = PostRepository(db)
    skip = (page - 1) * page_size
    
    # 根据不同条件获取帖子
    if user_id:
        posts = await post_repo.get_by_user(user_id, skip, page_size)
        total = await post_repo.count(user_id=user_id, is_published=True)
    elif category:
        posts = await post_repo.get_by_category(category, skip, page_size)
        total = await post_repo.count(category=category, is_published=True)
    elif sort == "popular":
        posts = await post_repo.get_popular(skip, page_size)
        total = await post_repo.count(is_published=True)
    else:  # latest
        # 获取最新帖子
        result = await db.execute(
            select(Post)
            .options(selectinload(Post.author))
            .where(Post.is_published == True)
            .order_by(desc(Post.created_at))
            .offset(skip)
            .limit(page_size)
        )
        posts = list(result.scalars().all())
        total = await post_repo.count(is_published=True)
    
    # 构建响应
    post_list = []
    for post in posts:
        # 确保 author 已加载
        if not post.author:
            result = await db.execute(
                select(Post)
                .options(selectinload(Post.author))
                .where(Post.id == post.id)
            )
            post = result.scalar_one()
        
        post_public = await build_post_public(post, current_user, db)
        post_list.append(post_public)
    
    paginated = PaginatedResponse.create(
        items=post_list,
        total=total,
        page=page,
        page_size=page_size,
    )
    
    return create_success_response(data=paginated)


@router.post("", response_model=PostPublic, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    创建帖子
    
    - **title**: 标题
    - **content**: 内容
    - **category**: 分类（可选）
    - **tags**: 标签列表（可选）
    - **is_published**: 是否发布（默认 true）
    """
    post_repo = PostRepository(db)
    
    # 创建帖子
    post = await post_repo.create({
        "user_id": current_user.id,
        "title": post_data.title,
        "content": post_data.content,
        "category": post_data.category,
        "tags": post_data.tags,
        "is_published": post_data.is_published,
    })
    
    await db.commit()
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.id == post.id)
    )
    post = result.scalar_one()
    
    # 创建向量索引（异步，不阻塞响应）
    if post.is_published:
        try:
            from app.services.search import get_vector_search_service
            vector_service = get_vector_search_service(db)
            await vector_service.index_post(post)
        except Exception as e:
            # 索引失败不影响帖子创建
            print(f"⚠️  向量索引失败 (ID: {post.id}): {e}")
    
    return await build_post_public(post, current_user, db)


@router.get("/search")
async def search_posts(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    category: Optional[str] = Query(None, description="分类筛选"),
    tags: Optional[str] = Query(None, description="标签筛选（逗号分隔）"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    搜索帖子
    
    - **q**: 搜索关键词（必需）
    - **category**: 分类筛选（可选）
    - **tags**: 标签筛选（可选，逗号分隔）
    - **page**: 页码
    - **page_size**: 每页数量
    """
    skip = (page - 1) * page_size
    
    # 构建查询
    query = (
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.is_published == True)
    )
    
    # 添加搜索条件
    query = query.where(
        or_(
            Post.title.ilike(f"%{q}%"),
            Post.content.ilike(f"%{q}%")
        )
    )
    
    # 添加分类筛选
    if category:
        query = query.where(Post.category == category)
    
    # 添加标签筛选
    if tags:
        tag_list = [tag.strip() for tag in tags.split(",")]
        for tag in tag_list:
            query = query.where(Post.tags.contains([tag]))
    
    # 按相关性排序（这里简单按创建时间排序）
    query = query.order_by(desc(Post.created_at))
    
    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # 分页
    query = query.offset(skip).limit(page_size)
    result = await db.execute(query)
    posts = result.scalars().all()
    
    # 转换为 PostPublic
    post_publics = []
    for post in posts:
        post_public = await build_post_public(post, current_user, db)
        post_publics.append(post_public)
    
    paginated = PaginatedResponse(
        items=post_publics,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )
    
    return create_success_response(data=paginated)


@router.get("/{post_id}", response_model=PostDetail)
async def get_post(
    post_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取帖子详情
    
    返回指定ID的帖子详细信息，并增加浏览数
    """
    post_repo = PostRepository(db)
    
    # 获取帖子
    post = await post_repo.get_with_author(post_id)
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 检查权限（未发布的帖子只有作者可以查看）
    if not post.is_published and (not current_user or current_user.id != post.user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 增加浏览数
    await post_repo.increment_view_count(post_id)
    await db.commit()
    
    # 重新获取更新后的数据
    post = await post_repo.get_with_author(post_id)
    
    return await build_post_public(post, current_user, db)


@router.put("/{post_id}", response_model=PostPublic)
async def update_post(
    post_id: int,
    post_update: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    更新帖子
    
    - **title**: 标题（可选）
    - **content**: 内容（可选）
    - **category**: 分类（可选）
    - **tags**: 标签列表（可选）
    - **is_published**: 是否发布（可选）
    """
    post_repo = PostRepository(db)
    
    # 获取帖子
    post = await post_repo.get_by_id(post_id)
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 检查权限
    if post.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限修改此帖子"
        )
    
    # 更新帖子
    update_data = post_update.model_dump(exclude_unset=True)
    updated_post = await post_repo.update(post_id, update_data)
    await db.commit()
    
    # 重新加载以获取关联数据
    result = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.id == post_id)
    )
    post = result.scalar_one()
    
    # 更新向量索引
    try:
        from app.services.search import get_vector_search_service
        vector_service = get_vector_search_service(db)
        
        if post.is_published:
            # 如果帖子已发布，更新索引
            await vector_service.update_post_index(post)
        else:
            # 如果帖子未发布，删除索引
            await vector_service.delete_post_index(post.id)
    except Exception as e:
        # 索引失败不影响帖子更新
        print(f"⚠️  向量索引更新失败 (ID: {post.id}): {e}")
    
    return await build_post_public(post, current_user, db)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    删除帖子
    
    只有帖子作者可以删除自己的帖子
    """
    post_repo = PostRepository(db)
    
    # 获取帖子
    post = await post_repo.get_by_id(post_id)
    
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 检查权限
    if post.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限删除此帖子"
        )
    
    # 删除帖子
    await post_repo.delete(post_id)
    await db.commit()
    
    # 删除向量索引
    try:
        from app.services.search import get_vector_search_service
        vector_service = get_vector_search_service(db)
        await vector_service.delete_post_index(post_id)
    except Exception as e:
        # 索引删除失败不影响帖子删除
        print(f"⚠️  向量索引删除失败 (ID: {post_id}): {e}")
    
    return None


@router.post("/{post_id}/like")
async def like_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    点赞帖子
    
    如果已点赞则取消点赞
    """
    post_repo = PostRepository(db)
    like_repo = LikeRepository(db)
    
    # 检查帖子是否存在
    post = await post_repo.get_by_id(post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 检查是否已点赞
    has_liked = await like_repo.has_liked(current_user.id, "post", post_id)
    
    if has_liked:
        # 取消点赞
        await like_repo.remove_like(current_user.id, "post", post_id)
        await post_repo.increment_like_count(post_id, -1)
        message = "取消点赞成功"
        is_liked = False
    else:
        # 添加点赞
        await like_repo.add_like(current_user.id, "post", post_id)
        await post_repo.increment_like_count(post_id, 1)
        message = "点赞成功"
        is_liked = True
    
    await db.commit()
    
    return {
        "message": message,
        "is_liked": is_liked,
    }


@router.delete("/{post_id}/like")
async def unlike_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    取消点赞帖子
    
    移除对指定帖子的点赞
    """
    post_repo = PostRepository(db)
    like_repo = LikeRepository(db)
    
    # 检查帖子是否存在
    post = await post_repo.get_by_id(post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 检查是否已点赞
    has_liked = await like_repo.has_liked(current_user.id, "post", post_id)
    
    if not has_liked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="尚未点赞该帖子"
        )
    
    # 取消点赞
    await like_repo.remove_like(current_user.id, "post", post_id)
    await post_repo.increment_like_count(post_id, -1)
    await db.commit()
    
    return {
        "message": "取消点赞成功",
        "is_liked": False,
    }


@router.get("/{post_id}/comments", response_model=List[CommentPublic])
async def get_post_comments(
    post_id: int,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取帖子的评论列表
    
    返回指定帖子的所有顶级评论
    """
    post_repo = PostRepository(db)
    comment_repo = CommentRepository(db)
    like_repo = LikeRepository(db)
    
    # 检查帖子是否存在
    post = await post_repo.get_by_id(post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 获取评论列表（只获取顶级评论）
    comments = await comment_repo.get_by_post(post_id, skip=0, limit=100)
    
    # 构建响应
    comment_list = []
    for comment in comments:
        # 检查当前用户是否已点赞
        is_liked = False
        if current_user:
            is_liked = await like_repo.has_liked(current_user.id, "comment", comment.id)
        
        comment_list.append(CommentPublic(
            id=comment.id,
            post_id=comment.post_id,
            user_id=comment.user_id,
            parent_id=comment.parent_id,
            content=comment.content,
            like_count=comment.like_count,
            created_at=comment.created_at,
            updated_at=comment.updated_at,
            author=comment.author,
            is_liked=is_liked,
            replies=[],
        ))
    
    return comment_list


@router.post("/{post_id}/comments", response_model=CommentPublic, status_code=status.HTTP_201_CREATED)
async def create_post_comment(
    post_id: int,
    comment_data: CommentCreateForPost,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    创建帖子评论
    
    为指定帖子添加新评论
    """
    post_repo = PostRepository(db)
    comment_repo = CommentRepository(db)
    
    # 检查帖子是否存在
    post = await post_repo.get_by_id(post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 创建评论
    comment = await comment_repo.create({
        "post_id": post_id,
        "user_id": current_user.id,
        "content": comment_data.content,
        "parent_id": comment_data.parent_id,
    })
    
    # 更新帖子评论数
    await post_repo.increment_comment_count(post_id, 1)
    await db.commit()
    
    # 重新加载以获取关联数据
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.comment import Comment
    
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.id == comment.id)
    )
    comment = result.scalar_one()
    
    return CommentPublic(
        id=comment.id,
        post_id=comment.post_id,
        user_id=comment.user_id,
        parent_id=comment.parent_id,
        content=comment.content,
        like_count=comment.like_count,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author=comment.author,
        is_liked=False,
        replies=[],
    )

