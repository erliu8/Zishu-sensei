# 性能优化指南

本文档详细说明了 Zishu 社区平台前端的性能优化实现和最佳实践。

---

## 📊 性能指标目标

### Core Web Vitals

| 指标 | 目标值 | 说明 |
|------|--------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | 最大内容绘制时间 |
| **FID** (First Input Delay) | < 100ms | 首次输入延迟 |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 累积布局偏移 |

### 其他性能指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| **TTFB** (Time to First Byte) | < 600ms | 首字节时间 |
| **FCP** (First Contentful Paint) | < 1.8s | 首次内容绘制 |
| **TTI** (Time to Interactive) | < 3.8s | 可交互时间 |
| **Bundle Size** | < 200KB (gzipped) | 首屏 JS 包大小 |

### Lighthouse 分数

- **Performance**: ≥ 90
- **Accessibility**: ≥ 90
- **Best Practices**: ≥ 90
- **SEO**: ≥ 90

---

## 🖼️ 图片优化

### 1. 使用 OptimizedImage 组件

```tsx
import { OptimizedImage } from '@/infrastructure/performance';

<OptimizedImage
  src="/images/hero.jpg"
  alt="Hero Image"
  width={1200}
  height={600}
  quality={85}
  priority={true} // 关键图片优先加载
/>
```

### 2. 响应式图片

```tsx
import { ResponsiveImage } from '@/infrastructure/performance';

<ResponsiveImage
  src="/images/product.jpg"
  alt="Product"
  width={800}
  height={600}
  sources={[
    {
      srcSet: '/images/product-mobile.webp',
      media: '(max-width: 768px)',
      type: 'image/webp',
    },
    {
      srcSet: '/images/product-tablet.webp',
      media: '(max-width: 1024px)',
      type: 'image/webp',
    },
  ]}
  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>
```

### 3. 图片格式

- **优先使用 WebP**: 体积比 JPEG 小 25-35%
- **备选 AVIF**: 体积比 WebP 小 20%, 但浏览器支持较新
- **PNG**: 仅用于需要透明背景的图片

### 4. 图片尺寸

- **Thumbnail**: 最大 200x200, 质量 80
- **Medium**: 最大 800x800, 质量 85
- **Full**: 最大 1920x1920, 质量 90

---

## 📦 代码分割与懒加载

### 1. 路由级别代码分割

Next.js 自动进行路由级别的代码分割，每个页面都是独立的 chunk。

### 2. 组件级别懒加载

```tsx
import { LazyComponents } from '@/infrastructure/performance';

// 重量级组件懒加载
const MarkdownEditor = LazyComponents.MarkdownEditor;
const Chart = LazyComponents.Chart;

function MyPage() {
  return (
    <div>
      <MarkdownEditor />
      <Chart data={chartData} />
    </div>
  );
}
```

### 3. 动态导入

```tsx
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(
  () => import('@/components/HeavyComponent'),
  {
    loading: () => <LoadingSpinner />,
    ssr: false, // 不需要 SSR
  }
);
```

### 4. 预加载关键路由

```tsx
import { preloadCriticalRoutes } from '@/infrastructure/performance';

// 在应用初始化时调用
useEffect(() => {
  preloadCriticalRoutes();
}, []);
```

---

## 💾 缓存策略

### 1. HTTP 缓存

```typescript
import { cacheConfig } from '@/infrastructure/performance';

// 静态资源 - 1年
response.headers['Cache-Control'] = cacheConfig.static.images;

// API 响应 - 5分钟
response.headers['Cache-Control'] = cacheConfig.api.short;
```

### 2. TanStack Query 缓存

```typescript
import { moduleQueryConfig, queryKeys } from '@/infrastructure/cache/query-config';

// 使用预定义的缓存配置
const { data } = useQuery({
  queryKey: queryKeys.posts.list(filters),
  queryFn: fetchPosts,
  staleTime: moduleQueryConfig.posts.staleTime,
  gcTime: moduleQueryConfig.posts.gcTime,
});
```

### 3. IndexedDB 离线缓存

```typescript
import { indexedDBCache, STORES } from '@/infrastructure/performance';

// 缓存大型数据
await indexedDBCache.set(
  STORES.POSTS,
  postId,
  postData,
  60 * 60 * 1000 // 1小时
);

// 获取缓存数据
const post = await indexedDBCache.get(STORES.POSTS, postId);
```

---

## 🎯 虚拟滚动

### 1. 虚拟列表

```tsx
import { VirtualList } from '@/shared/components/common/VirtualList';

<VirtualList
  items={posts}
  renderItem={(post) => <PostCard post={post} />}
  itemHeight={200}
  overscan={5}
  onLoadMore={loadMore}
  hasMore={hasMore}
/>
```

### 2. 虚拟网格

```tsx
import { VirtualGrid } from '@/shared/components/common/VirtualList';

<VirtualGrid
  items={adapters}
  renderItem={(adapter) => <AdapterCard adapter={adapter} />}
  columns={3}
  rowHeight={300}
  gap={16}
/>
```

---

## 📊 性能监控

### 1. Web Vitals 监控

```typescript
import { performanceMonitor } from '@/infrastructure/performance';

// 自动监控 Web Vitals
// 指标会自动发送到 Google Analytics 和自定义服务
```

### 2. 性能标记

```typescript
import { PerformanceMark } from '@/infrastructure/performance';

// 标记开始
PerformanceMark.start('data-fetch');

// 执行操作
await fetchData();

// 标记结束（返回耗时）
const duration = PerformanceMark.end('data-fetch');
console.log(`数据获取耗时: ${duration}ms`);
```

### 3. 内存监控

```typescript
import { MemoryMonitor } from '@/infrastructure/performance';

// 获取内存使用情况
const usage = MemoryMonitor.getMemoryUsage();
console.log('内存使用:', usage);

// 持续监控
const stop = MemoryMonitor.monitorMemory(5000); // 每5秒检查
// 停止监控
stop();
```

---

## 📦 Bundle 分析

### 1. 分析 Bundle

```bash
# 生成 Bundle 分析报告
npm run analyze

# 查看报告
open .next/analyze/client.html
```

### 2. Bundle 大小预算

在 `bundle-analyzer.ts` 中配置了各类资源的大小预算：

```typescript
const bundleSizebudget = {
  pages: {
    home: 150 * 1024,    // 150KB
    list: 120 * 1024,    // 120KB
    detail: 100 * 1024,  // 100KB
    editor: 250 * 1024,  // 250KB
  },
  // ...
};
```

### 3. 运行性能检查

```bash
# 检查 Bundle 大小、依赖、未使用的导出等
npm run perf:check
```

---

## 🛠️ 优化技巧

### 1. 减少 JavaScript 包大小

#### Tree Shaking

确保所有依赖都支持 ES Modules：

```json
{
  "sideEffects": false
}
```

#### 按需导入

```typescript
// ❌ 不好 - 导入整个库
import _ from 'lodash';

// ✅ 好 - 只导入需要的函数
import debounce from 'lodash/debounce';
```

#### 移除未使用的依赖

```bash
# 检查未使用的依赖
npx depcheck

# 检查未使用的导出
npx ts-prune
```

### 2. 优化字体加载

```tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // 字体交换策略
  preload: true,
});
```

### 3. 使用 React.memo

```tsx
import { memo } from 'react';

const ExpensiveComponent = memo(({ data }) => {
  // 组件实现
});
```

### 4. 使用 useMemo 和 useCallback

```tsx
import { useMemo, useCallback } from 'react';

function MyComponent({ items }) {
  // 缓存计算结果
  const expensiveValue = useMemo(() => {
    return items.reduce((acc, item) => acc + item.value, 0);
  }, [items]);

  // 缓存回调函数
  const handleClick = useCallback(() => {
    console.log('Clicked');
  }, []);

  return <div>{expensiveValue}</div>;
}
```

### 5. 避免重排和重绘

```css
/* ❌ 不好 - 触发重排 */
.element {
  width: 100px;
  height: 100px;
}

/* ✅ 好 - 只触发重绘 */
.element {
  transform: scale(1.2);
  will-change: transform;
}
```

---

## 📈 性能优化 Checklist

### 图片优化

- [ ] 使用 OptimizedImage 组件
- [ ] 使用 WebP/AVIF 格式
- [ ] 配置响应式图片
- [ ] 关键图片设置 priority
- [ ] 懒加载非关键图片

### 代码优化

- [ ] 路由级别代码分割
- [ ] 组件级别懒加载
- [ ] 移除未使用的代码
- [ ] Tree Shaking 配置
- [ ] Bundle 大小在预算内

### 缓存策略

- [ ] HTTP 缓存配置
- [ ] TanStack Query 缓存配置
- [ ] IndexedDB 离线缓存
- [ ] Service Worker (PWA)

### 渲染优化

- [ ] 虚拟滚动（长列表）
- [ ] React.memo 优化
- [ ] useMemo/useCallback 优化
- [ ] 避免不必要的重渲染

### 性能监控

- [ ] Web Vitals 监控
- [ ] 错误监控（Sentry）
- [ ] 性能指标收集
- [ ] 定期性能审计

---

## 🔧 开发工具

### Chrome DevTools

1. **Performance 面板**: 录制和分析运行时性能
2. **Network 面板**: 分析资源加载
3. **Lighthouse**: 生成性能报告
4. **Coverage**: 检测未使用的代码

### VS Code 扩展

- **Bundle Size**: 显示导入模块的大小
- **Import Cost**: 显示导入成本
- **Performance Linter**: 性能相关的 ESLint 规则

### 命令行工具

```bash
# Lighthouse CLI
npx lighthouse https://example.com --view

# Bundle 分析
npm run analyze

# 性能检查
npm run perf:check

# 依赖检查
npx depcheck

# 未使用的导出
npx ts-prune
```

---

## 📚 相关资源

### 官方文档

- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Web Vitals](https://web.dev/vitals/)
- [React Performance](https://react.dev/learn/render-and-commit)

### 工具

- [web-vitals](https://github.com/GoogleChrome/web-vitals)
- [@next/bundle-analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)
- [TanStack Query](https://tanstack.com/query/latest)

---

## 📊 性能报告示例

### Lighthouse 报告

```
Performance Score: 95/100

Metrics:
- First Contentful Paint: 1.2s
- Largest Contentful Paint: 2.1s
- Total Blocking Time: 150ms
- Cumulative Layout Shift: 0.05
- Speed Index: 2.3s
```

### Bundle 分析报告

```
Total Bundle Size: 485KB (gzipped)

Breakdown:
- main.js: 178KB (37%)
- vendor.js: 245KB (50%)
- chunks/*.js: 62KB (13%)

Top 5 Packages:
1. react + react-dom: 132KB
2. @radix-ui/*: 45KB
3. @tanstack/react-query: 38KB
4. date-fns: 22KB
5. framer-motion: 18KB
```

---

**最后更新**: 2025-10-23  
**维护者**: Zishu Frontend Team

