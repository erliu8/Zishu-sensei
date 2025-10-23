/**
 * 帖子数据层 - API Client
 * @module features/post/api
 */

import { apiClient } from '@/infrastructure/api';
import type {
  Post,
  PostListResponse,
  CreatePostDto,
  UpdatePostDto,
  PostQueryParams,
  ApiResponse,
} from '../domain';

/**
 * 帖子 API 客户端
 */
export class PostApiClient {
  private readonly basePath = '/posts';

  /**
   * 获取帖子列表
   * @param params - 查询参数
   * @returns 帖子列表响应
   */
  async getPosts(params?: PostQueryParams): Promise<PostListResponse> {
    const response = await apiClient.get<ApiResponse<PostListResponse>>(this.basePath, {
      params,
    });
    return response.data.data;
  }

  /**
   * 获取单个帖子详情
   * @param id - 帖子 ID
   * @returns 帖子详情
   */
  async getPost(id: string): Promise<Post> {
    const response = await apiClient.get<ApiResponse<Post>>(`${this.basePath}/${id}`);
    return response.data.data;
  }

  /**
   * 创建帖子
   * @param data - 创建帖子数据
   * @returns 创建的帖子
   */
  async createPost(data: CreatePostDto): Promise<Post> {
    const response = await apiClient.post<ApiResponse<Post>>(this.basePath, data);
    return response.data.data;
  }

  /**
   * 更新帖子
   * @param id - 帖子 ID
   * @param data - 更新帖子数据
   * @returns 更新后的帖子
   */
  async updatePost(id: string, data: UpdatePostDto): Promise<Post> {
    const response = await apiClient.patch<ApiResponse<Post>>(`${this.basePath}/${id}`, data);
    return response.data.data;
  }

  /**
   * 删除帖子
   * @param id - 帖子 ID
   * @returns 删除结果
   */
  async deletePost(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  /**
   * 点赞帖子
   * @param id - 帖子 ID
   * @returns 更新后的帖子
   */
  async likePost(id: string): Promise<Post> {
    const response = await apiClient.post<ApiResponse<Post>>(`${this.basePath}/${id}/like`);
    return response.data.data;
  }

  /**
   * 取消点赞帖子
   * @param id - 帖子 ID
   * @returns 更新后的帖子
   */
  async unlikePost(id: string): Promise<Post> {
    const response = await apiClient.delete<ApiResponse<Post>>(`${this.basePath}/${id}/like`);
    return response.data.data;
  }

  /**
   * 收藏帖子
   * @param id - 帖子 ID
   * @returns 更新后的帖子
   */
  async favoritePost(id: string): Promise<Post> {
    const response = await apiClient.post<ApiResponse<Post>>(`${this.basePath}/${id}/favorite`);
    return response.data.data;
  }

  /**
   * 取消收藏帖子
   * @param id - 帖子 ID
   * @returns 更新后的帖子
   */
  async unfavoritePost(id: string): Promise<Post> {
    const response = await apiClient.delete<ApiResponse<Post>>(`${this.basePath}/${id}/favorite`);
    return response.data.data;
  }

  /**
   * 增加帖子浏览量
   * @param id - 帖子 ID
   * @returns void
   */
  async incrementViewCount(id: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(`${this.basePath}/${id}/view`);
  }

  /**
   * 获取用户的帖子列表
   * @param userId - 用户 ID
   * @param params - 查询参数
   * @returns 帖子列表响应
   */
  async getUserPosts(userId: string, params?: PostQueryParams): Promise<PostListResponse> {
    const response = await apiClient.get<ApiResponse<PostListResponse>>(`/users/${userId}/posts`, {
      params,
    });
    return response.data.data;
  }

  /**
   * 获取推荐帖子列表
   * @param limit - 限制数量
   * @returns 推荐帖子列表
   */
  async getFeaturedPosts(limit: number = 10): Promise<Post[]> {
    const response = await apiClient.get<ApiResponse<Post[]>>(`${this.basePath}/featured`, {
      params: { limit },
    });
    return response.data.data;
  }

  /**
   * 获取热门帖子列表
   * @param limit - 限制数量
   * @returns 热门帖子列表
   */
  async getTrendingPosts(limit: number = 10): Promise<Post[]> {
    const response = await apiClient.get<ApiResponse<Post[]>>(`${this.basePath}/trending`, {
      params: { limit },
    });
    return response.data.data;
  }
}

/**
 * 帖子 API 客户端实例
 */
export const postApiClient = new PostApiClient();

