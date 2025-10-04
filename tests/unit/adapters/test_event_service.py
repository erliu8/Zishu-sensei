# -*- coding: utf-8 -*-
"""
适配器事件服务测试

测试新架构的适配器事件服务功能
"""

import pytest
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

    @pytest.fixture
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

    async def test_service_initialization(self, event_config):
        """测试服务初始化"""
        service = AdapterEventService(config=event_config)
        
        # 验证初始状态
        assert service.name == "adapter_events"
        assert service.status == ServiceStatus.CREATED
        assert service.config == event_config
        
        # 初始化服务
        await service.initialize()
        assert service.status == ServiceStatus.INITIALIZED
        
        # 启动服务
        await service.start()
        assert service.status == ServiceStatus.RUNNING
        
        # 停止服务
        await service.stop()
        assert service.status == ServiceStatus.STOPPED

    async def test_subscribe_and_emit_event(self, event_service, test_event):
        """测试订阅和发送事件"""
        handler = TestEventHandler()
        
        # 订阅事件
        subscription = await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            subscription_id="test_subscription"
        )
        
        assert subscription is not None
        assert subscription.subscription_id == "test_subscription"
        assert subscription.event_type == EventType.ADAPTER_REGISTERED
        
        # 发送事件
        result = await event_service.emit(test_event)
        
        assert result is True
        
        # 等待事件处理
        await asyncio.sleep(0.1)
        
        # 验证事件被处理
        assert handler.call_count == 1
        assert len(handler.handled_events) == 1
        assert handler.handled_events[0].event_type == EventType.ADAPTER_REGISTERED

    async def test_multiple_subscribers(self, event_service, test_event):
        """测试多个订阅者"""
        handlers = [TestEventHandler() for _ in range(3)]
        
        # 订阅同一事件类型
        for i, handler in enumerate(handlers):
            await event_service.subscribe(
                event_type=EventType.ADAPTER_REGISTERED,
                handler=handler.handle_event,
                subscription_id=f"subscription_{i}"
            )
        
        # 发送事件
        await event_service.emit(test_event)
        
        # 等待事件处理
        await asyncio.sleep(0.1)
        
        # 验证所有处理器都收到事件
        for handler in handlers:
            assert handler.call_count == 1
            assert len(handler.handled_events) == 1

    async def test_unsubscribe(self, event_service, test_event):
        """测试取消订阅"""
        handler = TestEventHandler()
        
        # 订阅事件
        subscription = await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            subscription_id="test_subscription"
        )
        
        # 发送事件
        await event_service.emit(test_event)
        await asyncio.sleep(0.1)
        
        # 验证事件被处理
        assert handler.call_count == 1
        
        # 取消订阅
        result = await event_service.unsubscribe("test_subscription")
        assert result is True
        
        # 再次发送事件
        await event_service.emit(test_event)
        await asyncio.sleep(0.1)
        
        # 验证事件不再被处理
        assert handler.call_count == 1  # 仍然是1，没有增加

    async def test_event_filtering(self, event_service):
        """测试事件过滤"""
        handler = TestEventHandler()
        
        # 创建过滤器（只处理特定适配器的事件）
        def event_filter(event: Event) -> bool:
            return event.data.get("adapter_id") == "target-adapter"
        
        # 订阅带过滤器的事件
        await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            event_filter=event_filter,
            subscription_id="filtered_subscription"
        )
        
        # 发送匹配的事件
        matching_event = Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test",
            data={"adapter_id": "target-adapter"}
        )
        await event_service.emit(matching_event)
        
        # 发送不匹配的事件
        non_matching_event = Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test",
            data={"adapter_id": "other-adapter"}
        )
        await event_service.emit(non_matching_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证只有匹配的事件被处理
        assert handler.call_count == 1
        assert handler.handled_events[0].data["adapter_id"] == "target-adapter"

    async def test_event_priority_handling(self, event_service):
        """测试事件优先级处理"""
        handler = TestEventHandler()
        
        # 订阅事件
        await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            subscription_id="priority_subscription"
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
        await event_service.emit(low_priority_event)
        await event_service.emit(high_priority_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证事件都被处理
        assert handler.call_count == 2
        # 高优先级事件应该先被处理（如果实现了优先级队列）

    async def test_async_event_delivery(self, event_service, test_event):
        """测试异步事件传递"""
        handler = TestEventHandler()
        
        # 订阅异步传递模式
        await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            delivery_mode=EventDeliveryMode.ASYNC,
            subscription_id="async_subscription"
        )
        
        # 发送事件
        result = await event_service.emit(test_event)
        
        # 异步模式应该立即返回
        assert result is True
        
        # 等待异步处理完成
        await asyncio.sleep(0.1)
        
        # 验证事件被处理
        assert handler.call_count == 1

    async def test_sync_event_delivery(self, event_service, test_event):
        """测试同步事件传递"""
        handler = TestEventHandler()
        
        # 订阅同步传递模式
        await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            delivery_mode=EventDeliveryMode.SYNC,
            subscription_id="sync_subscription"
        )
        
        # 发送事件
        result = await event_service.emit(test_event)
        
        # 同步模式应该等待处理完成
        assert result is True
        
        # 事件应该已经被处理
        assert handler.call_count == 1

    async def test_batch_event_processing(self, event_service):
        """测试批量事件处理"""
        handler = TestEventHandler()
        
        # 订阅批量处理模式
        await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            delivery_mode=EventDeliveryMode.BATCH,
            subscription_id="batch_subscription"
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
            await event_service.emit(event)
        
        # 等待批量处理
        await asyncio.sleep(1.5)  # 等待批量超时
        
        # 验证事件被批量处理
        assert handler.call_count >= 1  # 可能是批量调用

    async def test_event_handler_failure(self, event_service, test_event):
        """测试事件处理器失败"""
        handler = TestEventHandler()
        handler.should_fail = True
        
        # 订阅事件
        await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            subscription_id="failing_subscription"
        )
        
        # 发送事件
        result = await event_service.emit(test_event)
        
        # 即使处理器失败，emit应该成功
        assert result is True
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证处理器被调用但失败
        assert handler.call_count == 1

    async def test_event_metrics_collection(self, event_service, test_event):
        """测试事件指标收集"""
        handler = TestEventHandler()
        
        # 订阅事件
        await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            subscription_id="metrics_subscription"
        )
        
        # 发送多个事件
        for _ in range(5):
            await event_service.emit(test_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 获取事件指标
        metrics = await event_service.get_event_metrics()
        
        assert isinstance(metrics, EventMetrics)
        assert metrics.total_events >= 5
        assert metrics.successful_deliveries >= 5

    async def test_subscription_management(self, event_service):
        """测试订阅管理"""
        handler = TestEventHandler()
        
        # 创建订阅
        subscription = await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            subscription_id="management_test"
        )
        
        # 获取所有订阅
        subscriptions = await event_service.get_subscriptions()
        assert "management_test" in subscriptions
        
        # 获取特定订阅
        retrieved_subscription = await event_service.get_subscription("management_test")
        assert retrieved_subscription is not None
        assert retrieved_subscription.subscription_id == "management_test"
        
        # 更新订阅
        updated_subscription = await event_service.update_subscription(
            "management_test",
            delivery_mode=EventDeliveryMode.SYNC
        )
        assert updated_subscription.delivery_mode == EventDeliveryMode.SYNC

    async def test_wildcard_subscription(self, event_service):
        """测试通配符订阅"""
        handler = TestEventHandler()
        
        # 订阅所有事件类型
        await event_service.subscribe(
            event_type="*",  # 通配符
            handler=handler.handle_event,
            subscription_id="wildcard_subscription"
        )
        
        # 发送不同类型的事件
        events = [
            Event(event_type=EventType.ADAPTER_REGISTERED, source="test", data={}),
            Event(event_type=EventType.ADAPTER_UNREGISTERED, source="test", data={}),
            Event(event_type=EventType.ADAPTER_STARTED, source="test", data={})
        ]
        
        for event in events:
            await event_service.emit(event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证所有事件都被处理
        assert handler.call_count == 3

    async def test_logging_event_handler(self, event_service, test_event):
        """测试日志事件处理器"""
        with patch('logging.getLogger') as mock_logger:
            logger_instance = Mock()
            mock_logger.return_value = logger_instance
            
            # 创建日志处理器
            logging_handler = LoggingEventHandler(logger_name="test_logger")
            
            # 订阅事件
            await event_service.subscribe(
                event_type=EventType.ADAPTER_REGISTERED,
                handler=logging_handler.handle_event,
                subscription_id="logging_subscription"
            )
            
            # 发送事件
            await event_service.emit(test_event)
            
            # 等待处理
            await asyncio.sleep(0.1)
            
            # 验证日志被记录
            logger_instance.info.assert_called()

    async def test_metrics_event_handler(self, event_service, test_event):
        """测试指标事件处理器"""
        # 创建指标收集器mock
        metrics_collector = Mock()
        metrics_collector.increment = Mock()
        metrics_collector.record_timing = Mock()
        
        # 创建指标处理器
        metrics_handler = MetricsEventHandler(metrics_collector=metrics_collector)
        
        # 订阅事件
        await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=metrics_handler.handle_event,
            subscription_id="metrics_handler_subscription"
        )
        
        # 发送事件
        await event_service.emit(test_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证指标被记录
        metrics_collector.increment.assert_called()

    async def test_filter_event_handler(self, event_service):
        """测试过滤事件处理器"""
        base_handler = TestEventHandler()
        
        # 创建过滤处理器
        filter_handler = FilterEventHandler(
            base_handler=base_handler.handle_event,
            filter_func=lambda event: event.data.get("should_process", False)
        )
        
        # 订阅事件
        await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=filter_handler.handle_event,
            subscription_id="filter_handler_subscription"
        )
        
        # 发送应该被过滤的事件
        filtered_event = Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test",
            data={"should_process": False}
        )
        await event_service.emit(filtered_event)
        
        # 发送应该被处理的事件
        processed_event = Event(
            event_type=EventType.ADAPTER_REGISTERED,
            source="test",
            data={"should_process": True}
        )
        await event_service.emit(processed_event)
        
        # 等待处理
        await asyncio.sleep(0.1)
        
        # 验证只有符合条件的事件被处理
        assert base_handler.call_count == 1

    async def test_concurrent_event_processing(self, event_service):
        """测试并发事件处理"""
        handlers = [TestEventHandler() for _ in range(3)]
        
        # 订阅事件
        for i, handler in enumerate(handlers):
            await event_service.subscribe(
                event_type=EventType.ADAPTER_REGISTERED,
                handler=handler.handle_event,
                subscription_id=f"concurrent_subscription_{i}"
            )
        
        # 并发发送事件
        events = []
        for i in range(10):
            event = Event(
                event_type=EventType.ADAPTER_REGISTERED,
                source="test",
                data={"event_id": i}
            )
            events.append(event_service.emit(event))
        
        # 等待所有事件发送完成
        results = await asyncio.gather(*events)
        
        # 验证所有事件都成功发送
        assert all(results)
        
        # 等待处理完成
        await asyncio.sleep(0.2)
        
        # 验证所有处理器都收到所有事件
        for handler in handlers:
            assert handler.call_count == 10

    async def test_health_check(self, event_service):
        """测试健康检查"""
        health_result = await event_service.health_check()
        
        assert isinstance(health_result, HealthCheckResult)
        assert health_result.is_healthy is True
        assert health_result.service_name == "adapter_events"
        assert "subscribers_count" in health_result.details
        assert "queue_size" in health_result.details

    async def test_service_metrics(self, event_service, test_event):
        """测试服务指标"""
        handler = TestEventHandler()
        
        # 订阅和发送事件
        await event_service.subscribe(
            event_type=EventType.ADAPTER_REGISTERED,
            handler=handler.handle_event,
            subscription_id="metrics_test"
        )
        await event_service.emit(test_event)
        
        # 获取服务指标
        metrics = event_service.get_metrics()
        assert metrics.request_count >= 1
        assert metrics.last_activity is not None

    async def test_error_handling(self, event_service):
        """测试错误处理"""
        # 测试无效订阅
        with pytest.raises(Exception):
            await event_service.subscribe(
                event_type=None,
                handler=None,
                subscription_id="invalid"
            )
        
        # 测试发送无效事件
        with pytest.raises(Exception):
            await event_service.emit(None)
        
        # 测试取消不存在的订阅
        result = await event_service.unsubscribe("nonexistent")
        assert result is False
        
        # 测试服务未运行时的操作
        await event_service.stop()
        
        with pytest.raises(RuntimeError):
            test_event = Event(
                event_type=EventType.ADAPTER_REGISTERED,
                source="test",
                data={}
            )
            await event_service.emit(test_event)
