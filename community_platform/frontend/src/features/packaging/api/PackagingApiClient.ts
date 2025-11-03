/**
 * Packaging API Client
 * 打包服务 API 客户端
 */

import { apiClient } from '@/infrastructure/api/client';
import type { ApiResponse, PaginatedResponse } from '@/infrastructure/api/types';
import type {
  PackagingTask,
  CreatePackageInput,
  PackagingTaskQueryParams,
  PackagingTaskStats,
  PackagingTemplate,
  PackagingLog,
  PackagingPreset,
} from '../domain/packaging.types';

/**
 * 打包服务 API 客户端
 */
export class PackagingApiClient {
  private readonly baseUrl = '/api/packaging';

  /**
   * 创建打包任务
   */
  async createPackage(input: CreatePackageInput): Promise<ApiResponse<PackagingTask>> {
    const response = await apiClient.post<ApiResponse<PackagingTask>>(
      `${this.baseUrl}/tasks`,
      input
    );
    return response.data;
  }

  /**
   * 获取打包任务详情
   */
  async getTask(taskId: string): Promise<ApiResponse<PackagingTask>> {
    const response = await apiClient.get<ApiResponse<PackagingTask>>(
      `${this.baseUrl}/tasks/${taskId}`
    );
    return response.data;
  }

  /**
   * 获取打包任务列表
   */
  async getTasks(
    params: PackagingTaskQueryParams
  ): Promise<ApiResponse<PaginatedResponse<PackagingTask>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<PackagingTask>>>(
      `${this.baseUrl}/tasks`,
      { params }
    );
    return response.data;
  }

  /**
   * 取消打包任务
   */
  async cancelTask(taskId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.post<ApiResponse<void>>(
      `${this.baseUrl}/tasks/${taskId}/cancel`
    );
    return response.data;
  }

  /**
   * 删除打包任务
   */
  async deleteTask(taskId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `${this.baseUrl}/tasks/${taskId}`
    );
    return response.data;
  }

  /**
   * 重试打包任务
   */
  async retryTask(taskId: string): Promise<ApiResponse<PackagingTask>> {
    const response = await apiClient.post<ApiResponse<PackagingTask>>(
      `${this.baseUrl}/tasks/${taskId}/retry`
    );
    return response.data;
  }

  /**
   * 获取下载链接
   */
  async getDownloadUrl(taskId: string): Promise<ApiResponse<{ downloadUrl: string; expiresAt: Date }>> {
    const response = await apiClient.get<ApiResponse<{ downloadUrl: string; expiresAt: Date }>>(
      `${this.baseUrl}/tasks/${taskId}/download`
    );
    return response.data;
  }

  /**
   * 获取打包任务日志
   */
  async getTaskLogs(
    taskId: string,
    params?: { level?: string; limit?: number }
  ): Promise<ApiResponse<PackagingLog[]>> {
    const response = await apiClient.get<ApiResponse<PackagingLog[]>>(
      `${this.baseUrl}/tasks/${taskId}/logs`,
      { params }
    );
    return response.data;
  }

  /**
   * 获取打包任务统计
   */
  async getTaskStats(userId?: string): Promise<ApiResponse<PackagingTaskStats>> {
    const response = await apiClient.get<ApiResponse<PackagingTaskStats>>(
      `${this.baseUrl}/stats`,
      { params: { userId } }
    );
    return response.data;
  }

  /**
   * 获取打包模板列表
   */
  async getTemplates(params?: {
    page?: number;
    pageSize?: number;
    isPublic?: boolean;
  }): Promise<ApiResponse<PaginatedResponse<PackagingTemplate>>> {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<PackagingTemplate>>>(
      `${this.baseUrl}/templates`,
      { params }
    );
    return response.data;
  }

  /**
   * 获取打包模板详情
   */
  async getTemplate(templateId: string): Promise<ApiResponse<PackagingTemplate>> {
    const response = await apiClient.get<ApiResponse<PackagingTemplate>>(
      `${this.baseUrl}/templates/${templateId}`
    );
    return response.data;
  }

  /**
   * 创建打包模板
   */
  async createTemplate(
    input: Omit<PackagingTemplate, 'id' | 'creatorId' | 'usageCount' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<PackagingTemplate>> {
    const response = await apiClient.post<ApiResponse<PackagingTemplate>>(
      `${this.baseUrl}/templates`,
      input
    );
    return response.data;
  }

  /**
   * 更新打包模板
   */
  async updateTemplate(
    templateId: string,
    input: Partial<PackagingTemplate>
  ): Promise<ApiResponse<PackagingTemplate>> {
    const response = await apiClient.patch<ApiResponse<PackagingTemplate>>(
      `${this.baseUrl}/templates/${templateId}`,
      input
    );
    return response.data;
  }

  /**
   * 删除打包模板
   */
  async deleteTemplate(templateId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `${this.baseUrl}/templates/${templateId}`
    );
    return response.data;
  }

  /**
   * 获取打包预设
   */
  async getPresets(): Promise<ApiResponse<PackagingPreset[]>> {
    const response = await apiClient.get<ApiResponse<PackagingPreset[]>>(
      `${this.baseUrl}/presets`
    );
    return response.data;
  }

  /**
   * 批量删除任务
   */
  async bulkDeleteTasks(taskIds: string[]): Promise<ApiResponse<{ successCount: number; failedIds: string[] }>> {
    const response = await apiClient.post<ApiResponse<{ successCount: number; failedIds: string[] }>>(
      `${this.baseUrl}/tasks/bulk-delete`,
      { taskIds }
    );
    return response.data;
  }

  /**
   * 验证配置
   */
  async validateConfig(config: any): Promise<ApiResponse<{ isValid: boolean; errors: string[] }>> {
    const response = await apiClient.post<ApiResponse<{ isValid: boolean; errors: string[] }>>(
      `${this.baseUrl}/validate`,
      { config }
    );
    return response.data;
  }
}

/**
 * 导出单例实例
 */
export const packagingApiClient = new PackagingApiClient();

