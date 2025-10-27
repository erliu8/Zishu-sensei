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

  // 报告错误
  const reportError = useCallback(async (
    error: Error | ErrorDetails, 
    context?: Partial<ErrorContext>
  ): Promise<void> => {
    try {
      await errorMonitoringService.reportError(error, context)
      // 刷新错误列表和统计
      await refreshData()
    } catch (err) {
      console.error('Failed to report error:', err)
    }
  }, [])

  // 清理错误
  const clearErrors = useCallback(async (): Promise<void> => {
    try {
      await errorMonitoringService.cleanupOldErrors(0) // 清理所有错误
      setErrors([])
      await refreshStatistics()
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
      await refreshStatistics()
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

  // 刷新统计
  const refreshStatistics = useCallback(async () => {
    try {
      const newStats = await errorMonitoringService.getStatistics()
      setStatistics(newStats)
    } catch (err) {
      console.error('Failed to refresh statistics:', err)
    }
  }, [])

  // 初始化和清理
  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        setIsMonitoring(true)
        
        // 初始化服务
        await errorMonitoringService.initialize()
        
        // 加载初始数据
        if (mounted) {
          await refreshData()
        }

        // 设置错误监听器
        const unsubscribeError = errorMonitoringService.onError((error) => {
          if (mounted) {
            setErrors(prev => [error, ...prev].slice(0, 100)) // 保留最近100个错误
            refreshStatistics()
          }
        })

        // 设置恢复监听器
        const unsubscribeRecovery = errorMonitoringService.onRecovery((result) => {
          console.log('Recovery result:', result)
        })

        return () => {
          unsubscribeError()
          unsubscribeRecovery()
        }
      } catch (err) {
        console.error('Failed to initialize error monitor:', err)
        if (mounted) {
          setIsMonitoring(false)
        }
      }
    }

    const cleanup = initialize()

    return () => {
      mounted = false
      cleanup.then(fn => fn?.())
      setIsMonitoring(false)
    }
  }, [refreshData, refreshStatistics])

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
  const [filter, setFilter] = useState<ErrorFilter | undefined>(initialFilter)
  const [filteredErrors, setFilteredErrors] = useState<ErrorDetails[]>([])
  const { errors } = useErrorMonitor()

  useEffect(() => {
    if (filter) {
      setFilteredErrors(errors.filter(filter))
    } else {
      setFilteredErrors(errors)
    }
  }, [errors, filter])

  const updateFilter = useCallback((newFilter: ErrorFilter | undefined) => {
    setFilter(newFilter)
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
  const { statistics } = useErrorMonitor()
  const [isLoading, setIsLoading] = useState(false)

  const refreshStatistics = useCallback(async () => {
    setIsLoading(true)
    try {
      await errorMonitoringService.getStatistics()
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
    criticalErrorCount: statistics.bySeverity.critical || 0,
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

  const attemptRecovery = useCallback(async (error: Error): Promise<RecoveryResult> => {
    setIsRecovering(true)
    try {
      const result = await errorMonitoringService.handleError(error)
      setLastRecoveryResult(result)
      return result
    } finally {
      setIsRecovering(false)
    }
  }, [])

  const clearRecoveryResult = useCallback(() => {
    setLastRecoveryResult(null)
  }, [])

  return {
    isRecovering,
    lastRecoveryResult,
    attemptRecovery,
    clearRecoveryResult,
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
  const { reportError } = useErrorReporter()

  const executeAsync = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    context?: Partial<ErrorContext>
  ): Promise<T | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await asyncFn()
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      await reportError(error, context)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [reportError])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

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

  // 添加通知
  const addNotification = useCallback((error: ErrorDetails, duration = 5000) => {
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
  }, [])

  // 移除通知
  const removeNotification = useCallback((errorId: string) => {
    setNotifications(prev => prev.filter(n => n.errorId !== errorId))
    
    // 清理定时器
    const timeoutId = timeoutRefs.current.get(errorId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutRefs.current.delete(errorId)
    }
  }, [])

  // 清理所有通知
  const clearAllNotifications = useCallback(() => {
    setNotifications([])
    
    // 清理所有定时器
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId))
    timeoutRefs.current.clear()
  }, [])

  // 监听错误事件
  useEffect(() => {
    const unsubscribe = errorMonitoringService.onError((error) => {
      if (errorMonitoringService.getConfig().showErrorNotifications) {
        addNotification(error)
      }
    })

    return unsubscribe
  }, [addNotification])

  // 清理
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId))
      timeoutRefs.current.clear()
    }
  }, [])

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
  }
}

// ================================
// 导出所有 Hooks
// ================================

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
