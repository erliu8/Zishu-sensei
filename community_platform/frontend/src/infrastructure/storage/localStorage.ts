/**
 * LocalStorage 封装
 * @module infrastructure/storage/localStorage
 */

import type {
  StorageConfig,
  StorageOptions,
  StorageItem,
  StorageAdapter,
} from './types';
import { StorageError } from './types';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: StorageConfig = {
  prefix: 'zishu_',
  defaultTTL: 0, // 0 表示永不过期
  encrypt: false,
  compress: false,
  version: 1,
};

/**
 * LocalStorage 管理器类
 */
export class LocalStorageManager implements StorageAdapter {
  private config: StorageConfig;
  private isAvailable: boolean;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isAvailable = this.checkAvailability();

    if (this.isAvailable) {
      // 启动过期清理任务
      this.startCleanupTask();
    }
  }

  /**
   * 检查 localStorage 是否可用
   */
  private checkAvailability(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }

      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 生成完整的键名
   */
  private getFullKey(key: string): string {
    return `${this.config.prefix}${key}`;
  }

  /**
   * 检查是否过期
   */
  private isExpired(item: StorageItem): boolean {
    if (!item.expireAt) {
      return false;
    }
    return Date.now() > item.expireAt;
  }

  /**
   * 序列化数据
   */
  private serialize<T>(value: T, options?: StorageOptions): string {
    const now = Date.now();
    const ttl = options?.ttl ?? this.config.defaultTTL ?? 0;

    const item: StorageItem<T> = {
      value,
      expireAt: ttl > 0 ? now + ttl : undefined,
      createdAt: now,
      updatedAt: now,
      version: options?.version ?? this.config.version,
    };

    let serialized = JSON.stringify(item);

    // 加密（简单示例，生产环境应使用专业加密库）
    if (options?.encrypt ?? this.config.encrypt) {
      serialized = this.encrypt(serialized);
    }

    // 压缩（简单示例）
    if (this.config.compress) {
      serialized = this.compress(serialized);
    }

    return serialized;
  }

  /**
   * 反序列化数据
   */
  private deserialize<T>(serialized: string): StorageItem<T> | null {
    try {
      let data = serialized;

      // 解压缩
      if (this.config.compress) {
        data = this.decompress(data);
      }

      // 解密
      if (this.config.encrypt) {
        data = this.decrypt(data);
      }

      return JSON.parse(data) as StorageItem<T>;
    } catch (error) {
      console.error('[LocalStorage] Failed to deserialize:', error);
      return null;
    }
  }

  /**
   * 获取数据
   */
  get<T>(key: string): T | null {
    if (!this.isAvailable) {
      throw new StorageError('LocalStorage is not available', 'NOT_AVAILABLE');
    }

    try {
      const fullKey = this.getFullKey(key);
      const serialized = window.localStorage.getItem(fullKey);

      if (!serialized) {
        return null;
      }

      const item = this.deserialize<T>(serialized);

      if (!item) {
        this.remove(key);
        return null;
      }

      // 检查是否过期
      if (this.isExpired(item)) {
        this.remove(key);
        return null;
      }

      // 版本检查
      if (this.config.version && item.version !== this.config.version) {
        this.remove(key);
        return null;
      }

      return item.value;
    } catch (error) {
      throw new StorageError(
        `Failed to get item: ${key}`,
        'GET_ERROR',
        error as Error
      );
    }
  }

  /**
   * 设置数据
   */
  set<T>(key: string, value: T, options?: StorageOptions): void {
    if (!this.isAvailable) {
      throw new StorageError('LocalStorage is not available', 'NOT_AVAILABLE');
    }

    try {
      const fullKey = this.getFullKey(key);
      const serialized = this.serialize(value, options);

      window.localStorage.setItem(fullKey, serialized);
    } catch (error: any) {
      // 处理配额超出错误
      if (error.name === 'QuotaExceededError') {
        throw new StorageError(
          'Storage quota exceeded',
          'QUOTA_EXCEEDED',
          error
        );
      }
      throw new StorageError(
        `Failed to set item: ${key}`,
        'SET_ERROR',
        error as Error
      );
    }
  }

  /**
   * 移除数据
   */
  remove(key: string): void {
    if (!this.isAvailable) {
      throw new StorageError('LocalStorage is not available', 'NOT_AVAILABLE');
    }

    try {
      const fullKey = this.getFullKey(key);
      window.localStorage.removeItem(fullKey);
    } catch (error) {
      throw new StorageError(
        `Failed to remove item: ${key}`,
        'REMOVE_ERROR',
        error as Error
      );
    }
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    if (!this.isAvailable) {
      throw new StorageError('LocalStorage is not available', 'NOT_AVAILABLE');
    }

    try {
      const keys = this.keys();
      keys.forEach(key => {
        const fullKey = this.getFullKey(key);
        window.localStorage.removeItem(fullKey);
      });
    } catch (error) {
      throw new StorageError('Failed to clear storage', 'CLEAR_ERROR', error as Error);
    }
  }

  /**
   * 检查键是否存在
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 获取所有键
   */
  keys(): string[] {
    if (!this.isAvailable) {
      return [];
    }

    const keys: string[] = [];
    const prefix = this.config.prefix || '';

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.substring(prefix.length));
      }
    }

    return keys;
  }

  /**
   * 获取存储项数量
   */
  size(): number {
    return this.keys().length;
  }

  /**
   * 获取存储使用量（字节）
   */
  getUsage(): number {
    if (!this.isAvailable) {
      return 0;
    }

    let total = 0;
    this.keys().forEach(key => {
      const fullKey = this.getFullKey(key);
      const value = window.localStorage.getItem(fullKey);
      if (value) {
        total += fullKey.length + value.length;
      }
    });

    return total * 2; // JavaScript 字符串使用 UTF-16，每个字符 2 字节
  }

  /**
   * 获取剩余配额（估算）
   */
  getRemainingQuota(): number {
    const maxQuota = 5 * 1024 * 1024; // 5MB（一般限制）
    const usage = this.getUsage();
    return Math.max(0, maxQuota - usage);
  }

  /**
   * 清理过期项
   */
  private cleanup(): void {
    if (!this.isAvailable) {
      return;
    }

    const keys = this.keys();
    let cleaned = 0;

    keys.forEach(key => {
      const fullKey = this.getFullKey(key);
      const serialized = window.localStorage.getItem(fullKey);

      if (serialized) {
        const item = this.deserialize(serialized);
        if (item && this.isExpired(item)) {
          window.localStorage.removeItem(fullKey);
          cleaned++;
        }
      }
    });

    if (cleaned > 0) {
      console.debug(`[LocalStorage] Cleaned up ${cleaned} expired items`);
    }
  }

  /**
   * 启动定期清理任务
   */
  private startCleanupTask(): void {
    // 每小时清理一次
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * 简单加密（示例）
   * 生产环境应使用 crypto-js 等专业库
   */
  private encrypt(data: string): string {
    // 这里仅作示例，实际应使用真正的加密算法
    return btoa(data);
  }

  /**
   * 简单解密（示例）
   */
  private decrypt(data: string): string {
    return atob(data);
  }

  /**
   * 简单压缩（示例）
   * 生产环境应使用 pako 等压缩库
   */
  private compress(data: string): string {
    // 这里仅返回原数据，实际应使用压缩算法
    return data;
  }

  /**
   * 简单解压缩（示例）
   */
  private decompress(data: string): string {
    return data;
  }
}

/**
 * 创建 LocalStorage 管理器实例
 */
export function createLocalStorage(config?: Partial<StorageConfig>): LocalStorageManager {
  return new LocalStorageManager(config);
}

// 导出默认实例
export const localStorage = createLocalStorage();

