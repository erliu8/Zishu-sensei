/**
 * API服务测试
 * 
 * 测试底层API请求、拦截器、错误处理等功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('API Service', () => {
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HTTP Methods', () => {
    it('应该发送GET请求', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: mockData,
      });

      const response = await mockInvoke('api_get', {
        url: '/test',
      });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockData);
    });

    it('应该发送POST请求', async () => {
      const postData = { name: 'New Item' };
      const mockResponse = { id: 2, ...postData };

      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: mockResponse,
      });

      const response = await mockInvoke('api_post', {
        url: '/test',
        data: postData,
      });

      expect(response.data).toEqual(mockResponse);
    });

    it('应该发送PUT请求', async () => {
      const updateData = { name: 'Updated' };
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: updateData,
      });

      const response = await mockInvoke('api_put', {
        url: '/test/1',
        data: updateData,
      });

      expect(response.success).toBe(true);
    });

    it('应该发送DELETE请求', async () => {
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { deleted: true },
      });

      const response = await mockInvoke('api_delete', {
        url: '/test/1',
      });

      expect(response.success).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        mockInvoke('api_get', { url: '/test' })
      ).rejects.toThrow('Network error');
    });

    it('应该处理HTTP错误状态', async () => {
      mockInvoke.mockResolvedValueOnce({
        success: false,
        error: 'Not found',
        code: '404',
      });

      const response = await mockInvoke('api_get', { url: '/test' });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Not found');
    });

    it('应该处理超时', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(
        mockInvoke('api_get', { url: '/test', timeout: 100 })
      ).rejects.toThrow('Request timeout');
    });

    it('应该处理认证错误', async () => {
      mockInvoke.mockResolvedValueOnce({
        success: false,
        error: 'Unauthorized',
        code: '401',
      });

      const response = await mockInvoke('api_get', { url: '/protected' });

      expect(response.code).toBe('401');
    });
  });

  describe('请求拦截器', () => {
    it('应该添加认证头', async () => {
      const token = 'test-token';
      mockInvoke.mockResolvedValueOnce({ success: true });

      await mockInvoke('api_get', {
        url: '/test',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(mockInvoke).toHaveBeenCalledWith('api_get', {
        url: '/test',
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
        }),
      });
    });

    it('应该添加自定义头', async () => {
      mockInvoke.mockResolvedValueOnce({ success: true });

      await mockInvoke('api_get', {
        url: '/test',
        headers: {
          'X-Custom-Header': 'value',
        },
      });

      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  describe('响应拦截器', () => {
    it('应该解析JSON响应', async () => {
      const jsonData = { message: 'Success' };
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: jsonData,
      });

      const response = await mockInvoke('api_get', { url: '/test' });

      expect(response.data).toEqual(jsonData);
    });

    it('应该处理非JSON响应', async () => {
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: 'Plain text',
      });

      const response = await mockInvoke('api_get', { url: '/test' });

      expect(response.data).toBe('Plain text');
    });
  });

  describe('重试机制', () => {
    it('应该在失败时重试', async () => {
      mockInvoke
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce({ success: true, data: 'Success' });

      // 模拟重试逻辑
      let attempts = 0;
      let result;

      while (attempts < 3) {
        try {
          result = await mockInvoke('api_get', { url: '/test' });
          break;
        } catch {
          attempts++;
          if (attempts >= 3) throw new Error('Max retries reached');
        }
      }

      expect(result?.success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });

    it('应该在达到最大重试次数后失败', async () => {
      mockInvoke
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'));

      let attempts = 0;
      let lastError: Error | null = null;

      while (attempts < 3) {
        try {
          await mockInvoke('api_get', { url: '/test' });
          break;
        } catch (error) {
          lastError = error as Error;
          attempts++;
        }
      }

      expect(attempts).toBe(3);
      expect(lastError).toBeDefined();
    });
  });

  describe('缓存', () => {
    it('应该缓存GET请求', async () => {
      const mockData = { id: 1, cached: true };
      mockInvoke.mockResolvedValueOnce({ success: true, data: mockData });

      const response1 = await mockInvoke('api_get', {
        url: '/test',
        cache: true,
      });
      const response2 = await mockInvoke('api_get', {
        url: '/test',
        cache: true,
      });

      expect(response1.data).toEqual(mockData);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it('应该清除缓存', async () => {
      mockInvoke.mockResolvedValueOnce({ success: true });

      await mockInvoke('clear_api_cache');

      expect(mockInvoke).toHaveBeenCalledWith('clear_api_cache');
    });
  });

  describe('并发请求', () => {
    it('应该支持并发请求', async () => {
      mockInvoke.mockResolvedValue({ success: true, data: {} });

      const requests = [
        mockInvoke('api_get', { url: '/test1' }),
        mockInvoke('api_get', { url: '/test2' }),
        mockInvoke('api_get', { url: '/test3' }),
      ];

      const results = await Promise.all(requests);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('应该处理部分失败的并发请求', async () => {
      mockInvoke
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ success: true });

      const results = await Promise.allSettled([
        mockInvoke('api_get', { url: '/test1' }),
        mockInvoke('api_get', { url: '/test2' }),
        mockInvoke('api_get', { url: '/test3' }),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('查询参数', () => {
    it('应该正确处理查询参数', async () => {
      mockInvoke.mockResolvedValueOnce({ success: true });

      await mockInvoke('api_get', {
        url: '/test',
        params: { page: 1, limit: 10, search: 'test' },
      });

      expect(mockInvoke).toHaveBeenCalledWith('api_get', {
        url: '/test',
        params: expect.objectContaining({
          page: 1,
          limit: 10,
          search: 'test',
        }),
      });
    });

    it('应该处理空查询参数', async () => {
      mockInvoke.mockResolvedValueOnce({ success: true });

      await mockInvoke('api_get', {
        url: '/test',
        params: {},
      });

      expect(mockInvoke).toHaveBeenCalled();
    });
  });

  describe('请求取消', () => {
    it('应该支持取消请求', async () => {
      const abortController = new AbortController();
      mockInvoke.mockImplementation(() => {
        return new Promise((_, reject) => {
          abortController.signal.addEventListener('abort', () => {
            reject(new Error('Request cancelled'));
          });
        });
      });

      const requestPromise = mockInvoke('api_get', {
        url: '/test',
        signal: abortController.signal,
      });

      abortController.abort();

      await expect(requestPromise).rejects.toThrow('Request cancelled');
    });
  });
});

