# 基础设施层文档

本目录包含了 Zishu 社区平台前端的基础设施层实现，提供了企业级的 API Client、WebSocket 客户端和存储管理器。

## 📁 目录结构

```
infrastructure/
├── api/              # API Client 封装
│   ├── types.ts      # 类型定义
│   ├── client.ts     # API Client 主类
│   ├── error-handler.ts  # 错误处理器
│   ├── interceptors.ts   # 请求/响应拦截器
│   ├── retry.ts      # 重试逻辑
│   ├── cache.ts      # 缓存管理器
│   └── index.ts      # 导出文件
├── websocket/        # WebSocket 客户端
│   ├── types.ts      # 类型定义
│   ├── client.ts     # WebSocket 客户端主类
│   ├── events.ts     # 事件管理器
│   ├── hooks.ts      # React Hooks
│   └── index.ts      # 导出文件
└── storage/          # 存储管理器
    ├── types.ts      # 类型定义
    ├── localStorage.ts   # LocalStorage 封装
    ├── sessionStorage.ts # SessionStorage 封装
    ├── indexedDB.ts  # IndexedDB 封装
    └── index.ts      # 导出文件
```

---

## 🌐 API Client

### 功能特性

- ✅ 基于 Axios 的 HTTP 客户端
- ✅ 请求/响应拦截器
- ✅ 自动错误处理
- ✅ 智能重试机制（指数退避）
- ✅ 请求缓存
- ✅ 请求取消
- ✅ 文件上传/下载
- ✅ 批量请求
- ✅ 性能监控

### 基本使用

```typescript
import { apiClient } from '@/infrastructure/api';

// GET 请求
const user = await apiClient.get('/users/123');

// POST 请求
const newPost = await apiClient.post('/posts', {
  title: '标题',
  content: '内容',
});

// PUT 请求
await apiClient.put('/posts/1', { title: '新标题' });

// DELETE 请求
await apiClient.delete('/posts/1');
```

### 高级用法

#### 1. 自定义配置

```typescript
import { createApiClient } from '@/infrastructure/api';

const customClient = createApiClient({
  baseURL: 'https://api.example.com',
  timeout: 60000,
  retry: {
    maxRetries: 5,
    retryDelay: 2000,
    exponentialBackoff: true,
  },
  cache: {
    enabled: true,
    ttl: 10 * 60 * 1000, // 10分钟
  },
});
```

#### 2. 文件上传

```typescript
const file = document.querySelector('input[type="file"]').files[0];

await apiClient.upload(
  '/upload',
  file,
  (progress) => {
    console.log(`上传进度: ${progress}%`);
  }
);
```

#### 3. 文件下载

```typescript
await apiClient.download(
  '/files/report.pdf',
  'report.pdf',
  (progress) => {
    console.log(`下载进度: ${progress}%`);
  }
);
```

#### 4. 批量请求

```typescript
const results = await apiClient.batch([
  { method: 'GET', url: '/users/1' },
  { method: 'GET', url: '/posts/1' },
  { method: 'GET', url: '/comments/1' },
]);
```

#### 5. 请求取消

```typescript
// 取消特定请求
apiClient.cancel('/users', 'GET');

// 取消所有请求
apiClient.cancelAll();
```

#### 6. 缓存管理

```typescript
// 清空所有缓存
apiClient.clearCache();

// 使特定模式的缓存失效
apiClient.invalidateCache(/^\/posts/);

// 获取缓存统计
const stats = apiClient.getCacheStats();
console.log(`缓存项数: ${stats.size}`);
```

---

## 🔌 WebSocket Client

### 功能特性

- ✅ 自动连接/重连
- ✅ 心跳机制
- ✅ 消息队列
- ✅ 事件管理
- ✅ 消息路由
- ✅ React Hooks 支持
- ✅ TypeScript 类型支持

### 基本使用

```typescript
import { createWebSocketClient } from '@/infrastructure/websocket';

const ws = createWebSocketClient({
  url: 'ws://localhost:3001',
  autoConnect: true,
  autoReconnect: true,
  heartbeatInterval: 30000,
});

// 监听连接打开
ws.on('open', () => {
  console.log('WebSocket 已连接');
});

// 监听消息
ws.onMessage('notification', (data) => {
  console.log('收到通知:', data);
});

// 发送消息
ws.send({
  type: 'chat',
  data: { message: 'Hello!' },
});
```

### React Hooks

#### 1. useWebSocket

```typescript
import { useWebSocket } from '@/infrastructure/websocket';

function ChatComponent() {
  const { state, lastMessage, send, error } = useWebSocket({
    url: 'ws://localhost:3001/chat',
    onMessage: (message) => {
      console.log('收到消息:', message);
    },
  });

  const sendMessage = () => {
    send({
      type: 'chat',
      data: { message: 'Hello!' },
    });
  };

  return (
    <div>
      <div>状态: {state}</div>
      {error && <div>错误: {error.message}</div>}
      <button onClick={sendMessage}>发送</button>
    </div>
  );
}
```

#### 2. useWebSocketMessage

```typescript
import { useWebSocketMessage } from '@/infrastructure/websocket';

function NotificationComponent({ client }) {
  useWebSocketMessage(client, 'notification', (data) => {
    toast.success(data.message);
  });

  return <div>通知组件</div>;
}
```

#### 3. useWebSocketSubscription

```typescript
import { useWebSocketSubscription } from '@/infrastructure/websocket';

function ChatRoom({ client, roomId }) {
  const messages = useWebSocketSubscription(
    client,
    `chat:${roomId}`,
    [roomId]
  );

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{msg.text}</div>
      ))}
    </div>
  );
}
```

---

## 💾 Storage Manager

### 功能特性

- ✅ LocalStorage 封装
- ✅ SessionStorage 封装
- ✅ IndexedDB 封装
- ✅ 过期时间支持
- ✅ 版本控制
- ✅ 加密支持（可选）
- ✅ 压缩支持（可选）
- ✅ 自动清理过期数据

### LocalStorage

```typescript
import { localStorage } from '@/infrastructure/storage';

// 设置数据
localStorage.set('user', { name: '张三', age: 25 });

// 设置数据（带过期时间）
localStorage.set(
  'token',
  'abc123',
  { ttl: 60 * 60 * 1000 } // 1小时后过期
);

// 获取数据
const user = localStorage.get('user');

// 删除数据
localStorage.remove('user');

// 清空所有数据
localStorage.clear();

// 检查键是否存在
if (localStorage.has('token')) {
  console.log('Token 存在');
}

// 获取所有键
const keys = localStorage.keys();

// 获取存储使用量
const usage = localStorage.getUsage();
console.log(`已使用: ${usage} 字节`);
```

### SessionStorage

```typescript
import { sessionStorage } from '@/infrastructure/storage';

// API 与 localStorage 相同
sessionStorage.set('tempData', { foo: 'bar' });
const data = sessionStorage.get('tempData');
```

### IndexedDB

```typescript
import { createIndexedDB } from '@/infrastructure/storage';

// 创建 IndexedDB 实例
const db = createIndexedDB({
  dbName: 'my_cache',
  storeName: 'files',
});

// 存储数据（异步）
await db.set('file1', largeFileData, {
  ttl: 24 * 60 * 60 * 1000, // 24小时
});

// 获取数据（异步）
const file = await db.get('file1');

// 删除数据
await db.remove('file1');

// 清空数据
await db.clear();

// 获取所有键
const keys = await db.keys();

// 获取存储大小
const size = await db.size();

// 清理过期项
const cleaned = await db.cleanup();
console.log(`清理了 ${cleaned} 个过期项`);

// 获取存储使用量
const { usage, quota } = await db.getUsage();
console.log(`已使用: ${usage} / ${quota}`);
```

### 自定义配置

```typescript
import { createLocalStorage } from '@/infrastructure/storage';

const customStorage = createLocalStorage({
  prefix: 'myapp_',
  defaultTTL: 30 * 60 * 1000, // 默认30分钟过期
  encrypt: true, // 启用加密
  version: 2, // 版本号
});
```

---

## 🔧 错误处理

### API 错误处理

```typescript
import { apiClient, ApiError } from '@/infrastructure/api';

try {
  const data = await apiClient.get('/users/123');
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API错误:', error.message);
    console.error('错误码:', error.code);
    console.error('追踪ID:', error.traceId);
  }
}
```

### Storage 错误处理

```typescript
import { localStorage, StorageError } from '@/infrastructure/storage';

try {
  localStorage.set('key', 'value');
} catch (error) {
  if (error instanceof StorageError) {
    if (error.code === 'QUOTA_EXCEEDED') {
      console.error('存储空间已满');
    }
  }
}
```

---

## 🎯 最佳实践

### 1. API Client

- ✅ 使用统一的 API Client 实例
- ✅ 合理配置缓存策略
- ✅ 处理错误并提供用户友好的提示
- ✅ 对敏感请求禁用缓存
- ✅ 使用请求取消避免内存泄漏

### 2. WebSocket

- ✅ 在组件卸载时断开连接
- ✅ 使用 React Hooks 简化状态管理
- ✅ 合理设置心跳间隔
- ✅ 处理重连失败的情况

### 3. Storage

- ✅ 为敏感数据启用加密
- ✅ 合理设置过期时间
- ✅ 使用 IndexedDB 存储大文件
- ✅ 定期清理过期数据
- ✅ 监控存储使用量

---

## 📊 性能优化

### API Client

```typescript
// 使用缓存减少重复请求
const config = {
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5分钟
  },
};

// 批量请求减少网络开销
const results = await apiClient.batch([...requests]);
```

### Storage

```typescript
// 对于大数据使用 IndexedDB
if (data.size > 1024 * 1024) { // > 1MB
  await indexedDB.set('largeData', data);
} else {
  localStorage.set('smallData', data);
}
```

---

## 🧪 测试

所有模块都包含完整的 TypeScript 类型定义，便于测试和开发。

```typescript
import { apiClient } from '@/infrastructure/api';
import { createWebSocketClient } from '@/infrastructure/websocket';
import { localStorage } from '@/infrastructure/storage';

// 在测试中使用 Mock
jest.mock('@/infrastructure/api');
```

---

## 📝 环境变量

在 `.env` 文件中配置：

```env
# API 基础 URL
NEXT_PUBLIC_API_BASE_URL=https://api.example.com

# WebSocket URL
NEXT_PUBLIC_WS_URL=wss://api.example.com/ws
```

---

## 🤝 贡献

如需添加新功能或修复 bug，请遵循以下步骤：

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 License

MIT License

---

**维护者**: Zishu Frontend Team  
**最后更新**: 2025-10-23

