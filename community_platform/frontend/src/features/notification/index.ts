// Domain types (excluding components)
export type {
  Notification,
  NotificationStatus,
  NotificationType,
  NotificationPriority,
  NotificationPreferences,
  NotificationStats,
  NotificationQueryParams,
  WebSocketNotificationMessage,
} from './domain/notification';

// API
export { notificationApiClient } from './api/notificationApiClient';

// Services
export { notificationWebSocket } from './services/notificationWebSocket';

// Store
export { useNotificationStore } from './store/notificationStore';

// Hooks
export * from './hooks';

// Components
export * from './components';

