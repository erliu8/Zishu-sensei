/**
 * 音效 Hook
 * @module hooks/useSound
 * @description React Hook封装音效功能，方便在组件中使用
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { getSoundManager } from '@/services/sound/SoundManager'
import type {
  SoundPlayOptions,
  SoundStopOptions,
  SoundLoadProgress,
  SoundStats,
  SoundManagerEvent,
} from '@/types/sound'

/**
 * 音效播放 Hook 返回值
 */
export interface UseSoundReturn {
  /** 播放音效 */
  play: (options?: SoundPlayOptions) => Promise<void>
  /** 停止音效 */
  stop: (options?: SoundStopOptions) => Promise<void>
  /** 暂停音效 */
  pause: () => void
  /** 恢复播放 */
  resume: () => Promise<void>
  /** 是否正在播放 */
  isPlaying: boolean
  /** 是否正在加载 */
  isLoading: boolean
  /** 加载错误 */
  error: Error | null
}

/**
 * 使用单个音效
 */
export function useSound(soundId: string): UseSoundReturn {
  const soundManager = getSoundManager()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!soundManager) return

    const handlePlay = (event: any) => {
      if (event.soundId === soundId) {
        setIsPlaying(true)
      }
    }

    const handleStop = (event: any) => {
      if (event.soundId === soundId) {
        setIsPlaying(false)
      }
    }

    const handleEnd = (event: any) => {
      if (event.soundId === soundId) {
        setIsPlaying(false)
      }
    }

    const handleError = (event: any) => {
      if (event.soundId === soundId) {
        setIsPlaying(false)
        setError(event.error)
      }
    }

    soundManager.on('sound:play', handlePlay)
    soundManager.on('sound:stop', handleStop)
    soundManager.on('sound:end', handleEnd)
    soundManager.on('sound:error', handleError)

    return () => {
      soundManager.off('sound:play', handlePlay)
      soundManager.off('sound:stop', handleStop)
      soundManager.off('sound:end', handleEnd)
      soundManager.off('sound:error', handleError)
    }
  }, [soundId, soundManager])

  const play = useCallback(
    async (options?: SoundPlayOptions) => {
      if (!soundManager) {
        console.warn('音效管理器未初始化')
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        await soundManager.play(soundId, options)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    },
    [soundId, soundManager]
  )

  const stop = useCallback(
    async (options?: SoundStopOptions) => {
      if (!soundManager) return

      try {
        await soundManager.stop(soundId, options)
      } catch (err) {
        setError(err as Error)
      }
    },
    [soundId, soundManager]
  )

  const pause = useCallback(() => {
    if (!soundManager) return

    try {
      soundManager.pause(soundId)
      setIsPlaying(false)
    } catch (err) {
      setError(err as Error)
    }
  }, [soundId, soundManager])

  const resume = useCallback(async () => {
    if (!soundManager) return

    try {
      await soundManager.resume(soundId)
      setIsPlaying(true)
    } catch (err) {
      setError(err as Error)
    }
  }, [soundId, soundManager])

  return {
    play,
    stop,
    pause,
    resume,
    isPlaying,
    isLoading,
    error,
  }
}

/**
 * 音效管理器 Hook 返回值
 */
export interface UseSoundManagerReturn {
  /** 播放音效 */
  play: (soundId: string, options?: SoundPlayOptions) => Promise<void>
  /** 停止音效 */
  stop: (soundId: string, options?: SoundStopOptions) => Promise<void>
  /** 停止所有音效 */
  stopAll: (options?: SoundStopOptions) => Promise<void>
  /** 设置全局音量 */
  setVolume: (volume: number) => void
  /** 设置全局静音 */
  setMuted: (muted: boolean) => void
  /** 设置音效音量 */
  setSoundVolume: (soundId: string, volume: number) => void
  /** 设置分组音量 */
  setGroupVolume: (groupId: string, volume: number) => void
  /** 设置分组静音 */
  setGroupMuted: (groupId: string, muted: boolean) => void
  /** 统计信息 */
  stats: SoundStats | null
  /** 是否已初始化 */
  isReady: boolean
}

/**
 * 使用音效管理器
 */
export function useSoundManager(): UseSoundManagerReturn {
  const soundManager = getSoundManager()
  const [stats, setStats] = useState<SoundStats | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (soundManager) {
      setIsReady(true)
      // 定期更新统计信息
      const interval = setInterval(() => {
        setStats(soundManager.getStats())
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [soundManager])

  const play = useCallback(
    async (soundId: string, options?: SoundPlayOptions) => {
      if (!soundManager) return
      await soundManager.play(soundId, options)
    },
    [soundManager]
  )

  const stop = useCallback(
    async (soundId: string, options?: SoundStopOptions) => {
      if (!soundManager) return
      await soundManager.stop(soundId, options)
    },
    [soundManager]
  )

  const stopAll = useCallback(
    async (options?: SoundStopOptions) => {
      if (!soundManager) return
      await soundManager.stopAll(options)
    },
    [soundManager]
  )

  const setVolume = useCallback(
    (volume: number) => {
      if (!soundManager) return
      soundManager.setGlobalVolume(volume)
    },
    [soundManager]
  )

  const setMuted = useCallback(
    (muted: boolean) => {
      if (!soundManager) return
      soundManager.setGlobalMuted(muted)
    },
    [soundManager]
  )

  const setSoundVolume = useCallback(
    (soundId: string, volume: number) => {
      if (!soundManager) return
      soundManager.setSoundVolume(soundId, volume)
    },
    [soundManager]
  )

  const setGroupVolume = useCallback(
    (groupId: string, volume: number) => {
      if (!soundManager) return
      soundManager.setGroupVolume(groupId, volume)
    },
    [soundManager]
  )

  const setGroupMuted = useCallback(
    (groupId: string, muted: boolean) => {
      if (!soundManager) return
      soundManager.setGroupMuted(groupId, muted)
    },
    [soundManager]
  )

  return {
    play,
    stop,
    stopAll,
    setVolume,
    setMuted,
    setSoundVolume,
    setGroupVolume,
    setGroupMuted,
    stats,
    isReady,
  }
}

/**
 * 音效加载进度 Hook
 */
export function useSoundLoadProgress(): SoundLoadProgress | null {
  const soundManager = getSoundManager()
  const [progress, setProgress] = useState<SoundLoadProgress | null>(null)

  useEffect(() => {
    if (!soundManager) return

    const handleProgress = (event: SoundLoadProgress) => {
      setProgress(event)
    }

    soundManager.on('load:progress', handleProgress)

    return () => {
      soundManager.off('load:progress', handleProgress)
    }
  }, [soundManager])

  return progress
}

/**
 * UI 音效快捷 Hook
 */
export function useUISound() {
  const soundManager = getSoundManager()

  const playClick = useCallback(() => {
    soundManager?.play('ui_click', { volume: 0.6 })
  }, [soundManager])

  const playHover = useCallback(() => {
    soundManager?.play('ui_hover', { volume: 0.4 })
  }, [soundManager])

  const playSuccess = useCallback(() => {
    soundManager?.play('ui_success', { volume: 0.8 })
  }, [soundManager])

  const playError = useCallback(() => {
    soundManager?.play('ui_error', { volume: 0.7 })
  }, [soundManager])

  const playWarning = useCallback(() => {
    soundManager?.play('ui_warning', { volume: 0.7 })
  }, [soundManager])

  const playOpen = useCallback(() => {
    soundManager?.play('ui_open', { volume: 0.7, fadeIn: 100 })
  }, [soundManager])

  const playClose = useCallback(() => {
    soundManager?.play('ui_close', { volume: 0.7 })
  }, [soundManager])

  return {
    playClick,
    playHover,
    playSuccess,
    playError,
    playWarning,
    playOpen,
    playClose,
  }
}

/**
 * 角色音效快捷 Hook
 */
export function useCharacterSound() {
  const soundManager = getSoundManager()

  const playTap = useCallback(() => {
    soundManager?.play('character_tap', { volume: 0.7 })
  }, [soundManager])

  const playHappy = useCallback(() => {
    soundManager?.play('character_happy', { volume: 0.8 })
  }, [soundManager])

  const playSad = useCallback(() => {
    soundManager?.play('character_sad', { volume: 0.6 })
  }, [soundManager])

  const playSurprised = useCallback(() => {
    soundManager?.play('character_surprised', { volume: 0.8 })
  }, [soundManager])

  const playGreeting = useCallback(() => {
    soundManager?.play('character_greeting', { volume: 0.8 })
  }, [soundManager])

  const playGoodbye = useCallback(() => {
    soundManager?.play('character_goodbye', { volume: 0.7 })
  }, [soundManager])

  return {
    playTap,
    playHappy,
    playSad,
    playSurprised,
    playGreeting,
    playGoodbye,
  }
}

/**
 * 对话音效快捷 Hook
 */
export function useChatSound() {
  const soundManager = getSoundManager()

  const playSend = useCallback(() => {
    soundManager?.play('chat_send', { volume: 0.7 })
  }, [soundManager])

  const playReceive = useCallback(() => {
    soundManager?.play('chat_receive', { volume: 0.7 })
  }, [soundManager])

  const playVoiceStart = useCallback(() => {
    soundManager?.play('chat_voice_start', { volume: 0.8 })
  }, [soundManager])

  const playVoiceEnd = useCallback(() => {
    soundManager?.play('chat_voice_end', { volume: 0.7 })
  }, [soundManager])

  const playVoiceError = useCallback(() => {
    soundManager?.play('chat_voice_error', { volume: 0.7 })
  }, [soundManager])

  return {
    playSend,
    playReceive,
    playVoiceStart,
    playVoiceEnd,
    playVoiceError,
  }
}

/**
 * 通知音效快捷 Hook
 */
export function useNotificationSound() {
  const soundManager = getSoundManager()

  const playInfo = useCallback(() => {
    soundManager?.play('notification_info', { volume: 0.7 })
  }, [soundManager])

  const playSuccess = useCallback(() => {
    soundManager?.play('notification_success', { volume: 0.8 })
  }, [soundManager])

  const playWarning = useCallback(() => {
    soundManager?.play('notification_warning', { volume: 0.8 })
  }, [soundManager])

  const playError = useCallback(() => {
    soundManager?.play('notification_error', { volume: 0.8 })
  }, [soundManager])

  const playMessage = useCallback(() => {
    soundManager?.play('notification_message', { volume: 0.7 })
  }, [soundManager])

  return {
    playInfo,
    playSuccess,
    playWarning,
    playError,
    playMessage,
  }
}

/**
 * 音效事件监听 Hook
 */
export function useSoundEvent(
  event: SoundManagerEvent,
  handler: (data: any) => void,
  deps: any[] = []
) {
  const soundManager = getSoundManager()
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!soundManager) return

    const eventHandler = (data: any) => {
      handlerRef.current(data)
    }

    soundManager.on(event, eventHandler)

    return () => {
      soundManager.off(event, eventHandler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, soundManager, ...deps])
}

/**
 * 自动播放音效 Hook
 * @param soundId 音效ID
 * @param trigger 触发条件
 * @param options 播放选项
 */
export function useAutoSound(
  soundId: string,
  trigger: boolean,
  options?: SoundPlayOptions
) {
  const { play } = useSound(soundId)
  const prevTriggerRef = useRef(trigger)

  useEffect(() => {
    if (trigger && !prevTriggerRef.current) {
      play(options)
    }
    prevTriggerRef.current = trigger
  }, [trigger, play, options])
}

/**
 * 音效队列播放 Hook
 */
export function useSoundQueue() {
  const soundManager = getSoundManager()
  const [queue, setQueue] = useState<string[]>([])
  const [isPlaying, setIsPlaying] = useState(false)

  const addToQueue = useCallback((soundId: string) => {
    setQueue((prev) => [...prev, soundId])
  }, [])

  const clearQueue = useCallback(() => {
    setQueue([])
  }, [])

  useEffect(() => {
    if (!soundManager || queue.length === 0 || isPlaying) return

    const playNext = async () => {
      setIsPlaying(true)
      const soundId = queue[0]

      try {
        await soundManager.play(soundId, {
          onEnd: () => {
            setQueue((prev) => prev.slice(1))
            setIsPlaying(false)
          },
        })
      } catch (error) {
        console.error('队列播放失败:', error)
        setQueue((prev) => prev.slice(1))
        setIsPlaying(false)
      }
    }

    playNext()
  }, [soundManager, queue, isPlaying])

  return {
    addToQueue,
    clearQueue,
    queue,
    isPlaying,
  }
}

