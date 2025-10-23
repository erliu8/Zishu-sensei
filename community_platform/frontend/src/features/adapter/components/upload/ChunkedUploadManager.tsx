/**
 * 分块上传管理器
 * 支持断点续传、并发上传、进度追踪
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Pause, Play, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { cn } from '@/shared/utils/cn';

/**
 * 上传状态类型
 */
export type UploadStatus = 'pending' | 'uploading' | 'paused' | 'success' | 'error' | 'cancelled';

/**
 * 分块信息
 */
export interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  size: number;
  uploaded: boolean;
  retries: number;
}

/**
 * 文件上传项
 */
export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  speed: number; // bytes per second
  chunks: ChunkInfo[];
  uploadedSize: number;
  totalSize: number;
  error?: string;
  startTime?: number;
  pausedAt?: number;
  resumeToken?: string; // 服务器返回的恢复令牌
}

/**
 * 上传配置
 */
export interface UploadConfig {
  /** 分块大小（字节）默认 2MB */
  chunkSize?: number;
  /** 最大并发上传数 */
  maxConcurrentChunks?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 是否自动开始上传 */
  autoStart?: boolean;
  /** 上传URL */
  uploadUrl?: string;
  /** 额外的请求头 */
  headers?: Record<string, string>;
  /** 上传完成回调 */
  onComplete?: (fileId: string, result: any) => void;
  /** 上传失败回调 */
  onError?: (fileId: string, error: string) => void;
}

/**
 * 分块上传管理器组件属性
 */
export interface ChunkedUploadManagerProps {
  /** 待上传文件列表 */
  files: File[];
  /** 配置选项 */
  config?: UploadConfig;
  /** 文件变更回调 */
  onFilesChange?: (files: UploadItem[]) => void;
  /** 类名 */
  className?: string;
}

const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_MAX_RETRIES = 3;

/**
 * 分块上传管理器组件
 */
export function ChunkedUploadManager({
  files,
  config = {},
  onFilesChange,
  className,
}: ChunkedUploadManagerProps) {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    maxConcurrentChunks = DEFAULT_MAX_CONCURRENT,
    maxRetries = DEFAULT_MAX_RETRIES,
    autoStart = true,
    uploadUrl = '/api/upload/chunk',
    headers = {},
    onComplete,
    onError,
  } = config;

  const [uploadItems, setUploadItems] = useState<Map<string, UploadItem>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const speedUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 初始化文件上传项
   */
  const initializeUploadItems = useCallback(() => {
    const newItems = new Map<string, UploadItem>();

    files.forEach((file) => {
      const fileId = `${file.name}-${file.size}-${Date.now()}`;
      const totalChunks = Math.ceil(file.size / chunkSize);
      const chunks: ChunkInfo[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        chunks.push({
          index: i,
          start,
          end,
          size: end - start,
          uploaded: false,
          retries: 0,
        });
      }

      newItems.set(fileId, {
        id: fileId,
        file,
        status: 'pending',
        progress: 0,
        speed: 0,
        chunks,
        uploadedSize: 0,
        totalSize: file.size,
      });
    });

    setUploadItems(newItems);
    return newItems;
  }, [files, chunkSize]);

  /**
   * 上传单个分块
   */
  const uploadChunk = useCallback(
    async (fileId: string, chunk: ChunkInfo): Promise<boolean> => {
      const item = uploadItems.get(fileId);
      if (!item) return false;

      const controller = new AbortController();
      abortControllersRef.current.set(`${fileId}-${chunk.index}`, controller);

      try {
        const chunkBlob = item.file.slice(chunk.start, chunk.end);
        const formData = new FormData();
        formData.append('file', chunkBlob);
        formData.append('fileId', fileId);
        formData.append('fileName', item.file.name);
        formData.append('chunkIndex', chunk.index.toString());
        formData.append('totalChunks', item.chunks.length.toString());
        formData.append('chunkSize', chunk.size.toString());
        formData.append('totalSize', item.totalSize.toString());

        if (item.resumeToken) {
          formData.append('resumeToken', item.resumeToken);
        }

        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers,
          body: formData,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();

        // 更新分块状态
        setUploadItems((prev) => {
          const newMap = new Map(prev);
          const currentItem = newMap.get(fileId);
          if (currentItem) {
            const updatedChunks = [...currentItem.chunks];
            updatedChunks[chunk.index] = { ...chunk, uploaded: true };
            const uploadedSize = updatedChunks.reduce(
              (sum, c) => sum + (c.uploaded ? c.size : 0),
              0
            );
            const progress = Math.round((uploadedSize / currentItem.totalSize) * 100);

            newMap.set(fileId, {
              ...currentItem,
              chunks: updatedChunks,
              uploadedSize,
              progress,
              resumeToken: result.resumeToken,
            });
          }
          return newMap;
        });

        abortControllersRef.current.delete(`${fileId}-${chunk.index}`);
        return true;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return false;
        }

        // 增加重试次数
        setUploadItems((prev) => {
          const newMap = new Map(prev);
          const currentItem = newMap.get(fileId);
          if (currentItem) {
            const updatedChunks = [...currentItem.chunks];
            updatedChunks[chunk.index] = {
              ...chunk,
              retries: chunk.retries + 1,
            };
            newMap.set(fileId, { ...currentItem, chunks: updatedChunks });
          }
          return newMap;
        });

        if (chunk.retries >= maxRetries) {
          throw error;
        }

        // 重试
        return uploadChunk(fileId, { ...chunk, retries: chunk.retries + 1 });
      }
    },
    [uploadItems, uploadUrl, headers, maxRetries]
  );

  /**
   * 上传文件
   */
  const uploadFile = useCallback(
    async (fileId: string) => {
      const item = uploadItems.get(fileId);
      if (!item) return;

      setUploadItems((prev) => {
        const newMap = new Map(prev);
        const currentItem = newMap.get(fileId);
        if (currentItem) {
          newMap.set(fileId, {
            ...currentItem,
            status: 'uploading',
            startTime: Date.now(),
          });
        }
        return newMap;
      });

      try {
        // 找出未上传的分块
        const pendingChunks = item.chunks.filter((c) => !c.uploaded);

        // 并发上传分块
        for (let i = 0; i < pendingChunks.length; i += maxConcurrentChunks) {
          const batch = pendingChunks.slice(i, i + maxConcurrentChunks);
          await Promise.all(
            batch.map((chunk) => uploadChunk(fileId, chunk))
          );
        }

        // 通知服务器合并分块
        const mergeResponse = await fetch(`${uploadUrl}/merge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            fileId,
            fileName: item.file.name,
            totalChunks: item.chunks.length,
            totalSize: item.totalSize,
            resumeToken: item.resumeToken,
          }),
        });

        if (!mergeResponse.ok) {
          throw new Error('Failed to merge chunks');
        }

        const result = await mergeResponse.json();

        setUploadItems((prev) => {
          const newMap = new Map(prev);
          newMap.set(fileId, {
            ...prev.get(fileId)!,
            status: 'success',
            progress: 100,
          });
          return newMap;
        });

        onComplete?.(fileId, result);
      } catch (error: any) {
        const errorMessage = error.message || 'Upload failed';

        setUploadItems((prev) => {
          const newMap = new Map(prev);
          const currentItem = newMap.get(fileId);
          if (currentItem) {
            newMap.set(fileId, {
              ...currentItem,
              status: 'error',
              error: errorMessage,
            });
          }
          return newMap;
        });

        onError?.(fileId, errorMessage);
      }
    },
    [uploadItems, uploadUrl, headers, maxConcurrentChunks, uploadChunk, onComplete, onError]
  );

  /**
   * 暂停上传
   */
  const pauseUpload = useCallback((fileId: string) => {
    // 取消所有正在进行的请求
    abortControllersRef.current.forEach((controller, key) => {
      if (key.startsWith(fileId)) {
        controller.abort();
      }
    });

    setUploadItems((prev) => {
      const newMap = new Map(prev);
      const item = newMap.get(fileId);
      if (item) {
        newMap.set(fileId, {
          ...item,
          status: 'paused',
          pausedAt: Date.now(),
        });
      }
      return newMap;
    });
  }, []);

  /**
   * 恢复上传
   */
  const resumeUpload = useCallback(
    (fileId: string) => {
      setUploadItems((prev) => {
        const newMap = new Map(prev);
        const item = newMap.get(fileId);
        if (item && item.status === 'paused') {
          newMap.set(fileId, {
            ...item,
            status: 'pending',
          });
        }
        return newMap;
      });

      uploadFile(fileId);
    },
    [uploadFile]
  );

  /**
   * 取消上传
   */
  const cancelUpload = useCallback((fileId: string) => {
    // 取消所有请求
    abortControllersRef.current.forEach((controller, key) => {
      if (key.startsWith(fileId)) {
        controller.abort();
      }
    });

    setUploadItems((prev) => {
      const newMap = new Map(prev);
      const item = newMap.get(fileId);
      if (item) {
        newMap.set(fileId, {
          ...item,
          status: 'cancelled',
        });
      }
      return newMap;
    });
  }, []);

  /**
   * 重试上传
   */
  const retryUpload = useCallback(
    (fileId: string) => {
      const item = uploadItems.get(fileId);
      if (!item) return;

      // 重置失败的分块
      const resetChunks = item.chunks.map((chunk) =>
        chunk.uploaded ? chunk : { ...chunk, retries: 0 }
      );

      setUploadItems((prev) => {
        const newMap = new Map(prev);
        newMap.set(fileId, {
          ...item,
          status: 'pending',
          chunks: resetChunks,
          error: undefined,
        });
        return newMap;
      });

      uploadFile(fileId);
    },
    [uploadItems, uploadFile]
  );

  /**
   * 删除文件
   */
  const removeFile = useCallback((fileId: string) => {
    cancelUpload(fileId);
    setUploadItems((prev) => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
  }, [cancelUpload]);

  /**
   * 计算上传速度
   */
  useEffect(() => {
    const lastSizes = new Map<string, number>();

    speedUpdateIntervalRef.current = setInterval(() => {
      setUploadItems((prev) => {
        const newMap = new Map(prev);
        let hasChanges = false;

        newMap.forEach((item, fileId) => {
          if (item.status === 'uploading') {
            const lastSize = lastSizes.get(fileId) || 0;
            const currentSize = item.uploadedSize;
            const speed = currentSize - lastSize; // bytes per second

            if (speed !== item.speed) {
              newMap.set(fileId, { ...item, speed });
              hasChanges = true;
            }

            lastSizes.set(fileId, currentSize);
          }
        });

        return hasChanges ? newMap : prev;
      });
    }, 1000);

    return () => {
      if (speedUpdateIntervalRef.current) {
        clearInterval(speedUpdateIntervalRef.current);
      }
    };
  }, []);

  /**
   * 初始化上传项
   */
  useEffect(() => {
    const items = initializeUploadItems();

    if (autoStart) {
      items.forEach((_, fileId) => {
        uploadFile(fileId);
      });
    }
  }, [files, initializeUploadItems, autoStart, uploadFile]);

  /**
   * 通知父组件
   */
  useEffect(() => {
    onFilesChange?.(Array.from(uploadItems.values()));
  }, [uploadItems, onFilesChange]);

  return (
    <div className={cn('space-y-4', className)}>
      {Array.from(uploadItems.values()).map((item) => (
        <UploadItemCard
          key={item.id}
          item={item}
          onPause={() => pauseUpload(item.id)}
          onResume={() => resumeUpload(item.id)}
          onCancel={() => cancelUpload(item.id)}
          onRetry={() => retryUpload(item.id)}
          onRemove={() => removeFile(item.id)}
        />
      ))}
    </div>
  );
}

/**
 * 上传项卡片属性
 */
interface UploadItemCardProps {
  item: UploadItem;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}

/**
 * 上传项卡片组件
 */
function UploadItemCard({
  item,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
}: UploadItemCardProps) {
  const getStatusIcon = () => {
    switch (item.status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'uploading':
        return <Upload className="h-5 w-5 text-primary animate-pulse" />;
      case 'paused':
        return <Pause className="h-5 w-5 text-yellow-500" />;
      default:
        return <Upload className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = () => {
    const variants: Record<UploadStatus, { variant: any; label: string }> = {
      pending: { variant: 'secondary', label: '待上传' },
      uploading: { variant: 'default', label: '上传中' },
      paused: { variant: 'outline', label: '已暂停' },
      success: { variant: 'success', label: '已完成' },
      error: { variant: 'destructive', label: '失败' },
      cancelled: { variant: 'secondary', label: '已取消' },
    };

    const config = variants[item.status];
    return <Badge variant={config.variant as any}>{config.label}</Badge>;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '--';
    const kb = bytesPerSecond / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB/s`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB/s`;
  };

  const formatSize = (bytes: number): string => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(1)} GB`;
  };

  const estimatedTime = item.speed > 0
    ? Math.ceil((item.totalSize - item.uploadedSize) / item.speed)
    : 0;

  const formatTime = (seconds: number): string => {
    if (seconds === 0) return '--';
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    return `${hours}小时${minutes % 60}分钟`;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {getStatusIcon()}

          <div className="flex-1 min-w-0">
            {/* 文件名和状态 */}
            <div className="flex items-center gap-2 mb-2">
              <p className="font-medium truncate">{item.file.name}</p>
              {getStatusBadge()}
            </div>

            {/* 进度条 */}
            <Progress value={item.progress} className="h-2 mb-2" />

            {/* 上传信息 */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                {formatSize(item.uploadedSize)} / {formatSize(item.totalSize)}
              </span>
              {item.status === 'uploading' && (
                <>
                  <span>{formatSpeed(item.speed)}</span>
                  <span>剩余 {formatTime(estimatedTime)}</span>
                </>
              )}
              <span>{item.progress}%</span>
            </div>

            {/* 错误信息 */}
            {item.error && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription className="text-sm">{item.error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {item.status === 'uploading' && (
              <>
                <Button variant="ghost" size="icon-sm" onClick={onPause}>
                  <Pause className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={onCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}

            {item.status === 'paused' && (
              <>
                <Button variant="ghost" size="icon-sm" onClick={onResume}>
                  <Play className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={onCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}

            {item.status === 'error' && (
              <>
                <Button variant="ghost" size="icon-sm" onClick={onRetry}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={onRemove}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}

            {(item.status === 'success' || item.status === 'cancelled') && (
              <Button variant="ghost" size="icon-sm" onClick={onRemove}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

