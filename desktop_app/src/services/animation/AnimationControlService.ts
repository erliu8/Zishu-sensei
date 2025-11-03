import { EventEmitter } from 'events'
import { 
  Live2DAnimationManager, 
  AnimationType, 
  AnimationConfig, 
  AnimationPlayInfo 
} from '../live2d/animation'

/**
 * 动画控制服务事件类型
 */
export enum AnimationControlEvent {
  /** 动画开始播放 */
  ANIMATION_START = 'animationStart',
  /** 动画播放完成 */
  ANIMATION_COMPLETE = 'animationComplete',
  /** 动画停止 */
  ANIMATION_STOP = 'animationStop',
  /** 动画暂停 */
  ANIMATION_PAUSE = 'animationPause',
  /** 动画恢复 */
  ANIMATION_RESUME = 'animationResume',
  /** 动画错误 */
  ANIMATION_ERROR = 'animationError',
  /** 可用动画列表更新 */
  ANIMATIONS_UPDATED = 'animationsUpdated',
  /** 自动播放状态改变 */
  AUTO_PLAY_CHANGED = 'autoPlayChanged',
  /** 播放队列更新 */
  QUEUE_UPDATED = 'queueUpdated'
}

/**
 * 动画控制服务状态
 */
export interface AnimationControlState {
  /** 当前播放信息 */
  currentPlayInfo: AnimationPlayInfo | null
  /** 可用动画列表 */
  availableAnimations: AnimationConfig[]
  /** 是否正在播放 */
  isPlaying: boolean
  /** 是否已暂停 */
  isPaused: boolean
  /** 自动空闲播放是否启用 */
  autoIdleEnabled: boolean
  /** 自动播放间隔 */
  autoIdleInterval: number
  /** 播放队列 */
  playQueue: AnimationConfig[]
  /** 播放历史 */
  playHistory: AnimationConfig[]
}

/**
 * 动画播放选项
 */
export interface AnimationPlayOptions {
  /** 是否强制播放（中断当前动画） */
  force?: boolean
  /** 播放前的延迟(毫秒) */
  delay?: number
  /** 播放完成后的回调 */
  onComplete?: () => void
  /** 播放错误的回调 */
  onError?: (error: Error) => void
}

/**
 * 动画控制服务类
 * 提供对Live2D动画管理器的高级封装，支持React组件的状态管理和事件处理
 */
export class AnimationControlService extends EventEmitter {
  private animationManager: Live2DAnimationManager | null = null
  private state: AnimationControlState = {
    currentPlayInfo: null,
    availableAnimations: [],
    isPlaying: false,
    isPaused: false,
    autoIdleEnabled: false,
    autoIdleInterval: 10000,
    playQueue: [],
    playHistory: []
  }

  private maxHistoryLength = 50
  private isInitialized = false

  constructor() {
    super()
    this.setMaxListeners(20) // 增加最大监听器数量
  }

  /**
   * 初始化动画控制服务
   */
  async initialize(animationManager: Live2DAnimationManager): Promise<void> {
    if (this.isInitialized) {
      console.warn('动画控制服务已经初始化')
      return
    }

    try {
      this.animationManager = animationManager
      this.setupEventListeners()
      await this.updateAvailableAnimations()
      this.isInitialized = true
      
      console.log('动画控制服务初始化完成')
    } catch (error) {
      console.error('动画控制服务初始化失败:', error)
      throw error
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    if (!this.animationManager) return

    // 监听动画管理器事件
    this.animationManager.on('animationStart', this.handleAnimationStart.bind(this))
    this.animationManager.on('animationComplete', this.handleAnimationComplete.bind(this))
    this.animationManager.on('animationStop', this.handleAnimationStop.bind(this))
    this.animationManager.on('animationPause', this.handleAnimationPause.bind(this))
    this.animationManager.on('animationResume', this.handleAnimationResume.bind(this))
    this.animationManager.on('animationError', this.handleAnimationError.bind(this))
  }

  /**
   * 处理动画开始事件
   */
  private handleAnimationStart(data: { config: AnimationConfig; playInfo: AnimationPlayInfo }): void {
    this.state.currentPlayInfo = data.playInfo
    this.state.isPlaying = true
    this.state.isPaused = false
    
    // 添加到播放历史
    this.addToHistory(data.config)
    
    this.emit(AnimationControlEvent.ANIMATION_START, data)
  }

  /**
   * 处理动画完成事件
   */
  private handleAnimationComplete(data: { config: AnimationConfig; playInfo: AnimationPlayInfo }): void {
    this.state.currentPlayInfo = null
    this.state.isPlaying = false
    this.state.isPaused = false
    
    this.emit(AnimationControlEvent.ANIMATION_COMPLETE, data)
  }

  /**
   * 处理动画停止事件
   */
  private handleAnimationStop(data: { playInfo: AnimationPlayInfo }): void {
    this.state.currentPlayInfo = null
    this.state.isPlaying = false
    this.state.isPaused = false
    
    this.emit(AnimationControlEvent.ANIMATION_STOP, data)
  }

  /**
   * 处理动画暂停事件
   */
  private handleAnimationPause(data: { playInfo: AnimationPlayInfo }): void {
    this.state.isPaused = true
    this.emit(AnimationControlEvent.ANIMATION_PAUSE, data)
  }

  /**
   * 处理动画恢复事件
   */
  private handleAnimationResume(data: { playInfo: AnimationPlayInfo }): void {
    this.state.isPaused = false
    this.emit(AnimationControlEvent.ANIMATION_RESUME, data)
  }

  /**
   * 处理动画错误事件
   */
  private handleAnimationError(data: { config: AnimationConfig; error: Error }): void {
    this.state.currentPlayInfo = null
    this.state.isPlaying = false
    this.state.isPaused = false
    
    this.emit(AnimationControlEvent.ANIMATION_ERROR, data)
  }

  /**
   * 播放动画
   */
  async playAnimation(config: AnimationConfig, options: AnimationPlayOptions = {}): Promise<void> {
    if (!this.animationManager) {
      throw new Error('动画管理器未初始化')
    }

    try {
      // 如果有延迟，先等待
      if (options.delay && options.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delay))
      }

      // 如果强制播放，先停止当前动画
      if (options.force && this.state.isPlaying) {
        this.animationManager.stopAnimation()
      }

      await this.animationManager.playAnimation(config)

      // 设置回调
      if (options.onComplete) {
        const completeHandler = () => {
          options.onComplete!()
          this.off(AnimationControlEvent.ANIMATION_COMPLETE, completeHandler)
        }
        this.on(AnimationControlEvent.ANIMATION_COMPLETE, completeHandler)
      }

      if (options.onError) {
        const errorHandler = (data: { error: Error }) => {
          options.onError!(data.error)
          this.off(AnimationControlEvent.ANIMATION_ERROR, errorHandler)
        }
        this.on(AnimationControlEvent.ANIMATION_ERROR, errorHandler)
      }

    } catch (error) {
      if (options.onError) {
        options.onError(error as Error)
      }
      throw error
    }
  }

  /**
   * 播放指定类型的随机动画
   */
  async playRandomAnimationByType(type: AnimationType, options: AnimationPlayOptions = {}): Promise<void> {
    const animationsOfType = this.state.availableAnimations.filter(anim => anim.type === type)
    if (animationsOfType.length === 0) {
      throw new Error(`没有找到类型为 ${type} 的动画`)
    }

    const randomAnimation = animationsOfType[Math.floor(Math.random() * animationsOfType.length)]
    await this.playAnimation(randomAnimation, options)
  }

  /**
   * 停止动画
   */
  stopAnimation(): void {
    if (!this.animationManager) return
    this.animationManager.stopAnimation()
  }

  /**
   * 暂停动画
   */
  pauseAnimation(): void {
    if (!this.animationManager) return
    this.animationManager.pauseAnimation()
  }

  /**
   * 恢复动画
   */
  resumeAnimation(): void {
    if (!this.animationManager) return
    this.animationManager.resumeAnimation()
  }

  /**
   * 设置自动空闲播放
   */
  setAutoIdleEnabled(enabled: boolean, interval?: number): void {
    if (!this.animationManager) return

    this.state.autoIdleEnabled = enabled
    if (interval !== undefined) {
      this.state.autoIdleInterval = interval
    }

    if (enabled) {
      this.animationManager.startAutoIdleAnimation(this.state.autoIdleInterval)
    } else {
      this.animationManager.stopAutoIdleAnimation()
    }

    this.emit(AnimationControlEvent.AUTO_PLAY_CHANGED, {
      enabled: this.state.autoIdleEnabled,
      interval: this.state.autoIdleInterval
    })
  }

  /**
   * 添加动画到播放队列
   */
  addToQueue(config: AnimationConfig): void {
    this.state.playQueue.push(config)
    this.emit(AnimationControlEvent.QUEUE_UPDATED, { queue: [...this.state.playQueue] })
  }

  /**
   * 从播放队列移除动画
   */
  removeFromQueue(index: number): void {
    if (index >= 0 && index < this.state.playQueue.length) {
      this.state.playQueue.splice(index, 1)
      this.emit(AnimationControlEvent.QUEUE_UPDATED, { queue: [...this.state.playQueue] })
    }
  }

  /**
   * 清空播放队列
   */
  clearQueue(): void {
    this.state.playQueue.length = 0
    this.emit(AnimationControlEvent.QUEUE_UPDATED, { queue: [] })
  }

  /**
   * 播放队列中的下一个动画
   */
  async playNext(): Promise<void> {
    if (this.state.playQueue.length > 0) {
      const nextAnimation = this.state.playQueue.shift()!
      this.emit(AnimationControlEvent.QUEUE_UPDATED, { queue: [...this.state.playQueue] })
      await this.playAnimation(nextAnimation)
    }
  }

  /**
   * 添加到播放历史
   */
  private addToHistory(config: AnimationConfig): void {
    this.state.playHistory.unshift(config)
    if (this.state.playHistory.length > this.maxHistoryLength) {
      this.state.playHistory = this.state.playHistory.slice(0, this.maxHistoryLength)
    }
  }

  /**
   * 重播历史中的动画
   */
  async replayFromHistory(index: number): Promise<void> {
    if (index >= 0 && index < this.state.playHistory.length) {
      const config = this.state.playHistory[index]
      await this.playAnimation(config)
    }
  }

  /**
   * 更新可用动画列表
   */
  async updateAvailableAnimations(): Promise<void> {
    if (!this.animationManager) return

    try {
      const animations = this.animationManager.getAvailableAnimations()
      this.state.availableAnimations = animations
      this.emit(AnimationControlEvent.ANIMATIONS_UPDATED, { animations })
      
      console.log(`更新了 ${animations.length} 个可用动画`)
    } catch (error) {
      console.error('更新可用动画列表失败:', error)
      throw error
    }
  }

  /**
   * 注册新动画
   */
  registerAnimation(config: AnimationConfig): void {
    if (!this.animationManager) return

    this.animationManager.registerAnimation(config)
    this.updateAvailableAnimations()
  }

  /**
   * 获取当前状态
   */
  getState(): Readonly<AnimationControlState> {
    return { ...this.state }
  }

  /**
   * 获取指定类型的动画统计
   */
  getAnimationStats(): Map<AnimationType, number> {
    const stats = new Map<AnimationType, number>()
    
    this.state.availableAnimations.forEach(animation => {
      const count = stats.get(animation.type) || 0
      stats.set(animation.type, count + 1)
    })

    return stats
  }

  /**
   * 导出动画配置
   */
  exportAnimationConfigs(): AnimationConfig[] {
    return [...this.state.availableAnimations]
  }

  /**
   * 导入动画配置
   */
  importAnimationConfigs(configs: AnimationConfig[]): void {
    if (!this.animationManager) return

    configs.forEach(config => {
      this.animationManager!.registerAnimation(config)
    })

    this.updateAvailableAnimations()
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.animationManager) {
      this.animationManager.cleanup()
    }

    this.removeAllListeners()
    this.state = {
      currentPlayInfo: null,
      availableAnimations: [],
      isPlaying: false,
      isPaused: false,
      autoIdleEnabled: false,
      autoIdleInterval: 10000,
      playQueue: [],
      playHistory: []
    }

    this.isInitialized = false
    console.log('动画控制服务已清理')
  }

  /**
   * 检查服务是否已初始化
   */
  get initialized(): boolean {
    return this.isInitialized
  }

  /**
   * 获取动画管理器实例
   */
  get manager(): Live2DAnimationManager | null {
    return this.animationManager
  }
}

/**
 * 创建动画控制服务实例
 */
export function createAnimationControlService(): AnimationControlService {
  return new AnimationControlService()
}

/**
 * 单例动画控制服务
 */
let globalAnimationControlService: AnimationControlService | null = null

/**
 * 获取全局动画控制服务实例
 */
export function getGlobalAnimationControlService(): AnimationControlService {
  if (!globalAnimationControlService) {
    globalAnimationControlService = createAnimationControlService()
  }
  return globalAnimationControlService
}

/**
 * 清理全局动画控制服务
 */
export function cleanupGlobalAnimationControlService(): void {
  if (globalAnimationControlService) {
    globalAnimationControlService.cleanup()
    globalAnimationControlService = null
  }
}

export default AnimationControlService
