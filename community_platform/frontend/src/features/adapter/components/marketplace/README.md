# 适配器市场组件

## 概述

适配器市场组件提供了完整的适配器浏览、搜索、筛选和管理功能，支持三种适配器类型：

- 🧠 **软适配器** - 基于提示词工程和RAG技术
- ⚙️ **硬适配器** - 基于原生代码实现
- ✨ **智能硬适配器** - 基于专业微调模型

## 组件列表

### 主组件

#### AdapterMarket
适配器市场的主组件，整合了所有功能。

```tsx
import { AdapterMarket } from '@/features/adapter/components/marketplace';

<AdapterMarket
  onFetchAdapters={async (params) => {
    // 获取适配器列表
    const response = await adapterApiClient.getAdapters(params);
    return {
      adapters: response.data,
      total: response.total
    };
  }}
  onFetchCategories={async () => {
    // 获取分类列表
    return await adapterCategoryApiClient.getCategories();
  }}
  onFetchFeatured={async () => {
    // 获取推荐适配器
    return await adapterApiClient.getFeaturedAdapters();
  }}
  onDownload={(adapter) => {
    // 处理下载
    console.log('Download:', adapter);
  }}
/>
```

### 子组件

#### AdapterCard
适配器卡片，用于展示单个适配器信息。

```tsx
import { AdapterCard } from '@/features/adapter/components/marketplace';

<AdapterCard
  adapter={adapter}
  variant="default" // 'default' | 'compact' | 'detailed'
  featured={true}
  onDownload={handleDownload}
  onFavorite={handleFavorite}
  onLike={handleLike}
/>
```

**Props:**
- `adapter`: 适配器数据
- `variant`: 显示模式
  - `default`: 标准模式
  - `compact`: 紧凑模式（适合小屏幕）
  - `detailed`: 详细模式（显示更多信息）
- `featured`: 是否显示推荐标签
- `isNew`: 是否显示新品标签

#### AdapterList
适配器列表，支持网格和列表视图。

```tsx
import { AdapterList } from '@/features/adapter/components/marketplace';

<AdapterList
  adapters={adapters}
  loading={loading}
  viewMode="grid" // 'grid' | 'list'
  cardVariant="default"
  onDownload={handleDownload}
/>
```

#### CategoryFilter
分类筛选组件。

```tsx
import { CategoryFilter } from '@/features/adapter/components/marketplace';

<CategoryFilter
  categories={categories}
  selectedCategoryId={selectedId}
  onCategoryChange={handleCategoryChange}
  showCount={true}
/>
```

#### MarketSearchBar
搜索栏组件，支持搜索建议。

```tsx
import { MarketSearchBar } from '@/features/adapter/components/marketplace';

<MarketSearchBar
  value={searchQuery}
  onChange={setSearchQuery}
  onSearch={handleSearch}
  onGetSuggestions={async (query) => {
    const suggestions = await adapterApiClient.getSearchSuggestions(query);
    return suggestions;
  }}
  showSuggestions={true}
  trendingSearches={['数据分析', 'Excel', 'PowerPoint']}
/>
```

#### SortOptions
排序选项组件。

```tsx
import { SortOptions } from '@/features/adapter/components/marketplace';

<SortOptions
  sortBy="downloads"
  sortOrder="desc"
  onSortChange={(field, order) => {
    console.log(`Sort by ${field} ${order}`);
  }}
  variant="select" // 'select' | 'buttons'
/>
```

#### FeaturedAdapters
推荐适配器展示组件。

```tsx
import { FeaturedAdapters } from '@/features/adapter/components/marketplace';

<FeaturedAdapters
  adapters={featuredAdapters}
  variant="featured" // 'featured' | 'trending' | 'latest'
  maxItems={6}
  onViewMore={() => router.push('/adapters?featured=true')}
  onDownload={handleDownload}
/>
```

### 徽章组件

#### AdapterTypeBadge
适配器类型徽章。

```tsx
import { AdapterTypeBadge } from '@/features/adapter/components/marketplace';
import { AdapterType } from '@/features/adapter/domain';

<AdapterTypeBadge type={AdapterType.INTELLIGENT} showIcon={true} />
```

**支持的类型：**
- `AdapterType.SOFT` - 软适配器（蓝色）
- `AdapterType.HARD` - 硬适配器（灰色）
- `AdapterType.INTELLIGENT` - 智能硬适配器（渐变紫粉色）

#### CompatibilityBadge
兼容性徽章。

```tsx
import { CompatibilityBadge } from '@/features/adapter/components/marketplace';
import { CompatibilityLevel } from '@/features/adapter/domain';

<CompatibilityBadge level={CompatibilityLevel.FULL} />
```

#### CapabilityBadge
能力等级徽章。

```tsx
import { CapabilityBadge } from '@/features/adapter/components/marketplace';
import { CapabilityLevel } from '@/features/adapter/domain';

<CapabilityBadge level={CapabilityLevel.EXPERT} />
```

## 完整使用示例

### 在页面中使用

```tsx
// app/(main)/adapters/page.tsx
'use client';

import { useState } from 'react';
import { AdapterMarket } from '@/features/adapter/components/marketplace';
import { adapterApiClient, adapterCategoryApiClient } from '@/features/adapter/api';
import { useToast } from '@/shared/components/ui/use-toast';

export default function AdaptersPage() {
  const { toast } = useToast();

  const handleDownload = async (adapter: Adapter) => {
    try {
      const downloadUrl = await adapterApiClient.downloadAdapter(adapter.id);
      window.open(downloadUrl, '_blank');
      
      toast({
        title: '下载成功',
        description: `正在下载 ${adapter.displayName}`,
      });
    } catch (error) {
      toast({
        title: '下载失败',
        description: '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const handleFavorite = async (adapter: Adapter) => {
    try {
      if (adapter.isFavorited) {
        await adapterApiClient.unfavoriteAdapter(adapter.id);
        toast({ title: '已取消收藏' });
      } else {
        await adapterApiClient.favoriteAdapter(adapter.id);
        toast({ title: '收藏成功' });
      }
    } catch (error) {
      toast({
        title: '操作失败',
        variant: 'destructive',
      });
    }
  };

  const handleLike = async (adapter: Adapter) => {
    try {
      if (adapter.isLiked) {
        await adapterApiClient.unlikeAdapter(adapter.id);
      } else {
        await adapterApiClient.likeAdapter(adapter.id);
      }
    } catch (error) {
      console.error('Failed to like adapter:', error);
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">适配器市场</h1>
        <p className="mt-2 text-muted-foreground">
          探索和下载各种类型的适配器，增强你的 AI 助手能力
        </p>
      </div>

      <AdapterMarket
        onFetchAdapters={async (params) => {
          const response = await adapterApiClient.getAdapters(params);
          return {
            adapters: response.data,
            total: response.total,
          };
        }}
        onFetchCategories={async () => {
          return await adapterCategoryApiClient.getCategories();
        }}
        onFetchFeatured={async () => {
          return await adapterApiClient.getFeaturedAdapters();
        }}
        onFetchTrending={async () => {
          return await adapterApiClient.getTrendingAdapters();
        }}
        onFetchLatest={async () => {
          return await adapterApiClient.getLatestAdapters();
        }}
        onDownload={handleDownload}
        onFavorite={handleFavorite}
        onLike={handleLike}
      />
    </div>
  );
}
```

### 使用单独组件

如果你只需要某个特定组件，可以单独导入：

```tsx
// 只使用适配器卡片
import { AdapterCard } from '@/features/adapter/components/marketplace';

function MyAdapterCard({ adapter }: { adapter: Adapter }) {
  return (
    <AdapterCard
      adapter={adapter}
      variant="compact"
      onDownload={(adapter) => {
        // 处理下载
      }}
    />
  );
}
```

```tsx
// 只使用搜索栏
import { MarketSearchBar } from '@/features/adapter/components/marketplace';

function MySearchBar() {
  const [query, setQuery] = useState('');
  
  return (
    <MarketSearchBar
      value={query}
      onChange={setQuery}
      onSearch={(value) => {
        console.log('Search:', value);
      }}
    />
  );
}
```

## 主题定制

所有组件都使用 Tailwind CSS 和 shadcn/ui，支持深色模式和主题定制。

### 自定义样式

```tsx
<AdapterCard
  adapter={adapter}
  className="border-2 border-primary hover:shadow-2xl"
/>
```

### 深色模式

组件自动支持深色模式，无需额外配置。

## 性能优化

### 虚拟滚动

对于大量适配器，建议使用虚拟滚动：

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

// 在 AdapterList 中实现虚拟滚动
```

### 图片懒加载

所有图片默认使用 Next.js Image 组件，自动实现懒加载。

### 数据缓存

使用 TanStack Query 进行数据缓存：

```tsx
import { useQuery } from '@tanstack/react-query';

function useAdapters(params: AdapterQueryParams) {
  return useQuery({
    queryKey: ['adapters', params],
    queryFn: () => adapterApiClient.getAdapters(params),
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}
```

## 可访问性

所有组件都遵循 WCAG 2.1 AA 标准：

- ✅ 键盘导航支持
- ✅ ARIA 标签完整
- ✅ 屏幕阅读器友好
- ✅ 颜色对比度达标

## 国际化

组件支持多语言（需配合 i18n 系统）：

```tsx
import { useTranslation } from 'next-intl';

function MyComponent() {
  const t = useTranslation('adapter');
  
  return (
    <AdapterCard
      // 使用翻译
    />
  );
}
```

## 常见问题

### 1. 如何实现无限滚动？

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';

function useInfiniteAdapters() {
  return useInfiniteQuery({
    queryKey: ['adapters'],
    queryFn: ({ pageParam = 1 }) => 
      adapterApiClient.getAdapters({ page: pageParam }),
    getNextPageParam: (lastPage) => 
      lastPage.hasNext ? lastPage.page + 1 : undefined,
  });
}
```

### 2. 如何自定义排序选项？

修改 `SortOptions.tsx` 中的 `SORT_OPTIONS` 数组。

### 3. 如何添加新的适配器类型？

1. 在 `adapter.types.ts` 中添加新类型
2. 在 `AdapterBadge.tsx` 中添加徽章配置
3. 更新相关组件

## 技术栈

- **框架**: React 18 + Next.js 14
- **样式**: Tailwind CSS + shadcn/ui
- **图标**: Lucide React
- **类型**: TypeScript
- **工具**: cn (className merger)

## 贡献

欢迎提交 Issue 和 Pull Request！

