/**
 * 对话 API 服务
 * 
 * 提供对话管理相关的 API 接口，包括：
 * - 对话 CRUD
 * - 消息管理
 * - 对话搜索
 * - 对话分享
 * - 对话导出
 */

import type { ApiClient, ApiResponse } from '../api'

// ================================
// 类型定义
// ================================

/**
 * 对话
 */
export interface Conversation {
  id: string
  title: string
  summary?: string
  model: string
  createdAt: number
  updatedAt: number
  messageCount: number
  characterCount: number
  isFavorite: boolean
  isPinned: boolean
  tags: string[]
  metadata?: Record<string, any>
}

/**
 * 消息
 */
export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: MessageAttachment[]
  metadata?: Record<string, any>
  createdAt: number
  updatedAt?: number
  edited: boolean
  deleted: boolean
}

/**
 * 消息附件
 */
export interface MessageAttachment {
  id: string
  type: 'image' | 'file' | 'audio' | 'video'
  name: string
  url: string
  size: number
  mimeType: string
}

/**
 * 创建对话参数
 */
export interface CreateConversationParams {
  title?: string
  model: string
  initialMessage?: string
  tags?: string[]
  metadata?: Record<string, any>
}

/**
 * 更新对话参数
 */
export interface UpdateConversationParams {
  title?: string
  summary?: string
  isFavorite?: boolean
  isPinned?: boolean
  tags?: string[]
  metadata?: Record<string, any>
}

/**
 * 发送消息参数
 */
export interface SendMessageParams {
  content: string
  attachments?: File[]
  metadata?: Record<string, any>
}

/**
 * 搜索对话参数
 */
export interface SearchConversationsParams {
  query?: string
  tags?: string[]
  model?: string
  isFavorite?: boolean
  isPinned?: boolean
  dateFrom?: number
  dateTo?: number
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'messageCount'
  sortOrder?: 'asc' | 'desc'
}

/**
 * 搜索消息参数
 */
export interface SearchMessagesParams {
  query: string
  conversationId?: string
  role?: 'user' | 'assistant' | 'system'
  dateFrom?: number
  dateTo?: number
  limit?: number
  offset?: number
}

/**
 * 对话分享设置
 */
export interface ConversationShareSettings {
  expiresIn?: number
  password?: string
  allowComments?: boolean
  allowDownload?: boolean
}

/**
 * 对话分享信息
 */
export interface ConversationShare {
  id: string
  conversationId: string
  shareUrl: string
  shortCode: string
  expiresAt?: number
  password?: string
  viewCount: number
  createdAt: number
}

/**
 * 对话导出格式
 */
export type ConversationExportFormat = 'json' | 'markdown' | 'html' | 'pdf' | 'txt'

// ================================
// 对话 API 服务类
// ================================

export class ConversationApiService {
  constructor(private apiClient: ApiClient) {}

  // ================================
  // 对话 CRUD
  // ================================

  /**
   * 获取对话列表
   */
  async getConversations(params?: {
    limit?: number
    offset?: number
    sortBy?: 'createdAt' | 'updatedAt'
    sortOrder?: 'asc' | 'desc'
  }): Promise<ApiResponse<{
    conversations: Conversation[]
    total: number
    limit: number
    offset: number
  }>> {
    return this.apiClient.get('/conversations', {
      params,
      cache: true,
      cacheTTL: 60, // 1分钟
    })
  }

  /**
   * 获取对话详情
   */
  async getConversation(conversationId: string): Promise<ApiResponse<Conversation>> {
    return this.apiClient.get(`/conversations/${conversationId}`, {
      cache: true,
      cacheTTL: 300, // 5分钟
    })
  }

  /**
   * 创建对话
   */
  async createConversation(params: CreateConversationParams): Promise<ApiResponse<Conversation>> {
    const response = await this.apiClient.post<Conversation>('/conversations', params)

    if (response.success) {
      this.apiClient.clearCache('/conversations')
    }

    return response
  }

  /**
   * 更新对话
   */
  async updateConversation(
    conversationId: string,
    params: UpdateConversationParams
  ): Promise<ApiResponse<Conversation>> {
    const response = await this.apiClient.patch<Conversation>(
      `/conversations/${conversationId}`,
      params
    )

    if (response.success) {
      this.apiClient.clearCache(`/conversations/${conversationId}`)
      this.apiClient.clearCache('/conversations')
    }

    return response
  }

  /**
   * 删除对话
   */
  async deleteConversation(conversationId: string): Promise<ApiResponse<void>> {
    const response = await this.apiClient.delete<void>(`/conversations/${conversationId}`)

    if (response.success) {
      this.apiClient.clearCache(`/conversations/${conversationId}`)
      this.apiClient.clearCache('/conversations')
    }

    return response
  }

  /**
   * 批量删除对话
   */
  async deleteConversations(conversationIds: string[]): Promise<ApiResponse<{
    deleted: number
    failed: number
  }>> {
    const response = await this.apiClient.post<{ deleted: number; failed: number }>(
      '/conversations/batch-delete',
      { conversationIds }
    )

    if (response.success) {
      this.apiClient.clearCache('/conversations')
      conversationIds.forEach(id => {
        this.apiClient.clearCache(`/conversations/${id}`)
      })
    }

    return response
  }

  // ================================
  // 消息管理
  // ================================

  /**
   * 获取对话消息列表
   */
  async getMessages(
    conversationId: string,
    params?: {
      limit?: number
      offset?: number
      before?: string
      after?: string
    }
  ): Promise<ApiResponse<{
    messages: Message[]
    total: number
    hasMore: boolean
  }>> {
    return this.apiClient.get(`/conversations/${conversationId}/messages`, {
      params,
      cache: true,
      cacheTTL: 60,
    })
  }

  /**
   * 获取单条消息
   */
  async getMessage(conversationId: string, messageId: string): Promise<ApiResponse<Message>> {
    return this.apiClient.get(`/conversations/${conversationId}/messages/${messageId}`)
  }

  /**
   * 发送消息
   */
  async sendMessage(
    conversationId: string,
    params: SendMessageParams
  ): Promise<ApiResponse<Message>> {
    const formData = new FormData()
    formData.append('content', params.content)

    if (params.attachments && params.attachments.length > 0) {
      params.attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file)
      })
    }

    if (params.metadata) {
      formData.append('metadata', JSON.stringify(params.metadata))
    }

    const response = await this.apiClient.post<Message>(
      `/conversations/${conversationId}/messages`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progress) => {
          console.log(`Message upload progress: ${progress}%`)
        },
      }
    )

    if (response.success) {
      this.apiClient.clearCache(`/conversations/${conversationId}/messages`)
      this.apiClient.clearCache(`/conversations/${conversationId}`)
    }

    return response
  }

  /**
   * 更新消息
   */
  async updateMessage(
    conversationId: string,
    messageId: string,
    content: string
  ): Promise<ApiResponse<Message>> {
    const response = await this.apiClient.patch<Message>(
      `/conversations/${conversationId}/messages/${messageId}`,
      { content }
    )

    if (response.success) {
      this.apiClient.clearCache(`/conversations/${conversationId}/messages`)
    }

    return response
  }

  /**
   * 删除消息
   */
  async deleteMessage(conversationId: string, messageId: string): Promise<ApiResponse<void>> {
    const response = await this.apiClient.delete<void>(
      `/conversations/${conversationId}/messages/${messageId}`
    )

    if (response.success) {
      this.apiClient.clearCache(`/conversations/${conversationId}/messages`)
      this.apiClient.clearCache(`/conversations/${conversationId}`)
    }

    return response
  }

  // ================================
  // 搜索功能
  // ================================

  /**
   * 搜索对话
   */
  async searchConversations(
    params: SearchConversationsParams
  ): Promise<ApiResponse<{
    conversations: Conversation[]
    total: number
    limit: number
    offset: number
  }>> {
    return this.apiClient.get('/conversations/search', {
      params,
      cache: true,
      cacheTTL: 30, // 30秒
    })
  }

  /**
   * 搜索消息
   */
  async searchMessages(
    params: SearchMessagesParams
  ): Promise<ApiResponse<{
    messages: Message[]
    conversations: Record<string, Conversation>
    total: number
    limit: number
    offset: number
  }>> {
    return this.apiClient.get('/messages/search', {
      params,
      cache: true,
      cacheTTL: 30,
    })
  }

  // ================================
  // 对话操作
  // ================================

  /**
   * 收藏对话
   */
  async favoriteConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.updateConversation(conversationId, { isFavorite: true })
  }

  /**
   * 取消收藏对话
   */
  async unfavoriteConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.updateConversation(conversationId, { isFavorite: false })
  }

  /**
   * 置顶对话
   */
  async pinConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.updateConversation(conversationId, { isPinned: true })
  }

  /**
   * 取消置顶对话
   */
  async unpinConversation(conversationId: string): Promise<ApiResponse<void>> {
    return this.updateConversation(conversationId, { isPinned: false })
  }

  /**
   * 归档对话
   */
  async archiveConversation(conversationId: string): Promise<ApiResponse<void>> {
    const response = await this.apiClient.post<void>(`/conversations/${conversationId}/archive`)

    if (response.success) {
      this.apiClient.clearCache(`/conversations/${conversationId}`)
      this.apiClient.clearCache('/conversations')
    }

    return response
  }

  /**
   * 取消归档对话
   */
  async unarchiveConversation(conversationId: string): Promise<ApiResponse<void>> {
    const response = await this.apiClient.post<void>(`/conversations/${conversationId}/unarchive`)

    if (response.success) {
      this.apiClient.clearCache(`/conversations/${conversationId}`)
      this.apiClient.clearCache('/conversations')
    }

    return response
  }

  /**
   * 复制对话
   */
  async duplicateConversation(conversationId: string): Promise<ApiResponse<Conversation>> {
    const response = await this.apiClient.post<Conversation>(
      `/conversations/${conversationId}/duplicate`
    )

    if (response.success) {
      this.apiClient.clearCache('/conversations')
    }

    return response
  }

  // ================================
  // 对话分享
  // ================================

  /**
   * 创建对话分享
   */
  async shareConversation(
    conversationId: string,
    settings?: ConversationShareSettings
  ): Promise<ApiResponse<ConversationShare>> {
    return this.apiClient.post<ConversationShare>(
      `/conversations/${conversationId}/share`,
      settings
    )
  }

  /**
   * 获取对话分享信息
   */
  async getConversationShare(shareId: string): Promise<ApiResponse<ConversationShare>> {
    return this.apiClient.get<ConversationShare>(`/shares/${shareId}`)
  }

  /**
   * 获取对话的所有分享
   */
  async getConversationShares(conversationId: string): Promise<ApiResponse<ConversationShare[]>> {
    return this.apiClient.get<ConversationShare[]>(`/conversations/${conversationId}/shares`)
  }

  /**
   * 删除对话分享
   */
  async deleteConversationShare(shareId: string): Promise<ApiResponse<void>> {
    return this.apiClient.delete<void>(`/shares/${shareId}`)
  }

  /**
   * 通过分享码访问对话
   */
  async accessSharedConversation(
    shortCode: string,
    password?: string
  ): Promise<ApiResponse<{
    conversation: Conversation
    messages: Message[]
  }>> {
    return this.apiClient.post(`/shares/${shortCode}/access`, { password })
  }

  // ================================
  // 对话导出
  // ================================

  /**
   * 导出对话
   */
  async exportConversation(
    conversationId: string,
    format: ConversationExportFormat = 'json'
  ): Promise<ApiResponse<{
    downloadUrl: string
    filename: string
    size: number
  }>> {
    return this.apiClient.post(`/conversations/${conversationId}/export`, {
      format,
    })
  }

  /**
   * 批量导出对话
   */
  async exportConversations(
    conversationIds: string[],
    format: ConversationExportFormat = 'json'
  ): Promise<ApiResponse<{
    downloadUrl: string
    filename: string
    size: number
  }>> {
    return this.apiClient.post('/conversations/batch-export', {
      conversationIds,
      format,
    })
  }

  // ================================
  // 对话统计
  // ================================

  /**
   * 获取对话统计
   */
  async getConversationStats(conversationId: string): Promise<ApiResponse<{
    messageCount: number
    characterCount: number
    wordCount: number
    duration: number
    participants: string[]
    createdAt: number
    lastActivity: number
  }>> {
    return this.apiClient.get(`/conversations/${conversationId}/stats`)
  }

  /**
   * 获取用户对话统计
   */
  async getUserConversationStats(): Promise<ApiResponse<{
    totalConversations: number
    totalMessages: number
    totalCharacters: number
    favoriteCount: number
    archivedCount: number
    averageMessagesPerConversation: number
    mostUsedModels: Array<{ model: string; count: number }>
    activityByDate: Record<string, number>
  }>> {
    return this.apiClient.get('/conversations/stats', {
      cache: true,
      cacheTTL: 300,
    })
  }

  // ================================
  // 辅助方法
  // ================================

  /**
   * 清除所有对话相关缓存
   */
  clearAllCache(): void {
    this.apiClient.clearCache('/conversations')
    this.apiClient.clearCache('/messages')
  }
}

// ================================
// 导出
// ================================

/**
 * 创建对话 API 服务
 */
export function createConversationApiService(apiClient: ApiClient): ConversationApiService {
  return new ConversationApiService(apiClient)
}

/**
 * 导出类型
 */
export type {
  Conversation,
  Message,
  MessageAttachment,
  CreateConversationParams,
  UpdateConversationParams,
  SendMessageParams,
  SearchConversationsParams,
  SearchMessagesParams,
  ConversationShareSettings,
  ConversationShare,
  ConversationExportFormat,
}

