/**
 * Navigation 导航菜单组件
 * 提供多级导航菜单，支持高亮当前活动项
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface NavigationProps extends React.HTMLAttributes<HTMLElement> {
  orientation?: 'horizontal' | 'vertical'
}

export const Navigation = React.forwardRef<HTMLElement, NavigationProps>(
  ({ className, orientation = 'horizontal', children, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn(
          'flex',
          orientation === 'horizontal' ? 'flex-row space-x-1' : 'flex-col space-y-1',
          className
        )}
        {...props}
      >
        {children}
      </nav>
    )
  }
)

Navigation.displayName = 'Navigation'

// NavigationItem 子组件
export interface NavigationItemProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean
  icon?: React.ReactNode
  badge?: React.ReactNode
}

export const NavigationItem = React.forwardRef<HTMLAnchorElement, NavigationItemProps>(
  ({ className, active = false, icon, badge, children, ...props }, ref) => {
    return (
      <a
        ref={ref}
        className={cn(
          'group relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
          active
            ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
          className
        )}
        aria-current={active ? 'page' : undefined}
        {...props}
      >
        {icon && (
          <span className={cn('flex-shrink-0', active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300')}>
            {icon}
          </span>
        )}
        <span className="flex-1">{children}</span>
        {badge && (
          <span className="flex-shrink-0">
            {badge}
          </span>
        )}
      </a>
    )
  }
)

NavigationItem.displayName = 'NavigationItem'

// NavigationGroup 子组件
export interface NavigationGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  collapsible?: boolean
  defaultOpen?: boolean
}

export const NavigationGroup = React.forwardRef<HTMLDivElement, NavigationGroupProps>(
  ({ className, title, collapsible = false, defaultOpen = true, children, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen)

    return (
      <div ref={ref} className={cn('space-y-1', className)} {...props}>
        {title && (
          <button
            type="button"
            onClick={() => collapsible && setIsOpen(!isOpen)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider',
              collapsible && 'hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer'
            )}
          >
            <span>{title}</span>
            {collapsible && (
              <svg
                className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-90')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        )}
        {(!collapsible || isOpen) && (
          <div className="space-y-1">
            {children}
          </div>
        )}
      </div>
    )
  }
)

NavigationGroup.displayName = 'NavigationGroup'

