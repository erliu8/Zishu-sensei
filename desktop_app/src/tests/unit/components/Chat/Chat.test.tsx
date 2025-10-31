/**
 * Chat 主组件测试
 * 
 * 测试聊天组件的整体功能和组件间交互
 * @module Chat/Test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders, createMockFn } from '@/tests/utils/test-utils'
import { setupChatMocks, cleanupChatMocks } from '@/tests/mocks/chat-mocks'
import Chat, { type ChatProps } from '@/components/Chat/index.tsx'
import { MessageRole, MessageType, MessageStatus, SessionType, SessionStatus } from '@/types/chat'
import type { ChatMessage, ChatSession } from '@/types/chat'

// ==================== Mock 设置 ====================

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock CSS modules
vi.mock('@/components/Chat/Chat.module.css', () => ({
  default: {
    chat: 'chat',
    chatCompact: 'chatCompact',
    chatHeader: 'chatHeader',
    headerLeft: 'headerLeft',
    headerRight: 'headerRight',
    sessionTitle: 'sessionTitle',
    sessionStats: 'sessionStats',
    headerButton: 'headerButton',
    menuContainer: 'menuContainer',
    menuDropdown: 'menuDropdown',
    menuItem: 'menuItem',
    menuItemDanger: 'menuItemDanger',
    menuDivider: 'menuDivider',
    chatContent: 'chatContent',
    emptyState: 'emptyState',
    emptyIcon: 'emptyIcon',
    emptyTitle: 'emptyTitle',
    emptyDescription: 'emptyDescription',
    emptySuggestions: 'emptySuggestions',
    emptySuggestionsTitle: 'emptySuggestionsTitle',
    emptySuggestionsList: 'emptySuggestionsList',
    emptySuggestionItem: 'emptySuggestionItem',
    emptySuggestionIcon: 'emptySuggestionIcon',
    loadingState: 'loadingState',
    loadingIcon: 'loadingIcon',
    loadingText: 'loadingText',
    errorBanner: 'errorBanner',
    errorText: 'errorText',
    retryButton: 'retryButton',
    inputArea: 'inputArea',
  }
}))

// Mock 子组件
vi.mock('@/components/Chat/MessageList', () => ({
  default: ({ messages, isLoading, onCopy, onEdit, onDelete }: any) => (
    <div data-testid="message-list">
      {isLoading && <div data-testid="loading-indicator">加载中...</div>}
      {messages?.map((msg: ChatMessage) => (
        <div key={msg.id} data-testid={`message-${msg.id}`} className="message-item">
          <div className="message-content">{typeof msg.content === 'string' ? msg.content : msg.content.text}</div>
          <div className="message-role">{msg.role}</div>
          {onCopy && <button onClick={() => onCopy(typeof msg.content === 'string' ? msg.content : msg.content.text || '')}>复制</button>}
          {onEdit && <button onClick={() => onEdit(msg.id, '编辑后的内容')}>编辑</button>}
          {onDelete && <button onClick={() => onDelete(msg.id)}>删除</button>}
        </div>
      ))}
    </div>
  )
}))

vi.mock('@/components/Chat/InputBox', () => ({
  default: ({ value, onChange, onSend, placeholder, disabled, isSending, onAttachmentAdd, onVoiceStart, suggestions }: any) => (
    <div data-testid="input-box">
      <textarea
        data-testid="message-textarea"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button
        data-testid="send-button"
        onClick={() => onSend?.(value)}
        disabled={disabled || isSending || !value?.trim()}
      >
        {isSending ? '发送中...' : '发送'}
      </button>
      {onAttachmentAdd && (
        <button data-testid="attachment-button" onClick={() => onAttachmentAdd?.(new File(['test'], 'test.txt'))}>附件</button>
      )}
      {onVoiceStart && (
        <button data-testid="voice-button" onClick={() => onVoiceStart?.()}>语音</button>
      )}
      {suggestions?.length > 0 && (
        <div data-testid="suggestions">
          {suggestions.map((s: any) => (
            <button key={s.id} onClick={() => onChange?.(s.text)}>{s.text}</button>
          ))}
        </div>
      )}
    </div>
  ),
}))

describe('Chat 主组件', () => {
  // ==================== 测试数据 ====================
  
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      sessionId: 'session-1',
      role: MessageRole.USER,
      type: MessageType.TEXT,
      content: '你好',
      status: MessageStatus.SENT,
      timestamp: Date.now() - 120000,
    },
    {
      id: 'msg-2',
      sessionId: 'session-1',
      role: MessageRole.ASSISTANT,
      type: MessageType.TEXT,
      content: '你好！有什么可以帮助您的吗？',
      status: MessageStatus.RECEIVED,
      timestamp: Date.now() - 60000,
    },
  ]

  const mockSession: ChatSession = {
    id: 'session-1',
    title: '测试对话',
    type: SessionType.CHAT,
    status: SessionStatus.ACTIVE,
    messages: mockMessages,
    config: {
      temperature: 0.7,
      maxTokens: 2048,
    },
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    lastActivityAt: Date.now(),
    messageCount: 2,
    totalTokens: 100,
  }

  const mockSuggestions = [
    { id: 'sug-1', text: '你好，世界！', type: 'question' as const, icon: '👋' },
    { id: 'sug-2', text: '今天天气怎么样？', type: 'question' as const, icon: '🌤️' },
    { id: 'sug-3', text: '帮我写一段代码', type: 'command' as const, icon: '💻' },
  ]

  const defaultProps: ChatProps = {
    session: mockSession,
    messages: mockMessages,
    onSendMessage: createMockFn(),
    onEditMessage: createMockFn(),
    onDeleteMessage: createMockFn(),
    onCopyMessage: createMockFn(),
  }

  beforeEach(() => {
    setupChatMocks()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanupChatMocks()
  })

  // ==================== 基础渲染测试 ====================

  describe('基础渲染', () => {
    it('应该正确渲染聊天组件', () => {
      renderWithProviders(<Chat {...defaultProps} />)
      
      // 检查基本元素存在
      expect(screen.getByTestId('message-list')).toBeInTheDocument()
      expect(screen.getByTestId('input-box')).toBeInTheDocument()
    })

    it('应该显示空状态提示', () => {
      renderWithProviders(<Chat messages={[]} />)
      
      // 应该显示空状态
      expect(screen.getByText('开始新对话')).toBeInTheDocument()
      expect(screen.getByText('输入你的问题，紫舒老师会为你解答')).toBeInTheDocument()
    })

    it('应该显示会话标题', () => {
      renderWithProviders(<Chat {...defaultProps} />)
      
      expect(screen.getByText('测试对话')).toBeInTheDocument()
    })

    it('应该显示消息统计', () => {
      renderWithProviders(<Chat {...defaultProps} />)
      
      expect(screen.getByText('1 条提问')).toBeInTheDocument()
      expect(screen.getByText('1 条回复')).toBeInTheDocument()
    })

    it('应该在紧凑模式下正确渲染', () => {
      const { container } = renderWithProviders(<Chat {...defaultProps} compact />)
      
      expect(container.firstChild).toHaveClass('chatCompact')
    })

    it('应该支持自定义类名', () => {
      const { container } = renderWithProviders(<Chat {...defaultProps} className="custom-chat" />)
      
      expect(container.firstChild).toHaveClass('custom-chat')
    })
  })

  // ==================== 状态测试 ====================
  
  describe('状态测试', () => {
    it('应该显示加载状态', () => {
      renderWithProviders(<Chat {...defaultProps} isLoading />)
      
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
      expect(screen.getByText('加载中...')).toBeInTheDocument()
    })

    it('应该显示错误状态', () => {
      const errorMessage = '连接失败，请重试'
      renderWithProviders(<Chat {...defaultProps} error={errorMessage} />)
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('应该在发送状态下禁用输入', () => {
      renderWithProviders(<Chat {...defaultProps} isSending />)
      
      expect(screen.getByTestId('send-button')).toHaveTextContent('发送中...')
      expect(screen.getByTestId('message-textarea')).toBeDisabled()
    })

    it('应该在流式响应时禁用发送', () => {
      renderWithProviders(<Chat {...defaultProps} isStreaming />)
      
      expect(screen.getByTestId('send-button')).toBeDisabled()
    })
  })

  // ==================== 消息处理测试 ====================
  
  describe('消息处理', () => {
    it('应该正确显示消息列表', () => {
      renderWithProviders(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('message-msg-1')).toBeInTheDocument()
      expect(screen.getByTestId('message-msg-2')).toBeInTheDocument()
      expect(screen.getByText('你好')).toBeInTheDocument()
      expect(screen.getByText('你好！有什么可以帮助您的吗？')).toBeInTheDocument()
    })

    it('应该处理发送消息', async () => {
      const onSendMessage = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} onSendMessage={onSendMessage} />
      )
      
      const textarea = screen.getByTestId('message-textarea')
      const sendButton = screen.getByTestId('send-button')
      
      await user.type(textarea, '新消息')
      await user.click(sendButton)
      
      expect(onSendMessage).toHaveBeenCalledWith('新消息', undefined)
    })

    it('应该处理消息编辑', async () => {
      const onEditMessage = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} onEditMessage={onEditMessage} showActions />
      )
      
      // 在第一个消息容器中查找编辑按钮
      const firstMessage = screen.getByTestId('message-msg-1')
      const editButton = within(firstMessage).getByText('编辑')
      await user.click(editButton)
      
      expect(onEditMessage).toHaveBeenCalledWith('msg-1', '编辑后的内容')
    })

    it('应该处理消息删除', async () => {
      const onDeleteMessage = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} onDeleteMessage={onDeleteMessage} showActions />
      )
      
      // 在第一个消息容器中查找删除按钮
      const firstMessage = screen.getByTestId('message-msg-1')
      const deleteButton = within(firstMessage).getByText('删除')
      await user.click(deleteButton)
      
      expect(onDeleteMessage).toHaveBeenCalledWith('msg-1')
    })

    it('应该处理消息复制', async () => {
      const onCopyMessage = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} onCopyMessage={onCopyMessage} showActions />
      )
      
      // 在第一个消息容器中查找复制按钮
      const firstMessage = screen.getByTestId('message-msg-1')
      const copyButton = within(firstMessage).getByText('复制')
      await user.click(copyButton)
      
      expect(onCopyMessage).toHaveBeenCalledWith('你好')
    })
  })

  // ==================== 功能特性测试 ====================
  
  describe('功能特性', () => {
    it('应该显示建议列表', () => {
      renderWithProviders(
        <Chat messages={[]} suggestions={mockSuggestions} />
      )
      
      expect(screen.getByText('试试这些问题：')).toBeInTheDocument()
      
      // 使用更精确的选择器，选择空状态建议中的按钮
      const suggestionButtons = screen.getAllByText('你好，世界！')
      expect(suggestionButtons.length).toBeGreaterThan(0)
      
      const weatherSuggestions = screen.getAllByText('今天天气怎么样？')
      expect(weatherSuggestions.length).toBeGreaterThan(0)
      
      const codeSuggestions = screen.getAllByText('帮我写一段代码')
      expect(codeSuggestions.length).toBeGreaterThan(0)
    })

    it('应该处理建议点击', async () => {
      const { user } = renderWithProviders(
        <Chat messages={[]} suggestions={mockSuggestions} />
      )
      
      // 查找空状态建议区域中的按钮
      const suggestionButtons = screen.getAllByText('你好，世界！')
      // 选择第一个（空状态中的按钮）
      const emptySuggestionButton = suggestionButtons[0]
      await user.click(emptySuggestionButton)
      
      // 建议内容应该出现在输入框中
      expect(screen.getByTestId('message-textarea')).toHaveValue('你好，世界！')
    })

    it('应该支持附件上传', async () => {
      const onAttachmentAdd = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} enableAttachments onAttachmentAdd={onAttachmentAdd} />
      )
      
      const attachmentButton = screen.getByTestId('attachment-button')
      await user.click(attachmentButton)
      
      expect(onAttachmentAdd).toHaveBeenCalled()
    })

    it('应该支持语音输入', async () => {
      const onVoiceStart = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} enableVoice onVoiceStart={onVoiceStart} />
      )
      
      const voiceButton = screen.getByTestId('voice-button')
      await user.click(voiceButton)
      
      expect(onVoiceStart).toHaveBeenCalled()
    })

    it('应该显示设置按钮', () => {
      const onSettingsClick = createMockFn()
      renderWithProviders(
        <Chat {...defaultProps} showSettingsButton onSettingsClick={onSettingsClick} />
      )
      
      expect(screen.getByTitle('设置')).toBeInTheDocument()
    })

    it('应该显示更多菜单', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const moreButton = screen.getByTitle('更多操作')
      expect(moreButton).toBeInTheDocument()
      
      // 点击按钮不应该抛出错误
      await user.click(moreButton)
      
      // 菜单容器应该存在（即使内容可能为空）
      const menuContainer = document.querySelector('.menuDropdown')
      expect(menuContainer).toBeInTheDocument()
    })
  })

  // ==================== 会话操作测试 ====================
  
  describe('会话操作', () => {
    it('应该处理会话归档', async () => {
      const onArchiveSession = createMockFn()
      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      
      const { user } = renderWithProviders(
        <Chat {...defaultProps} onArchiveSession={onArchiveSession} />
      )
      
      const moreButton = screen.getByTitle('更多操作')
      await user.click(moreButton)
      
      const archiveButton = screen.getByText('归档会话')
      await user.click(archiveButton)
      
      expect(confirmSpy).toHaveBeenCalledWith('确定要归档这个会话吗？')
      expect(onArchiveSession).toHaveBeenCalled()
      
      confirmSpy.mockRestore()
    })

    it('应该处理会话删除', async () => {
      const onDeleteSession = createMockFn()
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      
      const { user } = renderWithProviders(
        <Chat {...defaultProps} onDeleteSession={onDeleteSession} />
      )
      
      const moreButton = screen.getByTitle('更多操作')
      await user.click(moreButton)
      
      const deleteButton = screen.getByText('删除会话')
      await user.click(deleteButton)
      
      expect(confirmSpy).toHaveBeenCalledWith('确定要删除这个会话吗？此操作不可恢复。')
      expect(onDeleteSession).toHaveBeenCalled()
      
      confirmSpy.mockRestore()
    })

    it('应该处理会话导出', async () => {
      const onExportSession = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} onExportSession={onExportSession} />
      )
      
      const moreButton = screen.getByTitle('更多操作')
      await user.click(moreButton)
      
      const exportButton = screen.getByText('导出会话')
      await user.click(exportButton)
      
      expect(onExportSession).toHaveBeenCalled()
    })
  })

  // ==================== 错误处理测试 ====================
  
  describe('错误处理', () => {
    it('应该显示错误提示', () => {
      const errorMessage = '网络连接失败'
      renderWithProviders(<Chat {...defaultProps} error={errorMessage} />)
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('应该处理重试操作', async () => {
      const onRetry = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} error="连接失败" onRetry={onRetry} />
      )
      
      const retryButton = screen.getByText('重试')
      await user.click(retryButton)
      
      expect(onRetry).toHaveBeenCalled()
    })
  })

  // ==================== 响应式和无障碍测试 ====================
  
  describe('响应式和无障碍', () => {
    it('应该正确处理空消息发送', async () => {
      const onSendMessage = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} onSendMessage={onSendMessage} />
      )
      
      const sendButton = screen.getByTestId('send-button')
      await user.click(sendButton)
      
      // 空消息不应该被发送
      expect(onSendMessage).not.toHaveBeenCalled()
    })

    it('应该正确处理输入框占位符', () => {
      const placeholder = '请输入您的问题...'
      renderWithProviders(
        <Chat {...defaultProps} inputPlaceholder={placeholder} />
      )
      
      expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument()
    })
  })
})

