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

// WebSocket API
export * from './websocket';
export { WebSocketManager, createWebSocketManager, getDefaultWebSocketManager } from './websocket';

// 数据同步 API
export * from './sync';
export { SyncManager, createSyncManager } from './sync';

// API 版本管理
export * from './version';
export { VersionManager, createVersionManager, versionUtils } from './version';

// 用户 API
export * from './user';
export { UserApiService, createUserApiService } from './user';

// 认证 API
export * from './auth';
export { AuthApiService, createAuthApiService } from './auth';

// 对话 API
export * from './conversation';
export { ConversationApiService, createConversationApiService } from './conversation';

