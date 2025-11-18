"""
适配器运行时配置模型
用于持久化适配器的注册和配置信息
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    String,
    Text,
    Integer,
    Index,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from ..database.base import DatabaseBaseModel


class AdapterConfiguration(DatabaseBaseModel):
    """
    适配器配置模型
    
    存储适配器的运行时配置信息，用于容器重启后自动恢复
    """

    __tablename__ = "adapter_configurations"

    # 适配器标识
    adapter_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, comment="适配器唯一标识符"
    )

    name: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="适配器名称"
    )

    # 适配器类型和版本
    adapter_type: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="适配器类型（soft/hard）"
    )

    adapter_class: Mapped[str] = mapped_column(
        String(500), nullable=False, comment="适配器类路径"
    )

    version: Mapped[str] = mapped_column(
        String(50), nullable=False, default="1.0.0", comment="适配器版本"
    )

    # 配置信息
    config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, comment="适配器配置（JSON格式）"
    )

    # 依赖关系
    dependencies: Mapped[Optional[list]] = mapped_column(
        JSONB, nullable=True, comment="依赖的其他适配器ID列表"
    )

    # 元数据
    description: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="适配器描述"
    )

    author: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, comment="作者"
    )

    tags: Mapped[Optional[list]] = mapped_column(
        JSONB, nullable=True, comment="标签列表"
    )

    # 状态
    is_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False, comment="是否启用"
    )

    status: Mapped[str] = mapped_column(
        String(50), default="registered", nullable=False, comment="适配器状态"
    )

    # 统计信息
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, comment="最后使用时间"
    )

    usage_count: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="使用次数"
    )

    # 索引和约束
    __table_args__ = (
        Index("idx_adapter_configurations_adapter_id", "adapter_id"),
        Index("idx_adapter_configurations_type", "adapter_type"),
        Index("idx_adapter_configurations_status", "status"),
        Index("idx_adapter_configurations_enabled", "is_enabled"),
        Index("idx_adapter_configurations_last_used", "last_used_at"),
        UniqueConstraint("adapter_id", name="uk_adapter_configurations_adapter_id"),
    )

    def __repr__(self) -> str:
        return f"<AdapterConfiguration(id={self.id}, adapter_id={self.adapter_id}, name={self.name})>"
