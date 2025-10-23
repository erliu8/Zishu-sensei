# 🛠️ Zishu 社区平台前端开发规范

**版本**: 1.0.0  
**更新日期**: 2025-10-23  
**适用范围**: Zishu 社区平台前端团队

---

## 📋 目录

- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [代码规范](#代码规范)
- [Git 工作流](#git-工作流)
- [项目结构](#项目结构)
- [命名约定](#命名约定)
- [TypeScript 最佳实践](#typescript-最佳实践)
- [React 最佳实践](#react-最佳实践)
- [样式规范](#样式规范)
- [API 调用规范](#api-调用规范)
- [测试规范](#测试规范)
- [性能优化](#性能优化)
- [常见问题](#常见问题)

---

## 环境要求

### 必需软件

- **Node.js**: `>= 20.11.0` (推荐使用 LTS 版本)
- **npm**: `>= 10.0.0`
- **Git**: `>= 2.30.0`

### 推荐工具

- **编辑器**: VS Code (推荐)
- **浏览器**: Chrome 最新版 + React DevTools
- **终端**: iTerm2 (macOS) / Windows Terminal (Windows)

### Node 版本管理

项目使用 `.nvmrc` 文件指定 Node.js 版本：

```bash
# 使用 nvm 安装并切换到项目指定版本
nvm install
nvm use
```

---

## 快速开始

### 1. 克隆仓库

```bash
git clone <repository-url>
cd community_platform/frontend
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp env.example .env.local

# 编辑 .env.local 文件，填入实际配置
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 5. 运行测试

```bash
# 运行单元测试
npm run test

# 运行测试（监听模式）
npm run test:watch

# 查看测试覆盖率
npm run test:coverage
```

---

## 代码规范

### 格式化工具

项目使用 **Prettier** 进行代码格式化。

#### 配置文件：`.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "printWidth": 80,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "jsxSingleQuote": false,
  "bracketSameLine": false,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

#### 使用方式

```bash
# 格式化所有文件
npm run format

# 检查格式
npm run format:check
```

### Lint 工具

项目使用 **ESLint** 进行代码检查。

#### 使用方式

```bash
# 运行 lint 检查
npm run lint

# 自动修复可修复的问题
npm run lint:fix
```

### 编辑器配置

#### VS Code 扩展

项目推荐安装以下扩展（见 `.vscode/extensions.json`）：

- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **Tailwind CSS IntelliSense** - Tailwind 智能提示
- **TypeScript Next** - TypeScript 支持
- **Error Lens** - 错误高亮显示
- **Code Spell Checker** - 拼写检查
- **Conventional Commits** - 规范化提交信息

#### VS Code 设置

项目已配置 `.vscode/settings.json`，会自动：

- 保存时格式化代码
- 保存时自动修复 ESLint 问题
- 使用项目的 TypeScript 版本

---

## Git 工作流

### 分支策略

```
main          (主分支，保护分支，始终可部署)
  ├── develop (开发分支，集成分支)
      ├── feature/功能名    (功能分支)
      ├── bugfix/问题描述   (Bug 修复分支)
      └── hotfix/紧急修复   (紧急修复分支)
```

### 分支命名规范

- **功能分支**: `feature/用户认证`, `feature/post-list`
- **Bug 修复**: `bugfix/修复登录问题`, `bugfix/fix-login-error`
- **紧急修复**: `hotfix/修复生产环境崩溃`
- **重构**: `refactor/重构用户模块`
- **文档**: `docs/更新开发文档`

### Commit 规范

项目使用 **Conventional Commits** 规范。

#### Commit 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档变更
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构（既不是新功能也不是修复 Bug）
- `perf`: 性能优化
- `test`: 添加测试
- `chore`: 构建过程或辅助工具的变动
- `revert`: 回退提交
- `build`: 构建系统或外部依赖的变更
- `ci`: CI 配置文件和脚本的变更

#### Commit 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### 示例

```bash
# 简单示例
git commit -m "feat: 添加用户登录功能"

# 带 scope 的示例
git commit -m "feat(auth): 添加 JWT 认证"

# 完整示例
git commit -m "feat(post): 添加帖子列表分页功能

- 实现分页组件
- 添加无限滚动支持
- 优化列表渲染性能

Closes #123"
```

### Git Hooks

项目配置了以下 Git Hooks（通过 Husky）：

#### pre-commit

- 运行 `lint-staged`
- 自动格式化和修复代码
- 检查代码规范

#### pre-push

- 运行 TypeScript 类型检查
- 运行 ESLint 代码检查
- 可选：运行单元测试

#### commit-msg

- 验证 commit 信息格式
- 确保符合 Conventional Commits 规范

### Pull Request 流程

1. **创建分支**

```bash
git checkout develop
git pull origin develop
git checkout -b feature/新功能名称
```

2. **开发并提交**

```bash
git add .
git commit -m "feat: 添加新功能"
```

3. **推送到远程**

```bash
git push origin feature/新功能名称
```

4. **创建 Pull Request**

- 填写 PR 模板
- 详细描述变更内容
- 关联相关 Issue
- 请求代码审查

5. **代码审查**

- 至少 1 人 Approve
- 通过所有 CI 检查
- 解决所有评审意见

6. **合并**

- Squash and Merge（推荐）
- 删除源分支

---

## 项目结构

```
frontend/
├── app/                      # Next.js App Router 页面
│   ├── (auth)/              # 认证相关页面组
│   │   ├── login/           # 登录页
│   │   └── register/        # 注册页
│   ├── (main)/              # 主应用页面组
│   │   ├── posts/           # 帖子相关页面
│   │   ├── adapters/        # 适配器市场页面
│   │   ├── characters/      # 角色管理页面
│   │   └── profile/         # 个人中心页面
│   ├── layout.tsx           # 根布局
│   └── page.tsx             # 首页
├── src/
│   ├── features/            # 功能模块（按领域组织）
│   │   ├── auth/           # 认证模块
│   │   │   ├── api/        # API 调用
│   │   │   ├── components/ # UI 组件
│   │   │   ├── domain/     # 领域模型
│   │   │   ├── hooks/      # React Hooks
│   │   │   └── store/      # 状态管理
│   │   ├── post/           # 帖子模块
│   │   ├── adapter/        # 适配器模块
│   │   └── character/      # 角色模块
│   ├── shared/             # 共享代码
│   │   ├── components/     # 通用组件
│   │   │   ├── ui/         # UI 基础组件
│   │   │   ├── layout/     # 布局组件
│   │   │   └── common/     # 通用业务组件
│   │   ├── hooks/          # 通用 Hooks
│   │   ├── utils/          # 工具函数
│   │   └── types/          # 共享类型定义
│   ├── infrastructure/     # 基础设施层
│   │   ├── api/            # API Client
│   │   ├── websocket/      # WebSocket 客户端
│   │   ├── storage/        # 存储管理
│   │   ├── i18n/           # 国际化
│   │   ├── monitoring/     # 监控（Sentry等）
│   │   └── providers/      # React Context Providers
│   ├── styles/             # 全局样式
│   │   ├── globals.css     # 全局 CSS
│   │   └── themes/         # 主题配置
│   └── types/              # 全局类型定义
├── public/                  # 静态资源
│   ├── images/
│   ├── icons/
│   └── fonts/
├── docs/                    # 项目文档
├── __tests__/              # 测试文件
│   ├── unit/               # 单元测试
│   ├── integration/        # 集成测试
│   └── e2e/                # E2E 测试
├── .husky/                 # Git Hooks
├── .vscode/                # VS Code 配置
├── .editorconfig           # 编辑器配置
├── .eslintrc.json          # ESLint 配置
├── .prettierrc             # Prettier 配置
├── .nvmrc                  # Node 版本
├── next.config.ts          # Next.js 配置
├── tsconfig.json           # TypeScript 配置
├── tailwind.config.ts      # Tailwind CSS 配置
├── vitest.config.ts        # Vitest 配置
└── package.json            # 项目依赖
```

---

## 命名约定

### 文件命名

#### 组件文件

```typescript
// PascalCase for components
UserProfile.tsx
PostCard.tsx
AdapterList.tsx
```

#### 工具函数

```typescript
// camelCase for utilities
formatDate.ts
validateEmail.ts
cn.ts
```

#### Hooks

```typescript
// camelCase starting with 'use'
useAuth.ts
useDebounce.ts
usePagination.ts
```

#### 类型定义

```typescript
// PascalCase, usually ending with .types.ts
user.types.ts
post.types.ts
api.types.ts
```

#### 测试文件

```typescript
// Same name as the file being tested, with .test or .spec suffix
UserProfile.test.tsx
formatDate.test.ts
```

### 变量命名

```typescript
// 布尔值：使用 is/has/can/should 前缀
const isLoading = true
const hasPermission = false
const canEdit = true
const shouldUpdate = false

// 常量：UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3
const API_BASE_URL = 'https://api.example.com'

// 私有变量/内部变量：使用下划线前缀
const _internalState = {}

// 函数：camelCase，动词开头
function getUserById(id: string) {}
function createPost(data: PostData) {}
function handleSubmit() {}

// 组件：PascalCase
function UserProfile() {}
const PostCard = () => {}

// 类型/接口：PascalCase
interface User {}
type PostStatus = 'draft' | 'published'
```

### CSS 类名

项目使用 Tailwind CSS，遵循以下规范：

```tsx
// ✅ 好的做法
<div className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm">

// ✅ 使用 cn() 工具合并类名
<div className={cn(
  "flex items-center gap-4",
  isActive && "bg-blue-50",
  className
)}>

// ❌ 避免
<div className="flex  items-center   gap-4"> // 多余空格
```

---

## TypeScript 最佳实践

### 1. 类型优先

```typescript
// ✅ 好的做法：明确的类型定义
interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

function getUserById(id: string): Promise<User> {
  // ...
}

// ❌ 避免：使用 any
function getUser(id: any): any {
  // ...
}
```

### 2. 使用严格模式

项目已启用 TypeScript 严格模式，请遵守：

```typescript
// ✅ 处理 null/undefined
function getUserName(user: User | null): string {
  return user?.name ?? '匿名用户'
}

// ✅ 明确的可选属性
interface Post {
  id: string
  title: string
  content?: string // 可选
}

// ❌ 避免非空断言（除非确定）
const user = getUser()!
```

### 3. 类型推断 vs 显式类型

```typescript
// ✅ 让 TypeScript 推断简单类型
const count = 42 // number
const name = 'Alice' // string

// ✅ 显式声明复杂类型
const user: User = {
  id: '1',
  name: 'Alice',
  email: 'alice@example.com',
  createdAt: new Date(),
}

// ✅ 显式声明函数返回类型
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}
```

### 4. 使用联合类型和类型守卫

```typescript
// 联合类型
type Status = 'idle' | 'loading' | 'success' | 'error'

// 类型守卫
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value
  )
}

// 使用
if (isUser(data)) {
  console.log(data.name) // TypeScript 知道这是 User
}
```

### 5. 泛型

```typescript
// ✅ 使用泛型提高代码复用性
interface ApiResponse<T> {
  data: T
  message: string
  status: number
}

function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  // ...
}

// 使用
const response = await fetchData<User>('/api/users/1')
```

### 6. 优先使用 interface 而不是 type

```typescript
// ✅ 对于对象类型，优先使用 interface
interface User {
  id: string
  name: string
}

// interface 可以扩展
interface Admin extends User {
  role: 'admin'
}

// ✅ 对于联合类型、交叉类型等，使用 type
type Status = 'active' | 'inactive'
type UserWithStatus = User & { status: Status }
```

---

## React 最佳实践

### 1. 组件结构

```tsx
// ✅ 推荐的组件结构
import type { FC } from 'react'
import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/Button'
import { cn } from '@/shared/utils/cn'
import type { User } from '@/features/user/domain/user.types'

// 1. 类型定义
interface UserProfileProps {
  user: User
  className?: string
  onUpdate?: (user: User) => void
}

// 2. 组件定义
export const UserProfile: FC<UserProfileProps> = ({
  user,
  className,
  onUpdate,
}) => {
  // 3. Hooks
  const [isEditing, setIsEditing] = useState(false)

  // 4. 副作用
  useEffect(() => {
    // ...
  }, [])

  // 5. 事件处理器
  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSave = async () => {
    // ...
    onUpdate?.(user)
    setIsEditing(false)
  }

  // 6. 渲染逻辑
  if (!user) {
    return <div>用户不存在</div>
  }

  // 7. JSX
  return (
    <div className={cn('rounded-lg bg-white p-6', className)}>
      <h2 className="text-xl font-bold">{user.name}</h2>
      <p className="text-gray-600">{user.email}</p>
      <Button onClick={isEditing ? handleSave : handleEdit}>
        {isEditing ? '保存' : '编辑'}
      </Button>
    </div>
  )
}

// 8. Display name (可选，用于调试)
UserProfile.displayName = 'UserProfile'
```

### 2. Hooks 使用规范

```typescript
// ✅ 自定义 Hook
import { useState, useEffect } from 'react'
import type { User } from '@/features/user/domain/user.types'

export function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isCancelled = false

    const fetchUser = async () => {
      try {
        setIsLoading(true)
        const data = await getUserById(userId)
        if (!isCancelled) {
          setUser(data)
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err as Error)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchUser()

    return () => {
      isCancelled = true
    }
  }, [userId])

  return { user, isLoading, error }
}
```

### 3. 性能优化

```tsx
import { memo, useMemo, useCallback } from 'react'

// ✅ 使用 memo 避免不必要的重渲染
export const ExpensiveComponent = memo(({ data }: { data: Data[] }) => {
  // 昂贵的计算
  const processedData = useMemo(() => {
    return data.map((item) => expensiveCalculation(item))
  }, [data])

  // 稳定的回调函数
  const handleClick = useCallback(() => {
    console.log('Clicked')
  }, [])

  return <div>{/* ... */}</div>
})
```

### 4. 条件渲染

```tsx
// ✅ 简洁的条件渲染
export function UserStatus({ user }: { user: User }) {
  // 使用提前返回
  if (!user) {
    return <div>加载中...</div>
  }

  if (user.status === 'banned') {
    return <div>用户已被封禁</div>
  }

  // 使用短路运算
  return (
    <div>
      <p>{user.name}</p>
      {user.isVerified && <Badge>已认证</Badge>}
      {user.bio || <p>该用户还没有填写简介</p>}
    </div>
  )
}
```

### 5. 列表渲染

```tsx
// ✅ 使用 key prop
export function PostList({ posts }: { posts: Post[] }) {
  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}

// ❌ 避免使用 index 作为 key（除非列表是静态的）
{posts.map((post, index) => (
  <PostCard key={index} post={post} />
))}
```

---

## 样式规范

### Tailwind CSS 使用

```tsx
// ✅ 好的做法
<div className="flex flex-col gap-4 rounded-lg bg-white p-6 shadow-md">
  <h1 className="text-2xl font-bold text-gray-900">标题</h1>
  <p className="text-gray-600">内容</p>
</div>

// ✅ 使用 cn() 工具合并条件类名
import { cn } from '@/shared/utils/cn'

<button
  className={cn(
    "rounded px-4 py-2 font-medium",
    isPrimary ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-900",
    isDisabled && "opacity-50 cursor-not-allowed"
  )}
>

// ✅ 提取复杂的类名组合
const buttonVariants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
  danger: "bg-red-600 text-white hover:bg-red-700",
}

<button className={buttonVariants.primary}>
```

### 响应式设计

```tsx
// ✅ 移动优先
<div className="w-full md:w-1/2 lg:w-1/3">
  <div className="text-sm md:text-base lg:text-lg">
    响应式文本
  </div>
</div>
```

---

## API 调用规范

### 使用 TanStack Query

```typescript
// ✅ 查询数据
import { useQuery } from '@tanstack/react-query'

export function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
    staleTime: 5 * 60 * 1000, // 5分钟
  })
}

// ✅ 修改数据
import { useMutation, useQueryClient } from '@tanstack/react-query'

export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      // 使缓存失效
      queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

// 在组件中使用
function PostList() {
  const { data: posts, isLoading, error } = usePosts()
  const createPostMutation = useCreatePost()

  if (isLoading) return <div>加载中...</div>
  if (error) return <div>错误: {error.message}</div>

  return (
    <div>
      {posts?.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
```

### 错误处理

```typescript
// ✅ 统一错误处理
try {
  const data = await fetchData()
  return data
} catch (error) {
  if (error instanceof ApiError) {
    // 处理 API 错误
    console.error('API Error:', error.message)
  } else {
    // 处理其他错误
    console.error('Unexpected Error:', error)
  }
  throw error
}
```

---

## 测试规范

### 单元测试

```typescript
// UserProfile.test.tsx
import { render, screen } from '@testing-library/react'
import { UserProfile } from './UserProfile'

describe('UserProfile', () => {
  it('应该渲染用户名称', () => {
    const user = { id: '1', name: 'Alice', email: 'alice@example.com' }
    render(<UserProfile user={user} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('应该在编辑模式下显示保存按钮', async () => {
    const user = { id: '1', name: 'Alice', email: 'alice@example.com' }
    const { getByRole } = render(<UserProfile user={user} />)

    const editButton = getByRole('button', { name: /编辑/i })
    await userEvent.click(editButton)

    expect(screen.getByRole('button', { name: /保存/i })).toBeInTheDocument()
  })
})
```

### 测试覆盖率目标

- **单元测试**: ≥ 80%
- **关键路径**: 100%
- **工具函数**: ≥ 90%

---

## 性能优化

### 1. 代码分割

```typescript
// ✅ 动态导入
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <div>加载中...</div>,
})
```

### 2. 图片优化

```tsx
// ✅ 使用 Next.js Image 组件
import Image from 'next/image'

<Image
  src="/images/avatar.jpg"
  alt="用户头像"
  width={200}
  height={200}
  priority // 对于首屏重要图片
/>
```

### 3. 避免不必要的重渲染

```tsx
// ✅ 使用 memo 和 useCallback
const MemoizedChild = memo(ChildComponent)

function Parent() {
  const handleClick = useCallback(() => {
    // ...
  }, [])

  return <MemoizedChild onClick={handleClick} />
}
```

---

## 常见问题

### Q: 如何解决 ESLint 错误？

```bash
# 自动修复
npm run lint:fix

# 如果无法自动修复，查看具体错误并手动修复
npm run lint
```

### Q: 如何跳过 Git Hooks？

```bash
# 不推荐，但紧急情况下可用
git commit --no-verify
git push --no-verify
```

### Q: 如何调试生产构建？

```bash
npm run build
npm run start
```

### Q: 类型检查失败怎么办？

```bash
# 运行类型检查
npm run type-check

# 查看详细错误信息
npx tsc --noEmit --pretty
```

---

## 参考资源

- [Next.js 文档](https://nextjs.org/docs)
- [React 文档](https://react.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [TanStack Query 文档](https://tanstack.com/query/latest)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**维护者**: Zishu Frontend Team  
**最后更新**: 2025-10-23  
**问题反馈**: 请在 GitHub Issues 中提出

---

**祝编码愉快！🎉**
