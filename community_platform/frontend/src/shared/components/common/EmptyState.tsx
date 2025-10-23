/**
 * EmptyState 空状态组件
 * 显示无数据或空内容的占位界面
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }
  image?: string
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

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      icon,
      title,
      description,
      action,
      image,
      size = 'md',
      ...props
    },
    ref
  ) => {
    const defaultIcon = (
      <svg
        className="w-full h-full"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
    )

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
        {/* 图片或图标 */}
        {image ? (
          <img
            src={image}
            alt={title}
            className={cn('mb-6', iconSizeClasses[size])}
          />
        ) : (
          <div
            className={cn(
              'mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500',
              iconSizeClasses[size],
              size === 'sm' && 'p-3',
              size === 'md' && 'p-4',
              size === 'lg' && 'p-5'
            )}
          >
            {icon || defaultIcon}
          </div>
        )}

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

        {/* 描述 */}
        {description && (
          <p
            className={cn(
              'mt-2 text-gray-600 dark:text-gray-400 max-w-md',
              size === 'sm' && 'text-sm',
              size === 'md' && 'text-base',
              size === 'lg' && 'text-lg'
            )}
          >
            {description}
          </p>
        )}

        {/* 操作按钮 */}
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              'mt-6 px-4 py-2 rounded-lg font-medium transition-colors',
              action.variant === 'secondary'
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                : 'bg-primary-600 text-white hover:bg-primary-700',
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

EmptyState.displayName = 'EmptyState'

