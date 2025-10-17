================
编码规范
================

本文档定义了 Zishu-Sensei 项目的编码规范和最佳实践。

Python 代码规范
================

风格指南
--------

遵循 **PEP 8** 和 **Google Python Style Guide**。

命名约定
~~~~~~~~

.. code-block:: python

    # 类名：大驼峰命名法
    class UserService:
        pass
    
    # 函数和变量：蛇形命名法
    def get_user_by_id(user_id: int) -> User:
        pass
    
    # 常量：全大写 + 下划线
    MAX_RETRY_COUNT = 3
    DEFAULT_TIMEOUT = 30
    
    # 私有成员：前缀单下划线
    class MyClass:
        def __init__(self):
            self._private_var = None
        
        def _private_method(self):
            pass
    
    # 内部使用：前缀双下划线
    class MyClass:
        def __init__(self):
            self.__internal_var = None

导入顺序
~~~~~~~~

.. code-block:: python

    # 1. 标准库
    import os
    import sys
    from typing import Dict, List, Optional
    
    # 2. 第三方库
    import numpy as np
    from fastapi import FastAPI, HTTPException
    from sqlalchemy import Column, Integer, String
    
    # 3. 本地模块
    from zishu.core.config import settings
    from zishu.adapters.base import BaseAdapter
    from zishu.utils.logger import logger

类型注解
--------

**强制要求**：所有公共函数和方法必须有类型注解。

.. code-block:: python

    from typing import Dict, List, Optional, Union, Any
    
    # 函数参数和返回值
    def process_data(
        data: List[Dict[str, Any]], 
        options: Optional[Dict[str, str]] = None
    ) -> Dict[str, Union[int, str]]:
        """处理数据
        
        Args:
            data: 输入数据列表
            options: 可选的配置选项
            
        Returns:
            处理结果字典
            
        Raises:
            ValueError: 当数据格式不正确时
        """
        if options is None:
            options = {}
        
        result = {"count": len(data), "status": "success"}
        return result
    
    # 类属性注解
    class UserService:
        """用户服务"""
        
        db_session: Any
        cache_timeout: int = 3600
        
        def __init__(self, db_session: Any) -> None:
            self.db_session = db_session

文档字符串
----------

使用 **Google 风格** 的 docstring：

.. code-block:: python

    def retrieve_documents(
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Document]:
        """检索相关文档
        
        使用向量相似度检索与查询最相关的文档。
        
        Args:
            query: 查询字符串
            top_k: 返回的文档数量，默认为 5
            filters: 可选的过滤条件，如 {"category": "tech"}
            
        Returns:
            文档对象列表，按相关性降序排列
            
        Raises:
            ValueError: 当 top_k 小于 1 时
            ConnectionError: 当无法连接向量数据库时
            
        Example:
            >>> docs = retrieve_documents("Python 教程", top_k=3)
            >>> print(docs[0].title)
            'Python 入门指南'
            
        Note:
            检索结果会被自动缓存 1 小时
            
        Warning:
            大量并发请求可能导致性能下降
        """
        if top_k < 1:
            raise ValueError("top_k must be at least 1")
        
        # 实现代码...
        return []

错误处理
--------

.. code-block:: python

    from typing import Optional
    from loguru import logger
    
    class UserNotFoundError(Exception):
        """用户未找到异常"""
        pass
    
    class DatabaseError(Exception):
        """数据库错误"""
        pass
    
    async def get_user(user_id: int) -> Optional[User]:
        """获取用户
        
        Args:
            user_id: 用户 ID
            
        Returns:
            用户对象，如果未找到返回 None
            
        Raises:
            DatabaseError: 数据库操作失败时
        """
        try:
            user = await db.query(User).filter(User.id == user_id).first()
            if user is None:
                logger.warning(f"User not found: {user_id}")
                return None
            return user
        except SQLAlchemyError as e:
            logger.error(f"Database error when fetching user {user_id}: {e}")
            raise DatabaseError(f"Failed to fetch user: {e}") from e
        except Exception as e:
            logger.exception(f"Unexpected error: {e}")
            raise

异步编程
--------

.. code-block:: python

    import asyncio
    from typing import List
    
    # 使用 async/await
    async def fetch_data(url: str) -> dict:
        """异步获取数据"""
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                return await response.json()
    
    # 并发执行
    async def fetch_multiple(urls: List[str]) -> List[dict]:
        """并发获取多个 URL"""
        tasks = [fetch_data(url) for url in urls]
        return await asyncio.gather(*tasks)
    
    # 超时控制
    async def fetch_with_timeout(url: str, timeout: int = 30) -> dict:
        """带超时的获取"""
        try:
            return await asyncio.wait_for(
                fetch_data(url),
                timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.error(f"Timeout fetching {url}")
            raise

代码组织
--------

**模块结构**：

.. code-block:: text

    zishu/
    ├── __init__.py
    ├── api/
    │   ├── __init__.py
    │   ├── main.py          # FastAPI 应用入口
    │   ├── routes/          # API 路由
    │   ├── schemas/         # Pydantic 模型
    │   └── services/        # 业务逻辑
    ├── adapters/
    │   ├── __init__.py
    │   ├── base.py          # 基类
    │   ├── core/
    │   ├── soft/
    │   └── hard/
    ├── models/              # ORM 模型
    ├── core/                # 核心模块
    └── utils/               # 工具函数

**单一职责原则**：

.. code-block:: python

    # ❌ 不好：一个类做太多事情
    class UserManager:
        def create_user(self, data):
            pass
        
        def send_email(self, user):
            pass
        
        def generate_report(self, user):
            pass
    
    # ✅ 好：职责分离
    class UserService:
        def create_user(self, data: UserCreate) -> User:
            """创建用户"""
            pass
    
    class EmailService:
        def send_welcome_email(self, user: User) -> None:
            """发送欢迎邮件"""
            pass
    
    class ReportService:
        def generate_user_report(self, user: User) -> Report:
            """生成用户报告"""
            pass

性能优化
========

数据库查询
----------

.. code-block:: python

    # ❌ N+1 查询问题
    users = await db.query(User).all()
    for user in users:
        # 每次循环都查询数据库
        posts = await db.query(Post).filter(Post.user_id == user.id).all()
    
    # ✅ 使用 join 或 eager loading
    from sqlalchemy.orm import joinedload
    
    users = await db.query(User).options(
        joinedload(User.posts)
    ).all()
    for user in users:
        posts = user.posts  # 已加载，无需额外查询

缓存策略
--------

.. code-block:: python

    from functools import lru_cache
    import hashlib
    
    @lru_cache(maxsize=128)
    def expensive_computation(x: int, y: int) -> int:
        """缓存计算结果"""
        return x ** y
    
    # 异步缓存
    from aiocache import cached
    
    @cached(ttl=3600)  # 缓存 1 小时
    async def get_user_profile(user_id: int) -> dict:
        """获取用户资料（带缓存）"""
        return await db.query(User).get(user_id)

批处理
------

.. code-block:: python

    # ❌ 逐个处理
    for item in items:
        await process_item(item)
    
    # ✅ 批量处理
    batch_size = 100
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        await process_batch(batch)

测试规范
========

单元测试
--------

.. code-block:: python

    import pytest
    from unittest.mock import Mock, patch, AsyncMock
    
    @pytest.fixture
    def mock_db():
        """模拟数据库会话"""
        return Mock()
    
    @pytest.mark.asyncio
    async def test_create_user(mock_db):
        """测试创建用户"""
        # Arrange
        service = UserService(mock_db)
        user_data = UserCreate(
            username="test",
            email="test@example.com"
        )
        
        # Act
        user = await service.create_user(user_data)
        
        # Assert
        assert user.username == "test"
        assert user.email == "test@example.com"
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

集成测试
--------

.. code-block:: python

    @pytest.mark.integration
    async def test_user_registration_flow():
        """测试用户注册流程（集成测试）"""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # 1. 注册用户
            response = await client.post("/api/v1/auth/register", json={
                "username": "newuser",
                "email": "new@example.com",
                "password": "secure_password"
            })
            assert response.status_code == 201
            
            # 2. 验证可以登录
            response = await client.post("/api/v1/auth/login", json={
                "username": "newuser",
                "password": "secure_password"
            })
            assert response.status_code == 200
            assert "access_token" in response.json()

测试覆盖率
----------

目标：**80% 以上的代码覆盖率**

.. code-block:: bash

    # 运行测试并生成覆盖率报告
    pytest --cov=zishu --cov-report=html --cov-report=term
    
    # 查看报告
    open htmlcov/index.html

安全规范
========

输入验证
--------

.. code-block:: python

    from pydantic import BaseModel, validator, constr
    
    class UserCreate(BaseModel):
        username: constr(min_length=3, max_length=50)
        email: str
        password: constr(min_length=8)
        
        @validator('email')
        def validate_email(cls, v):
            """验证邮箱格式"""
            import re
            pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(pattern, v):
                raise ValueError('Invalid email format')
            return v
        
        @validator('password')
        def validate_password(cls, v):
            """验证密码强度"""
            if not any(c.isupper() for c in v):
                raise ValueError('Password must contain uppercase letter')
            if not any(c.isdigit() for c in v):
                raise ValueError('Password must contain digit')
            return v

密码处理
--------

.. code-block:: python

    from passlib.context import CryptContext
    
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    def hash_password(password: str) -> str:
        """哈希密码"""
        return pwd_context.hash(password)
    
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """验证密码"""
        return pwd_context.verify(plain_password, hashed_password)

SQL 注入防护
------------

.. code-block:: python

    # ❌ 不安全：字符串拼接
    query = f"SELECT * FROM users WHERE id = {user_id}"
    
    # ✅ 安全：使用参数化查询
    from sqlalchemy import text
    
    query = text("SELECT * FROM users WHERE id = :user_id")
    result = await db.execute(query, {"user_id": user_id})

敏感数据
--------

.. code-block:: python

    # ❌ 不要在日志中记录敏感信息
    logger.info(f"User password: {password}")
    
    # ✅ 脱敏处理
    logger.info(f"User email: {email[:3]}***@{email.split('@')[1]}")
    
    # 使用环境变量存储密钥
    import os
    SECRET_KEY = os.getenv("SECRET_KEY")
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY must be set")

代码审查
========

审查清单
--------

**功能性**：

- [ ] 代码实现了需求
- [ ] 边界条件已处理
- [ ] 错误处理完善

**可维护性**：

- [ ] 代码清晰易读
- [ ] 命名有意义
- [ ] 适当的注释
- [ ] 文档字符串完整

**性能**：

- [ ] 无明显性能问题
- [ ] 数据库查询优化
- [ ] 适当使用缓存

**安全性**：

- [ ] 输入验证
- [ ] 权限检查
- [ ] 敏感数据保护

**测试**：

- [ ] 有对应的单元测试
- [ ] 测试覆盖核心逻辑
- [ ] 边界条件有测试

Git 提交规范
============

提交消息格式
------------

使用 **Conventional Commits** 规范：

.. code-block:: text

    <type>(<scope>): <subject>
    
    <body>
    
    <footer>

**类型 (type)**：

- ``feat``: 新功能
- ``fix``: 修复 bug
- ``docs``: 文档更新
- ``style``: 代码格式调整（不影响功能）
- ``refactor``: 重构
- ``perf``: 性能优化
- ``test``: 测试相关
- ``chore``: 构建/工具配置

**示例**：

.. code-block:: text

    feat(api): add user authentication endpoint
    
    - Implement JWT token generation
    - Add login and register endpoints
    - Add authentication middleware
    
    Closes #123

分支策略
--------

.. code-block:: text

    main                 # 生产环境
      ├── develop        # 开发环境
      │   ├── feature/user-auth
      │   ├── feature/rag-engine
      │   └── bugfix/login-error
      └── hotfix/critical-bug

工具配置
========

Black (代码格式化)
------------------

``pyproject.toml``:

.. code-block:: toml

    [tool.black]
    line-length = 88
    target-version = ['py38']
    include = '\.pyi?$'
    extend-exclude = '''
    /(
      \.eggs
      | \.git
      | \.venv
      | build
      | dist
    )/
    '''

Pylint (代码检查)
-----------------

``.pylintrc``:

.. code-block:: ini

    [MESSAGES CONTROL]
    disable=C0111,C0103,R0903
    
    [FORMAT]
    max-line-length=88
    
    [BASIC]
    good-names=i,j,k,ex,_,id

MyPy (类型检查)
---------------

``mypy.ini``:

.. code-block:: ini

    [mypy]
    python_version = 3.8
    warn_return_any = True
    warn_unused_configs = True
    disallow_untyped_defs = True
    
    [mypy-tests.*]
    disallow_untyped_defs = False

参考资源
========

- `PEP 8 <https://peps.python.org/pep-0008/>`_
- `Google Python Style Guide <https://google.github.io/styleguide/pyguide.html>`_
- `Conventional Commits <https://www.conventionalcommits.org/>`_
- `FastAPI Best Practices <https://fastapi.tiangolo.com/tutorial/>`_

