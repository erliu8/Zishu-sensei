import { useState, useCallback, useEffect } from 'react';
import { fileService } from '../services/fileService';
import type {
  FileInfo,
  FileStats,
  FileUploadProgress,
  FileFilterOptions,
  FileSearchOptions,
} from '../types/file';

/**
 * 文件管理 Hook
 */
export function useFileManager(options?: FileFilterOptions) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([]);

  // 加载文件列表
  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fileService.listFiles(options);
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文件失败');
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  }, [options]);

  // 上传单个文件
  const uploadFile = useCallback(
    async (
      file: File,
      uploadOptions?: {
        conversationId?: string;
        messageId?: string;
        tags?: string;
        description?: string;
      }
    ) => {
      const progressId = `${Date.now()}-${file.name}`;
      
      setUploadProgress((prev) => [
        ...prev,
        {
          file_id: progressId,
          file_name: file.name,
          progress: 0,
          status: 'uploading',
        },
      ]);

      try {
        const result = await fileService.uploadFileObject(file, uploadOptions);
        
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.file_id === progressId
              ? { ...p, progress: 100, status: 'completed', file_id: result.file_info.id }
              : p
          )
        );

        // 刷新文件列表
        await loadFiles();

        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '上传失败';
        
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.file_id === progressId
              ? { ...p, status: 'error', error: errorMsg }
              : p
          )
        );

        throw err;
      }
    },
    [loadFiles]
  );

  // 批量上传文件
  const uploadFiles = useCallback(
    async (
      fileList: File[],
      uploadOptions?: {
        conversationId?: string;
        messageId?: string;
      }
    ) => {
      const results = [];

      for (const file of fileList) {
        try {
          const result = await uploadFile(file, uploadOptions);
          results.push(result);
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
        }
      }

      return results;
    },
    [uploadFile]
  );

  // 删除文件
  const deleteFile = useCallback(
    async (fileId: string) => {
      try {
        await fileService.deleteFile(fileId);
        await loadFiles();
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除失败');
        throw err;
      }
    },
    [loadFiles]
  );

  // 批量删除
  const batchDelete = useCallback(
    async (fileIds: string[]) => {
      try {
        await fileService.batchDelete(fileIds);
        await loadFiles();
      } catch (err) {
        setError(err instanceof Error ? err.message : '批量删除失败');
        throw err;
      }
    },
    [loadFiles]
  );

  // 搜索文件
  const searchFiles = useCallback(async (searchOptions: FileSearchOptions) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fileService.searchFiles(searchOptions);
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
      console.error('Failed to search files:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 清除上传进度
  const clearUploadProgress = useCallback(() => {
    setUploadProgress([]);
  }, []);

  // 初始加载
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return {
    files,
    loading,
    error,
    uploadProgress,
    loadFiles,
    uploadFile,
    uploadFiles,
    deleteFile,
    batchDelete,
    searchFiles,
    clearUploadProgress,
  };
}

/**
 * 文件统计 Hook
 */
export function useFileStats() {
  const [stats, setStats] = useState<FileStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fileService.getFileStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载统计失败');
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    reload: loadStats,
  };
}

/**
 * 单个文件详情 Hook
 */
export function useFileDetail(fileId: string | null) {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setFile(null);
      return;
    }

    const loadFile = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fileService.getFile(fileId);
        setFile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载文件失败');
        console.error('Failed to load file:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [fileId]);

  return {
    file,
    loading,
    error,
  };
}

