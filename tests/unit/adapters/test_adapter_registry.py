# -*- coding: utf-8 -*-
"""
适配器注册中心单元测试
基于实际的适配器框架实现
"""
import pytest
import asyncio
import threading
import time
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from zishu.adapters.base import (
    AdapterRegistry, BaseAdapter, AdapterRegistration, RegistryEvent,
    EventBus, HealthMonitor, SecurityManager, PerformanceMonitor,
    DependencyGraph, ExecutionContext, ExecutionResult, HealthCheckResult,
    AdapterMetadata, AdapterType, AdapterStatus, RegistryStatus,
    AdapterRegistrationStatus, EventType, create_adapter_registry,
    get_default_registry, set_default_registry
)
from zishu.adapters.base.exceptions import (
    AdapterRegistrationError, AdapterNotFoundError, AdapterAlreadyExistsError,
    AdapterLoadingError, AdapterDependencyError
)
from zishu.adapters.base.metadata import AdapterCapability


class TestAdapter(BaseAdapter):
    """测试用的具体适配器实现"""
    
    def _load_metadata(self) -> AdapterMetadata:
        """加载适配器元数据"""
        return AdapterMetadata(
            name=self.name,
            version=self.version,
            adapter_type=AdapterType.LANGUAGE_MODEL,
            description="Test adapter for unit testing",
            author="Test Suite",
            license="MIT",
            tags=["test", "mock"],
            capabilities=[
                AdapterCapability(
                    name="test_capability",
                    description="Test capability",
                    input_types=["text"],
                    output_types=["text"]
                )
            ]
        )
    
    async def _initialize_impl(self) -> bool:
        """适配器初始化实现"""
        return True
    
    async def _process_impl(self, input_data: Any, context: ExecutionContext) -> Any:
        """适配器核心处理逻辑实现"""
        return f"Processed: {input_data}"
    
    def _get_capabilities_impl(self) -> List[AdapterCapability]:
        """获取适配器能力实现"""
        return [
            AdapterCapability(
                name="test_capability",
                description="Test capability",
                input_types=["text"],
                output_types=["text"]
            )
        ]
    
    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查实现"""
        return HealthCheckResult(
            is_healthy=True,
            status="healthy",
            message="Test adapter is healthy"
        )
    
    async def _cleanup_impl(self) -> None:
        """适配器清理实现"""
        pass


@pytest.mark.unit
@pytest.mark.adapters
class TestAdapterRegistry:
    """适配器注册中心测试类"""
    
    @pytest.fixture
    def registry(self):
        """创建注册中心实例"""
        return AdapterRegistry()
    
    @pytest.fixture
    def mock_adapter(self):
        """创建模拟适配器"""
        adapter = Mock(spec=BaseAdapter)
        adapter.metadata = Mock(spec=AdapterMetadata)
        adapter.metadata.id = "test-adapter"
        adapter.metadata.name = "Test Adapter"
        adapter.metadata.version = "1.0.0"
        adapter.metadata.adapter_type = AdapterType.SOFT
        adapter.metadata.dependencies = []
        adapter.initialize = AsyncMock(return_value=True)
        adapter.cleanup = AsyncMock()
        adapter.health_check = AsyncMock(return_value=HealthCheckResult(
            is_healthy=True,
            status="healthy"
        ))
        return adapter
    
    @pytest.fixture
    def sample_config(self):
        """示例配置"""
        return {
            "timeout": 30,
            "max_retries": 3,
            "debug": False,
            "adapter_type": "soft"
        }
    
    def test_registry_initialization(self, registry):
        """测试注册中心初始化"""
        assert registry.status == RegistryStatus.INITIALIZING
        assert len(registry._registrations) == 0
        assert isinstance(registry.event_bus, EventBus)
        assert isinstance(registry.health_monitor, HealthMonitor) or registry.health_monitor is None
        assert isinstance(registry.security_manager, SecurityManager) or registry.security_manager is None  
        assert isinstance(registry.performance_monitor, PerformanceMonitor)
        assert isinstance(registry._dependency_graph, DependencyGraph)
    
    @pytest.mark.asyncio
    async def test_registry_start_stop(self, registry):
        """测试注册中心启动和停止"""
        # 启动
        await registry.start()
        assert registry.status == RegistryStatus.RUNNING
        
        # 停止
        await registry.stop()
        assert registry.status == RegistryStatus.STOPPED
    
    @pytest.mark.asyncio
    async def test_register_adapter_success(self, registry, mock_adapter, sample_config):
        """测试成功注册适配器"""
        await registry.start()
        
        # 注册适配器
        registration = await registry.register_adapter(
            "test-adapter",
            TestAdapter,
            sample_config
        )
        
        assert isinstance(registration, AdapterRegistration)
        assert registration.adapter_id == "test-adapter"
        assert registration.status == AdapterRegistrationStatus.REGISTERED
        assert registry.has_adapter("test-adapter")
    
    @pytest.mark.asyncio
    async def test_register_adapter_duplicate(self, registry, mock_adapter, sample_config):
        """测试重复注册适配器"""
        await registry.start()
        
        # 首次注册
        await registry.register_adapter("test-adapter", TestAdapter, sample_config)
        
        # 重复注册应该抛出异常
        with pytest.raises(AdapterAlreadyExistsError):
            await registry.register_adapter("test-adapter", TestAdapter, sample_config)
    
    @pytest.mark.asyncio
    async def test_unregister_adapter_success(self, registry, mock_adapter, sample_config):
        """测试成功注销适配器"""
        await registry.start()
        
        # 先注册
        await registry.register_adapter("test-adapter", TestAdapter, sample_config)
        assert registry.has_adapter("test-adapter")
        
        # 注销
        await registry.unregister_adapter("test-adapter")
        assert not registry.has_adapter("test-adapter")
    
    @pytest.mark.asyncio
    async def test_unregister_nonexistent_adapter(self, registry):
        """测试注销不存在的适配器"""
        await registry.start()
        
        with pytest.raises(AdapterNotFoundError):
            await registry.unregister_adapter("nonexistent-adapter")
    
    @pytest.mark.asyncio
    async def test_get_adapter_success(self, registry, mock_adapter, sample_config):
        """测试成功获取适配器"""
        await registry.start()
        
        # 注册适配器
        await registry.register_adapter("test-adapter", TestAdapter, sample_config)
        
        # 获取适配器
        retrieved_adapter = registry.get_adapter("test-adapter")
        assert retrieved_adapter is not None
        assert retrieved_adapter.metadata.id == "test-adapter"
    
    @pytest.mark.asyncio
    async def test_get_nonexistent_adapter(self, registry):
        """测试获取不存在的适配器"""
        await registry.start()
        
        # 获取不存在的适配器应该返回 None
        nonexistent_adapter = registry.get_adapter("nonexistent-adapter")
        assert nonexistent_adapter is None
    
    @pytest.mark.asyncio
    async def test_list_adapters(self, registry, mock_adapter, sample_config):
        """测试列出适配器"""
        await registry.start()
        
        # 注册多个适配器
        for i in range(3):
            adapter_id = f"test-adapter-{i}"
            await registry.register_adapter(adapter_id, TestAdapter, sample_config)
        
        # 列出所有适配器
        adapters = registry.list_adapters()
        assert len(adapters) == 3
        
        # 按类型过滤
        soft_adapters = registry.list_adapters()
        assert len(soft_adapters) == 3
        
        # 按状态过滤
        active_adapters = registry.list_adapters()
        assert len(active_adapters) == 3
    
    @pytest.mark.asyncio
    async def test_execute_adapter(self, registry, mock_adapter, sample_config):
        """测试执行适配器"""
        await registry.start()
        
        # 设置适配器的process方法
        mock_adapter.process = AsyncMock(return_value="test result")
        
        # 注册适配器
        await registry.register_adapter("test-adapter", TestAdapter, sample_config)
        
        # 创建执行上下文
        context = ExecutionContext(
            user_id="user-123",
            session_id="session-456"
        )
        
        # 执行适配器
        result = await registry.execute_adapter("test-adapter", "test input", context)
        
        assert isinstance(result, ExecutionResult)
        assert result.status == "success"
        assert result.output == "test result"
        assert result.adapter_id == "test-adapter"
    
    @pytest.mark.asyncio
    async def test_health_check_adapter(self, registry, mock_adapter, sample_config):
        """测试适配器健康检查"""
        await registry.start()
        
        # 注册适配器
        await registry.register_adapter("test-adapter", TestAdapter, sample_config)
        
        # 执行健康检查
        health_result = await registry.health_check_adapter("test-adapter")
        
        assert isinstance(health_result, HealthCheckResult)
        assert health_result.is_healthy is True
        assert health_result.status == "healthy"
        
        # 验证适配器的健康检查被调用
        mock_adapter.health_check.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_dependency_resolution(self, registry):
        """测试依赖解析"""
        await registry.start()
        
        # 创建有依赖关系的适配器
        adapter_a = Mock(spec=BaseAdapter)
        adapter_a.metadata = Mock(spec=AdapterMetadata)
        adapter_a.metadata.id = "adapter-a"
        adapter_a.metadata.dependencies = []
        adapter_a.initialize = AsyncMock(return_value=True)
        
        adapter_b = Mock(spec=BaseAdapter)
        adapter_b.metadata = Mock(spec=AdapterMetadata)
        adapter_b.metadata.id = "adapter-b"
        adapter_b.metadata.dependencies = ["adapter-a"]
        adapter_b.initialize = AsyncMock(return_value=True)
        
        # 注册适配器（先注册依赖的适配器）
        await registry.register_adapter("adapter-a", adapter_a.__class__, {})
        await registry.register_adapter("adapter-b", adapter_b.__class__, {})
        
        # 验证依赖图
        dependencies = registry._dependency_graph.get_dependencies("adapter-b")
        assert "adapter-a" in dependencies
    
    @pytest.mark.asyncio
    async def test_dependency_cycle_detection(self, registry):
        """测试循环依赖检测"""
        await registry.start()
        
        # 创建循环依赖的适配器
        adapter_a = Mock(spec=BaseAdapter)
        adapter_a.metadata = Mock(spec=AdapterMetadata)
        adapter_a.metadata.id = "adapter-a"
        adapter_a.metadata.dependencies = ["adapter-b"]
        
        adapter_b = Mock(spec=BaseAdapter)
        adapter_b.metadata = Mock(spec=AdapterMetadata)
        adapter_b.metadata.id = "adapter-b"
        adapter_b.metadata.dependencies = ["adapter-a"]
        
        # 注册第一个适配器
        await registry.register_adapter("adapter-a", adapter_a.__class__, {})
        
        # 注册第二个适配器应该检测到循环依赖
        with pytest.raises(AdapterDependencyError):
            await registry.register_adapter("adapter-b", adapter_b.__class__, {})
    
    def test_has_adapter(self, registry, mock_adapter, sample_config):
        """测试检查适配器是否存在"""
        # 未注册时
        assert not registry.has_adapter("test-adapter")
        
        # 注册后
        asyncio.run(registry.start())
        asyncio.run(registry.register_adapter("test-adapter", TestAdapter, sample_config))
        assert registry.has_adapter("test-adapter")
    
    @pytest.mark.asyncio
    async def test_get_adapter_info(self, registry, mock_adapter, sample_config):
        """测试获取适配器信息"""
        await registry.start()
        await registry.register_adapter("test-adapter", TestAdapter, sample_config)
        
        info = await registry.get_adapter_info("test-adapter")
        
        assert info["id"] == "test-adapter"
        assert info["name"] == "Test Adapter"
        assert info["version"] == "1.0.0"
        assert info["type"] == AdapterType.SOFT
        assert info["status"] == AdapterStatus.LOADED
    
    @pytest.mark.asyncio
    async def test_registry_statistics(self, registry, mock_adapter, sample_config):
        """测试注册中心统计信息"""
        await registry.start()
        
        # 注册几个适配器
        for i in range(3):
            await registry.register_adapter(f"adapter-{i}", TestAdapter, sample_config)
        
        stats = await registry.get_statistics()
        
        assert stats["total_adapters"] == 3
        assert stats["running_adapters"] == 3
        assert stats["registry_status"] == RegistryStatus.RUNNING
        assert "uptime" in stats
        assert "performance_metrics" in stats


@pytest.mark.unit
@pytest.mark.adapters
class TestEventBus:
    """事件总线测试类"""
    
    @pytest.fixture
    def event_bus(self):
        """创建事件总线实例"""
        return EventBus()
    
    def test_event_bus_initialization(self, event_bus):
        """测试事件总线初始化"""
        assert len(event_bus._listeners) == 0
        assert isinstance(event_bus._lock, threading.RLock)
    
    def test_subscribe_and_publish(self, event_bus):
        """测试订阅和发布事件"""
        received_events = []
        
        def event_handler(event):
            received_events.append(event)
        
        # 订阅事件
        event_bus.subscribe(EventType.ADAPTER_REGISTERED, event_handler)
        
        # 发布事件
        event = RegistryEvent(
            event_type=EventType.ADAPTER_REGISTERED,
            adapter_id="test-adapter",
            timestamp=datetime.now(timezone.utc)
        )
        event_bus.publish(event)
        
        # 验证事件被接收
        assert len(received_events) == 1
        assert received_events[0] is event
    
    def test_unsubscribe(self, event_bus):
        """测试取消订阅"""
        received_events = []
        
        def event_handler(event):
            received_events.append(event)
        
        # 订阅
        event_bus.subscribe(EventType.ADAPTER_REGISTERED, event_handler)
        
        # 发布事件
        event = RegistryEvent(
            event_type=EventType.ADAPTER_REGISTERED,
            adapter_id="test-adapter",
            timestamp=datetime.now(timezone.utc)
        )
        event_bus.publish(event)
        assert len(received_events) == 1
        
        # 取消订阅
        event_bus.unsubscribe(EventType.ADAPTER_REGISTERED, event_handler)
        
        # 再次发布事件
        event_bus.publish(event)
        assert len(received_events) == 1  # 应该还是1，没有增加
    
    def test_multiple_listeners(self, event_bus):
        """测试多个监听器"""
        received_events_1 = []
        received_events_2 = []
        
        def handler_1(event):
            received_events_1.append(event)
        
        def handler_2(event):
            received_events_2.append(event)
        
        # 订阅多个处理器
        event_bus.subscribe(EventType.ADAPTER_REGISTERED, handler_1)
        event_bus.subscribe(EventType.ADAPTER_REGISTERED, handler_2)
        
        # 发布事件
        event = RegistryEvent(
            event_type=EventType.ADAPTER_REGISTERED,
            adapter_id="test-adapter",
            timestamp=datetime.now(timezone.utc)
        )
        event_bus.publish(event)
        
        # 验证所有处理器都收到事件
        assert len(received_events_1) == 1
        assert len(received_events_2) == 1


@pytest.mark.unit
@pytest.mark.adapters
class TestHealthMonitor:
    """健康监控器测试类"""
    
    @pytest.fixture
    def health_monitor(self, mock_registry):
        """创建健康监控器实例"""
        return HealthMonitor(mock_registry)
    
    @pytest.fixture
    def mock_registry(self):
        """模拟注册中心"""
        registry = Mock()
        registry.list_adapters = AsyncMock(return_value=[])
        registry.health_check_adapter = AsyncMock(return_value=HealthCheckResult(
            is_healthy=True,
            status="healthy"
        ))
        return registry
    
    @pytest.mark.asyncio
    async def test_health_monitor_start_stop(self, health_monitor):
        """测试健康监控器启动和停止"""
        # 启动
        await health_monitor.start()
        assert health_monitor.is_running is True
        
        # 停止
        await health_monitor.stop()
        assert health_monitor.is_running is False
    
    @pytest.mark.asyncio
    async def test_health_check_execution(self, health_monitor, mock_registry):
        """测试健康检查执行"""
        health_monitor._registry = mock_registry
        
        # 执行健康检查
        results = await health_monitor.check_all_adapters()
        
        assert isinstance(results, dict)
        # 由于没有适配器，结果应该为空
        assert len(results) == 0
    
    def test_health_status_tracking(self, health_monitor):
        """测试健康状态跟踪"""
        adapter_id = "test-adapter"
        
        # 记录健康状态
        health_result = HealthCheckResult(
            is_healthy=True,
            status="healthy"
        )
        health_monitor.record_health_status(adapter_id, health_result)
        
        # 获取健康历史
        history = health_monitor.get_health_history(adapter_id)
        assert len(history) == 1
        assert history[0].is_healthy is True


@pytest.mark.unit
@pytest.mark.adapters
class TestRegistryFactoryFunctions:
    """注册中心工厂函数测试类"""
    
    def test_create_adapter_registry(self):
        """测试创建适配器注册中心"""
        registry = create_adapter_registry(
            enable_health_monitoring=True,
            enable_security=True,
            max_concurrent_operations=10
        )
        
        assert isinstance(registry, AdapterRegistry)
        assert registry._config["enable_health_monitoring"] is True
        assert registry._config["enable_security"] is True
        assert registry._config["max_concurrent_operations"] == 10
    
    def test_default_registry_management(self):
        """测试默认注册中心管理"""
        # 创建新的注册中心
        registry = create_adapter_registry()
        
        # 设置为默认
        set_default_registry(registry)
        
        # 获取默认注册中心
        default_registry = get_default_registry()
        assert default_registry is registry
    
    def test_registry_configuration_options(self):
        """测试注册中心配置选项"""
        # 开发环境配置
        dev_registry = create_adapter_registry(
            enable_health_monitoring=True,
            enable_security=False,
            enable_auto_recovery=False,
            max_concurrent_operations=3,
            health_check_interval=10
        )
        
        assert dev_registry._config["enable_security"] is False
        assert dev_registry._config["max_concurrent_operations"] == 3
        
        # 生产环境配置
        prod_registry = create_adapter_registry(
            enable_health_monitoring=True,
            enable_security=True,
            enable_auto_recovery=True,
            max_concurrent_operations=10,
            health_check_interval=30
        )
        
        assert prod_registry._config["enable_security"] is True
        assert prod_registry._config["enable_auto_recovery"] is True


@pytest.mark.integration
@pytest.mark.adapters
class TestRegistryIntegration:
    """注册中心集成测试"""
    
    @pytest.mark.asyncio
    async def test_full_adapter_lifecycle(self):
        """测试完整的适配器生命周期"""
        registry = create_adapter_registry()
        
        # 创建测试适配器
        class TestAdapter(BaseAdapter):
            def __init__(self, config):
                super().__init__(config)
                self.initialized = False
                self.cleaned_up = False
            
            def _load_metadata(self):
                return AdapterMetadata(
                    id="test-adapter",
                    name="Test Adapter",
                    version="1.0.0",
                    adapter_type=AdapterType.SOFT,
                    dependencies=[]
                )
            
            async def initialize(self):
                self.initialized = True
                return True
            
            async def cleanup(self):
                self.cleaned_up = True
            
            async def process(self, input_data, context):
                return f"Processed: {input_data}"
            
            async def health_check(self):
                return HealthCheckResult(
                    is_healthy=self.initialized,
                    status="healthy" if self.initialized else "unhealthy"
                )
        
        try:
            # 启动注册中心
            await registry.start()
            
            # 注册适配器
            registration = await registry.register_adapter(
                "test-adapter",
                TestAdapter,
                {"timeout": 30}
            )
            assert registration.status == AdapterRegistrationStatus.REGISTERED
            
            # 获取适配器
            adapter = registry.get_adapter("test-adapter")
            assert adapter is not None
            
            # 执行适配器
            context = ExecutionContext(user_id="test-user")
            result = await registry.execute_adapter("test-adapter", "test input", context)
            assert result.status == "success"
            assert result.output == "Processed: test input"
            
            # 健康检查
            health_result = await registry.health_check_adapter("test-adapter")
            assert health_result.is_healthy is True
            
            # 注销适配器
            await registry.unregister_adapter("test-adapter")
            assert not registry.has_adapter("test-adapter")
            
        finally:
            # 停止注册中心
            await registry.stop()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
