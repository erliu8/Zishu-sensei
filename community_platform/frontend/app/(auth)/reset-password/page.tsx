'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ResetPasswordForm } from '@/features/auth/components';
import { AuthApiClient } from '@/features/auth/api';
import type { ResetPasswordFormData } from '@/features/auth/schemas';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import Link from 'next/link';

/**
 * 重置密码页面
 * 路径: /reset-password?token=xxx
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  // 从 URL 获取重置令牌
  const token = searchParams.get('token');

  /**
   * 处理表单提交
   */
  const handleSubmit = async (data: ResetPasswordFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      await AuthApiClient.confirmPasswordReset({
        token: data.token,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      setIsSuccess(true);

      // 3秒后自动跳转到登录页
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        '密码重置失败，请重试或重新申请重置链接';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 如果没有令牌，显示错误提示
  if (!token) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">重置密码</h1>
          <p className="text-muted-foreground">设置您的新密码</p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            无效的重置链接。请确保您使用的是从邮件中收到的完整链接。
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Link href="/forgot-password" className="block">
            <Button className="w-full" variant="outline">
              重新申请重置链接
            </Button>
          </Link>
          <Link href="/login" className="block">
            <Button className="w-full" variant="ghost">
              返回登录
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 表单 */}
      <ResetPasswordForm
        token={token}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error || undefined}
        isSuccess={isSuccess}
      />
    </div>
  );
}

