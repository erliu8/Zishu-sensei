# 🚀 性能优化指南

本文档详细说明如何使用 Zishu 社区平台的性能优化功能。

---

## 📚 目录

1. [性能监控](#性能监控)
2. [代码分割与懒加载](#代码分割与懒加载)
3. [图片优化](#图片优化)
4. [缓存策略](#缓存策略)
5. [虚拟滚动](#虚拟滚动)
6. [资源预加载](#资源预加载)
7. [性能分析工具](#性能分析工具)
8. [最佳实践](#最佳实践)

---

## 性能监控

### Web Vitals 监控

在应用根组件中初始化 Web Vitals 监控：

```tsx
import { WebVitalsReporter } from '@/infrastructure/performance'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  )
}
```

### 使用性能监控 Hook

```tsx
import { usePerformanceMonitor } from '@/infrastructure/performance'

function MyComponent() {
  const { mark, measure } = usePerformanceMonitor()

  useEffect(() => {
    mark('component-mount')
    
    // 执行一些操作
    
    mark('component-ready')
    measure('component-init', 'component-mount', 'component-ready')
  }, [])
}
```

### 监控特定性能指标

```tsx
import { usePerformanceMetrics } from '@/infrastructure/performance'

function PerformanceMonitor() {
  const metrics = usePerformanceMetrics()

  return (
    <div>
      <p>FCP: {metrics.paint.fcp}ms</p>
      <p>LCP: {metrics.paint.lcp}ms</p>
      <p>CLS: {metrics.cls}</p>
      <p>Long Tasks: {metrics.longTasks}</p>
      <p>Resources: {metrics.resources.count}</p>
    </div>
  )
}
```

---

## 代码分割与懒加载

### 路由级别懒加载

```tsx
import { LazyPages } from '@/infrastructure/performance'

// 使用预定义的懒加载页面
function Router() {
  return (
    <Routes>
      <Route path="/posts" element={<LazyPages.PostListPage />} />
      <Route path="/posts/:id" element={<LazyPages.PostDetailPage />} />
    </Routes>
  )
}
```

### 组件级别懒加载

```tsx
import { LazyComponents } from '@/infrastructure/performance'

function PostEditor() {
  return (
    <div>
      {/* Markdown 编辑器按需加载 */}
      <LazyComponents.MarkdownEditor
        value={content}
        onChange={setContent}
      />
    </div>
  )
}
```

### 自定义懒加载组件

```tsx
import { createLazyComponent } from '@/infrastructure/performance'

const HeavyChart = createLazyComponent(
  () => import('@/components/HeavyChart'),
  {
    loading: () => <div>加载中...</div>,
    ssr: false, // 禁用 SSR
  }
)
```

### 预加载组件

```tsx
import { preloadComponent } from '@/infrastructure/performance'

function ProductList() {
  const handleMouseEnter = () => {
    // 鼠标悬停时预加载详情页组件
    preloadComponent(() => import('./ProductDetail'))
  }

  return (
    <div onMouseEnter={handleMouseEnter}>
      产品列表
    </div>
  )
}
```

---

## 图片优化

### 基础用法

```tsx
import { OptimizedImage } from '@/infrastructure/performance'

function ProductCard() {
  return (
    <OptimizedImage
      src="/images/product.jpg"
      alt="Product"
      width={800}
      height={600}
      quality={85}
      priority={false} // 非关键图片
      placeholder="shimmer" // 闪烁占位符
    />
  )
}
```

### 响应式图片

```tsx
import { ResponsiveImage } from '@/infrastructure/performance'

function HeroSection() {
  return (
    <ResponsiveImage
      src="/images/hero.jpg"
      alt="Hero"
      width={1920}
      height={1080}
      sources={[
        {
          srcSet: '/images/hero-mobile.webp',
          media: '(max-width: 768px)',
          type: 'image/webp',
        },
        {
          srcSet: '/images/hero-tablet.webp',
          media: '(max-width: 1024px)',
          type: 'image/webp',
        },
      ]}
      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
      priority // 关键图片优先加载
    />
  )
}
```

### 用户头像

```tsx
import { AvatarImage } from '@/infrastructure/performance'

function UserProfile({ user }) {
  return (
    <AvatarImage
      src={user.avatar}
      alt={user.name}
      size="lg" // sm, md, lg, xl
      fallback="/images/default-avatar.png"
    />
  )
}
```

### 渐进式加载

```tsx
import { ProgressiveImage } from '@/infrastructure/performance'

function Gallery() {
  return (
    <ProgressiveImage
      lowQualitySrc="/images/photo-low.jpg"
      highQualitySrc="/images/photo-high.jpg"
      alt="Photo"
      width={1200}
      height={800}
    />
  )
}
```

### 预加载图片

```tsx
import { imagePreloader } from '@/infrastructure/performance'

// 预加载单张图片
await imagePreloader.preload('/images/hero.jpg')

// 预加载多张图片
await imagePreloader.preloadMultiple([
  '/images/img1.jpg',
  '/images/img2.jpg',
  '/images/img3.jpg',
])

// 预加载关键图片
imagePreloader.preloadCritical()
```

---

## 缓存策略

### 使用缓存策略

```tsx
import { 
  CacheStrategy, 
  cacheExecutor 
} from '@/infrastructure/performance'

async function fetchUserData(userId: string) {
  return cacheExecutor.execute(
    {
      key: `user-${userId}`,
      strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
      ttl: 3600000, // 1小时
    },
    async () => {
      const response = await fetch(`/api/users/${userId}`)
      return response.json()
    }
  )
}
```

### 缓存策略类型

#### 1. 缓存优先 (Cache First)

适用于不经常变化的数据：

```tsx
const data = await cacheExecutor.execute(
  {
    key: 'static-data',
    strategy: CacheStrategy.CACHE_FIRST,
    ttl: 86400000, // 24小时
  },
  fetcher
)
```

#### 2. 网络优先 (Network First)

适用于需要最新数据，但允许降级到缓存：

```tsx
const data = await cacheExecutor.execute(
  {
    key: 'dynamic-data',
    strategy: CacheStrategy.NETWORK_FIRST,
    ttl: 300000, // 5分钟
  },
  fetcher
)
```

#### 3. SWR (Stale While Revalidate)

适用于大多数场景，提供最佳用户体验：

```tsx
const data = await cacheExecutor.execute(
  {
    key: 'posts-list',
    strategy: CacheStrategy.STALE_WHILE_REVALIDATE,
    ttl: 600000, // 10分钟
  },
  fetcher
)
```

### 直接使用缓存管理器

```tsx
import { cacheManager } from '@/infrastructure/performance'

// 设置缓存
await cacheManager.set('my-key', data, 3600000)

// 获取缓存
const data = await cacheManager.get('my-key')

// 删除缓存
await cacheManager.delete('my-key')

// 清空所有缓存
await cacheManager.clear()
```

### 缓存装饰器

```tsx
import { withCache, CacheStrategy } from '@/infrastructure/performance'

class UserService {
  @withCache({
    strategy: CacheStrategy.CACHE_FIRST,
    ttl: 3600000,
    keyGenerator: (userId: string) => `user-${userId}`,
  })
  async getUser(userId: string) {
    const response = await fetch(`/api/users/${userId}`)
    return response.json()
  }
}
```

---

## 虚拟滚动

### 虚拟列表

```tsx
import { VirtualScrollList } from '@/infrastructure/performance'

function PostList({ posts }) {
  return (
    <VirtualScrollList
      items={posts}
      renderItem={(post, index) => (
        <PostCard key={post.id} post={post} />
      )}
      config={{
        estimateSize: 200, // 估算每项高度
        overscan: 5, // 预渲染项数
      }}
      height="100vh"
      onLoadMore={loadMorePosts}
      isLoading={isLoading}
      loadingIndicator={<LoadingSpinner />}
    />
  )
}
```

### 虚拟网格

```tsx
import { VirtualGrid } from '@/infrastructure/performance'

function ImageGallery({ images }) {
  return (
    <VirtualGrid
      items={images}
      renderItem={(image) => (
        <img src={image.url} alt={image.title} />
      )}
      columns={3}
      rowHeight={300}
      gap={16}
      height="100vh"
      onLoadMore={loadMoreImages}
    />
  )
}
```

### 使用虚拟滚动 Hook

```tsx
import { useVirtualScroll } from '@/infrastructure/performance'

function CustomVirtualList({ items }) {
  const { parentRef, virtualItems, totalSize } = useVirtualScroll(items, {
    count: items.length,
    estimateSize: 100,
    overscan: 3,
  })

  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: `${totalSize}px`, position: 'relative' }}>
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index]}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 资源预加载

### 预加载关键资源

```tsx
import { criticalResourcePreloader } from '@/infrastructure/performance'

// 在应用启动时预加载所有关键资源
criticalResourcePreloader.preloadAll()

// 或者单独预加载
criticalResourcePreloader.preloadCriticalFonts()
criticalResourcePreloader.preloadCriticalImages()
criticalResourcePreloader.preconnectCriticalOrigins()
```

### 预加载字体

```tsx
import { resourcePreloader } from '@/infrastructure/performance'

resourcePreloader.preloadFont('/fonts/inter-var.woff2', 'font/woff2')
```

### 预加载脚本和样式

```tsx
resourcePreloader.preloadScript('/scripts/analytics.js')
resourcePreloader.preloadStyle('/styles/critical.css')
```

### DNS 预解析和预连接

```tsx
resourcePreloader.dnsPrefetch('https://api.zishu.ai')
resourcePreloader.preconnect('https://cdn.zishu.ai', true)
```

### 路由预加载

```tsx
import { routePreloader } from '@/infrastructure/performance'

// 预加载下一个可能访问的路由
routePreloader.prefetchRoute('/posts/123')

// 批量预加载
routePreloader.prefetchNextRoutes([
  '/profile',
  '/settings',
  '/notifications',
])

// 启用智能预加载（基于用户行为）
routePreloader.smartPrefetch()
```

### 延迟执行

```tsx
import { deferExecution } from '@/infrastructure/performance'

// 空闲时执行
deferExecution.idle(() => {
  // 非关键任务
  sendAnalytics()
})

// 可见时执行
deferExecution.onVisible(() => {
  // 页面可见时才执行
  loadNonCriticalData()
})

// 延迟执行
deferExecution.delay(() => {
  // 1秒后执行
  showTooltip()
}, 1000)
```

---

## 性能分析工具

### 运行性能检查

```bash
# 分析构建产物
npm run perf:check

# 运行 Lighthouse
npm run perf:lighthouse

# 生成 Bundle 分析报告
npm run analyze
```

### 性能检查脚本

`performance-check.js` 会：
- 分析 JavaScript 和 CSS 文件大小
- 检查是否超出性能预算
- 生成详细的性能报告

### Lighthouse CI

`lighthouse-ci.js` 会：
- 自动运行 Lighthouse 测试
- 检查性能分数是否达标
- 生成 HTML 和 JSON 报告

### Bundle 分析

```bash
# 生成可视化的 Bundle 分析报告
ANALYZE=true npm run build
```

---

## 最佳实践

### 1. 代码分割原则

- ✅ **路由级别分割**：每个路由独立打包
- ✅ **组件级别分割**：重量级组件按需加载
- ✅ **第三方库分割**：大型库独立打包
- ❌ **避免过度分割**：过多的小文件会增加 HTTP 请求

### 2. 图片优化原则

- ✅ 使用 WebP/AVIF 格式
- ✅ 提供响应式图片
- ✅ 关键图片使用 `priority`
- ✅ 非关键图片延迟加载
- ✅ 使用适当的质量设置（85 为推荐值）
- ❌ 避免加载超大尺寸的图片

### 3. 缓存策略选择

| 场景 | 推荐策略 | 说明 |
|------|---------|------|
| 静态内容 | Cache First | 图片、字体、CSS |
| 动态内容 | Network First | API 数据 |
| 用户数据 | SWR | 个人资料、设置 |
| 实时数据 | Network Only | 聊天消息、通知 |

### 4. 虚拟滚动使用场景

- ✅ 列表项 > 100
- ✅ 每项渲染成本高
- ✅ 列表会动态增长
- ❌ 列表项很少（< 20）
- ❌ 每项高度不固定且难以估算

### 5. 性能预算

| 指标 | 目标值 |
|------|--------|
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| TTFB | < 600ms |
| FCP | < 1.8s |
| TTI | < 3.8s |
| Bundle Size (gzipped) | < 200KB |

### 6. 关键渲染路径优化

```tsx
import { 
  WebVitalsReporter,
  criticalResourcePreloader,
} from '@/infrastructure/performance'

export default function RootLayout({ children }) {
  useEffect(() => {
    // 预加载关键资源
    criticalResourcePreloader.preloadAll()
    
    // 延迟加载非关键资源
    deferExecution.idle(() => {
      loadAnalytics()
      loadChatWidget()
    })
  }, [])

  return (
    <html>
      <head>
        {/* 关键 CSS 内联 */}
        <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
      </head>
      <body>
        <WebVitalsReporter />
        {children}
      </body>
    </html>
  )
}
```

### 7. 监控和持续优化

- ✅ 定期运行性能检查
- ✅ 监控 Web Vitals 指标
- ✅ 分析 Bundle 大小变化
- ✅ 进行真实用户监控 (RUM)
- ✅ A/B 测试性能优化效果

---

## 故障排查

### 性能问题诊断

1. **Bundle 过大**
   ```bash
   npm run analyze
   # 查看哪些包占用空间最大
   ```

2. **图片加载慢**
   - 检查图片格式（应使用 WebP）
   - 检查图片尺寸（不要超过实际显示尺寸）
   - 启用懒加载

3. **首屏加载慢**
   - 减少首屏 JavaScript
   - 使用代码分割
   - 预加载关键资源
   - 优化关键渲染路径

4. **滚动卡顿**
   - 使用虚拟滚动
   - 减少重绘和回流
   - 优化动画性能

---

## 相关资源

- [Web Vitals 文档](https://web.dev/vitals/)
- [Next.js 性能优化](https://nextjs.org/docs/advanced-features/measuring-performance)
- [React 性能优化](https://react.dev/learn/render-and-commit)
- [图片优化指南](https://web.dev/fast/#optimize-your-images)

---

**文档维护者**: Zishu Frontend Team  
**最后更新**: 2025-10-23

