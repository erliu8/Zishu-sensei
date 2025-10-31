/**
 * Tauri API Mock
 * 为 @tauri-apps/api 提供模拟实现
 */

import { vi } from 'vitest';

// Mock Tauri invoke function
export const mockInvoke = vi.fn().mockImplementation(async (command: string, args?: any) => {
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

// Mock 其他 Tauri API 方法
export const mockListen = vi.fn();
export const mockEmit = vi.fn();

// 导出 invoke 作为默认导出以匹配实际的 @tauri-apps/api/tauri 模块
export const invoke = mockInvoke;
export const listen = mockListen;
export const emit = mockEmit;

export default {
  invoke: mockInvoke,
  listen: mockListen,
  emit: mockEmit,
};