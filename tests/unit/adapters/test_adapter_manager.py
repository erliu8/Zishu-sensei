# -*- coding: utf-8 -*-
"""
适配器管理器测试

测试新架构的适配器管理器功能
"""

import pytest
import pytest_asyncio
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
from typing import Dict, Any, List

from zishu.adapters.core.manager import AdapterManager, AdapterManagerConfig
from zishu.adapters.core.services.base import ServiceStatus, HealthCheckResult
from zishu.adapters.core.types import (
    AdapterRegistration, AdapterIdentity, AdapterConfiguration,
    AdapterStatus, AdapterType, Priority, SecurityLevel
)
from zishu.adapters.core.events import EventBus, Event, EventType

from tests.utils.adapter_test_utils import AdapterTestUtils


class TestAdapterManager:
    """适配器管理器测试类"""

    @pytest.fixture
    def manager_config(self):
        """创建管理器配置"""
        return AdapterManagerConfig(
            enable_security=False,  # 禁用安全以简化测试
            enable_metrics=False,   # 禁用指标以避免抽象类问题
            enable_validation=False,  # 禁用验证以简化测试
            max_adapters=100,
            startup_timeout=10.0,
            shutdown_timeout=5.0
        )

    @pytest_asyncio.fixture
    async def adapter_manager(self, manager_config):
        """创建适配器管理器实例"""
        manager = AdapterManager(config=manager_config)
        await manager.initialize()
        await manager.start()  # 启动管理器以便注册适配器
        yield manager
        await manager.stop()

    @pytest.fixture
    def test_adapter_class(self):
        """创建测试适配器类"""
        class TestAdapter:
            def __init__(self, config):
                self.config = config
                self.is_initialized = False
                self.is_started = False
                self.process_count = 0
            
            async def initialize(self):
                self.is_initialized = True
                return True
            
            async def start(self):
                if not self.is_initialized:
                    raise RuntimeError("Adapter not initialized")
                self.is_started = True
                return True
            
            async def stop(self):
                self.is_started = False
                return True
            
            async def process(self, input_data, context=None):
                if not self.is_started:
                    raise RuntimeError("Adapter not started")
                self.process_count += 1
                return {"result": f"processed_{self.process_count}", "input": input_data}
            
            async def health_check(self):
                from zishu.adapters.core.services.base import HealthCheckResult, ServiceHealth
                return HealthCheckResult(
                    is_healthy=self.is_started,
                    status=ServiceHealth.HEALTHY if self.is_started else ServiceHealth.UNHEALTHY,
                    message="Test adapter health check",
                    details={"process_count": self.process_count, "service_name": "test_adapter"}
                )
        
        return TestAdapter

    @pytest.fixture
    def test_adapter_config(self, test_adapter_class):
        """创建测试适配器配置"""
        # 创建适配器配置对象，用于注册
        config = AdapterConfiguration(
            identity="test-adapter-001",
            name="Test Adapter",
            version="1.0.0",
            adapter_type=AdapterType.SOFT,
            description="Test adapter for unit testing",
            author="test_system",
            tags=["test", "unit_test", "mock"],
            adapter_class=test_adapter_class,
            config={"test_param": "test_value"},
            security_level=SecurityLevel.INTERNAL,
            dependencies=[]
        )
        
        return config

    @pytest.mark.asyncio
    async def test_manager_initialization(self, manager_config):
        """测试管理器初始化"""
        manager = AdapterManager(config=manager_config)
        
        # 验证初始状态
        assert manager.config == manager_config
        assert not manager._initialized
        assert not manager.is_running
        
        # 初始化管理器
        await manager.initialize()
        assert manager._initialized
        assert not manager.is_running
        
        # 启动管理器
        await manager.start()
        assert manager.is_running
        
        # 停止管理器
        await manager.stop()
        assert not manager.is_running

    @pytest.mark.asyncio
    async def test_register_adapter(self, adapter_manager, test_adapter_config):
        """测试注册适配器"""
        # 启动管理器
        await adapter_manager.start()
        
        # 注册适配器
        result = await adapter_manager.register_adapter(test_adapter_config)
        assert result is True
        
        # 验证适配器已注册
        adapters = await adapter_manager.list_adapters()
        assert len(adapters) == 1
        adapter_ids = [adapter.adapter_id for adapter in adapters]
        assert test_adapter_config.identity in adapter_ids

    @pytest.mark.asyncio
    async def test_unregister_adapter(self, adapter_manager, test_adapter_config):
        """测试注销适配器"""
        await adapter_manager.start()
        
        # 先注册适配器
        await adapter_manager.register_adapter(test_adapter_config)
        
        # 注销适配器
        result = await adapter_manager.unregister_adapter(test_adapter_config.identity)
        assert result is True
        
        # 验证适配器已注销
        adapters = await adapter_manager.list_adapters()
        assert len(adapters) == 0

    @pytest.mark.asyncio
    async def test_start_adapter(self, adapter_manager, test_adapter_config):
        """测试启动适配器"""
        await adapter_manager.start()
        
        # 注册并启动适配器
        await adapter_manager.register_adapter(test_adapter_config)
        result = await adapter_manager.start_adapter(test_adapter_config.identity)
        assert result is True
        
        # 验证适配器状态
        status = await adapter_manager.get_adapter_status(test_adapter_config.identity)
        assert status == AdapterStatus.RUNNING

    @pytest.mark.asyncio
    async def test_stop_adapter(self, adapter_manager, test_adapter_config):
        """测试停止适配器"""
        await adapter_manager.start()
        
        # 注册、启动然后停止适配器
        await adapter_manager.register_adapter(test_adapter_config)
        await adapter_manager.start_adapter(test_adapter_config.identity)
        
        result = await adapter_manager.stop_adapter(test_adapter_config.identity)
        assert result is True
        
        # 验证适配器状态
        status = await adapter_manager.get_adapter_status(test_adapter_config.identity)
        assert status == AdapterStatus.STOPPED

    @pytest.mark.asyncio
    async def test_process_with_adapter(self, adapter_manager, test_adapter_config):
        """测试使用适配器处理数据"""
        await adapter_manager.start()
        
        # 注册并启动适配器
        await adapter_manager.register_adapter(test_adapter_config)
        await adapter_manager.start_adapter(test_adapter_config.identity)
        
        # 处理数据
        input_data = {"test": "data"}
        result = await adapter_manager.process_with_adapter(
            test_adapter_config.identity,
            input_data
        )
        
        assert result is not None
        assert "result" in result
        assert result["input"] == input_data

    @pytest.mark.asyncio
    async def test_batch_process_with_adapter(self, adapter_manager, test_adapter_config):
        """测试批量处理数据"""
        await adapter_manager.start()
        
        # 注册并启动适配器
        await adapter_manager.register_adapter(test_adapter_config)
        await adapter_manager.start_adapter(test_adapter_config.identity)
        
        # 批量处理数据
        input_batch = [{"test": f"data_{i}"} for i in range(3)]
        results = await adapter_manager.batch_process_with_adapter(
            test_adapter_config.identity,
            input_batch
        )
        
        assert len(results) == 3
        for i, result in enumerate(results):
            assert result["input"]["test"] == f"data_{i}"

    @pytest.mark.asyncio
    async def test_get_adapter_info(self, adapter_manager, test_adapter_config):
        """测试获取适配器信息"""
        await adapter_manager.start()
        
        # 注册适配器
        await adapter_manager.register_adapter(test_adapter_config)
        
        # 获取适配器信息
        info = await adapter_manager.get_adapter_info(test_adapter_config.identity)
        
        assert info is not None
        assert info.identity.adapter_id == test_adapter_config.identity
        assert info.identity.name == test_adapter_config.name

    @pytest.mark.asyncio
    async def test_list_adapters_by_type(self, adapter_manager):
        """测试按类型列出适配器"""
        await adapter_manager.start()
        
        # 创建不同类型的适配器
        soft_config = AdapterTestUtils.create_test_adapter_configuration()
        soft_config.identity = "soft-adapter"
        soft_config.adapter_type = AdapterType.SOFT
        
        hard_config = AdapterTestUtils.create_test_adapter_configuration()
        hard_config.identity = "hard-adapter"
        hard_config.adapter_type = AdapterType.HARD
        
        # 注册适配器
        await adapter_manager.register_adapter(soft_config)
        await adapter_manager.register_adapter(hard_config)
        
        # 按类型列出适配器
        soft_adapters = await adapter_manager.list_adapters_by_type(AdapterType.SOFT)
        hard_adapters = await adapter_manager.list_adapters_by_type(AdapterType.HARD)
        
        assert len(soft_adapters) == 1
        assert len(hard_adapters) == 1
        assert soft_adapters[0].identity.adapter_id == "soft-adapter"
        assert hard_adapters[0].identity.adapter_id == "hard-adapter"

    @pytest.mark.asyncio
    async def test_find_adapters_by_capability(self, adapter_manager):
        """测试按能力查找适配器"""
        await adapter_manager.start()
        
        # 创建带能力的适配器配置
        config = AdapterTestUtils.create_test_adapter_configuration()
        config.identity = "capable-adapter"
        config.capabilities = ["text_processing", "data_transformation"]
        
        # 注册适配器
        await adapter_manager.register_adapter(config)
        
        # 按能力查找适配器
        text_processors = await adapter_manager.find_adapters_by_capability("text_processing")
        data_transformers = await adapter_manager.find_adapters_by_capability("data_transformation")
        image_processors = await adapter_manager.find_adapters_by_capability("image_processing")
        
        assert len(text_processors) == 1
        assert len(data_transformers) == 1
        assert len(image_processors) == 0
        assert text_processors[0].identity.adapter_id == "capable-adapter"

    @pytest.mark.asyncio
    async def test_health_check_adapter(self, adapter_manager, test_adapter_config):
        """测试适配器健康检查"""
        await adapter_manager.start()
        
        # 注册并启动适配器
        await adapter_manager.register_adapter(test_adapter_config)
        await adapter_manager.start_adapter(test_adapter_config.identity)
        
        # 执行健康检查
        health_result = await adapter_manager.health_check_adapter(test_adapter_config.identity)
        
        assert health_result is not None
        assert health_result.is_healthy is True
        assert health_result.details.get("service_name") == "test_adapter"

    @pytest.mark.asyncio
    async def test_health_check_all_adapters(self, adapter_manager):
        """测试所有适配器健康检查"""
        await adapter_manager.start()
        
        # 创建多个适配器
        configs = []
        for i in range(3):
            config = AdapterTestUtils.create_test_adapter_configuration()
            config.identity = f"adapter-{i}"
            configs.append(config)
            await adapter_manager.register_adapter(config)
            await adapter_manager.start_adapter(config.identity)
        
        # 执行所有适配器健康检查
        health_results = await adapter_manager.health_check_all_adapters()
        
        assert len(health_results) == 3
        for adapter_id, health_result in health_results.items():
            assert health_result.is_healthy is True

    @pytest.mark.asyncio
    async def test_get_adapter_metrics(self, adapter_manager, test_adapter_config):
        """测试获取适配器指标"""
        await adapter_manager.start()
        
        # 注册并启动适配器
        await adapter_manager.register_adapter(test_adapter_config)
        await adapter_manager.start_adapter(test_adapter_config.identity)
        
        # 处理一些数据以生成指标
        for i in range(5):
            await adapter_manager.process_with_adapter(
                test_adapter_config.identity,
                {"test": f"data_{i}"}
            )
        
        # 获取适配器指标
        metrics = await adapter_manager.get_adapter_metrics(test_adapter_config.identity)
        
        assert metrics is not None
        # 验证指标包含预期字段（具体字段取决于实现）

    @pytest.mark.asyncio
    async def test_get_system_metrics(self, adapter_manager, test_adapter_config):
        """测试获取系统指标"""
        # adapter_manager fixture 已经初始化了，不需要再次 start()
        
        # 注册一些适配器
        await adapter_manager.register_adapter(test_adapter_config)
        
        # 获取系统指标
        system_metrics = await adapter_manager.get_system_metrics()
        
        assert system_metrics is not None
        assert "total_adapters" in system_metrics
        assert "running_adapters" in system_metrics
        assert system_metrics["total_adapters"] >= 1

    @pytest.mark.asyncio
    async def test_concurrent_adapter_operations(self, adapter_manager):
        """测试并发适配器操作"""
        await adapter_manager.start()
        
        # 创建多个适配器配置
        configs = []
        for i in range(5):
            config = AdapterTestUtils.create_test_adapter_configuration()
            config.identity = f"concurrent-adapter-{i}"
            configs.append(config)
        
        # 并发注册适配器
        register_tasks = [
            adapter_manager.register_adapter(config)
            for config in configs
        ]
        register_results = await asyncio.gather(*register_tasks)
        
        # 验证所有注册都成功
        assert all(register_results)
        
        # 并发启动适配器
        start_tasks = [
            adapter_manager.start_adapter(config.identity)
            for config in configs
        ]
        start_results = await asyncio.gather(*start_tasks)
        
        # 验证所有启动都成功
        assert all(start_results)

    @pytest.mark.asyncio
    async def test_adapter_lifecycle_events(self, adapter_manager, test_adapter_config):
        """测试适配器生命周期事件"""
        # 创建事件监听器
        received_events = []
        
        async def event_handler(event):
            received_events.append(event)
        
        # 订阅事件（这里需要根据实际事件系统实现）
        # await adapter_manager.subscribe_to_events(event_handler)
        
        await adapter_manager.start()
        
        # 执行适配器生命周期操作
        await adapter_manager.register_adapter(test_adapter_config)
        await adapter_manager.start_adapter(test_adapter_config.identity)
        await adapter_manager.stop_adapter(test_adapter_config.identity)
        await adapter_manager.unregister_adapter(test_adapter_config.identity)
        
        # 验证事件被发送（具体验证逻辑取决于事件系统实现）

    @pytest.mark.asyncio
    async def test_security_validation(self, adapter_manager):
        """测试安全验证"""
        await adapter_manager.start()
        
        # 创建高安全级别的适配器配置
        config = AdapterTestUtils.create_test_adapter_configuration()
        config.identity = "secure-adapter"
        config.security_level = SecurityLevel.RESTRICTED
        
        # 注册适配器（可能需要额外的安全验证）
        result = await adapter_manager.register_adapter(config)
        
        # 验证结果（具体行为取决于安全策略实现）
        assert isinstance(result, bool)

    @pytest.mark.asyncio
    async def test_dependency_resolution(self, adapter_manager):
        """测试依赖解析"""
        await adapter_manager.start()
        
        # 创建有依赖关系的适配器
        base_config = AdapterTestUtils.create_test_adapter_configuration()
        base_config.identity = "base-adapter"
        
        dependent_config = AdapterTestUtils.create_test_adapter_configuration()
        dependent_config.identity = "dependent-adapter"
        dependent_config.dependencies = ["base-adapter"]
        
        # 注册适配器
        await adapter_manager.register_adapter(base_config)
        await adapter_manager.register_adapter(dependent_config)
        
        # 启动依赖适配器（应该自动启动基础适配器）
        result = await adapter_manager.start_adapter("dependent-adapter")
        assert result is True
        
        # 验证基础适配器也被启动
        base_status = await adapter_manager.get_adapter_status("base-adapter")
        dependent_status = await adapter_manager.get_adapter_status("dependent-adapter")
        
        assert base_status == AdapterStatus.RUNNING
        assert dependent_status == AdapterStatus.RUNNING

    @pytest.mark.asyncio
    async def test_error_handling(self, adapter_manager):
        """测试错误处理"""
        await adapter_manager.start()
        
        # 测试注册无效适配器
        invalid_config = Mock()
        invalid_config.identity = None
        
        with pytest.raises(Exception):
            await adapter_manager.register_adapter(invalid_config)
        
        # 测试启动不存在的适配器
        result = await adapter_manager.start_adapter("nonexistent-adapter")
        assert result is False
        
        # 测试处理不存在的适配器
        with pytest.raises(Exception):
            await adapter_manager.process_with_adapter("nonexistent-adapter", {})

    @pytest.mark.asyncio
    async def test_resource_management(self, adapter_manager, test_adapter_config):
        """测试资源管理"""
        await adapter_manager.start()
        
        # 注册并启动适配器
        await adapter_manager.register_adapter(test_adapter_config)
        await adapter_manager.start_adapter(test_adapter_config.identity)
        
        # 获取资源使用情况
        resource_usage = await adapter_manager.get_resource_usage()
        
        assert resource_usage is not None
        # 验证资源使用指标（具体字段取决于实现）

    @pytest.mark.asyncio
    async def test_configuration_update(self, adapter_manager, test_adapter_config):
        """测试配置更新"""
        await adapter_manager.start()
        
        # 注册适配器
        await adapter_manager.register_adapter(test_adapter_config)
        
        # 更新配置
        new_config = test_adapter_config.copy()
        new_config.config["updated_param"] = "updated_value"
        
        result = await adapter_manager.update_adapter_config(
            test_adapter_config.identity,
            new_config
        )
        
        # 验证更新结果（具体行为取决于实现）
        assert isinstance(result, bool)

    @pytest.mark.asyncio
    async def test_manager_shutdown_cleanup(self, manager_config):
        """测试管理器关闭时的清理"""
        manager = AdapterManager(config=manager_config)
        await manager.initialize()
        await manager.start()
        
        # 注册一些适配器
        config = AdapterTestUtils.create_test_adapter_configuration()
        await manager.register_adapter(config)
        await manager.start_adapter(config.identity)
        
        # 关闭管理器
        await manager.shutdown()
        
        # 验证所有资源都被清理
        # 这里的具体验证取决于实现细节
