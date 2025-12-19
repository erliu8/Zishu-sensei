#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
技能包清单模型定义
包含技能包的基础数据模型、配置、元数据等
"""

from __future__ import annotations

import json
import re
from typing import Dict, List, Optional, Any, Literal
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator


class TriggerType(str, Enum):
    """工作流触发类型枚举"""
    MANUAL = "manual"
    SCHEDULE = "schedule"
    EVENT = "event"
    WEBHOOK = "webhook"


# ============== 定义依赖规范类 ==============

class DependencySpec(BaseModel):
    """依赖规范"""

    adapter_id: str = Field(
        ...,
        description="依赖的适配器ID"
    )

    required: bool = Field(
        default=True,
        description="是否为必需依赖"
    )

    auto_start: bool = Field(
        default=True,
        description="是否自动启动"
    )

    model_config = {"extra": "forbid"}


class PermissionSpec(BaseModel):
    """权限规范"""

    database_access: List[str] = Field(
        default_factory=list,
        description="数据库访问权限"
    )

    file_system_access: List[str] = Field(
        default_factory=list,
        description="文件系统访问权限"
    )

    network_access: List[str] = Field(
        default_factory=list,
        description="网络访问权限"
    )

    @field_validator("database_access", "file_system_access", "network_access")
    @classmethod
    def validate_permissions(cls, v: List[str]) -> List[str]:
        """验证权限列表"""
        if len(set(v)) != len(v):
            raise ValueError("权限不能重复")
        return v

    model_config = {"extra": "forbid"}


class WorkflowSpec(BaseModel):
    """工作流规范"""

    slug: str = Field(
        ...,
        description="工作流标识符"
    )

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="工作流名称"
    )

    description: Optional[str] = Field(
        None,
        description="工作流描述"
    )

    trigger_type: TriggerType = Field(
        default=TriggerType.MANUAL,
        description="触发类型"
    )

    trigger_config: Dict[str, Any] = Field(
        default_factory=dict,
        description="触发配置"
    )

    definition: Dict[str, Any] = Field(
        ...,
        description="工作流定义，必须包含 nodes 和 edges"
    )

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        """验证工作流slug"""
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("工作流slug只能包含小写字母、数字和连字符")
        if v.startswith("-") or v.endswith("-"):
            raise ValueError("工作流slug不能以连字符开头或结尾")
        return v

    @model_validator(mode="after")
    def validate_definition(self) -> WorkflowSpec:
        """验证工作流定义"""
        if not isinstance(self.definition, dict):
            raise ValueError("definition 必须是字典类型")

        required_keys = {"nodes", "edges"}
        missing_keys = required_keys - set(self.definition.keys())
        if missing_keys:
            raise ValueError(f"definition 缺少必需的键: {missing_keys}")

        # 验证 nodes
        nodes = self.definition.get("nodes", [])
        if not isinstance(nodes, list):
            raise ValueError("nodes 必须是列表类型")

        # 验证 edges
        edges = self.definition.get("edges", [])
        if not isinstance(edges, list):
            raise ValueError("edges 必须是列表类型")

        return self

    model_config = {"extra": "forbid"}


class WorkflowAdapterSpec(BaseModel):
    """工作流适配器规范"""

    adapter_id: Optional[str] = Field(
        None,
        description="适配器ID，如果为空则自动生成"
    )

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="适配器名称"
    )

    adapter_type: Literal["hard"] = Field(
        "hard",
        description="适配器类型，固定为 'hard'"
    )

    adapter_class: str = Field(
        ...,
        description="适配器类路径"
    )

    config: Dict[str, Any] = Field(
        default_factory=dict,
        description="适配器配置"
    )

    @field_validator("adapter_class")
    @classmethod
    def validate_adapter_class(cls, v: str) -> str:
        """验证适配器类路径"""
        expected = "zishu.adapters.hard.workflow_adapter.WorkflowAdapter"
        if v != expected:
            raise ValueError(f"adapter_class 必须是: {expected}")
        return v

    @field_validator("adapter_id")
    @classmethod
    def validate_adapter_id(cls, v: Optional[str]) -> Optional[str]:
        """验证适配器ID"""
        if v is not None and not re.match(r"^[a-zA-Z0-9._-]+$", v):
            raise ValueError(
                "adapter_id 只能包含字母、数字、点、下划线和连字符"
            )
        return v

    @model_validator(mode="after")
    def validate_config(self) -> WorkflowAdapterSpec:
        """验证适配器配置"""
        if not isinstance(self.config, dict):
            raise ValueError("config 必须是字典类型")

        # 检查禁止的字段
        forbidden_fields = {"workflow_id"}
        found_forbidden = forbidden_fields & set(self.config.keys())
        if found_forbidden:
            raise ValueError(f"config 中不能包含字段: {found_forbidden}")

        # 检查 kind 字段（如果存在）
        if "kind" in self.config and self.config["kind"] != "workflow":
            raise ValueError("config['kind'] 必须是 'workflow'")

        # 检查 run_mode（如果存在）
        if "run_mode" in self.config and self.config["run_mode"] != "async":
            raise ValueError("config['run_mode'] 只能是 'async'（v0限制）")

        # 检查 allow_other_users 和 allowed_users 的类型
        if "allow_other_users" in self.config:
            if not isinstance(self.config["allow_other_users"], bool):
                raise ValueError("config['allow_other_users'] 必须是布尔值")

        if "allowed_users" in self.config:
            if not isinstance(self.config["allowed_users"], list):
                raise ValueError("config['allowed_users'] 必须是列表")
            # 验证列表元素都是字符串
            for user_id in self.config["allowed_users"]:
                if not isinstance(user_id, str):
                    raise ValueError("config['allowed_users'] 中的元素必须是字符串")

        return self

    model_config = {"extra": "forbid"}


class SkillManifest(BaseModel):
    """技能包清单 - 顶层模型"""

    manifest_version: str = Field(
        "0.1",
        description="清单版本，当前仅支持 '0.1'"
    )

    package_id: str = Field(
        ...,
        description="技能包ID，格式：skill.<name>[.<sub>]"
    )

    name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="技能包名称"
    )

    version: str = Field(
        ...,
        description="版本号，推荐使用语义化版本"
    )

    description: Optional[str] = Field(
        None,
        description="技能包描述"
    )

    author: Optional[str] = Field(
        None,
        description="作者"
    )

    tags: List[str] = Field(
        default_factory=list,
        description="标签列表"
    )

    workflow: WorkflowSpec = Field(
        ...,
        description="工作流规范"
    )

    workflow_adapter: WorkflowAdapterSpec = Field(
        ...,
        description="工作流适配器规范"
    )

    dependencies: List[DependencySpec] = Field(
        default_factory=list,
        description="依赖列表"
    )

    permissions: PermissionSpec = Field(
        default_factory=PermissionSpec,
        description="权限规范"
    )

    @field_validator("manifest_version")
    @classmethod
    def validate_manifest_version(cls, v: str) -> str:
        """验证清单版本"""
        if v != "0.1":
            raise ValueError("当前仅支持 manifest_version '0.1'")
        return v

    @field_validator("package_id")
    @classmethod
    def validate_package_id(cls, v: str) -> str:
        """验证包ID格式"""
        if not re.match(r"^skill\.[a-z0-9._-]+$", v):
            raise ValueError(
                "package_id 格式错误，应为: skill.<name>[.<sub>]，"
                "仅允许小写字母、数字、点、下划线和连字符"
            )
        return v

    @field_validator("version")
    @classmethod
    def validate_version(cls, v: str) -> str:
        """验证版本格式"""
        # 语义化版本验证，支持 pre-release
        if not re.match(r"^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$", v):
            raise ValueError(
                "版本格式错误，建议使用语义化版本，如: 1.0.0 或 1.0.0-beta.1"
            )
        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        """验证标签"""
        if len(set(v)) != len(v):
            raise ValueError("标签不能重复")
        for tag in v:
            if not tag or len(tag) > 50:
                raise ValueError("每个标签长度应在1-50字符之间")
        return v

    model_config = {"extra": "forbid"}


class SkillManifestError(Exception):
    """技能包清单相关错误"""
    pass


# ============== 辅助方法 ==============

def from_json(text: str) -> SkillManifest:
    """从 JSON 字符串解析技能包清单

    Args:
        text: JSON 字符串

    Returns:
        SkillManifest 实例

    Raises:
        SkillManifestError: 解析或验证失败
    """
    try:
        data = json.loads(text)
        return validate_manifest(data)
    except json.JSONDecodeError as e:
        raise SkillManifestError(f"JSON 解析失败: {str(e)}")
    except Exception as e:
        raise SkillManifestError(f"清单解析失败: {str(e)}")


# 示例清单常量
EXAMPLE_MANIFEST = {
    "manifest_version": "0.1",
    "package_id": "skill.example.hello_world",
    "name": "Hello World 工作流",
    "version": "1.0.0",
    "description": "一个简单的问候工作流示例",
    "author": "示例作者",
    "tags": ["示例", "问候", "工作流"],
    "workflow": {
        "slug": "hello-world",
        "name": "Hello World",
        "description": "输出 Hello World 消息",
        "trigger_type": "manual",
        "trigger_config": {},
        "definition": {
            "nodes": [
                {
                    "id": "start",
                    "type": "start",
                    "config": {"label": "开始"}
                },
                {
                    "id": "message",
                    "type": "adapter",
                    "config": {
                        "adapter_id": "system.logger",
                        "message": "Hello World!"
                    }
                },
                {
                    "id": "end",
                    "type": "end",
                    "config": {"label": "结束"}
                }
            ],
            "edges": [
                {"source": "start", "target": "message"},
                {"source": "message", "target": "end"}
            ]
        }
    },
    "workflow_adapter": {
        "name": "Hello World 适配器",
        "adapter_type": "hard",
        "adapter_class": "zishu.adapters.hard.workflow_adapter.WorkflowAdapter",
        "config": {
            "kind": "workflow",
            "allow_other_users": True,
            "allowed_users": []
        }
    },
    "dependencies": [
        {
            "adapter_id": "system.logger",
            "required": True,
            "auto_start": True
        }
    ],
    "permissions": {
        "database_access": [],
        "file_system_access": ["/tmp"],
        "network_access": []
    }
}


# 工厂函数
def create_skill_manifest(**kwargs) -> SkillManifest:
    """创建技能包清单实例"""
    return SkillManifest(**kwargs)


def validate_manifest(manifest_data: Dict[str, Any]) -> SkillManifest:
    """验证并解析清单数据"""
    try:
        return SkillManifest.model_validate(manifest_data)
    except Exception as e:
        raise SkillManifestError(f"清单验证失败: {str(e)}")


# 导出
__all__ = [
    "SkillManifest",
    "WorkflowSpec",
    "WorkflowAdapterSpec",
    "DependencySpec",
    "PermissionSpec",
    "TriggerType",
    "SkillManifestError",
    "EXAMPLE_MANIFEST",
    "create_skill_manifest",
    "validate_manifest",
    "from_json",
]