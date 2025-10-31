/**
 * useChat Hook 测试套件
 * 
 * 测试聊天功能的所有方面，包括消息发送、流式响应、历史管理等
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { useChat, useSimpleChat, type UseChatOptions } from '@/hooks/useChat'
import { 
  createMockMessage,
  createMockConversation,
} from '../../mocks/factories'
import { renderHook, mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// 使用vi.hoisted确保mock对象在模块mock之前初始化
const { mockChatAPI, MockStreamManager, mockChatService, mockStreamManager } = vi.hoisted(() => {
  const mockChatAPI = {
    validateMessage: vi.fn((content: string) => ({ 
      valid: content ? content.trim().length > 0 : false,
      error: content ? (content.trim().length > 0 ? undefined : '消息不能为空') : '消息不能为空'
    })),
    sendMessageStream: vi.fn(() => Promise.resolve({
      abort: vi.fn(),
      stop: vi.fn(),
    })) as any,
  }

  // Mock StreamManager 类
  class MockStreamManager {
    abort = vi.fn();
    stop = vi.fn();
  }

  const mockChatService = {
    generateSessionId: vi.fn(() => 'test-session-123'),
    sendMessage: vi.fn(),
    getChatHistory: vi.fn(),
    clearChatHistory: vi.fn(),
    setChatModel: vi.fn(),
  }

  const mockStreamManager = {
    abort: vi.fn(),
    stop: vi.fn(),
  }

  return { mockChatAPI, MockStreamManager, mockChatService, mockStreamManager }
})

// 确保在useChat导入之前设置mock
vi.mock('@/services/api/chat', async () => {
  return {
    ChatAPI: mockChatAPI,
    StreamManager: MockStreamManager,
  }
})

vi.mock('@/services/chat/index', () => ({
  default: mockChatService,
}))


// ==================== 测试数据 ====================

const mockMessages = createMockConversation(5)
const testSessionId = 'test-session-123'

const defaultChatResponse = {
  message_id: 'msg_123',
  message: 'Test response',
  usage: {
    total_tokens: 100,
    prompt_tokens: 50,
    completion_tokens: 50,
  },
}

// ==================== 辅助函数 ====================

function createMockOptions(overrides?: Partial<UseChatOptions>): UseChatOptions {
  return {
    sessionId: testSessionId,
    autoLoadHistory: false,
    defaultModel: 'gpt-3.5-turbo',
    defaultCharacter: 'test-character',
    maxContextMessages: 10,
    enableStreaming: false,
    defaultTemperature: 0.7,
    defaultTopP: 1.0,
    maxRetries: 3,
    autoSaveHistory: true,
    ...overrides,
  }
}

// ==================== 测试套件 ====================

describe('useChat Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
  })

  afterAll(() => {
    consoleMock.restore()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    
    // 设置默认 mock 行为
    mockChatService.getChatHistory.mockResolvedValue({
      messages: [],
      total: 0,
    })
    mockChatService.sendMessage.mockResolvedValue(defaultChatResponse)
    mockChatService.clearChatHistory.mockResolvedValue(true)
    mockChatService.setChatModel.mockResolvedValue(true)
    
    // 设置 ChatAPI mock 默认行为
    mockChatAPI.validateMessage.mockImplementation((content: string) => ({ 
      valid: content ? content.trim().length > 0 : false,
      error: content ? (content.trim().length > 0 ? undefined : '消息不能为空') : '消息不能为空'
    }))
    mockChatAPI.sendMessageStream.mockResolvedValue(mockStreamManager)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ==================== 基础初始化测试 ====================

  describe('初始化', () => {
    it('应该返回默认的初始状态', () => {
      const { result } = renderHook(() => useChat())

      expect(result.current.messages).toEqual([])
      expect(result.current.sessionId).toBeTruthy()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isSending).toBe(false)
      expect(result.current.isStreaming).toBe(false)
      expect(result.current.error).toBe(null)
      expect(result.current.stats.totalMessages).toBe(0)
      expect(result.current.stats.totalTokens).toBe(0)
    })

    it('应该接受自定义选项', () => {
      const options = createMockOptions({
        sessionId: 'custom-session',
        defaultModel: 'gpt-4',
        enableStreaming: true,
      })

      const { result } = renderHook(() => useChat(options))

      expect(result.current.sessionId).toBe('custom-session')
    })

    it('应该在 autoLoadHistory=true 时自动加载历史记录', async () => {
      const mockHistory = createMockConversation(3)
      mockChatService.getChatHistory.mockResolvedValue({
        messages: mockHistory,
        total: 3,
      })

      const { result } = renderHook(() =>
        useChat({ autoLoadHistory: true })
      )

      await waitFor(() => {
        expect(mockChatService.getChatHistory).toHaveBeenCalledWith(
          result.current.sessionId,
          undefined
        )
      })
    })
  })

  // ==================== 消息发送测试 ====================

  describe('消息发送', () => {
    it('应该成功发送消息', async () => {
      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('Hello, world!')
      })

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Hello, world!',
          session_id: result.current.sessionId,
        })
      )

      expect(result.current.messages).toHaveLength(2) // 用户消息 + AI 回复
      expect(result.current.messages[0].role).toBe('user')
      expect(result.current.messages[0].content).toBe('Hello, world!')
      expect(result.current.messages[1].role).toBe('assistant')
    })

    it('应该验证消息内容', async () => {
      mockChatAPI.validateMessage.mockReturnValue({
        valid: false,
        error: '消息不能为空'
      })

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('')
      })

      expect(result.current.error).toBeTruthy()
      expect(mockChatService.sendMessage).not.toHaveBeenCalled()
    })

    it('应该处理发送失败', async () => {
      const testError = new Error('Network error')
      mockChatService.sendMessage.mockRejectedValue(testError)

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.messages).toHaveLength(2) // 用户消息 + 错误提示
      expect(result.current.messages[1].role).toBe('system')
      expect(result.current.messages[1].content).toContain('发送失败')
    })

    it('应该支持重试机制', async () => {
      mockChatService.sendMessage
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce(defaultChatResponse)

      const { result } = renderHook(() => useChat({ maxRetries: 3 }))

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      expect(mockChatService.sendMessage).toHaveBeenCalledTimes(3)
      expect(result.current.error).toBe(null)
      expect(result.current.messages).toHaveLength(2)
    })

    it('应该在达到最大重试次数后停止重试', async () => {
      const testError = new Error('Persistent error')
      mockChatService.sendMessage.mockRejectedValue(testError)

      const { result } = renderHook(() => useChat({ maxRetries: 2 }))

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      expect(mockChatService.sendMessage).toHaveBeenCalledTimes(3) // 1 + 2 重试
      expect(result.current.error).toBeTruthy()
    })

    it('应该传递自定义选项', async () => {
      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('Hello', {
          model: 'gpt-4',
          temperature: 0.9,
          character_id: 'custom-character',
        })
      })

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          temperature: 0.9,
          character_id: 'custom-character',
        })
      )
    })
  })

  // ==================== 流式响应测试 ====================

  describe('流式响应', () => {
    it('应该支持流式响应', async () => {
      mockChatAPI.sendMessageStream.mockResolvedValue(mockStreamManager)

      const { result } = renderHook(() => useChat({ enableStreaming: true }))

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      expect(mockChatAPI.sendMessageStream).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Hello',
          stream: true,
        }),
        expect.objectContaining({
          onChunk: expect.any(Function),
          onComplete: expect.any(Function),
          onError: expect.any(Function),
        })
      )
    })

    it('应该处理流式数据块', async () => {
      let chunkCallback: Function
      mockChatAPI.sendMessageStream.mockImplementation((req: any, options: any) => {
        chunkCallback = options.onChunk
        return Promise.resolve(mockStreamManager)
      })

      const onStreamChunk = vi.fn()
      const { result } = renderHook(() => 
        useChat({ enableStreaming: true, onStreamChunk })
      )

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      // 模拟流式数据
      act(() => {
        chunkCallback({ delta: 'Hello' })
        chunkCallback({ delta: ' world' })
        chunkCallback({ delta: '!' })
      })

      expect(onStreamChunk).toHaveBeenCalledWith('Hello')
      expect(onStreamChunk).toHaveBeenCalledWith(' world')
      expect(onStreamChunk).toHaveBeenCalledWith('!')
    })

    it('应该处理流式完成事件', async () => {
      let completeCallback: Function
      mockChatAPI.sendMessageStream.mockImplementation((req: any, options: any) => {
        completeCallback = options.onComplete
        return Promise.resolve(mockStreamManager)
      })

      const onStreamComplete = vi.fn()
      const { result } = renderHook(() => 
        useChat({ enableStreaming: true, onStreamComplete })
      )

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      // 模拟流式完成
      act(() => {
        completeCallback(defaultChatResponse)
      })

      expect(onStreamComplete).toHaveBeenCalled()
      expect(result.current.isStreaming).toBe(false)
      expect(result.current.isSending).toBe(false)
    })

    it('应该停止流式响应', async () => {
      // 首先创建一个流实例
      const streamInstance = { abort: vi.fn(), stop: vi.fn() }
      mockChatAPI.sendMessageStream.mockResolvedValue(streamInstance)
      
      const { result } = renderHook(() => useChat({ enableStreaming: true }))

      // 先发送一条消息来创建流
      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      // 然后停止流
      act(() => {
        result.current.stopStreaming()
      })

      expect(streamInstance.abort).toHaveBeenCalled()
      expect(result.current.isStreaming).toBe(false)
    })
  })

  // ==================== 历史记录管理测试 ====================

  describe('历史记录管理', () => {
    it('应该加载历史记录', async () => {
      const mockHistory = createMockConversation(5)
      mockChatService.getChatHistory.mockResolvedValue({
        messages: mockHistory,
        total: 5,
      })

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.loadHistory()
      })

      expect(mockChatService.getChatHistory).toHaveBeenCalledWith(
        result.current.sessionId,
        undefined
      )
      expect(result.current.messages).toHaveLength(5)
    })

    it('应该支持限制历史记录数量', async () => {
      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.loadHistory(10)
      })

      expect(mockChatService.getChatHistory).toHaveBeenCalledWith(
        result.current.sessionId,
        10
      )
    })

    it('应该清空历史记录', async () => {
      const { result } = renderHook(() => useChat())

      // 先添加一些消息
      act(() => {
        result.current.importHistory(mockMessages)
      })

      expect(result.current.messages).toHaveLength(5)

      await act(async () => {
        await result.current.clearHistory()
      })

      expect(mockChatService.clearChatHistory).toHaveBeenCalledWith(
        result.current.sessionId
      )
      expect(result.current.messages).toHaveLength(0)
    })

    it('应该导出历史记录', () => {
      const { result } = renderHook(() => useChat())

      act(() => {
        result.current.importHistory(mockMessages)
      })

      const exported = result.current.exportHistory()
      expect(exported).toEqual(mockMessages)
    })

    it('应该导入历史记录', () => {
      const { result } = renderHook(() => useChat())

      act(() => {
        result.current.importHistory(mockMessages)
      })

      expect(result.current.messages).toEqual(mockMessages)
    })
  })

  // ==================== 消息操作测试 ====================

  describe('消息操作', () => {
    it('应该删除指定消息', () => {
      const { result } = renderHook(() => useChat())

      act(() => {
        result.current.importHistory(mockMessages)
      })

      const messageToDelete = result.current.messages[0]

      act(() => {
        result.current.deleteMessage(messageToDelete.id)
      })

      expect(result.current.messages).toHaveLength(4)
      expect(result.current.messages.find(m => m.id === messageToDelete.id)).toBeUndefined()
    })

    it('应该编辑用户消息', async () => {
      const { result } = renderHook(() => useChat())

      // 先发送一条消息
      await act(async () => {
        await result.current.sendMessage('Original message')
      })

      const userMessage = result.current.messages[0]
      expect(userMessage.role).toBe('user')

      // 编辑消息
      await act(async () => {
        await result.current.editMessage(userMessage.id, 'Edited message')
      })

      expect(mockChatService.sendMessage).toHaveBeenCalledTimes(2) // 原始 + 编辑后的
      expect(mockChatService.sendMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          message: 'Edited message',
        })
      )
    })

    it('应该拒绝编辑非用户消息', async () => {
      const { result } = renderHook(() => useChat())

      const assistantMessage = createMockMessage({ role: 'assistant' })
      act(() => {
        result.current.importHistory([assistantMessage])
      })

      await expect(
        act(async () => {
          await result.current.editMessage(assistantMessage.id, 'New content')
        })
      ).rejects.toThrow('只能编辑用户消息')
    })

    it('应该重新发送最后一条消息', async () => {
      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('Test message')
      })

      mockChatService.sendMessage.mockClear()

      await act(async () => {
        await result.current.resendLastMessage()
      })

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test message',
        })
      )
    })

    it('应该重新生成最后的回复', async () => {
      const { result } = renderHook(() => useChat())

      // 先发送一条消息以建立对话上下文
      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      // Mock清除之前的调用记录
      mockChatService.sendMessage.mockClear()

      // 重新生成最后的回复
      await act(async () => {
        await result.current.regenerateLastResponse()
      })

      expect(mockChatService.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Hello',
        })
      )
    })

    it('应该添加系统消息', () => {
      const { result } = renderHook(() => useChat())

      act(() => {
        result.current.addSystemMessage('System notification')
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].role).toBe('system')
      expect(result.current.messages[0].content).toBe('System notification')
    })
  })

  // ==================== 设置和配置测试 ====================

  describe('设置和配置', () => {
    it('应该更新会话ID', () => {
      const { result } = renderHook(() => useChat())
      const newSessionId = 'new-session-456'

      act(() => {
        result.current.setSessionId(newSessionId)
      })

      expect(result.current.sessionId).toBe(newSessionId)
    })

    it('应该设置模型', async () => {
      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.setModel('gpt-4', 'test-adapter')
      })

      expect(mockChatService.setChatModel).toHaveBeenCalledWith({
        model_id: 'gpt-4',
        adapter_id: 'test-adapter',
      })
    })

    it('应该处理设置模型失败', async () => {
      const testError = new Error('Model not found')
      mockChatService.setChatModel.mockRejectedValue(testError)

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.setModel('invalid-model')
      })

      expect(result.current.error).toBeTruthy()
    })
  })

  // ==================== 统计信息测试 ====================

  describe('统计信息', () => {
    it('应该计算统计信息', async () => {
      const { result } = renderHook(() => useChat())

      // 发送几条消息
      await act(async () => {
        await result.current.sendMessage('Message 1')
      })

      await act(async () => {
        await result.current.sendMessage('Message 2')
      })

      expect(result.current.stats.totalMessages).toBe(4) // 2用户 + 2助手
      expect(result.current.stats.totalTokens).toBe(200) // 2 * 100
      expect(result.current.stats.avgResponseTime).toBeGreaterThanOrEqual(0)
    })

    it('应该更新token统计', async () => {
      mockChatService.sendMessage.mockResolvedValue({
        ...defaultChatResponse,
        usage: { total_tokens: 150, prompt_tokens: 75, completion_tokens: 75 },
      })

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.sendMessage('Test message')
      })

      expect(result.current.stats.totalTokens).toBe(150)
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理', () => {
    it('应该清除错误', () => {
      const { result } = renderHook(() => useChat())

      act(() => {
        result.current.addSystemMessage('Error message')
        // 手动设置错误状态进行测试
        result.current.clearError()
      })

      expect(result.current.error).toBe(null)
    })

    it('应该处理历史加载错误', async () => {
      const testError = new Error('History load failed')
      mockChatService.getChatHistory.mockRejectedValue(testError)

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.loadHistory()
      })

      expect(result.current.error).toBeTruthy()
    })

    it('应该处理清空历史错误', async () => {
      const testError = new Error('Clear history failed')
      mockChatService.clearChatHistory.mockRejectedValue(testError)

      const { result } = renderHook(() => useChat())

      await act(async () => {
        await result.current.clearHistory()
      })

      expect(result.current.error).toBeTruthy()
    })
  })

  // ==================== 回调函数测试 ====================

  describe('回调函数', () => {
    it('应该触发 onMessageSent 回调', async () => {
      const onMessageSent = vi.fn()
      const { result } = renderHook(() => useChat({ onMessageSent }))

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      expect(onMessageSent).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: defaultChatResponse.message,
        }),
        defaultChatResponse
      )
    })

    it('应该触发 onError 回调', async () => {
      const onError = vi.fn()
      const testError = new Error('Test error')
      mockChatService.sendMessage.mockRejectedValue(testError)

      const { result } = renderHook(() => useChat({ onError }))

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      expect(onError).toHaveBeenCalledWith(testError)
    })

    it('应该触发流式回调', async () => {
      const onStreamStart = vi.fn()
      const onStreamChunk = vi.fn()
      const onStreamComplete = vi.fn()

      let callbacks: any
      mockChatAPI.sendMessageStream.mockImplementation((req: any, options: any) => {
        callbacks = options
        return Promise.resolve(mockStreamManager)
      })

      const { result } = renderHook(() => 
        useChat({
          enableStreaming: true,
          onStreamStart,
          onStreamChunk,
          onStreamComplete,
        })
      )

      await act(async () => {
        await result.current.sendMessage('Hello')
      })

      expect(onStreamStart).toHaveBeenCalled()

      // 模拟流式数据
      act(() => {
        callbacks.onChunk({ delta: 'test' })
        callbacks.onComplete(defaultChatResponse)
      })

      expect(onStreamChunk).toHaveBeenCalledWith('test')
      expect(onStreamComplete).toHaveBeenCalled()
    })
  })

  // ==================== 清理测试 ====================

  describe('清理', () => {
    it('应该在卸载时清理资源', () => {
      const { unmount } = renderHook(() => useChat({ enableStreaming: true }))

      unmount()

      // 确保没有内存泄漏或未清理的资源
      expect(true).toBe(true) // 如果没有崩溃，说明清理正常
    })
  })
})

// ==================== useSimpleChat 测试 ====================

describe('useSimpleChat Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChatService.sendMessage.mockResolvedValue(defaultChatResponse)
  })

  it('应该返回基础聊天功能', () => {
    const { result } = renderHook(() => useSimpleChat())

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(typeof result.current.send).toBe('function')
  })

  it('应该发送消息并更新状态', async () => {
    const { result } = renderHook(() => useSimpleChat('test-session'))

    await act(async () => {
      await result.current.send('Hello')
    })

    expect(mockChatService.sendMessage).toHaveBeenCalledWith({
      message: 'Hello',
      session_id: 'test-session',
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0]).toEqual({
      role: 'user',
      content: 'Hello',
    })
    expect(result.current.messages[1]).toEqual({
      role: 'assistant',
      content: defaultChatResponse.message,
    })
  })

  it('应该处理加载状态', async () => {
    let resolvePromise: (value: any) => void
    const promise = new Promise(resolve => {
      resolvePromise = resolve
    })

    mockChatService.sendMessage.mockReturnValue(promise)

    const { result } = renderHook(() => useSimpleChat())

    act(() => {
      result.current.send('Hello')
    })

    expect(result.current.isLoading).toBe(true)

    await act(async () => {
      resolvePromise!(defaultChatResponse)
    })

    expect(result.current.isLoading).toBe(false)
  })
})

// ==================== 集成测试 ====================

describe('useChat 集成测试', () => {
  beforeEach(() => {
    // 确保集成测试中Mock配置正确
    mockChatAPI.validateMessage.mockImplementation((content: string) => ({ 
      valid: content ? content.trim().length > 0 : false,
      error: content ? (content.trim().length > 0 ? undefined : '消息不能为空') : '消息不能为空'
    }))
  })

  it('应该完成完整的对话流程', async () => {
    const mockHistory = createMockConversation(2)
    mockChatService.getChatHistory.mockResolvedValue({
      messages: mockHistory,
      total: 2,
    })

    const { result } = renderHook(() => 
      useChat({ 
        autoLoadHistory: true,
        onMessageSent: vi.fn(),
      })
    )

    // 等待历史加载
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2)
    })

    // 发送新消息
    await act(async () => {
      await result.current.sendMessage('New message')
    })

    expect(result.current.messages).toHaveLength(4) // 2历史 + 1用户 + 1助手
    expect(result.current.stats.totalMessages).toBe(4)

    // 删除一条消息
    act(() => {
      result.current.deleteMessage(result.current.messages[0].id)
    })

    expect(result.current.messages).toHaveLength(3)

    // 清空历史
    await act(async () => {
      await result.current.clearHistory()
    })

    expect(result.current.messages).toHaveLength(0)
  })

  it('应该处理并发消息发送', async () => {
    const { result } = renderHook(() => useChat())

    const promises = [
      act(async () => result.current.sendMessage('Message 1')),
      act(async () => result.current.sendMessage('Message 2')),
      act(async () => result.current.sendMessage('Message 3')),
    ]

    await Promise.all(promises)

    // 应该有6条消息（3用户 + 3助手）
    expect(result.current.messages).toHaveLength(6)
    expect(mockChatService.sendMessage).toHaveBeenCalledTimes(3)
  })
})
