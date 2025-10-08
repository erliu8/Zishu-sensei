import React, { createContext, useContext, useState } from 'react'

/**
 * Toast消息类型
 */
interface ToastMessage {
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message?: string
    duration?: number
}

/**
 * Toast上下文类型
 */
interface ToastContextType {
    toasts: ToastMessage[]
    showToast: (toast: Omit<ToastMessage, 'id'>) => void
    hideToast: (id: string) => void
    clearToasts: () => void
}

/**
 * Toast上下文
 */
const ToastContext = createContext<ToastContextType | null>(null)

/**
 * Toast提供者属性
 */
interface ToastProviderProps {
    children: React.ReactNode
}

/**
 * Toast提供者组件
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastMessage[]>([])

    const showToast = (toast: Omit<ToastMessage, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9)
        const newToast: ToastMessage = {
            ...toast,
            id,
            duration: toast.duration || 4000,
        }

        setToasts(prev => [...prev, newToast])

        // 自动隐藏
        if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
                hideToast(id)
            }, newToast.duration)
        }
    }

    const hideToast = (id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id))
    }

    const clearToasts = () => {
        setToasts([])
    }

    const contextValue: ToastContextType = {
        toasts,
        showToast,
        hideToast,
        clearToasts,
    }

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
        </ToastContext.Provider>
    )
}

/**
 * 使用Toast上下文Hook
 */
export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}