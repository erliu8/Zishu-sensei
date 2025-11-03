/**
 * Tauri 核心服务
 * 
 * 提供 Tauri 环境检测、初始化和基础功能封装
 */

import { getVersion } from '@tauri-apps/api/app'
import { arch, locale, platform } from '@tauri-apps/api/os'
import { invoke } from '@tauri-apps/api/tauri'
import { appWindow } from '@tauri-apps/api/window'

import type {
    AppCommand,
    TauriCommandPayload,
    TauriEnvironment,
    TauriResponse
} from '../../types/tauri'

/**
 * Tauri 错误接口
 */
export interface TauriError extends Error {
    code?: string
    command?: string
    payload?: any
}

/**
 * Tauri 核心服务类
 */
export class TauriService {
    private static instance: TauriService | null = null
    private _isReady = false
    private _environment: TauriEnvironment | null = null
    private _initPromise: Promise<void> | null = null

    private constructor() {
        // 私有构造函数，确保单例
    }

    /**
     * 获取服务实例（单例模式）
     */
    public static getInstance(): TauriService {
        if (!TauriService.instance) {
            TauriService.instance = new TauriService()
        }
        return TauriService.instance
    }

    /**
     * 检查是否在 Tauri 环境中
     */
    public static isTauriEnv(): boolean {
        return typeof window !== 'undefined' && '__TAURI__' in window
    }

    /**
     * 初始化 Tauri 服务
     */
    public async initialize(): Promise<void> {
        if (this._initPromise) {
            return this._initPromise
        }

        this._initPromise = this._performInitialization()
        return this._initPromise
    }

    /**
     * 执行初始化
     */
    private async _performInitialization(): Promise<void> {
        try {
            if (!TauriService.isTauriEnv()) {
                console.warn('Not running in Tauri environment')
                this._environment = {
                    platform: 'web',
                    arch: 'unknown',
                    os: 'unknown',
                    version: '1.0.0',
                    tauriVersion: 'unknown',
                    webviewVersion: 'unknown'
                }
                this._isReady = true
                return
            }

            // 获取环境信息
            const [
                tauriVersion,
                platformName,
                archName,
                /* localeName */,
                appVersion,
                /* currentTheme */
            ] = await Promise.all([
                this._safeInvoke('get_version', {}).catch(() => 'unknown'),
                platform().catch(() => 'unknown'),
                arch().catch(() => 'unknown'),
                locale().catch(() => 'en-US'),
                getVersion().catch(() => '1.0.0'),
                appWindow.theme().catch(() => 'light' as const)
            ])

            this._environment = {
                platform: platformName,
                arch: archName,
                os: platformName,
                version: appVersion,
                tauriVersion: tauriVersion as string,
                webviewVersion: 'unknown'
            }

            this._isReady = true

            console.log('Tauri service initialized:', this._environment)
        } catch (error) {
            console.error('Failed to initialize Tauri service:', error)
            throw new Error(`Tauri initialization failed: ${error}`)
        }
    }

    /**
     * 获取环境信息
     */
    public getEnvironment(): TauriEnvironment | null {
        return this._environment
    }

    /**
     * 检查服务是否已准备就绪
     */
    public isReady(): boolean {
        return this._isReady
    }

    /**
     * 等待服务准备就绪
     */
    public async waitForReady(): Promise<void> {
        if (this._isReady) return

        if (!this._initPromise) {
            await this.initialize()
        } else {
            await this._initPromise
        }
    }

    /**
     * 安全调用 Tauri 命令
     */
    public async invokeCommand<T = any>(
        command: AppCommand,
        payload: TauriCommandPayload = {}
    ): Promise<TauriResponse<T>> {
        try {
            await this.waitForReady()

            if (!TauriService.isTauriEnv()) {
                throw new Error('Not running in Tauri environment')
            }

            const result = await this._safeInvoke<T>(command, payload)

            return {
                success: true,
                data: result
            }
        } catch (error) {
            console.error(`Command '${command}' failed:`, error)

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    /**
     * 批量调用命令
     */
    public async invokeBatch<T = any>(
        commands: Array<{
            command: AppCommand
            payload?: TauriCommandPayload
        }>
    ): Promise<TauriResponse<T>[]> {
        const promises = commands.map(({ command, payload }) =>
            this.invokeCommand<T>(command, payload)
        )

        return Promise.all(promises)
    }

    /**
     * 安全的 invoke 调用
     */
    private async _safeInvoke<T>(
        command: string,
        payload: TauriCommandPayload
    ): Promise<T> {
        try {
            return await invoke<T>(command, payload)
        } catch (error) {
            // 处理 Tauri 特定错误
            if (typeof error === 'string') {
                throw new Error(error)
            }

            if (error && typeof error === 'object' && 'message' in error) {
                throw new Error(String(error.message))
            }

            throw error
        }
    }

    /**
     * 获取应用信息
     */
    public async getAppInfo(): Promise<{
        name: string
        version: string
        tauriVersion: string
    }> {
        const response = await this.invokeCommand('get_app_version')

        return {
            name: 'Zishu Sensei',
            version: response.data?.version || '1.0.0',
            tauriVersion: this._environment?.version || 'unknown'
        }
    }

    /**
     * 重启应用
     */
    public async restartApp(): Promise<void> {
        await this.invokeCommand('restart_app')
    }

    /**
     * 退出应用
     */
    public async exitApp(code: number = 0): Promise<void> {
        await this.invokeCommand('exit_app', { code })
    }

    /**
     * 获取系统信息
     */
    public async getSystemInfo(): Promise<any> {
        const response = await this.invokeCommand('get_system_info')
        return response.data
    }

    /**
     * 打开 URL
     */
    public async openUrl(url: string): Promise<void> {
        await this.invokeCommand('open_url', { url })
    }

    /**
     * 在文件管理器中显示文件
     */
    public async showInFolder(path: string): Promise<void> {
        await this.invokeCommand('show_in_folder', { path })
    }

    /**
     * 创建错误对象
     */
    public createError(
        message: string,
        code?: string,
        command?: string,
        payload?: any
    ): TauriError {
        const error = new Error(message) as TauriError
        error.name = 'TauriError'
        error.code = code
        error.command = command
        error.payload = payload
        return error
    }

    /**
     * 销毁服务实例
     */
    public destroy(): void {
        this._isReady = false
        this._environment = null
        this._initPromise = null
        TauriService.instance = null
    }
}

/**
 * 获取 Tauri 服务实例
 */
export const tauriService = TauriService.getInstance()

/**
 * 便捷函数：检查 Tauri 环境
 */
export const isTauriEnv = TauriService.isTauriEnv

/**
 * 便捷函数：调用 Tauri 命令
 */
export const invokeCommand = <T = any>(
    command: AppCommand,
    payload?: TauriCommandPayload
): Promise<TauriResponse<T>> => {
    return tauriService.invokeCommand<T>(command, payload)
}

/**
 * 便捷函数：等待 Tauri 准备就绪
 */
export const waitForTauriReady = (): Promise<void> => {
    return tauriService.waitForReady()
}

/**
 * 便捷函数：获取环境信息
 */
export const getTauriEnvironment = (): TauriEnvironment | null => {
    return tauriService.getEnvironment()
}
