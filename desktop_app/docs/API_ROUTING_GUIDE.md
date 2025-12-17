# API 路由配置指南

## 📌 问题背景

桌面应用需要同时连接两个后端服务：
1. **核心服务** (8000端口) - 角色模板、适配器、工作流等核心功能
2. **社区平台** (8001端口) - 用户认证、社区互动功能

简单切换会导致核心功能失效，因此需要智能路由系统。

## 🏗️ 架构设计

### 双后端架构

```
┌─────────────────────┐
│   桌面应用前端        │
└──────────┬──────────┘
           │
           ▼
    ┌─────────────┐
    │ API Router  │
    └──────┬──────┘
           │
    ┌──────┴────────┐
    │               │
    ▼               ▼
┌─────────┐    ┌──────────────┐
│核心服务  │    │  社区平台     │
│:8000    │    │  :8001       │
└─────────┘    └──────────────┘
    │               │
    ▼               ▼
┌─────────┐    ┌──────────────┐
│zishu    │    │zishu_community│
│(PG:5432)│    │  (PG:5433)   │
└─────────┘    └──────────────┘
```

### 路由规则

#### 社区平台路由 (→ 8001)
- `/auth/*` - 用户认证（登录、注册、Token）
- `/user/*` - 用户管理
- `/community/*` - 社区功能
- `/posts/*` - 帖子管理
- `/comments/*` - 评论功能
- `/notifications/*` - 通知系统

#### 核心服务路由 (→ 8000)
- `/chat/*` - 聊天功能
- `/characters/*` - 角色模板
- `/adapters/*` - 适配器管理
- `/workflows/*` - 工作流引擎
- `/tasks/*` - 任务管理
- `/system/*` - 系统信息
- `/settings/*` - 设置管理
- `/models/*` - 模型管理
- `/screen/*` - 屏幕理解
- `/market/*` - 市场/应用商店

## 🔧 配置步骤

### 1. 创建环境变量配置

创建 `.env.local` 文件：

```bash
# ===========================
# 双后端配置
# ===========================

# 核心服务 API (角色、适配器、工作流)
VITE_CORE_API_URL=http://127.0.0.1:8000
ZISHU_CORE_API_URL=http://127.0.0.1:8000

# 社区平台 API (用户认证、社区功能)
VITE_COMMUNITY_API_URL=http://localhost:8001
ZISHU_COMMUNITY_API_URL=http://localhost:8001

# WebSocket 配置
VITE_WS_URL=ws://127.0.0.1:8000/ws

# ===========================
# 数据库配置
# ===========================

# 核心服务数据库
CORE_DATABASE_URL=postgresql://zishu:zishu123@localhost:5432/zishu
CORE_REDIS_URL=redis://:zishu123@localhost:6379/0

# 社区平台数据库（用于数据同步）
COMMUNITY_DATABASE_URL=postgresql://zishu:zishu123@localhost:5433/zishu_community
COMMUNITY_REDIS_URL=redis://:redis123@localhost:6380/0

# 向量数据库（共享）
QDRANT_URL=http://localhost:6333
```

### 2. 前端路由配置

前端已经创建了 `src/services/api/router.ts`，它会自动根据 API 路径选择正确的后端。

#### 使用方式

```typescript
import { buildApiUrl, getBackendForPath } from '@/services/api/router'

// 自动路由到社区平台 (8001)
const loginUrl = buildApiUrl('/auth/login')
// → http://localhost:8001/auth/login

// 自动路由到核心服务 (8000)
const characterUrl = buildApiUrl('/characters/list')
// → http://127.0.0.1:8000/characters/list
```

### 3. 后端路由配置（Rust）

后端已经创建了 `src-tauri/src/config/api_router.rs`。

#### 集成到现有代码

修改需要使用路由的命令文件，例如 `adapter.rs`:

```rust
use crate::config::api_router::ApiRouter;

// 替换原来的硬编码 URL
fn get_backend_url() -> String {
    let router = ApiRouter::new();
    router.core_url()  // 适配器使用核心服务
}
```

对于认证相关的功能：

```rust
fn get_auth_url() -> String {
    let router = ApiRouter::new();
    router.community_url()  // 认证使用社区平台
}
```

### 4. 更新 API 客户端

修改 `src/services/api.ts` 让它支持路由：

```typescript
import { getBackendForPath } from './api/router'

class ApiClient {
  async request<T = any>(config: RequestConfig): Promise<ApiResponse<T>> {
    // 根据路径获取正确的后端
    const backend = getBackendForPath(config.url || '')
    
    // 动态设置 baseURL
    const axiosConfig = {
      ...config,
      baseURL: backend.baseURL,
    }
    
    // 发起请求...
  }
}
```

## 📝 使用示例

### 前端示例

```typescript
// 1. 用户登录（社区平台）
import { apiServices } from '@/services/api'

const response = await apiServices.auth.login({
  username: 'user@example.com',
  password: 'password123'
})
// → POST http://localhost:8001/auth/login

// 2. 获取角色列表（核心服务）
import { invoke } from '@tauri-apps/api/tauri'

const characters = await invoke('get_characters')
// → GET http://127.0.0.1:8000/characters

// 3. 安装适配器（核心服务）
const adapter = await invoke('install_adapter', {
  url: 'https://example.com/adapter.zip'
})
// → POST http://127.0.0.1:8000/adapters/install
```

### Rust 后端示例

```rust
use crate::config::api_router::ApiRouter;

#[tauri::command]
async fn custom_api_call(path: String) -> Result<String, String> {
    let router = ApiRouter::new();
    let url = router.build_url(&path);
    
    // 使用 url 发起请求...
    Ok(url)
}
```

## 🔍 路由决策流程

```
API 请求: /auth/login
    ↓
检查路由表
    ↓
匹配到 /auth → community
    ↓
使用社区平台 baseURL
    ↓
完整 URL: http://localhost:8001/auth/login
```

```
API 请求: /characters/switch
    ↓
检查路由表
    ↓
匹配到 /characters → core
    ↓
使用核心服务 baseURL
    ↓
完整 URL: http://127.0.0.1:8000/characters/switch
```

## 🧪 测试验证

### 1. 检查服务状态

```bash
# 测试核心服务
curl http://127.0.0.1:8000/health

# 测试社区平台
curl http://localhost:8001/health
```

### 2. 测试路由功能

创建测试脚本 `test-routing.sh`:

```bash
#!/bin/bash

echo "🧪 测试 API 路由..."

# 测试核心服务路由
echo "1. 测试角色列表 (应该连接到 8000)"
curl -s http://127.0.0.1:8000/api/v1/characters | head -n 5

# 测试社区平台路由
echo "2. 测试健康检查 (应该连接到 8001)"
curl -s http://localhost:8001/health

echo "✅ 路由测试完成"
```

### 3. 前端集成测试

```typescript
import { checkAllBackends, getBackendInfo } from '@/services/api/router'

// 检查所有后端状态
const status = await checkAllBackends()
console.log('Backend Status:', status)
// { core: true, community: true }

// 获取路由配置信息
const info = getBackendInfo()
console.log('Routing Info:', info)
```

## ⚙️ 高级配置

### 动态后端切换

支持运行时切换后端配置：

```typescript
// 前端
localStorage.setItem('api_core_url', 'http://custom-core.example.com')
localStorage.setItem('api_community_url', 'http://custom-community.example.com')
```

### 负载均衡

可以扩展路由器支持多个后端实例：

```typescript
export const API_BACKENDS = {
  CORE_PRIMARY: { baseURL: 'http://127.0.0.1:8000' },
  CORE_BACKUP: { baseURL: 'http://127.0.0.1:8002' },
  // ...
}
```

### 请求重试和降级

路由器可以实现自动降级：

```typescript
async function requestWithFallback(path: string) {
  try {
    return await fetch(buildApiUrl(path, API_BACKENDS.CORE_PRIMARY))
  } catch {
    // 降级到备用后端
    return await fetch(buildApiUrl(path, API_BACKENDS.CORE_BACKUP))
  }
}
```

## 📊 监控和调试

### 启用路由日志

在 `.env.local` 中添加：

```bash
VITE_ENABLE_ROUTER_LOGGING=true
```

### 查看路由信息

在浏览器控制台：

```javascript
// 查看当前路由配置
console.table(window.__API_ROUTES__)

// 查看后端状态
await window.__CHECK_BACKENDS__()
```

## 🚨 常见问题

### Q1: 登录后无法访问角色功能？

**原因**: Token 存储在社区平台，但角色 API 在核心服务

**解决**: 实现 Token 同步机制或使用统一认证中心

```typescript
// 登录后同步 Token 到核心服务
await syncTokenToCore(authToken)
```

### Q2: CORS 错误？

**原因**: 两个后端需要分别配置 CORS

**解决**: 
- 核心服务: 允许来自前端的请求
- 社区平台: 已在 docker-compose.yml 配置

### Q3: WebSocket 连接问题？

**原因**: WebSocket 只能连接一个服务

**解决**: 使用核心服务的 WebSocket，通过 API 网关转发社区平台的实时消息

```typescript
const wsUrl = API_BACKENDS.CORE.baseURL.replace('http', 'ws') + '/ws'
```

### Q4: 如何调试路由问题？

```typescript
// 在请求前打印路由信息
const backend = getBackendForPath('/auth/login')
console.log('Routing to:', backend.name, backend.baseURL)
```

## 🔐 安全考虑

1. **Token 隔离**: 两个后端使用不同的 JWT Secret
2. **HTTPS**: 生产环境必须使用 HTTPS
3. **API Key**: 后端间通信使用 API Key 验证
4. **速率限制**: 每个后端独立配置

## 📚 相关文档

- [数据库同步指南](./DATABASE_SYNC_GUIDE.md)
- [API 系统设计](./system/API_SYSTEM.md)
- [前端架构文档](./ARCHITECTURE.md)

## 🎯 下一步

1. ✅ 创建路由配置
2. ⬜ 更新所有 Rust 命令使用路由器
3. ⬜ 修改前端 API 客户端支持动态路由
4. ⬜ 实现 Token 同步机制
5. ⬜ 添加后端健康检查和自动切换
6. ⬜ 编写集成测试

---

**最后更新**: 2024-11-20  
**维护者**: Zishu Team
