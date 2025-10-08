#! /usr/bin/env python3
# src/utils/cache_manager.py

import time
import threading
import logging
from typing import Dict, Any, Optional, List, Tuple, TypeVar, Generic, Union

K = TypeVar("K")  # Key type
V = TypeVar("V")  # Value type


class CacheManager(Generic[K, V]):
    """LRU缓存管理器,用于缓存常用响应和减少模型调用"""

    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        """
        初始化缓存管理器

        Args:
            max_size (int): 最大缓存大小,默认1000
            ttl (int): 缓存项过期时间/秒,默认3600秒(1小时)
        """
        self.cache: Dict[K, Dict[str, V]] = {}
        self.access_times: Dict[K, Dict[str, float]] = {}
        self.max_size = max_size
        self.ttl = ttl
        self.lock = threading.RLock()
        self.logger = logging.getLogger(__name__)
        self.hits = 0
        self.misses = 0

    def get(self, key: K, default: Optional[V] = None) -> Optional[V]:
        """获取缓存值

        Args:
            key: 缓存键
            default: 默认返回值,如果键不存在

        Returns:
            缓存值或默认值
        """
        with self.lock:
            if key not in self.cache:
                self.misses += 1
                return default

            # 检查缓存是否过期
            if time.time() - self.access_times[key]["created"] > self.ttl:
                self.logger.debug(f"缓存项过期,删除键: {key}")
                self._remove_item(key)
                self.misses += 1
                return default

            # 更新访问时间
            self.access_times[key]["last_access"] = time.time()
            self.hits += 1
            return self.cache[key]["value"]

    def set(self, key: K, value: V) -> None:
        """设置缓存值

        Args:
            key: 缓存键
            value: 缓存值
        """
        with self.lock:
            # 如果缓存已满,删除最久未使用的项
            if len(self.cache) >= self.max_size and key not in self.cache:
                self._evict_oldest()

            now = time.time()
            self.cache[key] = {"value": value}
            self.access_times[key] = {"created": now, "last_access": now}
            self.logger.debug(f"缓存更新,键: {key}")

    def _evict_oldest(self) -> None:
        """删除最久未使用的缓存项"""
        oldest_key = None
        oldest_time = float("inf")

        for key, times in self.access_times.items():
            if times["last_access"] < oldest_time:
                oldest_time = times["last_access"]
                oldest_key = key

        if oldest_key:
            self.logger.debug(f"删除最久未使用的缓存项,键: {oldest_key}")
            self._remove_item(oldest_key)

    def _remove_item(self, key: K) -> None:
        """删除指定缓存项"""
        if key in self.cache:
            del self.cache[key]

        if key in self.access_times:
            del self.access_times[key]

    def clear(self) -> None:
        """清空缓存"""
        with self.lock:
            self.cache.clear()
            self.access_times.clear()
            self.hits = 0
            self.misses = 0
            self.logger.debug("缓存已清空")

    def remove_expired(self) -> int:
        """移除所有过期的缓存项

        Returns:
            移除的项数量
        """
        with self.lock:
            now = time.time()
            expired_keys = [
                key
                for key, times in self.access_times.items()
                if now - times["created"] > self.ttl
            ]

            for key in expired_keys:
                self._remove_item(key)

            if expired_keys:
                self.logger.debug(f"移除了 {len(expired_keys)} 个过期缓存项")

            return len(expired_keys)

    def contains(self, key: K) -> bool:
        """检查键是否在缓存中且未过期

        Args:
            key: 要检查的键

        Returns:
            键是否存在且未过期
        """
        with self.lock:
            if key not in self.cache:
                return False

            if time.time() - self.access_times[key]["created"] > self.ttl:
                self._remove_item(key)
                return False

            return True

    def stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        with self.lock:
            total = self.hits + self.misses
            hit_rate = self.hits / total if total > 0 else 0

            return {
                "size": len(self.cache),
                "max_size": self.max_size,
                "ttl": self.ttl,
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": f"{hit_rate:.2%}",
            }


class ModelResponseCache(CacheManager[str, str]):
    """模型响应缓存管理器"""

    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        """
        初始化模型响应缓存

        Args:
            max_size: 最大缓存条目数
            ttl: 缓存生存时间(秒)
        """
        super().__init__(max_size, ttl)

    def generate_cache_key(
        self, prompt: str, temperature: float = 0.7, top_p: float = 0.9, **kwargs
    ) -> str:
        """生成缓存键

        考虑主要的生成参数，但忽略不影响输出的参数

        Args:
            prompt: 输入提示
            temperature: 温度参数
            top_p: top-p采样参数
            **kwargs: 其他可能影响输出的参数

        Returns:
            缓存键字符串
        """
        # 规范化 prompt（移除多余空白符）
        normalized_prompt = " ".join(prompt.split())

        # 构建缓存键
        key_parts = [normalized_prompt, f"temp_{temperature:.2f}", f"top_p_{top_p:.2f}"]

        # 添加其他关键参数
        for k, v in sorted(kwargs.items()):
            if k in ["max_length", "num_beams", "do_sample"]:
                key_parts.append(f"{k}_{v}")

        return "|".join(key_parts)

    def get_response(self, prompt: str, **kwargs) -> Optional[str]:
        """获取缓存的模型响应

        Args:
            prompt: 输入提示
            **kwargs: 生成参数

        Returns:
            缓存的响应或None
        """
        cache_key = self.generate_cache_key(prompt, **kwargs)
        return self.get(cache_key)

    def cache_response(self, prompt: str, response: str, **kwargs) -> None:
        """缓存模型响应

        Args:
            prompt: 输入提示
            response: 模型响应
            **kwargs: 生成参数
        """
        cache_key = self.generate_cache_key(prompt, **kwargs)
        self.set(cache_key, response)
