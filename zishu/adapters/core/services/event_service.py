"""
适配器事件服务

基于新架构的事件处理和分发服务。
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Set, Callable, Union, Type
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json
import weakref
from collections import defaultdict, deque

from .base import AsyncService, ServiceStatus, ServiceHealth, HealthCheckResult
from ..types import (
    AdapterRegistration,
    AdapterIdentity,
    AdapterConfiguration,
    AdapterStatus,
    LifecycleState,
    EventType,
    Event,
    Priority,
)
from ..events import EventBus, EventHandler

logger = logging.getLogger(__name__)


class EventDeliveryMode(str, Enum):
    """事件传递模式"""

    ASYNC = "async"  # 异步传递
    SYNC = "sync"  # 同步传递
    FIRE_AND_FORGET = "fire_and_forget"  # 发送后忘记


class EventPersistenceMode(str, Enum):
    """事件持久化模式"""

    NONE = "none"  # 不持久化
    MEMORY = "memory"  # 内存持久化
    DISK = "disk"  # 磁盘持久化


@dataclass
class EventSubscription:
    """事件订阅"""

    subscriber_id: str
    event_types: Set[EventType]
    handler: EventHandler
    delivery_mode: EventDeliveryMode = EventDeliveryMode.ASYNC
    priority: Priority = Priority.NORMAL
    filter_func: Optional[Callable[[Event], bool]] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    active: bool = True


@dataclass
class EventDeliveryResult:
    """事件传递结果"""

    subscription_id: str
    success: bool
    error: Optional[str] = None
    delivery_time: float = 0.0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class EventMetrics:
    """事件指标"""

    total_events: int = 0
    delivered_events: int = 0
    failed_events: int = 0
    error_count: int = 0  # 错误计数
    avg_delivery_time: float = 0.0
    events_by_type: Dict[str, int] = field(default_factory=dict)
    events_by_priority: Dict[str, int] = field(default_factory=dict)
    
    @property
    def successful_deliveries(self) -> int:
        """成功传递的事件数（delivered_events的别名，用于测试兼容性）"""
        return self.delivered_events


class AdapterEventService(AsyncService):
    """
    适配器事件服务

    负责：
    - 事件订阅管理
    - 事件分发和传递
    - 事件持久化
    - 事件指标收集
    - 事件过滤和路由
    """

    def __init__(
        self,
        event_bus: Optional[EventBus] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """初始化事件服务"""
        super().__init__("adapter_event", config)

        self._event_bus = event_bus or EventBus()
        self._subscriptions: Dict[str, EventSubscription] = {}
        self._event_queue: asyncio.Queue = asyncio.Queue()
        self._event_history: deque = deque()
        self._event_lock = asyncio.Lock()

        # 配置参数
        self._max_queue_size = self.config.get("max_queue_size", 10000)
        self._max_history_size = self.config.get("max_history_size", 1000)
        self._delivery_timeout = self.config.get("delivery_timeout", 30.0)
        self._retry_attempts = self.config.get("retry_attempts", 3)
        self._retry_delay = self.config.get("retry_delay", 1.0)
        self._persistence_mode = EventPersistenceMode(
            self.config.get("persistence_mode", EventPersistenceMode.MEMORY.value)
        )

        # 事件处理任务
        self._event_processor_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

        # 指标
        self._metrics = EventMetrics()
        self._delivery_results: deque = deque(maxlen=1000)

        # 事件类型到订阅者的映射
        self._type_subscriptions: Dict[EventType, Set[str]] = defaultdict(set)

        # 内部事件订阅ID
        self._internal_subscription_id: Optional[str] = None

        logger.info(f"AdapterEventService initialized with config: {self.config}")

    async def _initialize_impl(self) -> None:
        """初始化实现"""
        logger.info("Initializing adapter event service...")

        # 重新创建队列（防止之前的队列有残留）
        self._event_queue = asyncio.Queue(maxsize=self._max_queue_size)

        # 清空状态
        self._subscriptions.clear()
        self._event_history.clear()
        self._type_subscriptions.clear()
        self._delivery_results.clear()

        # 重置指标
        self._metrics = EventMetrics()

        logger.info("Adapter event service initialized")

    async def _start_impl(self) -> None:
        """启动实现"""
        logger.info("Starting adapter event service...")

        # 启动事件处理任务
        self._event_processor_task = asyncio.create_task(self._event_processing_loop())

        # 启动清理任务
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        # 订阅自身事件总线
        if self._event_bus:
            # 启动事件总线
            await self._event_bus.start()
            
            # 订阅所有事件类型进行内部处理
            from ..types import EventType
            all_event_types = list(EventType)
            self._internal_subscription_id = self._event_bus.subscribe(
                all_event_types, self._handle_internal_event, subscription_id="internal_handler"
            )

        # 发送服务启动事件
        await self.emit_event(
            Event(
                event_type=EventType.SERVICE_STARTED,
                source="adapter_event_service",
                data={
                    "service": "adapter_event",
                    "timestamp": datetime.now(timezone.utc),
                },
            )
        )

        logger.info("Adapter event service started")

    async def _stop_impl(self) -> None:
        """停止实现"""
        logger.info("Stopping adapter event service...")

        # 发送服务停止事件
        await self.emit_event(
            Event(
                event_type=EventType.SERVICE_STOPPED,
                source="adapter_event_service",
                data={
                    "service": "adapter_event",
                    "timestamp": datetime.now(timezone.utc),
                },
            )
        )

        # 停止事件处理任务
        if self._event_processor_task:
            self._event_processor_task.cancel()
            try:
                await self._event_processor_task
            except asyncio.CancelledError:
                pass

        # 停止清理任务
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        # 取消订阅
        if self._event_bus and self._internal_subscription_id:
            self._event_bus.unsubscribe(self._internal_subscription_id)
            await self._event_bus.stop()

        logger.info("Adapter event service stopped")

    async def _health_check_impl(self) -> HealthCheckResult:
        """健康检查实现"""
        try:
            # 检查基本状态
            if not self.is_running:
                return HealthCheckResult(
                    is_healthy=False,
                    message="Service is not running",
                )

            # 检查队列状态
            queue_size = self._event_queue.qsize()
            if queue_size > self._max_queue_size * 0.9:  # 90%满
                return HealthCheckResult(
                    is_healthy=False,
                    message=f"Event queue nearly full: {queue_size}/{self._max_queue_size}",
                )

            # 检查订阅者数量
            active_subscriptions = sum(
                1 for sub in self._subscriptions.values() if sub.active
            )

            # 检查错误率
            total_events = self._metrics.total_events
            failed_events = self._metrics.failed_events
            error_rate = failed_events / total_events if total_events > 0 else 0.0

            if error_rate > 0.1:  # 10%错误率
                return HealthCheckResult(
                    is_healthy=False,
                    message=f"High error rate: {error_rate:.2%}",
                )

            return HealthCheckResult(
                is_healthy=True,
                message=f"Event service healthy with {active_subscriptions} subscriptions",
                details={
                    "queue_size": queue_size,
                    "active_subscriptions": active_subscriptions,
                    "total_events": total_events,
                    "error_rate": error_rate,
                    "avg_delivery_time": self._metrics.avg_delivery_time,
                },
            )

        except Exception as e:
            return HealthCheckResult(
                is_healthy=False,
                message=f"Health check failed: {str(e)}",
            )

    async def subscribe(
        self,
        subscriber_id: str,
        event_types: Union[EventType, List[EventType]],
        handler: EventHandler,
        delivery_mode: EventDeliveryMode = EventDeliveryMode.ASYNC,
        priority: Priority = Priority.NORMAL,
        filter_func: Optional[Callable[[Event], bool]] = None,
    ) -> str:
        """订阅事件"""
        # 参数验证
        if subscriber_id is None or not subscriber_id.strip():
            raise ValueError("subscriber_id cannot be None or empty")
        if event_types is None:
            raise ValueError("event_types cannot be None")
        if handler is None:
            raise ValueError("handler cannot be None")
            
        if isinstance(event_types, EventType):
            event_types = [event_types]

        event_type_set = set(event_types)
        subscription_id = f"{subscriber_id}_{len(self._subscriptions)}"

        subscription = EventSubscription(
            subscriber_id=subscriber_id,
            event_types=event_type_set,
            handler=handler,
            delivery_mode=delivery_mode,
            priority=priority,
            filter_func=filter_func,
        )

        async with self._event_lock:
            self._subscriptions[subscription_id] = subscription

            # 更新类型映射
            for event_type in event_type_set:
                self._type_subscriptions[event_type].add(subscription_id)

        logger.info(
            f"Added event subscription: {subscription_id} for types {event_type_set}"
        )
        return subscription_id

    async def unsubscribe(self, subscription_id: str) -> bool:
        """取消订阅"""
        async with self._event_lock:
            if subscription_id not in self._subscriptions:
                return False

            subscription = self._subscriptions[subscription_id]

            # 从类型映射中移除
            for event_type in subscription.event_types:
                self._type_subscriptions[event_type].discard(subscription_id)
                if not self._type_subscriptions[event_type]:
                    del self._type_subscriptions[event_type]

            # 移除订阅
            del self._subscriptions[subscription_id]

        logger.info(f"Removed event subscription: {subscription_id}")
        return True

    async def emit_event(self, event: Event) -> None:
        """发送事件"""
        if event is None:
            raise ValueError("Event cannot be None")
            
        try:
            # 更新指标
            self._metrics.total_events += 1
            event_type_str = event.event_type.value
            self._metrics.events_by_type[event_type_str] = (
                self._metrics.events_by_type.get(event_type_str, 0) + 1
            )
            priority_str = event.priority.value
            self._metrics.events_by_priority[priority_str] = (
                self._metrics.events_by_priority.get(priority_str, 0) + 1
            )

            # 记录历史
            if len(self._event_history) >= self._max_history_size:
                self._event_history.popleft()
            self._event_history.append(event)

            # 查找匹配的订阅
            matching_subscriptions = await self._find_matching_subscriptions(event)

            if not matching_subscriptions:
                return

            # 分离同步和异步订阅
            sync_subscriptions = []
            async_subscriptions = []
            
            for subscription in matching_subscriptions:
                if subscription.delivery_mode == EventDeliveryMode.SYNC:
                    sync_subscriptions.append(subscription)
                else:
                    async_subscriptions.append(subscription)

            # 立即处理同步订阅
            if sync_subscriptions:
                # 按优先级排序
                sync_subscriptions.sort(key=lambda sub: sub.priority.value, reverse=True)
                for subscription in sync_subscriptions:
                    await self._deliver_event_sync(event, subscription)

            # 将需要异步处理的事件放入队列
            if async_subscriptions:
                # 创建一个包含事件和异步订阅的包装器
                event_wrapper = {
                    'event': event,
                    'async_subscriptions': async_subscriptions
                }
                
                if self._event_queue.full():
                    logger.warning("Event queue is full, dropping oldest event")
                    try:
                        self._event_queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass

                await self._event_queue.put(event_wrapper)

        except Exception as e:
            logger.error(f"Failed to emit event: {e}")
            self._metrics.failed_events += 1
            self._metrics.error_count += 1
            raise

    async def get_subscriptions(
        self, subscriber_id: Optional[str] = None
    ) -> List[EventSubscription]:
        """获取订阅列表"""
        if subscriber_id:
            return [
                sub
                for sub in self._subscriptions.values()
                if sub.subscriber_id == subscriber_id
            ]
        else:
            return list(self._subscriptions.values())

    async def get_event_history(
        self, event_type: Optional[EventType] = None, limit: int = 100
    ) -> List[Event]:
        """获取事件历史"""
        history = list(self._event_history)

        if event_type:
            history = [event for event in history if event.event_type == event_type]

        return history[-limit:] if limit > 0 else history

    async def get_event_metrics(self) -> EventMetrics:
        """获取事件指标"""
        return self._metrics

    def get_metrics(self):
        """获取服务指标（为测试兼容性）"""
        class MetricsCompat:
            def __init__(self, metrics: EventMetrics):
                self.request_count = metrics.total_events
                self.last_activity = datetime.now(timezone.utc) if metrics.total_events > 0 else None
        
        return MetricsCompat(self._metrics)

    async def clear_event_history(self) -> None:
        """清空事件历史"""
        self._event_history.clear()
        logger.info("Event history cleared")

    # 内部方法

    async def _event_processing_loop(self) -> None:
        """事件处理循环"""
        logger.info("Starting event processing loop")

        while self.is_running:
            try:
                # 获取事件（带超时）
                try:
                    item = await asyncio.wait_for(self._event_queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue

                # 判断是事件包装器还是普通事件
                if isinstance(item, dict) and 'event' in item and 'async_subscriptions' in item:
                    # 处理异步订阅的事件包装器
                    await self._process_async_event(item['event'], item['async_subscriptions'])
                else:
                    # 处理普通事件（向后兼容）
                    await self._process_event(item)

                # 标记任务完成
                self._event_queue.task_done()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Event processing loop error: {e}")
                await asyncio.sleep(1.0)

        logger.info("Event processing loop stopped")

    async def _process_async_event(self, event: Event, async_subscriptions: List[EventSubscription]) -> None:
        """处理异步订阅的事件"""
        if not async_subscriptions:
            return

        # 按优先级排序
        async_subscriptions.sort(key=lambda sub: sub.priority.value, reverse=True)

        # 分发事件
        delivery_tasks = []
        for subscription in async_subscriptions:
            task = asyncio.create_task(
                self._deliver_event_async(event, subscription)
            )
            delivery_tasks.append(task)

        # 等待异步传递完成
        if delivery_tasks:
            results = await asyncio.gather(*delivery_tasks, return_exceptions=True)
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Event delivery failed: {result}")

    async def _process_event(self, event: Event) -> None:
        """处理单个事件"""
        # 查找匹配的订阅
        matching_subscriptions = await self._find_matching_subscriptions(event)

        if not matching_subscriptions:
            return

        # 按优先级排序
        matching_subscriptions.sort(key=lambda sub: sub.priority.value, reverse=True)

        # 分发事件
        delivery_tasks = []
        for subscription in matching_subscriptions:
            if subscription.delivery_mode == EventDeliveryMode.SYNC:
                # 同步传递
                await self._deliver_event_sync(event, subscription)
            else:
                # 异步传递
                task = asyncio.create_task(
                    self._deliver_event_async(event, subscription)
                )
                delivery_tasks.append(task)

        # 等待异步传递完成
        if delivery_tasks:
            results = await asyncio.gather(*delivery_tasks, return_exceptions=True)
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Event delivery failed: {result}")

    async def _find_matching_subscriptions(
        self, event: Event
    ) -> List[EventSubscription]:
        """查找匹配的订阅"""
        matching_subscriptions = []

        # 查找订阅了此事件类型的订阅者
        subscription_ids = self._type_subscriptions.get(event.event_type, set())

        for subscription_id in subscription_ids:
            subscription = self._subscriptions.get(subscription_id)
            if not subscription or not subscription.active:
                continue

            # 应用过滤器
            if subscription.filter_func:
                try:
                    if not subscription.filter_func(event):
                        continue
                except Exception as e:
                    logger.error(
                        f"Event filter failed for subscription {subscription_id}: {e}"
                    )
                    continue

            matching_subscriptions.append(subscription)

        return matching_subscriptions

    async def _deliver_event_sync(
        self, event: Event, subscription: EventSubscription
    ) -> EventDeliveryResult:
        """同步传递事件"""
        start_time = asyncio.get_event_loop().time()

        try:
            # 检查handler是否有handle_event方法，如果没有则直接调用
            if hasattr(subscription.handler, 'handle_event'):
                await asyncio.wait_for(
                    subscription.handler.handle_event(event), timeout=self._delivery_timeout
                )
            else:
                # 直接调用handler函数
                await asyncio.wait_for(
                    subscription.handler(event), timeout=self._delivery_timeout
                )

            delivery_time = asyncio.get_event_loop().time() - start_time
            result = EventDeliveryResult(
                subscription_id=subscription.subscriber_id,
                success=True,
                delivery_time=delivery_time,
            )

            self._metrics.delivered_events += 1
            self._update_avg_delivery_time(delivery_time)

        except asyncio.TimeoutError:
            delivery_time = asyncio.get_event_loop().time() - start_time
            result = EventDeliveryResult(
                subscription_id=subscription.subscriber_id,
                success=False,
                error="Delivery timeout",
                delivery_time=delivery_time,
            )
            self._metrics.failed_events += 1
            self._metrics.error_count += 1

        except Exception as e:
            delivery_time = asyncio.get_event_loop().time() - start_time
            result = EventDeliveryResult(
                subscription_id=subscription.subscriber_id,
                success=False,
                error=str(e),
                delivery_time=delivery_time,
            )
            self._metrics.failed_events += 1
            self._metrics.error_count += 1
            logger.error(
                f"Sync event delivery failed for {subscription.subscriber_id}: {e}"
            )

        self._delivery_results.append(result)
        return result

    async def _deliver_event_async(
        self, event: Event, subscription: EventSubscription
    ) -> EventDeliveryResult:
        """异步传递事件"""
        start_time = asyncio.get_event_loop().time()

        for attempt in range(self._retry_attempts):
            try:
                if subscription.delivery_mode == EventDeliveryMode.FIRE_AND_FORGET:
                    # 发送后忘记，不等待结果
                    if hasattr(subscription.handler, 'handle_event'):
                        asyncio.create_task(subscription.handler.handle_event(event))
                    else:
                        asyncio.create_task(subscription.handler(event))
                    delivery_time = asyncio.get_event_loop().time() - start_time
                    result = EventDeliveryResult(
                        subscription_id=subscription.subscriber_id,
                        success=True,
                        delivery_time=delivery_time,
                    )
                    self._metrics.delivered_events += 1
                    break
                else:
                    # 正常异步传递
                    if hasattr(subscription.handler, 'handle_event'):
                        await asyncio.wait_for(
                            subscription.handler.handle_event(event),
                            timeout=self._delivery_timeout,
                        )
                    else:
                        await asyncio.wait_for(
                            subscription.handler(event),
                            timeout=self._delivery_timeout,
                        )

                    delivery_time = asyncio.get_event_loop().time() - start_time
                    result = EventDeliveryResult(
                        subscription_id=subscription.subscriber_id,
                        success=True,
                        delivery_time=delivery_time,
                    )

                    self._metrics.delivered_events += 1
                    self._update_avg_delivery_time(delivery_time)
                    break

            except asyncio.TimeoutError:
                if attempt == self._retry_attempts - 1:
                    delivery_time = asyncio.get_event_loop().time() - start_time
                    result = EventDeliveryResult(
                        subscription_id=subscription.subscriber_id,
                        success=False,
                        error="Delivery timeout after retries",
                        delivery_time=delivery_time,
                    )
                    self._metrics.failed_events += 1
                    self._metrics.error_count += 1
                else:
                    await asyncio.sleep(self._retry_delay * (attempt + 1))

            except Exception as e:
                if attempt == self._retry_attempts - 1:
                    delivery_time = asyncio.get_event_loop().time() - start_time
                    result = EventDeliveryResult(
                        subscription_id=subscription.subscriber_id,
                        success=False,
                        error=str(e),
                        delivery_time=delivery_time,
                    )
                    self._metrics.failed_events += 1
                    self._metrics.error_count += 1
                    logger.error(
                        f"Async event delivery failed for {subscription.subscriber_id}: {e}"
                    )
                else:
                    await asyncio.sleep(self._retry_delay * (attempt + 1))

        self._delivery_results.append(result)
        return result

    def _update_avg_delivery_time(self, delivery_time: float) -> None:
        """更新平均传递时间"""
        if self._metrics.delivered_events == 1:
            self._metrics.avg_delivery_time = delivery_time
        else:
            # 使用指数移动平均
            alpha = 0.1
            self._metrics.avg_delivery_time = (
                alpha * delivery_time + (1 - alpha) * self._metrics.avg_delivery_time
            )

    async def _handle_internal_event(self, event: Event) -> None:
        """处理内部事件"""
        # 将内部事件转发到我们的队列
        await self.emit_event(event)

    async def _cleanup_loop(self) -> None:
        """清理循环"""
        logger.info("Starting event service cleanup loop")

        while self.is_running:
            try:
                await self._cleanup_inactive_subscriptions()
                await self._cleanup_old_delivery_results()
                await asyncio.sleep(300)  # 每5分钟清理一次
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Event cleanup loop error: {e}")
                await asyncio.sleep(60)

        logger.info("Event service cleanup loop stopped")

    async def _cleanup_inactive_subscriptions(self) -> None:
        """清理不活跃的订阅"""
        async with self._event_lock:
            inactive_subscriptions = []

            for subscription_id, subscription in self._subscriptions.items():
                # 检查订阅是否过期（例如，超过24小时未活动）
                age = datetime.now(timezone.utc) - subscription.created_at
                if age > timedelta(hours=24) and not subscription.active:
                    inactive_subscriptions.append(subscription_id)

            for subscription_id in inactive_subscriptions:
                await self.unsubscribe(subscription_id)
                logger.info(f"Cleaned up inactive subscription: {subscription_id}")

    async def _cleanup_old_delivery_results(self) -> None:
        """清理旧的传递结果"""
        # deque 已经有 maxlen 限制，这里可以做额外的清理
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=1)

        # 移除超过1小时的结果
        while (
            self._delivery_results and self._delivery_results[0].timestamp < cutoff_time
        ):
            self._delivery_results.popleft()


# 事件处理器实现示例


class LoggingEventHandler(EventHandler):
    """日志事件处理器"""

    def __init__(self, logger_name: str = "event_handler"):
        self.logger = logging.getLogger(logger_name)

    async def handle_event(self, event: Event) -> None:
        """处理事件"""
        self.logger.info(
            f"Received event: {event.event_type.value} from {event.source}"
        )
        if event.data:
            self.logger.debug(
                f"Event data: {json.dumps(event.data, default=str, indent=2)}"
            )


class MetricsEventHandler(EventHandler):
    """指标事件处理器"""

    def __init__(self):
        self.event_counts: Dict[str, int] = defaultdict(int)
        self.last_reset = datetime.now(timezone.utc)

    async def handle_event(self, event: Event) -> None:
        """处理事件"""
        self.event_counts[event.event_type.value] += 1

        # 每小时重置一次计数
        if datetime.now(timezone.utc) - self.last_reset > timedelta(hours=1):
            self.event_counts.clear()
            self.last_reset = datetime.now(timezone.utc)

    def get_metrics(self) -> Dict[str, int]:
        """获取指标"""
        return dict(self.event_counts)


class FilterEventHandler(EventHandler):
    """过滤事件处理器"""

    def __init__(
        self, filter_func: Callable[[Event], bool], target_handler: EventHandler
    ):
        self.filter_func = filter_func
        self.target_handler = target_handler

    async def handle_event(self, event: Event) -> None:
        """处理事件"""
        if self.filter_func(event):
            await self.target_handler.handle_event(event)
