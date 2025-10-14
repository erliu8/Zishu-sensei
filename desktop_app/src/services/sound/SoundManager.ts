/**
 * 音效管理器
 * @module services/sound/SoundManager
 * @description 完整的音效管理系统，支持音效加载、播放、控制、淡入淡出等功能
 */

import type {
  SoundConfig,
  SoundInstance,
  SoundManagerConfig,
  SoundPlayOptions,
  SoundStopOptions,
  SoundLoadProgress,
  SoundStats,
  SoundGroup,
  SoundManagerEvent,
  SoundManagerEventHandler,
  SoundFadeController,
} from '@/types/sound'
import { SoundState, SoundError, SoundPriority } from '@/types/sound'
import { DEFAULT_SOUND_MANAGER_CONFIG } from '@/constants/sounds'

/**
 * 音效管理器类
 */
export class SoundManager {
  private config: SoundManagerConfig
  private sounds: Map<string, SoundInstance> = new Map()
  private playingSounds: Set<string> = new Set()
  private eventListeners: Map<SoundManagerEvent, Set<SoundManagerEventHandler>> = new Map()
  private groups: Map<string, SoundGroup> = new Map()
  private fadeControllers: Map<string, SoundFadeController> = new Map()
  private loadingPromises: Map<string, Promise<void>> = new Map()
  private initialized = false

  constructor(config: Partial<SoundManagerConfig> = {}) {
    this.config = { ...DEFAULT_SOUND_MANAGER_CONFIG, ...config }
    this.log('音效管理器已创建', this.config)
  }

  /**
   * 初始化音效管理器
   */
  async initialize(soundConfigs: SoundConfig[]): Promise<void> {
    if (this.initialized) {
      this.log('音效管理器已经初始化')
      return
    }

    this.log('开始初始化音效管理器', soundConfigs.length)

    try {
      // 注册所有音效
      for (const soundConfig of soundConfigs) {
        this.registerSound(soundConfig)
      }

      // 预加载需要预加载的音效
      if (this.config.cacheStrategy === 'preload') {
        const preloadSounds = soundConfigs.filter((config) => config.preload)
        await this.preloadSounds(preloadSounds.map((s) => s.id))
      }

      this.initialized = true
      this.log('音效管理器初始化完成')
    } catch (error) {
      this.error('音效管理器初始化失败', error)
      throw new SoundError(
        '音效管理器初始化失败',
        'INIT_FAILED',
        undefined,
        error as Error
      )
    }
  }

  /**
   * 注册音效
   */
  private registerSound(config: SoundConfig): void {
    const soundInstance: SoundInstance = {
      id: config.id,
      config,
      audio: new Audio(),
      state: SoundState.UNLOADED,
      volume: config.volume ?? 1.0,
      muted: false,
      progress: 0,
      createdAt: Date.now(),
    }

    // 设置音频属性
    soundInstance.audio.volume = this.calculateVolume(soundInstance)
    soundInstance.audio.loop = config.playMode === 'loop'
    soundInstance.audio.playbackRate = config.playbackRate ?? 1.0

    // 绑定事件监听
    this.bindAudioEvents(soundInstance)

    this.sounds.set(config.id, soundInstance)
    this.log(`音效已注册: ${config.id}`)
  }

  /**
   * 绑定音频事件
   */
  private bindAudioEvents(instance: SoundInstance): void {
    const { audio, id } = instance

    // 加载完成
    audio.addEventListener('canplaythrough', () => {
      if (instance.state === SoundState.LOADING) {
        instance.state = SoundState.LOADED
        this.emit('sound:loaded', { soundId: id })
        this.log(`音效加载完成: ${id}`)
      }
    })

    // 播放
    audio.addEventListener('play', () => {
      instance.state = SoundState.PLAYING
      instance.lastPlayedAt = Date.now()
      this.playingSounds.add(id)
      this.emit('sound:play', { soundId: id, timestamp: Date.now() })
      this.log(`音效开始播放: ${id}`)
    })

    // 暂停
    audio.addEventListener('pause', () => {
      if (instance.state === SoundState.PLAYING) {
        instance.state = SoundState.PAUSED
        this.playingSounds.delete(id)
        this.emit('sound:pause', { soundId: id, timestamp: Date.now() })
        this.log(`音效暂停: ${id}`)
      }
    })

    // 结束
    audio.addEventListener('ended', () => {
      if (!audio.loop) {
        instance.state = SoundState.STOPPED
        this.playingSounds.delete(id)
        this.emit('sound:end', { soundId: id, timestamp: Date.now() })
        this.log(`音效播放结束: ${id}`)
      }
    })

    // 播放进度更新
    audio.addEventListener('timeupdate', () => {
      if (audio.duration > 0) {
        instance.progress = audio.currentTime / audio.duration
      }
    })

    // 错误处理
    audio.addEventListener('error', (e) => {
      instance.state = SoundState.ERROR
      this.playingSounds.delete(id)
      const error = new SoundError(
        `音效加载/播放失败: ${id}`,
        'AUDIO_ERROR',
        id,
        e.error
      )
      this.emit('sound:error', { soundId: id, error, timestamp: Date.now() })
      this.error(`音效错误: ${id}`, e.error)
    })
  }

  /**
   * 预加载音效列表
   */
  async preloadSounds(soundIds: string[]): Promise<void> {
    this.log('开始预加载音效', soundIds)

    const total = soundIds.length
    let loaded = 0
    const failed: string[] = []

    const progress: SoundLoadProgress = {
      loaded: 0,
      total,
      percentage: 0,
      failed: [],
    }

    for (const soundId of soundIds) {
      try {
        progress.currentSound = soundId
        this.emit('load:progress', progress)

        await this.loadSound(soundId)
        loaded++
        progress.loaded = loaded
        progress.percentage = Math.round((loaded / total) * 100)
      } catch (error) {
        this.error(`预加载音效失败: ${soundId}`, error)
        failed.push(soundId)
        progress.failed = failed
      }
    }

    this.emit('load:complete', progress)
    this.log('音效预加载完成', progress)

    if (failed.length > 0) {
      this.warn(`${failed.length} 个音效加载失败:`, failed)
    }
  }

  /**
   * 加载单个音效
   */
  async loadSound(soundId: string): Promise<void> {
    const instance = this.sounds.get(soundId)
    if (!instance) {
      throw new SoundError(`音效不存在: ${soundId}`, 'SOUND_NOT_FOUND', soundId)
    }

    // 如果已经在加载中，返回现有的 Promise
    if (this.loadingPromises.has(soundId)) {
      return this.loadingPromises.get(soundId)
    }

    // 如果已经加载完成，直接返回
    if (instance.state === SoundState.LOADED) {
      return Promise.resolve()
    }

    // 创建加载 Promise
    const loadPromise = new Promise<void>((resolve, reject) => {
      instance.state = SoundState.LOADING

      const onCanPlay = () => {
        cleanup()
        resolve()
      }

      const onError = (e: ErrorEvent) => {
        cleanup()
        reject(
          new SoundError(
            `音效加载失败: ${soundId}`,
            'LOAD_FAILED',
            soundId,
            e.error
          )
        )
      }

      const cleanup = () => {
        instance.audio.removeEventListener('canplaythrough', onCanPlay)
        instance.audio.removeEventListener('error', onError)
        this.loadingPromises.delete(soundId)
      }

      instance.audio.addEventListener('canplaythrough', onCanPlay, { once: true })
      instance.audio.addEventListener('error', onError, { once: true })

      // 开始加载
      const path = this.resolveSoundPath(instance.config.path)
      instance.audio.src = path
      instance.audio.load()
    })

    this.loadingPromises.set(soundId, loadPromise)
    return loadPromise
  }

  /**
   * 播放音效
   */
  async play(soundId: string, options: SoundPlayOptions = {}): Promise<void> {
    const instance = this.sounds.get(soundId)
    if (!instance) {
      throw new SoundError(`音效不存在: ${soundId}`, 'SOUND_NOT_FOUND', soundId)
    }

    // 检查最大并发数
    if (
      this.config.maxConcurrent &&
      this.playingSounds.size >= this.config.maxConcurrent
    ) {
      this.log(`达到最大并发数限制 (${this.config.maxConcurrent})，跳过播放: ${soundId}`)
      return
    }

    try {
      // 确保音效已加载
      if (instance.state === SoundState.UNLOADED) {
        await this.loadSound(soundId)
      }

      // 应用播放选项
      if (options.volume !== undefined) {
        instance.volume = options.volume
      }
      if (options.playbackRate !== undefined) {
        instance.audio.playbackRate = options.playbackRate
      }
      if (options.loop !== undefined) {
        instance.audio.loop = options.loop
      }
      if (options.startTime !== undefined) {
        instance.audio.currentTime = options.startTime
      }

      // 更新音量
      instance.audio.volume = this.calculateVolume(instance)

      // 延迟播放
      if (options.delay && options.delay > 0) {
        await this.delay(options.delay)
      }

      // 播放音频
      const playPromise = instance.audio.play()

      if (playPromise !== undefined) {
        await playPromise

        // 淡入效果
        const fadeInDuration =
          options.fadeIn ?? instance.config.fadeInDuration ?? this.config.defaultFadeIn ?? 0

        if (fadeInDuration > 0) {
          await this.fadeIn(soundId, fadeInDuration)
        }

        // 播放结束回调
        if (options.onEnd) {
          const onEndListener = () => {
            options.onEnd!()
            instance.audio.removeEventListener('ended', onEndListener)
          }
          instance.audio.addEventListener('ended', onEndListener)
        }
      }
    } catch (error) {
      instance.state = SoundState.ERROR
      const soundError = new SoundError(
        `音效播放失败: ${soundId}`,
        'PLAY_FAILED',
        soundId,
        error as Error
      )

      if (options.onError) {
        options.onError(soundError)
      }

      throw soundError
    }
  }

  /**
   * 停止音效
   */
  async stop(soundId: string, options: SoundStopOptions = {}): Promise<void> {
    const instance = this.sounds.get(soundId)
    if (!instance) {
      throw new SoundError(`音效不存在: ${soundId}`, 'SOUND_NOT_FOUND', soundId)
    }

    // 淡出效果
    const fadeOutDuration =
      options.fadeOut ?? instance.config.fadeOutDuration ?? this.config.defaultFadeOut ?? 0

    if (fadeOutDuration > 0 && instance.state === SoundState.PLAYING) {
      await this.fadeOut(soundId, fadeOutDuration)
    }

    // 停止播放
    instance.audio.pause()
    instance.audio.currentTime = 0
    instance.state = SoundState.STOPPED
    this.playingSounds.delete(soundId)

    this.emit('sound:stop', { soundId, timestamp: Date.now() })
  }

  /**
   * 暂停音效
   */
  pause(soundId: string): void {
    const instance = this.sounds.get(soundId)
    if (!instance) {
      throw new SoundError(`音效不存在: ${soundId}`, 'SOUND_NOT_FOUND', soundId)
    }

    if (instance.state === SoundState.PLAYING) {
      instance.audio.pause()
    }
  }

  /**
   * 恢复播放
   */
  async resume(soundId: string): Promise<void> {
    const instance = this.sounds.get(soundId)
    if (!instance) {
      throw new SoundError(`音效不存在: ${soundId}`, 'SOUND_NOT_FOUND', soundId)
    }

    if (instance.state === SoundState.PAUSED) {
      await instance.audio.play()
    }
  }

  /**
   * 停止所有音效
   */
  async stopAll(options: SoundStopOptions = {}): Promise<void> {
    const stopPromises = Array.from(this.playingSounds).map((soundId) =>
      this.stop(soundId, options)
    )
    await Promise.all(stopPromises)
  }

  /**
   * 淡入效果
   */
  async fadeIn(soundId: string, duration: number): Promise<void> {
    const instance = this.sounds.get(soundId)
    if (!instance) return

    const targetVolume = this.calculateVolume(instance)
    const startVolume = 0

    return this.createFadeController(soundId, startVolume, targetVolume, duration)
  }

  /**
   * 淡出效果
   */
  async fadeOut(soundId: string, duration: number): Promise<void> {
    const instance = this.sounds.get(soundId)
    if (!instance) return

    const startVolume = instance.audio.volume
    const targetVolume = 0

    return this.createFadeController(soundId, startVolume, targetVolume, duration)
  }

  /**
   * 创建淡入淡出控制器
   */
  private createFadeController(
    soundId: string,
    startVolume: number,
    targetVolume: number,
    duration: number
  ): Promise<void> {
    const instance = this.sounds.get(soundId)
    if (!instance) return Promise.resolve()

    // 取消之前的淡入淡出
    this.fadeControllers.get(soundId)?.cancel()

    return new Promise((resolve) => {
      const startTime = Date.now()
      let cancelled = false

      const controller: SoundFadeController = {
        fadeIn: async () => {},
        fadeOut: async () => {},
        cancel: () => {
          cancelled = true
          cancelAnimationFrame(rafId)
        },
        isFading: true,
      }

      const animate = () => {
        if (cancelled) {
          resolve()
          return
        }

        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)

        // 使用缓动函数
        const eased = this.easeInOutQuad(progress)
        const currentVolume = startVolume + (targetVolume - startVolume) * eased

        instance.audio.volume = currentVolume

        if (progress < 1) {
          rafId = requestAnimationFrame(animate)
        } else {
          instance.audio.volume = targetVolume
          this.fadeControllers.delete(soundId)
          resolve()
        }
      }

      let rafId = requestAnimationFrame(animate)
      this.fadeControllers.set(soundId, controller)
    })
  }

  /**
   * 缓动函数 - 二次进出
   */
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
  }

  /**
   * 设置全局音量
   */
  setGlobalVolume(volume: number): void {
    this.config.globalVolume = Math.max(0, Math.min(1, volume))

    // 更新所有音效的音量
    this.sounds.forEach((instance) => {
      instance.audio.volume = this.calculateVolume(instance)
    })

    this.emit('volume:changed', { volume: this.config.globalVolume })
    this.log('全局音量已更新:', this.config.globalVolume)
  }

  /**
   * 设置全局静音
   */
  setGlobalMuted(muted: boolean): void {
    this.config.globalMuted = muted

    // 更新所有音效的静音状态
    this.sounds.forEach((instance) => {
      instance.audio.muted = muted
    })

    this.emit('mute:changed', { muted })
    this.log('全局静音状态已更新:', muted)
  }

  /**
   * 设置音效音量
   */
  setSoundVolume(soundId: string, volume: number): void {
    const instance = this.sounds.get(soundId)
    if (!instance) return

    instance.volume = Math.max(0, Math.min(1, volume))
    instance.audio.volume = this.calculateVolume(instance)
  }

  /**
   * 设置音效静音
   */
  setSoundMuted(soundId: string, muted: boolean): void {
    const instance = this.sounds.get(soundId)
    if (!instance) return

    instance.muted = muted
    instance.audio.muted = muted || (this.config.globalMuted ?? false)
  }

  /**
   * 计算最终音量
   */
  private calculateVolume(instance: SoundInstance): number {
    if (instance.muted || this.config.globalMuted) {
      return 0
    }

    let volume = instance.volume * (this.config.globalVolume ?? 1.0)

    // 应用分组音量
    const group = Array.from(this.groups.values()).find((g) =>
      g.sounds.includes(instance.id)
    )
    if (group) {
      volume *= group.volume
      if (group.muted) {
        volume = 0
      }
    }

    return Math.max(0, Math.min(1, volume))
  }

  /**
   * 注册分组
   */
  registerGroup(group: SoundGroup): void {
    this.groups.set(group.id, group)
    this.log(`音效分组已注册: ${group.name}`)
  }

  /**
   * 设置分组音量
   */
  setGroupVolume(groupId: string, volume: number): void {
    const group = this.groups.get(groupId)
    if (!group) return

    group.volume = Math.max(0, Math.min(1, volume))

    // 更新分组内所有音效的音量
    group.sounds.forEach((soundId) => {
      const instance = this.sounds.get(soundId)
      if (instance) {
        instance.audio.volume = this.calculateVolume(instance)
      }
    })
  }

  /**
   * 设置分组静音
   */
  setGroupMuted(groupId: string, muted: boolean): void {
    const group = this.groups.get(groupId)
    if (!group) return

    group.muted = muted

    // 更新分组内所有音效的静音状态
    group.sounds.forEach((soundId) => {
      const instance = this.sounds.get(soundId)
      if (instance) {
        instance.audio.volume = this.calculateVolume(instance)
      }
    })
  }

  /**
   * 获取音效实例
   */
  getSoundInstance(soundId: string): SoundInstance | undefined {
    return this.sounds.get(soundId)
  }

  /**
   * 获取统计信息
   */
  getStats(): SoundStats {
    const playCount: Record<string, number> = {}
    let totalMemory = 0

    this.sounds.forEach((instance) => {
      // 估算内存使用（这是粗略估计）
      if (instance.state === SoundState.LOADED) {
        totalMemory += instance.audio.duration * 44100 * 2 * 2 // 假设 44.1kHz 立体声 16bit
      }
    })

    return {
      totalSounds: this.sounds.size,
      loadedSounds: Array.from(this.sounds.values()).filter(
        (s) => s.state === SoundState.LOADED || s.state === SoundState.PLAYING
      ).length,
      playingSounds: this.playingSounds.size,
      memoryUsage: totalMemory,
      playCount,
      mostPlayed: [],
    }
  }

  /**
   * 解析音效路径
   */
  private resolveSoundPath(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }

    // 对于本地路径，确保正确处理
    if (path.startsWith('/')) {
      return path
    }

    return `${this.config.basePath}/${path}`.replace(/\/+/g, '/')
  }

  /**
   * 延迟工具函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 事件监听
   */
  on(event: SoundManagerEvent, handler: SoundManagerEventHandler): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(handler)
  }

  /**
   * 移除事件监听
   */
  off(event: SoundManagerEvent, handler: SoundManagerEventHandler): void {
    this.eventListeners.get(event)?.delete(handler)
  }

  /**
   * 触发事件
   */
  private emit(event: SoundManagerEvent, data: any): void {
    this.eventListeners.get(event)?.forEach((handler) => {
      try {
        handler(data)
      } catch (error) {
        this.error('事件处理器执行失败', error)
      }
    })
  }

  /**
   * 清理资源
   */
  destroy(): void {
    // 停止所有音效
    this.stopAll()

    // 清理所有音效实例
    this.sounds.forEach((instance) => {
      instance.audio.src = ''
      instance.audio.load()
    })

    this.sounds.clear()
    this.playingSounds.clear()
    this.eventListeners.clear()
    this.groups.clear()
    this.fadeControllers.clear()
    this.loadingPromises.clear()

    this.initialized = false
    this.log('音效管理器已销毁')
  }

  /**
   * 日志输出
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[SoundManager]', ...args)
    }
  }

  private warn(...args: any[]): void {
    if (this.config.debug) {
      console.warn('[SoundManager]', ...args)
    }
  }

  private error(...args: any[]): void {
    console.error('[SoundManager]', ...args)
  }
}

/**
 * 创建全局音效管理器实例
 */
let globalSoundManager: SoundManager | null = null

export function createSoundManager(config?: Partial<SoundManagerConfig>): SoundManager {
  if (!globalSoundManager) {
    globalSoundManager = new SoundManager(config)
  }
  return globalSoundManager
}

export function getSoundManager(): SoundManager | null {
  return globalSoundManager
}

export function destroySoundManager(): void {
  if (globalSoundManager) {
    globalSoundManager.destroy()
    globalSoundManager = null
  }
}

