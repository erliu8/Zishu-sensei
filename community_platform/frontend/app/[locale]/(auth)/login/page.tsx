'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { LoginForm, SocialLogin } from '@/features/auth/components';
import { useAuth } from '@/features/auth/hooks';
import type { LoginFormData } from '@/features/auth/schemas';
import type { SocialProvider } from '@/features/auth/components/SocialLogin';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { AlertCircle } from 'lucide-react';

/**
 * 登录页面内容组件
 */
function LoginPageContent() {
  const { login, loginWithOAuth, isLoading, error } = useAuth();
  const searchParams = useSearchParams();
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [socialProvider, setSocialProvider] = React.useState<SocialProvider | null>(null);

  // 从 URL 获取重定向路径和错误信息
  const redirectTo = searchParams.get('redirect') || '/';
  const urlError = searchParams.get('error');
  const sessionExpired = searchParams.get('session_expired');

  React.useEffect(() => {
    if (urlError) {
      setLoginError('登录失败，请重试');
    }
    if (sessionExpired) {
      setLoginError('会话已过期，请重新登录');
    }
  }, [urlError, sessionExpired]);

  /**
   * 处理表单提交
   */
  const handleSubmit = async (data: LoginFormData) => {
    setLoginError(null);

    const result = await login(
      {
        email: data.email,
        password: data.password,
        remember: data.rememberMe,
      },
      redirectTo
    );

    if (!result.success && result.error) {
      setLoginError(result.error);
    }
  };

  /**
   * 处理社交登录
   */
  const handleSocialLogin = async (provider: SocialProvider) => {
    setLoginError(null);
    setSocialProvider(provider);
    await loginWithOAuth(provider, redirectTo);
  };

  const displayError = loginError || error;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">欢迎回来</h1>
        <p className="text-muted-foreground">
          登录您的账号以继续使用 Zishu 社区平台
        </p>
      </div>

      {/* 会话过期提示 */}
      {sessionExpired && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            您的会话已过期，请重新登录以继续使用。
          </AlertDescription>
        </Alert>
      )}

      {/* 登录表单 */}
      <LoginForm
        onSubmit={handleSubmit}
        isLoading={isLoading && !socialProvider}
        error={displayError || undefined}
      />

      {/* 社交登录 */}
      <SocialLogin
        onSocialLogin={handleSocialLogin}
        isLoading={isLoading}
        loadingProvider={socialProvider}
      />

      {/* 注册链接 */}
      <div className="text-center text-sm">
        <span className="text-muted-foreground">还没有账号？ </span>
        <Link
          href={`/register${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
          className="font-medium text-primary hover:underline"
        >
          立即注册
        </Link>
      </div>
    </div>
  );
}

/**
 * 登录页面
 * 路径: /login
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="space-y-6 animate-pulse">
      <div className="space-y-2 text-center">
        <div className="h-9 bg-muted rounded w-48 mx-auto" />
        <div className="h-5 bg-muted rounded w-96 mx-auto" />
      </div>
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </div>
    </div>}>
      <LoginPageContent />
    </Suspense>
  );
}

