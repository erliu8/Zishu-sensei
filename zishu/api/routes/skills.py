"""
技能管理 API 路由
提供技能管理的 RESTful API
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
import uuid
import time

# Dependencies
from ..dependencies import get_current_user
from ..schemas.responses import ApiResponse, ResponseStatus

# Skills-specific imports
from ...skills.installer import SkillInstaller
from ...skills.schemas import SkillManifest
from ...database.repositories.skill_installation_repository import (
    SkillInstallationRepository
)

router = APIRouter(prefix="/skills", tags=["技能"])


@router.post("/install",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="安装技能包"
)
async def install_skill(
    manifest: SkillManifest,
    install_mode: Optional[str] = Query("strict", description="安装模式"),
    current_user: dict = Depends(get_current_user)
):
    start_time = time.time()

    # Get user_id from current_user
    user_id = current_user.get("id")  # User confirmed it's 'id' field

    # Validate install_mode
    if install_mode not in ["strict", "allow_with_approval"]:
        raise HTTPException(status_code=400, detail="Invalid install_mode")

    # Call SkillInstaller (no constructor parameters needed)
    installer = SkillInstaller()
    result = await installer.install(manifest, user_id, install_mode)

    # Always return 200 with success flag (user preference)
    return ApiResponse(
        success=result.status == "installed",
        status=ResponseStatus.SUCCESS if result.status == "installed" else ResponseStatus.ERROR,
        data=result.model_dump() if hasattr(result, 'model_dump') else result.__dict__,
        request_id=str(uuid.uuid4()),
        processing_time=time.time() - start_time,
        api_version="v1"
    )


@router.get("/installed",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="获取已安装的技能包列表"
)
async def list_installed_skills(
    skip: int = Query(0, ge=0, description="跳过的记录数"),
    limit: int = Query(20, ge=1, le=100, description="返回的记录数"),
    current_user: dict = Depends(get_current_user)
):
    start_time = time.time()

    user_id = current_user.get("id")  # User confirmed it's 'id' field
    installer = SkillInstaller()
    # Use installer's internal repository access or create a new one
    from ...database.repositories.skill_installation_repository import SkillInstallationRepository
    from ...database.connection import get_async_session
    async with get_async_session() as session:
        repo = SkillInstallationRepository()
        installations = await repo.list_installed(session, user_id, skip, limit)

    # Convert to response format using DatabaseBaseModel.to_dict()
    items = [inst.to_dict() for inst in installations]

    return ApiResponse(
        success=True,
        status=ResponseStatus.SUCCESS,
        data={
            "items": items,
            "total": len(items)  # v0 can be simple count
        },
        request_id=str(uuid.uuid4()),
        processing_time=time.time() - start_time,
        api_version="v1"
    )


@router.post("/{package_id}/uninstall",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="卸载技能包"
)
async def uninstall_skill(
    package_id: str,
    current_user: dict = Depends(get_current_user)
):
    start_time = time.time()

    user_id = current_user.get("id")  # User confirmed it's 'id' field

    installer = SkillInstaller()
    result = await installer.uninstall(package_id, user_id)

    # Always return 200 with success flag (user preference)
    return ApiResponse(
        success=result.status == "uninstalled",
        status=ResponseStatus.SUCCESS if result.status == "uninstalled" else ResponseStatus.ERROR,
        data=result.model_dump() if hasattr(result, 'model_dump') else result.__dict__,
        request_id=str(uuid.uuid4()),
        processing_time=time.time() - start_time,
        api_version="v1"
    )