#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
依赖验证策略模块

提供技能包依赖检查和验证功能。
"""

from __future__ import annotations

from typing import List, Literal, Optional, Dict
from pydantic import BaseModel, Field

from .schemas import DependencySpec, PermissionSpec


class DependencyCheckResult(BaseModel):
    """依赖检查结果"""

    ok: bool = Field(
        ...,
        description="依赖是否满足（所有必需依赖都存在且成功启动）"
    )

    missing: List[str] = Field(
        default_factory=list,
        description="缺失的必需依赖列表"
    )

    start_failed: List[str] = Field(
        default_factory=list,
        description="启动失败的必需依赖列表"
    )

    warnings: List[str] = Field(
        default_factory=list,
        description="警告信息（可选依赖缺失或启动失败等）"
    )


class PermissionCheckResult(BaseModel):
    """权限检查结果"""

    ok: bool = Field(
        ...,
        description="权限是否通过（无风险项）"
    )

    requires_approval: bool = Field(
        ...,
        description="是否需要审批（存在风险项但非严格模式）"
    )

    rejected: bool = Field(
        ...,
        description="是否被拒绝（严格模式下存在风险项）"
    )

    required_permissions: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="触发权限检查的项（仅当requires_approval或rejected时填充）"
    )

    reason: Optional[str] = Field(
        None,
        description="拒绝或需要审批的原因"
    )


async def check_dependencies(
    adapter_manager,
    dependencies: List[DependencySpec]
) -> DependencyCheckResult:
    """
    检查技能包的依赖是否满足

    Args:
        adapter_manager: 适配器管理器实例（需保证已运行）
        dependencies: 依赖规范列表

    Returns:
        DependencyCheckResult: 检查结果
    """
    missing = []
    start_failed = []
    warnings = []

    for dep in dependencies:
        # 检查适配器注册状态
        registration = await adapter_manager.get_adapter(dep.adapter_id)

        if registration is None:
            # 适配器未注册
            if dep.required:
                missing.append(dep.adapter_id)
            else:
                warnings.append(f"Optional dependency missing: {dep.adapter_id}")
            continue

        # 检查适配器运行状态
        if dep.adapter_id not in adapter_manager._adapters:
            # 适配器未运行
            if dep.auto_start:
                try:
                    success = await adapter_manager.start_adapter(dep.adapter_id)
                    if not success:
                        if dep.required:
                            start_failed.append(dep.adapter_id)
                        else:
                            warnings.append(f"Optional dependency failed to start: {dep.adapter_id}")
                except Exception:
                    # start_adapter 抛出异常时的处理
                    if dep.required:
                        start_failed.append(dep.adapter_id)
                    else:
                        warnings.append(f"Optional dependency failed to start: {dep.adapter_id}")
            else:
                warnings.append(f"Dependency not running: {dep.adapter_id}")

    # 计算整体结果
    ok = len(missing) == 0 and len(start_failed) == 0

    return DependencyCheckResult(
        ok=ok,
        missing=missing,
        start_failed=start_failed,
        warnings=warnings
    )


def check_permissions(
    permission_spec: PermissionSpec,
    install_mode: Literal["strict", "allow_with_approval"]
) -> PermissionCheckResult:
    """
    检查技能包权限是否符合安装模式策略

    Args:
        permission_spec: 权限规范
        install_mode: 安装模式，"strict" 或 "allow_with_approval"

    Returns:
        PermissionCheckResult: 权限检查结果
    """
    # 验证安装模式参数
    if install_mode not in ["strict", "allow_with_approval"]:
        raise ValueError(f"Invalid install_mode: {install_mode}. Must be 'strict' or 'allow_with_approval'")

    # v0 策略规则：数据库白名单
    DATABASE_WHITELIST = {"workflows", "workflow_executions"}

    # 收集风险项
    risk_items = {
        "network_access": [],
        "file_system_access": [],
        "database_access": []
    }

    # 检查网络访问风险（非空即风险）
    if permission_spec.network_access:
        risk_items["network_access"] = permission_spec.network_access.copy()

    # 检查文件系统访问风险（只允许/tmp开头，忽略空字符串）
    for path in permission_spec.file_system_access:
        if path and not path.startswith("/tmp"):
            risk_items["file_system_access"].append(path)

    # 检查数据库访问风险（白名单之外）
    for table in permission_spec.database_access:
        if table not in DATABASE_WHITELIST:
            risk_items["database_access"].append(table)

    # 判断是否存在风险项
    has_risks = any(
        len(risk_items[key]) > 0
        for key in ["network_access", "file_system_access", "database_access"]
    )

    if not has_risks:
        # 无风险项，直接通过
        return PermissionCheckResult(
            ok=True,
            requires_approval=False,
            rejected=False
        )

    # 根据安装模式处理风险项
    if install_mode == "strict":
        # 严格模式：任何风险项都拒绝
        return PermissionCheckResult(
            ok=False,
            requires_approval=False,
            rejected=True,
            required_permissions={k: v for k, v in risk_items.items() if v},
            reason="Risk items detected in strict mode"
        )
    else:  # allow_with_approval
        # 审批模式：风险项需要审批
        return PermissionCheckResult(
            ok=False,
            requires_approval=True,
            rejected=False,
            required_permissions={k: v for k, v in risk_items.items() if v},
            reason="Risk items require approval"
        )


# 导出
__all__ = ["DependencyCheckResult", "check_dependencies", "PermissionCheckResult", "check_permissions"]