/**
 * WebSocket 类型定义
 * @module infrastructure/websocket/types
 */

/**
 * WebSocket 连接状态
 */
export enum WebSocketState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTING = 'DISCONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

/**
 * WebSocket 消息类型
 */
export interface WebSocketMessage<T = any> {
  /** 消息类型 */
  type: string;
  /** 消息数据 */
  data: T;
  /** 消息ID */
  id?: string;
  /** 时间戳 */
  timestamp?: number;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * WebSocket 事件类型
 */
export enum WebSocketEventType {
  OPEN = 'open',
  CLOSE = 'close',
  ERROR = 'error',
  MESSAGE = 'message',
  RECONNECT = 'reconnect',
  RECONNECT_FAILED = 'reconnect_failed',
  STATE_CHANGE = 'state_change',
}

/**
 * WebSocket 事件处理器
 */
export type WebSocketEventHandler<T = any> = (data: T) => void;

/**
 * WebSocket 配置
 */
export interface WebSocketConfig {
  /** WebSocket URL */
  url: string;
  /** 协议 */
  protocols?: string | string[];
  /** 是否自动连接 */
  autoConnect?: boolean;
  /** 是否自动重连 */
  autoReconnect?: boolean;
  /** 重连间隔（毫秒） */
  reconnectInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
  /** 心跳消息 */
  heartbeatMessage?: WebSocketMessage;
  /** 连接超时（毫秒） */
  connectionTimeout?: number;
  /** 消息队列最大长度 */
  maxQueueSize?: number;
  /** 是否启用调试日志 */
  debug?: boolean;
  /** 认证令牌获取函数 */
  getAuthToken?: () => string | Promise<string>;
}

/**
 * WebSocket 错误
 */
export class WebSocketError extends Error {
  code: string;
  originalError?: Error;

  constructor(message: string, code: string, originalError?: Error) {
    super(message);
    this.name = 'WebSocketError';
    this.code = code;
    this.originalError = originalError;
  }
}

/**
 * 消息队列项
 */
export interface QueuedMessage {
  message: WebSocketMessage;
  timestamp: number;
  retries: number;
}

