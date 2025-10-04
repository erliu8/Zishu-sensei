# -*- coding: utf-8 -*-
"""
生命周期集成测试

测试系统启动、运行、关闭的完整流程
"""

import pytest
import asyncio
import tempfile
import shutil
import signal
import os
from pathlib import Path
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union

from zishu.core.lifecycle import LifecycleManager, LifecycleConfig, LifecyclePhase
from zishu.core.registry import ServiceRegistry, RegistryConfig
from zishu.core.orchestrator import ServiceOrchestrator, OrchestrationConfig
from zishu.core.event_bus import EventBus, EventBusConfig
from zishu.core.health import HealthChecker, HealthConfig
from zishu.core.validation import ValidationManager, ValidationConfig
from zishu.security.manager import SecurityManager, SecurityConfig
from zishu.metrics.manager import MetricsManager, MetricsConfig
from zishu.storage.manager import StorageManager, StorageManagerConfig
from zishu.communication.gateway import APIGateway, GatewayConfig
from zishu.monitoring.supervisor import ProcessSupervisor, SupervisorConfig
from zishu.deployment.container import ContainerManager, ContainerConfig
from zishu.core.types import (
    ServiceInfo, ServiceStatus, ServiceEvent, HealthStatus,
    LifecycleEvent, LifecycleState, ComponentStatus
)
from zishu.core.exceptions import (
    LifecycleException, StartupException, ShutdownException,
    ComponentException
)

from tests.utils.lifecycle_test_utils import LifecycleTestUtils


class TestLifecycleIntegration:
    """生命周期集成测试类"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir)

    @pytest.fixture
    async def lifecycle_system(self, temp_dir):
        """创建生命周期系统"""
        # 生命周期管理器配置
        lifecycle_config = LifecycleConfig(
            name='test_lifecycle_system',
            startup_timeout=30,
            shutdown_timeout=15,
            health_check_interval=2,
            enable_graceful_shutdown=True,
            enable_dependency_management=True
        )
        
        lifecycle_manager = LifecycleManager(config=lifecycle_config)
        
        yield lifecycle_manager
        
        # 确保系统完全关闭
        if lifecycle_manager.current_phase != LifecyclePhase.STOPPED:
            await lifecycle_manager.shutdown()

    async def test_system_startup_sequence(self, lifecycle_system):
        """测试系统启动序列"""
        lifecycle_manager = lifecycle_system
        
        # 启动状态跟踪
        startup_events = []
        
        async def startup_event_handler(event: LifecycleEvent):
            startup_events.append({
                'phase': event.phase,
                'component': event.component,
                'timestamp': event.timestamp,
                'data': event.data
            })
        
        # 注册启动事件监听器
        lifecycle_manager.register_event_handler(startup_event_handler)
        
        # 定义组件启动顺序
        component_configs = [
            {
                'name': 'storage_manager',
                'priority': 1,  # 最高优先级，首先启动
                'dependencies': [],
                'startup_timeout': 10
            },
            {
                'name': 'security_manager',
                'priority': 2,
                'dependencies': ['storage_manager'],
                'startup_timeout': 8
            },
            {
                'name': 'registry',
                'priority': 3,
                'dependencies': ['storage_manager', 'security_manager'],
                'startup_timeout': 5
            },
            {
                'name': 'event_bus',
                'priority': 3,
                'dependencies': ['storage_manager'],
                'startup_timeout': 5
            },
            {
                'name': 'metrics_manager',
                'priority': 4,
                'dependencies': ['storage_manager', 'event_bus'],
                'startup_timeout': 5
            },
            {
                'name': 'health_checker',
                'priority': 5,
                'dependencies': ['registry', 'metrics_manager'],
                'startup_timeout': 3
            },
            {
                'name': 'api_gateway',
                'priority': 6,  # 最后启动
                'dependencies': ['registry', 'security_manager', 'health_checker'],
                'startup_timeout': 5
            }
        ]
        
        # 模拟组件启动函数
        component_startup_status = {}
        
        async def mock_component_startup(component_name: str):
            """模拟组件启动"""
            await asyncio.sleep(0.1)  # 模拟启动时间
            component_startup_status[component_name] = 'started'
            return True
        
        # 注册组件
        for config in component_configs:
            await lifecycle_manager.register_component(
                name=config['name'],
                startup_func=lambda name=config['name']: mock_component_startup(name),
                shutdown_func=None,
                dependencies=config['dependencies'],
                priority=config['priority'],
                timeout=config['startup_timeout']
            )
        
        # 执行系统启动
        startup_result = await lifecycle_manager.startup()
        
        # 验证启动成功
        assert startup_result.success is True
        assert lifecycle_manager.current_phase == LifecyclePhase.RUNNING
        
        # 验证所有组件都已启动
        assert len(component_startup_status) == len(component_configs)
        for config in component_configs:
            assert component_startup_status[config['name']] == 'started'
        
        # 验证启动顺序（按依赖关系和优先级）
        startup_order = [event['component'] for event in startup_events 
                        if event['phase'] == LifecyclePhase.STARTING]
        
        # 存储管理器应该首先启动
        assert startup_order[0] == 'storage_manager'
        
        # API网关应该最后启动
        assert startup_order[-1] == 'api_gateway'
        
        # 验证依赖关系
        storage_index = startup_order.index('storage_manager')
        security_index = startup_order.index('security_manager')
        registry_index = startup_order.index('registry')
        
        assert storage_index < security_index  # 存储在安全之前
        assert security_index < registry_index  # 安全在注册中心之前

    async def test_system_shutdown_sequence(self, lifecycle_system):
        """测试系统关闭序列"""
        lifecycle_manager = lifecycle_system
        
        # 关闭状态跟踪
        shutdown_events = []
        component_shutdown_status = {}
        
        async def shutdown_event_handler(event: LifecycleEvent):
            shutdown_events.append({
                'phase': event.phase,
                'component': event.component,
                'timestamp': event.timestamp
            })
        
        async def mock_component_shutdown(component_name: str):
            """模拟组件关闭"""
            await asyncio.sleep(0.1)  # 模拟关闭时间
            component_shutdown_status[component_name] = 'stopped'
            return True
        
        # 注册事件监听器
        lifecycle_manager.register_event_handler(shutdown_event_handler)
        
        # 注册测试组件
        components = ['api_gateway', 'health_checker', 'metrics_manager', 
                     'event_bus', 'registry', 'security_manager', 'storage_manager']
        
        for i, component in enumerate(components):
            await lifecycle_manager.register_component(
                name=component,
                startup_func=lambda: True,
                shutdown_func=lambda name=component: mock_component_shutdown(name),
                priority=len(components) - i,  # 反向优先级用于关闭
                timeout=5
            )
        
        # 先启动系统
        await lifecycle_manager.startup()
        assert lifecycle_manager.current_phase == LifecyclePhase.RUNNING
        
        # 执行系统关闭
        shutdown_result = await lifecycle_manager.shutdown()
        
        # 验证关闭成功
        assert shutdown_result.success is True
        assert lifecycle_manager.current_phase == LifecyclePhase.STOPPED
        
        # 验证所有组件都已关闭
        assert len(component_shutdown_status) == len(components)
        for component in components:
            assert component_shutdown_status[component] == 'stopped'
        
        # 验证关闭顺序（与启动顺序相反）
        shutdown_order = [event['component'] for event in shutdown_events 
                         if event['phase'] == LifecyclePhase.STOPPING]
        
        # API网关应该首先关闭
        assert shutdown_order[0] == 'api_gateway'
        
        # 存储管理器应该最后关闭
        assert shutdown_order[-1] == 'storage_manager'

    async def test_graceful_shutdown_with_signal(self, lifecycle_system):
        """测试信号触发的优雅关闭"""
        lifecycle_manager = lifecycle_system
        
        # 关闭状态跟踪
        graceful_shutdown_triggered = False
        shutdown_completed = False
        
        async def graceful_shutdown_handler():
            nonlocal graceful_shutdown_triggered, shutdown_completed
            graceful_shutdown_triggered = True
            
            # 执行优雅关闭
            await lifecycle_manager.graceful_shutdown()
            shutdown_completed = True
        
        # 注册信号处理器
        lifecycle_manager.register_signal_handler(signal.SIGTERM, graceful_shutdown_handler)
        lifecycle_manager.register_signal_handler(signal.SIGINT, graceful_shutdown_handler)
        
        # 注册测试组件
        active_connections = {'count': 5}
        
        async def connection_aware_shutdown():
            """连接感知的关闭"""
            # 等待活动连接完成
            while active_connections['count'] > 0:
                await asyncio.sleep(0.1)
                active_connections['count'] -= 1  # 模拟连接逐渐关闭
            return True
        
        await lifecycle_manager.register_component(
            name='connection_manager',
            startup_func=lambda: True,
            shutdown_func=connection_aware_shutdown,
            priority=1,
            timeout=10
        )
        
        # 启动系统
        await lifecycle_manager.startup()
        
        # 模拟发送SIGTERM信号
        # 注意：在测试环境中我们直接调用处理器而不是发送真实信号
        await graceful_shutdown_handler()
        
        # 验证优雅关闭
        assert graceful_shutdown_triggered is True
        assert shutdown_completed is True
        assert lifecycle_manager.current_phase == LifecyclePhase.STOPPED
        assert active_connections['count'] == 0  # 所有连接都已关闭

    async def test_component_failure_handling(self, lifecycle_system):
        """测试组件故障处理"""
        lifecycle_manager = lifecycle_system
        
        # 故障跟踪
        failure_events = []
        recovery_events = []
        
        async def failure_event_handler(event: LifecycleEvent):
            if event.phase == LifecyclePhase.FAILED:
                failure_events.append(event)
            elif event.phase == LifecyclePhase.RECOVERING:
                recovery_events.append(event)
        
        lifecycle_manager.register_event_handler(failure_event_handler)
        
        # 模拟不稳定的组件
        failure_count = 0
        
        async def unstable_component_startup():
            nonlocal failure_count
            failure_count += 1
            
            if failure_count <= 2:  # 前两次启动失败
                raise ComponentException("Component startup failed")
            else:  # 第三次启动成功
                return True
        
        async def stable_component_startup():
            return True
        
        # 注册组件
        await lifecycle_manager.register_component(
            name='unstable_component',
            startup_func=unstable_component_startup,
            shutdown_func=lambda: True,
            priority=1,
            timeout=5,
            max_retries=3,
            retry_delay=0.1
        )
        
        await lifecycle_manager.register_component(
            name='stable_component',
            startup_func=stable_component_startup,
            shutdown_func=lambda: True,
            priority=2,
            timeout=5
        )
        
        # 启动系统（应该在重试后成功）
        startup_result = await lifecycle_manager.startup()
        
        # 验证最终启动成功
        assert startup_result.success is True
        assert lifecycle_manager.current_phase == LifecyclePhase.RUNNING
        
        # 验证故障和恢复事件
        assert len(failure_events) == 2  # 两次失败
        assert failure_count == 3  # 总共尝试了3次

    async def test_health_monitoring_during_runtime(self, lifecycle_system):
        """测试运行时健康监控"""
        lifecycle_manager = lifecycle_system
        
        # 健康状态跟踪
        health_reports = []
        
        # 组件健康状态
        component_health = {
            'healthy_component': HealthStatus.HEALTHY,
            'degraded_component': HealthStatus.DEGRADED,
            'unhealthy_component': HealthStatus.HEALTHY  # 初始健康，后续变为不健康
        }
        
        async def health_check_function(component_name: str) -> HealthStatus:
            return component_health.get(component_name, HealthStatus.UNKNOWN)
        
        async def health_report_handler(report):
            health_reports.append({
                'timestamp': datetime.now(),
                'report': report
            })
        
        # 配置健康监控
        health_config = HealthConfig(
            name='runtime_health_checker',
            check_interval=0.5,  # 快速检查用于测试
            timeout_seconds=2,
            failure_threshold=2
        )
        
        health_checker = HealthChecker(config=health_config)
        health_checker.register_health_check_function(health_check_function)
        health_checker.register_health_report_handler(health_report_handler)
        
        # 将健康检查器集成到生命周期管理器
        await lifecycle_manager.register_component(
            name='health_checker',
            startup_func=health_checker.initialize,
            shutdown_func=health_checker.shutdown,
            priority=1,
            timeout=5
        )
        
        # 注册被监控的组件
        for component_name in component_health.keys():
            await lifecycle_manager.register_component(
                name=component_name,
                startup_func=lambda: True,
                shutdown_func=lambda: True,
                priority=2,
                timeout=5
            )
        
        # 启动系统
        await lifecycle_manager.startup()
        
        # 启动健康监控
        await health_checker.start_monitoring()
        
        # 运行一段时间
        await asyncio.sleep(1)
        
        # 模拟组件变为不健康
        component_health['unhealthy_component'] = HealthStatus.UNHEALTHY
        
        # 继续监控
        await asyncio.sleep(1)
        
        # 停止监控
        await health_checker.stop_monitoring()
        
        # 验证健康报告
        assert len(health_reports) > 0
        
        # 检查最新的健康报告
        latest_report = health_reports[-1]['report']
        assert 'healthy_component' in latest_report
        assert 'degraded_component' in latest_report
        assert 'unhealthy_component' in latest_report
        
        assert latest_report['healthy_component'] == HealthStatus.HEALTHY
        assert latest_report['degraded_component'] == HealthStatus.DEGRADED
        assert latest_report['unhealthy_component'] == HealthStatus.UNHEALTHY

    async def test_resource_cleanup_on_shutdown(self, lifecycle_system, temp_dir):
        """测试关闭时的资源清理"""
        lifecycle_manager = lifecycle_system
        
        # 资源跟踪
        created_resources = []
        cleaned_resources = []
        
        class TestResource:
            def __init__(self, name: str, resource_type: str):
                self.name = name
                self.resource_type = resource_type
                self.is_active = True
                created_resources.append(self)
            
            async def cleanup(self):
                self.is_active = False
                cleaned_resources.append(self)
        
        # 资源管理组件
        resources = []
        
        async def resource_manager_startup():
            # 创建各种资源
            resources.extend([
                TestResource('database_connection', 'connection'),
                TestResource('cache_connection', 'connection'),
                TestResource('temp_file_1', 'file'),
                TestResource('temp_file_2', 'file'),
                TestResource('worker_thread', 'thread')
            ])
            return True
        
        async def resource_manager_shutdown():
            # 清理所有资源
            for resource in resources:
                await resource.cleanup()
            return True
        
        # 文件管理组件
        temp_files = []
        
        async def file_manager_startup():
            # 创建临时文件
            for i in range(3):
                temp_file = Path(temp_dir) / f'temp_file_{i}.txt'
                temp_file.write_text(f'Temporary content {i}')
                temp_files.append(temp_file)
            return True
        
        async def file_manager_shutdown():
            # 删除临时文件
            for temp_file in temp_files:
                if temp_file.exists():
                    temp_file.unlink()
            return True
        
        # 注册组件
        await lifecycle_manager.register_component(
            name='resource_manager',
            startup_func=resource_manager_startup,
            shutdown_func=resource_manager_shutdown,
            priority=1,
            timeout=5
        )
        
        await lifecycle_manager.register_component(
            name='file_manager',
            startup_func=file_manager_startup,
            shutdown_func=file_manager_shutdown,
            priority=2,
            timeout=5
        )
        
        # 启动系统
        await lifecycle_manager.startup()
        
        # 验证资源已创建
        assert len(created_resources) == 5
        assert len(temp_files) == 3
        
        for resource in created_resources:
            assert resource.is_active is True
        
        for temp_file in temp_files:
            assert temp_file.exists()
        
        # 关闭系统
        await lifecycle_manager.shutdown()
        
        # 验证资源已清理
        assert len(cleaned_resources) == 5
        
        for resource in cleaned_resources:
            assert resource.is_active is False
        
        for temp_file in temp_files:
            assert not temp_file.exists()

    async def test_dependency_resolution(self, lifecycle_system):
        """测试依赖解析"""
        lifecycle_manager = lifecycle_system
        
        # 启动顺序跟踪
        startup_order = []
        
        async def track_startup(component_name: str):
            startup_order.append(component_name)
            await asyncio.sleep(0.01)  # 小延迟确保顺序
            return True
        
        # 复杂依赖关系
        # A -> B, C
        # B -> D
        # C -> D, E
        # D -> F
        # E -> F
        # 期望启动顺序: F, D, E, B, C, A
        
        dependencies = {
            'A': ['B', 'C'],
            'B': ['D'],
            'C': ['D', 'E'],
            'D': ['F'],
            'E': ['F'],
            'F': []
        }
        
        # 注册组件
        for component, deps in dependencies.items():
            await lifecycle_manager.register_component(
                name=component,
                startup_func=lambda name=component: track_startup(name),
                shutdown_func=lambda: True,
                dependencies=deps,
                priority=1,
                timeout=5
            )
        
        # 启动系统
        startup_result = await lifecycle_manager.startup()
        
        # 验证启动成功
        assert startup_result.success is True
        assert len(startup_order) == 6
        
        # 验证依赖顺序
        def get_index(component):
            return startup_order.index(component)
        
        # F应该最先启动（没有依赖）
        assert get_index('F') == 0
        
        # D和E应该在F之后启动
        assert get_index('D') > get_index('F')
        assert get_index('E') > get_index('F')
        
        # B应该在D之后启动
        assert get_index('B') > get_index('D')
        
        # C应该在D和E之后启动
        assert get_index('C') > get_index('D')
        assert get_index('C') > get_index('E')
        
        # A应该最后启动（依赖B和C）
        assert get_index('A') > get_index('B')
        assert get_index('A') > get_index('C')
        assert get_index('A') == 5  # 最后一个

    async def test_circular_dependency_detection(self, lifecycle_system):
        """测试循环依赖检测"""
        lifecycle_manager = lifecycle_system
        
        # 创建循环依赖: A -> B -> C -> A
        await lifecycle_manager.register_component(
            name='A',
            startup_func=lambda: True,
            shutdown_func=lambda: True,
            dependencies=['B'],
            priority=1,
            timeout=5
        )
        
        await lifecycle_manager.register_component(
            name='B',
            startup_func=lambda: True,
            shutdown_func=lambda: True,
            dependencies=['C'],
            priority=1,
            timeout=5
        )
        
        await lifecycle_manager.register_component(
            name='C',
            startup_func=lambda: True,
            shutdown_func=lambda: True,
            dependencies=['A'],  # 循环依赖
            priority=1,
            timeout=5
        )
        
        # 启动应该失败并检测到循环依赖
        with pytest.raises(LifecycleException) as exc_info:
            await lifecycle_manager.startup()
        
        assert "circular dependency" in str(exc_info.value).lower()

    async def test_timeout_handling(self, lifecycle_system):
        """测试超时处理"""
        lifecycle_manager = lifecycle_system
        
        # 超时事件跟踪
        timeout_events = []
        
        async def timeout_event_handler(event: LifecycleEvent):
            if 'timeout' in event.data:
                timeout_events.append(event)
        
        lifecycle_manager.register_event_handler(timeout_event_handler)
        
        # 慢启动组件
        async def slow_startup():
            await asyncio.sleep(2)  # 超过超时时间
            return True
        
        # 快启动组件
        async def fast_startup():
            await asyncio.sleep(0.1)
            return True
        
        # 注册组件
        await lifecycle_manager.register_component(
            name='slow_component',
            startup_func=slow_startup,
            shutdown_func=lambda: True,
            priority=1,
            timeout=1  # 1秒超时
        )
        
        await lifecycle_manager.register_component(
            name='fast_component',
            startup_func=fast_startup,
            shutdown_func=lambda: True,
            priority=2,
            timeout=5
        )
        
        # 启动系统（应该因为慢组件超时而失败）
        startup_result = await lifecycle_manager.startup()
        
        # 验证启动失败
        assert startup_result.success is False
        assert len(timeout_events) > 0
        
        # 验证超时事件
        timeout_event = timeout_events[0]
        assert timeout_event.component == 'slow_component'

    async def test_system_restart(self, lifecycle_system):
        """测试系统重启"""
        lifecycle_manager = lifecycle_system
        
        # 重启状态跟踪
        restart_events = []
        component_states = {}
        
        async def restart_event_handler(event: LifecycleEvent):
            restart_events.append(event)
        
        async def stateful_component_startup(component_name: str):
            component_states[component_name] = 'running'
            return True
        
        async def stateful_component_shutdown(component_name: str):
            component_states[component_name] = 'stopped'
            return True
        
        lifecycle_manager.register_event_handler(restart_event_handler)
        
        # 注册有状态组件
        components = ['service_a', 'service_b', 'service_c']
        
        for component in components:
            await lifecycle_manager.register_component(
                name=component,
                startup_func=lambda name=component: stateful_component_startup(name),
                shutdown_func=lambda name=component: stateful_component_shutdown(name),
                priority=1,
                timeout=5
            )
        
        # 第一次启动
        startup_result = await lifecycle_manager.startup()
        assert startup_result.success is True
        assert lifecycle_manager.current_phase == LifecyclePhase.RUNNING
        
        # 验证组件状态
        for component in components:
            assert component_states[component] == 'running'
        
        # 执行重启
        restart_result = await lifecycle_manager.restart()
        
        # 验证重启成功
        assert restart_result.success is True
        assert lifecycle_manager.current_phase == LifecyclePhase.RUNNING
        
        # 验证所有组件都经历了停止和重新启动
        for component in components:
            assert component_states[component] == 'running'
        
        # 验证重启事件
        restart_phase_events = [event for event in restart_events 
                               if event.phase == LifecyclePhase.RESTARTING]
        assert len(restart_phase_events) > 0

    async def test_configuration_reload(self, lifecycle_system, temp_dir):
        """测试配置重载"""
        lifecycle_manager = lifecycle_system
        
        # 配置文件
        config_file = Path(temp_dir) / 'system_config.json'
        initial_config = {
            'components': {
                'service_a': {'enabled': True, 'port': 8001},
                'service_b': {'enabled': True, 'port': 8002},
                'service_c': {'enabled': False, 'port': 8003}
            }
        }
        
        import json
        config_file.write_text(json.dumps(initial_config, indent=2))
        
        # 配置管理组件
        current_config = {}
        
        async def config_manager_startup():
            nonlocal current_config
            with open(config_file, 'r') as f:
                current_config = json.load(f)
            return True
        
        async def config_manager_reload():
            nonlocal current_config
            with open(config_file, 'r') as f:
                new_config = json.load(f)
            
            # 检查配置变化
            if new_config != current_config:
                current_config = new_config
                return True
            return False
        
        # 动态服务组件
        active_services = set()
        
        async def dynamic_service_startup():
            # 根据配置启动服务
            for service_name, service_config in current_config['components'].items():
                if service_config['enabled']:
                    active_services.add(service_name)
            return True
        
        async def dynamic_service_reconfigure():
            # 重新配置服务
            new_active_services = set()
            for service_name, service_config in current_config['components'].items():
                if service_config['enabled']:
                    new_active_services.add(service_name)
            
            # 停止不再需要的服务
            to_stop = active_services - new_active_services
            for service in to_stop:
                active_services.discard(service)
            
            # 启动新服务
            to_start = new_active_services - active_services
            for service in to_start:
                active_services.add(service)
            
            return True
        
        # 注册组件
        await lifecycle_manager.register_component(
            name='config_manager',
            startup_func=config_manager_startup,
            shutdown_func=lambda: True,
            reload_func=config_manager_reload,
            priority=1,
            timeout=5
        )
        
        await lifecycle_manager.register_component(
            name='dynamic_service',
            startup_func=dynamic_service_startup,
            shutdown_func=lambda: True,
            reconfigure_func=dynamic_service_reconfigure,
            dependencies=['config_manager'],
            priority=2,
            timeout=5
        )
        
        # 启动系统
        await lifecycle_manager.startup()
        
        # 验证初始状态
        assert 'service_a' in active_services
        assert 'service_b' in active_services
        assert 'service_c' not in active_services
        
        # 修改配置
        updated_config = {
            'components': {
                'service_a': {'enabled': True, 'port': 8001},
                'service_b': {'enabled': False, 'port': 8002},  # 禁用
                'service_c': {'enabled': True, 'port': 8003}   # 启用
            }
        }
        
        config_file.write_text(json.dumps(updated_config, indent=2))
        
        # 重载配置
        reload_result = await lifecycle_manager.reload_configuration()
        
        # 验证配置重载成功
        assert reload_result.success is True
        
        # 验证服务状态更新
        assert 'service_a' in active_services
        assert 'service_b' not in active_services  # 已停止
        assert 'service_c' in active_services      # 已启动

    async def test_performance_monitoring(self, lifecycle_system):
        """测试性能监控"""
        lifecycle_manager = lifecycle_system
        
        # 性能指标收集
        performance_metrics = []
        
        async def performance_monitor():
            """性能监控组件"""
            while lifecycle_manager.current_phase == LifecyclePhase.RUNNING:
                # 收集系统指标
                metrics = {
                    'timestamp': datetime.now().isoformat(),
                    'memory_usage': 85.5,  # 模拟内存使用率
                    'cpu_usage': 45.2,     # 模拟CPU使用率
                    'active_connections': len(performance_metrics) % 10 + 1,
                    'response_time': 120 + (len(performance_metrics) % 50)
                }
                
                performance_metrics.append(metrics)
                await asyncio.sleep(0.1)  # 快速收集用于测试
        
        # 性能监控组件
        monitor_task = None
        
        async def monitor_startup():
            nonlocal monitor_task
            monitor_task = asyncio.create_task(performance_monitor())
            return True
        
        async def monitor_shutdown():
            nonlocal monitor_task
            if monitor_task:
                monitor_task.cancel()
                try:
                    await monitor_task
                except asyncio.CancelledError:
                    pass
            return True
        
        # 注册监控组件
        await lifecycle_manager.register_component(
            name='performance_monitor',
            startup_func=monitor_startup,
            shutdown_func=monitor_shutdown,
            priority=1,
            timeout=5
        )
        
        # 启动系统
        await lifecycle_manager.startup()
        
        # 运行一段时间收集指标
        await asyncio.sleep(0.5)
        
        # 关闭系统
        await lifecycle_manager.shutdown()
        
        # 验证性能指标收集
        assert len(performance_metrics) > 0
        
        # 验证指标结构
        for metric in performance_metrics:
            assert 'timestamp' in metric
            assert 'memory_usage' in metric
            assert 'cpu_usage' in metric
            assert 'active_connections' in metric
            assert 'response_time' in metric
        
        # 验证指标数据合理性
        latest_metric = performance_metrics[-1]
        assert 0 <= latest_metric['memory_usage'] <= 100
        assert 0 <= latest_metric['cpu_usage'] <= 100
        assert latest_metric['active_connections'] > 0
        assert latest_metric['response_time'] > 0
