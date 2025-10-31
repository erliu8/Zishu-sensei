"""
角色相关 API 端点
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, and_, desc, asc, select, func
import uuid

from app.core.deps import get_db, get_current_user, get_optional_current_user
from app.core.response import create_response, ApiResponse
from app.models.user import User
from app.models.character import Character, CharacterStatus, CharacterVisibility
from app.schemas.character import (
    CharacterCreate,
    CharacterUpdate,
    CharacterResponse,
    CharacterListResponse,
    CharacterQueryParams,
)

router = APIRouter()


@router.get("/featured", response_model=ApiResponse[List[CharacterResponse]])
async def get_featured_characters(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """获取推荐角色（精选）"""
    try:
        # 构建查询：公开的、已发布的角色，按创建时间排序
        stmt = (
            select(Character)
            .where(
                and_(
                    Character.visibility == CharacterVisibility.PUBLIC,
                    Character.published == True,
                    Character.status == CharacterStatus.PUBLISHED
                )
            )
            .order_by(desc(Character.created_at))
            .limit(limit)
        )
        
        result = await db.execute(stmt)
        characters = result.scalars().all()
        
        # 转换为响应格式
        items = [CharacterResponse(**char.to_dict()) for char in characters]
        
        return create_response(data=items)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取推荐角色失败: {str(e)}"
        )


@router.get("/trending", response_model=ApiResponse[List[CharacterResponse]])
async def get_trending_characters(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """获取热门角色（基于浏览量、点赞等统计）"""
    try:
        # 构建查询：公开的、已发布的角色，按统计数据排序
        stmt = (
            select(Character)
            .where(
                and_(
                    Character.visibility == CharacterVisibility.PUBLIC,
                    Character.published == True,
                    Character.status == CharacterStatus.PUBLISHED
                )
            )
            .order_by(desc(Character.created_at))  # 暂时按创建时间排序，后续可以基于 stats 字段
            .limit(limit)
        )
        
        result = await db.execute(stmt)
        characters = result.scalars().all()
        
        # 转换为响应格式
        items = [CharacterResponse(**char.to_dict()) for char in characters]
        
        return create_response(data=items)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取热门角色失败: {str(e)}"
        )


@router.get("/", response_model=ApiResponse[CharacterListResponse])
async def get_characters(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    tags: Optional[List[str]] = Query(None),
    visibility: Optional[str] = Query(None),
    published: Optional[bool] = Query(None),
    creatorId: Optional[str] = Query(None),
    sortBy: str = Query("createdAt"),
    sortOrder: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """获取角色列表"""
    try:
        # 构建查询
        stmt = select(Character)
        
        # 搜索过滤
        if search:
            stmt = stmt.where(
                or_(
                    Character.name.ilike(f"%{search}%"),
                    Character.display_name.ilike(f"%{search}%"),
                    Character.description.ilike(f"%{search}%")
                )
            )
        
        # 标签过滤
        if tags:
            for tag in tags:
                stmt = stmt.where(Character.tags.contains([tag]))
        
        # 创建者过滤
        if creatorId:
            if creatorId == "me":
                if not current_user:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="需要登录才能查看我的角色"
                    )
                stmt = stmt.where(Character.creator_id == current_user.id)
            else:
                stmt = stmt.where(Character.creator_id == creatorId)
        
        # 如果不是查询特定创建者的角色，需要应用可见性和发布状态的筛选
        if not creatorId:
            # 未登录用户：只能看到公开且已发布的角色
            if not current_user:
                stmt = stmt.where(
                    Character.visibility == CharacterVisibility.PUBLIC,
                    Character.published == True,
                    Character.status == CharacterStatus.PUBLISHED
                )
            # 已登录用户：可以看到公开且已发布的角色，或者自己创建的所有角色
            else:
                stmt = stmt.where(
                    or_(
                        and_(
                            Character.visibility == CharacterVisibility.PUBLIC,
                            Character.published == True,
                            Character.status == CharacterStatus.PUBLISHED
                        ),
                        Character.creator_id == current_user.id
                    )
                )
        # 如果查询特定创建者的角色，可以根据 visibility 和 published 参数进一步筛选
        else:
            # 如果指定了可见性，进行筛选
            if visibility:
                stmt = stmt.where(Character.visibility == visibility)
            # 如果指定了发布状态，进行筛选
            if published is not None:
                stmt = stmt.where(Character.published == published)
        
        # 计算总数
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await db.execute(count_stmt)
        total = total_result.scalar() or 0
        
        # 排序
        sort_column = getattr(Character, sortBy, Character.created_at)
        if sortOrder == "desc":
            stmt = stmt.order_by(desc(sort_column))
        else:
            stmt = stmt.order_by(asc(sort_column))
        
        # 分页
        stmt = stmt.offset((page - 1) * pageSize).limit(pageSize)
        
        # 执行查询
        result = await db.execute(stmt)
        characters = result.scalars().all()
        
        # 转换为响应格式
        items = [CharacterResponse(**char.to_dict()) for char in characters]
        
        total_pages = (total + pageSize - 1) // pageSize
        
        response = CharacterListResponse(
            items=items,
            total=total,
            page=page,
            pageSize=pageSize,
            totalPages=total_pages
        )
        
        return create_response(data=response)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色列表失败: {str(e)}"
        )


@router.get("/{character_id}", response_model=ApiResponse[CharacterResponse])
async def get_character(
    character_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """获取单个角色详情"""
    try:
        stmt = select(Character).where(Character.id == character_id)
        result = await db.execute(stmt)
        character = result.scalar_one_or_none()
        
        if not character:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
        
        # 权限检查
        if character.visibility == CharacterVisibility.PRIVATE:
            if not current_user or current_user.id != character.creator_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="无权访问此角色"
                )
        
        # 增加浏览量
        if character.stats:
            character.stats["views"] = character.stats.get("views", 0) + 1
            await db.commit()
        
        return create_response(data=CharacterResponse(**character.to_dict()))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色详情失败: {str(e)}"
        )


@router.post("/", response_model=ApiResponse[CharacterResponse])
async def create_character(
    character_data: CharacterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """创建角色"""
    try:
        # 创建角色对象
        # PUBLIC 角色自动发布，其他角色默认为草稿
        is_public = character_data.visibility == CharacterVisibility.PUBLIC
        character = Character(
            name=character_data.name,
            display_name=character_data.displayName,
            description=character_data.description,
            avatar_url=character_data.avatarUrl,
            cover_url=character_data.coverUrl,
            tags=character_data.tags,
            visibility=character_data.visibility,
            version=character_data.version,
            adapters=character_data.adapters,
            config=character_data.config.dict() if character_data.config else None,
            status=CharacterStatus.PUBLISHED if is_public else CharacterStatus.DRAFT,
            published=is_public,
            creator_id=current_user.id,
            creator_name=current_user.username,
        )
        
        db.add(character)
        await db.commit()
        await db.refresh(character)
        
        return create_response(
            data=CharacterResponse(**character.to_dict()),
            message="角色创建成功"
        )
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建角色失败: {str(e)}"
        )


@router.patch("/{character_id}", response_model=ApiResponse[CharacterResponse])
async def update_character(
    character_id: int,
    character_data: CharacterUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """更新角色"""
    try:
        stmt = select(Character).where(Character.id == character_id)
        result = await db.execute(stmt)
        character = result.scalar_one_or_none()
        
        if not character:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
        
        # 权限检查
        if character.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改此角色"
            )
        
        # 更新字段
        update_data = character_data.dict(exclude_unset=True)
        
        # 特殊处理config字段
        if "config" in update_data and update_data["config"] is not None:
            update_data["config"] = update_data["config"].dict()
        
        for field, value in update_data.items():
            # 将驼峰命名转换为下划线命名
            snake_field = ''.join(['_' + c.lower() if c.isupper() else c for c in field]).lstrip('_')
            if hasattr(character, snake_field):
                setattr(character, snake_field, value)
        
        await db.commit()
        await db.refresh(character)
        
        return create_response(
            data=CharacterResponse(**character.to_dict()),
            message="角色更新成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新角色失败: {str(e)}"
        )


@router.delete("/{character_id}", response_model=ApiResponse[dict])
async def delete_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """删除角色"""
    try:
        stmt = select(Character).where(Character.id == character_id)
        result = await db.execute(stmt)
        character = result.scalar_one_or_none()
        
        if not character:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
        
        # 权限检查
        if character.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权删除此角色"
            )
        
        await db.delete(character)
        await db.commit()
        
        return create_response(
            data={"success": True},
            message="角色删除成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除角色失败: {str(e)}"
        )


@router.post("/{character_id}/clone", response_model=ApiResponse[CharacterResponse])
async def clone_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """克隆角色"""
    try:
        stmt = select(Character).where(Character.id == character_id)
        result = await db.execute(stmt)
        original = result.scalar_one_or_none()
        
        if not original:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
        
        # 权限检查：只能克隆公开的角色或自己的角色
        if original.visibility != CharacterVisibility.PUBLIC and original.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权克隆此角色"
            )
        
        # 创建克隆
        cloned = Character(
            name=f"{original.name} (副本)",
            display_name=f"{original.display_name or original.name} (副本)",
            description=original.description,
            avatar_url=original.avatar_url,
            cover_url=original.cover_url,
            tags=original.tags,
            visibility=CharacterVisibility.PRIVATE,
            version=original.version,
            adapters=original.adapters,
            config=original.config,
            personality=original.personality,
            expressions=original.expressions,
            voices=original.voices,
            models=original.models,
            status=CharacterStatus.DRAFT,
            published=False,
            creator_id=current_user.id,
            creator_name=current_user.username,
        )
        
        db.add(cloned)
        await db.commit()
        await db.refresh(cloned)
        
        return create_response(
            data=CharacterResponse(**cloned.to_dict()),
            message="角色克隆成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"克隆角色失败: {str(e)}"
        )


@router.post("/{character_id}/publish", response_model=ApiResponse[CharacterResponse])
async def publish_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """发布角色"""
    try:
        stmt = select(Character).where(Character.id == character_id)
        result = await db.execute(stmt)
        character = result.scalar_one_or_none()
        
        if not character:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
        
        # 权限检查
        if character.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权发布此角色"
            )
        
        character.published = True
        character.status = CharacterStatus.PUBLISHED
        
        await db.commit()
        await db.refresh(character)
        
        return create_response(
            data=CharacterResponse(**character.to_dict()),
            message="角色发布成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"发布角色失败: {str(e)}"
        )


@router.post("/{character_id}/unpublish", response_model=ApiResponse[CharacterResponse])
async def unpublish_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """取消发布角色（设为草稿）"""
    try:
        stmt = select(Character).where(Character.id == character_id)
        result = await db.execute(stmt)
        character = result.scalar_one_or_none()
        
        if not character:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
        
        # 权限检查
        if character.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改此角色"
            )
        
        character.published = False
        character.status = CharacterStatus.DRAFT
        
        await db.commit()
        await db.refresh(character)
        
        return create_response(
            data=CharacterResponse(**character.to_dict()),
            message="角色已设为草稿"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"取消发布失败: {str(e)}"
        )


@router.post("/{character_id}/archive", response_model=ApiResponse[CharacterResponse])
async def archive_character(
    character_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """归档角色"""
    try:
        stmt = select(Character).where(Character.id == character_id)
        result = await db.execute(stmt)
        character = result.scalar_one_or_none()
        
        if not character:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="角色不存在"
            )
        
        # 权限检查
        if character.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权归档此角色"
            )
        
        character.status = CharacterStatus.ARCHIVED
        
        await db.commit()
        await db.refresh(character)
        
        return create_response(
            data=CharacterResponse(**character.to_dict()),
            message="角色归档成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"归档角色失败: {str(e)}"
        )

