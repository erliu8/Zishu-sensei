"""
Alembic环境配置

负责配置数据库连接和迁移环境
"""

import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import context

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# 导入所有模型以确保它们被注册到MetaData
from zishu.database.base import Base
from zishu.models.user import (
    User,
    UserProfile,
    UserPermission,
    UserSession,
    UserPreference,
)
from zishu.models.adapter import (
    Adapter,
    AdapterVersion,
    AdapterDependency,
    AdapterCategory,
    AdapterDownload,
    AdapterRating,
)
from zishu.models.community import Forum, Topic, Post, Comment, Like, Follow
from zishu.models.file import File, FileVersion, FilePermission, FileShare
from zishu.models.packaging import (
    PackagingTask,
    BuildLog,
    BuildArtifact,
    PackageTemplate,
)
from zishu.models.conversation import (
    Conversation,
    Message,
    MessageAttachment,
    ConversationParticipant,
    ConversationContext,
)
from zishu.models.character import (
    Character,
    CharacterPersonality,
    CharacterExpression,
    CharacterVoice,
    CharacterModel,
)
from zishu.models.workflow import (
    Workflow,
    WorkflowNode,
    WorkflowEdge,
    WorkflowExecution,
    WorkflowTemplate,
)
from zishu.models.skill_installation import (
    SkillInstallation,
)

# Alembic配置对象
config = context.config

# 解释日志配置文件
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 目标MetaData，用于自动生成
target_metadata = Base.metadata


def get_database_url() -> str:
    """
    获取数据库连接URL

    优先级：
    1. 环境变量 DATABASE_URL
    2. 环境变量 ZISHU_DATABASE_URL
    3. alembic.ini中的配置

    Returns:
        str: 数据库连接URL
    """
    # 首先检查环境变量
    url = os.getenv("DATABASE_URL")
    if url:
        # 如果是同步URL，转换为异步URL
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("sqlite:///"):
            url = url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        return url

    # 检查项目特定的环境变量
    url = os.getenv("ZISHU_DATABASE_URL")
    if url:
        return url

    # 使用配置文件中的URL
    url = config.get_main_option("sqlalchemy.url")
    if url:
        return url

    # 默认开发数据库URL
    return "postgresql+asyncpg://zishu:zishu@localhost:5432/zishu_dev"


def run_migrations_offline() -> None:
    """
    在'离线'模式下运行迁移。

    这会配置上下文只使用URL而不需要创建引擎，
    尽管在这里也需要Engine，它仅用作
    Dialect的来源。

    通过跳过Engine创建，我们甚至不需要DBAPI可用。

    调用context.configure()时传递给它的字符串输出以及
    我们的目标元数据。
    """
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
        render_as_batch=True,  # 支持SQLite的批量操作
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """
    执行实际的迁移操作

    Args:
        connection: 数据库连接
    """
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
        render_as_batch=True,  # 支持SQLite的批量操作
        # 自定义命名约定，确保索引和约束名称一致
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        },
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """
    在异步模式下运行迁移。

    这种情况下我们需要创建引擎并将连接与上下文关联。
    """
    # 获取数据库URL
    database_url = get_database_url()

    # 创建异步引擎
    connectable = create_async_engine(
        database_url,
        poolclass=pool.NullPool,  # 迁移时不使用连接池
        echo=False,  # 在生产环境中设置为False
        future=True,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """
    在'在线'模式下运行迁移。

    在这种情况下我们需要创建引擎并将连接与上下文关联。
    """
    # 运行异步迁移
    asyncio.run(run_async_migrations())


# 根据上下文决定运行模式
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
