/**
 * Avatar 头像组件
 * 显示用户头像，支持图片、文字和图标
 */

import { cn } from '@/shared/utils'
import { VariantProps, cva } from 'class-variance-authority'
import React from 'react'

const avatarVariants = cva(
  'relative inline-flex items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium',
  {
    variants: {
      size: {
        xs: 'w-6 h-6 text-xs',
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-12 h-12 text-lg',
        xl: 'w-16 h-16 text-xl',
        '2xl': 'w-20 h-20 text-2xl',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
)

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string
  alt?: string
  fallback?: string
  icon?: React.ReactNode
  status?: 'online' | 'offline' | 'busy' | 'away'
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, src, alt, fallback, icon, status, ...props }, ref) => {
    const [imageError, setImageError] = React.useState(false)
    const [imageLoaded, setImageLoaded] = React.useState(false)

    const showImage = src && !imageError
    const showFallback = !showImage && (fallback || alt)
    const showIcon = !showImage && !showFallback && icon

    // 生成 fallback 文本（取名字的首字母）
    const getFallbackText = (): string => {
      const text = fallback || alt || '?'
      return text
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }

    return (
      <div
        ref={ref}
        className={cn(avatarVariants({ size }), className)}
        {...props}
      >
        {showImage && (
          <>
            <img
              src={src}
              alt={alt || ''}
              className={cn(
                'w-full h-full object-cover transition-opacity duration-200',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              onError={() => setImageError(true)}
              onLoad={() => setImageLoaded(true)}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-pulse w-full h-full bg-gray-300 dark:bg-gray-600" />
              </div>
            )}
          </>
        )}

        {showFallback && <span>{getFallbackText()}</span>}

        {showIcon && <span className="flex items-center justify-center">{icon}</span>}

        {status && <AvatarStatus status={status} size={size || 'md'} />}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'

// AvatarStatus 状态指示器
interface AvatarStatusProps {
  status: 'online' | 'offline' | 'busy' | 'away'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  busy: 'bg-red-500',
  away: 'bg-yellow-500',
}

const statusSizes = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
}

const AvatarStatus: React.FC<AvatarStatusProps> = ({ status, size = 'md' }) => {
  return (
    <span
      className={cn(
        'absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-gray-900',
        statusColors[status],
        statusSizes[size]
      )}
      aria-label={status}
    />
  )
}

// AvatarGroup 头像组
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, max = 5, size = 'md', children, ...props }, ref) => {
    const childrenArray = React.Children.toArray(children)
    const displayChildren = max ? childrenArray.slice(0, max) : childrenArray
    const extraCount = childrenArray.length - displayChildren.length

    return (
      <div
        ref={ref}
        className={cn('flex items-center -space-x-2', className)}
        {...props}
      >
        {displayChildren.map((child, index) => (
          <div
            key={index}
            className="ring-2 ring-white dark:ring-gray-900 rounded-full"
            style={{ zIndex: displayChildren.length - index }}
          >
            {React.isValidElement(child)
              ? React.cloneElement(child, { size } as any)
              : child}
          </div>
        ))}
        {extraCount > 0 && (
          <div
            className="ring-2 ring-white dark:ring-gray-900 rounded-full"
            style={{ zIndex: 0 }}
          >
            <Avatar size={size} fallback={`+${extraCount}`} />
          </div>
        )}
      </div>
    )
  }
)

AvatarGroup.displayName = 'AvatarGroup'

