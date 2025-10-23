'use client';

import React, { useState } from 'react';
import { Bell, Settings, Trash2, CheckCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { cn } from '@/shared/utils';
import { NotificationBadge } from './NotificationBadge';
import { NotificationList } from './NotificationList';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAsUnread,
  useMarkAllAsRead,
  useDeleteNotification,
  useArchiveNotification,
} from '../hooks/useNotifications';
import Link from 'next/link';

interface NotificationDropdownProps {
  className?: string;
  maxItems?: number;
}

/**
 * 通知下拉菜单组件
 * 独立的下拉菜单组件，可在导航栏等位置使用
 */
export function NotificationDropdown({
  className,
  maxItems = 10,
}: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  // 获取未读数量
  const { data: unreadCount = 0 } = useUnreadCount();

  // 获取通知列表
  const { data: allNotifications, isLoading } = useNotifications({
    page: 1,
    pageSize: maxItems,
  });

  const { data: unreadNotifications } = useNotifications({
    page: 1,
    pageSize: maxItems,
    status: 'unread',
  });

  // Mutations
  const markAsReadMutation = useMarkAsRead();
  const markAsUnreadMutation = useMarkAsUnread();
  const markAllAsReadMutation = useMarkAllAsRead();
  const deleteNotificationMutation = useDeleteNotification();
  const archiveNotificationMutation = useArchiveNotification();

  const handleMarkAsRead = (id: string) => {
    markAsReadMutation.mutate(id);
  };

  const handleMarkAsUnread = (id: string) => {
    markAsUnreadMutation.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (id: string) => {
    deleteNotificationMutation.mutate(id);
  };

  const handleArchive = (id: string) => {
    archiveNotificationMutation.mutate(id);
  };

  const notifications =
    activeTab === 'all'
      ? allNotifications?.items || []
      : unreadNotifications?.items || [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative', className)}
          aria-label={`通知 ${unreadCount > 0 ? `(${unreadCount} 条未读)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <NotificationBadge
              count={unreadCount}
              className="absolute -right-1 -top-1"
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[400px] p-0"
        sideOffset={8}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4">
          <div>
            <h3 className="text-lg font-semibold">通知</h3>
            {unreadCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {unreadCount} 条未读通知
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || markAllAsReadMutation.isPending}
              title="全部已读"
            >
              <CheckCheck className="h-4 w-4" />
              <span className="sr-only">全部已读</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              asChild
            >
              <Link href="/settings/notifications">
                <Settings className="h-4 w-4" />
                <span className="sr-only">通知设置</span>
              </Link>
            </Button>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b bg-transparent">
            <TabsTrigger value="all" className="rounded-none data-[state=active]:bg-accent">
              全部
            </TabsTrigger>
            <TabsTrigger value="unread" className="rounded-none data-[state=active]:bg-accent">
              未读 {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[min(400px,60vh)]">
            <TabsContent value="all" className="m-0 p-2">
              <NotificationList
                notifications={notifications}
                loading={isLoading}
                onMarkAsRead={handleMarkAsRead}
                onMarkAsUnread={handleMarkAsUnread}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            </TabsContent>

            <TabsContent value="unread" className="m-0 p-2">
              <NotificationList
                notifications={notifications}
                loading={isLoading}
                onMarkAsRead={handleMarkAsRead}
                onMarkAsUnread={handleMarkAsUnread}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DropdownMenuSeparator />

        {/* 底部 */}
        <div className="p-2">
          <Button
            variant="ghost"
            className="w-full justify-center"
            asChild
          >
            <Link href="/notifications">查看全部通知</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

