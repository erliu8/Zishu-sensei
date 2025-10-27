import type { AppSettings } from '@/types/app'
import type { AppConfig } from '@/types/settings'
import type { TauriNotificationOptions, TauriFileDialogOptions } from '@/types/tauri'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useSettings } from './useSettings'
import { useTauri } from './useTauri'
import { useWindowManager } from './useWindowManager'

/**
 * 桌面应用状态
 */
interface DesktopAppState {
    isReady: boolean
    isInitializing: boolean
    isMinimizedToTray: boolean
    hasUpdate: boolean
    updateInfo?: {
        version: string
        releaseNotes: string
        downloadUrl: string
        publishedAt?: string
    }
    systemInfo: {
        platform: string
        arch: string
        version: string
        os: string
        tauriVersion: string
        webviewVersion: string
    }
    appInfo: {
        name: string
        version: string
        buildDate: string
    }
    performance: {
        memoryUsage: number
        cpuUsage: number
        uptime: number
    }
    connectivity: {
        isOnline: boolean
        apiEndpoint: string
        lastPing: number
    }
}

/**
 * 桌面操作状态
 */
interface DesktopOperationState {
    isLoading: boolean
    error: string | null
    lastOperation: string | null
    operationHistory: Array<{
        operation: string
        timestamp: number
        success: boolean
        error?: string
    }>
}

/**
 * 文件操作结果
 */
interface FileOperationResult {
    success: boolean
    path?: string
    content?: string
    error?: string
}

/**
 * 系统信息
 */
interface SystemInfo {
    platform: string
    arch: string
    version: string
    os: string
    tauriVersion: string
    webviewVersion: string
    memory: {
        total: number
        used: number
        free: number
    }
    cpu: {
        cores: number
        usage: number
    }
    disk: {
        total: number
        used: number
        free: number
    }
}

/**
 * 桌面应用管理器 Hook 返回值
 */
interface UseDesktopReturn {
    // ==================== 基础状态 ====================
    state: DesktopAppState
    operationState: DesktopOperationState
    settings: AppSettings
    config: AppConfig
    isAvailable: boolean
    isLoading: boolean
    error: string | null

    // ==================== 应用管理 ====================
    initializeApp: () => Promise<void>
    restartApp: () => Promise<void>
    exitApp: () => Promise<void>
    getAppInfo: () => Promise<any>
    getSystemInfo: () => Promise<SystemInfo>
    checkConnectivity: () => Promise<boolean>

    // ==================== 窗口管理 ====================
    minimizeToTray: () => Promise<void>
    restoreFromTray: () => Promise<void>
    showInTray: (show: boolean) => Promise<void>
    toggleWindowMode: () => Promise<void>
    setWindowMode: (mode: string) => Promise<void>
    centerWindow: () => Promise<void>
    setAlwaysOnTop: (enabled: boolean) => Promise<void>

    // ==================== 更新管理 ====================
    checkForUpdates: () => Promise<void>
    installUpdate: () => Promise<void>
    downloadUpdate: () => Promise<void>
    skipUpdate: () => Promise<void>

    // ==================== 系统集成 ====================
    setAutoStart: (enabled: boolean) => Promise<void>
    openDevTools: () => Promise<void>
    showNotification: (options: TauriNotificationOptions) => Promise<void>
    openExternal: (url: string) => Promise<void>
    copyToClipboard: (text: string) => Promise<void>
    readFromClipboard: () => Promise<string>

    // ==================== 文件操作 ====================
    showSaveDialog: (options?: TauriFileDialogOptions) => Promise<string | null>
    showOpenDialog: (options?: TauriFileDialogOptions) => Promise<string[] | null>
    writeFile: (path: string, content: string) => Promise<FileOperationResult>
    readFile: (path: string) => Promise<FileOperationResult>
    deleteFile: (path: string) => Promise<FileOperationResult>
    createDirectory: (path: string) => Promise<FileOperationResult>
    listDirectory: (path: string) => Promise<string[]>
    getFileInfo: (path: string) => Promise<any>

    // ==================== 设置管理 ====================
    updateSettings: (updates: Partial<AppSettings>) => Promise<void>
    updateConfig: (config: AppConfig) => Promise<void>
    exportSettings: () => Promise<string>
    importSettings: (settingsJson: string) => Promise<void>
    resetSettings: () => Promise<void>

    // ==================== 快捷键管理 ====================
    registerGlobalShortcuts: () => void
    unregisterGlobalShortcuts: () => void
    registerShortcut: (shortcut: string, callback: () => void) => Promise<void>
    unregisterShortcut: (shortcut: string) => Promise<void>

    // ==================== 性能监控 ====================
    getPerformanceMetrics: () => Promise<any>
    startPerformanceMonitoring: () => void
    stopPerformanceMonitoring: () => void

    // ==================== 工具方法 ====================
    clearError: () => void
    clearOperationHistory: () => void
    retryLastOperation: () => Promise<void>
    logOperation: (operation: string, success: boolean, error?: string) => void
}

/**
 * 桌面应用管理 Hook
 */
export const useDesktop = (): UseDesktopReturn => {
    const { isAvailable, invoke, listen } = useTauri()
    const { settings, config, updateSettings, updateConfig, exportSettings, importSettings, resetSettings } = useSettings()
    const { show, hide, close, center, setAlwaysOnTop, toggleWindowMode, setWindowMode } = useWindowManager()
    const { register, unregister } = useKeyboardShortcuts()

    const [state, setState] = useState<DesktopAppState>({
        isReady: false,
        isInitializing: false,
        isMinimizedToTray: false,
        hasUpdate: false,
        systemInfo: {
            platform: 'unknown',
            arch: 'unknown',
            version: 'unknown',
            os: 'unknown',
            tauriVersion: 'unknown',
            webviewVersion: 'unknown',
        },
        appInfo: {
            name: 'Zishu Sensei',
            version: '1.0.0',
            buildDate: '',
        },
        performance: {
            memoryUsage: 0,
            cpuUsage: 0,
            uptime: 0,
        },
        connectivity: {
            isOnline: false,
            apiEndpoint: 'http://127.0.0.1:8000',
            lastPing: 0,
        },
    })

    const [operationState, setOperationState] = useState<DesktopOperationState>({
        isLoading: false,
        error: null,
        lastOperation: null,
        operationHistory: [],
    })

    const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const connectivityIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // ==================== 工具方法 ====================

    // 记录操作日志
    const logOperation = useCallback((operation: string, success: boolean, error?: string) => {
        const entry = {
            operation,
            timestamp: Date.now(),
            success,
            error,
        }
        
        setOperationState(prev => ({
            ...prev,
            lastOperation: operation,
            operationHistory: [entry, ...prev.operationHistory.slice(0, 99)], // 保留最近100条记录
        }))
    }, [])

    // 执行操作包装器
    const executeOperation = useCallback(async <T>(
        operation: string,
        operationFn: () => Promise<T>
    ): Promise<T> => {
        setOperationState(prev => ({ ...prev, isLoading: true, error: null }))
        
        try {
            const result = await operationFn()
            logOperation(operation, true)
            return result
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            setOperationState(prev => ({ ...prev, error: errorMessage }))
            logOperation(operation, false, errorMessage)
            throw error
        } finally {
            setOperationState(prev => ({ ...prev, isLoading: false }))
        }
    }, [logOperation])

    // ==================== 应用管理 ====================

    // 初始化应用
    const initializeApp = useCallback(async () => {
        await executeOperation('initialize_app', async () => {
            if (!isAvailable) {
                setState(prev => ({ ...prev, isReady: true, isInitializing: false }))
                return
            }

            setState(prev => ({ ...prev, isInitializing: true }))

            try {
                // 获取系统信息
                const systemInfo = await invoke<SystemInfo>('get_system_info')
                
                // 获取应用信息
                const appInfo = await invoke<any>('get_app_info')
                
                // 检查连接性
                const isOnline = await checkConnectivity()
                
                // 检查更新
                await checkForUpdates()

                setState(prev => ({
                    ...prev,
                    isReady: true,
                    isInitializing: false,
                    systemInfo: {
                        platform: systemInfo.platform,
                        arch: systemInfo.arch,
                        version: systemInfo.version,
                        os: systemInfo.os,
                        tauriVersion: systemInfo.tauriVersion,
                        webviewVersion: systemInfo.webviewVersion,
                    },
                    appInfo: {
                        name: appInfo.name || 'Zishu Sensei',
                        version: appInfo.version || '1.0.0',
                        buildDate: appInfo.buildDate || '',
                    },
                    connectivity: {
                        ...prev.connectivity,
                        isOnline,
                        lastPing: Date.now(),
                    },
                }))

                // 启动性能监控
                startPerformanceMonitoring()
                
                // 启动连接性检查
                startConnectivityMonitoring()
                
            } catch (error) {
                console.error('Failed to initialize desktop app:', error)
                setState(prev => ({ 
                    ...prev, 
                    isReady: true, 
                    isInitializing: false 
                }))
            }
        })
    }, [isAvailable, invoke, executeOperation])

    // 重启应用
    const restartApp = useCallback(async () => {
        await executeOperation('restart_app', async () => {
            if (!isAvailable) return
            await invoke('restart_app')
        })
    }, [isAvailable, invoke, executeOperation])

    // 退出应用
    const exitApp = useCallback(async () => {
        await executeOperation('exit_app', async () => {
            if (!isAvailable) return
            await invoke('exit_app')
        })
    }, [isAvailable, invoke, executeOperation])

    // 获取应用信息
    const getAppInfo = useCallback(async () => {
        return await executeOperation('get_app_info', async () => {
            if (!isAvailable) return state.appInfo
            return await invoke('get_app_info')
        })
    }, [isAvailable, invoke, executeOperation, state.appInfo])

    // 获取系统信息
    const getSystemInfo = useCallback(async (): Promise<SystemInfo> => {
        return await executeOperation('get_system_info', async () => {
            if (!isAvailable) {
                return {
                    platform: 'unknown',
                    arch: 'unknown',
                    version: 'unknown',
                    os: 'unknown',
                    tauriVersion: 'unknown',
                    webviewVersion: 'unknown',
                    memory: { total: 0, used: 0, free: 0 },
                    cpu: { cores: 0, usage: 0 },
                    disk: { total: 0, used: 0, free: 0 },
                }
            }
            return await invoke<SystemInfo>('get_system_info')
        })
    }, [isAvailable, invoke, executeOperation])

    // 检查连接性
    const checkConnectivity = useCallback(async (): Promise<boolean> => {
        try {
            if (!isAvailable) return navigator.onLine
            
            const response = await invoke<{ success: boolean }>('check_connectivity', {
                endpoint: state.connectivity.apiEndpoint
            })
            
            const isOnline = response.success
            setState(prev => ({
                ...prev,
                connectivity: {
                    ...prev.connectivity,
                    isOnline,
                    lastPing: Date.now(),
                }
            }))
            
            return isOnline
        } catch (error) {
            console.error('Failed to check connectivity:', error)
            return false
        }
    }, [isAvailable, invoke, state.connectivity.apiEndpoint])

    // ==================== 窗口管理 ====================

    // 最小化到系统托盘
    const minimizeToTray = useCallback(async () => {
        await executeOperation('minimize_to_tray', async () => {
            if (!isAvailable) return

            await invoke('minimize_to_tray')
            await hide()
            setState(prev => ({ ...prev, isMinimizedToTray: true }))
        })
    }, [isAvailable, invoke, hide, executeOperation])

    // 从系统托盘恢复
    const restoreFromTray = useCallback(async () => {
        await executeOperation('restore_from_tray', async () => {
            if (!isAvailable) return

            await show()
            await invoke('restore_from_tray')
            setState(prev => ({ ...prev, isMinimizedToTray: false }))
        })
    }, [isAvailable, invoke, show, executeOperation])

    // 显示/隐藏系统托盘图标
    const showInTray = useCallback(async (show: boolean) => {
        await executeOperation('show_in_tray', async () => {
            if (!isAvailable) return
            await invoke('show_in_tray', { show })
        })
    }, [isAvailable, invoke, executeOperation])

    // 切换窗口模式
    const toggleWindowModeHandler = useCallback(async () => {
        await executeOperation('toggle_window_mode', async () => {
            await toggleWindowMode()
        })
    }, [toggleWindowMode, executeOperation])

    // 设置窗口模式
    const setWindowModeHandler = useCallback(async (mode: string) => {
        await executeOperation('set_window_mode', async () => {
            await setWindowMode(mode as any)
        })
    }, [setWindowMode, executeOperation])

    // 居中窗口
    const centerWindow = useCallback(async () => {
        await executeOperation('center_window', async () => {
            await center()
        })
    }, [center, executeOperation])

    // 设置置顶
    const setAlwaysOnTopHandler = useCallback(async (enabled: boolean) => {
        await executeOperation('set_always_on_top', async () => {
            await setAlwaysOnTop(enabled)
        })
    }, [setAlwaysOnTop, executeOperation])

    // ==================== 更新管理 ====================

    // 检查更新
    const checkForUpdates = useCallback(async () => {
        await executeOperation('check_for_updates', async () => {
            if (!isAvailable) return

            const updateInfo = await invoke<any>('check_for_updates')

            if (updateInfo && updateInfo.available) {
                setState(prev => ({
                    ...prev,
                    hasUpdate: true,
                    updateInfo: {
                        version: updateInfo.version,
                        releaseNotes: updateInfo.releaseNotes || '',
                        downloadUrl: updateInfo.downloadUrl || '',
                        publishedAt: updateInfo.publishedAt,
                    },
                }))
            } else {
                setState(prev => ({ ...prev, hasUpdate: false, updateInfo: undefined }))
            }
        })
    }, [isAvailable, invoke, executeOperation])

    // 安装更新
    const installUpdate = useCallback(async () => {
        await executeOperation('install_update', async () => {
            if (!isAvailable || !state.hasUpdate) return
            await invoke('install_update')
        })
    }, [isAvailable, invoke, state.hasUpdate, executeOperation])

    // 下载更新
    const downloadUpdate = useCallback(async () => {
        await executeOperation('download_update', async () => {
            if (!isAvailable || !state.hasUpdate) return
            await invoke('download_update')
        })
    }, [isAvailable, invoke, state.hasUpdate, executeOperation])

    // 跳过更新
    const skipUpdate = useCallback(async () => {
        await executeOperation('skip_update', async () => {
            setState(prev => ({ ...prev, hasUpdate: false, updateInfo: undefined }))
        })
    }, [executeOperation])

    // ==================== 系统集成 ====================

    // 设置开机自启
    const setAutoStart = useCallback(async (enabled: boolean) => {
        await executeOperation('set_auto_start', async () => {
            if (!isAvailable) return
            await invoke('set_auto_start', { enabled })
            await updateSettings({ autoStart: enabled })
        })
    }, [isAvailable, invoke, updateSettings, executeOperation])

    // 打开开发者工具
    const openDevTools = useCallback(async () => {
        await executeOperation('open_dev_tools', async () => {
            if (!isAvailable) return
            await invoke('open_dev_tools')
        })
    }, [isAvailable, invoke, executeOperation])

    // 显示通知
    const showNotification = useCallback(async (options: TauriNotificationOptions) => {
        await executeOperation('show_notification', async () => {
            if (!isAvailable) {
                // 浏览器环境下使用 Web Notification API
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(options.title, { body: options.body })
                }
                return
            }

            await invoke('show_notification', options)
        })
    }, [isAvailable, invoke, executeOperation])

    // 打开外部链接
    const openExternal = useCallback(async (url: string) => {
        await executeOperation('open_external', async () => {
            if (!isAvailable) {
                window.open(url, '_blank')
                return
            }

            await invoke('open_external', { url })
        })
    }, [isAvailable, invoke, executeOperation])

    // 复制到剪贴板
    const copyToClipboard = useCallback(async (text: string) => {
        await executeOperation('copy_to_clipboard', async () => {
            if (!isAvailable) {
                await navigator.clipboard.writeText(text)
                return
            }

            await invoke('copy_to_clipboard', { text })
        })
    }, [isAvailable, invoke, executeOperation])

    // 从剪贴板读取
    const readFromClipboard = useCallback(async (): Promise<string> => {
        return await executeOperation('read_from_clipboard', async () => {
            if (!isAvailable) {
                return await navigator.clipboard.readText()
            }

            return await invoke<string>('read_from_clipboard')
        })
    }, [isAvailable, invoke, executeOperation])

    // ==================== 文件操作 ====================

    // 显示保存对话框
    const showSaveDialog = useCallback(async (options?: TauriFileDialogOptions): Promise<string | null> => {
        return await executeOperation('show_save_dialog', async () => {
            if (!isAvailable) return null

            const result = await invoke<string>('show_save_dialog', { options })
            return result || null
        })
    }, [isAvailable, invoke, executeOperation])

    // 显示打开对话框
    const showOpenDialog = useCallback(async (options?: TauriFileDialogOptions): Promise<string[] | null> => {
        return await executeOperation('show_open_dialog', async () => {
            if (!isAvailable) return null

            const result = await invoke<string[]>('show_open_dialog', { options })
            return result || null
        })
    }, [isAvailable, invoke, executeOperation])

    // 写入文件
    const writeFile = useCallback(async (path: string, content: string): Promise<FileOperationResult> => {
        return await executeOperation('write_file', async () => {
            if (!isAvailable) {
                throw new Error('File operations not available in browser')
            }

            await invoke('write_file', { path, content })
            return { success: true, path }
        })
    }, [isAvailable, invoke, executeOperation])

    // 读取文件
    const readFile = useCallback(async (path: string): Promise<FileOperationResult> => {
        return await executeOperation('read_file', async () => {
            if (!isAvailable) {
                throw new Error('File operations not available in browser')
            }

            const content = await invoke<string>('read_file', { path })
            return { success: true, path, content }
        })
    }, [isAvailable, invoke, executeOperation])

    // 删除文件
    const deleteFile = useCallback(async (path: string): Promise<FileOperationResult> => {
        return await executeOperation('delete_file', async () => {
            if (!isAvailable) {
                throw new Error('File operations not available in browser')
            }

            await invoke('delete_file', { path })
            return { success: true, path }
        })
    }, [isAvailable, invoke, executeOperation])

    // 创建目录
    const createDirectory = useCallback(async (path: string): Promise<FileOperationResult> => {
        return await executeOperation('create_directory', async () => {
            if (!isAvailable) {
                throw new Error('File operations not available in browser')
            }

            await invoke('create_directory', { path })
            return { success: true, path }
        })
    }, [isAvailable, invoke, executeOperation])

    // 列出目录
    const listDirectory = useCallback(async (path: string): Promise<string[]> => {
        return await executeOperation('list_directory', async () => {
            if (!isAvailable) {
                throw new Error('File operations not available in browser')
            }

            return await invoke<string[]>('list_directory', { path })
        })
    }, [isAvailable, invoke, executeOperation])

    // 获取文件信息
    const getFileInfo = useCallback(async (path: string): Promise<any> => {
        return await executeOperation('get_file_info', async () => {
            if (!isAvailable) {
                throw new Error('File operations not available in browser')
            }

            return await invoke('get_file_info', { path })
        })
    }, [isAvailable, invoke, executeOperation])

    // ==================== 设置管理 ====================

    // 更新设置（使用现有的 useSettings）
    const updateSettingsHandler = useCallback(async (updates: Partial<AppSettings>) => {
        await executeOperation('update_settings', async () => {
            await updateSettings(updates)
        })
    }, [updateSettings, executeOperation])

    // 更新配置（使用现有的 useSettings）
    const updateConfigHandler = useCallback(async (config: AppConfig) => {
        await executeOperation('update_config', async () => {
            await updateConfig(config)
        })
    }, [updateConfig, executeOperation])

    // 导出设置（使用现有的 useSettings）
    const exportSettingsHandler = useCallback(async (): Promise<string> => {
        return await executeOperation('export_settings', async () => {
            return await exportSettings()
        })
    }, [exportSettings, executeOperation])

    // 导入设置（使用现有的 useSettings）
    const importSettingsHandler = useCallback(async (settingsJson: string) => {
        await executeOperation('import_settings', async () => {
            await importSettings(settingsJson)
        })
    }, [importSettings, executeOperation])

    // 重置设置（使用现有的 useSettings）
    const resetSettingsHandler = useCallback(async () => {
        await executeOperation('reset_settings', async () => {
            await resetSettings()
        })
    }, [resetSettings, executeOperation])

    // ==================== 快捷键管理 ====================

    // 注册全局快捷键
    const registerGlobalShortcuts = useCallback(() => {
        // 显示/隐藏窗口
        register({
            id: 'window-toggle-visibility',
            name: '显示/隐藏窗口',
            description: '显示/隐藏窗口',
            key: 'Space',
            modifiers: { ctrl: true, alt: true },
            scope: 'global',
            category: 'window',
            enabled: true,
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
            id: 'system-open-settings',
            name: '打开设置',
            description: '打开设置',
            key: ',',
            modifiers: { ctrl: true },
            scope: 'global',
            category: 'settings',
            enabled: true,
            callback: () => {
                window.dispatchEvent(new CustomEvent('open-settings'))
            },
        })

        // 退出应用
        register({
            id: 'system-quit',
            name: '退出应用',
            description: '退出应用',
            key: 'Q',
            modifiers: { ctrl: true, shift: true },
            scope: 'global',
            category: 'system',
            enabled: true,
            callback: async () => {
                await close()
            },
        })
    }, [register, state.isMinimizedToTray, restoreFromTray, minimizeToTray, close])

    // 取消注册全局快捷键
    const unregisterGlobalShortcuts = useCallback(() => {
        unregister('window-toggle-visibility')
        unregister('system-open-settings')
        unregister('system-quit')
    }, [unregister])

    // 注册单个快捷键
    const registerShortcut = useCallback(async (shortcut: string, callback: () => void) => {
        await executeOperation('register_shortcut', async () => {
            register({
                id: `custom-${shortcut}`,
                name: `自定义快捷键: ${shortcut}`,
                description: `自定义快捷键: ${shortcut}`,
                key: shortcut,
                modifiers: {},
                scope: 'global',
                category: 'custom',
                enabled: true,
                callback,
            })
        })
    }, [register, executeOperation])

    // 取消注册单个快捷键
    const unregisterShortcut = useCallback(async (shortcut: string) => {
        await executeOperation('unregister_shortcut', async () => {
            unregister(shortcut)
        })
    }, [unregister, executeOperation])

    // ==================== 性能监控 ====================

    // 获取性能指标
    const getPerformanceMetrics = useCallback(async () => {
        return await executeOperation('get_performance_metrics', async () => {
            if (!isAvailable) {
                return {
                    memory: (performance as any).memory ? {
                        used: (performance as any).memory.usedJSHeapSize,
                        total: (performance as any).memory.totalJSHeapSize,
                    } : null,
                    timing: performance.timing,
                }
            }

            return await invoke('get_performance_metrics')
        })
    }, [isAvailable, invoke, executeOperation])

    // 启动性能监控
    const startPerformanceMonitoring = useCallback(() => {
        if (performanceIntervalRef.current) return

        performanceIntervalRef.current = setInterval(async () => {
            try {
                const metrics = await getPerformanceMetrics()
                setState(prev => ({
                    ...prev,
                    performance: {
                        memoryUsage: metrics.memory?.used || 0,
                        cpuUsage: metrics.cpu?.usage || 0,
                        uptime: Date.now() - (metrics.startTime || Date.now()),
                    },
                }))
            } catch (error) {
                console.error('Failed to update performance metrics:', error)
            }
        }, 5000) // 每5秒更新一次
    }, [getPerformanceMetrics])

    // 停止性能监控
    const stopPerformanceMonitoring = useCallback(() => {
        if (performanceIntervalRef.current) {
            clearInterval(performanceIntervalRef.current)
            performanceIntervalRef.current = null
        }
    }, [])

    // 启动连接性监控
    const startConnectivityMonitoring = useCallback(() => {
        if (connectivityIntervalRef.current) return

        connectivityIntervalRef.current = setInterval(async () => {
            try {
                await checkConnectivity()
            } catch (error) {
                console.error('Failed to check connectivity:', error)
            }
        }, 30000) // 每30秒检查一次
    }, [checkConnectivity])

    // 停止连接性监控
    const stopConnectivityMonitoring = useCallback(() => {
        if (connectivityIntervalRef.current) {
            clearInterval(connectivityIntervalRef.current)
            connectivityIntervalRef.current = null
        }
    }, [])

    // ==================== 工具方法 ====================

    // 清除错误
    const clearError = useCallback(() => {
        setOperationState(prev => ({ ...prev, error: null }))
    }, [])

    // 清除操作历史
    const clearOperationHistory = useCallback(() => {
        setOperationState(prev => ({ ...prev, operationHistory: [] }))
    }, [])

    // 重试上次操作
    const retryLastOperation = useCallback(async () => {
        const lastOp = operationState.lastOperation
        if (!lastOp) return

        // 这里可以根据 lastOperation 重新执行相应的操作
        // 简化实现，实际项目中可能需要更复杂的重试逻辑
        console.log(`Retrying last operation: ${lastOp}`)
    }, [operationState.lastOperation])

    // ==================== 事件监听 ====================

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

                // 监听性能指标更新
                const unlistenPerformanceUpdate = await listen('performance-update', (event: any) => {
                    setState(prev => ({
                        ...prev,
                        performance: {
                            ...prev.performance,
                            ...event.payload,
                        },
                    }))
                })
                listeners.push(unlistenPerformanceUpdate)

                // 监听连接状态变化
                const unlistenConnectivityChange = await listen('connectivity-change', (event: any) => {
                    setState(prev => ({
                        ...prev,
                        connectivity: {
                            ...prev.connectivity,
                            isOnline: event.payload.isOnline,
                            lastPing: Date.now(),
                        },
                    }))
                })
                listeners.push(unlistenConnectivityChange)

            } catch (error) {
                console.error('Failed to setup desktop listeners:', error)
            }
        }

        setupListeners()

        return () => {
            listeners.forEach(unlisten => unlisten())
        }
    }, [isAvailable, listen, state.isMinimizedToTray, restoreFromTray, minimizeToTray, settings.windowState.mode, close])

    // 初始化应用
    useEffect(() => {
        initializeApp()
    }, [initializeApp])

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

    // 清理定时器
    useEffect(() => {
        return () => {
            stopPerformanceMonitoring()
            stopConnectivityMonitoring()
        }
    }, [stopPerformanceMonitoring, stopConnectivityMonitoring])

    // ==================== 返回值 ====================

    return {
        // 基础状态
        state,
        operationState,
        settings,
        config,
        isAvailable,
        isLoading: operationState.isLoading || state.isInitializing,
        error: operationState.error,

        // 应用管理
        initializeApp,
        restartApp,
        exitApp,
        getAppInfo,
        getSystemInfo,
        checkConnectivity,

        // 窗口管理
        minimizeToTray,
        restoreFromTray,
        showInTray,
        toggleWindowMode: toggleWindowModeHandler,
        setWindowMode: setWindowModeHandler,
        centerWindow,
        setAlwaysOnTop: setAlwaysOnTopHandler,

        // 更新管理
        checkForUpdates,
        installUpdate,
        downloadUpdate,
        skipUpdate,

        // 系统集成
        setAutoStart,
        openDevTools,
        showNotification,
        openExternal,
        copyToClipboard,
        readFromClipboard,

        // 文件操作
        showSaveDialog,
        showOpenDialog,
        writeFile,
        readFile,
        deleteFile,
        createDirectory,
        listDirectory,
        getFileInfo,

        // 设置管理
        updateSettings: updateSettingsHandler,
        updateConfig: updateConfigHandler,
        exportSettings: exportSettingsHandler,
        importSettings: importSettingsHandler,
        resetSettings: resetSettingsHandler,

        // 快捷键管理
        registerGlobalShortcuts,
        unregisterGlobalShortcuts,
        registerShortcut,
        unregisterShortcut,

        // 性能监控
        getPerformanceMetrics,
        startPerformanceMonitoring,
        stopPerformanceMonitoring,

        // 工具方法
        clearError,
        clearOperationHistory,
        retryLastOperation,
        logOperation,
    }
}
