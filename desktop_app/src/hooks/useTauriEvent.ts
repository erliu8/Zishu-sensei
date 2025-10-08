/**
 * Tauri 事件 Hook
 * 
 * 提供类型安全的 Tauri 事件监听 React Hook
 */

import type { UnlistenFn } from '@tauri-apps/api/event'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createEventListenerGroup, eventService } from '../services/tauri/events'
import type {
    AppEventType,
    EventListenerState,
    ExtractEventPayload
} from '../types/tauri'

/**
 * Tauri 事件监听 Hook
 */
export function useTauriEvent<T extends AppEventType>(
    eventName: T,
    callback?: (payload: ExtractEventPayload<T>) => void | Promise<void>,
    options: {
        immediate?: boolean
        maxHistory?: number
        enabled?: boolean
    } = {}
): EventListenerState<ExtractEventPayload<T>> & {
    emit: (payload?: ExtractEventPayload<T>) => Promise<void>
} {
    const [state, setState] = useState<EventListenerState<ExtractEventPayload<T>>>({
        data: [],
        loading: false,
        error: null,
        isReady: false,
        events: [],
        lastEvent: null,
        subscribe: async () => () => { },
        unsubscribe: () => { },
        clear: () => { }
    })

    const unlistenRef = useRef<UnlistenFn | null>(null)
    const { immediate = true, maxHistory = 50, enabled = true } = options

    /**
     * 订阅事件
     */
    const subscribe = useCallback(async () => {
        if (!enabled) {
            return () => { }
        }

        setState(prev => ({ ...prev, loading: true, error: null }))

        try {
            const unlisten = await eventService.listen(eventName, async (payload) => {
                setState(prev => {
                    const newEvent = payload
                    const newEvents = [newEvent, ...prev.events].slice(0, maxHistory)

                    return {
                        ...prev,
                        events: newEvents,
                        lastEvent: newEvent,
                        data: newEvents,
                        loading: false,
                        isReady: true
                    }
                })

                // 执行回调
                if (callback) {
                    try {
                        await callback(payload)
                    } catch (error) {
                        console.error(`Event callback error for '${eventName}':`, error)
                        setState(prev => ({
                            ...prev,
                            error: error instanceof Error ? error.message : String(error)
                        }))
                    }
                }
            })

            unlistenRef.current = unlisten
            setState(prev => ({ ...prev, loading: false, isReady: true }))

            return unlisten
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            setState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage,
                isReady: false
            }))
            throw error
        }
    }, [eventName, callback, enabled, maxHistory])

    /**
     * 取消订阅
     */
    const unsubscribe = useCallback(() => {
        if (unlistenRef.current) {
            unlistenRef.current()
            unlistenRef.current = null
        }
        setState(prev => ({ ...prev, isReady: false }))
    }, [])

    /**
     * 清除事件历史
     */
    const clear = useCallback(() => {
        setState(prev => ({
            ...prev,
            events: [],
            lastEvent: null,
            data: []
        }))
    }, [])

    /**
     * 发送事件
     */
    const emit = useCallback(async (payload?: ExtractEventPayload<T>) => {
        try {
            await eventService.emit(eventName, payload)
        } catch (error) {
            console.error(`Failed to emit event '${eventName}':`, error)
            throw error
        }
    }, [eventName])

    // 更新状态中的函数
    useEffect(() => {
        setState(prev => ({
            ...prev,
            subscribe,
            unsubscribe,
            clear
        }))
    }, [subscribe, unsubscribe, clear])

    // 自动订阅
    useEffect(() => {
        if (immediate && enabled) {
            subscribe().catch(console.error)
        }

        return () => {
            unsubscribe()
        }
    }, [immediate, enabled, subscribe, unsubscribe])

    return {
        ...state,
        emit
    }
}

/**
 * 一次性事件监听 Hook
 */
export function useTauriEventOnce<T extends AppEventType>(
    eventName: T,
    callback?: (payload: ExtractEventPayload<T>) => void | Promise<void>,
    options: {
        enabled?: boolean
    } = {}
): {
    data: ExtractEventPayload<T> | null
    loading: boolean
    error: string | null
    isReady: boolean
    listen: () => Promise<void>
    emit: (payload?: ExtractEventPayload<T>) => Promise<void>
} {
    const [data, setData] = useState<ExtractEventPayload<T> | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isReady, setIsReady] = useState(false)

    const { enabled = true } = options

    /**
     * 监听一次
     */
    const listen = useCallback(async () => {
        if (!enabled) return

        setLoading(true)
        setError(null)

        try {
            await eventService.once(eventName, async (payload) => {
                setData(payload)
                setIsReady(true)

                if (callback) {
                    try {
                        await callback(payload)
                    } catch (error) {
                        console.error(`Event callback error for '${eventName}':`, error)
                        setError(error instanceof Error ? error.message : String(error))
                    }
                }
            })
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }, [eventName, callback, enabled])

    /**
     * 发送事件
     */
    const emit = useCallback(async (payload?: ExtractEventPayload<T>) => {
        try {
            await eventService.emit(eventName, payload)
        } catch (error) {
            console.error(`Failed to emit event '${eventName}':`, error)
            throw error
        }
    }, [eventName])

    return {
        data,
        loading,
        error,
        isReady,
        listen,
        emit
    }
}

/**
 * 多事件监听 Hook
 */
export function useTauriEvents<T extends AppEventType>(
    eventNames: T[],
    callback?: (eventName: T, payload: ExtractEventPayload<T>) => void | Promise<void>,
    options: {
        immediate?: boolean
        maxHistory?: number
        enabled?: boolean
    } = {}
): {
    events: Array<{ eventName: T; payload: ExtractEventPayload<T>; timestamp: number }>
    loading: boolean
    error: string | null
    isReady: boolean
    subscribe: () => Promise<void>
    unsubscribe: () => void
    clear: () => void
    emit: (eventName: T, payload?: ExtractEventPayload<T>) => Promise<void>
} {
    const [events, setEvents] = useState<Array<{
        eventName: T
        payload: ExtractEventPayload<T>
        timestamp: number
    }>>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isReady, setIsReady] = useState(false)

    const listenerGroupRef = useRef(createEventListenerGroup())
    const { immediate = true, maxHistory = 100, enabled = true } = options

    /**
     * 订阅所有事件
     */
    const subscribe = useCallback(async () => {
        if (!enabled) return

        setLoading(true)
        setError(null)

        try {
            const group = listenerGroupRef.current

            // 为每个事件添加监听器
            await Promise.all(eventNames.map(async (eventName) => {
                await group.add(eventName, async (payload) => {
                    const newEvent = {
                        eventName,
                        payload,
                        timestamp: Date.now()
                    }

                    setEvents(prev => [newEvent, ...prev].slice(0, maxHistory))

                    // 执行回调
                    if (callback) {
                        try {
                            await callback(eventName, payload)
                        } catch (error) {
                            console.error(`Event callback error for '${eventName}':`, error)
                            setError(error instanceof Error ? error.message : String(error))
                        }
                    }
                })
            }))

            setIsReady(true)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            setError(errorMessage)
        } finally {
            setLoading(false)
        }
    }, [eventNames, callback, enabled, maxHistory])

    /**
     * 取消订阅
     */
    const unsubscribe = useCallback(() => {
        listenerGroupRef.current.removeAll()
        setIsReady(false)
    }, [])

    /**
     * 清除事件历史
     */
    const clear = useCallback(() => {
        setEvents([])
    }, [])

    /**
     * 发送事件
     */
    const emit = useCallback(async (eventName: T, payload?: ExtractEventPayload<T>) => {
        try {
            await eventService.emit(eventName, payload)
        } catch (error) {
            console.error(`Failed to emit event '${eventName}':`, error)
            throw error
        }
    }, [])

    // 自动订阅
    useEffect(() => {
        if (immediate && enabled && eventNames.length > 0) {
            subscribe().catch(console.error)
        }

        return () => {
            unsubscribe()
        }
    }, [immediate, enabled, eventNames, subscribe, unsubscribe])

    return {
        events,
        loading,
        error,
        isReady,
        subscribe,
        unsubscribe,
        clear,
        emit
    }
}

/**
 * 特定事件的便捷 Hook
 */

/**
 * 窗口事件 Hook
 */
export function useWindowEvents(
    callback?: (eventName: string, payload: any) => void
) {
    return useTauriEvents([
        'window-created',
        'window-destroyed',
        'window-focused',
        'window-blurred',
        'window-moved',
        'window-resized',
        'window-minimized',
        'window-maximized',
        'window-restored'
    ] as AppEventType[], callback)
}

/**
 * 系统事件 Hook
 */
export function useSystemEvents(
    callback?: (eventName: string, payload: any) => void
) {
    return useTauriEvents([
        'app-ready',
        'app-before-quit',
        'app-will-quit',
        'system-theme-changed',
        'system-locale-changed'
    ] as AppEventType[], callback)
}

/**
 * 文件事件 Hook
 */
export function useFileEvents(
    callback?: (eventName: string, payload: any) => void
) {
    return useTauriEvents([
        'file-dropped',
        'file-drop-hover',
        'file-drop-cancelled'
    ] as AppEventType[], callback)
}

/**
 * 应用特定事件 Hook
 */
export function useAppEvents(
    callback?: (eventName: string, payload: any) => void
) {
    return useTauriEvents([
        'character-changed',
        'settings-changed',
        'adapter-installed',
        'adapter-uninstalled',
        'adapter-executed',
        'chat-message',
        'live2d-loaded',
        'live2d-error'
    ] as AppEventType[], callback)
}
