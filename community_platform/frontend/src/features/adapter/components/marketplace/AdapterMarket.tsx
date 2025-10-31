/**
 * 适配器市场主组件
 * 整合所有市场相关功能的主界面
 * @module features/adapter/components/marketplace
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AdapterType } from '../../domain';
import type { Adapter, AdapterCategory, AdapterQueryParams, SortField, SortOrder } from '../../domain';
import { CategoryFilter, CategoryBreadcrumb } from './CategoryFilter';
import { MarketSearchBar } from './MarketSearchBar';
import { SortOptions } from './SortOptions';
import { FeaturedAdapters } from './FeaturedAdapters';
import { AdapterList } from './AdapterList';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { 
  LayoutGrid, 
  List, 
  SlidersHorizontal,
  X
} from 'lucide-react';
import { cn } from '@/shared/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';

/**
 * 适配器市场属性
 */
export interface AdapterMarketProps {
  /** 初始分类ID */
  initialCategoryId?: string;
  /** 初始搜索关键词 */
  initialSearch?: string;
  /** 初始适配器类型 */
  initialType?: AdapterType;
  /** 获取适配器列表回调 */
  onFetchAdapters?: (params: AdapterQueryParams) => Promise<{
    adapters: Adapter[];
    total: number;
  }>;
  /** 获取分类列表回调 */
  onFetchCategories?: () => Promise<AdapterCategory[]>;
  /** 获取推荐适配器回调 */
  onFetchFeatured?: () => Promise<Adapter[]>;
  /** 获取热门适配器回调 */
  onFetchTrending?: () => Promise<Adapter[]>;
  /** 获取最新适配器回调 */
  onFetchLatest?: () => Promise<Adapter[]>;
  /** 下载适配器回调 */
  onDownload?: (adapter: Adapter) => void;
  /** 收藏适配器回调 */
  onFavorite?: (adapter: Adapter) => void;
  /** 点赞适配器回调 */
  onLike?: (adapter: Adapter) => void;
  /** 自定义样式 */
  className?: string;
}

/**
 * 适配器市场主组件
 */
export const AdapterMarket: React.FC<AdapterMarketProps> = ({
  initialCategoryId,
  initialSearch = '',
  initialType,
  onFetchAdapters,
  onFetchCategories,
  onFetchFeatured,
  onFetchTrending,
  onFetchLatest,
  onDownload,
  onFavorite,
  onLike,
  className,
}) => {
  // ========== 状态管理 ==========
  const [adapters, setAdapters] = useState<Adapter[]>([]);
  const [categories, setCategories] = useState<AdapterCategory[]>([]);
  const [featuredAdapters, setFeaturedAdapters] = useState<Adapter[]>([]);
  const [trendingAdapters, setTrendingAdapters] = useState<Adapter[]>([]);
  const [latestAdapters, setLatestAdapters] = useState<Adapter[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  
  // 筛选条件
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(initialCategoryId);
  const [selectedType, setSelectedType] = useState<AdapterType | undefined>(initialType);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;
  
  // UI 状态
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // ========== 数据获取 ==========
  
  // 获取分类列表
  const fetchCategories = useCallback(async () => {
    if (!onFetchCategories) return;
    
    try {
      const result = await onFetchCategories();
      setCategories(result);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, [onFetchCategories]);

  // 获取推荐适配器
  const fetchFeaturedAdapters = useCallback(async () => {
    if (!onFetchFeatured) return;
    
    try {
      const result = await onFetchFeatured();
      setFeaturedAdapters(result);
    } catch (error) {
      console.error('Failed to fetch featured adapters:', error);
    }
  }, [onFetchFeatured]);

  // 获取热门适配器
  const fetchTrendingAdapters = useCallback(async () => {
    if (!onFetchTrending) return;
    
    try {
      const result = await onFetchTrending();
      setTrendingAdapters(result);
    } catch (error) {
      console.error('Failed to fetch trending adapters:', error);
    }
  }, [onFetchTrending]);

  // 获取最新适配器
  const fetchLatestAdapters = useCallback(async () => {
    if (!onFetchLatest) return;
    
    try {
      const result = await onFetchLatest();
      setLatestAdapters(result);
    } catch (error) {
      console.error('Failed to fetch latest adapters:', error);
    }
  }, [onFetchLatest]);

  // 获取适配器列表
  const fetchAdapters = useCallback(async () => {
    if (!onFetchAdapters) return;
    
    setLoading(true);
    try {
      const params: AdapterQueryParams = {
        page,
        pageSize,
        categoryId: selectedCategoryId,
        type: selectedType,
        search: searchQuery || undefined,
        sortBy,
        sortOrder,
      };
      
      const result = await onFetchAdapters(params);
      setAdapters(result.adapters);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to fetch adapters:', error);
      setAdapters([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    onFetchAdapters,
    page,
    pageSize,
    selectedCategoryId,
    selectedType,
    searchQuery,
    sortBy,
    sortOrder,
  ]);

  // ========== 生命周期 ==========
  
  // 初始化加载
  useEffect(() => {
    fetchCategories();
    fetchFeaturedAdapters();
    fetchTrendingAdapters();
    fetchLatestAdapters();
  }, [fetchCategories, fetchFeaturedAdapters, fetchTrendingAdapters, fetchLatestAdapters]);

  // 筛选条件变化时重新加载
  useEffect(() => {
    fetchAdapters();
  }, [fetchAdapters]);

  // ========== 事件处理 ==========
  
  // 处理分类变化
  const handleCategoryChange = (categoryId: string | undefined) => {
    setSelectedCategoryId(categoryId);
    setPage(1); // 重置页码
  };

  // 处理类型变化
  const handleTypeChange = (type: string) => {
    setSelectedType(type === 'all' ? undefined : type as AdapterType);
    setPage(1);
  };

  // 处理搜索
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // 处理排序变化
  const handleSortChange = (field: SortField, order: SortOrder) => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
  };

  // 清除所有筛选条件
  const handleClearFilters = () => {
    setSelectedCategoryId(undefined);
    setSelectedType(undefined);
    setSearchQuery('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  // 当前选中的分类
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  // 是否有激活的筛选条件
  const hasActiveFilters = !!(selectedCategoryId || selectedType || searchQuery);

  return (
    <div className={cn('space-y-6', className)}>
      {/* 推荐区域（仅在无筛选条件时显示） */}
      {!hasActiveFilters && (
        <div className="space-y-6">
          {/* 精选推荐 */}
          {featuredAdapters.length > 0 && (
            <FeaturedAdapters
              adapters={featuredAdapters}
              variant="featured"
              onDownload={onDownload}
              onFavorite={onFavorite}
              onLike={onLike}
            />
          )}

          {/* 热门适配器 */}
          {trendingAdapters.length > 0 && (
            <FeaturedAdapters
              adapters={trendingAdapters}
              variant="trending"
              onDownload={onDownload}
              onFavorite={onFavorite}
              onLike={onLike}
            />
          )}

          {/* 最新发布 */}
          {latestAdapters.length > 0 && (
            <FeaturedAdapters
              adapters={latestAdapters}
              variant="latest"
              onDownload={onDownload}
              onFavorite={onFavorite}
              onLike={onLike}
            />
          )}
        </div>
      )}

      {/* 主内容区域 */}
      <div className="flex gap-6">
        {/* 左侧筛选栏（桌面端） */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-4 space-y-4">
            <CategoryFilter
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onCategoryChange={handleCategoryChange}
            />
          </div>
        </aside>

        {/* 右侧主内容 */}
        <main className="min-w-0 flex-1">
          {/* 搜索和筛选工具栏 */}
          <div className="mb-6 space-y-4 rounded-lg border bg-card p-4">
            {/* 搜索栏 */}
            <MarketSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearch}
            />

            {/* 类型标签页 */}
            <Tabs value={selectedType || 'all'} onValueChange={handleTypeChange}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="all">全部</TabsTrigger>
                <TabsTrigger value={AdapterType.SOFT}>软适配器</TabsTrigger>
                <TabsTrigger value={AdapterType.HARD}>硬适配器</TabsTrigger>
                <TabsTrigger value={AdapterType.INTELLIGENT}>智能硬适配器</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* 工具栏 */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* 左侧：分类面包屑和筛选按钮 */}
              <div className="flex items-center gap-4">
                {/* 移动端筛选按钮 */}
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="lg:hidden">
                      <SlidersHorizontal className="mr-2 h-4 w-4" />
                      筛选
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80">
                    <SheetHeader>
                      <SheetTitle>筛选条件</SheetTitle>
                      <SheetDescription>
                        选择分类和其他筛选条件
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                      <CategoryFilter
                        categories={categories}
                        selectedCategoryId={selectedCategoryId}
                        onCategoryChange={(id) => {
                          handleCategoryChange(id);
                          setShowFilters(false);
                        }}
                      />
                    </div>
                  </SheetContent>
                </Sheet>

                {/* 分类面包屑 */}
                {selectedCategory && (
                  <CategoryBreadcrumb
                    category={selectedCategory}
                    onCategoryClick={handleCategoryChange}
                  />
                )}
              </div>

              {/* 右侧：视图切换和排序 */}
              <div className="flex items-center gap-2">
                {/* 清除筛选 */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    清除筛选
                  </Button>
                )}

                {/* 排序选项 */}
                <SortOptions
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSortChange={handleSortChange}
                  variant="select"
                />

                {/* 视图切换 */}
                <div className="flex items-center gap-1 rounded-lg border p-1">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 结果统计 */}
            <div className="text-sm text-muted-foreground">
              共找到 <span className="font-medium text-foreground">{total}</span> 个适配器
            </div>
          </div>

          {/* 适配器列表 */}
          <AdapterList
            adapters={adapters}
            loading={loading}
            empty={total === 0}
            viewMode={viewMode}
            onDownload={onDownload}
            onFavorite={onFavorite}
            onLike={onLike}
          />

          {/* 分页 */}
          {total > pageSize && (
            <div className="mt-6 flex justify-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <span className="text-sm text-muted-foreground">
                  第 {page} 页，共 {Math.ceil(total / pageSize)} 页
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

