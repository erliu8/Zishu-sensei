"""
工作流服务层
提供工作流的创建、执行、调度等核心业务逻辑
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from uuid import uuid4
import asyncio
from enum import Enum
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from ...models.workflow import (
    Workflow,
    WorkflowNode,
    WorkflowEdge,
    WorkflowExecution,
    WorkflowTemplate,
    WorkflowStatus,
    ExecutionStatus,
    ExecutionMode,
    NodeType,
    TriggerType,
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowExecutionCreate,
)
from ...database.repositories.workflow_repository import (
    WorkflowRepository,
    WorkflowExecutionRepository,
)

logger = logging.getLogger(__name__)


class WorkflowService:
    """工作流服务"""

    def __init__(self):
        self.workflow_repo = WorkflowRepository()
        self.execution_repo = WorkflowExecutionRepository()

    # ================================
    # 工作流 CRUD 操作
    # ================================

    async def create_workflow(
        self,
        session: AsyncSession,
        user_id: str,
        workflow_data: WorkflowCreate,
    ) -> Workflow:
        """创建工作流"""
        # 检查 slug 是否已存在
        existing = await self.workflow_repo.get_by_slug(
            session, user_id, workflow_data.slug
        )
        if existing:
            raise ValueError(f"工作流标识符 '{workflow_data.slug}' 已存在")

        # 创建工作流
        workflow = Workflow(
            id=str(uuid4()),
            user_id=user_id,
            name=workflow_data.name,
            slug=workflow_data.slug,
            description=workflow_data.description,
            category=workflow_data.category,
            tags=workflow_data.tags,
            definition=workflow_data.definition,
            trigger_type=workflow_data.trigger_type,
            trigger_config=workflow_data.trigger_config,
            workflow_status=WorkflowStatus.DRAFT,
        )

        session.add(workflow)
        await session.commit()
        await session.refresh(workflow)

        return workflow

    async def get_workflow(
        self, session: AsyncSession, workflow_id: str
    ) -> Optional[Workflow]:
        """获取工作流"""
        return await self.workflow_repo.get_by_id(session, workflow_id)

    async def get_workflow_with_details(
        self, session: AsyncSession, workflow_id: str
    ) -> Optional[Workflow]:
        """获取工作流及其节点和连接"""
        return await self.workflow_repo.get_with_nodes(session, workflow_id)

    async def list_workflows(
        self,
        session: AsyncSession,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> List[Workflow]:
        """列出用户的工作流"""
        return await self.workflow_repo.get_user_workflows(
            session, user_id, skip, limit
        )

    async def update_workflow(
        self,
        session: AsyncSession,
        workflow_id: str,
        user_id: str,
        workflow_data: WorkflowUpdate,
    ) -> Workflow:
        """更新工作流"""
        workflow = await self.workflow_repo.get_by_id(session, workflow_id)
        if not workflow:
            raise ValueError(f"工作流不存在: {workflow_id}")

        if workflow.user_id != user_id:
            raise PermissionError("无权限修改此工作流")

        # 更新字段
        update_data = workflow_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(workflow, field, value)

        workflow.updated_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(workflow)

        return workflow

    async def delete_workflow(
        self, session: AsyncSession, workflow_id: str, user_id: str
    ) -> None:
        """删除工作流（软删除）"""
        workflow = await self.workflow_repo.get_by_id(session, workflow_id)
        if not workflow:
            raise ValueError(f"工作流不存在: {workflow_id}")

        if workflow.user_id != user_id:
            raise PermissionError("无权限删除此工作流")

        workflow.is_deleted = True
        workflow.workflow_status = WorkflowStatus.DELETED
        workflow.updated_at = datetime.now(timezone.utc)
        await session.commit()

    async def search_workflows(
        self,
        session: AsyncSession,
        user_id: str,
        keyword: Optional[str] = None,
        status: Optional[WorkflowStatus] = None,
        tags: Optional[List[str]] = None,
        category: Optional[str] = None,
    ) -> List[Workflow]:
        """搜索工作流"""
        query = (
            select(Workflow)
            .where(
                and_(
                    Workflow.user_id == user_id,
                    Workflow.is_deleted.is_(False),
                )
            )
        )

        if keyword:
            query = query.where(
                or_(
                    Workflow.name.ilike(f"%{keyword}%"),
                    Workflow.description.ilike(f"%{keyword}%"),
                )
            )

        if status:
            query = query.where(Workflow.workflow_status == status)

        if tags:
            query = query.where(Workflow.tags.overlap(tags))

        if category:
            query = query.where(Workflow.category == category)

        result = await session.execute(query)
        return list(result.scalars().all())

    # ================================
    # 工作流状态管理
    # ================================

    async def publish_workflow(
        self, session: AsyncSession, workflow_id: str, user_id: str
    ) -> Workflow:
        """发布工作流"""
        workflow = await self.get_workflow(session, workflow_id)
        if not workflow:
            raise ValueError(f"工作流不存在: {workflow_id}")

        if workflow.user_id != user_id:
            raise PermissionError("无权限发布此工作流")

        workflow.workflow_status = WorkflowStatus.ACTIVE
        workflow.updated_at = datetime.now(timezone.utc)
        await session.commit()

        return workflow

    async def archive_workflow(
        self, session: AsyncSession, workflow_id: str, user_id: str
    ) -> Workflow:
        """归档工作流"""
        workflow = await self.get_workflow(session, workflow_id)
        if not workflow:
            raise ValueError(f"工作流不存在: {workflow_id}")

        if workflow.user_id != user_id:
            raise PermissionError("无权限归档此工作流")

        workflow.workflow_status = WorkflowStatus.ARCHIVED
        workflow.updated_at = datetime.now(timezone.utc)
        await session.commit()

        return workflow

    async def clone_workflow(
        self,
        session: AsyncSession,
        workflow_id: str,
        user_id: str,
        new_name: str,
    ) -> Workflow:
        """克隆工作流"""
        original = await self.get_workflow_with_details(session, workflow_id)
        if not original:
            raise ValueError(f"工作流不存在: {workflow_id}")

        # 创建克隆
        cloned = Workflow(
            id=str(uuid4()),
            user_id=user_id,
            name=new_name,
            slug=f"{original.slug}-clone-{str(uuid4())[:8]}",
            description=original.description,
            category=original.category,
            tags=original.tags,
            definition=original.definition,
            trigger_type=original.trigger_type,
            trigger_config=original.trigger_config,
            workflow_status=WorkflowStatus.DRAFT,
            parent_workflow_id=original.id,
        )

        session.add(cloned)

        # 更新原工作流的克隆计数
        original.clone_count += 1

        await session.commit()
        await session.refresh(cloned)

        return cloned

    # ================================
    # 工作流执行
    # ================================

    async def execute_workflow(
        self,
        session: AsyncSession,
        workflow_id: str,
        user_id: str,
        input_data: Optional[Dict[str, Any]] = None,
        execution_mode: ExecutionMode = ExecutionMode.MANUAL,
    ) -> WorkflowExecution:
        """执行工作流"""
        workflow = await self.get_workflow_with_details(session, workflow_id)
        if not workflow:
            raise ValueError(f"工作流不存在: {workflow_id}")

        if workflow.workflow_status != WorkflowStatus.ACTIVE:
            raise ValueError(f"工作流未激活，无法执行")

        # 创建执行记录
        execution = WorkflowExecution(
            id=str(uuid4()),
            workflow_id=workflow_id,
            user_id=user_id,
            execution_mode=execution_mode,
            execution_status=ExecutionStatus.PENDING,
            input_data=input_data or {},
            started_at=datetime.now(timezone.utc),
        )

        session.add(execution)
        await session.commit()
        await session.refresh(execution)

        # 更新工作流执行统计
        workflow.execution_count += 1
        workflow.last_executed_at = execution.started_at

        # 异步执行工作流（在后台任务中）
        task = asyncio.create_task(
            self._execute_workflow_async_task(workflow_id=workflow.id, execution_id=execution.id)
        )

        def _log_task_exception(t: asyncio.Task) -> None:
            try:
                exc = t.exception()
            except asyncio.CancelledError:
                return
            except Exception:
                return
            if exc:
                logger.error(
                    f"Workflow async execution task failed for execution_id={execution.id}: {exc}",
                    exc_info=(type(exc), exc, exc.__traceback__),
                )

        task.add_done_callback(_log_task_exception)
        return execution

    async def _execute_workflow_async_task(self, workflow_id: str, execution_id: str) -> None:
        """
        异步执行工作流的任务入口。

        关键点：后台 task 必须使用独立的 AsyncSession，不能复用调用方 session，
        否则会出现并发 commit 导致 IllegalStateChangeError/transaction closed。
        """
        from ...database.connection import get_database_manager

        db_manager = await get_database_manager()
        async with db_manager.get_async_session() as session:
            workflow = await session.get(Workflow, workflow_id)
            execution = await session.get(WorkflowExecution, execution_id)

            if not workflow or not execution:
                logger.error(
                    f"Workflow async execution missing records: workflow_id={workflow_id}, execution_id={execution_id}"
                )
                return

            await self._execute_workflow_async(session, workflow, execution)

    async def _execute_workflow_async(
        self,
        session: AsyncSession,
        workflow: Workflow,
        execution: WorkflowExecution,
    ) -> None:
        """异步执行工作流的实际逻辑"""
        try:
            execution.execution_status = ExecutionStatus.RUNNING
            await session.commit()

            # 使用工作流引擎执行
            from ...workflow.engine import workflow_engine
            from ...api.dependencies import get_adapter_manager

            # 获取 adapter_manager 实例
            adapter_manager = get_adapter_manager()
            # 确保适配器管理器已初始化和启动
            if not adapter_manager.is_running:
                await adapter_manager.initialize()
                await adapter_manager.start()

            context = {
                "variables": workflow.environment_variables or {},
                "adapter_manager": adapter_manager,
                "user_id": execution.user_id,
                "adapter_start_policy": "auto",
                "interpolation_mode": "strict",
            }

            result = await workflow_engine.execute(workflow, execution, context)

            # 更新执行结果
            execution.execution_status = ExecutionStatus.COMPLETED
            execution.completed_at = datetime.now(timezone.utc)
            execution.duration_ms = int(
                (execution.completed_at - execution.started_at).total_seconds()
                * 1000
            )
            execution.output_data = result.get("output", {})
            execution.node_results = result.get("node_results", {})

            workflow.success_count += 1
            workflow.last_execution_status = "completed"

        except Exception as e:
            # 执行失败
            execution.execution_status = ExecutionStatus.FAILED
            execution.completed_at = datetime.now(timezone.utc)
            execution.error_message = str(e)
            execution.duration_ms = int(
                (execution.completed_at - execution.started_at).total_seconds()
                * 1000
            )

            workflow.failure_count += 1
            workflow.last_execution_status = "failed"

        finally:
            await session.commit()

    async def get_execution(
        self, session: AsyncSession, execution_id: str
    ) -> Optional[WorkflowExecution]:
        """获取执行记录"""
        return await self.execution_repo.get_by_id(session, execution_id)

    async def list_executions(
        self,
        session: AsyncSession,
        workflow_id: Optional[str] = None,
        user_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> List[WorkflowExecution]:
        """列出执行记录"""
        if workflow_id:
            return await self.execution_repo.get_workflow_executions(
                session, workflow_id, skip, limit
            )

        query = select(WorkflowExecution).where(
            WorkflowExecution.is_deleted.is_(False)
        )

        if user_id:
            query = query.where(WorkflowExecution.user_id == user_id)

        query = query.order_by(WorkflowExecution.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await session.execute(query)
        return list(result.scalars().all())

    async def cancel_execution(
        self, session: AsyncSession, execution_id: str, user_id: str
    ) -> WorkflowExecution:
        """取消执行"""
        execution = await self.get_execution(session, execution_id)
        if not execution:
            raise ValueError(f"执行记录不存在: {execution_id}")

        if execution.user_id != user_id:
            raise PermissionError("无权限取消此执行")

        if execution.execution_status not in [
            ExecutionStatus.PENDING,
            ExecutionStatus.RUNNING,
        ]:
            raise ValueError(f"无法取消状态为 {execution.execution_status} 的执行")

        execution.execution_status = ExecutionStatus.CANCELLED
        execution.completed_at = datetime.now(timezone.utc)
        if execution.started_at:
            execution.duration_ms = int(
                (execution.completed_at - execution.started_at).total_seconds()
                * 1000
            )

        await session.commit()
        await session.refresh(execution)

        return execution

    # ================================
    # 工作流模板
    # ================================

    async def list_templates(
        self, session: AsyncSession, limit: int = 20
    ) -> List[Workflow]:
        """列出工作流模板"""
        return await self.workflow_repo.get_templates(session, limit)

    async def create_from_template(
        self,
        session: AsyncSession,
        template_id: str,
        user_id: str,
        name: str,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> Workflow:
        """从模板创建工作流"""
        template = await self.get_workflow(session, template_id)
        if not template or not template.is_template:
            raise ValueError(f"模板不存在: {template_id}")

        # 应用参数到模板定义
        definition = template.definition.copy()
        if parameters:
            # TODO: 实现参数替换逻辑
            pass

        # 创建新工作流
        workflow = Workflow(
            id=str(uuid4()),
            user_id=user_id,
            name=name,
            slug=f"{template.slug}-{str(uuid4())[:8]}",
            description=template.description,
            category=template.category,
            tags=template.tags,
            definition=definition,
            trigger_type=template.trigger_type,
            trigger_config=template.trigger_config,
            workflow_status=WorkflowStatus.DRAFT,
            parent_workflow_id=template_id,
        )

        session.add(workflow)
        await session.commit()
        await session.refresh(workflow)

        return workflow


# 全局服务实例
workflow_service = WorkflowService()
