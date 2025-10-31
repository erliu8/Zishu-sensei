/**
 * useLogging Hooks 测试套件
 * 
 * 测试日志管理相关的所有 Hooks，包括日志记录、查询、配置管理等
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { renderHook } from '../../utils/test-utils'
import {
  useLogging,
  useLogger,
  useLogStatistics,
  useLogConfig,
  usePerformanceLogging,
} from '@/hooks/useLogging'
import type {
  LogEntry,
  LogSearchResponse,
  LogStatistics,
  LoggerConfig,
  RemoteLogConfig,
  LogSystemStatus,
  LogFileInfo,
  LogLevel,
} from '@/services/loggingService'
import { loggingService } from '@/services/loggingService'
import { mockConsole } from '../../utils/test-utils'

// ==================== Mock 设置 ====================

// 获取模拟的 loggingService
const mockLoggingService = vi.mocked(loggingService)

vi.mock('@/services/loggingService', () => ({
  loggingService: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    searchLogs: vi.fn(),
    getLogStatistics: vi.fn(),
    exportLogs: vi.fn(),
    cleanupOldLogs: vi.fn(),
    uploadLogsToRemote: vi.fn(),
    getLogConfig: vi.fn(),
    getRemoteLogConfig: vi.fn(),
    updateLogConfig: vi.fn(),
    updateRemoteLogConfig: vi.fn(),
    getLogFiles: vi.fn(),
    deleteLogFile: vi.fn(),
    compressLogFiles: vi.fn(),
    initializeLoggingSystem: vi.fn(),
    getLogSystemStatus: vi.fn(),
    flushLogBuffer: vi.fn(),
  },
  LogLevel: {
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    FATAL: 'FATAL',
  },
  LoggingError: class extends Error {},
}))

// ==================== 测试数据 ====================

const mockLogEntries: LogEntry[] = [
  {
    timestamp: '2025-01-01T00:00:00Z',
    level: 'INFO' as LogLevel,
    message: 'Test log message 1',
    module: 'TestModule',
    data: { key: 'value1' },
  },
  {
    timestamp: '2025-01-01T00:01:00Z',
    level: 'WARN' as LogLevel,
    message: 'Test log message 2',
    module: 'TestModule',
    data: { key: 'value2' },
  },
  {
    timestamp: '2025-01-01T00:02:00Z',
    level: 'ERROR' as LogLevel,
    message: 'Test log message 3',
    module: 'TestModule',
    error: new Error('Test error'),
  },
]

const mockSearchResponse: LogSearchResponse = {
  logs: mockLogEntries,
  total: 3,
  page: 1,
  pageSize: 50,
  hasMore: false,
}

const mockStatistics: LogStatistics = {
  total: 100,
  byLevel: {
    DEBUG: 20,
    INFO: 40,
    WARN: 25,
    ERROR: 10,
    FATAL: 5,
  },
  byModule: {
    TestModule: 60,
    OtherModule: 40,
  },
  recentErrors: 5,
  timeline: [
    { timestamp: '2025-01-01T00:00:00Z', count: 10 },
    { timestamp: '2025-01-01T01:00:00Z', count: 15 },
  ],
}

const mockConfig: LoggerConfig = {
  minLevel: 'INFO' as LogLevel,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  compress: true,
  timestampFormat: 'ISO',
  bufferSize: 100,
  flushInterval: 5000,
  console: {
    enabled: true,
    colorize: true,
  },
  file: {
    enabled: true,
    path: '/logs',
    rotate: true,
  },
}

const mockRemoteConfig: RemoteLogConfig = {
  enabled: false,
  endpoint: 'https://logs.example.com',
  apiKey: 'test-api-key',
  batchSize: 100,
  uploadInterval: 60000,
  compression: true,
}

const mockSystemStatus: LogSystemStatus = {
  initialized: true,
  bufferSize: 50,
  bufferUsage: 25,
  totalLogsWritten: 1000,
  totalErrors: 10,
  lastFlush: '2025-01-01T00:00:00Z',
  fileCount: 3,
  totalFileSize: 5 * 1024 * 1024, // 5MB
}

const mockLogFiles: LogFileInfo[] = [
  {
    path: '/logs/app.log',
    size: 1024 * 1024, // 1MB
    created: '2025-01-01T00:00:00Z',
    modified: '2025-01-01T12:00:00Z',
  },
  {
    path: '/logs/app.log.1',
    size: 2 * 1024 * 1024, // 2MB
    created: '2024-12-31T00:00:00Z',
    modified: '2024-12-31T23:59:59Z',
  },
]

// ==================== 测试套件 ====================

describe('useLogging Hook', () => {
  const consoleMock = mockConsole()

  beforeEach(() => {
    consoleMock.mockAll()
    vi.clearAllMocks()
    
    mockLoggingService.searchLogs.mockResolvedValue(mockSearchResponse)
    mockLoggingService.getLogStatistics.mockResolvedValue(mockStatistics)
    mockLoggingService.getLogConfig.mockResolvedValue(mockConfig)
    mockLoggingService.getRemoteLogConfig.mockResolvedValue(mockRemoteConfig)
    mockLoggingService.getLogSystemStatus.mockResolvedValue(mockSystemStatus)
    mockLoggingService.getLogFiles.mockResolvedValue(mockLogFiles)
    mockLoggingService.debug.mockResolvedValue(undefined)
    mockLoggingService.info.mockResolvedValue(undefined)
    mockLoggingService.warn.mockResolvedValue(undefined)
    mockLoggingService.error.mockResolvedValue(undefined)
    mockLoggingService.fatal.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础功能', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      expect(result.current.logs).toBe(null)
      expect(result.current.statistics).toBe(null)
      expect(result.current.systemStatus).toBe(null)
      expect(result.current.logFiles).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    it('应该自动初始化', async () => {
      const { result } = renderHook(() => useLogging())

      await waitFor(() => {
        expect(result.current.logs).toEqual(mockSearchResponse)
        expect(result.current.statistics).toEqual(mockStatistics)
        expect(result.current.systemStatus).toEqual(mockSystemStatus)
        expect(result.current.logFiles).toEqual(mockLogFiles)
      })

      expect(mockLoggingService.searchLogs).toHaveBeenCalled()
      expect(mockLoggingService.getLogStatistics).toHaveBeenCalled()
      expect(mockLoggingService.getLogSystemStatus).toHaveBeenCalled()
      expect(mockLoggingService.getLogFiles).toHaveBeenCalled()
    })

    it('应该支持禁用自动初始化', () => {
      renderHook(() => useLogging({ autoInit: false }))

      expect(mockLoggingService.searchLogs).not.toHaveBeenCalled()
      expect(mockLoggingService.getLogStatistics).not.toHaveBeenCalled()
    })
  })

  describe('日志记录方法', () => {
    it('应该记录 DEBUG 级别日志', async () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      await act(async () => {
        await result.current.debug('Debug message', { key: 'value' }, 'TestModule')
      })

      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        'Debug message',
        { key: 'value' },
        'TestModule'
      )
    })

    it('应该记录 INFO 级别日志', async () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      await act(async () => {
        await result.current.info('Info message')
      })

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        'Info message',
        undefined,
        undefined
      )
    })

    it('应该记录 WARN 级别日志', async () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      await act(async () => {
        await result.current.warn('Warning message', null, 'TestModule')
      })

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        'Warning message',
        null,
        'TestModule'
      )
    })

    it('应该记录 ERROR 级别日志', async () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      const testError = new Error('Test error')
      await act(async () => {
        await result.current.writeError('Error message', testError, 'TestModule')
      })

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        'Error message',
        testError,
        'TestModule'
      )
    })

    it('应该记录 FATAL 级别日志', async () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      const testError = new Error('Fatal error')
      await act(async () => {
        await result.current.fatal('Fatal message', testError)
      })

      expect(mockLoggingService.fatal).toHaveBeenCalledWith(
        'Fatal message',
        testError,
        undefined
      )
    })
  })

  describe('查询和搜索', () => {
    it('应该搜索日志', async () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      const searchRequest = {
        page: 1,
        pageSize: 20,
        level: 'ERROR' as LogLevel,
        module: 'TestModule',
      }

      await act(async () => {
        await result.current.searchLogs(searchRequest)
      })

      expect(mockLoggingService.searchLogs).toHaveBeenCalledWith(searchRequest)
      expect(result.current.logs).toEqual(mockSearchResponse)
    })

    it('应该刷新日志', async () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      // 先执行一次搜索
      await act(async () => {
        await result.current.searchLogs({ page: 1, pageSize: 50 })
      })

      mockLoggingService.searchLogs.mockClear()

      // 刷新日志
      await act(async () => {
        await result.current.refreshLogs()
      })

      // 应该使用上次的搜索参数
      expect(mockLoggingService.searchLogs).toHaveBeenCalledWith({
        page: 1,
        pageSize: 50,
      })
    })

    it('应该刷新统计信息', async () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      await act(async () => {
        await result.current.refreshStatistics()
      })

      expect(mockLoggingService.getLogStatistics).toHaveBeenCalled()
      expect(result.current.statistics).toEqual(mockStatistics)
    })

    it('应该使用过滤条件刷新统计', async () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      const filter = {
        level: 'ERROR' as LogLevel,
        module: 'TestModule',
      }

      await act(async () => {
        await result.current.refreshStatistics(filter)
      })

      expect(mockLoggingService.getLogStatistics).toHaveBeenCalledWith(filter)
    })
  })

  describe('导出和管理', () => {
    it('应该导出 JSON 格式日志', async () => {
      mockLoggingService.exportLogs.mockResolvedValue(undefined)

      const { result } = renderHook(() => useLogging({ autoInit: false }))

      await act(async () => {
        await result.current.exportLogs('json')
      })

      expect(mockLoggingService.exportLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'json',
        })
      )
    })

    it('应该导出 CSV 格式日志', async () => {
      mockLoggingService.exportLogs.mockResolvedValue(undefined)

      const { result } = renderHook(() => useLogging({ autoInit: false }))

      const filter = { level: 'ERROR' as LogLevel }

      await act(async () => {
        await result.current.exportLogs('csv', filter, '/path/to/logs.csv')
      })

      expect(mockLoggingService.exportLogs).toHaveBeenCalledWith({
        format: 'csv',
        filter,
        filePath: '/path/to/logs.csv',
      })
    })

    it('应该清理旧日志', async () => {
      mockLoggingService.cleanupOldLogs.mockResolvedValue(10)

      const { result } = renderHook(() => useLogging({ autoInit: false }))

      await act(async () => {
        await result.current.clearLogs(30)
      })

      expect(mockLoggingService.cleanupOldLogs).toHaveBeenCalledWith(30)
    })

    it('应该上传日志到远程服务器', async () => {
      mockLoggingService.uploadLogsToRemote.mockResolvedValue(100)

      const { result } = renderHook(() => useLogging({ autoInit: false }))

      let uploadCount: number = 0
      await act(async () => {
        uploadCount = await result.current.uploadLogs()
      })

      expect(uploadCount).toBe(100)
      expect(mockLoggingService.uploadLogsToRemote).toHaveBeenCalled()
    })
  })

  describe('配置管理', () => {
    it('应该加载配置', async () => {
      const { result } = renderHook(() => useLogging())

      await waitFor(() => {
        expect(result.current.config).toEqual(mockConfig)
        expect(result.current.remoteConfig).toEqual(mockRemoteConfig)
      })
    })

    it('应该更新日志配置', async () => {
      mockLoggingService.updateLogConfig.mockResolvedValue(undefined)

      const { result } = renderHook(() => useLogging())

      await waitFor(() => {
        expect(result.current.config).toBeTruthy()
      })

      const newConfig = {
        minLevel: 'DEBUG' as LogLevel,
        bufferSize: 200,
      }

      await act(async () => {
        await result.current.updateConfig(newConfig)
      })

      expect(mockLoggingService.updateLogConfig).toHaveBeenCalledWith(
        expect.objectContaining(newConfig)
      )
    })

    it('应该更新远程配置', async () => {
      mockLoggingService.updateRemoteLogConfig.mockResolvedValue(undefined)

      const { result } = renderHook(() => useLogging())

      await waitFor(() => {
        expect(result.current.remoteConfig).toBeTruthy()
      })

      const newRemoteConfig = {
        enabled: true,
        batchSize: 200,
      }

      await act(async () => {
        await result.current.updateRemoteConfig(newRemoteConfig)
      })

      expect(mockLoggingService.updateRemoteLogConfig).toHaveBeenCalledWith(
        expect.objectContaining(newRemoteConfig)
      )
    })
  })

  describe('文件管理', () => {
    it('应该获取日志文件列表', async () => {
      const { result } = renderHook(() => useLogging())

      await waitFor(() => {
        expect(result.current.logFiles).toEqual(mockLogFiles)
      })
    })

    it('应该删除日志文件', async () => {
      mockLoggingService.deleteLogFile.mockResolvedValue(undefined)

      const { result } = renderHook(() => useLogging())

      await waitFor(() => {
        expect(result.current.logFiles).toEqual(mockLogFiles)
      })

      await act(async () => {
        await result.current.deleteLogFile('/logs/app.log.1')
      })

      expect(mockLoggingService.deleteLogFile).toHaveBeenCalledWith(
        '/logs/app.log.1'
      )
      // 应该重新获取文件列表
      expect(mockLoggingService.getLogFiles).toHaveBeenCalledTimes(2)
    })

    it('应该压缩日志文件', async () => {
      mockLoggingService.compressLogFiles.mockResolvedValue('/logs/archive.zip')

      const { result } = renderHook(() => useLogging({ autoInit: false }))

      const filePaths = ['/logs/app.log.1', '/logs/app.log.2']
      let outputPath: string = ''

      await act(async () => {
        outputPath = await result.current.compressLogFiles(
          filePaths,
          '/logs/archive.zip'
        )
      })

      expect(outputPath).toBe('/logs/archive.zip')
      expect(mockLoggingService.compressLogFiles).toHaveBeenCalledWith(
        filePaths,
        '/logs/archive.zip'
      )
    })
  })

  describe('系统管理', () => {
    it('应该初始化系统', async () => {
      mockLoggingService.initializeLoggingSystem.mockResolvedValue(undefined)

      const { result } = renderHook(() => useLogging({ autoInit: false }))

      const initConfig: LoggerConfig = {
        ...mockConfig,
        minLevel: 'DEBUG' as LogLevel,
      }

      await act(async () => {
        await result.current.initializeSystem(initConfig)
      })

      expect(mockLoggingService.initializeLoggingSystem).toHaveBeenCalledWith(
        initConfig
      )
      expect(mockLoggingService.getLogSystemStatus).toHaveBeenCalled()
    })

    it('应该刷新系统状态', async () => {
      const { result } = renderHook(() => useLogging({ autoInit: false }))

      await act(async () => {
        await result.current.refreshSystemStatus()
      })

      expect(result.current.systemStatus).toEqual(mockSystemStatus)
    })

    it('应该刷新日志缓冲区', async () => {
      mockLoggingService.flushLogBuffer.mockResolvedValue(undefined)

      const { result } = renderHook(() => useLogging({ autoInit: false }))

      await act(async () => {
        await result.current.flushBuffer()
      })

      expect(mockLoggingService.flushLogBuffer).toHaveBeenCalled()
    })
  })

  describe('实时刷新', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it.skip('应该定期刷新日志', async () => {
      const { result } = renderHook(() =>
        useLogging({
          refreshInterval: 1, // 使用较短的间隔
          realtime: true,
        })
      )

      await waitFor(() => {
        expect(result.current.systemStatus).toBeTruthy()
      })

      mockLoggingService.searchLogs.mockClear()
      mockLoggingService.getLogStatistics.mockClear()
      mockLoggingService.getLogSystemStatus.mockClear()

      // 前进 1 秒
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // 等待下一个tick
      await act(async () => {
        vi.runOnlyPendingTimers()
      })

      expect(mockLoggingService.searchLogs).toHaveBeenCalled()
      expect(mockLoggingService.getLogStatistics).toHaveBeenCalled()
      expect(mockLoggingService.getLogSystemStatus).toHaveBeenCalled()
    })

    it.skip('禁用实时刷新时不应定期刷新', async () => {
      renderHook(() =>
        useLogging({
          refreshInterval: 5,
          realtime: false,
        })
      )

      await waitFor(() => {
        expect(mockLoggingService.getLogSystemStatus).toHaveBeenCalled()
      })

      mockLoggingService.searchLogs.mockClear()

      act(() => {
        vi.advanceTimersByTime(10000)
      })

      // 不应该再次调用
      expect(mockLoggingService.searchLogs).toHaveBeenCalledTimes(0)
    })
  })

  describe('错误处理', () => {
    it('应该处理搜索错误', async () => {
      const testError = new Error('Search failed')
      mockLoggingService.searchLogs.mockRejectedValue(testError)

      const { result } = renderHook(() => useLogging({ autoInit: false }))

      // 捕获异常并检查错误状态
      let caughtError: any = null
      await act(async () => {
        try {
          await result.current.searchLogs({ page: 1, pageSize: 50 })
        } catch (error) {
          caughtError = error
        }
      })

      expect(caughtError).toBeTruthy()
      expect(caughtError.message).toBe('Search failed')
      expect(result.current.error).toBe('Search failed')
    })
  })
})

describe('useLogger Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoggingService.debug.mockResolvedValue(undefined)
    mockLoggingService.info.mockResolvedValue(undefined)
    mockLoggingService.warn.mockResolvedValue(undefined)
    mockLoggingService.error.mockResolvedValue(undefined)
    mockLoggingService.fatal.mockResolvedValue(undefined)
  })

  describe('日志记录', () => {
    it('应该使用指定模块记录日志', async () => {
      const { result } = renderHook(() => useLogger('MyModule'))

      await act(async () => {
        await result.current.info('Test message', { key: 'value' })
      })

      expect(mockLoggingService.info).toHaveBeenCalledWith(
        'Test message',
        { key: 'value' },
        'MyModule'
      )
    })

    it('应该记录错误', async () => {
      const { result } = renderHook(() => useLogger('MyModule'))

      const testError = new Error('Test error')
      await act(async () => {
        await result.current.error('Error occurred', testError)
      })

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        'Error occurred',
        testError,
        'MyModule'
      )
    })
  })
})

describe('useLogStatistics Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoggingService.getLogStatistics.mockResolvedValue(mockStatistics)
    mockLoggingService.searchLogs.mockResolvedValue(mockSearchResponse)
    mockLoggingService.getLogSystemStatus.mockResolvedValue(mockSystemStatus)
    mockLoggingService.getLogConfig.mockResolvedValue(mockConfig)
    mockLoggingService.getRemoteLogConfig.mockResolvedValue(mockRemoteConfig)
    mockLoggingService.getLogFiles.mockResolvedValue(mockLogFiles)
  })

  describe('统计查询', () => {
    it('应该加载统计信息', async () => {
      const { result } = renderHook(() => useLogStatistics())

      await waitFor(() => {
        expect(result.current.statistics).toEqual(mockStatistics)
      })
    })

    it('应该使用过滤条件', async () => {
      const filter = { level: 'ERROR' as LogLevel }
      const { result } = renderHook(() => useLogStatistics(filter))

      await waitFor(() => {
        expect(mockLoggingService.getLogStatistics).toHaveBeenCalledWith(filter)
      })
    })

    it('应该手动刷新统计', async () => {
      const { result } = renderHook(() => useLogStatistics())

      await waitFor(() => {
        expect(result.current.statistics).toBeTruthy()
      })

      mockLoggingService.getLogStatistics.mockClear()

      await act(async () => {
        await result.current.refresh()
      })

      expect(mockLoggingService.getLogStatistics).toHaveBeenCalled()
    })
  })
})

describe('useLogConfig Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoggingService.getLogConfig.mockResolvedValue(mockConfig)
    mockLoggingService.getRemoteLogConfig.mockResolvedValue(mockRemoteConfig)
    mockLoggingService.searchLogs.mockResolvedValue(mockSearchResponse)
    mockLoggingService.getLogStatistics.mockResolvedValue(mockStatistics)
    mockLoggingService.getLogSystemStatus.mockResolvedValue(mockSystemStatus)
    mockLoggingService.getLogFiles.mockResolvedValue(mockLogFiles)
    mockLoggingService.updateLogConfig.mockResolvedValue(undefined)
    mockLoggingService.updateRemoteLogConfig.mockResolvedValue(undefined)
  })

  describe('配置管理', () => {
    it('应该加载配置', async () => {
      const { result } = renderHook(() => useLogConfig())

      await waitFor(() => {
        expect(result.current.config).toEqual(mockConfig)
        expect(result.current.remoteConfig).toEqual(mockRemoteConfig)
      })
    })

    it('应该更新配置', async () => {
      const { result } = renderHook(() => useLogConfig())

      await waitFor(() => {
        expect(result.current.config).toBeTruthy()
      })

      const updates = { minLevel: 'DEBUG' as LogLevel }

      await act(async () => {
        await result.current.updateConfig(updates)
      })

      expect(mockLoggingService.updateLogConfig).toHaveBeenCalled()
    })
  })
})

describe('usePerformanceLogging Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoggingService.debug.mockResolvedValue(undefined)
    mockLoggingService.warn.mockResolvedValue(undefined)
  })

  describe('性能测量', () => {
    it('应该测量同步函数性能', () => {
      const { result } = renderHook(() => usePerformanceLogging())

      const testFn = vi.fn(() => 'result')

      const returnValue = result.current.measureSync('TestOperation', testFn)

      expect(returnValue).toBe('result')
      expect(testFn).toHaveBeenCalled()
      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        'TestOperation 执行完成',
        expect.objectContaining({
          duration: expect.stringMatching(/\d+\.\d+ms/),
        }),
        'Performance'
      )
    })

    it('应该测量异步函数性能', async () => {
      const { result } = renderHook(() => usePerformanceLogging())

      const testFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'async result'
      })

      let returnValue: any
      await act(async () => {
        returnValue = await result.current.measureAsync('AsyncOperation', testFn)
      })

      expect(returnValue).toBe('async result')
      expect(testFn).toHaveBeenCalled()
      expect(mockLoggingService.debug).toHaveBeenCalled()
    })

    it('应该记录慢操作警告', () => {
      const { result } = renderHook(() => usePerformanceLogging())

      const slowFn = () => {
        // 模拟慢操作
        const start = Date.now()
        while (Date.now() - start < 150) {
          // 等待
        }
        return 'result'
      }

      result.current.measureSync('SlowOperation', slowFn)

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        'SlowOperation 执行时间较长',
        expect.any(Object),
        'Performance'
      )
    })

    it('禁用时不应记录性能', () => {
      const { result } = renderHook(() => usePerformanceLogging(false))

      const testFn = vi.fn(() => 'result')

      result.current.measureSync('TestOperation', testFn)

      expect(testFn).toHaveBeenCalled()
      expect(mockLoggingService.debug).not.toHaveBeenCalled()
    })
  })
})

// ==================== 集成测试 ====================

describe('Logging Hooks 集成测试', () => {
  const consoleMock = mockConsole()

  beforeEach(() => {
    consoleMock.mockAll()
    vi.clearAllMocks()
    
    mockLoggingService.searchLogs.mockResolvedValue(mockSearchResponse)
    mockLoggingService.getLogStatistics.mockResolvedValue(mockStatistics)
    mockLoggingService.getLogConfig.mockResolvedValue(mockConfig)
    mockLoggingService.getRemoteLogConfig.mockResolvedValue(mockRemoteConfig)
    mockLoggingService.getLogSystemStatus.mockResolvedValue(mockSystemStatus)
    mockLoggingService.getLogFiles.mockResolvedValue(mockLogFiles)
    mockLoggingService.info.mockResolvedValue(undefined)
    mockLoggingService.exportLogs.mockResolvedValue(undefined)
  })

  it('应该完成日志管理完整流程', async () => {
    // 1. 初始化日志系统
    const loggingHook = renderHook(() => useLogging())

    await waitFor(() => {
      expect(loggingHook.result.current.logs).toBeTruthy()
      expect(loggingHook.result.current.statistics).toBeTruthy()
      expect(loggingHook.result.current.config).toBeTruthy()
    })

    // 2. 记录日志
    const loggerHook = renderHook(() => useLogger('TestModule'))

    await act(async () => {
      await loggerHook.result.current.info('Test message')
    })

    // 3. 搜索日志
    await act(async () => {
      await loggingHook.result.current.searchLogs({
        page: 1,
        pageSize: 20,
        level: 'INFO' as LogLevel,
      })
    })

    // 4. 查看统计
    const statsHook = renderHook(() => useLogStatistics())

    await waitFor(() => {
      expect(statsHook.result.current.statistics).toEqual(mockStatistics)
    })

    // 5. 导出日志
    await act(async () => {
      await loggingHook.result.current.exportLogs('json')
    })

    expect(mockLoggingService.exportLogs).toHaveBeenCalled()
  })
})

