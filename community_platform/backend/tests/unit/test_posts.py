"""
帖子模块单元测试
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.db.repositories.post import PostRepository
from app.db.repositories.comment import CommentRepository


@pytest.mark.unit
@pytest.mark.db
class TestPostModel:
    """帖子模型测试"""
    
    async def test_create_post(self, db_session: AsyncSession, test_user: User):
        """测试创建帖子"""
        post = Post(
            title="Test Post",
            content="This is a test post content.",
            author_id=test_user.id,
            is_published=True,
        )
        
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        
        # 验证帖子创建成功
        assert post.id is not None
        assert post.title == "Test Post"
        assert post.content == "This is a test post content."
        assert post.author_id == test_user.id
        assert post.is_published is True
        assert post.view_count == 0
        assert post.like_count == 0
        assert post.comment_count == 0
        assert post.created_at is not None
    
    async def test_post_with_tags(self, db_session: AsyncSession, test_user: User):
        """测试创建带标签的帖子"""
        post = Post(
            title="Test Post",
            content="Test content",
            author_id=test_user.id,
            tags=["python", "fastapi", "testing"],
        )
        
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        
        assert post.tags == ["python", "fastapi", "testing"]
    
    async def test_post_with_category(self, db_session: AsyncSession, test_user: User):
        """测试创建带分类的帖子"""
        post = Post(
            title="Test Post",
            content="Test content",
            author_id=test_user.id,
            category="技术",
        )
        
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        
        assert post.category == "技术"
    
    async def test_post_default_values(self, db_session: AsyncSession, test_user: User):
        """测试帖子默认值"""
        post = Post(
            title="Test Post",
            content="Test content",
            author_id=test_user.id,
        )
        
        # 验证默认值
        assert post.is_published is True
        assert post.view_count == 0
        assert post.like_count == 0
        assert post.comment_count == 0
        assert post.tags is None
        assert post.category is None


@pytest.mark.unit
@pytest.mark.db
class TestPostRepository:
    """帖子 Repository 测试"""
    
    async def test_get_by_id(self, db_session: AsyncSession, test_post: Post):
        """测试根据 ID 获取帖子"""
        post_repo = PostRepository(db_session)
        post = await post_repo.get_by_id(test_post.id)
        
        assert post is not None
        assert post.id == test_post.id
        assert post.title == test_post.title
        assert post.content == test_post.content
    
    async def test_get_by_id_not_found(self, db_session: AsyncSession):
        """测试获取不存在的帖子"""
        post_repo = PostRepository(db_session)
        post = await post_repo.get_by_id(99999)
        
        assert post is None
    
    async def test_create_post(self, db_session: AsyncSession, test_user: User):
        """测试创建帖子"""
        post_repo = PostRepository(db_session)
        
        post_data = {
            "title": "New Post",
            "content": "New post content",
            "author_id": test_user.id,
            "tags": ["test"],
        }
        
        post = await post_repo.create(post_data)
        
        assert post.id is not None
        assert post.title == "New Post"
        assert post.content == "New post content"
        assert post.author_id == test_user.id
        assert post.tags == ["test"]
    
    async def test_update_post(self, db_session: AsyncSession, test_post: Post):
        """测试更新帖子"""
        post_repo = PostRepository(db_session)
        
        # 更新帖子
        updated_post = await post_repo.update(
            test_post,
            {"title": "Updated Title", "content": "Updated content"}
        )
        
        assert updated_post.title == "Updated Title"
        assert updated_post.content == "Updated content"
        # 其他字段不变
        assert updated_post.author_id == test_post.author_id
    
    async def test_delete_post(self, db_session: AsyncSession, test_post: Post):
        """测试删除帖子"""
        post_repo = PostRepository(db_session)
        post_id = test_post.id
        
        # 删除帖子
        await post_repo.delete(test_post)
        
        # 验证帖子已被删除
        post = await post_repo.get_by_id(post_id)
        assert post is None
    
    async def test_list_posts(self, db_session: AsyncSession, test_posts: list[Post]):
        """测试获取帖子列表"""
        post_repo = PostRepository(db_session)
        
        posts = await post_repo.get_multi(skip=0, limit=10)
        
        assert len(posts) >= 5
    
    async def test_count_posts(self, db_session: AsyncSession, test_posts: list[Post]):
        """测试统计帖子数量"""
        post_repo = PostRepository(db_session)
        
        count = await post_repo.count()
        
        assert count >= 5
    
    async def test_get_posts_by_author(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_posts: list[Post]
    ):
        """测试获取指定作者的帖子"""
        post_repo = PostRepository(db_session)
        
        posts = await post_repo.get_multi(author_id=test_user.id, limit=10)
        
        assert len(posts) >= 5
        # 所有帖子都应该属于该作者
        for post in posts:
            assert post.author_id == test_user.id
    
    async def test_increment_view_count(
        self,
        db_session: AsyncSession,
        test_post: Post
    ):
        """测试增加浏览次数"""
        post_repo = PostRepository(db_session)
        initial_count = test_post.view_count
        
        # 更新浏览次数
        await post_repo.update(test_post, {"view_count": initial_count + 1})
        await db_session.refresh(test_post)
        
        assert test_post.view_count == initial_count + 1
    
    async def test_increment_like_count(
        self,
        db_session: AsyncSession,
        test_post: Post
    ):
        """测试增加点赞次数"""
        post_repo = PostRepository(db_session)
        initial_count = test_post.like_count
        
        # 更新点赞次数
        await post_repo.update(test_post, {"like_count": initial_count + 1})
        await db_session.refresh(test_post)
        
        assert test_post.like_count == initial_count + 1


@pytest.mark.unit
@pytest.mark.db
class TestCommentModel:
    """评论模型测试"""
    
    async def test_create_comment(
        self,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User
    ):
        """测试创建评论"""
        comment = Comment(
            content="This is a test comment.",
            post_id=test_post.id,
            author_id=test_user.id,
        )
        
        db_session.add(comment)
        await db_session.commit()
        await db_session.refresh(comment)
        
        # 验证评论创建成功
        assert comment.id is not None
        assert comment.content == "This is a test comment."
        assert comment.post_id == test_post.id
        assert comment.author_id == test_user.id
        assert comment.parent_id is None
        assert comment.like_count == 0
        assert comment.created_at is not None
    
    async def test_create_reply_comment(
        self,
        db_session: AsyncSession,
        test_comment: Comment,
        test_user: User
    ):
        """测试创建回复评论"""
        reply = Comment(
            content="This is a reply.",
            post_id=test_comment.post_id,
            author_id=test_user.id,
            parent_id=test_comment.id,
        )
        
        db_session.add(reply)
        await db_session.commit()
        await db_session.refresh(reply)
        
        assert reply.parent_id == test_comment.id
    
    async def test_comment_default_values(
        self,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User
    ):
        """测试评论默认值"""
        comment = Comment(
            content="Test comment",
            post_id=test_post.id,
            author_id=test_user.id,
        )
        
        # 验证默认值
        assert comment.parent_id is None
        assert comment.like_count == 0


@pytest.mark.unit
@pytest.mark.db
class TestCommentRepository:
    """评论 Repository 测试"""
    
    async def test_get_by_id(self, db_session: AsyncSession, test_comment: Comment):
        """测试根据 ID 获取评论"""
        comment_repo = CommentRepository(db_session)
        comment = await comment_repo.get_by_id(test_comment.id)
        
        assert comment is not None
        assert comment.id == test_comment.id
        assert comment.content == test_comment.content
    
    async def test_get_by_id_not_found(self, db_session: AsyncSession):
        """测试获取不存在的评论"""
        comment_repo = CommentRepository(db_session)
        comment = await comment_repo.get_by_id(99999)
        
        assert comment is None
    
    async def test_create_comment(
        self,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User
    ):
        """测试创建评论"""
        comment_repo = CommentRepository(db_session)
        
        comment_data = {
            "content": "New comment",
            "post_id": test_post.id,
            "author_id": test_user.id,
        }
        
        comment = await comment_repo.create(comment_data)
        
        assert comment.id is not None
        assert comment.content == "New comment"
        assert comment.post_id == test_post.id
        assert comment.author_id == test_user.id
    
    async def test_update_comment(
        self,
        db_session: AsyncSession,
        test_comment: Comment
    ):
        """测试更新评论"""
        comment_repo = CommentRepository(db_session)
        
        # 更新评论
        updated_comment = await comment_repo.update(
            test_comment,
            {"content": "Updated comment"}
        )
        
        assert updated_comment.content == "Updated comment"
    
    async def test_delete_comment(
        self,
        db_session: AsyncSession,
        test_comment: Comment
    ):
        """测试删除评论"""
        comment_repo = CommentRepository(db_session)
        comment_id = test_comment.id
        
        # 删除评论
        await comment_repo.delete(test_comment)
        
        # 验证评论已被删除
        comment = await comment_repo.get_by_id(comment_id)
        assert comment is None
    
    async def test_get_comments_by_post(
        self,
        db_session: AsyncSession,
        test_post: Post,
        test_comment: Comment
    ):
        """测试获取指定帖子的评论"""
        comment_repo = CommentRepository(db_session)
        
        comments = await comment_repo.get_multi(post_id=test_post.id, limit=10)
        
        assert len(comments) >= 1
        # 所有评论都应该属于该帖子
        for comment in comments:
            assert comment.post_id == test_post.id


@pytest.mark.unit
@pytest.mark.db
class TestPostRelationships:
    """帖子关系测试"""
    
    async def test_post_author_relationship(
        self,
        db_session: AsyncSession,
        test_post: Post,
        test_user: User
    ):
        """测试帖子和作者的关系"""
        post_repo = PostRepository(db_session)
        post = await post_repo.get_by_id(test_post.id)
        
        # 加载作者关系
        await db_session.refresh(post, ['author'])
        
        assert post.author is not None
        assert post.author.id == test_user.id
        assert post.author.username == test_user.username
    
    async def test_post_comments_relationship(
        self,
        db_session: AsyncSession,
        test_post: Post,
        test_comment: Comment
    ):
        """测试帖子和评论的关系"""
        post_repo = PostRepository(db_session)
        post = await post_repo.get_by_id(test_post.id)
        
        # 加载评论关系
        await db_session.refresh(post, ['comments'])
        
        assert len(post.comments) >= 1
        assert test_comment.id in [c.id for c in post.comments]


@pytest.mark.unit
@pytest.mark.db
class TestPostEdgeCases:
    """帖子边界情况测试"""
    
    async def test_create_post_without_author(self, db_session: AsyncSession):
        """测试创建没有作者的帖子"""
        post = Post(
            title="Test Post",
            content="Test content",
            # 缺少 author_id
        )
        
        db_session.add(post)
        
        # 应该抛出异常
        with pytest.raises(Exception):
            await db_session.commit()
    
    async def test_create_post_with_invalid_author(self, db_session: AsyncSession):
        """测试创建作者不存在的帖子"""
        post = Post(
            title="Test Post",
            content="Test content",
            author_id=99999,  # 不存在的作者
        )
        
        db_session.add(post)
        
        # 应该抛出异常（外键约束）
        with pytest.raises(Exception):
            await db_session.commit()
    
    async def test_unpublished_post(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试未发布的帖子"""
        post = Post(
            title="Draft Post",
            content="Draft content",
            author_id=test_user.id,
            is_published=False,
        )
        
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        
        assert post.is_published is False
    
    async def test_post_with_empty_tags(
        self,
        db_session: AsyncSession,
        test_user: User
    ):
        """测试空标签列表的帖子"""
        post = Post(
            title="Test Post",
            content="Test content",
            author_id=test_user.id,
            tags=[],
        )
        
        db_session.add(post)
        await db_session.commit()
        await db_session.refresh(post)
        
        assert post.tags == []
    
    async def test_comment_on_deleted_post(
        self,
        db_session: AsyncSession,
        test_post: Post,
        test_comment: Comment
    ):
        """测试删除帖子后评论的情况"""
        post_repo = PostRepository(db_session)
        comment_repo = CommentRepository(db_session)
        
        comment_id = test_comment.id
        
        # 删除帖子（应该级联删除评论）
        await post_repo.delete(test_post)
        
        # 验证评论也被删除
        comment = await comment_repo.get_by_id(comment_id)
        assert comment is None

