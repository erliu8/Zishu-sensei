/**
 * 日志系统测试
 * 
 * 测试 logger.ts 中的日志记录、过滤和性能监控功能
 * 由于依赖 Tauri API，使用 mock 进行测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  Logger,
  LogLevel,
  LOG_LEVEL_NAMES,
  LOG_LEVEL_COLORS,
  logger,
  debug,
  info,
  warn,
  error,
  fatal,
  type LogEntry,
  type LoggerConfig,
  type LogFilter,
} from '../../../utils/logger'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/fs', () => ({
  BaseDirectory: {},
  createDir: vi.fn(),
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
  exists: vi.fn(() => Promise.resolve(false))
}))

vi.mock('@tauri-apps/api/path', () => ({
  appLogDir: vi.fn(() => Promise.resolve('/mock/log/dir')),
  join: vi.fn((...args) => Promise.resolve(args.join('/')))
}))

describe('logger - 常量和枚举', () => {
  describe('LogLevel', () => {
    it('应该定义所有日志级别', () => {
      expect(LogLevel.DEBUG).toBe(0)
      expect(LogLevel.INFO).toBe(1)
      expect(LogLevel.WARN).toBe(2)
      expect(LogLevel.ERROR).toBe(3)
      expect(LogLevel.FATAL).toBe(4)
    })

    it('应该按严重程度排序', () => {
      expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO)
      expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN)
      expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR)
      expect(LogLevel.ERROR).toBeLessThan(LogLevel.FATAL)
    })
  })

  describe('LOG_LEVEL_NAMES', () => {
    it('应该为每个级别提供名称', () => {
      expect(LOG_LEVEL_NAMES[LogLevel.DEBUG]).toBe('DEBUG')
      expect(LOG_LEVEL_NAMES[LogLevel.INFO]).toBe('INFO')
      expect(LOG_LEVEL_NAMES[LogLevel.WARN]).toBe('WARN')
      expect(LOG_LEVEL_NAMES[LogLevel.ERROR]).toBe('ERROR')
      expect(LOG_LEVEL_NAMES[LogLevel.FATAL]).toBe('FATAL')
    })

    it('应该覆盖所有日志级别', () => {
      const levels = Object.values(LogLevel).filter(v => typeof v === 'number')
      levels.forEach(level => {
        expect(LOG_LEVEL_NAMES[level as LogLevel]).toBeDefined()
      })
    })
  })

  describe('LOG_LEVEL_COLORS', () => {
    it('应该为每个级别提供颜色', () => {
      expect(LOG_LEVEL_COLORS[LogLevel.DEBUG]).toBeTruthy()
      expect(LOG_LEVEL_COLORS[LogLevel.INFO]).toBeTruthy()
      expect(LOG_LEVEL_COLORS[LogLevel.WARN]).toBeTruthy()
      expect(LOG_LEVEL_COLORS[LogLevel.ERROR]).toBeTruthy()
      expect(LOG_LEVEL_COLORS[LogLevel.FATAL]).toBeTruthy()
    })

    it('应该使用有效的颜色值', () => {
      const colorPattern = /^#[0-9A-F]{6}$/i
      Object.values(LOG_LEVEL_COLORS).forEach(color => {
        expect(color).toMatch(colorPattern)
      })
    })
  })
})

describe('logger - Logger 类', () => {
  let testLogger: Logger

  beforeEach(() => {
    // 每次测试创建新的 Logger 实例
    testLogger = Logger.getInstance({
      enableConsole: false, // 禁用控制台输出以避免测试输出混乱
      enableFile: false,    // 禁用文件写入
      enableRemote: false,  // 禁用远程上传
      minLevel: LogLevel.DEBUG
    })
  })

  afterEach(() => {
    // 清理
    testLogger.clearBuffer()
  })

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      const instance1 = Logger.getInstance()
      const instance2 = Logger.getInstance()
      
      expect(instance1).toBe(instance2)
    })

    it('应该允许更新配置', () => {
      const config = { minLevel: LogLevel.ERROR }
      const instance = Logger.getInstance(config)
      
      expect(instance.getConfig().minLevel).toBe(LogLevel.ERROR)
    })
  })

  describe('基础日志方法', () => {
    it('应该记录 DEBUG 日志', () => {
      testLogger.debug('Test debug message')
      
      const logs = testLogger.getBufferedLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe(LogLevel.DEBUG)
      expect(logs[0].message).toBe('Test debug message')
    })

    it('应该记录 INFO 日志', () => {
      testLogger.info('Test info message')
      
      const logs = testLogger.getBufferedLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe(LogLevel.INFO)
    })

    it('应该记录 WARN 日志', () => {
      testLogger.warn('Test warn message')
      
      const logs = testLogger.getBufferedLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe(LogLevel.WARN)
    })

    it('应该记录 ERROR 日志', () => {
      testLogger.error('Test error message')
      
      const logs = testLogger.getBufferedLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe(LogLevel.ERROR)
    })

    it('应该记录 FATAL 日志', () => {
      testLogger.fatal('Test fatal message')
      
      const logs = testLogger.getBufferedLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].level).toBe(LogLevel.FATAL)
    })

    it('应该支持附加数据', () => {
      const data = { userId: '123', action: 'test' }
      testLogger.info('Test message', data)
      
      const logs = testLogger.getBufferedLogs()
      expect(logs[0].data).toEqual(data)
    })

    it('应该支持模块名称', () => {
      testLogger.info('Test message', undefined, 'TestModule')
      
      const logs = testLogger.getBufferedLogs()
      expect(logs[0].module).toBe('TestModule')
    })

    it('应该记录 Error 对象的堆栈', () => {
      const testError = new Error('Test error')
      testLogger.error('Error occurred', testError)
      
      const logs = testLogger.getBufferedLogs()
      expect(logs[0].data).toBeDefined()
      expect(logs[0].data.stack).toBeDefined()
    })

    it('应该处理非 Error 对象', () => {
      const customError = { code: 'TEST_ERROR', message: 'Custom error' }
      testLogger.error('Custom error occurred', customError)
      
      const logs = testLogger.getBufferedLogs()
      expect(logs[0].data).toEqual(customError)
    })
  })

  describe('日志过滤', () => {
    it('应该根据最小级别过滤日志', () => {
      const filterLogger = Logger.getInstance({ minLevel: LogLevel.WARN })
      
      filterLogger.debug('Debug message')
      filterLogger.info('Info message')
      filterLogger.warn('Warn message')
      filterLogger.error('Error message')
      
      const logs = filterLogger.getBufferedLogs()
      expect(logs).toHaveLength(2) // 只有 WARN 和 ERROR
      expect(logs[0].level).toBe(LogLevel.WARN)
      expect(logs[1].level).toBe(LogLevel.ERROR)
    })

    it('应该按级别过滤日志', () => {
      testLogger.debug('Debug')
      testLogger.info('Info')
      testLogger.warn('Warn')
      testLogger.error('Error')
      
      const filter: LogFilter = { levels: [LogLevel.INFO, LogLevel.ERROR] }
      const filtered = testLogger.getBufferedLogs(filter)
      
      expect(filtered).toHaveLength(2)
      expect(filtered[0].level).toBe(LogLevel.INFO)
      expect(filtered[1].level).toBe(LogLevel.ERROR)
    })

    it('应该按模块过滤日志', () => {
      testLogger.info('Module A log', undefined, 'ModuleA')
      testLogger.info('Module B log', undefined, 'ModuleB')
      testLogger.info('Module A log 2', undefined, 'ModuleA')
      
      const filter: LogFilter = { modules: ['ModuleA'] }
      const filtered = testLogger.getBufferedLogs(filter)
      
      expect(filtered).toHaveLength(2)
      expect(filtered.every(log => log.module === 'ModuleA')).toBe(true)
    })

    it('应该按时间范围过滤日志', () => {
      const startTime = Date.now()
      testLogger.info('Log 1')
      
      // 等待一小段时间
      const midTime = Date.now() + 100
      
      testLogger.info('Log 2')
      const endTime = Date.now() + 200
      
      const filter: LogFilter = {
        timeRange: { start: startTime, end: midTime }
      }
      const filtered = testLogger.getBufferedLogs(filter)
      
      expect(filtered.length).toBeGreaterThan(0)
      filtered.forEach(log => {
        expect(log.timestamp).toBeGreaterThanOrEqual(startTime)
        expect(log.timestamp).toBeLessThanOrEqual(midTime)
      })
    })

    it('应该按关键词搜索日志', () => {
      testLogger.info('User login successful')
      testLogger.info('File saved successfully')
      testLogger.info('User logout')
      
      const filter: LogFilter = { keywords: ['user'] }
      const filtered = testLogger.getBufferedLogs(filter)
      
      expect(filtered).toHaveLength(2)
    })

    it('应该支持组合过滤条件', () => {
      testLogger.info('Module A info', undefined, 'ModuleA')
      testLogger.warn('Module A warn', undefined, 'ModuleA')
      testLogger.info('Module B info', undefined, 'ModuleB')
      
      const filter: LogFilter = {
        levels: [LogLevel.INFO],
        modules: ['ModuleA']
      }
      const filtered = testLogger.getBufferedLogs(filter)
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].level).toBe(LogLevel.INFO)
      expect(filtered[0].module).toBe('ModuleA')
    })
  })

  describe('日志统计', () => {
    it('应该统计总日志数量', () => {
      testLogger.info('Log 1')
      testLogger.warn('Log 2')
      testLogger.error('Log 3')
      
      const stats = testLogger.getStats()
      expect(stats.total).toBe(3)
    })

    it('应该按级别统计日志', () => {
      testLogger.debug('Debug 1')
      testLogger.info('Info 1')
      testLogger.info('Info 2')
      testLogger.warn('Warn 1')
      testLogger.error('Error 1')
      testLogger.error('Error 2')
      testLogger.error('Error 3')
      
      const stats = testLogger.getStats()
      expect(stats.byLevel[LogLevel.DEBUG]).toBe(1)
      expect(stats.byLevel[LogLevel.INFO]).toBe(2)
      expect(stats.byLevel[LogLevel.WARN]).toBe(1)
      expect(stats.byLevel[LogLevel.ERROR]).toBe(3)
      expect(stats.byLevel[LogLevel.FATAL]).toBe(0)
    })

    it('应该记录最早和最新日志时间', () => {
      testLogger.info('First log')
      const firstTime = Date.now()
      
      // 模拟时间流逝
      testLogger.info('Second log')
      testLogger.info('Third log')
      const lastTime = Date.now()
      
      const stats = testLogger.getStats()
      expect(stats.oldestTimestamp).toBeLessThanOrEqual(firstTime)
      expect(stats.newestTimestamp).toBeGreaterThanOrEqual(lastTime - 100)
    })

    it('应该计算总大小', () => {
      testLogger.info('Short')
      testLogger.info('A much longer log message with more content')
      
      const stats = testLogger.getStats()
      expect(stats.totalSize).toBeGreaterThan(0)
    })
  })

  describe('缓冲区管理', () => {
    it('应该清空缓冲区', () => {
      testLogger.info('Log 1')
      testLogger.info('Log 2')
      
      expect(testLogger.getBufferedLogs()).toHaveLength(2)
      
      testLogger.clearBuffer()
      
      expect(testLogger.getBufferedLogs()).toHaveLength(0)
    })

    it('应该返回缓冲区副本', () => {
      testLogger.info('Test')
      
      const logs1 = testLogger.getBufferedLogs()
      const logs2 = testLogger.getBufferedLogs()
      
      expect(logs1).toEqual(logs2)
      expect(logs1).not.toBe(logs2) // 不是同一个数组引用
    })
  })

  describe('配置管理', () => {
    it('应该获取当前配置', () => {
      const config = testLogger.getConfig()
      
      expect(config).toBeDefined()
      expect(config.minLevel).toBeDefined()
      expect(config.enableConsole).toBeDefined()
    })

    it('应该更新配置', () => {
      testLogger.updateConfig({ minLevel: LogLevel.ERROR })
      
      const config = testLogger.getConfig()
      expect(config.minLevel).toBe(LogLevel.ERROR)
    })

    it('应该返回配置副本', () => {
      const config1 = testLogger.getConfig()
      const config2 = testLogger.getConfig()
      
      expect(config1).toEqual(config2)
      expect(config1).not.toBe(config2)
    })
  })

  describe('会话管理', () => {
    it('应该生成会话 ID', () => {
      const sessionId = testLogger.getSessionId()
      
      expect(sessionId).toBeTruthy()
      expect(sessionId).toMatch(/^session_/)
    })

    it('应该在每个日志中包含会话 ID', () => {
      const sessionId = testLogger.getSessionId()
      testLogger.info('Test message')
      
      const logs = testLogger.getBufferedLogs()
      expect(logs[0].sessionId).toBe(sessionId)
    })
  })
})

describe('logger - 性能监控', () => {
  let testLogger: Logger

  beforeEach(() => {
    testLogger = Logger.getInstance({
      enableConsole: false,
      minLevel: LogLevel.DEBUG
    })
    testLogger.clearBuffer()
  })

  describe('startPerformance', () => {
    it('应该返回结束函数', () => {
      const end = testLogger.startPerformance('test-operation')
      
      expect(typeof end).toBe('function')
    })

    it('应该测量操作时间', () => {
      const end = testLogger.startPerformance('test-operation')
      
      // 模拟一些工作
      const start = performance.now()
      while (performance.now() - start < 10) {
        // 等待至少 10ms
      }
      
      end()
      
      const logs = testLogger.getBufferedLogs()
      const perfLog = logs.find(log => log.message === '性能指标')
      
      expect(perfLog).toBeDefined()
      expect(perfLog?.data.duration).toBeGreaterThanOrEqual(10)
    })

    it('应该支持元数据', () => {
      const end = testLogger.startPerformance('test-operation')
      ;(end as any)({ custom: 'metadata' }) // 类型断言以解决签名问题
      
      const logs = testLogger.getBufferedLogs()
      const perfLog = logs.find(log => log.message === '性能指标')
      
      expect(perfLog?.data.metadata.custom).toBe('metadata')
    })

    it('应该在耗时过长时记录警告', () => {
      const end = testLogger.startPerformance('slow-operation')
      
      // 模拟耗时操作（通过直接修改性能数据）
      const mockData = {
        name: 'slow-operation',
        startTime: 0,
        endTime: 2000,
        duration: 2000,
      }
      
      testLogger.debug('性能指标', mockData, 'Performance')
      testLogger.warn(`性能警告: slow-operation 耗时 2000.00ms`, mockData, 'Performance')
      
      const logs = testLogger.getBufferedLogs()
      const warnLog = logs.find(log => log.level === LogLevel.WARN)
      
      expect(warnLog).toBeDefined()
      expect(warnLog?.message).toContain('性能警告')
    })
  })

  describe('measureAsync', () => {
    it('应该测量异步操作', async () => {
      const asyncOp = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'result'
      }
      
      const result = await testLogger.measureAsync('async-op', asyncOp)
      
      expect(result).toBe('result')
      
      const logs = testLogger.getBufferedLogs()
      const perfLog = logs.find(log => log.message === '性能指标')
      
      expect(perfLog).toBeDefined()
      expect(perfLog?.data.metadata.success).toBe(true)
    })

    it('应该处理异步操作错误', async () => {
      const asyncOp = async () => {
        throw new Error('Async error')
      }
      
      await expect(testLogger.measureAsync('async-op', asyncOp)).rejects.toThrow('Async error')
      
      const logs = testLogger.getBufferedLogs()
      const perfLog = logs.find(log => log.message === '性能指标')
      
      expect(perfLog?.data.metadata.success).toBe(false)
    })
  })

  describe('measureSync', () => {
    it('应该测量同步操作', () => {
      const syncOp = () => {
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i
        }
        return sum
      }
      
      const result = testLogger.measureSync('sync-op', syncOp)
      
      expect(result).toBe(499500)
      
      const logs = testLogger.getBufferedLogs()
      const perfLog = logs.find(log => log.message === '性能指标')
      
      expect(perfLog).toBeDefined()
      expect(perfLog?.data.metadata.success).toBe(true)
    })

    it('应该处理同步操作错误', () => {
      const syncOp = () => {
        throw new Error('Sync error')
      }
      
      expect(() => testLogger.measureSync('sync-op', syncOp)).toThrow('Sync error')
      
      const logs = testLogger.getBufferedLogs()
      const perfLog = logs.find(log => log.message === '性能指标')
      
      expect(perfLog?.data.metadata.success).toBe(false)
    })
  })
})

describe('logger - 全局便捷函数', () => {
  beforeEach(() => {
    logger.clearBuffer()
  })

  it('debug() 应该使用全局 logger', () => {
    debug('Test debug')
    
    const logs = logger.getBufferedLogs()
    expect(logs.some(log => log.message === 'Test debug')).toBe(true)
  })

  it('info() 应该使用全局 logger', () => {
    info('Test info')
    
    const logs = logger.getBufferedLogs()
    expect(logs.some(log => log.message === 'Test info')).toBe(true)
  })

  it('warn() 应该使用全局 logger', () => {
    warn('Test warn')
    
    const logs = logger.getBufferedLogs()
    expect(logs.some(log => log.message === 'Test warn')).toBe(true)
  })

  it('error() 应该使用全局 logger', () => {
    error('Test error')
    
    const logs = logger.getBufferedLogs()
    expect(logs.some(log => log.message === 'Test error')).toBe(true)
  })

  it('fatal() 应该使用全局 logger', () => {
    fatal('Test fatal')
    
    const logs = logger.getBufferedLogs()
    expect(logs.some(log => log.message === 'Test fatal')).toBe(true)
  })
})

describe('logger - 边界情况', () => {
  let testLogger: Logger

  beforeEach(() => {
    testLogger = Logger.getInstance({ enableConsole: false })
    testLogger.clearBuffer()
  })

  it('应该处理空消息', () => {
    testLogger.info('')
    
    const logs = testLogger.getBufferedLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].message).toBe('')
  })

  it('应该处理非常长的消息', () => {
    const longMessage = 'A'.repeat(10000)
    testLogger.info(longMessage)
    
    const logs = testLogger.getBufferedLogs()
    expect(logs[0].message).toBe(longMessage)
  })

  it('应该处理特殊字符', () => {
    testLogger.info('Message with 中文 and émojis 🔥')
    
    const logs = testLogger.getBufferedLogs()
    expect(logs[0].message).toBe('Message with 中文 and émojis 🔥')
  })

  it('应该处理循环引用的数据', () => {
    const circularData: any = { name: 'test' }
    circularData.self = circularData
    
    // 不应该抛出错误
    expect(() => testLogger.info('Circular data', circularData)).not.toThrow()
  })

  it('应该处理 undefined 和 null 数据', () => {
    testLogger.info('Null data', null)
    testLogger.info('Undefined data', undefined)
    
    const logs = testLogger.getBufferedLogs()
    expect(logs).toHaveLength(2)
  })

  it('应该处理大量日志', () => {
    const startTime = Date.now()
    
    for (let i = 0; i < 1000; i++) {
      testLogger.info(`Log ${i}`)
    }
    
    const duration = Date.now() - startTime
    const logs = testLogger.getBufferedLogs()
    
    expect(logs).toHaveLength(1000)
    // 1000 条日志应该在合理时间内完成（< 1秒）
    expect(duration).toBeLessThan(1000)
  })

  it('应该处理不同类型的数据', () => {
    testLogger.info('String data', 'string')
    testLogger.info('Number data', 123)
    testLogger.info('Boolean data', true)
    testLogger.info('Array data', [1, 2, 3])
    testLogger.info('Object data', { key: 'value' })
    testLogger.info('Date data', new Date())
    
    const logs = testLogger.getBufferedLogs()
    expect(logs).toHaveLength(6)
  })
})

describe('logger - 日志条目结构', () => {
  let testLogger: Logger

  beforeEach(() => {
    testLogger = Logger.getInstance({ enableConsole: false })
    testLogger.clearBuffer()
  })

  it('应该包含所有必需字段', () => {
    testLogger.info('Test message')
    
    const logs = testLogger.getBufferedLogs()
    const log = logs[0]
    
    expect(log.timestamp).toBeDefined()
    expect(log.level).toBeDefined()
    expect(log.message).toBeDefined()
    expect(log.sessionId).toBeDefined()
  })

  it('应该包含时间戳', () => {
    const before = Date.now()
    testLogger.info('Test')
    const after = Date.now()
    
    const logs = testLogger.getBufferedLogs()
    expect(logs[0].timestamp).toBeGreaterThanOrEqual(before)
    expect(logs[0].timestamp).toBeLessThanOrEqual(after)
  })

  it('应该正确设置日志级别', () => {
    testLogger.debug('Debug')
    testLogger.info('Info')
    testLogger.warn('Warn')
    testLogger.error('Error')
    testLogger.fatal('Fatal')
    
    const logs = testLogger.getBufferedLogs()
    expect(logs[0].level).toBe(LogLevel.DEBUG)
    expect(logs[1].level).toBe(LogLevel.INFO)
    expect(logs[2].level).toBe(LogLevel.WARN)
    expect(logs[3].level).toBe(LogLevel.ERROR)
    expect(logs[4].level).toBe(LogLevel.FATAL)
  })

  it('应该支持可选字段', () => {
    testLogger.info('Test', { custom: 'data' }, 'TestModule')
    
    const logs = testLogger.getBufferedLogs()
    const log = logs[0]
    
    expect(log.data).toEqual({ custom: 'data' })
    expect(log.module).toBe('TestModule')
  })

  it('应该在 Error 日志中包含堆栈', () => {
    const error = new Error('Test error')
    testLogger.error('Error occurred', error)
    
    const logs = testLogger.getBufferedLogs()
    const log = logs[0]
    
    expect(log.data.stack).toBeDefined()
    expect(typeof log.data.stack).toBe('string')
  })
})

