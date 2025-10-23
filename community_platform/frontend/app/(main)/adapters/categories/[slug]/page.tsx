/**
 * 适配器分类页面
 * @route /adapters/categories/[slug]
 */

'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  useAdapters,
  useLikeAdapter,
  useUnlikeAdapter,
  useFavoriteAdapter,
  useUnfavoriteAdapter,
  useDownloadAdapter,
} from '@/features/adapter/hooks';
import { useAdapterCategories } from '@/features/adapter/hooks/useAdapterCategories';
import type { AdapterQueryParams, AdapterType, AdapterCategory } from '@/features/adapter/domain';
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/components';
import { LoadingSpinner, EmptyState, Pagination } from '@/shared/components/common';
import { 
  Search, 
  Grid3x3, 
  List,
  Home,
  ChevronRight,
} from 'lucide-react';
import { AdapterCard } from '@/features/adapter/components/marketplace';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/utils';

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
 * 适配器分类页面组件
 */
export default function AdapterCategoryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categorySlug = params['slug'] as string;
  const { toast } = useToast();

  // 从 URL 获取初始查询参数
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialType = (searchParams.get('type') as AdapterType) || undefined;
  const initialSearch = searchParams.get('search') || '';
  const initialSortBy = (searchParams.get('sortBy') as any) || 'downloads';
  const initialSortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

  // 本地状态
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(12);
  const [selectedType, setSelectedType] = useState<AdapterType | undefined>(initialType);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 获取所有分类
  const { data: categories, isLoading: categoriesLoading } = useAdapterCategories();

  // 查找当前分类
  const currentCategory = categories?.find(c => c.slug === categorySlug);
  const categoryId = currentCategory?.id;

  // 构建查询参数
  const queryParams: AdapterQueryParams = {
    page,
    pageSize,
    categoryId,
    type: selectedType,
    search: searchQuery || undefined,
    sortBy: sortBy as any,
    sortOrder,
    status: 'published' as any,
  };

  // 获取适配器列表
  const { data: adaptersData, isLoading: adaptersLoading, error, refetch } = useAdapters(
    queryParams,
    { enabled: !!categoryId }
  );

  // Mutations
  const likeAdapter = useLikeAdapter();
  const unlikeAdapter = useUnlikeAdapter();
  const favoriteAdapter = useFavoriteAdapter();
  const unfavoriteAdapter = useUnfavoriteAdapter();
  const downloadAdapter = useDownloadAdapter();

  const isLoading = categoriesLoading || adaptersLoading;

  // 更新 URL 查询参数
  const updateURLParams = useCallback(
    (params: Partial<AdapterQueryParams>) => {
      const newParams = new URLSearchParams();

      if (params.page && params.page > 1) newParams.set('page', String(params.page));
      if (params.type) newParams.set('type', params.type);
      if (params.search) newParams.set('search', params.search);
      if (params.sortBy && params.sortBy !== 'downloads') newParams.set('sortBy', params.sortBy);
      if (params.sortOrder && params.sortOrder !== 'desc') newParams.set('sortOrder', params.sortOrder);

      const queryString = newParams.toString();
      router.push(`/adapters/categories/${categorySlug}${queryString ? `?${queryString}` : ''}`, { scroll: false });
    },
    [router, categorySlug]
  );

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

  // 处理下载
  const handleDownload = async (adapterId: string, version?: string) => {
    try {
      await downloadAdapter.mutateAsync({ id: adapterId, version });
      toast.success('开始下载适配器');
    } catch (error: any) {
      toast.error(error.message || '下载失败');
    }
  };

  // 处理收藏
  const handleFavorite = async (adapterId: string, isFavorited?: boolean) => {
    try {
      if (isFavorited) {
        await unfavoriteAdapter.mutateAsync(adapterId);
        toast.success('已取消收藏');
      } else {
        await favoriteAdapter.mutateAsync(adapterId);
        toast.success('收藏成功');
      }
    } catch (error: any) {
      toast.error(error.message || '操作失败');
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
      toast.error(error.message || '操作失败');
    }
  };

  // 前往详情页
  const handleAdapterClick = (adapterId: string) => {
    router.push(`/adapters/${adapterId}`);
  };

  // 获取父分类链
  const getCategoryPath = (category: AdapterCategory | undefined): AdapterCategory[] => {
    if (!category) return [];
    const path: AdapterCategory[] = [category];
    let current = category;
    
    while (current.parentId) {
      const parent = categories?.find(c => c.id === current.parentId);
      if (!parent) break;
      path.unshift(parent);
      current = parent;
    }
    
    return path;
  };

  const categoryPath = getCategoryPath(currentCategory);

  if (isLoading && !currentCategory) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!currentCategory) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <EmptyState
            title="分类不存在"
            description="无法找到该分类"
            action={{
              label: '返回市场',
              onClick: () => router.push('/adapters'),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 面包屑导航 */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/adapters">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="h-4 w-4" />
          </BreadcrumbSeparator>
          {categoryPath.map((cat, index) => (
            <BreadcrumbItem key={cat.id}>
              {index === categoryPath.length - 1 ? (
                <BreadcrumbPage>{cat.name}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink href={`/adapters/categories/${cat.slug}`}>
                    {cat.name}
                  </BreadcrumbLink>
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                </>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* 分类头部 */}
      <div className="mb-8">
        <div className="flex items-start gap-4 mb-4">
          {currentCategory.icon && (
            <div 
              className="h-16 w-16 rounded-lg flex items-center justify-center text-2xl"
              style={{ backgroundColor: currentCategory.color || '#ccc' }}
            >
              {currentCategory.icon}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{currentCategory.name}</h1>
            {currentCategory.description && (
              <p className="text-muted-foreground">{currentCategory.description}</p>
            )}
            {currentCategory.adapterCount !== undefined && (
              <p className="text-sm text-muted-foreground mt-2">
                共 {currentCategory.adapterCount} 个适配器
              </p>
            )}
          </div>
        </div>

        <Separator className="my-6" />
      </div>

      {/* 搜索和筛选工具栏 */}
      <Card className="p-4 mb-6">
        {/* 搜索栏 */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="在此分类中搜索..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* 类型标签页 */}
        <Tabs 
          value={selectedType || 'all'} 
          onValueChange={handleTypeChange}
          className="mb-4"
        >
          <TabsList className="w-full justify-start">
            <TabsTrigger value="all">全部</TabsTrigger>
            <TabsTrigger value="soft">软适配器</TabsTrigger>
            <TabsTrigger value="hard">硬适配器</TabsTrigger>
            <TabsTrigger value="intelligent">智能硬适配器</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 工具栏 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* 结果统计 */}
          {adaptersData && (
            <div className="text-sm text-muted-foreground">
              共找到 <span className="font-medium text-foreground">{adaptersData.total}</span> 个适配器
            </div>
          )}

          {/* 右侧：排序和视图切换 */}
          <div className="flex items-center gap-2">
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
      </Card>

      {/* 适配器列表 */}
      {adaptersLoading ? (
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
              : '此分类下暂无适配器'
          }
          action={{
            label: '浏览其他分类',
            onClick: () => router.push('/adapters'),
          }}
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
              <AdapterCard
                key={adapter.id}
                adapter={adapter}
                viewMode={viewMode}
                onClick={() => handleAdapterClick(adapter.id)}
                onDownload={() => handleDownload(adapter.id)}
                onFavorite={() => handleFavorite(adapter.id, adapter.isFavorited)}
                onLike={() => handleLike(adapter.id, adapter.isLiked)}
              />
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
    </div>
  );
}

