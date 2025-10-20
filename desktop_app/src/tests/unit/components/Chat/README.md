# Chat 组件测试套件

这是 Zishu Sensei 桌面应用程序 Chat 组件群的完整测试套件。

## 📋 测试覆盖范围

### 核心组件测试

- **Chat.test.tsx** - Chat 主组件测试
  - 会话管理
  - 消息发送与接收
  - 实时通信
  - 设置管理
  - 搜索功能
  - 文件处理
  - 快捷键操作

- **ChatWindow.test.tsx** - 聊天窗口组件测试
  - 窗口渲染与控制
  - 消息交互
  - 状态管理
  - 快捷键支持
  - 响应式布局

- **MessageList.test.tsx** - 消息列表组件测试
  - 消息渲染与滚动
  - 虚拟滚动优化
  - 消息分组与搜索
  - 正在输入指示器
  - 无障碍功能

- **MessageBubble.test.tsx** - 消息气泡组件测试
  - 内容渲染（文本、图片、文件、语音）
  - 交互功能（复制、编辑、删除）
  - 状态显示
  - 动画效果
  - 特殊内容处理

- **InputBox.test.tsx** - 输入框组件测试
  - 文本输入与发送
  - 工具栏功能
  - 快捷键操作
  - 自动完成
  - 格式化功能
  - 草稿保存

- **VoiceInput.test.tsx** - 语音输入组件测试
  - 录音功能
  - 播放功能
  - 语音识别
  - 音频设备管理
  - 音频处理

- **TypingIndicator.test.tsx** - 正在输入指示器测试
  - 动画效果
  - 状态管理
  - 多用户显示
  - 无障碍支持

## 🛠️ 测试工具

### 测试辅助工具 (`chat-test-helpers.ts`)

提供专门为 Chat 组件设计的测试工具函数：

```typescript
import { chatTestHelpers } from '@/tests/utils/chat-test-helpers'

// 创建测试消息
const messages = chatTestHelpers.createTestMessageSequence(5)

// 模拟消息发送
await chatTestHelpers.simulateMessageSend('测试消息')

// 验证消息内容
chatTestHelpers.verifyMessageContent('msg-1', '测试消息')
```

### Mock 数据 (`chat-mocks.ts`)

提供完整的 Mock 服务和 API：

```typescript
import { chatMocks, setupChatMocks } from '@/tests/mocks/chat-mocks'

// 设置 Mock 环境
setupChatMocks()

// 使用 Mock 服务
const response = await chatMocks.chatService.sendMessage('测试')
```

### 测试环境设置 (`chat-test-setup.ts`)

统一配置测试环境和提供测试工具：

```typescript
import { chatTestUtils } from '@/tests/setup/chat-test-setup'

// 创建测试环境
const testEnv = chatTestUtils.createChatTestEnvironment({
  sessions: 3,
  messages: 10,
  enableRealtime: true
})
```

## 🚀 快速开始

### 1. 运行所有 Chat 组件测试

```bash
# 运行所有 Chat 组件测试
npm test -- tests/unit/components/Chat

# 运行特定组件测试
npm test -- tests/unit/components/Chat/ChatWindow.test.tsx

# 运行测试并生成覆盖率报告
npm run test:coverage -- tests/unit/components/Chat
```

### 2. 编写新测试

```typescript
import { describe, it, expect } from 'vitest'
import { renderWithProviders } from '@/tests/utils/test-utils'
import { chatTestHelpers } from '@/tests/utils/chat-test-helpers'
import { YourComponent } from '@/components/Chat/YourComponent'

describe('YourComponent', () => {
  it('应该正确渲染', () => {
    const messages = chatTestHelpers.createTestMessageSequence(3)
    renderWithProviders(<YourComponent messages={messages} />)
    
    expect(screen.getByTestId('your-component')).toBeInTheDocument()
  })
})
```

### 3. 使用测试工具

```typescript
import { chatTestUtils } from '@/tests/setup/chat-test-setup'

// 模拟用户交互序列
await chatTestUtils.simulateUserInteractionSequence([
  { type: 'type', target: 'message-textarea', value: '测试消息' },
  { type: 'click', target: 'send-button' },
], user)

// 等待动画完成
await chatTestUtils.waitForAnimation(300)

// 验证组件状态
chatTestHelpers.verifyComponentState('chat-window', {
  class: 'active',
  text: '新消息',
})
```

## 📊 测试类型

### 1. 单元测试
- 组件渲染测试
- 属性传递测试
- 事件处理测试
- 状态管理测试

### 2. 集成测试
- 组件间交互测试
- 数据流测试
- 完整用户流程测试

### 3. 性能测试
- 大量数据渲染测试
- 虚拟滚动测试
- 内存泄漏检测

### 4. 无障碍测试
- ARIA 属性测试
- 键盘导航测试
- 屏幕阅读器支持测试

### 5. 错误处理测试
- 网络错误处理
- API 错误处理
- 边界条件测试

## 🔧 测试配置

### 自定义匹配器

测试套件提供了专门的自定义匹配器：

```typescript
// 检查消息是否正确显示
expect(container).toHaveMessage('msg-1', '测试消息')

// 检查会话是否处于活动状态
expect(container).toHaveActiveSession('session-1')

// 检查连接状态
expect(container).toBeConnected()

// 检查加载状态
expect(container).toBeLoading()

// 检查错误状态
expect(container).toHaveError('网络错误')
```

### 环境变量

测试环境使用以下配置：

```typescript
process.env.NODE_ENV = 'test'
process.env.VITE_API_BASE_URL = 'http://localhost:3000'
process.env.VITE_WS_URL = 'ws://localhost:3001'
```

## 🎯 最佳实践

### 1. 测试命名

```typescript
describe('Chat 组件', () => {
  describe('基础渲染', () => {
    it('应该正确渲染聊天界面', () => {
      // 测试代码
    })
  })
  
  describe('消息交互', () => {
    it('应该支持发送文本消息', async () => {
      // 测试代码
    })
  })
})
```

### 2. Mock 使用

```typescript
beforeEach(() => {
  // 清理 Mock
  vi.clearAllMocks()
  
  // 设置默认 Mock 返回值
  chatMocks.chatService.sendMessage.mockResolvedValue(mockResponse)
})
```

### 3. 异步测试

```typescript
it('应该处理异步操作', async () => {
  const { user } = renderWithProviders(<Chat />)
  
  // 触发异步操作
  await user.click(screen.getByText('发送'))
  
  // 等待异步操作完成
  await waitFor(() => {
    expect(screen.getByText('发送成功')).toBeInTheDocument()
  })
})
```

### 4. 错误测试

```typescript
it('应该处理发送失败', async () => {
  // 模拟失败
  chatMocks.chatService.sendMessage.mockRejectedValue(new Error('发送失败'))
  
  const { user } = renderWithProviders(<Chat />)
  await user.click(screen.getByText('发送'))
  
  await waitFor(() => {
    expect(screen.getByText('发送失败')).toBeInTheDocument()
  })
})
```

## 📈 测试指标

目标测试覆盖率：
- **行覆盖率**: ≥ 90%
- **分支覆盖率**: ≥ 85%
- **函数覆盖率**: ≥ 95%
- **语句覆盖率**: ≥ 90%

## 🔍 调试测试

### 1. 运行单个测试

```bash
npm test -- tests/unit/components/Chat/Chat.test.tsx -t "应该发送消息"
```

### 2. 调试模式

```bash
npm test -- --inspect-brk tests/unit/components/Chat/Chat.test.tsx
```

### 3. 查看测试输出

```typescript
import { screen } from '@testing-library/react'

// 打印当前 DOM 结构
screen.debug()

// 打印特定元素
screen.debug(screen.getByTestId('chat-window'))
```

## 📚 相关文档

- [测试实施计划](../../../docs/TEST_IMPLEMENTATION_PLAN.md)
- [测试计划](../../../docs/TEST_PLAN.md)
- [测试工具文档](../../utils/README.md)
- [Mock 数据文档](../../mocks/README.md)

## 🤝 贡献指南

1. 编写测试时遵循现有的命名规范
2. 确保新测试能够独立运行
3. 添加适当的注释和文档
4. 运行全部测试确保没有破坏现有功能
5. 提交前检查测试覆盖率

## ❓ 常见问题

### Q: 如何处理异步组件测试？
A: 使用 `waitFor` 和 `findBy*` 查询方法等待异步操作完成。

### Q: 如何模拟 WebSocket 连接？
A: 使用 `MockWebSocket` 类模拟 WebSocket 行为。

### Q: 如何测试文件上传功能？
A: 使用 `user.upload` 方法模拟文件选择。

### Q: 如何测试语音功能？
A: 使用 `MockMediaRecorder` 和 `MockSpeechRecognition` 模拟语音 API。

### Q: 测试运行缓慢怎么办？
A: 检查是否有不必要的 `waitFor` 调用，使用 fake timers 加速动画测试。
