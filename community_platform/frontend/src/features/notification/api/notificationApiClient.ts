import { apiClient } from '@/infrastructure/api/client';
import type {
  Notification,
  CreateNotificationDto,
  UpdateNotificationDto,
  NotificationQueryParams,
  NotificationStats,
  NotificationPreferences,
} from '../domain/notification';

/**
 * 分页响应接口
 */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 通知 API 客户端
 */
export class NotificationApiClient {
  private readonly basePath = '/api/notifications';

  /**
   * 获取通知列表（分页）
   */
  async getNotifications(
    params?: NotificationQueryParams
  ): Promise<PaginatedResponse<Notification>> {
    const { data } = await apiClient.get<PaginatedResponse<Notification>>(
      this.basePath,
      { params }
    );
    return data;
  }

  /**
   * 获取单个通知详情
   */
  async getNotification(id: string): Promise<Notification> {
    const { data } = await apiClient.get<Notification>(`${this.basePath}/${id}`);
    return data;
  }

  /**
   * 创建通知（通常由后端创建，前端较少使用）
   */
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const { data } = await apiClient.post<Notification>(this.basePath, dto);
    return data;
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(id: string): Promise<Notification> {
    const { data } = await apiClient.patch<Notification>(
      `${this.basePath}/${id}/read`
    );
    return data;
  }

  /**
   * 标记通知为未读
   */
  async markAsUnread(id: string): Promise<Notification> {
    const { data } = await apiClient.patch<Notification>(
      `${this.basePath}/${id}/unread`
    );
    return data;
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(): Promise<{ count: number }> {
    const { data } = await apiClient.post<{ count: number }>(
      `${this.basePath}/mark-all-read`
    );
    return data;
  }

  /**
   * 归档通知
   */
  async archiveNotification(id: string): Promise<Notification> {
    const { data } = await apiClient.patch<Notification>(
      `${this.basePath}/${id}/archive`
    );
    return data;
  }

  /**
   * 批量归档通知
   */
  async archiveMultiple(ids: string[]): Promise<{ count: number }> {
    const { data } = await apiClient.post<{ count: number }>(
      `${this.basePath}/archive-multiple`,
      { ids }
    );
    return data;
  }

  /**
   * 删除通知
   */
  async deleteNotification(id: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${id}`);
  }

  /**
   * 批量删除通知
   */
  async deleteMultiple(ids: string[]): Promise<{ count: number }> {
    const { data } = await apiClient.post<{ count: number }>(
      `${this.basePath}/delete-multiple`,
      { ids }
    );
    return data;
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(): Promise<number> {
    const { data } = await apiClient.get<{ count: number }>(
      `${this.basePath}/unread-count`
    );
    return data.count;
  }

  /**
   * 获取通知统计
   */
  async getStats(): Promise<NotificationStats> {
    const { data } = await apiClient.get<NotificationStats>(
      `${this.basePath}/stats`
    );
    return data;
  }

  /**
   * 获取通知偏好设置
   */
  async getPreferences(): Promise<NotificationPreferences> {
    const { data } = await apiClient.get<NotificationPreferences>(
      `${this.basePath}/preferences`
    );
    return data;
  }

  /**
   * 更新通知偏好设置
   */
  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const { data } = await apiClient.patch<NotificationPreferences>(
      `${this.basePath}/preferences`,
      preferences
    );
    return data;
  }

  /**
   * 清空所有已读通知
   */
  async clearRead(): Promise<{ count: number }> {
    const { data } = await apiClient.delete<{ count: number }>(
      `${this.basePath}/clear-read`
    );
    return data;
  }
}

// 导出单例
export const notificationApiClient = new NotificationApiClient();

