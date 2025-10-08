# zishu/database/connection.py

"""
数据库连接管理模块
支持异步连接池、健康检查、多数据库后端
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional, AsyncIterator
from urllib.parse import urlparse
import time

from sqlalchemy import text, create_engine, Engine
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool, QueuePool

from ..utils.logger import setup_logger
from ..utils.config_manager import ConfigManager


class DatabaseConfig:
    """数据库配置管理"""

    def __init__(
        self,
        url: str,
        pool_size: int = 20,
        max_overflow: int = 30,
        pool_timeout: int = 30,
        pool_recycle: int = 3600,
        echo: bool = False,
        echo_pool: bool = False,
        **kwargs,
    ):
        """
        Args:
            url: 数据库连接URL
            pool_size: 连接池基础大小
            max_overflow: 连接池最大溢出数量
            pool_timeout: 获取连接超时时间(秒)
            pool_recycle: 连接回收时间(秒)
            echo: 是否打印SQL语句
            echo_pool: 是否打印连接池日志
        """
        self.url = url
        self.pool_size = pool_size
        self.max_overflow = max_overflow
        self.pool_timeout = pool_timeout
        self.pool_recycle = pool_recycle
        self.echo = echo
        self.echo_pool = echo_pool
        self.extra_options = kwargs

        # 解析数据库类型
        parsed = urlparse(url)
        self.database_type = parsed.scheme.split("+")[0]
        self.is_async = "+asyncpg" in url or "+aiomysql" in url or "+aiosqlite" in url

    @classmethod
    def from_env(cls, prefix: str = "DATABASE") -> "DatabaseConfig":
        """从环境变量创建配置"""
        import os

        url = os.getenv(f"{prefix}_URL")
        if not url:
            raise ValueError(f"Missing {prefix}_URL environment variable")

        return cls(
            url=url,
            pool_size=int(os.getenv(f"{prefix}_POOL_SIZE", "20")),
            max_overflow=int(os.getenv(f"{prefix}_MAX_OVERFLOW", "30")),
            pool_timeout=int(os.getenv(f"{prefix}_POOL_TIMEOUT", "30")),
            pool_recycle=int(os.getenv(f"{prefix}_POOL_RECYCLE", "3600")),
            echo=os.getenv(f"{prefix}_ECHO", "false").lower() == "true",
            echo_pool=os.getenv(f"{prefix}_ECHO_POOL", "false").lower() == "true",
        )

    @classmethod
    def from_config_manager(
        cls, config_manager: ConfigManager, config_name: str = "database"
    ) -> "DatabaseConfig":
        """从配置管理器创建配置"""
        try:
            config = config_manager.get_config(config_name)
            return cls(**config)
        except (KeyError, ValueError, TypeError) as e:
            logger = setup_logger(__name__)
            logger.error("Failed to load database config from %s: %s", config_name, e)
            # 回退到环境变量
            return cls.from_env()


class DatabaseHealthChecker:
    """数据库健康检查器"""

    def __init__(self, connection_manager: "DatabaseConnectionManager"):
        self.connection_manager = connection_manager
        self.logger = setup_logger(f"{__name__}.HealthChecker")

    async def check_async_health(self, timeout: float = 5.0) -> Dict[str, Any]:
        """检查异步数据库连接健康状态"""
        start_time = time.time()
        result = {
            "status": "unknown",
            "response_time_ms": 0,
            "error": None,
            "details": {},
        }

        try:
            if not self.connection_manager.async_engine:
                raise RuntimeError("Async engine not initialized")

            # 执行简单查询测试连接
            async with asyncio.timeout(timeout):
                async with self.connection_manager.get_async_session() as session:
                    await session.execute(text("SELECT 1"))
                    await session.commit()

            result["status"] = "healthy"
            result["details"][
                "pool_size"
            ] = self.connection_manager.async_engine.pool.size()
            result["details"][
                "checked_out"
            ] = self.connection_manager.async_engine.pool.checkedout()

        except asyncio.TimeoutError:
            result["status"] = "timeout"
            result["error"] = "Health check timed out after %ss" % timeout
        except (RuntimeError, ConnectionError, TimeoutError) as e:
            result["status"] = "unhealthy"
            result["error"] = str(e)
            self.logger.error("Database health check failed: %s", e)

        result["response_time_ms"] = int((time.time() - start_time) * 1000)
        return result

    def check_sync_health(self, timeout: float = 5.0) -> Dict[str, Any]:  # noqa: ARG002
        """检查同步数据库连接健康状态"""
        start_time = time.time()
        result = {
            "status": "unknown",
            "response_time_ms": 0,
            "error": None,
            "details": {},
        }

        try:
            if not self.connection_manager.sync_engine:
                raise RuntimeError("Sync engine not initialized")

            # 执行简单查询测试连接
            with self.connection_manager.get_sync_session() as session:
                session.execute(text("SELECT 1"))
                session.commit()

            result["status"] = "healthy"
            result["details"][
                "pool_size"
            ] = self.connection_manager.sync_engine.pool.size()
            result["details"][
                "checked_out"
            ] = self.connection_manager.sync_engine.pool.checkedout()

        except (RuntimeError, ConnectionError) as e:
            result["status"] = "unhealthy"
            result["error"] = str(e)
            self.logger.error("Sync database health check failed: %s", e)

        result["response_time_ms"] = int((time.time() - start_time) * 1000)
        return result


class DatabaseConnectionManager:
    """数据库连接管理器"""

    def __init__(self, config: DatabaseConfig):
        """
        Args:
            config: 数据库配置
        """
        self.config = config
        self.logger = setup_logger(f"{__name__}.ConnectionManager")

        # 引擎和会话工厂
        self.async_engine: Optional[AsyncEngine] = None
        self.sync_engine: Optional[Engine] = None
        self.async_session_factory: Optional[async_sessionmaker] = None
        self.sync_session_factory: Optional[sessionmaker] = None

        # 健康检查器
        self.health_checker = DatabaseHealthChecker(self)

        # 初始化标志
        self._initialized = False

    async def initialize(self) -> None:
        """初始化数据库连接"""
        if self._initialized:
            self.logger.warning("Database connection already initialized")
            return

        try:
            await self._create_engines()
            self._create_session_factories()
            await self._test_connections()
            self._initialized = True
            self.logger.info("Database connection initialized successfully")

        except Exception as e:
            self.logger.error("Failed to initialize database connection: %s", e)
            await self.cleanup()
            raise

    async def _create_engines(self) -> None:
        """创建数据库引擎"""
        engine_kwargs = {
            "echo": self.config.echo,
            "echo_pool": self.config.echo_pool,
            **self.config.extra_options,
        }

        # 根据数据库类型设置连接池
        if self.config.database_type == "sqlite":
            # SQLite 特殊配置
            engine_kwargs.update(
                {
                    "poolclass": StaticPool,
                    "connect_args": {"check_same_thread": False},
                }
            )
        else:
            # PostgreSQL/MySQL 等使用连接池
            engine_kwargs.update(
                {
                    "poolclass": QueuePool,
                    "pool_size": self.config.pool_size,
                    "max_overflow": self.config.max_overflow,
                    "pool_timeout": self.config.pool_timeout,
                    "pool_recycle": self.config.pool_recycle,
                }
            )

        # 创建异步引擎
        if self.config.is_async:
            self.async_engine = create_async_engine(self.config.url, **engine_kwargs)
            self.logger.info("Created async engine: %s", self.config.database_type)

        # 创建同步引擎（用于迁移等）
        sync_url = self.config.url.replace("+asyncpg", "").replace("+aiomysql", "")
        self.sync_engine = create_engine(sync_url, **engine_kwargs)
        self.logger.info("Created sync engine: %s", self.config.database_type)

    def _create_session_factories(self) -> None:
        """创建会话工厂"""
        if self.async_engine:
            self.async_session_factory = async_sessionmaker(
                self.async_engine, class_=AsyncSession, expire_on_commit=False
            )

        if self.sync_engine:
            self.sync_session_factory = sessionmaker(
                self.sync_engine, class_=Session, expire_on_commit=False
            )

        self.logger.info("Session factories created")

    async def _test_connections(self) -> None:
        """测试数据库连接"""
        # 测试异步连接
        if self.async_engine:
            try:
                async with self.get_async_session() as session:
                    await session.execute(text("SELECT 1"))
                self.logger.info("Async database connection test successful")
            except Exception as e:
                self.logger.error("Async database connection test failed: %s", e)
                raise

        # 测试同步连接
        if self.sync_engine:
            try:
                with self.get_sync_session() as session:
                    session.execute(text("SELECT 1"))
                self.logger.info("Sync database connection test successful")
            except Exception as e:
                self.logger.error("Sync database connection test failed: %s", e)
                raise

    @asynccontextmanager
    async def get_async_session(self) -> AsyncIterator[AsyncSession]:
        """获取异步数据库会话（上下文管理器）"""
        if not self.async_session_factory:
            raise RuntimeError("Async session factory not initialized")

        async with self.async_session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    def get_sync_session(self):
        """获取同步数据库会话（上下文管理器）"""
        if not self.sync_session_factory:
            raise RuntimeError("Sync session factory not initialized")

        return self.sync_session_factory()

    def get_async_session_factory(self) -> async_sessionmaker:
        """获取异步会话工厂"""
        if not self.async_session_factory:
            raise RuntimeError("Async session factory not initialized")
        return self.async_session_factory

    def get_sync_session_factory(self) -> sessionmaker:
        """获取同步会话工厂"""
        if not self.sync_session_factory:
            raise RuntimeError("Sync session factory not initialized")
        return self.sync_session_factory

    async def execute_raw_sql(self, sql: str, params: Optional[Dict] = None) -> Any:
        """执行原始SQL语句（异步）"""
        async with self.get_async_session() as session:
            result = await session.execute(text(sql), params or {})
            await session.commit()
            return result

    def execute_raw_sql_sync(self, sql: str, params: Optional[Dict] = None) -> Any:
        """执行原始SQL语句（同步）"""
        with self.get_sync_session() as session:
            result = session.execute(text(sql), params or {})
            session.commit()
            return result

    async def get_health_status(self) -> Dict[str, Any]:
        """获取数据库健康状态"""
        result = {"overall_status": "healthy", "engines": {}}

        # 检查异步引擎
        if self.async_engine:
            async_health = await self.health_checker.check_async_health()
            result["engines"]["async"] = async_health
            if async_health["status"] != "healthy":
                result["overall_status"] = "degraded"

        # 检查同步引擎
        if self.sync_engine:
            sync_health = self.health_checker.check_sync_health()
            result["engines"]["sync"] = sync_health
            if sync_health["status"] != "healthy":
                result["overall_status"] = "degraded"

        return result

    async def cleanup(self) -> None:
        """清理数据库连接"""
        if self.async_engine:
            await self.async_engine.dispose()
            self.async_engine = None
            self.logger.info("Async engine disposed")

        if self.sync_engine:
            self.sync_engine.dispose()
            self.sync_engine = None
            self.logger.info("Sync engine disposed")

        self.async_session_factory = None
        self.sync_session_factory = None
        self._initialized = False
        self.logger.info("Database connection cleanup completed")

    @property
    def is_initialized(self) -> bool:
        """检查是否已初始化"""
        return self._initialized

    def __repr__(self) -> str:
        return (
            f"DatabaseConnectionManager("
            f"database_type={self.config.database_type}, "
            f"initialized={self._initialized})"
        )


# 全局连接管理器实例
_connection_manager: Optional[DatabaseConnectionManager] = None


async def get_database_manager() -> DatabaseConnectionManager:
    """获取全局数据库连接管理器"""
    global _connection_manager  # noqa: PLW0603

    if _connection_manager is None:
        # 从环境变量创建配置
        config = DatabaseConfig.from_env()
        _connection_manager = DatabaseConnectionManager(config)
        await _connection_manager.initialize()

    return _connection_manager


async def init_database(
    config: Optional[DatabaseConfig] = None,
) -> DatabaseConnectionManager:
    """初始化数据库连接"""
    global _connection_manager  # noqa: PLW0603

    if _connection_manager is not None:
        await _connection_manager.cleanup()

    if config is None:
        config = DatabaseConfig.from_env()

    _connection_manager = DatabaseConnectionManager(config)
    await _connection_manager.initialize()

    return _connection_manager


async def cleanup_database() -> None:
    """清理数据库连接"""
    global _connection_manager  # noqa: PLW0603

    if _connection_manager is not None:
        await _connection_manager.cleanup()
        _connection_manager = None


# FastAPI依赖函数
async def get_async_session() -> AsyncIterator[AsyncSession]:
    """FastAPI依赖：获取异步数据库会话"""
    manager = await get_database_manager()
    async with manager.get_async_session() as session:
        yield session
