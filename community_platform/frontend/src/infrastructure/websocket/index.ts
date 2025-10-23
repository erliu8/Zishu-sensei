/**
 * WebSocket 基础设施模块导出
 * @module infrastructure/websocket
 */

// 导出类型
export type {
  WebSocketConfig,
  WebSocketMessage,
  WebSocketEventHandler,
  QueuedMessage,
} from './types';

export {
  WebSocketState,
  WebSocketEventType,
  WebSocketError,
} from './types';

// 导出客户端
export { WebSocketClient, createWebSocketClient } from './client';

// 导出事件管理
export { EventManager, MessageRouter } from './events';

// 导出 Hooks
export {
  useWebSocket,
  useWebSocketMessage,
  useWebSocketEvent,
  useWebSocketSubscription,
  useWebSocketState,
  useWebSocketReconnect,
} from './hooks';

