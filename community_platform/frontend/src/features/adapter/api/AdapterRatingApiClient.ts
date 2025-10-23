/**
 * 适配器评分 API 客户端
 * @module features/adapter/api
 */

import { apiClient } from '@/infrastructure/api';
import type {
  AdapterRating,
  CreateRatingInput,
  UpdateRatingInput,
  ApiResponse,
} from '../domain';

/**
 * 评分列表查询参数
 */
export interface RatingQueryParams {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'rating' | 'likes';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 最小评分 */
  minRating?: number;
  /** 最大评分 */
  maxRating?: number;
  /** 是否只显示已验证的 */
  verifiedOnly?: boolean;
}

/**
 * 评分列表响应
 */
export interface RatingListResponse {
  /** 评分列表 */
  data: AdapterRating[];
  /** 总数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 是否有上一页 */
  hasPrevious: boolean;
  /** 平均评分 */
  averageRating: number;
  /** 评分分布 */
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

/**
 * 适配器评分 API 客户端类
 */
export class AdapterRatingApiClient {
  private readonly basePath = '/adapters';

  /**
   * 获取适配器的评分列表
   * @param adapterId - 适配器 ID
   * @param params - 查询参数
   * @returns 评分列表响应
   */
  async getRatings(
    adapterId: string,
    params?: RatingQueryParams
  ): Promise<RatingListResponse> {
    const response = await apiClient.get<ApiResponse<RatingListResponse>>(
      `${this.basePath}/${adapterId}/ratings`,
      { params }
    );
    return response.data.data;
  }

  /**
   * 获取单个评分详情
   * @param adapterId - 适配器 ID
   * @param ratingId - 评分 ID
   * @returns 评分详情
   */
  async getRating(adapterId: string, ratingId: string): Promise<AdapterRating> {
    const response = await apiClient.get<ApiResponse<AdapterRating>>(
      `${this.basePath}/${adapterId}/ratings/${ratingId}`
    );
    return response.data.data;
  }

  /**
   * 获取用户对适配器的评分
   * @param adapterId - 适配器 ID
   * @returns 用户评分（如果存在）
   */
  async getMyRating(adapterId: string): Promise<AdapterRating | null> {
    try {
      const response = await apiClient.get<ApiResponse<AdapterRating>>(
        `${this.basePath}/${adapterId}/ratings/me`
      );
      return response.data.data;
    } catch (error: any) {
      // 如果没有评分，返回null
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 创建评分
   * @param data - 创建评分数据
   * @returns 创建的评分
   */
  async createRating(data: CreateRatingInput): Promise<AdapterRating> {
    const response = await apiClient.post<ApiResponse<AdapterRating>>(
      `${this.basePath}/${data.adapterId}/ratings`,
      {
        rating: data.rating,
        comment: data.comment,
      }
    );
    return response.data.data;
  }

  /**
   * 更新评分
   * @param adapterId - 适配器 ID
   * @param ratingId - 评分 ID
   * @param data - 更新评分数据
   * @returns 更新后的评分
   */
  async updateRating(
    adapterId: string,
    ratingId: string,
    data: UpdateRatingInput
  ): Promise<AdapterRating> {
    const response = await apiClient.patch<ApiResponse<AdapterRating>>(
      `${this.basePath}/${adapterId}/ratings/${ratingId}`,
      {
        rating: data.rating,
        comment: data.comment,
      }
    );
    return response.data.data;
  }

  /**
   * 删除评分
   * @param adapterId - 适配器 ID
   * @param ratingId - 评分 ID
   * @returns 删除结果
   */
  async deleteRating(adapterId: string, ratingId: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(
      `${this.basePath}/${adapterId}/ratings/${ratingId}`
    );
  }

  /**
   * 点赞评分
   * @param adapterId - 适配器 ID
   * @param ratingId - 评分 ID
   * @returns 更新后的评分
   */
  async likeRating(adapterId: string, ratingId: string): Promise<AdapterRating> {
    const response = await apiClient.post<ApiResponse<AdapterRating>>(
      `${this.basePath}/${adapterId}/ratings/${ratingId}/like`
    );
    return response.data.data;
  }

  /**
   * 取消点赞评分
   * @param adapterId - 适配器 ID
   * @param ratingId - 评分 ID
   * @returns 更新后的评分
   */
  async unlikeRating(adapterId: string, ratingId: string): Promise<AdapterRating> {
    const response = await apiClient.delete<ApiResponse<AdapterRating>>(
      `${this.basePath}/${adapterId}/ratings/${ratingId}/like`
    );
    return response.data.data;
  }

  /**
   * 获取评分统计
   * @param adapterId - 适配器 ID
   * @returns 评分统计
   */
  async getRatingStats(adapterId: string): Promise<{
    averageRating: number;
    totalRatings: number;
    distribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
  }> {
    const response = await apiClient.get<
      ApiResponse<{
        averageRating: number;
        totalRatings: number;
        distribution: {
          1: number;
          2: number;
          3: number;
          4: number;
          5: number;
        };
      }>
    >(`${this.basePath}/${adapterId}/ratings/stats`);
    return response.data.data;
  }

  /**
   * 举报评分
   * @param adapterId - 适配器 ID
   * @param ratingId - 评分 ID
   * @param reason - 举报原因
   * @returns 举报结果
   */
  async reportRating(
    adapterId: string,
    ratingId: string,
    reason: string
  ): Promise<void> {
    await apiClient.post<ApiResponse<void>>(
      `${this.basePath}/${adapterId}/ratings/${ratingId}/report`,
      { reason }
    );
  }
}

/**
 * 适配器评分 API 客户端实例
 */
export const adapterRatingApiClient = new AdapterRatingApiClient();

