'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Eye, EyeOff, Lock, CheckCircle2 } from 'lucide-react';

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
import { resetPasswordSchema, type ResetPasswordFormData } from '../schemas';

export interface ResetPasswordFormProps {
  /**
   * 提交成功回调
   */
  onSubmit: (data: ResetPasswordFormData) => Promise<void>;
  /**
   * 重置令牌（从 URL 获取）
   */
  token: string;
  /**
   * 是否显示加载状态
   */
  isLoading?: boolean;
  /**
   * 错误信息
   */
  error?: string;
  /**
   * 是否已成功重置
   */
  isSuccess?: boolean;
  /**
   * 返回登录页链接
   */
  loginUrl?: string;
}

/**
 * 重置密码表单组件
 *
 * @example
 * ```tsx
 * <ResetPasswordForm
 *   token={token}
 *   onSubmit={handleResetPassword}
 *   isLoading={isLoading}
 *   error={error}
 *   isSuccess={isSuccess}
 * />
 * ```
 */
export function ResetPasswordForm({
  onSubmit,
  token,
  isLoading = false,
  error,
  isSuccess = false,
  loginUrl = '/login',
}: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token,
      password: '',
      confirmPassword: '',
    },
  });

  const handleSubmit = async (data: ResetPasswordFormData) => {
    try {
      await onSubmit(data);
    } catch (err) {
      console.error('Reset password error:', err);
    }
  };

  // 成功状态
  if (isSuccess) {
    return (
      <div className="w-full space-y-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="rounded-full bg-success/10 p-3">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">密码重置成功</h3>
            <p className="text-sm text-muted-foreground">
              您的密码已成功重置。
              <br />
              现在您可以使用新密码登录了。
            </p>
          </div>
        </div>

        <Link href={loginUrl} className="block">
          <Button className="w-full">前往登录</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* 说明文字 */}
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold">重置密码</h3>
        <p className="text-sm text-muted-foreground">
          请输入您的新密码。
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* 隐藏的 token 字段 */}
          <FormField
            control={form.control}
            name="token"
            render={({ field }) => <input type="hidden" {...field} />}
          />

          {/* 新密码字段 */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>新密码</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      disabled={isLoading}
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      disabled={isLoading}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormDescription>
                  至少8个字符，包含大小写字母和数字
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 确认新密码字段 */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>确认新密码</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      disabled={isLoading}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 密码强度提示 */}
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium">密码要求：</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>至少 8 个字符</li>
              <li>包含大写字母</li>
              <li>包含小写字母</li>
              <li>包含数字</li>
            </ul>
          </div>

          {/* 提交按钮 */}
          <Button type="submit" className="w-full" loading={isLoading}>
            重置密码
          </Button>

          {/* 返回登录 */}
          <Link href={loginUrl} className="block">
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={isLoading}
            >
              返回登录
            </Button>
          </Link>
        </form>
      </Form>
    </div>
  );
}

