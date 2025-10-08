import clsx from 'clsx'
import React from 'react'

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl'
    className?: string
    color?: 'primary' | 'secondary' | 'white' | 'gray'
}

/**
 * 加载动画组件
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
    size = 'md',
    className,
    color = 'primary',
}) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
        xl: 'w-12 h-12',
    }

    const colorClasses = {
        primary: 'text-blue-600',
        secondary: 'text-gray-600',
        white: 'text-white',
        gray: 'text-gray-400',
    }

    return (
        <div
            className={clsx(
                'animate-spin rounded-full border-2 border-current border-t-transparent',
                sizeClasses[size],
                colorClasses[color],
                className
            )}
            role="status"
            aria-label="加载中"
        >
            <span className="sr-only">加载中...</span>
        </div>
    )
}
