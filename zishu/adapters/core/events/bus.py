"""
事件总线实现

提供事件的发布、订阅和分发功能。
"""

import asyncio
import logging
from typing import Dict, List, Set, Optional, Callable, Any, Union
from datetime import datetime, timezone
from collections import defaultdict
from dataclasses import dataclass, field

from ..types import Event, EventType, Priority

logger = logging.getLogger(__name__)


@dataclass
class EventSubscription:
    """事件订阅信息"""

    subscription_id: str
    event_types: Set[EventType]
    handler: Callable
    priority: Priority = Priority.MEDIUM
    is_async: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def matches(self, event: Event) -> bool:
        """检查是否匹配事件"""
        return event.event_type in self.event_types


class EventBus:
    """
    事件总线

    负责事件的发布、订阅和分发，支持：
    - 异步事件处理
    - 事件过滤
    - 优先级处理
    - 错误处理和重试
    """

    def __init__(self, max_queue_size: int = 1000):
        """初始化事件总线"""
        self._subscriptions: Dict[str, EventSubscription] = {}
        self._event_handlers: Dict[EventType, List[EventSubscription]] = defaultdict(
            list
        )
        self._event_queue: asyncio.Queue = asyncio.Queue(maxsize=max_queue_size)
        self._is_running = False
        self._worker_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

        # 统计信息
        self._stats = {
            "events_published": 0,
            "events_processed": 0,
            "events_failed": 0,
            "subscriptions_count": 0,
        }

        logger.info("EventBus initialized")

    async def start(self) -> None:
        """启动事件总线"""
        if self._is_running:
            return

        async with self._lock:
            if self._is_running:
                return

            self._is_running = True
            self._worker_task = asyncio.create_task(self._event_worker())

            logger.info("EventBus started")

    async def stop(self) -> None:
        """停止事件总线"""
        if not self._is_running:
            return

        async with self._lock:
            if not self._is_running:
                return

            self._is_running = False

            # 停止工作任务
            if self._worker_task:
                self._worker_task.cancel()
                try:
                    await self._worker_task
                except asyncio.CancelledError:
                    pass
                self._worker_task = None

            # 清空队列
            while not self._event_queue.empty():
                try:
                    self._event_queue.get_nowait()
                except asyncio.QueueEmpty:
                    break

            logger.info("EventBus stopped")

    async def emit(self, event: Event) -> None:
        """
        发布事件

        Args:
            event: 要发布的事件
        """
        if not self._is_running:
            raise RuntimeError("EventBus is not running")

        try:
            await self._event_queue.put(event)
            self._stats["events_published"] += 1

            logger.debug(f"Event emitted: {event.event_type.value}")

        except asyncio.QueueFull:
            logger.error("Event queue is full, dropping event")
            raise RuntimeError("Event queue is full")

    def subscribe(
        self,
        event_types: Union[EventType, List[EventType]],
        handler: Callable,
        priority: Priority = Priority.MEDIUM,
        subscription_id: Optional[str] = None,
    ) -> str:
        """
        订阅事件

        Args:
            event_types: 事件类型或类型列表
            handler: 事件处理器
            priority: 优先级
            subscription_id: 订阅ID（可选）

        Returns:
            str: 订阅ID
        """
        if isinstance(event_types, EventType):
            event_types = [event_types]

        event_type_set = set(event_types)

        if subscription_id is None:
            subscription_id = f"sub_{len(self._subscriptions)}"

        # 检查处理器是否为异步
        is_async = asyncio.iscoroutinefunction(handler)

        subscription = EventSubscription(
            subscription_id=subscription_id,
            event_types=event_type_set,
            handler=handler,
            priority=priority,
            is_async=is_async,
        )

        # 添加订阅
        self._subscriptions[subscription_id] = subscription

        # 更新事件处理器映射
        for event_type in event_type_set:
            self._event_handlers[event_type].append(subscription)
            # 按优先级排序
            self._event_handlers[event_type].sort(key=lambda s: s.priority.value)

        self._stats["subscriptions_count"] = len(self._subscriptions)

        logger.info(f"Subscribed to events: {[et.value for et in event_type_set]}")

        return subscription_id

    def unsubscribe(self, subscription_id: str) -> bool:
        """
        取消订阅

        Args:
            subscription_id: 订阅ID

        Returns:
            bool: 是否成功取消订阅
        """
        if subscription_id not in self._subscriptions:
            return False

        subscription = self._subscriptions.pop(subscription_id)

        # 从事件处理器映射中移除
        for event_type in subscription.event_types:
            if event_type in self._event_handlers:
                self._event_handlers[event_type] = [
                    s
                    for s in self._event_handlers[event_type]
                    if s.subscription_id != subscription_id
                ]

        self._stats["subscriptions_count"] = len(self._subscriptions)

        logger.info(f"Unsubscribed: {subscription_id}")

        return True

    def get_subscriptions(
        self, event_type: Optional[EventType] = None
    ) -> List[EventSubscription]:
        """
        获取订阅列表

        Args:
            event_type: 事件类型过滤（可选）

        Returns:
            List[EventSubscription]: 订阅列表
        """
        if event_type is None:
            return list(self._subscriptions.values())
        else:
            return self._event_handlers.get(event_type, [])

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        return {
            **self._stats,
            "queue_size": self._event_queue.qsize(),
            "is_running": self._is_running,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def _event_worker(self) -> None:
        """事件处理工作器"""
        logger.info("Event worker started")

        while self._is_running:
            try:
                # 获取事件（带超时）
                event = await asyncio.wait_for(self._event_queue.get(), timeout=1.0)

                # 处理事件
                await self._process_event(event)

            except asyncio.TimeoutError:
                # 超时是正常的，继续循环
                continue
            except Exception as e:
                logger.error(f"Error in event worker: {e}")
                self._stats["events_failed"] += 1

        logger.info("Event worker stopped")

    async def _process_event(self, event: Event) -> None:
        """处理单个事件"""
        try:
            # 获取匹配的订阅
            handlers = self._event_handlers.get(event.event_type, [])

            if not handlers:
                logger.debug(f"No handlers for event type: {event.event_type.value}")
                return

            # 并发处理所有处理器
            tasks = []
            for subscription in handlers:
                if subscription.matches(event):
                    task = self._invoke_handler(subscription, event)
                    tasks.append(task)

            if tasks:
                # 等待所有处理器完成
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # 检查结果
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        logger.error(
                            f"Handler {handlers[i].subscription_id} failed: {result}"
                        )
                        self._stats["events_failed"] += 1

            self._stats["events_processed"] += 1

        except Exception as e:
            logger.error(f"Error processing event {event.event_id}: {e}")
            self._stats["events_failed"] += 1

    async def _invoke_handler(
        self, subscription: EventSubscription, event: Event
    ) -> None:
        """调用事件处理器"""
        try:
            if subscription.is_async:
                await subscription.handler(event)
            else:
                # 在线程池中运行同步处理器
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, subscription.handler, event)

        except Exception as e:
            logger.error(
                f"Handler {subscription.subscription_id} failed for event "
                f"{event.event_type.value}: {e}"
            )
            raise

    @property
    def is_running(self) -> bool:
        """是否正在运行"""
        return self._is_running

    @property
    def queue_size(self) -> int:
        """队列大小"""
        return self._event_queue.qsize()

    @property
    def subscription_count(self) -> int:
        """订阅数量"""
        return len(self._subscriptions)
