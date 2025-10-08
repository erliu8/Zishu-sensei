/**
 * Tauri 通知服务
 */

import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/api/notification'
import type { TauriNotificationOptions } from '../../types/tauri'

/**
 * 显示通知
 */
export const showNotification = async (options: TauriNotificationOptions): Promise<void> => {
    try {
        if (window.__TAURI__) {
            // 检查权限
            let permissionGranted = await isPermissionGranted()

            if (!permissionGranted) {
                const permission = await requestPermission()
                permissionGranted = permission === 'granted'
            }

            if (permissionGranted) {
                await sendNotification({
                    title: options.title,
                    body: options.body,
                    icon: options.icon,
                    sound: options.sound,
                })
            } else {
                console.warn('通知权限未授予')
            }
        } else {
            // Web 环境下的回退方案
            if ('Notification' in window) {
                let permission = Notification.permission

                if (permission === 'default') {
                    permission = await Notification.requestPermission()
                }

                if (permission === 'granted') {
                    new Notification(options.title, {
                        body: options.body,
                        icon: options.icon,
                    })
                } else {
                    console.warn('通知权限未授予')
                }
            } else {
                console.warn('浏览器不支持通知')
            }
        }
    } catch (error) {
        console.error('显示通知失败:', error)
        throw error
    }
}

/**
 * 检查通知权限
 */
export const checkNotificationPermission = async (): Promise<boolean> => {
    try {
        if (window.__TAURI__) {
            return await isPermissionGranted()
        } else {
            if ('Notification' in window) {
                return Notification.permission === 'granted'
            }
            return false
        }
    } catch (error) {
        console.error('检查通知权限失败:', error)
        return false
    }
}

/**
 * 请求通知权限
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    try {
        if (window.__TAURI__) {
            const permission = await requestPermission()
            return permission === 'granted'
        } else {
            if ('Notification' in window) {
                const permission = await Notification.requestPermission()
                return permission === 'granted'
            }
            return false
        }
    } catch (error) {
        console.error('请求通知权限失败:', error)
        return false
    }
}
