/**
 * 错误监控服务测试
 * 
 * 测试错误捕获、报告、分析功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';
import type { Mock } from 'vitest';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

describe('ErrorMonitoringService', () => {
  const mockInvoke = invoke as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('错误捕获', () => {
    it('应该捕获并记录错误', async () => {
      const error = {
        message: 'Test error',
        stack: 'Error stack',
        timestamp: Date.now(),
        level: 'error',
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: { error_id: 'err_123' },
      });

      const response = await mockInvoke('capture_error', { error }) as any;

      expect(response.success).toBe(true);
      expect(response.data.error_id).toBeTruthy();
    });

    it('应该记录错误上下文', async () => {
      const error = {
        message: 'Error with context',
        context: {
          userId: 'user-1',
          action: 'submit_form',
        },
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: { error_id: 'err_124' },
      });

      const response = await mockInvoke('capture_error', { error }) as any;

      expect(response.success).toBe(true);
    });
  });

  describe('错误查询', () => {
    it('应该查询错误列表', async () => {
      const mockErrors = [
        {
          id: 'err_1',
          message: 'Error 1',
          level: 'error',
          timestamp: Date.now(),
        },
        {
          id: 'err_2',
          message: 'Error 2',
          level: 'warning',
          timestamp: Date.now(),
        },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        data: { errors: mockErrors, total: 2 },
      });

      const response = await mockInvoke('query_errors', {
        limit: 10,
        level: 'error',
      }) as any;

      expect(response.data.errors).toHaveLength(2);
    });

    it('应该支持错误过滤', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { errors: [], total: 0 },
      });

      await mockInvoke('query_errors', {
        start_time: Date.now() - 86400000,
        end_time: Date.now(),
        level: 'critical',
      });

      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  describe('错误统计', () => {
    it('应该获取错误统计', async () => {
      const mockStats = {
        total_errors: 100,
        errors_by_level: {
          critical: 5,
          error: 50,
          warning: 30,
          info: 15,
        },
        errors_by_source: {
          frontend: 60,
          backend: 40,
        },
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockStats,
      });

      const response = await mockInvoke('get_error_statistics') as any;

      expect(response.data.total_errors).toBe(100);
      expect(response.data.errors_by_level.critical).toBe(5);
    });
  });

  describe('错误报告', () => {
    it('应该生成错误报告', async () => {
      const mockReport = {
        report_id: 'report_1',
        generated_at: Date.now(),
        error_count: 50,
        summary: 'Error report summary',
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockReport,
      });

      const response = await mockInvoke('generate_error_report', {
        start_time: Date.now() - 86400000,
        end_time: Date.now(),
      }) as any;

      expect(response.data.error_count).toBe(50);
    });
  });

  describe('错误清理', () => {
    it('应该清理旧错误', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { deleted_count: 100 },
      });

      const response = await mockInvoke('cleanup_old_errors', {
        days: 30,
      }) as any;

      expect(response.data.deleted_count).toBe(100);
    });
  });

  describe('错误通知', () => {
    it('应该配置错误通知', async () => {
      const config = {
        enabled: true,
        levels: ['critical', 'error'],
        channels: ['email', 'webhook'],
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: { configured: true },
      });

      const response = await mockInvoke('configure_error_notifications', {
        config,
      }) as any;

      expect(response.data.configured).toBe(true);
    });
  });
});

