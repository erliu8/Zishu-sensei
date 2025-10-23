/**
 * FavoriteButton Component
 * 收藏按钮组件
 */

'use client';

import React, { useState } from 'react';
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/utils/cn';
import {
  useToggleFavorite,
  useFavoriteStats,
  useCollections,
  useAddFavorite,
} from '../hooks/useFavorite';
import { FavoriteTargetType, FavoriteDomain } from '../domain/Favorite';

/**
 * FavoriteButton Props
 */
export interface FavoriteButtonProps {
  /** 目标类型 */
  targetType: FavoriteTargetType;
  /** 目标ID */
  targetId: string;
  /** 初始收藏状态 */
  initialIsFavorited?: boolean;
  /** 初始收藏数 */
  initialFavoriteCount?: number;
  /** 按钮变体 */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** 按钮大小 */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** 自定义类名 */
  className?: string;
  /** 是否显示收藏数 */
  showCount?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 收藏成功回调 */
  onFavoriteSuccess?: (isFavorited: boolean, favoriteCount: number) => void;
  /** 是否只显示图标 */
  iconOnly?: boolean;
  /** 是否启用收藏夹选择 */
  enableCollectionSelect?: boolean;
  /** 当前用户ID（用于获取收藏夹列表） */
  currentUserId?: string;
}

/**
 * FavoriteButton 组件
 */
export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  targetType,
  targetId,
  initialIsFavorited = false,
  initialFavoriteCount = 0,
  variant = 'ghost',
  size = 'sm',
  className,
  showCount = false,
  disabled = false,
  onFavoriteSuccess,
  iconOnly = false,
  enableCollectionSelect = false,
  currentUserId,
}) => {
  const toggleFavoriteMutation = useToggleFavorite();
  const addFavoriteMutation = useAddFavorite();
  const { data: statsData } = useFavoriteStats(targetType, targetId);
  const { data: collectionsData } = useCollections(
    enableCollectionSelect && !!currentUserId ? currentUserId : undefined
  );

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isFavorited = statsData?.isFavorited ?? initialIsFavorited;
  const favoriteCount = statsData?.favoriteCount ?? initialFavoriteCount;
  const isLoading = toggleFavoriteMutation.isPending || addFavoriteMutation.isPending;

  const formattedCount = FavoriteDomain.formatFavoriteCount(favoriteCount);
  const collections = collectionsData || [];

  const handleQuickToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || isLoading) {
      return;
    }

    try {
      const result = await toggleFavoriteMutation.mutateAsync({
        targetType,
        targetId,
      });
      onFavoriteSuccess?.(result.data.isFavorited, result.data.favoriteCount);
    } catch (error) {
      console.error('Toggle favorite failed:', error);
    }
  };

  const handleAddToCollection = async (collectionId?: string) => {
    try {
      await addFavoriteMutation.mutateAsync({
        targetType,
        targetId,
        collectionId,
      });
      setIsMenuOpen(false);
      onFavoriteSuccess?.(true, favoriteCount + 1);
    } catch (error) {
      console.error('Add to collection failed:', error);
    }
  };

  const Icon = isFavorited ? BookmarkCheck : Bookmark;

  // 简单按钮模式
  if (!enableCollectionSelect) {
    return (
      <Button
        variant={variant}
        size={iconOnly ? 'icon-sm' : size}
        className={cn(
          'transition-all',
          isFavorited && 'text-yellow-500 hover:text-yellow-600',
          className
        )}
        onClick={handleQuickToggle}
        disabled={disabled || isLoading}
        aria-label={isFavorited ? '取消收藏' : '收藏'}
      >
        <div className="flex items-center gap-1">
          {isLoading ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Icon
              className={cn('transition-all', isFavorited && 'fill-current')}
              size={16}
            />
          )}
          {!iconOnly && showCount && favoriteCount > 0 && (
            <span className={cn('text-xs font-medium', isFavorited && 'text-yellow-500')}>
              {formattedCount}
            </span>
          )}
        </div>
      </Button>
    );
  }

  // 带收藏夹选择的下拉菜单模式
  return (
    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={iconOnly ? 'icon-sm' : size}
          className={cn(
            'transition-all',
            isFavorited && 'text-yellow-500 hover:text-yellow-600',
            className
          )}
          disabled={disabled || isLoading}
          aria-label="收藏选项"
        >
          <div className="flex items-center gap-1">
            {isLoading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Icon
                className={cn('transition-all', isFavorited && 'fill-current')}
                size={16}
              />
            )}
            {!iconOnly && showCount && favoriteCount > 0 && (
              <span className={cn('text-xs font-medium', isFavorited && 'text-yellow-500')}>
                {formattedCount}
              </span>
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>选择收藏夹</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleAddToCollection()}>
          <Bookmark className="mr-2 h-4 w-4" />
          默认收藏夹
        </DropdownMenuItem>
        {collections.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {collections.map((collection: any) => (
              <DropdownMenuItem
                key={collection.id}
                onClick={() => handleAddToCollection(collection.id)}
              >
                <Bookmark className="mr-2 h-4 w-4" />
                {collection.name}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {isFavorited && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleQuickToggle}
              className="text-destructive focus:text-destructive"
            >
              <BookmarkCheck className="mr-2 h-4 w-4" />
              取消收藏
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default FavoriteButton;

