import { invoke } from '@tauri-apps/api/tauri';
import type {
  FileInfo,
  FileHistory,
  FileStats,
  UploadFileRequest,
  UploadFileResponse,
  BatchDeleteRequest,
  FileFilterOptions,
  FileSearchOptions,
} from '../types/file';

/**
 * 文件管理服务
 */
class FileService {
  /**
   * 上传文件
   */
  async uploadFile(
    fileName: string,
    fileData: Uint8Array,
    options?: {
      conversationId?: string;
      messageId?: string;
      tags?: string;
      description?: string;
    }
  ): Promise<UploadFileResponse> {
    const request: UploadFileRequest = {
      file_name: fileName,
      file_data: Array.from(fileData),
      conversation_id: options?.conversationId,
      message_id: options?.messageId,
      tags: options?.tags,
      description: options?.description,
    };

    return invoke<UploadFileResponse>('upload_file', { request });
  }

  /**
   * 从文件对象上传
   */
  async uploadFileObject(
    file: File,
    options?: {
      conversationId?: string;
      messageId?: string;
      tags?: string;
      description?: string;
    }
  ): Promise<UploadFileResponse> {
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    return this.uploadFile(file.name, uint8Array, options);
  }

  /**
   * 批量上传文件
   */
  async uploadFiles(
    files: File[],
    options?: {
      conversationId?: string;
      messageId?: string;
      onProgress?: (fileName: string, progress: number) => void;
    }
  ): Promise<UploadFileResponse[]> {
    const results: UploadFileResponse[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      options?.onProgress?.(file.name, (i / files.length) * 100);

      try {
        const result = await this.uploadFileObject(file, {
          conversationId: options?.conversationId,
          messageId: options?.messageId,
        });
        results.push(result);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        throw error;
      }
    }

    options?.onProgress?.('', 100);
    return results;
  }

  /**
   * 获取文件信息
   */
  async getFile(fileId: string): Promise<FileInfo> {
    return invoke<FileInfo>('get_file', { fileId });
  }

  /**
   * 读取文件内容
   */
  async readFileContent(fileId: string): Promise<Uint8Array> {
    const data = await invoke<number[]>('read_file_content', { fileId });
    return new Uint8Array(data);
  }

  /**
   * 列出文件
   */
  async listFiles(options?: FileFilterOptions): Promise<FileInfo[]> {
    return invoke<FileInfo[]>('list_files_by_filter', {
      conversationId: options?.conversation_id,
      fileType: options?.file_type,
      limit: options?.limit,
      offset: options?.offset,
    });
  }

  /**
   * 更新文件信息
   */
  async updateFile(fileInfo: FileInfo): Promise<void> {
    return invoke('update_file', { fileInfo });
  }

  /**
   * 删除文件（软删除）
   */
  async deleteFile(fileId: string): Promise<void> {
    return invoke('delete_file', { fileId });
  }

  /**
   * 永久删除文件
   */
  async deleteFilePermanent(fileId: string): Promise<void> {
    return invoke('delete_file_permanent', { fileId });
  }

  /**
   * 批量删除文件
   */
  async batchDelete(fileIds: string[]): Promise<number> {
    const request: BatchDeleteRequest = { file_ids: fileIds };
    return invoke<number>('batch_delete', { request });
  }

  /**
   * 获取文件历史
   */
  async getFileHistory(fileId: string): Promise<FileHistory[]> {
    return invoke<FileHistory[]>('get_file_history_records', { fileId });
  }

  /**
   * 获取文件统计
   */
  async getFileStats(): Promise<FileStats> {
    return invoke<FileStats>('get_file_statistics');
  }

  /**
   * 搜索文件
   */
  async searchFiles(options: FileSearchOptions): Promise<FileInfo[]> {
    return invoke<FileInfo[]>('search_files_by_keyword', {
      keyword: options.keyword,
      fileType: options.file_type,
    });
  }

  /**
   * 清理旧文件
   */
  async cleanupOldFiles(days: number): Promise<number> {
    return invoke<number>('cleanup_old_files', { days });
  }

  /**
   * 导出文件
   */
  async exportFile(fileId: string, destination: string): Promise<string> {
    return invoke<string>('export_file', { fileId, destination });
  }

  /**
   * 复制文件
   */
  async copyFile(
    fileId: string,
    newConversationId?: string
  ): Promise<FileInfo> {
    return invoke<FileInfo>('copy_file', {
      fileId,
      newConversationId,
    });
  }

  /**
   * 获取文件 URL
   */
  async getFileUrl(fileId: string): Promise<string> {
    return invoke<string>('get_file_url', { fileId });
  }

  /**
   * 下载文件为 Blob
   */
  async downloadFileAsBlob(fileId: string): Promise<Blob> {
    const fileInfo = await this.getFile(fileId);
    const content = await this.readFileContent(fileId);
    return new Blob([content as BlobPart], { type: fileInfo.mime_type });
  }

  /**
   * 触发浏览器下载
   */
  async downloadFile(fileId: string): Promise<void> {
    const fileInfo = await this.getFile(fileId);
    const blob = await this.downloadFileAsBlob(fileId);
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileInfo.original_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 预览文件（在新窗口打开）
   */
  async previewFile(fileId: string): Promise<void> {
    const blob = await this.downloadFileAsBlob(fileId);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  /**
   * 获取文件的 Data URL（用于内联显示）
   */
  async getFileDataUrl(fileId: string): Promise<string> {
    const fileInfo = await this.getFile(fileId);
    const content = await this.readFileContent(fileId);
    
    // 转换为 base64
    const base64 = btoa(
      String.fromCharCode.apply(null, Array.from(content))
    );
    
    return `data:${fileInfo.mime_type};base64,${base64}`;
  }
}

export const fileService = new FileService();
export default fileService;

