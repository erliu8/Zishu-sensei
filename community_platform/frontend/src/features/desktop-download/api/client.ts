/**
 * 桌面应用下载 API 客户端
 */

import { apiClient } from '@/infrastructure/api/client';
import type { ApiResponse } from '@/infrastructure/api/types';
import type {
  CreatePackagingTaskRequest,
  PackagingTask,
  PackagingTaskStatus,
} from './types';

/**
 * 桌面应用下载 API 客户端
 */
export class DesktopDownloadApiClient {
  private readonly baseUrl = '/api/packaging';

  /**
   * 创建打包任务
   */
  async createPackagingTask(
    request: CreatePackagingTaskRequest
  ): Promise<ApiResponse<PackagingTask>> {
    const response = await apiClient.post<ApiResponse<PackagingTask>>(
      this.baseUrl,
      request
    );
    return response.data;
  }

  /**
   * 获取打包任务详情
   */
  async getTask(taskId: string): Promise<ApiResponse<PackagingTask>> {
    const response = await apiClient.get<ApiResponse<PackagingTask>>(
      `${this.baseUrl}/${taskId}`
    );
    return response.data;
  }

  /**
   * 获取打包任务状态（用于轮询）
   */
  async getTaskStatus(taskId: string): Promise<ApiResponse<PackagingTaskStatus>> {
    const response = await apiClient.get<ApiResponse<PackagingTaskStatus>>(
      `${this.baseUrl}/${taskId}/status`
    );
    return response.data;
  }

  /**
   * 取消打包任务
   */
  async cancelTask(taskId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `${this.baseUrl}/${taskId}`
    );
    return response.data;
  }

  /**
   * 获取用户的打包任务列表
   */
  async getUserTasks(page: number = 1, size: number = 20): Promise<ApiResponse<PackagingTask[]>> {
    const response = await apiClient.get<ApiResponse<PackagingTask[]>>(
      `${this.baseUrl}/user/tasks`,
      { params: { page, size } }
    );
    return response.data;
  }
}

/**
 * 导出单例实例
 */
export const desktopDownloadApiClient = new DesktopDownloadApiClient();

