"""
技能管理 API 路由
提供技能管理的 RESTful API
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
import uuid
import time
import asyncio

# Dependencies
from ..dependencies import get_current_user, get_adapter_manager
from ..schemas.responses import ApiResponse, ResponseStatus

# Skills-specific imports
# NOTE: keep imports lightweight at module import time so route registration doesn't fail
# if optional heavy deps (e.g. SQLAlchemy) are missing or DB isn't configured.
from ...skills.schemas import SkillManifest
from ...adapters.base.adapter import ExecutionContext

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

    # Lazy import to avoid failing route registration when DB deps are missing
    from ...skills.installer import SkillInstaller
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
    from ...database.repositories.skill_installation_repository import SkillInstallationRepository
    from ...database.connection import get_async_session
    repo = SkillInstallationRepository()
    installations = []
    async for session in get_async_session():
        installations = await repo.list_installed(session, user_id, skip, limit)
        break

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

    from ...skills.installer import SkillInstaller
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


@router.post("/{package_id}/execute",
    response_model=ApiResponse,
    status_code=status.HTTP_200_OK,
    summary="执行技能"
)
async def execute_skill(
    package_id: str,
    payload: Dict[str, Any],  # Allow arbitrary JSON payload
    current_user: dict = Depends(get_current_user),
    adapter_manager = Depends(get_adapter_manager)  # Proper dependency injection
):
    """
    执行已安装的技能

    支持自动安装内置技能（package_id 以 skill.builtin. 开头）
    """
    start_time = time.time()

    # Get user_id from current_user
    user_id = current_user.get("id")

    # Ensure AdapterManager is running (lifespan may not have started it, or tests may call directly)
    if not adapter_manager.is_running:
        await adapter_manager.initialize()
        await adapter_manager.start()

    # Lazy imports to avoid failing route registration when DB deps are missing
    from ...skills.installer import SkillInstaller
    from ...skills.builtin.loader import load_builtin_manifest
    from ...database.repositories.skill_installation_repository import SkillInstallationRepository
    from ...adapters.core.types import AdapterConfiguration, AdapterType
    from ...adapters.hard.workflow_adapter import WorkflowAdapter

    # Ensure built-in dependency adapters exist (best-effort)
    from ...skills.installer import ensure_system_logger, ensure_mood_diary_store
    await ensure_system_logger(adapter_manager)
    await ensure_mood_diary_store(adapter_manager)

    from ...database.connection import get_async_session

    installation_repo = SkillInstallationRepository()
    installation = None
    # Session 1: check existing installation
    async for session in get_async_session():
        installation = await installation_repo.get_by_user_and_package(session, user_id, package_id)
        break

    # Auto-install builtin skill if not installed
    if not installation and package_id.startswith("skill.builtin."):
        try:
            manifest = await load_builtin_manifest(package_id)
            installer = SkillInstaller()
            install_result = await installer.install(manifest, user_id, "strict")
            if getattr(install_result, "status", None) != "installed":
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to install builtin skill {package_id}: {getattr(install_result, 'error_message', '')}".strip(),
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to install builtin skill {package_id}: {str(e)}",
            )

        # Session 2: re-fetch after install (avoid stale transaction snapshots)
        async for session in get_async_session():
            installation = await installation_repo.get_by_user_and_package(session, user_id, package_id)
            break

    # Return 404 if not installed and not builtin
    if not installation:
        raise HTTPException(
            status_code=404,
            detail=f"Skill {package_id} not found"
        )

    # Get adapter_id from installation
    adapter_id = installation.adapter_id

    # Ensure adapter is registered and running (important after server restart)
    if adapter_id not in getattr(adapter_manager, "_adapters", {}):
        registration = await adapter_manager.get_adapter_info(adapter_id)

        # If it's a workflow adapter but was restored/registered with the wrong class (e.g. ThirdPartyAPIAdapter),
        # force re-register with WorkflowAdapter.
        if registration and adapter_id.startswith("tool.workflow."):
            try:
                existing_cls = getattr(registration.configuration, "adapter_class", None)
                if existing_cls is not WorkflowAdapter:
                    try:
                        await adapter_manager.stop_adapter(adapter_id)
                    except Exception:
                        pass
                    await adapter_manager.unregister_adapter(adapter_id)
                    registration = None
            except Exception:
                # If inspection fails, fall back to re-registering.
                try:
                    await adapter_manager.stop_adapter(adapter_id)
                except Exception:
                    pass
                await adapter_manager.unregister_adapter(adapter_id)
                registration = None

        if not registration:
            # Re-register workflow adapter from stored manifest/workflow_id
            try:
                manifest_data = getattr(installation, "manifest", None) or {}
                manifest = SkillManifest.model_validate(manifest_data)
            except Exception:
                # Fallback: if manifest is missing/corrupt, reload builtin manifest if applicable
                if package_id.startswith("skill.builtin."):
                    manifest = await load_builtin_manifest(package_id)
                else:
                    raise HTTPException(status_code=500, detail=f"Skill {package_id} manifest missing or invalid")

            workflow_id = getattr(installation, "workflow_id", None)
            if not workflow_id:
                raise HTTPException(status_code=500, detail=f"Skill {package_id} installation missing workflow_id")

            adapter_config = AdapterConfiguration(
                identity=adapter_id,
                name=manifest.workflow_adapter.name,
                version=manifest.version,
                adapter_type=AdapterType.HARD,
                adapter_class=WorkflowAdapter,
                description=f"Workflow adapter for skill {manifest.package_id}",
                author=manifest.author,
                tags=list(set(manifest.tags) | {"skill", "workflow"}),
                # v0: do not rely on AdapterManager dependency start chain for workflow adapters.
                dependencies=set(),
                config={
                    **(manifest.workflow_adapter.config or {}),
                    "workflow_id": str(workflow_id),
                    "adapter_id": adapter_id,
                    "adapter_type": "hard",
                    "kind": "workflow",
                    "run_mode": "async",
                },
            )

            registered = await adapter_manager.register_adapter(adapter_config)
            if not registered:
                raise HTTPException(status_code=500, detail=f"Failed to register adapter {adapter_id}")

        started = await adapter_manager.start_adapter(adapter_id)
        if not started:
            # AdapterManager.start_adapter may swallow underlying exception and return False.
            # Provide a best-effort diagnostic message to help debug production issues.
            diag = None
            try:
                from ...skills.installer import diagnose_adapter_start_failure

                if registration and hasattr(registration, "configuration"):
                    diag = await diagnose_adapter_start_failure(registration.configuration)
                else:
                    # If we just built adapter_config above, use it; otherwise rehydrate from registry.
                    reg = await adapter_manager.get_adapter_info(adapter_id)
                    if reg and hasattr(reg, "configuration"):
                        diag = await diagnose_adapter_start_failure(reg.configuration)
            except Exception as e:
                diag = f"diagnose failed: {type(e).__name__}: {e}"

            raise HTTPException(
                status_code=500,
                detail=f"Adapter {adapter_id} failed to start"
                + (f" ({diag})" if diag else ""),
            )

    # Create ExecutionContext
    context = ExecutionContext(
        user_id=user_id,
        request_id=str(uuid.uuid4()),
        metadata={"package_id": package_id}
    )

    try:
        # Execute through adapter_manager
        result = await adapter_manager.process_with_adapter(
            adapter_id,
            payload,  # Pass payload directly
            context
        )

        # If this is a workflow submission, optionally wait for completion and return end output.
        workflow_output: Optional[Dict[str, Any]] = None
        workflow_execution_id: Optional[str] = None
        try:
            if isinstance(getattr(result, "output", None), dict):
                workflow_execution_id = result.output.get("workflow_execution_id")
        except Exception:
            workflow_execution_id = None

        wait_flag = payload.get("_wait", payload.get("wait"))
        if wait_flag is None:
            # v0: for builtin mood skills, wait for completion so review can return items immediately.
            wait_flag = package_id.startswith("skill.builtin.mood.")

        if workflow_execution_id and wait_flag:
            wait_timeout_s = payload.get("_wait_timeout_s", 5.0)
            poll_interval_s = payload.get("_poll_interval_s", 0.05)

            from ...database.connection import get_database_manager
            from ...api.services.workflow_service import workflow_service
            from ...models.workflow import ExecutionStatus

            db_manager = await get_database_manager()
            deadline = time.time() + float(wait_timeout_s)
            last_execution = None
            while time.time() < deadline:
                async with db_manager.get_async_session() as session:
                    last_execution = await workflow_service.get_execution(session, workflow_execution_id)
                if last_execution and getattr(last_execution, "execution_status", None) in (
                    ExecutionStatus.COMPLETED,
                    ExecutionStatus.FAILED,
                    ExecutionStatus.CANCELLED,
                    ExecutionStatus.TIMEOUT,
                ):
                    break
                await asyncio.sleep(float(poll_interval_s))

            if last_execution is not None:
                # output_data may legitimately be an empty dict (e.g. workflow failed before writing output)
                workflow_output = getattr(last_execution, "output_data", None)
            else:
                workflow_output = None

        # Default result shape is the adapter execution result; if workflow produced an explicit "result",
        # expose it at data.result for easier consumption (e.g. mood.review expects items/summary).
        exposed_result: Any = result.to_dict()
        workflow_execution_status: Optional[str] = None
        workflow_error_message: Optional[str] = None
        if isinstance(workflow_output, dict):
            exposed_result = workflow_output.get("result", workflow_output)
        if workflow_execution_id and wait_flag:
            try:
                if last_execution is not None:
                    status_value = getattr(last_execution, "execution_status", None)
                    workflow_execution_status = getattr(status_value, "value", None) or str(status_value)
                    workflow_error_message = getattr(last_execution, "error_message", None)
            except Exception:
                pass

        return ApiResponse(
            success=True,
            status=ResponseStatus.SUCCESS,
            data={
                "result": exposed_result,
                "execution": result.to_dict(),
                "workflow_execution_id": workflow_execution_id,
                "workflow_execution_status": workflow_execution_status,
                "workflow_error_message": workflow_error_message,
                "package_id": package_id,
                "adapter_id": adapter_id
            },
            request_id=str(uuid.uuid4()),
            processing_time=time.time() - start_time,
            api_version="v1"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute skill {package_id}: {str(e)}"
        )
