# -*- coding: utf-8 -*-
"""
适配器健康服务测试

测试新架构的适配器健康监控服务功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

from zishu.adapters.core.services.health_service import (
    AdapterHealthService, HealthMonitor, HealthMetric, HealthThreshold,
    AdapterHealthStatus, HealthMetricType
)
from zishu.adapters.core.services.base import ServiceStatus, HealthCheckResult
from zishu.adapters.core.types import (
    AdapterRegistration, AdapterIdentity, AdapterConfiguration,
    AdapterStatus, AdapterType, Priority, SecurityLevel
)
from zishu.adapters.core.events import EventBus, Event, EventType

from tests.utils.adapter_test_utils import AdapterTestUtils


class TestAdapterHealthService:
    """适配器健康服务测试类"""

    @pytest.fixture
    async def event_bus(self):
        """创建事件总线mock"""
        event_bus = Mock(spec=EventBus)
        event_bus.emit = AsyncMock()
        return event_bus

    @pytest.fixture
    async def registry_service(self):
        """创建注册服务mock"""
        registry = Mock()
        registry.get_all_registrations = AsyncMock(return_value={})
        registry.get_registration = AsyncMock(return_value=None)
        return registry

    @pytest.fixture
    def health_config(self):
        """创建健康服务配置"""
        return {
            'check_interval': 1.0,  # 1秒检查间隔
            'health_timeout': 5.0,
            'max_failed_checks': 3,
            'enable_auto_recovery': True,
            'recovery_timeout': 10.0
        }

    @pytest.fixture
    async def health_service(self, event_bus, registry_service, health_config):
        """创建健康服务实例"""
        service = AdapterHealthService(
            event_bus=event_bus, 
            registry_service=registry_service,
            config=health_config
        )
        await service.initialize()
        await service.start()
        yield service
        await service.stop()

    @pytest.fixture
    def test_adapter_registration(self):
        """创建测试适配器注册信息"""
        identity = AdapterTestUtils.create_test_adapter_identity(
            adapter_id="test-adapter-001",
            name="Test Adapter",
            adapter_type=AdapterType.SOFT
        )
        
        config = AdapterTestUtils.create_test_adapter_configuration(
            config={"test_param": "test_value"},
            security_level=SecurityLevel.INTERNAL
        )
        
        # 创建适配器实例mock
        class MockAdapter:
            def __init__(self, config):
                self.config = config
                self.is_healthy = True
                self.health_check_count = 0
            
            async def health_check(self):
                self.health_check_count += 1
                if self.is_healthy:
                    return HealthCheckResult(
                        is_healthy=True,
                        service_name="test-adapter",
                        details={"status": "ok", "check_count": self.health_check_count}
                    )
                else:
                    return HealthCheckResult(
                        is_healthy=False,
                        service_name="test-adapter",
                        message="Mock failure",
                        details={"status": "error"}
                    )
        
        adapter_instance = MockAdapter(config)
        
        return AdapterTestUtils.create_test_adapter_registration(
            identity=identity,
            adapter_class=MockAdapter,
            configuration=config
        ), adapter_instance

    async def test_service_initialization(self, event_bus, registry_service, health_config):
        """测试服务初始化"""
        service = AdapterHealthService(
            event_bus=event_bus,
            registry_service=registry_service,
            config=health_config
        )
        
        # 验证初始状态
        assert service.name == "adapter_health"
        assert service.status == ServiceStatus.CREATED
        assert service.config == health_config
        
        # 初始化服务
        await service.initialize()
        assert service.status == ServiceStatus.INITIALIZED
        
        # 启动服务
        await service.start()
        assert service.status == ServiceStatus.RUNNING
        
        # 停止服务
        await service.stop()
        assert service.status == ServiceStatus.STOPPED

    async def test_register_adapter_for_monitoring(self, health_service, test_adapter_registration):
        """测试注册适配器进行监控"""
        registration, adapter_instance = test_adapter_registration
        
        # 注册适配器监控
        result = await health_service.register_adapter_monitoring(
            registration.identity.adapter_id,
            adapter_instance
        )
        
        assert result is True
        
        # 验证适配器已注册
        monitored_adapters = await health_service.get_monitored_adapters()
        assert registration.identity.adapter_id in monitored_adapters

    async def test_unregister_adapter_monitoring(self, health_service, test_adapter_registration):
        """测试注销适配器监控"""
        registration, adapter_instance = test_adapter_registration
        adapter_id = registration.identity.adapter_id
        
        # 先注册监控
        await health_service.register_adapter_monitoring(adapter_id, adapter_instance)
        
        # 注销监控
        result = await health_service.unregister_adapter_monitoring(adapter_id)
        assert result is True
        
        # 验证适配器已注销
        monitored_adapters = await health_service.get_monitored_adapters()
        assert adapter_id not in monitored_adapters

    async def test_check_adapter_health(self, health_service, test_adapter_registration):
        """测试检查适配器健康状态"""
        registration, adapter_instance = test_adapter_registration
        adapter_id = registration.identity.adapter_id
        
        # 注册适配器监控
        await health_service.register_adapter_monitoring(adapter_id, adapter_instance)
        
        # 检查健康状态
        health_status = await health_service.check_adapter_health(adapter_id)
        
        assert health_status is not None
        assert health_status.adapter_id == adapter_id
        assert health_status.status == AdapterHealthStatus.HEALTHY
        assert health_status.last_check is not None

    async def test_check_all_adapters_health(self, health_service, registry_service):
        """测试检查所有适配器健康状态"""
        # 创建多个适配器
        adapters = []
        for i in range(3):
            identity = AdapterTestUtils.create_test_adapter_identity(adapter_id=f"adapter-{i}")
            config = AdapterTestUtils.create_test_adapter_configuration()
            registration = AdapterTestUtils.create_test_adapter_registration(
                identity=identity, configuration=config
            )
            
            class MockAdapter:
                def __init__(self, adapter_id):
                    self.adapter_id = adapter_id
                
                async def health_check(self):
                    return HealthCheckResult(
                        is_healthy=True,
                        service_name=self.adapter_id,
                        details={"status": "ok"}
                    )
            
            adapter_instance = MockAdapter(f"adapter-{i}")
            adapters.append((registration, adapter_instance))
            
            # 注册监控
            await health_service.register_adapter_monitoring(
                registration.identity.adapter_id,
                adapter_instance
            )
        
        # 检查所有适配器健康状态
        health_results = await health_service.check_all_adapters_health()
        
        assert len(health_results) == 3
        for result in health_results:
            assert result.status == AdapterHealthStatus.HEALTHY

    async def test_health_monitoring_task(self, event_bus, registry_service):
        """测试健康监控任务"""
        config = {'check_interval': 0.1}  # 100ms间隔
        service = AdapterHealthService(
            event_bus=event_bus,
            registry_service=registry_service,
            config=config
        )
        await service.initialize()
        await service.start()
        
        try:
            # 创建测试适配器
            identity = AdapterTestUtils.create_test_adapter_identity()
            
            class MockAdapter:
                def __init__(self):
                    self.check_count = 0
                
                async def health_check(self):
                    self.check_count += 1
                    return HealthCheckResult(
                        is_healthy=True,
                        service_name="test-adapter",
                        details={"check_count": self.check_count}
                    )
            
            adapter_instance = MockAdapter()
            
            # 注册监控
            await service.register_adapter_monitoring(
                identity.adapter_id,
                adapter_instance
            )
            
            # 等待几次检查
            await asyncio.sleep(0.3)
            
            # 验证健康检查被调用
            assert adapter_instance.check_count > 0
            
        finally:
            await service.stop()

    async def test_unhealthy_adapter_detection(self, health_service, test_adapter_registration, event_bus):
        """测试不健康适配器检测"""
        registration, adapter_instance = test_adapter_registration
        adapter_id = registration.identity.adapter_id
        
        # 设置适配器为不健康
        adapter_instance.is_healthy = False
        
        # 注册监控
        await health_service.register_adapter_monitoring(adapter_id, adapter_instance)
        
        # 检查健康状态
        health_status = await health_service.check_adapter_health(adapter_id)
        
        assert health_status.status == AdapterHealthStatus.UNHEALTHY
        
        # 验证事件发送
        event_bus.emit.assert_called()
        # 查找健康状态变化事件
        health_event_found = False
        for call in event_bus.emit.call_args_list:
            event = call[0][0]
            if event.event_type == EventType.ADAPTER_HEALTH_CHANGED:
                health_event_found = True
                assert event.data['adapter_id'] == adapter_id
                assert event.data['status'] == AdapterHealthStatus.UNHEALTHY.value
                break
        
        assert health_event_found

    async def test_health_metrics_collection(self, health_service, test_adapter_registration):
        """测试健康指标收集"""
        registration, adapter_instance = test_adapter_registration
        adapter_id = registration.identity.adapter_id
        
        # 注册监控
        await health_service.register_adapter_monitoring(adapter_id, adapter_instance)
        
        # 执行多次健康检查
        for _ in range(5):
            await health_service.check_adapter_health(adapter_id)
        
        # 获取健康指标
        metrics = await health_service.get_health_metrics(adapter_id)
        
        assert metrics is not None
        assert metrics.adapter_id == adapter_id
        assert metrics.total_checks >= 5
        assert metrics.successful_checks >= 5
        assert metrics.failed_checks == 0

    async def test_health_threshold_monitoring(self, health_service):
        """测试健康阈值监控"""
        # 创建自定义健康阈值
        threshold = HealthThreshold(
            metric_type=HealthMetricType.SUCCESS_RATE,
            warning_threshold=0.8,
            critical_threshold=0.5
        )
        
        # 注册阈值
        await health_service.register_health_threshold("test_threshold", threshold)
        
        # 验证阈值已注册
        thresholds = await health_service.get_health_thresholds()
        assert "test_threshold" in thresholds

    async def test_auto_recovery(self, event_bus, registry_service):
        """测试自动恢复功能"""
        config = {
            'enable_auto_recovery': True,
            'max_failed_checks': 2,
            'recovery_timeout': 0.1
        }
        service = AdapterHealthService(
            event_bus=event_bus,
            registry_service=registry_service,
            config=config
        )
        await service.initialize()
        await service.start()
        
        try:
            # 创建可恢复的适配器
            class RecoverableAdapter:
                def __init__(self):
                    self.fail_count = 0
                    self.max_fails = 2
                
                async def health_check(self):
                    self.fail_count += 1
                    if self.fail_count <= self.max_fails:
                        return HealthCheckResult(
                            is_healthy=False,
                            service_name="recoverable-adapter",
                            message="Temporary failure"
                        )
                    else:
                        return HealthCheckResult(
                            is_healthy=True,
                            service_name="recoverable-adapter",
                            details={"recovered": True}
                        )
                
                async def recover(self):
                    # 模拟恢复操作
                    self.fail_count = self.max_fails + 1
                    return True
            
            adapter_instance = RecoverableAdapter()
            identity = AdapterTestUtils.create_test_adapter_identity()
            
            # 注册监控
            await service.register_adapter_monitoring(
                identity.adapter_id,
                adapter_instance
            )
            
            # 触发失败检查
            for _ in range(3):
                await service.check_adapter_health(identity.adapter_id)
            
            # 等待自动恢复
            await asyncio.sleep(0.2)
            
            # 验证恢复
            health_status = await service.check_adapter_health(identity.adapter_id)
            assert health_status.status == AdapterHealthStatus.HEALTHY
            
        finally:
            await service.stop()

    async def test_health_history_tracking(self, health_service, test_adapter_registration):
        """测试健康历史跟踪"""
        registration, adapter_instance = test_adapter_registration
        adapter_id = registration.identity.adapter_id
        
        # 注册监控
        await health_service.register_adapter_monitoring(adapter_id, adapter_instance)
        
        # 执行多次健康检查
        for i in range(5):
            # 交替设置健康状态
            adapter_instance.is_healthy = (i % 2 == 0)
            await health_service.check_adapter_health(adapter_id)
        
        # 获取健康历史
        history = await health_service.get_health_history(adapter_id, limit=10)
        
        assert len(history) == 5
        # 验证历史记录的时间顺序
        for i in range(1, len(history)):
            assert history[i].timestamp >= history[i-1].timestamp

    async def test_health_service_metrics(self, health_service, test_adapter_registration):
        """测试健康服务指标"""
        registration, adapter_instance = test_adapter_registration
        
        # 注册监控并执行检查
        await health_service.register_adapter_monitoring(
            registration.identity.adapter_id,
            adapter_instance
        )
        await health_service.check_adapter_health(registration.identity.adapter_id)
        
        # 获取服务指标
        metrics = health_service.get_metrics()
        assert metrics.request_count >= 1
        assert metrics.last_activity is not None

    async def test_health_check_timeout(self, health_service):
        """测试健康检查超时"""
        # 创建慢响应适配器
        class SlowAdapter:
            async def health_check(self):
                await asyncio.sleep(10)  # 超过默认超时时间
                return HealthCheckResult(is_healthy=True, service_name="slow-adapter")
        
        adapter_instance = SlowAdapter()
        identity = AdapterTestUtils.create_test_adapter_identity()
        
        # 注册监控
        await health_service.register_adapter_monitoring(
            identity.adapter_id,
            adapter_instance
        )
        
        # 检查健康状态（应该超时）
        health_status = await health_service.check_adapter_health(identity.adapter_id)
        
        # 验证超时处理
        assert health_status.status == AdapterHealthStatus.UNHEALTHY
        assert "timeout" in health_status.message.lower()

    async def test_concurrent_health_checks(self, health_service):
        """测试并发健康检查"""
        # 创建多个适配器
        adapters = []
        for i in range(5):
            identity = AdapterTestUtils.create_test_adapter_identity(adapter_id=f"adapter-{i}")
            
            class MockAdapter:
                def __init__(self, adapter_id):
                    self.adapter_id = adapter_id
                
                async def health_check(self):
                    await asyncio.sleep(0.1)  # 模拟检查时间
                    return HealthCheckResult(
                        is_healthy=True,
                        service_name=self.adapter_id,
                        details={"concurrent_test": True}
                    )
            
            adapter_instance = MockAdapter(f"adapter-{i}")
            adapters.append((identity, adapter_instance))
            
            # 注册监控
            await health_service.register_adapter_monitoring(
                identity.adapter_id,
                adapter_instance
            )
        
        # 并发执行健康检查
        tasks = [
            health_service.check_adapter_health(identity.adapter_id)
            for identity, _ in adapters
        ]
        results = await asyncio.gather(*tasks)
        
        # 验证所有检查都成功
        assert len(results) == 5
        for result in results:
            assert result.status == AdapterHealthStatus.HEALTHY

    async def test_health_service_health_check(self, health_service):
        """测试健康服务自身的健康检查"""
        health_result = await health_service.health_check()
        
        assert isinstance(health_result, HealthCheckResult)
        assert health_result.is_healthy is True
        assert health_result.service_name == "adapter_health"
        assert "monitored_adapters_count" in health_result.details

    async def test_error_handling(self, health_service):
        """测试错误处理"""
        # 测试无效参数
        with pytest.raises(Exception):
            await health_service.register_adapter_monitoring(None, None)
        
        # 测试检查不存在的适配器
        result = await health_service.check_adapter_health("nonexistent-adapter")
        assert result is None
        
        # 测试服务未运行时的操作
        await health_service.stop()
        
        with pytest.raises(RuntimeError):
            await health_service.check_adapter_health("test-adapter")
