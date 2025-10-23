/**
 * WebSocket 客户端
 * @module infrastructure/websocket/client
 */

import {
  WebSocketConfig,
  WebSocketState,
  WebSocketMessage,
  WebSocketError,
  WebSocketEventType,
  QueuedMessage,
} from './types';
import { EventManager, MessageRouter } from './events';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Partial<WebSocketConfig> = {
  autoConnect: true,
  autoReconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
  connectionTimeout: 10000,
  maxQueueSize: 100,
  debug: process.env.NODE_ENV === 'development',
};

/**
 * WebSocket 客户端类
 */
export class WebSocketClient {
  private config: Required<WebSocketConfig>;
  private ws: WebSocket | null = null;
  private state: WebSocketState = WebSocketState.DISCONNECTED;
  private eventManager: EventManager;
  private messageRouter: MessageRouter;
  private messageQueue: QueuedMessage[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionTimer: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      heartbeatMessage: config.heartbeatMessage || {
        type: 'ping',
        data: { timestamp: Date.now() },
      },
    } as Required<WebSocketConfig>;

    this.eventManager = new EventManager();
    this.messageRouter = new MessageRouter(this.eventManager);

    if (this.config.autoConnect) {
      this.connect();
    }
  }

  /**
   * 连接 WebSocket
   */
  async connect(): Promise<void> {
    if (this.state === WebSocketState.CONNECTED || this.state === WebSocketState.CONNECTING) {
      this.log('Already connected or connecting');
      return;
    }

    this.setState(WebSocketState.CONNECTING);
    this.log('Connecting to', this.config.url);

    try {
      // 获取认证令牌
      let url = this.config.url;
      if (this.config.getAuthToken) {
        const token = await this.config.getAuthToken();
        url = this.appendToken(url, token);
      }

      // 创建 WebSocket 连接
      this.ws = new WebSocket(url, this.config.protocols);

      // 设置连接超时
      this.setConnectionTimeout();

      // 绑定事件
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      this.handleError(error as Event);
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.log('Disconnecting');
    this.setState(WebSocketState.DISCONNECTING);
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState(WebSocketState.DISCONNECTED);
  }

  /**
   * 发送消息
   */
  send<T = any>(message: WebSocketMessage<T>): boolean {
    // 添加消息元数据
    const fullMessage: WebSocketMessage<T> = {
      ...message,
      id: message.id || this.generateMessageId(),
      timestamp: message.timestamp || Date.now(),
    };

    // 如果已连接，直接发送
    if (this.state === WebSocketState.CONNECTED && this.ws) {
      try {
        this.ws.send(JSON.stringify(fullMessage));
        this.log('Sent message:', fullMessage);
        return true;
      } catch (error) {
        this.logError('Failed to send message:', error);
        this.queueMessage(fullMessage);
        return false;
      }
    }

    // 否则加入队列
    this.queueMessage(fullMessage);
    return false;
  }

  /**
   * 监听事件
   */
  on<T = any>(event: string, handler: (data: T) => void): () => void {
    return this.eventManager.on(event, handler);
  }

  /**
   * 监听一次性事件
   */
  once<T = any>(event: string, handler: (data: T) => void): () => void {
    return this.eventManager.once(event, handler);
  }

  /**
   * 取消监听
   */
  off<T = any>(event: string, handler: (data: T) => void): void {
    this.eventManager.off(event, handler);
  }

  /**
   * 监听特定类型的消息
   */
  onMessage<T = any>(type: string, handler: (data: T) => void): () => void {
    return this.messageRouter.onMessage(type, handler);
  }

  /**
   * 获取当前状态
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED;
  }

  /**
   * 处理连接打开
   */
  private handleOpen(event: Event): void {
    this.log('Connected');
    this.clearConnectionTimeout();
    this.setState(WebSocketState.CONNECTED);
    this.reconnectAttempts = 0;

    // 触发连接事件
    this.eventManager.emit(WebSocketEventType.OPEN, event);

    // 发送队列中的消息
    this.flushMessageQueue();

    // 启动心跳
    this.startHeartbeat();
  }

  /**
   * 处理连接关闭
   */
  private handleClose(event: CloseEvent): void {
    this.log('Disconnected', event.code, event.reason);
    this.clearTimers();

    const wasConnected = this.state === WebSocketState.CONNECTED;
    this.setState(WebSocketState.DISCONNECTED);

    // 触发关闭事件
    this.eventManager.emit(WebSocketEventType.CLOSE, event);

    // 自动重连
    if (this.config.autoReconnect && wasConnected && !event.wasClean) {
      this.scheduleReconnect();
    }
  }

  /**
   * 处理错误
   */
  private handleError(event: Event): void {
    this.logError('WebSocket error:', event);
    this.setState(WebSocketState.ERROR);

    const error = new WebSocketError(
      'WebSocket connection error',
      'CONNECTION_ERROR',
      event as any
    );

    this.eventManager.emit(WebSocketEventType.ERROR, error);
  }

  /**
   * 处理消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.log('Received message:', message);

      // 路由消息
      this.messageRouter.route(message);
    } catch (error) {
      this.logError('Failed to parse message:', error);
    }
  }

  /**
   * 设置状态
   */
  private setState(state: WebSocketState): void {
    if (this.state !== state) {
      const oldState = this.state;
      this.state = state;
      this.log('State changed:', oldState, '->', state);
      this.eventManager.emit(WebSocketEventType.STATE_CHANGE, { oldState, newState: state });
    }
  }

  /**
   * 调度重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.logError('Max reconnect attempts reached');
      this.eventManager.emit(WebSocketEventType.RECONNECT_FAILED, {
        attempts: this.reconnectAttempts,
      });
      return;
    }

    this.reconnectAttempts++;
    this.setState(WebSocketState.RECONNECTING);

    const delay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.eventManager.emit(WebSocketEventType.RECONNECT, {
        attempt: this.reconnectAttempts,
      });
      this.connect();
    }, delay);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send(this.config.heartbeatMessage);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 设置连接超时
   */
  private setConnectionTimeout(): void {
    this.connectionTimer = setTimeout(() => {
      if (this.state === WebSocketState.CONNECTING) {
        this.logError('Connection timeout');
        this.ws?.close();
        this.handleError(new Event('timeout'));
      }
    }, this.config.connectionTimeout);
  }

  /**
   * 清除连接超时
   */
  private clearConnectionTimeout(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  /**
   * 清除所有定时器
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.clearConnectionTimeout();
  }

  /**
   * 将消息加入队列
   */
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      this.logError('Message queue is full, dropping oldest message');
      this.messageQueue.shift();
    }

    this.messageQueue.push({
      message,
      timestamp: Date.now(),
      retries: 0,
    });

    this.log('Message queued, queue size:', this.messageQueue.length);
  }

  /**
   * 发送队列中的消息
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    this.log('Flushing message queue, size:', this.messageQueue.length);

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    queue.forEach(({ message }) => {
      this.send(message);
    });
  }

  /**
   * 附加令牌到 URL
   */
  private appendToken(url: string, token: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }

  /**
   * 生成消息 ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 日志输出
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args);
    }
  }

  /**
   * 错误日志输出
   */
  private logError(...args: any[]): void {
    if (this.config.debug) {
      console.error('[WebSocket]', ...args);
    }
  }
}

/**
 * 创建 WebSocket 客户端
 */
export function createWebSocketClient(config: WebSocketConfig): WebSocketClient {
  return new WebSocketClient(config);
}

