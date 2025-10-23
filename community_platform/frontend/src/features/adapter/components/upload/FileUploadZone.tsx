/**
 * 文件上传区组件
 * 支持拖拽上传、文件验证、进度显示
 */

'use client';

import React, { useCallback, useState } from 'react';
import { Upload, File as FileIcon, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

export interface FileItem {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export interface FileUploadZoneProps {
  /** 接受的文件类型 */
  accept?: string;
  /** 最大文件大小（字节） */
  maxSize?: number;
  /** 最大文件数量 */
  maxFiles?: number;
  /** 是否允许多文件上传 */
  multiple?: boolean;
  /** 文件列表 */
  files: FileItem[];
  /** 文件变更回调 */
  onFilesChange: (files: FileItem[]) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 提示文本 */
  helperText?: string;
  /** 错误提示 */
  error?: string;
  /** 类名 */
  className?: string;
}

export function FileUploadZone({
  accept,
  maxSize = 100 * 1024 * 1024, // 默认100MB
  maxFiles = 10,
  multiple = true,
  files,
  onFilesChange,
  disabled = false,
  helperText,
  error,
  className,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      // 检查文件大小
      if (maxSize && file.size > maxSize) {
        return `文件大小超过限制（${formatFileSize(maxSize)}）`;
      }

      // 检查文件类型
      if (accept) {
        const acceptedTypes = accept.split(',').map((t) => t.trim());
        const fileExtension = `.${file.name.split('.').pop()}`;
        const isAccepted = acceptedTypes.some(
          (type) =>
            type === fileExtension ||
            file.type.match(type.replace('*', '.*'))
        );
        if (!isAccepted) {
          return `不支持的文件类型（${file.name}）`;
        }
      }

      return null;
    },
    [accept, maxSize]
  );

  const handleFiles = useCallback(
    (newFiles: File[]) => {
      if (disabled) return;

      // 检查文件数量限制
      const remainingSlots = maxFiles - files.length;
      if (remainingSlots <= 0) {
        return;
      }

      const filesToAdd = newFiles.slice(0, remainingSlots);
      const validatedFiles: FileItem[] = [];

      filesToAdd.forEach((file) => {
        const error = validateFile(file);
        validatedFiles.push({
          file,
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          status: error ? 'error' : 'pending',
          progress: 0,
          error: error || undefined,
        });
      });

      onFilesChange([...files, ...validatedFiles]);
    },
    [disabled, files, maxFiles, onFilesChange, validateFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      handleFiles(droppedFiles);
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      handleFiles(selectedFiles);
      // 重置input，允许重复选择同一文件
      e.target.value = '';
    },
    [handleFiles]
  );

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      onFilesChange(files.filter((f) => f.id !== fileId));
    },
    [files, onFilesChange]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* 上传区域 */}
      <div
        className={cn(
          'relative rounded-lg border-2 border-dashed transition-colors',
          isDragging && 'border-primary bg-primary/5',
          !isDragging && 'border-muted-foreground/25 hover:border-muted-foreground/50',
          disabled && 'cursor-not-allowed opacity-50',
          error && 'border-destructive'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div
            className={cn(
              'mb-4 rounded-full p-4',
              isDragging ? 'bg-primary/10' : 'bg-muted'
            )}
          >
            <Upload
              className={cn(
                'h-8 w-8',
                isDragging ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>

          <h3 className="mb-2 text-lg font-semibold">
            {isDragging ? '松开以上传文件' : '拖拽文件到此处上传'}
          </h3>

          <p className="mb-4 text-sm text-muted-foreground">
            {helperText ||
              `支持 ${multiple ? '多个' : '单个'}文件上传${
                maxSize ? `，单个文件最大 ${formatFileSize(maxSize)}` : ''
              }`}
          </p>

          <Button
            type="button"
            variant="outline"
            onClick={handleBrowseClick}
            disabled={disabled || files.length >= maxFiles}
          >
            浏览文件
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={accept}
            multiple={multiple}
            onChange={handleFileInputChange}
            disabled={disabled}
          />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              已选择文件 ({files.length}/{maxFiles})
            </h4>
          </div>

          <div className="space-y-2">
            {files.map((fileItem) => (
              <FileUploadItem
                key={fileItem.id}
                fileItem={fileItem}
                onRemove={handleRemoveFile}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface FileUploadItemProps {
  fileItem: FileItem;
  onRemove: (fileId: string) => void;
  disabled?: boolean;
}

function FileUploadItem({ fileItem, onRemove, disabled }: FileUploadItemProps) {
  const { file, id, status, progress, error } = fileItem;

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <FileIcon className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        status === 'error' && 'border-destructive bg-destructive/5',
        status === 'success' && 'border-success bg-success/5'
      )}
    >
      {getStatusIcon()}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatFileSize(file.size)}
          </span>
        </div>

        {status === 'uploading' && (
          <Progress value={progress} className="mt-2 h-1" />
        )}

        {status === 'error' && error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onRemove(id)}
        disabled={disabled || status === 'uploading'}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

