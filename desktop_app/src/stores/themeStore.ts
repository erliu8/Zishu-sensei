/**
 * 主题状态管理 Store
 * 
 * 使用 Zustand 管理主题相关的所有状态，包括：
 * - 主题模式切换（light/dark/system）
 * - 系统主题检测
 * - 主题持久化
 * - 主题应用到 DOM
 * - 主题切换动画
 * - CSS 变量管理
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import type { ThemeMode } from '@/types/app'

// ==================== 类型定义 ====================

/**
 * CSS 变量配置
 */
export interface ThemeCSSVariables {
    // 颜色
    '--color-primary': string
    '--color-secondary': string
    '--color-background': string
    '--color-foreground': string
    '--color-card': string
    '--color-card-foreground': string
    '--color-popover': string
    '--color-popover-foreground': string
    '--color-muted': string
    '--color-muted-foreground': string
    '--color-accent': string
    '--color-accent-foreground': string
    '--color-destructive': string
    '--color-destructive-foreground': string
    '--color-border': string
    '--color-input': string
    '--color-ring': string
    
    // 圆角
    '--radius-sm': string
    '--radius-md': string
    '--radius-lg': string
    
    // 间距
    '--spacing-xs': string
    '--spacing-sm': string
    '--spacing-md': string
    '--spacing-lg': string
    '--spacing-xl': string
    
    // 字体
    '--font-size-xs': string
    '--font-size-sm': string
    '--font-size-base': string
    '--font-size-lg': string
    '--font-size-xl': string
}

/**
 * 主题配置
 */
export interface ThemeConfiguration {
    /** 主题模式 */
    mode: ThemeMode
    /** 系统主题 */
    systemTheme: 'light' | 'dark'
    /** 实际使用的主题（考虑 system 模式） */
    effectiveTheme: 'light' | 'dark'
    /** 是否启用主题切换动画 */
    enableTransitions: boolean
    /** 是否启用自动主题切换 */
    autoSwitch: boolean
    /** 自动切换时间配置 */
    autoSwitchTime?: {
        lightTime: string  // 例如 "06:00"
        darkTime: string   // 例如 "18:00"
    }
    /** CSS 变量 */
    cssVariables: Partial<ThemeCSSVariables>
}

/**
 * 主题事件类型
 */
export type ThemeEvent =
    | { type: 'theme:changed'; payload: { from: ThemeMode; to: ThemeMode } }
    | { type: 'theme:system-changed'; payload: { theme: 'light' | 'dark' } }
    | { type: 'theme:applied'; payload: { theme: 'light' | 'dark' } }
    | { type: 'theme:css-updated'; payload: { variables: Partial<ThemeCSSVariables> } }
    | { type: 'theme:error'; payload: { error: Error; context: string } }

/**
 * 主题事件监听器
 */
export type ThemeEventListener = (event: ThemeEvent) => void

/**
 * 主题 Store 状态
 */
export interface ThemeStore {
    // ==================== 基础状态 ====================
    /** 当前主题模式 */
    theme: ThemeMode
    /** 系统主题 */
    systemTheme: 'light' | 'dark'
    /** 实际使用的主题 */
    effectiveTheme: 'light' | 'dark'
    /** 是否启用过渡动画 */
    enableTransitions: boolean
    /** 是否启用自动切换 */
    autoSwitch: boolean
    /** 自动切换时间配置 */
    autoSwitchTime: {
        lightTime: string
        darkTime: string
    }
    /** CSS 变量 */
    cssVariables: Partial<ThemeCSSVariables>
    /** 是否已初始化 */
    isInitialized: boolean
    /** 错误信息 */
    error: Error | null
    /** 事件监听器 */
    eventListeners: ThemeEventListener[]
    /** 系统主题监听器清理函数 */
    systemThemeCleanup: (() => void) | null

    // ==================== 计算属性 ====================
    /** 是否为深色主题 */
    isDark: () => boolean
    /** 是否为浅色主题 */
    isLight: () => boolean
    /** 是否使用系统主题 */
    isSystemTheme: () => boolean
    /** 获取主题配置 */
    getThemeConfig: () => ThemeConfiguration

    // ==================== 初始化 ====================
    /** 初始化主题 */
    initialize: () => void
    /** 清理资源 */
    cleanup: () => void

    // ==================== 主题管理 ====================
    /** 设置主题 */
    setTheme: (theme: ThemeMode) => void
    /** 切换主题 */
    toggleTheme: () => void
    /** 循环切换主题 (light -> dark -> system -> light) */
    cycleTheme: () => void
    /** 设置系统主题 */
    setSystemTheme: (theme: 'light' | 'dark') => void
    /** 应用主题到 DOM */
    applyTheme: (theme: 'light' | 'dark') => void
    /** 刷新当前主题 */
    refreshTheme: () => void

    // ==================== CSS 变量管理 ====================
    /** 更新 CSS 变量 */
    updateCSSVariables: (variables: Partial<ThemeCSSVariables>) => void
    /** 应用 CSS 变量到 DOM */
    applyCSSVariables: () => void
    /** 重置 CSS 变量 */
    resetCSSVariables: () => void

    // ==================== 自动切换 ====================
    /** 启用/禁用自动切换 */
    setAutoSwitch: (enabled: boolean) => void
    /** 设置自动切换时间 */
    setAutoSwitchTime: (lightTime: string, darkTime: string) => void
    /** 检查并应用自动切换 */
    checkAutoSwitch: () => void

    // ==================== 动画控制 ====================
    /** 启用/禁用过渡动画 */
    setEnableTransitions: (enabled: boolean) => void
    /** 临时禁用动画（用于初始化等场景） */
    withoutTransition: (callback: () => void) => void

    // ==================== 事件系统 ====================
    /** 添加事件监听器 */
    addEventListener: (listener: ThemeEventListener) => () => void
    /** 移除事件监听器 */
    removeEventListener: (listener: ThemeEventListener) => void
    /** 触发事件 */
    emitEvent: (event: ThemeEvent) => void

    // ==================== 工具方法 ====================
    /** 清除错误 */
    clearError: () => void
    /** 重置 Store */
    reset: () => void
}

// ==================== 默认值 ====================

/**
 * 默认 CSS 变量（浅色主题）
 */
const DEFAULT_LIGHT_CSS_VARIABLES: ThemeCSSVariables = {
    '--color-primary': '222.2 47.4% 11.2%',
    '--color-secondary': '210 40% 96.1%',
    '--color-background': '0 0% 100%',
    '--color-foreground': '222.2 47.4% 11.2%',
    '--color-card': '0 0% 100%',
    '--color-card-foreground': '222.2 47.4% 11.2%',
    '--color-popover': '0 0% 100%',
    '--color-popover-foreground': '222.2 47.4% 11.2%',
    '--color-muted': '210 40% 96.1%',
    '--color-muted-foreground': '215.4 16.3% 46.9%',
    '--color-accent': '210 40% 96.1%',
    '--color-accent-foreground': '222.2 47.4% 11.2%',
    '--color-destructive': '0 84.2% 60.2%',
    '--color-destructive-foreground': '210 40% 98%',
    '--color-border': '214.3 31.8% 91.4%',
    '--color-input': '214.3 31.8% 91.4%',
    '--color-ring': '222.2 47.4% 11.2%',
    '--radius-sm': '0.125rem',
    '--radius-md': '0.375rem',
    '--radius-lg': '0.5rem',
    '--spacing-xs': '0.25rem',
    '--spacing-sm': '0.5rem',
    '--spacing-md': '1rem',
    '--spacing-lg': '1.5rem',
    '--spacing-xl': '2rem',
    '--font-size-xs': '0.75rem',
    '--font-size-sm': '0.875rem',
    '--font-size-base': '1rem',
    '--font-size-lg': '1.125rem',
    '--font-size-xl': '1.25rem',
}

/**
 * 默认 CSS 变量（深色主题）
 */
const DEFAULT_DARK_CSS_VARIABLES: ThemeCSSVariables = {
    '--color-primary': '210 40% 98%',
    '--color-secondary': '217.2 32.6% 17.5%',
    '--color-background': '222.2 84% 4.9%',
    '--color-foreground': '210 40% 98%',
    '--color-card': '222.2 84% 4.9%',
    '--color-card-foreground': '210 40% 98%',
    '--color-popover': '222.2 84% 4.9%',
    '--color-popover-foreground': '210 40% 98%',
    '--color-muted': '217.2 32.6% 17.5%',
    '--color-muted-foreground': '215 20.2% 65.1%',
    '--color-accent': '217.2 32.6% 17.5%',
    '--color-accent-foreground': '210 40% 98%',
    '--color-destructive': '0 62.8% 30.6%',
    '--color-destructive-foreground': '210 40% 98%',
    '--color-border': '217.2 32.6% 17.5%',
    '--color-input': '217.2 32.6% 17.5%',
    '--color-ring': '212.7 26.8% 83.9%',
    '--radius-sm': '0.125rem',
    '--radius-md': '0.375rem',
    '--radius-lg': '0.5rem',
    '--spacing-xs': '0.25rem',
    '--spacing-sm': '0.5rem',
    '--spacing-md': '1rem',
    '--spacing-lg': '1.5rem',
    '--spacing-xl': '2rem',
    '--font-size-xs': '0.75rem',
    '--font-size-sm': '0.875rem',
    '--font-size-base': '1rem',
    '--font-size-lg': '1.125rem',
    '--font-size-xl': '1.25rem',
}

/**
 * 初始状态
 */
const INITIAL_STATE = {
    theme: 'system' as ThemeMode,
    systemTheme: 'light' as 'light' | 'dark',
    effectiveTheme: 'light' as 'light' | 'dark',
    enableTransitions: true,
    autoSwitch: false,
    autoSwitchTime: {
        lightTime: '06:00',
        darkTime: '18:00',
    },
    cssVariables: {},
    isInitialized: false,
    error: null,
    eventListeners: [],
    systemThemeCleanup: null,
}

// ==================== 辅助函数 ====================

/**
 * 检测系统主题
 */
const detectSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return 'light'
    }
    
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return isDark ? 'dark' : 'light'
}

/**
 * 监听系统主题变化
 */
const watchSystemTheme = (callback: (theme: 'light' | 'dark') => void): (() => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) {
        return () => {}
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
        callback(e.matches ? 'dark' : 'light')
    }

    // 立即执行一次
    handler(mediaQuery)

    // 监听变化
    try {
        mediaQuery.addEventListener('change', handler)
        return () => mediaQuery.removeEventListener('change', handler)
    } catch (e) {
        // 兼容旧版浏览器
        mediaQuery.addListener(handler)
        return () => mediaQuery.removeListener(handler)
    }
}

/**
 * 应用主题到 DOM
 */
const applyThemeToDOM = (theme: 'light' | 'dark', withTransition: boolean = true) => {
    if (typeof document === 'undefined') return

    const root = document.documentElement

    // 如果不需要过渡动画，临时移除过渡类
    if (!withTransition) {
        root.classList.add('no-transition')
    }

    // 移除旧主题，添加新主题
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    root.setAttribute('data-theme', theme)

    // 恢复过渡动画
    if (!withTransition) {
        // 强制浏览器重排，确保样式应用
        root.offsetHeight
        root.classList.remove('no-transition')
    }
}

/**
 * 应用 CSS 变量到 DOM
 */
const applyCSSVariablesToDOM = (variables: Partial<ThemeCSSVariables>) => {
    if (typeof document === 'undefined') return

    const root = document.documentElement

    Object.entries(variables).forEach(([key, value]) => {
        if (value !== undefined) {
            root.style.setProperty(key, value)
        }
    })
}

/**
 * 从 localStorage 加载主题
 */
const loadThemeFromStorage = (): ThemeMode => {
    if (typeof window === 'undefined') return 'system'

    try {
        const saved = localStorage.getItem('theme')
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
            return saved as ThemeMode
        }
    } catch (error) {
        console.error('加载主题失败:', error)
    }

    return 'system'
}

/**
 * 保存主题到 localStorage
 */
const saveThemeToStorage = (theme: ThemeMode) => {
    if (typeof window === 'undefined') return

    try {
        localStorage.setItem('theme', theme)
    } catch (error) {
        console.error('保存主题失败:', error)
    }
}

/**
 * 解析时间字符串（HH:MM）为分钟数
 */
const parseTimeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
}

/**
 * 获取当前时间的分钟数
 */
const getCurrentMinutes = (): number => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
}

/**
 * 根据时间判断应该使用哪个主题
 */
const getThemeByTime = (lightTime: string, darkTime: string): 'light' | 'dark' => {
    const currentMinutes = getCurrentMinutes()
    const lightMinutes = parseTimeToMinutes(lightTime)
    const darkMinutes = parseTimeToMinutes(darkTime)

    if (lightMinutes < darkMinutes) {
        // 例如: 06:00 - 18:00
        return currentMinutes >= lightMinutes && currentMinutes < darkMinutes ? 'light' : 'dark'
    } else {
        // 例如: 18:00 - 06:00 (跨天)
        return currentMinutes >= darkMinutes && currentMinutes < lightMinutes ? 'dark' : 'light'
    }
}

// ==================== Store 实现 ====================

/**
 * 主题状态管理 Store
 */
export const useThemeStore = create<ThemeStore>()(
    devtools(
        persist(
            subscribeWithSelector((set, get) => ({
                // ==================== 初始状态 ====================
                ...INITIAL_STATE,

                // ==================== 计算属性 ====================
                isDark: () => get().effectiveTheme === 'dark',

                isLight: () => get().effectiveTheme === 'light',

                isSystemTheme: () => get().theme === 'system',

                getThemeConfig: () => ({
                    mode: get().theme,
                    systemTheme: get().systemTheme,
                    effectiveTheme: get().effectiveTheme,
                    enableTransitions: get().enableTransitions,
                    autoSwitch: get().autoSwitch,
                    autoSwitchTime: get().autoSwitchTime,
                    cssVariables: get().cssVariables,
                }),

                // ==================== 初始化 ====================
                initialize: () => {
                    const state = get()
                    
                    // 避免重复初始化
                    if (state.isInitialized) return

                    try {
                        // 1. 加载保存的主题
                        const savedTheme = loadThemeFromStorage()
                        
                        // 2. 检测系统主题
                        const systemTheme = detectSystemTheme()
                        
                        // 3. 计算实际使用的主题
                        const effectiveTheme = savedTheme === 'system' ? systemTheme : savedTheme

                        // 4. 监听系统主题变化
                        const cleanup = watchSystemTheme((newSystemTheme) => {
                            const currentState = get()
                            
                            if (currentState.systemTheme !== newSystemTheme) {
                                set({ systemTheme: newSystemTheme })
                                
                                // 如果当前使用系统主题，更新实际主题
                                if (currentState.theme === 'system') {
                                    set({ effectiveTheme: newSystemTheme })
                                    get().applyTheme(newSystemTheme)
                                }

                                get().emitEvent({
                                    type: 'theme:system-changed',
                                    payload: { theme: newSystemTheme }
                                })
                            }
                        })

                        // 5. 应用主题（初始化时不使用过渡动画）
                        applyThemeToDOM(effectiveTheme, false)

                        // 6. 应用 CSS 变量
                        const defaultVariables = effectiveTheme === 'dark'
                            ? DEFAULT_DARK_CSS_VARIABLES
                            : DEFAULT_LIGHT_CSS_VARIABLES
                        
                        const cssVariables = { ...defaultVariables, ...state.cssVariables }
                        applyCSSVariablesToDOM(cssVariables)

                        // 7. 更新状态
                        set({
                            theme: savedTheme,
                            systemTheme,
                            effectiveTheme,
                            cssVariables,
                            isInitialized: true,
                            systemThemeCleanup: cleanup,
                        })

                        // 8. 如果启用了自动切换，检查并应用
                        if (state.autoSwitch) {
                            get().checkAutoSwitch()
                        }
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        console.error('主题初始化失败:', err)
                        set({ error: err, isInitialized: true })
                        
                        get().emitEvent({
                            type: 'theme:error',
                            payload: { error: err, context: 'initialize' }
                        })
                    }
                },

                cleanup: () => {
                    const { systemThemeCleanup } = get()
                    
                    if (systemThemeCleanup) {
                        systemThemeCleanup()
                        set({ systemThemeCleanup: null })
                    }
                },

                // ==================== 主题管理 ====================
                setTheme: (theme) => {
                    const oldTheme = get().theme
                    
                    if (oldTheme === theme) return

                    try {
                        // 1. 计算新的实际主题
                        const systemTheme = get().systemTheme
                        const effectiveTheme = theme === 'system' ? systemTheme : theme

                        // 2. 保存到 localStorage
                        saveThemeToStorage(theme)

                        // 3. 应用主题
                        get().applyTheme(effectiveTheme)

                        // 4. 更新状态
                        set({ theme, effectiveTheme })

                        // 5. 触发事件
                        get().emitEvent({
                            type: 'theme:changed',
                            payload: { from: oldTheme, to: theme }
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        
                        get().emitEvent({
                            type: 'theme:error',
                            payload: { error: err, context: 'setTheme' }
                        })
                    }
                },

                toggleTheme: () => {
                    const { theme } = get()
                    
                    // light <-> dark 切换（忽略 system）
                    if (theme === 'system') {
                        // 如果当前是 system，根据实际主题切换
                        const { effectiveTheme } = get()
                        get().setTheme(effectiveTheme === 'light' ? 'dark' : 'light')
                    } else if (theme === 'light') {
                        get().setTheme('dark')
                    } else {
                        get().setTheme('light')
                    }
                },

                cycleTheme: () => {
                    const { theme } = get()
                    
                    // light -> dark -> system -> light
                    if (theme === 'light') {
                        get().setTheme('dark')
                    } else if (theme === 'dark') {
                        get().setTheme('system')
                    } else {
                        get().setTheme('light')
                    }
                },

                setSystemTheme: (systemTheme) => {
                    const oldSystemTheme = get().systemTheme
                    
                    if (oldSystemTheme === systemTheme) return

                    set({ systemTheme })

                    // 如果当前使用系统主题，更新实际主题
                    if (get().theme === 'system') {
                        set({ effectiveTheme: systemTheme })
                        get().applyTheme(systemTheme)
                    }

                    get().emitEvent({
                        type: 'theme:system-changed',
                        payload: { theme: systemTheme }
                    })
                },

                applyTheme: (theme) => {
                    try {
                        const { enableTransitions } = get()
                        
                        // 应用主题到 DOM
                        applyThemeToDOM(theme, enableTransitions)

                        // 更新 CSS 变量
                        const defaultVariables = theme === 'dark'
                            ? DEFAULT_DARK_CSS_VARIABLES
                            : DEFAULT_LIGHT_CSS_VARIABLES
                        
                        const cssVariables = { ...defaultVariables, ...get().cssVariables }
                        applyCSSVariablesToDOM(cssVariables)

                        get().emitEvent({
                            type: 'theme:applied',
                            payload: { theme }
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        
                        get().emitEvent({
                            type: 'theme:error',
                            payload: { error: err, context: 'applyTheme' }
                        })
                    }
                },

                refreshTheme: () => {
                    const { effectiveTheme } = get()
                    get().applyTheme(effectiveTheme)
                },

                // ==================== CSS 变量管理 ====================
                updateCSSVariables: (variables) => {
                    try {
                        const newVariables = { ...get().cssVariables, ...variables }
                        
                        set({ cssVariables: newVariables })
                        applyCSSVariablesToDOM(variables)

                        get().emitEvent({
                            type: 'theme:css-updated',
                            payload: { variables }
                        })
                    } catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error))
                        set({ error: err })
                        
                        get().emitEvent({
                            type: 'theme:error',
                            payload: { error: err, context: 'updateCSSVariables' }
                        })
                    }
                },

                applyCSSVariables: () => {
                    const { cssVariables, effectiveTheme } = get()
                    
                    const defaultVariables = effectiveTheme === 'dark'
                        ? DEFAULT_DARK_CSS_VARIABLES
                        : DEFAULT_LIGHT_CSS_VARIABLES
                    
                    const variables = { ...defaultVariables, ...cssVariables }
                    applyCSSVariablesToDOM(variables)
                },

                resetCSSVariables: () => {
                    set({ cssVariables: {} })
                    get().applyCSSVariables()
                },

                // ==================== 自动切换 ====================
                setAutoSwitch: (enabled) => {
                    set({ autoSwitch: enabled })

                    if (enabled) {
                        get().checkAutoSwitch()
                    }
                },

                setAutoSwitchTime: (lightTime, darkTime) => {
                    set({
                        autoSwitchTime: { lightTime, darkTime }
                    })

                    if (get().autoSwitch) {
                        get().checkAutoSwitch()
                    }
                },

                checkAutoSwitch: () => {
                    const { autoSwitch, autoSwitchTime, theme } = get()
                    
                    if (!autoSwitch || theme === 'system') return

                    const targetTheme = getThemeByTime(
                        autoSwitchTime.lightTime,
                        autoSwitchTime.darkTime
                    )

                    if (targetTheme !== theme) {
                        get().setTheme(targetTheme)
                    }
                },

                // ==================== 动画控制 ====================
                setEnableTransitions: (enabled) => {
                    set({ enableTransitions: enabled })
                },

                withoutTransition: (callback) => {
                    const oldValue = get().enableTransitions
                    
                    set({ enableTransitions: false })
                    callback()
                    
                    // 使用 setTimeout 确保 DOM 更新后再恢复
                    setTimeout(() => {
                        set({ enableTransitions: oldValue })
                    }, 0)
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
                            console.error('主题事件监听器执行失败:', error)
                        }
                    }
                },

                // ==================== 工具方法 ====================
                clearError: () => {
                    set({ error: null })
                },

                reset: () => {
                    // 清理系统主题监听器
                    get().cleanup()

                    // 重置状态
                    set({
                        ...INITIAL_STATE,
                    })

                    // 重新初始化
                    get().initialize()
                },
            })),
            {
                name: 'theme-store',
                partialize: (state) => ({
                    theme: state.theme,
                    enableTransitions: state.enableTransitions,
                    autoSwitch: state.autoSwitch,
                    autoSwitchTime: state.autoSwitchTime,
                    cssVariables: state.cssVariables,
                }),
            }
        ),
        {
            name: 'ThemeStore',
            enabled: process.env.NODE_ENV === 'development',
        }
    )
)

// ==================== 导出辅助 Hooks ====================

/**
 * 获取主题模式的 Hook
 */
export const useThemeMode = () => {
    return useThemeStore((state) => ({
        theme: state.theme,
        systemTheme: state.systemTheme,
        effectiveTheme: state.effectiveTheme,
        setTheme: state.setTheme,
        toggleTheme: state.toggleTheme,
        cycleTheme: state.cycleTheme,
        isDark: state.isDark(),
        isLight: state.isLight(),
        isSystemTheme: state.isSystemTheme(),
    }))
}

/**
 * 获取主题配置的 Hook
 */
export const useThemeConfig = () => {
    return useThemeStore((state) => ({
        config: state.getThemeConfig(),
        cssVariables: state.cssVariables,
        updateCSSVariables: state.updateCSSVariables,
        resetCSSVariables: state.resetCSSVariables,
    }))
}

/**
 * 获取主题动画设置的 Hook
 */
export const useThemeTransitions = () => {
    return useThemeStore((state) => ({
        enableTransitions: state.enableTransitions,
        setEnableTransitions: state.setEnableTransitions,
        withoutTransition: state.withoutTransition,
    }))
}

/**
 * 获取主题自动切换设置的 Hook
 */
export const useThemeAutoSwitch = () => {
    return useThemeStore((state) => ({
        autoSwitch: state.autoSwitch,
        autoSwitchTime: state.autoSwitchTime,
        setAutoSwitch: state.setAutoSwitch,
        setAutoSwitchTime: state.setAutoSwitchTime,
        checkAutoSwitch: state.checkAutoSwitch,
    }))
}

export default useThemeStore

