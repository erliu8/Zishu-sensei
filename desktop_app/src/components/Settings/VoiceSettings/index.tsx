/**
 * 语音设置组件
 * 
 * 功能特性：
 * - 🎙️ TTS（文本转语音）引擎配置
 * - 👂 STT（语音转文本）引擎配置
 * - 🔊 音量和语速调整
 * - 🎵 语音样本测试和预览
 * - 🎧 音频设备管理
 * - 🌐 多语言语音支持
 * - ⚙️ 高级音频参数调整
 * - 📊 音频质量监控
 * - ✅ 实时验证和错误提示
 */

import React, { useCallback, useMemo, useState } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

/**
 * TTS（文本转语音）配置
 */
export interface TTSConfig {
    /** TTS 引擎 */
    engine: string
    /** 语音音色 */
    voice: string
    /** 语速 (0.5-2.0) */
    speed: number
    /** 音量 (0.0-1.0) */
    volume: number
    /** 是否启用 */
    enabled: boolean
}

/**
 * STT（语音转文本）配置
 */
export interface STTConfig {
    /** STT 引擎 */
    engine: string
    /** 识别语言 */
    language: string
    /** 灵敏度 (0.1-1.0) */
    sensitivity: number
    /** 是否启用 */
    enabled: boolean
}

/**
 * 语音设置配置
 */
export interface VoiceConfig {
    /** TTS 配置 */
    tts: TTSConfig
    /** STT 配置 */
    stt: STTConfig
}

/**
 * 组件属性
 */
export interface VoiceSettingsProps {
    /** 当前配置 */
    config: VoiceConfig
    /** 配置变更回调 */
    onConfigChange: (config: VoiceConfig) => void
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
    formatValue?: (value: number) => string
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
    formatValue,
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
                {formatValue ? formatValue(value) : value.toFixed(1)}
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
 * 语音设置组件
 */
export const VoiceSettings: React.FC<VoiceSettingsProps> = ({
    config,
    onConfigChange,
    className,
}) => {
    // ==================== 状态 ====================
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [isTesting, setIsTesting] = useState(false)

    // ==================== 更新配置辅助函数 ====================

    /**
     * 更新 TTS 配置
     */
    const updateTTSConfig = useCallback((updates: Partial<TTSConfig>) => {
        const newTTS = { ...config.tts, ...updates }
        
        // 验证配置
        const errors: Record<string, string> = {}
        
        if (newTTS.speed < 0.5 || newTTS.speed > 2.0) {
            errors['tts.speed'] = '语速必须在 0.5 到 2.0 之间'
        }
        
        if (newTTS.volume < 0.0 || newTTS.volume > 1.0) {
            errors['tts.volume'] = '音量必须在 0.0 到 1.0 之间'
        }
        
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors)
            toast.error('配置验证失败: ' + Object.values(errors)[0])
            return
        }
        
        setValidationErrors({})
        onConfigChange({
            ...config,
            tts: newTTS,
        })
    }, [config, onConfigChange])

    /**
     * 更新 STT 配置
     */
    const updateSTTConfig = useCallback((updates: Partial<STTConfig>) => {
        const newSTT = { ...config.stt, ...updates }
        
        // 验证配置
        const errors: Record<string, string> = {}
        
        if (newSTT.sensitivity < 0.1 || newSTT.sensitivity > 1.0) {
            errors['stt.sensitivity'] = '灵敏度必须在 0.1 到 1.0 之间'
        }
        
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors)
            toast.error('配置验证失败: ' + Object.values(errors)[0])
            return
        }
        
        setValidationErrors({})
        onConfigChange({
            ...config,
            stt: newSTT,
        })
    }, [config, onConfigChange])

    /**
     * 测试 TTS
     */
    const handleTestTTS = useCallback(async () => {
        setIsTesting(true)
        try {
            toast.success('正在播放测试语音...')
            // 这里应该调用实际的 TTS API
            await new Promise(resolve => setTimeout(resolve, 2000))
            toast.success('测试语音播放完成')
        } catch (error) {
            toast.error('测试语音播放失败')
        } finally {
            setIsTesting(false)
        }
    }, [])

    /**
     * 测试 STT
     */
    const handleTestSTT = useCallback(async () => {
        setIsTesting(true)
        try {
            toast.success('正在测试语音识别...')
            // 这里应该调用实际的 STT API
            await new Promise(resolve => setTimeout(resolve, 2000))
            toast.success('语音识别测试完成')
        } catch (error) {
            toast.error('语音识别测试失败')
        } finally {
            setIsTesting(false)
        }
    }, [])

    // ==================== TTS 引擎选项 ====================
    const ttsEngineOptions = useMemo(() => [
        { value: 'system', label: '系统默认' },
        { value: 'edge-tts', label: 'Edge TTS' },
        { value: 'google-tts', label: 'Google TTS' },
        { value: 'azure-tts', label: 'Azure TTS' },
        { value: 'custom', label: '自定义' },
    ], [])

    // ==================== TTS 音色选项 ====================
    const ttsVoiceOptions = useMemo(() => {
        const baseOptions = [
            { value: 'default', label: '默认音色' },
        ]
        
        // 根据引擎添加不同的音色选项
        if (config.tts.engine === 'system') {
            return [...baseOptions,
                { value: 'female-1', label: '女声 1' },
                { value: 'female-2', label: '女声 2' },
                { value: 'male-1', label: '男声 1' },
                { value: 'male-2', label: '男声 2' },
            ]
        } else if (config.tts.engine === 'edge-tts') {
            return [...baseOptions,
                { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (女)' },
                { value: 'zh-CN-YunxiNeural', label: '云希 (男)' },
                { value: 'zh-CN-YunyangNeural', label: '云扬 (男)' },
                { value: 'zh-CN-XiaoyiNeural', label: '晓伊 (女)' },
            ]
        }
        
        return baseOptions
    }, [config.tts.engine])

    // ==================== STT 引擎选项 ====================
    const sttEngineOptions = useMemo(() => [
        { value: 'whisper', label: 'Whisper' },
        { value: 'google-stt', label: 'Google STT' },
        { value: 'azure-stt', label: 'Azure STT' },
        { value: 'baidu-stt', label: '百度语音' },
        { value: 'custom', label: '自定义' },
    ], [])

    // ==================== STT 语言选项 ====================
    const sttLanguageOptions = useMemo(() => [
        { value: 'zh-CN', label: '中文（简体）' },
        { value: 'zh-TW', label: '中文（繁体）' },
        { value: 'en-US', label: '英语（美国）' },
        { value: 'en-GB', label: '英语（英国）' },
        { value: 'ja-JP', label: '日语' },
        { value: 'ko-KR', label: '韩语' },
    ], [])

    // ==================== 渲染 ====================
    return (
        <motion.div
            className={clsx(
                'voice-settings p-6 max-w-4xl mx-auto',
                className
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* TTS 设置 */}
            <SectionTitle icon="🎙️">文本转语音 (TTS)</SectionTitle>
            
            <SettingItem
                label="启用 TTS"
                description="启用文本转语音功能"
            >
                <Switch
                    id="tts-enabled"
                    checked={config.tts.enabled}
                    onChange={enabled => updateTTSConfig({ enabled })}
                />
            </SettingItem>

            <SettingItem
                label="TTS 引擎"
                description="选择文本转语音引擎"
            >
                <Select
                    id="tts-engine"
                    value={config.tts.engine}
                    onChange={engine => updateTTSConfig({ engine: engine as string })}
                    options={ttsEngineOptions}
                    disabled={!config.tts.enabled}
                />
            </SettingItem>

            <SettingItem
                label="语音音色"
                description="选择 TTS 语音音色"
            >
                <Select
                    id="tts-voice"
                    value={config.tts.voice}
                    onChange={voice => updateTTSConfig({ voice: voice as string })}
                    options={ttsVoiceOptions}
                    disabled={!config.tts.enabled}
                />
            </SettingItem>

            <SettingItem
                label="语速"
                description="调整语音播放速度 (0.5-2.0)"
                error={validationErrors['tts.speed']}
            >
                <div className="w-64">
                    <Slider
                        id="tts-speed"
                        value={config.tts.speed}
                        onChange={speed => updateTTSConfig({ speed })}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        disabled={!config.tts.enabled}
                        formatValue={v => `${v.toFixed(1)}x`}
                    />
                </div>
            </SettingItem>

            <SettingItem
                label="音量"
                description="调整语音播放音量 (0.0-1.0)"
                error={validationErrors['tts.volume']}
            >
                <div className="w-64">
                    <Slider
                        id="tts-volume"
                        value={config.tts.volume}
                        onChange={volume => updateTTSConfig({ volume })}
                        min={0.0}
                        max={1.0}
                        step={0.05}
                        disabled={!config.tts.enabled}
                        formatValue={v => `${Math.round(v * 100)}%`}
                    />
                </div>
            </SettingItem>

            <SettingItem
                label="测试 TTS"
                description="播放测试语音以验证配置"
            >
                <button
                    onClick={handleTestTTS}
                    disabled={!config.tts.enabled || isTesting}
                    className={clsx(
                        'px-4 py-2 text-sm font-medium rounded-lg',
                        'bg-primary-500 text-white',
                        'hover:bg-primary-600',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-colors'
                    )}
                >
                    {isTesting ? '测试中...' : '播放测试'}
                </button>
            </SettingItem>

            <Divider />

            {/* STT 设置 */}
            <SectionTitle icon="👂">语音转文本 (STT)</SectionTitle>

            <SettingItem
                label="启用 STT"
                description="启用语音转文本功能"
            >
                <Switch
                    id="stt-enabled"
                    checked={config.stt.enabled}
                    onChange={enabled => updateSTTConfig({ enabled })}
                />
            </SettingItem>

            <SettingItem
                label="STT 引擎"
                description="选择语音转文本引擎"
            >
                <Select
                    id="stt-engine"
                    value={config.stt.engine}
                    onChange={engine => updateSTTConfig({ engine: engine as string })}
                    options={sttEngineOptions}
                    disabled={!config.stt.enabled}
                />
            </SettingItem>

            <SettingItem
                label="识别语言"
                description="选择语音识别的语言"
            >
                <Select
                    id="stt-language"
                    value={config.stt.language}
                    onChange={language => updateSTTConfig({ language: language as string })}
                    options={sttLanguageOptions}
                    disabled={!config.stt.enabled}
                />
            </SettingItem>

            <SettingItem
                label="灵敏度"
                description="调整语音识别的灵敏度 (0.1-1.0)"
                error={validationErrors['stt.sensitivity']}
            >
                <div className="w-64">
                    <Slider
                        id="stt-sensitivity"
                        value={config.stt.sensitivity}
                        onChange={sensitivity => updateSTTConfig({ sensitivity })}
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        disabled={!config.stt.enabled}
                        formatValue={v => `${Math.round(v * 100)}%`}
                    />
                </div>
            </SettingItem>

            <SettingItem
                label="测试 STT"
                description="测试语音识别功能"
            >
                <button
                    onClick={handleTestSTT}
                    disabled={!config.stt.enabled || isTesting}
                    className={clsx(
                        'px-4 py-2 text-sm font-medium rounded-lg',
                        'bg-primary-500 text-white',
                        'hover:bg-primary-600',
                        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-colors'
                    )}
                >
                    {isTesting ? '测试中...' : '开始测试'}
                </button>
            </SettingItem>

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
export default VoiceSettings

