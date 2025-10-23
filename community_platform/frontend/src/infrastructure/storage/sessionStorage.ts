/**
 * SessionStorage 封装
 * @module infrastructure/storage/sessionStorage
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
  prefix: 'zishu_session_',
  defaultTTL: 0, // sessionStorage 在会话结束时自动清除
  encrypt: false,
  compress: false,
  version: 1,
};

/**
 * SessionStorage 管理器类
 */
export class SessionStorageManager implements StorageAdapter {
  private config: StorageConfig;
  private isAvailable: boolean;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.isAvailable = this.checkAvailability();
  }

  /**
   * 检查 sessionStorage 是否可用
   */
  private checkAvailability(): boolean {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) {
        return false;
      }

      const testKey = '__storage_test__';
      window.sessionStorage.setItem(testKey, 'test');
      window.sessionStorage.removeItem(testKey);
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
   * 序列化数据
   */
  private serialize<T>(value: T, options?: StorageOptions): string {
    const now = Date.now();

    const item: StorageItem<T> = {
      value,
      createdAt: now,
      updatedAt: now,
      version: options?.version ?? this.config.version,
    };

    let serialized = JSON.stringify(item);

    // 加密
    if (options?.encrypt ?? this.config.encrypt) {
      serialized = this.encrypt(serialized);
    }

    return serialized;
  }

  /**
   * 反序列化数据
   */
  private deserialize<T>(serialized: string): StorageItem<T> | null {
    try {
      let data = serialized;

      // 解密
      if (this.config.encrypt) {
        data = this.decrypt(data);
      }

      return JSON.parse(data) as StorageItem<T>;
    } catch (error) {
      console.error('[SessionStorage] Failed to deserialize:', error);
      return null;
    }
  }

  /**
   * 获取数据
   */
  get<T>(key: string): T | null {
    if (!this.isAvailable) {
      throw new StorageError('SessionStorage is not available', 'NOT_AVAILABLE');
    }

    try {
      const fullKey = this.getFullKey(key);
      const serialized = window.sessionStorage.getItem(fullKey);

      if (!serialized) {
        return null;
      }

      const item = this.deserialize<T>(serialized);

      if (!item) {
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
      throw new StorageError('SessionStorage is not available', 'NOT_AVAILABLE');
    }

    try {
      const fullKey = this.getFullKey(key);
      const serialized = this.serialize(value, options);

      window.sessionStorage.setItem(fullKey, serialized);
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
      throw new StorageError('SessionStorage is not available', 'NOT_AVAILABLE');
    }

    try {
      const fullKey = this.getFullKey(key);
      window.sessionStorage.removeItem(fullKey);
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
      throw new StorageError('SessionStorage is not available', 'NOT_AVAILABLE');
    }

    try {
      const keys = this.keys();
      keys.forEach(key => {
        const fullKey = this.getFullKey(key);
        window.sessionStorage.removeItem(fullKey);
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

    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
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
      const value = window.sessionStorage.getItem(fullKey);
      if (value) {
        total += fullKey.length + value.length;
      }
    });

    return total * 2;
  }

  /**
   * 简单加密（示例）
   */
  private encrypt(data: string): string {
    return btoa(data);
  }

  /**
   * 简单解密（示例）
   */
  private decrypt(data: string): string {
    return atob(data);
  }
}

/**
 * 创建 SessionStorage 管理器实例
 */
export function createSessionStorage(config?: Partial<StorageConfig>): SessionStorageManager {
  return new SessionStorageManager(config);
}

// 导出默认实例
export const sessionStorage = createSessionStorage();

