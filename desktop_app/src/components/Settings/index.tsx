/**
 * 设置组件主入口
 * 
 * 功能特性：
 * - 🎨 响应式侧边栏导航
 * - 📱 多标签页管理（通用、角色、主题、系统、高级）
 * - ⚡ 实时设置同步和验证
 * - 💾 自动保存和手动保存
 * - 🔄 配置导入导出
 * - 🛡️ 错误处理和恢复
 * - ♿ 无障碍支持
 * - 🎭 流畅的动画过渡
 */

import { AnimatePresence, motion } from 'framer-motion'
import React, { useCallback, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

// Hooks
import { useSettings } from '@/hooks/useSettings'
import { useTauri } from '@/hooks/useTauri'

// 子组件
import { GeneralSettings } from './GeneralSettings'
import { CharacterSettings } from './CharacterSettings'
import { ThemeSettings } from './ThemeSettings'

// 类型
import type { AppConfig } from '@/types/settings'

/**
 * 设置标签页类型
 */
export type SettingsTab = 'general' | 'character' | 'theme' | 'system' | 'advanced'

/**
 * 标签页配置
 */
interface TabConfig {
    id: SettingsTab
    label: string
    icon: string
    description: string
    component: React.ComponentType<any>
}

/**
 * 组件属性
 */
export interface SettingsProps {
    /** 初始标签页 */
    initialTab?: SettingsTab
    /** 关闭回调 */
    onClose?: () => void
    /** 重置回调 */
    onReset?: () => void
    /** 是否显示头部 */
    showHeader?: boolean
    /** 是否显示侧边栏 */
    showSidebar?: boolean
    /** 自定义样式类名 */
    className?: string
}

/**
 * 动画变体
 */
const ANIMATION_VARIANTS = {
    sidebar: {
        initial: { x: -20, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: -20, opacity: 0 },
    },
    content: {
        initial: { x: 20, opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: 20, opacity: 0 },
    },
    header: {
        initial: { y: -20, opacity: 0 },
        animate: { y: 0, opacity: 1 },
    },
}

/**
 * 设置组件主入口
 */
export const Settings: React.FC<SettingsProps> = ({
    initialTab = 'general',
    onClose,
    onReset,
    showHeader = true,
    showSidebar = true,
    className,
}) => {
    // ==================== 状态管理 ====================
    const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)
    const [isSaving, setIsSaving] = useState(false)
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

    // ==================== Hooks ====================
    const {
        config,
        isLoading,
        error,
        updateConfig,
        resetConfig,
        exportSettings,
        importSettings,
        syncStatus,
    } = useSettings()

    const { } = useTauri()

    // ==================== 标签页配置 ====================
    const tabs: TabConfig[] = useMemo(() => [
        {
            id: 'general',
            label: '通用设置',
            icon: '⚙️',
            description: '窗口、显示和基础配置',
            component: GeneralSettings,
        },
        {
            id: 'character',
            label: '角色设置',
            icon: '🎭',
            description: '角色外观和行为配置',
            component: CharacterSettings,
        },
        {
            id: 'theme',
            label: '主题设置',
            icon: '🎨',
            description: '界面主题和自定义样式',
            component: ThemeSettings,
        },
        {
            id: 'system',
            label: '系统设置',
            icon: '💻',
            description: '系统集成和高级选项',
            component: () => (
                <div className="p-8 text-center text-gray-500">
                    <p className="text-lg">系统设置组件开发中...</p>
                </div>
            ),
        },
        {
            id: 'advanced',
            label: '高级设置',
            icon: '🔧',
            description: '开发者选项和调试工具',
            component: () => (
                <div className="p-8 text-center text-gray-500">
                    <p className="text-lg">高级设置组件开发中...</p>
                </div>
            ),
        },
    ], [])

    // ==================== 事件处理 ====================

    /**
     * 切换标签页
     */
    const handleTabChange = useCallback((tabId: SettingsTab) => {
        if (hasUnsavedChanges) {
            const confirmed = window.confirm('有未保存的更改，确定要切换标签页吗？')
            if (!confirmed) return
        }
        setActiveTab(tabId)
        setHasUnsavedChanges(false)
    }, [hasUnsavedChanges])

    /**
     * 保存设置
     */
    const handleSave = useCallback(async () => {
        if (isSaving) return

        setIsSaving(true)
        const toastId = toast.loading('正在保存设置...')

        try {
            await updateConfig(config)
            setHasUnsavedChanges(false)
            toast.success('设置保存成功', { id: toastId })
        } catch (error) {
            console.error('保存设置失败:', error)
            toast.error(
                `保存失败: ${error instanceof Error ? error.message : '未知错误'}`,
                { id: toastId }
            )
        } finally {
            setIsSaving(false)
        }
    }, [config, updateConfig, isSaving])

    /**
     * 重置设置
     */
    const handleReset = useCallback(async () => {
        const confirmed = window.confirm(
            '确定要重置为默认设置吗？此操作无法撤销。'
        )
        if (!confirmed) return

        const toastId = toast.loading('正在重置设置...')

        try {
            await resetConfig()
            setHasUnsavedChanges(false)
            toast.success('设置已重置为默认值', { id: toastId })
            onReset?.()
        } catch (error) {
            console.error('重置设置失败:', error)
            toast.error(
                `重置失败: ${error instanceof Error ? error.message : '未知错误'}`,
                { id: toastId }
            )
        }
    }, [resetConfig, onReset])

    /**
     * 导出设置
     */
    const handleExport = useCallback(async () => {
        const toastId = toast.loading('正在导出设置...')

        try {
            const settingsJson = await exportSettings()
            
            // 创建下载链接
            const blob = new Blob([settingsJson], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `zishu-settings-${Date.now()}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            toast.success('设置导出成功', { id: toastId })
        } catch (error) {
            console.error('导出设置失败:', error)
            toast.error(
                `导出失败: ${error instanceof Error ? error.message : '未知错误'}`,
                { id: toastId }
            )
        }
    }, [exportSettings])

    /**
     * 导入设置
     */
    const handleImport = useCallback(async () => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'
        
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return

            const toastId = toast.loading('正在导入设置...')

            try {
                const text = await file.text()
                await importSettings(text)
                toast.success('设置导入成功', { id: toastId })
            } catch (error) {
                console.error('导入设置失败:', error)
                toast.error(
                    `导入失败: ${error instanceof Error ? error.message : '未知错误'}`,
                    { id: toastId }
                )
            }
        }

        input.click()
    }, [importSettings])

    /**
     * 关闭设置面板
     */
    const handleClose = useCallback(() => {
        if (hasUnsavedChanges) {
            const confirmed = window.confirm('有未保存的更改，确定要关闭吗？')
            if (!confirmed) return
        }
        onClose?.()
    }, [hasUnsavedChanges, onClose])

    // ==================== 渲染当前标签页组件 ====================
    const ActiveTabComponent = useMemo(() => {
        const tabConfig = tabs.find(tab => tab.id === activeTab)
        return tabConfig?.component || null
    }, [activeTab, tabs])

    // ==================== 加载状态 ====================
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
                <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">正在加载设置...</p>
                </div>
            </div>
        )
    }

    // ==================== 错误状态 ====================
    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
                <div className="text-center max-w-md p-6">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        设置加载失败
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {error.message}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                        重新加载
                    </button>
                </div>
            </div>
        )
    }

    // ==================== 主渲染 ====================
    return (
        <div
            className={clsx(
                'settings-container',
                'flex flex-col h-full',
                'bg-white dark:bg-gray-900',
                'transition-colors duration-200',
                className
            )}
        >
            {/* 头部 */}
            {showHeader && (
                <motion.header
                    className="settings-header flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800"
                    variants={ANIMATION_VARIANTS.header}
                    initial="initial"
                    animate="animate"
                >
                    <div className="flex items-center space-x-3">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            设置
                        </h1>
                        {syncStatus === 'syncing' && (
                            <span className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-primary-500 border-r-transparent mr-2" />
                                同步中...
                            </span>
                        )}
                        {hasUnsavedChanges && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded">
                                未保存
                            </span>
                        )}
                    </div>

                    <div className="flex items-center space-x-2">
                        {/* 导入导出按钮 */}
                        <button
                            onClick={handleImport}
                            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="导入设置"
                        >
                            📥 导入
                        </button>
                        <button
                            onClick={handleExport}
                            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="导出设置"
                        >
                            📤 导出
                        </button>

                        {/* 重置按钮 */}
                        <button
                            onClick={handleReset}
                            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="重置为默认设置"
                        >
                            🔄 重置
                        </button>

                        {/* 保存按钮 */}
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !hasUnsavedChanges}
                            className={clsx(
                                'px-4 py-1.5 text-sm font-medium rounded-lg transition-colors',
                                isSaving || !hasUnsavedChanges
                                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                    : 'bg-primary-500 text-white hover:bg-primary-600'
                            )}
                        >
                            {isSaving ? '保存中...' : '保存'}
                        </button>

                        {/* 关闭按钮 */}
                        {onClose && (
                            <button
                                onClick={handleClose}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                title="关闭设置"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </motion.header>
            )}

            {/* 主体内容区 */}
            <div className="settings-body flex flex-1 overflow-hidden">
                {/* 侧边栏导航 */}
                {showSidebar && (
                    <motion.aside
                        className="settings-sidebar w-64 border-r border-gray-200 dark:border-gray-800 overflow-y-auto"
                        variants={ANIMATION_VARIANTS.sidebar}
                        initial="initial"
                        animate="animate"
                    >
                        <nav className="p-4 space-y-1">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className={clsx(
                                        'w-full flex items-start p-3 rounded-lg transition-colors text-left',
                                        activeTab === tab.id
                                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    )}
                                >
                                    <span className="text-2xl mr-3 flex-shrink-0">
                                        {tab.icon}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium mb-0.5">
                                            {tab.label}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {tab.description}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </nav>
                    </motion.aside>
                )}

                {/* 内容区域 */}
                <main className="settings-content flex-1 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            variants={ANIMATION_VARIANTS.content}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            {ActiveTabComponent && (
                                <ActiveTabComponent
                                    config={config}
                                    onConfigChange={(newConfig: AppConfig) => {
                                        setHasUnsavedChanges(true)
                                        updateConfig(newConfig).catch(console.error)
                                    }}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    )
}

/**
 * 默认导出
 */
export default Settings

