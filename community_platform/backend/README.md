# Zishu AI Community Platform - 后端 API

紫舒老师社区平台后端服务

## 🏗️ 技术栈

- **框架**: FastAPI 0.109.0
- **数据库**: 
  - PostgreSQL 15 (关系型数据库)
  - Redis 7 (缓存/会话)
  - Qdrant (向量数据库/语义搜索)
- **ORM**: SQLAlchemy 2.0 (异步)
- **认证**: JWT (JSON Web Tokens)
- **密码哈希**: Bcrypt
- **ASGI 服务器**: Uvicorn

## 📁 项目结构

```
backend/
├── app/                          # 应用主目录
│   ├── api/                      # API 路由
│   │   └── v1/                   # API v1
│   │       ├── endpoints/        # 端点
│   │       │   ├── auth.py       # 认证
│   │       │   ├── users.py      # 用户
│   │       │   ├── posts.py      # 帖子
│   │       │   ├── comments.py   # 评论
│   │       │   ├── search.py     # 搜索
│   │       │   └── websocket.py  # WebSocket
│   │       └── api.py            # 路由汇总
│   ├── core/                     # 核心配置
│   │   ├── config/               # 配置模块
│   │   │   ├── settings.py       # 应用设置
│   │   │   └── database.py       # 数据库配置
│   │   ├── security.py           # 安全功能
│   │   ├── deps.py               # 依赖注入
│   │   └── exceptions.py         # 异常处理
│   ├── db/                       # 数据库
│   │   ├── session.py            # 数据库会话
│   │   ├── redis.py              # Redis 客户端
│   │   ├── qdrant.py             # Qdrant 客户端
│   │   └── repositories/         # Repository 层
│   │       ├── base.py           # 基础 Repository
│   │       ├── user.py           # 用户 Repository
│   │       ├── post.py           # 帖子 Repository
│   │       └── comment.py        # 评论 Repository
│   ├── models/                   # 数据模型 (SQLAlchemy)
│   │   ├── user.py               # 用户模型
│   │   ├── post.py               # 帖子模型
│   │   ├── comment.py            # 评论模型
│   │   ├── like.py               # 点赞模型
│   │   ├── follow.py             # 关注模型
│   │   └── notification.py       # 通知模型
│   ├── schemas/                  # Pydantic Schemas
│   │   ├── user.py               # 用户 Schema
│   │   ├── auth.py               # 认证 Schema
│   │   ├── post.py               # 帖子 Schema
│   │   ├── comment.py            # 评论 Schema
│   │   ├── notification.py       # 通知 Schema
│   │   ├── search.py             # 搜索 Schema
│   │   └── common.py             # 通用 Schema
│   ├── services/                 # 业务逻辑服务
│   │   ├── auth/                 # 认证服务
│   │   │   ├── jwt.py            # JWT 服务
│   │   │   └── password.py       # 密码服务
│   │   ├── user/                 # 用户服务
│   │   ├── post/                 # 帖子服务
│   │   ├── search/               # 搜索服务
│   │   │   ├── vector_search.py  # 向量搜索
│   │   │   └── text_search.py    # 文本搜索
│   │   └── websocket/            # WebSocket 服务
│   ├── middleware/               # 中间件
│   │   ├── logging.py            # 日志中间件
│   │   ├── error_handler.py      # 错误处理
│   │   └── rate_limit.py         # 限流
│   └── utils/                    # 工具函数
│       ├── logger.py             # 日志工具
│       ├── validators.py         # 验证器
│       ├── pagination.py         # 分页
│       └── cache.py              # 缓存工具
├── tests/                        # 测试
│   ├── unit/                     # 单元测试
│   ├── integration/              # 集成测试
│   └── fixtures/                 # 测试夹具
├── scripts/                      # 脚本
│   ├── init_db.py                # 初始化数据库
│   ├── seed_data.py              # 种子数据
│   └── init_qdrant.py            # 初始化 Qdrant
├── alembic/                      # 数据库迁移
├── main.py                       # 应用入口
├── requirements.txt              # Python 依赖
├── docker-compose.yml            # Docker Compose 配置
├── Dockerfile                    # Docker 配置
└── .env.example                  # 环境变量示例
```

## 🚀 快速开始

### 1. 环境要求

- Python 3.10+
- Docker & Docker Compose (可选，推荐)

### 2. 安装依赖

```bash
# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息
```

### 4. 使用 Docker Compose 启动所有服务

```bash
docker-compose up -d
```

这将启动：
- PostgreSQL (端口 5432)
- Redis (端口 6379)
- Qdrant (端口 6333, 6334)
- Backend API (端口 8000)

### 5. 初始化数据库

```bash
# 数据库会在容器启动时自动初始化
# 如需手动初始化，运行：
python scripts/init_db.py
```

### 6. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 📚 API 端点

### 认证 (Authentication)

```
POST   /api/v1/auth/register     注册用户
POST   /api/v1/auth/login        用户登录
POST   /api/v1/auth/refresh      刷新令牌
POST   /api/v1/auth/logout       用户登出
```

### 用户 (Users)

```
GET    /api/v1/users/me          获取当前用户
PUT    /api/v1/users/me          更新当前用户
GET    /api/v1/users/{id}        获取用户详情
POST   /api/v1/users/{id}/follow 关注用户
DELETE /api/v1/users/{id}/follow 取消关注
```

### 帖子 (Posts)

```
GET    /api/v1/posts             获取帖子列表
POST   /api/v1/posts             创建帖子
GET    /api/v1/posts/{id}        获取帖子详情
PUT    /api/v1/posts/{id}        更新帖子
DELETE /api/v1/posts/{id}        删除帖子
POST   /api/v1/posts/{id}/like   点赞帖子
```

### 评论 (Comments)

```
GET    /api/v1/comments          获取评论列表
POST   /api/v1/comments          创建评论
PUT    /api/v1/comments/{id}     更新评论
DELETE /api/v1/comments/{id}     删除评论
POST   /api/v1/comments/{id}/like 点赞评论
```

### 搜索 (Search)

```
GET    /api/v1/search            文本搜索
POST   /api/v1/search/vector     向量搜索 (语义搜索)
```

## 🔒 认证

使用 JWT (JSON Web Token) 进行身份认证。

### 获取令牌

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

### 使用令牌

在请求头中添加：

```
Authorization: Bearer <your_access_token>
```

## 🗄️ 数据库

### PostgreSQL

主要数据存储，包含以下表：
- `users` - 用户
- `posts` - 帖子
- `comments` - 评论
- `likes` - 点赞
- `follows` - 关注关系
- `notifications` - 通知

### Redis

用于：
- 会话缓存
- API 响应缓存
- 限流计数器

### Qdrant

向量数据库，用于：
- 帖子内容的语义搜索
- 相似内容推荐

## 🧪 测试

```bash
# 运行所有测试
pytest

# 运行单元测试
pytest tests/unit/

# 运行集成测试
pytest tests/integration/

# 查看测试覆盖率
pytest --cov=app tests/
```

## 📦 部署

### Docker 部署

```bash
# 构建镜像
docker build -t zishu-backend .

# 运行容器
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  zishu-backend
```

### 使用 Docker Compose

```bash
# 生产环境
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 开发

### 添加数据库迁移

```bash
# 创建迁移
alembic revision --autogenerate -m "description"

# 执行迁移
alembic upgrade head

# 回滚迁移
alembic downgrade -1
```

### 代码格式化

```bash
# 使用 black 格式化
black app/

# 使用 isort 排序导入
isort app/
```

## 📝 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `ENVIRONMENT` | 环境 (development/production) | development |
| `DEBUG` | 调试模式 | True |
| `SECRET_KEY` | JWT 密钥 | (必须设置) |
| `POSTGRES_HOST` | PostgreSQL 主机 | localhost |
| `POSTGRES_PORT` | PostgreSQL 端口 | 5432 |
| `POSTGRES_USER` | PostgreSQL 用户 | zishu |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | zishu123 |
| `POSTGRES_DB` | PostgreSQL 数据库 | zishu_community |
| `REDIS_HOST` | Redis 主机 | localhost |
| `REDIS_PORT` | Redis 端口 | 6379 |
| `QDRANT_HOST` | Qdrant 主机 | localhost |
| `QDRANT_PORT` | Qdrant 端口 | 6333 |

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

## 🆘 支持

如有问题，请联系：admin@zishu.ai

