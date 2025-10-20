/**
 * 性能测试工具函数
 * 
 * 提供性能测试所需的各种工具和辅助函数
 */

// ==================== 性能测量工具 ====================

/**
 * 测量同步函数执行时间
 */
export function measureRenderTime(callback: () => void): number {
  const startTime = performance.now()
  callback()
  const endTime = performance.now()
  return endTime - startTime
}

/**
 * 测量异步函数执行时间
 */
export async function measureAsyncRenderTime(callback: () => Promise<void>): Promise<number> {
  const startTime = performance.now()
  await callback()
  const endTime = performance.now()
  return endTime - startTime
}

/**
 * 测量多次执行的平均时间
 */
export function measureAverageTime(callback: () => void, iterations: number = 10): {
  average: number
  min: number
  max: number
  median: number
} {
  const times: number[] = []
  
  for (let i = 0; i < iterations; i++) {
    times.push(measureRenderTime(callback))
  }
  
  const sorted = [...times].sort((a, b) => a - b)
  const average = times.reduce((sum, time) => sum + time, 0) / times.length
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const median = sorted[Math.floor(sorted.length / 2)]
  
  return { average, min, max, median }
}

// ==================== FPS 测量工具 ====================

/**
 * 帧率测量器
 */
export class FPSMeter {
  private frames: number[] = []
  private rafId: number | null = null
  private lastTime: number = 0
  private isRunning: boolean = false

  /**
   * 开始测量
   */
  start() {
    if (this.isRunning) {
      return
    }
    
    this.frames = []
    this.lastTime = performance.now()
    this.isRunning = true
    this.measure()
  }

  private measure = () => {
    if (!this.isRunning) {
      return
    }

    const currentTime = performance.now()
    const delta = currentTime - this.lastTime
    
    if (delta > 0) {
      const fps = 1000 / delta
      this.frames.push(fps)
    }
    
    this.lastTime = currentTime
    this.rafId = requestAnimationFrame(this.measure)
  }

  /**
   * 停止测量并返回统计数据
   */
  stop(): { average: number; min: number; max: number; median: number; samples: number } {
    this.isRunning = false
    
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    if (this.frames.length === 0) {
      return { average: 0, min: 0, max: 0, median: 0, samples: 0 }
    }

    const sorted = [...this.frames].sort((a, b) => a - b)
    const average = this.frames.reduce((a, b) => a + b, 0) / this.frames.length
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const median = sorted[Math.floor(sorted.length / 2)]

    return { average, min, max, median, samples: this.frames.length }
  }

  /**
   * 重置测量器
   */
  reset() {
    this.stop()
    this.frames = []
  }
}

// ==================== 内存测量工具 ====================

/**
 * 获取当前内存使用情况（字节）
 */
export function getMemoryUsage(): number {
  if ((performance as any).memory) {
    return (performance as any).memory.usedJSHeapSize
  }
  return 0
}

/**
 * 获取格式化的内存使用情况（MB）
 */
export function getMemoryUsageMB(): number {
  return getMemoryUsage() / 1024 / 1024
}

/**
 * 测量内存增长
 */
export async function measureMemoryGrowth(
  callback: () => void | Promise<void>
): Promise<{ before: number; after: number; growth: number; growthMB: number }> {
  // 强制垃圾回收（如果可用）
  if (global.gc) {
    global.gc()
  }
  
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const before = getMemoryUsage()
  
  await callback()
  
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const after = getMemoryUsage()
  const growth = after - before
  const growthMB = growth / 1024 / 1024
  
  return { before, after, growth, growthMB }
}

// ==================== 事件监听器监控 ====================

/**
 * 事件监听器监控器
 */
export class EventListenerMonitor {
  private static instance: EventListenerMonitor | null = null
  private originalAddEventListener: any
  private originalRemoveEventListener: any
  private listeners: Map<string, number> = new Map()
  private isInstalled: boolean = false

  /**
   * 获取单例实例
   */
  static getInstance(): EventListenerMonitor {
    if (!EventListenerMonitor.instance) {
      EventListenerMonitor.instance = new EventListenerMonitor()
    }
    return EventListenerMonitor.instance
  }

  /**
   * 安装监控器
   */
  install() {
    if (this.isInstalled) {
      return
    }

    this.originalAddEventListener = EventTarget.prototype.addEventListener
    this.originalRemoveEventListener = EventTarget.prototype.removeEventListener

    const self = this

    EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
      const current = self.listeners.get(type) || 0
      self.listeners.set(type, current + 1)
      return self.originalAddEventListener.call(this, type, listener, options)
    }

    EventTarget.prototype.removeEventListener = function(type: string, listener: any, options?: any) {
      const current = self.listeners.get(type) || 0
      self.listeners.set(type, Math.max(0, current - 1))
      return self.originalRemoveEventListener.call(this, type, listener, options)
    }

    this.isInstalled = true
  }

  /**
   * 卸载监控器
   */
  uninstall() {
    if (!this.isInstalled) {
      return
    }

    EventTarget.prototype.addEventListener = this.originalAddEventListener
    EventTarget.prototype.removeEventListener = this.originalRemoveEventListener
    this.isInstalled = false
  }

  /**
   * 获取监听器数量
   */
  getListenerCount(type?: string): number {
    if (type) {
      return this.listeners.get(type) || 0
    }
    return Array.from(this.listeners.values()).reduce((sum, count) => sum + count, 0)
  }

  /**
   * 获取所有监听器类型和数量
   */
  getAllListeners(): Map<string, number> {
    return new Map(this.listeners)
  }

  /**
   * 重置计数器
   */
  reset() {
    this.listeners.clear()
  }
}

// ==================== 定时器监控 ====================

/**
 * 定时器监控器
 */
export class TimerMonitor {
  private activeTimers: Set<number> = new Set()
  private activeIntervals: Set<number> = new Set()
  private originalSetTimeout: any
  private originalSetInterval: any
  private originalClearTimeout: any
  private originalClearInterval: any
  private isInstalled: boolean = false

  /**
   * 安装监控器
   */
  install() {
    if (this.isInstalled) {
      return
    }

    this.originalSetTimeout = global.setTimeout
    this.originalSetInterval = global.setInterval
    this.originalClearTimeout = global.clearTimeout
    this.originalClearInterval = global.clearInterval

    const self = this

    global.setTimeout = ((...args: any[]) => {
      const id = self.originalSetTimeout(...args)
      self.activeTimers.add(id)
      return id
    }) as any

    global.setInterval = ((...args: any[]) => {
      const id = self.originalSetInterval(...args)
      self.activeIntervals.add(id)
      return id
    }) as any

    global.clearTimeout = ((id: number) => {
      self.activeTimers.delete(id)
      return self.originalClearTimeout(id)
    }) as any

    global.clearInterval = ((id: number) => {
      self.activeIntervals.delete(id)
      return self.originalClearInterval(id)
    }) as any

    this.isInstalled = true
  }

  /**
   * 卸载监控器
   */
  uninstall() {
    if (!this.isInstalled) {
      return
    }

    global.setTimeout = this.originalSetTimeout
    global.setInterval = this.originalSetInterval
    global.clearTimeout = this.originalClearTimeout
    global.clearInterval = this.originalClearInterval
    this.isInstalled = false
  }

  /**
   * 获取活动的 setTimeout 数量
   */
  getActiveTimerCount(): number {
    return this.activeTimers.size
  }

  /**
   * 获取活动的 setInterval 数量
   */
  getActiveIntervalCount(): number {
    return this.activeIntervals.size
  }

  /**
   * 获取所有活动定时器总数
   */
  getTotalActiveCount(): number {
    return this.activeTimers.size + this.activeIntervals.size
  }

  /**
   * 清理所有活动的定时器
   */
  cleanup() {
    this.activeTimers.forEach(id => this.originalClearTimeout(id))
    this.activeIntervals.forEach(id => this.originalClearInterval(id))
    this.reset()
  }

  /**
   * 重置监控器
   */
  reset() {
    this.activeTimers.clear()
    this.activeIntervals.clear()
  }
}

// ==================== requestAnimationFrame 监控 ====================

/**
 * RAF 监控器
 */
export class RAFMonitor {
  private activeRAFs: Set<number> = new Set()
  private originalRequestAnimationFrame: any
  private originalCancelAnimationFrame: any
  private isInstalled: boolean = false

  /**
   * 安装监控器
   */
  install() {
    if (this.isInstalled) {
      return
    }

    this.originalRequestAnimationFrame = global.requestAnimationFrame
    this.originalCancelAnimationFrame = global.cancelAnimationFrame

    const self = this

    global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const id = self.originalRequestAnimationFrame(callback)
      self.activeRAFs.add(id)
      return id
    }) as any

    global.cancelAnimationFrame = ((id: number) => {
      self.activeRAFs.delete(id)
      return self.originalCancelAnimationFrame(id)
    }) as any

    this.isInstalled = true
  }

  /**
   * 卸载监控器
   */
  uninstall() {
    if (!this.isInstalled) {
      return
    }

    global.requestAnimationFrame = this.originalRequestAnimationFrame
    global.cancelAnimationFrame = this.originalCancelAnimationFrame
    this.isInstalled = false
  }

  /**
   * 获取活动的 RAF 数量
   */
  getActiveRAFCount(): number {
    return this.activeRAFs.size
  }

  /**
   * 清理所有活动的 RAF
   */
  cleanup() {
    this.activeRAFs.forEach(id => this.originalCancelAnimationFrame(id))
    this.reset()
  }

  /**
   * 重置监控器
   */
  reset() {
    this.activeRAFs.clear()
  }
}

// ==================== 性能标记和测量 ====================

/**
 * 性能标记工具
 */
export class PerformanceMarker {
  private marks: Map<string, number> = new Map()
  private measures: Map<string, number> = new Map()

  /**
   * 添加性能标记
   */
  mark(name: string) {
    this.marks.set(name, performance.now())
  }

  /**
   * 测量两个标记之间的时间
   */
  measure(name: string, startMark: string, endMark?: string): number | null {
    const startTime = this.marks.get(startMark)
    if (!startTime) {
      console.warn(`Start mark "${startMark}" not found`)
      return null
    }

    const endTime = endMark ? this.marks.get(endMark) : performance.now()
    if (!endTime) {
      console.warn(`End mark "${endMark}" not found`)
      return null
    }

    const duration = endTime - startTime
    this.measures.set(name, duration)
    return duration
  }

  /**
   * 获取测量结果
   */
  getMeasure(name: string): number | null {
    return this.measures.get(name) || null
  }

  /**
   * 获取所有测量结果
   */
  getAllMeasures(): Map<string, number> {
    return new Map(this.measures)
  }

  /**
   * 清除所有标记和测量
   */
  clear() {
    this.marks.clear()
    this.measures.clear()
  }
}

// ==================== 导出 ====================

export default {
  // 性能测量
  measureRenderTime,
  measureAsyncRenderTime,
  measureAverageTime,
  
  // FPS 测量
  FPSMeter,
  
  // 内存测量
  getMemoryUsage,
  getMemoryUsageMB,
  measureMemoryGrowth,
  
  // 监控工具
  EventListenerMonitor,
  TimerMonitor,
  RAFMonitor,
  
  // 性能标记
  PerformanceMarker,
}

