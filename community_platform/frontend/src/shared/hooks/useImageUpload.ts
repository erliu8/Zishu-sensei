/**
 * useImageUpload Hook
 * 处理图片上传功能
 */

import { useState, useCallback } from 'react'

export interface UseImageUploadOptions {
  onUpload: (file: File) => Promise<string> // 返回图片 URL
  maxSize?: number // 最大文件大小（字节）
  acceptedTypes?: string[] // 接受的文件类型
  onError?: (error: Error) => void
}

export interface UseImageUploadReturn {
  isUploading: boolean
  uploadImage: (file: File) => Promise<string | null>
  uploadFromClipboard: (event: ClipboardEvent) => Promise<string | null>
  error: Error | null
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']

export function useImageUpload({
  onUpload,
  maxSize = DEFAULT_MAX_SIZE,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  onError,
}: UseImageUploadOptions): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const validateFile = useCallback(
    (file: File): boolean => {
      // 检查文件类型
      if (!acceptedTypes.includes(file.type)) {
        const error = new Error(
          `不支持的文件类型: ${file.type}。支持的类型: ${acceptedTypes.join(', ')}`
        )
        setError(error)
        onError?.(error)
        return false
      }

      // 检查文件大小
      if (file.size > maxSize) {
        const error = new Error(
          `文件大小超过限制: ${(file.size / 1024 / 1024).toFixed(2)}MB，最大允许: ${(maxSize / 1024 / 1024).toFixed(2)}MB`
        )
        setError(error)
        onError?.(error)
        return false
      }

      return true
    },
    [acceptedTypes, maxSize, onError]
  )

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      setError(null)

      if (!validateFile(file)) {
        return null
      }

      try {
        setIsUploading(true)
        const url = await onUpload(file)
        return url
      } catch (err) {
        const error = err as Error
        setError(error)
        onError?.(error)
        return null
      } finally {
        setIsUploading(false)
      }
    },
    [validateFile, onUpload, onError]
  )

  const uploadFromClipboard = useCallback(
    async (event: ClipboardEvent): Promise<string | null> => {
      const items = event.clipboardData?.items
      if (!items) return null

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item && item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
          if (file) {
            return await uploadImage(file)
          }
        }
      }

      return null
    },
    [uploadImage]
  )

  return {
    isUploading,
    uploadImage,
    uploadFromClipboard,
    error,
  }
}
