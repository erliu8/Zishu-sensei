"""
Redis 客户端管理
"""
import json
from typing import Any, Optional
import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config.settings import settings


class RedisClient:
    """Redis 客户端封装"""
    
    def __init__(self):
        self.redis: Optional[Redis] = None
    
    async def connect(self):
        """连接 Redis"""
        self.redis = await aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=settings.REDIS_DECODE_RESPONSES,
            max_connections=50,
        )
    
    async def disconnect(self):
        """断开 Redis 连接"""
        if self.redis:
            await self.redis.close()
    
    async def get(self, key: str) -> Optional[str]:
        """获取缓存值"""
        if not self.redis:
            return None
        return await self.redis.get(key)
    
    async def set(
        self,
        key: str,
        value: Any,
        expire: Optional[int] = None
    ) -> bool:
        """设置缓存值"""
        if not self.redis:
            return False
        
        if expire is None:
            expire = settings.CACHE_EXPIRE_SECONDS
        
        return await self.redis.set(key, value, ex=expire)
    
    async def get_json(self, key: str) -> Optional[dict]:
        """获取 JSON 缓存"""
        value = await self.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return None
        return None
    
    async def set_json(
        self,
        key: str,
        value: dict,
        expire: Optional[int] = None
    ) -> bool:
        """设置 JSON 缓存"""
        return await self.set(key, json.dumps(value), expire)
    
    async def delete(self, key: str) -> bool:
        """删除缓存"""
        if not self.redis:
            return False
        return await self.redis.delete(key) > 0
    
    async def exists(self, key: str) -> bool:
        """检查键是否存在"""
        if not self.redis:
            return False
        return await self.redis.exists(key) > 0
    
    async def expire(self, key: str, seconds: int) -> bool:
        """设置过期时间"""
        if not self.redis:
            return False
        return await self.redis.expire(key, seconds)
    
    async def increment(self, key: str, amount: int = 1) -> int:
        """递增计数器"""
        if not self.redis:
            return 0
        return await self.redis.incrby(key, amount)
    
    async def decrement(self, key: str, amount: int = 1) -> int:
        """递减计数器"""
        if not self.redis:
            return 0
        return await self.redis.decrby(key, amount)
    
    async def get_many(self, keys: list[str]) -> list[Optional[str]]:
        """批量获取"""
        if not self.redis:
            return [None] * len(keys)
        return await self.redis.mget(keys)
    
    async def set_many(self, mapping: dict[str, Any]) -> bool:
        """批量设置"""
        if not self.redis:
            return False
        return await self.redis.mset(mapping)
    
    async def flush_db(self):
        """清空数据库（慎用）"""
        if self.redis:
            await self.redis.flushdb()


# 创建全局 Redis 客户端实例
redis_client = RedisClient()


async def get_redis() -> Redis:
    """获取 Redis 客户端（用于依赖注入）"""
    return redis_client.redis

