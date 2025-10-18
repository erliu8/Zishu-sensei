/**
 * 桌面应用状态管理 Store
 * 
 * 使用 Zustand 管理桌面应用的状态，包括：
 * - 应用状态和系统信息
 * - 窗口状态和操作历史
 * - 性能监控数据
 * - 连接性和更新状态
 * - 错误处理和重试机制
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import type { AppSettings, ApiResponse } from '@/types/app'
import type { AppConfig } from '@/types/settings'
import type { TauriEnvironment } from '@/types/tauri'

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
        lastUpdate: number
    }
    connectivity: {
        isOnline: boolean
        apiEndpoint: string
        lastPing: number
        latency: number
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
        id: string
        operation: string
        timestamp: number
        success: boolean
        duration: number
        error?: string
        metadata?: Record<string, any>
    }>
    retryQueue: Array<{
        id: string
        operation: string
        timestamp: number
        attempts: number
        maxAttempts: number
        error: string
    }>
}

/**
 * 窗口状态
 */
interface WindowState {
    mode: 'pet' | 'chat' | 'settings' | 'minimized' | 'maximized' | 'fullscreen'
    position: { x: number; y: number }
    size: { width: number; height: number }
    isVisible: boolean
    isAlwaysOnTop: boolean
    isResizable: boolean
    title: string
    opacity: number
    zIndex: number
}

/**
 * 快捷键状态
 */
interface ShortcutState {
    registered: Array<{
        id: string
        key: string
        ctrl?: boolean
        alt?: boolean
        shift?: boolean
        global: boolean
        description: string
        callback: () => void
    }>
    isEnabled: boolean
    lastTriggered?: {
        shortcut: string
        timestamp: number
    }
}

/**
 * 文件操作状态
 */
interface FileOperationState {
    recentFiles: Array<{
        path: string
        name: string
        lastAccessed: number
        size: number
        type: string
    }>
    openFiles: Array<{
        path: string
        content?: string
        isModified: boolean
        lastModified: number
    }>
    clipboard: {
        text: string
        timestamp: number
    }
}

/**
 * 通知状态
 */
interface NotificationState {
    queue: Array<{
        id: string
        title: string
        body?: string
        icon?: string
        timestamp: number
        read: boolean
        actions?: Array<{
            label: string
            action: string
        }>
    }>
    isEnabled: boolean
    permission: 'granted' | 'denied' | 'default'
}

/**
 * 桌面应用 Store 状态
 */
interface DesktopStoreState {
    // ==================== 基础状态 ====================
    appState: DesktopAppState
    operationState: DesktopOperationState
    windowState: WindowState
    shortcutState: ShortcutState
    fileOperationState: FileOperationState
    notificationState: NotificationState
    
    // ==================== 设置状态 ====================
    settings: AppSettings
    config: AppConfig
    
    // ==================== 状态标志 ====================
    isInitialized: boolean
    isOnline: boolean
    lastSyncTime: number
    
    // ==================== 应用状态管理 ====================
    initializeApp: () => Promise<void>
    setAppReady: (ready: boolean) => void
    setInitializing: (initializing: boolean) => void
    updateSystemInfo: (info: Partial<DesktopAppState['systemInfo']>) => void
    updateAppInfo: (info: Partial<DesktopAppState['appInfo']>) => void
    updatePerformance: (metrics: Partial<DesktopAppState['performance']>) => void
    updateConnectivity: (status: Partial<DesktopAppState['connectivity']>) => void
    
    // ==================== 更新管理 ====================
    setUpdateAvailable: (updateInfo: DesktopAppState['updateInfo']) => void
    clearUpdate: () => void
    setMinimizedToTray: (minimized: boolean) => void
    
    // ==================== 操作管理 ====================
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void
    addOperation: (operation: Omit<DesktopOperationState['operationHistory'][0], 'id' | 'timestamp' | 'duration'>) => void
    clearOperationHistory: () => void
    addToRetryQueue: (operation: Omit<DesktopOperationState['retryQueue'][0], 'id' | 'timestamp' | 'attempts'>) => void
    removeFromRetryQueue: (id: string) => void
    clearRetryQueue: () => void
    
    // ==================== 窗口管理 ====================
    setWindowMode: (mode: WindowState['mode']) => void
    setWindowPosition: (position: WindowState['position']) => void
    setWindowSize: (size: WindowState['size']) => void
    setWindowVisible: (visible: boolean) => void
    setAlwaysOnTop: (alwaysOnTop: boolean) => void
    setResizable: (resizable: boolean) => void
    setTitle: (title: string) => void
    setOpacity: (opacity: number) => void
    setZIndex: (zIndex: number) => void
    
    // ==================== 快捷键管理 ====================
    registerShortcut: (shortcut: Omit<ShortcutState['registered'][0], 'id'>) => string
    unregisterShortcut: (id: string) => void
    clearShortcuts: () => void
    setShortcutsEnabled: (enabled: boolean) => void
    triggerShortcut: (shortcut: string) => void
    
    // ==================== 文件操作管理 ====================
    addRecentFile: (file: Omit<FileOperationState['recentFiles'][0], 'lastAccessed'>) => void
    removeRecentFile: (path: string) => void
    clearRecentFiles: () => void
    openFile: (file: Omit<FileOperationState['openFiles'][0], 'lastModified'>) => void
    closeFile: (path: string) => void
    updateFileContent: (path: string, content: string) => void
    setFileModified: (path: string, modified: boolean) => void
    setClipboard: (text: string) => void
    
    // ==================== 通知管理 ====================
    addNotification: (notification: Omit<NotificationState['queue'][0], 'id' | 'timestamp' | 'read'>) => string
    removeNotification: (id: string) => void
    markNotificationRead: (id: string) => void
    clearNotifications: () => void
    setNotificationEnabled: (enabled: boolean) => void
    setNotificationPermission: (permission: NotificationState['permission']) => void
    
    // ==================== 设置管理 ====================
    updateSettings: (settings: Partial<AppSettings>) => void
    updateConfig: (config: Partial<AppConfig>) => void
    resetSettings: () => void
    resetConfig: () => void
    
    // ==================== 工具方法 ====================
    clearAllErrors: () => void
    resetAll: () => void
    exportState: () => string
    importState: (stateJson: string) => void
    getStateSnapshot: () => DesktopStoreState
    restoreStateSnapshot: (snapshot: Partial<DesktopStoreState>) => void
}

/**
 * 默认状态
 */
const defaultAppState: DesktopAppState = {
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
        lastUpdate: Date.now(),
    },
    connectivity: {
        isOnline: false,
        apiEndpoint: 'http://127.0.0.1:8000',
        lastPing: 0,
        latency: 0,
    },
}

const defaultOperationState: DesktopOperationState = {
    isLoading: false,
    error: null,
    lastOperation: null,
    operationHistory: [],
    retryQueue: [],
}

const defaultWindowState: WindowState = {
    mode: 'pet',
    position: { x: 0, y: 0 },
    size: { width: 400, height: 600 },
    isVisible: true,
    isAlwaysOnTop: true,
    isResizable: true,
    title: '紫舒老师桌面版',
    opacity: 1.0,
    zIndex: 1000,
}

const defaultShortcutState: ShortcutState = {
    registered: [],
    isEnabled: true,
}

const defaultFileOperationState: FileOperationState = {
    recentFiles: [],
    openFiles: [],
    clipboard: {
        text: '',
        timestamp: 0,
    },
}

const defaultNotificationState: NotificationState = {
    queue: [],
    isEnabled: true,
    permission: 'default',
}

const defaultSettings: AppSettings = {
    theme: 'system',
    language: 'zh-CN',
    autoStart: false,
    windowState: {
        mode: 'pet',
        position: { x: 0, y: 0 },
        size: { width: 400, height: 600 },
        isVisible: true,
        isAlwaysOnTop: true,
        isResizable: true,
        title: '紫舒老师桌面版',
    },
    notifications: {
        enabled: true,
        sound: true,
        desktop: true,
    },
    ai: {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2000,
    },
    character: {
        model: 'shizuku',
        voice: 'default',
        personality: 'friendly',
    },
}

const defaultConfig: AppConfig = {
    window: {
        width: 400,
        height: 600,
        always_on_top: true,
        transparent: true,
        decorations: false,
        resizable: true,
        position: null,
    },
    character: {
        current_character: 'shizuku' as any,
        scale: 1.0 as any,
        auto_idle: true,
        interaction_enabled: true,
    },
    theme: {
        current_theme: 'anime',
        custom_css: null,
    },
    system: {
        auto_start: false,
        minimize_to_tray: true,
        close_to_tray: true,
        show_notifications: true,
    },
}

/**
 * 生成唯一ID
 */
const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 桌面应用 Store
 */
export const useDesktopStore = create<DesktopStoreState>()(
    subscribeWithSelector(
        persist(
            immer((set, get) => ({
                // ==================== 基础状态 ====================
                appState: defaultAppState,
                operationState: defaultOperationState,
                windowState: defaultWindowState,
                shortcutState: defaultShortcutState,
                fileOperationState: defaultFileOperationState,
                notificationState: defaultNotificationState,
                settings: defaultSettings,
                config: defaultConfig,
                isInitialized: false,
                isOnline: false,
                lastSyncTime: 0,

                // ==================== 应用状态管理 ====================
                initializeApp: async () => {
                    set((state) => {
                        state.appState.isInitializing = true
                        state.isInitialized = false
                    })
                    
                    try {
                        // 模拟初始化过程
                        await new Promise(resolve => setTimeout(resolve, 1000))
                        
                        set((state) => {
                            state.appState.isInitializing = false
                            state.appState.isReady = true
                            state.isInitialized = true
                            state.lastSyncTime = Date.now()
                        })
                    } catch (error) {
                        set((state) => {
                            state.appState.isInitializing = false
                            state.operationState.error = error instanceof Error ? error.message : String(error)
                        })
                    }
                },

                setAppReady: (ready: boolean) => {
                    set((state) => {
                        state.appState.isReady = ready
                    })
                },

                setInitializing: (initializing: boolean) => {
                    set((state) => {
                        state.appState.isInitializing = initializing
                    })
                },

                updateSystemInfo: (info) => {
                    set((state) => {
                        Object.assign(state.appState.systemInfo, info)
                    })
                },

                updateAppInfo: (info) => {
                    set((state) => {
                        Object.assign(state.appState.appInfo, info)
                    })
                },

                updatePerformance: (metrics) => {
                    set((state) => {
                        Object.assign(state.appState.performance, metrics)
                        state.appState.performance.lastUpdate = Date.now()
                    })
                },

                updateConnectivity: (status) => {
                    set((state) => {
                        Object.assign(state.appState.connectivity, status)
                        state.isOnline = status.isOnline ?? state.isOnline
                    })
                },

                // ==================== 更新管理 ====================
                setUpdateAvailable: (updateInfo) => {
                    set((state) => {
                        state.appState.hasUpdate = true
                        state.appState.updateInfo = updateInfo
                    })
                },

                clearUpdate: () => {
                    set((state) => {
                        state.appState.hasUpdate = false
                        state.appState.updateInfo = undefined
                    })
                },

                setMinimizedToTray: (minimized: boolean) => {
                    set((state) => {
                        state.appState.isMinimizedToTray = minimized
                    })
                },

                // ==================== 操作管理 ====================
                setLoading: (loading: boolean) => {
                    set((state) => {
                        state.operationState.isLoading = loading
                    })
                },

                setError: (error: string | null) => {
                    set((state) => {
                        state.operationState.error = error
                    })
                },

                addOperation: (operation) => {
                    const id = generateId()
                    const timestamp = Date.now()
                    const duration = operation.success ? Math.random() * 1000 : 0 // 模拟持续时间
                    
                    set((state) => {
                        const newOperation = {
                            id,
                            timestamp,
                            duration,
                            ...operation,
                        }
                        
                        state.operationState.operationHistory.unshift(newOperation)
                        state.operationState.lastOperation = operation.operation
                        
                        // 保持最近100条记录
                        if (state.operationState.operationHistory.length > 100) {
                            state.operationState.operationHistory = state.operationState.operationHistory.slice(0, 100)
                        }
                    })
                },

                clearOperationHistory: () => {
                    set((state) => {
                        state.operationState.operationHistory = []
                        state.operationState.lastOperation = null
                    })
                },

                addToRetryQueue: (operation) => {
                    const id = generateId()
                    const timestamp = Date.now()
                    
                    set((state) => {
                        state.operationState.retryQueue.push({
                            id,
                            timestamp,
                            attempts: 0,
                            ...operation,
                        })
                    })
                },

                removeFromRetryQueue: (id: string) => {
                    set((state) => {
                        state.operationState.retryQueue = state.operationState.retryQueue.filter(
                            item => item.id !== id
                        )
                    })
                },

                clearRetryQueue: () => {
                    set((state) => {
                        state.operationState.retryQueue = []
                    })
                },

                // ==================== 窗口管理 ====================
                setWindowMode: (mode) => {
                    set((state) => {
                        state.windowState.mode = mode
                    })
                },

                setWindowPosition: (position) => {
                    set((state) => {
                        state.windowState.position = position
                    })
                },

                setWindowSize: (size) => {
                    set((state) => {
                        state.windowState.size = size
                    })
                },

                setWindowVisible: (visible: boolean) => {
                    set((state) => {
                        state.windowState.isVisible = visible
                    })
                },

                setAlwaysOnTop: (alwaysOnTop: boolean) => {
                    set((state) => {
                        state.windowState.isAlwaysOnTop = alwaysOnTop
                    })
                },

                setResizable: (resizable: boolean) => {
                    set((state) => {
                        state.windowState.isResizable = resizable
                    })
                },

                setTitle: (title: string) => {
                    set((state) => {
                        state.windowState.title = title
                    })
                },

                setOpacity: (opacity: number) => {
                    set((state) => {
                        state.windowState.opacity = Math.max(0.1, Math.min(1.0, opacity))
                    })
                },

                setZIndex: (zIndex: number) => {
                    set((state) => {
                        state.windowState.zIndex = zIndex
                    })
                },

                // ==================== 快捷键管理 ====================
                registerShortcut: (shortcut) => {
                    const id = generateId()
                    
                    set((state) => {
                        state.shortcutState.registered.push({
                            id,
                            ...shortcut,
                        })
                    })
                    
                    return id
                },

                unregisterShortcut: (id: string) => {
                    set((state) => {
                        state.shortcutState.registered = state.shortcutState.registered.filter(
                            shortcut => shortcut.id !== id
                        )
                    })
                },

                clearShortcuts: () => {
                    set((state) => {
                        state.shortcutState.registered = []
                    })
                },

                setShortcutsEnabled: (enabled: boolean) => {
                    set((state) => {
                        state.shortcutState.isEnabled = enabled
                    })
                },

                triggerShortcut: (shortcut: string) => {
                    set((state) => {
                        state.shortcutState.lastTriggered = {
                            shortcut,
                            timestamp: Date.now(),
                        }
                    })
                },

                // ==================== 文件操作管理 ====================
                addRecentFile: (file) => {
                    set((state) => {
                        const existingIndex = state.fileOperationState.recentFiles.findIndex(
                            f => f.path === file.path
                        )
                        
                        const recentFile = {
                            ...file,
                            lastAccessed: Date.now(),
                        }
                        
                        if (existingIndex >= 0) {
                            state.fileOperationState.recentFiles[existingIndex] = recentFile
                        } else {
                            state.fileOperationState.recentFiles.unshift(recentFile)
                        }
                        
                        // 保持最近20个文件
                        if (state.fileOperationState.recentFiles.length > 20) {
                            state.fileOperationState.recentFiles = state.fileOperationState.recentFiles.slice(0, 20)
                        }
                    })
                },

                removeRecentFile: (path: string) => {
                    set((state) => {
                        state.fileOperationState.recentFiles = state.fileOperationState.recentFiles.filter(
                            file => file.path !== path
                        )
                    })
                },

                clearRecentFiles: () => {
                    set((state) => {
                        state.fileOperationState.recentFiles = []
                    })
                },

                openFile: (file) => {
                    set((state) => {
                        const existingIndex = state.fileOperationState.openFiles.findIndex(
                            f => f.path === file.path
                        )
                        
                        const openFile = {
                            ...file,
                            lastModified: Date.now(),
                        }
                        
                        if (existingIndex >= 0) {
                            state.fileOperationState.openFiles[existingIndex] = openFile
                        } else {
                            state.fileOperationState.openFiles.push(openFile)
                        }
                    })
                },

                closeFile: (path: string) => {
                    set((state) => {
                        state.fileOperationState.openFiles = state.fileOperationState.openFiles.filter(
                            file => file.path !== path
                        )
                    })
                },

                updateFileContent: (path: string, content: string) => {
                    set((state) => {
                        const file = state.fileOperationState.openFiles.find(f => f.path === path)
                        if (file) {
                            file.content = content
                            file.isModified = true
                            file.lastModified = Date.now()
                        }
                    })
                },

                setFileModified: (path: string, modified: boolean) => {
                    set((state) => {
                        const file = state.fileOperationState.openFiles.find(f => f.path === path)
                        if (file) {
                            file.isModified = modified
                        }
                    })
                },

                setClipboard: (text: string) => {
                    set((state) => {
                        state.fileOperationState.clipboard = {
                            text,
                            timestamp: Date.now(),
                        }
                    })
                },

                // ==================== 通知管理 ====================
                addNotification: (notification) => {
                    const id = generateId()
                    const timestamp = Date.now()
                    
                    set((state) => {
                        state.notificationState.queue.unshift({
                            id,
                            timestamp,
                            read: false,
                            ...notification,
                        })
                        
                        // 保持最近50条通知
                        if (state.notificationState.queue.length > 50) {
                            state.notificationState.queue = state.notificationState.queue.slice(0, 50)
                        }
                    })
                    
                    return id
                },

                removeNotification: (id: string) => {
                    set((state) => {
                        state.notificationState.queue = state.notificationState.queue.filter(
                            notification => notification.id !== id
                        )
                    })
                },

                markNotificationRead: (id: string) => {
                    set((state) => {
                        const notification = state.notificationState.queue.find(n => n.id === id)
                        if (notification) {
                            notification.read = true
                        }
                    })
                },

                clearNotifications: () => {
                    set((state) => {
                        state.notificationState.queue = []
                    })
                },

                setNotificationEnabled: (enabled: boolean) => {
                    set((state) => {
                        state.notificationState.isEnabled = enabled
                    })
                },

                setNotificationPermission: (permission) => {
                    set((state) => {
                        state.notificationState.permission = permission
                    })
                },

                // ==================== 设置管理 ====================
                updateSettings: (settings) => {
                    set((state) => {
                        Object.assign(state.settings, settings)
                    })
                },

                updateConfig: (config) => {
                    set((state) => {
                        Object.assign(state.config, config)
                    })
                },

                resetSettings: () => {
                    set((state) => {
                        state.settings = defaultSettings
                    })
                },

                resetConfig: () => {
                    set((state) => {
                        state.config = defaultConfig
                    })
                },

                // ==================== 工具方法 ====================
                clearAllErrors: () => {
                    set((state) => {
                        state.operationState.error = null
                        state.operationState.retryQueue = []
                    })
                },

                resetAll: () => {
                    set((state) => {
                        state.appState = defaultAppState
                        state.operationState = defaultOperationState
                        state.windowState = defaultWindowState
                        state.shortcutState = defaultShortcutState
                        state.fileOperationState = defaultFileOperationState
                        state.notificationState = defaultNotificationState
                        state.settings = defaultSettings
                        state.config = defaultConfig
                        state.isInitialized = false
                        state.isOnline = false
                        state.lastSyncTime = 0
                    })
                },

                exportState: () => {
                    const state = get()
                    return JSON.stringify({
                        appState: state.appState,
                        windowState: state.windowState,
                        settings: state.settings,
                        config: state.config,
                        exportTime: Date.now(),
                        version: '1.0.0',
                    }, null, 2)
                },

                importState: (stateJson: string) => {
                    try {
                        const importedState = JSON.parse(stateJson)
                        
                        set((state) => {
                            if (importedState.appState) {
                                Object.assign(state.appState, importedState.appState)
                            }
                            if (importedState.windowState) {
                                Object.assign(state.windowState, importedState.windowState)
                            }
                            if (importedState.settings) {
                                Object.assign(state.settings, importedState.settings)
                            }
                            if (importedState.config) {
                                Object.assign(state.config, importedState.config)
                            }
                        })
                    } catch (error) {
                        console.error('Failed to import state:', error)
                        throw new Error('Invalid state format')
                    }
                },

                getStateSnapshot: () => {
                    return get()
                },

                restoreStateSnapshot: (snapshot) => {
                    set((state) => {
                        Object.assign(state, snapshot)
                    })
                },
            })),
            {
                name: 'desktop-store',
                partialize: (state) => ({
                    appState: state.appState,
                    windowState: state.windowState,
                    settings: state.settings,
                    config: state.config,
                    fileOperationState: {
                        recentFiles: state.fileOperationState.recentFiles,
                        clipboard: state.fileOperationState.clipboard,
                    },
                    notificationState: {
                        isEnabled: state.notificationState.isEnabled,
                        permission: state.notificationState.permission,
                    },
                }),
            }
        )
    )
)

/**
 * 桌面应用 Store Hook
 * 
 * 提供便捷的访问方式，支持选择器优化
 */
export const useDesktopStoreSelector = <T>(selector: (state: DesktopStoreState) => T) => {
    return useDesktopStore(selector)
}

/**
 * 桌面应用状态选择器
 */
export const desktopSelectors = {
    // 基础状态
    appState: (state: DesktopStoreState) => state.appState,
    operationState: (state: DesktopStoreState) => state.operationState,
    windowState: (state: DesktopStoreState) => state.windowState,
    shortcutState: (state: DesktopStoreState) => state.shortcutState,
    fileOperationState: (state: DesktopStoreState) => state.fileOperationState,
    notificationState: (state: DesktopStoreState) => state.notificationState,
    
    // 计算属性
    isReady: (state: DesktopStoreState) => state.appState.isReady && state.isInitialized,
    isLoading: (state: DesktopStoreState) => state.operationState.isLoading || state.appState.isInitializing,
    hasError: (state: DesktopStoreState) => !!state.operationState.error,
    hasUnreadNotifications: (state: DesktopStoreState) => 
        state.notificationState.queue.some(n => !n.read),
    recentOperations: (state: DesktopStoreState) => 
        state.operationState.operationHistory.slice(0, 10),
    retryQueueCount: (state: DesktopStoreState) => 
        state.operationState.retryQueue.length,
    
    // 设置
    settings: (state: DesktopStoreState) => state.settings,
    config: (state: DesktopStoreState) => state.config,
}

/**
 * 桌面应用事件类型
 */
export type DesktopEvent = 
    | { type: 'APP_INITIALIZED'; payload: { timestamp: number } }
    | { type: 'APP_ERROR'; payload: { error: string; timestamp: number } }
    | { type: 'WINDOW_STATE_CHANGED'; payload: WindowState }
    | { type: 'OPERATION_COMPLETED'; payload: { operation: string; success: boolean; duration: number } }
    | { type: 'NOTIFICATION_ADDED'; payload: { id: string; title: string } }
    | { type: 'FILE_OPENED'; payload: { path: string; name: string } }
    | { type: 'SHORTCUT_TRIGGERED'; payload: { shortcut: string; timestamp: number } }
    | { type: 'PERFORMANCE_UPDATED'; payload: DesktopAppState['performance'] }
    | { type: 'CONNECTIVITY_CHANGED'; payload: { isOnline: boolean; latency: number } }

/**
 * 桌面应用事件监听器
 */
export const useDesktopEvent = (eventType: DesktopEvent['type'], callback: (event: DesktopEvent) => void) => {
    const unsubscribe = useDesktopStore.subscribe(
        (state) => state,
        (state, prevState) => {
            // 这里可以根据状态变化触发相应的事件
            // 简化实现，实际项目中可能需要更复杂的事件系统
        }
    )
    
    return unsubscribe
}

/**
 * 桌面应用 Store 工具函数
 */
export const desktopStoreUtils = {
    /**
     * 创建操作记录
     */
    createOperation: (operation: string, success: boolean, error?: string, metadata?: Record<string, any>) => ({
        operation,
        success,
        error,
        metadata,
    }),
    
    /**
     * 创建通知
     */
    createNotification: (title: string, body?: string, icon?: string, actions?: Array<{ label: string; action: string }>) => ({
        title,
        body,
        icon,
        actions,
    }),
    
    /**
     * 创建快捷键
     */
    createShortcut: (key: string, callback: () => void, options?: {
        ctrl?: boolean
        alt?: boolean
        shift?: boolean
        global?: boolean
        description?: string
    }) => ({
        key,
        callback,
        global: true,
        description: options?.description || `快捷键: ${key}`,
        ...options,
    }),
    
    /**
     * 验证状态
     */
    validateState: (state: Partial<DesktopStoreState>): boolean => {
        try {
            // 基本验证逻辑
            if (state.appState && typeof state.appState.isReady !== 'boolean') return false
            if (state.windowState && typeof state.windowState.mode !== 'string') return false
            return true
        } catch {
            return false
        }
    },
}
