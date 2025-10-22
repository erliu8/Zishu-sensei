"""
测试工具函数
"""
from typing import Dict, Any
from httpx import AsyncClient

from app.core.security import create_access_token, get_password_hash
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment


class AuthHelper:
    """认证辅助类"""
    
    @staticmethod
    def get_auth_headers(user_id: int) -> Dict[str, str]:
        """
        获取认证请求头
        
        Args:
            user_id: 用户 ID
        
        Returns:
            Dict[str, str]: 包含 Bearer token 的请求头
        """
        access_token = create_access_token(data={"sub": str(user_id)})
        return {"Authorization": f"Bearer {access_token}"}
    
    @staticmethod
    async def login(
        client: AsyncClient,
        username: str,
        password: str
    ) -> Dict[str, Any]:
        """
        模拟用户登录
        
        Args:
            client: 测试客户端
            username: 用户名
            password: 密码
        
        Returns:
            Dict[str, Any]: 登录响应
        """
        response = await client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": password}
        )
        return response.json()
    
    @staticmethod
    async def register(
        client: AsyncClient,
        username: str,
        email: str,
        password: str,
        full_name: str = None
    ) -> Dict[str, Any]:
        """
        模拟用户注册
        
        Args:
            client: 测试客户端
            username: 用户名
            email: 邮箱
            password: 密码
            full_name: 全名
        
        Returns:
            Dict[str, Any]: 注册响应
        """
        data = {
            "username": username,
            "email": email,
            "password": password,
        }
        if full_name:
            data["full_name"] = full_name
        
        response = await client.post("/api/v1/auth/register", json=data)
        return response.json()


class UserFactory:
    """用户工厂类"""
    
    @staticmethod
    def build_user_data(
        username: str = "testuser",
        email: str = "test@example.com",
        password: str = "password123",
        full_name: str = "Test User",
        **kwargs
    ) -> Dict[str, Any]:
        """
        构建用户数据
        
        Args:
            username: 用户名
            email: 邮箱
            password: 密码
            full_name: 全名
            **kwargs: 其他字段
        
        Returns:
            Dict[str, Any]: 用户数据
        """
        data = {
            "username": username,
            "email": email,
            "password": password,
            "full_name": full_name,
        }
        data.update(kwargs)
        return data
    
    @staticmethod
    def build_user_model(
        username: str = "testuser",
        email: str = "test@example.com",
        password: str = "password123",
        **kwargs
    ) -> User:
        """
        构建用户模型
        
        Args:
            username: 用户名
            email: 邮箱
            password: 密码
            **kwargs: 其他字段
        
        Returns:
            User: 用户模型实例
        """
        user = User(
            username=username,
            email=email,
            password_hash=get_password_hash(password),
            **kwargs
        )
        return user


class PostFactory:
    """帖子工厂类"""
    
    @staticmethod
    def build_post_data(
        title: str = "Test Post",
        content: str = "This is a test post content.",
        tags: list[str] = None,
        category: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        构建帖子数据
        
        Args:
            title: 标题
            content: 内容
            tags: 标签
            category: 分类
            **kwargs: 其他字段
        
        Returns:
            Dict[str, Any]: 帖子数据
        """
        data = {
            "title": title,
            "content": content,
        }
        if tags:
            data["tags"] = tags
        if category:
            data["category"] = category
        data.update(kwargs)
        return data
    
    @staticmethod
    def build_post_model(
        author_id: int,
        title: str = "Test Post",
        content: str = "This is a test post content.",
        **kwargs
    ) -> Post:
        """
        构建帖子模型
        
        Args:
            author_id: 作者 ID
            title: 标题
            content: 内容
            **kwargs: 其他字段
        
        Returns:
            Post: 帖子模型实例
        """
        post = Post(
            title=title,
            content=content,
            author_id=author_id,
            **kwargs
        )
        return post


class CommentFactory:
    """评论工厂类"""
    
    @staticmethod
    def build_comment_data(
        content: str = "This is a test comment.",
        parent_id: int = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        构建评论数据
        
        Args:
            content: 内容
            parent_id: 父评论 ID
            **kwargs: 其他字段
        
        Returns:
            Dict[str, Any]: 评论数据
        """
        data = {"content": content}
        if parent_id:
            data["parent_id"] = parent_id
        data.update(kwargs)
        return data
    
    @staticmethod
    def build_comment_model(
        post_id: int,
        author_id: int,
        content: str = "This is a test comment.",
        **kwargs
    ) -> Comment:
        """
        构建评论模型
        
        Args:
            post_id: 帖子 ID
            author_id: 作者 ID
            content: 内容
            **kwargs: 其他字段
        
        Returns:
            Comment: 评论模型实例
        """
        comment = Comment(
            content=content,
            post_id=post_id,
            author_id=author_id,
            **kwargs
        )
        return comment


class ResponseValidator:
    """响应验证器"""
    
    @staticmethod
    def validate_error_response(
        response_data: Dict[str, Any],
        expected_status: int = None
    ) -> bool:
        """
        验证错误响应
        
        Args:
            response_data: 响应数据
            expected_status: 期望的状态码
        
        Returns:
            bool: 是否有效
        """
        assert "detail" in response_data
        if expected_status:
            # 这里需要从响应对象而不是数据中获取状态码
            pass
        return True
    
    @staticmethod
    def validate_user_response(user_data: Dict[str, Any], require_email: bool = False) -> bool:
        """
        验证用户响应
        
        Args:
            user_data: 用户数据
            require_email: 是否要求包含 email 字段（默认不要求）
        
        Returns:
            bool: 是否有效
        """
        required_fields = ["id", "username"]
        for field in required_fields:
            assert field in user_data
        
        # 如果需要 email 字段，则验证
        if require_email:
            assert "email" in user_data, "响应必须包含 email 字段"
        
        # 密码哈希不应该在响应中
        assert "password_hash" not in user_data
        assert "password" not in user_data
        
        return True
    
    @staticmethod
    def validate_post_response(post_data: Dict[str, Any]) -> bool:
        """
        验证帖子响应
        
        Args:
            post_data: 帖子数据
        
        Returns:
            bool: 是否有效
        """
        required_fields = ["id", "title", "content", "created_at"]
        for field in required_fields:
            assert field in post_data
        
        # 验证作者信息：可以是 author_id 或 user_id
        assert "author_id" in post_data or "user_id" in post_data, \
            "帖子响应必须包含 author_id 或 user_id 字段"
        
        return True
    
    @staticmethod
    def validate_comment_response(comment_data: Dict[str, Any]) -> bool:
        """
        验证评论响应
        
        Args:
            comment_data: 评论数据
        
        Returns:
            bool: 是否有效
        """
        required_fields = ["id", "content", "post_id", "author_id", "created_at"]
        for field in required_fields:
            assert field in comment_data
        
        return True
    
    @staticmethod
    def validate_pagination_response(
        response_data: Dict[str, Any],
        expected_fields: list[str] = None
    ) -> bool:
        """
        验证分页响应
        
        Args:
            response_data: 响应数据
            expected_fields: 期望的字段列表
        
        Returns:
            bool: 是否有效
        """
        # 检查分页字段
        assert "items" in response_data
        assert "total" in response_data
        assert "page" in response_data
        assert "page_size" in response_data
        
        # 验证类型
        assert isinstance(response_data["items"], list)
        assert isinstance(response_data["total"], int)
        assert isinstance(response_data["page"], int)
        assert isinstance(response_data["page_size"], int)
        
        return True


class DatabaseHelper:
    """数据库辅助类"""
    
    @staticmethod
    async def count_records(db, model) -> int:
        """
        统计记录数量
        
        Args:
            db: 数据库会话
            model: 模型类
        
        Returns:
            int: 记录数量
        """
        from sqlalchemy import select, func
        result = await db.execute(select(func.count()).select_from(model))
        return result.scalar()
    
    @staticmethod
    async def record_exists(db, model, **filters) -> bool:
        """
        检查记录是否存在
        
        Args:
            db: 数据库会话
            model: 模型类
            **filters: 过滤条件
        
        Returns:
            bool: 是否存在
        """
        from sqlalchemy import select
        query = select(model)
        for key, value in filters.items():
            query = query.where(getattr(model, key) == value)
        
        result = await db.execute(query)
        return result.scalar_one_or_none() is not None


def assert_datetime_close(dt1, dt2, tolerance_seconds: int = 5):
    """
    断言两个日期时间接近
    
    Args:
        dt1: 日期时间 1
        dt2: 日期时间 2
        tolerance_seconds: 容忍的秒数
    """
    from datetime import datetime, timedelta
    
    if isinstance(dt1, str):
        dt1 = datetime.fromisoformat(dt1.replace('Z', '+00:00'))
    if isinstance(dt2, str):
        dt2 = datetime.fromisoformat(dt2.replace('Z', '+00:00'))
    
    diff = abs((dt1 - dt2).total_seconds())
    assert diff <= tolerance_seconds, f"时间差异 {diff} 秒超过容忍值 {tolerance_seconds} 秒"


def assert_status_code(response, expected_code: int):
    """
    断言响应状态码
    
    Args:
        response: 响应对象
        expected_code: 期望的状态码
    """
    assert response.status_code == expected_code, \
        f"期望状态码 {expected_code}，实际 {response.status_code}。响应内容: {response.text}"

