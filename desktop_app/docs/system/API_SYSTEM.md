# API 系统完整文档

> 文档版本：v1.0.0  
> 最后更新：2025-10-19  
> 状态：✅ 已完成

## 📋 概述

本文档描述紫舒老师桌面应用的完整后端 API 集成系统。该系统提供了全面、健壮且易用的 API 接口，支持 RESTful API、WebSocket 实时通信、离线数据同步、API 版本管理等功能。

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端应用层                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  React组件  │  │ React Hooks│  │   Stores   │             │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘             │
│         │                │                │                   │
│         └────────────────┴────────────────┘                   │
│                          │                                    │
├──────────────────────────┼────────────────────────────────────┤
│                     服务工厂层                                 │
│              ┌───────────┴───────────┐                        │
│              │  ApiServiceFactory   │                        │
│              │  (统一访问入口)      │                        │
│              └───────────┬───────────┘                        │
│                          │                                    │
├──────────────────────────┼────────────────────────────────────┤
│                     服务层                                     │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐    │
│  │ AuthAPI  │ UserAPI  │ConversAPI│WebSocket │ SyncMgr  │    │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘    │
│       │          │          │          │          │          │
├───────┴──────────┴──────────┴──────────┴──────────┴──────────┤
│                     核心层                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              ApiClient (核心客户端)                   │    │
│  │  ┌────────────────────────────────────────────────┐  │    │
│  │  │ 拦截器 │ 缓存 │ 重试 │ 离线队列 │ 版本管理 │    │  │    │
│  │  └────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────┘    │
│                          │                                    │
├──────────────────────────┼────────────────────────────────────┤
│                     传输层                                     │
│         ┌────────────────┴────────────────┐                   │
│         │        HTTP/HTTPS                │                   │
│         │    (axios + fetch + tauri)      │                   │
│         └────────────────┬────────────────┘                   │
│                          │                                    │
│         ┌────────────────┴────────────────┐                   │
│         │        WebSocket                │                   │
│         │    (Native WebSocket API)      │                   │
│         └────────────────┬────────────────┘                   │
└──────────────────────────┼────────────────────────────────────┘
                           │
                           ▼
                    后端服务器
```

## 🔧 核心组件

### 1. ApiClient（核心 API 客户端）

**文件**: `src/services/api.ts`

**功能**:
- ✅ 完整的 RESTful API 封装（GET、POST、PUT、PATCH、DELETE）
- ✅ 请求/响应拦截器系统
- ✅ 自动重试机制（可配置次数和延迟）
- ✅ 请求缓存策略（内存缓存 + TTL）
- ✅ 离线请求队列（支持优先级）
- ✅ 请求取消功能
- ✅ 上传/下载进度跟踪
- ✅ 网络状态监控
- ✅ 错误处理和转换

**核心 API**:
```typescript
// 创建客户端
const client = new ApiClient({
  baseURL: 'http://127.0.0.1:8000',
  timeout: 30000,
  apiVersion: 'v1',
  enableCache: true,
  enableOfflineQueue: true,
})

// HTTP 方法
await client.get<T>(url, config)
await client.post<T>(url, data, config)
await client.put<T>(url, data, config)
await client.patch<T>(url, data, config)
await client.delete<T>(url, config)

// 缓存管理
client.clearCache(pattern?)

// 请求取消
client.cancelRequest(method, url)
client.cancelAllRequests()

// 拦截器
client.addRequestInterceptor(interceptor)
client.addResponseInterceptor(interceptor)
client.addErrorInterceptor(interceptor)
```

**配置选项**:
```typescript
interface ApiConfig {
  baseURL: string                // API 基础 URL
  timeout?: number               // 请求超时（默认 30000ms）
  headers?: Record<string, string> // 自定义请求头
  apiVersion?: string            // API 版本（默认 'v1'）
  retryAttempts?: number         // 重试次数（默认 3）
  retryDelay?: number            // 重试延迟（默认 1000ms）
  enableCache?: boolean          // 启用缓存（默认 true）
  enableOfflineQueue?: boolean   // 启用离线队列（默认 true）
  enableLogging?: boolean        // 启用日志（默认 DEV 模式）
}
```

---

### 2. WebSocketManager（WebSocket 管理器）

**文件**: `src/services/api/websocket.ts`

**功能**:
- ✅ 自动连接和断线重连（指数退避）
- ✅ 心跳检测机制
- ✅ 消息队列管理
- ✅ 消息确认机制（ACK）
- ✅ 事件订阅系统
- ✅ 连接状态追踪
- ✅ 连接统计信息

**核心 API**:
```typescript
// 创建管理器
const ws = new WebSocketManager({
  url: 'ws://127.0.0.1:8000/ws',
  reconnect: true,
  heartbeatInterval: 30000,
  enableQueue: true,
})

// 连接管理
ws.connect()
ws.disconnect()

// 发送消息
await ws.send('message-type', data, requiresAck)

// 事件监听
ws.on('connected', handler)
ws.on('disconnected', handler)
ws.on('message', handler)
ws.on('message:type', handler) // 特定类型消息

// 状态查询
ws.getState()
ws.isConnected()
ws.getStats()
```

**连接状态**:
- `CONNECTING` - 正在连接
- `CONNECTED` - 已连接
- `DISCONNECTING` - 正在断开
- `DISCONNECTED` - 已断开
- `ERROR` - 错误状态

---

### 3. SyncManager（数据同步管理器）

**文件**: `src/services/api/sync.ts`

**功能**:
- ✅ 增量数据同步
- ✅ 冲突检测和解决
- ✅ 同步队列管理
- ✅ 自动同步调度
- ✅ 实体同步器注册
- ✅ 同步优先级配置
- ✅ 同步状态追踪

**核心 API**:
```typescript
// 创建管理器
const sync = new SyncManager(apiClient, {
  syncInterval: 60000,
  autoSync: true,
  conflictResolution: ConflictResolution.LATEST_WINS,
})

// 注册实体同步器
sync.registerSyncer({
  entity: 'conversations',
  getLocalChanges: async (since) => [...],
  getRemoteChanges: async (since) => [...],
  applyLocalChange: async (item) => {},
  applyRemoteChange: async (item) => {},
  resolveConflict: async (conflict) => {},
})

// 执行同步
await sync.sync(['conversations', 'messages'])

// 冲突管理
const conflicts = sync.getConflicts()
await sync.manualResolveConflict(conflictId, resolution, data)

// 自动同步
sync.startAutoSync()
sync.stopAutoSync()
```

**冲突解决策略**:
- `LOCAL_WINS` - 本地版本优先
- `REMOTE_WINS` - 远程版本优先
- `LATEST_WINS` - 最新时间戳优先
- `MANUAL` - 手动解决
- `MERGE` - 自动合并

---

### 4. VersionManager（版本管理器）

**文件**: `src/services/api/version.ts`

**功能**:
- ✅ API 版本自动协商
- ✅ 版本兼容性检查
- ✅ 版本迁移支持
- ✅ 弃用警告
- ✅ 多版本支持

**核心 API**:
```typescript
// 创建管理器
const version = new VersionManager(apiClient, {
  currentVersion: 'v1',
  supportedVersions: ['v1', 'v2'],
  preferredVersion: 'v2',
  autoNegotiate: true,
})

// 版本协商
const negotiated = await version.negotiateVersion()

// 兼容性检查
const compat = await version.checkCompatibility('v1', 'v2')

// 版本信息
const info = await version.getVersionInfo('v2')

// 版本迁移
const migrations = await version.getMigrationPath('v1', 'v2')
await version.migrate('v1', 'v2')
```

---

### 5. AuthApiService（认证服务）

**文件**: `src/services/api/auth.ts`

**功能**:
- ✅ 用户登录/注册
- ✅ Token 管理（自动刷新）
- ✅ OAuth 认证（Google、GitHub 等）
- ✅ 双因素认证（2FA）
- ✅ 会话管理

**核心 API**:
```typescript
// 登录
await authService.login({
  username: 'user',
  password: 'pass',
  rememberMe: true,
})

// 注册
await authService.register({
  username: 'user',
  email: 'user@example.com',
  password: 'pass',
  confirmPassword: 'pass',
  agreeToTerms: true,
})

// 登出
await authService.logout()

// Token 刷新（自动）
await authService.refreshToken()

// OAuth 登录
const { url } = await authService.getOAuthUrl('google', redirectUri)
await authService.oauthLogin({ provider: 'google', code, redirectUri })

// 双因素认证
const setup = await authService.setupTwoFactor()
await authService.enableTwoFactor(code)
await authService.verifyTwoFactor({ code })
```

---

### 6. UserApiService（用户服务）

**文件**: `src/services/api/user.ts`

**功能**:
- ✅ 用户信息管理
- ✅ 用户配置和偏好
- ✅ 头像上传
- ✅ 密码管理
- ✅ 会话管理
- ✅ 用户统计

**核心 API**:
```typescript
// 获取用户信息
const user = await userService.getCurrentUser()

// 更新用户信息
await userService.updateCurrentUser({
  nickname: 'New Name',
  bio: 'Bio text',
})

// 更新头像
await userService.updateAvatar(file)

// 获取/更新偏好设置
const preferences = await userService.getPreferences()
await userService.updatePreferences({
  theme: 'dark',
  language: 'zh-CN',
})

// 用户统计
const stats = await userService.getStats()

// 会话管理
const sessions = await userService.getActiveSessions()
await userService.revokeSession(sessionId)
```

---

### 7. ConversationApiService（对话服务）

**文件**: `src/services/api/conversation.ts`

**功能**:
- ✅ 对话 CRUD 操作
- ✅ 消息管理
- ✅ 对话搜索
- ✅ 对话分享
- ✅ 对话导出（JSON、Markdown、HTML、PDF）
- ✅ 对话统计

**核心 API**:
```typescript
// 创建对话
const conversation = await conversationService.createConversation({
  title: '新对话',
  model: 'gpt-4',
})

// 获取对话列表
const { conversations } = await conversationService.getConversations({
  limit: 20,
  sortBy: 'updatedAt',
})

// 发送消息
await conversationService.sendMessage(conversationId, {
  content: '你好',
  attachments: [file1, file2],
})

// 搜索对话
const results = await conversationService.searchConversations({
  query: '关键词',
  tags: ['工作'],
})

// 分享对话
const share = await conversationService.shareConversation(conversationId, {
  expiresIn: 86400,
  password: 'secret',
})

// 导出对话
const { downloadUrl } = await conversationService.exportConversation(
  conversationId,
  'markdown'
)
```

---

## 🛠️ 使用指南

### 初始化 API 服务

```typescript
import { initializeApiServices } from '@/services/api/factory'

// 在应用启动时初始化
async function initApp() {
  const services = await initializeApiServices({
    api: {
      baseURL: import.meta.env.VITE_API_BASE_URL,
      timeout: 30000,
    },
    websocket: {
      url: import.meta.env.VITE_WS_URL,
      autoConnect: true,
    },
    sync: {
      autoSync: true,
      syncInterval: 60000,
    },
    version: {
      currentVersion: 'v1',
      supportedVersions: ['v1', 'v2'],
    },
  })

  console.log('API services initialized:', services)
}
```

### 在 React 组件中使用

```typescript
import { useAuthService, useConversationService } from '@/hooks/useApiServices'

function MyComponent() {
  const { isAuthenticated, login, logout } = useAuthService()
  const { conversationService } = useConversationService()

  const handleLogin = async () => {
    await login('username', 'password')
  }

  const handleCreateConversation = async () => {
    const result = await conversationService.createConversation({
      title: '新对话',
      model: 'gpt-4',
    })
    
    if (result.success) {
      console.log('Created:', result.data)
    }
  }

  return (
    <div>
      {isAuthenticated ? (
        <button onClick={logout}>登出</button>
      ) : (
        <button onClick={handleLogin}>登录</button>
      )}
      <button onClick={handleCreateConversation}>创建对话</button>
    </div>
  )
}
```

### 使用 WebSocket

```typescript
import { useWebSocket } from '@/hooks/useApiServices'

function ChatComponent() {
  const { isConnected, send, websocket } = useWebSocket()

  useEffect(() => {
    // 监听特定类型的消息
    const handleMessage = (data) => {
      console.log('Received:', data)
    }

    websocket.on('message:chat', handleMessage)

    return () => {
      websocket.off('message:chat', handleMessage)
    }
  }, [websocket])

  const sendMessage = async () => {
    await send('chat', {
      conversationId: 'xxx',
      content: 'Hello',
    }, true) // 需要确认
  }

  return (
    <div>
      <p>连接状态: {isConnected ? '已连接' : '未连接'}</p>
      <button onClick={sendMessage}>发送消息</button>
    </div>
  )
}
```

### 数据同步

```typescript
import { useSyncManager } from '@/hooks/useApiServices'

function SyncComponent() {
  const { isSyncing, lastSyncTime, sync, syncManager } = useSyncManager()

  // 注册实体同步器
  useEffect(() => {
    syncManager.registerSyncer({
      entity: 'conversations',
      getLocalChanges: async (since) => {
        // 获取本地变更
        return await getLocalConversationChanges(since)
      },
      getRemoteChanges: async (since) => {
        // 获取远程变更
        return await getRemoteConversationChanges(since)
      },
      applyLocalChange: async (item) => {
        // 应用本地变更
        await saveConversationToServer(item)
      },
      applyRemoteChange: async (item) => {
        // 应用远程变更
        await saveConversationToLocal(item)
      },
      resolveConflict: async (conflict) => {
        // 解决冲突
        return await mergeConversations(conflict)
      },
    })
  }, [syncManager])

  const handleSync = async () => {
    await sync(['conversations', 'messages'])
  }

  return (
    <div>
      <p>同步状态: {isSyncing ? '同步中' : '空闲'}</p>
      <p>最后同步: {new Date(lastSyncTime).toLocaleString()}</p>
      <button onClick={handleSync} disabled={isSyncing}>
        立即同步
      </button>
    </div>
  )
}
```

---

## 📦 文件结构

```
src/services/
├── api.ts                      # 核心 API 客户端
├── api/
│   ├── index.ts               # API 服务统一导出
│   ├── factory.ts             # API 服务工厂
│   ├── websocket.ts           # WebSocket 管理器
│   ├── sync.ts                # 数据同步管理器
│   ├── version.ts             # API 版本管理器
│   ├── auth.ts                # 认证 API 服务
│   ├── user.ts                # 用户 API 服务
│   ├── conversation.ts        # 对话 API 服务
│   ├── chat.ts                # 聊天 API（现有）
│   ├── desktop.ts             # 桌面 API（现有）
│   ├── adapter.ts             # 适配器 API（现有）
│   └── system.ts              # 系统 API（现有）
└── desktopApi.ts              # 桌面特定 API（现有）

src/hooks/
└── useApiServices.ts          # API 服务 React Hooks

docs/
└── API_SYSTEM.md              # 本文档
```

---

## 🔐 安全特性

### 1. 认证令牌管理
- 自动附加认证令牌到请求头
- 自动刷新过期令牌
- 安全存储（通过 Tauri 调用 Rust 后端）

### 2. 请求安全
- HTTPS 支持
- 请求签名（可选）
- CSRF 防护
- XSS 防护

### 3. 数据加密
- 传输层加密（TLS/SSL）
- 敏感数据本地加密存储
- Token 安全存储

---

## ⚡ 性能优化

### 1. 请求优化
- 请求去重
- 请求合并
- 请求缓存（智能 TTL）
- 请求优先级

### 2. 网络优化
- 自动重试（指数退避）
- 离线队列
- 增量同步
- 批量操作

### 3. 资源优化
- 内存缓存限制
- 离线队列限制
- 连接池管理

---

## 🐛 错误处理

### 1. 错误分类
- 网络错误（超时、断网等）
- 服务器错误（5xx）
- 客户端错误（4xx）
- 业务错误

### 2. 错误处理策略
```typescript
// 全局错误处理
apiClient.addErrorInterceptor(async (error) => {
  if (error.status === 401) {
    // 未授权 - 跳转登录
    await authService.logout()
    router.push('/login')
  } else if (error.status === 429) {
    // 速率限制 - 等待重试
    await delay(5000)
  } else if (error.status >= 500) {
    // 服务器错误 - 上报
    await reportError(error)
  }
  
  return Promise.reject(error)
})

// 请求级错误处理
await apiClient.get('/data', {
  customErrorHandler: (error) => {
    console.error('Custom error handler:', error)
  },
})
```

### 3. 错误恢复
- 自动重试
- 降级处理
- 离线模式
- 错误上报

---

## 📊 监控和日志

### 1. 请求日志
```typescript
apiClient.addRequestInterceptor((config) => {
  console.log(`[API] ${config.method} ${config.url}`)
  return config
})

apiClient.addResponseInterceptor((response) => {
  console.log(`[API] ${response.status} ${response.config.url}`)
  return response
})
```

### 2. 性能监控
- 请求耗时统计
- 网络延迟监控
- WebSocket 连接状态
- 同步性能统计

### 3. 错误监控
- 错误率统计
- 错误分类统计
- 错误趋势分析

---

## 🧪 测试

### 1. 单元测试
```typescript
import { ApiClient } from '@/services/api'
import { describe, it, expect, vi } from 'vitest'

describe('ApiClient', () => {
  it('should make GET request', async () => {
    const client = new ApiClient({
      baseURL: 'http://localhost:8000',
    })

    const response = await client.get('/test')
    expect(response.success).toBe(true)
  })

  it('should retry on failure', async () => {
    // 测试重试逻辑
  })

  it('should cache responses', async () => {
    // 测试缓存功能
  })
})
```

### 2. 集成测试
- API 服务集成测试
- WebSocket 连接测试
- 数据同步测试

### 3. E2E 测试
- 完整用户流程测试
- 离线场景测试
- 版本兼容性测试

---

## 🔄 未来规划

### 短期（1-2 个月）
- [ ] GraphQL 支持（可选）
- [ ] 请求批处理
- [ ] 更智能的缓存策略
- [ ] 请求性能分析工具

### 中期（3-6 个月）
- [ ] Service Worker 集成
- [ ] 完整的离线支持
- [ ] 实时协作功能
- [ ] 数据预加载策略

### 长期（6+ 个月）
- [ ] P2P 数据同步
- [ ] 边缘计算支持
- [ ] AI 驱动的请求优化
- [ ] 多租户支持

---

## 📚 参考资源

### 相关文档
- [Axios 文档](https://axios-http.com/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Tauri API](https://tauri.app/v1/api/)

### 代码示例
- `src/examples/api-usage.ts` - API 使用示例
- `src/examples/websocket-usage.ts` - WebSocket 使用示例
- `src/examples/sync-usage.ts` - 数据同步示例

---

## 🤝 贡献

欢迎贡献代码和文档改进！请查看 `CONTRIBUTING.md` 了解详情。

---

## 📄 许可证

MIT License

---

**文档维护者**: 开发团队  
**最后更新**: 2025-10-19

