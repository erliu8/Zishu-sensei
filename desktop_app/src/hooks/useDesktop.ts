import type { AppSettings } from '@/types/app'
import { useCallback, useEffect, useState } from 'react'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useSettings } from './useSettings'
import { useTauri } from './useTauri'
import { useWindowManager } from './useWindowManager'

/**
 * 桌面应用状态
 */
interface DesktopAppState {
    isReady: boolean
    isMinimizedToTray: boolean
    hasUpdate: boolean
    updateInfo?: {
        version: string
        releaseNotes: string
        downloadUrl: string
    }
    systemInfo: {
        platform: string
        arch: string
        version: string
    }
}

/**
 * 桌面应用管理器 Hook 返回值
 */
interface UseDesktopReturn {
    state: DesktopAppState
    settings: AppSettings
    updateSettings: (updates: Partial<AppSettings>) => Promise<void>
    minimizeToTray: () => Promise<void>
    restoreFromTray: () => Promise<void>
    showInTray: (show: boolean) => Promise<void>
    checkForUpdates: () => Promise<void>
    installUpdate: () => Promise<void>
    restartApp: () => Promise<void>
    openDevTools: () => Promise<void>
    setAutoStart: (enabled: boolean) => Promise<void>
    showNotification: (title: string, body?: string) => Promise<void>
    openExternal: (url: string) => Promise<void>
    showSaveDialog: (options?: any) => Promise<string | null>
    showOpenDialog: (options?: any) => Promise<string[] | null>
    writeFile: (path: string, content: string) => Promise<void>
    readFile: (path: string) => Promise<string>
    registerGlobalShortcuts: () => void
    unregisterGlobalShortcuts: () => void
}

/**
 * 桌面应用管理 Hook
 */
export const useDesktop = (): UseDesktopReturn => {
    const { isAvailable, invoke, listen } = useTauri()
    const { settings, updateSettings } = useSettings()
    const { show, hide, close } = useWindowManager()
    const { register, unregister } = useKeyboardShortcuts()

    const [state, setState] = useState<DesktopAppState>({
        isReady: false,
        isMinimizedToTray: false,
        hasUpdate: false,
        systemInfo: {
            platform: 'unknown',
            arch: 'unknown',
            version: 'unknown',
        },
    })

    // 初始化桌面应用
    const initializeDesktop = useCallback(async () => {
        if (!isAvailable) {
            setState(prev => ({ ...prev, isReady: true }))
            return
        }

        try {
            // 获取系统信息
            const systemInfo = await invoke('get_system_info')

            // 设置应用图标
            await invoke('set_app_icon', { iconPath: '/icons/app-icon.png' })

            // 检查更新
            await checkForUpdates()

            setState(prev => ({
                ...prev,
                isReady: true,
                systemInfo,
            }))
        } catch (error) {
            console.error('Failed to initialize desktop app:', error)
            setState(prev => ({ ...prev, isReady: true }))
        }
    }, [isAvailable, invoke])

    // 最小化到系统托盘
    const minimizeToTray = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('minimize_to_tray')
            await hide()
            setState(prev => ({ ...prev, isMinimizedToTray: true }))
        } catch (error) {
            console.error('Failed to minimize to tray:', error)
        }
    }, [isAvailable, invoke, hide])

    // 从系统托盘恢复
    const restoreFromTray = useCallback(async () => {
        if (!isAvailable) return

        try {
            await show()
            await invoke('restore_from_tray')
            setState(prev => ({ ...prev, isMinimizedToTray: false }))
        } catch (error) {
            console.error('Failed to restore from tray:', error)
        }
    }, [isAvailable, invoke, show])

    // 显示/隐藏系统托盘图标
    const showInTray = useCallback(async (show: boolean) => {
        if (!isAvailable) return

        try {
            await invoke('show_in_tray', { show })
        } catch (error) {
            console.error('Failed to toggle tray visibility:', error)
        }
    }, [isAvailable, invoke])

    // 检查更新
    const checkForUpdates = useCallback(async () => {
        if (!isAvailable) return

        try {
            const updateInfo = await invoke('check_for_updates')

            if (updateInfo && updateInfo.available) {
                setState(prev => ({
                    ...prev,
                    hasUpdate: true,
                    updateInfo: {
                        version: updateInfo.version,
                        releaseNotes: updateInfo.releaseNotes || '',
                        downloadUrl: updateInfo.downloadUrl || '',
                    },
                }))
            } else {
                setState(prev => ({ ...prev, hasUpdate: false, updateInfo: undefined }))
            }
        } catch (error) {
            console.error('Failed to check for updates:', error)
        }
    }, [isAvailable, invoke])

    // 安装更新
    const installUpdate = useCallback(async () => {
        if (!isAvailable || !state.hasUpdate) return

        try {
            await invoke('install_update')
        } catch (error) {
            console.error('Failed to install update:', error)
        }
    }, [isAvailable, invoke, state.hasUpdate])

    // 重启应用
    const restartApp = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('restart_app')
        } catch (error) {
            console.error('Failed to restart app:', error)
        }
    }, [isAvailable, invoke])

    // 打开开发者工具
    const openDevTools = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('open_dev_tools')
        } catch (error) {
            console.error('Failed to open dev tools:', error)
        }
    }, [isAvailable, invoke])

    // 设置开机自启
    const setAutoStart = useCallback(async (enabled: boolean) => {
        if (!isAvailable) return

        try {
            await invoke('set_auto_start', { enabled })
            await updateSettings({ autoStart: enabled })
        } catch (error) {
            console.error('Failed to set auto start:', error)
        }
    }, [isAvailable, invoke, updateSettings])

    // 显示通知
    const showNotification = useCallback(async (title: string, body?: string) => {
        if (!isAvailable) {
            // 浏览器环境下使用 Web Notification API
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { body })
            }
            return
        }

        try {
            await invoke('show_notification', { title, body })
        } catch (error) {
            console.error('Failed to show notification:', error)
        }
    }, [isAvailable, invoke])

    // 打开外部链接
    const openExternal = useCallback(async (url: string) => {
        if (!isAvailable) {
            window.open(url, '_blank')
            return
        }

        try {
            await invoke('open_external', { url })
        } catch (error) {
            console.error('Failed to open external URL:', error)
        }
    }, [isAvailable, invoke])

    // 显示保存对话框
    const showSaveDialog = useCallback(async (options?: any): Promise<string | null> => {
        if (!isAvailable) return null

        try {
            const result = await invoke('show_save_dialog', { options })
            return result || null
        } catch (error) {
            console.error('Failed to show save dialog:', error)
            return null
        }
    }, [isAvailable, invoke])

    // 显示打开对话框
    const showOpenDialog = useCallback(async (options?: any): Promise<string[] | null> => {
        if (!isAvailable) return null

        try {
            const result = await invoke('show_open_dialog', { options })
            return result || null
        } catch (error) {
            console.error('Failed to show open dialog:', error)
            return null
        }
    }, [isAvailable, invoke])

    // 写入文件
    const writeFile = useCallback(async (path: string, content: string) => {
        if (!isAvailable) return

        try {
            await invoke('write_file', { path, content })
        } catch (error) {
            console.error('Failed to write file:', error)
            throw error
        }
    }, [isAvailable, invoke])

    // 读取文件
    const readFile = useCallback(async (path: string): Promise<string> => {
        if (!isAvailable) throw new Error('File operations not available in browser')

        try {
            const content = await invoke('read_file', { path })
            return content
        } catch (error) {
            console.error('Failed to read file:', error)
            throw error
        }
    }, [isAvailable, invoke])

    // 注册全局快捷键
    const registerGlobalShortcuts = useCallback(() => {
        // 显示/隐藏窗口
        register({
            key: 'Space',
            ctrl: true,
            alt: true,
            global: true,
            description: '显示/隐藏窗口',
            callback: async () => {
                if (state.isMinimizedToTray) {
                    await restoreFromTray()
                } else {
                    await minimizeToTray()
                }
            },
        })

        // 打开设置
        register({
            key: ',',
            ctrl: true,
            global: true,
            description: '打开设置',
            callback: () => {
                // 这里应该触发打开设置界面的事件
                window.dispatchEvent(new CustomEvent('open-settings'))
            },
        })

        // 退出应用
        register({
            key: 'Q',
            ctrl: true,
            shift: true,
            global: true,
            description: '退出应用',
            callback: async () => {
                await close()
            },
        })
    }, [register, state.isMinimizedToTray, restoreFromTray, minimizeToTray, close])

    // 取消注册全局快捷键
    const unregisterGlobalShortcuts = useCallback(() => {
        unregister('Space-true-true-false-false')
        unregister(',-true-false-false-false')
        unregister('Q-true-false-true-false')
    }, [unregister])

    // 监听系统事件
    useEffect(() => {
        if (!isAvailable) return

        const listeners: (() => void)[] = []

        const setupListeners = async () => {
            try {
                // 监听托盘点击事件
                const unlistenTrayClick = await listen('tray-click', () => {
                    if (state.isMinimizedToTray) {
                        restoreFromTray()
                    } else {
                        minimizeToTray()
                    }
                })
                listeners.push(unlistenTrayClick)

                // 监听更新事件
                const unlistenUpdateAvailable = await listen('update-available', (event: any) => {
                    setState(prev => ({
                        ...prev,
                        hasUpdate: true,
                        updateInfo: event.payload,
                    }))
                })
                listeners.push(unlistenUpdateAvailable)

                // 监听窗口关闭事件
                const unlistenWindowClose = await listen('tauri://close-requested', async () => {
                    if (settings.windowState.mode === 'minimized') {
                        await minimizeToTray()
                    } else {
                        await close()
                    }
                })
                listeners.push(unlistenWindowClose)
            } catch (error) {
                console.error('Failed to setup desktop listeners:', error)
            }
        }

        setupListeners()

        return () => {
            listeners.forEach(unlisten => unlisten())
        }
    }, [isAvailable, listen, state.isMinimizedToTray, restoreFromTray, minimizeToTray, settings.windowState.mode, close])

    // 初始化
    useEffect(() => {
        initializeDesktop()
    }, [initializeDesktop])

    // 注册全局快捷键
    useEffect(() => {
        registerGlobalShortcuts()
        return () => {
            unregisterGlobalShortcuts()
        }
    }, [registerGlobalShortcuts, unregisterGlobalShortcuts])

    // 请求通知权限（浏览器环境）
    useEffect(() => {
        if (!isAvailable && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission()
        }
    }, [isAvailable])

    return {
        state,
        settings,
        updateSettings,
        minimizeToTray,
        restoreFromTray,
        showInTray,
        checkForUpdates,
        installUpdate,
        restartApp,
        openDevTools,
        setAutoStart,
        showNotification,
        openExternal,
        showSaveDialog,
        showOpenDialog,
        writeFile,
        readFile,
        registerGlobalShortcuts,
        unregisterGlobalShortcuts,
    }
}
