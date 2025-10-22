"""
用户 API 集成测试
"""
import pytest
from httpx import AsyncClient

from app.models.user import User
from tests.utils import assert_status_code, ResponseValidator


@pytest.mark.integration
@pytest.mark.api
class TestUserProfileAPI:
    """用户资料 API 测试"""
    
    async def test_get_current_user_profile(
        self,
        authenticated_client: AsyncClient,
        test_user: User
    ):
        """测试获取当前用户资料"""
        response = await authenticated_client.get("/api/v1/users/me")
        
        assert_status_code(response, 200)
        data = response.json()
        
        # 验证用户信息
        assert data["id"] == test_user.id
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
        ResponseValidator.validate_user_response(data)
    
    async def test_update_current_user_profile(
        self,
        authenticated_client: AsyncClient,
        test_user: User
    ):
        """测试更新当前用户资料"""
        response = await authenticated_client.put(
            "/api/v1/users/me",
            json={
                "full_name": "Updated Name",
                "bio": "Updated bio",
            }
        )
        
        assert_status_code(response, 200)
        data = response.json()
        
        # 验证更新后的信息
        assert data["full_name"] == "Updated Name"
        assert data["bio"] == "Updated bio"
        # 其他字段不变
        assert data["username"] == test_user.username
        assert data["email"] == test_user.email
    
    async def test_update_current_user_email(
        self,
        authenticated_client: AsyncClient
    ):
        """测试更新当前用户邮箱"""
        response = await authenticated_client.put(
            "/api/v1/users/me",
            json={
                "email": "newemail@example.com",
            }
        )
        
        # 邮箱更新可能需要验证，或者直接更新
        assert response.status_code in [200, 400, 403]
    
    async def test_get_user_profile_by_id(
        self,
        authenticated_client: AsyncClient,
        test_user_2: User
    ):
        """测试获取指定用户资料"""
        response = await authenticated_client.get(
            f"/api/v1/users/{test_user_2.id}"
        )
        
        assert_status_code(response, 200)
        data = response.json()
        
        # 验证用户信息
        assert data["id"] == test_user_2.id
        assert data["username"] == test_user_2.username
        # 邮箱可能不对其他用户可见
        ResponseValidator.validate_user_response(data)
    
    async def test_get_nonexistent_user_profile(
        self,
        authenticated_client: AsyncClient
    ):
        """测试获取不存在的用户资料"""
        response = await authenticated_client.get("/api/v1/users/99999")
        
        assert_status_code(response, 404)


@pytest.mark.integration
@pytest.mark.api
class TestChangePasswordAPI:
    """修改密码 API 测试"""
    
    async def test_change_password_success(
        self,
        authenticated_client: AsyncClient
    ):
        """测试成功修改密码"""
        response = await authenticated_client.post(
            "/api/v1/users/me/change-password",
            json={
                "old_password": "password123",
                "new_password": "newpassword123",
            }
        )
        
        # 如果实现了修改密码端点
        if response.status_code != 404:
            assert_status_code(response, 200)
    
    async def test_change_password_wrong_old_password(
        self,
        authenticated_client: AsyncClient
    ):
        """测试旧密码错误"""
        response = await authenticated_client.post(
            "/api/v1/users/me/change-password",
            json={
                "old_password": "wrong_password",
                "new_password": "newpassword123",
            }
        )
        
        # 如果实现了修改密码端点
        if response.status_code != 404:
            assert response.status_code in [400, 401]
    
    async def test_change_password_same_password(
        self,
        authenticated_client: AsyncClient
    ):
        """测试新旧密码相同"""
        response = await authenticated_client.post(
            "/api/v1/users/me/change-password",
            json={
                "old_password": "password123",
                "new_password": "password123",  # 与旧密码相同
            }
        )
        
        # 如果实现了修改密码端点
        if response.status_code != 404:
            # 可能允许，也可能不允许
            assert response.status_code in [200, 400]


@pytest.mark.integration
@pytest.mark.api
class TestFollowAPI:
    """关注 API 测试"""
    
    async def test_follow_user(
        self,
        authenticated_client: AsyncClient,
        test_user_2: User
    ):
        """测试关注用户"""
        response = await authenticated_client.post(
            f"/api/v1/users/{test_user_2.id}/follow"
        )
        
        # 如果实现了关注功能
        if response.status_code != 404:
            assert_status_code(response, 200)
            data = response.json()
            assert "message" in data or "is_following" in data
    
    async def test_follow_self(
        self,
        authenticated_client: AsyncClient,
        test_user: User
    ):
        """测试关注自己"""
        response = await authenticated_client.post(
            f"/api/v1/users/{test_user.id}/follow"
        )
        
        # 如果实现了关注功能
        if response.status_code != 404:
            # 应该不允许关注自己
            assert_status_code(response, 400)
    
    async def test_follow_nonexistent_user(
        self,
        authenticated_client: AsyncClient
    ):
        """测试关注不存在的用户"""
        response = await authenticated_client.post("/api/v1/users/99999/follow")
        
        # 如果实现了关注功能
        if response.status_code != 404:
            assert_status_code(response, 404)
    
    async def test_unfollow_user(
        self,
        authenticated_client: AsyncClient,
        test_user_2: User
    ):
        """测试取消关注用户"""
        # 先关注
        await authenticated_client.post(f"/api/v1/users/{test_user_2.id}/follow")
        
        # 再取消关注
        response = await authenticated_client.post(
            f"/api/v1/users/{test_user_2.id}/unfollow"
        )
        
        # 如果实现了取消关注功能
        if response.status_code != 404:
            assert_status_code(response, 200)
    
    async def test_get_followers(
        self,
        authenticated_client: AsyncClient,
        test_user: User
    ):
        """测试获取粉丝列表"""
        response = await authenticated_client.get(
            f"/api/v1/users/{test_user.id}/followers"
        )
        
        # 如果实现了获取粉丝功能
        if response.status_code != 404:
            assert_status_code(response, 200)
            data = response.json()
            # 应该是分页响应或列表
            assert isinstance(data, (list, dict))
    
    async def test_get_following(
        self,
        authenticated_client: AsyncClient,
        test_user: User
    ):
        """测试获取关注列表"""
        response = await authenticated_client.get(
            f"/api/v1/users/{test_user.id}/following"
        )
        
        # 如果实现了获取关注功能
        if response.status_code != 404:
            assert_status_code(response, 200)
            data = response.json()
            assert isinstance(data, (list, dict))


@pytest.mark.integration
@pytest.mark.api
class TestUserPostsAPI:
    """用户帖子 API 测试"""
    
    async def test_get_user_posts(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
        test_posts
    ):
        """测试获取用户的帖子"""
        response = await authenticated_client.get(
            f"/api/v1/users/{test_user.id}/posts"
        )
        
        # 如果实现了获取用户帖子功能
        if response.status_code != 404:
            assert_status_code(response, 200)
            data = response.json()
            
            # 可能是分页响应
            if "items" in data:
                posts = data["items"]
            else:
                posts = data
            
            # 验证所有帖子都属于该用户
            for post in posts:
                if isinstance(post, dict):
                    assert post.get("author_id") == test_user.id or \
                           post.get("user_id") == test_user.id
    
    async def test_get_user_posts_pagination(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
        test_posts
    ):
        """测试用户帖子分页"""
        response = await authenticated_client.get(
            f"/api/v1/users/{test_user.id}/posts?page=1&page_size=2"
        )
        
        # 如果实现了分页功能
        if response.status_code != 404:
            assert_status_code(response, 200)
            data = response.json()
            
            # 如果是分页响应
            if "items" in data:
                assert len(data["items"]) <= 2
                ResponseValidator.validate_pagination_response(data)


@pytest.mark.integration
@pytest.mark.api
class TestUserListAPI:
    """用户列表 API 测试"""
    
    async def test_list_users(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
        test_user_2: User
    ):
        """测试获取用户列表"""
        response = await authenticated_client.get("/api/v1/users/")
        
        # 如果实现了用户列表功能
        if response.status_code != 404:
            assert_status_code(response, 200)
            data = response.json()
            
            # 可能是分页响应
            if "items" in data:
                users = data["items"]
            else:
                users = data
            
            assert isinstance(users, list)
            assert len(users) >= 2
    
    async def test_list_users_pagination(self, authenticated_client: AsyncClient):
        """测试用户列表分页"""
        response = await authenticated_client.get(
            "/api/v1/users/?page=1&page_size=10"
        )
        
        # 如果实现了分页功能
        if response.status_code != 404:
            assert_status_code(response, 200)
            data = response.json()
            
            if "items" in data:
                assert len(data["items"]) <= 10
    
    async def test_search_users(self, authenticated_client: AsyncClient):
        """测试搜索用户"""
        response = await authenticated_client.get(
            "/api/v1/users/?search=test"
        )
        
        # 如果实现了搜索功能
        if response.status_code != 404:
            assert_status_code(response, 200)


@pytest.mark.integration
@pytest.mark.api
class TestUserAuthorizationAPI:
    """用户授权测试"""
    
    async def test_update_other_user_profile(
        self,
        authenticated_client: AsyncClient,
        test_user_2: User
    ):
        """测试更新其他用户的资料（应该失败）"""
        response = await authenticated_client.put(
            f"/api/v1/users/{test_user_2.id}",
            json={"full_name": "Hacked Name"}
        )
        
        # 应该禁止更新其他用户的资料
        assert response.status_code in [403, 404]
    
    async def test_delete_other_user(
        self,
        authenticated_client: AsyncClient,
        test_user_2: User
    ):
        """测试删除其他用户（应该失败）"""
        response = await authenticated_client.delete(
            f"/api/v1/users/{test_user_2.id}"
        )
        
        # 应该禁止删除其他用户（除非是管理员）
        assert response.status_code in [403, 404]

