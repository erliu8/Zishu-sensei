/**
 * API 服务统一导出
 * 
 * @module services/api
 */

// 聊天 API
export * from './chat';
export { default as ChatAPI } from './chat';

// 桌面操作 API
export * from './desktop';
export { default as DesktopAPI } from './desktop';

// 适配器 API
export * from './adapter';
export { default as AdapterAPI } from './adapter';

// 系统 API
export * from './system';
export { default as SystemAPI } from './system';

