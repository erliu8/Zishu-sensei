/**
 * 搜索模块 - 使用示例
 * 
 * 这个文件包含了搜索模块的各种使用场景示例
 */

'use client';

import { useState } from 'react';
import {
  SearchBar,
  SearchResults,
  SearchFilters,
  SearchHistory,
} from '../components';
import {
  useSearch,
  useSearchSuggestions,
  useTrendingSearch,
  useSearchHistory,
} from '../hooks';
import {
  SearchType,
  SearchSortBy,
  SearchSortOrder,
  SearchParamsBuilder,
  type SearchFilters as SearchFiltersType,
} from '../domain';

/**
 * 示例 1: 基础搜索页面
 * 完整的搜索页面，包含搜索栏、筛选器、结果展示
 */
export function BasicSearchPage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFiltersType>({});
  const [page, setPage] = useState(1);

  // 构建搜索参数
  const searchParams = new SearchParamsBuilder(query)
    .withType(SearchType.ALL)
    .withFilters(filters)
    .withPagination(page, 20)
    .build();

  // 执行搜索
  const { data, isLoading, error } = useSearch(searchParams);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">搜索</h1>

      {/* 搜索栏 */}
      <SearchBar
        placeholder="搜索帖子、适配器、角色..."
        onSearch={setQuery}
        size="lg"
      />

      {/* 筛选器 */}
      <div className="my-6">
        <SearchFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* 搜索结果 */}
      {error && <div className="text-red-600">搜索出错</div>}
      
      <SearchResults items={data?.items || []} isLoading={isLoading} />

      {/* 分页 */}
      {data && data.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            上一页
          </button>
          <span>
            {page} / {data.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 示例 2: 仅搜索帖子
 * 特定类型的搜索页面
 */
export function PostSearchPage() {
  const [query, setQuery] = useState('');

  const searchParams = new SearchParamsBuilder(query)
    .withType(SearchType.POST)
    .withSorting(SearchSortBy.CREATED_AT, SearchSortOrder.DESC)
    .build();

  const { data, isLoading } = useSearch(searchParams);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">搜索帖子</h1>
      
      <SearchBar
        placeholder="搜索帖子..."
        type={SearchType.POST}
        onSearch={setQuery}
      />

      <div className="mt-6">
        <SearchResults items={data?.items || []} isLoading={isLoading} />
      </div>
    </div>
  );
}

/**
 * 示例 3: 带搜索建议的输入框
 * 自动完成搜索
 */
export function AutocompleteSearch() {
  const [query, setQuery] = useState('');
  const { data: suggestions } = useSearchSuggestions(query);

  return (
    <div className="relative w-full max-w-md">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="输入搜索关键词..."
        className="w-full rounded-md border px-4 py-2"
      />

      {suggestions && suggestions.length > 0 && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-md border bg-white shadow-lg">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => setQuery(suggestion.text)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100"
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 示例 4: 热门搜索展示
 * 展示热门搜索词
 */
export function TrendingSearchWidget() {
  const { data: trending } = useTrendingSearch(10);

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-4 font-medium">热门搜索</h3>
      <div className="space-y-2">
        {trending?.map((item, index) => (
          <div key={index} className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-white">
              {item.rank}
            </span>
            <span className="flex-1">{item.query}</span>
            <span className="text-xs text-muted-foreground">
              {item.count} 次
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 示例 5: 搜索历史管理
 * 展示和管理搜索历史
 */
export function SearchHistoryPanel() {
  const { history, removeHistory, clearHistory } = useSearchHistory();

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-medium">搜索历史</h3>
        <button
          onClick={clearHistory}
          className="text-sm text-red-600 hover:underline"
        >
          清空
        </button>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无搜索历史</p>
      ) : (
        <div className="space-y-2">
          {history.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md border p-2"
            >
              <div className="flex-1">
                <p className="text-sm">{item.query}</p>
                <p className="text-xs text-muted-foreground">
                  {item.resultCount} 个结果
                </p>
              </div>
              <button
                onClick={() => removeHistory(item.id)}
                className="text-xs text-red-600 hover:underline"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 示例 6: 高级搜索表单
 * 包含所有筛选选项的高级搜索
 */
export function AdvancedSearchForm() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<SearchType>(SearchType.ALL);
  const [filters, setFilters] = useState<SearchFiltersType>({});
  const [sortBy, setSortBy] = useState<SearchSortBy>(SearchSortBy.RELEVANCE);

  const searchParams = new SearchParamsBuilder(query)
    .withType(type)
    .withFilters(filters)
    .withSorting(sortBy, SearchSortOrder.DESC)
    .build();

  const { data, isLoading } = useSearch(searchParams);

  return (
    <div className="space-y-6">
      {/* 搜索输入 */}
      <div>
        <label className="mb-2 block text-sm font-medium">搜索关键词</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border px-4 py-2"
        />
      </div>

      {/* 搜索类型 */}
      <div>
        <label className="mb-2 block text-sm font-medium">搜索类型</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SearchType)}
          className="w-full rounded-md border px-4 py-2"
        >
          <option value={SearchType.ALL}>全部</option>
          <option value={SearchType.POST}>帖子</option>
          <option value={SearchType.ADAPTER}>适配器</option>
          <option value={SearchType.CHARACTER}>角色</option>
          <option value={SearchType.USER}>用户</option>
        </select>
      </div>

      {/* 排序方式 */}
      <div>
        <label className="mb-2 block text-sm font-medium">排序方式</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SearchSortBy)}
          className="w-full rounded-md border px-4 py-2"
        >
          <option value={SearchSortBy.RELEVANCE}>相关性</option>
          <option value={SearchSortBy.CREATED_AT}>创建时间</option>
          <option value={SearchSortBy.POPULARITY}>热门度</option>
          <option value={SearchSortBy.DOWNLOADS}>下载量</option>
          <option value={SearchSortBy.RATING}>评分</option>
        </select>
      </div>

      {/* 高级筛选 */}
      <SearchFilters
        filters={filters}
        onFiltersChange={setFilters}
        showTypeFilter={false}
      />

      {/* 搜索结果 */}
      <div className="mt-8">
        <SearchResults items={data?.items || []} isLoading={isLoading} />
      </div>
    </div>
  );
}

/**
 * 示例 7: 导航栏搜索
 * 集成到导航栏的紧凑搜索栏
 */
export function NavbarSearch() {
  return (
    <div className="flex items-center gap-4">
      <SearchBar
        placeholder="搜索..."
        size="sm"
        showHistory={false}
        showTrending={false}
      />
    </div>
  );
}

/**
 * 示例 8: 移动端搜索
 * 移动端优化的搜索界面
 */
export function MobileSearch() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 搜索按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md border px-4 py-2"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        搜索
      </button>

      {/* 全屏搜索面板 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="flex items-center gap-2 border-b p-4">
            <button onClick={() => setIsOpen(false)}>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <SearchBar
              placeholder="搜索..."
              size="md"
              onSearch={() => setIsOpen(false)}
            />
          </div>
          <div className="p-4">
            <SearchHistory onSelect={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

