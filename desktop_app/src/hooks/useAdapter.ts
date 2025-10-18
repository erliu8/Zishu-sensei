/**
 * 适配器管理 Hook
 * 
 * 提供适配器管理的所有功能，包括：
 * - 适配器列表管理
 * - 安装/卸载适配器
 * - 加载/卸载适配器
 * - 配置管理
 * - 状态监控
 * - 错误处理
 * - 事件监听
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdapterStore } from '@/stores/adapterStore'
import AdapterService, { 
  type AdapterInfo, 
  type AdapterMetadata, 
  type AdapterInstallRequest, 
  type AdapterExecutionRequest,
  type AdapterConfigUpdateRequest,
  type AdapterSearchRequest,
  AdapterStatus,
  AdapterType
} from '@/services/adapter'
import { PaginatedResponse } from '@/services/types'
import { useToast } from '@/contexts/ToastContext'

// ==================== 类型定义 ====================

export interface UseAdapterOptions {
  /** 是否自动刷新适配器列表 */
  autoRefresh?: boolean
  /** 刷新间隔（毫秒） */
  refreshInterval?: number
  /** 是否启用错误重试 */
  enableRetry?: boolean
  /** 最大重试次数 */
  maxRetries?: number
  /** 重试延迟（毫秒） */
  retryDelay?: number
}

export interface UseAdapterReturn {
  // 状态
  adapters: AdapterInfo[]
  installedAdapters: AdapterInfo[]
  loadedAdapters: AdapterInfo[]
  isLoading: boolean
  isInstalling: boolean
  isUninstalling: boolean
  isExecuting: boolean
  error: string | null
  lastUpdated: number | null
  
  // 操作
  refreshAdapters: () => Promise<void>
  installAdapter: (request: AdapterInstallRequest) => Promise<boolean>
  uninstallAdapter: (adapterId: string) => Promise<boolean>
  loadAdapter: (adapterId: string) => Promise<boolean>
  unloadAdapter: (adapterId: string) => Promise<boolean>
  executeAdapter: (request: AdapterExecutionRequest) => Promise<any>
  
  // 配置管理
  getAdapterConfig: (adapterId: string) => Promise<Record<string, any>>
  updateAdapterConfig: (request: AdapterConfigUpdateRequest) => Promise<boolean>
  
  // 搜索和详情
  searchAdapters: (request: AdapterSearchRequest) => Promise<PaginatedResponse<any>>
  getAdapterDetails: (adapterId: string) => Promise<AdapterMetadata>
  getAdapterStatus: (adapterId?: string) => Promise<any>
  
  // 工具方法
  isAdapterInstalled: (adapterId: string) => boolean
  isAdapterLoaded: (adapterId: string) => boolean
  getAdapterById: (adapterId: string) => AdapterInfo | undefined
  getAdaptersByStatus: (status: AdapterStatus) => AdapterInfo[]
  getAdaptersByType: (type: AdapterType) => AdapterInfo[]
  
  // 事件处理
  onAdapterInstalled: (callback: (adapter: AdapterInfo) => void) => () => void
  onAdapterUninstalled: (callback: (adapterId: string) => void) => () => void
  onAdapterLoaded: (callback: (adapter: AdapterInfo) => void) => () => void
  onAdapterUnloaded: (callback: (adapterId: string) => void) => () => void
  onAdapterError: (callback: (error: string, adapterId?: string) => void) => () => void
  
  // 清理
  cleanup: () => void
}

// ==================== Hook 实现 ====================

export function useAdapter(options: UseAdapterOptions = {}): UseAdapterReturn {
  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30秒
    enableRetry = true,
    maxRetries = 3,
    retryDelay = 1000
  } = options

  const { showToast } = useToast()
  const adapterStore = useAdapterStore()
  
  // 本地状态
  const [isInstalling, setIsInstalling] = useState(false)
  const [isUninstalling, setIsUninstalling] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  
  // 重试状态
  const retryCountRef = useRef(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 事件监听器
  const eventListenersRef = useRef<Map<string, Set<Function>>>(new Map())
  
  // 自动刷新定时器
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ==================== 核心方法 ====================

  /**
   * 刷新适配器列表
   */
  const refreshAdapters = useCallback(async () => {
    try {
      adapterStore.setLoading(true)
      setError(null)
      
      const adapters = await AdapterService.getAdapters()
      adapterStore.setAdapters(adapters)
      setLastUpdated(Date.now())
      
      // 重置重试计数
      retryCountRef.current = 0
      
      // 触发更新事件
      emitEvent('adapters_updated', adapters)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '刷新适配器列表失败'
      setError(errorMessage)
      
      // 重试逻辑
      if (enableRetry && retryCountRef.current < maxRetries) {
        retryCountRef.current++
        retryTimeoutRef.current = setTimeout(() => {
          refreshAdapters()
        }, retryDelay * retryCountRef.current)
        
        showToast({
          type: 'warning',
          title: '刷新失败',
          message: `${retryDelay * retryCountRef.current / 1000}秒后重试 (${retryCountRef.current}/${maxRetries})`
        })
      } else {
        showToast({
          type: 'error',
          title: '刷新失败',
          message: errorMessage
        })
        emitEvent('error', errorMessage)
      }
    } finally {
      adapterStore.setLoading(false)
    }
  }, [adapterStore, enableRetry, maxRetries, retryDelay, showToast])

  /**
   * 安装适配器
   */
  const installAdapter = useCallback(async (request: AdapterInstallRequest): Promise<boolean> => {
    try {
      setIsInstalling(true)
      setError(null)
      
      // 验证请求
      const validationErrors = AdapterService.validateInstallRequest(request)
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '))
      }
      
      const success = await AdapterService.installAdapter(request)
      
      if (success) {
        showToast({
          type: 'success',
          title: '安装成功',
          message: `适配器 ${request.adapter_id} 安装成功`
        })
        
        // 刷新列表
        await refreshAdapters()
        
        // 触发安装事件
        const adapter = adapterStore.adapters.find((a: AdapterInfo) => a.name === request.adapter_id)
        if (adapter) {
          emitEvent('adapter_installed', adapter)
        }
      }
      
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '安装适配器失败'
      setError(errorMessage)
      showToast({
        type: 'error',
        title: '安装失败',
        message: errorMessage
      })
      emitEvent('error', errorMessage, request.adapter_id)
      return false
    } finally {
      setIsInstalling(false)
    }
  }, [adapterStore, refreshAdapters, showToast])

  /**
   * 卸载适配器
   */
  const uninstallAdapter = useCallback(async (adapterId: string): Promise<boolean> => {
    try {
      setIsUninstalling(true)
      setError(null)
      
      const success = await AdapterService.uninstallAdapter(adapterId)
      
      if (success) {
        showToast({
          type: 'success',
          title: '卸载成功',
          message: `适配器 ${adapterId} 卸载成功`
        })
        
        // 刷新列表
        await refreshAdapters()
        
        // 触发卸载事件
        emitEvent('adapter_uninstalled', adapterId)
      }
      
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '卸载适配器失败'
      setError(errorMessage)
      showToast({
        type: 'error',
        title: '卸载失败',
        message: errorMessage
      })
      emitEvent('error', errorMessage, adapterId)
      return false
    } finally {
      setIsUninstalling(false)
    }
  }, [refreshAdapters, showToast])

  /**
   * 加载适配器
   */
  const loadAdapter = useCallback(async (adapterId: string): Promise<boolean> => {
    try {
      setError(null)
      
      const success = await AdapterService.loadAdapter(adapterId)
      
      if (success) {
        showToast({
          type: 'success',
          title: '加载成功',
          message: `适配器 ${adapterId} 加载成功`
        })
        
        // 刷新列表
        await refreshAdapters()
        
        // 触发加载事件
        const adapter = adapterStore.adapters.find((a: AdapterInfo) => a.name === adapterId)
        if (adapter) {
          emitEvent('adapter_loaded', adapter)
        }
      }
      
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载适配器失败'
      setError(errorMessage)
      showToast({
        type: 'error',
        title: '加载失败',
        message: errorMessage
      })
      emitEvent('error', errorMessage, adapterId)
      return false
    }
  }, [adapterStore, refreshAdapters, showToast])

  /**
   * 卸载适配器
   */
  const unloadAdapter = useCallback(async (adapterId: string): Promise<boolean> => {
    try {
      setError(null)
      
      const success = await AdapterService.unloadAdapter(adapterId)
      
      if (success) {
        showToast({
          type: 'success',
          title: '卸载成功',
          message: `适配器 ${adapterId} 卸载成功`
        })
        
        // 刷新列表
        await refreshAdapters()
        
        // 触发卸载事件
        emitEvent('adapter_unloaded', adapterId)
      }
      
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '卸载适配器失败'
      setError(errorMessage)
      showToast({
        type: 'error',
        title: '卸载失败',
        message: errorMessage
      })
      emitEvent('error', errorMessage, adapterId)
      return false
    }
  }, [refreshAdapters, showToast])

  /**
   * 执行适配器操作
   */
  const executeAdapter = useCallback(async (request: AdapterExecutionRequest): Promise<any> => {
    try {
      setIsExecuting(true)
      setError(null)
      
      const result = await AdapterService.executeAdapter(request)
      
      showToast({
        type: 'success',
        title: '执行成功',
        message: `适配器 ${request.adapter_id} 执行成功`
      })
      
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '执行适配器操作失败'
      setError(errorMessage)
      showToast({
        type: 'error',
        title: '执行失败',
        message: errorMessage
      })
      emitEvent('error', errorMessage, request.adapter_id)
      throw err
    } finally {
      setIsExecuting(false)
    }
  }, [showToast])

  /**
   * 获取适配器配置
   */
  const getAdapterConfig = useCallback(async (adapterId: string): Promise<Record<string, any>> => {
    try {
      setError(null)
      return await AdapterService.getAdapterConfig(adapterId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取适配器配置失败'
      setError(errorMessage)
      emitEvent('error', errorMessage, adapterId)
      throw err
    }
  }, [])

  /**
   * 更新适配器配置
   */
  const updateAdapterConfig = useCallback(async (request: AdapterConfigUpdateRequest): Promise<boolean> => {
    try {
      setError(null)
      
      const success = await AdapterService.updateAdapterConfig(request)
      
      if (success) {
        showToast({
          type: 'success',
          title: '配置更新成功',
          message: `适配器 ${request.adapter_id} 配置更新成功`
        })
        
        // 刷新列表
        await refreshAdapters()
      }
      
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新适配器配置失败'
      setError(errorMessage)
      showToast({
        type: 'error',
        title: '配置更新失败',
        message: errorMessage
      })
      emitEvent('error', errorMessage, request.adapter_id)
      return false
    }
  }, [refreshAdapters, showToast])

  /**
   * 搜索适配器
   */
  const searchAdapters = useCallback(async (request: AdapterSearchRequest): Promise<PaginatedResponse<any>> => {
    try {
      setError(null)
      return await AdapterService.searchAdapters(request)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '搜索适配器失败'
      setError(errorMessage)
      emitEvent('error', errorMessage)
      throw err
    }
  }, [])

  /**
   * 获取适配器详情
   */
  const getAdapterDetails = useCallback(async (adapterId: string): Promise<AdapterMetadata> => {
    try {
      setError(null)
      return await AdapterService.getAdapterDetails(adapterId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取适配器详情失败'
      setError(errorMessage)
      emitEvent('error', errorMessage, adapterId)
      throw err
    }
  }, [])

  /**
   * 获取适配器状态
   */
  const getAdapterStatus = useCallback(async (adapterId?: string): Promise<any> => {
    try {
      setError(null)
      return await AdapterService.getAdapterStatus(adapterId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取适配器状态失败'
      setError(errorMessage)
      emitEvent('error', errorMessage, adapterId)
      throw err
    }
  }, [])

  // ==================== 工具方法 ====================

  /**
   * 检查适配器是否已安装
   */
  const isAdapterInstalled = useCallback((adapterId: string): boolean => {
    return adapterStore.adapters.some(adapter => adapter.name === adapterId)
  }, [adapterStore.adapters])

  /**
   * 检查适配器是否已加载
   */
  const isAdapterLoaded = useCallback((adapterId: string): boolean => {
    return adapterStore.adapters.some(adapter => 
      adapter.name === adapterId && adapter.status === AdapterStatus.Loaded
    )
  }, [adapterStore.adapters])

  /**
   * 根据ID获取适配器
   */
  const getAdapterById = useCallback((adapterId: string): AdapterInfo | undefined => {
    return adapterStore.adapters.find(adapter => adapter.name === adapterId)
  }, [adapterStore.adapters])

  /**
   * 根据状态获取适配器列表
   */
  const getAdaptersByStatus = useCallback((status: AdapterStatus): AdapterInfo[] => {
    return adapterStore.adapters.filter(adapter => adapter.status === status)
  }, [adapterStore.adapters])

  /**
   * 根据类型获取适配器列表
   */
  const getAdaptersByType = useCallback((type: AdapterType): AdapterInfo[] => {
    // 注意：AdapterInfo 中没有 type 字段，这里需要从 metadata 中获取
    // 或者需要扩展 AdapterInfo 接口
    return adapterStore.adapters.filter(adapter => {
      // 这里需要根据实际的数据结构来实现
      return true // 临时返回所有适配器
    })
  }, [adapterStore.adapters])

  // ==================== 事件系统 ====================

  /**
   * 触发事件
   */
  const emitEvent = useCallback((eventType: string, ...args: any[]) => {
    const listeners = eventListenersRef.current.get(eventType)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args)
        } catch (err) {
          console.error(`事件监听器错误 (${eventType}):`, err)
        }
      })
    }
  }, [])

  /**
   * 添加事件监听器
   */
  const addEventListener = useCallback((eventType: string, listener: Function) => {
    if (!eventListenersRef.current.has(eventType)) {
      eventListenersRef.current.set(eventType, new Set())
    }
    eventListenersRef.current.get(eventType)!.add(listener)
    
    // 返回清理函数
    return () => {
      const listeners = eventListenersRef.current.get(eventType)
      if (listeners) {
        listeners.delete(listener)
        if (listeners.size === 0) {
          eventListenersRef.current.delete(eventType)
        }
      }
    }
  }, [])

  /**
   * 适配器安装事件监听器
   */
  const onAdapterInstalled = useCallback((callback: (adapter: AdapterInfo) => void) => {
    return addEventListener('adapter_installed', callback)
  }, [addEventListener])

  /**
   * 适配器卸载事件监听器
   */
  const onAdapterUninstalled = useCallback((callback: (adapterId: string) => void) => {
    return addEventListener('adapter_uninstalled', callback)
  }, [addEventListener])

  /**
   * 适配器加载事件监听器
   */
  const onAdapterLoaded = useCallback((callback: (adapter: AdapterInfo) => void) => {
    return addEventListener('adapter_loaded', callback)
  }, [addEventListener])

  /**
   * 适配器卸载事件监听器
   */
  const onAdapterUnloaded = useCallback((callback: (adapterId: string) => void) => {
    return addEventListener('adapter_unloaded', callback)
  }, [addEventListener])

  /**
   * 错误事件监听器
   */
  const onAdapterError = useCallback((callback: (error: string, adapterId?: string) => void) => {
    return addEventListener('error', callback)
  }, [addEventListener])

  // ==================== 生命周期 ====================

  /**
   * 清理资源
   */
  const cleanup = useCallback(() => {
    // 清理定时器
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    
    // 清理事件监听器
    eventListenersRef.current.clear()
  }, [])

  // 初始化
  useEffect(() => {
    // 初始加载
    refreshAdapters()
    
    // 设置自动刷新
    if (autoRefresh && refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        refreshAdapters()
      }, refreshInterval)
    }
    
    // 清理函数
    return cleanup
  }, [autoRefresh, refreshInterval, refreshAdapters, cleanup])

  // ==================== 返回接口 ====================

  return {
    // 状态
    adapters: adapterStore.adapters,
    installedAdapters: adapterStore.adapters,
    loadedAdapters: adapterStore.adapters.filter((a: AdapterInfo) => a.status === AdapterStatus.Loaded),
    isLoading: adapterStore.isLoading,
    isInstalling,
    isUninstalling,
    isExecuting,
    error,
    lastUpdated,
    
    // 操作
    refreshAdapters,
    installAdapter,
    uninstallAdapter,
    loadAdapter,
    unloadAdapter,
    executeAdapter,
    
    // 配置管理
    getAdapterConfig,
    updateAdapterConfig,
    
    // 搜索和详情
    searchAdapters,
    getAdapterDetails,
    getAdapterStatus,
    
    // 工具方法
    isAdapterInstalled,
    isAdapterLoaded,
    getAdapterById,
    getAdaptersByStatus,
    getAdaptersByType,
    
    // 事件处理
    onAdapterInstalled,
    onAdapterUninstalled,
    onAdapterLoaded,
    onAdapterUnloaded,
    onAdapterError,
    
    // 清理
    cleanup
  }
}

// ==================== 导出 ====================

export default useAdapter