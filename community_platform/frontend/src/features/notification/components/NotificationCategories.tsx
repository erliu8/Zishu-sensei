'use client';

import React from 'react';
import {
  Bell,
  MessageSquare,
  Heart,
  UserPlus,
  Trophy,
  AlertCircle,
  Mail,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils';
import { NotificationType } from '../domain/notification';

interface NotificationCategoriesProps {
  selectedCategory?: NotificationType | 'all';
  onCategoryChange?: (category: NotificationType | 'all') => void;
  counts?: Partial<Record<NotificationType | 'all', number>>;
  className?: string;
}

interface Category {
  key: NotificationType | 'all';
  label: string;
  icon: React.ReactNode;
  color: string;
}

const categories: Category[] = [
  {
    key: 'all',
    label: '全部',
    icon: <Bell className="h-4 w-4" />,
    color: 'text-foreground',
  },
  {
    key: NotificationType.COMMENT,
    label: '评论',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-blue-500',
  },
  {
    key: NotificationType.LIKE,
    label: '点赞',
    icon: <Heart className="h-4 w-4" />,
    color: 'text-pink-500',
  },
  {
    key: NotificationType.FOLLOW,
    label: '关注',
    icon: <UserPlus className="h-4 w-4" />,
    color: 'text-green-500',
  },
  {
    key: NotificationType.MENTION,
    label: '提及',
    icon: <Mail className="h-4 w-4" />,
    color: 'text-purple-500',
  },
  {
    key: NotificationType.ACHIEVEMENT,
    label: '成就',
    icon: <Trophy className="h-4 w-4" />,
    color: 'text-yellow-500',
  },
  {
    key: NotificationType.SYSTEM,
    label: '系统',
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'text-gray-500',
  },
];

/**
 * 通知分类组件
 * 用于筛选不同类型的通知
 */
export function NotificationCategories({
  selectedCategory = 'all',
  onCategoryChange,
  counts = {},
  className,
}: NotificationCategoriesProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {categories.map((category) => {
        const count = counts[category.key] || 0;
        const isSelected = selectedCategory === category.key;

        return (
          <Button
            key={category.key}
            variant={isSelected ? 'default' : 'outline'}
            size="sm"
            onClick={() => onCategoryChange?.(category.key)}
            className={cn(
              'gap-2',
              !isSelected && category.color
            )}
          >
            {category.icon}
            <span>{category.label}</span>
            {count > 0 && (
              <span
                className={cn(
                  'ml-1 rounded-full px-1.5 py-0.5 text-xs',
                  isSelected
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {count}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * 获取分类图标
 */
export function getCategoryIcon(type: NotificationType | 'all') {
  const category = categories.find((c) => c.key === type);
  return category?.icon || <Bell className="h-4 w-4" />;
}

/**
 * 获取分类颜色
 */
export function getCategoryColor(type: NotificationType | 'all') {
  const category = categories.find((c) => c.key === type);
  return category?.color || 'text-foreground';
}

/**
 * 获取分类标签
 */
export function getCategoryLabel(type: NotificationType | 'all') {
  const category = categories.find((c) => c.key === type);
  return category?.label || '通知';
}

