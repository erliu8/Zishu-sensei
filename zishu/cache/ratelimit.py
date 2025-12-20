"""
限流模块
基于 Redis 的分布式限流实现
支持滑动窗口、令牌桶、固定窗口等多种算法
"""

import time
from typing import Optional, Tuple, Dict
from enum import Enum

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

from ..utils.logger import setup_logger
from .manager import cache_manager


class RateLimitAlgorithm(Enum):
    """限流算法类型"""
    FIXED_WINDOW = "fixed_window"  # 固定窗口
    SLIDING_WINDOW = "sliding_window"  # 滑动窗口
    TOKEN_BUCKET = "token_bucket"  # 令牌桶


class RateLimiter:
    """限流器"""

    def __init__(
        self,
        key_prefix: str = "ratelimit",
        algorithm: RateLimitAlgorithm = RateLimitAlgorithm.SLIDING_WINDOW,
    ):
        """
        Args:
            key_prefix: 限流键前缀
            algorithm: 限流算法
        """
        self.key_prefix = key_prefix
        self.algorithm = algorithm
        self.logger = setup_logger(f"{__name__}.RateLimiter")

    def _get_rate_limit_key(self, identifier: str, resource: str) -> str:
        """生成限流键"""
        return f"{self.key_prefix}:{identifier}:{resource}"

    async def check_rate_limit(
        self,
        identifier: str,
        resource: str,
        max_requests: int,
        window_seconds: int,
    ) -> Tuple[bool, Dict]:
        """
        检查是否超过限流

        Args:
            identifier: 标识符（如用户ID、IP地址）
            resource: 资源标识（如API端点）
            max_requests: 窗口期内最大请求数
            window_seconds: 窗口大小（秒）

        Returns:
            (是否允许, 限流信息字典)
        """
        await cache_manager.ensure_initialized()

        if self.algorithm == RateLimitAlgorithm.SLIDING_WINDOW:
            return await self._sliding_window_check(
                identifier, resource, max_requests, window_seconds
            )
        elif self.algorithm == RateLimitAlgorithm.FIXED_WINDOW:
            return await self._fixed_window_check(
                identifier, resource, max_requests, window_seconds
            )
        elif self.algorithm == RateLimitAlgorithm.TOKEN_BUCKET:
            return await self._token_bucket_check(
                identifier, resource, max_requests, window_seconds
            )
        else:
            raise ValueError(f"Unsupported algorithm: {self.algorithm}")

    async def _sliding_window_check(
        self, identifier: str, resource: str, max_requests: int, window_seconds: int
    ) -> Tuple[bool, Dict]:
        """滑动窗口限流检查"""
        key = self._get_rate_limit_key(identifier, resource)
        current_time = time.time()
        window_start = current_time - window_seconds

        try:
            # 使用 Lua 脚本保证原子性
            lua_script = """
            local key = KEYS[1]
            local current_time = tonumber(ARGV[1])
            local window_start = tonumber(ARGV[2])
            local max_requests = tonumber(ARGV[3])
            local window_seconds = tonumber(ARGV[4])
            
            -- 移除过期的请求记录
            redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
            
            -- 获取当前窗口内的请求数
            local current_requests = redis.call('ZCARD', key)
            
            -- 检查是否超过限制
            if current_requests < max_requests then
                -- 添加新的请求记录
                redis.call('ZADD', key, current_time, current_time)
                redis.call('EXPIRE', key, window_seconds)
                return {1, current_requests + 1, max_requests}
            else
                return {0, current_requests, max_requests}
            end
            """

            result = await cache_manager.redis.eval(
                lua_script,
                1,
                key,
                current_time,
                window_start,
                max_requests,
                window_seconds,
            )

            allowed = bool(result[0])
            current_requests = int(result[1])
            limit = int(result[2])

            info = {
                "allowed": allowed,
                "limit": limit,
                "remaining": max(0, limit - current_requests),
                "reset_at": int(current_time + window_seconds),
            }

            if allowed:
                self.logger.debug(
                    "Rate limit check passed for %s:%s (%s/%s)",
                    identifier,
                    resource,
                    current_requests,
                    max_requests,
                )
            else:
                self.logger.warning(
                    "Rate limit exceeded for %s:%s (%s/%s)",
                    identifier,
                    resource,
                    current_requests,
                    max_requests,
                )

            return allowed, info

        except Exception as e:
            self.logger.error("Rate limit check failed: %s", e)
            # 发生错误时默认允许通过
            return True, {
                "allowed": True,
                "limit": max_requests,
                "remaining": max_requests,
                "reset_at": int(current_time + window_seconds),
            }

    async def _fixed_window_check(
        self, identifier: str, resource: str, max_requests: int, window_seconds: int
    ) -> Tuple[bool, Dict]:
        """固定窗口限流检查"""
        # 计算当前窗口的开始时间
        current_time = int(time.time())
        window_start = (current_time // window_seconds) * window_seconds
        key = f"{self._get_rate_limit_key(identifier, resource)}:{window_start}"

        try:
            # 递增计数器
            current_requests = await cache_manager.incr(key)

            # 如果是第一个请求，设置过期时间
            if current_requests == 1:
                await cache_manager.expire(key, window_seconds)

            # 检查是否超过限制
            allowed = current_requests <= max_requests

            info = {
                "allowed": allowed,
                "limit": max_requests,
                "remaining": max(0, max_requests - current_requests),
                "reset_at": window_start + window_seconds,
            }

            return allowed, info

        except Exception as e:
            self.logger.error("Fixed window rate limit check failed: %s", e)
            return True, {
                "allowed": True,
                "limit": max_requests,
                "remaining": max_requests,
                "reset_at": window_start + window_seconds,
            }

    async def _token_bucket_check(
        self, identifier: str, resource: str, capacity: int, refill_rate: int
    ) -> Tuple[bool, Dict]:
        """令牌桶限流检查"""
        key = self._get_rate_limit_key(identifier, resource)
        current_time = time.time()

        try:
            lua_script = """
            local key = KEYS[1]
            local capacity = tonumber(ARGV[1])
            local refill_rate = tonumber(ARGV[2])
            local current_time = tonumber(ARGV[3])
            
            -- 获取桶的状态
            local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
            local tokens = tonumber(bucket[1]) or capacity
            local last_refill = tonumber(bucket[2]) or current_time
            
            -- 计算需要补充的令牌
            local time_passed = current_time - last_refill
            local tokens_to_add = time_passed * refill_rate
            tokens = math.min(capacity, tokens + tokens_to_add)
            
            -- 尝试消耗一个令牌
            if tokens >= 1 then
                tokens = tokens - 1
                redis.call('HMSET', key, 'tokens', tokens, 'last_refill', current_time)
                redis.call('EXPIRE', key, 3600)
                return {1, math.floor(tokens), capacity}
            else
                redis.call('HMSET', key, 'tokens', tokens, 'last_refill', current_time)
                redis.call('EXPIRE', key, 3600)
                return {0, math.floor(tokens), capacity}
            end
            """

            result = await cache_manager.redis.eval(
                lua_script, 1, key, capacity, refill_rate, current_time
            )

            allowed = bool(result[0])
            remaining_tokens = int(result[1])
            bucket_capacity = int(result[2])

            info = {
                "allowed": allowed,
                "limit": bucket_capacity,
                "remaining": remaining_tokens,
                "reset_at": int(current_time + (bucket_capacity / refill_rate)),
            }

            return allowed, info

        except Exception as e:
            self.logger.error("Token bucket rate limit check failed: %s", e)
            return True, {
                "allowed": True,
                "limit": capacity,
                "remaining": capacity,
                "reset_at": int(current_time + 60),
            }

    async def reset_limit(self, identifier: str, resource: str) -> bool:
        """
        重置限流计数

        Args:
            identifier: 标识符
            resource: 资源标识

        Returns:
            是否成功
        """
        await cache_manager.ensure_initialized()

        pattern = f"{self._get_rate_limit_key(identifier, resource)}*"
        deleted = await cache_manager.delete_pattern(pattern)

        self.logger.debug("Reset rate limit for %s:%s (deleted=%s)", identifier, resource, deleted)
        return deleted > 0


# IP 黑名单管理
class IPBlacklist:
    """IP 黑名单管理"""

    def __init__(self, key: str = "blacklist:ip"):
        """
        Args:
            key: 黑名单集合键名
        """
        self.key = key
        self.logger = setup_logger(f"{__name__}.IPBlacklist")

    async def add_ip(self, ip: str, ttl: Optional[int] = None) -> bool:
        """
        添加 IP 到黑名单

        Args:
            ip: IP 地址
            ttl: 过期时间（秒），None 表示永久

        Returns:
            是否成功
        """
        await cache_manager.ensure_initialized()

        # 使用集合存储永久黑名单
        if ttl is None:
            await cache_manager.sadd(self.key, ip)
            self.logger.info("Added IP to permanent blacklist: %s", ip)
            return True
        else:
            # 临时黑名单使用单独的键
            temp_key = f"{self.key}:temp:{ip}"
            await cache_manager.set(temp_key, "1", ttl=ttl)
            self.logger.info("Added IP to temporary blacklist: %s (ttl=%s)", ip, ttl)
            return True

    async def is_blacklisted(self, ip: str) -> bool:
        """
        检查 IP 是否在黑名单中

        Args:
            ip: IP 地址

        Returns:
            是否在黑名单中
        """
        await cache_manager.ensure_initialized()

        # 检查永久黑名单
        if await cache_manager.sismember(self.key, ip):
            return True

        # 检查临时黑名单
        temp_key = f"{self.key}:temp:{ip}"
        if await cache_manager.exists(temp_key) > 0:
            return True

        return False

    async def remove_ip(self, ip: str) -> bool:
        """
        从黑名单移除 IP

        Args:
            ip: IP 地址

        Returns:
            是否成功
        """
        await cache_manager.ensure_initialized()

        # 从永久黑名单移除
        await cache_manager.srem(self.key, ip)

        # 从临时黑名单移除
        temp_key = f"{self.key}:temp:{ip}"
        await cache_manager.delete(temp_key)

        self.logger.info("Removed IP from blacklist: %s", ip)
        return True

    async def get_all_ips(self) -> set:
        """
        获取所有黑名单 IP

        Returns:
            IP 地址集合
        """
        await cache_manager.ensure_initialized()
        return await cache_manager.smembers(self.key)


# FastAPI 中间件
class RateLimitMiddleware(BaseHTTPMiddleware):
    """限流中间件"""

    def __init__(
        self,
        app,
        rate_limiter: Optional[RateLimiter] = None,
        max_requests: int = 100,
        window_seconds: int = 60,
        identifier_func=None,
        exclude_paths: Optional[list] = None,
    ):
        """
        Args:
            app: FastAPI 应用
            rate_limiter: 限流器实例
            max_requests: 窗口期内最大请求数
            window_seconds: 窗口大小（秒）
            identifier_func: 自定义标识符提取函数
            exclude_paths: 排除的路径列表
        """
        super().__init__(app)
        self.rate_limiter = rate_limiter or RateLimiter()
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.identifier_func = identifier_func or self._default_identifier
        self.exclude_paths = exclude_paths or []
        self.logger = setup_logger(f"{__name__}.RateLimitMiddleware")

    def _default_identifier(self, request: Request) -> str:
        """默认标识符提取（使用客户端 IP）"""
        # 尝试从代理头获取真实 IP
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # 使用客户端地址
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        """处理请求"""
        # 检查是否在排除路径中
        if request.url.path in self.exclude_paths:
            return await call_next(request)

        # 获取标识符
        identifier = self.identifier_func(request)
        resource = f"{request.method}:{request.url.path}"

        # 检查限流
        allowed, info = await self.rate_limiter.check_rate_limit(
            identifier, resource, self.max_requests, self.window_seconds
        )

        # 添加限流响应头
        response = None
        if allowed:
            response = await call_next(request)
        else:
            response = HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "Rate limit exceeded",
                    "limit": info["limit"],
                    "remaining": info["remaining"],
                    "reset_at": info["reset_at"],
                },
            )

        # 设置限流响应头
        if hasattr(response, "headers"):
            response.headers["X-RateLimit-Limit"] = str(info["limit"])
            response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
            response.headers["X-RateLimit-Reset"] = str(info["reset_at"])

        return response


# 全局实例
rate_limiter = RateLimiter()
ip_blacklist = IPBlacklist()


# 导入必要的模块
from typing import Dict

