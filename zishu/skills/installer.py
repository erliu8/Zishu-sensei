"""
技能包安装器

提供技能包的安装功能，包括：
- 依赖验证和自动启动
- 权限策略控制
- 工作流创建和发布
- 适配器注册和启动
- 完整的回滚机制
"""

import logging
import os
import re
import secrets
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Literal
from enum import Enum

from pydantic import BaseModel

from .schemas import SkillManifest
from ..database.repositories.skill_installation_repository import (
    SkillInstallationRepository,
    SkillInstallationStatus,
)
from ..database.connection import get_database_manager
from ..api.dependencies import get_adapter_manager
from ..api.services.workflow_service import workflow_service
from ..models.workflow import WorkflowCreate
from ..adapters.core.persistence import AdapterPersistenceService
from ..adapters.hard.workflow_adapter import WorkflowAdapter
from ..adapters.hard.logger_adapter import LoggerAdapter
from ..adapters.hard.mood_diary_store_adapter import MoodDiaryStoreAdapter
from ..adapters.core.types import AdapterConfiguration, AdapterType


# ========================
# User bootstrap (dev/test)
# ========================

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except Exception:
        return False


async def ensure_user_exists(session, user_id: str) -> None:
    """
    Ensure a referenced user exists to satisfy DB foreign keys.

    - Always ensures the built-in SYSTEM_USER_ID exists (if DB is enabled).
    - Optionally auto-creates arbitrary users for local testing when
      AUTO_CREATE_LOCAL_USERS=1 (used by test_mood_diary.py + X-User-ID override).
    """
    if not user_id or not _is_uuid(user_id):
        raise ValueError(f"Invalid user_id (expected UUID): {user_id!r}")

    from ..database.repositories.user_repository import UserRepository
    from ..models.user import User, UserRole, UserStatus

    repo = UserRepository()
    existing = await repo.get_by_id(session, user_id, include_deleted=True)
    if existing:
        return

    allow_auto_create = (os.getenv("AUTO_CREATE_LOCAL_USERS", "0") == "1") or (
        user_id == SYSTEM_USER_ID
    )
    if not allow_auto_create:
        raise RuntimeError(
            f"User {user_id} does not exist; create it first or set AUTO_CREATE_LOCAL_USERS=1 for local testing."
        )

    if user_id == SYSTEM_USER_ID:
        username = "system"
        email = "system@zishu.local"
        role = UserRole.ADMIN
    else:
        username = f"local_{user_id.replace('-', '')[:12]}"
        email = f"{username}@zishu.local"
        role = UserRole.USER

    salt = secrets.token_hex(16)[:32]
    # Password is irrelevant for local smoke tests; still store a non-empty hash.
    password_hash = secrets.token_hex(32)

    session.add(
        User(
            id=user_id,
            username=username,
            email=email,
            password_hash=password_hash,
            salt=salt,
            user_status=UserStatus.ACTIVE,
            user_role=role,
            is_verified=True,
        )
    )
    await session.flush()


# 结果数据结构
class InstallStatus(str, Enum):
    """安装状态枚举"""
    INSTALLED = "installed"
    FAILED = "failed"
    PENDING_APPROVAL = "pending_approval"
    INSTALLING = "installing"  # 用于幂等性检查


class InstallResult(BaseModel):
    """安装结果数据结构"""
    status: Literal["installed", "requires_approval", "failed"]
    package_id: str
    installation_id: Optional[str] = None
    workflow_id: Optional[str] = None
    adapter_id: Optional[str] = None
    missing_dependencies: List[str] = []
    required_permissions: Dict[str, List[str]] = {}
    error_message: Optional[str] = None


class UninstallResult(BaseModel):
    """卸载结果数据结构"""
    status: Literal["uninstalled", "not_found", "failed"]
    package_id: str
    workflow_id: Optional[str] = None
    adapter_id: Optional[str] = None
    error_message: Optional[str] = None


# ========================
# 公共工具函数
# ========================

def sanitize_identifier(value: str) -> str:
    """
    清理标识符，仅保留 [a-zA-Z0-9._-]，其他字符替换为下划线

    Args:
        value: 待清理的字符串

    Returns:
        str: 清理后的标识符

    Raises:
        ValueError: 当输入为空或清理后为空字符串时
    """
    if not value:
        raise ValueError("Identifier cannot be empty")

    # 替换非法字符为下划线
    sanitized = re.sub(r'[^a-zA-Z0-9._-]', '_', str(value))

    if not sanitized:
        raise ValueError("Identifier cannot be empty after sanitization")

    return sanitized


def build_workflow_adapter_id(manifest: SkillManifest) -> str:
    """
    构建工作流适配器ID

    Args:
        manifest: 技能包清单

    Returns:
        str: 适配器ID

    Raises:
        ValueError: 当指定的 adapter_id 非法时
    """
    if manifest.workflow_adapter.adapter_id:
        # 如果 manifest 指定了 adapter_id，验证其合法性
        custom_id = manifest.workflow_adapter.adapter_id
        try:
            return sanitize_identifier(custom_id)
        except ValueError as e:
            raise ValueError(f"Invalid custom adapter_id '{custom_id}': {e}")
    else:
        # 生成标准格式的 adapter_id
        return f"tool.workflow.{sanitize_identifier(manifest.package_id)}"


def log_context(
    package_id: Optional[str] = None,
    workflow_id: Optional[str] = None,
    adapter_id: Optional[str] = None,
    installation_id: Optional[str] = None
) -> str:
    """
    生成统一的日志上下文字符串

    Args:
        package_id: 包ID
        workflow_id: 工作流ID
        adapter_id: 适配器ID
        installation_id: 安装ID

    Returns:
        str: 格式化的上下文字符串
    """
    return f"[pkg={package_id or '-'} wf={workflow_id or '-'} adp={adapter_id or '-'} inst={installation_id or '-'}]"


async def cleanup_adapter(adapter_manager, adapter_id: str) -> None:
    """
    清理适配器：停止并注销适配器，忽略错误

    Args:
        adapter_manager: 适配器管理器
        adapter_id: 适配器ID
    """
    logger = logging.getLogger(__name__)

    # 停止适配器
    try:
        await adapter_manager.stop_adapter(adapter_id)
        logger.info(f"{log_context(adapter_id=adapter_id)} Stopped adapter")
    except Exception as e:
        logger.warning(f"{log_context(adapter_id=adapter_id)} Failed to stop adapter: {e}")

    # 注销适配器
    try:
        await adapter_manager.unregister_adapter(adapter_id)
        logger.info(f"{log_context(adapter_id=adapter_id)} Unregistered adapter")
    except Exception as e:
        logger.warning(f"{log_context(adapter_id=adapter_id)} Failed to unregister adapter: {e}")


async def cleanup_persistence(adapter_id: str) -> None:
    """
    清理持久化配置，忽略错误

    Args:
        adapter_id: 适配器ID
    """
    logger = logging.getLogger(__name__)

    try:
        persistence_service = AdapterPersistenceService()
        await persistence_service.delete_adapter_config(adapter_id)
        logger.info(f"{log_context(adapter_id=adapter_id)} Deleted adapter config")
    except Exception as e:
        logger.warning(f"{log_context(adapter_id=adapter_id)} Failed to delete adapter config: {e}")


async def cleanup_workflow(session, workflow_id: str, user_id: str) -> None:
    """
    清理工作流，捕获异常并吞掉

    Args:
        session: 数据库会话
        workflow_id: 工作流ID
        user_id: 用户ID
    """
    logger = logging.getLogger(__name__)

    try:
        await workflow_service.delete_workflow(session, workflow_id, user_id)
        logger.info(f"{log_context(workflow_id=workflow_id)} Deleted workflow")
    except Exception as e:
        logger.error(f"{log_context(workflow_id=workflow_id)} Failed to delete workflow: {e}")
        # 吞掉异常，不让回滚流程中断


async def ensure_mood_diary_store(adapter_manager) -> None:
    """
    确保 tool.mood_diary.store 适配器已注册且可启动。
    """
    logger = logging.getLogger(__name__)
    adapter_id = "tool.mood_diary.store"
    
    def _preferred_mood_diary_base_path() -> str:
        """
        返回更稳妥的 base_path（尽量是绝对路径），避免依赖服务进程的 CWD。
        """

        base_path_value = "cache/mood_diary"

        try:
            repo_root = next(
                (
                    p
                    for p in [Path(__file__).resolve().parent, *Path(__file__).resolve().parents]
                    if (p / "pyproject.toml").exists()
                ),
                None,
            )
            if repo_root is None:
                return base_path_value

            cache_entry = repo_root / "cache"
            return str(cache_entry / "mood_diary")
        
        except Exception:
            return base_path_value

    try:
        registration = await adapter_manager.get_adapter(adapter_id)
    except Exception as e:
        logger.warning(f"{log_context(adapter_id=adapter_id)} Cannot check registry: {e}")
        return

    desired_base_path = _preferred_mood_diary_base_path()

    if registration and getattr(registration, "adapter_class", None) is not MoodDiaryStoreAdapter:
        logger.warning(
            f"{log_context(adapter_id=adapter_id)} Found mismatched adapter_class; re-registering built-in adapter"
        )
        try:
            await adapter_manager.stop_adapter(adapter_id)
        except Exception:
            pass
        try:
            await adapter_manager.unregister_adapter(adapter_id)
        except Exception:
            pass
        registration = None
    elif registration:
        try:
            current_base_path = None
            if getattr(registration, "configuration", None) is not None:
                current_base_path = (registration.configuration.config or {}).get("base_path")

            if current_base_path in (None, "", "cache/mood_diary", "/cache/mood_diary"):

                logger.warning(
                    f"{log_context(adapter_id=adapter_id)} base_path={current_base_path!r} is not portable; re-registering with base_path={desired_base_path!r}"
                )
                try:
                    await adapter_manager.stop_adapter(adapter_id)
                except Exception:
                    pass
                try:
                    await adapter_manager.unregister_adapter(adapter_id)
                except Exception:
                    pass
                registration = None
        except Exception:
            pass

    if not registration:
        config = AdapterConfiguration(
            identity=adapter_id,
            name="Mood Diary Store",
            version="1.0.0",
            adapter_type=AdapterType.HARD,
            adapter_class=MoodDiaryStoreAdapter,
            description="Built-in mood diary storage adapter (tool.mood_diary.store)",
            tags=["mood", "diary", "store"],
            config={
                "adapter_id": adapter_id,
                "name": "Mood Diary Store",
                "version": "1.0.0",
                "adapter_type": "hard",
                "base_path": desired_base_path,
                "kind": "store",
            },
        )
        try:
            await adapter_manager.register_adapter(config)
            logger.info(f"{log_context(adapter_id=adapter_id)} Registered built-in adapter")
        except Exception as e:
            logger.warning(f"{log_context(adapter_id=adapter_id)} Failed to register: {e}")

        # best-effort 持久化，便于后续可见/可管理
        try:
            await AdapterPersistenceService().save_adapter_config(config)
        except Exception as e:
            logger.warning(f"{log_context(adapter_id=adapter_id)} Failed to persist config: {e}")

    # best-effort 启动（如果已在运行则 start_adapter 会返回 True）
    try:
        await adapter_manager.start_adapter(adapter_id)
    except Exception as e:
        logger.warning(f"{log_context(adapter_id=adapter_id)} Failed to start: {e}")


async def ensure_system_logger(adapter_manager) -> None:
    """
    确保 system.logger 适配器已注册且可启动。

    说明：当前 AdapterRegistryService 不会自动从 adapter_configurations 表加载注册信息，
    因此需要在使用前确保内置依赖已注册。
    """
    logger = logging.getLogger(__name__)
    adapter_id = "system.logger"

    try:
        registration = await adapter_manager.get_adapter(adapter_id)
    except Exception as e:
        logger.warning(f"{log_context(adapter_id=adapter_id)} Cannot check registry: {e}")
        return

    if not registration:
        config = AdapterConfiguration(
            identity=adapter_id,
            name="System Logger",
            version="1.0.0",
            adapter_type=AdapterType.HARD,
            adapter_class=LoggerAdapter,
            description="Built-in logger adapter (system.logger)",
            tags=["system", "logger"],
            config={
                "adapter_id": adapter_id,
                "name": "System Logger",
                "version": "1.0.0",
                "adapter_type": "hard",
            },
        )
        try:
            await adapter_manager.register_adapter(config)
            logger.info(f"{log_context(adapter_id=adapter_id)} Registered built-in adapter")
        except Exception as e:
            logger.warning(f"{log_context(adapter_id=adapter_id)} Failed to register: {e}")

        # best-effort 持久化，便于后续可见/可管理
        try:
            await AdapterPersistenceService().save_adapter_config(config)
        except Exception as e:
            logger.warning(f"{log_context(adapter_id=adapter_id)} Failed to persist config: {e}")

    # best-effort 启动（如果已在运行则 start_adapter 会返回 True）
    try:
        await adapter_manager.start_adapter(adapter_id)
    except Exception as e:
        logger.warning(f"{log_context(adapter_id=adapter_id)} Failed to start: {e}")


async def diagnose_adapter_start_failure(adapter_config: AdapterConfiguration) -> str:
    """
    尝试在不依赖 AdapterManager 的情况下复现适配器启动失败原因，返回可读的错误信息。

    用途：AdapterManager.start_adapter() 失败时通常只返回 False（错误记录在日志里），
    这里通过直接 new + initialize + start 把异常信息带回到上层，便于定位。
    """
    adapter = None
    try:
        adapter_class = adapter_config.adapter_class
        if not adapter_class:
            return "adapter_class is missing"

        adapter = adapter_class(adapter_config.config or {})

        if hasattr(adapter, "initialize"):
            await adapter.initialize()
        if hasattr(adapter, "start"):
            await adapter.start()

        return "manual start succeeded (AdapterManager returned False unexpectedly)"

    except Exception as e:
        return f"{type(e).__name__}: {e}"

    finally:
        if adapter is not None:
            try:
                if hasattr(adapter, "stop"):
                    await adapter.stop()
                if hasattr(adapter, "cleanup"):
                    await adapter.cleanup()
            except Exception:
                pass


class SkillInstaller:
    """技能包安装器"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    async def install(
        self,
        manifest: SkillManifest,
        user_id: str,
        install_mode: Literal["strict", "allow_with_approval"] = "strict"
    ) -> InstallResult:
        """
        安装技能包

        Args:
            manifest: 技能包清单
            user_id: 用户ID
            install_mode: 安装模式 ("strict" 或 "allow_with_approval")

        Returns:
            InstallResult: 安装结果
        """
        self.logger.info(
            f"{log_context(package_id=manifest.package_id)} "
            f"Starting installation of skill package {manifest.package_id} "
            f"version {manifest.version} for user {user_id}"
        )

        # 初始化组件
        adapter_manager = get_adapter_manager()
        if not adapter_manager.is_running:
            await adapter_manager.initialize()
            await adapter_manager.start()

        # 确保内置依赖已注册（例如 system.logger, tool.mood_diary.store）
        await ensure_system_logger(adapter_manager)
        await ensure_mood_diary_store(adapter_manager)

        db_manager = await get_database_manager()
        repo = SkillInstallationRepository()

        # 用于回滚的操作栈
        rollback_actions = []

        try:
            # 步骤1-2：资源准备和幂等性检查
            async with db_manager.get_async_session() as session:
                # Ensure user exists for FK constraints (dev/test bootstrap).
                await ensure_user_exists(session, user_id)

                # 检查现有安装
                existing = await repo.get_by_user_and_package(
                    session, user_id, manifest.package_id
                )

                if existing:
                    if existing.installation_status == SkillInstallationStatus.INSTALLING:
                        return InstallResult(
                            status="failed",
                            package_id=manifest.package_id,
                            error_message="Installation already in progress"
                        )
                    elif existing.installation_status == SkillInstallationStatus.INSTALLED:
                        if existing.package_version == manifest.version:
                            # 已安装且同版本：尽量确保适配器处于运行状态（best-effort）
                            try:
                                if existing.adapter_id and existing.adapter_id not in getattr(adapter_manager, "_adapters", {}):
                                    await adapter_manager.start_adapter(existing.adapter_id)
                            except Exception:
                                pass
                            return InstallResult(
                                status="installed",
                                package_id=manifest.package_id,
                                installation_id=str(existing.id),
                                workflow_id=existing.workflow_id,
                                adapter_id=existing.adapter_id
                            )

                # 预先生成 adapter_id（用于 installation 记录占位与幂等）
                try:
                    adapter_id = (
                        existing.adapter_id
                        if existing and getattr(existing, "adapter_id", None)
                        else build_workflow_adapter_id(manifest)
                    )
                except ValueError as e:
                    return InstallResult(
                        status="failed",
                        package_id=manifest.package_id,
                        error_message=f"Failed to generate adapter_id: {str(e)}",
                    )

                # 步骤3：创建或更新安装记录
                if existing:
                    # 更新现有记录
                    existing.package_version = manifest.version
                    existing.manifest = manifest.model_dump()
                    existing.installation_status = SkillInstallationStatus.INSTALLING
                    existing.error_message = None
                    if not getattr(existing, "adapter_id", None):
                        existing.adapter_id = adapter_id
                    installation = existing
                else:
                    # 创建新记录（暂时不设置 workflow_id 和 adapter_id）
                    from ..models.skill_installation import SkillInstallation
                    installation = SkillInstallation(
                        package_id=manifest.package_id,
                        user_id=user_id,
                        workflow_id=None,
                        adapter_id=adapter_id,
                        package_version=manifest.version,
                        manifest=manifest.model_dump(),
                        installation_status=SkillInstallationStatus.INSTALLING
                    )
                    session.add(installation)

                await session.flush()
                await session.refresh(installation)

                # 步骤4：依赖验证
                missing_deps = []
                for dep in manifest.dependencies:
                    adapter = await adapter_manager.get_adapter(dep.adapter_id)
                    if not adapter and dep.required:
                        missing_deps.append(dep.adapter_id)
                    elif adapter and dep.auto_start:
                        try:
                            await adapter_manager.start_adapter(dep.adapter_id)
                        except Exception as e:
                            self.logger.warning(
                                f"Failed to auto-start dependency {dep.adapter_id}: {e}"
                            )
                            if dep.required:
                                missing_deps.append(dep.adapter_id)

                if missing_deps:
                    await repo.mark_failed(
                        session, str(installation.id), user_id,
                        f"Missing required dependencies: {', '.join(missing_deps)}"
                    )
                    await session.commit()
                    return InstallResult(
                        status="failed",
                        package_id=manifest.package_id,
                        installation_id=str(installation.id),
                        missing_dependencies=missing_deps,
                        error_message=f"Missing required dependencies: {', '.join(missing_deps)}"
                    )

                # 步骤5：权限策略
                if install_mode == "strict":
                    # 保守策略：任何网络访问、文件系统访问（/tmp除外）都拒绝
                    if manifest.permissions.network_access:
                        await repo.mark_failed(
                            session, str(installation.id), user_id,
                            "Network access not allowed in strict mode"
                        )
                        await session.commit()
                        return InstallResult(
                            status="failed",
                            package_id=manifest.package_id,
                            installation_id=str(installation.id),
                            error_message="Network access not allowed in strict mode"
                        )

                    # 检查文件系统访问
                    for path in manifest.permissions.file_system_access:
                        # strict mode v0 policy:
                        # - allow "/tmp" (linux)
                        # - allow relative paths under "data/" (project-scoped persistence)
                        normalized = str(path).replace("\\", "/").lstrip("./")
                        if normalized.startswith("/tmp") or (
                            not normalized.startswith("/")

                            and (normalized == "cache" or normalized.startswith("cache/"))

                        ):
                            continue

                        await repo.mark_failed(
                            session, str(installation.id), user_id,
                            f"File system access to {path} not allowed in strict mode"
                        )
                        await session.commit()
                        return InstallResult(
                            status="failed",
                            package_id=manifest.package_id,
                            installation_id=str(installation.id),
                            error_message=f"File system access to {path} not allowed in strict mode"
                        )

                    # 检查数据库访问（仅允许白名单）
                    allowed_tables = {"workflows", "workflow_executions", "users", "skill_installations"}
                    for table in manifest.permissions.database_access:
                        if table not in allowed_tables:
                            await repo.mark_failed(
                                session, str(installation.id), user_id,
                                f"Database access to {table} not allowed in strict mode"
                            )
                            await session.commit()
                            return InstallResult(
                                status="failed",
                                package_id=manifest.package_id,
                                installation_id=str(installation.id),
                                error_message=f"Database access to {table} not allowed in strict mode"
                            )

                else:  # allow_with_approval mode
                    # 检查是否需要审批的权限
                    requires_approval = False
                    required_permissions = {
                        "network_access": [],
                        "file_system_access": [],
                        "database_access": []
                    }

                    # 网络访问需要审批
                    if manifest.permissions.network_access:
                        requires_approval = True
                        required_permissions["network_access"] = manifest.permissions.network_access

                    # 文件系统访问（/tmp除外）需要审批
                    for path in manifest.permissions.file_system_access:
                        if not path.startswith("/tmp"):
                            requires_approval = True
                            required_permissions["file_system_access"].append(path)

                    # 数据库访问（白名单之外）需要审批
                    allowed_tables = {"workflows", "workflow_executions", "users", "skill_installations"}
                    for table in manifest.permissions.database_access:
                        if table not in allowed_tables:
                            requires_approval = True
                            required_permissions["database_access"].append(table)

                    if requires_approval:
                        # 更新为待审批状态
                        installation.installation_status = SkillInstallationStatus.PENDING_APPROVAL
                        await session.commit()

                        return InstallResult(
                            status="requires_approval",
                            package_id=manifest.package_id,
                            installation_id=str(installation.id),
                            required_permissions=required_permissions,
                            error_message="Installation requires approval due to requested permissions"
                        )

                # 步骤6：创建和发布工作流
                try:
                    workflow_data = WorkflowCreate(
                        slug=manifest.workflow.slug,
                        name=manifest.workflow.name,
                        description=manifest.workflow.description,
                        definition=manifest.workflow.definition,
                        trigger_type=manifest.workflow.trigger_type,
                        trigger_config=manifest.workflow.trigger_config,
                        category="skill",
                        tags=[f"skill:{manifest.package_id}"] + manifest.tags
                    )

                    workflow = await workflow_service.create_workflow(
                        session, user_id, workflow_data
                    )

                    # 添加到回滚栈
                    rollback_actions.append(
                        ("delete_workflow", workflow.id, user_id)
                    )

                    await workflow_service.publish_workflow(
                        session, workflow.id, user_id
                    )

                    self.logger.info(
                        f"{log_context(package_id=manifest.package_id, workflow_id=str(workflow.id))} "
                        f"Created and published workflow"
                    )

                except Exception as e:
                    error_msg = str(e)
                    if "slug" in error_msg and "already exists" in error_msg:
                        error_msg = f"Workflow slug '{manifest.workflow.slug}' already exists"

                    await repo.mark_failed(
                        session, str(installation.id), user_id,
                        f"Failed to create workflow: {error_msg}"
                    )
                    await session.commit()
                    return InstallResult(
                        status="failed",
                        package_id=manifest.package_id,
                        installation_id=str(installation.id),
                        adapter_id=adapter_id,
                        error_message=f"Failed to create workflow: {error_msg}"
                    )

                # 步骤7：注册和启动 WorkflowAdapter
                # workflow_id 已生成，先写回 installation（即使后续失败也便于排查/回滚）
                installation.workflow_id = str(workflow.id)
                await session.flush()

                # 构造适配器配置
                adapter_config = AdapterConfiguration(
                    identity=adapter_id,
                    name=manifest.workflow_adapter.name,
                    version=manifest.version,
                    adapter_type=AdapterType.HARD,
                    adapter_class=WorkflowAdapter,
                    description=f"Workflow adapter for skill {manifest.package_id}",
                    author=manifest.author,
                    tags=list(set(manifest.tags) | {"skill", "workflow"}),
                    # v0: do not rely on AdapterManager dependency start chain for workflow adapters;
                    # dependencies are ensured/started explicitly (e.g. system.logger, tool.mood_diary.store).
                    dependencies=set(),
                    config={
                        **manifest.workflow_adapter.config,
                        "workflow_id": str(workflow.id),
                        "adapter_id": adapter_id,
                        "adapter_type": "hard",
                        "kind": "workflow",
                        "run_mode": "async"
                    }
                )

                try:
                    # 注册适配器
                    registered = await adapter_manager.register_adapter(adapter_config)
                    if not registered:
                        raise RuntimeError("Adapter registration returned False")

                    # 添加到回滚栈
                    rollback_actions.append(
                        ("unregister_adapter", adapter_id)
                    )

                    # 启动适配器
                    started = await adapter_manager.start_adapter(adapter_id)
                    if not started:
                        diag = await diagnose_adapter_start_failure(adapter_config)
                        raise RuntimeError(f"Adapter start returned False: {diag}")

                    # 添加到回滚栈
                    rollback_actions.append(
                        ("stop_adapter", adapter_id)
                    )

                    self.logger.info(
                        f"{log_context(package_id=manifest.package_id, adapter_id=adapter_id)} "
                        f"Registered and started adapter"
                    )

                except Exception as e:
                    await repo.mark_failed(
                        session, str(installation.id), user_id,
                        f"Failed to register adapter: {str(e)}"
                    )
                    await session.commit()
                    return InstallResult(
                        status="failed",
                        package_id=manifest.package_id,
                        installation_id=str(installation.id),
                        workflow_id=str(workflow.id),
                        adapter_id=adapter_id,
                        error_message=f"Failed to register adapter: {str(e)}"
                    )

                # 步骤8：持久化配置并完成安装
                try:
                    # 持久化适配器配置
                    persistence_service = AdapterPersistenceService()
                    saved = await persistence_service.save_adapter_config(adapter_config)
                    if not saved:
                        raise RuntimeError("Adapter config persistence returned False")

                    # 更新安装记录
                    installation.workflow_id = str(workflow.id)
                    installation.adapter_id = adapter_id
                    installation.installation_status = SkillInstallationStatus.INSTALLED
                    installation.installed_at = datetime.now(timezone.utc)

                    await session.commit()

                    self.logger.info(
                        f"{log_context(package_id=manifest.package_id, workflow_id=str(workflow.id), adapter_id=adapter_id, installation_id=str(installation.id))} "
                        f"Successfully installed skill"
                    )

                    return InstallResult(
                        status="installed",
                        package_id=manifest.package_id,
                        installation_id=str(installation.id),
                        workflow_id=str(workflow.id),
                        adapter_id=adapter_id
                    )

                except Exception as e:
                    await repo.mark_failed(
                        session, str(installation.id), user_id,
                        f"Failed to persist configuration: {str(e)}"
                    )
                    await session.commit()
                    return InstallResult(
                        status="failed",
                        package_id=manifest.package_id,
                        installation_id=str(installation.id),
                        workflow_id=str(workflow.id),
                        adapter_id=adapter_id,
                        error_message=f"Failed to persist configuration: {str(e)}"
                    )

        except Exception as e:
            self.logger.error(
                f"{log_context(package_id=manifest.package_id)} "
                f"Unexpected error during installation: {e}",
                exc_info=True
            )

            # 尝试回滚
            await self._rollback(adapter_manager, rollback_actions)

            # 标记失败（如果会话仍然活跃）
            try:
                if (
                    "session" in locals()
                    and "installation" in locals()
                    and getattr(installation, "id", None)
                ):
                    await repo.mark_failed(
                        session, str(installation.id), user_id,
                        f"Installation failed: {str(e)}"
                    )
                    await session.commit()
            except:
                pass

            return InstallResult(
                status="failed",
                package_id=manifest.package_id,
                error_message=f"Installation failed: {str(e)}"
            )

    async def _rollback(self, adapter_manager, rollback_actions: List[tuple]) -> None:
        """执行回滚操作"""
        self.logger.info(f"{log_context()} Executing rollback with {len(rollback_actions)} actions")

        # 反向执行回滚操作
        for action in reversed(rollback_actions):
            try:
                action_type = action[0]

                if action_type == "stop_adapter":
                    adapter_id = action[1]
                    await cleanup_adapter(adapter_manager, adapter_id)

                elif action_type == "unregister_adapter":
                    adapter_id = action[1]
                    # 清理适配器（包含注销和持久化配置删除）
                    await cleanup_adapter(adapter_manager, adapter_id)
                    await cleanup_persistence(adapter_id)

                elif action_type == "delete_workflow":
                    workflow_id = action[1]
                    user_id = action[2]

                    # 需要数据库会话
                    db_manager = await get_database_manager()
                    async with db_manager.get_async_session() as session:
                        await cleanup_workflow(session, workflow_id, user_id)

            except Exception as e:
                self.logger.error(f"{log_context()} Rollback action {action_type} failed: {e}")

        self.logger.info(f"{log_context()} Rollback completed")

    async def uninstall(self, package_id: str, user_id: str) -> UninstallResult:
        """
        卸载技能包

        Args:
            package_id: 技能包ID
            user_id: 用户ID

        Returns:
            UninstallResult: 卸载结果
        """
        self.logger.info(
            f"{log_context(package_id=package_id)} "
            f"Starting uninstallation of skill package for user {user_id}"
        )

        # 准备资源
        adapter_manager = get_adapter_manager()
        if not adapter_manager.is_running:
            await adapter_manager.initialize()
            await adapter_manager.start()

        db_manager = await get_database_manager()
        repo = SkillInstallationRepository()

        async with db_manager.get_async_session() as session:
            try:
                # 查安装记录（必须属于 user 且必须 installed）
                installation = await repo.get_by_user_and_package(
                    session, user_id, package_id
                )

                if not installation:
                    return UninstallResult(
                        status="not_found",
                        package_id=package_id,
                        error_message=f"Skill package {package_id} not found"
                    )

                if installation.installation_status != SkillInstallationStatus.INSTALLED:
                    return UninstallResult(
                        status="failed",
                        package_id=package_id,
                        error_message=f"Cannot uninstall skill package with status: {installation.installation_status}"
                    )

                # 取出 workflow_id、adapter_id
                workflow_id = installation.workflow_id
                adapter_id = installation.adapter_id

                if not workflow_id or not adapter_id:
                    return UninstallResult(
                        status="failed",
                        package_id=package_id,
                        error_message="Installation record is missing workflow_id or adapter_id"
                    )

                # 清理适配器（停止、注销、删除持久化配置）
                await cleanup_adapter(adapter_manager, adapter_id)
                await cleanup_persistence(adapter_id)

                # 软删 workflow
                try:
                    await workflow_service.delete_workflow(
                        session, workflow_id, user_id
                    )
                    self.logger.info(f"{log_context(package_id=package_id, workflow_id=workflow_id)} Deleted workflow")
                except Exception as e:
                    # workflow 删除失败需要标记安装记录为失败
                    await session.rollback()
                    await repo.mark_failed(
                        session, str(installation.id), user_id,
                        f"Failed to delete workflow: {str(e)}"
                    )
                    await session.commit()
                    return UninstallResult(
                        status="failed",
                        package_id=package_id,
                        workflow_id=workflow_id,
                        adapter_id=adapter_id,
                        error_message=f"Failed to delete workflow: {str(e)}"
                    )

                # 标记为 uninstalled
                await repo.mark_uninstalled(
                    session, str(installation.id), user_id
                )
                await session.commit()

                self.logger.info(
                    f"{log_context(package_id=package_id, workflow_id=workflow_id, adapter_id=adapter_id)} "
                    f"Successfully uninstalled skill"
                )

                return UninstallResult(
                    status="uninstalled",
                    package_id=package_id,
                    workflow_id=workflow_id,
                    adapter_id=adapter_id
                )

            except Exception as e:
                self.logger.error(
                    f"{log_context(package_id=package_id)} "
                    f"Unexpected error during uninstallation: {e}",
                    exc_info=True
                )
                await session.rollback()
                return UninstallResult(
                    status="failed",
                    package_id=package_id,
                    error_message=f"Uninstallation failed: {str(e)}"
                )
