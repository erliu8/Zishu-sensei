/**
 * Follow API Client
 * 关注相关的 API 客户端
 */

import { apiClient } from '@/infrastructure/api/client';
import type { ApiResponse, PaginatedResponse } from '@/infrastructure/api/types';
import type {
  Follow,
  CreateFollowInput,
  FollowStats,
  FollowQueryParams,
  BulkFollowInput,
} from '../domain/Follow';

/**
 * 关注 API 客户端
 */
export class FollowApiClient {
  private readonly baseUrl = '/social/follows';

  /**
   * 关注用户
   */
  async follow(input: CreateFollowInput): Promise<ApiResponse<Follow>> {
    const response = await apiClient.post<ApiResponse<Follow>>(this.baseUrl, input);
    return response.data;
  }

  /**
   * 取消关注
   */
  async unfollow(followeeId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(`${this.baseUrl}/${followeeId}`);
    return response.data;
  }

  /**
   * 检查是否关注
   */
  async checkFollowing(followeeId: string): Promise<ApiResponse<{ isFollowing: boolean }>> {
    const response = await apiClient.get<ApiResponse<{ isFollowing: boolean }>>(
      `${this.baseUrl}/check/${followeeId}`
    );
    return response.data;
  }

  /**
   * 获取关注统计
   */
  async getFollowStats(userId: string): Promise<ApiResponse<FollowStats>> {
    const response = await apiClient.get<ApiResponse<FollowStats>>(
      `${this.baseUrl}/stats/${userId}`
    );
    return response.data;
  }

  /**
   * 获取粉丝列表
   */
  async getFollowers(params: FollowQueryParams): Promise<ApiResponse<PaginatedResponse<Follow>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Follow>>>(
      `${this.baseUrl}/followers`,
      { params }
    );
    return response.data;
  }

  /**
   * 获取关注列表
   */
  async getFollowing(params: FollowQueryParams): Promise<ApiResponse<PaginatedResponse<Follow>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Follow>>>(
      `${this.baseUrl}/following`,
      { params }
    );
    return response.data;
  }

  /**
   * 批量关注
   */
  async bulkFollow(input: BulkFollowInput): Promise<ApiResponse<{ successCount: number; failedIds: string[] }>> {
    const response = await apiClient.post<ApiResponse<{ successCount: number; failedIds: string[] }>>(
      `${this.baseUrl}/bulk`,
      input
    );
    return response.data;
  }

  /**
   * 批量取消关注
   */
  async bulkUnfollow(userIds: string[]): Promise<ApiResponse<{ successCount: number; failedIds: string[] }>> {
    const response = await apiClient.delete<ApiResponse<{ successCount: number; failedIds: string[] }>>(
      `${this.baseUrl}/bulk`,
      { data: { userIds } }
    );
    return response.data;
  }

  /**
   * 获取互相关注的用户
   */
  async getMutualFollows(params: FollowQueryParams): Promise<ApiResponse<PaginatedResponse<Follow>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Follow>>>(
      `${this.baseUrl}/mutual`,
      { params }
    );
    return response.data;
  }

  /**
   * 获取推荐关注用户
   */
  async getRecommendedUsers(limit: number = 10): Promise<ApiResponse<Array<{
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    bio?: string;
    followerCount: number;
    mutualFollowerCount: number;
  }>>> {
    const response = await apiClient.get<ApiResponse<any>>(
      `${this.baseUrl}/recommendations`,
      { params: { limit } }
    );
    return response.data;
  }
}

/**
 * 导出单例实例
 */
export const followApiClient = new FollowApiClient();

