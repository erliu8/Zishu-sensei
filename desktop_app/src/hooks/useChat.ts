/**
 * 聊天功能 Hook
 * 提供完整的聊天功能，包括消息发送、历史管理、流式响应等
 * 
 * @module hooks/useChat
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ChatService, {
  type ChatResponse,
  type HistoryMessage,
  type SendMessageInput,
} from '../services/chat/index';
import {
  type StreamChunk,
  type StreamOptions,
  ChatAPI,
  StreamManager,
} from '../services/api/chat';

// ================================
// 类型定义
// ================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  emotion?: string;
  processing_time?: number;
}

export interface UseChatOptions {
  /** 会话 ID */
  sessionId?: string;
  /** 是否自动加载历史记录 */
  autoLoadHistory?: boolean;
  /** 默认模型 */
  defaultModel?: string;
  /** 默认角色 */
  defaultCharacter?: string;
  /** 最大上下文消息数 */
  maxContextMessages?: number;
  /** 是否启用流式响应 */
  enableStreaming?: boolean;
  /** 默认温度参数 */
  defaultTemperature?: number;
  /** 默认 top_p 参数 */
  defaultTopP?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 是否自动保存到历史 */
  autoSaveHistory?: boolean;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 消息发送成功回调 */
  onMessageSent?: (message: Message, response: ChatResponse) => void;
  /** 流式数据块回调 */
  onStreamChunk?: (chunk: string) => void;
  /** 流式响应开始回调 */
  onStreamStart?: () => void;
  /** 流式响应完成回调 */
  onStreamComplete?: () => void;
}

export interface UseChatReturn {
  /** 消息列表 */
  messages: Message[];
  /** 当前会话 ID */
  sessionId: string;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否正在发送消息 */
  isSending: boolean;
  /** 是否正在流式传输 */
  isStreaming: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 统计信息 */
  stats: {
    totalMessages: number;
    totalTokens: number;
    avgResponseTime: number;
  };
  /** 发送消息 */
  sendMessage: (content: string, options?: Partial<SendMessageInput>) => Promise<void>;
  /** 停止流式响应 */
  stopStreaming: () => void;
  /** 重新发送最后一条消息 */
  resendLastMessage: () => Promise<void>;
  /** 重新生成最后的回复 */
  regenerateLastResponse: () => Promise<void>;
  /** 清空聊天历史 */
  clearHistory: () => Promise<void>;
  /** 加载历史记录 */
  loadHistory: (limit?: number) => Promise<void>;
  /** 删除指定消息 */
  deleteMessage: (messageId: string) => void;
  /** 编辑消息 */
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  /** 更新会话 ID */
  setSessionId: (sessionId: string) => void;
  /** 设置模型 */
  setModel: (modelId: string, adapterId?: string) => Promise<void>;
  /** 添加系统消息 */
  addSystemMessage: (content: string) => void;
  /** 清除错误 */
  clearError: () => void;
  /** 导出对话历史 */
  exportHistory: () => Message[];
  /** 导入对话历史 */
  importHistory: (messages: Message[]) => void;
}

// ================================
// Hook 实现
// ================================

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    sessionId: initialSessionId,
    autoLoadHistory = false,
    defaultModel,
    defaultCharacter,
    maxContextMessages = 10,
    enableStreaming = false,
    defaultTemperature = 0.7,
    defaultTopP = 1.0,
    maxRetries = 3,
    onError,
    onMessageSent,
    onStreamChunk,
    onStreamStart,
    onStreamComplete,
  } = options;

  // 状态
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>(
    initialSessionId || ChatService.generateSessionId()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 统计数据
  const [totalTokens, setTotalTokens] = useState(0);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);

  // Refs
  const lastUserMessageRef = useRef<{
    content: string;
    options?: Partial<SendMessageInput>;
  } | null>(null);
  const streamManagerRef = useRef<StreamManager | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 生成消息 ID
  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 转换历史消息格式
  const convertHistoryMessage = (msg: HistoryMessage): Message => ({
    id: generateMessageId(),
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
    timestamp: msg.timestamp || Date.now(),
    emotion: msg.emotion,
  });

  // 加载历史记录
  const loadHistory = useCallback(
    async (limit?: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const history = await ChatService.getChatHistory(sessionId, limit);
        const convertedMessages = history.messages.map(convertHistoryMessage);
        setMessages(convertedMessages);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, onError]
  );

  // 发送消息
  const sendMessage = useCallback(
    async (content: string, options: Partial<SendMessageInput> = {}) => {
      // 验证消息
      const validation = ChatAPI.validateMessage(content);
      if (!validation.valid) {
        const error = new Error(validation.error);
        setError(error);
        onError?.(error);
        return;
      }

      setIsSending(true);
      setError(null);

      const startTime = Date.now();

      // 保存最后一条消息用于重发
      lastUserMessageRef.current = { content, options };

      // 创建用户消息
      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // 立即添加到界面
      setMessages((prev) => [...prev, userMessage]);

      try {
        // 准备上下文消息
        const contextMessages = messages
          .slice(-maxContextMessages)
          .map((msg) => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
          }));

        const useStreaming = options.stream ?? enableStreaming;

        if (useStreaming) {
          // 流式响应
          setIsStreaming(true);
          onStreamStart?.();

          // 创建占位消息
          const placeholderMessageId = generateMessageId();
          streamingMessageIdRef.current = placeholderMessageId;

          const placeholderMessage: Message = {
            id: placeholderMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, placeholderMessage]);

          // 创建取消控制器
          abortControllerRef.current = new AbortController();

          const streamOptions: StreamOptions = {
            onChunk: (chunk: StreamChunk) => {
              if (chunk.delta) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === placeholderMessageId
                      ? { ...msg, content: msg.content + chunk.delta }
                      : msg
                  )
                );
                onStreamChunk?.(chunk.delta);
              }
            },
            onComplete: (response) => {
              const endTime = Date.now();
              const processingTime = endTime - startTime;

              // 更新消息元数据
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === placeholderMessageId
                    ? {
                        ...msg,
                        id: response.message_id,
                        processing_time: processingTime,
                      }
                    : msg
                )
              );

              // 更新统计
              if (response.usage) {
                setTotalTokens((prev) => prev + response.usage!.total_tokens);
              }
              setResponseTimes((prev) => [...prev, processingTime]);

              setIsStreaming(false);
              setIsSending(false);
              onStreamComplete?.();

              // 触发回调
              const finalMessage: Message = {
                id: response.message_id,
                role: 'assistant',
                content: response.message,
                timestamp: Date.now(),
                processing_time: processingTime,
              };
              onMessageSent?.(finalMessage, response);
            },
            onError: (err) => {
              const error = new Error(err.message);
              setError(error);
              onError?.(error);

              // 移除占位消息，添加错误消息
              setMessages((prev) => {
                const filtered = prev.filter((msg) => msg.id !== placeholderMessageId);
                return [
                  ...filtered,
                  {
                    id: generateMessageId(),
                    role: 'system',
                    content: `发送失败: ${err.message}`,
                    timestamp: Date.now(),
                  },
                ];
              });

              setIsStreaming(false);
              setIsSending(false);
            },
            signal: abortControllerRef.current.signal,
          };

          streamManagerRef.current = await ChatAPI.sendMessageStream(
            {
              message: content,
              session_id: sessionId,
              model: options.model || defaultModel,
              character_id: options.character_id || defaultCharacter,
              temperature: options.temperature ?? defaultTemperature,
              top_p: options.top_p ?? defaultTopP,
              context_messages: contextMessages,
              stream: true,
              ...options,
            },
            streamOptions
          );
        } else {
          // 普通响应
          let retries = 0;
          let lastError: Error | null = null;

          while (retries <= maxRetries) {
            try {
              const response = await ChatService.sendMessage({
                message: content,
                session_id: sessionId,
                model: options.model || defaultModel,
                character_id: options.character_id || defaultCharacter,
                temperature: options.temperature ?? defaultTemperature,
                top_p: options.top_p ?? defaultTopP,
                context_messages: contextMessages,
                ...options,
              });

              const endTime = Date.now();
              const processingTime = endTime - startTime;

              // 创建助手消息
              const assistantMessage: Message = {
                id: response.message_id,
                role: 'assistant',
                content: response.message,
                timestamp: Date.now(),
                processing_time: processingTime,
              };

              // 添加助手回复
              setMessages((prev) => [...prev, assistantMessage]);

              // 更新统计
              if (response.usage) {
                setTotalTokens((prev) => prev + response.usage!.total_tokens);
              }
              setResponseTimes((prev) => [...prev, processingTime]);

              // 触发回调
              onMessageSent?.(assistantMessage, response);

              break; // 成功，退出重试循环
            } catch (err) {
              lastError = err instanceof Error ? err : new Error(String(err));
              retries++;

              if (retries > maxRetries) {
                throw lastError;
              }

              // 等待一段时间后重试
              await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
            }
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);

        // 添加错误提示消息
        const errorMessage: Message = {
          id: generateMessageId(),
          role: 'system',
          content: `发送失败: ${error.message}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        if (!enableStreaming) {
          setIsSending(false);
        }
      }
    },
    [
      messages,
      sessionId,
      defaultModel,
      defaultCharacter,
      maxContextMessages,
      enableStreaming,
      defaultTemperature,
      defaultTopP,
      maxRetries,
      onError,
      onMessageSent,
      onStreamChunk,
      onStreamStart,
      onStreamComplete,
    ]
  );

  // 停止流式响应
  const stopStreaming = useCallback(() => {
    if (streamManagerRef.current) {
      streamManagerRef.current.abort();
      streamManagerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsSending(false);
  }, []);

  // 重新发送最后一条消息
  const resendLastMessage = useCallback(async () => {
    if (!lastUserMessageRef.current) {
      return;
    }

    const { content, options } = lastUserMessageRef.current;
    await sendMessage(content, options);
  }, [sendMessage]);

  // 清空历史
  const clearHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await ChatService.clearChatHistory(sessionId);
      setMessages([]);
      lastUserMessageRef.current = null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, onError]);

  // 删除消息
  const deleteMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  }, []);

  // 设置模型
  const setModel = useCallback(
    async (modelId: string, adapterId?: string) => {
      try {
        await ChatService.setChatModel({
          model_id: modelId,
          adapter_id: adapterId,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      }
    },
    [onError]
  );

  // 添加系统消息
  const addSystemMessage = useCallback((content: string) => {
    const systemMessage: Message = {
      id: generateMessageId(),
      role: 'system',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, systemMessage]);
  }, []);

  // 重新生成最后的回复
  const regenerateLastResponse = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 找到最后一条助手消息（从后向前搜索）
      let lastAssistantIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          lastAssistantIndex = i;
          break;
        }
      }

      if (lastAssistantIndex === -1) {
        throw new Error('没有可重新生成的消息');
      }

      // 移除最后一条助手消息
      setMessages((prev) => prev.filter((_, index) => index !== lastAssistantIndex));

      // 找到对应的用户消息
      const lastUserMessage = messages
        .slice(0, lastAssistantIndex)
        .reverse()
        .find((msg: Message) => msg.role === 'user');

      if (lastUserMessage) {
        await sendMessage(lastUserMessage.content);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [messages, sendMessage, onError]);

  // 编辑消息
  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      const messageIndex = messages.findIndex((msg) => msg.id === messageId);
      if (messageIndex === -1) {
        throw new Error('消息不存在');
      }

      const message = messages[messageIndex];
      if (message.role !== 'user') {
        throw new Error('只能编辑用户消息');
      }

      // 移除该消息及之后的所有消息
      setMessages((prev) => prev.slice(0, messageIndex));

      // 重新发送编辑后的消息
      await sendMessage(newContent);
    },
    [messages, sendMessage]
  );

  // 清除错误
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 导出历史
  const exportHistory = useCallback(() => {
    return [...messages];
  }, [messages]);

  // 导入历史
  const importHistory = useCallback((importedMessages: Message[]) => {
    setMessages(importedMessages);
  }, []);

  // 计算统计信息
  const stats = useMemo(() => {
    const totalMessages = messages.length;
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    return {
      totalMessages,
      totalTokens,
      avgResponseTime,
    };
  }, [messages.length, totalTokens, responseTimes]);

  // 自动加载历史记录
  useEffect(() => {
    if (autoLoadHistory) {
      loadHistory();
    }
  }, [autoLoadHistory, loadHistory]);

  // 清理流式管理器
  useEffect(() => {
    return () => {
      if (streamManagerRef.current) {
        streamManagerRef.current.stop();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    sessionId,
    isLoading,
    isSending,
    isStreaming,
    error,
    stats,
    sendMessage,
    stopStreaming,
    resendLastMessage,
    regenerateLastResponse,
    clearHistory,
    loadHistory,
    deleteMessage,
    editMessage,
    setSessionId,
    setModel,
    addSystemMessage,
    clearError,
    exportHistory,
    importHistory,
  };
}

// ================================
// 简化版 Hook（仅基本功能）
// ================================

export function useSimpleChat(sessionId?: string) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const send = useCallback(
    async (message: string) => {
      setIsLoading(true);
      try {
        const response = await ChatService.sendMessage({
          message,
          session_id: sessionId,
        });

        setMessages((prev) => [
          ...prev,
          { role: 'user', content: message },
          { role: 'assistant', content: response.message },
        ]);

        return response;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  return { messages, isLoading, send };
}
