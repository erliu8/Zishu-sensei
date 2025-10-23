/**
 * 适配器分类 API 客户端
 * @module features/adapter/api
 */

import { apiClient } from '@/infrastructure/api';
import type { AdapterCategory, ApiResponse } from '../domain';

/**
 * 创建分类输入
 */
export interface CreateCategoryInput {
  /** 分类名称 */
  name: string;
  /** 分类标识 */
  slug: string;
  /** 描述 */
  description?: string;
  /** 图标 */
  icon?: string;
  /** 颜色 */
  color?: string;
  /** 父分类ID */
  parentId?: string;
  /** 排序权重 */
  order?: number;
}

/**
 * 更新分类输入
 */
export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
  /** 分类ID */
  id: string;
}

/**
 * 适配器分类 API 客户端类
 */
export class AdapterCategoryApiClient {
  private readonly basePath = '/adapter-categories';

  /**
   * 获取所有分类
   * @param includeCount - 是否包含适配器数量
   * @returns 分类列表
   */
  async getCategories(includeCount: boolean = true): Promise<AdapterCategory[]> {
    const response = await apiClient.get<ApiResponse<AdapterCategory[]>>(this.basePath, {
      params: { includeCount },
    } as any);
    return response.data;
  }

  /**
   * 获取分类树（带层级结构）
   * @returns 分类树
   */
  async getCategoryTree(): Promise<AdapterCategory[]> {
    const response = await apiClient.get<ApiResponse<AdapterCategory[]>>(
      `${this.basePath}/tree`
    );
    return response.data;
  }

  /**
   * 获取单个分类详情
   * @param id - 分类 ID
   * @returns 分类详情
   */
  async getCategory(id: string): Promise<AdapterCategory> {
    const response = await apiClient.get<ApiResponse<AdapterCategory>>(
      `${this.basePath}/${id}`
    );
    return response.data;
  }

  /**
   * 根据slug获取分类
   * @param slug - 分类标识
   * @returns 分类详情
   */
  async getCategoryBySlug(slug: string): Promise<AdapterCategory> {
    const response = await apiClient.get<ApiResponse<AdapterCategory>>(
      `${this.basePath}/by-slug/${slug}`
    );
    return response.data;
  }

  /**
   * 创建分类
   * @param data - 创建分类数据
   * @returns 创建的分类
   */
  async createCategory(data: CreateCategoryInput): Promise<AdapterCategory> {
    const response = await apiClient.post<ApiResponse<AdapterCategory>>(this.basePath, data);
    return response.data;
  }

  /**
   * 更新分类
   * @param id - 分类 ID
   * @param data - 更新分类数据
   * @returns 更新后的分类
   */
  async updateCategory(id: string, data: UpdateCategoryInput): Promise<AdapterCategory> {
    const response = await apiClient.patch<ApiResponse<AdapterCategory>>(
      `${this.basePath}/${id}`,
      data
    );
    return response.data;
  }

  /**
   * 删除分类
   * @param id - 分类 ID
   * @returns 删除结果
   */
  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(`${this.basePath}/${id}`);
  }

  /**
   * 获取子分类
   * @param parentId - 父分类 ID
   * @returns 子分类列表
   */
  async getChildCategories(parentId: string): Promise<AdapterCategory[]> {
    const response = await apiClient.get<ApiResponse<AdapterCategory[]>>(
      `${this.basePath}/${parentId}/children`
    );
    return response.data;
  }

  /**
   * 获取顶级分类
   * @returns 顶级分类列表
   */
  async getRootCategories(): Promise<AdapterCategory[]> {
    const response = await apiClient.get<ApiResponse<AdapterCategory[]>>(
      `${this.basePath}/root`
    );
    return response.data;
  }

  /**
   * 更新分类排序
   * @param categoryIds - 分类ID数组（按排序顺序）
   * @returns 更新结果
   */
  async updateCategoryOrder(categoryIds: string[]): Promise<void> {
    await apiClient.post<ApiResponse<void>>(`${this.basePath}/reorder`, {
      categoryIds,
    });
  }

  /**
   * 获取热门分类
   * @param limit - 限制数量
   * @returns 热门分类列表
   */
  async getPopularCategories(limit: number = 10): Promise<AdapterCategory[]> {
    const response = await apiClient.get<ApiResponse<AdapterCategory[]>>(
      `${this.basePath}/popular`,
      { params: { limit } } as any
    );
    return response.data;
  }
}

/**
 * 适配器分类 API 客户端实例
 */
export const adapterCategoryApiClient = new AdapterCategoryApiClient();

