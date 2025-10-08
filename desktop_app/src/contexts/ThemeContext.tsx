import type { ThemeMode } from '@/types/app'
import React, { createContext, useCallback, useEffect, useState } from 'react'

/**
 * 主题上下文类型
 */
interface ThemeContextType {
    theme: ThemeMode
    systemTheme: 'light' | 'dark'
    setTheme: (theme: ThemeMode) => void
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
    defaultTheme?: ThemeMode
}

/**
 * 主题提供者组件
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
    children,
    defaultTheme = 'system',
}) => {
    const [theme, setThemeState] = useState<ThemeMode>(defaultTheme)
    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')

    // 检测系统主题
    const detectSystemTheme = useCallback(() => {
        if (typeof window !== 'undefined' && window.matchMedia) {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            setSystemTheme(isDark ? 'dark' : 'light')
        }
    }, [])

    // 设置主题
    const setTheme = useCallback((newTheme: ThemeMode) => {
        setThemeState(newTheme)

        // 保存到 localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem('theme', newTheme)
        }
    }, [])

    // 应用主题到 DOM
    const applyTheme = useCallback((effectiveTheme: 'light' | 'dark') => {
        if (typeof document !== 'undefined') {
            const root = document.documentElement
            root.classList.remove('light', 'dark')
            root.classList.add(effectiveTheme)
            root.setAttribute('data-theme', effectiveTheme)
        }
    }, [])

    // 初始化主题
    useEffect(() => {
        // 从 localStorage 读取保存的主题
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme') as ThemeMode
            if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
                setThemeState(savedTheme)
            }
        }

        // 检测系统主题
        detectSystemTheme()
    }, [detectSystemTheme])

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

    // 应用有效主题
    useEffect(() => {
        const effectiveTheme = theme === 'system' ? systemTheme : theme
        applyTheme(effectiveTheme)
    }, [theme, systemTheme, applyTheme])

    const contextValue: ThemeContextType = {
        theme,
        systemTheme,
        setTheme,
    }

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    )
}