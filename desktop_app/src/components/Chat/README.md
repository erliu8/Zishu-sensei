# Chat 组件

完整的聊天界面组件，包含消息列表、输入框和语音输入功能。

## 组件结构

```
Chat/
├── index.tsx                    # 主聊天组件
├── Chat.module.css              # 主组件样式
├── MessageList/                 # 消息列表组件
│   ├── index.tsx
│   ├── MessageItem.tsx
│   ├── MessageList.module.css
│   └── MessageItem.module.css
├── InputBox/                    # 输入框组件
│   ├── index.tsx
│   ├── InputBox.module.css
│   └── InputBox.types.ts
└── VoiceInput/                  # 语音输入组件（待实现）
    ├── index.tsx
    └── VoiceInput.module.css
```

## 功能特性

### Chat 主组件
- ✅ 消息发送和接收
- ✅ 流式响应支持
- ✅ 会话管理
- ✅ 错误处理
- ✅ 空状态展示
- ✅ 加载状态
- ✅ 响应式布局
- ✅ 建议提示词

### MessageList 组件
- ✅ 自动滚动到底部
- ✅ 新消息提示
- ✅ 加载历史消息
- ✅ 按日期分组
- ✅ 流式响应支持
- ✅ 虚拟滚动支持（可选）

### MessageItem 组件
- ✅ 不同角色展示（用户/助手/系统）
- ✅ 消息状态展示
- ✅ Markdown 渲染
- ✅ 代码高亮
- ✅ 消息操作（复制/编辑/删除/置顶/收藏）
- ✅ 动画效果

### InputBox 组件
- ✅ 多行文本输入
- ✅ 自动调整高度
- ✅ 字符计数和限制
- ✅ 快捷键支持（Ctrl+Enter 发送）
- ✅ 表情选择器
- ✅ 文件上传
- ✅ 语音输入按钮
- ✅ 建议提示词
- ✅ 附件预览

## 使用示例

### 基础使用

```tsx
import { Chat } from '@/components/Chat'
import type { ChatMessage, ChatSession } from '@/types/chat'

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)

  const handleSendMessage = async (message: string) => {
    setIsSending(true)
    try {
      // 发送消息到后端
      const response = await chatService.sendMessage(message)
      setMessages(prev => [...prev, response])
    } catch (error) {
      console.error('发送失败:', error)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Chat
      messages={messages}
      isSending={isSending}
      onSendMessage={handleSendMessage}
    />
  )
}
```

### 完整配置

```tsx
import { Chat } from '@/components/Chat'
import type { Suggestion } from '@/components/Chat/InputBox'

function AdvancedChatPage() {
  const [session, setSession] = useState<ChatSession>()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 建议提示词
  const suggestions: Suggestion[] = [
    {
      id: '1',
      text: '帮我写一篇关于人工智能的文章',
      icon: '✍️',
      type: 'prompt'
    },
    {
      id: '2',
      text: '解释一下量子计算的原理',
      icon: '🔬',
      type: 'prompt'
    },
    {
      id: '3',
      text: '推荐一些学习编程的资源',
      icon: '💻',
      type: 'prompt'
    }
  ]

  // 发送消息
  const handleSendMessage = async (message: string, attachments?: Attachment[]) => {
    setIsSending(true)
    setError(null)
    
    try {
      const response = await chatService.sendMessage({
        message,
        sessionId: session?.id,
        attachments
      })
      
      setMessages(prev => [...prev, response])
    } catch (err) {
      setError('发送失败，请重试')
      console.error(err)
    } finally {
      setIsSending(false)
    }
  }

  // 重新生成回复
  const handleRegenerate = async (messageId: string) => {
    try {
      const response = await chatService.regenerateMessage(messageId)
      setMessages(prev => 
        prev.map(msg => msg.id === messageId ? response : msg)
      )
    } catch (err) {
      setError('重新生成失败')
    }
  }

  // 编辑消息
  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      await chatService.updateMessage(messageId, content)
      setMessages(prev =>
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, content, metadata: { ...msg.metadata, edited: true } }
            : msg
        )
      )
    } catch (err) {
      setError('编辑失败')
    }
  }

  // 删除消息
  const handleDeleteMessage = async (messageId: string) => {
    try {
      await chatService.deleteMessage(messageId)
      setMessages(prev => prev.filter(msg => msg.id !== messageId))
    } catch (err) {
      setError('删除失败')
    }
  }

  // 附件上传
  const handleAttachmentAdd = async (file: File): Promise<Attachment> => {
    // 上传文件到服务器
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })
    
    const data = await response.json()
    
    return {
      id: data.id,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      url: data.url,
      type: getFileType(file.type),
      previewUrl: data.previewUrl
    }
  }

  return (
    <Chat
      session={session}
      messages={messages}
      isSending={isSending}
      isStreaming={isStreaming}
      error={error}
      showAvatar={true}
      showTimestamp={true}
      showActions={true}
      showSessionInfo={true}
      showSettingsButton={true}
      inputPlaceholder="输入消息..."
      maxMessageLength={10000}
      enableAttachments={true}
      enableEmoji={true}
      enableVoice={true}
      suggestions={suggestions}
      onSendMessage={handleSendMessage}
      onRegenerate={handleRegenerate}
      onEditMessage={handleEditMessage}
      onDeleteMessage={handleDeleteMessage}
      onAttachmentAdd={handleAttachmentAdd}
      onRetry={() => setError(null)}
    />
  )
}
```

### 流式响应

```tsx
function StreamingChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)

  const handleSendMessage = async (message: string) => {
    // 创建临时消息
    const tempMessageId = `temp-${Date.now()}`
    const assistantMessage: ChatMessage = {
      id: tempMessageId,
      sessionId: session?.id || '',
      role: MessageRole.ASSISTANT,
      type: MessageType.TEXT,
      content: '',
      status: MessageStatus.RECEIVING,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, assistantMessage])
    setStreamingMessageId(tempMessageId)
    setIsStreaming(true)

    try {
      // 使用 SSE 或 WebSocket 接收流式响应
      const stream = await chatService.sendMessageStream(message)
      
      for await (const chunk of stream) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempMessageId
              ? { ...msg, content: msg.content + chunk.delta }
              : msg
          )
        )
      }

      // 更新最终状态
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessageId
            ? { ...msg, status: MessageStatus.RECEIVED }
            : msg
        )
      )
    } catch (err) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempMessageId
            ? { ...msg, status: MessageStatus.FAILED }
            : msg
        )
      )
    } finally {
      setIsStreaming(false)
      setStreamingMessageId(null)
    }
  }

  return (
    <Chat
      messages={messages}
      isStreaming={isStreaming}
      onSendMessage={handleSendMessage}
    />
  )
}
```

## Props API

### Chat 组件

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `session` | `ChatSession` | - | 当前会话 |
| `messages` | `ChatMessage[]` | `[]` | 消息列表 |
| `isLoading` | `boolean` | `false` | 是否正在加载 |
| `isSending` | `boolean` | `false` | 是否正在发送 |
| `isStreaming` | `boolean` | `false` | 是否正在流式响应 |
| `error` | `string \| null` | `null` | 错误信息 |
| `showAvatar` | `boolean` | `true` | 是否显示头像 |
| `showTimestamp` | `boolean` | `true` | 是否显示时间戳 |
| `showActions` | `boolean` | `true` | 是否显示操作按钮 |
| `compact` | `boolean` | `false` | 是否紧凑模式 |
| `enableAttachments` | `boolean` | `true` | 是否启用附件 |
| `enableEmoji` | `boolean` | `true` | 是否启用表情 |
| `enableVoice` | `boolean` | `true` | 是否启用语音 |
| `suggestions` | `Suggestion[]` | `[]` | 建议列表 |
| `onSendMessage` | `(message: string, attachments?: Attachment[]) => void` | - | 发送消息回调 |
| `onRegenerate` | `(messageId: string) => void` | - | 重新生成回调 |
| `onEditMessage` | `(messageId: string, content: string) => void` | - | 编辑消息回调 |
| `onDeleteMessage` | `(messageId: string) => void` | - | 删除消息回调 |

### InputBox 组件

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `value` | `string` | - | 输入值（受控） |
| `placeholder` | `string` | `'输入消息...'` | 占位符文本 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `isSending` | `boolean` | `false` | 是否正在发送 |
| `maxLength` | `number` | `10000` | 最大字符数 |
| `minRows` | `number` | `1` | 最小行数 |
| `maxRows` | `number` | `10` | 最大行数 |
| `showCharCount` | `boolean` | `true` | 是否显示字符计数 |
| `sendShortcut` | `'enter' \| 'ctrl+enter' \| 'cmd+enter'` | `'ctrl+enter'` | 发送快捷键 |
| `suggestions` | `Suggestion[]` | `[]` | 建议列表 |
| `onChange` | `(value: string) => void` | - | 值变化回调 |
| `onSend` | `(message: string, attachments?: Attachment[]) => void` | - | 发送回调 |
| `onAttachmentAdd` | `(file: File) => Promise<Attachment>` | - | 附件添加回调 |

### MessageList 组件

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `messages` | `ChatMessage[]` | `[]` | 消息列表 |
| `isLoading` | `boolean` | `false` | 是否正在加载 |
| `isStreaming` | `boolean` | `false` | 是否正在流式传输 |
| `showDateSeparator` | `boolean` | `true` | 是否显示日期分隔符 |
| `showAvatar` | `boolean` | `true` | 是否显示头像 |
| `autoScrollToBottom` | `boolean` | `true` | 自动滚动到底部 |
| `hasMore` | `boolean` | `false` | 是否有更多历史消息 |
| `onLoadMore` | `() => void` | - | 加载更多回调 |
| `onCopyMessage` | `(content: string) => void` | - | 复制消息回调 |

## 样式定制

### CSS 变量

组件使用 CSS 变量，可以通过覆盖这些变量来定制样式：

```css
.chat {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-border: #e0e0e0;
  --color-text-primary: #333333;
  --color-text-secondary: #666666;
  --color-primary: #2196f3;
  --color-error: #f44336;
}
```

### 自定义类名

所有组件都支持 `className` 属性，可以添加自定义样式：

```tsx
<Chat
  className="my-custom-chat"
  messages={messages}
  onSendMessage={handleSend}
/>
```

## 无障碍支持

- ✅ 键盘导航支持
- ✅ ARIA 标签
- ✅ 屏幕阅读器支持
- ✅ 焦点管理
- ✅ 减少动画选项

## 性能优化

- ✅ 使用 `React.memo` 避免不必要的重渲染
- ✅ 虚拟滚动支持（大量消息时）
- ✅ 防抖和节流
- ✅ 懒加载历史消息
- ✅ 图片懒加载

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 待实现功能

### 高优先级
- ⏳ 语音输入组件完整实现
- ⏳ 更丰富的 Markdown 渲染（使用 `react-markdown` + `remark-gfm`）
- ⏳ 代码高亮（使用 `highlight.js` 或 `prism.js`）
- ⏳ 拖拽上传文件
- ⏳ 图片粘贴上传

### 中优先级
- ⏳ 消息搜索（全文检索）
- ⏳ 消息导出（Markdown / HTML / PDF）
- ⏳ @提及功能
- ⏳ 消息引用/回复
- ⏳ 消息收藏夹
- ⏳ 快捷回复模板

### 低优先级
- ⏳ 消息反应（emoji reactions）
- ⏳ 消息投票
- ⏳ 消息分享
- ⏳ 对话分支
- ⏳ 协同编辑

## 技术栈推荐

### Markdown 渲染
```bash
npm install react-markdown remark-gfm rehype-raw rehype-sanitize
```

### 代码高亮
```bash
npm install highlight.js react-syntax-highlighter
# 或
npm install prismjs react-prism
```

### 表情选择器
```bash
npm install emoji-picker-react
# 或
npm install @emoji-mart/react @emoji-mart/data
```

### 文件上传
```bash
npm install react-dropzone
```

### 日期处理
```bash
npm install date-fns
# 或
npm install dayjs
```

### 虚拟滚动（大量消息）
```bash
npm install react-window
# 或
npm install @tanstack/react-virtual
```

## 常见问题 (FAQ)

### Q: 如何自定义消息样式？
A: 可以通过覆盖 CSS 变量或传递自定义 className：

```tsx
<Chat
  className="my-custom-chat"
  messages={messages}
  onSendMessage={handleSend}
/>
```

```css
.my-custom-chat {
  --color-primary: #ff6b6b;
  --color-bg-primary: #f0f0f0;
}
```

### Q: 如何处理长消息的性能问题？
A: 使用虚拟滚动和懒加载：

```tsx
import { MessageList } from '@/components/Chat/MessageList'

<MessageList
  messages={messages}
  enableVirtualScroll={true}
  hasMore={hasMore}
  onLoadMore={loadMoreMessages}
/>
```

### Q: 如何实现消息持久化？
A: 可以结合 IndexedDB 或 localStorage：

```tsx
import { useEffect } from 'react'

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  
  // 加载历史消息
  useEffect(() => {
    const savedMessages = localStorage.getItem('chat_messages')
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages))
    }
  }, [])
  
  // 保存消息
  useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(messages))
  }, [messages])
  
  return <Chat messages={messages} onSendMessage={handleSend} />
}
```

### Q: 如何集成第三方 AI API？
A: 参考以下示例：

```tsx
async function handleSendMessage(message: string) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    })
    
    const data = await response.json()
    setMessages(prev => [...prev, data.message])
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}
```

### Q: 如何实现打字指示器？
A: 监听远程用户的输入状态：

```tsx
const [isTyping, setIsTyping] = useState(false)

// 通过 WebSocket 接收打字状态
socket.on('user_typing', () => setIsTyping(true))
socket.on('user_stopped_typing', () => setIsTyping(false))

<MessageList
  messages={messages}
  isTyping={isTyping}
/>
```

## 性能优化建议

1. **使用 React.memo** - 避免不必要的重渲染
2. **虚拟滚动** - 处理大量消息时使用
3. **懒加载历史** - 按需加载旧消息
4. **图片懒加载** - 使用 Intersection Observer
5. **防抖输入** - 减少输入事件处理频率
6. **代码分割** - 使用动态导入拆分大组件

```tsx
// 懒加载示例
const VoiceInput = lazy(() => import('./VoiceInput'))

<Suspense fallback={<Loading />}>
  <VoiceInput onResult={handleVoiceResult} />
</Suspense>
```

## 安全注意事项

1. **XSS 防护** - 确保 Markdown 渲染时净化 HTML
2. **文件上传验证** - 验证文件类型和大小
3. **内容审核** - 对用户输入进行敏感词过滤
4. **速率限制** - 防止消息发送过于频繁
5. **HTTPS** - 使用加密传输保护数据

```tsx
// 文件验证示例
const validateFile = (file: File): AttachmentValidation => {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf']
  
  if (file.size > maxSize) {
    return { valid: false, error: '文件过大', code: 'SIZE_EXCEEDED' }
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: '不支持的文件类型', code: 'TYPE_NOT_ALLOWED' }
  }
  
  return { valid: true }
}
```

## 贡献指南

欢迎贡献代码！在提交 PR 之前，请确保：

1. 代码符合 ESLint 规范
2. 添加必要的类型定义
3. 更新相关文档
4. 添加单元测试
5. 测试所有浏览器兼容性

## 更新日志

### v1.0.0 (2024-01-XX)
- ✅ 初始版本发布
- ✅ 基础聊天功能
- ✅ 流式响应支持
- ✅ 附件上传
- ✅ 表情选择器
- ✅ 建议提示词
- ✅ 响应式设计
- ✅ 暗色主题

## 相关资源

- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [Tauri 官方文档](https://tauri.app/)

## 许可证

MIT License

Copyright (c) 2024 Zishu-sensei Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

**Made with ❤️ by Zishu-sensei Team**

