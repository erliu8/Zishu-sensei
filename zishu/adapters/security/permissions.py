"""
Zishu-sensei 权限控制系统
提供完整的权限管理、角色控制和访问控制功能
"""

import asyncio
import time
import fnmatch
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from datetime import datetime, timedelta
from enum import Enum
from functools import wraps
from typing import (
    Any, Callable, Dict, List, Optional, Set, Union, 
    TYPE_CHECKING, Tuple, Protocol
)
from dataclasses import dataclass, field
import logging
import threading
import json

if TYPE_CHECKING:
    from ...api.security import SecurityContext, SecurityLevel

logger = logging.getLogger(__name__)


class Permission(Enum):
    """权限枚举类"""
    # 基础权限
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    EXECUTE = "execute"
    
    # 管理权限
    ADMIN = "admin"
    USER_MANAGE = "user_manage"
    ROLE_MANAGE = "role_manage"
    
    # 模型相关权限
    MODEL_ACCESS = "model_access"
    MODEL_TRAIN = "model_train"
    MODEL_DEPLOY = "model_deploy"
    MODEL_DELETE = "model_delete"
    
    # 适配器权限
    ADAPTER_MANAGE = "adapter_manage"
    ADAPTER_INSTALL = "adapter_install"
    ADAPTER_UNINSTALL = "adapter_uninstall"
    ADAPTER_CONFIG = "adapter_config"
    
    # 训练权限
    TRAINING_ACCESS = "training_access"
    TRAINING_START = "training_start"
    TRAINING_STOP = "training_stop"
    TRAINING_DELETE = "training_delete"
    
    # 系统权限
    SYSTEM_CONFIG = "system_config"
    SYSTEM_MONITOR = "system_monitor"
    SYSTEM_BACKUP = "system_backup"
    SYSTEM_RESTORE = "system_restore"


class Role(Enum):
    """角色枚举类"""
    ADMIN = "admin"
    DEVELOPER = "developer"
    ANALYST = "analyst"
    USER = "user"
    GUEST = "guest"


@dataclass
class PermissionRule:
    """权限规则"""
    name: str
    description: str
    required_permissions: Set[Permission]
    required_roles: Set[Role] = field(default_factory=set)
    required_security_level: Optional['SecurityLevel'] = None
    resource_filter: Optional[Callable] = None
    conditions: List[Callable] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class AccessRequest:
    """访问请求"""
    user_id: str
    resource: str
    action: str
    context: Optional[Dict[str, Any]] = None
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class AccessResult:
    """访问结果"""
    granted: bool
    reason: str = ""
    required_permissions: Set[Permission] = field(default_factory=set)
    required_roles: Set[Role] = field(default_factory=set)
    timestamp: datetime = field(default_factory=datetime.now)


class PermissionProtocol(Protocol):
    """权限检查协议"""
    
    def check_permission(self, context: 'SecurityContext', 
                        permission: Permission) -> bool:
        ...
    
    def check_role(self, context: 'SecurityContext', role: Role) -> bool:
        ...


class BasePermissionChecker(ABC):
    """基础权限检查器抽象类"""
    
    @abstractmethod
    def check(self, context: 'SecurityContext', 
              resource: str, action: str) -> AccessResult:
        """检查权限"""
        pass
    
    @abstractmethod
    def get_required_permissions(self, resource: str, action: str) -> Set[Permission]:
        """获取所需权限"""
        pass


class RoleBasedPermissionChecker(BasePermissionChecker):
    """基于角色的权限检查器"""
    
    def __init__(self):
        self.role_permissions = self._init_role_permissions()
        self.resource_rules = {}
        self.permission_cache = {}
        self.cache_ttl = 300  # 5分钟缓存
        self._lock = threading.RLock()
    
    def _init_role_permissions(self) -> Dict[Role, Set[Permission]]:
        """初始化角色权限映射"""
        return {
            Role.ADMIN: {
                Permission.READ, Permission.WRITE, Permission.DELETE, Permission.EXECUTE,
                Permission.ADMIN, Permission.USER_MANAGE, Permission.ROLE_MANAGE,
                Permission.MODEL_ACCESS, Permission.MODEL_TRAIN, Permission.MODEL_DEPLOY, Permission.MODEL_DELETE,
                Permission.ADAPTER_MANAGE, Permission.ADAPTER_INSTALL, Permission.ADAPTER_UNINSTALL, Permission.ADAPTER_CONFIG,
                Permission.TRAINING_ACCESS, Permission.TRAINING_START, Permission.TRAINING_STOP, Permission.TRAINING_DELETE,
                Permission.SYSTEM_CONFIG, Permission.SYSTEM_MONITOR, Permission.SYSTEM_BACKUP, Permission.SYSTEM_RESTORE
            },
            Role.DEVELOPER: {
                Permission.READ, Permission.WRITE, Permission.EXECUTE,
                Permission.MODEL_ACCESS, Permission.MODEL_TRAIN, Permission.MODEL_DEPLOY,
                Permission.ADAPTER_MANAGE, Permission.ADAPTER_CONFIG,
                Permission.TRAINING_ACCESS, Permission.TRAINING_START, Permission.TRAINING_STOP,
                Permission.SYSTEM_MONITOR
            },
            Role.ANALYST: {
                Permission.READ, Permission.MODEL_ACCESS,
                Permission.TRAINING_ACCESS, Permission.SYSTEM_MONITOR
            },
            Role.USER: {
                Permission.READ, Permission.MODEL_ACCESS
            },
            Role.GUEST: {
                Permission.READ
            }
        }
    
    def add_resource_rule(self, resource_pattern: str, rule: PermissionRule):
        """添加资源权限规则"""
        with self._lock:
            if resource_pattern not in self.resource_rules:
                self.resource_rules[resource_pattern] = []
            self.resource_rules[resource_pattern].append(rule)
            self._clear_cache()
    
    def remove_resource_rule(self, resource_pattern: str, rule_name: str):
        """移除资源权限规则"""
        with self._lock:
            if resource_pattern in self.resource_rules:
                self.resource_rules[resource_pattern] = [
                    rule for rule in self.resource_rules[resource_pattern]
                    if rule.name != rule_name
                ]
                if not self.resource_rules[resource_pattern]:
                    del self.resource_rules[resource_pattern]
                self._clear_cache()
    
    def _clear_cache(self):
        """清空权限缓存"""
        self.permission_cache.clear()
    
    def _get_user_permissions(self, context: 'SecurityContext') -> Set[Permission]:
        """获取用户权限"""
        cache_key = f"user_perms_{context.user_id}_{hash(frozenset(context.permissions))}"
        
        # 检查缓存
        if cache_key in self.permission_cache:
            cached_time, permissions = self.permission_cache[cache_key]
            if time.time() - cached_time < self.cache_ttl:
                return permissions
        
        # 基于显式权限
        permissions = set(context.permissions)
        
        # 基于角色权限
        user_roles = self._get_user_roles(context)
        for role in user_roles:
            if role in self.role_permissions:
                permissions.update(self.role_permissions[role])
        
        # 缓存结果
        self.permission_cache[cache_key] = (time.time(), permissions)
        return permissions
    
    def _get_user_roles(self, context: 'SecurityContext') -> Set[Role]:
        """获取用户角色"""
        roles = set()
        
        # 从权限中推断角色
        user_permissions = set(context.permissions)
        
        for role, role_permissions in self.role_permissions.items():
            if role_permissions.issubset(user_permissions):
                roles.add(role)
        
        return roles
    
    def _match_resource_rules(self, resource: str) -> List[PermissionRule]:
        """匹配资源规则"""
        matched_rules = []
        
        for pattern, rules in self.resource_rules.items():
            if self._match_pattern(pattern, resource):
                matched_rules.extend(rules)
        
        return matched_rules
    
    def _match_pattern(self, pattern: str, resource: str) -> bool:
        """简单的模式匹配"""
        import fnmatch
        return fnmatch.fnmatch(resource, pattern)
    
    def check(self, context: 'SecurityContext', 
              resource: str, action: str) -> AccessResult:
        """检查权限"""
        try:
            # 获取用户权限
            user_permissions = self._get_user_permissions(context)
            user_roles = self._get_user_roles(context)
            
            # 检查资源特定规则
            resource_rules = self._match_resource_rules(resource)
            
            if resource_rules:
                for rule in resource_rules:
                    # 检查所需权限
                    if rule.required_permissions and not rule.required_permissions.issubset(user_permissions):
                        return AccessResult(
                            granted=False,
                            reason=f"Missing required permissions for {rule.name}",
                            required_permissions=rule.required_permissions
                        )
                    
                    # 检查所需角色
                    if rule.required_roles and not rule.required_roles.intersection(user_roles):
                        return AccessResult(
                            granted=False,
                            reason=f"Missing required roles for {rule.name}",
                            required_roles=rule.required_roles
                        )
                    
                    # 检查安全级别
                    if rule.required_security_level:
                        from ...api.security import SecurityLevel
                        user_level_value = list(SecurityLevel).index(context.security_level)
                        required_level_value = list(SecurityLevel).index(rule.required_security_level)
                        
                        if user_level_value < required_level_value:
                            return AccessResult(
                                granted=False,
                                reason=f"Insufficient security level for {rule.name}"
                            )
                    
                    # 检查自定义条件
                    for condition in rule.conditions:
                        if not condition(context, resource, action):
                            return AccessResult(
                                granted=False,
                                reason=f"Custom condition failed for {rule.name}"
                            )
            else:
                # 默认权限检查
                required_permissions = self.get_required_permissions(resource, action)
                if not required_permissions.issubset(user_permissions):
                    return AccessResult(
                        granted=False,
                        reason="Insufficient permissions",
                        required_permissions=required_permissions
                    )
            
            return AccessResult(granted=True, reason="Access granted")
        
        except Exception as e:
            logger.error(f"Permission check error: {str(e)}")
            return AccessResult(granted=False, reason=f"Permission check failed: {str(e)}")
    
    def get_required_permissions(self, resource: str, action: str) -> Set[Permission]:
        """获取所需权限"""
        # 基础操作权限映射
        action_permissions = {
            "read": {Permission.READ},
            "write": {Permission.WRITE},
            "delete": {Permission.DELETE},
            "execute": {Permission.EXECUTE},
            "admin": {Permission.ADMIN},
            "train": {Permission.MODEL_TRAIN},
            "deploy": {Permission.MODEL_DEPLOY},
        }
        
        # 资源特定权限
        if resource.startswith("model/"):
            base_perms = action_permissions.get(action, {Permission.READ})
            base_perms.add(Permission.MODEL_ACCESS)
            return base_perms
        elif resource.startswith("adapter/"):
            base_perms = action_permissions.get(action, {Permission.READ})
            base_perms.add(Permission.ADAPTER_MANAGE)
            return base_perms
        elif resource.startswith("training/"):
            base_perms = action_permissions.get(action, {Permission.READ})
            base_perms.add(Permission.TRAINING_ACCESS)
            return base_perms
        elif resource.startswith("system/"):
            base_perms = action_permissions.get(action, {Permission.READ})
            base_perms.add(Permission.SYSTEM_CONFIG)
            return base_perms
        
        return action_permissions.get(action, {Permission.READ})


class PermissionManager:
    """权限管理器"""
    
    def __init__(self):
        self.checker = RoleBasedPermissionChecker()
        self.access_logs = deque(maxlen=10000)
        self.permission_cache = {}
        self.cache_ttl = 300
        self._lock = threading.RLock()
    
    def check_permission(self, context: 'SecurityContext', 
                        resource: str, action: str) -> AccessResult:
        """检查权限"""
        request = AccessRequest(
            user_id=context.user_id,
            resource=resource,
            action=action,
            context={"ip_address": context.ip_address, "session_id": context.session_id}
        )
        
        result = self.checker.check(context, resource, action)
        
        # 记录访问日志
        self._log_access(request, result)
        
        return result
    
    def require_permission(self, permission: Permission):
        """权限装饰器"""
        def decorator(func: Callable):
            @wraps(func)
            def wrapper(*args, **kwargs):
                # 尝试从参数中获取 SecurityContext
                context = None
                for arg in args:
                    if hasattr(arg, 'user_id') and hasattr(arg, 'permissions'):
                        context = arg
                        break
                
                if 'context' in kwargs:
                    context = kwargs['context']
                
                if not context:
                    raise ValueError("SecurityContext not found in function parameters")
                
                # 检查权限
                if permission.value not in [p.value if hasattr(p, 'value') else str(p) for p in context.permissions]:
                    raise PermissionError(f"Access denied: missing {permission.value} permission")
                
                return func(*args, **kwargs)
            return wrapper
        return decorator
    
    def require_role(self, role: Role):
        """角色装饰器"""
        def decorator(func: Callable):
            @wraps(func)
            def wrapper(*args, **kwargs):
                # 尝试从参数中获取 SecurityContext
                context = None
                for arg in args:
                    if hasattr(arg, 'user_id') and hasattr(arg, 'permissions'):
                        context = arg
                        break
                
                if 'context' in kwargs:
                    context = kwargs['context']
                
                if not context:
                    raise ValueError("SecurityContext not found in function parameters")
                
                # 检查角色
                user_roles = self.checker._get_user_roles(context)
                if role not in user_roles:
                    raise PermissionError(f"Access denied: missing {role.value} role")
                
                return func(*args, **kwargs)
            return wrapper
        return decorator
    
    def require_resource_access(self, resource: str, action: str):
        """资源访问装饰器"""
        def decorator(func: Callable):
            @wraps(func)
            def wrapper(*args, **kwargs):
                # 尝试从参数中获取 SecurityContext
                context = None
                for arg in args:
                    if hasattr(arg, 'user_id') and hasattr(arg, 'permissions'):
                        context = arg
                        break
                
                if 'context' in kwargs:
                    context = kwargs['context']
                
                if not context:
                    raise ValueError("SecurityContext not found in function parameters")
                
                # 检查资源访问权限
                result = self.check_permission(context, resource, action)
                if not result.granted:
                    raise PermissionError(f"Access denied: {result.reason}")
                
                return func(*args, **kwargs)
            return wrapper
        return decorator
    
    def add_permission_rule(self, resource_pattern: str, rule: PermissionRule):
        """添加权限规则"""
        self.checker.add_resource_rule(resource_pattern, rule)
    
    def remove_permission_rule(self, resource_pattern: str, rule_name: str):
        """移除权限规则"""
        self.checker.remove_resource_rule(resource_pattern, rule_name)
    
    def get_user_permissions(self, context: 'SecurityContext') -> Set[Permission]:
        """获取用户权限"""
        return self.checker._get_user_permissions(context)
    
    def get_user_roles(self, context: 'SecurityContext') -> Set[Role]:
        """获取用户角色"""
        return self.checker._get_user_roles(context)
    
    def _log_access(self, request: AccessRequest, result: AccessResult):
        """记录访问日志"""
        with self._lock:
            log_entry = {
                "request": {
                    "user_id": request.user_id,
                    "resource": request.resource,
                    "action": request.action,
                    "timestamp": request.timestamp.isoformat(),
                    "context": request.context
                },
                "result": {
                    "granted": result.granted,
                    "reason": result.reason,
                    "timestamp": result.timestamp.isoformat()
                }
            }
            
            self.access_logs.append(log_entry)
            
            # 记录到日志系统
            if result.granted:
                logger.info(f"Access granted: {request.user_id} -> {request.resource}:{request.action}")
            else:
                logger.warning(f"Access denied: {request.user_id} -> {request.resource}:{request.action} - {result.reason}")
    
    def get_access_logs(self, user_id: Optional[str] = None, 
                       resource: Optional[str] = None, 
                       limit: int = 100) -> List[Dict[str, Any]]:
        """获取访问日志"""
        with self._lock:
            logs = list(self.access_logs)
        
        if user_id:
            logs = [log for log in logs if log["request"]["user_id"] == user_id]
        
        if resource:
            logs = [log for log in logs if resource in log["request"]["resource"]]
        
        return logs[-limit:]


class PermissionMiddleware:
    """权限中间件"""
    
    def __init__(self, permission_manager: PermissionManager):
        self.permission_manager = permission_manager
        
    async def __call__(self, request, call_next):
        """异步中间件处理"""
        # 从请求中提取安全上下文
        context = getattr(request.state, 'security_context', None)
        
        if not context:
            try:
                from fastapi import HTTPException
                raise HTTPException(status_code=401, detail="Authentication required")
            except ImportError:
                raise Exception("Authentication required")
        
        # 根据请求路径和方法确定资源和动作
        resource = self._extract_resource(request)
        action = self._extract_action(request)
        
        # 检查权限
        result = self.permission_manager.check_permission(context, resource, action)
        
        if not result.granted:
            try:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=403, 
                    detail=f"Access denied: {result.reason}"
                )
            except ImportError:
                raise Exception(f"Access denied: {result.reason}")
        
        # 继续处理请求
        response = await call_next(request)
        return response
    
    def _extract_resource(self, request) -> str:
        """从请求中提取资源"""
        path = request.url.path
        
        # 简单的路径到资源映射
        if path.startswith("/api/models/"):
            return f"model{path[11:]}"  # 去掉 /api/models
        elif path.startswith("/api/adapters/"):
            return f"adapter{path[13:]}"  # 去掉 /api/adapters
        elif path.startswith("/api/training/"):
            return f"training{path[13:]}"  # 去掉 /api/training
        elif path.startswith("/api/system/"):
            return f"system{path[11:]}"  # 去掉 /api/system
        else:
            return path
    
    def _extract_action(self, request) -> str:
        """从请求中提取动作"""
        method = request.method.lower()
        
        method_mapping = {
            "get": "read",
            "post": "write",
            "put": "write",
            "patch": "write",
            "delete": "delete"
        }
        
        return method_mapping.get(method, "read")


# 全局权限管理器实例
permission_manager = PermissionManager()

# 常用装饰器
require_admin = permission_manager.require_role(Role.ADMIN)
require_developer = permission_manager.require_role(Role.DEVELOPER)
require_read = permission_manager.require_permission(Permission.READ)
require_write = permission_manager.require_permission(Permission.WRITE)
require_model_access = permission_manager.require_permission(Permission.MODEL_ACCESS)
require_adapter_manage = permission_manager.require_permission(Permission.ADAPTER_MANAGE)


def create_permission_rule(name: str, description: str,
                          permissions: List[Permission],
                          roles: List[Role] = None,
                          security_level: 'SecurityLevel' = None,
                          conditions: List[Callable] = None) -> PermissionRule:
    """创建权限规则的便捷函数"""
    return PermissionRule(
        name=name,
        description=description,
        required_permissions=set(permissions),
        required_roles=set(roles or []),
        required_security_level=security_level,
        conditions=conditions or []
    )


# 使用示例
if __name__ == "__main__":
    # 创建示例权限规则
    model_training_rule = create_permission_rule(
        name="model_training",
        description="模型训练权限",
        permissions=[Permission.MODEL_TRAIN, Permission.TRAINING_ACCESS],
        roles=[Role.DEVELOPER, Role.ADMIN]
    )
    
    permission_manager.add_permission_rule("model/*/train", model_training_rule)
    
    print("权限控制系统初始化完成")
