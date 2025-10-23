# 帖子 UI 组件

帖子模块的 UI 组件集合，提供完整的帖子展示、编辑和交互功能。

## 组件列表

### PostCard - 帖子卡片

用于在列表中展示帖子摘要信息的卡片组件。

**特性:**
- 支持封面图片
- 作者信息展示
- 分类和标签
- 统计数据（浏览、点赞、评论）
- 快捷操作（点赞、收藏、分享）
- 三种显示模式：default、compact、featured

**使用示例:**

```tsx
import { PostCard } from '@/features/post';

<PostCard
  post={post}
  locale="zh-CN"
  variant="default"
  onLike={(postId) => console.log('点赞:', postId)}
  onFavorite={(postId) => console.log('收藏:', postId)}
  onShare={(postId) => console.log('分享:', postId)}
/>
```

---

### PostList - 帖子列表

支持虚拟滚动的帖子列表组件，可优化大量数据的渲染性能。

**特性:**
- 虚拟滚动支持（自动启用于 20+ 条数据）
- 无限加载
- 三种布局：default（列表）、compact（紧凑）、grid（网格）
- 空状态展示
- 加载状态

**使用示例:**

```tsx
import { PostList } from '@/features/post';

<PostList
  posts={posts}
  loading={isLoading}
  hasMore={hasMore}
  onLoadMore={loadMorePosts}
  variant="grid"
  enableVirtualization={true}
  onLike={handleLike}
  onFavorite={handleFavorite}
  onShare={handleShare}
/>
```

---

### PostDetail - 帖子详情

完整展示帖子内容的详情组件。

**特性:**
- 完整的帖子内容展示
- Markdown 渲染
- 作者信息和简介
- 详细统计数据
- 操作按钮集成
- SEO 友好的元数据

**使用示例:**

```tsx
import { PostDetail } from '@/features/post';

<PostDetail
  post={post}
  locale="zh-CN"
  isLiked={isLiked}
  isFavorited={isFavorited}
  isAuthor={isAuthor}
  onLike={handleLike}
  onFavorite={handleFavorite}
  onShare={handleShare}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onReport={handleReport}
/>
```

---

### PostEditor - 帖子编辑器

功能完整的帖子创建/编辑器，支持 Markdown 和富文本。

**特性:**
- Markdown 编辑支持
- 实时预览
- 表单验证（基于 Zod）
- 分类和标签选择
- 封面图片
- 发布状态控制
- 字数统计

**使用示例:**

```tsx
import { PostEditor } from '@/features/post';

<PostEditor
  mode="create"
  categories={categories}
  tags={tags}
  onSave={async (data) => {
    await createPost(data);
  }}
  onCancel={() => router.back()}
/>

// 编辑模式
<PostEditor
  mode="edit"
  initialData={post}
  categories={categories}
  tags={tags}
  onSave={async (data) => {
    await updatePost(data);
  }}
/>
```

---

### PostActions - 帖子操作

提供点赞、收藏、分享、编辑、删除等操作的组件。

**特性:**
- 点赞功能（带状态）
- 收藏功能（带状态）
- 分享功能（支持 Web Share API）
- 编辑/删除（作者专属）
- 举报功能
- 复制链接
- 删除确认对话框

**使用示例:**

```tsx
import { PostActions } from '@/features/post';

<PostActions
  postId={post.id}
  isLiked={isLiked}
  isFavorited={isFavorited}
  isAuthor={isAuthor}
  likesCount={post.stats.likes}
  onLike={handleLike}
  onFavorite={handleFavorite}
  onShare={handleShare}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onReport={handleReport}
  variant="default"
/>
```

---

### PostStats - 帖子统计

展示帖子统计数据的组件。

**特性:**
- 三种显示模式：compact、default、detailed
- 浏览、点赞、评论、收藏、分享数据
- 互动率计算（详细模式）
- 可选的标签显示

**使用示例:**

```tsx
import { PostStats } from '@/features/post';

// 紧凑模式
<PostStats stats={post.stats} variant="compact" />

// 默认模式
<PostStats stats={post.stats} variant="default" showLabels />

// 详细模式
<PostStats stats={post.stats} variant="detailed" showLabels />
```

---

## 类型定义

所有组件使用的类型定义位于 `../domain/post.types.ts`：

- `Post` - 帖子完整数据
- `Author` - 作者信息
- `Category` - 分类
- `Tag` - 标签
- `PostStats` - 统计数据
- `PostStatus` - 帖子状态（草稿、已发布、已归档）
- `CreatePostInput` - 创建帖子输入
- `UpdatePostInput` - 更新帖子输入

---

## 依赖项

这些组件依赖以下内容：

### UI 组件 (Shadcn/ui)
- Avatar
- Badge
- Button
- Card
- Input
- Textarea
- Select
- Tabs
- Separator
- Dialog
- DropdownMenu
- AlertDialog
- Form (react-hook-form)

### 工具库
- `date-fns` - 日期格式化
- `react-hook-form` + `zod` - 表单验证
- `@tanstack/react-virtual` - 虚拟滚动
- `lucide-react` - 图标

### 共享组件
- `MarkdownEditor` - Markdown 编辑器
- `MarkdownViewer` - Markdown 渲染器
- `EmptyState` - 空状态组件
- `LoadingSpinner` - 加载动画

---

## 国际化支持

所有组件都支持多语言（通过 `locale` 属性）：

- `zh-CN` - 简体中文（默认）
- `en-US` - 英语
- `ja-JP` - 日语

日期格式会根据 locale 自动调整。

---

## 性能优化

### 虚拟滚动

PostList 组件在数据量超过 20 条时会自动启用虚拟滚动，大幅提升渲染性能。

### 组件懒加载

PostEditor 中的 Markdown 编辑器采用动态导入，减少初始 bundle 大小。

### React.memo

所有组件都使用 `React.memo` 优化，避免不必要的重新渲染。

---

## 注意事项

1. **图片优化**: 使用 Next.js Image 组件自动优化图片
2. **错误处理**: 所有异步操作都应该有错误处理
3. **无障碍性**: 组件遵循 ARIA 标准，支持键盘导航
4. **响应式**: 所有组件都支持移动端适配
5. **主题**: 支持亮色/暗色主题切换

---

## 示例页面

完整的使用示例可以在以下页面中找到：

- `/app/(main)/posts/page.tsx` - 帖子列表页
- `/app/(main)/posts/[id]/page.tsx` - 帖子详情页
- `/app/(main)/posts/create/page.tsx` - 创建帖子页
- `/app/(main)/posts/[id]/edit/page.tsx` - 编辑帖子页

