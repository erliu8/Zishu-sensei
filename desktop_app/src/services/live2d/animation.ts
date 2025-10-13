import { Live2DModelInstance } from './loader'

/**
 * Live2D动画类型枚举
 */
export enum AnimationType {
  /** 空闲动画 */
  IDLE = 'idle',
  /** 点击动画 */
  TAP = 'tap',
  /** 拖拽动画 */
  DRAG = 'drag',
  /** 问候动画 */
  GREETING = 'greeting',
  /** 离别动画 */
  FAREWELL = 'farewell',
  /** 思考动画 */
  THINKING = 'thinking',
  /** 说话动画 */
  SPEAKING = 'speaking',
  /** 高兴动画 */
  HAPPY = 'happy',
  /** 惊讶动画 */
  SURPRISED = 'surprised',
  /** 困惑动画 */
  CONFUSED = 'confused',
  /** 睡觉动画 */
  SLEEPING = 'sleeping',
  /** 自定义动画 */
  CUSTOM = 'custom',
}

/**
 * 动画配置接口
 */
export interface AnimationConfig {
  /** 动画类型 */
  type: AnimationType
  /** 动画组名 */
  group: string
  /** 动画索引 */
  index?: number
  /** 播放优先级 */
  priority?: number
  /** 是否循环播放 */
  loop?: boolean
  /** 播放次数 */
  repeatCount?: number
  /** 淡入时间(毫秒) */
  fadeInTime?: number
  /** 淡出时间(毫秒) */
  fadeOutTime?: number
  /** 动画描述 */
  description?: string
  /** 触发条件 */
  trigger?: AnimationTrigger
}

/**
 * 动画触发条件
 */
export interface AnimationTrigger {
  /** 触发类型 */
  type: 'click' | 'hover' | 'time' | 'random' | 'custom'
  /** 触发区域 */
  area?: string[]
  /** 触发间隔(毫秒) */
  interval?: number
  /** 触发概率(0-1) */
  probability?: number
  /** 自定义触发条件 */
  condition?: () => boolean
}

/**
 * 动画播放状态
 */
export enum AnimationState {
  IDLE = 'idle',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
}

/**
 * 动画播放信息
 */
export interface AnimationPlayInfo {
  /** 动画配置 */
  config: AnimationConfig
  /** 播放状态 */
  state: AnimationState
  /** 开始时间 */
  startTime: number
  /** 已播放次数 */
  playedCount: number
  /** 剩余播放次数 */
  remainingCount: number
  /** 是否可以中断 */
  interruptible: boolean
}

/**
 * 动画管理器接口
 */
export interface IAnimationManager {
  /** 播放动画 */
  playAnimation(config: AnimationConfig): Promise<void>
  /** 停止动画 */
  stopAnimation(): void
  /** 暂停动画 */
  pauseAnimation(): void
  /** 恢复动画 */
  resumeAnimation(): void
  /** 获取当前播放信息 */
  getCurrentPlayInfo(): AnimationPlayInfo | null
  /** 注册动画配置 */
  registerAnimation(config: AnimationConfig): void
  /** 获取可用动画列表 */
  getAvailableAnimations(): AnimationConfig[]
}

/**
 * Live2D动画管理器
 */
export class Live2DAnimationManager implements IAnimationManager {
  private modelInstance: Live2DModelInstance | null = null
  private registeredAnimations = new Map<string, AnimationConfig>()
  private currentPlayInfo: AnimationPlayInfo | null = null
  private animationQueue: AnimationConfig[] = []
  private autoPlayTimer: number | null = null
  private eventListeners = new Map<string, Set<Function>>()

  // 默认动画映射
  private readonly defaultAnimationMapping = new Map<AnimationType, string[]>([
    [AnimationType.IDLE, ['Idle', 'Idle1', 'Idle2', 'Idle3']],
    [AnimationType.TAP, ['Tap', 'TapHead', 'TapBody', 'Touch']],
    [AnimationType.DRAG, ['Drag', 'Pull', 'Move']],
    [AnimationType.GREETING, ['Hello', 'Greeting', 'Wave']],
    [AnimationType.FAREWELL, ['Bye', 'Farewell', 'Goodbye']],
    [AnimationType.THINKING, ['Think', 'Thinking', 'Wonder']],
    [AnimationType.SPEAKING, ['Talk', 'Speaking', 'Speak']],
    [AnimationType.HAPPY, ['Happy', 'Joy', 'Smile', 'Laugh']],
    [AnimationType.SURPRISED, ['Surprise', 'Surprised', 'Shock']],
    [AnimationType.CONFUSED, ['Confused', 'Question', 'Puzzle']],
    [AnimationType.SLEEPING, ['Sleep', 'Sleeping', 'Rest']],
  ])

  /**
   * 设置模型实例
   */
  setModelInstance(modelInstance: Live2DModelInstance): void {
    this.modelInstance = modelInstance
    this.initializeDefaultAnimations()
  }

  /**
   * 初始化默认动画配置
   */
  private initializeDefaultAnimations(): void {
    if (!this.modelInstance) return

    const model = this.modelInstance.model
    const motionManager = model.internalModel.motionManager as any
    
    // 兼容性检查：不同版本的 API 可能有不同的方法名
    let availableGroups: string[] = []
    try {
      if (typeof motionManager.getMotionGroupNames === 'function') {
        availableGroups = motionManager.getMotionGroupNames()
      } else if (typeof motionManager.getGroupNames === 'function') {
        availableGroups = motionManager.getGroupNames()
      } else if (motionManager.groups) {
        // 如果有 groups 属性，尝试获取键名
        availableGroups = Object.keys(motionManager.groups)
      } else if (motionManager._groups) {
        // 尝试私有属性
        availableGroups = Object.keys(motionManager._groups)
      } else {
        console.warn('⚠️ 无法获取动画组列表，使用默认组名')
        availableGroups = ['idle', 'tap_body', 'flick_head', 'pinch_in', 'pinch_out']
      }
    } catch (error) {
      console.warn('⚠️ 获取动画组列表失败:', error)
      availableGroups = ['idle', 'tap_body', 'flick_head', 'pinch_in', 'pinch_out']
    }

    // 为每种动画类型查找可用的动画组
    for (const [type, groupNames] of this.defaultAnimationMapping) {
      for (const groupName of groupNames) {
        if (availableGroups.includes(groupName)) {
          // 兼容性检查：获取动画数量
          let motionCount = 0
          try {
            if (typeof motionManager.getMotionCount === 'function') {
              motionCount = motionManager.getMotionCount(groupName)
            } else if (typeof motionManager.getCount === 'function') {
              motionCount = motionManager.getCount(groupName)
            } else if (motionManager.groups && motionManager.groups[groupName]) {
              motionCount = motionManager.groups[groupName].length || 1
            } else if (motionManager._groups && motionManager._groups[groupName]) {
              motionCount = motionManager._groups[groupName].length || 1
            } else {
              console.warn(`⚠️ 无法获取动画组 ${groupName} 的动画数量，使用默认值 1`)
              motionCount = 1
            }
          } catch (error) {
            console.warn(`⚠️ 获取动画组 ${groupName} 的动画数量失败:`, error)
            motionCount = 1
          }
          
          // 注册该组的所有动画
          for (let i = 0; i < motionCount; i++) {
            const config: AnimationConfig = {
              type,
              group: groupName,
              index: i,
              priority: this.getDefaultPriority(type),
              description: `${type} - ${groupName}[${i}]`,
            }
            
            this.registerAnimation(config)
          }
          break // 找到第一个可用组就停止
        }
      }
    }

    console.log(`初始化了 ${this.registeredAnimations.size} 个动画配置`)
  }

  /**
   * 获取动画类型的默认优先级
   */
  private getDefaultPriority(type: AnimationType): number {
    const priorityMap = {
      [AnimationType.IDLE]: 1,
      [AnimationType.TAP]: 3,
      [AnimationType.DRAG]: 3,
      [AnimationType.GREETING]: 2,
      [AnimationType.FAREWELL]: 2,
      [AnimationType.THINKING]: 2,
      [AnimationType.SPEAKING]: 3,
      [AnimationType.HAPPY]: 2,
      [AnimationType.SURPRISED]: 3,
      [AnimationType.CONFUSED]: 2,
      [AnimationType.SLEEPING]: 1,
      [AnimationType.CUSTOM]: 2,
    }
    return priorityMap[type] || 2
  }

  /**
   * 播放动画
   */
  async playAnimation(config: AnimationConfig): Promise<void> {
    if (!this.modelInstance || !this.modelInstance.isReady) {
      throw new Error('模型未准备就绪')
    }

    try {
      // 检查是否有动画正在播放且不可中断
      if (this.currentPlayInfo && 
          this.currentPlayInfo.state === AnimationState.PLAYING &&
          !this.currentPlayInfo.interruptible) {
        // 添加到队列等待播放
        this.animationQueue.push(config)
        return
      }

      // 停止当前动画
      if (this.currentPlayInfo) {
        this.stopCurrentAnimation()
      }

      // 创建播放信息
      const playInfo: AnimationPlayInfo = {
        config,
        state: AnimationState.PLAYING,
        startTime: Date.now(),
        playedCount: 0,
        remainingCount: config.repeatCount || 1,
        interruptible: config.priority ? config.priority <= 2 : true,
      }

      this.currentPlayInfo = playInfo

      // 播放动画
      await this.executeAnimation(config)

      // 触发播放开始事件
      this.emit('animationStart', { config, playInfo })

      // 处理循环播放
      if (config.loop || (config.repeatCount && config.repeatCount > 1)) {
        this.handleLoopAnimation(config)
      }

    } catch (error) {
      console.error('播放动画失败:', error)
      this.emit('animationError', { config, error })
      throw error
    }
  }

  /**
   * 执行动画播放
   */
  private async executeAnimation(config: AnimationConfig): Promise<void> {
    if (!this.modelInstance) return

    const { model } = this.modelInstance
    const motionManager = model.internalModel.motionManager as any

    // ✨ [FIX] 先停止所有正在播放的动作，防止动画重叠
    if (motionManager && typeof motionManager.stopAllMotions === 'function') {
      motionManager.stopAllMotions()
    }

    // 设置淡入淡出时间
    if (config.fadeInTime && motionManager) {
      if (typeof motionManager.setFadeInTime === 'function') {
        motionManager.setFadeInTime(config.fadeInTime / 1000)
      }
    }
    if (config.fadeOutTime && motionManager) {
      if (typeof motionManager.setFadeOutTime === 'function') {
        motionManager.setFadeOutTime(config.fadeOutTime / 1000)
      }
    }

    // 播放动画
    let motionCount = 1
    if (motionManager && typeof motionManager.getMotionCount === 'function') {
      motionCount = motionManager.getMotionCount(config.group)
    }
    const motionIndex = config.index ?? Math.floor(Math.random() * motionCount)

    // 确保优先级始终有值
    // 使用更高的优先级来强制替换旧动画
    // 空闲动画使用低优先级 (1)，点击/交互动画使用最高优先级 (3)
    const isIdleAnimation = config.type === AnimationType.IDLE || 
                           config.group.toLowerCase().includes('idle')
    const defaultPriority = isIdleAnimation ? 1 : 3  // 非空闲动画使用优先级3
    const priority = config.priority ?? defaultPriority
    
    await model.motion(config.group, motionIndex, priority)

    // 更新播放信息
    if (this.currentPlayInfo) {
      this.currentPlayInfo.playedCount++
      this.currentPlayInfo.remainingCount--
    }
  }

  /**
   * 处理循环动画
   */
  private handleLoopAnimation(config: AnimationConfig): void {
    if (!this.currentPlayInfo) return

    const checkLoop = () => {
      if (!this.currentPlayInfo || this.currentPlayInfo.state !== AnimationState.PLAYING) {
        return
      }

      // 检查是否还需要继续播放
      if (config.loop || this.currentPlayInfo.remainingCount > 0) {
        setTimeout(async () => {
          try {
            await this.executeAnimation(config)
            checkLoop() // 递归检查下一次播放
          } catch (error) {
            console.error('循环动画播放失败:', error)
            this.stopAnimation()
          }
        }, 100) // 短暂延迟避免过于频繁
      } else {
        // 播放完成
        this.onAnimationComplete()
      }
    }

    // 监听动画完成事件
    const model = this.modelInstance?.model
    if (model) {
      const onMotionFinish = () => {
        model.off('motionFinish', onMotionFinish)
        checkLoop()
      }
      model.on('motionFinish', onMotionFinish)
    }
  }

  /**
   * 动画完成处理
   */
  private onAnimationComplete(): void {
    if (!this.currentPlayInfo) return

    const { config } = this.currentPlayInfo
    this.emit('animationComplete', { config, playInfo: this.currentPlayInfo })

    // 清理当前播放信息
    this.currentPlayInfo = null

    // 播放队列中的下一个动画
    this.playNextInQueue()
  }

  /**
   * 播放队列中的下一个动画
   */
  private async playNextInQueue(): Promise<void> {
    if (this.animationQueue.length > 0) {
      const nextConfig = this.animationQueue.shift()!
      try {
        await this.playAnimation(nextConfig)
      } catch (error) {
        console.error('播放队列动画失败:', error)
        // 继续播放下一个
        this.playNextInQueue()
      }
    }
  }

  /**
   * 停止当前动画
   */
  private stopCurrentAnimation(): void {
    if (this.currentPlayInfo) {
      this.currentPlayInfo.state = AnimationState.STOPPED
      this.emit('animationStop', { playInfo: this.currentPlayInfo })
      
      // 实际停止模型上正在播放的动画
      if (this.modelInstance?.model?.internalModel?.motionManager) {
        const motionManager = this.modelInstance.model.internalModel.motionManager
        // 尝试停止所有正在播放的动作
        if (typeof motionManager.stopAllMotions === 'function') {
          motionManager.stopAllMotions()
        }
        // 或者通过播放一个优先级最高的空闲动画来强制中断
        // 这样可以确保旧动画被完全替换
      }
    }
  }

  /**
   * 停止动画
   */
  stopAnimation(): void {
    this.stopCurrentAnimation()
    this.currentPlayInfo = null
    this.animationQueue.length = 0 // 清空队列
  }

  /**
   * 暂停动画
   */
  pauseAnimation(): void {
    if (this.currentPlayInfo && this.currentPlayInfo.state === AnimationState.PLAYING) {
      this.currentPlayInfo.state = AnimationState.PAUSED
      this.emit('animationPause', { playInfo: this.currentPlayInfo })
    }
  }

  /**
   * 恢复动画
   */
  resumeAnimation(): void {
    if (this.currentPlayInfo && this.currentPlayInfo.state === AnimationState.PAUSED) {
      this.currentPlayInfo.state = AnimationState.PLAYING
      this.emit('animationResume', { playInfo: this.currentPlayInfo })
    }
  }

  /**
   * 获取当前播放信息
   */
  getCurrentPlayInfo(): AnimationPlayInfo | null {
    return this.currentPlayInfo
  }

  /**
   * 注册动画配置
   */
  registerAnimation(config: AnimationConfig): void {
    const key = `${config.type}_${config.group}_${config.index || 0}`
    this.registeredAnimations.set(key, config)
  }

  /**
   * 获取可用动画列表
   */
  getAvailableAnimations(): AnimationConfig[] {
    return Array.from(this.registeredAnimations.values())
  }

  /**
   * 按类型获取动画配置
   */
  getAnimationsByType(type: AnimationType): AnimationConfig[] {
    return Array.from(this.registeredAnimations.values())
      .filter(config => config.type === type)
  }

  /**
   * 播放指定类型的随机动画
   */
  async playRandomAnimationByType(type: AnimationType): Promise<void> {
    const animations = this.getAnimationsByType(type)
    if (animations.length === 0) {
      throw new Error(`没有找到类型为 ${type} 的动画`)
    }

    const randomAnimation = animations[Math.floor(Math.random() * animations.length)]
    await this.playAnimation(randomAnimation)
  }

  /**
   * 开始自动播放空闲动画
   */
  startAutoIdleAnimation(interval: number = 10000): void {
    this.stopAutoIdleAnimation()

    // 若当前模型不含 idle 相关动作，则不启动定时器
    const hasIdle = this.getAnimationsByType(AnimationType.IDLE).length > 0
    if (!hasIdle) {
      console.warn('自动播放空闲动画失败: 没有找到类型为 idle 的动画')
      return
    }

    this.autoPlayTimer = setInterval(async () => {
      if (!this.currentPlayInfo || this.currentPlayInfo.state === AnimationState.IDLE) {
        try {
          await this.playRandomAnimationByType(AnimationType.IDLE)
        } catch (error) {
          console.warn('自动播放空闲动画失败:', error)
        }
      }
    }, interval) as unknown as number

    console.log(`开始自动播放空闲动画，间隔: ${interval}ms`)
  }

  /**
   * 停止自动播放空闲动画
   */
  stopAutoIdleAnimation(): void {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer)
      this.autoPlayTimer = null
      console.log('停止自动播放空闲动画')
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopAnimation()
    this.stopAutoIdleAnimation()
    this.registeredAnimations.clear()
    this.animationQueue.length = 0
    this.eventListeners.clear()
    this.modelInstance = null
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
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data)
        } catch (error) {
          console.error('动画事件监听器执行失败:', error)
        }
      })
    }
  }
}

/**
 * 创建动画管理器实例
 */
export function createAnimationManager(): Live2DAnimationManager {
  return new Live2DAnimationManager()
}

/**
 * 预定义的动画配置
 */
export const predefinedAnimations = {
  // 问候动画
  greeting: {
    type: AnimationType.GREETING,
    group: 'Hello',
    priority: 2,
    description: '问候动画',
  } as AnimationConfig,

  // 点击动画
  tap: {
    type: AnimationType.TAP,
    group: 'Tap',
    priority: 3,
    description: '点击动画',
  } as AnimationConfig,

  // 空闲动画
  idle: {
    type: AnimationType.IDLE,
    group: 'Idle',
    priority: 1,
    loop: true,
    description: '空闲动画',
  } as AnimationConfig,

  // 高兴动画
  happy: {
    type: AnimationType.HAPPY,
    group: 'Happy',
    priority: 2,
    description: '高兴动画',
  } as AnimationConfig,
}

export default Live2DAnimationManager
