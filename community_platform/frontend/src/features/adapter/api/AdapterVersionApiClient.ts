/**
 * 适配器版本 API 客户端
 * @module features/adapter/api
 */

import { apiClient } from '@/infrastructure/api';
import type {
  AdapterVersion,
  CreateVersionInput,
  ApiResponse,
} from '../domain';

/**
 * 适配器版本 API 客户端类
 */
export class AdapterVersionApiClient {
  private readonly basePath = '/adapters';

  /**
   * 获取适配器的所有版本
   * @param adapterId - 适配器 ID
   * @returns 版本列表
   */
  async getVersions(adapterId: string): Promise<AdapterVersion[]> {
    const response = await apiClient.get<ApiResponse<AdapterVersion[]>>(
      `${this.basePath}/${adapterId}/versions`
    );
    return response.data.data;
  }

  /**
   * 获取单个版本详情
   * @param adapterId - 适配器 ID
   * @param versionId - 版本 ID
   * @returns 版本详情
   */
  async getVersion(adapterId: string, versionId: string): Promise<AdapterVersion> {
    const response = await apiClient.get<ApiResponse<AdapterVersion>>(
      `${this.basePath}/${adapterId}/versions/${versionId}`
    );
    return response.data.data;
  }

  /**
   * 根据版本号获取版本详情
   * @param adapterId - 适配器 ID
   * @param versionNumber - 版本号
   * @returns 版本详情
   */
  async getVersionByNumber(adapterId: string, versionNumber: string): Promise<AdapterVersion> {
    const response = await apiClient.get<ApiResponse<AdapterVersion>>(
      `${this.basePath}/${adapterId}/versions/by-number/${versionNumber}`
    );
    return response.data.data;
  }

  /**
   * 获取最新版本
   * @param adapterId - 适配器 ID
   * @returns 最新版本
   */
  async getLatestVersion(adapterId: string): Promise<AdapterVersion> {
    const response = await apiClient.get<ApiResponse<AdapterVersion>>(
      `${this.basePath}/${adapterId}/versions/latest`
    );
    return response.data.data;
  }

  /**
   * 创建新版本
   * @param data - 创建版本数据
   * @returns 创建的版本
   */
  async createVersion(data: CreateVersionInput): Promise<AdapterVersion> {
    const formData = this._buildFormData(data);
    const response = await apiClient.post<ApiResponse<AdapterVersion>>(
      `${this.basePath}/${data.adapterId}/versions`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // 上传进度
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`Upload progress: ${progress}%`);
          }
        },
      }
    );
    return response.data.data;
  }

  /**
   * 删除版本
   * @param adapterId - 适配器 ID
   * @param versionId - 版本 ID
   * @returns 删除结果
   */
  async deleteVersion(adapterId: string, versionId: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(
      `${this.basePath}/${adapterId}/versions/${versionId}`
    );
  }

  /**
   * 设置为稳定版本
   * @param adapterId - 适配器 ID
   * @param versionId - 版本 ID
   * @returns 更新后的版本
   */
  async markAsStable(adapterId: string, versionId: string): Promise<AdapterVersion> {
    const response = await apiClient.post<ApiResponse<AdapterVersion>>(
      `${this.basePath}/${adapterId}/versions/${versionId}/stable`
    );
    return response.data.data;
  }

  /**
   * 设置为最新版本
   * @param adapterId - 适配器 ID
   * @param versionId - 版本 ID
   * @returns 更新后的版本
   */
  async markAsLatest(adapterId: string, versionId: string): Promise<AdapterVersion> {
    const response = await apiClient.post<ApiResponse<AdapterVersion>>(
      `${this.basePath}/${adapterId}/versions/${versionId}/latest`
    );
    return response.data.data;
  }

  /**
   * 下载版本文件
   * @param adapterId - 适配器 ID
   * @param versionId - 版本 ID
   * @returns 下载URL
   */
  async downloadVersion(adapterId: string, versionId: string): Promise<string> {
    const response = await apiClient.get<ApiResponse<{ downloadUrl: string }>>(
      `${this.basePath}/${adapterId}/versions/${versionId}/download`
    );
    return response.data.data.downloadUrl;
  }

  /**
   * 验证版本文件完整性
   * @param adapterId - 适配器 ID
   * @param versionId - 版本 ID
   * @param fileHash - 文件哈希值
   * @returns 验证结果
   */
  async verifyVersion(
    adapterId: string,
    versionId: string,
    fileHash: string
  ): Promise<{ valid: boolean; message?: string }> {
    const response = await apiClient.post<ApiResponse<{ valid: boolean; message?: string }>>(
      `${this.basePath}/${adapterId}/versions/${versionId}/verify`,
      { fileHash }
    );
    return response.data.data;
  }

  /**
   * 比较两个版本
   * @param adapterId - 适配器 ID
   * @param fromVersion - 起始版本号
   * @param toVersion - 目标版本号
   * @returns 版本差异
   */
  async compareVersions(
    adapterId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<{
    from: AdapterVersion;
    to: AdapterVersion;
    changes: string[];
    breaking: boolean;
  }> {
    const response = await apiClient.get<
      ApiResponse<{
        from: AdapterVersion;
        to: AdapterVersion;
        changes: string[];
        breaking: boolean;
      }>
    >(`${this.basePath}/${adapterId}/versions/compare`, {
      params: { from: fromVersion, to: toVersion },
    });
    return response.data.data;
  }

  /**
   * 构建FormData（用于文件上传）
   * @param data - 创建版本数据
   * @returns FormData
   */
  private _buildFormData(data: CreateVersionInput): FormData {
    const formData = new FormData();

    // 添加文件
    formData.append('file', data.file);

    // 添加版本信息
    formData.append('version', data.version);
    formData.append('description', data.description);

    if (data.changelog) {
      formData.append('changelog', data.changelog);
    }

    if (data.isStable !== undefined) {
      formData.append('isStable', data.isStable.toString());
    }

    if (data.dependencies) {
      formData.append('dependencies', JSON.stringify(data.dependencies));
    }

    if (data.systemRequirements) {
      formData.append('systemRequirements', JSON.stringify(data.systemRequirements));
    }

    if (data.permissions) {
      formData.append('permissions', JSON.stringify(data.permissions));
    }

    return formData;
  }
}

/**
 * 适配器版本 API 客户端实例
 */
export const adapterVersionApiClient = new AdapterVersionApiClient();

