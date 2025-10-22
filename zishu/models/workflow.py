"""
工作流系统相关数据模型

包含工作流编排和执行的核心实体：
- Workflow: 工作流定义
- WorkflowNode: 工作流节点
- WorkflowEdge: 工作流连接
- WorkflowExecution: 工作流执行记录
- WorkflowTemplate: 工作流模板
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from enum import Enum
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Integer,
    Text,
    ForeignKey,
    UniqueConstraint,
    Index,
    CheckConstraint,
    func,
    Numeric,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pydantic import BaseModel, Field

from ..database.base import DatabaseBaseModel, MetadataMixin


# ================================
# 枚举定义
# ================================


class WorkflowStatus(str, Enum):
    """工作流状态"""

    DRAFT = "draft"  # 草稿
    ACTIVE = "active"  # 激活
    PAUSED = "paused"  # 暂停
    ARCHIVED = "archived"  # 归档
    DELETED = "deleted"  # 已删除


class WorkflowVisibility(str, Enum):
    """工作流可见性"""

    PRIVATE = "private"  # 私有
    PUBLIC = "public"  # 公开
    SHARED = "shared"  # 已分享
    TEMPLATE = "template"  # 模板


class NodeType(str, Enum):
    """节点类型"""

    START = "start"  # 开始节点
    END = "end"  # 结束节点
    ADAPTER = "adapter"  # 适配器节点
    CONDITION = "condition"  # 条件节点
    LOOP = "loop"  # 循环节点
    PARALLEL = "parallel"  # 并行节点
    DELAY = "delay"  # 延迟节点
    TRANSFORM = "transform"  # 数据转换节点
    HTTP = "http"  # HTTP请求节点
    SCRIPT = "script"  # 脚本节点


class NodeStatus(str, Enum):
    """节点状态"""

    PENDING = "pending"  # 待执行
    RUNNING = "running"  # 运行中
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 失败
    SKIPPED = "skipped"  # 已跳过
    CANCELLED = "cancelled"  # 已取消


class ExecutionStatus(str, Enum):
    """执行状态"""

    PENDING = "pending"  # 等待中
    RUNNING = "running"  # 运行中
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 失败
    CANCELLED = "cancelled"  # 已取消
    TIMEOUT = "timeout"  # 超时


class ExecutionMode(str, Enum):
    """执行模式"""

    MANUAL = "manual"  # 手动触发
    SCHEDULED = "scheduled"  # 定时触发
    WEBHOOK = "webhook"  # Webhook触发
    EVENT = "event"  # 事件触发


class TriggerType(str, Enum):
    """触发器类型"""

    MANUAL = "manual"  # 手动
    CRON = "cron"  # 定时任务
    WEBHOOK = "webhook"  # Webhook
    FILE_UPLOAD = "file_upload"  # 文件上传
    MESSAGE = "message"  # 消息
    SYSTEM_EVENT = "system_event"  # 系统事件


# ================================
# SQLAlchemy 模型
# ================================


class Workflow(DatabaseBaseModel, MetadataMixin):
    """
    工作流定义模型

    管理工作流的结构和配置
    """

    __tablename__ = "workflows"

    # 基础信息
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="工作流名称"
    )

    slug: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="工作流标识符"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="工作流描述"
    )

    # 所有者
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户ID",
    )

    # 分类和标签
    category: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="分类"
    )

    tags: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="标签列表"
    )

    # 状态和可见性
    workflow_status: Mapped[WorkflowStatus] = mapped_column(
        String(20), default=WorkflowStatus.DRAFT, nullable=False, comment="工作流状态"
    )

    visibility: Mapped[WorkflowVisibility] = mapped_column(
        String(20),
        default=WorkflowVisibility.PRIVATE,
        nullable=False,
        comment="可见性",
    )

    # 工作流定义
    definition: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="工作流定义JSON"
    )

    # 版本信息
    version: Mapped[str] = mapped_column(
        String(20), default="1.0.0", nullable=False, comment="版本号"
    )

    # 触发器配置
    trigger_type: Mapped[TriggerType] = mapped_column(
        String(20), default=TriggerType.MANUAL, nullable=False, comment="触发器类型"
    )

    trigger_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="触发器配置"
    )

    # 执行配置
    timeout_seconds: Mapped[int] = mapped_column(
        Integer, default=3600, nullable=False, comment="执行超时时间（秒）"
    )

    retry_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="重试次数"
    )

    retry_delay: Mapped[int] = mapped_column(
        Integer, default=60, nullable=False, comment="重试延迟（秒）"
    )

    # 环境变量
    environment_variables: Mapped[Optional[Dict[str, str]]] = mapped_column(
        JSONB, nullable=True, comment="环境变量"
    )

    # 统计信息
    execution_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="总执行次数"
    )

    success_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="成功次数"
    )

    failure_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="失败次数"
    )

    average_duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="平均执行时间（毫秒）"
    )

    # 分享和克隆
    is_template: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为模板"
    )

    clone_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="被克隆次数"
    )

    parent_workflow_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("workflows.id", ondelete="SET NULL"),
        nullable=True,
        comment="父工作流ID（克隆来源）",
    )

    # 最后执行信息
    last_executed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="最后执行时间"
    )

    last_execution_status: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="最后执行状态"
    )

    # 关联关系
    nodes: Mapped[List["WorkflowNode"]] = relationship(
        "WorkflowNode",
        back_populates="workflow",
        cascade="all, delete-orphan",
    )

    edges: Mapped[List["WorkflowEdge"]] = relationship(
        "WorkflowEdge",
        back_populates="workflow",
        cascade="all, delete-orphan",
    )

    executions: Mapped[List["WorkflowExecution"]] = relationship(
        "WorkflowExecution",
        back_populates="workflow",
        cascade="all, delete-orphan",
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_workflows_user_id", "user_id"),
        Index("idx_workflows_slug", "slug"),
        Index("idx_workflows_status", "workflow_status"),
        Index("idx_workflows_visibility", "visibility"),
        Index("idx_workflows_category", "category"),
        Index("idx_workflows_is_template", "is_template"),
        UniqueConstraint("user_id", "slug", name="uk_workflows_user_slug"),
        CheckConstraint(
            "timeout_seconds >= 1 AND timeout_seconds <= 86400",
            name="check_timeout_seconds",
        ),
        CheckConstraint(
            "retry_count >= 0 AND retry_count <= 10",
            name="check_retry_count",
        ),
    )


class WorkflowNode(DatabaseBaseModel):
    """
    工作流节点模型

    工作流中的单个节点
    """

    __tablename__ = "workflow_nodes"

    # 关联工作流
    workflow_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        comment="工作流ID",
    )

    # 节点信息
    node_id: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="节点ID（工作流内唯一）"
    )

    node_type: Mapped[NodeType] = mapped_column(
        String(20), nullable=False, comment="节点类型"
    )

    node_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="节点名称"
    )

    description: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="节点描述"
    )

    # 节点配置
    config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="节点配置"
    )

    # 适配器信息（如果是适配器节点）
    adapter_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("adapters.id", ondelete="SET NULL"),
        nullable=True,
        comment="适配器ID",
    )

    adapter_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="适配器配置"
    )

    # 位置信息（用于可视化）
    position_x: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="X坐标"
    )

    position_y: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="Y坐标"
    )

    # 执行顺序
    execution_order: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="执行顺序"
    )

    # 关联关系
    workflow: Mapped["Workflow"] = relationship(
        "Workflow", back_populates="nodes"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_workflow_nodes_workflow_id", "workflow_id"),
        Index("idx_workflow_nodes_type", "node_type"),
        Index("idx_workflow_nodes_adapter_id", "adapter_id"),
        UniqueConstraint(
            "workflow_id", "node_id", name="uk_workflow_nodes_unique"
        ),
    )


class WorkflowEdge(DatabaseBaseModel):
    """
    工作流连接模型

    定义节点之间的连接关系
    """

    __tablename__ = "workflow_edges"

    # 关联工作流
    workflow_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        comment="工作流ID",
    )

    # 连接信息
    edge_id: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="连接ID"
    )

    source_node_id: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="源节点ID"
    )

    target_node_id: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="目标节点ID"
    )

    # 连接配置
    label: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="连接标签"
    )

    condition: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="执行条件"
    )

    # 数据转换
    data_mapping: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="数据映射配置"
    )

    # 关联关系
    workflow: Mapped["Workflow"] = relationship(
        "Workflow", back_populates="edges"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_workflow_edges_workflow_id", "workflow_id"),
        Index("idx_workflow_edges_source", "source_node_id"),
        Index("idx_workflow_edges_target", "target_node_id"),
        UniqueConstraint(
            "workflow_id", "edge_id", name="uk_workflow_edges_unique"
        ),
    )


class WorkflowExecution(DatabaseBaseModel):
    """
    工作流执行记录模型

    记录工作流的执行历史
    """

    __tablename__ = "workflow_executions"

    # 关联工作流
    workflow_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        comment="工作流ID",
    )

    # 执行信息
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="执行用户ID",
    )

    execution_mode: Mapped[ExecutionMode] = mapped_column(
        String(20), default=ExecutionMode.MANUAL, nullable=False, comment="执行模式"
    )

    execution_status: Mapped[ExecutionStatus] = mapped_column(
        String(20), default=ExecutionStatus.PENDING, nullable=False, comment="执行状态"
    )

    # 输入输出
    input_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="输入数据"
    )

    output_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="输出数据"
    )

    # 执行细节
    execution_log: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(
        JSONB, nullable=True, comment="执行日志"
    )

    node_results: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="节点执行结果"
    )

    # 错误信息
    error_code: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="错误代码"
    )

    error_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="错误信息"
    )

    error_stack: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="错误堆栈"
    )

    failed_node_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="失败的节点ID"
    )

    # 时间信息
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="开始时间"
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="完成时间"
    )

    duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="执行时长（毫秒）"
    )

    # 资源消耗
    total_tokens: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="总Token消耗"
    )

    total_cost: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 6), nullable=True, comment="总成本（美元）"
    )

    # 重试信息
    retry_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="重试次数"
    )

    parent_execution_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("workflow_executions.id", ondelete="SET NULL"),
        nullable=True,
        comment="父执行ID（重试情况）",
    )

    # 关联关系
    workflow: Mapped["Workflow"] = relationship(
        "Workflow", back_populates="executions"
    )

    # 索引
    __table_args__ = (
        Index("idx_workflow_executions_workflow_id", "workflow_id"),
        Index("idx_workflow_executions_user_id", "user_id"),
        Index("idx_workflow_executions_status", "execution_status"),
        Index("idx_workflow_executions_started_at", "started_at"),
        Index("idx_workflow_executions_parent_id", "parent_execution_id"),
    )


class WorkflowTemplate(DatabaseBaseModel, MetadataMixin):
    """
    工作流模板模型

    预定义的工作流模板
    """

    __tablename__ = "workflow_templates"

    # 基础信息
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="模板名称"
    )

    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, comment="模板标识符"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="模板描述"
    )

    # 分类
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="模板分类"
    )

    tags: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String), nullable=True, comment="标签列表"
    )

    # 模板内容
    template_definition: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="模板定义"
    )

    # 使用说明
    usage_guide: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="使用指南"
    )

    example_input: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="示例输入"
    )

    example_output: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="示例输出"
    )

    # 作者信息
    author_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="作者用户ID",
    )

    # 状态
    is_official: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为官方模板"
    )

    is_featured: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为推荐模板"
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否激活"
    )

    # 统计
    usage_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="使用次数"
    )

    # 版本
    version: Mapped[str] = mapped_column(
        String(20), default="1.0.0", nullable=False, comment="版本号"
    )

    # 索引
    __table_args__ = (
        Index("idx_workflow_templates_slug", "slug"),
        Index("idx_workflow_templates_category", "category"),
        Index("idx_workflow_templates_author_id", "author_id"),
        Index("idx_workflow_templates_official", "is_official"),
        Index("idx_workflow_templates_featured", "is_featured"),
    )


# ================================
# Pydantic 模式
# ================================


class WorkflowCreate(BaseModel):
    """工作流创建模式"""

    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    definition: Dict[str, Any]
    trigger_type: TriggerType = TriggerType.MANUAL
    trigger_config: Optional[Dict[str, Any]] = None


class WorkflowUpdate(BaseModel):
    """工作流更新模式"""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    definition: Optional[Dict[str, Any]] = None
    workflow_status: Optional[WorkflowStatus] = None
    visibility: Optional[WorkflowVisibility] = None


class WorkflowResponse(BaseModel):
    """工作流响应模式"""

    id: str
    user_id: str
    name: str
    slug: str
    description: Optional[str]
    workflow_status: WorkflowStatus
    visibility: WorkflowVisibility
    version: str
    execution_count: int
    success_count: int
    failure_count: int
    last_executed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowExecutionCreate(BaseModel):
    """工作流执行创建模式"""

    input_data: Optional[Dict[str, Any]] = None
    execution_mode: ExecutionMode = ExecutionMode.MANUAL


class WorkflowExecutionResponse(BaseModel):
    """工作流执行响应模式"""

    id: str
    workflow_id: str
    user_id: str
    execution_status: ExecutionStatus
    execution_mode: ExecutionMode
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

