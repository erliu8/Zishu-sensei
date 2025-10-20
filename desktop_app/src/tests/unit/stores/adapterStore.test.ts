/**
 * 适配器状态管理 Store 测试
 * 
 * 测试适配器状态管理的所有功能，包括：
 * - 适配器列表管理
 * - 操作状态管理  
 * - 搜索和过滤
 * - 缓存管理
 * - 事件管理
 * - 统计信息
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { 
  useAdapterStore, 
  type AdapterState, 
  type AdapterActions,
  type AdapterStats,
  type AdapterFilters,
  type AdapterEvent
} from '@/stores/adapterStore'
import { 
  type AdapterInfo, 
  type AdapterMetadata,
  AdapterStatus,
  AdapterType,
  CapabilityLevel
} from '@/services/adapter'
import { type PaginatedResponse } from '@/services/types'
import { createAdapterInfo, createAdapterMetadata } from '../../mocks/factories'

// Mock Zustand persist
vi.mock('zustand/middleware', () => ({
  devtools: vi.fn((fn) => fn),
  persist: vi.fn((fn, options) => fn),
  subscribeWithSelector: vi.fn((fn) => fn),
  immer: vi.fn((fn) => fn),
}))

// ==================== 测试数据工厂 ====================

const createMockAdapterInfo = (overrides: Partial<AdapterInfo> = {}): AdapterInfo => ({
  name: 'test-adapter',
  display_name: 'Test Adapter',
  description: 'Test adapter for testing',
  version: '1.0.0',
  status: AdapterStatus.Unloaded,
  adapter_type: 'test',
  is_system: false,
  is_builtin: false,
  is_enabled: true,
  is_loaded: false,
  load_time: null,
  memory_usage: 0,
  last_error: null,
  config_schema: {},
  ...overrides,
})

const createMockAdapterMetadata = (overrides: Partial<AdapterMetadata> = {}): AdapterMetadata => ({
  name: 'test-adapter',
  version: '1.0.0',
  displayName: 'Test Adapter',
  description: 'Test adapter for testing',
  author: 'Test Author',
  homepage: 'https://example.com',
  repository: 'https://github.com/test/adapter',
  keywords: ['test', 'adapter'],
  license: 'MIT',
  dependencies: {},
  devDependencies: {},
  scripts: {},
  main: 'index.js',
  type: AdapterType.Soft,
  capability: CapabilityLevel.Basic,
  ...overrides,
})

const createMockPaginatedResponse = <T>(data: T[], overrides: Partial<PaginatedResponse<T>> = {}): PaginatedResponse<T> => ({
  data,
  total: data.length,
  page: 1,
  pageSize: 10,
  totalPages: Math.ceil(data.length / 10),
  hasNext: false,
  hasPrev: false,
  ...overrides,
})

// ==================== 测试套件 ====================

describe('AdapterStore', () => {
  let store: ReturnType<typeof useAdapterStore>
  
  beforeEach(() => {
    // 重置 Store
    act(() => {
      store = useAdapterStore.getState()
      store.reset()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==================== 初始状态测试 ====================
  
  describe('初始状态', () => {
    it('应该有正确的初始状态', () => {
      const state = useAdapterStore.getState()
      
      expect(state.adapters).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.isInitialized).toBe(false)
      expect(state.lastError).toBeNull()
      expect(state.lastUpdated).toBeNull()
      expect(state.searchResults).toBeNull()
      expect(state.isSearching).toBe(false)
      expect(state.events).toEqual([])
      
      // 检查操作状态
      expect(state.operationState.installing.size).toBe(0)
      expect(state.operationState.uninstalling.size).toBe(0)
      expect(state.operationState.loading.size).toBe(0)
      expect(state.operationState.unloading.size).toBe(0)
      expect(state.operationState.executing.size).toBe(0)
      expect(state.operationState.updating.size).toBe(0)
      
      // 检查默认过滤器
      expect(state.filters.query).toBe('')
      expect(state.filters.status).toEqual([])
      expect(state.filters.type).toEqual([])
      expect(state.filters.sortBy).toBe('name')
      expect(state.filters.sortOrder).toBe('asc')
    })
    
    it('应该有正确的默认统计信息', () => {
      const state = useAdapterStore.getState()
      
      expect(state.stats.total).toBe(0)
      expect(state.stats.loaded).toBe(0)
      expect(state.stats.unloaded).toBe(0)
      expect(state.stats.loading).toBe(0)
      expect(state.stats.unloading).toBe(0)
      expect(state.stats.error).toBe(0)
      expect(state.stats.maintenance).toBe(0)
      expect(state.stats.totalMemoryUsage).toBe(0)
      expect(state.stats.averageLoadTime).toBe(0)
    })
    
    it('应该有正确的默认配置', () => {
      const state = useAdapterStore.getState()
      
      expect(state.config.autoRefresh).toBe(true)
      expect(state.config.refreshInterval).toBe(30000)
      expect(state.config.enableCache).toBe(true)
      expect(state.config.cacheTtl).toBe(5 * 60 * 1000)
      expect(state.config.maxEvents).toBe(100)
    })
  })

  // ==================== 基础操作测试 ====================

  describe('基础操作', () => {
    it('应该正确设置适配器列表', () => {
      const adapters = [
        createMockAdapterInfo({ name: 'adapter1' }),
        createMockAdapterInfo({ name: 'adapter2' }),
      ]
      
      act(() => {
        useAdapterStore.getState().setAdapters(adapters)
      })
      
      const state = useAdapterStore.getState()
      expect(state.adapters).toEqual(adapters)
      expect(state.isInitialized).toBe(true)
      expect(state.lastError).toBeNull()
      expect(state.lastUpdated).toBeDefined()
    })
    
    it('应该正确添加适配器', () => {
      const adapter = createMockAdapterInfo({ name: 'new-adapter' })
      
      act(() => {
        useAdapterStore.getState().addAdapter(adapter)
      })
      
      const state = useAdapterStore.getState()
      expect(state.adapters).toHaveLength(1)
      expect(state.adapters[0]).toEqual(adapter)
      expect(state.lastUpdated).toBeDefined()
    })
    
    it('应该更新已存在的适配器', () => {
      const adapter = createMockAdapterInfo({ name: 'test-adapter' })
      const updatedAdapter = createMockAdapterInfo({ 
        name: 'test-adapter', 
        status: AdapterStatus.Loaded 
      })
      
      act(() => {
        useAdapterStore.getState().addAdapter(adapter)
        useAdapterStore.getState().addAdapter(updatedAdapter)
      })
      
      const state = useAdapterStore.getState()
      expect(state.adapters).toHaveLength(1)
      expect(state.adapters[0].status).toBe(AdapterStatus.Loaded)
    })
    
    it('应该正确更新适配器', () => {
      const adapter = createMockAdapterInfo({ name: 'test-adapter' })
      
      act(() => {
        useAdapterStore.getState().addAdapter(adapter)
        useAdapterStore.getState().updateAdapter('test-adapter', { 
          status: AdapterStatus.Loaded 
        })
      })
      
      const state = useAdapterStore.getState()
      expect(state.adapters[0].status).toBe(AdapterStatus.Loaded)
      expect(state.lastUpdated).toBeDefined()
    })
    
    it('应该忽略更新不存在的适配器', () => {
      act(() => {
        useAdapterStore.getState().updateAdapter('non-existent', { 
          status: AdapterStatus.Loaded 
        })
      })
      
      const state = useAdapterStore.getState()
      expect(state.adapters).toHaveLength(0)
    })
    
    it('应该正确删除适配器', () => {
      const adapters = [
        createMockAdapterInfo({ name: 'adapter1' }),
        createMockAdapterInfo({ name: 'adapter2' }),
      ]
      
      act(() => {
        useAdapterStore.getState().setAdapters(adapters)
        useAdapterStore.getState().removeAdapter('adapter1')
      })
      
      const state = useAdapterStore.getState()
      expect(state.adapters).toHaveLength(1)
      expect(state.adapters[0].name).toBe('adapter2')
      expect(state.lastUpdated).toBeDefined()
    })
    
    it('应该正确设置加载状态', () => {
      act(() => {
        useAdapterStore.getState().setLoading(true)
      })
      
      expect(useAdapterStore.getState().isLoading).toBe(true)
      
      act(() => {
        useAdapterStore.getState().setLoading(false)
      })
      
      expect(useAdapterStore.getState().isLoading).toBe(false)
    })
    
    it('应该正确设置错误信息', () => {
      const errorMessage = 'Test error'
      
      act(() => {
        useAdapterStore.getState().setError(errorMessage)
      })
      
      const state = useAdapterStore.getState()
      expect(state.lastError).toBe(errorMessage)
      expect(state.events).toHaveLength(1)
      expect(state.events[0].type).toBe('error')
      expect(state.events[0].error).toBe(errorMessage)
    })
    
    it('应该正确清空错误信息', () => {
      act(() => {
        useAdapterStore.getState().setError('Test error')
        useAdapterStore.getState().setError(null)
      })
      
      expect(useAdapterStore.getState().lastError).toBeNull()
    })
  })

  // ==================== 操作状态管理测试 ====================

  describe('操作状态管理', () => {
    const adapterId = 'test-adapter'
    
    it('应该正确管理安装状态', () => {
      act(() => {
        useAdapterStore.getState().setInstalling(adapterId, true)
      })
      
      let state = useAdapterStore.getState()
      expect(state.operationState.installing.has(adapterId)).toBe(true)
      
      act(() => {
        useAdapterStore.getState().setInstalling(adapterId, false)
      })
      
      state = useAdapterStore.getState()
      expect(state.operationState.installing.has(adapterId)).toBe(false)
    })
    
    it('应该正确管理卸载状态', () => {
      act(() => {
        useAdapterStore.getState().setUninstalling(adapterId, true)
      })
      
      let state = useAdapterStore.getState()
      expect(state.operationState.uninstalling.has(adapterId)).toBe(true)
      
      act(() => {
        useAdapterStore.getState().setUninstalling(adapterId, false)
      })
      
      state = useAdapterStore.getState()
      expect(state.operationState.uninstalling.has(adapterId)).toBe(false)
    })
    
    it('应该正确管理加载状态', () => {
      act(() => {
        useAdapterStore.getState().setAdapterLoading(adapterId, true)
      })
      
      let state = useAdapterStore.getState()
      expect(state.operationState.loading.has(adapterId)).toBe(true)
      
      act(() => {
        useAdapterStore.getState().setAdapterLoading(adapterId, false)
      })
      
      state = useAdapterStore.getState()
      expect(state.operationState.loading.has(adapterId)).toBe(false)
    })
    
    it('应该正确管理卸载状态', () => {
      act(() => {
        useAdapterStore.getState().setUnloading(adapterId, true)
      })
      
      let state = useAdapterStore.getState()
      expect(state.operationState.unloading.has(adapterId)).toBe(true)
      
      act(() => {
        useAdapterStore.getState().setUnloading(adapterId, false)
      })
      
      state = useAdapterStore.getState()
      expect(state.operationState.unloading.has(adapterId)).toBe(false)
    })
    
    it('应该正确管理执行状态', () => {
      act(() => {
        useAdapterStore.getState().setExecuting(adapterId, true)
      })
      
      let state = useAdapterStore.getState()
      expect(state.operationState.executing.has(adapterId)).toBe(true)
      
      act(() => {
        useAdapterStore.getState().setExecuting(adapterId, false)
      })
      
      state = useAdapterStore.getState()
      expect(state.operationState.executing.has(adapterId)).toBe(false)
    })
    
    it('应该正确管理更新状态', () => {
      act(() => {
        useAdapterStore.getState().setUpdating(adapterId, true)
      })
      
      let state = useAdapterStore.getState()
      expect(state.operationState.updating.has(adapterId)).toBe(true)
      
      act(() => {
        useAdapterStore.getState().setUpdating(adapterId, false)
      })
      
      state = useAdapterStore.getState()
      expect(state.operationState.updating.has(adapterId)).toBe(false)
    })
  })

  // ==================== 搜索和过滤测试 ====================

  describe('搜索和过滤', () => {
    beforeEach(() => {
      const adapters = [
        createMockAdapterInfo({ 
          name: 'web-adapter', 
          description: 'Web automation adapter',
          status: AdapterStatus.Loaded 
        }),
        createMockAdapterInfo({ 
          name: 'email-adapter', 
          description: 'Email management adapter',
          status: AdapterStatus.Unloaded 
        }),
        createMockAdapterInfo({ 
          name: 'file-adapter', 
          description: 'File system adapter',
          status: AdapterStatus.Error 
        }),
      ]
      
      act(() => {
        useAdapterStore.getState().setAdapters(adapters)
      })
    })
    
    it('应该正确设置过滤器', () => {
      const filters: Partial<AdapterFilters> = {
        query: 'web',
        status: [AdapterStatus.Loaded],
        sortBy: 'status',
        sortOrder: 'desc',
      }
      
      act(() => {
        useAdapterStore.getState().setFilters(filters)
      })
      
      const state = useAdapterStore.getState()
      expect(state.filters.query).toBe('web')
      expect(state.filters.status).toEqual([AdapterStatus.Loaded])
      expect(state.filters.sortBy).toBe('status')
      expect(state.filters.sortOrder).toBe('desc')
    })
    
    it('应该正确重置过滤器', () => {
      act(() => {
        useAdapterStore.getState().setFilters({ query: 'test', status: [AdapterStatus.Loaded] })
        useAdapterStore.getState().resetFilters()
      })
      
      const state = useAdapterStore.getState()
      expect(state.filters.query).toBe('')
      expect(state.filters.status).toEqual([])
      expect(state.filters.sortBy).toBe('name')
      expect(state.filters.sortOrder).toBe('asc')
    })
    
    it('应该根据查询过滤适配器', () => {
      act(() => {
        useAdapterStore.getState().setFilters({ query: 'web' })
      })
      
      const filteredAdapters = useAdapterStore.getState().getFilteredAdapters()
      expect(filteredAdapters).toHaveLength(1)
      expect(filteredAdapters[0].name).toBe('web-adapter')
    })
    
    it('应该根据状态过滤适配器', () => {
      act(() => {
        useAdapterStore.getState().setFilters({ status: [AdapterStatus.Loaded] })
      })
      
      const filteredAdapters = useAdapterStore.getState().getFilteredAdapters()
      expect(filteredAdapters).toHaveLength(1)
      expect(filteredAdapters[0].status).toBe(AdapterStatus.Loaded)
    })
    
    it('应该根据描述过滤适配器', () => {
      act(() => {
        useAdapterStore.getState().setFilters({ query: 'Email' })
      })
      
      const filteredAdapters = useAdapterStore.getState().getFilteredAdapters()
      expect(filteredAdapters).toHaveLength(1)
      expect(filteredAdapters[0].name).toBe('email-adapter')
    })
    
    it('应该按名称排序适配器', () => {
      act(() => {
        useAdapterStore.getState().setFilters({ sortBy: 'name', sortOrder: 'asc' })
      })
      
      const filteredAdapters = useAdapterStore.getState().getFilteredAdapters()
      expect(filteredAdapters.map(a => a.name)).toEqual([
        'email-adapter',
        'file-adapter', 
        'web-adapter'
      ])
    })
    
    it('应该按状态排序适配器', () => {
      act(() => {
        useAdapterStore.getState().setFilters({ sortBy: 'status', sortOrder: 'asc' })
      })
      
      const filteredAdapters = useAdapterStore.getState().getFilteredAdapters()
      // Error < Loaded < Unloaded (按字符串排序)
      expect(filteredAdapters[0].status).toBe(AdapterStatus.Error)
    })
    
    it('应该正确设置搜索结果', () => {
      const searchResults = createMockPaginatedResponse([
        createMockAdapterInfo({ name: 'search-result' })
      ])
      
      act(() => {
        useAdapterStore.getState().setSearchResults(searchResults)
      })
      
      expect(useAdapterStore.getState().searchResults).toEqual(searchResults)
    })
    
    it('应该正确设置搜索状态', () => {
      act(() => {
        useAdapterStore.getState().setSearching(true)
      })
      
      expect(useAdapterStore.getState().isSearching).toBe(true)
      
      act(() => {
        useAdapterStore.getState().setSearching(false)
      })
      
      expect(useAdapterStore.getState().isSearching).toBe(false)
    })
  })

  // ==================== 缓存管理测试 ====================

  describe('缓存管理', () => {
    const adapterId = 'test-adapter'
    const metadata = createMockAdapterMetadata()
    const config = { key: 'value' }
    const searchResults = createMockPaginatedResponse([createMockAdapterInfo()])
    
    it('应该正确设置和获取缓存元数据', () => {
      act(() => {
        useAdapterStore.getState().setCacheMetadata(adapterId, metadata)
      })
      
      const cachedMetadata = useAdapterStore.getState().getCacheMetadata(adapterId)
      expect(cachedMetadata).toEqual(metadata)
    })
    
    it('应该正确设置和获取缓存配置', () => {
      act(() => {
        useAdapterStore.getState().setCacheConfig(adapterId, config)
      })
      
      const cachedConfig = useAdapterStore.getState().getCacheConfig(adapterId)
      expect(cachedConfig).toEqual(config)
    })
    
    it('应该正确设置和获取缓存搜索结果', () => {
      const key = 'search-key'
      
      act(() => {
        useAdapterStore.getState().setCacheSearchResults(key, searchResults)
      })
      
      const cachedResults = useAdapterStore.getState().getCacheSearchResults(key)
      expect(cachedResults).toEqual(searchResults)
    })
    
    it('应该返回 null 对于不存在的缓存项', () => {
      const metadata = useAdapterStore.getState().getCacheMetadata('non-existent')
      const config = useAdapterStore.getState().getCacheConfig('non-existent')
      const results = useAdapterStore.getState().getCacheSearchResults('non-existent')
      
      expect(metadata).toBeNull()
      expect(config).toBeNull()
      expect(results).toBeNull()
    })
    
    it('应该正确清除所有缓存', () => {
      act(() => {
        useAdapterStore.getState().setCacheMetadata(adapterId, metadata)
        useAdapterStore.getState().setCacheConfig(adapterId, config)
        useAdapterStore.getState().clearCache()
      })
      
      const cachedMetadata = useAdapterStore.getState().getCacheMetadata(adapterId)
      const cachedConfig = useAdapterStore.getState().getCacheConfig(adapterId)
      
      expect(cachedMetadata).toBeNull()
      expect(cachedConfig).toBeNull()
    })
    
    it('应该正确清除过期缓存', () => {
      // Mock Date.now 来模拟过期
      const mockNow = vi.spyOn(Date, 'now')
      const startTime = 1000000
      mockNow.mockReturnValue(startTime)
      
      act(() => {
        useAdapterStore.getState().setCacheMetadata(adapterId, metadata)
      })
      
      // 模拟时间推进，超过 TTL
      mockNow.mockReturnValue(startTime + 6 * 60 * 1000) // 6分钟后
      
      act(() => {
        useAdapterStore.getState().clearExpiredCache()
      })
      
      const cachedMetadata = useAdapterStore.getState().getCacheMetadata(adapterId)
      expect(cachedMetadata).toBeNull()
      
      mockNow.mockRestore()
    })
    
    it('缓存过期时应该返回 null', () => {
      const mockNow = vi.spyOn(Date, 'now')
      const startTime = 1000000
      mockNow.mockReturnValue(startTime)
      
      act(() => {
        useAdapterStore.getState().setCacheMetadata(adapterId, metadata)
      })
      
      // 模拟时间推进，超过 TTL
      mockNow.mockReturnValue(startTime + 6 * 60 * 1000) // 6分钟后
      
      const cachedMetadata = useAdapterStore.getState().getCacheMetadata(adapterId)
      expect(cachedMetadata).toBeNull()
      
      mockNow.mockRestore()
    })
  })

  // ==================== 事件管理测试 ====================

  describe('事件管理', () => {
    it('应该正确添加事件', () => {
      const event: Omit<AdapterEvent, 'timestamp'> = {
        type: 'installed',
        adapterId: 'test-adapter',
        data: { test: 'data' },
      }
      
      act(() => {
        useAdapterStore.getState().addEvent(event)
      })
      
      const state = useAdapterStore.getState()
      expect(state.events).toHaveLength(1)
      expect(state.events[0]).toMatchObject(event)
      expect(state.events[0].timestamp).toBeDefined()
    })
    
    it('应该限制事件数量', () => {
      // 添加超过最大数量的事件
      act(() => {
        const store = useAdapterStore.getState()
        for (let i = 0; i < store.maxEvents + 10; i++) {
          store.addEvent({
            type: 'loaded',
            adapterId: `adapter-${i}`,
          })
        }
      })
      
      const state = useAdapterStore.getState()
      expect(state.events).toHaveLength(state.maxEvents)
    })
    
    it('应该正确清除事件', () => {
      act(() => {
        useAdapterStore.getState().addEvent({
          type: 'installed',
          adapterId: 'test-adapter',
        })
        useAdapterStore.getState().clearEvents()
      })
      
      expect(useAdapterStore.getState().events).toHaveLength(0)
    })
    
    it('应该正确获取特定适配器的事件', () => {
      const adapterId = 'test-adapter'
      
      act(() => {
        const store = useAdapterStore.getState()
        store.addEvent({ type: 'installed', adapterId })
        store.addEvent({ type: 'loaded', adapterId })
        store.addEvent({ type: 'installed', adapterId: 'other-adapter' })
      })
      
      const events = useAdapterStore.getState().getEventsByAdapter(adapterId)
      expect(events).toHaveLength(2)
      expect(events.every(e => e.adapterId === adapterId)).toBe(true)
    })
    
    it('应该正确获取最近事件', () => {
      act(() => {
        const store = useAdapterStore.getState()
        for (let i = 0; i < 15; i++) {
          store.addEvent({
            type: 'loaded',
            adapterId: `adapter-${i}`,
          })
        }
      })
      
      const recentEvents = useAdapterStore.getState().getRecentEvents(5)
      expect(recentEvents).toHaveLength(5)
      // 应该是最后5个事件
      expect(recentEvents[0].adapterId).toBe('adapter-10')
      expect(recentEvents[4].adapterId).toBe('adapter-14')
    })
  })

  // ==================== 统计信息测试 ====================

  describe('统计信息', () => {
    beforeEach(() => {
      const adapters = [
        createMockAdapterInfo({ 
          name: 'adapter1', 
          status: AdapterStatus.Loaded,
          memory_usage: 100,
        }),
        createMockAdapterInfo({ 
          name: 'adapter2', 
          status: AdapterStatus.Unloaded,
          memory_usage: 50,
        }),
        createMockAdapterInfo({ 
          name: 'adapter3', 
          status: AdapterStatus.Error,
          memory_usage: 75,
        }),
        createMockAdapterInfo({ 
          name: 'adapter4', 
          status: AdapterStatus.Loading,
        }),
      ]
      
      act(() => {
        useAdapterStore.getState().setAdapters(adapters)
      })
    })
    
    it('应该正确更新统计信息', () => {
      act(() => {
        useAdapterStore.getState().updateStats()
      })
      
      const stats = useAdapterStore.getState().stats
      
      expect(stats.total).toBe(4)
      expect(stats.loaded).toBe(1)
      expect(stats.unloaded).toBe(1)
      expect(stats.error).toBe(1)
      expect(stats.loading).toBe(1)
      expect(stats.totalMemoryUsage).toBe(225) // 100 + 50 + 75 + 0
    })
    
    it('自动在设置适配器时更新统计信息', () => {
      // 统计信息应该已经在 beforeEach 中自动更新
      const stats = useAdapterStore.getState().stats
      expect(stats.total).toBe(4)
    })
  })

  // ==================== 工具方法测试 ====================

  describe('工具方法', () => {
    beforeEach(() => {
      const adapters = [
        createMockAdapterInfo({ name: 'adapter1', status: AdapterStatus.Loaded }),
        createMockAdapterInfo({ name: 'adapter2', status: AdapterStatus.Unloaded }),
        createMockAdapterInfo({ name: 'adapter3', status: AdapterStatus.Error }),
      ]
      
      act(() => {
        useAdapterStore.getState().setAdapters(adapters)
      })
    })
    
    it('应该正确根据ID获取适配器', () => {
      const adapter = useAdapterStore.getState().getAdapterById('adapter1')
      expect(adapter?.name).toBe('adapter1')
      
      const nonExistent = useAdapterStore.getState().getAdapterById('non-existent')
      expect(nonExistent).toBeUndefined()
    })
    
    it('应该正确根据状态获取适配器', () => {
      const loadedAdapters = useAdapterStore.getState().getAdaptersByStatus(AdapterStatus.Loaded)
      expect(loadedAdapters).toHaveLength(1)
      expect(loadedAdapters[0].name).toBe('adapter1')
      
      const errorAdapters = useAdapterStore.getState().getAdaptersByStatus(AdapterStatus.Error)
      expect(errorAdapters).toHaveLength(1)
      expect(errorAdapters[0].name).toBe('adapter3')
    })
    
    it('应该正确检查适配器是否已安装', () => {
      expect(useAdapterStore.getState().isAdapterInstalled('adapter1')).toBe(true)
      expect(useAdapterStore.getState().isAdapterInstalled('non-existent')).toBe(false)
    })
    
    it('应该正确检查适配器是否已加载', () => {
      expect(useAdapterStore.getState().isAdapterLoaded('adapter1')).toBe(true)
      expect(useAdapterStore.getState().isAdapterLoaded('adapter2')).toBe(false)
    })
    
    it('应该正确检查适配器是否正在操作', () => {
      const adapterId = 'adapter1'
      
      act(() => {
        useAdapterStore.getState().setInstalling(adapterId, true)
      })
      
      expect(useAdapterStore.getState().isAdapterOperating(adapterId)).toBe(true)
      
      act(() => {
        useAdapterStore.getState().setInstalling(adapterId, false)
      })
      
      expect(useAdapterStore.getState().isAdapterOperating(adapterId)).toBe(false)
    })
  })

  // ==================== 配置管理测试 ====================

  describe('配置管理', () => {
    it('应该正确更新配置', () => {
      const newConfig = {
        autoRefresh: false,
        refreshInterval: 60000,
        enableCache: false,
      }
      
      act(() => {
        useAdapterStore.getState().updateConfig(newConfig)
      })
      
      const config = useAdapterStore.getState().config
      expect(config.autoRefresh).toBe(false)
      expect(config.refreshInterval).toBe(60000)
      expect(config.enableCache).toBe(false)
      expect(config.cacheTtl).toBe(5 * 60 * 1000) // 应该保持原值
    })
  })

  // ==================== 重置功能测试 ====================

  describe('重置功能', () => {
    it('应该正确重置 Store 到初始状态', () => {
      // 设置一些状态
      act(() => {
        const store = useAdapterStore.getState()
        store.setAdapters([createMockAdapterInfo()])
        store.setLoading(true)
        store.setError('Test error')
        store.setFilters({ query: 'test' })
        store.addEvent({ type: 'loaded', adapterId: 'test' })
      })
      
      // 重置
      act(() => {
        useAdapterStore.getState().reset()
      })
      
      const state = useAdapterStore.getState()
      expect(state.adapters).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.lastError).toBeNull()
      expect(state.filters.query).toBe('')
      expect(state.events).toEqual([])
      expect(state.isInitialized).toBe(false)
    })
  })

  // ==================== 选择器测试 ====================

  describe('选择器', () => {
    it('选择器应该返回正确的状态值', () => {
      const adapters = [createMockAdapterInfo()]
      const error = 'Test error'
      
      act(() => {
        const store = useAdapterStore.getState()
        store.setAdapters(adapters)
        store.setLoading(true)
        store.setError(error)
        store.updateStats()
      })
      
      // 这里我们测试 store 本身，因为选择器导出的是函数
      const state = useAdapterStore.getState()
      expect(state.adapters).toEqual(adapters)
      expect(state.isLoading).toBe(true)
      expect(state.lastError).toBe(error)
      expect(state.stats.total).toBe(1)
      expect(state.operationState.installing.size).toBe(0)
    })
  })

  // ==================== Hook 集成测试 ====================

  describe('Hook 集成', () => {
    it('应该能够在 React Hook 中正确使用', () => {
      const { result } = renderHook(() => useAdapterStore())
      
      // 初始状态检查
      expect(result.current.adapters).toEqual([])
      expect(result.current.isLoading).toBe(false)
      
      // 测试状态更新
      act(() => {
        result.current.setLoading(true)
      })
      
      expect(result.current.isLoading).toBe(true)
    })
  })

  // ==================== 错误处理测试 ====================

  describe('错误处理', () => {
    it('应该正确处理操作错误', () => {
      // 模拟一些可能出错的操作
      const errorMessage = 'Operation failed'
      
      act(() => {
        useAdapterStore.getState().setError(errorMessage)
      })
      
      const state = useAdapterStore.getState()
      expect(state.lastError).toBe(errorMessage)
      expect(state.events.some(e => e.type === 'error')).toBe(true)
    })
  })
})
