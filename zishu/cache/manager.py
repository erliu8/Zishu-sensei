"""
缓存管理器
提供统一的缓存接口和高级缓存功能
"""

import json
import pickle
from typing import Any, Optional, Union, List, Dict
from datetime import timedelta

from redis.asyncio import Redis

from ..utils.logger import setup_logger
from .connection import get_redis_manager


class CacheManager:
    """缓存管理器"""

    def __init__(self, redis_client: Optional[Redis] = None):
        """
        Args:
            redis_client: Redis 客户端（可选，如果不提供会自动获取）
        """
        self.redis: Optional[Redis] = redis_client
        self.logger = setup_logger(f"{__name__}.CacheManager")
        self._initialized = False

    async def initialize(self) -> None:
        """初始化缓存管理器"""
        if self._initialized:
            return

        if self.redis is None:
            manager = await get_redis_manager()
            self.redis = await manager.get_client()

        self._initialized = True
        self.logger.info("Cache manager initialized")

    async def ensure_initialized(self) -> None:
        """确保已初始化"""
        if not self._initialized:
            await self.initialize()

    # ========== 基础操作 ==========

    async def get(
        self, key: str, default: Any = None, deserialize: bool = True
    ) -> Any:
        """
        获取缓存值

        Args:
            key: 缓存键
            default: 默认值
            deserialize: 是否反序列化（JSON）

        Returns:
            缓存值或默认值
        """
        await self.ensure_initialized()

        try:
            value = await self.redis.get(key)
            if value is None:
                return default

            if deserialize and isinstance(value, (str, bytes)):
                try:
                    return json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    return value

            return value

        except Exception as e:
            self.logger.error("Failed to get cache key %s: %s", key, e)
            return default

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        serialize: bool = True,
    ) -> bool:
        """
        设置缓存值

        Args:
            key: 缓存键
            value: 缓存值
            ttl: 过期时间（秒），None 表示永不过期
            serialize: 是否序列化（JSON）

        Returns:
            是否成功
        """
        await self.ensure_initialized()

        try:
            # 序列化值
            if serialize and not isinstance(value, (str, bytes)):
                value = json.dumps(value, ensure_ascii=False)

            # 设置缓存
            if ttl:
                await self.redis.setex(key, ttl, value)
            else:
                await self.redis.set(key, value)

            return True

        except Exception as e:
            self.logger.error("Failed to set cache key %s: %s", key, e)
            return False

    async def delete(self, *keys: str) -> int:
        """
        删除缓存键

        Args:
            keys: 要删除的键

        Returns:
            删除的键数量
        """
        await self.ensure_initialized()

        try:
            if not keys:
                return 0
            return await self.redis.delete(*keys)
        except Exception as e:
            self.logger.error("Failed to delete cache keys %s: %s", keys, e)
            return 0

    async def exists(self, *keys: str) -> int:
        """
        检查键是否存在

        Args:
            keys: 要检查的键

        Returns:
            存在的键数量
        """
        await self.ensure_initialized()

        try:
            return await self.redis.exists(*keys)
        except Exception as e:
            self.logger.error("Failed to check key existence %s: %s", keys, e)
            return 0

    async def expire(self, key: str, seconds: int) -> bool:
        """
        设置键的过期时间

        Args:
            key: 缓存键
            seconds: 过期时间（秒）

        Returns:
            是否成功
        """
        await self.ensure_initialized()

        try:
            return await self.redis.expire(key, seconds)
        except Exception as e:
            self.logger.error("Failed to set expiry for key %s: %s", key, e)
            return False

    async def ttl(self, key: str) -> int:
        """
        获取键的剩余过期时间

        Args:
            key: 缓存键

        Returns:
            剩余秒数，-1表示永不过期，-2表示键不存在
        """
        await self.ensure_initialized()

        try:
            return await self.redis.ttl(key)
        except Exception as e:
            self.logger.error("Failed to get TTL for key %s: %s", key, e)
            return -2

    # ========== 模式匹配操作 ==========

    async def keys(self, pattern: str = "*") -> List[str]:
        """
        获取匹配模式的所有键

        Args:
            pattern: 匹配模式（支持 * 和 ?）

        Returns:
            键列表
        """
        await self.ensure_initialized()

        try:
            keys = await self.redis.keys(pattern)
            return [k.decode() if isinstance(k, bytes) else k for k in keys]
        except Exception as e:
            self.logger.error("Failed to get keys with pattern %s: %s", pattern, e)
            return []

    async def delete_pattern(self, pattern: str) -> int:
        """
        删除匹配模式的所有键

        Args:
            pattern: 匹配模式

        Returns:
            删除的键数量
        """
        await self.ensure_initialized()

        try:
            keys = await self.keys(pattern)
            if keys:
                return await self.delete(*keys)
            return 0
        except Exception as e:
            self.logger.error("Failed to delete pattern %s: %s", pattern, e)
            return 0

    # ========== Hash 操作 ==========

    async def hget(self, name: str, key: str, default: Any = None) -> Any:
        """获取 Hash 字段值"""
        await self.ensure_initialized()

        try:
            value = await self.redis.hget(name, key)
            return value if value is not None else default
        except Exception as e:
            self.logger.error("Failed to get hash field %s:%s: %s", name, key, e)
            return default

    async def hset(self, name: str, key: str, value: Any) -> bool:
        """设置 Hash 字段值"""
        await self.ensure_initialized()

        try:
            await self.redis.hset(name, key, value)
            return True
        except Exception as e:
            self.logger.error("Failed to set hash field %s:%s: %s", name, key, e)
            return False

    async def hgetall(self, name: str) -> Dict[str, Any]:
        """获取 Hash 所有字段"""
        await self.ensure_initialized()

        try:
            return await self.redis.hgetall(name)
        except Exception as e:
            self.logger.error("Failed to get all hash fields %s: %s", name, e)
            return {}

    async def hdel(self, name: str, *keys: str) -> int:
        """删除 Hash 字段"""
        await self.ensure_initialized()

        try:
            if not keys:
                return 0
            return await self.redis.hdel(name, *keys)
        except Exception as e:
            self.logger.error("Failed to delete hash fields %s:%s: %s", name, keys, e)
            return 0

    # ========== List 操作 ==========

    async def lpush(self, key: str, *values: Any) -> int:
        """从左侧推入列表"""
        await self.ensure_initialized()

        try:
            return await self.redis.lpush(key, *values)
        except Exception as e:
            self.logger.error("Failed to lpush to key %s: %s", key, e)
            return 0

    async def rpush(self, key: str, *values: Any) -> int:
        """从右侧推入列表"""
        await self.ensure_initialized()

        try:
            return await self.redis.rpush(key, *values)
        except Exception as e:
            self.logger.error("Failed to rpush to key %s: %s", key, e)
            return 0

    async def lpop(self, key: str) -> Any:
        """从左侧弹出"""
        await self.ensure_initialized()

        try:
            return await self.redis.lpop(key)
        except Exception as e:
            self.logger.error("Failed to lpop from key %s: %s", key, e)
            return None

    async def rpop(self, key: str) -> Any:
        """从右侧弹出"""
        await self.ensure_initialized()

        try:
            return await self.redis.rpop(key)
        except Exception as e:
            self.logger.error("Failed to rpop from key %s: %s", key, e)
            return None

    async def lrange(self, key: str, start: int = 0, end: int = -1) -> List[Any]:
        """获取列表范围"""
        await self.ensure_initialized()

        try:
            return await self.redis.lrange(key, start, end)
        except Exception as e:
            self.logger.error("Failed to lrange key %s: %s", key, e)
            return []

    async def llen(self, key: str) -> int:
        """获取列表长度"""
        await self.ensure_initialized()

        try:
            return await self.redis.llen(key)
        except Exception as e:
            self.logger.error("Failed to get list length %s: %s", key, e)
            return 0

    # ========== Set 操作 ==========

    async def sadd(self, key: str, *members: Any) -> int:
        """添加集合成员"""
        await self.ensure_initialized()

        try:
            return await self.redis.sadd(key, *members)
        except Exception as e:
            self.logger.error("Failed to sadd to key %s: %s", key, e)
            return 0

    async def srem(self, key: str, *members: Any) -> int:
        """删除集合成员"""
        await self.ensure_initialized()

        try:
            return await self.redis.srem(key, *members)
        except Exception as e:
            self.logger.error("Failed to srem from key %s: %s", key, e)
            return 0

    async def smembers(self, key: str) -> set:
        """获取集合所有成员"""
        await self.ensure_initialized()

        try:
            return await self.redis.smembers(key)
        except Exception as e:
            self.logger.error("Failed to get set members %s: %s", key, e)
            return set()

    async def sismember(self, key: str, member: Any) -> bool:
        """检查是否是集合成员"""
        await self.ensure_initialized()

        try:
            return await self.redis.sismember(key, member)
        except Exception as e:
            self.logger.error("Failed to check set member %s:%s: %s", key, member, e)
            return False

    # ========== Sorted Set 操作 ==========

    async def zadd(self, key: str, mapping: Dict[Any, float]) -> int:
        """添加有序集合成员"""
        await self.ensure_initialized()

        try:
            return await self.redis.zadd(key, mapping)
        except Exception as e:
            self.logger.error("Failed to zadd to key %s: %s", key, e)
            return 0

    async def zrange(
        self, key: str, start: int, end: int, withscores: bool = False
    ) -> List:
        """获取有序集合范围"""
        await self.ensure_initialized()

        try:
            return await self.redis.zrange(key, start, end, withscores=withscores)
        except Exception as e:
            self.logger.error("Failed to zrange key %s: %s", key, e)
            return []

    async def zrevrange(
        self, key: str, start: int, end: int, withscores: bool = False
    ) -> List:
        """获取有序集合范围（倒序）"""
        await self.ensure_initialized()

        try:
            return await self.redis.zrevrange(key, start, end, withscores=withscores)
        except Exception as e:
            self.logger.error("Failed to zrevrange key %s: %s", key, e)
            return []

    async def zrem(self, key: str, *members: Any) -> int:
        """删除有序集合成员"""
        await self.ensure_initialized()

        try:
            return await self.redis.zrem(key, *members)
        except Exception as e:
            self.logger.error("Failed to zrem from key %s: %s", key, e)
            return 0

    async def zcard(self, key: str) -> int:
        """获取有序集合大小"""
        await self.ensure_initialized()

        try:
            return await self.redis.zcard(key)
        except Exception as e:
            self.logger.error("Failed to get zcard %s: %s", key, e)
            return 0

    # ========== 计数器操作 ==========

    async def incr(self, key: str, amount: int = 1) -> int:
        """递增计数器"""
        await self.ensure_initialized()

        try:
            return await self.redis.incrby(key, amount)
        except Exception as e:
            self.logger.error("Failed to incr key %s: %s", key, e)
            return 0

    async def decr(self, key: str, amount: int = 1) -> int:
        """递减计数器"""
        await self.ensure_initialized()

        try:
            return await self.redis.decrby(key, amount)
        except Exception as e:
            self.logger.error("Failed to decr key %s: %s", key, e)
            return 0

    # ========== 分布式锁 ==========

    async def acquire_lock(
        self, lock_key: str, timeout: int = 60, blocking: bool = True, blocking_timeout: Optional[int] = None
    ) -> Optional[str]:
        """
        获取分布式锁

        Args:
            lock_key: 锁键名
            timeout: 锁超时时间（秒）
            blocking: 是否阻塞等待
            blocking_timeout: 阻塞超时时间（秒）

        Returns:
            锁标识符（成功）或 None（失败）
        """
        await self.ensure_initialized()

        import uuid
        lock_value = str(uuid.uuid4())

        try:
            # 非阻塞模式
            if not blocking:
                result = await self.redis.set(lock_key, lock_value, nx=True, ex=timeout)
                return lock_value if result else None

            # 阻塞模式
            import time
            start_time = time.time()
            while True:
                result = await self.redis.set(lock_key, lock_value, nx=True, ex=timeout)
                if result:
                    return lock_value

                # 检查是否超时
                if blocking_timeout and (time.time() - start_time) > blocking_timeout:
                    return None

                # 短暂等待后重试
                await asyncio.sleep(0.1)

        except Exception as e:
            self.logger.error("Failed to acquire lock %s: %s", lock_key, e)
            return None

    async def release_lock(self, lock_key: str, lock_value: str) -> bool:
        """
        释放分布式锁

        Args:
            lock_key: 锁键名
            lock_value: 锁标识符

        Returns:
            是否成功
        """
        await self.ensure_initialized()

        try:
            # Lua 脚本确保原子性
            lua_script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            result = await self.redis.eval(lua_script, 1, lock_key, lock_value)
            return result == 1

        except Exception as e:
            self.logger.error("Failed to release lock %s: %s", lock_key, e)
            return False


# 全局缓存管理器实例
cache_manager = CacheManager()


# 导入 asyncio 用于锁操作
import asyncio

