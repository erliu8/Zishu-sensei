/**
 * 虚拟化列表组件
 * 
 * 高性能虚拟滚动列表，用于渲染大量数据
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, CSSProperties } from 'react';
import './VirtualList.css';

// ============================================================================
// 类型定义
// ============================================================================

export interface VirtualListProps<T = any> {
  // 数据列表
  items: T[];
  // 项目高度（固定高度模式）
  itemHeight?: number;
  // 估算项目高度（动态高度模式）
  estimatedItemHeight?: number;
  // 容器高度
  height: number | string;
  // 容器宽度
  width?: number | string;
  // 过扫描数量（视口外渲染的项目数）
  overscanCount?: number;
  // 渲染项目的函数
  renderItem: (item: T, index: number) => React.ReactNode;
  // 项目键生成函数
  getItemKey?: (item: T, index: number) => string | number;
  // 滚动回调
  onScroll?: (scrollTop: number, scrollLeft: number) => void;
  // 项目点击回调
  onItemClick?: (item: T, index: number) => void;
  // 是否启用缓存
  enableCache?: boolean;
  // 缓存大小
  cacheSize?: number;
  // 滚动行为
  scrollBehavior?: 'auto' | 'smooth';
  // 空状态提示
  emptyText?: string;
  // 加载状态
  loading?: boolean;
  // 加载提示
  loadingText?: string;
  // 自定义类名
  className?: string;
  // 自定义样式
  style?: CSSProperties;
}

interface VirtualItemMeasurement {
  height: number;
  offset: number;
}

// ============================================================================
// 虚拟化列表组件
// ============================================================================

export function VirtualList<T = any>(props: VirtualListProps<T>) {
  const {
    items,
    itemHeight,
    estimatedItemHeight = 50,
    height,
    width = '100%',
    overscanCount = 3,
    renderItem,
    getItemKey = (_, index) => index,
    onScroll,
    onItemClick,
    enableCache = true,
    cacheSize = 100,
    scrollBehavior = 'auto',
    emptyText = '暂无数据',
    loading = false,
    loadingText = '加载中...',
    className = '',
    style = {},
  } = props;

  // 状态
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeights, setMeasuredHeights] = useState<Map<number, number>>(new Map());
  
  // 引用
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string | number, React.ReactNode>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // 是否为固定高度模式
  const isFixedHeight = itemHeight !== undefined;

  // 计算项目测量数据
  const measurements = useMemo<VirtualItemMeasurement[]>(() => {
    if (isFixedHeight) {
      // 固定高度模式
      return items.map((_, index) => ({
        height: itemHeight!,
        offset: index * itemHeight!,
      }));
    } else {
      // 动态高度模式
      let offset = 0;
      return items.map((_, index) => {
        const height = measuredHeights.get(index) || estimatedItemHeight;
        const measurement = { height, offset };
        offset += height;
        return measurement;
      });
    }
  }, [items, itemHeight, isFixedHeight, measuredHeights, estimatedItemHeight]);

  // 计算总高度
  const totalHeight = useMemo(() => {
    if (measurements.length === 0) return 0;
    const lastMeasurement = measurements[measurements.length - 1];
    return lastMeasurement.offset + lastMeasurement.height;
  }, [measurements]);

  // 计算容器高度
  const containerHeight = useMemo(() => {
    if (containerRef.current) {
      return containerRef.current.clientHeight;
    }
    return typeof height === 'number' ? height : 600;
  }, [height]);

  // 计算可见范围
  const visibleRange = useMemo(() => {
    let start = 0;
    let end = items.length;

    // 二分查找起始索引
    let low = 0;
    let high = measurements.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const measurement = measurements[mid];
      
      if (measurement.offset < scrollTop) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    start = Math.max(0, high);

    // 查找结束索引
    for (let i = start; i < measurements.length; i++) {
      if (measurements[i].offset >= scrollTop + containerHeight) {
        end = i;
        break;
      }
    }

    // 应用过扫描
    start = Math.max(0, start - overscanCount);
    end = Math.min(items.length, end + overscanCount);

    return { start, end };
  }, [scrollTop, containerHeight, measurements, items.length, overscanCount]);

  // 可见项目
  const visibleItems = useMemo(() => {
    const result: Array<{
      item: T;
      index: number;
      offset: number;
      height: number;
      key: string | number;
    }> = [];

    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      const measurement = measurements[i];
      result.push({
        item: items[i],
        index: i,
        offset: measurement.offset,
        height: measurement.height,
        key: getItemKey(items[i], i),
      });
    }

    return result;
  }, [visibleRange, items, measurements, getItemKey]);

  // 滚动处理
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const newScrollTop = target.scrollTop;
      
      setScrollTop(newScrollTop);
      
      if (onScroll) {
        onScroll(newScrollTop, target.scrollLeft);
      }
    },
    [onScroll]
  );

  // 项目点击处理
  const handleItemClick = useCallback(
    (item: T, index: number) => {
      if (onItemClick) {
        onItemClick(item, index);
      }
    },
    [onItemClick]
  );

  // 测量项目高度（动态高度模式）
  const measureItem = useCallback((index: number, element: HTMLElement | null) => {
    if (!element || isFixedHeight) return;

    const height = element.offsetHeight;
    
    setMeasuredHeights((prev) => {
      if (prev.get(index) === height) {
        return prev;
      }
      const newMap = new Map(prev);
      newMap.set(index, height);
      return newMap;
    });
  }, [isFixedHeight]);

  // 渲染项目（带缓存）
  const renderCachedItem = useCallback(
    (item: T, index: number, key: string | number) => {
      if (enableCache) {
        const cached = cacheRef.current.get(key);
        if (cached) {
          return cached;
        }
      }

      const rendered = renderItem(item, index);
      
      if (enableCache) {
        cacheRef.current.set(key, rendered);
        
        // 限制缓存大小
        if (cacheRef.current.size > cacheSize) {
          const firstKey = cacheRef.current.keys().next().value;
          cacheRef.current.delete(firstKey);
        }
      }

      return rendered;
    },
    [renderItem, enableCache, cacheSize]
  );

  // 滚动到指定索引
  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = scrollBehavior) => {
      if (!containerRef.current) return;

      const measurement = measurements[index];
      if (!measurement) return;

      containerRef.current.scrollTo({
        top: measurement.offset,
        behavior,
      });
    },
    [measurements, scrollBehavior]
  );

  // 滚动到顶部
  const scrollToTop = useCallback(
    (behavior: ScrollBehavior = scrollBehavior) => {
      if (!containerRef.current) return;

      containerRef.current.scrollTo({
        top: 0,
        behavior,
      });
    },
    [scrollBehavior]
  );

  // 滚动到底部
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = scrollBehavior) => {
      if (!containerRef.current) return;

      containerRef.current.scrollTo({
        top: totalHeight,
        behavior,
      });
    },
    [totalHeight, scrollBehavior]
  );

  // 设置 ResizeObserver（动态高度模式）
  useEffect(() => {
    if (isFixedHeight || !contentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const index = parseInt(target.dataset.index || '-1', 10);
        
        if (index >= 0) {
          measureItem(index, target);
        }
      }
    });

    resizeObserverRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [isFixedHeight, measureItem]);

  // 清空缓存（当items变化时）
  useEffect(() => {
    if (enableCache) {
      cacheRef.current.clear();
    }
  }, [items, enableCache]);

  // 暴露方法
  React.useImperativeHandle(
    props.ref as any,
    () => ({
      scrollToIndex,
      scrollToTop,
      scrollToBottom,
      getScrollTop: () => scrollTop,
      getTotalHeight: () => totalHeight,
    }),
    [scrollToIndex, scrollToTop, scrollToBottom, scrollTop, totalHeight]
  );

  // 渲染
  return (
    <div
      ref={containerRef}
      className={`virtual-list ${className}`}
      style={{
        height,
        width,
        overflow: 'auto',
        position: 'relative',
        ...style,
      }}
      onScroll={handleScroll}
    >
      {/* 内容容器 */}
      <div
        ref={contentRef}
        className="virtual-list-content"
        style={{
          height: totalHeight,
          position: 'relative',
        }}
      >
        {/* 可见项目 */}
        {visibleItems.map(({ item, index, offset, height, key }) => (
          <div
            key={key}
            data-index={index}
            className="virtual-list-item"
            style={{
              position: 'absolute',
              top: offset,
              left: 0,
              right: 0,
              height: isFixedHeight ? height : undefined,
              minHeight: isFixedHeight ? undefined : height,
            }}
            onClick={() => handleItemClick(item, index)}
            ref={(el) => {
              if (!isFixedHeight && el && resizeObserverRef.current) {
                resizeObserverRef.current.observe(el);
              }
            }}
          >
            {renderCachedItem(item, index, key)}
          </div>
        ))}
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="virtual-list-loading">
          <div className="loading-spinner" />
          <span>{loadingText}</span>
        </div>
      )}

      {/* 空状态 */}
      {!loading && items.length === 0 && (
        <div className="virtual-list-empty">
          <span>{emptyText}</span>
        </div>
      )}
    </div>
  );
}

// 默认导出
export default VirtualList;

// 导出类型
export type { VirtualListProps };

