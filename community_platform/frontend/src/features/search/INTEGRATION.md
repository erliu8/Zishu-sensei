# 搜索模块 - 集成指南

## 🔌 集成步骤

### 步骤 1: 验证依赖

确保项目中已安装以下依赖：

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "@tanstack/react-query": "^5.0.0",
    "lucide-react": "^0.0.0",
    "tailwindcss": "^3.0.0"
  }
}
```

Shadcn/ui 组件（通常已经在项目中）：
- `@/shared/components/ui/input`
- `@/shared/components/ui/button`
- `@/shared/components/ui/popover`
- `@/shared/components/ui/tabs`
- `@/shared/components/ui/select`
- `@/shared/components/ui/sheet`
- `@/shared/components/ui/card`
- `@/shared/components/ui/badge`
- `@/shared/components/ui/checkbox`
- `@/shared/components/ui/slider`
- `@/shared/components/ui/label`
- `@/shared/components/ui/separator`
- `@/shared/components/ui/skeleton`
- `@/shared/components/ui/alert-dialog`
- `@/shared/components/ui/pagination`

### 步骤 2: 验证工具函数

确保以下工具函数存在：

```typescript
// @/shared/utils/cn
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```typescript
// @/shared/hooks/useDebounce
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

### 步骤 3: 配置 TanStack Query

在你的根布局中确保已配置 QueryClientProvider：

```tsx
// app/layout.tsx 或 app/providers.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 分钟
      gcTime: 5 * 60 * 1000, // 5 分钟
    },
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

### 步骤 4: 配置后端 API

搜索模块需要以下后端 API 端点：

#### 1. 搜索接口

```
GET /api/search
```

查询参数：
- `q`: 搜索关键词（必需）
- `type`: 搜索类型（all, post, adapter, character, user）
- `page`: 页码
- `pageSize`: 每页数量
- `sortBy`: 排序方式
- `sortOrder`: 排序顺序（asc, desc）
- `categoryId`: 分类ID
- `tags`: 标签（逗号分隔）
- `dateFrom`: 开始日期
- `dateTo`: 结束日期
- `ratingMin`: 最小评分
- `ratingMax`: 最大评分
- `verifiedOnly`: 仅已验证
- `featuredOnly`: 仅特色

响应格式：
```json
{
  "data": {
    "items": [
      {
        "type": "post",
        "id": "1",
        "title": "示例帖子",
        "content": "内容...",
        "excerpt": "摘要...",
        "author": {
          "id": "1",
          "username": "user1",
          "avatar": "https://..."
        },
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z",
        "viewCount": 100,
        "likeCount": 10,
        "commentCount": 5,
        "tags": ["tag1", "tag2"],
        "thumbnail": "https://...",
        "highlight": {
          "title": ["示例<em>帖子</em>"],
          "content": ["这是内容中的<em>匹配</em>文本"]
        }
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5,
    "took": 123,
    "suggestions": ["react hooks", "react tutorial"]
  }
}
```

#### 2. 搜索建议接口

```
GET /api/search/suggestions?q={query}&type={type}
```

响应格式：
```json
{
  "data": {
    "suggestions": [
      {
        "text": "react hooks",
        "type": "post"
      },
      {
        "text": "react tutorial",
        "type": "post"
      }
    ]
  }
}
```

#### 3. 热门搜索接口

```
GET /api/search/trending?limit={limit}
```

响应格式：
```json
{
  "data": {
    "trending": [
      {
        "query": "react",
        "type": "post",
        "count": 1000,
        "rank": 1,
        "rankChange": 2
      }
    ]
  }
}
```

### 步骤 5: 更新 API Base URL（如需要）

如果你的 API 不在默认路径 `/api`，需要更新 SearchApiClient：

```typescript
// src/features/search/api/search.api.ts
export const searchApiClient = new SearchApiClient('/your-api-base-url');
```

或在使用时传入：

```typescript
import { SearchApiClient } from '@/features/search';

const customClient = new SearchApiClient('https://api.example.com');
```

### 步骤 6: 添加到导航栏

在你的导航栏或头部组件中添加搜索栏：

```tsx
// components/Header.tsx
import { SearchBar } from '@/features/search';

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center gap-4 px-4 py-3">
        <Logo />
        <SearchBar 
          size="sm"
          placeholder="搜索..."
        />
        <Navigation />
      </div>
    </header>
  );
}
```

### 步骤 7: 验证搜索结果页

确保 `/search` 页面可以正常访问：

```
http://localhost:3000/search?q=test
```

## 🔧 可选配置

### 自定义搜索结果页

如果需要自定义搜索结果页面的样式或布局：

```tsx
// app/(main)/search/page.tsx
// 修改现有页面或创建新的页面组件
```

### 添加到其他页面

在特定页面添加搜索功能：

```tsx
// app/(main)/posts/page.tsx
import { SearchBar, SearchType } from '@/features/search';

export default function PostsPage() {
  return (
    <div>
      <h1>帖子列表</h1>
      <SearchBar 
        type={SearchType.POST}
        placeholder="搜索帖子..."
      />
      {/* 其他内容 */}
    </div>
  );
}
```

### 自定义样式

通过 Tailwind CSS 类名自定义样式：

```tsx
<SearchBar className="max-w-2xl mx-auto" />
```

或通过 CSS 变量（在 globals.css 中）：

```css
:root {
  --search-bar-height: 2.5rem;
  --search-results-max-height: 400px;
}
```

## 🧪 测试集成

### 1. 测试基础搜索

```tsx
// 在浏览器中测试
1. 访问 http://localhost:3000
2. 在搜索栏输入 "test"
3. 应该看到搜索建议
4. 按 Enter 跳转到搜索结果页
```

### 2. 测试搜索历史

```tsx
1. 执行几次搜索
2. 再次点击搜索栏
3. 应该看到搜索历史
4. 点击历史项应该执行该搜索
```

### 3. 测试筛选器

```tsx
1. 在搜索结果页点击"筛选"按钮
2. 选择筛选条件
3. 点击"应用筛选"
4. 结果应该根据筛选条件更新
```

## 🐛 故障排除

### 问题 1: 搜索建议不显示

**可能原因**：
- 后端 API 未实现
- API 返回格式不正确
- 网络请求失败

**解决方案**：
1. 检查浏览器控制台的网络请求
2. 验证 API 响应格式
3. 检查 CORS 设置

### 问题 2: 搜索结果页面 404

**可能原因**：
- 页面文件路径不正确
- Next.js 路由未正确配置

**解决方案**：
1. 确保文件在 `src/app/(main)/search/page.tsx`
2. 重启开发服务器
3. 检查 Next.js 配置

### 问题 3: 样式不正确

**可能原因**：
- Shadcn/ui 组件未安装
- Tailwind CSS 未配置

**解决方案**：
1. 安装缺失的 Shadcn/ui 组件
2. 检查 `tailwind.config.js`
3. 确保导入了全局样式

### 问题 4: TypeScript 类型错误

**可能原因**：
- 路径别名未配置
- TypeScript 配置不正确

**解决方案**：
1. 检查 `tsconfig.json` 中的 paths 配置：
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```
2. 重启 TypeScript 服务器

## 📱 移动端集成

### 响应式搜索栏

搜索栏已经是响应式的，但可以进一步优化：

```tsx
// 桌面端使用标准尺寸，移动端使用小尺寸
<SearchBar 
  size={isMobile ? 'sm' : 'md'}
  className="w-full md:w-auto"
/>
```

### 移动端全屏搜索

```tsx
import { useState } from 'react';
import { SearchBar } from '@/features/search';

export function MobileHeader() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsSearchOpen(true)}>
        搜索
      </button>
      
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="p-4">
            <SearchBar 
              onSearch={() => setIsSearchOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
```

## 🔒 安全考虑

### 1. XSS 防护

搜索结果高亮使用 `dangerouslySetInnerHTML`，确保后端返回的 HTML 是安全的：

```typescript
// 后端应该使用白名单标签（只允许 <em>）
const sanitizedHighlight = sanitize(rawHighlight, {
  allowedTags: ['em'],
  allowedAttributes: {}
});
```

### 2. SQL 注入防护

确保后端搜索查询使用参数化查询，不要直接拼接 SQL。

### 3. 速率限制

建议在后端添加搜索 API 的速率限制：
- 每用户每分钟最多 60 次搜索
- 每 IP 每分钟最多 100 次搜索

## 📊 监控与分析

### 添加搜索分析

```tsx
import { useSearch } from '@/features/search';
import { trackEvent } from '@/analytics';

const { data } = useSearch(params, {
  onSuccess: (result) => {
    // 记录搜索事件
    trackEvent('search', {
      query: params.query,
      type: params.type,
      resultCount: result.total,
      took: result.took,
    });
  },
});
```

### 监控搜索性能

```tsx
// 在搜索结果页添加性能监控
useEffect(() => {
  if (searchResult) {
    // 记录搜索耗时
    console.log(`搜索耗时: ${searchResult.took}ms`);
    
    // 如果搜索太慢，发送警告
    if (searchResult.took > 1000) {
      console.warn('搜索响应时间过长');
    }
  }
}, [searchResult]);
```

## ✅ 集成检查清单

完成以下检查以确保集成成功：

- [ ] 所有依赖已安装
- [ ] Shadcn/ui 组件可用
- [ ] TanStack Query 已配置
- [ ] 后端 API 已实现
- [ ] API 响应格式正确
- [ ] 搜索栏已添加到导航栏
- [ ] 搜索结果页可访问
- [ ] 搜索建议正常工作
- [ ] 搜索历史正常工作
- [ ] 热门搜索正常工作
- [ ] 筛选器正常工作
- [ ] 分页正常工作
- [ ] 移动端显示正常
- [ ] 无控制台错误
- [ ] 无 TypeScript 错误

## 🎉 完成！

集成完成后，你应该有一个功能完整的搜索系统。

如有问题，请参考：
- [快速开始指南](./QUICKSTART.md)
- [完整文档](./README.md)
- [常见问题](./README.md#常见问题)

---

**祝你使用愉快！** 🚀

