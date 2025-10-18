# 🏗️ Zishu Community Platform - 企业级前端架构设计

## 📋 目录
- [项目概述](#项目概述)
- [架构设计原则](#架构设计原则)
- [技术栈选型](#技术栈选型)
- [分层架构设计](#分层架构设计)
- [模块化设计](#模块化设计)
- [开发计划](#开发计划)
- [最佳实践](#最佳实践)

---

## 📝 项目概述

### 项目定位
**Zishu Community Platform** 是一个现代化的AI社区平台，提供：
- 📱 用户社交和内容分享
- 🔌 适配器市场和下载
- 🤖 桌面AI助手生成服务
- 📊 社区数据分析和管理

### 核心特性
- ✅ **完全解耦合**：前后端完全分离，通过API通信
- ✅ **领域驱动设计**：按业务领域组织代码
- ✅ **微前端就绪**：模块可独立部署
- ✅ **类型安全**：全面使用TypeScript
- ✅ **高性能**：服务端渲染 + 静态生成 + 客户端缓存
- ✅ **易维护**：清晰的代码结构和文档

---

## 🎯 架构设计原则

### 1. SOLID原则
```typescript
// ✅ 单一职责原则 (SRP)
class UserService {
  async getUser(id: string) { /* ... */ }
}
class UserValidator {
  validate(user: User) { /* ... */ }
}

// ✅ 开闭原则 (OCP)
interface DataSource {
  fetch(): Promise<Data>
}
class APIDataSource implements DataSource { /* ... */ }
class MockDataSource implements DataSource { /* ... */ }

// ✅ 依赖倒置原则 (DIP)
// 依赖抽象接口，而非具体实现
```

### 2. 关注点分离
```
UI层         → 只负责展示和交互
业务逻辑层   → 处理业务规则
数据访问层   → 管理API调用
状态管理层   → 管理应用状态
```

### 3. DDD (领域驱动设计)
```
domain/              # 领域层
├── user/           # 用户领域
├── post/           # 帖子领域
├── adapter/        # 适配器领域
└── community/      # 社区领域
```

---

## 🚀 技术栈选型

### 核心框架
| 技术 | 版本 | 用途 | 原因 |
|------|------|------|------|
| **Next.js** | 15.5.6 | 全栈框架 | SSR/SSG/ISR支持，最佳SEO |
| **React** | 19.1.0 | UI库 | 并发特性，Server Components |
| **TypeScript** | 5.x | 类型系统 | 类型安全，更好的IDE支持 |

### UI & 样式
| 技术 | 用途 | 原因 |
|------|------|------|
| **Tailwind CSS** | CSS框架 | 快速开发，高度可定制 |
| **Shadcn/ui** | 组件库 | 无运行时，可完全定制 |
| **Radix UI** | 无障碍组件 | WAI-ARIA标准，键盘导航 |
| **Framer Motion** | 动画库 | 声明式动画，性能优秀 |
| **Lucide React** | 图标库 | 现代风格，Tree-shakable |

### 状态管理
| 技术 | 用途 | 原因 |
|------|------|------|
| **TanStack Query** | 服务端状态 | 自动缓存、重试、更新 |
| **Zustand** | 客户端状态 | 简单、快速、无样板代码 |
| **Jotai** | 原子状态 | 细粒度更新，避免重渲染 |

### 数据获取
| 技术 | 用途 | 原因 |
|------|------|------|
| **Axios** | HTTP客户端 | 拦截器、取消请求、进度 |
| **TanStack Query** | 数据同步 | 缓存、预取、乐观更新 |
| **Socket.IO** | 实时通信 | 打包进度、通知推送 |

### 表单处理
| 技术 | 用途 | 原因 |
|------|------|------|
| **React Hook Form** | 表单管理 | 高性能、无重渲染 |
| **Zod** | 数据验证 | 类型推导、运行时验证 |
| **@hookform/resolvers** | 集成层 | 连接表单和验证 |

### 测试
| 技术 | 用途 | 原因 |
|------|------|------|
| **Vitest** | 单元测试 | 快速、Vite原生支持 |
| **Testing Library** | 组件测试 | 用户行为驱动 |
| **Playwright** | E2E测试 | 跨浏览器、可靠 |
| **MSW** | API Mock | 真实网络行为模拟 |

### 开发工具
| 技术 | 用途 | 原因 |
|------|------|------|
| **ESLint** | 代码检查 | 统一代码风格 |
| **Prettier** | 代码格式化 | 自动格式化 |
| **Husky** | Git Hooks | 提交前检查 |
| **lint-staged** | 暂存区检查 | 只检查修改文件 |
| **commitlint** | 提交规范 | 统一提交信息 |

---

## 🏛️ 分层架构设计

### 架构概览
```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│                      (表示层)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Pages      │  │  Components  │  │   Layouts    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   Application Layer                      │
│                     (应用层)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │    Hooks     │  │  Use Cases   │  │   Services   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    Domain Layer                          │
│                     (领域层)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Entities   │  │  Value Obj   │  │ Domain Svc   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                 Infrastructure Layer                     │
│                    (基础设施层)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ API Clients  │  │    Store     │  │    Utils     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 层级职责

#### 1. 表示层 (Presentation Layer)
**职责**：UI渲染和用户交互
```typescript
// app/posts/page.tsx
export default function PostsPage() {
  const { posts } = usePosts()
  return <PostList posts={posts} />
}
```

#### 2. 应用层 (Application Layer)
**职责**：协调领域对象，处理用例
```typescript
// features/post/hooks/usePosts.ts
export function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: () => postService.getPosts()
  })
}
```

#### 3. 领域层 (Domain Layer)
**职责**：业务逻辑和规则
```typescript
// features/post/domain/Post.ts
export class Post {
  constructor(
    public id: string,
    public title: string,
    public content: string
  ) {}
  
  canEdit(userId: string): boolean {
    return this.authorId === userId
  }
}
```

#### 4. 基础设施层 (Infrastructure Layer)
**职责**：技术实现细节
```typescript
// infrastructure/api/PostApiClient.ts
export class PostApiClient implements PostRepository {
  async getPosts(): Promise<Post[]> {
    const response = await apiClient.get('/posts')
    return response.data.map(dto => PostMapper.toDomain(dto))
  }
}
```

---

## 📦 模块化设计

### 项目目录结构
```
community-frontend/
├── .github/                    # GitHub配置
│   ├── workflows/             # CI/CD流程
│   └── ISSUE_TEMPLATE/        # Issue模板
├── .husky/                    # Git hooks
├── public/                    # 静态资源
│   ├── images/
│   ├── fonts/
│   └── favicon.ico
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/           # 认证组
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (main)/           # 主应用组
│   │   │   ├── posts/
│   │   │   ├── adapters/
│   │   │   └── profile/
│   │   ├── layout.tsx        # 根布局
│   │   ├── page.tsx          # 首页
│   │   ├── globals.css       # 全局样式
│   │   ├── error.tsx         # 错误页
│   │   ├── loading.tsx       # 加载页
│   │   └── not-found.tsx     # 404页
│   │
│   ├── features/              # 功能模块（DDD）
│   │   ├── auth/             # 认证模块
│   │   │   ├── api/          # API客户端
│   │   │   ├── components/   # UI组件
│   │   │   ├── domain/       # 领域模型
│   │   │   ├── hooks/        # 自定义Hooks
│   │   │   ├── services/     # 业务服务
│   │   │   ├── store/        # 状态管理
│   │   │   ├── types/        # 类型定义
│   │   │   └── index.ts      # 导出
│   │   │
│   │   ├── post/             # 帖子模块
│   │   │   ├── api/
│   │   │   │   ├── PostApiClient.ts
│   │   │   │   └── types.ts
│   │   │   ├── components/
│   │   │   │   ├── PostCard.tsx
│   │   │   │   ├── PostList.tsx
│   │   │   │   ├── PostForm.tsx
│   │   │   │   └── index.ts
│   │   │   ├── domain/
│   │   │   │   ├── Post.ts
│   │   │   │   ├── PostRepository.ts
│   │   │   │   └── PostService.ts
│   │   │   ├── hooks/
│   │   │   │   ├── usePosts.ts
│   │   │   │   ├── usePost.ts
│   │   │   │   ├── useCreatePost.ts
│   │   │   │   └── index.ts
│   │   │   ├── services/
│   │   │   │   └── PostService.ts
│   │   │   ├── store/
│   │   │   │   └── postStore.ts
│   │   │   ├── types/
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── adapter/          # 适配器模块
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   │   ├── AdapterCard.tsx
│   │   │   │   ├── AdapterList.tsx
│   │   │   │   ├── AdapterDetail.tsx
│   │   │   │   └── AdapterUpload.tsx
│   │   │   ├── domain/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── index.ts
│   │   │
│   │   ├── user/             # 用户模块
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── domain/
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   │
│   │   ├── packaging/        # 打包模块
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   │   ├── ConfigForm.tsx
│   │   │   │   ├── PackagingProgress.tsx
│   │   │   │   └── DownloadButton.tsx
│   │   │   ├── domain/
│   │   │   ├── hooks/
│   │   │   │   ├── useCreatePackage.ts
│   │   │   │   └── usePackagingStatus.ts
│   │   │   └── index.ts
│   │   │
│   │   └── notification/     # 通知模块
│   │       ├── api/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── index.ts
│   │
│   ├── shared/               # 共享代码
│   │   ├── components/       # 通用UI组件
│   │   │   ├── ui/          # 基础组件（Shadcn）
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   └── index.ts
│   │   │   ├── layout/      # 布局组件
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── Navigation.tsx
│   │   │   ├── common/      # 通用组件
│   │   │   │   ├── ErrorBoundary.tsx
│   │   │   │   ├── LoadingSpinner.tsx
│   │   │   │   ├── Pagination.tsx
│   │   │   │   ├── SearchBar.tsx
│   │   │   │   └── Avatar.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── hooks/           # 通用Hooks
│   │   │   ├── useDebounce.ts
│   │   │   ├── useLocalStorage.ts
│   │   │   ├── useMediaQuery.ts
│   │   │   ├── useClickOutside.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── utils/           # 工具函数
│   │   │   ├── cn.ts       # className合并
│   │   │   ├── format.ts   # 数据格式化
│   │   │   ├── validate.ts # 验证函数
│   │   │   ├── date.ts     # 日期处理
│   │   │   └── index.ts
│   │   │
│   │   └── types/          # 共享类型
│   │       ├── common.ts
│   │       ├── api.ts
│   │       └── index.ts
│   │
│   ├── infrastructure/      # 基础设施层
│   │   ├── api/            # API基础设施
│   │   │   ├── client.ts   # Axios配置
│   │   │   ├── interceptors.ts
│   │   │   ├── error-handler.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── config/         # 配置管理
│   │   │   ├── env.ts      # 环境变量
│   │   │   ├── features.ts # 功能开关
│   │   │   └── constants.ts # 常量定义
│   │   │
│   │   ├── providers/      # Context提供者
│   │   │   ├── QueryProvider.tsx
│   │   │   ├── AuthProvider.tsx
│   │   │   ├── ThemeProvider.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── store/          # 全局状态
│   │   │   ├── authStore.ts
│   │   │   ├── uiStore.ts
│   │   │   └── index.ts
│   │   │
│   │   └── websocket/      # WebSocket
│   │       ├── client.ts
│   │       └── events.ts
│   │
│   ├── styles/             # 样式文件
│   │   ├── globals.css
│   │   ├── themes/
│   │   │   ├── light.css
│   │   │   └── dark.css
│   │   └── animations.css
│   │
│   └── tests/              # 测试文件
│       ├── unit/           # 单元测试
│       ├── integration/    # 集成测试
│       ├── e2e/            # E2E测试
│       ├── mocks/          # Mock数据
│       │   ├── handlers/   # MSW handlers
│       │   └── data/       # Mock数据
│       └── setup.ts        # 测试配置
│
├── docs/                   # 文档
│   ├── architecture.md
│   ├── api.md
│   ├── development.md
│   └── deployment.md
│
├── .env.example           # 环境变量示例
├── .env.local            # 本地环境变量
├── .eslintrc.json        # ESLint配置
├── .prettierrc           # Prettier配置
├── next.config.js        # Next.js配置
├── tailwind.config.js    # Tailwind配置
├── tsconfig.json         # TypeScript配置
├── vitest.config.ts      # Vitest配置
├── package.json          # 依赖管理
└── README.md             # 项目说明
```

---

## 🎨 核心设计模式

### 1. Repository模式（数据访问）
```typescript
// features/post/domain/PostRepository.ts
export interface PostRepository {
  getPosts(params?: GetPostsParams): Promise<Post[]>
  getPost(id: string): Promise<Post>
  createPost(data: CreatePostData): Promise<Post>
  updatePost(id: string, data: UpdatePostData): Promise<Post>
  deletePost(id: string): Promise<void>
}

// features/post/api/PostApiClient.ts
export class PostApiClient implements PostRepository {
  constructor(private client: ApiClient) {}
  
  async getPosts(params?: GetPostsParams): Promise<Post[]> {
    const response = await this.client.get('/posts', { params })
    return response.data.map(PostMapper.toDomain)
  }
  
  // ... 其他方法实现
}
```

### 2. Service模式（业务逻辑）
```typescript
// features/post/services/PostService.ts
export class PostService {
  constructor(private repository: PostRepository) {}
  
  async getPublishedPosts(userId?: string): Promise<Post[]> {
    const posts = await this.repository.getPosts({ published: true })
    
    // 业务逻辑：过滤用户有权限查看的帖子
    if (userId) {
      return posts.filter(post => post.canViewBy(userId))
    }
    
    return posts
  }
  
  async publishPost(postId: string, userId: string): Promise<void> {
    const post = await this.repository.getPost(postId)
    
    // 业务规则验证
    if (!post.canPublish(userId)) {
      throw new Error('No permission to publish')
    }
    
    post.publish()
    await this.repository.updatePost(postId, post.toData())
  }
}
```

### 3. Factory模式（对象创建）
```typescript
// features/post/domain/PostFactory.ts
export class PostFactory {
  static createFromAPI(dto: PostDTO): Post {
    return new Post({
      id: dto.id,
      title: dto.title,
      content: dto.content,
      author: UserFactory.createFromAPI(dto.author),
      createdAt: new Date(dto.created_at),
      updatedAt: new Date(dto.updated_at)
    })
  }
  
  static createDraft(userId: string): Post {
    return new Post({
      id: generateId(),
      title: '',
      content: '',
      author: { id: userId },
      status: PostStatus.Draft,
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }
}
```

### 4. Adapter模式（数据转换）
```typescript
// features/post/api/PostMapper.ts
export class PostMapper {
  static toDomain(dto: PostDTO): Post {
    return new Post({
      id: dto.id,
      title: dto.title,
      content: dto.content,
      authorId: dto.user_id,
      createdAt: parseISO(dto.created_at),
      updatedAt: parseISO(dto.updated_at)
    })
  }
  
  static toDTO(post: Post): PostDTO {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      user_id: post.authorId,
      created_at: post.createdAt.toISOString(),
      updated_at: post.updatedAt.toISOString()
    }
  }
}
```

### 5. Observer模式（事件系统）
```typescript
// infrastructure/events/EventBus.ts
export class EventBus {
  private listeners: Map<string, Set<Function>> = new Map()
  
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }
  
  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(data))
    }
  }
}

// 使用示例
eventBus.on('post:created', (post: Post) => {
  console.log('New post created:', post.title)
  // 触发其他副作用
})
```

---

## ⚙️ 配置管理

### 环境变量配置
```typescript
// infrastructure/config/env.ts
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
  NEXT_PUBLIC_WS_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().default('Zishu Community'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test'])
})

export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NODE_ENV: process.env.NODE_ENV
})
```

### 功能开关
```typescript
// infrastructure/config/features.ts
export const featureFlags = {
  // 核心功能
  enableAuth: true,
  enablePosts: true,
  enableComments: true,
  
  // 适配器市场
  enableAdapterMarket: true,
  enableAdapterUpload: false, // 暂未开放
  
  // 打包服务
  enablePackaging: true,
  enableWebSocket: true,
  
  // 高级功能
  enableNotifications: true,
  enableAnalytics: process.env.NODE_ENV === 'production',
  enableErrorTracking: process.env.NODE_ENV === 'production',
  
  // 实验性功能
  enableRealTimeChat: false,
  enableAIAssistant: false,
  enableAdvancedSearch: false
} as const

export function isFeatureEnabled(feature: keyof typeof featureFlags): boolean {
  return featureFlags[feature]
}
```

---

## 🔐 安全最佳实践

### 1. XSS防护
```typescript
// shared/utils/sanitize.ts
import DOMPurify from 'dompurify'

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
    ALLOWED_ATTR: ['href', 'target']
  })
}
```

### 2. CSRF防护
```typescript
// infrastructure/api/client.ts
axios.interceptors.request.use(config => {
  const csrfToken = getCsrfToken()
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})
```

### 3. 敏感数据处理
```typescript
// shared/utils/security.ts
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  return `${user.slice(0, 2)}***@${domain}`
}

export function maskToken(token: string): string {
  return `${token.slice(0, 8)}...${token.slice(-8)}`
}
```

---

## 📊 性能优化策略

### 1. 代码分割
```typescript
// 路由级别代码分割
const PostEditor = dynamic(() => import('@/features/post/components/PostEditor'), {
  loading: () => <LoadingSpinner />,
  ssr: false
})

// 组件级别代码分割
const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
  loading: () => <Skeleton />,
  ssr: false
})
```

### 2. 图片优化
```typescript
// 使用Next.js Image组件
import Image from 'next/image'

<Image
  src="/avatar.jpg"
  alt="User Avatar"
  width={200}
  height={200}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
  priority
/>
```

### 3. 数据缓存
```typescript
// TanStack Query配置
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟
      gcTime: 10 * 60 * 1000, // 10分钟 (原cacheTime)
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    }
  }
})
```

### 4. 虚拟滚动
```typescript
// 使用react-window处理大列表
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={1000}
  itemSize={100}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <PostCard post={posts[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## 🧪 测试策略

### 1. 单元测试
```typescript
// features/post/domain/Post.test.ts
import { describe, it, expect } from 'vitest'
import { Post } from './Post'

describe('Post', () => {
  it('should create a valid post', () => {
    const post = new Post({
      id: '1',
      title: 'Test Post',
      content: 'Test content',
      authorId: 'user1'
    })
    
    expect(post.id).toBe('1')
    expect(post.title).toBe('Test Post')
  })
  
  it('should validate post can be edited by author', () => {
    const post = new Post({
      id: '1',
      title: 'Test',
      content: 'Test',
      authorId: 'user1'
    })
    
    expect(post.canEdit('user1')).toBe(true)
    expect(post.canEdit('user2')).toBe(false)
  })
})
```

### 2. 组件测试
```typescript
// features/post/components/PostCard.test.tsx
import { render, screen } from '@testing-library/react'
import { PostCard } from './PostCard'

describe('PostCard', () => {
  it('should render post information', () => {
    const post = {
      id: '1',
      title: 'Test Post',
      content: 'Test content',
      author: { name: 'John' }
    }
    
    render(<PostCard post={post} />)
    
    expect(screen.getByText('Test Post')).toBeInTheDocument()
    expect(screen.getByText('John')).toBeInTheDocument()
  })
})
```

### 3. API Mock
```typescript
// tests/mocks/handlers/post.ts
import { http, HttpResponse } from 'msw'

export const postHandlers = [
  http.get('/api/posts', () => {
    return HttpResponse.json({
      data: [
        { id: '1', title: 'Post 1', content: 'Content 1' },
        { id: '2', title: 'Post 2', content: 'Content 2' }
      ]
    })
  }),
  
  http.post('/api/posts', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      data: { id: '3', ...body }
    }, { status: 201 })
  })
]
```

---

## 📖 文档规范

### 1. 组件文档
```typescript
/**
 * PostCard - 帖子卡片组件
 * 
 * @description
 * 展示单个帖子的卡片视图，包含标题、内容摘要、作者信息等
 * 
 * @example
 * ```tsx
 * <PostCard 
 *   post={post}
 *   onLike={handleLike}
 *   onComment={handleComment}
 * />
 * ```
 */
export interface PostCardProps {
  /** 帖子数据 */
  post: Post
  /** 点赞回调 */
  onLike?: (postId: string) => void
  /** 评论回调 */
  onComment?: (postId: string) => void
  /** 自定义样式类名 */
  className?: string
}
```

### 2. API文档
```typescript
/**
 * 获取帖子列表
 * 
 * @param params - 查询参数
 * @param params.page - 页码（从1开始）
 * @param params.limit - 每页数量（默认20）
 * @param params.category - 分类筛选
 * @param params.search - 搜索关键词
 * 
 * @returns 分页的帖子列表
 * 
 * @throws {ApiError} 当请求失败时抛出
 * 
 * @example
 * ```typescript
 * const posts = await getPosts({ page: 1, limit: 20 })
 * ```
 */
export async function getPosts(
  params?: GetPostsParams
): Promise<PaginatedResponse<Post>> {
  // ...
}
```

---

## 🚀 部署策略

### 1. 环境配置
```bash
# 开发环境
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# 生产环境
NEXT_PUBLIC_API_BASE_URL=https://api.zishu.ai
NEXT_PUBLIC_WS_URL=wss://api.zishu.ai/ws
```

### 2. 构建优化
```javascript
// next.config.js
module.exports = {
  // 输出优化
  output: 'standalone',
  
  // 压缩配置
  compress: true,
  
  // 图片优化
  images: {
    domains: ['api.zishu.ai'],
    formats: ['image/avif', 'image/webp']
  },
  
  // 性能追踪
  experimental: {
    instrumentationHook: true
  }
}
```

### 3. Docker部署
```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 📋 开发检查清单

### 代码质量
- [ ] TypeScript类型完整
- [ ] 组件有PropTypes/接口定义
- [ ] 错误边界处理
- [ ] 加载状态处理
- [ ] 空状态处理
- [ ] 无障碍性(ARIA)

### 性能
- [ ] 图片懒加载
- [ ] 代码分割
- [ ] 避免重渲染
- [ ] 使用React.memo
- [ ] 虚拟滚动（长列表）

### 安全
- [ ] XSS防护
- [ ] CSRF防护
- [ ] 输入验证
- [ ] 敏感数据脱敏
- [ ] 安全的依赖版本

### 测试
- [ ] 单元测试覆盖率>80%
- [ ] 关键路径E2E测试
- [ ] API Mock测试
- [ ] 错误场景测试

### 文档
- [ ] README完整
- [ ] API文档
- [ ] 组件文档
- [ ] 部署文档
- [ ] CHANGELOG

---

这是一个完整的企业级前端架构设计文档，为项目提供了清晰的技术路线和最佳实践！🚀

