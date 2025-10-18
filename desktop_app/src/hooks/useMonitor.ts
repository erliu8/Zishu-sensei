/**
 * 显示器信息 Hook
 * 
 * 提供显示器信息的 React Hook，支持：
 * - 获取桌面信息
 * - 监听显示器变化
 * - 自动刷新
 * - 缓存管理
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import monitorService from '@/services/monitorService'
import type { DesktopInfo, MonitorInfo } from '@/types/monitor'
import { createEmptyDesktopInfo } from '@/types/monitor'

/**
 * Hook 配置选项
 */
export interface UseMonitorOptions {
  /** 是否自动获取桌面信息 */
  autoFetch?: boolean
  /** 是否监听显示器变化事件 */
  listenForChanges?: boolean
  /** 自动刷新间隔（毫秒），0 表示不自动刷新 */
  refreshInterval?: number
  /** 错误回调 */
  onError?: (error: Error) => void
  /** 显示器变化回调 */
  onChange?: (desktopInfo: DesktopInfo) => void
}

/**
 * Hook 返回值
 */
export interface UseMonitorReturn {
  /** 桌面信息 */
  desktopInfo: DesktopInfo | null
  /** 主显示器 */
  primaryMonitor: MonitorInfo | null
  /** 所有显示器 */
  monitors: MonitorInfo[]
  /** 显示器数量 */
  monitorCount: number
  /** 是否正在加载 */
  isLoading: boolean
  /** 错误信息 */
  error: Error | null
  /** 是否已初始化 */
  isInitialized: boolean
  
  /** 刷新桌面信息 */
  refresh: () => Promise<void>
  /** 获取指定位置的显示器 */
  getMonitorAt: (x: number, y: number) => Promise<MonitorInfo | null>
  /** 获取主显示器 */
  getPrimary: () => Promise<MonitorInfo>
  /** 获取所有显示器 */
  getAll: () => Promise<MonitorInfo[]>
  /** 清除错误 */
  clearError: () => void
}

/**
 * 显示器信息 Hook
 * 
 * @param options - Hook 配置选项
 * @returns Hook 返回值
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { desktopInfo, isLoading, refresh } = useMonitor({
 *     autoFetch: true,
 *     listenForChanges: true,
 *     refreshInterval: 30000, // 每30秒刷新一次
 *   })
 * 
 *   if (isLoading) return <div>加载中...</div>
 * 
 *   return (
 *     <div>
 *       <p>显示器数量: {desktopInfo?.monitor_count}</p>
 *       <button onClick={refresh}>刷新</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useMonitor(options: UseMonitorOptions = {}): UseMonitorReturn {
  const {
    autoFetch = true,
    listenForChanges = true,
    refreshInterval = 0,
    onError,
    onChange,
  } = options

  // 状态
  const [desktopInfo, setDesktopInfo] = useState<DesktopInfo | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

  // Refs
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const unlistenRef = useRef<(() => void) | null>(null)
  const previousDesktopInfoRef = useRef<DesktopInfo | null>(null)

  /**
   * 刷新桌面信息
   */
  const refresh = useCallback(async () => {
    if (isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const info = await monitorService.getDesktopInfo()
      
      // 检查是否有变化
      if (previousDesktopInfoRef.current && onChange) {
        const changes = monitorService.detectChanges(previousDesktopInfoRef.current, info)
        if (changes.hasChanges) {
          console.log('[useMonitor] 检测到显示器配置变化:', changes)
          onChange(info)
        }
      }

      previousDesktopInfoRef.current = info
      setDesktopInfo(info)
      setIsInitialized(true)

      console.log('[useMonitor] 桌面信息刷新成功:', {
        monitorCount: info.monitor_count,
        primaryMonitor: info.primary_monitor.name,
        virtualScreen: `${info.virtual_screen.total_width}x${info.virtual_screen.total_height}`,
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      console.error('[useMonitor] 刷新桌面信息失败:', error)
      
      if (onError) {
        onError(error)
      }
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, onChange, onError])

  /**
   * 获取指定位置的显示器
   */
  const getMonitorAt = useCallback(async (x: number, y: number): Promise<MonitorInfo | null> => {
    try {
      return await monitorService.getMonitorAtPosition(x, y)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      console.error('[useMonitor] 获取显示器失败:', error)
      
      if (onError) {
        onError(error)
      }
      
      return null
    }
  }, [onError])

  /**
   * 获取主显示器
   */
  const getPrimary = useCallback(async (): Promise<MonitorInfo> => {
    try {
      return await monitorService.getPrimaryMonitor()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      console.error('[useMonitor] 获取主显示器失败:', error)
      
      if (onError) {
        onError(error)
      }
      
      throw error
    }
  }, [onError])

  /**
   * 获取所有显示器
   */
  const getAll = useCallback(async (): Promise<MonitorInfo[]> => {
    try {
      return await monitorService.getAllMonitors()
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      console.error('[useMonitor] 获取所有显示器失败:', error)
      
      if (onError) {
        onError(error)
      }
      
      return []
    }
  }, [onError])

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * 初始化
   */
  useEffect(() => {
    if (autoFetch && !isInitialized) {
      refresh()
    }
  }, [autoFetch, isInitialized, refresh])

  /**
   * 设置定时刷新
   */
  useEffect(() => {
    if (refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        refresh()
      }, refreshInterval)

      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current)
          refreshTimerRef.current = null
        }
      }
    }
  }, [refreshInterval, refresh])

  /**
   * 监听显示器变化事件
   */
  useEffect(() => {
    if (listenForChanges) {
      const setupListener = async () => {
        try {
          // 监听系统显示器配置变化事件（如果 Tauri 支持）
          const unlisten = await listen('monitor-changed', () => {
            console.log('[useMonitor] 收到显示器变化事件，刷新信息')
            refresh()
          })
          
          unlistenRef.current = unlisten
        } catch (err) {
          console.warn('[useMonitor] 无法设置显示器变化监听:', err)
        }
      }

      setupListener()

      return () => {
        if (unlistenRef.current) {
          unlistenRef.current()
          unlistenRef.current = null
        }
      }
    }
  }, [listenForChanges, refresh])

  /**
   * 清理
   */
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
      if (unlistenRef.current) {
        unlistenRef.current()
      }
    }
  }, [])

  return {
    desktopInfo,
    primaryMonitor: desktopInfo?.primary_monitor || null,
    monitors: desktopInfo?.monitors || [],
    monitorCount: desktopInfo?.monitor_count || 0,
    isLoading,
    error,
    isInitialized,
    refresh,
    getMonitorAt,
    getPrimary,
    getAll,
    clearError,
  }
}

/**
 * 简化版 Hook - 只获取桌面信息
 */
export function useDesktopInfo(autoFetch = true) {
  const { desktopInfo, isLoading, error, refresh } = useMonitor({
    autoFetch,
    listenForChanges: false,
    refreshInterval: 0,
  })

  return { desktopInfo, isLoading, error, refresh }
}

/**
 * 简化版 Hook - 只获取主显示器
 */
export function usePrimaryMonitor(autoFetch = true) {
  const { primaryMonitor, isLoading, error, refresh } = useMonitor({
    autoFetch,
    listenForChanges: false,
    refreshInterval: 0,
  })

  return { primaryMonitor, isLoading, error, refresh }
}

/**
 * 简化版 Hook - 获取所有显示器
 */
export function useAllMonitors(autoFetch = true) {
  const { monitors, isLoading, error, refresh } = useMonitor({
    autoFetch,
    listenForChanges: false,
    refreshInterval: 0,
  })

  return { monitors, isLoading, error, refresh }
}

/**
 * 默认导出
 */
export default useMonitor

