/**
 * WebSocket React Hooks
 * @module infrastructure/websocket/hooks
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebSocketClient, createWebSocketClient } from './client';
import type { WebSocketConfig, WebSocketState, WebSocketMessage } from './types';

/**
 * useWebSocket Hook
 * 
 * @example
 * const { send, state, lastMessage } = useWebSocket({
 *   url: 'ws://localhost:3001',
 *   onMessage: (message) => console.log(message),
 * });
 */
export function useWebSocket(config: WebSocketConfig) {
  const [state, setState] = useState<WebSocketState>(() => 
    config.autoConnect ? 'CONNECTING' as WebSocketState : 'DISCONNECTED' as WebSocketState
  );
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const clientRef = useRef<WebSocketClient | null>(null);

  // 初始化客户端
  useEffect(() => {
    const client = createWebSocketClient(config);
    clientRef.current = client;

    // 监听状态变化
    const unsubscribeState = client.on('state_change', ({ newState }: any) => {
      setState(newState);
    });

    // 监听消息
    const unsubscribeMessage = client.on('message', (message: WebSocketMessage) => {
      setLastMessage(message);
    });

    // 监听错误
    const unsubscribeError = client.on('error', (err: Error) => {
      setError(err);
    });

    return () => {
      unsubscribeState();
      unsubscribeMessage();
      unsubscribeError();
      client.disconnect();
    };
  }, []);

  // 发送消息
  const send = useCallback(<T = any>(message: WebSocketMessage<T>) => {
    return clientRef.current?.send(message) || false;
  }, []);

  // 连接
  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  // 断开
  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  return {
    state,
    lastMessage,
    error,
    send,
    connect,
    disconnect,
    client: clientRef.current,
  };
}

/**
 * useWebSocketMessage Hook - 监听特定类型的消息
 * 
 * @example
 * useWebSocketMessage(client, 'notification', (data) => {
 *   toast.success(data.message);
 * });
 */
export function useWebSocketMessage<T = any>(
  client: WebSocketClient | null,
  messageType: string,
  handler: (data: T) => void,
  deps: any[] = []
) {
  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.onMessage<T>(messageType, handler);

    return () => {
      unsubscribe();
    };
  }, [client, messageType, ...deps]);
}

/**
 * useWebSocketEvent Hook - 监听 WebSocket 事件
 * 
 * @example
 * useWebSocketEvent(client, 'open', () => {
 *   console.log('WebSocket connected');
 * });
 */
export function useWebSocketEvent<T = any>(
  client: WebSocketClient | null,
  event: string,
  handler: (data: T) => void,
  deps: any[] = []
) {
  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.on<T>(event, handler);

    return () => {
      unsubscribe();
    };
  }, [client, event, ...deps]);
}

/**
 * useWebSocketSubscription Hook - 订阅并自动取消订阅
 * 
 * @example
 * const messages = useWebSocketSubscription(client, 'chat', [userId]);
 */
export function useWebSocketSubscription<T = any>(
  client: WebSocketClient | null,
  topic: string,
  deps: any[] = []
): T[] {
  const [messages, setMessages] = useState<T[]>([]);

  useEffect(() => {
    if (!client) return;

    // 发送订阅消息
    client.send({
      type: 'subscribe',
      data: { topic },
    });

    // 监听该主题的消息
    const unsubscribe = client.onMessage<T>(topic, (data) => {
      setMessages(prev => [...prev, data]);
    });

    return () => {
      // 发送取消订阅消息
      client.send({
        type: 'unsubscribe',
        data: { topic },
      });
      unsubscribe();
    };
  }, [client, topic, ...deps]);

  return messages;
}

/**
 * useWebSocketState Hook - 获取 WebSocket 连接状态
 */
export function useWebSocketState(client: WebSocketClient | null): WebSocketState {
  const [state, setState] = useState<WebSocketState>(
    client?.getState() || 'DISCONNECTED' as WebSocketState
  );

  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.on('state_change', ({ newState }: any) => {
      setState(newState);
    });

    return unsubscribe;
  }, [client]);

  return state;
}

/**
 * useWebSocketReconnect Hook - 自动重连管理
 */
export function useWebSocketReconnect(
  client: WebSocketClient | null,
  onReconnect?: () => void
) {
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    if (!client) return;

    const unsubscribeReconnect = client.on('reconnect', ({ attempt }: any) => {
      setReconnectAttempts(attempt);
      setIsReconnecting(true);
      onReconnect?.();
    });

    const unsubscribeOpen = client.on('open', () => {
      setIsReconnecting(false);
      setReconnectAttempts(0);
    });

    const unsubscribeFailed = client.on('reconnect_failed', () => {
      setIsReconnecting(false);
    });

    return () => {
      unsubscribeReconnect();
      unsubscribeOpen();
      unsubscribeFailed();
    };
  }, [client, onReconnect]);

  return {
    reconnectAttempts,
    isReconnecting,
  };
}

