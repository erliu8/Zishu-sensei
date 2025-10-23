/**
 * CopyButton 复制按钮组件
 * 提供一键复制文本功能
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface CopyButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  text: string
  onCopy?: () => void
  successDuration?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'icon' | 'text' | 'both'
  successText?: string
  copyText?: string
}

const sizeClasses = {
  sm: 'p-1.5 text-xs',
  md: 'p-2 text-sm',
  lg: 'p-3 text-base',
}

const iconSizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      className,
      text,
      onCopy,
      successDuration = 2000,
      size = 'md',
      variant = 'icon',
      successText = '已复制',
      copyText = '复制',
      disabled,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false)

    const handleCopy = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        onCopy?.()

        setTimeout(() => {
          setCopied(false)
        }, successDuration)
      } catch (err) {
        console.error('Failed to copy text:', err)
      }
    }

    const copyIcon = (
      <svg
        className={cn(iconSizeClasses[size])}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    )

    const checkIcon = (
      <svg
        className={cn(iconSizeClasses[size])}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    )

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleCopy}
        disabled={disabled || copied}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors',
          'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
          'dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          copied && 'text-green-600 dark:text-green-400',
          disabled && 'opacity-50 cursor-not-allowed',
          sizeClasses[size],
          className
        )}
        aria-label={copied ? successText : copyText}
        {...props}
      >
        {variant === 'icon' && (copied ? checkIcon : copyIcon)}
        
        {variant === 'text' && (
          <span>{copied ? successText : copyText}</span>
        )}
        
        {variant === 'both' && (
          <>
            {copied ? checkIcon : copyIcon}
            <span>{copied ? successText : copyText}</span>
          </>
        )}
      </button>
    )
  }
)

CopyButton.displayName = 'CopyButton'

