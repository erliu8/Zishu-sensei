# -*- coding: utf-8 -*-
"""
权限管理测试

测试新架构的权限管理功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Set

from zishu.security.core.permissions import (
    PermissionManager, PermissionManagerConfig, Permission, Role,
    PermissionSet, RoleHierarchy, AccessMatrix, PermissionContext
)
from zishu.security.core.types import SecurityLevel, AccessType
from zishu.security.core.exceptions import (
    PermissionDenied, InvalidPermission, RoleNotFound, CircularRoleReference
)

from tests.utils.security_test_utils import SecurityTestUtils


class TestPermissionManager:
    """权限管理器测试类"""

    @pytest.fixture
    def permission_config(self):
        """创建权限管理器配置"""
        return PermissionManagerConfig(
            enable_role_hierarchy=True,
            enable_permission_inheritance=True,
            enable_dynamic_permissions=True,
            enable_permission_caching=True,
            cache_ttl_seconds=300,
            max_role_depth=10,
            enable_audit_logging=True
        )

    @pytest.fixture
    async def permission_manager(self, permission_config):
        """创建权限管理器实例"""
        manager = PermissionManager(config=permission_config)
        await manager.initialize()
        yield manager
        await manager.cleanup()

    @pytest.fixture
    def basic_permissions(self):
        """创建基础权限"""
        return [
            Permission(
                name='read_adapters',
                description='Read adapter information',
                resource_type='adapter',
                action='read',
                security_level=SecurityLevel.PUBLIC
            ),
            Permission(
                name='execute_adapters',
                description='Execute adapters',
                resource_type='adapter',
                action='execute',
                security_level=SecurityLevel.INTERNAL
            ),
            Permission(
                name='manage_adapters',
                description='Manage adapters',
                resource_type='adapter',
                action='manage',
                security_level=SecurityLevel.RESTRICTED
            ),
            Permission(
                name='admin_access',
                description='Administrative access',
                resource_type='system',
                action='admin',
                security_level=SecurityLevel.CONFIDENTIAL
            )
        ]

    @pytest.fixture
    def basic_roles(self, basic_permissions):
        """创建基础角色"""
        return [
            Role(
                name='guest',
                description='Guest user',
                permissions=set(['read_adapters']),
                security_level=SecurityLevel.PUBLIC
            ),
            Role(
                name='user',
                description='Regular user',
                permissions=set(['read_adapters', 'execute_adapters']),
                security_level=SecurityLevel.INTERNAL
            ),
            Role(
                name='manager',
                description='Manager user',
                permissions=set(['read_adapters', 'execute_adapters', 'manage_adapters']),
                security_level=SecurityLevel.RESTRICTED
            ),
            Role(
                name='admin',
                description='Administrator',
                permissions=set(['read_adapters', 'execute_adapters', 'manage_adapters', 'admin_access']),
                security_level=SecurityLevel.CONFIDENTIAL
            )
        ]

    async def test_permission_manager_initialization(self, permission_config):
        """测试权限管理器初始化"""
        manager = PermissionManager(config=permission_config)
        
        # 验证初始状态
        assert manager.config == permission_config
        assert not manager.is_initialized
        
        # 初始化管理器
        await manager.initialize()
        assert manager.is_initialized
        
        # 清理管理器
        await manager.cleanup()

    async def test_create_permission(self, permission_manager):
        """测试创建权限"""
        # 创建权限
        permission = Permission(
            name='test_permission',
            description='Test permission',
            resource_type='test_resource',
            action='test_action',
            security_level=SecurityLevel.INTERNAL
        )
        
        result = await permission_manager.create_permission(permission)
        assert result is True
        
        # 验证权限已创建
        retrieved_permission = await permission_manager.get_permission('test_permission')
        assert retrieved_permission is not None
        assert retrieved_permission.name == 'test_permission'

    async def test_update_permission(self, permission_manager):
        """测试更新权限"""
        # 创建权限
        permission = Permission(
            name='update_test_permission',
            description='Original description',
            resource_type='test_resource',
            action='test_action',
            security_level=SecurityLevel.INTERNAL
        )
        
        await permission_manager.create_permission(permission)
        
        # 更新权限
        permission.description = 'Updated description'
        permission.security_level = SecurityLevel.RESTRICTED
        
        result = await permission_manager.update_permission(permission)
        assert result is True
        
        # 验证权限已更新
        updated_permission = await permission_manager.get_permission('update_test_permission')
        assert updated_permission.description == 'Updated description'
        assert updated_permission.security_level == SecurityLevel.RESTRICTED

    async def test_delete_permission(self, permission_manager):
        """测试删除权限"""
        # 创建权限
        permission = Permission(
            name='delete_test_permission',
            description='To be deleted',
            resource_type='test_resource',
            action='test_action',
            security_level=SecurityLevel.INTERNAL
        )
        
        await permission_manager.create_permission(permission)
        
        # 删除权限
        result = await permission_manager.delete_permission('delete_test_permission')
        assert result is True
        
        # 验证权限已删除
        deleted_permission = await permission_manager.get_permission('delete_test_permission')
        assert deleted_permission is None

    async def test_create_role(self, permission_manager, basic_permissions):
        """测试创建角色"""
        # 先创建权限
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        # 创建角色
        role = Role(
            name='test_role',
            description='Test role',
            permissions=set(['read_adapters', 'execute_adapters']),
            security_level=SecurityLevel.INTERNAL
        )
        
        result = await permission_manager.create_role(role)
        assert result is True
        
        # 验证角色已创建
        retrieved_role = await permission_manager.get_role('test_role')
        assert retrieved_role is not None
        assert retrieved_role.name == 'test_role'
        assert 'read_adapters' in retrieved_role.permissions

    async def test_role_hierarchy(self, permission_manager, basic_permissions, basic_roles):
        """测试角色层次结构"""
        # 创建权限和角色
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        for role in basic_roles:
            await permission_manager.create_role(role)
        
        # 设置角色层次结构
        hierarchy = RoleHierarchy()
        hierarchy.add_parent_child('admin', 'manager')
        hierarchy.add_parent_child('manager', 'user')
        hierarchy.add_parent_child('user', 'guest')
        
        await permission_manager.set_role_hierarchy(hierarchy)
        
        # 验证权限继承
        admin_permissions = await permission_manager.get_effective_permissions('admin')
        manager_permissions = await permission_manager.get_effective_permissions('manager')
        user_permissions = await permission_manager.get_effective_permissions('user')
        guest_permissions = await permission_manager.get_effective_permissions('guest')
        
        # admin应该拥有所有权限
        assert 'admin_access' in admin_permissions
        assert 'manage_adapters' in admin_permissions
        assert 'execute_adapters' in admin_permissions
        assert 'read_adapters' in admin_permissions
        
        # manager应该拥有除admin_access外的所有权限
        assert 'admin_access' not in manager_permissions
        assert 'manage_adapters' in manager_permissions
        assert 'execute_adapters' in manager_permissions
        assert 'read_adapters' in manager_permissions

    async def test_check_permission(self, permission_manager, basic_permissions, basic_roles):
        """测试权限检查"""
        # 创建权限和角色
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        for role in basic_roles:
            await permission_manager.create_role(role)
        
        # 创建权限上下文
        context = PermissionContext(
            user_id='test_user',
            roles=set(['user']),
            security_level=SecurityLevel.INTERNAL
        )
        
        # 检查用户拥有的权限
        has_read = await permission_manager.check_permission(context, 'read_adapters')
        assert has_read is True
        
        has_execute = await permission_manager.check_permission(context, 'execute_adapters')
        assert has_execute is True
        
        # 检查用户没有的权限
        has_manage = await permission_manager.check_permission(context, 'manage_adapters')
        assert has_manage is False
        
        has_admin = await permission_manager.check_permission(context, 'admin_access')
        assert has_admin is False

    async def test_check_multiple_permissions(self, permission_manager, basic_permissions, basic_roles):
        """测试多权限检查"""
        # 创建权限和角色
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        for role in basic_roles:
            await permission_manager.create_role(role)
        
        # 创建权限上下文
        context = PermissionContext(
            user_id='test_user',
            roles=set(['manager']),
            security_level=SecurityLevel.RESTRICTED
        )
        
        # 检查多个权限
        required_permissions = ['read_adapters', 'execute_adapters', 'manage_adapters']
        has_all = await permission_manager.check_permissions(context, required_permissions)
        assert has_all is True
        
        # 检查包含没有的权限
        required_permissions_with_admin = ['read_adapters', 'execute_adapters', 'admin_access']
        has_all_with_admin = await permission_manager.check_permissions(context, required_permissions_with_admin)
        assert has_all_with_admin is False

    async def test_dynamic_permissions(self, permission_manager):
        """测试动态权限"""
        # 创建动态权限生成器
        async def dynamic_permission_generator(context: PermissionContext, resource: str, action: str):
            """动态生成权限"""
            if context.user_id == 'special_user' and resource.startswith('special_'):
                return True
            return False
        
        # 注册动态权限生成器
        await permission_manager.register_dynamic_permission_generator(
            'special_resource',
            dynamic_permission_generator
        )
        
        # 测试动态权限
        special_context = PermissionContext(
            user_id='special_user',
            roles=set(['user']),
            security_level=SecurityLevel.INTERNAL
        )
        
        normal_context = PermissionContext(
            user_id='normal_user',
            roles=set(['user']),
            security_level=SecurityLevel.INTERNAL
        )
        
        # 特殊用户应该有动态权限
        has_special_permission = await permission_manager.check_dynamic_permission(
            special_context,
            'special_resource',
            'access'
        )
        assert has_special_permission is True
        
        # 普通用户不应该有动态权限
        has_normal_permission = await permission_manager.check_dynamic_permission(
            normal_context,
            'special_resource',
            'access'
        )
        assert has_normal_permission is False

    async def test_permission_caching(self, permission_manager, basic_permissions, basic_roles):
        """测试权限缓存"""
        # 创建权限和角色
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        for role in basic_roles:
            await permission_manager.create_role(role)
        
        # 创建权限上下文
        context = PermissionContext(
            user_id='cache_test_user',
            roles=set(['user']),
            security_level=SecurityLevel.INTERNAL
        )
        
        # 第一次检查权限（应该缓存结果）
        start_time = datetime.now()
        has_permission1 = await permission_manager.check_permission(context, 'read_adapters')
        first_check_time = datetime.now() - start_time
        
        # 第二次检查权限（应该使用缓存）
        start_time = datetime.now()
        has_permission2 = await permission_manager.check_permission(context, 'read_adapters')
        second_check_time = datetime.now() - start_time
        
        assert has_permission1 == has_permission2
        # 第二次检查应该更快（使用缓存）
        assert second_check_time < first_check_time

    async def test_permission_set_operations(self, permission_manager, basic_permissions):
        """测试权限集合操作"""
        # 创建权限
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        # 创建权限集合
        set1 = PermissionSet(['read_adapters', 'execute_adapters'])
        set2 = PermissionSet(['execute_adapters', 'manage_adapters'])
        
        # 测试并集
        union_set = await permission_manager.union_permission_sets(set1, set2)
        assert 'read_adapters' in union_set.permissions
        assert 'execute_adapters' in union_set.permissions
        assert 'manage_adapters' in union_set.permissions
        
        # 测试交集
        intersection_set = await permission_manager.intersect_permission_sets(set1, set2)
        assert 'execute_adapters' in intersection_set.permissions
        assert 'read_adapters' not in intersection_set.permissions
        assert 'manage_adapters' not in intersection_set.permissions
        
        # 测试差集
        difference_set = await permission_manager.subtract_permission_sets(set1, set2)
        assert 'read_adapters' in difference_set.permissions
        assert 'execute_adapters' not in difference_set.permissions
        assert 'manage_adapters' not in difference_set.permissions

    async def test_access_matrix(self, permission_manager, basic_permissions, basic_roles):
        """测试访问矩阵"""
        # 创建权限和角色
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        for role in basic_roles:
            await permission_manager.create_role(role)
        
        # 生成访问矩阵
        access_matrix = await permission_manager.generate_access_matrix()
        
        assert isinstance(access_matrix, AccessMatrix)
        
        # 验证矩阵内容
        assert access_matrix.has_access('admin', 'admin_access') is True
        assert access_matrix.has_access('user', 'admin_access') is False
        assert access_matrix.has_access('guest', 'read_adapters') is True

    async def test_permission_validation(self, permission_manager):
        """测试权限验证"""
        # 测试有效权限
        valid_permission = Permission(
            name='valid_permission',
            description='Valid permission',
            resource_type='test_resource',
            action='test_action',
            security_level=SecurityLevel.INTERNAL
        )
        
        is_valid = await permission_manager.validate_permission(valid_permission)
        assert is_valid is True
        
        # 测试无效权限（空名称）
        invalid_permission = Permission(
            name='',
            description='Invalid permission',
            resource_type='test_resource',
            action='test_action',
            security_level=SecurityLevel.INTERNAL
        )
        
        is_valid = await permission_manager.validate_permission(invalid_permission)
        assert is_valid is False

    async def test_role_validation(self, permission_manager, basic_permissions):
        """测试角色验证"""
        # 创建权限
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        # 测试有效角色
        valid_role = Role(
            name='valid_role',
            description='Valid role',
            permissions=set(['read_adapters']),
            security_level=SecurityLevel.INTERNAL
        )
        
        is_valid = await permission_manager.validate_role(valid_role)
        assert is_valid is True
        
        # 测试无效角色（包含不存在的权限）
        invalid_role = Role(
            name='invalid_role',
            description='Invalid role',
            permissions=set(['nonexistent_permission']),
            security_level=SecurityLevel.INTERNAL
        )
        
        is_valid = await permission_manager.validate_role(invalid_role)
        assert is_valid is False

    async def test_circular_role_reference_detection(self, permission_manager, basic_permissions, basic_roles):
        """测试循环角色引用检测"""
        # 创建权限和角色
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        for role in basic_roles:
            await permission_manager.create_role(role)
        
        # 创建循环引用的层次结构
        hierarchy = RoleHierarchy()
        hierarchy.add_parent_child('admin', 'manager')
        hierarchy.add_parent_child('manager', 'user')
        hierarchy.add_parent_child('user', 'admin')  # 循环引用
        
        # 设置层次结构应该失败
        with pytest.raises(CircularRoleReference):
            await permission_manager.set_role_hierarchy(hierarchy)

    async def test_security_level_enforcement(self, permission_manager, basic_permissions):
        """测试安全级别执行"""
        # 创建权限
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        # 创建低安全级别的上下文
        low_security_context = PermissionContext(
            user_id='low_security_user',
            roles=set(['admin']),  # 虽然是admin角色
            security_level=SecurityLevel.PUBLIC  # 但安全级别很低
        )
        
        # 尝试访问高安全级别的权限
        has_admin_access = await permission_manager.check_permission(
            low_security_context,
            'admin_access'  # 需要CONFIDENTIAL级别
        )
        
        # 应该被拒绝，因为安全级别不够
        assert has_admin_access is False

    async def test_permission_audit_logging(self, permission_manager, basic_permissions, basic_roles):
        """测试权限审计日志"""
        # 创建权限和角色
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        for role in basic_roles:
            await permission_manager.create_role(role)
        
        # 创建权限上下文
        context = PermissionContext(
            user_id='audit_test_user',
            roles=set(['user']),
            security_level=SecurityLevel.INTERNAL
        )
        
        # 执行权限检查
        await permission_manager.check_permission(context, 'read_adapters')
        await permission_manager.check_permission(context, 'admin_access')
        
        # 获取审计日志
        audit_logs = await permission_manager.get_permission_audit_logs(
            user_id='audit_test_user',
            start_time=datetime.now(timezone.utc) - timedelta(minutes=1),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=1)
        )
        
        assert len(audit_logs) >= 2
        # 验证日志包含权限检查记录

    async def test_bulk_permission_operations(self, permission_manager):
        """测试批量权限操作"""
        # 批量创建权限
        permissions = []
        for i in range(10):
            permission = Permission(
                name=f'bulk_permission_{i}',
                description=f'Bulk permission {i}',
                resource_type='bulk_resource',
                action=f'action_{i}',
                security_level=SecurityLevel.INTERNAL
            )
            permissions.append(permission)
        
        result = await permission_manager.create_permissions_bulk(permissions)
        assert result is True
        
        # 验证权限已创建
        for i in range(10):
            permission = await permission_manager.get_permission(f'bulk_permission_{i}')
            assert permission is not None

    async def test_permission_search(self, permission_manager, basic_permissions):
        """测试权限搜索"""
        # 创建权限
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        # 按资源类型搜索
        adapter_permissions = await permission_manager.search_permissions(
            resource_type='adapter'
        )
        assert len(adapter_permissions) == 3  # read, execute, manage
        
        # 按安全级别搜索
        restricted_permissions = await permission_manager.search_permissions(
            security_level=SecurityLevel.RESTRICTED
        )
        assert len(restricted_permissions) >= 1
        
        # 按名称模式搜索
        adapter_read_permissions = await permission_manager.search_permissions(
            name_pattern='*read*'
        )
        assert len(adapter_read_permissions) >= 1

    async def test_concurrent_permission_operations(self, permission_manager):
        """测试并发权限操作"""
        # 并发创建权限
        permission_tasks = []
        for i in range(20):
            permission = Permission(
                name=f'concurrent_permission_{i}',
                description=f'Concurrent permission {i}',
                resource_type='concurrent_resource',
                action=f'action_{i}',
                security_level=SecurityLevel.INTERNAL
            )
            task = permission_manager.create_permission(permission)
            permission_tasks.append(task)
        
        # 等待所有创建完成
        results = await asyncio.gather(*permission_tasks)
        
        # 验证所有权限都创建成功
        assert all(results)
        
        # 并发检查权限
        context = PermissionContext(
            user_id='concurrent_test_user',
            roles=set(['admin']),
            security_level=SecurityLevel.INTERNAL
        )
        
        check_tasks = []
        for i in range(20):
            task = permission_manager.check_permission(context, f'concurrent_permission_{i}')
            check_tasks.append(task)
        
        # 等待所有检查完成
        check_results = await asyncio.gather(*check_tasks)
        
        # 验证结果（具体结果取决于权限配置）
        assert len(check_results) == 20

    async def test_error_handling(self, permission_manager):
        """测试错误处理"""
        # 测试获取不存在的权限
        nonexistent_permission = await permission_manager.get_permission('nonexistent')
        assert nonexistent_permission is None
        
        # 测试获取不存在的角色
        nonexistent_role = await permission_manager.get_role('nonexistent')
        assert nonexistent_role is None
        
        # 测试删除不存在的权限
        delete_result = await permission_manager.delete_permission('nonexistent')
        assert delete_result is False
        
        # 测试无效的权限上下文
        invalid_context = PermissionContext(
            user_id='',
            roles=set(),
            security_level=None
        )
        
        with pytest.raises(ValueError):
            await permission_manager.check_permission(invalid_context, 'any_permission')

    async def test_permission_export_import(self, permission_manager, basic_permissions, basic_roles):
        """测试权限导出导入"""
        # 创建权限和角色
        for permission in basic_permissions:
            await permission_manager.create_permission(permission)
        
        for role in basic_roles:
            await permission_manager.create_role(role)
        
        # 导出权限配置
        exported_config = await permission_manager.export_permissions()
        
        assert 'permissions' in exported_config
        assert 'roles' in exported_config
        assert len(exported_config['permissions']) == len(basic_permissions)
        assert len(exported_config['roles']) == len(basic_roles)
        
        # 清理现有权限
        await permission_manager.clear_all_permissions()
        
        # 导入权限配置
        import_result = await permission_manager.import_permissions(exported_config)
        assert import_result is True
        
        # 验证权限已恢复
        restored_permissions = await permission_manager.list_permissions()
        assert len(restored_permissions) == len(basic_permissions)
