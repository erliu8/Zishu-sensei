/**
 * Chat 组件测试辅助工具
 * 
 * 提供 Chat 组件群专用的测试工具函数
 * @module Tests/Utils/ChatHelpers
 */

import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import { createMockMessage, createMockConversation } from '@/tests/mocks/factories'
import type { ChatMessage, ChatSession } from '@/types/chat'

// ==================== 消息测试工具 ====================

/**
 * 创建测试消息序列
 */
export function createTestMessageSequence(count: number = 5): ChatMessage[] {
  const messages: ChatMessage[] = []
  
  for (let i = 0; i < count; i++) {
    const isUserMessage = i % 2 === 0
    messages.push(createMockMessage({
      id: `msg-${i}`,
      role: isUserMessage ? 'user' : 'assistant',
      content: `${isUserMessage ? '用户' : '助手'}消息 ${i + 1}`,
      timestamp: Date.now() - (count - i) * 60000, // 倒序时间戳
    }))
  }
  
  return messages
}

/**
 * 创建包含不同类型消息的测试序列
 */
export function createMixedMessageSequence(): ChatMessage[] {
  return [
    createMockMessage({
      id: 'text-msg',
      role: 'user',
      content: '这是文本消息',
      type: 'text',
    }),
    createMockMessage({
      id: 'image-msg',
      role: 'user',
      content: '图片消息',
      type: 'image',
      attachments: [{
        type: 'image',
        url: 'https://example.com/image.jpg',
        name: 'image.jpg',
        size: 102400,
      }],
    }),
    createMockMessage({
      id: 'file-msg',
      role: 'user',
      content: '文件消息',
      type: 'file',
      attachments: [{
        type: 'file',
        url: 'https://example.com/document.pdf',
        name: 'document.pdf',
        size: 1024000,
      }],
    }),
    createMockMessage({
      id: 'voice-msg',
      role: 'user',
      content: '语音消息',
      type: 'voice',
      duration: 30,
      waveform: [0.1, 0.3, 0.5, 0.7, 0.4, 0.2],
    }),
    createMockMessage({
      id: 'code-msg',
      role: 'assistant',
      content: '```javascript\nconsole.log("Hello World");\n```',
      type: 'text',
    }),
  ]
}

/**
 * 模拟消息发送
 */
export async function simulateMessageSend(
  messageText: string,
  options?: {
    expectLoading?: boolean
    expectError?: boolean
    delay?: number
  }
) {
  const { expectLoading = false, expectError = false, delay = 100 } = options || {}
  
  // 获取输入框和发送按钮
  const textarea = screen.getByTestId('message-textarea') || screen.getByRole('textbox')
  const sendButton = screen.getByTestId('send-button') || screen.getByRole('button', { name: /发送|send/i })
  
  // 输入消息
  fireEvent.change(textarea, { target: { value: messageText } })
  
  // 发送消息
  fireEvent.click(sendButton)
  
  if (expectLoading) {
    // 等待加载状态出现
    await waitFor(() => {
      expect(screen.getByTestId('sending-indicator') || screen.getByText(/发送中|sending/i)).toBeInTheDocument()
    })
  }
  
  if (expectError) {
    // 等待错误状态出现
    await waitFor(() => {
      expect(screen.getByText(/发送失败|send failed/i)).toBeInTheDocument()
    }, { timeout: delay + 1000 })
  } else {
    // 等待发送完成
    await waitFor(() => {
      expect(textarea).toHaveValue('')
    }, { timeout: delay + 1000 })
  }
}

/**
 * 等待消息渲染完成
 */
export async function waitForMessageRender(messageId: string, timeout: number = 5000) {
  await waitFor(() => {
    expect(screen.getByTestId(`message-${messageId}`) || screen.getByTestId(`message-bubble-${messageId}`)).toBeInTheDocument()
  }, { timeout })
}

/**
 * 验证消息内容
 */
export function verifyMessageContent(messageId: string, expectedContent: string) {
  const messageElement = screen.getByTestId(`message-${messageId}`) || screen.getByTestId(`message-bubble-${messageId}`)
  expect(messageElement).toHaveTextContent(expectedContent)
}

/**
 * 获取消息列表中的所有消息
 */
export function getAllRenderedMessages() {
  return screen.getAllByTestId(/message-bubble-|message-/)
}

/**
 * 验证消息顺序
 */
export function verifyMessageOrder(expectedOrder: string[]) {
  const messages = getAllRenderedMessages()
  expect(messages).toHaveLength(expectedOrder.length)
  
  messages.forEach((message, index) => {
    const messageId = expectedOrder[index]
    expect(message).toHaveAttribute('data-testid', `message-bubble-${messageId}`)
  })
}

// ==================== 会话测试工具 ====================

/**
 * 创建测试会话
 */
export function createTestSession(overrides?: Partial<ChatSession>): ChatSession {
  const defaultSession: ChatSession = {
    id: 'test-session',
    title: '测试对话',
    messages: createTestMessageSequence(3),
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  }
  
  return { ...defaultSession, ...overrides }
}

/**
 * 创建多个测试会话
 */
export function createTestSessions(count: number = 3): ChatSession[] {
  return Array.from({ length: count }, (_, i) =>
    createTestSession({
      id: `session-${i + 1}`,
      title: `测试对话 ${i + 1}`,
      messages: createTestMessageSequence(Math.floor(Math.random() * 10) + 1),
      createdAt: Date.now() - (count - i) * 86400000,
    })
  )
}

/**
 * 模拟会话切换
 */
export async function simulateSessionSwitch(sessionId: string) {
  const sessionElement = screen.getByTestId(`session-${sessionId}`)
  fireEvent.click(sessionElement)
  
  await waitFor(() => {
    expect(sessionElement).toHaveClass('active')
  })
}

/**
 * 模拟创建新会话
 */
export async function simulateNewSession(title?: string) {
  const newSessionButton = screen.getByText(/新建对话|新建会话|new session/i) || screen.getByLabelText(/新建对话|new session/i)
  fireEvent.click(newSessionButton)
  
  if (title) {
    await waitFor(() => {
      expect(screen.getByText(title)).toBeInTheDocument()
    })
  } else {
    await waitFor(() => {
      expect(screen.getByText(/新对话|new conversation/i)).toBeInTheDocument()
    })
  }
}

/**
 * 模拟删除会话
 */
export async function simulateSessionDelete(sessionId: string) {
  const sessionElement = screen.getByTestId(`session-${sessionId}`)
  const deleteButton = sessionElement.querySelector('button') || screen.getByLabelText(/删除|delete/i)
  
  fireEvent.click(deleteButton)
  
  await waitFor(() => {
    expect(screen.queryByTestId(`session-${sessionId}`)).not.toBeInTheDocument()
  })
}

// ==================== 交互测试工具 ====================

/**
 * 模拟语音输入
 */
export async function simulateVoiceInput(resultText: string) {
  const voiceButton = screen.getByLabelText(/语音输入|voice input/i)
  fireEvent.click(voiceButton)
  
  // 模拟语音识别结果
  const voiceInput = screen.getByTestId('voice-input')
  const recordButton = voiceInput.querySelector('button')!
  fireEvent.click(recordButton)
  
  // 等待语音转文字结果
  await waitFor(() => {
    const textarea = screen.getByTestId('message-textarea')
    expect(textarea).toHaveValue(resultText)
  })
}

/**
 * 模拟文件上传
 */
export async function simulateFileUpload(files: File[]) {
  const fileInput = screen.getByTestId('file-input') || screen.getByRole('button', { name: /上传文件|upload/i })
  
  if (fileInput.tagName === 'INPUT') {
    fireEvent.change(fileInput, { target: { files } })
  } else {
    fireEvent.click(fileInput)
    const actualInput = screen.getByTestId('file-input')
    fireEvent.change(actualInput, { target: { files } })
  }
  
  // 等待文件显示
  await waitFor(() => {
    files.forEach(file => {
      expect(screen.getByText(file.name)).toBeInTheDocument()
    })
  })
}

/**
 * 模拟表情插入
 */
export async function simulateEmojiInsert(emoji: string) {
  const emojiButton = screen.getByLabelText(/插入表情|emoji/i)
  fireEvent.click(emojiButton)
  
  await waitFor(() => {
    expect(screen.getByTestId('emoji-picker')).toBeInTheDocument()
  })
  
  const emojiOption = screen.getByText(emoji)
  fireEvent.click(emojiOption)
  
  // 验证表情已插入到输入框
  await waitFor(() => {
    const textarea = screen.getByTestId('message-textarea')
    expect(textarea.value).toContain(emoji)
  })
}

/**
 * 模拟快捷键操作
 */
export async function simulateKeyboardShortcut(shortcut: string) {
  const shortcuts: Record<string, string> = {
    'new-session': '{Control>}n{/Control}',
    'search': '{Control>}f{/Control}',
    'settings': '{Control>},{/Control}',
    'send': '{Control>}{Enter}{/Control}',
    'clear': '{Escape}',
  }
  
  const keySequence = shortcuts[shortcut] || shortcut
  fireEvent.keyDown(document.body, { key: keySequence })
}

// ==================== 状态验证工具 ====================

/**
 * 验证组件状态
 */
export function verifyComponentState(
  component: string,
  expectedState: Record<string, any>
) {
  const element = screen.getByTestId(component)
  
  Object.entries(expectedState).forEach(([key, value]) => {
    if (key === 'class') {
      expect(element).toHaveClass(value)
    } else if (key === 'text') {
      expect(element).toHaveTextContent(value)
    } else if (key === 'attribute') {
      expect(element).toHaveAttribute(value.name, value.value)
    } else if (key === 'disabled') {
      if (value) {
        expect(element).toBeDisabled()
      } else {
        expect(element).not.toBeDisabled()
      }
    }
  })
}

/**
 * 验证加载状态
 */
export function verifyLoadingState(isLoading: boolean) {
  if (isLoading) {
    expect(screen.getByTestId('loading-indicator') || screen.getByText(/加载中|loading/i)).toBeInTheDocument()
  } else {
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    expect(screen.queryByText(/加载中|loading/i)).not.toBeInTheDocument()
  }
}

/**
 * 验证错误状态
 */
export function verifyErrorState(hasError: boolean, errorMessage?: string) {
  if (hasError) {
    expect(screen.getByTestId('error-indicator') || screen.getByRole('alert')).toBeInTheDocument()
    if (errorMessage) {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    }
  } else {
    expect(screen.queryByTestId('error-indicator')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  }
}

/**
 * 验证连接状态
 */
export function verifyConnectionState(isConnected: boolean) {
  const connectionStatus = screen.getByTestId('connection-status')
  
  if (isConnected) {
    expect(connectionStatus).toHaveTextContent(/已连接|connected/i)
    expect(connectionStatus).toHaveClass('connected')
  } else {
    expect(connectionStatus).toHaveTextContent(/连接断开|disconnected/i)
    expect(connectionStatus).toHaveClass('disconnected')
  }
}

// ==================== 性能测试工具 ====================

/**
 * 测量渲染性能
 */
export function measureRenderTime(renderFn: () => void): number {
  const startTime = performance.now()
  renderFn()
  const endTime = performance.now()
  return endTime - startTime
}

/**
 * 模拟大量数据
 */
export function createLargeDataSet(type: 'messages' | 'sessions', count: number) {
  if (type === 'messages') {
    return Array.from({ length: count }, (_, i) =>
      createMockMessage({
        id: `msg-${i}`,
        content: `消息 ${i + 1}`,
        timestamp: Date.now() - i * 1000,
      })
    )
  } else {
    return Array.from({ length: count }, (_, i) =>
      createTestSession({
        id: `session-${i}`,
        title: `对话 ${i + 1}`,
        messages: createTestMessageSequence(Math.floor(Math.random() * 50)),
      })
    )
  }
}

/**
 * 验证虚拟滚动
 */
export function verifyVirtualScrolling(containerTestId: string, expectedVisibleCount: number) {
  const container = screen.getByTestId(containerTestId)
  const visibleItems = container.querySelectorAll('[data-testid*="item-"]')
  
  expect(visibleItems.length).toBeLessThanOrEqual(expectedVisibleCount)
}

// ==================== 无障碍测试工具 ====================

/**
 * 验证 ARIA 属性
 */
export function verifyAriaAttributes(
  testId: string,
  expectedAttributes: Record<string, string>
) {
  const element = screen.getByTestId(testId)
  
  Object.entries(expectedAttributes).forEach(([attr, value]) => {
    expect(element).toHaveAttribute(attr, value)
  })
}

/**
 * 验证键盘导航
 */
export async function verifyKeyboardNavigation(
  elements: string[],
  user: any
) {
  for (let i = 0; i < elements.length; i++) {
    await user.tab()
    const element = screen.getByTestId(elements[i])
    expect(element).toHaveFocus()
  }
}

/**
 * 验证屏幕阅读器支持
 */
export function verifyScreenReaderSupport(testId: string) {
  const element = screen.getByTestId(testId)
  
  // 检查必要的 ARIA 属性
  expect(element).toHaveAttribute('role')
  
  const role = element.getAttribute('role')
  if (role === 'button') {
    expect(element).toHaveAttribute('aria-label')
  } else if (role === 'textbox') {
    expect(element).toHaveAttribute('aria-label')
  } else if (role === 'list') {
    expect(element).toHaveAttribute('aria-label')
  }
}

// ==================== 测试断言扩展 ====================

/**
 * 自定义匹配器：检查消息是否正确显示
 */
export function toHaveMessage(received: any, messageId: string, content: string) {
  const messageElement = received.querySelector(`[data-testid="message-${messageId}"]`) ||
                         received.querySelector(`[data-testid="message-bubble-${messageId}"]`)
  
  if (!messageElement) {
    return {
      pass: false,
      message: () => `Expected to find message with id "${messageId}"`,
    }
  }
  
  const hasContent = messageElement.textContent?.includes(content)
  
  return {
    pass: !!hasContent,
    message: () =>
      hasContent
        ? `Expected message "${messageId}" not to contain "${content}"`
        : `Expected message "${messageId}" to contain "${content}"`,
  }
}

/**
 * 自定义匹配器：检查会话是否处于活动状态
 */
export function toHaveActiveSession(received: any, sessionId: string) {
  const sessionElement = received.querySelector(`[data-testid="session-${sessionId}"]`)
  
  if (!sessionElement) {
    return {
      pass: false,
      message: () => `Expected to find session with id "${sessionId}"`,
    }
  }
  
  const isActive = sessionElement.classList.contains('active')
  
  return {
    pass: isActive,
    message: () =>
      isActive
        ? `Expected session "${sessionId}" not to be active`
        : `Expected session "${sessionId}" to be active`,
  }
}

// 导出所有工具函数
export const chatTestHelpers = {
  // 消息工具
  createTestMessageSequence,
  createMixedMessageSequence,
  simulateMessageSend,
  waitForMessageRender,
  verifyMessageContent,
  getAllRenderedMessages,
  verifyMessageOrder,
  
  // 会话工具
  createTestSession,
  createTestSessions,
  simulateSessionSwitch,
  simulateNewSession,
  simulateSessionDelete,
  
  // 交互工具
  simulateVoiceInput,
  simulateFileUpload,
  simulateEmojiInsert,
  simulateKeyboardShortcut,
  
  // 状态验证
  verifyComponentState,
  verifyLoadingState,
  verifyErrorState,
  verifyConnectionState,
  
  // 性能工具
  measureRenderTime,
  createLargeDataSet,
  verifyVirtualScrolling,
  
  // 无障碍工具
  verifyAriaAttributes,
  verifyKeyboardNavigation,
  verifyScreenReaderSupport,
  
  // 自定义匹配器
  toHaveMessage,
  toHaveActiveSession,
}

export default chatTestHelpers
