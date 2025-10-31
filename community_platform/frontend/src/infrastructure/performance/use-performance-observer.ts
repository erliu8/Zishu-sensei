/**
 * 性能观察 Hook
 * 使用 Performance Observer API 监控性能指标
 */

'use client'

import { useEffect, useState } from 'react'

/**
 * 性能入口类型
 */
export type PerformanceEntryType =
  | 'navigation'
  | 'resource'
  | 'mark'
  | 'measure'
  | 'paint'
  | 'longtask'
  | 'largest-contentful-paint'
  | 'layout-shift'

/**
 * Hook - 使用性能观察器
 */
export function usePerformanceObserver(
  entryTypes: PerformanceEntryType[],
  callback: (entries: PerformanceEntry[]) => void,
  options?: PerformanceObserverInit
) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      callback(entries)
    })

    try {
      observer.observe({
        entryTypes,
        ...options,
      })
    } catch (error) {
      console.error('PerformanceObserver 初始化失败:', error)
    }

    return () => {
      observer.disconnect()
    }
  }, [entryTypes, callback, options])
}

/**
 * Hook - 监控长任务
 */
export function useLongTaskMonitor(threshold: number = 50) {
  const [longTasks, setLongTasks] = useState<PerformanceEntry[]>([])

  usePerformanceObserver(
    ['longtask'],
    (entries) => {
      const tasks = entries.filter((entry) => entry.duration > threshold)
      if (tasks.length > 0) {
        setLongTasks((prev) => [...prev, ...tasks])
        
        // 记录警告
        tasks.forEach((task) => {
          console.warn(
            `⚠️ 检测到长任务: ${task.name} (${task.duration.toFixed(2)}ms)`
          )
        })
      }
    }
  )

  return longTasks
}

/**
 * Hook - 监控布局偏移
 */
export function useLayoutShiftMonitor() {
  const [layoutShifts, setLayoutShifts] = useState<PerformanceEntry[]>([])
  const [clsScore, setClsScore] = useState(0)

  usePerformanceObserver(
    ['layout-shift'],
    (entries) => {
      let score = clsScore

      entries.forEach((entry: any) => {
        // 只计算非用户交互导致的布局偏移
        if (!entry.hadRecentInput) {
          score += entry.value
        }
      })

      setClsScore(score)
      setLayoutShifts((prev) => [...prev, ...entries])

      if (score > 0.1) {
        console.warn(`⚠️ CLS 分数超标: ${score.toFixed(3)}`)
      }
    }
  )

  return { layoutShifts, clsScore }
}

/**
 * Hook - 监控资源加载
 */
export function useResourceMonitor() {
  const [resources, setResources] = useState<PerformanceResourceTiming[]>([])

  usePerformanceObserver(
    ['resource'],
    (entries) => {
      const resourceEntries = entries as PerformanceResourceTiming[]
      setResources((prev) => [...prev, ...resourceEntries])

      // 检查慢资源
      resourceEntries.forEach((resource) => {
        if (resource.duration > 1000) {
          console.warn(
            `⚠️ 资源加载缓慢: ${resource.name} (${resource.duration.toFixed(2)}ms)`
          )
        }
      })
    }
  )

  return {
    resources,
    totalResources: resources.length,
    totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
    slowResources: resources.filter((r) => r.duration > 1000),
  }
}

/**
 * Hook - 监控导航时序
 */
export function useNavigationTiming() {
  const [timing, setTiming] = useState<PerformanceNavigationTiming | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const navigationEntries = performance.getEntriesByType('navigation')
    if (navigationEntries.length > 0) {
      setTiming(navigationEntries[0] as PerformanceNavigationTiming)
    }
  }, [])

  if (!timing) return null

  return {
    timing,
    metrics: {
      // DNS 查询时间
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      // TCP 连接时间
      tcp: timing.connectEnd - timing.connectStart,
      // SSL 握手时间
      ssl: timing.secureConnectionStart > 0
        ? timing.connectEnd - timing.secureConnectionStart
        : 0,
      // TTFB (Time to First Byte)
      ttfb: timing.responseStart - timing.requestStart,
      // 内容下载时间
      download: timing.responseEnd - timing.responseStart,
      // DOM 处理时间
      domProcessing: timing.domComplete - timing.domInteractive,
      // DOM 内容加载完成
      domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
      // 页面加载完成
      load: timing.loadEventEnd - timing.loadEventStart,
      // 总时间
      total: timing.loadEventEnd - timing.fetchStart,
    },
  }
}

/**
 * Hook - 监控绘制时间
 */
export function usePaintTiming() {
  const [paintMetrics, setPaintMetrics] = useState<{
    fcp?: number
    lcp?: number
  }>({})

  useEffect(() => {
    if (typeof window === 'undefined') return

    // First Contentful Paint
    const fcpEntries = performance.getEntriesByName('first-contentful-paint')
    const fcpEntry = fcpEntries[0]
    if (fcpEntry) {
      setPaintMetrics((prev) => ({
        ...prev,
        fcp: fcpEntry.startTime,
      }))
    }
  }, [])

  usePerformanceObserver(
    ['largest-contentful-paint'],
    (entries) => {
      const lastEntry = entries[entries.length - 1]
      if (lastEntry) {
        setPaintMetrics((prev) => ({
          ...prev,
          lcp: lastEntry.startTime,
        }))
      }
    }
  )

  return paintMetrics
}

/**
 * Hook - 综合性能监控
 */
export function usePerformanceMetrics() {
  const navigationTiming = useNavigationTiming()
  const paintMetrics = usePaintTiming()
  const { clsScore } = useLayoutShiftMonitor()
  const longTasks = useLongTaskMonitor()
  const { resources, totalSize, slowResources } = useResourceMonitor()

  return {
    navigation: navigationTiming,
    paint: paintMetrics,
    cls: clsScore,
    longTasks: longTasks.length,
    resources: {
      count: resources.length,
      totalSize,
      slowCount: slowResources.length,
    },
  }
}

