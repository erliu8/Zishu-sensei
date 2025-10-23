/**
 * 用户 API 客户端
 * @module features/user/api
 */

import { apiClient } from '@/infrastructure/api/client';
import type {
  UserProfile,
  UserBasic,
  UserStats,
  UserActivity,
  PaginatedUsers,
  UpdateProfileRequest,
  UpdatePasswordRequest,
  UpdateEmailRequest,
  UpdatePreferencesRequest,
  SearchUsersParams,
  UserPreferences,
  UserSession,
  LoginHistory,
  PaginatedSessions,
  PaginatedLoginHistory,
} from '../types';
import type {
  GetUserProfileResponse,
  GetUsersResponse,
  UpdateUserProfileResponse,
  UploadAvatarResponse,
  GetUserStatsResponse,
  GetUserActivitiesResponse,
  GenericSuccessResponse,
} from './types';

/**
 * 用户 API 客户端类
 */
export class UserApiClient {
  private static baseUrl = '/users';

  /**
   * 获取当前用户资料
   */
  static async getCurrentUser(): Promise<UserProfile> {
    const response = await apiClient.get<GetUserProfileResponse>(
      `${this.baseUrl}/me`
    );
    return response.data.data;
  }

  /**
   * 获取指定用户资料
   */
  static async getUserById(userId: string): Promise<UserProfile> {
    const response = await apiClient.get<GetUserProfileResponse>(
      `${this.baseUrl}/${userId}`
    );
    return response.data.data;
  }

  /**
   * 获取用户列表
   */
  static async getUsers(params?: SearchUsersParams): Promise<PaginatedUsers> {
    const response = await apiClient.get<GetUsersResponse>(this.baseUrl, {
      params,
    });
    return response.data.data;
  }

  /**
   * 搜索用户
   */
  static async searchUsers(query: string, params?: Omit<SearchUsersParams, 'query'>): Promise<PaginatedUsers> {
    const response = await apiClient.get<GetUsersResponse>(
      `${this.baseUrl}/search`,
      {
        params: { query, ...params },
      }
    );
    return response.data.data;
  }

  /**
   * 更新个人资料
   */
  static async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    const response = await apiClient.put<UpdateUserProfileResponse>(
      `${this.baseUrl}/me/profile`,
      data
    );
    return response.data.data;
  }

  /**
   * 上传头像
   */
  static async uploadAvatar(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await apiClient.post<UploadAvatarResponse>(
      `${this.baseUrl}/me/avatar`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data.avatarUrl;
  }

  /**
   * 删除头像
   */
  static async deleteAvatar(): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/me/avatar`);
  }

  /**
   * 更新密码
   */
  static async updatePassword(data: UpdatePasswordRequest): Promise<void> {
    await apiClient.put<GenericSuccessResponse>(
      `${this.baseUrl}/me/password`,
      data
    );
  }

  /**
   * 更新邮箱
   */
  static async updateEmail(data: UpdateEmailRequest): Promise<void> {
    await apiClient.put<GenericSuccessResponse>(
      `${this.baseUrl}/me/email`,
      data
    );
  }

  /**
   * 获取用户偏好设置
   */
  static async getPreferences(): Promise<UserPreferences> {
    const response = await apiClient.get<{ success: boolean; data: UserPreferences }>(
      `${this.baseUrl}/me/preferences`
    );
    return response.data.data;
  }

  /**
   * 更新偏好设置
   */
  static async updatePreferences(data: UpdatePreferencesRequest): Promise<UserPreferences> {
    const response = await apiClient.put<{ success: boolean; data: UserPreferences }>(
      `${this.baseUrl}/me/preferences`,
      data
    );
    return response.data.data;
  }

  /**
   * 获取用户统计信息
   */
  static async getUserStats(userId?: string): Promise<UserStats> {
    const url = userId ? `${this.baseUrl}/${userId}/stats` : `${this.baseUrl}/me/stats`;
    const response = await apiClient.get<GetUserStatsResponse>(url);
    return response.data.data;
  }

  /**
   * 获取用户活动记录
   */
  static async getUserActivities(
    userId?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ activities: UserActivity[]; total: number; hasMore: boolean }> {
    const url = userId 
      ? `${this.baseUrl}/${userId}/activities`
      : `${this.baseUrl}/me/activities`;
    
    const response = await apiClient.get<GetUserActivitiesResponse>(url, {
      params: { page, pageSize },
    });
    return response.data.data;
  }

  /**
   * 删除账号
   */
  static async deleteAccount(password: string): Promise<void> {
    await apiClient.delete<GenericSuccessResponse>(`${this.baseUrl}/me`, {
      data: { password },
    });
  }

  /**
   * 获取用户会话列表
   */
  static async getSessions(page: number = 1, pageSize: number = 10): Promise<PaginatedSessions> {
    const response = await apiClient.get<{ success: boolean; data: PaginatedSessions }>(
      `${this.baseUrl}/me/sessions`,
      { params: { page, pageSize } }
    );
    return response.data.data;
  }

  /**
   * 删除指定会话
   */
  static async deleteSession(sessionId: string): Promise<void> {
    await apiClient.delete<GenericSuccessResponse>(
      `${this.baseUrl}/me/sessions/${sessionId}`
    );
  }

  /**
   * 删除所有其他会话
   */
  static async deleteOtherSessions(): Promise<void> {
    await apiClient.delete<GenericSuccessResponse>(
      `${this.baseUrl}/me/sessions/others`
    );
  }

  /**
   * 获取登录历史
   */
  static async getLoginHistory(page: number = 1, pageSize: number = 20): Promise<PaginatedLoginHistory> {
    const response = await apiClient.get<{ success: boolean; data: PaginatedLoginHistory }>(
      `${this.baseUrl}/me/login-history`,
      { params: { page, pageSize } }
    );
    return response.data.data;
  }
}

export default UserApiClient;

