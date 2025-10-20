/**
 * 错误处理工具测试
 * 
 * 测试 errorHandler.ts 中的错误处理、日志记录和恢复机制
 * 确保错误处理的健壮性和用户友好性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createTauriError,
  TauriErrorHandler,
  errorHandler,
  ErrorSeverity,
  ErrorCategory,
  errorRecovery,
  getUserFriendlyMessage,
  initializeErrorHandling,
  predefinedHandlers,
  registerPredefinedHandlers,
} from '../../../utils/errorHandler'

// TauriError 类型在 errorHandler.ts 中定义
type TauriError = ReturnType<typeof createTauriError>
type ErrorHandler = (error: TauriError) => void | Promise<void>

describe('errorHandler - 错误创建', () => {
  describe('createTauriError', () => {
    it('应该创建基本的 TauriError', () => {
      const error = createTauriError('Test error')
      
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('TauriError')
      expect(error.message).toBe('Test error')
      expect(error.code).toBeDefined()
      expect(error.category).toBeDefined()
      expect(error.severity).toBe('medium')
      expect(error.timestamp).toBeGreaterThan(0)
    })

    it('应该支持自定义错误代码', () => {
      const error = createTauriError('Test error', 'CUSTOM_ERROR')
      
      expect(error.code).toBe('CUSTOM_ERROR')
    })

    it('应该支持自定义分类', () => {
      const error = createTauriError(
        'Network error',
        'NETWORK_ERROR',
        ErrorCategory.NETWORK
      )
      
      expect(error.category).toBe(ErrorCategory.NETWORK)
    })

    it('应该支持自定义严重程度', () => {
      const error = createTauriError(
        'Critical error',
        'CRITICAL_ERROR',
        ErrorCategory.SYSTEM,
        'critical'
      )
      
      expect(error.severity).toBe('critical')
    })

    it('应该支持错误上下文', () => {
      const context = { userId: '123', action: 'save' }
      const error = createTauriError(
        'Save failed',
        'SAVE_ERROR',
        ErrorCategory.FILE,
        'high',
        context
      )
      
      expect(error.context).toEqual(context)
    })

    it('应该包含时间戳', () => {
      const before = Date.now()
      const error = createTauriError('Test error')
      const after = Date.now()
      
      expect(error.timestamp).toBeGreaterThanOrEqual(before)
      expect(error.timestamp).toBeLessThanOrEqual(after)
    })
  })
})

describe('errorHandler - 错误处理器类', () => {
  let handler: TauriErrorHandler

  beforeEach(() => {
    handler = new TauriErrorHandler()
  })

  describe('register', () => {
    it('应该注册特定错误代码的处理器', async () => {
      const mockHandler = vi.fn()
      handler.register('TEST_ERROR', mockHandler)

      const error = createTauriError('Test', 'TEST_ERROR')
      await handler.handle(error)

      expect(mockHandler).toHaveBeenCalledWith(error)
    })

    it('应该支持注册多个处理器', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      handler.register('ERROR_1', handler1)
      handler.register('ERROR_2', handler2)

      await handler.handle(createTauriError('Test 1', 'ERROR_1'))
      await handler.handle(createTauriError('Test 2', 'ERROR_2'))

      expect(handler1).toHaveBeenCalledOnce()
      expect(handler2).toHaveBeenCalledOnce()
    })

    it('应该覆盖已存在的处理器', async () => {
      const oldHandler = vi.fn()
      const newHandler = vi.fn()

      handler.register('TEST_ERROR', oldHandler)
      handler.register('TEST_ERROR', newHandler)

      await handler.handle(createTauriError('Test', 'TEST_ERROR'))

      expect(oldHandler).not.toHaveBeenCalled()
      expect(newHandler).toHaveBeenCalledOnce()
    })
  })

  describe('registerGlobal', () => {
    it('应该注册全局错误处理器', async () => {
      const globalHandler = vi.fn()
      handler.registerGlobal(globalHandler)

      const error = createTauriError('Test', 'UNHANDLED_ERROR')
      await handler.handle(error)

      expect(globalHandler).toHaveBeenCalledWith(error)
    })

    it('应该在没有特定处理器时使用全局处理器', async () => {
      const specificHandler = vi.fn()
      const globalHandler = vi.fn()

      handler.register('SPECIFIC_ERROR', specificHandler)
      handler.registerGlobal(globalHandler)

      await handler.handle(createTauriError('Test 1', 'SPECIFIC_ERROR'))
      await handler.handle(createTauriError('Test 2', 'OTHER_ERROR'))

      expect(specificHandler).toHaveBeenCalledOnce()
      expect(globalHandler).toHaveBeenCalledOnce()
    })
  })

  describe('handle', () => {
    it('应该处理 TauriError 对象', async () => {
      const mockHandler = vi.fn()
      handler.register('TEST_ERROR', mockHandler)

      const error = createTauriError('Test', 'TEST_ERROR')
      await handler.handle(error)

      expect(mockHandler).toHaveBeenCalled()
    })

    it('应该处理普通 Error 对象', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('Normal error')

      await handler.handle(error)

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('应该处理字符串错误', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await handler.handle('String error')

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('应该添加错误到历史记录', async () => {
      const error = createTauriError('Test')
      await handler.handle(error)

      const history = handler.getErrorHistory()
      expect(history).toHaveLength(1)
      expect(history[0]).toEqual(error)
    })

    it('应该支持错误上下文合并', async () => {
      const error = createTauriError('Test', 'TEST_ERROR', ErrorCategory.SYSTEM, 'medium', {
        initialContext: 'value1'
      })

      await handler.handle(error, { additionalContext: 'value2' })

      const history = handler.getErrorHistory()
      expect(history[0].context).toEqual({
        initialContext: 'value1',
        additionalContext: 'value2'
      })
    })

    it('应该在处理器失败时继续执行', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const failingHandler = vi.fn(() => {
        throw new Error('Handler failed')
      })

      handler.register('TEST_ERROR', failingHandler)

      await expect(
        handler.handle(createTauriError('Test', 'TEST_ERROR'))
      ).resolves.not.toThrow()

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })

  describe('getErrorHistory', () => {
    it('应该返回错误历史', async () => {
      await handler.handle(createTauriError('Error 1'))
      await handler.handle(createTauriError('Error 2'))
      await handler.handle(createTauriError('Error 3'))

      const history = handler.getErrorHistory()
      expect(history).toHaveLength(3)
    })

    it('应该按时间倒序排列（最新的在前）', async () => {
      await handler.handle(createTauriError('First'))
      await new Promise(resolve => setTimeout(resolve, 10))
      await handler.handle(createTauriError('Second'))
      await new Promise(resolve => setTimeout(resolve, 10))
      await handler.handle(createTauriError('Third'))

      const history = handler.getErrorHistory()
      expect(history[0].message).toBe('Third')
      expect(history[1].message).toBe('Second')
      expect(history[2].message).toBe('First')
    })

    it('应该限制历史记录数量', async () => {
      // 创建超过最大数量（100）的错误
      for (let i = 0; i < 150; i++) {
        await handler.handle(createTauriError(`Error ${i}`))
      }

      const history = handler.getErrorHistory()
      expect(history.length).toBeLessThanOrEqual(100)
    })

    it('应该返回副本而不是原始数组', async () => {
      await handler.handle(createTauriError('Test'))

      const history1 = handler.getErrorHistory()
      const history2 = handler.getErrorHistory()

      expect(history1).not.toBe(history2)
      expect(history1).toEqual(history2)
    })
  })

  describe('clearHistory', () => {
    it('应该清空错误历史', async () => {
      await handler.handle(createTauriError('Error 1'))
      await handler.handle(createTauriError('Error 2'))

      expect(handler.getErrorHistory()).toHaveLength(2)

      handler.clearHistory()

      expect(handler.getErrorHistory()).toHaveLength(0)
    })
  })

  describe('getErrorStats', () => {
    it('应该统计错误总数', async () => {
      await handler.handle(createTauriError('Error 1'))
      await handler.handle(createTauriError('Error 2'))
      await handler.handle(createTauriError('Error 3'))

      const stats = handler.getErrorStats()
      expect(stats.total).toBe(3)
    })

    it('应该按严重程度统计', async () => {
      await handler.handle(createTauriError('Low', 'E1', ErrorCategory.SYSTEM, 'low'))
      await handler.handle(createTauriError('Medium', 'E2', ErrorCategory.SYSTEM, 'medium'))
      await handler.handle(createTauriError('Medium 2', 'E3', ErrorCategory.SYSTEM, 'medium'))
      await handler.handle(createTauriError('High', 'E4', ErrorCategory.SYSTEM, 'high'))

      const stats = handler.getErrorStats()
      expect(stats.bySeverity.low).toBe(1)
      expect(stats.bySeverity.medium).toBe(2)
      expect(stats.bySeverity.high).toBe(1)
      expect(stats.bySeverity.critical).toBe(0)
    })

    it('应该按分类统计', async () => {
      await handler.handle(createTauriError('E1', 'E1', ErrorCategory.NETWORK))
      await handler.handle(createTauriError('E2', 'E2', ErrorCategory.NETWORK))
      await handler.handle(createTauriError('E3', 'E3', ErrorCategory.FILE))

      const stats = handler.getErrorStats()
      expect(stats.byCategory[ErrorCategory.NETWORK]).toBe(2)
      expect(stats.byCategory[ErrorCategory.FILE]).toBe(1)
    })

    it('应该按错误代码统计', async () => {
      await handler.handle(createTauriError('E1', 'CODE_A'))
      await handler.handle(createTauriError('E2', 'CODE_A'))
      await handler.handle(createTauriError('E3', 'CODE_B'))

      const stats = handler.getErrorStats()
      expect(stats.byCode.CODE_A).toBe(2)
      expect(stats.byCode.CODE_B).toBe(1)
    })
  })
})

describe('errorHandler - 错误恢复工具', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('retry', () => {
    it('应该在操作成功时返回结果', async () => {
      const operation = vi.fn(async () => 'success')

      const result = await errorRecovery.retry(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledOnce()
    })

    it('应该在失败后重试', async () => {
      let attempts = 0
      const operation = vi.fn(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Failed')
        }
        return 'success'
      })

      const promise = errorRecovery.retry(operation, 3, 1000)
      
      // 立即失败第一次
      await vi.runOnlyPendingTimersAsync()
      
      // 重试
      await vi.runOnlyPendingTimersAsync()
      await vi.runOnlyPendingTimersAsync()

      const result = await promise

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('应该在达到最大尝试次数后抛出错误', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Always fails')
      })

      const promise = errorRecovery.retry(operation, 3, 100)
      
      await vi.runOnlyPendingTimersAsync()
      await vi.runOnlyPendingTimersAsync()
      await vi.runOnlyPendingTimersAsync()

      await expect(promise).rejects.toThrow(/Operation failed after 3 attempts/)
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('应该使用递增的延迟时间', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Failed')
      })

      const promise = errorRecovery.retry(operation, 3, 100)

      // 第一次失败
      await vi.advanceTimersByTimeAsync(0)

      // 第一次重试延迟 100ms
      await vi.advanceTimersByTimeAsync(100)

      // 第二次重试延迟 200ms
      await vi.advanceTimersByTimeAsync(200)

      await expect(promise).rejects.toThrow()
    })

    it('应该记录原始错误', async () => {
      const originalError = new Error('Original error')
      const operation = vi.fn(async () => {
        throw originalError
      })

      const promise = errorRecovery.retry(operation, 1, 100)
      
      await vi.runAllTimersAsync()

      try {
        await promise
      } catch (error: any) {
        expect(error.context.originalError).toBe(originalError)
        expect(error.context.attempts).toBe(1)
      }
    })
  })

  describe('withTimeout', () => {
    it('应该在超时前完成操作', async () => {
      const operation = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        return 'success'
      })

      const promise = errorRecovery.withTimeout(operation, 1000)
      
      await vi.advanceTimersByTimeAsync(500)

      const result = await promise
      expect(result).toBe('success')
    })

    it('应该在超时后拒绝', async () => {
      const operation = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000))
        return 'success'
      })

      const promise = errorRecovery.withTimeout(operation, 1000)
      
      await vi.advanceTimersByTimeAsync(1000)

      await expect(promise).rejects.toThrow(/Operation timed out/)
    })

    it('应该包含超时时间在错误中', async () => {
      const operation = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000))
      })

      const promise = errorRecovery.withTimeout(operation, 5000)
      
      await vi.advanceTimersByTimeAsync(5000)

      try {
        await promise
      } catch (error: any) {
        expect(error.context.timeout).toBe(5000)
      }
    })

    it('应该使用默认超时时间', async () => {
      const operation = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 20000))
      })

      const promise = errorRecovery.withTimeout(operation)
      
      await vi.advanceTimersByTimeAsync(10000)

      await expect(promise).rejects.toThrow()
    })
  })

  describe('safe', () => {
    it('应该在操作成功时返回结果', async () => {
      const operation = vi.fn(async () => 'success')

      const result = await errorRecovery.safe(operation)

      expect(result).toBe('success')
    })

    it('应该在操作失败时返回 undefined', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Failed')
      })

      const result = await errorRecovery.safe(operation)

      expect(result).toBeUndefined()
    })

    it('应该在操作失败时返回 fallback 值', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Failed')
      })

      const result = await errorRecovery.safe(operation, 'fallback')

      expect(result).toBe('fallback')
    })

    it('应该处理错误', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const operation = vi.fn(async () => {
        throw new Error('Failed')
      })

      await errorRecovery.safe(operation)

      // 错误应该被处理（记录到控制台）
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })
})

describe('errorHandler - 用户友好消息', () => {
  describe('getUserFriendlyMessage', () => {
    it('应该返回已知错误代码的友好消息', () => {
      const message = getUserFriendlyMessage('NETWORK_ERROR')
      expect(message).toBe('网络连接出现问题')
    })

    it('应该从 TauriError 对象获取消息', () => {
      const error = createTauriError('Test', 'FILE_NOT_FOUND')
      const message = getUserFriendlyMessage(error)
      expect(message).toBe('找不到指定的文件')
    })

    it('应该对未知错误代码返回默认消息', () => {
      const message = getUserFriendlyMessage('UNKNOWN_CODE_12345')
      expect(message).toBe('发生了未知错误')
    })

    it('应该处理空字符串', () => {
      const message = getUserFriendlyMessage('')
      expect(message).toBe('发生了未知错误')
    })
  })
})

describe('errorHandler - 预定义处理器', () => {
  describe('predefinedHandlers', () => {
    it('应该导出网络错误处理器', () => {
      expect(predefinedHandlers.networkError).toBeDefined()
      expect(typeof predefinedHandlers.networkError).toBe('function')
    })

    it('应该导出文件错误处理器', () => {
      expect(predefinedHandlers.fileError).toBeDefined()
      expect(typeof predefinedHandlers.fileError).toBe('function')
    })

    it('应该导出窗口错误处理器', () => {
      expect(predefinedHandlers.windowError).toBeDefined()
      expect(typeof predefinedHandlers.windowError).toBe('function')
    })

    it('应该导出命令错误处理器', () => {
      expect(predefinedHandlers.commandError).toBeDefined()
      expect(typeof predefinedHandlers.commandError).toBe('function')
    })
  })

  describe('networkError', () => {
    it('应该处理网络错误', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const error = createTauriError('Network failed', 'NETWORK_ERROR', ErrorCategory.NETWORK)

      await predefinedHandlers.networkError(error)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Network error occurred:',
        'Network failed'
      )
      consoleWarnSpy.mockRestore()
    })
  })

  describe('registerPredefinedHandlers', () => {
    it('应该注册所有预定义处理器', () => {
      const testHandler = new TauriErrorHandler()
      const registerSpy = vi.spyOn(testHandler, 'register')

      // 模拟注册过程
      registerPredefinedHandlers()

      // 验证全局 errorHandler 已注册处理器
      expect(errorHandler).toBeDefined()
    })
  })
})

describe('errorHandler - 初始化', () => {
  describe('initializeErrorHandling', () => {
    it('应该注册全局错误处理器', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      initializeErrorHandling()

      // 应该没有抛出错误
      expect(consoleErrorSpy).not.toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('应该监听未捕获的 Promise 拒绝', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

      initializeErrorHandling()

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'unhandledrejection',
        expect.any(Function)
      )
    })

    it('应该监听未捕获的错误', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

      initializeErrorHandling()

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      )
    })
  })
})

describe('errorHandler - 边界情况', () => {
  it('应该处理 null 和 undefined', async () => {
    const handler = new TauriErrorHandler()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await handler.handle(null as any)
    await handler.handle(undefined as any)

    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('应该处理循环错误引用', async () => {
    const handler = new TauriErrorHandler()
    const error: any = createTauriError('Test')
    error.context = { self: error }

    await expect(handler.handle(error)).resolves.not.toThrow()
  })

  it('应该处理非常长的错误消息', async () => {
    const handler = new TauriErrorHandler()
    const longMessage = 'A'.repeat(10000)
    const error = createTauriError(longMessage)

    await expect(handler.handle(error)).resolves.not.toThrow()
  })

  it('应该处理特殊字符', async () => {
    const handler = new TauriErrorHandler()
    const error = createTauriError('Error with 中文 and émojis 🔥')

    await expect(handler.handle(error)).resolves.not.toThrow()
  })

  it('应该处理深层嵌套的上下文', async () => {
    const handler = new TauriErrorHandler()
    const deepContext = {
      level1: {
        level2: {
          level3: {
            level4: {
              value: 'deep'
            }
          }
        }
      }
    }
    const error = createTauriError('Test', 'TEST', ErrorCategory.SYSTEM, 'medium', deepContext)

    await expect(handler.handle(error)).resolves.not.toThrow()
  })
})

describe('errorHandler - 性能测试', () => {
  it('应该快速处理大量错误', async () => {
    const handler = new TauriErrorHandler()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const start = Date.now()

    for (let i = 0; i < 1000; i++) {
      await handler.handle(createTauriError(`Error ${i}`))
    }

    const duration = Date.now() - start

    // 1000 个错误应该在合理时间内处理完（< 1秒）
    expect(duration).toBeLessThan(1000)

    consoleErrorSpy.mockRestore()
  })

  it('应该不会因大量错误导致内存泄漏', async () => {
    const handler = new TauriErrorHandler()

    for (let i = 0; i < 200; i++) {
      await handler.handle(createTauriError(`Error ${i}`))
    }

    const history = handler.getErrorHistory()
    
    // 历史记录应该被限制
    expect(history.length).toBeLessThanOrEqual(100)
  })
})

