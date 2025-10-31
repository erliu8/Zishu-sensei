/**
 * 用户 API 响应类型
 * @module features/user/api/types
 */

import type {
  UserProfile,
  UserStats,
  UserActivity,
  PaginatedUsers,
} from '../types';

/**
 * 获取用户资料响应
 */
export interface GetUserProfileResponse {
  success: boolean;
  data: UserProfile;
  message?: string;
}

/**
 * 获取用户列表响应
 */
export interface GetUsersResponse {
  success: boolean;
  data: PaginatedUsers;
  message?: string;
}

/**
 * 更新用户资料响应
 */
export interface UpdateUserProfileResponse {
  success: boolean;
  data: UserProfile;
  message?: string;
}

/**
 * 上传头像响应
 */
export interface UploadAvatarResponse {
  success: boolean;
  data: {
    avatarUrl: string;
  };
  message?: string;
}

/**
 * 获取用户统计响应
 */
export interface GetUserStatsResponse {
  success: boolean;
  data: UserStats;
  message?: string;
}

/**
 * 获取用户活动响应
 */
export interface GetUserActivitiesResponse {
  success: boolean;
  data: {
    activities: UserActivity[];
    total: number;
    hasMore: boolean;
  };
  message?: string;
}

/**
 * 通用成功响应
 */
export interface GenericSuccessResponse {
  success: boolean;
  message?: string;
}

