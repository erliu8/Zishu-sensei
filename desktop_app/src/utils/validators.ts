/**
 * 输入验证工具
 * 
 * 提供全面的验证功能，包括：
 * - 文本验证（长度、格式等）
 * - 文件验证（大小、类型等）
 * - URL 验证
 * - 邮箱验证
 * - 数字验证
 * - 表单验证
 * - 消息内容验证
 * - 安全验证
 * 
 * @module validators
 */

// ==================== 类型定义 ====================

/**
 * 验证结果接口
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean
  /** 错误消息 */
  message?: string
  /** 错误代码 */
  code?: string
  /** 附加数据 */
  data?: any
}

/**
 * 验证规则接口
 */
export interface ValidationRule {
  /** 规则名称 */
  name: string
  /** 验证函数 */
  validator: (value: any) => boolean | ValidationResult
  /** 错误消息 */
  message?: string
}

/**
 * 文件验证选项
 */
export interface FileValidationOptions {
  /** 最大文件大小（字节） */
  maxSize?: number
  /** 最小文件大小（字节） */
  minSize?: number
  /** 允许的文件类型（MIME types） */
  allowedTypes?: string[]
  /** 允许的文件扩展名 */
  allowedExtensions?: string[]
  /** 是否检查文件内容 */
  checkContent?: boolean
}

/**
 * 文本验证选项
 */
export interface TextValidationOptions {
  /** 最小长度 */
  minLength?: number
  /** 最大长度 */
  maxLength?: number
  /** 正则表达式 */
  pattern?: RegExp
  /** 是否允许空白字符 */
  allowWhitespace?: boolean
  /** 是否允许空值 */
  allowEmpty?: boolean
  /** 是否去除首尾空白 */
  trim?: boolean
}

// ==================== 常量定义 ====================

/**
 * 常用文件类型
 */
export const FILE_TYPES = {
  IMAGE: ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp3'],
  VIDEO: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  ARCHIVE: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
}

/**
 * 常用正则表达式
 */
export const REGEX_PATTERNS = {
  /** 邮箱 */
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  /** URL */
  URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  /** 手机号（中国） */
  PHONE_CN: /^1[3-9]\d{9}$/,
  /** 身份证号（中国） */
  ID_CARD_CN: /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/,
  /** IPv4 地址 */
  IPV4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  /** 十六进制颜色 */
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  /** 中文字符 */
  CHINESE: /^[\u4e00-\u9fa5]+$/,
  /** 字母和数字 */
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  /** 仅字母 */
  ALPHA: /^[a-zA-Z]+$/,
  /** 仅数字 */
  NUMERIC: /^[0-9]+$/,
} as const

/**
 * 验证错误代码
 */
export const VALIDATION_ERROR_CODES = {
  REQUIRED: 'REQUIRED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  TOO_SHORT: 'TOO_SHORT',
  TOO_LONG: 'TOO_LONG',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  INVALID_TYPE: 'INVALID_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TOO_SMALL: 'FILE_TOO_SMALL',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  INVALID_EXTENSION: 'INVALID_EXTENSION',
  CONTAINS_MALICIOUS_CONTENT: 'CONTAINS_MALICIOUS_CONTENT',
  INVALID_URL: 'INVALID_URL',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PHONE: 'INVALID_PHONE',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
} as const

// ==================== 基础验证函数 ====================

/**
 * 验证是否为空
 * @param value 值
 * @returns 验证结果
 * 
 * @example
 * isEmpty('') // true
 * isEmpty('  ') // true
 * isEmpty('hello') // false
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

/**
 * 验证是否为非空
 * @param value 值
 * @param message 错误消息
 * @returns 验证结果
 * 
 * @example
 * isRequired('') // { valid: false, message: '此字段为必填项' }
 * isRequired('hello') // { valid: true }
 */
export function isRequired(
  value: any,
  message = '此字段为必填项'
): ValidationResult {
  const valid = !isEmpty(value)
  return {
    valid,
    message: valid ? undefined : message,
    code: valid ? undefined : VALIDATION_ERROR_CODES.REQUIRED,
  }
}

// ==================== 文本验证 ====================

/**
 * 验证文本长度
 * @param text 文本
 * @param options 验证选项
 * @returns 验证结果
 * 
 * @example
 * validateTextLength('hello', { minLength: 3, maxLength: 10 }) // { valid: true }
 * validateTextLength('hi', { minLength: 3 }) // { valid: false, message: '文本长度不能少于3个字符' }
 */
export function validateTextLength(
  text: string,
  options: TextValidationOptions = {}
): ValidationResult {
  const {
    minLength,
    maxLength,
    trim = true,
    allowEmpty = false,
  } = options

  const value = trim ? text.trim() : text

  // 如果允许空值且值为空，直接返回成功
  if (allowEmpty && isEmpty(value)) {
    return { valid: true }
  }

  if (!allowEmpty && isEmpty(value)) {
    return {
      valid: false,
      message: '文本不能为空',
      code: VALIDATION_ERROR_CODES.REQUIRED,
    }
  }

  if (minLength !== undefined && value.length < minLength) {
    return {
      valid: false,
      message: `文本长度不能少于${minLength}个字符`,
      code: VALIDATION_ERROR_CODES.TOO_SHORT,
      data: { minLength, actualLength: value.length },
    }
  }

  if (maxLength !== undefined && value.length > maxLength) {
    return {
      valid: false,
      message: `文本长度不能超过${maxLength}个字符`,
      code: VALIDATION_ERROR_CODES.TOO_LONG,
      data: { maxLength, actualLength: value.length },
    }
  }

  return { valid: true }
}

/**
 * 验证文本格式
 * @param text 文本
 * @param pattern 正则表达式
 * @param message 错误消息
 * @returns 验证结果
 * 
 * @example
 * validateTextPattern('hello123', /^[a-z]+$/) // { valid: false }
 * validateTextPattern('hello', /^[a-z]+$/) // { valid: true }
 */
export function validateTextPattern(
  text: string,
  pattern: RegExp,
  message = '文本格式不正确'
): ValidationResult {
  const valid = pattern.test(text)
  return {
    valid,
    message: valid ? undefined : message,
    code: valid ? undefined : VALIDATION_ERROR_CODES.INVALID_FORMAT,
  }
}

/**
 * 验证是否包含敏感词
 * @param text 文本
 * @param sensitiveWords 敏感词列表
 * @returns 验证结果
 * 
 * @example
 * validateSensitiveWords('这是正常内容', ['敏感词']) // { valid: true }
 * validateSensitiveWords('包含敏感词', ['敏感词']) // { valid: false }
 */
export function validateSensitiveWords(
  text: string,
  sensitiveWords: string[]
): ValidationResult {
  const lowerText = text.toLowerCase()
  const foundWords = sensitiveWords.filter((word) =>
    lowerText.includes(word.toLowerCase())
  )

  if (foundWords.length > 0) {
    return {
      valid: false,
      message: `内容包含敏感词: ${foundWords.join(', ')}`,
      code: VALIDATION_ERROR_CODES.CONTAINS_MALICIOUS_CONTENT,
      data: { sensitiveWords: foundWords },
    }
  }

  return { valid: true }
}

/**
 * 验证是否包含 XSS 攻击代码
 * @param text 文本
 * @returns 验证结果
 * 
 * @example
 * validateXSS('<script>alert("xss")</script>') // { valid: false }
 * validateXSS('正常内容') // { valid: true }
 */
export function validateXSS(text: string): ValidationResult {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ]

  for (const pattern of xssPatterns) {
    if (pattern.test(text)) {
      return {
        valid: false,
        message: '内容包含潜在的安全风险',
        code: VALIDATION_ERROR_CODES.CONTAINS_MALICIOUS_CONTENT,
      }
    }
  }

  return { valid: true }
}

// ==================== 文件验证 ====================

/**
 * 验证文件大小
 * @param file 文件对象
 * @param options 验证选项
 * @returns 验证结果
 * 
 * @example
 * validateFileSize(file, { maxSize: 10 * 1024 * 1024 }) // 最大 10MB
 */
export function validateFileSize(
  file: File,
  options: FileValidationOptions = {}
): ValidationResult {
  const { maxSize, minSize } = options

  if (maxSize !== undefined && file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2)
    return {
      valid: false,
      message: `文件大小不能超过 ${maxSizeMB} MB`,
      code: VALIDATION_ERROR_CODES.FILE_TOO_LARGE,
      data: { maxSize, actualSize: file.size },
    }
  }

  if (minSize !== undefined && file.size < minSize) {
    const minSizeMB = (minSize / (1024 * 1024)).toFixed(2)
    return {
      valid: false,
      message: `文件大小不能小于 ${minSizeMB} MB`,
      code: VALIDATION_ERROR_CODES.FILE_TOO_SMALL,
      data: { minSize, actualSize: file.size },
    }
  }

  return { valid: true }
}

/**
 * 验证文件类型
 * @param file 文件对象
 * @param options 验证选项
 * @returns 验证结果
 * 
 * @example
 * validateFileType(file, { allowedTypes: FILE_TYPES.IMAGE })
 */
export function validateFileType(
  file: File,
  options: FileValidationOptions = {}
): ValidationResult {
  const { allowedTypes, allowedExtensions } = options

  // 验证 MIME 类型
  if (allowedTypes && allowedTypes.length > 0) {
    const isTypeAllowed = allowedTypes.some((type) => {
      // 支持通配符，如 'image/*'
      if (type.endsWith('/*')) {
        const category = type.split('/')[0]
        return file.type.startsWith(category + '/')
      }
      return file.type === type
    })

    if (!isTypeAllowed) {
      return {
        valid: false,
        message: `不支持的文件类型: ${file.type}`,
        code: VALIDATION_ERROR_CODES.INVALID_FILE_TYPE,
        data: { allowedTypes, actualType: file.type },
      }
    }
  }

  // 验证文件扩展名
  if (allowedExtensions && allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const isExtensionAllowed = extension && allowedExtensions.includes(extension)

    if (!isExtensionAllowed) {
      return {
        valid: false,
        message: `不支持的文件扩展名: .${extension}`,
        code: VALIDATION_ERROR_CODES.INVALID_EXTENSION,
        data: { allowedExtensions, actualExtension: extension },
      }
    }
  }

  return { valid: true }
}

/**
 * 综合验证文件
 * @param file 文件对象
 * @param options 验证选项
 * @returns 验证结果
 * 
 * @example
 * validateFile(file, { maxSize: 10 * 1024 * 1024, allowedTypes: FILE_TYPES.IMAGE })
 */
export function validateFile(
  file: File,
  options: FileValidationOptions = {}
): ValidationResult {
  // 验证文件大小
  const sizeResult = validateFileSize(file, options)
  if (!sizeResult.valid) return sizeResult

  // 验证文件类型
  const typeResult = validateFileType(file, options)
  if (!typeResult.valid) return typeResult

  return { valid: true }
}

/**
 * 获取文件类型分类
 * @param mimeType MIME 类型
 * @returns 文件类型分类
 * 
 * @example
 * getFileTypeCategory('image/png') // 'image'
 * getFileTypeCategory('application/pdf') // 'document'
 */
export function getFileTypeCategory(
  mimeType: string
): 'image' | 'document' | 'audio' | 'video' | 'other' {
  if (FILE_TYPES.IMAGE.includes(mimeType)) return 'image'
  if (FILE_TYPES.DOCUMENT.includes(mimeType)) return 'document'
  if (FILE_TYPES.AUDIO.includes(mimeType)) return 'audio'
  if (FILE_TYPES.VIDEO.includes(mimeType)) return 'video'
  return 'other'
}

// ==================== URL 验证 ====================

/**
 * 验证 URL 格式
 * @param url URL 字符串
 * @param options 验证选项
 * @returns 验证结果
 * 
 * @example
 * validateUrl('https://example.com') // { valid: true }
 * validateUrl('not a url') // { valid: false }
 */
export function validateUrl(
  url: string,
  options: {
    requireProtocol?: boolean
    allowedProtocols?: string[]
  } = {}
): ValidationResult {
  const { requireProtocol = false, allowedProtocols = ['http', 'https'] } = options

  try {
    const parsed = new URL(url)

    if (requireProtocol && !parsed.protocol) {
      return {
        valid: false,
        message: 'URL 必须包含协议（如 https://）',
        code: VALIDATION_ERROR_CODES.INVALID_URL,
      }
    }

    if (
      allowedProtocols.length > 0 &&
      !allowedProtocols.includes(parsed.protocol.replace(':', ''))
    ) {
      return {
        valid: false,
        message: `不支持的协议: ${parsed.protocol}`,
        code: VALIDATION_ERROR_CODES.INVALID_URL,
        data: { allowedProtocols },
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      message: 'URL 格式不正确',
      code: VALIDATION_ERROR_CODES.INVALID_URL,
    }
  }
}

/**
 * 验证是否为安全 URL
 * @param url URL 字符串
 * @returns 验证结果
 * 
 * @example
 * validateSafeUrl('https://example.com') // { valid: true }
 * validateSafeUrl('javascript:alert(1)') // { valid: false }
 */
export function validateSafeUrl(url: string): ValidationResult {
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:']

  for (const protocol of dangerousProtocols) {
    if (url.toLowerCase().startsWith(protocol)) {
      return {
        valid: false,
        message: 'URL 包含不安全的协议',
        code: VALIDATION_ERROR_CODES.INVALID_URL,
      }
    }
  }

  return validateUrl(url, { requireProtocol: false })
}

// ==================== 邮箱验证 ====================

/**
 * 验证邮箱格式
 * @param email 邮箱地址
 * @returns 验证结果
 * 
 * @example
 * validateEmail('user@example.com') // { valid: true }
 * validateEmail('invalid-email') // { valid: false }
 */
export function validateEmail(email: string): ValidationResult {
  const valid = REGEX_PATTERNS.EMAIL.test(email)
  return {
    valid,
    message: valid ? undefined : '邮箱格式不正确',
    code: valid ? undefined : VALIDATION_ERROR_CODES.INVALID_EMAIL,
  }
}

// ==================== 数字验证 ====================

/**
 * 验证数字范围
 * @param value 数值
 * @param options 验证选项
 * @returns 验证结果
 * 
 * @example
 * validateNumberRange(5, { min: 1, max: 10 }) // { valid: true }
 * validateNumberRange(15, { max: 10 }) // { valid: false }
 */
export function validateNumberRange(
  value: number,
  options: {
    min?: number
    max?: number
    allowFloat?: boolean
  } = {}
): ValidationResult {
  const { min, max, allowFloat = true } = options

  if (!allowFloat && !Number.isInteger(value)) {
    return {
      valid: false,
      message: '必须为整数',
      code: VALIDATION_ERROR_CODES.INVALID_FORMAT,
    }
  }

  if (min !== undefined && value < min) {
    return {
      valid: false,
      message: `数值不能小于 ${min}`,
      code: VALIDATION_ERROR_CODES.OUT_OF_RANGE,
      data: { min, actualValue: value },
    }
  }

  if (max !== undefined && value > max) {
    return {
      valid: false,
      message: `数值不能大于 ${max}`,
      code: VALIDATION_ERROR_CODES.OUT_OF_RANGE,
      data: { max, actualValue: value },
    }
  }

  return { valid: true }
}

/**
 * 验证是否为正数
 * @param value 数值
 * @param allowZero 是否允许零
 * @returns 验证结果
 * 
 * @example
 * validatePositiveNumber(5) // { valid: true }
 * validatePositiveNumber(0, true) // { valid: true }
 * validatePositiveNumber(-5) // { valid: false }
 */
export function validatePositiveNumber(
  value: number,
  allowZero = false
): ValidationResult {
  const valid = allowZero ? value >= 0 : value > 0
  return {
    valid,
    message: valid ? undefined : allowZero ? '必须为非负数' : '必须为正数',
    code: valid ? undefined : VALIDATION_ERROR_CODES.OUT_OF_RANGE,
  }
}

// ==================== 密码验证 ====================

/**
 * 密码强度选项
 */
export interface PasswordStrengthOptions {
  /** 最小长度 */
  minLength?: number
  /** 最大长度 */
  maxLength?: number
  /** 是否需要大写字母 */
  requireUppercase?: boolean
  /** 是否需要小写字母 */
  requireLowercase?: boolean
  /** 是否需要数字 */
  requireNumbers?: boolean
  /** 是否需要特殊字符 */
  requireSpecialChars?: boolean
}

/**
 * 验证密码强度
 * @param password 密码
 * @param options 验证选项
 * @returns 验证结果
 * 
 * @example
 * validatePasswordStrength('Abc123!@#') // { valid: true }
 * validatePasswordStrength('weak', { minLength: 8 }) // { valid: false }
 */
export function validatePasswordStrength(
  password: string,
  options: PasswordStrengthOptions = {}
): ValidationResult {
  const {
    minLength = 8,
    maxLength = 128,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecialChars = true,
  } = options

  const errors: string[] = []

  // 检查长度（收集错误而不是直接返回）
  const lengthResult = validateTextLength(password, {
    minLength,
    maxLength,
    allowEmpty: false,
  })
  if (!lengthResult.valid) {
    // 将长度错误添加到错误列表
    if (lengthResult.message) {
      errors.push(lengthResult.message)
    }
  }

  // 检查大写字母
  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('至少包含一个大写字母')
  }

  // 检查小写字母
  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('至少包含一个小写字母')
  }

  // 检查数字
  if (requireNumbers && !/\d/.test(password)) {
    errors.push('至少包含一个数字')
  }

  // 检查特殊字符
  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('至少包含一个特殊字符')
  }

  if (errors.length > 0) {
    return {
      valid: false,
      message: `密码强度不足: ${errors.join(', ')}`,
      code: VALIDATION_ERROR_CODES.PASSWORD_TOO_WEAK,
      data: { errors },
    }
  }

  return { valid: true }
}

// ==================== 消息验证 ====================

/**
 * 验证消息内容
 * @param content 消息内容
 * @param options 验证选项
 * @returns 验证结果
 * 
 * @example
 * validateMessage('Hello') // { valid: true }
 * validateMessage('', { minLength: 1 }) // { valid: false }
 */
export function validateMessage(
  content: string,
  options: {
    minLength?: number
    maxLength?: number
    allowEmpty?: boolean
    checkXSS?: boolean
    sensitiveWords?: string[]
  } = {}
): ValidationResult {
  const {
    minLength = 1,
    maxLength = 10000,
    allowEmpty = false,
    checkXSS = true,
    sensitiveWords = [],
  } = options

  // 验证长度
  const lengthResult = validateTextLength(content, {
    minLength,
    maxLength,
    allowEmpty,
  })
  if (!lengthResult.valid) return lengthResult

  // 验证 XSS
  if (checkXSS) {
    const xssResult = validateXSS(content)
    if (!xssResult.valid) return xssResult
  }

  // 验证敏感词
  if (sensitiveWords.length > 0) {
    const sensitiveResult = validateSensitiveWords(content, sensitiveWords)
    if (!sensitiveResult.valid) return sensitiveResult
  }

  return { valid: true }
}

// ==================== 批量验证 ====================

/**
 * 批量验证
 * @param value 要验证的值
 * @param rules 验证规则列表
 * @returns 验证结果
 * 
 * @example
 * validateAll('test@example.com', [
 *   { name: 'required', validator: (v) => isRequired(v) },
 *   { name: 'email', validator: (v) => validateEmail(v) }
 * ])
 */
export function validateAll(
  value: any,
  rules: ValidationRule[]
): ValidationResult {
  for (const rule of rules) {
    const result = rule.validator(value)

    // 处理返回布尔值的验证函数
    if (typeof result === 'boolean') {
      if (!result) {
        return {
          valid: false,
          message: rule.message || '验证失败',
          code: VALIDATION_ERROR_CODES.INVALID_FORMAT,
        }
      }
      continue
    }

    // 处理返回 ValidationResult 的验证函数
    if (!result.valid) {
      // 如果规则提供了自定义消息，使用它覆盖验证器返回的消息
      return {
        ...result,
        message: rule.message || result.message,
      }
    }
  }

  return { valid: true }
}

/**
 * 批量验证多个字段
 * @param data 数据对象
 * @param schema 验证模式
 * @returns 验证结果
 * 
 * @example
 * validateSchema(
 *   { email: 'test@example.com', age: 25 },
 *   {
 *     email: [(v) => validateEmail(v)],
 *     age: [(v) => validateNumberRange(v, { min: 0, max: 150 })]
 *   }
 * )
 */
export function validateSchema(
  data: Record<string, any>,
  schema: Record<string, Array<(value: any) => ValidationResult>>
): {
  valid: boolean
  errors: Record<string, string>
} {
  const errors: Record<string, string> = {}

  for (const [field, validators] of Object.entries(schema)) {
    const value = data[field]

    for (const validator of validators) {
      const result = validator(value)
      if (!result.valid) {
        errors[field] = result.message || '验证失败'
        break
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

// ==================== 导出所有验证函数 ====================

export default {
  // 基础验证
  isEmpty,
  isRequired,

  // 文本验证
  validateTextLength,
  validateTextPattern,
  validateSensitiveWords,
  validateXSS,

  // 文件验证
  validateFileSize,
  validateFileType,
  validateFile,
  getFileTypeCategory,

  // URL 验证
  validateUrl,
  validateSafeUrl,

  // 邮箱验证
  validateEmail,

  // 数字验证
  validateNumberRange,
  validatePositiveNumber,

  // 密码验证
  validatePasswordStrength,

  // 消息验证
  validateMessage,

  // 批量验证
  validateAll,
  validateSchema,

  // 常量
  FILE_TYPES,
  REGEX_PATTERNS,
  VALIDATION_ERROR_CODES,
}

