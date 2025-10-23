/**
 * AvatarUploader 头像上传组件
 * 专门用于上传圆形头像，支持裁剪、预览等功能
 */

'use client'

import { cn } from '@/shared/utils'
import { compressImage } from '@/shared/utils/imageCompression'
import { imageUploadService, type UploadResult } from '@/shared/services/imageUploadService'
import React from 'react'
import { ImageCropper } from './ImageCropper'

export interface AvatarUploaderProps {
  /** 当前头像 URL */
  value?: string
  /** 头像大小（像素） */
  size?: number
  /** 是否显示为圆形 */
  rounded?: boolean
  /** 最大文件大小 (MB) */
  maxSize?: number
  /** 是否禁用 */
  disabled?: boolean
  /** 是否自动上传 */
  autoUpload?: boolean
  /** 上传文件夹 */
  uploadFolder?: string
  /** 上传完成回调 */
  onChange?: (url: string) => void
  /** 上传完成回调（包含详细信息） */
  onUploadComplete?: (result: UploadResult) => void
  /** 错误回调 */
  onError?: (error: string) => void
  /** 类名 */
  className?: string
}

export function AvatarUploader({
  value,
  size = 120,
  rounded = true,
  maxSize = 5,
  disabled = false,
  autoUpload = true,
  uploadFolder = 'avatars',
  onChange,
  onUploadComplete,
  onError,
  className,
}: AvatarUploaderProps) {
  const [avatarUrl, setAvatarUrl] = React.useState<string>(value || '')
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [cropImage, setCropImage] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string>('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setAvatarUrl(value || '')
  }, [value])

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 清空 input
    e.target.value = ''

    // 验证文件
    if (!file.type.startsWith('image/')) {
      onError?.('请选择图片文件')
      return
    }

    if (file.size > maxSize * 1024 * 1024) {
      onError?.(`图片大小不能超过 ${maxSize}MB`)
      return
    }

    // 显示裁剪弹窗
    setCropImage(file)
  }

  // 裁剪完成
  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!cropImage) return

    const croppedFile = new File([croppedBlob], cropImage.name, { type: 'image/jpeg' })
    setCropImage(null)

    // 创建预览
    const preview = URL.createObjectURL(croppedBlob)
    setPreviewUrl(preview)
    setAvatarUrl(preview)

    // 自动上传
    if (autoUpload) {
      await uploadAvatar(croppedFile)
    } else {
      onChange?.(preview)
    }
  }

  // 上传头像
  const uploadAvatar = async (file: File) => {
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // 压缩图片
      const compressed = await compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.9,
      })

      const compressedFile = new File([compressed], file.name, { type: compressed.type })

      // 上传
      const result = await imageUploadService.uploadImage(compressedFile, {
        folder: uploadFolder,
        compress: false, // 已经压缩过了
        onProgress: (progress) => {
          setUploadProgress(progress.percentage)
        },
      })

      // 清理预览 URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
        setPreviewUrl('')
      }

      setAvatarUrl(result.url)
      onChange?.(result.url)
      onUploadComplete?.(result)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '上传失败'
      onError?.(errorMsg)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // 清理预览 URL
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <>
      <div className={cn('inline-block', className)}>
        <div className="relative group">
          {/* 头像显示 */}
          <div
            className={cn(
              'relative overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center',
              rounded ? 'rounded-full' : 'rounded-lg',
              disabled && 'opacity-50'
            )}
            style={{ width: size, height: size }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="头像"
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                className="w-1/2 h-1/2 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            )}

            {/* 上传进度 */}
            {isUploading && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin mb-2" />
                <p className="text-white text-sm font-medium">{uploadProgress}%</p>
              </div>
            )}

            {/* 悬停遮罩 */}
            {!disabled && !isUploading && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                  aria-label="上传头像"
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* 上传按钮（无头像时显示） */}
          {!avatarUrl && !isUploading && !disabled && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                'absolute -bottom-1 -right-1 p-2 bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors',
                rounded ? 'rounded-full' : 'rounded-lg'
              )}
              aria-label="上传头像"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}

          {/* 删除按钮（有头像时显示） */}
          {avatarUrl && !isUploading && !disabled && (
            <button
              type="button"
              onClick={() => {
                setAvatarUrl('')
                onChange?.('')
              }}
              className={cn(
                'absolute -top-1 -right-1 p-1.5 bg-red-600 text-white shadow-lg hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100',
                rounded ? 'rounded-full' : 'rounded-lg'
              )}
              aria-label="删除头像"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 提示文字 */}
        <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
          {isUploading ? '上传中...' : `最大 ${maxSize}MB`}
        </p>

        {/* 隐藏的文件输入 */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
      </div>

      {/* 裁剪弹窗 */}
      {cropImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">裁剪头像</h3>
            <ImageCropper
              image={cropImage}
              aspectRatio={1} // 强制正方形
              minWidth={200}
              minHeight={200}
              onCropComplete={handleCropComplete}
              onCancel={() => setCropImage(null)}
            />
          </div>
        </div>
      )}
    </>
  )
}

