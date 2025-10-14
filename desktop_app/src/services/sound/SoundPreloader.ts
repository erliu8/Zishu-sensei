/**
 * 音效预加载器
 * @module services/sound/SoundPreloader
 * @description 负责音效资源的预加载、缓存和优先级管理
 */

import type { SoundConfig, SoundLoadProgress } from '@/types/sound'
import { SoundPriority } from '@/types/sound'

/**
 * 预加载器配置
 */
export interface PreloaderConfig {
  /** 并发加载数量 */
  concurrency?: number
  /** 加载超时时间(ms) */
  timeout?: number
  /** 是否重试失败的加载 */
  retryOnError?: boolean
  /** 重试次数 */
  maxRetries?: number
  /** 重试延迟(ms) */
  retryDelay?: number
  /** 是否启用调试日志 */
  debug?: boolean
}

/**
 * 加载任务
 */
interface LoadTask {
  config: SoundConfig
  priority: number
  retries: number
  promise?: Promise<void>
}

/**
 * 音效预加载器类
 */
export class SoundPreloader {
  private config: Required<PreloaderConfig>
  private loadQueue: LoadTask[] = []
  private loading = false
  private loadedSounds = new Set<string>()
  private failedSounds = new Map<string, Error>()
  private progressCallbacks = new Set<(progress: SoundLoadProgress) => void>()

  constructor(config: PreloaderConfig = {}) {
    this.config = {
      concurrency: config.concurrency ?? 3,
      timeout: config.timeout ?? 30000,
      retryOnError: config.retryOnError ?? true,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      debug: config.debug ?? false,
    }
  }

  /**
   * 添加音效到预加载队列
   */
  add(soundConfigs: SoundConfig | SoundConfig[]): void {
    const configs = Array.isArray(soundConfigs) ? soundConfigs : [soundConfigs]

    for (const config of configs) {
      // 跳过已加载或正在加载的音效
      if (this.loadedSounds.has(config.id)) {
        continue
      }

      // 跳过已在队列中的音效
      if (this.loadQueue.some((task) => task.config.id === config.id)) {
        continue
      }

      const task: LoadTask = {
        config,
        priority: config.priority ?? SoundPriority.NORMAL,
        retries: 0,
      }

      this.loadQueue.push(task)
    }

    // 按优先级排序
    this.sortQueue()

    this.log(`已添加 ${configs.length} 个音效到预加载队列，队列长度: ${this.loadQueue.length}`)
  }

  /**
   * 开始预加载
   */
  async preload(): Promise<void> {
    if (this.loading) {
      this.log('预加载已在进行中')
      return
    }

    if (this.loadQueue.length === 0) {
      this.log('预加载队列为空')
      return
    }

    this.loading = true
    this.log(`开始预加载 ${this.loadQueue.length} 个音效`)

    const total = this.loadQueue.length
    const workers: Promise<void>[] = []

    // 创建并发工作线程
    for (let i = 0; i < this.config.concurrency; i++) {
      workers.push(this.worker())
    }

    // 等待所有工作线程完成
    await Promise.all(workers)

    this.loading = false

    const progress: SoundLoadProgress = {
      loaded: this.loadedSounds.size,
      total,
      percentage: 100,
      failed: Array.from(this.failedSounds.keys()),
    }

    this.notifyProgress(progress)
    this.log('预加载完成', progress)
  }

  /**
   * 工作线程 - 从队列中取任务执行
   */
  private async worker(): Promise<void> {
    while (this.loadQueue.length > 0) {
      const task = this.loadQueue.shift()
      if (!task) break

      try {
        await this.loadTask(task)
      } catch (error) {
        this.handleLoadError(task, error as Error)
      }

      // 更新进度
      this.updateProgress()
    }
  }

  /**
   * 加载单个任务
   */
  private async loadTask(task: LoadTask): Promise<void> {
    const { config } = task

    this.log(`开始加载音效: ${config.id}`)

    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error(`加载超时: ${config.id}`))
      }, this.config.timeout)

      const onLoad = () => {
        cleanup()
        this.loadedSounds.add(config.id)
        this.log(`音效加载成功: ${config.id}`)
        resolve()
      }

      const onError = (e: ErrorEvent) => {
        cleanup()
        reject(new Error(`加载失败: ${config.id} - ${e.message}`))
      }

      const cleanup = () => {
        clearTimeout(timeoutId)
        audio.removeEventListener('canplaythrough', onLoad)
        audio.removeEventListener('error', onError)
        // 释放资源
        audio.src = ''
        audio.load()
      }

      audio.addEventListener('canplaythrough', onLoad, { once: true })
      audio.addEventListener('error', onError, { once: true })
      audio.src = config.path
      audio.load()
    })
  }

  /**
   * 处理加载错误
   */
  private handleLoadError(task: LoadTask, error: Error): void {
    const { config } = task

    this.error(`音效加载失败: ${config.id}`, error)

    // 是否重试
    if (this.config.retryOnError && task.retries < this.config.maxRetries) {
      task.retries++
      this.log(`重试加载音效 (${task.retries}/${this.config.maxRetries}): ${config.id}`)

      // 延迟后重新加入队列
      setTimeout(() => {
        this.loadQueue.unshift(task)
      }, this.config.retryDelay)
    } else {
      // 记录失败
      this.failedSounds.set(config.id, error)
    }
  }

  /**
   * 更新加载进度
   */
  private updateProgress(): void {
    const total = this.loadedSounds.size + this.failedSounds.size + this.loadQueue.length
    const loaded = this.loadedSounds.size

    const progress: SoundLoadProgress = {
      loaded,
      total,
      percentage: total > 0 ? Math.round((loaded / total) * 100) : 0,
      failed: Array.from(this.failedSounds.keys()),
      currentSound: this.loadQueue[0]?.config.id,
    }

    this.notifyProgress(progress)
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(progress: SoundLoadProgress): void {
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(progress)
      } catch (error) {
        this.error('进度回调执行失败', error)
      }
    })
  }

  /**
   * 监听加载进度
   */
  onProgress(callback: (progress: SoundLoadProgress) => void): () => void {
    this.progressCallbacks.add(callback)
    return () => {
      this.progressCallbacks.delete(callback)
    }
  }

  /**
   * 按优先级排序队列
   */
  private sortQueue(): void {
    this.loadQueue.sort((a, b) => {
      // 优先级高的在前
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      // 相同优先级，重试次数少的在前
      return a.retries - b.retries
    })
  }

  /**
   * 检查音效是否已加载
   */
  isLoaded(soundId: string): boolean {
    return this.loadedSounds.has(soundId)
  }

  /**
   * 检查音效是否加载失败
   */
  hasFailed(soundId: string): boolean {
    return this.failedSounds.has(soundId)
  }

  /**
   * 获取加载失败的错误
   */
  getError(soundId: string): Error | undefined {
    return this.failedSounds.get(soundId)
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.loadQueue = []
    this.log('预加载队列已清空')
  }

  /**
   * 重置预加载器
   */
  reset(): void {
    this.loadQueue = []
    this.loadedSounds.clear()
    this.failedSounds.clear()
    this.loading = false
    this.log('预加载器已重置')
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      queued: this.loadQueue.length,
      loaded: this.loadedSounds.size,
      failed: this.failedSounds.size,
      isLoading: this.loading,
    }
  }

  /**
   * 日志输出
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[SoundPreloader]', ...args)
    }
  }

  private error(...args: any[]): void {
    console.error('[SoundPreloader]', ...args)
  }
}

/**
 * 音效缓存管理器
 */
export class SoundCache {
  private cache = new Map<string, ArrayBuffer>()
  private maxSize: number
  private currentSize = 0

  constructor(maxSize: number = 100 * 1024 * 1024) {
    // 默认100MB
    this.maxSize = maxSize
  }

  /**
   * 添加到缓存
   */
  set(key: string, data: ArrayBuffer): boolean {
    const size = data.byteLength

    // 检查是否超出最大容量
    if (size > this.maxSize) {
      console.warn(`音效大小 (${size}) 超过缓存最大容量 (${this.maxSize})`)
      return false
    }

    // 如果缓存已满，移除最旧的项
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.removeOldest()
    }

    this.cache.set(key, data)
    this.currentSize += size

    return true
  }

  /**
   * 从缓存获取
   */
  get(key: string): ArrayBuffer | undefined {
    return this.cache.get(key)
  }

  /**
   * 检查是否在缓存中
   */
  has(key: string): boolean {
    return this.cache.has(key)
  }

  /**
   * 从缓存中删除
   */
  delete(key: string): boolean {
    const data = this.cache.get(key)
    if (data) {
      this.currentSize -= data.byteLength
      return this.cache.delete(key)
    }
    return false
  }

  /**
   * 移除最旧的缓存项
   */
  private removeOldest(): void {
    const firstKey = this.cache.keys().next().value
    if (firstKey) {
      this.delete(firstKey)
    }
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
    this.currentSize = 0
  }

  /**
   * 获取缓存大小
   */
  getSize(): number {
    return this.currentSize
  }

  /**
   * 获取缓存项数量
   */
  getCount(): number {
    return this.cache.size
  }

  /**
   * 获取缓存使用率
   */
  getUsageRate(): number {
    return this.maxSize > 0 ? this.currentSize / this.maxSize : 0
  }
}

