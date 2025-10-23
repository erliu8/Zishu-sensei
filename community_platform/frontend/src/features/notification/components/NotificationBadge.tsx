import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/utils';

interface NotificationBadgeProps {
  count: number;
  max?: number;
  className?: string;
  showZero?: boolean;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
}

/**
 * 通知徽章组件
 * 显示未读通知数量
 */
export function NotificationBadge({
  count,
  max = 99,
  className,
  showZero = false,
  variant = 'destructive',
}: NotificationBadgeProps) {
  // 如果数量为 0 且不显示零，则不渲染
  if (count === 0 && !showZero) {
    return null;
  }

  // 格式化显示数字
  const displayCount = count > max ? `${max}+` : count;

  return (
    <Badge
      variant={variant}
      className={cn(
        'h-5 min-w-[20px] rounded-full px-1 text-xs font-semibold',
        'flex items-center justify-center',
        className
      )}
    >
      {displayCount}
    </Badge>
  );
}

interface NotificationDotProps {
  show?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 通知红点组件
 * 简单的红点提示，不显示具体数量
 */
export function NotificationDot({
  show = true,
  className,
  size = 'md',
}: NotificationDotProps) {
  if (!show) {
    return null;
  }

  const sizeClasses = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  };

  return (
    <span
      className={cn(
        'absolute rounded-full bg-destructive',
        sizeClasses[size],
        className
      )}
      aria-label="有新通知"
    />
  );
}

