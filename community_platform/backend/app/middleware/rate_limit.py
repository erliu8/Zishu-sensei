"""
限流中间件
基于 Redis 实现的请求频率限制
支持多种限流策略：固定窗口、滑动窗口
"""
import time
import logging
from typing import Callable, Optional
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.exceptions import RateLimitException
from app.db.redis import redis_client

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    限流中间件
    使用 Redis 实现分布式限流
    """
    
    def __init__(
        self,
        app: ASGIApp,
        *,
        requests_per_window: int = 100,  # 时间窗口内的最大请求数
        window_seconds: int = 60,  # 时间窗口大小（秒）
        enabled: bool = True,  # 是否启用限流
        exclude_paths: list[str] | None = None,  # 排除的路径
        key_func: Optional[Callable] = None,  # 自定义键生成函数
    ):
        """
        初始化限流中间件
        
        Args:
            app: ASGI 应用
            requests_per_window: 时间窗口内允许的最大请求数
            window_seconds: 时间窗口大小（秒）
            enabled: 是否启用限流
            exclude_paths: 排除的路径列表
            key_func: 自定义键生成函数
        """
        super().__init__(app)
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self.enabled = enabled
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/redoc", "/openapi.json"]
        self.key_func = key_func or self._default_key_func
        
        # 内存缓存（Redis 不可用时的回退方案）
        self._memory_cache: dict[str, list[float]] = defaultdict(list)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        # 检查是否启用限流
        if not self.enabled:
            return await call_next(request)
        
        # 检查是否需要排除此路径
        if self._should_exclude(request.url.path):
            return await call_next(request)
        
        # 生成限流键
        rate_limit_key = self.key_func(request)
        
        # 检查是否超过限流
        is_allowed, retry_after = await self._check_rate_limit(rate_limit_key)
        
        if not is_allowed:
            raise RateLimitException(
                message=f"请求过于频繁，请在 {retry_after} 秒后重试",
                retry_after=retry_after,
            )
        
        # 处理请求
        response = await call_next(request)
        
        # 添加限流相关的响应头
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_window)
        response.headers["X-RateLimit-Window"] = str(self.window_seconds)
        
        return response
    
    def _should_exclude(self, path: str) -> bool:
        """检查路径是否应该被排除"""
        return any(path.startswith(exclude_path) for exclude_path in self.exclude_paths)
    
    def _default_key_func(self, request: Request) -> str:
        """
        默认的键生成函数
        基于客户端 IP 地址
        """
        client_ip = request.client.host if request.client else "unknown"
        return f"rate_limit:{client_ip}"
    
    async def _check_rate_limit(self, key: str) -> tuple[bool, int]:
        """
        检查是否超过限流
        使用滑动窗口算法
        
        Args:
            key: 限流键
        
        Returns:
            (is_allowed, retry_after): 是否允许请求，重试等待时间
        """
        # 尝试使用 Redis
        if redis_client.redis:
            return await self._check_rate_limit_redis(key)
        else:
            # Redis 不可用，使用内存缓存
            logger.warning("Redis not available, using memory-based rate limiting")
            return self._check_rate_limit_memory(key)
    
    async def _check_rate_limit_redis(self, key: str) -> tuple[bool, int]:
        """
        使用 Redis 实现的限流检查（滑动窗口）
        
        使用 Redis 的 sorted set 实现滑动窗口：
        - member: 请求时间戳
        - score: 请求时间戳
        """
        current_time = time.time()
        window_start = current_time - self.window_seconds
        
        try:
            # 使用 pipeline 提高性能
            pipe = redis_client.redis.pipeline()
            
            # 1. 移除窗口外的旧请求
            pipe.zremrangebyscore(key, 0, window_start)
            
            # 2. 统计当前窗口内的请求数
            pipe.zcard(key)
            
            # 3. 添加当前请求
            pipe.zadd(key, {str(current_time): current_time})
            
            # 4. 设置键的过期时间
            pipe.expire(key, self.window_seconds + 10)
            
            # 执行 pipeline
            results = await pipe.execute()
            
            # 获取当前窗口内的请求数（执行 zadd 之前的计数）
            request_count = results[1]
            
            # 检查是否超过限制
            if request_count >= self.requests_per_window:
                # 计算需要等待的时间
                # 获取最早的请求时间
                earliest_requests = await redis_client.redis.zrange(key, 0, 0, withscores=True)
                if earliest_requests:
                    earliest_time = earliest_requests[0][1]
                    retry_after = int(earliest_time + self.window_seconds - current_time) + 1
                else:
                    retry_after = self.window_seconds
                
                return False, retry_after
            
            return True, 0
            
        except Exception as e:
            logger.error(f"Redis rate limit check failed: {e}")
            # Redis 出错，降级到内存限流
            return self._check_rate_limit_memory(key)
    
    def _check_rate_limit_memory(self, key: str) -> tuple[bool, int]:
        """
        使用内存实现的限流检查（回退方案）
        """
        current_time = time.time()
        window_start = current_time - self.window_seconds
        
        # 获取该键的请求时间列表
        request_times = self._memory_cache[key]
        
        # 移除窗口外的旧请求
        request_times = [t for t in request_times if t > window_start]
        self._memory_cache[key] = request_times
        
        # 检查是否超过限制
        if len(request_times) >= self.requests_per_window:
            # 计算需要等待的时间
            earliest_time = min(request_times)
            retry_after = int(earliest_time + self.window_seconds - current_time) + 1
            return False, retry_after
        
        # 添加当前请求
        request_times.append(current_time)
        
        return True, 0


class UserRateLimitMiddleware(BaseHTTPMiddleware):
    """
    基于用户的限流中间件
    对已认证用户和匿名用户应用不同的限流策略
    """
    
    def __init__(
        self,
        app: ASGIApp,
        *,
        authenticated_requests: int = 200,  # 认证用户的限流
        anonymous_requests: int = 50,  # 匿名用户的限流
        window_seconds: int = 60,
        enabled: bool = True,
        exclude_paths: list[str] | None = None,
    ):
        """
        初始化用户限流中间件
        
        Args:
            app: ASGI 应用
            authenticated_requests: 认证用户的请求限制
            anonymous_requests: 匿名用户的请求限制
            window_seconds: 时间窗口大小（秒）
            enabled: 是否启用限流
            exclude_paths: 排除的路径列表
        """
        super().__init__(app)
        self.authenticated_requests = authenticated_requests
        self.anonymous_requests = anonymous_requests
        self.window_seconds = window_seconds
        self.enabled = enabled
        self.exclude_paths = exclude_paths or ["/health", "/docs", "/redoc", "/openapi.json"]
        
        # 内存缓存
        self._memory_cache: dict[str, list[float]] = defaultdict(list)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求"""
        # 检查是否启用限流
        if not self.enabled:
            return await call_next(request)
        
        # 检查是否需要排除此路径
        if self._should_exclude(request.url.path):
            return await call_next(request)
        
        # 确定用户类型和限流参数
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            # 认证用户
            rate_limit_key = f"rate_limit:user:{user_id}"
            requests_limit = self.authenticated_requests
        else:
            # 匿名用户（使用 IP）
            client_ip = request.client.host if request.client else "unknown"
            rate_limit_key = f"rate_limit:anonymous:{client_ip}"
            requests_limit = self.anonymous_requests
        
        # 检查是否超过限流
        is_allowed, retry_after = await self._check_rate_limit(
            rate_limit_key,
            requests_limit
        )
        
        if not is_allowed:
            raise RateLimitException(
                message=f"请求过于频繁，请在 {retry_after} 秒后重试",
                retry_after=retry_after,
            )
        
        # 处理请求
        response = await call_next(request)
        
        # 添加限流相关的响应头
        response.headers["X-RateLimit-Limit"] = str(requests_limit)
        response.headers["X-RateLimit-Window"] = str(self.window_seconds)
        
        return response
    
    def _should_exclude(self, path: str) -> bool:
        """检查路径是否应该被排除"""
        return any(path.startswith(exclude_path) for exclude_path in self.exclude_paths)
    
    async def _check_rate_limit(
        self,
        key: str,
        requests_limit: int
    ) -> tuple[bool, int]:
        """检查是否超过限流"""
        # 尝试使用 Redis
        if redis_client.redis:
            return await self._check_rate_limit_redis(key, requests_limit)
        else:
            logger.warning("Redis not available, using memory-based rate limiting")
            return self._check_rate_limit_memory(key, requests_limit)
    
    async def _check_rate_limit_redis(
        self,
        key: str,
        requests_limit: int
    ) -> tuple[bool, int]:
        """使用 Redis 实现的限流检查"""
        current_time = time.time()
        window_start = current_time - self.window_seconds
        
        try:
            pipe = redis_client.redis.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zcard(key)
            pipe.zadd(key, {str(current_time): current_time})
            pipe.expire(key, self.window_seconds + 10)
            
            results = await pipe.execute()
            request_count = results[1]
            
            if request_count >= requests_limit:
                earliest_requests = await redis_client.redis.zrange(key, 0, 0, withscores=True)
                if earliest_requests:
                    earliest_time = earliest_requests[0][1]
                    retry_after = int(earliest_time + self.window_seconds - current_time) + 1
                else:
                    retry_after = self.window_seconds
                
                return False, retry_after
            
            return True, 0
            
        except Exception as e:
            logger.error(f"Redis rate limit check failed: {e}")
            return self._check_rate_limit_memory(key, requests_limit)
    
    def _check_rate_limit_memory(
        self,
        key: str,
        requests_limit: int
    ) -> tuple[bool, int]:
        """使用内存实现的限流检查"""
        current_time = time.time()
        window_start = current_time - self.window_seconds
        
        request_times = self._memory_cache[key]
        request_times = [t for t in request_times if t > window_start]
        self._memory_cache[key] = request_times
        
        if len(request_times) >= requests_limit:
            earliest_time = min(request_times)
            retry_after = int(earliest_time + self.window_seconds - current_time) + 1
            return False, retry_after
        
        request_times.append(current_time)
        return True, 0

