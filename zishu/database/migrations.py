# zishu/database/migrations.py

"""
数据库迁移管理模块
基于Alembic实现数据库版本控制和迁移
"""

import os
from pathlib import Path
from typing import Optional, List, Dict, Any
import tempfile
import shutil

from alembic import command as alembic_command
from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from .connection import DatabaseConfig
from .base import Base
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class MigrationConfig:
    """迁移配置管理"""

    def __init__(
        self,
        database_config: DatabaseConfig,
        migration_dir: Optional[Path] = None,
        script_location: Optional[str] = None,
    ):
        """
        Args:
            database_config: 数据库配置
            migration_dir: 迁移文件目录
            script_location: Alembic脚本位置
        """
        self.database_config = database_config
        self.migration_dir = migration_dir or Path("migrations")
        self.script_location = script_location or str(self.migration_dir)

        # 确保迁移目录存在
        self.migration_dir.mkdir(parents=True, exist_ok=True)

    def get_alembic_config(self) -> AlembicConfig:
        """获取Alembic配置"""
        # 创建临时配置文件
        config_content = self._generate_alembic_ini()

        # 写入临时文件
        with tempfile.NamedTemporaryFile(mode="w", suffix=".ini", delete=False) as f:
            f.write(config_content)
            config_file = f.name

        try:
            # 创建Alembic配置
            alembic_cfg = AlembicConfig(config_file)

            # 设置脚本位置
            alembic_cfg.set_main_option("script_location", self.script_location)

            # 设置数据库URL (同步版本)
            sync_url = self.database_config.url.replace("+asyncpg", "").replace(
                "+aiomysql", ""
            )
            alembic_cfg.set_main_option("sqlalchemy.url", sync_url)

            return alembic_cfg

        finally:
            # 清理临时文件
            try:
                os.unlink(config_file)
            except OSError:
                pass

    def _generate_alembic_ini(self) -> str:
        """生成Alembic配置文件内容"""
        return f"""# Alembic配置文件 - 由Zishu自动生成

[alembic]
# 脚本位置
script_location = {self.script_location}

# 数据库URL占位符 (运行时设置)
sqlalchemy.url =

# 输出编码
output_encoding = utf-8

# 日志配置
[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
"""


class MigrationEnvironment:
    """迁移环境管理"""

    def __init__(self, migration_config: MigrationConfig):
        self.config = migration_config
        self.logger = setup_logger(f"{__name__}.Environment")

    def create_migration_environment(self) -> None:
        """创建迁移环境"""
        try:
            # 检查是否已经初始化
            versions_dir = self.config.migration_dir / "versions"
            if versions_dir.exists():
                self.logger.info("Migration environment already exists")
                return

            # 初始化Alembic环境
            alembic_cfg = self.config.get_alembic_config()
            alembic_command.init(alembic_cfg, str(self.config.migration_dir))

            # 创建自定义env.py
            self._create_env_py()

            self.logger.info(
                "Migration environment created at %s", self.config.migration_dir
            )

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to create migration environment: %s", e)
            raise

    def _create_env_py(self) -> None:
        """创建自定义env.py文件"""
        env_py_content = '''# env.py - Alembic环境配置
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# 导入模型基类
from zishu.database.base import Base

# Alembic配置对象
config = context.config

# 配置日志
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 设置目标元数据
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """离线模式运行迁移"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式运行迁移"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
'''

        env_py_path = self.config.migration_dir / "env.py"
        env_py_path.write_text(env_py_content, encoding="utf-8")


class MigrationManager:
    """迁移管理器"""

    def __init__(
        self, database_config: DatabaseConfig, migration_dir: Optional[Path] = None
    ):
        """
        Args:
            database_config: 数据库配置
            migration_dir: 迁移文件目录
        """
        self.database_config = database_config
        self.migration_config = MigrationConfig(database_config, migration_dir)
        self.environment = MigrationEnvironment(self.migration_config)
        self.logger = setup_logger(f"{__name__}.Manager")

        # 初始化迁移环境
        self.environment.create_migration_environment()

    def create_migration(
        self,
        message: str,
        autogenerate: bool = True,
        sql: bool = False,
        head: str = "head",
        splice: bool = False,
        branch_label: Optional[str] = None,
        version_path: Optional[str] = None,
        rev_id: Optional[str] = None,
    ) -> str:
        """创建新的迁移"""
        try:
            alembic_cfg = self.migration_config.get_alembic_config()

            # 执行迁移创建
            alembic_command.revision(
                alembic_cfg,
                message=message,
                autogenerate=autogenerate,
                sql=sql,
                head=head,
                splice=splice,
                branch_label=branch_label,
                version_path=version_path,
                rev_id=rev_id,
            )

            self.logger.info("Created migration: %s", message)

            # 获取最新迁移文件路径
            script_dir = ScriptDirectory.from_config(alembic_cfg)
            latest_revision = script_dir.get_current_head()

            return latest_revision

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to create migration '%s': %s", message, e)
            raise

    def upgrade(
        self, revision: str = "head", sql: bool = False, tag: Optional[str] = None
    ) -> None:
        """升级数据库"""
        try:
            alembic_cfg = self.migration_config.get_alembic_config()

            self.logger.info("Upgrading database to revision: %s", revision)
            alembic_command.upgrade(alembic_cfg, revision, sql=sql, tag=tag)

            self.logger.info("Database upgrade completed successfully")

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to upgrade database to %s: %s", revision, e)
            raise

    def downgrade(
        self, revision: str, sql: bool = False, tag: Optional[str] = None
    ) -> None:
        """降级数据库"""
        try:
            alembic_cfg = self.migration_config.get_alembic_config()

            self.logger.info("Downgrading database to revision: %s", revision)
            alembic_command.downgrade(alembic_cfg, revision, sql=sql, tag=tag)

            self.logger.info("Database downgrade completed successfully")

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to downgrade database to %s: %s", revision, e)
            raise

    def get_current_revision(self) -> Optional[str]:
        """获取当前数据库版本"""
        try:
            # 创建同步引擎
            sync_url = self.database_config.url.replace("+asyncpg", "").replace(
                "+aiomysql", ""
            )
            engine = create_engine(sync_url)

            with engine.connect() as connection:
                context = MigrationContext.configure(connection)
                current_rev = context.get_current_revision()

            return current_rev

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to get current revision: %s", e)
            return None

    def get_history(
        self, start: str = "base", end: str = "head"
    ) -> List[Dict[str, Any]]:
        """获取迁移历史"""
        try:
            alembic_cfg = self.migration_config.get_alembic_config()
            script_dir = ScriptDirectory.from_config(alembic_cfg)

            history = []
            for revision in script_dir.walk_revisions(start, end):
                history.append(
                    {
                        "revision": revision.revision,
                        "down_revision": revision.down_revision,
                        "branch_labels": revision.branch_labels,
                        "depends_on": revision.depends_on,
                        "doc": revision.doc,
                        "module": revision.module.__name__ if revision.module else None,
                    }
                )

            return history

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to get migration history: %s", e)
            return []

    def get_pending_migrations(self) -> List[str]:
        """获取待执行的迁移"""
        try:
            alembic_cfg = self.migration_config.get_alembic_config()
            script_dir = ScriptDirectory.from_config(alembic_cfg)

            current_rev = self.get_current_revision()
            head_rev = script_dir.get_current_head()

            if current_rev == head_rev:
                return []

            # 获取从当前版本到最新版本的所有迁移
            pending = []
            start = current_rev or "base"

            for revision in script_dir.walk_revisions(start, head_rev):
                if revision.revision != current_rev:
                    pending.append(revision.revision)

            return list(reversed(pending))  # 按执行顺序排序

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to get pending migrations: %s", e)
            return []

    def show_current_revision(self) -> Dict[str, Any]:
        """显示当前版本信息"""
        try:
            current_rev = self.get_current_revision()

            if not current_rev:
                return {"current": None, "message": "No migrations applied"}

            alembic_cfg = self.migration_config.get_alembic_config()
            script_dir = ScriptDirectory.from_config(alembic_cfg)

            try:
                revision_obj = script_dir.get_revision(current_rev)
                return {
                    "current": current_rev,
                    "message": revision_obj.doc,
                    "down_revision": revision_obj.down_revision,
                    "branch_labels": revision_obj.branch_labels,
                }
            except (KeyError, ValueError):
                return {"current": current_rev, "message": "Unknown revision"}

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to show current revision: %s", e)
            return {"error": str(e)}

    def validate_database_schema(self) -> Dict[str, Any]:
        """验证数据库架构与模型的一致性"""
        try:
            # 创建同步引擎
            sync_url = self.database_config.url.replace("+asyncpg", "").replace(
                "+aiomysql", ""
            )
            engine = create_engine(sync_url)

            # 检查数据库表
            inspector = inspect(engine)
            db_tables = set(inspector.get_table_names())

            # 检查模型表
            model_tables = set(Base.metadata.tables.keys())

            # 比较差异
            missing_in_db = model_tables - db_tables
            extra_in_db = db_tables - model_tables

            result = {
                "consistent": len(missing_in_db) == 0 and len(extra_in_db) == 0,
                "model_tables": list(model_tables),
                "database_tables": list(db_tables),
                "missing_in_database": list(missing_in_db),
                "extra_in_database": list(extra_in_db),
                "current_revision": self.get_current_revision(),
                "pending_migrations": self.get_pending_migrations(),
            }

            return result

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to validate database schema: %s", e)
            return {"error": str(e), "consistent": False}

    def init_database(self) -> None:
        """初始化数据库（创建所有表）"""
        try:
            self.logger.info("Initializing database...")

            # 创建同步引擎
            sync_url = self.database_config.url.replace("+asyncpg", "").replace(
                "+aiomysql", ""
            )
            engine = create_engine(sync_url)

            # 创建所有表
            Base.metadata.create_all(engine)

            # 标记为当前版本
            alembic_cfg = self.migration_config.get_alembic_config()
            alembic_command.stamp(alembic_cfg, "head")

            self.logger.info("Database initialization completed")

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to initialize database: %s", e)
            raise

    def reset_database(self, confirm: bool = False) -> None:
        """重置数据库（危险操作）"""
        if not confirm:
            raise ValueError("Database reset requires explicit confirmation")

        try:
            self.logger.warning("Resetting database - all data will be lost!")

            # 创建同步引擎
            sync_url = self.database_config.url.replace("+asyncpg", "").replace(
                "+aiomysql", ""
            )
            engine = create_engine(sync_url)

            # 删除所有表
            Base.metadata.drop_all(engine)

            # 重新创建
            Base.metadata.create_all(engine)

            # 重新标记版本
            alembic_cfg = self.migration_config.get_alembic_config()
            alembic_command.stamp(alembic_cfg, "head")

            self.logger.info("Database reset completed")

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to reset database: %s", e)
            raise

    def backup_database(self, backup_path: Path) -> None:
        """备份数据库（仅支持SQLite）"""
        if self.database_config.database_type != "sqlite":
            raise NotImplementedError("Database backup only supported for SQLite")

        try:
            # 获取SQLite数据库文件路径
            from urllib.parse import urlparse

            parsed = urlparse(self.database_config.url)
            db_path = Path(parsed.path)

            if not db_path.exists():
                raise FileNotFoundError(f"Database file not found: {db_path}")

            # 复制数据库文件
            shutil.copy2(db_path, backup_path)
            self.logger.info("Database backed up to: %s", backup_path)

        except (OSError, RuntimeError) as e:
            self.logger.error("Failed to backup database: %s", e)
            raise


# 工具函数
def create_migration_manager(
    database_config: Optional[DatabaseConfig] = None,
    migration_dir: Optional[Path] = None,
) -> MigrationManager:
    """创建迁移管理器"""
    if database_config is None:
        database_config = DatabaseConfig.from_env()

    return MigrationManager(database_config, migration_dir)


def auto_upgrade_database(database_config: Optional[DatabaseConfig] = None) -> None:
    """自动升级数据库到最新版本"""
    manager = create_migration_manager(database_config)

    try:
        # 检查待执行的迁移
        pending = manager.get_pending_migrations()

        if not pending:
            logger.info("Database is up to date")
            return

        logger.info("Found %d pending migrations", len(pending))

        # 执行升级
        manager.upgrade()

        logger.info("Database auto-upgrade completed")

    except (OSError, RuntimeError) as e:
        logger.error("Auto-upgrade failed: %s", e)
        raise


def check_database_health(
    database_config: Optional[DatabaseConfig] = None,
) -> Dict[str, Any]:
    """检查数据库健康状态"""
    manager = create_migration_manager(database_config)

    try:
        # 验证架构
        validation = manager.validate_database_schema()

        # 获取当前版本信息
        current_info = manager.show_current_revision()

        # 获取待执行迁移
        pending = manager.get_pending_migrations()

        return {
            "schema_validation": validation,
            "current_revision": current_info,
            "pending_migrations": pending,
            "migration_count": len(manager.get_history()),
            "status": "healthy"
            if validation.get("consistent", False) and not pending
            else "needs_migration",
        }

    except (OSError, RuntimeError) as e:
        logger.error("Database health check failed: %s", e)
        return {"status": "error", "error": str(e)}
