/**
 * 适配器上传服务
 * 提供文件上传、分块上传、断点续传等功能
 */

import { apiClient } from '@/infrastructure/api';
import type { ApiResponse } from '../domain';

/**
 * 上传进度回调
 */
export type UploadProgressCallback = (progress: {
  loaded: number;
  total: number;
  percentage: number;
}) => void;

/**
 * 分块上传结果
 */
export interface ChunkUploadResult {
  success: boolean;
  chunkIndex: number;
  resumeToken: string;
  message?: string;
}

/**
 * 合并分块结果
 */
export interface MergeChunksResult {
  success: boolean;
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileHash: string;
}

/**
 * 上传服务类
 */
export class UploadService {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '/api/adapters/upload') {
    this.baseUrl = baseUrl;
  }

  /**
   * 普通文件上传（适用于小文件）
   */
  async uploadFile(
    file: File,
    metadata: Record<string, any> = {},
    onProgress?: UploadProgressCallback
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    
    // 添加元数据
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });

    const response = await apiClient.post<ApiResponse<any>>(
      this.baseUrl,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress({
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage,
            });
          }
        },
      }
    );

    return response.data.data;
  }

  /**
   * 初始化分块上传
   */
  async initChunkUpload(
    fileName: string,
    fileSize: number,
    chunkSize: number,
    metadata: Record<string, any> = {}
  ): Promise<{
    uploadId: string;
    resumeToken: string;
    chunkSize: number;
    totalChunks: number;
  }> {
    const response = await apiClient.post<ApiResponse<any>>(
      `${this.baseUrl}/init-chunk`,
      {
        fileName,
        fileSize,
        chunkSize,
        metadata,
      }
    );

    return response.data.data;
  }

  /**
   * 上传单个分块
   */
  async uploadChunk(
    chunkBlob: Blob,
    options: {
      uploadId: string;
      fileName: string;
      chunkIndex: number;
      totalChunks: number;
      resumeToken: string;
    },
    onProgress?: UploadProgressCallback
  ): Promise<ChunkUploadResult> {
    const formData = new FormData();
    formData.append('chunk', chunkBlob);
    formData.append('uploadId', options.uploadId);
    formData.append('fileName', options.fileName);
    formData.append('chunkIndex', options.chunkIndex.toString());
    formData.append('totalChunks', options.totalChunks.toString());
    formData.append('resumeToken', options.resumeToken);

    const response = await apiClient.post<ApiResponse<ChunkUploadResult>>(
      `${this.baseUrl}/chunk`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress({
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage,
            });
          }
        },
      }
    );

    return response.data.data;
  }

  /**
   * 合并分块
   */
  async mergeChunks(
    uploadId: string,
    fileName: string,
    totalChunks: number,
    resumeToken: string,
    metadata: Record<string, any> = {}
  ): Promise<MergeChunksResult> {
    const response = await apiClient.post<ApiResponse<MergeChunksResult>>(
      `${this.baseUrl}/merge`,
      {
        uploadId,
        fileName,
        totalChunks,
        resumeToken,
        metadata,
      }
    );

    return response.data.data;
  }

  /**
   * 查询上传状态（用于断点续传）
   */
  async getUploadStatus(uploadId: string): Promise<{
    uploadId: string;
    fileName: string;
    uploadedChunks: number[];
    totalChunks: number;
    resumeToken: string;
  }> {
    const response = await apiClient.get<ApiResponse<any>>(
      `${this.baseUrl}/status/${uploadId}`
    );

    return response.data.data;
  }

  /**
   * 取消上传
   */
  async cancelUpload(uploadId: string): Promise<void> {
    await apiClient.delete(`${this.baseUrl}/${uploadId}`);
  }

  /**
   * 完整的分块上传流程（包含断点续传）
   */
  async uploadFileInChunks(
    file: File,
    options: {
      chunkSize?: number;
      maxConcurrent?: number;
      maxRetries?: number;
      metadata?: Record<string, any>;
      onProgress?: UploadProgressCallback;
      onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
      resumeUploadId?: string;
    } = {}
  ): Promise<MergeChunksResult> {
    const {
      chunkSize = 2 * 1024 * 1024, // 2MB
      maxConcurrent = 3,
      maxRetries = 3,
      metadata = {},
      onProgress,
      onChunkComplete,
      resumeUploadId,
    } = options;

    let uploadId: string;
    let resumeToken: string;
    let uploadedChunks: number[] = [];

    // 如果是恢复上传，获取已上传的分块信息
    if (resumeUploadId) {
      const status = await this.getUploadStatus(resumeUploadId);
      uploadId = status.uploadId;
      resumeToken = status.resumeToken;
      uploadedChunks = status.uploadedChunks;
    } else {
      // 初始化新的上传
      const initResult = await this.initChunkUpload(
        file.name,
        file.size,
        chunkSize,
        metadata
      );
      uploadId = initResult.uploadId;
      resumeToken = initResult.resumeToken;
    }

    // 计算分块
    const totalChunks = Math.ceil(file.size / chunkSize);
    const chunks: Array<{ index: number; start: number; end: number }> = [];

    for (let i = 0; i < totalChunks; i++) {
      if (!uploadedChunks.includes(i)) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        chunks.push({ index: i, start, end });
      }
    }

    // 上传分块（带并发控制和重试）
    const uploadChunkWithRetry = async (
      chunk: { index: number; start: number; end: number },
      retries = 0
    ): Promise<void> => {
      try {
        const chunkBlob = file.slice(chunk.start, chunk.end);
        const result = await this.uploadChunk(
          chunkBlob,
          {
            uploadId,
            fileName: file.name,
            chunkIndex: chunk.index,
            totalChunks,
            resumeToken,
          },
          (progress) => {
            // 计算整体进度
            const chunkProgress = progress.loaded;
            const totalUploaded =
              uploadedChunks.length * chunkSize +
              chunkProgress +
              (chunk.index - uploadedChunks.length) * chunkSize;
            const percentage = Math.round((totalUploaded / file.size) * 100);

            onProgress?.({
              loaded: totalUploaded,
              total: file.size,
              percentage: Math.min(percentage, 99), // 保留1%给合并步骤
            });
          }
        );

        resumeToken = result.resumeToken;
        uploadedChunks.push(chunk.index);
        onChunkComplete?.(chunk.index, totalChunks);
      } catch (error) {
        if (retries < maxRetries) {
          // 重试
          await new Promise((resolve) => setTimeout(resolve, 1000 * (retries + 1)));
          return uploadChunkWithRetry(chunk, retries + 1);
        } else {
          throw error;
        }
      }
    };

    // 并发上传分块
    for (let i = 0; i < chunks.length; i += maxConcurrent) {
      const batch = chunks.slice(i, i + maxConcurrent);
      await Promise.all(batch.map((chunk) => uploadChunkWithRetry(chunk)));
    }

    // 合并分块
    const mergeResult = await this.mergeChunks(
      uploadId,
      file.name,
      totalChunks,
      resumeToken,
      metadata
    );

    // 更新进度为100%
    onProgress?.({
      loaded: file.size,
      total: file.size,
      percentage: 100,
    });

    return mergeResult;
  }

  /**
   * 计算文件哈希值（用于去重和验证）
   */
  async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  /**
   * 验证文件
   */
  validateFile(file: File, options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}): { valid: boolean; error?: string } {
    const { maxSize, allowedTypes, allowedExtensions } = options;

    // 检查文件大小
    if (maxSize && file.size > maxSize) {
      return {
        valid: false,
        error: `文件大小超过限制（最大 ${this.formatFileSize(maxSize)}）`,
      };
    }

    // 检查文件类型
    if (allowedTypes && allowedTypes.length > 0) {
      const isTypeAllowed = allowedTypes.some((type) => {
        if (type.includes('*')) {
          const baseType = type.split('/')[0];
          return file.type.startsWith(`${baseType}/`);
        }
        return file.type === type;
      });

      if (!isTypeAllowed) {
        return {
          valid: false,
          error: `不支持的文件类型（${file.type}）`,
        };
      }
    }

    // 检查文件扩展名
    if (allowedExtensions && allowedExtensions.length > 0) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !allowedExtensions.includes(extension)) {
        return {
          valid: false,
          error: `不支持的文件扩展名（.${extension}）`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

/**
 * 默认上传服务实例
 */
export const uploadService = new UploadService();

