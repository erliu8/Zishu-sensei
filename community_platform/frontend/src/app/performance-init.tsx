/**
 * 性能优化初始化组件
 * 在应用启动时初始化所有性能优化功能
 */

'use client'

import { useEffect } from 'react'
import { 
  criticalResourcePreloader, 
  routePreloader,
  deferExecution,
} from '@/infrastructure/performance'

/**
 * 性能优化初始化
 */
export function PerformanceInit() {
  useEffect(() => {
    // 预加载关键资源
    criticalResourcePreloader.preloadAll()

    // 启用智能路由预加载
    routePreloader.smartPrefetch()

    // 空闲时执行非关键任务
    deferExecution.idle(() => {
      // 预加载下一个可能访问的路由
      routePreloader.prefetchNextRoutes([
        '/posts',
        '/adapters',
        '/characters',
      ])
    })

    // 监控性能问题
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      // 监听长任务
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              console.warn(
                `⚠️ 检测到长任务: ${entry.name} (${entry.duration.toFixed(2)}ms)`
              )
            }
          }
        })

        try {
          observer.observe({ entryTypes: ['longtask'] })
        } catch (e) {
          // longtask 可能不被支持
        }
      }
    }
  }, [])

  return null
}

/**
 * 性能预算警告
 */
export function PerformanceBudgetWarning() {
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') {
      return
    }

    // 检查 Bundle 大小
    deferExecution.idle(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'))
      let totalSize = 0

      scripts.forEach((script) => {
        const src = (script as HTMLScriptElement).src
        if (src && src.includes('/_next/')) {
          // 估算大小（实际应该从 Network 面板获取）
          fetch(src, { method: 'HEAD' })
            .then((res) => {
              const size = parseInt(res.headers.get('content-length') || '0')
              totalSize += size
              
              const sizeKB = totalSize / 1024
              const budget = 200 // 200KB

              if (sizeKB > budget) {
                console.warn(
                  `⚠️ JavaScript Bundle 超出预算: ${sizeKB.toFixed(2)}KB / ${budget}KB`
                )
              }
            })
            .catch(() => {
              // 忽略错误
            })
        }
      })
    }, { timeout: 5000 })
  }, [])

  return null
}

