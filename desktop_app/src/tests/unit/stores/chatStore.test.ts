/**
 * 聊天状态管理 Store 测试
 * 
 * 测试聊天状态管理的所有功能，包括：
 * - 会话管理（创建、删除、切换）
 * - 消息管理（发送、删除、搜索）
 * - 流式响应管理
 * - 对话历史
 * - 统计信息
 * - 事件系统
 * - 模板和建议
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { 
  useChatStore, 
  type ChatStore
} from '@/stores/chatStore'
import {
  type ChatSession,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type StreamChunk,
  type StreamOptions,
  type SessionConfig,
  type SessionStats,
  type GlobalChatStats,
  type MessageSearchOptions,
  type MessageSearchResult,
  type ChatSuggestion,
  type ChatTemplate,
  type ChatEvent,
  type ChatEventListener,
  type BatchOperationResult,
  MessageRole,
  MessageStatus,
  MessageType,
  SessionStatus,
  SessionType,
  StreamStatus,
  FinishReason,
  DEFAULT_SESSION_CONFIG,
  MESSAGE_LIMITS,
  SESSION_LIMITS,
} from '@/types/chat'
import { ChatAPI, StreamManager } from '@/services/api/chat'
import ChatService from '@/services/chat'

// Mock dependencies
vi.mock('zustand/middleware', () => ({
  devtools: vi.fn((fn) => fn),
  persist: vi.fn((fn, options) => fn),
  subscribeWithSelector: vi.fn((fn) => fn),
}))

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'mock-id')
}))

vi.mock('@/services/chat')
vi.mock('@/services/api/chat')

// ==================== 测试数据工厂 ====================

const createMockChatMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-1',
  sessionId: 'session-1',
  role: MessageRole.USER,
  content: 'Hello',
  type: MessageType.TEXT,
  status: MessageStatus.SENT,
  timestamp: Date.now(),
  metadata: {},
  ...overrides,
})

const createMockChatSession = (overrides: Partial<ChatSession> = {}): ChatSession => ({
  id: 'session-1',
  type: SessionType.CHAT,
  status: SessionStatus.ACTIVE,
  title: 'Test Session',
  description: 'A test chat session',
  config: { ...DEFAULT_SESSION_CONFIG },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastMessageAt: Date.now(),
  messageCount: 0,
  tokenCount: 0,
  starred: false,
  pinned: false,
  archived: false,
  tags: [],
  metadata: {},
  ...overrides,
})

const createMockStreamChunk = (overrides: Partial<StreamChunk> = {}): StreamChunk => ({
  id: 'chunk-1',
  content: 'Hello',
  role: MessageRole.ASSISTANT,
  type: MessageType.TEXT,
  delta: 'Hello',
  finishReason: null,
  metadata: {},
  ...overrides,
})

const createMockChatRequest = (overrides: Partial<ChatRequest> = {}): ChatRequest => ({
  sessionId: 'session-1',
  message: createMockChatMessage({ role: MessageRole.USER }),
  config: { ...DEFAULT_SESSION_CONFIG },
  ...overrides,
})

const createMockChatResponse = (overrides: Partial<ChatResponse> = {}): ChatResponse => ({
  id: 'response-1',
  sessionId: 'session-1',
  message: createMockChatMessage({ role: MessageRole.ASSISTANT }),
  finishReason: FinishReason.STOP,
  usage: {
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
  },
  metadata: {},
  ...overrides,
})

const createMockSessionStats = (overrides: Partial<SessionStats> = {}): SessionStats => ({
  messageCount: 0,
  tokenCount: 0,
  averageResponseTime: 0,
  totalCost: 0,
  ...overrides,
})

const createMockGlobalStats = (overrides: Partial<GlobalChatStats> = {}): GlobalChatStats => ({
  totalSessions: 0,
  totalMessages: 0,
  totalTokens: 0,
  totalCost: 0,
  averageSessionLength: 0,
  averageResponseTime: 0,
  ...overrides,
})

const createMockChatTemplate = (overrides: Partial<ChatTemplate> = {}): ChatTemplate => ({
  id: 'template-1',
  name: 'Test Template',
  description: 'A test template',
  content: 'Hello, {name}!',
  variables: ['name'],
  category: 'test',
  tags: ['test'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
})

const createMockChatSuggestion = (overrides: Partial<ChatSuggestion> = {}): ChatSuggestion => ({
  id: 'suggestion-1',
  content: 'How can I help you?',
  type: 'question',
  category: 'general',
  score: 0.8,
  ...overrides,
})

const createMockStreamManager = (): jest.Mocked<StreamManager> => ({
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getStatus: vi.fn().mockReturnValue(StreamStatus.IDLE),
  getAccumulated: vi.fn().mockReturnValue(''),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as any)

// ==================== 测试套件 ====================

describe('ChatStore', () => {
  let mockChatService: jest.Mocked<typeof ChatService>
  let mockChatAPI: jest.Mocked<ChatAPI>
  let mockStreamManager: jest.Mocked<StreamManager>
  
  beforeEach(() => {
    // 重置 Store
    act(() => {
      useChatStore.getState().reset?.()
    })
    
    // 重置所有 mocks
    vi.clearAllMocks()
    
    // 设置 mocks
    mockChatService = ChatService as jest.Mocked<typeof ChatService>
    mockChatAPI = new ChatAPI({}) as jest.Mocked<ChatAPI>
    mockStreamManager = createMockStreamManager()
  })

  // ==================== 初始状态测试 ====================
  
  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const state = useChatStore.getState()
      
      expect(state.sessions).toEqual([])
      expect(state.currentSessionId).toBeNull()
      expect(state.messageMap).toEqual({})
      expect(state.isLoading).toBe(false)
      expect(state.isSending).toBe(false)
      expect(state.streamManagers).toEqual({})
      expect(state.error).toBeNull()
      expect(state.globalConfig).toEqual(DEFAULT_SESSION_CONFIG)
      expect(state.templates).toEqual([])
      expect(state.suggestions).toEqual([])
      expect(state.eventListeners).toEqual([])
      expect(state.sessionStats).toEqual({})
      expect(state.globalStats).toEqual(expect.objectContaining({
        totalSessions: 0,
        totalMessages: 0,
        totalTokens: 0,
        totalCost: 0,
      }))
    })

    it('计算属性应该返回正确的初始值', () => {
      const state = useChatStore.getState()
      
      expect(state.getCurrentSession()).toBeNull()
      expect(state.getCurrentMessages()).toEqual([])
      expect(state.getCurrentStats()).toBeNull()
      expect(state.getActiveSessions()).toEqual([])
      expect(state.getPinnedSessions()).toEqual([])
      expect(state.getStarredSessions()).toEqual([])
      expect(state.isStreaming()).toBe(false)
    })
  })

  // ==================== 会话管理测试 ====================

  describe('会话管理', () => {
    it('应该正确创建会话', () => {
      const sessionData = {
        type: SessionType.CHAT,
        title: 'New Session',
        config: { ...DEFAULT_SESSION_CONFIG, maxTokens: 4096 }
      }
      
      let sessionId: string
      
      act(() => {
        sessionId = useChatStore.getState().createSession(sessionData)
      })
      
      const state = useChatStore.getState()
      
      expect(state.sessions).toHaveLength(1)
      expect(sessionId).toBe('mock-id')
      
      const session = state.sessions[0]
      expect(session.id).toBe('mock-id')
      expect(session.type).toBe(SessionType.CHAT)
      expect(session.title).toBe('New Session')
      expect(session.config.maxTokens).toBe(4096)
      expect(session.status).toBe(SessionStatus.ACTIVE)
      expect(session.createdAt).toBeDefined()
      expect(session.updatedAt).toBeDefined()
      
      // 应该创建对应的统计信息
      expect(state.sessionStats['mock-id']).toBeDefined()
      
      // 第一个会话应该自动设为当前会话
      expect(state.currentSessionId).toBe('mock-id')
    })

    it('应该正确更新会话', () => {
      let sessionId: string
      
      act(() => {
        sessionId = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Original Title'
        })
      })
      
      const updates = {
        title: 'Updated Title',
        description: 'Updated description',
        starred: true,
        pinned: true
      }
      
      act(() => {
        useChatStore.getState().updateSession(sessionId!, updates)
      })
      
      const session = useChatStore.getState().sessions[0]
      expect(session.title).toBe('Updated Title')
      expect(session.description).toBe('Updated description')
      expect(session.starred).toBe(true)
      expect(session.pinned).toBe(true)
      expect(session.updatedAt).toBeGreaterThan(session.createdAt)
    })

    it('应该正确删除会话', () => {
      let sessionId: string
      
      act(() => {
        sessionId = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Test Session'
        })
        // 添加一些消息
        useChatStore.getState().addMessage(sessionId!, createMockChatMessage({ sessionId: sessionId! }))
      })
      
      act(() => {
        useChatStore.getState().deleteSession(sessionId!)
      })
      
      const state = useChatStore.getState()
      expect(state.sessions).toHaveLength(0)
      expect(state.messageMap[sessionId!]).toBeUndefined()
      expect(state.sessionStats[sessionId!]).toBeUndefined()
      expect(state.currentSessionId).toBeNull()
    })

    it('删除当前会话时应该切换到下一个可用会话', () => {
      let sessionId1: string, sessionId2: string
      
      act(() => {
        sessionId1 = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Session 1'
        })
        sessionId2 = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Session 2'
        })
      })
      
      // 当前会话应该是第一个
      expect(useChatStore.getState().currentSessionId).toBe(sessionId1)
      
      // 删除第一个会话
      act(() => {
        useChatStore.getState().deleteSession(sessionId1!)
      })
      
      // 当前会话应该切换到第二个
      expect(useChatStore.getState().currentSessionId).toBe(sessionId2)
    })

    it('应该正确切换会话', () => {
      let sessionId1: string, sessionId2: string
      
      act(() => {
        sessionId1 = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Session 1'
        })
        sessionId2 = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Session 2'
        })
      })
      
      act(() => {
        useChatStore.getState().switchSession(sessionId2!)
      })
      
      expect(useChatStore.getState().currentSessionId).toBe(sessionId2)
    })

    it('应该正确归档/取消归档会话', () => {
      let sessionId: string
      
      act(() => {
        sessionId = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Test Session'
        })
      })
      
      act(() => {
        useChatStore.getState().archiveSession(sessionId!)
      })
      
      let session = useChatStore.getState().sessions[0]
      expect(session.archived).toBe(true)
      expect(session.status).toBe(SessionStatus.ARCHIVED)
      
      act(() => {
        useChatStore.getState().unarchiveSession(sessionId!)
      })
      
      session = useChatStore.getState().sessions[0]
      expect(session.archived).toBe(false)
      expect(session.status).toBe(SessionStatus.ACTIVE)
    })

    it('应该正确复制会话', () => {
      let originalId: string
      
      act(() => {
        originalId = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Original Session',
          config: { ...DEFAULT_SESSION_CONFIG, maxTokens: 4096 }
        })
        // 添加一些消息
        useChatStore.getState().addMessage(originalId!, createMockChatMessage({ 
          sessionId: originalId!,
          content: 'Test message' 
        }))
      })
      
      let duplicatedId: string
      
      act(() => {
        duplicatedId = useChatStore.getState().duplicateSession(originalId!)
      })
      
      const state = useChatStore.getState()
      expect(state.sessions).toHaveLength(2)
      
      const duplicatedSession = state.sessions.find(s => s.id === duplicatedId)!
      expect(duplicatedSession.title).toContain('Copy of Original Session')
      expect(duplicatedSession.config.maxTokens).toBe(4096)
      
      // 消息应该被复制
      const duplicatedMessages = state.messageMap[duplicatedId!]
      expect(duplicatedMessages).toHaveLength(1)
      expect(duplicatedMessages[0].content).toBe('Test message')
    })

    it('获取会话列表的计算属性应该正确工作', () => {
      let sessionId1: string, sessionId2: string, sessionId3: string
      
      act(() => {
        sessionId1 = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Active Session'
        })
        sessionId2 = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Pinned Session'
        })
        sessionId3 = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Starred Session'
        })
        
        useChatStore.getState().updateSession(sessionId2!, { pinned: true })
        useChatStore.getState().updateSession(sessionId3!, { starred: true })
        useChatStore.getState().archiveSession(sessionId1!)
      })
      
      const state = useChatStore.getState()
      
      expect(state.getActiveSessions()).toHaveLength(2) // sessionId2 和 sessionId3
      expect(state.getPinnedSessions()).toHaveLength(1)
      expect(state.getPinnedSessions()[0].id).toBe(sessionId2)
      expect(state.getStarredSessions()).toHaveLength(1)
      expect(state.getStarredSessions()[0].id).toBe(sessionId3)
    })
  })

  // ==================== 消息管理测试 ====================

  describe('消息管理', () => {
    let sessionId: string
    
    beforeEach(() => {
      act(() => {
        sessionId = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Test Session'
        })
      })
    })

    it('应该正确添加消息', () => {
      const message = createMockChatMessage({
        sessionId,
        content: 'Hello world',
        role: MessageRole.USER
      })
      
      act(() => {
        useChatStore.getState().addMessage(sessionId, message)
      })
      
      const state = useChatStore.getState()
      const messages = state.messageMap[sessionId]
      
      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual(message)
      
      // 会话统计应该更新
      const session = state.sessions[0]
      expect(session.messageCount).toBe(1)
      expect(session.lastMessageAt).toBe(message.timestamp)
    })

    it('应该正确更新消息', () => {
      const message = createMockChatMessage({
        id: 'msg-1',
        sessionId,
        content: 'Original content',
        status: MessageStatus.SENDING
      })
      
      act(() => {
        useChatStore.getState().addMessage(sessionId, message)
      })
      
      const updates = {
        content: 'Updated content',
        status: MessageStatus.SENT
      }
      
      act(() => {
        useChatStore.getState().updateMessage(sessionId, 'msg-1', updates)
      })
      
      const messages = useChatStore.getState().messageMap[sessionId]
      expect(messages[0].content).toBe('Updated content')
      expect(messages[0].status).toBe(MessageStatus.SENT)
    })

    it('应该正确删除消息', () => {
      const message1 = createMockChatMessage({
        id: 'msg-1',
        sessionId,
        content: 'Message 1'
      })
      const message2 = createMockChatMessage({
        id: 'msg-2',
        sessionId,
        content: 'Message 2'
      })
      
      act(() => {
        useChatStore.getState().addMessage(sessionId, message1)
        useChatStore.getState().addMessage(sessionId, message2)
      })
      
      act(() => {
        useChatStore.getState().deleteMessage(sessionId, 'msg-1')
      })
      
      const messages = useChatStore.getState().messageMap[sessionId]
      expect(messages).toHaveLength(1)
      expect(messages[0].id).toBe('msg-2')
    })

    it('应该正确清空会话消息', () => {
      act(() => {
        useChatStore.getState().addMessage(sessionId, createMockChatMessage({
          id: 'msg-1',
          sessionId
        }))
        useChatStore.getState().addMessage(sessionId, createMockChatMessage({
          id: 'msg-2',
          sessionId
        }))
      })
      
      act(() => {
        useChatStore.getState().clearMessages(sessionId)
      })
      
      const messages = useChatStore.getState().messageMap[sessionId]
      expect(messages).toEqual([])
      
      // 会话统计应该重置
      const session = useChatStore.getState().sessions[0]
      expect(session.messageCount).toBe(0)
    })

    it('应该正确获取当前会话的消息', () => {
      const message1 = createMockChatMessage({
        id: 'msg-1',
        sessionId,
        content: 'Message 1'
      })
      const message2 = createMockChatMessage({
        id: 'msg-2',
        sessionId,
        content: 'Message 2'
      })
      
      act(() => {
        useChatStore.getState().addMessage(sessionId, message1)
        useChatStore.getState().addMessage(sessionId, message2)
      })
      
      const currentMessages = useChatStore.getState().getCurrentMessages()
      expect(currentMessages).toHaveLength(2)
      expect(currentMessages.map(m => m.id)).toEqual(['msg-1', 'msg-2'])
    })

    it('没有当前会话时获取消息应该返回空数组', () => {
      act(() => {
        useChatStore.setState({ currentSessionId: null })
      })
      
      const currentMessages = useChatStore.getState().getCurrentMessages()
      expect(currentMessages).toEqual([])
    })
  })

  // ==================== 发送消息测试 ====================

  describe('发送消息', () => {
    let sessionId: string
    
    beforeEach(() => {
      act(() => {
        sessionId = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Test Session'
        })
      })
    })

    it('应该正确发送消息', async () => {
      const userMessage = createMockChatMessage({
        role: MessageRole.USER,
        content: 'Hello',
        sessionId
      })
      
      const assistantMessage = createMockChatMessage({
        role: MessageRole.ASSISTANT,
        content: 'Hi there!',
        sessionId
      })
      
      const response = createMockChatResponse({
        sessionId,
        message: assistantMessage
      })
      
      // Mock ChatService.sendMessage
      mockChatService.sendMessage = vi.fn().mockResolvedValue(response)
      
      await act(async () => {
        await useChatStore.getState().sendMessage(userMessage)
      })
      
      const state = useChatStore.getState()
      expect(state.isSending).toBe(false)
      expect(state.error).toBeNull()
      
      const messages = state.messageMap[sessionId]
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe(MessageRole.USER)
      expect(messages[1].role).toBe(MessageRole.ASSISTANT)
      
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        sessionId,
        message: userMessage
      }))
    })

    it('发送消息失败时应该设置错误状态', async () => {
      const userMessage = createMockChatMessage({
        role: MessageRole.USER,
        content: 'Hello',
        sessionId
      })
      
      const error = new Error('Send failed')
      mockChatService.sendMessage = vi.fn().mockRejectedValue(error)
      
      await act(async () => {
        await useChatStore.getState().sendMessage(userMessage)
      })
      
      const state = useChatStore.getState()
      expect(state.isSending).toBe(false)
      expect(state.error).toBe('Send failed')
      
      // 用户消息应该标记为失败
      const messages = state.messageMap[sessionId]
      expect(messages).toHaveLength(1)
      expect(messages[0].status).toBe(MessageStatus.FAILED)
    })

    it('应该正确处理重发消息', async () => {
      const failedMessage = createMockChatMessage({
        id: 'failed-msg',
        sessionId,
        content: 'Hello',
        status: MessageStatus.FAILED
      })
      
      act(() => {
        useChatStore.getState().addMessage(sessionId, failedMessage)
      })
      
      const response = createMockChatResponse({
        sessionId,
        message: createMockChatMessage({
          role: MessageRole.ASSISTANT,
          content: 'Hi there!'
        })
      })
      
      mockChatService.sendMessage = vi.fn().mockResolvedValue(response)
      
      await act(async () => {
        await useChatStore.getState().resendMessage(sessionId, 'failed-msg')
      })
      
      const state = useChatStore.getState()
      const messages = state.messageMap[sessionId]
      
      // 失败的消息状态应该更新为已发送
      expect(messages[0].status).toBe(MessageStatus.SENT)
      
      // 应该有 AI 回复
      expect(messages).toHaveLength(2)
      expect(messages[1].role).toBe(MessageRole.ASSISTANT)
    })
  })

  // ==================== 流式响应测试 ====================

  describe('流式响应', () => {
    let sessionId: string
    
    beforeEach(() => {
      act(() => {
        sessionId = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Test Session'
        })
      })
    })

    it('应该正确开始流式响应', () => {
      const streamOptions: StreamOptions = {
        sessionId,
        messageId: 'msg-1',
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }
      
      act(() => {
        useChatStore.getState().startStreaming(streamOptions)
      })
      
      const state = useChatStore.getState()
      expect(state.streamManagers[sessionId]).toBeDefined()
      expect(state.isStreaming(sessionId)).toBe(false) // 因为 mock 返回 IDLE
    })

    it('应该正确停止流式响应', () => {
      const streamOptions: StreamOptions = {
        sessionId,
        messageId: 'msg-1',
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }
      
      act(() => {
        useChatStore.getState().startStreaming(streamOptions)
        useChatStore.getState().stopStreaming(sessionId)
      })
      
      const state = useChatStore.getState()
      expect(state.streamManagers[sessionId]).toBeUndefined()
    })

    it('应该正确处理流式数据块', () => {
      const chunk = createMockStreamChunk({
        content: 'Hello',
        delta: 'Hello'
      })
      
      const streamOptions: StreamOptions = {
        sessionId,
        messageId: 'msg-1',
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn()
      }
      
      act(() => {
        useChatStore.getState().startStreaming(streamOptions)
        useChatStore.getState().handleStreamChunk(sessionId, chunk)
      })
      
      expect(streamOptions.onChunk).toHaveBeenCalledWith(chunk)
    })
  })

  // ==================== 消息搜索测试 ====================

  describe('消息搜索', () => {
    let sessionId: string
    
    beforeEach(() => {
      act(() => {
        sessionId = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Test Session'
        })
        
        // 添加一些测试消息
        useChatStore.getState().addMessage(sessionId, createMockChatMessage({
          id: 'msg-1',
          sessionId,
          content: 'Hello world',
          role: MessageRole.USER
        }))
        useChatStore.getState().addMessage(sessionId, createMockChatMessage({
          id: 'msg-2',
          sessionId,
          content: 'How are you doing?',
          role: MessageRole.USER
        }))
        useChatStore.getState().addMessage(sessionId, createMockChatMessage({
          id: 'msg-3',
          sessionId,
          content: 'I am doing well, thank you!',
          role: MessageRole.ASSISTANT
        }))
      })
    })

    it('应该正确搜索消息', () => {
      const searchOptions: MessageSearchOptions = {
        query: 'hello',
        caseSensitive: false,
        wholeWord: false
      }
      
      const results = useChatStore.getState().searchMessages(searchOptions)
      
      expect(results.results).toHaveLength(1)
      expect(results.results[0].messageId).toBe('msg-1')
      expect(results.total).toBe(1)
    })

    it('应该支持大小写敏感搜索', () => {
      const searchOptions: MessageSearchOptions = {
        query: 'Hello',
        caseSensitive: true,
        wholeWord: false
      }
      
      const results = useChatStore.getState().searchMessages(searchOptions)
      expect(results.results).toHaveLength(1)
      
      // 搜索小写应该找不到
      const lowerCaseResults = useChatStore.getState().searchMessages({
        ...searchOptions,
        query: 'hello'
      })
      expect(lowerCaseResults.results).toHaveLength(0)
    })

    it('应该支持整词搜索', () => {
      const searchOptions: MessageSearchOptions = {
        query: 'do',
        caseSensitive: false,
        wholeWord: true
      }
      
      const results = useChatStore.getState().searchMessages(searchOptions)
      expect(results.results).toHaveLength(0) // 'do' 在 'doing' 中，不是整词
      
      // 搜索 'doing' 应该找到
      const wholeWordResults = useChatStore.getState().searchMessages({
        ...searchOptions,
        query: 'doing'
      })
      expect(wholeWordResults.results).toHaveLength(2) // 在两条消息中
    })

    it('应该支持按角色过滤搜索', () => {
      const searchOptions: MessageSearchOptions = {
        query: 'you',
        role: MessageRole.USER
      }
      
      const results = useChatStore.getState().searchMessages(searchOptions)
      expect(results.results).toHaveLength(1)
      expect(results.results[0].messageId).toBe('msg-2')
    })

    it('应该支持按时间范围搜索', () => {
      const now = Date.now()
      const searchOptions: MessageSearchOptions = {
        query: 'hello',
        dateRange: {
          start: now - 1000,
          end: now + 1000
        }
      }
      
      const results = useChatStore.getState().searchMessages(searchOptions)
      expect(results.results).toHaveLength(1)
    })

    it('应该支持限制搜索结果数量', () => {
      const searchOptions: MessageSearchOptions = {
        query: 'you',
        limit: 1
      }
      
      const results = useChatStore.getState().searchMessages(searchOptions)
      expect(results.results).toHaveLength(1)
      expect(results.hasMore).toBe(true)
    })
  })

  // ==================== 统计信息测试 ====================

  describe('统计信息', () => {
    let sessionId: string
    
    beforeEach(() => {
      act(() => {
        sessionId = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Test Session'
        })
      })
    })

    it('应该正确更新会话统计', () => {
      const stats: Partial<SessionStats> = {
        messageCount: 10,
        tokenCount: 500,
        averageResponseTime: 1200,
        totalCost: 0.05
      }
      
      act(() => {
        useChatStore.getState().updateSessionStats(sessionId, stats)
      })
      
      const sessionStats = useChatStore.getState().sessionStats[sessionId]
      expect(sessionStats.messageCount).toBe(10)
      expect(sessionStats.tokenCount).toBe(500)
      expect(sessionStats.averageResponseTime).toBe(1200)
      expect(sessionStats.totalCost).toBe(0.05)
    })

    it('应该正确更新全局统计', () => {
      const stats: Partial<GlobalChatStats> = {
        totalSessions: 5,
        totalMessages: 100,
        totalTokens: 5000,
        totalCost: 0.25
      }
      
      act(() => {
        useChatStore.getState().updateGlobalStats(stats)
      })
      
      const globalStats = useChatStore.getState().globalStats
      expect(globalStats.totalSessions).toBe(5)
      expect(globalStats.totalMessages).toBe(100)
      expect(globalStats.totalTokens).toBe(5000)
      expect(globalStats.totalCost).toBe(0.25)
    })

    it('应该正确计算统计信息', () => {
      // 添加一些消息来测试统计计算
      act(() => {
        useChatStore.getState().addMessage(sessionId, createMockChatMessage({
          sessionId,
          metadata: { tokenCount: 10, cost: 0.01 }
        }))
        useChatStore.getState().addMessage(sessionId, createMockChatMessage({
          sessionId,
          metadata: { tokenCount: 15, cost: 0.015 }
        }))
      })
      
      act(() => {
        useChatStore.getState().calculateStats()
      })
      
      const sessionStats = useChatStore.getState().sessionStats[sessionId]
      expect(sessionStats.messageCount).toBe(2)
      // tokenCount 和 cost 需要根据实际的 calculateStats 实现来验证
    })

    it('获取当前会话统计应该正确工作', () => {
      const stats = createMockSessionStats({
        messageCount: 5,
        tokenCount: 250
      })
      
      act(() => {
        useChatStore.getState().updateSessionStats(sessionId, stats)
      })
      
      const currentStats = useChatStore.getState().getCurrentStats()
      expect(currentStats?.messageCount).toBe(5)
      expect(currentStats?.tokenCount).toBe(250)
    })
  })

  // ==================== 模板管理测试 ====================

  describe('模板管理', () => {
    it('应该正确添加模板', () => {
      const template = createMockChatTemplate({
        name: 'Greeting Template',
        content: 'Hello {name}, how are you?'
      })
      
      act(() => {
        useChatStore.getState().addTemplate(template)
      })
      
      const templates = useChatStore.getState().templates
      expect(templates).toHaveLength(1)
      expect(templates[0].name).toBe('Greeting Template')
    })

    it('应该正确更新模板', () => {
      const template = createMockChatTemplate()
      
      act(() => {
        useChatStore.getState().addTemplate(template)
      })
      
      const updates = {
        name: 'Updated Template',
        content: 'Updated content'
      }
      
      act(() => {
        useChatStore.getState().updateTemplate(template.id, updates)
      })
      
      const templates = useChatStore.getState().templates
      expect(templates[0].name).toBe('Updated Template')
      expect(templates[0].content).toBe('Updated content')
    })

    it('应该正确删除模板', () => {
      const template = createMockChatTemplate()
      
      act(() => {
        useChatStore.getState().addTemplate(template)
      })
      
      act(() => {
        useChatStore.getState().deleteTemplate(template.id)
      })
      
      expect(useChatStore.getState().templates).toHaveLength(0)
    })

    it('应该正确应用模板', () => {
      const sessionId = useChatStore.getState().createSession({
        type: SessionType.CHAT,
        title: 'Test Session'
      })
      
      const template = createMockChatTemplate({
        content: 'Hello {name}, welcome to {platform}!'
      })
      
      act(() => {
        useChatStore.getState().addTemplate(template)
      })
      
      const variables = {
        name: 'Alice',
        platform: 'ChatApp'
      }
      
      act(() => {
        useChatStore.getState().applyTemplate(sessionId, template.id, variables)
      })
      
      const messages = useChatStore.getState().messageMap[sessionId]
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('Hello Alice, welcome to ChatApp!')
    })
  })

  // ==================== 建议管理测试 ====================

  describe('建议管理', () => {
    it('应该正确设置建议', () => {
      const suggestions = [
        createMockChatSuggestion({ content: 'How can I help?' }),
        createMockChatSuggestion({ content: 'What do you need?' })
      ]
      
      act(() => {
        useChatStore.getState().setSuggestions(suggestions)
      })
      
      expect(useChatStore.getState().suggestions).toHaveLength(2)
    })

    it('应该正确获取建议', () => {
      const suggestions = [
        createMockChatSuggestion({ 
          content: 'General help',
          category: 'general',
          score: 0.9
        }),
        createMockChatSuggestion({ 
          content: 'Technical support',
          category: 'technical',
          score: 0.8
        })
      ]
      
      act(() => {
        useChatStore.getState().setSuggestions(suggestions)
      })
      
      const generalSuggestions = useChatStore.getState().getSuggestions('general')
      expect(generalSuggestions).toHaveLength(1)
      expect(generalSuggestions[0].content).toBe('General help')
    })
  })

  // ==================== 事件系统测试 ====================

  describe('事件系统', () => {
    it('应该正确添加和触发事件监听器', () => {
      const listener = vi.fn()
      
      act(() => {
        useChatStore.getState().addEventListener(listener)
      })
      
      const event: ChatEvent = {
        type: 'session:created',
        payload: { sessionId: 'test-session' }
      }
      
      act(() => {
        useChatStore.getState().emitEvent(event)
      })
      
      expect(listener).toHaveBeenCalledWith(event)
    })

    it('应该正确移除事件监听器', () => {
      const listener = vi.fn()
      
      act(() => {
        useChatStore.getState().addEventListener(listener)
        useChatStore.getState().removeEventListener(listener)
      })
      
      const event: ChatEvent = {
        type: 'session:created',
        payload: { sessionId: 'test-session' }
      }
      
      act(() => {
        useChatStore.getState().emitEvent(event)
      })
      
      expect(listener).not.toHaveBeenCalled()
    })

    it('事件监听器执行错误不应影响其他监听器', () => {
      const listener1 = vi.fn().mockImplementation(() => {
        throw new Error('Listener error')
      })
      const listener2 = vi.fn()
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      act(() => {
        useChatStore.getState().addEventListener(listener1)
        useChatStore.getState().addEventListener(listener2)
      })
      
      const event: ChatEvent = {
        type: 'session:created',
        payload: { sessionId: 'test-session' }
      }
      
      act(() => {
        useChatStore.getState().emitEvent(event)
      })
      
      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  // ==================== 批量操作测试 ====================

  describe('批量操作', () => {
    let sessionId1: string, sessionId2: string
    
    beforeEach(() => {
      act(() => {
        sessionId1 = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Session 1'
        })
        sessionId2 = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Session 2'
        })
      })
    })

    it('应该正确批量删除会话', () => {
      act(() => {
        useChatStore.getState().batchDeleteSessions([sessionId1, sessionId2])
      })
      
      expect(useChatStore.getState().sessions).toHaveLength(0)
    })

    it('应该正确批量归档会话', () => {
      act(() => {
        useChatStore.getState().batchArchiveSessions([sessionId1, sessionId2])
      })
      
      const sessions = useChatStore.getState().sessions
      expect(sessions.every(s => s.archived)).toBe(true)
      expect(sessions.every(s => s.status === SessionStatus.ARCHIVED)).toBe(true)
    })

    it('应该正确批量导出会话', () => {
      // 添加一些消息
      act(() => {
        useChatStore.getState().addMessage(sessionId1, createMockChatMessage({
          sessionId: sessionId1,
          content: 'Hello from session 1'
        }))
        useChatStore.getState().addMessage(sessionId2, createMockChatMessage({
          sessionId: sessionId2,
          content: 'Hello from session 2'
        }))
      })
      
      const exportData = useChatStore.getState().exportSessions([sessionId1, sessionId2])
      
      expect(exportData.sessions).toHaveLength(2)
      expect(exportData.messages[sessionId1]).toHaveLength(1)
      expect(exportData.messages[sessionId2]).toHaveLength(1)
    })
  })

  // ==================== 工具方法测试 ====================

  describe('工具方法', () => {
    it('reset 应该重置所有状态', () => {
      // 设置一些状态
      act(() => {
        const sessionId = useChatStore.getState().createSession({
          type: SessionType.CHAT,
          title: 'Test Session'
        })
        useChatStore.getState().addMessage(sessionId, createMockChatMessage({ sessionId }))
        useChatStore.setState({ isLoading: true, error: 'Test error' })
      })
      
      act(() => {
        useChatStore.getState().reset?.()
      })
      
      const state = useChatStore.getState()
      expect(state.sessions).toEqual([])
      expect(state.currentSessionId).toBeNull()
      expect(state.messageMap).toEqual({})
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.streamManagers).toEqual({})
      expect(state.sessionStats).toEqual({})
    })

    it('clearError 应该清除错误信息', () => {
      act(() => {
        useChatStore.setState({ error: 'Test error' })
      })
      
      act(() => {
        useChatStore.getState().clearError?.()
      })
      
      expect(useChatStore.getState().error).toBeNull()
    })

    it('setLoading 应该设置加载状态', () => {
      act(() => {
        useChatStore.getState().setLoading?.(true)
      })
      
      expect(useChatStore.getState().isLoading).toBe(true)
      
      act(() => {
        useChatStore.getState().setLoading?.(false)
      })
      
      expect(useChatStore.getState().isLoading).toBe(false)
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理', () => {
    it('应该正确处理发送消息时的网络错误', async () => {
      const sessionId = useChatStore.getState().createSession({
        type: SessionType.CHAT,
        title: 'Test Session'
      })
      
      const userMessage = createMockChatMessage({
        sessionId,
        content: 'Hello'
      })
      
      mockChatService.sendMessage = vi.fn().mockRejectedValue(new Error('Network error'))
      
      await act(async () => {
        await useChatStore.getState().sendMessage(userMessage)
      })
      
      expect(useChatStore.getState().error).toBe('Network error')
      expect(useChatStore.getState().isSending).toBe(false)
    })

    it('应该正确处理流式响应错误', () => {
      const sessionId = useChatStore.getState().createSession({
        type: SessionType.CHAT,
        title: 'Test Session'
      })
      
      const onError = vi.fn()
      const streamOptions: StreamOptions = {
        sessionId,
        messageId: 'msg-1',
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError
      }
      
      act(() => {
        useChatStore.getState().startStreaming(streamOptions)
        useChatStore.getState().handleStreamError(sessionId, new Error('Stream error'))
      })
      
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  // ==================== Hook 集成测试 ====================

  describe('Hook 集成', () => {
    it('应该能够在 React Hook 中正确使用', () => {
      const { result } = renderHook(() => useChatStore())
      
      // 初始状态检查
      expect(result.current.sessions).toEqual([])
      expect(result.current.isLoading).toBe(false)
      
      // 测试状态更新
      act(() => {
        result.current.createSession({
          type: SessionType.CHAT,
          title: 'Hook Test Session'
        })
      })
      
      expect(result.current.sessions).toHaveLength(1)
      expect(result.current.sessions[0].title).toBe('Hook Test Session')
    })
  })
})
