# 对话功能集成文档

## 概述

本文档说明了 Zishu-sensei 桌面应用的对话功能实现，包括 Rust 命令和 Python API 桥接。

## 架构设计

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   前端 (React)  │ ──────> │  Tauri 命令层    │ ──────> │  Python API     │
│                 │  invoke │  (Rust Backend)  │   HTTP  │  服务器         │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                    │
                                    ├─ bridge.rs (HTTP 客户端)
                                    ├─ chat.rs (命令处理器)
                                    └─ state (状态管理)
```

## 核心组件

### 1. Python API 桥接 (`bridge.rs`)

提供与 Python API 服务器的 HTTP 通信功能。

#### 主要特性

- ✅ HTTP 客户端封装（GET, POST, DELETE）
- ✅ 自动重试机制
- ✅ 请求超时控制
- ✅ 连接池管理
- ✅ 健康检查
- ✅ 错误处理

#### 配置选项

```rust
ApiConfig {
    base_url: "http://127.0.0.1:8000",  // API 基础 URL
    timeout: 30,                          // 超时时间（秒）
    max_retries: 3,                       // 最大重试次数
    retry_delay: 1000,                    // 重试延迟（毫秒）
    enable_cache: true,                   // 是否启用缓存
    pool_size: 10,                        // 连接池大小
}
```

#### API 方法

```rust
// 创建客户端
let bridge = PythonApiBridge::new(config)?;

// 健康检查
let is_healthy = bridge.health_check().await?;

// 发送聊天消息
let response = bridge.send_chat_message(request).await?;

// 获取历史记录
let history = bridge.get_chat_history(session_id, limit).await?;

// 清空历史记录
let result = bridge.clear_chat_history(session_id).await?;
```

### 2. 聊天命令处理器 (`chat.rs`)

实现所有对话相关的 Tauri 命令。

#### 可用命令

##### `send_message` - 发送消息

发送聊天消息并获取 AI 回复。

**前端调用示例：**

```typescript
import { invoke } from '@tauri-apps/api/tauri';

interface SendMessageInput {
  message: string;
  session_id?: string;
  model?: string;
  adapter?: string;
  character_id?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  context_messages?: Array<{
    role: string;
    content: string;
  }>;
}

interface ChatResponse {
  message: string;
  session_id: string;
  message_id: string;
  model: string;
  processing_time?: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason?: string;
}

// 发送简单消息
const response = await invoke<ChatResponse>('send_message', {
  input: {
    message: '你好，紫舒老师！',
  }
});

// 发送带上下文的消息
const response = await invoke<ChatResponse>('send_message', {
  input: {
    message: '请继续',
    session_id: 'my_session_123',
    model: 'gpt-4',
    temperature: 0.8,
    context_messages: [
      { role: 'user', content: '给我讲个故事' },
      { role: 'assistant', content: '很久以前...' }
    ]
  }
});
```

##### `get_chat_history` - 获取历史

获取指定会话的聊天历史记录。

**前端调用示例：**

```typescript
interface GetHistoryInput {
  session_id: string;
  limit?: number;
}

interface ChatHistoryResponse {
  session_id: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp?: number;
    emotion?: string;
  }>;
  total_count: number;
}

const history = await invoke<ChatHistoryResponse>('get_chat_history', {
  input: {
    session_id: 'my_session_123',
    limit: 50
  }
});

console.log(`共有 ${history.total_count} 条消息`);
history.messages.forEach(msg => {
  console.log(`${msg.role}: ${msg.content}`);
});
```

##### `clear_chat_history` - 清空历史

清空指定会话的所有历史记录。

**前端调用示例：**

```typescript
interface ClearHistoryInput {
  session_id: string;
}

interface ClearResponse {
  message: string;
  session_id: string;
}

const result = await invoke<ClearResponse>('clear_chat_history', {
  input: {
    session_id: 'my_session_123'
  }
});

console.log(result.message); // "Chat history cleared successfully"
```

##### `set_chat_model` - 设置模型

设置当前使用的聊天模型。

**前端调用示例：**

```typescript
interface SetModelInput {
  model_id: string;
  adapter_id?: string;
  config?: Record<string, any>;
}

interface SetModelResponse {
  success: boolean;
  model_id: string;
  adapter_id?: string;
}

const result = await invoke<SetModelResponse>('set_chat_model', {
  input: {
    model_id: 'gpt-4',
    adapter_id: 'openai',
    config: {
      temperature: 0.7,
      max_tokens: 2048
    }
  }
});

if (result.success) {
  console.log(`模型已切换到: ${result.model_id}`);
}
```

### 3. 聊天状态管理 (`chat_state.rs`)

管理聊天会话状态和模型配置。

#### ChatState API

```rust
// 从 AppState 获取聊天状态
let chat_state = &state.chat;

// 获取当前会话
let current_session = chat_state.get_current_session();

// 设置当前会话
chat_state.set_current_session(session);

// 更新会话活动时间
chat_state.update_session_activity(session_id);

// 获取/设置模型配置
let model_config = chat_state.get_model_config();
chat_state.set_model_config(new_config);

// 获取/设置 API URL
let api_url = chat_state.get_api_base_url();
chat_state.set_api_base_url("http://localhost:8000".to_string());
```

## Python API 接口

### 启动 Python API 服务器

```bash
cd /opt/zishu-sensei
python -m zishu.api.server --host 127.0.0.1 --port 8000 --debug
```

### 可用端点

#### POST `/chat/completions`

发送聊天请求。

**请求示例：**

```json
{
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "model": "gpt-4",
  "character_id": "shizuku",
  "temperature": 0.7,
  "max_tokens": 2048,
  "session_id": "session_abc123"
}
```

**响应示例：**

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1699123456,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！我是紫舒老师，很高兴见到你！",
        "session_id": "session_abc123"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  },
  "session_id": "session_abc123"
}
```

#### GET `/chat/history/{session_id}`

获取聊天历史。

**响应示例：**

```json
{
  "session_id": "session_abc123",
  "messages": [
    {
      "role": "user",
      "content": "你好",
      "session_id": "session_abc123"
    },
    {
      "role": "assistant",
      "content": "你好！我是紫舒老师",
      "session_id": "session_abc123"
    }
  ],
  "total_count": 2
}
```

#### DELETE `/chat/history/{session_id}`

清空聊天历史。

**响应示例：**

```json
{
  "message": "Chat history cleared successfully",
  "session_id": "session_abc123"
}
```

## 完整使用示例

### React Hook 示例

```typescript
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useChat(initialSessionId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState(initialSessionId || `session_${Date.now()}`);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);
    
    try {
      // 添加用户消息
      const userMessage: Message = { role: 'user', content };
      setMessages(prev => [...prev, userMessage]);

      // 发送到后端
      const response = await invoke('send_message', {
        input: {
          message: content,
          session_id: sessionId,
          context_messages: messages.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        }
      });

      // 添加 AI 回复
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message
      };
      setMessages(prev => [...prev, assistantMessage]);

      return response;
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, messages]);

  const clearHistory = useCallback(async () => {
    try {
      await invoke('clear_chat_history', {
        input: { session_id: sessionId }
      });
      setMessages([]);
    } catch (error) {
      console.error('清空历史失败:', error);
      throw error;
    }
  }, [sessionId]);

  const loadHistory = useCallback(async () => {
    try {
      const history = await invoke('get_chat_history', {
        input: { session_id: sessionId, limit: 100 }
      });
      
      setMessages(history.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })));
    } catch (error) {
      console.error('加载历史失败:', error);
      throw error;
    }
  }, [sessionId]);

  return {
    messages,
    sessionId,
    isLoading,
    sendMessage,
    clearHistory,
    loadHistory,
    setSessionId
  };
}
```

### React 组件示例

```typescript
import React, { useState } from 'react';
import { useChat } from './useChat';

export function ChatInterface() {
  const [input, setInput] = useState('');
  const { messages, isLoading, sendMessage, clearHistory } = useChat();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    try {
      await sendMessage(input);
      setInput('');
    } catch (error) {
      alert('发送消息失败，请重试');
    }
  };

  return (
    <div className="chat-interface">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <strong>{msg.role === 'user' ? '你' : '紫舒老师'}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="输入消息..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? '发送中...' : '发送'}
        </button>
        <button type="button" onClick={clearHistory}>
          清空历史
        </button>
      </form>
    </div>
  );
}
```

## 错误处理

所有命令都使用统一的错误处理机制：

```typescript
try {
  const response = await invoke('send_message', { input });
  // 处理成功响应
} catch (error) {
  // 错误会被包装在字符串中
  console.error('命令执行失败:', error);
  
  // 可以根据错误信息进行不同处理
  if (error.includes('创建 API 客户端失败')) {
    // Python API 服务器可能未启动
    alert('无法连接到 AI 服务，请检查服务器是否运行');
  } else if (error.includes('消息内容不能为空')) {
    // 输入验证错误
    alert('请输入消息内容');
  } else {
    // 其他错误
    alert('发送失败，请重试');
  }
}
```

## 配置

### 修改 API 地址

在应用启动时或运行时修改：

```typescript
// 方法 1: 通过设置命令（需要实现）
await invoke('set_api_config', {
  config: {
    base_url: 'http://192.168.1.100:8000',
    timeout: 30
  }
});

// 方法 2: 修改 Rust 代码中的默认值
// 编辑 bridge.rs 中的 ApiConfig::default()
```

## 性能优化建议

1. **会话管理**：定期清理旧会话，避免内存占用过多
2. **缓存**：对于相同的请求可以启用响应缓存
3. **连接复用**：HTTP 客户端已配置连接池，自动复用连接
4. **流式传输**：对于长文本生成，可以使用流式 API（需要进一步实现）

## 安全考虑

1. **输入验证**：所有用户输入都经过验证（长度、格式等）
2. **超时控制**：防止请求长时间挂起
3. **错误不泄露**：错误信息不包含敏感系统信息
4. **会话隔离**：不同会话的数据相互隔离

## 测试

运行 Rust 测试：

```bash
cd desktop_app/src-tauri
cargo test
```

运行特定模块测试：

```bash
cargo test --lib bridge
cargo test --lib chat
```

## 故障排查

### 问题：无法连接到 Python API

**解决方案：**

1. 确认 Python API 服务器正在运行
2. 检查防火墙设置
3. 验证 API URL 配置正确
4. 查看 Python API 日志

### 问题：请求超时

**解决方案：**

1. 增加超时时间配置
2. 检查网络连接
3. 优化 Python API 性能
4. 考虑使用更快的模型

### 问题：内存占用过高

**解决方案：**

1. 定期清理聊天历史
2. 限制上下文消息数量
3. 减少并发请求数
4. 优化会话缓存策略

## 扩展功能

### 计划中的功能

- [ ] 流式响应支持
- [ ] 语音输入/输出
- [ ] 多模态支持（图片、文件）
- [ ] 离线模式
- [ ] 响应缓存
- [ ] 自定义提示词模板
- [ ] 会话导出/导入
- [ ] 高级情绪分析

## 参考资料

- [Tauri 文档](https://tauri.app/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Reqwest 文档](https://docs.rs/reqwest/)

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

