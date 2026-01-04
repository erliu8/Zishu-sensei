/**
 * 设置状态管理 Store
 * 
 * 使用 Zustand 管理应用设置相关的所有状态，包括：
 * - 前端应用设置（AppSettings）
 * - 后端配置设置（AppConfig）
 * - 设置同步和持久化
 * - 配置验证和错误处理
 * - 导入/导出功能
 * - 事件监听
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { produce } from 'immer'
import type { AppSettings, ThemeMode, WindowState } from '@/types/app'
import type {
    AppConfig,
    WindowConfig,
    CharacterConfig,
    ThemeConfig,
    SystemConfig,
    PartialConfigUpdate,
    ConfigChangeEvent,
    ConfigValidationResult
} from '@/types/settings'
import { DEFAULT_CONFIG } from '@/types/settings'
import { settingsStorage } from '@/services/storage/settings'

// ==================== 类型定义 ====================

/**
 * 设置同步状态
 */
export enum SyncStatus {
    /** 空闲 */
    IDLE = 'idle',
    /** 同步中 */
    SYNCING = 'syncing',
    /** 同步成功 */
    SUCCESS = 'success',
    /** 同步失败 */
    FAILED = 'failed'
}

/**
 * 设置变更历史记录
 */
export interface SettingsHistoryEntry {
    /** 记录ID */
    id: string
    /** 变更类型 */
    type: 'appSettings' | 'appConfig' | 'window' | 'character' | 'theme' | 'system'
    /** 变更前的值 */
    before: any
    /** 变更后的值 */
    after: any
    /** 时间戳 */
    timestamp: number
    /** 描述 */
    description?: string
}

/**
 * 设置事件类型
 */
export type SettingsEvent =
    | { type: 'settings:loaded'; payload: { appSettings: AppSettings; appConfig: AppConfig } }
    | { type: 'settings:updated'; payload: { updates: Partial<AppSettings> } }
    | { type: 'settings:reset'; payload: { reason: string } }
    | { type: 'settings:exported'; payload: { path: string } }
    | { type: 'settings:imported'; payload: { path: string } }
    | { type: 'settings:sync'; payload: { status: SyncStatus; error?: string } }
    | { type: 'settings:error'; payload: { error: Error; context: any } }

/**
 * 设置事件监听器
 */
export type SettingsEventListener = (event: SettingsEvent) => void

/**
 * 设置 Store 状态
 */
export interface SettingsStore {
    // ==================== 基础状态 ====================
    /** 前端应用设置 */
    appSettings: AppSettings
    /** 后端配置设置 */
    appConfig: AppConfig
    /** 是否正在加载 */
    isLoading: boolean
    /** 是否已初始化 */
    isInitialized: boolean
    /** 同步状态 */
    syncStatus: SyncStatus
    /** 错误信息 */
    error: Error | null
    /** 最后同步时间 */
    lastSyncTime: number | null
    /** 变更历史 */
    history: SettingsHistoryEntry[]
    /** 事件监听器 */
    eventListeners: SettingsEventListener[]

    // ==================== 计算属性 ====================
    /** 获取当前主题 */
    getCurrentTheme: () => ThemeMode
    /** 获取当前语言 */
    getCurrentLanguage: () => string
    /** 检查是否需要同步 */
    needsSync: () => boolean
    /** 获取窗口配置 */
    getWindowConfig: () => WindowConfig
    /** 获取角色配置 */
    getCharacterConfig: () => CharacterConfig
    /** 获取主题配置 */
    getThemeConfig: () => ThemeConfig
    /** 获取系统配置 */
    getSystemConfig: () => SystemConfig

    // ==================== 初始化 ====================
    /** 初始化设置 */
    initialize: () => Promise<void>
    /** 加载设置 */
    loadSettings: () => Promise<void>
    /** 刷新配置 */
    refreshConfig: () => Promise<void>

    // ==================== 应用设置管理 ====================
    /** 更新应用设置 */
    updateAppSettings: (updates: Partial<AppSettings>) => Promise<void>
    /** 更新窗口状态 */
    updateWindowState: (updates: Partial<WindowState>) => Promise<void>
    /** 更新主题 */
    updateTheme: (theme: ThemeMode) => Promise<void>
    /** 更新语言 */
    updateLanguage: (language: string) => Promise<void>
    /** 切换自动启动 */
    toggleAutoStart: () => Promise<void>
    /** 更新通知设置 */
    updateNotifications: (updates: Partial<AppSettings['notifications']>) => Promise<void>
    /** 更新 AI 设置 */
    updateAISettings: (updates: Partial<AppSettings['ai']>) => Promise<void>
    /** 更新角色设置 */
    updateCharacterSettings: (updates: Partial<AppSettings['character']>) => Promise<void>

    // ==================== 后端配置管理 ====================
    /** 更新完整配置 */
    updateConfig: (config: AppConfig) => Promise<void>
    /** 部分更新配置 */
    updatePartialConfig: (updates: PartialConfigUpdate) => Promise<void>
    /** 更新窗口配置 */
    updateWindowConfig: (updates: Partial<WindowConfig>) => Promise<void>
    /** 更新角色配置 */
    updateCharacterConfig: (updates: Partial<CharacterConfig>) => Promise<void>
    /** 更新主题配置 */
    updateThemeConfig: (updates: Partial<ThemeConfig>) => Promise<void>
    /** 更新系统配置 */
    updateSystemConfig: (updates: Partial<SystemConfig>) => Promise<void>

    // ==================== 配置管理 ====================
    /** 重置所有设置 */
    resetAllSettings: () => Promise<void>
    /** 重置应用设置 */
    resetAppSettings: () => Promise<void>
    /** 重置后端配置 */
    resetAppConfig: () => Promise<void>
    /** 导出设置 */
    exportSettings: (filePath?: string) => Promise<string>
    /** 导入设置 */
    importSettings: (data: string | { filePath: string }) => Promise<void>

    // ==================== 验证 ====================
    /** 验证应用设置 */
    validateAppSettings: (settings: Partial<AppSettings>) => { valid: boolean; errors: string[] }
    /** 验证配置 */
    validateConfig: (config: AppConfig) => ConfigValidationResult

    // ==================== 同步 ====================
    /** 同步设置到后端 */
    syncToBackend: () => Promise<void>
    /** 从后端同步设置 */
    syncFromBackend: () => Promise<void>
    /** 强制同步 */
    forceSync: () => Promise<void>

    // ==================== 历史管理 ====================
    /** 添加历史记录 */
    addHistory: (entry: Omit<SettingsHistoryEntry, 'id' | 'timestamp'>) => void
    /** 清空历史记录 */
    clearHistory: () => void
    /** 获取历史记录 */
    getHistory: (limit?: number) => SettingsHistoryEntry[]

    // ==================== 事件系统 ====================
    /** 添加事件监听器 */
    addEventListener: (listener: SettingsEventListener) => () => void
    /** 移除事件监听器 */
    removeEventListener: (listener: SettingsEventListener) => void
    /** 触发事件 */
    emitEvent: (event: SettingsEvent) => void

    // ==================== 工具方法 ====================
    /** 清除错误 */
    clearError: () => void
    /** 重置 Store */
    reset: () => void
}

// ==================== 默认值 ====================

/**
 * 默认应用设置
 */
const DEFAULT_APP_SETTINGS: AppSettings = {
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
        model: 'hiyori',
        voice: 'female',
        personality: 'friendly',
    },
}

// ==================== 辅助函数 ====================

/**
 * 生成历史记录 ID
 */
const generateHistoryId = () => `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

/**
 * 深度合并对象
 */
const deepMerge = <T extends Record<string, any>>(target: T, source: Partial<T>): T => {
    return produce(target, (draft: any) => {
        Object.keys(source).forEach(key => {
            const sourceValue = (source as any)[key]
            if (sourceValue !== undefined) {
                if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue)) {
                    draft[key] = deepMerge(draft[key] || {}, sourceValue)
                } else {
                    draft[key] = sourceValue
                }
            }
        })
    })
}

// ==================== Store 实现 ====================

/**
 * 设置状态管理 Store
 */
export const useSettingsStore = create<SettingsStore>()(
    devtools(
        persist(
            subscribeWithSelector((set, get) => ({
                // ==================== 初始状态 ====================
                appSettings: DEFAULT_APP_SETTINGS,
                appConfig: DEFAULT_CONFIG,
                isLoading: false,
                isInitialized: false,
                syncStatus: SyncStatus.IDLE,
                error: null,
                lastSyncTime: null,
                history: [],
                eventListeners: [],

                // ==================== 计算属性 ====================
                getCurrentTheme: () => get().appSettings.theme,

                getCurrentLanguage: () => get().appSettings.language,

                needsSync: () => {
                    const { lastSyncTime } = get()
                    if (!lastSyncTime) return true
                    // 如果超过5分钟未同步，则需要同步
                    return Date.now() - lastSyncTime > 5 * 60 * 1000
                },

                getWindowConfig: () => get().appConfig.window,

                getCharacterConfig: () => get().appConfig.character,

                getThemeConfig: () => get().appConfig.theme,

                getSystemConfig: () => get().appConfig.system,

                // ==================== 初始化 ====================
                initialize: async () => {
                    const state = get()
                    if (state.isInitialized) return

                    set({ isLoading: true, error: null })

                    try {
                        await settingsStorage.initialize()
                        await get().loadSettings()

                        // 添加配置变更监听器
                        settingsStorage.addChangeListener((event: ConfigChangeEvent) => {
                            set({ appConfig: event.after as AppConfig })

                            get().emitEvent({
                                type: 'settings:sync',
                                payload: { status: SyncStatus.SUCCESS }
                            })
                        })

                        set({ isInitialized: true, isLoading: false })

                        get().emitEvent({
                            type: 'settings:loaded',
                            payload: {
                                appSettings: get().appSettings,
                                appConfig: get().appConfig
                            }
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        console.error('设置初始化失败:', err)
                        set({ error: err, isLoading: false })

                        get().emitEvent({
                            type: 'settings:error',
                            payload: { error: err, context: 'initialize' }
                        })
                    }
                },

                loadSettings: async () => {
                    set({ isLoading: true, error: null })

                    try {
                        // 加载后端配置
                        const backendConfig = await settingsStorage.getConfig()

                        // 从 localStorage 加载前端设置
                        const storedSettings = localStorage.getItem('app-settings')
                        const appSettings = storedSettings
                            ? deepMerge(DEFAULT_APP_SETTINGS, JSON.parse(storedSettings))
                            : DEFAULT_APP_SETTINGS

                        set({
                            appSettings,
                            appConfig: backendConfig,
                            isLoading: false,
                            lastSyncTime: Date.now()
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        console.error('加载设置失败:', err)
                        set({ error: err, isLoading: false })
                        throw err
                    }
                },

                refreshConfig: async () => {
                    set({ isLoading: true, error: null })

                    try {
                        const config = await settingsStorage.refreshConfig()
                        set({
                            appConfig: config,
                            isLoading: false,
                            lastSyncTime: Date.now()
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        console.error('刷新配置失败:', err)
                        set({ error: err, isLoading: false })
                        throw err
                    }
                },

                // ==================== 应用设置管理 ====================
                updateAppSettings: async (updates) => {
                    const oldSettings = get().appSettings

                    try {
                        const newSettings = deepMerge(oldSettings, updates)

                        // 验证设置
                        const validation = get().validateAppSettings(newSettings)
                        if (!validation.valid) {
                            throw new Error(`设置验证失败: ${validation.errors.join(', ')}`)
                        }

                        // 保存到 localStorage
                        localStorage.setItem('app-settings', JSON.stringify(newSettings))

                        set({ appSettings: newSettings })

                        // 添加历史记录
                        get().addHistory({
                            type: 'appSettings',
                            before: oldSettings,
                            after: newSettings,
                            description: '更新应用设置'
                        })

                        get().emitEvent({
                            type: 'settings:updated',
                            payload: { updates }
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        get().emitEvent({
                            type: 'settings:error',
                            payload: { error: err, context: 'updateAppSettings' }
                        })
                        throw err
                    }
                },

                updateWindowState: async (updates) => {
                    await get().updateAppSettings({
                        windowState: {
                            ...get().appSettings.windowState,
                            ...updates
                        }
                    })
                },

                updateTheme: async (theme) => {
                    await get().updateAppSettings({ theme })
                },

                updateLanguage: async (language) => {
                    await get().updateAppSettings({ language })
                },

                toggleAutoStart: async () => {
                    const currentAutoStart = get().appSettings.autoStart
                    await get().updateAppSettings({ autoStart: !currentAutoStart })

                    // 同时更新后端配置
                    await get().updateSystemConfig({ auto_start: !currentAutoStart })
                },

                updateNotifications: async (updates) => {
                    await get().updateAppSettings({
                        notifications: {
                            ...get().appSettings.notifications,
                            ...updates
                        }
                    })
                },

                updateAISettings: async (updates) => {
                    await get().updateAppSettings({
                        ai: {
                            ...get().appSettings.ai,
                            ...updates
                        }
                    })
                },

                updateCharacterSettings: async (updates) => {
                    await get().updateAppSettings({
                        character: {
                            ...get().appSettings.character,
                            ...updates
                        }
                    })
                },

                // ==================== 后端配置管理 ====================
                updateConfig: async (config) => {
                    const oldConfig = get().appConfig

                    try {
                        set({ syncStatus: SyncStatus.SYNCING })

                        const updatedConfig = await settingsStorage.updateConfig(config)

                        set({
                            appConfig: updatedConfig,
                            syncStatus: SyncStatus.SUCCESS,
                            lastSyncTime: Date.now()
                        })

                        get().addHistory({
                            type: 'appConfig',
                            before: oldConfig,
                            after: updatedConfig,
                            description: '更新完整配置'
                        })

                        get().emitEvent({
                            type: 'settings:sync',
                            payload: { status: SyncStatus.SUCCESS }
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err, syncStatus: SyncStatus.FAILED })
                        get().emitEvent({
                            type: 'settings:error',
                            payload: { error: err, context: 'updateConfig' }
                        })
                        throw err
                    }
                },

                updatePartialConfig: async (updates) => {
                    const oldConfig = get().appConfig

                    try {
                        set({ syncStatus: SyncStatus.SYNCING })

                        const updatedConfig = await settingsStorage.updatePartialConfig(updates)

                        set({
                            appConfig: updatedConfig,
                            syncStatus: SyncStatus.SUCCESS,
                            lastSyncTime: Date.now()
                        })

                        get().addHistory({
                            type: 'appConfig',
                            before: oldConfig,
                            after: updatedConfig,
                            description: '部分更新配置'
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err, syncStatus: SyncStatus.FAILED })
                        throw err
                    }
                },

                updateWindowConfig: async (updates) => {
                    const oldConfig = get().appConfig.window

                    try {
                        const updatedConfig = await settingsStorage.updateWindowConfig(updates as any)

                        set({
                            appConfig: {
                                ...get().appConfig,
                                window: updatedConfig
                            },
                            lastSyncTime: Date.now()
                        })

                        get().addHistory({
                            type: 'window',
                            before: oldConfig,
                            after: updatedConfig,
                            description: '更新窗口配置'
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        throw err
                    }
                },

                updateCharacterConfig: async (updates) => {
                    const oldConfig = get().appConfig.character

                    try {
                        const updatedConfig = await settingsStorage.updateCharacterConfig(updates)

                        set({
                            appConfig: {
                                ...get().appConfig,
                                character: updatedConfig
                            },
                            lastSyncTime: Date.now()
                        })

                        get().addHistory({
                            type: 'character',
                            before: oldConfig,
                            after: updatedConfig,
                            description: '更新角色配置'
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        throw err
                    }
                },

                updateThemeConfig: async (updates) => {
                    const oldConfig = get().appConfig.theme

                    try {
                        const updatedConfig = await settingsStorage.updateThemeConfig(updates as any)

                        set({
                            appConfig: {
                                ...get().appConfig,
                                theme: updatedConfig
                            },
                            lastSyncTime: Date.now()
                        })

                        get().addHistory({
                            type: 'theme',
                            before: oldConfig,
                            after: updatedConfig,
                            description: '更新主题配置'
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        throw err
                    }
                },

                updateSystemConfig: async (updates) => {
                    const oldConfig = get().appConfig.system

                    try {
                        const updatedConfig = await settingsStorage.updateSystemConfig(updates)

                        set({
                            appConfig: {
                                ...get().appConfig,
                                system: updatedConfig
                            },
                            lastSyncTime: Date.now()
                        })

                        get().addHistory({
                            type: 'system',
                            before: oldConfig,
                            after: updatedConfig,
                            description: '更新系统配置'
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        throw err
                    }
                },

                // ==================== 配置管理 ====================
                resetAllSettings: async () => {
                    try {
                        await get().resetAppSettings()
                        await get().resetAppConfig()

                        get().emitEvent({
                            type: 'settings:reset',
                            payload: { reason: 'user_requested' }
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        throw err
                    }
                },

                resetAppSettings: async () => {
                    const oldSettings = get().appSettings

                    localStorage.setItem('app-settings', JSON.stringify(DEFAULT_APP_SETTINGS))
                    set({ appSettings: DEFAULT_APP_SETTINGS })

                    get().addHistory({
                        type: 'appSettings',
                        before: oldSettings,
                        after: DEFAULT_APP_SETTINGS,
                        description: '重置应用设置'
                    })
                },

                resetAppConfig: async () => {
                    try {
                        const resetConfig = await settingsStorage.resetConfig()
                        set({ appConfig: resetConfig, lastSyncTime: Date.now() })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        throw err
                    }
                },

                exportSettings: async (filePath) => {
                    try {
                        const exportData = {
                            version: '1.0.0',
                            timestamp: Date.now(),
                            appSettings: get().appSettings,
                            appConfig: get().appConfig
                        }

                        const jsonData = JSON.stringify(exportData, null, 2)

                        if (filePath) {
                            await settingsStorage.exportConfig(filePath)
                            get().emitEvent({
                                type: 'settings:exported',
                                payload: { path: filePath }
                            })
                        }

                        return jsonData
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        throw err
                    }
                },

                importSettings: async (data) => {
                    try {
                        let importData: any

                        if (typeof data === 'string') {
                            importData = JSON.parse(data)
                        } else {
                            await settingsStorage.importConfig(data.filePath)
                            await get().loadSettings()
                            get().emitEvent({
                                type: 'settings:imported',
                                payload: { path: data.filePath }
                            })
                            return
                        }

                        // 验证导入数据
                        if (!importData.appSettings && !importData.appConfig) {
                            throw new Error('无效的导入数据格式')
                        }

                        // 导入前端设置
                        if (importData.appSettings) {
                            const mergedSettings = deepMerge(DEFAULT_APP_SETTINGS, importData.appSettings)
                            await get().updateAppSettings(mergedSettings)
                        }

                        // 导入后端配置
                        if (importData.appConfig) {
                            await get().updateConfig(importData.appConfig)
                        }

                        get().emitEvent({
                            type: 'settings:imported',
                            payload: { path: 'json_string' }
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        throw err
                    }
                },

                // ==================== 验证 ====================
                validateAppSettings: (settings) => {
                    const errors: string[] = []

                    // 验证主题
                    if (settings.theme && !['light', 'dark', 'system'].includes(settings.theme)) {
                        errors.push('无效的主题值')
                    }

                    // 验证语言
                    if (settings.language && typeof settings.language !== 'string') {
                        errors.push('无效的语言值')
                    }

                    // 验证窗口状态
                    if (settings.windowState) {
                        if (settings.windowState.size) {
                            if (settings.windowState.size.width < 200 || settings.windowState.size.width > 4000) {
                                errors.push('窗口宽度必须在 200-4000 之间')
                            }
                            if (settings.windowState.size.height < 200 || settings.windowState.size.height > 4000) {
                                errors.push('窗口高度必须在 200-4000 之间')
                            }
                        }
                    }

                    // 验证 AI 设置
                    if (settings.ai) {
                        if (settings.ai.temperature !== undefined) {
                            if (settings.ai.temperature < 0 || settings.ai.temperature > 2) {
                                errors.push('AI 温度必须在 0-2 之间')
                            }
                        }
                        if (settings.ai.maxTokens !== undefined) {
                            if (settings.ai.maxTokens < 1 || settings.ai.maxTokens > 32000) {
                                errors.push('最大 Token 数必须在 1-32000 之间')
                            }
                        }
                    }

                    return {
                        valid: errors.length === 0,
                        errors
                    }
                },

                validateConfig: (config) => {
                    return settingsStorage.validateConfig(config)
                },

                // ==================== 同步 ====================
                syncToBackend: async () => {
                    // 从前端设置同步到后端配置
                    try {
                        set({ syncStatus: SyncStatus.SYNCING })

                        const { appSettings } = get()

                        // 构建部分更新
                        const updates: PartialConfigUpdate = {
                            system: {
                                auto_start: appSettings.autoStart,
                                show_notifications: appSettings.notifications.enabled
                            }
                        }

                        await get().updatePartialConfig(updates)

                        set({ syncStatus: SyncStatus.SUCCESS, lastSyncTime: Date.now() })

                        get().emitEvent({
                            type: 'settings:sync',
                            payload: { status: SyncStatus.SUCCESS }
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err, syncStatus: SyncStatus.FAILED })
                        get().emitEvent({
                            type: 'settings:sync',
                            payload: { status: SyncStatus.FAILED, error: err.message }
                        })
                        throw err
                    }
                },

                syncFromBackend: async () => {
                    await get().refreshConfig()
                },

                forceSync: async () => {
                    try {
                        await get().syncToBackend()
                        await get().syncFromBackend()
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        throw err
                    }
                },

                // ==================== 历史管理 ====================
                addHistory: (entry) => {
                    const historyEntry: SettingsHistoryEntry = {
                        ...entry,
                        id: generateHistoryId(),
                        timestamp: Date.now()
                    }

                    set((state) => {
                        const newHistory = [...state.history, historyEntry]
                        // 限制历史记录数量为 50
                        if (newHistory.length > 50) {
                            newHistory.shift()
                        }
                        return { history: newHistory }
                    })
                },

                clearHistory: () => {
                    set({ history: [] })
                },

                getHistory: (limit) => {
                    const history = get().history
                    if (limit) {
                        return history.slice(-limit)
                    }
                    return [...history]
                },

                // ==================== 事件系统 ====================
                addEventListener: (listener) => {
                    set((state) => ({
                        eventListeners: [...state.eventListeners, listener]
                    }))

                    return () => {
                        get().removeEventListener(listener)
                    }
                },

                removeEventListener: (listener) => {
                    set((state) => ({
                        eventListeners: state.eventListeners.filter(l => l !== listener)
                    }))
                },

                emitEvent: (event) => {
                    const listeners = get().eventListeners
                    for (const listener of listeners) {
                        try {
                            listener(event)
                        } catch (error) {
                            console.error('设置事件监听器执行失败:', error)
                        }
                    }
                },

                // ==================== 工具方法 ====================
                clearError: () => {
                    set({ error: null })
                },

                reset: () => {
                    set({
                        appSettings: DEFAULT_APP_SETTINGS,
                        appConfig: DEFAULT_CONFIG,
                        isLoading: false,
                        isInitialized: false,
                        syncStatus: SyncStatus.IDLE,
                        error: null,
                        lastSyncTime: null,
                        history: [],
                        eventListeners: []
                    })
                }
            })),
            {
                name: 'settings-store',
                // 只持久化必要的数据
                partialize: (state) => ({
                    appSettings: state.appSettings,
                    history: state.history.slice(-20) // 只保存最近 20 条历史
                })
            }
        ),
        {
            name: 'SettingsStore',
            enabled: process.env.NODE_ENV === 'development'
        }
    )
)

// ==================== 导出辅助 Hooks ====================

/**
 * 获取应用设置的 Hook
 */
export const useAppSettings = () => {
    return useSettingsStore((state) => ({
        settings: state.appSettings,
        updateSettings: state.updateAppSettings,
        resetSettings: state.resetAppSettings
    }))
}

/**
 * 获取后端配置的 Hook
 */
export const useAppConfig = () => {
    return useSettingsStore((state) => ({
        config: state.appConfig,
        updateConfig: state.updateConfig,
        resetConfig: state.resetAppConfig
    }))
}

/**
 * 获取主题的 Hook
 */
export const useTheme = () => {
    return useSettingsStore((state) => ({
        theme: state.getCurrentTheme(),
        updateTheme: state.updateTheme,
        themeConfig: state.getThemeConfig(),
        updateThemeConfig: state.updateThemeConfig
    }))
}

/**
 * 获取窗口配置的 Hook
 */
export const useWindow = () => {
    return useSettingsStore((state) => ({
        windowState: state.appSettings.windowState,
        windowConfig: state.getWindowConfig(),
        updateWindowState: state.updateWindowState,
        updateWindowConfig: state.updateWindowConfig
    }))
}

/**
 * 获取设置状态的 Hook
 */
export const useSettingsStatus = () => {
    return useSettingsStore((state) => ({
        isLoading: state.isLoading,
        isInitialized: state.isInitialized,
        syncStatus: state.syncStatus,
        error: state.error,
        needsSync: state.needsSync(),
        clearError: state.clearError
    }))
}

/**
 * 获取设置操作方法的 Hook
 */
export const useSettingsActions = () => {
    return useSettingsStore((state) => ({
        initialize: state.initialize,
        loadSettings: state.loadSettings,
        exportSettings: state.exportSettings,
        importSettings: state.importSettings,
        resetAllSettings: state.resetAllSettings,
        syncToBackend: state.syncToBackend,
        syncFromBackend: state.syncFromBackend,
        forceSync: state.forceSync
    }))
}

/**
 * 获取设置历史的 Hook
 */
export const useSettingsHistory = () => {
    return useSettingsStore((state) => ({
        history: state.history,
        getHistory: state.getHistory,
        clearHistory: state.clearHistory
    }))
}

export default useSettingsStore

