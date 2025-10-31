/**
 * 适配器服务测试
 * 
 * 测试 AdapterService 的所有功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';
import { 
  AdapterService,
  AdapterStatus,
  AdapterType,
  CapabilityLevel,
  type AdapterInfo,
  type AdapterMetadata,
  type AdapterInstallRequest,
  type AdapterExecutionRequest,
  type AdapterConfigUpdateRequest,
  type AdapterSearchRequest,
} from '../../../services/adapter';
import { 
  createMockAdapter,
  createMockAdapterMetadata,
  createMockApiResponse,
  createMockErrorResponse,
} from '../../mocks/factories';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

describe('AdapterService', () => {
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================
  // 获取适配器列表测试
  // ================================
  describe('getAdapters', () => {
    it('应该成功获取适配器列表', async () => {
      const mockAdapters: AdapterInfo[] = [
        createMockAdapter({ name: 'adapter-1', status: AdapterStatus.Loaded }),
        createMockAdapter({ name: 'adapter-2', status: AdapterStatus.Unloaded }),
      ];

      mockInvoke.mockResolvedValue(createMockApiResponse(mockAdapters));

      const result = await AdapterService.getAdapters();

      expect(mockInvoke).toHaveBeenCalledWith('get_adapters');
      expect(result).toEqual(mockAdapters);
      expect(result).toHaveLength(2);
    });

    it('应该处理获取适配器列表失败的情况', async () => {
      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Failed to get adapters')
      );

      await expect(AdapterService.getAdapters()).rejects.toThrow(
        'Failed to get adapters'
      );
    });

    it('应该处理网络错误', async () => {
      const error = new Error('Network error');
      mockInvoke.mockRejectedValue(error);

      await expect(AdapterService.getAdapters()).rejects.toThrow('Network error');
      expect(console.error).toHaveBeenCalled();
    });

    it('应该处理空适配器列表', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse([]));

      const result = await AdapterService.getAdapters();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  // ================================
  // 安装适配器测试
  // ================================
  describe('installAdapter', () => {
    it('应该成功安装适配器', async () => {
      const request: AdapterInstallRequest = {
        adapter_id: 'test-adapter',
        source: 'market',
        force: false,
        options: {},
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await AdapterService.installAdapter(request);

      expect(mockInvoke).toHaveBeenCalledWith('install_adapter', { request });
      expect(result).toBe(true);
    });

    it('应该处理强制安装', async () => {
      const request: AdapterInstallRequest = {
        adapter_id: 'test-adapter',
        source: 'market',
        force: true,
        options: { overwrite: true },
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await AdapterService.installAdapter(request);

      expect(result).toBe(true);
    });

    it('应该处理安装失败', async () => {
      const request: AdapterInstallRequest = {
        adapter_id: 'test-adapter',
        source: 'market',
        force: false,
        options: {},
      };

      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Installation failed')
      );

      await expect(AdapterService.installAdapter(request)).rejects.toThrow(
        'Installation failed'
      );
    });

    it('应该处理无效的安装源', async () => {
      const request: AdapterInstallRequest = {
        adapter_id: 'test-adapter',
        source: 'invalid-source',
        force: false,
        options: {},
      };

      mockInvoke.mockRejectedValue(new Error('Invalid source'));

      await expect(AdapterService.installAdapter(request)).rejects.toThrow();
    });
  });

  // ================================
  // 卸载适配器测试
  // ================================
  describe('uninstallAdapter', () => {
    it('应该成功卸载适配器', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await AdapterService.uninstallAdapter('test-adapter');

      expect(mockInvoke).toHaveBeenCalledWith('uninstall_adapter', {
        adapterId: 'test-adapter',
      });
      expect(result).toBe(true);
    });

    it('应该处理卸载失败', async () => {
      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Uninstallation failed')
      );

      await expect(
        AdapterService.uninstallAdapter('test-adapter')
      ).rejects.toThrow('Uninstallation failed');
    });

    it('应该处理卸载不存在的适配器', async () => {
      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Adapter not found')
      );

      await expect(
        AdapterService.uninstallAdapter('non-existent')
      ).rejects.toThrow('Adapter not found');
    });
  });

  // ================================
  // 执行适配器操作测试
  // ================================
  describe('executeAdapter', () => {
    it('应该成功执行适配器操作', async () => {
      const request: AdapterExecutionRequest = {
        adapter_id: 'test-adapter',
        action: 'process',
        params: { text: 'Hello' },
      };

      const mockResult = { output: 'Processed: Hello' };
      mockInvoke.mockResolvedValue(createMockApiResponse(mockResult));

      const result = await AdapterService.executeAdapter(request);

      expect(mockInvoke).toHaveBeenCalledWith('execute_adapter', { request });
      expect(result).toEqual(mockResult);
    });

    it('应该支持超时配置', async () => {
      const request: AdapterExecutionRequest = {
        adapter_id: 'test-adapter',
        action: 'process',
        params: { text: 'Hello' },
        timeout: 5000,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse({ success: true }));

      await AdapterService.executeAdapter(request);

      expect(mockInvoke).toHaveBeenCalledWith('execute_adapter', { request });
    });

    it('应该处理执行失败', async () => {
      const request: AdapterExecutionRequest = {
        adapter_id: 'test-adapter',
        action: 'process',
        params: {},
      };

      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Execution failed')
      );

      await expect(AdapterService.executeAdapter(request)).rejects.toThrow(
        'Execution failed'
      );
    });

    it('应该处理超时错误', async () => {
      const request: AdapterExecutionRequest = {
        adapter_id: 'test-adapter',
        action: 'long-operation',
        params: {},
        timeout: 100,
      };

      mockInvoke.mockRejectedValue(new Error('Timeout'));

      await expect(AdapterService.executeAdapter(request)).rejects.toThrow(
        'Timeout'
      );
    });
  });

  // ================================
  // 适配器配置测试
  // ================================
  describe('getAdapterConfig', () => {
    it('应该成功获取适配器配置', async () => {
      const mockConfig = {
        timeout: 30000,
        enabled: true,
        retries: 3,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockConfig));

      const result = await AdapterService.getAdapterConfig('test-adapter');

      expect(mockInvoke).toHaveBeenCalledWith('get_adapter_config', {
        adapterId: 'test-adapter',
      });
      expect(result).toEqual(mockConfig);
    });

    it('应该处理获取配置失败', async () => {
      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Failed to get config')
      );

      await expect(
        AdapterService.getAdapterConfig('test-adapter')
      ).rejects.toThrow('Failed to get config');
    });
  });

  describe('updateAdapterConfig', () => {
    it('应该成功更新适配器配置', async () => {
      const request: AdapterConfigUpdateRequest = {
        adapter_id: 'test-adapter',
        config: { timeout: 60000 },
        merge: true,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await AdapterService.updateAdapterConfig(request);

      expect(mockInvoke).toHaveBeenCalledWith('update_adapter_config', {
        request,
      });
      expect(result).toBe(true);
    });

    it('应该支持完全替换配置', async () => {
      const request: AdapterConfigUpdateRequest = {
        adapter_id: 'test-adapter',
        config: { enabled: false },
        merge: false,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await AdapterService.updateAdapterConfig(request);

      expect(result).toBe(true);
    });

    it('应该处理更新配置失败', async () => {
      const request: AdapterConfigUpdateRequest = {
        adapter_id: 'test-adapter',
        config: {},
        merge: true,
      };

      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Failed to update config')
      );

      await expect(
        AdapterService.updateAdapterConfig(request)
      ).rejects.toThrow('Failed to update config');
    });
  });

  // ================================
  // 搜索适配器测试
  // ================================
  describe('searchAdapters', () => {
    it('应该成功搜索适配器', async () => {
      const request: AdapterSearchRequest = {
        query: 'text',
        page: 1,
        page_size: 10,
      };

      const mockResults = {
        items: [createMockAdapterMetadata({ name: 'Text Processor' })],
        total: 1,
        page: 1,
        page_size: 10,
        total_pages: 1,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockResults));

      const result = await AdapterService.searchAdapters(request);

      expect(mockInvoke).toHaveBeenCalledWith('search_adapters', { request });
      expect(result).toEqual(mockResults);
      expect(result.items).toHaveLength(1);
    });

    it('应该支持高级搜索过滤', async () => {
      const request: AdapterSearchRequest = {
        query: 'image',
        adapter_type: AdapterType.Intelligent,
        category: 'vision',
        tags: ['image', 'classification'],
        price_min: 0,
        price_max: 100,
        rating_min: 4.0,
        free_only: true,
        featured_only: false,
        page: 1,
        page_size: 20,
        sort_by: 'rating',
        sort_order: 'desc',
      };

      mockInvoke.mockResolvedValue(
        createMockApiResponse({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          total_pages: 0,
        })
      );

      await AdapterService.searchAdapters(request);

      expect(mockInvoke).toHaveBeenCalledWith('search_adapters', { request });
    });

    it('应该处理搜索失败', async () => {
      const request: AdapterSearchRequest = {
        query: 'test',
      };

      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Search failed')
      );

      await expect(AdapterService.searchAdapters(request)).rejects.toThrow(
        'Search failed'
      );
    });

    it('应该处理空搜索结果', async () => {
      const request: AdapterSearchRequest = {
        query: 'nonexistent',
      };

      const emptyResults = {
        items: [],
        total: 0,
        page: 1,
        page_size: 10,
        total_pages: 0,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(emptyResults));

      const result = await AdapterService.searchAdapters(request);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ================================
  // 获取适配器详情测试
  // ================================
  describe('getAdapterDetails', () => {
    it('应该成功获取适配器详情', async () => {
      const mockMetadata = createMockAdapterMetadata({
        id: 'test-adapter',
        name: 'Test Adapter',
      });

      mockInvoke.mockResolvedValue(createMockApiResponse(mockMetadata));

      const result = await AdapterService.getAdapterDetails('test-adapter');

      expect(mockInvoke).toHaveBeenCalledWith('get_adapter_details', {
        adapterId: 'test-adapter',
      });
      expect(result).toEqual(mockMetadata);
    });

    it('应该处理获取详情失败', async () => {
      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Adapter not found')
      );

      await expect(
        AdapterService.getAdapterDetails('nonexistent')
      ).rejects.toThrow('Adapter not found');
    });
  });

  // ================================
  // 加载/卸载适配器测试
  // ================================
  describe('loadAdapter', () => {
    it('应该成功加载适配器', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await AdapterService.loadAdapter('test-adapter');

      expect(mockInvoke).toHaveBeenCalledWith('load_adapter', {
        adapterId: 'test-adapter',
      });
      expect(result).toBe(true);
    });

    it('应该处理加载失败', async () => {
      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Failed to load adapter')
      );

      await expect(AdapterService.loadAdapter('test-adapter')).rejects.toThrow(
        'Failed to load adapter'
      );
    });
  });

  describe('unloadAdapter', () => {
    it('应该成功卸载适配器', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await AdapterService.unloadAdapter('test-adapter');

      expect(mockInvoke).toHaveBeenCalledWith('unload_adapter', {
        adapterId: 'test-adapter',
      });
      expect(result).toBe(true);
    });

    it('应该处理卸载失败', async () => {
      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Failed to unload adapter')
      );

      await expect(
        AdapterService.unloadAdapter('test-adapter')
      ).rejects.toThrow('Failed to unload adapter');
    });
  });

  // ================================
  // 获取适配器状态测试
  // ================================
  describe('getAdapterStatus', () => {
    it('应该成功获取所有适配器状态', async () => {
      const mockStatus = {
        adapters: [
          { id: 'adapter-1', status: AdapterStatus.Loaded },
          { id: 'adapter-2', status: AdapterStatus.Unloaded },
        ],
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockStatus));

      const result = await AdapterService.getAdapterStatus();

      expect(mockInvoke).toHaveBeenCalledWith('get_adapter_status', {
        adapterId: undefined,
      });
      expect(result).toEqual(mockStatus);
    });

    it('应该成功获取单个适配器状态', async () => {
      const mockStatus = {
        id: 'test-adapter',
        status: AdapterStatus.Loaded,
        memory_usage: 512000,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockStatus));

      const result = await AdapterService.getAdapterStatus('test-adapter');

      expect(mockInvoke).toHaveBeenCalledWith('get_adapter_status', {
        adapterId: 'test-adapter',
      });
      expect(result).toEqual(mockStatus);
    });

    it('应该处理获取状态失败', async () => {
      mockInvoke.mockResolvedValue(
        createMockErrorResponse('Failed to get status')
      );

      await expect(
        AdapterService.getAdapterStatus('test-adapter')
      ).rejects.toThrow('Failed to get status');
    });
  });

  // ================================
  // 工具方法测试
  // ================================
  describe('Utility Methods', () => {
    describe('isCompatible', () => {
      it('应该正确判断兼容性', () => {
        const metadata = createMockAdapterMetadata({
          compatibility: {
            base_models: ['gpt-4'],
            frameworks: {},
            operating_systems: ['linux', 'windows', 'macos'],
            python_versions: ['3.8+'],
          },
        });

        // Mock navigator.platform
        Object.defineProperty(window.navigator, 'platform', {
          writable: true,
          value: 'Linux x86_64',
        });

        const result = AdapterService.isCompatible(metadata);

        expect(result).toBe(true);
      });

      it('应该识别不兼容的系统', () => {
        const metadata = createMockAdapterMetadata({
          compatibility: {
            base_models: [],
            frameworks: {},
            operating_systems: ['windows'],
            python_versions: [],
          },
        });

        Object.defineProperty(window.navigator, 'platform', {
          writable: true,
          value: 'MacIntel',
        });

        const result = AdapterService.isCompatible(metadata);

        expect(result).toBe(false);
      });
    });

    describe('formatSize', () => {
      it('应该正确格式化字节大小', () => {
        expect(AdapterService.formatSize(500)).toBe('500.0 B');
        expect(AdapterService.formatSize(1024)).toBe('1.0 KB');
        expect(AdapterService.formatSize(1024 * 1024)).toBe('1.0 MB');
        expect(AdapterService.formatSize(1024 * 1024 * 1024)).toBe('1.0 GB');
      });

      it('应该处理未知大小', () => {
        expect(AdapterService.formatSize()).toBe('Unknown');
        expect(AdapterService.formatSize(undefined)).toBe('Unknown');
      });

      it('应该处理小数点', () => {
        expect(AdapterService.formatSize(1536)).toBe('1.5 KB');
        expect(AdapterService.formatSize(2560 * 1024)).toBe('2.5 MB');
      });
    });

    describe('formatStatus', () => {
      it('应该正确格式化状态', () => {
        expect(AdapterService.formatStatus(AdapterStatus.Loaded)).toBe(
          '已加载'
        );
        expect(AdapterService.formatStatus(AdapterStatus.Unloaded)).toBe(
          '未加载'
        );
        expect(AdapterService.formatStatus(AdapterStatus.Loading)).toBe(
          '加载中'
        );
        expect(AdapterService.formatStatus(AdapterStatus.Error)).toBe('错误');
      });
    });

    describe('getStatusColor', () => {
      it('应该返回正确的状态颜色', () => {
        expect(AdapterService.getStatusColor(AdapterStatus.Loaded)).toBe(
          'green'
        );
        expect(AdapterService.getStatusColor(AdapterStatus.Unloaded)).toBe(
          'gray'
        );
        expect(AdapterService.getStatusColor(AdapterStatus.Error)).toBe('red');
        expect(AdapterService.getStatusColor(AdapterStatus.Loading)).toBe(
          'blue'
        );
      });
    });

    describe('validateInstallRequest', () => {
      it('应该验证有效的安装请求', () => {
        const request: AdapterInstallRequest = {
          adapter_id: 'test-adapter',
          source: 'market',
          force: false,
          options: {},
        };

        const errors = AdapterService.validateInstallRequest(request);

        expect(errors).toHaveLength(0);
      });

      it('应该检测空的适配器ID', () => {
        const request: AdapterInstallRequest = {
          adapter_id: '',
          source: 'market',
          force: false,
          options: {},
        };

        const errors = AdapterService.validateInstallRequest(request);

        expect(errors).toContain('适配器ID不能为空');
      });

      it('应该检测空的安装源', () => {
        const request: AdapterInstallRequest = {
          adapter_id: 'test',
          source: '',
          force: false,
          options: {},
        };

        const errors = AdapterService.validateInstallRequest(request);

        expect(errors).toContain('安装源不能为空');
      });

      it('应该检测无效的安装源', () => {
        const request: AdapterInstallRequest = {
          adapter_id: 'test',
          source: 'invalid',
          force: false,
          options: {},
        };

        const errors = AdapterService.validateInstallRequest(request);

        expect(errors).toContain('无效的安装源');
      });

      it('应该返回多个错误', () => {
        const request: AdapterInstallRequest = {
          adapter_id: '  ',
          source: 'invalid',
          force: false,
          options: {},
        };

        const errors = AdapterService.validateInstallRequest(request);

        expect(errors.length).toBeGreaterThan(1);
      });
    });

    describe('createDefaultSearchRequest', () => {
      it('应该创建默认搜索请求', () => {
        const request = AdapterService.createDefaultSearchRequest('test');

        expect(request).toEqual({
          query: 'test',
          page: 1,
          page_size: 20,
          sort_by: 'created_at',
          sort_order: 'desc',
        });
      });

      it('应该接受自定义查询', () => {
        const request = AdapterService.createDefaultSearchRequest('custom query');

        expect(request.query).toBe('custom query');
        expect(request.page).toBe(1);
        expect(request.page_size).toBe(20);
      });
    });
  });

  // ================================
  // 边界情况和错误处理
  // ================================
  describe('Edge Cases and Error Handling', () => {
    it('应该处理网络断开连接', async () => {
      mockInvoke.mockRejectedValue(new Error('Network unavailable'));

      await expect(AdapterService.getAdapters()).rejects.toThrow(
        'Network unavailable'
      );
    });

    it('应该处理超时', async () => {
      mockInvoke.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
          )
      );

      await expect(AdapterService.getAdapters()).rejects.toThrow('Timeout');
    });

    it('应该处理无效的响应格式', async () => {
      mockInvoke.mockResolvedValue(null);

      await expect(AdapterService.getAdapters()).rejects.toThrow();
    });

    it('应该处理缺少data字段的响应', async () => {
      mockInvoke.mockResolvedValue({ success: true });

      await expect(AdapterService.getAdapters()).rejects.toThrow();
    });

    it('应该记录控制台错误', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockInvoke.mockRejectedValue(new Error('Test error'));

      await expect(AdapterService.getAdapters()).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error getting adapters:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  // ================================
  // 性能测试
  // ================================
  describe('Performance', () => {
    it('应该能够处理大量适配器', async () => {
      const largeAdapterList = Array.from({ length: 1000 }, (_, i) =>
        createMockAdapter({ name: `adapter-${i}` })
      );

      mockInvoke.mockResolvedValue(createMockApiResponse(largeAdapterList));

      const start = Date.now();
      const result = await AdapterService.getAdapters();
      const duration = Date.now() - start;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该能够处理并发请求', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse([]));

      const promises = Array.from({ length: 10 }, () =>
        AdapterService.getAdapters()
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockInvoke).toHaveBeenCalledTimes(10);
    });
  });
});

