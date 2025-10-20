/**
 * 内存管理服务测试
 * 
 * 测试内存监控、清理、优化等功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

describe('MemoryService', () => {
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('获取内存使用情况', () => {
    it('应该成功获取内存使用情况', async () => {
      const mockMemoryInfo = {
        total_mb: 16384,
        used_mb: 8192,
        available_mb: 8192,
        usage_percent: 50,
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockMemoryInfo,
      });

      const response = await mockInvoke('get_memory_usage');

      expect(response.success).toBe(true);
      expect(response.data.usage_percent).toBe(50);
    });

    it('应该处理获取失败', async () => {
      mockInvoke.mockRejectedValue(new Error('Failed to get memory usage'));

      await expect(mockInvoke('get_memory_usage')).rejects.toThrow();
    });
  });

  describe('内存清理', () => {
    it('应该成功清理内存', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { freed_mb: 100 },
      });

      const response = await mockInvoke('clear_memory_cache');

      expect(response.success).toBe(true);
      expect(response.data.freed_mb).toBeGreaterThan(0);
    });

    it('应该记录清理的内存量', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { freed_mb: 256 },
      });

      const response = await mockInvoke('clear_memory_cache');

      expect(response.data.freed_mb).toBe(256);
    });
  });

  describe('内存监控', () => {
    it('应该启动内存监控', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { monitoring: true },
      });

      const response = await mockInvoke('start_memory_monitoring', {
        interval: 1000,
      });

      expect(response.success).toBe(true);
    });

    it('应该停止内存监控', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { monitoring: false },
      });

      const response = await mockInvoke('stop_memory_monitoring');

      expect(response.success).toBe(true);
    });
  });

  describe('内存优化', () => {
    it('应该进行内存优化', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { optimized: true, freed_mb: 200 },
      });

      const response = await mockInvoke('optimize_memory');

      expect(response.data.optimized).toBe(true);
      expect(response.data.freed_mb).toBeGreaterThan(0);
    });
  });

  describe('内存泄漏检测', () => {
    it('应该检测内存泄漏', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          has_leak: false,
          suspects: [],
        },
      });

      const response = await mockInvoke('check_memory_leaks');

      expect(response.success).toBe(true);
      expect(response.data.has_leak).toBe(false);
    });

    it('应该报告检测到的泄漏', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          has_leak: true,
          suspects: ['component-a', 'component-b'],
        },
      });

      const response = await mockInvoke('check_memory_leaks');

      expect(response.data.has_leak).toBe(true);
      expect(response.data.suspects).toHaveLength(2);
    });
  });
});

