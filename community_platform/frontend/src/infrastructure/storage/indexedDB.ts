/**
 * IndexedDB 封装
 * @module infrastructure/storage/indexedDB
 */

import type {
  IndexedDBConfig,
  StorageOptions,
  StorageItem,
} from './types';
import { StorageError } from './types';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Partial<IndexedDBConfig> = {
  dbName: 'zishu_db',
  dbVersion: 1,
  storeName: 'cache',
  prefix: '',
  defaultTTL: 0,
  version: 1,
};

/**
 * IndexedDB 管理器类
 */
export class IndexedDBManager {
  private config: IndexedDBConfig;
  private db: IDBDatabase | null = null;
  private isAvailable: boolean;
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<IndexedDBConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config } as IndexedDBConfig;
    this.isAvailable = this.checkAvailability();

    if (this.isAvailable) {
      this.initPromise = this.init();
    }
  }

  /**
   * 检查 IndexedDB 是否可用
   */
  private checkAvailability(): boolean {
    try {
      return typeof window !== 'undefined' && 
             'indexedDB' in window && 
             window.indexedDB !== null;
    } catch {
      return false;
    }
  }

  /**
   * 初始化数据库
   */
  private async init(): Promise<void> {
    if (this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onerror = () => {
        reject(new StorageError(
          'Failed to open IndexedDB',
          'OPEN_ERROR',
          request.error as any
        ));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建对象存储（如果不存在）
        if (!db.objectStoreNames.contains(this.config.storeName)) {
          const objectStore = db.createObjectStore(this.config.storeName, {
            keyPath: 'key',
          });

          // 创建索引
          objectStore.createIndex('expireAt', 'expireAt', { unique: false });
          objectStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.isAvailable) {
      throw new StorageError('IndexedDB is not available', 'NOT_AVAILABLE');
    }

    if (this.initPromise) {
      await this.initPromise;
    }

    if (!this.db) {
      throw new StorageError('Database not initialized', 'NOT_INITIALIZED');
    }

    return this.db;
  }

  /**
   * 生成完整的键名
   */
  private getFullKey(key: string): string {
    return this.config.prefix ? `${this.config.prefix}${key}` : key;
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
   * 获取数据
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.ensureDB();
      const fullKey = this.getFullKey(key);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.config.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.config.storeName);
        const request = objectStore.get(fullKey);

        request.onsuccess = () => {
          const record = request.result;

          if (!record) {
            resolve(null);
            return;
          }

          const item: StorageItem<T> = record;

          // 检查是否过期
          if (this.isExpired(item)) {
            this.remove(key); // 异步删除
            resolve(null);
            return;
          }

          // 版本检查
          if (this.config.version && item.version !== this.config.version) {
            this.remove(key); // 异步删除
            resolve(null);
            return;
          }

          resolve(item.value);
        };

        request.onerror = () => {
          reject(new StorageError(
            `Failed to get item: ${key}`,
            'GET_ERROR',
            request.error as any
          ));
        };
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 设置数据
   */
  async set<T>(key: string, value: T, options?: StorageOptions): Promise<void> {
    try {
      const db = await this.ensureDB();
      const fullKey = this.getFullKey(key);
      const now = Date.now();
      const ttl = options?.ttl ?? this.config.defaultTTL ?? 0;

      const item: StorageItem<T> & { key: string } = {
        key: fullKey,
        value,
        expireAt: ttl > 0 ? now + ttl : undefined,
        createdAt: now,
        updatedAt: now,
        version: options?.version ?? this.config.version,
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.config.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.config.storeName);
        const request = objectStore.put(item);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(new StorageError(
            `Failed to set item: ${key}`,
            'SET_ERROR',
            request.error as any
          ));
        };
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 移除数据
   */
  async remove(key: string): Promise<void> {
    try {
      const db = await this.ensureDB();
      const fullKey = this.getFullKey(key);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.config.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.config.storeName);
        const request = objectStore.delete(fullKey);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(new StorageError(
            `Failed to remove item: ${key}`,
            'REMOVE_ERROR',
            request.error as any
          ));
        };
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.config.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.config.storeName);

        // 如果有前缀，只删除匹配前缀的键
        if (this.config.prefix) {
          const range = IDBKeyRange.bound(
            this.config.prefix,
            this.config.prefix + '\uffff'
          );
          const request = objectStore.delete(range);

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            reject(new StorageError(
              'Failed to clear storage',
              'CLEAR_ERROR',
              request.error as any
            ));
          };
        } else {
          // 清空整个存储
          const request = objectStore.clear();

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            reject(new StorageError(
              'Failed to clear storage',
              'CLEAR_ERROR',
              request.error as any
            ));
          };
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 检查键是否存在
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * 获取所有键
   */
  async keys(): Promise<string[]> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.config.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.config.storeName);
        const request = objectStore.getAllKeys();

        request.onsuccess = () => {
          const allKeys = request.result as string[];
          const prefix = this.config.prefix || '';

          const keys = allKeys
            .filter(key => key.startsWith(prefix))
            .map(key => key.substring(prefix.length));

          resolve(keys);
        };

        request.onerror = () => {
          reject(new StorageError(
            'Failed to get keys',
            'KEYS_ERROR',
            request.error as any
          ));
        };
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取存储项数量
   */
  async size(): Promise<number> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.config.storeName], 'readonly');
        const objectStore = transaction.objectStore(this.config.storeName);
        const request = objectStore.count();

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(new StorageError(
            'Failed to get size',
            'SIZE_ERROR',
            request.error as any
          ));
        };
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 清理过期项
   */
  async cleanup(): Promise<number> {
    try {
      const db = await this.ensureDB();
      const now = Date.now();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.config.storeName], 'readwrite');
        const objectStore = transaction.objectStore(this.config.storeName);
        const index = objectStore.index('expireAt');
        const range = IDBKeyRange.upperBound(now);
        const request = index.openCursor(range);

        let count = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor) {
            cursor.delete();
            count++;
            cursor.continue();
          } else {
            console.debug(`[IndexedDB] Cleaned up ${count} expired items`);
            resolve(count);
          }
        };

        request.onerror = () => {
          reject(new StorageError(
            'Failed to cleanup',
            'CLEANUP_ERROR',
            request.error as any
          ));
        };
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取存储使用量估算
   */
  async getUsage(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }

    return { usage: 0, quota: 0 };
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * 创建 IndexedDB 管理器实例
 */
export function createIndexedDB(config: Partial<IndexedDBConfig>): IndexedDBManager {
  return new IndexedDBManager(config);
}

// 导出默认实例
export const indexedDB = createIndexedDB({
  dbName: 'zishu_db',
  storeName: 'cache',
});

