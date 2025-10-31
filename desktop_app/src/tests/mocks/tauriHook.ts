/**
 * useTauri Hook Mock
 * 为测试环境提供 useTauri Hook 的模拟实现
 */

import { vi } from 'vitest';

// Mock useTauri Hook
export const mockUseTauri = vi.fn(() => ({
  isAvailable: true, // 在测试中总是返回 true
  invoke: vi.fn(),
  listen: vi.fn(),
  emit: vi.fn(),
  error: null,
}));

// 设置 mock
vi.mock('@/hooks/useTauri', () => ({
  useTauri: mockUseTauri,
}));

export default mockUseTauri;
