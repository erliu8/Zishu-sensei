# 桌面应用与社区平台数据库同步指南

## 📌 问题概述

当前桌面应用默认连接到**核心服务**（端口8000），而社区平台使用**独立的数据库服务**（端口8001）。这导致用户数据不互通。

## 🔍 架构对比

### 当前桌面应用配置
- **API地址**: `http://127.0.0.1:8000` (核心服务)
- **PostgreSQL**: `localhost:5432` → 数据库 `zishu`
- **Redis**: `localhost:6379`
- **Qdrant**: `localhost:6333`

### 社区平台配置
- **API地址**: `http://localhost:8001` (社区平台后端)
- **PostgreSQL**: `localhost:5433` → 数据库 `zishu_community`
- **Redis**: `localhost:6380`
- **Qdrant**: `localhost:6333`

## 💡 解决方案

### 方案1：切换到社区平台API（推荐）

#### 步骤1：创建环境变量配置文件

创建 `.env.local` 文件（该文件会被 git 忽略）：

```bash
# 桌面应用环境变量配置
# 连接到社区平台后端

# API 基础地址
VITE_API_BASE_URL=http://localhost:8001

# WebSocket 地址
VITE_WS_URL=ws://localhost:8001/ws

# 数据库配置（Rust 后端使用）
DATABASE_URL=postgresql://zishu:zishu123@localhost:5433/zishu_community
REDIS_URL=redis://:redis123@localhost:6380/0
QDRANT_URL=http://localhost:6333
```

#### 步骤2：更新 Tauri 后端数据库配置

修改 `src-tauri/src/database/database_manager.rs` 中的默认配置：

```rust
impl Default for DatabaseManagerConfig {
    fn default() -> Self {
        Self {
            postgres_config: Some(DatabaseConfig::postgresql(
                "postgresql://zishu:zishu123@localhost:5433/zishu_community" // 社区平台数据库
            )),
            redis_config: Some(DatabaseConfig::redis("redis://:redis123@localhost:6380")),
            qdrant_config: Some(DatabaseConfig::qdrant("http://localhost:6333")),
            enable_redis_cache: true,
            enable_vector_search: true,
        }
    }
}
```

或者在启动时通过环境变量指定：

```bash
export DATABASE_URL="postgresql://zishu:zishu123@localhost:5433/zishu_community"
export REDIS_URL="redis://:redis123@localhost:6380/0"
export QDRANT_URL="http://localhost:6333"
```

#### 步骤3：验证社区平台服务运行

```bash
cd /opt/zishu-sensei/community_platform
docker compose ps
```

确保以下服务都在运行：
- ✅ zishu_postgres (端口 5433)
- ✅ zishu_redis (端口 6380)
- ✅ zishu_backend (端口 8001)
- ✅ zishu_qdrant (端口 6333)

#### 步骤4：重启桌面应用

```bash
cd /opt/zishu-sensei/desktop_app
npm run dev
```

### 方案2：数据库迁移与同步

如果你想保留核心服务但同步社区平台的用户数据，需要实现数据库同步机制。

#### 选项A：数据库复制

使用 PostgreSQL 逻辑复制将社区平台的用户表同步到核心服务数据库：

```sql
-- 在核心服务数据库创建订阅
CREATE SUBSCRIPTION zishu_user_sync
    CONNECTION 'host=localhost port=5433 dbname=zishu_community user=zishu password=zishu123'
    PUBLICATION user_pub;
```

#### 选项B：API网关模式

创建一个API网关层，根据请求类型路由到不同的后端：

```typescript
// desktop_app/src/services/api-gateway.ts
export const API_ROUTES = {
  // 认证和用户管理路由到社区平台
  '/auth/*': 'http://localhost:8001',
  '/user/*': 'http://localhost:8001',
  
  // 其他功能路由到核心服务
  '/chat/*': 'http://localhost:8000',
  '/characters/*': 'http://localhost:8000',
}
```

### 方案3：统一数据库

合并两个数据库，让核心服务和社区平台使用同一个PostgreSQL实例（推荐用于生产环境）。

## 🔧 具体实现步骤（方案1）

### 1. 更新 .env.example

```bash
cat > /opt/zishu-sensei/desktop_app/.env.example << 'EOF'
# 桌面应用环境变量配置示例
# 复制此文件为 .env.local 并修改相应配置

# ===========================
# API 配置
# ===========================

# API 基础地址
# 默认: http://127.0.0.1:8000 (核心服务)
# 社区平台: http://localhost:8001
VITE_API_BASE_URL=http://localhost:8001

# WebSocket 地址
VITE_WS_URL=ws://localhost:8001/ws

# ===========================
# 数据库配置（Tauri 后端）
# ===========================

# PostgreSQL 连接字符串
# 核心服务: postgresql://zishu:zishu123@localhost:5432/zishu
# 社区平台: postgresql://zishu:zishu123@localhost:5433/zishu_community
DATABASE_URL=postgresql://zishu:zishu123@localhost:5433/zishu_community

# Redis 连接字符串
# 核心服务: redis://:zishu123@localhost:6379/0
# 社区平台: redis://:redis123@localhost:6380/0
REDIS_URL=redis://:redis123@localhost:6380/0

# Qdrant 向量数据库地址
QDRANT_URL=http://localhost:6333

# ===========================
# 功能开关
# ===========================

# 启用 Redis 缓存
ENABLE_REDIS_CACHE=true

# 启用向量搜索
ENABLE_VECTOR_SEARCH=true
EOF
```

### 2. 创建启动脚本

```bash
cat > /opt/zishu-sensei/desktop_app/start-with-community.sh << 'EOF'
#!/bin/bash
# 使用社区平台后端启动桌面应用

set -e

echo "🚀 启动桌面应用（连接社区平台）..."

# 检查社区平台服务是否运行
echo "📡 检查社区平台服务..."
cd ../community_platform
if ! docker compose ps | grep -q "Up"; then
    echo "⚠️  社区平台服务未运行，正在启动..."
    docker compose up -d
    echo "⏳ 等待服务启动..."
    sleep 10
fi

# 返回桌面应用目录
cd ../desktop_app

# 设置环境变量
export VITE_API_BASE_URL=http://localhost:8001
export VITE_WS_URL=ws://localhost:8001/ws
export DATABASE_URL=postgresql://zishu:zishu123@localhost:5433/zishu_community
export REDIS_URL=redis://:redis123@localhost:6380/0

echo "✅ 环境变量已设置"
echo "   API: $VITE_API_BASE_URL"
echo "   DB: $DATABASE_URL"

# 启动应用
echo "🎯 启动桌面应用..."
npm run dev
EOF

chmod +x /opt/zishu-sensei/desktop_app/start-with-community.sh
```

### 3. 验证配置

创建测试脚本验证连接：

```bash
cat > /opt/zishu-sensei/desktop_app/scripts/test-api-connection.sh << 'EOF'
#!/bin/bash
# 测试 API 连接

echo "测试核心服务 (8000)..."
curl -s http://localhost:8000/health || echo "核心服务未运行"

echo -e "\n测试社区平台 (8001)..."
curl -s http://localhost:8001/health || echo "社区平台未运行"

echo -e "\n测试 PostgreSQL 连接..."
psql -h localhost -p 5433 -U zishu -d zishu_community -c "SELECT 1;" || echo "社区平台数据库连接失败"

echo -e "\n测试 Redis 连接..."
redis-cli -h localhost -p 6380 -a redis123 PING || echo "Redis 连接失败"
EOF

chmod +x /opt/zishu-sensei/desktop_app/scripts/test-api-connection.sh
```

## 🔑 登录功能工作流程

### 当前实现（桌面应用）

```typescript
// src/services/api/auth.ts
async login(params: LoginParams): Promise<ApiResponse<AuthResponse>> {
  const response = await this.apiClient.post<AuthResponse>('/auth/login', {
    ...params,
    deviceName,
    deviceId,
  })
  
  if (response.success && response.data) {
    // 保存 Token 到本地
    await this.saveTokens(response.data)
  }
  
  return response
}
```

### 社区平台 API 端点

```python
# community_platform/backend/app/api/v1/endpoints/auth.py
@router.post("/login", response_model=AuthResponse)
async def login(login_data: LoginRequest, db: AsyncSession):
    # 验证用户名/邮箱和密码
    # 返回 JWT Token 和用户信息
    return AuthResponse(
        user=user,
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token"),
        token_type="bearer",
        expires_in=tokens["expires_in"],
    )
```

两者的 API 契约是兼容的，只需切换 baseURL 即可。

## 📝 注意事项

1. **环境变量优先级**：
   - `.env.local` > `.env` > 代码默认值
   - Vite 只会加载 `VITE_` 前缀的变量到前端

2. **数据库密码**：
   - 社区平台默认密码：`zishu123`
   - Redis 默认密码：`redis123`
   - 生产环境请使用强密码并配置在 `.env` 文件中

3. **端口冲突**：
   - 确保端口 5433 和 6380 未被占用
   - 社区平台和核心服务可以同时运行

4. **Token 存储**：
   - 桌面应用使用 Tauri 的安全存储保存 Token
   - Token 在两个系统间不通用

## 🧪 测试验证

```bash
# 1. 启动社区平台
cd /opt/zishu-sensei/community_platform
docker compose up -d

# 2. 验证服务运行
docker compose ps

# 3. 测试 API 连接
cd ../desktop_app
./scripts/test-api-connection.sh

# 4. 使用社区平台后端启动桌面应用
./start-with-community.sh
```

## 📚 相关文档

- [桌面应用架构文档](./ARCHITECTURE.md)
- [API 系统设计](./system/API_SYSTEM.md)
- [社区平台开发文档](../community_platform/docs/)

## 🆘 常见问题

### Q: 切换后无法登录？
A: 检查社区平台服务是否运行，数据库连接是否正确

### Q: Token 失效？
A: 两个系统的 JWT Secret 可能不同，需要重新登录

### Q: 如何同时支持两个后端？
A: 实现 API 网关模式（方案2）或使用配置文件切换

---

**最后更新**: 2024-11-20
**维护者**: Zishu Team
