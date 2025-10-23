import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

const spinnerVariants = cva('animate-spin', {
  variants: {
    size: {
      sm: 'h-4 w-4',
      default: 'h-6 w-6',
      lg: 'h-8 w-8',
      xl: 'h-12 w-12',
    },
    variant: {
      default: 'text-primary',
      muted: 'text-muted-foreground',
      white: 'text-white',
    },
  },
  defaultVariants: {
    size: 'default',
    variant: 'default',
  },
})

export interface LoadingSpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  /**
   * 加载文本
   */
  label?: string
  /**
   * 是否全屏居中显示
   */
  fullScreen?: boolean
}

/**
 * 加载旋转器组件
 * 用于显示加载状态
 *
 * @example
 * ```tsx
 * <LoadingSpinner />
 * <LoadingSpinner size="lg" label="加载中..." />
 * <LoadingSpinner fullScreen />
 * ```
 */
const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  (
    {
      className,
      size,
      variant,
      label,
      fullScreen = false,
      ...props
    },
    ref
  ) => {
    const spinner = (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center gap-2',
          fullScreen && 'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm',
          className
        )}
        role="status"
        aria-label={label || '加载中'}
        {...props}
      >
        <Loader2 className={cn(spinnerVariants({ size, variant }))} />
        {label && (
          <p className={cn('text-sm text-muted-foreground', {
            'text-xs': size === 'sm',
            'text-base': size === 'lg' || size === 'xl',
          })}>
            {label}
          </p>
        )}
      </div>
    )

    return spinner
  }
)
LoadingSpinner.displayName = 'LoadingSpinner'

export { LoadingSpinner, spinnerVariants }

