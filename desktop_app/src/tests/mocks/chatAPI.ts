/**
 * Chat API 模拟
 * 为测试环境提供 Chat API 的模拟实现
 */

import { vi } from 'vitest';

// Mock 验证结果
export const mockValidateMessage = vi.fn(() => ({ valid: true }));

// Mock 流管理器
export const mockStreamManager = {
  abort: vi.fn(),
  stop: vi.fn(),
};

// Mock 流式消息发送
export const mockSendMessageStream = vi.fn(() => Promise.resolve(mockStreamManager));

// Mock Chat API - 确保返回正确格式
export const MockChatAPI = {
  validateMessage: mockValidateMessage,
  sendMessageStream: mockSendMessageStream,
};

// Mock StreamManager
export const MockStreamManager = class {
  abort = vi.fn();
  stop = vi.fn();
};

// 导出 Mock
vi.mock('@/services/api/chat', () => ({
  ChatAPI: MockChatAPI,
  StreamManager: MockStreamManager,
}));

export { MockChatAPI as ChatAPI, MockStreamManager as StreamManager };
