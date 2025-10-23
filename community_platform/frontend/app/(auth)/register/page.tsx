'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { RegisterForm, SocialLogin } from '@/features/auth/components';
import { useAuth } from '@/features/auth/hooks';
import type { RegisterFormData } from '@/features/auth/schemas';
import type { SocialProvider } from '@/features/auth/components/SocialLogin';

/**
 * 注册页面
 * 路径: /register
 */
export default function RegisterPage() {
  const { register, loginWithOAuth, isLoading, error } = useAuth();
  const searchParams = useSearchParams();
  const [registerError, setRegisterError] = React.useState<string | null>(null);
  const [socialProvider, setSocialProvider] = React.useState<SocialProvider | null>(null);

  // 从 URL 获取重定向路径
  const redirectTo = searchParams.get('redirect') || '/';

  /**
   * 处理表单提交
   */
  const handleSubmit = async (data: RegisterFormData) => {
    setRegisterError(null);

    const result = await register(
      {
        username: data.username,
        email: data.email,
        password: data.password,
      },
      redirectTo
    );

    if (!result.success && result.error) {
      setRegisterError(result.error);
    }
  };

  /**
   * 处理社交登录
   */
  const handleSocialLogin = async (provider: SocialProvider) => {
    setRegisterError(null);
    setSocialProvider(provider);
    await loginWithOAuth(provider, redirectTo);
  };

  const displayError = registerError || error;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">创建账号</h1>
        <p className="text-muted-foreground">
          加入 Zishu 社区，开启您的 AI 角色创作之旅
        </p>
      </div>

      {/* 注册表单 */}
      <RegisterForm
        onSubmit={handleSubmit}
        isLoading={isLoading && !socialProvider}
        error={displayError || undefined}
      />

      {/* 社交登录 */}
      <SocialLogin
        onSocialLogin={handleSocialLogin}
        isLoading={isLoading}
        loadingProvider={socialProvider}
        dividerText="或使用社交账号注册"
      />

      {/* 登录链接 */}
      <div className="text-center text-sm">
        <span className="text-muted-foreground">已经有账号？ </span>
        <Link
          href={`/login${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
          className="font-medium text-primary hover:underline"
        >
          立即登录
        </Link>
      </div>
    </div>
  );
}

