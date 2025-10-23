import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApiClient } from '../api/notificationApiClient';
import { useNotificationStore } from '../store/notificationStore';
import type {
  NotificationQueryParams,
  Notification,
  NotificationStats,
  NotificationPreferences,
} from '../domain/notification';

// Query Keys
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params?: NotificationQueryParams) =>
    [...notificationKeys.lists(), params] as const,
  details: () => [...notificationKeys.all, 'detail'] as const,
  detail: (id: string) => [...notificationKeys.details(), id] as const,
  unreadCount: () => [...notificationKeys.all, 'unreadCount'] as const,
  stats: () => [...notificationKeys.all, 'stats'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

/**
 * 获取通知列表
 */
export function useNotifications(params?: NotificationQueryParams) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationApiClient.getNotifications(params),
    staleTime: 30000, // 30秒
  });
}

/**
 * 获取单个通知详情
 */
export function useNotification(id: string, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.detail(id),
    queryFn: () => notificationApiClient.getNotification(id),
    enabled: enabled && !!id,
  });
}

/**
 * 获取未读通知数量
 */
export function useUnreadCount() {
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);

  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const count = await notificationApiClient.getUnreadCount();
      // 同步更新到 store
      setUnreadCount(count);
      return count;
    },
    staleTime: 10000, // 10秒
    refetchInterval: 60000, // 每分钟自动刷新
  });
}

/**
 * 获取通知统计
 */
export function useNotificationStats() {
  return useQuery({
    queryKey: notificationKeys.stats(),
    queryFn: () => notificationApiClient.getStats(),
    staleTime: 60000, // 1分钟
  });
}

/**
 * 获取通知偏好设置
 */
export function useNotificationPreferences() {
  const setPreferences = useNotificationStore((state) => state.setPreferences);

  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: async () => {
      const preferences = await notificationApiClient.getPreferences();
      // 同步更新到 store
      setPreferences(preferences);
      return preferences;
    },
  });
}

/**
 * 标记通知为已读
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient();
  const { updateNotification, decrementUnreadCount } = useNotificationStore();

  return useMutation({
    mutationFn: (id: string) => notificationApiClient.markAsRead(id),
    onMutate: async (id) => {
      // 乐观更新
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });

      // 更新 store
      updateNotification(id, { status: 'read' });
      decrementUnreadCount();
    },
    onSuccess: (_, id) => {
      // 使查询失效
      queryClient.invalidateQueries({ queryKey: notificationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * 标记通知为未读
 */
export function useMarkAsUnread() {
  const queryClient = useQueryClient();
  const { updateNotification, incrementUnreadCount } = useNotificationStore();

  return useMutation({
    mutationFn: (id: string) => notificationApiClient.markAsUnread(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });

      // 更新 store
      updateNotification(id, { status: 'unread' });
      incrementUnreadCount();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
  });
}

/**
 * 标记所有通知为已读
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  const { markAllAsRead, setUnreadCount } = useNotificationStore();

  return useMutation({
    mutationFn: () => notificationApiClient.markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });

      // 更新 store
      markAllAsRead();
      setUnreadCount(0);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * 归档通知
 */
export function useArchiveNotification() {
  const queryClient = useQueryClient();
  const { removeNotification } = useNotificationStore();

  return useMutation({
    mutationFn: (id: string) => notificationApiClient.archiveNotification(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
      removeNotification(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
}

/**
 * 删除通知
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const { removeNotification } = useNotificationStore();

  return useMutation({
    mutationFn: (id: string) => notificationApiClient.deleteNotification(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
      removeNotification(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
}

/**
 * 批量删除通知
 */
export function useDeleteMultipleNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => notificationApiClient.deleteMultiple(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * 更新通知偏好设置
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const setPreferences = useNotificationStore((state) => state.setPreferences);

  return useMutation({
    mutationFn: (preferences: Partial<NotificationPreferences>) =>
      notificationApiClient.updatePreferences(preferences),
    onSuccess: (data) => {
      setPreferences(data);
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
  });
}

/**
 * 清空已读通知
 */
export function useClearReadNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationApiClient.clearRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

