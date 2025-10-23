/**
 * LoadingSpinner 加载指示器组件
 * 提供多种样式的加载动画
 */

import { cn } from '@/shared/utils'
import { VariantProps, cva } from 'class-variance-authority'
import React from 'react'

const spinnerVariants = cva('animate-spin', {
  variants: {
    size: {
      xs: 'w-3 h-3',
      sm: 'w-4 h-4',
      md: 'w-6 h-6',
      lg: 'w-8 h-8',
      xl: 'w-12 h-12',
    },
    variant: {
      default: 'text-primary-600',
      light: 'text-white',
      dark: 'text-gray-900',
      muted: 'text-gray-400',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
})

export interface LoadingSpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string
  fullScreen?: boolean
}

export const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size, variant, label, fullScreen = false, ...props }, ref) => {
    const spinner = (
      <svg
        className={cn(spinnerVariants({ size, variant }))}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        role="status"
        aria-label={label || '加载中'}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    )

    if (fullScreen) {
      return (
        <div
          ref={ref}
          className={cn(
            'fixed inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-50',
            className
          )}
          {...props}
        >
          {spinner}
          {label && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {label}
            </p>
          )}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn('flex flex-col items-center justify-center', className)}
        {...props}
      >
        {spinner}
        {label && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {label}
          </p>
        )}
      </div>
    )
  }
)

LoadingSpinner.displayName = 'LoadingSpinner'

// 骨架屏组件
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = 'text', width, height, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'animate-pulse bg-gray-200 dark:bg-gray-800',
          variant === 'text' && 'h-4 rounded',
          variant === 'circular' && 'rounded-full',
          variant === 'rectangular' && 'rounded-md',
          className
        )}
        style={{
          width,
          height: variant === 'text' ? undefined : height,
          ...style,
        }}
        {...props}
      />
    )
  }
)

Skeleton.displayName = 'Skeleton'

