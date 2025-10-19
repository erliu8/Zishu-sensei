/**
 * 颜色选择器组件
 * 
 * 功能特性：
 * - 🎨 完整的颜色选择（HEX、RGB、HSL、HSV）
 * - 🌈 色相、饱和度、亮度独立调节
 * - 👁️ 实时预览
 * - 📋 颜色历史记录
 * - 🎯 预设颜色
 * - ⌨️ 键盘操作支持
 * - ♿ 无障碍支持
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import clsx from 'clsx'
import type { ColorPickerValue } from '@/types/theme'
import * as colorUtils from '@/utils/colorUtils'

/**
 * 组件属性
 */
export interface ColorPickerProps {
    /** 当前颜色值 */
    value: ColorPickerValue | string
    /** 颜色变化回调 */
    onChange: (color: ColorPickerValue) => void
    /** 是否显示透明度控制 */
    showAlpha?: boolean
    /** 是否显示预设颜色 */
    showPresets?: boolean
    /** 预设颜色列表 */
    presets?: string[]
    /** 是否显示历史记录 */
    showHistory?: boolean
    /** 最大历史记录数 */
    maxHistory?: number
    /** 自定义类名 */
    className?: string
    /** 是否禁用 */
    disabled?: boolean
}

/**
 * 默认预设颜色
 */
const DEFAULT_PRESETS = [
    '#ff6b6b', '#ee5a6f', '#f06595', '#cc5de8', '#845ef7',
    '#5c7cfa', '#339af0', '#22b8cf', '#20c997', '#51cf66',
    '#94d82d', '#fcc419', '#ff922b', '#ff6b6b', '#f03e3e',
]

/**
 * 颜色选择器组件
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({
    value,
    onChange,
    showAlpha = false,
    showPresets = true,
    presets = DEFAULT_PRESETS,
    showHistory = true,
    maxHistory = 10,
    className,
    disabled = false,
}) => {
    // ==================== 状态 ====================
    
    const [color, setColor] = useState<ColorPickerValue>(() => {
        if (typeof value === 'string') {
            return colorUtils.parseColor(value) || {
                hex: '#000000',
                rgb: { r: 0, g: 0, b: 0 },
                hsl: { h: 0, s: 0, l: 0 },
                hsv: { h: 0, s: 0, v: 0 },
                alpha: 1
            }
        }
        return value
    })
    
    const [history, setHistory] = useState<string[]>([])
    const [inputValue, setInputValue] = useState(color.hex)
    const [activeFormat, setActiveFormat] = useState<'hex' | 'rgb' | 'hsl'>('hex')
    
    // ==================== Refs ====================
    
    const saturationRef = useRef<HTMLDivElement>(null)
    const hueRef = useRef<HTMLDivElement>(null)
    const alphaRef = useRef<HTMLDivElement>(null)
    
    // ==================== 同步外部值 ====================
    
    useEffect(() => {
        if (typeof value === 'string') {
            const parsed = colorUtils.parseColor(value)
            if (parsed) {
                setColor(parsed)
                setInputValue(parsed.hex)
            }
        } else {
            setColor(value)
            setInputValue(value.hex)
        }
    }, [value])
    
    // ==================== 颜色更新处理 ====================
    
    const handleColorChange = useCallback((newColor: ColorPickerValue) => {
        setColor(newColor)
        setInputValue(newColor.hex)
        onChange(newColor)
        
        // 添加到历史记录
        if (showHistory && !history.includes(newColor.hex)) {
            setHistory(prev => {
                const updated = [newColor.hex, ...prev]
                return updated.slice(0, maxHistory)
            })
        }
    }, [onChange, showHistory, history, maxHistory])
    
    // ==================== 饱和度/明度选择器 ====================
    
    const handleSaturationMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (disabled) return
        
        const updateColor = (clientX: number, clientY: number) => {
            if (!saturationRef.current) return
            
            const rect = saturationRef.current.getBoundingClientRect()
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
            const y = Math.max(0, Math.min(clientY - rect.top, rect.height))
            
            const s = (x / rect.width) * 100
            const v = 100 - (y / rect.height) * 100
            
            const rgb = colorUtils.hsvToRgb(color.hsv.h, s, v)
            const hex = colorUtils.rgbToHex(rgb.r, rgb.g, rgb.b)
            const hsl = colorUtils.rgbToHsl(rgb.r, rgb.g, rgb.b)
            
            handleColorChange({
                hex,
                rgb,
                hsl,
                hsv: { h: color.hsv.h, s: Math.round(s), v: Math.round(v) },
                alpha: color.alpha
            })
        }
        
        updateColor(e.clientX, e.clientY)
        
        const handleMouseMove = (e: MouseEvent) => {
            updateColor(e.clientX, e.clientY)
        }
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
        
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [color, handleColorChange, disabled])
    
    // ==================== 色相选择器 ====================
    
    const handleHueMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (disabled) return
        
        const updateHue = (clientX: number) => {
            if (!hueRef.current) return
            
            const rect = hueRef.current.getBoundingClientRect()
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
            const h = (x / rect.width) * 360
            
            const rgb = colorUtils.hsvToRgb(h, color.hsv.s, color.hsv.v)
            const hex = colorUtils.rgbToHex(rgb.r, rgb.g, rgb.b)
            const hsl = colorUtils.rgbToHsl(rgb.r, rgb.g, rgb.b)
            
            handleColorChange({
                hex,
                rgb,
                hsl,
                hsv: { h: Math.round(h), s: color.hsv.s, v: color.hsv.v },
                alpha: color.alpha
            })
        }
        
        updateHue(e.clientX)
        
        const handleMouseMove = (e: MouseEvent) => {
            updateHue(e.clientX)
        }
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
        
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [color, handleColorChange, disabled])
    
    // ==================== 透明度选择器 ====================
    
    const handleAlphaMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (disabled) return
        
        const updateAlpha = (clientX: number) => {
            if (!alphaRef.current) return
            
            const rect = alphaRef.current.getBoundingClientRect()
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
            const alpha = x / rect.width
            
            handleColorChange({
                ...color,
                alpha: Math.round(alpha * 100) / 100
            })
        }
        
        updateAlpha(e.clientX)
        
        const handleMouseMove = (e: MouseEvent) => {
            updateAlpha(e.clientX)
        }
        
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
        
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [color, handleColorChange, disabled])
    
    // ==================== 输入框处理 ====================
    
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setInputValue(value)
        
        // 尝试解析颜色
        const parsed = colorUtils.parseColor(value)
        if (parsed) {
            handleColorChange(parsed)
        }
    }, [handleColorChange])
    
    const handleInputBlur = useCallback(() => {
        // 如果输入无效，恢复为当前颜色
        const parsed = colorUtils.parseColor(inputValue)
        if (!parsed) {
            setInputValue(color.hex)
        }
    }, [inputValue, color.hex])
    
    // ==================== 预设颜色选择 ====================
    
    const handlePresetClick = useCallback((preset: string) => {
        if (disabled) return
        const parsed = colorUtils.parseColor(preset)
        if (parsed) {
            handleColorChange(parsed)
        }
    }, [handleColorChange, disabled])
    
    // ==================== 计算样式 ====================
    
    const saturationStyle = useMemo(() => ({
        background: `hsl(${color.hsv.h}, 100%, 50%)`
    }), [color.hsv.h])
    
    const saturationPointerStyle = useMemo(() => ({
        left: `${color.hsv.s}%`,
        top: `${100 - color.hsv.v}%`
    }), [color.hsv.s, color.hsv.v])
    
    const huePointerStyle = useMemo(() => ({
        left: `${(color.hsv.h / 360) * 100}%`
    }), [color.hsv.h])
    
    const alphaPointerStyle = useMemo(() => ({
        left: `${color.alpha * 100}%`
    }), [color.alpha])
    
    const alphaGradientStyle = useMemo(() => ({
        background: `linear-gradient(to right, transparent, ${color.hex})`
    }), [color.hex])
    
    // ==================== 格式化颜色显示 ====================
    
    const formattedColor = useMemo(() => {
        switch (activeFormat) {
            case 'hex':
                return color.hex
            case 'rgb':
                return `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`
            case 'hsl':
                return `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`
            default:
                return color.hex
        }
    }, [color, activeFormat])
    
    // ==================== 渲染 ====================
    
    return (
        <div className={clsx('color-picker', className, disabled && 'opacity-50 pointer-events-none')}>
            {/* 饱和度/明度选择器 */}
            <div
                ref={saturationRef}
                className="relative w-full h-48 rounded-lg cursor-crosshair mb-4 select-none overflow-hidden"
                style={saturationStyle}
                onMouseDown={handleSaturationMouseDown}
            >
                {/* 白色到透明渐变（控制饱和度） */}
                <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                
                {/* 透明到黑色渐变（控制明度） */}
                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                
                {/* 指针 */}
                <div
                    className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={saturationPointerStyle}
                >
                    <div className="absolute inset-0.5 border border-black rounded-full" />
                </div>
            </div>
            
            {/* 色相选择器 */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    色相
                </label>
                <div
                    ref={hueRef}
                    className="relative h-3 rounded-full cursor-pointer select-none"
                    style={{
                        background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
                    }}
                    onMouseDown={handleHueMouseDown}
                >
                    {/* 指针 */}
                    <div
                        className="absolute top-1/2 w-4 h-4 bg-white border-2 border-gray-300 rounded-full shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={huePointerStyle}
                    />
                </div>
            </div>
            
            {/* 透明度选择器 */}
            {showAlpha && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        透明度: {Math.round(color.alpha * 100)}%
                    </label>
                    <div className="relative">
                        {/* 棋盘格背景 */}
                        <div
                            className="absolute inset-0 rounded-full"
                            style={{
                                backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                                backgroundSize: '8px 8px',
                                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                            }}
                        />
                        
                        <div
                            ref={alphaRef}
                            className="relative h-3 rounded-full cursor-pointer select-none"
                            style={alphaGradientStyle}
                            onMouseDown={handleAlphaMouseDown}
                        >
                            {/* 指针 */}
                            <div
                                className="absolute top-1/2 w-4 h-4 bg-white border-2 border-gray-300 rounded-full shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                style={alphaPointerStyle}
                            />
                        </div>
                    </div>
                </div>
            )}
            
            {/* 颜色预览和输入 */}
            <div className="flex items-center gap-3 mb-4">
                {/* 颜色预览 */}
                <div
                    className="w-12 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-sm flex-shrink-0"
                    style={{ backgroundColor: colorUtils.formatColor(color, 'hex') }}
                />
                
                {/* 颜色输入 */}
                <div className="flex-1">
                    <div className="flex gap-1 mb-1">
                        {(['hex', 'rgb', 'hsl'] as const).map(format => (
                            <button
                                key={format}
                                onClick={() => setActiveFormat(format)}
                                className={clsx(
                                    'px-2 py-1 text-xs rounded transition-colors',
                                    activeFormat === format
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                )}
                            >
                                {format.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onBlur={handleInputBlur}
                        disabled={disabled}
                        className={clsx(
                            'w-full px-3 py-2 text-sm rounded-lg border',
                            'bg-white dark:bg-gray-800',
                            'border-gray-300 dark:border-gray-600',
                            'text-gray-900 dark:text-white',
                            'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                            'font-mono',
                            'transition-colors'
                        )}
                    />
                </div>
            </div>
            
            {/* 预设颜色 */}
            {showPresets && presets.length > 0 && (
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        预设颜色
                    </label>
                    <div className="grid grid-cols-10 gap-1.5">
                        {presets.map((preset, index) => (
                            <button
                                key={index}
                                onClick={() => handlePresetClick(preset)}
                                className={clsx(
                                    'w-full aspect-square rounded border-2 transition-all hover:scale-110',
                                    color.hex.toLowerCase() === preset.toLowerCase()
                                        ? 'border-primary-500 ring-2 ring-primary-500 ring-offset-1'
                                        : 'border-gray-300 dark:border-gray-600'
                                )}
                                style={{ backgroundColor: preset }}
                                title={preset}
                            />
                        ))}
                    </div>
                </div>
            )}
            
            {/* 历史记录 */}
            {showHistory && history.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        最近使用
                    </label>
                    <div className="grid grid-cols-10 gap-1.5">
                        {history.map((historyColor, index) => (
                            <button
                                key={index}
                                onClick={() => handlePresetClick(historyColor)}
                                className={clsx(
                                    'w-full aspect-square rounded border-2 transition-all hover:scale-110',
                                    color.hex.toLowerCase() === historyColor.toLowerCase()
                                        ? 'border-primary-500 ring-2 ring-primary-500 ring-offset-1'
                                        : 'border-gray-300 dark:border-gray-600'
                                )}
                                style={{ backgroundColor: historyColor }}
                                title={historyColor}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ColorPicker

