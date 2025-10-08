# zishu/database/__init__.py

"""
Zishu-sensei 数据库模块
提供完整的数据库连接、模型、迁移和管理功能
"""

# 版本信息
__version__ = "1.0.0"
__author__ = "Zishu-sensei Team"

# 导入核心组件
from .connection import (
    DatabaseConfig,
    DatabaseConnectionManager,
    DatabaseHealthChecker,
    get_database_manager,
    init_database,
    cleanup_database,
    get_async_session,
)

from .base import (
    # 基础类
    Base,
    DatabaseBaseModel,
    BaseRepository,
    QueryBuilder,
    # 混入类
    TimestampMixin,
    SoftDeleteMixin,
    StatusMixin,
    AuditMixin,
    MetadataMixin,
    # 枚举
    RecordStatus,
    AuditAction,
    # Pydantic模型
    BaseSchema,
    TimestampSchema,
    BaseResponseSchema,
    BaseCreateSchema,
    BaseUpdateSchema,
)

from .migrations import (
    MigrationConfig,
    MigrationEnvironment,
    MigrationManager,
    create_migration_manager,
    auto_upgrade_database,
    check_database_health,
)

# 便捷导入
__all__ = [
    # 版本信息
    "__version__",
    "__author__",
    # 连接管理
    "DatabaseConfig",
    "DatabaseConnectionManager",
    "DatabaseHealthChecker",
    "get_database_manager",
    "init_database",
    "cleanup_database",
    "get_async_session",
    # 基础模型
    "Base",
    "DatabaseBaseModel",
    "BaseRepository",
    "QueryBuilder",
    # 混入类
    "TimestampMixin",
    "SoftDeleteMixin",
    "StatusMixin",
    "AuditMixin",
    "MetadataMixin",
    # 枚举
    "RecordStatus",
    "AuditAction",
    # Pydantic模型
    "BaseSchema",
    "TimestampSchema",
    "BaseResponseSchema",
    "BaseCreateSchema",
    "BaseUpdateSchema",
    # 迁移管理
    "MigrationConfig",
    "MigrationEnvironment",
    "MigrationManager",
    "create_migration_manager",
    "auto_upgrade_database",
    "check_database_health",
    # 便捷函数
    "setup_database",
    "create_tables",
    "get_repository",
]


# 便捷函数
async def setup_database(
    database_url: str = None,
    auto_upgrade: bool = True,
    create_if_not_exists: bool = True,
    **kwargs,
) -> DatabaseConnectionManager:
    """
    一键设置数据库

    Args:
        database_url: 数据库连接URL
        auto_upgrade: 是否自动升级到最新版本
        create_if_not_exists: 是否在数据库不存在时创建
        **kwargs: 其他数据库配置参数

    Returns:
        DatabaseConnectionManager: 数据库连接管理器
    """
    from ..utils.logger import setup_logger

    logger = setup_logger(f"{__name__}.setup")

    try:
        # 创建数据库配置
        if database_url:
            config = DatabaseConfig(url=database_url, **kwargs)
        else:
            config = DatabaseConfig.from_env()

        # 初始化连接管理器
        manager = await init_database(config)
        logger.info("Database connection initialized")

        # 创建迁移管理器
        migration_manager = MigrationManager(config)

        # 检查数据库状态
        health = check_database_health(config)

        if health["status"] == "error":
            if create_if_not_exists:
                logger.info("Initializing new database...")
                migration_manager.init_database()
            else:
                raise RuntimeError(f"Database error: {health.get('error')}")

        elif health["status"] == "needs_migration":
            if auto_upgrade:
                logger.info("Auto-upgrading database...")
                auto_upgrade_database(config)
            else:
                pending_count = len(health.get("pending_migrations", []))
                logger.warning(f"Database has {pending_count} pending migrations")

        logger.info("Database setup completed successfully")
        return manager

    except Exception as e:
        logger.error(f"Database setup failed: {e}")
        raise


def create_tables(database_config: DatabaseConfig = None) -> None:
    """
    创建所有数据库表

    Args:
        database_config: 数据库配置
    """
    if database_config is None:
        database_config = DatabaseConfig.from_env()

    migration_manager = MigrationManager(database_config)
    migration_manager.init_database()


def get_repository(model_class) -> BaseRepository:
    """
    获取模型的仓储实例

    Args:
        model_class: 模型类

    Returns:
        BaseRepository: 仓储实例
    """
    return BaseRepository(model_class)


# 模块级别的配置
class DatabaseModule:
    """数据库模块管理器"""

    def __init__(self):
        self._manager: DatabaseConnectionManager = None
        self._migration_manager: MigrationManager = None
        self._repositories = {}

    @property
    def manager(self) -> DatabaseConnectionManager:
        """获取连接管理器"""
        if self._manager is None:
            raise RuntimeError("Database not initialized. Call setup_database() first.")
        return self._manager

    @property
    def migration_manager(self) -> MigrationManager:
        """获取迁移管理器"""
        if self._migration_manager is None:
            raise RuntimeError("Migration manager not initialized.")
        return self._migration_manager

    def register_repository(self, model_class, repository_class=None):
        """注册模型仓储"""
        if repository_class is None:
            repository_class = BaseRepository

        self._repositories[model_class] = repository_class(model_class)

    def get_repository(self, model_class):
        """获取模型仓储"""
        if model_class not in self._repositories:
            self.register_repository(model_class)
        return self._repositories[model_class]

    async def initialize(self, config: DatabaseConfig = None):
        """初始化数据库模块"""
        if config is None:
            config = DatabaseConfig.from_env()

        self._manager = await init_database(config)
        self._migration_manager = MigrationManager(config)

    async def cleanup(self):
        """清理资源"""
        if self._manager:
            await self._manager.cleanup()
            self._manager = None
        self._migration_manager = None
        self._repositories.clear()


# 全局模块实例
db = DatabaseModule()

# 向后兼容的别名
database = db  # 别名
Database = DatabaseModule  # 类别名
