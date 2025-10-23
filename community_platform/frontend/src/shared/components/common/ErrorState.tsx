/**
 * ErrorState 错误状态组件
 * 显示错误信息和重试操作
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'py-8',
  md: 'py-12',
  lg: 'py-16',
}

const iconSizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
}

export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      className,
      title,
      message,
      action,
      size = 'md',
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center text-center',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {/* 错误图标 */}
        <div
          className={cn(
            'mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400',
            iconSizeClasses[size],
            size === 'sm' && 'p-3',
            size === 'md' && 'p-4',
            size === 'lg' && 'p-5'
          )}
        >
          <svg
            className="w-full h-full"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* 标题 */}
        <h3
          className={cn(
            'font-semibold text-gray-900 dark:text-gray-100',
            size === 'sm' && 'text-base',
            size === 'md' && 'text-lg',
            size === 'lg' && 'text-xl'
          )}
        >
          {title}
        </h3>

        {/* 错误消息 */}
        {message && (
          <p
            className={cn(
              'mt-2 text-gray-600 dark:text-gray-400 max-w-md',
              size === 'sm' && 'text-sm',
              size === 'md' && 'text-base',
              size === 'lg' && 'text-lg'
            )}
          >
            {message}
          </p>
        )}

        {/* 操作按钮 */}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              'mt-6 px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-red-600 text-white hover:bg-red-700',
              size === 'sm' && 'text-sm',
              size === 'md' && 'text-base',
              size === 'lg' && 'text-lg'
            )}
          >
            {action.label}
          </button>
        )}
      </div>
    )
  }
)

ErrorState.displayName = 'ErrorState'

