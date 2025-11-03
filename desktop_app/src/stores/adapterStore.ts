/**
 * 适配器状态管理 Store
 * 
 * 使用 Zustand 管理适配器相关的所有状态，包括：
 * - 适配器列表和详细信息
 * - 安装/卸载状态
 * - 加载/卸载状态
 * - 配置管理
 * - 搜索和过滤
 * - 统计信息
 * - 事件系统
 * - 缓存管理
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { 
  type AdapterInfo, 
  type AdapterMetadata, 
  AdapterStatus,
  AdapterType,
  CapabilityLevel
} from '@/services/adapter'
import { PaginatedResponse } from '@/services/types'

// ==================== 类型定义 ====================

/**
 * 适配器统计信息
 */
export interface AdapterStats {
  total: number
  loaded: number
  unloaded: number
  loading: number
  unloading: number
  error: number
  maintenance: number
  byType: Record<AdapterType, number>
  byCapability: Record<CapabilityLevel, number>
  totalMemoryUsage: number
  averageLoadTime: number
}

/**
 * 适配器搜索和过滤状态
 */
export interface AdapterFilters {
  query: string
  status: AdapterStatus[]
  type: AdapterType[]
  capability: CapabilityLevel[]
  tags: string[]
  installed: boolean | null
  loaded: boolean | null
  sortBy: 'name' | 'status' | 'loadTime' | 'memoryUsage' | 'version'
  sortOrder: 'asc' | 'desc'
}

/**
 * 适配器操作状态
 */
export interface AdapterOperationState {
  installing: Set<string>
  uninstalling: Set<string>
  loading: Set<string>
  unloading: Set<string>
  executing: Set<string>
  updating: Set<string>
}

/**
 * 适配器缓存
 */
export interface AdapterCache {
  metadata: Map<string, AdapterMetadata>
  configs: Map<string, Record<string, any>>
  searchResults: Map<string, PaginatedResponse<any>>
  lastUpdated: Map<string, number>
  ttl: number // 缓存过期时间（毫秒）
}

/**
 * 适配器事件
 */
export interface AdapterEvent {
  type: 'installed' | 'uninstalled' | 'loaded' | 'unloaded' | 'error' | 'updated'
  adapterId: string
  timestamp: number
  data?: any
  error?: string
}

/**
 * 适配器状态接口
 */
export interface AdapterState {
  // 基础状态
  adapters: AdapterInfo[]
  isLoading: boolean
  isInitialized: boolean
  lastError: string | null
  lastUpdated: number | null
  
  // 操作状态
  operationState: AdapterOperationState
  
  // 搜索和过滤
  filters: AdapterFilters
  searchResults: PaginatedResponse<any> | null
  isSearching: boolean
  
  // 统计信息
  stats: AdapterStats
  
  // 缓存
  cache: AdapterCache
  
  // 事件历史
  events: AdapterEvent[]
  maxEvents: number
  
  // 配置
  config: {
    autoRefresh: boolean
    refreshInterval: number
    enableCache: boolean
    cacheTtl: number
    maxEvents: number
  }
}

/**
 * 适配器操作接口
 */
export interface AdapterActions {
  // 基础操作
  setAdapters: (adapters: AdapterInfo[]) => void
  addAdapter: (adapter: AdapterInfo) => void
  updateAdapter: (adapterId: string, updates: Partial<AdapterInfo>) => void
  removeAdapter: (adapterId: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setInitialized: (initialized: boolean) => void
  
  // 操作状态管理
  setInstalling: (adapterId: string, installing: boolean) => void
  setUninstalling: (adapterId: string, uninstalling: boolean) => void
  setAdapterLoading: (adapterId: string, loading: boolean) => void
  setUnloading: (adapterId: string, unloading: boolean) => void
  setExecuting: (adapterId: string, executing: boolean) => void
  setUpdating: (adapterId: string, updating: boolean) => void
  
  // 搜索和过滤
  setFilters: (filters: Partial<AdapterFilters>) => void
  resetFilters: () => void
  setSearchResults: (results: PaginatedResponse<any> | null) => void
  setSearching: (searching: boolean) => void
  
  // 缓存管理
  setCacheMetadata: (adapterId: string, metadata: AdapterMetadata) => void
  getCacheMetadata: (adapterId: string) => AdapterMetadata | null
  setCacheConfig: (adapterId: string, config: Record<string, any>) => void
  getCacheConfig: (adapterId: string) => Record<string, any> | null
  setCacheSearchResults: (key: string, results: PaginatedResponse<any>) => void
  getCacheSearchResults: (key: string) => PaginatedResponse<any> | null
  clearCache: () => void
  clearExpiredCache: () => void
  
  // 事件管理
  addEvent: (event: Omit<AdapterEvent, 'timestamp'>) => void
  clearEvents: () => void
  getEventsByAdapter: (adapterId: string) => AdapterEvent[]
  getRecentEvents: (limit?: number) => AdapterEvent[]
  
  // 统计更新
  updateStats: () => void
  
  // 工具方法
  getAdapterById: (adapterId: string) => AdapterInfo | undefined
  getAdaptersByStatus: (status: AdapterStatus) => AdapterInfo[]
  getAdaptersByType: (type: AdapterType) => AdapterInfo[]
  getFilteredAdapters: () => AdapterInfo[]
  isAdapterInstalled: (adapterId: string) => boolean
  isAdapterLoaded: (adapterId: string) => boolean
  isAdapterOperating: (adapterId: string) => boolean
  
  // 配置管理
  updateConfig: (config: Partial<AdapterState['config']>) => void
  
  // 重置
  reset: () => void
}

// ==================== 默认值 ====================

const defaultFilters: AdapterFilters = {
  query: '',
  status: [],
  type: [],
  capability: [],
  tags: [],
  installed: null,
  loaded: null,
  sortBy: 'name',
  sortOrder: 'asc'
}

const defaultOperationState: AdapterOperationState = {
  installing: new Set(),
  uninstalling: new Set(),
  loading: new Set(),
  unloading: new Set(),
  executing: new Set(),
  updating: new Set()
}

const defaultStats: AdapterStats = {
  total: 0,
  loaded: 0,
  unloaded: 0,
  loading: 0,
  unloading: 0,
  error: 0,
  maintenance: 0,
  byType: {
    [AdapterType.Soft]: 0,
    [AdapterType.Hard]: 0,
    [AdapterType.Intelligent]: 0
  },
  byCapability: {
    [CapabilityLevel.Basic]: 0,
    [CapabilityLevel.Intermediate]: 0,
    [CapabilityLevel.Advanced]: 0,
    [CapabilityLevel.Expert]: 0
  },
  totalMemoryUsage: 0,
  averageLoadTime: 0
}

const defaultCache: AdapterCache = {
  metadata: new Map(),
  configs: new Map(),
  searchResults: new Map(),
  lastUpdated: new Map(),
  ttl: 5 * 60 * 1000 // 5分钟
}

const defaultConfig = {
  autoRefresh: true,
  refreshInterval: 30000, // 30秒
  enableCache: true,
  cacheTtl: 5 * 60 * 1000, // 5分钟
  maxEvents: 100
}

// ==================== Store 实现 ====================

export const useAdapterStore = create<AdapterState & AdapterActions>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // ==================== 初始状态 ====================
          
          adapters: [],
          isLoading: false,
          isInitialized: false,
          lastError: null,
          lastUpdated: null,
          
          operationState: defaultOperationState,
          
          filters: defaultFilters,
          searchResults: null,
          isSearching: false,
          
          stats: defaultStats,
          
          cache: defaultCache,
          
          events: [],
          maxEvents: defaultConfig.maxEvents,
          
          config: defaultConfig,
          
          // ==================== 基础操作 ====================
          
          setAdapters: (adapters) => set((state) => {
            state.adapters = adapters
            state.lastUpdated = Date.now()
            state.isInitialized = true
            state.lastError = null
          }),
          
          addAdapter: (adapter) => set((state) => {
            const existingIndex = state.adapters.findIndex((a: AdapterInfo) => a.name === adapter.name)
            if (existingIndex >= 0) {
              state.adapters[existingIndex] = adapter
            } else {
              state.adapters.push(adapter)
            }
            state.lastUpdated = Date.now()
          }),
          
          updateAdapter: (adapterId, updates) => set((state) => {
            const index = state.adapters.findIndex((a: AdapterInfo) => a.name === adapterId)
            if (index >= 0) {
              Object.assign(state.adapters[index], updates)
              state.lastUpdated = Date.now()
            }
          }),
          
          removeAdapter: (adapterId) => set((state) => {
            state.adapters = state.adapters.filter((a: AdapterInfo) => a.name !== adapterId)
            state.lastUpdated = Date.now()
          }),
          
          setLoading: (loading) => set((state) => {
            state.isLoading = loading
          }),
          
          setError: (error) => set((state) => {
            state.lastError = error
            if (error) {
              state.events.push({
                type: 'error',
                adapterId: '',
                timestamp: Date.now(),
                error
              })
            }
          }),
          
          setInitialized: (initialized) => set((state) => {
            state.isInitialized = initialized
          }),
          
          // ==================== 操作状态管理 ====================
          
          setInstalling: (adapterId, installing) => set((state) => {
            if (installing) {
              state.operationState.installing.add(adapterId)
            } else {
              state.operationState.installing.delete(adapterId)
            }
          }),
          
          setUninstalling: (adapterId, uninstalling) => set((state) => {
            if (uninstalling) {
              state.operationState.uninstalling.add(adapterId)
            } else {
              state.operationState.uninstalling.delete(adapterId)
            }
          }),
          
          setAdapterLoading: (adapterId, loading) => set((state) => {
            if (loading) {
              state.operationState.loading.add(adapterId)
            } else {
              state.operationState.loading.delete(adapterId)
            }
          }),
          
          setUnloading: (adapterId, unloading) => set((state) => {
            if (unloading) {
              state.operationState.unloading.add(adapterId)
            } else {
              state.operationState.unloading.delete(adapterId)
            }
          }),
          
          setExecuting: (adapterId, executing) => set((state) => {
            if (executing) {
              state.operationState.executing.add(adapterId)
            } else {
              state.operationState.executing.delete(adapterId)
            }
          }),
          
          setUpdating: (adapterId, updating) => set((state) => {
            if (updating) {
              state.operationState.updating.add(adapterId)
            } else {
              state.operationState.updating.delete(adapterId)
            }
          }),
          
          // ==================== 搜索和过滤 ====================
          
          setFilters: (filters) => set((state) => {
            Object.assign(state.filters, filters)
          }),
          
          resetFilters: () => set((state) => {
            state.filters = { ...defaultFilters }
          }),
          
          setSearchResults: (results) => set((state) => {
            state.searchResults = results
          }),
          
          setSearching: (searching) => set((state) => {
            state.isSearching = searching
          }),
          
          // ==================== 缓存管理 ====================
          
          setCacheMetadata: (adapterId, metadata) => set((state) => {
            state.cache.metadata.set(adapterId, metadata)
            state.cache.lastUpdated.set(adapterId, Date.now())
          }),
          
          getCacheMetadata: (adapterId) => {
            const state = get()
            const metadata = state.cache.metadata.get(adapterId)
            const lastUpdated = state.cache.lastUpdated.get(adapterId)
            
            if (!metadata || !lastUpdated) return null
            
            // 检查是否过期
            if (Date.now() - lastUpdated > state.cache.ttl) {
              state.cache.metadata.delete(adapterId)
              state.cache.lastUpdated.delete(adapterId)
              return null
            }
            
            return metadata
          },
          
          setCacheConfig: (adapterId, config) => set((state) => {
            state.cache.configs.set(adapterId, config)
            state.cache.lastUpdated.set(adapterId, Date.now())
          }),
          
          getCacheConfig: (adapterId) => {
            const state = get()
            const config = state.cache.configs.get(adapterId)
            const lastUpdated = state.cache.lastUpdated.get(adapterId)
            
            if (!config || !lastUpdated) return null
            
            // 检查是否过期
            if (Date.now() - lastUpdated > state.cache.ttl) {
              state.cache.configs.delete(adapterId)
              state.cache.lastUpdated.delete(adapterId)
              return null
            }
            
            return config
          },
          
          setCacheSearchResults: (key, results) => set((state) => {
            state.cache.searchResults.set(key, results)
            state.cache.lastUpdated.set(key, Date.now())
          }),
          
          getCacheSearchResults: (key) => {
            const state = get()
            const results = state.cache.searchResults.get(key)
            const lastUpdated = state.cache.lastUpdated.get(key)
            
            if (!results || !lastUpdated) return null
            
            // 检查是否过期
            if (Date.now() - lastUpdated > state.cache.ttl) {
              state.cache.searchResults.delete(key)
              state.cache.lastUpdated.delete(key)
              return null
            }
            
            return results
          },
          
          clearCache: () => set((state) => {
            state.cache.metadata.clear()
            state.cache.configs.clear()
            state.cache.searchResults.clear()
            state.cache.lastUpdated.clear()
          }),
          
          clearExpiredCache: () => set((state) => {
            const now = Date.now()
            const ttl = state.cache.ttl
            
            // 清理过期的元数据
            for (const [key, timestamp] of state.cache.lastUpdated.entries()) {
              if (now - timestamp > ttl) {
                state.cache.metadata.delete(key)
                state.cache.configs.delete(key)
                state.cache.searchResults.delete(key)
                state.cache.lastUpdated.delete(key)
              }
            }
          }),
          
          // ==================== 事件管理 ====================
          
          addEvent: (event) => set((state) => {
            const fullEvent: AdapterEvent = {
              ...event,
              timestamp: Date.now()
            }
            
            state.events.push(fullEvent)
            
            // 限制事件数量
            if (state.events.length > state.maxEvents) {
              state.events = state.events.slice(-state.maxEvents)
            }
          }),
          
          clearEvents: () => set((state) => {
            state.events = []
          }),
          
          getEventsByAdapter: (adapterId) => {
            const state = get()
            return state.events.filter(event => event.adapterId === adapterId)
          },
          
          getRecentEvents: (limit = 10) => {
            const state = get()
            return state.events.slice(-limit)
          },
          
          // ==================== 统计更新 ====================
          
          updateStats: () => set((state) => {
            const adapters = state.adapters
            
            // 重置统计
            const stats: AdapterStats = {
              total: adapters.length,
              loaded: 0,
              unloaded: 0,
              loading: 0,
              unloading: 0,
              error: 0,
              maintenance: 0,
              byType: {
                [AdapterType.Soft]: 0,
                [AdapterType.Hard]: 0,
                [AdapterType.Intelligent]: 0
              },
              byCapability: {
                [CapabilityLevel.Basic]: 0,
                [CapabilityLevel.Intermediate]: 0,
                [CapabilityLevel.Advanced]: 0,
                [CapabilityLevel.Expert]: 0
              },
              totalMemoryUsage: 0,
              averageLoadTime: 0
            }
            
            // 计算统计信息
            let totalLoadTime = 0
            let loadTimeCount = 0
            
            adapters.forEach((adapter: AdapterInfo) => {
              // 状态统计
              switch (adapter.status) {
                case AdapterStatus.Loaded:
                  stats.loaded++
                  break
                case AdapterStatus.Unloaded:
                  stats.unloaded++
                  break
                case AdapterStatus.Loading:
                  stats.loading++
                  break
                case AdapterStatus.Unloading:
                  stats.unloading++
                  break
                case AdapterStatus.Error:
                  stats.error++
                  break
                case AdapterStatus.Maintenance:
                  stats.maintenance++
                  break
              }
              
              // 内存使用统计
              if (adapter.memory_usage) {
                stats.totalMemoryUsage += adapter.memory_usage
              }
              
              // 加载时间统计
              if (adapter.load_time) {
                totalLoadTime += new Date(adapter.load_time).getTime()
                loadTimeCount++
              }
            })
            
            // 计算平均加载时间
            if (loadTimeCount > 0) {
              stats.averageLoadTime = totalLoadTime / loadTimeCount
            }
            
            state.stats = stats
          }),
          
          // ==================== 工具方法 ====================
          
          getAdapterById: (adapterId) => {
            const state = get()
            return state.adapters.find(adapter => adapter.name === adapterId)
          },
          
          getAdaptersByStatus: (status) => {
            const state = get()
            return state.adapters.filter(adapter => adapter.status === status)
          },
          
          getAdaptersByType: (_type) => {
            const state = get()
            // 注意：这里需要根据实际的数据结构来实现
            // 可能需要从 metadata 中获取类型信息
            return state.adapters.filter(_adapter => {
              // 临时实现，返回所有适配器
              return true
            })
          },
          
          getFilteredAdapters: () => {
            const state = get()
            let filtered = [...state.adapters]
            
            // 应用查询过滤
            if (state.filters.query) {
              const query = state.filters.query.toLowerCase()
              filtered = filtered.filter(adapter =>
                adapter.name.toLowerCase().includes(query) ||
                adapter.description?.toLowerCase().includes(query) ||
                adapter.version?.toLowerCase().includes(query)
              )
            }
            
            // 应用状态过滤
            if (state.filters.status.length > 0) {
              filtered = filtered.filter(adapter =>
                state.filters.status.includes(adapter.status)
              )
            }
            
            // 应用安装状态过滤
            if (state.filters.installed !== null) {
              filtered = filtered.filter(adapter =>
                state.filters.installed ? true : adapter.status === AdapterStatus.Unloaded
              )
            }
            
            // 应用加载状态过滤
            if (state.filters.loaded !== null) {
              filtered = filtered.filter(adapter =>
                state.filters.loaded ? adapter.status === AdapterStatus.Loaded : adapter.status !== AdapterStatus.Loaded
              )
            }
            
            // 应用排序
            filtered.sort((a, b) => {
              let aValue: any, bValue: any
              
              switch (state.filters.sortBy) {
                case 'name':
                  aValue = a.name
                  bValue = b.name
                  break
                case 'status':
                  aValue = a.status
                  bValue = b.status
                  break
                case 'loadTime':
                  aValue = a.load_time ? new Date(a.load_time).getTime() : 0
                  bValue = b.load_time ? new Date(b.load_time).getTime() : 0
                  break
                case 'memoryUsage':
                  aValue = a.memory_usage || 0
                  bValue = b.memory_usage || 0
                  break
                case 'version':
                  aValue = a.version || ''
                  bValue = b.version || ''
                  break
                default:
                  aValue = a.name
                  bValue = b.name
              }
              
              if (state.filters.sortOrder === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
              } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
              }
            })
            
            return filtered
          },
          
          isAdapterInstalled: (adapterId) => {
            const state = get()
            return state.adapters.some(adapter => adapter.name === adapterId)
          },
          
          isAdapterLoaded: (adapterId) => {
            const state = get()
            return state.adapters.some(adapter =>
              adapter.name === adapterId && adapter.status === AdapterStatus.Loaded
            )
          },
          
          isAdapterOperating: (adapterId) => {
            const state = get()
            const { operationState } = state
            return (
              operationState.installing.has(adapterId) ||
              operationState.uninstalling.has(adapterId) ||
              operationState.loading.has(adapterId) ||
              operationState.unloading.has(adapterId) ||
              operationState.executing.has(adapterId) ||
              operationState.updating.has(adapterId)
            )
          },
          
          // ==================== 配置管理 ====================
          
          updateConfig: (config) => set((state) => {
            Object.assign(state.config, config)
          }),
          
          // ==================== 重置 ====================
          
          reset: () => set((state) => {
            state.adapters = []
            state.isLoading = false
            state.isInitialized = false
            state.lastError = null
            state.lastUpdated = null
            state.operationState = { ...defaultOperationState }
            state.filters = { ...defaultFilters }
            state.searchResults = null
            state.isSearching = false
            state.stats = { ...defaultStats }
            state.cache = { ...defaultCache }
            state.events = []
          })
        })),
        {
          name: 'adapter-store',
          partialize: (state) => ({
            adapters: state.adapters,
            filters: state.filters,
            config: state.config,
            cache: state.cache,
            events: state.events.slice(-50) // 只持久化最近50个事件
          })
        }
      )
    ),
    {
      name: 'adapter-store'
    }
  )
)

// ==================== 选择器 ====================

/**
 * 获取适配器列表选择器
 */
export const selectAdapters = (state: AdapterState) => state.adapters

/**
 * 获取加载状态选择器
 */
export const selectIsLoading = (state: AdapterState) => state.isLoading

/**
 * 获取错误状态选择器
 */
export const selectError = (state: AdapterState) => state.lastError

/**
 * 获取统计信息选择器
 */
export const selectStats = (state: AdapterState) => state.stats

/**
 * 获取过滤后的适配器选择器
 */
export const selectFilteredAdapters = (state: AdapterState & AdapterActions) => 
  state.getFilteredAdapters()

/**
 * 获取操作状态选择器
 */
export const selectOperationState = (state: AdapterState) => state.operationState

/**
 * 获取缓存状态选择器
 */
export const selectCache = (state: AdapterState) => state.cache

/**
 * 获取事件历史选择器
 */
export const selectEvents = (state: AdapterState) => state.events

// ==================== 导出 ====================

export default useAdapterStore
