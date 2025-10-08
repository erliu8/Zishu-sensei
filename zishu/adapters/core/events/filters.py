"""
事件过滤器实现

提供事件过滤和筛选功能。
"""

import re
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Set, Optional, Callable, Union
from datetime import datetime, timezone

from ..types import Event, EventType, Priority

logger = logging.getLogger(__name__)


class EventFilter(ABC):
    """
    事件过滤器基类

    定义事件过滤的基本接口。
    """

    def __init__(self, name: Optional[str] = None):
        """初始化过滤器"""
        self.name = name or self.__class__.__name__
        self.created_at = datetime.now(timezone.utc)
        self.filter_count = 0
        self.pass_count = 0

    @abstractmethod
    def matches(self, event: Event) -> bool:
        """
        检查事件是否匹配过滤条件

        Args:
            event: 要检查的事件

        Returns:
            bool: 是否匹配
        """
        pass

    def filter(self, event: Event) -> bool:
        """
        过滤事件

        Args:
            event: 要过滤的事件

        Returns:
            bool: 是否通过过滤
        """
        self.filter_count += 1

        try:
            result = self.matches(event)
            if result:
                self.pass_count += 1
            return result

        except Exception as e:
            logger.error(f"Filter {self.name} error: {e}")
            return False

    def get_statistics(self) -> Dict[str, Any]:
        """获取过滤器统计信息"""
        return {
            "name": self.name,
            "filter_count": self.filter_count,
            "pass_count": self.pass_count,
            "pass_rate": self._calculate_pass_rate(),
            "created_at": self.created_at.isoformat(),
        }

    def _calculate_pass_rate(self) -> float:
        """计算通过率"""
        if self.filter_count == 0:
            return 0.0
        return self.pass_count / self.filter_count


class EventTypeFilter(EventFilter):
    """
    事件类型过滤器

    根据事件类型进行过滤。
    """

    def __init__(
        self, event_types: Union[EventType, List[EventType]], include: bool = True
    ):
        """
        初始化事件类型过滤器

        Args:
            event_types: 事件类型或类型列表
            include: True表示包含这些类型，False表示排除这些类型
        """
        super().__init__("EventTypeFilter")

        if isinstance(event_types, EventType):
            event_types = [event_types]

        self.event_types = set(event_types)
        self.include = include

    def matches(self, event: Event) -> bool:
        """检查事件类型是否匹配"""
        is_in_types = event.event_type in self.event_types
        return is_in_types if self.include else not is_in_types


class SourceFilter(EventFilter):
    """
    事件源过滤器

    根据事件源进行过滤。
    """

    def __init__(self, sources: Union[str, List[str]], include: bool = True):
        """
        初始化事件源过滤器

        Args:
            sources: 事件源或源列表
            include: True表示包含这些源，False表示排除这些源
        """
        super().__init__("SourceFilter")

        if isinstance(sources, str):
            sources = [sources]

        self.sources = set(sources)
        self.include = include

    def matches(self, event: Event) -> bool:
        """检查事件源是否匹配"""
        is_in_sources = event.source in self.sources
        return is_in_sources if self.include else not is_in_sources


class PriorityFilter(EventFilter):
    """
    优先级过滤器

    根据事件优先级进行过滤。
    """

    def __init__(
        self,
        min_priority: Optional[Priority] = None,
        max_priority: Optional[Priority] = None,
        priorities: Optional[Union[Priority, List[Priority]]] = None,
    ):
        """
        初始化优先级过滤器

        Args:
            min_priority: 最小优先级
            max_priority: 最大优先级
            priorities: 特定优先级列表
        """
        super().__init__("PriorityFilter")

        self.min_priority = min_priority
        self.max_priority = max_priority

        if priorities is not None:
            if isinstance(priorities, Priority):
                priorities = [priorities]
            self.priorities = set(priorities)
        else:
            self.priorities = None

    def matches(self, event: Event) -> bool:
        """检查事件优先级是否匹配"""
        # 如果指定了特定优先级列表
        if self.priorities is not None:
            return event.priority in self.priorities

        # 检查优先级范围
        if (
            self.min_priority is not None
            and event.priority.value < self.min_priority.value
        ):
            return False

        if (
            self.max_priority is not None
            and event.priority.value > self.max_priority.value
        ):
            return False

        return True


class DataFilter(EventFilter):
    """
    数据过滤器

    根据事件数据内容进行过滤。
    """

    def __init__(self, conditions: Dict[str, Any]):
        """
        初始化数据过滤器

        Args:
            conditions: 过滤条件字典
        """
        super().__init__("DataFilter")
        self.conditions = conditions

    def matches(self, event: Event) -> bool:
        """检查事件数据是否匹配"""
        if not event.data:
            return not self.conditions

        for key, expected_value in self.conditions.items():
            if key not in event.data:
                return False

            actual_value = event.data[key]

            # 支持不同类型的匹配
            if isinstance(expected_value, (list, tuple)):
                if actual_value not in expected_value:
                    return False
            elif isinstance(expected_value, dict):
                if not self._match_dict(actual_value, expected_value):
                    return False
            elif expected_value != actual_value:
                return False

        return True

    def _match_dict(self, actual: Any, expected: Dict[str, Any]) -> bool:
        """匹配字典数据"""
        if not isinstance(actual, dict):
            return False

        for key, value in expected.items():
            if key not in actual or actual[key] != value:
                return False

        return True


class RegexFilter(EventFilter):
    """
    正则表达式过滤器

    使用正则表达式匹配事件内容。
    """

    def __init__(self, pattern: str, field: str = "source", flags: int = 0):
        """
        初始化正则表达式过滤器

        Args:
            pattern: 正则表达式模式
            field: 要匹配的字段（source, event_type等）
            flags: 正则表达式标志
        """
        super().__init__("RegexFilter")
        self.pattern = pattern
        self.field = field
        self.regex = re.compile(pattern, flags)

    def matches(self, event: Event) -> bool:
        """检查是否匹配正则表达式"""
        try:
            if self.field == "source":
                text = event.source
            elif self.field == "event_type":
                text = event.event_type.value
            elif self.field == "data":
                text = str(event.data) if event.data else ""
            else:
                # 尝试从事件数据中获取字段
                if event.data and self.field in event.data:
                    text = str(event.data[self.field])
                else:
                    return False

            return bool(self.regex.search(text))

        except Exception as e:
            logger.error(f"RegexFilter error: {e}")
            return False


class TimeRangeFilter(EventFilter):
    """
    时间范围过滤器

    根据事件时间戳进行过滤。
    """

    def __init__(
        self, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None
    ):
        """
        初始化时间范围过滤器

        Args:
            start_time: 开始时间
            end_time: 结束时间
        """
        super().__init__("TimeRangeFilter")
        self.start_time = start_time
        self.end_time = end_time

    def matches(self, event: Event) -> bool:
        """检查事件时间是否在范围内"""
        if self.start_time and event.timestamp < self.start_time:
            return False

        if self.end_time and event.timestamp > self.end_time:
            return False

        return True


class CustomFilter(EventFilter):
    """
    自定义过滤器

    使用自定义函数进行过滤。
    """

    def __init__(
        self, filter_func: Callable[[Event], bool], name: Optional[str] = None
    ):
        """
        初始化自定义过滤器

        Args:
            filter_func: 过滤函数
            name: 过滤器名称
        """
        super().__init__(name or "CustomFilter")
        self.filter_func = filter_func

    def matches(self, event: Event) -> bool:
        """使用自定义函数检查匹配"""
        try:
            return self.filter_func(event)
        except Exception as e:
            logger.error(f"CustomFilter error: {e}")
            return False


class EventFilterChain:
    """
    事件过滤器链

    将多个过滤器组合使用。
    """

    def __init__(self, filters: Optional[List[EventFilter]] = None, logic: str = "AND"):
        """
        初始化过滤器链

        Args:
            filters: 过滤器列表
            logic: 逻辑操作符（AND/OR）
        """
        self.filters = filters or []
        self.logic = logic.upper()
        self.created_at = datetime.now(timezone.utc)

        if self.logic not in ["AND", "OR"]:
            raise ValueError("Logic must be 'AND' or 'OR'")

    def add_filter(self, filter_obj: EventFilter) -> None:
        """添加过滤器"""
        self.filters.append(filter_obj)

    def remove_filter(self, filter_obj: EventFilter) -> bool:
        """移除过滤器"""
        try:
            self.filters.remove(filter_obj)
            return True
        except ValueError:
            return False

    def matches(self, event: Event) -> bool:
        """
        检查事件是否匹配过滤器链

        Args:
            event: 要检查的事件

        Returns:
            bool: 是否匹配
        """
        if not self.filters:
            return True

        if self.logic == "AND":
            return all(f.filter(event) for f in self.filters)
        else:  # OR
            return any(f.filter(event) for f in self.filters)

    def filter(self, event: Event) -> bool:
        """过滤事件（别名方法）"""
        return self.matches(event)

    def get_statistics(self) -> Dict[str, Any]:
        """获取过滤器链统计信息"""
        filter_stats = [f.get_statistics() for f in self.filters]

        return {
            "logic": self.logic,
            "filter_count": len(self.filters),
            "filters": filter_stats,
            "created_at": self.created_at.isoformat(),
        }

    def clear(self) -> None:
        """清空所有过滤器"""
        self.filters.clear()

    def __len__(self) -> int:
        """获取过滤器数量"""
        return len(self.filters)

    def __iter__(self):
        """迭代过滤器"""
        return iter(self.filters)
