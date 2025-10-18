/**
 * 辅助工具函数
 * 
 * 提供各种实用的辅助函数
 * 包括数据处理、格式转换、验证、工具方法等
 * 
 * @module utils/helpers
 * @author zishu-sensei
 * @version 1.0.0
 */

import {
    TIME_FORMATS,
    TIME_UNITS,
    FILE_SIZE_UNITS,
    REGEX_PATTERNS,
} from './constants'

// ================================
// 类型定义
// ================================

/**
 * 深度部分类型
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

/**
 * 可选键类型
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/**
 * 必需键类型
 */
export type Required<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: T[P] }

// ================================
// 对象处理函数
// ================================

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as any
    }

    if (obj instanceof Array) {
        return obj.map(item => deepClone(item)) as any
    }

    if (obj instanceof Object) {
        const clonedObj = {} as T
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                clonedObj[key] = deepClone(obj[key])
            }
        }
        return clonedObj
    }

    return obj
}

/**
 * 深度合并对象
 */
export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
    if (!sources.length) return target

    const source = sources.shift()
    if (!source) return target

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                const sourceValue = source[key]
                const targetValue = target[key]

                if (isObject(sourceValue) && isObject(targetValue)) {
                    target[key] = deepMerge(
                        Object.assign({}, targetValue),
                        sourceValue as any
                    ) as any
                } else {
                    target[key] = sourceValue as any
                }
            }
        }
    }

    return deepMerge(target, ...sources)
}

/**
 * 检查是否为对象
 */
export function isObject(item: any): item is object {
    return item !== null && typeof item === 'object' && !Array.isArray(item)
}

/**
 * 获取对象的嵌套属性值
 */
export function getNestedValue<T = any>(obj: any, path: string, defaultValue?: T): T {
    const keys = path.split('.')
    let result = obj

    for (const key of keys) {
        if (result === null || result === undefined) {
            return defaultValue as T
        }
        result = result[key]
    }

    return result !== undefined ? result : (defaultValue as T)
}

/**
 * 设置对象的嵌套属性值
 */
export function setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()

    if (!lastKey) return

    let current = obj
    for (const key of keys) {
        if (!(key in current)) {
            current[key] = {}
        }
        current = current[key]
    }

    current[lastKey] = value
}

/**
 * 从对象中挑选指定的键
 */
export function pick<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
): Pick<T, K> {
    const result = {} as Pick<T, K>
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key]
        }
    }
    return result
}

/**
 * 从对象中排除指定的键
 */
export function omit<T extends object, K extends keyof T>(
    obj: T,
    keys: K[]
): Omit<T, K> {
    const result = { ...obj }
    for (const key of keys) {
        delete result[key]
    }
    return result as Omit<T, K>
}

/**
 * 检查对象是否为空
 */
export function isEmpty(obj: any): boolean {
    if (obj === null || obj === undefined) return true
    if (typeof obj === 'string') return obj.length === 0
    if (Array.isArray(obj)) return obj.length === 0
    if (isObject(obj)) return Object.keys(obj).length === 0
    return false
}

/**
 * 比较两个对象是否深度相等
 */
export function deepEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a === null || b === null) return false
    if (typeof a !== 'object' || typeof b !== 'object') return false

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
        if (!keysB.includes(key)) return false
        if (!deepEqual(a[key], b[key])) return false
    }

    return true
}

// ================================
// 数组处理函数
// ================================

/**
 * 数组去重
 */
export function unique<T>(array: T[]): T[] {
    return Array.from(new Set(array))
}

/**
 * 根据属性去重
 */
export function uniqueBy<T>(array: T[], key: keyof T): T[] {
    const seen = new Set()
    return array.filter(item => {
        const value = item[key]
        if (seen.has(value)) {
            return false
        }
        seen.add(value)
        return true
    })
}

/**
 * 数组分块
 */
export function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size))
    }
    return chunks
}

/**
 * 数组扁平化
 */
export function flatten<T>(array: any[], depth = Infinity): T[] {
    if (depth <= 0) return array.slice()

    return array.reduce((acc, val) => {
        return acc.concat(
            Array.isArray(val) ? flatten(val, depth - 1) : val
        )
    }, [])
}

/**
 * 根据属性分组
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((acc, item) => {
        const groupKey = String(item[key])
        if (!acc[groupKey]) {
            acc[groupKey] = []
        }
        acc[groupKey].push(item)
        return acc
    }, {} as Record<string, T[]>)
}

/**
 * 数组随机打乱
 */
export function shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]]
    }
    return result
}

/**
 * 数组求和
 */
export function sum(array: number[]): number {
    return array.reduce((acc, val) => acc + val, 0)
}

/**
 * 数组平均值
 */
export function average(array: number[]): number {
    if (array.length === 0) return 0
    return sum(array) / array.length
}

/**
 * 数组最大值
 */
export function max(array: number[]): number {
    return Math.max(...array)
}

/**
 * 数组最小值
 */
export function min(array: number[]): number {
    return Math.min(...array)
}

// ================================
// 字符串处理函数
// ================================

/**
 * 首字母大写
 */
export function capitalize(str: string): string {
    if (!str) return ''
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * 驼峰转下划线
 */
export function camelToSnake(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

/**
 * 下划线转驼峰
 */
export function snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * 截断字符串
 */
export function truncate(str: string, length: number, suffix = '...'): string {
    if (str.length <= length) return str
    return str.slice(0, length - suffix.length) + suffix
}

/**
 * 移除字符串两端空格
 */
export function trim(str: string): string {
    return str.trim()
}

/**
 * 生成随机字符串
 */
export function randomString(length: number, chars?: string): string {
    const characters = chars || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
}

/**
 * 生成UUID
 */
export function uuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

/**
 * 字符串转Base64
 */
export function toBase64(str: string): string {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
        return String.fromCharCode(parseInt(p1, 16))
    }))
}

/**
 * Base64转字符串
 */
export function fromBase64(str: string): string {
    return decodeURIComponent(
        Array.prototype.map.call(atob(str), (c: string) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        }).join('')
    )
}

// ================================
// 数字处理函数
// ================================

/**
 * 数字格式化
 */
export function formatNumber(num: number, decimals = 2): string {
    return num.toFixed(decimals)
}

/**
 * 数字转千分位
 */
export function formatThousands(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 百分比格式化
 */
export function formatPercent(value: number, total: number, decimals = 2): string {
    if (total === 0) return '0%'
    return ((value / total) * 100).toFixed(decimals) + '%'
}

/**
 * 数字范围限制
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

/**
 * 生成随机整数
 */
export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 生成随机浮点数
 */
export function randomFloat(min: number, max: number, decimals = 2): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

// ================================
// 日期时间处理函数
// ================================

/**
 * 格式化日期
 */
export function formatDate(date: Date | string | number, format = TIME_FORMATS.FULL): string {
    const d = new Date(date)
    
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')
    const milliseconds = String(d.getMilliseconds()).padStart(3, '0')

    return format
        .replace('YYYY', String(year))
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds)
        .replace('SSS', milliseconds)
}

/**
 * 相对时间格式化
 */
export function formatRelativeTime(date: Date | string | number): string {
    const now = Date.now()
    const timestamp = new Date(date).getTime()
    const diff = now - timestamp

    if (diff < TIME_UNITS.MINUTE) {
        return '刚刚'
    } else if (diff < TIME_UNITS.HOUR) {
        const minutes = Math.floor(diff / TIME_UNITS.MINUTE)
        return `${minutes}分钟前`
    } else if (diff < TIME_UNITS.DAY) {
        const hours = Math.floor(diff / TIME_UNITS.HOUR)
        return `${hours}小时前`
    } else if (diff < TIME_UNITS.WEEK) {
        const days = Math.floor(diff / TIME_UNITS.DAY)
        return `${days}天前`
    } else if (diff < TIME_UNITS.MONTH) {
        const weeks = Math.floor(diff / TIME_UNITS.WEEK)
        return `${weeks}周前`
    } else if (diff < TIME_UNITS.YEAR) {
        const months = Math.floor(diff / TIME_UNITS.MONTH)
        return `${months}个月前`
    } else {
        const years = Math.floor(diff / TIME_UNITS.YEAR)
        return `${years}年前`
    }
}

/**
 * 持续时间格式化
 */
export function formatDuration(milliseconds: number): string {
    if (milliseconds < TIME_UNITS.SECOND) {
        return `${milliseconds}ms`
    } else if (milliseconds < TIME_UNITS.MINUTE) {
        const seconds = Math.floor(milliseconds / TIME_UNITS.SECOND)
        return `${seconds}秒`
    } else if (milliseconds < TIME_UNITS.HOUR) {
        const minutes = Math.floor(milliseconds / TIME_UNITS.MINUTE)
        const seconds = Math.floor((milliseconds % TIME_UNITS.MINUTE) / TIME_UNITS.SECOND)
        return `${minutes}分${seconds}秒`
    } else if (milliseconds < TIME_UNITS.DAY) {
        const hours = Math.floor(milliseconds / TIME_UNITS.HOUR)
        const minutes = Math.floor((milliseconds % TIME_UNITS.HOUR) / TIME_UNITS.MINUTE)
        return `${hours}小时${minutes}分`
    } else {
        const days = Math.floor(milliseconds / TIME_UNITS.DAY)
        const hours = Math.floor((milliseconds % TIME_UNITS.DAY) / TIME_UNITS.HOUR)
        return `${days}天${hours}小时`
    }
}

/**
 * 检查是否为今天
 */
export function isToday(date: Date | string | number): boolean {
    const today = new Date()
    const target = new Date(date)
    return (
        today.getFullYear() === target.getFullYear() &&
        today.getMonth() === target.getMonth() &&
        today.getDate() === target.getDate()
    )
}

/**
 * 检查是否为昨天
 */
export function isYesterday(date: Date | string | number): boolean {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const target = new Date(date)
    return (
        yesterday.getFullYear() === target.getFullYear() &&
        yesterday.getMonth() === target.getMonth() &&
        yesterday.getDate() === target.getDate()
    )
}

// ================================
// 文件处理函数
// ================================

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const size = bytes / Math.pow(k, i)

    return `${size.toFixed(decimals)} ${FILE_SIZE_UNITS[i]}`
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

/**
 * 获取文件名（不含扩展名）
 */
export function getFileNameWithoutExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.')
    return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex)
}

/**
 * 检查文件类型
 */
export function isFileType(filename: string, types: string[]): boolean {
    const ext = getFileExtension(filename)
    return types.includes(ext)
}

// ================================
// URL处理函数
// ================================

/**
 * 解析URL参数
 */
export function parseUrlParams(url: string): Record<string, string> {
    const params: Record<string, string> = {}
    const queryString = url.split('?')[1]
    
    if (!queryString) return params

    const pairs = queryString.split('&')
    for (const pair of pairs) {
        const [key, value] = pair.split('=')
        if (key) {
            params[decodeURIComponent(key)] = decodeURIComponent(value || '')
        }
    }

    return params
}

/**
 * 构建URL参数
 */
export function buildUrlParams(params: Record<string, any>): string {
    const pairs: string[] = []
    for (const key in params) {
        if (params[key] !== null && params[key] !== undefined) {
            pairs.push(
                `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`
            )
        }
    }
    return pairs.join('&')
}

/**
 * 拼接URL
 */
export function joinUrl(base: string, ...paths: string[]): string {
    let url = base.replace(/\/+$/, '')
    for (const path of paths) {
        const cleanPath = path.replace(/^\/+/, '').replace(/\/+$/, '')
        if (cleanPath) {
            url += '/' + cleanPath
        }
    }
    return url
}

/**
 * 验证URL
 */
export function isValidUrl(url: string): boolean {
    return REGEX_PATTERNS.URL.test(url)
}

// ================================
// 验证函数
// ================================

/**
 * 验证邮箱
 */
export function isValidEmail(email: string): boolean {
    return REGEX_PATTERNS.EMAIL.test(email)
}

/**
 * 验证版本号
 */
export function isValidVersion(version: string): boolean {
    return REGEX_PATTERNS.VERSION.test(version)
}

/**
 * 验证十六进制颜色
 */
export function isValidHexColor(color: string): boolean {
    return REGEX_PATTERNS.HEX_COLOR.test(color)
}

/**
 * 验证IPv4地址
 */
export function isValidIPv4(ip: string): boolean {
    return REGEX_PATTERNS.IPV4.test(ip)
}

/**
 * 验证端口号
 */
export function isValidPort(port: number | string): boolean {
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port
    return !isNaN(portNum) && portNum >= 1 && portNum <= 65535
}

// ================================
// 性能优化函数
// ================================

/**
 * 延迟执行
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 重试函数
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options: {
        maxAttempts?: number
        delay?: number
        backoff?: number
        onRetry?: (error: Error, attempt: number) => void
    } = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        delay = 1000,
        backoff = 2,
        onRetry,
    } = options

    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error as Error
            
            if (attempt < maxAttempts) {
                onRetry?.(lastError, attempt)
                const waitTime = delay * Math.pow(backoff, attempt - 1)
                await sleep(waitTime)
            }
        }
    }

    throw lastError!
}

/**
 * 超时控制
 */
export async function timeout<T>(
    promise: Promise<T>,
    ms: number,
    message = 'Operation timed out'
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => {
            setTimeout(() => reject(new Error(message)), ms)
        }),
    ])
}

/**
 * 批量处理
 */
export async function batchProcess<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options: {
        batchSize?: number
        concurrency?: number
        onProgress?: (processed: number, total: number) => void
    } = {}
): Promise<R[]> {
    const {
        batchSize = 10,
        concurrency = 3,
        onProgress,
    } = options

    const results: R[] = []
    const batches = chunk(items, batchSize)
    let processed = 0

    for (const batch of batches) {
        const batchResults = await Promise.all(
            batch.slice(0, concurrency).map((item, index) => processor(item, index))
        )
        results.push(...batchResults)
        processed += batch.length
        onProgress?.(processed, items.length)
    }

    return results
}

// ================================
// 其他工具函数
// ================================

/**
 * 安全的JSON解析
 */
export function safeJsonParse<T = any>(json: string, defaultValue?: T): T | null {
    try {
        return JSON.parse(json)
    } catch {
        return defaultValue ?? null
    }
}

/**
 * 安全的JSON序列化
 */
export function safeJsonStringify(obj: any, pretty = false): string | null {
    try {
        return JSON.stringify(obj, null, pretty ? 2 : 0)
    } catch {
        return null
    }
}

/**
 * 获取数据类型
 */
export function getType(value: any): string {
    return Object.prototype.toString.call(value).slice(8, -1).toLowerCase()
}

/**
 * 类型检查函数
 */
export const is = {
    string: (value: any): value is string => typeof value === 'string',
    number: (value: any): value is number => typeof value === 'number' && !isNaN(value),
    boolean: (value: any): value is boolean => typeof value === 'boolean',
    function: (value: any): value is Function => typeof value === 'function',
    array: (value: any): value is any[] => Array.isArray(value),
    object: (value: any): value is object => isObject(value),
    null: (value: any): value is null => value === null,
    undefined: (value: any): value is undefined => value === undefined,
    nil: (value: any): value is null | undefined => value === null || value === undefined,
    promise: (value: any): value is Promise<any> => value instanceof Promise,
    date: (value: any): value is Date => value instanceof Date,
    regexp: (value: any): value is RegExp => value instanceof RegExp,
    error: (value: any): value is Error => value instanceof Error,
}

/**
 * 控制台彩色输出（仅在开发环境）
 */
export const colorLog = {
    info: (message: string, ...args: any[]) => {
        console.log(`%c${message}`, 'color: #1890ff', ...args)
    },
    success: (message: string, ...args: any[]) => {
        console.log(`%c${message}`, 'color: #52c41a', ...args)
    },
    warning: (message: string, ...args: any[]) => {
        console.log(`%c${message}`, 'color: #faad14', ...args)
    },
    error: (message: string, ...args: any[]) => {
        console.log(`%c${message}`, 'color: #f5222d', ...args)
    },
}

/**
 * 生成哈希值
 */
export function hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
    }
    return hash
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
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
    } catch {
        return false
    }
}

/**
 * 下载文件
 */
export function downloadFile(data: Blob | string, filename: string, mimeType?: string): void {
    const blob = typeof data === 'string' 
        ? new Blob([data], { type: mimeType || 'text/plain' })
        : data

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}

/**
 * 节流（返回值版本）
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => ReturnType<T> | undefined {
    let lastTime = 0
    let lastResult: ReturnType<T> | undefined

    return function (this: any, ...args: Parameters<T>) {
        const now = Date.now()
        if (now - lastTime >= wait) {
            lastTime = now
            lastResult = func.apply(this, args)
        }
        return lastResult
    }
}

/**
 * 防抖（返回值版本）
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate = false
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null

    return function (this: any, ...args: Parameters<T>) {
        const later = () => {
            timeout = null
            if (!immediate) {
                func.apply(this, args)
            }
        }

        const callNow = immediate && !timeout
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(later, wait)

        if (callNow) {
            func.apply(this, args)
        }
    }
}

/**
 * 导出所有工具函数
 */
export default {
    // 对象处理
    deepClone,
    deepMerge,
    isObject,
    getNestedValue,
    setNestedValue,
    pick,
    omit,
    isEmpty,
    deepEqual,
    
    // 数组处理
    unique,
    uniqueBy,
    chunk,
    flatten,
    groupBy,
    shuffle,
    sum,
    average,
    max,
    min,
    
    // 字符串处理
    capitalize,
    camelToSnake,
    snakeToCamel,
    truncate,
    trim,
    randomString,
    uuid,
    toBase64,
    fromBase64,
    
    // 数字处理
    formatNumber,
    formatThousands,
    formatPercent,
    clamp,
    randomInt,
    randomFloat,
    
    // 日期时间
    formatDate,
    formatRelativeTime,
    formatDuration,
    isToday,
    isYesterday,
    
    // 文件处理
    formatFileSize,
    getFileExtension,
    getFileNameWithoutExtension,
    isFileType,
    
    // URL处理
    parseUrlParams,
    buildUrlParams,
    joinUrl,
    isValidUrl,
    
    // 验证
    isValidEmail,
    isValidVersion,
    isValidHexColor,
    isValidIPv4,
    isValidPort,
    
    // 性能优化
    sleep,
    retry,
    timeout,
    batchProcess,
    
    // 其他
    safeJsonParse,
    safeJsonStringify,
    getType,
    is,
    colorLog,
    hashCode,
    copyToClipboard,
    downloadFile,
    throttle,
    debounce,
}

