/**
 * Tauri 工具服务
 */

import { invoke } from '@tauri-apps/api/tauri'

/**
 * 检查 Tauri 环境
 */
export const isTauriEnvironment = (): boolean => {
    return typeof window !== 'undefined' && window.__TAURI__ !== undefined
}

/**
 * 获取 Tauri 版本
 */
export const getTauriVersion = async (): Promise<string> => {
    try {
        if (!isTauriEnvironment()) {
            return 'N/A'
        }

        return await invoke<string>('tauri_version')
    } catch (error) {
        console.error('获取 Tauri 版本失败:', error)
        return 'unknown'
    }
}

/**
 * 调用 Tauri 命令的通用方法
 */
export const invokeCommand = async <T = any>(
    command: string,
    args?: Record<string, any>
): Promise<T> => {
    try {
        if (!isTauriEnvironment()) {
            throw new Error(`命令 "${command}" 仅在桌面环境下可用`)
        }

        return await invoke<T>(command, args)
    } catch (error) {
        console.error(`调用命令 "${command}" 失败:`, error)
        throw error
    }
}

/**
 * 安全调用 Tauri 命令（不会抛出错误）
 */
export const safeInvokeCommand = async <T = any>(
    command: string,
    args?: Record<string, any>,
    fallback?: T
): Promise<T | undefined> => {
    try {
        return await invokeCommand<T>(command, args)
    } catch (error) {
        console.warn(`安全调用命令 "${command}" 失败:`, error)
        return fallback
    }
}

/**
 * 检查命令是否可用
 */
export const isCommandAvailable = async (command: string): Promise<boolean> => {
    try {
        if (!isTauriEnvironment()) {
            return false
        }

        await invoke('ping') // 测试基础连接
        return true
    } catch (error) {
        return false
    }
}

/**
 * 批量调用命令
 */
export const batchInvokeCommands = async <T = any>(
    commands: Array<{ command: string; args?: Record<string, any> }>
): Promise<Array<T | Error>> => {
    const results = await Promise.allSettled(
        commands.map(({ command, args }) => invokeCommand<T>(command, args))
    )

    return results.map(result =>
        result.status === 'fulfilled' ? result.value : result.reason
    )
}

/**
 * 延迟执行
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 重试机制
 */
export const retryCommand = async <T = any>(
    command: string,
    args?: Record<string, any>,
    maxRetries: number = 3,
    delayMs: number = 1000
): Promise<T> => {
    let lastError: Error

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await invokeCommand<T>(command, args)
        } catch (error) {
            lastError = error as Error

            if (i < maxRetries - 1) {
                await delay(delayMs * (i + 1)) // 递增延迟
            }
        }
    }

    throw lastError!
}
