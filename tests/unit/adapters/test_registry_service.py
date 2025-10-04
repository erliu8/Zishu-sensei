# -*- coding: utf-8 -*-
"""
适配器注册服务测试

测试新架构的适配器注册服务功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
from typing import Dict, Any

from zishu.adapters.core.services.registry_service import AdapterRegistryService
from zishu.adapters.core.services.base import ServiceStatus, HealthCheckResult
from zishu.adapters.core.types import (
    AdapterRegistration, AdapterIdentity, AdapterConfiguration,
    AdapterStatus, AdapterType, Priority, SecurityLevel
)
from zishu.adapters.core.events import EventBus, Event, EventType

from tests.utils.adapter_test_utils import AdapterTestUtils


class TestAdapterRegistryService:
    """适配器注册服务测试类"""

    @pytest.fixture
    async def event_bus(self):
        """创建事件总线mock"""
        event_bus = Mock(spec=EventBus)
        event_bus.emit = AsyncMock()
        return event_bus

    @pytest.fixture
    def registry_config(self):
        """创建注册服务配置"""
        return {
            'max_registrations': 100,
            'enable_validation': True,
            'auto_cleanup': True,
            'cleanup_interval': 60
        }

    @pytest.fixture
    async def registry_service(self, event_bus, registry_config):
        """创建注册服务实例"""
        service = AdapterRegistryService(event_bus=event_bus, config=registry_config)
        await service.initialize()
        await service.start()
        yield service
        await service.stop()

    @pytest.fixture
    def test_adapter_config(self):
        """创建测试适配器配置"""
        identity = AdapterTestUtils.create_test_adapter_identity(
            adapter_id="test-adapter-001",
            name="Test Adapter",
            adapter_type=AdapterType.SOFT
        )
        
        config = AdapterTestUtils.create_test_adapter_configuration(
            config={"test_param": "test_value"},
            security_level=SecurityLevel.INTERNAL
        )
        
        # 创建适配器配置对象
        class TestAdapterConfig:
            def __init__(self):
                self.identity = identity.adapter_id
                self.name = identity.name
                self.version = identity.version
                self.adapter_type = identity.adapter_type
                self.description = identity.description
                self.author = identity.author
                self.tags = list(identity.tags)
                self.adapter_class = Mock()
                self.config = config.config
                
        return TestAdapterConfig()

    async def test_service_initialization(self, event_bus, registry_config):
        """测试服务初始化"""
        service = AdapterRegistryService(event_bus=event_bus, config=registry_config)
        
        # 验证初始状态
        assert service.name == "adapter_registry"
        assert service.status == ServiceStatus.CREATED
        assert service.config == registry_config
        
        # 初始化服务
        await service.initialize()
        assert service.status == ServiceStatus.INITIALIZED
        
        # 启动服务
        await service.start()
        assert service.status == ServiceStatus.RUNNING
        
        # 停止服务
        await service.stop()
        assert service.status == ServiceStatus.STOPPED

    async def test_register_adapter_success(self, registry_service, test_adapter_config, event_bus):
        """测试成功注册适配器"""
        # 执行注册
        result = await registry_service.register_adapter(test_adapter_config)
        
        # 验证结果
        assert result is True
        
        # 验证适配器已注册
        registrations = await registry_service.get_all_registrations()
        assert len(registrations) == 1
        assert test_adapter_config.identity in registrations
        
        # 验证事件发送
        event_bus.emit.assert_called_once()
        call_args = event_bus.emit.call_args[0][0]
        assert call_args.event_type == EventType.ADAPTER_REGISTERED
        assert call_args.data['adapter_id'] == test_adapter_config.identity

    async def test_register_duplicate_adapter(self, registry_service, test_adapter_config):
        """测试重复注册适配器"""
        # 首次注册
        result1 = await registry_service.register_adapter(test_adapter_config)
        assert result1 is True
        
        # 重复注册
        result2 = await registry_service.register_adapter(test_adapter_config)
        assert result2 is False
        
        # 验证只有一个注册
        registrations = await registry_service.get_all_registrations()
        assert len(registrations) == 1

    async def test_register_adapter_max_limit(self, event_bus):
        """测试注册数量限制"""
        # 创建限制为1的配置
        config = {'max_registrations': 1, 'enable_validation': False}
        service = AdapterRegistryService(event_bus=event_bus, config=config)
        await service.initialize()
        await service.start()
        
        try:
            # 注册第一个适配器
            config1 = AdapterTestUtils.create_test_adapter_configuration()
            config1.identity = "adapter-1"
            await service.register_adapter(config1)
            
            # 尝试注册第二个适配器（应该失败）
            config2 = AdapterTestUtils.create_test_adapter_configuration()
            config2.identity = "adapter-2"
            
            with pytest.raises(RuntimeError, match="Maximum registrations limit reached"):
                await service.register_adapter(config2)
                
        finally:
            await service.stop()

    async def test_unregister_adapter(self, registry_service, test_adapter_config, event_bus):
        """测试注销适配器"""
        # 先注册适配器
        await registry_service.register_adapter(test_adapter_config)
        
        # 注销适配器
        result = await registry_service.unregister_adapter(test_adapter_config.identity)
        assert result is True
        
        # 验证适配器已注销
        registrations = await registry_service.get_all_registrations()
        assert len(registrations) == 0
        
        # 验证事件发送
        assert event_bus.emit.call_count == 2  # 注册 + 注销
        unregister_call = event_bus.emit.call_args_list[1][0][0]
        assert unregister_call.event_type == EventType.ADAPTER_UNREGISTERED

    async def test_unregister_nonexistent_adapter(self, registry_service):
        """测试注销不存在的适配器"""
        result = await registry_service.unregister_adapter("nonexistent-adapter")
        assert result is False

    async def test_get_adapter_registration(self, registry_service, test_adapter_config):
        """测试获取适配器注册信息"""
        # 注册适配器
        await registry_service.register_adapter(test_adapter_config)
        
        # 获取注册信息
        registration = await registry_service.get_registration(test_adapter_config.identity)
        assert registration is not None
        assert registration.identity.adapter_id == test_adapter_config.identity
        
        # 获取不存在的适配器
        nonexistent = await registry_service.get_registration("nonexistent")
        assert nonexistent is None

    async def test_find_adapters_by_type(self, registry_service):
        """测试按类型查找适配器"""
        # 注册不同类型的适配器
        soft_config = AdapterTestUtils.create_test_adapter_configuration()
        soft_config.identity = "soft-adapter"
        soft_config.adapter_type = AdapterType.SOFT
        
        hard_config = AdapterTestUtils.create_test_adapter_configuration()
        hard_config.identity = "hard-adapter"
        hard_config.adapter_type = AdapterType.HARD
        
        await registry_service.register_adapter(soft_config)
        await registry_service.register_adapter(hard_config)
        
        # 查找软适配器
        soft_adapters = await registry_service.find_adapters_by_type(AdapterType.SOFT)
        assert len(soft_adapters) == 1
        assert soft_adapters[0].identity.adapter_id == "soft-adapter"
        
        # 查找硬适配器
        hard_adapters = await registry_service.find_adapters_by_type(AdapterType.HARD)
        assert len(hard_adapters) == 1
        assert hard_adapters[0].identity.adapter_id == "hard-adapter"

    async def test_find_adapters_by_tags(self, registry_service):
        """测试按标签查找适配器"""
        # 注册带标签的适配器
        config1 = AdapterTestUtils.create_test_adapter_configuration()
        config1.identity = "adapter-1"
        config1.tags = ["tag1", "tag2"]
        
        config2 = AdapterTestUtils.create_test_adapter_configuration()
        config2.identity = "adapter-2"
        config2.tags = ["tag2", "tag3"]
        
        await registry_service.register_adapter(config1)
        await registry_service.register_adapter(config2)
        
        # 按标签查找
        tag1_adapters = await registry_service.find_adapters_by_tags(["tag1"])
        assert len(tag1_adapters) == 1
        assert tag1_adapters[0].identity.adapter_id == "adapter-1"
        
        tag2_adapters = await registry_service.find_adapters_by_tags(["tag2"])
        assert len(tag2_adapters) == 2

    async def test_health_check(self, registry_service):
        """测试健康检查"""
        health_result = await registry_service.health_check()
        
        assert isinstance(health_result, HealthCheckResult)
        assert health_result.is_healthy is True
        assert health_result.service_name == "adapter_registry"
        assert "registrations_count" in health_result.details

    async def test_service_metrics(self, registry_service, test_adapter_config):
        """测试服务指标"""
        # 执行一些操作
        await registry_service.register_adapter(test_adapter_config)
        await registry_service.get_registration(test_adapter_config.identity)
        
        # 获取指标
        metrics = registry_service.get_metrics()
        assert metrics.request_count >= 2  # 至少有注册和查询操作
        assert metrics.last_activity is not None

    @pytest.mark.asyncio
    async def test_concurrent_registration(self, event_bus, registry_config):
        """测试并发注册"""
        service = AdapterRegistryService(event_bus=event_bus, config=registry_config)
        await service.initialize()
        await service.start()
        
        try:
            # 创建多个适配器配置
            configs = []
            for i in range(10):
                config = AdapterTestUtils.create_test_adapter_configuration()
                config.identity = f"adapter-{i}"
                configs.append(config)
            
            # 并发注册
            tasks = [service.register_adapter(config) for config in configs]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 验证结果
            successful_registrations = sum(1 for r in results if r is True)
            assert successful_registrations == 10
            
            # 验证所有适配器都已注册
            registrations = await service.get_all_registrations()
            assert len(registrations) == 10
            
        finally:
            await service.stop()

    async def test_validation_enabled(self, event_bus):
        """测试启用验证的注册"""
        config = {'enable_validation': True}
        service = AdapterRegistryService(event_bus=event_bus, config=config)
        await service.initialize()
        await service.start()
        
        try:
            # 创建无效配置（缺少必要字段）
            invalid_config = Mock()
            invalid_config.identity = None  # 无效身份
            
            # 尝试注册应该失败
            with pytest.raises(Exception):
                await service.register_adapter(invalid_config)
                
        finally:
            await service.stop()

    async def test_auto_cleanup(self, event_bus):
        """测试自动清理功能"""
        config = {
            'auto_cleanup': True,
            'cleanup_interval': 0.1  # 100ms for testing
        }
        service = AdapterRegistryService(event_bus=event_bus, config=config)
        await service.initialize()
        await service.start()
        
        try:
            # 等待清理任务启动
            await asyncio.sleep(0.2)
            
            # 验证清理任务正在运行
            assert service._cleanup_task is not None
            assert not service._cleanup_task.done()
            
        finally:
            await service.stop()
            
            # 验证清理任务已停止
            if service._cleanup_task:
                assert service._cleanup_task.done()

    async def test_error_handling(self, registry_service):
        """测试错误处理"""
        # 测试无效参数
        with pytest.raises(Exception):
            await registry_service.register_adapter(None)
        
        # 测试服务未运行时的操作
        await registry_service.stop()
        
        with pytest.raises(RuntimeError):
            config = AdapterTestUtils.create_test_adapter_configuration()
            await registry_service.register_adapter(config)
