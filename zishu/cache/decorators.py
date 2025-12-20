"""
缓存装饰器
提供函数级别的缓存功能
"""

import asyncio
import functools
import hashlib
import json
from typing import Any, Callable, Optional, Union, List

from ..utils.logger import setup_logger
from .manager import cache_manager


logger = setup_logger(__name__)


def _generate_cache_key(
    prefix: str,
    func: Callable,
    args: tuple,
    kwargs: dict,
    key_builder: Optional[Callable] = None,
) -> str:
    """
    生成缓存键

    Args:
        prefix: 键前缀
        func: 函数对象
        args: 位置参数
        kwargs: 关键字参数
        key_builder: 自定义键生成器

    Returns:
        缓存键
    """
    if key_builder:
        return f"{prefix}:{key_builder(func, args, kwargs)}"

    # 默认键生成策略
    func_name = f"{func.__module__}.{func.__qualname__}"
    
    # 序列化参数
    try:
        params_str = json.dumps(
            {"args": args, "kwargs": kwargs},
            sort_keys=True,
            ensure_ascii=False,
        )
    except (TypeError, ValueError):
        # 如果参数不可序列化，使用 repr
        params_str = f"{args!r}_{kwargs!r}"

    # 生成哈希
    params_hash = hashlib.md5(params_str.encode()).hexdigest()[:16]

    return f"{prefix}:{func_name}:{params_hash}"


def cached(
    ttl: Optional[int] = 3600,
    key_prefix: str = "cache",
    key_builder: Optional[Callable] = None,
    condition: Optional[Callable] = None,
    unless: Optional[Callable] = None,
    serialize: bool = True,
):
    """
    缓存装饰器（支持异步函数）

    Args:
        ttl: 缓存过期时间（秒），None 表示永不过期
        key_prefix: 缓存键前缀
        key_builder: 自定义缓存键生成器 (func, args, kwargs) -> str
        condition: 缓存条件函数 (result) -> bool，返回 True 才缓存
        unless: 不缓存条件函数 (result) -> bool，返回 True 则不缓存
        serialize: 是否序列化结果

    Example:
        @cached(ttl=600, key_prefix="user")
        async def get_user(user_id: str):
            return await db.get_user(user_id)

        @cached(ttl=300, key_builder=lambda f, args, kwargs: f"adapter:{args[0]}")
        async def get_adapter(adapter_id: str):
            return await db.get_adapter(adapter_id)
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # 确保缓存管理器已初始化
            await cache_manager.ensure_initialized()

            # 生成缓存键
            cache_key = _generate_cache_key(
                key_prefix, func, args, kwargs, key_builder
            )

            # 尝试从缓存获取
            cached_value = await cache_manager.get(
                cache_key, default=None, deserialize=serialize
            )

            if cached_value is not None:
                logger.debug("Cache hit for key: %s", cache_key)
                return cached_value

            # 缓存未命中，执行函数
            logger.debug("Cache miss for key: %s", cache_key)
            result = await func(*args, **kwargs)

            # 检查缓存条件
            should_cache = True

            if condition and not condition(result):
                should_cache = False

            if unless and unless(result):
                should_cache = False

            # 写入缓存
            if should_cache:
                await cache_manager.set(
                    cache_key, result, ttl=ttl, serialize=serialize
                )
                logger.debug("Cached result for key: %s (ttl=%s)", cache_key, ttl)

            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            # 同步函数的缓存支持
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(async_wrapper(*args, **kwargs))

        # 根据函数类型返回对应的包装器
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def cache_invalidate(
    key_prefix: str = "cache",
    key_builder: Optional[Callable] = None,
    pattern: Optional[str] = None,
):
    """
    缓存失效装饰器（在函数执行后删除缓存）

    Args:
        key_prefix: 缓存键前缀
        key_builder: 自定义缓存键生成器
        pattern: 缓存键模式（支持通配符），如果提供则忽略 key_builder

    Example:
        @cache_invalidate(key_prefix="user")
        async def update_user(user_id: str, data: dict):
            await db.update_user(user_id, data)

        @cache_invalidate(pattern="cache:adapters:*")
        async def update_adapter(adapter_id: str, data: dict):
            await db.update_adapter(adapter_id, data)
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # 执行函数
            result = await func(*args, **kwargs)

            # 确保缓存管理器已初始化
            await cache_manager.ensure_initialized()

            try:
                # 删除缓存
                if pattern:
                    # 使用模式删除
                    deleted = await cache_manager.delete_pattern(pattern)
                    logger.debug("Invalidated %s cache keys matching pattern: %s", deleted, pattern)
                else:
                    # 使用键生成器删除
                    cache_key = _generate_cache_key(
                        key_prefix, func, args, kwargs, key_builder
                    )
                    deleted = await cache_manager.delete(cache_key)
                    logger.debug("Invalidated cache key: %s (deleted=%s)", cache_key, deleted)

            except Exception as e:
                logger.error("Failed to invalidate cache: %s", e)

            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(async_wrapper(*args, **kwargs))

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


class CacheDecorator:
    """
    缓存装饰器类（面向对象方式）
    """

    def __init__(
        self,
        ttl: Optional[int] = 3600,
        key_prefix: str = "cache",
        namespace: Optional[str] = None,
    ):
        """
        Args:
            ttl: 缓存过期时间
            key_prefix: 缓存键前缀
            namespace: 命名空间
        """
        self.ttl = ttl
        self.key_prefix = key_prefix
        self.namespace = namespace

    def __call__(self, func: Callable) -> Callable:
        """装饰器调用"""
        prefix = f"{self.key_prefix}:{self.namespace}" if self.namespace else self.key_prefix
        return cached(ttl=self.ttl, key_prefix=prefix)(func)

    async def invalidate(self, *args, **kwargs):
        """手动失效缓存"""
        # 需要提供函数和参数来生成键
        pass


# 便捷装饰器实例
cache_short = CacheDecorator(ttl=300, key_prefix="cache", namespace="short")  # 5分钟
cache_medium = CacheDecorator(ttl=1800, key_prefix="cache", namespace="medium")  # 30分钟
cache_long = CacheDecorator(ttl=3600, key_prefix="cache", namespace="long")  # 1小时

