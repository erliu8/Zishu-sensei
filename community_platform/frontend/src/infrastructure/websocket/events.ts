/**
 * WebSocket 事件管理器
 * @module infrastructure/websocket/events
 */

import type { WebSocketEventHandler, WebSocketMessage } from './types';

/**
 * 事件管理器类
 */
export class EventManager {
  private handlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private onceHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();

  /**
   * 注册事件监听器
   */
  on<T = any>(event: string, handler: WebSocketEventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // 返回取消监听的函数
    return () => this.off(event, handler);
  }

  /**
   * 注册一次性事件监听器
   */
  once<T = any>(event: string, handler: WebSocketEventHandler<T>): () => void {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event)!.add(handler);

    // 返回取消监听的函数
    return () => this.offOnce(event, handler);
  }

  /**
   * 取消事件监听器
   */
  off<T = any>(event: string, handler: WebSocketEventHandler<T>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * 取消一次性事件监听器
   */
  private offOnce<T = any>(event: string, handler: WebSocketEventHandler<T>): void {
    const handlers = this.onceHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.onceHandlers.delete(event);
      }
    }
  }

  /**
   * 触发事件
   */
  emit<T = any>(event: string, data: T): void {
    // 触发常规监听器
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WebSocket Event] Error in handler for event "${event}":`, error);
        }
      });
    }

    // 触发一次性监听器
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      onceHandlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WebSocket Event] Error in once handler for event "${event}":`, error);
        }
      });
      // 清空一次性监听器
      this.onceHandlers.delete(event);
    }
  }

  /**
   * 移除某个事件的所有监听器
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
      this.onceHandlers.delete(event);
    } else {
      this.handlers.clear();
      this.onceHandlers.clear();
    }
  }

  /**
   * 获取事件的监听器数量
   */
  listenerCount(event: string): number {
    const handlersCount = this.handlers.get(event)?.size || 0;
    const onceHandlersCount = this.onceHandlers.get(event)?.size || 0;
    return handlersCount + onceHandlersCount;
  }

  /**
   * 获取所有事件名称
   */
  eventNames(): string[] {
    const events = new Set<string>();
    this.handlers.forEach((_, event) => events.add(event));
    this.onceHandlers.forEach((_, event) => events.add(event));
    return Array.from(events);
  }
}

/**
 * 消息路由器 - 根据消息类型路由到不同的处理器
 */
export class MessageRouter {
  private eventManager: EventManager;

  constructor(eventManager: EventManager) {
    this.eventManager = eventManager;
  }

  /**
   * 路由消息
   */
  route(message: WebSocketMessage): void {
    const { type, data } = message;

    // 触发特定类型的消息事件
    this.eventManager.emit(`message:${type}`, data);

    // 触发通用消息事件
    this.eventManager.emit('message', message);
  }

  /**
   * 注册消息类型处理器
   */
  onMessage<T = any>(
    type: string,
    handler: WebSocketEventHandler<T>
  ): () => void {
    return this.eventManager.on(`message:${type}`, handler);
  }

  /**
   * 注册一次性消息类型处理器
   */
  onceMessage<T = any>(
    type: string,
    handler: WebSocketEventHandler<T>
  ): () => void {
    return this.eventManager.once(`message:${type}`, handler);
  }

  /**
   * 取消消息类型处理器
   */
  offMessage<T = any>(
    type: string,
    handler: WebSocketEventHandler<T>
  ): void {
    this.eventManager.off(`message:${type}`, handler);
  }
}

