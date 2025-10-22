# WebSocket 使用指南

## 📡 概述

本后端已集成完整的 WebSocket 支持，提供实时通信功能，包括：

- ✅ WebSocket 连接管理
- ✅ 实时通知推送
- ✅ 在线状态管理
- ✅ 用户状态广播
- ✅ 心跳检测
- ✅ 消息类型系统

## 🚀 快速开始

### 1. 连接 WebSocket

客户端需要通过 JWT token 进行认证：

```javascript
// 获取 JWT token（通过登录接口）
const token = "your_jwt_access_token";

// 建立 WebSocket 连接
const ws = new WebSocket(`ws://localhost:8000/api/v1/ws?token=${token}`);

// 连接成功
ws.onopen = () => {
  console.log("WebSocket 连接成功");
};

// 接收消息
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log("收到消息:", message);
  handleMessage(message);
};

// 连接关闭
ws.onclose = (event) => {
  console.log("WebSocket 连接关闭:", event.code, event.reason);
};

// 连接错误
ws.onerror = (error) => {
  console.error("WebSocket 错误:", error);
};
```

### 2. 连接成功后的欢迎消息

连接成功后，服务器会发送欢迎消息：

```json
{
  "type": "connected",
  "data": {
    "message": "欢迎, username!",
    "user_id": 123,
    "online_count": 42
  }
}
```

## 📨 消息类型

### 客户端 → 服务器

#### 1. 心跳（Ping）

定期发送心跳消息保持连接：

```javascript
// 每 30 秒发送一次心跳
setInterval(() => {
  ws.send(JSON.stringify({
    type: "ping",
    timestamp: new Date().toISOString()
  }));
}, 30000);
```

服务器响应：

```json
{
  "type": "pong",
  "timestamp": "2025-10-22T10:00:00Z"
}
```

#### 2. 正在输入指示器

```javascript
// 用户开始输入
ws.send(JSON.stringify({
  type: "typing",
  data: {
    is_typing: true,
    context: "post_123"  // 正在输入的上下文
  }
}));

// 用户停止输入
ws.send(JSON.stringify({
  type: "typing",
  data: {
    is_typing: false,
    context: "post_123"
  }
}));
```

#### 3. 在线状态更新

```javascript
// 更新在线状态
ws.send(JSON.stringify({
  type: "presence",
  status: "online",  // online, away, busy, offline
  data: {
    device: "mobile"
  }
}));
```

#### 4. 发送聊天消息（如果实现了聊天功能）

```javascript
ws.send(JSON.stringify({
  type: "message",
  to_user_id: 456,
  message: "Hello!",
  timestamp: new Date().toISOString()
}));
```

### 服务器 → 客户端

#### 1. 用户状态变化

当有用户上线或下线时：

```json
{
  "type": "user_status",
  "data": {
    "user_id": 456,
    "status": "online",
    "timestamp": "2025-10-22T10:00:00Z"
  }
}
```

#### 2. 通知消息

实时通知推送：

```json
{
  "type": "notification",
  "notification_type": "new_follower",
  "data": {
    "id": 789,
    "type": "new_follower",
    "title": "新粉丝",
    "message": "用户 John 关注了你",
    "data": {
      "follower_id": 456
    },
    "link": "/users/456",
    "created_at": "2025-10-22T10:00:00Z"
  },
  "timestamp": "2025-10-22T10:00:00Z"
}
```

通知类型：
- `new_follower` - 新粉丝
- `new_like` - 新点赞
- `new_comment` - 新评论
- `comment_reply` - 评论回复
- `mention` - 被提及

#### 3. 聊天消息

```json
{
  "type": "chat",
  "data": {
    "from_user_id": 456,
    "from_username": "John",
    "message": "Hello!",
    "timestamp": "2025-10-22T10:00:00Z"
  },
  "timestamp": "2025-10-22T10:00:00Z"
}
```

#### 4. 正在输入指示器

```json
{
  "type": "typing",
  "data": {
    "user_id": 456,
    "is_typing": true,
    "context": "post_123"
  }
}
```

#### 5. 在线状态更新

```json
{
  "type": "presence",
  "data": {
    "user_id": 456,
    "status": "away",
    "data": {
      "device": "desktop"
    }
  }
}
```

#### 6. 错误消息

```json
{
  "type": "error",
  "error_code": "INVALID_MESSAGE",
  "message": "Invalid message format",
  "timestamp": "2025-10-22T10:00:00Z"
}
```

错误代码：
- `INVALID_JSON` - 无效的 JSON 格式
- `UNKNOWN_MESSAGE_TYPE` - 未知的消息类型
- `MESSAGE_PROCESSING_ERROR` - 消息处理错误

## 🔌 REST API 端点

### 1. 获取在线用户列表

```bash
GET /api/v1/online?limit=100
Authorization: Bearer <token>
```

响应：

```json
{
  "online_count": 42,
  "users": [
    {
      "user_id": 1,
      "online": true,
      "last_seen": "2025-10-22T10:00:00Z",
      "connections_count": 2
    }
  ]
}
```

### 2. 获取在线用户数量

```bash
GET /api/v1/online/count
Authorization: Bearer <token>
```

响应：

```json
{
  "online_count": 42
}
```

### 3. 获取指定用户的在线状态

```bash
GET /api/v1/status/{user_id}
Authorization: Bearer <token>
```

响应：

```json
{
  "user_id": 456,
  "online": true,
  "last_seen": "2025-10-22T10:00:00Z",
  "connections_count": 1
}
```

## 💡 完整示例

### React 示例

```javascript
import { useEffect, useState, useCallback } from 'react';

function useWebSocket(token) {
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!token) return;

    // 建立连接
    const websocket = new WebSocket(
      `ws://localhost:8000/api/v1/ws?token=${token}`
    );

    websocket.onopen = () => {
      console.log('WebSocket 连接成功');
      setIsConnected(true);
      
      // 开始心跳
      const pingInterval = setInterval(() => {
        if (websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({
            type: 'ping',
            timestamp: new Date().toISOString()
          }));
        }
      }, 30000);

      // 保存 interval ID 以便清理
      websocket.pingInterval = pingInterval;
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'connected':
          setOnlineCount(message.data.online_count);
          break;
        
        case 'notification':
          // 显示通知
          showNotification(message.data.title, message.data.message);
          setMessages(prev => [...prev, message]);
          break;
        
        case 'user_status':
          // 更新用户状态
          if (message.data.status === 'online') {
            setOnlineCount(prev => prev + 1);
          } else {
            setOnlineCount(prev => prev - 1);
          }
          break;
        
        case 'chat':
          // 处理聊天消息
          setMessages(prev => [...prev, message]);
          break;
        
        case 'pong':
          // 心跳响应
          console.log('Pong received');
          break;
        
        case 'error':
          console.error('WebSocket 错误:', message.message);
          break;
        
        default:
          console.log('未知消息类型:', message.type);
      }
    };

    websocket.onclose = (event) => {
      console.log('WebSocket 连接关闭:', event.code);
      setIsConnected(false);
      
      // 清理心跳
      if (websocket.pingInterval) {
        clearInterval(websocket.pingInterval);
      }
      
      // 尝试重连（可选）
      if (event.code !== 1000) {  // 非正常关闭
        setTimeout(() => {
          console.log('尝试重连...');
          // 重连逻辑
        }, 5000);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };

    setWs(websocket);

    // 清理
    return () => {
      if (websocket.pingInterval) {
        clearInterval(websocket.pingInterval);
      }
      websocket.close();
    };
  }, [token]);

  const sendMessage = useCallback((message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, [ws]);

  const setTyping = useCallback((isTyping, context) => {
    sendMessage({
      type: 'typing',
      data: { is_typing: isTyping, context }
    });
  }, [sendMessage]);

  const setPresence = useCallback((status, data = {}) => {
    sendMessage({
      type: 'presence',
      status,
      data
    });
  }, [sendMessage]);

  return {
    isConnected,
    messages,
    onlineCount,
    sendMessage,
    setTyping,
    setPresence
  };
}

function showNotification(title, message) {
  // 使用浏览器通知 API
  if (Notification.permission === 'granted') {
    new Notification(title, { body: message });
  }
}

// 使用示例
function App() {
  const token = localStorage.getItem('access_token');
  const { isConnected, messages, onlineCount, setTyping } = useWebSocket(token);

  return (
    <div>
      <h1>WebSocket 演示</h1>
      <p>连接状态: {isConnected ? '已连接' : '未连接'}</p>
      <p>在线用户: {onlineCount}</p>
      
      <div>
        <h2>消息列表</h2>
        {messages.map((msg, idx) => (
          <div key={idx}>
            {msg.type === 'notification' && (
              <div>
                <strong>{msg.data.title}</strong>: {msg.data.message}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <input
        type="text"
        onFocus={() => setTyping(true, 'main')}
        onBlur={() => setTyping(false, 'main')}
        placeholder="开始输入..."
      />
    </div>
  );
}
```

### Vue 3 示例

```javascript
import { ref, onMounted, onUnmounted } from 'vue';

export function useWebSocket(token) {
  const ws = ref(null);
  const isConnected = ref(false);
  const messages = ref([]);
  const onlineCount = ref(0);

  const connect = () => {
    if (!token.value) return;

    ws.value = new WebSocket(
      `ws://localhost:8000/api/v1/ws?token=${token.value}`
    );

    ws.value.onopen = () => {
      isConnected.value = true;
      
      // 心跳
      const pingInterval = setInterval(() => {
        if (ws.value?.readyState === WebSocket.OPEN) {
          ws.value.send(JSON.stringify({
            type: 'ping',
            timestamp: new Date().toISOString()
          }));
        }
      }, 30000);

      ws.value.pingInterval = pingInterval;
    };

    ws.value.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'connected') {
        onlineCount.value = message.data.online_count;
      } else if (message.type === 'notification') {
        messages.value.push(message);
      }
      // ... 其他消息处理
    };

    ws.value.onclose = () => {
      isConnected.value = false;
      if (ws.value?.pingInterval) {
        clearInterval(ws.value.pingInterval);
      }
    };
  };

  const sendMessage = (message) => {
    if (ws.value?.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message));
    }
  };

  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    if (ws.value?.pingInterval) {
      clearInterval(ws.value.pingInterval);
    }
    ws.value?.close();
  });

  return {
    isConnected,
    messages,
    onlineCount,
    sendMessage
  };
}
```

## 🔐 安全性

1. **认证**: 所有 WebSocket 连接都需要有效的 JWT token
2. **权限检查**: 用户只能接收发送给自己的消息
3. **连接限制**: 自动断开无效或过期的连接
4. **消息验证**: 所有收到的消息都经过格式验证

## 🎯 最佳实践

1. **心跳检测**: 定期发送 ping 消息保持连接活跃
2. **错误处理**: 妥善处理连接错误和消息错误
3. **重连机制**: 实现自动重连逻辑
4. **消息队列**: 在断线期间缓存消息，重连后发送
5. **性能优化**: 避免发送过大的消息，使用消息批处理

## 📊 监控和调试

### 查看连接状态

```python
from app.services.websocket import manager

# 获取在线用户数量
online_count = manager.get_online_count()

# 获取在线用户列表
online_users = manager.get_online_users()

# 检查用户是否在线
is_online = manager.is_user_online(user_id)

# 获取用户的连接数
connections = manager.get_user_connections_count(user_id)
```

### 日志

WebSocket 相关的错误会打印到控制台，生产环境建议使用专业的日志系统。

## 🛠️ 故障排除

### 连接失败

1. 检查 token 是否有效
2. 检查服务器是否运行
3. 检查防火墙设置
4. 检查浏览器控制台错误

### 消息未收到

1. 检查用户是否在线
2. 检查消息格式是否正确
3. 查看服务器日志

### 连接频繁断开

1. 实现心跳机制
2. 检查网络稳定性
3. 调整超时设置

## 📚 更多资源

- [FastAPI WebSocket 文档](https://fastapi.tiangolo.com/advanced/websockets/)
- [MDN WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [WebSocket 协议规范](https://datatracker.ietf.org/doc/html/rfc6455)

---

**创建时间**: 2025-10-22  
**最后更新**: 2025-10-22

