import React, { Component, ErrorInfo, ReactNode } from 'react'

/**
 * 错误边界状态接口
 */
interface ErrorBoundaryState {
    hasError: boolean
    error?: Error
    errorInfo?: ErrorInfo
}

/**
 * 错误边界属性接口
 */
interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
}

/**
 * 全局错误边界组件
 */
export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = {
            hasError: false,
        }
    }

    /**
     * 捕获错误时调用
     */
    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            error,
        }
    }

    /**
     * 组件发生错误后调用
     */
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({
            error,
            errorInfo,
        })

        // 调用错误处理回调
        if (this.props.onError) {
            this.props.onError(error, errorInfo)
        }

        // 在开发环境下打印错误信息
        if (import.meta.env?.DEV) {
            console.group('🚨 React Error Boundary Caught An Error')
            console.error('Error:', error)
            console.error('Error Info:', errorInfo)
            console.groupEnd()
        }
    }

    /**
     * 重置错误状态
     */
    resetError = () => {
        this.setState({
            hasError: false,
            error: undefined,
            errorInfo: undefined,
        })
    }

    /**
     * 重新加载页面
     */
    reloadPage = () => {
        window.location.reload()
    }

    render() {
        if (this.state.hasError) {
            // 如果有自定义的错误UI，则使用它
            if (this.props.fallback && this.state.error && this.state.errorInfo) {
                return this.props.fallback(this.state.error, this.state.errorInfo)
            }

            // 默认的错误UI
            return (
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                        <div className="flex items-center mb-4">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-8 w-8 text-red-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                                    />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h1 className="text-lg font-medium text-gray-900 dark:text-white">
                                    应用程序出现错误
                                </h1>
                            </div>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                很抱歉，应用程序遇到了一个意外错误。请尝试刷新页面或重启应用程序。
                            </p>
                        </div>

                        {import.meta.env?.DEV && this.state.error && (
                            <div className="mb-4">
                                <details className="bg-gray-100 dark:bg-gray-700 rounded p-3">
                                    <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                        错误详情 (开发模式)
                                    </summary>
                                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                        <p className="font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded mt-1">
                                            {this.state.error.message}
                                        </p>
                                        {this.state.error.stack && (
                                            <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-auto max-h-32">
                                                {this.state.error.stack}
                                            </pre>
                                        )}
                                    </div>
                                </details>
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <button
                                onClick={this.resetError}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                            >
                                重试
                            </button>
                            <button
                                onClick={this.reloadPage}
                                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                            >
                                刷新页面
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
/**
 * 轻量级错误边界Hook版本
 */
export const useErrorBoundary = () => {
    const [error, setError] = React.useState<Error | null>(null)

    const resetError = React.useCallback(() => {
        setError(null)
    }, [])

    const captureError = React.useCallback((error: Error) => {
        setError(error)
    }, [])

    React.useEffect(() => {
        if (error) {
            throw error
        }
    }, [error])

    return {
        captureError,
        resetError,
    }
}

