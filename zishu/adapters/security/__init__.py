# 安全模块
"""
Zishu-sensei 安全模块
提供认证、授权、审计和沙箱等安全功能
"""

from .permissions import (
    Permission,
    Role,
    PermissionRule,
    AccessRequest,
    AccessResult,
    BasePermissionChecker,
    RoleBasedPermissionChecker,
    PermissionManager,
    PermissionMiddleware,
    permission_manager,
    require_admin,
    require_developer,
    require_read,
    require_write,
    require_model_access,
    require_adapter_manage,
    create_permission_rule
)

__all__ = [
    # 权限枚举和类
    'Permission',
    'Role',
    'PermissionRule',
    'AccessRequest',
    'AccessResult',
    
    # 权限检查器
    'BasePermissionChecker',
    'RoleBasedPermissionChecker',
    
    # 管理器和中间件
    'PermissionManager',
    'PermissionMiddleware',
    
    # 全局实例
    'permission_manager',
    
    # 装饰器
    'require_admin',
    'require_developer', 
    'require_read',
    'require_write',
    'require_model_access',
    'require_adapter_manage',
    
    # 工具函数
    'create_permission_rule'
]
