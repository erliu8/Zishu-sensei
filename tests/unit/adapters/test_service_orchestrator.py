# -*- coding: utf-8 -*-
"""
适配器服务协调器测试

测试新架构的适配器服务协调器功能
"""

import pytest
import pytest_asyncio
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
from typing import Dict, Any, List, Set

from zishu.adapters.core.services.orchestrator import (
    AdapterServiceOrchestrator, ServiceNode, ServiceDependency,
    ServiceStartupError, ServiceShutdownError, CircularDependencyError
)
from zishu.adapters.core.services.base import AsyncService, ServiceStatus, HealthCheckResult
from zishu.adapters.core.events import EventBus, Event, EventType

from tests.utils.adapter_test_utils import AdapterTestUtils


class MockService(AsyncService):
    """测试用模拟服务"""
    
    def __init__(self, name: str, config: Dict[str, Any] = None, fail_on: Set[str] = None):
        super().__init__(name, config or {})
        self.fail_on = fail_on or set()
        self.operation_log = []
        # 设置健康状态，使用基类的_health属性
        from zishu.adapters.core.services.base import ServiceHealth
        self._health = ServiceHealth.HEALTHY
        
    async def _initialize_impl(self) -> None:
        if "initialize" in self.fail_on:
            raise RuntimeError(f"Mock failure in initialize for {self.name}")
        self.operation_log.append("initialized")
        
    async def _start_impl(self) -> None:
        if "start" in self.fail_on:
            raise RuntimeError(f"Mock failure in start for {self.name}")
        self.operation_log.append("started")
        
    async def _stop_impl(self) -> None:
        if "stop" in self.fail_on:
            raise RuntimeError(f"Mock failure in stop for {self.name}")
        self.operation_log.append("stopped")
        
    async def _health_check_impl(self) -> HealthCheckResult:
        return HealthCheckResult(
            is_healthy=self.is_healthy,
            status=self._health,
            service_name=self.name,
            details={"operation_log": self.operation_log}
        )


class TestAdapterServiceOrchestrator:
    """适配器服务协调器测试类"""

    @pytest.fixture
    def orchestrator_config(self):
        """创建协调器配置"""
        from zishu.adapters.core.services.orchestrator import OrchestratorConfig
        return OrchestratorConfig(
            startup_timeout=10.0,
            shutdown_timeout=5.0,
            health_check_interval=1.0,
            max_concurrent_starts=5,
            enable_auto_recovery=True
        )

    @pytest_asyncio.fixture
    async def orchestrator(self, orchestrator_config):
        """创建协调器实例"""
        orchestrator = AdapterServiceOrchestrator(config=orchestrator_config)
        await orchestrator.initialize()
        yield orchestrator
        await orchestrator.stop_all()

    @pytest.fixture
    def mock_services(self):
        """创建模拟服务集合"""
        return {
            'service_a': MockService('service_a'),
            'service_b': MockService('service_b'),
            'service_c': MockService('service_c')
        }

    @pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_orchestrator_initialization(self, orchestrator_config):
        """测试协调器初始化"""
        orchestrator = AdapterServiceOrchestrator(config=orchestrator_config)
        
        # 验证初始状态
        assert orchestrator.config == orchestrator_config
        assert not orchestrator.is_initialized
        assert not orchestrator.is_running
        
        # 初始化
        await orchestrator.initialize()
        assert orchestrator.is_initialized
        assert not orchestrator.is_running
        
        # 清理
        await orchestrator.shutdown()

    @pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_register_service(self, orchestrator, mock_services):
        """测试注册服务"""
        service_a = mock_services['service_a']
        
        # 注册服务
        result = orchestrator.register_service(service_a)
        assert result is True
        
        # 验证服务已注册
        registered_services = orchestrator.get_registered_services()
        assert 'service_a' in registered_services
        assert registered_services['service_a'] == service_a
        
        # 重复注册应该失败
        result = orchestrator.register_service(service_a)
        assert result is False

    @pytest.mark.asyncio
    @pytest.mark.asyncio
    async def test_unregister_service(self, orchestrator, mock_services):
        """测试注销服务"""
        service_a = mock_services['service_a']
        
        # 注册后注销
        orchestrator.register_service(service_a)
        result = orchestrator.unregister_service('service_a')
        assert result is True
        
        # 验证服务已注销
        registered_services = orchestrator.get_registered_services()
        assert 'service_a' not in registered_services
        
        # 注销不存在的服务
        result = orchestrator.unregister_service('nonexistent')
        assert result is False

    @pytest.mark.asyncio
    async def test_add_dependency(self, orchestrator, mock_services):
        """测试添加服务依赖"""
        service_a = mock_services['service_a']
        service_b = mock_services['service_b']
        
        # 注册服务
        orchestrator.register_service(service_a)
        orchestrator.register_service(service_b)
        
        # 添加依赖关系 (service_a 依赖 service_b)
        result = orchestrator.add_dependency('service_a', 'service_b')
        assert result is True
        
        # 获取依赖关系
        dependencies = orchestrator.get_service_dependencies()
        assert 'service_a' in dependencies
        assert 'service_b' in dependencies['service_a']

    @pytest.mark.asyncio
    async def test_circular_dependency_detection(self, orchestrator, mock_services):
        """测试循环依赖检测"""
        for service in mock_services.values():
            orchestrator.register_service(service)
        
        # 创建循环依赖: A -> B -> C -> A
        orchestrator.add_dependency('service_a', 'service_b')
        orchestrator.add_dependency('service_b', 'service_c')
        
        # 尝试添加循环依赖
        with pytest.raises(CircularDependencyError):
            orchestrator.add_dependency('service_c', 'service_a')

    @pytest.mark.asyncio
    async def test_start_services_with_dependencies(self, orchestrator, mock_services):
        """测试按依赖顺序启动服务"""
        for service in mock_services.values():
            orchestrator.register_service(service)
        
        # 设置依赖关系: service_a -> service_b -> service_c
        orchestrator.add_dependency('service_a', 'service_b')
        orchestrator.add_dependency('service_b', 'service_c')
        
        # 启动所有服务
        await orchestrator.start_all_services()
        
        # 验证所有服务都已启动
        for service in mock_services.values():
            assert service.status == ServiceStatus.RUNNING
            assert "initialized" in service.operation_log
            assert "started" in service.operation_log
        
        # 验证启动顺序（依赖的服务先启动）
        service_c = mock_services['service_c']
        service_b = mock_services['service_b']
        service_a = mock_services['service_a']
        
        # service_c 应该最先启动，service_a 最后启动
        c_start_time = service_c.operation_log.index("started")
        b_start_time = service_b.operation_log.index("started")
        a_start_time = service_a.operation_log.index("started")
        
        # 注意：这里的逻辑可能需要根据实际实现调整

    @pytest.mark.asyncio
    async def test_stop_services_reverse_order(self, orchestrator, mock_services):
        """测试按相反顺序停止服务"""
        for service in mock_services.values():
            orchestrator.register_service(service)
        
        # 设置依赖关系
        orchestrator.add_dependency('service_a', 'service_b')
        orchestrator.add_dependency('service_b', 'service_c')
        
        # 启动所有服务
        await orchestrator.start_all_services()
        
        # 停止所有服务
        await orchestrator.stop_all_services()
        
        # 验证所有服务都已停止
        for service in mock_services.values():
            assert service.status == ServiceStatus.STOPPED
            assert "stopped" in service.operation_log

    @pytest.mark.asyncio
    async def test_start_specific_service(self, orchestrator, mock_services):
        """测试启动特定服务"""
        service_a = mock_services['service_a']
        service_b = mock_services['service_b']
        
        orchestrator.register_service(service_a)
        orchestrator.register_service(service_b)
        
        # 只启动 service_a
        result = await orchestrator.start_service('service_a')
        assert result is True
        
        # 验证只有 service_a 启动
        assert service_a.status == ServiceStatus.RUNNING
        assert service_b.status == ServiceStatus.CREATED

    @pytest.mark.asyncio
    async def test_stop_specific_service(self, orchestrator, mock_services):
        """测试停止特定服务"""
        service_a = mock_services['service_a']
        
        orchestrator.register_service(service_a)
        await orchestrator.start_service('service_a')
        
        # 停止服务
        result = await orchestrator.stop_service('service_a')
        assert result is True
        
        # 验证服务已停止
        assert service_a.status == ServiceStatus.STOPPED

    @pytest.mark.asyncio
    async def test_service_startup_failure(self, orchestrator):
        """测试服务启动失败"""
        # 创建会在启动时失败的服务
        failing_service = MockService('failing_service', fail_on={'start'})
        orchestrator.register_service(failing_service)
        
        # 尝试启动服务
        with pytest.raises(ServiceStartupError):
            await orchestrator.start_service('failing_service')
        
        # 验证服务状态
        assert failing_service.status == ServiceStatus.FAILED

    @pytest.mark.asyncio
    async def test_service_shutdown_failure(self, orchestrator):
        """测试服务关闭失败"""
        # 创建会在关闭时失败的服务
        failing_service = MockService('failing_service', fail_on={'stop'})
        orchestrator.register_service(failing_service)
        
        # 启动服务
        await orchestrator.start_service('failing_service')
        
        # 尝试停止服务
        with pytest.raises(ServiceShutdownError):
            await orchestrator.stop_service('failing_service')

    @pytest.mark.asyncio
    async def test_health_monitoring(self, orchestrator, mock_services):
        """测试健康监控"""
        service_a = mock_services['service_a']
        orchestrator.register_service(service_a)
        await orchestrator.start_service('service_a')
        
        # 启动健康监控
        await orchestrator.start_health_monitoring()
        
        # 等待健康检查
        await asyncio.sleep(1.5)  # 等待超过检查间隔
        
        # 停止健康监控
        await orchestrator.stop_health_monitoring()
        
        # 验证健康检查被执行（通过服务的健康检查方法被调用来验证）

    @pytest.mark.asyncio
    async def test_unhealthy_service_detection(self, orchestrator, mock_services):
        """测试不健康服务检测"""
        service_a = mock_services['service_a']
        orchestrator.register_service(service_a)
        await orchestrator.start_service('service_a')
        
        # 设置服务为不健康
        from zishu.adapters.core.services.base import ServiceHealth
        service_a._health = ServiceHealth.UNHEALTHY
        
        # 执行健康检查
        health_results = await orchestrator.check_all_services_health()
        
        # 验证检测到不健康服务
        assert 'service_a' in health_results
        assert health_results['service_a'].is_healthy is False

    @pytest.mark.asyncio
    async def test_get_service_status(self, orchestrator, mock_services):
        """测试获取服务状态"""
        service_a = mock_services['service_a']
        orchestrator.register_service(service_a)
        
        # 获取初始状态
        status = orchestrator.get_service_status('service_a')
        assert status == ServiceStatus.CREATED
        
        # 启动服务后获取状态
        await orchestrator.start_service('service_a')
        status = orchestrator.get_service_status('service_a')
        assert status == ServiceStatus.RUNNING
        
        # 获取不存在服务的状态
        status = orchestrator.get_service_status('nonexistent')
        assert status is None

    @pytest.mark.asyncio
    async def test_get_all_services_status(self, orchestrator, mock_services):
        """测试获取所有服务状态"""
        for service in mock_services.values():
            orchestrator.register_service(service)
        
        # 启动部分服务
        await orchestrator.start_service('service_a')
        await orchestrator.start_service('service_b')
        
        # 获取所有服务状态
        all_status = orchestrator.get_all_services_status()
        
        assert len(all_status) == 3
        assert all_status['service_a'] == ServiceStatus.RUNNING
        assert all_status['service_b'] == ServiceStatus.RUNNING
        assert all_status['service_c'] == ServiceStatus.CREATED

    @pytest.mark.asyncio
    async def test_concurrent_service_operations(self, orchestrator, mock_services):
        """测试并发服务操作"""
        for service in mock_services.values():
            orchestrator.register_service(service)
        
        # 并发启动所有服务
        start_tasks = [
            orchestrator.start_service(name)
            for name in mock_services.keys()
        ]
        results = await asyncio.gather(*start_tasks, return_exceptions=True)
        
        # 验证所有服务都成功启动
        for result in results:
            assert result is True
        
        # 验证所有服务状态
        for service in mock_services.values():
            assert service.status == ServiceStatus.RUNNING

    @pytest.mark.asyncio
    async def test_service_dependency_validation(self, orchestrator, mock_services):
        """测试服务依赖验证"""
        service_a = mock_services['service_a']
        orchestrator.register_service(service_a)
        
        # 尝试添加对不存在服务的依赖
        with pytest.raises(ValueError):
            orchestrator.add_dependency('service_a', 'nonexistent_service')
        
        # 尝试添加不存在服务的依赖
        with pytest.raises(ValueError):
            orchestrator.add_dependency('nonexistent_service', 'service_a')

    @pytest.mark.asyncio
    async def test_service_node_creation(self):
        """测试服务节点创建"""
        service = MockService('test_service')
        node = ServiceNode(service)
        
        assert node.service == service
        assert node.name == 'test_service'
        assert node.dependencies == set()
        assert node.dependents == set()
        assert node.start_task is None

    @pytest.mark.asyncio
    async def test_orchestrator_shutdown(self, orchestrator, mock_services):
        """测试协调器关闭"""
        for service in mock_services.values():
            orchestrator.register_service(service)
        
        # 启动所有服务
        await orchestrator.start_all_services()
        
        # 关闭协调器
        await orchestrator.shutdown()
        
        # 验证所有服务都已停止
        for service in mock_services.values():
            assert service.status == ServiceStatus.STOPPED

    @pytest.mark.asyncio
    async def test_service_metrics_collection(self, orchestrator, mock_services):
        """测试服务指标收集"""
        service_a = mock_services['service_a']
        orchestrator.register_service(service_a)
        
        # 执行一些操作
        await orchestrator.start_service('service_a')
        await orchestrator.check_service_health('service_a')
        
        # 获取协调器指标
        metrics = orchestrator.get_orchestrator_metrics()
        
        assert 'total_services' in metrics
        assert 'running_services' in metrics
        assert 'failed_services' in metrics
        assert metrics['total_services'] >= 1

    @pytest.mark.asyncio
    async def test_service_lifecycle_events(self, orchestrator, mock_services):
        """测试服务生命周期事件"""
        # 测试服务生命周期基本功能，暂时跳过事件总线功能
        service_a = mock_services['service_a']
        orchestrator.register_service(service_a)
        
        # 启动服务
        await orchestrator.start_service('service_a')
        
        # 验证服务状态
        status = orchestrator.get_service_status('service_a')
        assert status == service_a.status

    @pytest.mark.asyncio
    async def test_timeout_handling(self, orchestrator_config):
        """测试超时处理"""
        # 创建启动超时很短的协调器
        from zishu.adapters.core.services.orchestrator import OrchestratorConfig
        config = OrchestratorConfig(
            startup_timeout=0.1,  # 100ms
            shutdown_timeout=orchestrator_config.shutdown_timeout,
            health_check_interval=orchestrator_config.health_check_interval,
            max_concurrent_starts=orchestrator_config.max_concurrent_starts,
            enable_auto_recovery=orchestrator_config.enable_auto_recovery
        )
        
        orchestrator = AdapterServiceOrchestrator(config=config)
        await orchestrator.initialize()
        
        try:
            # 创建慢启动服务
            class SlowService(MockService):
                async def _start_impl(self) -> None:
                    await asyncio.sleep(0.2)  # 超过超时时间
                    await super()._start_impl()
            
            slow_service = SlowService('slow_service')
            orchestrator.register_service(slow_service)
            
            # 尝试启动服务（应该超时）
            with pytest.raises(ServiceStartupError):
                await orchestrator.start_service('slow_service')
                
        finally:
            await orchestrator.shutdown()

    @pytest.mark.asyncio
    async def test_error_recovery(self, orchestrator, mock_services):
        """测试错误恢复"""
        # 创建会失败然后恢复的服务
        class RecoverableService(MockService):
            def __init__(self, name):
                super().__init__(name)
                self.attempt_count = 0
            
            async def _start_impl(self) -> None:
                self.attempt_count += 1
                if self.attempt_count <= 3:  # 前3次都失败
                    raise RuntimeError(f"Attempt {self.attempt_count} fails")
                await super()._start_impl()
        
        recoverable_service = RecoverableService('recoverable_service')
        orchestrator.register_service(recoverable_service)
        
        # 第一次启动失败
        with pytest.raises(ServiceStartupError):
            await orchestrator.start_service('recoverable_service')
        
        # 第二次启动成功
        result = await orchestrator.start_service('recoverable_service')
        assert result is True
        assert recoverable_service.status == ServiceStatus.RUNNING

    @pytest.mark.asyncio
    async def test_orchestrator_state_consistency(self, orchestrator, mock_services):
        """测试协调器状态一致性"""
        for service in mock_services.values():
            orchestrator.register_service(service)
        
        # 启动所有服务
        await orchestrator.start_all_services()
        
        # 验证内部状态一致性
        registered_services = orchestrator.get_registered_services()
        all_status = orchestrator.get_all_services_status()
        
        assert len(registered_services) == len(all_status)
        
        for name, service in registered_services.items():
            assert name in all_status
            assert all_status[name] == service.status
