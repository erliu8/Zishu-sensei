import { ThemeContext } from '@/contexts/ThemeContext'
import type { ThemeMode } from '@/types/app'
import { useContext } from 'react'

/**
 * 主题 Hook 返回值
 */
interface UseThemeReturn {
    theme: ThemeMode
    systemTheme: 'light' | 'dark'
    effectiveTheme: 'light' | 'dark'
    setTheme: (theme: ThemeMode) => void
    toggleTheme: () => void
    isDark: boolean
    isLight: boolean
    isSystem: boolean
}

/**
 * 主题管理 Hook
 */
export const useTheme = (): UseThemeReturn => {
    const context = useContext(ThemeContext)

    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }

    const { theme, systemTheme, setTheme } = context

    // 计算实际使用的主题
    const effectiveTheme = theme === 'system' ? systemTheme : theme

    // 切换主题
    const toggleTheme = () => {
        if (theme === 'system') {
            setTheme('light')
        } else if (theme === 'light') {
            setTheme('dark')
        } else {
            setTheme('light')
        }
    }

    return {
        theme,
        systemTheme,
        effectiveTheme,
        setTheme,
        toggleTheme,
        isDark: effectiveTheme === 'dark',
        isLight: effectiveTheme === 'light',
        isSystem: theme === 'system',
    }
}