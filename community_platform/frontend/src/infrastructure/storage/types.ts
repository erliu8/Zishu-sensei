/**
 * 存储类型定义
 * @module infrastructure/storage/types
 */

/**
 * 存储项接口
 */
export interface StorageItem<T = any> {
  /** 数据 */
  value: T;
  /** 过期时间（时间戳） */
  expireAt?: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 版本号 */
  version?: number;
}

/**
 * 存储配置
 */
export interface StorageConfig {
  /** 键前缀 */
  prefix?: string;
  /** 默认过期时间（毫秒） */
  defaultTTL?: number;
  /** 是否加密 */
  encrypt?: boolean;
  /** 加密密钥 */
  encryptionKey?: string;
  /** 是否启用压缩 */
  compress?: boolean;
  /** 版本号 */
  version?: number;
}

/**
 * 存储选项
 */
export interface StorageOptions {
  /** 过期时间（毫秒） */
  ttl?: number;
  /** 是否加密 */
  encrypt?: boolean;
  /** 版本号 */
  version?: number;
}

/**
 * IndexedDB 配置
 */
export interface IndexedDBConfig extends StorageConfig {
  /** 数据库名称 */
  dbName: string;
  /** 数据库版本 */
  dbVersion?: number;
  /** 对象存储名称 */
  storeName: string;
}

/**
 * 存储事件类型
 */
export enum StorageEventType {
  SET = 'set',
  GET = 'get',
  REMOVE = 'remove',
  CLEAR = 'clear',
  EXPIRE = 'expire',
}

/**
 * 存储错误
 */
export class StorageError extends Error {
  code: string;
  originalError?: Error;

  constructor(message: string, code: string, originalError?: Error) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * 存储适配器接口
 */
export interface StorageAdapter {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, options?: StorageOptions): void;
  remove(key: string): void;
  clear(): void;
  has(key: string): boolean;
  keys(): string[];
  size(): number;
}

