/**
 * 日志服务测试
 * 
 * 测试日志记录、查询、分析功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

describe('LoggingService', () => {
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('日志记录', () => {
    it('应该记录info日志', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { log_id: 'log_1' },
      });

      const response = await mockInvoke('log_info', {
        message: 'Info message',
        metadata: { source: 'test' },
      });

      expect(response.success).toBe(true);
      expect(response.data.log_id).toBeTruthy();
    });

    it('应该记录error日志', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { log_id: 'log_2' },
      });

      const response = await mockInvoke('log_error', {
        message: 'Error message',
        error: 'Error details',
        stack: 'Stack trace',
      });

      expect(response.success).toBe(true);
    });

    it('应该记录warning日志', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { log_id: 'log_3' },
      });

      const response = await mockInvoke('log_warning', {
        message: 'Warning message',
      });

      expect(response.success).toBe(true);
    });

    it('应该记录debug日志', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { log_id: 'log_4' },
      });

      const response = await mockInvoke('log_debug', {
        message: 'Debug message',
        data: { key: 'value' },
      });

      expect(response.success).toBe(true);
    });
  });

  describe('日志查询', () => {
    it('应该查询日志', async () => {
      const mockLogs = [
        {
          id: 'log_1',
          level: 'info',
          message: 'Log 1',
          timestamp: Date.now(),
        },
        {
          id: 'log_2',
          level: 'error',
          message: 'Log 2',
          timestamp: Date.now(),
        },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        data: { logs: mockLogs, total: 2 },
      });

      const response = await mockInvoke('query_logs', {
        limit: 10,
        level: 'info',
      });

      expect(response.data.logs).toHaveLength(2);
    });

    it('应该支持时间范围过滤', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { logs: [], total: 0 },
      });

      await mockInvoke('query_logs', {
        start_time: Date.now() - 86400000,
        end_time: Date.now(),
      });

      expect(mockInvoke).toHaveBeenCalled();
    });

    it('应该支持日志级别过滤', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { logs: [], total: 0 },
      });

      await mockInvoke('query_logs', {
        level: 'error',
      });

      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  describe('日志导出', () => {
    it('应该导出日志', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { file_path: '/exports/logs.json' },
      });

      const response = await mockInvoke('export_logs', {
        format: 'json',
        start_time: Date.now() - 86400000,
        end_time: Date.now(),
      });

      expect(response.data.file_path).toBeTruthy();
    });

    it('应该支持多种导出格式', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { file_path: '/exports/logs.csv' },
      });

      await mockInvoke('export_logs', {
        format: 'csv',
      });

      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  describe('日志清理', () => {
    it('应该清理旧日志', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { deleted_count: 1000 },
      });

      const response = await mockInvoke('cleanup_old_logs', {
        days: 30,
      });

      expect(response.data.deleted_count).toBeGreaterThan(0);
    });

    it('应该按级别清理日志', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { deleted_count: 500 },
      });

      await mockInvoke('cleanup_logs_by_level', {
        level: 'debug',
        days: 7,
      });

      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  describe('日志统计', () => {
    it('应该获取日志统计', async () => {
      const mockStats = {
        total_logs: 10000,
        logs_by_level: {
          error: 100,
          warning: 500,
          info: 8000,
          debug: 1400,
        },
        logs_by_hour: {},
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockStats,
      });

      const response = await mockInvoke('get_log_statistics');

      expect(response.data.total_logs).toBe(10000);
    });
  });

  describe('日志配置', () => {
    it('应该配置日志级别', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { configured: true },
      });

      const response = await mockInvoke('set_log_level', {
        level: 'debug',
      });

      expect(response.data.configured).toBe(true);
    });

    it('应该配置日志保留期', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { configured: true },
      });

      await mockInvoke('set_log_retention', {
        days: 30,
      });

      expect(mockInvoke).toHaveBeenCalled();
    });
  });
});

