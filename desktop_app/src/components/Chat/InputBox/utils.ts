/**
 * InputBox 组件工具函数
 * 
 * 提供文件处理、验证、格式化等辅助功能
 * @module InputBox/utils
 */

import type {
  Attachment,
  AttachmentType,
  AttachmentValidation,
  FileSizeFormatOptions,
  FILE_TYPES,
} from './InputBox.types'

// ==================== 文件类型判断 ====================

/**
 * 根据 MIME 类型判断文件类型
 * @param mimeType - 文件的 MIME 类型
 * @returns 文件类型分类
 */
export function getFileType(mimeType: string): AttachmentType {
  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio'
  }
  if (mimeType.startsWith('video/')) {
    return 'video'
  }
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('text') ||
    mimeType.includes('msword') ||
    mimeType.includes('officedocument')
  ) {
    return 'document'
  }
  return 'other'
}

/**
 * 获取文件扩展名
 * @param filename - 文件名
 * @returns 文件扩展名（小写，不含点）
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return ''
  }
  return filename.substring(lastDot + 1).toLowerCase()
}

/**
 * 根据文件扩展名获取 MIME 类型
 * @param extension - 文件扩展名
 * @returns MIME 类型
 */
export function getMimeTypeFromExtension(extension: string): string {
  const ext = extension.toLowerCase().replace('.', '')
  const mimeMap: Record<string, string> = {
    // 图片
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    
    // 文档
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    
    // 音频
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    
    // 视频
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    
    // 压缩包
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
  }
  
  return mimeMap[ext] || 'application/octet-stream'
}

// ==================== 文件大小格式化 ====================

/**
 * 格式化文件大小
 * @param bytes - 文件大小（字节）
 * @param options - 格式化选项
 * @returns 格式化后的文件大小字符串
 * 
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1536, { precision: 2 }) // "1.50 KB"
 * formatFileSize(1048576, { unit: 'decimal' }) // "1.05 MB"
 */
export function formatFileSize(
  bytes: number,
  options: FileSizeFormatOptions = {}
): string {
  const { precision = 1, unit = 'binary' } = options
  
  if (bytes === 0) return '0 B'
  if (bytes < 0) return 'Invalid size'
  
  const k = unit === 'binary' ? 1024 : 1000
  const sizes = unit === 'binary'
    ? ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    : ['B', 'kB', 'MB', 'GB', 'TB', 'PB']
  
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const size = bytes / Math.pow(k, i)
  
  return `${size.toFixed(precision)} ${sizes[i]}`
}

/**
 * 解析文件大小字符串为字节数
 * @param sizeStr - 文件大小字符串，如 "1.5 MB"
 * @returns 字节数
 */
export function parseFileSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)$/)
  if (!match) return 0
  
  const [, numStr, unit] = match
  const num = parseFloat(numStr)
  
  const unitMap: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  }
  
  return num * (unitMap[unit.toUpperCase()] || 1)
}

// ==================== 文件验证 ====================

/**
 * 验证文件
 * @param file - 文件对象
 * @param options - 验证选项
 * @returns 验证结果
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number
    acceptedTypes?: string[]
    maxNameLength?: number
  } = {}
): AttachmentValidation {
  const {
    maxSize = 10 * 1024 * 1024, // 默认 10MB
    acceptedTypes = [],
    maxNameLength = 255,
  } = options
  
  // 验证文件大小
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `文件大小超过限制 (最大 ${formatFileSize(maxSize)})`,
      code: 'SIZE_EXCEEDED',
    }
  }
  
  // 验证文件类型
  if (acceptedTypes.length > 0) {
    const isAccepted = acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        // 扩展名匹配
        return file.name.toLowerCase().endsWith(type.toLowerCase())
      } else if (type.endsWith('/*')) {
        // 通配符匹配，如 image/*
        const prefix = type.slice(0, -2)
        return file.type.startsWith(prefix)
      } else {
        // 精确匹配 MIME 类型
        return file.type === type
      }
    })
    
    if (!isAccepted) {
      return {
        valid: false,
        error: '不支持的文件类型',
        code: 'TYPE_NOT_ALLOWED',
      }
    }
  }
  
  // 验证文件名长度
  if (file.name.length > maxNameLength) {
    return {
      valid: false,
      error: `文件名过长 (最大 ${maxNameLength} 个字符)`,
      code: 'INVALID_FILE',
    }
  }
  
  // 验证文件名是否合法
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/
  if (invalidChars.test(file.name)) {
    return {
      valid: false,
      error: '文件名包含非法字符',
      code: 'INVALID_FILE',
    }
  }
  
  return { valid: true }
}

/**
 * 批量验证文件
 * @param files - 文件列表
 * @param options - 验证选项
 * @returns 验证结果数组
 */
export function validateFiles(
  files: File[],
  options: Parameters<typeof validateFile>[1] = {}
): Array<{ file: File; validation: AttachmentValidation }> {
  return files.map(file => ({
    file,
    validation: validateFile(file, options),
  }))
}

// ==================== 文件转换 ====================

/**
 * 将 File 对象转换为 Data URL
 * @param file - 文件对象
 * @returns Promise<Data URL>
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 将 File 对象转换为 Base64 字符串
 * @param file - 文件对象
 * @returns Promise<Base64 字符串>
 */
export function fileToBase64(file: File): Promise<string> {
  return fileToDataURL(file).then(dataURL => {
    const base64 = dataURL.split(',')[1]
    return base64 || ''
  })
}

/**
 * 创建图片缩略图
 * @param file - 图片文件
 * @param maxWidth - 最大宽度
 * @param maxHeight - 最大高度
 * @returns Promise<Data URL>
 */
export function createImageThumbnail(
  file: File,
  maxWidth = 200,
  maxHeight = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image file'))
      return
    }
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Cannot get canvas context'))
          return
        }
        
        // 计算缩略图尺寸
        let width = img.width
        let height = img.height
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
        
        canvas.width = width
        canvas.height = height
        
        // 绘制缩略图
        ctx.drawImage(img, 0, 0, width, height)
        
        resolve(canvas.toDataURL(file.type))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ==================== 文本处理 ====================

/**
 * 在光标位置插入文本
 * @param textarea - 文本框元素
 * @param text - 要插入的文本
 */
export function insertTextAtCursor(
  textarea: HTMLTextAreaElement,
  text: string
): void {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  
  textarea.value = value.substring(0, start) + text + value.substring(end)
  
  // 移动光标到插入文本之后
  const newPos = start + text.length
  textarea.setSelectionRange(newPos, newPos)
  
  // 触发 input 事件
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * 获取选中的文本
 * @param textarea - 文本框元素
 * @returns 选中的文本
 */
export function getSelectedText(textarea: HTMLTextAreaElement): string {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  return textarea.value.substring(start, end)
}

/**
 * 替换选中的文本
 * @param textarea - 文本框元素
 * @param text - 新文本
 */
export function replaceSelectedText(
  textarea: HTMLTextAreaElement,
  text: string
): void {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  
  textarea.value = value.substring(0, start) + text + value.substring(end)
  
  // 选中新插入的文本
  textarea.setSelectionRange(start, start + text.length)
  
  // 触发 input 事件
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * 包裹选中的文本
 * @param textarea - 文本框元素
 * @param before - 前缀
 * @param after - 后缀
 */
export function wrapSelectedText(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string = before
): void {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const selectedText = value.substring(start, end)
  
  const newText = before + selectedText + after
  textarea.value = value.substring(0, start) + newText + value.substring(end)
  
  // 如果没有选中文本，将光标放在中间
  if (selectedText.length === 0) {
    const newPos = start + before.length
    textarea.setSelectionRange(newPos, newPos)
  } else {
    // 选中包裹后的文本
    textarea.setSelectionRange(start, start + newText.length)
  }
  
  // 触发 input 事件
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

// ==================== 字符串工具 ====================

/**
 * 截断文本
 * @param text - 原始文本
 * @param maxLength - 最大长度
 * @param ellipsis - 省略符号
 * @returns 截断后的文本
 */
export function truncateText(
  text: string,
  maxLength: number,
  ellipsis = '...'
): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - ellipsis.length) + ellipsis
}

/**
 * 转义 HTML 特殊字符
 * @param text - 原始文本
 * @returns 转义后的文本
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 移除 HTML 标签
 * @param html - HTML 字符串
 * @returns 纯文本
 */
export function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

/**
 * 统计字符数（支持 emoji）
 * @param text - 文本
 * @returns 字符数
 */
export function countCharacters(text: string): number {
  // 使用 Intl.Segmenter 正确计算 emoji 等复杂字符
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text)).length
  }
  
  // 降级方案：使用正则表达式
  return Array.from(text).length
}

// ==================== 防抖节流 ====================

/**
 * 防抖函数
 * @param fn - 要执行的函数
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  
  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      fn.apply(this, args)
      timeoutId = null
    }, delay)
  }
}

/**
 * 节流函数
 * @param fn - 要执行的函数
 * @param delay - 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    
    if (now - lastCall >= delay) {
      fn.apply(this, args)
      lastCall = now
    }
  }
}

// ==================== 剪贴板 ====================

/**
 * 复制文本到剪贴板
 * @param text - 要复制的文本
 * @returns Promise<boolean> 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    } else {
      // 降级方案
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    }
  } catch (error) {
    console.error('Failed to copy text:', error)
    return false
  }
}

/**
 * 从剪贴板读取文本
 * @returns Promise<string> 剪贴板文本
 */
export async function readFromClipboard(): Promise<string> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return await navigator.clipboard.readText()
    }
    return ''
  } catch (error) {
    console.error('Failed to read from clipboard:', error)
    return ''
  }
}

/**
 * 从剪贴板读取文件
 * @returns Promise<File[]> 文件列表
 */
export async function readFilesFromClipboard(): Promise<File[]> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      const clipboardItems = await navigator.clipboard.read()
      const files: File[] = []
      
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type)
            const file = new File([blob], `clipboard-${Date.now()}.${type.split('/')[1]}`, { type })
            files.push(file)
          }
        }
      }
      
      return files
    }
    return []
  } catch (error) {
    console.error('Failed to read files from clipboard:', error)
    return []
  }
}

// ==================== 其他工具 ====================

/**
 * 生成唯一 ID
 * @param prefix - ID 前缀
 * @returns 唯一 ID
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 延迟执行
 * @param ms - 延迟时间（毫秒）
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 检测是否为移动设备
 * @returns 是否为移动设备
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
}

/**
 * 检测是否为触摸设备
 * @returns 是否为触摸设备
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/**
 * 获取操作系统类型
 * @returns 操作系统类型
 */
export function getOS(): 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown' {
  const userAgent = navigator.userAgent.toLowerCase()
  
  if (userAgent.includes('win')) return 'windows'
  if (userAgent.includes('mac')) return 'macos'
  if (userAgent.includes('linux')) return 'linux'
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) return 'ios'
  if (userAgent.includes('android')) return 'android'
  
  return 'unknown'
}

/**
 * 检测浏览器类型
 * @returns 浏览器类型
 */
export function getBrowser(): 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown' {
  const userAgent = navigator.userAgent.toLowerCase()
  
  if (userAgent.includes('edg')) return 'edge'
  if (userAgent.includes('chrome')) return 'chrome'
  if (userAgent.includes('firefox')) return 'firefox'
  if (userAgent.includes('safari')) return 'safari'
  
  return 'unknown'
}

