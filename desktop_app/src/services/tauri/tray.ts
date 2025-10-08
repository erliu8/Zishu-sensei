/**
 * Tauri 系统托盘服务
 */

import type { TauriTrayMenuItem } from '../../types/tauri'

/**
 * 创建系统托盘菜单项
 */
export const createTrayMenuItem = (item: TauriTrayMenuItem): TauriTrayMenuItem => {
    return {
        id: item.id,
        title: item.title,
        enabled: item.enabled ?? true,
        checked: item.checked ?? false,
        icon: item.icon,
    }
}

/**
 * 更新托盘图标
 */
export const updateTrayIcon = async (iconPath: string): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            console.warn('系统托盘功能仅在桌面环境下可用')
            return
        }

        // 这里需要使用 Tauri 的托盘 API
        console.log('更新托盘图标:', iconPath)
        // 实际实现需要等待 Tauri 托盘 API
    } catch (error) {
        console.error('更新托盘图标失败:', error)
        throw error
    }
}

/**
 * 更新托盘菜单
 */
export const updateTrayMenu = async (items: TauriTrayMenuItem[]): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            console.warn('系统托盘功能仅在桌面环境下可用')
            return
        }

        // 这里需要使用 Tauri 的托盘 API
        console.log('更新托盘菜单:', items)
        // 实际实现需要等待 Tauri 托盘 API
    } catch (error) {
        console.error('更新托盘菜单失败:', error)
        throw error
    }
}

/**
 * 显示托盘
 */
export const showTray = async (): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            console.warn('系统托盘功能仅在桌面环境下可用')
            return
        }

        // 实际实现需要等待 Tauri 托盘 API
        console.log('显示托盘')
    } catch (error) {
        console.error('显示托盘失败:', error)
        throw error
    }
}

/**
 * 隐藏托盘
 */
export const hideTray = async (): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            console.warn('系统托盘功能仅在桌面环境下可用')
            return
        }

        // 实际实现需要等待 Tauri 托盘 API
        console.log('隐藏托盘')
    } catch (error) {
        console.error('隐藏托盘失败:', error)
        throw error
    }
}
