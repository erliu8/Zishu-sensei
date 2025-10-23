import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationWebSocket } from '../services/notificationWebSocket';
import { useNotificationStore } from '../store/notificationStore';
import { notificationKeys } from './useNotifications';
import type { WebSocketNotificationMessage } from '../domain/notification';

/**
 * WebSocket 通知钩子
 * 自动连接、监听和断开 WebSocket
 */
export function useNotificationWebSocket(token?: string) {
  const queryClient = useQueryClient();
  const {
    addNotification,
    updateNotification,
    removeNotification,
    setUnreadCount,
    setWsConnected,
  } = useNotificationStore();

  // 处理 WebSocket 消息
  const handleMessage = useCallback(
    (message: WebSocketNotificationMessage) => {
      switch (message.action) {
        case 'new':
          // 新通知
          if (message.notification) {
            addNotification(message.notification);
            
            // 刷新通知列表
            queryClient.invalidateQueries({
              queryKey: notificationKeys.lists(),
            });
            
            // 可选：显示浏览器通知
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(message.notification.title, {
                body: message.notification.content,
                icon: '/icon-192.png',
                tag: message.notification.id,
              });
            }
          }
          break;

        case 'update':
          // 更新通知
          if (message.notification) {
            updateNotification(message.notification.id, message.notification);
            
            queryClient.invalidateQueries({
              queryKey: notificationKeys.detail(message.notification.id),
            });
          }
          break;

        case 'delete':
          // 删除通知
          if (message.notificationId) {
            removeNotification(message.notificationId);
          }
          break;

        case 'mark_read':
          // 标记已读
          if (message.notificationId) {
            updateNotification(message.notificationId, { status: 'read' });
          }
          break;

        case 'mark_all_read':
          // 标记所有已读
          setUnreadCount(0);
          queryClient.invalidateQueries({
            queryKey: notificationKeys.lists(),
          });
          break;

        default:
          console.warn('[NotificationWS] Unknown action:', message.action);
      }

      // 更新未读数量（如果消息中包含）
      if (message.count !== undefined) {
        setUnreadCount(message.count);
      }
    },
    [
      addNotification,
      updateNotification,
      removeNotification,
      setUnreadCount,
      queryClient,
    ]
  );

  useEffect(() => {
    // 连接 WebSocket
    notificationWebSocket.connect(token);
    setWsConnected(true);

    // 订阅消息
    const unsubscribe = notificationWebSocket.on(handleMessage);

    // 请求浏览器通知权限（可选）
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // 清理函数
    return () => {
      unsubscribe();
      setWsConnected(false);
      // 注意：不要在这里断开连接，因为可能有多个组件使用这个 hook
      // 只在应用卸载时断开连接
    };
  }, [token, handleMessage, setWsConnected]);

  return {
    isConnected: notificationWebSocket.isConnected,
    send: notificationWebSocket.send.bind(notificationWebSocket),
  };
}

/**
 * 仅用于初始化 WebSocket 连接的钩子
 * 通常在 App 或 Layout 层使用
 */
export function useInitNotificationWebSocket(token?: string) {
  useEffect(() => {
    if (token) {
      notificationWebSocket.connect(token);
    }

    return () => {
      notificationWebSocket.disconnect();
    };
  }, [token]);
}

