import { Application, Ticker } from 'pixi.js'
import { Live2DModel } from 'pixi-live2d-display/cubism4'
import { initializeLive2DCubismCore } from '@/utils/live2d-init'

// 修复 PixiJS BatchRenderer 的 checkMaxIfStatementsInShader 问题
// 注意：这个修复现在在 Live2DModelLoader 构造函数中执行，以避免模块加载时的异步问题

// 在导入后立即配置 Live2D
if (typeof window !== 'undefined') {
  // 等待 Cubism Core 加载
  window.addEventListener('DOMContentLoaded', () => {
    // 确保 Live2D Cubism Core 可用
    if ((window as any).Live2DCubismCore) {
      try {
        // 使用类型断言来避免 Ticker 类型冲突
        Live2DModel.registerTicker(Ticker as any)
        console.log('✅ Live2D Model 注册完成')
      } catch (error) {
        console.warn('⚠️ Live2D Ticker 注册失败:', error)
      }
    }
  })
}

/**
 * Live2D模型配置接口
 */
export interface Live2DModelConfig {
  /** 模型唯一标识 */
  id: string
  /** 模型名称 */
  name: string
  /** 模型文件路径 */
  modelPath: string
  /** 模型预览图 */
  previewImage?: string
  /** 模型分类 */
  category?: string
  /** 自定义标签 */
  tags?: string[]
  /** 模型描述 */
  description?: string
  /** 模型作者 */
  author?: string
  /** 模型版本 */
  version?: string
  /** 模型许可证 */
  license?: string
}

/**
 * Live2D渲染配置
 */
export interface Live2DRenderConfig {
  /** 模型缩放 */
  scale: number
  /** 模型位置 */
  position: { x: number; y: number }
  /** 模型透明度 */
  opacity: number
  /** 是否启用物理效果 */
  enablePhysics: boolean
  /** 是否启用呼吸效果 */
  enableBreathing: boolean
  /** 是否启用眨眼 */
  enableEyeBlink: boolean
  /** 是否启用眼部追踪 */
  enableEyeTracking: boolean
  /** 是否启用唇形同步 */
  enableLipSync: boolean
  /** 动作淡入淡出时间 */
  motionFadeDuration: number
  /** 表情淡入淡出时间 */
  expressionFadeDuration: number
}

/**
 * Live2D加载状态
 */
export enum LoadState {
  IDLE = 'idle',
  LOADING = 'loading',
  LOADED = 'loaded',
  ERROR = 'error',
}

/**
 * Live2D加载事件
 */
export enum LoaderEvent {
  LOAD_START = 'loadStart',
  LOAD_PROGRESS = 'loadProgress',
  LOAD_COMPLETE = 'loadComplete',
  LOAD_ERROR = 'loadError',
  MODEL_READY = 'modelReady',
  MOTION_START = 'motionStart',
  MOTION_COMPLETE = 'motionComplete',
  EXPRESSION_START = 'expressionStart',
  EXPRESSION_COMPLETE = 'expressionComplete',
}

/**
 * Live2D加载进度信息
 */
export interface LoadProgress {
  /** 当前进度 (0-1) */
  progress: number
  /** 加载阶段描述 */
  stage: string
  /** 当前加载的文件名 */
  currentFile?: string
  /** 已加载文件数 */
  loadedFiles: number
  /** 总文件数 */
  totalFiles: number
}

  /**
   * Live2D模型实例接口
   */
  export interface Live2DModelInstance {
    /** 模型实例 */
    model: Live2DModel
    /** 模型配置 */
    config: Live2DModelConfig
    /** 渲染配置 */
    renderConfig: Live2DRenderConfig
    /** 加载时间戳 */
    loadTime: number
    /** 是否已就绪 */
    isReady: boolean
    /** 当前播放的动作 */
    currentMotion?: string
    /** 当前表情 */
    currentExpression?: string
    /** 使用次数 */
    usageCount: number
    /** 最后使用时间 */
    lastUsedTime: number
    /** 模型统计信息 */
    stats: {
      totalMotionsPlayed: number
      totalExpressionsSet: number
      averageFPS: number
      memoryUsage: number
    }
  }

/**
 * Live2D模型加载器错误类
 */
export class Live2DLoaderError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'Live2DLoaderError'
  }
}

/**
 * Live2D模型资源管理器
 */
class Live2DResourceManager {
  private resourceCache = new Map<string, any>()
  private loadingPromises = new Map<string, Promise<any>>()
  private cacheMetadata = new Map<string, {
    url: string
    size: number
    lastAccessed: number
    accessCount: number
    contentType: string
  }>()
  
  // 缓存配置
  private readonly maxCacheSize = 100 * 1024 * 1024 // 100MB
  private readonly maxCacheItems = 500
  private readonly maxAgeMs = 30 * 60 * 1000 // 30分钟

  /**
   * 预加载资源
   */
  async preloadResource(url: string): Promise<any> {
    if (this.resourceCache.has(url)) {
      this.updateAccessMetadata(url)
      return this.resourceCache.get(url)
    }

    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)
    }

    const promise = this.fetchResource(url)
    this.loadingPromises.set(url, promise)

    try {
      const resource = await promise
      await this.cacheResource(url, resource)
      this.loadingPromises.delete(url)
      return resource
    } catch (error) {
      this.loadingPromises.delete(url)
      throw error
    }
  }

  /**
   * 批量预加载资源
   */
  async preloadResources(urls: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>()
    const batchSize = 5 // 限制并发数
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize)
      const batchPromises = batch.map(async (url) => {
        try {
          const resource = await this.preloadResource(url)
          results.set(url, resource)
        } catch (error) {
          console.warn(`预加载资源失败: ${url}`, error)
          results.set(url, null)
        }
      })
      
      await Promise.all(batchPromises)
    }
    
    return results
  }

  /**
   * 缓存资源
   */
  private async cacheResource(url: string, resource: any): Promise<void> {
    // 检查缓存大小限制
    await this.ensureCacheCapacity()
    
    const size = this.estimateResourceSize(resource)
    const contentType = this.detectContentType(resource)
    
    this.resourceCache.set(url, resource)
    this.cacheMetadata.set(url, {
      url,
      size,
      lastAccessed: Date.now(),
      accessCount: 1,
      contentType
    })
  }

  /**
   * 确保缓存容量
   */
  private async ensureCacheCapacity(): Promise<void> {
    // 清理过期缓存
    this.cleanExpiredCache()
    
    // 如果超出限制，使用LRU策略清理
    if (this.resourceCache.size >= this.maxCacheItems) {
      this.evictLRUItems(Math.floor(this.maxCacheItems * 0.2))
    }
    
    // 检查总大小
    const totalSize = this.getTotalCacheSize()
    if (totalSize > this.maxCacheSize) {
      this.evictLRUItems(Math.floor(this.maxCacheItems * 0.3))
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    for (const [key, metadata] of this.cacheMetadata) {
      if (now - metadata.lastAccessed > this.maxAgeMs) {
        expiredKeys.push(key)
      }
    }
    
    for (const key of expiredKeys) {
      this.resourceCache.delete(key)
      this.cacheMetadata.delete(key)
    }
    
    if (expiredKeys.length > 0) {
      console.log(`清理了 ${expiredKeys.length} 个过期缓存项`)
    }
  }

  /**
   * 驱逐LRU项目
   */
  private evictLRUItems(count: number): void {
    const items = Array.from(this.cacheMetadata.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      .slice(0, count)
    
    for (const [key] of items) {
      this.resourceCache.delete(key)
      this.cacheMetadata.delete(key)
    }
    
    console.log(`驱逐了 ${count} 个LRU缓存项`)
  }

  /**
   * 获取缓存资源
   */
  getCachedResource(url: string): any {
    if (this.resourceCache.has(url)) {
      this.updateAccessMetadata(url)
      return this.resourceCache.get(url)
    }
    return null
  }

  /**
   * 更新访问元数据
   */
  private updateAccessMetadata(url: string): void {
    const metadata = this.cacheMetadata.get(url)
    if (metadata) {
      metadata.lastAccessed = Date.now()
      metadata.accessCount++
    }
  }

  /**
   * 估算资源大小
   */
  private estimateResourceSize(resource: any): number {
    if (resource instanceof ArrayBuffer) {
      return resource.byteLength
    } else if (resource instanceof Blob) {
      return resource.size
    } else if (typeof resource === 'string') {
      return resource.length * 2 // UTF-16 encoding
    } else if (typeof resource === 'object') {
      return JSON.stringify(resource).length * 2
    }
    return 1024 // 默认估算
  }

  /**
   * 检测内容类型
   */
  private detectContentType(resource: any): string {
    if (resource instanceof ArrayBuffer) {
      return 'application/octet-stream'
    } else if (resource instanceof Blob) {
      return resource.type || 'application/octet-stream'
    } else if (typeof resource === 'object') {
      return 'application/json'
    }
    return 'text/plain'
  }

  /**
   * 获取总缓存大小
   */
  private getTotalCacheSize(): number {
    let totalSize = 0
    for (const metadata of this.cacheMetadata.values()) {
      totalSize += metadata.size
    }
    return totalSize
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    totalItems: number
    totalSize: number
    hitRate: number
    memoryUsage: string
  } {
    const totalSize = this.getTotalCacheSize()
    let totalAccess = 0
    let totalHits = 0
    
    for (const metadata of this.cacheMetadata.values()) {
      totalAccess += metadata.accessCount
      totalHits += metadata.accessCount - 1 // 第一次访问不算命中
    }
    
    return {
      totalItems: this.resourceCache.size,
      totalSize,
      hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
      memoryUsage: this.formatBytes(totalSize)
    }
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 清理资源缓存
   */
  clearCache(): void {
    this.resourceCache.clear()
    this.loadingPromises.clear()
    this.cacheMetadata.clear()
  }

  /**
   * 获取资源缓存大小
   */
  getCacheSize(): number {
    return this.resourceCache.size
  }

  private async fetchResource(url: string): Promise<any> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch resource: ${url} (${response.status})`)
    }

    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return response.json()
    } else if (contentType?.startsWith('image/')) {
      return response.blob()
    } else {
      return response.arrayBuffer()
    }
  }
}

/**
 * 性能监控器（暂未使用）
 */
/*
class LoaderPerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  private startTimes: Map<string, number> = new Map()

  startTiming(key: string): void {
    this.startTimes.set(key, performance.now())
  }

  endTiming(key: string): number {
    const startTime = this.startTimes.get(key)
    if (!startTime) return 0

    const duration = performance.now() - startTime
    this.startTimes.delete(key)

    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }
    this.metrics.get(key)!.push(duration)
    
    // 保持最近100个记录
    const records = this.metrics.get(key)!
    if (records.length > 100) {
      records.shift()
    }

    return duration
  }

  getAverageTime(key: string): number {
    const records = this.metrics.get(key)
    if (!records || records.length === 0) return 0

    return records.reduce((sum, time) => sum + time, 0) / records.length
  }

  getMetrics(): Record<string, { average: number; count: number; latest: number }> {
    const result: Record<string, { average: number; count: number; latest: number }> = {}
    
    for (const [key, records] of this.metrics) {
      if (records.length > 0) {
        result[key] = {
          average: this.getAverageTime(key),
          count: records.length,
          latest: records[records.length - 1]
        }
      }
    }
    
    return result
  }

  clear(): void {
    this.metrics.clear()
    this.startTimes.clear()
  }
}
*/

/**
 * 重试管理器（暂未使用）
 */
/*
class RetryManager {
  private readonly maxRetries = 3
  private readonly baseDelay = 1000
  private retryAttempts = new Map<string, number>()

  async executeWithRetry<T>(
    key: string,
    operation: () => Promise<T>,
    customMaxRetries?: number
  ): Promise<T> {
    const maxRetries = customMaxRetries ?? this.maxRetries
    let attempts = this.retryAttempts.get(key) || 0

    while (attempts < maxRetries) {
      try {
        const result = await operation()
        this.retryAttempts.delete(key) // 成功后清除重试记录
        return result
      } catch (error) {
        attempts++
        this.retryAttempts.set(key, attempts)

        if (attempts >= maxRetries) {
          throw new Live2DLoaderError(
            `操作在${maxRetries}次重试后仍然失败: ${error}`,
            'MAX_RETRIES_EXCEEDED',
            error
          )
        }

        // 指数退避延迟
        const delay = this.baseDelay * Math.pow(2, attempts - 1)
        console.warn(`操作失败，${delay}ms后进行第${attempts}次重试:`, error)
        await this.delay(delay)
      }
    }

    throw new Error('Unexpected retry loop exit')
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getRetryCount(key: string): number {
    return this.retryAttempts.get(key) || 0
  }

  clearRetries(key?: string): void {
    if (key) {
      this.retryAttempts.delete(key)
    } else {
      this.retryAttempts.clear()
    }
  }
}
*/

/**
 * 加载队列管理器（暂未使用）
 */
/*
class LoadQueue {
  private queue: Array<{
    id: string
    config: Live2DModelConfig
    renderConfig?: Partial<Live2DRenderConfig>
    resolve: (value: Live2DModelInstance) => void
    reject: (reason: any) => void
    priority: number
    timestamp: number
  }> = []
  private isProcessing = false
  private maxConcurrent = 2
  private currentLoading = 0

  async enqueue(
    config: Live2DModelConfig,
    renderConfig?: Partial<Live2DRenderConfig>,
    priority: number = 0
  ): Promise<Live2DModelInstance> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id: config.id,
        config,
        renderConfig,
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      })

      // 按优先级和时间戳排序
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority // 高优先级优先
        }
        return a.timestamp - b.timestamp // 早提交的优先
      })

      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.currentLoading >= this.maxConcurrent) {
      return
    }

    this.isProcessing = true

    while (this.queue.length > 0 && this.currentLoading < this.maxConcurrent) {
      const item = this.queue.shift()!
      this.currentLoading++

      // 异步处理，不阻塞队列
      this.processItem(item).finally(() => {
        this.currentLoading--
        this.processQueue() // 继续处理队列
      })
    }

    this.isProcessing = false
  }

  private async processItem(item: {
    id: string
    config: Live2DModelConfig
    renderConfig?: Partial<Live2DRenderConfig>
    resolve: (value: Live2DModelInstance) => void
    reject: (reason: any) => void
  }): Promise<void> {
    try {
      console.log(`开始加载模型: ${item.config.name}`)
      
      // 这里调用实际的模型加载方法（需要访问父类的方法）
      // 由于这是内部类，需要通过回调或其他方式访问父类方法
      // 暂时使用占位符实现
      
      // 模拟加载过程 - 实际实现中应该调用真正的加载方法
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // 创建模拟的模型实例 - 实际实现中会返回真正的模型实例
      const mockInstance: Live2DModelInstance = {
        model: {} as any, // 实际应该是Live2DModel实例
        config: item.config,
        renderConfig: {
          scale: 1.0,
          position: { x: 0, y: 0 },
          opacity: 1.0,
          enablePhysics: true,
          enableBreathing: true,
          enableEyeBlink: true,
          enableEyeTracking: false,
          enableLipSync: false,
          motionFadeDuration: 500,
          expressionFadeDuration: 500,
          ...item.renderConfig
        },
        loadTime: Date.now(),
        isReady: false, // 实际加载完成后设为true
        usageCount: 0,
        lastUsedTime: Date.now(),
        stats: {
          totalMotionsPlayed: 0,
          totalExpressionsSet: 0,
          averageFPS: 60,
          memoryUsage: 0
        }
      }

      // 注意：这里需要重构为实际的加载逻辑
      console.warn('LoadQueue: 使用模拟加载，需要集成实际的加载器逻辑')
      
      item.resolve(mockInstance)
    } catch (error) {
      item.reject(error)
    }
  }

  getQueueLength(): number {
    return this.queue.length
  }

  clearQueue(): void {
    // 拒绝所有待处理的请求
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'))
    }
    this.queue.length = 0
  }

  getQueueStatus(): {
    pending: number
    loading: number
    maxConcurrent: number
  } {
    return {
      pending: this.queue.length,
      loading: this.currentLoading,
      maxConcurrent: this.maxConcurrent
    }
  }
}
*/
/**
 * Live2D模型加载器主类
 */
export class Live2DModelLoader {
  private app!: Application
  private resourceManager: Live2DResourceManager
  private loadedModels = new Map<string, Live2DModelInstance>()
  private currentModel: Live2DModelInstance | null = null
  private loadState: LoadState = LoadState.IDLE
  private eventListeners = new Map<string, Set<Function>>()
  // 兼容旧字段（不再使用）
  // @ts-expect-error kept for backward compatibility but intentionally unused
  private readonly _deprecatedTickerField: null = null
  private canvas: HTMLCanvasElement

  // 默认渲染配置
  private defaultRenderConfig: Live2DRenderConfig = {
    scale: 1.0,
    position: { x: 0, y: 0 },
    opacity: 1.0,
    enablePhysics: true,
    enableBreathing: true,
    enableEyeBlink: true,
    enableEyeTracking: false,
    enableLipSync: false,
    motionFadeDuration: 500,
    expressionFadeDuration: 500,
  }

  /**
   * 预修复 PixiJS 全局配置
   * 在创建 Application 之前修复 BatchRenderer 的全局配置
   */
  private preFixPixiJSGlobalConfiguration(): void {
    try {
      // 首先尝试通过导入的模块直接修复
      try {
        // 在浏览器环境中，尝试通过动态导入访问 PixiJS
        let pixiModule: any = null
        
        // 尝试从全局对象获取 PIXI
        if (typeof window !== 'undefined' && (window as any).PIXI) {
          pixiModule = (window as any).PIXI
        } else if (typeof globalThis !== 'undefined' && (globalThis as any).PIXI) {
          pixiModule = (globalThis as any).PIXI
        }
        
        if (pixiModule && pixiModule.BatchRenderer) {
          const BatchRenderer = pixiModule.BatchRenderer
          
          // 确保修复已应用（如果导入时修复失败）
          if (BatchRenderer.prototype && typeof BatchRenderer.prototype.checkMaxIfStatementsInShader === 'function') {
            const currentMethod = BatchRenderer.prototype.checkMaxIfStatementsInShader
            
            // 检查是否已经被修复过
            if (!currentMethod.toString().includes('safeMaxIfs')) {
              const originalCheck = currentMethod
              BatchRenderer.prototype.checkMaxIfStatementsInShader = function(maxIfs: number) {
                // 确保 maxIfs 是一个有效的正整数，最小值为 32
                let safeMaxIfs = 32
                if (typeof maxIfs === 'number' && maxIfs > 0) {
                  safeMaxIfs = Math.max(maxIfs, 32)
                } else {
                  safeMaxIfs = 100 // 默认安全值
                }
                console.log(`🔧 BatchRenderer 构造时修复: ${maxIfs} -> ${safeMaxIfs}`)
                return originalCheck.call(this, safeMaxIfs)
              }
              console.log('✅ PixiJS BatchRenderer 构造时修复完成')
            } else {
              console.log('✅ PixiJS BatchRenderer 已在导入时修复')
            }
          }
        }
      } catch (moduleError) {
        console.warn('⚠️ 无法通过全局对象修复 PixiJS:', moduleError)
        
        // 备用方案：尝试通过全局对象访问 PixiJS
        const globalPixi = (window as any).PIXI || (globalThis as any).PIXI
        
        if (globalPixi && globalPixi.BatchRenderer) {
          const BatchRenderer = globalPixi.BatchRenderer
          
          if (BatchRenderer.prototype && typeof BatchRenderer.prototype.checkMaxIfStatementsInShader === 'function') {
            const originalCheck = BatchRenderer.prototype.checkMaxIfStatementsInShader
            BatchRenderer.prototype.checkMaxIfStatementsInShader = function(maxIfs: number) {
              // 确保 maxIfs 是一个有效的正整数，最小值为 32
              let safeMaxIfs = 32
              if (typeof maxIfs === 'number' && maxIfs > 0) {
                safeMaxIfs = Math.max(maxIfs, 32)
              } else {
                safeMaxIfs = 100 // 默认安全值
              }
              console.log(`🔧 BatchRenderer 全局修复: ${maxIfs} -> ${safeMaxIfs}`)
              return originalCheck.call(this, safeMaxIfs)
            }
          }
          console.log('✅ PixiJS BatchRenderer 全局配置已修复')
        } else {
          console.log('⚠️ 无法访问 PixiJS，将在 Application 创建后修复')
        }
      }
    } catch (error) {
      console.error('❌ 修复 PixiJS 配置时出错:', error)
    }
  }

  /**
   * 计算模型的最佳缩放比例
   */
  private calculateOptimalScale(model: any, canvasWidth: number, canvasHeight: number): number {
    try {
      if (!model || !this.app) {
        return 1.0
      }

      // 获取模型的边界框
      const bounds = model.getBounds ? model.getBounds() : null
      if (!bounds) {
        // 如果无法获取边界框，使用经验值
        console.log('📏 无法获取模型边界框，使用默认缩放比例')
        return 0.35
      }

      const modelWidth = bounds.width
      const modelHeight = bounds.height
      
      console.log(`📏 模型尺寸: ${modelWidth.toFixed(1)} x ${modelHeight.toFixed(1)}`)
      console.log(`📏 画布尺寸: ${canvasWidth} x ${canvasHeight}`)

      // 计算缩放比例，留出一些边距 (80% 的画布空间)
      const scaleX = (canvasWidth * 0.8) / modelWidth
      const scaleY = (canvasHeight * 0.8) / modelHeight
      const optimalScale = Math.min(scaleX, scaleY)
      
      // 限制缩放范围
      const finalScale = Math.max(0.1, Math.min(2.0, optimalScale))
      
      console.log(`📏 计算出的最佳缩放比例: ${finalScale.toFixed(3)}`)
      return finalScale
      
    } catch (error) {
      console.warn('⚠️ 计算最佳缩放比例时出错:', error)
      return 0.35 // 默认缩放比例
    }
  }

  /**
   * 运行时修复 Live2D 模型的交互管理器
   */
  private fixLive2DInteractionManager(model: any): void {
    try {
      if (!model || !this.app || !this.app.renderer) {
        return
      }
      
      const renderer = this.app.renderer as any
      
      // 修复 interaction 插件的 on 方法
      if (renderer.plugins && renderer.plugins.interaction) {
        const manager = renderer.plugins.interaction
        if (!manager.on) {
          if (manager.addListener) {
            manager.on = manager.addListener.bind(manager)
            console.log('✅ 运行时修复 InteractionManager.on 方法')
          } else if (manager.addEventListener) {
            manager.on = manager.addEventListener.bind(manager)
            console.log('✅ 运行时修复 InteractionManager.on 方法 (使用 addEventListener)')
          } else {
            // 创建一个空的 on 方法来避免错误
            manager.on = function() { return this }
            console.log('⚠️ 创建空的 InteractionManager.on 方法')
          }
        }
      }
      
      // 修复 events 系统的 on 方法
      if (renderer.events) {
        const events = renderer.events
        if (!events.on) {
          if (events.addListener) {
            events.on = events.addListener.bind(events)
            console.log('✅ 运行时修复 EventSystem.on 方法')
          } else if (events.addEventListener) {
            events.on = events.addEventListener.bind(events)
            console.log('✅ 运行时修复 EventSystem.on 方法 (使用 addEventListener)')
          } else {
            // 创建一个空的 on 方法来避免错误
            events.on = function() { return this }
            console.log('⚠️ 创建空的 EventSystem.on 方法')
          }
        }
      }
      
    } catch (error) {
      console.warn('⚠️ 运行时修复 Live2D 交互管理器失败:', error)
    }
  }

  /**
   * 应用全局 PixiJS 兼容性修复
   */
  private applyGlobalPixiJSFixes(): void {
    try {
      // 尝试从多个来源获取 PIXI 对象
      let PIXI: any = null
      
      // 1. 尝试从全局 PIXI 获取
      try {
        if (typeof window !== 'undefined' && (window as any).PIXI) {
          PIXI = (window as any).PIXI
          console.log('✅ 从 window.PIXI 获取到 PIXI 对象')
        }
      } catch (e) {
        console.warn('⚠️ 无法从 window.PIXI 获取 PIXI 对象:', e)
      }
      
      // 2. 尝试动态导入
      if (!PIXI) {
        try {
          const pixiModule = require('pixi.js')
          PIXI = pixiModule.default || pixiModule
          console.log('✅ 通过动态导入获取到 PIXI 对象')
        } catch (e) {
          console.warn('⚠️ 无法通过动态导入获取 PIXI 对象:', e)
        }
      }
      
      if (!PIXI) {
        console.warn('⚠️ 无法获取 PIXI 对象，跳过兼容性修复')
        return
      }
      
      // 修复 Container 的 isInteractive 方法
      if (typeof PIXI.Container !== 'undefined' && PIXI.Container.prototype) {
        const containerProto = PIXI.Container.prototype as any
        
        if (typeof containerProto.isInteractive !== 'function') {
          containerProto.isInteractive = function() {
            return this.interactive !== false && this.eventMode !== 'none'
          }
        }
        
        // 确保 DisplayObject 也有 isInteractive 方法
        if (typeof PIXI.DisplayObject !== 'undefined' && PIXI.DisplayObject.prototype) {
          const displayObjectProto = PIXI.DisplayObject.prototype as any
          if (typeof displayObjectProto.isInteractive !== 'function') {
            displayObjectProto.isInteractive = function() {
              return this.interactive !== false && this.eventMode !== 'none'
            }
          }
        }
        
        console.log('✅ PixiJS 交互性兼容性修复完成')
      }
      
      // 修复事件管理器的 on 方法兼容性
      if (typeof PIXI.utils !== 'undefined' && PIXI.utils.EventEmitter) {
        const EventEmitter = PIXI.utils.EventEmitter
        if (EventEmitter.prototype && typeof EventEmitter.prototype.on !== 'function') {
          // 如果没有 on 方法，尝试使用 addEventListener 或其他方法
          if (typeof EventEmitter.prototype.addEventListener === 'function') {
            EventEmitter.prototype.on = EventEmitter.prototype.addEventListener
          }
        }
        console.log('✅ PixiJS 事件系统兼容性修复完成')
      }
      
      // 修复 InteractionManager 的 on 方法
      if (this.app && this.app.renderer) {
        const renderer = this.app.renderer as any
        
        // 检查旧版本的 interaction 插件
        if (renderer.plugins && renderer.plugins.interaction) {
          const manager = renderer.plugins.interaction
          if (typeof manager.on !== 'function') {
            if (typeof manager.addEventListener === 'function') {
              manager.on = manager.addEventListener.bind(manager)
            } else if (typeof manager.addListener === 'function') {
              manager.on = manager.addListener.bind(manager)
            }
            console.log('✅ InteractionManager on 方法修复完成')
          }
        }
        
        // 检查新版本的 events 系统
        if (renderer.events) {
          const events = renderer.events
          if (typeof events.on !== 'function') {
            if (typeof events.addEventListener === 'function') {
              events.on = events.addEventListener.bind(events)
            } else if (typeof events.addListener === 'function') {
              events.on = events.addListener.bind(events)
            }
            console.log('✅ EventSystem on 方法修复完成')
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ 应用全局 PixiJS 兼容性修复时出现错误:', error)
    }
  }

  /**
   * 强制修复 PixiJS BatchRenderer
   * 使用更激进的方法确保修复生效
   */
  private forceFixPixiJSBatchRenderer(): void {
    try {
      // 通过动态导入修复 BatchRenderer
      import('pixi.js').then(pixiModule => {
        if (pixiModule && (pixiModule as any).BatchRenderer) {
          this.applyBatchRendererFix((pixiModule as any).BatchRenderer)
          console.log('✅ 通过动态导入修复 BatchRenderer')
        }
      }).catch(() => {
        // 忽略错误
      })
    } catch (error) {
      // 忽略错误
    }

    // 方法3: 通过全局对象
    const globalPixi = (typeof window !== 'undefined' && (window as any).PIXI) || 
                      (typeof globalThis !== 'undefined' && (globalThis as any).PIXI)
    
    if (globalPixi && globalPixi.BatchRenderer) {
      this.applyBatchRendererFix(globalPixi.BatchRenderer)
      console.log('✅ 通过全局对象修复 BatchRenderer')
      return
    }

    // 方法4: 通过直接访问导入的 Application 类的内部引用
    try {
      // 尝试访问 Application 的静态属性或原型
      const ApplicationConstructor = Application as any
      if (ApplicationConstructor._plugins || ApplicationConstructor.prototype) {
        // 查找渲染器相关的引用
        const rendererPlugins = ApplicationConstructor._plugins
        if (rendererPlugins && rendererPlugins.batch) {
          this.applyBatchRendererFix(rendererPlugins.batch.constructor)
          console.log('✅ 通过Application插件修复 BatchRenderer')
          return
        }
      }
    } catch (error) {
      console.warn('⚠️ 通过Application插件访问失败:', error)
    }

    console.warn('⚠️ 无法找到 BatchRenderer，将在运行时修复')
  }

  /**
   * 应用 BatchRenderer 修复
   */
  private applyBatchRendererFix(BatchRenderer: any): void {
    if (!BatchRenderer || !BatchRenderer.prototype) {
      return
    }

    const checkMaxMethod = BatchRenderer.prototype.checkMaxIfStatementsInShader
    if (typeof checkMaxMethod !== 'function') {
      return
    }

    // 检查是否已经修复过
    if (checkMaxMethod._isFixed) {
      return
    }

    // 保存原始方法
    const originalMethod = checkMaxMethod
    
    // 应用修复
    BatchRenderer.prototype.checkMaxIfStatementsInShader = function(maxIfs: number) {
      // 强制修复：确保 maxIfs 是一个有效的正整数，最小值为 32
      let safeMaxIfs = 100 // 默认安全值
      
      if (typeof maxIfs === 'number' && maxIfs > 0) {
        safeMaxIfs = Math.max(maxIfs, 32)
      } else if (typeof maxIfs === 'number' && maxIfs <= 0) {
        // 特别处理 0 或负数的情况
        safeMaxIfs = 100
      }
      
      console.log(`🔧 BatchRenderer 强制修复: ${maxIfs} -> ${safeMaxIfs}`)
      return originalMethod.call(this, safeMaxIfs)
    }
    
    // 标记已修复，防止重复修复
    BatchRenderer.prototype.checkMaxIfStatementsInShader._isFixed = true
    
    console.log('✅ BatchRenderer.checkMaxIfStatementsInShader 修复完成')
  }

  constructor(canvas: HTMLCanvasElement) {
    // 预处理：修复 PixiJS 全局配置
    this.preFixPixiJSGlobalConfiguration()
    
    // 立即强制修复 BatchRenderer（在创建任何Application之前）
    this.forceFixPixiJSBatchRenderer()
    
    // 存储 canvas 引用
    this.canvas = canvas
    
    // 初始化管理器
    this.resourceManager = new Live2DResourceManager()
    
    // 更新循环绑定在 Application 的 ticker（在 init 中设置）
  }

  /**
   * 配置 PixiJS 全局设置
   */
  private async configurePixiJSSettings(): Promise<void> {
    try {
      // 动态导入 PixiJS 并配置 BatchRenderer
      const PIXI = await import('pixi.js')
      
      // 设置 BatchRenderer 默认配置
      if (PIXI.BatchRenderer) {
        // 确保 maxIfStatementsInShader 有一个安全的默认值
        const defaultConfig = {
          maxIfStatementsInShader: 100,
          maxTextures: 16
        }
        
        // 如果 BatchRenderer 有静态属性可以配置，设置它们
        if (typeof (PIXI.BatchRenderer as any).defaultMaxIfStatementsInShader !== 'undefined') {
          (PIXI.BatchRenderer as any).defaultMaxIfStatementsInShader = defaultConfig.maxIfStatementsInShader
        }
        
        console.log('✅ PixiJS BatchRenderer 全局配置完成')
      }
    } catch (error) {
      console.warn('⚠️ 配置 PixiJS 全局设置失败:', error)
    }
  }

  /**
   * 初始化方法
   */
  async init(): Promise<void> {
    // 在创建 Application 之前配置 PixiJS 设置
    await this.configurePixiJSSettings()
    // 尝试创建 Application，如果失败则应用修复后重试
    let appCreated = false
    let retryCount = 0
    const maxRetries = 3
    
    while (!appCreated && retryCount < maxRetries) {
      try {
        // 创建 PixiJS Application 实例 - 使用 PixiJS 7.x 构造函数语法
        this.app = new Application({
          view: this.canvas,
          width: this.canvas.width,
          height: this.canvas.height,
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          // 使用更保守的渲染器配置
          sharedTicker: false,
          // 使用 WebGL 但设置保守选项
          forceCanvas: false,
          // 设置渲染器选项
          powerPreference: 'default',
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          clearBeforeRender: true,
        } as any)
        
        appCreated = true
        console.log('✅ PixiJS Application 创建成功')
        // 确保渲染循环启动
        try {
          if ((this.app as any).start) {
            ;(this.app as any).start()
            console.log('✅ PixiJS Application 已启动')
            
            // 应用全局 PixiJS 兼容性修复
            this.applyGlobalPixiJSFixes()
          } else if ((this.app as any).ticker && (this.app as any).ticker.start) {
            ;(this.app as any).ticker.start()
            console.log('✅ PixiJS Ticker 已启动')
          }
        } catch (e) {
          console.warn('⚠️ 启动 PixiJS Application 时出现问题:', e)
        }
        
      } catch (error) {
        retryCount++
        console.error(`❌ PixiJS Application 创建失败 (尝试 ${retryCount}/${maxRetries}):`, error)
        
        if (retryCount < maxRetries) {
          // 在重试前应用更强的修复
          this.forceFixPixiJSBatchRenderer()
          console.log(`🔄 准备重试创建 Application...`)
        } else {
          throw new Error(`PixiJS Application 创建失败，已重试 ${maxRetries} 次: ${error}`)
        }
      }
    }

    // 修复 BatchRenderer 着色器配置问题
    this.fixShaderConfiguration()

    // 使用 Application 的 ticker 驱动更新循环
    if ((this.app as any).ticker) {
      this.app.ticker.add(this.update, this)
    }

    // 异步初始化Live2D Cubism SDK（不阻塞）
    this.initializeCubismSDK().catch(error => {
      console.error('Live2D Cubism SDK 初始化失败:', error)
    })
  }

  /**
   * 初始化Live2D Cubism SDK
   */
  private async initializeCubismSDK(): Promise<void> {
    try {
      console.log('🎯 开始初始化 Live2D Cubism SDK...')
      
      // 首先确保全局 Live2D 初始化完成
      await initializeLive2DCubismCore()
      
      // 确保 Cubism Core 运行时已加载
      await this.ensureCubismRuntime()

      // 等待 DOM 加载完成
      if (document.readyState !== 'complete') {
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve(void 0)
          } else {
            window.addEventListener('load', () => resolve(void 0), { once: true })
          }
        })
      }

      // 延迟加载以确保 Live2DCubismCore 完全初始化
      await new Promise(resolve => setTimeout(resolve, 200))

      // 检查 Cubism Core 是否可用并注册 Ticker
      const w = window as any
      if (!w.Live2DCubismCore) {
        throw new Error('Live2D Cubism Core 未正确加载')
      }
      
      // 注册 PIXI Ticker
      try {
        // 使用类型断言来避免 Ticker 类型冲突
        Live2DModel.registerTicker(Ticker as any)
        console.log('✅ Live2D Ticker 注册完成')
      } catch (error) {
        console.warn('⚠️ Live2D Ticker 注册失败:', error)
      }

      console.log('✅ Live2D Cubism4 SDK 已通过静态导入加载')

    } catch (error) {
      console.error('❌ Live2D Cubism SDK初始化失败:', error)
      throw new Live2DLoaderError(
        'Failed to initialize Live2D Cubism SDK',
        'SDK_INIT_ERROR',
        error
      )
    }
  }

  /**
   * 确保 Live2D Cubism Core 运行时已加载
   */
  private async ensureCubismRuntime(): Promise<void> {
    const anyWindow = window as unknown as { 
      Live2DCubismCore?: unknown
    }
    
    // 检查是否已加载 Live2DCubismCore（Cubism4）
    if (anyWindow.Live2DCubismCore) {
      console.log('Live2D 运行时已存在')
      return
    }

    // 如果在 HTML 中已经通过 script 标签加载，稍等片刻让它初始化
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (anyWindow.Live2DCubismCore) {
      console.log('Live2D 运行时加载完成')
      return
    }

    // 如果仍然没有，尝试动态加载
    const candidateUrls: string[] = []
    const configuredUrl: string | undefined = (import.meta as any)?.env?.VITE_LIVE2D_CUBISM_CORE_URL
    if (configuredUrl) candidateUrls.push(configuredUrl)

    // 常见本地路径（public 下会以根路径提供静态文件）
    candidateUrls.push(
      '/live2d/live2dcubismcore.min.js',
      '/live2d/live2dcubismcore.js',
      '/libs/live2d/live2dcubismcore.min.js',
      '/libs/live2d/live2dcubismcore.js'
    )

    let lastError: unknown = undefined
    for (const url of candidateUrls) {
      try {
        console.log(`尝试加载 Live2D 运行时: ${url}`)
        await this.loadExternalScript(url, 10000)
        
        // 加载后等待一段时间让运行时初始化
        await new Promise(resolve => setTimeout(resolve, 300))
        
        if (anyWindow.Live2DCubismCore) {
          console.log(`Live2D 运行时加载成功: ${url}`)
          return
        }
      } catch (err) {
        console.warn(`加载失败: ${url}`, err)
        lastError = err
      }
    }

    throw new Live2DLoaderError(
      'Could not find Live2D Cubism 4 runtime. Please ensure live2dcubismcore.min.js is available under public/live2d/ and loaded properly.',
      'CUBISM_CORE_NOT_FOUND',
      lastError
    )
  }

  /**
   * 加载外部脚本
   */
  private loadExternalScript(url: string, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load script: ${url}`))

      const timer = window.setTimeout(() => {
        script.remove()
        reject(new Error(`Timeout loading script: ${url}`))
      }, timeoutMs)

      script.addEventListener('load', () => window.clearTimeout(timer))
      document.head.appendChild(script)
    })
  }

  /**
   * 加载Live2D模型
   */
  async loadModel(
    config: Live2DModelConfig,
    renderConfig?: Partial<Live2DRenderConfig>
  ): Promise<Live2DModelInstance> {
    try {
      this.setLoadState(LoadState.LOADING)
      this.emit(LoaderEvent.LOAD_START, { config })

      // 检查是否已加载
      if (this.loadedModels.has(config.id)) {
        const existingModel = this.loadedModels.get(config.id)!
        this.setLoadState(LoadState.LOADED)
        return existingModel
      }

      // 合并渲染配置
      const finalRenderConfig: Live2DRenderConfig = {
        ...this.defaultRenderConfig,
        ...renderConfig,
      }

      // 开始加载进度追踪
      const progress: LoadProgress = {
        progress: 0,
        stage: '正在解析模型文件...',
        loadedFiles: 0,
        totalFiles: 1,
      }

      this.emit(LoaderEvent.LOAD_PROGRESS, progress)

      // 预加载模型配置文件
      progress.stage = '正在加载模型配置...'
      progress.progress = 0.1
      this.emit(LoaderEvent.LOAD_PROGRESS, progress)

      const modelConfig = await this.resourceManager.preloadResource(config.modelPath)
      
      // 计算总文件数
      const totalFiles = this.calculateTotalFiles(modelConfig)
      progress.totalFiles = totalFiles

      // 加载Live2D模型
      progress.stage = '正在加载Live2D模型...'
      progress.progress = 0.3
      this.emit(LoaderEvent.LOAD_PROGRESS, progress)

      console.log('🔧 开始加载 Live2D 模型:', config.modelPath)
      const model = await Live2DModel.from(config.modelPath, {
        onProgress: (progressValue: number) => {
          console.log('📊 模型加载进度:', progressValue)
          progress.progress = 0.3 + progressValue * 0.6
          progress.stage = '正在加载模型资源...'
          this.emit(LoaderEvent.LOAD_PROGRESS, progress)
        },
      } as any)
      console.log('✅ Live2D 模型加载成功:', model)

      // 应用渲染配置
      this.applyRenderConfig(model, finalRenderConfig)

      // 创建模型实例
      const modelInstance: Live2DModelInstance = {
        model,
        config,
        renderConfig: finalRenderConfig,
        loadTime: Date.now(),
        isReady: false,
        usageCount: 0,
        lastUsedTime: Date.now(),
        stats: {
          totalMotionsPlayed: 0,
          totalExpressionsSet: 0,
          averageFPS: 60,
          memoryUsage: this.estimateModelMemoryUsage(model)
        }
      }

      // 等待模型完全就绪
      progress.stage = '正在初始化模型...'
      progress.progress = 0.9
      this.emit(LoaderEvent.LOAD_PROGRESS, progress)

      await this.setupModel(modelInstance)

      // 添加到舞台
      this.app.stage.addChild(model as any)

      // 缓存模型
      this.loadedModels.set(config.id, modelInstance)
      this.currentModel = modelInstance

      // 标记为就绪
      modelInstance.isReady = true
      progress.progress = 1.0
      progress.stage = '模型加载完成'
      this.emit(LoaderEvent.LOAD_PROGRESS, progress)
      this.emit(LoaderEvent.LOAD_COMPLETE, modelInstance)
      this.emit(LoaderEvent.MODEL_READY, modelInstance)

      this.setLoadState(LoadState.LOADED)
      return modelInstance

    } catch (error) {
      console.error('❌ Live2D 模型加载失败:', error)
      console.error('❌ 模型配置:', config)
      console.error('❌ 错误详情:', error instanceof Error ? error.message : error)
      this.setLoadState(LoadState.ERROR)
      const loaderError = new Live2DLoaderError(
        `Failed to load Live2D model: ${config.name}`,
        'MODEL_LOAD_ERROR',
        error
      )
      this.emit(LoaderEvent.LOAD_ERROR, loaderError)
      throw loaderError
    }
  }

  /**
   * 计算模型总文件数
   */
  private calculateTotalFiles(modelConfig: any): number {
    let count = 1 // model.json文件本身

    if (modelConfig.FileReferences) {
      // .moc3文件
      if (modelConfig.FileReferences.Moc) count++
      
      // 纹理文件
      if (modelConfig.FileReferences.Textures) {
        count += modelConfig.FileReferences.Textures.length
      }
      
      // 物理文件
      if (modelConfig.FileReferences.Physics) count++
      
      // 显示信息文件
      if (modelConfig.FileReferences.DisplayInfo) count++
      
      // 表情文件
      if (modelConfig.FileReferences.Expressions) {
        count += modelConfig.FileReferences.Expressions.length
      }
      
      // 动作文件
      if (modelConfig.FileReferences.Motions) {
        Object.values(modelConfig.FileReferences.Motions).forEach((motions: any) => {
          if (Array.isArray(motions)) {
            count += motions.length
          }
        })
      }
    }

    return count
  }

  /**
   * 应用渲染配置到模型
   */
  private applyRenderConfig(model: Live2DModel, renderConfig: Live2DRenderConfig): void {
    // 设置锚点，默认居中
    if ((model as any).anchor && typeof (model as any).anchor.set === 'function') {
      ;(model as any).anchor.set(0.5, 0.5)
    }

    // 设置缩放 - 如果配置的缩放为1.0，则自动计算最佳缩放
    let finalScale = renderConfig.scale
    if (renderConfig.scale === 1.0 && this.app && this.app.renderer) {
      const rendererAny = this.app.renderer as any
      finalScale = this.calculateOptimalScale(model, rendererAny.width, rendererAny.height)
    }
    model.scale.set(finalScale)
    console.log(`🎯 应用模型缩放: ${finalScale.toFixed(3)}`)
    
    // 设置位置（若为 0,0 则默认居中到画布）
    let targetX = renderConfig.position.x
    let targetY = renderConfig.position.y
    if (targetX === 0 && targetY === 0 && this.app && this.app.renderer) {
      const rendererAny = this.app.renderer as any
      targetX = rendererAny.width / 2
      targetY = rendererAny.height / 2
    }
    model.position.set(targetX, targetY)
    
    // 设置透明度
    model.alpha = renderConfig.opacity

    // 配置内部模型设置
    try {
      if ((model as any).internalModel) {
        console.log('🔧 配置内部模型设置:', (model as any).internalModel)
        
        // 眨眼设置 - 检查不同的 API 方式
        const eyeBlink = (model as any).internalModel.eyeBlink || (model as any).internalModel.eyeBlinkController
        if (eyeBlink) {
          if (typeof eyeBlink.setEnable === 'function') {
            eyeBlink.setEnable(renderConfig.enableEyeBlink)
          } else if (typeof eyeBlink.setBlinkingInterval === 'function') {
            // 新版本 API
            eyeBlink.setBlinkingInterval(renderConfig.enableEyeBlink ? 4.0 : 0)
          }
          console.log('✅ 眨眼设置已配置:', renderConfig.enableEyeBlink)
        }

        // 呼吸设置
        const breath = (model as any).internalModel.breath || (model as any).internalModel.breathController
        if (breath) {
          if (typeof breath.setEnable === 'function') {
            breath.setEnable(renderConfig.enableBreathing)
          } else if (typeof breath.setBreathParameters === 'function') {
            // 新版本 API
            breath.setBreathParameters(renderConfig.enableBreathing ? 1.0 : 0, renderConfig.enableBreathing ? 1.0 : 0)
          }
          console.log('✅ 呼吸设置已配置:', renderConfig.enableBreathing)
        }

        // 物理效果设置
        const physics = (model as any).internalModel.physics || (model as any).internalModel.physicsController
        if (physics) {
          if (typeof physics.setEnable === 'function') {
            physics.setEnable(renderConfig.enablePhysics)
          }
          console.log('✅ 物理效果设置已配置:', renderConfig.enablePhysics)
        }

        // 设置动作和表情淡入淡出时间
        const motionManager = (model as any).internalModel.motionManager
        if (motionManager) {
          if (typeof motionManager.setFadeInTime === 'function') {
            motionManager.setFadeInTime(renderConfig.motionFadeDuration / 1000)
            motionManager.setFadeOutTime(renderConfig.motionFadeDuration / 1000)
          }
          console.log('✅ 动作淡入淡出时间已配置:', renderConfig.motionFadeDuration)
        }

        // 设置表情淡入淡出时间
        const expressionManager = (model as any).internalModel.expressionManager
        if (expressionManager) {
          if (typeof expressionManager.setFadeInTime === 'function') {
            expressionManager.setFadeInTime(renderConfig.expressionFadeDuration / 1000)
            expressionManager.setFadeOutTime(renderConfig.expressionFadeDuration / 1000)
          }
          console.log('✅ 表情淡入淡出时间已配置:', renderConfig.expressionFadeDuration)
        }
      }
    } catch (error) {
      console.warn('⚠️ 配置内部模型设置时出现错误，但继续加载:', error)
    }

    // 修复交互性兼容性问题
    try {
      // 确保模型具有 isInteractive 方法
      if (typeof (model as any).isInteractive !== 'function') {
        (model as any).isInteractive = function() {
          return this.interactive !== false
        }
      }
      
      // 确保模型具有正确的事件管理器
      if (!(model as any).eventMode && (model as any).interactive !== false) {
        (model as any).eventMode = 'static'
      }
      
      console.log('✅ 模型交互性兼容性修复完成')
      
      // 运行时修复交互管理器
      this.fixLive2DInteractionManager(model)
      
    } catch (error) {
      console.warn('⚠️ 修复模型交互性时出现错误:', error)
    }
  }

  /**
   * 设置模型
   */
  private async setupModel(modelInstance: Live2DModelInstance): Promise<void> {
    const { model } = modelInstance

    // 兼容性检查：确保事件系统正常工作
    try {
      // 设置模型事件监听
      if (typeof model.on === 'function') {
        model.on('motionStart', (group: string, index: number) => {
          modelInstance.currentMotion = `${group}_${index}`
          this.emit(LoaderEvent.MOTION_START, { group, index, model: modelInstance })
        })

        model.on('motionFinish', () => {
          modelInstance.currentMotion = undefined
          this.emit(LoaderEvent.MOTION_COMPLETE, { model: modelInstance })
        })

        // 设置点击事件
        model.on('hit', (hitAreas: string[]) => {
          this.handleModelHit(modelInstance, hitAreas)
        })
      } else {
        console.warn('⚠️ 模型不支持事件监听，跳过事件设置')
      }
    } catch (error) {
      console.warn('⚠️ 设置模型事件监听时出现错误:', error)
    }

    // 预加载默认动作和表情
    await this.preloadDefaultAnimations(modelInstance)
  }

  /**
   * 预加载默认动画
   */
  private async preloadDefaultAnimations(modelInstance: Live2DModelInstance): Promise<void> {
    const { model } = modelInstance

    try {
      // 预加载空闲动作
      if ((model.internalModel.motionManager as any).getMotionGroupNames?.().includes('Idle')) {
        await model.motion('Idle', 0, 2) // 预加载但设置低优先级
      }

      // 预加载默认表情
      if ((model.internalModel as any).expressionManager && 
          (model.internalModel as any).expressionManager.expressions.length > 0) {
        await model.expression(0)
      }
    } catch (error) {
      console.warn('预加载动画失败:', error)
    }
  }

  /**
   * 处理模型点击事件
   */
  private handleModelHit(modelInstance: Live2DModelInstance, hitAreas: string[]): void {
    console.log('模型被点击:', hitAreas)
    
    // 根据点击区域播放相应动画
    if (hitAreas.includes('Head')) {
      this.playRandomMotion(modelInstance, 'TapHead')
    } else if (hitAreas.includes('Body')) {
      this.playRandomMotion(modelInstance, 'TapBody')
    } else {
      this.playRandomMotion(modelInstance, 'Tap')
    }
  }

  /**
   * 估算模型内存使用量
   */
  private estimateModelMemoryUsage(model: Live2DModel): number {
    try {
      // 基础内存估算
      let memoryUsage = 0
      
      // 估算纹理内存（最大的内存占用）
      if ((model as any).textures) {
        for (const texture of (model as any).textures) {
          memoryUsage += texture.width * texture.height * 4 // RGBA
        }
      }
      
      // 估算模型数据内存
      memoryUsage += 1024 * 1024 // 基础1MB
      
      // 估算动作和表情数据内存
      if ((model as any).internalModel) {
        const internalModel = (model as any).internalModel
        
        // 动作数据
        if (internalModel.motionManager) {
          const motionCount = (internalModel.motionManager as any).getMotionGroupNames?.()
            ?.reduce((total: number, group: string) => 
              total + (internalModel.motionManager as any).getMotionCount?.(group) || 0, 0) || 0
          memoryUsage += motionCount * 50 * 1024 // 每个动作约50KB
        }
        
        // 表情数据  
        if (internalModel.expressionManager?.expressions) {
          memoryUsage += internalModel.expressionManager.expressions.length * 10 * 1024 // 每个表情约10KB
        }
      }
      
      return memoryUsage
    } catch (error) {
      console.warn('内存使用估算失败:', error)
      return 10 * 1024 * 1024 // 默认10MB
    }
  }

  /**
   * 更新模型统计信息
   */
  private updateModelStats(modelInstance: Live2DModelInstance): void {
    if (!modelInstance.isReady) return
    
    // 更新使用次数和时间
    modelInstance.usageCount++
    modelInstance.lastUsedTime = Date.now()
    
    // 更新FPS（简化版）
    const currentFPS = Ticker.shared.FPS || 60
    modelInstance.stats.averageFPS = 
      (modelInstance.stats.averageFPS * 0.9) + (currentFPS * 0.1)
  }

  /**
   * 播放随机动作
   */
  async playRandomMotion(
    modelInstance: Live2DModelInstance,
    group?: string
  ): Promise<void> {
    try {
      const { model } = modelInstance
      const motionGroups = (model.internalModel.motionManager as any).getMotionGroupNames?.() || []
      
      if (motionGroups.length === 0) return

      // 选择动作组
      const targetGroup = group && motionGroups.includes(group) 
        ? group 
        : motionGroups[Math.floor(Math.random() * motionGroups.length)]

      // 播放动作
      await model.motion(targetGroup, Math.floor(Math.random() * 
        (model.internalModel.motionManager as any).getMotionCount?.(targetGroup) || 0))

      // 更新统计信息
      modelInstance.stats.totalMotionsPlayed++
      this.updateModelStats(modelInstance)

    } catch (error) {
      console.error('播放动作失败:', error)
    }
  }

  /**
   * 播放指定动作
   */
  async playMotion(
    modelInstance: Live2DModelInstance,
    group: string,
    index?: number,
    priority?: number
  ): Promise<void> {
    try {
      const { model } = modelInstance
      const motionIndex = index ?? Math.floor(Math.random() * 
        (model.internalModel.motionManager as any).getMotionCount?.(group) || 0)
      
      await model.motion(group, motionIndex, priority)
      
      // 更新统计信息
      modelInstance.stats.totalMotionsPlayed++
      this.updateModelStats(modelInstance)
    } catch (error) {
      console.error('播放动作失败:', error)
      throw new Live2DLoaderError(
        `Failed to play motion: ${group}[${index}]`,
        'MOTION_PLAY_ERROR',
        error
      )
    }
  }

  /**
   * 设置表情
   */
  async setExpression(
    modelInstance: Live2DModelInstance,
    expressionIndex: number
  ): Promise<void> {
    try {
      const { model } = modelInstance
      await model.expression(expressionIndex)
      modelInstance.currentExpression = `expression_${expressionIndex}`
      
      // 更新统计信息
      modelInstance.stats.totalExpressionsSet++
      this.updateModelStats(modelInstance)
      
      this.emit(LoaderEvent.EXPRESSION_START, { 
        expressionIndex, 
        model: modelInstance 
      })
    } catch (error) {
      console.error('设置表情失败:', error)
      throw new Live2DLoaderError(
        `Failed to set expression: ${expressionIndex}`,
        'EXPRESSION_SET_ERROR',
        error
      )
    }
  }

  /**
   * 卸载模型
   */
  unloadModel(modelId: string): void {
    const modelInstance = this.loadedModels.get(modelId)
    if (!modelInstance) return

    try {
      // 从舞台移除
      this.app.stage.removeChild(modelInstance.model as any)
      
      // 销毁模型
      modelInstance.model.destroy()
      
      // 从缓存中移除
      this.loadedModels.delete(modelId)
      
      // 如果是当前模型，清空引用
      if (this.currentModel?.config.id === modelId) {
        this.currentModel = null
      }

      console.log(`模型 ${modelId} 已卸载`)
    } catch (error) {
      console.error('卸载模型失败:', error)
    }
  }

  /**
   * 切换到指定模型
   */
  async switchToModel(modelId: string): Promise<Live2DModelInstance> {
    const modelInstance = this.loadedModels.get(modelId)
    if (!modelInstance) {
      throw new Live2DLoaderError(
        `Model not found: ${modelId}`,
        'MODEL_NOT_FOUND'
      )
    }

    // 隐藏当前模型
    if (this.currentModel && this.currentModel.config.id !== modelId) {
      this.currentModel.model.visible = false
    }

    // 显示目标模型
    modelInstance.model.visible = true
    this.currentModel = modelInstance

    return modelInstance
  }

  /**
   * 更新渲染配置
   */
  updateRenderConfig(
    modelId: string,
    config: Partial<Live2DRenderConfig>
  ): void {
    const modelInstance = this.loadedModels.get(modelId)
    if (!modelInstance) return

    // 更新配置
    Object.assign(modelInstance.renderConfig, config)
    
    // 应用到模型
    this.applyRenderConfig(modelInstance.model, modelInstance.renderConfig)
  }

  /**
   * 获取模型信息
   */
  getModelInfo(modelId: string): Live2DModelInstance | null {
    return this.loadedModels.get(modelId) || null
  }

  /**
   * 获取所有已加载的模型
   */
  getAllLoadedModels(): Live2DModelInstance[] {
    return Array.from(this.loadedModels.values())
  }

  /**
   * 获取当前模型
   */
  getCurrentModel(): Live2DModelInstance | null {
    return this.currentModel
  }

  /**
   * 获取加载状态
   */
  getLoadState(): LoadState {
    return this.loadState
  }

  /**
   * 修复 PixiJS 着色器配置问题
   */
  private fixShaderConfiguration(): void {
    try {
      // 检查渲染器是否存在
      if (!this.app.renderer) {
        console.warn('⚠️ PixiJS 渲染器未初始化')
        return
      }

      // 使用类型断言来访问 WebGL 渲染器的属性
      const renderer = this.app.renderer as any

      // 获取 WebGL 上下文
      const gl = renderer.gl
      if (!gl) {
        console.warn('⚠️ WebGL 上下文未找到')
        return
      }

      // 检查 WebGL 参数
      const maxFragmentUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)
      const maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)
      
      console.log(`🔧 WebGL 参数: MAX_FRAGMENT_UNIFORM_VECTORS=${maxFragmentUniforms}, MAX_VERTEX_UNIFORM_VECTORS=${maxVertexUniforms}`)

      // 修复 BatchRenderer 配置
      if (renderer.batch) {
        const batchRenderer = renderer.batch
        
        // 如果 maxIfStatementsInShader 为 0 或无效值，设置一个安全的默认值
        if (!batchRenderer.maxIfStatementsInShader || batchRenderer.maxIfStatementsInShader <= 0) {
          // 基于 WebGL 参数计算安全的最大值
          const safeMaxIfStatements = Math.min(100, Math.floor(maxFragmentUniforms / 4))
          batchRenderer.maxIfStatementsInShader = Math.max(safeMaxIfStatements, 32)
          console.log(`🔧 修复 BatchRenderer maxIfStatementsInShader: ${batchRenderer.maxIfStatementsInShader}`)
        }
      }

      console.log('✅ PixiJS 着色器配置修复完成')
    } catch (error) {
      console.error('❌ 修复着色器配置时出错:', error)
    }
  }

  /**
   * 清理所有模型
   */
  cleanup(): void {
    // 卸载所有模型
    for (const modelId of this.loadedModels.keys()) {
      this.unloadModel(modelId)
    }

    // 清理资源缓存
    this.resourceManager.clearCache()

    // 解绑 Application 的 ticker 回调
    if (this.app && (this.app as any).ticker) {
      this.app.ticker.remove(this.update, this)
    }

    // 销毁PixiJS应用
    this.app.destroy(true)

    console.log('Live2D加载器已清理')
  }

  /**
   * 添加事件监听器
   */
  on(event: LoaderEvent, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: LoaderEvent, listener: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * 触发事件
   */
  private emit(event: LoaderEvent, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          console.error('事件监听器执行失败:', error)
        }
      })
    }
  }

  /**
   * 设置加载状态
   */
  private setLoadState(state: LoadState): void {
    this.loadState = state
  }

  /**
   * 更新循环
   */
  private update(): void {
    // 更新当前模型
    if (this.currentModel?.model && this.currentModel.isReady) {
      const deltaMs = (this.app && (this.app as any).ticker) ? (this.app as any).ticker.deltaMS : Ticker.shared.deltaMS
      this.currentModel.model.update(deltaMs)
    }
  }
}

/**
 * 创建Live2D模型加载器实例
 */
export async function createLive2DLoader(canvas: HTMLCanvasElement): Promise<Live2DModelLoader> {
  const loader = new Live2DModelLoader(canvas)
  await loader.init()
  return loader
}

/**
 * 默认导出
 */
export default Live2DModelLoader
