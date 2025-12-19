"""工作流适配器
提供工作流执行功能，支持：
- 工作流触发和执行
- 权限检查和访问控制
- 执行状态跟踪
- 异步执行支持
"""

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# 本地模块导入
from ..base.adapter import (
    BaseAdapter,
    ExecutionContext,
    ExecutionResult,
    HealthCheckResult,
)
from ..base.metadata import (
    AdapterMetadata,
    AdapterType,
    AdapterCapability,
    SecurityLevel,
    CapabilityCategory,
    AdapterPermissions,
    AdapterVersion,
)
from ..base.exceptions import (
    BaseAdapterException,
    AdapterConfigurationError,
    AdapterExecutionError,
    AdapterValidationError,
    AdapterLoadingError,
    ErrorCode,
    ExceptionSeverity,
)

# 延迟导入避免循环依赖
# from ...api.services.workflow_service import workflow_service
# from ...database.connection import DatabaseConnectionManager
# from ...models.workflow import WorkflowStatus, ExecutionMode


class WorkflowAdapter(BaseAdapter):
    """
    工作流适配器

    绑定到特定工作流，提供安全的工作流执行功能。
    每个适配器实例绑定到一个工作流，支持权限控制。
    """

    def __init__(self, config: Dict[str, Any]):
        """
        初始化工作流适配器

        Args:
            config: 适配器配置，必须包含：
                - adapter_id: 适配器ID（与identity保持一致）
                - workflow_id: 绑定的工作流ID
                - kind: "workflow"（特殊标识）
                - allow_other_users: 是否允许其他用户执行
                - allowed_users: 允许的用户ID列表
        """
        super().__init__(config)

        # 验证必需字段
        self._validate_workflow_config()

        # 提取配置
        self.workflow_id = self.config["workflow_id"]
        self.allow_other_users = self.config.get("allow_other_users", False)
        self.allowed_users = self.config.get("allowed_users", [])

        # 运行时变量
        self.workflow_service = None
        self.db_manager = None
        self.execution_stats = {
            "total_executions": 0,
            "successful_executions": 0,
            "failed_executions": 0,
            "permission_denied": 0,
        }

    def _validate_workflow_config(self) -> None:
        """验证工作流适配器配置"""
        required_fields = ["workflow_id"]

        for field in required_fields:
            if field not in self.config:
                raise AdapterConfigurationError(
                    f"Missing required configuration field: {field}",
                    adapter_id=self.adapter_id,
                    context={
                        "missing_field": field,
                        "config_keys": list(self.config.keys()),
                    },
                )

        # 验证 allowed_users 是列表
        allowed_users = self.config.get("allowed_users", [])
        if allowed_users and not isinstance(allowed_users, list):
            raise AdapterConfigurationError(
                "allowed_users must be a list",
                adapter_id=self.adapter_id
            )

    # ================================
    # BaseAdapter 抽象方法实现
    # ================================

    def _load_metadata(self) -> AdapterMetadata:
        """加载工作流适配器元数据"""
        return AdapterMetadata(
            adapter_id=self.adapter_id,
            name=self.name,
            description=f"工作流执行适配器，绑定到工作流: {self.workflow_id}",
            adapter_type=AdapterType.HARD,
            version=AdapterVersion(
                version=self.version,
                release_date=datetime.now(timezone.utc),
                changelog="Initial WorkflowAdapter implementation",
            ),
            author="Zishu System",
            tags={"workflow", "execution", "automation"},
            capabilities=self._get_capabilities_impl(),
            permissions=AdapterPermissions(
                security_level=SecurityLevel.RESTRICTED,
                database_access=["workflows", "workflow_executions"],
            ),
            custom_fields={
                "kind": self.config.get("kind", "workflow"),
                "workflow_id": self.workflow_id,
                "run_mode": self.config.get("run_mode", "async"),
                "allow_other_users": self.allow_other_users,
                "allowed_users": self.allowed_users,
            },
        )

    async def _initialize_impl(self) -> bool:
        """初始化工作流适配器"""
        try:
            # 延迟导入避免循环依赖
            from ...api.services.workflow_service import workflow_service
            from ...database.connection import get_database_manager

            # 初始化服务
            self.workflow_service = workflow_service
            self.db_manager = await get_database_manager()

            # 预加载工作流信息（验证存在性）
            async with self.db_manager.get_async_session() as session:
                workflow = await self.workflow_service.get_workflow(session, self.workflow_id)
                if not workflow:
                    raise AdapterLoadingError(
                        f"Workflow not found: {self.workflow_id}",
                        adapter_id=self.adapter_id
                    )

                # 缓存工作流基本信息
                self._cached_workflow = {
                    "id": workflow.id,
                    "user_id": workflow.user_id,
                    "name": workflow.name,
                    "status": workflow.workflow_status
                }

            self.logger.info(
                f"WorkflowAdapter {self.adapter_id} initialized successfully, "
                f"bound to workflow: {self.workflow_id}"
            )
            return True

        except Exception as e:
            self.logger.error(f"Failed to initialize WorkflowAdapter: {e}")
            if isinstance(e, BaseAdapterException):
                raise
            else:
                raise AdapterLoadingError(
                    f"WorkflowAdapter initialization failed: {str(e)}",
                    adapter_id=self.adapter_id,
                    cause=e
                )

    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """处理工作流执行请求"""
        # 验证用户ID
        if not context.user_id:
            raise AdapterValidationError(
                "User ID is required for workflow execution",
                adapter_id=self.adapter_id
            )

        # 获取数据库会话
        async with self.db_manager.get_async_session() as session:
            try:
                # 1. 检查权限
                if not await self._check_execution_permission(
                    session, context.user_id, context
                ):
                    self.execution_stats["permission_denied"] += 1
                    raise AdapterExecutionError(
                        "Permission denied: user not allowed to execute this workflow",
                        error_code=ErrorCode.PERMISSION_DENIED,
                        adapter_id=self.adapter_id,
                        context={
                            "workflow_id": self.workflow_id,
                            "user_id": context.user_id
                        }
                    )

                # 2. 验证工作流状态
                workflow = await self.workflow_service.get_workflow(session, self.workflow_id)
                if not workflow:
                    raise AdapterExecutionError(
                        f"Workflow not found: {self.workflow_id}",
                        adapter_id=self.adapter_id
                    )

                from ...models.workflow import WorkflowStatus
                if workflow.workflow_status != WorkflowStatus.ACTIVE:
                    raise AdapterExecutionError(
                        f"Workflow is not active, current status: {workflow.workflow_status.value}",
                        adapter_id=self.adapter_id,
                        context={
                            "workflow_id": self.workflow_id,
                            "current_status": workflow.workflow_status.value
                        }
                    )

                # 3. 执行工作流
                from ...models.workflow import ExecutionMode
                execution = await self.workflow_service.execute_workflow(
                    session=session,
                    workflow_id=self.workflow_id,
                    user_id=context.user_id,
                    input_data=input_data if isinstance(input_data, dict) else {},
                    execution_mode=ExecutionMode.MANUAL,
                )

                # 4. 更新统计
                self.execution_stats["total_executions"] += 1
                self.execution_stats["successful_executions"] += 1

                # 5. 返回执行结果
                return {
                    "kind": "workflow",
                    "workflow_id": self.workflow_id,
                    "workflow_execution_id": execution.id,
                    "status": "submitted",
                    "message": "Workflow execution started successfully"
                }

            except Exception as e:
                self.execution_stats["total_executions"] += 1
                self.execution_stats["failed_executions"] += 1

                if isinstance(e, BaseAdapterException):
                    raise

                raise AdapterExecutionError(
                    f"Workflow execution failed: {str(e)}",
                    adapter_id=self.adapter_id,
                    cause=e,
                    context={
                        "workflow_id": self.workflow_id,
                        "user_id": context.user_id
                    }
                )

    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        """获取适配器能力列表"""
        return [
            AdapterCapability(
                name="execute_workflow",
                description="执行绑定的指定工作流",
                category=CapabilityCategory.CUSTOM,
                input_schema={
                    "type": "object",
                    "description": "传递给工作流的输入数据（JSON对象）",
                },
                output_schema={
                    "type": "object",
                    "description": "包含 workflow_execution_id 等字段的结果对象",
                },
            )
        ]

    async def _health_check_impl(self) -> HealthCheckResult:
        """执行健康检查"""
        checks = {}
        issues = []

        # 检查工作流服务
        try:
            if hasattr(self, 'workflow_service') and self.workflow_service:
                checks["workflow_service"] = True
            else:
                checks["workflow_service"] = False
                issues.append("Workflow service not initialized")
        except Exception as e:
            checks["workflow_service"] = False
            issues.append(f"Workflow service error: {str(e)}")

        # 检查数据库连接
        try:
            async with self.db_manager.get_async_session() as session:
                from sqlalchemy import text
                await session.execute(text("SELECT 1"))
            checks["database_connection"] = True
        except Exception as e:
            checks["database_connection"] = False
            issues.append(f"Database connection error: {str(e)}")

        # 检查工作流状态
        try:
            if hasattr(self, '_cached_workflow'):
                workflow = self._cached_workflow
                from ...models.workflow import WorkflowStatus
                checks["workflow_status"] = workflow["status"] == WorkflowStatus.ACTIVE
                if not checks["workflow_status"]:
                    issues.append(f"Workflow is not active: {workflow['status']}")
            else:
                checks["workflow_status"] = False
                issues.append("Workflow not cached")
        except Exception as e:
            checks["workflow_status"] = False
            issues.append(f"Workflow status check error: {str(e)}")

        # 确定整体健康状态
        is_healthy = all(checks.values())
        status = "healthy" if is_healthy else "unhealthy"

        return HealthCheckResult(
            is_healthy=is_healthy,
            status=status,
            checks=checks,
            issues=issues,
            metrics={
                "execution_stats": self.execution_stats,
                "workflow_id": self.workflow_id,
                "last_check": datetime.now(timezone.utc).isoformat()
            }
        )

    async def _cleanup_impl(self) -> None:
        """清理适配器资源"""
        # 清理服务引用
        if hasattr(self, 'workflow_service'):
            self.workflow_service = None

        if hasattr(self, 'db_manager'):
            self.db_manager = None

        # 清理缓存
        if hasattr(self, '_cached_workflow'):
            delattr(self, '_cached_workflow')

        # 清理统计信息
        if hasattr(self, 'execution_stats'):
            self.execution_stats.clear()

        self.logger.info(f"WorkflowAdapter {self.adapter_id} cleaned up")

    # ================================
    # 辅助方法
    # ================================

    async def _check_execution_permission(
        self,
        session,
        user_id: str,
        context: ExecutionContext
    ) -> bool:
        """检查用户是否有执行工作流的权限"""
        try:
            # 获取工作流信息
            workflow = await self.workflow_service.get_workflow(session, self.workflow_id)
            if not workflow:
                return False

            # 1. 检查是否为工作流所有者
            if workflow.user_id == user_id:
                return True

            # 2. 检查是否在允许的用户列表中（优先级最高）
            if self.allowed_users and user_id in self.allowed_users:
                return True

            # 3. 检查是否允许其他用户
            if self.allow_other_users:
                return True

            return False

        except Exception as e:
            self.logger.error(f"Error checking execution permission: {e}")
            return False
