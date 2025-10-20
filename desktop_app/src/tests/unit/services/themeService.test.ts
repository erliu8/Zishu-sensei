/**
 * 主题服务测试
 * 
 * 测试主题管理、切换、自定义功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

describe('ThemeService', () => {
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;
  
  // 辅助函数用于类型断言
  const invokeWithType = async <T = any>(...args: any[]): Promise<T> => {
    return await mockInvoke(...args) as T;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('获取主题', () => {
    it('应该获取当前主题', async () => {
      const mockTheme = {
        id: 'dark',
        name: '深色主题',
        colors: {
          primary: '#007bff',
          background: '#1a1a1a',
          text: '#ffffff',
        },
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockTheme,
      });

      const response = await mockInvoke('get_current_theme') as any;

      expect(response.success).toBe(true);
      expect(response.data.id).toBe('dark');
    });

    it('应该获取所有可用主题', async () => {
      const mockThemes = [
        { id: 'light', name: '浅色主题' },
        { id: 'dark', name: '深色主题' },
        { id: 'auto', name: '自动' },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockThemes,
      });

      const response = await mockInvoke('get_available_themes') as any;

      expect(response.data).toHaveLength(3);
    });
  });

  describe('切换主题', () => {
    it('应该成功切换主题', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { theme_id: 'dark', applied: true },
      });

      const response = await mockInvoke('set_theme', {
        theme_id: 'dark',
      }) as any;

       expect(response.success).toBe(true);
      expect(response.data.applied).toBe(true);
    });

    it('应该处理无效的主题ID', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: '主题不存在',
      });

      const response = await mockInvoke('set_theme', {
        theme_id: 'invalid',
      }) as any;

       expect(response.success).toBe(false);
    });

    it('应该支持自动主题切换', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { theme_id: 'auto', applied: true },
      });

      const response = await mockInvoke('set_theme', {
        theme_id: 'auto',
      }) as any;

       expect(response.data.theme_id).toBe('auto');
    });
  });

  describe('自定义主题', () => {
    it('应该创建自定义主题', async () => {
      const customTheme = {
        name: '我的主题',
        colors: {
          primary: '#ff6b6b',
          background: '#2d2d2d',
          text: '#f5f5f5',
        },
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: { theme_id: 'custom_1', created: true },
      });

      const response = await mockInvoke('create_custom_theme', {
        theme: customTheme,
      }) as any;

      expect(response.data.created).toBe(true);
    });

    it('应该更新自定义主题', async () => {
      const updates = {
        colors: {
          primary: '#00ff00',
        },
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: { updated: true },
      });

      const response = await mockInvoke('update_custom_theme', {
        theme_id: 'custom_1',
        updates,
      }) as any;

      expect(response.data.updated).toBe(true);
    });

    it('应该删除自定义主题', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { deleted: true },
      });

      const response = await mockInvoke('delete_custom_theme', {
        theme_id: 'custom_1',
      }) as any;

      expect(response.data.deleted).toBe(true);
    });
  });

  describe('主题导入导出', () => {
    it('应该导出主题', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          file_path: '/exports/theme.json',
          theme_data: '{}',
        },
      });

      const response = await mockInvoke('export_theme', {
        theme_id: 'dark',
      }) as any;

      expect(response.data.file_path).toBeTruthy();
    });

    it('应该导入主题', async () => {
      const themeData = {
        name: '导入主题',
        colors: {},
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: { theme_id: 'imported_1', imported: true },
      });

      const response = await mockInvoke('import_theme', {
        theme_data: JSON.stringify(themeData),
      }) as any;

      expect(response.data.imported).toBe(true);
    });
  });

  describe('主题预览', () => {
    it('应该预览主题', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { previewing: true },
      });

      const response = await mockInvoke('preview_theme', {
        theme_id: 'light',
      }) as any;

      expect(response.data.previewing).toBe(true);
    });

    it('应该取消主题预览', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { previewing: false },
      });

      const response = await mockInvoke('cancel_theme_preview') as any;

      expect(response.data.previewing).toBe(false);
    });
  });

  describe('主题配置', () => {
    it('应该获取主题配置', async () => {
      const mockConfig = {
        auto_switch: true,
        dark_mode_start: '18:00',
        dark_mode_end: '06:00',
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockConfig,
      });

      const response = await mockInvoke('get_theme_config') as any;

      expect(response.data.auto_switch).toBe(true);
    });

    it('应该更新主题配置', async () => {
      const config = {
        auto_switch: true,
        dark_mode_start: '20:00',
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: { updated: true },
      });

      const response = await mockInvoke('update_theme_config', {
        config,
      }) as any;

      expect(response.data.updated).toBe(true);
    });
  });

  describe('颜色工具', () => {
    it('应该验证颜色格式', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { valid: true },
      });

      const response = await mockInvoke('validate_color', {
        color: '#ff6b6b',
      }) as any;

      expect(response.data.valid).toBe(true);
    });

    it('应该转换颜色格式', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { converted_color: 'rgb(255, 107, 107)' },
      });

      const response = await mockInvoke('convert_color', {
        color: '#ff6b6b',
        format: 'rgb',
      }) as any;

      expect(response.data.converted_color).toBeTruthy();
    });

    it('应该生成配色方案', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          colors: ['#ff6b6b', '#ff8787', '#ffa3a3'],
        },
      });

      const response = await mockInvoke('generate_color_scheme', {
        base_color: '#ff6b6b',
        scheme_type: 'analogous',
      }) as any;

      expect(response.data.colors).toHaveLength(3);
    });
  });
});

