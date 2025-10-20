/**
 * Chat 主组件测试
 * 
 * 测试聊天组件的整体功能和组件间交互
 * @module Chat/Test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders, wait, createMockFn } from '@/tests/utils/test-utils'
import { createMockMessage, createMockConversation, createMockSettings } from '@/tests/mocks/factories'
import { Chat } from '@/components/Chat/Chat'
import type { ChatSession, ChatSettings } from '@/types/chat'

// ==================== Mock 设置 ====================

// Mock 子组件
vi.mock('@/components/Chat/ChatWindow', () => ({
  default: vi.fn(({ session, messages, onSendMessage, onClose }) => (
    <div data-testid="chat-window">
      <div data-testid="session-title">{session?.title || '新对话'}</div>
      <div data-testid="message-count">{messages?.length || 0} 条消息</div>
      <button 
        data-testid="send-message-btn"
        onClick={() => onSendMessage?.('测试消息')}
      >
        发送测试消息
      </button>
      <button onClick={onClose}>关闭</button>
    </div>
  )),
}))

vi.mock('@/components/Chat/SessionList', () => ({
  default: vi.fn(({ sessions, activeSessionId, onSessionSelect, onNewSession, onDeleteSession }) => (
    <div data-testid="session-list">
      <button onClick={() => onNewSession?.()}>新建对话</button>
      {sessions?.map((session: ChatSession) => (
        <div 
          key={session.id}
          data-testid={`session-${session.id}`}
          className={session.id === activeSessionId ? 'active' : ''}
          onClick={() => onSessionSelect?.(session.id)}
        >
          <span>{session.title}</span>
          <button onClick={() => onDeleteSession?.(session.id)}>删除</button>
        </div>
      ))}
    </div>
  )),
}))

vi.mock('@/components/Chat/ChatSettings', () => ({
  default: vi.fn(({ settings, onSettingsChange, onClose }) => (
    <div data-testid="chat-settings">
      <div>当前主题: {settings?.theme || 'auto'}</div>
      <button onClick={() => onSettingsChange?.({ ...settings, theme: 'dark' })}>
        切换到暗色主题
      </button>
      <button onClick={onClose}>关闭设置</button>
    </div>
  )),
}))

// Mock API 调用
vi.mock('@/services/chatService', () => ({
  sendMessage: vi.fn(() => Promise.resolve({
    id: 'response-msg',
    content: 'AI 回复消息',
    role: 'assistant',
    timestamp: Date.now(),
  })),
  createSession: vi.fn(() => Promise.resolve({
    id: 'new-session',
    title: '新对话',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })),
  deleteSession: vi.fn(() => Promise.resolve()),
  updateSession: vi.fn(() => Promise.resolve()),
}))

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: WebSocket.OPEN,
}
global.WebSocket = vi.fn(() => mockWebSocket) as any

describe('Chat 主组件', () => {
  // ==================== 测试数据 ====================
  
  const mockMessages = createMockConversation(5)
  const mockSessions: ChatSession[] = [
    {
      id: 'session-1',
      title: '第一个对话',
      messages: mockMessages.slice(0, 3),
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000,
    },
    {
      id: 'session-2',
      title: '第二个对话',
      messages: mockMessages.slice(3),
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now(),
    },
  ]

  const mockSettings = createMockSettings()

  const defaultProps = {
    initialSessions: mockSessions,
    initialSettings: mockSettings,
    onSessionChange: createMockFn(),
    onSettingsChange: createMockFn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==================== 基础渲染测试 ====================
  
  describe('基础渲染', () => {
    it('应该正确渲染聊天组件', () => {
      renderWithProviders(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('chat-container')).toBeInTheDocument()
      expect(screen.getByTestId('session-list')).toBeInTheDocument()
      expect(screen.getByTestId('chat-window')).toBeInTheDocument()
    })

    it('应该显示会话列表', () => {
      renderWithProviders(<Chat {...defaultProps} />)
      
      expect(screen.getByTestId('session-session-1')).toBeInTheDocument()
      expect(screen.getByTestId('session-session-2')).toBeInTheDocument()
      expect(screen.getByText('第一个对话')).toBeInTheDocument()
      expect(screen.getByText('第二个对话')).toBeInTheDocument()
    })

    it('应该默认选中第一个会话', () => {
      renderWithProviders(<Chat {...defaultProps} />)
      
      const firstSession = screen.getByTestId('session-session-1')
      expect(firstSession).toHaveClass('active')
    })

    it('应该显示当前会话的消息', () => {
      renderWithProviders(<Chat {...defaultProps} />)
      
      expect(screen.getByText('第一个对话')).toBeInTheDocument()
      expect(screen.getByText('3 条消息')).toBeInTheDocument()
    })

    it('当没有会话时应该显示空状态', () => {
      renderWithProviders(
        <Chat {...defaultProps} initialSessions={[]} />
      )
      
      expect(screen.getByText(/暂无对话/)).toBeInTheDocument()
    })
  })

  // ==================== 会话管理测试 ====================
  
  describe('会话管理', () => {
    it('应该支持切换会话', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const secondSession = screen.getByTestId('session-session-2')
      await user.click(secondSession)
      
      expect(secondSession).toHaveClass('active')
      expect(screen.getByText('第二个对话')).toBeInTheDocument()
      expect(screen.getByText('2 条消息')).toBeInTheDocument()
    })

    it('应该支持创建新会话', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const newSessionButton = screen.getByText('新建对话')
      await user.click(newSessionButton)
      
      await waitFor(() => {
        expect(screen.getByText('新对话')).toBeInTheDocument()
      })
    })

    it('应该支持删除会话', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const deleteButtons = screen.getAllByText('删除')
      await user.click(deleteButtons[0])
      
      await waitFor(() => {
        expect(screen.queryByTestId('session-session-1')).not.toBeInTheDocument()
      })
    })

    it('应该在删除当前会话后自动选择下一个会话', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      // 确保第一个会话被选中
      const firstSession = screen.getByTestId('session-session-1')
      expect(firstSession).toHaveClass('active')
      
      // 删除第一个会话
      const deleteButtons = screen.getAllByText('删除')
      await user.click(deleteButtons[0])
      
      await waitFor(() => {
        const secondSession = screen.getByTestId('session-session-2')
        expect(secondSession).toHaveClass('active')
      })
    })

    it('应该支持会话重命名', async () => {
      const onSessionChange = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} onSessionChange={onSessionChange} />
      )
      
      const sessionTitle = screen.getByText('第一个对话')
      await user.dblClick(sessionTitle)
      
      const input = screen.getByDisplayValue('第一个对话')
      await user.clear(input)
      await user.type(input, '重命名的对话{enter}')
      
      expect(onSessionChange).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'session-1',
          title: '重命名的对话',
        })
      )
    })
  })

  // ==================== 消息发送测试 ====================
  
  describe('消息发送', () => {
    it('应该支持发送消息', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const sendButton = screen.getByTestId('send-message-btn')
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('4 条消息')).toBeInTheDocument()
      })
    })

    it('应该在发送消息后收到 AI 回复', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const sendButton = screen.getByTestId('send-message-btn')
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('5 条消息')).toBeInTheDocument() // 用户消息 + AI回复
      })
    })

    it('应该显示发送中状态', async () => {
      // Mock API 延迟响应
      const chatService = await import('@/services/chatService')
      vi.mocked(chatService.sendMessage).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )
      
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const sendButton = screen.getByTestId('send-message-btn')
      await user.click(sendButton)
      
      expect(screen.getByTestId('sending-indicator')).toBeInTheDocument()
    })

    it('应该处理发送失败', async () => {
      const chatService = await import('@/services/chatService')
      vi.mocked(chatService.sendMessage).mockRejectedValue(new Error('发送失败'))
      
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const sendButton = screen.getByTestId('send-message-btn')
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText(/发送失败/)).toBeInTheDocument()
      })
    })

    it('应该支持重发失败的消息', async () => {
      const chatService = await import('@/services/chatService')
      vi.mocked(chatService.sendMessage)
        .mockRejectedValueOnce(new Error('发送失败'))
        .mockResolvedValueOnce({
          id: 'retry-msg',
          content: '重发成功',
          role: 'assistant',
          timestamp: Date.now(),
        })
      
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const sendButton = screen.getByTestId('send-message-btn')
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText(/发送失败/)).toBeInTheDocument()
      })
      
      const retryButton = screen.getByLabelText('重试')
      await user.click(retryButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/发送失败/)).not.toBeInTheDocument()
      })
    })
  })

  // ==================== 实时通信测试 ====================
  
  describe('实时通信', () => {
    it('应该建立 WebSocket 连接', () => {
      renderWithProviders(<Chat {...defaultProps} enableRealtime />)
      
      expect(global.WebSocket).toHaveBeenCalled()
    })

    it('应该处理 WebSocket 消息', async () => {
      renderWithProviders(<Chat {...defaultProps} enableRealtime />)
      
      // 模拟收到 WebSocket 消息
      const messageHandler = vi.mocked(mockWebSocket.addEventListener).mock.calls
        .find(call => call[0] === 'message')?.[1] as Function
      
      const wsMessage = {
        data: JSON.stringify({
          type: 'new_message',
          payload: {
            id: 'ws-msg',
            content: '实时消息',
            role: 'assistant',
            timestamp: Date.now(),
          },
        }),
      }
      
      messageHandler?.(wsMessage)
      
      await waitFor(() => {
        expect(screen.getByText('4 条消息')).toBeInTheDocument()
      })
    })

    it('应该显示连接状态', () => {
      renderWithProviders(<Chat {...defaultProps} enableRealtime />)
      
      expect(screen.getByTestId('connection-status')).toBeInTheDocument()
      expect(screen.getByText('已连接')).toBeInTheDocument()
    })

    it('应该处理连接断开', async () => {
      renderWithProviders(<Chat {...defaultProps} enableRealtime />)
      
      // 模拟连接断开
      const closeHandler = vi.mocked(mockWebSocket.addEventListener).mock.calls
        .find(call => call[0] === 'close')?.[1] as Function
      
      closeHandler?.()
      
      await waitFor(() => {
        expect(screen.getByText('连接断开')).toBeInTheDocument()
      })
    })

    it('应该自动重连', async () => {
      renderWithProviders(<Chat {...defaultProps} enableRealtime autoReconnect />)
      
      // 模拟连接断开
      const closeHandler = vi.mocked(mockWebSocket.addEventListener).mock.calls
        .find(call => call[0] === 'close')?.[1] as Function
      
      closeHandler?.()
      
      // 等待重连
      await wait(2000)
      
      expect(global.WebSocket).toHaveBeenCalledTimes(2)
    })
  })

  // ==================== 设置管理测试 ====================
  
  describe('设置管理', () => {
    it('应该显示设置面板', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const settingsButton = screen.getByLabelText('设置')
      await user.click(settingsButton)
      
      expect(screen.getByTestId('chat-settings')).toBeInTheDocument()
    })

    it('应该保存设置更改', async () => {
      const onSettingsChange = createMockFn()
      const { user } = renderWithProviders(
        <Chat {...defaultProps} onSettingsChange={onSettingsChange} />
      )
      
      const settingsButton = screen.getByLabelText('设置')
      await user.click(settingsButton)
      
      const themeButton = screen.getByText('切换到暗色主题')
      await user.click(themeButton)
      
      expect(onSettingsChange).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark' })
      )
    })

    it('应该应用主题设置', () => {
      const darkSettings = { ...mockSettings, theme: 'dark' }
      const { container } = renderWithProviders(
        <Chat {...defaultProps} initialSettings={darkSettings} />
      )
      
      expect(container.firstChild).toHaveClass('theme-dark')
    })

    it('应该保存设置到本地存储', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const settingsButton = screen.getByLabelText('设置')
      await user.click(settingsButton)
      
      const themeButton = screen.getByText('切换到暗色主题')
      await user.click(themeButton)
      
      expect(setItemSpy).toHaveBeenCalledWith(
        'chat-settings',
        expect.stringContaining('"theme":"dark"')
      )
    })
  })

  // ==================== 搜索功能测试 ====================
  
  describe('搜索功能', () => {
    it('应该支持搜索消息', async () => {
      const { user } = renderWithProviders(
        <Chat {...defaultProps} enableSearch />
      )
      
      const searchButton = screen.getByLabelText('搜索')
      await user.click(searchButton)
      
      const searchInput = screen.getByPlaceholderText('搜索消息...')
      await user.type(searchInput, '测试')
      
      expect(screen.getByTestId('search-results')).toBeInTheDocument()
    })

    it('应该高亮搜索结果', async () => {
      const { user } = renderWithProviders(
        <Chat {...defaultProps} enableSearch />
      )
      
      const searchButton = screen.getByLabelText('搜索')
      await user.click(searchButton)
      
      const searchInput = screen.getByPlaceholderText('搜索消息...')
      await user.type(searchInput, '测试')
      
      expect(screen.getByTestId('highlighted-text')).toBeInTheDocument()
    })

    it('应该支持跨会话搜索', async () => {
      const { user } = renderWithProviders(
        <Chat {...defaultProps} enableSearch />
      )
      
      const searchButton = screen.getByLabelText('搜索')
      await user.click(searchButton)
      
      const globalSearchToggle = screen.getByLabelText('搜索所有对话')
      await user.click(globalSearchToggle)
      
      const searchInput = screen.getByPlaceholderText('搜索消息...')
      await user.type(searchInput, '测试')
      
      expect(screen.getAllByTestId('search-result-item')).toHaveLength(
        expect.any(Number)
      )
    })
  })

  // ==================== 文件处理测试 ====================
  
  describe('文件处理', () => {
    it('应该支持文件上传', async () => {
      const { user } = renderWithProviders(
        <Chat {...defaultProps} enableFileUpload />
      )
      
      const fileInput = screen.getByTestId('file-input')
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      
      await user.upload(fileInput, file)
      
      expect(screen.getByText('test.txt')).toBeInTheDocument()
    })

    it('应该显示文件上传进度', async () => {
      const { user } = renderWithProviders(
        <Chat {...defaultProps} enableFileUpload />
      )
      
      const fileInput = screen.getByTestId('file-input')
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      
      await user.upload(fileInput, file)
      
      expect(screen.getByTestId('upload-progress')).toBeInTheDocument()
    })

    it('应该处理文件上传失败', async () => {
      // Mock 文件上传失败
      const uploadSpy = vi.spyOn(global, 'fetch').mockRejectedValue(new Error('上传失败'))
      
      const { user } = renderWithProviders(
        <Chat {...defaultProps} enableFileUpload />
      )
      
      const fileInput = screen.getByTestId('file-input')
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      
      await user.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/上传失败/)).toBeInTheDocument()
      })
      
      uploadSpy.mockRestore()
    })

    it('应该限制文件大小', async () => {
      const { user } = renderWithProviders(
        <Chat {...defaultProps} enableFileUpload maxFileSize={1000} />
      )
      
      const fileInput = screen.getByTestId('file-input')
      const largeFile = new File(['x'.repeat(2000)], 'large.txt', { 
        type: 'text/plain' 
      })
      
      await user.upload(fileInput, largeFile)
      
      expect(screen.getByText(/文件太大/)).toBeInTheDocument()
    })
  })

  // ==================== 快捷键测试 ====================
  
  describe('快捷键功能', () => {
    it('应该支持快捷键创建新会话', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      await user.keyboard('{Control>}n{/Control}')
      
      await waitFor(() => {
        expect(screen.getByText('新对话')).toBeInTheDocument()
      })
    })

    it('应该支持快捷键搜索', async () => {
      const { user } = renderWithProviders(
        <Chat {...defaultProps} enableSearch />
      )
      
      await user.keyboard('{Control>}f{/Control}')
      
      expect(screen.getByPlaceholderText('搜索消息...')).toBeInTheDocument()
    })

    it('应该支持快捷键打开设置', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      await user.keyboard('{Control>},{/Control}')
      
      expect(screen.getByTestId('chat-settings')).toBeInTheDocument()
    })

    it('应该支持快捷键关闭面板', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      // 打开设置
      const settingsButton = screen.getByLabelText('设置')
      await user.click(settingsButton)
      
      // 按 ESC 关闭
      await user.keyboard('{Escape}')
      
      expect(screen.queryByTestId('chat-settings')).not.toBeInTheDocument()
    })
  })

  // ==================== 性能测试 ====================
  
  describe('性能优化', () => {
    it('应该虚拟化大量会话', () => {
      const manySessions = Array.from({ length: 1000 }, (_, i) => ({
        id: `session-${i}`,
        title: `对话 ${i}`,
        messages: [],
        createdAt: Date.now() - i * 1000,
        updatedAt: Date.now() - i * 500,
      }))
      
      renderWithProviders(
        <Chat {...defaultProps} initialSessions={manySessions} />
      )
      
      // 只应该渲染可见的会话项
      const renderedSessions = screen.getAllByTestId(/session-/)
      expect(renderedSessions.length).toBeLessThan(100)
    })

    it('应该延迟加载历史消息', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const messageList = screen.getByTestId('chat-window')
      
      // 模拟滚动到顶部
      fireEvent.scroll(messageList, { target: { scrollTop: 0 } })
      
      await waitFor(() => {
        expect(screen.getByTestId('loading-more')).toBeInTheDocument()
      })
    })

    it('应该清理未使用的资源', () => {
      const { unmount } = renderWithProviders(<Chat {...defaultProps} />)
      
      unmount()
      
      expect(mockWebSocket.close).toHaveBeenCalled()
    })
  })

  // ==================== 无障碍测试 ====================
  
  describe('无障碍功能', () => {
    it('应该有正确的 ARIA 标签', () => {
      renderWithProviders(<Chat {...defaultProps} />)
      
      const chatContainer = screen.getByTestId('chat-container')
      expect(chatContainer).toHaveAttribute('role', 'application')
      expect(chatContainer).toHaveAttribute('aria-label', '聊天应用')
      
      const sessionList = screen.getByTestId('session-list')
      expect(sessionList).toHaveAttribute('role', 'list')
      expect(sessionList).toHaveAttribute('aria-label', '对话列表')
    })

    it('应该支持键盘导航', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      // Tab 导航到会话列表
      await user.tab()
      expect(screen.getByTestId('session-session-1')).toHaveFocus()
      
      // 方向键导航会话
      await user.keyboard('{ArrowDown}')
      expect(screen.getByTestId('session-session-2')).toHaveFocus()
    })

    it('应该宣布会话切换', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const secondSession = screen.getByTestId('session-session-2')
      await user.click(secondSession)
      
      const announcement = screen.getByLabelText('当前对话')
      expect(announcement).toHaveTextContent('第二个对话')
    })

    it('应该支持屏幕阅读器', () => {
      renderWithProviders(<Chat {...defaultProps} />)
      
      const messageCount = screen.getByTestId('message-count')
      expect(messageCount).toHaveAttribute('aria-label', '消息数量')
    })
  })

  // ==================== 错误处理测试 ====================
  
  describe('错误处理', () => {
    it('应该显示网络错误', async () => {
      // Mock 网络错误
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))
      
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const sendButton = screen.getByTestId('send-message-btn')
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText(/网络连接异常/)).toBeInTheDocument()
      })
    })

    it('应该处理 API 错误', async () => {
      const chatService = await import('@/services/chatService')
      vi.mocked(chatService.sendMessage).mockRejectedValue({
        status: 429,
        message: '请求过于频繁',
      })
      
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      const sendButton = screen.getByTestId('send-message-btn')
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('请求过于频繁')).toBeInTheDocument()
      })
    })

    it('应该处理会话加载错误', () => {
      const invalidSessions = [null, undefined, { invalid: 'session' }] as any
      
      renderWithProviders(
        <Chat {...defaultProps} initialSessions={invalidSessions} />
      )
      
      // 应该优雅处理无效数据
      expect(screen.getByTestId('chat-container')).toBeInTheDocument()
    })

    it('应该有错误边界', () => {
      // Mock 子组件抛出错误
      const ChatWindow = vi.mocked(require('@/components/Chat/ChatWindow').default)
      ChatWindow.mockImplementation(() => {
        throw new Error('渲染错误')
      })
      
      renderWithProviders(<Chat {...defaultProps} />)
      
      expect(screen.getByText(/出现错误/)).toBeInTheDocument()
    })
  })

  // ==================== 集成测试 ====================
  
  describe('集成测试', () => {
    it('应该完成完整的对话流程', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      // 1. 创建新对话
      const newSessionButton = screen.getByText('新建对话')
      await user.click(newSessionButton)
      
      await waitFor(() => {
        expect(screen.getByText('新对话')).toBeInTheDocument()
      })
      
      // 2. 发送消息
      const sendButton = screen.getByTestId('send-message-btn')
      await user.click(sendButton)
      
      // 3. 等待 AI 回复
      await waitFor(() => {
        expect(screen.getByText('1 条消息')).toBeInTheDocument() // 用户消息 + AI回复
      })
      
      // 4. 验证对话已更新
      expect(screen.getByText(/刚刚/)).toBeInTheDocument() // 更新时间
    })

    it('应该正确处理多会话切换', async () => {
      const { user } = renderWithProviders(<Chat {...defaultProps} />)
      
      // 在第一个会话发送消息
      const sendButton = screen.getByTestId('send-message-btn')
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('4 条消息')).toBeInTheDocument()
      })
      
      // 切换到第二个会话
      const secondSession = screen.getByTestId('session-session-2')
      await user.click(secondSession)
      
      // 验证消息数正确
      expect(screen.getByText('2 条消息')).toBeInTheDocument()
      
      // 在第二个会话发送消息
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(screen.getByText('3 条消息')).toBeInTheDocument()
      })
    })
  })
})
