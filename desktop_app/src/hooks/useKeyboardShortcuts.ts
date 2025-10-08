import { useCallback, useEffect, useRef } from 'react'
import { useTauri } from './useTauri'

/**
 * 快捷键配置
 */
interface ShortcutConfig {
    key: string
    ctrl?: boolean
    alt?: boolean
    shift?: boolean
    meta?: boolean
    preventDefault?: boolean
    global?: boolean
    description?: string
    callback: (event?: KeyboardEvent) => void
}

/**
 * 快捷键管理器 Hook 返回值
 */
interface UseKeyboardShortcutsReturn {
    register: (shortcut: ShortcutConfig) => () => void
    unregister: (key: string) => void
    unregisterAll: () => void
    getRegisteredShortcuts: () => ShortcutConfig[]
    isKeyPressed: (key: string) => boolean
}

/**
 * 键盘快捷键管理 Hook
 */
export const useKeyboardShortcuts = (): UseKeyboardShortcutsReturn => {
    const { isAvailable, invoke } = useTauri()
    const shortcutsRef = useRef<Map<string, ShortcutConfig>>(new Map())
    const pressedKeysRef = useRef<Set<string>>(new Set())

    // 检查按键是否匹配快捷键
    const matchesShortcut = useCallback((event: KeyboardEvent, shortcut: ShortcutConfig): boolean => {
        const { key, ctrl = false, alt = false, shift = false, meta = false } = shortcut

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
            if (!shortcut.global && matchesShortcut(event, shortcut)) {
                if (shortcut.preventDefault) {
                    event.preventDefault()
                }

                try {
                    shortcut.callback(event)
                } catch (error) {
                    console.error(`Error executing shortcut ${id}:`, error)
                }
                break
            }
        }
    }, [matchesShortcut])

    // 处理键盘释放事件
    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        pressedKeysRef.current.delete(event.key.toLowerCase())
    }, [])

    // 注册快捷键
    const register = useCallback((shortcut: ShortcutConfig): (() => void) => {
        const id = `${shortcut.key}-${shortcut.ctrl || false}-${shortcut.alt || false}-${shortcut.shift || false}-${shortcut.meta || false}`

        shortcutsRef.current.set(id, shortcut)

        // 如果是全局快捷键且在 Tauri 环境中，注册全局快捷键
        if (shortcut.global && isAvailable) {
            const registerGlobalShortcut = async () => {
                try {
                    const shortcutString = [
                        shortcut.ctrl && 'Ctrl',
                        shortcut.alt && 'Alt',
                        shortcut.shift && 'Shift',
                        shortcut.meta && (process.platform === 'darwin' ? 'Cmd' : 'Meta'),
                        shortcut.key.toUpperCase()
                    ].filter(Boolean).join('+')

                    await invoke('register_global_shortcut', {
                        shortcut: shortcutString,
                        id
                    })
                } catch (error) {
                    console.error(`Failed to register global shortcut ${id}:`, error)
                }
            }

            registerGlobalShortcut()
        }

        // 返回取消注册函数
        return () => unregister(id)
    }, [isAvailable, invoke])

    // 取消注册快捷键
    const unregister = useCallback(async (id: string) => {
        const shortcut = shortcutsRef.current.get(id)

        if (shortcut) {
            shortcutsRef.current.delete(id)

            // 如果是全局快捷键，取消注册
            if (shortcut.global && isAvailable) {
                try {
                    await invoke('unregister_global_shortcut', { id })
                } catch (error) {
                    console.error(`Failed to unregister global shortcut ${id}:`, error)
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
    }, [unregister])

    // 获取已注册的快捷键
    const getRegisteredShortcuts = useCallback((): ShortcutConfig[] => {
        return Array.from(shortcutsRef.current.values())
    }, [])

    // 检查按键是否被按下
    const isKeyPressed = useCallback((key: string): boolean => {
        return pressedKeysRef.current.has(key.toLowerCase())
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
        if (!isAvailable) return

        let unlisten: (() => void) | undefined

        const setupGlobalShortcutListener = async () => {
            try {
                const { listen } = await import('@tauri-apps/api/event')

                unlisten = await listen('global-shortcut', (event: any) => {
                    const { id } = event.payload
                    const shortcut = shortcutsRef.current.get(id)

                    if (shortcut) {
                        try {
                            shortcut.callback()
                        } catch (error) {
                            console.error(`Error executing global shortcut ${id}:`, error)
                        }
                    }
                })
            } catch (error) {
                console.error('Failed to setup global shortcut listener:', error)
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
    }, [unregisterAll])

    return {
        register,
        unregister,
        unregisterAll,
        getRegisteredShortcuts,
        isKeyPressed,
    }
}
