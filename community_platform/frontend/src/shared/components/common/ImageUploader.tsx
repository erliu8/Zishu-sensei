/**
 * ImageUploader 图片上传组件
 * 专门用于图片上传，支持预览、拖拽、进度显示等功能
 */

'use client'

import { cn } from '@/shared/utils'
import { compressImage, shouldCompressImage } from '@/shared/utils/imageCompression'
import { imageUploadService, type UploadProgress, type UploadResult } from '@/shared/services/imageUploadService'
import React from 'react'
import { ImageCropper } from './ImageCropper'

export interface ImageUploaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'onError'> {
  multiple?: boolean
  maxSize?: number // 单位：MB
  maxImages?: number
  aspectRatio?: number // 宽高比，如 16/9
  disabled?: boolean
  value?: string[]
  onChange?: (images: string[]) => void
  onError?: (error: string) => void
  /** 是否自动上传到服务器 */
  autoUpload?: boolean
  /** 上传完成回调 */
  onUploadComplete?: (results: UploadResult[]) => void
  /** 是否启用裁剪 */
  enableCrop?: boolean
  /** 是否压缩图片 */
  compress?: boolean
  /** 上传文件夹 */
  uploadFolder?: string
  /** 显示上传进度 */
  showProgress?: boolean
}

interface ImageItem {
  id: string
  url: string
  file?: File
  uploading?: boolean
  progress?: number
  error?: string
  uploaded?: boolean
}

export const ImageUploader = React.forwardRef<HTMLDivElement, ImageUploaderProps>(
  (
    {
      className,
      multiple = false,
      maxSize = 5,
      maxImages = 10,
      aspectRatio,
      disabled = false,
      value = [],
      onChange,
      onError,
      autoUpload = false,
      onUploadComplete,
      enableCrop = false,
      compress = true,
      uploadFolder,
      showProgress = true,
      ...props
    },
    ref
  ) => {
    const [images, setImages] = React.useState<ImageItem[]>(
      value.map((url, i) => ({ id: `${i}`, url, uploaded: true }))
    )
    const [isDragging, setIsDragging] = React.useState(false)
    const [cropImage, setCropImage] = React.useState<File | null>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
      setImages(value.map((url, i) => ({ id: `${i}`, url, uploaded: true })))
    }, [value])

    // 通知父组件变化
    const notifyChange = React.useCallback(
      (updatedImages: ImageItem[]) => {
        const urls = updatedImages.filter((img) => !img.uploading).map((img) => img.url)
        onChange?.(urls)
      },
      [onChange]
    )

    const validateAndReadImage = async (file: File): Promise<ImageItem | null> => {
      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        onError?.(`文件 "${file.name}" 不是图片`)
        return null
      }

      // 检查文件大小
      if (file.size > maxSize * 1024 * 1024) {
        onError?.(`图片 "${file.name}" 超过最大大小限制 ${maxSize}MB`)
        return null
      }

      // 压缩图片
      let fileToUse = file
      if (compress && shouldCompressImage(file, maxSize * 1024 * 1024)) {
        try {
          const compressed = await compressImage(file, {
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 0.85,
          })
          fileToUse = new File([compressed], file.name, { type: compressed.type })
        } catch (error) {
          console.warn('Image compression failed:', error)
        }
      }

      // 读取图片
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string
          resolve({
            id: `${Date.now()}-${Math.random()}`,
            url: dataUrl,
            file: fileToUse,
            uploading: autoUpload,
            progress: 0,
          })
        }
        reader.onerror = () => {
          onError?.(`读取图片 "${file.name}" 失败`)
          resolve(null)
        }
        reader.readAsDataURL(fileToUse)
      })
    }

    // 上传图片到服务器
    const uploadImage = React.useCallback(
      async (imageItem: ImageItem) => {
        if (!imageItem.file) return

        setImages((prev) =>
          prev.map((img) =>
            img.id === imageItem.id ? { ...img, uploading: true, progress: 0 } : img
          )
        )

        try {
          const result = await imageUploadService.uploadImage(imageItem.file, {
            folder: uploadFolder,
            compress: false, // 已经在前端压缩过了
            onProgress: (progress: UploadProgress) => {
              setImages((prev) =>
                prev.map((img) =>
                  img.id === imageItem.id ? { ...img, progress: progress.percentage } : img
                )
              )
            },
          })

          setImages((prev) => {
            const updated = prev.map((img) =>
              img.id === imageItem.id
                ? { ...img, url: result.url, uploading: false, uploaded: true, progress: 100 }
                : img
            )
            notifyChange(updated)
            return updated
          })

          return result
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '上传失败'
          setImages((prev) =>
            prev.map((img) =>
              img.id === imageItem.id
                ? { ...img, uploading: false, error: errorMsg }
                : img
            )
          )
          onError?.(errorMsg)
          return null
        }
      },
      [uploadFolder, onError, notifyChange]
    )

    const handleFiles = async (files: FileList | null): Promise<void> => {
      if (!files || files.length === 0) return

      const fileArray = Array.from(files)

      // 检查数量
      const totalImages = images.length + fileArray.length
      if (totalImages > maxImages) {
        onError?.(`最多只能上传 ${maxImages} 张图片`)
        fileArray.splice(maxImages - images.length)
      }

      // 如果启用裁剪且只有一张图片
      if (enableCrop && fileArray.length === 1) {
        setCropImage(fileArray[0])
        return
      }

      // 读取图片
      const imagePromises = fileArray.map((file) => validateAndReadImage(file))
      const imageResults = await Promise.all(imagePromises)
      const validImages = imageResults.filter((img): img is ImageItem => img !== null)

      // 更新图片列表
      if (validImages.length > 0) {
        const updatedImages = multiple ? [...images, ...validImages] : validImages
        setImages(updatedImages)
        notifyChange(updatedImages)

        // 自动上传
        if (autoUpload) {
          const uploadPromises = validImages.map((img) => uploadImage(img))
          const results = await Promise.all(uploadPromises)
          const successResults = results.filter((r): r is UploadResult => r !== null)
          if (successResults.length > 0) {
            onUploadComplete?.(successResults)
          }
        }
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
      e.target.value = ''
    }

    const handleRemoveImage = (id: string): void => {
      const updatedImages = images.filter((img) => img.id !== id)
      setImages(updatedImages)
      notifyChange(updatedImages)
    }

    // 重试上传
    const handleRetry = (id: string): void => {
      const imageItem = images.find((img) => img.id === id)
      if (imageItem && imageItem.file) {
        uploadImage(imageItem)
      }
    }

    // 裁剪完成
    const handleCropComplete = async (croppedBlob: Blob): Promise<void> => {
      if (!cropImage) return

      const croppedFile = new File([croppedBlob], cropImage.name, { type: 'image/jpeg' })
      setCropImage(null)

      // 读取裁剪后的图片
      const imageItem = await validateAndReadImage(croppedFile)
      if (imageItem) {
        const updatedImages = multiple ? [...images, imageItem] : [imageItem]
        setImages(updatedImages)
        notifyChange(updatedImages)

        // 自动上传
        if (autoUpload) {
          const result = await uploadImage(imageItem)
          if (result) {
            onUploadComplete?.([result])
          }
        }
      }
    }

    const handleClick = (): void => {
      if (!disabled) {
        inputRef.current?.click()
      }
    }

    return (
      <>
        <div ref={ref} className={cn('w-full', className)} {...props}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple={multiple}
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {/* 已上传的图片 */}
            {images.map((image) => (
              <div
                key={image.id}
                className={cn(
                  'relative group rounded-lg overflow-hidden border-2',
                  image.error
                    ? 'border-red-500'
                    : image.uploading
                      ? 'border-blue-500'
                      : 'border-gray-200 dark:border-gray-700',
                  aspectRatio && 'aspect-[var(--aspect-ratio)]'
                )}
                style={aspectRatio ? { '--aspect-ratio': aspectRatio } as any : undefined}
              >
                <img
                  src={image.url}
                  alt={`图片 ${image.id}`}
                  className="w-full h-full object-cover"
                />

                {/* 上传进度 */}
                {showProgress && image.uploading && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin mb-2" />
                    <p className="text-white text-sm font-medium">{image.progress}%</p>
                  </div>
                )}

                {/* 错误提示 */}
                {image.error && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-2">
                    <svg className="w-8 h-8 text-red-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-white text-xs text-center mb-2">{image.error}</p>
                    <button
                      type="button"
                      onClick={() => handleRetry(image.id)}
                      className="px-2 py-1 text-xs text-white bg-blue-600 rounded hover:bg-blue-700"
                    >
                      重试
                    </button>
                  </div>
                )}

                {/* 操作按钮 */}
                {!image.uploading && !image.error && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(image.id)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                      aria-label="删除图片"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* 上传按钮 */}
            {(!multiple && images.length === 0 || multiple && images.length < maxImages) && (
              <div
                onClick={handleClick}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={cn(
                  'relative border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors',
                  'min-h-[120px]',
                  aspectRatio && 'aspect-[var(--aspect-ratio)]',
                  isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
                style={aspectRatio ? { '--aspect-ratio': aspectRatio } as any : undefined}
              >
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">
                  {isDragging ? '放开以上传' : '点击或拖拽上传'}
                </p>
              </div>
            )}
          </div>

          {/* 提示信息 */}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            支持 JPG、PNG、GIF、WebP 等格式，最大 {maxSize}MB
            {multiple && ` · 最多 ${maxImages} 张图片`}
            {compress && ' · 自动压缩'}
          </p>
        </div>

        {/* 裁剪弹窗 */}
        {cropImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">裁剪图片</h3>
              <ImageCropper
                image={cropImage}
                aspectRatio={aspectRatio}
                onCropComplete={handleCropComplete}
                onCancel={() => setCropImage(null)}
              />
            </div>
          </div>
        )}
      </>
    )
  }
)

ImageUploader.displayName = 'ImageUploader'

