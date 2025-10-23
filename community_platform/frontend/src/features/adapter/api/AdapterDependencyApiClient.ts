/**
 * 适配器依赖 API 客户端
 * @module features/adapter/api
 */

import { apiClient } from '@/infrastructure/api';
import type { AdapterDependency, ApiResponse } from '../domain';

/**
 * 依赖树节点
 */
export interface DependencyTreeNode {
  /** 适配器ID */
  adapterId: string;
  /** 适配器名称 */
  adapterName: string;
  /** 版本要求 */
  versionRequirement: string;
  /** 是否必需 */
  required: boolean;
  /** 依赖类型 */
  type: 'runtime' | 'development' | 'peer' | 'optional';
  /** 子依赖 */
  children: DependencyTreeNode[];
  /** 是否有循环依赖 */
  circular?: boolean;
  /** 是否已安装 */
  installed?: boolean;
  /** 已安装版本 */
  installedVersion?: string;
}

/**
 * 依赖检查结果
 */
export interface DependencyCheckResult {
  /** 是否满足所有依赖 */
  satisfied: boolean;
  /** 缺失的依赖 */
  missing: AdapterDependency[];
  /** 版本不兼容的依赖 */
  incompatible: Array<{
    dependency: AdapterDependency;
    currentVersion: string;
    reason: string;
  }>;
  /** 循环依赖 */
  circular: string[][];
  /** 警告信息 */
  warnings: string[];
}

/**
 * 适配器依赖 API 客户端类
 */
export class AdapterDependencyApiClient {
  private readonly basePath = '/adapters';

  /**
   * 获取适配器的依赖列表
   * @param adapterId - 适配器 ID
   * @param versionId - 版本 ID（可选）
   * @returns 依赖列表
   */
  async getDependencies(
    adapterId: string,
    versionId?: string
  ): Promise<AdapterDependency[]> {
    const params = versionId ? { versionId } : undefined;
    const response = await apiClient.get<ApiResponse<AdapterDependency[]>>(
      `${this.basePath}/${adapterId}/dependencies`,
      { params }
    );
    return response.data.data;
  }

  /**
   * 获取依赖树
   * @param adapterId - 适配器 ID
   * @param versionId - 版本 ID（可选）
   * @param depth - 深度限制（默认为-1表示无限制）
   * @returns 依赖树
   */
  async getDependencyTree(
    adapterId: string,
    versionId?: string,
    depth: number = -1
  ): Promise<DependencyTreeNode> {
    const params = {
      ...(versionId && { versionId }),
      ...(depth >= 0 && { depth }),
    };
    const response = await apiClient.get<ApiResponse<DependencyTreeNode>>(
      `${this.basePath}/${adapterId}/dependencies/tree`,
      { params }
    );
    return response.data.data;
  }

  /**
   * 获取反向依赖（哪些适配器依赖于当前适配器）
   * @param adapterId - 适配器 ID
   * @returns 反向依赖列表
   */
  async getReverseDependencies(adapterId: string): Promise<
    Array<{
      adapterId: string;
      adapterName: string;
      versionRequirement: string;
    }>
  > {
    const response = await apiClient.get<
      ApiResponse<
        Array<{
          adapterId: string;
          adapterName: string;
          versionRequirement: string;
        }>
      >
    >(`${this.basePath}/${adapterId}/dependencies/reverse`);
    return response.data.data;
  }

  /**
   * 检查依赖是否满足
   * @param adapterId - 适配器 ID
   * @param versionId - 版本 ID（可选）
   * @returns 依赖检查结果
   */
  async checkDependencies(
    adapterId: string,
    versionId?: string
  ): Promise<DependencyCheckResult> {
    const params = versionId ? { versionId } : undefined;
    const response = await apiClient.get<ApiResponse<DependencyCheckResult>>(
      `${this.basePath}/${adapterId}/dependencies/check`,
      { params }
    );
    return response.data.data;
  }

  /**
   * 解析依赖冲突
   * @param adapterIds - 适配器ID列表
   * @returns 冲突解析结果
   */
  async resolveDependencyConflicts(adapterIds: string[]): Promise<{
    resolvable: boolean;
    resolution?: Record<string, string>; // adapterId -> versionId
    conflicts: Array<{
      adapterId: string;
      adapterName: string;
      conflictingVersions: string[];
      reason: string;
    }>;
  }> {
    const response = await apiClient.post<
      ApiResponse<{
        resolvable: boolean;
        resolution?: Record<string, string>;
        conflicts: Array<{
          adapterId: string;
          adapterName: string;
          conflictingVersions: string[];
          reason: string;
        }>;
      }>
    >(`${this.basePath}/dependencies/resolve`, { adapterIds });
    return response.data.data;
  }

  /**
   * 添加依赖
   * @param adapterId - 适配器 ID
   * @param dependency - 依赖信息
   * @returns 添加的依赖
   */
  async addDependency(
    adapterId: string,
    dependency: {
      dependencyId: string;
      versionRequirement: string;
      required: boolean;
      type: 'runtime' | 'development' | 'peer' | 'optional';
      description?: string;
    }
  ): Promise<AdapterDependency> {
    const response = await apiClient.post<ApiResponse<AdapterDependency>>(
      `${this.basePath}/${adapterId}/dependencies`,
      dependency
    );
    return response.data.data;
  }

  /**
   * 更新依赖
   * @param adapterId - 适配器 ID
   * @param dependencyId - 依赖 ID
   * @param data - 更新数据
   * @returns 更新后的依赖
   */
  async updateDependency(
    adapterId: string,
    dependencyId: string,
    data: {
      versionRequirement?: string;
      required?: boolean;
      type?: 'runtime' | 'development' | 'peer' | 'optional';
      description?: string;
    }
  ): Promise<AdapterDependency> {
    const response = await apiClient.patch<ApiResponse<AdapterDependency>>(
      `${this.basePath}/${adapterId}/dependencies/${dependencyId}`,
      data
    );
    return response.data.data;
  }

  /**
   * 删除依赖
   * @param adapterId - 适配器 ID
   * @param dependencyId - 依赖 ID
   * @returns 删除结果
   */
  async removeDependency(adapterId: string, dependencyId: string): Promise<void> {
    await apiClient.delete<ApiResponse<void>>(
      `${this.basePath}/${adapterId}/dependencies/${dependencyId}`
    );
  }

  /**
   * 批量添加依赖
   * @param adapterId - 适配器 ID
   * @param dependencies - 依赖列表
   * @returns 添加的依赖列表
   */
  async addDependencies(
    adapterId: string,
    dependencies: Array<{
      dependencyId: string;
      versionRequirement: string;
      required: boolean;
      type: 'runtime' | 'development' | 'peer' | 'optional';
      description?: string;
    }>
  ): Promise<AdapterDependency[]> {
    const response = await apiClient.post<ApiResponse<AdapterDependency[]>>(
      `${this.basePath}/${adapterId}/dependencies/batch`,
      { dependencies }
    );
    return response.data.data;
  }

  /**
   * 获取建议的依赖版本
   * @param adapterId - 适配器 ID
   * @param dependencyId - 依赖适配器 ID
   * @returns 建议的版本
   */
  async getSuggestedVersion(adapterId: string, dependencyId: string): Promise<string> {
    const response = await apiClient.get<ApiResponse<{ version: string }>>(
      `${this.basePath}/${adapterId}/dependencies/${dependencyId}/suggested-version`
    );
    return response.data.data.version;
  }
}

/**
 * 适配器依赖 API 客户端实例
 */
export const adapterDependencyApiClient = new AdapterDependencyApiClient();

