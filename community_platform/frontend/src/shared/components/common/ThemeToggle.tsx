/**
 * 主题切换组件
 * 提供多种样式的主题切换按钮
 */

'use client'

import React from 'react'
import { Moon, Sun, Monitor, Sparkles, Eye, Contrast } from 'lucide-react'
import { useTheme } from '@/infrastructure/hooks/useTheme'
import { type Theme } from '@/infrastructure/store/themeStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/shared/components/ui/dropdown-menu'
import { Button } from '@/shared/components/ui/button'

/**
 * 主题选项配置
 */
const themeOptions: Array<{
  value: Theme
  label: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}> = [
  {
    value: 'light',
    label: '亮色',
    icon: Sun,
    description: '经典亮色主题',
  },
  {
    value: 'dark',
    label: '暗色',
    icon: Moon,
    description: '护眼暗色主题',
  },
  {
    value: 'system',
    label: '跟随系统',
    icon: Monitor,
    description: '自动跟随系统设置',
  },
  {
    value: 'anime',
    label: '动漫风格',
    icon: Sparkles,
    description: '可爱的动漫配色',
  },
  {
    value: 'high-contrast',
    label: '高对比度',
    icon: Contrast,
    description: '增强可访问性',
  },
  {
    value: 'eye-care',
    label: '护眼模式',
    icon: Eye,
    description: '舒适的护眼配色',
  },
]

/**
 * ThemeToggle Props
 */
interface ThemeToggleProps {
  /** 按钮变体 */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  /** 按钮大小 */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** 是否显示标签 */
  showLabel?: boolean
  /** 自定义类名 */
  className?: string
  /** 对齐方式 */
  align?: 'start' | 'center' | 'end'
}

/**
 * 主题切换组件 - 下拉菜单样式
 */
export function ThemeToggle({
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
  align = 'end',
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  // 获取当前主题图标
  const CurrentIcon = themeOptions.find((opt) => opt.value === theme)?.icon || Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          aria-label="切换主题"
        >
          <CurrentIcon className="h-5 w-5 transition-transform duration-300 hover:rotate-12" />
          {showLabel && <span className="ml-2">主题</span>}
          <span className="sr-only">切换主题</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel>选择主题</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* 常用主题 */}
        {themeOptions.slice(0, 3).map((option) => {
          const Icon = option.icon
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className="cursor-pointer"
            >
              <Icon className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </div>
              {theme === option.value && (
                <span className="ml-auto text-primary">✓</span>
              )}
            </DropdownMenuItem>
          )
        })}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>特殊主题</DropdownMenuLabel>

        {/* 特殊主题 */}
        {themeOptions.slice(3).map((option) => {
          const Icon = option.icon
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className="cursor-pointer"
            >
              <Icon className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span className="font-medium">{option.label}</span>
                {option.description && (
                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </div>
              {theme === option.value && (
                <span className="ml-auto text-primary">✓</span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * 简单的主题切换按钮 - 仅在 light 和 dark 之间切换
 */
export function SimpleThemeToggle({
  variant = 'ghost',
  size = 'icon',
  className,
}: Omit<ThemeToggleProps, 'showLabel' | 'align'>) {
  const { resolvedTheme, toggleTheme } = useTheme()

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={className}
      aria-label="切换主题"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-5 w-5 transition-transform duration-300 hover:rotate-90" />
      ) : (
        <Moon className="h-5 w-5 transition-transform duration-300 hover:-rotate-90" />
      )}
      <span className="sr-only">切换主题</span>
    </Button>
  )
}

/**
 * 主题切换开关组件 - 使用 Switch 样式
 */
export function ThemeSwitch() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{
        backgroundColor: isDark ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
      }}
      aria-label="切换主题"
      role="switch"
      aria-checked={isDark}
    >
      <span
        className="inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-lg transition-transform duration-200"
        style={{
          transform: isDark ? 'translateX(1.25rem)' : 'translateX(0.125rem)',
        }}
      >
        {isDark ? (
          <Moon className="h-3 w-3 text-primary" />
        ) : (
          <Sun className="h-3 w-3 text-muted-foreground" />
        )}
      </span>
    </button>
  )
}

/**
 * 主题选择器 - 网格布局
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {themeOptions.map((option) => {
        const Icon = option.icon
        const isActive = theme === option.value

        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={`
              group relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all
              ${
                isActive
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent'
              }
            `}
          >
            <Icon className="h-6 w-6 transition-transform group-hover:scale-110" />
            <span className="text-sm font-medium">{option.label}</span>
            {option.description && (
              <span className="text-xs text-muted-foreground text-center">
                {option.description}
              </span>
            )}
            {isActive && (
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-xs">✓</span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

