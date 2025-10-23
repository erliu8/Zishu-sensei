/**
 * 存储基础设施模块导出
 * @module infrastructure/storage
 */

// 导出类型
export type {
  StorageItem,
  StorageConfig,
  StorageOptions,
  IndexedDBConfig,
  StorageAdapter,
} from './types';

export {
  StorageEventType,
  StorageError,
} from './types';

// 导出 LocalStorage
export {
  LocalStorageManager,
  createLocalStorage,
  localStorage,
} from './localStorage';

// 导出 SessionStorage
export {
  SessionStorageManager,
  createSessionStorage,
  sessionStorage,
} from './sessionStorage';

// 导出 IndexedDB
export {
  IndexedDBManager,
  createIndexedDB,
  indexedDB,
} from './indexedDB';

