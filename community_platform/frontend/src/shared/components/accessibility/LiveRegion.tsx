/**
 * 实时通知区域组件
 * Live Region Component
 * 
 * 用于向屏幕阅读器用户宣布动态内容变化
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { cn } from '@/shared/utils/cn';

type LiveRegionPriority = 'polite' | 'assertive' | 'off';
type LiveRegionRole = 'status' | 'alert' | 'log' | 'timer';

interface LiveRegionProps {
  /** 通知优先级 */
  priority?: LiveRegionPriority;
  /** ARIA 角色 */
  role?: LiveRegionRole;
  /** 是否原子性更新（整体宣布） */
  atomic?: boolean;
  /** 是否相关更新也会被宣布 */
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  /** 是否视觉上隐藏 */
  visuallyHidden?: boolean;
  /** 子内容 */
  children: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

export function LiveRegion({
  priority = 'polite',
  role = 'status',
  atomic = true,
  relevant = 'additions',
  visuallyHidden = true,
  children,
  className,
}: LiveRegionProps) {
  return (
    <div
      role={role}
      aria-live={priority}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={cn(visuallyHidden && 'sr-only', className)}
    >
      {children}
    </div>
  );
}

/**
 * 通知公告器
 * 用于临时显示通知消息
 */
interface AnnouncerProps {
  /** 通知消息 */
  message: string;
  /** 优先级 */
  priority?: LiveRegionPriority;
  /** 消息清除延迟（毫秒） */
  clearDelay?: number;
  /** 清除后的回调 */
  onClear?: () => void;
}

export function Announcer({ message, priority = 'polite', clearDelay = 3000, onClear }: AnnouncerProps) {
  const messageRef = useRef(message);

  useEffect(() => {
    messageRef.current = message;

    if (message && clearDelay > 0) {
      const timer = setTimeout(() => {
        onClear?.();
      }, clearDelay);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [message, clearDelay, onClear]);

  if (!message) {
    return null;
  }

  return (
    <LiveRegion priority={priority} role="status">
      {message}
    </LiveRegion>
  );
}

/**
 * 使用 Announcer Hook
 */
export function useAnnouncer() {
  const [message, setMessage] = React.useState('');
  const [priority, setPriority] = React.useState<LiveRegionPriority>('polite');

  const announce = React.useCallback(
    (newMessage: string, newPriority: LiveRegionPriority = 'polite') => {
      setMessage(newMessage);
      setPriority(newPriority);
    },
    []
  );

  const clear = React.useCallback(() => {
    setMessage('');
  }, []);

  const AnnouncerComponent = React.useCallback(
    () => <Announcer message={message} priority={priority} onClear={clear} />,
    [message, priority, clear]
  );

  return {
    announce,
    clear,
    Announcer: AnnouncerComponent,
  };
}

/**
 * 加载状态通知
 */
interface LoadingAnnouncementProps {
  isLoading: boolean;
  loadingMessage?: string;
  completeMessage?: string;
}

export function LoadingAnnouncement({
  isLoading,
  loadingMessage = '正在加载...',
  completeMessage = '加载完成',
}: LoadingAnnouncementProps) {
  const [message, setMessage] = React.useState('');

  useEffect(() => {
    if (isLoading) {
      setMessage(loadingMessage);
    } else if (message === loadingMessage) {
      setMessage(completeMessage);
      const timer = setTimeout(() => setMessage(''), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isLoading, loadingMessage, completeMessage, message]);

  if (!message) {
    return null;
  }

  return (
    <LiveRegion priority="polite" role="status">
      {message}
    </LiveRegion>
  );
}

