"""
打包任务相关数据模型

包含自动化构建和打包系统的核心功能：
- PackagingTask: 打包任务管理
- BuildLog: 构建过程日志
- BuildArtifact: 构建输出产物
- PackageTemplate: 打包模板系统
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Integer,
    BigInteger,
    Text,
    ForeignKey,
    Index,
    CheckConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pydantic import BaseModel, Field

from zishu.database.base import DatabaseBaseModel, MetadataMixin


# ================================
# 枚举定义
# ================================


class TaskStatus(str, Enum):
    """任务状态"""

    PENDING = "pending"  # 等待中
    QUEUED = "queued"  # 已排队
    RUNNING = "running"  # 运行中
    SUCCESS = "success"  # 成功
    FAILED = "failed"  # 失败
    CANCELLED = "cancelled"  # 已取消
    TIMEOUT = "timeout"  # 超时
    RETRY = "retry"  # 重试中


class TaskPriority(str, Enum):
    """任务优先级"""

    LOW = "low"  # 低优先级
    NORMAL = "normal"  # 普通优先级
    HIGH = "high"  # 高优先级
    URGENT = "urgent"  # 紧急优先级


class PackageType(str, Enum):
    """打包类型"""

    DESKTOP = "desktop"  # 桌面应用
    WEB = "web"  # Web应用
    DOCKER = "docker"  # Docker镜像
    PYINSTALLER = "pyinstaller"  # PyInstaller可执行文件
    ELECTRON = "electron"  # Electron应用
    TAURI = "tauri"  # Tauri应用
    MOBILE = "mobile"  # 移动应用
    LIBRARY = "library"  # 库文件


class BuildStage(str, Enum):
    """构建阶段"""

    INIT = "init"  # 初始化
    PREPARE = "prepare"  # 准备阶段
    BUILD = "build"  # 构建阶段
    TEST = "test"  # 测试阶段
    PACKAGE = "package"  # 打包阶段
    DEPLOY = "deploy"  # 部署阶段
    CLEANUP = "cleanup"  # 清理阶段


class LogLevel(str, Enum):
    """日志级别"""

    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ArtifactType(str, Enum):
    """产物类型"""

    EXECUTABLE = "executable"  # 可执行文件
    ARCHIVE = "archive"  # 压缩包
    IMAGE = "image"  # 镜像文件
    INSTALLER = "installer"  # 安装包
    LIBRARY = "library"  # 库文件
    DOCUMENTATION = "documentation"  # 文档
    SOURCE = "source"  # 源码
    LOG = "log"  # 日志文件


class TemplateType(str, Enum):
    """模板类型"""

    DOCKERFILE = "dockerfile"  # Docker模板
    PYINSTALLER_SPEC = "pyinstaller_spec"  # PyInstaller规范
    ELECTRON_CONFIG = "electron_config"  # Electron配置
    TAURI_CONFIG = "tauri_config"  # Tauri配置
    BUILD_SCRIPT = "build_script"  # 构建脚本
    CI_CONFIG = "ci_config"  # CI配置


class Platform(str, Enum):
    """目标平台"""

    WINDOWS_X64 = "windows-x64"
    WINDOWS_X86 = "windows-x86"
    WINDOWS_ARM64 = "windows-arm64"
    LINUX_X64 = "linux-x64"
    LINUX_ARM64 = "linux-arm64"
    MACOS_X64 = "macos-x64"
    MACOS_ARM64 = "macos-arm64"
    WEB = "web"
    ANDROID = "android"
    IOS = "ios"


# ================================
# SQLAlchemy 模型
# ================================


class PackageTemplate(DatabaseBaseModel, MetadataMixin):
    """
    打包模板模型

    管理不同类型的打包模板和配置
    """

    __tablename__ = "package_templates"

    # 基础信息
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="模板名称")

    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, comment="模板标识符"
    )

    display_name: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="显示名称"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="模板描述"
    )

    # 模板类型
    template_type: Mapped[TemplateType] = mapped_column(
        String(30), nullable=False, comment="模板类型"
    )

    package_type: Mapped[PackageType] = mapped_column(
        String(20), nullable=False, comment="打包类型"
    )

    # 作者信息
    author_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="模板作者ID",
    )

    # 版本信息
    version: Mapped[str] = mapped_column(
        String(50), default="1.0.0", nullable=False, comment="模板版本"
    )

    # 支持的平台
    supported_platforms: Mapped[List[str]] = mapped_column(
        ARRAY(String), nullable=False, comment="支持的目标平台"
    )

    # 模板内容
    template_content: Mapped[str] = mapped_column(Text, nullable=False, comment="模板内容")

    # 配置模式
    config_schema: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="配置参数模式"
    )

    # 默认配置
    default_config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="默认配置参数"
    )

    # 依赖要求
    requirements: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="依赖要求"
    )

    # 环境变量
    environment_variables: Mapped[Optional[Dict[str, str]]] = mapped_column(
        JSONB, nullable=True, comment="环境变量"
    )

    # 构建脚本
    pre_build_script: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="构建前脚本"
    )

    post_build_script: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="构建后脚本"
    )

    # 状态管理
    is_public: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否公开可用"
    )

    is_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已验证"
    )

    is_deprecated: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已废弃"
    )

    # 使用统计
    usage_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="使用次数"
    )

    success_rate: Mapped[Optional[float]] = mapped_column(
        String(5), nullable=True, comment="成功率"  # 存储为百分比字符串
    )

    # 文档链接
    documentation_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="文档链接"
    )

    example_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="示例链接"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_package_templates_slug", "slug"),
        Index("idx_package_templates_author_id", "author_id"),
        Index("idx_package_templates_type", "template_type"),
        Index("idx_package_templates_package_type", "package_type"),
        Index("idx_package_templates_public", "is_public"),
        Index("idx_package_templates_verified", "is_verified"),
        CheckConstraint(
            "length(name) >= 1 AND length(name) <= 100",
            name="check_template_name_length",
        ),
    )


class PackagingTask(DatabaseBaseModel, MetadataMixin):
    """
    打包任务模型

    管理适配器的自动化打包构建任务
    """

    __tablename__ = "packaging_tasks"

    # 基础信息
    task_name: Mapped[str] = mapped_column(String(200), nullable=False, comment="任务名称")

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="任务描述"
    )

    # 关联信息
    adapter_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("adapters.id", ondelete="CASCADE"),
        nullable=False,
        comment="关联适配器ID",
    )

    adapter_version: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="适配器版本"
    )

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="任务创建者ID",
    )

    # 模板信息
    template_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("package_templates.id", ondelete="CASCADE"),
        nullable=False,
        comment="使用的打包模板ID",
    )

    # 任务配置
    package_type: Mapped[PackageType] = mapped_column(
        String(20), nullable=False, comment="打包类型"
    )

    target_platforms: Mapped[List[str]] = mapped_column(
        ARRAY(String), nullable=False, comment="目标平台列表"
    )

    build_config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, comment="构建配置参数"
    )

    # 任务状态
    task_status: Mapped[TaskStatus] = mapped_column(
        String(20), default=TaskStatus.PENDING, nullable=False, comment="任务状态"
    )

    priority: Mapped[TaskPriority] = mapped_column(
        String(10), default=TaskPriority.NORMAL, nullable=False, comment="任务优先级"
    )

    # 时间信息
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="计划执行时间"
    )

    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="开始执行时间"
    )

    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="完成时间"
    )

    # 执行信息
    worker_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="执行节点ID"
    )

    execution_time: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, comment="执行耗时（秒）"
    )

    # 重试信息
    retry_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="重试次数"
    )

    max_retries: Mapped[int] = mapped_column(
        Integer, default=3, nullable=False, comment="最大重试次数"
    )

    # 结果信息
    success: Mapped[Optional[bool]] = mapped_column(
        Boolean, nullable=True, comment="是否成功"
    )

    error_message: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="错误信息"
    )

    error_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="错误详情"
    )

    # 资源使用
    resource_usage: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="资源使用情况"
    )

    # 构建输出路径
    build_output_path: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="构建输出路径"
    )

    # 环境信息
    build_environment: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="构建环境信息"
    )

    # 通知设置
    notify_on_completion: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="完成时是否通知"
    )

    notify_on_failure: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="失败时是否通知"
    )

    # 关联关系
    template: Mapped["PackageTemplate"] = relationship("PackageTemplate")

    logs: Mapped[List["BuildLog"]] = relationship(
        "BuildLog",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="BuildLog.created_at.asc()",
    )

    artifacts: Mapped[List["BuildArtifact"]] = relationship(
        "BuildArtifact", back_populates="task", cascade="all, delete-orphan"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_packaging_tasks_adapter_id", "adapter_id"),
        Index("idx_packaging_tasks_user_id", "user_id"),
        Index("idx_packaging_tasks_template_id", "template_id"),
        Index("idx_packaging_tasks_status", "task_status"),
        Index("idx_packaging_tasks_priority", "priority"),
        Index("idx_packaging_tasks_scheduled_at", "scheduled_at"),
        Index("idx_packaging_tasks_created_at", "created_at"),
        CheckConstraint("max_retries >= 0", name="check_max_retries_positive"),
        CheckConstraint("retry_count >= 0", name="check_retry_count_positive"),
    )

    @property
    def duration(self) -> Optional[timedelta]:
        """获取任务执行时长"""
        if self.started_at and self.completed_at:
            return self.completed_at - self.started_at
        return None

    @property
    def is_running(self) -> bool:
        """检查任务是否正在运行"""
        return self.task_status == TaskStatus.RUNNING

    @property
    def is_completed(self) -> bool:
        """检查任务是否已完成"""
        return self.task_status in [
            TaskStatus.SUCCESS,
            TaskStatus.FAILED,
            TaskStatus.CANCELLED,
            TaskStatus.TIMEOUT,
        ]

    @property
    def can_retry(self) -> bool:
        """检查任务是否可以重试"""
        return (
            self.task_status == TaskStatus.FAILED
            and self.retry_count < self.max_retries
        )


class BuildLog(DatabaseBaseModel):
    """
    构建日志模型

    记录构建过程中的详细日志信息
    """

    __tablename__ = "build_logs"

    # 关联任务
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("packaging_tasks.id", ondelete="CASCADE"),
        nullable=False,
        comment="关联任务ID",
    )

    # 日志信息
    stage: Mapped[BuildStage] = mapped_column(
        String(20), nullable=False, comment="构建阶段"
    )

    level: Mapped[LogLevel] = mapped_column(String(10), nullable=False, comment="日志级别")

    message: Mapped[str] = mapped_column(Text, nullable=False, comment="日志消息")

    # 时间戳
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="日志时间戳",
    )

    # 序号
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, comment="日志序号")

    # 额外数据
    extra_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, comment="额外日志数据"
    )

    # 异常信息
    exception: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="异常堆栈信息"
    )

    # 执行节点
    worker_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, comment="执行节点ID"
    )

    # 关联关系
    task: Mapped["PackagingTask"] = relationship("PackagingTask", back_populates="logs")

    # 索引
    __table_args__ = (
        Index("idx_build_logs_task_id", "task_id"),
        Index("idx_build_logs_stage", "stage"),
        Index("idx_build_logs_level", "level"),
        Index("idx_build_logs_timestamp", "timestamp"),
        Index("idx_build_logs_sequence", "sequence"),
    )


class BuildArtifact(DatabaseBaseModel, MetadataMixin):
    """
    构建产物模型

    管理构建过程产生的文件和产物
    """

    __tablename__ = "build_artifacts"

    # 关联任务
    task_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("packaging_tasks.id", ondelete="CASCADE"),
        nullable=False,
        comment="关联任务ID",
    )

    # 产物信息
    name: Mapped[str] = mapped_column(String(255), nullable=False, comment="产物名称")

    filename: Mapped[str] = mapped_column(String(255), nullable=False, comment="文件名")

    artifact_type: Mapped[ArtifactType] = mapped_column(
        String(20), nullable=False, comment="产物类型"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="产物描述"
    )

    # 文件属性
    file_size: Mapped[int] = mapped_column(
        BigInteger, nullable=False, comment="文件大小（字节）"
    )

    file_hash: Mapped[str] = mapped_column(String(128), nullable=False, comment="文件哈希值")

    mime_type: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="MIME类型"
    )

    # 存储信息
    storage_path: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="存储路径"
    )

    download_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True, comment="下载URL"
    )

    # 平台信息
    target_platform: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="目标平台"
    )

    # 版本信息
    version: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True, comment="产物版本"
    )

    # 状态信息
    is_primary: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否为主要产物"
    )

    is_published: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已发布"
    )

    # 统计信息
    download_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="下载次数"
    )

    # 校验信息
    checksum_md5: Mapped[Optional[str]] = mapped_column(
        String(32), nullable=True, comment="MD5校验和"
    )

    checksum_sha1: Mapped[Optional[str]] = mapped_column(
        String(40), nullable=True, comment="SHA1校验和"
    )

    checksum_sha256: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, comment="SHA256校验和"
    )

    # 签名信息
    is_signed: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="是否已签名"
    )

    signature: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="数字签名"
    )

    # 过期时间
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="产物过期时间"
    )

    # 关联关系
    task: Mapped["PackagingTask"] = relationship(
        "PackagingTask", back_populates="artifacts"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_build_artifacts_task_id", "task_id"),
        Index("idx_build_artifacts_type", "artifact_type"),
        Index("idx_build_artifacts_platform", "target_platform"),
        Index("idx_build_artifacts_primary", "is_primary"),
        Index("idx_build_artifacts_published", "is_published"),
        Index("idx_build_artifacts_hash", "file_hash"),
        CheckConstraint("file_size >= 0", name="check_artifact_size_positive"),
    )

    def is_expired(self) -> bool:
        """检查产物是否过期"""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at


# ================================
# Pydantic 模式
# ================================


class PackagingTaskBase(BaseModel):
    """打包任务基础模式"""

    task_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    package_type: PackageType
    target_platforms: List[str] = Field(..., min_items=1)
    priority: TaskPriority = TaskPriority.NORMAL


class PackagingTaskCreate(PackagingTaskBase):
    """打包任务创建模式"""

    adapter_id: str
    adapter_version: Optional[str] = None
    template_id: str
    build_config: Dict[str, Any] = Field(default_factory=dict)
    scheduled_at: Optional[datetime] = None
    max_retries: int = Field(default=3, ge=0, le=10)
    notify_on_completion: bool = True
    notify_on_failure: bool = True


class PackagingTaskUpdate(BaseModel):
    """打包任务更新模式"""

    task_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    scheduled_at: Optional[datetime] = None
    max_retries: Optional[int] = Field(None, ge=0, le=10)
    notify_on_completion: Optional[bool] = None
    notify_on_failure: Optional[bool] = None


class PackagingTaskResponse(PackagingTaskBase):
    """打包任务响应模式"""

    id: str
    adapter_id: str
    adapter_version: Optional[str]
    user_id: str
    template_id: str
    task_status: TaskStatus
    scheduled_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    worker_id: Optional[str]
    execution_time: Optional[int]
    retry_count: int
    max_retries: int
    success: Optional[bool]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BuildLogResponse(BaseModel):
    """构建日志响应模式"""

    id: str
    task_id: str
    stage: BuildStage
    level: LogLevel
    message: str
    timestamp: datetime
    sequence: int
    worker_id: Optional[str]

    class Config:
        from_attributes = True
