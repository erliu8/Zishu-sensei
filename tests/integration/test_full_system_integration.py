# -*- coding: utf-8 -*-
"""
完整系统集成测试

测试所有组件的端到端协作
"""

import pytest
import asyncio
import tempfile
import shutil
import json
import time
import logging
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

# 核心组件
from zishu.core.registry import ServiceRegistry, RegistryConfig
from zishu.core.validation import ValidationService, ValidationConfig
from zishu.core.health import HealthChecker, HealthConfig
from zishu.core.event_bus import EventBus, EventBusConfig
from zishu.core.orchestrator import ServiceOrchestrator, OrchestratorConfig
from zishu.core.microservice import MicroserviceManager, MicroserviceConfig

# 安全组件
from zishu.security.manager import SecurityManager, SecurityConfig
from zishu.security.service import SecurityService, SecurityServiceConfig
from zishu.security.sandbox import SecuritySandbox, SandboxConfig
from zishu.security.permissions import PermissionManager, PermissionConfig
from zishu.security.audit import AuditLogger, AuditConfig
from zishu.security.threat_detector import ThreatDetector, ThreatDetectorConfig

# 指标组件
from zishu.metrics.manager import MetricsManager, MetricsConfig
from zishu.metrics.collectors.system_collector import SystemMetricsCollector
from zishu.metrics.collectors.application_collector import ApplicationMetricsCollector
from zishu.metrics.exporters.prometheus_exporter import PrometheusExporter
from zishu.metrics.exporters.json_exporter import JSONExporter

# 存储组件
from zishu.storage.manager import StorageManager, StorageManagerConfig
from zishu.storage.backends.memory_backend import MemoryStorageBackend
from zishu.storage.backends.file_backend import FileStorageBackend

# 通信组件
from zishu.communication.gateway import APIGateway, GatewayConfig
from zishu.communication.message_queue import MessageQueue, MessageQueueConfig
from zishu.communication.load_balancer import LoadBalancer, LoadBalancerConfig

# 类型定义
from zishu.core.types import (
    ServiceInfo, HealthStatus, EventType, SecurityContext,
    MetricData, StorageBackendType, EventData
)
from zishu.core.exceptions import (
    ServiceException, SecurityException, ValidationException,
    StorageException, MetricsException, CommunicationException
)

from tests.utils.integration_test_utils import IntegrationTestUtils


class TestFullSystemIntegration:
    """完整系统集成测试类"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    @pytest.fixture
    async def full_system(self, temp_dir):
        """创建完整系统"""
        system_components = {}
        
        try:
            # 1. 存储管理器 (基础设施)
            storage_config = StorageManagerConfig(
                name='system_storage',
                default_backend='memory',
                enable_persistence=True,
                data_directory=str(Path(temp_dir) / 'storage')
            )
            storage_manager = StorageManager(config=storage_config)
            await storage_manager.initialize()
            system_components['storage_manager'] = storage_manager
            
            # 2. 事件总线 (基础设施)
            event_bus_config = EventBusConfig(
                name='system_event_bus',
                backend='memory',
                enable_persistence=True,
                storage_manager=storage_manager
            )
            event_bus = EventBus(config=event_bus_config)
            await event_bus.initialize()
            system_components['event_bus'] = event_bus
            
            # 3. 指标管理器
            metrics_config = MetricsConfig(
                name='system_metrics',
                enable_collection=True,
                collection_interval=1,
                storage_manager=storage_manager,
                event_bus=event_bus
            )
            metrics_manager = MetricsManager(config=metrics_config)
            await metrics_manager.initialize()
            system_components['metrics_manager'] = metrics_manager
            
            # 4. 审计日志器
            audit_config = AuditConfig(
                name='system_audit',
                storage_manager=storage_manager,
                event_bus=event_bus,
                enable_real_time_alerts=True
            )
            audit_logger = AuditLogger(config=audit_config)
            await audit_logger.initialize()
            system_components['audit_logger'] = audit_logger
            
            # 5. 威胁检测器
            threat_detector_config = ThreatDetectorConfig(
                name='system_threat_detector',
                enable_ml_detection=True,
                metrics_manager=metrics_manager,
                audit_logger=audit_logger,
                event_bus=event_bus
            )
            threat_detector = ThreatDetector(config=threat_detector_config)
            await threat_detector.initialize()
            system_components['threat_detector'] = threat_detector
            
            # 6. 权限管理器
            permission_config = PermissionConfig(
                name='system_permissions',
                enable_rbac=True,
                enable_abac=True,
                storage_manager=storage_manager,
                audit_logger=audit_logger
            )
            permission_manager = PermissionManager(config=permission_config)
            await permission_manager.initialize()
            system_components['permission_manager'] = permission_manager
            
            # 7. 安全沙箱
            sandbox_config = SandboxConfig(
                name='system_sandbox',
                enable_isolation=True,
                resource_limits={'memory': '100MB', 'cpu': '0.5'},
                metrics_manager=metrics_manager
            )
            security_sandbox = SecuritySandbox(config=sandbox_config)
            await security_sandbox.initialize()
            system_components['security_sandbox'] = security_sandbox
            
            # 8. 安全服务
            security_service_config = SecurityServiceConfig(
                name='system_security_service',
                enable_authentication=True,
                enable_authorization=True,
                enable_encryption=True,
                permission_manager=permission_manager,
                audit_logger=audit_logger
            )
            security_service = SecurityService(config=security_service_config)
            await security_service.initialize()
            system_components['security_service'] = security_service
            
            # 9. 安全管理器
            security_config = SecurityConfig(
                name='system_security_manager',
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
            system_components['security_manager'] = security_manager
            
            # 10. 健康检查器
            health_config = HealthConfig(
                name='system_health',
                check_interval=5,
                metrics_manager=metrics_manager,
                event_bus=event_bus
            )
            health_checker = HealthChecker(config=health_config)
            await health_checker.initialize()
            system_components['health_checker'] = health_checker
            
            # 11. 验证服务
            validation_config = ValidationConfig(
                name='system_validation',
                enable_strict_mode=True,
                metrics_manager=metrics_manager
            )
            validation_service = ValidationService(config=validation_config)
            await validation_service.initialize()
            system_components['validation_service'] = validation_service
            
            # 12. 服务注册中心
            registry_config = RegistryConfig(
                name='system_registry',
                backend='memory',
                enable_security=True,
                security_manager=security_manager,
                storage_manager=storage_manager,
                event_bus=event_bus,
                health_checker=health_checker
            )
            service_registry = ServiceRegistry(config=registry_config)
            await service_registry.initialize()
            system_components['service_registry'] = service_registry
            
            # 13. 消息队列
            mq_config = MessageQueueConfig(
                name='system_message_queue',
                backend='memory',
                enable_security=True,
                security_manager=security_manager,
                metrics_manager=metrics_manager,
                storage_manager=storage_manager
            )
            message_queue = MessageQueue(config=mq_config)
            await message_queue.initialize()
            system_components['message_queue'] = message_queue
            
            # 14. 负载均衡器
            lb_config = LoadBalancerConfig(
                name='system_load_balancer',
                algorithm='round_robin',
                health_checker=health_checker,
                metrics_manager=metrics_manager,
                service_registry=service_registry
            )
            load_balancer = LoadBalancer(config=lb_config)
            await load_balancer.initialize()
            system_components['load_balancer'] = load_balancer
            
            # 15. API网关
            gateway_config = GatewayConfig(
                name='system_api_gateway',
                host='localhost',
                port=8443,
                enable_security=True,
                security_manager=security_manager,
                load_balancer=load_balancer,
                metrics_manager=metrics_manager,
                audit_logger=audit_logger,
                message_queue=message_queue
            )
            api_gateway = APIGateway(config=gateway_config)
            await api_gateway.initialize()
            system_components['api_gateway'] = api_gateway
            
            # 16. 微服务管理器
            microservice_config = MicroserviceConfig(
                name='system_microservice_manager',
                registry=service_registry,
                security_manager=security_manager,
                metrics_manager=metrics_manager,
                health_checker=health_checker,
                message_queue=message_queue,
                event_bus=event_bus
            )
            microservice_manager = MicroserviceManager(config=microservice_config)
            await microservice_manager.initialize()
            system_components['microservice_manager'] = microservice_manager
            
            # 17. 服务编排器
            orchestrator_config = OrchestratorConfig(
                name='system_orchestrator',
                registry=service_registry,
                microservice_manager=microservice_manager,
                security_manager=security_manager,
                metrics_manager=metrics_manager,
                health_checker=health_checker,
                event_bus=event_bus,
                load_balancer=load_balancer
            )
            service_orchestrator = ServiceOrchestrator(config=orchestrator_config)
            await service_orchestrator.initialize()
            system_components['service_orchestrator'] = service_orchestrator
            
            # 等待所有组件初始化完成
            await asyncio.sleep(2)
            
            yield system_components
            
        finally:
            # 清理所有组件
            cleanup_order = [
                'service_orchestrator', 'microservice_manager', 'api_gateway',
                'load_balancer', 'message_queue', 'service_registry',
                'validation_service', 'health_checker', 'security_manager',
                'security_service', 'security_sandbox', 'permission_manager',
                'threat_detector', 'audit_logger', 'metrics_manager',
                'event_bus', 'storage_manager'
            ]
            
            for component_name in cleanup_order:
                if component_name in system_components:
                    try:
                        await system_components[component_name].shutdown()
                    except Exception as e:
                        logging.warning(f"Error shutting down {component_name}: {e}")

    async def test_system_startup_and_initialization(self, full_system):
        """测试系统启动和初始化"""
        system = full_system
        
        # 验证所有核心组件都已初始化
        required_components = [
            'storage_manager', 'event_bus', 'metrics_manager', 'audit_logger',
            'security_manager', 'service_registry', 'microservice_manager',
            'service_orchestrator', 'api_gateway', 'health_checker'
        ]
        
        for component_name in required_components:
            assert component_name in system, f"Missing component: {component_name}"
            component = system[component_name]
            assert hasattr(component, 'is_initialized')
            assert component.is_initialized, f"Component not initialized: {component_name}"
        
        # 验证组件间依赖关系
        # 安全管理器应该有所有必要的依赖
        security_manager = system['security_manager']
        assert security_manager.security_service is not None
        assert security_manager.permission_manager is not None
        assert security_manager.audit_logger is not None
        
        # 服务编排器应该有所有必要的依赖
        orchestrator = system['service_orchestrator']
        assert orchestrator.registry is not None
        assert orchestrator.microservice_manager is not None
        assert orchestrator.security_manager is not None

    async def test_end_to_end_service_deployment(self, full_system):
        """测试端到端服务部署"""
        system = full_system
        orchestrator = system['service_orchestrator']
        registry = system['service_registry']
        security_manager = system['security_manager']
        audit_logger = system['audit_logger']
        
        # 创建管理员安全上下文
        admin_context = SecurityContext(
            user_id='admin_user',
            username='admin',
            roles=['admin'],
            permissions=['service:deploy', 'service:manage'],
            token='admin_jwt_token'
        )
        
        # 定义要部署的服务
        service_specs = [
            {
                'name': 'user_service',
                'version': '1.0.0',
                'image': 'user-service:1.0.0',
                'replicas': 2,
                'ports': [8080],
                'environment': {
                    'DB_HOST': 'localhost',
                    'DB_PORT': '5432'
                },
                'security_level': 'medium',
                'health_check': {
                    'path': '/health',
                    'interval': 30
                }
            },
            {
                'name': 'order_service',
                'version': '1.0.0',
                'image': 'order-service:1.0.0',
                'replicas': 3,
                'ports': [8081],
                'dependencies': ['user_service'],
                'security_level': 'high',
                'health_check': {
                    'path': '/health',
                    'interval': 30
                }
            },
            {
                'name': 'notification_service',
                'version': '1.0.0',
                'image': 'notification-service:1.0.0',
                'replicas': 1,
                'ports': [8082],
                'dependencies': ['user_service', 'order_service'],
                'security_level': 'low',
                'health_check': {
                    'path': '/health',
                    'interval': 60
                }
            }
        ]
        
        # 部署服务
        deployed_services = []
        for service_spec in service_specs:
            deployment_result = await orchestrator.deploy_service(
                service_spec, admin_context
            )
            
            assert deployment_result.success is True
            assert deployment_result.service_id is not None
            
            deployed_services.append({
                'spec': service_spec,
                'service_id': deployment_result.service_id,
                'instances': deployment_result.instances
            })
        
        # 验证服务注册
        for service in deployed_services:
            service_info = await registry.get_service(service['service_id'])
            assert service_info is not None
            assert service_info.name == service['spec']['name']
            assert service_info.status == 'running'
        
        # 验证服务依赖关系
        order_service = next(s for s in deployed_services if s['spec']['name'] == 'order_service')
        order_service_info = await registry.get_service(order_service['service_id'])
        
        # 订单服务应该能访问用户服务
        user_service = next(s for s in deployed_services if s['spec']['name'] == 'user_service')
        dependencies = await orchestrator.get_service_dependencies(order_service['service_id'])
        assert user_service['service_id'] in [dep.service_id for dep in dependencies]
        
        # 验证审计日志记录了部署事件
        deployment_events = await audit_logger.get_events_by_type('service_deployment')
        assert len(deployment_events) >= len(service_specs)

    async def test_secure_api_request_flow(self, full_system):
        """测试安全API请求流程"""
        system = full_system
        api_gateway = system['api_gateway']
        security_manager = system['security_manager']
        load_balancer = system['load_balancer']
        audit_logger = system['audit_logger']
        
        # 注册用户并获取认证令牌
        user_credentials = {
            'username': 'api_user',
            'password': 'secure_password_789',
            'email': 'api_user@example.com',
            'roles': ['user', 'api_access']
        }
        
        user_id = await security_manager.register_user(
            user_credentials['username'],
            user_credentials['password'],
            user_credentials['email'],
            user_credentials['roles']
        )
        
        auth_result = await security_manager.authenticate(
            user_credentials['username'],
            user_credentials['password']
        )
        
        assert auth_result.success is True
        jwt_token = auth_result.token
        
        # 配置API路由和后端服务
        api_routes = [
            {
                'path': '/api/users/*',
                'backend': 'user_service',
                'security_level': 'medium',
                'required_roles': ['user'],
                'required_permissions': ['user:read']
            },
            {
                'path': '/api/orders/*',
                'backend': 'order_service',
                'security_level': 'high',
                'required_roles': ['user'],
                'required_permissions': ['order:read', 'order:write']
            },
            {
                'path': '/api/admin/*',
                'backend': 'admin_service',
                'security_level': 'high',
                'required_roles': ['admin'],
                'required_permissions': ['admin:all']
            }
        ]
        
        for route in api_routes:
            await api_gateway.add_secure_route(route)
        
        # 模拟后端服务实例
        backend_services = {
            'user_service': [
                {'host': 'localhost', 'port': 8080, 'weight': 1},
                {'host': 'localhost', 'port': 8081, 'weight': 1}
            ],
            'order_service': [
                {'host': 'localhost', 'port': 8090, 'weight': 1},
                {'host': 'localhost', 'port': 8091, 'weight': 1},
                {'host': 'localhost', 'port': 8092, 'weight': 1}
            ]
        }
        
        for service_name, instances in backend_services.items():
            for instance in instances:
                await load_balancer.add_backend(service_name, instance)
        
        # 模拟后端服务响应
        async def mock_backend_handler(service_name: str, request_data: dict, context: SecurityContext):
            return {
                'service': service_name,
                'status': 'success',
                'data': f'Response from {service_name}',
                'user_id': context.user_id if context else None,
                'timestamp': datetime.now().isoformat()
            }
        
        api_gateway.set_backend_handler(mock_backend_handler)
        
        # 测试API请求
        test_requests = [
            {
                'method': 'GET',
                'path': '/api/users/profile',
                'headers': {'Authorization': f'Bearer {jwt_token}'},
                'expected_status': 200,
                'expected_service': 'user_service'
            },
            {
                'method': 'POST',
                'path': '/api/orders',
                'headers': {'Authorization': f'Bearer {jwt_token}'},
                'data': {'product_id': 123, 'quantity': 2},
                'expected_status': 403  # 用户没有order:write权限
            },
            {
                'method': 'GET',
                'path': '/api/admin/settings',
                'headers': {'Authorization': f'Bearer {jwt_token}'},
                'expected_status': 403  # 用户不是管理员
            },
            {
                'method': 'GET',
                'path': '/api/users/list',
                'headers': {},  # 无认证令牌
                'expected_status': 401
            }
        ]
        
        # 处理测试请求
        for request in test_requests:
            try:
                # 解析JWT令牌获取安全上下文
                security_context = None
                if 'Authorization' in request['headers']:
                    token = request['headers']['Authorization'].replace('Bearer ', '')
                    security_context = await security_manager.validate_token(token)
                
                response = await api_gateway.handle_request(
                    request['method'],
                    request['path'],
                    request.get('data', {}),
                    request['headers'],
                    security_context
                )
                
                if request['expected_status'] == 200:
                    assert response['status'] == 'success'
                    if 'expected_service' in request:
                        assert response['service'] == request['expected_service']
                else:
                    # 不应该到达这里
                    assert False, f"Expected status {request['expected_status']} but got success"
                    
            except Exception as e:
                if request['expected_status'] == 401:
                    assert 'authentication' in str(e).lower()
                elif request['expected_status'] == 403:
                    assert 'authorization' in str(e).lower()
                else:
                    raise e
        
        # 验证审计日志记录了所有API请求
        api_events = await audit_logger.get_events_by_type('api_request')
        assert len(api_events) >= len(test_requests)

    async def test_system_monitoring_and_alerting(self, full_system):
        """测试系统监控和告警"""
        system = full_system
        metrics_manager = system['metrics_manager']
        health_checker = system['health_checker']
        threat_detector = system['threat_detector']
        event_bus = system['event_bus']
        
        # 收集的告警事件
        alerts = []
        
        async def alert_handler(event):
            if event.type in [EventType.HEALTH_CHECK_FAILED, EventType.SECURITY_THREAT_DETECTED, EventType.PERFORMANCE_DEGRADED]:
                alerts.append(event)
        
        # 注册告警处理器
        await event_bus.subscribe(EventType.HEALTH_CHECK_FAILED, alert_handler)
        await event_bus.subscribe(EventType.SECURITY_THREAT_DETECTED, alert_handler)
        await event_bus.subscribe(EventType.PERFORMANCE_DEGRADED, alert_handler)
        
        # 模拟系统负载
        await self._simulate_system_load(system)
        
        # 等待指标收集
        await asyncio.sleep(3)
        
        # 获取系统指标
        system_metrics = await metrics_manager.get_all_metrics()
        
        assert 'system' in system_metrics
        assert 'application' in system_metrics
        assert 'security' in system_metrics
        
        # 验证系统指标
        system_stats = system_metrics['system']
        assert 'cpu_usage' in system_stats
        assert 'memory_usage' in system_stats
        assert 'disk_usage' in system_stats
        
        # 验证应用指标
        app_stats = system_metrics['application']
        assert 'request_count' in app_stats
        assert 'response_time' in app_stats
        assert 'error_rate' in app_stats
        
        # 验证安全指标
        security_stats = system_metrics['security']
        assert 'authentication_success_rate' in security_stats
        assert 'authorization_grant_rate' in security_stats
        assert 'threat_detection_count' in security_stats
        
        # 检查健康状态
        health_status = await health_checker.get_overall_health()
        assert health_status is not None
        assert health_status.status in ['healthy', 'degraded', 'unhealthy']
        
        # 模拟异常情况触发告警
        await self._simulate_system_issues(system)
        
        # 等待告警处理
        await asyncio.sleep(2)
        
        # 验证告警被触发
        assert len(alerts) > 0
        
        # 验证不同类型的告警
        alert_types = [alert.type for alert in alerts]
        assert EventType.PERFORMANCE_DEGRADED in alert_types or \
               EventType.SECURITY_THREAT_DETECTED in alert_types

    async def test_data_flow_and_consistency(self, full_system):
        """测试数据流和一致性"""
        system = full_system
        storage_manager = system['storage_manager']
        message_queue = system['message_queue']
        event_bus = system['event_bus']
        audit_logger = system['audit_logger']
        
        # 测试数据存储和检索
        test_data = {
            'user_profiles': [
                {'id': 1, 'name': 'Alice', 'email': 'alice@example.com'},
                {'id': 2, 'name': 'Bob', 'email': 'bob@example.com'},
                {'id': 3, 'name': 'Charlie', 'email': 'charlie@example.com'}
            ],
            'orders': [
                {'id': 101, 'user_id': 1, 'product': 'Laptop', 'amount': 999.99},
                {'id': 102, 'user_id': 2, 'product': 'Phone', 'amount': 599.99}
            ],
            'system_config': {
                'api_version': 'v1',
                'max_connections': 1000,
                'timeout': 30
            }
        }
        
        # 存储测试数据
        for data_type, data_items in test_data.items():
            await storage_manager.set_data(data_type, data_items)
        
        # 验证数据存储
        for data_type, expected_data in test_data.items():
            stored_data = await storage_manager.get_data(data_type)
            assert stored_data == expected_data
        
        # 测试消息队列数据流
        processed_messages = []
        
        async def message_processor(message, context):
            processed_messages.append({
                'queue': message.queue,
                'data': message.data,
                'processed_at': datetime.now().isoformat()
            })
        
        # 创建消息队列并注册处理器
        await message_queue.create_queue('data_processing')
        await message_queue.register_consumer('data_processing', message_processor)
        
        # 发送测试消息
        test_messages = [
            {'type': 'user_created', 'user_id': 1, 'timestamp': datetime.now().isoformat()},
            {'type': 'order_placed', 'order_id': 101, 'user_id': 1, 'timestamp': datetime.now().isoformat()},
            {'type': 'payment_processed', 'order_id': 101, 'amount': 999.99, 'timestamp': datetime.now().isoformat()}
        ]
        
        for message in test_messages:
            await message_queue.send_message('data_processing', message)
        
        # 等待消息处理
        await asyncio.sleep(1)
        
        # 验证消息处理
        assert len(processed_messages) == len(test_messages)
        
        # 测试事件总线数据流
        published_events = []
        received_events = []
        
        async def event_handler(event):
            received_events.append(event)
        
        await event_bus.subscribe(EventType.DATA_UPDATED, event_handler)
        
        # 发布测试事件
        test_events = [
            EventData(type=EventType.DATA_UPDATED, source='storage', data={'table': 'users', 'action': 'insert'}),
            EventData(type=EventType.DATA_UPDATED, source='storage', data={'table': 'orders', 'action': 'update'}),
            EventData(type=EventType.DATA_UPDATED, source='storage', data={'table': 'config', 'action': 'delete'})
        ]
        
        for event in test_events:
            await event_bus.publish(event)
            published_events.append(event)
        
        # 等待事件处理
        await asyncio.sleep(0.5)
        
        # 验证事件传播
        assert len(received_events) == len(published_events)
        
        # 验证审计日志记录了数据操作
        data_events = await audit_logger.get_events_by_type('data_operation')
        assert len(data_events) > 0

    async def test_system_scalability_and_performance(self, full_system):
        """测试系统可扩展性和性能"""
        system = full_system
        load_balancer = system['load_balancer']
        metrics_manager = system['metrics_manager']
        service_registry = system['service_registry']
        
        # 注册多个服务实例进行负载测试
        service_instances = []
        for i in range(5):
            service_info = ServiceInfo(
                name=f'test_service_{i}',
                version='1.0.0',
                host='localhost',
                port=8000 + i,
                status='running',
                metadata={'instance_id': i}
            )
            
            service_id = await service_registry.register_service(service_info)
            service_instances.append((service_id, service_info))
            
            # 添加到负载均衡器
            await load_balancer.add_backend('test_service', {
                'host': service_info.host,
                'port': service_info.port,
                'weight': 1,
                'service_id': service_id
            })
        
        # 模拟并发请求
        async def simulate_request(request_id: int):
            start_time = time.time()
            
            # 通过负载均衡器选择服务实例
            backend = await load_balancer.select_backend('test_service')
            
            # 模拟请求处理时间
            await asyncio.sleep(0.01)  # 10ms
            
            end_time = time.time()
            response_time = end_time - start_time
            
            # 记录性能指标
            await metrics_manager.record_metric('request_response_time', response_time)
            await metrics_manager.record_metric('request_count', 1)
            
            return {
                'request_id': request_id,
                'backend': backend,
                'response_time': response_time
            }
        
        # 并发执行大量请求
        concurrent_requests = 100
        start_time = time.time()
        
        tasks = [simulate_request(i) for i in range(concurrent_requests)]
        results = await asyncio.gather(*tasks)
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # 验证负载分布
        backend_counts = {}
        for result in results:
            backend_key = f"{result['backend']['host']}:{result['backend']['port']}"
            backend_counts[backend_key] = backend_counts.get(backend_key, 0) + 1
        
        # 验证负载均衡效果（应该相对均匀分布）
        assert len(backend_counts) == len(service_instances)
        
        # 计算负载分布的标准差，应该相对较小
        import statistics
        counts = list(backend_counts.values())
        std_dev = statistics.stdev(counts) if len(counts) > 1 else 0
        mean_count = statistics.mean(counts)
        coefficient_of_variation = std_dev / mean_count if mean_count > 0 else 0
        
        # 负载分布的变异系数应该小于0.5（相对均匀）
        assert coefficient_of_variation < 0.5
        
        # 验证性能指标
        performance_metrics = await metrics_manager.get_performance_metrics()
        
        assert 'request_count' in performance_metrics
        assert 'request_response_time' in performance_metrics
        
        total_requests = performance_metrics['request_count']
        avg_response_time = performance_metrics['request_response_time']
        
        assert total_requests >= concurrent_requests
        assert avg_response_time < 0.1  # 平均响应时间应该小于100ms
        
        # 计算吞吐量
        throughput = concurrent_requests / total_time
        assert throughput > 50  # 每秒至少处理50个请求

    async def test_system_fault_tolerance(self, full_system):
        """测试系统容错能力"""
        system = full_system
        health_checker = system['health_checker']
        service_registry = system['service_registry']
        load_balancer = system['load_balancer']
        event_bus = system['event_bus']
        
        # 故障事件收集
        fault_events = []
        
        async def fault_event_handler(event):
            fault_events.append(event)
        
        await event_bus.subscribe(EventType.SERVICE_FAILED, fault_event_handler)
        await event_bus.subscribe(EventType.SERVICE_RECOVERED, fault_event_handler)
        
        # 注册测试服务
        service_instances = []
        for i in range(3):
            service_info = ServiceInfo(
                name=f'fault_test_service_{i}',
                version='1.0.0',
                host='localhost',
                port=9000 + i,
                status='running'
            )
            
            service_id = await service_registry.register_service(service_info)
            service_instances.append((service_id, service_info))
            
            # 添加到负载均衡器
            await load_balancer.add_backend('fault_test_service', {
                'host': service_info.host,
                'port': service_info.port,
                'service_id': service_id
            })
            
            # 注册健康检查
            await health_checker.register_service(service_id, {
                'check_url': f'http://{service_info.host}:{service_info.port}/health',
                'interval': 1,
                'timeout': 0.5
            })
        
        # 等待初始健康检查
        await asyncio.sleep(2)
        
        # 模拟服务故障
        failed_service_id = service_instances[0][0]
        
        # 标记服务为不健康
        await health_checker.mark_service_unhealthy(failed_service_id, 'Simulated failure')
        
        # 等待故障检测和处理
        await asyncio.sleep(2)
        
        # 验证故障检测
        service_health = await health_checker.get_service_health(failed_service_id)
        assert service_health.status == HealthStatus.UNHEALTHY
        
        # 验证负载均衡器移除了故障服务
        available_backends = await load_balancer.get_healthy_backends('fault_test_service')
        assert len(available_backends) == 2  # 应该只剩2个健康的服务
        
        # 验证服务注册中心更新了服务状态
        service_info = await service_registry.get_service(failed_service_id)
        assert service_info.status == 'unhealthy'
        
        # 模拟服务恢复
        await health_checker.mark_service_healthy(failed_service_id)
        
        # 等待恢复处理
        await asyncio.sleep(2)
        
        # 验证服务恢复
        service_health = await health_checker.get_service_health(failed_service_id)
        assert service_health.status == HealthStatus.HEALTHY
        
        # 验证负载均衡器重新添加了恢复的服务
        available_backends = await load_balancer.get_healthy_backends('fault_test_service')
        assert len(available_backends) == 3  # 应该恢复到3个服务
        
        # 验证故障事件被记录
        assert len(fault_events) >= 2  # 至少有故障和恢复事件
        
        event_types = [event.type for event in fault_events]
        assert EventType.SERVICE_FAILED in event_types
        assert EventType.SERVICE_RECOVERED in event_types

    async def test_system_shutdown_and_cleanup(self, full_system):
        """测试系统关闭和清理"""
        system = full_system
        
        # 记录关闭前的状态
        initial_states = {}
        for component_name, component in system.items():
            if hasattr(component, 'is_initialized'):
                initial_states[component_name] = component.is_initialized
        
        # 验证所有组件都在运行
        for component_name, is_initialized in initial_states.items():
            assert is_initialized, f"Component {component_name} was not initialized"
        
        # 执行优雅关闭
        shutdown_order = [
            'service_orchestrator', 'microservice_manager', 'api_gateway',
            'load_balancer', 'message_queue', 'service_registry',
            'validation_service', 'health_checker', 'security_manager',
            'security_service', 'security_sandbox', 'permission_manager',
            'threat_detector', 'audit_logger', 'metrics_manager',
            'event_bus', 'storage_manager'
        ]
        
        # 记录关闭时间
        shutdown_times = {}
        
        for component_name in shutdown_order:
            if component_name in system:
                component = system[component_name]
                
                start_time = time.time()
                await component.shutdown()
                end_time = time.time()
                
                shutdown_times[component_name] = end_time - start_time
                
                # 验证组件已关闭
                if hasattr(component, 'is_initialized'):
                    assert not component.is_initialized, f"Component {component_name} not properly shutdown"
        
        # 验证关闭时间合理（每个组件关闭时间应该小于5秒）
        for component_name, shutdown_time in shutdown_times.items():
            assert shutdown_time < 5.0, f"Component {component_name} took too long to shutdown: {shutdown_time}s"
        
        # 验证总关闭时间
        total_shutdown_time = sum(shutdown_times.values())
        assert total_shutdown_time < 30.0, f"Total shutdown time too long: {total_shutdown_time}s"

    async def _simulate_system_load(self, system):
        """模拟系统负载"""
        metrics_manager = system['metrics_manager']
        
        # 模拟CPU和内存使用
        await metrics_manager.record_metric('cpu_usage', 75.5)
        await metrics_manager.record_metric('memory_usage', 68.2)
        await metrics_manager.record_metric('disk_usage', 45.8)
        
        # 模拟API请求
        for i in range(100):
            await metrics_manager.record_metric('request_count', 1)
            await metrics_manager.record_metric('response_time', 0.05 + (i % 10) * 0.01)
            if i % 20 == 0:  # 5% 错误率
                await metrics_manager.record_metric('error_count', 1)

    async def _simulate_system_issues(self, system):
        """模拟系统问题"""
        metrics_manager = system['metrics_manager']
        threat_detector = system['threat_detector']
        event_bus = system['event_bus']
        
        # 模拟性能问题
        await metrics_manager.record_metric('cpu_usage', 95.0)  # 高CPU使用率
        await metrics_manager.record_metric('response_time', 2.0)  # 高响应时间
        await metrics_manager.record_metric('error_rate', 15.0)  # 高错误率
        
        # 发布性能降级事件
        await event_bus.publish(EventData(
            type=EventType.PERFORMANCE_DEGRADED,
            source='metrics_manager',
            data={'cpu_usage': 95.0, 'response_time': 2.0}
        ))
        
        # 模拟安全威胁
        suspicious_activity = {
            'type': 'brute_force_attack',
            'source_ip': '192.168.1.100',
            'target_user': 'admin',
            'failed_attempts': 15
        }
        
        threat_level = await threat_detector.analyze_activity(suspicious_activity)
        
        if threat_level >= 0.7:  # 高威胁级别
            await event_bus.publish(EventData(
                type=EventType.SECURITY_THREAT_DETECTED,
                source='threat_detector',
                data={'threat_level': threat_level, 'activity': suspicious_activity}
            ))
