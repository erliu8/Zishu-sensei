# 📝 评论模块 (Comment Module)

评论系统模块，支持树形结构的评论和回复功能。

## 🌟 功能特性

- ✅ 树形评论结构（支持嵌套回复）
- ✅ 评论的增删改查
- ✅ 点赞/取消点赞
- ✅ 评论排序（最新、最早、最热）
- ✅ 评论举报
- ✅ 实时更新（TanStack Query）
- ✅ 响应式设计
- ✅ 骨架屏加载
- ✅ 分页加载

## 📁 文件结构

```
src/features/comment/
├── domain/
│   ├── comment.types.ts      # 类型定义
│   └── comment.model.ts      # 领域模型和工具函数
├── api/
│   └── comment.client.ts     # API 客户端
├── hooks/
│   └── useComments.ts        # TanStack Query Hooks
├── components/
│   ├── CommentForm.tsx       # 评论表单
│   ├── CommentItem.tsx       # 单个评论项
│   ├── CommentList.tsx       # 评论列表
│   ├── CommentThread.tsx     # 评论线程
│   ├── CommentActions.tsx    # 评论操作
│   └── index.ts              # 组件导出
├── index.ts                  # 模块导出
└── README.md                 # 本文档
```

## 🚀 快速开始

### 基础用法

```tsx
import { CommentList } from '@/features/comment';
import { CommentTargetType } from '@/features/comment';

function PostDetail({ postId, currentUser }) {
  return (
    <div>
      {/* 你的帖子内容 */}
      
      {/* 评论区 */}
      <CommentList
        targetType={CommentTargetType.POST}
        targetId={postId}
        currentUserId={currentUser.id}
        currentUser={currentUser}
      />
    </div>
  );
}
```

### 自定义评论表单

```tsx
import { CommentForm } from '@/features/comment';

function MyCommentForm() {
  return (
    <CommentForm
      targetType={CommentTargetType.POST}
      targetId="post-123"
      placeholder="写下你的想法..."
      onSuccess={() => console.log('评论成功')}
    />
  );
}
```

### 显示单个评论

```tsx
import { CommentItem } from '@/features/comment';

function SingleComment({ comment, userId }) {
  return (
    <CommentItem
      comment={comment}
      currentUserId={userId}
      depth={0}
      maxDepth={3}
    />
  );
}
```

### 评论线程（详情页）

```tsx
import { CommentThread } from '@/features/comment';

function CommentDetailPage({ commentId }) {
  return (
    <CommentThread
      commentId={commentId}
      currentUserId={currentUserId}
      showFullThread={true}
      onBack={() => router.back()}
    />
  );
}
```

## 🎨 组件 API

### CommentList

评论列表组件，展示完整的评论树。

**Props:**

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `targetType` | `CommentTargetType` | ✅ | - | 目标类型 |
| `targetId` | `string` | ✅ | - | 目标 ID |
| `currentUserId` | `string` | ❌ | - | 当前用户 ID |
| `currentUser` | `object` | ❌ | - | 当前用户信息 |
| `showForm` | `boolean` | ❌ | `true` | 是否显示评论表单 |
| `defaultSortBy` | `CommentSortBy` | ❌ | `NEWEST` | 默认排序方式 |
| `pageSize` | `number` | ❌ | `20` | 每页数量 |
| `className` | `string` | ❌ | - | 自定义样式 |

### CommentForm

评论表单组件，用于创建新评论或回复。

**Props:**

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `targetType` | `CommentTargetType` | ✅ | - | 目标类型 |
| `targetId` | `string` | ✅ | - | 目标 ID |
| `parentId` | `string` | ❌ | - | 父评论 ID（回复时） |
| `placeholder` | `string` | ❌ | `'写下你的评论...'` | 占位文本 |
| `autoFocus` | `boolean` | ❌ | `false` | 自动聚焦 |
| `compact` | `boolean` | ❌ | `false` | 紧凑模式 |
| `currentUser` | `object` | ❌ | - | 当前用户信息 |
| `onSuccess` | `() => void` | ❌ | - | 成功回调 |
| `onCancel` | `() => void` | ❌ | - | 取消回调 |

### CommentItem

单个评论项组件，支持嵌套回复。

**Props:**

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `comment` | `Comment` | ✅ | - | 评论数据 |
| `currentUserId` | `string` | ❌ | - | 当前用户 ID |
| `depth` | `number` | ❌ | `0` | 嵌套深度 |
| `maxDepth` | `number` | ❌ | `3` | 最大嵌套深度 |
| `onReplySuccess` | `() => void` | ❌ | - | 回复成功回调 |
| `showReplies` | `boolean` | ❌ | `true` | 是否显示回复 |

### CommentThread

评论线程组件，显示单个评论及其上下文。

**Props:**

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `commentId` | `string` | ✅ | - | 评论 ID |
| `currentUserId` | `string` | ❌ | - | 当前用户 ID |
| `showFullThread` | `boolean` | ❌ | `true` | 显示完整线程 |
| `onBack` | `() => void` | ❌ | - | 返回回调 |

## 🔧 Hooks API

### useComments

获取评论列表。

```tsx
const { data, isLoading, isError, error } = useComments({
  targetType: CommentTargetType.POST,
  targetId: 'post-123',
  page: 1,
  pageSize: 20,
  sortBy: CommentSortBy.NEWEST,
});
```

### useComment

获取单个评论。

```tsx
const { data: comment, isLoading } = useComment('comment-123');
```

### useCreateComment

创建评论。

```tsx
const createComment = useCreateComment();

await createComment.mutateAsync({
  content: '这是一条评论',
  targetType: CommentTargetType.POST,
  targetId: 'post-123',
  parentId: 'comment-456', // 可选，用于回复
});
```

### useUpdateComment

更新评论。

```tsx
const updateComment = useUpdateComment();

await updateComment.mutateAsync({
  commentId: 'comment-123',
  dto: { content: '更新后的内容' },
});
```

### useDeleteComment

删除评论。

```tsx
const deleteComment = useDeleteComment();

await deleteComment.mutateAsync('comment-123');
```

### useLikeComment / useUnlikeComment

点赞/取消点赞评论。

```tsx
const likeComment = useLikeComment();
const unlikeComment = useUnlikeComment();

await likeComment.mutateAsync('comment-123');
await unlikeComment.mutateAsync('comment-123');
```

### useReportComment

举报评论。

```tsx
const reportComment = useReportComment();

await reportComment.mutateAsync({
  commentId: 'comment-123',
  reason: '垃圾信息',
});
```

## 📊 数据类型

### Comment

```typescript
interface Comment {
  id: string;
  content: string;
  targetType: CommentTargetType;
  targetId: string;
  authorId: string;
  author: CommentAuthor;
  parentId: string | null;
  replies?: Comment[];
  replyCount: number;
  likeCount: number;
  isLiked: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### CommentTargetType

```typescript
enum CommentTargetType {
  POST = 'post',
  ADAPTER = 'adapter',
  CHARACTER = 'character',
  PACKAGE = 'package',
}
```

### CommentSortBy

```typescript
enum CommentSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  POPULAR = 'popular',
}
```

## 🎯 使用场景

### 1. 帖子评论

```tsx
// app/(main)/posts/[id]/page.tsx
import { CommentList, CommentTargetType } from '@/features/comment';

export default function PostDetailPage({ params }) {
  return (
    <div>
      <PostContent />
      <CommentList
        targetType={CommentTargetType.POST}
        targetId={params.id}
        currentUserId={session?.user?.id}
        currentUser={session?.user}
      />
    </div>
  );
}
```

### 2. 适配器评论

```tsx
// app/(main)/adapters/[id]/page.tsx
import { CommentList, CommentTargetType } from '@/features/comment';

export default function AdapterDetailPage({ params }) {
  return (
    <div>
      <AdapterDetail />
      <CommentList
        targetType={CommentTargetType.ADAPTER}
        targetId={params.id}
        currentUserId={session?.user?.id}
        currentUser={session?.user}
      />
    </div>
  );
}
```

### 3. 角色评论

```tsx
// app/(main)/characters/[id]/page.tsx
import { CommentList, CommentTargetType } from '@/features/comment';

export default function CharacterDetailPage({ params }) {
  return (
    <div>
      <CharacterDetail />
      <CommentList
        targetType={CommentTargetType.CHARACTER}
        targetId={params.id}
        currentUserId={session?.user?.id}
        currentUser={session?.user}
      />
    </div>
  );
}
```

## 🧪 测试

```tsx
// 示例测试
import { render, screen, waitFor } from '@testing-library/react';
import { CommentList } from '@/features/comment';

test('renders comment list', async () => {
  render(
    <CommentList
      targetType={CommentTargetType.POST}
      targetId="post-123"
    />
  );

  await waitFor(() => {
    expect(screen.getByText(/评论/i)).toBeInTheDocument();
  });
});
```

## 🔄 缓存策略

评论模块使用 TanStack Query 进行数据管理，默认缓存策略：

- **staleTime**: 30 秒
- **自动失效**: 创建、更新、删除操作后自动失效相关缓存
- **乐观更新**: 支持（可选）

## 🎨 自定义样式

所有组件都支持通过 `className` prop 进行样式自定义：

```tsx
<CommentList
  className="my-custom-class"
  // ... other props
/>
```

## 📝 注意事项

1. **认证**: 评论功能需要用户登录，请确保传入 `currentUserId` 和 `currentUser`
2. **权限**: 只有评论作者才能编辑和删除自己的评论
3. **嵌套深度**: 默认最大嵌套深度为 3 层，可通过 `maxDepth` prop 调整
4. **性能**: 对于大量评论，建议启用分页和虚拟滚动

## 🔗 相关模块

- [社交模块](/src/features/social) - 点赞、关注功能
- [通知模块](/src/features/notification) - 评论通知
- [用户模块](/src/features/user) - 用户信息

## 📄 许可证

MIT

