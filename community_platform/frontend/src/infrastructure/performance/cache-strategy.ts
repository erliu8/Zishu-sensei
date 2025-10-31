/**
 * 高级缓存策略管理器
 * 提供多种缓存策略和缓存控制
 */

/**
 * 缓存策略类型
 */
export enum CacheStrategy {
  /**
   * 网络优先 - 先请求网络，失败则使用缓存
   */
  NETWORK_FIRST = 'network-first',
  
  /**
   * 缓存优先 - 先查缓存，没有则请求网络
   */
  CACHE_FIRST = 'cache-first',
  
  /**
   * 仅网络 - 只从网络获取
   */
  NETWORK_ONLY = 'network-only',
  
  /**
   * 仅缓存 - 只从缓存获取
   */
  CACHE_ONLY = 'cache-only',
  
  /**
   * 重新验证时保持刷新 (SWR) - 返回缓存，后台更新
   */
  STALE_WHILE_REVALIDATE = 'stale-while-revalidate',
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /**
   * 缓存键
   */
  key: string
  
  /**
   * 缓存策略
   */
  strategy: CacheStrategy
  
  /**
   * 过期时间（毫秒）
   */
  ttl?: number
  
  /**
   * 最大缓存大小
   */
  maxSize?: number
  
  /**
   * 是否在后台更新
   */
  backgroundSync?: boolean
}

/**
 * 缓存项
 */
interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
  version: string
}

/**
 * 缓存管理器
 */
export class CacheManager {
  private static instance: CacheManager
  private memoryCache: Map<string, CacheItem<any>> = new Map()
  private readonly version = '1.0.0'
  private readonly maxMemorySize = 50 * 1024 * 1024 // 50MB

  private constructor() {
    // 定期清理过期缓存
    setInterval(() => this.cleanExpired(), 60000) // 每分钟清理一次
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, data: T, ttl: number = 3600000): Promise<void> {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version: this.version,
    }

    // 内存缓存
    this.memoryCache.set(key, item)

    // IndexedDB 缓存（用于持久化）
    try {
      await this.setIndexedDB(key, item)
    } catch (error) {
      console.warn('IndexedDB 缓存失败:', error)
    }

    // 检查缓存大小
    this.checkMemorySize()
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    // 先查内存缓存
    const memoryItem = this.memoryCache.get(key)
    if (memoryItem && !this.isExpired(memoryItem)) {
      return memoryItem.data as T
    }

    // 再查 IndexedDB
    try {
      const dbItem = await this.getIndexedDB<T>(key)
      if (dbItem && !this.isExpired(dbItem)) {
        // 回填内存缓存
        this.memoryCache.set(key, dbItem)
        return dbItem.data
      }
    } catch (error) {
      console.warn('IndexedDB 读取失败:', error)
    }

    return null
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key)
    
    try {
      await this.deleteIndexedDB(key)
    } catch (error) {
      console.warn('IndexedDB 删除失败:', error)
    }
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()
    
    try {
      await this.clearIndexedDB()
    } catch (error) {
      console.warn('IndexedDB 清空失败:', error)
    }
  }

  /**
   * 检查缓存是否存在且未过期
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key)
    return data !== null
  }

  /**
   * 检查是否过期
   */
  private isExpired(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp > item.ttl
  }

  /**
   * 清理过期缓存
   */
  private cleanExpired(): void {
    const now = Date.now()
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.memoryCache.delete(key)
      }
    }
  }

  /**
   * 检查内存大小
   */
  private checkMemorySize(): void {
    const size = this.estimateMemorySize()
    
    if (size > this.maxMemorySize) {
      // 清理最旧的缓存
      const entries = Array.from(this.memoryCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      // 删除最旧的 20%
      const toDelete = Math.ceil(entries.length * 0.2)
      for (let i = 0; i < toDelete && i < entries.length; i++) {
        const entry = entries[i]
        if (entry) {
          this.memoryCache.delete(entry[0])
        }
      }
    }
  }

  /**
   * 估算内存大小
   */
  private estimateMemorySize(): number {
    let size = 0
    
    for (const item of this.memoryCache.values()) {
      size += JSON.stringify(item).length * 2 // 粗略估算
    }
    
    return size
  }

  /**
   * IndexedDB 操作
   */
  private async setIndexedDB<T>(key: string, item: CacheItem<T>): Promise<void> {
    if (typeof window === 'undefined') return

    const db = await this.openDB()
    const tx = db.transaction('cache', 'readwrite')
    const store = tx.objectStore('cache')
    
    await store.put({ key, ...item })
    await tx.done
  }

  private async getIndexedDB<T>(key: string): Promise<CacheItem<T> | null> {
    if (typeof window === 'undefined') return null

    const db = await this.openDB()
    const tx = db.transaction('cache', 'readonly')
    const store = tx.objectStore('cache')
    
    const result = await store.get(key)
    return result || null
  }

  private async deleteIndexedDB(key: string): Promise<void> {
    if (typeof window === 'undefined') return

    const db = await this.openDB()
    const tx = db.transaction('cache', 'readwrite')
    const store = tx.objectStore('cache')
    
    await store.delete(key)
    await tx.done
  }

  private async clearIndexedDB(): Promise<void> {
    if (typeof window === 'undefined') return

    const db = await this.openDB()
    const tx = db.transaction('cache', 'readwrite')
    const store = tx.objectStore('cache')
    
    await store.clear()
    await tx.done
  }

  private async openDB(): Promise<any> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      throw new Error('IndexedDB not supported')
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open('zishu-cache', 1)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' })
        }
      }
    })
  }
}

/**
 * 缓存策略执行器
 */
export class CacheStrategyExecutor {
  private cache: CacheManager

  constructor() {
    this.cache = CacheManager.getInstance()
  }

  /**
   * 执行缓存策略
   */
  async execute<T>(
    config: CacheConfig,
    fetcher: () => Promise<T>
  ): Promise<T> {
    switch (config.strategy) {
      case CacheStrategy.CACHE_FIRST:
        return this.cacheFirst(config, fetcher)
      
      case CacheStrategy.NETWORK_FIRST:
        return this.networkFirst(config, fetcher)
      
      case CacheStrategy.CACHE_ONLY:
        return this.cacheOnly(config)
      
      case CacheStrategy.NETWORK_ONLY:
        return this.networkOnly(fetcher)
      
      case CacheStrategy.STALE_WHILE_REVALIDATE:
        return this.staleWhileRevalidate(config, fetcher)
      
      default:
        return fetcher()
    }
  }

  /**
   * 缓存优先策略
   */
  private async cacheFirst<T>(
    config: CacheConfig,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = await this.cache.get<T>(config.key)
    
    if (cached !== null) {
      return cached
    }

    const data = await fetcher()
    await this.cache.set(config.key, data, config.ttl)
    return data
  }

  /**
   * 网络优先策略
   */
  private async networkFirst<T>(
    config: CacheConfig,
    fetcher: () => Promise<T>
  ): Promise<T> {
    try {
      const data = await fetcher()
      await this.cache.set(config.key, data, config.ttl)
      return data
    } catch (error) {
      const cached = await this.cache.get<T>(config.key)
      
      if (cached !== null) {
        console.warn('网络请求失败，使用缓存数据')
        return cached
      }
      
      throw error
    }
  }

  /**
   * 仅缓存策略
   */
  private async cacheOnly<T>(config: CacheConfig): Promise<T> {
    const cached = await this.cache.get<T>(config.key)
    
    if (cached === null) {
      throw new Error(`缓存不存在: ${config.key}`)
    }
    
    return cached
  }

  /**
   * 仅网络策略
   */
  private async networkOnly<T>(fetcher: () => Promise<T>): Promise<T> {
    return fetcher()
  }

  /**
   * SWR 策略
   */
  private async staleWhileRevalidate<T>(
    config: CacheConfig,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = await this.cache.get<T>(config.key)

    // 后台更新
    fetcher()
      .then((data) => {
        this.cache.set(config.key, data, config.ttl)
      })
      .catch((error) => {
        console.warn('后台更新失败:', error)
      })

    // 如果有缓存，立即返回
    if (cached !== null) {
      return cached
    }

    // 没有缓存，等待网络请求
    return fetcher()
  }
}

/**
 * 导出单例
 */
export const cacheManager = CacheManager.getInstance()
export const cacheExecutor = new CacheStrategyExecutor()

/**
 * 缓存装饰器
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  config: Omit<CacheConfig, 'key'> & { keyGenerator: (...args: Parameters<T>) => string }
) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: Parameters<T>) {
      const key = config.keyGenerator(...args)
      const fullConfig: CacheConfig = {
        ...config,
        key,
      }

      return cacheExecutor.execute(fullConfig, () =>
        originalMethod.apply(this, args)
      )
    }

    return descriptor
  }
}

