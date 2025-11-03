/**
 * 错误监控 React Hooks
 * 提供错误处理、监控和恢复的 React 集成
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ErrorDetails,
  ErrorStatistics,
  ErrorMonitorConfig,
  UseErrorMonitorResult,
  ErrorContext,
  ErrorStatus,
  ErrorSeverity,
  ErrorType,
  ErrorSource,
  RecoveryResult,
  ErrorFilter,
} from '../types/error'
import { errorMonitoringService } from '../services/errorMonitoringService'

// ================================
// 主要错误监控 Hook
// ================================

/**
 * 错误监控主 Hook
 */
export function useErrorMonitor(): UseErrorMonitorResult {
  const [errors, setErrors] = useState<ErrorDetails[]>([])
  const [statistics, setStatistics] = useState<ErrorStatistics>({
    totalErrors: 0,
    newErrors: 0,
    resolvedErrors: 0,
    bySeverity: {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0,
    },
    byType: {
      [ErrorType.JAVASCRIPT]: 0,
      [ErrorType.REACT]: 0,
      [ErrorType.RUST]: 0,
      [ErrorType.SYSTEM]: 0,
      [ErrorType.NETWORK]: 0,
      [ErrorType.API]: 0,
      [ErrorType.TIMEOUT]: 0,
      [ErrorType.VALIDATION]: 0,
      [ErrorType.PERMISSION]: 0,
      [ErrorType.NOT_FOUND]: 0,
      [ErrorType.MEMORY]: 0,
      [ErrorType.FILE]: 0,
      [ErrorType.DATABASE]: 0,
      [ErrorType.USER_INPUT]: 0,
      [ErrorType.CONFIGURATION]: 0,
      [ErrorType.UNKNOWN]: 0,
    },
    bySource: {
      [ErrorSource.FRONTEND]: 0,
      [ErrorSource.BACKEND]: 0,
      [ErrorSource.SYSTEM]: 0,
      [ErrorSource.EXTERNAL]: 0,
    },
    hourlyTrend: [],
    topErrors: [],
  })
  const [isMonitoring, setIsMonitoring] = useState(false)
  
  // 刷新数据的引用，避免在 useCallback 中依赖自己
  const refreshDataRef = useRef<() => Promise<void>>()

  // 报告错误
  const reportError = useCallback(async (
    error: Error | ErrorDetails, 
    context?: Partial<ErrorContext>
  ): Promise<void> => {
    try {
      await errorMonitoringService.reportError(error, context)
      // 刷新错误列表和统计
      await refreshDataRef.current?.()
    } catch (err) {
      console.error('Failed to report error:', err)
    }
  }, [])

  // 刷新统计的引用
  const refreshStatisticsRef = useRef<() => Promise<void>>()

  // 清理错误
  const clearErrors = useCallback(async (): Promise<void> => {
    try {
      await errorMonitoringService.cleanupOldErrors(0) // 清理所有错误
      setErrors([])
      await refreshStatisticsRef.current?.()
    } catch (err) {
      console.error('Failed to clear errors:', err)
    }
  }, [])

  // 解决错误
  const resolveError = useCallback(async (errorId: string, resolution?: string): Promise<void> => {
    try {
      await errorMonitoringService.resolveError(errorId, resolution)
      // 更新本地错误列表
      setErrors(prev => prev.map(error => 
        error.errorId === errorId 
          ? { ...error, status: ErrorStatus.RESOLVED, resolved: true }
          : error
      ))
      await refreshStatisticsRef.current?.()
    } catch (err) {
      console.error('Failed to resolve error:', err)
    }
  }, [])

  // 重试错误
  const retryError = useCallback(async (_errorId: string): Promise<RecoveryResult> => {
    // 这里可以实现具体的重试逻辑
    return {
      success: true,
      strategy: 'retry' as any,
      attempts: 1,
      duration: 0,
      message: 'Error retry initiated',
    }
  }, [])

  // 更新配置
  const updateConfig = useCallback(async (newConfig: Partial<ErrorMonitorConfig>): Promise<void> => {
    try {
      await errorMonitoringService.updateConfig(newConfig)
    } catch (err) {
      console.error('Failed to update config:', err)
    }
  }, [])

  // 获取配置
  const getConfig = useCallback((): ErrorMonitorConfig => {
    return errorMonitoringService.getConfig()
  }, [])

  // 刷新统计
  const refreshStatistics = useCallback(async () => {
    try {
      const newStats = await errorMonitoringService.getStatistics()
      setStatistics(newStats)
    } catch (err) {
      console.error('Failed to refresh statistics:', err)
    }
  }, [])

  // 刷新数据
  const refreshData = useCallback(async () => {
    try {
      const [newErrors, newStats] = await Promise.all([
        errorMonitoringService.getErrors(undefined, 100),
        errorMonitoringService.getStatistics(),
      ])
      setErrors(newErrors)
      setStatistics(newStats)
    } catch (err) {
      console.error('Failed to refresh error data:', err)
    }
  }, [])

  // 设置引用
  useEffect(() => {
    refreshDataRef.current = refreshData
    refreshStatisticsRef.current = refreshStatistics
  }, [refreshData, refreshStatistics])

  // 初始化和清理
  useEffect(() => {
    let mounted = true

    let unsubscribeError: (() => void) | null = null
    let unsubscribeRecovery: (() => void) | null = null
    
    const initialize = async () => {
      try {
        // 初始化服务
        await errorMonitoringService.initialize()
        
        // 加载初始数据
        if (mounted) {
          await refreshData()
          setIsMonitoring(true)
        }

        // 设置错误监听器
        unsubscribeError = errorMonitoringService.onError((error) => {
          if (mounted) {
            setErrors(prev => [error, ...prev].slice(0, 100)) // 保留最近100个错误
            refreshStatistics()
          }
        })

        // 设置恢复监听器
        unsubscribeRecovery = errorMonitoringService.onRecovery((result) => {
          console.log('Recovery result:', result)
        })
      } catch (err) {
        console.error('Failed to initialize error monitor:', err)
        if (mounted) {
          setIsMonitoring(false)
        }
      }
    }

    initialize()

    return () => {
      mounted = false
      if (unsubscribeError) unsubscribeError()
      if (unsubscribeRecovery) unsubscribeRecovery()
      setIsMonitoring(false)
    }
  }, [])

  return {
    errors,
    statistics,
    isMonitoring,
    reportError,
    clearErrors,
    resolveError,
    retryError,
    updateConfig,
    getConfig,
  }
}

// ================================
// 错误报告 Hook
// ================================

/**
 * 错误报告 Hook
 */
export function useErrorReporter() {
  const reportError = useCallback(async (
    error: Error | ErrorDetails,
    context?: Partial<ErrorContext>
  ): Promise<string> => {
    return errorMonitoringService.reportError(error, context)
  }, [])

  const reportAsyncError = useCallback(async (
    asyncFn: () => Promise<any>,
    context?: Partial<ErrorContext>
  ): Promise<any> => {
    try {
      return await asyncFn()
    } catch (error) {
      if (error instanceof Error) {
        await reportError(error, {
          ...context,
          operation: context?.operation || 'async_operation',
        })
      }
      throw error
    }
  }, [reportError])

  return {
    reportError,
    reportAsyncError,
  }
}

// ================================
// 错误过滤 Hook
// ================================

/**
 * 错误过滤 Hook
 */
export function useErrorFilter(initialFilter?: ErrorFilter) {
  const [filter, setFilter] = useState<ErrorFilter | undefined>()
  const [filteredErrors, setFilteredErrors] = useState<ErrorDetails[]>([])
  const [errors, setErrors] = useState<ErrorDetails[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // 监听错误变化
  useEffect(() => {
    const loadErrors = async () => {
      try {
        const allErrors = await errorMonitoringService.getErrors(undefined, 100)
        // 确保返回的是有效数组，且每个元素都是有效的对象
        const validErrors = Array.isArray(allErrors) 
          ? allErrors.filter(error => error && typeof error === 'object' && error.errorId) 
          : []
        setErrors(validErrors)
        setIsLoaded(true)
      } catch (err) {
        console.error('Failed to load errors for filter:', err)
        setErrors([])
        setIsLoaded(true)
      }
    }

    loadErrors()

    // 监听新错误
    try {
      const unsubscribe = errorMonitoringService.onError((error) => {
        if (error && typeof error === 'object' && error.errorId) {
          setErrors(prev => [error, ...prev].slice(0, 100))
        }
      })

      return unsubscribe
    } catch (err) {
      console.error('Failed to set up error listener for filter:', err)
      return () => {}
    }
  }, [])

  // 只在数据加载完成后设置初始过滤器
  useEffect(() => {
    if (isLoaded && initialFilter && !filter) {
      setFilter(() => initialFilter)
    }
  }, [isLoaded, initialFilter, filter])

  useEffect(() => {
    if (filter && isLoaded) {
      try {
        setFilteredErrors(errors.filter(filter))
      } catch (err) {
        console.error('Filter error:', err)
        setFilteredErrors(errors)
      }
    } else {
      setFilteredErrors(errors)
    }
  }, [errors, filter, isLoaded])

  const updateFilter = useCallback((newFilter: ErrorFilter | undefined) => {
    setFilter(() => newFilter)
  }, [])

  const clearFilter = useCallback(() => {
    setFilter(undefined)
  }, [])

  return {
    filteredErrors,
    filter,
    updateFilter,
    clearFilter,
  }
}

// ================================
// 错误统计 Hook
// ================================

/**
 * 错误统计 Hook
 */
export function useErrorStatistics() {
  const [statistics, setStatistics] = useState<ErrorStatistics>({
    totalErrors: 0,
    newErrors: 0,
    resolvedErrors: 0,
    bySeverity: {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0,
    },
    byType: {
      [ErrorType.JAVASCRIPT]: 0,
      [ErrorType.REACT]: 0,
      [ErrorType.RUST]: 0,
      [ErrorType.SYSTEM]: 0,
      [ErrorType.NETWORK]: 0,
      [ErrorType.API]: 0,
      [ErrorType.TIMEOUT]: 0,
      [ErrorType.VALIDATION]: 0,
      [ErrorType.PERMISSION]: 0,
      [ErrorType.NOT_FOUND]: 0,
      [ErrorType.MEMORY]: 0,
      [ErrorType.FILE]: 0,
      [ErrorType.DATABASE]: 0,
      [ErrorType.USER_INPUT]: 0,
      [ErrorType.CONFIGURATION]: 0,
      [ErrorType.UNKNOWN]: 0,
    },
    bySource: {
      [ErrorSource.FRONTEND]: 0,
      [ErrorSource.BACKEND]: 0,
      [ErrorSource.SYSTEM]: 0,
      [ErrorSource.EXTERNAL]: 0,
    },
    hourlyTrend: [],
    topErrors: [],
  })
  const [isLoading, setIsLoading] = useState(false)

  // 初始加载统计数据
  useEffect(() => {
    const loadStatistics = async () => {
      setIsLoading(true)
      try {
        const stats = await errorMonitoringService.getStatistics()
        setStatistics(stats)
      } catch (err) {
        console.error('Failed to load statistics:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadStatistics()
  }, [])

  const refreshStatistics = useCallback(async () => {
    setIsLoading(true)
    try {
      const stats = await errorMonitoringService.getStatistics()
      setStatistics(stats)
    } catch (err) {
      console.error('Failed to refresh statistics:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 计算派生统计
  const derivedStats = {
    errorRate: statistics.totalErrors > 0 
      ? Math.round((statistics.newErrors / statistics.totalErrors) * 100)
      : 0,
    resolutionRate: statistics.totalErrors > 0
      ? Math.round((statistics.resolvedErrors / statistics.totalErrors) * 100)
      : 0,
    criticalErrorCount: statistics.bySeverity[ErrorSeverity.CRITICAL] || 0,
    mostCommonType: Object.entries(statistics.byType)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown',
  }

  return {
    statistics,
    derivedStats,
    isLoading,
    refreshStatistics,
  }
}

// ================================
// 错误恢复 Hook
// ================================

/**
 * 错误恢复 Hook
 */
export function useErrorRecovery() {
  const [isRecovering, setIsRecovering] = useState(false)
  const [lastRecoveryResult, setLastRecoveryResult] = useState<RecoveryResult | null>(null)

  const attemptRecovery = async (error: Error): Promise<RecoveryResult> => {
    try {
      setIsRecovering(true)
      
      // 添加更长的延迟确保状态更新被检测到
      await new Promise(resolve => setTimeout(resolve, 50))
      
      try {
        const result = await errorMonitoringService.handleError(error)
        setLastRecoveryResult(result)
        return result
      } catch (err) {
        console.error('Recovery failed:', err)
        const failedResult: RecoveryResult = {
          success: false,
          strategy: 'none' as any,
          attempts: 1,
          duration: 0,
          error: err instanceof Error ? err.message : String(err)
        }
        setLastRecoveryResult(failedResult)
        return failedResult
      }
    } catch (err) {
      console.error('attemptRecovery error:', err)
      return {
        success: false,
        strategy: 'none' as any,
        attempts: 0,
        duration: 0,
        error: String(err)
      }
    } finally {
      setIsRecovering(false)
    }
  }

  const clearRecoveryResult = () => {
    try {
      setLastRecoveryResult(null)
    } catch (err) {
      console.error('Failed to clear recovery result:', err)
    }
  }

  try {
    return {
      isRecovering,
      lastRecoveryResult,
      attemptRecovery,
      clearRecoveryResult,
    }
  } catch (err) {
    console.error('useErrorRecovery hook error:', err)
    return {
      isRecovering: false,
      lastRecoveryResult: null,
      attemptRecovery: async () => ({ 
        success: false, 
        strategy: 'none' as any, 
        attempts: 0, 
        duration: 0,
        error: 'Hook initialization failed'
      }),
      clearRecoveryResult: () => {},
    }
  }
}

// ================================
// 异步操作错误处理 Hook
// ================================

/**
 * 异步操作错误处理 Hook
 */
export function useAsyncError() {
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const executeAsync = async <T>(
    asyncFn: () => Promise<T>,
    context?: Partial<ErrorContext>
  ): Promise<T | null> => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await asyncFn()
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      // 直接报告错误，避免循环依赖
      try {
        await errorMonitoringService.reportError(error, context)
      } catch (reportErr) {
        console.error('Failed to report error:', reportErr)
      }
      return null
    } finally {
      try {
        setIsLoading(false)
      } catch (err) {
        console.error('Failed to set loading state:', err)
      }
    }
  }

  const clearError = () => {
    try {
      setError(null)
    } catch (err) {
      console.error('Failed to clear error:', err)
    }
  }

  return {
    error,
    isLoading,
    executeAsync,
    clearError,
  }
}

// ================================
// 错误通知 Hook
// ================================

/**
 * 错误通知 Hook
 */
export function useErrorNotification() {
  const [notifications, setNotifications] = useState<ErrorDetails[]>([])
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // 移除通知函数需要先定义
  const removeNotification = (errorId: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.errorId !== errorId))
      
      // 清理定时器
      const timeoutId = timeoutRefs.current.get(errorId)
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutRefs.current.delete(errorId)
      }
    } catch (err) {
      console.error('Failed to remove notification:', err)
    }
  }

  // 添加通知
  const addNotification = (error: ErrorDetails, duration = 5000) => {
    try {
      setNotifications(prev => {
        const existing = prev.find(n => n.errorId === error.errorId)
        if (existing) {
          return prev // 避免重复通知
        }
        return [...prev, error]
      })

      // 设置自动移除
      if (duration > 0) {
        const timeoutId = setTimeout(() => {
          removeNotification(error.errorId)
        }, duration)
        
        timeoutRefs.current.set(error.errorId, timeoutId)
      }
    } catch (err) {
      console.error('Failed to add notification:', err)
    }
  }

  // 清理所有通知
  const clearAllNotifications = () => {
    try {
      setNotifications([])
      
      // 清理所有定时器
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId))
      timeoutRefs.current.clear()
    } catch (err) {
      console.error('Failed to clear notifications:', err)
    }
  }

  // 监听错误事件
  useEffect(() => {
    try {
      const unsubscribe = errorMonitoringService.onError((error) => {
        try {
          if (errorMonitoringService.getConfig().showErrorNotifications) {
            setNotifications(prev => {
              const existing = prev.find(n => n.errorId === error.errorId)
              if (existing) {
                return prev // 避免重复通知
              }
              return [...prev, error]
            })
          }
        } catch (err) {
          console.error('Error in notification handler:', err)
        }
      })

      return unsubscribe
    } catch (err) {
      console.error('Failed to set up error listener:', err)
      return () => {} // 返回空的清理函数
    }
  }, [])

  // 清理
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId))
      timeoutRefs.current.clear()
    }
  }, [])

  try {
    return {
      notifications,
      addNotification,
      removeNotification,
      clearAllNotifications,
    }
  } catch (err) {
    console.error('useErrorNotification hook error:', err)
    return {
      notifications: [],
      addNotification: () => {},
      removeNotification: () => {},
      clearAllNotifications: () => {},
    }
  }
}

// ================================
// 导出所有 Hooks
// ================================

// 明确导出所有 Hook - 通过默认导出组处理

export {
  useErrorMonitor as default,
}

// 便于批量导入
export const ErrorHooks = {
  useErrorMonitor,
  useErrorReporter,
  useErrorFilter,
  useErrorStatistics,
  useErrorRecovery,
  useAsyncError,
  useErrorNotification,
}
