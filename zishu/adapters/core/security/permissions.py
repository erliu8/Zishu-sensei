"""
增强型权限控制和访问管理系统

为Zishu-sensei适配器框架提供完整的权限管理功能，支持：
- 细粒度权限控制（RBAC + ABAC）
- 动态权限策略和规则引擎
- 多级权限继承和委托
- 实时权限验证和缓存
- 完整的访问审计和监控
"""

import asyncio
import time
import json
import uuid
import hashlib
import fnmatch
import logging
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from enum import Enum, auto
from functools import wraps, lru_cache
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Optional,
    Set,
    Union,
    Tuple,
    Protocol,
    TYPE_CHECKING,
    NamedTuple,
)
from dataclasses import dataclass, field, asdict
import threading
import weakref
from contextlib import asynccontextmanager
import re

# 第三方库
try:
    import redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

try:
    import jwt

    JWT_AVAILABLE = True
except ImportError:
    JWT_AVAILABLE = False
    jwt = None

# 本地导入
from .audit import (
    AuditLogger,
    AuditEventType,
    AuditSeverity,
    get_audit_logger,
    audit_operation,
)

if TYPE_CHECKING:
    from ...api.security import SecurityContext, SecurityLevel

logger = logging.getLogger(__name__)


class PermissionType(Enum):
    """权限类型"""

    # 基础权限
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    EXECUTE = "execute"
    CREATE = "create"
    UPDATE = "update"

    # 管理权限
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
    USER_MANAGE = "user_manage"
    ROLE_MANAGE = "role_manage"
    PERMISSION_MANAGE = "permission_manage"

    # 系统权限
    SYSTEM_CONFIG = "system_config"
    SYSTEM_MONITOR = "system_monitor"
    SYSTEM_BACKUP = "system_backup"
    SYSTEM_RESTORE = "system_restore"
    SYSTEM_SHUTDOWN = "system_shutdown"

    # 适配器权限
    ADAPTER_INSTALL = "adapter_install"
    ADAPTER_UNINSTALL = "adapter_uninstall"
    ADAPTER_CONFIGURE = "adapter_configure"
    ADAPTER_EXECUTE = "adapter_execute"
    ADAPTER_DEBUG = "adapter_debug"

    # 模型权限
    MODEL_ACCESS = "model_access"
    MODEL_TRAIN = "model_train"
    MODEL_DEPLOY = "model_deploy"
    MODEL_DELETE = "model_delete"
    MODEL_EXPORT = "model_export"

    # 数据权限
    DATA_READ = "data_read"
    DATA_WRITE = "data_write"
    DATA_DELETE = "data_delete"
    DATA_EXPORT = "data_export"
    DATA_IMPORT = "data_import"

    # 网络权限
    NETWORK_ACCESS = "network_access"
    NETWORK_ADMIN = "network_admin"

    # 文件系统权限
    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    FILE_DELETE = "file_delete"
    FILE_EXECUTE = "file_execute"


class RoleType(Enum):
    """角色类型"""

    SUPER_ADMIN = "super_admin"  # 超级管理员
    ADMIN = "admin"  # 管理员
    DEVELOPER = "developer"  # 开发者
    ANALYST = "analyst"  # 分析师
    OPERATOR = "operator"  # 操作员
    USER = "user"  # 普通用户
    GUEST = "guest"  # 访客
    SERVICE = "service"  # 服务账户
    SYSTEM = "system"  # 系统账户


class AccessDecision(Enum):
    """访问决策"""

    ALLOW = "allow"  # 允许
    DENY = "deny"  # 拒绝
    ABSTAIN = "abstain"  # 弃权
    CONDITIONAL = "conditional"  # 条件允许


class PolicyEffect(Enum):
    """策略效果"""

    PERMIT = "permit"  # 允许
    DENY = "deny"  # 拒绝
    INDETERMINATE = "indeterminate"  # 不确定


class PermissionScope(Enum):
    """权限范围"""

    GLOBAL = "global"  # 全局权限
    TENANT = "tenant"  # 租户权限
    PROJECT = "project"  # 项目权限
    RESOURCE = "resource"  # 资源权限
    INSTANCE = "instance"  # 实例权限


@dataclass
class Permission:
    """权限定义"""

    name: str
    type: PermissionType
    scope: PermissionScope
    description: str
    resource_pattern: Optional[str] = None
    conditions: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def matches_resource(self, resource: str) -> bool:
        """检查权限是否匹配资源"""
        if not self.resource_pattern:
            return True
        return fnmatch.fnmatch(resource, self.resource_pattern)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": self.type.value,
            "scope": self.scope.value,
            "description": self.description,
            "resource_pattern": self.resource_pattern,
            "conditions": self.conditions,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class Role:
    """角色定义"""

    name: str
    type: RoleType
    description: str
    permissions: Set[str] = field(default_factory=set)
    parent_roles: Set[str] = field(default_factory=set)
    conditions: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": self.type.value,
            "description": self.description,
            "permissions": list(self.permissions),
            "parent_roles": list(self.parent_roles),
            "conditions": self.conditions,
            "metadata": self.metadata,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
        }


@dataclass
class AccessRequest:
    """访问请求"""

    user_id: str
    resource: str
    action: str
    context: Dict[str, Any] = field(default_factory=dict)
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "resource": self.resource,
            "action": self.action,
            "context": self.context,
            "session_id": self.session_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class AccessResult:
    """访问结果"""

    decision: AccessDecision
    reason: str
    permissions_used: List[str] = field(default_factory=list)
    conditions_evaluated: List[str] = field(default_factory=list)
    evaluation_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def granted(self) -> bool:
        return self.decision == AccessDecision.ALLOW

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision": self.decision.value,
            "reason": self.reason,
            "granted": self.granted,
            "permissions_used": self.permissions_used,
            "conditions_evaluated": self.conditions_evaluated,
            "evaluation_time": self.evaluation_time,
            "metadata": self.metadata,
        }


@dataclass
class PolicyRule:
    """策略规则"""

    name: str
    description: str
    condition: str  # 条件表达式
    effect: PolicyEffect
    priority: int = 0
    is_active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "condition": self.condition,
            "effect": self.effect.value,
            "priority": self.priority,
            "is_active": self.is_active,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
        }


class ConditionEvaluator:
    """条件评估器"""

    def __init__(self):
        self.functions = {
            "time_between": self._time_between,
            "ip_in_range": self._ip_in_range,
            "has_attribute": self._has_attribute,
            "matches_pattern": self._matches_pattern,
            "user_in_group": self._user_in_group,
            "resource_owner": self._resource_owner,
            "rate_limit": self._rate_limit,
        }

    def evaluate(self, condition: str, context: Dict[str, Any]) -> bool:
        """评估条件表达式"""
        try:
            # 简单的条件解析器
            # 支持基本的逻辑运算符和函数调用
            return self._evaluate_expression(condition, context)
        except Exception as e:
            logger.error(f"Condition evaluation failed: {e}")
            return False

    def _evaluate_expression(self, expr: str, context: Dict[str, Any]) -> bool:
        """评估表达式"""
        # 替换上下文变量
        for key, value in context.items():
            expr = expr.replace(f"${key}", str(value))

        # 处理函数调用
        import re

        func_pattern = r"(\w+)\(([^)]*)\)"

        def replace_func(match):
            func_name = match.group(1)
            args_str = match.group(2)
            args = [
                arg.strip().strip("\"'") for arg in args_str.split(",") if arg.strip()
            ]

            if func_name in self.functions:
                result = self.functions[func_name](args, context)
                return str(result).lower()
            return "false"

        expr = re.sub(func_pattern, replace_func, expr)

        # 简单的布尔表达式评估
        expr = (
            expr.replace("and", " and ").replace("or", " or ").replace("not", " not ")
        )
        expr = expr.replace("true", "True").replace("false", "False")

        try:
            return eval(expr, {"__builtins__": {}})
        except:
            return False

    def _time_between(self, args: List[str], context: Dict[str, Any]) -> bool:
        """检查时间是否在指定范围内"""
        if len(args) < 2:
            return False

        try:
            start_time = args[0]
            end_time = args[1]
            current_time = datetime.now().strftime("%H:%M")
            return start_time <= current_time <= end_time
        except:
            return False

    def _ip_in_range(self, args: List[str], context: Dict[str, Any]) -> bool:
        """检查IP是否在指定范围内"""
        if len(args) < 2:
            return False

        try:
            import ipaddress

            ip = ipaddress.ip_address(args[0])
            network = ipaddress.ip_network(args[1], strict=False)
            return ip in network
        except:
            return False

    def _has_attribute(self, args: List[str], context: Dict[str, Any]) -> bool:
        """检查是否具有指定属性"""
        if len(args) < 1:
            return False

        attr_name = args[0]
        return attr_name in context

    def _matches_pattern(self, args: List[str], context: Dict[str, Any]) -> bool:
        """检查是否匹配模式"""
        if len(args) < 2:
            return False

        value = args[0]
        pattern = args[1]
        return fnmatch.fnmatch(value, pattern)

    def _user_in_group(self, args: List[str], context: Dict[str, Any]) -> bool:
        """检查用户是否在指定组中"""
        if len(args) < 2:
            return False

        user_id = args[0]
        group = args[1]
        user_groups = context.get("user_groups", [])
        return group in user_groups

    def _resource_owner(self, args: List[str], context: Dict[str, Any]) -> bool:
        """检查是否为资源所有者"""
        if len(args) < 2:
            return False

        user_id = args[0]
        resource_owner = args[1]
        return user_id == resource_owner

    def _rate_limit(self, args: List[str], context: Dict[str, Any]) -> bool:
        """检查速率限制"""
        # 简化实现，实际应该使用Redis等存储
        return True


class PermissionCache:
    """权限缓存"""

    def __init__(self, ttl: int = 300):  # 5分钟TTL
        self.ttl = ttl
        self.cache: Dict[str, Tuple[Any, datetime]] = {}
        self.lock = threading.RLock()

    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        with self.lock:
            if key in self.cache:
                value, timestamp = self.cache[key]
                if datetime.now() - timestamp < timedelta(seconds=self.ttl):
                    return value
                else:
                    del self.cache[key]
            return None

    def set(self, key: str, value: Any) -> None:
        """设置缓存值"""
        with self.lock:
            self.cache[key] = (value, datetime.now())

    def delete(self, key: str) -> None:
        """删除缓存值"""
        with self.lock:
            self.cache.pop(key, None)

    def clear(self) -> None:
        """清空缓存"""
        with self.lock:
            self.cache.clear()

    def cleanup_expired(self) -> None:
        """清理过期缓存"""
        with self.lock:
            now = datetime.now()
            expired_keys = [
                key
                for key, (_, timestamp) in self.cache.items()
                if now - timestamp >= timedelta(seconds=self.ttl)
            ]
            for key in expired_keys:
                del self.cache[key]


class EnhancedPermissionManager:
    """增强型权限管理器"""

    def __init__(self, cache_ttl: int = 300):
        self.permissions: Dict[str, Permission] = {}
        self.roles: Dict[str, Role] = {}
        self.user_roles: Dict[str, Set[str]] = defaultdict(set)
        self.policy_rules: Dict[str, PolicyRule] = {}

        # 缓存和评估器
        self.cache = PermissionCache(cache_ttl)
        self.condition_evaluator = ConditionEvaluator()

        # 审计日志
        self.audit_logger = get_audit_logger()

        # 统计信息
        self.stats = {
            "total_checks": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "allowed_requests": 0,
            "denied_requests": 0,
            "evaluation_time_total": 0.0,
        }

        # 初始化默认权限和角色
        self._initialize_defaults()

        logger.info("EnhancedPermissionManager initialized")

    def _initialize_defaults(self) -> None:
        """初始化默认权限和角色"""
        # 创建基础权限
        base_permissions = [
            Permission(
                "read_basic", PermissionType.READ, PermissionScope.GLOBAL, "基础读取权限"
            ),
            Permission(
                "write_basic", PermissionType.WRITE, PermissionScope.GLOBAL, "基础写入权限"
            ),
            Permission(
                "execute_basic",
                PermissionType.EXECUTE,
                PermissionScope.GLOBAL,
                "基础执行权限",
            ),
            Permission(
                "admin_full", PermissionType.ADMIN, PermissionScope.GLOBAL, "完整管理权限"
            ),
            Permission(
                "system_config",
                PermissionType.SYSTEM_CONFIG,
                PermissionScope.GLOBAL,
                "系统配置权限",
            ),
            Permission(
                "adapter_manage",
                PermissionType.ADAPTER_CONFIGURE,
                PermissionScope.GLOBAL,
                "适配器管理权限",
            ),
            Permission(
                "model_access",
                PermissionType.MODEL_ACCESS,
                PermissionScope.GLOBAL,
                "模型访问权限",
            ),
        ]

        for perm in base_permissions:
            self.permissions[perm.name] = perm

        # 创建基础角色
        guest_role = Role("guest", RoleType.GUEST, "访客角色", {"read_basic"})
        user_role = Role("user", RoleType.USER, "普通用户", {"read_basic", "write_basic"})
        developer_role = Role(
            "developer",
            RoleType.DEVELOPER,
            "开发者",
            {"read_basic", "write_basic", "execute_basic", "adapter_manage"},
        )
        admin_role = Role(
            "admin",
            RoleType.ADMIN,
            "管理员",
            {
                "read_basic",
                "write_basic",
                "execute_basic",
                "adapter_manage",
                "system_config",
            },
        )
        super_admin_role = Role(
            "super_admin",
            RoleType.SUPER_ADMIN,
            "超级管理员",
            {"admin_full", "system_config", "adapter_manage", "model_access"},
        )

        roles = [guest_role, user_role, developer_role, admin_role, super_admin_role]
        for role in roles:
            self.roles[role.name] = role

        # 创建基础策略规则
        basic_rules = [
            PolicyRule(
                "deny_guest_write",
                "访客不能写入",
                "user_role == 'guest' and action in ['write', 'delete', 'create']",
                PolicyEffect.DENY,
                priority=100,
            ),
            PolicyRule(
                "allow_admin_all",
                "管理员允许所有操作",
                "user_role in ['admin', 'super_admin']",
                PolicyEffect.PERMIT,
                priority=50,
            ),
            PolicyRule(
                "time_restriction",
                "工作时间限制",
                "time_between('09:00', '18:00')",
                PolicyEffect.PERMIT,
                priority=10,
            ),
        ]

        for rule in basic_rules:
            self.policy_rules[rule.name] = rule

    # ================================
    # 权限管理
    # ================================

    def create_permission(self, permission: Permission) -> bool:
        """创建权限"""
        try:
            if permission.name in self.permissions:
                logger.warning(f"Permission already exists: {permission.name}")
                return False

            self.permissions[permission.name] = permission
            self.cache.clear()  # 清空缓存

            if self.audit_logger:
                asyncio.create_task(
                    self.audit_logger.log_event(
                        AuditEventType.PERMISSION_CHANGE,
                        f"Created permission: {permission.name}",
                        component="enhanced_permissions",
                        details=permission.to_dict(),
                    )
                )

            logger.info(f"Created permission: {permission.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to create permission {permission.name}: {e}")
            return False

    def update_permission(self, name: str, permission: Permission) -> bool:
        """更新权限"""
        try:
            if name not in self.permissions:
                logger.warning(f"Permission not found: {name}")
                return False

            old_permission = self.permissions[name]
            self.permissions[name] = permission
            self.cache.clear()

            if self.audit_logger:
                asyncio.create_task(
                    self.audit_logger.log_event(
                        AuditEventType.PERMISSION_CHANGE,
                        f"Updated permission: {name}",
                        component="enhanced_permissions",
                        details={
                            "old": old_permission.to_dict(),
                            "new": permission.to_dict(),
                        },
                    )
                )

            logger.info(f"Updated permission: {name}")
            return True

        except Exception as e:
            logger.error(f"Failed to update permission {name}: {e}")
            return False

    def delete_permission(self, name: str) -> bool:
        """删除权限"""
        try:
            if name not in self.permissions:
                logger.warning(f"Permission not found: {name}")
                return False

            permission = self.permissions.pop(name)

            # 从所有角色中移除该权限
            for role in self.roles.values():
                role.permissions.discard(name)

            self.cache.clear()

            if self.audit_logger:
                asyncio.create_task(
                    self.audit_logger.log_event(
                        AuditEventType.PERMISSION_CHANGE,
                        f"Deleted permission: {name}",
                        component="enhanced_permissions",
                        details=permission.to_dict(),
                    )
                )

            logger.info(f"Deleted permission: {name}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete permission {name}: {e}")
            return False

    def get_permission(self, name: str) -> Optional[Permission]:
        """获取权限"""
        return self.permissions.get(name)

    def list_permissions(self) -> List[Permission]:
        """列出所有权限"""
        return list(self.permissions.values())

    # ================================
    # 角色管理
    # ================================

    def create_role(self, role: Role) -> bool:
        """创建角色"""
        try:
            if role.name in self.roles:
                logger.warning(f"Role already exists: {role.name}")
                return False

            # 验证权限是否存在
            invalid_permissions = role.permissions - set(self.permissions.keys())
            if invalid_permissions:
                logger.error(
                    f"Invalid permissions in role {role.name}: {invalid_permissions}"
                )
                return False

            self.roles[role.name] = role
            self.cache.clear()

            if self.audit_logger:
                asyncio.create_task(
                    self.audit_logger.log_event(
                        AuditEventType.ROLE_CHANGE,
                        f"Created role: {role.name}",
                        component="enhanced_permissions",
                        details=role.to_dict(),
                    )
                )

            logger.info(f"Created role: {role.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to create role {role.name}: {e}")
            return False

    def update_role(self, name: str, role: Role) -> bool:
        """更新角色"""
        try:
            if name not in self.roles:
                logger.warning(f"Role not found: {name}")
                return False

            # 验证权限是否存在
            invalid_permissions = role.permissions - set(self.permissions.keys())
            if invalid_permissions:
                logger.error(
                    f"Invalid permissions in role {name}: {invalid_permissions}"
                )
                return False

            old_role = self.roles[name]
            self.roles[name] = role
            self.cache.clear()

            if self.audit_logger:
                asyncio.create_task(
                    self.audit_logger.log_event(
                        AuditEventType.ROLE_CHANGE,
                        f"Updated role: {name}",
                        component="enhanced_permissions",
                        details={"old": old_role.to_dict(), "new": role.to_dict()},
                    )
                )

            logger.info(f"Updated role: {name}")
            return True

        except Exception as e:
            logger.error(f"Failed to update role {name}: {e}")
            return False

    def delete_role(self, name: str) -> bool:
        """删除角色"""
        try:
            if name not in self.roles:
                logger.warning(f"Role not found: {name}")
                return False

            role = self.roles.pop(name)

            # 从所有用户中移除该角色
            for user_id in list(self.user_roles.keys()):
                self.user_roles[user_id].discard(name)
                if not self.user_roles[user_id]:
                    del self.user_roles[user_id]

            self.cache.clear()

            if self.audit_logger:
                asyncio.create_task(
                    self.audit_logger.log_event(
                        AuditEventType.ROLE_CHANGE,
                        f"Deleted role: {name}",
                        component="enhanced_permissions",
                        details=role.to_dict(),
                    )
                )

            logger.info(f"Deleted role: {name}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete role {name}: {e}")
            return False

    def get_role(self, name: str) -> Optional[Role]:
        """获取角色"""
        return self.roles.get(name)

    def list_roles(self) -> List[Role]:
        """列出所有角色"""
        return list(self.roles.values())

    # ================================
    # 用户角色管理
    # ================================

    def assign_role(self, user_id: str, role_name: str) -> bool:
        """为用户分配角色"""
        try:
            if role_name not in self.roles:
                logger.warning(f"Role not found: {role_name}")
                return False

            self.user_roles[user_id].add(role_name)
            self.cache.clear()

            if self.audit_logger:
                asyncio.create_task(
                    self.audit_logger.log_event(
                        AuditEventType.ROLE_ASSIGNMENT,
                        f"Assigned role {role_name} to user {user_id}",
                        user_id=user_id,
                        component="enhanced_permissions",
                        details={"role": role_name},
                    )
                )

            logger.info(f"Assigned role {role_name} to user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to assign role {role_name} to user {user_id}: {e}")
            return False

    def revoke_role(self, user_id: str, role_name: str) -> bool:
        """撤销用户角色"""
        try:
            if user_id not in self.user_roles:
                logger.warning(f"User not found: {user_id}")
                return False

            if role_name not in self.user_roles[user_id]:
                logger.warning(f"User {user_id} does not have role {role_name}")
                return False

            self.user_roles[user_id].discard(role_name)
            if not self.user_roles[user_id]:
                del self.user_roles[user_id]

            self.cache.clear()

            if self.audit_logger:
                asyncio.create_task(
                    self.audit_logger.log_event(
                        AuditEventType.ROLE_REVOCATION,
                        f"Revoked role {role_name} from user {user_id}",
                        user_id=user_id,
                        component="enhanced_permissions",
                        details={"role": role_name},
                    )
                )

            logger.info(f"Revoked role {role_name} from user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to revoke role {role_name} from user {user_id}: {e}")
            return False

    def get_user_roles(self, user_id: str) -> Set[str]:
        """获取用户角色"""
        return self.user_roles.get(user_id, set()).copy()

    def get_user_permissions(self, user_id: str) -> Set[str]:
        """获取用户的所有权限"""
        permissions = set()
        user_roles = self.get_user_roles(user_id)

        for role_name in user_roles:
            role = self.roles.get(role_name)
            if role and role.is_active:
                permissions.update(role.permissions)
                # 递归获取父角色权限
                permissions.update(self._get_inherited_permissions(role))

        return permissions

    def _get_inherited_permissions(self, role: Role) -> Set[str]:
        """获取继承的权限"""
        inherited = set()
        for parent_role_name in role.parent_roles:
            parent_role = self.roles.get(parent_role_name)
            if parent_role and parent_role.is_active:
                inherited.update(parent_role.permissions)
                inherited.update(self._get_inherited_permissions(parent_role))
        return inherited

    # ================================
    # 策略规则管理
    # ================================

    def create_policy_rule(self, rule: PolicyRule) -> bool:
        """创建策略规则"""
        try:
            if rule.name in self.policy_rules:
                logger.warning(f"Policy rule already exists: {rule.name}")
                return False

            self.policy_rules[rule.name] = rule
            self.cache.clear()

            if self.audit_logger:
                asyncio.create_task(
                    self.audit_logger.log_event(
                        AuditEventType.POLICY_CHANGE,
                        f"Created policy rule: {rule.name}",
                        component="enhanced_permissions",
                        details=rule.to_dict(),
                    )
                )

            logger.info(f"Created policy rule: {rule.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to create policy rule {rule.name}: {e}")
            return False

    def delete_policy_rule(self, name: str) -> bool:
        """删除策略规则"""
        try:
            if name not in self.policy_rules:
                logger.warning(f"Policy rule not found: {name}")
                return False

            rule = self.policy_rules.pop(name)
            self.cache.clear()

            if self.audit_logger:
                asyncio.create_task(
                    self.audit_logger.log_event(
                        AuditEventType.POLICY_CHANGE,
                        f"Deleted policy rule: {name}",
                        component="enhanced_permissions",
                        details=rule.to_dict(),
                    )
                )

            logger.info(f"Deleted policy rule: {name}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete policy rule {name}: {e}")
            return False

    # ================================
    # 权限检查
    # ================================

    async def check_permission(
        self, request: AccessRequest, security_context: Optional[Dict[str, Any]] = None
    ) -> AccessResult:
        """检查权限"""
        start_time = time.time()
        self.stats["total_checks"] += 1

        try:
            # 生成缓存键
            cache_key = self._generate_cache_key(request)

            # 检查缓存
            cached_result = self.cache.get(cache_key)
            if cached_result:
                self.stats["cache_hits"] += 1
                return cached_result

            self.stats["cache_misses"] += 1

            # 构建评估上下文
            context = self._build_evaluation_context(request, security_context)

            # 执行权限检查
            result = await self._evaluate_permission(request, context)

            # 计算评估时间
            evaluation_time = time.time() - start_time
            result.evaluation_time = evaluation_time
            self.stats["evaluation_time_total"] += evaluation_time

            # 更新统计
            if result.granted:
                self.stats["allowed_requests"] += 1
            else:
                self.stats["denied_requests"] += 1

            # 缓存结果
            self.cache.set(cache_key, result)

            # 记录审计日志
            if self.audit_logger:
                await self.audit_logger.log_event(
                    AuditEventType.ACCESS_CONTROL,
                    f"Permission check: {result.decision.value}",
                    user_id=request.user_id,
                    component="enhanced_permissions",
                    details={"request": request.to_dict(), "result": result.to_dict()},
                )

            return result

        except Exception as e:
            logger.error(f"Permission check failed: {e}")
            evaluation_time = time.time() - start_time

            return AccessResult(
                decision=AccessDecision.DENY,
                reason=f"Permission check failed: {str(e)}",
                evaluation_time=evaluation_time,
            )

    def _generate_cache_key(self, request: AccessRequest) -> str:
        """生成缓存键"""
        key_data = f"{request.user_id}:{request.resource}:{request.action}"
        return hashlib.md5(key_data.encode()).hexdigest()

    def _build_evaluation_context(
        self, request: AccessRequest, security_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """构建评估上下文"""
        context = {
            "user_id": request.user_id,
            "resource": request.resource,
            "action": request.action,
            "timestamp": request.timestamp,
            "ip_address": request.ip_address,
            "user_agent": request.user_agent,
            "session_id": request.session_id,
        }

        # 添加用户角色信息
        user_roles = self.get_user_roles(request.user_id)
        context["user_roles"] = list(user_roles)
        context["user_role"] = list(user_roles)[0] if user_roles else "guest"

        # 添加用户权限信息
        user_permissions = self.get_user_permissions(request.user_id)
        context["user_permissions"] = list(user_permissions)

        # 添加请求上下文
        context.update(request.context)

        # 添加安全上下文
        if security_context:
            context.update(security_context)

        return context

    async def _evaluate_permission(
        self, request: AccessRequest, context: Dict[str, Any]
    ) -> AccessResult:
        """评估权限"""
        # 1. 检查策略规则
        policy_result = self._evaluate_policy_rules(context)
        if policy_result.decision != AccessDecision.ABSTAIN:
            return policy_result

        # 2. 检查基于角色的权限
        rbac_result = self._evaluate_rbac(request, context)
        if rbac_result.decision != AccessDecision.ABSTAIN:
            return rbac_result

        # 3. 检查基于属性的权限
        abac_result = self._evaluate_abac(request, context)
        if abac_result.decision != AccessDecision.ABSTAIN:
            return abac_result

        # 4. 默认拒绝
        return AccessResult(
            decision=AccessDecision.DENY,
            reason="No matching permission found - default deny",
        )

    def _evaluate_policy_rules(self, context: Dict[str, Any]) -> AccessResult:
        """评估策略规则"""
        # 按优先级排序
        sorted_rules = sorted(
            [rule for rule in self.policy_rules.values() if rule.is_active],
            key=lambda r: r.priority,
            reverse=True,
        )

        for rule in sorted_rules:
            try:
                if self.condition_evaluator.evaluate(rule.condition, context):
                    if rule.effect == PolicyEffect.PERMIT:
                        return AccessResult(
                            decision=AccessDecision.ALLOW,
                            reason=f"Policy rule allowed: {rule.name}",
                            conditions_evaluated=[rule.name],
                        )
                    elif rule.effect == PolicyEffect.DENY:
                        return AccessResult(
                            decision=AccessDecision.DENY,
                            reason=f"Policy rule denied: {rule.name}",
                            conditions_evaluated=[rule.name],
                        )
            except Exception as e:
                logger.error(f"Policy rule evaluation failed for {rule.name}: {e}")

        return AccessResult(
            decision=AccessDecision.ABSTAIN, reason="No policy rules matched"
        )

    def _evaluate_rbac(
        self, request: AccessRequest, context: Dict[str, Any]
    ) -> AccessResult:
        """评估基于角色的访问控制"""
        user_permissions = set(context.get("user_permissions", []))

        # 检查是否有匹配的权限
        for perm_name, permission in self.permissions.items():
            if perm_name in user_permissions:
                # 检查权限是否匹配资源和动作
                if self._permission_matches_request(permission, request):
                    return AccessResult(
                        decision=AccessDecision.ALLOW,
                        reason=f"RBAC permission granted: {perm_name}",
                        permissions_used=[perm_name],
                    )

        return AccessResult(
            decision=AccessDecision.ABSTAIN, reason="No RBAC permissions matched"
        )

    def _evaluate_abac(
        self, request: AccessRequest, context: Dict[str, Any]
    ) -> AccessResult:
        """评估基于属性的访问控制"""
        # 简化的ABAC实现
        # 检查特殊条件

        # 资源所有者检查
        resource_owner = context.get("resource_owner")
        if resource_owner and resource_owner == request.user_id:
            return AccessResult(
                decision=AccessDecision.ALLOW,
                reason="Resource owner access granted",
                conditions_evaluated=["resource_owner"],
            )

        # 时间限制检查
        if not self.condition_evaluator.evaluate(
            "time_between('06:00', '23:00')", context
        ):
            return AccessResult(
                decision=AccessDecision.DENY,
                reason="Access denied outside allowed hours",
                conditions_evaluated=["time_restriction"],
            )

        return AccessResult(
            decision=AccessDecision.ABSTAIN, reason="No ABAC conditions matched"
        )

    def _permission_matches_request(
        self, permission: Permission, request: AccessRequest
    ) -> bool:
        """检查权限是否匹配请求"""
        # 检查动作类型
        action_mapping = {
            "read": [PermissionType.READ, PermissionType.ADMIN],
            "write": [PermissionType.WRITE, PermissionType.ADMIN],
            "delete": [PermissionType.DELETE, PermissionType.ADMIN],
            "execute": [PermissionType.EXECUTE, PermissionType.ADMIN],
            "create": [PermissionType.CREATE, PermissionType.ADMIN],
            "update": [PermissionType.UPDATE, PermissionType.ADMIN],
        }

        required_permissions = action_mapping.get(request.action.lower(), [])
        if permission.type not in required_permissions:
            return False

        # 检查资源模式
        if not permission.matches_resource(request.resource):
            return False

        return True

    # ================================
    # 统计和监控
    # ================================

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        stats = self.stats.copy()
        stats.update(
            {
                "permissions_count": len(self.permissions),
                "roles_count": len(self.roles),
                "users_count": len(self.user_roles),
                "policy_rules_count": len(self.policy_rules),
                "cache_size": len(self.cache.cache),
                "average_evaluation_time": (
                    self.stats["evaluation_time_total"]
                    / max(self.stats["total_checks"], 1)
                ),
            }
        )
        return stats

    def clear_cache(self) -> None:
        """清空缓存"""
        self.cache.clear()
        logger.info("Permission cache cleared")

    def cleanup_expired_cache(self) -> None:
        """清理过期缓存"""
        self.cache.cleanup_expired()


# 默认权限管理器实例
_default_permission_manager = None


def get_permission_manager() -> EnhancedPermissionManager:
    """获取默认权限管理器"""
    global _default_permission_manager
    if _default_permission_manager is None:
        _default_permission_manager = EnhancedPermissionManager()
    return _default_permission_manager


# 装饰器
def require_permission(permission: str, resource: str = "*"):
    """权限检查装饰器"""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 从参数中提取用户信息
            user_id = (
                kwargs.get("user_id") or getattr(args[0], "user_id", None)
                if args
                else None
            )

            if not user_id:
                raise PermissionError("User ID not found in request")

            # 创建访问请求
            request = AccessRequest(
                user_id=user_id, resource=resource, action=permission
            )

            # 检查权限
            manager = get_permission_manager()
            result = await manager.check_permission(request)

            if not result.granted:
                raise PermissionError(f"Permission denied: {result.reason}")

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_role(role: str):
    """角色检查装饰器"""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 从参数中提取用户信息
            user_id = (
                kwargs.get("user_id") or getattr(args[0], "user_id", None)
                if args
                else None
            )

            if not user_id:
                raise PermissionError("User ID not found in request")

            # 检查角色
            manager = get_permission_manager()
            user_roles = manager.get_user_roles(user_id)

            if role not in user_roles:
                raise PermissionError(f"Required role not found: {role}")

            return await func(*args, **kwargs)

        return wrapper

    return decorator


# 便捷函数
async def check_user_permission(
    user_id: str, resource: str, action: str, context: Optional[Dict[str, Any]] = None
) -> bool:
    """检查用户权限的便捷函数"""
    request = AccessRequest(
        user_id=user_id, resource=resource, action=action, context=context or {}
    )

    manager = get_permission_manager()
    result = await manager.check_permission(request)
    return result.granted


def has_role(user_id: str, role: str) -> bool:
    """检查用户是否具有指定角色"""
    manager = get_permission_manager()
    user_roles = manager.get_user_roles(user_id)
    return role in user_roles


def get_user_effective_permissions(user_id: str) -> Set[str]:
    """获取用户的有效权限"""
    manager = get_permission_manager()
    return manager.get_user_permissions(user_id)
