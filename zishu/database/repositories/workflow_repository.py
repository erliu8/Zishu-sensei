"""
工作流数据访问层

提供工作流相关的数据库操作
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ...models.workflow import (
    Workflow,
    WorkflowExecution,
    WorkflowStatus,
    ExecutionStatus,
)
from ..base import BaseRepository


class WorkflowRepository(BaseRepository):
    """工作流仓储类"""

    def __init__(self):
        super().__init__(Workflow)

    async def get_by_slug(
        self, session: AsyncSession, user_id: str, slug: str
    ) -> Optional[Workflow]:
        """根据用户和slug获取工作流"""
        query = (
            self.query()
            .where(Workflow.user_id == user_id, Workflow.slug == slug)
            .filter_not_deleted()
        )
        result = await session.execute(query.build())
        return result.scalar_one_or_none()

    async def get_with_nodes(
        self, session: AsyncSession, workflow_id: str
    ) -> Optional[Workflow]:
        """获取工作流及其节点"""
        query = (
            select(Workflow)
            .where(Workflow.id == workflow_id, Workflow.is_deleted.is_(False))
            .options(selectinload(Workflow.nodes), selectinload(Workflow.edges))
        )
        result = await session.execute(query)
        return result.scalar_one_or_none()

    async def get_user_workflows(
        self,
        session: AsyncSession,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> List[Workflow]:
        """获取用户的工作流列表"""
        query = (
            self.query()
            .where(Workflow.user_id == user_id)
            .filter_not_deleted()
            .order_by(Workflow.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def get_templates(
        self, session: AsyncSession, limit: int = 20
    ) -> List[Workflow]:
        """获取工作流模板"""
        query = (
            self.query()
            .where(Workflow.is_template.is_(True))
            .filter_not_deleted()
            .order_by(Workflow.clone_count.desc())
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())


class WorkflowExecutionRepository(BaseRepository):
    """工作流执行仓储类"""

    def __init__(self):
        super().__init__(WorkflowExecution)

    async def get_workflow_executions(
        self,
        session: AsyncSession,
        workflow_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> List[WorkflowExecution]:
        """获取工作流的执行历史"""
        query = (
            self.query()
            .where(WorkflowExecution.workflow_id == workflow_id)
            .filter_not_deleted()
            .order_by(WorkflowExecution.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

    async def get_running_executions(
        self, session: AsyncSession, workflow_id: str
    ) -> List[WorkflowExecution]:
        """获取正在运行的执行"""
        query = (
            self.query()
            .where(
                WorkflowExecution.workflow_id == workflow_id,
                WorkflowExecution.execution_status == ExecutionStatus.RUNNING,
            )
            .filter_not_deleted()
        )
        result = await session.execute(query.build())
        return list(result.scalars().all())

