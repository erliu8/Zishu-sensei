/**
 * Tauri 系统服务
 */

import { appName, appVersion, tauriVersion } from '@tauri-apps/api/app'
import { arch, locale, platform, type, version } from '@tauri-apps/api/os'
import { invoke } from '@tauri-apps/api/tauri'
import type { TauriAppInfo, TauriEnvironment } from '../../types/tauri'

/**
 * 获取系统信息
 */
export const getSystemInfo = async (): Promise<TauriEnvironment> => {
    try {
        if (!window.__TAURI__) {
            // Web 环境下的回退信息
            return {
                platform: 'web',
                arch: 'unknown',
                os: navigator.platform,
                version: 'unknown',
                tauriVersion: 'N/A',
                webviewVersion: 'N/A',
            }
        }

        const [
            platformName,
            archName,
            versionName,
            typeName,
            tauriVer,
        ] = await Promise.all([
            platform(),
            arch(),
            version(),
            type(),
            tauriVersion(),
        ])

        return {
            platform: platformName,
            arch: archName,
            os: typeName,
            version: versionName,
            tauriVersion: tauriVer,
            webviewVersion: 'unknown', // 需要额外的API获取
        }
    } catch (error) {
        console.error('获取系统信息失败:', error)
        throw error
    }
}

/**
 * 获取应用信息
 */
export const getAppInfo = async (): Promise<TauriAppInfo> => {
    try {
        if (!window.__TAURI__) {
            return {
                name: 'Zishu Sensei',
                version: '1.0.0',
                tauriVersion: 'N/A',
            }
        }

        const [name, version, tauriVer] = await Promise.all([
            appName(),
            appVersion(),
            tauriVersion(),
        ])

        return {
            name,
            version,
            tauriVersion: tauriVer,
        }
    } catch (error) {
        console.error('获取应用信息失败:', error)
        throw error
    }
}

/**
 * 获取系统语言
 */
export const getSystemLocale = async (): Promise<string> => {
    try {
        if (window.__TAURI__) {
            return await locale() || 'zh-CN'
        } else {
            return navigator.language || 'zh-CN'
        }
    } catch (error) {
        console.error('获取系统语言失败:', error)
        return 'zh-CN'
    }
}

/**
 * 打开URL
 */
export const openUrl = async (url: string): Promise<void> => {
    try {
        if (window.__TAURI__) {
            await invoke('open_url', { url })
        } else {
            window.open(url, '_blank')
        }
    } catch (error) {
        console.error('打开URL失败:', error)
        throw error
    }
}

/**
 * 在文件管理器中显示文件
 */
export const showInFolder = async (path: string): Promise<void> => {
    try {
        if (!window.__TAURI__) {
            throw new Error('显示文件功能仅在桌面环境下可用')
        }

        await invoke('show_in_folder', { path })
    } catch (error) {
        console.error('显示文件失败:', error)
        throw error
    }
}

/**
 * 退出应用
 */
export const exitApp = async (): Promise<void> => {
    try {
        if (window.__TAURI__) {
            await invoke('exit_app')
        } else {
            window.close()
        }
    } catch (error) {
        console.error('退出应用失败:', error)
        throw error
    }
}

/**
 * 重启应用
 */
export const restartApp = async (): Promise<void> => {
    try {
        if (window.__TAURI__) {
            await invoke('restart_app')
        } else {
            window.location.reload()
        }
    } catch (error) {
        console.error('重启应用失败:', error)
        throw error
    }
}
