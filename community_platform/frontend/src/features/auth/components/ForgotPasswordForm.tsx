'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

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
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../schemas';

export interface ForgotPasswordFormProps {
  /**
   * 提交成功回调
   */
  onSubmit: (data: ForgotPasswordFormData) => Promise<void>;
  /**
   * 是否显示加载状态
   */
  isLoading?: boolean;
  /**
   * 错误信息
   */
  error?: string;
  /**
   * 是否已成功发送
   */
  isSuccess?: boolean;
  /**
   * 返回登录页链接
   */
  backToLoginUrl?: string;
}

/**
 * 忘记密码表单组件
 *
 * @example
 * ```tsx
 * <ForgotPasswordForm
 *   onSubmit={handleForgotPassword}
 *   isLoading={isLoading}
 *   error={error}
 *   isSuccess={isSuccess}
 * />
 * ```
 */
export function ForgotPasswordForm({
  onSubmit,
  isLoading = false,
  error,
  isSuccess = false,
  backToLoginUrl = '/login',
}: ForgotPasswordFormProps) {
  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleSubmit = async (data: ForgotPasswordFormData) => {
    try {
      await onSubmit(data);
    } catch (err) {
      console.error('Forgot password error:', err);
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
            <h3 className="text-lg font-semibold">邮件已发送</h3>
            <p className="text-sm text-muted-foreground">
              我们已向您的邮箱发送了密码重置链接。
              <br />
              请检查您的邮箱并点击链接重置密码。
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium">没有收到邮件？</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>请检查垃圾邮件文件夹</li>
              <li>确认邮箱地址是否正确</li>
              <li>等待几分钟后重试</li>
            </ul>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => form.reset()}
          >
            重新发送
          </Button>

          <Link href={backToLoginUrl} className="block">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回登录
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* 说明文字 */}
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold">忘记密码？</h3>
        <p className="text-sm text-muted-foreground">
          请输入您的邮箱地址，我们将向您发送密码重置链接。
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
          {/* 邮箱字段 */}
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
                      disabled={isLoading}
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

          {/* 提交按钮 */}
          <Button type="submit" className="w-full" loading={isLoading}>
            发送重置链接
          </Button>

          {/* 返回登录 */}
          <Link href={backToLoginUrl} className="block">
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={isLoading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回登录
            </Button>
          </Link>
        </form>
      </Form>
    </div>
  );
}

