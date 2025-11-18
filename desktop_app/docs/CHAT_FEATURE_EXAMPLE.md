# AI聊天功能代码示例

## 组件使用示例

### 1. CharacterSelector组件

```tsx
import { CharacterSelector } from '@/components/Chat/CharacterSelector'

// 在你的组件中使用
function MyComponent() {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>()
  
  return (
    <CharacterSelector
      selectedCharacterId={selectedCharacterId}
      onSelectCharacter={setSelectedCharacterId}
    />
  )
}
```

### 2. ChatWindow组件（已更新）

```tsx
import { ChatWindow } from '@/components/Chat/ChatWindow'

// 在App.tsx中使用
function App() {
  return (
    <ChatWindow
      onClose={() => handleWindowModeChange('pet')}
      onMinimize={minimizeWindow}
    />
  )
}
```

### 3. 使用ChatService发送消息

```tsx
import { ChatService } from '@/services/chat'
import { CharacterTemplateService } from '@/services/characterTemplate'

async function sendChatMessage() {
  // 1. 获取角色模板
  const template = await CharacterTemplateService.getTemplateById('your-character-id')
  
  // 2. 发送消息
  const response = await ChatService.sendMessage({
    message: 'Hello, AI!',
    session_id: 'session_123',
    character_id: 'your-character-id',
    adapter: template?.metadata?.adapterId,
  })
  
  // 3. 处理响应
  console.log('AI回复:', response.message)
}
```

## 完整工作流程示例

```tsx
import React, { useState, useEffect } from 'react'
import { CharacterTemplateService } from '@/services/characterTemplate'
import { ChatService } from '@/services/chat'
import { CharacterSelector } from '@/components/Chat/CharacterSelector'

export function ChatDemo() {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{
    id: string
    content: string
    sender: 'user' | 'assistant'
  }>>([])
  const [sessionId] = useState(() => ChatService.generateSessionId())

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedCharacterId) return

    // 添加用户消息
    const userMessage = {
      id: Date.now().toString(),
      content: message,
      sender: 'user' as const,
    }
    setMessages(prev => [...prev, userMessage])
    setMessage('')

    try {
      // 获取角色模板
      const template = await CharacterTemplateService.getTemplateById(selectedCharacterId)
      
      // 调用AI API
      const response = await ChatService.sendMessage({
        message: userMessage.content,
        session_id: sessionId,
        character_id: selectedCharacterId,
        adapter: template?.metadata?.adapterId,
      })

      // 添加AI回复
      const aiMessage = {
        id: response.message_id,
        content: response.message,
        sender: 'assistant' as const,
      }
      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error('发送失败:', error)
    }
  }

  return (
    <div className="chat-demo">
      {/* 角色选择器 */}
      <CharacterSelector
        selectedCharacterId={selectedCharacterId}
        onSelectCharacter={setSelectedCharacterId}
      />

      {/* 消息列表 */}
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            {msg.content}
          </div>
        ))}
      </div>

      {/* 输入框 */}
      <div className="input-area">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder={selectedCharacterId ? "输入消息..." : "请先选择角色..."}
        />
        <button onClick={handleSendMessage}>发送</button>
      </div>
    </div>
  )
}
```

## 创建角色模板示例

```tsx
import { CharacterTemplateService } from '@/services/characterTemplate'

async function createCharacterTemplate() {
  // 创建Prompt
  const prompt = {
    name: '友好助手',
    systemPrompt: '你是一个友好、乐于助人的AI助手。',
    description: '通用对话助手',
  }

  // 创建角色模板
  const template = await CharacterTemplateService.createTemplate(
    {
      name: '小助手',
      description: '一个可爱的桌面助手',
      live2dModelId: 'model_1',
      prompt: prompt,
    },
    {
      type: 'api',
      provider: 'openai',
      apiEndpoint: 'https://api.openai.com/v1',
      modelName: 'gpt-3.5-turbo',
      apiKey: 'your-api-key',
    }
  )

  console.log('角色模板创建成功:', template)
  return template
}
```

## API响应格式

### 发送消息响应

```typescript
interface ChatResponse {
  message: string              // AI回复的消息内容
  session_id: string           // 会话ID
  message_id: string           // 消息ID
  model: string                // 使用的模型名称
  processing_time?: number     // 处理时间（毫秒）
  usage?: {                    // Token使用情况
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  finish_reason?: string       // 完成原因
}
```

### 错误处理

```typescript
try {
  const response = await ChatService.sendMessage({...})
  // 处理成功响应
} catch (error) {
  if (error instanceof Error) {
    // 显示错误消息给用户
    console.error('发送失败:', error.message)
  }
}
```

## 高级功能

### 1. 带上下文的对话

```typescript
const response = await ChatService.sendMessage({
  message: '继续之前的话题',
  session_id: sessionId,
  character_id: selectedCharacterId,
  context_messages: [
    { role: 'user', content: '你好' },
    { role: 'assistant', content: '你好！有什么可以帮助你的吗？' },
  ],
})
```

### 2. 获取聊天历史

```typescript
const history = await ChatService.getChatHistory(sessionId, 50)
console.log('历史消息:', history.messages)
```

### 3. 清空聊天记录

```typescript
await ChatService.clearChatHistory(sessionId)
```

## 调试技巧

### 启用详细日志

```typescript
// 在ChatWindow组件中添加
useEffect(() => {
  console.log('当前选中角色:', selectedCharacterId)
  console.log('会话ID:', sessionId)
  console.log('消息列表:', messages)
}, [selectedCharacterId, sessionId, messages])
```

### 监控API调用

```typescript
const handleSendMessage = async () => {
  console.log('[发送消息] 开始', {
    message,
    selectedCharacterId,
    sessionId,
  })

  try {
    const response = await ChatService.sendMessage({...})
    console.log('[发送消息] 成功', response)
  } catch (error) {
    console.error('[发送消息] 失败', error)
  }
}
```

## 性能优化建议

1. **使用React.memo**优化角色选择器：
```tsx
export const CharacterSelector = React.memo<CharacterSelectorProps>(({...}) => {
  // 组件代码
})
```

2. **防抖输入**：
```tsx
import { useMemo } from 'react'
import debounce from 'lodash/debounce'

const debouncedSend = useMemo(
  () => debounce(handleSendMessage, 300),
  []
)
```

3. **虚拟滚动**（对于大量消息）：
```tsx
import { FixedSizeList } from 'react-window'
```

## 样式自定义

### 修改角色选择器样式

你可以通过修改`CharacterSelector.tsx`中的内联样式来自定义外观，或者使用CSS模块/Tailwind CSS。

### 主题适配

组件已适配应用的主题系统，使用CSS变量：
- `--color-background`
- `--color-foreground`
- `--color-primary`
- `--color-border`
- `--color-muted`

## 更多资源

- [角色模板服务文档](../src/services/characterTemplate.ts)
- [聊天服务文档](../src/services/chat/index.ts)
- [类型定义](../src/types/characterTemplate.ts)
