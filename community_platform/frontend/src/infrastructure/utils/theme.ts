/**
 * 主题工具函数
 * 提供主题相关的辅助功能
 */

import { type Theme, type ResolvedTheme } from '@/infrastructure/store/themeStore'

/**
 * 主题颜色配置
 */
export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
  muted: string
  border: string
  destructive: string
  success: string
  warning: string
  error: string
  info: string
}

/**
 * 从 DOM 中获取 CSS 变量值
 * 
 * @param variable - CSS 变量名（不含 --）
 * @param element - 要查询的元素，默认为 documentElement
 * @returns CSS 变量的值
 */
export function getCSSVariable(
  variable: string,
  element: HTMLElement = document.documentElement
): string {
  return getComputedStyle(element).getPropertyValue(`--${variable}`).trim()
}

/**
 * 设置 CSS 变量值
 * 
 * @param variable - CSS 变量名（不含 --）
 * @param value - 要设置的值
 * @param element - 要设置的元素，默认为 documentElement
 */
export function setCSSVariable(
  variable: string,
  value: string,
  element: HTMLElement = document.documentElement
): void {
  element.style.setProperty(`--${variable}`, value)
}

/**
 * 获取当前主题的所有颜色
 * 
 * @returns 主题颜色对象
 */
export function getThemeColors(): ThemeColors {
  return {
    primary: getCSSVariable('primary'),
    secondary: getCSSVariable('secondary'),
    accent: getCSSVariable('accent'),
    background: getCSSVariable('background'),
    foreground: getCSSVariable('foreground'),
    muted: getCSSVariable('muted'),
    border: getCSSVariable('border'),
    destructive: getCSSVariable('destructive'),
    success: getCSSVariable('success'),
    warning: getCSSVariable('warning'),
    error: getCSSVariable('error'),
    info: getCSSVariable('info'),
  }
}

/**
 * 将 HSL 字符串转换为 RGB
 * 
 * @param hsl - HSL 字符串，格式如 "221.2 83.2% 53.3%"
 * @returns RGB 对象
 */
export function hslToRgb(hsl: string): { r: number; g: number; b: number } {
  const [h, s, l] = hsl.split(' ').map((v) => parseFloat(v))
  const sNorm = s / 100
  const lNorm = l / 100

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2

  let r = 0,
    g = 0,
    b = 0

  if (h >= 0 && h < 60) {
    r = c
    g = x
    b = 0
  } else if (h >= 60 && h < 120) {
    r = x
    g = c
    b = 0
  } else if (h >= 120 && h < 180) {
    r = 0
    g = c
    b = x
  } else if (h >= 180 && h < 240) {
    r = 0
    g = x
    b = c
  } else if (h >= 240 && h < 300) {
    r = x
    g = 0
    b = c
  } else if (h >= 300 && h < 360) {
    r = c
    g = 0
    b = x
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

/**
 * 将 RGB 转换为 HSL 字符串
 * 
 * @param r - 红色值 (0-255)
 * @param g - 绿色值 (0-255)
 * @param b - 蓝色值 (0-255)
 * @returns HSL 字符串，格式如 "221.2 83.2% 53.3%"
 */
export function rgbToHsl(r: number, g: number, b: number): string {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6
  } else {
    h = ((r - g) / d + 4) / 6
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

/**
 * 获取主题的显示名称
 * 
 * @param theme - 主题值
 * @returns 主题的显示名称
 */
export function getThemeLabel(theme: Theme): string {
  const labels: Record<Theme, string> = {
    light: '亮色',
    dark: '暗色',
    system: '跟随系统',
    anime: '动漫风格',
    'high-contrast': '高对比度',
    'eye-care': '护眼模式',
  }
  return labels[theme] || theme
}

/**
 * 获取主题的描述
 * 
 * @param theme - 主题值
 * @returns 主题的描述
 */
export function getThemeDescription(theme: Theme): string {
  const descriptions: Record<Theme, string> = {
    light: '经典的亮色主题，适合白天使用',
    dark: '护眼的暗色主题，适合夜间使用',
    system: '自动跟随系统主题设置',
    anime: '可爱的动漫风格配色',
    'high-contrast': '高对比度主题，增强可访问性',
    'eye-care': '舒适的护眼配色，长时间使用不疲劳',
  }
  return descriptions[theme] || ''
}

/**
 * 检测系统是否支持暗色模式
 * 
 * @returns 是否支持暗色模式
 */
export function supportsDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * 检测系统是否偏好减少动画
 * 
 * @returns 是否偏好减少动画
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 检测系统是否偏好高对比度
 * 
 * @returns 是否偏好高对比度
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: high)').matches
}

/**
 * 生成主题预览图的数据 URL
 * 
 * @param theme - 主题
 * @returns Canvas 数据 URL
 */
export function generateThemePreview(theme: ResolvedTheme): string {
  if (typeof document === 'undefined') return ''

  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 120
  const ctx = canvas.getContext('2d')

  if (!ctx) return ''

  // 这里可以根据主题绘制预览图
  // 简化实现：返回纯色
  const themeColors: Record<ResolvedTheme, string> = {
    light: '#ffffff',
    dark: '#0f172a',
    anime: '#fff0f9',
    'high-contrast': '#ffffff',
    'eye-care': '#f5f1e8',
  }

  ctx.fillStyle = themeColors[theme] || '#ffffff'
  ctx.fillRect(0, 0, 200, 120)

  return canvas.toDataURL()
}

/**
 * 应用自定义主题颜色
 * 
 * @param colors - 自定义颜色对象
 */
export function applyCustomThemeColors(colors: Partial<ThemeColors>): void {
  Object.entries(colors).forEach(([key, value]) => {
    if (value) {
      setCSSVariable(key, value)
    }
  })
}

/**
 * 重置主题颜色为默认值
 */
export function resetThemeColors(): void {
  const root = document.documentElement
  const variables = [
    'primary',
    'secondary',
    'accent',
    'background',
    'foreground',
    'muted',
    'border',
    'destructive',
    'success',
    'warning',
    'error',
    'info',
  ]

  variables.forEach((variable) => {
    root.style.removeProperty(`--${variable}`)
  })
}

/**
 * 使用 View Transition API 切换主题（如果支持）
 * 
 * @param callback - 切换主题的回调函数
 */
export async function transitionTheme(callback: () => void): Promise<void> {
  // 检查是否支持 View Transition API
  if (
    typeof document === 'undefined' ||
    !('startViewTransition' in document)
  ) {
    callback()
    return
  }

  // 使用 View Transition API
  const transition = (document as any).startViewTransition(() => {
    callback()
  })

  await transition.finished
}

/**
 * 导出主题配置为 JSON
 * 
 * @returns 主题配置 JSON 字符串
 */
export function exportThemeConfig(): string {
  const colors = getThemeColors()
  return JSON.stringify(colors, null, 2)
}

/**
 * 从 JSON 导入主题配置
 * 
 * @param json - 主题配置 JSON 字符串
 */
export function importThemeConfig(json: string): void {
  try {
    const colors = JSON.parse(json) as Partial<ThemeColors>
    applyCustomThemeColors(colors)
  } catch (error) {
    console.error('Failed to import theme config:', error)
  }
}

