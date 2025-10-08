import type { AppError } from '@/types/app'
import React from 'react'

interface ErrorFallbackProps {
    error?: AppError | null
    resetError?: () => void
    onRestart?: () => void
}

/**
 * 错误回退组件
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetError,
    onRestart,
}) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="text-center">
                    <div className="text-6xl mb-4">😵</div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        应用程序出现错误
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                        很抱歉，应用程序遇到了一个意外错误
                    </p>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4 text-left">
                            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                                错误信息:
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300 break-words">
                                {error.message}
                            </p>
                            {error.timestamp && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                    时间: {new Date(error.timestamp).toLocaleString()}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                        {resetError && (
                            <button
                                onClick={resetError}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                重试
                            </button>
                        )}
                        {onRestart && (
                            <button
                                onClick={onRestart}
                                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                            >
                                重启应用
                            </button>
                        )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                        如果问题持续存在，请联系技术支持
                    </p>
                </div>
            </div>
        </div>
    )
}
