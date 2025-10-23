/**
 * Pagination 分页组件
 * 提供页码导航功能
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface PaginationProps extends React.HTMLAttributes<HTMLElement> {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  showFirstLast?: boolean
  showPrevNext?: boolean
  maxPageButtons?: number
  disabled?: boolean
}

export const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  (
    {
      className,
      currentPage,
      totalPages,
      onPageChange,
      showFirstLast = true,
      showPrevNext = true,
      maxPageButtons = 7,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const getPageNumbers = (): (number | string)[] => {
      if (totalPages <= maxPageButtons) {
        return Array.from({ length: totalPages }, (_, i) => i + 1)
      }

      const pages: (number | string)[] = []
      const halfMaxButtons = Math.floor(maxPageButtons / 2)

      let startPage = Math.max(currentPage - halfMaxButtons, 1)
      let endPage = Math.min(startPage + maxPageButtons - 1, totalPages)

      if (endPage - startPage < maxPageButtons - 1) {
        startPage = Math.max(endPage - maxPageButtons + 1, 1)
      }

      if (startPage > 1) {
        pages.push(1)
        if (startPage > 2) {
          pages.push('...')
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push('...')
        }
        pages.push(totalPages)
      }

      return pages
    }

    const handlePageChange = (page: number): void => {
      if (disabled || page < 1 || page > totalPages || page === currentPage) {
        return
      }
      onPageChange(page)
    }

    const pageNumbers = getPageNumbers()

    return (
      <nav
        ref={ref}
        className={cn('flex items-center justify-center space-x-1', className)}
        aria-label="分页导航"
        {...props}
      >
        {showFirstLast && (
          <PaginationButton
            onClick={() => handlePageChange(1)}
            disabled={disabled || currentPage === 1}
            aria-label="第一页"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </PaginationButton>
        )}

        {showPrevNext && (
          <PaginationButton
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={disabled || currentPage === 1}
            aria-label="上一页"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </PaginationButton>
        )}

        {pageNumbers.map((page, index) => {
          if (page === '...') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-gray-500"
              >
                ...
              </span>
            )
          }

          return (
            <PaginationButton
              key={page}
              onClick={() => handlePageChange(page as number)}
              disabled={disabled}
              active={page === currentPage}
              aria-label={`第 ${page} 页`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </PaginationButton>
          )
        })}

        {showPrevNext && (
          <PaginationButton
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={disabled || currentPage === totalPages}
            aria-label="下一页"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </PaginationButton>
        )}

        {showFirstLast && (
          <PaginationButton
            onClick={() => handlePageChange(totalPages)}
            disabled={disabled || currentPage === totalPages}
            aria-label="最后一页"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </PaginationButton>
        )}
      </nav>
    )
  }
)

Pagination.displayName = 'Pagination'

// PaginationButton 子组件
interface PaginationButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

const PaginationButton = React.forwardRef<HTMLButtonElement, PaginationButtonProps>(
  ({ className, active = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'min-w-[2.5rem] h-10 px-3 rounded-md text-sm font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          active
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700',
          disabled && 'opacity-50 cursor-not-allowed hover:bg-white dark:hover:bg-gray-800',
          className
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)

PaginationButton.displayName = 'PaginationButton'

