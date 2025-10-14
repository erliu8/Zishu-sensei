import type { WindowState } from '@/types/app'
import { useCallback, useEffect, useState } from 'react'
import { useTauri } from './useTauri'

/**
 * 窗口管理器 Hook 返回值
 */
interface UseWindowManagerReturn {
    windowState: WindowState
    toggleWindowMode: () => Promise<void>
    minimizeWindow: () => Promise<void>
    closeWindow: () => Promise<void>
    setWindowMode: (mode: WindowState['mode']) => Promise<void>
    setWindowPosition: (x: number, y: number) => Promise<void>
    setWindowSize: (width: number, height: number) => Promise<void>
    setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>
    setResizable: (resizable: boolean) => Promise<void>
    setTitle: (title: string) => Promise<void>
    show: () => Promise<void>
    hide: () => Promise<void>
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    unmaximize: () => Promise<void>
    fullscreen: () => Promise<void>
    unfullscreen: () => Promise<void>
    center: () => Promise<void>
    focus: () => Promise<void>
    blur: () => Promise<void>
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    isMinimized: () => Promise<boolean>
    isFullscreen: () => Promise<boolean>
    isVisible: () => Promise<boolean>
}

/**
 * 窗口管理 Hook
 */
export const useWindowManager = (): UseWindowManagerReturn => {
    const { isAvailable, invoke, listen } = useTauri()

    const [windowState, setWindowState] = useState<WindowState>({
        mode: 'windowed',
        position: { x: 0, y: 0 },
        size: { width: 1200, height: 800 },
        isVisible: true,
        isAlwaysOnTop: false,
        isResizable: true,
        title: '紫舒老师桌面版',
    })

    // 获取窗口状态
    const getWindowState = useCallback(async () => {
        if (!isAvailable) return

        try {
            const state = await invoke<WindowState>('get_window_state')
            setWindowState(state)
        } catch (error) {
            console.error('Failed to get window state:', error)
        }
    }, [isAvailable, invoke])

    // 设置窗口模式
    const setWindowMode = useCallback(async (mode: WindowState['mode']) => {
        if (!isAvailable) return

        try {
            await invoke('set_window_mode', { mode })
            setWindowState(prev => ({ ...prev, mode }))
        } catch (error) {
            console.error('Failed to set window mode:', error)
        }
    }, [isAvailable, invoke])

    // 切换窗口模式
    const toggleWindowMode = useCallback(async () => {
        if (!isAvailable) return

        try {
            const currentMode = windowState.mode
            let newMode: WindowState['mode']
            
            switch (currentMode) {
                case 'pet':
                    newMode = 'chat'
                    break
                case 'chat':
                    newMode = 'settings'
                    break
                case 'settings':
                    newMode = 'pet'
                    break
                default:
                    newMode = 'pet'
            }
            
            await setWindowMode(newMode)
        } catch (error) {
            console.error('Failed to toggle window mode:', error)
        }
    }, [isAvailable, windowState.mode, setWindowMode])

    // 最小化
    const minimize = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('minimize_window')
            setWindowState(prev => ({ ...prev, mode: 'minimized' }))
        } catch (error) {
            console.error('Failed to minimize window:', error)
        }
    }, [isAvailable, invoke])

    // 关闭窗口
    const close = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('close_window')
        } catch (error) {
            console.error('Failed to close window:', error)
        }
    }, [isAvailable, invoke])

    // 最小化窗口（别名）
    const minimizeWindow = useCallback(async () => {
        await minimize()
    }, [minimize])

    // 关闭窗口（别名）
    const closeWindow = useCallback(async () => {
        await close()
    }, [close])

    // 设置窗口位置
    const setWindowPosition = useCallback(async (x: number, y: number) => {
        if (!isAvailable) return

        try {
            await invoke('set_window_position', { x, y })
            setWindowState(prev => ({ ...prev, position: { x, y } }))
        } catch (error) {
            console.error('Failed to set window position:', error)
        }
    }, [isAvailable, invoke])

    // 设置窗口大小
    const setWindowSize = useCallback(async (width: number, height: number) => {
        if (!isAvailable) return

        try {
            await invoke('set_window_size', { width, height })
            setWindowState(prev => ({ ...prev, size: { width, height } }))
        } catch (error) {
            console.error('Failed to set window size:', error)
        }
    }, [isAvailable, invoke])

    // 设置置顶
    const setAlwaysOnTop = useCallback(async (alwaysOnTop: boolean) => {
        if (!isAvailable) return

        try {
            await invoke('set_always_on_top', { alwaysOnTop })
            setWindowState(prev => ({ ...prev, isAlwaysOnTop: alwaysOnTop }))
        } catch (error) {
            console.error('Failed to set always on top:', error)
        }
    }, [isAvailable, invoke])

    // 设置可调整大小
    const setResizable = useCallback(async (resizable: boolean) => {
        if (!isAvailable) return

        try {
            await invoke('set_resizable', { resizable })
            setWindowState(prev => ({ ...prev, isResizable: resizable }))
        } catch (error) {
            console.error('Failed to set resizable:', error)
        }
    }, [isAvailable, invoke])

    // 设置标题
    const setTitle = useCallback(async (title: string) => {
        if (!isAvailable) return

        try {
            await invoke('set_title', { title })
            setWindowState(prev => ({ ...prev, title }))
        } catch (error) {
            console.error('Failed to set title:', error)
        }
    }, [isAvailable, invoke])

    // 显示窗口
    const show = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('show_window')
            setWindowState(prev => ({ ...prev, isVisible: true }))
        } catch (error) {
            console.error('Failed to show window:', error)
        }
    }, [isAvailable, invoke])

    // 隐藏窗口
    const hide = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('hide_window')
            setWindowState(prev => ({ ...prev, isVisible: false }))
        } catch (error) {
            console.error('Failed to hide window:', error)
        }
    }, [isAvailable, invoke])

    // 最大化
    const maximize = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('maximize_window')
            setWindowState(prev => ({ ...prev, mode: 'maximized' }))
        } catch (error) {
            console.error('Failed to maximize window:', error)
        }
    }, [isAvailable, invoke])

    // 取消最大化
    const unmaximize = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('unmaximize_window')
            setWindowState(prev => ({ ...prev, mode: 'windowed' }))
        } catch (error) {
            console.error('Failed to unmaximize window:', error)
        }
    }, [isAvailable, invoke])

    // 全屏
    const fullscreen = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('fullscreen_window')
            setWindowState(prev => ({ ...prev, mode: 'fullscreen' }))
        } catch (error) {
            console.error('Failed to fullscreen window:', error)
        }
    }, [isAvailable, invoke])

    // 取消全屏
    const unfullscreen = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('unfullscreen_window')
            setWindowState(prev => ({ ...prev, mode: 'windowed' }))
        } catch (error) {
            console.error('Failed to unfullscreen window:', error)
        }
    }, [isAvailable, invoke])

    // 居中
    const center = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('center_window')
        } catch (error) {
            console.error('Failed to center window:', error)
        }
    }, [isAvailable, invoke])

    // 聚焦
    const focus = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('focus_window')
        } catch (error) {
            console.error('Failed to focus window:', error)
        }
    }, [isAvailable, invoke])

    // 失去焦点
    const blur = useCallback(async () => {
        if (!isAvailable) return

        try {
            await invoke('blur_window')
        } catch (error) {
            console.error('Failed to blur window:', error)
        }
    }, [isAvailable, invoke])

    // 检查是否最大化
    const isMaximized = useCallback(async (): Promise<boolean> => {
        if (!isAvailable) return false

        try {
            return await invoke<boolean>('is_maximized')
        } catch (error) {
            console.error('Failed to check if maximized:', error)
            return false
        }
    }, [isAvailable, invoke])

    // 检查是否最小化
    const isMinimized = useCallback(async (): Promise<boolean> => {
        if (!isAvailable) return false

        try {
            return await invoke<boolean>('is_minimized')
        } catch (error) {
            console.error('Failed to check if minimized:', error)
            return false
        }
    }, [isAvailable, invoke])

    // 检查是否全屏
    const isFullscreen = useCallback(async (): Promise<boolean> => {
        if (!isAvailable) return false

        try {
            return await invoke<boolean>('is_fullscreen')
        } catch (error) {
            console.error('Failed to check if fullscreen:', error)
            return false
        }
    }, [isAvailable, invoke])

    // 检查是否可见
    const isVisible = useCallback(async (): Promise<boolean> => {
        if (!isAvailable) return false

        try {
            return await invoke<boolean>('is_visible')
        } catch (error) {
            console.error('Failed to check if visible:', error)
            return false
        }
    }, [isAvailable, invoke])

    // 监听窗口事件
    useEffect(() => {
        if (!isAvailable) return

        const listeners: (() => void)[] = []

        const setupListeners = async () => {
            try {
                // 监听窗口状态变化
                const unlistenStateChange = await listen('window-state-changed', (event: any) => {
                    setWindowState(event.payload)
                })
                listeners.push(unlistenStateChange)

                // 监听窗口聚焦/失焦
                const unlistenFocus = await listen('tauri://window-focus', () => {
                    console.log('Window focused')
                })
                listeners.push(unlistenFocus)

                const unlistenBlur = await listen('tauri://window-blur', () => {
                    console.log('Window blurred')
                })
                listeners.push(unlistenBlur)
            } catch (error) {
                console.error('Failed to setup window listeners:', error)
            }
        }

        setupListeners()

        return () => {
            listeners.forEach(unlisten => unlisten())
        }
    }, [isAvailable, listen])

    // 初始化获取窗口状态
    useEffect(() => {
        getWindowState()
    }, [getWindowState])

    return {
        windowState,
        toggleWindowMode,
        minimizeWindow,
        closeWindow,
        setWindowMode,
        setWindowPosition,
        setWindowSize,
        setAlwaysOnTop,
        setResizable,
        setTitle,
        show,
        hide,
        minimize,
        maximize,
        unmaximize,
        fullscreen,
        unfullscreen,
        center,
        focus,
        blur,
        close,
        isMaximized,
        isMinimized,
        isFullscreen,
        isVisible,
    }
}