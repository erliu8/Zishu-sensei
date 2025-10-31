/**
 * LikeButton Component
 * 点赞按钮组件
 */

'use client';

import React, { useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { useToggleLike, useLikeStats } from '../hooks/useLike';
import { LikeTargetType, LikeDomain } from '../domain/Like';

/**
 * LikeButton Props
 */
export interface LikeButtonProps {
  /** 目标类型 */
  targetType: LikeTargetType;
  /** 目标ID */
  targetId: string;
  /** 初始点赞状态 */
  initialIsLiked?: boolean;
  /** 初始点赞数 */
  initialLikeCount?: number;
  /** 按钮变体 */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** 按钮大小 */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** 自定义类名 */
  className?: string;
  /** 是否显示点赞数 */
  showCount?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点赞成功回调 */
  onLikeSuccess?: (isLiked: boolean, likeCount: number) => void;
  /** 是否只显示图标 */
  iconOnly?: boolean;
  /** 是否使用动画 */
  animated?: boolean;
}

/**
 * LikeButton 组件
 */
export const LikeButton: React.FC<LikeButtonProps> = ({
  targetType,
  targetId,
  initialIsLiked = false,
  initialLikeCount = 0,
  variant = 'ghost',
  size = 'sm',
  className,
  showCount = true,
  disabled = false,
  onLikeSuccess,
  iconOnly = false,
  animated = true,
}) => {
  const toggleLikeMutation = useToggleLike();
  const { data: statsData } = useLikeStats(targetType, targetId);

  const [isAnimating, setIsAnimating] = useState(false);

  const isLiked = statsData?.isLiked ?? initialIsLiked;
  const likeCount = statsData?.likeCount ?? initialLikeCount;
  const isLoading = toggleLikeMutation.isPending;

  const formattedCount = LikeDomain.formatLikeCount(likeCount);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled || isLoading) {
      return;
    }

    if (animated) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }

    try {
      const result = await toggleLikeMutation.mutateAsync({
        targetType,
        targetId,
      });
      onLikeSuccess?.(result.data.isLiked, result.data.likeCount);
    } catch (error) {
      console.error('Toggle like failed:', error);
    }
  };

  return (
    <Button
      variant={variant}
      size={iconOnly ? 'icon-sm' : size}
      className={cn(
        'group relative transition-all',
        isLiked && 'text-red-500 hover:text-red-600',
        className
      )}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={isLiked ? '取消点赞' : '点赞'}
    >
      <div className="flex items-center gap-1">
        {isLoading ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Heart
            className={cn(
              'transition-all',
              isLiked && 'fill-current',
              isAnimating && 'animate-bounce scale-125'
            )}
            size={16}
          />
        )}
        {!iconOnly && showCount && likeCount > 0 && (
          <span className={cn('text-xs font-medium', isLiked && 'text-red-500')}>
            {formattedCount}
          </span>
        )}
      </div>

      {/* 点赞动画效果 */}
      {animated && isAnimating && !isLiked && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart
            className="absolute animate-ping text-red-500 opacity-75"
            size={20}
            fill="currentColor"
          />
        </span>
      )}
    </Button>
  );
};

/**
 * LikeButtonWithCount - 带数量的点赞按钮
 */
export interface LikeButtonWithCountProps extends LikeButtonProps {
  /** 显示样式 */
  layout?: 'horizontal' | 'vertical';
}

export const LikeButtonWithCount: React.FC<LikeButtonWithCountProps> = ({
  layout = 'horizontal',
  ...props
}) => {
  const { targetType, targetId, initialLikeCount = 0 } = props;
  const { data: statsData } = useLikeStats(targetType, targetId);

  const likeCount = statsData?.likeCount ?? initialLikeCount;
  const formattedCount = LikeDomain.formatLikeCount(likeCount);

  if (layout === 'vertical') {
    return (
      <div className="flex flex-col items-center gap-1">
        <LikeButton {...props} showCount={false} />
        {likeCount > 0 && (
          <span className="text-xs text-muted-foreground">{formattedCount}</span>
        )}
      </div>
    );
  }

  return <LikeButton {...props} showCount />;
};

export default LikeButton;

