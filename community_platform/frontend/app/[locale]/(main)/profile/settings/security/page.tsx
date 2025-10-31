/**
 * 安全设置页面
 * @route /profile/settings/security
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCurrentUser, useUpdatePassword, useUpdateEmail } from '@/features/user/hooks/useUser';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { toast } from '@/shared/components/ui/use-toast';
import { Shield, Mail, Key, Monitor, History } from 'lucide-react';
import { SessionManager } from '@/features/user/components/SessionManager';
import { LoginHistoryList } from '@/features/user/components/LoginHistoryList';

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    newPassword: z.string().min(8, '新密码至少8个字符').max(100, '新密码最多100个字符'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

const emailFormSchema = z.object({
  newEmail: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码以确认更改'),
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;
type EmailFormValues = z.infer<typeof emailFormSchema>;

export default function SecuritySettingsPage() {
  const { user } = useCurrentUser();
  const userEmail = (user as any)?.email || '';
  const updatePassword = useUpdatePassword();
  const updateEmail = useUpdateEmail();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      newEmail: '',
      password: '',
    },
  });

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    try {
      await updatePassword.mutateAsync(data);
      toast({
        title: '成功',
        description: '密码更新成功',
      });
      passwordForm.reset();
      setShowPasswordForm(false);
    } catch (error) {
      toast({
        title: '错误',
        description: '密码更新失败，请检查当前密码是否正确',
        variant: 'destructive',
      });
    }
  };

  const onEmailSubmit = async (data: EmailFormValues) => {
    try {
      await updateEmail.mutateAsync(data);
      toast({
        title: '成功',
        description: '邮箱更新成功，请查收验证邮件',
      });
      emailForm.reset();
      setShowEmailForm(false);
    } catch (error) {
      toast({
        title: '错误',
        description: '邮箱更新失败',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">安全设置</h2>
        <p className="text-muted-foreground mt-1">管理你的账号安全</p>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">账号安全</span>
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            <span className="hidden sm:inline">会话管理</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">登录历史</span>
          </TabsTrigger>
        </TabsList>

        {/* 账号安全 */}
        <TabsContent value="account" className="space-y-6 mt-6">

      {/* 邮箱设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>邮箱地址</CardTitle>
              <CardDescription>当前邮箱: {userEmail || '未设置'}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!showEmailForm ? (
            <Button variant="outline" onClick={() => setShowEmailForm(true)}>
              更改邮箱
            </Button>
          ) : (
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                <FormField
                  control={emailForm.control}
                  name="newEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>新邮箱地址</FormLabel>
                      <FormControl>
                        <Input placeholder="new@example.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={emailForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>确认密码</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入密码" type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateEmail.isPending}>
                    {updateEmail.isPending ? '保存中...' : '保存'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowEmailForm(false);
                      emailForm.reset();
                    }}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      {/* 密码设置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>密码</CardTitle>
              <CardDescription>定期更新密码以保护账号安全</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!showPasswordForm ? (
            <Button variant="outline" onClick={() => setShowPasswordForm(true)}>
              更改密码
            </Button>
          ) : (
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>当前密码</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入当前密码" type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>新密码</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入新密码" type="password" {...field} />
                      </FormControl>
                      <FormDescription>密码至少8个字符</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>确认新密码</FormLabel>
                      <FormControl>
                        <Input placeholder="请再次输入新密码" type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={updatePassword.isPending}>
                    {updatePassword.isPending ? '保存中...' : '保存'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordForm(false);
                      passwordForm.reset();
                    }}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      {/* 双因素认证 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>双因素认证</CardTitle>
              <CardDescription>增强账号安全性</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            启用双因素认证 (即将推出)
          </Button>
        </CardContent>
      </Card>

      <Separator />

        {/* 危险区域 */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">危险区域</CardTitle>
            <CardDescription>这些操作无法撤销，请谨慎操作</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">删除账号</h4>
              <p className="text-sm text-muted-foreground mb-4">
                删除账号后，你的所有数据将被永久删除，且无法恢复
              </p>
              <Button variant="destructive" disabled>
                删除账号
              </Button>
            </div>
          </CardContent>
        </Card>
        </TabsContent>

        {/* 会话管理 */}
        <TabsContent value="sessions" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>活动会话</CardTitle>
              <CardDescription>
                管理已登录的设备。如果你发现不认识的设备，请立即删除并修改密码。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SessionManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 登录历史 */}
        <TabsContent value="history" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>登录历史</CardTitle>
              <CardDescription>
                查看你的账号登录记录，包括成功和失败的登录尝试。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginHistoryList />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

