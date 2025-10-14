import type { TauriEnvironment } from '@/types/tauri'
import { useCallback, useEffect, useState } from 'react'

/**
 * Tauri 可用性检查结果
 */
interface TauriAvailability {
    isAvailable: boolean
    environment: TauriEnvironment | null
    error: string | null
}

/**
 * Tauri Hook 返回值
 */
interface UseTauriReturn extends TauriAvailability {
    isTauriEnv: boolean
    tauriVersion: string
    invoke: <T = any>(command: string, args?: Record<string, any>) => Promise<T>
    listen: (event: string, handler: (event: any) => void) => Promise<() => void>
    emit: (event: string, payload?: any) => Promise<void>
    checkUpdate: () => Promise<any>
    installUpdate: () => Promise<void>
    restart: () => Promise<void>
}

/**
 * Tauri 集成 Hook
 */
export const useTauri = (): UseTauriReturn => {
    const [availability, setAvailability] = useState<TauriAvailability>({
        isAvailable: false,
        environment: null,
        error: null,
    })

    // 检查 Tauri 可用性
    const checkTauriAvailability = useCallback(async () => {
        try {
            // 检查是否在 Tauri 环境中
            if (typeof window === 'undefined' || !window.__TAURI__) {
                setAvailability({
                    isAvailable: false,
                    environment: null,
                    error: 'Not running in Tauri environment',
                })
                return
            }

            // 获取环境信息
            const { invoke } = await import('@tauri-apps/api/tauri')
            const environment = await invoke<TauriEnvironment>('get_environment_info')

            setAvailability({
                isAvailable: true,
                environment,
                error: null,
            })
        } catch (error) {
            console.error('Failed to check Tauri availability:', error)
            setAvailability({
                isAvailable: false,
                environment: null,
                error: error instanceof Error ? error.message : 'Unknown error',
            })
        }
    }, [])

    // 调用 Tauri 命令
    const invoke = useCallback(async <T = any>(
        command: string,
        args?: Record<string, any>
    ): Promise<T> => {
        if (!availability.isAvailable || !window.__TAURI__) {
            throw new Error('Tauri is not available')
        }

        const { invoke: tauriInvoke } = await import('@tauri-apps/api/tauri')
        return await tauriInvoke<T>(command, args)
    }, [availability.isAvailable])

    // 监听事件
    const listen = useCallback(async (
        event: string,
        handler: (event: any) => void
    ): Promise<() => void> => {
        if (!availability.isAvailable || !window.__TAURI__) {
            throw new Error('Tauri is not available')
        }

        const { listen: tauriListen } = await import('@tauri-apps/api/event')
        const unlisten = await tauriListen(event, handler)
        return unlisten
    }, [availability.isAvailable])

    // 发送事件
    const emit = useCallback(async (
        event: string,
        payload?: any
    ): Promise<void> => {
        if (!availability.isAvailable || !window.__TAURI__) {
            throw new Error('Tauri is not available')
        }

        const { emit: tauriEmit } = await import('@tauri-apps/api/event')
        await tauriEmit(event, payload)
    }, [availability.isAvailable])

    // 检查更新
    const checkUpdate = useCallback(async () => {
        if (!availability.isAvailable) {
            throw new Error('Tauri is not available')
        }

        return await invoke('check_update')
    }, [availability.isAvailable, invoke])

    // 安装更新
    const installUpdate = useCallback(async () => {
        if (!availability.isAvailable) {
            throw new Error('Tauri is not available')
        }

        await invoke('install_update')
    }, [availability.isAvailable, invoke])

    // 重启应用
    const restart = useCallback(async () => {
        if (!availability.isAvailable) {
            throw new Error('Tauri is not available')
        }

        await invoke('restart_app')
    }, [availability.isAvailable, invoke])

    // 初始化检查
    useEffect(() => {
        checkTauriAvailability()
    }, [checkTauriAvailability])

    return {
        ...availability,
        isTauriEnv: availability.isAvailable,
        tauriVersion: availability.environment?.version || '0.0.0',
        invoke,
        listen,
        emit,
        checkUpdate,
        installUpdate,
        restart,
    }
}