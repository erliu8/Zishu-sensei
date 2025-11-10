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
    /** 用户是否手动调整过位置 */
    userAdjustedPosition?: boolean
    /** 用户是否手动调整过缩放 */
    userAdjustedScale?: boolean
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
  // Static flags to avoid writing on ESM namespaces or frozen objects
  private static hasLoggedDynFix = false
  private static hasLoggedGlobalFix = false
  private static hasLoggedGlobalBatchConfig = false
  private loadedModels = new Map<string, Live2DModelInstance>()
  private currentModel: Live2DModelInstance | null = null
  private currentModelPath: string | null = null
  private loadState: LoadState = LoadState.IDLE
  private eventListeners = new Map<string, Set<Function>>()
  private contextRecoverySetup = false
  // 兼容旧字段（不再使用）
  // @ts-expect-error kept for backward compatibility but intentionally unused
  private readonly _deprecatedTickerField: null = null
  private canvas: HTMLCanvasElement
  private isWebGLContextLost = false
  // Recovery/cleanup guards to avoid re-entrancy and race conditions during HMR
  private isCleanupInProgress: boolean = false
  private isRecreationInProgress: boolean = false
  private isDestroyed: boolean = false
  private staticDebugOptions = {
    enableForceCleanupBeforeInit: false
  }
  private originalCanvasGetContext: typeof HTMLCanvasElement.prototype.getContext | null = null
  private webglContextPatched = false
  private sharedGLContext: (WebGLRenderingContext | WebGL2RenderingContext) | null = null
  private hasLoggedLooseRetry: boolean = false

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
          // 绑定共享上下文的预配置（如可用）
          try {
            if (this.sharedGLContext && (pixiModule as any).Renderer) {
              const proto = (pixiModule as any).Renderer.prototype
              const originalContextSystem = proto?.context
              if (originalContextSystem && !originalContextSystem._sharedPatched) {
                const originalInit = originalContextSystem.init
                if (typeof originalInit === 'function') {
                  originalContextSystem.init = function(...args: any[]) {
                    try {
                      if (this.renderer && this.renderer.options && (this.renderer.options as any).context) {
                        this.gl = (this.renderer.options as any).context
                      }
                    } catch {}
                    return originalInit.apply(this, args)
                  }
                  originalContextSystem._sharedPatched = true
                }
              }
            }
          } catch {}
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
      
      // 限制缩放范围 - 提高最小缩放值确保模型可见
      const finalScale = Math.max(0.3, Math.min(2.0, optimalScale))
      
      console.log(`📏 缩放计算详情:`)
      console.log(`   - 模型尺寸: ${modelWidth.toFixed(1)} x ${modelHeight.toFixed(1)}`)
      console.log(`   - 画布尺寸: ${canvasWidth} x ${canvasHeight}`)
      console.log(`   - 原始缩放: scaleX=${scaleX.toFixed(3)}, scaleY=${scaleY.toFixed(3)}`)
      console.log(`   - 最优缩放: ${optimalScale.toFixed(3)}`)
      console.log(`   - 最终缩放: ${finalScale.toFixed(3)}`)
      console.log(`   - 缩放后模型尺寸: ${(modelWidth * finalScale).toFixed(1)} x ${(modelHeight * finalScale).toFixed(1)}`)
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
    console.log('🔧 [DEBUG] 开始修复Live2D交互管理器...')
    
    try {
      if (!model || !this.app || !this.app.renderer) {
        console.log('❌ [DEBUG] 修复交互管理器失败 - 缺少必要对象:', {
          hasModel: !!model,
          hasApp: !!this.app,
          hasRenderer: !!(this.app && this.app.renderer)
        })
        return
      }
      
      const renderer = this.app.renderer as any
      console.log('🔧 [DEBUG] 渲染器状态:', {
        hasRenderer: !!renderer,
        hasPlugins: !!(renderer.plugins),
        hasInteraction: !!(renderer.plugins && renderer.plugins.interaction),
        hasEvents: !!(renderer.events),
        contextId: renderer.gl ? renderer.gl.id : 'no-gl'
      })
      
      // 修复 interaction 插件的 on 方法
      if (renderer.plugins && renderer.plugins.interaction) {
        const manager = renderer.plugins.interaction
        console.log('🔧 [DEBUG] InteractionManager 状态:', {
          hasOn: typeof manager.on === 'function',
          hasAddListener: typeof manager.addListener === 'function',
          hasAddEventListener: typeof manager.addEventListener === 'function',
          managerType: manager.constructor.name
        })
        
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
        } else {
          console.log('✅ [DEBUG] InteractionManager.on 方法已存在')
        }
      } else {
        console.log('⚠️ [DEBUG] 未找到InteractionManager插件，检查EventSystem...')
        
        // PixiJS 7.x 使用 EventSystem 替代 InteractionManager
        if (renderer.events) {
          const eventSystem = renderer.events
          console.log('🔧 [DEBUG] EventSystem 状态:', {
            hasOn: typeof eventSystem.on === 'function',
            hasAddListener: typeof eventSystem.addListener === 'function',
            hasAddEventListener: typeof eventSystem.addEventListener === 'function',
            eventSystemType: eventSystem.constructor.name
          })
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
      
      // 2. 尝试动态导入（浏览器友好，无 require）
      if (!PIXI) {
        try {
          // 注意：这里是同步函数环境，无法直接 await；仅记录提示，真正的全局修复依赖 init 流程中的其他路径
          // 在 init 流程中我们已通过 configurePixiJSSettings/forceFixPixiJSBatchRenderer 进行动态导入
          console.warn('ℹ️ 运行时未发现全局 PIXI，将依赖初始化流程中的动态导入修复')
        } catch (e) {
          console.warn('⚠️ 无法尝试动态导入 PIXI:', e)
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
   * 应用紧急WebGL兼容性修复
   */
  private applyEmergencyWebGLFixes(): void {
    try {
      // 1. 添加全局WebGL方法polyfill
      this.addGlobalWebGLPolyfill()
      
      // 2. 全局修复WebGL上下文获取
      this.patchWebGLContextCreation()
      
      // 3. 强制修复所有可能的BatchRenderer实例
      this.forceFixAllBatchRenderers()
      
      // 4. 设置PixiJS全局降级选项
      this.setupPixiJSFallbacks()
      
      console.log('✅ 紧急WebGL兼容性修复完成')
    } catch (error) {
      console.warn('⚠️ 紧急WebGL兼容性修复失败:', error)
    }
  }

  /**
   * 添加全局WebGL方法polyfill
   */
  private addGlobalWebGLPolyfill(): void {
    // 确保WebGL2RenderingContext原型上有所有必需的方法
    if (typeof WebGL2RenderingContext !== 'undefined') {
      const proto = WebGL2RenderingContext.prototype
      
      // 修复getInternalformatParameter
      if (!proto.getInternalformatParameter) {
        console.log('🔧 [POLYFILL] 添加WebGL2RenderingContext.prototype.getInternalformatParameter')
        proto.getInternalformatParameter = function(target: GLenum, internalformat: GLenum, pname: GLenum): any {
          console.warn(`🔧 [POLYFILL] getInternalformatParameter调用: target=${target}, internalformat=${internalformat}, pname=${pname}`)
          
          // 处理常见的查询
          if (pname === this.SAMPLES) {
            return new Int32Array([0]) // 不支持多重采样
          }
          if (pname === 0x9293) { // GL_NUM_SAMPLE_COUNTS
            return new Int32Array([1]) // 只有一个采样数
          }
          if (pname === this.RENDERBUFFER_SAMPLES) {
            return new Int32Array([0]) // 渲染缓冲区采样数
          }
          
          // 默认返回安全值
          return new Int32Array([1])
        }
      }
      
      // 修复其他可能缺失的WebGL2方法
      const webgl2Methods = [
        'texStorage2D', 'texStorage3D', 'texImage3D', 'texSubImage3D',
        'copyTexSubImage3D', 'compressedTexImage3D', 'compressedTexSubImage3D',
        'getBufferSubData', 'copyBufferSubData', 'blitFramebuffer',
        'framebufferTextureLayer', 'invalidateFramebuffer', 'invalidateSubFramebuffer',
        'readBuffer', 'renderbufferStorageMultisample'
      ]
      
      webgl2Methods.forEach(methodName => {
        if (!(proto as any)[methodName]) {
          console.log(`🔧 [POLYFILL] 添加WebGL2RenderingContext.prototype.${methodName}`)
          ;(proto as any)[methodName] = function(..._args: any[]) {
            console.warn(`🔧 [POLYFILL] ${methodName}调用被忽略 (方法不存在)`)
            return null
          }
        }
      })
      
      console.log('✅ [POLYFILL] WebGL2RenderingContext原型修复完成')
      
      // 验证修复是否成功
      this.verifyWebGLPolyfill()
    }
    // 为 WebGL1 提供降级的 getInternalformatParameter 原型方法，避免引擎在检测时崩溃
    if (typeof WebGLRenderingContext !== 'undefined') {
      const proto1 = WebGLRenderingContext.prototype as any
      if (typeof proto1.getInternalformatParameter !== 'function') {
        console.log('🔧 [POLYFILL] 添加WebGLRenderingContext.prototype.getInternalformatParameter')
        proto1.getInternalformatParameter = function(target: number, internalformat: number, pname: number): any {
          console.warn(`🔧 [POLYFILL] (WebGL1) getInternalformatParameter降级调用: target=${target}, internalformat=${internalformat}, pname=${pname}`)
          // 在 WebGL1 中统一返回保守值，避免触发对 MSAA 的依赖
          if (pname === this.SAMPLES || pname === this.RENDERBUFFER_SAMPLES) {
            return new Int32Array([0])
          }
          if (pname === 0x9293) { // GL_NUM_SAMPLE_COUNTS
            return new Int32Array([1])
          }
          return new Int32Array([1])
        }
      }
    }
  }

  /**
   * 验证WebGL polyfill是否正确安装
   */
  private verifyWebGLPolyfill(): void {
    try {
      // 创建一个测试canvas来验证polyfill
      const testCanvas = document.createElement('canvas')
      testCanvas.width = 1
      testCanvas.height = 1
      
      const gl = testCanvas.getContext('webgl2') as WebGL2RenderingContext
      if (gl) {
        const hasMethod = typeof gl.getInternalformatParameter === 'function'
        console.log(`🔍 [POLYFILL] WebGL2 getInternalformatParameter验证: ${hasMethod ? '✅ 成功' : '❌ 失败'}`)
        
        if (hasMethod) {
          // 测试调用
          try {
            const result = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA8, gl.SAMPLES)
            console.log('🔍 [POLYFILL] getInternalformatParameter测试调用成功:', result)
          } catch (error) {
            console.warn('⚠️ [POLYFILL] getInternalformatParameter测试调用失败:', error)
          }
        }
      } else {
        console.log('🔍 [POLYFILL] WebGL2上下文不可用，跳过验证')
      }
    } catch (error) {
      console.warn('⚠️ [POLYFILL] WebGL polyfill验证失败:', error)
    }
  }

  /**
   * 修复WebGL上下文创建
   */
  private patchWebGLContextCreation(): void {
    if (this.webglContextPatched) return
    if (!this.originalCanvasGetContext) {
      this.originalCanvasGetContext = HTMLCanvasElement.prototype.getContext
    }
    const originalGetContext = this.originalCanvasGetContext
    const self = this // 保存对当前实例的引用
    
    // 使用类型断言来绕过TypeScript类型检查
    ;(HTMLCanvasElement.prototype as any).getContext = function(contextType: string, contextAttributes?: any) {
      if (contextType === 'webgl' || contextType === 'webgl2') {
        // 使用更安全的WebGL上下文属性
        const safeAttributes = {
          alpha: true,
          antialias: false, // 关闭抗锯齿以提高兼容性
          depth: true,
          failIfMajorPerformanceCaveat: false,
          powerPreference: 'default' as WebGLPowerPreference,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          stencil: true,
          ...contextAttributes
        }
        
        // 🔧 [CRITICAL FIX] 不要返回预先创建的共享上下文
        // 让PixiJS自己创建上下文，这样可以确保DrawingBuffer尺寸正确
        // if ((contextType === 'webgl' || contextType === 'webgl2') && self.sharedGLContext) {
        //   if (this === self.canvas) {
        //     return self.patchWebGLContext(self.sharedGLContext)
        //   }
        // }

        // 🔧 [STABLE FIX] 如果Canvas已经有上下文，直接使用它
        const existingContext = (this as any).__currentWebGLContext
        if (existingContext) {
          const ctx = originalGetContext.call(this, existingContext, safeAttributes)
          if (ctx && (ctx instanceof WebGLRenderingContext || ctx instanceof WebGL2RenderingContext)) {
            return self.patchWebGLContext(ctx)
          }
        }
        
        let context = originalGetContext.call(this, contextType, safeAttributes)
        
        // 记录当前上下文类型
        if (context) {
          (this as any).__currentWebGLContext = contextType
        }
        
        // 修复WebGL上下文兼容性问题
        if (context && (context instanceof WebGLRenderingContext || context instanceof WebGL2RenderingContext)) {
          context = self.patchWebGLContext(context)
        }
        
        // 如果获取WebGL上下文失败，尝试降级选项
        if (!context && contextType === 'webgl2') {
          console.warn('🔄 [DEBUG] WebGL2获取失败，降级到WebGL1')
          // 尝试多种WebGL1配置
          const webgl1Configs = [
            safeAttributes,
            { ...safeAttributes, antialias: false },
            { ...safeAttributes, antialias: false, alpha: false },
            { alpha: false, antialias: false, depth: true, stencil: true, premultipliedAlpha: true, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false }
          ]
          
          for (const config of webgl1Configs) {
            try {
              context = originalGetContext.call(this, 'webgl', config)
              if (context) {
                console.log('✅ [DEBUG] WebGL1降级成功，配置:', config)
                break
              }
            } catch (error) {
              console.warn('⚠️ [DEBUG] WebGL1配置失败:', config, error)
            }
          }
          
          if (context && (context instanceof WebGLRenderingContext || context instanceof WebGL2RenderingContext)) {
            context = self.patchWebGLContext(context)
          }
        }
        
        // 如果仍然没有上下文，尝试有限次数的更宽松属性，避免日志泛滥
        if (!context && (contextType === 'webgl2' || contextType === 'webgl')) {
          const maxLooseRetries = 2
          for (let i = 0; i < maxLooseRetries && !context; i++) {
            if (!self.hasLoggedLooseRetry) {
              console.warn('🔄 [DEBUG] 使用更宽松的WebGL属性重试')
              self.hasLoggedLooseRetry = true
            }
            const fallbackAttributes = {
              alpha: i === 0,
              antialias: false,
              depth: true,
              stencil: true,
              premultipliedAlpha: true,
              preserveDrawingBuffer: false,
              failIfMajorPerformanceCaveat: false,
              powerPreference: 'default'
            }
            context = originalGetContext.call(this, contextType === 'webgl2' ? 'webgl' : contextType, fallbackAttributes)
          }
          if (context && (context instanceof WebGLRenderingContext || context instanceof WebGL2RenderingContext)) {
            context = self.patchWebGLContext(context)
          }
        }
        
        return context
      }
      
      return originalGetContext.call(this, contextType, contextAttributes)
    }
    this.webglContextPatched = true
  }

  /**
   * 修复WebGL上下文的兼容性问题
   */
  private patchWebGLContext(gl: WebGLRenderingContext | WebGL2RenderingContext): WebGLRenderingContext | WebGL2RenderingContext {
    try {
      console.log('🔧 [DEBUG] 开始修复WebGL上下文:', {
        isWebGL2: gl instanceof WebGL2RenderingContext,
        hasGetInternalformatParameter: !!(gl as any).getInternalformatParameter,
        contextType: gl.constructor.name,
        version: gl.getParameter(gl.VERSION),
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER)
      })

      // 绑定为共享上下文，确保全局一致
      if (!this.sharedGLContext) {
        this.sharedGLContext = gl
      }

      // 为所有上下文（包括 WebGL1）提供通用的 getInternalformatParameter 降级实现
      if (!(gl instanceof WebGL2RenderingContext) && typeof (gl as any).getInternalformatParameter !== 'function') {
        (gl as any).getInternalformatParameter = function(target: number, internalformat: number, pname: number) {
          console.warn(`🔧 [DEBUG] (通用) getInternalformatParameter降级处理: target=${target}, internalformat=${internalformat}, pname=${pname}`)
          if (pname === (gl as any).SAMPLES || pname === (gl as any).RENDERBUFFER_SAMPLES) {
            return new Int32Array([0])
          }
          if (pname === 0x9293) { // GL_NUM_SAMPLE_COUNTS
            return new Int32Array([1])
          }
          return new Int32Array([1])
        }
        console.log('✅ [DEBUG] 注入通用 getInternalformatParameter 降级实现')
      }

      // 🔧 [CRITICAL FIX] 为 WebGL1 添加 Vertex Array Object 支持
      if (!(gl instanceof WebGL2RenderingContext)) {
        // 尝试使用 OES_vertex_array_object 扩展
        const vaoExt = gl.getExtension('OES_vertex_array_object')
        
        if (vaoExt) {
          // 如果扩展可用，使用扩展的方法
          if (typeof (gl as any).createVertexArray !== 'function') {
            (gl as any).createVertexArray = vaoExt.createVertexArrayOES.bind(vaoExt)
            console.log('✅ [DEBUG] WebGL1 使用 OES_vertex_array_object.createVertexArray')
          }
          if (typeof (gl as any).deleteVertexArray !== 'function') {
            (gl as any).deleteVertexArray = vaoExt.deleteVertexArrayOES.bind(vaoExt)
          }
          if (typeof (gl as any).bindVertexArray !== 'function') {
            (gl as any).bindVertexArray = vaoExt.bindVertexArrayOES.bind(vaoExt)
          }
          if (typeof (gl as any).isVertexArray !== 'function') {
            (gl as any).isVertexArray = vaoExt.isVertexArrayOES.bind(vaoExt)
          }
          console.log('✅ [DEBUG] WebGL1 VAO 扩展已启用')
        } else {
          // 如果扩展不可用，提供降级的 no-op 实现
          console.warn('⚠️ [DEBUG] WebGL1 不支持 OES_vertex_array_object，使用降级实现')
          
          if (typeof (gl as any).createVertexArray !== 'function') {
            (gl as any).createVertexArray = function() {
              // 返回一个虚拟的 VAO 对象
              return { __isNoopVAO: true }
            }
          }
          if (typeof (gl as any).deleteVertexArray !== 'function') {
            (gl as any).deleteVertexArray = function(_vao: any) {
              // no-op
            }
          }
          if (typeof (gl as any).bindVertexArray !== 'function') {
            (gl as any).bindVertexArray = function(_vao: any) {
              // no-op - 不绑定 VAO，使用默认的顶点属性状态
            }
          }
          if (typeof (gl as any).isVertexArray !== 'function') {
            (gl as any).isVertexArray = function(vao: any) {
              return vao && vao.__isNoopVAO === true
            }
          }
          console.log('✅ [DEBUG] WebGL1 VAO 降级实现已注入')
        }
      }

      // 修复 getInternalformatParameter 缺失问题 (仅WebGL2)
      if (gl instanceof WebGL2RenderingContext) {
        // 强制重新定义getInternalformatParameter方法，确保PixiJS能正确使用
        (gl as any).getInternalformatParameter = function(target: number, internalformat: number, pname: number) {
          console.log('🔧 [DEBUG] getInternalformatParameter调用:', { target, internalformat, pname })
          
          // 根据PixiJS的实际需求提供正确的返回值
          if (pname === gl.SAMPLES) {
            return new Int32Array([0]) // 不支持多重采样
          }
          if (pname === 0x9293) { // GL_NUM_SAMPLE_COUNTS
            return new Int32Array([1]) // 只有一个采样数
          }
          if (pname === gl.RENDERBUFFER_SAMPLES) {
            return new Int32Array([0]) // 渲染缓冲区采样数
          }
          
          // 默认返回安全值
          return new Int32Array([1])
        }
        console.log('✅ [DEBUG] 强制修复WebGL上下文: getInternalformatParameter')
        
        // 确保方法确实存在且可调用
        if (typeof (gl as any).getInternalformatParameter !== 'function') {
          console.error('❌ [DEBUG] getInternalformatParameter修复失败')
        } else {
          console.log('✅ [DEBUG] getInternalformatParameter修复验证成功')
        }
      }

      // 修复其他可能缺失的WebGL2函数
      if (gl instanceof WebGL2RenderingContext && !(gl as any).texStorage2D) {
        (gl as any).texStorage2D = function(target: number, _levels: number, internalformat: number, width: number, height: number) {
          // 降级到texImage2D
          console.warn('🔧 [DEBUG] texStorage2D降级处理')
          return (gl as any).texImage2D(target, 0, internalformat, width, height, 0, internalformat, gl.UNSIGNED_BYTE, null)
        }
        console.log('✅ [DEBUG] 修复WebGL上下文: texStorage2D')
      }

      // 修复 renderbufferStorageMultisample
      if (gl instanceof WebGL2RenderingContext && !(gl as any).renderbufferStorageMultisample) {
        (gl as any).renderbufferStorageMultisample = function(target: number, _samples: number, internalformat: number, width: number, height: number) {
          // 降级到普通renderbufferStorage
          console.warn('🔧 [DEBUG] renderbufferStorageMultisample降级处理')
          return (gl as any).renderbufferStorage(target, internalformat, width, height)
        }
        console.log('✅ [DEBUG] 修复WebGL上下文: renderbufferStorageMultisample')
      }

      // 检查并修复其他可能缺失的WebGL2方法
      const webgl2Methods = [
        'blitFramebuffer', 'drawBuffers', 'readBuffer', 'framebufferTextureLayer',
        'invalidateFramebuffer', 'invalidateSubFramebuffer', 'renderbufferStorageMultisample',
        'getInternalformatParameter', 'texStorage2D', 'texStorage3D', 'texSubImage3D',
        'copyTexSubImage3D', 'compressedTexImage3D', 'compressedTexSubImage3D',
        'getFragDataLocation', 'uniform1ui', 'uniform2ui', 'uniform3ui', 'uniform4ui',
        'uniform1uiv', 'uniform2uiv', 'uniform3uiv', 'uniform4uiv', 'uniformMatrix2x3fv',
        'uniformMatrix3x2fv', 'uniformMatrix2x4fv', 'uniformMatrix4x2fv', 'uniformMatrix3x4fv',
        'uniformMatrix4x3fv', 'clearBufferiv', 'clearBufferuiv', 'clearBufferfv',
        'clearBufferfi', 'createQuery', 'deleteQuery', 'isQuery', 'beginQuery',
        'endQuery', 'getQuery', 'getQueryParameter'
      ]
      
      webgl2Methods.forEach(methodName => {
        if (gl instanceof WebGL2RenderingContext && !(gl as any)[methodName]) {
          console.warn(`🔧 [DEBUG] WebGL2方法缺失: ${methodName}`)
          
          // 为特定方法提供更智能的实现
          if (methodName === 'getInternalformatParameter') {
            (gl as any)[methodName] = function(target: number, internalformat: number, pname: number) {
              console.warn(`🔧 [DEBUG] getInternalformatParameter降级处理: target=${target}, internalformat=${internalformat}, pname=${pname}`)
              // 返回合理的默认值
              if (pname === gl.SAMPLES) {
                return new Int32Array([0]) // 不支持多重采样
              }
              if (pname === 0x9293) { // GL_NUM_SAMPLE_COUNTS
                return new Int32Array([1]) // 只有一个采样数
              }
              return new Int32Array([1]) // 默认返回1
            }
          } else {
            // 提供空实现以避免错误
            (gl as any)[methodName] = function(...args: any[]) {
              console.warn(`🔧 [DEBUG] ${methodName}降级处理，参数:`, args)
              return null
            }
          }
        }
      })

      console.log('✅ [DEBUG] WebGL上下文修复完成')
      return gl
    } catch (error) {
      console.error('❌ [DEBUG] WebGL上下文修复失败:', error)
      return gl
    }
  }

  /**
   * 强制修复所有BatchRenderer实例
   */
  private forceFixAllBatchRenderers(): void {
    // 尝试通过多种方式获取和修复BatchRenderer
    const attempts = [
      () => (window as any).PIXI?.BatchRenderer,
      () => (globalThis as any).PIXI?.BatchRenderer,
      async () => {
        try {
          const pixiModule = await import('pixi.js')
          return (pixiModule as any).BatchRenderer
        } catch {
          return null
        }
      }
    ]
    
    attempts.forEach((getRenderer, index) => {
      Promise.resolve(getRenderer()).then(BatchRenderer => {
        if (BatchRenderer) {
          this.applyComprehensiveBatchRendererFix(BatchRenderer)
          if (!BatchRenderer.__loggedFixMethod) {
            BatchRenderer.__loggedFixMethod = new Set()
          }
          const key = index + 1
          if (!BatchRenderer.__loggedFixMethod.has(key)) {
            console.log(`✅ 修复BatchRenderer (方式 ${index + 1})`)
            BatchRenderer.__loggedFixMethod.add(key)
          }
        }
      }).catch(error => {
        console.warn(`⚠️ 无法通过方式 ${index + 1} 修复BatchRenderer:`, error)
      })
    })
  }

  /**
   * 应用全面的BatchRenderer修复
   */
  private applyComprehensiveBatchRendererFix(BatchRenderer: any): void {
    if (!BatchRenderer?.prototype) return
    
    // 修复checkMaxIfStatementsInShader
    const originalCheck = BatchRenderer.prototype.checkMaxIfStatementsInShader
    if (typeof originalCheck === 'function' && !originalCheck._isFixed) {
      BatchRenderer.prototype.checkMaxIfStatementsInShader = function(maxIfs: number) {
        const safeMaxIfs = (typeof maxIfs === 'number' && maxIfs > 0) ? Math.max(maxIfs, 32) : 100
          if (!this.__loggedFixOnce) {
            console.log(`🔧 BatchRenderer紧急修复: ${maxIfs} -> ${safeMaxIfs}`)
            this.__loggedFixOnce = true
          }
        return originalCheck.call(this, safeMaxIfs)
      }
      BatchRenderer.prototype.checkMaxIfStatementsInShader._isFixed = true
    }
    
    // 修复contextChange方法
    const originalContextChange = BatchRenderer.prototype.contextChange
    if (typeof originalContextChange === 'function' && !originalContextChange._isPatched) {
      BatchRenderer.prototype.contextChange = function(gl: any) {
        try {
          // 确保WebGL上下文有效
          if (!gl || gl.isContextLost()) {
            if (!this.__loggedContextLostWarn) {
              console.warn('⚠️ WebGL上下文无效或已丢失，跳过BatchRenderer初始化')
              this.__loggedContextLostWarn = true
            }
            return
          }
          
          // 预设安全的着色器限制值
          if (typeof this.checkMaxIfStatementsInShader === 'function') {
            const maxVertexUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) || 256
            const maxFragmentUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) || 256
            const safeLimit = Math.min(Math.floor(Math.min(maxVertexUniforms, maxFragmentUniforms) / 4), 100)
            
            // 强制设置一个安全值
            this.maxIfStatementsInShader = Math.max(safeLimit, 32)
            if (!this.__loggedPresetOnce) {
              console.log('🔧 预设BatchRenderer安全着色器限制:', this.maxIfStatementsInShader)
              this.__loggedPresetOnce = true
            }
          }
          
          return originalContextChange.call(this, gl)
        } catch (error) {
          console.error('❌ BatchRenderer contextChange失败:', error)
          // 设置最保守的配置
          this.maxIfStatementsInShader = 32
          throw error
        }
      }
      BatchRenderer.prototype.contextChange._isPatched = true
    }
  }

  /**
   * 设置PixiJS降级选项
   */
  private setupPixiJSFallbacks(): void {
    // 设置全局PixiJS选项
    if (typeof window !== 'undefined') {
      (window as any).PIXI_SETTINGS = {
        ...(window as any).PIXI_SETTINGS,
        PREFER_ENV: 'webgl',
        FAIL_IF_MAJOR_PERFORMANCE_CAVEAT: false,
        POWER_PREFERENCE: 'default',
        RENDER_OPTIONS: {
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
          antialias: true,
          alpha: true
        }
      }
    }
  }

  /**
   * 创建安全的Application配置
   */
  private createSafeApplicationConfig(retryCount: number): any {
    // 检查WebGL支持情况
    const webglSupport = this.checkWebGLSupport()
    
    // 基础配置
    let config: any = {
      view: this.canvas,
      width: this.canvas.width,
      height: this.canvas.height,
      backgroundColor: 0x000000,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      sharedTicker: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      clearBeforeRender: true
    }

    console.log(`🔧 [DEBUG] 创建Application配置 (重试${retryCount}):`, {
      webglSupport,
      retryCount,
      canvasSize: { width: this.canvas.width, height: this.canvas.height }
    })

    // 根据重试次数和WebGL支持情况调整配置，逐步降级
    switch (retryCount) {
      case 0:
        // 第一次尝试：根据WebGL支持情况选择最佳配置
        if (webglSupport.webgl2 && webglSupport.issues.length === 0) {
          config = {
            ...config,
            antialias: true,
            forceCanvas: false,
            powerPreference: 'default',
            failIfMajorPerformanceCaveat: false
          }
          console.log('🔧 [DEBUG] 使用WebGL2配置')
        } else if (webglSupport.webgl1) {
          config = {
            ...config,
            antialias: true,
            forceCanvas: false,
            powerPreference: 'default',
            failIfMajorPerformanceCaveat: false
          }
          console.log('🔧 [DEBUG] 使用WebGL1配置')
        } else {
          // 直接使用Canvas渲染器
          config = {
            ...config,
            antialias: false,
            forceCanvas: true,
            powerPreference: 'low-power',
            failIfMajorPerformanceCaveat: false
          }
          console.log('🔧 [DEBUG] 直接使用Canvas配置')
        }
        break
      
      case 1:
        // 第二次尝试：降级WebGL配置或Canvas
        if (webglSupport.webgl1) {
          config = {
            ...config,
            antialias: false,
            forceCanvas: false,
            powerPreference: 'low-power',
            failIfMajorPerformanceCaveat: false
          }
          console.warn('🔄 [DEBUG] 使用降级WebGL1配置重试')
        } else {
          config = {
            ...config,
            antialias: false,
            forceCanvas: true,
            powerPreference: 'low-power',
            failIfMajorPerformanceCaveat: false
          }
          console.warn('🔄 [DEBUG] 使用Canvas配置重试')
        }
        break
      
      case 2:
        // 第三次尝试：强制使用Canvas渲染器
        config = {
          ...config,
          antialias: false,
          forceCanvas: true,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: false
        }
        console.warn('🔄 [DEBUG] 强制使用Canvas渲染器')
        break
      
      default:
        // 最后的尝试：最保守的配置
        config = {
          view: this.canvas,
          width: this.canvas.width,
          height: this.canvas.height,
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
          antialias: false,
          forceCanvas: true,
          resolution: 1,
          autoDensity: false,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: false
        }
        console.warn('🔄 [DEBUG] 使用最保守配置')
        break
    }

    console.log('🔧 [DEBUG] 最终Application配置:', config)
    return config
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
      if (!Live2DModelLoader.hasLoggedDynFix) {
        console.log('✅ 通过动态导入修复 BatchRenderer')
        Live2DModelLoader.hasLoggedDynFix = true
      }
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
      if (!Live2DModelLoader.hasLoggedGlobalFix) {
        console.log('✅ 通过全局对象修复 BatchRenderer')
        Live2DModelLoader.hasLoggedGlobalFix = true
      }
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
          const ctor: any = rendererPlugins.batch.constructor
          if (!ctor.__loggedPluginFix) {
            console.log('✅ 通过Application插件修复 BatchRenderer')
            ctor.__loggedPluginFix = true
          }
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
    // 存储 canvas 引用
    this.canvas = canvas
    
    // 最高优先级：立即应用WebGL全局polyfill
    this.addGlobalWebGLPolyfill()
    
    // 预处理：修复 PixiJS 全局配置
    this.preFixPixiJSGlobalConfiguration()
    
    // 立即强制修复 BatchRenderer（在创建任何Application之前）
    this.forceFixPixiJSBatchRenderer()
    
    // 应用紧急WebGL兼容性修复
    this.applyEmergencyWebGLFixes()
    
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
        
      if (!Live2DModelLoader.hasLoggedGlobalBatchConfig) {
        console.log('✅ PixiJS BatchRenderer 全局配置完成')
        Live2DModelLoader.hasLoggedGlobalBatchConfig = true
      }
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
        // 在每次尝试前应用BatchRenderer修复
        this.forceFixPixiJSBatchRenderer()
        
        // 预设PixiJS全局设置
        this.preConfigurePixiJS()
        
        // 强制清理可能存在的WebGL上下文（仅在调试开关开启时）
        if (this.staticDebugOptions.enableForceCleanupBeforeInit) {
          this.forceCleanupWebGLContexts()
        }
        
        // 检查WebGL可用性
        this.checkWebGLAvailability()
        
        // 创建 PixiJS Application 实例 - 使用安全的配置
        const appConfig = this.createSafeApplicationConfig(retryCount)
        console.log(`🔧 [DEBUG] 尝试创建PixiJS Application (第${retryCount + 1}次):`, {
          retryCount,
          config: appConfig,
          canvasExists: !!this.canvas,
          canvasSize: { width: this.canvas?.width, height: this.canvas?.height },
          webglSupport: this.checkWebGLSupport(),
          pixiVersion: (window as any).PIXI?.VERSION || 'unknown'
        })
        
        // 尝试创建Application，如果失败则尝试手动创建渲染器
        try {
          console.log('🔧 [DEBUG] 正在尝试创建PixiJS Application...')
          
          // 🔧 [EMERGENCY FIX] 强制设置Canvas内部尺寸
          if (this.canvas.width !== this.canvas.clientWidth || this.canvas.height !== this.canvas.clientHeight) {
            console.log('🔧 [EMERGENCY FIX] 强制同步Canvas内部尺寸...')
            this.canvas.width = this.canvas.clientWidth || 400
            this.canvas.height = this.canvas.clientHeight || 600
            console.log(`   - Canvas内部尺寸已设置为: ${this.canvas.width}x${this.canvas.height}`)
          }
          
          // 🔧 [CRITICAL FIX] 确保Canvas在DOM中且有正确尺寸
          if (this.canvas.clientWidth === 0 || this.canvas.clientHeight === 0) {
            console.warn('⚠️ [FIX] Canvas客户端尺寸为0，强制设置样式尺寸...')
            this.canvas.style.width = '400px'
            this.canvas.style.height = '600px'
            this.canvas.style.display = 'block'
            
            // 等待一帧让浏览器应用样式
            await new Promise(resolve => requestAnimationFrame(resolve))
          }
          
          // 🔧 [CRITICAL FIX] 不要传入预先创建的上下文，让PixiJS自己创建
          // 这样PixiJS可以正确初始化DrawingBuffer尺寸
          const simpleConfig = {
            view: this.canvas,
            width: this.canvas.width,
            height: this.canvas.height,
            backgroundColor: 0x000000,
            backgroundAlpha: 0,
            resolution: 1,
            autoDensity: false,
            antialias: true,
            powerPreference: 'high-performance' as WebGLPowerPreference,
            preserveDrawingBuffer: false
          }
          
          console.log('🔧 [DEBUG] 使用简化配置创建Application:', simpleConfig)
          console.log('🔧 [DEBUG] Canvas客户端尺寸:', {
            clientWidth: this.canvas.clientWidth,
            clientHeight: this.canvas.clientHeight,
            width: this.canvas.width,
            height: this.canvas.height
          })
      this.app = new Application(simpleConfig)
          console.log('✅ [DEBUG] PixiJS Application自动创建成功')
        } catch (appError) {
          console.warn('🔄 [DEBUG] Application自动创建失败，尝试手动创建渲染器:', appError)
          
          // 在手动创建渲染器之前，确保WebGL上下文修复已应用
          this.applyEmergencyWebGLFixes()
          
          // 尝试手动创建渲染器
          let renderer: any = null
          
          if (!appConfig.forceCanvas) {
            try {
              // 动态导入并创建WebGL渲染器
              const PIXI = await import('pixi.js')
              if (PIXI && PIXI.Renderer) {
                console.log('🔧 [DEBUG] 尝试手动创建WebGL渲染器...')
                renderer = new PIXI.Renderer({
                  view: appConfig.view,
                  width: appConfig.width,
                  height: appConfig.height,
                  backgroundColor: appConfig.backgroundColor,
                  backgroundAlpha: appConfig.backgroundAlpha,
                  resolution: appConfig.resolution,
                  antialias: appConfig.antialias || false,
                  premultipliedAlpha: appConfig.premultipliedAlpha,
                  preserveDrawingBuffer: appConfig.preserveDrawingBuffer,
                  clearBeforeRender: appConfig.clearBeforeRender,
                  powerPreference: appConfig.powerPreference || 'default'
                  // 🔧 [CRITICAL FIX] 不传入context，让PixiJS自己创建
                })
                console.log('✅ [DEBUG] 手动创建WebGL渲染器成功')
              }
            } catch (webglError) {
              console.warn('⚠️ [DEBUG] WebGL渲染器手动创建失败:', webglError)
            }
          }
          
          if (!renderer) {
            try {
              // PixiJS v8+ 不再有独立的CanvasRenderer，使用Renderer的forceCanvas选项
              const PIXI = await import('pixi.js')
              if (PIXI && PIXI.Renderer) {
                console.log('🔧 [DEBUG] 尝试手动创建Canvas渲染器...')
                renderer = new PIXI.Renderer({
                  view: appConfig.view,
                  width: appConfig.width,
                  height: appConfig.height,
                  backgroundColor: appConfig.backgroundColor,
                  backgroundAlpha: appConfig.backgroundAlpha,
                  resolution: appConfig.resolution,
                  clearBeforeRender: appConfig.clearBeforeRender
                })
                console.log('✅ [DEBUG] 手动创建Canvas渲染器成功')
              }
            } catch (canvasError) {
              console.error('❌ [DEBUG] Canvas渲染器手动创建失败:', canvasError)
            }
          }
          
          if (renderer) {
            // 手动创建Application实例
            const PIXI = await import('pixi.js')
            if (PIXI && PIXI.Application) {
              this.app = new PIXI.Application()
              this.app.renderer = renderer
              this.app.stage = new PIXI.Container()
              this.app.ticker = PIXI.Ticker.shared
              console.log('✅ [DEBUG] 手动组装Application成功')
            } else {
              throw new Error('无法访问PIXI对象或Application类')
            }
          } else {
            throw appError // 重新抛出原始错误
          }
        }
        
        appCreated = true
        console.log('✅ PixiJS Application 创建成功')
        
        // WebGL上下文调试信息
        if (this.app.renderer && (this.app.renderer as any).gl) {
          const gl = (this.app.renderer as any).gl
          console.log('🔧 [DEBUG] WebGL上下文信息:', {
            version: gl.getParameter(gl.VERSION),
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER),
            contextId: gl.id || 'unknown',
            isContextLost: gl.isContextLost(),
            drawingBufferWidth: gl.drawingBufferWidth,
            drawingBufferHeight: gl.drawingBufferHeight,
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
            maxFragmentUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)
          })
          
          // 监听WebGL上下文丢失
          this.canvas.addEventListener('webglcontextlost', (event) => {
            console.error('❌ [DEBUG] WebGL上下文丢失!', event)
            event.preventDefault() // 防止默认行为，允许上下文恢复
          })
          
          this.canvas.addEventListener('webglcontextrestored', (event) => {
            console.log('✅ [DEBUG] WebGL上下文恢复!', event)
            // 重新应用着色器配置
            try {
              setTimeout(() => {
                console.log('🔄 WebGL上下文恢复后重新初始化着色器配置...')
                this.fixShaderConfiguration()
              }, 100) // 给上下文一点时间完全恢复
            } catch (error) {
              console.error('❌ WebGL上下文恢复后重新配置失败:', error)
            }
          })
        } else {
          console.warn('⚠️ [DEBUG] 未能获取WebGL上下文')
        }
        
        // 确保渲染循环启动
        try {
          if ((this.app as any).start) {
            ;(this.app as any).start()
            console.log('✅ PixiJS Application 已启动')
            
            // 🔧 [DEBUG] 添加渲染调试信息
            const appCanvas = (this.app as any).canvas || this.app.view || (this.app.renderer as any).view
            console.log('🔧 [DEBUG] PixiJS Application渲染状态:', {
              canvas: appCanvas,
              canvasParent: appCanvas?.parentElement,
              stage: this.app.stage,
              stageChildren: this.app.stage?.children?.length || 0,
              stageChildrenTypes: this.app.stage?.children?.map(child => child.constructor.name) || [],
              renderer: this.app.renderer,
              rendererType: this.app.renderer?.type,
              view: this.app.view,
              viewDimensions: {
                width: this.app.view?.width,
                height: this.app.view?.height,
                clientWidth: (this.app.view as any)?.clientWidth,
                clientHeight: (this.app.view as any)?.clientHeight,
                offsetWidth: (this.app.view as any)?.offsetWidth,
                offsetHeight: (this.app.view as any)?.offsetHeight
              },
              stageVisible: this.app.stage?.visible,
              stageAlpha: this.app.stage?.alpha,
              stageScale: this.app.stage?.scale ? { x: this.app.stage.scale.x, y: this.app.stage.scale.y } : null,
              stagePosition: this.app.stage ? { x: this.app.stage.x, y: this.app.stage.y } : null,
              backgroundColor: this.app.renderer?.background?.color,
              lastRenderTime: Date.now()
            })
            
            // 🔧 [DEBUG] 验证Canvas是否正确
            if (appCanvas !== this.canvas) {
              console.warn('⚠️ [DEBUG] PixiJS创建了新的Canvas，而不是使用提供的Canvas!')
              console.log('🔧 [DEBUG] 提供的Canvas:', this.canvas)
              console.log('🔧 [DEBUG] PixiJS的Canvas:', appCanvas)
              
              // 尝试替换Canvas
              if (this.canvas && appCanvas && this.canvas.parentElement) {
                console.log('🔧 [DEBUG] 尝试替换Canvas...')
                this.canvas.parentElement.replaceChild(appCanvas, this.canvas)
                this.canvas = appCanvas
                console.log('✅ [DEBUG] Canvas替换完成')
              }
            } else {
              console.log('✅ [DEBUG] PixiJS使用了正确的Canvas')
            }
            
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
      // 🔧 [FIX] 确保ticker正在运行
      if (!this.app.ticker.started) {
        this.app.ticker.start()
        console.log('✅ [FIX] PixiJS Ticker 已启动')
      }
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
      
      // 设置WebGL上下文恢复机制（如果尚未设置）
      this.setupWebGLRecovery()

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
  private loadExternalScript(url: string, timeoutMs = 30000): Promise<void> {
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
      // 设置当前模型路径（用于WebGL上下文恢复）
      this.currentModelPath = config.modelPath
      
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
      
      // 🔧 [FIX] 增加超时和重试机制
      let model: any = null
      let loadAttempts = 0
      const maxLoadAttempts = 3
      
      while (loadAttempts < maxLoadAttempts && !model) {
        try {
          loadAttempts++
          console.log(`🔄 模型加载尝试 ${loadAttempts}/${maxLoadAttempts}:`, config.modelPath)
          
          // 创建带超时的Promise
          const loadPromise = Live2DModel.from(config.modelPath, {
            onProgress: (progressValue: number) => {
              console.log('📊 模型加载进度:', progressValue)
              progress.progress = 0.3 + progressValue * 0.6
              progress.stage = `正在加载模型资源... (尝试 ${loadAttempts}/${maxLoadAttempts})`
              this.emit(LoaderEvent.LOAD_PROGRESS, progress)
            },
          } as any)
          
          // 30秒超时
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('模型加载超时')), 30000)
          })
          
          model = await Promise.race([loadPromise, timeoutPromise])
          console.log('✅ Live2D 模型加载成功:', model)
          
          // 🔧 [FIX] 模型加载成功后立即启动渲染循环
          this.startRenderLoop()
          
          break
          
        } catch (error) {
          console.error(`❌ 模型加载尝试 ${loadAttempts} 失败:`, error)
          
          if (loadAttempts >= maxLoadAttempts) {
            throw error
          }
          
          // 等待2秒后重试
          console.log('⏳ 等待2秒后重试...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // 🔧 [DEBUG] 模型加载后的状态检查
      console.log('🔧 [DEBUG] Live2D模型详细信息:', {
        model: model,
        modelType: typeof model,
        modelConstructor: model?.constructor?.name,
        modelWidth: model?.width,
        modelHeight: model?.height,
        modelVisible: model?.visible,
        modelAlpha: model?.alpha,
        modelScale: model?.scale,
        modelPosition: model?.position
      })

      // 应用渲染配置
      console.log('🔧 [DEBUG] 开始应用渲染配置...')
      try {
        this.applyRenderConfig(model, finalRenderConfig, config.id)
        console.log('✅ [DEBUG] 渲染配置应用完成')
      } catch (error) {
        console.error('❌ [DEBUG] 渲染配置应用失败:', error)
        throw error
      }

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
      console.log('🔧 [DEBUG] 准备将模型添加到舞台...')
      
      // 🔧 [FIX] 清理 stage 上的所有旧模型，防止重复添加
      const oldChildrenCount = this.app.stage.children.length
      if (oldChildrenCount > 0) {
        console.log(`🧹 [FIX] 清理 stage 上的 ${oldChildrenCount} 个旧对象...`)
        this.app.stage.removeChildren()
      }
      
      // 🚨 [EMERGENCY FIX] 强制确保模型可见
      (model as any).visible = true
      model.alpha = 1.0
      ;(model as any).renderable = true
      if ((model as any).cullable !== undefined) {
        ;(model as any).cullable = false // 禁用裁剪
      }
      
      this.app.stage.addChild(model as any)
      console.log('✅ [DEBUG] 模型已添加到舞台，当前 stage children 数量:', this.app.stage.children.length)
      
      // 🔧 [DEBUG] 模型添加到stage后的状态检查
      console.log('🔧 [DEBUG] 模型已添加到Stage:', {
        stageChildren: this.app.stage.children.length,
        stageChildrenTypes: this.app.stage.children.map(child => child.constructor.name),
        modelInStage: this.app.stage.children.includes(model as any),
        modelVisible: model.visible,
        modelAlpha: model.alpha,
        modelPosition: { x: (model as any).x, y: (model as any).y },
        modelScale: { x: (model as any).scale?.x, y: (model as any).scale?.y },
        modelAnchor: { x: (model as any).anchor?.x, y: (model as any).anchor?.y },
        modelBounds: (model as any).getBounds ? (model as any).getBounds() : 'no getBounds',
        stageVisible: this.app.stage.visible,
        stageAlpha: this.app.stage.alpha,
        rendererInfo: {
          type: this.app.renderer.type,
          width: this.app.renderer.width,
          height: this.app.renderer.height
        }
      })
      
      // 🔧 [DEBUG] 强制渲染一帧来测试
      try {
        this.app.renderer.render(this.app.stage)
            console.log('✅ [DEBUG] 强制渲染测试成功')
            
            // 🔧 [DEBUG] 添加持续渲染监控
            const monitorRendering = () => {
              if (this.app && this.app.stage && this.app.stage.children.length > 0) {
                const stageState = {
                  timestamp: new Date().toISOString(),
                  stageChildren: this.app.stage.children.length,
                  stageVisible: this.app.stage.visible,
                  stageAlpha: this.app.stage.alpha,
                  firstChildType: this.app.stage.children[0]?.constructor.name,
                  firstChildVisible: this.app.stage.children[0]?.visible,
                  firstChildAlpha: this.app.stage.children[0]?.alpha,
                  firstChildPosition: this.app.stage.children[0] ? {
                    x: this.app.stage.children[0].x,
                    y: this.app.stage.children[0].y
                  } : null,
                  firstChildScale: this.app.stage.children[0]?.scale ? {
                    x: this.app.stage.children[0].scale.x,
                    y: this.app.stage.children[0].scale.y
                  } : null,
                  rendererSize: {
                    width: this.app.renderer.width,
                    height: this.app.renderer.height
                  }
                }
                
                // 输出详细日志
                console.log('🎨 [DEBUG] 渲染监控状态:')
                console.log('  👶 Stage子对象数量:', stageState.stageChildren)
                console.log('  🎭 Stage可见性:', stageState.stageVisible, '透明度:', stageState.stageAlpha)
                console.log('  🤖 模型类型:', stageState.firstChildType)
                console.log('  👁️ 模型可见性:', stageState.firstChildVisible, '透明度:', stageState.firstChildAlpha)
                console.log('  📍 模型位置:', stageState.firstChildPosition)
                console.log('  📏 模型缩放:', stageState.firstChildScale)
                console.log('  🖼️ 渲染器尺寸:', stageState.rendererSize)
                
                // 强制渲染一次
                this.app.renderer.render(this.app.stage)
              }
            }
            
            // 立即监控一次
            monitorRendering()
            // 后续定期监控
            setTimeout(monitorRendering, 2000)
            setTimeout(monitorRendering, 5000)
            setTimeout(monitorRendering, 10000)
      } catch (renderError) {
        console.error('❌ [DEBUG] 强制渲染测试失败:', renderError)
      }
      
      // 最终位置/可见性修正并立即渲染一次
      this.finalizeModelPlacement(modelInstance)

      // 🔧 [FIX] 强制设置Canvas的CSS样式确保可见
      if (this.canvas) {
        console.log('🎨 [CSS FIX] 强制设置Canvas样式确保可见')
        const canvas = this.canvas as HTMLCanvasElement
        
        // 🔍 [DOM DEBUG] 检查DOM层级
        let element: HTMLElement | null = canvas
        const domHierarchy: Array<{tag: string, class: string, id: string, zIndex: string, opacity: string, display: string}> = []
        let depth = 0
        while (element && depth < 10) {
          const computed = window.getComputedStyle(element)
          domHierarchy.push({
            tag: element.tagName,
            class: element.className || '',
            id: element.id || '',
            zIndex: computed.zIndex,
            opacity: computed.opacity,
            display: computed.display
          })
          element = element.parentElement
          depth++
        }
        console.log('🔍 [DOM DEBUG] Canvas DOM层级:')
        domHierarchy.forEach((layer, index) => {
          console.log(`  层级 ${index}: ${layer.tag}.${layer.class || '(无class)'}#${layer.id || '(无id)'}`, {
            zIndex: layer.zIndex,
            opacity: layer.opacity,
            display: layer.display
          })
        })
        
        // 先设置父元素样式
        const parent = canvas.parentElement
        if (parent) {
          console.log('🎨 [CSS FIX] 设置父元素样式')
          parent.style.display = 'block'
          parent.style.opacity = '1'
          parent.style.visibility = 'visible'
          parent.style.overflow = 'visible'
          parent.style.minHeight = '400px'
          parent.style.position = 'relative'
          parent.style.zIndex = '1'
          console.log(`✅ [CSS FIX] 父元素样式: ${parent.tagName}.${parent.className}`, {
            width: parent.offsetWidth,
            height: parent.offsetHeight
          })
        }
        
        // 🔧 [CRITICAL FIX] 修复HTML元素透明度
        const htmlElement = document.documentElement
        if (htmlElement && window.getComputedStyle(htmlElement).opacity === '0') {
          htmlElement.style.opacity = '1'
        }
        
        // 设置Canvas样式 - 确保可见性
        canvas.style.cssText = `
          display: block !important;
          opacity: 1 !important;
          visibility: visible !important;
          position: relative !important;
          z-index: 1 !important;
          width: 100% !important;
          height: 100% !important;
          pointer-events: auto !important;
          min-width: 200px !important;
          min-height: 200px !important;
          overflow: visible !important;
        `.replace(/\s+/g, ' ').trim()
      }

      // 🔧 [FIX] 启动持续渲染循环
      this.startRenderLoop()

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
   * @param model 模型实例
   * @param renderConfig 渲染配置
   * @param modelId 模型ID（可选，用于检查用户是否手动调整过）
   */
  private applyRenderConfig(model: Live2DModel, renderConfig: Live2DRenderConfig, modelId?: string): void {
    console.log('🔧 [DEBUG] applyRenderConfig 开始执行:', { model: !!model, renderConfig, modelId })
    
    // 检查模型是否被用户手动调整过
    let modelInstance: Live2DModelInstance | undefined
    if (modelId) {
      modelInstance = this.loadedModels.get(modelId)
    }
    
    // 设置锚点，默认居中
    if ((model as any).anchor && typeof (model as any).anchor.set === 'function') {
      ;(model as any).anchor.set(0.5, 0.5)
      console.log('✅ [DEBUG] 模型锚点设置完成')
    }
    
    // 🔧 强制设置pivot为模型中心（确保模型正确居中）
    try {
      const modelBounds = (model as any).getBounds()
      const pivotX = modelBounds.width / 2
      const pivotY = modelBounds.height / 2
      ;(model as any).pivot.set(pivotX, pivotY)
      console.log(`✅ [DEBUG] 模型pivot设置完成: (${pivotX}, ${pivotY})`)
      console.log(`✅ [DEBUG] 模型边界: x=${modelBounds.x}, y=${modelBounds.y}, w=${modelBounds.width}, h=${modelBounds.height}`)
    } catch (e) {
      console.log(`⚠️ [DEBUG] 无法设置模型pivot:`, e)
    }

    // 设置缩放 - 如果配置的缩放为1.0且用户未手动调整，则自动计算最佳缩放
    let finalScale = renderConfig.scale
    const userAdjustedScale = modelInstance?.userAdjustedScale || false
    
    if (!userAdjustedScale && renderConfig.scale === 1.0 && this.app && this.app.renderer) {
      const rendererAny = this.app.renderer as any
      finalScale = this.calculateOptimalScale(model, rendererAny.width, rendererAny.height)
    }
    
    // 🔧 [FIX] 重新计算缩放确保模型完全在画布内（仅在用户未手动调整时）
    if (!userAdjustedScale && this.app && this.app.renderer) {
      const rendererAny = this.app.renderer as any
      const canvasWidth = rendererAny.width || 400
      const canvasHeight = rendererAny.height || 600
      
      // 获取模型当前边界（应用pivot后）
      const modelBounds = (model as any).getBounds()
      const modelWidth = modelBounds.width
      const modelHeight = modelBounds.height
      
      // 计算能完全容纳模型的缩放（留10%边距）
      const scaleX = (canvasWidth * 0.9) / modelWidth
      const scaleY = (canvasHeight * 0.9) / modelHeight
      const optimalScale = Math.min(scaleX, scaleY)
      
      console.log(`🔧 [FIX] 重新计算缩放确保模型完全可见:`)
      console.log(`   - 画布尺寸: ${canvasWidth} x ${canvasHeight}`)
      console.log(`   - 模型尺寸: ${modelWidth.toFixed(1)} x ${modelHeight.toFixed(1)}`)
      console.log(`   - 计算缩放: scaleX=${scaleX.toFixed(3)}, scaleY=${scaleY.toFixed(3)}`)
      console.log(`   - 最优缩放: ${optimalScale.toFixed(3)}`)
      console.log(`   - 原始缩放: ${finalScale.toFixed(3)}`)
      
      // 使用更小的缩放确保模型完全可见
      if (optimalScale < finalScale) {
        finalScale = optimalScale
        console.log(`   - 🎯 使用最优缩放: ${finalScale.toFixed(3)}`)
      }
    }
    
    // 🚨 [EMERGENCY FIX] 确保缩放值足够大以便看见模型
    if (finalScale < 0.05) {
      console.log(`🚨 [EMERGENCY FIX] 缩放值 ${finalScale.toFixed(3)} 太小，强制设为 0.1`)
      finalScale = 0.1
    }
    
    ;(model as any).scale.set(finalScale)
    console.log(`🎯 应用模型缩放: ${finalScale.toFixed(3)} (用户调整过: ${userAdjustedScale})`)
    
    // 🔍 [DEBUG] 检查模型边界
    try {
      const bounds = (model as any).getBounds()
      console.log(`📐 [DEBUG] 模型边界信息:`)
      console.log(`   - 边界: x=${bounds.x.toFixed(1)}, y=${bounds.y.toFixed(1)}, w=${bounds.width.toFixed(1)}, h=${bounds.height.toFixed(1)}`)
      console.log(`   - 右边界: ${(bounds.x + bounds.width).toFixed(1)}, 下边界: ${(bounds.y + bounds.height).toFixed(1)}`)
      
      if (this.app && this.app.renderer) {
        const renderer = this.app.renderer as any
        console.log(`   - 画布边界: w=${renderer.width}, h=${renderer.height}`)
        console.log(`   - 模型是否在画布内: x=${bounds.x >= 0 && bounds.x + bounds.width <= renderer.width}, y=${bounds.y >= 0 && bounds.y + bounds.height <= renderer.height}`)
      }
    } catch (error) {
      console.warn('⚠️ 获取模型边界失败:', error)
    }
    
    // 设置位置
    let targetX = renderConfig.position.x
    let targetY = renderConfig.position.y
    
    const userAdjustedPosition = modelInstance?.userAdjustedPosition || false
    
    console.log('🎯 [DEBUG] 初始位置配置:', { 
      configX: renderConfig.position.x, 
      configY: renderConfig.position.y,
      userAdjustedPosition,
      rendererSize: this.app?.renderer ? { 
        width: (this.app.renderer as any).width, 
        height: (this.app.renderer as any).height 
      } : 'no renderer'
    })
    
    // 🔧 [FIX] 只在用户未手动调整且位置为(0,0)时才自动居中
    if (!userAdjustedPosition && targetX === 0 && targetY === 0 && this.app && this.app.renderer) {
      const rendererAny = this.app.renderer as any
      const canvasCenterX = rendererAny.width / 2
      const canvasCenterY = rendererAny.height / 2
      
      // 🔧 [FIX] 获取模型边界和pivot，计算正确的居中位置
      try {
        const modelBounds = (model as any).getBounds()
        const pivotX = (model as any).pivot?.x || 0
        const pivotY = (model as any).pivot?.y || 0
        
        // 计算模型中心相对于pivot的偏移
        const modelCenterOffsetX = modelBounds.width / 2 - pivotX
        const modelCenterOffsetY = modelBounds.height / 2 - pivotY
        
        // 计算正确的居中位置（考虑pivot和缩放）
        const scaleX = (model as any).scale?.x || finalScale
        const scaleY = (model as any).scale?.y || finalScale
        
        targetX = canvasCenterX - (modelBounds.x + modelCenterOffsetX) * scaleX
        targetY = canvasCenterY - (modelBounds.y + modelCenterOffsetY) * scaleY
        
        console.log(`🎯 [FIX] 自动居中计算（考虑pivot）:`)
        console.log(`   - 画布中心: (${canvasCenterX}, ${canvasCenterY})`)
        console.log(`   - 模型边界: x=${modelBounds.x.toFixed(1)}, y=${modelBounds.y.toFixed(1)}, w=${modelBounds.width.toFixed(1)}, h=${modelBounds.height.toFixed(1)}`)
        console.log(`   - 模型pivot: (${pivotX.toFixed(1)}, ${pivotY.toFixed(1)})`)
        console.log(`   - 模型中心偏移: (${modelCenterOffsetX.toFixed(1)}, ${modelCenterOffsetY.toFixed(1)})`)
        console.log(`   - 计算位置: (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`)
      } catch (e) {
        // 如果获取边界失败，使用简单的居中方式
        console.warn('⚠️ [FIX] 无法获取模型边界，使用简单居中:', e)
        targetX = canvasCenterX
        targetY = canvasCenterY
      }
    } else if (userAdjustedPosition) {
      // 如果用户调整过位置，使用模型当前位置而不是配置中的位置
      targetX = (model as any).position.x
      targetY = (model as any).position.y
      console.log(`🎯 [DEBUG] 保持用户调整的位置: x=${targetX}, y=${targetY}`)
    }
    
    (model as any).position.set(targetX, targetY)
    
    // 🔧 [FIX] 更新 renderConfig 以保持一致性
    renderConfig.position = { x: targetX, y: targetY }
    
    console.log(`🎯 [DEBUG] 模型位置已设置: x=${targetX.toFixed(1)}, y=${targetY.toFixed(1)}`)
    
    // 🔧 [FIX] 设置锚点为中心以便正确旋转和缩放
    if ((model as any).anchor) {
      (model as any).anchor.set(0.5, 0.5)
      console.log('🎯 [DEBUG] 锚点已设置为中心 (0.5, 0.5)')
    }
    
    // 🔧 [DEBUG] 输出最终位置信息
    // console.log('🎯 [DEBUG] 模型最终定位:', {
    //   position: { x: (model as any).x, y: (model as any).y },
    //   anchor: (model as any).anchor ? { x: (model as any).anchor.x, y: (model as any).anchor.y } : 'N/A',
    //   pivot: { x: (model as any).pivot.x, y: (model as any).pivot.y }
    // })
    
    // 设置透明度
    (model as any).alpha = +(renderConfig.opacity);
    console.log(`🎨 [DEBUG] 模型透明度设置: ${renderConfig.opacity}`)

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

    // 确保模型绑定当前renderer，避免跨上下文的纹理/缓冲对象
    try {
      const renderer = (this.app as any)?.renderer
      if (renderer && (model as any).renderer !== renderer) {
        ;(model as any).renderer = renderer
      }
    } catch {}

    // 修复交互性兼容性问题
    try {
      // 确保模型具有 isInteractive 方法
      console.log('🔧 [DEBUG] 设置模型交互性...')
      
      if (typeof (model as any).isInteractive !== 'function') {
        (model as any).isInteractive = function() {
          return this.interactive !== false
        }
        console.log('✅ [DEBUG] 为模型添加 isInteractive 方法')
      }
      
      // 检查和设置模型的交互属性
      console.log('🔧 [DEBUG] 模型当前交互状态:', {
        interactive: (model as any).interactive,
        eventMode: (model as any).eventMode,
        cursor: (model as any).cursor,
        hitArea: !!(model as any).hitArea,
        hasOnMethod: typeof (model as any).on === 'function'
      })
      
      // 确保模型具有正确的事件管理器
      if (!(model as any).eventMode && (model as any).interactive !== false) {
        (model as any).eventMode = 'static'
        console.log('✅ [DEBUG] 设置模型eventMode为static')
      }
      
      // 强制启用交互性
      if ((model as any).interactive === undefined) {
        (model as any).interactive = true
        console.log('✅ [DEBUG] 启用模型交互性')
      }
      
      // 设置光标样式
      if (!(model as any).cursor) {
        (model as any).cursor = 'pointer'
        console.log('✅ [DEBUG] 设置模型光标样式')
      }
      
      console.log('✅ 模型交互性兼容性修复完成')
      
      // 运行时修复交互管理器
      this.fixLive2DInteractionManager(model)
      
    } catch (error) {
      console.warn('⚠️ 修复模型交互性时出现错误:', error)
    }
    
    // 🔧 [FIX] 配置完成后强制渲染一次
    try {
      if (this.app && this.app.renderer && this.app.stage) {
        this.app.renderer.render(this.app.stage)
        console.log('✅ [DEBUG] applyRenderConfig 完成后强制渲染')
      }
    } catch (error) {
      console.warn('⚠️ applyRenderConfig 强制渲染失败:', error)
    }
    
    console.log('✅ [DEBUG] applyRenderConfig 执行完成')
  }

  /**
   * 在将模型添加到舞台后，进行一次最终的居中与可见性修正
   */
  private finalizeModelPlacement(modelInstance: Live2DModelInstance): void {
    try {
      const { model, renderConfig } = modelInstance
      if (!this.app || !this.app.renderer || !model) return

      console.log('🎨 [FINALIZE] 开始最终化模型位置:', {
        currentPosition: { x: (model as any).x, y: (model as any).y },
        configPosition: renderConfig.position,
        rendererSize: { width: (this.app.renderer as any).width, height: (this.app.renderer as any).height }
      })

      // 确保舞台可见
      this.app.stage.visible = (true as boolean);
      this.app.stage.alpha = (1.0 as number);

      // 🔧 [FIX] 验证并修正模型位置，确保模型真正居中
      const rendererAny = this.app.renderer as any
      const canvasCenterX = rendererAny.width / 2
      const canvasCenterY = rendererAny.height / 2
      
      try {
        // 获取模型的实际边界（考虑所有变换）
        const modelBounds = (model as any).getBounds()
        const modelCenterX = modelBounds.x + modelBounds.width / 2
        const modelCenterY = modelBounds.y + modelBounds.height / 2
        
        // 计算偏移量
        const offsetX = canvasCenterX - modelCenterX
        const offsetY = canvasCenterY - modelCenterY
        
        // 如果偏移量超过阈值（5像素），调整模型位置
        if (Math.abs(offsetX) > 5 || Math.abs(offsetY) > 5) {
          const currentX = (model as any).position.x || 0
          const currentY = (model as any).position.y || 0
          const newX = currentX + offsetX
          const newY = currentY + offsetY
          
          console.log(`🎯 [FINALIZE] 修正模型位置:`)
          console.log(`   - 模型边界: x=${modelBounds.x.toFixed(1)}, y=${modelBounds.y.toFixed(1)}, w=${modelBounds.width.toFixed(1)}, h=${modelBounds.height.toFixed(1)}`)
          console.log(`   - 模型中心: (${modelCenterX.toFixed(1)}, ${modelCenterY.toFixed(1)})`)
          console.log(`   - 画布中心: (${canvasCenterX.toFixed(1)}, ${canvasCenterY.toFixed(1)})`)
          console.log(`   - 偏移量: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`)
          console.log(`   - 当前位置: (${currentX.toFixed(1)}, ${currentY.toFixed(1)})`)
          const newXStr = newX.toFixed(1)
          const newYStr = newY.toFixed(1)
          ;(console as any).log('   - 新位置: (' + newXStr + ', ' + newYStr + ')')
          
          // 更新模型位置
          (model as any).position.set(newX, newY)
          renderConfig.position = { x: newX, y: newY }
        } else {
          console.log(`✅ [FINALIZE] 模型位置已正确，无需调整`)
        }
      } catch (e) {
        console.warn(`⚠️ [FINALIZE] 无法计算模型边界，保持当前位置:`, e)
      }

      // 🔧 [FIX] 强制确保模型完全可见和正确定位
      (model as any).alpha = +(renderConfig.opacity);
      (model as any).visible = (true as boolean);
      (model as any).renderable = (true as boolean);
      (model as any).interactive = (true as boolean);

      // 🔧 [FIX] 验证模型在stage中（不再重复添加）
      // const isInStage = this.app.stage.children.indexOf(model as any) !== -1
      // console.log('🔍 [DEBUG] 模型在 stage 中:', isInStage, ', stage children 数量:', this.app.stage.children.length)

      // 🔧 [FIX] 强制更新变换矩阵
      (model as any).updateTransform()

      // 触发多次即时渲染确保显示
      for (let i = 0; i < 5; i++) {
        try {
          if (this.app.renderer && this.app.stage) {
            this.app.renderer.render(this.app.stage)
          }
        } catch {}
        // 每次渲染间隔10ms (同步等待)
        const start = Date.now()
        while (Date.now() - start < 10) {
          // 忙等待10ms
        }
      }

      console.log('✅ [FIX] 模型最终化完成，强制渲染5次')
      
      // 🔧 [DEBUG] 添加详细的渲染状态调试信息
      console.log('🔍 [RENDER DEBUG] 渲染环境检查:')
      console.log('  📱 App存在:', !!this.app)
      console.log('  🎨 Renderer存在:', !!this.app?.renderer)
      console.log('  🎭 Stage存在:', !!this.app?.stage)
      console.log('  👥 Stage子元素数量:', this.app?.stage?.children?.length || 0)
      console.log('  📐 Canvas尺寸:', {
        width: this.canvas?.clientWidth,
        height: this.canvas?.clientHeight,
        visible: this.canvas?.style?.display !== 'none'
      })
      console.log('  🎯 Canvas位置:', this.canvas?.getBoundingClientRect())
      
      // 🚨 [EMERGENCY DEBUG] 检查模型的详细渲染状态
      if (this.app?.stage?.children?.length > 0) {
        const firstChild = this.app.stage.children[0] as any
        console.log('🔍 [EMERGENCY DEBUG] 第一个子元素详情:')
        console.log('   - 类型:', firstChild.constructor.name)
        console.log('   - 可见:', firstChild.visible)
        console.log('   - 透明度:', firstChild.alpha)
        console.log('   - 位置: (', firstChild.x, ',', firstChild.y, ')')
        console.log('   - 缩放: (', firstChild.scale?.x, ',', firstChild.scale?.y, ')')
        console.log('   - 渲染:', firstChild.renderable)
        console.log('   - 世界可见:', firstChild.worldVisible)
        console.log('   - 世界透明度:', firstChild.worldAlpha)
        
        try {
          const bounds = firstChild.getBounds()
          console.log('   - 边界: x=', bounds.x, ', y=', bounds.y, ', w=', bounds.width, ', h=', bounds.height)
        } catch (e) {
          console.log('   - 边界获取失败:', e)
        }
      }
      
      // 🔧 [FIX] 设置持续渲染监控，确保模型持续可见
      let renderCount = 0
      const continuousRender = () => {
        if (renderCount < 10 && this.app && this.app.renderer && this.app.stage) {
          try {
            // 🔧 [DEBUG] 详细渲染状态
            console.log(`🎨 [RENDER DEBUG] 第${renderCount + 1}次渲染:`)
            console.log('  🎭 Stage可见性:', this.app.stage.visible, '透明度:', this.app.stage.alpha)
            console.log('  👥 Stage子元素:', this.app.stage.children.map(child => ({
              type: child.constructor.name,
              visible: child.visible,
              alpha: child.alpha,
              x: child.x,
              y: child.y,
              width: (child as any).width || 'N/A',
              height: (child as any).height || 'N/A'
            })))
            
            this.app.renderer.render(this.app.stage)
            renderCount++
            console.log(`✅ [RENDER DEBUG] 第${renderCount}次渲染完成`)
            
            // 🔧 [DEBUG] 检查Canvas内容 - 注意：WebGL Canvas不能用getContext('2d')
            if (this.canvas) {
              console.log('🖼️ [RENDER DEBUG] Canvas检查:')
              console.log('  📐 Canvas实际尺寸:', {
                width: this.canvas.width,
                height: this.canvas.height,
                clientWidth: this.canvas.clientWidth,
                clientHeight: this.canvas.clientHeight
              })
              console.log('  👁️ Canvas可见性:', {
                display: this.canvas.style.display,
                visibility: this.canvas.style.visibility,
                opacity: this.canvas.style.opacity,
                zIndex: this.canvas.style.zIndex
              })
              console.log('  🎯 Canvas位置:', this.canvas.getBoundingClientRect())
              
              // 检查WebGL上下文
              const gl = this.canvas.getContext('webgl') || this.canvas.getContext('webgl2')
              if (gl) {
                console.log('  🎨 WebGL上下文状态:', {
                  contextLost: gl.isContextLost(),
                  drawingBufferWidth: gl.drawingBufferWidth,
                  drawingBufferHeight: gl.drawingBufferHeight,
                  viewport: gl.getParameter(gl.VIEWPORT)
                })
                
                // 🔍 [CRITICAL DEBUG] 检查Canvas像素内容
                try {
                  console.log(`  🎨 [PIXEL DEBUG] 检查Canvas像素内容...`)
                  
                  // 检查左上角10x10区域
                  const topLeftPixels = new Uint8Array(4 * 10 * 10)
                  gl.readPixels(0, 0, 10, 10, gl.RGBA, gl.UNSIGNED_BYTE, topLeftPixels)
                  let hasTopLeftContent = false
                  for (let i = 3; i < topLeftPixels.length; i += 4) {
                    if (topLeftPixels[i] > 0) {
                      hasTopLeftContent = true
                      break
                    }
                  }
                  
                  // 检查中心20x20区域
                  const centerX = Math.max(0, Math.floor(gl.drawingBufferWidth / 2) - 10)
                  const centerY = Math.max(0, Math.floor(gl.drawingBufferHeight / 2) - 10)
                  const centerPixels = new Uint8Array(4 * 20 * 20)
                  gl.readPixels(centerX, centerY, 20, 20, gl.RGBA, gl.UNSIGNED_BYTE, centerPixels)
                  let hasCenterContent = false
                  for (let i = 3; i < centerPixels.length; i += 4) {
                    if (centerPixels[i] > 0) {
                      hasCenterContent = true
                      break
                    }
                  }
                  
                  // 检查模型应该在的位置（根据边界计算）
                  const modelX = Math.max(0, Math.floor(178))
                  const modelY = Math.max(0, Math.floor(269))
                  const modelPixels = new Uint8Array(4 * 20 * 20)
                  gl.readPixels(modelX, modelY, 20, 20, gl.RGBA, gl.UNSIGNED_BYTE, modelPixels)
                  let hasModelContent = false
                  for (let i = 3; i < modelPixels.length; i += 4) {
                    if (modelPixels[i] > 0) {
                      hasModelContent = true
                      break
                    }
                  }
                  
                  console.log(`  🎨 [PIXEL DEBUG] 像素检查结果:`)
                  console.log(`     - 左上角(0,0)有内容: ${hasTopLeftContent}`)
                  console.log(`     - 中心(${centerX},${centerY})有内容: ${hasCenterContent}`)
                  console.log(`     - 模型位置(${modelX},${modelY})有内容: ${hasModelContent}`)
                  console.log(`     - DrawingBuffer尺寸: ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`)
                  console.log(`     - Canvas尺寸: ${this.canvas.width}x${this.canvas.height}`)
                  
                  if (hasTopLeftContent || hasCenterContent || hasModelContent) {
                    console.log(`  🎉 [PIXEL DEBUG] ✅ Canvas确实有内容渲染！`)
                  } else {
                    console.log(`  ❌ [PIXEL DEBUG] Canvas似乎是空的`)
                    
                    // 🚨 [EMERGENCY DEBUG] 渲染管道深度诊断
                    console.log(`  🚨 [EMERGENCY DEBUG] 渲染管道诊断:`)
                    console.log(`     - PixiJS App存在: ${!!this.app}`)
                    console.log(`     - Stage存在: ${!!this.app?.stage}`)
                    console.log(`     - Renderer存在: ${!!this.app?.renderer}`)
                    console.log(`     - Canvas匹配: ${this.app?.renderer?.view === this.canvas}`)
                    console.log(`     - Stage子元素数: ${this.app?.stage?.children?.length || 0}`)
                    
                    if (this.app?.stage?.children?.length > 0) {
                      const child = this.app.stage.children[0]
                      console.log(`     - 第一个子元素类型: ${child.constructor.name}`)
                      console.log(`     - 子元素可见: ${child.visible}`)
                      console.log(`     - 子元素透明度: ${child.alpha}`)
                      console.log(`     - 子元素位置: (${child.x}, ${child.y})`)
                      console.log(`     - 子元素缩放: (${child.scale?.x}, ${child.scale?.y})`)
                      console.log(`     - 子元素边界: ${JSON.stringify(child.getBounds?.())}`)
                      
                      // 检查模型是否有纹理
                      if ((child as any).textures) {
                        console.log(`     - 模型纹理数量: ${(child as any).textures.length}`)
                        ;(child as any).textures.forEach((tex: any, i: number) => {
                          console.log(`       纹理${i}: ${tex.width}x${tex.height}, 有效: ${tex.valid}`)
                        })
                      }
                    }
                    
                    // 🚨 [CRITICAL FIX] 修复DrawingBuffer尺寸问题 - 仅在首次渲染时执行
                    // 注意：我们不再强制修改Canvas尺寸，因为这会破坏动态尺寸设置
                    console.log(`  ℹ️ [INFO] 跳过DrawingBuffer尺寸强制修复（保留动态尺寸）`)
                    console.log(`     - 当前DrawingBuffer: ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`)
                    console.log(`     - 期望Canvas尺寸: ${this.canvas.width}x${this.canvas.height}`)
                    
                    /* 禁用自动Canvas尺寸修复，因为它会覆盖动态设置的尺寸
                    try {
                      // 🔧 方法1: 强制重新设置Canvas尺寸
                      console.log(`  🔧 [FIX 1] 强制重新设置Canvas尺寸...`)
                      // 使用Canvas当前的实际尺寸，而不是硬编码的值
                      const targetWidth = this.canvas.width
                      const targetHeight = this.canvas.height
                      
                      // 设置Canvas实际尺寸
                      this.canvas.width = targetWidth
                      this.canvas.height = targetHeight
                      
                      // 设置CSS尺寸
                      this.canvas.style.width = targetWidth + 'px'
                      this.canvas.style.height = targetHeight + 'px'
                      
                      console.log(`     - Canvas尺寸已设置为: ${targetWidth}x${targetHeight}`)
                      
                      // 🔧 方法2: 强制PixiJS渲染器重新调整大小
                      if (this.app && this.app.renderer) {
                        console.log(`  🔧 [FIX 2] 强制PixiJS渲染器重新调整大小...`)
                        
                        // 调用renderer.resize强制重新设置
                        this.app.renderer.resize(targetWidth, targetHeight)
                        console.log(`     - PixiJS渲染器已调整为: ${targetWidth}x${targetHeight}`)
                        
                        // 检查调整后的DrawingBuffer
                        const newBufferWidth = gl.drawingBufferWidth
                        const newBufferHeight = gl.drawingBufferHeight
                        console.log(`     - 调整后DrawingBuffer: ${newBufferWidth}x${newBufferHeight}`)
                        
                        if (newBufferWidth > 1 && newBufferHeight > 1) {
                          console.log(`  🎉 [SUCCESS] DrawingBuffer尺寸修复成功！`)
                          
                          // 🔧 方法3: 强制重新渲染
                          console.log(`  🔧 [FIX 3] 强制重新渲染...`)
                          gl.clearColor(0, 0, 0, 0)
                          gl.clear(gl.COLOR_BUFFER_BIT)
                          this.app.renderer.render(this.app.stage)
                          
                          // 再次检查像素
                          const testPixels = new Uint8Array(4)
                          const testX = Math.floor(newBufferWidth / 2)
                          const testY = Math.floor(newBufferHeight / 2)
                          gl.readPixels(testX, testY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, testPixels)
                          const hasPixelAfterFix = testPixels[3] > 0
                          console.log(`     - 修复后中心(${testX},${testY})像素有内容: ${hasPixelAfterFix}`)
                          
                          if (hasPixelAfterFix) {
                            console.log(`  🎉 [VICTORY] 🎉 Live2D模型渲染修复成功！`)
                          }
                        } else {
                          console.log(`  ❌ [FAILED] DrawingBuffer尺寸仍然异常: ${newBufferWidth}x${newBufferHeight}`)
                          
                          // 🚨 [ULTIMATE FIX] 最终解决方案：重新创建WebGL上下文
                          console.log(`  🚨 [ULTIMATE FIX] 开始重新创建WebGL上下文...`)
                          
                          // 先尝试一次简单的上下文恢复
                          console.log(`  🔧 [ULTIMATE FIX] 尝试简单的上下文恢复...`)
                          try {
                            const gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl')
                            if (gl && !gl.isContextLost()) {
                              // 尝试强制重新绑定framebuffer
                              gl.bindFramebuffer(gl.FRAMEBUFFER, null)
                              gl.viewport(0, 0, this.canvas.width, this.canvas.height)
                              console.log(`  ✅ [ULTIMATE FIX] 简单恢复成功，重新检查...`)
                              
                              // 重新检查DrawingBuffer尺寸
                              const newWidth = gl.drawingBufferWidth
                              const newHeight = gl.drawingBufferHeight
                              if (newWidth >= 400 && newHeight >= 600) {
                                console.log(`  🎉 [ULTIMATE FIX] 简单恢复成功！新尺寸: ${newWidth}x${newHeight}`)
                                return // 成功修复，不需要重新创建
                              }
                            }
                          } catch (simpleFixError) {
                            console.log(`  ❌ [ULTIMATE FIX] 简单恢复失败:`, simpleFixError)
                          }
                          
                          // 简单修复失败，执行完整重新创建
                          this.recreateWebGLContext()
                        }
                      }
                    } catch (e) {
                      console.log(`     - ❌ 尺寸修复失败:`, (e as Error).message)
                    }
                    */
                  }
                } catch (e) {
                  console.log(`  ⚠️ [PIXEL DEBUG] 无法读取像素数据:`, (e as Error).message)
                }
              }
            }
            
            setTimeout(continuousRender, 100) // 每100ms渲染一次，持续1秒
          } catch (error) {
            console.error('❌ [RENDER DEBUG] 渲染失败:', error)
          }
        }
      }
      setTimeout(continuousRender, 100)
      
      // 🔧 [FIX] 确保渲染循环正在运行
      this.startRenderLoop()
      
    } catch (error) {
      console.error('❌ [FIX] 模型最终化失败:', error)
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
      console.log('🔧 [DEBUG] 设置模型事件监听器...')
      
      if (typeof (model as any).on === 'function') {
        console.log('✅ [DEBUG] 模型具有.on方法，开始绑定事件...')
        
        try {
          (model as any).on('motionStart', (group: string, index: number) => {
            console.log('🎬 [DEBUG] 动画开始:', { group, index })
            modelInstance.currentMotion = `${group}_${index}`
            this.emit(LoaderEvent.MOTION_START, { group, index, model: modelInstance })
          })

          // 使用类型断言来处理可能不存在的 on 方法
          if (typeof (model as any).on === 'function') {
            (model as any).on('motionFinish', () => {
              console.log('🎬 [DEBUG] 动画结束')
              modelInstance.currentMotion = undefined
              this.emit(LoaderEvent.MOTION_COMPLETE, { model: modelInstance })
            })
          }

          // 设置点击事件
          if (typeof (model as any).on === 'function') {
            (model as any).on('hit', (hitAreas: string[]) => {
              console.log('👆 [DEBUG] 模型被点击！点击区域:', hitAreas)
              this.handleModelHit(modelInstance, hitAreas)
            })
          }
          
          // 添加更多交互事件的调试
          if (typeof (model as any).on === 'function') {
            const modelWithEvents = model as any
            // 鼠标事件
            modelWithEvents.on('pointerdown', (event: any) => {
              console.log('👆 [DEBUG] 鼠标按下事件:', event)
              this.handleModelClick(event, model, modelInstance)
            })
            
            modelWithEvents.on('pointerup', (event: any) => {
              console.log('👆 [DEBUG] 鼠标释放事件:', event)
            })
            
            modelWithEvents.on('pointermove', (event: any) => {
              if (Math.random() < 0.01) { // 只记录1%的移动事件以避免日志过多
                console.log('👆 [DEBUG] 鼠标移动事件 (样本):', { x: event.x, y: event.y })
              }
            })
            
            modelWithEvents.on('pointerover', (event: any) => {
              console.log('👆 [DEBUG] 鼠标悬停事件:', event)
            })
            
            // 点击事件 - 这个更可靠
            modelWithEvents.on('tap', (event: any) => {
              console.log('👆 [DEBUG] 点击事件:', event)
              this.handleModelClick(event, model, modelInstance)
            })
          }
          
          console.log('✅ [DEBUG] 事件监听器绑定完成')
          
        } catch (error) {
          console.error('❌ [DEBUG] 绑定事件监听器时出错:', error)
        }
      } else {
        console.log('❌ [DEBUG] 模型没有.on方法，无法绑定事件！')
        console.log('🔧 [DEBUG] 模型可用方法:', Object.getOwnPropertyNames(model).filter(name => typeof (model as any)[name] === 'function'))
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
  private handleModelHit(modelInstance: any, hitAreas: string[]): void {
    console.log('🎯 [DEBUG] 模型被点击:', hitAreas)
    
    // 将区域名称标准化（转换为小写）
    const normalizedAreas = hitAreas.map(area => area.toLowerCase())
    console.log('🎯 [DEBUG] 标准化后的区域:', normalizedAreas)
    
    // 根据点击区域播放相应动画
    if (normalizedAreas.includes('head') || hitAreas.includes('Head')) {
      console.log('🎬 [DEBUG] 触发头部点击动画')
      // 尝试多种可能的头部动作名称
      this.tryPlayMotions(modelInstance, ['tap_head', 'TapHead', 'touch_head', 'head'])
    } else if (normalizedAreas.includes('body') || hitAreas.includes('Body')) {
      console.log('🎬 [DEBUG] 触发身体点击动画')
      // 尝试多种可能的身体动作名称
      this.tryPlayMotions(modelInstance, ['tap_body', 'TapBody', 'touch_body', 'body'])
    } else {
      console.log('🎬 [DEBUG] 触发通用点击动画')
      // 尝试多种可能的通用动作名称
      this.tryPlayMotions(modelInstance, ['tap', 'Tap', 'touch', 'idle'])
    }
  }

  /**
   * 尝试播放多种可能的动作名称
   */
  private tryPlayMotions(modelInstance: any, motionNames: string[]): void {
    console.log('🎬 [DEBUG] 尝试播放动作:', motionNames)
    
    for (const motionName of motionNames) {
      try {
        console.log('🎬 [DEBUG] 尝试播放动作:', motionName)
        
        // 使用新的播放方法
        this.playModelMotion(modelInstance, motionName, 0)
        
        // 如果成功，就不再尝试其他动作
        console.log('✅ [DEBUG] 成功播放动作:', motionName)
        return
      } catch (error) {
        console.warn('⚠️ [DEBUG] 播放动作失败:', motionName, error)
        continue
      }
    }
    
    console.warn('⚠️ [DEBUG] 所有动作都播放失败，播放默认动作')
    this.playModelMotion(modelInstance, 'idle', 0)
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
      // 从舞台移除（若App或Stage为空则跳过）
      try {
        if (this.app && this.app.stage && modelInstance.model) {
          try {
            this.app.stage.removeChild(modelInstance.model as any)
          } catch {}
        }
      } catch {}
      
      // 销毁模型
      try {
        if (modelInstance.model && typeof (modelInstance.model as any).destroy === 'function') {
          (modelInstance.model as any).destroy()
        }
      } catch {}
      
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
      (this.currentModel.model as any).visible = false
    }

    // 显示目标模型
    (modelInstance.model as any).visible = true
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
    this.applyRenderConfig(modelInstance.model, modelInstance.renderConfig, modelId)
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
   * 更新模型位置
   */
  updateModelPosition(modelId: string, x: number, y: number): void {
    const modelInstance = this.loadedModels.get(modelId)
    if (!modelInstance || !modelInstance.model) {
      return
    }

    (modelInstance.model as any).position.set(x, y)
    modelInstance.renderConfig.position = { x, y }
    
    // 标记用户已手动调整位置
    modelInstance.userAdjustedPosition = true
    
    // 强制渲染
    if (this.app && this.app.renderer && this.app.stage) {
      this.app.renderer.render(this.app.stage)
    }
  }

  /**
   * 更新模型缩放
   */
  updateModelScale(modelId: string, scale: number): void {
    const modelInstance = this.loadedModels.get(modelId)
    if (!modelInstance || !modelInstance.model) return

    // 限制缩放范围
    let clampedScale: number = scale
    if (clampedScale < 0.1) clampedScale = 0.1
    if (clampedScale > 5.0) clampedScale = 5.0
    
    const modelScale = modelInstance.model as any
    modelScale.scale.set(clampedScale)
    modelInstance.renderConfig.scale = clampedScale
    
    // 标记用户已手动调整缩放
    modelInstance.userAdjustedScale = true
    
    // 强制渲染
    if (this.app && this.app.renderer && this.app.stage) {
      this.app.renderer.render(this.app.stage)
    }
  }

  /**
   * 获取模型当前位置和缩放
   */
  getModelTransform(modelId: string): { x: number, y: number, scale: number } | null {
    const modelInstance = this.loadedModels.get(modelId)
    if (!modelInstance || !modelInstance.model) {
      return null
    }

    const model = modelInstance.model

    // 尝试从不同的地方获取缩放值
    let scaleValue = modelInstance.renderConfig?.scale
    if (scaleValue === undefined && (model as any).scale) {
      if (typeof (model as any).scale === 'number') {
        scaleValue = (model as any).scale
      } else if (typeof (model as any).scale.x === 'number') {
        scaleValue = (model as any).scale.x
      }
    }

    if (scaleValue === undefined) {
      console.warn('⚠️ [DEBUG] 无法获取缩放值，使用默认值 1.0')
      scaleValue = 1.0
    }

    return {
      x: (model as any).position?.x || 0,
      y: (model as any).position?.y || 0,
      scale: scaleValue
    }
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
      if (gl && !this.sharedGLContext) {
        this.sharedGLContext = gl
      }
      if (!gl) {
        console.warn('⚠️ WebGL 上下文未找到，应用默认着色器配置')
        this.applyDefaultShaderConfiguration(renderer)
        return
      }

      // 检查WebGL上下文是否有效
      if (gl.isContextLost && gl.isContextLost()) {
        console.warn('⚠️ WebGL上下文已丢失，应用默认着色器配置')
        this.applyDefaultShaderConfiguration(renderer)
        return
      }

      // 安全地获取WebGL参数，提供默认值
      let maxFragmentUniforms = 1024
      let maxVertexUniforms = 4096
      
      try {
        const fragUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS)
        const vertUniforms = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)
        
        // 确保参数有效
        if (fragUniforms && fragUniforms > 0) {
          maxFragmentUniforms = fragUniforms
        }
        if (vertUniforms && vertUniforms > 0) {
          maxVertexUniforms = vertUniforms
        }
      } catch (error) {
        console.warn('⚠️ 无法读取WebGL参数，使用默认值:', error)
      }
      
      console.log(`🔧 WebGL 参数: MAX_FRAGMENT_UNIFORM_VECTORS=${maxFragmentUniforms}, MAX_VERTEX_UNIFORM_VECTORS=${maxVertexUniforms}`)

      // 修复 BatchRenderer 配置
      if (renderer.batch) {
        const batchRenderer = renderer.batch
        
        // 计算安全的 maxIfStatementsInShader 值 (更保守的计算方式)
        const safeMaxIfStatements = Math.min(100, Math.max(32, Math.floor(maxFragmentUniforms / 8)))
        
        // 设置或修复 maxIfStatementsInShader
        if (!batchRenderer.maxIfStatementsInShader || batchRenderer.maxIfStatementsInShader <= 0) {
          batchRenderer.maxIfStatementsInShader = safeMaxIfStatements
          console.log(`🔧 修复 BatchRenderer maxIfStatementsInShader: ${batchRenderer.maxIfStatementsInShader}`)
        } else {
          console.log(`✅ BatchRenderer maxIfStatementsInShader 已设置: ${batchRenderer.maxIfStatementsInShader}`)
        }
      } else {
        console.warn('⚠️ 渲染器没有batch属性，跳过BatchRenderer配置')
      }

      console.log('✅ PixiJS 着色器配置修复完成')
    } catch (error) {
      console.error('❌ 修复着色器配置时出错:', error)
      // 作为备选方案，应用默认配置
      try {
        this.applyDefaultShaderConfiguration(this.app.renderer as any)
      } catch (fallbackError) {
        console.error('❌ 应用默认着色器配置也失败:', fallbackError)
      }
    }
  }

  /**
   * 应用默认着色器配置（用于WebGL上下文丢失或出错时）
   */
  private applyDefaultShaderConfiguration(renderer: any): void {
    try {
      if (renderer && renderer.batch) {
        const batchRenderer = renderer.batch
        
        // 设置保守的默认值
        if (!batchRenderer.maxIfStatementsInShader || batchRenderer.maxIfStatementsInShader <= 0) {
          batchRenderer.maxIfStatementsInShader = 50 // 保守的默认值
          console.log(`🔧 应用默认 BatchRenderer maxIfStatementsInShader: ${batchRenderer.maxIfStatementsInShader}`)
        }
      }
      console.log('✅ 默认着色器配置应用完成')
    } catch (error) {
      console.error('❌ 应用默认着色器配置失败:', error)
    }
  }

  /**
   * 检查WebGL支持情况
   */
  private checkWebGLSupport(): any {
    const testCanvas = document.createElement('canvas')
    testCanvas.width = 1
    testCanvas.height = 1
    
    const support = {
      webgl1: false,
      webgl2: false,
      webgl1Info: null as any,
      webgl2Info: null as any,
      issues: [] as string[]
    }
    
    // 使用原生的 getContext 方法，避免被我们的修复逻辑干扰
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    
    // 测试WebGL2
    try {
      const webgl2Context = originalGetContext.call(testCanvas, 'webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false
      }) as WebGL2RenderingContext | null
      if (webgl2Context && webgl2Context instanceof WebGL2RenderingContext) {
        support.webgl2 = true
        support.webgl2Info = {
          version: webgl2Context.getParameter(webgl2Context.VERSION),
          vendor: webgl2Context.getParameter(webgl2Context.VENDOR),
          renderer: webgl2Context.getParameter(webgl2Context.RENDERER),
          hasGetInternalformatParameter: typeof webgl2Context.getInternalformatParameter === 'function'
        }
        
        if (!support.webgl2Info.hasGetInternalformatParameter) {
          support.issues.push('WebGL2缺少getInternalformatParameter方法')
        }
        
        // 清理
        const loseContext = webgl2Context.getExtension('WEBGL_lose_context')
        if (loseContext) loseContext.loseContext()
      }
    } catch (error) {
      support.issues.push(`WebGL2测试失败: ${error}`)
    }
    
    // 测试WebGL1 - 尝试多种配置（限制输出）
    const webgl1Configs = [
      {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false
      },
      {
        alpha: true,
        antialias: false,
        depth: true,
        stencil: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: false
      },
      {} // 默认配置
    ]
    
    for (const config of webgl1Configs) {
      try {
        const webglContext = originalGetContext.call(testCanvas, 'webgl', config) as WebGLRenderingContext | null
        if (webglContext && webglContext instanceof WebGLRenderingContext) {
          support.webgl1 = true
          support.webgl1Info = {
            version: webglContext.getParameter(webglContext.VERSION),
            vendor: webglContext.getParameter(webglContext.VENDOR),
            renderer: webglContext.getParameter(webglContext.RENDERER),
            config: config
          }
          
          // 清理
          const loseContext = webglContext.getExtension('WEBGL_lose_context')
          if (loseContext) loseContext.loseContext()
          break // 成功获取WebGL1上下文，退出循环
        }
      } catch (error) {
        support.issues.push(`WebGL1配置${JSON.stringify(config)}测试失败: ${error}`)
      }
    }
    
    testCanvas.remove()
    return support
  }

  /**
   * 检查WebGL可用性
   */
  private checkWebGLAvailability(): void {
    try {
      console.log('🔍 检查WebGL可用性...')
      
      const support = this.checkWebGLSupport()
      console.log('🔧 [DEBUG] WebGL支持情况:', support)
      
      if (support.webgl2) {
        console.log('✅ WebGL2 可用')
        console.log('🔧 WebGL2 信息:', support.webgl2Info)
        
        if (support.issues.length > 0) {
          console.warn('⚠️ WebGL2 存在问题:', support.issues)
        }
      } else {
        console.warn('⚠️ WebGL2 不可用')
      }
      
      if (support.webgl1) {
        console.log('✅ WebGL1 可用')
        console.log('🔧 WebGL1 信息:', support.webgl1Info)
      } else {
        // 降级情况下 WebGL1 不可用会导致大量 fallback 重试日志，降为 warn 并避免重复输出
        console.warn('❌ WebGL1 不可用')
      }
      
      if (!support.webgl1 && !support.webgl2) {
        console.error('❌ 没有可用的WebGL支持!')
      }
      
    } catch (error) {
      console.error('❌ WebGL可用性检查失败:', error)
    }
  }

  /**
   * 强制清理所有可能存在的WebGL上下文
   */
  private forceCleanupWebGLContexts(): void {
    try {
      console.log('🧹 强制清理WebGL上下文...')
      // 强制垃圾收集WebGL资源
      if (typeof window !== 'undefined' && (window as any).gc) {
        (window as any).gc()
      }
      // 获取canvas的WebGL上下文并强制丢失（避免创建新上下文：使用原生getContext）
      const nativeGetContext = this.originalCanvasGetContext || HTMLCanvasElement.prototype.getContext
      const gl = (nativeGetContext.call(this.canvas, 'webgl') as (any)) || (nativeGetContext.call(this.canvas, 'webgl2') as (any))
      if (gl && typeof gl.getExtension === 'function') {
        const loseContext = gl.getExtension('WEBGL_lose_context')
        if (loseContext) {
          console.log('🔧 强制丢失WebGL上下文')
          loseContext.loseContext()
        }
      }
      console.log('✅ WebGL上下文清理完成')
    } catch (error) {
      console.warn('⚠️ 强制清理WebGL上下文时出现警告:', error)
    }
  }

  /**
   * 预配置PixiJS全局设置（在Application创建前）
   */
  private preConfigurePixiJS(): void {
    try {
      // 尝试获取并配置全局PIXI对象
      const PIXI = (window as any).PIXI || (globalThis as any).PIXI
      
      if (PIXI && PIXI.BatchRenderer) {
        // 设置BatchRenderer的默认配置
        const BatchRenderer = PIXI.BatchRenderer
        if (BatchRenderer.prototype) {
          // 确保默认的maxIfStatementsInShader值不为0
          const originalInit = BatchRenderer.prototype.contextChange
          if (originalInit) {
            BatchRenderer.prototype.contextChange = function(gl: any) {
              try {
                const result = originalInit.call(this, gl)
                // 确保maxIfStatementsInShader有效
                if (!this.maxIfStatementsInShader || this.maxIfStatementsInShader <= 0) {
                  this.maxIfStatementsInShader = 50
                  console.log('🔧 预设BatchRenderer maxIfStatementsInShader:', this.maxIfStatementsInShader)
                }
                return result
              } catch (error) {
                console.warn('⚠️ BatchRenderer contextChange预配置出错:', error)
                // 设置安全默认值
                this.maxIfStatementsInShader = 50
                throw error
              }
            }
          }
        }
        console.log('✅ PixiJS BatchRenderer 预配置完成')
        
        // 如果Renderer存在，尽可能在这里绑定共享GL上下文
        try {
          if ((PIXI as any).Renderer && this.sharedGLContext) {
            const proto = (PIXI as any).Renderer.prototype
            const originalContextSystem = proto?.context
            if (originalContextSystem && !originalContextSystem._sharedPatched) {
              const originalInit = originalContextSystem.init
              if (typeof originalInit === 'function') {
                originalContextSystem.init = function(...args: any[]) {
                  try {
                    // 如果提供了已有GL上下文，则使用
                    if (this.renderer && this.renderer.options && (this.renderer.options as any).context) {
                      this.gl = (this.renderer.options as any).context
                    }
                  } catch {}
                  return originalInit.apply(this, args)
                }
                originalContextSystem._sharedPatched = true
              }
            }
          }
        } catch {}
      } else {
        console.warn('⚠️ 全局PIXI对象不可用，跳过预配置')
      }
    } catch (error) {
      console.warn('⚠️ PixiJS预配置失败:', error)
    }
  }

  /**
   * 设置WebGL上下文恢复机制
   */
  private setupWebGLRecovery(): void {
    try {
      if (!this.app || !this.canvas) {
        console.warn('⚠️ App或canvas为空，跳过WebGL恢复设置')
        return
      }

      if (this.contextRecoverySetup) {
        console.log('⏭️ WebGL上下文恢复机制已设置，跳过')
        return
      }

      console.log('🔧 设置WebGL上下文恢复机制...')

      // 监听WebGL上下文丢失事件
      this.canvas.addEventListener('webglcontextlost', (event: Event) => {
        console.warn('⚠️ WebGL上下文丢失，阻止默认行为')
        event.preventDefault()
        this.isWebGLContextLost = true
        console.log('🔧 WebGL上下文状态已更新:', this.isWebGLContextLost)
      })

      // 监听WebGL上下文恢复事件
      this.canvas.addEventListener('webglcontextrestored', () => {
        console.log('✅ WebGL上下文已恢复，开始重新初始化...')
        this.isWebGLContextLost = false
        console.log('🔧 WebGL上下文状态已更新:', this.isWebGLContextLost)
        // 恢复时确保共享上下文绑定到 renderer
        try {
          const gl = (this.app.renderer as any)?.gl
          if (gl) this.sharedGLContext = gl
        } catch {}
        this.recoverFromContextLoss()
      })

      this.contextRecoverySetup = true
      console.log('✅ WebGL上下文恢复机制设置完成')
    } catch (error) {
      console.error('❌ 设置WebGL上下文恢复机制失败:', error)
    }
  }

  /**
   * 重新创建WebGL上下文（终极修复方案）
   */
  private recreateWebGLContext(): void {
    try {
      if (this.isDestroyed || this.isRecreationInProgress) {
        console.log('⏭️ [ULTIMATE FIX] 跳过：Loader已销毁或正在重建')
        return
      }
      this.isRecreationInProgress = true
      console.log('🔄 [ULTIMATE FIX] 开始重新创建WebGL上下文...')
      
      if (!this.app || !this.canvas) {
        console.error('❌ [ULTIMATE FIX] App或Canvas不存在')
        return
      }
      
      // 保存当前模型状态
      const currentModelData = this.currentModel
      const currentStageChildren = this.app.stage.children.slice() // 复制数组
      
      console.log('💾 [ULTIMATE FIX] 保存当前状态:', {
        hasModel: !!currentModelData,
        stageChildren: currentStageChildren.length
      })
      
      // 清理当前渲染器
      console.log('🧹 [ULTIMATE FIX] 清理当前渲染器...')
      try {
        // 停止渲染循环
        if (this.app && this.app.ticker) {
          this.app.ticker.stop()
          console.log('⏸️ [ULTIMATE FIX] 渲染循环已停止')
        }
        
        // 移除所有stage子元素
        if (this.app && this.app.stage) {
          this.app.stage.removeChildren()
        }
        
        // 强制丢失当前WebGL上下文（在销毁渲染器之前）
        const gl = this.canvas.getContext('webgl') || this.canvas.getContext('webgl2')
        if (gl) {
          const loseContext = gl.getExtension('WEBGL_lose_context')
          if (loseContext) {
            loseContext.loseContext()
            console.log('🔥 [ULTIMATE FIX] 强制丢失WebGL上下文')
          }
        }
        
        // 销毁当前应用（这会自动销毁渲染器）
        if (this.app) {
          this.app.destroy(true, {
            children: true,
            texture: false, // 保留纹理
            baseTexture: false // 保留基础纹理
          })
          console.log('🗑️ [ULTIMATE FIX] PixiJS应用已销毁')
        }
        
      } catch (e) {
        console.warn('⚠️ [ULTIMATE FIX] 清理过程中的警告:', e)
      }
      
      // 等待一段时间让上下文完全释放
      setTimeout(() => {
        this.performWebGLRecreation(currentStageChildren)
          .finally(() => {
            this.isRecreationInProgress = false
          })
      }, 300) // 增加等待时间
      
    } catch (error) {
      console.error('❌ [ULTIMATE FIX] 重新创建WebGL上下文失败:', error)
      this.isRecreationInProgress = false
    }
  }
  
  /**
   * 执行WebGL上下文重新创建
   */
  private async performWebGLRecreation(previousChildren: any[]): Promise<void> {
    try {
      console.log('🔧 [ULTIMATE FIX] 开始重新创建PixiJS应用...')
      
      // 创建全新的Canvas元素而不是重用旧的
      const newCanvas = document.createElement('canvas')
      
      // 🔧 [CRITICAL FIX] 确保Canvas尺寸正确设置
      newCanvas.width = 400
      newCanvas.height = 600
      newCanvas.style.width = '400px'
      newCanvas.style.height = '600px'
      newCanvas.style.display = 'block'
      
      // 🔧 [CRITICAL FIX] 强制设置Canvas的内部属性
      Object.defineProperty(newCanvas, 'clientWidth', {
        get: () => 400,
        configurable: true
      })
      Object.defineProperty(newCanvas, 'clientHeight', {
        get: () => 600,
        configurable: true
      })
      
      // 🔧 [CRITICAL FIX] 确保Canvas在DOM中有正确的尺寸
      newCanvas.setAttribute('width', '400')
      newCanvas.setAttribute('height', '600')
      
      // 替换旧的Canvas
      if (this.canvas && this.canvas.parentNode) {
        // 🔧 [CRITICAL FIX] 保持父元素的样式
        const parentElement = this.canvas.parentNode as HTMLElement
        parentElement.replaceChild(newCanvas, this.canvas)
        
        // 🔧 [CRITICAL FIX] 确保新Canvas继承正确的样式
        newCanvas.style.position = 'relative'
        newCanvas.style.maxWidth = '100%'
        newCanvas.style.maxHeight = '100%'
      }
      this.canvas = newCanvas
      console.log('🆕 [ULTIMATE FIX] 全新Canvas元素已创建: 400x600')
      console.log(`🔍 [ULTIMATE FIX] Canvas客户端尺寸: ${newCanvas.clientWidth}x${newCanvas.clientHeight}`)
      
      // 🔧 [CRITICAL FIX] 等待上下文完全释放和DOM准备
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // 🔧 [CRITICAL FIX] 确保Canvas在DOM中有正确的尺寸
      if (this.canvas.parentNode) {
        const parentElement = this.canvas.parentNode as HTMLElement
        
        // 强制父元素有明确的尺寸
        if (!parentElement.style.width || parentElement.style.width === '0px') {
          parentElement.style.width = '400px'
        }
        if (!parentElement.style.height || parentElement.style.height === '0px') {
          parentElement.style.height = '600px'
        }
        
        // 确保父元素可见
        parentElement.style.display = parentElement.style.display || 'block'
        parentElement.style.visibility = 'visible'
        parentElement.style.opacity = '1'
        
        console.log(`🔧 [ULTIMATE FIX] 父元素尺寸: ${parentElement.offsetWidth}x${parentElement.offsetHeight}`)
      }
      
      // 再次等待DOM更新
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 🔧 [CRITICAL FIX] 在创建PixiJS应用前先验证WebGL上下文
      console.log('🔍 [ULTIMATE FIX] 验证WebGL上下文创建...')
      const testGl = this.canvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      }) || this.canvas.getContext('webgl', {
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      })
      
      if (testGl) {
        console.log(`🔍 [ULTIMATE FIX] WebGL上下文创建成功，DrawingBuffer: ${testGl.drawingBufferWidth}x${testGl.drawingBufferHeight}`)
        
        // 🔧 [CRITICAL FIX] 如果DrawingBuffer尺寸仍然异常，强制设置viewport
        if (testGl.drawingBufferWidth !== 400 || testGl.drawingBufferHeight !== 600) {
          console.log('🔧 [ULTIMATE FIX] DrawingBuffer尺寸异常，强制设置viewport...')
          testGl.viewport(0, 0, 400, 600)
          
          // 尝试强制重新设置Canvas尺寸
          this.canvas.width = 400
          this.canvas.height = 600
          console.log(`🔧 [ULTIMATE FIX] 重新设置后DrawingBuffer: ${testGl.drawingBufferWidth}x${testGl.drawingBufferHeight}`)
        }
      } else {
        console.error('❌ [ULTIMATE FIX] 无法创建WebGL上下文')
        
        // 🔧 [CRITICAL FIX] 尝试不同的Canvas创建策略
        console.log('🔧 [ULTIMATE FIX] 尝试不同的Canvas创建策略...')
        
        // 策略1: 使用离屏Canvas
        const offscreenCanvas = document.createElement('canvas')
        offscreenCanvas.width = 400
        offscreenCanvas.height = 600
        
        // 🔧 [CRITICAL FIX] 尝试多种Canvas创建策略
        const strategies = [
          // 策略1: 标准离屏Canvas
          () => {
            const canvas = document.createElement('canvas')
            canvas.width = 400
            canvas.height = 600
            return canvas
          },
          // 策略2: 强制设置样式的Canvas
          () => {
            const canvas = document.createElement('canvas')
            canvas.width = 400
            canvas.height = 600
            canvas.style.width = '400px'
            canvas.style.height = '600px'
            canvas.style.display = 'block'
            return canvas
          },
          // 策略3: 添加到DOM后再获取上下文
          () => {
            const canvas = document.createElement('canvas')
            canvas.width = 400
            canvas.height = 600
            canvas.style.width = '400px'
            canvas.style.height = '600px'
            canvas.style.position = 'absolute'
            canvas.style.left = '-9999px'
            document.body.appendChild(canvas)
            return canvas
          }
        ]
        
        let successfulCanvas = null
        let successfulGl = null
        
        for (let i = 0; i < strategies.length; i++) {
          try {
            console.log(`🔧 [ULTIMATE FIX] 尝试Canvas创建策略 ${i + 1}...`)
            const testCanvas = strategies[i]()
            
            // 等待DOM更新
            await new Promise(resolve => setTimeout(resolve, 100))
            
            const testGl = testCanvas.getContext('webgl2', {
              alpha: true,
              antialias: true,
              preserveDrawingBuffer: false,
              powerPreference: 'high-performance'
            }) || testCanvas.getContext('webgl', {
              alpha: true,
              antialias: true,
              preserveDrawingBuffer: false,
              powerPreference: 'high-performance'
            })
            
            if (testGl) {
              console.log(`🔍 [ULTIMATE FIX] 策略${i + 1} WebGL上下文: ${testGl.drawingBufferWidth}x${testGl.drawingBufferHeight}`)
              
              // 检查DrawingBuffer是否有效
              if (testGl.drawingBufferWidth > 0 && testGl.drawingBufferHeight > 0) {
                console.log(`✅ [ULTIMATE FIX] 策略${i + 1}成功！DrawingBuffer: ${testGl.drawingBufferWidth}x${testGl.drawingBufferHeight}`)
                successfulCanvas = testCanvas
                successfulGl = testGl
                break
              }
            }
            
            // 清理失败的Canvas
            if (testCanvas.parentNode) {
              testCanvas.parentNode.removeChild(testCanvas)
            }
            
          } catch (error) {
            console.error(`❌ [ULTIMATE FIX] 策略${i + 1}失败:`, error)
          }
        }
        
        if (successfulCanvas && successfulGl) {
          console.log('✅ [ULTIMATE FIX] 找到有效的Canvas创建策略')
          
          // 如果Canvas在body中，先移除
          if (successfulCanvas.parentNode === document.body) {
            document.body.removeChild(successfulCanvas)
            successfulCanvas.style.position = 'relative'
            successfulCanvas.style.left = 'auto'
          }
          
          // 替换当前Canvas
          if (this.canvas.parentNode) {
            this.canvas.parentNode.replaceChild(successfulCanvas, this.canvas)
          }
          this.canvas = successfulCanvas
          
          console.log(`✅ [ULTIMATE FIX] Canvas替换成功，DrawingBuffer: ${successfulGl.drawingBufferWidth}x${successfulGl.drawingBufferHeight}`)
        } else {
          console.error('❌ [ULTIMATE FIX] 所有Canvas创建策略都失败')
          throw new Error('WebGL上下文创建失败')
        }
      }
      
      // 创建全新的PixiJS应用
      const newApp = new Application({
        view: this.canvas,
        width: 400,
        height: 600,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
        antialias: true,
        resolution: 1, // 🔧 [CRITICAL FIX] 固定分辨率为1避免尺寸问题
        autoDensity: false, // 🔧 [CRITICAL FIX] 禁用自动密度
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
        forceCanvas: false // 确保使用WebGL
      })
      
      console.log('✅ [ULTIMATE FIX] 新的PixiJS应用创建成功')
      
      // 验证新的WebGL上下文
      const newGl = (newApp.renderer as any).gl
      if (newGl) {
        console.log('🔍 [ULTIMATE FIX] 新WebGL上下文验证:', {
          drawingBufferWidth: newGl.drawingBufferWidth,
          drawingBufferHeight: newGl.drawingBufferHeight,
          contextLost: newGl.isContextLost()
        })
        
        if (newGl.drawingBufferWidth > 1 && newGl.drawingBufferHeight > 1) {
          console.log('🎉 [ULTIMATE FIX] ✅ 新WebGL上下文尺寸正常！')
          
          // 替换应用实例
          this.app = newApp
          this.sharedGLContext = newGl
          
          // 重新添加渲染回调
          this.renderLoopAdded = false
          this.startRenderLoop()
          
          // 恢复模型到新的stage
          if (previousChildren.length > 0) {
            console.log('🔄 [ULTIMATE FIX] 恢复模型到新stage...')
            for (const child of previousChildren) {
              if (child && !child.destroyed && child.parent !== this.app.stage) {
                try {
                  this.app.stage.addChild(child)
                  console.log('✅ [ULTIMATE FIX] 模型已恢复到新stage')
                } catch (e) {
                  console.warn('⚠️ [ULTIMATE FIX] 恢复模型时出现警告:', e)
                }
              }
            }
          }
          
          // 强制渲染几次确保显示
          for (let i = 0; i < 5; i++) {
            try {
              this.app.renderer.render(this.app.stage)
              console.log(`✅ [ULTIMATE FIX] 第${i + 1}次强制渲染完成`)
            } catch (e) {
              console.warn(`⚠️ [ULTIMATE FIX] 第${i + 1}次渲染失败:`, e)
            }
          }
          
          // 最终验证
          const finalGl = (this.app.renderer as any).gl
          if (finalGl) {
            console.log('🏁 [ULTIMATE FIX] 最终验证:', {
              drawingBufferWidth: finalGl.drawingBufferWidth,
              drawingBufferHeight: finalGl.drawingBufferHeight,
              stageChildren: this.app.stage.children.length
            })
            
            // 检查像素内容
            try {
              const testPixels = new Uint8Array(4)
              const centerX = Math.floor(finalGl.drawingBufferWidth / 2)
              const centerY = Math.floor(finalGl.drawingBufferHeight / 2)
              finalGl.readPixels(centerX, centerY, 1, 1, finalGl.RGBA, finalGl.UNSIGNED_BYTE, testPixels)
              const hasContent = testPixels[3] > 0
              
              if (hasContent) {
                console.log('🎉🎉🎉 [ULTIMATE FIX] 🎉🎉🎉')
                console.log('🎉 Live2D模型渲染终极修复成功！！！')
                console.log('🎉🎉🎉 [ULTIMATE FIX] 🎉🎉🎉')
              } else {
                console.log('⚠️ [ULTIMATE FIX] 像素检查仍然为空，但DrawingBuffer尺寸已修复')
              }
            } catch (e) {
              console.log('⚠️ [ULTIMATE FIX] 像素检查失败，但继续:', e)
            }
          }
          
        } else {
          console.error('❌ [ULTIMATE FIX] 新WebGL上下文尺寸仍然异常')
          
          // 尝试使用Canvas 2D作为后备方案
          console.log('🎨 [ULTIMATE FIX] 尝试Canvas 2D后备方案...')
          try {
            // 创建全新的Canvas元素
            const newCanvas = document.createElement('canvas')
            
            // 🔧 [CRITICAL FIX] 确保Canvas 2D尺寸正确设置
            newCanvas.width = 400
            newCanvas.height = 600
            newCanvas.style.width = '400px'
            newCanvas.style.height = '600px'
            newCanvas.style.display = 'block'
            
            // 🔧 [CRITICAL FIX] 强制设置Canvas的内部属性
            Object.defineProperty(newCanvas, 'clientWidth', {
              get: () => 400,
              configurable: true
            })
            Object.defineProperty(newCanvas, 'clientHeight', {
              get: () => 600,
              configurable: true
            })
            
            // 🔧 [CRITICAL FIX] 确保Canvas在DOM中有正确的尺寸
            newCanvas.setAttribute('width', '400')
            newCanvas.setAttribute('height', '600')
            
            // 替换旧的Canvas
            if (this.canvas && this.canvas.parentNode) {
              const parentElement = this.canvas.parentNode as HTMLElement
              parentElement.replaceChild(newCanvas, this.canvas)
              
              // 确保新Canvas继承正确的样式
              newCanvas.style.position = 'relative'
              newCanvas.style.maxWidth = '100%'
              newCanvas.style.maxHeight = '100%'
            }
            this.canvas = newCanvas
            
            console.log('🆕 [ULTIMATE FIX] 新Canvas元素已创建并替换')
            console.log(`🔍 [ULTIMATE FIX] Canvas 2D客户端尺寸: ${newCanvas.clientWidth}x${newCanvas.clientHeight}`)
            
            // 🔧 [CRITICAL FIX] 验证Canvas 2D上下文
            const test2D = this.canvas.getContext('2d')
            if (test2D) {
              console.log('✅ [ULTIMATE FIX] Canvas 2D上下文创建成功')
            } else {
              throw new Error('无法创建Canvas 2D上下文')
            }
            
            // 🔧 [CRITICAL FIX] 尝试创建Canvas 2D应用
            let canvas2DApp
            try {
              canvas2DApp = new Application({
                view: this.canvas,
                width: 400,
                height: 600,
                backgroundColor: 0x000000,
                backgroundAlpha: 0,
                forceCanvas: true, // 强制使用Canvas 2D
                resolution: 1,
                autoDensity: false,
                antialias: false, // Canvas 2D不需要抗锯齿
                powerPreference: 'default'
              })
              
              // 验证Canvas 2D应用是否创建成功
              if (!canvas2DApp || !canvas2DApp.renderer) {
                throw new Error('Canvas 2D应用创建失败')
              }
              
              console.log('✅ [ULTIMATE FIX] Canvas 2D应用创建成功')
              console.log(`🔍 [ULTIMATE FIX] Canvas 2D渲染器类型: ${canvas2DApp.renderer.type}`)
              
            } catch (canvas2DError) {
              console.error('❌ [ULTIMATE FIX] Canvas 2D应用创建失败:', canvas2DError)
              throw canvas2DError
            }
            
            console.log('✅ [ULTIMATE FIX] Canvas 2D应用创建成功')
            this.app = canvas2DApp
            this.renderLoopAdded = false
            this.startRenderLoop()
            
            // 恢复模型
            if (previousChildren.length > 0) {
              for (const child of previousChildren) {
                if (child && !child.destroyed) {
                  try {
                    this.app.stage.addChild(child)
                    console.log('✅ [ULTIMATE FIX] 模型已恢复到Canvas 2D')
                  } catch (e) {
                    console.warn('⚠️ [ULTIMATE FIX] Canvas 2D恢复警告:', e)
                  }
                }
              }
            }
            
          } catch (canvas2DError) {
            console.error('❌ [ULTIMATE FIX] Canvas 2D后备方案也失败:', canvas2DError)
            
            // 最后的后备方案：重新加载页面
            console.log('🔄 [ULTIMATE FIX] 所有修复方案都失败，建议刷新页面')
            
            // 显示用户友好的错误信息
            if (typeof window !== 'undefined' && window.alert) {
              setTimeout(() => {
                window.alert('Live2D渲染遇到问题，请刷新页面重试。\n\nLive2D rendering encountered an issue, please refresh the page.')
              }, 1000)
            }
          }
        }
      } else {
        console.error('❌ [ULTIMATE FIX] 无法获取新WebGL上下文')
      }
      
    } catch (error) {
      console.error('❌ [ULTIMATE FIX] 执行WebGL重新创建失败:', error)
    }
  }

  /**
   * 从WebGL上下文丢失中恢复
   */
  private async recoverFromContextLoss(): Promise<void> {
    try {
      if (this.isRecreationInProgress) {
        console.log('⏭️ [RECOVERY] 跳过：正在进行重建流程')
        return
      }
      console.log('🔄 开始从WebGL上下文丢失中恢复...')
      
      // 如果是DrawingBuffer尺寸问题导致的恢复，直接使用终极修复
      if (this.isWebGLContextLost === false) {
        console.log('🚨 检测到DrawingBuffer问题，使用终极修复方案')
        this.recreateWebGLContext()
        return
      }
      
      // 等待一小段时间让上下文稳定
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // 保存当前模型路径
      const modelPathToReload = this.currentModelPath
      
      // 清理现有资源
      if (this.currentModel) {
        console.log('🔧 清理现有模型资源...')
        try {
          if (this.app && this.app.stage && (this.currentModel as any).parent) {
            this.app.stage.removeChild(this.currentModel as any)
          }
          if (typeof (this.currentModel as any).destroy === 'function') {
            (this.currentModel as any).destroy()
          }
        } catch (e) {
          console.warn('⚠️ 清理模型资源时出现警告:', e)
        }
        this.currentModel = null
      }
      
      // 完全重新创建PixiJS应用
      if (this.app) {
        console.log('🔧 完全重建PixiJS应用...')
        try {
          this.app.destroy(true, { 
            children: true, 
            texture: true, 
            baseTexture: true
          })
        } catch (e) {
          console.warn('⚠️ 销毁PixiJS应用时出现警告:', e)
        }
        this.app = null as any
      }
      
      // 重新创建PixiJS应用（不包括完整初始化，避免递归）
      console.log('🔧 重新创建PixiJS应用...')
      
      // 创建新的PixiJS应用
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
        powerPreference: 'high-performance'
      })
      
      console.log('✅ PixiJS Application 重新创建完成')
      
      // 等待PixiJS完全初始化
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // 如果有模型路径，重新加载模型
      if (modelPathToReload) {
        console.log('🔄 重新加载模型:', modelPathToReload)
        
        const modelConfig: Live2DModelConfig = {
          id: `recovery_${Date.now()}`,
          name: 'Recovery Model', 
          modelPath: modelPathToReload
        }
        
        await this.loadModel(modelConfig)
        
        // 验证hitTest功能
        if (this.currentModel && typeof (this.currentModel as any).hitTest === 'function') {
          console.log('✅ hitTest功能已恢复')
          // 测试hitTest
          try {
            const testResult = (this.currentModel as any).hitTest(100, 100)
            console.log('🔧 hitTest测试结果:', testResult)
          } catch (e) {
            console.warn('⚠️ hitTest测试失败:', e)
          }
        } else {
          console.warn('⚠️ hitTest功能未正确恢复')
        }
      }
      
      console.log('✅ WebGL上下文恢复完成')
    } catch (error) {
      console.error('❌ WebGL上下文恢复失败:', error)
    }
  }

  /**
   * 处理模型点击事件
   */
  private handleModelClick(event: any, model: any, modelInstance: any): void {
    try {
      console.log('🎯 [DEBUG] 处理模型点击事件...')
      console.log('📍 [DEBUG] 事件对象:', event)
      console.log('📍 [DEBUG] 模型对象类型:', typeof model)
      console.log('📍 [DEBUG] 模型实例:', typeof modelInstance)
      
      // 🔧 [FIX] 只处理左键点击，忽略右键和中键
      // 检查 event.data.button 或 event.button
      const button = event?.data?.button ?? event?.button
      if (button !== undefined && button !== 0) {
        console.log('🖱️ [DEBUG] 忽略非左键点击，button =', button)
        return
      }
      
      // 获取点击坐标
      let x = 0, y = 0
      
      if (event && event.data && event.data.global) {
        x = event.data.global.x
        y = event.data.global.y
      } else if (event && typeof event.x === 'number' && typeof event.y === 'number') {
        x = event.x
        y = event.y
      } else if (event && event.clientX && event.clientY) {
        x = event.clientX
        y = event.clientY
      } else {
        console.warn('⚠️ 无法获取点击坐标，事件数据:', event)
        return
      }
      
      console.log('📍 [DEBUG] 点击坐标:', { x, y })
      
      // 尝试hit test检测
      this.performHitTest(model, x, y, modelInstance)
      
    } catch (error) {
      console.error('❌ 处理模型点击事件失败:', error)
    }
  }

  /**
   * 执行点击区域检测
   */
  private performHitTest(model: any, x: number, y: number, modelInstance: any): void {
    try {
      console.log('🔍 [DEBUG] 执行点击区域检测...', { x, y })
      
      let hitAreas: string[] = []
      
      // 尝试不同的hit test方法
      if (model && typeof model.hitTest === 'function') {
        console.log('🔍 [DEBUG] 使用model.hitTest方法')
        const result = model.hitTest(x, y)
        console.log('🔍 [DEBUG] hitTest结果:', result)
        
        if (Array.isArray(result)) {
          hitAreas = result
        } else if (result && typeof result === 'string') {
          hitAreas = [result]
        }
        
        // 如果hitTest没有返回有效结果，使用位置推断作为fallback
        if (hitAreas.length === 0) {
          console.log('🔍 [DEBUG] hitTest返回空，使用位置推断fallback')
          hitAreas = this.inferHitAreaFromPosition(x, y)
        }
      } else if (modelInstance && modelInstance.hitTest) {
        console.log('🔍 [DEBUG] 使用modelInstance.hitTest方法')
        const result = modelInstance.hitTest(x, y)
        console.log('🔍 [DEBUG] modelInstance hitTest结果:', result)
        hitAreas = Array.isArray(result) ? result : [result]
        
        // 如果hitTest没有返回有效结果，使用位置推断作为fallback
        if (hitAreas.length === 0) {
          console.log('🔍 [DEBUG] modelInstance hitTest返回空，使用位置推断fallback')
          hitAreas = this.inferHitAreaFromPosition(x, y)
        }
      } else {
        console.log('🔍 [DEBUG] 没有hitTest方法，使用位置推断')
        hitAreas = this.inferHitAreaFromPosition(x, y)
      }
      
      console.log('🎯 [DEBUG] 最终检测到的点击区域:', hitAreas)
      
      if (hitAreas.length > 0) {
        console.log('✅ [DEBUG] 检测到有效点击区域，触发交互')
        this.handleModelHit(modelInstance, hitAreas)
      } else {
        console.log('❌ [DEBUG] 未检测到有效点击区域，播放默认交互')
        // 播放默认交互
        this.playModelMotion(modelInstance, 'idle', 0)
      }
    } catch (error) {
      console.error('❌ 执行点击区域检测失败:', error)
    }
  }

  /**
   * 根据位置推断点击区域
   */
  private inferHitAreaFromPosition(x: number, y: number): string[] {
    try {
      console.log('📍 [DEBUG] 根据位置推断点击区域:', { x, y })
      
      if (!this.canvas) {
        console.warn('⚠️ Canvas为空，无法推断点击区域')
        return []
      }
      
      const canvasWidth = this.canvas.width
      const canvasHeight = this.canvas.height
      console.log('📐 [DEBUG] Canvas尺寸:', { width: canvasWidth, height: canvasHeight })
      
      // 计算相对位置（0-1范围）
      const relativeX = x / canvasWidth
      const relativeY = y / canvasHeight
      console.log('📍 [DEBUG] 相对位置:', { relativeX, relativeY })
      
      // 简单的区域划分
      if (relativeY < 0.4) {
        // 上部40%认为是头部区域
        console.log('👆 [DEBUG] 推断为头部区域')
        return ['head', 'Head']
      } else if (relativeY < 0.8) {
        // 中部40%认为是身体区域
        console.log('👆 [DEBUG] 推断为身体区域')
        return ['body', 'Body']
      } else {
        // 下部20%认为是其他区域
        console.log('👆 [DEBUG] 推断为其他区域')
        return ['other']
      }
    } catch (error) {
      console.error('❌ 根据位置推断点击区域失败:', error)
      return []
    }
  }

  /**
   * 播放模型动作
   */
  private playModelMotion(modelInstance: any, group: string, index: number = 0): void {
    try {
      console.log('🎬 [DEBUG] 播放模型动作:', { group, index })
      
      if (!modelInstance) {
        console.warn('⚠️ 模型实例为空，无法播放动作')
        return
      }
      
      // 尝试不同的动作播放方法
      const model = modelInstance.model || modelInstance
      
      // ✨ [FIX] 先停止所有正在播放的动作，防止动画重叠
      if (model && model.internalModel && model.internalModel.motionManager) {
        const motionManager = model.internalModel.motionManager
        if (typeof motionManager.stopAllMotions === 'function') {
          console.log('🛑 [DEBUG] 停止所有正在播放的动作')
          motionManager.stopAllMotions()
        }
      }
      
      // 播放新动作（使用高优先级强制替换）
      if (model && typeof model.motion === 'function') {
        console.log('🎬 [DEBUG] 使用model.motion方法 (优先级: FORCE = 3)')
        model.motion(group, index, 3) // priority = 3 (FORCE)
      } else if (model && typeof model.startRandomMotion === 'function') {
        console.log('🎬 [DEBUG] 使用startRandomMotion方法')
        model.startRandomMotion(group, 3) // priority = 3
      } else if (model && model.internalModel && model.internalModel.motionManager) {
        console.log('🎬 [DEBUG] 使用motionManager')
        const motionManager = model.internalModel.motionManager
        if (typeof motionManager.startMotion === 'function') {
          motionManager.startMotion(group, index, 3) // group, index, priority = 3 (FORCE)
        }
      } else {
        console.warn('⚠️ 没有找到可用的动作播放方法')
        console.log('🔍 [DEBUG] 模型可用方法:', Object.getOwnPropertyNames(model || {}))
      }
    } catch (error) {
      console.error('❌ 播放模型动作失败:', error)
    }
  }

  /**
   * 清理所有模型
   */
  cleanup(): void {
    if (this.isDestroyed || this.isCleanupInProgress) {
      console.log('⏭️ [CLEANUP] 跳过：已销毁或正在清理')
      return
    }
    this.isCleanupInProgress = true
    // 卸载所有模型
    for (const modelId of this.loadedModels.keys()) {
      try {
        this.unloadModel(modelId)
      } catch (e) {
        console.warn('⚠️ 卸载模型时出现异常（已忽略）:', e)
      }
    }

    // 清理资源缓存
    this.resourceManager.clearCache()

    // 解绑 Application 的 ticker 回调
    try {
      if (this.app && (this.app as any).ticker) {
        this.app.ticker.remove(this.update, this)
      }
    } catch {}

    // 🔧 [CRITICAL FIX] 安全销毁PixiJS应用
    try {
      // 修复PixiJS destroy时的cancelResize错误
      if (this.app.resizeTo && typeof this.app.resizeTo === 'object') {
        // 清理resize监听器
        if (this.app.resizeTo.removeEventListener) {
          try {
            this.app.resizeTo.removeEventListener('resize', (this.app as any)._onResize)
          } catch (e) {
            // 忽略清理错误
          }
        }
        (this.app as any).resizeTo = null
      }
      
      // 修复cancelResize方法缺失问题
      if (!(this.app as any).cancelResize && (this.app as any)._cancelResize) {
        (this.app as any).cancelResize = (this.app as any)._cancelResize.bind(this.app)
      } else if (!(this.app as any).cancelResize) {
        // 创建空的cancelResize方法
        (this.app as any).cancelResize = () => {}
      }
      
      console.log('🔧 [DEBUG] 开始销毁PixiJS应用...')
      if (this.app && typeof this.app.destroy === 'function') {
        this.app.destroy(true)
      }
      console.log('✅ PixiJS应用已安全销毁')
    } catch (error) {
      console.error('❌ 销毁PixiJS应用失败:', error)
      
      // 强制清理应用状态
      try {
        if (this.app && this.app.stage) {
          this.app.stage.removeChildren()
        }
        if (this.app && this.app.ticker) {
          this.app.ticker.stop()
          this.app.ticker.destroy()
        }
        if (this.app && this.app.renderer) {
          this.app.renderer.destroy()
        }
      } catch (cleanupError) {
        console.error('❌ 强制清理也失败:', cleanupError)
      }
    }

    // 重置标志位
    this.contextRecoverySetup = false
    this.isDestroyed = true
    this.isCleanupInProgress = false

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
   * 启动渲染循环
   */
  private startRenderLoop(): void {
    console.log('🔄 [RENDER DEBUG] 启动渲染循环检查:')
    console.log('  📱 App存在:', !!this.app)
    console.log('  ⏰ Ticker存在:', !!this.app?.ticker)
    console.log('  ▶️ Ticker已启动:', this.app?.ticker?.started)
    console.log('  🔄 已添加渲染回调:', this.renderLoopAdded)
    
    if (!this.app || !this.app.ticker) {
      console.log('❌ [RENDER DEBUG] 无法启动渲染循环：App或Ticker不存在')
      return
    }

    // 确保ticker正在运行
    if (!this.app.ticker.started) {
      this.app.ticker.start()
      console.log('✅ [FIX] 渲染循环已启动')
    }

    // 添加一个专门的渲染回调
    if (!this.renderLoopAdded) {
      this.app.ticker.add(() => {
        try {
          if (this.app && this.app.renderer && this.app.stage) {
            // 检查WebGL上下文是否有效
            const gl = (this.app.renderer as any).gl
            if (gl && !gl.isContextLost() && !(this.app.renderer as any).destroyed) {
              this.app.renderer.render(this.app.stage)
            } else {
              console.log('  ⚠️ [RENDER DEBUG] WebGL上下文已丢失，跳过渲染')
            }
          }
        } catch (error) {
          console.error('❌ [RENDER DEBUG] 渲染回调失败:', error)
          // 如果是因为WebGL上下文问题，停止渲染循环
          if ((error as Error).message.includes('runners') || (error as Error).message.includes('context')) {
            console.log('  ⏸️ [RENDER DEBUG] 检测到上下文问题，停止渲染循环')
            if (this.app && this.app.ticker) {
              this.app.ticker.stop()
            }
          }
        }
      })
      this.renderLoopAdded = true
      console.log('✅ [FIX] 专用渲染回调已添加')
    }
  }

  private renderLoopAdded = false

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
