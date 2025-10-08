"""
消息队列适配器示例

演示如何实现消息队列适配器。
"""

import asyncio
import json
import logging
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime, timezone
from collections import deque

from ..core.base import BaseAdapter
from ..core.types import AdapterType, Event, EventType, Priority

logger = logging.getLogger(__name__)


class MessageQueueAdapter(BaseAdapter):
    """
    消息队列适配器

    提供消息队列功能，支持：
    - 消息发布和订阅
    - 队列管理
    - 消息持久化（模拟）
    - 消费者组管理

    注意：这是一个示例实现，实际使用时需要集成具体的消息队列系统
    """

    def __init__(self, config: Dict[str, Any]):
        """初始化消息队列适配器"""
        super().__init__(config)

        # 队列配置
        self.broker_url = config.get("broker_url", "memory://localhost")
        self.max_queue_size = config.get("max_queue_size", 1000)
        self.message_ttl = config.get("message_ttl", 3600)  # 消息TTL（秒）
        self.enable_persistence = config.get("enable_persistence", False)

        # 内存队列（模拟）
        self._queues: Dict[str, deque] = {}
        self._subscribers: Dict[str, List[Callable]] = {}
        self._consumer_groups: Dict[str, Dict[str, Any]] = {}

        # 连接状态
        self._connection: Optional[Any] = None
        self._is_connected = False

        # 统计信息
        self._messages_sent = 0
        self._messages_received = 0
        self._messages_failed = 0

        # 后台任务
        self._message_processor_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

    async def initialize(self) -> None:
        """初始化适配器"""
        await super().initialize()

        # 建立连接（模拟）
        await self._connect()

        logger.info(f"MessageQueueAdapter initialized with broker: {self.broker_url}")

    async def start(self) -> None:
        """启动适配器"""
        await super().start()

        # 启动后台任务
        self._message_processor_task = asyncio.create_task(self._message_processor())
        self._cleanup_task = asyncio.create_task(self._cleanup_expired_messages())

        # 发送启动事件
        await self.emit_event(
            Event(
                event_type=EventType.ADAPTER_STARTED,
                source=self.get_name(),
                data={
                    "broker_url": self.broker_url,
                    "max_queue_size": self.max_queue_size,
                    "enable_persistence": self.enable_persistence,
                },
                priority=Priority.MEDIUM,
            )
        )

        logger.info("MessageQueueAdapter started")

    async def stop(self) -> None:
        """停止适配器"""
        await super().stop()

        # 停止后台任务
        if self._message_processor_task:
            self._message_processor_task.cancel()
            try:
                await self._message_processor_task
            except asyncio.CancelledError:
                pass

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        # 断开连接
        await self._disconnect()

        logger.info("MessageQueueAdapter stopped")

    async def health_check(self) -> bool:
        """健康检查"""
        return self._is_connected and self._connection is not None

    async def publish_message(
        self,
        queue_name: str,
        message: Dict[str, Any],
        priority: int = 0,
        ttl: Optional[int] = None,
    ) -> bool:
        """
        发布消息

        Args:
            queue_name: 队列名称
            message: 消息内容
            priority: 消息优先级
            ttl: 消息生存时间（秒）

        Returns:
            bool: 是否成功发布
        """
        if not self._is_connected:
            raise RuntimeError("MessageQueueAdapter is not connected")

        try:
            # 创建队列（如果不存在）
            if queue_name not in self._queues:
                self._queues[queue_name] = deque()

            # 检查队列大小
            if len(self._queues[queue_name]) >= self.max_queue_size:
                raise RuntimeError(f"Queue {queue_name} is full")

            # 包装消息
            wrapped_message = {
                "id": f"msg_{self._messages_sent}_{datetime.now(timezone.utc).timestamp()}",
                "queue": queue_name,
                "content": message,
                "priority": priority,
                "timestamp": datetime.now(timezone.utc),
                "ttl": ttl or self.message_ttl,
                "attempts": 0,
            }

            # 添加到队列
            self._queues[queue_name].append(wrapped_message)
            self._messages_sent += 1

            # 发送消息发布事件
            await self.emit_event(
                Event(
                    event_type=EventType.OPERATION_COMPLETED,
                    source=self.get_name(),
                    data={
                        "operation": "publish",
                        "queue": queue_name,
                        "message_id": wrapped_message["id"],
                        "priority": priority,
                    },
                    priority=Priority.LOW,
                )
            )

            logger.debug(
                f"Message published to queue {queue_name}: {wrapped_message['id']}"
            )
            return True

        except Exception as e:
            self._messages_failed += 1

            # 发送错误事件
            await self.emit_event(
                Event(
                    event_type=EventType.OPERATION_FAILED,
                    source=self.get_name(),
                    data={"operation": "publish", "queue": queue_name, "error": str(e)},
                    priority=Priority.HIGH,
                )
            )

            logger.error(f"Failed to publish message to queue {queue_name}: {e}")
            raise

    async def subscribe_queue(
        self,
        queue_name: str,
        handler: Callable[[Dict[str, Any]], None],
        consumer_group: Optional[str] = None,
    ) -> str:
        """
        订阅队列

        Args:
            queue_name: 队列名称
            handler: 消息处理器
            consumer_group: 消费者组名称

        Returns:
            str: 订阅ID
        """
        if not self._is_connected:
            raise RuntimeError("MessageQueueAdapter is not connected")

        # 创建订阅
        if queue_name not in self._subscribers:
            self._subscribers[queue_name] = []

        subscription_id = f"sub_{len(self._subscribers[queue_name])}_{queue_name}"

        # 包装处理器
        wrapped_handler = {
            "id": subscription_id,
            "handler": handler,
            "consumer_group": consumer_group,
            "created_at": datetime.now(timezone.utc),
        }

        self._subscribers[queue_name].append(wrapped_handler)

        # 管理消费者组
        if consumer_group:
            if consumer_group not in self._consumer_groups:
                self._consumer_groups[consumer_group] = {
                    "members": [],
                    "created_at": datetime.now(timezone.utc),
                }
            self._consumer_groups[consumer_group]["members"].append(subscription_id)

        logger.info(f"Subscribed to queue {queue_name}: {subscription_id}")
        return subscription_id

    async def unsubscribe_queue(self, subscription_id: str) -> bool:
        """
        取消订阅

        Args:
            subscription_id: 订阅ID

        Returns:
            bool: 是否成功取消订阅
        """
        for queue_name, subscribers in self._subscribers.items():
            for i, subscriber in enumerate(subscribers):
                if subscriber["id"] == subscription_id:
                    # 移除订阅
                    removed_subscriber = subscribers.pop(i)

                    # 从消费者组中移除
                    consumer_group = removed_subscriber.get("consumer_group")
                    if consumer_group and consumer_group in self._consumer_groups:
                        try:
                            self._consumer_groups[consumer_group]["members"].remove(
                                subscription_id
                            )
                        except ValueError:
                            pass

                    logger.info(
                        f"Unsubscribed from queue {queue_name}: {subscription_id}"
                    )
                    return True

        return False

    async def get_queue_info(self, queue_name: str) -> Dict[str, Any]:
        """
        获取队列信息

        Args:
            queue_name: 队列名称

        Returns:
            Dict[str, Any]: 队列信息
        """
        if queue_name not in self._queues:
            return {"exists": False}

        queue = self._queues[queue_name]
        subscribers = self._subscribers.get(queue_name, [])

        return {
            "exists": True,
            "name": queue_name,
            "size": len(queue),
            "max_size": self.max_queue_size,
            "subscribers": len(subscribers),
            "subscriber_ids": [s["id"] for s in subscribers],
        }

    async def list_queues(self) -> List[str]:
        """
        列出所有队列

        Returns:
            List[str]: 队列名称列表
        """
        return list(self._queues.keys())

    async def purge_queue(self, queue_name: str) -> int:
        """
        清空队列

        Args:
            queue_name: 队列名称

        Returns:
            int: 清除的消息数量
        """
        if queue_name not in self._queues:
            return 0

        count = len(self._queues[queue_name])
        self._queues[queue_name].clear()

        logger.info(f"Purged queue {queue_name}: {count} messages removed")
        return count

    async def _connect(self) -> None:
        """建立连接（模拟）"""
        # 这里应该是实际的消息队列连接逻辑
        # 例如连接到 RabbitMQ, Apache Kafka, Redis 等

        await asyncio.sleep(0.1)  # 模拟连接延迟
        self._connection = f"connection_{self.broker_url}"
        self._is_connected = True

        logger.info(f"Connected to message broker: {self.broker_url}")

    async def _disconnect(self) -> None:
        """断开连接（模拟）"""
        if self._connection:
            await asyncio.sleep(0.05)  # 模拟断开延迟
            self._connection = None
            self._is_connected = False

            logger.info("Disconnected from message broker")

    async def _message_processor(self) -> None:
        """消息处理器（后台任务）"""
        logger.info("Message processor started")

        while True:
            try:
                # 处理所有队列的消息
                for queue_name, queue in self._queues.items():
                    if queue and queue_name in self._subscribers:
                        await self._process_queue_messages(queue_name, queue)

                # 短暂休眠
                await asyncio.sleep(0.1)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Message processor error: {e}")
                await asyncio.sleep(1)

        logger.info("Message processor stopped")

    async def _process_queue_messages(self, queue_name: str, queue: deque) -> None:
        """处理队列消息"""
        subscribers = self._subscribers.get(queue_name, [])
        if not subscribers:
            return

        # 处理队列中的消息
        while queue:
            message = queue.popleft()

            # 检查消息是否过期
            if self._is_message_expired(message):
                continue

            # 分发消息给订阅者
            for subscriber in subscribers:
                try:
                    handler = subscriber["handler"]

                    # 调用处理器
                    if asyncio.iscoroutinefunction(handler):
                        await handler(message["content"])
                    else:
                        handler(message["content"])

                    self._messages_received += 1

                    # 发送消息处理完成事件
                    await self.emit_event(
                        Event(
                            event_type=EventType.OPERATION_COMPLETED,
                            source=self.get_name(),
                            data={
                                "operation": "consume",
                                "queue": queue_name,
                                "message_id": message["id"],
                                "subscriber_id": subscriber["id"],
                            },
                            priority=Priority.LOW,
                        )
                    )

                except Exception as e:
                    self._messages_failed += 1
                    logger.error(f"Message handler error: {e}")

                    # 可以在这里实现重试逻辑
                    message["attempts"] += 1
                    if message["attempts"] < 3:
                        queue.append(message)  # 重新入队

    async def _cleanup_expired_messages(self) -> None:
        """清理过期消息（后台任务）"""
        logger.info("Message cleanup task started")

        while True:
            try:
                # 清理所有队列的过期消息
                for queue_name, queue in self._queues.items():
                    expired_count = 0

                    # 从队列前端开始检查过期消息
                    while queue and self._is_message_expired(queue[0]):
                        queue.popleft()
                        expired_count += 1

                    if expired_count > 0:
                        logger.debug(
                            f"Cleaned {expired_count} expired messages from queue {queue_name}"
                        )

                # 每分钟清理一次
                await asyncio.sleep(60)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Message cleanup error: {e}")
                await asyncio.sleep(60)

        logger.info("Message cleanup task stopped")

    def _is_message_expired(self, message: Dict[str, Any]) -> bool:
        """检查消息是否过期"""
        message_age = (
            datetime.now(timezone.utc) - message["timestamp"]
        ).total_seconds()
        return message_age > message["ttl"]

    def get_adapter_type(self) -> AdapterType:
        """获取适配器类型"""
        return AdapterType.MESSAGE_QUEUE

    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        base_stats = super().get_statistics()

        total_queue_size = sum(len(queue) for queue in self._queues.values())
        total_subscribers = sum(len(subs) for subs in self._subscribers.values())

        return {
            **base_stats,
            "messages_sent": self._messages_sent,
            "messages_received": self._messages_received,
            "messages_failed": self._messages_failed,
            "success_rate": self._calculate_success_rate(),
            "queue_count": len(self._queues),
            "total_queue_size": total_queue_size,
            "total_subscribers": total_subscribers,
            "consumer_groups": len(self._consumer_groups),
            "is_connected": self._is_connected,
            "broker_url": self.broker_url,
        }

    def _calculate_success_rate(self) -> float:
        """计算成功率"""
        total_messages = self._messages_sent + self._messages_received
        if total_messages == 0:
            return 0.0
        return (total_messages - self._messages_failed) / total_messages
