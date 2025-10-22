"""
用户 API 端点
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_current_user
from app.schemas.user import UserPublic, UserSelf, UserUpdate, UserProfile, UserChangePassword
from app.schemas.common import PaginatedResponse
from app.db.repositories.user import UserRepository
from app.db.repositories.post import PostRepository
from app.db.repositories.follow import FollowRepository
from app.models.user import User
from app.services.auth import PasswordService

router = APIRouter()


@router.get("/me", response_model=UserSelf)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """
    获取当前登录用户信息
    
    返回当前登录用户的详细信息（包含 email）
    """
    return current_user


@router.put("/me", response_model=UserSelf)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    更新当前用户信息
    
    - **full_name**: 全名
    - **bio**: 个人简介
    - **avatar_url**: 头像 URL
    """
    user_repo = UserRepository(db)
    
    # 更新用户信息
    update_data = user_update.model_dump(exclude_unset=True)
    updated_user = await user_repo.update(current_user.id, update_data)
    
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    await db.commit()
    return updated_user


@router.post("/me/change-password")
async def change_password(
    password_data: UserChangePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    修改密码
    
    - **old_password**: 旧密码
    - **new_password**: 新密码
    """
    # 验证旧密码
    if not PasswordService.verify_password(password_data.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="旧密码不正确"
        )
    
    # 哈希新密码
    new_password_hash = PasswordService.hash_password(password_data.new_password)
    
    # 更新密码
    user_repo = UserRepository(db)
    await user_repo.update(current_user.id, {"password_hash": new_password_hash})
    await db.commit()
    
    return {"message": "密码修改成功"}


@router.get("/{user_id}", response_model=UserProfile)
async def get_user_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    获取用户详细资料
    
    包括用户基本信息、粉丝数、关注数、帖子数等
    """
    user_repo = UserRepository(db)
    follow_repo = FollowRepository(db)
    post_repo = PostRepository(db)
    
    # 获取用户信息
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 获取统计信息
    follower_count = await follow_repo.get_follower_count(user_id)
    following_count = await follow_repo.get_following_count(user_id)
    post_count = await post_repo.count(user_id=user_id, is_published=True)
    
    # 检查当前用户是否已关注该用户
    is_following = False
    if current_user.id != user_id:
        is_following = await follow_repo.is_following(current_user.id, user_id)
    
    # 构建响应
    return UserProfile(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        is_verified=user.is_verified,
        created_at=user.created_at,
        follower_count=follower_count,
        following_count=following_count,
        post_count=post_count,
        is_following=is_following,
    )


@router.put("/{user_id}", response_model=UserSelf)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    更新指定用户信息（仅管理员或用户本人）
    
    允许用户更新自己的资料，或管理员更新任何用户的资料
    """
    # 检查权限：只能是用户本人
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限修改此用户信息"
        )
    
    user_repo = UserRepository(db)
    
    # 检查用户是否存在
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 准备更新数据
    update_data = user_update.model_dump(exclude_unset=True)
    
    # 检查用户名是否已被占用
    if "username" in update_data and update_data["username"] != user.username:
        existing_user = await user_repo.get_by_username(update_data["username"])
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="用户名已被占用"
            )
    
    # 检查邮箱是否已被占用
    if "email" in update_data and update_data["email"] != user.email:
        existing_user = await user_repo.get_by_email(update_data["email"])
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被占用"
            )
    
    # 更新用户信息
    await user_repo.update(user_id, update_data)
    await db.commit()
    await db.refresh(user)
    
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    删除指定用户（仅管理员或用户本人）
    
    删除用户账户及其相关数据
    """
    # 检查权限：只能是用户本人
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="没有权限删除此用户"
        )
    
    user_repo = UserRepository(db)
    
    # 检查用户是否存在
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 删除用户（这会级联删除相关数据）
    await user_repo.delete(user_id)
    await db.commit()
    
    return {"message": "用户删除成功"}


@router.post("/{user_id}/follow")
async def follow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    关注用户
    
    关注指定的用户
    """
    # 不能关注自己
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能关注自己"
        )
    
    # 检查用户是否存在
    user_repo = UserRepository(db)
    target_user = await user_repo.get_by_id(user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 检查是否已关注
    follow_repo = FollowRepository(db)
    if await follow_repo.is_following(current_user.id, user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="已经关注过该用户"
        )
    
    # 添加关注
    await follow_repo.follow(current_user.id, user_id)
    await db.commit()
    
    return {"message": "关注成功"}


@router.delete("/{user_id}/follow")
async def unfollow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    取消关注用户
    
    取消关注指定的用户
    """
    # 检查是否已关注
    follow_repo = FollowRepository(db)
    if not await follow_repo.is_following(current_user.id, user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未关注该用户"
        )
    
    # 取消关注
    await follow_repo.unfollow(current_user.id, user_id)
    await db.commit()
    
    return {"message": "取消关注成功"}


@router.get("/{user_id}/followers", response_model=List[UserPublic])
async def get_user_followers(
    user_id: int,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """
    获取用户粉丝列表
    
    返回关注该用户的用户列表
    """
    user_repo = UserRepository(db)
    follow_repo = FollowRepository(db)
    
    # 检查用户是否存在
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 获取粉丝 ID 列表
    follower_ids = await follow_repo.get_followers(user_id, skip, limit)
    
    # 获取粉丝详细信息
    followers = []
    for follower_id in follower_ids:
        follower = await user_repo.get_by_id(follower_id)
        if follower:
            followers.append(follower)
    
    return followers


@router.get("/{user_id}/following", response_model=List[UserPublic])
async def get_user_following(
    user_id: int,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """
    获取用户关注列表
    
    返回该用户关注的用户列表
    """
    user_repo = UserRepository(db)
    follow_repo = FollowRepository(db)
    
    # 检查用户是否存在
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 获取关注 ID 列表
    following_ids = await follow_repo.get_following(user_id, skip, limit)
    
    # 获取关注详细信息
    following = []
    for following_id in following_ids:
        user_following = await user_repo.get_by_id(following_id)
        if user_following:
            following.append(user_following)
    
    return following

