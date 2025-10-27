/**
 * useErrorMonitor Hooks 测试套件
 * 
 * 测试错误监控相关的所有 Hooks，包括错误报告、统计、恢复等
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import {
  useErrorMonitor,
  useErrorReporter,
  useErrorFilter,
  useErrorStatistics,
  useErrorRecovery,
  useAsyncError,
  useErrorNotification,
} from '@/hooks/useErrorMonitor'
import {
  ErrorStatus,
  ErrorSeverity,
  ErrorType,
  ErrorSource,
  RecoveryStrategy,
  type ErrorDetails,
  type ErrorStatistics,
  type RecoveryResult,
  type ErrorMonitorConfig,
} from '@/types/error'
import { mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// Mock objects need to be hoisted to work with vi.mock
const { mockErrorMonitoringService } = vi.hoisted(() => ({
  mockErrorMonitoringService: {
    initialize: vi.fn(),
    reportError: vi.fn(),
    getErrors: vi.fn(),
    getStatistics: vi.fn(),
    resolveError: vi.fn(),
    cleanupOldErrors: vi.fn(),
    handleError: vi.fn(),
    updateConfig: vi.fn(),
    getConfig: vi.fn(),
    onError: vi.fn(),
    onRecovery: vi.fn(),
  },
}))

vi.mock('@/services/errorMonitoringService', () => ({
  errorMonitoringService: mockErrorMonitoringService,
}))

// ==================== 测试数据 ====================

const mockError: ErrorDetails = {
  id: 'error-1',
  errorId: 'error-1',
  type: ErrorType.JAVASCRIPT,
  source: ErrorSource.FRONTEND,
  name: 'TypeError',
  message: 'Test error message',
  severity: ErrorSeverity.MEDIUM,
  status: ErrorStatus.NEW,
  stack: 'Error stack trace',
  context: {
    timestamp: '2025-01-01T00:00:00Z',
    sessionId: 'test-session',
    platform: 'linux',
    appVersion: '1.0.0',
    buildVersion: '1.0.0',
    component: 'TestComponent',
    operation: 'test_operation',
  },
  occurrenceCount: 1,
  firstOccurred: '2025-01-01T00:00:00Z',
  lastOccurred: '2025-01-01T00:00:00Z',
  resolved: false,
}

const mockErrors: ErrorDetails[] = [
  mockError,
  {
    ...mockError,
    id: 'error-2',
    errorId: 'error-2',
    severity: ErrorSeverity.HIGH,
    status: ErrorStatus.ACKNOWLEDGED,
  },
  {
    ...mockError,
    id: 'error-3',
    errorId: 'error-3',
    severity: ErrorSeverity.LOW,
    status: ErrorStatus.RESOLVED,
    resolved: true,
  },
]

const mockStatistics: ErrorStatistics = {
  totalErrors: 100,
  newErrors: 10,
  resolvedErrors: 80,
  bySeverity: {
    [ErrorSeverity.LOW]: 20,
    [ErrorSeverity.MEDIUM]: 50,
    [ErrorSeverity.HIGH]: 25,
    [ErrorSeverity.CRITICAL]: 5,
  },
  byType: {
    [ErrorType.JAVASCRIPT]: 40,
    [ErrorType.NETWORK]: 30,
    [ErrorType.VALIDATION]: 30,
  } as Record<ErrorType, number>,
  bySource: {
    [ErrorSource.FRONTEND]: 60,
    [ErrorSource.BACKEND]: 40,
  } as Record<ErrorSource, number>,
  hourlyTrend: [
    { hour: '00:00', count: 10 },
    { hour: '01:00', count: 15 },
    { hour: '02:00', count: 20 },
    { hour: '03:00', count: 25 },
    { hour: '04:00', count: 30 },
  ],
  topErrors: [
    {
      errorId: 'error-1',
      message: 'Most frequent error',
      count: 50,
      severity: ErrorSeverity.HIGH,
    },
  ],
}

const mockRecoveryResult: RecoveryResult = {
  success: true,
  strategy: RecoveryStrategy.RETRY,
  attempts: 1,
  duration: 100,
  message: 'Recovery successful',
}

const mockConfig: ErrorMonitorConfig = {
  enabled: true,
  logLevel: 'error',
  captureJSErrors: true,
  capturePromiseRejections: true,
  captureReactErrors: true,
  captureConsoleErrors: true,
  maxStoredErrors: 1000,
  storageRetentionDays: 30,
  reportConfig: {
    enabled: true,
    minSeverity: ErrorSeverity.MEDIUM,
    blacklistedTypes: [],
    rateLimitEnabled: true,
    maxReportsPerMinute: 10,
    includeUserData: true,
    includeSystemInfo: true,
    maskSensitiveData: true,
    batchEnabled: true,
    batchSize: 10,
    batchTimeout: 5000,
  },
  enableAutoRecovery: true,
  recoveryTimeout: 5000,
  showErrorNotifications: true,
  showErrorDialog: true,
  allowUserReporting: true,
}

// ==================== 测试套件 ====================

describe('useErrorMonitor Hook', () => {
  const consoleMock = mockConsole()

  beforeEach(() => {
    consoleMock.mockAll()
    vi.clearAllMocks()
    
    mockErrorMonitoringService.initialize.mockResolvedValue(undefined)
    mockErrorMonitoringService.getErrors.mockResolvedValue(mockErrors)
    mockErrorMonitoringService.getStatistics.mockResolvedValue(mockStatistics)
    mockErrorMonitoringService.reportError.mockResolvedValue('error-id')
    mockErrorMonitoringService.resolveError.mockResolvedValue(undefined)
    mockErrorMonitoringService.cleanupOldErrors.mockResolvedValue(10)
    mockErrorMonitoringService.getConfig.mockReturnValue(mockConfig)
    mockErrorMonitoringService.updateConfig.mockResolvedValue(undefined)
    
    // Mock event listeners
    mockErrorMonitoringService.onError.mockReturnValue(() => {})
    mockErrorMonitoringService.onRecovery.mockReturnValue(() => {})
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础功能', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useErrorMonitor())

      expect(result.current.errors).toEqual([])
      expect(result.current.isMonitoring).toBe(false)
      expect(result.current.statistics).toBeDefined()
      expect(typeof result.current.reportError).toBe('function')
      expect(typeof result.current.clearErrors).toBe('function')
      expect(typeof result.current.resolveError).toBe('function')
    })

    it('应该初始化错误监控', async () => {
      const { result } = renderHook(() => useErrorMonitor())

      await waitFor(() => {
        expect(result.current.isMonitoring).toBe(true)
        expect(result.current.errors).toEqual(mockErrors)
      })

      expect(mockErrorMonitoringService.initialize).toHaveBeenCalled()
      expect(mockErrorMonitoringService.getErrors).toHaveBeenCalled()
      expect(mockErrorMonitoringService.getStatistics).toHaveBeenCalled()
    })

    it('应该报告错误', async () => {
      const { result } = renderHook(() => useErrorMonitor())

      await waitFor(() => {
        expect(result.current.isMonitoring).toBe(true)
      })

      const testError = new Error('Test error')
      await act(async () => {
        await result.current.reportError(testError, {
          component: 'TestComponent',
        })
      })

      expect(mockErrorMonitoringService.reportError).toHaveBeenCalledWith(
        testError,
        { component: 'TestComponent' }
      )
    })

    it('应该清除所有错误', async () => {
      const { result } = renderHook(() => useErrorMonitor())

      await waitFor(() => {
        expect(result.current.errors).toEqual(mockErrors)
      })

      await act(async () => {
        await result.current.clearErrors()
      })

      expect(mockErrorMonitoringService.cleanupOldErrors).toHaveBeenCalledWith(0)
    })

    it('应该解决错误', async () => {
      const { result } = renderHook(() => useErrorMonitor())

      await waitFor(() => {
        expect(result.current.errors).toEqual(mockErrors)
      })

      await act(async () => {
        await result.current.resolveError('error-1', '已修复')
      })

      expect(mockErrorMonitoringService.resolveError).toHaveBeenCalledWith(
        'error-1',
        '已修复'
      )

      // 验证本地状态已更新
      const resolvedError = result.current.errors.find(e => e.errorId === 'error-1')
      expect(resolvedError?.status).toBe(ErrorStatus.RESOLVED)
      expect(resolvedError?.resolved).toBe(true)
    })

    it('应该更新配置', async () => {
      const { result } = renderHook(() => useErrorMonitor())

      await waitFor(() => {
        expect(result.current.isMonitoring).toBe(true)
      })

      const newConfig = {
        maxStoredErrors: 500,
        enableAutoRecovery: false,
      }

      await act(async () => {
        await result.current.updateConfig(newConfig)
      })

      expect(mockErrorMonitoringService.updateConfig).toHaveBeenCalledWith(
        newConfig
      )
    })

    it('应该获取当前配置', () => {
      const { result } = renderHook(() => useErrorMonitor())

      const config = result.current.getConfig()

      expect(config).toEqual(mockConfig)
    })
  })

  describe('事件监听', () => {
    it('应该监听新错误事件', async () => {
      let errorCallback: ((error: ErrorDetails) => void) | null = null
      
      mockErrorMonitoringService.onError.mockImplementation((cb) => {
        errorCallback = cb
        return () => {}
      })

      const { result } = renderHook(() => useErrorMonitor())

      await waitFor(() => {
        expect(result.current.isMonitoring).toBe(true)
      })

      // 触发新错误事件
      const newError: ErrorDetails = {
        ...mockError,
        errorId: 'error-new',
      }

      act(() => {
        errorCallback?.(newError)
      })

      await waitFor(() => {
        expect(result.current.errors).toContainEqual(newError)
      })
    })

    it('应该限制错误列表长度', async () => {
      let errorCallback: ((error: ErrorDetails) => void) | null = null
      
      mockErrorMonitoringService.onError.mockImplementation((cb) => {
        errorCallback = cb
        return () => {}
      })

      const { result } = renderHook(() => useErrorMonitor())

      await waitFor(() => {
        expect(result.current.isMonitoring).toBe(true)
      })

      // 添加超过 100 个错误
      for (let i = 0; i < 110; i++) {
        act(() => {
          errorCallback?.({
            ...mockError,
            errorId: `error-${i}`,
          })
        })
      }

      await waitFor(() => {
        expect(result.current.errors.length).toBe(100)
      })
    })
  })

  describe('清理和卸载', () => {
    it('应该在卸载时清理事件监听器', async () => {
      const unsubscribeError = vi.fn()
      const unsubscribeRecovery = vi.fn()

      mockErrorMonitoringService.onError.mockReturnValue(unsubscribeError)
      mockErrorMonitoringService.onRecovery.mockReturnValue(unsubscribeRecovery)

      const { unmount } = renderHook(() => useErrorMonitor())

      await waitFor(() => {
        expect(mockErrorMonitoringService.onError).toHaveBeenCalled()
      })

      unmount()

      expect(unsubscribeError).toHaveBeenCalled()
      expect(unsubscribeRecovery).toHaveBeenCalled()
    })
  })
})

describe('useErrorReporter Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockErrorMonitoringService.reportError.mockResolvedValue('error-id')
  })

  describe('错误报告', () => {
    it('应该报告错误', async () => {
      const { result } = renderHook(() => useErrorReporter())

      const testError = new Error('Test error')
      let errorId: string = ''

      await act(async () => {
        errorId = await result.current.reportError(testError)
      })

      expect(errorId).toBe('error-id')
      expect(mockErrorMonitoringService.reportError).toHaveBeenCalledWith(
        testError,
        undefined
      )
    })

    it('应该报告带上下文的错误', async () => {
      const { result } = renderHook(() => useErrorReporter())

      const testError = new Error('Test error')
      const context = {
        component: 'TestComponent',
        operation: 'test_operation',
      }

      await act(async () => {
        await result.current.reportError(testError, context)
      })

      expect(mockErrorMonitoringService.reportError).toHaveBeenCalledWith(
        testError,
        context
      )
    })

    it('应该报告异步操作中的错误', async () => {
      const { result } = renderHook(() => useErrorReporter())

      const asyncFn = async () => {
        throw new Error('Async error')
      }

      await expect(
        act(async () => {
          await result.current.reportAsyncError(asyncFn)
        })
      ).rejects.toThrow('Async error')

      expect(mockErrorMonitoringService.reportError).toHaveBeenCalled()
    })

    it('异步操作成功时不应报告错误', async () => {
      const { result } = renderHook(() => useErrorReporter())

      const asyncFn = async () => {
        return 'success'
      }

      let returnValue: any
      await act(async () => {
        returnValue = await result.current.reportAsyncError(asyncFn)
      })

      expect(returnValue).toBe('success')
      expect(mockErrorMonitoringService.reportError).not.toHaveBeenCalled()
    })
  })
})

describe('useErrorFilter Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockErrorMonitoringService.initialize.mockResolvedValue(undefined)
    mockErrorMonitoringService.getErrors.mockResolvedValue(mockErrors)
    mockErrorMonitoringService.getStatistics.mockResolvedValue(mockStatistics)
    mockErrorMonitoringService.onError.mockReturnValue(() => {})
    mockErrorMonitoringService.onRecovery.mockReturnValue(() => {})
    mockErrorMonitoringService.getConfig.mockReturnValue(mockConfig)
  })

  describe('错误过滤', () => {
    it('应该过滤错误', async () => {
      const filter = (error: ErrorDetails) => 
        error.severity === ErrorSeverity.HIGH

      const { result } = renderHook(() => useErrorFilter(filter))

      await waitFor(() => {
        expect(result.current.filteredErrors).toHaveLength(1)
        expect(result.current.filteredErrors[0].severity).toBe(ErrorSeverity.HIGH)
      })
    })

    it('应该更新过滤器', async () => {
      const { result } = renderHook(() => useErrorFilter())

      await waitFor(() => {
        expect(result.current.filteredErrors).toEqual(mockErrors)
      })

      act(() => {
        result.current.updateFilter((error: ErrorDetails) => 
          error.status === ErrorStatus.RESOLVED
        )
      })

      expect(result.current.filteredErrors).toHaveLength(1)
      expect(result.current.filteredErrors[0].status).toBe(ErrorStatus.RESOLVED)
    })

    it('应该清除过滤器', async () => {
      const filter = (error: ErrorDetails) => 
        error.severity === ErrorSeverity.HIGH

      const { result } = renderHook(() => useErrorFilter(filter))

      await waitFor(() => {
        expect(result.current.filteredErrors).toHaveLength(1)
      })

      act(() => {
        result.current.clearFilter()
      })

      expect(result.current.filteredErrors).toEqual(mockErrors)
    })
  })
})

describe('useErrorStatistics Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockErrorMonitoringService.initialize.mockResolvedValue(undefined)
    mockErrorMonitoringService.getErrors.mockResolvedValue(mockErrors)
    mockErrorMonitoringService.getStatistics.mockResolvedValue(mockStatistics)
    mockErrorMonitoringService.onError.mockReturnValue(() => {})
    mockErrorMonitoringService.onRecovery.mockReturnValue(() => {})
    mockErrorMonitoringService.getConfig.mockReturnValue(mockConfig)
  })

  describe('统计信息', () => {
    it('应该返回统计信息', async () => {
      const { result } = renderHook(() => useErrorStatistics())

      await waitFor(() => {
        expect(result.current.statistics).toEqual(mockStatistics)
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('应该计算派生统计', async () => {
      const { result } = renderHook(() => useErrorStatistics())

      await waitFor(() => {
        expect(result.current.derivedStats.errorRate).toBe(10)
        expect(result.current.derivedStats.resolutionRate).toBe(80)
        expect(result.current.derivedStats.criticalErrorCount).toBe(5)
        expect(result.current.derivedStats.mostCommonType).toBe(ErrorType.JAVASCRIPT)
      })
    })

    it('应该刷新统计信息', async () => {
      const { result } = renderHook(() => useErrorStatistics())

      await waitFor(() => {
        expect(result.current.statistics).toEqual(mockStatistics)
      })

      mockErrorMonitoringService.getStatistics.mockClear()

      await act(async () => {
        await result.current.refreshStatistics()
      })

      expect(mockErrorMonitoringService.getStatistics).toHaveBeenCalled()
    })
  })
})

describe('useErrorRecovery Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockErrorMonitoringService.handleError.mockResolvedValue(mockRecoveryResult)
  })

  describe('错误恢复', () => {
    it('应该尝试恢复错误', async () => {
      const { result } = renderHook(() => useErrorRecovery())

      const testError = new Error('Test error')
      let recoveryResult: RecoveryResult | null = null

      await act(async () => {
        recoveryResult = await result.current.attemptRecovery(testError)
      })

      expect(recoveryResult).toEqual(mockRecoveryResult)
      expect(result.current.lastRecoveryResult).toEqual(mockRecoveryResult)
      expect(mockErrorMonitoringService.handleError).toHaveBeenCalledWith(
        testError
      )
    })

    it('应该跟踪恢复状态', async () => {
      const { result } = renderHook(() => useErrorRecovery())

      const testError = new Error('Test error')

      expect(result.current.isRecovering).toBe(false)

      const promise = act(async () => {
        await result.current.attemptRecovery(testError)
      })

      await waitFor(() => {
        expect(result.current.isRecovering).toBe(true)
      })

      await promise

      expect(result.current.isRecovering).toBe(false)
    })

    it('应该清除恢复结果', async () => {
      const { result } = renderHook(() => useErrorRecovery())

      const testError = new Error('Test error')

      await act(async () => {
        await result.current.attemptRecovery(testError)
      })

      expect(result.current.lastRecoveryResult).toEqual(mockRecoveryResult)

      act(() => {
        result.current.clearRecoveryResult()
      })

      expect(result.current.lastRecoveryResult).toBe(null)
    })
  })
})

describe('useAsyncError Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockErrorMonitoringService.reportError.mockResolvedValue('error-id')
  })

  describe('异步错误处理', () => {
    it('应该执行成功的异步操作', async () => {
      const { result } = renderHook(() => useAsyncError())

      const asyncFn = async () => 'success'
      let returnValue: any

      await act(async () => {
        returnValue = await result.current.executeAsync(asyncFn)
      })

      expect(returnValue).toBe('success')
      expect(result.current.error).toBe(null)
    })

    it('应该捕获并报告异步错误', async () => {
      const { result } = renderHook(() => useAsyncError())

      const testError = new Error('Async error')
      const asyncFn = async () => {
        throw testError
      }

      let returnValue: any
      await act(async () => {
        returnValue = await result.current.executeAsync(asyncFn)
      })

      expect(returnValue).toBe(null)
      expect(result.current.error).toEqual(testError)
      expect(mockErrorMonitoringService.reportError).toHaveBeenCalled()
    })

    it('应该跟踪加载状态', async () => {
      const { result } = renderHook(() => useAsyncError())

      const asyncFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'success'
      }

      expect(result.current.isLoading).toBe(false)

      const promise = act(async () => {
        await result.current.executeAsync(asyncFn)
      })

      expect(result.current.isLoading).toBe(true)

      await promise

      expect(result.current.isLoading).toBe(false)
    })

    it('应该清除错误', async () => {
      const { result } = renderHook(() => useAsyncError())

      const asyncFn = async () => {
        throw new Error('Test error')
      }

      await act(async () => {
        await result.current.executeAsync(asyncFn)
      })

      expect(result.current.error).toBeTruthy()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBe(null)
    })
  })
})

describe('useErrorNotification Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockErrorMonitoringService.onError.mockReturnValue(() => {})
    mockErrorMonitoringService.getConfig.mockReturnValue(mockConfig)
  })

  describe('错误通知', () => {
    it('应该添加通知', () => {
      const { result } = renderHook(() => useErrorNotification())

      act(() => {
        result.current.addNotification(mockError)
      })

      expect(result.current.notifications).toContainEqual(mockError)
    })

    it('应该自动移除通知', async () => {
      vi.useFakeTimers()

      const { result } = renderHook(() => useErrorNotification())

      act(() => {
        result.current.addNotification(mockError, 1000)
      })

      expect(result.current.notifications).toHaveLength(1)

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      await waitFor(() => {
        expect(result.current.notifications).toHaveLength(0)
      })

      vi.useRealTimers()
    })

    it('应该移除指定通知', () => {
      const { result } = renderHook(() => useErrorNotification())

      act(() => {
        result.current.addNotification(mockError)
        result.current.addNotification({
          ...mockError,
          errorId: 'error-2',
        })
      })

      expect(result.current.notifications).toHaveLength(2)

      act(() => {
        result.current.removeNotification('error-1')
      })

      expect(result.current.notifications).toHaveLength(1)
      expect(result.current.notifications[0].errorId).toBe('error-2')
    })

    it('应该清除所有通知', () => {
      const { result } = renderHook(() => useErrorNotification())

      act(() => {
        result.current.addNotification(mockError)
        result.current.addNotification({
          ...mockError,
          errorId: 'error-2',
        })
      })

      expect(result.current.notifications).toHaveLength(2)

      act(() => {
        result.current.clearAllNotifications()
      })

      expect(result.current.notifications).toHaveLength(0)
    })

    it('应该避免重复通知', () => {
      const { result } = renderHook(() => useErrorNotification())

      act(() => {
        result.current.addNotification(mockError)
        result.current.addNotification(mockError)
      })

      expect(result.current.notifications).toHaveLength(1)
    })
  })
})

// ==================== 集成测试 ====================

describe('Error Hooks 集成测试', () => {
  const consoleMock = mockConsole()

  beforeEach(() => {
    consoleMock.mockAll()
    vi.clearAllMocks()
    
    mockErrorMonitoringService.initialize.mockResolvedValue(undefined)
    mockErrorMonitoringService.getErrors.mockResolvedValue(mockErrors)
    mockErrorMonitoringService.getStatistics.mockResolvedValue(mockStatistics)
    mockErrorMonitoringService.reportError.mockResolvedValue('error-id')
    mockErrorMonitoringService.handleError.mockResolvedValue(mockRecoveryResult)
    mockErrorMonitoringService.resolveError.mockResolvedValue(undefined)
    mockErrorMonitoringService.onError.mockReturnValue(() => {})
    mockErrorMonitoringService.onRecovery.mockReturnValue(() => {})
    mockErrorMonitoringService.getConfig.mockReturnValue(mockConfig)
  })

  it('应该完成错误管理完整流程', async () => {
    // 1. 初始化错误监控
    const monitorHook = renderHook(() => useErrorMonitor())

    await waitFor(() => {
      expect(monitorHook.result.current.isMonitoring).toBe(true)
      expect(monitorHook.result.current.errors).toEqual(mockErrors)
    })

    // 2. 报告新错误
    const testError = new Error('Test error')
    await act(async () => {
      await monitorHook.result.current.reportError(testError)
    })

    // 3. 尝试恢复错误
    const recoveryHook = renderHook(() => useErrorRecovery())

    await act(async () => {
      const result = await recoveryHook.result.current.attemptRecovery(
        testError
      )
      expect(result?.success).toBe(true)
    })

    // 4. 解决错误
    await act(async () => {
      await monitorHook.result.current.resolveError('error-1', '已修复')
    })

    // 5. 验证统计信息
    const statsHook = renderHook(() => useErrorStatistics())

    await waitFor(() => {
      expect(statsHook.result.current.statistics).toEqual(mockStatistics)
    })
  })
})

