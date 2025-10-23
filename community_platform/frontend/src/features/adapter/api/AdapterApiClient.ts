/**
 * 适配器 API 客户端
 * @module features/adapter/api
 */

import { apiClient } from '@/infrastructure/api';
import type {
  Adapter,
  AdapterListResponse,
  CreateAdapterInput,
  UpdateAdapterInput,
  AdapterQueryParams,
  ApiResponse,
  AdapterInstallStatus,
  AdapterSearchSuggestion,
} from '../domain';

/**
 * 适配器 API 客户端类
 */
export class AdapterApiClient {
  private readonly basePath = '/adapters';

  /**
   * 获取适配器列表
   * @param params - 查询参数
   * @returns 适配器列表响应
   */
  async getAdapters(params?: AdapterQueryParams): Promise<AdapterListResponse> {
    const response = await apiClient.get<ApiResponse<AdapterListResponse>>(this.basePath, {
      params,
    });
    return response.data.data;
  }

  /**
   * 获取单个适配器详情
   * @param id - 适配器 ID
   * @returns 适配器详情
   */
  async getAdapter(id: string): Promise<Adapter> {
    const response = await apiClient.get<ApiResponse<Adapter>>(`${this.basePath}/${id}`);
    return response.data.data;
  }

  /**
   * 创建适配器
   * @param data - 创建适配器数据
   * @returns 创建的适配器
   */
  async createAdapter(data: CreateAdapterInput): Promise<Adapter> {
    const formData = this._buildFormData(data);
    const response = await apiClient.post<ApiResponse<Adapter>>(this.basePath, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  }

  /**
   * 更新适配器
   * @param id - 适配器 ID
   * @param data - 更新适配器数据
   * @returns 更新后的适配器
   */
  async updateAdapter(id: string, data: UpdateAdapterInput): Promise<Adapter> {
    const response = await apiClient.patch<ApiResponse<Adapter>>(
      `${this.basePath}/${id}`,
      data
    );
    return response.data.data;
  }

  /**
   * 删除适配器
   * @param id - 适配器 ID
   * @returns 删除结果
   */
  async deleteAdapter(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  /**
   * 发布适配器
   * @param id - 适配器 ID
   * @returns 更新后的适配器
   */
  async publishAdapter(id: string): Promise<Adapter> {
    const response = await apiClient.post<ApiResponse<Adapter>>(
      `${this.basePath}/${id}/publish`
    );
    return response.data.data;
  }

  /**
   * 下架适配器
   * @param id - 适配器 ID
   * @returns 更新后的适配器
   */
  async archiveAdapter(id: string): Promise<Adapter> {
    const response = await apiClient.post<ApiResponse<Adapter>>(
      `${this.basePath}/${id}/archive`
    );
    return response.data.data;
  }

  /**
   * 点赞适配器
   * @param id - 适配器 ID
   * @returns 更新后的适配器
   */
  async likeAdapter(id: string): Promise<Adapter> {
    const response = await apiClient.post<ApiResponse<Adapter>>(
      `${this.basePath}/${id}/like`
    );
    return response.data.data;
  }

  /**
   * 取消点赞适配器
   * @param id - 适配器 ID
   * @returns 更新后的适配器
   */
  async unlikeAdapter(id: string): Promise<Adapter> {
    const response = await apiClient.delete<ApiResponse<Adapter>>(
      `${this.basePath}/${id}/like`
    );
    return response.data.data;
  }

  /**
   * 收藏适配器
   * @param id - 适配器 ID
   * @returns 更新后的适配器
   */
  async favoriteAdapter(id: string): Promise<Adapter> {
    const response = await apiClient.post<ApiResponse<Adapter>>(
      `${this.basePath}/${id}/favorite`
    );
    return response.data.data;
  }

  /**
   * 取消收藏适配器
   * @param id - 适配器 ID
   * @returns 更新后的适配器
   */
  async unfavoriteAdapter(id: string): Promise<Adapter> {
    const response = await apiClient.delete<ApiResponse<Adapter>>(
      `${this.basePath}/${id}/favorite`
    );
    return response.data.data;
  }

  /**
   * 下载适配器
   * @param id - 适配器 ID
   * @param version - 版本号（可选，默认最新版本）
   * @returns 下载URL
   */
  async downloadAdapter(id: string, version?: string): Promise<string> {
    const params = version ? { version } : undefined;
    const response = await apiClient.get<ApiResponse<{ downloadUrl: string }>>(
      `${this.basePath}/${id}/download`,
      { params }
    );
    return response.data.data.downloadUrl;
  }

  /**
   * 安装适配器
   * @param id - 适配器 ID
   * @param version - 版本号（可选，默认最新版本）
   * @returns 安装状态
   */
  async installAdapter(id: string, version?: string): Promise<AdapterInstallStatus> {
    const response = await apiClient.post<ApiResponse<AdapterInstallStatus>>(
      `${this.basePath}/${id}/install`,
      { version }
    );
    return response.data.data;
  }

  /**
   * 卸载适配器
   * @param id - 适配器 ID
   * @returns 卸载结果
   */
  async uninstallAdapter(id: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(`${this.basePath}/${id}/uninstall`);
  }

  /**
   * 获取适配器安装状态
   * @param id - 适配器 ID
   * @returns 安装状态
   */
  async getInstallStatus(id: string): Promise<AdapterInstallStatus> {
    const response = await apiClient.get<ApiResponse<AdapterInstallStatus>>(
      `${this.basePath}/${id}/install-status`
    );
    return response.data.data;
  }

  /**
   * 增加适配器浏览量
   * @param id - 适配器 ID
   * @returns void
   */
  async incrementViewCount(id: string): Promise<void> {
    await apiClient.post<ApiResponse<void>>(`${this.basePath}/${id}/view`);
  }

  /**
   * 获取用户的适配器列表
   * @param userId - 用户 ID
   * @param params - 查询参数
   * @returns 适配器列表响应
   */
  async getUserAdapters(
    userId: string,
    params?: AdapterQueryParams
  ): Promise<AdapterListResponse> {
    const response = await apiClient.get<ApiResponse<AdapterListResponse>>(
      `/users/${userId}/adapters`,
      { params }
    );
    return response.data.data;
  }

  /**
   * 获取推荐适配器列表
   * @param limit - 限制数量
   * @returns 推荐适配器列表
   */
  async getFeaturedAdapters(limit: number = 10): Promise<Adapter[]> {
    const response = await apiClient.get<ApiResponse<Adapter[]>>(
      `${this.basePath}/featured`,
      { params: { limit } }
    );
    return response.data.data;
  }

  /**
   * 获取热门适配器列表
   * @param limit - 限制数量
   * @returns 热门适配器列表
   */
  async getTrendingAdapters(limit: number = 10): Promise<Adapter[]> {
    const response = await apiClient.get<ApiResponse<Adapter[]>>(
      `${this.basePath}/trending`,
      { params: { limit } }
    );
    return response.data.data;
  }

  /**
   * 获取最新适配器列表
   * @param limit - 限制数量
   * @returns 最新适配器列表
   */
  async getLatestAdapters(limit: number = 10): Promise<Adapter[]> {
    const response = await apiClient.get<ApiResponse<Adapter[]>>(
      `${this.basePath}/latest`,
      { params: { limit } }
    );
    return response.data.data;
  }

  /**
   * 获取相关适配器
   * @param id - 适配器 ID
   * @param limit - 限制数量
   * @returns 相关适配器列表
   */
  async getRelatedAdapters(id: string, limit: number = 5): Promise<Adapter[]> {
    const response = await apiClient.get<ApiResponse<Adapter[]>>(
      `${this.basePath}/${id}/related`,
      { params: { limit } }
    );
    return response.data.data;
  }

  /**
   * 搜索适配器
   * @param query - 搜索关键词
   * @param params - 查询参数
   * @returns 适配器列表响应
   */
  async searchAdapters(
    query: string,
    params?: Omit<AdapterQueryParams, 'search'>
  ): Promise<AdapterListResponse> {
    const response = await apiClient.get<ApiResponse<AdapterListResponse>>(
      `${this.basePath}/search`,
      { params: { ...params, q: query } }
    );
    return response.data.data;
  }

  /**
   * 获取搜索建议
   * @param query - 搜索关键词
   * @param limit - 限制数量
   * @returns 搜索建议列表
   */
  async getSearchSuggestions(
    query: string,
    limit: number = 10
  ): Promise<AdapterSearchSuggestion[]> {
    const response = await apiClient.get<ApiResponse<AdapterSearchSuggestion[]>>(
      `${this.basePath}/search/suggestions`,
      { params: { q: query, limit } }
    );
    return response.data.data;
  }

  /**
   * 获取我收藏的适配器
   * @param params - 查询参数
   * @returns 适配器列表响应
   */
  async getMyFavoriteAdapters(params?: AdapterQueryParams): Promise<AdapterListResponse> {
    const response = await apiClient.get<ApiResponse<AdapterListResponse>>(
      `${this.basePath}/favorites`,
      { params }
    );
    return response.data.data;
  }

  /**
   * 获取我安装的适配器
   * @param params - 查询参数
   * @returns 适配器列表响应
   */
  async getMyInstalledAdapters(params?: AdapterQueryParams): Promise<AdapterListResponse> {
    const response = await apiClient.get<ApiResponse<AdapterListResponse>>(
      `${this.basePath}/installed`,
      { params }
    );
    return response.data.data;
  }

  /**
   * 构建FormData（用于文件上传）
   * @param data - 创建适配器数据
   * @returns FormData
   */
  private _buildFormData(data: CreateAdapterInput): FormData {
    const formData = new FormData();

    // 添加基本字段
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (key === 'initialVersion' && value) {
        const version = value as CreateAdapterInput['initialVersion'];
        if (version?.file) {
          formData.append('versionFile', version.file);
          formData.append('versionInfo', JSON.stringify({
            version: version.version,
            description: version.description,
            changelog: version.changelog,
          }));
        }
      } else if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value.toString());
      }
    });

    return formData;
  }
}

/**
 * 适配器 API 客户端实例
 */
export const adapterApiClient = new AdapterApiClient();

