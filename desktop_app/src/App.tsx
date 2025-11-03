import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/tauri'
import { appWindow } from '@tauri-apps/api/window'
import { AnimatePresence, motion } from 'framer-motion'
import React, { Suspense, useCallback, useEffect, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Toaster } from 'react-hot-toast'

// 组件导入
import { ChatWindow } from '@/components/Chat/ChatWindow'
import { ContextMenu } from '@/components/common/ContextMenu'
import { ErrorFallback } from '@/components/common/ErrorFallback'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { UpdateNotification } from '@/components/common/UpdateNotification'
import { SystemTray } from '@/components/Desktop/SystemTray'
import { PetWindow } from '@/components/Layout/PetWindow'
import { SettingsPanel } from '@/components/Settings/SettingsPanel'
import AdapterManagement from '@/pages/AdapterManagement'

// Hooks 导入
import { useCharacter } from '@/hooks/useCharacter'
import { useSettings } from '@/hooks/useSettings'
import { useTauri } from '@/hooks/useTauri'
import { useTheme } from '@/hooks/useTheme'
import { useWindowManager } from '@/hooks/useWindowManager'
import useKeyboardShortcuts from '@/hooks/useKeyboardShortcuts'

// 类型导入
import type { AppState, WindowMode } from '@/types/app'
import type { ContextMenuOption } from '@/types/ui'
import type { ShortcutConfig } from '@/types/shortcuts'

// 工具导入
import { getAdjustedShortcuts } from '@/config/shortcutPresets'
import { ShortcutStorageManager } from '@/utils/shortcutStorage'
import { initializeGlobalErrorCatcher } from '@/utils/globalErrorCatcher'

// 常量定义
const WINDOW_MODES = {
    PET: 'pet',
    CHAT: 'chat',
    SETTINGS: 'settings',
    ADAPTERS: 'adapters',
    MINIMIZED: 'minimized',
} as const

const ANIMATION_VARIANTS = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
}

const TRANSITION_CONFIG = {
    type: 'spring',
    stiffness: 300,
    damping: 30,
}

/**
 * 主应用组件
 * 
 * 功能特性:
 * - 🎭 Live2D 角色展示和交互
 * - 💬 智能对话系统
 * - ⚙️ 设置面板和配置管理
 * - 🎨 主题切换和样式系统
 * - ⌨️ 键盘快捷键支持
 * - 🖱️ 右键菜单和上下文操作
 * - 📱 窗口模式切换和管理
 * - 🔄 自动更新和通知
 * - 🛡️ 错误边界和异常处理
 * - 🚀 性能优化和懒加载
 */
const App: React.FC = () => {
    // ==================== 状态管理 ====================
    const [appState, setAppState] = useState<AppState>({
        windowMode: 'pet' as WindowMode,
        isLoading: true,
        isInitialized: false,
        hasError: false,
        lastError: null,
    })

    const [contextMenu, setContextMenu] = useState<{
        visible: boolean
        x: number
        y: number
        options: ContextMenuOption[]
    }>({
        visible: false,
        x: 0,
        y: 0,
        options: [],
    })

    // ==================== Hooks ====================
    const { theme, setTheme } = useTheme()
    const { settings, updateSettings, resetSettings } = useSettings()
    const { currentCharacter, switchCharacter, characterList } = useCharacter()
    const { isTauriEnv, tauriVersion } = useTauri()
    const { minimizeWindow, closeWindow } = useWindowManager()
    const shortcuts = useKeyboardShortcuts()

    // ==================== 事件处理器 ====================
    const handleWindowModeChange = useCallback((mode: WindowMode) => {
        setAppState(prev => ({ ...prev, windowMode: mode }))

        // 通知 Tauri 后端窗口模式变化
        if (isTauriEnv) {
            invoke('set_window_mode', { mode }).catch(console.error)
        }
    }, [isTauriEnv])

    // ==================== 键盘快捷键系统 ====================
    // 快捷键回调函数工厂
    const getShortcutCallback = useCallback((shortcutId: string) => {
        return () => {
            console.log(`⌨️ [App] 快捷键触发: ${shortcutId}`)
            
            switch (shortcutId) {
                // ==================== 窗口管理 ====================
                case 'window.minimize':
                    minimizeWindow()
                    break
                
                case 'window.close':
                    closeWindow()
                    break
                
                case 'window.toggleAlwaysOnTop':
                    if (isTauriEnv) {
                        invoke('toggle_always_on_top').catch(console.error)
                    }
                    break
                
                case 'window.show':
                    if (isTauriEnv) {
                        invoke('show_window').catch(console.error)
                    }
                    break

                // ==================== 视图切换 ====================
                case 'view.pet':
                    handleWindowModeChange('pet')
                    break
                
                case 'view.chat':
                    handleWindowModeChange('chat')
                    break
                
                case 'view.settings':
                    handleWindowModeChange('settings')
                    break
                
                case 'view.adapters':
                    handleWindowModeChange('adapters')
                    break

                // ==================== 聊天相关 ====================
                case 'chat.focusInput':
                    // 聚焦输入框（由 ChatWindow 组件处理）
                    document.dispatchEvent(new CustomEvent('shortcut:chat.focusInput'))
                    break
                
                case 'chat.send':
                    // 发送消息（由 ChatWindow 组件处理）
                    document.dispatchEvent(new CustomEvent('shortcut:chat.send'))
                    break
                
                case 'chat.newConversation':
                    // 新建对话（由 ChatWindow 组件处理）
                    document.dispatchEvent(new CustomEvent('shortcut:chat.newConversation'))
                    break
                
                case 'chat.clearHistory':
                    // 清空历史（由 ChatWindow 组件处理）
                    document.dispatchEvent(new CustomEvent('shortcut:chat.clearHistory'))
                    break
                
                case 'chat.search':
                    // 搜索消息（由 ChatWindow 组件处理）
                    document.dispatchEvent(new CustomEvent('shortcut:chat.search'))
                    break

                // ==================== 角色相关 ====================
                case 'character.switch':
                    // 打开角色切换菜单
                    document.dispatchEvent(new CustomEvent('shortcut:character.switch'))
                    break
                
                case 'character.interact':
                    // 触发角色互动
                    document.dispatchEvent(new CustomEvent('shortcut:character.interact'))
                    break
                
                case 'character.resetPosition':
                    // 重置角色位置
                    if (isTauriEnv) {
                        invoke('center_window').catch(console.error)
                    }
                    break

                // ==================== 系统相关 ====================
                case 'system.quit':
                    if (isTauriEnv) {
                        invoke('quit_app').catch(console.error)
                    }
                    break
                
                case 'system.reload':
                    window.location.reload()
                    break
                
                case 'system.toggleDevTools':
                    if (isTauriEnv) {
                        invoke('toggle_devtools').catch(console.error)
                    }
                    break
                
                case 'system.openSettings':
                    handleWindowModeChange('settings')
                    break

                // ==================== 导航相关 ====================
                case 'nav.back':
                    window.history.back()
                    break
                
                case 'nav.forward':
                    window.history.forward()
                    break
                
                case 'nav.home':
                    handleWindowModeChange('pet')
                    break

                default:
                    console.warn(`⚠️ [App] 未处理的快捷键: ${shortcutId}`)
            }
        }
    }, [
        minimizeWindow,
        closeWindow,
        handleWindowModeChange,
        isTauriEnv,
    ])

    // 初始化快捷键和错误监控
    useEffect(() => {
        console.log('🎹 [App] 初始化快捷键系统')
        
        // 初始化全局错误捕获器
        initializeGlobalErrorCatcher({
            enableJSErrorCapture: true,
            enablePromiseRejectionCapture: true,
            enableResourceErrorCapture: true,
            enableConsoleErrorCapture: false, // 避免过多噪音
            autoReport: true,
            debugMode: process.env.NODE_ENV === 'development',
        })
        console.log('🛡️ [App] 全局错误捕获器已初始化')
        
        // 从本地存储加载配置
        const storedData = ShortcutStorageManager.load()
        
        // 获取预设快捷键
        const presets = getAdjustedShortcuts()
        
        // 合并配置
        const finalShortcuts = ShortcutStorageManager.merge(presets, storedData)
        
        // 注册所有快捷键
        finalShortcuts.forEach(shortcut => {
            const fullShortcut: ShortcutConfig = {
                ...shortcut,
                callback: getShortcutCallback(shortcut.id),
            }
            
            shortcuts.register(fullShortcut)
        })
        
        console.log(`✅ [App] 已注册 ${finalShortcuts.length} 个快捷键`)
        
        // 清理函数
        return () => {
            shortcuts.unregisterAll()
        }
    }, [getShortcutCallback, shortcuts]) // 添加必要的依赖

    // 保存快捷键配置到本地存储
    useEffect(() => {
        const handleStorageSync = () => {
            const registeredShortcuts = shortcuts.getRegisteredShortcuts()
            ShortcutStorageManager.save(registeredShortcuts)
        }

        // 监听快捷键变化事件
        window.addEventListener('shortcuts-changed', handleStorageSync)
        
        return () => {
            window.removeEventListener('shortcuts-changed', handleStorageSync)
        }
    }, [shortcuts])

    // ==================== 其他事件处理器 ====================
    const handleContextMenu = useCallback((event: React.MouseEvent, providedOptions?: ContextMenuOption[]) => {
        console.log('🖱️ [App] handleContextMenu 被调用:', { 
            button: event.button, 
            clientX: event.clientX, 
            clientY: event.clientY,
            hasProvidedOptions: !!providedOptions,
            providedOptionsCount: providedOptions?.length 
        })
        event.preventDefault()

        // 如果提供了自定义选项，使用它们；否则使用默认的完整菜单
        const options: ContextMenuOption[] = providedOptions || [
            {
                id: 'chat',
                label: '打开对话',
                icon: '💬',
                onClick: () => handleWindowModeChange(WINDOW_MODES.CHAT),
                disabled: false, // 暂时禁用连接检查
            },
            {
                id: 'settings',
                label: '设置',
                icon: '⚙️',
                onClick: () => handleWindowModeChange(WINDOW_MODES.SETTINGS),
            },
            {
                id: 'adapters',
                label: '适配器管理',
                icon: '🔌',
                onClick: () => handleWindowModeChange(WINDOW_MODES.ADAPTERS),
            },
            { id: 'divider-1', label: '', type: 'separator' },
            {
                id: 'character',
                label: '切换角色',
                icon: '🎭',
                children: characterList.map(char => ({
                    id: `character-${char.id}`,
                    label: char.name,
                    icon: char.avatar,
                    onClick: () => switchCharacter(char.id),
                    checked: currentCharacter?.id === char.id,
                })),
            },
            {
                id: 'theme',
                label: '主题',
                icon: theme === 'dark' ? '🌙' : '☀️',
                children: [
                    {
                        id: 'theme-light',
                        label: '浅色主题',
                        icon: '☀️',
                        onClick: () => setTheme('light'),
                        checked: theme === 'light',
                    },
                    {
                        id: 'theme-dark',
                        label: '深色主题',
                        icon: '🌙',
                        onClick: () => setTheme('dark'),
                        checked: theme === 'dark',
                    },
                    // 暂时禁用"跟随系统"选项，因为 ThemeName 类型不支持 'system'
                    // {
                    //     id: 'theme-auto',
                    //     label: '跟随系统',
                    //     icon: '🔄',
                    //     onClick: () => setTheme('system' as any),
                    //     checked: theme === 'system',
                    // },
                ],
            },
            { id: 'divider-2', label: '', type: 'separator' },
            {
                id: 'minimize',
                label: '最小化',
                icon: '➖',
                onClick: minimizeWindow,
            },
            {
                id: 'close',
                label: '退出',
                icon: '❌',
                onClick: handleAppClose,
            },
        ]

        const newContextMenu = {
            visible: true,
            x: event.clientX,
            y: event.clientY,
            options,
        }
        
        console.log('🖱️ [App] 设置 contextMenu 状态:', {
            visible: true,
            x: event.clientX,
            y: event.clientY,
            optionsCount: options.length
        })
        setContextMenu(newContextMenu)
        
        // 调试：验证状态已更新
        setTimeout(() => {
            console.log('🖱️ [App] contextMenu 状态验证（新值）:', newContextMenu)
        }, 50)
    }, [
        theme,
        characterList,
        currentCharacter,
        handleWindowModeChange,
        switchCharacter,
        setTheme,
        minimizeWindow,
    ])

    const handleAppClose = useCallback(async () => {
        try {
            // 保存应用状态
            await invoke('save_app_state', {
                state: {
                    windowMode: appState.windowMode,
                    theme,
                    settings,
                    currentCharacter: currentCharacter?.id,
                },
            })

            // 清理资源
            await invoke('cleanup_resources')

            // 关闭应用
            await closeWindow()
        } catch (error) {
            console.error('应用关闭失败:', error)
            // 强制关闭
            if (isTauriEnv) {
                await appWindow.close()
            }
        }
    }, [appState.windowMode, theme, settings, currentCharacter, closeWindow, isTauriEnv])

    const handleError = useCallback((error: Error, errorInfo: React.ErrorInfo) => {
        console.error('应用错误:', error, errorInfo)

        setAppState(prev => ({
            ...prev,
            hasError: true,
            lastError: {
                message: error.message,
                stack: error.stack,
                timestamp: Date.now(),
            },
        }))

        // 发送错误报告
        if (isTauriEnv) {
            invoke('report_error', {
                error: {
                    message: error.message,
                    stack: error.stack,
                    component: errorInfo.componentStack,
                    timestamp: Date.now(),
                },
            }).catch(console.error)
        }
    }, [isTauriEnv])

    // ==================== 生命周期 ====================
    useEffect(() => {
        const initializeApp = async () => {
            try {
                console.log('开始初始化应用...')
                setAppState(prev => ({ ...prev, isLoading: true }))

                console.log('Tauri环境检查:', isTauriEnv)
                // 初始化 Tauri 环境
                if (isTauriEnv) {
                    console.log('正在加载Tauri应用状态...')
                    // 加载保存的应用状态
                    const savedState = await invoke<any>('load_app_state')
                    if (savedState) {
                        if (savedState.windowMode) {
                            setAppState(prev => ({ ...prev, windowMode: savedState.windowMode }))
                        }
                        if (savedState.theme) {
                            setTheme(savedState.theme)
                        }
                        if (savedState.settings) {
                            updateSettings(savedState.settings)
                        }
                        if (savedState.currentCharacter) {
                            switchCharacter(savedState.currentCharacter)
                        }
                    }
                } else {
                    console.log('Web环境，跳过Tauri初始化')
                }

                // 只在Tauri环境中设置窗口事件监听
                if (isTauriEnv) {
                    console.log('设置Tauri窗口事件监听...')
                    // 设置窗口事件监听
                    const unlistenClose = await listen('tauri://close-requested', handleAppClose)
                    const unlistenFocus = await listen('tauri://focus', () => {
                        console.log('窗口获得焦点')
                    })
                    const unlistenBlur = await listen('tauri://blur', () => {
                        console.log('窗口失去焦点')
                    })

                    // 清理函数
                    return () => {
                        unlistenClose()
                        unlistenFocus()
                        unlistenBlur()
                    }
                }

                // 标记初始化完成
                console.log('应用初始化完成')
                setAppState(prev => ({
                    ...prev,
                    isLoading: false,
                    isInitialized: true,
                }))
            } catch (error) {
                console.error('应用初始化失败:', error)
                setAppState(prev => ({
                    ...prev,
                    isLoading: false,
                    hasError: true,
                    lastError: {
                        message: error instanceof Error ? error.message : '未知错误',
                        stack: error instanceof Error ? error.stack : undefined,
                        timestamp: Date.now(),
                    },
                }))
            }
        }

        initializeApp()
    }, [isTauriEnv, setTheme, updateSettings, switchCharacter, handleAppClose])

    // 点击外部关闭上下文菜单
    useEffect(() => {
        const handleClickOutside = () => {
            if (contextMenu.visible) {
                setContextMenu(prev => ({ ...prev, visible: false }))
            }
        }

        document.addEventListener('click', handleClickOutside)
        return () => document.removeEventListener('click', handleClickOutside)
    }, [contextMenu.visible])

    // ==================== 渲染函数 ====================
    const renderWindowContent = () => {
        switch (appState.windowMode) {
            case WINDOW_MODES.PET:
                return currentCharacter ? (
                    <PetWindow
                        character={currentCharacter}
                        onContextMenu={handleContextMenu}
                        onModeChange={handleWindowModeChange}
                    />
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                    }}>
                        <div style={{
                            textAlign: 'center',
                            color: 'hsl(var(--color-muted-foreground))',
                        }}>
                            没有选择角色
                        </div>
                    </div>
                )

            case WINDOW_MODES.CHAT:
                return (
                    <ChatWindow
                        onClose={() => handleWindowModeChange(WINDOW_MODES.PET)}
                        onMinimize={minimizeWindow}
                    />
                )

            case WINDOW_MODES.SETTINGS:
                return (
                    <SettingsPanel
                        onClose={() => handleWindowModeChange(WINDOW_MODES.PET)}
                        onReset={resetSettings}
                    />
                )

            case WINDOW_MODES.ADAPTERS:
                return (
                    <AdapterManagement />
                )

            default:
                return (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                color: 'hsl(var(--color-foreground))',
                                marginBottom: '8px',
                            }}>
                                未知窗口模式
                            </h2>
                            <button
                                onClick={() => handleWindowModeChange(WINDOW_MODES.PET)}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: 'hsl(var(--color-primary))',
                                    color: 'hsl(var(--color-primary-foreground))',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                }}
                            >
                                返回主界面
                            </button>
                        </div>
                    </div>
                )
        }
    }

    // ==================== 加载状态 ====================
    if (appState.isLoading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'linear-gradient(135deg, hsl(var(--color-primary) / 0.05), hsl(var(--color-primary) / 0.15))',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <LoadingSpinner size="lg" style={{ marginBottom: '16px' }} />
                    <h2 style={{
                        fontSize: '20px',
                        fontWeight: 600,
                        color: 'hsl(var(--color-foreground))',
                        marginBottom: '8px',
                    }}>
                        正在启动 Zishu-sensei
                    </h2>
                    <p style={{
                        color: 'hsl(var(--color-muted-foreground))',
                        fontSize: '14px',
                    }}>
                        正在初始化应用程序...
                    </p>
                </div>
            </div>
        )
    }

    // ==================== 错误状态 ====================
    if (appState.hasError) {
        return (
            <ErrorFallback
                error={appState.lastError}
                resetError={() => setAppState(prev => ({ ...prev, hasError: false, lastError: null }))}
                onRestart={() => window.location.reload()}
            />
        )
    }

    // ==================== 主渲染 ====================
    return (
        <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onError={handleError}
            onReset={() => setAppState(prev => ({ ...prev, hasError: false, lastError: null }))}
        >
            <div
                style={{
                    height: '100vh',
                    width: '100vw',
                    overflow: 'hidden',
                    backgroundColor: 'hsl(var(--color-background))',
                    transition: 'background-color 200ms',
                    cursor: appState.windowMode === WINDOW_MODES.PET ? 'move' : 'default',
                }}
                data-tauri-drag-region={appState.windowMode === WINDOW_MODES.PET}
            >
                {/* 主要内容区域 */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={appState.windowMode}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={ANIMATION_VARIANTS}
                        transition={TRANSITION_CONFIG}
                        className="h-full w-full"
                    >
                        <Suspense
                            fallback={
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: '100%',
                                }}>
                                    <LoadingSpinner size="md" />
                                </div>
                            }
                        >
                            {renderWindowContent()}
                        </Suspense>
                    </motion.div>
                </AnimatePresence>

                {/* 角色组件已由 PetWindow 渲染，这里避免重复渲染以防服务实例冲突 */}

                {/* 上下文菜单 */}
                <ContextMenu
                    visible={contextMenu.visible}
                    x={contextMenu.x}
                    y={contextMenu.y}
                    options={contextMenu.options}
                    onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
                />

                {/* 系统托盘 */}
                {isTauriEnv && (
                    <SystemTray
                        onShow={() => handleWindowModeChange(WINDOW_MODES.PET)}
                        onSettings={() => handleWindowModeChange(WINDOW_MODES.SETTINGS)}
                        onExit={handleAppClose}
                    />
                )}

                {/* 更新通知 */}
                <UpdateNotification />

                {/* Toast 通知 */}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        className: 'toast-custom',
                        style: {
                            background: theme === 'dark' ? '#374151' : '#ffffff',
                            color: theme === 'dark' ? '#f3f4f6' : '#111827',
                            border: `1px solid ${theme === 'dark' ? '#4b5563' : '#e5e7eb'}`,
                        },
                    }}
                />

                {/* 开发工具信息 */}
                {(import.meta as any).env.DEV && (
                    <div style={{
                        position: 'fixed',
                        bottom: '8px',
                        left: '8px',
                        fontSize: '12px',
                        color: 'hsl(var(--color-muted-foreground))',
                        backgroundColor: 'hsl(var(--color-muted) / 0.8)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backdropFilter: 'blur(4px)',
                    }}>
                        <div>模式: {appState.windowMode}</div>
                        <div>主题: {theme}</div>
                        {isTauriEnv && <div>Tauri: {tauriVersion}</div>}
                    </div>
                )}
            </div>
        </ErrorBoundary>
    )
}

export default App
