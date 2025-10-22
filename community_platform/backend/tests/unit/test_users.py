"""
用户模块单元测试
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.db.repositories.user import UserRepository
from app.core.security import get_password_hash, verify_password


@pytest.mark.unit
@pytest.mark.db
class TestUserModel:
    """用户模型测试"""
    
    async def test_create_user(self, db_session: AsyncSession):
        """测试创建用户"""
        user = User(
            username="newuser",
            email="newuser@example.com",
            password_hash=get_password_hash("password123"),
            full_name="New User",
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # 验证用户创建成功
        assert user.id is not None
        assert user.username == "newuser"
        assert user.email == "newuser@example.com"
        assert user.full_name == "New User"
        assert user.is_active is True
        assert user.is_verified is False
        assert user.created_at is not None
    
    async def test_user_password_hash(self, db_session: AsyncSession):
        """测试用户密码哈希"""
        password = "my_secret_password"
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash=get_password_hash(password),
        )
        
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # 密码哈希不应该等于明文密码
        assert user.password_hash != password
        # 应该能验证密码
        assert verify_password(password, user.password_hash) is True
    
    async def test_user_default_values(self, db_session: AsyncSession):
        """测试用户默认值"""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
        )
        
        # 验证默认值
        assert user.is_active is True
        assert user.is_verified is False
        assert user.full_name is None
        assert user.avatar_url is None
        assert user.bio is None


@pytest.mark.unit
@pytest.mark.db
class TestUserRepository:
    """用户 Repository 测试"""
    
    async def test_get_by_id(self, db_session: AsyncSession, test_user: User):
        """测试根据 ID 获取用户"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_id(test_user.id)
        
        assert user is not None
        assert user.id == test_user.id
        assert user.username == test_user.username
        assert user.email == test_user.email
    
    async def test_get_by_id_not_found(self, db_session: AsyncSession):
        """测试获取不存在的用户"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_id(99999)
        
        assert user is None
    
    async def test_get_by_username(self, db_session: AsyncSession, test_user: User):
        """测试根据用户名获取用户"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_username(test_user.username)
        
        assert user is not None
        assert user.id == test_user.id
        assert user.username == test_user.username
    
    async def test_get_by_username_not_found(self, db_session: AsyncSession):
        """测试根据不存在的用户名获取用户"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_username("nonexistent")
        
        assert user is None
    
    async def test_get_by_email(self, db_session: AsyncSession, test_user: User):
        """测试根据邮箱获取用户"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_email(test_user.email)
        
        assert user is not None
        assert user.id == test_user.id
        assert user.email == test_user.email
    
    async def test_get_by_email_not_found(self, db_session: AsyncSession):
        """测试根据不存在的邮箱获取用户"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_email("nonexistent@example.com")
        
        assert user is None
    
    async def test_get_by_username_or_email_with_username(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试根据用户名或邮箱获取用户（使用用户名）"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_username_or_email(test_user.username)
        
        assert user is not None
        assert user.id == test_user.id
    
    async def test_get_by_username_or_email_with_email(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试根据用户名或邮箱获取用户（使用邮箱）"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_username_or_email(test_user.email)
        
        assert user is not None
        assert user.id == test_user.id
    
    async def test_get_by_username_or_email_not_found(
        self,
        db_session: AsyncSession
    ):
        """测试根据用户名或邮箱获取不存在的用户"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_username_or_email("nonexistent")
        
        assert user is None
    
    async def test_username_exists(self, db_session: AsyncSession, test_user: User):
        """测试检查用户名是否存在"""
        user_repo = UserRepository(db_session)
        
        # 存在的用户名
        exists = await user_repo.username_exists(test_user.username)
        assert exists is True
        
        # 不存在的用户名
        exists = await user_repo.username_exists("nonexistent")
        assert exists is False
    
    async def test_email_exists(self, db_session: AsyncSession, test_user: User):
        """测试检查邮箱是否存在"""
        user_repo = UserRepository(db_session)
        
        # 存在的邮箱
        exists = await user_repo.email_exists(test_user.email)
        assert exists is True
        
        # 不存在的邮箱
        exists = await user_repo.email_exists("nonexistent@example.com")
        assert exists is False
    
    async def test_create_user(self, db_session: AsyncSession):
        """测试创建用户"""
        user_repo = UserRepository(db_session)
        
        user_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password_hash": get_password_hash("password123"),
            "full_name": "New User",
        }
        
        user = await user_repo.create(user_data)
        
        assert user.id is not None
        assert user.username == "newuser"
        assert user.email == "newuser@example.com"
        assert user.full_name == "New User"
    
    async def test_update_user(self, db_session: AsyncSession, test_user: User):
        """测试更新用户"""
        user_repo = UserRepository(db_session)
        
        # 更新用户信息
        updated_user = await user_repo.update(
            test_user,
            {"full_name": "Updated Name", "bio": "Updated bio"}
        )
        
        assert updated_user.full_name == "Updated Name"
        assert updated_user.bio == "Updated bio"
        # 其他字段不变
        assert updated_user.username == test_user.username
        assert updated_user.email == test_user.email
    
    async def test_delete_user(self, db_session: AsyncSession, test_user: User):
        """测试删除用户"""
        user_repo = UserRepository(db_session)
        user_id = test_user.id
        
        # 删除用户
        await user_repo.delete(test_user)
        
        # 验证用户已被删除
        user = await user_repo.get_by_id(user_id)
        assert user is None
    
    async def test_list_users(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_user_2: User
    ):
        """测试获取用户列表"""
        user_repo = UserRepository(db_session)
        
        users = await user_repo.get_multi(skip=0, limit=10)
        
        assert len(users) >= 2
        user_ids = [u.id for u in users]
        assert test_user.id in user_ids
        assert test_user_2.id in user_ids
    
    async def test_count_users(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_user_2: User
    ):
        """测试统计用户数量"""
        user_repo = UserRepository(db_session)
        
        count = await user_repo.count()
        
        assert count >= 2


@pytest.mark.unit
@pytest.mark.db
class TestUserRelationships:
    """用户关系测试"""
    
    async def test_user_posts_relationship(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_post
    ):
        """测试用户和帖子的关系"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_id(test_user.id)
        
        # 加载关系
        await db_session.refresh(user, ['posts'])
        
        assert len(user.posts) >= 1
        assert test_post.id in [p.id for p in user.posts]
    
    async def test_user_comments_relationship(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_comment
    ):
        """测试用户和评论的关系"""
        user_repo = UserRepository(db_session)
        user = await user_repo.get_by_id(test_user.id)
        
        # 加载关系
        await db_session.refresh(user, ['comments'])
        
        assert len(user.comments) >= 1
        assert test_comment.id in [c.id for c in user.comments]


@pytest.mark.unit
@pytest.mark.db
class TestUserEdgeCases:
    """用户边界情况测试"""
    
    async def test_create_user_with_duplicate_username(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试创建重复用户名的用户"""
        user = User(
            username=test_user.username,  # 重复的用户名
            email="different@example.com",
            password_hash="hashed_password",
        )
        
        db_session.add(user)
        
        # 应该抛出异常
        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()
    
    async def test_create_user_with_duplicate_email(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试创建重复邮箱的用户"""
        user = User(
            username="different_user",
            email=test_user.email,  # 重复的邮箱
            password_hash="hashed_password",
        )
        
        db_session.add(user)
        
        # 应该抛出异常
        with pytest.raises(Exception):  # IntegrityError
            await db_session.commit()
    
    async def test_user_with_long_username(self, db_session: AsyncSession):
        """测试创建用户名过长的用户"""
        user = User(
            username="a" * 100,  # 超过 50 字符的限制
            email="test@example.com",
            password_hash="hashed_password",
        )
        
        db_session.add(user)
        
        # 应该抛出异常
        with pytest.raises(Exception):
            await db_session.commit()
    
    async def test_inactive_user(self, db_session: AsyncSession, test_inactive_user: User):
        """测试未激活的用户"""
        assert test_inactive_user.is_active is False
        assert test_inactive_user.is_verified is False
    
    async def test_update_user_to_inactive(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试将用户设置为未激活"""
        user_repo = UserRepository(db_session)
        
        # 更新用户状态
        updated_user = await user_repo.update(test_user, {"is_active": False})
        
        assert updated_user.is_active is False

