# -*- coding: utf-8 -*-
"""
安全管理器测试

测试新架构的安全管理器功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Set

from zishu.security.core.manager import SecurityManager, SecurityManagerConfig
from zishu.security.core.types import (
    SecurityLevel, Permission, Role, SecurityContext, SecurityPolicy,
    ThreatLevel, SecurityEvent, AuditEvent, AccessRequest, AccessResult
)
from zishu.security.core.exceptions import (
    SecurityException, AuthenticationError, AuthorizationError,
    SecurityPolicyViolation, ThreatDetected
)

from tests.utils.security_test_utils import SecurityTestUtils


class TestSecurityManager:
    """安全管理器测试类"""

    @pytest.fixture
    def security_config(self):
        """创建安全管理器配置"""
        return SecurityManagerConfig(
            enable_authentication=True,
            enable_authorization=True,
            enable_audit=True,
            enable_threat_detection=True,
            enable_encryption=True,
            session_timeout=3600,  # 1小时
            max_failed_attempts=3,
            lockout_duration=300,  # 5分钟
            audit_retention_days=90,
            threat_detection_threshold=0.7
        )

    @pytest.fixture
    async def security_manager(self, security_config):
        """创建安全管理器实例"""
        manager = SecurityManager(config=security_config)
        await manager.initialize()
        await manager.start()
        yield manager
        await manager.stop()

    @pytest.fixture
    def test_user(self):
        """创建测试用户"""
        return {
            'user_id': 'test_user_001',
            'username': 'testuser',
            'email': 'test@example.com',
            'roles': ['user', 'adapter_user'],
            'permissions': ['read_adapters', 'execute_adapters']
        }

    @pytest.fixture
    def test_security_context(self, test_user):
        """创建测试安全上下文"""
        return SecurityContext(
            user_id=test_user['user_id'],
            username=test_user['username'],
            roles=set(test_user['roles']),
            permissions=set(test_user['permissions']),
            session_id='test_session_001',
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            security_level=SecurityLevel.INTERNAL
        )

    async def test_manager_initialization(self, security_config):
        """测试安全管理器初始化"""
        manager = SecurityManager(config=security_config)
        
        # 验证初始状态
        assert manager.config == security_config
        assert not manager.is_initialized
        assert not manager.is_running
        
        # 初始化管理器
        await manager.initialize()
        assert manager.is_initialized
        assert not manager.is_running
        
        # 启动管理器
        await manager.start()
        assert manager.is_running
        
        # 停止管理器
        await manager.stop()
        assert not manager.is_running

    async def test_authenticate_user(self, security_manager, test_user):
        """测试用户认证"""
        # 模拟用户认证
        credentials = {
            'username': test_user['username'],
            'password': 'test_password_123'
        }
        
        # 认证成功
        with patch.object(security_manager, '_verify_credentials', return_value=True):
            result = await security_manager.authenticate_user(credentials)
            
            assert result is not None
            assert result.user_id == test_user['user_id']
            assert result.username == test_user['username']
            assert 'user' in result.roles

    async def test_authenticate_user_failure(self, security_manager):
        """测试用户认证失败"""
        credentials = {
            'username': 'invalid_user',
            'password': 'wrong_password'
        }
        
        # 认证失败
        with patch.object(security_manager, '_verify_credentials', return_value=False):
            with pytest.raises(AuthenticationError):
                await security_manager.authenticate_user(credentials)

    async def test_create_session(self, security_manager, test_security_context):
        """测试创建会话"""
        # 创建会话
        session_id = await security_manager.create_session(test_security_context)
        
        assert session_id is not None
        assert isinstance(session_id, str)
        
        # 验证会话存在
        session = await security_manager.get_session(session_id)
        assert session is not None
        assert session.user_id == test_security_context.user_id

    async def test_validate_session(self, security_manager, test_security_context):
        """测试验证会话"""
        # 创建会话
        session_id = await security_manager.create_session(test_security_context)
        
        # 验证有效会话
        is_valid = await security_manager.validate_session(session_id)
        assert is_valid is True
        
        # 验证无效会话
        is_valid = await security_manager.validate_session('invalid_session')
        assert is_valid is False

    async def test_session_expiration(self, security_manager):
        """测试会话过期"""
        # 创建过期的安全上下文
        expired_context = SecurityContext(
            user_id='test_user',
            username='testuser',
            roles=set(['user']),
            permissions=set(['read']),
            session_id='expired_session',
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
            security_level=SecurityLevel.INTERNAL
        )
        
        # 创建会话
        session_id = await security_manager.create_session(expired_context)
        
        # 验证过期会话
        is_valid = await security_manager.validate_session(session_id)
        assert is_valid is False

    async def test_revoke_session(self, security_manager, test_security_context):
        """测试撤销会话"""
        # 创建会话
        session_id = await security_manager.create_session(test_security_context)
        
        # 撤销会话
        result = await security_manager.revoke_session(session_id)
        assert result is True
        
        # 验证会话已撤销
        is_valid = await security_manager.validate_session(session_id)
        assert is_valid is False

    async def test_authorize_access(self, security_manager, test_security_context):
        """测试访问授权"""
        # 创建访问请求
        access_request = AccessRequest(
            resource='adapter:test-adapter',
            action='execute',
            context=test_security_context
        )
        
        # 授权检查
        result = await security_manager.authorize_access(access_request)
        
        assert isinstance(result, AccessResult)
        # 根据用户权限，应该被授权或拒绝

    async def test_check_permission(self, security_manager, test_security_context):
        """测试权限检查"""
        # 检查用户拥有的权限
        has_permission = await security_manager.check_permission(
            test_security_context,
            'read_adapters'
        )
        assert has_permission is True
        
        # 检查用户没有的权限
        has_permission = await security_manager.check_permission(
            test_security_context,
            'admin_access'
        )
        assert has_permission is False

    async def test_check_role(self, security_manager, test_security_context):
        """测试角色检查"""
        # 检查用户拥有的角色
        has_role = await security_manager.check_role(test_security_context, 'user')
        assert has_role is True
        
        # 检查用户没有的角色
        has_role = await security_manager.check_role(test_security_context, 'admin')
        assert has_role is False

    async def test_security_policy_enforcement(self, security_manager, test_security_context):
        """测试安全策略执行"""
        # 创建安全策略
        policy = SecurityPolicy(
            name='test_policy',
            rules=[
                {
                    'condition': 'resource.type == "adapter"',
                    'action': 'require_permission',
                    'parameters': {'permission': 'execute_adapters'}
                }
            ],
            priority=1
        )
        
        # 添加策略
        await security_manager.add_security_policy(policy)
        
        # 测试策略执行
        access_request = AccessRequest(
            resource='adapter:test-adapter',
            action='execute',
            context=test_security_context
        )
        
        result = await security_manager.enforce_security_policy(access_request)
        assert isinstance(result, AccessResult)

    async def test_audit_logging(self, security_manager, test_security_context):
        """测试审计日志"""
        # 创建审计事件
        audit_event = AuditEvent(
            event_type='user_login',
            user_id=test_security_context.user_id,
            resource='system',
            action='authenticate',
            result='success',
            timestamp=datetime.now(timezone.utc),
            details={'ip_address': '192.168.1.100'}
        )
        
        # 记录审计事件
        await security_manager.log_audit_event(audit_event)
        
        # 查询审计日志
        audit_logs = await security_manager.get_audit_logs(
            user_id=test_security_context.user_id,
            start_time=datetime.now(timezone.utc) - timedelta(minutes=1),
            end_time=datetime.now(timezone.utc) + timedelta(minutes=1)
        )
        
        assert len(audit_logs) >= 1
        assert audit_logs[0].event_type == 'user_login'

    async def test_threat_detection(self, security_manager, test_security_context):
        """测试威胁检测"""
        # 模拟可疑活动
        suspicious_events = [
            SecurityEvent(
                event_type='failed_login',
                user_id=test_security_context.user_id,
                source_ip='192.168.1.100',
                timestamp=datetime.now(timezone.utc),
                severity=ThreatLevel.MEDIUM
            )
        ]
        
        # 分析威胁
        threat_analysis = await security_manager.analyze_threats(suspicious_events)
        
        assert threat_analysis is not None
        assert 'threat_score' in threat_analysis
        assert 'recommendations' in threat_analysis

    async def test_encryption_decryption(self, security_manager):
        """测试加密解密"""
        # 测试数据
        plaintext = "sensitive_data_12345"
        
        # 加密数据
        encrypted_data = await security_manager.encrypt_data(plaintext)
        assert encrypted_data != plaintext
        assert isinstance(encrypted_data, (str, bytes))
        
        # 解密数据
        decrypted_data = await security_manager.decrypt_data(encrypted_data)
        assert decrypted_data == plaintext

    async def test_password_hashing(self, security_manager):
        """测试密码哈希"""
        password = "test_password_123"
        
        # 哈希密码
        hashed_password = await security_manager.hash_password(password)
        assert hashed_password != password
        assert isinstance(hashed_password, str)
        
        # 验证密码
        is_valid = await security_manager.verify_password(password, hashed_password)
        assert is_valid is True
        
        # 验证错误密码
        is_valid = await security_manager.verify_password("wrong_password", hashed_password)
        assert is_valid is False

    async def test_token_generation_validation(self, security_manager, test_security_context):
        """测试令牌生成和验证"""
        # 生成访问令牌
        access_token = await security_manager.generate_access_token(test_security_context)
        assert access_token is not None
        assert isinstance(access_token, str)
        
        # 验证令牌
        token_data = await security_manager.validate_access_token(access_token)
        assert token_data is not None
        assert token_data['user_id'] == test_security_context.user_id

    async def test_rate_limiting(self, security_manager, test_security_context):
        """测试速率限制"""
        # 设置速率限制
        await security_manager.set_rate_limit(
            test_security_context.user_id,
            max_requests=5,
            time_window=60  # 60秒
        )
        
        # 测试速率限制
        for i in range(5):
            is_allowed = await security_manager.check_rate_limit(test_security_context.user_id)
            assert is_allowed is True
        
        # 超出限制
        is_allowed = await security_manager.check_rate_limit(test_security_context.user_id)
        assert is_allowed is False

    async def test_security_context_validation(self, security_manager):
        """测试安全上下文验证"""
        # 有效的安全上下文
        valid_context = SecurityContext(
            user_id='valid_user',
            username='validuser',
            roles=set(['user']),
            permissions=set(['read']),
            session_id='valid_session',
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            security_level=SecurityLevel.INTERNAL
        )
        
        is_valid = await security_manager.validate_security_context(valid_context)
        assert is_valid is True
        
        # 无效的安全上下文（过期）
        invalid_context = SecurityContext(
            user_id='invalid_user',
            username='invaliduser',
            roles=set(['user']),
            permissions=set(['read']),
            session_id='invalid_session',
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
            security_level=SecurityLevel.INTERNAL
        )
        
        is_valid = await security_manager.validate_security_context(invalid_context)
        assert is_valid is False

    async def test_security_level_enforcement(self, security_manager):
        """测试安全级别执行"""
        # 创建不同安全级别的上下文
        public_context = SecurityContext(
            user_id='public_user',
            username='publicuser',
            roles=set(['guest']),
            permissions=set(['read_public']),
            session_id='public_session',
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            security_level=SecurityLevel.PUBLIC
        )
        
        restricted_context = SecurityContext(
            user_id='restricted_user',
            username='restricteduser',
            roles=set(['admin']),
            permissions=set(['admin_access']),
            session_id='restricted_session',
            created_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            security_level=SecurityLevel.RESTRICTED
        )
        
        # 测试访问受限资源
        restricted_request = AccessRequest(
            resource='system:admin_panel',
            action='access',
            context=public_context
        )
        
        result = await security_manager.authorize_access(restricted_request)
        assert result.is_allowed is False
        
        # 使用受限上下文访问
        restricted_request.context = restricted_context
        result = await security_manager.authorize_access(restricted_request)
        # 根据实现，可能被允许或拒绝

    async def test_concurrent_security_operations(self, security_manager, test_security_context):
        """测试并发安全操作"""
        # 并发创建多个会话
        contexts = []
        for i in range(5):
            context = SecurityContext(
                user_id=f'user_{i}',
                username=f'user{i}',
                roles=set(['user']),
                permissions=set(['read']),
                session_id=f'session_{i}',
                created_at=datetime.now(timezone.utc),
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
                security_level=SecurityLevel.INTERNAL
            )
            contexts.append(context)
        
        # 并发创建会话
        session_tasks = [
            security_manager.create_session(context)
            for context in contexts
        ]
        session_ids = await asyncio.gather(*session_tasks)
        
        # 验证所有会话都创建成功
        assert len(session_ids) == 5
        for session_id in session_ids:
            assert session_id is not None

    async def test_security_metrics(self, security_manager, test_security_context):
        """测试安全指标"""
        # 执行一些安全操作
        await security_manager.create_session(test_security_context)
        await security_manager.check_permission(test_security_context, 'read_adapters')
        
        # 获取安全指标
        metrics = await security_manager.get_security_metrics()
        
        assert metrics is not None
        assert 'active_sessions' in metrics
        assert 'authentication_attempts' in metrics
        assert 'authorization_checks' in metrics

    async def test_security_configuration_update(self, security_manager):
        """测试安全配置更新"""
        # 更新配置
        new_config = {
            'session_timeout': 7200,  # 2小时
            'max_failed_attempts': 5
        }
        
        result = await security_manager.update_security_config(new_config)
        assert result is True
        
        # 验证配置已更新
        current_config = await security_manager.get_security_config()
        assert current_config['session_timeout'] == 7200

    async def test_security_policy_management(self, security_manager):
        """测试安全策略管理"""
        # 创建安全策略
        policy = SecurityPolicy(
            name='test_policy_management',
            rules=[
                {
                    'condition': 'user.role == "admin"',
                    'action': 'allow',
                    'parameters': {}
                }
            ],
            priority=2
        )
        
        # 添加策略
        await security_manager.add_security_policy(policy)
        
        # 获取策略
        retrieved_policy = await security_manager.get_security_policy('test_policy_management')
        assert retrieved_policy is not None
        assert retrieved_policy.name == 'test_policy_management'
        
        # 更新策略
        policy.priority = 3
        await security_manager.update_security_policy(policy)
        
        # 删除策略
        result = await security_manager.remove_security_policy('test_policy_management')
        assert result is True

    async def test_error_handling(self, security_manager):
        """测试错误处理"""
        # 测试无效认证
        with pytest.raises(AuthenticationError):
            await security_manager.authenticate_user({})
        
        # 测试无效授权
        invalid_request = AccessRequest(
            resource='',
            action='',
            context=None
        )
        
        with pytest.raises(AuthorizationError):
            await security_manager.authorize_access(invalid_request)
        
        # 测试安全策略违规
        with pytest.raises(SecurityPolicyViolation):
            await security_manager.enforce_security_policy(invalid_request)

    async def test_cleanup_expired_sessions(self, security_manager):
        """测试清理过期会话"""
        # 创建过期会话
        expired_context = SecurityContext(
            user_id='expired_user',
            username='expireduser',
            roles=set(['user']),
            permissions=set(['read']),
            session_id='expired_session',
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
            security_level=SecurityLevel.INTERNAL
        )
        
        session_id = await security_manager.create_session(expired_context)
        
        # 清理过期会话
        cleaned_count = await security_manager.cleanup_expired_sessions()
        
        assert cleaned_count >= 0
        
        # 验证过期会话已被清理
        is_valid = await security_manager.validate_session(session_id)
        assert is_valid is False
