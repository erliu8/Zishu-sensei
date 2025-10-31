/**
 * 适配器列表组件
 * 展示适配器列表，支持网格和列表视图
 * @module features/adapter/components/marketplace
 */

import React from 'react';
import { Adapter } from '../../domain';
import { AdapterCard } from './AdapterCard';
import { EmptyState, LoadingSpinner } from '@/shared/components/common';
import { Package } from 'lucide-react';
import { cn } from '@/shared/utils';

/**
 * 适配器列表属性
 */
export interface AdapterListProps {
  /** 适配器数据列表 */
  adapters: Adapter[];
  /** 是否加载中 */
  loading?: boolean;
  /** 是否为空 */
  empty?: boolean;
  /** 空状态自定义文本 */
  emptyText?: string;
  /** 空状态自定义描述 */
  emptyDescription?: string;
  /** 显示模式 */
  viewMode?: 'grid' | 'list';
  /** 卡片变体 */
  cardVariant?: 'default' | 'compact' | 'detailed';
  /** 点击下载回调 */
  onDownload?: (adapter: Adapter) => void;
  /** 点击收藏回调 */
  onFavorite?: (adapter: Adapter) => void;
  /** 点击点赞回调 */
  onLike?: (adapter: Adapter) => void;
  /** 自定义样式 */
  className?: string;
}

/**
 * 适配器列表组件
 */
export const AdapterList: React.FC<AdapterListProps> = ({
  adapters,
  loading = false,
  empty = false,
  emptyText = '暂无适配器',
  emptyDescription = '当前没有找到符合条件的适配器',
  viewMode = 'grid',
  cardVariant = 'default',
  onDownload,
  onFavorite,
  onLike,
  className,
}) => {
  // 加载状态
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="lg" label="加载中..." />
      </div>
    );
  }

  // 空状态
  if (empty || adapters.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-12 w-12" />}
        title={emptyText}
        description={emptyDescription}
      />
    );
  }

  // 网格视图
  if (viewMode === 'grid') {
    return (
      <div className={cn(
        'grid gap-4',
        cardVariant === 'compact' 
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}>
        {adapters.map((adapter) => (
          <AdapterCard
            key={adapter.id}
            adapter={adapter}
            variant={cardVariant}
            onDownload={onDownload}
            onFavorite={onFavorite}
            onLike={onLike}
          />
        ))}
      </div>
    );
  }

  // 列表视图
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {adapters.map((adapter) => (
        <AdapterCard
          key={adapter.id}
          adapter={adapter}
          variant={cardVariant}
          onDownload={onDownload}
          onFavorite={onFavorite}
          onLike={onLike}
          className="w-full"
        />
      ))}
    </div>
  );
};

/**
 * 骨架屏组件
 */
export const AdapterListSkeleton: React.FC<{
  count?: number;
  viewMode?: 'grid' | 'list';
}> = ({ count = 6, viewMode = 'grid' }) => {
  return (
    <div className={cn(
      'grid gap-4',
      viewMode === 'grid' 
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1'
    )}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="h-[300px] animate-pulse rounded-lg border bg-muted"
        />
      ))}
    </div>
  );
};

