/**
 * 工具函数统一导出
 * 
 * 提供全面的工具函数，包括：
 * - 格式化函数（formatters）
 * - 验证函数（validators）
 * - 辅助函数（helpers）
 * - 常量定义（constants）
 * - 日志工具（logger）
 * - 防抖节流（debounce）
 * 
 * @module utils
 */

// ==================== 格式化工具 ====================
export {
  // 文件大小
  formatFileSize,
  formatFileSizeCompact,
  
  // 时间和日期
  formatDuration,
  formatDurationCompact,
  formatRelativeTime,
  formatDateTime,
  formatSmartDateTime,
  
  // 文本
  truncateText,
  escapeHtml,
  stripHtml,
  highlightKeyword,
  nl2br,
  camelToKebab,
  kebabToCamel,
  capitalize,
  titleCase,
  
  // 数字
  formatNumber,
  formatPercentage,
  formatCompactNumber,
  
  // Token 和使用量
  formatTokenUsage,
  formatCost,
  
  // URL
  formatUrl,
  extractDomain,
  
  // 消息
  formatMessagePreview,
  formatCodeBlock,
  formatQuote,
  
  // 列表
  formatList,
  
  // 数据
  formatJson,
  formatQueryString,
} from './formatters'

export type {
  FileSizeFormatOptions,
  TimeFormatOptions,
  TruncateOptions,
} from './formatters'

// ==================== 验证工具 ====================
export {
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
} from './validators'

export type {
  ValidationResult,
  ValidationRule,
  FileValidationOptions,
  TextValidationOptions,
  PasswordStrengthOptions,
} from './validators'

// ==================== 常量定义 ====================
export * from './constants'

// ==================== 辅助函数 ====================
export * from './helpers'

// ==================== 防抖节流 ====================
export {
  debounce,
  throttle,
  adaptiveDebounce,
  throttleWithCount,
  rafThrottle,
  idleDebounce,
  debounceThrottle,
  conditionalDebounce,
  debouncePromise,
  throttlePromise,
} from './debounce'

export type {
  DebounceOptions,
  ThrottleOptions,
  DebouncedFunction,
  ThrottledFunction,
} from './debounce'

// ==================== 日志系统 ====================
export {
  Logger,
  LogLevel,
  logger,
  debug,
  info,
  warn,
  error,
  fatal,
  measurePerformance,
} from './logger'

export type {
  LogEntry,
  LoggerConfig,
  LogFilter,
  LogStats,
  PerformanceMetrics,
} from './logger'

// ==================== 默认导出 ====================
export { default as formatters } from './formatters'
export { default as validators } from './validators'
export { default as constants } from './constants'
export { default as helpers } from './helpers'
export { default as debounceUtils } from './debounce'
export { default as logger } from './logger'

// ==================== 工具类型 ====================

/**
 * 深度部分类型
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * 必需的键
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K
}[keyof T]

/**
 * 可选的键
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never
}[keyof T]

/**
 * 只读递归
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P]
}

/**
 * 提取 Promise 的返回类型
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

/**
 * 提取数组的元素类型
 */
export type ArrayElement<T> = T extends Array<infer U> ? U : never

// ==================== 常用辅助函数 ====================

/**
 * 睡眠函数
 * @param ms 毫秒数
 * @returns Promise
 * 
 * @example
 * await sleep(1000) // 睡眠 1 秒
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 重试函数
 * @param fn 要执行的函数
 * @param options 重试选项
 * @returns Promise
 * 
 * @example
 * await retry(() => fetchData(), { maxAttempts: 3, delay: 1000 })
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    delay?: number
    backoff?: boolean
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = false } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt < maxAttempts) {
        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay
        await sleep(waitTime)
      }
    }
  }

  throw lastError
}

/**
 * 深拷贝
 * @param obj 要拷贝的对象
 * @returns 拷贝后的对象
 * 
 * @example
 * const copied = deepClone({ a: 1, b: { c: 2 } })
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as any
  }

  if (obj instanceof Object) {
    const clonedObj: any = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }

  return obj
}

/**
 * 深度合并对象
 * @param target 目标对象
 * @param sources 源对象
 * @returns 合并后的对象
 * 
 * @example
 * const merged = deepMerge({ a: 1 }, { b: 2 }, { c: 3 })
 */
export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target

  const source = sources.shift()

  if (source === undefined) {
    return target
  }

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} })
        }
        deepMerge(target[key] as any, source[key] as any)
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return deepMerge(target, ...sources)
}

/**
 * 检查是否为对象
 * @param item 要检查的项
 * @returns 是否为对象
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item)
}

/**
 * 生成唯一 ID
 * @param prefix 前缀
 * @returns 唯一 ID
 * 
 * @example
 * generateId('msg') // 'msg-1234567890-abc'
 */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 9)
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`
}

/**
 * 简单节流函数（简化版本）
 * @param fn 要节流的函数
 * @param delay 延迟时间（毫秒）
 * @returns 节流后的函数
 * 
 * @deprecated 推荐使用 './debounce' 中的完整版本
 * 
 * @example
 * const throttled = simpleThrottle(() => console.log('throttled'), 1000)
 */
export function simpleThrottle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      fn.apply(this, args)
    }
  }
}

/**
 * 简单防抖函数（简化版本）
 * @param fn 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 * 
 * @deprecated 推荐使用 './debounce' 中的完整版本
 * 
 * @example
 * const debounced = simpleDebounce(() => console.log('debounced'), 1000)
 */
export function simpleDebounce<T extends (...args: any[]) => any>(
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
 * 数组去重
 * @param arr 数组
 * @param key 可选的键（用于对象数组）
 * @returns 去重后的数组
 * 
 * @example
 * unique([1, 2, 2, 3]) // [1, 2, 3]
 * unique([{id: 1}, {id: 1}, {id: 2}], 'id') // [{id: 1}, {id: 2}]
 */
export function unique<T>(arr: T[], key?: keyof T): T[] {
  if (!key) {
    return Array.from(new Set(arr))
  }

  const seen = new Set()
  return arr.filter((item) => {
    const value = item[key]
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}

/**
 * 数组分组
 * @param arr 数组
 * @param key 分组键
 * @returns 分组后的对象
 * 
 * @example
 * groupBy([{type: 'a', val: 1}, {type: 'b', val: 2}, {type: 'a', val: 3}], 'type')
 * // { a: [{type: 'a', val: 1}, {type: 'a', val: 3}], b: [{type: 'b', val: 2}] }
 */
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((result, item) => {
    const group = String(item[key])
    if (!result[group]) {
      result[group] = []
    }
    result[group].push(item)
    return result
  }, {} as Record<string, T[]>)
}

/**
 * 数组分块
 * @param arr 数组
 * @param size 块大小
 * @returns 分块后的数组
 * 
 * @example
 * chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

/**
 * 范围数组
 * @param start 开始值
 * @param end 结束值
 * @param step 步长
 * @returns 范围数组
 * 
 * @example
 * range(1, 5) // [1, 2, 3, 4, 5]
 * range(0, 10, 2) // [0, 2, 4, 6, 8, 10]
 */
export function range(start: number, end: number, step = 1): number[] {
  const result: number[] = []
  for (let i = start; i <= end; i += step) {
    result.push(i)
  }
  return result
}

/**
 * 随机整数
 * @param min 最小值
 * @param max 最大值
 * @returns 随机整数
 * 
 * @example
 * randomInt(1, 10) // 1-10 之间的随机整数
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 随机选择数组元素
 * @param arr 数组
 * @returns 随机元素
 * 
 * @example
 * randomChoice([1, 2, 3, 4, 5]) // 随机返回其中一个元素
 */
export function randomChoice<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)]
}

/**
 * 洗牌算法
 * @param arr 数组
 * @returns 洗牌后的新数组
 * 
 * @example
 * shuffle([1, 2, 3, 4, 5]) // 返回打乱顺序的新数组
 */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * 对象键值互换
 * @param obj 对象
 * @returns 键值互换后的对象
 * 
 * @example
 * invert({ a: '1', b: '2' }) // { '1': 'a', '2': 'b' }
 */
export function invert(obj: Record<string, string>): Record<string, string> {
  return Object.entries(obj).reduce(
    (result, [key, value]) => {
      result[value] = key
      return result
    },
    {} as Record<string, string>
  )
}

/**
 * 选取对象的部分属性
 * @param obj 对象
 * @param keys 要选取的键
 * @returns 新对象
 * 
 * @example
 * pick({ a: 1, b: 2, c: 3 }, ['a', 'c']) // { a: 1, c: 3 }
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return keys.reduce(
    (result, key) => {
      if (key in obj) {
        result[key] = obj[key]
      }
      return result
    },
    {} as Pick<T, K>
  )
}

/**
 * 省略对象的部分属性
 * @param obj 对象
 * @param keys 要省略的键
 * @returns 新对象
 * 
 * @example
 * omit({ a: 1, b: 2, c: 3 }, ['b']) // { a: 1, c: 3 }
 */
export function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj }
  keys.forEach((key) => {
    delete result[key]
  })
  return result
}

