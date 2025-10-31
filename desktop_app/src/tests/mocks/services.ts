/**
 * Services Mock
 * 为所有服务模块提供模拟实现
 */

import { vi } from 'vitest';

// Mock ChatAPI
export const mockChatAPI = {
  validateMessage: vi.fn((content: string) => ({ 
    valid: content ? content.trim().length > 0 : false,
    error: content ? null : '消息不能为空'
  })),
  sendMessageStream: vi.fn(() => Promise.resolve({
    abort: vi.fn(),
    stop: vi.fn(),
  })),
};

// Mock其他服务
export const mockEncryptionService = {
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  generateKey: vi.fn(),
  rotateKey: vi.fn(),
};

// 设置模块级别的mock
vi.mock('@/services/api/chat', () => ({
  ChatAPI: mockChatAPI,
  StreamManager: class MockStreamManager {
    abort = vi.fn();
    stop = vi.fn();
  },
}));

export default {
  ChatAPI: mockChatAPI,
  EncryptionService: mockEncryptionService,
};
