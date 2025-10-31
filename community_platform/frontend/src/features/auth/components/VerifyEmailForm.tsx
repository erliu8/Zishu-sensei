'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Mail, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

/**
 * 邮箱验证状态
 */
export type VerifyEmailStatus = 'idle' | 'verifying' | 'success' | 'error';

export interface VerifyEmailFormProps {
  /**
   * 验证码（从 URL 或邮件获取）
   */
  code?: string;
  /**
   * 验证成功回调
   */
  onVerify: (code: string) => Promise<void>;
  /**
   * 重新发送验证邮件回调
   */
  onResendEmail: (email: string) => Promise<void>;
  /**
   * 当前状态
   */
  status: VerifyEmailStatus;
  /**
   * 错误信息
   */
  error?: string;
  /**
   * 是否显示加载状态
   */
  isLoading?: boolean;
  /**
   * 用户邮箱（可选）
   */
  userEmail?: string;
  /**
   * 返回登录页链接
   */
  loginUrl?: string;
}

const resendEmailSchema = z.object({
  email: z
    .string()
    .min(1, { message: '请输入邮箱地址' })
    .email({ message: '请输入有效的邮箱地址' }),
});

type ResendEmailFormData = z.infer<typeof resendEmailSchema>;

/**
 * 邮箱验证表单组件
 *
 * @example
 * ```tsx
 * <VerifyEmailForm
 *   code={verificationCode}
 *   onVerify={handleVerify}
 *   onResendEmail={handleResendEmail}
 *   status={status}
 *   error={error}
 * />
 * ```
 */
export function VerifyEmailForm({
  code,
  onVerify,
  onResendEmail,
  status,
  error,
  isLoading: _isLoading = false,
  userEmail,
  loginUrl = '/login',
}: VerifyEmailFormProps) {
  const [isResending, setIsResending] = React.useState(false);
  const [showResendForm, setShowResendForm] = React.useState(false);

  const form = useForm<ResendEmailFormData>({
    resolver: zodResolver(resendEmailSchema),
    defaultValues: {
      email: userEmail || '',
    },
  });

  // 自动验证（如果提供了验证码）
  React.useEffect(() => {
    if (code && status === 'idle') {
      onVerify(code);
    }
  }, [code, status, onVerify]);

  const handleResendSubmit = async (data: ResendEmailFormData) => {
    try {
      setIsResending(true);
      await onResendEmail(data.email);
      setShowResendForm(false);
    } catch (err) {
      console.error('Resend email error:', err);
    } finally {
      setIsResending(false);
    }
  };

  // 验证中状态
  if (status === 'verifying') {
    return (
      <div className="w-full space-y-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/20"></div>
            <div className="relative rounded-full bg-primary/10 p-4">
              <Mail className="h-8 w-8 text-primary animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">正在验证</h3>
            <p className="text-sm text-muted-foreground">
              请稍候，我们正在验证您的邮箱...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 验证成功状态
  if (status === 'success') {
    return (
      <div className="w-full space-y-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-success/10 p-3">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">邮箱验证成功！</h3>
            <p className="text-sm text-muted-foreground">
              您的邮箱已成功验证，现在可以使用您的账号了。
            </p>
          </div>
        </div>

        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            您的账号已激活，可以开始使用 Zishu 社区平台的所有功能了。
          </AlertDescription>
        </Alert>

        <Link href={loginUrl} className="block">
          <Button className="w-full">前往登录</Button>
        </Link>
      </div>
    );
  }

  // 验证失败或需要重新发送
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold">验证您的邮箱</h3>
        <p className="text-sm text-muted-foreground">
          {code
            ? '验证码无效或已过期，请重新发送验证邮件。'
            : '我们已向您的邮箱发送了验证链接，请检查您的邮箱。'}
        </p>
      </div>

      {/* 错误提示 */}
      {error && status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 提示信息 */}
      {!code && (
        <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">没有收到邮件？</p>
          <ul className="list-inside list-disc space-y-1">
            <li>请检查垃圾邮件文件夹</li>
            <li>确认邮箱地址是否正确</li>
            <li>等待几分钟后重试</li>
          </ul>
        </div>
      )}

      {/* 重新发送表单 */}
      {showResendForm ? (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleResendSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱地址</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10"
                        disabled={isResending}
                        autoComplete="email"
                        autoFocus
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    请输入您注册时使用的邮箱地址
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1"
                loading={isResending}
                disabled={isResending}
              >
                发送验证邮件
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowResendForm(false)}
                disabled={isResending}
              >
                取消
              </Button>
            </div>
          </form>
        </Form>
      ) : (
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowResendForm(true)}
          >
            重新发送验证邮件
          </Button>

          <Link href={loginUrl} className="block">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回登录
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

