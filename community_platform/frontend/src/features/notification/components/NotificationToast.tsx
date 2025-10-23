'use client';

import React, { useEffect } from 'react';
import { Bell, MessageSquare, Heart, UserPlus, Trophy, AlertCircle } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { Notification, NotificationType } from '../types';
import { useRouter } from 'next/navigation';

interface NotificationToastProps {
  notification: Notification;
  onDismiss?: () => void;
}

/**
 * 实时通知 Toast 组件
 * 当收到新通知时显示的弹窗提醒
 */
export function NotificationToast({
  notification,
  onDismiss,
}: NotificationToastProps) {
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const icon = getNotificationIcon(notification.type);
    
    toast({
      title: (
        <div className="flex items-center gap-2">
          {icon}
          <span>{notification.title}</span>
        </div>
      ),
      description: notification.content,
      action: notification.actionUrl
        ? {
            label: '查看',
            onClick: () => {
              router.push(notification.actionUrl!);
              onDismiss?.();
            },
          }
        : undefined,
      variant: notification.type === 'system' ? 'default' : 'default',
    });
  }, [notification, toast, router, onDismiss]);

  return null;
}

/**
 * 根据通知类型获取图标
 */
function getNotificationIcon(type: NotificationType) {
  const iconClassName = 'h-4 w-4';
  
  switch (type) {
    case 'comment':
      return <MessageSquare className={iconClassName} />;
    case 'like':
      return <Heart className={iconClassName} />;
    case 'follow':
      return <UserPlus className={iconClassName} />;
    case 'achievement':
      return <Trophy className={iconClassName} />;
    case 'system':
      return <AlertCircle className={iconClassName} />;
    default:
      return <Bell className={iconClassName} />;
  }
}

interface NotificationToastContainerProps {
  enabled?: boolean;
}

/**
 * 通知 Toast 容器组件
 * 监听新通知并自动显示 Toast
 */
export function NotificationToastContainer({
  enabled = true,
}: NotificationToastContainerProps) {
  // TODO: 实现 WebSocket 连接，监听新通知
  // TODO: 集成通知推送服务（如 Pusher, Socket.io 等）
  
  useEffect(() => {
    if (!enabled) return;

    // 示例：监听自定义事件
    const handleNewNotification = (event: CustomEvent<Notification>) => {
      const notification = event.detail;
      // 渲染通知 toast
      // 这里可以维护一个通知队列
    };

    window.addEventListener('new-notification', handleNewNotification as EventListener);

    return () => {
      window.removeEventListener('new-notification', handleNewNotification as EventListener);
    };
  }, [enabled]);

  return null;
}

/**
 * 触发新通知 Toast 的辅助函数
 */
export function showNotificationToast(notification: Notification) {
  const event = new CustomEvent('new-notification', {
    detail: notification,
  });
  window.dispatchEvent(event);
}

