/**
 * API 请求缓存管理器
 * @module infrastructure/api/cache
 */

import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { CacheConfig } from './types';

/**
 * 缓存项接口
 */
interface CacheItem {
  data: any;
  expireAt: number;
  config: AxiosRequestConfig;
}

/**
 * 默认缓存配置
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttl: 5 * 60 * 1000, // 5分钟
  keyPrefix: 'api_cache_',
};

/**
 * 缓存管理器类
 */
export class CacheManager {
  private cache: Map<string, CacheItem> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    
    // 定期清理过期缓存
    this.startCleanupTask();
  }

  /**
   * 生成缓存键
   */
  generateKey(config: AxiosRequestConfig): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(config);
    }

    // 默认键生成策略
    const { method = 'get', url = '', params = {}, data } = config;
    const paramsStr = JSON.stringify(params);
    const dataStr = data ? JSON.stringify(data) : '';
    
    return `${this.config.keyPrefix}${method}:${url}:${paramsStr}:${dataStr}`;
  }

  /**
   * 检查请求是否可缓存
   */
  isCacheable(config: AxiosRequestConfig): boolean {
    // 只缓存 GET 请求
    if (config.method && config.method.toLowerCase() !== 'get') {
      return false;
    }

    // 检查是否启用缓存
    const requestConfig = config as any;
    if (requestConfig.cache === false) {
      return false;
    }

    return this.config.enabled;
  }

  /**
   * 获取缓存
   */
  get(config: AxiosRequestConfig): AxiosResponse | null {
    if (!this.isCacheable(config)) {
      return null;
    }

    const key = this.generateKey(config);
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > item.expireAt) {
      this.cache.delete(key);
      return null;
    }

    console.debug(`[Cache] Hit: ${key}`);

    // 返回缓存的响应
    return {
      data: item.data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: item.config,
    } as AxiosResponse;
  }

  /**
   * 设置缓存
   */
  set(config: AxiosRequestConfig, response: AxiosResponse): void {
    if (!this.isCacheable(config)) {
      return;
    }

    const key = this.generateKey(config);
    
    // 获取TTL
    const requestConfig = config as any;
    const ttl = typeof requestConfig.cache === 'object' && requestConfig.cache.ttl
      ? requestConfig.cache.ttl
      : this.config.ttl;

    const item: CacheItem = {
      data: response.data,
      expireAt: Date.now() + ttl,
      config,
    };

    this.cache.set(key, item);
    console.debug(`[Cache] Set: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * 删除缓存
   */
  delete(config: AxiosRequestConfig): void {
    const key = this.generateKey(config);
    this.cache.delete(key);
    console.debug(`[Cache] Delete: ${key}`);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    console.debug('[Cache] Cleared all');
  }

  /**
   * 根据模式删除缓存
   */
  invalidate(pattern: string | RegExp): void {
    const keys = Array.from(this.cache.keys());
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern) 
      : pattern;

    keys.forEach(key => {
      if (regex.test(key)) {
        this.cache.delete(key);
        console.debug(`[Cache] Invalidated: ${key}`);
      }
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    let count = 0;

    this.cache.forEach((item, key) => {
      if (now > item.expireAt) {
        this.cache.delete(key);
        count++;
      }
    });

    if (count > 0) {
      console.debug(`[Cache] Cleaned up ${count} expired items`);
    }
  }

  /**
   * 启动定期清理任务
   */
  private startCleanupTask(): void {
    // 每5分钟清理一次过期缓存
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * 创建缓存拦截器
 */
export function createCacheInterceptors(
  cacheManager: CacheManager
): {
  request: (config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosResponse>;
  response: (response: AxiosResponse) => AxiosResponse;
} {
  return {
    // 请求拦截器：检查缓存
    request: (config: AxiosRequestConfig) => {
      const cachedResponse = cacheManager.get(config);
      if (cachedResponse) {
        // 返回 Promise.resolve 以跳过实际请求
        return Promise.resolve(cachedResponse) as any;
      }
      return config;
    },

    // 响应拦截器：存储缓存
    response: (response: AxiosResponse) => {
      cacheManager.set(response.config, response);
      return response;
    },
  };
}

