'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, User, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

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
import { Checkbox } from '@/shared/components/ui/checkbox';
import { registerSchema, type RegisterFormData } from '../schemas';
import { AuthApiClient } from '../api/auth.client';

/**
 * 防抖函数
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export interface RegisterFormProps {
  /**
   * 注册成功回调
   */
  onSubmit: (data: RegisterFormData) => Promise<void>;
  /**
   * 是否显示加载状态
   */
  isLoading?: boolean;
  /**
   * 错误信息
   */
  error?: string;
  /**
   * 服务条款 URL
   */
  termsUrl?: string;
  /**
   * 隐私政策 URL
   */
  privacyUrl?: string;
}

/**
 * 注册表单组件
 *
 * @example
 * ```tsx
 * <RegisterForm
 *   onSubmit={handleRegister}
 *   isLoading={isLoading}
 *   error={error}
 * />
 * ```
 */
export function RegisterForm({
  onSubmit,
  isLoading = false,
  error,
  termsUrl = '/terms',
  privacyUrl = '/privacy',
}: RegisterFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  
  // 用户名验证状态
  const [usernameValidation, setUsernameValidation] = React.useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  // 邮箱验证状态
  const [emailValidation, setEmailValidation] = React.useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: false,
    },
  });

  // 防抖的用户名检查
  const checkUsernameDebounced = React.useMemo(
    () =>
      debounce(async (username: string) => {
        if (!username || username.length < 3) {
          setUsernameValidation({ checking: false, available: null, message: '' });
          return;
        }

        setUsernameValidation({ checking: true, available: null, message: '' });

        try {
          const result = await AuthApiClient.checkUsernameAvailability(username);
          setUsernameValidation({
            checking: false,
            available: result.available,
            message: result.reason,
          });
        } catch (err) {
          setUsernameValidation({
            checking: false,
            available: null,
            message: '',
          });
        }
      }, 500),
    []
  );

  // 防抖的邮箱检查
  const checkEmailDebounced = React.useMemo(
    () =>
      debounce(async (email: string) => {
        // 基础邮箱格式验证
        if (!email || !email.includes('@')) {
          setEmailValidation({ checking: false, available: null, message: '' });
          return;
        }

        setEmailValidation({ checking: true, available: null, message: '' });

        try {
          const result = await AuthApiClient.checkEmailAvailability(email);
          setEmailValidation({
            checking: false,
            available: result.available,
            message: result.reason,
          });
        } catch (err) {
          setEmailValidation({
            checking: false,
            available: null,
            message: '',
          });
        }
      }, 500),
    []
  );

  const handleSubmit = async (data: RegisterFormData) => {
    try {
      await onSubmit(data);
    } catch (err) {
      console.error('Register error:', err);
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
          {/* 用户名字段 */}
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>用户名</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      {...field}
                      type="text"
                      placeholder="您的用户名"
                      className="pl-10 pr-10"
                      disabled={isLoading}
                      autoComplete="username"
                      onChange={(e) => {
                        field.onChange(e);
                        checkUsernameDebounced(e.target.value);
                      }}
                    />
                    {/* 验证状态图标 */}
                    <div className="absolute right-3 top-3">
                      {usernameValidation.checking && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {!usernameValidation.checking && usernameValidation.available === true && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {!usernameValidation.checking && usernameValidation.available === false && (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                </FormControl>
                {/* 显示验证消息或默认描述 */}
                {usernameValidation.message ? (
                  <p
                    className={`text-sm ${
                      usernameValidation.available
                        ? 'text-green-600'
                        : 'text-destructive'
                    }`}
                  >
                    {usernameValidation.message}
                  </p>
                ) : (
                  <FormDescription>
                    3-20个字符，只能包含字母、数字、下划线和连字符
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

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
                      className="pl-10 pr-10"
                      disabled={isLoading}
                      autoComplete="email"
                      onChange={(e) => {
                        field.onChange(e);
                        checkEmailDebounced(e.target.value);
                      }}
                    />
                    {/* 验证状态图标 */}
                    <div className="absolute right-3 top-3">
                      {emailValidation.checking && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {!emailValidation.checking && emailValidation.available === true && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {!emailValidation.checking && emailValidation.available === false && (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                </FormControl>
                {/* 显示验证消息 */}
                {emailValidation.message && (
                  <p
                    className={`text-sm ${
                      emailValidation.available
                        ? 'text-green-600'
                        : 'text-destructive'
                    }`}
                  >
                    {emailValidation.message}
                  </p>
                )}
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
                      autoComplete="new-password"
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

          {/* 确认密码字段 */}
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>确认密码</FormLabel>
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

          {/* 同意条款 */}
          <FormField
            control={form.control}
            name="agreeToTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="cursor-pointer text-sm font-normal">
                    我同意{' '}
                    <Link
                      href={termsUrl}
                      className="text-primary hover:underline"
                      target="_blank"
                    >
                      服务条款
                    </Link>{' '}
                    和{' '}
                    <Link
                      href={privacyUrl}
                      className="text-primary hover:underline"
                      target="_blank"
                    >
                      隐私政策
                    </Link>
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          {/* 提交按钮 */}
          <Button type="submit" className="w-full" loading={isLoading}>
            注册
          </Button>
        </form>
      </Form>
    </div>
  );
}

