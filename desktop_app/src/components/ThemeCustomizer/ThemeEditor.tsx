/**
 * 主题编辑器组件
 * 
 * 功能特性：
 * - 🎨 完整的主题颜色编辑
 * - 👁️ 实时预览
 * - 💾 撤销/重做功能
 * - 📦 导入/导出主题
 * - 🎯 预设主题模板
 * - 🔄 实时同步
 */

import React, { useState, useCallback, useMemo, useReducer } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { ColorPicker } from './ColorPicker'
import type { ThemeDetail, ThemeColors, ColorPickerValue } from '@/types/theme'
import * as colorUtils from '@/utils/colorUtils'

/**
 * 组件属性
 */
export interface ThemeEditorProps {
    /** 当前主题 */
    theme?: Partial<ThemeDetail>
    /** 主题变化回调 */
    onChange?: (theme: Partial<ThemeDetail>) => void
    /** 保存回调 */
    onSave?: (theme: Partial<ThemeDetail>) => void
    /** 取消回调 */
    onCancel?: () => void
    /** 自定义类名 */
    className?: string
}

/**
 * 颜色键类型
 */
type ColorKey = keyof ThemeColors

/**
 * 编辑器动作类型
 */
type EditorAction =
    | { type: 'SET_COLOR'; key: ColorKey; value: ColorPickerValue }
    | { type: 'SET_THEME'; theme: Partial<ThemeDetail> }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'RESET' }

/**
 * 编辑器状态
 */
interface EditorState {
    current: Partial<ThemeDetail>
    history: Partial<ThemeDetail>[]
    historyIndex: number
}

/**
 * 编辑器状态缩减器
 */
function editorReducer(state: EditorState, action: EditorAction): EditorState {
    switch (action.type) {
        case 'SET_COLOR': {
            const newTheme: Partial<ThemeDetail> = {
                ...state.current,
                variables: {
                    ...state.current.variables,
                    colors: {
                        ...state.current.variables?.colors,
                        [action.key]: colorUtils.createColorConfig(action.value)
                    } as ThemeColors
                } as any
            }
            
            // 添加到历史记录
            const newHistory = state.history.slice(0, state.historyIndex + 1)
            newHistory.push(newTheme)
            
            return {
                current: newTheme,
                history: newHistory,
                historyIndex: newHistory.length - 1
            }
        }
        
        case 'SET_THEME': {
            const newHistory = state.history.slice(0, state.historyIndex + 1)
            newHistory.push(action.theme)
            
            return {
                current: action.theme,
                history: newHistory,
                historyIndex: newHistory.length - 1
            }
        }
        
        case 'UNDO': {
            if (state.historyIndex > 0) {
                return {
                    ...state,
                    current: state.history[state.historyIndex - 1],
                    historyIndex: state.historyIndex - 1
                }
            }
            return state
        }
        
        case 'REDO': {
            if (state.historyIndex < state.history.length - 1) {
                return {
                    ...state,
                    current: state.history[state.historyIndex + 1],
                    historyIndex: state.historyIndex + 1
                }
            }
            return state
        }
        
        case 'RESET': {
            return {
                current: state.history[0],
                history: [state.history[0]],
                historyIndex: 0
            }
        }
        
        default:
            return state
    }
}

/**
 * 颜色配置定义
 */
const COLOR_CONFIGS: Array<{
    key: ColorKey
    label: string
    description: string
    icon: string
}> = [
    {
        key: 'primary',
        label: '主色调',
        description: '主要品牌颜色，用于按钮、链接等',
        icon: '🎨'
    },
    {
        key: 'secondary',
        label: '次要色',
        description: '辅助颜色，用于次要元素',
        icon: '🎭'
    },
    {
        key: 'background',
        label: '背景色',
        description: '页面主背景颜色',
        icon: '🖼️'
    },
    {
        key: 'foreground',
        label: '前景色',
        description: '文字等前景元素颜色',
        icon: '📝'
    },
    {
        key: 'accent',
        label: '强调色',
        description: '用于强调和高亮的颜色',
        icon: '✨'
    },
    {
        key: 'muted',
        label: '柔和色',
        description: '柔和的辅助背景色',
        icon: '🌫️'
    },
    {
        key: 'success',
        label: '成功色',
        description: '表示成功、完成的颜色',
        icon: '✅'
    },
    {
        key: 'warning',
        label: '警告色',
        description: '表示警告、注意的颜色',
        icon: '⚠️'
    },
    {
        key: 'destructive',
        label: '错误色',
        description: '表示错误、危险的颜色',
        icon: '❌'
    },
    {
        key: 'info',
        label: '信息色',
        description: '表示信息提示的颜色',
        icon: 'ℹ️'
    },
    {
        key: 'border',
        label: '边框色',
        description: '边框和分隔线颜色',
        icon: '📏'
    },
    {
        key: 'card',
        label: '卡片色',
        description: '卡片背景颜色',
        icon: '🃏'
    }
]

/**
 * 主题编辑器组件
 */
export const ThemeEditor: React.FC<ThemeEditorProps> = ({
    theme = {},
    onChange,
    onSave,
    onCancel,
    className
}) => {
    // ==================== 状态 ====================
    
    const [state, dispatch] = useReducer(editorReducer, {
        current: theme,
        history: [theme],
        historyIndex: 0
    })
    
    const [activeColorKey, setActiveColorKey] = useState<ColorKey>('primary')
    const [showColorPicker, setShowColorPicker] = useState(false)
    
    // ==================== 计算属性 ====================
    
    const canUndo = useMemo(() => state.historyIndex > 0, [state.historyIndex])
    const canRedo = useMemo(() => state.historyIndex < state.history.length - 1, [state.historyIndex, state.history.length])
    const hasChanges = useMemo(() => state.historyIndex > 0, [state.historyIndex])
    
    const currentColors = useMemo(() => {
        return state.current.variables?.colors || {} as Partial<ThemeColors>
    }, [state.current.variables?.colors])
    
    // ==================== 事件处理 ====================
    
    const handleColorChange = useCallback((key: ColorKey, value: ColorPickerValue) => {
        dispatch({ type: 'SET_COLOR', key, value })
        
        // 通知父组件
        if (onChange) {
            const updatedTheme: Partial<ThemeDetail> = {
                ...state.current,
                variables: {
                    ...state.current.variables,
                    colors: {
                        ...currentColors,
                        [key]: colorUtils.createColorConfig(value)
                    } as ThemeColors
                } as any
            }
            onChange(updatedTheme)
        }
    }, [state.current, currentColors, onChange])
    
    const handleUndo = useCallback(() => {
        dispatch({ type: 'UNDO' })
    }, [])
    
    const handleRedo = useCallback(() => {
        dispatch({ type: 'REDO' })
    }, [])
    
    const handleReset = useCallback(() => {
        if (window.confirm('确定要重置所有修改吗？此操作不可撤销。')) {
            dispatch({ type: 'RESET' })
            toast.success('已重置为初始状态')
        }
    }, [])
    
    const handleSave = useCallback(() => {
        if (onSave) {
            onSave(state.current)
            toast.success('主题已保存')
        }
    }, [state.current, onSave])
    
    const handleSelectColor = useCallback((key: ColorKey) => {
        setActiveColorKey(key)
        setShowColorPicker(true)
    }, [])
    
    const handleExport = useCallback(() => {
        try {
            const themeData = {
                theme: state.current,
                exportedAt: new Date().toISOString(),
                version: '1.0.0'
            }
            
            const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `theme-custom-${Date.now()}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            
            toast.success('主题导出成功')
        } catch (error) {
            console.error('导出主题失败:', error)
            toast.error('导出失败，请重试')
        }
    }, [state.current])
    
    const handleImport = useCallback(() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return
            
            try {
                const text = await file.text()
                const data = JSON.parse(text)
                
                if (!data.theme) {
                    throw new Error('无效的主题文件')
                }
                
                dispatch({ type: 'SET_THEME', theme: data.theme })
                if (onChange) {
                    onChange(data.theme)
                }
                toast.success('主题导入成功')
            } catch (error) {
                console.error('导入主题失败:', error)
                toast.error(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`)
            }
        }
        
        input.click()
    }, [onChange])
    
    // ==================== 渲染 ====================
    
    return (
        <div className={clsx('theme-editor', className)}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 左侧：颜色列表 */}
                <div>
                    {/* 工具栏 */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            主题颜色
                        </h3>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={handleUndo}
                                disabled={!canUndo}
                                title="撤销"
                                className={clsx(
                                    'p-2 rounded-lg transition-colors',
                                    canUndo
                                        ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                )}
                            >
                                ↶
                            </button>
                            <button
                                onClick={handleRedo}
                                disabled={!canRedo}
                                title="重做"
                                className={clsx(
                                    'p-2 rounded-lg transition-colors',
                                    canRedo
                                        ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                )}
                            >
                                ↷
                            </button>
                            <div className="w-px bg-gray-200 dark:bg-gray-700" />
                            <button
                                onClick={handleReset}
                                disabled={!hasChanges}
                                title="重置"
                                className={clsx(
                                    'px-3 py-2 text-sm rounded-lg transition-colors',
                                    hasChanges
                                        ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                )}
                            >
                                重置
                            </button>
                        </div>
                    </div>
                    
                    {/* 颜色列表 */}
                    <div className="space-y-3">
                        {COLOR_CONFIGS.map(config => {
                            const colorConfig = currentColors[config.key]
                            const hexColor = colorConfig?.hex || '#000000'
                            
                            return (
                                <motion.button
                                    key={config.key}
                                    onClick={() => handleSelectColor(config.key)}
                                    className={clsx(
                                        'w-full p-4 rounded-lg border-2 transition-all text-left',
                                        'hover:shadow-md',
                                        activeColorKey === config.key && showColorPicker
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                    )}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* 颜色预览 */}
                                        <div
                                            className="w-12 h-12 rounded-lg border-2 border-gray-300 dark:border-gray-600 flex-shrink-0"
                                            style={{ backgroundColor: hexColor }}
                                        />
                                        
                                        {/* 颜色信息 */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-lg">{config.icon}</span>
                                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    {config.label}
                                                </h4>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                                {config.description}
                                            </p>
                                            <code className="text-xs font-mono text-gray-500 dark:text-gray-500">
                                                {hexColor}
                                            </code>
                                        </div>
                                    </div>
                                </motion.button>
                            )
                        })}
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className={clsx(
                                'px-4 py-2 text-sm font-medium rounded-lg transition-colors flex-1',
                                hasChanges
                                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            )}
                        >
                            💾 保存主题
                        </button>
                        <button
                            onClick={handleExport}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            📤 导出
                        </button>
                        <button
                            onClick={handleImport}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            📥 导入
                        </button>
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                        )}
                    </div>
                </div>
                
                {/* 右侧：颜色选择器 */}
                <div>
                    <AnimatePresence mode="wait">
                        {showColorPicker && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="sticky top-4"
                            >
                                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {COLOR_CONFIGS.find(c => c.key === activeColorKey)?.label}
                                        </h3>
                                        <button
                                            onClick={() => setShowColorPicker(false)}
                                            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    
                                    <ColorPicker
                                        value={currentColors[activeColorKey]?.hex || '#000000'}
                                        onChange={(color) => handleColorChange(activeColorKey, color)}
                                        showAlpha={false}
                                        showPresets={true}
                                        showHistory={true}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

export default ThemeEditor

