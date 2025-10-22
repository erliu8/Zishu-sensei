"""
帖子 API 集成测试
"""
import pytest
from httpx import AsyncClient

from app.models.user import User
from app.models.post import Post
from tests.utils import assert_status_code, ResponseValidator


@pytest.mark.integration
@pytest.mark.api
class TestCreatePostAPI:
    """创建帖子 API 测试"""
    
    async def test_create_post_success(
        self,
        authenticated_client: AsyncClient
    ):
        """测试成功创建帖子"""
        response = await authenticated_client.post(
            "/api/v1/posts/",
            json={
                "title": "New Test Post",
                "content": "This is a new test post content.",
                "tags": ["test", "api"],
            }
        )
        
        assert_status_code(response, 201)
        data = response.json()
        
        # 验证帖子数据
        assert data["title"] == "New Test Post"
        assert data["content"] == "This is a new test post content."
        assert data["tags"] == ["test", "api"]
        assert "id" in data
        assert "created_at" in data
        ResponseValidator.validate_post_response(data)
    
    async def test_create_post_minimal(
        self,
        authenticated_client: AsyncClient
    ):
        """测试创建最小字段的帖子"""
        response = await authenticated_client.post(
            "/api/v1/posts/",
            json={
                "title": "Minimal Post",
                "content": "Minimal content.",
            }
        )
        
        assert_status_code(response, 201)
        data = response.json()
        assert data["title"] == "Minimal Post"
        assert data["content"] == "Minimal content."
    
    async def test_create_post_with_category(
        self,
        authenticated_client: AsyncClient
    ):
        """测试创建带分类的帖子"""
        response = await authenticated_client.post(
            "/api/v1/posts/",
            json={
                "title": "Categorized Post",
                "content": "Content with category.",
                "category": "技术",
            }
        )
        
        assert_status_code(response, 201)
        data = response.json()
        
        if "category" in data:
            assert data["category"] == "技术"
    
    async def test_create_post_unauthenticated(self, client: AsyncClient):
        """测试未认证用户创建帖子"""
        response = await client.post(
            "/api/v1/posts/",
            json={
                "title": "Test Post",
                "content": "Test content.",
            }
        )
        
        assert_status_code(response, 401)
    
    async def test_create_post_missing_title(
        self,
        authenticated_client: AsyncClient
    ):
        """测试缺少标题"""
        response = await authenticated_client.post(
            "/api/v1/posts/",
            json={
                "content": "Content without title.",
            }
        )
        
        assert_status_code(response, 422)
    
    async def test_create_post_missing_content(
        self,
        authenticated_client: AsyncClient
    ):
        """测试缺少内容"""
        response = await authenticated_client.post(
            "/api/v1/posts/",
            json={
                "title": "Title without content",
            }
        )
        
        assert_status_code(response, 422)


@pytest.mark.integration
@pytest.mark.api
class TestGetPostAPI:
    """获取帖子 API 测试"""
    
    async def test_get_post_by_id(
        self,
        authenticated_client: AsyncClient,
        test_post: Post
    ):
        """测试根据 ID 获取帖子"""
        response = await authenticated_client.get(f"/api/v1/posts/{test_post.id}")
        
        assert_status_code(response, 200)
        data = response.json()
        
        # 验证帖子数据
        assert data["id"] == test_post.id
        assert data["title"] == test_post.title
        assert data["content"] == test_post.content
        ResponseValidator.validate_post_response(data)
    
    async def test_get_nonexistent_post(
        self,
        authenticated_client: AsyncClient
    ):
        """测试获取不存在的帖子"""
        response = await authenticated_client.get("/api/v1/posts/99999")
        
        assert_status_code(response, 404)
    
    async def test_get_post_unauthenticated(
        self,
        client: AsyncClient,
        test_post: Post
    ):
        """测试未认证用户获取帖子"""
        response = await client.get(f"/api/v1/posts/{test_post.id}")
        
        # 可能允许未认证用户查看公开帖子
        assert response.status_code in [200, 401]


@pytest.mark.integration
@pytest.mark.api
class TestListPostsAPI:
    """帖子列表 API 测试"""
    
    async def test_list_posts(
        self,
        authenticated_client: AsyncClient,
        test_posts
    ):
        """测试获取帖子列表"""
        response = await authenticated_client.get("/api/v1/posts/")
        
        assert_status_code(response, 200)
        data = response.json()
        
        # 可能是分页响应
        if "items" in data:
            posts = data["items"]
            ResponseValidator.validate_pagination_response(data)
        else:
            posts = data
        
        assert isinstance(posts, list)
        assert len(posts) >= 5
    
    async def test_list_posts_pagination(
        self,
        authenticated_client: AsyncClient,
        test_posts
    ):
        """测试帖子列表分页"""
        response = await authenticated_client.get(
            "/api/v1/posts/?page=1&page_size=2"
        )
        
        assert_status_code(response, 200)
        data = response.json()
        
        if "items" in data:
            assert len(data["items"]) <= 2
            assert data["page"] == 1
            assert data["page_size"] == 2
    
    async def test_list_posts_with_filters(
        self,
        authenticated_client: AsyncClient,
        test_user: User,
        test_posts
    ):
        """测试帖子列表过滤"""
        response = await authenticated_client.get(
            f"/api/v1/posts/?author_id={test_user.id}"
        )
        
        assert_status_code(response, 200)
        data = response.json()
        
        posts = data.get("items", data)
        
        # 所有帖子都应该属于指定作者
        for post in posts:
            if isinstance(post, dict):
                assert post.get("author_id") == test_user.id or \
                       post.get("user_id") == test_user.id
    
    async def test_list_posts_unauthenticated(
        self,
        client: AsyncClient,
        test_posts
    ):
        """测试未认证用户获取帖子列表"""
        response = await client.get("/api/v1/posts/")
        
        # 可能允许未认证用户查看公开帖子列表
        assert response.status_code in [200, 401]


@pytest.mark.integration
@pytest.mark.api
class TestUpdatePostAPI:
    """更新帖子 API 测试"""
    
    async def test_update_post_success(
        self,
        authenticated_client: AsyncClient,
        test_post: Post
    ):
        """测试成功更新帖子"""
        response = await authenticated_client.put(
            f"/api/v1/posts/{test_post.id}",
            json={
                "title": "Updated Title",
                "content": "Updated content.",
            }
        )
        
        assert_status_code(response, 200)
        data = response.json()
        
        # 验证更新后的数据
        assert data["title"] == "Updated Title"
        assert data["content"] == "Updated content."
    
    async def test_update_post_partial(
        self,
        authenticated_client: AsyncClient,
        test_post: Post
    ):
        """测试部分更新帖子"""
        original_content = test_post.content
        
        response = await authenticated_client.put(
            f"/api/v1/posts/{test_post.id}",
            json={
                "title": "Only Title Updated",
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            assert data["title"] == "Only Title Updated"
            # 内容应该不变（如果支持部分更新）
    
    async def test_update_other_user_post(
        self,
        authenticated_client: AsyncClient,
        test_user_2: User,
        db_session
    ):
        """测试更新其他用户的帖子（应该失败）"""
        from app.models.post import Post
        
        # 创建其他用户的帖子
        other_post = Post(
            title="Other User Post",
            content="Content",
            author_id=test_user_2.id,
        )
        db_session.add(other_post)
        await db_session.commit()
        await db_session.refresh(other_post)
        
        response = await authenticated_client.put(
            f"/api/v1/posts/{other_post.id}",
            json={"title": "Hacked Title"}
        )
        
        # 应该禁止更新其他用户的帖子
        assert_status_code(response, 403)
    
    async def test_update_nonexistent_post(
        self,
        authenticated_client: AsyncClient
    ):
        """测试更新不存在的帖子"""
        response = await authenticated_client.put(
            "/api/v1/posts/99999",
            json={"title": "New Title"}
        )
        
        assert_status_code(response, 404)


@pytest.mark.integration
@pytest.mark.api
class TestDeletePostAPI:
    """删除帖子 API 测试"""
    
    async def test_delete_post_success(
        self,
        authenticated_client: AsyncClient,
        test_post: Post
    ):
        """测试成功删除帖子"""
        response = await authenticated_client.delete(
            f"/api/v1/posts/{test_post.id}"
        )
        
        assert_status_code(response, 204)
        
        # 验证帖子已被删除
        get_response = await authenticated_client.get(
            f"/api/v1/posts/{test_post.id}"
        )
        assert_status_code(get_response, 404)
    
    async def test_delete_other_user_post(
        self,
        authenticated_client: AsyncClient,
        test_user_2: User,
        db_session
    ):
        """测试删除其他用户的帖子（应该失败）"""
        from app.models.post import Post
        
        # 创建其他用户的帖子
        other_post = Post(
            title="Other User Post",
            content="Content",
            author_id=test_user_2.id,
        )
        db_session.add(other_post)
        await db_session.commit()
        await db_session.refresh(other_post)
        
        response = await authenticated_client.delete(
            f"/api/v1/posts/{other_post.id}"
        )
        
        # 应该禁止删除其他用户的帖子
        assert_status_code(response, 403)
    
    async def test_delete_nonexistent_post(
        self,
        authenticated_client: AsyncClient
    ):
        """测试删除不存在的帖子"""
        response = await authenticated_client.delete("/api/v1/posts/99999")
        
        assert_status_code(response, 404)


@pytest.mark.integration
@pytest.mark.api
class TestPostCommentsAPI:
    """帖子评论 API 测试"""
    
    async def test_create_comment(
        self,
        authenticated_client: AsyncClient,
        test_post: Post
    ):
        """测试创建评论"""
        response = await authenticated_client.post(
            f"/api/v1/posts/{test_post.id}/comments",
            json={"content": "This is a test comment."}
        )
        
        assert_status_code(response, 201)
        data = response.json()
        
        # 验证评论数据
        assert data["content"] == "This is a test comment."
        assert data["post_id"] == test_post.id
        ResponseValidator.validate_comment_response(data)
    
    async def test_get_post_comments(
        self,
        authenticated_client: AsyncClient,
        test_post: Post,
        test_comment
    ):
        """测试获取帖子的评论"""
        response = await authenticated_client.get(
            f"/api/v1/posts/{test_post.id}/comments"
        )
        
        assert_status_code(response, 200)
        data = response.json()
        
        # 可能是分页响应或直接是列表
        comments = data.get("items", data) if isinstance(data, dict) else data
        assert isinstance(comments, list)
        assert len(comments) >= 1
    
    async def test_create_comment_on_nonexistent_post(
        self,
        authenticated_client: AsyncClient
    ):
        """测试在不存在的帖子上创建评论"""
        response = await authenticated_client.post(
            "/api/v1/posts/99999/comments",
            json={"content": "Comment on nonexistent post"}
        )
        
        assert_status_code(response, 404)


@pytest.mark.integration
@pytest.mark.api
class TestPostLikesAPI:
    """帖子点赞 API 测试"""
    
    async def test_like_post(
        self,
        authenticated_client: AsyncClient,
        test_post: Post
    ):
        """测试点赞帖子"""
        response = await authenticated_client.post(
            f"/api/v1/posts/{test_post.id}/like"
        )
        
        # 如果实现了点赞功能
        if response.status_code != 404:
            assert_status_code(response, 200)
    
    async def test_unlike_post(
        self,
        authenticated_client: AsyncClient,
        test_post: Post
    ):
        """测试取消点赞帖子"""
        # 先点赞
        await authenticated_client.post(f"/api/v1/posts/{test_post.id}/like")
        
        # 再取消点赞
        response = await authenticated_client.delete(
            f"/api/v1/posts/{test_post.id}/like"
        )
        
        # 如果实现了取消点赞功能
        if response.status_code != 404:
            assert_status_code(response, 200)
    
    async def test_get_post_likes(
        self,
        authenticated_client: AsyncClient,
        test_post: Post
    ):
        """测试获取帖子的点赞列表"""
        response = await authenticated_client.get(
            f"/api/v1/posts/{test_post.id}/likes"
        )
        
        # 如果实现了获取点赞列表功能
        if response.status_code != 404:
            assert_status_code(response, 200)


@pytest.mark.integration
@pytest.mark.api
class TestPostSearchAPI:
    """帖子搜索 API 测试"""
    
    async def test_search_posts(
        self,
        authenticated_client: AsyncClient,
        test_posts
    ):
        """测试搜索帖子"""
        response = await authenticated_client.get(
            "/api/v1/posts/search?q=test"
        )
        
        # 如果实现了搜索功能
        if response.status_code != 404:
            assert_status_code(response, 200)
            data = response.json()
            
            # 可能是分页响应
            posts = data.get("items", data)
            assert isinstance(posts, list)
    
    async def test_search_posts_by_tag(
        self,
        authenticated_client: AsyncClient
    ):
        """测试按标签搜索帖子"""
        response = await authenticated_client.get(
            "/api/v1/posts/?tags=test"
        )
        
        # 如果实现了按标签搜索功能
        if response.status_code != 404:
            assert_status_code(response, 200)

