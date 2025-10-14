/**
 * 聊天 API 服务层
 * 提供底层的聊天 API 调用、流式响应、错误处理等功能
 * 
 * @module services/api/chat
 */

import { invoke } from '@tauri-apps/api/tauri';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ================================
// 类型定义
// ================================

/**
 * API 响应基础结构
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: number;
}

/**
 * 消息角色类型
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * 消息结构
 */
export interface ChatMessage {
  role: string;
  content: string;
  name?: string;
  timestamp?: number;
}

/**
 * 发送消息请求参数
 */
export interface SendChatMessageRequest {
  /** 消息内容 */
  message: string;
  /** 会话 ID */
  session_id?: string;
  /** 模型 ID */
  model?: string;
  /** 适配器 ID */
  adapter?: string;
  /** 角色 ID */
  character_id?: string;
  /** 最大生成 token 数 */
  max_tokens?: number;
  /** 温度参数 (0-2) */
  temperature?: number;
  /** 核采样参数 (0-1) */
  top_p?: number;
  /** 频率惩罚 (-2 to 2) */
  frequency_penalty?: number;
  /** 存在惩罚 (-2 to 2) */
  presence_penalty?: number;
  /** 是否流式响应 */
  stream?: boolean;
  /** 上下文消息列表 */
  context_messages?: Array<{ role: string; content: string }>;
  /** 停止序列 */
  stop_sequences?: string[];
  /** 额外的元数据 */
  metadata?: Record<string, any>;
}

/**
 * 聊天响应
 */
export interface ChatResponse {
  /** 回复内容 */
  message: string;
  /** 会话 ID */
  session_id: string;
  /** 消息 ID */
  message_id: string;
  /** 使用的模型 */
  model: string;
  /** 处理时间（毫秒） */
  processing_time?: number;
  /** Token 使用情况 */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** 完成原因 */
  finish_reason?: 'stop' | 'length' | 'content_filter' | 'function_call' | 'error';
  /** 角色 ID */
  character_id?: string;
  /** 情绪标签 */
  emotion?: string;
  /** 额外数据 */
  metadata?: Record<string, any>;
}

/**
 * 流式响应数据块
 */
export interface StreamChunk {
  /** 内容增量 */
  delta: string;
  /** 是否完成 */
  done: boolean;
  /** 消息 ID */
  message_id?: string;
  /** 会话 ID */
  session_id?: string;
  /** 完成原因 */
  finish_reason?: string;
  /** Token 使用情况（仅在完成时） */
  usage?: ChatResponse['usage'];
}

/**
 * 历史消息
 */
export interface HistoryMessage {
  role: MessageRole;
  content: string;
  timestamp?: number;
  emotion?: string;
  message_id?: string;
  metadata?: Record<string, any>;
}

/**
 * 获取历史记录响应
 */
export interface ChatHistoryResponse {
  session_id: string;
  messages: HistoryMessage[];
  total_count: number;
  has_more?: boolean;
}

/**
 * 模型配置
 */
export interface ModelConfig {
  model_id: string;
  adapter_id?: string;
  config?: {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    [key: string]: any;
  };
}

/**
 * 模型信息
 */
export interface ModelInfo {
  model_id: string;
  adapter_id?: string;
  display_name?: string;
  description?: string;
  max_tokens?: number;
  capabilities?: string[];
  is_active?: boolean;
}

/**
 * 错误信息
 */
export interface ChatError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

// ================================
// 流式响应处理
// ================================

/**
 * 流式响应回调函数
 */
export type StreamCallback = (chunk: StreamChunk) => void;

/**
 * 流式响应选项
 */
export interface StreamOptions {
  onChunk: StreamCallback;
  onComplete?: (response: ChatResponse) => void;
  onError?: (error: ChatError) => void;
  signal?: AbortSignal;
}

/**
 * 流式消息管理器
 */
export class StreamManager {
  private unlistenFn: UnlistenFn | null = null;
  private aborted = false;
  private buffer = '';

  /**
   * 开始监听流式响应
   */
  async start(sessionId: string, options: StreamOptions): Promise<void> {
    const { onChunk, onComplete, onError, signal } = options;

    // 处理取消信号
    if (signal) {
      signal.addEventListener('abort', () => {
        this.abort();
      });
    }

    try {
      // 监听流式事件
      this.unlistenFn = await listen<StreamChunk>(
        `chat_stream_${sessionId}`,
        (event) => {
          if (this.aborted) return;

          const chunk = event.payload;
          
          // 累积内容
          if (chunk.delta) {
            this.buffer += chunk.delta;
          }

          // 调用回调
          onChunk(chunk);

          // 如果完成，调用完成回调
          if (chunk.done && onComplete) {
            const response: ChatResponse = {
              message: this.buffer,
              session_id: chunk.session_id || sessionId,
              message_id: chunk.message_id || '',
              model: '',
              finish_reason: chunk.finish_reason as any,
              usage: chunk.usage,
            };
            onComplete(response);
          }
        }
      );
    } catch (error) {
      if (onError) {
        onError({
          code: 'STREAM_ERROR',
          message: error instanceof Error ? error.message : '流式响应错误',
          timestamp: Date.now(),
        });
      }
      throw error;
    }
  }

  /**
   * 停止监听
   */
  async stop(): Promise<void> {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    this.buffer = '';
  }

  /**
   * 中止流式响应
   */
  abort(): void {
    this.aborted = true;
    this.stop();
  }

  /**
   * 获取当前缓冲内容
   */
  getBuffer(): string {
    return this.buffer;
  }
}

// ================================
// 核心 API 函数
// ================================

/**
 * 发送聊天消息（普通模式）
 */
export async function sendChatMessage(
  request: SendChatMessageRequest
): Promise<ChatResponse> {
  try {
    const response = await invoke<ApiResponse<ChatResponse>>('send_message', {
      input: {
        ...request,
        stream: false, // 强制关闭流式
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || '发送消息失败');
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 发送聊天消息（流式模式）
 */
export async function sendChatMessageStream(
  request: SendChatMessageRequest,
  options: StreamOptions
): Promise<StreamManager> {
  const sessionId = request.session_id || generateSessionId();
  const manager = new StreamManager();

  try {
    // 先启动监听
    await manager.start(sessionId, options);

    // 然后发送请求
    const response = await invoke<ApiResponse<any>>('send_message', {
      input: {
        ...request,
        session_id: sessionId,
        stream: true,
      },
    });

    if (!response.success) {
      throw new Error(response.error || '发送流式消息失败');
    }

    return manager;
  } catch (error) {
    await manager.stop();
    throw normalizeError(error);
  }
}

/**
 * 获取聊天历史
 */
export async function getChatHistory(
  sessionId: string,
  limit?: number
): Promise<ChatHistoryResponse> {
  try {
    const response = await invoke<ApiResponse<ChatHistoryResponse>>('get_chat_history', {
      input: { session_id: sessionId, limit },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || '获取历史记录失败');
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 清空聊天历史
 */
export async function clearChatHistory(sessionId: string): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('clear_chat_history', {
      input: { session_id: sessionId },
    });

    if (!response.success) {
      throw new Error(response.error || '清空历史记录失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 删除指定消息
 */
export async function deleteMessage(
  sessionId: string,
  messageId: string
): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('delete_message', {
      input: { session_id: sessionId, message_id: messageId },
    });

    if (!response.success) {
      throw new Error(response.error || '删除消息失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 设置聊天模型
 */
export async function setChatModel(config: ModelConfig): Promise<void> {
  try {
    const response = await invoke<ApiResponse<any>>('set_chat_model', {
      input: config,
    });

    if (!response.success) {
      throw new Error(response.error || '设置模型失败');
    }
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取当前模型信息
 */
export async function getCurrentModel(): Promise<ModelInfo> {
  try {
    const response = await invoke<ApiResponse<ModelInfo>>('get_current_model');

    if (!response.success || !response.data) {
      throw new Error(response.error || '获取模型信息失败');
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 获取可用模型列表
 */
export async function getAvailableModels(): Promise<ModelInfo[]> {
  try {
    const response = await invoke<ApiResponse<ModelInfo[]>>('get_available_models');

    if (!response.success || !response.data) {
      throw new Error(response.error || '获取模型列表失败');
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 重新生成最后的回复
 */
export async function regenerateLastResponse(
  sessionId: string
): Promise<ChatResponse> {
  try {
    const response = await invoke<ApiResponse<ChatResponse>>('regenerate_response', {
      input: { session_id: sessionId },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || '重新生成失败');
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 编辑并重新发送消息
 */
export async function editAndResendMessage(
  sessionId: string,
  messageId: string,
  newContent: string
): Promise<ChatResponse> {
  try {
    const response = await invoke<ApiResponse<ChatResponse>>('edit_and_resend', {
      input: {
        session_id: sessionId,
        message_id: messageId,
        new_content: newContent,
      },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || '编辑并重发失败');
    }

    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

/**
 * 检查 API 健康状态
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await invoke<ApiResponse<{ healthy: boolean }>>('health_check');
    return response.success && response.data?.healthy === true;
  } catch (error) {
    return false;
  }
}

// ================================
// 辅助函数
// ================================

/**
 * 生成会话 ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 生成消息 ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 规范化错误对象
 */
export function normalizeError(error: unknown): ChatError {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return error as ChatError;
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    code: 'UNKNOWN_ERROR',
    message,
    timestamp: Date.now(),
  };
}

/**
 * 验证消息内容
 */
export function validateMessage(content: string): { valid: boolean; error?: string } {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: '消息内容不能为空' };
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: '消息内容不能为空' };
  }

  if (trimmed.length > 32000) {
    return { valid: false, error: '消息内容过长（最大 32000 字符）' };
  }

  return { valid: true };
}

/**
 * 估算 Token 数量（粗略估算）
 */
export function estimateTokens(text: string): number {
  // 中文字符通常 1-2 tokens，英文单词约 1.3 tokens
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars;

  return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.3);
}

/**
 * 截断历史消息以适应上下文长度
 */
export function truncateContextMessages(
  messages: ChatMessage[],
  maxTokens: number = 4000
): ChatMessage[] {
  let totalTokens = 0;
  const result: ChatMessage[] = [];

  // 从后向前累加
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(messages[i].content);
    if (totalTokens + tokens > maxTokens) {
      break;
    }
    totalTokens += tokens;
    result.unshift(messages[i]);
  }

  return result;
}

/**
 * 合并消息（将连续的同角色消息合并）
 */
export function mergeConsecutiveMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return [];

  const result: ChatMessage[] = [{ ...messages[0] }];

  for (let i = 1; i < messages.length; i++) {
    const current = messages[i];
    const last = result[result.length - 1];

    if (current.role === last.role) {
      // 合并到上一条消息
      last.content += '\n' + current.content;
    } else {
      result.push({ ...current });
    }
  }

  return result;
}

/**
 * 格式化消息时间戳
 */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ================================
// 批量操作
// ================================

/**
 * 批量发送消息选项
 */
export interface BatchSendOptions {
  /** 并发数量 */
  concurrency?: number;
  /** 失败时是否继续 */
  continueOnError?: boolean;
  /** 进度回调 */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * 批量发送消息结果
 */
export interface BatchSendResult {
  success: ChatResponse[];
  failed: Array<{ request: SendChatMessageRequest; error: ChatError }>;
}

/**
 * 批量发送消息
 */
export async function sendBatchMessages(
  requests: SendChatMessageRequest[],
  options: BatchSendOptions = {}
): Promise<BatchSendResult> {
  const { concurrency = 3, continueOnError = true, onProgress } = options;
  
  const success: ChatResponse[] = [];
  const failed: Array<{ request: SendChatMessageRequest; error: ChatError }> = [];
  
  let completed = 0;

  // 分批处理
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    
    const results = await Promise.allSettled(
      batch.map(request => sendChatMessage(request))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        success.push(result.value);
      } else {
        const error = normalizeError(result.reason);
        failed.push({ request: batch[index], error });
        
        if (!continueOnError) {
          throw error;
        }
      }

      completed++;
      onProgress?.(completed, requests.length);
    });
  }

  return { success, failed };
}

// ================================
// 导出
// ================================

export const ChatAPI = {
  // 基础操作
  sendMessage: sendChatMessage,
  sendMessageStream: sendChatMessageStream,
  getHistory: getChatHistory,
  clearHistory: clearChatHistory,
  deleteMessage,
  
  // 模型管理
  setModel: setChatModel,
  getCurrentModel,
  getAvailableModels,
  
  // 高级操作
  regenerate: regenerateLastResponse,
  editAndResend: editAndResendMessage,
  checkHealth: checkApiHealth,
  
  // 批量操作
  sendBatch: sendBatchMessages,
  
  // 工具函数
  generateSessionId,
  generateMessageId,
  validateMessage,
  estimateTokens,
  truncateContextMessages,
  mergeConsecutiveMessages,
  formatMessageTime,
  normalizeError,
};

export default ChatAPI;

