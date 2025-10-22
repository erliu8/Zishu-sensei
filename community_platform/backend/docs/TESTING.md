# 测试文档

## 目录

- [概述](#概述)
- [测试架构](#测试架构)
- [快速开始](#快速开始)
- [测试分类](#测试分类)
- [运行测试](#运行测试)
- [编写测试](#编写测试)
- [测试覆盖率](#测试覆盖率)
- [持续集成](#持续集成)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

## 概述

本项目使用 **pytest** 作为测试框架，包含完整的单元测试、集成测试和 API 测试。

### 测试框架

- **pytest**: 主测试框架
- **pytest-asyncio**: 异步测试支持
- **pytest-cov**: 代码覆盖率
- **httpx**: HTTP 客户端测试

### 测试统计

```
📊 测试覆盖范围:
  - 单元测试: 80+ 个测试用例
  - 集成测试: 60+ 个测试用例
  - API 测试: 50+ 个测试用例
  - 总计: 190+ 个测试用例
```

## 测试架构

### 目录结构

```
tests/
├── conftest.py              # 全局 fixtures 和配置
├── utils.py                 # 测试工具函数
├── unit/                    # 单元测试
│   ├── test_security.py     # 安全模块测试
│   ├── test_users.py        # 用户模块测试
│   └── test_posts.py        # 帖子模块测试
└── integration/             # 集成测试
    ├── test_api_auth.py     # 认证 API 测试
    ├── test_api_users.py    # 用户 API 测试
    ├── test_api_posts.py    # 帖子 API 测试
    └── test_database.py     # 数据库集成测试
```

### 测试层次

```
┌─────────────────────────────────────────┐
│           API 端点测试 (E2E)            │
├─────────────────────────────────────────┤
│          集成测试 (Integration)         │
├─────────────────────────────────────────┤
│           单元测试 (Unit)               │
├─────────────────────────────────────────┤
│        业务逻辑 (Application)           │
└─────────────────────────────────────────┘
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置测试数据库

测试会自动使用测试数据库 `zishu_community_test`。确保 PostgreSQL 正在运行：

```bash
# 启动数据库服务
docker-compose up -d postgres redis qdrant
```

### 3. 运行测试

```bash
# 运行所有测试
make test

# 或使用 pytest 直接运行
pytest
```

## 测试分类

### 按类型分类

#### 1. 单元测试 (Unit Tests)

测试独立的函数、类和模块。

```bash
# 运行所有单元测试
make test-unit

# 或
pytest tests/unit/ -v -m unit
```

**示例：**
- 密码哈希和验证
- JWT 令牌生成和解码
- 数据模型创建和验证
- Repository 方法

#### 2. 集成测试 (Integration Tests)

测试多个组件之间的交互。

```bash
# 运行所有集成测试
make test-integration

# 或
pytest tests/integration/ -v -m integration
```

**示例：**
- API 端点完整流程
- 数据库事务
- 外部服务集成

#### 3. API 测试

测试 REST API 端点。

```bash
# 运行 API 测试
make test-api

# 或
pytest tests/integration/ -v -m api
```

### 按功能模块分类

```bash
# 认证测试
make test-auth

# 数据库测试
make test-db
```

### 按速度分类

```bash
# 快速测试（排除慢速测试）
make test-fast

# 慢速测试
make test-slow
```

## 运行测试

### 基础命令

```bash
# 运行所有测试
make test

# 运行单元测试
make test-unit

# 运行集成测试
make test-integration

# 运行 API 测试
make test-api
```

### 高级命令

```bash
# 运行测试并生成覆盖率报告
make test-cov

# 并行运行测试（更快）
make test-parallel

# 只运行上次失败的测试
make test-failed

# 详细输出
make test-verbose

# 安静模式
make test-quiet
```

### 运行特定测试

```bash
# 运行特定文件
make test-specific FILE=tests/unit/test_security.py

# 运行特定测试类
pytest tests/unit/test_security.py::TestPasswordHashing -v

# 运行特定测试方法
pytest tests/unit/test_security.py::TestPasswordHashing::test_hash_password -v

# 使用关键字过滤
pytest tests/ -k "password" -v
```

### 使用标记 (Markers)

```bash
# 运行特定标记的测试
pytest tests/ -m unit         # 单元测试
pytest tests/ -m integration  # 集成测试
pytest tests/ -m api          # API 测试
pytest tests/ -m db           # 数据库测试
pytest tests/ -m auth         # 认证测试
pytest tests/ -m slow         # 慢速测试

# 组合标记
pytest tests/ -m "unit and auth"        # 单元测试 AND 认证测试
pytest tests/ -m "api and not slow"     # API 测试但不包括慢速测试
```

## 编写测试

### 测试文件命名规范

- 单元测试: `test_<module_name>.py`
- 集成测试: `test_api_<feature>.py` 或 `test_<integration_type>.py`
- 测试类: `Test<FeatureName>`
- 测试方法: `test_<specific_behavior>`

### 单元测试示例

```python
"""
模块单元测试
"""
import pytest

from app.core.security import get_password_hash, verify_password


@pytest.mark.unit
class TestPasswordHashing:
    """密码哈希测试"""
    
    def test_hash_password(self):
        """测试密码哈希"""
        password = "my_secret_password"
        hashed = get_password_hash(password)
        
        assert hashed != password
        assert isinstance(hashed, str)
        assert len(hashed) > len(password)
    
    def test_verify_password_correct(self):
        """测试验证正确的密码"""
        password = "my_secret_password"
        hashed = get_password_hash(password)
        
        assert verify_password(password, hashed) is True
```

### 集成测试示例

```python
"""
API 集成测试
"""
import pytest
from httpx import AsyncClient

from app.models.user import User


@pytest.mark.integration
@pytest.mark.api
class TestUserAPI:
    """用户 API 测试"""
    
    async def test_get_current_user(
        self,
        authenticated_client: AsyncClient,
        test_user: User
    ):
        """测试获取当前用户"""
        response = await authenticated_client.get("/api/v1/users/me")
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["username"] == test_user.username
```

### 使用 Fixtures

```python
async def test_with_fixtures(
    db_session,           # 数据库会话
    test_user,            # 测试用户
    test_post,            # 测试帖子
    authenticated_client  # 已认证的客户端
):
    """使用多个 fixtures 的测试"""
    # 测试逻辑...
    pass
```

### 常用 Fixtures

#### 数据库相关

- `db_session`: 数据库会话
- `test_user`: 测试用户
- `test_user_2`: 第二个测试用户
- `test_post`: 测试帖子
- `test_posts`: 多个测试帖子
- `test_comment`: 测试评论

#### 客户端相关

- `client`: HTTP 测试客户端
- `authenticated_client`: 已认证的测试客户端

#### 工厂函数

- `create_test_user_data`: 创建用户数据
- `create_test_post_data`: 创建帖子数据
- `create_test_comment_data`: 创建评论数据

## 测试覆盖率

### 生成覆盖率报告

```bash
# HTML 报告
make test-cov

# 查看报告
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```

### 覆盖率目标

```
目标覆盖率:
  - 核心模块: > 90%
  - 业务逻辑: > 80%
  - API 端点: > 75%
  - 整体: > 80%
```

### 查看未覆盖的代码

```bash
# 显示缺失的行号
pytest tests/ --cov=app --cov-report=term-missing
```

### XML 报告（用于 CI）

```bash
make test-cov-xml
```

## 持续集成

### GitHub Actions 配置示例

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
      
      - name: Run tests
        run: |
          make test-cov-xml
        env:
          POSTGRES_HOST: localhost
          REDIS_HOST: localhost
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml
```

## 最佳实践

### 1. 测试隔离

✅ **好的做法：**
```python
async def test_create_user(db_session):
    """每个测试使用独立的会话"""
    user = User(username="test", email="test@example.com")
    db_session.add(user)
    await db_session.commit()
```

❌ **不好的做法：**
```python
# 不要在测试之间共享可变状态
global_user = None  # 避免使用全局变量

def test_create_user():
    global global_user
    global_user = User(...)  # 会影响其他测试
```

### 2. 清晰的测试名称

✅ **好的做法：**
```python
def test_user_cannot_follow_themselves(self):
    """测试用户不能关注自己"""
    pass

def test_post_is_deleted_when_author_is_deleted(self):
    """测试删除作者时帖子被级联删除"""
    pass
```

❌ **不好的做法：**
```python
def test_follow(self):  # 太模糊
    pass

def test_1(self):  # 没有意义
    pass
```

### 3. 使用断言消息

✅ **好的做法：**
```python
assert user.is_active is True, "新用户应该默认为激活状态"
assert len(posts) == 5, f"期望 5 个帖子，实际得到 {len(posts)}"
```

### 4. 测试边界情况

```python
def test_pagination_edge_cases(self):
    """测试分页边界情况"""
    # 空结果
    result = await repo.get_multi(skip=0, limit=10)
    
    # 超出范围
    result = await repo.get_multi(skip=1000, limit=10)
    
    # 无效参数
    with pytest.raises(ValueError):
        await repo.get_multi(skip=-1, limit=10)
```

### 5. 测试异常情况

```python
def test_create_user_with_duplicate_email(self):
    """测试创建重复邮箱的用户"""
    with pytest.raises(Exception):
        user = User(email="existing@example.com")
        db.add(user)
        await db.commit()
```

### 6. 使用参数化测试

```python
@pytest.mark.parametrize("password,expected", [
    ("short", False),      # 太短
    ("password123", True), # 有效
    ("", False),           # 空密码
])
def test_password_validation(password, expected):
    """测试密码验证"""
    result = validate_password(password)
    assert result == expected
```

## 故障排除

### 常见问题

#### 1. 数据库连接失败

**错误：**
```
sqlalchemy.exc.OperationalError: could not connect to server
```

**解决方案：**
```bash
# 确保数据库服务正在运行
docker-compose up -d postgres

# 检查数据库连接
make check-db
```

#### 2. 测试数据库未创建

**错误：**
```
database "zishu_community_test" does not exist
```

**解决方案：**
```bash
# 手动创建测试数据库
docker exec -it zishu-postgres psql -U zishu -c "CREATE DATABASE zishu_community_test;"
```

#### 3. 异步测试失败

**错误：**
```
RuntimeError: This event loop is already running
```

**解决方案：**
确保测试函数使用 `async def` 并且标记为异步：

```python
@pytest.mark.asyncio
async def test_async_function():
    result = await async_operation()
    assert result is not None
```

#### 4. Fixture 未找到

**错误：**
```
fixture 'test_user' not found
```

**解决方案：**
确保 `conftest.py` 在正确的位置，并且 fixture 已定义。

#### 5. 测试超时

**解决方案：**
```bash
# 增加超时时间
pytest tests/ --timeout=60

# 或标记慢速测试
@pytest.mark.slow
async def test_slow_operation():
    pass
```

### 调试技巧

#### 1. 使用 -vv 查看详细输出

```bash
pytest tests/ -vv
```

#### 2. 使用 --pdb 进入调试器

```bash
pytest tests/ --pdb
```

#### 3. 打印变量

```python
def test_something(test_user):
    print(f"User ID: {test_user.id}")  # 使用 -s 选项查看输出
    assert test_user.id is not None

# 运行时使用 -s 选项
pytest tests/ -s
```

#### 4. 只运行失败的测试

```bash
pytest tests/ --lf  # last-failed
```

#### 5. 使用标记跳过测试

```python
@pytest.mark.skip(reason="暂时跳过")
def test_not_ready():
    pass

@pytest.mark.skipif(condition, reason="不满足条件时跳过")
def test_conditional():
    pass
```

## 性能优化

### 并行执行

```bash
# 安装 pytest-xdist
pip install pytest-xdist

# 并行运行
make test-parallel
# 或
pytest tests/ -n auto
```

### 缓存测试结果

```bash
# pytest 会自动缓存结果
# 只运行修改过的测试
pytest tests/ --ff  # failed-first
```

## 测试报告

### HTML 报告

```bash
# 生成 HTML 报告
pytest tests/ --html=report.html --self-contained-html
```

### JUnit XML 报告

```bash
# 生成 JUnit 格式报告（用于 CI）
pytest tests/ --junitxml=junit.xml
```

---

## 参考资源

- [Pytest 官方文档](https://docs.pytest.org/)
- [Pytest-asyncio 文档](https://pytest-asyncio.readthedocs.io/)
- [FastAPI 测试文档](https://fastapi.tiangolo.com/tutorial/testing/)
- [项目后端文档](BACKEND_SUMMARY.md)

---

**最后更新**: 2025-10-22  
**维护者**: Zishu AI Team  
**状态**: ✅ 完整测试系统就绪

