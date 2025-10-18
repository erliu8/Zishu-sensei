import { useCallback, useEffect, useRef, useState } from 'react'
import { useTauri } from './useTauri'
import type { ShortcutConfig } from '@/types/shortcuts'
import { getAdjustedShortcuts } from '@/config/shortcutPresets'

/**
 * 快捷键管理器 Hook 返回值
 */
interface UseKeyboardShortcutsReturn {
    /** 注册快捷键 */
    register: (shortcut: ShortcutConfig) => () => void
    /** 取消注册快捷键 */
    unregister: (id: string) => Promise<void>
    /** 取消注册所有快捷键 */
    unregisterAll: () => Promise<void>
    /** 获取已注册的快捷键 */
    getRegisteredShortcuts: () => ShortcutConfig[]
    /** 检查按键是否被按下 */
    isKeyPressed: (key: string) => boolean
    /** 更新快捷键配置 */
    updateShortcut: (id: string, config: ShortcutConfig) => Promise<void>
    /** 启用或禁用快捷键 */
    toggleShortcut: (id: string, enabled: boolean) => Promise<void>
    /** 获取快捷键统计信息 */
    getStatistics: () => Promise<any>
    /** 检查快捷键冲突 */
    checkConflict: (config: ShortcutConfig) => Promise<string[]>
    /** 验证快捷键配置 */
    validateConfig: (config: ShortcutConfig) => Promise<boolean>
    /** 加载预设快捷键 */
    loadPresets: () => void
    /** 是否正在初始化 */
    isInitializing: boolean
    /** 错误信息 */
    error: Error | null
}

/**
 * 键盘快捷键管理 Hook
 * 
 * @example
 * ```tsx
 * const shortcuts = useKeyboardShortcuts()
 * 
 * // 注册快捷键
 * shortcuts.register({
 *   id: 'myShortcut',
 *   name: '我的快捷键',
 *   key: 'K',
 *   modifiers: { ctrl: true },
 *   callback: () => console.log('快捷键触发')
 * })
 * 
 * // 加载预设快捷键
 * shortcuts.loadPresets()
 * ```
 */
export const useKeyboardShortcuts = (): UseKeyboardShortcutsReturn => {
    const { isAvailable, invoke } = useTauri()
    const shortcutsRef = useRef<Map<string, ShortcutConfig>>(new Map())
    const pressedKeysRef = useRef<Set<string>>(new Set())
    const [isInitializing, setIsInitializing] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    // 检查按键是否匹配快捷键
    const matchesShortcut = useCallback((event: KeyboardEvent, shortcut: ShortcutConfig): boolean => {
        const { key, modifiers } = shortcut
        const { ctrl = false, alt = false, shift = false, meta = false } = modifiers

        // 检查主键
        if (event.key.toLowerCase() !== key.toLowerCase()) {
            return false
        }

        // 检查修饰键
        if (event.ctrlKey !== ctrl) return false
        if (event.altKey !== alt) return false
        if (event.shiftKey !== shift) return false
        if (event.metaKey !== meta) return false

        return true
    }, [])

    // 处理键盘事件
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // 记录按下的键
        pressedKeysRef.current.add(event.key.toLowerCase())

        // 检查是否匹配任何快捷键
        for (const [id, shortcut] of shortcutsRef.current) {
            if (!shortcut.enabled) continue
            if (shortcut.scope === 'global') continue // 全局快捷键由后端处理

            if (matchesShortcut(event, shortcut)) {
                if (shortcut.preventDefault) {
                    event.preventDefault()
                    event.stopPropagation()
                }

                try {
                    // 记录触发
                    if (isAvailable) {
                        invoke('record_shortcut_trigger', { id }).catch(console.error)
                    }

                    // 执行回调
                    if (shortcut.callback) {
                        const result = shortcut.callback(event)
                        if (result instanceof Promise) {
                            result.catch(err => {
                                console.error(`快捷键 ${id} 回调执行失败:`, err)
                                setError(err instanceof Error ? err : new Error(String(err)))
                            })
                        }
                    }
                } catch (err) {
                    console.error(`快捷键 ${id} 执行失败:`, err)
                    setError(err instanceof Error ? err : new Error(String(err)))
                }
                break
            }
        }
    }, [matchesShortcut, isAvailable, invoke])

    // 处理键盘释放事件
    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        pressedKeysRef.current.delete(event.key.toLowerCase())
    }, [])

    // 转换快捷键配置为后端格式
    const toBackendConfig = useCallback((shortcut: ShortcutConfig) => {
        return {
            id: shortcut.id,
            name: shortcut.name,
            description: shortcut.description,
            key: shortcut.key,
            modifiers: shortcut.modifiers,
            scope: shortcut.scope,
            category: shortcut.category,
            enabled: shortcut.enabled,
            prevent_default: shortcut.preventDefault || false,
            customizable: shortcut.customizable !== false,
        }
    }, [])

    // 注册快捷键
    const register = useCallback((shortcut: ShortcutConfig): (() => void) => {
        const { id } = shortcut

        // 存储在本地
        shortcutsRef.current.set(id, shortcut)

        // 如果在 Tauri 环境中，注册到后端
        if (isAvailable && shortcut.scope === 'global') {
            const registerToBackend = async () => {
                try {
                    await invoke('register_shortcut', { 
                        config: toBackendConfig(shortcut) 
                    })
                    console.log(`全局快捷键已注册: ${id}`)
                } catch (err) {
                    console.error(`注册全局快捷键 ${id} 失败:`, err)
                    setError(err instanceof Error ? err : new Error(String(err)))
                }
            }

            registerToBackend()
        }

        // 返回取消注册函数
        return () => {
            unregister(id)
        }
    }, [isAvailable, invoke, toBackendConfig])

    // 取消注册快捷键
    const unregister = useCallback(async (id: string) => {
        const shortcut = shortcutsRef.current.get(id)

        if (shortcut) {
            shortcutsRef.current.delete(id)

            // 如果是全局快捷键，从后端取消注册
            if (shortcut.scope === 'global' && isAvailable) {
                try {
                    await invoke('unregister_shortcut', { id })
                    console.log(`全局快捷键已取消注册: ${id}`)
                } catch (err) {
                    console.error(`取消注册全局快捷键 ${id} 失败:`, err)
                }
            }
        }
    }, [isAvailable, invoke])

    // 取消注册所有快捷键
    const unregisterAll = useCallback(async () => {
        const shortcuts = Array.from(shortcutsRef.current.keys())

        for (const id of shortcuts) {
            await unregister(id)
        }

        shortcutsRef.current.clear()

        // 清空后端的所有快捷键
        if (isAvailable) {
            try {
                await invoke('unregister_all_shortcuts')
                console.log('所有快捷键已清空')
            } catch (err) {
                console.error('清空快捷键失败:', err)
            }
        }
    }, [unregister, isAvailable, invoke])

    // 更新快捷键配置
    const updateShortcut = useCallback(async (id: string, config: ShortcutConfig) => {
        if (config.scope === 'global' && isAvailable) {
            try {
                await invoke('update_shortcut', { 
                    id, 
                    config: toBackendConfig(config) 
                })
            } catch (err) {
                console.error(`更新快捷键 ${id} 失败:`, err)
                throw err
            }
        }

        shortcutsRef.current.set(id, config)
    }, [isAvailable, invoke, toBackendConfig])

    // 启用或禁用快捷键
    const toggleShortcut = useCallback(async (id: string, enabled: boolean) => {
        const shortcut = shortcutsRef.current.get(id)
        if (!shortcut) {
            throw new Error(`快捷键 ${id} 不存在`)
        }

        if (shortcut.scope === 'global' && isAvailable) {
            try {
                await invoke('toggle_shortcut', { id, enabled })
            } catch (err) {
                console.error(`切换快捷键 ${id} 状态失败:`, err)
                throw err
            }
        }

        shortcutsRef.current.set(id, { ...shortcut, enabled })
    }, [isAvailable, invoke])

    // 获取快捷键统计信息
    const getStatistics = useCallback(async () => {
        if (!isAvailable) {
            return {
                total: shortcutsRef.current.size,
                enabled: Array.from(shortcutsRef.current.values()).filter(s => s.enabled).length,
            }
        }

        try {
            return await invoke('get_shortcut_statistics')
        } catch (err) {
            console.error('获取快捷键统计失败:', err)
            return null
        }
    }, [isAvailable, invoke])

    // 检查快捷键冲突
    const checkConflict = useCallback(async (config: ShortcutConfig): Promise<string[]> => {
        if (!isAvailable) {
            // 本地检查冲突
            const conflicts: string[] = []
            for (const [id, shortcut] of shortcutsRef.current) {
                if (id !== config.id && 
                    shortcut.key === config.key && 
                    JSON.stringify(shortcut.modifiers) === JSON.stringify(config.modifiers) &&
                    shortcut.scope === config.scope) {
                    conflicts.push(id)
                }
            }
            return conflicts
        }

        try {
            return await invoke('check_shortcut_conflict', { 
                config: toBackendConfig(config) 
            })
        } catch (err) {
            console.error('检查快捷键冲突失败:', err)
            return []
        }
    }, [isAvailable, invoke, toBackendConfig])

    // 验证快捷键配置
    const validateConfig = useCallback(async (config: ShortcutConfig): Promise<boolean> => {
        // 本地验证
        if (!config.id || !config.name || !config.key) {
            return false
        }

        if (!isAvailable) {
            return true
        }

        try {
            return await invoke('validate_shortcut_config', { 
                config: toBackendConfig(config) 
            })
        } catch (err) {
            console.error('验证快捷键配置失败:', err)
            return false
        }
    }, [isAvailable, invoke, toBackendConfig])

    // 获取已注册的快捷键
    const getRegisteredShortcuts = useCallback((): ShortcutConfig[] => {
        return Array.from(shortcutsRef.current.values())
    }, [])

    // 检查按键是否被按下
    const isKeyPressed = useCallback((key: string): boolean => {
        return pressedKeysRef.current.has(key.toLowerCase())
    }, [])

    // 加载预设快捷键
    const loadPresets = useCallback(() => {
        const presets = getAdjustedShortcuts()
        console.log(`加载 ${presets.length} 个预设快捷键`)
        
        // 注意：预设快捷键需要在使用时添加 callback
        // 这个函数只是声明，实际注册由 App 组件完成
    }, [])

    // 设置事件监听器
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('keyup', handleKeyUp)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('keyup', handleKeyUp)
        }
    }, [handleKeyDown, handleKeyUp])

    // 在 Tauri 环境中监听全局快捷键事件
    useEffect(() => {
        if (!isAvailable) {
            setIsInitializing(false)
            return
        }

        let unlisten: (() => void) | undefined

        const setupGlobalShortcutListener = async () => {
            try {
                const { listen } = await import('@tauri-apps/api/event')

                unlisten = await listen('global-shortcut-triggered', (event: any) => {
                    const { id } = event.payload
                    const shortcut = shortcutsRef.current.get(id)

                    if (shortcut && shortcut.callback) {
                        try {
                            const result = shortcut.callback()
                            if (result instanceof Promise) {
                                result.catch(err => {
                                    console.error(`全局快捷键 ${id} 回调执行失败:`, err)
                                })
                            }
                        } catch (err) {
                            console.error(`执行全局快捷键 ${id} 失败:`, err)
                        }
                    }
                })

                setIsInitializing(false)
                console.log('全局快捷键监听器已设置')
            } catch (err) {
                console.error('设置全局快捷键监听器失败:', err)
                setError(err instanceof Error ? err : new Error(String(err)))
                setIsInitializing(false)
            }
        }

        setupGlobalShortcutListener()

        return () => {
            if (unlisten) {
                unlisten()
            }
        }
    }, [isAvailable])

    // 清理所有快捷键
    useEffect(() => {
        return () => {
            unregisterAll()
        }
    }, []) // 只在组件卸载时执行

    return {
        register,
        unregister,
        unregisterAll,
        getRegisteredShortcuts,
        isKeyPressed,
        updateShortcut,
        toggleShortcut,
        getStatistics,
        checkConflict,
        validateConfig,
        loadPresets,
        isInitializing,
        error,
    }
}

export default useKeyboardShortcuts
