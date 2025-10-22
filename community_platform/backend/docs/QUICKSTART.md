# 🚀 快速开始指南

## 前提条件

- Docker & Docker Compose
- Python 3.10+ （如果本地开发）
- 8GB+ RAM （用于向量搜索模型）

## 方式 1: Docker Compose（推荐）

### 1. 克隆项目并进入后端目录

```bash
cd /opt/zishu-sensei/community_platform/backend
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env（可选，默认配置即可使用）
# vim .env
```

### 3. 启动所有服务

```bash
# 启动所有服务（PostgreSQL + Redis + Qdrant + Backend）
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 查看所有服务状态
docker-compose ps
```

### 4. 等待服务启动

首次启动会下载嵌入模型（约120MB），需要等待几分钟。

查看后端日志确认启动成功：

```bash
docker-compose logs backend | grep "Application startup complete"
```

### 5. 访问 API 文档

打开浏览器访问：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Qdrant Dashboard**: http://localhost:6333/dashboard

### 6. 初始化向量索引

```bash
# 进入后端容器
docker-compose exec backend bash

# 运行索引管理工具
python scripts/manage_vector_index.py status
python scripts/manage_vector_index.py test-embedding

# 如果已有帖子数据，重新索引
python scripts/manage_vector_index.py reindex
```

## 方式 2: 本地开发

### 1. 安装 Python 依赖

```bash
cd /opt/zishu-sensei/community_platform/backend

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
# venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动数据库服务

```bash
# 只启动数据库服务
docker-compose up -d postgres redis qdrant

# 等待服务就绪
sleep 10
```

### 3. 配置环境变量

```bash
cp .env.example .env

# 本地开发配置
cat > .env << EOF
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=zishu
POSTGRES_PASSWORD=zishu123
POSTGRES_DB=zishu_community

REDIS_HOST=localhost
REDIS_PORT=6379

QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION_NAME=zishu_posts
QDRANT_VECTOR_SIZE=384

SECRET_KEY=your-secret-key-change-in-production
DEBUG=True
EOF
```

### 4. 运行应用

```bash
# 开发模式（自动重载）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 或使用 main.py
python main.py
```

## 📖 基本使用

### 1. 注册用户

```bash
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "email": "demo@example.com",
    "password": "demo123456",
    "full_name": "Demo User"
  }'
```

### 2. 登录获取 Token

```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo123456"
  }'

# 保存返回的 access_token
export TOKEN="<your_access_token>"
```

### 3. 创建帖子

```bash
curl -X POST "http://localhost:8000/api/v1/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Python 编程入门教程",
    "content": "这是一篇关于 Python 编程的入门教程。我们将学习如何使用 Python 进行基础编程，包括变量、函数、类等核心概念。",
    "category": "技术",
    "tags": ["Python", "编程", "教程"],
    "is_published": true
  }'
```

### 4. 向量搜索（语义搜索）

```bash
# 搜索 "学习编程" - 会找到上面创建的 "Python 编程入门教程"
curl -X POST "http://localhost:8000/api/v1/search/vector?query=学习编程&limit=10"
```

### 5. 获取个性化推荐

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/search/recommendations?limit=20"
```

### 6. 获取热门内容

```bash
curl "http://localhost:8000/api/v1/search/trending?limit=20&hours=24"
```

## 🧪 测试向量搜索

### 使用管理工具测试

```bash
# 测试嵌入服务
python scripts/manage_vector_index.py test-embedding

# 测试搜索
python scripts/manage_vector_index.py search "人工智能"

# 查看索引状态
python scripts/manage_vector_index.py status
```

### Python 脚本测试

创建 `test_search.py`：

```python
import asyncio
import httpx

async def test_vector_search():
    base_url = "http://localhost:8000"
    
    # 1. 注册用户
    async with httpx.AsyncClient() as client:
        # 注册
        response = await client.post(
            f"{base_url}/api/v1/auth/register",
            json={
                "username": "test_user",
                "email": "test@example.com",
                "password": "test123456",
            }
        )
        print(f"注册: {response.status_code}")
        
        # 登录
        response = await client.post(
            f"{base_url}/api/v1/auth/login",
            json={
                "username": "test_user",
                "password": "test123456",
            }
        )
        token = response.json()["access_token"]
        print(f"登录成功，Token: {token[:20]}...")
        
        # 创建帖子
        headers = {"Authorization": f"Bearer {token}"}
        response = await client.post(
            f"{base_url}/api/v1/posts",
            headers=headers,
            json={
                "title": "深度学习入门",
                "content": "深度学习是机器学习的一个分支...",
                "category": "AI",
                "tags": ["深度学习", "AI", "机器学习"],
            }
        )
        print(f"创建帖子: {response.status_code}")
        
        # 等待索引完成
        await asyncio.sleep(2)
        
        # 向量搜索
        response = await client.post(
            f"{base_url}/api/v1/search/vector?query=人工智能学习",
        )
        results = response.json()
        print(f"\n搜索结果数量: {len(results)}")
        for post in results:
            print(f"  - {post['title']}")

asyncio.run(test_vector_search())
```

运行：

```bash
python test_search.py
```

## 📊 监控和调试

### 查看日志

```bash
# 后端日志
docker-compose logs -f backend

# PostgreSQL 日志
docker-compose logs -f postgres

# Redis 日志
docker-compose logs -f redis

# Qdrant 日志
docker-compose logs -f qdrant
```

### 数据库管理

```bash
# 进入 PostgreSQL
docker-compose exec postgres psql -U zishu -d zishu_community

# 查看表
\dt

# 查看帖子
SELECT id, title, category FROM posts;

# 退出
\q
```

### Redis 管理

```bash
# 进入 Redis CLI
docker-compose exec redis redis-cli

# 查看所有 key
KEYS *

# 查看缓存内容
GET recommendations:user:1

# 清空缓存
FLUSHDB

# 退出
exit
```

### Qdrant 管理

访问 Qdrant Dashboard: http://localhost:6333/dashboard

- 查看集合
- 查看向量数量
- 手动搜索测试

## 🛠️ 常用命令

### Docker Compose 命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose stop

# 重启服务
docker-compose restart

# 停止并删除容器
docker-compose down

# 查看日志
docker-compose logs -f [service_name]

# 查看服务状态
docker-compose ps

# 进入容器
docker-compose exec backend bash
```

### 索引管理命令

```bash
# 查看状态
python scripts/manage_vector_index.py status

# 重新索引
python scripts/manage_vector_index.py reindex

# 索引单个帖子
python scripts/manage_vector_index.py index <post_id>

# 删除索引
python scripts/manage_vector_index.py delete <post_id>

# 测试搜索
python scripts/manage_vector_index.py search "关键词"

# 测试嵌入
python scripts/manage_vector_index.py test-embedding
```

## 🚨 故障排除

### 1. 端口冲突

如果端口被占用，修改 `docker-compose.yml`：

```yaml
services:
  backend:
    ports:
      - "8001:8000"  # 改为 8001
```

### 2. 数据库连接失败

```bash
# 检查 PostgreSQL 是否运行
docker-compose ps postgres

# 重启 PostgreSQL
docker-compose restart postgres

# 查看日志
docker-compose logs postgres
```

### 3. 向量搜索失败

```bash
# 检查 Qdrant 是否运行
docker-compose ps qdrant

# 重启 Qdrant
docker-compose restart qdrant

# 重新索引
python scripts/manage_vector_index.py reindex
```

### 4. 模型下载慢

设置国内镜像：

```bash
export HF_ENDPOINT=https://hf-mirror.com
```

### 5. 内存不足

编辑 `docker-compose.yml` 增加内存限制：

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 4G  # 增加到 4GB
```

## 📚 下一步

1. 查看 [API_ROUTES.md](./API_ROUTES.md) 了解所有 API 端点
2. 查看 [VECTOR_SEARCH.md](./VECTOR_SEARCH.md) 了解向量搜索详情
3. 查看 [BACKEND_SUMMARY.md](./BACKEND_SUMMARY.md) 了解整体架构

## 🎯 生产部署建议

1. **修改密钥**：更改 `.env` 中的 `SECRET_KEY`
2. **禁用调试**：设置 `DEBUG=False`
3. **使用 HTTPS**：配置 SSL 证书
4. **配置域名**：更新 `CORS_ORIGINS`
5. **备份数据**：定期备份 PostgreSQL 和 Qdrant
6. **监控服务**：添加 Prometheus + Grafana
7. **日志收集**：使用 ELK 或 Loki

---

**需要帮助？** 查看文档或提交 Issue

