/**
 * 虚拟滚动列表组件
 * 优化长列表渲染性能
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

interface VirtualListProps<T> {
  /**
   * 列表数据
   */
  items: T[];
  /**
   * 渲染项函数
   */
  renderItem: (item: T, index: number) => ReactNode;
  /**
   * 项高度（固定）
   */
  itemHeight?: number;
  /**
   * 估算项高度（动态）
   */
  estimateItemHeight?: (index: number) => number;
  /**
   * 过扫描数量（上下额外渲染的项数）
   */
  overscan?: number;
  /**
   * 容器类名
   */
  className?: string;
  /**
   * 列表类名
   */
  listClassName?: string;
  /**
   * 加载更多回调
   */
  onLoadMore?: () => void;
  /**
   * 是否正在加载
   */
  isLoading?: boolean;
  /**
   * 是否还有更多数据
   */
  hasMore?: boolean;
  /**
   * 加载组件
   */
  loadingComponent?: ReactNode;
  /**
   * 空状态组件
   */
  emptyComponent?: ReactNode;
}

/**
 * 虚拟滚动列表
 */
export function VirtualList<T>({
  items,
  renderItem,
  itemHeight,
  estimateItemHeight,
  overscan = 5,
  className,
  listClassName,
  onLoadMore,
  isLoading,
  hasMore,
  loadingComponent,
  emptyComponent,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateItemHeight || (() => itemHeight || 100),
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // 检测是否滚动到底部
  const handleScroll = () => {
    if (!parentRef.current || !onLoadMore || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    // 滚动到 80% 时触发加载
    if (scrollPercentage > 0.8) {
      onLoadMore();
    }
  };

  // 空状态
  if (items.length === 0 && !isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        {emptyComponent || (
          <p className="text-muted-foreground">暂无数据</p>
        )}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      onScroll={handleScroll}
    >
      <div
        className={cn('relative', listClassName)}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full"
            style={{
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {virtualItem.index < items.length ? renderItem(items[virtualItem.index]!, virtualItem.index) : null}
          </div>
        ))}

        {/* 加载更多指示器 */}
        {isLoading && (
          <div className="absolute bottom-0 left-0 w-full py-4 flex justify-center">
            {loadingComponent || (
              <div className="text-muted-foreground">加载中...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 虚拟网格组件
 */
interface VirtualGridProps<T> {
  /**
   * 列表数据
   */
  items: T[];
  /**
   * 渲染项函数
   */
  renderItem: (item: T, index: number) => ReactNode;
  /**
   * 列数
   */
  columns?: number;
  /**
   * 行高度
   */
  rowHeight?: number;
  /**
   * 间距
   */
  gap?: number;
  /**
   * 过扫描数量
   */
  overscan?: number;
  /**
   * 容器类名
   */
  className?: string;
  /**
   * 加载更多回调
   */
  onLoadMore?: () => void;
  /**
   * 是否正在加载
   */
  isLoading?: boolean;
  /**
   * 是否还有更多数据
   */
  hasMore?: boolean;
}

export function VirtualGrid<T>({
  items,
  renderItem,
  columns = 3,
  rowHeight = 300,
  gap = 16,
  overscan = 2,
  className,
  onLoadMore,
  isLoading,
  hasMore,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // 计算行数
  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight + gap,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();

  const handleScroll = () => {
    if (!parentRef.current || !onLoadMore || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage > 0.8) {
      onLoadMore();
    }
  };

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      onScroll={handleScroll}
    >
      <div
        className="relative"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = items.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${rowHeight}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="grid h-full"
                style={{
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: `${gap}px`,
                }}
              >
                {rowItems.map((item, colIndex) =>
                  renderItem(item, startIndex + colIndex)
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="absolute bottom-0 left-0 w-full py-4 flex justify-center">
            <div className="text-muted-foreground">加载中...</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 虚拟表格组件
 */
interface VirtualTableProps<T> {
  /**
   * 表格数据
   */
  data: T[];
  /**
   * 列配置
   */
  columns: Array<{
    key: string;
    header: string;
    width?: number;
    render?: (item: T) => ReactNode;
  }>;
  /**
   * 行高度
   */
  rowHeight?: number;
  /**
   * 过扫描数量
   */
  overscan?: number;
  /**
   * 容器类名
   */
  className?: string;
}

export function VirtualTable<T extends Record<string, unknown>>({
  data,
  columns,
  rowHeight = 48,
  overscan = 5,
  className,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div className={cn('overflow-auto', className)}>
      {/* 表头 */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex">
          {columns.map((column) => (
            <div
              key={column.key}
              className="px-4 py-2 font-medium text-sm"
              style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* 表体 */}
      <div ref={parentRef}>
        <div
          className="relative"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualRows.map((virtualRow) => {
            const item = data[virtualRow.index];

            return (
              <div
                key={virtualRow.key}
                className="absolute top-0 left-0 w-full border-b hover:bg-muted/50 transition-colors"
                style={{
                  height: `${rowHeight}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex h-full items-center">
                  {columns.map((column) => (
                    <div
                      key={column.key}
                      className="px-4 py-2 text-sm"
                      style={{
                        width: column.width || 'auto',
                        flex: column.width ? undefined : 1,
                      }}
                    >
                      {item && column.render
                        ? column.render(item)
                        : String(item?.[column.key] ?? '')}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

