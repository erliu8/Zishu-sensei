/**
 * Live2D服务主入口
 * 
 * 提供统一的Live2D模型管理接口，包括：
 * - 模型加载和管理
 * - 动画控制
 * - 交互处理
 * - 资源管理
 * - 性能监控
 */

import {
  Live2DModelLoader,
  Live2DModelConfig,
  Live2DRenderConfig,
  Live2DModelInstance,
  LoadState,
  LoaderEvent,
  createLive2DLoader
} from './loader'

import {
  Live2DAnimationManager,
  AnimationType,
  AnimationConfig,
  AnimationState,
  createAnimationManager,
  predefinedAnimations
} from './animation'

import {
  Live2DInteractionManager,
  InteractionType,
  InteractionArea,
  InteractionRule,
  InteractionResponse,
  createInteractionManager
} from './interaction'

/**
 * Live2D服务配置
 */
export interface Live2DServiceConfig {
  /** 画布元素 */
  canvas: HTMLCanvasElement
  /** 默认模型配置 */
  defaultModel?: Live2DModelConfig
  /** 默认渲染配置 */
  defaultRenderConfig?: Partial<Live2DRenderConfig>
  /** 是否启用自动空闲动画 */
  enableAutoIdleAnimation?: boolean
  /** 空闲动画间隔(毫秒) */
  idleAnimationInterval?: number
  /** 是否启用交互 */
  enableInteraction?: boolean
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean
  /** 是否启用调试模式 */
  debugMode?: boolean
}

/**
 * Live2D服务状态
 */
export interface Live2DServiceState {
  /** 服务是否已初始化 */
  initialized: boolean
  /** 服务是否正在运行 */
  running: boolean
  /** 当前加载状态 */
  loadState: LoadState
  /** 当前模型ID */
  currentModelId?: string
  /** 错误信息 */
  error?: string
  /** 性能指标 */
  performance?: {
    fps: number
    memoryUsage: number
    loadTime: number
  }
}

/**
 * Live2D事件类型
 */
export enum Live2DServiceEvent {
  /** 服务初始化完成 */
  SERVICE_INITIALIZED = 'serviceInitialized',
  /** 服务启动 */
  SERVICE_STARTED = 'serviceStarted',
  /** 服务停止 */
  SERVICE_STOPPED = 'serviceStopped',
  /** 服务错误 */
  SERVICE_ERROR = 'serviceError',
  /** 模型变更 */
  MODEL_CHANGED = 'modelChanged',
  /** 状态更新 */
  STATE_UPDATED = 'stateUpdated',
}

/**
 * Live2D服务主类
 */
export class Live2DService {
  private config: Required<Live2DServiceConfig>
  private state: Live2DServiceState
  private eventListeners = new Map<string, Set<Function>>()

  // 核心管理器
  private loader!: Live2DModelLoader
  private animationManager: Live2DAnimationManager
  private interactionManager: Live2DInteractionManager

  // 性能监控
  private performanceMonitor: PerformanceMonitor | null = null
  private updateTimer: number | null = null
  private isDestroying: boolean = false

  // 默认配置
  private readonly defaultConfig: Required<Live2DServiceConfig> = {
    canvas: null as any,
    defaultModel: {
      id: 'hiyori',
      name: 'Hiyori',
      modelPath: '/live2d_models/hiyori/hiyori.model3.json',
      previewImage: '/live2d_models/hiyori/icon.jpg',
      category: 'default',
      description: '默认Live2D模型',
      author: 'Live2D',
      version: '1.0.0',
      tags: ['default', 'virtual-assistant']
    },
    defaultRenderConfig: {
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
    },
    enableAutoIdleAnimation: true,
    idleAnimationInterval: 10000,
    enableInteraction: true,
    enablePerformanceMonitoring: true,
    debugMode: false,
  }

  constructor(config: Live2DServiceConfig) {
    this.config = { ...this.defaultConfig, ...config }
    
    // 初始化状态
    this.state = {
      initialized: false,
      running: false,
      loadState: LoadState.IDLE,
    }

    // 创建非异步管理器
    this.animationManager = createAnimationManager()
    this.interactionManager = createInteractionManager()

    // 初始化性能监控
    if (this.config.enablePerformanceMonitoring) {
      this.performanceMonitor = new PerformanceMonitor()
    }

    this.log('Live2D服务已创建')
  }

  /**
   * 初始化方法
   */
  async init(): Promise<void> {
    // 创建 loader
    this.loader = await createLive2DLoader(this.config.canvas)
    
    // 在loader创建后设置事件监听器
    this.setupEventListeners()
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      this.log('开始初始化Live2D服务...')

      // 加载默认模型
      if (this.config.defaultModel) {
        await this.loadModel(this.config.defaultModel, this.config.defaultRenderConfig)
      }

      // 初始化交互管理器
      if (this.config.enableInteraction && this.getCurrentModel()) {
        this.interactionManager.init(
          this.config.canvas,
          this.getCurrentModel()!,
          this.animationManager
        )
      }

      // 启动自动空闲动画
      if (this.config.enableAutoIdleAnimation) {
        this.animationManager.startAutoIdleAnimation(this.config.idleAnimationInterval)
      }

      // 启动性能监控
      if (this.performanceMonitor) {
        this.performanceMonitor.start()
      }

      // 更新状态
      this.updateState({
        initialized: true,
        running: true,
      })

      this.emit(Live2DServiceEvent.SERVICE_INITIALIZED)
      this.log('Live2D服务初始化完成')

    } catch (error) {
      const errorMessage = `Live2D服务初始化失败: ${error}`
      this.updateState({ error: errorMessage })
      this.emit(Live2DServiceEvent.SERVICE_ERROR, { error })
      throw new Error(errorMessage)
    }
  }

  /**
   * 启动服务
   */
  start(): void {
    if (!this.state.initialized) {
      throw new Error('服务未初始化')
    }

    if (this.state.running) {
      this.log('服务已在运行中')
      return
    }

    // 启动更新循环
    this.startUpdateLoop()

    this.updateState({ running: true })
    this.emit(Live2DServiceEvent.SERVICE_STARTED)
    this.log('Live2D服务已启动')
  }

  /**
   * 停止服务
   */
  stop(): void {
    if (!this.state.running) {
      this.log('服务未在运行')
      return
    }

    // 停止更新循环
    this.stopUpdateLoop()

    // 停止自动动画
    this.animationManager.stopAutoIdleAnimation()

    // 停止性能监控
    if (this.performanceMonitor) {
      this.performanceMonitor.stop()
    }

    this.updateState({ running: false })
    this.emit(Live2DServiceEvent.SERVICE_STOPPED)
    this.log('Live2D服务已停止')
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    if (this.isDestroying) {
      this.log('跳过销毁：正在销毁中')
      return
    }
    this.isDestroying = true
    this.log('开始销毁Live2D服务...')

    // 停止服务
    this.stop()

    // 清理各个管理器
    this.loader.cleanup()
    this.animationManager.cleanup()
    this.interactionManager.cleanup()

    // 清理性能监控
    if (this.performanceMonitor) {
      this.performanceMonitor.destroy()
      this.performanceMonitor = null
    }

    // 清理事件监听器
    this.eventListeners.clear()

    this.log('Live2D服务已销毁')
    this.isDestroying = false
  }

  /**
   * 加载模型
   */
  async loadModel(
    config: Live2DModelConfig,
    renderConfig?: Partial<Live2DRenderConfig>
  ): Promise<Live2DModelInstance> {
    try {
      this.log(`开始加载模型: ${config.name}`)
      
      // 更新加载状态
      this.updateState({ loadState: LoadState.LOADING })

      // 加载模型
      const modelInstance = await this.loader.loadModel(config, renderConfig)

      // 设置到动画管理器
      this.animationManager.setModelInstance(modelInstance)

      // 更新状态
      this.updateState({
        loadState: LoadState.LOADED,
        currentModelId: config.id,
        error: undefined
      })

      this.emit(Live2DServiceEvent.MODEL_CHANGED, { modelInstance })
      this.log(`模型加载完成: ${config.name}`)

      return modelInstance

    } catch (error) {
      this.updateState({
        loadState: LoadState.ERROR,
        error: `模型加载失败: ${error}`
      })
      throw error
    }
  }

  /**
   * 切换模型
   */
  async switchModel(modelId: string): Promise<Live2DModelInstance> {
    const modelInstance = await this.loader.switchToModel(modelId)
    
    // 更新动画管理器
    this.animationManager.setModelInstance(modelInstance)
    
    // 重新初始化交互管理器
    if (this.config.enableInteraction) {
      this.interactionManager.init(
        this.config.canvas,
        modelInstance,
        this.animationManager
      )
    }

    this.updateState({ currentModelId: modelId })
    this.emit(Live2DServiceEvent.MODEL_CHANGED, { modelInstance })

    return modelInstance
  }

  /**
   * 卸载模型
   */
  unloadModel(modelId: string): void {
    try {
      this.loader.unloadModel(modelId)
    } catch (e) {
      console.warn('⚠️ 卸载模型时出现异常（已忽略）:', e)
    }
    
    if (this.state.currentModelId === modelId) {
      this.updateState({ currentModelId: undefined })
    }
  }

  /**
   * 播放动画
   */
  async playAnimation(config: AnimationConfig): Promise<void> {
    return this.animationManager.playAnimation(config)
  }

  /**
   * 播放指定类型的随机动画
   */
  async playRandomAnimation(type: AnimationType): Promise<void> {
    return this.animationManager.playRandomAnimationByType(type)
  }

  /**
   * 停止动画
   */
  stopAnimation(): void {
    this.animationManager.stopAnimation()
  }

  /**
   * 设置表情
   */
  async setExpression(expressionIndex: number): Promise<void> {
    const currentModel = this.getCurrentModel()
    if (!currentModel) {
      throw new Error('没有当前模型')
    }

    await currentModel.model.expression(expressionIndex)
  }

  /**
   * 更新渲染配置
   */
  updateRenderConfig(config: Partial<Live2DRenderConfig>): void {
    const currentModel = this.getCurrentModel()
    if (!currentModel) {
      throw new Error('没有当前模型')
    }

    this.loader.updateRenderConfig(currentModel.config.id, config)
  }

  /**
   * 添加交互规则
   */
  addInteractionRule(rule: InteractionRule): void {
    this.interactionManager.addInteractionRule(rule)
  }

  /**
   * 移除交互规则
   */
  removeInteractionRule(ruleId: string): void {
    this.interactionManager.removeInteractionRule(ruleId)
  }

  /**
   * 启用/禁用交互
   */
  setInteractionEnabled(enabled: boolean): void {
    this.interactionManager.setEnabled(enabled)
  }

  /**
   * 获取当前模型
   */
  getCurrentModel(): Live2DModelInstance | null {
    return this.loader.getCurrentModel()
  }

  /**
   * 获取所有已加载的模型
   */
  getAllModels(): Live2DModelInstance[] {
    return this.loader.getAllLoadedModels()
  }

  /**
   * 更新模型位置
   */
  updateModelPosition(modelId: string, x: number, y: number): void {
    this.loader.updateModelPosition(modelId, x, y)
  }

  /**
   * 更新模型缩放
   */
  updateModelScale(modelId: string, scale: number): void {
    this.loader.updateModelScale(modelId, scale)
  }

  /**
   * 获取模型当前变换
   */
  getModelTransform(modelId: string): { x: number, y: number, scale: number } | null {
    return this.loader.getModelTransform(modelId)
  }

  /**
   * 获取服务状态
   */
  getState(): Live2DServiceState {
    return { ...this.state }
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): any {
    return this.performanceMonitor?.getMetrics() || null
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 加载器事件
    this.loader.on(LoaderEvent.LOAD_START, (_data: any) => {
      this.updateState({ loadState: LoadState.LOADING })
    })

    this.loader.on(LoaderEvent.LOAD_COMPLETE, (_data: any) => {
      this.updateState({ loadState: LoadState.LOADED })
    })

    this.loader.on(LoaderEvent.LOAD_ERROR, (error: any) => {
      this.updateState({ 
        loadState: LoadState.ERROR,
        error: error.message 
      })
    })

    // 动画管理器事件
    this.animationManager.on('animationStart', (data: any) => {
      this.log(`动画开始: ${data.config.type}`)
    })

    this.animationManager.on('animationComplete', (data: any) => {
      this.log(`动画完成: ${data.config.type}`)
    })

    this.animationManager.on('animationError', (data: any) => {
      this.log(`动画错误: ${data.error.message}`, 'error')
    })

    // 交互管理器事件
    this.interactionManager.on('interaction', (data: any) => {
      this.log(`交互触发: ${data.type}`)
    })

    this.interactionManager.on('ruleExecuted', (data: any) => {
      this.log(`交互规则执行: ${data.rule.name}`)
    })
  }

  /**
   * 启动更新循环
   */
  private startUpdateLoop(): void {
    if (this.updateTimer) return

    this.updateTimer = setInterval(() => {
      this.update()
    }, 16) as unknown as number // ~60fps
  }

  /**
   * 停止更新循环
   */
  private stopUpdateLoop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = null
    }
  }

  /**
   * 更新循环
   */
  private update(): void {
    // 更新性能监控
    if (this.performanceMonitor) {
      this.performanceMonitor.update()
      
      // 定期更新性能指标到状态
      const metrics = this.performanceMonitor.getMetrics()
      if (metrics) {
        this.updateState({
          performance: {
            fps: metrics.fps,
            memoryUsage: metrics.memoryUsage,
            loadTime: metrics.loadTime
          }
        })
      }
    }
  }

  /**
   * 更新状态
   */
  private updateState(updates: Partial<Live2DServiceState>): void {
    const oldState = { ...this.state }
    this.state = { ...this.state, ...updates }
    
    this.emit(Live2DServiceEvent.STATE_UPDATED, {
      oldState,
      newState: this.state,
      changes: updates
    })
  }

  /**
   * 添加事件监听器
   */
  on(event: Live2DServiceEvent | string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(listener)
  }

  /**
   * 移除事件监听器
   */
  off(event: Live2DServiceEvent | string, listener: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.delete(listener)
    }
  }

  /**
   * 触发事件
   */
  private emit(event: Live2DServiceEvent | string, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          this.log(`事件监听器执行失败: ${error}`, 'error')
        }
      })
    }
  }

  /**
   * 日志输出
   */
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (this.config.debugMode || level !== 'info') {
      const timestamp = new Date().toISOString()
      const prefix = `[Live2DService ${timestamp}]`
      
      switch (level) {
        case 'warn':
          console.warn(prefix, message)
          break
        case 'error':
          console.error(prefix, message)
          break
        default:
          console.log(prefix, message)
      }
    }
  }
}

/**
 * 性能监控器
 */
class PerformanceMonitor {
  private startTime = 0
  private frameCount = 0
  private lastFrameTime = 0
  private fps = 0
  private isRunning = false

  start(): void {
    this.startTime = performance.now()
    this.lastFrameTime = this.startTime
    this.isRunning = true
  }

  stop(): void {
    this.isRunning = false
  }

  update(): void {
    if (!this.isRunning) return

    const currentTime = performance.now()
    this.frameCount++

    // 每秒计算一次FPS
    if (currentTime - this.lastFrameTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFrameTime))
      this.frameCount = 0
      this.lastFrameTime = currentTime
    }
  }

  getMetrics(): any {
    if (!this.isRunning) return null

    return {
      fps: this.fps,
      memoryUsage: this.getMemoryUsage(),
      loadTime: performance.now() - this.startTime
    }
  }

  private getMemoryUsage(): number {
    // @ts-ignore
    if (performance.memory) {
      // @ts-ignore
      return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
    }
    return 0
  }

  destroy(): void {
    this.stop()
  }
}

/**
 * 创建Live2D服务实例
 */
export async function createLive2DService(config: Live2DServiceConfig): Promise<Live2DService> {
  const service = new Live2DService(config)
  await service.init()
  return service
}

/**
 * 导出所有相关类型和接口
 */
export {
  // Loader相关
  Live2DModelLoader,
  LoadState,
  LoaderEvent,

  // Animation相关
  Live2DAnimationManager,
  AnimationType,
  AnimationState,
  predefinedAnimations,

  // Interaction相关
  Live2DInteractionManager,
  InteractionType,
}

export type {
  // Loader相关类型
  Live2DModelConfig,
  Live2DRenderConfig,
  Live2DModelInstance,

  // Animation相关类型
  AnimationConfig,

  // Interaction相关类型
  InteractionArea,
  InteractionRule,
  InteractionResponse,
}

/**
 * 默认导出
 */
export default Live2DService
