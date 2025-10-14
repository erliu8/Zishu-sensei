import React, { createContext, useCallback, useEffect, useState } from 'react'
import {
    ThemeName,
    ThemeConfig,
    getThemeManager,
    THEMES,
} from '@/styles/themes'

/**
 * 主题上下文类型
 */
interface ThemeContextType {
    /** 当前主题名称 */
    theme: ThemeName
    /** 当前主题配置 */
    themeConfig: ThemeConfig
    /** 系统主题偏好 */
    systemTheme: 'light' | 'dark'
    /** 设置主题 */
    setTheme: (theme: ThemeName) => void
    /** 切换深色/浅色主题 */
    toggleTheme: () => void
    /** 是否为深色主题 */
    isDark: boolean
    /** 所有可用主题 */
    allThemes: ThemeConfig[]
    /** 重置为系统主题 */
    resetToSystemTheme: () => void
}

/**
 * 主题上下文
 */
export const ThemeContext = createContext<ThemeContextType | null>(null)

/**
 * 主题提供者属性
 */
interface ThemeProviderProps {
    children: React.ReactNode
    defaultTheme?: ThemeName
}

/**
 * 主题提供者组件
 * 集成新的主题管理系统，支持 light、dark、anime、cyberpunk 等主题
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
    children,
    defaultTheme,
}) => {
    const manager = getThemeManager()
    
    const [theme, setThemeState] = useState<ThemeName>(() => 
        defaultTheme || manager.getTheme()
    )
    const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() =>
        THEMES[theme]
    )
    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')

    // 检测系统主题
    const detectSystemTheme = useCallback(() => {
        if (typeof window !== 'undefined' && window.matchMedia) {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            setSystemTheme(isDark ? 'dark' : 'light')
        }
    }, [])

    // 设置主题
    const setTheme = useCallback((newTheme: ThemeName) => {
        manager.setTheme(newTheme)
    }, [manager])

    // 切换主题
    const toggleTheme = useCallback(() => {
        manager.toggleTheme()
    }, [manager])

    // 重置为系统主题
    const resetToSystemTheme = useCallback(() => {
        manager.resetToSystemTheme()
    }, [manager])

    // 初始化主题
    useEffect(() => {
        // 如果提供了默认主题，应用它
        if (defaultTheme) {
            manager.setTheme(defaultTheme)
        }

        // 检测系统主题
        detectSystemTheme()

        // 订阅主题变化
        const unsubscribe = manager.subscribe((newTheme) => {
            setThemeState(newTheme)
            setThemeConfig(THEMES[newTheme])
        })

        return () => unsubscribe()
    }, [manager, defaultTheme, detectSystemTheme])

    // 监听系统主题变化
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

        const handleChange = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light')
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [])

    const contextValue: ThemeContextType = {
        theme,
        themeConfig,
        systemTheme,
        setTheme,
        toggleTheme,
        isDark: themeConfig.isDark,
        allThemes: Object.values(THEMES),
        resetToSystemTheme,
    }

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    )
}

/**
 * useTheme Hook - 使用主题上下文
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, setTheme, isDark } = useThemeContext();
 *   
 *   return (
 *     <div>
 *       <p>Current theme: {theme}</p>
 *       <button onClick={() => setTheme('anime')}>
 *         Switch to Anime Theme
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useThemeContext = (): ThemeContextType => {
    const context = React.useContext(ThemeContext)
    if (!context) {
        throw new Error('useThemeContext must be used within a ThemeProvider')
    }
    return context
}