'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Share2,
  TrendingUp,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { Notification, NotificationType } from '../domain/notification';
import Link from 'next/link';

interface NotificationListProps {
  notifications: Notification[];
  loading?: boolean;
  onMarkAsRead?: (id: string) => void;
  onMarkAsUnread?: (id: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  className?: string;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

// 通知类型图标映射
const NOTIFICATION_ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  mention: Bell,
  reply: MessageCircle,
  share: Share2,
  system: Bell,
  achievement: Award,
  trending: TrendingUp,
};

// 通知类型颜色映射
const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  like: 'text-pink-500',
  comment: 'text-blue-500',
  follow: 'text-green-500',
  mention: 'text-purple-500',
  reply: 'text-indigo-500',
  share: 'text-orange-500',
  system: 'text-gray-500',
  achievement: 'text-yellow-500',
  trending: 'text-red-500',
};

/**
 * 通知列表组件
 */
export function NotificationList({
  notifications,
  loading = false,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
  onArchive,
  className,
  selectMode = false,
  selectedIds,
  onToggleSelect,
}: NotificationListProps) {
  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <NotificationItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className={cn('py-12 text-center', className)}>
        <Bell className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-sm text-muted-foreground">暂无通知</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onMarkAsUnread={onMarkAsUnread}
          onDelete={onDelete}
          onArchive={onArchive}
          selectMode={selectMode}
          isSelected={selectedIds?.has(notification.id)}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onMarkAsUnread?: (id: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onMarkAsUnread,
  onDelete,
  onArchive,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
}: NotificationItemProps) {
  const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
  const iconColor = NOTIFICATION_COLORS[notification.type] || 'text-gray-500';
  const isUnread = notification.status === 'unread';

  // 格式化时间
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: zhCN,
  });

  // 构建链接
  const LinkWrapper = notification.link
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={notification.link!} className="flex-1">
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => <div className="flex-1">{children}</div>;

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-lg p-3 transition-colors',
        'hover:bg-accent',
        isUnread && 'bg-accent/50',
        isSelected && 'bg-accent border-2 border-primary'
      )}
    >
      {/* 未读标记 */}
      {!selectMode && isUnread && (
        <div className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
      )}

      {/* 选择框 */}
      {selectMode && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect?.(notification.id)}
          className="mt-1"
          aria-label={`选择通知: ${notification.title}`}
        />
      )}

      {/* 图标 */}
      <div className={cn('mt-0.5 flex-shrink-0', iconColor)}>
        <Icon className="h-5 w-5" />
      </div>

      <LinkWrapper>
        <div className="flex-1 space-y-1">
          {/* 标题 */}
          <p
            className={cn(
              'text-sm leading-tight',
              isUnread ? 'font-semibold' : 'font-normal'
            )}
          >
            {notification.title}
          </p>

          {/* 内容 */}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {notification.content}
          </p>

          {/* 时间和优先级 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <time dateTime={notification.createdAt}>{timeAgo}</time>
            {notification.priority === 'high' && (
              <>
                <span>•</span>
                <span className="text-destructive">高优先级</span>
              </>
            )}
          </div>
        </div>
      </LinkWrapper>

      {/* 操作菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">更多操作</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isUnread ? (
            <DropdownMenuItem
              onClick={() => onMarkAsRead?.(notification.id)}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              标记为已读
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => onMarkAsUnread?.(notification.id)}
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              标记为未读
            </DropdownMenuItem>
          )}
          {onArchive && (
            <DropdownMenuItem
              onClick={() => onArchive(notification.id)}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              归档
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem
              onClick={() => onDelete(notification.id)}
              className="text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              删除
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function NotificationItemSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-lg p-3">
      <Skeleton className="h-5 w-5 flex-shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-8 w-8 flex-shrink-0 rounded-md" />
    </div>
  );
}

