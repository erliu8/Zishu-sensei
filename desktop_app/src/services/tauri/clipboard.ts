/**
 * Tauri 剪贴板服务
 */

import { invoke } from '@tauri-apps/api/tauri'

/**
 * 复制文本到剪贴板
 */
export const copyToClipboard = async (text: string): Promise<void> => {
    try {
        if (window.__TAURI__) {
            await invoke('copy_to_clipboard', { text })
        } else {
            // Web 环境下的回退方案
            await navigator.clipboard.writeText(text)
        }
    } catch (error) {
        console.error('复制到剪贴板失败:', error)
        throw error
    }
}

/**
 * 从剪贴板读取文本
 */
export const readFromClipboard = async (): Promise<string> => {
    try {
        if (window.__TAURI__) {
            return await invoke<string>('read_from_clipboard')
        } else {
            // Web 环境下的回退方案
            return await navigator.clipboard.readText()
        }
    } catch (error) {
        console.error('从剪贴板读取失败:', error)
        throw error
    }
}

/**
 * 检查剪贴板权限
 */
export const checkClipboardPermission = async (): Promise<boolean> => {
    try {
        if (window.__TAURI__) {
            return true // Tauri 环境下默认有权限
        } else {
            // Web 环境下检查权限
            const permission = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName })
            return permission.state === 'granted'
        }
    } catch (error) {
        console.error('检查剪贴板权限失败:', error)
        return false
    }
}
