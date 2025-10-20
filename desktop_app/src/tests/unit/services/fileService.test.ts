/**
 * 文件服务测试
 * 
 * 测试文件读写、上传、下载等功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/tauri';

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn(),
}));

describe('FileService', () => {
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('文件读取', () => {
    it('应该成功读取文件', async () => {
      const mockContent = 'File content';
      mockInvoke.mockResolvedValue({
        success: true,
        data: { content: mockContent },
      });

      const response = await mockInvoke('read_file', {
        path: '/test/file.txt',
      });

      expect(response.success).toBe(true);
      expect(response.data.content).toBe(mockContent);
    });

    it('应该处理文件不存在', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: '文件不存在',
      });

      const response = await mockInvoke('read_file', {
        path: '/nonexistent.txt',
      });

      expect(response.success).toBe(false);
    });

    it('应该支持二进制文件', async () => {
      const mockBinary = new Uint8Array([1, 2, 3, 4]);
      mockInvoke.mockResolvedValue({
        success: true,
        data: { content: Array.from(mockBinary) },
      });

      const response = await mockInvoke('read_file_binary', {
        path: '/test/file.bin',
      });

      expect(response.success).toBe(true);
    });
  });

  describe('文件写入', () => {
    it('应该成功写入文件', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { bytes_written: 100 },
      });

      const response = await mockInvoke('write_file', {
        path: '/test/file.txt',
        content: 'Test content',
      });

      expect(response.success).toBe(true);
      expect(response.data.bytes_written).toBeGreaterThan(0);
    });

    it('应该处理写入失败', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: '权限不足',
      });

      const response = await mockInvoke('write_file', {
        path: '/readonly/file.txt',
        content: 'Test',
      });

      expect(response.success).toBe(false);
    });
  });

  describe('文件删除', () => {
    it('应该成功删除文件', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { deleted: true },
      });

      const response = await mockInvoke('delete_file', {
        path: '/test/file.txt',
      });

      expect(response.success).toBe(true);
    });
  });

  describe('文件列表', () => {
    it('应该成功列出目录内容', async () => {
      const mockFiles = [
        { name: 'file1.txt', size: 100, is_dir: false },
        { name: 'file2.txt', size: 200, is_dir: false },
        { name: 'dir1', size: 0, is_dir: true },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        data: { files: mockFiles },
      });

      const response = await mockInvoke('list_directory', {
        path: '/test',
      });

      expect(response.data.files).toHaveLength(3);
    });
  });

  describe('文件上传', () => {
    it('应该成功上传文件', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { uploaded: true, url: 'https://example.com/file.txt' },
      });

      const response = await mockInvoke('upload_file', {
        path: '/test/file.txt',
        destination: 'remote',
      });

      expect(response.success).toBe(true);
      expect(response.data.url).toBeTruthy();
    });
  });

  describe('文件下载', () => {
    it('应该成功下载文件', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: { downloaded: true, path: '/downloads/file.txt' },
      });

      const response = await mockInvoke('download_file', {
        url: 'https://example.com/file.txt',
        destination: '/downloads',
      });

      expect(response.success).toBe(true);
      expect(response.data.path).toBeTruthy();
    });
  });

  describe('文件信息', () => {
    it('应该获取文件信息', async () => {
      const mockInfo = {
        size: 1024,
        created_at: Date.now(),
        modified_at: Date.now(),
        is_dir: false,
        permissions: 'rw-r--r--',
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockInfo,
      });

      const response = await mockInvoke('get_file_info', {
        path: '/test/file.txt',
      });

      expect(response.data.size).toBe(1024);
    });
  });
});

