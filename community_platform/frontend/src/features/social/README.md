# 🤝 Social Feature Module

社交功能模块 - 提供关注、点赞、收藏等社交互动功能。

## 📦 模块结构

```
social/
├── api/                      # API 客户端
│   ├── FollowApiClient.ts    # 关注 API
│   ├── LikeApiClient.ts      # 点赞 API
│   ├── FavoriteApiClient.ts  # 收藏 API
│   ├── types.ts              # API 类型定义
│   └── index.ts
├── components/               # React 组件
│   ├── FollowButton.tsx      # 关注按钮
│   ├── LikeButton.tsx        # 点赞按钮
│   ├── FavoriteButton.tsx    # 收藏按钮
│   ├── FollowerList.tsx      # 粉丝列表
│   ├── FollowingList.tsx     # 关注列表
│   ├── ShareButton.tsx       # 分享按钮
│   └── index.ts
├── domain/                   # 领域模型
│   ├── Follow.ts             # 关注领域模型
│   ├── Like.ts               # 点赞领域模型
│   ├── Favorite.ts           # 收藏领域模型
│   └── index.ts
├── hooks/                    # React Query Hooks
│   ├── useFollow.ts          # 关注相关 hooks
│   ├── useLike.ts            # 点赞相关 hooks
│   ├── useFavorite.ts        # 收藏相关 hooks
│   └── index.ts
├── services/                 # 业务服务层
│   └── SocialService.ts      # 社交服务
├── store/                    # 状态管理
│   └── socialStore.ts        # Zustand store
├── types/                    # 类型导出
│   └── index.ts
└── index.ts                  # 模块统一导出
```

## 🚀 核心功能

### 1. 关注系统 (Follow)

**功能特性**:
- ✅ 关注/取消关注用户
- ✅ 检查关注状态
- ✅ 获取粉丝列表
- ✅ 获取关注列表
- ✅ 批量关注/取消关注
- ✅ 互相关注检测
- ✅ 推荐关注用户
- ✅ 关注统计信息

**组件**:
- `FollowButton` - 关注按钮（支持多种样式）
- `CompactFollowButton` - 紧凑版关注按钮
- `FollowerList` - 粉丝列表（支持搜索、分页）
- `FollowingList` - 关注列表（支持搜索、分页）

**使用示例**:
```tsx
import { FollowButton, FollowerList } from '@/features/social';

// 关注按钮
<FollowButton
  userId="user-123"
  currentUserId="current-user"
  variant="default"
  size="sm"
  onFollowSuccess={() => console.log('关注成功')}
/>

// 粉丝列表
<FollowerList
  userId="user-123"
  currentUserId="current-user"
  showSearch
  pageSize={20}
  onUserClick={(userId) => router.push(`/users/${userId}`)}
/>
```

### 2. 点赞系统 (Like)

**功能特性**:
- ✅ 点赞/取消点赞
- ✅ 检查点赞状态
- ✅ 获取点赞统计
- ✅ 批量获取点赞统计
- ✅ 获取点赞用户列表
- ✅ 支持多种目标类型（帖子、评论、适配器、角色）
- ✅ 乐观更新

**组件**:
- `LikeButton` - 点赞按钮（支持动画效果）
- `LikeButtonWithCount` - 带数量的点赞按钮

**使用示例**:
```tsx
import { LikeButton, LikeTargetType } from '@/features/social';

// 点赞按钮
<LikeButton
  targetType={LikeTargetType.POST}
  targetId="post-123"
  showCount
  animated
  onLikeSuccess={(isLiked, count) => {
    console.log(`点赞状态: ${isLiked}, 数量: ${count}`);
  }}
/>

// 带数量的点赞按钮（垂直布局）
<LikeButtonWithCount
  targetType={LikeTargetType.ADAPTER}
  targetId="adapter-456"
  layout="vertical"
/>
```

### 3. 收藏系统 (Favorite)

**功能特性**:
- ✅ 添加/移除收藏
- ✅ 更新收藏信息
- ✅ 检查收藏状态
- ✅ 获取收藏统计
- ✅ 收藏夹管理
- ✅ 移动收藏到不同收藏夹
- ✅ 支持备注和标签
- ✅ 乐观更新

**组件**:
- `FavoriteButton` - 收藏按钮（支持收藏夹选择）

**使用示例**:
```tsx
import { FavoriteButton, FavoriteTargetType } from '@/features/social';

// 简单收藏按钮
<FavoriteButton
  targetType={FavoriteTargetType.POST}
  targetId="post-123"
  showCount
/>

// 带收藏夹选择的按钮
<FavoriteButton
  targetType={FavoriteTargetType.ADAPTER}
  targetId="adapter-456"
  enableCollectionSelect
  currentUserId="current-user"
  onFavoriteSuccess={(isFavorited, count) => {
    console.log(`收藏状态: ${isFavorited}, 数量: ${count}`);
  }}
/>
```

### 4. 分享功能 (Share)

**功能特性**:
- ✅ 复制链接
- ✅ 分享到社交平台（Twitter, Facebook, LinkedIn, 等）
- ✅ 邮件分享
- ✅ WhatsApp/Telegram 分享
- ✅ Web Share API 支持（移动端）

**组件**:
- `ShareButton` - 分享按钮（下拉菜单）
- `QuickShareButton` - 快速复制链接按钮

**使用示例**:
```tsx
import { ShareButton, QuickShareButton } from '@/features/social';

// 完整分享按钮
<ShareButton
  url="https://example.com/post/123"
  title="精彩帖子标题"
  description="这是一个很棒的帖子"
  platforms={['copy', 'twitter', 'facebook', 'email']}
  onShareSuccess={(platform) => {
    console.log(`分享到: ${platform}`);
  }}
/>

// 快速复制按钮
<QuickShareButton
  url="https://example.com/post/123"
  variant="ghost"
  size="icon-sm"
/>
```

## 🔧 Hooks 使用

### Follow Hooks

```tsx
import {
  useFollow,
  useUnfollow,
  useCheckFollowing,
  useFollowStats,
  useFollowers,
  useFollowing,
  useToggleFollow,
} from '@/features/social';

// 关注用户
const followMutation = useFollow();
followMutation.mutate({ followeeId: 'user-123' });

// 检查关注状态
const { data: checkData } = useCheckFollowing('user-123');
console.log(checkData?.isFollowing);

// 获取关注统计
const { data: stats } = useFollowStats('user-123');
console.log(stats?.followingCount, stats?.followerCount);

// 切换关注状态
const { toggle, isLoading } = useToggleFollow();
toggle('user-123', isFollowing);
```

### Like Hooks

```tsx
import {
  useLike,
  useUnlike,
  useCheckLiked,
  useLikeStats,
  useToggleLike,
  LikeTargetType,
} from '@/features/social';

// 点赞
const likeMutation = useLike();
likeMutation.mutate({
  targetType: LikeTargetType.POST,
  targetId: 'post-123',
});

// 检查点赞状态
const { data: checkData } = useCheckLiked(LikeTargetType.POST, 'post-123');

// 切换点赞状态（推荐，支持乐观更新）
const toggleLike = useToggleLike();
toggleLike.mutate({
  targetType: LikeTargetType.POST,
  targetId: 'post-123',
});
```

### Favorite Hooks

```tsx
import {
  useAddFavorite,
  useRemoveFavorite,
  useCheckFavorited,
  useFavoriteStats,
  useToggleFavorite,
  useCollections,
  FavoriteTargetType,
} from '@/features/social';

// 添加收藏
const addFavorite = useAddFavorite();
addFavorite.mutate({
  targetType: FavoriteTargetType.ADAPTER,
  targetId: 'adapter-123',
  collectionId: 'collection-456',
  note: '很棒的适配器',
  tags: ['AI', 'productivity'],
});

// 获取收藏夹列表
const { data: collections } = useCollections('user-123');

// 切换收藏状态
const toggleFavorite = useToggleFavorite();
toggleFavorite.mutate({
  targetType: FavoriteTargetType.POST,
  targetId: 'post-123',
});
```

## 📊 Services 使用

```tsx
import { socialService } from '@/features/social';

// 获取用户完整社交信息
const socialInfo = await socialService.getUserSocialInfo('user-123');
console.log(socialInfo.followerCount, socialInfo.followingCount);

// 获取内容的社交统计
const stats = await socialService.getContentSocialStats('post', 'post-123');
console.log(stats.likeCount, stats.favoriteCount);

// 同时点赞和收藏
const result = await socialService.likeAndFavorite('adapter', 'adapter-123');

// 获取互相关注数量
const mutualCount = await socialService.getMutualFollowCount('user-123');
```

## 💾 Store 使用

```tsx
import { useSocialStore } from '@/features/social';

// 在组件中使用
function MyComponent() {
  const { setFollowing, getFollowing, clearCache } = useSocialStore();

  // 缓存关注状态
  setFollowing('user-123', true);

  // 获取缓存的关注状态
  const isFollowing = getFollowing('user-123');

  // 清理缓存
  clearCache();
}
```

## 🎨 样式定制

所有组件都支持通过 `className` 属性进行样式定制：

```tsx
<FollowButton
  userId="user-123"
  className="custom-class"
  variant="outline"
  size="lg"
/>

<LikeButton
  targetType={LikeTargetType.POST}
  targetId="post-123"
  className="text-pink-500 hover:text-pink-600"
/>
```

## 🔒 类型安全

所有组件和 hooks 都提供完整的 TypeScript 类型定义：

```tsx
import type {
  Follow,
  FollowStats,
  Like,
  LikeStats,
  LikeTargetType,
  Favorite,
  FavoriteStats,
  FavoriteTargetType,
} from '@/features/social';
```

## 📝 最佳实践

### 1. 使用乐观更新

对于频繁的交互（如点赞、收藏），使用带乐观更新的 hooks：

```tsx
const toggleLike = useToggleLike(); // 已内置乐观更新
const toggleFavorite = useToggleFavorite(); // 已内置乐观更新
```

### 2. 合理使用缓存

利用 TanStack Query 的缓存机制和自定义 Store：

```tsx
// TanStack Query 自动缓存
const { data } = useFollowStats('user-123'); // 缓存 2 分钟

// 自定义 Store 缓存
const { setFollowing, getFollowing } = useSocialStore();
```

### 3. 错误处理

所有 mutations 都会显示 toast 通知，无需手动处理：

```tsx
const followMutation = useFollow();
// 成功/失败都会自动显示 toast
followMutation.mutate({ followeeId: 'user-123' });
```

### 4. 组件组合

灵活组合组件以满足不同场景：

```tsx
// 在卡片中使用
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <UserInfo />
      <FollowButton userId={userId} />
    </div>
  </CardHeader>
  <CardContent>
    <div className="flex gap-2">
      <LikeButton targetType="post" targetId={postId} />
      <FavoriteButton targetType="post" targetId={postId} />
      <ShareButton url={shareUrl} />
    </div>
  </CardContent>
</Card>
```

## 🧪 测试

所有组件和 hooks 都应该进行单元测试：

```tsx
import { renderHook } from '@testing-library/react';
import { useFollow } from '@/features/social';

test('useFollow mutation', async () => {
  const { result } = renderHook(() => useFollow());
  // ... 测试逻辑
});
```

## 📚 相关文档

- [TanStack Query 文档](https://tanstack.com/query/latest)
- [Zustand 文档](https://zustand-demo.pmnd.rs/)
- [Shadcn/ui 文档](https://ui.shadcn.com/)

## 🤝 贡献

欢迎贡献代码！请确保：

1. 遵循现有的代码风格
2. 添加适当的类型定义
3. 编写必要的测试
4. 更新相关文档

---

**维护者**: Zishu Frontend Team  
**最后更新**: 2025-10-23

