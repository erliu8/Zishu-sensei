/**
 * 消息格式化工具
 * 
 * 提供全面的格式化功能，包括：
 * - 文件大小格式化
 * - 时间和日期格式化
 * - 文本格式化和截断
 * - 数字格式化
 * - URL 格式化
 * - 消息内容格式化
 * - Token 使用量格式化
 * - Markdown 格式化
 * 
 * @module formatters
 */

// ==================== 文件大小格式化 ====================

/**
 * 文件大小格式化选项
 */
export interface FileSizeFormatOptions {
  /** 精度（小数位数），默认 2 */
  precision?: number
  /** 单位系统：binary (1024) 或 decimal (1000)，默认 binary */
  unit?: 'binary' | 'decimal'
  /** 语言环境，默认 'zh-CN' */
  locale?: string
  /** 是否使用简写单位，默认 true */
  shortUnit?: boolean
  /** 是否添加空格，默认 true */
  addSpace?: boolean
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @param options 格式化选项
 * @returns 格式化后的文件大小字符串
 * 
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1536000) // "1.46 MB"
 * formatFileSize(1024, { unit: 'decimal' }) // "1.02 KB"
 */
export function formatFileSize(
  bytes: number,
  options: FileSizeFormatOptions = {}
): string {
  const {
    precision = 2,
    unit = 'binary',
    locale = 'zh-CN',
    shortUnit = true,
    addSpace = true,
  } = options

  if (bytes === 0) return '0 B'
  if (!isFinite(bytes) || bytes < 0) return 'N/A'

  const base = unit === 'binary' ? 1024 : 1000
  const sizes = shortUnit
    ? ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
    : ['字节', '千字节', '兆字节', '吉字节', '太字节', '拍字节']

  const index = Math.floor(Math.log(bytes) / Math.log(base))
  const value = bytes / Math.pow(base, index)
  
  const formattedValue = value.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  })

  const space = addSpace ? ' ' : ''
  return `${formattedValue}${space}${sizes[index]}`
}

/**
 * 格式化文件大小（紧凑格式，用于 UI 显示）
 * @param bytes 字节数
 * @returns 紧凑的文件大小字符串
 * 
 * @example
 * formatFileSizeCompact(1536000) // "1.5MB"
 */
export function formatFileSizeCompact(bytes: number): string {
  return formatFileSize(bytes, {
    precision: 1,
    shortUnit: true,
    addSpace: false,
  })
}

// ==================== 时间和日期格式化 ====================

/**
 * 时间格式化选项
 */
export interface TimeFormatOptions {
  /** 是否显示毫秒 */
  showMilliseconds?: boolean
  /** 是否使用12小时制 */
  use12Hour?: boolean
  /** 语言环境 */
  locale?: string
}

/**
 * 格式化时长（毫秒转换为可读格式）
 * @param ms 毫秒数
 * @param options 格式化选项
 * @returns 格式化后的时长字符串
 * 
 * @example
 * formatDuration(1500) // "1.5秒"
 * formatDuration(65000) // "1分5秒"
 * formatDuration(3665000) // "1小时1分5秒"
 */
export function formatDuration(
  ms: number,
  options: { verbose?: boolean } = {}
): string {
  if (!isFinite(ms) || ms < 0) return 'N/A'

  const { verbose = false } = options

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return verbose
      ? `${days}天${remainingHours > 0 ? ` ${remainingHours}小时` : ''}`
      : `${days}天`
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return verbose
      ? `${hours}小时${remainingMinutes > 0 ? ` ${remainingMinutes}分` : ''}`
      : `${hours}小时`
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return verbose
      ? `${minutes}分${remainingSeconds > 0 ? ` ${remainingSeconds}秒` : ''}`
      : `${minutes}分`
  }

  if (seconds > 0) {
    return `${seconds}秒`
  }

  return `${ms}毫秒`
}

/**
 * 格式化时长为简短格式（用于计时器显示）
 * @param ms 毫秒数
 * @returns 格式化的时长字符串（HH:MM:SS）
 * 
 * @example
 * formatDurationCompact(65000) // "01:05"
 * formatDurationCompact(3665000) // "01:01:05"
 */
export function formatDurationCompact(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '00:00'

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, '0')

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

/**
 * 格式化时间戳为相对时间
 * @param timestamp 时间戳（毫秒）
 * @returns 相对时间字符串
 * 
 * @example
 * formatRelativeTime(Date.now() - 30000) // "30秒前"
 * formatRelativeTime(Date.now() - 3600000) // "1小时前"
 * formatRelativeTime(Date.now() + 86400000) // "明天"
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const absDiff = Math.abs(diff)

  const seconds = Math.floor(absDiff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  const future = diff < 0

  if (seconds < 10) return '刚刚'
  if (seconds < 60) return future ? `${seconds}秒后` : `${seconds}秒前`
  if (minutes < 60) return future ? `${minutes}分钟后` : `${minutes}分钟前`
  if (hours < 24) return future ? `${hours}小时后` : `${hours}小时前`
  if (days === 1) return future ? '明天' : '昨天'
  if (days < 7) return future ? `${days}天后` : `${days}天前`
  if (weeks < 4) return future ? `${weeks}周后` : `${weeks}周前`
  if (months < 12) return future ? `${months}个月后` : `${months}个月前`
  return future ? `${years}年后` : `${years}年前`
}

/**
 * 格式化时间戳为完整日期时间
 * @param timestamp 时间戳（毫秒）
 * @param options 格式化选项
 * @returns 格式化的日期时间字符串
 * 
 * @example
 * formatDateTime(1609459200000) // "2021-01-01 00:00:00"
 */
export function formatDateTime(
  timestamp: number,
  options: {
    showTime?: boolean
    showSeconds?: boolean
    locale?: string
  } = {}
): string {
  const {
    showTime = true,
    showSeconds = true,
  } = options

  const date = new Date(timestamp)

  if (!isFinite(date.getTime())) return 'N/A'

  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  const second = date.getSeconds().toString().padStart(2, '0')

  let result = `${year}-${month}-${day}`

  if (showTime) {
    result += ` ${hour}:${minute}`
    if (showSeconds) {
      result += `:${second}`
    }
  }

  return result
}

/**
 * 格式化时间戳为友好的日期时间（智能选择格式）
 * @param timestamp 时间戳（毫秒）
 * @returns 友好的日期时间字符串
 * 
 * @example
 * formatSmartDateTime(Date.now() - 3600000) // "1小时前"
 * formatSmartDateTime(Date.now() - 86400000 * 2) // "2天前"
 * formatSmartDateTime(Date.now() - 86400000 * 10) // "2021-01-01"
 */
export function formatSmartDateTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  // 7天内使用相对时间
  if (days < 7) {
    return formatRelativeTime(timestamp)
  }

  // 今年内只显示月-日
  const date = new Date(timestamp)
  const nowDate = new Date(now)
  
  if (date.getFullYear() === nowDate.getFullYear()) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${month}-${day}`
  }

  // 其他情况显示完整日期
  return formatDateTime(timestamp, { showTime: false, showSeconds: false })
}

// ==================== 文本格式化 ====================

/**
 * 文本截断选项
 */
export interface TruncateOptions {
  /** 最大长度 */
  maxLength: number
  /** 省略符号，默认 '...' */
  ellipsis?: string
  /** 截断位置：'end' | 'middle' | 'start'，默认 'end' */
  position?: 'end' | 'middle' | 'start'
  /** 是否在单词边界截断 */
  wordBoundary?: boolean
}

/**
 * 截断文本
 * @param text 原始文本
 * @param options 截断选项
 * @returns 截断后的文本
 * 
 * @example
 * truncateText('Hello World', { maxLength: 8 }) // "Hello..."
 * truncateText('Hello World', { maxLength: 8, position: 'middle' }) // "Hel...ld"
 */
export function truncateText(
  text: string,
  options: TruncateOptions
): string {
  const {
    maxLength,
    ellipsis = '...',
    position = 'end',
    wordBoundary = false,
  } = options

  if (text.length <= maxLength) return text

  const ellipsisLength = ellipsis.length

  if (position === 'start') {
    return ellipsis + text.slice(text.length - maxLength + ellipsisLength)
  }

  if (position === 'middle') {
    const charsToShow = maxLength - ellipsisLength
    const frontChars = Math.ceil(charsToShow / 2)
    const backChars = Math.floor(charsToShow / 2)
    return text.slice(0, frontChars) + ellipsis + text.slice(text.length - backChars)
  }

  // position === 'end'
  let truncated = text.slice(0, maxLength - ellipsisLength)

  if (wordBoundary) {
    const lastSpace = truncated.lastIndexOf(' ')
    if (lastSpace > 0) {
      truncated = truncated.slice(0, lastSpace)
    }
  }

  return truncated + ellipsis
}

/**
 * 转义 HTML 特殊字符
 * @param html HTML 字符串
 * @returns 转义后的字符串
 * 
 * @example
 * escapeHtml('<script>alert("xss")</script>') // "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 */
export function escapeHtml(html: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  }
  return html.replace(/[&<>"'/]/g, (char) => map[char])
}

/**
 * 移除 HTML 标签
 * @param html HTML 字符串
 * @returns 纯文本
 * 
 * @example
 * stripHtml('<p>Hello <strong>World</strong></p>') // "Hello World"
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

/**
 * 高亮关键词
 * @param text 原始文本
 * @param keyword 关键词
 * @param className 高亮类名，默认 'highlight'
 * @returns 带高亮标记的 HTML 字符串
 * 
 * @example
 * highlightKeyword('Hello World', 'World') // 'Hello <mark class="highlight">World</mark>'
 */
export function highlightKeyword(
  text: string,
  keyword: string,
  className = 'highlight'
): string {
  if (!keyword) return escapeHtml(text)

  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedKeyword})`, 'gi')

  return escapeHtml(text).replace(
    regex,
    `<mark class="${className}">$1</mark>`
  )
}

/**
 * 格式化换行符为 HTML
 * @param text 文本
 * @returns HTML 字符串
 * 
 * @example
 * nl2br('Line 1\nLine 2') // 'Line 1<br/>Line 2'
 */
export function nl2br(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br/>')
}

/**
 * 驼峰转短横线
 * @param str 驼峰字符串
 * @returns 短横线字符串
 * 
 * @example
 * camelToKebab('helloWorld') // 'hello-world'
 */
export function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/**
 * 短横线转驼峰
 * @param str 短横线字符串
 * @returns 驼峰字符串
 * 
 * @example
 * kebabToCamel('hello-world') // 'helloWorld'
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * 首字母大写
 * @param str 字符串
 * @returns 首字母大写的字符串
 * 
 * @example
 * capitalize('hello world') // 'Hello world'
 */
export function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * 每个单词首字母大写
 * @param str 字符串
 * @returns 标题格式的字符串
 * 
 * @example
 * titleCase('hello world') // 'Hello World'
 */
export function titleCase(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase())
}

// ==================== 数字格式化 ====================

/**
 * 格式化数字（添加千分位分隔符）
 * @param num 数字
 * @param options 格式化选项
 * @returns 格式化后的数字字符串
 * 
 * @example
 * formatNumber(1234567.89) // "1,234,567.89"
 * formatNumber(1234567.89, { locale: 'de-DE' }) // "1.234.567,89"
 */
export function formatNumber(
  num: number,
  options: {
    locale?: string
    minimumFractionDigits?: number
    maximumFractionDigits?: number
  } = {}
): string {
  const {
    locale = 'zh-CN',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options

  if (!isFinite(num)) return 'N/A'

  return num.toLocaleString(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  })
}

/**
 * 格式化百分比
 * @param value 数值（0-1 或 0-100）
 * @param options 格式化选项
 * @returns 格式化的百分比字符串
 * 
 * @example
 * formatPercentage(0.856) // "85.6%"
 * formatPercentage(85.6, { isDecimal: false }) // "85.6%"
 */
export function formatPercentage(
  value: number,
  options: {
    precision?: number
    isDecimal?: boolean
  } = {}
): string {
  const { precision = 1, isDecimal = true } = options

  if (!isFinite(value)) return 'N/A'

  const percentage = isDecimal ? value * 100 : value
  return `${percentage.toFixed(precision)}%`
}

/**
 * 格式化为紧凑数字（K, M, B 等）
 * @param num 数字
 * @param options 格式化选项
 * @returns 紧凑格式的数字字符串
 * 
 * @example
 * formatCompactNumber(1234) // "1.2K"
 * formatCompactNumber(1234567) // "1.2M"
 */
export function formatCompactNumber(
  num: number,
  options: { precision?: number } = {}
): string {
  const { precision = 1 } = options

  if (!isFinite(num)) return 'N/A'
  if (num < 1000) return num.toString()

  const units = ['', 'K', 'M', 'B', 'T']
  const index = Math.floor(Math.log10(Math.abs(num)) / 3)
  const value = num / Math.pow(1000, index)

  return `${value.toFixed(precision)}${units[index]}`
}

// ==================== Token 和使用量格式化 ====================

/**
 * 格式化 Token 使用量
 * @param usage Token 使用情况
 * @returns 格式化的使用量字符串
 * 
 * @example
 * formatTokenUsage({ prompt: 100, completion: 200, total: 300 }) // "300 tokens (提示: 100, 完成: 200)"
 */
export function formatTokenUsage(usage: {
  prompt?: number
  completion?: number
  total: number
}): string {
  const { prompt, completion, total } = usage

  let result = `${formatCompactNumber(total)} tokens`

  if (prompt !== undefined && completion !== undefined) {
    result += ` (提示: ${formatCompactNumber(prompt)}, 完成: ${formatCompactNumber(completion)})`
  }

  return result
}

/**
 * 格式化成本（基于 Token 使用量）
 * @param tokens Token 数量
 * @param pricePerToken 每个 Token 的价格
 * @returns 格式化的成本字符串
 * 
 * @example
 * formatCost(1000, 0.00002) // "¥0.02"
 */
export function formatCost(tokens: number, pricePerToken: number): string {
  const cost = tokens * pricePerToken
  return `¥${cost.toFixed(4)}`
}

// ==================== URL 格式化 ====================

/**
 * 格式化 URL（截断长 URL）
 * @param url URL 字符串
 * @param maxLength 最大长度
 * @returns 格式化的 URL 字符串
 * 
 * @example
 * formatUrl('https://example.com/very/long/path', 30) // "https://example.com/very...path"
 */
export function formatUrl(url: string, maxLength = 50): string {
  if (url.length <= maxLength) return url

  try {
    const parsed = new URL(url)
    const domain = parsed.hostname
    const path = parsed.pathname + parsed.search

    if (domain.length + 10 >= maxLength) {
      return truncateText(url, { maxLength, position: 'middle' })
    }

    const availableLength = maxLength - domain.length - 10 // 10 for protocol and ellipsis
    const truncatedPath = truncateText(path, {
      maxLength: availableLength,
      position: 'middle',
    })

    return `${parsed.protocol}//${domain}${truncatedPath}`
  } catch {
    return truncateText(url, { maxLength, position: 'middle' })
  }
}

/**
 * 从 URL 提取域名
 * @param url URL 字符串
 * @returns 域名
 * 
 * @example
 * extractDomain('https://www.example.com/path') // "example.com"
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// ==================== 消息格式化 ====================

/**
 * 格式化消息内容预览
 * @param content 消息内容
 * @param maxLength 最大长度
 * @returns 预览文本
 * 
 * @example
 * formatMessagePreview('很长的消息内容...', 20) // "很长的消息内容..."
 */
export function formatMessagePreview(
  content: string,
  maxLength = 100
): string {
  // 移除多余的空白字符
  const cleaned = content.replace(/\s+/g, ' ').trim()

  return truncateText(cleaned, {
    maxLength,
    position: 'end',
    wordBoundary: true,
  })
}

/**
 * 格式化 Markdown 代码块
 * @param code 代码内容
 * @param language 编程语言
 * @returns Markdown 格式的代码块
 * 
 * @example
 * formatCodeBlock('console.log("hello")', 'javascript') // "```javascript\nconsole.log(\"hello\")\n```"
 */
export function formatCodeBlock(code: string, language = ''): string {
  return `\`\`\`${language}\n${code}\n\`\`\``
}

/**
 * 格式化引用文本
 * @param text 文本内容
 * @returns Markdown 格式的引用
 * 
 * @example
 * formatQuote('引用的内容') // "> 引用的内容"
 */
export function formatQuote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

// ==================== 列表和数组格式化 ====================

/**
 * 格式化数组为逗号分隔的字符串
 * @param items 数组
 * @param options 格式化选项
 * @returns 格式化的字符串
 * 
 * @example
 * formatList(['apple', 'banana', 'cherry']) // "apple, banana, cherry"
 * formatList(['apple', 'banana', 'cherry'], { maxItems: 2 }) // "apple, banana 和 1 项"
 */
export function formatList(
  items: string[],
  options: {
    maxItems?: number
    separator?: string
    lastSeparator?: string
  } = {}
): string {
  const {
    maxItems = Infinity,
    separator = ', ',
    lastSeparator = ' 和 ',
  } = options

  if (items.length === 0) return ''
  if (items.length === 1) return items[0]

  if (items.length > maxItems) {
    const visible = items.slice(0, maxItems)
    const remaining = items.length - maxItems
    return `${visible.join(separator)}${separator}另外 ${remaining} 项`
  }

  const allButLast = items.slice(0, -1)
  const last = items[items.length - 1]

  return `${allButLast.join(separator)}${lastSeparator}${last}`
}

// ==================== 数据格式化 ====================

/**
 * 格式化 JSON（美化输出）
 * @param data 数据对象
 * @param indent 缩进空格数
 * @returns 格式化的 JSON 字符串
 * 
 * @example
 * formatJson({ name: 'John', age: 30 }) // "{\n  \"name\": \"John\",\n  \"age\": 30\n}"
 */
export function formatJson(data: any, indent = 2): string {
  try {
    return JSON.stringify(data, null, indent)
  } catch (error) {
    return String(data)
  }
}

/**
 * 格式化对象为查询字符串
 * @param params 参数对象
 * @returns 查询字符串
 * 
 * @example
 * formatQueryString({ page: 1, limit: 10 }) // "page=1&limit=10"
 */
export function formatQueryString(params: Record<string, any>): string {
  return Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

// ==================== 导出所有格式化函数 ====================

export default {
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
}

