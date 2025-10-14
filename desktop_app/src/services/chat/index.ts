/**
 * 聊天服务模块
 * 封装与 Tauri 后端的聊天功能交互
 */

import { invoke } from '@tauri-apps/api/tauri';

// ================================
// 类型定义
// ================================

export interface SendMessageInput {
  message: string;
  session_id?: string;
  model?: string;
  adapter?: string;
  character_id?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  context_messages?: Array<{
    role: string;
    content: string;
  }>;
}

export interface ChatResponse {
  message: string;
  session_id: string;
  message_id: string;
  model: string;
  processing_time?: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason?: string;
}

export interface GetHistoryInput {
  session_id: string;
  limit?: number;
}

export interface HistoryMessage {
  role: string;
  content: string;
  timestamp?: number;
  emotion?: string;
}

export interface ChatHistoryResponse {
  session_id: string;
  messages: HistoryMessage[];
  total_count: number;
}

export interface ClearHistoryInput {
  session_id: string;
}

export interface ClearResponse {
  message: string;
  session_id: string;
}

export interface SetModelInput {
  model_id: string;
  adapter_id?: string;
  config?: Record<string, any>;
}

export interface SetModelResponse {
  success: boolean;
  model_id: string;
  adapter_id?: string;
}

// ================================
// 聊天服务类
// ================================

export class ChatService {
  /**
   * 发送聊天消息
   */
  static async sendMessage(input: SendMessageInput): Promise<ChatResponse> {
    try {
      const response = await invoke<{ success: boolean; data: ChatResponse; error?: string }>(
        'send_message',
        { input }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || '发送消息失败');
      }

      return response.data;
    } catch (error) {
      console.error('发送消息失败:', error);
      throw error;
    }
  }

  /**
   * 获取聊天历史
   */
  static async getChatHistory(
    sessionId: string,
    limit?: number
  ): Promise<ChatHistoryResponse> {
    try {
      const response = await invoke<{
        success: boolean;
        data: ChatHistoryResponse;
        error?: string;
      }>('get_chat_history', {
        input: { session_id: sessionId, limit },
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || '获取历史记录失败');
      }

      return response.data;
    } catch (error) {
      console.error('获取历史记录失败:', error);
      throw error;
    }
  }

  /**
   * 清空聊天历史
   */
  static async clearChatHistory(sessionId: string): Promise<ClearResponse> {
    try {
      const response = await invoke<{ success: boolean; data: ClearResponse; error?: string }>(
        'clear_chat_history',
        {
          input: { session_id: sessionId },
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || '清空历史记录失败');
      }

      return response.data;
    } catch (error) {
      console.error('清空历史记录失败:', error);
      throw error;
    }
  }

  /**
   * 设置聊天模型
   */
  static async setChatModel(input: SetModelInput): Promise<SetModelResponse> {
    try {
      const response = await invoke<{ success: boolean; data: SetModelResponse; error?: string }>(
        'set_chat_model',
        { input }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || '设置模型失败');
      }

      return response.data;
    } catch (error) {
      console.error('设置模型失败:', error);
      throw error;
    }
  }

  /**
   * 生成新的会话 ID
   */
  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ================================
// 便捷函数
// ================================

/**
 * 发送简单文本消息
 */
export async function sendSimpleMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  return ChatService.sendMessage({
    message,
    session_id: sessionId,
  });
}

/**
 * 发送带上下文的消息
 */
export async function sendMessageWithContext(
  message: string,
  contextMessages: Array<{ role: string; content: string }>,
  sessionId?: string
): Promise<ChatResponse> {
  return ChatService.sendMessage({
    message,
    session_id: sessionId,
    context_messages: contextMessages,
  });
}

/**
 * 获取最近的聊天历史
 */
export async function getRecentHistory(
  sessionId: string,
  limit: number = 50
): Promise<HistoryMessage[]> {
  const response = await ChatService.getChatHistory(sessionId, limit);
  return response.messages;
}

// 默认导出
export default ChatService;

