/**
 * 缓存管理系统
 * 
 * 提供全面的缓存功能：
 * - LRU（最近最少使用）缓存策略
 * - 持久化到本地存储
 * - 过期时间管理
 * - 缓存统计和监控
 * - 批量操作
 * - 缓存预热
 * - 内存限制
 * 
 * @module services/storage/cache
 */

import { writeTextFile, readTextFile, exists, createDir } from '@tauri-apps/api/fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { logger } from '../../utils/logger';

// ================================
// 类型定义
// ================================

/**
 * 缓存条目接口
 */
export interface CacheEntry<T = any> {
  /** 缓存的值 */
  value: T;
  /** 创建时间戳 */
  createdAt: number;
  /** 过期时间戳 */
  expiresAt?: number;
  /** 访问次数 */
  accessCount: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
  /** 数据大小（字节） */
  size: number;
  /** 标签 */
  tags?: string[];
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  /** 最大缓存条目数 */
  maxSize: number;
  /** 默认过期时间（毫秒），0表示永不过期 */
  defaultTTL: number;
  /** 是否启用持久化 */
  enablePersistence: boolean;
  /** 持久化存储路径 */
  persistencePath: string;
  /** 最大内存占用（字节） */
  maxMemorySize: number;
  /** 自动清理间隔（毫秒） */
  cleanupInterval: number;
  /** 是否启用统计 */
  enableStats: boolean;
  /** 是否启用压缩 */
  enableCompression: boolean;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 缓存命中次数 */
  hits: number;
  /** 缓存未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 当前条目数 */
  size: number;
  /** 总内存占用（字节） */
  memoryUsage: number;
  /** 过期条目数 */
  expiredCount: number;
  /** 最早创建时间 */
  oldestEntry?: number;
  /** 最新创建时间 */
  newestEntry?: number;
  /** 总访问次数 */
  totalAccesses: number;
}

/**
 * 缓存选项
 */
export interface CacheOptions {
  /** 过期时间（毫秒） */
  ttl?: number;
  /** 标签 */
  tags?: string[];
  /** 元数据 */
  metadata?: Record<string, any>;
  /** 是否强制更新 */
  force?: boolean;
}

/**
 * 批量操作结果
 */
export interface BatchResult<T> {
  /** 成功的键 */
  success: string[];
  /** 失败的键及原因 */
  failed: Array<{ key: string; error: string }>;
  /** 结果值 */
  values: Map<string, T>;
}

// ================================
// 默认配置
// ================================

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 1000,
  defaultTTL: 3600000, // 1小时
  enablePersistence: true,
  persistencePath: 'cache.dat',
  maxMemorySize: 50 * 1024 * 1024, // 50MB
  cleanupInterval: 300000, // 5分钟
  enableStats: true,
  enableCompression: false,
};

// ================================
// 缓存管理器类
// ================================

/**
 * 缓存管理器
 */
export class CacheManager<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private persistencePath: string | null = null;
  private isInitialized = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = this.initStats();
  }

  /**
   * 初始化统计信息
   */
  private initStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      memoryUsage: 0,
      expiredCount: 0,
      totalAccesses: 0,
    };
  }

  /**
   * 初始化缓存系统
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 初始化持久化存储
      if (this.config.enablePersistence) {
        await this.initPersistence();
        await this.loadFromPersistence();
      }

      // 启动自动清理定时器
      if (this.config.cleanupInterval > 0) {
        this.startCleanupTimer();
      }

      this.isInitialized = true;
      logger.info('缓存系统初始化成功', { config: this.config }, 'CacheManager');
    } catch (error) {
      logger.error('缓存系统初始化失败', error, 'CacheManager');
      throw error;
    }
  }

  /**
   * 初始化持久化存储
   */
  private async initPersistence(): Promise<void> {
    try {
      const dataDir = await appDataDir();
      const cacheDir = await join(dataDir, 'cache');
      
      // 确保缓存目录存在
      const dirExists = await exists(cacheDir);
      if (!dirExists) {
        await createDir(cacheDir, { recursive: true });
      }
      
      this.persistencePath = await join(cacheDir, this.config.persistencePath);
    } catch (error) {
      logger.warn('初始化持久化存储失败，将使用内存缓存', error, 'CacheManager');
      this.config.enablePersistence = false;
    }
  }

  /**
   * 从持久化存储加载缓存
   */
  private async loadFromPersistence(): Promise<void> {
    if (!this.persistencePath) return;

    try {
      const fileExists = await exists(this.persistencePath);
      if (!fileExists) return;

      const content = await readTextFile(this.persistencePath);
      const data = JSON.parse(content) as Record<string, CacheEntry<T>>;
      
      for (const [key, entry] of Object.entries(data)) {
        // 检查是否过期
        if (!this.isExpired(entry)) {
          this.cache.set(key, entry);
        }
      }

      logger.debug(`从持久化存储加载了 ${this.cache.size} 条缓存`, undefined, 'CacheManager');
    } catch (error) {
      logger.error('从持久化存储加载缓存失败', error, 'CacheManager');
    }
  }

  /**
   * 保存到持久化存储
   */
  private async saveToPersistence(_key: string, _entry: CacheEntry<T>): Promise<void> {
    if (!this.persistencePath) return;

    try {
      await this.saveAllToPersistence();
    } catch (error) {
      logger.warn('保存到持久化存储失败', error, 'CacheManager');
    }
  }

  /**
   * 从持久化存储删除
   */
  private async deleteFromPersistence(_key: string): Promise<void> {
    if (!this.persistencePath) return;

    try {
      await this.saveAllToPersistence();
    } catch (error) {
      logger.warn('从持久化存储删除失败', error, 'CacheManager');
    }
  }

  /**
   * 将所有缓存保存到持久化存储
   */
  private async saveAllToPersistence(): Promise<void> {
    if (!this.persistencePath) return;

    try {
      const data: Record<string, CacheEntry<T>> = {};
      for (const [key, entry] of this.cache) {
        data[key] = entry;
      }

      await writeTextFile(this.persistencePath, JSON.stringify(data));
    } catch (error) {
      logger.warn('保存缓存到文件失败', error, 'CacheManager');
    }
  }

  // ================================
  // 核心缓存方法
  // ================================

  /**
   * 设置缓存
   */
  public async set(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    // 检查是否需要清理空间
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    const ttl = options.ttl ?? this.config.defaultTTL;
    const expiresAt = ttl > 0 ? now + ttl : undefined;

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt,
      accessCount: 0,
      lastAccessedAt: now,
      size: this.estimateSize(value),
      tags: options.tags,
      metadata: options.metadata,
    };

    this.cache.set(key, entry);
    this.updateStats();

    // 持久化
    if (this.config.enablePersistence) {
      await this.saveToPersistence(key, entry);
    }

    logger.debug(`缓存已设置: ${key}`, { ttl, size: entry.size }, 'CacheManager');
  }

  /**
   * 获取缓存
   */
  public async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.recordMiss();
      return null;
    }

    // 检查是否过期
    if (this.isExpired(entry)) {
      await this.delete(key);
      this.recordMiss();
      this.stats.expiredCount++;
      return null;
    }

    // 更新访问信息
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();
    this.stats.totalAccesses++;

    this.recordHit();
    return entry.value;
  }

  /**
   * 获取或设置缓存（如果不存在）
   */
  public async getOrSet(
    key: string,
    factory: () => T | Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get(key);
    
    if (cached !== null && !options.force) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * 检查缓存是否存在
   */
  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 删除缓存
   */
  public async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      this.updateStats();
      
      if (this.config.enablePersistence) {
        await this.deleteFromPersistence(key);
      }

      logger.debug(`缓存已删除: ${key}`, undefined, 'CacheManager');
    }

    return deleted;
  }

  /**
   * 清空所有缓存
   */
  public async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.updateStats();

    if (this.config.enablePersistence && this.persistencePath) {
      await this.saveAllToPersistence();
    }

    logger.info(`缓存已清空，删除了 ${size} 条记录`, undefined, 'CacheManager');
  }

  /**
   * 获取所有键
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取所有值
   */
  public values(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * 获取所有条目
   */
  public entries(): Array<[string, T]> {
    return Array.from(this.cache.entries()).map(([key, entry]) => [key, entry.value]);
  }

  /**
   * 获取缓存大小
   */
  public size(): number {
    return this.cache.size;
  }

  // ================================
  // 批量操作
  // ================================

  /**
   * 批量设置
   */
  public async setMany(items: Map<string, T>, options: CacheOptions = {}): Promise<BatchResult<void>> {
    const result: BatchResult<void> = {
      success: [],
      failed: [],
      values: new Map(),
    };

    for (const [key, value] of items) {
      try {
        await this.set(key, value, options);
        result.success.push(key);
      } catch (error) {
        result.failed.push({
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * 批量获取
   */
  public async getMany(keys: string[]): Promise<BatchResult<T>> {
    const result: BatchResult<T> = {
      success: [],
      failed: [],
      values: new Map(),
    };

    for (const key of keys) {
      try {
        const value = await this.get(key);
        if (value !== null) {
          result.success.push(key);
          result.values.set(key, value);
        } else {
          result.failed.push({ key, error: 'Not found or expired' });
        }
      } catch (error) {
        result.failed.push({
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * 批量删除
   */
  public async deleteMany(keys: string[]): Promise<BatchResult<void>> {
    const result: BatchResult<void> = {
      success: [],
      failed: [],
      values: new Map(),
    };

    for (const key of keys) {
      try {
        const deleted = await this.delete(key);
        if (deleted) {
          result.success.push(key);
        } else {
          result.failed.push({ key, error: 'Not found' });
        }
      } catch (error) {
        result.failed.push({
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  // ================================
  // 标签操作
  // ================================

  /**
   * 根据标签获取缓存
   */
  public async getByTag(tag: string): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    for (const [key, entry] of this.cache) {
      if (entry.tags?.includes(tag)) {
        const value = await this.get(key);
        if (value !== null) {
          results.set(key, value);
        }
      }
    }

    return results;
  }

  /**
   * 根据标签删除缓存
   */
  public async deleteByTag(tag: string): Promise<number> {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (entry.tags?.includes(tag)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key);
    }

    logger.info(`根据标签 "${tag}" 删除了 ${keysToDelete.length} 条缓存`, undefined, 'CacheManager');
    return keysToDelete.length;
  }

  // ================================
  // 过期和清理
  // ================================

  /**
   * 检查是否过期
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    if (!entry.expiresAt) return false;
    return Date.now() > entry.expiresAt;
  }

  /**
   * 清理过期缓存
   */
  public async cleanup(): Promise<number> {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key);
    }

    if (keysToDelete.length > 0) {
      logger.debug(`清理了 ${keysToDelete.length} 条过期缓存`, undefined, 'CacheManager');
    }

    return keysToDelete.length;
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(err => {
        logger.error('自动清理缓存失败', err, 'CacheManager');
      });
    }, this.config.cleanupInterval);
  }

  /**
   * 停止清理定时器
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * LRU驱逐
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      logger.debug(`LRU驱逐: ${oldestKey}`, undefined, 'CacheManager');
    }
  }

  /**
   * 检查内存限制
   */
  private checkMemoryLimit(): void {
    while (this.stats.memoryUsage > this.config.maxMemorySize) {
      this.evictLRU();
      this.updateStats();
    }
  }

  // ================================
  // 统计和监控
  // ================================

  /**
   * 记录命中
   */
  private recordHit(): void {
    if (!this.config.enableStats) return;
    
    this.stats.hits++;
    this.updateHitRate();
  }

  /**
   * 记录未命中
   */
  private recordMiss(): void {
    if (!this.config.enableStats) return;
    
    this.stats.misses++;
    this.updateHitRate();
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    if (!this.config.enableStats) return;

    this.stats.size = this.cache.size;
    
    let memoryUsage = 0;
    let oldestEntry: number | undefined;
    let newestEntry: number | undefined;

    for (const entry of this.cache.values()) {
      memoryUsage += entry.size;
      
      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    this.stats.memoryUsage = memoryUsage;
    this.stats.oldestEntry = oldestEntry;
    this.stats.newestEntry = newestEntry;

    // 检查内存限制
    this.checkMemoryLimit();
  }

  /**
   * 获取统计信息
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.stats = this.initStats();
    this.updateStats();
  }

  // ================================
  // 工具方法
  // ================================

  /**
   * 估算数据大小
   */
  private estimateSize(value: T): number {
    try {
      const json = JSON.stringify(value);
      return new Blob([json]).size;
    } catch {
      return 0;
    }
  }

  /**
   * 获取配置
   */
  public getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<CacheConfig>): void {
    const oldCleanupInterval = this.config.cleanupInterval;
    this.config = { ...this.config, ...config };

    // 如果清理间隔改变，重启定时器
    if (oldCleanupInterval !== this.config.cleanupInterval) {
      this.stopCleanupTimer();
      if (this.config.cleanupInterval > 0) {
        this.startCleanupTimer();
      }
    }
  }

  /**
   * 导出缓存数据
   */
  public export(): Map<string, CacheEntry<T>> {
    return new Map(this.cache);
  }

  /**
   * 导入缓存数据
   */
  public async import(data: Map<string, CacheEntry<T>>): Promise<void> {
    for (const [key, entry] of data) {
      if (!this.isExpired(entry)) {
        this.cache.set(key, entry);
      }
    }

    this.updateStats();

    // 持久化
    if (this.config.enablePersistence) {
      await this.saveAllToPersistence();
    }

    logger.info(`导入了 ${data.size} 条缓存`, undefined, 'CacheManager');
  }

  /**
   * 销毁缓存管理器
   */
  public async destroy(): Promise<void> {
    this.stopCleanupTimer();
    
    if (this.config.enablePersistence) {
      await this.saveAllToPersistence();
    }

    this.cache.clear();
    this.isInitialized = false;

    logger.info('缓存管理器已销毁', undefined, 'CacheManager');
  }
}

// ================================
// 全局缓存实例
// ================================

/**
 * 全局缓存管理器实例
 */
export const cache = new CacheManager();

/**
 * 便捷函数：设置缓存
 */
export const setCache = <T>(key: string, value: T, options?: CacheOptions): Promise<void> => {
  return cache.set(key, value, options);
};

/**
 * 便捷函数：获取缓存
 */
export const getCache = <T>(key: string): Promise<T | null> => {
  return cache.get(key);
};

/**
 * 便捷函数：获取或设置缓存
 */
export const getOrSetCache = <T>(
  key: string,
  factory: () => T | Promise<T>,
  options?: CacheOptions
): Promise<T> => {
  return cache.getOrSet(key, factory, options);
};

/**
 * 便捷函数：删除缓存
 */
export const deleteCache = (key: string): Promise<boolean> => {
  return cache.delete(key);
};

/**
 * 便捷函数：清空缓存
 */
export const clearCache = (): Promise<void> => {
  return cache.clear();
};

/**
 * 导出默认实例
 */
export default cache;

