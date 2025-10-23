/**
 * NotificationDropdown - 通知下拉组件
 * 显示用户通知列表
 */

'use client';

import { FC, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  Package,
  CheckCheck,
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { cn } from '@/shared/utils/cn';

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'system' | 'adapter';
  title: string;
  content: string;
  link?: string;
  avatar?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationDropdownProps {
  className?: string;
}

// 模拟通知数据
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'like',
    title: '张三 赞了你的帖子',
    content: '你的帖子《如何使用Zishu平台》收到了新的点赞',
    link: '/posts/123',
    avatar: '',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    type: 'comment',
    title: '李四 评论了你的帖子',
    content: '这个教程太有用了，感谢分享！',
    link: '/posts/123#comment-456',
    avatar: '',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '3',
    type: 'follow',
    title: '王五 关注了你',
    content: '你有了新的关注者',
    link: '/users/789',
    avatar: '',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

const notificationIcons = {
  like: <Heart className="h-4 w-4 text-red-500" />,
  comment: <MessageCircle className="h-4 w-4 text-blue-500" />,
  follow: <UserPlus className="h-4 w-4 text-green-500" />,
  adapter: <Package className="h-4 w-4 text-purple-500" />,
  system: <Bell className="h-4 w-4 text-gray-500" />,
};

export const NotificationDropdown: FC<NotificationDropdownProps> = ({ className }) => {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const formatDate = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return date;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn('relative h-9 w-9 p-0', className)}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>通知</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-auto p-0 text-xs text-primary hover:text-primary/80"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              全部已读
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">暂无通知</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px]">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    'flex gap-3 p-3 cursor-pointer',
                    !notification.isRead && 'bg-accent/50'
                  )}
                  onClick={() => {
                    handleMarkAsRead(notification.id);
                    if (notification.link) {
                      window.location.href = notification.link;
                    }
                  }}
                >
                  {/* 图标或头像 */}
                  <div className="shrink-0 mt-1">
                    {notification.avatar ? (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={notification.avatar} />
                        <AvatarFallback>{notification.title[0]}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        {notificationIcons[notification.type]}
                      </div>
                    )}
                  </div>

                  {/* 通知内容 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1 mb-1">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                      {notification.content}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>

                  {/* 未读指示器 */}
                  {!notification.isRead && (
                    <div className="shrink-0">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                  )}
                </DropdownMenuItem>
              ))}
            </ScrollArea>

            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/notifications"
                className="w-full text-center cursor-pointer text-sm text-primary hover:text-primary/80"
              >
                查看全部通知
              </Link>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile/settings/notifications" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>通知设置</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

