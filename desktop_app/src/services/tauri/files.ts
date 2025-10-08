/**
 * Tauri 文件系统服务
 */

import { copyFile, createDir, exists, readBinaryFile, readTextFile, removeDir, removeFile, renameFile, writeBinaryFile, writeTextFile } from '@tauri-apps/api/fs'
import type { TauriFsOptions } from '../../types/tauri'

/**
 * 读取文本文件
 */
export const readFile = async (path: string, options?: TauriFsOptions): Promise<string> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('文件系统操作仅在桌面环境下可用')
        }

        return await readTextFile(path, options)
    } catch (error) {
        console.error('读取文件失败:', error)
        throw error
    }
}

/**
 * 写入文本文件
 */
export const writeFile = async (path: string, content: string, options?: TauriFsOptions): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('文件系统操作仅在桌面环境下可用')
        }

        await writeTextFile(path, content, options)
    } catch (error) {
        console.error('写入文件失败:', error)
        throw error
    }
}

/**
 * 读取二进制文件
 */
export const readBinaryFileContent = async (path: string, options?: TauriFsOptions): Promise<Uint8Array> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('文件系统操作仅在桌面环境下可用')
        }

        return await readBinaryFile(path, options)
    } catch (error) {
        console.error('读取二进制文件失败:', error)
        throw error
    }
}

/**
 * 写入二进制文件
 */
export const writeBinaryFileContent = async (path: string, content: Uint8Array, options?: TauriFsOptions): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('文件系统操作仅在桌面环境下可用')
        }

        await writeBinaryFile(path, content, options)
    } catch (error) {
        console.error('写入二进制文件失败:', error)
        throw error
    }
}

/**
 * 检查文件是否存在
 */
export const fileExists = async (path: string, options?: TauriFsOptions): Promise<boolean> => {
    try {
        if (!window.__TAURI__) {
            return false
        }

        return await exists(path, options)
    } catch (error) {
        console.error('检查文件存在失败:', error)
        return false
    }
}

/**
 * 创建目录
 */
export const createDirectory = async (path: string, options?: TauriFsOptions): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('文件系统操作仅在桌面环境下可用')
        }

        await createDir(path, { ...options, recursive: options?.recursive ?? true })
    } catch (error) {
        console.error('创建目录失败:', error)
        throw error
    }
}

/**
 * 删除文件
 */
export const deleteFile = async (path: string, options?: TauriFsOptions): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('文件系统操作仅在桌面环境下可用')
        }

        await removeFile(path, options)
    } catch (error) {
        console.error('删除文件失败:', error)
        throw error
    }
}

/**
 * 删除目录
 */
export const deleteDirectory = async (path: string, options?: TauriFsOptions): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('文件系统操作仅在桌面环境下可用')
        }

        await removeDir(path, { ...options, recursive: options?.recursive ?? true })
    } catch (error) {
        console.error('删除目录失败:', error)
        throw error
    }
}

/**
 * 复制文件
 */
export const copyFileContent = async (source: string, destination: string, options?: TauriFsOptions): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('文件系统操作仅在桌面环境下可用')
        }

        await copyFile(source, destination, options)
    } catch (error) {
        console.error('复制文件失败:', error)
        throw error
    }
}

/**
 * 重命名文件
 */
export const renameFileContent = async (oldPath: string, newPath: string, options?: TauriFsOptions): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('文件系统操作仅在桌面环境下可用')
        }

        await renameFile(oldPath, newPath, options)
    } catch (error) {
        console.error('重命名文件失败:', error)
        throw error
    }
}
