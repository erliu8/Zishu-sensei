/**
 * FollowButton Component
 * 关注按钮组件
 */

'use client';

import React from 'react';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { useFollow, useUnfollow, useCheckFollowing } from '../hooks/useFollow';

/**
 * FollowButton Props
 */
export interface FollowButtonProps {
  /** 被关注者ID */
  userId: string;
  /** 当前用户ID（可选，用于检查是否可以关注自己） */
  currentUserId?: string;
  /** 按钮变体 */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** 按钮大小 */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** 自定义类名 */
  className?: string;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 关注成功回调 */
  onFollowSuccess?: () => void;
  /** 取消关注成功回调 */
  onUnfollowSuccess?: () => void;
  /** 自定义关注文案 */
  followText?: string;
  /** 自定义已关注文案 */
  followingText?: string;
  /** 是否只显示图标 */
  iconOnly?: boolean;
}

/**
 * FollowButton 组件
 */
export const FollowButton: React.FC<FollowButtonProps> = ({
  userId,
  currentUserId,
  variant = 'default',
  size = 'default',
  className,
  showIcon = true,
  disabled = false,
  onFollowSuccess,
  onUnfollowSuccess,
  followText = '关注',
  followingText = '已关注',
  iconOnly = false,
}) => {
  const followMutation = useFollow();
  const unfollowMutation = useUnfollow();
  const { data: checkData, isLoading: isChecking } = useCheckFollowing(userId);

  const isFollowing = checkData?.isFollowing || false;
  const isLoading = followMutation.isPending || unfollowMutation.isPending || isChecking;

  // 不能关注自己
  const canFollow = currentUserId !== userId;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canFollow || disabled || isLoading) {
      return;
    }

    try {
      if (isFollowing) {
        await unfollowMutation.mutateAsync(userId);
        onUnfollowSuccess?.();
      } else {
        await followMutation.mutateAsync({ followeeId: userId });
        onFollowSuccess?.();
      }
    } catch (error) {
      // Error is handled by mutation hooks
      console.error('Follow action failed:', error);
    }
  };

  // 不能关注自己时不显示按钮
  if (!canFollow) {
    return null;
  }

  const Icon = isFollowing ? UserMinus : UserPlus;
  const text = isFollowing ? followingText : followText;

  return (
    <Button
      variant={isFollowing ? 'outline' : variant}
      size={iconOnly ? 'icon' : size}
      className={cn(
        'transition-all',
        isFollowing && 'hover:border-destructive hover:text-destructive',
        className
      )}
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={text}
    >
      {isLoading ? (
        <Loader2 className={cn('animate-spin', !iconOnly && 'mr-2')} size={16} />
      ) : (
        showIcon && <Icon className={cn(!iconOnly && 'mr-2')} size={16} />
      )}
      {!iconOnly && <span>{text}</span>}
    </Button>
  );
};

/**
 * CompactFollowButton - 紧凑版关注按钮
 */
export interface CompactFollowButtonProps extends Omit<FollowButtonProps, 'iconOnly' | 'showIcon'> {}

export const CompactFollowButton: React.FC<CompactFollowButtonProps> = (props) => {
  return <FollowButton {...props} iconOnly size="sm" />;
};

export default FollowButton;

