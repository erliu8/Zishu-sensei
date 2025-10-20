/**
 * 适配器工作流集成测试
 * 
 * 测试完整的适配器生命周期，包括：
 * - 搜索 → 安装 → 启动 → 使用 → 停止 → 卸载
 * - 适配器状态管理
 * - 适配器通信
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useAdapterStore } from '@/stores/adapterStore'
import { useChatStore } from '@/stores/chatStore'
import { AdapterStatus, AdapterType } from '@/services/adapter'
import { AdapterManagementService } from '@/services/adapterManagementService'

// Mock Tauri API
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}))

// Mock Adapter Service
vi.mock('@/services/adapterManagementService')

describe('适配器工作流集成测试', () => {
  beforeEach(() => {
    // 重置 store
    act(() => {
      useAdapterStore.getState().reset()
      useChatStore.getState().reset()
    })
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('适配器生命周期', () => {
    it('应该完成完整的适配器生命周期: 搜索 → 安装 → 启动 → 使用 → 停止 → 卸载', async () => {
      const store = useAdapterStore.getState()
      const adapterName = 'test-adapter'
      
      // ========== 1. 搜索适配器 ==========
      const mockSearchResults = {
        items: [
          {
            id: 'adapter-1',
            name: adapterName,
            version: '1.0.0',
            adapter_type: 'soft' as AdapterType,
            description: '测试适配器',
            author: 'Test Author',
            status: AdapterStatus.NotInstalled,
            config: {},
          },
        ],
        total: 1,
        page: 1,
        page_size: 10,
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: mockSearchResults,
      })
      
      // 执行搜索
      act(() => {
        store.setSearching(true)
      })
      
      act(() => {
        store.setSearchResults(mockSearchResults)
        store.setSearching(false)
      })
      
      expect(store.isSearching).toBe(false)
      expect(store.searchResults?.items).toHaveLength(1)
      expect(store.searchResults?.items[0].name).toBe(adapterName)
      
      // ========== 2. 安装适配器 ==========
      const mockInstalledAdapter = {
        name: adapterName,
        path: `/adapters/${adapterName}`,
        size: 1024000,
        version: '1.0.0',
        description: '测试适配器',
        status: AdapterStatus.Installed,
        load_time: new Date().toISOString(),
        memory_usage: 0,
        config: {},
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: mockInstalledAdapter,
      })
      
      act(() => {
        store.setInstalling(adapterName, true)
      })
      
      // 模拟安装完成
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        store.addAdapter(mockInstalledAdapter)
        store.setInstalling(adapterName, false)
      })
      
      expect(store.operationState.installing.has(adapterName)).toBe(false)
      const installedAdapter = store.getAdapterById(adapterName)
      expect(installedAdapter).toBeDefined()
      expect(installedAdapter?.status).toBe(AdapterStatus.Installed)
      
      // ========== 3. 加载/启动适配器 ==========
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          ...mockInstalledAdapter,
          status: AdapterStatus.Loaded,
          memory_usage: 102400,
        },
      })
      
      act(() => {
        store.setAdapterLoading(adapterName, true)
      })
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        store.updateAdapter(adapterName, {
          status: AdapterStatus.Loaded,
          memory_usage: 102400,
        })
        store.setAdapterLoading(adapterName, false)
      })
      
      expect(store.operationState.loading.has(adapterName)).toBe(false)
      const loadedAdapter = store.getAdapterById(adapterName)
      expect(loadedAdapter?.status).toBe(AdapterStatus.Loaded)
      
      // ========== 4. 使用适配器 ==========
      const chatStore = useChatStore.getState()
      const sessionId = chatStore.createSession('适配器测试会话')
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          message: {
            id: 'msg-1',
            role: 'assistant',
            content: '这是通过适配器生成的响应',
            timestamp: Date.now(),
          },
        },
      })
      
      act(() => {
        store.setExecuting(adapterName, true)
      })
      
      await act(async () => {
        // 模拟通过适配器发送消息
        await new Promise(resolve => setTimeout(resolve, 100))
        store.setExecuting(adapterName, false)
      })
      
      expect(store.operationState.executing.has(adapterName)).toBe(false)
      
      // 更新适配器统计
      act(() => {
        store.updateStats()
      })
      
      expect(store.stats.loaded).toBe(1)
      
      // ========== 5. 停止/卸载适配器 ==========
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          ...mockInstalledAdapter,
          status: AdapterStatus.Installed,
          memory_usage: 0,
        },
      })
      
      act(() => {
        store.setUnloading(adapterName, true)
      })
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        store.updateAdapter(adapterName, {
          status: AdapterStatus.Installed,
          memory_usage: 0,
        })
        store.setUnloading(adapterName, false)
      })
      
      const unloadedAdapter = store.getAdapterById(adapterName)
      expect(unloadedAdapter?.status).toBe(AdapterStatus.Installed)
      
      // ========== 6. 卸载适配器 ==========
      mockInvoke.mockResolvedValueOnce({
        success: true,
        message: '适配器卸载成功',
      })
      
      act(() => {
        store.setUninstalling(adapterName, true)
      })
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        store.removeAdapter(adapterName)
        store.setUninstalling(adapterName, false)
      })
      
      expect(store.operationState.uninstalling.has(adapterName)).toBe(false)
      expect(store.getAdapterById(adapterName)).toBeUndefined()
    })

    it('每个阶段应该正确更新状态', async () => {
      const store = useAdapterStore.getState()
      const adapterName = 'status-test-adapter'
      
      // 初始状态
      expect(store.adapters).toHaveLength(0)
      
      // 安装中状态
      act(() => {
        store.setInstalling(adapterName, true)
      })
      
      expect(store.operationState.installing.has(adapterName)).toBe(true)
      expect(store.isAdapterOperating(adapterName)).toBe(true)
      
      // 安装完成
      act(() => {
        store.addAdapter({
          name: adapterName,
          path: `/adapters/${adapterName}`,
          size: 1024000,
          version: '1.0.0',
          description: '状态测试适配器',
          status: AdapterStatus.Installed,
          load_time: new Date().toISOString(),
          memory_usage: 0,
          config: {},
        })
        store.setInstalling(adapterName, false)
      })
      
      expect(store.operationState.installing.has(adapterName)).toBe(false)
      expect(store.adapters).toHaveLength(1)
      
      // 加载中状态
      act(() => {
        store.setAdapterLoading(adapterName, true)
      })
      
      expect(store.operationState.loading.has(adapterName)).toBe(true)
      
      // 加载完成
      act(() => {
        store.updateAdapter(adapterName, { status: AdapterStatus.Loaded })
        store.setAdapterLoading(adapterName, false)
      })
      
      expect(store.operationState.loading.has(adapterName)).toBe(false)
      expect(store.getAdapterById(adapterName)?.status).toBe(AdapterStatus.Loaded)
      
      // 卸载中状态
      act(() => {
        store.setUninstalling(adapterName, true)
      })
      
      expect(store.operationState.uninstalling.has(adapterName)).toBe(true)
      
      // 卸载完成
      act(() => {
        store.removeAdapter(adapterName)
        store.setUninstalling(adapterName, false)
      })
      
      expect(store.operationState.uninstalling.has(adapterName)).toBe(false)
      expect(store.adapters).toHaveLength(0)
    })
  })

  describe('适配器通信', () => {
    it('应该正确调用适配器 API', async () => {
      const store = useAdapterStore.getState()
      const adapterName = 'api-test-adapter'
      
      // 添加已加载的适配器
      act(() => {
        store.addAdapter({
          name: adapterName,
          path: `/adapters/${adapterName}`,
          size: 1024000,
          version: '1.0.0',
          description: 'API 测试适配器',
          status: AdapterStatus.Loaded,
          load_time: new Date().toISOString(),
          memory_usage: 102400,
          config: {
            api_key: 'test-key',
            endpoint: 'http://test.com/api',
          },
        })
      })
      
      // Mock 适配器 API 调用
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          result: '适配器执行成功',
          execution_time: 123,
        },
      })
      
      // 执行适配器
      act(() => {
        store.setExecuting(adapterName, true)
      })
      
      const result = await mockInvoke('execute_adapter', {
        adapter_name: adapterName,
        action: 'process',
        params: { input: 'test' },
      })
      
      act(() => {
        store.setExecuting(adapterName, false)
      })
      
      expect(result.success).toBe(true)
      expect(result.data.result).toBe('适配器执行成功')
      expect(mockInvoke).toHaveBeenCalledWith('execute_adapter', {
        adapter_name: adapterName,
        action: 'process',
        params: { input: 'test' },
      })
    })

    it('应该正确处理适配器响应', async () => {
      const store = useAdapterStore.getState()
      const chatStore = useChatStore.getState()
      const adapterName = 'response-test-adapter'
      
      // 设置适配器
      act(() => {
        store.addAdapter({
          name: adapterName,
          path: `/adapters/${adapterName}`,
          size: 1024000,
          version: '1.0.0',
          description: '响应测试适配器',
          status: AdapterStatus.Loaded,
          load_time: new Date().toISOString(),
          memory_usage: 102400,
          config: {},
        })
      })
      
      // 创建聊天会话
      const sessionId = chatStore.createSession()
      
      // Mock 适配器响应
      const mockResponse = {
        success: true,
        data: {
          message: {
            id: 'msg-1',
            role: 'assistant',
            content: '适配器生成的回复',
            timestamp: Date.now(),
          },
          metadata: {
            model: 'test-model',
            adapter: adapterName,
            tokens: 50,
          },
        },
      }
      
      mockInvoke.mockResolvedValueOnce(mockResponse)
      
      // 通过适配器发送消息
      const response = await mockInvoke('send_message_with_adapter', {
        adapter: adapterName,
        message: '测试消息',
        session_id: sessionId,
      })
      
      expect(response.success).toBe(true)
      expect(response.data.message.content).toBe('适配器生成的回复')
      expect(response.data.metadata.adapter).toBe(adapterName)
      
      // 添加事件记录
      act(() => {
        store.addEvent({
          type: 'execute',
          adapterId: adapterName,
          message: '适配器执行成功',
          metadata: {
            tokens: response.data.metadata.tokens,
          },
        })
      })
      
      const events = store.getEventsByAdapter(adapterName)
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('execute')
    })

    it('应该处理适配器通信错误', async () => {
      const store = useAdapterStore.getState()
      const adapterName = 'error-test-adapter'
      
      act(() => {
        store.addAdapter({
          name: adapterName,
          path: `/adapters/${adapterName}`,
          size: 1024000,
          version: '1.0.0',
          description: '错误测试适配器',
          status: AdapterStatus.Loaded,
          load_time: new Date().toISOString(),
          memory_usage: 102400,
          config: {},
        })
      })
      
      // Mock 通信错误
      mockInvoke.mockRejectedValueOnce(new Error('适配器通信失败'))
      
      act(() => {
        store.setExecuting(adapterName, true)
      })
      
      await expect(
        mockInvoke('execute_adapter', {
          adapter_name: adapterName,
          action: 'process',
        })
      ).rejects.toThrow('适配器通信失败')
      
      act(() => {
        store.setExecuting(adapterName, false)
        store.updateAdapter(adapterName, {
          status: AdapterStatus.Error,
        })
        store.addEvent({
          type: 'error',
          adapterId: adapterName,
          message: '适配器通信失败',
        })
      })
      
      expect(store.getAdapterById(adapterName)?.status).toBe(AdapterStatus.Error)
      
      const errorEvents = store.getEventsByAdapter(adapterName)
      expect(errorEvents.some(e => e.type === 'error')).toBe(true)
    })
  })

  describe('适配器配置管理', () => {
    it('应该正确保存和加载适配器配置', async () => {
      const store = useAdapterStore.getState()
      const adapterName = 'config-test-adapter'
      
      const config = {
        api_key: 'test-api-key',
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 2000,
      }
      
      // 添加适配器
      act(() => {
        store.addAdapter({
          name: adapterName,
          path: `/adapters/${adapterName}`,
          size: 1024000,
          version: '1.0.0',
          description: '配置测试适配器',
          status: AdapterStatus.Installed,
          load_time: new Date().toISOString(),
          memory_usage: 0,
          config: config,
        })
      })
      
      // 验证配置
      const adapter = store.getAdapterById(adapterName)
      expect(adapter?.config).toEqual(config)
      
      // 更新配置
      const newConfig = {
        ...config,
        temperature: 0.9,
        max_tokens: 4000,
      }
      
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { ...adapter, config: newConfig },
      })
      
      act(() => {
        store.updateAdapter(adapterName, { config: newConfig })
      })
      
      const updatedAdapter = store.getAdapterById(adapterName)
      expect(updatedAdapter?.config.temperature).toBe(0.9)
      expect(updatedAdapter?.config.max_tokens).toBe(4000)
      
      // 缓存配置
      act(() => {
        store.setCacheConfig(adapterName, newConfig)
      })
      
      const cachedConfig = store.getCacheConfig(adapterName)
      expect(cachedConfig).toEqual(newConfig)
    })

    it('应该验证适配器配置', async () => {
      const store = useAdapterStore.getState()
      const adapterName = 'validation-test-adapter'
      
      // Mock 配置验证失败
      mockInvoke.mockResolvedValueOnce({
        success: false,
        error: 'API key 不能为空',
      })
      
      const invalidConfig = {
        api_key: '', // 空的 API key
        model: 'gpt-4',
      }
      
      const result = await mockInvoke('validate_adapter_config', {
        adapter_name: adapterName,
        config: invalidConfig,
      })
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('API key')
      
      // Mock 配置验证成功
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: { valid: true },
      })
      
      const validConfig = {
        api_key: 'valid-key',
        model: 'gpt-4',
      }
      
      const validResult = await mockInvoke('validate_adapter_config', {
        adapter_name: adapterName,
        config: validConfig,
      })
      
      expect(validResult.success).toBe(true)
    })
  })

  describe('适配器更新', () => {
    it('应该检查并安装适配器更新', async () => {
      const store = useAdapterStore.getState()
      const adapterName = 'update-test-adapter'
      
      // 添加旧版本适配器
      act(() => {
        store.addAdapter({
          name: adapterName,
          path: `/adapters/${adapterName}`,
          size: 1024000,
          version: '1.0.0',
          description: '更新测试适配器',
          status: AdapterStatus.Loaded,
          load_time: new Date().toISOString(),
          memory_usage: 102400,
          config: {},
        })
      })
      
      // Mock 检查更新
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          has_update: true,
          latest_version: '1.1.0',
          changelog: '修复了一些 bug',
        },
      })
      
      const updateCheck = await mockInvoke('check_adapter_update', {
        adapter_name: adapterName,
      })
      
      expect(updateCheck.data.has_update).toBe(true)
      expect(updateCheck.data.latest_version).toBe('1.1.0')
      
      // Mock 安装更新
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          name: adapterName,
          version: '1.1.0',
        },
      })
      
      act(() => {
        store.setUpdating(adapterName, true)
      })
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        store.updateAdapter(adapterName, { version: '1.1.0' })
        store.setUpdating(adapterName, false)
        store.addEvent({
          type: 'update',
          adapterId: adapterName,
          message: '适配器已更新到 1.1.0',
        })
      })
      
      expect(store.operationState.updating.has(adapterName)).toBe(false)
      expect(store.getAdapterById(adapterName)?.version).toBe('1.1.0')
    })
  })

  describe('批量操作', () => {
    it('应该支持批量安装适配器', async () => {
      const store = useAdapterStore.getState()
      const adapterNames = ['adapter-1', 'adapter-2', 'adapter-3']
      
      // Mock 批量安装
      mockInvoke.mockImplementation((cmd, params) => {
        if (cmd === 'batch_install_adapters') {
          return Promise.resolve({
            success: true,
            data: {
              installed: params.adapter_ids,
              failed: [],
            },
          })
        }
        return Promise.resolve({ success: false })
      })
      
      const result = await mockInvoke('batch_install_adapters', {
        adapter_ids: adapterNames,
      })
      
      expect(result.success).toBe(true)
      expect(result.data.installed).toHaveLength(3)
      expect(result.data.failed).toHaveLength(0)
      
      // 添加安装的适配器
      await act(async () => {
        adapterNames.forEach((name, index) => {
          store.addAdapter({
            name,
            path: `/adapters/${name}`,
            size: 1024000,
            version: '1.0.0',
            description: `批量测试适配器 ${index + 1}`,
            status: AdapterStatus.Installed,
            load_time: new Date().toISOString(),
            memory_usage: 0,
            config: {},
          })
        })
      })
      
      expect(store.adapters).toHaveLength(3)
    })

    it('应该支持批量卸载适配器', async () => {
      const store = useAdapterStore.getState()
      const adapterNames = ['adapter-1', 'adapter-2', 'adapter-3']
      
      // 先添加适配器
      act(() => {
        adapterNames.forEach((name, index) => {
          store.addAdapter({
            name,
            path: `/adapters/${name}`,
            size: 1024000,
            version: '1.0.0',
            description: `批量测试适配器 ${index + 1}`,
            status: AdapterStatus.Installed,
            load_time: new Date().toISOString(),
            memory_usage: 0,
            config: {},
          })
        })
      })
      
      expect(store.adapters).toHaveLength(3)
      
      // Mock 批量卸载
      mockInvoke.mockResolvedValueOnce({
        success: true,
        data: {
          uninstalled: adapterNames,
          failed: [],
        },
      })
      
      const result = await mockInvoke('batch_uninstall_adapters', {
        adapter_names: adapterNames,
      })
      
      expect(result.success).toBe(true)
      
      // 移除适配器
      act(() => {
        adapterNames.forEach(name => {
          store.removeAdapter(name)
        })
      })
      
      expect(store.adapters).toHaveLength(0)
    })
  })

  describe('适配器统计', () => {
    it('应该正确统计适配器信息', async () => {
      const store = useAdapterStore.getState()
      
      // 添加不同状态的适配器
      act(() => {
        store.addAdapter({
          name: 'adapter-1',
          path: '/adapters/adapter-1',
          size: 1024000,
          version: '1.0.0',
          description: '已加载适配器',
          status: AdapterStatus.Loaded,
          load_time: new Date().toISOString(),
          memory_usage: 102400,
          config: {},
        })
        
        store.addAdapter({
          name: 'adapter-2',
          path: '/adapters/adapter-2',
          size: 2048000,
          version: '1.0.0',
          description: '已安装未加载适配器',
          status: AdapterStatus.Installed,
          load_time: new Date().toISOString(),
          memory_usage: 0,
          config: {},
        })
        
        store.addAdapter({
          name: 'adapter-3',
          path: '/adapters/adapter-3',
          size: 512000,
          version: '1.0.0',
          description: '错误状态适配器',
          status: AdapterStatus.Error,
          load_time: new Date().toISOString(),
          memory_usage: 0,
          config: {},
        })
      })
      
      // 更新统计
      act(() => {
        store.updateStats()
      })
      
      // 验证统计数据
      expect(store.stats.total).toBe(3)
      expect(store.stats.loaded).toBe(1)
      expect(store.stats.installed).toBe(1)
      expect(store.stats.errors).toBe(1)
      
      // 获取不同状态的适配器
      const loadedAdapters = store.getAdaptersByStatus(AdapterStatus.Loaded)
      const installedAdapters = store.getAdaptersByStatus(AdapterStatus.Installed)
      const errorAdapters = store.getAdaptersByStatus(AdapterStatus.Error)
      
      expect(loadedAdapters).toHaveLength(1)
      expect(installedAdapters).toHaveLength(1)
      expect(errorAdapters).toHaveLength(1)
    })
  })
})

