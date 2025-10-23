/**
 * 图片上传服务
 * 提供图片上传、进度跟踪、错误处理等功能
 */

import { apiClient } from '@/infrastructure/api'
import { compressImage, shouldCompressImage, type CompressionOptions } from '@/shared/utils/imageCompression'

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResult {
  id: string
  url: string
  filename: string
  size: number
  width?: number
  height?: number
  mimeType: string
  thumbnail?: string
}

export interface ImageUploadOptions {
  /** 上传前是否压缩 */
  compress?: boolean
  /** 压缩选项 */
  compressionOptions?: CompressionOptions
  /** 进度回调 */
  onProgress?: (progress: UploadProgress) => void
  /** 上传路径 */
  folder?: string
  /** 自动生成缩略图 */
  generateThumbnail?: boolean
  /** 额外的元数据 */
  metadata?: Record<string, any>
}

export interface BatchUploadOptions extends ImageUploadOptions {
  /** 最大并发数 */
  maxConcurrent?: number
  /** 单个文件完成回调 */
  onFileComplete?: (result: UploadResult, index: number) => void
  /** 单个文件失败回调 */
  onFileError?: (error: Error, index: number) => void
}

/**
 * 图片上传服务类
 */
export class ImageUploadService {
  private baseUrl: string

  constructor(baseUrl: string = '/api/files/upload') {
    this.baseUrl = baseUrl
  }

  /**
   * 上传单张图片
   */
  async uploadImage(
    file: File,
    options: ImageUploadOptions = {}
  ): Promise<UploadResult> {
    const {
      compress = true,
      compressionOptions = {},
      onProgress,
      folder,
      generateThumbnail = true,
      metadata = {},
    } = options

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      throw new Error(`文件 "${file.name}" 不是图片格式`)
    }

    let fileToUpload = file

    // 如果需要压缩且文件较大
    if (compress && shouldCompressImage(file)) {
      try {
        const compressed = await compressImage(file, {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.85,
          mimeType: 'image/jpeg',
          ...compressionOptions,
        })
        fileToUpload = new File([compressed], file.name, { type: compressed.type })
      } catch (error) {
        console.warn('Image compression failed, uploading original:', error)
      }
    }

    // 构建 FormData
    const formData = new FormData()
    formData.append('file', fileToUpload)
    
    if (folder) {
      formData.append('folder', folder)
    }
    
    if (generateThumbnail) {
      formData.append('auto_generate_thumbnail', 'true')
    }

    // 添加元数据
    Object.entries(metadata).forEach(([key, value]) => {
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
    })

    // 上传
    const response = await apiClient.post<{ data: UploadResult }>(
      this.baseUrl,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress({
              loaded: progressEvent.loaded,
              total: progressEvent.total,
              percentage,
            })
          }
        },
      }
    )

    return response.data.data
  }

  /**
   * 批量上传图片
   */
  async uploadImages(
    files: File[],
    options: BatchUploadOptions = {}
  ): Promise<UploadResult[]> {
    const {
      maxConcurrent = 3,
      onFileComplete,
      onFileError,
      onProgress,
      ...uploadOptions
    } = options

    const results: UploadResult[] = []
    const errors: Error[] = []
    let completed = 0

    // 计算总进度
    const updateTotalProgress = () => {
      if (onProgress) {
        const percentage = Math.round((completed / files.length) * 100)
        onProgress({
          loaded: completed,
          total: files.length,
          percentage,
        })
      }
    }

    // 上传单个文件
    const uploadFile = async (file: File, index: number): Promise<void> => {
      try {
        const result = await this.uploadImage(file, {
          ...uploadOptions,
          onProgress: undefined, // 不传递单个文件的进度
        })
        results[index] = result
        onFileComplete?.(result, index)
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Upload failed')
        errors[index] = err
        onFileError?.(err, index)
      } finally {
        completed++
        updateTotalProgress()
      }
    }

    // 并发控制上传
    for (let i = 0; i < files.length; i += maxConcurrent) {
      const batch = files.slice(i, i + maxConcurrent)
      await Promise.all(
        batch.map((file, batchIndex) => uploadFile(file, i + batchIndex))
      )
    }

    // 如果有错误，抛出
    if (errors.length > 0 && results.length === 0) {
      throw new Error(`所有文件上传失败: ${errors[0].message}`)
    }

    return results.filter(Boolean) // 过滤掉失败的
  }

  /**
   * 上传图片并获取 URL（简化版）
   */
  async uploadAndGetUrl(file: File, options?: ImageUploadOptions): Promise<string> {
    const result = await this.uploadImage(file, options)
    return result.url
  }

  /**
   * 上传多张图片并获取 URLs
   */
  async uploadAndGetUrls(files: File[], options?: BatchUploadOptions): Promise<string[]> {
    const results = await this.uploadImages(files, options)
    return results.map((r) => r.url)
  }

  /**
   * 验证图片文件
   */
  validateImage(
    file: File,
    options: {
      maxSize?: number // bytes
      minWidth?: number
      minHeight?: number
      maxWidth?: number
      maxHeight?: number
      allowedTypes?: string[]
    } = {}
  ): Promise<{ valid: boolean; error?: string }> {
    return new Promise((resolve) => {
      const {
        maxSize = 10 * 1024 * 1024, // 10MB
        minWidth,
        minHeight,
        maxWidth,
        maxHeight,
        allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      } = options

      // 检查文件类型
      if (!file.type.startsWith('image/')) {
        resolve({ valid: false, error: '不是图片文件' })
        return
      }

      if (!allowedTypes.includes(file.type)) {
        resolve({ valid: false, error: `不支持的图片格式: ${file.type}` })
        return
      }

      // 检查文件大小
      if (file.size > maxSize) {
        const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1)
        resolve({ valid: false, error: `文件大小超过限制 (最大 ${maxSizeMB}MB)` })
        return
      }

      // 检查图片尺寸
      if (minWidth || minHeight || maxWidth || maxHeight) {
        const img = new Image()
        const url = URL.createObjectURL(file)

        img.onload = () => {
          URL.revokeObjectURL(url)

          if (minWidth && img.naturalWidth < minWidth) {
            resolve({ valid: false, error: `图片宽度不能小于 ${minWidth}px` })
            return
          }

          if (minHeight && img.naturalHeight < minHeight) {
            resolve({ valid: false, error: `图片高度不能小于 ${minHeight}px` })
            return
          }

          if (maxWidth && img.naturalWidth > maxWidth) {
            resolve({ valid: false, error: `图片宽度不能大于 ${maxWidth}px` })
            return
          }

          if (maxHeight && img.naturalHeight > maxHeight) {
            resolve({ valid: false, error: `图片高度不能大于 ${maxHeight}px` })
            return
          }

          resolve({ valid: true })
        }

        img.onerror = () => {
          URL.revokeObjectURL(url)
          resolve({ valid: false, error: '无效的图片文件' })
        }

        img.src = url
      } else {
        resolve({ valid: true })
      }
    })
  }

  /**
   * 批量验证图片
   */
  async validateImages(
    files: File[],
    options?: Parameters<typeof this.validateImage>[1]
  ): Promise<Array<{ file: File; valid: boolean; error?: string }>> {
    const results = await Promise.all(
      files.map(async (file) => {
        const validation = await this.validateImage(file, options)
        return { file, ...validation }
      })
    )
    return results
  }
}

/**
 * 默认图片上传服务实例
 */
export const imageUploadService = new ImageUploadService()

/**
 * 快捷上传函数
 */
export const uploadImage = (file: File, options?: ImageUploadOptions) =>
  imageUploadService.uploadImage(file, options)

export const uploadImages = (files: File[], options?: BatchUploadOptions) =>
  imageUploadService.uploadImages(files, options)

