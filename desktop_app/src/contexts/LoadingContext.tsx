import React, { createContext, ReactNode, useContext, useState } from 'react'

/**
 * 加载状态接口
 */
interface LoadingState {
    isLoading: boolean
    message?: string
    progress?: number
}

/**
 * 加载上下文接口
 */
interface LoadingContextType {
    loading: LoadingState
    setLoading: (loading: boolean, message?: string, progress?: number) => void
    startLoading: (message?: string) => void
    stopLoading: () => void
    updateProgress: (progress: number, message?: string) => void
}

/**
 * 加载上下文
 */
const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

/**
 * 加载提供者属性
 */
interface LoadingProviderProps {
    children: ReactNode
}

/**
 * 加载提供者组件
 */
export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
    const [loading, setLoadingState] = useState<LoadingState>({
        isLoading: false,
        message: undefined,
        progress: undefined,
    })

    const setLoading = (isLoading: boolean, message?: string, progress?: number) => {
        setLoadingState({
            isLoading,
            message,
            progress,
        })
    }

    const startLoading = (message?: string) => {
        setLoading(true, message)
    }

    const stopLoading = () => {
        setLoading(false)
    }

    const updateProgress = (progress: number, message?: string) => {
        setLoadingState(prev => ({
            ...prev,
            progress,
            message: message || prev.message,
        }))
    }

    const value: LoadingContextType = {
        loading,
        setLoading,
        startLoading,
        stopLoading,
        updateProgress,
    }

    return (
        <LoadingContext.Provider value={value}>
            {children}
        </LoadingContext.Provider>
    )
}

/**
 * 使用加载上下文Hook
 */
export const useLoading = (): LoadingContextType => {
    const context = useContext(LoadingContext)
    if (!context) {
        throw new Error('useLoading must be used within a LoadingProvider')
    }
    return context
}
