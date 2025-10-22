"""
数据库集成测试
"""
import pytest
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.follow import Follow
from app.models.like import Like
from app.db.repositories.user import UserRepository
from app.db.repositories.post import PostRepository
from app.db.repositories.comment import CommentRepository


@pytest.mark.integration
@pytest.mark.db
class TestDatabaseConnection:
    """数据库连接测试"""
    
    async def test_database_connection(self, db_session: AsyncSession):
        """测试数据库连接"""
        # 执行简单查询
        result = await db_session.execute(select(1))
        value = result.scalar()
        
        assert value == 1
    
    async def test_database_tables_exist(self, db_session: AsyncSession):
        """测试数据库表是否存在"""
        # 查询用户表
        result = await db_session.execute(select(func.count()).select_from(User))
        count = result.scalar()
        
        # 表存在且可查询（即使为空）
        assert count is not None


@pytest.mark.integration
@pytest.mark.db
class TestDatabaseTransactions:
    """数据库事务测试"""
    
    async def test_commit_transaction(self, db_session: AsyncSession):
        """测试提交事务"""
        user = User(
            username="txtest",
            email="txtest@example.com",
            password_hash="hashed",
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # 验证数据已保存
        assert user.id is not None
        
        # 在新查询中也能找到
        result = await db_session.execute(
            select(User).where(User.username == "txtest")
        )
        found_user = result.scalar_one_or_none()
        assert found_user is not None
    
    async def test_rollback_transaction(self, db_session: AsyncSession):
        """测试回滚事务"""
        user = User(
            username="rollbacktest",
            email="rollback@example.com",
            password_hash="hashed",
        )
        
        db_session.add(user)
        await db_session.flush()  # 刷新但不提交
        
        # 用户应该在当前会话中可见
        result = await db_session.execute(
            select(User).where(User.username == "rollbacktest")
        )
        found_user = result.scalar_one_or_none()
        assert found_user is not None
        
        # 回滚
        await db_session.rollback()
        
        # 回滚后用户不应该存在
        result = await db_session.execute(
            select(User).where(User.username == "rollbacktest")
        )
        found_user = result.scalar_one_or_none()
        assert found_user is None


@pytest.mark.integration
@pytest.mark.db
class TestDatabaseConstraints:
    """数据库约束测试"""
    
    async def test_unique_constraint_username(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试用户名唯一约束"""
        duplicate_user = User(
            username=test_user.username,  # 重复的用户名
            email="different@example.com",
            password_hash="hashed",
        )
        
        db_session.add(duplicate_user)
        
        # 应该抛出唯一约束异常
        with pytest.raises(Exception):
            await db_session.commit()
    
    async def test_unique_constraint_email(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试邮箱唯一约束"""
        duplicate_user = User(
            username="differentuser",
            email=test_user.email,  # 重复的邮箱
            password_hash="hashed",
        )
        
        db_session.add(duplicate_user)
        
        # 应该抛出唯一约束异常
        with pytest.raises(Exception):
            await db_session.commit()
    
    async def test_foreign_key_constraint(self, db_session: AsyncSession):
        """测试外键约束"""
        post = Post(
            title="Test Post",
            content="Content",
            author_id=99999,  # 不存在的用户 ID
        )
        
        db_session.add(post)
        
        # 应该抛出外键约束异常
        with pytest.raises(Exception):
            await db_session.commit()
    
    async def test_not_null_constraint(self, db_session: AsyncSession):
        """测试非空约束"""
        user = User(
            username="testuser",
            email="test@example.com",
            # 缺少 password_hash（非空字段）
        )
        
        db_session.add(user)
        
        # 应该抛出非空约束异常
        with pytest.raises(Exception):
            await db_session.commit()


@pytest.mark.integration
@pytest.mark.db
class TestDatabaseCascade:
    """数据库级联操作测试"""
    
    async def test_cascade_delete_user_posts(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_post: Post
    ):
        """测试删除用户时级联删除帖子"""
        user_id = test_user.id
        post_id = test_post.id
        
        # 删除用户
        await db_session.delete(test_user)
        await db_session.commit()
        
        # 验证帖子也被删除
        result = await db_session.execute(
            select(Post).where(Post.id == post_id)
        )
        post = result.scalar_one_or_none()
        assert post is None
    
    async def test_cascade_delete_post_comments(
        self,
        db_session: AsyncSession,
        test_post: Post,
        test_comment: Comment
    ):
        """测试删除帖子时级联删除评论"""
        post_id = test_post.id
        comment_id = test_comment.id
        
        # 删除帖子
        await db_session.delete(test_post)
        await db_session.commit()
        
        # 验证评论也被删除
        result = await db_session.execute(
            select(Comment).where(Comment.id == comment_id)
        )
        comment = result.scalar_one_or_none()
        assert comment is None


@pytest.mark.integration
@pytest.mark.db
class TestDatabaseRelationships:
    """数据库关系测试"""
    
    async def test_user_posts_relationship(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_post: Post
    ):
        """测试用户和帖子的关系"""
        # 重新加载用户
        result = await db_session.execute(
            select(User).where(User.id == test_user.id)
        )
        user = result.scalar_one()
        
        # 加载帖子关系
        await db_session.refresh(user, ['posts'])
        
        # 验证关系
        assert len(user.posts) >= 1
        assert test_post.id in [p.id for p in user.posts]
    
    async def test_post_author_relationship(
        self,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User
    ):
        """测试帖子和作者的关系"""
        # 重新加载帖子
        result = await db_session.execute(
            select(Post).where(Post.id == test_post.id)
        )
        post = result.scalar_one()
        
        # 加载作者关系
        await db_session.refresh(post, ['author'])
        
        # 验证关系
        assert post.author is not None
        assert post.author.id == test_user.id
    
    async def test_post_comments_relationship(
        self,
        db_session: AsyncSession,
        test_post: Post,
        test_comment: Comment
    ):
        """测试帖子和评论的关系"""
        # 重新加载帖子
        result = await db_session.execute(
            select(Post).where(Post.id == test_post.id)
        )
        post = result.scalar_one()
        
        # 加载评论关系
        await db_session.refresh(post, ['comments'])
        
        # 验证关系
        assert len(post.comments) >= 1
        assert test_comment.id in [c.id for c in post.comments]


@pytest.mark.integration
@pytest.mark.db
class TestRepositoryOperations:
    """Repository 操作集成测试"""
    
    async def test_repository_create_and_get(self, db_session: AsyncSession):
        """测试 Repository 创建和获取"""
        user_repo = UserRepository(db_session)
        
        # 创建用户
        user_data = {
            "username": "repotest",
            "email": "repotest@example.com",
            "password_hash": "hashed",
        }
        user = await user_repo.create(user_data)
        
        # 获取用户
        fetched_user = await user_repo.get_by_id(user.id)
        
        assert fetched_user is not None
        assert fetched_user.username == "repotest"
    
    async def test_repository_update(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试 Repository 更新"""
        user_repo = UserRepository(db_session)
        
        # 更新用户
        updated_user = await user_repo.update(
            test_user,
            {"full_name": "Updated Name"}
        )
        
        # 验证更新
        assert updated_user.full_name == "Updated Name"
        
        # 从数据库重新获取验证
        fetched_user = await user_repo.get_by_id(test_user.id)
        assert fetched_user.full_name == "Updated Name"
    
    async def test_repository_delete(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试 Repository 删除"""
        user_repo = UserRepository(db_session)
        user_id = test_user.id
        
        # 删除用户
        await user_repo.delete(test_user)
        
        # 验证删除
        fetched_user = await user_repo.get_by_id(user_id)
        assert fetched_user is None
    
    async def test_repository_list_with_pagination(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_user_2: User
    ):
        """测试 Repository 分页列表"""
        user_repo = UserRepository(db_session)
        
        # 获取第一页（每页 1 条）
        users_page1 = await user_repo.get_multi(skip=0, limit=1)
        assert len(users_page1) == 1
        
        # 获取第二页
        users_page2 = await user_repo.get_multi(skip=1, limit=1)
        assert len(users_page2) >= 1
        
        # 两页的用户应该不同
        if len(users_page2) > 0:
            assert users_page1[0].id != users_page2[0].id


@pytest.mark.integration
@pytest.mark.db
class TestDatabasePerformance:
    """数据库性能测试"""
    
    async def test_bulk_insert_performance(self, db_session: AsyncSession):
        """测试批量插入性能"""
        import time
        
        # 创建多个用户
        users = []
        for i in range(100):
            user = User(
                username=f"bulkuser{i}",
                email=f"bulkuser{i}@example.com",
                password_hash="hashed",
            )
            users.append(user)
        
        start_time = time.time()
        db_session.add_all(users)
        await db_session.commit()
        end_time = time.time()
        
        # 批量插入应该在合理时间内完成（比如 5 秒）
        elapsed = end_time - start_time
        assert elapsed < 5.0, f"批量插入耗时 {elapsed} 秒，超过预期"
    
    async def test_query_performance(
        self,
        db_session: AsyncSession,
        test_posts
    ):
        """测试查询性能"""
        import time
        
        post_repo = PostRepository(db_session)
        
        start_time = time.time()
        posts = await post_repo.get_multi(skip=0, limit=100)
        end_time = time.time()
        
        # 查询应该在合理时间内完成
        elapsed = end_time - start_time
        assert elapsed < 1.0, f"查询耗时 {elapsed} 秒，超过预期"


@pytest.mark.integration
@pytest.mark.db
class TestDatabaseIndexes:
    """数据库索引测试"""
    
    async def test_username_index(self, db_session: AsyncSession):
        """测试用户名索引"""
        user_repo = UserRepository(db_session)
        
        # 创建测试用户
        user = await user_repo.create({
            "username": "indextest",
            "email": "indextest@example.com",
            "password_hash": "hashed",
        })
        
        # 使用索引查询应该很快
        import time
        start_time = time.time()
        found_user = await user_repo.get_by_username("indextest")
        end_time = time.time()
        
        assert found_user is not None
        # 索引查询应该很快（小于 0.1 秒）
        elapsed = end_time - start_time
        assert elapsed < 0.1
    
    async def test_email_index(self, db_session: AsyncSession):
        """测试邮箱索引"""
        user_repo = UserRepository(db_session)
        
        # 创建测试用户
        user = await user_repo.create({
            "username": "emailindextest",
            "email": "emailindex@example.com",
            "password_hash": "hashed",
        })
        
        # 使用索引查询应该很快
        import time
        start_time = time.time()
        found_user = await user_repo.get_by_email("emailindex@example.com")
        end_time = time.time()
        
        assert found_user is not None
        elapsed = end_time - start_time
        assert elapsed < 0.1

