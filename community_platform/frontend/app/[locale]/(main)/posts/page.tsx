/**
 * 帖子列表页
 * @route /posts
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PostCard } from '@/features/post/components';
import { usePosts } from '@/features/post/hooks';
import { usePostStore, postStoreSelectors } from '@/features/post/store';
import type { PostQueryParams, CategoryInfo } from '@/features/post/domain';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsList,
  TabsTrigger,
  Badge,
  Separator,
} from '@/shared/components';
import { LoadingSpinner, EmptyState, Pagination } from '@/shared/components/common';
import { Search, Grid3x3, List, Plus } from 'lucide-react';

/**
 * 帖子分类选项（示例数据，实际应该从 API 获取）
 */
const CATEGORIES: CategoryInfo[] = [
  { id: '1', name: '全部', slug: 'all' },
  { id: '2', name: '教程', slug: 'tutorial', color: '#3b82f6' },
  { id: '3', name: '讨论', slug: 'discussion', color: '#8b5cf6' },
  { id: '4', name: '分享', slug: 'share', color: '#10b981' },
  { id: '5', name: '问答', slug: 'qa', color: '#f59e0b' },
];

/**
 * 排序选项
 */
const SORT_OPTIONS = [
  { value: 'createdAt', label: '最新发布' },
  { value: 'updatedAt', label: '最近更新' },
  { value: 'viewCount', label: '最多浏览' },
  { value: 'likeCount', label: '最多点赞' },
  { value: 'commentCount', label: '最多评论' },
] as const;

/**
 * 帖子列表页面组件
 */
export default function PostsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 从 URL 获取初始查询参数
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialCategory = searchParams.get('category') || undefined;
  const initialSearch = searchParams.get('search') || '';
  const initialSortBy = (searchParams.get('sortBy') as any) || 'createdAt';
  const initialSortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

  // 本地状态
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(12);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder] = useState<'asc' | 'desc'>(initialSortOrder);

  // Store 状态
  const viewMode = usePostStore(postStoreSelectors.viewMode);
  const setViewMode = usePostStore((state) => state.setViewMode);

  // 构建查询参数
  const queryParams: PostQueryParams = {
    page,
    pageSize,
    category: selectedCategory && selectedCategory !== 'all' ? selectedCategory : undefined,
    search: searchQuery || undefined,
    sortBy: sortBy as any,
    sortOrder,
  };

  // 获取帖子列表
  const { data, isLoading, error, refetch } = usePosts(queryParams);

  // 更新 URL 查询参数
  const updateURLParams = useCallback(
    (params: Partial<PostQueryParams>) => {
      const newParams = new URLSearchParams();
      
      if (params.page && params.page > 1) newParams.set('page', String(params.page));
      if (params.category && params.category !== 'all') newParams.set('category', params.category);
      if (params.search) newParams.set('search', params.search);
      if (params.sortBy && params.sortBy !== 'createdAt') newParams.set('sortBy', params.sortBy);
      if (params.sortOrder && params.sortOrder !== 'desc') newParams.set('sortOrder', params.sortOrder);

      const queryString = newParams.toString();
      router.push(`/posts${queryString ? `?${queryString}` : ''}`, { scroll: false });
    },
    [router]
  );

  // 处理分类切换
  const handleCategoryChange = (categorySlug: string) => {
    setSelectedCategory(categorySlug);
    setPage(1);
    updateURLParams({ ...queryParams, category: categorySlug, page: 1 });
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

  // 前往创建帖子页
  const handleCreatePost = () => {
    router.push('/posts/create');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">社区帖子</h1>
            <p className="text-muted-foreground">
              发现和分享 AI 角色相关的精彩内容
            </p>
          </div>
          <Button onClick={handleCreatePost} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            发布帖子
          </Button>
        </div>

        <Separator className="my-6" />

        {/* 筛选和搜索栏 */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* 分类标签 */}
          <Tabs
            value={selectedCategory || 'all'}
            onValueChange={handleCategoryChange}
            className="w-full lg:w-auto"
          >
            <TabsList>
              {CATEGORIES.map((category) => (
                <TabsTrigger key={category.id} value={category.slug}>
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* 搜索和排序 */}
          <div className="flex items-center gap-3">
            {/* 搜索框 */}
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索帖子..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

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

        {/* 当前筛选条件提示 */}
        {(selectedCategory && selectedCategory !== 'all') || searchQuery ? (
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-muted-foreground">当前筛选:</span>
            {selectedCategory && selectedCategory !== 'all' && (
              <Badge variant="secondary">
                {CATEGORIES.find((c) => c.slug === selectedCategory)?.name}
              </Badge>
            )}
            {searchQuery && <Badge variant="secondary">搜索: {searchQuery}</Badge>}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCategory(undefined);
                setSearchQuery('');
                setPage(1);
                updateURLParams({});
              }}
            >
              清除筛选
            </Button>
          </div>
        ) : null}
      </div>

      {/* 帖子列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <EmptyState
            title="加载失败"
            description={error.message || '无法加载帖子列表，请稍后重试'}
            action={{
              label: '重试',
              onClick: () => refetch(),
            }}
          />
        </div>
      ) : !data?.data || data.data.length === 0 ? (
        <EmptyState
          title="暂无帖子"
          description={
            searchQuery
              ? '没有找到符合条件的帖子，试试其他关键词吧'
              : '还没有人发布帖子，成为第一个发帖的人吧！'
          }
          action={
            !searchQuery
              ? {
                  label: '发布帖子',
                  onClick: handleCreatePost,
                }
              : undefined
          }
        />
      ) : (
        <>
          {/* 统计信息 */}
          <div className="mb-6 text-sm text-muted-foreground">
            共找到 <span className="font-semibold text-foreground">{data.total}</span> 篇帖子
          </div>

          {/* 帖子列表 */}
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'flex flex-col gap-4'
            }
          >
            {data.data.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                variant={viewMode === 'grid' ? 'default' : 'compact'}
              />
            ))}
          </div>

          {/* 分页 */}
          {data.totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={data.totalPages}
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

