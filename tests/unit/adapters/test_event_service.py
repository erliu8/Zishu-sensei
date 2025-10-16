# -*- coding: utf-8 -*-
"""
适配器事件服务测试

测试新架构的适配器事件服务功能
"""

import pytest
import pytest_asyncio
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime, timezone
from typing import Dict, Any, List, Callable

from zishu.adapters.core.services.event_service import (
    AdapterEventService, EventSubscription, EventDeliveryResult,
    EventMetrics, EventDeliveryMode, EventPersistenceMode,
    LoggingEventHandler, MetricsEventHandler, FilterEventHandler
)
from zishu.adapters.core.services.base import ServiceStatus, HealthCheckResult
from zishu.adapters.core.types import EventType, Priority
from zishu.adapters.core.events import EventBus, Event

from tests.utils.adapter_test_utils import AdapterTestUtils


class TestEventHandler:
    """测试用事件处理器"""
    
    def __init__(self):
        self.handled_events = []
        self.call_count = 0
        self.should_fail = False
    
    async def handle_event(self, event: Event) -> bool:
        self.call_count += 1
        if self.should_fail:
            raise RuntimeError("Handler failure")
        
        self.handled_events.append(event)
        return True


class TestAdapterEventService:
    """适配器事件服务测试类"""

    @pytest.fixture
    def event_config(self):
        """创建事件服务配置"""
        return {
            'max_subscribers': 100,
            'event_queue_size': 1000,
            'delivery_timeout': 5.0,
            'enable_persistence': False,
            'enable_metrics': True,
            'batch_size': 10,
            'batch_timeout': 1.0
        }

    @pytest_asyncio.fixture
    async def event_service(self, event_config):
        """创建事件服务实例"""
        service = AdapterEventService(config=event_config)
        await service.initialize()
        await service.start()
        yield service
        await service.stop()

    @pytest.fixture
    def test_event(self):
        """创建测试事件"""
        return Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test_source",
            data={
                "adapter_id": "test-adapter-001",
                "timestamp": datetime.now(timezone.utc),
                "test_data": "test_value"
            },
            priority=Priority.MEDIUM
        )

    @pytest.mark.asyncio
    async def test_service_initialization(self, event_config):
        """测试服务初始化"""
        service = AdapterEventService(config=event_config)
        
        # 验证初始状态
        assert service.name == "adapter_event"
        assert service.status == ServiceStatus.CREATED
        assert service.config == event_config
        
        # 初始化服务
        await service.initialize()
        assert service.status == ServiceStatus.READY
        
        # 启动服务
        await service.start()
        assert service.status == ServiceStatus.RUNNING
        
        # 停止服务
        await service.stop()
        assert service.status == ServiceStatus.STOPPED

    @pytest.mark.asyncio
    async def test_subscribe_and_emit_event(self, event_service, test_event):
        """测试订阅和发送事件"""
        handler = TestEventHandler()
        
        # 订阅事件
        subscription_id = await event_service.subscribe(
            subscriber_id="test_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event
        )
        
        assert subscription_id is not None
        assert "test_subscriber" in subscription_id
        
        # 发送事件
        await event_service.emit_event(test_event)
        
        # 等待事件处理
        await asyncio.sleep(0.1)
        
        # 验证事件被处理
        assert handler.call_count == 1
        assert len(handler.handled_events) == 1
        assert handler.handled_events[0].event_type == EventType.ADAPTER_REGISTERED

    @pytest.mark.asyncio
    async def test_multiple_subscribers(self, event_service, test_event):
        """测试多个订阅者"""
        handlers = [TestEventHandler() for _ in range(3)]
        
        # 订阅同一事件类型
        for i, handler in enumerate(handlers):
            await event_service.subscribe(
                subscriber_id=f"subscriber_{i}",
                event_types=EventType.ADAPTER_REGISTERED,
                handler=handler.handle_event
            )
        
        # 发送事件
        await event_service.emit_event(test_event)
        
        # 等待事件处理
        await asyncio.sleep(0.1)
        
        # 验证所有处理器都收到事件
        for handler in handlers:
            assert handler.call_count == 1
            assert len(handler.handled_events) == 1

    @pytest.mark.asyncio
    async def test_unsubscribe(self, event_service, test_event):
        """测试取消订阅"""
        handler = TestEventHandler()
        
        # 订阅事件
        subscription_id = await event_service.subscribe(
            subscriber_id="test_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event
        )
        
        # 发送事件
        await event_service.emit_event(test_event)
        await asyncio.sleep(0.1)
        
        # 验证事件被处理
        assert handler.call_count == 1
        
        # 取消订阅
        result = await event_service.unsubscribe(subscription_id)
        assert result is True
        
        # 再次发送事件
        await event_service.emit_event(test_event)
        await asyncio.sleep(0.1)
        
        # 验证事件不再被处理
        assert handler.call_count == 1  # 仍然是1，没有增加

    @pytest.mark.asyncio
    async def test_event_filtering(self, event_service):
        """测试事件过滤"""
        handler = TestEventHandler()
        
        # 创建过滤器（只处理特定适配器的事件）
        def event_filter(event: Event) -> bool:
            return event.data.get("adapter_id") == "target-adapter"
        
        # 订阅带过滤器的事件
        await event_service.subscribe(
            subscriber_id="filtered_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            filter_func=event_filter
        )
        
        # 发送匹配的事件
        matching_event = Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test",
            data={"adapter_id": "target-adapter"}
        )
        await event_service.emit_event(matching_event)
        
        # 发送不匹配的事件
        non_matching_event = Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test",
            data={"adapter_id": "other-adapter"}
        )
        await event_service.emit_event(non_matching_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证只有匹配的事件被处理
        assert handler.call_count == 1
        assert handler.handled_events[0].data["adapter_id"] == "target-adapter"

    @pytest.mark.asyncio
    async def test_event_priority_handling(self, event_service):
        """测试事件优先级处理"""
        handler = TestEventHandler()
        
        # 订阅事件
        await event_service.subscribe(
            subscriber_id="priority_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event
        )
        
        # 发送不同优先级的事件
        high_priority_event = Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test",
            data={"priority": "high"},
            priority=Priority.HIGH
        )
        
        low_priority_event = Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test",
            data={"priority": "low"},
            priority=Priority.LOW
        )
        
        # 先发送低优先级，再发送高优先级
        await event_service.emit_event(low_priority_event)
        await event_service.emit_event(high_priority_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证事件都被处理
        assert handler.call_count == 2
        # 高优先级事件应该先被处理（如果实现了优先级队列）

    @pytest.mark.asyncio
    async def test_async_event_delivery(self, event_service, test_event):
        """测试异步事件传递"""
        handler = TestEventHandler()
        
        # 订阅异步传递模式
        await event_service.subscribe(
            subscriber_id="async_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            delivery_mode=EventDeliveryMode.ASYNC
        )
        
        # 发送事件
        await event_service.emit_event(test_event)
        
        # 等待异步处理完成
        await asyncio.sleep(0.1)
        
        # 验证事件被处理
        assert handler.call_count == 1

    @pytest.mark.asyncio
    async def test_sync_event_delivery(self, event_service, test_event):
        """测试同步事件传递"""
        handler = TestEventHandler()
        
        # 订阅同步传递模式
        await event_service.subscribe(
            subscriber_id="sync_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            delivery_mode=EventDeliveryMode.SYNC
        )
        
        # 发送事件
        await event_service.emit_event(test_event)
        
        # 事件应该已经被处理
        assert handler.call_count == 1

    @pytest.mark.asyncio
    async def test_multiple_event_processing(self, event_service):
        """测试多个事件处理"""
        handler = TestEventHandler()
        
        # 订阅事件（使用火后忘模式）
        await event_service.subscribe(
            subscriber_id="multiple_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            delivery_mode=EventDeliveryMode.FIRE_AND_FORGET
        )
        
        # 发送多个事件
        events = []
        for i in range(5):
            event = Event(
                event_type=EventType.ADAPTER_REGISTERED,
                source="test",
                data={"batch_id": i}
            )
            events.append(event)
            await event_service.emit_event(event)
        
        # 等待处理
        await asyncio.sleep(0.2)
        
        # 验证所有事件都被处理
        assert handler.call_count == 5

    @pytest.mark.asyncio
    async def test_event_handler_failure(self, event_service, test_event):
        """测试事件处理器失败"""
        handler = TestEventHandler()
        handler.should_fail = True
        
        # 订阅事件
        await event_service.subscribe(
            subscriber_id="failing_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event
        )
        
        # 发送事件
        await event_service.emit_event(test_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证处理器被调用但失败
        assert handler.call_count == 1

    @pytest.mark.asyncio
    async def test_event_metrics_collection(self, event_service, test_event):
        """测试事件指标收集"""
        handler = TestEventHandler()
        
        # 订阅事件
        await event_service.subscribe(
            subscriber_id="metrics_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event
        )
        
        # 发送多个事件
        for _ in range(5):
            await event_service.emit_event(test_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 获取事件指标
        metrics = await event_service.get_event_metrics()
        
        assert isinstance(metrics, EventMetrics)
        assert metrics.total_events >= 5
        assert metrics.successful_deliveries >= 5

    @pytest.mark.asyncio
    async def test_subscription_management(self, event_service):
        """测试订阅管理"""
        handler = TestEventHandler()
        
        # 创建订阅
        subscription_id = await event_service.subscribe(
            subscriber_id="management_test",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event
        )
        
        # 获取所有订阅
        subscriptions = await event_service.get_subscriptions()
        assert len(subscriptions) > 0
        
        # 获取特定订阅者的订阅
        subscriber_subscriptions = await event_service.get_subscriptions("management_test")
        assert len(subscriber_subscriptions) > 0
        assert subscriber_subscriptions[0].subscriber_id == "management_test"

    @pytest.mark.asyncio
    async def test_wildcard_subscription(self, event_service):
        """测试通配符订阅"""
        handler = TestEventHandler()
        
        # 订阅多个事件类型
        await event_service.subscribe(
            subscriber_id="wildcard_subscriber",
            event_types=[EventType.ADAPTER_REGISTERED, EventType.ADAPTER_UNREGISTERED, EventType.ADAPTER_STARTED],
            handler=handler.handle_event
        )
        
        # 发送不同类型的事件
        events = [
            Event(event_type=EventType.ADAPTER_REGISTERED, source="test", data={}),
            Event(event_type=EventType.ADAPTER_UNREGISTERED, source="test", data={}),
            Event(event_type=EventType.ADAPTER_STARTED, source="test", data={})
        ]
        
        for event in events:
            await event_service.emit_event(event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证所有事件都被处理
        assert handler.call_count == 3

    @pytest.mark.asyncio
    async def test_logging_event_handler(self, event_service, test_event):
        """测试日志事件处理器"""
        with patch('logging.getLogger') as mock_logger:
            logger_instance = Mock()
            mock_logger.return_value = logger_instance
            
            # 创建简单的日志处理器函数
            async def logging_handler_func(event: Event) -> None:
                logger_instance.info(
                    f"Received event: {event.event_type.value} from {event.source}"
                )
            
            # 订阅事件
            await event_service.subscribe(
                subscriber_id="logging_subscriber",
                event_types=EventType.ADAPTER_REGISTERED,
                handler=logging_handler_func
            )
            
            # 发送事件
            await event_service.emit_event(test_event)
            
            # 等待处理
            await asyncio.sleep(0.1)
            
            # 验证日志被记录
            logger_instance.info.assert_called()

    @pytest.mark.asyncio
    async def test_metrics_event_handler(self, event_service, test_event):
        """测试指标事件处理器"""
        # 创建指标计数器
        event_counts = {}
        
        # 创建指标处理器函数
        async def metrics_handler_func(event: Event) -> None:
            event_type = event.event_type.value
            event_counts[event_type] = event_counts.get(event_type, 0) + 1
        
        # 订阅事件
        await event_service.subscribe(
            subscriber_id="metrics_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=metrics_handler_func
        )
        
        # 发送事件
        await event_service.emit_event(test_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证指标被记录
        assert event_counts.get(EventType.ADAPTER_REGISTERED.value, 0) == 1

    @pytest.mark.asyncio
    async def test_filter_event_handler(self, event_service):
        """测试过滤事件处理器"""
        # 这个测试实际上已经通过filter_func参数内置到了订阅中
        handler = TestEventHandler()
        
        # 创建过滤器函数
        def filter_func(event: Event) -> bool:
            return event.data.get("should_process", False)
        
        # 订阅事件，使用内置过滤器
        await event_service.subscribe(
            subscriber_id="filter_subscriber",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            filter_func=filter_func
        )
        
        # 发送应该被过滤的事件
        filtered_event = Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test",
            data={"should_process": False}
        )
        await event_service.emit_event(filtered_event)
        
        # 发送应该被处理的事件
        processed_event = Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test",
            data={"should_process": True}
        )
        await event_service.emit_event(processed_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证只有符合条件的事件被处理
        assert handler.call_count == 1

    @pytest.mark.asyncio
    async def test_concurrent_event_processing(self, event_service):
        """测试并发事件处理"""
        handlers = [TestEventHandler() for _ in range(3)]
        
        # 订阅事件
        for i, handler in enumerate(handlers):
            await event_service.subscribe(
                subscriber_id=f"concurrent_subscriber_{i}",
                event_types=EventType.ADAPTER_REGISTERED,
                handler=handler.handle_event
            )
        
        # 并发发送事件
        events = []
        for i in range(10):
            event = Event(
                event_type=EventType.ADAPTER_REGISTERED,
                source="test",
                data={"event_id": i}
            )
            events.append(event_service.emit_event(event))
        
        # 等待所有事件发送完成
        results = await asyncio.gather(*events)
        
        # emit_event不返回结果，所以我们不需要验证返回值
        
        # 等待处理完成
        await asyncio.sleep(0.2)
        
        # 验证所有处理器都收到所有事件
        for handler in handlers:
            assert handler.call_count == 10

    @pytest.mark.asyncio
    async def test_health_check(self, event_service):
        """测试健康检查"""
        health_result = await event_service.health_check()
        
        assert isinstance(health_result, HealthCheckResult)
        assert health_result.is_healthy is True
        assert "queue_size" in health_result.details
        assert "active_subscriptions" in health_result.details

    @pytest.mark.asyncio
    async def test_service_metrics(self, event_service, test_event):
        """测试服务指标"""
        handler = TestEventHandler()
        
        # 订阅和发送事件
        await event_service.subscribe(
            subscriber_id="metrics_test",
            event_types=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event
        )
        await event_service.emit_event(test_event)
        
        # 获取服务指标
        metrics = event_service.get_metrics()
        assert metrics.request_count >= 1
        assert metrics.last_activity is not None

    @pytest.mark.asyncio
    async def test_error_handling(self, event_service):
        """测试错误处理"""
        # 测试无效订阅
        with pytest.raises(Exception):
            await event_service.subscribe(
                subscriber_id=None,
                event_types=None,
                handler=None
            )
        
        # 测试发送无效事件
        with pytest.raises(Exception):
            await event_service.emit_event(None)
        
        # 测试取消不存在的订阅
        result = await event_service.unsubscribe("nonexistent")
        assert result is False
