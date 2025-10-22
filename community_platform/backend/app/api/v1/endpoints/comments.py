"""
评论 API 端点
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.schemas.comment import CommentCreate, CommentUpdate, CommentPublic
from app.schemas.common import PaginatedResponse
from app.db.repositories.comment import CommentRepository
from app.db.repositories.post import PostRepository
from app.db.repositories.like import LikeRepository
from app.models.user import User
from app.models.comment import Comment

router = APIRouter()


async def build_comment_public(
    comment: Comment,
    current_user: Optional[User],
    db: AsyncSession,
    include_replies: bool = True
) -> CommentPublic:
    """构建公开评论响应"""
    like_repo = LikeRepository(db)
    comment_repo = CommentRepository(db)
    
    # 检查当前用户是否已点赞
    is_liked = False
    if current_user:
        is_liked = await like_repo.has_liked(current_user.id, "comment", comment.id)
    
    # 获取回复
    replies = []
    if include_replies:
        reply_list = await comment_repo.get_replies(comment.id, limit=10)
        for reply in reply_list:
            reply_public = await build_comment_public(reply, current_user, db, include_replies=False)
            replies.append(reply_public)
    
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
        is_liked=is_liked,
        replies=replies,
    )


@router.get("", response_model=PaginatedResponse[CommentPublic])
async def get_comments(
    post_id: int = Query(..., description="帖子ID"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取评论列表
    
    获取指定帖子的评论列表（只返回顶级评论，每个评论包含其回复）
    
    - **post_id**: 帖子ID（必需）
    - **page**: 页码
    - **page_size**: 每页数量
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
    
    # 获取评论列表
    skip = (page - 1) * page_size
    comments = await comment_repo.get_by_post(post_id, skip, page_size)
    total = await comment_repo.count(post_id=post_id, parent_id=None)
    
    # 构建响应
    comment_list = []
    for comment in comments:
        comment_public = await build_comment_public(comment, current_user, db)
        comment_list.append(comment_public)
    
    return PaginatedResponse.create(
        items=comment_list,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=CommentPublic, status_code=status.HTTP_201_CREATED)
async def create_comment(
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    创建评论
    
    - **post_id**: 帖子ID
    - **content**: 评论内容
    - **parent_id**: 父评论ID（可选，用于回复评论）
    """
    post_repo = PostRepository(db)
    comment_repo = CommentRepository(db)
    
    # 检查帖子是否存在
    post = await post_repo.get_by_id(comment_data.post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="帖子不存在"
        )
    
    # 如果是回复，检查父评论是否存在
    if comment_data.parent_id:
        parent_comment = await comment_repo.get_by_id(comment_data.parent_id)
        if not parent_comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="父评论不存在"
            )
        
        # 确保父评论属于同一个帖子
        if parent_comment.post_id != comment_data.post_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="父评论不属于该帖子"
            )
    
    # 创建评论
    comment = await comment_repo.create({
        "post_id": comment_data.post_id,
        "user_id": current_user.id,
        "parent_id": comment_data.parent_id,
        "content": comment_data.content,
    })
    
    # 增加帖子评论数
    await post_repo.increment_comment_count(comment_data.post_id, 1)
    
    await db.commit()
    
    # 重新加载以获取关联数据
    comment = await comment_repo.get_with_author(comment.id)
    
    return await build_comment_public(comment, current_user, db, include_replies=False)


@router.get("/{comment_id}", response_model=CommentPublic)
async def get_comment(
    comment_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取评论详情
    
    返回指定ID的评论详细信息及其回复
    """
    comment_repo = CommentRepository(db)
    
    # 获取评论
    comment = await comment_repo.get_with_author(comment_id)
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评论不存在"
        )
    
    return await build_comment_public(comment, current_user, db)


@router.put("/{comment_id}", response_model=CommentPublic)
async def update_comment(
    comment_id: int,
    comment_update: CommentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    更新评论
    
    只有评论作者可以更新自己的评论
    
    - **content**: 评论内容
    """
    comment_repo = CommentRepository(db)
    
    # 获取评论
    comment = await comment_repo.get_by_id(comment_id)
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评论不存在"
        )
    
    # 检查权限
    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限修改此评论"
        )
    
    # 更新评论
    update_data = comment_update.model_dump(exclude_unset=True)
    await comment_repo.update(comment_id, update_data)
    await db.commit()
    
    # 重新加载以获取关联数据
    comment = await comment_repo.get_with_author(comment_id)
    
    return await build_comment_public(comment, current_user, db, include_replies=False)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    删除评论
    
    只有评论作者可以删除自己的评论
    """
    comment_repo = CommentRepository(db)
    post_repo = PostRepository(db)
    
    # 获取评论
    comment = await comment_repo.get_by_id(comment_id)
    
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评论不存在"
        )
    
    # 检查权限
    if comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限删除此评论"
        )
    
    # 减少帖子评论数
    await post_repo.increment_comment_count(comment.post_id, -1)
    
    # 删除评论
    await comment_repo.delete(comment_id)
    await db.commit()
    
    return None


@router.post("/{comment_id}/like")
async def like_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    点赞评论
    
    如果已点赞则取消点赞
    """
    comment_repo = CommentRepository(db)
    like_repo = LikeRepository(db)
    
    # 检查评论是否存在
    comment = await comment_repo.get_by_id(comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="评论不存在"
        )
    
    # 检查是否已点赞
    has_liked = await like_repo.has_liked(current_user.id, "comment", comment_id)
    
    if has_liked:
        # 取消点赞
        await like_repo.remove_like(current_user.id, "comment", comment_id)
        await comment_repo.increment_like_count(comment_id, -1)
        message = "取消点赞成功"
        is_liked = False
    else:
        # 添加点赞
        await like_repo.add_like(current_user.id, "comment", comment_id)
        await comment_repo.increment_like_count(comment_id, 1)
        message = "点赞成功"
        is_liked = True
    
    await db.commit()
    
    return {
        "message": message,
        "is_liked": is_liked,
    }

