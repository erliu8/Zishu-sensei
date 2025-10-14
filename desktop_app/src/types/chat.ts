/**
 * 对话系统类型定义
 * 
 * 定义所有对话相关的类型、接口和枚举，包括：
 * - 消息类型和结构
 * - 会话管理
 * - 流式响应
 * - 对话历史
 * - 统计信息
 */

// ==================== 基础枚举 ====================

/**
 * 消息角色类型
 */
export enum MessageRole {
  /** 用户消息 */
  USER = 'user',
  /** AI助手消息 */
  ASSISTANT = 'assistant',
  /** 系统消息 */
  SYSTEM = 'system',
  /** 函数调用消息 */
  FUNCTION = 'function',
  /** 工具调用消息 */
  TOOL = 'tool',
}

/**
 * 消息状态
 */
export enum MessageStatus {
  /** 待发送 */
  PENDING = 'pending',
  /** 发送中 */
  SENDING = 'sending',
  /** 已发送 */
  SENT = 'sent',
  /** 接收中（流式） */
  RECEIVING = 'receiving',
  /** 已接收 */
  RECEIVED = 'received',
  /** 失败 */
  FAILED = 'failed',
  /** 已取消 */
  CANCELLED = 'cancelled',
  /** 已编辑 */
  EDITED = 'edited',
  /** 已删除 */
  DELETED = 'deleted',
}

/**
 * 消息类型
 */
export enum MessageType {
  /** 普通文本 */
  TEXT = 'text',
  /** Markdown 格式 */
  MARKDOWN = 'markdown',
  /** 代码块 */
  CODE = 'code',
  /** 图片 */
  IMAGE = 'image',
  /** 文件 */
  FILE = 'file',
  /** 语音 */
  AUDIO = 'audio',
  /** 视频 */
  VIDEO = 'video',
  /** 链接 */
  LINK = 'link',
  /** 表情 */
  EMOJI = 'emoji',
  /** 错误消息 */
  ERROR = 'error',
  /** 系统通知 */
  NOTIFICATION = 'notification',
}

/**
 * 会话状态
 */
export enum SessionStatus {
  /** 活跃 */
  ACTIVE = 'active',
  /** 暂停 */
  PAUSED = 'paused',
  /** 已归档 */
  ARCHIVED = 'archived',
  /** 已删除 */
  DELETED = 'deleted',
}

/**
 * 会话类型
 */
export enum SessionType {
  /** 普通对话 */
  CHAT = 'chat',
  /** 角色扮演 */
  ROLEPLAY = 'roleplay',
  /** 学习辅导 */
  TUTORING = 'tutoring',
  /** 创意写作 */
  CREATIVE = 'creative',
  /** 代码助手 */
  CODING = 'coding',
  /** 翻译 */
  TRANSLATION = 'translation',
  /** 自定义 */
  CUSTOM = 'custom',
}

/**
 * 流式响应状态
 */
export enum StreamStatus {
  /** 未开始 */
  IDLE = 'idle',
  /** 连接中 */
  CONNECTING = 'connecting',
  /** 流式传输中 */
  STREAMING = 'streaming',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 已中断 */
  ABORTED = 'aborted',
  /** 错误 */
  ERROR = 'error',
}

/**
 * 消息完成原因
 */
export enum FinishReason {
  /** 正常完成 */
  STOP = 'stop',
  /** 达到长度限制 */
  LENGTH = 'length',
  /** 内容过滤 */
  CONTENT_FILTER = 'content_filter',
  /** 函数调用 */
  FUNCTION_CALL = 'function_call',
  /** 工具调用 */
  TOOL_CALLS = 'tool_calls',
  /** 用户取消 */
  USER_CANCEL = 'user_cancel',
  /** 错误 */
  ERROR = 'error',
}

// ==================== 核心类型 ====================

/**
 * 消息内容
 */
export interface MessageContent {
  /** 文本内容 */
  text?: string
  /** 图片 URL */
  imageUrl?: string
  /** 文件信息 */
  file?: {
    name: string
    url: string
    size: number
    mimeType: string
  }
  /** 代码内容 */
  code?: {
    language: string
    content: string
  }
  /** 自定义数据 */
  custom?: Record<string, any>
}

/**
 * 消息元数据
 */
export interface MessageMetadata {
  /** 处理时间（毫秒） */
  processingTime?: number
  /** Token 使用情况 */
  tokenUsage?: {
    prompt: number
    completion: number
    total: number
  }
  /** 模型信息 */
  model?: string
  /** 完成原因 */
  finishReason?: FinishReason
  /** 情绪分析 */
  emotion?: string
  /** 意图识别 */
  intent?: string
  /** 置信度 (0-1) */
  confidence?: number
  /** 标签 */
  tags?: string[]
  /** 引用的消息 ID */
  replyTo?: string
  /** 是否被编辑 */
  edited?: boolean
  /** 编辑时间 */
  editedAt?: number
  /** 是否被删除 */
  deleted?: boolean
  /** 删除时间 */
  deletedAt?: number
  /** 错误信息 */
  error?: {
    code: string
    message: string
    details?: any
  }
  /** 自定义元数据 */
  custom?: Record<string, any>
}

/**
 * 对话消息
 */
export interface ChatMessage {
  /** 消息 ID */
  id: string
  /** 会话 ID */
  sessionId: string
  /** 角色 */
  role: MessageRole
  /** 消息类型 */
  type: MessageType
  /** 消息内容 */
  content: string | MessageContent
  /** 消息状态 */
  status: MessageStatus
  /** 时间戳 */
  timestamp: number
  /** 元数据 */
  metadata?: MessageMetadata
  /** 附件列表 */
  attachments?: Array<{
    id: string
    name: string
    url: string
    size: number
    mimeType: string
  }>
  /** 是否置顶 */
  pinned?: boolean
  /** 是否收藏 */
  starred?: boolean
}

/**
 * 简化消息格式（用于 API 请求）
 */
export interface SimpleMessage {
  role: MessageRole | string
  content: string
  name?: string
}

/**
 * 会话配置
 */
export interface SessionConfig {
  /** 模型 ID */
  modelId?: string
  /** 适配器 ID */
  adapterId?: string
  /** 角色 ID */
  characterId?: string
  /** 温度参数 (0-2) */
  temperature?: number
  /** Top P 参数 (0-1) */
  topP?: number
  /** Top K 参数 */
  topK?: number
  /** 最大 tokens */
  maxTokens?: number
  /** 频率惩罚 (-2 to 2) */
  frequencyPenalty?: number
  /** 存在惩罚 (-2 to 2) */
  presencePenalty?: number
  /** 停止序列 */
  stopSequences?: string[]
  /** 是否启用流式响应 */
  enableStreaming?: boolean
  /** 最大上下文消息数 */
  maxContextMessages?: number
  /** 系统提示词 */
  systemPrompt?: string
  /** 自定义配置 */
  customConfig?: Record<string, any>
}

/**
 * 对话会话
 */
export interface ChatSession {
  /** 会话 ID */
  id: string
  /** 会话标题 */
  title: string
  /** 会话类型 */
  type: SessionType
  /** 会话状态 */
  status: SessionStatus
  /** 消息列表 */
  messages: ChatMessage[]
  /** 会话配置 */
  config: SessionConfig
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 最后活动时间 */
  lastActivityAt: number
  /** 消息总数 */
  messageCount: number
  /** 总 Token 使用量 */
  totalTokens: number
  /** 标签 */
  tags?: string[]
  /** 是否置顶 */
  pinned?: boolean
  /** 是否收藏 */
  starred?: boolean
  /** 自定义数据 */
  customData?: Record<string, any>
}

/**
 * 流式响应数据块
 */
export interface StreamChunk {
  /** 增量内容 */
  delta?: string
  /** 累积内容 */
  accumulated?: string
  /** 完成标志 */
  done?: boolean
  /** 元数据 */
  metadata?: {
    model?: string
    finishReason?: FinishReason
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
  /** 错误信息 */
  error?: {
    code: string
    message: string
  }
}

/**
 * 流式响应选项
 */
export interface StreamOptions {
  /** 数据块回调 */
  onChunk?: (chunk: StreamChunk) => void
  /** 开始回调 */
  onStart?: () => void
  /** 完成回调 */
  onComplete?: (result: ChatResponse) => void
  /** 错误回调 */
  onError?: (error: Error) => void
  /** 取消信号 */
  signal?: AbortSignal
}

/**
 * 聊天请求
 */
export interface ChatRequest {
  /** 消息内容 */
  message: string
  /** 会话 ID */
  sessionId?: string
  /** 模型 ID */
  model?: string
  /** 适配器 ID */
  adapter?: string
  /** 角色 ID */
  characterId?: string
  /** 温度 */
  temperature?: number
  /** Top P */
  topP?: number
  /** 最大 tokens */
  maxTokens?: number
  /** 是否流式响应 */
  stream?: boolean
  /** 上下文消息 */
  contextMessages?: SimpleMessage[]
  /** 系统提示词 */
  systemPrompt?: string
  /** 自定义参数 */
  customParams?: Record<string, any>
}

/**
 * 聊天响应
 */
export interface ChatResponse {
  /** 消息 ID */
  messageId: string
  /** 会话 ID */
  sessionId: string
  /** 响应内容 */
  message: string
  /** 模型信息 */
  model: string
  /** 处理时间 */
  processingTime?: number
  /** Token 使用情况 */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** 完成原因 */
  finishReason?: FinishReason | string
  /** 情绪信息 */
  emotion?: string
  /** 元数据 */
  metadata?: Record<string, any>
}

/**
 * 历史记录查询参数
 */
export interface HistoryQueryParams {
  /** 会话 ID */
  sessionId: string
  /** 限制数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
  /** 开始时间 */
  startTime?: number
  /** 结束时间 */
  endTime?: number
  /** 消息角色过滤 */
  roles?: MessageRole[]
  /** 消息状态过滤 */
  statuses?: MessageStatus[]
  /** 搜索关键词 */
  keyword?: string
}

/**
 * 历史记录响应
 */
export interface ChatHistoryResponse {
  /** 会话 ID */
  sessionId: string
  /** 消息列表 */
  messages: ChatMessage[]
  /** 总数量 */
  totalCount: number
  /** 是否有更多 */
  hasMore: boolean
}

/**
 * 会话统计信息
 */
export interface SessionStats {
  /** 消息总数 */
  totalMessages: number
  /** 用户消息数 */
  userMessages: number
  /** 助手消息数 */
  assistantMessages: number
  /** 系统消息数 */
  systemMessages: number
  /** 总 Token 使用量 */
  totalTokens: number
  /** 平均响应时间 */
  avgResponseTime: number
  /** 最快响应时间 */
  minResponseTime: number
  /** 最慢响应时间 */
  maxResponseTime: number
  /** 会话时长（秒） */
  sessionDuration: number
  /** 第一条消息时间 */
  firstMessageAt?: number
  /** 最后一条消息时间 */
  lastMessageAt?: number
  /** 情绪分布 */
  emotionDistribution?: Record<string, number>
  /** 意图分布 */
  intentDistribution?: Record<string, number>
}

/**
 * 全局聊天统计
 */
export interface GlobalChatStats {
  /** 总会话数 */
  totalSessions: number
  /** 活跃会话数 */
  activeSessions: number
  /** 总消息数 */
  totalMessages: number
  /** 总 Token 使用量 */
  totalTokens: number
  /** 平均会话长度 */
  avgSessionLength: number
  /** 平均消息长度 */
  avgMessageLength: number
  /** 今日消息数 */
  todayMessages: number
  /** 今日 Token 使用量 */
  todayTokens: number
  /** 本周消息数 */
  weekMessages: number
  /** 本周 Token 使用量 */
  weekTokens: number
  /** 最活跃的会话 */
  mostActiveSession?: {
    id: string
    title: string
    messageCount: number
  }
  /** 使用最多的模型 */
  mostUsedModel?: string
  /** 最常见的情绪 */
  commonEmotions?: Array<{
    emotion: string
    count: number
    percentage: number
  }>
}

/**
 * 消息导出格式
 */
export interface MessageExport {
  /** 导出格式 */
  format: 'json' | 'markdown' | 'txt' | 'csv' | 'html'
  /** 会话信息 */
  session: {
    id: string
    title: string
    createdAt: number
    exportedAt: number
  }
  /** 消息列表 */
  messages: Array<{
    role: string
    content: string
    timestamp: number
    metadata?: Record<string, any>
  }>
  /** 统计信息 */
  stats?: SessionStats
}

/**
 * 消息搜索选项
 */
export interface MessageSearchOptions {
  /** 搜索关键词 */
  keyword: string
  /** 会话 ID（可选） */
  sessionId?: string
  /** 角色过滤 */
  roles?: MessageRole[]
  /** 消息类型过滤 */
  types?: MessageType[]
  /** 开始时间 */
  startTime?: number
  /** 结束时间 */
  endTime?: number
  /** 是否区分大小写 */
  caseSensitive?: boolean
  /** 是否使用正则表达式 */
  useRegex?: boolean
  /** 限制数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

/**
 * 消息搜索结果
 */
export interface MessageSearchResult {
  /** 消息 */
  message: ChatMessage
  /** 匹配的文本片段 */
  matchedText?: string
  /** 匹配位置 */
  matchPosition?: {
    start: number
    end: number
  }
  /** 匹配分数 */
  score?: number
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  /** 成功数量 */
  successCount: number
  /** 失败数量 */
  failureCount: number
  /** 总数量 */
  totalCount: number
  /** 成功的 ID 列表 */
  successIds: string[]
  /** 失败的 ID 列表 */
  failureIds: string[]
  /** 错误信息 */
  errors?: Array<{
    id: string
    error: string
  }>
}

/**
 * 对话上下文
 */
export interface ChatContext {
  /** 当前会话 ID */
  sessionId: string
  /** 上下文消息 */
  messages: SimpleMessage[]
  /** 系统提示词 */
  systemPrompt?: string
  /** 角色信息 */
  character?: {
    id: string
    name: string
    personality: string
  }
  /** 用户信息 */
  user?: {
    name?: string
    preferences?: Record<string, any>
  }
  /** 额外上下文 */
  additionalContext?: Record<string, any>
}

/**
 * 对话建议
 */
export interface ChatSuggestion {
  /** 建议 ID */
  id: string
  /** 建议文本 */
  text: string
  /** 建议类型 */
  type: 'question' | 'command' | 'topic' | 'continuation'
  /** 置信度 (0-1) */
  confidence?: number
  /** 图标 */
  icon?: string
  /** 元数据 */
  metadata?: Record<string, any>
}

/**
 * 对话模板
 */
export interface ChatTemplate {
  /** 模板 ID */
  id: string
  /** 模板名称 */
  name: string
  /** 模板描述 */
  description: string
  /** 模板类型 */
  type: SessionType
  /** 系统提示词 */
  systemPrompt: string
  /** 初始消息 */
  initialMessages?: SimpleMessage[]
  /** 建议配置 */
  suggestedConfig?: Partial<SessionConfig>
  /** 标签 */
  tags?: string[]
  /** 是否内置 */
  isBuiltIn?: boolean
  /** 创建时间 */
  createdAt: number
}

/**
 * 对话事件
 */
export type ChatEvent =
  | {
      type: 'message:sent'
      payload: { sessionId: string; message: ChatMessage }
    }
  | {
      type: 'message:received'
      payload: { sessionId: string; message: ChatMessage }
    }
  | {
      type: 'message:updated'
      payload: { sessionId: string; messageId: string; updates: Partial<ChatMessage> }
    }
  | {
      type: 'message:deleted'
      payload: { sessionId: string; messageId: string }
    }
  | {
      type: 'session:created'
      payload: { session: ChatSession }
    }
  | {
      type: 'session:updated'
      payload: { sessionId: string; updates: Partial<ChatSession> }
    }
  | {
      type: 'session:deleted'
      payload: { sessionId: string }
    }
  | {
      type: 'stream:start'
      payload: { sessionId: string; messageId: string }
    }
  | {
      type: 'stream:chunk'
      payload: { sessionId: string; messageId: string; chunk: StreamChunk }
    }
  | {
      type: 'stream:complete'
      payload: { sessionId: string; messageId: string }
    }
  | {
      type: 'stream:error'
      payload: { sessionId: string; messageId: string; error: Error }
    }
  | {
      type: 'error'
      payload: { error: Error; context?: any }
    }

/**
 * 对话事件监听器
 */
export type ChatEventListener = (event: ChatEvent) => void

// ==================== 工具类型 ====================

/**
 * 分页参数
 */
export interface PaginationParams {
  /** 页码（从 1 开始） */
  page: number
  /** 每页数量 */
  pageSize: number
  /** 排序字段 */
  sortBy?: string
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  data: T[]
  /** 当前页码 */
  page: number
  /** 每页数量 */
  pageSize: number
  /** 总数量 */
  total: number
  /** 总页数 */
  totalPages: number
  /** 是否有下一页 */
  hasNext: boolean
  /** 是否有上一页 */
  hasPrev: boolean
}

/**
 * API 错误类型
 */
export interface ApiError {
  /** 错误码 */
  code: string
  /** 错误消息 */
  message: string
  /** 详细信息 */
  details?: any
  /** 时间戳 */
  timestamp: number
  /** 请求 ID */
  requestId?: string
  /** 堆栈信息（开发模式） */
  stack?: string
}

/**
 * 操作结果
 */
export interface OperationResult<T = any> {
  /** 是否成功 */
  success: boolean
  /** 结果数据 */
  data?: T
  /** 错误信息 */
  error?: ApiError
  /** 消息 */
  message?: string
}

// ==================== 类型守卫 ====================

/**
 * 检查是否为有效的消息
 */
export function isValidMessage(message: any): message is ChatMessage {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.id === 'string' &&
    typeof message.sessionId === 'string' &&
    typeof message.role === 'string' &&
    typeof message.content !== 'undefined' &&
    typeof message.timestamp === 'number'
  )
}

/**
 * 检查是否为有效的会话
 */
export function isValidSession(session: any): session is ChatSession {
  return (
    session &&
    typeof session === 'object' &&
    typeof session.id === 'string' &&
    typeof session.title === 'string' &&
    Array.isArray(session.messages) &&
    typeof session.createdAt === 'number'
  )
}

/**
 * 检查是否为流式响应块
 */
export function isStreamChunk(chunk: any): chunk is StreamChunk {
  return chunk && typeof chunk === 'object'
}

// ==================== 常量 ====================

/**
 * 默认会话配置
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  temperature: 0.7,
  topP: 1.0,
  maxTokens: 2048,
  enableStreaming: false,
  maxContextMessages: 10,
  frequencyPenalty: 0,
  presencePenalty: 0,
}

/**
 * 消息限制
 */
export const MESSAGE_LIMITS = {
  /** 最大消息长度 */
  MAX_MESSAGE_LENGTH: 10000,
  /** 最小消息长度 */
  MIN_MESSAGE_LENGTH: 1,
  /** 最大上下文消息数 */
  MAX_CONTEXT_MESSAGES: 50,
  /** 历史记录默认限制 */
  DEFAULT_HISTORY_LIMIT: 50,
  /** 历史记录最大限制 */
  MAX_HISTORY_LIMIT: 1000,
} as const

/**
 * 会话限制
 */
export const SESSION_LIMITS = {
  /** 最大会话标题长度 */
  MAX_TITLE_LENGTH: 100,
  /** 最小会话标题长度 */
  MIN_TITLE_LENGTH: 1,
  /** 最大会话数量 */
  MAX_SESSIONS: 100,
  /** 最大消息数量（单个会话） */
  MAX_MESSAGES_PER_SESSION: 10000,
} as const

/**
 * 超时配置
 */
export const TIMEOUT_CONFIG = {
  /** 默认请求超时（毫秒） */
  DEFAULT_TIMEOUT: 30000,
  /** 流式请求超时（毫秒） */
  STREAM_TIMEOUT: 60000,
  /** 历史加载超时（毫秒） */
  HISTORY_TIMEOUT: 10000,
} as const

