# 搜索模块 (Search Module)

## 概述

搜索模块提供了完整的搜索功能，包括全局搜索、高级筛选、搜索历史、搜索建议等。

## 目录结构

```
src/features/search/
├── domain/              # 领域层
│   ├── search.types.ts  # 类型定义
│   ├── search.model.ts  # Domain 模型
│   └── index.ts
├── api/                 # API 层
│   ├── search.api.ts    # API Client
│   └── index.ts
├── hooks/               # Hooks 层
│   ├── useSearch.ts     # 搜索 Hook
│   ├── useSearchHistory.ts  # 搜索历史 Hook
│   └── index.ts
├── components/          # 组件层
│   ├── SearchBar.tsx    # 搜索栏
│   ├── SearchResults.tsx    # 搜索结果
│   ├── SearchFilters.tsx    # 筛选器
│   ├── SearchHistory.tsx    # 搜索历史
│   └── index.ts
├── index.ts
└── README.md
```

## 核心功能

### 1. 搜索类型

支持以下搜索类型：
- `ALL` - 全部
- `POST` - 帖子
- `ADAPTER` - 适配器
- `CHARACTER` - 角色
- `USER` - 用户

### 2. 搜索功能

- ✅ 全局搜索
- ✅ 分类搜索
- ✅ 高级筛选
- ✅ 多种排序方式
- ✅ 分页
- ✅ 搜索建议（自动完成）
- ✅ 搜索历史
- ✅ 热门搜索
- ✅ 高亮显示
- ✅ 搜索结果统计

## 使用示例

### 基础搜索

```tsx
import { useSearch, SearchParamsBuilder, SearchType } from '@/features/search';

function MyComponent() {
  // 构建搜索参数
  const params = new SearchParamsBuilder('react')
    .withType(SearchType.POST)
    .withPagination(1, 20)
    .build();

  // 执行搜索
  const { data, isLoading, error } = useSearch(params);

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>搜索出错</div>;

  return (
    <div>
      <p>找到 {data.total} 个结果</p>
      {data.items.map(item => (
        <div key={item.id}>{/* 渲染结果项 */}</div>
      ))}
    </div>
  );
}
```

### 使用搜索栏组件

```tsx
import { SearchBar } from '@/features/search';

function Header() {
  return (
    <SearchBar 
      placeholder="搜索帖子、适配器、角色..."
      showSuggestions={true}
      showHistory={true}
      showTrending={true}
      size="md"
    />
  );
}
```

### 使用搜索结果组件

```tsx
import { SearchResults } from '@/features/search';

function SearchPage() {
  const { data, isLoading } = useSearch(params);

  return (
    <SearchResults 
      items={data?.items || []}
      isLoading={isLoading}
    />
  );
}
```

### 使用高级筛选

```tsx
import { SearchFilters, SearchType } from '@/features/search';

function FilterSection() {
  const [filters, setFilters] = useState({});

  return (
    <SearchFilters
      filters={filters}
      onFiltersChange={setFilters}
      showTypeFilter={true}
    />
  );
}
```

### 使用搜索历史

```tsx
import { useSearchHistory } from '@/features/search';

function HistoryPanel() {
  const { 
    history, 
    addHistory, 
    removeHistory, 
    clearHistory 
  } = useSearchHistory();

  return (
    <div>
      {history.map(item => (
        <div key={item.id}>
          <span>{item.query}</span>
          <button onClick={() => removeHistory(item.id)}>删除</button>
        </div>
      ))}
      <button onClick={clearHistory}>清空历史</button>
    </div>
  );
}
```

### 搜索建议

```tsx
import { useSearchSuggestions } from '@/features/search';

function AutocompleteInput() {
  const [query, setQuery] = useState('');
  const { data: suggestions } = useSearchSuggestions(query);

  return (
    <div>
      <input 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {suggestions?.map((suggestion, i) => (
        <div key={i}>{suggestion.text}</div>
      ))}
    </div>
  );
}
```

### 热门搜索

```tsx
import { useTrendingSearch } from '@/features/search';

function TrendingPanel() {
  const { data: trending } = useTrendingSearch(10);

  return (
    <div>
      {trending?.map((item, i) => (
        <div key={i}>
          <span>{item.rank}</span>
          <span>{item.query}</span>
          <span>{item.count} 次搜索</span>
        </div>
      ))}
    </div>
  );
}
```

## API 参考

### SearchParams

```typescript
interface SearchParams {
  query: string;              // 搜索关键词
  type?: SearchType;          // 搜索类型
  filters?: SearchFilters;    // 筛选器
  sortBy?: SearchSortBy;      // 排序方式
  sortOrder?: SearchSortOrder; // 排序顺序
  page?: number;              // 页码
  pageSize?: number;          // 每页数量
}
```

### SearchFilters

```typescript
interface SearchFilters {
  type?: SearchType;          // 搜索类型
  categoryId?: string;        // 分类ID
  tags?: string[];            // 标签
  dateRange?: {               // 时间范围
    from?: Date;
    to?: Date;
  };
  ratingRange?: {             // 评分范围
    min?: number;
    max?: number;
  };
  verifiedOnly?: boolean;     // 仅已验证
  featuredOnly?: boolean;     // 仅特色推荐
}
```

### SearchResult

```typescript
interface SearchResult {
  items: SearchResultItem[];  // 结果列表
  total: number;              // 总数
  page: number;               // 当前页
  pageSize: number;           // 每页数量
  totalPages: number;         // 总页数
  took: number;               // 搜索耗时（毫秒）
  suggestions?: string[];     // 建议关键词
}
```

## 工具类

### SearchParamsBuilder

构建搜索参数的辅助类：

```typescript
const params = new SearchParamsBuilder('react')
  .withType(SearchType.POST)
  .withFilters({ tags: ['tutorial', 'beginner'] })
  .withSorting(SearchSortBy.POPULARITY, SearchSortOrder.DESC)
  .withPagination(1, 20)
  .build();
```

### SearchHistoryManager

搜索历史管理器：

```typescript
// 添加历史
SearchHistoryManager.addHistory('react', SearchType.POST, 100);

// 获取历史
const history = SearchHistoryManager.getHistory();

// 删除历史
SearchHistoryManager.removeHistory(id);

// 清空历史
SearchHistoryManager.clearHistory();
```

### SearchQueryOptimizer

搜索查询优化器：

```typescript
// 清理查询
const cleaned = SearchQueryOptimizer.cleanQuery('  React   Hooks  ');
// => 'react hooks'

// 提取关键词
const keywords = SearchQueryOptimizer.extractKeywords('React Hooks Tutorial');
// => ['react', 'hooks', 'tutorial']

// 验证查询
const isValid = SearchQueryOptimizer.isValidQuery('ab');
// => false (太短)
```

### SearchResultHelper

搜索结果辅助类：

```typescript
// 按类型分组
const groups = SearchResultHelper.groupByType(items);

// 获取类型统计
const stats = SearchResultHelper.getTypeStats(items);

// 判断是否为空
const isEmpty = SearchResultHelper.isEmpty(result);
```

## 组件 Props

### SearchBar

```typescript
interface SearchBarProps {
  className?: string;
  placeholder?: string;
  defaultValue?: string;
  showSuggestions?: boolean;
  showHistory?: boolean;
  showTrending?: boolean;
  type?: SearchType;
  onSearch?: (query: string) => void;
  size?: 'sm' | 'md' | 'lg';
}
```

### SearchResults

```typescript
interface SearchResultsProps {
  items: SearchResultItem[];
  isLoading?: boolean;
  className?: string;
}
```

### SearchFilters

```typescript
interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  showTypeFilter?: boolean;
  className?: string;
}
```

### SearchHistory

```typescript
interface SearchHistoryProps {
  onSelect?: (query: string, type: SearchType) => void;
  maxItems?: number;
  showAsCard?: boolean;
  className?: string;
}
```

## 缓存策略

搜索模块使用 TanStack Query 进行数据缓存：

- **搜索结果**: 5分钟 staleTime，10分钟 gcTime
- **搜索建议**: 10分钟 staleTime，30分钟 gcTime
- **热门搜索**: 5分钟 staleTime，15分钟 gcTime

## 本地存储

搜索历史存储在 localStorage：

- **存储键**: `zishu_search_history`
- **最大数量**: 20条
- **数据结构**: JSON 数组

## 性能优化

1. **防抖**: 搜索建议使用 300ms 防抖
2. **缓存**: TanStack Query 自动缓存
3. **懒加载**: 组件按需加载
4. **虚拟滚动**: 大量结果时可使用虚拟滚动

## 国际化

支持多语言（需配置 i18n）：

- 中文（zh-CN）
- 英文（en-US）
- 日文（ja-JP）

## 测试

### 单元测试示例

```typescript
import { describe, it, expect } from 'vitest';
import { SearchQueryOptimizer } from './search.model';

describe('SearchQueryOptimizer', () => {
  it('should clean query', () => {
    const result = SearchQueryOptimizer.cleanQuery('  React   Hooks  ');
    expect(result).toBe('react hooks');
  });

  it('should extract keywords', () => {
    const keywords = SearchQueryOptimizer.extractKeywords('React Hooks');
    expect(keywords).toEqual(['react', 'hooks']);
  });
});
```

## 注意事项

1. 搜索关键词至少2个字符
2. 搜索历史最多保存20条
3. 使用 WebSocket 时需配置实时推送
4. 搜索结果高亮使用 `dangerouslySetInnerHTML`，请确保后端返回安全的 HTML

## 后端 API 要求

### 搜索接口

```
GET /api/search?q={query}&type={type}&page={page}&pageSize={pageSize}
```

响应格式：

```json
{
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5,
    "took": 123,
    "suggestions": ["react hooks", "react tutorial"]
  }
}
```

### 搜索建议接口

```
GET /api/search/suggestions?q={query}
```

### 热门搜索接口

```
GET /api/search/trending?limit={limit}
```

## 路由

- `/search` - 搜索结果页
- `/search?q={query}` - 带关键词的搜索
- `/search?q={query}&type={type}` - 指定类型的搜索
- `/search?q={query}&page={page}` - 指定页码的搜索

## 常见问题

### Q: 如何自定义搜索结果项的渲染？

A: 可以基于 `SearchResults` 组件创建自定义组件，或直接使用 `useSearch` Hook 获取数据后自行渲染。

### Q: 如何禁用搜索历史？

A: 在 `SearchBar` 组件中设置 `showHistory={false}`。

### Q: 如何清空所有缓存？

A: 使用 `useInvalidateSearch` Hook：

```tsx
const { invalidateAll } = useInvalidateSearch();
invalidateAll();
```

### Q: 如何实现服务端搜索？

A: 修改 `SearchApiClient` 以使用服务端 API 端点，或使用 Next.js Server Actions。

## 更新日志

### v1.0.0 (2025-10-23)

- ✅ 初始版本
- ✅ 基础搜索功能
- ✅ 高级筛选
- ✅ 搜索历史
- ✅ 搜索建议
- ✅ 热门搜索
- ✅ 搜索结果高亮

