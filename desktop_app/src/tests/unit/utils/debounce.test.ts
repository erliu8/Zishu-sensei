/**
 * 防抖和节流工具函数测试
 * 
 * 测试 debounce.ts 中的所有防抖和节流函数
 * 确保时序控制的准确性和健壮性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  debounce,
  throttle,
  adaptiveDebounce,
  throttleWithCount,
  rafThrottle,
  idleDebounce,
  debounceThrottle,
  conditionalDebounce,
  debouncePromise,
  throttlePromise,
  type DebouncedFunction,
  type ThrottledFunction,
} from '../../../utils/debounce'

describe('debounce - 防抖函数', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('基础防抖', () => {
    it('应该延迟执行函数', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(50)
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(50)
      expect(fn).toHaveBeenCalledOnce()
    })

    it('应该在连续调用时重置定时器', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      vi.advanceTimersByTime(50)

      debouncedFn()
      vi.advanceTimersByTime(50)
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(50)
      expect(fn).toHaveBeenCalledOnce()
    })

    it('应该传递参数给原函数', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('arg1', 'arg2', 123)
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 123)
    })

    it('应该保持正确的 this 上下文', () => {
      const obj = {
        value: 42,
        fn: vi.fn(function (this: any) {
          return this.value
        }),
      }

      const debouncedFn = debounce(obj.fn, 100)
      debouncedFn.call(obj)
      vi.advanceTimersByTime(100)

      expect(obj.fn).toHaveBeenCalled()
    })

    it('应该使用最后一次调用的参数', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('first')
      debouncedFn('second')
      debouncedFn('third')

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledWith('third')
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('leading 选项', () => {
    it('应该在前导边缘立即执行', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100, { leading: true, trailing: false })

      debouncedFn()
      expect(fn).toHaveBeenCalledOnce()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledOnce()
    })

    it('应该同时支持前导和尾随执行', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100, { leading: true, trailing: true })

      debouncedFn()
      expect(fn).toHaveBeenCalledOnce()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('应该在等待期间不重复执行前导', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100, { leading: true })

      debouncedFn()
      expect(fn).toHaveBeenCalledOnce()

      debouncedFn()
      debouncedFn()
      expect(fn).toHaveBeenCalledOnce()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('maxWait 选项', () => {
    it('应该在达到最大等待时间时强制执行', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 50, { maxWait: 100 })

      debouncedFn()
      vi.advanceTimersByTime(40)

      debouncedFn()
      vi.advanceTimersByTime(40)

      debouncedFn()
      vi.advanceTimersByTime(40)

      expect(fn).toHaveBeenCalledOnce() // 120ms 已过，超过 maxWait
    })

    it('应该在 maxWait 期间重置定时器', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 50, { maxWait: 200 })

      for (let i = 0; i < 10; i++) {
        debouncedFn()
        vi.advanceTimersByTime(30)
      }

      expect(fn).toHaveBeenCalled()
    })
  })

  describe('cancel 方法', () => {
    it('应该取消待处理的调用', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      debouncedFn.cancel()

      vi.advanceTimersByTime(100)
      expect(fn).not.toHaveBeenCalled()
    })

    it('应该清除所有内部状态', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('arg1')
      debouncedFn.cancel()

      debouncedFn('arg2')
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledWith('arg2')
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('flush 方法', () => {
    it('应该立即执行待处理的调用', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('test')
      debouncedFn.flush()

      expect(fn).toHaveBeenCalledWith('test')
      expect(fn).toHaveBeenCalledOnce()
    })

    it('应该在没有待处理调用时不执行', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn.flush()
      expect(fn).not.toHaveBeenCalled()
    })

    it('应该取消定时器', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      debouncedFn.flush()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('pending 方法', () => {
    it('应该返回是否有待处理的调用', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      expect(debouncedFn.pending()).toBe(false)

      debouncedFn()
      expect(debouncedFn.pending()).toBe(true)

      vi.advanceTimersByTime(100)
      expect(debouncedFn.pending()).toBe(false)
    })

    it('应该在 cancel 后返回 false', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      expect(debouncedFn.pending()).toBe(true)

      debouncedFn.cancel()
      expect(debouncedFn.pending()).toBe(false)
    })
  })
})

describe('throttle - 节流函数', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('基础节流', () => {
    it('应该限制函数执行频率', () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100)

      throttledFn()
      expect(fn).toHaveBeenCalledOnce()

      throttledFn()
      throttledFn()
      expect(fn).toHaveBeenCalledOnce()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('应该在等待时间后允许下一次执行', () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100)

      throttledFn()
      expect(fn).toHaveBeenCalledOnce()

      vi.advanceTimersByTime(100)
      
      throttledFn()
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('应该传递参数', () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100)

      throttledFn('arg1', 'arg2')
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
    })
  })

  describe('leading 选项', () => {
    it('应该禁用前导执行', () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100, { leading: false })

      throttledFn()
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledOnce()
    })

    it('应该启用前导执行（默认）', () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100, { leading: true })

      throttledFn()
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('trailing 选项', () => {
    it('应该禁用尾随执行', () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100, { trailing: false })

      throttledFn()
      expect(fn).toHaveBeenCalledOnce()

      throttledFn()
      throttledFn()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('cancel 和 flush', () => {
    it('应该支持 cancel 方法', () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100)

      throttledFn()
      throttledFn.cancel()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledOnce()
    })

    it('应该支持 flush 方法', () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100, { leading: false })

      throttledFn('test')
      throttledFn.flush()

      expect(fn).toHaveBeenCalledWith('test')
    })
  })
})

describe('adaptiveDebounce - 自适应防抖', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该根据调用频率调整等待时间', () => {
    const fn = vi.fn()
    const adaptiveFn = adaptiveDebounce(fn, 50, 200)

    // 首次调用
    adaptiveFn()
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalled()
  })

  it('应该在最小和最大等待时间之间', () => {
    const fn = vi.fn()
    const adaptiveFn = adaptiveDebounce(fn, 50, 200)

    adaptiveFn()
    adaptiveFn()
    adaptiveFn()

    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalled()
  })
})

describe('throttleWithCount - 带计数的节流', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该记录跳过的调用次数', () => {
    const fn = vi.fn()
    const onSkip = vi.fn()
    const throttledFn = throttleWithCount(fn, 100, onSkip)

    throttledFn()
    expect(fn).toHaveBeenCalledOnce()

    throttledFn()
    throttledFn()
    throttledFn()

    vi.advanceTimersByTime(100)

    throttledFn()
    expect(onSkip).toHaveBeenCalledWith(3)
  })

  it('应该在执行时重置跳过计数', () => {
    const fn = vi.fn()
    const onSkip = vi.fn()
    const throttledFn = throttleWithCount(fn, 100, onSkip)

    throttledFn()
    throttledFn()

    vi.advanceTimersByTime(100)

    throttledFn()
    expect(onSkip).toHaveBeenCalledWith(1)

    onSkip.mockClear()
    throttledFn()

    vi.advanceTimersByTime(100)

    throttledFn()
    expect(onSkip).toHaveBeenCalledWith(0)
  })
})

describe('rafThrottle - 帧节流', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该使用 requestAnimationFrame 节流', () => {
    const fn = vi.fn()
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      setTimeout(cb, 16)
      return 1
    })

    const throttledFn = rafThrottle(fn)

    throttledFn()
    expect(rafSpy).toHaveBeenCalledOnce()
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(16)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('应该在多次调用时只使用最后的参数', () => {
    const fn = vi.fn()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      setTimeout(cb, 16)
      return 1
    })

    const throttledFn = rafThrottle(fn)

    throttledFn('first')
    throttledFn('second')
    throttledFn('third')

    vi.advanceTimersByTime(16)
    expect(fn).toHaveBeenCalledWith('third')
    expect(fn).toHaveBeenCalledOnce()
  })

  it('应该支持 cancel 方法', () => {
    const fn = vi.fn()
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame')
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 123)

    const throttledFn = rafThrottle(fn)

    throttledFn()
    expect(throttledFn.pending()).toBe(true)

    throttledFn.cancel()
    expect(throttledFn.pending()).toBe(false)
    expect(cancelSpy).toHaveBeenCalledWith(123)
  })

  it('应该支持 flush 方法', () => {
    const fn = vi.fn()
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)

    const throttledFn = rafThrottle(fn)

    throttledFn('test')
    throttledFn.flush()

    expect(fn).toHaveBeenCalledWith('test')
  })
})

describe('idleDebounce - 空闲防抖', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该在浏览器空闲时执行', () => {
    const fn = vi.fn()
    
    // Mock requestIdleCallback
    global.requestIdleCallback = vi.fn((cb) => {
      setTimeout(() => cb({} as IdleDeadline), 1)
      return 1
    })

    const debouncedFn = idleDebounce(fn)

    debouncedFn('test')
    vi.advanceTimersByTime(1)

    expect(fn).toHaveBeenCalledWith('test')
  })

  it('应该在不支持 requestIdleCallback 时降级到 setTimeout', () => {
    const fn = vi.fn()
    const originalRequestIdleCallback = global.requestIdleCallback
    
    // @ts-ignore
    delete global.requestIdleCallback

    const debouncedFn = idleDebounce(fn)

    debouncedFn('test')
    vi.advanceTimersByTime(1)

    expect(fn).toHaveBeenCalledWith('test')

    // 恢复
    global.requestIdleCallback = originalRequestIdleCallback
  })

  it('应该支持 cancel 方法', () => {
    const fn = vi.fn()
    global.requestIdleCallback = vi.fn(() => 1)
    global.cancelIdleCallback = vi.fn()

    const debouncedFn = idleDebounce(fn)

    debouncedFn()
    debouncedFn.cancel()

    expect(global.cancelIdleCallback).toHaveBeenCalledWith(1)
  })
})

describe('debounceThrottle - 防抖节流混合', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该结合防抖和节流特性', () => {
    const fn = vi.fn()
    const combined = debounceThrottle(fn, 50, 100)

    combined()
    expect(fn).toHaveBeenCalledOnce()

    combined()
    combined()
    vi.advanceTimersByTime(50)

    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('conditionalDebounce - 条件防抖', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该在条件满足时防抖', () => {
    const fn = vi.fn()
    const condition = (value: number) => value > 5
    const debouncedFn = conditionalDebounce(fn, 100, condition)

    debouncedFn(10)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith(10)
  })

  it('应该在条件不满足时立即执行', () => {
    const fn = vi.fn()
    const condition = (value: number) => value > 5
    const debouncedFn = conditionalDebounce(fn, 100, condition)

    debouncedFn(3)
    expect(fn).toHaveBeenCalledWith(3)
  })

  it('应该支持 cancel 和 flush', () => {
    const fn = vi.fn()
    const condition = () => true
    const debouncedFn = conditionalDebounce(fn, 100, condition)

    debouncedFn('test')
    debouncedFn.cancel()

    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('debouncePromise - Promise 防抖', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该防抖异步函数', async () => {
    const fn = vi.fn(async (value: string) => `result-${value}`)
    const debouncedFn = debouncePromise(fn, 100)

    const promise1 = debouncedFn('first')
    const promise2 = debouncedFn('second')
    const promise3 = debouncedFn('third')

    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()

    const result = await promise3
    expect(result).toBe('result-third')
    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith('third')

    // 所有 Promise 应该共享同一个结果
    await expect(promise1).resolves.toBe('result-third')
    await expect(promise2).resolves.toBe('result-third')
  })

  it('应该处理异步函数错误', async () => {
    const error = new Error('Test error')
    const fn = vi.fn(async () => {
      throw error
    })
    const debouncedFn = debouncePromise(fn, 100)

    const promise = debouncedFn()

    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()

    await expect(promise).rejects.toThrow('Test error')
  })

  it('应该在连续调用时重置定时器', async () => {
    const fn = vi.fn(async (value: string) => value)
    const debouncedFn = debouncePromise(fn, 100)

    debouncedFn('first')
    vi.advanceTimersByTime(50)

    debouncedFn('second')
    vi.advanceTimersByTime(50)

    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    await vi.runAllTimersAsync()

    expect(fn).toHaveBeenCalledOnce()
    expect(fn).toHaveBeenCalledWith('second')
  })
})

describe('throttlePromise - Promise 节流', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该节流异步函数', async () => {
    const fn = vi.fn(async (value: string) => `result-${value}`)
    const throttledFn = throttlePromise(fn, 100)

    const result1 = await throttledFn('first')
    expect(result1).toBe('result-first')
    expect(fn).toHaveBeenCalledOnce()

    const promise2 = throttledFn('second')
    expect(fn).toHaveBeenCalledOnce() // 仍然是一次，因为在节流期间

    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()

    const result2 = await promise2
    expect(result2).toBe('result-second')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('应该在节流期间共享 Promise', async () => {
    const fn = vi.fn(async (value: string) => value)
    const throttledFn = throttlePromise(fn, 100)

    await throttledFn('first')

    const promise1 = throttledFn('second')
    const promise2 = throttledFn('third')

    expect(promise1).toBe(promise2) // 应该是同一个 Promise

    vi.advanceTimersByTime(100)
    await vi.runAllTimersAsync()

    await promise1
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('应该在等待时间后允许新的调用', async () => {
    const fn = vi.fn(async (value: number) => value * 2)
    const throttledFn = throttlePromise(fn, 100)

    const result1 = await throttledFn(5)
    expect(result1).toBe(10)

    vi.advanceTimersByTime(100)

    const result2 = await throttledFn(10)
    expect(result2).toBe(20)

    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('边界情况和错误处理', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应该处理 wait 时间为 0', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 0)

    debouncedFn()
    vi.advanceTimersByTime(0)

    expect(fn).toHaveBeenCalledOnce()
  })

  it('应该处理负的 wait 时间', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, -100)

    debouncedFn()
    vi.advanceTimersByTime(0)

    expect(fn).toHaveBeenCalledOnce()
  })

  it('应该处理多次 cancel', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn()
    debouncedFn.cancel()
    debouncedFn.cancel()
    debouncedFn.cancel()

    expect(debouncedFn.pending()).toBe(false)
  })

  it('应该处理多次 flush', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn('test')
    debouncedFn.flush()
    debouncedFn.flush()
    debouncedFn.flush()

    expect(fn).toHaveBeenCalledOnce()
  })

  it('应该处理 undefined 和 null 参数', () => {
    const fn = vi.fn()
    const debouncedFn = debounce(fn, 100)

    debouncedFn(undefined, null)
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledWith(undefined, null)
  })

  it('应该处理返回值', () => {
    const fn = vi.fn(() => 'return-value')
    const debouncedFn = debounce(fn, 100, { leading: true })

    const result = debouncedFn()
    expect(result).toBeUndefined() // 防抖函数不返回值

    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalled()
  })
})

