'use client';

import React, { useState } from 'react';
import { Bell, Check, Settings } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';
import { cn } from '@/shared/utils';
import { NotificationBadge } from './NotificationBadge';
import { NotificationList } from './NotificationList';
import { NotificationStatus } from '../domain/notification';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useDeleteNotification,
  useArchiveNotification,
} from '../hooks/useNotifications';
import Link from 'next/link';

interface NotificationCenterProps {
  className?: string;
}

/**
 * 通知中心下拉组件
 * 显示在导航栏，点击显示最近通知
 */
export function NotificationCenter({ className }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  // 获取未读数量
  const { data: unreadCount = 0 } = useUnreadCount();

  // 获取通知列表
  const { data: allNotifications, isLoading } = useNotifications({
    page: 1,
    pageSize: 20,
  });

  const { data: unreadNotifications } = useNotifications({
    page: 1,
    pageSize: 20,
    status: NotificationStatus.UNREAD,
  });

  // Mutations
  const markAsReadMutation = useMarkAsRead();
  const markAllAsReadMutation = useMarkAllAsRead();
  const deleteNotificationMutation = useDeleteNotification();
  const archiveNotificationMutation = useArchiveNotification();

  const handleMarkAsRead = (id: string) => {
    markAsReadMutation.mutate(id);
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
          <h3 className="text-lg font-semibold">通知</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="h-8 text-xs"
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                全部已读
              </Button>
            )}
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

        <Separator />

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
            <TabsTrigger value="all" className="rounded-none">
              全部
            </TabsTrigger>
            <TabsTrigger value="unread" className="rounded-none">
              未读 {unreadCount > 0 && `(${unreadCount})`}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px]">
            <TabsContent value="all" className="m-0 p-2">
              <NotificationList
                notifications={notifications}
                loading={isLoading}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            </TabsContent>

            <TabsContent value="unread" className="m-0 p-2">
              <NotificationList
                notifications={notifications}
                loading={isLoading}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <Separator />

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

