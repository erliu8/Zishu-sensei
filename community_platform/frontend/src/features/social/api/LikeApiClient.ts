/**
 * Like API Client
 * 点赞相关的 API 客户端
 */

import { apiClient } from '@/infrastructure/api/client';
import type { ApiResponse, PaginatedResponse } from '@/infrastructure/api/types';
import type {
  Like,
  CreateLikeInput,
  LikeStats,
  LikeQueryParams,
  BulkLikeStats,
  LikeTargetType,
} from '../domain/Like';

/**
 * 点赞 API 客户端
 */
export class LikeApiClient {
  private readonly baseUrl = '/social/likes';

  /**
   * 点赞
   */
  async like(input: CreateLikeInput): Promise<ApiResponse<Like>> {
    const response = await apiClient.post<ApiResponse<Like>>(this.baseUrl, input);
    return response.data;
  }

  /**
   * 取消点赞
   */
  async unlike(targetType: LikeTargetType, targetId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `${this.baseUrl}/${targetType}/${targetId}`
    );
    return response.data;
  }

  /**
   * 检查是否已点赞
   */
  async checkLiked(targetType: LikeTargetType, targetId: string): Promise<ApiResponse<{ isLiked: boolean }>> {
    const response = await apiClient.get<ApiResponse<{ isLiked: boolean }>>(
      `${this.baseUrl}/check/${targetType}/${targetId}`
    );
    return response.data;
  }

  /**
   * 获取点赞统计
   */
  async getLikeStats(targetType: LikeTargetType, targetId: string): Promise<ApiResponse<LikeStats>> {
    const response = await apiClient.get<ApiResponse<LikeStats>>(
      `${this.baseUrl}/stats/${targetType}/${targetId}`
    );
    return response.data;
  }

  /**
   * 批量获取点赞统计
   */
  async getBulkLikeStats(
    targetType: LikeTargetType,
    targetIds: string[]
  ): Promise<ApiResponse<BulkLikeStats>> {
    const response = await apiClient.post<ApiResponse<BulkLikeStats>>(
      `${this.baseUrl}/stats/bulk`,
      { targetType, targetIds }
    );
    return response.data;
  }

  /**
   * 获取点赞列表
   */
  async getLikes(params: LikeQueryParams): Promise<ApiResponse<PaginatedResponse<Like>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Like>>>(
      this.baseUrl,
      { params }
    );
    return response.data;
  }

  /**
   * 获取用户的点赞列表
   */
  async getUserLikes(
    userId: string,
    targetType?: LikeTargetType,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse<PaginatedResponse<Like>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Like>>>(
      `${this.baseUrl}/user/${userId}`,
      { params: { targetType, page, pageSize } }
    );
    return response.data;
  }

  /**
   * 获取目标的点赞用户列表
   */
  async getTargetLikers(
    targetType: LikeTargetType,
    targetId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse<PaginatedResponse<Like>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Like>>>(
      `${this.baseUrl}/target/${targetType}/${targetId}`,
      { params: { page, pageSize } }
    );
    return response.data;
  }

  /**
   * 切换点赞状态（点赞/取消点赞）
   */
  async toggleLike(input: CreateLikeInput): Promise<ApiResponse<{ isLiked: boolean; likeCount: number }>> {
    const response = await apiClient.post<ApiResponse<{ isLiked: boolean; likeCount: number }>>(
      `${this.baseUrl}/toggle`,
      input
    );
    return response.data;
  }
}

/**
 * 导出单例实例
 */
export const likeApiClient = new LikeApiClient();

