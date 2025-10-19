/**
 * 主题预览组件
 * 
 * 功能特性：
 * - 👁️ 实时预览主题效果
 * - 🔄 多种预览模式（组件、页面、对比）
 * - 📱 响应式预览
 * - 🎨 完整的UI元素展示
 * - ⚡ 高性能渲染
 */

import React, { useMemo } from 'react'
import clsx from 'clsx'
import type { ThemeDetail, ThemeColors } from '@/types/theme'

/**
 * 组件属性
 */
export interface ThemePreviewProps {
    /** 主题数据 */
    theme: Partial<ThemeDetail>
    /** 预览模式 */
    mode?: 'components' | 'page' | 'compact'
    /** 是否显示标签 */
    showLabels?: boolean
    /** 自定义类名 */
    className?: string
    /** 点击回调 */
    onClick?: () => void
}

/**
 * 主题预览组件
 */
export const ThemePreview: React.FC<ThemePreviewProps> = ({
    theme,
    mode = 'components',
    showLabels = false,
    className,
    onClick
}) => {
    // ==================== 计算CSS变量 ====================
    
    const cssVariables = useMemo(() => {
        const colors = theme.variables?.colors
        if (!colors) return {}
        
        const vars: Record<string, string> = {}
        
        Object.entries(colors).forEach(([key, value]) => {
            if (value) {
                vars[`--color-${key}`] = value.hsl
                vars[`--color-${key}-rgb`] = value.rgb
            }
        })
        
        return vars
    }, [theme.variables?.colors])
    
    // ==================== 渲染不同模式 ====================
    
    if (mode === 'compact') {
        return (
            <div
                className={clsx(
                    'theme-preview-compact w-full h-24 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700',
                    onClick && 'cursor-pointer hover:border-primary-500 transition-colors',
                    className
                )}
                style={cssVariables as React.CSSProperties}
                onClick={onClick}
            >
                <div className="grid grid-cols-6 h-full">
                    <div style={{ backgroundColor: `hsl(var(--color-primary))` }} />
                    <div style={{ backgroundColor: `hsl(var(--color-secondary))` }} />
                    <div style={{ backgroundColor: `hsl(var(--color-accent))` }} />
                    <div style={{ backgroundColor: `hsl(var(--color-success))` }} />
                    <div style={{ backgroundColor: `hsl(var(--color-warning))` }} />
                    <div style={{ backgroundColor: `hsl(var(--color-destructive))` }} />
                </div>
            </div>
        )
    }
    
    if (mode === 'page') {
        return (
            <div
                className={clsx(
                    'theme-preview-page w-full rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-lg',
                    onClick && 'cursor-pointer hover:border-primary-500 transition-colors',
                    className
                )}
                style={cssVariables as React.CSSProperties}
                onClick={onClick}
            >
                {/* 模拟完整页面 */}
                <div style={{ backgroundColor: `hsl(var(--color-background))` }} className="p-6 min-h-[400px]">
                    {/* 头部导航 */}
                    <div
                        style={{ backgroundColor: `hsl(var(--color-card))` }}
                        className="rounded-lg p-4 mb-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div
                                    style={{ backgroundColor: `hsl(var(--color-primary))` }}
                                    className="w-10 h-10 rounded-full"
                                />
                                <div className="space-y-1">
                                    <div
                                        style={{ backgroundColor: `hsl(var(--color-foreground))`, opacity: 0.9 }}
                                        className="w-24 h-3 rounded"
                                    />
                                    <div
                                        style={{ backgroundColor: `hsl(var(--color-muted))` }}
                                        className="w-32 h-2 rounded"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <div
                                    style={{ backgroundColor: `hsl(var(--color-primary))` }}
                                    className="w-20 h-8 rounded"
                                />
                                <div
                                    style={{ backgroundColor: `hsl(var(--color-secondary))` }}
                                    className="w-20 h-8 rounded"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* 主内容区 */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* 卡片1 */}
                        <div
                            style={{ backgroundColor: `hsl(var(--color-card))` }}
                            className="rounded-lg p-4 shadow-sm"
                        >
                            <div
                                style={{ backgroundColor: `hsl(var(--color-accent))` }}
                                className="w-full h-24 rounded mb-3"
                            />
                            <div
                                style={{ backgroundColor: `hsl(var(--color-foreground))`, opacity: 0.9 }}
                                className="w-3/4 h-3 rounded mb-2"
                            />
                            <div
                                style={{ backgroundColor: `hsl(var(--color-muted))` }}
                                className="w-full h-2 rounded mb-1"
                            />
                            <div
                                style={{ backgroundColor: `hsl(var(--color-muted))` }}
                                className="w-2/3 h-2 rounded"
                            />
                        </div>
                        
                        {/* 卡片2 - 成功状态 */}
                        <div
                            style={{ backgroundColor: `hsl(var(--color-card))` }}
                            className="rounded-lg p-4 shadow-sm"
                        >
                            <div
                                style={{ backgroundColor: `hsl(var(--color-success))` }}
                                className="w-full h-24 rounded mb-3"
                            />
                            <div
                                style={{ backgroundColor: `hsl(var(--color-foreground))`, opacity: 0.9 }}
                                className="w-3/4 h-3 rounded mb-2"
                            />
                            <div
                                style={{ backgroundColor: `hsl(var(--color-muted))` }}
                                className="w-full h-2 rounded mb-1"
                            />
                            <div
                                style={{ backgroundColor: `hsl(var(--color-muted))` }}
                                className="w-2/3 h-2 rounded"
                            />
                        </div>
                        
                        {/* 卡片3 - 警告状态 */}
                        <div
                            style={{ backgroundColor: `hsl(var(--color-card))` }}
                            className="rounded-lg p-4 shadow-sm"
                        >
                            <div
                                style={{ backgroundColor: `hsl(var(--color-warning))` }}
                                className="w-full h-24 rounded mb-3"
                            />
                            <div
                                style={{ backgroundColor: `hsl(var(--color-foreground))`, opacity: 0.9 }}
                                className="w-3/4 h-3 rounded mb-2"
                            />
                            <div
                                style={{ backgroundColor: `hsl(var(--color-muted))` }}
                                className="w-full h-2 rounded mb-1"
                            />
                            <div
                                style={{ backgroundColor: `hsl(var(--color-muted))` }}
                                className="w-2/3 h-2 rounded"
                            />
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    
    // 默认：组件模式
    return (
        <div
            className={clsx(
                'theme-preview-components w-full rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700',
                onClick && 'cursor-pointer hover:border-primary-500 transition-colors',
                className
            )}
            style={cssVariables as React.CSSProperties}
            onClick={onClick}
        >
            <div style={{ backgroundColor: `hsl(var(--color-background))` }} className="p-6">
                {showLabels && (
                    <h3
                        style={{ color: `hsl(var(--color-foreground))` }}
                        className="text-lg font-semibold mb-4"
                    >
                        {theme.name || '主题预览'}
                    </h3>
                )}
                
                <div className="space-y-4">
                    {/* 按钮组 */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            style={{ backgroundColor: `hsl(var(--color-primary))`, color: `hsl(var(--color-background))` }}
                            className="px-4 py-2 rounded-md text-sm font-medium"
                        >
                            Primary
                        </button>
                        <button
                            style={{ backgroundColor: `hsl(var(--color-secondary))`, color: `hsl(var(--color-foreground))` }}
                            className="px-4 py-2 rounded-md text-sm font-medium"
                        >
                            Secondary
                        </button>
                        <button
                            style={{ backgroundColor: `hsl(var(--color-accent))`, color: `hsl(var(--color-background))` }}
                            className="px-4 py-2 rounded-md text-sm font-medium"
                        >
                            Accent
                        </button>
                    </div>
                    
                    {/* 状态按钮 */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            style={{ backgroundColor: `hsl(var(--color-success))`, color: 'white' }}
                            className="px-4 py-2 rounded-md text-sm font-medium"
                        >
                            ✓ Success
                        </button>
                        <button
                            style={{ backgroundColor: `hsl(var(--color-warning))`, color: 'white' }}
                            className="px-4 py-2 rounded-md text-sm font-medium"
                        >
                            ⚠ Warning
                        </button>
                        <button
                            style={{ backgroundColor: `hsl(var(--color-destructive))`, color: 'white' }}
                            className="px-4 py-2 rounded-md text-sm font-medium"
                        >
                            ✕ Error
                        </button>
                        <button
                            style={{ backgroundColor: `hsl(var(--color-info))`, color: 'white' }}
                            className="px-4 py-2 rounded-md text-sm font-medium"
                        >
                            ℹ Info
                        </button>
                    </div>
                    
                    {/* 卡片 */}
                    <div
                        style={{ backgroundColor: `hsl(var(--color-card))`, borderColor: `hsl(var(--color-border))` }}
                        className="p-4 rounded-lg border"
                    >
                        <h4
                            style={{ color: `hsl(var(--color-foreground))` }}
                            className="text-sm font-semibold mb-2"
                        >
                            Card Title
                        </h4>
                        <p
                            style={{ color: `hsl(var(--color-muted-foreground, var(--color-foreground)))` }}
                            className="text-sm opacity-70"
                        >
                            This is a card component with muted text color.
                        </p>
                    </div>
                    
                    {/* 输入框 */}
                    <div>
                        <input
                            type="text"
                            placeholder="Input field..."
                            style={{
                                backgroundColor: `hsl(var(--color-background))`,
                                borderColor: `hsl(var(--color-border))`,
                                color: `hsl(var(--color-foreground))`
                            }}
                            className="w-full px-3 py-2 rounded-md border text-sm"
                            readOnly
                        />
                    </div>
                    
                    {/* 文本示例 */}
                    <div className="space-y-2">
                        <p
                            style={{ color: `hsl(var(--color-foreground))` }}
                            className="text-sm"
                        >
                            Primary text color
                        </p>
                        <p
                            style={{ color: `hsl(var(--color-muted-foreground, var(--color-foreground)))` }}
                            className="text-sm opacity-70"
                        >
                            Secondary text color
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

/**
 * 对比预览组件
 */
export interface ThemeCompareProps {
    /** 主题A */
    themeA: Partial<ThemeDetail>
    /** 主题B */
    themeB: Partial<ThemeDetail>
    /** 自定义类名 */
    className?: string
}

export const ThemeCompare: React.FC<ThemeCompareProps> = ({
    themeA,
    themeB,
    className
}) => {
    return (
        <div className={clsx('theme-compare grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
            <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {themeA.name || '主题 A'}
                </h3>
                <ThemePreview theme={themeA} mode="components" />
            </div>
            <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {themeB.name || '主题 B'}
                </h3>
                <ThemePreview theme={themeB} mode="components" />
            </div>
        </div>
    )
}

export default ThemePreview

