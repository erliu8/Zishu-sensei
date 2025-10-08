"""
事件处理器基类和实现

提供事件处理的基础接口和常用实现。
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Callable
from datetime import datetime, timezone

from ..types import Event, EventType, Priority

logger = logging.getLogger(__name__)


class EventHandler(ABC):
    """
    事件处理器基类

    定义事件处理器的基本接口。
    """

    def __init__(self, name: Optional[str] = None):
        """初始化事件处理器"""
        self.name = name or self.__class__.__name__
        self.created_at = datetime.now(timezone.utc)
        self.handled_count = 0
        self.error_count = 0

    @abstractmethod
    def handle(self, event: Event) -> None:
        """
        处理事件（同步）

        Args:
            event: 要处理的事件
        """
        pass

    def can_handle(self, event: Event) -> bool:
        """
        检查是否可以处理事件

        Args:
            event: 事件

        Returns:
            bool: 是否可以处理
        """
        return True

    def get_statistics(self) -> Dict[str, Any]:
        """获取处理器统计信息"""
        return {
            "name": self.name,
            "handled_count": self.handled_count,
            "error_count": self.error_count,
            "success_rate": self._calculate_success_rate(),
            "created_at": self.created_at.isoformat(),
        }

    def _calculate_success_rate(self) -> float:
        """计算成功率"""
        if self.handled_count == 0:
            return 0.0
        return (self.handled_count - self.error_count) / self.handled_count


class AsyncEventHandler(ABC):
    """
    异步事件处理器基类

    定义异步事件处理器的基本接口。
    """

    def __init__(self, name: Optional[str] = None):
        """初始化异步事件处理器"""
        self.name = name or self.__class__.__name__
        self.created_at = datetime.now(timezone.utc)
        self.handled_count = 0
        self.error_count = 0

    @abstractmethod
    async def handle(self, event: Event) -> None:
        """
        处理事件（异步）

        Args:
            event: 要处理的事件
        """
        pass

    async def can_handle(self, event: Event) -> bool:
        """
        检查是否可以处理事件

        Args:
            event: 事件

        Returns:
            bool: 是否可以处理
        """
        return True

    def get_statistics(self) -> Dict[str, Any]:
        """获取处理器统计信息"""
        return {
            "name": self.name,
            "handled_count": self.handled_count,
            "error_count": self.error_count,
            "success_rate": self._calculate_success_rate(),
            "created_at": self.created_at.isoformat(),
        }

    def _calculate_success_rate(self) -> float:
        """计算成功率"""
        if self.handled_count == 0:
            return 0.0
        return (self.handled_count - self.error_count) / self.handled_count


class LoggingEventHandler(AsyncEventHandler):
    """
    日志事件处理器

    将事件记录到日志中。
    """

    def __init__(
        self, logger_name: str = "event_handler", log_level: int = logging.INFO
    ):
        """初始化日志处理器"""
        super().__init__("LoggingEventHandler")
        self.logger = logging.getLogger(logger_name)
        self.log_level = log_level

    async def handle(self, event: Event) -> None:
        """处理事件"""
        try:
            message = (
                f"Event: {event.event_type.value} | "
                f"Source: {event.source} | "
                f"Priority: {event.priority.value} | "
                f"Data: {event.data}"
            )

            self.logger.log(self.log_level, message)
            self.handled_count += 1

        except Exception as e:
            self.error_count += 1
            logger.error(f"LoggingEventHandler error: {e}")


class MetricsEventHandler(AsyncEventHandler):
    """
    指标事件处理器

    收集和记录事件指标。
    """

    def __init__(self):
        """初始化指标处理器"""
        super().__init__("MetricsEventHandler")
        self.event_counts: Dict[str, int] = {}
        self.source_counts: Dict[str, int] = {}
        self.priority_counts: Dict[str, int] = {}

    async def handle(self, event: Event) -> None:
        """处理事件"""
        try:
            # 统计事件类型
            event_type = event.event_type.value
            self.event_counts[event_type] = self.event_counts.get(event_type, 0) + 1

            # 统计事件源
            source = event.source
            self.source_counts[source] = self.source_counts.get(source, 0) + 1

            # 统计优先级
            priority = event.priority.value
            self.priority_counts[str(priority)] = (
                self.priority_counts.get(str(priority), 0) + 1
            )

            self.handled_count += 1

        except Exception as e:
            self.error_count += 1
            logger.error(f"MetricsEventHandler error: {e}")

    def get_metrics(self) -> Dict[str, Any]:
        """获取指标数据"""
        return {
            "event_counts": self.event_counts.copy(),
            "source_counts": self.source_counts.copy(),
            "priority_counts": self.priority_counts.copy(),
            "total_handled": self.handled_count,
            "total_errors": self.error_count,
        }


class FilteredEventHandler(AsyncEventHandler):
    """
    过滤事件处理器

    根据条件过滤事件后再处理。
    """

    def __init__(
        self,
        delegate_handler: AsyncEventHandler,
        event_types: Optional[List[EventType]] = None,
        sources: Optional[List[str]] = None,
        priorities: Optional[List[Priority]] = None,
        custom_filter: Optional[Callable[[Event], bool]] = None,
    ):
        """初始化过滤处理器"""
        super().__init__("FilteredEventHandler")
        self.delegate_handler = delegate_handler
        self.event_types = set(event_types) if event_types else None
        self.sources = set(sources) if sources else None
        self.priorities = set(priorities) if priorities else None
        self.custom_filter = custom_filter

    async def can_handle(self, event: Event) -> bool:
        """检查是否可以处理事件"""
        # 检查事件类型
        if self.event_types and event.event_type not in self.event_types:
            return False

        # 检查事件源
        if self.sources and event.source not in self.sources:
            return False

        # 检查优先级
        if self.priorities and event.priority not in self.priorities:
            return False

        # 检查自定义过滤器
        if self.custom_filter and not self.custom_filter(event):
            return False

        return True

    async def handle(self, event: Event) -> None:
        """处理事件"""
        try:
            if await self.can_handle(event):
                await self.delegate_handler.handle(event)
                self.handled_count += 1

        except Exception as e:
            self.error_count += 1
            logger.error(f"FilteredEventHandler error: {e}")


class BatchEventHandler(AsyncEventHandler):
    """
    批处理事件处理器

    将事件批量处理以提高效率。
    """

    def __init__(
        self,
        batch_size: int = 10,
        batch_timeout: float = 5.0,
        processor: Optional[Callable[[List[Event]], None]] = None,
    ):
        """初始化批处理器"""
        super().__init__("BatchEventHandler")
        self.batch_size = batch_size
        self.batch_timeout = batch_timeout
        self.processor = processor or self._default_processor

        self.event_batch: List[Event] = []
        self.last_batch_time = datetime.now(timezone.utc)
        self._lock = asyncio.Lock()

    async def handle(self, event: Event) -> None:
        """处理事件"""
        try:
            async with self._lock:
                self.event_batch.append(event)

                # 检查是否需要处理批次
                should_process = (
                    len(self.event_batch) >= self.batch_size
                    or (
                        datetime.now(timezone.utc) - self.last_batch_time
                    ).total_seconds()
                    >= self.batch_timeout
                )

                if should_process and self.event_batch:
                    await self._process_batch()

        except Exception as e:
            self.error_count += 1
            logger.error(f"BatchEventHandler error: {e}")

    async def _process_batch(self) -> None:
        """处理批次"""
        if not self.event_batch:
            return

        batch = self.event_batch.copy()
        self.event_batch.clear()
        self.last_batch_time = datetime.now(timezone.utc)

        try:
            if asyncio.iscoroutinefunction(self.processor):
                await self.processor(batch)
            else:
                # 在线程池中运行同步处理器
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self.processor, batch)

            self.handled_count += len(batch)

        except Exception as e:
            self.error_count += len(batch)
            logger.error(f"Batch processing error: {e}")

    def _default_processor(self, events: List[Event]) -> None:
        """默认批处理器"""
        logger.info(f"Processing batch of {len(events)} events")
        for event in events:
            logger.debug(f"Event: {event.event_type.value} from {event.source}")


class RetryEventHandler(AsyncEventHandler):
    """
    重试事件处理器

    在处理失败时进行重试。
    """

    def __init__(
        self,
        delegate_handler: AsyncEventHandler,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        backoff_factor: float = 2.0,
    ):
        """初始化重试处理器"""
        super().__init__("RetryEventHandler")
        self.delegate_handler = delegate_handler
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.backoff_factor = backoff_factor

    async def handle(self, event: Event) -> None:
        """处理事件"""
        last_exception = None

        for attempt in range(self.max_retries + 1):
            try:
                await self.delegate_handler.handle(event)
                self.handled_count += 1
                return

            except Exception as e:
                last_exception = e

                if attempt < self.max_retries:
                    delay = self.retry_delay * (self.backoff_factor**attempt)
                    logger.warning(
                        f"Retry attempt {attempt + 1} for event {event.event_id} "
                        f"after {delay}s delay: {e}"
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"All retry attempts failed for event {event.event_id}: {e}"
                    )

        self.error_count += 1
        if last_exception:
            raise last_exception
