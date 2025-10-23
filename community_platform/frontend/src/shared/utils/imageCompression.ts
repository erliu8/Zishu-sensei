/**
 * 图片压缩工具
 * 提供图片压缩、缩放、格式转换等功能
 */

export interface CompressionOptions {
  /** 最大宽度 */
  maxWidth?: number
  /** 最大高度 */
  maxHeight?: number
  /** 压缩质量 0-1 */
  quality?: number
  /** 输出格式 */
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp'
  /** 是否保持宽高比 */
  maintainAspectRatio?: boolean
}

export interface ImageDimensions {
  width: number
  height: number
}

/**
 * 计算调整后的尺寸
 */
function calculateDimensions(
  original: ImageDimensions,
  maxWidth?: number,
  maxHeight?: number,
  maintainAspectRatio = true
): ImageDimensions {
  let { width, height } = original

  // 如果不限制尺寸，返回原始尺寸
  if (!maxWidth && !maxHeight) {
    return { width, height }
  }

  if (maintainAspectRatio) {
    // 保持宽高比
    const aspectRatio = width / height

    if (maxWidth && maxHeight) {
      // 同时指定了最大宽高
      if (width > maxWidth || height > maxHeight) {
        if (width / maxWidth > height / maxHeight) {
          width = maxWidth
          height = Math.round(width / aspectRatio)
        } else {
          height = maxHeight
          width = Math.round(height * aspectRatio)
        }
      }
    } else if (maxWidth && width > maxWidth) {
      // 只指定了最大宽度
      width = maxWidth
      height = Math.round(width / aspectRatio)
    } else if (maxHeight && height > maxHeight) {
      // 只指定了最大高度
      height = maxHeight
      width = Math.round(height * aspectRatio)
    }
  } else {
    // 不保持宽高比
    if (maxWidth) width = Math.min(width, maxWidth)
    if (maxHeight) height = Math.min(height, maxHeight)
  }

  return { width, height }
}

/**
 * 加载图片
 */
function loadImage(file: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => resolve(img)
    img.onerror = reject

    if (typeof file === 'string') {
      img.src = file
    } else {
      const url = URL.createObjectURL(file)
      img.src = url
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
    }
  })
}

/**
 * 压缩图片
 * @param file 图片文件
 * @param options 压缩选项
 * @returns 压缩后的 Blob
 */
export async function compressImage(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<Blob> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.8,
    mimeType = 'image/jpeg',
    maintainAspectRatio = true,
  } = options

  // 加载图片
  const img = await loadImage(file)

  // 计算新尺寸
  const newDimensions = calculateDimensions(
    { width: img.naturalWidth, height: img.naturalHeight },
    maxWidth,
    maxHeight,
    maintainAspectRatio
  )

  // 创建 canvas
  const canvas = document.createElement('canvas')
  canvas.width = newDimensions.width
  canvas.height = newDimensions.height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  // 绘制图片
  ctx.drawImage(img, 0, 0, newDimensions.width, newDimensions.height)

  // 转换为 Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert canvas to blob'))
        }
      },
      mimeType,
      quality
    )
  })
}

/**
 * 压缩图片并返回 File
 */
export async function compressImageToFile(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const blob = await compressImage(file, options)
  
  // 生成文件名
  const extension = options.mimeType?.split('/')[1] || 'jpg'
  const fileName = file.name.replace(/\.[^.]+$/, `.${extension}`)
  
  return new File([blob], fileName, { type: options.mimeType || 'image/jpeg' })
}

/**
 * 压缩图片并返回 Data URL
 */
export async function compressImageToDataURL(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<string> {
  const blob = await compressImage(file, options)
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 批量压缩图片
 */
export async function compressImages(
  files: File[],
  options: CompressionOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<File[]> {
  const results: File[] = []
  
  for (let i = 0; i < files.length; i++) {
    const compressed = await compressImageToFile(files[i], options)
    results.push(compressed)
    onProgress?.(i + 1, files.length)
  }
  
  return results
}

/**
 * 获取图片尺寸
 */
export async function getImageDimensions(file: File | Blob | string): Promise<ImageDimensions> {
  const img = await loadImage(file)
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
  }
}

/**
 * 检查图片是否需要压缩
 */
export function shouldCompressImage(
  file: File,
  maxSize: number = 1024 * 1024 // 1MB
): boolean {
  return file.size > maxSize
}

/**
 * 转换图片格式
 */
export async function convertImageFormat(
  file: File | Blob,
  targetMimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  quality = 0.9
): Promise<Blob> {
  return compressImage(file, {
    mimeType: targetMimeType,
    quality,
  })
}

/**
 * 生成缩略图
 */
export async function generateThumbnail(
  file: File | Blob,
  size: number = 200,
  quality = 0.7
): Promise<Blob> {
  return compressImage(file, {
    maxWidth: size,
    maxHeight: size,
    quality,
    mimeType: 'image/jpeg',
  })
}

/**
 * 图片文件转 Base64
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Base64 转 Blob
 */
export function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  const byteString = atob(base64.split(',')[1])
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  
  return new Blob([ab], { type: mimeType })
}

/**
 * Base64 转 File
 */
export function base64ToFile(base64: string, filename: string, mimeType = 'image/jpeg'): File {
  const blob = base64ToBlob(base64, mimeType)
  return new File([blob], filename, { type: mimeType })
}

