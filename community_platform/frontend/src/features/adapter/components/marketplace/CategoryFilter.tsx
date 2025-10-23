/**
 * 适配器分类筛选组件
 * @module features/adapter/components/marketplace
 */

import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { AdapterCategory } from '../../domain';
import { cn } from '@/shared/utils';
import { Layers, ChevronRight } from 'lucide-react';

/**
 * 分类筛选属性
 */
export interface CategoryFilterProps {
  /** 分类列表 */
  categories: AdapterCategory[];
  /** 当前选中的分类ID */
  selectedCategoryId?: string;
  /** 选中分类变化回调 */
  onCategoryChange?: (categoryId: string | undefined) => void;
  /** 是否显示适配器数量 */
  showCount?: boolean;
  /** 是否显示全部选项 */
  showAll?: boolean;
  /** 自定义样式 */
  className?: string;
}

/**
 * 分类筛选组件
 */
export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategoryId,
  onCategoryChange,
  showCount = true,
  showAll = true,
  className,
}) => {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      {/* 标题 */}
      <div className="mb-4 flex items-center gap-2">
        <Layers className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">分类</h3>
      </div>

      {/* 分类列表 */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-1">
          {/* 全部选项 */}
          {showAll && (
            <Button
              variant={!selectedCategoryId ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => onCategoryChange?.(undefined)}
            >
              <span className="flex-1 text-left">全部</span>
            </Button>
          )}

          {/* 分类选项 */}
          {categories.map((category) => (
            <CategoryItem
              key={category.id}
              category={category}
              selected={selectedCategoryId === category.id}
              showCount={showCount}
              onClick={() => onCategoryChange?.(category.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

/**
 * 分类项属性
 */
interface CategoryItemProps {
  category: AdapterCategory;
  selected: boolean;
  showCount: boolean;
  onClick: () => void;
}

/**
 * 分类项组件
 */
const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  selected,
  showCount,
  onClick,
}) => {
  return (
    <Button
      variant={selected ? 'default' : 'ghost'}
      className="w-full justify-start gap-2"
      onClick={onClick}
    >
      {/* 图标 */}
      {category.icon && (
        <span className="text-lg">{category.icon}</span>
      )}
      
      {/* 名称 */}
      <span className="flex-1 text-left">{category.name}</span>
      
      {/* 数量徽章 */}
      {showCount && category.adapterCount !== undefined && (
        <Badge variant="secondary" className="ml-auto">
          {category.adapterCount}
        </Badge>
      )}

      {/* 箭头指示器 */}
      {selected && <ChevronRight className="h-4 w-4" />}
    </Button>
  );
};

/**
 * 分类面包屑导航属性
 */
export interface CategoryBreadcrumbProps {
  /** 当前分类 */
  category?: AdapterCategory;
  /** 点击分类回调 */
  onCategoryClick?: (categoryId: string | undefined) => void;
  /** 自定义样式 */
  className?: string;
}

/**
 * 分类面包屑导航
 */
export const CategoryBreadcrumb: React.FC<CategoryBreadcrumbProps> = ({
  category,
  onCategoryClick,
  className,
}) => {
  if (!category) return null;

  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onCategoryClick?.(undefined)}
      >
        全部分类
      </Button>
      <ChevronRight className="h-4 w-4" />
      <span className="font-medium text-foreground">{category.name}</span>
    </div>
  );
};

