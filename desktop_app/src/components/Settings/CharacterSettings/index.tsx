/**
 * 角色设置组件
 * 
 * 功能特性：
 * - 🎭 角色选择器（预览、信息展示）
 * - 📏 角色尺寸和位置调整
 * - 🎬 角色动画和行为配置
 * - 💫 角色交互设置
 * - 📊 角色性能优化选项
 * - ✅ 实时验证和错误提示
 * - 🔄 实时预览效果
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

// 类型
import type {
    AppConfig,
    CharacterConfig,
    CharacterId,
    ScaleValue,
} from '@/types/settings'
import { CONFIG_VALIDATION_RULES, TypeGuards } from '@/types/settings'
import { ConfigValidator } from '@/utils/configValidator'

/**
 * 角色信息接口
 */
interface CharacterInfo {
    id: string
    name: string
    displayName: string
    description: string
    previewImage: string
    tags: string[]
    motions: string[]
    expressions: string[]
}

/**
 * 组件属性
 */
export interface CharacterSettingsProps {
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
    unit?: string
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
    unit = '',
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
            <span className="text-sm font-medium text-gray-900 dark:text-white w-16 text-right">
                {value.toFixed(1)}{unit}
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
 * 角色卡片组件
 */
interface CharacterCardProps {
    character: CharacterInfo
    isActive: boolean
    onSelect: () => void
}

const CharacterCard: React.FC<CharacterCardProps> = ({ character, isActive, onSelect }) => (
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
            {/* 角色预览图 */}
            <div className="flex-shrink-0 w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div className="w-full h-full flex items-center justify-center text-4xl">
                    {character.id === 'shizuku' ? '💧' : character.id === 'haru' ? '🌸' : '✨'}
                </div>
            </div>
            
            {/* 角色信息 */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                        {character.displayName}
                    </h4>
                    {isActive && (
                        <span className="px-2 py-0.5 text-xs bg-primary-500 text-white rounded-full">
                            当前
                        </span>
                    )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                    {character.description}
                </p>
                <div className="flex flex-wrap gap-1">
                    {character.tags.slice(0, 3).map(tag => (
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
 * 角色设置组件
 */
export const CharacterSettings: React.FC<CharacterSettingsProps> = ({
    config,
    onConfigChange,
    className,
}) => {
    // ==================== 状态 ====================
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [availableCharacters, setAvailableCharacters] = useState<CharacterInfo[]>([])
    const [isLoadingCharacters, setIsLoadingCharacters] = useState(true)

    // ==================== 配置验证器 ====================
    const validator = useMemo(() => ConfigValidator.getInstance(), [])

    // ==================== 加载可用角色列表 ====================
    useEffect(() => {
        loadAvailableCharacters()
    }, [])

    const loadAvailableCharacters = async () => {
        try {
            setIsLoadingCharacters(true)
            
            // 模拟从后端获取角色列表
            // 实际项目中应该调用 Tauri API
            const characters: CharacterInfo[] = [
                {
                    id: 'shizuku',
                    name: 'Shizuku',
                    displayName: '静雫（Shizuku）',
                    description: '温柔可爱的桌面宠物角色，喜欢陪伴用户，性格安静且善解人意。',
                    previewImage: '/characters/shizuku/preview.png',
                    tags: ['可爱', '温柔', '安静'],
                    motions: ['idle', 'tap_body', 'tap_head', 'shake'],
                    expressions: ['normal', 'happy', 'sad', 'angry'],
                },
                {
                    id: 'haru',
                    name: 'Haru',
                    displayName: '春（Haru）',
                    description: '活泼开朗的桌面助手，充满活力，总是能带来正能量。',
                    previewImage: '/characters/haru/preview.png',
                    tags: ['活泼', '开朗', '正能量'],
                    motions: ['idle', 'wave', 'dance'],
                    expressions: ['normal', 'smile', 'wink'],
                },
            ]
            
            setAvailableCharacters(characters)
        } catch (error) {
            console.error('加载角色列表失败:', error)
            toast.error('加载角色列表失败')
        } finally {
            setIsLoadingCharacters(false)
        }
    }

    // ==================== 更新配置辅助函数 ====================

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

        // 显示警告（如果有）
        if (validation.warnings.length > 0) {
            validation.warnings.forEach(warning => {
                toast(warning, { icon: '⚠️' })
            })
        }

        setValidationErrors({})
        onConfigChange(newConfig)
        toast.success('角色设置已更新')
    }, [config, onConfigChange, validator])

    /**
     * 选择角色
     */
    const handleSelectCharacter = useCallback((characterId: string) => {
        if (!TypeGuards.isValidCharacterId(characterId)) {
            toast.error('无效的角色ID')
            return
        }
        
        updateCharacterConfig({ current_character: characterId as CharacterId })
    }, [updateCharacterConfig])

    /**
     * 更新缩放
     */
    const handleScaleChange = useCallback((scale: number) => {
        if (!TypeGuards.isValidScaleValue(scale)) {
            setValidationErrors(prev => ({
                ...prev,
                'character.scale': '缩放值必须在 0.1 到 5.0 之间'
            }))
            return
        }
        
        updateCharacterConfig({ scale: scale as ScaleValue })
    }, [updateCharacterConfig])

    // ==================== 渲染 ====================
    return (
        <motion.div
            className={clsx(
                'character-settings p-6 max-w-4xl mx-auto',
                className
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* 角色选择 */}
            <SectionTitle icon="🎭">角色选择</SectionTitle>
            
            {isLoadingCharacters ? (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">加载角色列表中...</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {availableCharacters.map(character => (
                        <CharacterCard
                            key={character.id}
                            character={character}
                            isActive={config.character.current_character === character.id}
                            onSelect={() => handleSelectCharacter(character.id)}
                        />
                    ))}
                </div>
            )}

            <Divider />

            {/* 外观设置 */}
            <SectionTitle icon="🎨">外观设置</SectionTitle>

            <SettingItem
                label="角色缩放"
                description={`调整角色显示的大小 (${CONFIG_VALIDATION_RULES.character.scale.min}-${CONFIG_VALIDATION_RULES.character.scale.max})`}
                error={validationErrors['character.scale']}
            >
                <div className="w-64">
                    <Slider
                        id="character-scale"
                        value={config.character.scale}
                        onChange={handleScaleChange}
                        min={CONFIG_VALIDATION_RULES.character.scale.min}
                        max={CONFIG_VALIDATION_RULES.character.scale.max}
                        step={0.1}
                        unit="x"
                    />
                </div>
            </SettingItem>

            {/* 缩放预设 */}
            <div className="ml-0 mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    快速缩放预设
                </label>
                <div className="flex gap-2">
                    {[
                        { label: '迷你', value: 0.5 },
                        { label: '小', value: 0.8 },
                        { label: '标准', value: 1.0 },
                        { label: '大', value: 1.5 },
                        { label: '超大', value: 2.0 },
                    ].map(preset => (
                        <button
                            key={preset.value}
                            onClick={() => handleScaleChange(preset.value)}
                            className={clsx(
                                'px-3 py-1.5 text-sm rounded-lg transition-colors',
                                Math.abs(config.character.scale - preset.value) < 0.01
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            )}
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            <Divider />

            {/* 行为设置 */}
            <SectionTitle icon="⚙️">行为设置</SectionTitle>

            <SettingItem
                label="自动待机"
                description="角色在无操作时自动进入待机状态，播放待机动画"
            >
                <Switch
                    id="character-auto-idle"
                    checked={config.character.auto_idle}
                    onChange={auto_idle => updateCharacterConfig({ auto_idle })}
                />
            </SettingItem>

            <SettingItem
                label="启用交互"
                description="允许与角色进行交互，包括点击、拖拽等操作"
            >
                <Switch
                    id="character-interaction"
                    checked={config.character.interaction_enabled}
                    onChange={interaction_enabled => updateCharacterConfig({ interaction_enabled })}
                />
            </SettingItem>

            <Divider />

            {/* 当前角色信息 */}
            <SectionTitle icon="ℹ️">当前角色信息</SectionTitle>

            {(() => {
                const currentChar = availableCharacters.find(
                    c => c.id === config.character.current_character
                )
                
                if (!currentChar) {
                    return (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                                ⚠️ 未找到当前角色信息
                            </p>
                        </div>
                    )
                }

                return (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    可用动作
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {currentChar.motions.map(motion => (
                                        <span
                                            key={motion}
                                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded"
                                        >
                                            {motion}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    可用表情
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {currentChar.expressions.map(expression => (
                                        <span
                                            key={expression}
                                            className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded"
                                        >
                                            {expression}
                                        </span>
                                    ))}
                                </div>
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
                    💡 提示：角色设置会实时生效。更换角色可能需要重新加载模型，请稍候。
                </p>
            </div>
        </motion.div>
    )
}

/**
 * 默认导出
 */
export default CharacterSettings

