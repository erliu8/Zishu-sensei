/**
 * 角色列表页面
 * @route /characters
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  useCharacters, 
  useFeaturedCharacters,
  useTrendingCharacters,
} from '@/features/character/hooks';
import type { CharacterFilters } from '@/features/character/domain';
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
import { LoadingSpinner, EmptyState } from '@/shared/components/common';
import { 
  Search, 
  Grid3x3, 
  List, 
  Plus, 
  SlidersHorizontal,
  X,
  Star,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react';
import { CharacterCard } from '@/features/character/components/CharacterCard';
import { CharacterList } from '@/features/character/components/CharacterList';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import { cn } from '@/shared/utils';
import { useToast } from '@/shared/hooks/use-toast';
import { CharacterVisibility } from '@/features/character/types';

/**
 * 排序选项
 */
const SORT_OPTIONS = [
  { value: 'createdAt', label: '最新创建' },
  { value: 'updatedAt', label: '最近更新' },
  { value: 'downloads', label: '最多下载' },
  { value: 'rating', label: '评分最高' },
  { value: 'likes', label: '最多点赞' },
] as const;

/**
 * 角色列表页面组件
 */
export default function CharactersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // 从 URL 获取初始查询参数
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialSearch = searchParams.get('search') || '';
  const initialSortBy = (searchParams.get('sortBy') as any) || 'downloads';
  const initialSortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
  const initialTags = searchParams.get('tags')?.split(',').filter(Boolean) || [];

  // 本地状态
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(12);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // 构建查询参数
  const queryParams: CharacterFilters = {
    page,
    pageSize,
    search: searchQuery || undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    sortBy: sortBy as any,
    sortOrder,
    publishedOnly: true,
    visibility: CharacterVisibility.PUBLIC,
  };

  // 获取数据
  const { data: charactersData, isLoading, error, refetch } = useCharacters(queryParams);
  const { data: featuredCharacters } = useFeaturedCharacters(6);
  const { data: trendingCharacters } = useTrendingCharacters(6);

  // 是否有激活的筛选条件
  const hasActiveFilters = !!(searchQuery || selectedTags.length > 0);

  // 更新 URL 查询参数
  const updateURLParams = useCallback(
    (params: Partial<CharacterFilters>) => {
      const newParams = new URLSearchParams();

      if (params.page && params.page > 1) newParams.set('page', String(params.page));
      if (params.search) newParams.set('search', params.search);
      if (params.tags && params.tags.length > 0) newParams.set('tags', params.tags.join(','));
      if (params.sortBy && params.sortBy !== 'downloads') newParams.set('sortBy', params.sortBy);
      if (params.sortOrder && params.sortOrder !== 'desc') newParams.set('sortOrder', params.sortOrder);

      const queryString = newParams.toString();
      router.push(`/characters${queryString ? `?${queryString}` : ''}`, { scroll: false });
    },
    [router]
  );

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
    setSearchQuery('');
    setSelectedTags([]);
    setSortBy('downloads');
    setSortOrder('desc');
    setPage(1);
    updateURLParams({});
  };

  // 前往创建页面
  const handleCreate = () => {
    router.push('/characters/create');
  };

  // 前往详情页
  const handleCharacterClick = (characterId: string) => {
    router.push(`/characters/${characterId}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">AI 角色广场</h1>
            <p className="text-muted-foreground">
              发现和使用社区创建的优质 AI 角色
            </p>
          </div>
          <Button onClick={handleCreate} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            创建角色
          </Button>
        </div>

        <Separator className="my-6" />

        {/* 推荐区域（仅在无筛选条件时显示） */}
        {!hasActiveFilters && (
          <div className="space-y-8 mb-8">
            {/* 精选推荐 */}
            {featuredCharacters && featuredCharacters.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="h-5 w-5 text-yellow-500" />
                  <h2 className="text-2xl font-semibold">精选角色</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredCharacters.map((character) => (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      onClick={() => handleCharacterClick(character.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 热门角色 */}
            {trendingCharacters && trendingCharacters.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  <h2 className="text-2xl font-semibold">热门角色</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {trendingCharacters.map((character) => (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      onClick={() => handleCharacterClick(character.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            <Separator className="my-8" />
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="space-y-6">
        {/* 搜索和筛选工具栏 */}
        <Card className="p-4">
          {/* 搜索栏 */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索角色名称、标签..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* 工具栏 */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* 左侧：筛选信息 */}
            <div className="flex items-center gap-2">
              {hasActiveFilters && selectedTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-2">
                  {tag}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => {
                      const newTags = selectedTags.filter(t => t !== tag);
                      setSelectedTags(newTags);
                      updateURLParams({ ...queryParams, tags: newTags });
                    }}
                  />
                </Badge>
              ))}
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
          {charactersData && (
            <div className="text-sm text-muted-foreground mt-4">
              共找到 <span className="font-medium text-foreground">{charactersData.total}</span> 个角色
            </div>
          )}
        </Card>

        {/* 角色列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <EmptyState
              title="加载失败"
              description={error.message || '无法加载角色列表，请稍后重试'}
              action={{
                label: '重试',
                onClick: () => refetch(),
              }}
            />
          </div>
        ) : !charactersData || charactersData.data.length === 0 ? (
          <EmptyState
            title="暂无角色"
            description={
              searchQuery
                ? '没有找到符合条件的角色，试试其他关键词吧'
                : '还没有角色，成为第一个创建的人吧！'
            }
            action={
              !searchQuery
                ? {
                    label: '创建角色',
                    onClick: handleCreate,
                  }
                : undefined
            }
          />
        ) : (
          <>
            {/* 角色列表 */}
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'flex flex-col gap-4'
              }
            >
              {charactersData.data.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  variant={viewMode}
                  onClick={() => handleCharacterClick(character.id)}
                />
              ))}
            </div>

            {/* 分页 */}
            {charactersData.totalPages > 1 && (
              <div className="mt-8">
                <CharacterList
                  characters={[]}
                  pagination={{
                    page,
                    pageSize,
                    total: charactersData.total,
                    totalPages: charactersData.totalPages,
                  }}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

