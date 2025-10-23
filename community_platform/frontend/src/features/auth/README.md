# 认证模块文档

## 概述

认证基础设施模块提供完整的用户认证功能，包括：

- ✅ NextAuth.js 集成
- ✅ JWT Token 管理
- ✅ Zustand 认证状态管理
- ✅ AuthProvider 提供者
- ✅ 路由守卫中间件
- ✅ API 认证拦截器

## 目录结构

```
src/features/auth/
├── api/                    # API 客户端
│   ├── auth.client.ts      # 认证 API
│   └── index.ts
├── domain/                 # 领域模型
│   ├── User.ts            # 用户模型
│   └── index.ts
├── hooks/                  # React Hooks
│   ├── useAuth.ts         # 认证 Hook
│   └── index.ts
├── services/              # 服务层
│   └── token.service.ts   # Token 管理服务
├── store/                 # 状态管理
│   ├── auth.store.ts      # Zustand Store
│   └── index.ts
├── types/                 # 类型定义
│   └── index.ts
└── index.ts               # 主导出文件
```

## 快速开始

### 1. 环境配置

复制 `.env.example` 并创建 `.env.local`：

```bash
cp .env.example .env.local
```

配置必要的环境变量：

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

### 2. 添加 AuthProvider

在根布局中添加 `AuthProvider`：

```tsx
// app/layout.tsx
import { AuthProvider } from '@/infrastructure/providers';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

### 3. 使用认证功能

#### 登录

```tsx
'use client';

import { useAuth } from '@/features/auth';

export default function LoginPage() {
  const { login, isLoading, error } = useAuth();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    const result = await login({
      email: 'user@example.com',
      password: 'password',
    });

    if (result.success) {
      console.log('登录成功');
    }
  };

  return (
    <form onSubmit={handleLogin}>
      {/* 表单内容 */}
    </form>
  );
}
```

#### 获取当前用户

```tsx
'use client';

import { useAuth } from '@/features/auth';

export default function UserProfile() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <div>请先登录</div>;
  }

  return (
    <div>
      <h1>欢迎，{user?.name}</h1>
      <p>邮箱：{user?.email}</p>
    </div>
  );
}
```

#### 权限检查

```tsx
'use client';

import { usePermission } from '@/features/auth';

export default function AdminPanel() {
  const { canAccess } = usePermission('admin');

  if (!canAccess) {
    return <div>您没有权限访问此页面</div>;
  }

  return <div>管理面板</div>;
}
```

#### 受保护的页面

```tsx
'use client';

import { useRequireAuth } from '@/features/auth';

export default function ProtectedPage() {
  const { isLoading } = useRequireAuth();

  if (isLoading) {
    return <div>加载中...</div>;
  }

  return <div>受保护的内容</div>;
}
```

## API 参考

### useAuth()

主要的认证 Hook。

**返回值：**

```typescript
{
  user: User | null;              // 当前用户
  isAuthenticated: boolean;       // 是否已认证
  isLoading: boolean;            // 加载状态
  error: string | null;          // 错误信息
  session: Session | null;       // NextAuth 会话
  login: (credentials, redirectTo?) => Promise<Result>;
  register: (input, redirectTo?) => Promise<Result>;
  logout: () => Promise<void>;
  loginWithOAuth: (provider, redirectTo?) => Promise<void>;
}
```

### useAuthStore()

Zustand 认证状态管理。

**方法：**

- `setSession(session)` - 设置会话
- `clearSession()` - 清除会话
- `updateToken(token, expiresAt)` - 更新 Token
- `initialize()` - 初始化认证状态
- `logout()` - 登出
- `refreshAccessToken()` - 刷新访问令牌

### TokenService

Token 管理服务。

**方法：**

- `verifyToken(token)` - 验证 Token
- `generateToken(payload, expiresIn)` - 生成 Token
- `decodeToken(token)` - 解码 Token
- `isTokenExpired(token)` - 检查是否过期
- `saveTokens(accessToken, refreshToken, expiresAt)` - 保存 Token
- `getAccessToken()` - 获取访问令牌
- `clearTokens()` - 清除 Token
- `isAuthenticated()` - 检查是否已登录

### AuthApiClient

认证 API 客户端。

**方法：**

- `login(credentials)` - 登录
- `register(input)` - 注册
- `logout()` - 登出
- `refreshToken(refreshToken)` - 刷新令牌
- `getCurrentUser()` - 获取当前用户
- `requestPasswordReset(data)` - 请求密码重置
- `confirmPasswordReset(data)` - 确认密码重置
- `changePassword(data)` - 修改密码
- `verifyEmail(data)` - 验证邮箱

## 路由守卫

中间件会自动保护以下路径：

**受保护路径（需要登录）：**
- `/profile/**`
- `/posts/create`
- `/posts/*/edit`
- `/characters/create`
- `/characters/*/edit`
- `/adapters/upload`
- `/packaging/**`
- `/notifications/**`
- `/settings/**`

**管理员专用：**
- `/admin/**`

**版主及以上：**
- `/moderate/**`

## OAuth 集成

### GitHub

1. 在 GitHub 创建 OAuth App
2. 配置环境变量：

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

3. 使用：

```tsx
const { loginWithOAuth } = useAuth();
await loginWithOAuth('github');
```

### Google

1. 在 Google Cloud Console 创建 OAuth 客户端
2. 配置环境变量：

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

3. 使用：

```tsx
const { loginWithOAuth } = useAuth();
await loginWithOAuth('google');
```

## Token 刷新机制

系统会自动处理 Token 刷新：

1. API 拦截器检测到 401 错误
2. 自动使用 Refresh Token 获取新的 Access Token
3. 重试原始请求
4. 如果刷新失败，清除会话并跳转到登录页

## 安全建议

1. ✅ 使用强密钥：`NEXTAUTH_SECRET` 至少 32 字符
2. ✅ 启用 HTTPS（生产环境必需）
3. ✅ 设置合理的 Token 过期时间
4. ✅ 定期轮换密钥
5. ✅ 使用环境变量管理敏感信息
6. ✅ 实施速率限制
7. ✅ 启用 CSRF 保护

## 测试

```bash
# 运行单元测试
npm test

# 运行 E2E 测试
npm run test:e2e
```

## 故障排除

### 1. Token 一直过期

检查服务器时间是否同步，JWT 过期时间配置。

### 2. OAuth 回调失败

确保回调 URL 配置正确：`http://localhost:3000/api/auth/callback/[provider]`

### 3. 中间件不工作

检查 `middleware.ts` 文件位置和配置。

## 下一步

- [ ] 实现双因素认证（2FA）
- [ ] 添加社交账号绑定
- [ ] 实现单点登录（SSO）
- [ ] 添加会话管理功能

## 相关文档

- [NextAuth.js 文档](https://next-auth.js.org/)
- [Zustand 文档](https://zustand-demo.pmnd.rs/)
- [TanStack Query 文档](https://tanstack.com/query)

