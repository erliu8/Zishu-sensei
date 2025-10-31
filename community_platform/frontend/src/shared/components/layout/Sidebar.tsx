/**
 * Sidebar 侧边栏组件
 * 提供侧边导航栏，支持固定和折叠
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface SidebarProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  position?: 'left' | 'right'
  width?: 'sm' | 'md' | 'lg'
  collapsible?: boolean
  defaultCollapsed?: boolean
  fixed?: boolean
  children?: React.ReactNode | ((props: { isCollapsed: boolean }) => React.ReactNode)
}

const widthClasses = {
  sm: 'w-48',
  md: 'w-64',
  lg: 'w-80',
}

const collapsedWidthClasses = {
  sm: 'w-16',
  md: 'w-20',
  lg: 'w-24',
}

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  (
    {
      className,
      position = 'left',
      width = 'md',
      collapsible = false,
      defaultCollapsed = false,
      fixed = true,
      children,
      ...props
    },
    ref
  ) => {
    const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)

    return (
      <aside
        ref={ref}
        className={cn(
          'flex flex-col border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300',
          position === 'left' ? 'border-r' : 'border-l',
          fixed && 'sticky top-16 h-[calc(100vh-4rem)]',
          isCollapsed ? collapsedWidthClasses[width] : widthClasses[width],
          className
        )}
        {...props}
      >
        {collapsible && (
          <div className="flex items-center justify-end p-4 border-b border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              <svg
                className={cn('w-5 h-5 transition-transform', isCollapsed && 'rotate-180')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={position === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
                />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto py-4">
          {typeof children === 'function'
            ? children({ isCollapsed })
            : children}
        </div>
      </aside>
    )
  }
)

Sidebar.displayName = 'Sidebar'

// SidebarSection 子组件
export interface SidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
}

export const SidebarSection = React.forwardRef<HTMLDivElement, SidebarSectionProps>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('px-3 mb-6', className)} {...props}>
        {title && (
          <h3 className="mb-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {title}
          </h3>
        )}
        <div className="space-y-1">
          {children}
        </div>
      </div>
    )
  }
)

SidebarSection.displayName = 'SidebarSection'

