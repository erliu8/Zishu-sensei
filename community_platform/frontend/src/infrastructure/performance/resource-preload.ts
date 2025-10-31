/**
 * 资源预加载工具
 * 提供各种资源预加载和关键路径优化功能
 */

/**
 * 预加载类型
 */
export enum PreloadType {
  SCRIPT = 'script',
  STYLE = 'style',
  FONT = 'font',
  IMAGE = 'image',
  FETCH = 'fetch',
  DOCUMENT = 'document',
}

/**
 * 预加载优先级
 */
export enum PreloadPriority {
  HIGH = 'high',
  LOW = 'low',
  AUTO = 'auto',
}

/**
 * 预加载资源配置
 */
export interface PreloadResourceConfig {
  /**
   * 资源 URL
   */
  href: string

  /**
   * 资源类型
   */
  as: PreloadType

  /**
   * 跨域设置
   */
  crossOrigin?: 'anonymous' | 'use-credentials'

  /**
   * 优先级
   */
  priority?: PreloadPriority

  /**
   * MIME 类型
   */
  type?: string
}

/**
 * 资源预加载管理器
 */
class ResourcePreloader {
  private preloadedResources: Set<string> = new Set()
  private prefetchedResources: Set<string> = new Set()

  /**
   * 预加载资源（高优先级）
   */
  preload(config: PreloadResourceConfig): void {
    if (typeof document === 'undefined') return
    if (this.preloadedResources.has(config.href)) return

    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = config.href
    link.as = config.as

    if (config.crossOrigin) {
      link.crossOrigin = config.crossOrigin
    }

    if (config.type) {
      link.type = config.type
    }

    if (config.priority) {
      link.setAttribute('importance', config.priority)
    }

    document.head.appendChild(link)
    this.preloadedResources.add(config.href)
  }

  /**
   * 预获取资源（低优先级）
   */
  prefetch(href: string): void {
    if (typeof document === 'undefined') return
    if (this.prefetchedResources.has(href)) return

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = href

    document.head.appendChild(link)
    this.prefetchedResources.add(href)
  }

  /**
   * DNS 预解析
   */
  dnsPrefetch(hostname: string): void {
    if (typeof document === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'dns-prefetch'
    link.href = hostname

    document.head.appendChild(link)
  }

  /**
   * 预连接
   */
  preconnect(hostname: string, crossOrigin?: boolean): void {
    if (typeof document === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = hostname

    if (crossOrigin) {
      link.crossOrigin = 'anonymous'
    }

    document.head.appendChild(link)
  }

  /**
   * 预加载图片
   */
  preloadImage(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is undefined'))
        return
      }

      const img = new Image()
      img.onload = () => resolve()
      img.onerror = reject
      img.src = src
    })
  }

  /**
   * 批量预加载图片
   */
  async preloadImages(sources: string[]): Promise<void[]> {
    return Promise.all(sources.map((src) => this.preloadImage(src)))
  }

  /**
   * 预加载字体
   */
  preloadFont(href: string, type: string = 'font/woff2'): void {
    this.preload({
      href,
      as: PreloadType.FONT,
      type,
      crossOrigin: 'anonymous',
    })
  }

  /**
   * 预加载脚本
   */
  preloadScript(href: string): void {
    this.preload({
      href,
      as: PreloadType.SCRIPT,
    })
  }

  /**
   * 预加载样式
   */
  preloadStyle(href: string): void {
    this.preload({
      href,
      as: PreloadType.STYLE,
    })
  }

  /**
   * 预加载模块
   */
  async preloadModule(modulePath: string): Promise<any> {
    try {
      return await import(/* webpackMode: "eager" */ `${modulePath}`)
    } catch (error) {
      console.error('预加载模块失败:', modulePath, error)
      throw error
    }
  }

  /**
   * 预获取数据
   */
  async prefetchData<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      priority: 'low' as any,
    })

    if (!response.ok) {
      throw new Error(`预获取失败: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * 检查资源是否已预加载
   */
  isPreloaded(href: string): boolean {
    return this.preloadedResources.has(href)
  }

  /**
   * 检查资源是否已预获取
   */
  isPrefetched(href: string): boolean {
    return this.prefetchedResources.has(href)
  }

  /**
   * 清除预加载标记
   */
  clear(): void {
    this.preloadedResources.clear()
    this.prefetchedResources.clear()
  }
}

// 导出单例
export const resourcePreloader = new ResourcePreloader()

/**
 * 关键资源预加载
 */
export const criticalResourcePreloader = {
  /**
   * 预加载关键字体
   */
  preloadCriticalFonts: () => {
    const fonts = [
      '/fonts/inter-var.woff2',
      '/fonts/noto-sans-sc.woff2',
    ]

    fonts.forEach((font) => {
      resourcePreloader.preloadFont(font)
    })
  },

  /**
   * 预加载关键样式
   */
  preloadCriticalStyles: () => {
    const styles = [
      '/styles/critical.css',
    ]

    styles.forEach((style) => {
      resourcePreloader.preloadStyle(style)
    })
  },

  /**
   * 预加载关键图片
   */
  preloadCriticalImages: () => {
    const images = [
      '/images/logo.png',
      '/images/hero-background.webp',
    ]

    resourcePreloader.preloadImages(images).catch((error) => {
      console.warn('预加载关键图片失败:', error)
    })
  },

  /**
   * 预连接到关键域名
   */
  preconnectCriticalOrigins: () => {
    const origins = [
      'https://api.zishu.ai',
      'https://cdn.zishu.ai',
    ]

    origins.forEach((origin) => {
      resourcePreloader.preconnect(origin, true)
    })
  },

  /**
   * 执行所有关键资源预加载
   */
  preloadAll: () => {
    criticalResourcePreloader.preloadCriticalFonts()
    criticalResourcePreloader.preloadCriticalStyles()
    criticalResourcePreloader.preloadCriticalImages()
    criticalResourcePreloader.preconnectCriticalOrigins()
  },
}

/**
 * 路由预加载
 */
export const routePreloader = {
  /**
   * 预获取路由
   */
  prefetchRoute: (route: string) => {
    if (typeof window === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = route

    document.head.appendChild(link)
  },

  /**
   * 预加载下一个可能的路由
   */
  prefetchNextRoutes: (routes: string[]) => {
    routes.forEach((route) => {
      routePreloader.prefetchRoute(route)
    })
  },

  /**
   * 智能预加载 - 基于用户行为
   */
  smartPrefetch: () => {
    if (typeof window === 'undefined') return

    // 监听鼠标悬停在链接上
    document.addEventListener('mouseover', (e) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (link && link.href) {
        resourcePreloader.prefetch(link.href)
      }
    })

    // 监听触摸开始（移动端）
    document.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (link && link.href) {
        resourcePreloader.prefetch(link.href)
      }
    })
  },
}

/**
 * Hook - 使用资源预加载
 */
export function useResourcePreload() {
  return {
    preload: resourcePreloader.preload.bind(resourcePreloader),
    prefetch: resourcePreloader.prefetch.bind(resourcePreloader),
    preloadImage: resourcePreloader.preloadImage.bind(resourcePreloader),
    preloadImages: resourcePreloader.preloadImages.bind(resourcePreloader),
    preloadFont: resourcePreloader.preloadFont.bind(resourcePreloader),
    preloadScript: resourcePreloader.preloadScript.bind(resourcePreloader),
    preloadStyle: resourcePreloader.preloadStyle.bind(resourcePreloader),
  }
}

/**
 * 延迟执行工具
 */
export const deferExecution = {
  /**
   * 空闲时执行
   */
  idle: (callback: () => void, options?: { timeout?: number }) => {
    if (typeof window === 'undefined') return

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(callback, options)
    } else {
      // 降级到 setTimeout
      setTimeout(callback, 1)
    }
  },

  /**
   * 动画帧时执行
   */
  frame: (callback: () => void) => {
    if (typeof window === 'undefined') return

    window.requestAnimationFrame(callback)
  },

  /**
   * 延迟执行
   */
  delay: (callback: () => void, ms: number) => {
    setTimeout(callback, ms)
  },

  /**
   * 在可见性变化时执行
   */
  onVisible: (callback: () => void) => {
    if (typeof document === 'undefined') return

    if (document.visibilityState === 'visible') {
      callback()
    } else {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          callback()
        }
      }, { once: true })
    }
  },
}

/**
 * 组件代码分割助手
 */
export const codeSplitHelper = {
  /**
   * 创建路由级别的代码分割
   */
  createRouteBundle: (routes: string[]) => {
    return routes.map((route) => ({
      path: route,
      component: () => import(`@/app${route}/page`),
    }))
  },

  /**
   * 创建功能级别的代码分割
   */
  createFeatureBundle: (features: string[]) => {
    return features.map((feature) => ({
      name: feature,
      loader: () => import(`@/features/${feature}`),
    }))
  },
}

