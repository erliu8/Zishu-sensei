/**
 * 插件市场页面（原适配器市场）
 * @route /adapters
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  useAdapters, 
  useFeaturedAdapters,
  useTrendingAdapters,
  useLatestAdapters,
  useLikeAdapter,
  useUnlikeAdapter,
  useFavoriteAdapter,
  useUnfavoriteAdapter,
  useDownloadAdapter,
} from '@/features/adapter/hooks';
import { useAdapterCategories } from '@/features/adapter/hooks/useAdapterCategories';
import type { AdapterQueryParams, AdapterType } from '@/features/adapter/domain';
import { MARKET_DISPLAY_NAME, MARKET_DESCRIPTION } from '@/features/adapter/utils/display-names';
import {
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  Badge,
  Separator,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components';
import { LoadingSpinner, EmptyState, Pagination } from '@/shared/components/common';
import { 
  Search, 
  Grid3x3, 
  List, 
  Plus, 
  SlidersHorizontal,
  X,
  TrendingUp,
  Clock,
  Star,
} from 'lucide-react';
import { AdapterCard } from '@/features/adapter/components/marketplace';
import { CategoryFilter } from '@/features/adapter/components/marketplace/CategoryFilter';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import { useToast } from '@/shared/hooks/use-toast';

/**
 * 排序选项
 */
const SORT_OPTIONS = [
  { value: 'createdAt', label: '最新发布' },
  { value: 'updatedAt', label: '最近更新' },
  { value: 'downloads', label: '最多下载' },
  { value: 'rating', label: '评分最高' },
  { value: 'likes', label: '最多点赞' },
  { value: 'name', label: '名称排序' },
] as const;

/**
 * 插件市场页面组件（原适配器市场）
 */
export default function AdaptersMarketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // 从 URL 获取初始查询参数
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialCategoryId = searchParams.get('category') || undefined;
  const initialType = (searchParams.get('type') as AdapterType) || undefined;
  const initialSearch = searchParams.get('search') || '';
  const initialSortBy = (searchParams.get('sortBy') as any) || 'downloads';
  const initialSortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

  // 本地状态
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(12);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(initialCategoryId);
  const [selectedType, setSelectedType] = useState<AdapterType | undefined>(initialType);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // 构建查询参数
  const queryParams: AdapterQueryParams = {
    page,
    pageSize,
    categoryId: selectedCategoryId,
    type: selectedType,
    search: searchQuery || undefined,
    sortBy: sortBy as any,
    sortOrder,
    status: 'published' as any,
  };

  // 获取数据
  const { data: adaptersData, isLoading, error, refetch } = useAdapters(queryParams);
  const { data: categories } = useAdapterCategories();
  const { data: featuredAdapters } = useFeaturedAdapters(6);
  const { data: trendingAdapters } = useTrendingAdapters(6);
  const { data: latestAdapters } = useLatestAdapters(6);

  // Mutations
  const likeAdapter = useLikeAdapter();
  const unlikeAdapter = useUnlikeAdapter();
  const favoriteAdapter = useFavoriteAdapter();
  const unfavoriteAdapter = useUnfavoriteAdapter();
  const downloadAdapter = useDownloadAdapter();

  // 是否有激活的筛选条件
  const hasActiveFilters = !!(selectedCategoryId || selectedType || searchQuery);

  // 更新 URL 查询参数
  const updateURLParams = useCallback(
    (params: Partial<AdapterQueryParams>) => {
      const newParams = new URLSearchParams();

      if (params.page && params.page > 1) newParams.set('page', String(params.page));
      if (params.categoryId) newParams.set('category', params.categoryId);
      if (params.type) newParams.set('type', params.type);
      if (params.search) newParams.set('search', params.search);
      if (params.sortBy && params.sortBy !== 'downloads') newParams.set('sortBy', params.sortBy);
      if (params.sortOrder && params.sortOrder !== 'desc') newParams.set('sortOrder', params.sortOrder);

      const queryString = newParams.toString();
      router.push(`/adapters${queryString ? `?${queryString}` : ''}`, { scroll: false });
    },
    [router]
  );

  // 处理分类切换
  const handleCategoryChange = (categoryId: string | undefined) => {
    setSelectedCategoryId(categoryId);
    setPage(1);
    updateURLParams({ ...queryParams, categoryId, page: 1 });
  };

  // 处理类型切换
  const handleTypeChange = (value: string) => {
    const newType = value === 'all' ? undefined : (value as AdapterType);
    setSelectedType(newType);
    setPage(1);
    updateURLParams({ ...queryParams, type: newType, page: 1 });
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    updateURLParams({ ...queryParams, search: value, page: 1 });
  };

  // 处理排序变化
  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
    updateURLParams({ ...queryParams, sortBy: value as any, page: 1 });
  };

  // 处理分页
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateURLParams({ ...queryParams, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 清除所有筛选条件
  const handleClearFilters = () => {
    setSelectedCategoryId(undefined);
    setSelectedType(undefined);
    setSearchQuery('');
    setSortBy('downloads');
    setSortOrder('desc');
    setPage(1);
    updateURLParams({});
  };

  // 处理下载
  const handleDownload = async (adapterId: string, version?: string) => {
    try {
      await downloadAdapter.mutateAsync({ id: adapterId, version });
      toast({
        title: '成功',
        description: '开始下载适配器',
      });
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '下载失败',
        variant: 'destructive',
      });
    }
  };

  // 处理收藏
  const handleFavorite = async (adapterId: string, isFavorited?: boolean) => {
    try {
      if (isFavorited) {
        await unfavoriteAdapter.mutateAsync(adapterId);
        toast({
          title: '成功',
          description: '已取消收藏',
        });
      } else {
        await favoriteAdapter.mutateAsync(adapterId);
        toast({
          title: '成功',
          description: '收藏成功',
        });
      }
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '操作失败',
        variant: 'destructive',
      });
    }
  };

  // 处理点赞
  const handleLike = async (adapterId: string, isLiked?: boolean) => {
    try {
      if (isLiked) {
        await unlikeAdapter.mutateAsync(adapterId);
      } else {
        await likeAdapter.mutateAsync(adapterId);
      }
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '操作失败',
        variant: 'destructive',
      });
    }
  };      

  // 前往上传页面
  const handleUpload = () => {
    router.push('/adapters/upload');
  };

  // 前往详情页
  const handleAdapterClick = (adapterId: string) => {
    router.push(`/adapters/${adapterId}`);
  };

  // 当前选中的分类
  const selectedCategory = categories?.find(c => c.id === selectedCategoryId);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{MARKET_DISPLAY_NAME}</h1>
            <p className="text-muted-foreground">
              {MARKET_DESCRIPTION}
            </p>
          </div>
          <Button onClick={handleUpload} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            上传插件
          </Button>
        </div>

        <Separator className="my-6" />

        {/* 推荐区域（仅在无筛选条件时显示） */}
        {!hasActiveFilters && (
          <div className="space-y-8 mb-8">
            {/* 精选推荐 */}
            {featuredAdapters && featuredAdapters.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <h2 className="text-2xl font-semibold">精选推荐</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredAdapters.map((adapter) => (
                    <div
                      key={adapter.id}
                      onClick={() => handleAdapterClick(adapter.id)}
                      className="cursor-pointer"
                    >
                      <AdapterCard
                        adapter={adapter}
                        featured={true}
                        onDownload={() => handleDownload(adapter.id)}
                        onFavorite={() => handleFavorite(adapter.id, adapter.isFavorited)}
                        onLike={() => handleLike(adapter.id, adapter.isLiked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 热门适配器 */}
            {trendingAdapters && trendingAdapters.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  <h2 className="text-2xl font-semibold">热门适配器</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {trendingAdapters.map((adapter) => (
                    <div
                      key={adapter.id}
                      onClick={() => handleAdapterClick(adapter.id)}
                      className="cursor-pointer"
                    >
                      <AdapterCard
                        adapter={adapter}
                        onDownload={() => handleDownload(adapter.id)}
                        onFavorite={() => handleFavorite(adapter.id, adapter.isFavorited)}
                        onLike={() => handleLike(adapter.id, adapter.isLiked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 最新发布 */}
            {latestAdapters && latestAdapters.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <h2 className="text-2xl font-semibold">最新发布</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {latestAdapters.map((adapter) => (
                    <div
                      key={adapter.id}
                      onClick={() => handleAdapterClick(adapter.id)}
                      className="cursor-pointer"
                    >
                      <AdapterCard
                        adapter={adapter}
                        isNew={true}
                        onDownload={() => handleDownload(adapter.id)}
                        onFavorite={() => handleFavorite(adapter.id, adapter.isFavorited)}
                        onLike={() => handleLike(adapter.id, adapter.isLiked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator className="my-8" />
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="flex gap-6">
        {/* 左侧筛选栏（桌面端） */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-4 space-y-4">
            {categories && (
              <CategoryFilter
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={handleCategoryChange}
              />
            )}
          </div>
        </aside>

        {/* 右侧主内容 */}
        <main className="min-w-0 flex-1">
          {/* 搜索和筛选工具栏 */}
          <Card className="p-4 mb-6">
            {/* 搜索栏 */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索适配器..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 类型标签页 - 只显示插件（硬适配器） */}
            <Tabs 
              value={selectedType || 'all'} 
              onValueChange={handleTypeChange}
              className="mb-4"
            >
              <TabsList className="w-full justify-start">
                <TabsTrigger value="all">全部插件</TabsTrigger>
                <TabsTrigger value="hard">普通工具</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* 工具栏 */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* 左侧：筛选按钮和面包屑 */}
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
                      {categories && (
                        <CategoryFilter
                          categories={categories}
                          selectedCategoryId={selectedCategoryId}
                          onCategoryChange={(id) => {
                            handleCategoryChange(id);
                            setShowFilters(false);
                          }}
                        />
                      )}
                    </div>
                  </SheetContent>
                </Sheet>

                {/* 分类面包屑 */}
                {selectedCategory && (
                  <Badge variant="secondary" className="gap-2">
                    {selectedCategory.name}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => handleCategoryChange(undefined)}
                    />
                  </Badge>
                )}
              </div>

              {/* 右侧：排序和视图切换 */}
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

                {/* 排序选择 */}
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 视图切换 */}
                <div className="flex items-center gap-1 border rounded-md">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-9 px-3"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="h-9 px-3"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* 结果统计 */}
            {adaptersData && (
              <div className="text-sm text-muted-foreground mt-4">
                共找到 <span className="font-medium text-foreground">{adaptersData.total}</span> 个适配器
              </div>
            )}
          </Card>

          {/* 适配器列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <EmptyState
                title="加载失败"
                description={error.message || '无法加载适配器列表，请稍后重试'}
                action={{
                  label: '重试',
                  onClick: () => refetch(),
                }}
              />
            </div>
          ) : !adaptersData || adaptersData.data.length === 0 ? (
            <EmptyState
              title="暂无适配器"
              description={
                searchQuery
                  ? '没有找到符合条件的适配器，试试其他关键词吧'
                  : '还没有适配器，成为第一个上传的人吧！'
              }
              action={
                !searchQuery
                  ? {
                      label: '上传插件',
                      onClick: handleUpload,
                    }
                  : undefined
              }
            />
          ) : (
            <>
              {/* 适配器列表 */}
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                    : 'flex flex-col gap-4'
                }
              >
                {adaptersData.data.map((adapter) => (
                  <div
                    key={adapter.id}
                    onClick={() => handleAdapterClick(adapter.id)}
                    className="cursor-pointer"
                  >
                    <AdapterCard
                      adapter={adapter}
                      onDownload={() => handleDownload(adapter.id)}
                      onFavorite={() => handleFavorite(adapter.id, adapter.isFavorited)}
                      onLike={() => handleLike(adapter.id, adapter.isLiked)}
                      variant={viewMode === 'list' ? 'compact' : 'default'}
                    />
                  </div>
                ))}
              </div>

              {/* 分页 */}
              {adaptersData.totalPages > 1 && (
                <div className="mt-8 flex justify-center">
                  <Pagination
                    currentPage={page}
                    totalPages={adaptersData.totalPages}
                    onPageChange={handlePageChange}
                    showFirstLast
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

