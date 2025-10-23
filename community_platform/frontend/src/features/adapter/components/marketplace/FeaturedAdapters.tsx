/**
 * 推荐适配器组件
 * 展示精选和推荐的适配器
 * @module features/adapter/components/marketplace
 */

import React from 'react';
import { Adapter } from '../../domain';
import { AdapterCard } from './AdapterCard';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Sparkles, ArrowRight, TrendingUp, Clock } from 'lucide-react';
import { cn } from '@/shared/utils';
import { LoadingSpinner } from '@/shared/components/common';

/**
 * 推荐适配器属性
 */
export interface FeaturedAdaptersProps {
  /** 推荐适配器列表 */
  adapters: Adapter[];
  /** 是否加载中 */
  loading?: boolean;
  /** 标题 */
  title?: string;
  /** 副标题 */
  subtitle?: string;
  /** 最大显示数量 */
  maxItems?: number;
  /** 点击查看更多回调 */
  onViewMore?: () => void;
  /** 点击下载回调 */
  onDownload?: (adapter: Adapter) => void;
  /** 点击收藏回调 */
  onFavorite?: (adapter: Adapter) => void;
  /** 点击点赞回调 */
  onLike?: (adapter: Adapter) => void;
  /** 显示模式 */
  variant?: 'featured' | 'trending' | 'latest';
  /** 自定义样式 */
  className?: string;
}

/**
 * 推荐适配器组件
 */
export const FeaturedAdapters: React.FC<FeaturedAdaptersProps> = ({
  adapters,
  loading = false,
  title,
  subtitle,
  maxItems = 6,
  onViewMore,
  onDownload,
  onFavorite,
  onLike,
  variant = 'featured',
  className,
}) => {
  // 配置
  const config = {
    featured: {
      title: '精选推荐',
      subtitle: '编辑精选的优质适配器',
      icon: Sparkles,
      iconColor: 'text-yellow-500',
    },
    trending: {
      title: '热门适配器',
      subtitle: '最受欢迎的适配器',
      icon: TrendingUp,
      iconColor: 'text-red-500',
    },
    latest: {
      title: '最新发布',
      subtitle: '刚刚上架的新适配器',
      icon: Clock,
      iconColor: 'text-blue-500',
    },
  };

  const { title: defaultTitle, subtitle: defaultSubtitle, icon: Icon, iconColor } = config[variant];
  const displayTitle = title || defaultTitle;
  const displaySubtitle = subtitle || defaultSubtitle;

  // 限制显示数量
  const displayAdapters = adapters.slice(0, maxItems);

  if (loading) {
    return (
      <div className={cn('rounded-lg border bg-card p-6', className)}>
        <div className="flex min-h-[300px] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (adapters.length === 0) {
    return null;
  }

  return (
    <section className={cn('rounded-lg border bg-card p-6', className)}>
      {/* 头部 */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-lg bg-muted p-2', iconColor)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{displayTitle}</h2>
            {displaySubtitle && (
              <p className="mt-1 text-sm text-muted-foreground">
                {displaySubtitle}
              </p>
            )}
          </div>
        </div>
        
        {onViewMore && adapters.length > maxItems && (
          <Button variant="ghost" onClick={onViewMore} className="gap-2">
            查看更多
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 适配器网格 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayAdapters.map((adapter) => (
          <AdapterCard
            key={adapter.id}
            adapter={adapter}
            featured={variant === 'featured'}
            isNew={variant === 'latest'}
            onDownload={onDownload}
            onFavorite={onFavorite}
            onLike={onLike}
          />
        ))}
      </div>
    </section>
  );
};

/**
 * 横向滚动推荐适配器属性
 */
export interface HorizontalFeaturedAdaptersProps extends FeaturedAdaptersProps {
  /** 卡片宽度 */
  cardWidth?: number;
}

/**
 * 横向滚动推荐适配器
 */
export const HorizontalFeaturedAdapters: React.FC<HorizontalFeaturedAdaptersProps> = ({
  adapters,
  loading = false,
  title,
  subtitle,
  maxItems = 10,
  onViewMore,
  onDownload,
  onFavorite,
  onLike,
  variant = 'featured',
  cardWidth = 320,
  className,
}) => {
  const config = {
    featured: {
      title: '精选推荐',
      subtitle: '编辑精选的优质适配器',
      icon: Sparkles,
      iconColor: 'text-yellow-500',
    },
    trending: {
      title: '热门适配器',
      subtitle: '最受欢迎的适配器',
      icon: TrendingUp,
      iconColor: 'text-red-500',
    },
    latest: {
      title: '最新发布',
      subtitle: '刚刚上架的新适配器',
      icon: Clock,
      iconColor: 'text-blue-500',
    },
  };

  const { title: defaultTitle, subtitle: defaultSubtitle, icon: Icon, iconColor } = config[variant];
  const displayTitle = title || defaultTitle;
  const displaySubtitle = subtitle || defaultSubtitle;

  const displayAdapters = adapters.slice(0, maxItems);

  if (loading) {
    return (
      <div className={cn('rounded-lg border bg-card p-6', className)}>
        <div className="flex min-h-[200px] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (adapters.length === 0) {
    return null;
  }

  return (
    <section className={cn('rounded-lg border bg-card p-6', className)}>
      {/* 头部 */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={cn('rounded-lg bg-muted p-2', iconColor)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{displayTitle}</h2>
            {displaySubtitle && (
              <p className="mt-1 text-sm text-muted-foreground">
                {displaySubtitle}
              </p>
            )}
          </div>
        </div>
        
        {onViewMore && (
          <Button variant="ghost" onClick={onViewMore} className="gap-2">
            查看更多
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 横向滚动适配器列表 */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {displayAdapters.map((adapter) => (
            <div
              key={adapter.id}
              style={{ minWidth: cardWidth, maxWidth: cardWidth }}
            >
              <AdapterCard
                adapter={adapter}
                featured={variant === 'featured'}
                isNew={variant === 'latest'}
                onDownload={onDownload}
                onFavorite={onFavorite}
                onLike={onLike}
              />
            </div>
          ))}
        </div>
      </ScrollArea>
    </section>
  );
};

