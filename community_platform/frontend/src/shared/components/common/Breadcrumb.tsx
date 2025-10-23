/**
 * Breadcrumb 面包屑导航组件
 * 显示当前页面的层级路径
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
}

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  maxItems?: number
  itemsBeforeCollapse?: number
  itemsAfterCollapse?: number
}

export const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  (
    {
      className,
      items,
      separator,
      maxItems,
      itemsBeforeCollapse = 1,
      itemsAfterCollapse = 1,
      ...props
    },
    ref
  ) => {
    const defaultSeparator = (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    )

    const renderSeparator = (): React.ReactNode => {
      return (
        <span className="mx-2 text-gray-400 dark:text-gray-600">
          {separator || defaultSeparator}
        </span>
      )
    }

    // 处理项目折叠
    const displayItems = React.useMemo(() => {
      if (!maxItems || items.length <= maxItems) {
        return items
      }

      const collapsedItems: (BreadcrumbItem | 'ellipsis')[] = []

      // 添加开始的项目
      for (let i = 0; i < itemsBeforeCollapse; i++) {
        const item = items[i]
        if (item) {
          collapsedItems.push(item)
        }
      }

      // 添加省略号
      collapsedItems.push('ellipsis')

      // 添加结束的项目
      for (let i = items.length - itemsAfterCollapse; i < items.length; i++) {
        const item = items[i]
        if (item) {
          collapsedItems.push(item)
        }
      }

      return collapsedItems
    }, [items, maxItems, itemsBeforeCollapse, itemsAfterCollapse])

    return (
      <nav
        ref={ref}
        className={cn('flex items-center space-x-1', className)}
        aria-label="面包屑导航"
        {...props}
      >
        <ol className="flex items-center space-x-1">
          {displayItems.map((item, index) => {
            const isLast = index === displayItems.length - 1

            if (item === 'ellipsis') {
              return (
                <React.Fragment key="ellipsis">
                  {index > 0 && renderSeparator()}
                  <li>
                    <span className="px-2 text-gray-400 dark:text-gray-600">...</span>
                  </li>
                </React.Fragment>
              )
            }

            return (
              <React.Fragment key={index}>
                {index > 0 && renderSeparator()}
                <li className="flex items-center">
                  {item.href && !isLast ? (
                    <a
                      href={item.href}
                      className={cn(
                        'flex items-center space-x-1.5 px-2 py-1 rounded-md text-sm transition-colors',
                        'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                        'dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                      )}
                    >
                      {item.icon && (
                        <span className="flex-shrink-0">{item.icon}</span>
                      )}
                      <span>{item.label}</span>
                    </a>
                  ) : (
                    <span
                      className={cn(
                        'flex items-center space-x-1.5 px-2 py-1 text-sm',
                        isLast
                          ? 'text-gray-900 dark:text-gray-100 font-medium'
                          : 'text-gray-600 dark:text-gray-400'
                      )}
                      aria-current={isLast ? 'page' : undefined}
                    >
                      {item.icon && (
                        <span className="flex-shrink-0">{item.icon}</span>
                      )}
                      <span>{item.label}</span>
                    </span>
                  )}
                </li>
              </React.Fragment>
            )
          })}
        </ol>
      </nav>
    )
  }
)

Breadcrumb.displayName = 'Breadcrumb'

