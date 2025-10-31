'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { VerifyEmailForm, type VerifyEmailStatus } from '@/features/auth/components';
import { AuthApiClient } from '@/features/auth/api';

/**
 * 邮箱验证页面内容组件
 */
function VerifyEmailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<VerifyEmailStatus>('idle');
  const [error, setError] = React.useState<string | null>(null);

  // 从 URL 获取验证码
  const code = searchParams.get('code');
  const email = searchParams.get('email');

  /**
   * 处理邮箱验证
   */
  const handleVerify = React.useCallback(
    async (verificationCode: string) => {
      try {
        setStatus('verifying');
        setError(null);

        // 调用 API 验证邮箱
        await AuthApiClient.verifyEmail({
          token: verificationCode,
        });

        setStatus('success');

        // 3秒后自动跳转到登录页
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          '验证失败，验证码可能已过期或无效';
        setError(errorMessage);
        setStatus('error');
      }
    },
    [router]
  );

  /**
   * 处理重新发送验证邮件
   */
  const handleResendEmail = async (emailAddress: string) => {
    try {
      setError(null);

      await AuthApiClient.resendVerificationEmail({
        email: emailAddress,
      });

      // 重置状态，等待用户从邮件点击链接
      setStatus('idle');
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        '发送验证邮件失败，请稍后重试';
      setError(errorMessage);
      throw err; // 让表单组件处理错误
    }
  };

  return (
    <div className="space-y-6">
      <VerifyEmailForm
        code={code || undefined}
        onVerify={handleVerify}
        onResendEmail={handleResendEmail}
        status={status}
        error={error || undefined}
        userEmail={email || undefined}
      />
    </div>
  );
}

/**
 * 邮箱验证页面
 * 路径: /verify-email?code=xxx
 */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="space-y-6 animate-pulse">
      <div className="space-y-2 text-center">
        <div className="h-9 bg-muted rounded w-48 mx-auto" />
        <div className="h-5 bg-muted rounded w-96 mx-auto" />
      </div>
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </div>
    </div>}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}

