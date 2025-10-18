/**
 * useModelHotReload Hook
 * 实现角色模型热加载功能
 * 
 * 功能：
 * - 监听模型文件变化
 * - 自动重新加载模型
 * - 提供手动刷新接口
 * - 缓存失效管理
 */

import { useEffect, useCallback, useRef, useState } from 'react'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { modelManager } from '@/utils/modelManager'

export interface HotReloadOptions {
    /** 是否启用热加载 */
    enabled?: boolean
    /** 热加载延迟 (ms) */
    debounceDelay?: number
    /** 是否在热加载时显示通知 */
    showNotification?: boolean
    /** 热加载成功回调 */
    onReloadSuccess?: (modelId: string) => void
    /** 热加载失败回调 */
    onReloadError?: (error: Error) => void
}

export interface HotReloadState {
    /** 是否正在重新加载 */
    isReloading: boolean
    /** 最后一次重新加载的时间 */
    lastReloadTime: number | null
    /** 重新加载计数 */
    reloadCount: number
}

/**
 * useModelHotReload Hook
 * 
 * @example
 * ```tsx
 * const { reload, reloadAll, state } = useModelHotReload({
 *   enabled: true,
 *   onReloadSuccess: (modelId) => {
 *     console.log('模型重新加载成功:', modelId)
 *   }
 * })
 * ```
 */
export const useModelHotReload = (options: HotReloadOptions = {}) => {
    const {
        enabled = true,
        debounceDelay = 500,
        showNotification = true,
        onReloadSuccess,
        onReloadError,
    } = options

    const [state, setState] = useState<HotReloadState>({
        isReloading: false,
        lastReloadTime: null,
        reloadCount: 0,
    })

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    const unlistenRef = useRef<UnlistenFn | null>(null)

    /**
     * 重新加载指定模型
     */
    const reload = useCallback(async (modelId: string) => {
        setState(prev => ({ ...prev, isReloading: true }))

        try {
            // 清除模型缓存
            modelManager.clearCache()
            
            // 重新创建模型配置
            await modelManager.createModelConfig(modelId)
            
            setState(prev => ({
                isReloading: false,
                lastReloadTime: Date.now(),
                reloadCount: prev.reloadCount + 1,
            }))

            if (showNotification) {
                console.log(`✅ 模型热加载成功: ${modelId}`)
            }

            onReloadSuccess?.(modelId)
        } catch (error) {
            console.error(`❌ 模型热加载失败: ${modelId}`, error)
            setState(prev => ({ ...prev, isReloading: false }))
            onReloadError?.(error as Error)
        }
    }, [showNotification, onReloadSuccess, onReloadError])

    /**
     * 重新加载所有模型缓存
     */
    const reloadAll = useCallback(async () => {
        setState(prev => ({ ...prev, isReloading: true }))

        try {
            // 清除所有缓存
            modelManager.clearCache()
            
            // 重新加载模型库
            await modelManager.loadModelLibrary()
            
            setState(prev => ({
                isReloading: false,
                lastReloadTime: Date.now(),
                reloadCount: prev.reloadCount + 1,
            }))

            if (showNotification) {
                console.log('✅ 所有模型热加载成功')
            }

            onReloadSuccess?.('all')
        } catch (error) {
            console.error('❌ 模型热加载失败', error)
            setState(prev => ({ ...prev, isReloading: false }))
            onReloadError?.(error as Error)
        }
    }, [showNotification, onReloadSuccess, onReloadError])

    /**
     * 带防抖的重新加载
     */
    const debouncedReload = useCallback((modelId: string) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        debounceTimerRef.current = setTimeout(() => {
            reload(modelId)
        }, debounceDelay)
    }, [reload, debounceDelay])

    /**
     * 清除模型缓存
     */
    const clearCache = useCallback(() => {
        modelManager.clearCache()
        console.log('🗑️ 模型缓存已清除')
    }, [])

    /**
     * 监听文件变化事件
     */
    useEffect(() => {
        if (!enabled) return

        const setupListener = async () => {
            try {
                // 监听模型文件变化事件
                const unlisten = await listen<{ path: string }>('model-file-changed', (event) => {
                    console.log('📁 检测到模型文件变化:', event.payload.path)
                    
                    // 提取模型ID（假设路径包含模型ID）
                    const pathParts = event.payload.path.split('/')
                    const modelIndex = pathParts.findIndex(part => part === 'live2d_models')
                    if (modelIndex !== -1 && pathParts.length > modelIndex + 1) {
                        const modelId = pathParts[modelIndex + 1]
                        debouncedReload(modelId)
                    } else {
                        // 无法确定具体模型，重新加载所有
                        reloadAll()
                    }
                })

                unlistenRef.current = unlisten
            } catch (error) {
                console.error('❌ 设置文件监听失败:', error)
            }
        }

        setupListener()

        return () => {
            if (unlistenRef.current) {
                unlistenRef.current()
            }
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [enabled, debouncedReload, reloadAll])

    /**
     * 开发模式下的键盘快捷键
     */
    useEffect(() => {
        if (!enabled || process.env.NODE_ENV !== 'development') return

        const handleKeyPress = (event: KeyboardEvent) => {
            // Ctrl/Cmd + Shift + R: 重新加载当前模型
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'R') {
                event.preventDefault()
                const currentModelId = modelManager.getCurrentModelId()
                reload(currentModelId)
                console.log('⌨️ 快捷键触发重新加载:', currentModelId)
            }
            
            // Ctrl/Cmd + Shift + Alt + R: 重新加载所有模型
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.altKey && event.key === 'R') {
                event.preventDefault()
                reloadAll()
                console.log('⌨️ 快捷键触发重新加载所有模型')
            }
        }

        window.addEventListener('keydown', handleKeyPress)
        return () => window.removeEventListener('keydown', handleKeyPress)
    }, [enabled, reload, reloadAll])

    return {
        /** 重新加载指定模型 */
        reload,
        /** 重新加载所有模型 */
        reloadAll,
        /** 清除缓存 */
        clearCache,
        /** 热加载状态 */
        state,
    }
}

/**
 * 获取模型热加载统计信息
 */
export const useModelHotReloadStats = () => {
    const [stats, setStats] = useState({
        totalReloads: 0,
        lastReloadTime: null as number | null,
        averageReloadTime: 0,
        failedReloads: 0,
    })

    const recordReload = useCallback((success: boolean, duration: number) => {
        setStats(prev => ({
            totalReloads: prev.totalReloads + 1,
            lastReloadTime: Date.now(),
            averageReloadTime: 
                (prev.averageReloadTime * prev.totalReloads + duration) / (prev.totalReloads + 1),
            failedReloads: success ? prev.failedReloads : prev.failedReloads + 1,
        }))
    }, [])

    const resetStats = useCallback(() => {
        setStats({
            totalReloads: 0,
            lastReloadTime: null,
            averageReloadTime: 0,
            failedReloads: 0,
        })
    }, [])

    return {
        stats,
        recordReload,
        resetStats,
    }
}

