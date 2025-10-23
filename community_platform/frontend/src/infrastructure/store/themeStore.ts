/**
 * 主题状态管理 Store
 * 使用 Zustand 管理主题状态，支持持久化到 localStorage
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * 主题类型定义
 */
export type Theme = 'light' | 'dark' | 'system' | 'anime' | 'high-contrast' | 'eye-care'

/**
 * 实际应用的主题（排除 system）
 */
export type ResolvedTheme = Exclude<Theme, 'system'>

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  /** 是否启用主题切换动画 */
  enableTransitions: boolean
  /** 是否跟随系统主题 */
  followSystem: boolean
  /** 自定义主题颜色（可选） */
  customColors?: {
    primary?: string
    secondary?: string
    accent?: string
  }
}

/**
 * 主题状态接口
 */
interface ThemeState {
  /** 当前主题 */
  theme: Theme
  /** 实际应用的主题 */
  resolvedTheme: ResolvedTheme
  /** 主题配置 */
  config: ThemeConfig
  /** 是否正在切换主题 */
  isTransitioning: boolean
}

/**
 * 主题操作接口
 */
interface ThemeActions {
  /** 设置主题 */
  setTheme: (theme: Theme) => void
  /** 切换主题（在 light 和 dark 之间） */
  toggleTheme: () => void
  /** 更新主题配置 */
  updateConfig: (config: Partial<ThemeConfig>) => void
  /** 设置过渡状态 */
  setTransitioning: (isTransitioning: boolean) => void
  /** 根据系统主题解析当前主题 */
  resolveTheme: (systemTheme: 'light' | 'dark') => void
}

/**
 * 主题 Store 类型
 */
export type ThemeStore = ThemeState & ThemeActions

/**
 * 默认主题配置
 */
const defaultConfig: ThemeConfig = {
  enableTransitions: true,
  followSystem: true,
}

/**
 * 获取系统主题
 */
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * 解析主题（将 system 转换为实际主题）
 */
const resolveThemeValue = (theme: Theme, systemTheme: 'light' | 'dark'): ResolvedTheme => {
  if (theme === 'system') {
    return systemTheme
  }
  return theme as ResolvedTheme
}

/**
 * 主题状态管理 Store
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      // 状态
      theme: 'system',
      resolvedTheme: 'light',
      config: defaultConfig,
      isTransitioning: false,

      // 操作
      setTheme: (theme: Theme) => {
        const systemTheme = getSystemTheme()
        const resolvedTheme = resolveThemeValue(theme, systemTheme)

        set({
          theme,
          resolvedTheme,
        })
      },

      toggleTheme: () => {
        const { theme, resolvedTheme } = get()
        
        // 如果当前是 system，则切换到相反的主题
        if (theme === 'system') {
          const newTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark'
          get().setTheme(newTheme)
        } else {
          // 在 light 和 dark 之间切换
          const newTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark'
          get().setTheme(newTheme)
        }
      },

      updateConfig: (config: Partial<ThemeConfig>) => {
        set((state) => ({
          config: {
            ...state.config,
            ...config,
          },
        }))
      },

      setTransitioning: (isTransitioning: boolean) => {
        set({ isTransitioning })
      },

      resolveTheme: (systemTheme: 'light' | 'dark') => {
        const { theme } = get()
        const resolvedTheme = resolveThemeValue(theme, systemTheme)
        set({ resolvedTheme })
      },
    }),
    {
      name: 'zishu-theme-storage',
      storage: createJSONStorage(() => localStorage),
      // 只持久化部分状态
      partialize: (state) => ({
        theme: state.theme,
        config: state.config,
      }),
    }
  )
)

/**
 * 主题 Store 选择器
 */
export const themeSelectors = {
  /** 获取当前主题 */
  theme: (state: ThemeStore) => state.theme,
  /** 获取实际应用的主题 */
  resolvedTheme: (state: ThemeStore) => state.resolvedTheme,
  /** 获取主题配置 */
  config: (state: ThemeStore) => state.config,
  /** 是否正在切换主题 */
  isTransitioning: (state: ThemeStore) => state.isTransitioning,
  /** 是否是暗色主题 */
  isDark: (state: ThemeStore) => state.resolvedTheme === 'dark',
  /** 是否是亮色主题 */
  isLight: (state: ThemeStore) => state.resolvedTheme === 'light',
  /** 是否跟随系统 */
  isSystem: (state: ThemeStore) => state.theme === 'system',
}

