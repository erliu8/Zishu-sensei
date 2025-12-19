"""
SkillPackage 安装记录数据模型

用于记录 SkillPackage 的安装关系与状态：
- SkillInstallation: 技能包安装记录
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Integer,
    Text,
    ForeignKey,
    UniqueConstraint,
    Index,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pydantic import BaseModel, Field, validator

from ..database.base import DatabaseBaseModel


# ================================
# 枚举定义
# ================================


class InstallationStatus(str, Enum):
    """安装状态枚举"""

    INSTALLING = "installing"  # 安装中
    INSTALLED = "installed"  # 已安装
    UNINSTALLED = "uninstalled"  # 已卸载
    FAILED = "failed"  # 安装失败
    PENDING_APPROVAL = "pending_approval"  # 待审批


# ================================
# 数据模型定义
# ================================


class SkillInstallation(DatabaseBaseModel):
    """
    技能包安装记录模型

    记录用户、工作流和技能包之间的安装关系
    """

    __tablename__ = "skill_installations"

    # 基础字段
    package_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="技能包唯一标识符",
    )

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        comment="用户ID",
    )

    workflow_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=True,
        comment="工作流ID",
    )

    adapter_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="适配器唯一标识符",
    )

    package_version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="技能包版本",
    )

    manifest: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        comment="安装时的完整 manifest",
    )

    installation_status: Mapped[InstallationStatus] = mapped_column(
        String(20),
        default=InstallationStatus.INSTALLED,
        nullable=False,
        comment="安装状态",
    )

    installed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="安装时间",
    )

    uninstalled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="卸载时间",
    )

    error_message: Mapped[Optional[str]] = mapped_column(
        String(1000),
        nullable=True,
        comment="错误信息",
    )

    # 关系定义
    user: Mapped["User"] = relationship(
        "User",
        back_populates="skill_installations",
    )

    workflow: Mapped["Workflow"] = relationship(
        "Workflow",
        back_populates="skill_installations",
    )

    # 表约束和索引
    __table_args__ = (
        UniqueConstraint("user_id", "package_id", name="uq_skill_installations_user_package"),
        UniqueConstraint("adapter_id", name="uq_skill_installations_adapter_id"),
        Index("idx_skill_installations_user_id", "user_id"),
        Index("idx_skill_installations_workflow_id", "workflow_id"),
        Index("idx_skill_installations_installation_status", "installation_status"),
        Index("idx_skill_installations_package_id", "package_id"),
        Index("idx_skill_installations_adapter_id", "adapter_id"),
        {
            "comment": "技能包安装记录表",
        }
    )

    def mark_as_uninstalled(self) -> None:
        """标记为已卸载"""
        self.installation_status = InstallationStatus.UNINSTALLED
        self.uninstalled_at = datetime.now(timezone.utc)

    def mark_as_failed(self, error_message: str) -> None:
        """标记为安装失败"""
        self.installation_status = InstallationStatus.FAILED
        self.error_message = error_message

    def is_active(self) -> bool:
        """检查是否为活跃安装"""
        return (
            not self.is_deleted
            and self.installation_status == InstallationStatus.INSTALLED
        )

    def __repr__(self) -> str:
        return (
            f"<SkillInstallation("
            f"id={self.id}, "
            f"package_id={self.package_id}, "
            f"user_id={self.user_id}, "
            f"status={self.installation_status}"
            f")>"
        )


# ================================
# Pydantic 模式定义
# ================================


class SkillInstallationCreate(BaseModel):
    """创建技能安装记录的模式"""

    package_id: str = Field(..., description="技能包ID")
    user_id: str = Field(..., description="用户ID")
    workflow_id: str = Field(..., description="工作流ID")
    adapter_id: str = Field(..., description="适配器ID")
    package_version: str = Field(..., description="技能包版本")
    manifest: Dict[str, Any] = Field(default_factory=dict, description="安装 manifest")
    installation_status: InstallationStatus = Field(
        default=InstallationStatus.INSTALLED,
        description="安装状态",
    )


class SkillInstallationUpdate(BaseModel):
    """更新技能安装记录的模式"""

    package_version: Optional[str] = Field(None, description="技能包版本")
    manifest: Optional[Dict[str, Any]] = Field(None, description="安装 manifest")
    installation_status: Optional[InstallationStatus] = Field(None, description="安装状态")
    uninstalled_at: Optional[datetime] = Field(None, description="卸载时间")
    error_message: Optional[str] = Field(None, description="错误信息")


class SkillInstallationResponse(BaseModel):
    """技能安装记录响应模式"""

    id: str
    package_id: str
    user_id: str
    workflow_id: str
    adapter_id: str
    package_version: str
    manifest: Dict[str, Any]
    installation_status: InstallationStatus
    installed_at: datetime
    uninstalled_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    status: str
    version: int

    class Config:
        from_attributes = True
        use_enum_values = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
        }


class SkillInstallationListResponse(BaseModel):
    """技能安装记录列表响应模式"""

    items: List[SkillInstallationResponse]
    total: int
    page: int
    per_page: int
    pages: int
