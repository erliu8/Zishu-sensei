/**
 * 搜索模块 - SearchFilters 组件
 * 高级搜索筛选器
 */

'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { Slider } from '@/shared/components/ui/slider';
import { cn } from '@/shared/utils/cn';
import { SearchType, type SearchFilters } from '../domain';

export interface SearchFiltersProps {
  /** 当前筛选器 */
  filters: SearchFilters;
  /** 筛选器变更回调 */
  onFiltersChange: (filters: SearchFilters) => void;
  /** 是否显示类型筛选 */
  showTypeFilter?: boolean;
  /** 类名 */
  className?: string;
}

/**
 * SearchFilters 组件
 */
export function SearchFilters({
  filters,
  onFiltersChange,
  showTypeFilter = true,
  className,
}: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);

  /**
   * 更新筛选器
   */
  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * 应用筛选器
   */
  const applyFilters = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  /**
   * 重置筛选器
   */
  const resetFilters = () => {
    const emptyFilters: SearchFilters = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  /**
   * 计算激活的筛选器数量
   */
  const activeFilterCount = Object.keys(filters).filter((key) => {
    const value = filters[key as keyof SearchFilters];
    if (value === undefined || value === null) return false;
    if (typeof value === 'object' && !Array.isArray(value)) {
      return Object.values(value).some((v) => v !== undefined && v !== null);
    }
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }).length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className={cn('gap-2', className)}>
          <Filter className="h-4 w-4" />
          筛选
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 rounded-full px-1.5 py-0.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>筛选条件</SheetTitle>
          <SheetDescription>选择筛选条件以精确搜索结果</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* 搜索类型 */}
          {showTypeFilter && (
            <div className="space-y-2">
              <Label>搜索类型</Label>
              <Select
                value={localFilters.type}
                onValueChange={(value) => updateFilter('type', value as SearchType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SearchType.ALL}>全部</SelectItem>
                  <SelectItem value={SearchType.POST}>帖子</SelectItem>
                  <SelectItem value={SearchType.ADAPTER}>适配器</SelectItem>
                  <SelectItem value={SearchType.CHARACTER}>角色</SelectItem>
                  <SelectItem value={SearchType.USER}>用户</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 标签 */}
          <div className="space-y-2">
            <Label>标签</Label>
            <Input
              placeholder="输入标签，用逗号分隔"
              value={localFilters.tags?.join(', ') || ''}
              onChange={(e) => {
                const tags = e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean);
                updateFilter('tags', tags.length > 0 ? tags : undefined);
              }}
            />
          </div>

          {/* 创建时间范围 */}
          <div className="space-y-2">
            <Label>创建时间</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">
                  开始日期
                </Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={
                    localFilters.dateRange?.from
                      ? localFilters.dateRange.from.toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined;
                    updateFilter('dateRange', {
                      ...localFilters.dateRange,
                      from: date,
                    });
                  }}
                />
              </div>

              <div>
                <Label htmlFor="dateTo" className="text-xs text-muted-foreground">
                  结束日期
                </Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={
                    localFilters.dateRange?.to
                      ? localFilters.dateRange.to.toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined;
                    updateFilter('dateRange', {
                      ...localFilters.dateRange,
                      to: date,
                    });
                  }}
                />
              </div>
            </div>
          </div>

          {/* 评分范围（仅适配器/角色） */}
          {(localFilters.type === SearchType.ADAPTER ||
            localFilters.type === SearchType.CHARACTER) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>评分范围</Label>
                <span className="text-sm text-muted-foreground">
                  {localFilters.ratingRange?.min || 0} -{' '}
                  {localFilters.ratingRange?.max || 5}
                </span>
              </div>
              <Slider
                min={0}
                max={5}
                step={0.5}
                value={[
                  localFilters.ratingRange?.min || 0,
                  localFilters.ratingRange?.max || 5,
                ]}
                onValueChange={(value) => {
                  updateFilter('ratingRange', {
                    min: value[0],
                    max: value[1],
                  });
                }}
                className="w-full"
              />
            </div>
          )}

          {/* 仅显示已验证内容 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="verifiedOnly"
              checked={localFilters.verifiedOnly || false}
              onCheckedChange={(checked) =>
                updateFilter('verifiedOnly', checked as boolean)
              }
            />
            <Label
              htmlFor="verifiedOnly"
              className="cursor-pointer text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              仅显示已验证内容
            </Label>
          </div>

          {/* 仅显示特色内容 */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="featuredOnly"
              checked={localFilters.featuredOnly || false}
              onCheckedChange={(checked) =>
                updateFilter('featuredOnly', checked as boolean)
              }
            />
            <Label
              htmlFor="featuredOnly"
              className="cursor-pointer text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              仅显示特色推荐
            </Label>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="mt-6 flex gap-3">
          <Button onClick={applyFilters} className="flex-1">
            应用筛选
          </Button>
          <Button onClick={resetFilters} variant="outline">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

