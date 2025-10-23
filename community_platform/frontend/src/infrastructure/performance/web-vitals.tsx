/**
 * Web Vitals 性能监控
 * 监控和上报核心 Web 指标
 */

'use client'

import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB } from 'web-vitals'
import type { Metric } from 'web-vitals'

/**
 * 性能指标类型
 */
export type PerformanceMetric = {
  id: string
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  navigationType: string
  timestamp: number
}

/**
 * 性能指标阈值
 */
const THRESHOLDS = {
  // LCP - Largest Contentful Paint
  LCP: {
    good: 2500,
    poor: 4000,
  },
  // FID - First Input Delay
  FID: {
    good: 100,
    poor: 300,
  },
  // CLS - Cumulative Layout Shift
  CLS: {
    good: 0.1,
    poor: 0.25,
  },
  // FCP - First Contentful Paint
  FCP: {
    good: 1800,
    poor: 3000,
  },
  // TTFB - Time to First Byte
  TTFB: {
    good: 800,
    poor: 1800,
  },
  // INP - Interaction to Next Paint
  INP: {
    good: 200,
    poor: 500,
  },
}

/**
 * 获取性能评级
 */
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS]
  if (!threshold) return 'good'

  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

/**
 * 格式化性能指标
 */
function formatMetric(metric: Metric): PerformanceMetric {
  return {
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: getRating(metric.name, metric.value),
    delta: metric.delta,
    navigationType: metric.navigationType,
    timestamp: Date.now(),
  }
}

/**
 * 性能指标上报接口
 */
interface PerformanceReporter {
  onMetric: (metric: PerformanceMetric) => void
}

/**
 * 默认上报器 - 发送到分析服务
 */
class DefaultReporter implements PerformanceReporter {
  private queue: PerformanceMetric[] = []
  private readonly maxQueueSize = 10
  private readonly flushInterval = 5000 // 5秒

  constructor() {
    if (typeof window !== 'undefined') {
      setInterval(() => this.flush(), this.flushInterval)
      
      // 页面卸载时强制上报
      window.addEventListener('beforeunload', () => this.flush())
    }
  }

  onMetric(metric: PerformanceMetric): void {
    this.queue.push(metric)
    
    // 队列满了就上报
    if (this.queue.length >= this.maxQueueSize) {
      this.flush()
    }
  }

  private flush(): void {
    if (this.queue.length === 0) return

    const metrics = [...this.queue]
    this.queue = []

    // 发送到分析服务
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(metrics)], {
        type: 'application/json',
      })
      navigator.sendBeacon('/api/analytics/web-vitals', blob)
    } else {
      // 降级到 fetch
      fetch('/api/analytics/web-vitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metrics),
        keepalive: true,
      }).catch((error) => {
        console.error('上报性能指标失败:', error)
      })
    }
  }
}

/**
 * 控制台日志上报器 - 开发环境使用
 */
class ConsoleReporter implements PerformanceReporter {
  onMetric(metric: PerformanceMetric): void {
    const emoji = {
      good: '✅',
      'needs-improvement': '⚠️',
      poor: '❌',
    }[metric.rating]

    console.log(
      `${emoji} ${metric.name}:`,
      `${metric.value.toFixed(2)}ms`,
      `(${metric.rating})`
    )
  }
}

/**
 * 性能监控管理器
 */
class PerformanceMonitor {
  private reporters: PerformanceReporter[] = []
  private initialized = false

  constructor() {
    // 根据环境选择上报器
    if (process.env.NODE_ENV === 'development') {
      this.reporters.push(new ConsoleReporter())
    } else {
      this.reporters.push(new DefaultReporter())
    }
  }

  /**
   * 添加自定义上报器
   */
  addReporter(reporter: PerformanceReporter): void {
    this.reporters.push(reporter)
  }

  /**
   * 初始化监控
   */
  init(): void {
    if (this.initialized || typeof window === 'undefined') return
    this.initialized = true

    const handleMetric = (metric: Metric) => {
      const formattedMetric = formatMetric(metric)
      this.reporters.forEach((reporter) => {
        reporter.onMetric(formattedMetric)
      })
    }

    // 监控所有核心指标
    onCLS(handleMetric)
    onFCP(handleMetric)
    onFID(handleMetric)
    onINP(handleMetric)
    onLCP(handleMetric)
    onTTFB(handleMetric)
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceEntry[] {
    if (typeof window === 'undefined') return []

    const performance = window.performance
    if (!performance || !performance.getEntriesByType) return []

    return [
      ...performance.getEntriesByType('navigation'),
      ...performance.getEntriesByType('paint'),
      ...performance.getEntriesByType('largest-contentful-paint'),
      ...performance.getEntriesByType('layout-shift'),
    ]
  }

  /**
   * 标记自定义性能指标
   */
  mark(name: string): void {
    if (typeof window === 'undefined') return
    window.performance?.mark(name)
  }

  /**
   * 测量自定义性能指标
   */
  measure(name: string, startMark: string, endMark?: string): void {
    if (typeof window === 'undefined') return
    
    try {
      window.performance?.measure(name, startMark, endMark)
    } catch (error) {
      console.error('测量性能指标失败:', error)
    }
  }
}

// 导出单例
export const performanceMonitor = new PerformanceMonitor()

/**
 * React 组件 - 初始化性能监控
 */
export function WebVitalsReporter() {
  if (typeof window !== 'undefined') {
    performanceMonitor.init()
  }
  
  return null
}

/**
 * Hook - 使用性能监控
 */
export function usePerformanceMonitor() {
  return {
    mark: performanceMonitor.mark.bind(performanceMonitor),
    measure: performanceMonitor.measure.bind(performanceMonitor),
    getCurrentMetrics: performanceMonitor.getCurrentMetrics.bind(performanceMonitor),
  }
}

/**
 * 性能预算检查
 */
export const performanceBudget = {
  /**
   * 检查是否超出性能预算
   */
  check: (metrics: PerformanceMetric[]): boolean => {
    return metrics.every((metric) => metric.rating !== 'poor')
  },

  /**
   * 获取超出预算的指标
   */
  getViolations: (metrics: PerformanceMetric[]): PerformanceMetric[] => {
    return metrics.filter((metric) => metric.rating === 'poor')
  },

  /**
   * 生成性能报告
   */
  generateReport: (metrics: PerformanceMetric[]): string => {
    const violations = performanceBudget.getViolations(metrics)
    
    if (violations.length === 0) {
      return '✅ 所有性能指标都在预算内'
    }

    return `❌ 发现 ${violations.length} 个性能问题:\n${violations
      .map((m) => `  - ${m.name}: ${m.value.toFixed(2)}ms (${m.rating})`)
      .join('\n')}`
  },
}

