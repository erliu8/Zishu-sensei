/**
 * 对话状态管理 Store
 * 
 * 使用 Zustand 管理对话相关的所有状态，包括：
 * - 会话列表和当前会话
 * - 消息管理（增删改查）
 * - 流式响应控制
 * - 对话历史
 * - 统计信息
 * - 事件系统
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { nanoid } from 'nanoid'
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
import ChatService from '@/services/chat'
import { ChatAPI, StreamManager } from '@/services/api/chat'

// ==================== 类型定义 ====================

/**
 * 流式响应管理器
 */
interface StreamManagerState {
  /** 消息 ID */
  messageId: string
  /** 会话 ID */
  sessionId: string
  /** 管理器实例 */
  manager: StreamManager
  /** 状态 */
  status: StreamStatus
  /** 累积内容 */
  accumulated: string
  /** 开始时间 */
  startTime: number
}

/**
 * 聊天 Store 状态
 */
export interface ChatStore {
  // ==================== 基础状态 ====================
  /** 会话列表 */
  sessions: ChatSession[]
  /** 当前会话 ID */
  currentSessionId: string | null
  /** 消息映射（会话ID -> 消息列表） */
  messageMap: Record<string, ChatMessage[]>
  /** 是否正在加载 */
  isLoading: boolean
  /** 是否正在发送消息 */
  isSending: boolean
  /** 流式响应管理器映射 */
  streamManagers: Record<string, StreamManagerState>
  /** 错误信息 */
  error: Error | null
  /** 全局配置 */
  globalConfig: SessionConfig
  /** 模板列表 */
  templates: ChatTemplate[]
  /** 建议列表 */
  suggestions: ChatSuggestion[]
  /** 事件监听器 */
  eventListeners: ChatEventListener[]

  // ==================== 统计信息 ====================
  /** 会话统计映射 */
  sessionStats: Record<string, SessionStats>
  /** 全局统计 */
  globalStats: GlobalChatStats

  // ==================== 计算属性 ====================
  /** 获取当前会话 */
  getCurrentSession: () => ChatSession | null
  /** 获取当前会话消息 */
  getCurrentMessages: () => ChatMessage[]
  /** 获取当前会话统计 */
  getCurrentStats: () => SessionStats | null
  /** 获取活跃会话列表 */
  getActiveSessions: () => ChatSession[]
  /** 获取置顶会话列表 */
  getPinnedSessions: () => ChatSession[]
  /** 获取收藏会话列表 */
  getStarredSessions: () => ChatSession[]
  /** 检查是否正在流式传输 */
  isStreaming: (sessionId?: string) => boolean

  // ==================== 会话管理 ====================
  /** 创建新会话 */
  createSession: (
    title?: string,
    type?: SessionType,
    config?: Partial<SessionConfig>
  ) => string
  /** 更新会话 */
  updateSession: (sessionId: string, updates: Partial<ChatSession>) => void
  /** 删除会话 */
  deleteSession: (sessionId: string) => void
  /** 归档会话 */
  archiveSession: (sessionId: string) => void
  /** 切换当前会话 */
  switchSession: (sessionId: string) => void
  /** 克隆会话 */
  cloneSession: (sessionId: string) => string
  /** 重命名会话 */
  renameSession: (sessionId: string, title: string) => void
  /** 置顶/取消置顶会话 */
  togglePinSession: (sessionId: string) => void
  /** 收藏/取消收藏会话 */
  toggleStarSession: (sessionId: string) => void
  /** 批量删除会话 */
  batchDeleteSessions: (sessionIds: string[]) => BatchOperationResult

  // ==================== 消息管理 ====================
  /** 添加消息 */
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  /** 更新消息 */
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void
  /** 删除消息 */
  deleteMessage: (sessionId: string, messageId: string) => void
  /** 批量删除消息 */
  batchDeleteMessages: (sessionId: string, messageIds: string[]) => BatchOperationResult
  /** 清空会话消息 */
  clearSessionMessages: (sessionId: string) => void
  /** 获取消息 */
  getMessage: (sessionId: string, messageId: string) => ChatMessage | null
  /** 置顶/取消置顶消息 */
  togglePinMessage: (sessionId: string, messageId: string) => void
  /** 收藏/取消收藏消息 */
  toggleStarMessage: (sessionId: string, messageId: string) => void

  // ==================== 对话功能 ====================
  /** 发送消息 */
  sendMessage: (content: string, options?: Partial<ChatRequest>) => Promise<ChatResponse>
  /** 发送流式消息 */
  sendStreamMessage: (
    content: string,
    options?: Partial<ChatRequest> & { streamOptions?: Partial<StreamOptions> }
  ) => Promise<void>
  /** 停止流式响应 */
  stopStreaming: (sessionId?: string) => void
  /** 重新发送消息 */
  resendMessage: (sessionId: string, messageId: string) => Promise<void>
  /** 编辑并重新发送 */
  editAndResend: (sessionId: string, messageId: string, newContent: string) => Promise<void>
  /** 重新生成回复 */
  regenerateResponse: (sessionId: string, messageId: string) => Promise<void>

  // ==================== 历史管理 ====================
  /** 加载会话历史 */
  loadHistory: (sessionId: string, limit?: number) => Promise<void>
  /** 清空会话历史 */
  clearHistory: (sessionId: string) => Promise<void>
  /** 导出会话 */
  exportSession: (sessionId: string, format?: 'json' | 'markdown' | 'txt') => string
  /** 导入会话 */
  importSession: (data: string, format?: 'json') => string

  // ==================== 搜索功能 ====================
  /** 搜索消息 */
  searchMessages: (options: MessageSearchOptions) => MessageSearchResult[]
  /** 全局搜索 */
  globalSearch: (keyword: string, limit?: number) => MessageSearchResult[]

  // ==================== 建议和模板 ====================
  /** 获取对话建议 */
  getSuggestions: (sessionId: string, count?: number) => ChatSuggestion[]
  /** 添加建议 */
  addSuggestion: (suggestion: Omit<ChatSuggestion, 'id'>) => void
  /** 清空建议 */
  clearSuggestions: () => void
  /** 从模板创建会话 */
  createFromTemplate: (templateId: string) => string
  /** 添加模板 */
  addTemplate: (template: Omit<ChatTemplate, 'id' | 'createdAt'>) => string
  /** 删除模板 */
  deleteTemplate: (templateId: string) => void

  // ==================== 统计功能 ====================
  /** 更新会话统计 */
  updateSessionStats: (sessionId: string) => void
  /** 更新全局统计 */
  updateGlobalStats: () => void
  /** 获取会话统计 */
  getSessionStats: (sessionId: string) => SessionStats | null

  // ==================== 事件系统 ====================
  /** 添加事件监听器 */
  addEventListener: (listener: ChatEventListener) => () => void
  /** 移除事件监听器 */
  removeEventListener: (listener: ChatEventListener) => void
  /** 触发事件 */
  emitEvent: (event: ChatEvent) => void

  // ==================== 配置管理 ====================
  /** 更新全局配置 */
  updateGlobalConfig: (config: Partial<SessionConfig>) => void
  /** 更新会话配置 */
  updateSessionConfig: (sessionId: string, config: Partial<SessionConfig>) => void
  /** 重置配置 */
  resetConfig: (sessionId?: string) => void

  // ==================== 工具方法 ====================
  /** 清除错误 */
  clearError: () => void
  /** 重置 Store */
  reset: () => void
  /** 清理过期数据 */
  cleanup: (daysToKeep?: number) => number
}

// ==================== 辅助函数 ====================

/**
 * 生成消息 ID
 */
const generateMessageId = () => `msg_${nanoid()}`

/**
 * 生成会话 ID
 */
const generateSessionId = () => `session_${nanoid()}`

/**
 * 创建默认会话
 */
const createDefaultSession = (
  title: string = '新对话',
  type: SessionType = SessionType.CHAT,
  config?: Partial<SessionConfig>
): ChatSession => {
  const now = Date.now()
  return {
    id: generateSessionId(),
    title,
    type,
    status: SessionStatus.ACTIVE,
    messages: [],
    config: { ...DEFAULT_SESSION_CONFIG, ...config },
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    messageCount: 0,
    totalTokens: 0,
    pinned: false,
    starred: false,
  }
}

/**
 * 创建默认统计
 */
const createDefaultStats = (): SessionStats => ({
  totalMessages: 0,
  userMessages: 0,
  assistantMessages: 0,
  systemMessages: 0,
  totalTokens: 0,
  avgResponseTime: 0,
  minResponseTime: 0,
  maxResponseTime: 0,
  sessionDuration: 0,
})

/**
 * 创建默认全局统计
 */
const createDefaultGlobalStats = (): GlobalChatStats => ({
  totalSessions: 0,
  activeSessions: 0,
  totalMessages: 0,
  totalTokens: 0,
  avgSessionLength: 0,
  avgMessageLength: 0,
  todayMessages: 0,
  todayTokens: 0,
  weekMessages: 0,
  weekTokens: 0,
})

/**
 * 计算会话统计
 */
const calculateSessionStats = (messages: ChatMessage[]): SessionStats => {
  const stats = createDefaultStats()
  const responseTimes: number[] = []

  stats.totalMessages = messages.length
  stats.userMessages = messages.filter((m) => m.role === MessageRole.USER).length
  stats.assistantMessages = messages.filter((m) => m.role === MessageRole.ASSISTANT).length
  stats.systemMessages = messages.filter((m) => m.role === MessageRole.SYSTEM).length

  messages.forEach((msg) => {
    if (msg.metadata?.tokenUsage) {
      stats.totalTokens += msg.metadata.tokenUsage.total
    }
    if (msg.metadata?.processingTime) {
      responseTimes.push(msg.metadata.processingTime)
    }
  })

  if (responseTimes.length > 0) {
    stats.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    stats.minResponseTime = Math.min(...responseTimes)
    stats.maxResponseTime = Math.max(...responseTimes)
  }

  if (messages.length > 0) {
    stats.firstMessageAt = messages[0].timestamp
    stats.lastMessageAt = messages[messages.length - 1].timestamp
    stats.sessionDuration = (stats.lastMessageAt - stats.firstMessageAt) / 1000
  }

  return stats
}

/**
 * 搜索消息（简单文本匹配）
 */
const searchInMessages = (
  messages: ChatMessage[],
  keyword: string,
  options?: Partial<MessageSearchOptions>
): MessageSearchResult[] => {
  const results: MessageSearchResult[] = []
  const searchText = options?.caseSensitive ? keyword : keyword.toLowerCase()

  for (const message of messages) {
    const content =
      typeof message.content === 'string' ? message.content : message.content.text || ''
    const searchContent = options?.caseSensitive ? content : content.toLowerCase()

    let matchIndex = -1
    if (options?.useRegex) {
      try {
        const regex = new RegExp(keyword, options.caseSensitive ? '' : 'i')
        const match = content.match(regex)
        if (match && match.index !== undefined) {
          matchIndex = match.index
        }
      } catch {
        // 正则表达式无效，回退到普通搜索
        matchIndex = searchContent.indexOf(searchText)
      }
    } else {
      matchIndex = searchContent.indexOf(searchText)
    }

    if (matchIndex !== -1) {
      // 过滤条件
      if (options?.roles && !options.roles.includes(message.role)) continue
      if (options?.types && !options.types.includes(message.type)) continue
      if (options?.startTime && message.timestamp < options.startTime) continue
      if (options?.endTime && message.timestamp > options.endTime) continue

      // 提取匹配文本片段
      const start = Math.max(0, matchIndex - 50)
      const end = Math.min(content.length, matchIndex + keyword.length + 50)
      const matchedText = content.slice(start, end)

      results.push({
        message,
        matchedText,
        matchPosition: {
          start: matchIndex,
          end: matchIndex + keyword.length,
        },
        score: 1.0,
      })
    }
  }

  return results
}

// ==================== Store 实现 ====================

/**
 * 聊天状态管理 Store
 */
export const useChatStore = create<ChatStore>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // ==================== 初始状态 ====================
        sessions: [],
        currentSessionId: null,
        messageMap: {},
        isLoading: false,
        isSending: false,
        streamManagers: {},
        error: null,
        globalConfig: { ...DEFAULT_SESSION_CONFIG },
        templates: [],
        suggestions: [],
        eventListeners: [],
        sessionStats: {},
        globalStats: createDefaultGlobalStats(),

        // ==================== 计算属性 ====================
        getCurrentSession: () => {
          const { sessions, currentSessionId } = get()
          return sessions.find((s) => s.id === currentSessionId) || null
        },

        getCurrentMessages: () => {
          const { messageMap, currentSessionId } = get()
          if (!currentSessionId) return []
          return messageMap[currentSessionId] || []
        },

        getCurrentStats: () => {
          const { sessionStats, currentSessionId } = get()
          if (!currentSessionId) return null
          return sessionStats[currentSessionId] || null
        },

        getActiveSessions: () => {
          return get().sessions.filter((s) => s.status === SessionStatus.ACTIVE)
        },

        getPinnedSessions: () => {
          return get().sessions.filter((s) => s.pinned)
        },

        getStarredSessions: () => {
          return get().sessions.filter((s) => s.starred)
        },

        isStreaming: (sessionId) => {
          const { streamManagers, currentSessionId } = get()
          const sid = sessionId || currentSessionId
          if (!sid) return false
          const manager = streamManagers[sid]
          return manager?.status === StreamStatus.STREAMING
        },

        // ==================== 会话管理 ====================
        createSession: (title, type = SessionType.CHAT, config) => {
          const session = createDefaultSession(title, type, config)
          const stats = createDefaultStats()

          set((state) => ({
            sessions: [...state.sessions, session],
            messageMap: {
              ...state.messageMap,
              [session.id]: [],
            },
            sessionStats: {
              ...state.sessionStats,
              [session.id]: stats,
            },
            currentSessionId: session.id,
          }))

          get().emitEvent({
            type: 'session:created',
            payload: { session },
          })

          get().updateGlobalStats()

          return session.id
        },

        updateSession: (sessionId, updates) => {
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? { ...s, ...updates, updatedAt: Date.now() }
                : s
            ),
          }))

          get().emitEvent({
            type: 'session:updated',
            payload: { sessionId, updates },
          })
        },

        deleteSession: (sessionId) => {
          const state = get()
          const { [sessionId]: _, ...newMessageMap } = state.messageMap
          const { [sessionId]: __, ...newSessionStats } = state.sessionStats
          const { [sessionId]: ___, ...newStreamManagers } = state.streamManagers

          // 停止可能的流式传输
          const manager = state.streamManagers[sessionId]
          if (manager) {
            manager.manager.abort()
          }

          set({
            sessions: state.sessions.filter((s) => s.id !== sessionId),
            messageMap: newMessageMap,
            sessionStats: newSessionStats,
            streamManagers: newStreamManagers,
            currentSessionId:
              state.currentSessionId === sessionId
                ? state.sessions[0]?.id || null
                : state.currentSessionId,
          })

          get().emitEvent({
            type: 'session:deleted',
            payload: { sessionId },
          })

          get().updateGlobalStats()
        },

        archiveSession: (sessionId) => {
          get().updateSession(sessionId, { status: SessionStatus.ARCHIVED })
        },

        switchSession: (sessionId) => {
          const session = get().sessions.find((s) => s.id === sessionId)
          if (!session) {
            set({ error: new Error(`会话不存在: ${sessionId}`) })
            return
          }

          set({ currentSessionId: sessionId })
        },

        cloneSession: (sessionId) => {
          const state = get()
          const session = state.sessions.find((s) => s.id === sessionId)
          if (!session) {
            set({ error: new Error(`会话不存在: ${sessionId}`) })
            return ''
          }

          const newSession: ChatSession = {
            ...session,
            id: generateSessionId(),
            title: `${session.title} (副本)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lastActivityAt: Date.now(),
          }

          // 克隆消息
          const messages = state.messageMap[sessionId] || []
          const newMessages = messages.map((msg) => ({
            ...msg,
            id: generateMessageId(),
            sessionId: newSession.id,
          }))

          set({
            sessions: [...state.sessions, newSession],
            messageMap: {
              ...state.messageMap,
              [newSession.id]: newMessages,
            },
            sessionStats: {
              ...state.sessionStats,
              [newSession.id]: { ...state.sessionStats[sessionId] },
            },
          })

          get().emitEvent({
            type: 'session:created',
            payload: { session: newSession },
          })

          return newSession.id
        },

        renameSession: (sessionId, title) => {
          if (title.length < SESSION_LIMITS.MIN_TITLE_LENGTH) {
            set({ error: new Error('会话标题太短') })
            return
          }
          if (title.length > SESSION_LIMITS.MAX_TITLE_LENGTH) {
            set({ error: new Error('会话标题太长') })
            return
          }
          get().updateSession(sessionId, { title })
        },

        togglePinSession: (sessionId) => {
          const session = get().sessions.find((s) => s.id === sessionId)
          if (session) {
            get().updateSession(sessionId, { pinned: !session.pinned })
          }
        },

        toggleStarSession: (sessionId) => {
          const session = get().sessions.find((s) => s.id === sessionId)
          if (session) {
            get().updateSession(sessionId, { starred: !session.starred })
          }
        },

        batchDeleteSessions: (sessionIds) => {
          const result: BatchOperationResult = {
            successCount: 0,
            failureCount: 0,
            totalCount: sessionIds.length,
            successIds: [],
            failureIds: [],
            errors: [],
          }

          for (const sessionId of sessionIds) {
            try {
              get().deleteSession(sessionId)
              result.successCount++
              result.successIds.push(sessionId)
            } catch (error) {
              result.failureCount++
              result.failureIds.push(sessionId)
              result.errors?.push({
                id: sessionId,
                error: error instanceof Error ? error.message : '未知错误',
              })
            }
          }

          return result
        },

        // ==================== 消息管理 ====================
        addMessage: (sessionId, message) => {
          const messageId = generateMessageId()
          const now = Date.now()

          const fullMessage: ChatMessage = {
            ...message,
            id: messageId,
            sessionId,
            timestamp: now,
          }

          set((state) => {
            const messages = state.messageMap[sessionId] || []
            const newMessages = [...messages, fullMessage]

            // 限制消息数量
            if (newMessages.length > SESSION_LIMITS.MAX_MESSAGES_PER_SESSION) {
              newMessages.shift()
            }

            return {
              messageMap: {
                ...state.messageMap,
                [sessionId]: newMessages,
              },
              sessions: state.sessions.map((s) =>
                s.id === sessionId
                  ? {
                      ...s,
                      messageCount: s.messageCount + 1,
                      lastActivityAt: now,
                      updatedAt: now,
                    }
                  : s
              ),
            }
          })

          get().emitEvent({
            type: 'message:sent',
            payload: { sessionId, message: fullMessage },
          })

          get().updateSessionStats(sessionId)

          return messageId
        },

        updateMessage: (sessionId, messageId, updates) => {
          set((state) => ({
            messageMap: {
              ...state.messageMap,
              [sessionId]: (state.messageMap[sessionId] || []).map((msg) =>
                msg.id === messageId ? { ...msg, ...updates } : msg
              ),
            },
          }))

          get().emitEvent({
            type: 'message:updated',
            payload: { sessionId, messageId, updates },
          })
        },

        deleteMessage: (sessionId, messageId) => {
          set((state) => ({
            messageMap: {
              ...state.messageMap,
              [sessionId]: (state.messageMap[sessionId] || []).filter(
                (msg) => msg.id !== messageId
              ),
            },
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? { ...s, messageCount: Math.max(0, s.messageCount - 1) }
                : s
            ),
          }))

          get().emitEvent({
            type: 'message:deleted',
            payload: { sessionId, messageId },
          })

          get().updateSessionStats(sessionId)
        },

        batchDeleteMessages: (sessionId, messageIds) => {
          const result: BatchOperationResult = {
            successCount: 0,
            failureCount: 0,
            totalCount: messageIds.length,
            successIds: [],
            failureIds: [],
          }

          for (const messageId of messageIds) {
            try {
              get().deleteMessage(sessionId, messageId)
              result.successCount++
              result.successIds.push(messageId)
            } catch (error) {
              result.failureCount++
              result.failureIds.push(messageId)
            }
          }

          return result
        },

        clearSessionMessages: (sessionId) => {
          set((state) => ({
            messageMap: {
              ...state.messageMap,
              [sessionId]: [],
            },
            sessions: state.sessions.map((s) =>
              s.id === sessionId ? { ...s, messageCount: 0, totalTokens: 0 } : s
            ),
          }))

          get().updateSessionStats(sessionId)
        },

        getMessage: (sessionId, messageId) => {
          const messages = get().messageMap[sessionId] || []
          return messages.find((msg) => msg.id === messageId) || null
        },

        togglePinMessage: (sessionId, messageId) => {
          const message = get().getMessage(sessionId, messageId)
          if (message) {
            get().updateMessage(sessionId, messageId, { pinned: !message.pinned })
          }
        },

        toggleStarMessage: (sessionId, messageId) => {
          const message = get().getMessage(sessionId, messageId)
          if (message) {
            get().updateMessage(sessionId, messageId, { starred: !message.starred })
          }
        },

        // ==================== 对话功能 ====================
        sendMessage: async (content, options = {}) => {
          const state = get()
          let sessionId = options.sessionId || state.currentSessionId

          // 如果没有当前会话，创建新会话
          if (!sessionId) {
            sessionId = get().createSession()
          }

          // 验证消息
          const validation = ChatAPI.validateMessage(content)
          if (!validation.valid) {
            const error = new Error(validation.error)
            set({ error })
            throw error
          }

          set({ isSending: true, error: null })

          const startTime = Date.now()

          // 添加用户消息
          get().addMessage(sessionId, {
            role: MessageRole.USER,
            type: MessageType.TEXT,
            content,
            status: MessageStatus.SENT,
            sessionId,
          })

          try {
            // 准备上下文消息
            const messages = state.messageMap[sessionId] || []
            const session = state.sessions.find((s) => s.id === sessionId)
            const config = session?.config || state.globalConfig
            const maxContext = options.contextMessages?.length || config.maxContextMessages || 10

            const contextMessages = messages
              .slice(-maxContext)
              .map((msg) => ({
                role: msg.role as string,
                content: typeof msg.content === 'string' ? msg.content : msg.content.text || '',
              }))

            // 发送请求
            const response = await ChatService.sendMessage({
              message: content,
              session_id: sessionId,
              model: options.model || config.modelId,
              adapter: options.adapter || config.adapterId,
              character_id: options.characterId || config.characterId,
              temperature: options.temperature ?? config.temperature,
              top_p: options.topP ?? config.topP,
              max_tokens: options.maxTokens ?? config.maxTokens,
              context_messages: contextMessages,
              ...options,
            })

            const processingTime = Date.now() - startTime

            // 添加助手消息
            get().addMessage(sessionId, {
              role: MessageRole.ASSISTANT,
              type: MessageType.TEXT,
              content: response.message,
              status: MessageStatus.RECEIVED,
              sessionId,
              metadata: {
                processingTime,
                tokenUsage: response.usage
                  ? {
                      prompt: response.usage.prompt_tokens,
                      completion: response.usage.completion_tokens,
                      total: response.usage.total_tokens,
                    }
                  : undefined,
                model: response.model,
                finishReason: response.finish_reason as FinishReason,
              },
            })

            // 更新会话 token 计数
            if (response.usage) {
              const session = get().sessions.find((s) => s.id === sessionId)
              if (session) {
                get().updateSession(sessionId, {
                  totalTokens: session.totalTokens + response.usage.total_tokens,
                })
              }
            }

            set({ isSending: false })
            
            // 转换返回类型
            return {
              messageId: response.message_id,
              sessionId: response.session_id,
              message: response.message,
              model: response.model,
              processingTime: response.processing_time,
              usage: response.usage
                ? {
                    promptTokens: response.usage.prompt_tokens,
                    completionTokens: response.usage.completion_tokens,
                    totalTokens: response.usage.total_tokens,
                  }
                : undefined,
              finishReason: response.finish_reason as FinishReason,
            }
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error))
            set({ error: err, isSending: false })

            // 添加错误消息
            get().addMessage(sessionId, {
              role: MessageRole.SYSTEM,
              type: MessageType.ERROR,
              content: `发送失败: ${err.message}`,
              status: MessageStatus.FAILED,
              sessionId,
            })

            get().emitEvent({
              type: 'error',
              payload: { error: err, context: { sessionId, content } },
            })

            throw err
          }
        },

        sendStreamMessage: async (content, options = {}) => {
          const state = get()
          let sessionId = options.sessionId || state.currentSessionId

          // 如果没有当前会话，创建新会话
          if (!sessionId) {
            sessionId = get().createSession()
          }

          // 验证消息
          const validation = ChatAPI.validateMessage(content)
          if (!validation.valid) {
            const error = new Error(validation.error)
            set({ error })
            throw error
          }

          set({ isSending: true, error: null })

          const startTime = Date.now()

          // 添加用户消息
          get().addMessage(sessionId, {
            role: MessageRole.USER,
            type: MessageType.TEXT,
            content,
            status: MessageStatus.SENT,
            sessionId,
          })

          // 创建占位消息
          const placeholderMessageId = get().addMessage(sessionId, {
            role: MessageRole.ASSISTANT,
            type: MessageType.TEXT,
            content: '',
            status: MessageStatus.RECEIVING,
            sessionId,
          })

          try {
            // 准备上下文消息
            const messages = state.messageMap[sessionId] || []
            const session = state.sessions.find((s) => s.id === sessionId)
            const config = session?.config || state.globalConfig
            const maxContext = config.maxContextMessages || 10

            const contextMessages = messages
              .slice(-(maxContext + 2))
              .filter((msg) => msg.id !== placeholderMessageId)
              .map((msg) => ({
                role: msg.role as string,
                content: typeof msg.content === 'string' ? msg.content : msg.content.text || '',
              }))

            let accumulated = ''

            // 导入 StreamOptions 类型来自 services/api/chat
            const streamOptions = {
              onChunk: (chunk: any) => {
                // 触发开始事件（仅第一次）
                if (accumulated === '') {
                  options.streamOptions?.onStart?.()
                  get().emitEvent({
                    type: 'stream:start',
                    payload: { sessionId, messageId: placeholderMessageId },
                  })
                }

                if (chunk.delta) {
                  accumulated += chunk.delta
                  get().updateMessage(sessionId, placeholderMessageId, {
                    content: accumulated,
                  })
                  
                  const streamChunk: StreamChunk = {
                    delta: chunk.delta,
                    accumulated,
                  }
                  options.streamOptions?.onChunk?.(streamChunk)
                  get().emitEvent({
                    type: 'stream:chunk',
                    payload: { sessionId, messageId: placeholderMessageId, chunk: streamChunk },
                  })
                }
              },
              onComplete: (response: any) => {
                const processingTime = Date.now() - startTime

                get().updateMessage(sessionId, placeholderMessageId, {
                  status: MessageStatus.RECEIVED,
                  metadata: {
                    processingTime,
                    tokenUsage: response.usage
                      ? {
                          prompt: response.usage.prompt_tokens,
                          completion: response.usage.completion_tokens,
                          total: response.usage.total_tokens,
                        }
                      : undefined,
                    model: response.model,
                    finishReason: response.finish_reason as FinishReason,
                  },
                })

                // 更新会话 token 计数
                if (response.usage) {
                  const session = get().sessions.find((s) => s.id === sessionId)
                  if (session) {
                    get().updateSession(sessionId, {
                      totalTokens: session.totalTokens + response.usage.total_tokens,
                    })
                  }
                }

                // 清理流管理器
                const newManagers = { ...get().streamManagers }
                delete newManagers[sessionId]
                set({ streamManagers: newManagers, isSending: false })

                // 转换响应格式并调用回调
                const chatResponse: ChatResponse = {
                  messageId: response.message_id,
                  sessionId: response.session_id,
                  message: response.message,
                  model: response.model,
                  processingTime: response.processing_time,
                  usage: response.usage
                    ? {
                        promptTokens: response.usage.prompt_tokens,
                        completionTokens: response.usage.completion_tokens,
                        totalTokens: response.usage.total_tokens,
                      }
                    : undefined,
                  finishReason: response.finish_reason as FinishReason,
                }
                
                options.streamOptions?.onComplete?.(chatResponse)
                get().emitEvent({
                  type: 'stream:complete',
                  payload: { sessionId, messageId: placeholderMessageId },
                })
              },
              onError: (chatError: any) => {
                const error = new Error(chatError.message || '流式传输失败')
                set({ error, isSending: false })

                // 移除占位消息
                get().deleteMessage(sessionId, placeholderMessageId)

                // 添加错误消息
                get().addMessage(sessionId, {
                  role: MessageRole.SYSTEM,
                  type: MessageType.ERROR,
                  content: `发送失败: ${chatError.message || error.message}`,
                  status: MessageStatus.FAILED,
                  sessionId,
                })

                // 清理流管理器
                const newManagers = { ...get().streamManagers }
                delete newManagers[sessionId]
                set({ streamManagers: newManagers })

                options.streamOptions?.onError?.(error)
                get().emitEvent({
                  type: 'stream:error',
                  payload: { sessionId, messageId: placeholderMessageId, error },
                })
              },
            }

            // 发送流式请求
            const manager = await ChatAPI.sendMessageStream(
              {
                message: content,
                session_id: sessionId,
                model: options.model || config.modelId,
                adapter: options.adapter || config.adapterId,
                character_id: options.characterId || config.characterId,
                temperature: options.temperature ?? config.temperature,
                top_p: options.topP ?? config.topP,
                max_tokens: options.maxTokens ?? config.maxTokens,
                context_messages: contextMessages,
                stream: true,
                ...options,
              },
              streamOptions
            )

            // 保存流管理器
            set({
              streamManagers: {
                ...get().streamManagers,
                [sessionId]: {
                  messageId: placeholderMessageId,
                  sessionId,
                  manager,
                  status: StreamStatus.STREAMING,
                  accumulated: '',
                  startTime,
                },
              },
            })
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error))
            set({ error: err, isSending: false })

            // 移除占位消息
            get().deleteMessage(sessionId, placeholderMessageId)

            // 添加错误消息
            get().addMessage(sessionId, {
              role: MessageRole.SYSTEM,
              type: MessageType.ERROR,
              content: `发送失败: ${err.message}`,
              status: MessageStatus.FAILED,
              sessionId,
            })

            get().emitEvent({
              type: 'error',
              payload: { error: err, context: { sessionId, content } },
            })

            throw err
          }
        },

        stopStreaming: (sessionId) => {
          const sid = sessionId || get().currentSessionId
          if (!sid) return

          const manager = get().streamManagers[sid]
          if (manager) {
            manager.manager.abort()

            // 更新消息状态
            get().updateMessage(sid, manager.messageId, {
              status: MessageStatus.CANCELLED,
            })

            // 清理流管理器
            const newManagers = { ...get().streamManagers }
            delete newManagers[sid]
            set({ streamManagers: newManagers, isSending: false })
          }
        },

        resendMessage: async (sessionId, messageId) => {
          const message = get().getMessage(sessionId, messageId)
          if (!message || message.role !== MessageRole.USER) {
            throw new Error('只能重新发送用户消息')
          }

          const content = typeof message.content === 'string' ? message.content : message.content.text || ''
          await get().sendMessage(content, { sessionId })
        },

        editAndResend: async (sessionId, messageId, newContent) => {
          const message = get().getMessage(sessionId, messageId)
          if (!message || message.role !== MessageRole.USER) {
            throw new Error('只能编辑用户消息')
          }

          // 找到该消息的索引
          const messages = get().messageMap[sessionId] || []
          const index = messages.findIndex((m) => m.id === messageId)
          if (index === -1) return

          // 删除该消息及之后的所有消息
          const messagesToDelete = messages.slice(index).map((m) => m.id)
          get().batchDeleteMessages(sessionId, messagesToDelete)

          // 发送新消息
          await get().sendMessage(newContent, { sessionId })
        },

        regenerateResponse: async (sessionId, messageId) => {
          const messages = get().messageMap[sessionId] || []
          const index = messages.findIndex((m) => m.id === messageId)

          if (index === -1 || messages[index].role !== MessageRole.ASSISTANT) {
            throw new Error('只能重新生成助手消息')
          }

          // 删除助手消息
          get().deleteMessage(sessionId, messageId)

          // 找到上一条用户消息
          const previousMessages = messages.slice(0, index)
          const lastUserMessage = [...previousMessages]
            .reverse()
            .find((m) => m.role === MessageRole.USER)

          if (lastUserMessage) {
            const content =
              typeof lastUserMessage.content === 'string'
                ? lastUserMessage.content
                : lastUserMessage.content.text || ''
            await get().sendMessage(content, { sessionId })
          }
        },

        // ==================== 历史管理 ====================
        loadHistory: async (sessionId, limit = MESSAGE_LIMITS.DEFAULT_HISTORY_LIMIT) => {
          set({ isLoading: true, error: null })

          try {
            const response = await ChatService.getChatHistory(sessionId, limit)

            // 转换消息格式
            const messages: ChatMessage[] = response.messages.map((msg: any) => ({
              id: msg.id || generateMessageId(),
              sessionId,
              role: msg.role as MessageRole,
              type: MessageType.TEXT,
              content: msg.content,
              status: MessageStatus.RECEIVED,
              timestamp: msg.timestamp || Date.now(),
              metadata: {
                emotion: msg.emotion,
              },
            }))

            set((state) => ({
              messageMap: {
                ...state.messageMap,
                [sessionId]: messages,
              },
              sessions: state.sessions.map((s) =>
                s.id === sessionId
                  ? { ...s, messageCount: messages.length }
                  : s
              ),
              isLoading: false,
            }))

            get().updateSessionStats(sessionId)
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error))
            set({ error: err, isLoading: false })
            throw err
          }
        },

        clearHistory: async (sessionId) => {
          set({ isLoading: true, error: null })

          try {
            await ChatService.clearChatHistory(sessionId)
            get().clearSessionMessages(sessionId)
            set({ isLoading: false })
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error))
            set({ error: err, isLoading: false })
            throw err
          }
        },

        exportSession: (sessionId, format = 'json') => {
          const session = get().sessions.find((s) => s.id === sessionId)
          const messages = get().messageMap[sessionId] || []

          if (!session) {
            throw new Error(`会话不存在: ${sessionId}`)
          }

          if (format === 'json') {
            return JSON.stringify(
              {
                session: {
                  id: session.id,
                  title: session.title,
                  createdAt: session.createdAt,
                  exportedAt: Date.now(),
                },
                messages: messages.map((msg) => ({
                  role: msg.role,
                  content: typeof msg.content === 'string' ? msg.content : msg.content.text,
                  timestamp: msg.timestamp,
                  metadata: msg.metadata,
                })),
                stats: get().getSessionStats(sessionId),
              },
              null,
              2
            )
          } else if (format === 'markdown') {
            let markdown = `# ${session.title}\n\n`
            markdown += `创建时间: ${new Date(session.createdAt).toLocaleString()}\n\n`
            markdown += `---\n\n`

            for (const msg of messages) {
              const content = typeof msg.content === 'string' ? msg.content : msg.content.text || ''
              const role = msg.role === MessageRole.USER ? '**用户**' : '**助手**'
              markdown += `${role}: ${content}\n\n`
            }

            return markdown
          } else {
            // txt
            let text = `${session.title}\n`
            text += `创建时间: ${new Date(session.createdAt).toLocaleString()}\n`
            text += `\n${'='.repeat(50)}\n\n`

            for (const msg of messages) {
              const content = typeof msg.content === 'string' ? msg.content : msg.content.text || ''
              const role = msg.role === MessageRole.USER ? '用户' : '助手'
              text += `${role}: ${content}\n\n`
            }

            return text
          }
        },

        importSession: (data) => {
          try {
            const parsed = JSON.parse(data)
            const title = parsed.session?.title || '导入的对话'
            const sessionId = get().createSession(title)

            if (parsed.messages && Array.isArray(parsed.messages)) {
              for (const msg of parsed.messages) {
                get().addMessage(sessionId, {
                  role: msg.role || MessageRole.USER,
                  type: MessageType.TEXT,
                  content: msg.content || '',
                  status: MessageStatus.RECEIVED,
                  sessionId,
                  metadata: msg.metadata,
                })
              }
            }

            return sessionId
          } catch (error) {
            throw new Error('导入失败: 无效的数据格式')
          }
        },

        // ==================== 搜索功能 ====================
        searchMessages: (searchOptions) => {
          const messages = searchOptions.sessionId
            ? get().messageMap[searchOptions.sessionId] || []
            : Object.values(get().messageMap).flat()

          const results = searchInMessages(messages, searchOptions.keyword, searchOptions)

          // 应用限制和偏移
          const start = searchOptions.offset || 0
          const end = start + (searchOptions.limit || results.length)
          return results.slice(start, end)
        },

        globalSearch: (keyword, limit = 50) => {
          const allMessages = Object.values(get().messageMap).flat()
          const results = searchInMessages(allMessages, keyword)
          return results.slice(0, limit)
        },

        // ==================== 建议和模板 ====================
        getSuggestions: (_sessionId, count = 5) => {
          // 这里可以实现更复杂的建议生成逻辑
          // 目前返回存储的建议
          return get().suggestions.slice(0, count)
        },

        addSuggestion: (suggestion) => {
          const fullSuggestion: ChatSuggestion = {
            ...suggestion,
            id: nanoid(),
          }

          set((state) => ({
            suggestions: [...state.suggestions, fullSuggestion],
          }))
        },

        clearSuggestions: () => {
          set({ suggestions: [] })
        },

        createFromTemplate: (templateId) => {
          const template = get().templates.find((t) => t.id === templateId)
          if (!template) {
            throw new Error(`模板不存在: ${templateId}`)
          }

          const sessionId = get().createSession(template.name, template.type, template.suggestedConfig)

          // 添加初始消息
          if (template.initialMessages) {
            for (const msg of template.initialMessages) {
              get().addMessage(sessionId, {
                role: msg.role as MessageRole,
                type: MessageType.TEXT,
                content: msg.content,
                status: MessageStatus.RECEIVED,
                sessionId,
              })
            }
          }

          // 设置系统提示词
          if (template.systemPrompt) {
            get().updateSessionConfig(sessionId, { systemPrompt: template.systemPrompt })
          }

          return sessionId
        },

        addTemplate: (template) => {
          const fullTemplate: ChatTemplate = {
            ...template,
            id: nanoid(),
            createdAt: Date.now(),
          }

          set((state) => ({
            templates: [...state.templates, fullTemplate],
          }))

          return fullTemplate.id
        },

        deleteTemplate: (templateId) => {
          set((state) => ({
            templates: state.templates.filter((t) => t.id !== templateId),
          }))
        },

        // ==================== 统计功能 ====================
        updateSessionStats: (sessionId) => {
          const messages = get().messageMap[sessionId] || []
          const stats = calculateSessionStats(messages)

          set((state) => ({
            sessionStats: {
              ...state.sessionStats,
              [sessionId]: stats,
            },
          }))

          get().updateGlobalStats()
        },

        updateGlobalStats: () => {
          const state = get()
          const stats: GlobalChatStats = {
            totalSessions: state.sessions.length,
            activeSessions: state.sessions.filter((s) => s.status === SessionStatus.ACTIVE)
              .length,
            totalMessages: 0,
            totalTokens: 0,
            avgSessionLength: 0,
            avgMessageLength: 0,
            todayMessages: 0,
            todayTokens: 0,
            weekMessages: 0,
            weekTokens: 0,
          }

          const now = Date.now()
          const oneDayMs = 24 * 60 * 60 * 1000
          const oneWeekMs = 7 * oneDayMs

          let totalMessageLength = 0
          let messageCount = 0

          for (const session of state.sessions) {
            stats.totalMessages += session.messageCount
            stats.totalTokens += session.totalTokens

            const messages = state.messageMap[session.id] || []
            for (const msg of messages) {
              const content =
                typeof msg.content === 'string' ? msg.content : msg.content.text || ''
              totalMessageLength += content.length
              messageCount++

              if (msg.timestamp > now - oneDayMs) {
                stats.todayMessages++
                if (msg.metadata?.tokenUsage) {
                  stats.todayTokens += msg.metadata.tokenUsage.total
                }
              }

              if (msg.timestamp > now - oneWeekMs) {
                stats.weekMessages++
                if (msg.metadata?.tokenUsage) {
                  stats.weekTokens += msg.metadata.tokenUsage.total
                }
              }
            }
          }

          if (state.sessions.length > 0) {
            stats.avgSessionLength = stats.totalMessages / state.sessions.length
          }

          if (messageCount > 0) {
            stats.avgMessageLength = totalMessageLength / messageCount
          }

          // 找出最活跃的会话
          const sortedSessions = [...state.sessions].sort(
            (a, b) => b.messageCount - a.messageCount
          )
          if (sortedSessions.length > 0) {
            const mostActive = sortedSessions[0]
            stats.mostActiveSession = {
              id: mostActive.id,
              title: mostActive.title,
              messageCount: mostActive.messageCount,
            }
          }

          set({ globalStats: stats })
        },

        getSessionStats: (sessionId) => {
          return get().sessionStats[sessionId] || null
        },

        // ==================== 事件系统 ====================
        addEventListener: (listener) => {
          set((state) => ({
            eventListeners: [...state.eventListeners, listener],
          }))

          // 返回取消订阅函数
          return () => {
            get().removeEventListener(listener)
          }
        },

        removeEventListener: (listener) => {
          set((state) => ({
            eventListeners: state.eventListeners.filter((l) => l !== listener),
          }))
        },

        emitEvent: (event) => {
          const listeners = get().eventListeners
          for (const listener of listeners) {
            try {
              listener(event)
            } catch (error) {
              console.error('事件监听器执行失败:', error)
            }
          }
        },

        // ==================== 配置管理 ====================
        updateGlobalConfig: (config) => {
          set((state) => ({
            globalConfig: {
              ...state.globalConfig,
              ...config,
            },
          }))
        },

        updateSessionConfig: (sessionId, config) => {
          const session = get().sessions.find((s) => s.id === sessionId)
          if (session) {
            get().updateSession(sessionId, {
              config: {
                ...session.config,
                ...config,
              },
            })
          }
        },

        resetConfig: (sessionId) => {
          if (sessionId) {
            get().updateSessionConfig(sessionId, { ...DEFAULT_SESSION_CONFIG })
          } else {
            set({ globalConfig: { ...DEFAULT_SESSION_CONFIG } })
          }
        },

        // ==================== 工具方法 ====================
        clearError: () => {
          set({ error: null })
        },

        reset: () => {
          // 停止所有流式传输
          const managers = Object.values(get().streamManagers)
          for (const manager of managers) {
            manager.manager.abort()
          }

          set({
            sessions: [],
            currentSessionId: null,
            messageMap: {},
            isLoading: false,
            isSending: false,
            streamManagers: {},
            error: null,
            globalConfig: { ...DEFAULT_SESSION_CONFIG },
            templates: [],
            suggestions: [],
            eventListeners: [],
            sessionStats: {},
            globalStats: createDefaultGlobalStats(),
          })
        },

        cleanup: (daysToKeep = 30) => {
          const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
          const state = get()
          let cleanedCount = 0

          // 清理旧的归档会话
          const sessionsToDelete = state.sessions
            .filter(
              (s) =>
                s.status === SessionStatus.ARCHIVED && s.lastActivityAt < cutoffTime
            )
            .map((s) => s.id)

          for (const sessionId of sessionsToDelete) {
            get().deleteSession(sessionId)
            cleanedCount++
          }

          return cleanedCount
        },
      })),
      {
        name: 'chat-store',
        // 只持久化必要的数据
        partialize: (state) => ({
          sessions: state.sessions,
          currentSessionId: state.currentSessionId,
          messageMap: state.messageMap,
          globalConfig: state.globalConfig,
          templates: state.templates,
          sessionStats: state.sessionStats,
          globalStats: state.globalStats,
        }),
      }
    ),
    {
      name: 'ChatStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
)

// ==================== 导出辅助 Hooks ====================

/**
 * 获取当前会话的 Hook
 */
export const useCurrentSession = () => {
  return useChatStore((state) => ({
    session: state.getCurrentSession(),
    messages: state.getCurrentMessages(),
    stats: state.getCurrentStats(),
    isStreaming: state.isStreaming(),
  }))
}

/**
 * 获取会话列表的 Hook
 */
export const useSessionList = () => {
  return useChatStore((state) => ({
    sessions: state.sessions,
    activeSessions: state.getActiveSessions(),
    pinnedSessions: state.getPinnedSessions(),
    starredSessions: state.getStarredSessions(),
  }))
}

/**
 * 获取会话操作方法的 Hook
 */
export const useSessionActions = () => {
  return useChatStore((state) => ({
    createSession: state.createSession,
    updateSession: state.updateSession,
    deleteSession: state.deleteSession,
    archiveSession: state.archiveSession,
    switchSession: state.switchSession,
    cloneSession: state.cloneSession,
    renameSession: state.renameSession,
    togglePinSession: state.togglePinSession,
    toggleStarSession: state.toggleStarSession,
  }))
}

/**
 * 获取消息操作方法的 Hook
 */
export const useMessageActions = () => {
  return useChatStore((state) => ({
    addMessage: state.addMessage,
    updateMessage: state.updateMessage,
    deleteMessage: state.deleteMessage,
    sendMessage: state.sendMessage,
    sendStreamMessage: state.sendStreamMessage,
    stopStreaming: state.stopStreaming,
    resendMessage: state.resendMessage,
    editAndResend: state.editAndResend,
    regenerateResponse: state.regenerateResponse,
  }))
}

/**
 * 获取聊天状态的 Hook
 */
export const useChatStatus = () => {
  return useChatStore((state) => ({
    isLoading: state.isLoading,
    isSending: state.isSending,
    error: state.error,
    clearError: state.clearError,
  }))
}

/**
 * 获取统计信息的 Hook
 */
export const useChatStats = () => {
  return useChatStore((state) => ({
    globalStats: state.globalStats,
    sessionStats: state.sessionStats,
    getCurrentStats: state.getCurrentStats,
  }))
}

/**
 * 获取搜索功能的 Hook
 */
export const useChatSearch = () => {
  return useChatStore((state) => ({
    searchMessages: state.searchMessages,
    globalSearch: state.globalSearch,
  }))
}

/**
 * 获取模板功能的 Hook
 */
export const useChatTemplates = () => {
  return useChatStore((state) => ({
    templates: state.templates,
    createFromTemplate: state.createFromTemplate,
    addTemplate: state.addTemplate,
    deleteTemplate: state.deleteTemplate,
  }))
}

export default useChatStore

