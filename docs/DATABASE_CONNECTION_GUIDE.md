# Zishu-Sensei 数据库连接完整指南

## 📋 目录
1. [概述](#概述)
2. [数据库架构](#数据库架构)
3. [连接策略](#连接策略)
4. [各组件数据库配置](#各组件数据库配置)
5. [快速启动指南](#快速启动指南)
6. [生产环境部署](#生产环境部署)
7. [常见问题](#常见问题)

---

## 概述

### 您需要连接几次数据库？

**答案：只需启动一次数据库服务，但三个组件会独立连接到这些数据库。**

Zishu-Sensei 使用**共享数据库架构**，即：
- ✅ **一套数据库实例**（PostgreSQL、Redis、Qdrant）
- ✅ **三个独立组件**各自连接到这套数据库
- ✅ **统一的连接配置**，通过环境变量或配置文件管理

### 数据库清单

| 数据库 | 用途 | 默认端口 | 使用场景 |
|--------|------|----------|----------|
| **PostgreSQL** | 主数据库 | 5432 | 用户数据、适配器配置、会话记录、社区数据 |
| **Redis** | 缓存/消息队列 | 6379 | 缓存、会话存储、实时通信、任务队列 |
| **Qdrant** | 向量数据库 | 6333/6334 | 知识库向量存储、语义搜索、RAG |

---

## 数据库架构

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    数据库服务层（单一实例）                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │   PostgreSQL    │  │      Redis      │  │    Qdrant     │  │
│  │   (主数据库)     │  │   (缓存/队列)    │  │  (向量数据库)  │  │
│  │   Port: 5432    │  │   Port: 6379    │  │  Port: 6333   │  │
│  └─────────────────┘  └─────────────────┘  └───────────────┘  │
│           ▲                   ▲                     ▲          │
└───────────┼───────────────────┼─────────────────────┼──────────┘
            │                   │                     │
    ┌───────┴───────────────────┴─────────────────────┴──────┐
    │                三个组件独立连接                          │
    └──────────────────────────────────────────────────────────┘
            │                   │                     │
    ┌───────┴────────┐  ┌───────┴────────┐  ┌────────┴───────┐
    │  核心库 (zishu) │  │  桌面应用       │  │  社区平台       │
    │                │  │  (Tauri)       │  │  (Next.js)     │
    │  - Python API  │  │  - SQLite本地  │  │  - FastAPI     │
    │  - 适配器系统   │  │  - 远程连接    │  │  - 用户管理     │
    │  - 后台服务    │  │  - 配置存储    │  │  - 内容分享     │
    └────────────────┘  └────────────────┘  └────────────────┘
```

### 数据库划分策略

#### PostgreSQL 数据库划分

```sql
-- 主数据库: zishu (核心库使用)
Database: zishu
  Schema: zishu      -- 核心业务数据
  Schema: logs       -- 应用日志
  Schema: metrics    -- 性能指标

-- 社区数据库: zishu_community (社区平台使用)
Database: zishu_community
  -- 用户管理、适配器市场、社区内容等
```

#### Redis 数据库划分

```
DB 0: 核心库缓存 (zishu)
DB 1: 社区平台缓存 (community_platform)
DB 2: 桌面应用缓存 (desktop_app) - 可选
DB 3-15: 预留
```

#### Qdrant 集合划分

```
Collection: zishu_knowledge      -- 核心知识库
Collection: community_resources  -- 社区资源
Collection: user_embeddings      -- 用户数据向量
```

---

## 连接策略

### 1. 核心库 (zishu)

**位置**: `/opt/zishu-sensei/zishu/`

**连接方式**: SQLAlchemy + asyncpg (异步连接)

**配置文件**:
- `zishu/database/connection.py` - 连接管理器
- `zishu/adapters/core/storage/` - 存储后端

**连接示例**:

```python
# zishu/database/connection.py
from sqlalchemy.ext.asyncio import create_async_engine

# PostgreSQL 连接
DATABASE_URL = "postgresql+asyncpg://zishu:zishu123@localhost:5432/zishu"
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_timeout=30,
    pool_recycle=3600
)

# Redis 连接
from redis import asyncio as aioredis
redis_client = await aioredis.from_url(
    "redis://:zishu123@localhost:6379/0",
    encoding="utf-8",
    decode_responses=True
)

# Qdrant 连接
from qdrant_client import QdrantClient
qdrant_client = QdrantClient(url="http://localhost:6333")
```

### 2. 桌面应用 (desktop_app)

**位置**: `/opt/zishu-sensei/desktop_app/src-tauri/`

**连接方式**: 
- **本地**: SQLite (主要配置存储)
- **远程**: PostgreSQL/Redis/Qdrant (可选，用于云同步)

**配置文件**:
- `src-tauri/src/database/mod.rs` - 数据库模块
- `src-tauri/src/database/postgres_backend.rs` - PostgreSQL 后端
- `src-tauri/src/database/redis_backend.rs` - Redis 后端
- `src-tauri/src/database/qdrant_backend.rs` - Qdrant 后端

**连接示例**:

```rust
// SQLite 本地数据库 (默认)
use rusqlite::Connection;
let db_path = app_data_dir.join("zishu.db");
let conn = Connection::open(db_path)?;

// PostgreSQL 远程连接 (可选)
use deadpool_postgres::{Config, Pool};
let mut pg_config = Config::new();
pg_config.host = Some("localhost".to_string());
pg_config.port = Some(5432);
pg_config.dbname = Some("zishu".to_string());
pg_config.user = Some("zishu".to_string());
pg_config.password = Some("zishu123".to_string());

// Redis 连接 (可选)
use redis::Client;
let client = Client::open("redis://:zishu123@localhost:6379")?;

// Qdrant 连接 (可选)
use qdrant_client::prelude::*;
let client = QdrantClient::from_url("http://localhost:6333").build()?;
```

### 3. 社区平台 (community_platform)

**位置**: `/opt/zishu-sensei/community_platform/backend/`

**连接方式**: SQLAlchemy + asyncpg

**配置文件**:
- `backend/database.py` - 数据库连接
- `.env` - 环境变量配置

**连接示例**:

```python
# 使用独立的数据库
DATABASE_URL = "postgresql://zishu:zishu123@postgres:5432/zishu_community"
REDIS_URL = "redis://:redis123@redis:6379/1"

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
engine = create_async_engine(DATABASE_URL, echo=True)
```

---

## 各组件数据库配置

### 配置清单

#### 1. 核心库配置 (zishu)

**文件**: `config/config.yaml` 或环境变量

```yaml
# config/config.yaml
database:
  url: "postgresql+asyncpg://zishu:zishu123@localhost:5432/zishu"
  pool_size: 20
  max_overflow: 10
  pool_timeout: 30
  pool_recycle: 3600
  echo: false

redis:
  url: "redis://:zishu123@localhost:6379/0"
  db: 0
  max_connections: 50
  socket_timeout: 5
  socket_connect_timeout: 5
  decode_responses: true

vector_db:
  provider: "qdrant"
  url: "http://localhost:6333"
  collection_name: "zishu_knowledge"
  vector_size: 768
  distance: "cosine"
```

**环境变量** (`.env`):
```bash
DATABASE_URL=postgresql+asyncpg://zishu:zishu123@localhost:5432/zishu
REDIS_URL=redis://:zishu123@localhost:6379/0
QDRANT_URL=http://localhost:6333
```

#### 2. 桌面应用配置

**主要使用 SQLite 本地存储**:
```
~/.local/share/zishu-sensei/     (Linux)
~/Library/Application Support/zishu-sensei/  (macOS)
%APPDATA%\zishu-sensei\          (Windows)
  ├── zishu.db                   # 主配置数据库
  ├── security_audit.db          # 安全审计日志
  └── logs/                      # 应用日志
```

**远程连接** (可选，用于云同步):
- 通过应用设置界面配置
- 或修改配置文件 `~/.config/zishu-sensei/config.json`

```json
{
  "remote_sync": {
    "enabled": true,
    "postgres": "postgresql://zishu:zishu123@your-server:5432/zishu",
    "redis": "redis://:zishu123@your-server:6379/2",
    "qdrant": "http://your-server:6333"
  }
}
```

#### 3. 社区平台配置

**文件**: `community_platform/env.example` → `.env`

```bash
# Database Configuration
POSTGRES_USER=zishu
POSTGRES_PASSWORD=zishu123
POSTGRES_DB=zishu_community

# Redis Configuration
REDIS_PASSWORD=redis123

# Backend Configuration
DATABASE_URL=postgresql://zishu:zishu123@postgres:5432/zishu_community
REDIS_URL=redis://:redis123@redis:6379/1
SECRET_KEY=your-secret-key-change-in-production-minimum-32-characters
ENVIRONMENT=production
```

---

## 快速启动指南

### 方案 A: Docker Compose (推荐)

#### 启动所有服务（包括数据库）

```bash
cd /opt/zishu-sensei

# 1. 创建环境变量文件
cat > .env << EOF
POSTGRES_PASSWORD=zishu123
REDIS_PASSWORD=zishu123
GRAFANA_PASSWORD=admin123
DATABASE_URL=postgresql+asyncpg://zishu:zishu123@postgres:5432/zishu
REDIS_URL=redis://:zishu123@redis:6379/0
EOF

# 2. 启动核心服务（数据库 + API）
docker-compose up -d postgres redis qdrant zishu-api

# 3. 等待数据库初始化（约10秒）
sleep 10

# 4. 检查服务状态
docker-compose ps

# 5. 查看日志
docker-compose logs -f postgres redis qdrant

# 6. (可选) 启动社区平台
cd community_platform
cp env.example .env
# 编辑 .env 文件设置密码
docker-compose up -d

# 7. (可选) 运行桌面应用
cd ../desktop_app
npm install
npm run tauri:dev
```

#### 验证连接

```bash
# PostgreSQL
docker exec -it zishu-postgres psql -U zishu -d zishu -c "SELECT version();"

# Redis
docker exec -it zishu-redis redis-cli -a zishu123 PING

# Qdrant
curl http://localhost:6335/health
```

### 方案 B: 手动安装数据库

#### 1. 安装 PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# 创建用户和数据库
sudo -u postgres psql << EOF
CREATE USER zishu WITH PASSWORD 'zishu123';
CREATE DATABASE zishu OWNER zishu;
CREATE DATABASE zishu_community OWNER zishu;
\c zishu
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
GRANT ALL PRIVILEGES ON DATABASE zishu TO zishu;
GRANT ALL PRIVILEGES ON DATABASE zishu_community TO zishu;
EOF

# 允许远程连接（编辑 postgresql.conf 和 pg_hba.conf）
sudo systemctl restart postgresql
```

#### 2. 安装 Redis

```bash
# Ubuntu/Debian
sudo apt install redis-server

# 配置密码
sudo sed -i 's/# requirepass foobared/requirepass zishu123/' /etc/redis/redis.conf

# 重启服务
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# 测试连接
redis-cli -a zishu123 PING
```

#### 3. 安装 Qdrant

```bash
# 使用 Docker (推荐)
docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v $(pwd)/data/qdrant:/qdrant/storage \
  qdrant/qdrant:v1.7.0

# 或者下载二进制文件
wget https://github.com/qdrant/qdrant/releases/download/v1.7.0/qdrant-x86_64-unknown-linux-gnu.tar.gz
tar -xzf qdrant-x86_64-unknown-linux-gnu.tar.gz
./qdrant --config-path ./config/config.yaml

# 测试连接
curl http://localhost:6333/health
```

#### 4. 初始化数据库结构

```bash
cd /opt/zishu-sensei

# 运行初始化脚本
psql -U zishu -d zishu -f docker/postgres/init/01-init-db.sql

# 使用 Alembic 运行迁移
cd zishu
alembic upgrade head
```

#### 5. 配置各组件

```bash
# 核心库
export DATABASE_URL="postgresql+asyncpg://zishu:zishu123@localhost:5432/zishu"
export REDIS_URL="redis://:zishu123@localhost:6379/0"
export QDRANT_URL="http://localhost:6333"

# 社区平台
cd community_platform
cat > .env << EOF
POSTGRES_USER=zishu
POSTGRES_PASSWORD=zishu123
POSTGRES_DB=zishu_community
REDIS_PASSWORD=zishu123
DATABASE_URL=postgresql://zishu:zishu123@localhost:5432/zishu_community
REDIS_URL=redis://:zishu123@localhost:6379/1
SECRET_KEY=$(openssl rand -hex 32)
EOF

# 启动服务
cd backend && uvicorn main:app --reload
cd ../frontend && npm run dev
```

---

## 生产环境部署

### 安全建议

1. **修改默认密码**
```bash
# 生成强密码
openssl rand -base64 32

# 更新所有配置文件中的密码
```

2. **使用 SSL/TLS 连接**
```python
# PostgreSQL SSL
DATABASE_URL = "postgresql+asyncpg://user:pass@host:5432/db?ssl=require"

# Redis SSL
REDIS_URL = "rediss://user:pass@host:6380/0"

# Qdrant HTTPS
QDRANT_URL = "https://your-qdrant-server:6333"
```

3. **网络隔离**
```yaml
# docker-compose.yml
networks:
  backend:
    internal: true  # 内部网络，外部无法访问
  frontend:
    # 前端网络
```

4. **使用密钥管理**
```bash
# 使用 Docker Secrets
echo "my_secure_password" | docker secret create postgres_password -

# 在 docker-compose.yml 中引用
secrets:
  postgres_password:
    external: true
```

### 高可用配置

#### PostgreSQL 主从复制

```yaml
# docker-compose.yml
services:
  postgres-primary:
    image: postgres:15
    environment:
      POSTGRES_REPLICATION_MODE: master
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: rep_password

  postgres-replica:
    image: postgres:15
    environment:
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_MASTER_HOST: postgres-primary
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: rep_password
```

#### Redis 集群

```yaml
redis-master:
  image: redis:7-alpine
  command: redis-server --appendonly yes

redis-replica:
  image: redis:7-alpine
  command: redis-server --slaveof redis-master 6379
```

#### Qdrant 分片

```yaml
qdrant-node1:
  image: qdrant/qdrant
  environment:
    QDRANT__CLUSTER__ENABLED: "true"
    QDRANT__CLUSTER__NODE_ID: 1

qdrant-node2:
  image: qdrant/qdrant
  environment:
    QDRANT__CLUSTER__ENABLED: "true"
    QDRANT__CLUSTER__NODE_ID: 2
```

### 监控配置

```yaml
# Prometheus 监控
prometheus:
  image: prom/prometheus
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'

# Grafana 仪表板
grafana:
  image: grafana/grafana
  environment:
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
```

---

## 常见问题

### Q1: 三个组件是否必须同时运行？

**答**: 不是。
- **核心库** (zishu): API 服务，需要 PostgreSQL/Redis/Qdrant
- **桌面应用**: 独立运行，主要使用 SQLite，可选远程连接
- **社区平台**: 独立服务，需要 PostgreSQL/Redis

可以根据需求选择运行部分组件。

### Q2: 桌面应用是否需要连接远程数据库？

**答**: 不是必须的。
- **本地模式**: 使用 SQLite，完全离线工作
- **云同步模式**: 连接远程 PostgreSQL/Redis，实现多设备同步

### Q3: 数据库端口冲突怎么办？

**答**: 修改 `docker-compose.yml` 中的端口映射:
```yaml
postgres:
  ports:
    - "5433:5432"  # 宿主机端口:容器端口

redis:
  ports:
    - "6380:6379"

qdrant:
  ports:
    - "6334:6333"
```

然后更新连接字符串。

### Q4: 如何备份数据库？

**PostgreSQL 备份**:
```bash
# 备份
docker exec zishu-postgres pg_dump -U zishu zishu > backup_$(date +%Y%m%d).sql

# 恢复
cat backup_20241021.sql | docker exec -i zishu-postgres psql -U zishu zishu
```

**Redis 备份**:
```bash
# 手动触发保存
docker exec zishu-redis redis-cli -a zishu123 SAVE

# 复制 RDB 文件
docker cp zishu-redis:/data/dump.rdb ./backup/
```

**Qdrant 备份**:
```bash
# 备份整个存储目录
tar -czf qdrant_backup_$(date +%Y%m%d).tar.gz data/qdrant/
```

### Q5: 如何查看连接状态？

**PostgreSQL**:
```sql
-- 查看活动连接
SELECT * FROM pg_stat_activity WHERE datname = 'zishu';

-- 查看连接数
SELECT count(*) FROM pg_stat_activity;
```

**Redis**:
```bash
# 查看客户端连接
docker exec zishu-redis redis-cli -a zishu123 CLIENT LIST

# 查看信息
docker exec zishu-redis redis-cli -a zishu123 INFO clients
```

**Qdrant**:
```bash
# 健康检查
curl http://localhost:6335/health

# 集合信息
curl http://localhost:6335/collections
```

### Q6: 性能优化建议？

1. **PostgreSQL**:
```sql
-- 调整连接池
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
```

2. **Redis**:
```bash
# 启用持久化
CONFIG SET save "900 1 300 10 60 10000"

# 设置最大内存
CONFIG SET maxmemory 2gb
CONFIG SET maxmemory-policy allkeys-lru
```

3. **连接池配置**:
```python
# SQLAlchemy
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,        # 基础连接数
    max_overflow=30,     # 最大溢出
    pool_timeout=30,     # 获取连接超时
    pool_recycle=3600,   # 连接回收时间
    pool_pre_ping=True   # 连接前检查
)
```

### Q7: 迁移到生产环境需要注意什么？

1. ✅ 修改所有默认密码
2. ✅ 启用 SSL/TLS 加密
3. ✅ 配置防火墙规则
4. ✅ 设置定期备份
5. ✅ 配置监控和告警
6. ✅ 使用环境变量管理敏感信息
7. ✅ 限制数据库访问IP
8. ✅ 启用审计日志

---

## 连接测试脚本

创建 `scripts/test_database_connections.sh`:

```bash
#!/bin/bash

echo "=== Zishu-Sensei 数据库连接测试 ==="

# PostgreSQL
echo -n "PostgreSQL: "
if docker exec zishu-postgres pg_isready -U zishu > /dev/null 2>&1; then
    echo "✓ 连接成功"
else
    echo "✗ 连接失败"
fi

# Redis
echo -n "Redis: "
if docker exec zishu-redis redis-cli -a zishu123 PING > /dev/null 2>&1; then
    echo "✓ 连接成功"
else
    echo "✗ 连接失败"
fi

# Qdrant
echo -n "Qdrant: "
if curl -s http://localhost:6335/health | grep -q "ok"; then
    echo "✓ 连接成功"
else
    echo "✗ 连接失败"
fi

echo ""
echo "=== 连接详情 ==="

# PostgreSQL 详情
echo "PostgreSQL 数据库:"
docker exec zishu-postgres psql -U zishu -d zishu -c "\l" 2>/dev/null | grep zishu

# Redis 详情
echo ""
echo "Redis 信息:"
docker exec zishu-redis redis-cli -a zishu123 INFO server 2>/dev/null | grep redis_version

# Qdrant 详情
echo ""
echo "Qdrant 集合:"
curl -s http://localhost:6335/collections | jq '.result.collections[] .name' 2>/dev/null || echo "无集合或 jq 未安装"
```

运行测试:
```bash
chmod +x scripts/test_database_connections.sh
./scripts/test_database_connections.sh
```

---

## 总结

### 连接要点

1. **一套数据库，三个组件连接**
   - PostgreSQL: 主数据存储
   - Redis: 缓存和消息队列
   - Qdrant: 向量存储

2. **组件连接方式**
   - **核心库 (zishu)**: 必须连接 PostgreSQL/Redis/Qdrant
   - **桌面应用**: SQLite 本地 + 可选远程连接
   - **社区平台**: 必须连接 PostgreSQL/Redis

3. **数据库隔离**
   - PostgreSQL: 不同数据库 (zishu, zishu_community)
   - Redis: 不同 DB 编号 (0, 1, 2)
   - Qdrant: 不同集合 (collections)

4. **部署建议**
   - 开发环境: Docker Compose 一键启动
   - 生产环境: 独立部署 + 高可用配置

### 下一步

- 📖 查看 [DEPLOYMENT.md](/opt/zishu-sensei/DEPLOYMENT.md) 了解完整部署流程
- 🚀 查看 [DOCKER_QUICKSTART.md](/opt/zishu-sensei/docs/DOCKER_QUICKSTART.md) 快速启动
- 🔧 查看配置文件示例: `config/config.yaml`, `community_platform/env.example`

---

**文档版本**: 1.0.0  
**最后更新**: 2025-10-21  
**维护者**: Zishu Team

