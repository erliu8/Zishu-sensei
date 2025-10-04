# -*- coding: utf-8 -*-
"""
微服务集成测试

测试微服务间的通信和协调
"""

import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

from zishu.core.microservice import MicroserviceManager, MicroserviceConfig
from zishu.core.registry import ServiceRegistry, RegistryConfig
from zishu.core.orchestrator import ServiceOrchestrator, OrchestrationConfig
from zishu.core.event_bus import EventBus, EventBusConfig
from zishu.core.health import HealthChecker, HealthConfig
from zishu.core.validation import ValidationManager, ValidationConfig
from zishu.security.manager import SecurityManager, SecurityConfig
from zishu.metrics.manager import MetricsManager, MetricsConfig
from zishu.storage.manager import StorageManager, StorageManagerConfig
from zishu.communication.gateway import APIGateway, GatewayConfig
from zishu.communication.load_balancer import LoadBalancer, LoadBalancerConfig
from zishu.communication.circuit_breaker import CircuitBreaker, CircuitBreakerConfig
from zishu.communication.message_queue import MessageQueue, MessageQueueConfig
from zishu.core.types import (
    ServiceInfo, ServiceStatus, ServiceEvent, HealthStatus,
    MessageType, EventType, SecurityContext, MetricType
)
from zishu.core.exceptions import (
    MicroserviceException, RegistryException, OrchestrationException,
    CommunicationException, SecurityException
)

from tests.utils.microservice_test_utils import MicroserviceTestUtils


class TestMicroserviceIntegration:
    """微服务集成测试类"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    @pytest.fixture
    async def microservice_cluster(self, temp_dir):
        """创建微服务集群"""
        # 服务注册中心
        registry_config = RegistryConfig(
            name='test_registry',
            backend='memory',
            enable_health_check=True,
            health_check_interval=5
        )
        registry = ServiceRegistry(config=registry_config)
        await registry.initialize()
        
        # 事件总线
        event_bus_config = EventBusConfig(
            name='test_event_bus',
            backend='memory',
            enable_persistence=False
        )
        event_bus = EventBus(config=event_bus_config)
        await event_bus.initialize()
        
        # 安全管理器
        security_config = SecurityConfig(
            name='test_security',
            enable_authentication=True,
            enable_authorization=True,
            enable_encryption=True
        )
        security_manager = SecurityManager(config=security_config)
        await security_manager.initialize()
        
        # 指标管理器
        metrics_config = MetricsConfig(
            name='test_metrics',
            enable_collection=True,
            collection_interval=1
        )
        metrics_manager = MetricsManager(config=metrics_config)
        await metrics_manager.initialize()
        
        # 存储管理器
        storage_config = StorageManagerConfig(
            name='test_storage',
            default_backend='memory'
        )
        storage_manager = StorageManager(config=storage_config)
        await storage_manager.initialize()
        
        # 微服务管理器
        microservice_config = MicroserviceConfig(
            name='test_microservice_manager',
            registry=registry,
            event_bus=event_bus,
            security_manager=security_manager,
            metrics_manager=metrics_manager,
            storage_manager=storage_manager
        )
        microservice_manager = MicroserviceManager(config=microservice_config)
        await microservice_manager.initialize()
        
        yield {
            'microservice_manager': microservice_manager,
            'registry': registry,
            'event_bus': event_bus,
            'security_manager': security_manager,
            'metrics_manager': metrics_manager,
            'storage_manager': storage_manager
        }
        
        # 清理
        await microservice_manager.shutdown()
        await storage_manager.shutdown()
        await metrics_manager.shutdown()
        await security_manager.shutdown()
        await event_bus.shutdown()
        await registry.shutdown()

    async def test_service_registration_and_discovery(self, microservice_cluster):
        """测试服务注册和发现"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        registry = cluster['registry']
        
        # 创建测试服务
        service_configs = [
            {
                'name': 'user_service',
                'version': '1.0.0',
                'host': 'localhost',
                'port': 8001,
                'endpoints': ['/users', '/users/{id}'],
                'health_check_url': '/health'
            },
            {
                'name': 'order_service',
                'version': '1.0.0',
                'host': 'localhost',
                'port': 8002,
                'endpoints': ['/orders', '/orders/{id}'],
                'health_check_url': '/health'
            },
            {
                'name': 'payment_service',
                'version': '1.0.0',
                'host': 'localhost',
                'port': 8003,
                'endpoints': ['/payments', '/payments/{id}'],
                'health_check_url': '/health'
            }
        ]
        
        # 注册服务
        registered_services = []
        for config in service_configs:
            service_info = ServiceInfo(**config)
            service_id = await microservice_manager.register_service(service_info)
            registered_services.append(service_id)
        
        # 验证服务已注册
        assert len(registered_services) == 3
        
        # 服务发现
        discovered_services = await registry.discover_services()
        assert len(discovered_services) == 3
        
        service_names = [service.name for service in discovered_services]
        assert 'user_service' in service_names
        assert 'order_service' in service_names
        assert 'payment_service' in service_names
        
        # 按名称发现特定服务
        user_service = await registry.discover_service('user_service')
        assert user_service is not None
        assert user_service.name == 'user_service'
        assert user_service.port == 8001

    async def test_inter_service_communication(self, microservice_cluster):
        """测试服务间通信"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        event_bus = cluster['event_bus']
        
        # 创建通信服务
        async def user_service_handler(message):
            """用户服务消息处理器"""
            if message.type == MessageType.REQUEST:
                if message.data.get('action') == 'get_user':
                    return {
                        'user_id': message.data['user_id'],
                        'name': f"User {message.data['user_id']}",
                        'email': f"user{message.data['user_id']}@example.com"
                    }
            return None
        
        async def order_service_handler(message):
            """订单服务消息处理器"""
            if message.type == MessageType.REQUEST:
                if message.data.get('action') == 'create_order':
                    # 调用用户服务获取用户信息
                    user_request = {
                        'action': 'get_user',
                        'user_id': message.data['user_id']
                    }
                    user_response = await microservice_manager.send_request(
                        'user_service', user_request
                    )
                    
                    return {
                        'order_id': f"order_{message.data['user_id']}_001",
                        'user_info': user_response,
                        'items': message.data.get('items', []),
                        'total': message.data.get('total', 0)
                    }
            return None
        
        # 注册服务处理器
        await microservice_manager.register_service_handler('user_service', user_service_handler)
        await microservice_manager.register_service_handler('order_service', order_service_handler)
        
        # 测试服务间通信
        order_request = {
            'action': 'create_order',
            'user_id': 123,
            'items': ['item1', 'item2'],
            'total': 99.99
        }
        
        order_response = await microservice_manager.send_request('order_service', order_request)
        
        assert order_response is not None
        assert 'order_id' in order_response
        assert 'user_info' in order_response
        assert order_response['user_info']['user_id'] == 123
        assert order_response['user_info']['name'] == 'User 123'

    async def test_event_driven_communication(self, microservice_cluster):
        """测试事件驱动通信"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        event_bus = cluster['event_bus']
        
        # 事件处理结果收集
        handled_events = []
        
        # 用户服务事件处理器
        async def user_event_handler(event):
            if event.type == EventType.USER_CREATED:
                handled_events.append({
                    'service': 'user_service',
                    'event_type': event.type,
                    'data': event.data
                })
        
        # 通知服务事件处理器
        async def notification_event_handler(event):
            if event.type == EventType.USER_CREATED:
                # 发送欢迎邮件
                handled_events.append({
                    'service': 'notification_service',
                    'event_type': event.type,
                    'action': 'send_welcome_email',
                    'user_id': event.data['user_id']
                })
        
        # 分析服务事件处理器
        async def analytics_event_handler(event):
            if event.type == EventType.USER_CREATED:
                # 记录用户注册分析
                handled_events.append({
                    'service': 'analytics_service',
                    'event_type': event.type,
                    'action': 'track_user_registration',
                    'user_id': event.data['user_id']
                })
        
        # 注册事件处理器
        await event_bus.subscribe(EventType.USER_CREATED, user_event_handler)
        await event_bus.subscribe(EventType.USER_CREATED, notification_event_handler)
        await event_bus.subscribe(EventType.USER_CREATED, analytics_event_handler)
        
        # 发布用户创建事件
        user_created_event = ServiceEvent(
            type=EventType.USER_CREATED,
            source='user_service',
            data={
                'user_id': 456,
                'name': 'John Doe',
                'email': 'john@example.com',
                'created_at': datetime.now().isoformat()
            }
        )
        
        await event_bus.publish(user_created_event)
        
        # 等待事件处理
        await asyncio.sleep(0.5)
        
        # 验证事件被所有订阅者处理
        assert len(handled_events) == 3
        
        service_names = [event['service'] for event in handled_events]
        assert 'user_service' in service_names
        assert 'notification_service' in service_names
        assert 'analytics_service' in service_names

    async def test_service_health_monitoring(self, microservice_cluster):
        """测试服务健康监控"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        registry = cluster['registry']
        
        # 创建健康检查器
        health_config = HealthConfig(
            name='test_health_checker',
            check_interval=1,
            timeout_seconds=5,
            failure_threshold=3
        )
        health_checker = HealthChecker(config=health_config)
        await health_checker.initialize()
        
        # 模拟服务健康状态
        service_health_status = {
            'healthy_service': HealthStatus.HEALTHY,
            'unhealthy_service': HealthStatus.UNHEALTHY,
            'degraded_service': HealthStatus.DEGRADED
        }
        
        async def mock_health_check(service_name: str) -> HealthStatus:
            return service_health_status.get(service_name, HealthStatus.UNKNOWN)
        
        # 注册健康检查函数
        health_checker.register_health_check_function(mock_health_check)
        
        # 注册测试服务
        for service_name in service_health_status.keys():
            service_info = ServiceInfo(
                name=service_name,
                version='1.0.0',
                host='localhost',
                port=8000,
                health_check_url='/health'
            )
            await microservice_manager.register_service(service_info)
        
        # 启动健康监控
        await health_checker.start_monitoring()
        
        # 等待健康检查执行
        await asyncio.sleep(2)
        
        # 获取健康状态报告
        health_report = await health_checker.get_health_report()
        
        assert health_report is not None
        assert 'healthy_service' in health_report
        assert 'unhealthy_service' in health_report
        assert 'degraded_service' in health_report
        
        assert health_report['healthy_service'] == HealthStatus.HEALTHY
        assert health_report['unhealthy_service'] == HealthStatus.UNHEALTHY
        assert health_report['degraded_service'] == HealthStatus.DEGRADED
        
        await health_checker.shutdown()

    async def test_service_orchestration(self, microservice_cluster):
        """测试服务编排"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        
        # 创建服务编排器
        orchestration_config = OrchestrationConfig(
            name='test_orchestrator',
            enable_workflow=True,
            enable_saga_pattern=True,
            timeout_seconds=30
        )
        orchestrator = ServiceOrchestrator(config=orchestration_config)
        await orchestrator.initialize()
        
        # 定义工作流步骤
        workflow_steps = [
            {
                'name': 'validate_user',
                'service': 'user_service',
                'action': 'validate',
                'timeout': 5
            },
            {
                'name': 'create_order',
                'service': 'order_service',
                'action': 'create',
                'depends_on': ['validate_user'],
                'timeout': 10
            },
            {
                'name': 'process_payment',
                'service': 'payment_service',
                'action': 'process',
                'depends_on': ['create_order'],
                'timeout': 15
            },
            {
                'name': 'send_confirmation',
                'service': 'notification_service',
                'action': 'send',
                'depends_on': ['process_payment'],
                'timeout': 5
            }
        ]
        
        # 模拟服务响应
        service_responses = {
            'user_service': {'valid': True, 'user_id': 789},
            'order_service': {'order_id': 'order_789_001', 'status': 'created'},
            'payment_service': {'payment_id': 'pay_789_001', 'status': 'completed'},
            'notification_service': {'message_id': 'msg_789_001', 'sent': True}
        }
        
        async def mock_service_call(service_name: str, action: str, data: dict):
            await asyncio.sleep(0.1)  # 模拟网络延迟
            return service_responses.get(service_name, {})
        
        # 注册模拟服务调用
        orchestrator.register_service_caller(mock_service_call)
        
        # 执行工作流
        workflow_data = {
            'user_id': 789,
            'items': ['product1', 'product2'],
            'total_amount': 199.99
        }
        
        workflow_result = await orchestrator.execute_workflow(
            workflow_steps, workflow_data
        )
        
        assert workflow_result.success is True
        assert len(workflow_result.completed_steps) == 4
        assert workflow_result.final_result is not None
        
        # 验证步骤执行顺序
        step_names = [step['name'] for step in workflow_result.completed_steps]
        assert step_names == ['validate_user', 'create_order', 'process_payment', 'send_confirmation']
        
        await orchestrator.shutdown()

    async def test_circuit_breaker_integration(self, microservice_cluster):
        """测试断路器集成"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        
        # 创建断路器
        circuit_breaker_config = CircuitBreakerConfig(
            name='test_circuit_breaker',
            failure_threshold=3,
            recovery_timeout=5,
            call_timeout=2
        )
        circuit_breaker = CircuitBreaker(config=circuit_breaker_config)
        
        # 模拟不稳定的服务
        call_count = 0
        
        async def unstable_service_call():
            nonlocal call_count
            call_count += 1
            
            if call_count <= 5:  # 前5次调用失败
                raise Exception("Service temporarily unavailable")
            else:  # 后续调用成功
                return {"status": "success", "data": "service_response"}
        
        # 使用断路器保护服务调用
        results = []
        for i in range(10):
            try:
                result = await circuit_breaker.call(unstable_service_call)
                results.append(("success", result))
            except Exception as e:
                results.append(("failure", str(e)))
            
            await asyncio.sleep(0.1)
        
        # 验证断路器行为
        success_count = len([r for r in results if r[0] == "success"])
        failure_count = len([r for r in results if r[0] == "failure"])
        
        # 应该有失败（前几次）和成功（断路器恢复后）
        assert failure_count > 0
        assert success_count > 0

    async def test_load_balancing_integration(self, microservice_cluster):
        """测试负载均衡集成"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        
        # 创建负载均衡器
        lb_config = LoadBalancerConfig(
            name='test_load_balancer',
            strategy='round_robin',
            health_check_enabled=True
        )
        load_balancer = LoadBalancer(config=lb_config)
        await load_balancer.initialize()
        
        # 注册多个相同服务的实例
        service_instances = []
        for i in range(3):
            service_info = ServiceInfo(
                name='api_service',
                version='1.0.0',
                host='localhost',
                port=8010 + i,
                instance_id=f'api_service_instance_{i}'
            )
            instance_id = await microservice_manager.register_service(service_info)
            service_instances.append(instance_id)
        
        # 将实例添加到负载均衡器
        for instance_id in service_instances:
            await load_balancer.add_backend(instance_id)
        
        # 模拟服务调用
        call_distribution = {}
        
        for _ in range(15):  # 15次调用
            selected_instance = await load_balancer.select_backend()
            
            if selected_instance in call_distribution:
                call_distribution[selected_instance] += 1
            else:
                call_distribution[selected_instance] = 1
        
        # 验证负载分布（轮询策略应该相对均匀）
        assert len(call_distribution) == 3  # 所有实例都被选中
        
        # 每个实例应该被调用5次（15/3）
        for count in call_distribution.values():
            assert count == 5
        
        await load_balancer.shutdown()

    async def test_message_queue_integration(self, microservice_cluster):
        """测试消息队列集成"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        
        # 创建消息队列
        mq_config = MessageQueueConfig(
            name='test_message_queue',
            backend='memory',
            enable_persistence=False,
            max_queue_size=1000
        )
        message_queue = MessageQueue(config=mq_config)
        await message_queue.initialize()
        
        # 创建队列
        await message_queue.create_queue('order_processing')
        await message_queue.create_queue('payment_processing')
        await message_queue.create_queue('notification_queue')
        
        # 消息处理结果
        processed_messages = []
        
        # 订单处理服务
        async def order_processor(message):
            processed_messages.append({
                'processor': 'order_service',
                'message_id': message.id,
                'data': message.data
            })
            
            # 处理完订单后发送支付消息
            payment_message = {
                'order_id': message.data['order_id'],
                'amount': message.data['amount'],
                'user_id': message.data['user_id']
            }
            await message_queue.send_message('payment_processing', payment_message)
        
        # 支付处理服务
        async def payment_processor(message):
            processed_messages.append({
                'processor': 'payment_service',
                'message_id': message.id,
                'data': message.data
            })
            
            # 处理完支付后发送通知消息
            notification_message = {
                'user_id': message.data['user_id'],
                'type': 'payment_confirmation',
                'order_id': message.data['order_id']
            }
            await message_queue.send_message('notification_queue', notification_message)
        
        # 通知处理服务
        async def notification_processor(message):
            processed_messages.append({
                'processor': 'notification_service',
                'message_id': message.id,
                'data': message.data
            })
        
        # 注册消息处理器
        await message_queue.register_consumer('order_processing', order_processor)
        await message_queue.register_consumer('payment_processing', payment_processor)
        await message_queue.register_consumer('notification_queue', notification_processor)
        
        # 发送初始订单消息
        order_message = {
            'order_id': 'order_001',
            'user_id': 123,
            'items': ['item1', 'item2'],
            'amount': 99.99
        }
        
        await message_queue.send_message('order_processing', order_message)
        
        # 等待消息处理链完成
        await asyncio.sleep(1)
        
        # 验证消息处理链
        assert len(processed_messages) == 3
        
        processors = [msg['processor'] for msg in processed_messages]
        assert 'order_service' in processors
        assert 'payment_service' in processors
        assert 'notification_service' in processors
        
        await message_queue.shutdown()

    async def test_api_gateway_integration(self, microservice_cluster):
        """测试API网关集成"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        security_manager = cluster['security_manager']
        
        # 创建API网关
        gateway_config = GatewayConfig(
            name='test_api_gateway',
            host='localhost',
            port=8080,
            enable_authentication=True,
            enable_rate_limiting=True,
            enable_request_logging=True
        )
        api_gateway = APIGateway(config=gateway_config)
        await api_gateway.initialize()
        
        # 注册后端服务
        backend_services = [
            {'name': 'user_service', 'host': 'localhost', 'port': 8001},
            {'name': 'order_service', 'host': 'localhost', 'port': 8002},
            {'name': 'product_service', 'host': 'localhost', 'port': 8003}
        ]
        
        for service in backend_services:
            await api_gateway.register_backend_service(
                service['name'], service['host'], service['port']
            )
        
        # 配置路由规则
        routing_rules = [
            {
                'path': '/api/users/*',
                'backend': 'user_service',
                'methods': ['GET', 'POST', 'PUT', 'DELETE']
            },
            {
                'path': '/api/orders/*',
                'backend': 'order_service',
                'methods': ['GET', 'POST', 'PUT']
            },
            {
                'path': '/api/products/*',
                'backend': 'product_service',
                'methods': ['GET']
            }
        ]
        
        for rule in routing_rules:
            await api_gateway.add_routing_rule(rule)
        
        # 模拟API请求
        test_requests = [
            {
                'method': 'GET',
                'path': '/api/users/123',
                'headers': {'Authorization': 'Bearer valid_token'},
                'expected_backend': 'user_service'
            },
            {
                'method': 'POST',
                'path': '/api/orders',
                'headers': {'Authorization': 'Bearer valid_token'},
                'body': {'user_id': 123, 'items': ['item1']},
                'expected_backend': 'order_service'
            },
            {
                'method': 'GET',
                'path': '/api/products/search',
                'headers': {'Authorization': 'Bearer valid_token'},
                'expected_backend': 'product_service'
            }
        ]
        
        # 模拟后端服务响应
        async def mock_backend_response(service_name: str, request):
            return {
                'service': service_name,
                'status': 'success',
                'data': f'Response from {service_name}',
                'request_path': request.get('path')
            }
        
        api_gateway.set_backend_caller(mock_backend_response)
        
        # 处理测试请求
        responses = []
        for request in test_requests:
            response = await api_gateway.handle_request(request)
            responses.append(response)
        
        # 验证路由正确性
        assert len(responses) == 3
        
        for i, response in enumerate(responses):
            expected_backend = test_requests[i]['expected_backend']
            assert response['service'] == expected_backend
            assert response['status'] == 'success'
        
        await api_gateway.shutdown()

    async def test_security_integration(self, microservice_cluster):
        """测试安全集成"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        security_manager = cluster['security_manager']
        
        # 创建安全上下文
        security_context = SecurityContext(
            user_id='test_user_123',
            roles=['user', 'premium'],
            permissions=['read:profile', 'write:orders'],
            token='test_jwt_token'
        )
        
        # 测试服务间安全通信
        async def secure_service_handler(message, context):
            # 验证安全上下文
            if not context or not context.user_id:
                raise SecurityException("Unauthorized access")
            
            # 检查权限
            required_permission = 'read:profile'
            if required_permission not in context.permissions:
                raise SecurityException("Insufficient permissions")
            
            return {
                'user_id': context.user_id,
                'data': 'Secure service response',
                'permissions': context.permissions
            }
        
        # 注册安全服务处理器
        await microservice_manager.register_secure_service_handler(
            'secure_service', secure_service_handler
        )
        
        # 测试授权访问
        request_data = {'action': 'get_profile'}
        
        response = await microservice_manager.send_secure_request(
            'secure_service', request_data, security_context
        )
        
        assert response is not None
        assert response['user_id'] == 'test_user_123'
        assert 'Secure service response' in response['data']
        
        # 测试未授权访问
        invalid_context = SecurityContext(
            user_id='test_user_456',
            roles=['guest'],
            permissions=['read:public'],  # 缺少required permission
            token='invalid_token'
        )
        
        with pytest.raises(SecurityException):
            await microservice_manager.send_secure_request(
                'secure_service', request_data, invalid_context
            )

    async def test_metrics_integration(self, microservice_cluster):
        """测试指标集成"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        metrics_manager = cluster['metrics_manager']
        
        # 启用服务指标收集
        await microservice_manager.enable_metrics_collection(True)
        
        # 模拟服务调用以生成指标
        for i in range(20):
            # 模拟成功调用
            await microservice_manager.record_service_call(
                service_name='test_service',
                method='GET',
                endpoint='/api/test',
                status_code=200,
                duration_ms=50 + (i % 10) * 10
            )
        
        for i in range(5):
            # 模拟失败调用
            await microservice_manager.record_service_call(
                service_name='test_service',
                method='POST',
                endpoint='/api/test',
                status_code=500,
                duration_ms=100
            )
        
        # 等待指标收集
        await asyncio.sleep(1)
        
        # 获取服务指标
        service_metrics = await metrics_manager.get_service_metrics('test_service')
        
        assert service_metrics is not None
        assert 'request_count' in service_metrics
        assert 'error_rate' in service_metrics
        assert 'average_response_time' in service_metrics
        
        assert service_metrics['request_count'] == 25  # 20 success + 5 failures
        assert service_metrics['error_rate'] == 0.2   # 5/25 = 20%
        assert service_metrics['average_response_time'] > 0

    async def test_storage_integration(self, microservice_cluster):
        """测试存储集成"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        storage_manager = cluster['storage_manager']
        
        # 创建服务专用存储命名空间
        service_namespaces = ['user_service_data', 'order_service_data', 'product_service_data']
        
        for namespace in service_namespaces:
            await storage_manager.create_namespace(namespace)
        
        # 模拟服务数据操作
        test_data = {}
        
        # 用户服务数据
        for i in range(10):
            key = f'user_{i}'
            value = {
                'user_id': i,
                'name': f'User {i}',
                'email': f'user{i}@example.com',
                'created_at': datetime.now().isoformat()
            }
            
            await storage_manager.set_namespaced_data(
                'user_service_data', key, value
            )
            test_data[f'user_service_data:{key}'] = value
        
        # 订单服务数据
        for i in range(5):
            key = f'order_{i}'
            value = {
                'order_id': i,
                'user_id': i % 3,  # 关联到用户
                'items': [f'item_{j}' for j in range(i + 1)],
                'total': (i + 1) * 25.99,
                'status': 'pending'
            }
            
            await storage_manager.set_namespaced_data(
                'order_service_data', key, value
            )
            test_data[f'order_service_data:{key}'] = value
        
        # 验证数据隔离
        user_data = await storage_manager.get_namespace_data('user_service_data')
        order_data = await storage_manager.get_namespace_data('order_service_data')
        
        assert len(user_data) == 10
        assert len(order_data) == 5
        
        # 验证跨服务数据查询
        user_orders = []
        for order_key, order_value in order_data.items():
            user_id = order_value['user_id']
            user_key = f'user_{user_id}'
            
            if user_key in user_data:
                user_orders.append({
                    'order': order_value,
                    'user': user_data[user_key]
                })
        
        assert len(user_orders) == 5  # 所有订单都有对应用户

    async def test_end_to_end_workflow(self, microservice_cluster):
        """测试端到端工作流"""
        cluster = microservice_cluster
        microservice_manager = cluster['microservice_manager']
        event_bus = cluster['event_bus']
        storage_manager = cluster['storage_manager']
        
        # 工作流状态跟踪
        workflow_state = {
            'user_created': False,
            'profile_updated': False,
            'order_created': False,
            'payment_processed': False,
            'notification_sent': False
        }
        
        # 用户服务
        async def user_service_handler(message):
            if message.data.get('action') == 'create_user':
                user_data = message.data['user_data']
                
                # 存储用户数据
                await storage_manager.set_namespaced_data(
                    'users', f"user_{user_data['id']}", user_data
                )
                
                # 发布用户创建事件
                await event_bus.publish(ServiceEvent(
                    type=EventType.USER_CREATED,
                    source='user_service',
                    data=user_data
                ))
                
                workflow_state['user_created'] = True
                return {'status': 'success', 'user_id': user_data['id']}
        
        # 配置文件服务
        async def profile_service_handler(event):
            if event.type == EventType.USER_CREATED:
                profile_data = {
                    'user_id': event.data['id'],
                    'preferences': {'theme': 'light', 'language': 'en'},
                    'settings': {'notifications': True}
                }
                
                await storage_manager.set_namespaced_data(
                    'profiles', f"profile_{event.data['id']}", profile_data
                )
                
                workflow_state['profile_updated'] = True
        
        # 订单服务
        async def order_service_handler(message):
            if message.data.get('action') == 'create_order':
                order_data = message.data['order_data']
                
                # 验证用户存在
                user_data = await storage_manager.get_namespaced_data(
                    'users', f"user_{order_data['user_id']}"
                )
                
                if not user_data:
                    return {'status': 'error', 'message': 'User not found'}
                
                # 创建订单
                await storage_manager.set_namespaced_data(
                    'orders', f"order_{order_data['id']}", order_data
                )
                
                # 发布订单创建事件
                await event_bus.publish(ServiceEvent(
                    type=EventType.ORDER_CREATED,
                    source='order_service',
                    data=order_data
                ))
                
                workflow_state['order_created'] = True
                return {'status': 'success', 'order_id': order_data['id']}
        
        # 支付服务
        async def payment_service_handler(event):
            if event.type == EventType.ORDER_CREATED:
                payment_data = {
                    'order_id': event.data['id'],
                    'amount': event.data['total'],
                    'status': 'completed',
                    'processed_at': datetime.now().isoformat()
                }
                
                await storage_manager.set_namespaced_data(
                    'payments', f"payment_{event.data['id']}", payment_data
                )
                
                # 发布支付完成事件
                await event_bus.publish(ServiceEvent(
                    type=EventType.PAYMENT_COMPLETED,
                    source='payment_service',
                    data=payment_data
                ))
                
                workflow_state['payment_processed'] = True
        
        # 通知服务
        async def notification_service_handler(event):
            if event.type == EventType.PAYMENT_COMPLETED:
                notification_data = {
                    'order_id': event.data['order_id'],
                    'type': 'order_confirmation',
                    'sent_at': datetime.now().isoformat()
                }
                
                await storage_manager.set_namespaced_data(
                    'notifications', f"notification_{event.data['order_id']}", notification_data
                )
                
                workflow_state['notification_sent'] = True
        
        # 注册服务处理器
        await microservice_manager.register_service_handler('user_service', user_service_handler)
        await microservice_manager.register_service_handler('order_service', order_service_handler)
        
        # 注册事件处理器
        await event_bus.subscribe(EventType.USER_CREATED, profile_service_handler)
        await event_bus.subscribe(EventType.ORDER_CREATED, payment_service_handler)
        await event_bus.subscribe(EventType.PAYMENT_COMPLETED, notification_service_handler)
        
        # 执行端到端工作流
        
        # 1. 创建用户
        user_response = await microservice_manager.send_request('user_service', {
            'action': 'create_user',
            'user_data': {
                'id': 999,
                'name': 'Test User',
                'email': 'test@example.com'
            }
        })
        
        assert user_response['status'] == 'success'
        
        # 等待用户创建事件处理
        await asyncio.sleep(0.5)
        
        # 2. 创建订单
        order_response = await microservice_manager.send_request('order_service', {
            'action': 'create_order',
            'order_data': {
                'id': 888,
                'user_id': 999,
                'items': ['product1', 'product2'],
                'total': 149.99
            }
        })
        
        assert order_response['status'] == 'success'
        
        # 等待整个工作流完成
        await asyncio.sleep(1)
        
        # 验证工作流完成
        assert workflow_state['user_created'] is True
        assert workflow_state['profile_updated'] is True
        assert workflow_state['order_created'] is True
        assert workflow_state['payment_processed'] is True
        assert workflow_state['notification_sent'] is True
        
        # 验证数据一致性
        user_data = await storage_manager.get_namespaced_data('users', 'user_999')
        profile_data = await storage_manager.get_namespaced_data('profiles', 'profile_999')
        order_data = await storage_manager.get_namespaced_data('orders', 'order_888')
        payment_data = await storage_manager.get_namespaced_data('payments', 'payment_888')
        notification_data = await storage_manager.get_namespaced_data('notifications', 'notification_888')
        
        assert user_data is not None
        assert profile_data is not None
        assert order_data is not None
        assert payment_data is not None
        assert notification_data is not None
        
        # 验证数据关联
        assert profile_data['user_id'] == user_data['id']
        assert order_data['user_id'] == user_data['id']
        assert payment_data['order_id'] == order_data['id']
        assert notification_data['order_id'] == order_data['id']
