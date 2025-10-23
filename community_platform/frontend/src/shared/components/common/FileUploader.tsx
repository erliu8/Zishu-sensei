/**
 * FileUploader 文件上传组件
 * 支持拖拽上传、多文件上传、文件类型限制等
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface FileUploaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'onError'> {
  accept?: string
  multiple?: boolean
  maxSize?: number // 单位：MB
  maxFiles?: number
  disabled?: boolean
  value?: File[]
  onChange?: (files: File[]) => void
  onError?: (error: string) => void
}

export const FileUploader = React.forwardRef<HTMLDivElement, FileUploaderProps>(
  (
    {
      className,
      accept,
      multiple = false,
      maxSize = 10,
      maxFiles = 5,
      disabled = false,
      value = [],
      onChange,
      onError,
      ...props
    },
    ref
  ) => {
    const [files, setFiles] = React.useState<File[]>(value)
    const [isDragging, setIsDragging] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
      setFiles(value)
    }, [value])

    const validateFile = (file: File): string | null => {
      // 检查文件大小
      if (file.size > maxSize * 1024 * 1024) {
        return `文件 "${file.name}" 超过最大大小限制 ${maxSize}MB`
      }

      // 检查文件类型
      if (accept) {
        const acceptedTypes = accept.split(',').map((type) => type.trim())
        const fileExtension = `.${file.name.split('.').pop()}`
        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith('.')) {
            return fileExtension === type
          }
          if (type.endsWith('/*')) {
            return file.type.startsWith(type.slice(0, -1))
          }
          return file.type === type
        })

        if (!isAccepted) {
          return `文件 "${file.name}" 类型不支持`
        }
      }

      return null
    }

    const handleFiles = (newFiles: FileList | null): void => {
      if (!newFiles || newFiles.length === 0) return

      const fileArray = Array.from(newFiles)
      const errors: string[] = []
      const validFiles: File[] = []

      // 验证文件
      for (const file of fileArray) {
        const error = validateFile(file)
        if (error) {
          errors.push(error)
        } else {
          validFiles.push(file)
        }
      }

      // 检查文件数量
      const totalFiles = files.length + validFiles.length
      if (totalFiles > maxFiles) {
        errors.push(`最多只能上传 ${maxFiles} 个文件`)
        validFiles.splice(maxFiles - files.length)
      }

      // 显示错误
      if (errors.length > 0) {
        onError?.(errors.join('; '))
      }

      // 更新文件列表
      if (validFiles.length > 0) {
        const updatedFiles = multiple ? [...files, ...validFiles] : validFiles
        setFiles(updatedFiles)
        onChange?.(updatedFiles)
      }
    }

    const handleDragEnter = (e: React.DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) {
        setIsDragging(true)
      }
    }

    const handleDragLeave = (e: React.DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
    }

    const handleDragOver = (e: React.DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (!disabled) {
        handleFiles(e.dataTransfer.files)
      }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
      handleFiles(e.target.files)
      // 重置 input 值以允许重复选择相同文件
      e.target.value = ''
    }

    const handleRemoveFile = (index: number): void => {
      const updatedFiles = files.filter((_, i) => i !== index)
      setFiles(updatedFiles)
      onChange?.(updatedFiles)
    }

    const handleClick = (): void => {
      if (!disabled) {
        inputRef.current?.click()
      }
    }

    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
    }

    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <div
          onClick={handleClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragging
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isDragging ? '放开以上传文件' : '点击选择文件或拖拽文件到此处'}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {accept && `支持格式: ${accept} `}
                {maxSize && `最大 ${maxSize}MB`}
                {multiple && ` · 最多 ${maxFiles} 个文件`}
              </p>
            </div>
          </div>
        </div>

        {/* 文件列表 */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile(index)
                  }}
                  className="ml-4 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  aria-label="删除文件"
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
)

FileUploader.displayName = 'FileUploader'

