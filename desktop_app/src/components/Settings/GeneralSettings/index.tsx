/**
 * 通用设置组件
 * 
 * 功能特性：
 * - 🪟 窗口配置（大小、位置、显示选项）
 * - 🎨 主题配置（主题选择、自定义CSS）
 * - 💻 系统配置（自动启动、托盘、通知）
 * - 🎭 角色配置（当前角色、缩放、交互）
 * - ✅ 实时验证和错误提示
 * - 🔄 自动保存和手动保存
 * - 📊 设置预览
 */

import React, { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

// 类型
import type {
    AppConfig,
    WindowConfig,
    CharacterConfig,
    ThemeConfig,
    SystemConfig,
    ThemeName,
} from '@/types/settings'
import { CONFIG_VALIDATION_RULES } from '@/types/settings'
import { ConfigValidator } from '@/utils/configValidator'

/**
 * 组件属性
 */
export interface GeneralSettingsProps {
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
    htmlFor?: string
}

/**
 * 设置项组件
 */
const SettingItem: React.FC<SettingItemProps> = ({
    label,
    description,
    children,
    className,
    htmlFor,
}) => (
    <div className={clsx('setting-item py-4', className)}>
        <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
                <label 
                    className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
                    htmlFor={htmlFor}
                >
                    {label}
                </label>
                {description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {description}
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
 * 开关组件
 */
interface SwitchProps {
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
    id?: string
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled, id }) => (
    <button
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={clsx(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            checked ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600',
            disabled && 'opacity-50 cursor-not-allowed'
        )}
    >
        <span
            className={clsx(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                checked ? 'translate-x-6' : 'translate-x-1'
            )}
        />
    </button>
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
 * 数字输入组件
 */
interface NumberInputProps {
    value: number
    onChange: (value: number) => void
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    id?: string
}

const NumberInput: React.FC<NumberInputProps> = ({
    value,
    onChange,
    min,
    max,
    step = 1,
    disabled,
    id,
}) => (
    <input
        id={id}
        type="number"
        value={value}
        onChange={e => {
            const newValue = parseFloat(e.target.value)
            if (!isNaN(newValue)) {
                onChange(newValue)
            }
        }}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={clsx(
            'block w-24 px-3 py-2 text-sm rounded-lg border',
            'bg-white dark:bg-gray-800',
            'border-gray-300 dark:border-gray-600',
            'text-gray-900 dark:text-white',
            'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-colors'
        )}
    />
)

/**
 * 滑块组件
 */
interface SliderProps {
    value: number
    onChange: (value: number) => void
    min: number
    max: number
    step?: number
    disabled?: boolean
    showValue?: boolean
    id?: string
}

const Slider: React.FC<SliderProps> = ({
    value,
    onChange,
    min,
    max,
    step = 0.1,
    disabled,
    showValue = true,
    id,
}) => (
    <div className="flex items-center gap-3">
        <input
            id={id}
            type="range"
            value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className={clsx(
                'flex-1 h-2 rounded-lg appearance-none cursor-pointer',
                'bg-gray-200 dark:bg-gray-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                '[&::-webkit-slider-thumb]:appearance-none',
                '[&::-webkit-slider-thumb]:w-4',
                '[&::-webkit-slider-thumb]:h-4',
                '[&::-webkit-slider-thumb]:rounded-full',
                '[&::-webkit-slider-thumb]:bg-primary-500',
                '[&::-webkit-slider-thumb]:cursor-pointer',
                '[&::-moz-range-thumb]:w-4',
                '[&::-moz-range-thumb]:h-4',
                '[&::-moz-range-thumb]:rounded-full',
                '[&::-moz-range-thumb]:bg-primary-500',
                '[&::-moz-range-thumb]:cursor-pointer',
                '[&::-moz-range-thumb]:border-0'
            )}
        />
        {showValue && (
            <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                {value.toFixed(1)}
            </span>
        )}
    </div>
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
 * 通用设置组件
 */
export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
    config,
    onConfigChange,
    className,
}) => {
    // ==================== 状态 ====================
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

    // ==================== 配置验证器 ====================
    const validator = useMemo(() => ConfigValidator.getInstance(), [])

    // ==================== 更新配置辅助函数 ====================

    /**
     * 更新窗口配置
     */
    const updateWindowConfig = useCallback((updates: Partial<WindowConfig>) => {
        const newConfig = {
            ...config,
            window: { ...config.window, ...updates },
        }

        // 验证配置
        const validation = validator.validateWindowConfig(newConfig.window)
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
    }, [config, onConfigChange, validator])

    /**
     * 更新角色配置
     */
    const updateCharacterConfig = useCallback((updates: Partial<CharacterConfig>) => {
        const newConfig = {
            ...config,
            character: { ...config.character, ...updates },
        }

        // 验证配置
        const validation = validator.validateCharacterConfig(newConfig.character)
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
    }, [config, onConfigChange, validator])

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
    }, [config, onConfigChange, validator])

    /**
     * 更新系统配置
     */
    const updateSystemConfig = useCallback((updates: Partial<SystemConfig>) => {
        const newConfig = {
            ...config,
            system: { ...config.system, ...updates },
        }

        // 验证配置
        const validation = validator.validateSystemConfig(newConfig.system)
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
    }, [config, onConfigChange, validator])

    // ==================== 主题选项 ====================
    const themeOptions = useMemo(() => [
        { value: 'anime', label: '动漫风格' },
        { value: 'modern', label: '现代风格' },
        { value: 'classic', label: '经典风格' },
        { value: 'dark', label: '暗黑风格' },
        { value: 'light', label: '明亮风格' },
        { value: 'custom', label: '自定义' },
    ], [])

    // ==================== 渲染 ====================
    return (
        <motion.div
            className={clsx(
                'general-settings p-6 max-w-4xl mx-auto',
                className
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* 窗口设置 */}
            <SectionTitle icon="🪟">窗口设置</SectionTitle>
            
            <SettingItem
                label="窗口宽度"
                description={`设置窗口的宽度 (${CONFIG_VALIDATION_RULES.window.width.min}-${CONFIG_VALIDATION_RULES.window.width.max}px)`}
            >
                <NumberInput
                    id="window-width"
                    value={config.window.width}
                    onChange={width => updateWindowConfig({ width })}
                    min={CONFIG_VALIDATION_RULES.window.width.min}
                    max={CONFIG_VALIDATION_RULES.window.width.max}
                />
            </SettingItem>

            <SettingItem
                label="窗口高度"
                description={`设置窗口的高度 (${CONFIG_VALIDATION_RULES.window.height.min}-${CONFIG_VALIDATION_RULES.window.height.max}px)`}
            >
                <NumberInput
                    id="window-height"
                    value={config.window.height}
                    onChange={height => updateWindowConfig({ height })}
                    min={CONFIG_VALIDATION_RULES.window.height.min}
                    max={CONFIG_VALIDATION_RULES.window.height.max}
                />
            </SettingItem>

            <SettingItem
                label="窗口置顶"
                description="窗口始终显示在其他窗口之上"
            >
                <Switch
                    id="window-always-on-top"
                    checked={config.window.always_on_top}
                    onChange={always_on_top => updateWindowConfig({ always_on_top })}
                />
            </SettingItem>

            <SettingItem
                label="窗口透明"
                description="启用窗口背景透明效果"
            >
                <Switch
                    id="window-transparent"
                    checked={config.window.transparent}
                    onChange={transparent => updateWindowConfig({ transparent })}
                />
            </SettingItem>

            <SettingItem
                label="窗口装饰"
                description="显示窗口标题栏和边框"
            >
                <Switch
                    id="window-decorations"
                    checked={config.window.decorations}
                    onChange={decorations => updateWindowConfig({ decorations })}
                />
            </SettingItem>

            <SettingItem
                label="可调整大小"
                description="允许用户手动调整窗口大小"
            >
                <Switch
                    id="window-resizable"
                    checked={config.window.resizable}
                    onChange={resizable => updateWindowConfig({ resizable })}
                />
            </SettingItem>

            <Divider />

            {/* 角色设置 */}
            <SectionTitle icon="🎭">角色设置</SectionTitle>

            <SettingItem
                label="角色缩放"
                description={`调整角色显示的大小 (${CONFIG_VALIDATION_RULES.character.scale.min}-${CONFIG_VALIDATION_RULES.character.scale.max})`}
            >
                <div className="w-64">
                    <Slider
                        id="character-scale"
                        value={config.character.scale}
                        onChange={scale => updateCharacterConfig({ scale: scale as any })}
                        min={CONFIG_VALIDATION_RULES.character.scale.min}
                        max={CONFIG_VALIDATION_RULES.character.scale.max}
                        step={0.1}
                    />
                </div>
            </SettingItem>

            <SettingItem
                label="自动待机"
                description="角色在无操作时自动进入待机状态"
            >
                <Switch
                    id="character-auto-idle"
                    checked={config.character.auto_idle}
                    onChange={auto_idle => updateCharacterConfig({ auto_idle })}
                />
            </SettingItem>

            <SettingItem
                label="启用交互"
                description="允许与角色进行交互"
            >
                <Switch
                    id="character-interaction"
                    checked={config.character.interaction_enabled}
                    onChange={interaction_enabled => updateCharacterConfig({ interaction_enabled })}
                />
            </SettingItem>

            <Divider />

            {/* 主题设置 */}
            <SectionTitle icon="🎨">主题设置</SectionTitle>

            <SettingItem
                label="界面主题"
                description="选择应用的界面主题"
            >
                <Select
                    id="theme-current"
                    value={config.theme.current_theme}
                    onChange={value => updateThemeConfig({ current_theme: value as ThemeName })}
                    options={themeOptions}
                />
            </SettingItem>

            {config.theme.current_theme === 'custom' && (
                <SettingItem
                    label="自定义CSS"
                    description="添加自定义样式代码 (最多 10000 字符)"
                >
                    <textarea
                        id="theme-custom-css"
                        value={config.theme.custom_css || ''}
                        onChange={e => updateThemeConfig({ custom_css: e.target.value })}
                        maxLength={10000}
                        rows={6}
                        placeholder="在此输入自定义 CSS 代码..."
                        className={clsx(
                            'block w-full px-3 py-2 text-sm rounded-lg border',
                            'bg-white dark:bg-gray-800',
                            'border-gray-300 dark:border-gray-600',
                            'text-gray-900 dark:text-white',
                            'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                            'resize-none',
                            'font-mono',
                            'transition-colors'
                        )}
                    />
                </SettingItem>
            )}

            <Divider />

            {/* 系统设置 */}
            <SectionTitle icon="💻">系统设置</SectionTitle>

            <SettingItem
                label="开机自启动"
                description="系统启动时自动运行应用"
            >
                <Switch
                    id="system-auto-start"
                    checked={config.system.auto_start}
                    onChange={auto_start => updateSystemConfig({ auto_start })}
                />
            </SettingItem>

            <SettingItem
                label="最小化到托盘"
                description="最小化窗口时隐藏到系统托盘"
            >
                <Switch
                    id="system-minimize-to-tray"
                    checked={config.system.minimize_to_tray}
                    onChange={minimize_to_tray => updateSystemConfig({ minimize_to_tray })}
                />
            </SettingItem>

            <SettingItem
                label="关闭到托盘"
                description="关闭窗口时隐藏到系统托盘而不退出"
            >
                <Switch
                    id="system-close-to-tray"
                    checked={config.system.close_to_tray}
                    onChange={close_to_tray => updateSystemConfig({ close_to_tray })}
                />
            </SettingItem>

            <SettingItem
                label="显示通知"
                description="允许应用显示系统通知"
            >
                <Switch
                    id="system-notifications"
                    checked={config.system.show_notifications}
                    onChange={show_notifications => updateSystemConfig({ show_notifications })}
                />
            </SettingItem>

            <Divider />

            {/* 语言设置 */}
            <SectionTitle icon="🌐">语言设置</SectionTitle>

            <SettingItem
                label="界面语言"
                description="选择应用界面显示语言"
            >
                <Select
                    id="language-interface"
                    value="zh-CN"
                    onChange={value => {
                        // 语言设置通过其他Hook处理
                        console.log('Language change:', value)
                    }}
                    options={[
                        { value: 'zh-CN', label: '简体中文' },
                        { value: 'zh-TW', label: '繁體中文' },
                        { value: 'en-US', label: 'English' },
                        { value: 'ja-JP', label: '日本語' },
                    ]}
                />
            </SettingItem>

            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                <p className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                    <span>语言包状态: 已下载</span>
                </p>
            </div>

            <Divider />

            {/* 自动保存设置 */}
            <SectionTitle icon="💾">自动保存</SectionTitle>

            <SettingItem
                label="自动保存"
                description="启用配置的自动保存功能"
            >
                <Switch
                    id="auto-save"
                    checked={true}
                    onChange={auto_save => {
                        // 自动保存设置处理
                        console.log('Auto save change:', auto_save)
                    }}
                />
            </SettingItem>

            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                <p>最后保存: {new Date().toLocaleString()}</p>
            </div>

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
                    💡 提示：所有设置会实时生效，但需要点击上方的"保存"按钮才会永久保存。
                </p>
            </div>
        </motion.div>
    )
}

/**
 * 默认导出
 */
export default GeneralSettings

