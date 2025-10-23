# 搜索模块 - 快速开始

## 🚀 5分钟快速上手

### 步骤 1: 在页面中添加搜索栏

在任何页面中导入并使用 `SearchBar` 组件：

```tsx
import { SearchBar } from '@/features/search';

export default function MyPage() {
  return (
    <div>
      <SearchBar placeholder="搜索..." />
    </div>
  );
}
```

就这么简单！SearchBar 会自动：
- ✅ 显示搜索建议
- ✅ 显示搜索历史
- ✅ 显示热门搜索
- ✅ 导航到搜索结果页

### 步骤 2: 使用搜索结果页

搜索结果页已经创建在 `/search`，用户点击搜索后会自动跳转。

如果需要自定义搜索结果页，可以使用 Hook：

```tsx
'use client';

import { useSearch, SearchParamsBuilder, SearchType } from '@/features/search';

export default function SearchPage() {
  const params = new SearchParamsBuilder('react')
    .withType(SearchType.POST)
    .build();

  const { data, isLoading } = useSearch(params);

  if (isLoading) return <div>加载中...</div>;

  return (
    <div>
      <h1>找到 {data?.total} 个结果</h1>
      {data?.items.map(item => (
        <div key={item.id}>{/* 渲染结果 */}</div>
      ))}
    </div>
  );
}
```

### 步骤 3: 添加高级筛选（可选）

```tsx
import { SearchFilters } from '@/features/search';

export default function SearchPage() {
  const [filters, setFilters] = useState({});

  return (
    <div>
      <SearchBar />
      <SearchFilters 
        filters={filters} 
        onFiltersChange={setFilters} 
      />
      {/* 搜索结果 */}
    </div>
  );
}
```

## 📦 完整示例

### 基础搜索页面

```tsx
'use client';

import { useState } from 'react';
import {
  SearchBar,
  SearchResults,
  SearchFilters,
  useSearch,
  SearchParamsBuilder,
  type SearchFilters as SearchFiltersType,
} from '@/features/search';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFiltersType>({});

  const params = new SearchParamsBuilder(query)
    .withFilters(filters)
    .build();

  const { data, isLoading } = useSearch(params);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 搜索栏 */}
      <SearchBar 
        defaultValue={query}
        onSearch={setQuery}
        size="lg"
      />

      {/* 筛选器 */}
      <div className="my-6">
        <SearchFilters 
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      {/* 结果 */}
      <SearchResults 
        items={data?.items || []}
        isLoading={isLoading}
      />
    </div>
  );
}
```

### 导航栏搜索

```tsx
import { SearchBar } from '@/features/search';

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center gap-4 px-4 py-3">
        <Logo />
        <SearchBar 
          size="sm"
          placeholder="搜索..."
          showHistory={false}
        />
        <Navigation />
      </div>
    </header>
  );
}
```

## 🎯 常见使用场景

### 1. 仅搜索特定类型

```tsx
import { SearchBar, SearchType } from '@/features/search';

// 仅搜索帖子
<SearchBar type={SearchType.POST} placeholder="搜索帖子..." />

// 仅搜索适配器
<SearchBar type={SearchType.ADAPTER} placeholder="搜索适配器..." />
```

### 2. 自定义搜索处理

```tsx
<SearchBar 
  onSearch={(query) => {
    console.log('搜索:', query);
    // 自定义处理逻辑
  }}
/>
```

### 3. 显示搜索历史

```tsx
import { SearchHistory } from '@/features/search';

<SearchHistory 
  maxItems={10}
  onSelect={(query, type) => {
    // 处理历史项点击
    console.log('选择历史:', query, type);
  }}
/>
```

### 4. 热门搜索

```tsx
import { useTrendingSearch } from '@/features/search';

function TrendingWidget() {
  const { data: trending } = useTrendingSearch(5);

  return (
    <div>
      <h3>热门搜索</h3>
      {trending?.map(item => (
        <div key={item.rank}>{item.query}</div>
      ))}
    </div>
  );
}
```

## 🔧 配置选项

### SearchBar Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `placeholder` | `string` | `"搜索帖子、适配器、角色..."` | 占位符文本 |
| `defaultValue` | `string` | `""` | 默认搜索词 |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | 尺寸 |
| `showSuggestions` | `boolean` | `true` | 显示搜索建议 |
| `showHistory` | `boolean` | `true` | 显示搜索历史 |
| `showTrending` | `boolean` | `true` | 显示热门搜索 |
| `type` | `SearchType` | `undefined` | 搜索类型 |
| `onSearch` | `(query: string) => void` | `undefined` | 搜索回调 |

### SearchFilters Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `filters` | `SearchFilters` | 当前筛选器 |
| `onFiltersChange` | `(filters: SearchFilters) => void` | 筛选器变更回调 |
| `showTypeFilter` | `boolean` | 是否显示类型筛选 |

### useSearch Hook

```tsx
const { data, isLoading, error } = useSearch(params, {
  enabled: true,           // 是否启用查询
  saveToHistory: true,     // 是否保存到历史
  onSuccess: (data) => {}, // 成功回调
  onError: (error) => {},  // 错误回调
});
```

## 🎨 样式自定义

所有组件都支持 `className` prop：

```tsx
<SearchBar className="my-custom-class" />
<SearchResults className="my-custom-results" />
<SearchFilters className="my-custom-filters" />
```

组件使用 Tailwind CSS 和 Shadcn/ui，可以通过主题配置进行全局样式调整。

## 📱 响应式设计

所有组件都是响应式的，在移动端会自动调整布局。

移动端搜索示例：

```tsx
import { SearchBar } from '@/features/search';

export function MobileHeader() {
  return (
    <div className="md:hidden">
      <SearchBar size="sm" />
    </div>
  );
}
```

## 🔍 高级用法

### 构建复杂的搜索参数

```tsx
import { SearchParamsBuilder, SearchType, SearchSortBy, SearchSortOrder } from '@/features/search';

const params = new SearchParamsBuilder('react hooks')
  .withType(SearchType.POST)
  .withFilters({
    tags: ['tutorial', 'beginner'],
    dateRange: {
      from: new Date('2024-01-01'),
      to: new Date('2024-12-31'),
    },
    verifiedOnly: true,
  })
  .withSorting(SearchSortBy.POPULARITY, SearchSortOrder.DESC)
  .withPagination(1, 20)
  .build();

const { data } = useSearch(params);
```

### 缓存管理

```tsx
import { useInvalidateSearch } from '@/features/search';

function MyComponent() {
  const { invalidateAll, invalidateSearch } = useInvalidateSearch();

  const handleRefresh = () => {
    invalidateAll(); // 清空所有搜索缓存
  };

  return <button onClick={handleRefresh}>刷新</button>;
}
```

## 🐛 故障排除

### 问题：搜索建议不显示

**解决方案**：
1. 确保查询长度 ≥ 2 个字符
2. 检查 `showSuggestions` 是否为 `true`
3. 检查后端 API 是否正常返回

### 问题：搜索历史不保存

**解决方案**：
1. 检查浏览器是否禁用了 localStorage
2. 确保 `saveToHistory` 选项为 `true`
3. 检查查询是否有效（长度 ≥ 2）

### 问题：页面跳转不工作

**解决方案**：
1. 确保 `/search` 页面已创建
2. 检查 Next.js 路由配置
3. 如需自定义跳转，使用 `onSearch` prop

## 📚 更多资源

- [完整文档](./README.md)
- [功能清单](./FEATURES.md)
- [使用示例](./examples/usage-examples.tsx)
- [API 参考](./README.md#api-参考)

## 💡 提示

1. **性能优化**：搜索使用了缓存，相同的搜索不会重复请求
2. **防抖处理**：搜索建议有 300ms 防抖，避免频繁请求
3. **历史限制**：搜索历史最多保存 20 条记录
4. **类型安全**：所有 API 都有完整的 TypeScript 类型定义

## 🎉 完成！

现在你已经掌握了搜索模块的基本用法。开始在你的项目中使用吧！

如有问题，请查看[完整文档](./README.md)或[常见问题](./README.md#常见问题)。

