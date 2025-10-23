/**
 * 适配器排序选项组件
 * @module features/adapter/components/marketplace
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  TrendingUp,
  Download,
  Star,
  Clock,
  Calendar
} from 'lucide-react';
import { cn } from '@/shared/utils';

/**
 * 排序字段类型
 */
export type SortField = 'createdAt' | 'updatedAt' | 'downloads' | 'rating' | 'likes' | 'name';

/**
 * 排序方向类型
 */
export type SortOrder = 'asc' | 'desc';

/**
 * 排序选项
 */
export interface SortOption {
  label: string;
  field: SortField;
  order: SortOrder;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * 排序选项属性
 */
export interface SortOptionsProps {
  /** 当前排序字段 */
  sortBy?: SortField;
  /** 当前排序方向 */
  sortOrder?: SortOrder;
  /** 排序变化回调 */
  onSortChange?: (field: SortField, order: SortOrder) => void;
  /** 显示模式 */
  variant?: 'select' | 'buttons';
  /** 自定义样式 */
  className?: string;
}

/**
 * 预定义排序选项
 */
const SORT_OPTIONS: SortOption[] = [
  { label: '最新发布', field: 'createdAt', order: 'desc', icon: Calendar },
  { label: '最近更新', field: 'updatedAt', order: 'desc', icon: Clock },
  { label: '下载最多', field: 'downloads', order: 'desc', icon: Download },
  { label: '评分最高', field: 'rating', order: 'desc', icon: Star },
  { label: '点赞最多', field: 'likes', order: 'desc', icon: TrendingUp },
  { label: '名称 A-Z', field: 'name', order: 'asc', icon: ArrowUp },
  { label: '名称 Z-A', field: 'name', order: 'desc', icon: ArrowDown },
];

/**
 * 排序选项组件
 */
export const SortOptions: React.FC<SortOptionsProps> = ({
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onSortChange,
  variant = 'select',
  className,
}) => {
  // 获取当前选中的选项值
  const currentValue = `${sortBy}-${sortOrder}`;

  // 处理选择变化
  const handleChange = (value: string) => {
    const [field, order] = value.split('-') as [SortField, SortOrder];
    onSortChange?.(field, order);
  };

  // 切换排序方向
  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange?.(sortBy, newOrder);
  };

  // 下拉选择模式
  if (variant === 'select') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Select value={currentValue} onValueChange={handleChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="选择排序方式" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const value = `${option.field}-${option.order}`;
              return (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" />}
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* 排序方向切换按钮 */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSortOrder}
          title={sortOrder === 'asc' ? '升序' : '降序'}
        >
          {sortOrder === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // 按钮模式
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {SORT_OPTIONS.map((option) => {
        const Icon = option.icon;
        const value = `${option.field}-${option.order}`;
        const isActive = value === currentValue;

        return (
          <Button
            key={value}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleChange(value)}
            className="gap-2"
          >
            {Icon && <Icon className="h-4 w-4" />}
            <span>{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
};

/**
 * 简化的排序按钮组件
 */
export interface SimpleSortButtonProps {
  /** 排序字段 */
  field: SortField;
  /** 当前排序字段 */
  currentField?: SortField;
  /** 当前排序方向 */
  currentOrder?: SortOrder;
  /** 点击回调 */
  onClick?: (field: SortField, order: SortOrder) => void;
  /** 标签 */
  label: string;
  /** 图标 */
  icon?: React.ComponentType<{ className?: string }>;
  /** 自定义样式 */
  className?: string;
}

/**
 * 简化的排序按钮
 */
export const SimpleSortButton: React.FC<SimpleSortButtonProps> = ({
  field,
  currentField,
  currentOrder = 'desc',
  onClick,
  label,
  icon: Icon,
  className,
}) => {
  const isActive = currentField === field;

  const handleClick = () => {
    if (isActive) {
      // 如果已激活，切换排序方向
      const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
      onClick?.(field, newOrder);
    } else {
      // 如果未激活，使用默认降序
      onClick?.(field, 'desc');
    }
  };

  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="sm"
      onClick={handleClick}
      className={cn('gap-2', className)}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span>{label}</span>
      {isActive && (
        currentOrder === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      )}
    </Button>
  );
};

