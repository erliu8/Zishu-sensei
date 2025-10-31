/**
 * 虚拟滚动优化组件
 * 基于 @tanstack/react-virtual 的增强实现
 */

'use client'

import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual'
import { useRef, ReactNode, CSSProperties } from 'react'
import { cn } from '@/shared/utils/cn'

/**
 * 虚拟滚动配置
 */
export interface VirtualScrollConfig {
  /**
   * 项目总数
   */
  count: number

  /**
   * 估算每项高度
   */
  estimateSize: number

  /**
   * 过扫描项目数量（提高滚动流畅度）
   */
  overscan?: number

  /**
   * 是否启用水平滚动
   */
  horizontal?: boolean

  /**
   * 间距
   */
  gap?: number

  /**
   * 滚动边距
   */
  scrollMargin?: number

  /**
   * 是否启用平滑滚动
   */
  smoothScroll?: boolean
}

/**
 * 虚拟滚动列表组件属性
 */
interface VirtualScrollListProps<T> {
  /**
   * 数据列表
   */
  items: T[]

  /**
   * 渲染项目函数
   */
  renderItem: (item: T, index: number, virtualItem: VirtualItem) => ReactNode

  /**
   * 虚拟滚动配置
   */
  config: Omit<VirtualScrollConfig, 'count'>

  /**
   * 容器类名
   */
  className?: string

  /**
   * 列表类名
   */
  listClassName?: string

  /**
   * 项目类名
   */
  itemClassName?: string

  /**
   * 加载更多回调
   */
  onLoadMore?: () => void

  /**
   * 是否正在加载
   */
  isLoading?: boolean

  /**
   * 加载指示器
   */
  loadingIndicator?: ReactNode

  /**
   * 空状态
   */
  emptyState?: ReactNode

  /**
   * 容器高度
   */
  height?: string | number
}

/**
 * 虚拟滚动列表组件
 */
export function VirtualScrollList<T>({
  items,
  renderItem,
  config,
  className,
  listClassName,
  itemClassName,
  onLoadMore,
  isLoading = false,
  loadingIndicator,
  emptyState,
  height = '100%',
}: VirtualScrollListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => config.estimateSize,
    overscan: config.overscan ?? 5,
    gap: config.gap,
    scrollMargin: config.scrollMargin,
    horizontal: config.horizontal,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // 无限滚动检测
  const lastItem = virtualItems[virtualItems.length - 1]
  if (
    lastItem &&
    lastItem.index >= items.length - 1 &&
    onLoadMore &&
    !isLoading
  ) {
    onLoadMore()
  }

  // 空状态
  if (items.length === 0 && !isLoading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center',
          className
        )}
        style={{ height }}
      >
        {emptyState || <p className="text-muted-foreground">暂无数据</p>}
      </div>
    )
  }

  const scrollBehavior: CSSProperties = config.smoothScroll
    ? { scrollBehavior: 'smooth' }
    : {}

  return (
    <div
      ref={parentRef}
      className={cn(
        'overflow-auto',
        config.horizontal ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto overflow-x-hidden',
        className
      )}
      style={{ height, ...scrollBehavior }}
    >
      <div
        className={cn('relative', listClassName)}
        style={{
          [config.horizontal ? 'width' : 'height']: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index]
          
          if (!item) return null
          
          return (
            <div
              key={virtualItem.key}
              className={cn('absolute top-0 left-0 w-full', itemClassName)}
              style={{
                [config.horizontal ? 'left' : 'top']: `${virtualItem.start}px`,
                [config.horizontal ? 'width' : 'height']: `${virtualItem.size}px`,
              }}
              data-index={virtualItem.index}
            >
              {renderItem(item, virtualItem.index, virtualItem)}
            </div>
          )
        })}

        {/* 加载指示器 */}
        {isLoading && loadingIndicator && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center p-4">
            {loadingIndicator}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 虚拟网格组件属性
 */
interface VirtualGridProps<T> {
  /**
   * 数据列表
   */
  items: T[]

  /**
   * 渲染项目函数
   */
  renderItem: (item: T, index: number) => ReactNode

  /**
   * 列数
   */
  columns: number

  /**
   * 行高
   */
  rowHeight: number

  /**
   * 间距
   */
  gap?: number

  /**
   * 容器类名
   */
  className?: string

  /**
   * 容器高度
   */
  height?: string | number

  /**
   * 加载更多回调
   */
  onLoadMore?: () => void

  /**
   * 是否正在加载
   */
  isLoading?: boolean
}

/**
 * 虚拟网格组件
 */
export function VirtualGrid<T>({
  items,
  renderItem,
  columns,
  rowHeight,
  gap = 16,
  className,
  height = '100%',
  onLoadMore,
  isLoading = false,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  // 计算行数
  const rowCount = Math.ceil(items.length / columns)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight + gap,
    overscan: 3,
  })

  const virtualRows = virtualizer.getVirtualItems()

  // 无限滚动检测
  const lastRow = virtualRows[virtualRows.length - 1]
  if (
    lastRow &&
    lastRow.index >= rowCount - 1 &&
    onLoadMore &&
    !isLoading
  ) {
    onLoadMore()
  }

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ height }}
    >
      <div
        className="relative"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns
          const endIndex = Math.min(startIndex + columns, items.length)
          const rowItems = items.slice(startIndex, endIndex)

          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full"
              style={{
                top: `${virtualRow.start}px`,
                height: `${rowHeight}px`,
              }}
            >
              <div
                className="grid h-full"
                style={{
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: `${gap}px`,
                }}
              >
                {rowItems.map((item, colIndex) => (
                  <div key={startIndex + colIndex}>
                    {renderItem(item, startIndex + colIndex)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 虚拟滚动工具函数
 */
export const virtualScrollUtils = {
  /**
   * 计算动态项目高度
   */
  measureElement: (element: HTMLElement): number => {
    return element.getBoundingClientRect().height
  },

  /**
   * 滚动到指定索引
   */
  scrollToIndex: (
    virtualizer: ReturnType<typeof useVirtualizer>,
    index: number,
    options?: { align?: 'start' | 'center' | 'end'; smooth?: boolean }
  ) => {
    virtualizer.scrollToIndex(index, {
      align: options?.align,
      behavior: options?.smooth ? 'smooth' : 'auto',
    })
  },

  /**
   * 滚动到顶部
   */
  scrollToTop: (parentRef: React.RefObject<HTMLElement>, smooth = true) => {
    parentRef.current?.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto',
    })
  },

  /**
   * 滚动到底部
   */
  scrollToBottom: (parentRef: React.RefObject<HTMLElement>, smooth = true) => {
    if (parentRef.current) {
      parentRef.current.scrollTo({
        top: parentRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      })
    }
  },
}

/**
 * Hook - 使用虚拟滚动
 */
export function useVirtualScroll<T>(
  items: T[],
  config: VirtualScrollConfig
) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => config.estimateSize,
    overscan: config.overscan ?? 5,
    gap: config.gap,
    scrollMargin: config.scrollMargin,
    horizontal: config.horizontal,
  })

  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    scrollToIndex: (index: number, options?: { align?: 'start' | 'center' | 'end' }) =>
      virtualizer.scrollToIndex(index, options),
  }
}

