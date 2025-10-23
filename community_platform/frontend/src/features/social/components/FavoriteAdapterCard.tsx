/**
 * FavoriteAdapterCard Component
 * 收藏的适配器卡片组件
 */

'use client';

import React from 'react';
import { Download, Star, Trash2, Calendar, Package } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Favorite } from '../domain/Favorite';

/**
 * FavoriteAdapterCard Props
 */
export interface FavoriteAdapterCardProps {
  /** 收藏项 */
  favorite: Favorite;
  /** 点击卡片回调 */
  onClick?: () => void;
  /** 删除回调 */
  onRemove?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * FavoriteAdapterCard Component
 */
export const FavoriteAdapterCard: React.FC<FavoriteAdapterCardProps> = ({
  favorite,
  onClick,
  onRemove,
  className,
}) => {
  const adapter = favorite.targetAdapter;

  if (!adapter) {
    return null;
  }

  const author = adapter.author;
  const initials = author?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || author?.username?.slice(0, 2).toUpperCase() || 'U';

  return (
    <Card className={cn('group hover:shadow-md transition-all', className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-semibold line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                  onClick={onClick}
                >
                  {adapter.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  v{adapter.latestVersion || '1.0.0'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.();
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          {/* Description */}
          {adapter.description && (
            <p
              className="text-sm text-muted-foreground line-clamp-2 cursor-pointer"
              onClick={onClick}
            >
              {adapter.description}
            </p>
          )}

          {/* Category & Tags */}
          <div className="flex flex-wrap gap-1">
            {adapter.category && (
              <Badge variant="default" className="text-xs">
                {adapter.category}
              </Badge>
            )}
            {adapter.tags && adapter.tags.length > 0 && (
              <>
                {adapter.tags.slice(0, 2).map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {adapter.tags.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{adapter.tags.length - 2}
                  </Badge>
                )}
              </>
            )}
          </div>

          {/* Author Info */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={author?.avatar} alt={author?.displayName} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {author?.displayName || '未知作者'}
            </span>
          </div>

          {/* Stats & Date */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {adapter.downloadCount || 0}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {adapter.rating?.toFixed(1) || '0.0'}
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(favorite.createdAt), 'MM/dd', { locale: zhCN })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FavoriteAdapterCard;

