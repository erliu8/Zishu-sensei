/**
 * Comment API Client
 * 评论 API 客户端
 */

import { apiClient } from '@/infrastructure/api/client';
import type {
  Comment,
  CommentListParams,
  CommentListResponse,
  CreateCommentDto,
  UpdateCommentDto,
  CommentStats,
} from '../domain/comment.types';

export class CommentApiClient {
  private readonly baseUrl = '/api/comments';

  /**
   * 获取评论列表
   */
  async getComments(params: CommentListParams): Promise<CommentListResponse> {
    const { data } = await apiClient.get<CommentListResponse>(this.baseUrl, {
      params,
    });
    return data;
  }

  /**
   * 获取单个评论
   */
  async getComment(commentId: string): Promise<Comment> {
    const { data } = await apiClient.get<Comment>(
      `${this.baseUrl}/${commentId}`
    );
    return data;
  }

  /**
   * 创建评论
   */
  async createComment(dto: CreateCommentDto): Promise<Comment> {
    const { data } = await apiClient.post<Comment>(this.baseUrl, dto);
    return data;
  }

  /**
   * 更新评论
   */
  async updateComment(
    commentId: string,
    dto: UpdateCommentDto
  ): Promise<Comment> {
    const { data } = await apiClient.patch<Comment>(
      `${this.baseUrl}/${commentId}`,
      dto
    );
    return data;
  }

  /**
   * 删除评论
   */
  async deleteComment(commentId: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${commentId}`);
  }

  /**
   * 点赞评论
   */
  async likeComment(commentId: string): Promise<void> {
    await apiClient.post(`${this.baseUrl}/${commentId}/like`);
  }

  /**
   * 取消点赞
   */
  async unlikeComment(commentId: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${commentId}/like`);
  }

  /**
   * 获取评论的回复列表
   */
  async getReplies(commentId: string, page = 1, pageSize = 10): Promise<CommentListResponse> {
    const { data } = await apiClient.get<CommentListResponse>(
      `${this.baseUrl}/${commentId}/replies`,
      {
        params: { page, pageSize },
      }
    );
    return data;
  }

  /**
   * 获取评论统计信息
   */
  async getCommentStats(targetType: string, targetId: string): Promise<CommentStats> {
    const { data } = await apiClient.get<CommentStats>(
      `${this.baseUrl}/stats`,
      {
        params: { targetType, targetId },
      }
    );
    return data;
  }

  /**
   * 举报评论
   */
  async reportComment(commentId: string, reason: string): Promise<void> {
    await apiClient.post(`${this.baseUrl}/${commentId}/report`, { reason });
  }
}

export const commentApiClient = new CommentApiClient();

