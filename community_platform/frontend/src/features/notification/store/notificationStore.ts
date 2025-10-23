import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Notification, NotificationPreferences } from '../domain/notification';

interface NotificationState {
  // 未读数量
  unreadCount: number;
  
  // 最近的通知（用于通知中心下拉）
  recentNotifications: Notification[];
  
  // 通知偏好设置
  preferences: NotificationPreferences | null;
  
  // WebSocket 连接状态
  wsConnected: boolean;
  
  // Actions
  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;
  
  setRecentNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
  removeNotification: (id: string) => void;
  clearRecentNotifications: () => void;
  
  setPreferences: (preferences: NotificationPreferences) => void;
  
  setWsConnected: (connected: boolean) => void;
  
  // 批量操作
  markAllAsRead: () => void;
  
  // 重置状态
  reset: () => void;
}

const initialState = {
  unreadCount: 0,
  recentNotifications: [],
  preferences: null,
  wsConnected: false,
};

export const useNotificationStore = create<NotificationState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // 设置未读数量
        setUnreadCount: (count) =>
          set({ unreadCount: Math.max(0, count) }, false, 'setUnreadCount'),

        // 未读数量加1
        incrementUnreadCount: () =>
          set(
            (state) => ({ unreadCount: state.unreadCount + 1 }),
            false,
            'incrementUnreadCount'
          ),

        // 未读数量减1
        decrementUnreadCount: () =>
          set(
            (state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) }),
            false,
            'decrementUnreadCount'
          ),

        // 设置最近通知
        setRecentNotifications: (notifications) =>
          set({ recentNotifications: notifications }, false, 'setRecentNotifications'),

        // 添加新通知（插入到列表开头）
        addNotification: (notification) =>
          set(
            (state) => {
              // 避免重复
              const exists = state.recentNotifications.some(
                (n) => n.id === notification.id
              );
              if (exists) return state;

              // 限制最多保存 50 条最近通知
              const newNotifications = [
                notification,
                ...state.recentNotifications,
              ].slice(0, 50);

              return {
                recentNotifications: newNotifications,
                // 如果是未读通知，增加未读计数
                unreadCount:
                  notification.status === 'unread'
                    ? state.unreadCount + 1
                    : state.unreadCount,
              };
            },
            false,
            'addNotification'
          ),

        // 更新通知
        updateNotification: (id, updates) =>
          set(
            (state) => {
              const index = state.recentNotifications.findIndex((n) => n.id === id);
              if (index === -1) return state;

              const oldNotification = state.recentNotifications[index];
              const newNotification = { ...oldNotification, ...updates };
              
              const newNotifications = [...state.recentNotifications];
              newNotifications[index] = newNotification;

              // 如果状态从未读变为已读，减少未读计数
              let newUnreadCount = state.unreadCount;
              if (
                oldNotification.status === 'unread' &&
                newNotification.status === 'read'
              ) {
                newUnreadCount = Math.max(0, state.unreadCount - 1);
              } else if (
                oldNotification.status === 'read' &&
                newNotification.status === 'unread'
              ) {
                newUnreadCount = state.unreadCount + 1;
              }

              return {
                recentNotifications: newNotifications,
                unreadCount: newUnreadCount,
              };
            },
            false,
            'updateNotification'
          ),

        // 删除通知
        removeNotification: (id) =>
          set(
            (state) => {
              const notification = state.recentNotifications.find((n) => n.id === id);
              if (!notification) return state;

              return {
                recentNotifications: state.recentNotifications.filter(
                  (n) => n.id !== id
                ),
                // 如果删除的是未读通知，减少未读计数
                unreadCount:
                  notification.status === 'unread'
                    ? Math.max(0, state.unreadCount - 1)
                    : state.unreadCount,
              };
            },
            false,
            'removeNotification'
          ),

        // 清空最近通知
        clearRecentNotifications: () =>
          set({ recentNotifications: [] }, false, 'clearRecentNotifications'),

        // 设置偏好设置
        setPreferences: (preferences) =>
          set({ preferences }, false, 'setPreferences'),

        // 设置 WebSocket 连接状态
        setWsConnected: (connected) =>
          set({ wsConnected: connected }, false, 'setWsConnected'),

        // 标记所有为已读
        markAllAsRead: () =>
          set(
            (state) => ({
              recentNotifications: state.recentNotifications.map((n) =>
                n.status === 'unread' ? { ...n, status: 'read' as const } : n
              ),
              unreadCount: 0,
            }),
            false,
            'markAllAsRead'
          ),

        // 重置状态
        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'notification-storage',
        // 只持久化部分状态
        partialize: (state) => ({
          unreadCount: state.unreadCount,
          preferences: state.preferences,
        }),
      }
    ),
    { name: 'NotificationStore' }
  )
);

// 选择器
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
export const selectRecentNotifications = (state: NotificationState) =>
  state.recentNotifications;
export const selectWsConnected = (state: NotificationState) => state.wsConnected;
export const selectPreferences = (state: NotificationState) => state.preferences;

