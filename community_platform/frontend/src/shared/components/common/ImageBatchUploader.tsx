/**
 * ImageBatchUploader 批量图片上传组件
 * 专门用于批量上传图片，支持拖拽、进度显示、并发控制等
 */

'use client'

import { cn } from '@/shared/utils'
import { imageUploadService, type UploadResult } from '@/shared/services/imageUploadService'
import { compressImages } from '@/shared/utils/imageCompression'
import React from 'react'

export interface ImageBatchUploaderProps {
  /** 最大文件数量 */
  maxFiles?: number
  /** 最大文件大小 (MB) */
  maxSize?: number
  /** 最大并发上传数 */
  maxConcurrent?: number
  /** 是否自动开始上传 */
  autoStart?: boolean
  /** 是否压缩 */
  compress?: boolean
  /** 上传文件夹 */
  uploadFolder?: string
  /** 完成回调 */
  onComplete?: (results: UploadResult[]) => void
  /** 错误回调 */
  onError?: (error: string) => void
  /** 类名 */
  className?: string
}

interface FileItem {
  id: string
  file: File
  name: string
  size: number
  preview: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  result?: UploadResult
  error?: string
}

export function ImageBatchUploader({
  maxFiles = 50,
  maxSize = 10,
  maxConcurrent = 3,
  autoStart = true,
  compress = true,
  uploadFolder,
  onComplete,
  onError,
  className,
}: ImageBatchUploaderProps) {
  const [files, setFiles] = React.useState<FileItem[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // 统计数据
  const stats = React.useMemo(() => {
    const total = files.length
    const pending = files.filter((f) => f.status === 'pending').length
    const uploading = files.filter((f) => f.status === 'uploading').length
    const success = files.filter((f) => f.status === 'success').length
    const error = files.filter((f) => f.status === 'error').length
    const totalProgress = total > 0 ? Math.round((success / total) * 100) : 0

    return { total, pending, uploading, success, error, totalProgress }
  }, [files])

  // 添加文件
  const addFiles = async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)

    // 检查数量
    if (files.length + fileArray.length > maxFiles) {
      onError?.(`最多只能上传 ${maxFiles} 个文件`)
      return
    }

    // 验证并创建文件项
    const validFiles: FileItem[] = []

    for (const file of fileArray) {
      // 检查类型
      if (!file.type.startsWith('image/')) {
        onError?.(`文件 "${file.name}" 不是图片`)
        continue
      }

      // 检查大小
      if (file.size > maxSize * 1024 * 1024) {
        onError?.(`文件 "${file.name}" 超过大小限制 (${maxSize}MB)`)
        continue
      }

      // 创建预览
      const preview = URL.createObjectURL(file)

      validFiles.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        preview,
        status: 'pending',
        progress: 0,
      })
    }

    if (validFiles.length > 0) {
      setFiles((prev) => [...prev, ...validFiles])

      // 自动开始上传
      if (autoStart && !isUploading) {
        setTimeout(() => startUpload(), 100)
      }
    }
  }

  // 拖拽处理
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles) {
      addFiles(droppedFiles)
    }
  }

  // 文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files)
      e.target.value = ''
    }
  }

  // 开始上传
  const startUpload = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending' || f.status === 'error')
    if (pendingFiles.length === 0) return

    setIsUploading(true)
    abortControllerRef.current = new AbortController()

    try {
      // 压缩图片
      let filesToUpload = pendingFiles.map((f) => f.file)
      if (compress) {
        setFiles((prev) =>
          prev.map((f) =>
            pendingFiles.some((p) => p.id === f.id) ? { ...f, status: 'uploading', progress: 0 } : f
          )
        )

        filesToUpload = await compressImages(
          filesToUpload,
          {
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 0.85,
          },
          (current, total) => {
            // 压缩进度
            console.log(`压缩中: ${current}/${total}`)
          }
        )
      }

      // 批量上传
      const results = await imageUploadService.uploadImages(filesToUpload, {
        folder: uploadFolder,
        maxConcurrent,
        compress: false, // 已经压缩过了
        onFileComplete: (result, index) => {
          const fileItem = pendingFiles[index]
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id ? { ...f, status: 'success', progress: 100, result } : f
            )
          )
        },
        onFileError: (error, index) => {
          const fileItem = pendingFiles[index]
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileItem.id
                ? { ...f, status: 'error', error: error.message }
                : f
            )
          )
        },
        onProgress: (progress) => {
          // 总体进度已经通过 stats 计算
        },
      })

      // 完成回调
      if (results.length > 0) {
        onComplete?.(results)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '批量上传失败'
      onError?.(errorMsg)
    } finally {
      setIsUploading(false)
      abortControllerRef.current = null
    }
  }

  // 删除文件
  const removeFile = (id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file) {
        URL.revokeObjectURL(file.preview)
      }
      return prev.filter((f) => f.id !== id)
    })
  }

  // 清空所有
  const clearAll = () => {
    files.forEach((file) => URL.revokeObjectURL(file.preview))
    setFiles([])
  }

  // 重试失败的
  const retryFailed = () => {
    setFiles((prev) =>
      prev.map((f) => (f.status === 'error' ? { ...f, status: 'pending', error: undefined } : f))
    )
    startUpload()
  }

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  // 清理预览 URL
  React.useEffect(() => {
    return () => {
      files.forEach((file) => URL.revokeObjectURL(file.preview))
    }
  }, [files])

  return (
    <div className={cn('space-y-4', className)}>
      {/* 拖拽区域 */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-700'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {isDragging ? '放开以上传' : '拖拽图片到此处'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              或点击选择文件
            </p>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            选择图片
          </button>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            支持 JPG、PNG、GIF、WebP · 最大 {maxSize}MB · 最多 {maxFiles} 个文件
          </p>
        </div>
      </div>

      {/* 统计信息 */}
      {files.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-4 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                总计: <strong className="text-gray-900 dark:text-white">{stats.total}</strong>
              </span>
              <span className="text-green-600 dark:text-green-400">
                成功: <strong>{stats.success}</strong>
              </span>
              {stats.error > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  失败: <strong>{stats.error}</strong>
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {stats.error > 0 && (
                <button
                  type="button"
                  onClick={retryFailed}
                  disabled={isUploading}
                  className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  重试失败
                </button>
              )}
              <button
                type="button"
                onClick={clearAll}
                disabled={isUploading}
                className="px-3 py-1 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                清空全部
              </button>
            </div>
          </div>

          {/* 总进度条 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">总体进度</span>
              <span className="font-medium text-gray-900 dark:text-white">{stats.totalProgress}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${stats.totalProgress}%` }}
              />
            </div>
          </div>

          {/* 操作按钮 */}
          {!autoStart && stats.pending > 0 && (
            <button
              type="button"
              onClick={startUpload}
              disabled={isUploading}
              className="mt-3 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isUploading ? '上传中...' : `开始上传 (${stats.pending})`}
            </button>
          )}
        </div>
      )}

      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                'flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border-2',
                file.status === 'success' && 'border-green-200 dark:border-green-800',
                file.status === 'error' && 'border-red-200 dark:border-red-800',
                file.status === 'uploading' && 'border-blue-200 dark:border-blue-800',
                file.status === 'pending' && 'border-gray-200 dark:border-gray-700'
              )}
            >
              {/* 预览图 */}
              <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
              </div>

              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatSize(file.size)}
                </p>

                {/* 进度条 */}
                {file.status === 'uploading' && (
                  <div className="mt-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}

                {/* 错误信息 */}
                {file.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">{file.error}</p>
                )}
              </div>

              {/* 状态图标 */}
              <div className="flex-shrink-0">
                {file.status === 'pending' && (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                )}
                {file.status === 'uploading' && (
                  <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                )}
                {file.status === 'success' && (
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {file.status === 'error' && (
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* 删除按钮 */}
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                disabled={file.status === 'uploading'}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                aria-label="删除"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

