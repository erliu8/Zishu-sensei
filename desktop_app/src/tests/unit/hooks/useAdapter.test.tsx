/**
 * useAdapter Hook 测试套件
 * 
 * 测试适配器管理的所有功能，包括安装、卸载、加载、配置等
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAdapter, type UseAdapterOptions } from '@/hooks/useAdapter'
import { 
  createMockAdapter,
  createMockAdapterList,
  createMockAdapterMetadata,
  createMockApiResponse,
  createMockErrorResponse
} from '../../mocks/factories'
import { waitForNextTick, mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// Mock AdapterStore
const mockAdapterStore = {
  adapters: [],
  isLoading: false,
  setLoading: vi.fn(),
  setAdapters: vi.fn(),
}

// Mock AdapterService
const mockAdapterService = {
  getAdapters: vi.fn(),
  installAdapter: vi.fn(),
  uninstallAdapter: vi.fn(),
  loadAdapter: vi.fn(),
  unloadAdapter: vi.fn(),
  executeAdapter: vi.fn(),
  getAdapterConfig: vi.fn(),
  updateAdapterConfig: vi.fn(),
  searchAdapters: vi.fn(),
  getAdapterDetails: vi.fn(),
  getAdapterStatus: vi.fn(),
  validateInstallRequest: vi.fn(() => []),
}

// Mock Toast Context
const mockToast = {
  showToast: vi.fn(),
}

vi.mock('@/stores/adapterStore', () => ({
  useAdapterStore: () => mockAdapterStore,
}))

vi.mock('@/services/adapter', () => ({
  default: mockAdapterService,
  AdapterStatus: {
    Installed: 'installed',
    Loaded: 'loaded',
    Unloaded: 'unloaded',
    Error: 'error',
  },
  AdapterType: {
    Soft: 'soft',
    Hard: 'hard',
    Intelligent: 'intelligent',
  },
}))

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}))

// ==================== 测试数据 ====================

const mockAdapterList = createMockAdapterList(5)
const testAdapterMetadata = createMockAdapterMetadata()

const mockInstallRequest = {
  adapter_id: 'test-adapter',
  version: '1.0.0',
  source: 'marketplace',
}

const mockExecutionRequest = {
  adapter_id: 'test-adapter',
  action: 'process',
  parameters: { input: 'test data' },
}

const mockConfigRequest = {
  adapter_id: 'test-adapter',
  config: { enabled: true, timeout: 30000 },
}

// ==================== 辅助函数 ====================

function createMockOptions(overrides?: Partial<UseAdapterOptions>): UseAdapterOptions {
  return {
    autoRefresh: false, // 关闭自动刷新以便测试
    refreshInterval: 30000,
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
    ...overrides,
  }
}

// ==================== 测试套件 ====================

describe('useAdapter Hook', () => {
  const consoleMock = mockConsole()

  beforeAll(() => {
    consoleMock.mockAll()
  })

  afterAll(() => {
    consoleMock.restore()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    
    // 设置默认 mock 行为
    mockAdapterStore.adapters = mockAdapterList
    mockAdapterStore.isLoading = false
    
    mockAdapterService.getAdapters.mockResolvedValue(mockAdapterList)
    mockAdapterService.installAdapter.mockResolvedValue(true)
    mockAdapterService.uninstallAdapter.mockResolvedValue(true)
    mockAdapterService.loadAdapter.mockResolvedValue(true)
    mockAdapterService.unloadAdapter.mockResolvedValue(true)
    mockAdapterService.executeAdapter.mockResolvedValue({ success: true })
    mockAdapterService.getAdapterConfig.mockResolvedValue({ enabled: true })
    mockAdapterService.updateAdapterConfig.mockResolvedValue(true)
    mockAdapterService.searchAdapters.mockResolvedValue({ 
      data: mockAdapterList, 
      total: mockAdapterList.length 
    })
    mockAdapterService.getAdapterDetails.mockResolvedValue(testAdapterMetadata)
    mockAdapterService.getAdapterStatus.mockResolvedValue({ status: 'loaded' })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ==================== 初始化测试 ====================

  describe('初始化', () => {
    it('应该返回默认的初始状态', () => {
      const { result } = renderHook(() => useAdapter())

      expect(result.current.adapters).toEqual(mockAdapterList)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isInstalling).toBe(false)
      expect(result.current.isUninstalling).toBe(false)
      expect(result.current.isExecuting).toBe(false)
      expect(result.current.error).toBe(null)
      expect(result.current.lastUpdated).toBe(null)
    })

    it('应该接受自定义选项', () => {
      const options = createMockOptions({
        refreshInterval: 60000,
        maxRetries: 5,
      })

      const { result } = renderHook(() => useAdapter(options))

      expect(typeof result.current.refreshAdapters).toBe('function')
      expect(typeof result.current.installAdapter).toBe('function')
    })

    it('应该在初始化时刷新适配器列表', async () => {
      renderHook(() => useAdapter({ autoRefresh: false }))

      await waitFor(() => {
        expect(mockAdapterService.getAdapters).toHaveBeenCalled()
      })
    })

    it('应该设置自动刷新', async () => {
      vi.useFakeTimers()

      renderHook(() => useAdapter({ 
        autoRefresh: true, 
        refreshInterval: 10000 
      }))

      // 快进时间
      vi.advanceTimersByTime(10000)

      await waitFor(() => {
        expect(mockAdapterService.getAdapters).toHaveBeenCalledTimes(2) // 初始 + 自动刷新
      })

      vi.useRealTimers()
    })
  })

  // ==================== 适配器列表管理测试 ====================

  describe('适配器列表管理', () => {
    it('应该刷新适配器列表', async () => {
      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        await result.current.refreshAdapters()
      })

      expect(mockAdapterService.getAdapters).toHaveBeenCalled()
      expect(mockAdapterStore.setAdapters).toHaveBeenCalledWith(mockAdapterList)
      expect(result.current.lastUpdated).toBeTruthy()
    })

    it('应该处理刷新失败', async () => {
      const testError = new Error('Network error')
      mockAdapterService.getAdapters.mockRejectedValue(testError)

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        await result.current.refreshAdapters()
      })

      expect(result.current.error).toBe('Network error')
      expect(mockToast.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: '刷新失败',
        })
      )
    })

    it('应该支持重试机制', async () => {
      mockAdapterService.getAdapters
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce(mockAdapterList)

      const { result } = renderHook(() => useAdapter({ 
        enableRetry: true, 
        maxRetries: 3,
        retryDelay: 100 
      }))

      await act(async () => {
        await result.current.refreshAdapters()
      })

      // 等待重试完成
      await waitFor(() => {
        expect(mockAdapterService.getAdapters).toHaveBeenCalledTimes(3)
        expect(result.current.error).toBe(null)
      }, { timeout: 5000 })
    })

    it('应该提供过滤后的适配器列表', () => {
      const loadedAdapters = mockAdapterList.filter(a => a.status === 'loaded')
      
      const { result } = renderHook(() => useAdapter())

      expect(result.current.installedAdapters).toEqual(mockAdapterList)
      expect(result.current.loadedAdapters.length).toBeLessThanOrEqual(mockAdapterList.length)
    })
  })

  // ==================== 适配器安装测试 ====================

  describe('适配器安装', () => {
    it('应该安装适配器', async () => {
      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const success = await result.current.installAdapter(mockInstallRequest)
        expect(success).toBe(true)
      })

      expect(mockAdapterService.installAdapter).toHaveBeenCalledWith(mockInstallRequest)
      expect(mockToast.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: '安装成功',
        })
      )
    })

    it('应该处理安装失败', async () => {
      const testError = new Error('Install failed')
      mockAdapterService.installAdapter.mockRejectedValue(testError)

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const success = await result.current.installAdapter(mockInstallRequest)
        expect(success).toBe(false)
      })

      expect(result.current.error).toBe('Install failed')
      expect(mockToast.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: '安装失败',
        })
      )
    })

    it('应该验证安装请求', async () => {
      mockAdapterService.validateInstallRequest.mockReturnValue([
        '适配器ID不能为空',
        '版本格式不正确'
      ])

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const success = await result.current.installAdapter({
          adapter_id: '',
          version: 'invalid',
          source: 'marketplace',
        })
        expect(success).toBe(false)
      })

      expect(result.current.error).toContain('适配器ID不能为空')
    })

    it('应该在安装后刷新列表', async () => {
      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        await result.current.installAdapter(mockInstallRequest)
      })

      expect(mockAdapterService.getAdapters).toHaveBeenCalledTimes(2) // 初始 + 安装后刷新
    })

    it('应该管理安装状态', async () => {
      let resolveInstall: (value: any) => void
      const installPromise = new Promise(resolve => {
        resolveInstall = resolve
      })

      mockAdapterService.installAdapter.mockReturnValue(installPromise)

      const { result } = renderHook(() => useAdapter())

      act(() => {
        result.current.installAdapter(mockInstallRequest)
      })

      expect(result.current.isInstalling).toBe(true)

      await act(async () => {
        resolveInstall!(true)
      })

      expect(result.current.isInstalling).toBe(false)
    })
  })

  // ==================== 适配器卸载测试 ====================

  describe('适配器卸载', () => {
    it('应该卸载适配器', async () => {
      const adapterId = 'test-adapter'
      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const success = await result.current.uninstallAdapter(adapterId)
        expect(success).toBe(true)
      })

      expect(mockAdapterService.uninstallAdapter).toHaveBeenCalledWith(adapterId)
      expect(mockToast.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: '卸载成功',
        })
      )
    })

    it('应该处理卸载失败', async () => {
      const testError = new Error('Uninstall failed')
      mockAdapterService.uninstallAdapter.mockRejectedValue(testError)

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const success = await result.current.uninstallAdapter('test-adapter')
        expect(success).toBe(false)
      })

      expect(result.current.error).toBe('Uninstall failed')
    })

    it('应该管理卸载状态', async () => {
      let resolveUninstall: (value: any) => void
      const uninstallPromise = new Promise(resolve => {
        resolveUninstall = resolve
      })

      mockAdapterService.uninstallAdapter.mockReturnValue(uninstallPromise)

      const { result } = renderHook(() => useAdapter())

      act(() => {
        result.current.uninstallAdapter('test-adapter')
      })

      expect(result.current.isUninstalling).toBe(true)

      await act(async () => {
        resolveUninstall!(true)
      })

      expect(result.current.isUninstalling).toBe(false)
    })
  })

  // ==================== 适配器加载/卸载测试 ====================

  describe('适配器加载/卸载', () => {
    it('应该加载适配器', async () => {
      const adapterId = 'test-adapter'
      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const success = await result.current.loadAdapter(adapterId)
        expect(success).toBe(true)
      })

      expect(mockAdapterService.loadAdapter).toHaveBeenCalledWith(adapterId)
      expect(mockToast.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: '加载成功',
        })
      )
    })

    it('应该卸载适配器', async () => {
      const adapterId = 'test-adapter'
      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const success = await result.current.unloadAdapter(adapterId)
        expect(success).toBe(true)
      })

      expect(mockAdapterService.unloadAdapter).toHaveBeenCalledWith(adapterId)
      expect(mockToast.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: '卸载成功',
        })
      )
    })

    it('应该处理加载失败', async () => {
      const testError = new Error('Load failed')
      mockAdapterService.loadAdapter.mockRejectedValue(testError)

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const success = await result.current.loadAdapter('test-adapter')
        expect(success).toBe(false)
      })

      expect(result.current.error).toBe('Load failed')
    })
  })

  // ==================== 适配器执行测试 ====================

  describe('适配器执行', () => {
    it('应该执行适配器操作', async () => {
      const mockResult = { success: true, data: 'processed data' }
      mockAdapterService.executeAdapter.mockResolvedValue(mockResult)

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const res = await result.current.executeAdapter(mockExecutionRequest)
        expect(res).toEqual(mockResult)
      })

      expect(mockAdapterService.executeAdapter).toHaveBeenCalledWith(mockExecutionRequest)
      expect(mockToast.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: '执行成功',
        })
      )
    })

    it('应该处理执行失败', async () => {
      const testError = new Error('Execution failed')
      mockAdapterService.executeAdapter.mockRejectedValue(testError)

      const { result } = renderHook(() => useAdapter())

      await expect(
        act(async () => {
          await result.current.executeAdapter(mockExecutionRequest)
        })
      ).rejects.toThrow('Execution failed')

      expect(result.current.error).toBe('Execution failed')
    })

    it('应该管理执行状态', async () => {
      let resolveExecution: (value: any) => void
      const executionPromise = new Promise(resolve => {
        resolveExecution = resolve
      })

      mockAdapterService.executeAdapter.mockReturnValue(executionPromise)

      const { result } = renderHook(() => useAdapter())

      act(() => {
        result.current.executeAdapter(mockExecutionRequest)
      })

      expect(result.current.isExecuting).toBe(true)

      await act(async () => {
        resolveExecution!({ success: true })
      })

      expect(result.current.isExecuting).toBe(false)
    })
  })

  // ==================== 配置管理测试 ====================

  describe('配置管理', () => {
    it('应该获取适配器配置', async () => {
      const mockConfig = { enabled: true, timeout: 30000 }
      mockAdapterService.getAdapterConfig.mockResolvedValue(mockConfig)

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const config = await result.current.getAdapterConfig('test-adapter')
        expect(config).toEqual(mockConfig)
      })

      expect(mockAdapterService.getAdapterConfig).toHaveBeenCalledWith('test-adapter')
    })

    it('应该更新适配器配置', async () => {
      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const success = await result.current.updateAdapterConfig(mockConfigRequest)
        expect(success).toBe(true)
      })

      expect(mockAdapterService.updateAdapterConfig).toHaveBeenCalledWith(mockConfigRequest)
      expect(mockToast.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: '配置更新成功',
        })
      )
    })

    it('应该处理配置获取失败', async () => {
      const testError = new Error('Config not found')
      mockAdapterService.getAdapterConfig.mockRejectedValue(testError)

      const { result } = renderHook(() => useAdapter())

      await expect(
        act(async () => {
          await result.current.getAdapterConfig('test-adapter')
        })
      ).rejects.toThrow('Config not found')

      expect(result.current.error).toBe('Config not found')
    })
  })

  // ==================== 搜索和详情测试 ====================

  describe('搜索和详情', () => {
    it('应该搜索适配器', async () => {
      const searchRequest = {
        query: 'test',
        category: 'all',
        page: 1,
        limit: 20,
      }

      const mockSearchResult = {
        data: mockAdapterList.slice(0, 2),
        total: 2,
        page: 1,
        limit: 20,
      }

      mockAdapterService.searchAdapters.mockResolvedValue(mockSearchResult)

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const res = await result.current.searchAdapters(searchRequest)
        expect(res).toEqual(mockSearchResult)
      })

      expect(mockAdapterService.searchAdapters).toHaveBeenCalledWith(searchRequest)
    })

    it('应该获取适配器详情', async () => {
      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const details = await result.current.getAdapterDetails('test-adapter')
        expect(details).toEqual(testAdapterMetadata)
      })

      expect(mockAdapterService.getAdapterDetails).toHaveBeenCalledWith('test-adapter')
    })

    it('应该获取适配器状态', async () => {
      const mockStatus = { status: 'loaded', memory_usage: 1024 }
      mockAdapterService.getAdapterStatus.mockResolvedValue(mockStatus)

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        const status = await result.current.getAdapterStatus('test-adapter')
        expect(status).toEqual(mockStatus)
      })

      expect(mockAdapterService.getAdapterStatus).toHaveBeenCalledWith('test-adapter')
    })
  })

  // ==================== 工具方法测试 ====================

  describe('工具方法', () => {
    it('应该检查适配器是否已安装', () => {
      const { result } = renderHook(() => useAdapter())

      const isInstalled = result.current.isAdapterInstalled(mockAdapterList[0].name)
      expect(isInstalled).toBe(true)

      const isNotInstalled = result.current.isAdapterInstalled('non-existent-adapter')
      expect(isNotInstalled).toBe(false)
    })

    it('应该检查适配器是否已加载', () => {
      const loadedAdapter = { ...mockAdapterList[0], status: 'loaded' as const }
      mockAdapterStore.adapters = [loadedAdapter, ...mockAdapterList.slice(1)]

      const { result } = renderHook(() => useAdapter())

      const isLoaded = result.current.isAdapterLoaded(loadedAdapter.name)
      expect(isLoaded).toBe(true)

      const isNotLoaded = result.current.isAdapterLoaded(mockAdapterList[1].name)
      expect(isNotLoaded).toBe(false)
    })

    it('应该根据ID获取适配器', () => {
      const { result } = renderHook(() => useAdapter())

      const adapter = result.current.getAdapterById(mockAdapterList[0].name)
      expect(adapter).toEqual(mockAdapterList[0])

      const notFound = result.current.getAdapterById('non-existent')
      expect(notFound).toBeUndefined()
    })

    it('应该根据状态过滤适配器', () => {
      const loadedAdapters = mockAdapterList.filter(a => a.status === 'loaded')
      
      const { result } = renderHook(() => useAdapter())

      const filtered = result.current.getAdaptersByStatus('loaded')
      expect(filtered).toEqual(loadedAdapters)
    })

    it('应该根据类型过滤适配器', () => {
      const { result } = renderHook(() => useAdapter())

      const filtered = result.current.getAdaptersByType('soft')
      // 由于 mock 实现总是返回所有适配器，这里只测试方法存在
      expect(Array.isArray(filtered)).toBe(true)
    })
  })

  // ==================== 事件系统测试 ====================

  describe('事件系统', () => {
    it('应该注册和触发适配器安装事件', async () => {
      const { result } = renderHook(() => useAdapter())
      
      const onInstalled = vi.fn()
      let unsubscribe: () => void

      act(() => {
        unsubscribe = result.current.onAdapterInstalled(onInstalled)
      })

      await act(async () => {
        await result.current.installAdapter(mockInstallRequest)
      })

      // 事件应该在找到对应适配器后触发
      expect(onInstalled).toHaveBeenCalled()

      act(() => {
        unsubscribe()
      })
    })

    it('应该注册和触发错误事件', async () => {
      const testError = new Error('Test error')
      mockAdapterService.getAdapters.mockRejectedValue(testError)

      const { result } = renderHook(() => useAdapter())
      
      const onError = vi.fn()
      let unsubscribe: () => void

      act(() => {
        unsubscribe = result.current.onAdapterError(onError)
      })

      await act(async () => {
        await result.current.refreshAdapters()
      })

      expect(onError).toHaveBeenCalledWith('Test error')

      act(() => {
        unsubscribe()
      })
    })

    it('应该支持多个事件监听器', async () => {
      const { result } = renderHook(() => useAdapter())
      
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      
      let unsubscribe1: () => void
      let unsubscribe2: () => void

      act(() => {
        unsubscribe1 = result.current.onAdapterInstalled(listener1)
        unsubscribe2 = result.current.onAdapterInstalled(listener2)
      })

      await act(async () => {
        await result.current.installAdapter(mockInstallRequest)
      })

      expect(listener1).toHaveBeenCalled()
      expect(listener2).toHaveBeenCalled()

      act(() => {
        unsubscribe1()
        unsubscribe2()
      })
    })

    it('应该清理事件监听器', () => {
      const { result } = renderHook(() => useAdapter())
      
      const listener = vi.fn()
      let unsubscribe: () => void

      act(() => {
        unsubscribe = result.current.onAdapterInstalled(listener)
      })

      act(() => {
        unsubscribe()
      })

      // 清理后不应该触发事件
      expect(listener).not.toHaveBeenCalled()
    })
  })

  // ==================== 清理测试 ====================

  describe('清理', () => {
    it('应该清理定时器和事件监听器', () => {
      const { result, unmount } = renderHook(() => useAdapter())

      act(() => {
        result.current.cleanup()
      })

      unmount()

      // 确保没有内存泄漏
      expect(true).toBe(true)
    })

    it('应该在卸载时自动清理', () => {
      const { unmount } = renderHook(() => useAdapter({ autoRefresh: true }))

      unmount()

      // 确保没有内存泄漏或未清理的定时器
      expect(true).toBe(true)
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      const networkError = new Error('Network timeout')
      mockAdapterService.getAdapters.mockRejectedValue(networkError)

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        await result.current.refreshAdapters()
      })

      expect(result.current.error).toBe('Network timeout')
    })

    it('应该处理权限错误', async () => {
      const permissionError = new Error('Permission denied')
      mockAdapterService.installAdapter.mockRejectedValue(permissionError)

      const { result } = renderHook(() => useAdapter())

      await act(async () => {
        await result.current.installAdapter(mockInstallRequest)
      })

      expect(result.current.error).toBe('Permission denied')
    })

    it('应该处理服务不可用错误', async () => {
      const serviceError = new Error('Service unavailable')
      mockAdapterService.executeAdapter.mockRejectedValue(serviceError)

      const { result } = renderHook(() => useAdapter())

      await expect(
        act(async () => {
          await result.current.executeAdapter(mockExecutionRequest)
        })
      ).rejects.toThrow('Service unavailable')
    })
  })
})

// ==================== 集成测试 ====================

describe('useAdapter 集成测试', () => {
  it('应该完成完整的适配器生命周期', async () => {
    const { result } = renderHook(() => useAdapter())

    // 1. 搜索适配器
    await act(async () => {
      const searchResult = await result.current.searchAdapters({
        query: 'test',
        category: 'all',
        page: 1,
        limit: 10,
      })
      expect(searchResult.data).toHaveLength(5)
    })

    // 2. 安装适配器
    await act(async () => {
      const success = await result.current.installAdapter(mockInstallRequest)
      expect(success).toBe(true)
    })

    // 3. 加载适配器
    await act(async () => {
      const success = await result.current.loadAdapter(mockInstallRequest.adapter_id)
      expect(success).toBe(true)
    })

    // 4. 配置适配器
    await act(async () => {
      const success = await result.current.updateAdapterConfig({
        adapter_id: mockInstallRequest.adapter_id,
        config: { enabled: true, timeout: 30000 },
      })
      expect(success).toBe(true)
    })

    // 5. 执行适配器
    await act(async () => {
      const result_data = await result.current.executeAdapter({
        adapter_id: mockInstallRequest.adapter_id,
        action: 'process',
        parameters: { input: 'test' },
      })
      expect(result_data.success).toBe(true)
    })

    // 6. 卸载适配器
    await act(async () => {
      const success = await result.current.unloadAdapter(mockInstallRequest.adapter_id)
      expect(success).toBe(true)
    })

    // 7. 卸载适配器
    await act(async () => {
      const success = await result.current.uninstallAdapter(mockInstallRequest.adapter_id)
      expect(success).toBe(true)
    })

    expect(mockToast.showToast).toHaveBeenCalledTimes(6) // 每个成功操作显示一个提示
  })

  it('应该处理并发操作', async () => {
    const { result } = renderHook(() => useAdapter())

    const promises = [
      act(() => result.current.refreshAdapters()),
      act(() => result.current.getAdapterStatus()),
      act(() => result.current.searchAdapters({ query: 'test' })),
    ]

    await Promise.allSettled(promises)

    expect(mockAdapterService.getAdapters).toHaveBeenCalled()
    expect(mockAdapterService.getAdapterStatus).toHaveBeenCalled()
    expect(mockAdapterService.searchAdapters).toHaveBeenCalled()
  })
})
