# 通知系统 (Notification System)

实时通知系统，支持多种通知类型、WebSocket 实时推送和完整的通知管理功能。

## 功能特性

- ✅ 多种通知类型（点赞、评论、关注、提及等）
- ✅ WebSocket 实时推送
- ✅ 未读数量徽章
- ✅ 通知中心下拉菜单
- ✅ 完整的通知列表页面
- ✅ 通知偏好设置
- ✅ 标记已读/未读
- ✅ 归档和删除通知
- ✅ 浏览器通知支持
- ✅ 响应式设计

## 目录结构

```
notification/
├── api/                    # API 客户端
│   └── notificationApiClient.ts
├── components/             # UI 组件
│   ├── NotificationBadge.tsx       # 通知徽章
│   ├── NotificationList.tsx        # 通知列表
│   ├── NotificationCenter.tsx      # 通知中心下拉
│   ├── NotificationPreferences.tsx # 偏好设置
│   └── index.ts
├── domain/                 # 领域模型
│   └── notification.ts
├── hooks/                  # React Hooks
│   ├── useNotifications.ts
│   ├── useNotificationWebSocket.ts
│   └── index.ts
├── services/               # 服务层
│   └── notificationWebSocket.ts
├── store/                  # 状态管理
│   └── notificationStore.ts
├── index.ts               # 主导出文件
└── README.md              # 文档
```

## 快速开始

### 1. 在导航栏添加通知中心

```tsx
import { NotificationCenter } from '@/features/notification';

export function Navbar() {
  return (
    <nav>
      {/* 其他导航项 */}
      <NotificationCenter />
    </nav>
  );
}
```

### 2. 初始化 WebSocket 连接

在应用的根布局或顶层组件中初始化 WebSocket：

```tsx
'use client';

import { useInitNotificationWebSocket } from '@/features/notification';
import { useAuth } from '@/features/auth';

export function RootLayout({ children }) {
  const { token } = useAuth();
  
  // 初始化 WebSocket 连接
  useInitNotificationWebSocket(token);
  
  return <>{children}</>;
}
```

### 3. 使用通知 Hooks

```tsx
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
} from '@/features/notification';

function NotificationsPage() {
  const { data: notifications, isLoading } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const markAsRead = useMarkAsRead();
  
  return (
    <div>
      <h1>通知 ({unreadCount})</h1>
      {/* 渲染通知列表 */}
    </div>
  );
}
```

## 组件

### NotificationBadge

显示未读通知数量的徽章。

```tsx
import { NotificationBadge } from '@/features/notification';

<NotificationBadge count={5} max={99} />
```

**Props:**
- `count`: 未读数量
- `max`: 最大显示数量（默认 99）
- `showZero`: 是否显示零（默认 false）
- `variant`: 徽章变体（默认 'destructive'）

### NotificationDot

简单的红点提示。

```tsx
import { NotificationDot } from '@/features/notification';

<NotificationDot show={hasUnread} size="md" />
```

### NotificationList

通知列表组件。

```tsx
import { NotificationList } from '@/features/notification';

<NotificationList
  notifications={notifications}
  loading={isLoading}
  onMarkAsRead={handleMarkAsRead}
  onDelete={handleDelete}
/>
```

**Props:**
- `notifications`: 通知数组
- `loading`: 加载状态
- `onMarkAsRead`: 标记已读回调
- `onMarkAsUnread`: 标记未读回调
- `onDelete`: 删除回调
- `onArchive`: 归档回调

### NotificationCenter

通知中心下拉菜单，通常放在导航栏。

```tsx
import { NotificationCenter } from '@/features/notification';

<NotificationCenter />
```

### NotificationPreferences

通知偏好设置表单。

```tsx
import { NotificationPreferences } from '@/features/notification';

<NotificationPreferences />
```

## Hooks

### useNotifications

获取通知列表。

```tsx
const { data, isLoading, error } = useNotifications({
  page: 1,
  pageSize: 20,
  status: 'unread',
  type: 'like',
});
```

### useUnreadCount

获取未读通知数量。

```tsx
const { data: unreadCount } = useUnreadCount();
```

### useMarkAsRead

标记通知为已读。

```tsx
const markAsRead = useMarkAsRead();

markAsRead.mutate(notificationId);
```

### useMarkAllAsRead

标记所有通知为已读。

```tsx
const markAllAsRead = useMarkAllAsRead();

markAllAsRead.mutate();
```

### useNotificationWebSocket

使用 WebSocket 实时通知。

```tsx
const { isConnected, send } = useNotificationWebSocket(token);
```

## Store

通知系统使用 Zustand 管理状态：

```tsx
import { useNotificationStore } from '@/features/notification';

function MyComponent() {
  const unreadCount = useNotificationStore(state => state.unreadCount);
  const recentNotifications = useNotificationStore(state => state.recentNotifications);
  const incrementUnreadCount = useNotificationStore(state => state.incrementUnreadCount);
  
  // ...
}
```

**Store 状态：**
- `unreadCount`: 未读数量
- `recentNotifications`: 最近的通知
- `preferences`: 通知偏好设置
- `wsConnected`: WebSocket 连接状态

**Store Actions:**
- `setUnreadCount(count)`: 设置未读数量
- `incrementUnreadCount()`: 未读数量加 1
- `decrementUnreadCount()`: 未读数量减 1
- `addNotification(notification)`: 添加新通知
- `updateNotification(id, updates)`: 更新通知
- `removeNotification(id)`: 删除通知
- `markAllAsRead()`: 标记所有为已读
- `setPreferences(preferences)`: 设置偏好
- `reset()`: 重置状态

## WebSocket

WebSocket 服务自动处理连接、重连和消息分发。

**WebSocket 消息类型：**

```typescript
interface WebSocketNotificationMessage {
  action: 'new' | 'update' | 'delete' | 'mark_read' | 'mark_all_read';
  notification?: Notification;
  notificationId?: string;
  count?: number;
}
```

**事件处理：**
- `new`: 新通知到达
- `update`: 通知更新
- `delete`: 通知删除
- `mark_read`: 标记已读
- `mark_all_read`: 全部标记已读

## 通知类型

支持以下通知类型：

- `like`: 点赞
- `comment`: 评论
- `follow`: 关注
- `mention`: 提及
- `reply`: 回复
- `share`: 分享
- `system`: 系统通知
- `achievement`: 成就
- `trending`: 热门推荐

## API 端点

后端 API 路由（需要配合实现）：

```
GET    /api/v1/notifications          # 获取通知列表
GET    /api/v1/notifications/:id      # 获取单个通知
POST   /api/v1/notifications/:id/read # 标记已读
POST   /api/v1/notifications/:id/unread # 标记未读
POST   /api/v1/notifications/read-all # 全部已读
DELETE /api/v1/notifications/:id      # 删除通知
GET    /api/v1/notifications/unread-count # 未读数量
GET    /api/v1/notifications/stats    # 统计信息
GET    /api/v1/notifications/preferences # 获取偏好设置
PUT    /api/v1/notifications/preferences # 更新偏好设置
WS     /ws/notifications              # WebSocket 连接
```

## 页面路由

- `/notifications` - 通知列表页
- `/settings/notifications` - 通知设置页

## 浏览器通知

系统会自动请求浏览器通知权限，并在收到新通知时显示桌面通知（如果用户授权）。

## 最佳实践

### 1. 性能优化

```tsx
// 使用选择器避免不必要的重新渲染
const unreadCount = useNotificationStore(selectUnreadCount);

// 而不是
const { unreadCount } = useNotificationStore();
```

### 2. 错误处理

```tsx
const markAsRead = useMarkAsRead();

const handleMarkAsRead = async (id: string) => {
  try {
    await markAsRead.mutateAsync(id);
  } catch (error) {
    toast.error('操作失败');
  }
};
```

### 3. 乐观更新

所有 mutation hooks 都已实现乐观更新，无需额外配置。

### 4. 内存管理

Store 会自动限制最近通知为 50 条，避免内存泄漏。

## 自定义样式

所有组件都支持 `className` prop，可以传入自定义样式：

```tsx
<NotificationBadge 
  count={5} 
  className="bg-blue-500 text-white"
/>
```

## 国际化

通知系统使用 `date-fns` 的 `zhCN` locale 格式化时间。如需支持其他语言，需要修改组件中的 locale 配置。

## 故障排查

### WebSocket 无法连接

1. 检查 token 是否有效
2. 检查 WebSocket URL 配置
3. 查看浏览器控制台的错误信息

### 通知不更新

1. 检查 TanStack Query 缓存配置
2. 确认 WebSocket 连接正常
3. 检查 Store 状态是否正确更新

### 样式问题

确保项目中已正确配置 Tailwind CSS 和 shadcn/ui 组件。

## 相关资源

- [TanStack Query 文档](https://tanstack.com/query/latest)
- [Zustand 文档](https://zustand-demo.pmnd.rs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

