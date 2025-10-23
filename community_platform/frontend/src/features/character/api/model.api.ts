/**
 * 模型 API 客户端
 */

import type {
  Model,
  CreateModelInput,
  UpdateModelInput,
} from '../domain';

/**
 * API 响应基础类型
 */
interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

/**
 * 上传进度回调
 */
export type UploadProgressCallback = (progress: number) => void;

/**
 * 模型API客户端类
 */
export class ModelApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/models') {
    this.baseUrl = baseUrl;
  }

  /**
   * 获取角色的所有模型
   */
  async getModels(characterId: string): Promise<Model[]> {
    const response = await fetch(
      `${this.baseUrl}/character/${characterId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const result: ApiResponse<Model[]> = await response.json();
    return result.data;
  }

  /**
   * 获取单个模型
   */
  async getModel(id: string): Promise<Model> {
    const response = await fetch(`${this.baseUrl}/${id}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${response.statusText}`);
    }

    const result: ApiResponse<Model> = await response.json();
    return result.data;
  }

  /**
   * 创建模型配置
   */
  async createModel(input: CreateModelInput): Promise<Model> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to create model: ${response.statusText}`);
    }

    const result: ApiResponse<Model> = await response.json();
    return result.data;
  }

  /**
   * 更新模型配置
   */
  async updateModel(id: string, input: UpdateModelInput): Promise<Model> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to update model: ${response.statusText}`);
    }

    const result: ApiResponse<Model> = await response.json();
    return result.data;
  }

  /**
   * 删除模型
   */
  async deleteModel(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete model: ${response.statusText}`);
    }
  }

  /**
   * 设置默认模型
   */
  async setDefaultModel(id: string): Promise<Model> {
    const response = await fetch(`${this.baseUrl}/${id}/set-default`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to set default model: ${response.statusText}`);
    }

    const result: ApiResponse<Model> = await response.json();
    return result.data;
  }

  /**
   * 上传模型文件（带进度）
   */
  async uploadModelFile(
    file: File,
    characterId: string,
    onProgress?: UploadProgressCallback
  ): Promise<{ modelUrl: string; fileSize: number }> {
    const formData = new FormData();
    formData.append('model', file);
    formData.append('characterId', characterId);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // 监听上传进度
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        });
      }

      // 监听完成
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const result: ApiResponse<{
            modelUrl: string;
            fileSize: number;
          }> = JSON.parse(xhr.responseText);
          resolve(result.data);
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      // 监听错误
      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      // 发送请求
      xhr.open('POST', `${this.baseUrl}/upload`);
      xhr.send(formData);
    });
  }

  /**
   * 上传缩略图
   */
  async uploadThumbnail(
    id: string,
    file: File
  ): Promise<{ thumbnailUrl: string }> {
    const formData = new FormData();
    formData.append('thumbnail', file);

    const response = await fetch(`${this.baseUrl}/${id}/thumbnail`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload thumbnail: ${response.statusText}`);
    }

    const result: ApiResponse<{ thumbnailUrl: string }> =
      await response.json();
    return result.data;
  }

  /**
   * 验证模型文件
   */
  async validateModel(
    file: File
  ): Promise<{ valid: boolean; errors?: string[]; metadata?: any }> {
    const formData = new FormData();
    formData.append('model', file);

    const response = await fetch(`${this.baseUrl}/validate`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to validate model: ${response.statusText}`);
    }

    const result: ApiResponse<{
      valid: boolean;
      errors?: string[];
      metadata?: any;
    }> = await response.json();
    return result.data;
  }

  /**
   * 获取模型预览数据
   */
  async getModelPreview(id: string): Promise<{
    previewUrl: string;
    metadata: Record<string, any>;
  }> {
    const response = await fetch(`${this.baseUrl}/${id}/preview`);

    if (!response.ok) {
      throw new Error(`Failed to get model preview: ${response.statusText}`);
    }

    const result: ApiResponse<{
      previewUrl: string;
      metadata: Record<string, any>;
    }> = await response.json();
    return result.data;
  }

  /**
   * 优化模型文件
   */
  async optimizeModel(id: string): Promise<Model> {
    const response = await fetch(`${this.baseUrl}/${id}/optimize`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to optimize model: ${response.statusText}`);
    }

    const result: ApiResponse<Model> = await response.json();
    return result.data;
  }
}

// 导出单例
export const modelApi = new ModelApiClient();

