/**
 * 适配器卡片组件
 * 在市场中展示单个适配器的信息
 * @module features/adapter/components/marketplace
 */

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Avatar } from '@/shared/components/common';
import { RatingStars } from '@/shared/components/common';
import { 
  Download, 
  Heart, 
  Star, 
  Eye
} from 'lucide-react';
import { cn } from '@/shared/utils';
import { Adapter } from '../../domain';
import { 
  AdapterTypeBadge, 
  CompatibilityBadge,
  FeaturedBadge,
  NewBadge 
} from './AdapterBadge';

/**
 * 适配器卡片属性
 */
export interface AdapterCardProps {
  /** 适配器数据 */
  adapter: Adapter;
  /** 是否显示为特色适配器 */
  featured?: boolean;
  /** 是否显示为新品 */
  isNew?: boolean;
  /** 点击下载回调 */
  onDownload?: (adapter: Adapter) => void;
  /** 点击收藏回调 */
  onFavorite?: (adapter: Adapter) => void;
  /** 点击点赞回调 */
  onLike?: (adapter: Adapter) => void;
  /** 自定义样式 */
  className?: string;
  /** 显示模式 */
  variant?: 'default' | 'compact' | 'detailed';
}

/**
 * 适配器卡片组件
 */
export const AdapterCard: React.FC<AdapterCardProps> = ({
  adapter,
  featured = false,
  isNew = false,
  onDownload,
  onFavorite,
  onLike,
  className,
  variant = 'default',
}) => {
  const isCompact = variant === 'compact';
  const isDetailed = variant === 'detailed';

  // 判断是否是新品（7天内发布的）
  const isNewAdapter = isNew || (
    adapter.publishedAt && 
    new Date(adapter.publishedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );

  return (
    <Card className={cn(
      'group relative overflow-hidden transition-all duration-300 hover:shadow-lg',
      'border-border hover:border-primary/50',
      className
    )}>
      {/* 特色/新品标签 */}
      {(featured || isNewAdapter) && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {featured && <FeaturedBadge />}
          {isNewAdapter && <NewBadge />}
        </div>
      )}

      <Link href={`/adapters/${adapter.id}`} className="block">
        {/* 封面图片 */}
        {!isCompact && adapter.coverImage && (
          <div className="relative aspect-video w-full overflow-hidden bg-muted">
            <Image
              src={adapter.coverImage}
              alt={adapter.displayName}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        )}

        {/* 内容区域 */}
        <div className={cn('p-4', isCompact ? 'p-3' : 'p-4')}>
          {/* 头部：图标 + 标题 */}
          <div className="mb-3 flex items-start gap-3">
            {/* 图标 */}
            {adapter.icon && (
              <div className={cn(
                'relative flex-shrink-0 overflow-hidden rounded-lg bg-muted',
                isCompact ? 'h-10 w-10' : 'h-12 w-12'
              )}>
                <Image
                  src={adapter.icon}
                  alt={adapter.displayName}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            {/* 标题和作者 */}
            <div className="min-w-0 flex-1">
              <h3 className={cn(
                'font-semibold text-foreground line-clamp-1 group-hover:text-primary',
                isCompact ? 'text-sm' : 'text-base'
              )}>
                {adapter.displayName}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Avatar
                  src={adapter.author.avatar}
                  alt={adapter.author.displayName}
                  size="xs"
                />
                <span className="line-clamp-1">{adapter.author.displayName}</span>
              </div>
            </div>
          </div>

          {/* 描述 */}
          <p className={cn(
            'mb-3 text-sm text-muted-foreground',
            isCompact ? 'line-clamp-2' : 'line-clamp-3'
          )}>
            {adapter.description}
          </p>

          {/* 标签 */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <AdapterTypeBadge type={adapter.type} showIcon={!isCompact} />
            {adapter.compatibility && (
              <CompatibilityBadge 
                level={adapter.compatibility.compatibilityLevel} 
                showIcon={!isCompact}
              />
            )}
            {isDetailed && adapter.capabilities.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {adapter.capabilities.length} 个能力
              </span>
            )}
          </div>

          {/* 标签云（仅详细模式） */}
          {isDetailed && adapter.tags.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1">
              {adapter.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
              {adapter.tags.length > 3 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  +{adapter.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* 统计信息 */}
          <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <RatingStars value={adapter.stats.rating} size="sm" />
              <span className="font-medium">{adapter.stats.rating.toFixed(1)}</span>
              <span>({adapter.stats.ratingCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              <span>{formatNumber(adapter.stats.downloads)}</span>
            </div>
            {!isCompact && (
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{formatNumber(adapter.stats.views)}</span>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <Button
              size={isCompact ? 'sm' : 'default'}
              className="flex-1"
              onClick={(e) => {
                e.preventDefault();
                onDownload?.(adapter);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              下载
            </Button>
            
            {!isCompact && (
              <>
                <Button
                  size={isCompact ? 'sm' : 'default'}
                  variant={adapter.isLiked ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.preventDefault();
                    onLike?.(adapter);
                  }}
                >
                  <Heart className={cn('h-4 w-4', adapter.isLiked && 'fill-current')} />
                </Button>
                <Button
                  size={isCompact ? 'sm' : 'default'}
                  variant={adapter.isFavorited ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.preventDefault();
                    onFavorite?.(adapter);
                  }}
                >
                  <Star className={cn('h-4 w-4', adapter.isFavorited && 'fill-current')} />
                </Button>
              </>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
};

/**
 * 格式化数字（K, M 格式）
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

