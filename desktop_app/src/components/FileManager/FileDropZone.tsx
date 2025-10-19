import React, { useCallback, useState } from 'react';
import { Upload, File, X } from 'lucide-react';
import './FileDropZone.css';

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxSize?: number; // in bytes
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFilesSelected,
  accept,
  maxSize = 100 * 1024 * 1024, // 100MB
  maxFiles = 10,
  disabled = false,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = useCallback(
    (files: FileList | File[]): { valid: File[]; errors: string[] } => {
      const fileArray = Array.from(files);
      const valid: File[] = [];
      const errors: string[] = [];

      for (const file of fileArray) {
        // 检查文件大小
        if (file.size > maxSize) {
          errors.push(
            `${file.name}: 文件过大 (最大 ${(maxSize / 1024 / 1024).toFixed(0)}MB)`
          );
          continue;
        }

        // 检查文件类型
        if (accept) {
          const acceptedTypes = accept.split(',').map((t) => t.trim());
          const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
          const mimeType = file.type;

          const isAccepted = acceptedTypes.some((type) => {
            if (type.startsWith('.')) {
              return fileExt === type.toLowerCase();
            }
            if (type.includes('*')) {
              const [mainType] = type.split('/');
              return mimeType.startsWith(mainType);
            }
            return mimeType === type;
          });

          if (!isAccepted) {
            errors.push(`${file.name}: 不支持的文件类型`);
            continue;
          }
        }

        valid.push(file);
      }

      // 检查文件数量
      if (valid.length > maxFiles) {
        errors.push(`最多只能选择 ${maxFiles} 个文件`);
        return { valid: valid.slice(0, maxFiles), errors };
      }

      return { valid, errors };
    },
    [accept, maxSize, maxFiles]
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const { valid, errors } = validateFiles(files);

      if (errors.length > 0) {
        setError(errors.join('\n'));
        setTimeout(() => setError(null), 5000);
      }

      if (valid.length > 0) {
        setSelectedFiles(valid);
        onFilesSelected(valid);
      }
    },
    [validateFiles, onFilesSelected]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [disabled, handleFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => {
      const newFiles = prev.filter((_, i) => i !== index);
      return newFiles;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedFiles([]);
    setError(null);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className={`file-drop-zone ${className}`}>
      <div
        className={`drop-area ${isDragging ? 'dragging' : ''} ${
          disabled ? 'disabled' : ''
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-input"
          multiple
          accept={accept}
          onChange={handleFileSelect}
          disabled={disabled}
          style={{ display: 'none' }}
        />

        <label htmlFor="file-input" className="drop-area-content">
          <Upload className="upload-icon" size={48} />
          <h3>拖拽文件到此处或点击选择</h3>
          <p className="drop-hint">
            {accept && <span>支持格式: {accept}</span>}
            {maxSize && (
              <span>
                最大大小: {(maxSize / 1024 / 1024).toFixed(0)}MB
              </span>
            )}
            {maxFiles && <span>最多 {maxFiles} 个文件</span>}
          </p>
        </label>
      </div>

      {error && (
        <div className="error-message">
          <X className="error-icon" size={16} />
          <span>{error}</span>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="selected-files">
          <div className="selected-files-header">
            <h4>已选择 {selectedFiles.length} 个文件</h4>
            <button
              className="clear-all-btn"
              onClick={handleClearAll}
              type="button"
            >
              清空
            </button>
          </div>

          <div className="file-list">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}-${index}`} className="file-item">
                <File className="file-icon" size={20} />
                <div className="file-info">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => handleRemoveFile(index)}
                  type="button"
                  aria-label="移除文件"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDropZone;

