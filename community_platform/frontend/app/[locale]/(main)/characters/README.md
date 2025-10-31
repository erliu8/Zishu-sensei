# 角色页面实现文档

## 📋 概述

本目录包含了 Zishu 社区平台的角色相关页面实现，包括角色列表、详情、创建、编辑等功能。

## 🗂️ 文件结构

```
characters/
├── page.tsx                    # 角色列表页 (/characters)
├── [id]/
│   ├── page.tsx               # 角色详情页 (/characters/[id])
│   └── edit/
│       └── page.tsx           # 编辑角色页 (/characters/[id]/edit)
├── create/
│   └── page.tsx               # 创建角色页 (/characters/create)
└── README.md                  # 本文档
```

另外，在 `/profile/characters/page.tsx` 中包含了"我的角色"页面。

## 📄 页面详情

### 1. 角色列表页 (`/characters`)

**功能特性**：
- ✅ 展示所有公开发布的角色
- ✅ 精选角色推荐（无筛选时显示）
- ✅ 热门角色展示（无筛选时显示）
- ✅ 搜索功能（按名称、标签）
- ✅ 排序功能（最新、最多下载、评分最高等）
- ✅ 网格/列表视图切换
- ✅ 分页支持
- ✅ 响应式设计

**使用的组件**：
- `CharacterCard` - 角色卡片
- `EmptyState` - 空状态展示
- `LoadingSpinner` - 加载状态
- `Pagination` - 分页组件

**使用的 Hooks**：
- `useCharacters` - 获取角色列表
- `useFeaturedCharacters` - 获取精选角色
- `useTrendingCharacters` - 获取热门角色

### 2. 角色详情页 (`/characters/[id]`)

**功能特性**：
- ✅ 展示角色完整信息
- ✅ 统计数据展示（下载、收藏、评分等）
- ✅ 所有者可编辑/删除/归档
- ✅ 访客可下载/克隆/分享
- ✅ 封面图和头像展示
- ✅ 标签展示
- ✅ 适配器信息展示
- ✅ 删除确认对话框
- ✅ 归档确认对话框

**使用的组件**：
- `CharacterDetail` - 角色详情展示
- `Avatar` - 头像组件
- `Badge` - 标签徽章
- `AlertDialog` - 确认对话框

**使用的 Hooks**：
- `useCharacter` - 获取角色详情
- `useDeleteCharacter` - 删除角色
- `useCloneCharacter` - 克隆角色
- `useArchiveCharacter` - 归档角色
- `useSession` - 获取用户会话

### 3. 创建角色页 (`/characters/create`)

**功能特性**：
- ✅ 多步骤角色创建向导
- ✅ 保存草稿功能
- ✅ 发布功能
- ✅ 取消确认
- ✅ 登录保护（未登录重定向）

**使用的组件**：
- `CharacterCreator` - 角色创建向导组件

**使用的 Hooks**：
- `useCreateCharacter` - 创建角色
- `useSession` - 获取用户会话

### 4. 编辑角色页 (`/characters/[id]/edit`)

**功能特性**：
- ✅ 编辑现有角色
- ✅ 完整度检查和提示
- ✅ 保存草稿
- ✅ 发布/取消发布
- ✅ 预览功能
- ✅ 权限检查（仅创建者可编辑）
- ✅ 完整度百分比显示
- ✅ 缺失配置项提示

**使用的组件**：
- `CharacterCreator` - 角色编辑器（复用创建向导）
- `Badge` - 状态徽章

**使用的 Hooks**：
- `useCharacter` - 获取角色详情
- `useUpdateCharacter` - 更新角色
- `usePublishCharacter` - 发布角色
- `useUnpublishCharacter` - 取消发布
- `useSession` - 获取用户会话

**特殊逻辑**：
- 使用 `CharacterModel` 类的业务逻辑方法：
  - `isReadyToPublish()` - 检查是否可以发布
  - `getCompletionPercentage()` - 获取完整度百分比

### 5. 我的角色页 (`/profile/characters`)

**功能特性**：
- ✅ 展示用户自己创建的所有角色
- ✅ 标签页分类（全部、已发布、草稿、已归档）
- ✅ 搜索功能
- ✅ 排序功能
- ✅ 网格/列表视图切换
- ✅ 编辑、删除、克隆、归档操作
- ✅ 统计数量显示
- ✅ 删除和归档确认对话框

**使用的组件**：
- `CharacterCard` - 角色卡片（启用编辑模式）
- `Tabs` - 标签页组件
- `AlertDialog` - 确认对话框

**使用的 Hooks**：
- `useMyCharacters` - 获取我的角色列表
- `useDeleteCharacter` - 删除角色
- `useCloneCharacter` - 克隆角色
- `useArchiveCharacter` - 归档角色
- `useSession` - 获取用户会话

## 🎨 UI/UX 设计亮点

### 1. 一致的视觉体验
- 统一的卡片样式
- 统一的按钮和操作流程
- 统一的加载和错误状态

### 2. 响应式设计
- 移动端优化的布局
- 自适应网格系统
- 触摸友好的交互

### 3. 智能反馈
- Toast 通知提示
- 确认对话框防误操作
- 加载状态指示器
- 空状态引导

### 4. 完整度引导
- 编辑页面显示完整度百分比
- 缺失配置项清晰列出
- 阻止不完整角色发布

## 🔧 技术实现细节

### 1. URL 状态管理
所有列表页都使用 URL 参数管理筛选和分页状态：
```typescript
const searchParams = useSearchParams();
const router = useRouter();

// 读取 URL 参数
const initialPage = Number(searchParams.get('page')) || 1;
const initialSearch = searchParams.get('search') || '';

// 更新 URL 参数
const updateURLParams = (params) => {
  const newParams = new URLSearchParams();
  // ... 构建参数
  router.push(`/characters?${newParams.toString()}`);
};
```

### 2. React Server Components
使用 Next.js 14 的 `use()` API 处理异步 params：
```typescript
const resolvedParams = use(params);
const characterId = resolvedParams.id;
```

### 3. 权限控制
多层权限检查确保安全：
```typescript
// 1. 登录检查
if (!session) {
  router.push('/login?redirect=/characters/create');
  return null;
}

// 2. 所有权检查
const isOwner = session?.user?.id === character?.creatorId;
if (!isOwner) {
  return <EmptyState title="无权限" />;
}
```

### 4. 乐观更新
使用 TanStack Query 的缓存管理实现乐观更新：
```typescript
onSuccess: (newCharacter) => {
  queryClient.setQueryData(
    characterKeys.detail(newCharacter.id),
    newCharacter
  );
  queryClient.invalidateQueries({ 
    queryKey: characterKeys.lists() 
  });
}
```

## 📦 依赖组件

### 必需的 Feature 组件
- `CharacterCard` - 角色卡片
- `CharacterList` - 角色列表
- `CharacterDetail` - 角色详情
- `CharacterCreator` - 角色创建/编辑向导

### 必需的 Shared 组件
- UI 组件：Button, Card, Badge, Separator, Tabs, Input, Select
- 通用组件：Avatar, EmptyState, LoadingSpinner, Pagination
- 对话框：AlertDialog, Sheet

### 必需的 Hooks
- 角色 Hooks：`use-characters.ts`
- 工具 Hooks：`use-toast`
- Auth Hooks：`useSession` (next-auth)

### 必需的工具函数
- `formatDate` - 日期格式化
- `formatNumber` - 数字格式化
- `cn` - className 合并

## 🚀 使用示例

### 导航到角色列表
```typescript
router.push('/characters');
```

### 导航到角色详情
```typescript
router.push(`/characters/${characterId}`);
```

### 创建新角色
```typescript
router.push('/characters/create');
```

### 编辑角色
```typescript
router.push(`/characters/${characterId}/edit`);
```

### 查看我的角色
```typescript
router.push('/profile/characters');
```

## 🧪 测试建议

### 单元测试
- [ ] CharacterCard 渲染测试
- [ ] 权限控制逻辑测试
- [ ] URL 参数解析测试
- [ ] 表单验证测试

### 集成测试
- [ ] 创建角色流程测试
- [ ] 编辑角色流程测试
- [ ] 删除角色流程测试
- [ ] 搜索和筛选测试

### E2E 测试
- [ ] 完整的创建发布流程
- [ ] 编辑已发布角色流程
- [ ] 归档和恢复流程
- [ ] 权限控制验证

## 📝 待优化项

1. **性能优化**
   - [ ] 实现虚拟滚动（大列表）
   - [ ] 图片懒加载
   - [ ] 路由预取

2. **功能增强**
   - [ ] 批量操作（批量删除、批量归档）
   - [ ] 高级筛选（按适配器类型、评分范围等）
   - [ ] 导出/导入角色配置

3. **用户体验**
   - [ ] 拖拽排序（我的角色页）
   - [ ] 离线草稿保存
   - [ ] 实时协作编辑

## 🐛 已知问题

- 无

## 📚 相关文档

- [实施计划](../../../docs/IMPLEMENTATION_PLAN.md)
- [适配器框架文档](../../../../../zishu/adapters/README.md)
- [Character Feature 文档](../../../src/features/character/README.md)

---

**维护者**: Zishu Frontend Team  
**最后更新**: 2025-10-23  
**版本**: 1.0.0

