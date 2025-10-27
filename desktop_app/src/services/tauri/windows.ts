/**
 * Tauri 窗口服务
 * 
 * 提供完整的窗口管理功能封装
 */

import { LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize, WebviewWindow, appWindow, availableMonitors, currentMonitor } from '@tauri-apps/api/window'

import type {
    WindowConfig,
    WindowEventType,
    WindowState
} from '../../types/tauri'
import { commandService } from './commands'
import { eventService } from './events'

/**
 * 窗口管理器
 */
class WindowManager {
    private windows = new Map<string, WebviewWindow>()
    private windowStates = new Map<string, Partial<WindowState>>()

    /**
     * 注册窗口
     */
    public register(label: string, window: WebviewWindow): void {
        this.windows.set(label, window)
        this.initWindowState(label, window)
    }

    /**
     * 注销窗口
     */
    public unregister(label: string): void {
        this.windows.delete(label)
        this.windowStates.delete(label)
    }

    /**
     * 获取窗口
     */
    public get(label: string): WebviewWindow | null {
        return this.windows.get(label) || null
    }

    /**
     * 获取所有窗口
     */
    public getAll(): Map<string, WebviewWindow> {
        return new Map(this.windows)
    }

    /**
     * 获取窗口状态
     */
    public getState(label: string): Partial<WindowState> | null {
        return this.windowStates.get(label) || null
    }

    /**
     * 更新窗口状态
     */
    public updateState(label: string, state: Partial<WindowState>): void {
        const currentState = this.windowStates.get(label) || {}
        this.windowStates.set(label, { ...currentState, ...state })
    }

    /**
     * 初始化窗口状态
     */
    private async initWindowState(label: string, window: WebviewWindow): Promise<void> {
        try {
            const [
                title,
                isVisible,
                isMaximized,
                isMinimized,
                isFullscreen,
                isFocused,
                isResizable,
                isDecorated,
                isAlwaysOnTop,
                position,
                size,
                scaleFactor
            ] = await Promise.all([
                window.title().catch(() => ''),
                window.isVisible().catch(() => true),
                window.isMaximized().catch(() => false),
                window.isMinimized().catch(() => false),
                window.isFullscreen().catch(() => false),
                window.isFocused().catch(() => false),
                window.isResizable().catch(() => true),
                window.isDecorated().catch(() => true),
                Promise.resolve(false), // isAlwaysOnTop not available
                window.outerPosition().catch(() => new PhysicalPosition(0, 0)),
                window.outerSize().catch(() => new PhysicalSize(800, 600)),
                window.scaleFactor().catch(() => 1.0)
            ])

            this.windowStates.set(label, {
                label,
                title,
                isVisible,
                isMaximized,
                isMinimized,
                isFullscreen,
                isFocused,
                isResizable,
                isDecorated,
                isAlwaysOnTop,
                position: { x: position.x, y: position.y },
                size: { width: size.width, height: size.height },
                scaleFactor
            })
        } catch (error) {
            console.error(`Failed to initialize window state for '${label}':`, error)
        }
    }
}

/**
 * Tauri 窗口服务类
 */
export class TauriWindowService {
    private static instance: TauriWindowService | null = null
    private windowManager = new WindowManager()
    private currentWindow: WebviewWindow | null = null

    private constructor() {
        this.initialize()
    }

    /**
     * 获取服务实例
     */
    public static getInstance(): TauriWindowService {
        if (!TauriWindowService.instance) {
            TauriWindowService.instance = new TauriWindowService()
        }
        return TauriWindowService.instance
    }

    /**
     * 初始化服务
     */
    private async initialize(): Promise<void> {
        try {
            // 注册当前窗口
            this.currentWindow = appWindow
            this.windowManager.register(appWindow.label, appWindow)

            // 监听窗口事件
            this.setupWindowEventListeners()
        } catch (error) {
            console.error('Failed to initialize window service:', error)
        }
    }

    /**
     * 设置窗口事件监听器
     */
    private setupWindowEventListeners(): void {
        const windowEvents: WindowEventType[] = [
            'tauri://created',
            'tauri://close-requested',
            'tauri://destroyed',
            'tauri://focus',
            'tauri://blur',
            'tauri://move',
            'tauri://resize',
            'tauri://scale-change'
        ]

        windowEvents.forEach(eventType => {
            eventService.listen(eventType as any, (payload) => {
                this.handleWindowEvent(eventType, payload)
            }).catch(error => {
                console.error(`Failed to listen to window event '${eventType}':`, error)
            })
        })
    }

    /**
     * 处理窗口事件
     */
    private handleWindowEvent(eventType: WindowEventType, payload: any): void {
        const windowLabel = payload?.windowLabel || this.currentWindow?.label

        if (!windowLabel) return

        switch (eventType) {
            case 'tauri://move':
                this.windowManager.updateState(windowLabel, {
                    position: { x: payload.x, y: payload.y }
                })
                break

            case 'tauri://resize':
                this.windowManager.updateState(windowLabel, {
                    size: { width: payload.width, height: payload.height }
                })
                break

            case 'tauri://focus':
                this.windowManager.updateState(windowLabel, { isFocused: true })
                break

            case 'tauri://blur':
                this.windowManager.updateState(windowLabel, { isFocused: false })
                break

            case 'tauri://destroyed':
                this.windowManager.unregister(windowLabel)
                break
        }
    }

    /**
     * 创建新窗口
     */
    public async createWindow(config: WindowConfig): Promise<WebviewWindow> {
        try {
            const window = new WebviewWindow(config.label, {
                url: config.url,
                title: config.title,
                width: config.width,
                height: config.height,
                minWidth: config.minWidth,
                minHeight: config.minHeight,
                maxWidth: config.maxWidth,
                maxHeight: config.maxHeight,
                x: config.x,
                y: config.y,
                center: config.center,
                resizable: config.resizable,
                maximizable: config.maximizable,
                minimizable: config.minimizable,
                closable: config.closable,
                decorations: config.decorations,
                alwaysOnTop: config.alwaysOnTop,
                fullscreen: config.fullscreen,
                transparent: config.transparent,
                visible: config.visible,
                focus: config.focus,
                skipTaskbar: config.skipTaskbar,
                theme: config.theme as any
            })

            // 等待窗口创建完成
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Window creation timeout'))
                }, 10000)

                window.once('tauri://created', () => {
                    clearTimeout(timeout)
                    resolve()
                })

                window.once('tauri://error', (error) => {
                    clearTimeout(timeout)
                    reject(error)
                })
            })

            // 注册窗口
            this.windowManager.register(config.label, window)

            return window
        } catch (error) {
            console.error(`Failed to create window '${config.label}':`, error)
            throw error
        }
    }

    /**
     * 获取窗口
     */
    public getWindow(label: string): WebviewWindow | null {
        return this.windowManager.get(label)
    }

    /**
     * 获取当前窗口
     */
    public getCurrentWindow(): WebviewWindow | null {
        return this.currentWindow
    }

    /**
     * 获取所有窗口
     */
    public getAllWindows(): Map<string, WebviewWindow> {
        return this.windowManager.getAll()
    }

    /**
     * 获取窗口状态
     */
    public getWindowState(label: string): Partial<WindowState> | null {
        return this.windowManager.getState(label)
    }

    /**
     * 关闭窗口
     */
    public async closeWindow(label: string): Promise<void> {
        const window = this.getWindow(label)
        if (window) {
            await window.close()
        } else {
            await commandService.closeWindow(label)
        }
    }

    /**
     * 显示窗口
     */
    public async showWindow(label: string): Promise<void> {
        const window = this.getWindow(label)
        if (window) {
            await window.show()
        } else {
            await commandService.showWindow(label)
        }
    }

    /**
     * 隐藏窗口
     */
    public async hideWindow(label: string): Promise<void> {
        const window = this.getWindow(label)
        if (window) {
            await window.hide()
        } else {
            await commandService.hideWindow(label)
        }
    }

    /**
     * 聚焦窗口
     */
    public async focusWindow(label: string): Promise<void> {
        const window = this.getWindow(label)
        if (window) {
            await window.setFocus()
        } else {
            await commandService.focusWindow(label)
        }
    }

    /**
     * 最小化窗口
     */
    public async minimizeWindow(label: string): Promise<void> {
        const window = this.getWindow(label)
        if (window) {
            await window.minimize()
        } else {
            await commandService.minimizeWindow(label)
        }
    }

    /**
     * 最大化窗口
     */
    public async maximizeWindow(label: string): Promise<void> {
        const window = this.getWindow(label)
        if (window) {
            await window.maximize()
        } else {
            await commandService.maximizeWindow(label)
        }
    }

    /**
     * 设置窗口位置
     */
    public async setWindowPosition(label: string, x: number, y: number): Promise<void> {
        const window = this.getWindow(label)
        if (window) {
            await window.setPosition(new LogicalPosition(x, y))
        } else {
            await commandService.setWindowPosition(label, x, y)
        }
    }

    /**
     * 设置窗口大小
     */
    public async setWindowSize(label: string, width: number, height: number): Promise<void> {
        const window = this.getWindow(label)
        if (window) {
            await window.setSize(new LogicalSize(width, height))
        } else {
            await commandService.setWindowSize(label, width, height)
        }
    }

    /**
     * 设置窗口标题
     */
    public async setWindowTitle(label: string, title: string): Promise<void> {
        const window = this.getWindow(label)
        if (window) {
            await window.setTitle(title)
        } else {
            await commandService.setWindowTitle(label, title)
        }
    }

    /**
     * 设置窗口置顶
     */
    public async setAlwaysOnTop(label: string, alwaysOnTop: boolean): Promise<void> {
        const window = this.getWindow(label)
        if (window) {
            await window.setAlwaysOnTop(alwaysOnTop)
        } else {
            await commandService.setAlwaysOnTop(label, alwaysOnTop)
        }
    }

    /**
     * 获取可用显示器
     */
    public async getAvailableMonitors(): Promise<any[]> {
        try {
            return await availableMonitors()
        } catch (error) {
            console.error('Failed to get available monitors:', error)
            return []
        }
    }

    /**
     * 获取当前显示器
     */
    public async getCurrentMonitor(): Promise<any | null> {
        try {
            return await currentMonitor()
        } catch (error) {
            console.error('Failed to get current monitor:', error)
            return null
        }
    }

    /**
     * 居中窗口
     */
    public async centerWindow(label: string): Promise<void> {
        const window = this.getWindow(label)
        if (!window) return

        try {
            const monitor = await this.getCurrentMonitor()
            if (!monitor) return

            const windowSize = await window.outerSize()
            const monitorSize = monitor.size
            const monitorPosition = monitor.position

            const x = monitorPosition.x + (monitorSize.width - windowSize.width) / 2
            const y = monitorPosition.y + (monitorSize.height - windowSize.height) / 2

            await this.setWindowPosition(label, x, y)
        } catch (error) {
            console.error(`Failed to center window '${label}':`, error)
        }
    }

    /**
     * 销毁服务
     */
    public destroy(): void {
        this.windowManager = new WindowManager()
        this.currentWindow = null
        TauriWindowService.instance = null
    }
}

/**
 * 获取窗口服务实例
 */
export const windowService = TauriWindowService.getInstance()

/**
 * 便捷函数：创建窗口
 */
export const createWindow = (config: WindowConfig): Promise<WebviewWindow> => {
    return windowService.createWindow(config)
}

/**
 * 便捷函数：获取当前窗口
 */
export const getCurrentWindow = (): WebviewWindow | null => {
    return windowService.getCurrentWindow()
}

/**
 * 便捷函数：获取窗口
 */
export const getWindow = (label: string): WebviewWindow | null => {
    return windowService.getWindow(label)
}
