/**
 * 设置窗口布局组件
 * 
 * 功能特性：
 * - 🪟 完整的设置窗口布局（头部、侧边栏、内容区）
 * - 🎨 响应式设计，适配不同屏幕尺寸
 * - ⚡ 流畅的动画过渡效果
 * - 💾 集成设置组件，提供完整配置功能
 * - 🔄 支持窗口拖拽和大小调整
 * - 📱 支持键盘快捷键操作
 * - ♿ 完整的无障碍支持
 * - 🛡️ 错误边界和状态处理
 */

import React, { useCallback, useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import toast, { Toaster } from 'react-hot-toast'

// 类型
import type { SettingsTab } from '@/components/Settings'

// Hooks
import { useSettings } from '@/hooks/useSettings'
import { useTauri } from '@/hooks/useTauri'
import { useWindowManager } from '@/hooks/useWindowManager'

// 组件
import { Settings } from '@/components/Settings'

// 样式
import styles from './SettingsWindow.module.css'

/**
 * 组件属性
 */
export interface SettingsWindowProps {
    /** 初始标签页 */
    initialTab?: SettingsTab
    /** 是否显示 */
    isOpen?: boolean
    /** 关闭回调 */
    onClose?: () => void
    /** 窗口标题 */
    title?: string
    /** 自定义样式类名 */
    className?: string
    /** 是否可拖拽 */
    draggable?: boolean
    /** 是否可调整大小 */
    resizable?: boolean
    /** 是否显示头部 */
    showHeader?: boolean
    /** 是否显示侧边栏 */
    showSidebar?: boolean
}

/**
 * 窗口尺寸常量
 */
const WINDOW_CONSTANTS = {
    MIN_WIDTH: 800,
    MIN_HEIGHT: 600,
    DEFAULT_WIDTH: 1000,
    DEFAULT_HEIGHT: 700,
    MAX_WIDTH: 1600,
    MAX_HEIGHT: 1200,
}

/**
 * 设置窗口布局组件
 */
export const SettingsWindow: React.FC<SettingsWindowProps> = ({
    initialTab = 'general',
    isOpen = true,
    onClose,
    title = '设置',
    className,
    draggable = true,
    resizable = true,
    showHeader = true,
    showSidebar = true,
}) => {
    // ==================== 状态 ====================
    const [windowSize, setWindowSize] = useState({
        width: WINDOW_CONSTANTS.DEFAULT_WIDTH,
        height: WINDOW_CONSTANTS.DEFAULT_HEIGHT,
    })
    const [windowPosition, setWindowPosition] = useState({ x: 0, y: 0 })
    const [isMaximized, setIsMaximized] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)

    // ==================== Refs ====================
    const windowRef = useRef<HTMLDivElement>(null)
    const dragStartPos = useRef({ x: 0, y: 0 })
    const resizeStartSize = useRef({ width: 0, height: 0 })
    const resizeStartPos = useRef({ x: 0, y: 0 })

    // ==================== Hooks ====================
    const {
        error,
        clearError,
    } = useSettings()

    const { isAvailable, invoke } = useTauri()
    const { center, closeWindow } = useWindowManager()

    // ==================== 生命周期 ====================

    // 居中窗口
    useEffect(() => {
        if (isOpen && isAvailable) {
            center().catch(console.error)
        }
    }, [isOpen, isAvailable, center])

    // 监听窗口大小变化
    useEffect(() => {
        const handleResize = () => {
            if (windowRef.current) {
                const rect = windowRef.current.getBoundingClientRect()
                setWindowSize({
                    width: rect.width,
                    height: rect.height,
                })
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    // 键盘快捷键
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ESC 关闭
            if (e.key === 'Escape' && isOpen) {
                handleClose()
            }
            // Ctrl/Cmd + S 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                // 保存逻辑由 Settings 组件处理
            }
            // Ctrl/Cmd + W 关闭
            if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
                e.preventDefault()
                handleClose()
            }
        }

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown)
            return () => window.removeEventListener('keydown', handleKeyDown)
        }
    }, [isOpen])

    // ==================== 事件处理 ====================

    /**
     * 关闭窗口
     */
    const handleClose = useCallback(async () => {
        try {
            if (isAvailable) {
                await closeWindow()
            }
            onClose?.()
        } catch (error) {
            console.error('关闭窗口失败:', error)
            onClose?.()
        }
    }, [isAvailable, closeWindow, onClose])

    /**
     * 最小化窗口
     */
    const handleMinimize = useCallback(async () => {
        try {
            if (isAvailable) {
                await invoke('minimize_window')
                toast.success('窗口已最小化')
            }
        } catch (error) {
            console.error('最小化窗口失败:', error)
            toast.error('最小化失败')
        }
    }, [isAvailable, invoke])

    /**
     * 最大化/还原窗口
     */
    const handleMaximize = useCallback(async () => {
        try {
            if (isAvailable) {
                const newMaximized = !isMaximized
                await invoke(newMaximized ? 'maximize_window' : 'unmaximize_window')
                setIsMaximized(newMaximized)
                toast.success(newMaximized ? '窗口已最大化' : '窗口已还原')
            }
        } catch (error) {
            console.error('最大化窗口失败:', error)
            toast.error('操作失败')
        }
    }, [isAvailable, invoke, isMaximized])

    /**
     * 开始拖拽
     */
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if (!draggable) return

        setIsDragging(true)
        dragStartPos.current = {
            x: e.clientX - windowPosition.x,
            y: e.clientY - windowPosition.y,
        }

        e.preventDefault()
    }, [draggable, windowPosition])

    /**
     * 拖拽中
     */
    const handleDragMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return

        const newX = e.clientX - dragStartPos.current.x
        const newY = e.clientY - dragStartPos.current.y

        setWindowPosition({ x: newX, y: newY })
    }, [isDragging])

    /**
     * 结束拖拽
     */
    const handleDragEnd = useCallback(() => {
        setIsDragging(false)
    }, [])

    // 监听拖拽事件
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDragMove)
            window.addEventListener('mouseup', handleDragEnd)
            return () => {
                window.removeEventListener('mousemove', handleDragMove)
                window.removeEventListener('mouseup', handleDragEnd)
            }
        }
    }, [isDragging, handleDragMove, handleDragEnd])

    /**
     * 开始调整大小
     */
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        if (!resizable) return

        setIsResizing(true)
        resizeStartSize.current = { ...windowSize }
        resizeStartPos.current = { x: e.clientX, y: e.clientY }

        e.preventDefault()
        e.stopPropagation()
    }, [resizable, windowSize])

    /**
     * 调整大小中
     */
    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!isResizing) return

        const deltaX = e.clientX - resizeStartPos.current.x
        const deltaY = e.clientY - resizeStartPos.current.y

        const newWidth = Math.max(
            WINDOW_CONSTANTS.MIN_WIDTH,
            Math.min(
                WINDOW_CONSTANTS.MAX_WIDTH,
                resizeStartSize.current.width + deltaX
            )
        )

        const newHeight = Math.max(
            WINDOW_CONSTANTS.MIN_HEIGHT,
            Math.min(
                WINDOW_CONSTANTS.MAX_HEIGHT,
                resizeStartSize.current.height + deltaY
            )
        )

        setWindowSize({ width: newWidth, height: newHeight })
    }, [isResizing])

    /**
     * 结束调整大小
     */
    const handleResizeEnd = useCallback(() => {
        setIsResizing(false)
    }, [])

    // 监听调整大小事件
    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleResizeMove)
            window.addEventListener('mouseup', handleResizeEnd)
            return () => {
                window.removeEventListener('mousemove', handleResizeMove)
                window.removeEventListener('mouseup', handleResizeEnd)
            }
        }
    }, [isResizing, handleResizeMove, handleResizeEnd])

    // ==================== 渲染 ====================

    if (!isOpen) {
        return null
    }

    return (
        <>
            {/* Toast 通知容器 */}
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: 'var(--color-background)',
                        color: 'var(--color-text)',
                    },
                }}
            />

            {/* 遮罩层 */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className={styles.overlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleClose}
                    />
                )}
            </AnimatePresence>

            {/* 设置窗口 */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={windowRef}
                        className={clsx(
                            styles.settingsWindow,
                            isDragging && styles.dragging,
                            isResizing && styles.resizing,
                            isMaximized && styles.maximized,
                            className
                        )}
                        style={{
                            width: isMaximized ? '100%' : windowSize.width,
                            height: isMaximized ? '100%' : windowSize.height,
                            transform: isMaximized
                                ? 'none'
                                : `translate(${windowPosition.x}px, ${windowPosition.y}px)`,
                        }}
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 自定义标题栏 */}
                        <div
                            className={styles.titleBar}
                            onMouseDown={handleDragStart}
                            role="banner"
                        >
                            <div className={styles.titleBarLeft}>
                                <span className={styles.titleBarIcon}>⚙️</span>
                                <h1 className={styles.titleBarTitle}>{title}</h1>
                            </div>

                            <div className={styles.titleBarRight}>
                                {/* 最小化按钮 */}
                                <button
                                    className={clsx(styles.titleBarButton, styles.minimizeButton)}
                                    onClick={handleMinimize}
                                    title="最小化"
                                    aria-label="最小化窗口"
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <line x1="0" y1="6" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" />
                                    </svg>
                                </button>

                                {/* 最大化/还原按钮 */}
                                <button
                                    className={clsx(styles.titleBarButton, styles.maximizeButton)}
                                    onClick={handleMaximize}
                                    title={isMaximized ? '还原' : '最大化'}
                                    aria-label={isMaximized ? '还原窗口' : '最大化窗口'}
                                >
                                    {isMaximized ? (
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                            <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                        </svg>
                                    ) : (
                                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                            <rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                        </svg>
                                    )}
                                </button>

                                {/* 关闭按钮 */}
                                <button
                                    className={clsx(styles.titleBarButton, styles.closeButton)}
                                    onClick={handleClose}
                                    title="关闭"
                                    aria-label="关闭窗口"
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
                                        <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* 设置内容 */}
                        <div className={styles.settingsContent}>
                            <Settings
                                initialTab={initialTab}
                                onClose={handleClose}
                                showHeader={showHeader}
                                showSidebar={showSidebar}
                            />
                        </div>

                        {/* 调整大小手柄 */}
                        {resizable && !isMaximized && (
                            <div
                                className={styles.resizeHandle}
                                onMouseDown={handleResizeStart}
                                aria-label="调整窗口大小"
                                role="button"
                                tabIndex={0}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path
                                        d="M14 10L10 14M14 6L6 14M14 2L2 14"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </div>
                        )}

                        {/* 错误提示 */}
                        {error && (
                            <motion.div
                                className={styles.errorBanner}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <span className={styles.errorIcon}>⚠️</span>
                                <span className={styles.errorMessage}>
                                    {error.message}
                                </span>
                                <button
                                    className={styles.errorClose}
                                    onClick={clearError}
                                    aria-label="关闭错误提示"
                                >
                                    ✕
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

/**
 * 默认导出
 */
export default SettingsWindow

