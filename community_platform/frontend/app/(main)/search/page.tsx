/**
 * 搜索结果页面
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowUpDown, Grid, List } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/shared/components/ui/pagination';
import { Separator } from '@/shared/components/ui/separator';
import {
  SearchBar,
  SearchResults,
  SearchFilters,
  SearchHistory,
} from '@/features/search/components';
import { useSearch } from '@/features/search/hooks/useSearch';
import {
  SearchType,
  SearchSortBy,
  SearchSortOrder,
  SearchParamsBuilder,
  SearchResultHelper,
  type SearchFilters as SearchFiltersType,
} from '@/features/search/domain';

/**
 * 搜索结果页面
 */
export default function SearchPage() {
  const searchParams = useSearchParams();
  
  // 获取 URL 参数
  const query = searchParams.get('q') || '';
  const typeParam = (searchParams.get('type') as SearchType) || SearchType.ALL;
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // 状态
  const [searchType, setSearchType] = useState<SearchType>(typeParam);
  const [sortBy, setSortBy] = useState<SearchSortBy>(SearchSortBy.RELEVANCE);
  const [sortOrder, setSortOrder] = useState<SearchSortOrder>(SearchSortOrder.DESC);
  const [filters, setFilters] = useState<SearchFiltersType>({});
  const [page, setPage] = useState(pageParam);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // 构建搜索参数
  const searchParamsObj = new SearchParamsBuilder(query)
    .withType(searchType)
    .withFilters(filters)
    .withSorting(sortBy, sortOrder)
    .withPagination(page, 20)
    .build();

  // 执行搜索
  const {
    data: searchResult,
    isLoading,
    error,
  } = useSearch(searchParamsObj, {
    enabled: query.trim().length >= 2,
  });

  // 当 URL 参数变化时，更新状态
  useEffect(() => {
    const newQuery = searchParams.get('q') || '';
    const newType = (searchParams.get('type') as SearchType) || SearchType.ALL;
    const newPage = parseInt(searchParams.get('page') || '1', 10);

    if (newQuery !== query) {
      setPage(1); // 重置页码
    }
    
    setSearchType(newType);
    setPage(newPage);
  }, [searchParams, query]);

  // 获取类型统计
  const typeStats = searchResult
    ? SearchResultHelper.getTypeStats(searchResult.items)
    : null;

  /**
   * 切换搜索类型
   */
  const handleTypeChange = (type: SearchType) => {
    setSearchType(type);
    setPage(1); // 重置页码
  };

  /**
   * 切换排序
   */
  const handleSortChange = (value: string) => {
    setSortBy(value as SearchSortBy);
    setPage(1);
  };

  /**
   * 切换排序顺序
   */
  const toggleSortOrder = () => {
    setSortOrder((prev) =>
      prev === SearchSortOrder.ASC ? SearchSortOrder.DESC : SearchSortOrder.ASC
    );
    setPage(1);
  };

  /**
   * 更新筛选器
   */
  const handleFiltersChange = (newFilters: SearchFiltersType) => {
    setFilters(newFilters);
    setPage(1);
  };

  /**
   * 翻页
   */
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 如果没有搜索词，显示搜索历史
  if (!query) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-4 text-3xl font-bold">搜索</h1>
          <SearchBar size="lg" />
        </div>
        <SearchHistory
          onSelect={(selectedQuery, type) => {
            const params = new URLSearchParams({ q: selectedQuery });
            if (type !== SearchType.ALL) {
              params.append('type', type);
            }
            window.location.href = `/search?${params.toString()}`;
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* 搜索栏 */}
      <div className="mb-8">
        <SearchBar defaultValue={query} size="lg" />
      </div>

      {/* 搜索结果信息 */}
      {searchResult && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              找到 <span className="font-medium text-foreground">{searchResult.total}</span>{' '}
              个结果
              {searchResult.took && (
                <span> ({(searchResult.took / 1000).toFixed(2)} 秒)</span>
              )}
            </div>
            {searchResult.suggestions && searchResult.suggestions.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">建议搜索: </span>
                {searchResult.suggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="link"
                    className="h-auto p-0 px-1 text-sm"
                    onClick={() => {
                      window.location.href = `/search?q=${encodeURIComponent(suggestion)}`;
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 类型标签 */}
      <Tabs value={searchType} onValueChange={(value) => handleTypeChange(value as SearchType)}>
        <TabsList className="mb-6">
          <TabsTrigger value={SearchType.ALL}>
            全部 {typeStats && `(${typeStats[SearchType.ALL]})`}
          </TabsTrigger>
          <TabsTrigger value={SearchType.POST}>
            帖子 {typeStats && `(${typeStats[SearchType.POST]})`}
          </TabsTrigger>
          <TabsTrigger value={SearchType.ADAPTER}>
            适配器 {typeStats && `(${typeStats[SearchType.ADAPTER]})`}
          </TabsTrigger>
          <TabsTrigger value={SearchType.CHARACTER}>
            角色 {typeStats && `(${typeStats[SearchType.CHARACTER]})`}
          </TabsTrigger>
          <TabsTrigger value={SearchType.USER}>
            用户 {typeStats && `(${typeStats[SearchType.USER]})`}
          </TabsTrigger>
        </TabsList>

        {/* 工具栏 */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 排序 */}
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SearchSortBy.RELEVANCE}>相关性</SelectItem>
                <SelectItem value={SearchSortBy.CREATED_AT}>创建时间</SelectItem>
                <SelectItem value={SearchSortBy.UPDATED_AT}>更新时间</SelectItem>
                <SelectItem value={SearchSortBy.POPULARITY}>热门度</SelectItem>
                {(searchType === SearchType.ADAPTER || searchType === SearchType.CHARACTER) && (
                  <>
                    <SelectItem value={SearchSortBy.DOWNLOADS}>下载量</SelectItem>
                    <SelectItem value={SearchSortBy.RATING}>评分</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>

            {/* 排序顺序 */}
            <Button variant="outline" size="icon" onClick={toggleSortOrder}>
              <ArrowUpDown className="h-4 w-4" />
            </Button>

            {/* 筛选器 */}
            <SearchFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              showTypeFilter={false}
            />
          </div>

          {/* 视图模式切换 */}
          <div className="flex gap-1 rounded-md border p-1">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator className="mb-6" />

        {/* 搜索结果 */}
        <TabsContent value={searchType} className="mt-0">
          {error ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-center">
              <p className="text-sm text-destructive">搜索出错，请稍后重试</p>
            </div>
          ) : (
            <>
              <SearchResults
                items={searchResult?.items || []}
                isLoading={isLoading}
              />

              {/* 分页 */}
              {searchResult && searchResult.totalPages > 1 && (
                <div className="mt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => page > 1 && handlePageChange(page - 1)}
                          className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>

                      {Array.from({ length: Math.min(searchResult.totalPages, 5) }, (_, i) => {
                        const pageNumber = i + 1;
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink
                              onClick={() => handlePageChange(pageNumber)}
                              isActive={page === pageNumber}
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}

                      {searchResult.totalPages > 5 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            page < searchResult.totalPages && handlePageChange(page + 1)
                          }
                          className={
                            page >= searchResult.totalPages
                              ? 'pointer-events-none opacity-50'
                              : ''
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

