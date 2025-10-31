/**
 * 主题提供者组件
 * 负责管理应用的主题状态和自动切换
 */

'use client'

import React, { useEffect, useMemo } from 'react'
import { useThemeStore, type Theme } from '@/infrastructure/store/themeStore'

/**
 * ThemeProvider Props
 */
interface ThemeProviderProps {
  /** 子组件 */
  children: React.ReactNode
  /** 默认主题 */
  defaultTheme?: Theme
  /** 强制主题（用于测试或特定场景） */
  forcedTheme?: Theme
  /** 是否启用主题切换动画 */
  enableTransitions?: boolean
  /** 存储键名（用于 localStorage） */
  storageKey?: string
  /** 主题切换时的回调 */
  onThemeChange?: (theme: Theme) => void
}

/**
 * 主题提供者组件
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  forcedTheme,
  enableTransitions = true,
  onThemeChange,
}: ThemeProviderProps) {
  const {
    theme,
    resolvedTheme,
    config,
    setTheme,
    updateConfig,
    setTransitioning,
    resolveTheme,
  } = useThemeStore()

  /**
   * 初始化主题
   */
  useEffect(() => {
    // 如果有强制主题，使用强制主题
    if (forcedTheme) {
      setTheme(forcedTheme)
      return
    }

    // 如果没有保存的主题，使用默认主题
    if (!theme) {
      setTheme(defaultTheme)
    }

    // 更新配置
    updateConfig({ enableTransitions })
  }, [forcedTheme, defaultTheme, enableTransitions])

  /**
   * 监听系统主题变化
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const systemTheme = e.matches ? 'dark' : 'light'
      resolveTheme(systemTheme)
    }

    // 初始解析
    handleChange(mediaQuery)

    // 监听变化
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [resolveTheme])

  /**
   * 应用主题到 DOM
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    const root = window.document.documentElement
    const body = window.document.body

    // 开始过渡
    if (config.enableTransitions) {
      setTransitioning(true)
    }

    // 移除所有主题类
    root.classList.remove('light', 'dark', 'anime', 'high-contrast', 'eye-care')
    body.classList.remove('light', 'dark', 'anime', 'high-contrast', 'eye-care')

    // 添加新主题类
    root.classList.add(resolvedTheme)
    body.classList.add(resolvedTheme)

    // 设置 data-theme 属性
    root.setAttribute('data-theme', resolvedTheme)

    // 设置 color-scheme
    root.style.colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light'

    // 触发主题变化回调
    if (onThemeChange) {
      onThemeChange(theme)
    }

    // 结束过渡
    if (config.enableTransitions) {
      const timer = setTimeout(() => {
        setTransitioning(false)
      }, 300)

      return () => clearTimeout(timer)
    }
    
    return undefined
  }, [resolvedTheme, theme, config.enableTransitions, onThemeChange])

  /**
   * 禁用过渡动画（用于页面加载时避免闪烁）
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 页面加载时临时禁用过渡
    const style = document.createElement('style')
    style.textContent = `
      * {
        -webkit-transition: none !important;
        -moz-transition: none !important;
        -o-transition: none !important;
        -ms-transition: none !important;
        transition: none !important;
      }
    `
    document.head.appendChild(style)

    // 页面加载完成后移除
    const timer = setTimeout(() => {
      document.head.removeChild(style)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  /**
   * 主题脚本（防止闪烁）
   * 这个脚本会在页面加载前执行
   */
  const themeScript = useMemo(() => {
    const script = `
      (function() {
        try {
          const storageKey = 'zishu-theme-storage';
          const stored = localStorage.getItem(storageKey);
          
          if (stored) {
            const { state } = JSON.parse(stored);
            const theme = state.theme || 'system';
            let resolvedTheme = theme;
            
            if (theme === 'system') {
              resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            
            document.documentElement.classList.add(resolvedTheme);
            document.documentElement.setAttribute('data-theme', resolvedTheme);
            document.documentElement.style.colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light';
          } else {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.classList.add(systemTheme);
            document.documentElement.setAttribute('data-theme', systemTheme);
            document.documentElement.style.colorScheme = systemTheme;
          }
        } catch (e) {
          console.error('Failed to load theme:', e);
        }
      })();
    `
    return script
  }, [])

  return (
    <>
      {/* 注入主题脚本以防止闪烁 */}
      <script
        dangerouslySetInnerHTML={{ __html: themeScript }}
        suppressHydrationWarning
      />
      {children}
    </>
  )
}

/**
 * 导出类型
 */
export type { ThemeProviderProps }

