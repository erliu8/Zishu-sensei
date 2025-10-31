/**
 * Tauri API 模拟
 * 为测试环境提供 Tauri API 的模拟实现
 */

import { vi } from 'vitest';

// Mock Tauri invoke 方法
export const mockTauriInvoke = vi.fn();

// 设置默认的成功响应
mockTauriInvoke.mockImplementation(async (command: string, args?: any) => {
  switch (command) {
    case 'send_message':
      return {
        success: true,
        data: {
          message_id: 'test_msg_123',
          message: 'Test response from mock',
          session_id: args?.input?.session_id || 'test-session',
          model: 'mock-model',
          usage: {
            prompt_tokens: 50,
            completion_tokens: 50,
            total_tokens: 100,
          },
          processing_time: 100,
        }
      };

    case 'get_chat_history':
      return {
        success: true,
        data: {
          session_id: args?.input?.session_id,
          messages: [],
          total_count: 0,
        }
      };

    case 'clear_chat_history':
      return {
        success: true,
        data: {
          message: 'History cleared',
          session_id: args?.input?.session_id,
        }
      };

    case 'set_chat_model':
      return {
        success: true,
        data: {
          success: true,
          model_id: args?.input?.model_id,
          adapter_id: args?.input?.adapter_id,
        }
      };

    default:
      return {
        success: true,
        data: null,
      };
  }
});

// Mock Tauri 模块
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: mockTauriInvoke,
}));

export default mockTauriInvoke;
