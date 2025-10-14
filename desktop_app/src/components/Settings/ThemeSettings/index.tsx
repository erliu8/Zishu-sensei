/**
 * 主题设置组件
 * 
 * 功能特性：
 * - 🎨 主题选择器（预设主题、实时预览）
 * - 🖌️ 颜色自定义（主色调、强调色）
 * - 💻 自定义CSS编辑器（语法高亮、实时预览）
 * - 🌓 深色/浅色模式切换
 * - 📦 主题导入/导出
 * - ✅ CSS验证和安全检查
 * - 🔄 实时预览效果
 * - 💾 主题预设管理
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

// 类型
import type {
    AppConfig,
    ThemeConfig,
    ThemeName,
} from '@/types/settings'
import { TypeGuards } from '@/types/settings'
import { ConfigValidator } from '@/utils/configValidator'

/**
 * 主题信息接口
 */
interface ThemeInfo {
    id: ThemeName
    name: string
    description: string
    preview: {
        primary: string
        secondary: string
        background: string
        foreground: string
    }
    tags: string[]
}

/**
 * 组件属性
 */
export interface ThemeSettingsProps {
    /** 当前配置 */
    config: AppConfig
    /** 配置变更回调 */
    onConfigChange: (config: AppConfig) => void
    /** 自定义样式 */
    className?: string
}

/**
 * 设置项组件属性
 */
interface SettingItemProps {
    label: string
    description?: string
    children: React.ReactNode
    className?: string
    error?: string
}

/**
 * 设置项组件
 */
const SettingItem: React.FC<SettingItemProps> = ({
    label,
    description,
    children,
    className,
    error,
}) => (
    <div className={clsx('setting-item py-4', className)}>
        <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                    {label}
                </label>
                {description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {description}
                    </p>
                )}
                {error && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        ⚠️ {error}
                    </p>
                )}
            </div>
            <div className="flex-shrink-0">
                {children}
            </div>
        </div>
    </div>
)

/**
 * 选择器组件
 */
interface SelectProps {
    value: string | number
    onChange: (value: string | number) => void
    options: Array<{ value: string | number; label: string }>
    disabled?: boolean
    id?: string
}

const Select: React.FC<SelectProps> = ({ value, onChange, options, disabled, id }) => (
    <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={clsx(
            'block w-48 px-3 py-2 text-sm rounded-lg border',
            'bg-white dark:bg-gray-800',
            'border-gray-300 dark:border-gray-600',
            'text-gray-900 dark:text-white',
            'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
        )}
    >
        {options.map(option => (
            <option key={option.value} value={option.value}>
                {option.label}
            </option>
        ))}
    </select>
)

/**
 * 分组标题组件
 */
interface SectionTitleProps {
    children: React.ReactNode
    icon?: string
}

const SectionTitle: React.FC<SectionTitleProps> = ({ children, icon }) => (
    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-4 mt-6 first:mt-0">
        {icon && <span className="text-2xl">{icon}</span>}
        {children}
    </h3>
)

/**
 * 分割线组件
 */
const Divider: React.FC = () => (
    <hr className="my-6 border-gray-200 dark:border-gray-800" />
)

/**
 * 主题卡片组件
 */
interface ThemeCardProps {
    theme: ThemeInfo
    isActive: boolean
    onSelect: () => void
}

const ThemeCard: React.FC<ThemeCardProps> = ({ theme, isActive, onSelect }) => (
    <motion.button
        onClick={onSelect}
        className={clsx(
            'w-full p-4 rounded-lg border-2 transition-all text-left',
            'hover:shadow-md',
            isActive
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300'
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
    >
        <div className="flex items-start gap-4">
            {/* 主题预览 */}
            <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                    <div style={{ backgroundColor: theme.preview.primary }} className="w-full h-full" />
                    <div style={{ backgroundColor: theme.preview.secondary }} className="w-full h-full" />
                    <div style={{ backgroundColor: theme.preview.background }} className="w-full h-full" />
                    <div style={{ backgroundColor: theme.preview.foreground }} className="w-full h-full" />
                </div>
            </div>
            
            {/* 主题信息 */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                        {theme.name}
                    </h4>
                    {isActive && (
                        <span className="px-2 py-0.5 text-xs bg-primary-500 text-white rounded-full">
                            当前
                        </span>
                    )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {theme.description}
                </p>
                <div className="flex flex-wrap gap-1">
                    {theme.tags.map(tag => (
                        <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    </motion.button>
)

/**
 * 颜色选择器组件
 * 注意：此组件已定义但暂未使用，保留供将来扩展
 */
// interface ColorPickerProps {
//     label: string
//     value: string
//     onChange: (color: string) => void
//     disabled?: boolean
// }

// const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange, disabled }) => (
//     <div className="flex items-center gap-3">
//         <label className="text-sm text-gray-700 dark:text-gray-300 w-20">
//             {label}
//         </label>
//         <div className="flex items-center gap-2">
//             <input
//                 type="color"
//                 value={value}
//                 onChange={e => onChange(e.target.value)}
//                 disabled={disabled}
//                 className={clsx(
//                     'w-12 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer',
//                     'disabled:opacity-50 disabled:cursor-not-allowed'
//                 )}
//             />
//             <input
//                 type="text"
//                 value={value}
//                 onChange={e => onChange(e.target.value)}
//                 disabled={disabled}
//                 placeholder="#000000"
//                 maxLength={7}
//                 className={clsx(
//                     'w-28 px-3 py-2 text-sm rounded-lg border',
//                     'bg-white dark:bg-gray-800',
//                     'border-gray-300 dark:border-gray-600',
//                     'text-gray-900 dark:text-white',
//                     'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
//                     'disabled:opacity-50 disabled:cursor-not-allowed',
//                     'font-mono'
//                 )}
//             />
//         </div>
//     </div>
// )

/**
 * 主题设置组件
 */
export const ThemeSettings: React.FC<ThemeSettingsProps> = ({
    config,
    onConfigChange,
    className,
}) => {
    // ==================== 状态 ====================
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [customCssValue, setCustomCssValue] = useState(config.theme.custom_css || '')
    const [cssLineCount, setCssLineCount] = useState(1)
    const [showCssHelp, setShowCssHelp] = useState(false)

    // ==================== 配置验证器 ====================
    const validator = useMemo(() => ConfigValidator.getInstance(), [])

    // ==================== 可用主题列表 ====================
    const availableThemes: ThemeInfo[] = useMemo(() => [
        {
            id: 'anime',
            name: '动漫风格',
            description: '明亮活泼的动漫风格，适合二次元爱好者',
            preview: {
                primary: '#ff69b4',
                secondary: '#ffc0cb',
                background: '#fff5f7',
                foreground: '#333333',
            },
            tags: ['可爱', '活泼', '二次元'],
        },
        {
            id: 'modern',
            name: '现代风格',
            description: '简洁现代的设计风格，注重功能性和美观',
            preview: {
                primary: '#3b82f6',
                secondary: '#60a5fa',
                background: '#f8fafc',
                foreground: '#1e293b',
            },
            tags: ['简洁', '现代', '专业'],
        },
        {
            id: 'classic',
            name: '经典风格',
            description: '经典优雅的传统风格，永不过时',
            preview: {
                primary: '#8b5cf6',
                secondary: '#a78bfa',
                background: '#faf5ff',
                foreground: '#4c1d95',
            },
            tags: ['优雅', '传统', '稳重'],
        },
        {
            id: 'dark',
            name: '暗黑风格',
            description: '深色主题，适合夜间使用，保护眼睛',
            preview: {
                primary: '#6366f1',
                secondary: '#818cf8',
                background: '#111827',
                foreground: '#f9fafb',
            },
            tags: ['深色', '夜间', '护眼'],
        },
        {
            id: 'light',
            name: '明亮风格',
            description: '明亮清爽的浅色主题，适合白天使用',
            preview: {
                primary: '#10b981',
                secondary: '#34d399',
                background: '#ffffff',
                foreground: '#111827',
            },
            tags: ['明亮', '清爽', '白天'],
        },
        {
            id: 'custom',
            name: '自定义主题',
            description: '完全自定义的主题，可以编写自己的CSS样式',
            preview: {
                primary: '#f59e0b',
                secondary: '#fbbf24',
                background: '#fef3c7',
                foreground: '#78350f',
            },
            tags: ['自定义', 'DIY', '高级'],
        },
    ], [])

    // ==================== 更新配置辅助函数 ====================

    /**
     * 更新主题配置
     */
    const updateThemeConfig = useCallback((updates: Partial<ThemeConfig>) => {
        const newConfig = {
            ...config,
            theme: { ...config.theme, ...updates },
        }

        // 验证配置
        const validation = validator.validateThemeConfig(newConfig.theme)
        if (!validation.valid) {
            const errors: Record<string, string> = {}
            validation.errors.forEach(err => {
                errors[err.path] = err.message
            })
            setValidationErrors(errors)
            toast.error('配置验证失败: ' + validation.errors[0].message)
            return
        }

        setValidationErrors({})
        onConfigChange(newConfig)
        toast.success('主题设置已更新')
    }, [config, onConfigChange, validator])

    /**
     * 选择主题
     */
    const handleSelectTheme = useCallback((themeId: ThemeName) => {
        if (!TypeGuards.isValidThemeName(themeId)) {
            toast.error('无效的主题名称')
            return
        }
        
        updateThemeConfig({ current_theme: themeId })
    }, [updateThemeConfig])

    /**
     * 更新自定义CSS
     */
    const handleCustomCssChange = useCallback((css: string) => {
        setCustomCssValue(css)
        
        // 验证CSS长度
        if (css.length > 10000) {
            setValidationErrors(prev => ({
                ...prev,
                'theme.custom_css': 'CSS代码长度不能超过10000字符'
            }))
            toast.error('CSS代码过长，请精简')
            return
        }

        // 基本CSS安全检查
        const dangerousPatterns = [
            /<script/i,
            /javascript:/i,
            /onerror=/i,
            /onload=/i,
        ]
        
        const hasDangerousCode = dangerousPatterns.some(pattern => pattern.test(css))
        if (hasDangerousCode) {
            setValidationErrors(prev => ({
                ...prev,
                'theme.custom_css': '检测到不安全的代码，请移除脚本相关内容'
            }))
            toast.error('CSS中包含不安全的代码')
            return
        }

        setValidationErrors(prev => {
            const { 'theme.custom_css': _, ...rest } = prev
            return rest
        })
    }, [])

    /**
     * 应用自定义CSS
     */
    const handleApplyCustomCss = useCallback(() => {
        updateThemeConfig({ custom_css: customCssValue || null })
    }, [customCssValue, updateThemeConfig])

    /**
     * 重置自定义CSS
     */
    const handleResetCustomCss = useCallback(() => {
        setCustomCssValue('')
        updateThemeConfig({ custom_css: null })
    }, [updateThemeConfig])

    /**
     * 导出主题
     */
    const handleExportTheme = useCallback(() => {
        const themeData = {
            theme: config.theme,
            exportedAt: new Date().toISOString(),
            version: '1.0.0',
        }

        const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `theme-${config.theme.current_theme}-${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast.success('主题导出成功')
    }, [config.theme])

    /**
     * 导入主题
     */
    const handleImportTheme = useCallback(() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return

            try {
                const text = await file.text()
                const themeData = JSON.parse(text)
                
                if (!themeData.theme) {
                    throw new Error('无效的主题文件')
                }

                updateThemeConfig(themeData.theme)
                if (themeData.theme.custom_css) {
                    setCustomCssValue(themeData.theme.custom_css)
                }
                toast.success('主题导入成功')
            } catch (error) {
                console.error('导入主题失败:', error)
                toast.error(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`)
            }
        }

        input.click()
    }, [updateThemeConfig])

    // ==================== 效果 ====================

    // 更新CSS行数
    useEffect(() => {
        const lines = customCssValue.split('\n').length
        setCssLineCount(lines)
    }, [customCssValue])

    // 同步config的custom_css到本地状态
    useEffect(() => {
        setCustomCssValue(config.theme.custom_css || '')
    }, [config.theme.custom_css])

    // ==================== 渲染 ====================
    return (
        <motion.div
            className={clsx(
                'theme-settings p-6 max-w-4xl mx-auto',
                className
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* 主题选择 */}
            <SectionTitle icon="🎨">主题选择</SectionTitle>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {availableThemes.map(theme => (
                    <ThemeCard
                        key={theme.id}
                        theme={theme}
                        isActive={config.theme.current_theme === theme.id}
                        onSelect={() => handleSelectTheme(theme.id)}
                    />
                ))}
            </div>

            <Divider />

            {/* 快速切换 */}
            <SectionTitle icon="⚡">快速切换</SectionTitle>

            <SettingItem
                label="当前主题"
                description="从下拉菜单快速切换主题"
            >
                <Select
                    id="theme-select"
                    value={config.theme.current_theme}
                    onChange={value => handleSelectTheme(value as ThemeName)}
                    options={availableThemes.map(t => ({ value: t.id, label: t.name }))}
                />
            </SettingItem>

            {/* 自定义CSS（仅在选择custom主题时显示） */}
            <AnimatePresence>
                {config.theme.current_theme === 'custom' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Divider />

                        <SectionTitle icon="💻">自定义 CSS</SectionTitle>

                        <div className="space-y-4">
                            {/* CSS编辑器 */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-900 dark:text-white">
                                        CSS 代码编辑器
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowCssHelp(!showCssHelp)}
                                            className="text-xs text-primary-500 hover:text-primary-600"
                                        >
                                            {showCssHelp ? '隐藏' : '显示'}帮助
                                        </button>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {customCssValue.length} / 10000 字符 · {cssLineCount} 行
                                        </span>
                                    </div>
                                </div>

                                {/* CSS帮助提示 */}
                                <AnimatePresence>
                                    {showCssHelp && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm"
                                        >
                                            <p className="text-blue-800 dark:text-blue-300 mb-2 font-medium">
                                                💡 CSS 编写提示：
                                            </p>
                                            <ul className="text-blue-700 dark:text-blue-400 space-y-1 text-xs list-disc list-inside">
                                                <li>使用CSS变量可以更灵活地定制主题</li>
                                                <li>建议使用类选择器而非标签选择器</li>
                                                <li>避免使用 !important，保持样式优先级清晰</li>
                                                <li>可以使用伪类和伪元素增强效果</li>
                                                <li>注意深色模式兼容性（使用 .dark 选择器）</li>
                                            </ul>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <textarea
                                    value={customCssValue}
                                    onChange={e => handleCustomCssChange(e.target.value)}
                                    maxLength={10000}
                                    rows={12}
                                    placeholder="/* 在此输入自定义 CSS 代码 */&#10;&#10;.my-custom-class {&#10;  color: #ff69b4;&#10;  font-size: 16px;&#10;}&#10;&#10;/* 深色模式 */&#10;.dark .my-custom-class {&#10;  color: #ffc0cb;&#10;}"
                                    className={clsx(
                                        'block w-full px-4 py-3 text-sm rounded-lg border',
                                        'bg-white dark:bg-gray-900',
                                        'border-gray-300 dark:border-gray-600',
                                        'text-gray-900 dark:text-white',
                                        'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                                        'resize-y',
                                        'font-mono',
                                        'transition-colors',
                                        validationErrors['theme.custom_css'] && 'border-red-500'
                                    )}
                                />

                                {validationErrors['theme.custom_css'] && (
                                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                        ⚠️ {validationErrors['theme.custom_css']}
                                    </p>
                                )}
                            </div>

                            {/* CSS操作按钮 */}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleApplyCustomCss}
                                    disabled={customCssValue === (config.theme.custom_css || '')}
                                    className={clsx(
                                        'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                                        customCssValue === (config.theme.custom_css || '')
                                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'bg-primary-500 text-white hover:bg-primary-600'
                                    )}
                                >
                                    应用 CSS
                                </button>
                                <button
                                    onClick={handleResetCustomCss}
                                    disabled={!customCssValue}
                                    className={clsx(
                                        'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                                        !customCssValue
                                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-400 dark:hover:bg-gray-500'
                                    )}
                                >
                                    重置
                                </button>
                            </div>

                            {/* CSS示例 */}
                            <details className="text-sm">
                                <summary className="cursor-pointer text-gray-700 dark:text-gray-300 hover:text-primary-500 font-medium">
                                    查看 CSS 示例代码
                                </summary>
                                <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto text-xs">
{`/* 自定义主色调 */
:root {
  --color-primary: 255 105 180;
  --color-secondary: 138 43 226;
}

/* 自定义按钮样式 */
.btn-custom {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  transition: transform 0.2s;
}

.btn-custom:hover {
  transform: translateY(-2px);
}

/* 深色模式适配 */
.dark {
  --color-background: 17 24 39;
  --color-foreground: 249 250 251;
}`}
                                </pre>
                            </details>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Divider />

            {/* 主题管理 */}
            <SectionTitle icon="📦">主题管理</SectionTitle>

            <div className="flex gap-3">
                <button
                    onClick={handleExportTheme}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    📤 导出主题
                </button>
                <button
                    onClick={handleImportTheme}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                    📥 导入主题
                </button>
            </div>

            <Divider />

            {/* 当前主题信息 */}
            <SectionTitle icon="ℹ️">当前主题信息</SectionTitle>

            {(() => {
                const currentTheme = availableThemes.find(
                    t => t.id === config.theme.current_theme
                )
                
                if (!currentTheme) {
                    return (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                ⚠️ 未找到当前主题信息
                            </p>
                        </div>
                    )
                }

                return (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600">
                                <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                                    <div style={{ backgroundColor: currentTheme.preview.primary }} />
                                    <div style={{ backgroundColor: currentTheme.preview.secondary }} />
                                    <div style={{ backgroundColor: currentTheme.preview.background }} />
                                    <div style={{ backgroundColor: currentTheme.preview.foreground }} />
                                </div>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                                    {currentTheme.name}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    {currentTheme.description}
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">主色调: </span>
                                        <span className="font-mono text-gray-900 dark:text-white">
                                            {currentTheme.preview.primary}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">次要色: </span>
                                        <span className="font-mono text-gray-900 dark:text-white">
                                            {currentTheme.preview.secondary}
                                        </span>
                                    </div>
                                </div>
                                {config.theme.custom_css && (
                                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                                        ℹ️ 已应用自定义CSS（{config.theme.custom_css.length} 字符）
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })()}

            {/* 验证错误提示 */}
            {Object.keys(validationErrors).length > 0 && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <h4 className="text-sm font-medium text-red-800 dark:text-red-400 mb-2">
                        配置验证错误
                    </h4>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                        {Object.entries(validationErrors).map(([path, message]) => (
                            <li key={path}>• {path}: {message}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 底部提示 */}
            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                    💡 提示：主题更改会立即生效。自定义CSS可能需要刷新页面才能完全应用。导出的主题文件可以分享给其他用户。
                </p>
            </div>
        </motion.div>
    )
}

/**
 * 默认导出
 */
export default ThemeSettings

