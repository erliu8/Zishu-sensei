# 用户模块 (User Module)

用户个人中心模块，提供完整的用户资料管理、设置和个人内容展示功能。

## 📋 目录

- [功能概述](#功能概述)
- [目录结构](#目录结构)
- [核心功能](#核心功能)
- [使用指南](#使用指南)
- [API 接口](#api-接口)
- [组件使用](#组件使用)
- [页面路由](#页面路由)

## 功能概述

用户模块实现了以下核心功能：

- ✅ 个人资料管理（头像、姓名、简介等）
- ✅ 账号安全设置（密码、邮箱、双因素认证）
- ✅ 用户偏好设置（主题、语言、通知）
- ✅ 我的内容管理（帖子、适配器、角色）
- ✅ 用户统计信息展示
- ✅ 其他用户主页浏览
- ✅ 关注/粉丝功能

## 目录结构

```
src/features/user/
├── api/                    # API 客户端
│   ├── UserApiClient.ts   # 用户 API 客户端
│   └── types.ts           # API 响应类型
├── components/            # UI 组件
│   ├── ProfileHeader.tsx  # 个人资料头部
│   ├── ProfileStats.tsx   # 统计信息
│   ├── ProfileTabs.tsx    # 内容标签页
│   ├── UserInfoCard.tsx   # 用户信息卡片
│   └── index.ts
├── hooks/                 # React Hooks
│   └── useUser.ts        # 用户相关 hooks
├── store/                # 状态管理
│   └── user.store.ts     # 用户状态 store
├── types/                # 类型定义
│   └── index.ts
└── index.ts              # 模块导出
```

## 核心功能

### 1. 用户资料管理

**功能列表：**
- 个人信息编辑（姓名、简介、地区）
- 社交链接（网站、GitHub、Twitter）
- 头像上传和删除
- 实时预览和更新

**相关文件：**
- `src/app/(main)/profile/settings/profile/page.tsx`
- `src/features/user/components/ProfileHeader.tsx`

### 2. 安全设置

**功能列表：**
- 密码修改
- 邮箱更新
- 双因素认证（即将推出）
- 账号删除

**相关文件：**
- `src/app/(main)/profile/settings/security/page.tsx`

### 3. 偏好设置

**功能列表：**
- 主题切换（浅色、深色、跟随系统）
- 语言选择（中文、英文、日文）
- 通知设置（邮件、推送、营销、摘要）

**相关文件：**
- `src/app/(main)/profile/settings/preferences/page.tsx`
- `src/features/user/store/user.store.ts`

### 4. 我的内容

**功能列表：**
- 我的帖子管理
- 我的适配器管理
- 我的角色管理
- 点赞和收藏内容

**相关文件：**
- `src/app/(main)/profile/posts/page.tsx`
- `src/app/(main)/profile/adapters/page.tsx`
- `src/app/(main)/profile/characters/page.tsx`

## 使用指南

### 基础用法

#### 1. 获取当前用户信息

```tsx
import { useCurrentUser } from '@/features/user/hooks/useUser';

function MyComponent() {
  const { user, isLoading, error, refetch } = useCurrentUser();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Error message={error.message} />;

  return <div>欢迎, {user?.name}!</div>;
}
```

#### 2. 获取用户统计信息

```tsx
import { useUserStats } from '@/features/user/hooks/useUser';

function UserStats({ userId }) {
  const { stats, isLoading } = useUserStats(userId);

  return (
    <div>
      <p>帖子: {stats?.postsCount}</p>
      <p>粉丝: {stats?.followersCount}</p>
    </div>
  );
}
```

#### 3. 更新个人资料

```tsx
import { useUpdateProfile } from '@/features/user/hooks/useUser';
import { toast } from '@/shared/components/ui/use-toast';

function EditProfile() {
  const updateProfile = useUpdateProfile();

  const handleSubmit = async (data) => {
    try {
      await updateProfile.mutateAsync(data);
      toast({ title: '成功', description: '资料更新成功' });
    } catch (error) {
      toast({ title: '错误', description: '更新失败', variant: 'destructive' });
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

#### 4. 上传头像

```tsx
import { useUploadAvatar } from '@/features/user/hooks/useUser';

function AvatarUpload() {
  const uploadAvatar = useUploadAvatar();

  const handleFileChange = async (file: File) => {
    try {
      await uploadAvatar.mutateAsync(file);
      toast({ title: '成功', description: '头像上传成功' });
    } catch (error) {
      toast({ title: '错误', description: '上传失败', variant: 'destructive' });
    }
  };

  return <input type="file" onChange={(e) => handleFileChange(e.target.files[0])} />;
}
```

### 组件使用

#### ProfileHeader

个人资料头部组件，展示用户基本信息和操作按钮。

```tsx
import { ProfileHeader } from '@/features/user/components';

<ProfileHeader
  user={user}
  isCurrentUser={true}
  onEditProfile={() => router.push('/profile/settings/profile')}
  onChangeAvatar={handleAvatarChange}
/>
```

#### ProfileStats

统计信息组件，展示用户的各项数据。

```tsx
import { ProfileStats } from '@/features/user/components';

<ProfileStats
  stats={stats}
  onStatsClick={(type) => console.log('点击了', type)}
/>
```

#### ProfileTabs

内容标签页组件，用于切换不同类型的内容。

```tsx
import { ProfileTabs } from '@/features/user/components';

<ProfileTabs
  activeTab={activeTab}
  onTabChange={setActiveTab}
  showActivity={true}
/>
```

#### UserInfoCard

用户信息卡片组件，用于用户列表展示。

```tsx
import { UserInfoCard } from '@/features/user/components';

<UserInfoCard
  user={user}
  isFollowing={false}
  onFollow={handleFollow}
  onUnfollow={handleUnfollow}
/>
```

## API 接口

### 用户资料

#### 获取当前用户

```typescript
UserApiClient.getCurrentUser(): Promise<UserProfile>
```

#### 获取指定用户

```typescript
UserApiClient.getUserById(userId: string): Promise<UserProfile>
```

#### 更新个人资料

```typescript
UserApiClient.updateProfile(data: UpdateProfileRequest): Promise<UserProfile>
```

### 头像管理

#### 上传头像

```typescript
UserApiClient.uploadAvatar(file: File): Promise<string>
```

#### 删除头像

```typescript
UserApiClient.deleteAvatar(): Promise<void>
```

### 安全设置

#### 更新密码

```typescript
UserApiClient.updatePassword(data: UpdatePasswordRequest): Promise<void>
```

#### 更新邮箱

```typescript
UserApiClient.updateEmail(data: UpdateEmailRequest): Promise<void>
```

### 偏好设置

#### 获取偏好设置

```typescript
UserApiClient.getPreferences(): Promise<UserPreferences>
```

#### 更新偏好设置

```typescript
UserApiClient.updatePreferences(data: UpdatePreferencesRequest): Promise<UserPreferences>
```

### 统计和活动

#### 获取用户统计

```typescript
UserApiClient.getUserStats(userId?: string): Promise<UserStats>
```

#### 获取用户活动

```typescript
UserApiClient.getUserActivities(
  userId?: string,
  page?: number,
  pageSize?: number
): Promise<{ activities: UserActivity[]; total: number; hasMore: boolean }>
```

## 页面路由

### 个人中心路由

| 路由 | 描述 |
|------|------|
| `/profile` | 个人主页 |
| `/profile/posts` | 我的帖子 |
| `/profile/adapters` | 我的适配器 |
| `/profile/characters` | 我的角色 |
| `/profile/followers` | 粉丝列表 |
| `/profile/followers/following` | 关注列表 |
| `/profile/favorites` | 收藏内容 |

### 设置路由

| 路由 | 描述 |
|------|------|
| `/profile/settings/profile` | 个人资料设置 |
| `/profile/settings/security` | 安全设置 |
| `/profile/settings/preferences` | 偏好设置 |

### 其他用户

| 路由 | 描述 |
|------|------|
| `/users/[id]` | 用户主页 |

## 类型定义

### UserProfile

```typescript
interface UserProfile {
  id: string;
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  github?: string;
  twitter?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  stats: UserStats;
}
```

### UserStats

```typescript
interface UserStats {
  postsCount: number;
  adaptersCount: number;
  charactersCount: number;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  favoritesCount: number;
  viewsCount: number;
}
```

### UserPreferences

```typescript
interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US' | 'ja-JP';
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
  weeklyDigest: boolean;
}
```

## 状态管理

用户模块使用 Zustand 进行状态管理：

```typescript
import { useUserStore } from '@/features/user/store/user.store';

// 在组件中使用
function MyComponent() {
  const { currentUserProfile, preferences, setPreferences } = useUserStore();
  
  // 使用状态...
}
```

## 开发注意事项

1. **认证要求**：大部分用户相关的操作需要用户登录
2. **权限控制**：只有用户本人可以修改自己的资料和设置
3. **数据验证**：所有表单都使用 Zod 进行严格的数据验证
4. **错误处理**：使用 toast 通知用户操作结果
5. **缓存策略**：使用 TanStack Query 进行数据缓存和自动更新

## TODO

- [ ] 实现账号删除功能
- [ ] 添加双因素认证
- [ ] 实现用户活动时间线
- [ ] 添加隐私设置选项
- [ ] 支持自定义主题颜色
- [ ] 实现数据导出功能

## 相关模块

- **认证模块** (`@/features/auth`): 提供用户认证和会话管理
- **社交模块** (`@/features/social`): 提供关注、点赞、收藏功能
- **帖子模块** (`@/features/post`): 用户发布的帖子
- **适配器模块** (`@/features/adapter`): 用户上传的适配器
- **角色模块** (`@/features/character`): 用户创建的角色

## 维护者

Zishu Frontend Team

最后更新：2025-10-23

