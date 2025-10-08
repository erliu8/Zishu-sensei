/**
 * Tauri 工具函数
 * 
 * 提供 Tauri 相关的实用工具函数
 */

import { platform } from '@tauri-apps/api/os'
import { basename, dirname, extname, join, resolve } from '@tauri-apps/api/path'
import { convertFileSrc, invoke } from '@tauri-apps/api/tauri'
import { appWindow } from '@tauri-apps/api/window'

import type {
    FileInfo,
    WindowConfig
} from '../types/tauri'

/**
 * 检查是否在 Tauri 环境中
 */
export function isTauriEnvironment(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * 安全地调用 Tauri 命令
 */
export async function safeInvoke<T = any>(
    command: string,
    payload: Record<string, any> = {}
): Promise<T | null> {
    if (!isTauriEnvironment()) {
        console.warn(`Cannot invoke '${command}' outside Tauri environment`)
        return null
    }

    try {
        return await invoke<T>(command, payload)
    } catch (error) {
        console.error(`Failed to invoke '${command}':`, error)
        return null
    }
}

/**
 * 获取平台信息
 */
export async function getPlatformInfo(): Promise<{
    platform: string
    arch: string
    version: string
    isMobile: boolean
    isDesktop: boolean
    isWeb: boolean
}> {
    if (!isTauriEnvironment()) {
        return {
            platform: 'web',
            arch: 'unknown',
            version: 'unknown',
            isMobile: false,
            isDesktop: false,
            isWeb: true
        }
    }

    try {
        const platformName = await platform()

        return {
            platform: platformName,
            arch: 'unknown', // 需要从其他 API 获取
            version: 'unknown',
            isMobile: ['android', 'ios'].includes(platformName),
            isDesktop: ['win32', 'darwin', 'linux'].includes(platformName),
            isWeb: false
        }
    } catch (error) {
        console.error('Failed to get platform info:', error)
        return {
            platform: 'unknown',
            arch: 'unknown',
            version: 'unknown',
            isMobile: false,
            isDesktop: false,
            isWeb: false
        }
    }
}

/**
 * 转换文件路径为可访问的 URL
 */
export function convertToAssetUrl(filePath: string): string {
    if (!isTauriEnvironment()) {
        return filePath
    }

    try {
        return convertFileSrc(filePath)
    } catch (error) {
        console.error('Failed to convert file path:', error)
        return filePath
    }
}

/**
 * 路径操作工具
 */
export const pathUtils = {
    /**
     * 连接路径
     */
    async join(...paths: string[]): Promise<string> {
        if (!isTauriEnvironment()) {
            return paths.join('/')
        }

        try {
            return await join(...paths)
        } catch (error) {
            console.error('Failed to join paths:', error)
            return paths.join('/')
        }
    },

    /**
     * 解析路径
     */
    async resolve(path: string): Promise<string> {
        if (!isTauriEnvironment()) {
            return path
        }

        try {
            return await resolve(path)
        } catch (error) {
            console.error('Failed to resolve path:', error)
            return path
        }
    },

    /**
     * 获取目录名
     */
    async dirname(path: string): Promise<string> {
        if (!isTauriEnvironment()) {
            return path.split('/').slice(0, -1).join('/') || '/'
        }

        try {
            return await dirname(path)
        } catch (error) {
            console.error('Failed to get dirname:', error)
            return path
        }
    },

    /**
     * 获取文件名
     */
    async basename(path: string, ext?: string): Promise<string> {
        if (!isTauriEnvironment()) {
            const name = path.split('/').pop() || ''
            return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name
        }

        try {
            return await basename(path, ext)
        } catch (error) {
            console.error('Failed to get basename:', error)
            return path
        }
    },

    /**
     * 获取文件扩展名
     */
    async extname(path: string): Promise<string> {
        if (!isTauriEnvironment()) {
            const match = path.match(/\.([^.]+)$/)
            return match ? `.${match[1]}` : ''
        }

        try {
            return await extname(path)
        } catch (error) {
            console.error('Failed to get extname:', error)
            return ''
        }
    }
}

/**
 * 窗口工具函数
 */
export const windowUtils = {
    /**
     * 获取当前窗口标签
     */
    getCurrentLabel(): string {
        return appWindow.label
    },

    /**
     * 检查窗口是否存在
     */
    async windowExists(label: string): Promise<boolean> {
        try {
            const result = await safeInvoke<boolean>('window_exists', { label })
            return result ?? false
        } catch {
            return false
        }
    },

    /**
     * 创建窗口配置
     */
    createWindowConfig(
        label: string,
        options: Partial<WindowConfig> = {}
    ): WindowConfig {
        return {
            label,
            url: options.url || '/',
            title: options.title || 'Zishu Sensei',
            width: options.width || 1200,
            height: options.height || 800,
            minWidth: options.minWidth || 800,
            minHeight: options.minHeight || 600,
            center: options.center ?? true,
            resizable: options.resizable ?? true,
            maximizable: options.maximizable ?? true,
            minimizable: options.minimizable ?? true,
            closable: options.closable ?? true,
            decorations: options.decorations ?? true,
            transparent: options.transparent ?? false,
            visible: options.visible ?? true,
            focus: options.focus ?? true,
            ...options
        }
    },

    /**
     * 获取窗口尺寸预设
     */
    getSizePresets() {
        return {
            small: { width: 800, height: 600 },
            medium: { width: 1200, height: 800 },
            large: { width: 1600, height: 1000 },
            fullHD: { width: 1920, height: 1080 },
            mobile: { width: 375, height: 667 },
            tablet: { width: 768, height: 1024 }
        }
    }
}

/**
 * 文件工具函数
 */
export const fileUtils = {
    /**
     * 检查文件扩展名
     */
    hasExtension(filename: string, extensions: string[]): boolean {
        const ext = filename.toLowerCase().split('.').pop()
        return ext ? extensions.includes(ext) : false
    },

    /**
     * 获取文件类型
     */
    getFileType(filename: string): string {
        const ext = filename.toLowerCase().split('.').pop()

        const typeMap: Record<string, string> = {
            // 图片
            jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
            bmp: 'image', svg: 'image', webp: 'image',

            // 音频
            mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio',
            flac: 'audio', aac: 'audio',

            // 视频
            mp4: 'video', avi: 'video', mov: 'video', wmv: 'video',
            flv: 'video', webm: 'video', mkv: 'video',

            // 文档
            txt: 'text', md: 'text', json: 'text', xml: 'text',
            html: 'text', css: 'text', js: 'text', ts: 'text',

            // 压缩包
            zip: 'archive', rar: 'archive', tar: 'archive', gz: 'archive',

            // 可执行文件
            exe: 'executable', msi: 'executable', dmg: 'executable',
            deb: 'executable', rpm: 'executable'
        }

        return typeMap[ext || ''] || 'unknown'
    },

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 B'

        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
    },

    /**
     * 创建文件信息对象
     */
    createFileInfo(
        name: string,
        path: string,
        size?: number,
        modified?: number
    ): FileInfo {
        return {
            name,
            path,
            size: size || 0,
            type: this.getFileType(name),
            extension: name.split('.').pop() || '',
            modified: modified ? new Date(modified) : new Date(),
            isDirectory: false,
            isDir: false,
            isFile: true,
            isSymlink: false,
            readonly: false
        }
    }
}

/**
 * 错误处理工具
 */
export const errorUtils = {
    /**
     * 创建 Tauri 错误
     */
    createTauriError(
        message: string,
        code?: string,
        command?: string,
        payload?: any
    ): Error & { code?: string; command?: string; payload?: any } {
        const error = new Error(message) as any
        error.name = 'TauriError'
        error.code = code
        error.command = command
        error.payload = payload
        return error
    },

    /**
     * 处理 Tauri 错误
     */
    handleTauriError(error: any): string {
        if (typeof error === 'string') {
            return error
        }

        if (error && typeof error === 'object') {
            if (error.message) {
                return error.message
            }

            if (error.error) {
                return error.error
            }
        }

        return 'Unknown Tauri error'
    },

    /**
     * 检查是否为 Tauri 错误
     */
    isTauriError(error: any): boolean {
        return error && error.name === 'TauriError'
    }
}

/**
 * 调试工具
 */
export const debugUtils = {
    /**
     * 记录 Tauri 调用
     */
    logTauriCall(command: string, payload?: any, result?: any): void {
        if (process.env.NODE_ENV === 'development') {
            console.group(`🦀 Tauri Call: ${command}`)
            if (payload) {
                console.log('Payload:', payload)
            }
            if (result !== undefined) {
                console.log('Result:', result)
            }
            console.groupEnd()
        }
    },

    /**
     * 记录 Tauri 错误
     */
    logTauriError(command: string, error: any, payload?: any): void {
        console.group(`❌ Tauri Error: ${command}`)
        console.error('Error:', error)
        if (payload) {
            console.log('Payload:', payload)
        }
        console.groupEnd()
    },

    /**
     * 获取 Tauri 环境信息
     */
    async getTauriDebugInfo(): Promise<Record<string, any>> {
        const info: Record<string, any> = {
            isTauriEnv: isTauriEnvironment(),
            timestamp: new Date().toISOString()
        }

        if (isTauriEnvironment()) {
            try {
                info.platform = await getPlatformInfo()
                info.windowLabel = windowUtils.getCurrentLabel()
            } catch (error) {
                info.error = errorUtils.handleTauriError(error)
            }
        }

        return info
    }
}

/**
 * 性能工具
 */
export const performanceUtils = {
    /**
     * 测量 Tauri 命令执行时间
     */
    async measureCommand<T>(
        command: string,
        payload?: any
    ): Promise<{ result: T | null; duration: number }> {
        const start = performance.now()

        try {
            const result = await safeInvoke<T>(command, payload)
            const duration = performance.now() - start

            debugUtils.logTauriCall(command, payload, { result, duration: `${duration.toFixed(2)}ms` })

            return { result, duration }
        } catch (error) {
            const duration = performance.now() - start
            debugUtils.logTauriError(command, error, payload)
            return { result: null, duration }
        }
    },

    /**
     * 创建性能监控器
     */
    createPerformanceMonitor() {
        const metrics = new Map<string, number[]>()

        return {
            record(command: string, duration: number) {
                if (!metrics.has(command)) {
                    metrics.set(command, [])
                }
                metrics.get(command)!.push(duration)
            },

            getStats(command?: string) {
                if (command) {
                    const durations = metrics.get(command) || []
                    if (durations.length === 0) return null

                    const sorted = [...durations].sort((a, b) => a - b)
                    return {
                        count: durations.length,
                        min: Math.min(...durations),
                        max: Math.max(...durations),
                        avg: durations.reduce((a, b) => a + b, 0) / durations.length,
                        median: sorted[Math.floor(sorted.length / 2)]
                    }
                }

                const allStats: Record<string, any> = {}
                metrics.forEach((durations, cmd) => {
                    allStats[cmd] = this.getStats(cmd)
                })
                return allStats
            },

            clear(command?: string) {
                if (command) {
                    metrics.delete(command)
                } else {
                    metrics.clear()
                }
            }
        }
    }
}

/**
 * 缓存工具
 */
export const cacheUtils = {
    /**
     * 创建简单缓存
     */
    createCache<T>(maxSize = 100, ttl = 5 * 60 * 1000) {
        const cache = new Map<string, { value: T; timestamp: number }>()

        return {
            get(key: string): T | null {
                const item = cache.get(key)
                if (!item) return null

                if (Date.now() - item.timestamp > ttl) {
                    cache.delete(key)
                    return null
                }

                return item.value
            },

            set(key: string, value: T): void {
                // 清理过期项
                if (cache.size >= maxSize) {
                    const oldestKey = cache.keys().next().value
                    cache.delete(oldestKey)
                }

                cache.set(key, { value, timestamp: Date.now() })
            },

            has(key: string): boolean {
                return this.get(key) !== null
            },

            delete(key: string): boolean {
                return cache.delete(key)
            },

            clear(): void {
                cache.clear()
            },

            size(): number {
                return cache.size
            }
        }
    }
}
