# -*- coding: utf-8 -*-
"""
安全集成测试

测试安全系统与其他组件的集成
"""

import pytest
import asyncio
import tempfile
import shutil
import json
import jwt
import hashlib
import secrets
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

from zishu.security.manager import SecurityManager, SecurityConfig
from zishu.security.service import SecurityService, SecurityServiceConfig
from zishu.security.sandbox import SecuritySandbox, SandboxConfig
from zishu.security.permissions import PermissionManager, PermissionConfig
from zishu.security.audit import AuditLogger, AuditConfig
from zishu.security.threat_detector import ThreatDetector, ThreatDetectorConfig
from zishu.core.microservice import MicroserviceManager, MicroserviceConfig
from zishu.core.registry import ServiceRegistry, RegistryConfig
from zishu.core.event_bus import EventBus, EventBusConfig
from zishu.storage.manager import StorageManager, StorageManagerConfig
from zishu.metrics.manager import MetricsManager, MetricsConfig
from zishu.communication.gateway import APIGateway, GatewayConfig
from zishu.communication.message_queue import MessageQueue, MessageQueueConfig
from zishu.core.types import (
    SecurityContext, SecurityEvent, SecurityPolicy, SecurityRole,
    SecurityPermission, AuditEvent, ThreatLevel, EventType
)
from zishu.core.exceptions import (
    SecurityException, AuthenticationException, AuthorizationException,
    ValidationException, EncryptionException, AuditException
)

from tests.utils.security_test_utils import SecurityTestUtils


class TestSecurityIntegration:
    """安全集成测试类"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    @pytest.fixture
    async def security_cluster(self, temp_dir):
        """创建安全集群"""
        # 存储管理器
        storage_config = StorageManagerConfig(
            name='test_security_storage',
            default_backend='memory'
        )
        storage_manager = StorageManager(config=storage_config)
        await storage_manager.initialize()
        
        # 指标管理器
        metrics_config = MetricsConfig(
            name='test_security_metrics',
            enable_collection=True,
            collection_interval=1
        )
        metrics_manager = MetricsManager(config=metrics_config)
        await metrics_manager.initialize()
        
        # 事件总线
        event_bus_config = EventBusConfig(
            name='test_security_event_bus',
            backend='memory',
            enable_persistence=False
        )
        event_bus = EventBus(config=event_bus_config)
        await event_bus.initialize()
        
        # 审计日志器
        audit_config = AuditConfig(
            name='test_audit_logger',
            storage_backend='memory',
            enable_real_time_alerts=True
        )
        audit_logger = AuditLogger(config=audit_config)
        await audit_logger.initialize()
        
        # 威胁检测器
        threat_detector_config = ThreatDetectorConfig(
            name='test_threat_detector',
            enable_ml_detection=True,
            alert_threshold=0.7
        )
        threat_detector = ThreatDetector(config=threat_detector_config)
        await threat_detector.initialize()
        
        # 权限管理器
        permission_config = PermissionConfig(
            name='test_permission_manager',
            enable_rbac=True,
            enable_abac=True
        )
        permission_manager = PermissionManager(config=permission_config)
        await permission_manager.initialize()
        
        # 安全沙箱
        sandbox_config = SandboxConfig(
            name='test_security_sandbox',
            enable_isolation=True,
            resource_limits={'memory': '100MB', 'cpu': '0.5'}
        )
        security_sandbox = SecuritySandbox(config=sandbox_config)
        await security_sandbox.initialize()
        
        # 安全服务
        security_service_config = SecurityServiceConfig(
            name='test_security_service',
            enable_authentication=True,
            enable_authorization=True,
            enable_encryption=True
        )
        security_service = SecurityService(config=security_service_config)
        await security_service.initialize()
        
        # 安全管理器
        security_config = SecurityConfig(
            name='test_security_manager',
            security_service=security_service,
            permission_manager=permission_manager,
            audit_logger=audit_logger,
            threat_detector=threat_detector,
            sandbox=security_sandbox,
            storage_manager=storage_manager,
            metrics_manager=metrics_manager,
            event_bus=event_bus
        )
        security_manager = SecurityManager(config=security_config)
        await security_manager.initialize()
        
        yield {
            'security_manager': security_manager,
            'security_service': security_service,
            'permission_manager': permission_manager,
            'audit_logger': audit_logger,
            'threat_detector': threat_detector,
            'security_sandbox': security_sandbox,
            'storage_manager': storage_manager,
            'metrics_manager': metrics_manager,
            'event_bus': event_bus
        }
        
        # 清理
        await security_manager.shutdown()
        await security_service.shutdown()
        await permission_manager.shutdown()
        await audit_logger.shutdown()
        await threat_detector.shutdown()
        await security_sandbox.shutdown()
        await storage_manager.shutdown()
        await metrics_manager.shutdown()
        await event_bus.shutdown()

    async def test_authentication_integration(self, security_cluster):
        """测试认证集成"""
        cluster = security_cluster
        security_manager = cluster['security_manager']
        security_service = cluster['security_service']
        audit_logger = cluster['audit_logger']
        
        # 创建用户和凭据
        user_credentials = {
            'username': 'test_user',
            'password': 'secure_password_123',
            'email': 'test@example.com',
            'roles': ['user', 'premium']
        }
        
        # 注册用户
        user_id = await security_service.register_user(
            user_credentials['username'],
            user_credentials['password'],
            user_credentials['email'],
            user_credentials['roles']
        )
        
        assert user_id is not None
        
        # 测试成功认证
        auth_result = await security_manager.authenticate(
            user_credentials['username'],
            user_credentials['password']
        )
        
        assert auth_result.success is True
        assert auth_result.user_id == user_id
        assert auth_result.token is not None
        assert 'user' in auth_result.roles
        assert 'premium' in auth_result.roles
        
        # 验证审计日志记录了认证事件
        audit_events = await audit_logger.get_events_by_type('authentication')
        auth_events = [e for e in audit_events if e.user_id == user_id and e.action == 'login_success']
        assert len(auth_events) > 0
        
        # 测试失败认证
        with pytest.raises(AuthenticationException):
            await security_manager.authenticate(
                user_credentials['username'],
                'wrong_password'
            )
        
        # 验证失败认证也被记录
        audit_events = await audit_logger.get_events_by_type('authentication')
        failed_auth_events = [e for e in audit_events if e.action == 'login_failed']
        assert len(failed_auth_events) > 0

    async def test_authorization_integration(self, security_cluster):
        """测试授权集成"""
        cluster = security_cluster
        security_manager = cluster['security_manager']
        permission_manager = cluster['permission_manager']
        audit_logger = cluster['audit_logger']
        
        # 定义权限和角色
        permissions = [
            SecurityPermission(name='read:users', description='Read user data'),
            SecurityPermission(name='write:users', description='Write user data'),
            SecurityPermission(name='read:orders', description='Read order data'),
            SecurityPermission(name='write:orders', description='Write order data'),
            SecurityPermission(name='admin:system', description='System administration')
        ]
        
        roles = [
            SecurityRole(
                name='user',
                permissions=['read:users'],
                description='Basic user role'
            ),
            SecurityRole(
                name='premium',
                permissions=['read:users', 'read:orders'],
                description='Premium user role'
            ),
            SecurityRole(
                name='admin',
                permissions=['read:users', 'write:users', 'read:orders', 'write:orders', 'admin:system'],
                description='Administrator role'
            )
        ]
        
        # 注册权限和角色
        for permission in permissions:
            await permission_manager.create_permission(permission)
        
        for role in roles:
            await permission_manager.create_role(role)
        
        # 创建测试用户
        users = [
            {
                'username': 'basic_user',
                'roles': ['user'],
                'permissions': []
            },
            {
                'username': 'premium_user',
                'roles': ['user', 'premium'],
                'permissions': []
            },
            {
                'username': 'admin_user',
                'roles': ['admin'],
                'permissions': ['admin:system']
            }
        ]
        
        user_contexts = {}
        for user in users:
            # 创建安全上下文
            context = SecurityContext(
                user_id=user['username'],
                username=user['username'],
                roles=user['roles'],
                permissions=user['permissions'],
                token=f"test_token_{user['username']}"
            )
            user_contexts[user['username']] = context
        
        # 测试权限检查
        test_cases = [
            # 基础用户
            ('basic_user', 'read:users', True),
            ('basic_user', 'write:users', False),
            ('basic_user', 'read:orders', False),
            
            # 高级用户
            ('premium_user', 'read:users', True),
            ('premium_user', 'read:orders', True),
            ('premium_user', 'write:orders', False),
            
            # 管理员
            ('admin_user', 'read:users', True),
            ('admin_user', 'write:users', True),
            ('admin_user', 'admin:system', True),
        ]
        
        for username, permission, expected in test_cases:
            context = user_contexts[username]
            
            try:
                result = await security_manager.check_permission(context, permission)
                assert result == expected, f"Permission check failed for {username}:{permission}"
                
                if expected:
                    # 验证授权成功被记录
                    audit_events = await audit_logger.get_events_by_user(username)
                    auth_success_events = [e for e in audit_events if e.action == 'authorization_granted']
                    assert len(auth_success_events) > 0
                
            except AuthorizationException:
                assert not expected, f"Unexpected authorization exception for {username}:{permission}"
                
                # 验证授权失败被记录
                audit_events = await audit_logger.get_events_by_user(username)
                auth_failed_events = [e for e in audit_events if e.action == 'authorization_denied']
                assert len(auth_failed_events) > 0

    async def test_encryption_integration(self, security_cluster):
        """测试加密集成"""
        cluster = security_cluster
        security_manager = cluster['security_manager']
        security_service = cluster['security_service']
        storage_manager = cluster['storage_manager']
        
        # 测试数据加密存储
        sensitive_data = {
            'user_id': 12345,
            'credit_card': '4111-1111-1111-1111',
            'ssn': '123-45-6789',
            'personal_info': {
                'name': 'John Doe',
                'address': '123 Main St, City, State',
                'phone': '+1-555-123-4567'
            }
        }
        
        # 使用安全管理器加密并存储数据
        encryption_key = await security_service.generate_encryption_key()
        encrypted_data = await security_service.encrypt_data(
            json.dumps(sensitive_data),
            encryption_key
        )
        
        # 存储加密数据
        storage_key = f"encrypted_user_data_{sensitive_data['user_id']}"
        await storage_manager.set_data(storage_key, {
            'encrypted_data': encrypted_data,
            'encryption_metadata': {
                'algorithm': 'AES-256-GCM',
                'key_id': encryption_key.key_id,
                'created_at': datetime.now().isoformat()
            }
        })
        
        # 验证数据已加密存储
        stored_data = await storage_manager.get_data(storage_key)
        assert stored_data is not None
        assert 'encrypted_data' in stored_data
        assert stored_data['encrypted_data'] != json.dumps(sensitive_data)
        
        # 解密并验证数据
        decrypted_data = await security_service.decrypt_data(
            stored_data['encrypted_data'],
            encryption_key
        )
        
        decrypted_obj = json.loads(decrypted_data)
        assert decrypted_obj == sensitive_data

    async def test_threat_detection_integration(self, security_cluster):
        """测试威胁检测集成"""
        cluster = security_cluster
        security_manager = cluster['security_manager']
        threat_detector = cluster['threat_detector']
        audit_logger = cluster['audit_logger']
        event_bus = cluster['event_bus']
        
        # 威胁事件收集
        detected_threats = []
        
        async def threat_event_handler(event):
            if event.type == EventType.SECURITY_THREAT_DETECTED:
                detected_threats.append(event.data)
        
        await event_bus.subscribe(EventType.SECURITY_THREAT_DETECTED, threat_event_handler)
        
        # 模拟可疑活动
        suspicious_activities = [
            {
                'type': 'brute_force_attack',
                'source_ip': '192.168.1.100',
                'target_user': 'admin',
                'failed_attempts': 10,
                'time_window': 60  # seconds
            },
            {
                'type': 'sql_injection_attempt',
                'source_ip': '10.0.0.50',
                'payload': "'; DROP TABLE users; --",
                'endpoint': '/api/users/search'
            },
            {
                'type': 'privilege_escalation',
                'user_id': 'user123',
                'attempted_permission': 'admin:system',
                'current_roles': ['user']
            },
            {
                'type': 'data_exfiltration',
                'user_id': 'employee456',
                'data_volume': '500MB',
                'unusual_access_pattern': True
            }
        ]
        
        # 提交可疑活动进行检测
        for activity in suspicious_activities:
            threat_level = await threat_detector.analyze_activity(activity)
            
            if threat_level >= ThreatLevel.MEDIUM:
                # 记录威胁事件
                await audit_logger.log_security_event(
                    event_type='threat_detected',
                    severity=threat_level,
                    details=activity
                )
                
                # 发布威胁事件
                await event_bus.publish(SecurityEvent(
                    type=EventType.SECURITY_THREAT_DETECTED,
                    source='threat_detector',
                    data={
                        'threat_level': threat_level,
                        'activity': activity,
                        'detected_at': datetime.now().isoformat()
                    }
                ))
        
        # 等待事件处理
        await asyncio.sleep(0.5)
        
        # 验证威胁检测结果
        assert len(detected_threats) > 0
        
        # 验证高风险威胁被检测
        high_risk_threats = [t for t in detected_threats if t['threat_level'] >= ThreatLevel.HIGH]
        assert len(high_risk_threats) > 0
        
        # 验证审计日志记录了威胁事件
        threat_events = await audit_logger.get_events_by_type('threat_detected')
        assert len(threat_events) > 0

    async def test_sandbox_integration(self, security_cluster):
        """测试沙箱集成"""
        cluster = security_cluster
        security_manager = cluster['security_manager']
        security_sandbox = cluster['security_sandbox']
        audit_logger = cluster['audit_logger']
        
        # 创建沙箱环境
        sandbox_id = await security_sandbox.create_sandbox({
            'name': 'test_sandbox',
            'isolation_level': 'high',
            'resource_limits': {
                'memory': '50MB',
                'cpu': '0.25',
                'disk': '10MB',
                'network': 'restricted'
            },
            'allowed_operations': ['read', 'compute'],
            'blocked_operations': ['network_access', 'file_write']
        })
        
        assert sandbox_id is not None
        
        # 在沙箱中执行安全操作
        safe_operations = [
            {
                'type': 'compute',
                'operation': 'calculate_hash',
                'data': 'test_data_123'
            },
            {
                'type': 'read',
                'operation': 'read_config',
                'resource': 'app_config.json'
            }
        ]
        
        for operation in safe_operations:
            result = await security_sandbox.execute_in_sandbox(
                sandbox_id, operation
            )
            assert result.success is True
            assert result.violation is None
        
        # 尝试执行被阻止的操作
        blocked_operations = [
            {
                'type': 'network_access',
                'operation': 'http_request',
                'url': 'http://external-api.com/data'
            },
            {
                'type': 'file_write',
                'operation': 'write_file',
                'path': '/etc/passwd',
                'content': 'malicious_content'
            }
        ]
        
        for operation in blocked_operations:
            result = await security_sandbox.execute_in_sandbox(
                sandbox_id, operation
            )
            assert result.success is False
            assert result.violation is not None
            
            # 验证违规行为被记录
            audit_events = await audit_logger.get_events_by_type('sandbox_violation')
            violation_events = [e for e in audit_events if e.details.get('sandbox_id') == sandbox_id]
            assert len(violation_events) > 0
        
        # 清理沙箱
        await security_sandbox.destroy_sandbox(sandbox_id)

    async def test_microservice_security_integration(self, security_cluster):
        """测试微服务安全集成"""
        cluster = security_cluster
        security_manager = cluster['security_manager']
        audit_logger = cluster['audit_logger']
        
        # 创建服务注册中心和微服务管理器
        registry_config = RegistryConfig(
            name='test_secure_registry',
            backend='memory',
            enable_security=True
        )
        registry = ServiceRegistry(config=registry_config)
        await registry.initialize()
        
        microservice_config = MicroserviceConfig(
            name='test_secure_microservice',
            registry=registry,
            security_manager=security_manager,
            enable_security=True
        )
        microservice_manager = MicroserviceManager(config=microservice_config)
        await microservice_manager.initialize()
        
        # 创建安全上下文
        admin_context = SecurityContext(
            user_id='admin_user',
            username='admin',
            roles=['admin'],
            permissions=['service:register', 'service:manage'],
            token='admin_jwt_token'
        )
        
        user_context = SecurityContext(
            user_id='regular_user',
            username='user',
            roles=['user'],
            permissions=['service:read'],
            token='user_jwt_token'
        )
        
        # 测试安全服务注册
        service_info = {
            'name': 'secure_api_service',
            'version': '1.0.0',
            'host': 'localhost',
            'port': 8443,
            'security_level': 'high',
            'requires_authentication': True
        }
        
        # 管理员可以注册服务
        service_id = await microservice_manager.register_secure_service(
            service_info, admin_context
        )
        assert service_id is not None
        
        # 普通用户不能注册服务
        with pytest.raises(AuthorizationException):
            await microservice_manager.register_secure_service(
                service_info, user_context
            )
        
        # 验证安全事件被记录
        service_events = await audit_logger.get_events_by_type('service_management')
        register_events = [e for e in service_events if e.action == 'service_registered']
        assert len(register_events) > 0
        
        failed_register_events = [e for e in service_events if e.action == 'service_register_denied']
        assert len(failed_register_events) > 0
        
        await microservice_manager.shutdown()
        await registry.shutdown()

    async def test_api_gateway_security_integration(self, security_cluster):
        """测试API网关安全集成"""
        cluster = security_cluster
        security_manager = cluster['security_manager']
        audit_logger = cluster['audit_logger']
        
        # 创建安全API网关
        gateway_config = GatewayConfig(
            name='test_secure_gateway',
            host='localhost',
            port=8443,
            enable_security=True,
            security_manager=security_manager,
            enable_rate_limiting=True,
            enable_request_logging=True
        )
        api_gateway = APIGateway(config=gateway_config)
        await api_gateway.initialize()
        
        # 配置安全路由
        secure_routes = [
            {
                'path': '/api/admin/*',
                'backend': 'admin_service',
                'security_level': 'high',
                'required_roles': ['admin'],
                'required_permissions': ['admin:read', 'admin:write']
            },
            {
                'path': '/api/users/*',
                'backend': 'user_service',
                'security_level': 'medium',
                'required_roles': ['user', 'premium'],
                'required_permissions': ['user:read']
            },
            {
                'path': '/api/public/*',
                'backend': 'public_service',
                'security_level': 'low',
                'required_roles': [],
                'required_permissions': []
            }
        ]
        
        for route in secure_routes:
            await api_gateway.add_secure_route(route)
        
        # 测试请求
        test_requests = [
            {
                'method': 'GET',
                'path': '/api/admin/users',
                'headers': {'Authorization': 'Bearer admin_token'},
                'security_context': SecurityContext(
                    user_id='admin_user',
                    roles=['admin'],
                    permissions=['admin:read', 'admin:write'],
                    token='admin_token'
                ),
                'expected_status': 200
            },
            {
                'method': 'GET',
                'path': '/api/users/profile',
                'headers': {'Authorization': 'Bearer user_token'},
                'security_context': SecurityContext(
                    user_id='regular_user',
                    roles=['user'],
                    permissions=['user:read'],
                    token='user_token'
                ),
                'expected_status': 200
            },
            {
                'method': 'GET',
                'path': '/api/admin/settings',
                'headers': {'Authorization': 'Bearer user_token'},
                'security_context': SecurityContext(
                    user_id='regular_user',
                    roles=['user'],
                    permissions=['user:read'],
                    token='user_token'
                ),
                'expected_status': 403  # Forbidden
            },
            {
                'method': 'GET',
                'path': '/api/public/info',
                'headers': {},
                'security_context': None,
                'expected_status': 200
            }
        ]
        
        # 模拟后端服务响应
        async def mock_backend_response(service_name: str, request, context):
            return {
                'service': service_name,
                'status': 'success',
                'data': f'Response from {service_name}',
                'user_id': context.user_id if context else None
            }
        
        api_gateway.set_secure_backend_caller(mock_backend_response)
        
        # 处理测试请求
        for request in test_requests:
            try:
                response = await api_gateway.handle_secure_request(
                    request, request['security_context']
                )
                
                if request['expected_status'] == 200:
                    assert response['status'] == 'success'
                else:
                    # 不应该到达这里
                    assert False, f"Expected status {request['expected_status']} but got success"
                    
            except AuthorizationException:
                assert request['expected_status'] == 403
            except AuthenticationException:
                assert request['expected_status'] == 401
        
        # 验证安全事件被记录
        gateway_events = await audit_logger.get_events_by_type('api_gateway')
        assert len(gateway_events) > 0
        
        access_granted_events = [e for e in gateway_events if e.action == 'access_granted']
        access_denied_events = [e for e in gateway_events if e.action == 'access_denied']
        
        assert len(access_granted_events) > 0
        assert len(access_denied_events) > 0
        
        await api_gateway.shutdown()

    async def test_message_queue_security_integration(self, security_cluster):
        """测试消息队列安全集成"""
        cluster = security_cluster
        security_manager = cluster['security_manager']
        audit_logger = cluster['audit_logger']
        
        # 创建安全消息队列
        mq_config = MessageQueueConfig(
            name='test_secure_message_queue',
            backend='memory',
            enable_security=True,
            security_manager=security_manager,
            enable_encryption=True
        )
        message_queue = MessageQueue(config=mq_config)
        await message_queue.initialize()
        
        # 创建安全队列
        secure_queues = [
            {
                'name': 'admin_commands',
                'security_level': 'high',
                'required_roles': ['admin'],
                'required_permissions': ['queue:admin']
            },
            {
                'name': 'user_notifications',
                'security_level': 'medium',
                'required_roles': ['user', 'premium'],
                'required_permissions': ['queue:user']
            },
            {
                'name': 'public_events',
                'security_level': 'low',
                'required_roles': [],
                'required_permissions': []
            }
        ]
        
        for queue_config in secure_queues:
            await message_queue.create_secure_queue(queue_config)
        
        # 创建安全上下文
        admin_context = SecurityContext(
            user_id='admin_user',
            roles=['admin'],
            permissions=['queue:admin', 'queue:user'],
            token='admin_token'
        )
        
        user_context = SecurityContext(
            user_id='regular_user',
            roles=['user'],
            permissions=['queue:user'],
            token='user_token'
        )
        
        # 测试安全消息发送
        test_messages = [
            {
                'queue': 'admin_commands',
                'message': {'command': 'restart_service', 'service_id': 'api_service'},
                'context': admin_context,
                'should_succeed': True
            },
            {
                'queue': 'user_notifications',
                'message': {'type': 'welcome', 'user_id': 'regular_user'},
                'context': user_context,
                'should_succeed': True
            },
            {
                'queue': 'admin_commands',
                'message': {'command': 'delete_all_data'},
                'context': user_context,
                'should_succeed': False  # 用户无权限访问管理队列
            },
            {
                'queue': 'public_events',
                'message': {'event': 'system_maintenance_scheduled'},
                'context': None,  # 公共队列无需认证
                'should_succeed': True
            }
        ]
        
        # 发送测试消息
        for test in test_messages:
            try:
                message_id = await message_queue.send_secure_message(
                    test['queue'], test['message'], test['context']
                )
                
                if test['should_succeed']:
                    assert message_id is not None
                else:
                    assert False, f"Expected failure but message was sent: {message_id}"
                    
            except (AuthenticationException, AuthorizationException):
                assert not test['should_succeed']
        
        # 测试安全消息接收
        received_messages = []
        
        async def secure_message_handler(message, context):
            received_messages.append({
                'queue': message.queue,
                'data': message.data,
                'user_id': context.user_id if context else None
            })
        
        # 注册安全消息处理器
        await message_queue.register_secure_consumer(
            'user_notifications', secure_message_handler, user_context
        )
        
        # 等待消息处理
        await asyncio.sleep(0.5)
        
        # 验证消息被安全处理
        user_messages = [m for m in received_messages if m['queue'] == 'user_notifications']
        assert len(user_messages) > 0
        
        # 验证安全事件被记录
        queue_events = await audit_logger.get_events_by_type('message_queue')
        send_events = [e for e in queue_events if e.action == 'message_sent']
        receive_events = [e for e in queue_events if e.action == 'message_received']
        
        assert len(send_events) > 0
        assert len(receive_events) > 0
        
        await message_queue.shutdown()

    async def test_security_metrics_integration(self, security_cluster):
        """测试安全指标集成"""
        cluster = security_cluster
        security_manager = cluster['security_manager']
        metrics_manager = cluster['metrics_manager']
        audit_logger = cluster['audit_logger']
        
        # 启用安全指标收集
        await security_manager.enable_security_metrics(True)
        
        # 模拟安全事件以生成指标
        security_events = [
            # 成功认证
            *[{'type': 'authentication', 'result': 'success', 'user_id': f'user_{i}'} 
              for i in range(50)],
            
            # 失败认证
            *[{'type': 'authentication', 'result': 'failure', 'user_id': f'user_{i}'} 
              for i in range(10)],
            
            # 授权检查
            *[{'type': 'authorization', 'result': 'granted', 'permission': 'read:data'} 
              for i in range(100)],
            
            # 授权拒绝
            *[{'type': 'authorization', 'result': 'denied', 'permission': 'admin:system'} 
              for i in range(5)],
            
            # 威胁检测
            *[{'type': 'threat_detection', 'threat_level': 'low', 'source': f'ip_{i}'} 
              for i in range(20)],
            
            *[{'type': 'threat_detection', 'threat_level': 'high', 'source': f'ip_{i}'} 
              for i in range(3)]
        ]
        
        # 记录安全事件
        for event in security_events:
            await security_manager.record_security_event(event)
        
        # 等待指标收集
        await asyncio.sleep(2)
        
        # 获取安全指标
        security_metrics = await metrics_manager.get_security_metrics()
        
        assert security_metrics is not None
        
        # 验证认证指标
        assert 'authentication_success_rate' in security_metrics
        assert 'authentication_failure_count' in security_metrics
        
        auth_success_rate = security_metrics['authentication_success_rate']
        assert 0.8 <= auth_success_rate <= 1.0  # 50/(50+10) = 83.3%
        
        # 验证授权指标
        assert 'authorization_grant_rate' in security_metrics
        assert 'authorization_denial_count' in security_metrics
        
        auth_grant_rate = security_metrics['authorization_grant_rate']
        assert 0.9 <= auth_grant_rate <= 1.0  # 100/(100+5) = 95.2%
        
        # 验证威胁检测指标
        assert 'threat_detection_count' in security_metrics
        assert 'high_threat_count' in security_metrics
        
        threat_count = security_metrics['threat_detection_count']
        high_threat_count = security_metrics['high_threat_count']
        
        assert threat_count == 23  # 20 + 3
        assert high_threat_count == 3

    async def test_end_to_end_security_workflow(self, security_cluster):
        """测试端到端安全工作流"""
        cluster = security_cluster
        security_manager = cluster['security_manager']
        audit_logger = cluster['audit_logger']
        event_bus = cluster['event_bus']
        
        # 工作流状态跟踪
        workflow_state = {
            'user_registered': False,
            'user_authenticated': False,
            'permissions_granted': False,
            'secure_operation_performed': False,
            'audit_logged': False,
            'threat_analyzed': False
        }
        
        # 事件处理器
        async def security_event_handler(event):
            if event.type == EventType.USER_REGISTERED:
                workflow_state['user_registered'] = True
            elif event.type == EventType.USER_AUTHENTICATED:
                workflow_state['user_authenticated'] = True
            elif event.type == EventType.PERMISSION_GRANTED:
                workflow_state['permissions_granted'] = True
            elif event.type == EventType.SECURE_OPERATION_COMPLETED:
                workflow_state['secure_operation_performed'] = True
            elif event.type == EventType.AUDIT_EVENT_LOGGED:
                workflow_state['audit_logged'] = True
            elif event.type == EventType.THREAT_ANALYSIS_COMPLETED:
                workflow_state['threat_analyzed'] = True
        
        # 注册事件处理器
        for event_type in [
            EventType.USER_REGISTERED,
            EventType.USER_AUTHENTICATED,
            EventType.PERMISSION_GRANTED,
            EventType.SECURE_OPERATION_COMPLETED,
            EventType.AUDIT_EVENT_LOGGED,
            EventType.THREAT_ANALYSIS_COMPLETED
        ]:
            await event_bus.subscribe(event_type, security_event_handler)
        
        # 执行端到端安全工作流
        
        # 1. 用户注册
        user_data = {
            'username': 'workflow_user',
            'password': 'secure_password_456',
            'email': 'workflow@example.com',
            'roles': ['user', 'premium']
        }
        
        user_id = await security_manager.register_user(
            user_data['username'],
            user_data['password'],
            user_data['email'],
            user_data['roles']
        )
        
        await event_bus.publish(SecurityEvent(
            type=EventType.USER_REGISTERED,
            source='security_manager',
            data={'user_id': user_id, 'username': user_data['username']}
        ))
        
        # 2. 用户认证
        auth_result = await security_manager.authenticate(
            user_data['username'],
            user_data['password']
        )
        
        assert auth_result.success is True
        
        await event_bus.publish(SecurityEvent(
            type=EventType.USER_AUTHENTICATED,
            source='security_manager',
            data={'user_id': user_id, 'token': auth_result.token}
        ))
        
        # 3. 权限检查和授权
        security_context = SecurityContext(
            user_id=user_id,
            username=user_data['username'],
            roles=user_data['roles'],
            permissions=['read:profile', 'write:profile'],
            token=auth_result.token
        )
        
        permission_granted = await security_manager.check_permission(
            security_context, 'read:profile'
        )
        
        assert permission_granted is True
        
        await event_bus.publish(SecurityEvent(
            type=EventType.PERMISSION_GRANTED,
            source='security_manager',
            data={'user_id': user_id, 'permission': 'read:profile'}
        ))
        
        # 4. 执行安全操作
        secure_operation_data = {
            'operation': 'update_profile',
            'user_id': user_id,
            'changes': {'email': 'new_email@example.com'}
        }
        
        operation_result = await security_manager.execute_secure_operation(
            secure_operation_data, security_context
        )
        
        assert operation_result.success is True
        
        await event_bus.publish(SecurityEvent(
            type=EventType.SECURE_OPERATION_COMPLETED,
            source='security_manager',
            data=secure_operation_data
        ))
        
        # 5. 审计日志记录
        await audit_logger.log_security_event(
            event_type='secure_operation',
            user_id=user_id,
            action='profile_updated',
            details=secure_operation_data
        )
        
        await event_bus.publish(SecurityEvent(
            type=EventType.AUDIT_EVENT_LOGGED,
            source='audit_logger',
            data={'user_id': user_id, 'event_type': 'secure_operation'}
        ))
        
        # 6. 威胁分析
        threat_analysis_result = await security_manager.analyze_user_behavior(
            user_id, {
                'recent_operations': [secure_operation_data],
                'access_patterns': ['normal'],
                'risk_indicators': []
            }
        )
        
        await event_bus.publish(SecurityEvent(
            type=EventType.THREAT_ANALYSIS_COMPLETED,
            source='security_manager',
            data={'user_id': user_id, 'risk_level': threat_analysis_result.risk_level}
        ))
        
        # 等待所有事件处理完成
        await asyncio.sleep(1)
        
        # 验证工作流完成
        assert workflow_state['user_registered'] is True
        assert workflow_state['user_authenticated'] is True
        assert workflow_state['permissions_granted'] is True
        assert workflow_state['secure_operation_performed'] is True
        assert workflow_state['audit_logged'] is True
        assert workflow_state['threat_analyzed'] is True
        
        # 验证审计跟踪完整性
        user_audit_events = await audit_logger.get_events_by_user(user_id)
        
        # 应该包含注册、认证、授权、操作等事件
        event_types = [event.event_type for event in user_audit_events]
        
        expected_event_types = [
            'user_registration',
            'authentication',
            'authorization',
            'secure_operation'
        ]
        
        for expected_type in expected_event_types:
            assert any(expected_type in event_type for event_type in event_types), \
                f"Missing audit event type: {expected_type}"
        
        # 验证安全指标更新
        final_metrics = await security_manager.get_security_metrics()
        
        assert final_metrics['total_users'] >= 1
        assert final_metrics['successful_authentications'] >= 1
        assert final_metrics['granted_permissions'] >= 1
        assert final_metrics['secure_operations'] >= 1
