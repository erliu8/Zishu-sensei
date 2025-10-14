/**
 * 设置管理 Hook (高级版)
 * 
 * 提供完整的设置管理功能，整合了：
 * - Zustand Store（主要状态管理）
 * - Tauri 后端（持久化存储）
 * - localStorage（浏览器备份）
 * - 实时同步和事件监听
 */

import type { AppSettings, ThemeMode } from '@/types/app'
import type { AppConfig, PartialConfigUpdate } from '@/types/settings'
import { useCallback, useEffect, useState, useRef } from 'react'
import { useSettingsStore, type SettingsEvent, SyncStatus } from '@/stores/settingsStore'
import { useTauri } from './useTauri'

/**
 * 设置管理器 Hook 返回值
 */
export interface UseSettingsReturn {
    // ==================== 基础状态 ====================
    /** 前端应用设置 */
    settings: AppSettings
    /** 后端配置设置 */
    config: AppConfig
    /** 是否正在加载 */
    isLoading: boolean
    /** 是否已初始化 */
    isInitialized: boolean
    /** 同步状态 */
    syncStatus: SyncStatus
    /** 错误信息 */
    error: Error | null
    /** 是否需要同步 */
    needsSync: boolean

    // ==================== 应用设置操作 ====================
    /** 更新应用设置 */
    updateSettings: (updates: Partial<AppSettings>) => Promise<void>
    /** 重置应用设置 */
    resetSettings: () => Promise<void>
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

    // ==================== 配置操作 ====================
    /** 更新后端配置 */
    updateConfig: (config: AppConfig) => Promise<void>
    /** 部分更新配置 */
    updatePartialConfig: (updates: PartialConfigUpdate) => Promise<void>
    /** 重置后端配置 */
    resetConfig: () => Promise<void>

    // ==================== 导入导出 ====================
    /** 导出设置（JSON 字符串） */
    exportSettings: () => Promise<string>
    /** 导出设置到文件 */
    exportSettingsToFile: (filePath: string) => Promise<void>
    /** 从 JSON 导入设置 */
    importSettings: (settingsJson: string) => Promise<void>
    /** 从文件导入设置 */
    importSettingsFromFile: (filePath: string) => Promise<void>

    // ==================== 同步操作 ====================
    /** 同步到后端 */
    syncToBackend: () => Promise<void>
    /** 从后端同步 */
    syncFromBackend: () => Promise<void>
    /** 强制同步 */
    forceSync: () => Promise<void>
    /** 刷新配置 */
    refreshConfig: () => Promise<void>

    // ==================== 工具方法 ====================
    /** 清除错误 */
    clearError: () => void
    /** 重置所有设置 */
    resetAll: () => Promise<void>
    /** 添加事件监听器 */
    addEventListener: (listener: (event: SettingsEvent) => void) => () => void
}

/**
 * 设置管理 Hook (高级版)
 * 
 * 使用示例：
 * ```tsx
 * const {
 *   settings,
 *   config,
 *   updateSettings,
 *   updateTheme,
 *   isLoading,
 *   error
 * } = useSettings()
 * 
 * // 更新主题
 * await updateTheme('dark')
 * 
 * // 更新设置
 * await updateSettings({
 *   language: 'en-US',
 *   notifications: { enabled: false }
 * })
 * 
 * // 监听设置变更
 * useEffect(() => {
 *   const unsubscribe = addEventListener((event) => {
 *     console.log('设置已更新:', event)
 *   })
 *   return unsubscribe
 * }, [addEventListener])
 * ```
 */
export const useSettings = (): UseSettingsReturn => {
    const { isAvailable } = useTauri()
    const [localError, setLocalError] = useState<Error | null>(null)
    const initializedRef = useRef(false)

    // 从 Store 获取状态和方法
    const {
        appSettings,
        appConfig,
        isLoading,
        isInitialized,
        syncStatus,
        error: storeError,
        needsSync,
        initialize,
        updateAppSettings,
        resetAppSettings,
        updateTheme: storeUpdateTheme,
        updateLanguage: storeUpdateLanguage,
        toggleAutoStart: storeToggleAutoStart,
        updateNotifications: storeUpdateNotifications,
        updateAISettings: storeUpdateAISettings,
        updateConfig: storeUpdateConfig,
        updatePartialConfig: storeUpdatePartialConfig,
        resetAppConfig,
        exportSettings: storeExportSettings,
        importSettings: storeImportSettings,
        syncToBackend: storeSyncToBackend,
        syncFromBackend: storeSyncFromBackend,
        forceSync: storeForceSync,
        refreshConfig: storeRefreshConfig,
        clearError: storeClearError,
        resetAllSettings,
        addEventListener: storeAddEventListener
    } = useSettingsStore()

    // 组合 Store 错误和本地错误
    const error = storeError || localError

    // 初始化设置
    useEffect(() => {
        if (!initializedRef.current && !isInitialized) {
            initializedRef.current = true
            initialize().catch(err => {
                console.error('设置初始化失败:', err)
                setLocalError(err instanceof Error ? err : new Error(String(err)))
            })
        }
    }, [initialize, isInitialized])

    // ==================== 应用设置操作 ====================

    const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
        setLocalError(null)
        try {
            await updateAppSettings(updates)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [updateAppSettings])

    const resetSettings = useCallback(async () => {
        setLocalError(null)
        try {
            await resetAppSettings()
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [resetAppSettings])

    const updateTheme = useCallback(async (theme: ThemeMode) => {
        setLocalError(null)
        try {
            await storeUpdateTheme(theme)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeUpdateTheme])

    const updateLanguage = useCallback(async (language: string) => {
        setLocalError(null)
        try {
            await storeUpdateLanguage(language)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeUpdateLanguage])

    const toggleAutoStart = useCallback(async () => {
        setLocalError(null)
        try {
            await storeToggleAutoStart()
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeToggleAutoStart])

    const updateNotifications = useCallback(async (updates: Partial<AppSettings['notifications']>) => {
        setLocalError(null)
        try {
            await storeUpdateNotifications(updates)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeUpdateNotifications])

    const updateAISettings = useCallback(async (updates: Partial<AppSettings['ai']>) => {
        setLocalError(null)
        try {
            await storeUpdateAISettings(updates)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeUpdateAISettings])

    // ==================== 配置操作 ====================

    const updateConfig = useCallback(async (config: AppConfig) => {
        setLocalError(null)
        try {
            await storeUpdateConfig(config)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeUpdateConfig])

    const updatePartialConfig = useCallback(async (updates: PartialConfigUpdate) => {
        setLocalError(null)
        try {
            await storeUpdatePartialConfig(updates)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeUpdatePartialConfig])

    const resetConfig = useCallback(async () => {
        setLocalError(null)
        try {
            await resetAppConfig()
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [resetAppConfig])

    // ==================== 导入导出 ====================

    const exportSettings = useCallback(async (): Promise<string> => {
        setLocalError(null)
        try {
            return await storeExportSettings()
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeExportSettings])

    const exportSettingsToFile = useCallback(async (filePath: string) => {
        setLocalError(null)
        try {
            await storeExportSettings(filePath)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeExportSettings])

    const importSettings = useCallback(async (settingsJson: string) => {
        setLocalError(null)
        try {
            await storeImportSettings(settingsJson)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeImportSettings])

    const importSettingsFromFile = useCallback(async (filePath: string) => {
        setLocalError(null)
        try {
            await storeImportSettings({ filePath })
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [storeImportSettings])

    // ==================== 同步操作 ====================

    const syncToBackend = useCallback(async () => {
        if (!isAvailable) {
            console.warn('Tauri 不可用，无法同步到后端')
            return
        }

        setLocalError(null)
        try {
            await storeSyncToBackend()
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [isAvailable, storeSyncToBackend])

    const syncFromBackend = useCallback(async () => {
        if (!isAvailable) {
            console.warn('Tauri 不可用，无法从后端同步')
            return
        }

        setLocalError(null)
        try {
            await storeSyncFromBackend()
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [isAvailable, storeSyncFromBackend])

    const forceSync = useCallback(async () => {
        if (!isAvailable) {
            console.warn('Tauri 不可用，无法强制同步')
            return
        }

        setLocalError(null)
        try {
            await storeForceSync()
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [isAvailable, storeForceSync])

    const refreshConfig = useCallback(async () => {
        if (!isAvailable) {
            console.warn('Tauri 不可用，无法刷新配置')
            return
        }

        setLocalError(null)
        try {
            await storeRefreshConfig()
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [isAvailable, storeRefreshConfig])

    // ==================== 工具方法 ====================

    const clearError = useCallback(() => {
        setLocalError(null)
        storeClearError()
    }, [storeClearError])

    const resetAll = useCallback(async () => {
        setLocalError(null)
        try {
            await resetAllSettings()
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setLocalError(error)
            throw error
        }
    }, [resetAllSettings])

    const addEventListener = useCallback((listener: (event: SettingsEvent) => void) => {
        return storeAddEventListener(listener)
    }, [storeAddEventListener])

    return {
        // 基础状态
        settings: appSettings,
        config: appConfig,
        isLoading,
        isInitialized,
        syncStatus,
        error,
        needsSync: needsSync(),

        // 应用设置操作
        updateSettings,
        resetSettings,
        updateTheme,
        updateLanguage,
        toggleAutoStart,
        updateNotifications,
        updateAISettings,

        // 配置操作
        updateConfig,
        updatePartialConfig,
        resetConfig,

        // 导入导出
        exportSettings,
        exportSettingsToFile,
        importSettings,
        importSettingsFromFile,

        // 同步操作
        syncToBackend,
        syncFromBackend,
        forceSync,
        refreshConfig,

        // 工具方法
        clearError,
        resetAll,
        addEventListener
    }
}

/**
 * 简化版设置 Hook
 * 
 * 仅提供基础的设置读取和更新功能，适合简单场景
 */
export const useSimpleSettings = () => {
    const { settings, updateSettings, isLoading, error } = useSettings()
    return { settings, updateSettings, isLoading, error }
}

/**
 * 主题 Hook
 * 
 * 专门用于主题管理
 */
export const useThemeSettings = () => {
    const { settings, updateTheme } = useSettings()
    return {
        theme: settings.theme,
        updateTheme
    }
}

/**
 * 语言 Hook
 * 
 * 专门用于语言管理
 */
export const useLanguageSettings = () => {
    const { settings, updateLanguage } = useSettings()
    return {
        language: settings.language,
        updateLanguage
    }
}