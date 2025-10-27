/**
 * useFileManager Hooks 测试套件
 * 
 * 测试文件管理相关的所有 Hooks，包括文件上传、下载、搜索等
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useFileManager,
  useFileStats,
  useFileDetail,
} from '@/hooks/useFileManager'
import type { FileInfo, FileStats } from '@/types/file'
import { mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// Mock objects need to be hoisted to work with vi.mock
const { mockFileService } = vi.hoisted(() => ({
  mockFileService: {
    listFiles: vi.fn(),
    getFile: vi.fn(),
    uploadFileObject: vi.fn(),
    deleteFile: vi.fn(),
    batchDelete: vi.fn(),
    searchFiles: vi.fn(),
    getFileStats: vi.fn(),
  },
}))

vi.mock('@/services/fileService', () => ({
  fileService: mockFileService,
}))

// ==================== 测试数据 ====================

const mockFiles: FileInfo[] = [
  {
    id: 'file-1',
    name: 'test1.txt',
    original_name: 'test1.txt',
    file_path: '/path/to/file1',
    file_size: 1024,
    file_type: 'text',
    mime_type: 'text/plain',
    hash: 'hash1',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    accessed_at: '2025-01-01T00:00:00Z',
    is_deleted: false,
    conversation_id: 'conv-1',
    message_id: 'msg-1',
    tags: 'test,document',
  },
  {
    id: 'file-2',
    name: 'image.png',
    original_name: 'image.png',
    file_path: '/path/to/image.png',
    file_size: 2048,
    file_type: 'image',
    mime_type: 'image/png',
    hash: 'hash2',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T00:00:00Z',
    accessed_at: '2025-01-02T00:00:00Z',
    is_deleted: false,
    tags: 'test,image',
  },
]

const mockFileStats: FileStats = {
  total_files: 100,
  total_size: 1024 * 1024 * 10, // 10MB
  total_deleted: 5,
  by_type: [
    { file_type: 'text', count: 50, total_size: 1024 * 1024 * 5 },
    { file_type: 'image', count: 30, total_size: 1024 * 1024 * 3 },
    { file_type: 'pdf', count: 20, total_size: 1024 * 1024 * 2 },
  ],
}

// ==================== 测试套件 ====================

describe('useFileManager Hook', () => {
  const consoleMock = mockConsole()

  beforeEach(() => {
    consoleMock.mockAll()
    vi.clearAllMocks()
    
    mockFileService.listFiles.mockResolvedValue(mockFiles)
    mockFileService.uploadFileObject.mockResolvedValue({
      file_info: mockFiles[0],
      upload_url: 'https://example.com/upload',
    })
    mockFileService.deleteFile.mockResolvedValue(undefined)
    mockFileService.batchDelete.mockResolvedValue(undefined)
    mockFileService.searchFiles.mockResolvedValue(mockFiles)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础功能', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useFileManager())

      expect(result.current.files).toEqual([])
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(null)
      expect(result.current.uploadProgress).toEqual([])
      expect(typeof result.current.loadFiles).toBe('function')
      expect(typeof result.current.uploadFile).toBe('function')
    })

    it('应该加载文件列表', async () => {
      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
        expect(result.current.loading).toBe(false)
      })

      expect(mockFileService.listFiles).toHaveBeenCalledWith(undefined)
    })

    it('应该支持过滤选项', async () => {
      const filterOptions = {
        file_type: 'text',
      }

      const { result } = renderHook(() => useFileManager(filterOptions))

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      expect(mockFileService.listFiles).toHaveBeenCalledWith(filterOptions)
    })

    it('应该处理加载错误', async () => {
      const testError = new Error('Failed to load files')
      mockFileService.listFiles.mockRejectedValue(testError)

      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.error).toBe('加载文件失败')
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('文件上传', () => {
    it('应该上传单个文件', async () => {
      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      const testFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })

      let uploadResult: any
      await act(async () => {
        uploadResult = await result.current.uploadFile(testFile)
      })

      expect(mockFileService.uploadFileObject).toHaveBeenCalledWith(
        testFile,
        undefined
      )
      expect(uploadResult.file_info).toEqual(mockFiles[0])
    })

    it('应该上传文件时显示进度', async () => {
      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      const testFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })

      // 延迟上传完成
      let resolveUpload: (value: any) => void
      const uploadPromise = new Promise((resolve) => {
        resolveUpload = resolve
      })
      mockFileService.uploadFileObject.mockReturnValue(uploadPromise)

      const uploadTask = act(async () => {
        await result.current.uploadFile(testFile)
      })

      // 检查进度状态
      await waitFor(() => {
        expect(result.current.uploadProgress).toHaveLength(1)
        expect(result.current.uploadProgress[0].file_name).toBe('test.txt')
        expect(result.current.uploadProgress[0].status).toBe('uploading')
      })

      // 完成上传
      await act(async () => {
        resolveUpload!({
          file_info: mockFiles[0],
          upload_url: 'https://example.com/upload',
        })
      })

      await uploadTask

      // 检查完成状态
      await waitFor(() => {
        const progress = result.current.uploadProgress.find(
          (p) => p.file_name === 'test.txt'
        )
        expect(progress?.status).toBe('completed')
        expect(progress?.progress).toBe(100)
      })
    })

    it('应该处理上传错误', async () => {
      const testError = new Error('Upload failed')
      mockFileService.uploadFileObject.mockRejectedValue(testError)

      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      const testFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })

      await expect(
        act(async () => {
          await result.current.uploadFile(testFile)
        })
      ).rejects.toThrow('Upload failed')

      // 检查错误状态
      const progress = result.current.uploadProgress.find(
        (p) => p.file_name === 'test.txt'
      )
      expect(progress?.status).toBe('error')
      expect(progress?.error).toBe('Upload failed')
    })

    it('应该批量上传文件', async () => {
      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      const files = [
        new File(['test1'], 'test1.txt', { type: 'text/plain' }),
        new File(['test2'], 'test2.txt', { type: 'text/plain' }),
      ]

      mockFileService.uploadFileObject
        .mockResolvedValueOnce({
          file_info: mockFiles[0],
          upload_url: 'https://example.com/upload1',
        })
        .mockResolvedValueOnce({
          file_info: mockFiles[1],
          upload_url: 'https://example.com/upload2',
        })

      let results: any[] = []
      await act(async () => {
        results = await result.current.uploadFiles(files)
      })

      expect(results).toHaveLength(2)
      expect(mockFileService.uploadFileObject).toHaveBeenCalledTimes(2)
    })

    it('应该支持带选项的上传', async () => {
      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      const testFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })

      const uploadOptions = {
        conversationId: 'conv-1',
        messageId: 'msg-1',
        tags: 'test,document',
        description: 'Test file',
      }

      await act(async () => {
        await result.current.uploadFile(testFile, uploadOptions)
      })

      expect(mockFileService.uploadFileObject).toHaveBeenCalledWith(
        testFile,
        uploadOptions
      )
    })
  })

  describe('文件删除', () => {
    it('应该删除单个文件', async () => {
      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      await act(async () => {
        await result.current.deleteFile('file-1')
      })

      expect(mockFileService.deleteFile).toHaveBeenCalledWith('file-1')
      // 应该重新加载文件列表
      expect(mockFileService.listFiles).toHaveBeenCalledTimes(2)
    })

    it('应该批量删除文件', async () => {
      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      const fileIds = ['file-1', 'file-2']

      await act(async () => {
        await result.current.batchDelete(fileIds)
      })

      expect(mockFileService.batchDelete).toHaveBeenCalledWith(fileIds)
      // 应该重新加载文件列表
      expect(mockFileService.listFiles).toHaveBeenCalledTimes(2)
    })

    it('应该处理删除错误', async () => {
      const testError = new Error('Delete failed')
      mockFileService.deleteFile.mockRejectedValue(testError)

      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      await expect(
        act(async () => {
          await result.current.deleteFile('file-1')
        })
      ).rejects.toThrow('Delete failed')

      expect(result.current.error).toBe('删除失败')
    })
  })

  describe('文件搜索', () => {
    it('应该搜索文件', async () => {
      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      const searchOptions = {
        keyword: 'test',
        file_type: 'text',
      }

      await act(async () => {
        await result.current.searchFiles(searchOptions)
      })

      expect(mockFileService.searchFiles).toHaveBeenCalledWith(searchOptions)
    })

    it('应该处理搜索错误', async () => {
      const testError = new Error('Search failed')
      mockFileService.searchFiles.mockRejectedValue(testError)

      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      await act(async () => {
        await result.current.searchFiles({ keyword: 'test' })
      })

      expect(result.current.error).toBe('搜索失败')
    })
  })

  describe('上传进度管理', () => {
    it('应该清除上传进度', async () => {
      const { result } = renderHook(() => useFileManager())

      await waitFor(() => {
        expect(result.current.files).toEqual(mockFiles)
      })

      const testFile = new File(['test content'], 'test.txt', {
        type: 'text/plain',
      })

      await act(async () => {
        await result.current.uploadFile(testFile)
      })

      expect(result.current.uploadProgress).toHaveLength(1)

      act(() => {
        result.current.clearUploadProgress()
      })

      expect(result.current.uploadProgress).toHaveLength(0)
    })
  })
})

describe('useFileStats Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFileService.getFileStats.mockResolvedValue(mockFileStats)
  })

  describe('文件统计', () => {
    it('应该加载文件统计信息', async () => {
      const { result } = renderHook(() => useFileStats())

      await waitFor(() => {
        expect(result.current.stats).toEqual(mockFileStats)
        expect(result.current.loading).toBe(false)
      })

      expect(mockFileService.getFileStats).toHaveBeenCalled()
    })

    it('应该处理加载错误', async () => {
      const testError = new Error('Failed to load stats')
      mockFileService.getFileStats.mockRejectedValue(testError)

      const { result } = renderHook(() => useFileStats())

      await waitFor(() => {
        expect(result.current.error).toBe('加载统计失败')
        expect(result.current.loading).toBe(false)
      })
    })

    it('应该重新加载统计', async () => {
      const { result } = renderHook(() => useFileStats())

      await waitFor(() => {
        expect(result.current.stats).toEqual(mockFileStats)
      })

      mockFileService.getFileStats.mockClear()

      await act(async () => {
        await result.current.reload()
      })

      expect(mockFileService.getFileStats).toHaveBeenCalledTimes(1)
    })

    it('应该获取统计信息', async () => {
      const { result } = renderHook(() => useFileStats())

      await waitFor(() => {
        const stats = result.current.stats
        expect(stats?.total_files).toBe(100)
        expect(stats?.total_size).toBe(1024 * 1024 * 10)
      })
    })
  })
})

describe('useFileDetail Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFileService.getFile.mockResolvedValue(mockFiles[0])
  })

  describe('文件详情', () => {
    it('应该加载文件详情', async () => {
      const { result } = renderHook(() => useFileDetail('file-1'))

      await waitFor(() => {
        expect(result.current.file).toEqual(mockFiles[0])
        expect(result.current.loading).toBe(false)
      })

      expect(mockFileService.getFile).toHaveBeenCalledWith('file-1')
    })

    it('应该处理空文件ID', () => {
      const { result } = renderHook(() => useFileDetail(null))

      expect(result.current.file).toBe(null)
      expect(mockFileService.getFile).not.toHaveBeenCalled()
    })

    it('应该在文件ID变化时重新加载', async () => {
      const { result, rerender } = renderHook(
        (fileId: string | null) => useFileDetail(fileId),
        {
          initialProps: 'file-1',
        }
      )

      await waitFor(() => {
        expect(result.current.file).toEqual(mockFiles[0])
      })

      mockFileService.getFile.mockClear()
      mockFileService.getFile.mockResolvedValue(mockFiles[1])

      rerender('file-2')

      await waitFor(() => {
        expect(result.current.file).toEqual(mockFiles[1])
      })

      expect(mockFileService.getFile).toHaveBeenCalledWith('file-2')
    })

    it('应该处理加载错误', async () => {
      const testError = new Error('Failed to load file')
      mockFileService.getFile.mockRejectedValue(testError)

      const { result } = renderHook(() => useFileDetail('file-1'))

      await waitFor(() => {
        expect(result.current.error).toBe('加载文件失败')
        expect(result.current.loading).toBe(false)
      })
    })
  })
})

// ==================== 集成测试 ====================

describe('FileManager Hooks 集成测试', () => {
  const consoleMock = mockConsole()

  beforeEach(() => {
    consoleMock.mockAll()
    vi.clearAllMocks()
    
    mockFileService.listFiles.mockResolvedValue(mockFiles)
    mockFileService.uploadFileObject.mockResolvedValue({
      file_info: mockFiles[0],
      upload_url: 'https://example.com/upload',
    })
    mockFileService.deleteFile.mockResolvedValue(undefined)
    mockFileService.getFileStats.mockResolvedValue(mockFileStats)
    mockFileService.getFile.mockResolvedValue(mockFiles[0])
  })

  it('应该完成文件管理完整流程', async () => {
    // 1. 加载文件列表
    const managerHook = renderHook(() => useFileManager())

    await waitFor(() => {
      expect(managerHook.result.current.files).toEqual(mockFiles)
    })

    // 2. 上传新文件
    const testFile = new File(['test content'], 'new-file.txt', {
      type: 'text/plain',
    })

    await act(async () => {
      await managerHook.result.current.uploadFile(testFile)
    })

    // 3. 查看文件详情
    const detailHook = renderHook(() => useFileDetail('file-1'))

    await waitFor(() => {
      expect(detailHook.result.current.file).toEqual(mockFiles[0])
    })

    // 4. 查看统计信息
    const statsHook = renderHook(() => useFileStats())

    await waitFor(() => {
      expect(statsHook.result.current.stats).toEqual(mockFileStats)
    })

    // 5. 删除文件
    await act(async () => {
      await managerHook.result.current.deleteFile('file-1')
    })

    expect(mockFileService.deleteFile).toHaveBeenCalledWith('file-1')
  })

  it('应该正确处理批量操作', async () => {
    const { result } = renderHook(() => useFileManager())

    await waitFor(() => {
      expect(result.current.files).toEqual(mockFiles)
    })

    // 批量上传
    const files = [
      new File(['test1'], 'test1.txt', { type: 'text/plain' }),
      new File(['test2'], 'test2.txt', { type: 'text/plain' }),
    ]

    mockFileService.uploadFileObject
      .mockResolvedValueOnce({
        file_info: mockFiles[0],
        upload_url: 'https://example.com/upload1',
      })
      .mockResolvedValueOnce({
        file_info: mockFiles[1],
        upload_url: 'https://example.com/upload2',
      })

    await act(async () => {
      await result.current.uploadFiles(files)
    })

    // 批量删除
    await act(async () => {
      await result.current.batchDelete(['file-1', 'file-2'])
    })

    expect(mockFileService.batchDelete).toHaveBeenCalledWith([
      'file-1',
      'file-2',
    ])
  })
})

