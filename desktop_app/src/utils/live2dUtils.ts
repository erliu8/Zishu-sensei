/**
 * Live2D模型管理工具
 * 
 * 提供模型加载、缓存和管理功能
 */

import { Live2DModelConfig, Live2DAnimationType } from '../types/live2d'

/**
 * 模型资源管理器
 */
export class Live2DModelManager {
  private static instance: Live2DModelManager
  private modelCache = new Map<string, Live2DModelConfig>()
  private loadingPromises = new Map<string, Promise<Live2DModelConfig>>()

  /**
   * 获取单例实例
   */
  public static getInstance(): Live2DModelManager {
    if (!Live2DModelManager.instance) {
      Live2DModelManager.instance = new Live2DModelManager()
    }
    return Live2DModelManager.instance
  }

  /**
   * 加载模型配置
   */
  public async loadModel(modelPath: string): Promise<Live2DModelConfig> {
    // 检查缓存
    if (this.modelCache.has(modelPath)) {
      return this.modelCache.get(modelPath)!
    }

    // 检查是否正在加载
    if (this.loadingPromises.has(modelPath)) {
      return this.loadingPromises.get(modelPath)!
    }

    // 开始加载
    const loadingPromise = this.doLoadModel(modelPath)
    this.loadingPromises.set(modelPath, loadingPromise)

    try {
      const model = await loadingPromise
      this.modelCache.set(modelPath, model)
      return model
    } finally {
      this.loadingPromises.delete(modelPath)
    }
  }

  /**
   * 实际加载模型
   */
  private async doLoadModel(modelPath: string): Promise<Live2DModelConfig> {
    try {
      const response = await fetch(modelPath)
      if (!response.ok) {
        throw new Error(`Failed to load model: ${response.statusText}`)
      }

      const modelData = await response.json()
      return this.parseModelConfig(modelData, modelPath)
    } catch (error) {
      throw new Error(`Error loading model from ${modelPath}: ${error}`)
    }
  }

  /**
   * 解析模型配置
   */
  private parseModelConfig(modelData: any, modelPath: string): Live2DModelConfig {
    const basePath = modelPath.substring(0, modelPath.lastIndexOf('/'))
    
    return {
      id: modelData.FileReferences?.Moc || 'unknown',
      name: modelData.Name || 'Unknown Model',
      modelPath,
      description: modelData.Description || '',
      author: modelData.Author || 'Unknown',
      version: modelData.Version || '1.0.0',
      tags: modelData.Tags || [],
      animations: this.parseAnimations(modelData.FileReferences?.Motions, basePath),
      expressions: this.parseExpressions(modelData.FileReferences?.Expressions, basePath),
      physics: modelData.FileReferences?.Physics ? `${basePath}/${modelData.FileReferences.Physics}` : undefined,
      // pose: modelData.FileReferences?.Pose ? `${basePath}/${modelData.FileReferences.Pose}` : undefined, // 暂时注释掉不支持的属性
      // userdata: modelData.FileReferences?.UserData ? `${basePath}/${modelData.FileReferences.UserData}` : undefined, // 暂时注释掉不支持的属性
      metadata: {
        modelSize: {
          width: modelData.Layout?.Width || 1024,
          height: modelData.Layout?.Height || 1024
        },
        canvasSize: {
          width: modelData.Layout?.CanvasWidth || 800,
          height: modelData.Layout?.CanvasHeight || 600
        },
        pixelsPerUnit: modelData.Layout?.PixelsPerUnit || 1.0,
        originX: modelData.Layout?.OriginX || 0.5,
        originY: modelData.Layout?.OriginY || 0.5
      }
    }
  }

  /**
   * 解析动画配置
   */
  private parseAnimations(motions: any, basePath: string): Record<Live2DAnimationType, Array<{ name: string; file: string; priority: number }>> {
    const animations: Record<string, Array<{ name: string; file: string; priority: number }>> = {
      idle: [],
      tap: [],
      special: []
    }

    if (!motions) return animations as any

    Object.entries(motions).forEach(([groupName, motionList]: [string, any]) => {
      const animationType = this.mapAnimationType(groupName)
      const priority = this.getAnimationPriority(animationType)

      if (Array.isArray(motionList)) {
        motionList.forEach((motion: any, index: number) => {
          animations[animationType].push({
            name: motion.Name || `${groupName}_${index}`,
            file: `${basePath}/${motion.File}`,
            priority
          })
        })
      }
    })

    return animations as any
  }

  /**
   * 解析表情配置
   */
  private parseExpressions(expressions: any, basePath: string): Array<{ name: string; file: string }> {
    if (!Array.isArray(expressions)) return []

    return expressions.map((expr: any, index: number) => ({
      name: expr.Name || `expression_${index}`,
      file: `${basePath}/${expr.File}`
    }))
  }

  /**
   * 映射动画类型
   */
  private mapAnimationType(groupName: string): Live2DAnimationType {
    const lowerName = groupName.toLowerCase()
    
    if (lowerName.includes('idle') || lowerName.includes('wait')) {
      return Live2DAnimationType.IDLE
    } else if (lowerName.includes('tap') || lowerName.includes('touch')) {
      return Live2DAnimationType.TAP
    } else {
      return Live2DAnimationType.HAPPY // 使用HAPPY代替'special'
    }
  }

  /**
   * 获取动画优先级
   */
  private getAnimationPriority(animationType: Live2DAnimationType): number {
    switch (animationType) {
      case Live2DAnimationType.IDLE: return 1
      case Live2DAnimationType.TAP: return 2
      case Live2DAnimationType.HAPPY: return 3
      default: return 1
    }
  }

  /**
   * 预加载模型列表
   */
  public async preloadModels(modelPaths: string[]): Promise<void> {
    const loadPromises = modelPaths.map(path => this.loadModel(path))
    await Promise.allSettled(loadPromises)
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.modelCache.clear()
    this.loadingPromises.clear()
  }

  /**
   * 获取缓存的模型列表
   */
  public getCachedModels(): Live2DModelConfig[] {
    return Array.from(this.modelCache.values())
  }

  /**
   * 检查模型是否已缓存
   */
  public isModelCached(modelPath: string): boolean {
    return this.modelCache.has(modelPath)
  }

  /**
   * 获取缓存大小
   */
  public getCacheSize(): number {
    return this.modelCache.size
  }
}

/**
 * Live2D资源路径工具
 */
export class Live2DPathUtils {
  /**
   * 标准化路径
   */
  public static normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/')
  }

  /**
   * 获取基础路径
   */
  public static getBasePath(fullPath: string): string {
    return fullPath.substring(0, fullPath.lastIndexOf('/'))
  }

  /**
   * 获取文件名
   */
  public static getFileName(fullPath: string): string {
    return fullPath.substring(fullPath.lastIndexOf('/') + 1)
  }

  /**
   * 获取文件扩展名
   */
  public static getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.')
    return lastDot > 0 ? fileName.substring(lastDot + 1) : ''
  }

  /**
   * 拼接路径
   */
  public static joinPath(...paths: string[]): string {
    return this.normalizePath(paths.join('/'))
  }

  /**
   * 检查是否为绝对路径
   */
  public static isAbsolutePath(path: string): boolean {
    return /^(https?:\/\/|\/|[a-zA-Z]:)/.test(path)
  }

  /**
   * 解析相对路径
   */
  public static resolvePath(basePath: string, relativePath: string): string {
    if (this.isAbsolutePath(relativePath)) {
      return relativePath
    }
    return this.joinPath(basePath, relativePath)
  }
}

/**
 * Live2D性能监控工具
 */
export class Live2DPerformanceMonitor {
  private frameCount = 0
  private lastTime = 0
  private fps = 0
  private frameTime = 0
  private callbacks: Array<(stats: { fps: number; frameTime: number }) => void> = []

  /**
   * 开始监控
   */
  public start(): void {
    this.lastTime = performance.now()
    this.tick()
  }

  /**
   * 停止监控
   */
  public stop(): void {
    this.callbacks = []
  }

  /**
   * 添加监控回调
   */
  public addCallback(callback: (stats: { fps: number; frameTime: number }) => void): void {
    this.callbacks.push(callback)
  }

  /**
   * 移除监控回调
   */
  public removeCallback(callback: (stats: { fps: number; frameTime: number }) => void): void {
    const index = this.callbacks.indexOf(callback)
    if (index > -1) {
      this.callbacks.splice(index, 1)
    }
  }

  /**
   * 监控循环
   */
  private tick(): void {
    const currentTime = performance.now()
    this.frameTime = currentTime - this.lastTime
    this.frameCount++

    if (this.frameCount % 60 === 0) {
      this.fps = Math.round(1000 / (this.frameTime / 60))
      this.notifyCallbacks()
    }

    this.lastTime = currentTime
    requestAnimationFrame(() => this.tick())
  }

  /**
   * 通知回调
   */
  private notifyCallbacks(): void {
    const stats = { fps: this.fps, frameTime: this.frameTime }
    this.callbacks.forEach(callback => callback(stats))
  }

  /**
   * 获取当前统计信息
   */
  public getStats(): { fps: number; frameTime: number } {
    return { fps: this.fps, frameTime: this.frameTime }
  }
}

// 导出单例实例
export const modelManager = Live2DModelManager.getInstance()
export const performanceMonitor = new Live2DPerformanceMonitor()
