/**
 * Tauri 事件服务
 * 
 * 提供类型安全的 Tauri 事件监听和发送封装
 */

import type { UnlistenFn } from '@tauri-apps/api/event'
import { emit, listen, once } from '@tauri-apps/api/event'

import type {
    AppEventType,
    ExtractEventPayload
} from '../../types/tauri'

/**
 * 事件监听器管理器
 */
class EventListenerManager {
    private listeners = new Map<string, Set<UnlistenFn>>()

    /**
     * 添加监听器
     */
    public add(eventName: string, unlisten: UnlistenFn): void {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set())
        }
        this.listeners.get(eventName)!.add(unlisten)
    }

    /**
     * 移除监听器
     */
    public remove(eventName: string, unlisten: UnlistenFn): void {
        const listeners = this.listeners.get(eventName)
        if (listeners) {
            listeners.delete(unlisten)
            if (listeners.size === 0) {
                this.listeners.delete(eventName)
            }
        }
    }

    /**
     * 移除所有监听器
     */
    public removeAll(eventName?: string): void {
        if (eventName) {
            const listeners = this.listeners.get(eventName)
            if (listeners) {
                listeners.forEach(unlisten => unlisten())
                this.listeners.delete(eventName)
            }
        } else {
            this.listeners.forEach(listeners => {
                listeners.forEach(unlisten => unlisten())
            })
            this.listeners.clear()
        }
    }

    /**
     * 获取监听器数量
     */
    public getCount(eventName?: string): number {
        if (eventName) {
            return this.listeners.get(eventName)?.size || 0
        }
        return Array.from(this.listeners.values()).reduce((total, set) => total + set.size, 0)
    }
}

/**
 * Tauri 事件服务类
 */
export class TauriEventService {
    private static instance: TauriEventService | null = null
    private listenerManager = new EventListenerManager()
    private eventHistory = new Map<string, any[]>()
    private maxHistorySize = 100

    private constructor() {
        // 私有构造函数，确保单例
    }

    /**
     * 获取服务实例
     */
    public static getInstance(): TauriEventService {
        if (!TauriEventService.instance) {
            TauriEventService.instance = new TauriEventService()
        }
        return TauriEventService.instance
    }

    /**
     * 监听事件（类型安全）
     */
    public async listen<T extends AppEventType>(
        eventName: T,
        callback: (payload: ExtractEventPayload<T>) => void | Promise<void>
    ): Promise<UnlistenFn> {
        try {
            const unlisten = await listen<ExtractEventPayload<T>>(eventName, async (event) => {
                // 记录事件历史
                this.addToHistory(eventName, event.payload)

                // 执行回调
                try {
                    await callback(event.payload)
                } catch (error) {
                    console.error(`Event callback error for '${eventName}':`, error)
                }
            })

            this.listenerManager.add(eventName, unlisten)
            return unlisten
        } catch (error) {
            console.error(`Failed to listen to event '${eventName}':`, error)
            throw error
        }
    }

    /**
     * 监听事件一次（类型安全）
     */
    public async once<T extends AppEventType>(
        eventName: T,
        callback: (payload: ExtractEventPayload<T>) => void | Promise<void>
    ): Promise<UnlistenFn> {
        try {
            const unlisten = await once<ExtractEventPayload<T>>(eventName, async (event) => {
                // 记录事件历史
                this.addToHistory(eventName, event.payload)

                // 执行回调
                try {
                    await callback(event.payload)
                } catch (error) {
                    console.error(`Event callback error for '${eventName}':`, error)
                }
            })

            return unlisten
        } catch (error) {
            console.error(`Failed to listen once to event '${eventName}':`, error)
            throw error
        }
    }

    /**
     * 发送事件
     */
    public async emit<T extends AppEventType>(
        eventName: T,
        payload?: ExtractEventPayload<T>
    ): Promise<void> {
        try {
            await emit(eventName, payload)

            // 记录发送的事件
            this.addToHistory(`${eventName}:sent`, payload)
        } catch (error) {
            console.error(`Failed to emit event '${eventName}':`, error)
            throw error
        }
    }

    /**
     * 移除事件监听器
     */
    public removeListener(eventName: string, unlisten: UnlistenFn): void {
        unlisten()
        this.listenerManager.remove(eventName, unlisten)
    }

    /**
     * 移除所有事件监听器
     */
    public removeAllListeners(eventName?: string): void {
        this.listenerManager.removeAll(eventName)
    }

    /**
     * 获取监听器数量
     */
    public getListenerCount(eventName?: string): number {
        return this.listenerManager.getCount(eventName)
    }

    /**
     * 获取事件历史
     */
    public getEventHistory(eventName?: string): any[] {
        if (eventName) {
            return this.eventHistory.get(eventName) || []
        }

        const allHistory: any[] = []
        this.eventHistory.forEach((history, name) => {
            history.forEach(event => {
                allHistory.push({ eventName: name, ...event })
            })
        })

        return allHistory.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    }

    /**
     * 清除事件历史
     */
    public clearEventHistory(eventName?: string): void {
        if (eventName) {
            this.eventHistory.delete(eventName)
        } else {
            this.eventHistory.clear()
        }
    }

    /**
     * 添加到事件历史
     */
    private addToHistory(eventName: string, payload: any): void {
        if (!this.eventHistory.has(eventName)) {
            this.eventHistory.set(eventName, [])
        }

        const history = this.eventHistory.get(eventName)!
        history.unshift({
            payload,
            timestamp: Date.now()
        })

        // 限制历史记录大小
        if (history.length > this.maxHistorySize) {
            history.splice(this.maxHistorySize)
        }
    }

    /**
     * 设置历史记录最大大小
     */
    public setMaxHistorySize(size: number): void {
        this.maxHistorySize = Math.max(0, size)

        // 裁剪现有历史记录
        this.eventHistory.forEach(history => {
            if (history.length > this.maxHistorySize) {
                history.splice(this.maxHistorySize)
            }
        })
    }

    /**
     * 创建事件监听器组
     */
    public createListenerGroup(): EventListenerGroup {
        return new EventListenerGroup(this)
    }

    /**
     * 销毁服务
     */
    public destroy(): void {
        this.removeAllListeners()
        this.clearEventHistory()
        TauriEventService.instance = null
    }
}

/**
 * 事件监听器组
 * 用于批量管理相关的事件监听器
 */
export class EventListenerGroup {
    private listeners: UnlistenFn[] = []
    private eventService: TauriEventService

    constructor(eventService: TauriEventService) {
        this.eventService = eventService
    }

    /**
     * 添加监听器到组
     */
    public async add<T extends AppEventType>(
        eventName: T,
        callback: (payload: ExtractEventPayload<T>) => void | Promise<void>
    ): Promise<UnlistenFn> {
        const unlisten = await this.eventService.listen(eventName, callback)
        this.listeners.push(unlisten)
        return unlisten
    }

    /**
     * 移除组中的所有监听器
     */
    public removeAll(): void {
        this.listeners.forEach(unlisten => unlisten())
        this.listeners = []
    }

    /**
     * 获取组中监听器数量
     */
    public getCount(): number {
        return this.listeners.length
    }
}

/**
 * 获取事件服务实例
 */
export const eventService = TauriEventService.getInstance()

/**
 * 便捷函数：监听事件
 */
export const listenToEvent = <T extends AppEventType>(
    eventName: T,
    callback: (payload: ExtractEventPayload<T>) => void | Promise<void>
): Promise<UnlistenFn> => {
    return eventService.listen(eventName, callback)
}

/**
 * 便捷函数：监听事件一次
 */
export const listenOnce = <T extends AppEventType>(
    eventName: T,
    callback: (payload: ExtractEventPayload<T>) => void | Promise<void>
): Promise<UnlistenFn> => {
    return eventService.once(eventName, callback)
}

/**
 * 便捷函数：发送事件
 */
export const emitEvent = <T extends AppEventType>(
    eventName: T,
    payload?: ExtractEventPayload<T>
): Promise<void> => {
    return eventService.emit(eventName, payload)
}

/**
 * 便捷函数：创建监听器组
 */
export const createEventListenerGroup = (): EventListenerGroup => {
    return eventService.createListenerGroup()
}
