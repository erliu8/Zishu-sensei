"""
Redis 连接管理模块
支持连接池、健康检查、自动重连
"""

import asyncio
from typing import Any, Dict, Optional
import time

import redis.asyncio as aioredis
from redis.asyncio import Redis, ConnectionPool
from redis.exceptions import ConnectionError, TimeoutError

from ..utils.logger import setup_logger


class RedisConfig:
    """Redis 配置管理"""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: Optional[str] = None,
        username: Optional[str] = None,
        max_connections: int = 50,
        socket_timeout: int = 5,
        socket_connect_timeout: int = 5,
        socket_keepalive: bool = True,
        retry_on_timeout: bool = True,
        decode_responses: bool = True,
        **kwargs,
    ):
        """
        Args:
            host: Redis 主机地址
            port: Redis 端口
            db: 数据库编号
            password: 密码
            username: 用户名 (Redis 6+)
            max_connections: 最大连接数
            socket_timeout: 套接字超时时间(秒)
            socket_connect_timeout: 连接超时时间(秒)
            socket_keepalive: 是否启用 TCP keepalive
            retry_on_timeout: 超时时是否重试
            decode_responses: 是否自动解码响应为字符串
        """
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.username = username
        self.max_connections = max_connections
        self.socket_timeout = socket_timeout
        self.socket_connect_timeout = socket_connect_timeout
        self.socket_keepalive = socket_keepalive
        self.retry_on_timeout = retry_on_timeout
        self.decode_responses = decode_responses
        self.extra_options = kwargs

    @classmethod
    def from_env(cls, prefix: str = "REDIS") -> "RedisConfig":
        """从环境变量创建配置"""
        import os

        return cls(
            host=os.getenv(f"{prefix}_HOST", "localhost"),
            port=int(os.getenv(f"{prefix}_PORT", "6379")),
            db=int(os.getenv(f"{prefix}_DB", "0")),
            password=os.getenv(f"{prefix}_PASSWORD"),
            username=os.getenv(f"{prefix}_USERNAME"),
            max_connections=int(os.getenv(f"{prefix}_MAX_CONNECTIONS", "50")),
            socket_timeout=int(os.getenv(f"{prefix}_SOCKET_TIMEOUT", "5")),
            socket_connect_timeout=int(
                os.getenv(f"{prefix}_SOCKET_CONNECT_TIMEOUT", "5")
            ),
        )

    @classmethod
    def from_url(cls, url: str, **kwargs) -> "RedisConfig":
        """从 Redis URL 创建配置"""
        from urllib.parse import urlparse

        parsed = urlparse(url)
        
        return cls(
            host=parsed.hostname or "localhost",
            port=parsed.port or 6379,
            db=int(parsed.path.lstrip("/")) if parsed.path else 0,
            password=parsed.password,
            username=parsed.username,
            **kwargs,
        )

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        config = {
            "host": self.host,
            "port": self.port,
            "db": self.db,
            "max_connections": self.max_connections,
            "socket_timeout": self.socket_timeout,
            "socket_connect_timeout": self.socket_connect_timeout,
            "socket_keepalive": self.socket_keepalive,
            "retry_on_timeout": self.retry_on_timeout,
            "decode_responses": self.decode_responses,
        }
        
        if self.password:
            config["password"] = self.password
        if self.username:
            config["username"] = self.username
            
        config.update(self.extra_options)
        return config


class RedisConnectionManager:
    """Redis 连接管理器"""

    def __init__(self, config: RedisConfig):
        """
        Args:
            config: Redis 配置
        """
        self.config = config
        self.logger = setup_logger(f"{__name__}.ConnectionManager")

        # 连接池和客户端
        self.pool: Optional[ConnectionPool] = None
        self.client: Optional[Redis] = None

        # 初始化标志
        self._initialized = False

    async def initialize(self) -> None:
        """初始化 Redis 连接"""
        if self._initialized:
            self.logger.warning("Redis connection already initialized")
            return

        try:
            # 创建连接池
            self.pool = ConnectionPool(**self.config.to_dict())

            # 创建客户端
            self.client = Redis(connection_pool=self.pool)

            # 测试连接
            await self._test_connection()

            self._initialized = True
            self.logger.info(
                "Redis connection initialized: %s:%s (db=%s)",
                self.config.host,
                self.config.port,
                self.config.db,
            )

        except Exception as e:
            self.logger.error("Failed to initialize Redis connection: %s", e)
            await self.cleanup()
            raise

    async def _test_connection(self) -> None:
        """测试 Redis 连接"""
        try:
            await self.client.ping()
            self.logger.info("Redis connection test successful")
        except Exception as e:
            self.logger.error("Redis connection test failed: %s", e)
            raise

    async def get_client(self) -> Redis:
        """获取 Redis 客户端"""
        if not self._initialized or not self.client:
            raise RuntimeError("Redis client not initialized")
        return self.client

    async def get_health_status(self) -> Dict[str, Any]:
        """获取 Redis 健康状态"""
        start_time = time.time()
        result = {
            "status": "unknown",
            "response_time_ms": 0,
            "error": None,
            "details": {},
        }

        try:
            if not self.client:
                raise RuntimeError("Redis client not initialized")

            # PING 测试
            await asyncio.wait_for(self.client.ping(), timeout=5.0)
            
            # 获取服务器信息
            info = await self.client.info()
            result["status"] = "healthy"
            result["details"] = {
                "version": info.get("redis_version", "unknown"),
                "used_memory_human": info.get("used_memory_human", "unknown"),
                "connected_clients": info.get("connected_clients", 0),
                "uptime_in_days": info.get("uptime_in_days", 0),
            }

        except asyncio.TimeoutError:
            result["status"] = "timeout"
            result["error"] = "Health check timed out after 5s"
        except (RuntimeError, ConnectionError, TimeoutError) as e:
            result["status"] = "unhealthy"
            result["error"] = str(e)
            self.logger.error("Redis health check failed: %s", e)

        result["response_time_ms"] = int((time.time() - start_time) * 1000)
        return result

    async def cleanup(self) -> None:
        """清理 Redis 连接"""
        if self.client:
            await self.client.close()
            self.client = None
            self.logger.info("Redis client closed")

        if self.pool:
            await self.pool.disconnect()
            self.pool = None
            self.logger.info("Redis connection pool disconnected")

        self._initialized = False
        self.logger.info("Redis connection cleanup completed")

    @property
    def is_initialized(self) -> bool:
        """检查是否已初始化"""
        return self._initialized

    def __repr__(self) -> str:
        return (
            f"RedisConnectionManager("
            f"host={self.config.host}, "
            f"port={self.config.port}, "
            f"db={self.config.db}, "
            f"initialized={self._initialized})"
        )


# 全局连接管理器实例
_redis_manager: Optional[RedisConnectionManager] = None


async def get_redis_manager() -> RedisConnectionManager:
    """获取全局 Redis 连接管理器"""
    global _redis_manager  # noqa: PLW0603

    if _redis_manager is None:
        # 从环境变量创建配置
        config = RedisConfig.from_env()
        _redis_manager = RedisConnectionManager(config)
        await _redis_manager.initialize()

    return _redis_manager


async def init_redis(config: Optional[RedisConfig] = None) -> RedisConnectionManager:
    """初始化 Redis 连接"""
    global _redis_manager  # noqa: PLW0603

    if _redis_manager is not None:
        await _redis_manager.cleanup()

    if config is None:
        config = RedisConfig.from_env()

    _redis_manager = RedisConnectionManager(config)
    await _redis_manager.initialize()

    return _redis_manager


async def cleanup_redis() -> None:
    """清理 Redis 连接"""
    global _redis_manager  # noqa: PLW0603

    if _redis_manager is not None:
        await _redis_manager.cleanup()
        _redis_manager = None

