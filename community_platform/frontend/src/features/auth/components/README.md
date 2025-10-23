# 认证 UI 组件

这个目录包含了所有与用户认证相关的 UI 组件，实现了完整的认证流程。

## 📦 组件列表

### 1. LoginForm - 登录表单

用于用户登录的表单组件。

**特性：**
- ✅ 邮箱和密码验证
- ✅ 显示/隐藏密码
- ✅ "记住我" 选项
- ✅ 忘记密码链接
- ✅ 错误提示
- ✅ 加载状态

**使用示例：**
```tsx
import { LoginForm } from '@/features/auth/components';

export default function LoginPage() {
  const handleLogin = async (data: LoginFormData) => {
    // 调用登录 API
    await authApi.login(data);
  };

  return (
    <LoginForm
      onSubmit={handleLogin}
      isLoading={isLoading}
      error={error}
      showRememberMe={true}
      showForgotPassword={true}
    />
  );
}
```

---

### 2. RegisterForm - 注册表单

用于用户注册的表单组件。

**特性：**
- ✅ 用户名、邮箱、密码验证
- ✅ 密码强度验证
- ✅ 密码确认
- ✅ 显示/隐藏密码
- ✅ 服务条款同意
- ✅ 表单字段提示
- ✅ 错误提示

**使用示例：**
```tsx
import { RegisterForm } from '@/features/auth/components';

export default function RegisterPage() {
  const handleRegister = async (data: RegisterFormData) => {
    // 调用注册 API
    await authApi.register(data);
  };

  return (
    <RegisterForm
      onSubmit={handleRegister}
      isLoading={isLoading}
      error={error}
      termsUrl="/terms"
      privacyUrl="/privacy"
    />
  );
}
```

---

### 3. ForgotPasswordForm - 忘记密码表单

用于请求密码重置的表单组件。

**特性：**
- ✅ 邮箱验证
- ✅ 成功状态显示
- ✅ 重新发送功能
- ✅ 使用提示
- ✅ 返回登录链接

**使用示例：**
```tsx
import { ForgotPasswordForm } from '@/features/auth/components';

export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    await authApi.forgotPassword(data);
    setIsSuccess(true);
  };

  return (
    <ForgotPasswordForm
      onSubmit={handleForgotPassword}
      isLoading={isLoading}
      error={error}
      isSuccess={isSuccess}
      backToLoginUrl="/login"
    />
  );
}
```

---

### 4. ResetPasswordForm - 重置密码表单

用于重置密码的表单组件。

**特性：**
- ✅ 新密码验证
- ✅ 密码强度要求显示
- ✅ 密码确认
- ✅ 显示/隐藏密码
- ✅ 成功状态显示
- ✅ 返回登录链接

**使用示例：**
```tsx
import { ResetPasswordForm } from '@/features/auth/components';
import { useSearchParams } from 'next/navigation';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    await authApi.resetPassword(data);
    setIsSuccess(true);
  };

  return (
    <ResetPasswordForm
      token={token}
      onSubmit={handleResetPassword}
      isLoading={isLoading}
      error={error}
      isSuccess={isSuccess}
      loginUrl="/login"
    />
  );
}
```

---

### 5. SocialLogin - 社交登录组件

支持 GitHub 和 Google 的社交登录组件。

**特性：**
- ✅ GitHub 登录
- ✅ Google 登录
- ✅ 可配置启用的提供商
- ✅ 独立加载状态
- ✅ 可选分隔线
- ✅ 自定义样式

**使用示例：**
```tsx
import { SocialLogin, SocialProvider } from '@/features/auth/components';

export default function SocialLoginSection() {
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

  const handleSocialLogin = async (provider: SocialProvider) => {
    setLoadingProvider(provider);
    try {
      // 调用社交登录 API
      await authApi.socialLogin(provider);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <SocialLogin
      onSocialLogin={handleSocialLogin}
      isLoading={!!loadingProvider}
      loadingProvider={loadingProvider}
      providers={['github', 'google']}
      showDivider={true}
      dividerText="或"
    />
  );
}
```

---

## 🎨 完整登录页面示例

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoginForm, SocialLogin, type SocialProvider } from '@/features/auth/components';
import { type LoginFormData } from '@/features/auth/schemas';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(undefined);
    try {
      // 调用登录 API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('登录失败，请检查您的邮箱和密码');
      }

      // 登录成功，跳转到首页
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setLoadingProvider(provider);
    try {
      // 重定向到社交登录
      window.location.href = `/api/auth/${provider}`;
    } catch (err) {
      setError(`${provider} 登录失败`);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">欢迎回来</CardTitle>
          <CardDescription>
            登录您的账户以继续
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 登录表单 */}
          <LoginForm
            onSubmit={handleLogin}
            isLoading={isLoading}
            error={error}
          />

          {/* 社交登录 */}
          <SocialLogin
            onSocialLogin={handleSocialLogin}
            isLoading={!!loadingProvider}
            loadingProvider={loadingProvider}
          />
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            还没有账户？{' '}
            <Link href="/register" className="text-primary hover:underline">
              立即注册
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
```

---

## 🎨 完整注册页面示例

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RegisterForm, SocialLogin, type SocialProvider } from '@/features/auth/components';
import { type RegisterFormData } from '@/features/auth/schemas';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(null);

  const handleRegister = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(undefined);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('注册失败，请稍后重试');
      }

      // 注册成功，跳转到登录页
      router.push('/login?registered=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setLoadingProvider(provider);
    try {
      window.location.href = `/api/auth/${provider}`;
    } catch (err) {
      setError(`${provider} 登录失败`);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">创建账户</CardTitle>
          <CardDescription>
            填写下方信息以注册新账户
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 注册表单 */}
          <RegisterForm
            onSubmit={handleRegister}
            isLoading={isLoading}
            error={error}
          />

          {/* 社交登录 */}
          <SocialLogin
            onSocialLogin={handleSocialLogin}
            isLoading={!!loadingProvider}
            loadingProvider={loadingProvider}
            dividerText="或使用社交账号注册"
          />
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            已有账户？{' '}
            <Link href="/login" className="text-primary hover:underline">
              立即登录
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
```

---

## 📋 验证 Schemas

所有表单都使用 Zod 进行验证，schemas 定义在 `../schemas/index.ts` 中。

### 可用的 Schemas：

1. **loginSchema** - 登录表单验证
2. **registerSchema** - 注册表单验证
3. **forgotPasswordSchema** - 忘记密码表单验证
4. **resetPasswordSchema** - 重置密码表单验证

### 导入示例：

```tsx
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type LoginFormData,
  type RegisterFormData,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
} from '@/features/auth/schemas';
```

---

## 🎯 最佳实践

### 1. 错误处理

始终提供友好的错误消息：

```tsx
try {
  await handleLogin(data);
} catch (err) {
  if (err instanceof Error) {
    setError(err.message);
  } else {
    setError('发生未知错误，请稍后重试');
  }
}
```

### 2. 加载状态

使用 `isLoading` 状态禁用表单交互：

```tsx
<LoginForm
  onSubmit={handleLogin}
  isLoading={isLoading}
  // 这会自动禁用所有输入和按钮
/>
```

### 3. 成功后重定向

登录/注册成功后，应该重定向到适当的页面：

```tsx
const router = useRouter();

const handleLogin = async (data) => {
  await authApi.login(data);
  router.push('/dashboard'); // 或从 query 参数获取 redirect URL
};
```

### 4. 社交登录集成

社交登录通常需要后端配置（OAuth），确保后端 API 已经设置好：

```tsx
const handleSocialLogin = async (provider: SocialProvider) => {
  // 方式 1: 重定向到后端 OAuth 端点
  window.location.href = `/api/auth/${provider}`;

  // 方式 2: 使用 NextAuth.js
  import { signIn } from 'next-auth/react';
  await signIn(provider, { callbackUrl: '/' });
};
```

---

## 🔧 自定义样式

所有组件都使用 Tailwind CSS 和 Shadcn/ui，可以通过传递 className 自定义样式：

```tsx
// 自定义按钮样式（通过修改全局配置）
// 修改 src/shared/components/ui/button.tsx 的 buttonVariants

// 自定义表单间距
<div className="space-y-6">
  <LoginForm onSubmit={handleLogin} />
</div>
```

---

## 📱 响应式设计

所有组件都是完全响应式的，在移动设备上也能良好工作：

```tsx
<div className="flex min-h-screen items-center justify-center p-4">
  <Card className="w-full max-w-md">
    <CardContent>
      <LoginForm onSubmit={handleLogin} />
    </CardContent>
  </Card>
</div>
```

---

## ♿ 无障碍性

所有表单组件都遵循无障碍性最佳实践：

- ✅ 适当的 ARIA 标签
- ✅ 键盘导航支持
- ✅ 表单字段关联
- ✅ 错误消息朗读
- ✅ Focus 状态可见

---

## 🧪 测试

### 单元测试示例：

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('应该正确提交表单数据', async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('邮箱地址'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('密码'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false,
      });
    });
  });
});
```

---

## 📚 相关文档

- [React Hook Form 文档](https://react-hook-form.com/)
- [Zod 文档](https://zod.dev/)
- [Shadcn/ui 文档](https://ui.shadcn.com/)
- [NextAuth.js 文档](https://next-auth.js.org/)

---

**维护者**: Zishu Frontend Team  
**最后更新**: 2025-10-23

