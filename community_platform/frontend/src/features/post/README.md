# 帖子模块 (Post Module)

帖子数据层的完整实现，包括类型定义、API 客户端、React Query Hooks 和 Zustand 状态管理。

## 📁 目录结构

```
src/features/post/
├── domain/                 # 领域模型
│   ├── post.types.ts      # 类型定义
│   ├── post.validators.ts # 验证规则 (Zod)
│   └── index.ts
├── api/                   # API 客户端
│   ├── post-api.client.ts # PostApiClient
│   └── index.ts
├── hooks/                 # React Query Hooks
│   ├── query-keys.ts      # 查询键工厂
│   ├── use-posts.ts       # 获取帖子列表
│   ├── use-post.ts        # 获取单个帖子
│   ├── use-create-post.ts # 创建帖子
│   ├── use-update-post.ts # 更新帖子
│   ├── use-delete-post.ts # 删除帖子
│   ├── use-post-actions.ts # 点赞/收藏等操作
│   └── index.ts
├── store/                 # Zustand Store
│   ├── post.store.ts      # 状态管理
│   └── index.ts
├── index.ts              # 统一导出
└── README.md             # 本文档
```

## 🚀 快速开始

### 1. 获取帖子列表

```tsx
import { usePosts } from '@/features/post';

function PostListPage() {
  const { data, isLoading, error } = usePosts({
    page: 1,
    pageSize: 20,
    category: 'general',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>加载失败: {error.message}</div>;

  return (
    <div>
      {data.data.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
```

### 2. 获取单个帖子详情

```tsx
import { usePost } from '@/features/post';

function PostDetailPage({ id }: { id: string }) {
  const { data: post, isLoading } = usePost(id);

  if (isLoading) return <div>加载中...</div>;
  if (!post) return <div>帖子不存在</div>;

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}
```

### 3. 创建帖子

```tsx
import { useCreatePost, PostCategory } from '@/features/post';

function CreatePostForm() {
  const createPost = useCreatePost();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createPost.mutateAsync({
      title: '我的第一篇帖子',
      content: '这是帖子内容...',
      category: PostCategory.GENERAL,
      tagIds: ['tag-1', 'tag-2'],
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* 表单字段 */}
      <button type="submit" disabled={createPost.isPending}>
        {createPost.isPending ? '发布中...' : '发布'}
      </button>
    </form>
  );
}
```

### 4. 更新帖子

```tsx
import { useUpdatePost } from '@/features/post';

function EditPostForm({ postId }: { postId: string }) {
  const updatePost = useUpdatePost();

  const handleSubmit = async (data: UpdatePostDto) => {
    await updatePost.mutateAsync({
      id: postId,
      data,
    });
  };

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

### 5. 删除帖子

```tsx
import { useDeletePost } from '@/features/post';
import { useRouter } from 'next/navigation';

function DeletePostButton({ postId }: { postId: string }) {
  const deletePost = useDeletePost();
  const router = useRouter();

  const handleDelete = async () => {
    if (confirm('确定要删除这篇帖子吗？')) {
      await deletePost.mutateAsync(postId);
      router.push('/posts');
    }
  };

  return (
    <button onClick={handleDelete} disabled={deletePost.isPending}>
      删除
    </button>
  );
}
```

### 6. 点赞和收藏

```tsx
import { useToggleLike, useToggleFavorite } from '@/features/post';

function PostActions({ post }: { post: Post }) {
  const { toggle: toggleLike, isLoading: isLiking } = useToggleLike();
  const { toggle: toggleFavorite, isLoading: isFavoriting } = useToggleFavorite();

  return (
    <div>
      <button
        onClick={() => toggleLike(post.id, post.isLikedByCurrentUser)}
        disabled={isLiking}
      >
        {post.isLikedByCurrentUser ? '已点赞' : '点赞'} ({post.stats.likeCount})
      </button>
      
      <button
        onClick={() => toggleFavorite(post.id, post.isFavoritedByCurrentUser)}
        disabled={isFavoriting}
      >
        {post.isFavoritedByCurrentUser ? '已收藏' : '收藏'}
      </button>
    </div>
  );
}
```

### 7. 使用 Zustand Store

```tsx
import { usePostStore, postStoreSelectors } from '@/features/post';

function PostFilters() {
  const viewMode = usePostStore(postStoreSelectors.viewMode);
  const setViewMode = usePostStore((state) => state.setViewMode);
  const selectedCategory = usePostStore(postStoreSelectors.selectedCategory);
  const setSelectedCategory = usePostStore((state) => state.setSelectedCategory);

  return (
    <div>
      <div>
        <button onClick={() => setViewMode('grid')}>网格视图</button>
        <button onClick={() => setViewMode('list')}>列表视图</button>
      </div>
      
      <select
        value={selectedCategory || ''}
        onChange={(e) => setSelectedCategory(e.target.value as any)}
      >
        <option value="">全部分类</option>
        <option value="general">常规</option>
        <option value="tutorial">教程</option>
        {/* ... */}
      </select>
    </div>
  );
}
```

### 8. 草稿功能

```tsx
import { usePostStore } from '@/features/post';
import { useEffect } from 'react';

function PostEditor({ draftId }: { draftId: string }) {
  const saveDraft = usePostStore((state) => state.saveDraft);
  const loadDraft = usePostStore((state) => state.loadDraft);
  const deleteDraft = usePostStore((state) => state.deleteDraft);

  const [formData, setFormData] = useState({});

  // 加载草稿
  useEffect(() => {
    const draft = loadDraft(draftId);
    if (draft) {
      setFormData(draft);
    }
  }, [draftId]);

  // 自动保存草稿
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(draftId, formData);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [formData, draftId]);

  const handlePublish = () => {
    // 发布后删除草稿
    deleteDraft(draftId);
  };

  return <form>{/* ... */}</form>;
}
```

## 📚 API 参考

### Domain Types

#### `Post`
帖子实体，包含所有帖子信息。

#### `PostStatus`
帖子状态枚举：`DRAFT`, `PUBLISHED`, `ARCHIVED`, `DELETED`

#### `PostCategory`
帖子分类枚举：`GENERAL`, `TUTORIAL`, `SHOWCASE`, `QUESTION`, `DISCUSSION`, `NEWS`

#### `CreatePostDto`
创建帖子的数据传输对象。

#### `UpdatePostDto`
更新帖子的数据传输对象。

#### `PostQueryParams`
帖子查询参数。

### Hooks

#### `usePosts(params?, enabled?)`
获取帖子列表。

#### `usePost(id, enabled?)`
获取单个帖子详情。

#### `useCreatePost()`
创建帖子 mutation。

#### `useUpdatePost()`
更新帖子 mutation。

#### `useDeletePost()`
删除帖子 mutation。

#### `useLikePost()` / `useUnlikePost()`
点赞/取消点赞 mutation。

#### `useFavoritePost()` / `useUnfavoritePost()`
收藏/取消收藏 mutation。

#### `useToggleLike()`
切换点赞状态的便捷 Hook。

#### `useToggleFavorite()`
切换收藏状态的便捷 Hook。

### Store

#### `usePostStore`
Zustand store，管理帖子相关的 UI 状态。

#### State
- `viewMode`: 视图模式 (`'grid'` | `'list'`)
- `selectedCategory`: 选中的分类
- `searchQuery`: 搜索关键词
- `sortBy`: 排序字段
- `sortOrder`: 排序方向
- `selectedPost`: 当前选中的帖子
- `isEditorOpen`: 编辑器是否打开
- `editingPost`: 正在编辑的帖子
- `drafts`: 草稿数据

#### Actions
- `setViewMode(mode)`: 设置视图模式
- `setSelectedCategory(category)`: 设置选中的分类
- `setSearchQuery(query)`: 设置搜索关键词
- `setSortBy(sortBy)`: 设置排序字段
- `setSortOrder(order)`: 设置排序方向
- `toggleSortOrder()`: 切换排序方向
- `setSelectedPost(post)`: 设置选中的帖子
- `openEditor(post?)`: 打开编辑器
- `closeEditor()`: 关闭编辑器
- `saveDraft(id, draft)`: 保存草稿
- `loadDraft(id)`: 加载草稿
- `deleteDraft(id)`: 删除草稿
- `clearDrafts()`: 清空所有草稿
- `getQueryParams()`: 获取查询参数
- `reset()`: 重置状态

## ✨ 特性

### 1. 类型安全
- 完整的 TypeScript 类型定义
- Zod 运行时验证

### 2. 乐观更新
- 点赞、收藏等操作使用乐观更新
- 提供即时反馈，提升用户体验

### 3. 自动缓存失效
- 增删改操作自动使相关缓存失效
- 确保数据一致性

### 4. 错误处理
- 统一的错误处理
- Toast 通知提示

### 5. 状态持久化
- 视图偏好保存到 localStorage
- 草稿自动保存

### 6. 性能优化
- Query Key 工厂避免重复计算
- Zustand Selectors 优化渲染

## 🔧 配置

### TanStack Query 配置

在 `app/providers.tsx` 中配置：

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 分钟
      gcTime: 1000 * 60 * 30, // 30 分钟
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

## 🧪 测试

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePosts } from '@/features/post';

describe('usePosts', () => {
  it('should fetch posts', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => usePosts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });
});
```

## 📝 最佳实践

1. **使用 Query Keys 工厂**：始终使用 `POST_QUERY_KEYS` 而不是手动构建查询键
2. **乐观更新**：对用户交互频繁的操作使用乐观更新
3. **错误处理**：在 mutation 中处理错误并显示友好提示
4. **类型安全**：充分利用 TypeScript 类型推导
5. **状态分离**：服务器状态用 TanStack Query，UI 状态用 Zustand
6. **选择器优化**：使用 Zustand selectors 避免不必要的重渲染

## 🔗 相关文档

- [TanStack Query 文档](https://tanstack.com/query/latest)
- [Zustand 文档](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Zod 文档](https://zod.dev/)

---

**维护者**: Zishu Frontend Team  
**最后更新**: 2025-10-23

