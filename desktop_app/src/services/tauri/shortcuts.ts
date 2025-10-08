/**
 * Tauri 快捷键服务
 */

import { isRegistered, register, unregister } from '@tauri-apps/api/globalShortcut'
import type { TauriShortcut } from '../../types/tauri'

/**
 * 注册全局快捷键
 */
export const registerShortcut = async (shortcut: TauriShortcut): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            console.warn('快捷键功能仅在桌面环境下可用')
            return
        }

        if (shortcut.global) {
            await register(shortcut.shortcut, shortcut.callback)
        } else {
            // 本地快捷键通过事件监听器处理
            const handleKeyDown = (event: KeyboardEvent) => {
                if (matchesShortcut(event, shortcut.shortcut)) {
                    event.preventDefault()
                    shortcut.callback()
                }
            }

            document.addEventListener('keydown', handleKeyDown)

            // 返回清理函数
            return () => {
                document.removeEventListener('keydown', handleKeyDown)
            }
        }
    } catch (error) {
        console.error('注册快捷键失败:', error)
        throw error
    }
}

/**
 * 注销全局快捷键
 */
export const unregisterShortcut = async (shortcut: string): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            return
        }

        await unregister(shortcut)
    } catch (error) {
        console.error('注销快捷键失败:', error)
        throw error
    }
}

/**
 * 检查快捷键是否已注册
 */
export const isShortcutRegistered = async (shortcut: string): Promise<boolean> => {
    try {
        if (!window.__TAURI__) {
            return false
        }

        return await isRegistered(shortcut)
    } catch (error) {
        console.error('检查快捷键注册状态失败:', error)
        return false
    }
}

/**
 * 匹配快捷键
 */
const matchesShortcut = (event: KeyboardEvent, shortcut: string): boolean => {
    const parts = shortcut.toLowerCase().split('+')
    const key = parts.pop()

    if (!key) return false

    // 检查修饰键
    const hasCtrl = parts.includes('ctrl') || parts.includes('cmd')
    const hasAlt = parts.includes('alt')
    const hasShift = parts.includes('shift')
    const hasMeta = parts.includes('meta') || parts.includes('cmd')

    // 检查按键
    const eventKey = event.key.toLowerCase()
    const keyMatch = eventKey === key ||
        (key === 'space' && eventKey === ' ') ||
        (key === 'enter' && eventKey === 'enter') ||
        (key === 'escape' && eventKey === 'escape')

    return keyMatch &&
        event.ctrlKey === hasCtrl &&
        event.altKey === hasAlt &&
        event.shiftKey === hasShift &&
        event.metaKey === hasMeta
}
