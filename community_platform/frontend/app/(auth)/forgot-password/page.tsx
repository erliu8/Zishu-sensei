'use client';

import * as React from 'react';
import { ForgotPasswordForm } from '@/features/auth/components';
import { AuthApiClient } from '@/features/auth/api';
import type { ForgotPasswordFormData } from '@/features/auth/schemas';

/**
 * 忘记密码页面
 * 路径: /forgot-password
 */
export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  /**
   * 处理表单提交
   */
  const handleSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);
      setError(null);

      await AuthApiClient.requestPasswordReset({
        email: data.email,
      });

      setIsSuccess(true);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        '发送重置链接失败，请稍后重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 表单 */}
      <ForgotPasswordForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error || undefined}
        isSuccess={isSuccess}
      />
    </div>
  );
}

