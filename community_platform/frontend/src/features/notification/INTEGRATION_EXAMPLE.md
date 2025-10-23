# 通知系统集成示例

本文档提供了通知系统在实际应用中的集成示例。

## 1. 在根布局中初始化

```tsx
// src/app/(main)/layout.tsx
'use client';

import { useInitNotificationWebSocket } from '@/features/notification';
import { useAuthStore } from '@/features/auth';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 获取认证 token
  const token = useAuthStore((state) => state.token);

  // 初始化 WebSocket 连接
  useInitNotificationWebSocket(token);

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
```

## 2. 在导航栏中添加通知中心

```tsx
// src/components/layout/Navbar.tsx
'use client';

import Link from 'next/link';
import { NotificationCenter } from '@/features/notification';
import { useAuthStore } from '@/features/auth';

export function Navbar() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <nav className="border-b">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-bold text-xl">
          My App
        </Link>

        {/* 导航链接 */}
        <div className="flex items-center gap-4">
          <Link href="/explore">探索</Link>
          <Link href="/create">创建</Link>
          
          {/* 通知中心 - 仅在已登录时显示 */}
          {isAuthenticated && <NotificationCenter />}
          
          {/* 用户菜单 */}
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <Link href="/login">登录</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
```

## 3. 创建自定义通知页面

```tsx
// src/app/(main)/notifications/page.tsx
'use client';

import { useState } from 'react';
import {
  useNotifications,
  useMarkAsRead,
  useDeleteNotification,
  NotificationList,
} from '@/features/notification';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  // 查询通知
  const { data, isLoading } = useNotifications({
    status: activeTab === 'unread' ? 'unread' : undefined,
  });

  // Mutations
  const markAsRead = useMarkAsRead();
  const deleteNotification = useDeleteNotification();

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">通知</h1>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="unread">未读</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <NotificationList
            notifications={data?.items || []}
            loading={isLoading}
            onMarkAsRead={(id) => markAsRead.mutate(id)}
            onDelete={(id) => deleteNotification.mutate(id)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

## 4. 添加通知徽章到移动端菜单

```tsx
// src/components/layout/MobileMenu.tsx
'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { NotificationBadge, useUnreadCount } from '@/features/notification';

export function MobileMenu() {
  const { data: unreadCount = 0 } = useUnreadCount();

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background md:hidden">
      <nav className="flex items-center justify-around p-2">
        <Link href="/" className="flex flex-col items-center gap-1 p-2">
          <Home className="h-5 w-5" />
          <span className="text-xs">首页</span>
        </Link>

        <Link href="/explore" className="flex flex-col items-center gap-1 p-2">
          <Compass className="h-5 w-5" />
          <span className="text-xs">探索</span>
        </Link>

        {/* 通知 */}
        <Link href="/notifications" className="relative flex flex-col items-center gap-1 p-2">
          <Bell className="h-5 w-5" />
          <span className="text-xs">通知</span>
          {unreadCount > 0 && (
            <NotificationBadge
              count={unreadCount}
              className="absolute -right-1 -top-1"
            />
          )}
        </Link>

        <Link href="/profile" className="flex flex-col items-center gap-1 p-2">
          <User className="h-5 w-5" />
          <span className="text-xs">我的</span>
        </Link>
      </nav>
    </div>
  );
}
```

## 5. 在帖子组件中显示未读评论

```tsx
// src/features/post/components/PostCard.tsx
'use client';

import { NotificationDot } from '@/features/notification';

interface PostCardProps {
  post: Post;
  hasUnreadComments?: boolean;
}

export function PostCard({ post, hasUnreadComments }: PostCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <h3 className="font-semibold">{post.title}</h3>
        
        {/* 未读评论红点 */}
        {hasUnreadComments && (
          <NotificationDot show className="relative top-1" />
        )}
      </div>
      
      <p className="mt-2 text-muted-foreground">{post.content}</p>
      
      {/* 其他内容 */}
    </div>
  );
}
```

## 6. 创建自定义通知触发器

```tsx
// src/features/post/hooks/useCommentPost.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postApiClient } from '../api/postApiClient';
import { useNotificationStore } from '@/features/notification';

export function useCommentPost() {
  const queryClient = useQueryClient();
  const incrementUnreadCount = useNotificationStore(
    (state) => state.incrementUnreadCount
  );

  return useMutation({
    mutationFn: (data: { postId: string; content: string }) =>
      postApiClient.createComment(data.postId, data.content),
    
    onSuccess: (data) => {
      // 刷新帖子数据
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      
      // 如果是回复其他人的帖子，模拟收到通知
      // 实际应用中，这应该由后端 WebSocket 推送
      if (data.isReply) {
        incrementUnreadCount();
      }
    },
  });
}
```

## 7. 实现通知偏好设置页面

```tsx
// src/app/(main)/settings/notifications/page.tsx
'use client';

import { NotificationPreferences } from '@/features/notification';

export default function NotificationSettingsPage() {
  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">通知设置</h1>
        <p className="text-muted-foreground mt-2">
          管理您的通知偏好和设置
        </p>
      </div>

      <NotificationPreferences />
    </div>
  );
}
```

## 8. 添加全局通知监听器

```tsx
// src/components/providers/NotificationProvider.tsx
'use client';

import { useEffect } from 'react';
import { useNotificationWebSocket } from '@/features/notification';
import { useToast } from '@/shared/hooks/use-toast';

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const token = useAuthStore((state) => state.token);

  // 使用 WebSocket
  useNotificationWebSocket(token);

  // 可以在这里添加额外的通知处理逻辑
  useEffect(() => {
    const handleNotification = (notification: Notification) => {
      // 显示 toast 通知
      if (notification.priority === 'high') {
        toast({
          title: notification.title,
          description: notification.content,
          variant: 'default',
        });
      }
    };

    // 订阅通知事件
    // 注意：这只是示例，实际实现需要配合 WebSocket 服务
    
    return () => {
      // 清理订阅
    };
  }, [toast]);

  return <>{children}</>;
}
```

## 9. 在用户资料页显示通知统计

```tsx
// src/features/user/components/UserStats.tsx
'use client';

import { useNotificationStats } from '@/features/notification';

export function UserStats({ userId }: { userId: string }) {
  const { data: stats } = useNotificationStats();

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="text-center">
        <p className="text-2xl font-bold">{stats?.totalReceived || 0}</p>
        <p className="text-sm text-muted-foreground">收到的通知</p>
      </div>

      <div className="text-center">
        <p className="text-2xl font-bold">{stats?.unreadCount || 0}</p>
        <p className="text-sm text-muted-foreground">未读通知</p>
      </div>

      <div className="text-center">
        <p className="text-2xl font-bold">{stats?.todayCount || 0}</p>
        <p className="text-sm text-muted-foreground">今日通知</p>
      </div>
    </div>
  );
}
```

## 10. 创建通知过滤和搜索

```tsx
// src/app/(main)/notifications/advanced-page.tsx
'use client';

import { useState } from 'react';
import {
  useNotifications,
  NotificationList,
  type NotificationType,
} from '@/features/notification';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

export default function AdvancedNotificationsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<NotificationType | 'all'>('all');
  const [priority, setPriority] = useState<'all' | 'high' | 'normal'>('all');

  const { data, isLoading } = useNotifications({
    type: type !== 'all' ? type : undefined,
    priority: priority !== 'all' ? priority : undefined,
    // 注意：search 需要后端支持
  });

  // 客户端搜索过滤（临时方案）
  const filteredNotifications = data?.items.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">通知管理</h1>

      {/* 过滤器 */}
      <div className="mb-6 flex flex-wrap gap-4">
        <Input
          placeholder="搜索通知..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />

        <Select value={type} onValueChange={(v) => setType(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="通知类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="like">点赞</SelectItem>
            <SelectItem value="comment">评论</SelectItem>
            <SelectItem value="follow">关注</SelectItem>
            {/* 其他类型 */}
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="优先级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部优先级</SelectItem>
            <SelectItem value="high">高</SelectItem>
            <SelectItem value="normal">普通</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 通知列表 */}
      <NotificationList
        notifications={filteredNotifications}
        loading={isLoading}
      />
    </div>
  );
}
```

## 环境配置

```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

## TypeScript 类型安全

所有通知相关的类型都已导出，可以在整个应用中安全使用：

```tsx
import type {
  Notification,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  NotificationPreferences,
} from '@/features/notification';

// 类型安全的通知处理
function handleNotification(notification: Notification) {
  if (notification.type === 'like') {
    // TypeScript 知道这是点赞通知
  }
}
```

## 性能优化建议

1. **使用虚拟滚动**：如果通知列表很长，考虑使用 `react-virtual`
2. **分页加载**：使用无限滚动或分页来减少初始加载
3. **缓存策略**：合理设置 TanStack Query 的 `staleTime` 和 `cacheTime`
4. **选择器优化**：使用 Zustand 选择器避免不必要的重渲染
5. **WebSocket 节流**：在 WebSocket 消息处理中添加节流机制

## 测试

```tsx
// src/features/notification/__tests__/NotificationBadge.test.tsx
import { render, screen } from '@testing-library/react';
import { NotificationBadge } from '../components/NotificationBadge';

describe('NotificationBadge', () => {
  it('显示正确的数量', () => {
    render(<NotificationBadge count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('超过最大值时显示 99+', () => {
    render(<NotificationBadge count={150} max={99} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('数量为 0 时不渲染', () => {
    const { container } = render(<NotificationBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });
});
```

