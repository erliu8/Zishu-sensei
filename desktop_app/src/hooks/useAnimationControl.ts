import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  AnimationControlService, 
  AnimationControlEvent, 
  AnimationControlState,
  AnimationPlayOptions 
} from '../services/animation/AnimationControlService'
import { 
  AnimationType, 
  AnimationConfig, 
  AnimationPlayInfo 
} from '../services/live2d/animation'

/**
 * 动画控制 Hook 返回值类型
 */
export interface UseAnimationControlReturn {
  // 状态
  currentPlayInfo: AnimationPlayInfo | null
  availableAnimations: AnimationConfig[]
  isPlaying: boolean
  isPaused: boolean
  autoIdleEnabled: boolean
  autoIdleInterval: number
  playQueue: AnimationConfig[]
  playHistory: AnimationConfig[]
  
  // 操作方法
  playAnimation: (config: AnimationConfig, options?: AnimationPlayOptions) => Promise<void>
  playRandomAnimationByType: (type: AnimationType, options?: AnimationPlayOptions) => Promise<void>
  stopAnimation: () => void
  pauseAnimation: () => void
  resumeAnimation: () => void
  setAutoIdleEnabled: (enabled: boolean, interval?: number) => void
  addToQueue: (config: AnimationConfig) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  playNext: () => Promise<void>
  replayFromHistory: (index: number) => Promise<void>
  
  // 工具方法
  getAnimationStats: () => Map<AnimationType, number>
  getAnimationsByType: (type: AnimationType) => AnimationConfig[]
  registerAnimation: (config: AnimationConfig) => void
  updateAvailableAnimations: () => Promise<void>
}

/**
 * 动画控制 Hook
 * 提供动画控制服务的React状态管理
 */
export function useAnimationControl(
  animationControlService: AnimationControlService
): UseAnimationControlReturn {
  // 状态管理
  const [state, setState] = useState<AnimationControlState>(() => 
    animationControlService.getState()
  )
  
  // 错误状态
  const [lastError, setLastError] = useState<Error | null>(null)
  
  // 避免重复监听的引用
  const eventListenersRef = useRef<Map<string, Function>>(new Map())

  // 更新状态的辅助函数
  const updateState = useCallback(() => {
    setState(animationControlService.getState())
  }, [animationControlService])

  // 设置事件监听器
  useEffect(() => {
    const listeners = eventListenersRef.current

    // 动画开始
    const onAnimationStart = () => {
      updateState()
      setLastError(null)
    }
    
    // 动画完成
    const onAnimationComplete = () => {
      updateState()
    }
    
    // 动画停止
    const onAnimationStop = () => {
      updateState()
    }
    
    // 动画暂停
    const onAnimationPause = () => {
      updateState()
    }
    
    // 动画恢复
    const onAnimationResume = () => {
      updateState()
    }
    
    // 动画错误
    const onAnimationError = (data: { error: Error }) => {
      updateState()
      setLastError(data.error)
      console.error('动画播放错误:', data.error)
    }
    
    // 可用动画更新
    const onAnimationsUpdated = () => {
      updateState()
    }
    
    // 自动播放状态改变
    const onAutoPlayChanged = () => {
      updateState()
    }
    
    // 队列更新
    const onQueueUpdated = () => {
      updateState()
    }

    // 添加监听器
    listeners.set(AnimationControlEvent.ANIMATION_START, onAnimationStart)
    listeners.set(AnimationControlEvent.ANIMATION_COMPLETE, onAnimationComplete)
    listeners.set(AnimationControlEvent.ANIMATION_STOP, onAnimationStop)
    listeners.set(AnimationControlEvent.ANIMATION_PAUSE, onAnimationPause)
    listeners.set(AnimationControlEvent.ANIMATION_RESUME, onAnimationResume)
    listeners.set(AnimationControlEvent.ANIMATION_ERROR, onAnimationError)
    listeners.set(AnimationControlEvent.ANIMATIONS_UPDATED, onAnimationsUpdated)
    listeners.set(AnimationControlEvent.AUTO_PLAY_CHANGED, onAutoPlayChanged)
    listeners.set(AnimationControlEvent.QUEUE_UPDATED, onQueueUpdated)

    // 注册所有监听器
    listeners.forEach((listener, event) => {
      animationControlService.on(event, listener)
    })

    // 初始化状态
    updateState()

    // 清理监听器
    return () => {
      listeners.forEach((listener, event) => {
        animationControlService.off(event, listener)
      })
      listeners.clear()
    }
  }, [animationControlService, updateState])

  // 播放动画
  const playAnimation = useCallback(async (
    config: AnimationConfig, 
    options: AnimationPlayOptions = {}
  ): Promise<void> => {
    try {
      await animationControlService.playAnimation(config, options)
    } catch (error) {
      setLastError(error as Error)
      throw error
    }
  }, [animationControlService])

  // 播放指定类型的随机动画
  const playRandomAnimationByType = useCallback(async (
    type: AnimationType, 
    options: AnimationPlayOptions = {}
  ): Promise<void> => {
    try {
      await animationControlService.playRandomAnimationByType(type, options)
    } catch (error) {
      setLastError(error as Error)
      throw error
    }
  }, [animationControlService])

  // 停止动画
  const stopAnimation = useCallback(() => {
    animationControlService.stopAnimation()
  }, [animationControlService])

  // 暂停动画
  const pauseAnimation = useCallback(() => {
    animationControlService.pauseAnimation()
  }, [animationControlService])

  // 恢复动画
  const resumeAnimation = useCallback(() => {
    animationControlService.resumeAnimation()
  }, [animationControlService])

  // 设置自动空闲播放
  const setAutoIdleEnabled = useCallback((enabled: boolean, interval?: number) => {
    animationControlService.setAutoIdleEnabled(enabled, interval)
  }, [animationControlService])

  // 添加到队列
  const addToQueue = useCallback((config: AnimationConfig) => {
    animationControlService.addToQueue(config)
  }, [animationControlService])

  // 从队列移除
  const removeFromQueue = useCallback((index: number) => {
    animationControlService.removeFromQueue(index)
  }, [animationControlService])

  // 清空队列
  const clearQueue = useCallback(() => {
    animationControlService.clearQueue()
  }, [animationControlService])

  // 播放下一个
  const playNext = useCallback(async (): Promise<void> => {
    try {
      await animationControlService.playNext()
    } catch (error) {
      setLastError(error as Error)
      throw error
    }
  }, [animationControlService])

  // 重播历史动画
  const replayFromHistory = useCallback(async (index: number): Promise<void> => {
    try {
      await animationControlService.replayFromHistory(index)
    } catch (error) {
      setLastError(error as Error)
      throw error
    }
  }, [animationControlService])

  // 获取动画统计
  const getAnimationStats = useCallback(() => {
    return animationControlService.getAnimationStats()
  }, [animationControlService])

  // 按类型获取动画
  const getAnimationsByType = useCallback((type: AnimationType) => {
    return state.availableAnimations.filter(anim => anim.type === type)
  }, [state.availableAnimations])

  // 注册动画
  const registerAnimation = useCallback((config: AnimationConfig) => {
    animationControlService.registerAnimation(config)
  }, [animationControlService])

  // 更新可用动画列表
  const updateAvailableAnimations = useCallback(async (): Promise<void> => {
    try {
      await animationControlService.updateAvailableAnimations()
    } catch (error) {
      setLastError(error as Error)
      throw error
    }
  }, [animationControlService])

  return {
    // 状态
    currentPlayInfo: state.currentPlayInfo,
    availableAnimations: state.availableAnimations,
    isPlaying: state.isPlaying,
    isPaused: state.isPaused,
    autoIdleEnabled: state.autoIdleEnabled,
    autoIdleInterval: state.autoIdleInterval,
    playQueue: state.playQueue,
    playHistory: state.playHistory,
    
    // 操作方法
    playAnimation,
    playRandomAnimationByType,
    stopAnimation,
    pauseAnimation,
    resumeAnimation,
    setAutoIdleEnabled,
    addToQueue,
    removeFromQueue,
    clearQueue,
    playNext,
    replayFromHistory,
    
    // 工具方法
    getAnimationStats,
    getAnimationsByType,
    registerAnimation,
    updateAvailableAnimations
  }
}

/**
 * 动画播放器状态 Hook
 * 简化版的动画控制，主要用于播放器UI组件
 */
export interface UseAnimationPlayerReturn {
  isPlaying: boolean
  isPaused: boolean
  currentAnimation: AnimationConfig | null
  progress: number
  duration: number
  
  play: () => void
  pause: () => void
  stop: () => void
  toggle: () => void
}

export function useAnimationPlayer(
  animationControlService: AnimationControlService,
  config?: AnimationConfig
): UseAnimationPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentAnimation, setCurrentAnimation] = useState<AnimationConfig | null>(config || null)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  // 监听动画状态变化
  useEffect(() => {
    const onAnimationStart = () => {
      setIsPlaying(true)
      setIsPaused(false)
      setProgress(0)
    }

    const onAnimationComplete = () => {
      setIsPlaying(false)
      setIsPaused(false)
      setProgress(100)
    }

    const onAnimationStop = () => {
      setIsPlaying(false)
      setIsPaused(false)
      setProgress(0)
    }

    const onAnimationPause = () => {
      setIsPaused(true)
    }

    const onAnimationResume = () => {
      setIsPaused(false)
    }

    animationControlService.on(AnimationControlEvent.ANIMATION_START, onAnimationStart)
    animationControlService.on(AnimationControlEvent.ANIMATION_COMPLETE, onAnimationComplete)
    animationControlService.on(AnimationControlEvent.ANIMATION_STOP, onAnimationStop)
    animationControlService.on(AnimationControlEvent.ANIMATION_PAUSE, onAnimationPause)
    animationControlService.on(AnimationControlEvent.ANIMATION_RESUME, onAnimationResume)

    return () => {
      animationControlService.off(AnimationControlEvent.ANIMATION_START, onAnimationStart)
      animationControlService.off(AnimationControlEvent.ANIMATION_COMPLETE, onAnimationComplete)
      animationControlService.off(AnimationControlEvent.ANIMATION_STOP, onAnimationStop)
      animationControlService.off(AnimationControlEvent.ANIMATION_PAUSE, onAnimationPause)
      animationControlService.off(AnimationControlEvent.ANIMATION_RESUME, onAnimationResume)
    }
  }, [animationControlService])

  // 播放
  const play = useCallback(async () => {
    if (currentAnimation) {
      try {
        await animationControlService.playAnimation(currentAnimation)
      } catch (error) {
        console.error('播放动画失败:', error)
      }
    }
  }, [animationControlService, currentAnimation])

  // 暂停
  const pause = useCallback(() => {
    animationControlService.pauseAnimation()
  }, [animationControlService])

  // 停止
  const stop = useCallback(() => {
    animationControlService.stopAnimation()
  }, [animationControlService])

  // 切换播放/暂停
  const toggle = useCallback(() => {
    if (isPlaying && !isPaused) {
      pause()
    } else if (isPaused) {
      animationControlService.resumeAnimation()
    } else {
      play()
    }
  }, [isPlaying, isPaused, play, pause, animationControlService])

  return {
    isPlaying,
    isPaused,
    currentAnimation,
    progress,
    duration,
    play,
    pause,
    stop,
    toggle
  }
}

/**
 * 动画预设 Hook
 * 管理预定义的动画配置
 */
export interface UseAnimationPresetsReturn {
  presets: Map<string, AnimationConfig>
  addPreset: (name: string, config: AnimationConfig) => void
  removePreset: (name: string) => void
  getPreset: (name: string) => AnimationConfig | undefined
  playPreset: (name: string) => Promise<void>
  exportPresets: () => string
  importPresets: (json: string) => void
}

export function useAnimationPresets(
  animationControlService: AnimationControlService
): UseAnimationPresetsReturn {
  const [presets, setPresets] = useState<Map<string, AnimationConfig>>(new Map())

  // 添加预设
  const addPreset = useCallback((name: string, config: AnimationConfig) => {
    setPresets(prev => new Map(prev).set(name, config))
  }, [])

  // 移除预设
  const removePreset = useCallback((name: string) => {
    setPresets(prev => {
      const newPresets = new Map(prev)
      newPresets.delete(name)
      return newPresets
    })
  }, [])

  // 获取预设
  const getPreset = useCallback((name: string) => {
    return presets.get(name)
  }, [presets])

  // 播放预设
  const playPreset = useCallback(async (name: string) => {
    const preset = presets.get(name)
    if (preset) {
      await animationControlService.playAnimation(preset)
    } else {
      throw new Error(`预设 '${name}' 不存在`)
    }
  }, [presets, animationControlService])

  // 导出预设
  const exportPresets = useCallback(() => {
    const presetsObject = Object.fromEntries(presets)
    return JSON.stringify(presetsObject, null, 2)
  }, [presets])

  // 导入预设
  const importPresets = useCallback((json: string) => {
    try {
      const presetsObject = JSON.parse(json)
      const newPresets = new Map(Object.entries(presetsObject))
      setPresets(newPresets)
    } catch (error) {
      throw new Error('导入预设失败: 无效的JSON格式')
    }
  }, [])

  return {
    presets,
    addPreset,
    removePreset,
    getPreset,
    playPreset,
    exportPresets,
    importPresets
  }
}

export default useAnimationControl
