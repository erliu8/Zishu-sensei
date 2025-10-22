"""
Alembic 环境配置文件

这个文件用于配置 Alembic 的迁移环境。
支持离线和在线模式。
"""
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Connection
from alembic import context

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# 导入应用配置
from app.core.config.settings import settings

# 导入 Base 和所有模型（这很重要！）
from app.db.session import Base
from app.models import (
    User,
    Post,
    Comment,
    Like,
    Follow,
    Notification,
)

# Alembic Config 对象，提供对 .ini 文件中配置值的访问
config = context.config

# 设置数据库 URL（从环境变量读取）
config.set_main_option("sqlalchemy.url", settings.SYNC_DATABASE_URL)

# 解释 Python 日志配置文件的配置
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 添加模型的 MetaData 对象用于自动生成迁移
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    在 'offline' 模式下运行迁移。
    
    这将配置上下文仅使用 URL，而不是 Engine，
    尽管这里也接受 Engine。通过跳过 Engine 的创建，
    我们甚至不需要可用的 DBAPI。
    
    调用 context.execute() 将发出给定的字符串到脚本输出。
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # 比较类型以检测列类型更改
        compare_type=True,
        # 比较服务器默认值
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """执行迁移的核心函数"""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # 比较类型以检测列类型更改
        compare_type=True,
        # 比较服务器默认值
        compare_server_default=True,
        # 包括 schemas
        include_schemas=False,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    在 'online' 模式下运行迁移。
    
    在这种情况下，我们需要创建一个 Engine 并将连接与上下文关联。
    """
    # 创建同步引擎配置
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.SYNC_DATABASE_URL
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)

    connectable.dispose()


# 根据上下文判断使用哪种模式
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

