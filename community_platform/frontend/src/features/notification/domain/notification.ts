/**
 * 通知类型枚举
 */
export enum NotificationType {
  LIKE = 'like',                    // 点赞
  COMMENT = 'comment',              // 评论
  REPLY = 'reply',                  // 回复
  FOLLOW = 'follow',                // 关注
  MENTION = 'mention',              // @提及
  SYSTEM = 'system',                // 系统通知
  ADAPTER_UPDATE = 'adapter_update', // 适配器更新
  POST_UPDATE = 'post_update',      // 帖子更新
  CHARACTER_SHARE = 'character_share', // 角色分享
  PACKAGE_COMPLETE = 'package_complete', // 打包完成
}

/**
 * 通知状态
 */
export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
}

/**
 * 通知优先级
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * 通知实体接口
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  status: NotificationStatus;
  priority: NotificationPriority;
  
  // 发送者信息
  sender?: {
    id: string;
    username: string;
    avatar?: string;
  };
  
  // 接收者ID
  receiverId: string;
  
  // 关联资源
  relatedResource?: {
    type: 'post' | 'comment' | 'adapter' | 'character' | 'package';
    id: string;
    title?: string;
    url?: string;
  };
  
  // 元数据
  metadata?: Record<string, any>;
  
  // 操作链接
  actionUrl?: string;
  actionText?: string;
  
  // 时间戳
  createdAt: string;
  readAt?: string;
  archivedAt?: string;
}

/**
 * 通知创建DTO
 */
export interface CreateNotificationDto {
  type: NotificationType;
  title: string;
  content: string;
  priority?: NotificationPriority;
  receiverId: string;
  relatedResource?: Notification['relatedResource'];
  metadata?: Record<string, any>;
  actionUrl?: string;
  actionText?: string;
}

/**
 * 通知更新DTO
 */
export interface UpdateNotificationDto {
  status?: NotificationStatus;
  readAt?: string;
  archivedAt?: string;
}

/**
 * 通知查询参数
 */
export interface NotificationQueryParams {
  page?: number;
  pageSize?: number;
  type?: NotificationType | NotificationType[];
  status?: NotificationStatus;
  priority?: NotificationPriority;
  startDate?: string;
  endDate?: string;
  unreadOnly?: boolean;
}

/**
 * 通知统计
 */
export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
}

/**
 * 通知偏好设置
 */
export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  enabledTypes: NotificationType[];
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
  groupSimilar: boolean; // 是否合并相似通知
}

/**
 * WebSocket 通知消息
 */
export interface WebSocketNotificationMessage {
  action: 'new' | 'update' | 'delete' | 'mark_read' | 'mark_all_read';
  notification?: Notification;
  notificationId?: string;
  count?: number; // 未读数
}

