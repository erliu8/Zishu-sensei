/**
 * 主题 Hook
 * 提供主题相关的功能和工具函数
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useThemeStore, themeSelectors, type Theme, type ResolvedTheme } from '@/infrastructure/store/themeStore'

/**
 * 主题 Hook 返回值
 */
export interface UseThemeReturn {
  /** 当前主题 */
  theme: Theme
  /** 实际应用的主题 */
  resolvedTheme: ResolvedTheme
  /** 是否是暗色主题 */
  isDark: boolean
  /** 是否是亮色主题 */
  isLight: boolean
  /** 是否跟随系统 */
  isSystem: boolean
  /** 是否正在切换主题 */
  isTransitioning: boolean
  /** 设置主题 */
  setTheme: (theme: Theme) => void
  /** 切换主题 */
  toggleTheme: () => void
  /** 启用过渡动画 */
  enableTransitions: () => void
  /** 禁用过渡动画 */
  disableTransitions: () => void
  /** 获取系统主题 */
  getSystemTheme: () => 'light' | 'dark'
}

/**
 * 主题 Hook
 * 
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { theme, setTheme, toggleTheme, isDark } = useTheme()
 * 
 *   return (
 *     <button onClick={toggleTheme}>
 *       当前主题: {theme} ({isDark ? '暗色' : '亮色'})
 *     </button>
 *   )
 * }
 * ```
 */
export function useTheme(): UseThemeReturn {
  const store = useThemeStore()
  
  const theme = useThemeStore(themeSelectors.theme)
  const resolvedTheme = useThemeStore(themeSelectors.resolvedTheme)
  const isDark = useThemeStore(themeSelectors.isDark)
  const isLight = useThemeStore(themeSelectors.isLight)
  const isSystem = useThemeStore(themeSelectors.isSystem)
  const isTransitioning = useThemeStore(themeSelectors.isTransitioning)

  /**
   * 获取系统主题
   */
  const getSystemTheme = useCallback((): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }, [])

  /**
   * 启用过渡动画
   */
  const enableTransitions = useCallback(() => {
    store.updateConfig({ enableTransitions: true })
  }, [store])

  /**
   * 禁用过渡动画
   */
  const disableTransitions = useCallback(() => {
    store.updateConfig({ enableTransitions: false })
  }, [store])

  return {
    theme,
    resolvedTheme,
    isDark,
    isLight,
    isSystem,
    isTransitioning,
    setTheme: store.setTheme,
    toggleTheme: store.toggleTheme,
    enableTransitions,
    disableTransitions,
    getSystemTheme,
  }
}

/**
 * 监听系统主题变化 Hook
 * 
 * @example
 * ```tsx
 * function App() {
 *   const systemTheme = useSystemTheme()
 *   
 *   return <div>系统主题: {systemTheme}</div>
 * }
 * ```
 */
export function useSystemTheme(): 'light' | 'dark' {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    // 初始值
    handleChange(mediaQuery)

    // 监听变化
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return systemTheme
}

/**
 * 监听主题变化 Hook
 * 
 * @param callback - 主题变化时的回调函数
 * 
 * @example
 * ```tsx
 * function App() {
 *   useThemeChange((theme) => {
 *     console.log('主题已切换到:', theme)
 *     // 执行其他操作，如记录分析数据
 *   })
 *   
 *   return <div>App</div>
 * }
 * ```
 */
export function useThemeChange(callback: (theme: Theme) => void): void {
  const theme = useThemeStore(themeSelectors.theme)

  useEffect(() => {
    callback(theme)
  }, [theme, callback])
}

/**
 * 获取主题颜色值 Hook
 * 从 CSS 变量中读取主题颜色
 * 
 * @param colorVar - CSS 变量名（不含 --）
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const primaryColor = useThemeColor('primary')
 *   
 *   return <div style={{ color: primaryColor }}>文本</div>
 * }
 * ```
 */
export function useThemeColor(colorVar: string): string {
  const [color, setColor] = useState<string>('')
  const resolvedTheme = useThemeStore(themeSelectors.resolvedTheme)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = document.documentElement
    const value = getComputedStyle(root).getPropertyValue(`--${colorVar}`).trim()
    
    if (value) {
      // 如果是 HSL 格式，转换为完整的 hsl() 字符串
      if (value.includes(' ')) {
        setColor(`hsl(${value})`)
      } else {
        setColor(value)
      }
    }
  }, [colorVar, resolvedTheme])

  return color
}

/**
 * 媒体查询 Hook - 检测是否偏好暗色模式
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const prefersDark = usePrefersDark()
 *   
 *   return <div>用户偏好: {prefersDark ? '暗色' : '亮色'}</div>
 * }
 * ```
 */
export function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setPrefersDark(e.matches)
    }

    handleChange(mediaQuery)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return prefersDark
}

/**
 * 媒体查询 Hook - 检测是否偏好减少动画
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const prefersReducedMotion = usePrefersReducedMotion()
 *   
 *   return (
 *     <div className={prefersReducedMotion ? '' : 'animate-fade-in'}>
 *       内容
 *     </div>
 *   )
 * }
 * ```
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setPrefersReducedMotion(e.matches)
    }

    handleChange(mediaQuery)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return prefersReducedMotion
}

