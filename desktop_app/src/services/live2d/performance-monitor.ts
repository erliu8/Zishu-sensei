/**
 * Live2D 性能监控和优化管理器
 */

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  renderTime: number
  updateTime: number
  memoryUsage: {
    used: number
    total: number
    percentage: number
  }
  modelCount: number
  textureMemory: number
  drawCalls: number
  triangleCount: number
}

export interface PerformanceThresholds {
  minFps: number
  maxFrameTime: number
  maxMemoryUsage: number
  maxDrawCalls: number
  maxTriangleCount: number
}

export interface OptimizationConfig {
  enableAutoOptimization: boolean
  enableFrameSkipping: boolean
  enableLOD: boolean // Level of Detail
  enableCulling: boolean
  enableTextureCompression: boolean
  targetFps: number
  qualityLevel: 'low' | 'medium' | 'high' | 'ultra'
}

export enum PerformanceLevel {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical'
}

export enum OptimizationAction {
  REDUCE_QUALITY = 'reduce_quality',
  SKIP_FRAMES = 'skip_frames',
  REDUCE_MODEL_COUNT = 'reduce_model_count',
  COMPRESS_TEXTURES = 'compress_textures',
  ENABLE_CULLING = 'enable_culling',
  REDUCE_PHYSICS = 'reduce_physics'
}

/**
 * 性能监控器
 */
export class Live2DPerformanceMonitor {
  private metrics: PerformanceMetrics
  private thresholds: PerformanceThresholds
  private config: OptimizationConfig
  private isMonitoring = false
  private monitoringInterval: number | null = null
  private frameTimeHistory: number[] = []
  private fpsHistory: number[] = []
  private lastFrameTime = 0
  private frameCount = 0
  private eventListeners = new Map<string, Set<Function>>()

  constructor() {
    this.metrics = this.initializeMetrics()
    this.thresholds = this.getDefaultThresholds()
    this.config = this.getDefaultConfig()
  }

  /**
   * 初始化性能指标
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      fps: 60,
      frameTime: 16.67,
      renderTime: 0,
      updateTime: 0,
      memoryUsage: {
        used: 0,
        total: 0,
        percentage: 0
      },
      modelCount: 0,
      textureMemory: 0,
      drawCalls: 0,
      triangleCount: 0
    }
  }

  /**
   * 获取默认性能阈值
   */
  private getDefaultThresholds(): PerformanceThresholds {
    return {
      minFps: 30,
      maxFrameTime: 33.33, // 30fps
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      maxDrawCalls: 100,
      maxTriangleCount: 50000
    }
  }

  /**
   * 获取默认优化配置
   */
  private getDefaultConfig(): OptimizationConfig {
    return {
      enableAutoOptimization: true,
      enableFrameSkipping: false,
      enableLOD: true,
      enableCulling: true,
      enableTextureCompression: false,
      targetFps: 60,
      qualityLevel: 'high'
    }
  }

  /**
   * 开始性能监控
   */
  startMonitoring(interval: number = 1000): void {
    if (this.isMonitoring) {
      return
    }

    this.isMonitoring = true
    this.frameTimeHistory = []
    this.fpsHistory = []
    this.lastFrameTime = performance.now()

    this.monitoringInterval = window.setInterval(() => {
      this.updateMetrics()
      this.analyzePerformance()
    }, interval)

    console.log('性能监控已启动')
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.isMonitoring = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    console.log('性能监控已停止')
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(): void {
    const currentTime = performance.now()
    const frameTime = currentTime - this.lastFrameTime
    
    // 更新帧时间历史
    this.frameTimeHistory.push(frameTime)
    if (this.frameTimeHistory.length > 60) {
      this.frameTimeHistory.shift()
    }

    // 计算平均帧时间和FPS
    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length
    const fps = 1000 / avgFrameTime

    // 更新FPS历史
    this.fpsHistory.push(fps)
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift()
    }

    // 更新指标
    this.metrics.frameTime = avgFrameTime
    this.metrics.fps = fps

    // 更新内存使用情况
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.metrics.memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      }
    }

    this.lastFrameTime = currentTime
    this.frameCount++
  }

  /**
   * 分析性能状况
   */
  private analyzePerformance(): void {
    const level = this.getPerformanceLevel()
    const suggestions = this.getOptimizationSuggestions()

    // 触发性能事件
    this.emit('performance_update', {
      metrics: this.metrics,
      level,
      suggestions
    })

    // 自动优化
    if (this.config.enableAutoOptimization && level === PerformanceLevel.POOR) {
      this.applyAutoOptimizations(suggestions)
    }
  }

  /**
   * 获取性能等级
   */
  getPerformanceLevel(): PerformanceLevel {
    const { fps, memoryUsage, drawCalls } = this.metrics

    if (fps >= 55 && memoryUsage.percentage < 70 && drawCalls < 50) {
      return PerformanceLevel.EXCELLENT
    } else if (fps >= 45 && memoryUsage.percentage < 80 && drawCalls < 70) {
      return PerformanceLevel.GOOD
    } else if (fps >= 30 && memoryUsage.percentage < 90 && drawCalls < 90) {
      return PerformanceLevel.FAIR
    } else if (fps >= 20 && memoryUsage.percentage < 95) {
      return PerformanceLevel.POOR
    } else {
      return PerformanceLevel.CRITICAL
    }
  }

  /**
   * 获取优化建议
   */
  getOptimizationSuggestions(): OptimizationAction[] {
    const suggestions: OptimizationAction[] = []
    const { fps, memoryUsage, drawCalls, triangleCount } = this.metrics

    if (fps < this.thresholds.minFps) {
      suggestions.push(OptimizationAction.REDUCE_QUALITY)
      suggestions.push(OptimizationAction.SKIP_FRAMES)
    }

    if (memoryUsage.used > this.thresholds.maxMemoryUsage) {
      suggestions.push(OptimizationAction.COMPRESS_TEXTURES)
      suggestions.push(OptimizationAction.REDUCE_MODEL_COUNT)
    }

    if (drawCalls > this.thresholds.maxDrawCalls) {
      suggestions.push(OptimizationAction.ENABLE_CULLING)
    }

    if (triangleCount > this.thresholds.maxTriangleCount) {
      suggestions.push(OptimizationAction.REDUCE_QUALITY)
    }

    return suggestions
  }

  /**
   * 应用自动优化
   */
  private applyAutoOptimizations(suggestions: OptimizationAction[]): void {
    for (const action of suggestions) {
      try {
        switch (action) {
          case OptimizationAction.REDUCE_QUALITY:
            this.reduceQuality()
            break
          case OptimizationAction.SKIP_FRAMES:
            this.enableFrameSkipping()
            break
          case OptimizationAction.COMPRESS_TEXTURES:
            this.enableTextureCompression()
            break
          case OptimizationAction.ENABLE_CULLING:
            this.enableCulling()
            break
          case OptimizationAction.REDUCE_PHYSICS:
            this.reducePhysics()
            break
        }
        
        console.log(`应用优化: ${action}`)
        this.emit('optimization_applied', { action })
      } catch (error) {
        console.error(`优化失败 (${action}):`, error)
      }
    }
  }

  /**
   * 降低渲染质量
   */
  private reduceQuality(): void {
    const qualityLevels: OptimizationConfig['qualityLevel'][] = ['ultra', 'high', 'medium', 'low']
    const currentIndex = qualityLevels.indexOf(this.config.qualityLevel)
    
    if (currentIndex < qualityLevels.length - 1) {
      this.config.qualityLevel = qualityLevels[currentIndex + 1]
      this.applyQualitySettings()
    }
  }

  /**
   * 启用帧跳过
   */
  private enableFrameSkipping(): void {
    this.config.enableFrameSkipping = true
  }

  /**
   * 启用纹理压缩
   */
  private enableTextureCompression(): void {
    this.config.enableTextureCompression = true
  }

  /**
   * 启用视锥体剔除
   */
  private enableCulling(): void {
    this.config.enableCulling = true
  }

  /**
   * 减少物理效果
   */
  private reducePhysics(): void {
    // 实现物理效果减少逻辑
  }

  /**
   * 应用质量设置
   */
  private applyQualitySettings(): void {
    // 根据质量等级调整渲染参数
    // TODO: 实现质量设置应用逻辑
  }

  /**
   * 记录渲染时间
   */
  recordRenderTime(startTime: number, endTime: number): void {
    this.metrics.renderTime = endTime - startTime
  }

  /**
   * 记录更新时间
   */
  recordUpdateTime(startTime: number, endTime: number): void {
    this.metrics.updateTime = endTime - startTime
  }

  /**
   * 更新模型统计
   */
  updateModelStats(modelCount: number, textureMemory: number, drawCalls: number, triangleCount: number): void {
    this.metrics.modelCount = modelCount
    this.metrics.textureMemory = textureMemory
    this.metrics.drawCalls = drawCalls
    this.metrics.triangleCount = triangleCount
  }

  /**
   * 获取当前性能指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /**
   * 获取性能历史
   */
  getPerformanceHistory(): {
    frameTimeHistory: number[]
    fpsHistory: number[]
  } {
    return {
      frameTimeHistory: [...this.frameTimeHistory],
      fpsHistory: [...this.fpsHistory]
    }
  }

  /**
   * 设置性能阈值
   */
  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
  }

  /**
   * 设置优化配置
   */
  setConfig(config: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取优化配置
   */
  getConfig(): OptimizationConfig {
    return { ...this.config }
  }

  /**
   * 重置性能统计
   */
  resetStats(): void {
    this.frameTimeHistory = []
    this.fpsHistory = []
    this.frameCount = 0
    this.metrics = this.initializeMetrics()
  }

  /**
   * 生成性能报告
   */
  generateReport(): {
    summary: {
      averageFps: number
      minFps: number
      maxFps: number
      averageFrameTime: number
      totalFrames: number
      performanceLevel: PerformanceLevel
    }
    recommendations: string[]
    config: OptimizationConfig
  } {
    const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length || 0
    const minFps = Math.min(...this.fpsHistory) || 0
    const maxFps = Math.max(...this.fpsHistory) || 0
    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length || 0

    const recommendations: string[] = []
    const suggestions = this.getOptimizationSuggestions()

    for (const suggestion of suggestions) {
      switch (suggestion) {
        case OptimizationAction.REDUCE_QUALITY:
          recommendations.push('建议降低渲染质量以提升性能')
          break
        case OptimizationAction.SKIP_FRAMES:
          recommendations.push('建议启用帧跳过以稳定帧率')
          break
        case OptimizationAction.COMPRESS_TEXTURES:
          recommendations.push('建议压缩纹理以减少内存使用')
          break
        case OptimizationAction.ENABLE_CULLING:
          recommendations.push('建议启用视锥体剔除以减少绘制调用')
          break
        case OptimizationAction.REDUCE_PHYSICS:
          recommendations.push('建议减少物理效果以提升性能')
          break
      }
    }

    return {
      summary: {
        averageFps: avgFps,
        minFps,
        maxFps,
        averageFrameTime: avgFrameTime,
        totalFrames: this.frameCount,
        performanceLevel: this.getPerformanceLevel()
      },
      recommendations,
      config: this.config
    }
  }

  /**
   * 添加事件监听器
   */
  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data)
        } catch (error) {
          console.error(`性能监控事件监听器错误 (${event}):`, error)
        }
      }
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopMonitoring()
    this.eventListeners.clear()
    this.frameTimeHistory = []
    this.fpsHistory = []
  }
}
