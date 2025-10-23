/**
 * Favorite API Client
 * 收藏相关的 API 客户端
 */

import { apiClient } from '@/infrastructure/api/client';
import type { ApiResponse, PaginatedResponse } from '@/infrastructure/api/types';
import type {
  Favorite,
  CreateFavoriteInput,
  UpdateFavoriteInput,
  FavoriteStats,
  FavoriteQueryParams,
  FavoriteCollection,
  CreateCollectionInput,
  FavoriteTargetType,
} from '../domain/Favorite';

/**
 * 收藏 API 客户端
 */
export class FavoriteApiClient {
  private readonly baseUrl = '/social/favorites';
  private readonly collectionUrl = '/social/favorite-collections';

  /**
   * 添加收藏
   */
  async addFavorite(input: CreateFavoriteInput): Promise<ApiResponse<Favorite>> {
    const response = await apiClient.post<ApiResponse<Favorite>>(this.baseUrl, input);
    return response.data;
  }

  /**
   * 移除收藏
   */
  async removeFavorite(targetType: FavoriteTargetType, targetId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `${this.baseUrl}/${targetType}/${targetId}`
    );
    return response.data;
  }

  /**
   * 更新收藏
   */
  async updateFavorite(input: UpdateFavoriteInput): Promise<ApiResponse<Favorite>> {
    const { id, ...data } = input;
    const response = await apiClient.put<ApiResponse<Favorite>>(
      `${this.baseUrl}/${id}`,
      data
    );
    return response.data;
  }

  /**
   * 检查是否已收藏
   */
  async checkFavorited(
    targetType: FavoriteTargetType,
    targetId: string
  ): Promise<ApiResponse<{ isFavorited: boolean; favoriteId?: string }>> {
    const response = await apiClient.get<ApiResponse<{ isFavorited: boolean; favoriteId?: string }>>(
      `${this.baseUrl}/check/${targetType}/${targetId}`
    );
    return response.data;
  }

  /**
   * 获取收藏统计
   */
  async getFavoriteStats(targetType: FavoriteTargetType, targetId: string): Promise<ApiResponse<FavoriteStats>> {
    const response = await apiClient.get<ApiResponse<FavoriteStats>>(
      `${this.baseUrl}/stats/${targetType}/${targetId}`
    );
    return response.data;
  }

  /**
   * 获取收藏列表
   */
  async getFavorites(params: FavoriteQueryParams): Promise<ApiResponse<PaginatedResponse<Favorite>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Favorite>>>(
      this.baseUrl,
      { params }
    );
    return response.data;
  }

  /**
   * 获取用户的收藏列表
   */
  async getUserFavorites(
    userId: string,
    targetType?: FavoriteTargetType,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse<PaginatedResponse<Favorite>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Favorite>>>(
      `${this.baseUrl}/user/${userId}`,
      { params: { targetType, page, pageSize } }
    );
    return response.data;
  }

  /**
   * 切换收藏状态（收藏/取消收藏）
   */
  async toggleFavorite(input: CreateFavoriteInput): Promise<ApiResponse<{ isFavorited: boolean; favoriteCount: number }>> {
    const response = await apiClient.post<ApiResponse<{ isFavorited: boolean; favoriteCount: number }>>(
      `${this.baseUrl}/toggle`,
      input
    );
    return response.data;
  }

  /**
   * 移动收藏到其他收藏夹
   */
  async moveFavorite(favoriteId: string, collectionId: string): Promise<ApiResponse<Favorite>> {
    const response = await apiClient.patch<ApiResponse<Favorite>>(
      `${this.baseUrl}/${favoriteId}/move`,
      { collectionId }
    );
    return response.data;
  }

  // ==================== 收藏夹相关 ====================

  /**
   * 创建收藏夹
   */
  async createCollection(input: CreateCollectionInput): Promise<ApiResponse<FavoriteCollection>> {
    const response = await apiClient.post<ApiResponse<FavoriteCollection>>(
      this.collectionUrl,
      input
    );
    return response.data;
  }

  /**
   * 更新收藏夹
   */
  async updateCollection(id: string, input: Partial<CreateCollectionInput>): Promise<ApiResponse<FavoriteCollection>> {
    const response = await apiClient.put<ApiResponse<FavoriteCollection>>(
      `${this.collectionUrl}/${id}`,
      input
    );
    return response.data;
  }

  /**
   * 删除收藏夹
   */
  async deleteCollection(id: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `${this.collectionUrl}/${id}`
    );
    return response.data;
  }

  /**
   * 获取收藏夹列表
   */
  async getCollections(userId?: string): Promise<ApiResponse<FavoriteCollection[]>> {
    const response = await apiClient.get<ApiResponse<FavoriteCollection[]>>(
      this.collectionUrl,
      { params: { userId } }
    );
    return response.data;
  }

  /**
   * 获取收藏夹详情
   */
  async getCollection(id: string): Promise<ApiResponse<FavoriteCollection>> {
    const response = await apiClient.get<ApiResponse<FavoriteCollection>>(
      `${this.collectionUrl}/${id}`
    );
    return response.data;
  }

  /**
   * 获取收藏夹中的收藏项
   */
  async getCollectionItems(
    collectionId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<ApiResponse<PaginatedResponse<Favorite>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Favorite>>>(
      `${this.collectionUrl}/${collectionId}/items`,
      { params: { page, pageSize } }
    );
    return response.data;
  }
}

/**
 * 导出单例实例
 */
export const favoriteApiClient = new FavoriteApiClient();

