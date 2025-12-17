"""
工作流 API 路由
提供工作流管理的 RESTful API
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from ...database.connection import get_async_session as get_session
from ...models.workflow import (
    WorkflowCreate,
    WorkflowUpdate,
    WorkflowResponse,
    WorkflowExecutionCreate,
    WorkflowExecutionResponse,
    WorkflowStatus,
    ExecutionStatus,
    ExecutionMode,
)
from ..services.workflow_service import workflow_service
from ..dependencies import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/workflows", tags=["工作流"])


# ================================
# 请求/响应模型
# ================================


class WorkflowDetailResponse(WorkflowResponse):
    """工作流详细信息响应"""

    definition: Dict[str, Any]
    trigger_config: Optional[Dict[str, Any]] = None


class ExecuteWorkflowRequest(BaseModel):
    """执行工作流请求"""

    input_data: Optional[Dict[str, Any]] = Field(default=None, description="输入数据")
    execution_mode: ExecutionMode = Field(
        default=ExecutionMode.MANUAL, description="执行模式"
    )


class CloneWorkflowRequest(BaseModel):
    """克隆工作流请求"""

    new_name: str = Field(..., min_length=1, max_length=100, description="新工作流名称")


class CreateFromTemplateRequest(BaseModel):
    """从模板创建工作流请求"""

    name: str = Field(..., min_length=1, max_length=100, description="工作流名称")
    parameters: Optional[Dict[str, Any]] = Field(default=None, description="模板参数")


class WorkflowListResponse(BaseModel):
    """工作流列表响应"""

    total: int
    items: List[WorkflowResponse]


class ExecutionListResponse(BaseModel):
    """执行记录列表响应"""

    total: int
    items: List[WorkflowExecutionResponse]


# ================================
# 工作流 CRUD
# ================================


@router.post(
    "",
    response_model=WorkflowDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建工作流",
)
async def create_workflow(
    workflow_data: WorkflowCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    创建新的工作流

    - **name**: 工作流名称
    - **slug**: 唯一标识符（小写字母、数字、连字符）
    - **description**: 工作流描述
    - **definition**: 工作流定义（JSON）
    - **trigger_type**: 触发器类型
    """
    try:
        workflow = await workflow_service.create_workflow(
            session, current_user["id"], workflow_data
        )
        return workflow
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建工作流失败: {str(e)}",
        )


@router.get(
    "",
    response_model=List[WorkflowResponse],
    summary="获取工作流列表",
)
async def list_workflows(
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(20, ge=1, le=100, description="返回记录数"),
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    获取当前用户的工作流列表

    - 支持分页
    - 只返回未删除的工作流
    """
    workflows = await workflow_service.list_workflows(
        session, current_user["id"], skip, limit
    )
    return workflows


@router.get(
    "/{workflow_id}",
    response_model=WorkflowDetailResponse,
    summary="获取工作流详情",
)
async def get_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    获取指定工作流的详细信息

    - 包含工作流定义
    - 包含节点和连接信息
    """
    workflow = await workflow_service.get_workflow_with_details(session, workflow_id)
    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="工作流不存在"
        )

    if workflow.user_id != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问此工作流"
        )

    return workflow


@router.put(
    "/{workflow_id}",
    response_model=WorkflowDetailResponse,
    summary="更新工作流",
)
async def update_workflow(
    workflow_id: str,
    workflow_data: WorkflowUpdate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    更新工作流信息

    - 只能更新自己的工作流
    - 支持部分更新
    """
    try:
        workflow = await workflow_service.update_workflow(
            session, workflow_id, current_user["id"], workflow_data
        )
        return workflow
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"更新工作流失败: {str(e)}",
        )


@router.delete(
    "/{workflow_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除工作流",
)
async def delete_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    删除工作流（软删除）

    - 只能删除自己的工作流
    - 不会物理删除数据
    """
    try:
        await workflow_service.delete_workflow(
            session, workflow_id, current_user["id"]
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


# ================================
# 工作流搜索
# ================================


@router.get(
    "/search/query",
    response_model=List[WorkflowResponse],
    summary="搜索工作流",
)
async def search_workflows(
    keyword: Optional[str] = Query(None, description="关键词"),
    status: Optional[WorkflowStatus] = Query(None, description="状态"),
    category: Optional[str] = Query(None, description="分类"),
    tags: Optional[str] = Query(None, description="标签（逗号分隔）"),
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    搜索工作流

    - **keyword**: 在名称和描述中搜索
    - **status**: 按状态筛选
    - **category**: 按分类筛选
    - **tags**: 按标签筛选（逗号分隔多个标签）
    """
    tag_list = None
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    workflows = await workflow_service.search_workflows(
        session,
        current_user["id"],
        keyword=keyword,
        status=status,
        tags=tag_list,
        category=category,
    )
    return workflows


# ================================
# 工作流状态管理
# ================================


@router.post(
    "/{workflow_id}/publish",
    response_model=WorkflowResponse,
    summary="发布工作流",
)
async def publish_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    发布工作流

    - 将工作流状态设置为 ACTIVE
    - 只有激活的工作流才能执行
    """
    try:
        workflow = await workflow_service.publish_workflow(
            session, workflow_id, current_user["id"]
        )
        return workflow
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post(
    "/{workflow_id}/archive",
    response_model=WorkflowResponse,
    summary="归档工作流",
)
async def archive_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    归档工作流

    - 将工作流状态设置为 ARCHIVED
    - 归档的工作流不能执行
    """
    try:
        workflow = await workflow_service.archive_workflow(
            session, workflow_id, current_user["id"]
        )
        return workflow
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post(
    "/{workflow_id}/clone",
    response_model=WorkflowDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="克隆工作流",
)
async def clone_workflow(
    workflow_id: str,
    request: CloneWorkflowRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    克隆工作流

    - 创建工作流的副本
    - 新工作流状态为 DRAFT
    """
    try:
        workflow = await workflow_service.clone_workflow(
            session, workflow_id, current_user["id"], request.new_name
        )
        return workflow
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ================================
# 工作流执行
# ================================


@router.post(
    "/{workflow_id}/execute",
    response_model=WorkflowExecutionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="执行工作流",
)
async def execute_workflow(
    workflow_id: str,
    request: ExecuteWorkflowRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    执行工作流

    - 创建执行记录
    - 异步执行工作流
    - 返回执行ID用于查询状态
    """
    try:
        execution = await workflow_service.execute_workflow(
            session,
            workflow_id,
            current_user["id"],
            request.input_data,
            request.execution_mode,
        )
        return execution
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"执行工作流失败: {str(e)}",
        )


@router.get(
    "/{workflow_id}/executions",
    response_model=List[WorkflowExecutionResponse],
    summary="获取工作流执行历史",
)
async def list_workflow_executions(
    workflow_id: str,
    skip: int = Query(0, ge=0, description="跳过记录数"),
    limit: int = Query(20, ge=1, le=100, description="返回记录数"),
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    获取工作流的执行历史

    - 按创建时间倒序排列
    - 支持分页
    """
    executions = await workflow_service.list_executions(
        session, workflow_id=workflow_id, skip=skip, limit=limit
    )
    return executions


@router.get(
    "/executions/{execution_id}",
    response_model=WorkflowExecutionResponse,
    summary="获取执行详情",
)
async def get_execution(
    execution_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    获取执行记录详情

    - 包含执行状态
    - 包含输入输出数据
    - 包含错误信息（如有）
    """
    execution = await workflow_service.get_execution(session, execution_id)
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="执行记录不存在"
        )

    if execution.user_id != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="无权限访问此执行记录"
        )

    return execution


@router.post(
    "/executions/{execution_id}/cancel",
    response_model=WorkflowExecutionResponse,
    summary="取消执行",
)
async def cancel_execution(
    execution_id: str,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    取消正在执行的工作流

    - 只能取消 PENDING 或 RUNNING 状态的执行
    """
    try:
        execution = await workflow_service.cancel_execution(
            session, execution_id, current_user["id"]
        )
        return execution
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


# ================================
# 工作流模板
# ================================


@router.get(
    "/templates/list",
    response_model=List[WorkflowResponse],
    summary="获取工作流模板列表",
)
async def list_templates(
    limit: int = Query(20, ge=1, le=100, description="返回记录数"),
    session: AsyncSession = Depends(get_session),
):
    """
    获取公共工作流模板列表

    - 按克隆次数排序
    - 不需要认证
    """
    templates = await workflow_service.list_templates(session, limit)
    return templates


@router.post(
    "/templates/{template_id}/create",
    response_model=WorkflowDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="从模板创建工作流",
)
async def create_from_template(
    template_id: str,
    request: CreateFromTemplateRequest,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    从模板创建新工作流

    - 应用参数到模板
    - 创建为草稿状态
    """
    try:
        workflow = await workflow_service.create_from_template(
            session,
            template_id,
            current_user["id"],
            request.name,
            request.parameters,
        )
        return workflow
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
