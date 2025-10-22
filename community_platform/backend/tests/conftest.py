"""
测试配置和 Fixtures
"""
import asyncio
import os
from typing import AsyncGenerator, Generator
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config.settings import Settings
from app.db.session import Base, get_db
from app.db.redis import RedisClient
from main import app
from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment


# ==================== 测试配置 ====================

class TestSettings(Settings):
    """测试环境配置"""
    ENVIRONMENT: str = "testing"
    DEBUG: bool = True
    
    # 使用测试数据库
    POSTGRES_DB: str = "zishu_community_test"
    
    # Redis 测试数据库
    REDIS_DB: int = 1
    
    # 禁用限流
    RATE_LIMIT_ENABLED: bool = False
    
    # 缩短 token 过期时间以便测试
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7


@pytest.fixture(scope="session")
def test_settings() -> TestSettings:
    """测试配置"""
    return TestSettings()


# ==================== 数据库 Fixtures ====================

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine(test_settings: TestSettings):
    """测试数据库引擎"""
    engine = create_async_engine(
        test_settings.DATABASE_URL,
        poolclass=NullPool,  # 禁用连接池以便测试
        echo=False,
    )
    
    # 创建所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # 清理：删除所有表
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """数据库会话（每个测试函数都会创建新的会话）"""
    # 创建连接
    async with test_engine.connect() as connection:
        # 开始外层事务
        async with connection.begin() as transaction:
            # 创建会话并绑定到事务
            async_session = async_sessionmaker(
                bind=connection,
                class_=AsyncSession,
                expire_on_commit=False,
                join_transaction_mode="create_savepoint",  # 使用savepoint模式
            )
            
            async with async_session() as session:
                yield session
                # 测试结束后回滚整个事务
                await transaction.rollback()


# ==================== Redis Fixtures ====================

@pytest.fixture(scope="session")
async def test_redis(test_settings: TestSettings) -> AsyncGenerator[RedisClient, None]:
    """测试 Redis 客户端"""
    redis_client = RedisClient(
        host=test_settings.REDIS_HOST,
        port=test_settings.REDIS_PORT,
        db=test_settings.REDIS_DB,
        password=test_settings.REDIS_PASSWORD,
    )
    await redis_client.connect()
    
    yield redis_client
    
    # 清理：删除所有键
    if redis_client.redis:
        await redis_client.redis.flushdb()
    await redis_client.disconnect()


@pytest.fixture(scope="function")
async def redis_session(test_redis: RedisClient) -> AsyncGenerator[RedisClient, None]:
    """Redis 会话（每个测试函数后清空）"""
    yield test_redis
    # 每个测试后清空 Redis
    if test_redis.redis:
        await test_redis.redis.flushdb()


# ==================== FastAPI 应用 Fixtures ====================

@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """测试客户端"""
    
    # 重写依赖注入
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=True  # 自动跟随重定向
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def authenticated_client(
    client: AsyncClient,
    test_user: User
) -> AsyncGenerator[AsyncClient, None]:
    """已认证的测试客户端"""
    access_token = create_access_token(data={"sub": str(test_user.id)})
    client.headers["Authorization"] = f"Bearer {access_token}"
    yield client


# ==================== 测试数据 Fixtures ====================

@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """测试用户"""
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash=get_password_hash("password123"),
        full_name="Test User",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_user_2(db_session: AsyncSession) -> User:
    """第二个测试用户"""
    user = User(
        username="testuser2",
        email="test2@example.com",
        password_hash=get_password_hash("password123"),
        full_name="Test User 2",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_inactive_user(db_session: AsyncSession) -> User:
    """未激活的测试用户"""
    user = User(
        username="inactiveuser",
        email="inactive@example.com",
        password_hash=get_password_hash("password123"),
        full_name="Inactive User",
        is_active=False,
        is_verified=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_post(db_session: AsyncSession, test_user: User) -> Post:
    """测试帖子"""
    post = Post(
        title="Test Post",
        content="This is a test post content.",
        author_id=test_user.id,
        is_published=True,
    )
    db_session.add(post)
    await db_session.commit()
    await db_session.refresh(post)
    return post


@pytest.fixture
async def test_posts(db_session: AsyncSession, test_user: User) -> list[Post]:
    """多个测试帖子"""
    posts = []
    for i in range(5):
        post = Post(
            title=f"Test Post {i+1}",
            content=f"This is test post content {i+1}.",
            author_id=test_user.id,
            is_published=True,
        )
        db_session.add(post)
        posts.append(post)
    
    await db_session.commit()
    for post in posts:
        await db_session.refresh(post)
    return posts


@pytest.fixture
async def test_comment(
    db_session: AsyncSession,
    test_post: Post,
    test_user: User
) -> Comment:
    """测试评论"""
    comment = Comment(
        content="This is a test comment.",
        post_id=test_post.id,
        author_id=test_user.id,
    )
    db_session.add(comment)
    await db_session.commit()
    await db_session.refresh(comment)
    return comment


# ==================== 辅助函数 ====================

@pytest.fixture
def create_test_user_data():
    """创建测试用户数据的工厂函数"""
    def _create_user_data(
        username: str = "newuser",
        email: str = "newuser@example.com",
        password: str = "password123",
        full_name: str = "New User",
    ) -> dict:
        return {
            "username": username,
            "email": email,
            "password": password,
            "full_name": full_name,
        }
    return _create_user_data


@pytest.fixture
def create_test_post_data():
    """创建测试帖子数据的工厂函数"""
    def _create_post_data(
        title: str = "New Test Post",
        content: str = "This is a new test post content.",
        tags: list[str] = None,
    ) -> dict:
        data = {
            "title": title,
            "content": content,
        }
        if tags:
            data["tags"] = tags
        return data
    return _create_post_data


@pytest.fixture
def create_test_comment_data():
    """创建测试评论数据的工厂函数"""
    def _create_comment_data(
        content: str = "This is a test comment.",
        parent_id: int = None,
    ) -> dict:
        data = {"content": content}
        if parent_id:
            data["parent_id"] = parent_id
        return data
    return _create_comment_data
