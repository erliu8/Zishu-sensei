# 主题系统使用指南

## 📚 目录

- [概述](#概述)
- [可用主题](#可用主题)
- [快速开始](#快速开始)
- [主题配置](#主题配置)
- [自定义主题](#自定义主题)
- [API 参考](#api-参考)
- [最佳实践](#最佳实践)

## 概述

Zishu 社区平台的主题系统基于 CSS 变量和 Zustand 状态管理构建，提供：

- ✨ 6 种预设主题（亮色、暗色、系统、动漫、高对比度、护眼）
- 🎨 完全可定制的颜色方案
- 🌗 自动跟随系统主题
- 💫 流畅的主题切换动画
- ♿ 无障碍支持（高对比度、减少动画）
- 💾 主题设置持久化

## 可用主题

### 1. Light（亮色）

经典的亮色主题，适合白天使用。

```css
--primary: 221.2 83.2% 53.3%;
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
```

### 2. Dark（暗色）

护眼的暗色主题，适合夜间使用。

```css
--primary: 217.2 91.2% 59.8%;
--background: 222.2 84% 4.9%;
--foreground: 210 40% 98%;
```

### 3. System（跟随系统）

自动跟随操作系统的主题设置。

### 4. Anime（动漫风格）

可爱的动漫风格配色，使用粉色系。

```css
--primary: 350 100% 75%; /* 樱花粉 */
--secondary: 270 50% 70%; /* 薰衣草紫 */
--background: 330 100% 98%;
```

### 5. High Contrast（高对比度）

增强可访问性的高对比度主题。

```css
--primary: 240 100% 40%;
--background: 0 0% 100%;
--foreground: 0 0% 0%;
```

### 6. Eye Care（护眼模式）

温暖的护眼配色，长时间使用不疲劳。

```css
--primary: 30 50% 50%;
--background: 45 30% 92%; /* 米黄色 */
--foreground: 0 0% 20%;
```

## 快速开始

### 1. 在应用中集成 ThemeProvider

```tsx
// app/layout.tsx
import { ThemeProvider } from '@/infrastructure/providers/ThemeProvider'

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <ThemeProvider
          defaultTheme="system"
          enableTransitions={true}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### 2. 使用主题切换组件

```tsx
import { ThemeToggle } from '@/shared/components/common/ThemeToggle'

export function Header() {
  return (
    <header>
      <nav>
        {/* 其他导航项 */}
        <ThemeToggle />
      </nav>
    </header>
  )
}
```

### 3. 在组件中使用主题

```tsx
import { useTheme } from '@/infrastructure/hooks/useTheme'

export function MyComponent() {
  const { theme, resolvedTheme, setTheme, toggleTheme, isDark } = useTheme()
  
  return (
    <div>
      <p>当前主题: {theme}</p>
      <p>实际应用: {resolvedTheme}</p>
      <p>是否暗色: {isDark ? '是' : '否'}</p>
      
      <button onClick={toggleTheme}>
        切换主题
      </button>
      
      <button onClick={() => setTheme('anime')}>
        使用动漫主题
      </button>
    </div>
  )
}
```

## 主题配置

### ThemeProvider 配置选项

```tsx
<ThemeProvider
  defaultTheme="system"        // 默认主题
  forcedTheme="dark"           // 强制主题（用于特定页面）
  enableTransitions={true}     // 启用过渡动画
  onThemeChange={(theme) => {  // 主题变化回调
    console.log('主题已切换到:', theme)
  }}
>
  {children}
</ThemeProvider>
```

### 主题 Store 配置

```tsx
import { useThemeStore } from '@/infrastructure/store/themeStore'

// 更新主题配置
const updateConfig = useThemeStore((state) => state.updateConfig)

updateConfig({
  enableTransitions: true,
  followSystem: true,
  customColors: {
    primary: '350 100% 75%',
    secondary: '270 50% 70%',
  }
})
```

## 自定义主题

### 方式 1: 创建新的 CSS 主题文件

```css
/* src/styles/themes/custom.css */

[data-theme='my-theme'] {
  /* 主色调 */
  --primary: 280 100% 70%;
  --primary-foreground: 0 0% 100%;
  
  /* 背景 */
  --background: 0 0% 100%;
  --foreground: 0 0% 10%;
  
  /* 其他颜色... */
}
```

在 `globals.css` 中导入：

```css
@import './themes/custom.css';
```

### 方式 2: 使用 JavaScript 动态设置

```tsx
import { applyCustomThemeColors } from '@/infrastructure/utils/theme'

// 应用自定义颜色
applyCustomThemeColors({
  primary: '280 100% 70%',
  secondary: '200 80% 60%',
  accent: '160 90% 50%',
})
```

### 方式 3: 通过 Store 配置

```tsx
import { useThemeStore } from '@/infrastructure/store/themeStore'

const { updateConfig } = useThemeStore()

updateConfig({
  customColors: {
    primary: '280 100% 70%',
    secondary: '200 80% 60%',
  }
})
```

## API 参考

### useTheme Hook

```tsx
const {
  theme,              // 当前主题
  resolvedTheme,      // 实际应用的主题
  isDark,             // 是否暗色主题
  isLight,            // 是否亮色主题
  isSystem,           // 是否跟随系统
  isTransitioning,    // 是否正在切换
  setTheme,           // 设置主题
  toggleTheme,        // 切换主题
  enableTransitions,  // 启用过渡
  disableTransitions, // 禁用过渡
  getSystemTheme,     // 获取系统主题
} = useTheme()
```

### useSystemTheme Hook

```tsx
const systemTheme = useSystemTheme() // 'light' | 'dark'
```

### useThemeChange Hook

```tsx
useThemeChange((theme) => {
  console.log('主题已切换到:', theme)
  // 执行其他操作
})
```

### useThemeColor Hook

```tsx
const primaryColor = useThemeColor('primary') // 'hsl(221.2 83.2% 53.3%)'
```

### 主题工具函数

```tsx
import {
  getCSSVariable,           // 获取 CSS 变量
  setCSSVariable,           // 设置 CSS 变量
  getThemeColors,           // 获取所有主题颜色
  hslToRgb,                 // HSL 转 RGB
  rgbToHsl,                 // RGB 转 HSL
  getThemeLabel,            // 获取主题显示名称
  getThemeDescription,      // 获取主题描述
  supportsDarkMode,         // 检测暗色模式支持
  prefersReducedMotion,     // 检测动画偏好
  transitionTheme,          // 使用 View Transition API
  exportThemeConfig,        // 导出主题配置
  importThemeConfig,        // 导入主题配置
} from '@/infrastructure/utils/theme'
```

## 主题切换组件

### ThemeToggle - 下拉菜单样式

```tsx
<ThemeToggle 
  variant="ghost" 
  size="icon"
  showLabel={false}
  align="end"
/>
```

### SimpleThemeToggle - 简单切换按钮

```tsx
<SimpleThemeToggle variant="ghost" size="icon" />
```

### ThemeSwitch - 开关样式

```tsx
<ThemeSwitch />
```

### ThemeSelector - 网格选择器

```tsx
<ThemeSelector />
```

### ThemeSettings - 完整设置页面

```tsx
<ThemeSettings />
```

## 最佳实践

### 1. 使用语义化颜色

优先使用语义化的 CSS 变量而不是固定颜色：

```tsx
// ✅ 推荐
<div className="bg-primary text-primary-foreground">
  内容
</div>

// ❌ 不推荐
<div className="bg-blue-500 text-white">
  内容
</div>
```

### 2. 支持暗色模式图片

```tsx
// 为暗色模式特定的图片添加 data-no-invert 属性
<img 
  src="/logo.png" 
  alt="Logo"
  data-no-invert  // 防止暗色模式下调整亮度
/>
```

### 3. 避免硬编码颜色

```tsx
// ✅ 推荐
const primaryColor = useThemeColor('primary')

// ❌ 不推荐
const primaryColor = '#3b82f6'
```

### 4. 响应系统偏好

```tsx
const prefersReducedMotion = usePrefersReducedMotion()

<div className={prefersReducedMotion ? '' : 'animate-fade-in'}>
  内容
</div>
```

### 5. 主题切换时的优化

```tsx
// 禁用过渡以避免大量元素同时动画
import { transitionTheme } from '@/infrastructure/utils/theme'

const handleThemeChange = async () => {
  await transitionTheme(() => {
    setTheme('dark')
  })
}
```

### 6. SSR 注意事项

```tsx
// 使用 suppressHydrationWarning 避免服务端渲染警告
<html lang="zh-CN" suppressHydrationWarning>
  <body>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </body>
</html>
```

### 7. 测试主题

```tsx
// 测试时可以强制使用特定主题
<ThemeProvider forcedTheme="dark">
  {children}
</ThemeProvider>
```

## 颜色系统

所有主题颜色都使用 HSL 格式，便于调整：

```css
/* HSL 格式: 色相 饱和度 亮度 */
--primary: 221.2 83.2% 53.3%;

/* 使用时自动转换为 hsl() */
background-color: hsl(var(--primary));

/* 可以调整透明度 */
background-color: hsl(var(--primary) / 0.5);
```

## 无障碍支持

主题系统完全支持无障碍功能：

1. **键盘导航**: 所有主题切换组件支持键盘操作
2. **屏幕阅读器**: 提供适当的 ARIA 标签
3. **高对比度**: 专门的高对比度主题
4. **减少动画**: 响应 `prefers-reduced-motion`
5. **颜色对比**: 所有主题通过 WCAG AA 级别

## 性能优化

1. **CSS 变量**: 使用原生 CSS 变量，性能优秀
2. **延迟加载**: 主题 CSS 按需加载
3. **持久化**: 使用 localStorage 避免重复计算
4. **防闪烁**: 内联脚本在页面加载前应用主题
5. **过渡优化**: 可选的过渡动画，避免性能问题

## 故障排查

### 主题切换后样式未生效

检查 CSS 变量是否正确使用：

```css
/* ✅ 正确 */
background-color: hsl(var(--primary));

/* ❌ 错误 */
background-color: var(--primary);
```

### 页面加载时闪烁

确保 ThemeProvider 正确集成并使用 `suppressHydrationWarning`：

```tsx
<html suppressHydrationWarning>
  <body>
    <ThemeProvider>{children}</ThemeProvider>
  </body>
</html>
```

### 自定义主题未生效

确保 CSS 文件已导入到 `globals.css`：

```css
@import './themes/custom.css';
```

## 参考资源

- [Tailwind CSS 文档](https://tailwindcss.com)
- [Shadcn/ui 主题](https://ui.shadcn.com/docs/theming)
- [WCAG 无障碍指南](https://www.w3.org/WAI/WCAG21/quickref/)
- [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)

---

**更新日期**: 2025-10-23  
**维护者**: Zishu Frontend Team

