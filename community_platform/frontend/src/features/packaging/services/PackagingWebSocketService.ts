/**
 * Packaging WebSocket Service
 * 打包进度 WebSocket 服务
 */

import type { PackagingProgressUpdate, PackagingTask } from '../domain/packaging.types';

/**
 * WebSocket 事件类型
 */
export enum PackagingWebSocketEvent {
  /** 连接成功 */
  CONNECTED = 'connected',
  /** 连接断开 */
  DISCONNECTED = 'disconnected',
  /** 进度更新 */
  PROGRESS_UPDATE = 'progress_update',
  /** 任务完成 */
  TASK_COMPLETED = 'task_completed',
  /** 任务失败 */
  TASK_FAILED = 'task_failed',
  /** 任务取消 */
  TASK_CANCELLED = 'task_cancelled',
  /** 错误 */
  ERROR = 'error',
}

/**
 * WebSocket 消息类型
 */
interface WebSocketMessage {
  type: PackagingWebSocketEvent;
  data: any;
  timestamp: number;
}

/**
 * 事件监听器类型
 */
type EventListener = (data: any) => void;

/**
 * 打包 WebSocket 服务类
 */
export class PackagingWebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<PackagingWebSocketEvent, Set<EventListener>> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private isManualClose = false;
  private subscribedTasks: Set<string> = new Set();

  /**
   * 连接 WebSocket
   */
  connect(taskId?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      if (taskId) {
        this.subscribeToTask(taskId);
      }
      return;
    }

    this.isManualClose = false;
    const wsUrl = this.getWebSocketUrl();

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit(PackagingWebSocketEvent.CONNECTED, {});

        // 重新订阅之前订阅的任务
        this.subscribedTasks.forEach((id) => {
          this.subscribeToTask(id);
        });

        // 如果提供了新的 taskId，订阅它
        if (taskId) {
          this.subscribeToTask(taskId);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit(PackagingWebSocketEvent.ERROR, { error });
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.emit(PackagingWebSocketEvent.DISCONNECTED, {});

        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.emit(PackagingWebSocketEvent.ERROR, { error });
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.isManualClose = true;
    this.subscribedTasks.clear();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 订阅任务进度
   */
  subscribeToTask(taskId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, storing task for later subscription');
      this.subscribedTasks.add(taskId);
      this.connect(taskId);
      return;
    }

    this.subscribedTasks.add(taskId);
    this.send({
      type: 'subscribe',
      taskId,
    });
  }

  /**
   * 取消订阅任务进度
   */
  unsubscribeFromTask(taskId: string): void {
    this.subscribedTasks.delete(taskId);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'unsubscribe',
        taskId,
      });
    }
  }

  /**
   * 监听事件
   */
  on(event: PackagingWebSocketEvent, listener: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(listener);

    // 返回取消监听函数
    return () => {
      this.off(event, listener);
    };
  }

  /**
   * 取消监听
   */
  off(event: PackagingWebSocketEvent, listener: EventListener): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  /**
   * 监听一次
   */
  once(event: PackagingWebSocketEvent, listener: EventListener): void {
    const onceListener: EventListener = (data) => {
      listener(data);
      this.off(event, onceListener);
    };

    this.on(event, onceListener);
  }

  /**
   * 获取连接状态
   */
  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 发送消息
   */
  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  /**
   * 处理消息
   */
  private handleMessage(message: WebSocketMessage): void {
    const { type, data } = message;

    switch (type) {
      case PackagingWebSocketEvent.PROGRESS_UPDATE:
        this.emit(PackagingWebSocketEvent.PROGRESS_UPDATE, data as PackagingProgressUpdate);
        break;

      case PackagingWebSocketEvent.TASK_COMPLETED:
        this.emit(PackagingWebSocketEvent.TASK_COMPLETED, data as PackagingTask);
        break;

      case PackagingWebSocketEvent.TASK_FAILED:
        this.emit(PackagingWebSocketEvent.TASK_FAILED, data as PackagingTask);
        break;

      case PackagingWebSocketEvent.TASK_CANCELLED:
        this.emit(PackagingWebSocketEvent.TASK_CANCELLED, data as PackagingTask);
        break;

      case PackagingWebSocketEvent.ERROR:
        this.emit(PackagingWebSocketEvent.ERROR, data);
        break;

      default:
        console.warn('Unknown WebSocket message type:', type);
    }
  }

  /**
   * 触发事件
   */
  private emit(event: PackagingWebSocketEvent, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  /**
   * 获取 WebSocket URL
   */
  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.host;
    const path = process.env.NEXT_PUBLIC_WS_PATH || '/ws/packaging';

    return `${protocol}//${host}${path}`;
  }
}

/**
 * 单例实例
 */
export const packagingWebSocketService = new PackagingWebSocketService();

