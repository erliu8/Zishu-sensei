/**
 * 文件上传区域组件
 * 
 * 功能：
 * - 拖拽上传文件
 * - 粘贴上传图片
 * - 文件预览
 * - 多文件支持
 * - 文件类型验证
 * - 文件大小限制
 * - 上传进度显示
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { 
  Upload, 
  X, 
  File, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music,
  FileArchive,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import clsx from 'clsx'
import styles from './FileUploadZone.module.css'

// ==================== 类型定义 ====================

export interface UploadedFile {
  /** 文件唯一 ID */
  id: string
  /** 文件对象 */
  file: File
  /** 预览 URL（用于图片） */
  preview?: string
  /** 上传进度 0-100 */
  progress: number
  /** 上传状态 */
  status: 'pending' | 'uploading' | 'success' | 'error'
  /** 错误信息 */
  error?: string
}

export interface FileUploadZoneProps {
  /** 已上传的文件列表 */
  files: UploadedFile[]
  /** 文件变化回调 */
  onFilesChange: (files: UploadedFile[]) => void
  /** 文件上传回调（返回上传后的 URL） */
  onUpload?: (file: File) => Promise<string>
  /** 允许的文件类型 */
  accept?: string[]
  /** 最大文件大小（字节） */
  maxSize?: number
  /** 最大文件数量 */
  maxFiles?: number
  /** 是否支持多文件 */
  multiple?: boolean
  /** 是否显示上传区域 */
  showDropzone?: boolean
  /** 是否启用粘贴上传 */
  enablePaste?: boolean
  /** 自定义类名 */
  className?: string
  /** 是否禁用 */
  disabled?: boolean
}

// ==================== 工具函数 ====================

/**
 * 生成唯一 ID
 */
const generateId = (): string => {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * 获取文件图标
 */
const getFileIcon = (file: File): React.ReactNode => {
  const type = file.type.split('/')[0]
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (type === 'image') return <ImageIcon size={20} />
  if (type === 'video') return <Video size={20} />
  if (type === 'audio') return <Music size={20} />
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension || '')) {
    return <FileArchive size={20} />
  }
  if (['txt', 'md', 'doc', 'docx', 'pdf'].includes(extension || '')) {
    return <FileText size={20} />
  }
  return <File size={20} />
}

/**
 * 检查是否为图片
 */
const isImage = (file: File): boolean => {
  return file.type.startsWith('image/')
}

// ==================== 主组件 ====================

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  files,
  onFilesChange,
  onUpload,
  accept = ['*'],
  maxSize = 10 * 1024 * 1024, // 默认 10MB
  maxFiles = 5,
  multiple = true,
  showDropzone = true,
  enablePaste = true,
  className,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // ==================== 文件处理 ====================

  /**
   * 添加文件
   */
  const addFiles = useCallback(async (newFiles: File[]) => {
    if (disabled) return

    // 检查文件数量限制
    if (!multiple && newFiles.length > 1) {
      newFiles = [newFiles[0]]
    }

    const remainingSlots = maxFiles - files.length
    if (remainingSlots <= 0) {
      console.warn(`已达到最大文件数量限制: ${maxFiles}`)
      return
    }

    if (newFiles.length > remainingSlots) {
      newFiles = newFiles.slice(0, remainingSlots)
    }

    // 验证并创建文件对象
    const validFiles: UploadedFile[] = []
    
    for (const file of newFiles) {
      // 检查文件大小
      if (file.size > maxSize) {
        console.warn(`文件 ${file.name} 超过大小限制: ${formatFileSize(maxSize)}`)
        continue
      }

      // 检查文件类型
      if (accept.length > 0 && !accept.includes('*')) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase()
        const fileType = file.type
        const isAccepted = accept.some(pattern => {
          if (pattern.startsWith('.')) {
            return pattern === `.${fileExtension}`
          }
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace('*', '.*'))
            return regex.test(fileType)
          }
          return pattern === fileType
        })

        if (!isAccepted) {
          console.warn(`文件类型 ${file.type} 不被接受`)
          continue
        }
      }

      // 创建预览（仅图片）
      let preview: string | undefined
      if (isImage(file)) {
        preview = URL.createObjectURL(file)
      }

      validFiles.push({
        id: generateId(),
        file,
        preview,
        progress: 0,
        status: 'pending',
      })
    }

    if (validFiles.length === 0) return

    // 更新文件列表
    const updatedFiles = [...files, ...validFiles]
    onFilesChange(updatedFiles)

    // 开始上传
    if (onUpload) {
      for (const uploadedFile of validFiles) {
        uploadFile(uploadedFile)
      }
    }
  }, [files, onFilesChange, onUpload, disabled, maxSize, maxFiles, multiple, accept])

  /**
   * 上传单个文件
   */
  const uploadFile = async (uploadedFile: UploadedFile) => {
    if (!onUpload) return

    // 更新状态为上传中
    updateFileStatus(uploadedFile.id, { status: 'uploading', progress: 0 })

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        updateFileStatus(uploadedFile.id, (prev) => ({
          progress: Math.min(prev.progress + 10, 90)
        }))
      }, 200)

      // 执行上传
      const url = await onUpload(uploadedFile.file)

      clearInterval(progressInterval)

      // 上传成功
      updateFileStatus(uploadedFile.id, {
        status: 'success',
        progress: 100,
      })
    } catch (error) {
      // 上传失败
      updateFileStatus(uploadedFile.id, {
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : '上传失败',
      })
    }
  }

  /**
   * 更新文件状态
   */
  const updateFileStatus = (
    fileId: string,
    updates: Partial<UploadedFile> | ((prev: UploadedFile) => Partial<UploadedFile>)
  ) => {
    onFilesChange(
      files.map(f => {
        if (f.id === fileId) {
          const updateObj = typeof updates === 'function' ? updates(f) : updates
          return { ...f, ...updateObj }
        }
        return f
      })
    )
  }

  /**
   * 移除文件
   */
  const removeFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (file?.preview) {
      URL.revokeObjectURL(file.preview)
    }
    onFilesChange(files.filter(f => f.id !== fileId))
  }

  // ==================== 拖拽处理 ====================

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsDragging(false)
    addFiles(acceptedFiles)
  }, [addFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.length > 0 && !accept.includes('*')
      ? accept.reduce((acc, type) => ({ ...acc, [type]: [] }), {})
      : undefined,
    maxSize,
    multiple,
    disabled,
    noClick: files.length >= maxFiles,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  })

  // ==================== 粘贴处理 ====================

  useEffect(() => {
    if (!enablePaste || disabled) return

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        await addFiles(files)
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('paste', handlePaste as any)
      return () => {
        container.removeEventListener('paste', handlePaste as any)
      }
    }
  }, [enablePaste, disabled, addFiles])

  // ==================== 清理预览 ====================

  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview)
        }
      })
    }
  }, [files])

  // ==================== 渲染 ====================

  const canAddMore = files.length < maxFiles

  return (
    <div
      ref={containerRef}
      className={clsx(styles.container, className)}
      tabIndex={enablePaste ? 0 : undefined}
    >
      {/* 拖拽上传区域 */}
      {showDropzone && canAddMore && (
        <div
          {...getRootProps()}
          className={clsx(
            styles.dropzone,
            isDragActive && styles.dropzoneActive,
            isDragging && styles.dropzoneDragging,
            disabled && styles.dropzoneDisabled
          )}
        >
          <input {...getInputProps()} />
          <Upload size={32} className={styles.dropzoneIcon} />
          <p className={styles.dropzoneText}>
            {isDragActive
              ? '释放以上传文件'
              : '拖拽文件到这里，或点击选择文件'}
          </p>
          <p className={styles.dropzoneHint}>
            {accept.includes('*') 
              ? `最多 ${maxFiles} 个文件，每个最大 ${formatFileSize(maxSize)}`
              : `支持: ${accept.join(', ')} | 最大 ${formatFileSize(maxSize)}`
            }
          </p>
          {enablePaste && (
            <p className={styles.dropzoneHint}>
              💡 提示：也可以直接粘贴（Ctrl+V）图片
            </p>
          )}
        </div>
      )}

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map(file => (
            <FileItem
              key={file.id}
              file={file}
              onRemove={() => removeFile(file.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== 文件项组件 ====================

interface FileItemProps {
  file: UploadedFile
  onRemove: () => void
}

const FileItem: React.FC<FileItemProps> = ({ file, onRemove }) => {
  const { file: fileObj, preview, progress, status, error } = file

  return (
    <div className={clsx(styles.fileItem, styles[`fileItem--${status}`])}>
      {/* 预览 */}
      <div className={styles.filePreview}>
        {preview ? (
          <img src={preview} alt={fileObj.name} className={styles.previewImage} />
        ) : (
          <div className={styles.previewIcon}>
            {getFileIcon(fileObj)}
          </div>
        )}
      </div>

      {/* 信息 */}
      <div className={styles.fileInfo}>
        <div className={styles.fileName}>{fileObj.name}</div>
        <div className={styles.fileSize}>{formatFileSize(fileObj.size)}</div>
        
        {/* 进度条 */}
        {status === 'uploading' && (
          <div className={styles.progress}>
            <div
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* 错误信息 */}
        {status === 'error' && error && (
          <div className={styles.error}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 状态图标 */}
      <div className={styles.fileStatus}>
        {status === 'success' && (
          <CheckCircle2 size={20} className={styles.successIcon} />
        )}
        {status === 'error' && (
          <AlertCircle size={20} className={styles.errorIcon} />
        )}
        {status === 'uploading' && (
          <span className={styles.uploadingText}>{progress}%</span>
        )}
      </div>

      {/* 移除按钮 */}
      <button
        onClick={onRemove}
        className={styles.removeButton}
        title="移除文件"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default FileUploadZone

