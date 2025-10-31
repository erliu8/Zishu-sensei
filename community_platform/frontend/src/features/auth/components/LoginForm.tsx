'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { loginSchema, type LoginFormData } from '../schemas';

export interface LoginFormProps {
  /**
   * 登录成功回调
   */
  onSubmit: (data: LoginFormData) => Promise<void>;
  /**
   * 是否显示加载状态
   */
  isLoading?: boolean;
  /**
   * 错误信息
   */
  error?: string;
  /**
   * 是否显示"记住我"选项
   */
  showRememberMe?: boolean;
  /**
   * 是否显示"忘记密码"链接
   */
  showForgotPassword?: boolean;
  /**
   * 忘记密码链接
   */
  forgotPasswordUrl?: string;
}

/**
 * 登录表单组件
 *
 * @example
 * ```tsx
 * <LoginForm
 *   onSubmit={handleLogin}
 *   isLoading={isLoading}
 *   error={error}
 * />
 * ```
 */
export function LoginForm({
  onSubmit,
  isLoading = false,
  error,
  showRememberMe = true,
  showForgotPassword = true,
  forgotPasswordUrl = '/forgot-password',
}: LoginFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const handleSubmit = async (data: LoginFormData) => {
    try {
      await onSubmit(data);
    } catch (err) {
      // 错误由父组件处理
      console.error('Login error:', err);
    }
  };

  return (
    <div className="w-full space-y-6">
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
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 密码字段 */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>密码</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      disabled={isLoading}
                      autoComplete="current-password"
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
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 记住我 & 忘记密码 */}
          <div className="flex items-center justify-between">
            {showRememberMe && (
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer text-sm font-normal">
                      记住我
                    </FormLabel>
                  </FormItem>
                )}
              />
            )}

            {showForgotPassword && (
              <Link
                href={forgotPasswordUrl}
                className="text-sm text-primary hover:underline"
              >
                忘记密码？
              </Link>
            )}
          </div>

          {/* 提交按钮 */}
          <Button type="submit" className="w-full" loading={isLoading}>
            登录
          </Button>
        </form>
      </Form>
    </div>
  );
}

