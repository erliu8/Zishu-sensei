/**
 * 防抖和节流工具函数
 * 
 * 提供高性能的防抖（Debounce）和节流（Throttle）实现
 * 支持取消、立即执行、前导/尾随边缘等高级选项
 * 
 * @module utils/debounce
 * @author zishu-sensei
 * @version 1.0.0
 */

// ================================
// 类型定义
// ================================

/**
 * 防抖选项
 */
export interface DebounceOptions {
    /** 是否在前导边缘执行 */
    leading?: boolean
    /** 是否在尾随边缘执行 */
    trailing?: boolean
    /** 最大等待时间（毫秒） */
    maxWait?: number
}

/**
 * 节流选项
 */
export interface ThrottleOptions {
    /** 是否在前导边缘执行 */
    leading?: boolean
    /** 是否在尾随边缘执行 */
    trailing?: boolean
}

/**
 * 可取消的函数
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void
    cancel: () => void
    flush: () => void
    pending: () => boolean
}

/**
 * 节流函数
 */
export interface ThrottledFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void
    cancel: () => void
    flush: () => void
    pending: () => boolean
}

// ================================
// 防抖函数实现
// ================================

/**
 * 防抖函数
 * 
 * 在事件被触发n秒后再执行回调，如果在这n秒内又被触发，则重新计时
 * 
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   console.log('Searching for:', query)
 * }, 300)
 * 
 * // 用户快速输入时只会在停止输入300ms后执行一次
 * debouncedSearch('hello')
 * debouncedSearch('hello world')
 * ```
 * 
 * @param func - 要防抖的函数
 * @param wait - 等待时间（毫秒）
 * @param options - 防抖选项
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    options: DebounceOptions = {}
): DebouncedFunction<T> {
    const {
        leading = false,
        trailing = true,
        maxWait,
    } = options

    let timerId: ReturnType<typeof setTimeout> | null = null
    let lastCallTime: number | null = null
    let lastInvokeTime = 0
    let lastArgs: Parameters<T> | null = null
    let lastThis: any = null
    let result: ReturnType<T> | undefined

    // 检查是否应该执行
    function shouldInvoke(time: number): boolean {
        const timeSinceLastCall = lastCallTime ? time - lastCallTime : 0
        const timeSinceLastInvoke = time - lastInvokeTime

        // 首次调用或距离上次调用超过等待时间或达到最大等待时间
        return (
            lastCallTime === null ||
            timeSinceLastCall >= wait ||
            timeSinceLastCall < 0 ||
            (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
        )
    }

    // 调用函数
    function invokeFunc(time: number): ReturnType<T> | undefined {
        const args = lastArgs!
        const thisArg = lastThis

        lastArgs = null
        lastThis = null
        lastInvokeTime = time
        result = func.apply(thisArg, args) as ReturnType<T>
        return result
    }

    // 前导边缘处理
    function leadingEdge(time: number): ReturnType<T> | undefined {
        lastInvokeTime = time
        timerId = setTimeout(timerExpired, wait)
        return leading ? invokeFunc(time) : (result as ReturnType<T> | undefined)
    }

    // 计算剩余等待时间
    function remainingWait(time: number): number {
        const timeSinceLastCall = lastCallTime ? time - lastCallTime : 0
        const timeSinceLastInvoke = time - lastInvokeTime
        const timeWaiting = wait - timeSinceLastCall

        return maxWait !== undefined
            ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
            : timeWaiting
    }

    // 定时器过期处理
    function timerExpired(): void {
        const time = Date.now()
        if (shouldInvoke(time)) {
            trailingEdge(time)
        } else {
            // 重新启动定时器
            timerId = setTimeout(timerExpired, remainingWait(time))
        }
    }

    // 尾随边缘处理
    function trailingEdge(time: number): ReturnType<T> | undefined {
        timerId = null

        if (trailing && lastArgs) {
            return invokeFunc(time)
        }

        lastArgs = null
        lastThis = null
        return result
    }

    // 取消防抖
    function cancel(): void {
        if (timerId !== null) {
            clearTimeout(timerId)
        }
        lastInvokeTime = 0
        lastArgs = null
        lastCallTime = null
        lastThis = null
        timerId = null
    }

    // 立即执行
    function flush(): ReturnType<T> | undefined {
        return timerId === null ? result : trailingEdge(Date.now())
    }

    // 检查是否有待处理的调用
    function pending(): boolean {
        return timerId !== null
    }

    // 防抖函数主体
    function debounced(this: any, ...args: Parameters<T>): void {
        const time = Date.now()
        const isInvoking = shouldInvoke(time)

        lastArgs = args
        lastThis = this
        lastCallTime = time

        if (isInvoking) {
            if (timerId === null) {
                leadingEdge(lastCallTime)
            } else if (maxWait !== undefined) {
                // 在最大等待时间内重新启动定时器
                timerId = setTimeout(timerExpired, wait)
                invokeFunc(lastCallTime)
            }
        } else if (timerId === null) {
            timerId = setTimeout(timerExpired, wait)
        }
    }

    debounced.cancel = cancel
    debounced.flush = flush
    debounced.pending = pending

    return debounced as DebouncedFunction<T>
}

// ================================
// 节流函数实现
// ================================

/**
 * 节流函数
 * 
 * 规定时间内只执行一次函数，降低函数执行频率
 * 
 * @example
 * ```typescript
 * const throttledScroll = throttle(() => {
 *   console.log('Scroll handler')
 * }, 100)
 * 
 * // 无论滚动多快，每100ms最多执行一次
 * window.addEventListener('scroll', throttledScroll)
 * ```
 * 
 * @param func - 要节流的函数
 * @param wait - 等待时间（毫秒）
 * @param options - 节流选项
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    options: ThrottleOptions = {}
): ThrottledFunction<T> {
    const {
        leading = true,
        trailing = true,
    } = options

    // 使用 debounce 实现节流
    return debounce(func, wait, {
        leading,
        trailing,
        maxWait: wait,
    }) as ThrottledFunction<T>
}

// ================================
// 高级防抖/节流变体
// ================================

/**
 * 自适应防抖
 * 
 * 根据调用频率动态调整等待时间
 * 
 * @param func - 要防抖的函数
 * @param minWait - 最小等待时间（毫秒）
 * @param maxWait - 最大等待时间（毫秒）
 * @returns 防抖后的函数
 */
export function adaptiveDebounce<T extends (...args: any[]) => any>(
    func: T,
    minWait: number,
    maxWait: number
): DebouncedFunction<T> {
    let callCount = 0
    let lastResetTime = Date.now()
    const resetInterval = 1000 // 每秒重置计数

    return debounce(function (this: any, ...args: Parameters<T>) {
        const now = Date.now()
        
        // 重置计数
        if (now - lastResetTime > resetInterval) {
            callCount = 0
            lastResetTime = now
        }

        callCount++

        // 根据调用频率计算等待时间
        const wait = Math.min(
            maxWait,
            minWait + (callCount * 10)
        )

        // 创建新的防抖函数
        const debouncedFunc = debounce(func, wait)
        debouncedFunc.apply(this, args)
    }, minWait)
}

/**
 * 带计数的节流
 * 
 * 在节流期间记录被跳过的调用次数
 * 
 * @param func - 要节流的函数
 * @param wait - 等待时间（毫秒）
 * @param onSkip - 跳过时的回调函数
 * @returns 节流后的函数
 */
export function throttleWithCount<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    onSkip?: (skipCount: number) => void
): ThrottledFunction<T> {
    let skipCount = 0
    let lastExecuteTime = 0

    const throttled = throttle(function (this: any, ...args: Parameters<T>) {
        if (skipCount > 0 && onSkip) {
            onSkip(skipCount)
        }
        skipCount = 0
        lastExecuteTime = Date.now()
        return func.apply(this, args)
    }, wait)

    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now()
        if (now - lastExecuteTime < wait) {
            skipCount++
        }
        return throttled.apply(this, args)
    } as ThrottledFunction<T>
}

/**
 * 帧节流
 * 
 * 使用 requestAnimationFrame 进行节流
 * 适用于动画和视觉更新
 * 
 * @param func - 要节流的函数
 * @returns 节流后的函数
 */
export function rafThrottle<T extends (...args: any[]) => any>(
    func: T
): DebouncedFunction<T> {
    let rafId: number | null = null
    let lastArgs: Parameters<T> | null = null
    let lastThis: any = null

    function cancel(): void {
        if (rafId !== null) {
            cancelAnimationFrame(rafId)
            rafId = null
        }
        lastArgs = null
        lastThis = null
    }

    function flush(): void {
        if (lastArgs) {
            func.apply(lastThis, lastArgs)
            cancel()
        }
    }

    function pending(): boolean {
        return rafId !== null
    }

    function throttled(this: any, ...args: Parameters<T>): void {
        lastArgs = args
        lastThis = this

        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                func.apply(lastThis, lastArgs!)
                cancel()
            })
        }
    }

    throttled.cancel = cancel
    throttled.flush = flush
    throttled.pending = pending

    return throttled as DebouncedFunction<T>
}

/**
 * 空闲防抖
 * 
 * 使用 requestIdleCallback 进行防抖
 * 在浏览器空闲时执行函数
 * 
 * @param func - 要防抖的函数
 * @param options - requestIdleCallback 选项
 * @returns 防抖后的函数
 */
export function idleDebounce<T extends (...args: any[]) => any>(
    func: T,
    options?: IdleRequestOptions
): DebouncedFunction<T> {
    let idleId: number | null = null
    let lastArgs: Parameters<T> | null = null
    let lastThis: any = null

    // requestIdleCallback 降级方案
    const requestIdle = 
        typeof requestIdleCallback !== 'undefined'
            ? requestIdleCallback
            : (cb: IdleRequestCallback) => setTimeout(cb, 1) as any

    const cancelIdle =
        typeof cancelIdleCallback !== 'undefined'
            ? cancelIdleCallback
            : clearTimeout

    function cancel(): void {
        if (idleId !== null) {
            cancelIdle(idleId)
            idleId = null
        }
        lastArgs = null
        lastThis = null
    }

    function flush(): void {
        if (lastArgs) {
            func.apply(lastThis, lastArgs)
            cancel()
        }
    }

    function pending(): boolean {
        return idleId !== null
    }

    function debounced(this: any, ...args: Parameters<T>): void {
        lastArgs = args
        lastThis = this

        if (idleId !== null) {
            cancelIdle(idleId)
        }

        idleId = requestIdle(() => {
            func.apply(lastThis, lastArgs!)
            cancel()
        }, options)
    }

    debounced.cancel = cancel
    debounced.flush = flush
    debounced.pending = pending

    return debounced as DebouncedFunction<T>
}

// ================================
// 组合工具函数
// ================================

/**
 * 创建防抖/节流混合函数
 * 
 * 结合防抖和节流的特性
 * 
 * @param func - 要处理的函数
 * @param debounceWait - 防抖等待时间
 * @param throttleWait - 节流等待时间
 * @returns 处理后的函数
 */
export function debounceThrottle<T extends (...args: any[]) => any>(
    func: T,
    debounceWait: number,
    throttleWait: number
): DebouncedFunction<T> {
    const throttled = throttle(func, throttleWait)
    return debounce(throttled, debounceWait)
}

/**
 * 条件防抖
 * 
 * 只在满足条件时进行防抖
 * 
 * @param func - 要防抖的函数
 * @param wait - 等待时间
 * @param condition - 条件函数
 * @returns 防抖后的函数
 */
export function conditionalDebounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    condition: (...args: Parameters<T>) => boolean
): DebouncedFunction<T> {
    const debouncedFunc = debounce(func, wait)

    function conditional(this: any, ...args: Parameters<T>): void {
        if (condition(...args)) {
            debouncedFunc.apply(this, args)
        } else {
            func.apply(this, args)
        }
    }

    conditional.cancel = debouncedFunc.cancel
    conditional.flush = debouncedFunc.flush
    conditional.pending = debouncedFunc.pending

    return conditional as DebouncedFunction<T>
}

// ================================
// Promise 防抖/节流
// ================================

/**
 * Promise 防抖
 * 
 * 防抖异步函数，返回 Promise
 * 
 * @param func - 异步函数
 * @param wait - 等待时间
 * @returns 防抖后的异步函数
 */
export function debouncePromise<T extends (...args: any[]) => Promise<any>>(
    func: T,
    wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    let timerId: ReturnType<typeof setTimeout> | null = null
    let pendingPromise: Promise<ReturnType<T>> | null = null
    let resolve: ((value: ReturnType<T>) => void) | null = null
    let reject: ((reason?: any) => void) | null = null

    return function (this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
        if (timerId) {
            clearTimeout(timerId)
        }

        if (!pendingPromise) {
            pendingPromise = new Promise<ReturnType<T>>((res, rej) => {
                resolve = res
                reject = rej
            })
        }

        timerId = setTimeout(async () => {
            try {
                const result = await func.apply(this, args)
                resolve?.(result)
            } catch (error) {
                reject?.(error)
            } finally {
                pendingPromise = null
                resolve = null
                reject = null
            }
        }, wait)

        return pendingPromise
    }
}

/**
 * Promise 节流
 * 
 * 节流异步函数，返回 Promise
 * 
 * @param func - 异步函数
 * @param wait - 等待时间
 * @returns 节流后的异步函数
 */
export function throttlePromise<T extends (...args: any[]) => Promise<any>>(
    func: T,
    wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    let lastExecuteTime = 0
    let pendingPromise: Promise<ReturnType<T>> | null = null

    return async function (this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
        const now = Date.now()
        const timeSinceLastExecute = now - lastExecuteTime

        if (timeSinceLastExecute >= wait) {
            lastExecuteTime = now
            return func.apply(this, args)
        } else {
            if (!pendingPromise) {
                pendingPromise = new Promise<ReturnType<T>>((resolve) => {
                    setTimeout(async () => {
                        lastExecuteTime = Date.now()
                        const result = await func.apply(this, args)
                        pendingPromise = null
                        resolve(result)
                    }, wait - timeSinceLastExecute)
                })
            }
            return pendingPromise
        }
    }
}

// ================================
// 导出所有函数
// ================================

export default {
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
}

