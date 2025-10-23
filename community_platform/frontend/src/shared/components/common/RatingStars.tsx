/**
 * RatingStars 星级评分组件
 * 显示和编辑星级评分
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface RatingStarsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: number
  onChange?: (value: number) => void
  max?: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  precision?: 0.5 | 1
  readOnly?: boolean
  disabled?: boolean
  showValue?: boolean
  emptyIcon?: React.ReactNode
  filledIcon?: React.ReactNode
  halfFilledIcon?: React.ReactNode
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
}

export const RatingStars = React.forwardRef<HTMLDivElement, RatingStarsProps>(
  (
    {
      className,
      value = 0,
      onChange,
      max = 5,
      size = 'md',
      precision = 1,
      readOnly = false,
      disabled = false,
      showValue = false,
      emptyIcon,
      filledIcon,
      halfFilledIcon,
      ...props
    },
    ref
  ) => {
    const [hoverValue, setHoverValue] = React.useState<number | null>(null)
    const [internalValue, setInternalValue] = React.useState(value)

    React.useEffect(() => {
      setInternalValue(value)
    }, [value])

    const displayValue = hoverValue !== null ? hoverValue : internalValue

    const handleClick = (starValue: number): void => {
      if (readOnly || disabled) return

      setInternalValue(starValue)
      onChange?.(starValue)
    }

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number): void => {
      if (readOnly || disabled) return

      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percent = x / rect.width

      let newValue = index + 1

      if (precision === 0.5) {
        newValue = percent < 0.5 ? index + 0.5 : index + 1
      }

      setHoverValue(newValue)
    }

    const handleMouseLeave = (): void => {
      setHoverValue(null)
    }

    const getStarType = (index: number): 'empty' | 'half' | 'full' => {
      const diff = displayValue - index

      if (diff >= 1) return 'full'
      if (diff >= 0.5 && precision === 0.5) return 'half'
      return 'empty'
    }

    const defaultEmptyIcon = (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    )

    const defaultFilledIcon = (
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    )

    const defaultHalfFilledIcon = (
      <svg fill="none" viewBox="0 0 24 24">
        <defs>
          <linearGradient id="half-gradient">
            <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path
          fill="url(#half-gradient)"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    )

    return (
      <div
        ref={ref}
        className={cn('inline-flex items-center gap-1', className)}
        {...props}
      >
        <div
          className="flex items-center gap-0.5"
          onMouseLeave={handleMouseLeave}
        >
          {Array.from({ length: max }, (_, index) => {
            const starType = getStarType(index)

            return (
              <div
                key={index}
                className={cn(
                  sizeClasses[size],
                  'transition-colors',
                  !readOnly && !disabled && 'cursor-pointer',
                  disabled && 'opacity-50 cursor-not-allowed',
                  starType === 'full' && 'text-yellow-400',
                  starType === 'half' && 'text-yellow-400',
                  starType === 'empty' && 'text-gray-300 dark:text-gray-600'
                )}
                onClick={() => handleClick(index + 1)}
                onMouseMove={(e) => handleMouseMove(e, index)}
              >
                {starType === 'full' && (filledIcon || defaultFilledIcon)}
                {starType === 'half' && (halfFilledIcon || defaultHalfFilledIcon)}
                {starType === 'empty' && (emptyIcon || defaultEmptyIcon)}
              </div>
            )
          })}
        </div>

        {showValue && (
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            {displayValue.toFixed(precision === 0.5 ? 1 : 0)} / {max}
          </span>
        )}
      </div>
    )
  }
)

RatingStars.displayName = 'RatingStars'

