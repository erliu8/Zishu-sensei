/**
 * 聊天服务测试
 * 
 * 测试 ChatService 的所有聊天功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';
import {
  ChatService,
  sendSimpleMessage,
  sendMessageWithContext,
  getRecentHistory,
  type SendMessageInput,
  type ChatResponse,
  type ChatHistoryResponse,
  type HistoryMessage,
  type SetModelInput,
  type SetModelResponse,
} from '../../../services/chat';
import { createMockApiResponse, createMockErrorResponse } from '../../mocks/factories';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

describe('ChatService', () => {
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

  // 辅助函数
  const createMockChatResponse = (overrides?: Partial<ChatResponse>): ChatResponse => ({
    message: 'Hello! How can I help you?',
    session_id: 'session_123',
    message_id: 'msg_123',
    model: 'gpt-3.5-turbo',
    processing_time: 150,
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
    finish_reason: 'stop',
    ...overrides,
  });

  const createMockHistoryMessage = (overrides?: Partial<HistoryMessage>): HistoryMessage => ({
    role: 'user',
    content: 'Test message',
    timestamp: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================
  // 发送消息测试
  // ================================
  describe('sendMessage', () => {
    it('应该成功发送消息', async () => {
      const input: SendMessageInput = {
        message: 'Hello',
        session_id: 'session_123',
      };

      const mockResponse = createMockChatResponse();
      mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

      const result = await ChatService.sendMessage(input);

      expect(mockInvoke).toHaveBeenCalledWith('send_message', { input });
      expect(result).toEqual(mockResponse);
      expect(result.message).toBe(mockResponse.message);
    });

    it('应该支持带模型和适配器的消息', async () => {
      const input: SendMessageInput = {
        message: 'Hello',
        session_id: 'session_123',
        model: 'gpt-4',
        adapter: 'openai-adapter',
      };

      const mockResponse = createMockChatResponse({ model: 'gpt-4' });
      mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

      const result = await ChatService.sendMessage(input);

      expect(result.model).toBe('gpt-4');
    });

    it('应该支持自定义参数', async () => {
      const input: SendMessageInput = {
        message: 'Hello',
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.9,
      };

      const mockResponse = createMockChatResponse();
      mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

      await ChatService.sendMessage(input);

      expect(mockInvoke).toHaveBeenCalledWith('send_message', { input });
    });

    it('应该支持上下文消息', async () => {
      const input: SendMessageInput = {
        message: 'Continue',
        context_messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi! How can I help?' },
        ],
      };

      const mockResponse = createMockChatResponse();
      mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

      const result = await ChatService.sendMessage(input);

      expect(result).toEqual(mockResponse);
    });

    it('应该支持流式模式', async () => {
      const input: SendMessageInput = {
        message: 'Hello',
        stream: true,
      };

      const mockResponse = createMockChatResponse();
      mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

      await ChatService.sendMessage(input);

      expect(mockInvoke).toHaveBeenCalledWith('send_message', {
        input: expect.objectContaining({ stream: true }),
      });
    });

    it('应该处理发送失败', async () => {
      const input: SendMessageInput = {
        message: 'Hello',
      };

      mockInvoke.mockResolvedValue(createMockErrorResponse('发送消息失败'));

      await expect(ChatService.sendMessage(input)).rejects.toThrow('发送消息失败');
    });

    it('应该处理网络错误', async () => {
      const input: SendMessageInput = {
        message: 'Hello',
      };

      mockInvoke.mockRejectedValue(new Error('Network error'));

      await expect(ChatService.sendMessage(input)).rejects.toThrow('Network error');
    });

    it('应该记录错误到控制台', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const input: SendMessageInput = {
        message: 'Hello',
      };

      mockInvoke.mockRejectedValue(new Error('Test error'));

      await expect(ChatService.sendMessage(input)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('发送消息失败:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('应该处理空消息', async () => {
      const input: SendMessageInput = {
        message: '',
      };

      const mockResponse = createMockChatResponse();
      mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

      const result = await ChatService.sendMessage(input);

      expect(result).toBeDefined();
    });

    it('应该处理超长消息', async () => {
      const longMessage = 'a'.repeat(10000);
      const input: SendMessageInput = {
        message: longMessage,
      };

      const mockResponse = createMockChatResponse();
      mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

      const result = await ChatService.sendMessage(input);

      expect(result).toBeDefined();
    });
  });

  // ================================
  // 获取聊天历史测试
  // ================================
  describe('getChatHistory', () => {
    it('应该成功获取聊天历史', async () => {
      const mockHistory: ChatHistoryResponse = {
        session_id: 'session_123',
        messages: [
          createMockHistoryMessage({ role: 'user', content: 'Hello' }),
          createMockHistoryMessage({ role: 'assistant', content: 'Hi!' }),
        ],
        total_count: 2,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockHistory));

      const result = await ChatService.getChatHistory('session_123');

      expect(mockInvoke).toHaveBeenCalledWith('get_chat_history', {
        input: { session_id: 'session_123', limit: undefined },
      });
      expect(result).toEqual(mockHistory);
      expect(result.messages).toHaveLength(2);
    });

    it('应该支持限制消息数量', async () => {
      const mockHistory: ChatHistoryResponse = {
        session_id: 'session_123',
        messages: [createMockHistoryMessage()],
        total_count: 1,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockHistory));

      await ChatService.getChatHistory('session_123', 10);

      expect(mockInvoke).toHaveBeenCalledWith('get_chat_history', {
        input: { session_id: 'session_123', limit: 10 },
      });
    });

    it('应该处理空历史', async () => {
      const mockHistory: ChatHistoryResponse = {
        session_id: 'session_123',
        messages: [],
        total_count: 0,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockHistory));

      const result = await ChatService.getChatHistory('session_123');

      expect(result.messages).toHaveLength(0);
      expect(result.total_count).toBe(0);
    });

    it('应该处理获取失败', async () => {
      mockInvoke.mockResolvedValue(createMockErrorResponse('获取历史记录失败'));

      await expect(ChatService.getChatHistory('session_123')).rejects.toThrow(
        '获取历史记录失败'
      );
    });

    it('应该处理无效的会话ID', async () => {
      mockInvoke.mockResolvedValue(createMockErrorResponse('会话不存在'));

      await expect(ChatService.getChatHistory('invalid_session')).rejects.toThrow(
        '会话不存在'
      );
    });

    it('应该保留消息的时间戳', async () => {
      const timestamp = Date.now();
      const mockHistory: ChatHistoryResponse = {
        session_id: 'session_123',
        messages: [
          createMockHistoryMessage({ timestamp }),
        ],
        total_count: 1,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockHistory));

      const result = await ChatService.getChatHistory('session_123');

      expect(result.messages[0].timestamp).toBe(timestamp);
    });
  });

  // ================================
  // 清空聊天历史测试
  // ================================
  describe('clearChatHistory', () => {
    it('应该成功清空聊天历史', async () => {
      const mockClearResponse = {
        message: '历史记录已清空',
        session_id: 'session_123',
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockClearResponse));

      const result = await ChatService.clearChatHistory('session_123');

      expect(mockInvoke).toHaveBeenCalledWith('clear_chat_history', {
        input: { session_id: 'session_123' },
      });
      expect(result).toEqual(mockClearResponse);
    });

    it('应该处理清空失败', async () => {
      mockInvoke.mockResolvedValue(createMockErrorResponse('清空历史记录失败'));

      await expect(ChatService.clearChatHistory('session_123')).rejects.toThrow(
        '清空历史记录失败'
      );
    });

    it('应该处理网络错误', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      await expect(ChatService.clearChatHistory('session_123')).rejects.toThrow(
        'Network error'
      );
    });

    it('应该记录错误到控制台', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInvoke.mockRejectedValue(new Error('Test error'));

      await expect(ChatService.clearChatHistory('session_123')).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '清空历史记录失败:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ================================
  // 设置聊天模型测试
  // ================================
  describe('setChatModel', () => {
    it('应该成功设置聊天模型', async () => {
      const input: SetModelInput = {
        model_id: 'gpt-4',
        adapter_id: 'openai-adapter',
      };

      const mockResponse: SetModelResponse = {
        success: true,
        model_id: 'gpt-4',
        adapter_id: 'openai-adapter',
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

      const result = await ChatService.setChatModel(input);

      expect(mockInvoke).toHaveBeenCalledWith('set_chat_model', { input });
      expect(result).toEqual(mockResponse);
    });

    it('应该支持带配置的模型设置', async () => {
      const input: SetModelInput = {
        model_id: 'gpt-4',
        adapter_id: 'openai-adapter',
        config: {
          temperature: 0.7,
          max_tokens: 2000,
        },
      };

      const mockResponse: SetModelResponse = {
        success: true,
        model_id: 'gpt-4',
        adapter_id: 'openai-adapter',
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

      const result = await ChatService.setChatModel(input);

      expect(result.success).toBe(true);
    });

    it('应该处理设置失败', async () => {
      const input: SetModelInput = {
        model_id: 'invalid-model',
      };

      mockInvoke.mockResolvedValue(createMockErrorResponse('设置模型失败'));

      await expect(ChatService.setChatModel(input)).rejects.toThrow('设置模型失败');
    });

    it('应该处理模型不存在', async () => {
      const input: SetModelInput = {
        model_id: 'nonexistent-model',
      };

      mockInvoke.mockResolvedValue(createMockErrorResponse('模型不存在'));

      await expect(ChatService.setChatModel(input)).rejects.toThrow('模型不存在');
    });
  });

  // ================================
  // 生成会话ID测试
  // ================================
  describe('generateSessionId', () => {
    it('应该生成唯一的会话ID', () => {
      const id1 = ChatService.generateSessionId();
      const id2 = ChatService.generateSessionId();

      expect(id1).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    it('应该包含时间戳', () => {
      const beforeTimestamp = Date.now();
      const sessionId = ChatService.generateSessionId();
      const afterTimestamp = Date.now();

      const match = sessionId.match(/^session_(\d+)_/);
      expect(match).not.toBeNull();
      
      if (match) {
        const timestamp = parseInt(match[1]);
        expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
        expect(timestamp).toBeLessThanOrEqual(afterTimestamp);
      }
    });

    it('应该包含随机部分', () => {
      const ids = Array.from({ length: 100 }, () => ChatService.generateSessionId());
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100); // 所有ID应该唯一
    });

    it('应该使用正确的前缀', () => {
      const sessionId = ChatService.generateSessionId();

      expect(sessionId).toMatch(/^session_/);
    });
  });

  // ================================
  // 便捷函数测试
  // ================================
  describe('Convenience Functions', () => {
    describe('sendSimpleMessage', () => {
      it('应该发送简单消息', async () => {
        const mockResponse = createMockChatResponse();
        mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

        const result = await sendSimpleMessage('Hello');

        expect(mockInvoke).toHaveBeenCalledWith('send_message', {
          input: {
            message: 'Hello',
            session_id: undefined,
          },
        });
        expect(result).toEqual(mockResponse);
      });

      it('应该支持指定会话ID', async () => {
        const mockResponse = createMockChatResponse();
        mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

        await sendSimpleMessage('Hello', 'session_123');

        expect(mockInvoke).toHaveBeenCalledWith('send_message', {
          input: {
            message: 'Hello',
            session_id: 'session_123',
          },
        });
      });
    });

    describe('sendMessageWithContext', () => {
      it('应该发送带上下文的消息', async () => {
        const contextMessages = [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
        ];

        const mockResponse = createMockChatResponse();
        mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

        const result = await sendMessageWithContext('Continue', contextMessages);

        expect(mockInvoke).toHaveBeenCalledWith('send_message', {
          input: {
            message: 'Continue',
            session_id: undefined,
            context_messages: contextMessages,
          },
        });
        expect(result).toEqual(mockResponse);
      });

      it('应该支持指定会话ID', async () => {
        const contextMessages = [{ role: 'user', content: 'Hi' }];

        const mockResponse = createMockChatResponse();
        mockInvoke.mockResolvedValue(createMockApiResponse(mockResponse));

        await sendMessageWithContext('Continue', contextMessages, 'session_123');

        expect(mockInvoke).toHaveBeenCalledWith('send_message', {
          input: {
            message: 'Continue',
            session_id: 'session_123',
            context_messages: contextMessages,
          },
        });
      });
    });

    describe('getRecentHistory', () => {
      it('应该获取最近的历史记录', async () => {
        const mockHistory: ChatHistoryResponse = {
          session_id: 'session_123',
          messages: [createMockHistoryMessage()],
          total_count: 1,
        };

        mockInvoke.mockResolvedValue(createMockApiResponse(mockHistory));

        const result = await getRecentHistory('session_123');

        expect(mockInvoke).toHaveBeenCalledWith('get_chat_history', {
          input: { session_id: 'session_123', limit: 50 },
        });
        expect(result).toEqual(mockHistory.messages);
      });

      it('应该支持自定义数量限制', async () => {
        const mockHistory: ChatHistoryResponse = {
          session_id: 'session_123',
          messages: [],
          total_count: 0,
        };

        mockInvoke.mockResolvedValue(createMockApiResponse(mockHistory));

        await getRecentHistory('session_123', 20);

        expect(mockInvoke).toHaveBeenCalledWith('get_chat_history', {
          input: { session_id: 'session_123', limit: 20 },
        });
      });
    });
  });

  // ================================
  // 集成测试场景
  // ================================
  describe('Integration Scenarios', () => {
    it('应该支持完整的聊天流程', async () => {
      // 1. 生成会话ID
      const sessionId = ChatService.generateSessionId();
      expect(sessionId).toBeTruthy();

      // 2. 发送第一条消息
      const mockResponse1 = createMockChatResponse({
        session_id: sessionId,
        message: 'Hello! How can I help you?',
      });
      mockInvoke.mockResolvedValueOnce(createMockApiResponse(mockResponse1));

      const response1 = await ChatService.sendMessage({
        message: 'Hello',
        session_id: sessionId,
      });
      expect(response1.message).toBe('Hello! How can I help you?');

      // 3. 发送第二条消息
      const mockResponse2 = createMockChatResponse({
        session_id: sessionId,
        message: 'Here is the information...',
      });
      mockInvoke.mockResolvedValueOnce(createMockApiResponse(mockResponse2));

      const response2 = await ChatService.sendMessage({
        message: 'Tell me more',
        session_id: sessionId,
      });
      expect(response2.message).toBe('Here is the information...');

      // 4. 获取历史记录
      const mockHistory: ChatHistoryResponse = {
        session_id: sessionId,
        messages: [
          createMockHistoryMessage({ role: 'user', content: 'Hello' }),
          createMockHistoryMessage({
            role: 'assistant',
            content: 'Hello! How can I help you?',
          }),
          createMockHistoryMessage({ role: 'user', content: 'Tell me more' }),
          createMockHistoryMessage({
            role: 'assistant',
            content: 'Here is the information...',
          }),
        ],
        total_count: 4,
      };
      mockInvoke.mockResolvedValueOnce(createMockApiResponse(mockHistory));

      const history = await ChatService.getChatHistory(sessionId);
      expect(history.messages).toHaveLength(4);

      // 5. 清空历史
      mockInvoke.mockResolvedValueOnce(
        createMockApiResponse({
          message: '历史记录已清空',
          session_id: sessionId,
        })
      );

      const clearResult = await ChatService.clearChatHistory(sessionId);
      expect(clearResult.session_id).toBe(sessionId);
    });

    it('应该支持模型切换', async () => {
      // 1. 设置初始模型
      mockInvoke.mockResolvedValueOnce(
        createMockApiResponse({
          success: true,
          model_id: 'gpt-3.5-turbo',
        })
      );

      const model1 = await ChatService.setChatModel({
        model_id: 'gpt-3.5-turbo',
      });
      expect(model1.model_id).toBe('gpt-3.5-turbo');

      // 2. 发送消息
      mockInvoke.mockResolvedValueOnce(
        createMockApiResponse(
          createMockChatResponse({ model: 'gpt-3.5-turbo' })
        )
      );

      const response1 = await ChatService.sendMessage({ message: 'Hello' });
      expect(response1.model).toBe('gpt-3.5-turbo');

      // 3. 切换模型
      mockInvoke.mockResolvedValueOnce(
        createMockApiResponse({
          success: true,
          model_id: 'gpt-4',
        })
      );

      const model2 = await ChatService.setChatModel({
        model_id: 'gpt-4',
      });
      expect(model2.model_id).toBe('gpt-4');

      // 4. 再次发送消息
      mockInvoke.mockResolvedValueOnce(
        createMockApiResponse(createMockChatResponse({ model: 'gpt-4' }))
      );

      const response2 = await ChatService.sendMessage({ message: 'Hello again' });
      expect(response2.model).toBe('gpt-4');
    });

    it('应该处理错误恢复', async () => {
      const sessionId = 'session_123';

      // 1. 第一次发送失败
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        ChatService.sendMessage({
          message: 'Hello',
          session_id: sessionId,
        })
      ).rejects.toThrow('Network error');

      // 2. 重试成功
      const mockResponse = createMockChatResponse({ session_id: sessionId });
      mockInvoke.mockResolvedValueOnce(createMockApiResponse(mockResponse));

      const response = await ChatService.sendMessage({
        message: 'Hello',
        session_id: sessionId,
      });

      expect(response.session_id).toBe(sessionId);
    });
  });

  // ================================
  // 性能测试
  // ================================
  describe('Performance', () => {
    it('应该能够处理大量历史消息', async () => {
      const largeHistory: ChatHistoryResponse = {
        session_id: 'session_123',
        messages: Array.from({ length: 1000 }, (_, i) =>
          createMockHistoryMessage({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i}`,
          })
        ),
        total_count: 1000,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(largeHistory));

      const start = Date.now();
      const result = await ChatService.getChatHistory('session_123');
      const duration = Date.now() - start;

      expect(result.messages).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该能够处理并发请求', async () => {
      mockInvoke.mockResolvedValue(
        createMockApiResponse(createMockChatResponse())
      );

      const promises = Array.from({ length: 10 }, (_, i) =>
        ChatService.sendMessage({ message: `Message ${i}` })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockInvoke).toHaveBeenCalledTimes(10);
    });
  });
});

