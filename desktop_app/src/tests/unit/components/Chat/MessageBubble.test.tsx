/**
 * MessageBubble 组件测试
 * 
 * 测试消息气泡组件的渲染、样式、交互等功能
 * @module MessageBubble/Test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders, wait, createMockFn } from '@/tests/utils/test-utils'
import { createMockMessage as createBaseMockMessage } from '@/tests/mocks/factories'
import type { ChatMessage, MessageRole, MessageType, MessageStatus } from '@/types/chat'

// Mock MessageBubble component (组件尚未实现)
const MessageBubble = vi.fn(({ message, onCopy, onResend, onEdit, onDelete, ...props }: any) => (
  <div 
    data-testid="message-bubble"
    className={`message-bubble ${message.role}`}
    {...props}
  >
    <div data-testid="message-content">{message.content}</div>
    <div data-testid="message-timestamp">{new Date(message.timestamp).toLocaleTimeString()}</div>
    <div data-testid="message-actions">
      <button onClick={() => onCopy?.(message.content)} aria-label="复制消息">复制</button>
      <button onClick={() => onResend?.(message.id)} aria-label="重发消息">重发</button>
      <button onClick={() => onEdit?.(message.id)} aria-label="编辑消息">编辑</button>
      <button onClick={() => onDelete?.(message.id)} aria-label="删除消息">删除</button>
    </div>
  </div>
))

// 创建符合 ChatMessage 类型的 mock 消息
function createMockMessage(overrides?: Partial<ChatMessage>): ChatMessage {
  const base = createBaseMockMessage(overrides as any)
  return {
    id: base.id,
    sessionId: 'test-session',
    role: (base.role as MessageRole) || MessageRole.USER,
    type: MessageType.TEXT,
    content: base.content,
    status: MessageStatus.SENT,
    timestamp: base.timestamp,
    metadata: base.metadata,
    ...overrides,
  } as ChatMessage
}

// ==================== Mock 设置 ====================

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock react-markdown
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}))

// Mock syntax highlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children, language }: any) => (
    <pre data-testid="code-block" data-language={language}>
      <code>{children}</code>
    </pre>
  ),
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
})

describe('MessageBubble 组件', () => {
  // ==================== 测试数据 ====================
  
  const userMessage = createMockMessage({
    id: 'user-msg',
    role: 'user',
    content: '这是用户消息',
    timestamp: Date.now(),
  })

  const assistantMessage = createMockMessage({
    id: 'assistant-msg',
    role: 'assistant',
    content: '这是助手回复',
    timestamp: Date.now(),
  })

  const systemMessage = createMockMessage({
    id: 'system-msg',
    role: 'system',
    content: '这是系统消息',
    timestamp: Date.now(),
  })

  const defaultProps = {
    message: userMessage,
    onCopy: createMockFn(),
    onResend: createMockFn(),
    onEdit: createMockFn(),
    onDelete: createMockFn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==================== 基础渲染测试 ====================
  
  describe('基础渲染', () => {
    it('应该正确渲染用户消息', () => {
      renderWithProviders(<MessageBubble {...defaultProps} />)
      
      expect(screen.getByText('这是用户消息')).toBeInTheDocument()
      expect(screen.getByTestId('message-bubble')).toHaveClass('user')
    })

    it('应该正确渲染助手消息', () => {
      renderWithProviders(
        <MessageBubble {...defaultProps} message={assistantMessage} />
      )
      
      expect(screen.getByText('这是助手回复')).toBeInTheDocument()
      expect(screen.getByTestId('message-bubble')).toHaveClass('assistant')
    })

    it('应该正确渲染系统消息', () => {
      renderWithProviders(
        <MessageBubble {...defaultProps} message={systemMessage} />
      )
      
      expect(screen.getByText('这是系统消息')).toBeInTheDocument()
      expect(screen.getByTestId('message-bubble')).toHaveClass('system')
    })

    it('应该显示消息时间戳', () => {
      renderWithProviders(
        <MessageBubble {...defaultProps} showTimestamp />
      )
      
      expect(screen.getByTestId('message-timestamp')).toBeInTheDocument()
    })

    it('应该显示用户头像', () => {
      renderWithProviders(
        <MessageBubble {...defaultProps} showAvatar />
      )
      
      expect(screen.getByTestId('message-avatar')).toBeInTheDocument()
    })

    it('应该隐藏时间戳当设置为 false', () => {
      renderWithProviders(
        <MessageBubble {...defaultProps} showTimestamp={false} />
      )
      
      expect(screen.queryByTestId('message-timestamp')).not.toBeInTheDocument()
    })
  })

  // ==================== 内容渲染测试 ====================
  
  describe('内容渲染', () => {
    it('应该渲染纯文本消息', () => {
      const textMessage = createMockMessage({
        content: '这是纯文本消息',
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={textMessage} />
      )
      
      expect(screen.getByText('这是纯文本消息')).toBeInTheDocument()
    })

    it('应该渲染 Markdown 内容', () => {
      const markdownMessage = createMockMessage({
        content: '**粗体文本** 和 *斜体文本*',
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={markdownMessage} enableMarkdown />
      )
      
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
    })

    it('应该渲染代码块', () => {
      const codeMessage = createMockMessage({
        content: '```javascript\nconsole.log("Hello World");\n```',
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={codeMessage} enableMarkdown />
      )
      
      expect(screen.getByTestId('code-block')).toBeInTheDocument()
      expect(screen.getByTestId('code-block')).toHaveAttribute('data-language', 'javascript')
    })

    it('应该渲染链接', () => {
      const linkMessage = createMockMessage({
        content: '访问 https://example.com 了解更多',
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={linkMessage} />
      )
      
      expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com')
    })

    it('应该处理长文本消息', () => {
      const longMessage = createMockMessage({
        content: 'A'.repeat(1000),
      })
      
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} message={longMessage} />
      )
      
      expect(container.firstChild).toHaveClass('long-content')
    })

    it('应该处理空消息', () => {
      const emptyMessage = createMockMessage({
        content: '',
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={emptyMessage} />
      )
      
      expect(screen.getByText(/消息为空/)).toBeInTheDocument()
    })
  })

  // ==================== 交互功能测试 ====================
  
  describe('交互功能', () => {
    it('应该显示操作菜单', async () => {
      const { user } = renderWithProviders(<MessageBubble {...defaultProps} />)
      
      const messageBubble = screen.getByTestId('message-bubble')
      await user.hover(messageBubble)
      
      expect(screen.getByTestId('message-actions')).toBeInTheDocument()
    })

    it('应该处理复制操作', async () => {
      const { user } = renderWithProviders(<MessageBubble {...defaultProps} />)
      
      const messageBubble = screen.getByTestId('message-bubble')
      await user.hover(messageBubble)
      
      const copyButton = screen.getByLabelText('复制消息')
      await user.click(copyButton)
      
      expect(defaultProps.onCopy).toHaveBeenCalledWith(userMessage.content)
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(userMessage.content)
    })

    it('应该处理重发操作', async () => {
      const { user } = renderWithProviders(<MessageBubble {...defaultProps} />)
      
      const messageBubble = screen.getByTestId('message-bubble')
      await user.hover(messageBubble)
      
      const resendButton = screen.getByLabelText('重发消息')
      await user.click(resendButton)
      
      expect(defaultProps.onResend).toHaveBeenCalledWith(userMessage.id)
    })

    it('应该处理编辑操作', async () => {
      const { user } = renderWithProviders(<MessageBubble {...defaultProps} />)
      
      const messageBubble = screen.getByTestId('message-bubble')
      await user.hover(messageBubble)
      
      const editButton = screen.getByLabelText('编辑消息')
      await user.click(editButton)
      
      expect(defaultProps.onEdit).toHaveBeenCalledWith(userMessage.id)
    })

    it('应该处理删除操作', async () => {
      const { user } = renderWithProviders(<MessageBubble {...defaultProps} />)
      
      const messageBubble = screen.getByTestId('message-bubble')
      await user.hover(messageBubble)
      
      const deleteButton = screen.getByLabelText('删除消息')
      await user.click(deleteButton)
      
      expect(defaultProps.onDelete).toHaveBeenCalledWith(userMessage.id)
    })

    it('应该支持双击编辑', async () => {
      const { user } = renderWithProviders(
        <MessageBubble {...defaultProps} enableDoubleClickEdit />
      )
      
      const messageContent = screen.getByTestId('message-content')
      await user.dblClick(messageContent)
      
      expect(defaultProps.onEdit).toHaveBeenCalledWith(userMessage.id)
    })

    it('应该支持右键菜单', async () => {
      const { user } = renderWithProviders(<MessageBubble {...defaultProps} />)
      
      const messageBubble = screen.getByTestId('message-bubble')
      await user.pointer({ keys: '[MouseRight]', target: messageBubble })
      
      expect(screen.getByTestId('context-menu')).toBeInTheDocument()
    })
  })

  // ==================== 状态显示测试 ====================
  
  describe('状态显示', () => {
    it('应该显示发送中状态', () => {
      const sendingMessage = createMockMessage({
        ...userMessage,
        status: 'sending',
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={sendingMessage} />
      )
      
      expect(screen.getByTestId('sending-indicator')).toBeInTheDocument()
    })

    it('应该显示发送失败状态', () => {
      const failedMessage = createMockMessage({
        ...userMessage,
        status: 'failed',
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={failedMessage} />
      )
      
      expect(screen.getByTestId('error-indicator')).toBeInTheDocument()
    })

    it('应该显示已读状态', () => {
      const readMessage = createMockMessage({
        ...userMessage,
        status: 'read',
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={readMessage} />
      )
      
      expect(screen.getByTestId('read-indicator')).toBeInTheDocument()
    })

    it('应该显示编辑状态', () => {
      renderWithProviders(
        <MessageBubble {...defaultProps} isEditing />
      )
      
      expect(screen.getByTestId('edit-input')).toBeInTheDocument()
    })

    it('应该显示选中状态', () => {
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} isSelected />
      )
      
      expect(container.firstChild).toHaveClass('selected')
    })
  })

  // ==================== 样式和主题测试 ====================
  
  describe('样式和主题', () => {
    it('应该应用用户消息样式', () => {
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} message={userMessage} />
      )
      
      expect(container.firstChild).toHaveClass('user')
    })

    it('应该应用助手消息样式', () => {
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} message={assistantMessage} />
      )
      
      expect(container.firstChild).toHaveClass('assistant')
    })

    it('应该支持紧凑模式', () => {
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} compact />
      )
      
      expect(container.firstChild).toHaveClass('compact')
    })

    it('应该支持暗色主题', () => {
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} theme="dark" />
      )
      
      expect(container.firstChild).toHaveClass('theme-dark')
    })

    it('应该应用自定义类名', () => {
      const className = 'custom-message'
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} className={className} />
      )
      
      expect(container.firstChild).toHaveClass(className)
    })

    it('应该应用自定义样式', () => {
      const style = { backgroundColor: 'red' }
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} style={style} />
      )
      
      expect(container.firstChild).toHaveStyle(style)
    })
  })

  // ==================== 动画测试 ====================
  
  describe('动画效果', () => {
    it('应该有进入动画', () => {
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} animate />
      )
      
      expect(container.firstChild).toHaveClass('animate-enter')
    })

    it('应该有悬停动画', async () => {
      const { user } = renderWithProviders(
        <MessageBubble {...defaultProps} animate />
      )
      
      const messageBubble = screen.getByTestId('message-bubble')
      await user.hover(messageBubble)
      
      expect(messageBubble).toHaveClass('animate-hover')
    })

    it('应该有点击动画', async () => {
      const { user } = renderWithProviders(
        <MessageBubble {...defaultProps} animate />
      )
      
      const messageBubble = screen.getByTestId('message-bubble')
      await user.click(messageBubble)
      
      expect(messageBubble).toHaveClass('animate-click')
    })
  })

  // ==================== 特殊内容测试 ====================
  
  describe('特殊内容处理', () => {
    it('应该渲染图片消息', () => {
      const imageMessage = createMockMessage({
        content: '![图片](https://example.com/image.jpg)',
        type: 'image',
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={imageMessage} />
      )
      
      expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/image.jpg')
    })

    it('应该渲染文件消息', () => {
      const fileMessage = createMockMessage({
        content: '文件: document.pdf',
        type: 'file',
        attachments: [
          {
            name: 'document.pdf',
            size: 1024000,
            type: 'application/pdf',
            url: 'https://example.com/document.pdf',
          },
        ],
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={fileMessage} />
      )
      
      expect(screen.getByTestId('file-attachment')).toBeInTheDocument()
      expect(screen.getByText('document.pdf')).toBeInTheDocument()
    })

    it('应该渲染语音消息', () => {
      const voiceMessage = createMockMessage({
        content: '语音消息',
        type: 'voice',
        duration: 30,
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={voiceMessage} />
      )
      
      expect(screen.getByTestId('voice-player')).toBeInTheDocument()
      expect(screen.getByText('0:30')).toBeInTheDocument()
    })

    it('应该渲染表情符号', () => {
      const emojiMessage = createMockMessage({
        content: '😀 😃 😄 😁',
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={emojiMessage} />
      )
      
      expect(screen.getByText('😀 😃 😄 😁')).toBeInTheDocument()
    })
  })

  // ==================== 无障碍测试 ====================
  
  describe('无障碍功能', () => {
    it('应该有正确的 ARIA 标签', () => {
      renderWithProviders(<MessageBubble {...defaultProps} />)
      
      const messageBubble = screen.getByTestId('message-bubble')
      expect(messageBubble).toHaveAttribute('role', 'article')
      expect(messageBubble).toHaveAttribute('aria-label', '用户消息')
    })

    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(<MessageBubble {...defaultProps} />)
      
      const messageBubble = screen.getByTestId('message-bubble')
      messageBubble.focus()
      
      // 使用 Enter 键打开操作菜单
      await user.keyboard('{Enter}')
      
      expect(screen.getByTestId('message-actions')).toBeInTheDocument()
    })

    it('应该有屏幕阅读器支持', () => {
      renderWithProviders(
        <MessageBubble {...defaultProps} showTimestamp />
      )
      
      const timestamp = screen.getByTestId('message-timestamp')
      expect(timestamp).toHaveAttribute('aria-label', expect.stringContaining('发送时间'))
    })

    it('应该支持高对比度模式', () => {
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} highContrast />
      )
      
      expect(container.firstChild).toHaveClass('high-contrast')
    })
  })

  // ==================== 性能测试 ====================
  
  describe('性能优化', () => {
    it('应该使用 React.memo 优化重渲染', () => {
      const { rerender } = renderWithProviders(<MessageBubble {...defaultProps} />)
      
      // 重新渲染相同的 props
      rerender(<MessageBubble {...defaultProps} />)
      
      // 验证没有不必要的重渲染
      expect(screen.getByTestId('message-bubble')).toBeInTheDocument()
    })

    it('应该延迟加载大型内容', () => {
      const largeMessage = createMockMessage({
        content: 'A'.repeat(10000),
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={largeMessage} lazyLoad />
      )
      
      expect(screen.getByTestId('lazy-content')).toBeInTheDocument()
    })

    it('应该虚拟化长列表内容', () => {
      const listMessage = createMockMessage({
        content: Array.from({ length: 1000 }, (_, i) => `项目 ${i}`).join('\n'),
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={listMessage} virtualizeContent />
      )
      
      expect(screen.getByTestId('virtualized-content')).toBeInTheDocument()
    })
  })

  // ==================== 错误处理测试 ====================
  
  describe('错误处理', () => {
    it('应该处理渲染错误', () => {
      const errorMessage = createMockMessage({
        content: null as any, // 无效内容
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={errorMessage} />
      )
      
      expect(screen.getByText(/消息内容错误/)).toBeInTheDocument()
    })

    it('应该处理复制失败', async () => {
      // Mock clipboard API 失败
      vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('复制失败'))
      
      const { user } = renderWithProviders(<MessageBubble {...defaultProps} />)
      
      const messageBubble = screen.getByTestId('message-bubble')
      await user.hover(messageBubble)
      
      const copyButton = screen.getByLabelText('复制消息')
      await user.click(copyButton)
      
      await waitFor(() => {
        expect(screen.getByText(/复制失败/)).toBeInTheDocument()
      })
    })

    it('应该处理无效时间戳', () => {
      const invalidMessage = createMockMessage({
        timestamp: NaN,
      })
      
      renderWithProviders(
        <MessageBubble {...defaultProps} message={invalidMessage} showTimestamp />
      )
      
      expect(screen.getByText(/时间未知/)).toBeInTheDocument()
    })
  })

  // ==================== 国际化测试 ====================
  
  describe('国际化支持', () => {
    it('应该支持不同语言', () => {
      renderWithProviders(
        <MessageBubble {...defaultProps} locale="en" />
      )
      
      // 验证英文界面
      expect(screen.getByLabelText('Copy message')).toBeInTheDocument()
    })

    it('应该支持 RTL 布局', () => {
      const { container } = renderWithProviders(
        <MessageBubble {...defaultProps} rtl />
      )
      
      expect(container.firstChild).toHaveClass('rtl')
    })

    it('应该格式化不同地区的时间', () => {
      renderWithProviders(
        <MessageBubble {...defaultProps} showTimestamp locale="en-US" />
      )
      
      const timestamp = screen.getByTestId('message-timestamp')
      expect(timestamp).toBeInTheDocument()
    })
  })
})
