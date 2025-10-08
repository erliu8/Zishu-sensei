import type { AppSettings } from '@/types/app'
import { useCallback, useEffect, useState } from 'react'
import { useTauri } from './useTauri'

/**
 * 设置管理器 Hook 返回值
 */
interface UseSettingsReturn {
    settings: AppSettings
    updateSettings: (updates: Partial<AppSettings>) => Promise<void>
    resetSettings: () => Promise<void>
    exportSettings: () => Promise<string>
    importSettings: (settingsJson: string) => Promise<void>
    isLoading: boolean
    error: string | null
}

/**
 * 默认设置
 */
const defaultSettings: AppSettings = {
    theme: 'system',
    language: 'zh-CN',
    autoStart: false,
    windowState: {
        mode: 'windowed',
        position: { x: 0, y: 0 },
        size: { width: 1200, height: 800 },
        isVisible: true,
        isAlwaysOnTop: false,
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
        model: 'default',
        voice: 'female',
        personality: 'friendly',
    },
}

/**
 * 设置管理 Hook
 */
export const useSettings = (): UseSettingsReturn => {
    const { isAvailable, invoke } = useTauri()
    const [settings, setSettings] = useState<AppSettings>(defaultSettings)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // 加载设置
    const loadSettings = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            let loadedSettings: AppSettings

            if (isAvailable) {
                // 从 Tauri 后端加载设置
                loadedSettings = await invoke<AppSettings>('load_settings')
            } else {
                // 从 localStorage 加载设置
                const stored = localStorage.getItem('app-settings')
                loadedSettings = stored ? JSON.parse(stored) : defaultSettings
            }

            // 合并默认设置，确保所有字段都存在
            const mergedSettings = {
                ...defaultSettings,
                ...loadedSettings,
                windowState: {
                    ...defaultSettings.windowState,
                    ...loadedSettings.windowState,
                },
                notifications: {
                    ...defaultSettings.notifications,
                    ...loadedSettings.notifications,
                },
                ai: {
                    ...defaultSettings.ai,
                    ...loadedSettings.ai,
                },
                character: {
                    ...defaultSettings.character,
                    ...loadedSettings.character,
                },
            }

            setSettings(mergedSettings)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load settings'
            setError(errorMessage)
            console.error('Failed to load settings:', err)

            // 使用默认设置
            setSettings(defaultSettings)
        } finally {
            setIsLoading(false)
        }
    }, [isAvailable, invoke])

    // 保存设置
    const saveSettings = useCallback(async (newSettings: AppSettings) => {
        try {
            if (isAvailable) {
                // 保存到 Tauri 后端
                await invoke('save_settings', { settings: newSettings })
            } else {
                // 保存到 localStorage
                localStorage.setItem('app-settings', JSON.stringify(newSettings))
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save settings'
            throw new Error(errorMessage)
        }
    }, [isAvailable, invoke])

    // 更新设置
    const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
        setError(null)

        try {
            const newSettings = {
                ...settings,
                ...updates,
                // 深度合并嵌套对象
                windowState: updates.windowState ? {
                    ...settings.windowState,
                    ...updates.windowState,
                } : settings.windowState,
                notifications: updates.notifications ? {
                    ...settings.notifications,
                    ...updates.notifications,
                } : settings.notifications,
                ai: updates.ai ? {
                    ...settings.ai,
                    ...updates.ai,
                } : settings.ai,
                character: updates.character ? {
                    ...settings.character,
                    ...updates.character,
                } : settings.character,
            }

            await saveSettings(newSettings)
            setSettings(newSettings)

            // 发送设置更新事件
            if (isAvailable) {
                await invoke('emit_settings_updated', { settings: newSettings })
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update settings'
            setError(errorMessage)
            console.error('Failed to update settings:', err)
        }
    }, [settings, saveSettings, isAvailable, invoke])

    // 重置设置
    const resetSettings = useCallback(async () => {
        setError(null)

        try {
            await saveSettings(defaultSettings)
            setSettings(defaultSettings)

            // 发送设置重置事件
            if (isAvailable) {
                await invoke('emit_settings_reset')
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings'
            setError(errorMessage)
            console.error('Failed to reset settings:', err)
        }
    }, [saveSettings, isAvailable, invoke])

    // 导出设置
    const exportSettings = useCallback(async (): Promise<string> => {
        try {
            const exportData = {
                version: '1.0.0',
                timestamp: Date.now(),
                settings,
            }

            return JSON.stringify(exportData, null, 2)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to export settings'
            throw new Error(errorMessage)
        }
    }, [settings])

    // 导入设置
    const importSettings = useCallback(async (settingsJson: string) => {
        setError(null)

        try {
            const importData = JSON.parse(settingsJson)

            if (!importData.settings) {
                throw new Error('Invalid settings format')
            }

            // 验证设置格式
            const importedSettings = {
                ...defaultSettings,
                ...importData.settings,
            }

            await saveSettings(importedSettings)
            setSettings(importedSettings)

            // 发送设置导入事件
            if (isAvailable) {
                await invoke('emit_settings_imported', { settings: importedSettings })
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to import settings'
            setError(errorMessage)
            console.error('Failed to import settings:', err)
        }
    }, [saveSettings, isAvailable, invoke])

    // 初始化加载设置
    useEffect(() => {
        loadSettings()
    }, [loadSettings])

    return {
        settings,
        updateSettings,
        resetSettings,
        exportSettings,
        importSettings,
        isLoading,
        error,
    }
}