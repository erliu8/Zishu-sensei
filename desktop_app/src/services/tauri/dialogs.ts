/**
 * Tauri 对话框服务
 */

import { ask, confirm, open, save } from '@tauri-apps/api/dialog'
import type { TauriFileDialogOptions } from '../../types/tauri'

/**
 * 打开文件选择对话框
 */
export const openFileDialog = async (options?: TauriFileDialogOptions): Promise<string | string[] | null> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('文件对话框仅在桌面环境下可用')
        }

        return await open({
            title: options?.title,
            defaultPath: options?.defaultPath,
            filters: options?.filters,
            multiple: options?.multiple || false,
            directory: options?.directory || false,
        })
    } catch (error) {
        console.error('打开文件对话框失败:', error)
        throw error
    }
}

/**
 * 打开保存文件对话框
 */
export const saveFileDialog = async (options?: TauriFileDialogOptions): Promise<string | null> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('保存对话框仅在桌面环境下可用')
        }

        return await save({
            title: options?.title,
            defaultPath: options?.defaultPath,
            filters: options?.filters,
        })
    } catch (error) {
        console.error('打开保存对话框失败:', error)
        throw error
    }
}

/**
 * 显示消息对话框
 */
export const showMessageDialog = async (title: string, message: string): Promise<void> => {
    try {
        if (window.__TAURI__) {
            await message(message, { title, type: 'info' })
        } else {
            // Web 环境下的回退方案
            alert(`${title}\n\n${message}`)
        }
    } catch (error) {
        console.error('显示消息对话框失败:', error)
        throw error
    }
}

/**
 * 显示确认对话框
 */
export const showConfirmDialog = async (title: string, message: string): Promise<boolean> => {
    try {
        if (window.__TAURI__) {
            return await confirm(message, { title, type: 'warning' })
        } else {
            // Web 环境下的回退方案
            return confirm(`${title}\n\n${message}`)
        }
    } catch (error) {
        console.error('显示确认对话框失败:', error)
        throw error
    }
}

/**
 * 显示询问对话框
 */
export const showAskDialog = async (title: string, message: string): Promise<boolean> => {
    try {
        if (window.__TAURI__) {
            return await ask(message, { title, type: 'info' })
        } else {
            // Web 环境下的回退方案
            return confirm(`${title}\n\n${message}`)
        }
    } catch (error) {
        console.error('显示询问对话框失败:', error)
        throw error
    }
}
