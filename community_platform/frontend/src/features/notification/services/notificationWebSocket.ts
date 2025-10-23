import type { WebSocketNotificationMessage, Notification } from '../domain/notification';

type NotificationEventHandler = (message: WebSocketNotificationMessage) => void;

/**
 * 通知 WebSocket 服务
 */
export class NotificationWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventHandlers: Set<NotificationEventHandler> = new Set();
  private url: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    // 从环境变量获取 WebSocket URL，默认使用当前域名
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const defaultUrl = `${wsProtocol}//${window.location.host}/ws/notifications`;
    this.url = baseUrl || process.env.NEXT_PUBLIC_WS_URL || defaultUrl;
  }

  /**
   * 连接 WebSocket
   */
  connect(token?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[NotificationWS] Already connected');
      return;
    }

    if (token) {
      this.token = token;
    }

    try {
      // 添加token到URL参数
      const url = this.token ? `${this.url}?token=${this.token}` : this.url;
      this.ws = new WebSocket(url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error('[NotificationWS] Connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.onclose = null; // 防止触发重连
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    console.log('[NotificationWS] Disconnected');
  }

  /**
   * 添加事件处理器
   */
  on(handler: NotificationEventHandler): () => void {
    this.eventHandlers.add(handler);
    
    // 返回取消订阅函数
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * 发送消息（标记已读等）
   */
  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[NotificationWS] WebSocket is not connected');
    }
  }

  /**
   * 处理连接打开
   */
  private handleOpen(): void {
    console.log('[NotificationWS] Connected');
    this.reconnectAttempts = 0;
    this.startHeartbeat();
  }

  /**
   * 处理消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketNotificationMessage = JSON.parse(event.data);
      
      // 忽略心跳响应
      if (message.action === 'pong' || (message as any).type === 'pong') {
        return;
      }

      // 分发消息到所有处理器
      this.eventHandlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error('[NotificationWS] Handler error:', error);
        }
      });
    } catch (error) {
      console.error('[NotificationWS] Message parse error:', error);
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: Event): void {
    console.error('[NotificationWS] Error:', error);
  }

  /**
   * 处理连接关闭
   */
  private handleClose(event: CloseEvent): void {
    console.log('[NotificationWS] Closed:', event.code, event.reason);
    this.stopHeartbeat();
    this.ws = null;

    // 非正常关闭时尝试重连
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[NotificationWS] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[NotificationWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // 每30秒发送一次心跳
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 获取连接状态
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * 是否已连接
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// 导出单例
export const notificationWebSocket = new NotificationWebSocketService();

