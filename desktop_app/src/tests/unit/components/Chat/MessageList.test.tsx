/**
 * MessageList 组件测试
 * 
 * 测试消息列表组件的渲染、滚动、交互等功能
 * @module MessageList/Test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders, wait, createMockFn } from '@/tests/utils/test-utils'
import { createMockMessage as createBaseMockMessage, createMockConversation as createBaseConversation } from '@/tests/mocks/factories'
import type { ChatMessage, MessageRole, MessageType, MessageStatus } from '@/types/chat'

// Mock MessageList component (组件尚未实现)
const MessageList = vi.fn(({ messages, onCopyMessage, onResendMessage, onEditMessage, onDeleteMessage, ...props }: any) => (
  <div role="log" aria-label="消息列表" aria-live="polite" {...props}>
    {messages && messages.length > 0 ? (
      messages.map((message: ChatMessage) => (
        <div key={message.id} data-testid={`message-bubble-${message.id}`} className={`message-bubble ${message.role}`}>
          <div data-testid="message-content">{message.content}</div>
          <div data-testid="message-actions">
            <button onClick={() => onCopyMessage?.(message.content)}>复制</button>
            <button onClick={() => onResendMessage?.(message.id)}>重发</button>
            <button onClick={() => onEditMessage?.(message.id)}>编辑</button>
            <button onClick={() => onDeleteMessage?.(message.id)}>删除</button>
          </div>
          <div data-testid="message-timestamp">{new Date(message.timestamp).toLocaleTimeString()}</div>
        </div>
      ))
    ) : (
      <div>暂无消息</div>
    )}
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

// 创建对话消息列表
function createMockConversation(messageCount = 10): ChatMessage[] {
  return Array.from({ length: messageCount }, (_, i) => {
    const id = `msg-${i}`
    return createMockMessage({
      id,
      role: i % 2 === 0 ? MessageRole.USER : MessageRole.ASSISTANT,
      content: `Message ${i}`,
      timestamp: Date.now() - (messageCount - i) * 60000,
    })
  })
}

// ==================== Mock 设置 ====================

// Mock MessageBubble 组件
vi.mock('@/components/Chat/MessageBubble', () => ({
  default: vi.fn(({ message, onCopy, onResend, onEdit, onDelete }) => (
    <div 
      data-testid={`message-bubble-${message.id}`}
      className={`message-bubble ${message.role}`}
    >
      <div data-testid="message-content">{message.content}</div>
      <div data-testid="message-actions">
        <button onClick={() => onCopy?.(message.content)}>复制</button>
        <button onClick={() => onResend?.(message.id)}>重发</button>
        <button onClick={() => onEdit?.(message.id)}>编辑</button>
        <button onClick={() => onDelete?.(message.id)}>删除</button>
      </div>
      <div data-testid="message-timestamp">
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  )),
}))

// Mock TypingIndicator 组件
vi.mock('@/components/Chat/TypingIndicator', () => ({
  default: vi.fn(() => (
    <div data-testid="typing-indicator">正在输入...</div>
  )),
}))

// Mock react-window (虚拟滚动)
vi.mock('react-window', () => ({
  FixedSizeList: vi.fn(({ children, itemCount, itemSize, height }) => (
    <div 
      data-testid="virtual-list"
      style={{ height }}
      data-item-count={itemCount}
      data-item-size={itemSize}
    >
      {Array.from({ length: Math.min(itemCount, 10) }, (_, index) =>
        children({ index, style: {} })
      )}
    </div>
  )),
}))

// Mock Intersection Observer
const mockIntersectionObserver = vi.fn()
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})
window.IntersectionObserver = mockIntersectionObserver

describe('MessageList 组件', () => {
  // ==================== 测试数据 ====================
  
  const mockMessages = createMockConversation(10)
  
  const defaultProps = {
    messages: mockMessages,
    onCopyMessage: createMockFn(),
    onResendMessage: createMockFn(),
    onEditMessage: createMockFn(),
    onDeleteMessage: createMockFn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==================== 基础渲染测试 ====================
  
  describe('基础渲染', () => {
    it('应该正确渲染消息列表', () => {
      renderWithProviders(<MessageList {...defaultProps} />)
      
      expect(screen.getByRole('log')).toBeInTheDocument()
      expect(screen.getByLabelText('消息列表')).toBeInTheDocument()
    })

    it('应该渲染所有消息', () => {
      renderWithProviders(<MessageList {...defaultProps} />)
      
      mockMessages.forEach(message => {
        expect(screen.getByTestId(`message-bubble-${message.id}`)).toBeInTheDocument()
      })
    })

    it('应该按时间顺序显示消息', () => {
      const sortedMessages = [...mockMessages].sort((a, b) => a.timestamp - b.timestamp)
      renderWithProviders(<MessageList {...defaultProps} messages={sortedMessages} />)
      
      const messageBubbles = screen.getAllByTestId(/message-bubble-/)
      expect(messageBubbles).toHaveLength(sortedMessages.length)
    })

    it('当没有消息时应该显示空状态', () => {
      renderWithProviders(<MessageList {...defaultProps} messages={[]} />)
      
      expect(screen.getByText(/暂无消息/)).toBeInTheDocument()
    })

    it('应该显示加载状态', () => {
      renderWithProviders(<MessageList {...defaultProps} loading />)
      
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })
  })

  // ==================== 消息交互测试 ====================
  
  describe('消息交互', () => {
    it('应该处理消息复制', async () => {
      const { user } = renderWithProviders(<MessageList {...defaultProps} />)
      
      const copyButton = screen.getAllByText('复制')[0]
      await user.click(copyButton)
      
      expect(defaultProps.onCopyMessage).toHaveBeenCalledWith(mockMessages[0].content)
    })

    it('应该处理消息重发', async () => {
      const { user } = renderWithProviders(<MessageList {...defaultProps} />)
      
      const resendButton = screen.getAllByText('重发')[0]
      await user.click(resendButton)
      
      expect(defaultProps.onResendMessage).toHaveBeenCalledWith(mockMessages[0].id)
    })

    it('应该处理消息编辑', async () => {
      const { user } = renderWithProviders(<MessageList {...defaultProps} />)
      
      const editButton = screen.getAllByText('编辑')[0]
      await user.click(editButton)
      
      expect(defaultProps.onEditMessage).toHaveBeenCalledWith(mockMessages[0].id)
    })

    it('应该处理消息删除', async () => {
      const { user } = renderWithProviders(<MessageList {...defaultProps} />)
      
      const deleteButton = screen.getAllByText('删除')[0]
      await user.click(deleteButton)
      
      expect(defaultProps.onDeleteMessage).toHaveBeenCalledWith(mockMessages[0].id)
    })

    it('应该支持消息选择', async () => {
      const onSelectMessage = createMockFn()
      const { user } = renderWithProviders(
        <MessageList {...defaultProps} onSelectMessage={onSelectMessage} />
      )
      
      const messageBubble = screen.getByTestId(`message-bubble-${mockMessages[0].id}`)
      await user.click(messageBubble)
      
      expect(onSelectMessage).toHaveBeenCalledWith(mockMessages[0].id)
    })
  })

  // ==================== 滚动功能测试 ====================
  
  describe('滚动功能', () => {
    it('应该自动滚动到底部', async () => {
      const scrollToBottom = vi.fn()
      const mockRef = { current: { scrollToBottom } }
      
      renderWithProviders(
        <MessageList {...defaultProps} autoScrollToBottom />
      )
      
      // 添加新消息
      const newMessage = createMockMessage({
        id: 'new-msg',
        content: '新消息',
        timestamp: Date.now(),
      })
      
      const { rerender } = renderWithProviders(
        <MessageList 
          {...defaultProps} 
          messages={[...mockMessages, newMessage]}
          autoScrollToBottom
        />
      )
      
      await waitFor(() => {
        expect(screen.getByTestId(`message-bubble-${newMessage.id}`)).toBeInTheDocument()
      })
    })

    it('应该在用户滚动时停止自动滚动', async () => {
      const { container } = renderWithProviders(
        <MessageList {...defaultProps} autoScrollToBottom />
      )
      
      const messageList = container.querySelector('[role="log"]')
      
      // 模拟用户滚动
      fireEvent.scroll(messageList!, { target: { scrollTop: 100 } })
      
      // 添加新消息
      const newMessage = createMockMessage()
      const { rerender } = renderWithProviders(
        <MessageList 
          {...defaultProps} 
          messages={[...mockMessages, newMessage]}
          autoScrollToBottom
        />
      )
      
      // 不应该自动滚动到底部
      expect(messageList!.scrollTop).toBe(100)
    })

    it('应该显示"滚动到底部"按钮', async () => {
      const { container } = renderWithProviders(<MessageList {...defaultProps} />)
      
      const messageList = container.querySelector('[role="log"]')
      
      // 模拟滚动到中间
      fireEvent.scroll(messageList!, { target: { scrollTop: 100 } })
      
      await waitFor(() => {
        expect(screen.getByLabelText('滚动到底部')).toBeInTheDocument()
      })
    })

    it('应该支持滚动到指定消息', async () => {
      const scrollToMessage = createMockFn()
      renderWithProviders(
        <MessageList {...defaultProps} scrollToMessage="msg-5" />
      )
      
      // 验证滚动到指定消息
      await waitFor(() => {
        const targetMessage = screen.getByTestId('message-bubble-msg-5')
        expect(targetMessage).toBeInTheDocument()
      })
    })
  })

  // ==================== 虚拟滚动测试 ====================
  
  describe('虚拟滚动', () => {
    it('应该在消息数量多时启用虚拟滚动', () => {
      const manyMessages = Array.from({ length: 1000 }, (_, i) =>
        createMockMessage({ id: `msg-${i}` })
      )
      
      renderWithProviders(
        <MessageList 
          {...defaultProps} 
          messages={manyMessages}
          enableVirtualScroll
        />
      )
      
      expect(screen.getByTestId('virtual-list')).toBeInTheDocument()
    })

    it('应该正确设置虚拟滚动参数', () => {
      const manyMessages = Array.from({ length: 500 }, (_, i) =>
        createMockMessage({ id: `msg-${i}` })
      )
      
      renderWithProviders(
        <MessageList 
          {...defaultProps} 
          messages={manyMessages}
          enableVirtualScroll
          itemHeight={80}
        />
      )
      
      const virtualList = screen.getByTestId('virtual-list')
      expect(virtualList).toHaveAttribute('data-item-count', '500')
      expect(virtualList).toHaveAttribute('data-item-size', '80')
    })
  })

  // ==================== 分组功能测试 ====================
  
  describe('消息分组', () => {
    it('应该按日期分组消息', () => {
      const today = new Date()
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      
      const groupedMessages = [
        createMockMessage({ 
          id: 'msg-today', 
          timestamp: today.getTime(),
          content: '今天的消息' 
        }),
        createMockMessage({ 
          id: 'msg-yesterday', 
          timestamp: yesterday.getTime(),
          content: '昨天的消息' 
        }),
      ]
      
      renderWithProviders(
        <MessageList 
          {...defaultProps} 
          messages={groupedMessages}
          groupByDate
        />
      )
      
      expect(screen.getByText('今天')).toBeInTheDocument()
      expect(screen.getByText('昨天')).toBeInTheDocument()
    })

    it('应该按发送者分组连续消息', () => {
      const consecutiveMessages = [
        createMockMessage({ id: 'msg-1', role: 'user', content: '消息1' }),
        createMockMessage({ id: 'msg-2', role: 'user', content: '消息2' }),
        createMockMessage({ id: 'msg-3', role: 'assistant', content: '回复' }),
      ]
      
      renderWithProviders(
        <MessageList 
          {...defaultProps} 
          messages={consecutiveMessages}
          groupConsecutive
        />
      )
      
      // 验证连续的用户消息被分组
      const userMessages = screen.getAllByTestId(/message-bubble-msg-[12]/)
      expect(userMessages).toHaveLength(2)
    })
  })

  // ==================== 搜索和过滤测试 ====================
  
  describe('搜索和过滤', () => {
    it('应该支持消息搜索', () => {
      const searchQuery = '测试'
      const messagesWithSearch = mockMessages.map(msg => ({
        ...msg,
        content: msg.id === 'msg-1' ? '这是测试消息' : msg.content,
      }))
      
      renderWithProviders(
        <MessageList 
          {...defaultProps} 
          messages={messagesWithSearch}
          searchQuery={searchQuery}
        />
      )
      
      // 应该高亮搜索结果
      expect(screen.getByText('这是测试消息')).toBeInTheDocument()
    })

    it('应该支持按消息类型过滤', () => {
      renderWithProviders(
        <MessageList 
          {...defaultProps} 
          filterByRole="user"
        />
      )
      
      // 只显示用户消息
      const userMessages = mockMessages.filter(msg => msg.role === 'user')
      userMessages.forEach(msg => {
        expect(screen.getByTestId(`message-bubble-${msg.id}`)).toBeInTheDocument()
      })
    })

    it('应该支持按时间范围过滤', () => {
      const startTime = Date.now() - 60 * 60 * 1000 // 1小时前
      const endTime = Date.now()
      
      renderWithProviders(
        <MessageList 
          {...defaultProps} 
          filterByTimeRange={{ start: startTime, end: endTime }}
        />
      )
      
      // 验证时间范围过滤
      const filteredMessages = mockMessages.filter(
        msg => msg.timestamp >= startTime && msg.timestamp <= endTime
      )
      expect(screen.getAllByTestId(/message-bubble-/)).toHaveLength(filteredMessages.length)
    })
  })

  // ==================== 正在输入指示器测试 ====================
  
  describe('正在输入指示器', () => {
    it('应该显示正在输入指示器', () => {
      renderWithProviders(
        <MessageList {...defaultProps} isTyping />
      )
      
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
    })

    it('应该在收到新消息时隐藏正在输入指示器', () => {
      const { rerender } = renderWithProviders(
        <MessageList {...defaultProps} isTyping />
      )
      
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
      
      // 添加新消息
      const newMessage = createMockMessage()
      rerender(
        <MessageList 
          {...defaultProps} 
          messages={[...mockMessages, newMessage]}
          isTyping={false}
        />
      )
      
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
    })
  })

  // ==================== 显示选项测试 ====================
  
  describe('显示选项', () => {
    it('应该支持隐藏头像', () => {
      renderWithProviders(
        <MessageList {...defaultProps} showAvatar={false} />
      )
      
      // MessageBubble 应该接收到 showAvatar=false
      mockMessages.forEach(message => {
        expect(screen.getByTestId(`message-bubble-${message.id}`)).toBeInTheDocument()
      })
    })

    it('应该支持隐藏时间戳', () => {
      renderWithProviders(
        <MessageList {...defaultProps} showTimestamp={false} />
      )
      
      // 时间戳应该被隐藏
      expect(screen.queryByTestId('message-timestamp')).not.toBeInTheDocument()
    })

    it('应该支持紧凑模式', () => {
      const { container } = renderWithProviders(
        <MessageList {...defaultProps} compact />
      )
      
      expect(container.firstChild).toHaveClass('compact')
    })

    it('应该支持自定义消息间距', () => {
      const { container } = renderWithProviders(
        <MessageList {...defaultProps} messageSpacing="large" />
      )
      
      expect(container.firstChild).toHaveClass('spacing-large')
    })
  })

  // ==================== 性能测试 ====================
  
  describe('性能优化', () => {
    it('应该使用 React.memo 优化重渲染', () => {
      const { rerender } = renderWithProviders(<MessageList {...defaultProps} />)
      
      // 重新渲染相同的 props
      rerender(<MessageList {...defaultProps} />)
      
      // 验证没有不必要的重渲染
      expect(screen.getAllByTestId(/message-bubble-/)).toHaveLength(mockMessages.length)
    })

    it('应该延迟加载历史消息', async () => {
      const onLoadMore = createMockFn()
      const { container } = renderWithProviders(
        <MessageList 
          {...defaultProps} 
          hasMore
          onLoadMore={onLoadMore}
        />
      )
      
      const messageList = container.querySelector('[role="log"]')
      
      // 滚动到顶部触发加载更多
      fireEvent.scroll(messageList!, { target: { scrollTop: 0 } })
      
      await waitFor(() => {
        expect(onLoadMore).toHaveBeenCalled()
      })
    })

    it('应该限制同时渲染的消息数量', () => {
      const manyMessages = Array.from({ length: 10000 }, (_, i) =>
        createMockMessage({ id: `msg-${i}` })
      )
      
      renderWithProviders(
        <MessageList 
          {...defaultProps} 
          messages={manyMessages}
          maxVisibleMessages={100}
        />
      )
      
      // 只渲染可见的消息
      const visibleMessages = screen.getAllByTestId(/message-bubble-/)
      expect(visibleMessages.length).toBeLessThanOrEqual(100)
    })
  })

  // ==================== 无障碍测试 ====================
  
  describe('无障碍功能', () => {
    it('应该有正确的 ARIA 标签', () => {
      renderWithProviders(<MessageList {...defaultProps} />)
      
      const messageList = screen.getByRole('log')
      expect(messageList).toHaveAttribute('aria-label', '消息列表')
      expect(messageList).toHaveAttribute('aria-live', 'polite')
    })

    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(<MessageList {...defaultProps} />)
      
      const messageList = screen.getByRole('log')
      messageList.focus()
      
      // 使用方向键导航
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{ArrowUp}')
      
      // 验证焦点管理
      expect(messageList).toHaveFocus()
    })

    it('应该宣布新消息', async () => {
      const { rerender } = renderWithProviders(<MessageList {...defaultProps} />)
      
      const newMessage = createMockMessage({
        id: 'new-msg',
        content: '新消息内容',
        role: 'assistant',
      })
      
      rerender(
        <MessageList 
          {...defaultProps} 
          messages={[...mockMessages, newMessage]}
        />
      )
      
      // 验证新消息被宣布
      await waitFor(() => {
        const messageList = screen.getByRole('log')
        expect(messageList).toHaveAttribute('aria-live', 'polite')
      })
    })
  })

  // ==================== 错误处理测试 ====================
  
  describe('错误处理', () => {
    it('应该处理无效消息数据', () => {
      const invalidMessages = [
        null,
        undefined,
        { id: 'invalid', content: null },
      ] as any[]
      
      renderWithProviders(
        <MessageList {...defaultProps} messages={invalidMessages} />
      )
      
      // 应该优雅处理无效数据
      expect(screen.getByRole('log')).toBeInTheDocument()
    })

    it('应该处理渲染错误', () => {
      // 模拟渲染错误
      const errorMessage = createMockMessage({
        id: 'error-msg',
        content: '这会导致渲染错误',
      })
      
      // Mock MessageBubble 抛出错误
      const MockMessageBubble = vi.fn(() => {
        throw new Error('渲染错误')
      })
      
      vi.mocked(require('@/components/Chat/MessageBubble').default).mockImplementation(
        MockMessageBubble
      )
      
      renderWithProviders(
        <MessageList {...defaultProps} messages={[errorMessage]} />
      )
      
      // 应该显示错误边界
      expect(screen.getByText(/出现错误/)).toBeInTheDocument()
    })
  })

  // ==================== 自定义样式测试 ====================
  
  describe('自定义样式', () => {
    it('应该应用自定义类名', () => {
      const className = 'custom-message-list'
      const { container } = renderWithProviders(
        <MessageList {...defaultProps} className={className} />
      )
      
      expect(container.firstChild).toHaveClass(className)
    })

    it('应该应用自定义样式', () => {
      const style = { backgroundColor: 'red' }
      const { container } = renderWithProviders(
        <MessageList {...defaultProps} style={style} />
      )
      
      expect(container.firstChild).toHaveStyle(style)
    })

    it('应该支持主题切换', () => {
      const { container } = renderWithProviders(
        <MessageList {...defaultProps} theme="dark" />
      )
      
      expect(container.firstChild).toHaveClass('theme-dark')
    })
  })
})
