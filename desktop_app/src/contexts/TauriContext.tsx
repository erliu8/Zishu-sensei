import { useTauri } from '@/hooks/useTauri'
import type { TauriEnvironment } from '@/types/tauri'
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react'

/**
 * Tauri 上下文接口
 */
interface TauriContextType {
    isReady: boolean
    isTauriEnv: boolean
    environment: TauriEnvironment | null
    loading: boolean
    error: string | null
    initialize: () => Promise<void>
    restart: () => Promise<void>
    exit: (code?: number) => Promise<void>
    openUrl: (url: string) => Promise<void>
    showInFolder: (path: string) => Promise<void>
    getAppInfo: () => Promise<any>
    getSystemInfo: () => Promise<any>
}

/**
 * Tauri 上下文
 */
const TauriContext = createContext<TauriContextType | undefined>(undefined)

/**
 * Tauri 提供者属性
 */
interface TauriProviderProps {
    children: ReactNode
}

/**
 * Tauri 提供者组件
 */
export const TauriProvider: React.FC<TauriProviderProps> = ({ children }) => {
    const tauriState = useTauri()
    const [isTauriEnv, setIsTauriEnv] = useState(false)

    // 检测 Tauri 环境
    useEffect(() => {
        const checkTauriEnv = () => {
            setIsTauriEnv(typeof window !== 'undefined' && !!window.__TAURI__)
        }

        checkTauriEnv()
    }, [])

    const value: TauriContextType = {
        isReady: tauriState.isAvailable,
        isTauriEnv,
        environment: tauriState.environment,
        loading: false, // useTauri 不提供loading状态
        error: tauriState.error,
        initialize: async () => { }, // useTauri 自动初始化
        restart: tauriState.restart,
        exit: async (code?: number) => await tauriState.invoke('exit_app', { code }),
        openUrl: async (url: string) => await tauriState.invoke('open_url', { url }),
        showInFolder: async (path: string) => await tauriState.invoke('show_in_folder', { path }),
        getAppInfo: async () => await tauriState.invoke('get_app_info'),
        getSystemInfo: async () => await tauriState.invoke('get_system_info'),
    }

    return (
        <TauriContext.Provider value={value}>
            {children}
        </TauriContext.Provider>
    )
}

/**
 * 使用 Tauri 上下文 Hook
 */
export const useTauriContext = (): TauriContextType => {
    const context = useContext(TauriContext)
    if (!context) {
        throw new Error('useTauriContext must be used within a TauriProvider')
    }
    return context
}
