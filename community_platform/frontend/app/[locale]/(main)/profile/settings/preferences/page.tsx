/**
 * 偏好设置页面
 * @route /profile/settings/preferences
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { usePreferences, useUpdatePreferences } from '@/features/user/hooks/useUser';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/shared/components/ui/form';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { toast } from '@/shared/components/ui/use-toast';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Label } from '@/shared/components/ui/label';
import { Palette, Globe, Bell, Lock, Eye, Users, MessageSquare, Heart } from 'lucide-react';

const preferencesFormSchema = z.object({
  // 外观设置
  theme: z.enum(['light', 'dark', 'system']),
  language: z.enum(['zh-CN', 'en-US', 'ja-JP']),
  
  // 通知设置
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  marketingEmails: z.boolean(),
  weeklyDigest: z.boolean(),
  
  // 隐私设置
  profileVisibility: z.enum(['public', 'followers', 'private']),
  showEmail: z.boolean(),
  showActivity: z.boolean(),
  allowFollow: z.boolean(),
  allowComment: z.boolean(),
  allowMessage: z.boolean(),
});

type PreferencesFormValues = z.infer<typeof preferencesFormSchema>;

export default function PreferencesSettingsPage() {
  const { preferences, isLoading: preferencesLoading } = usePreferences();
  const updatePreferences = useUpdatePreferences();

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      theme: preferences?.theme || 'system',
      language: preferences?.language || 'zh-CN',
      emailNotifications: preferences?.emailNotifications ?? true,
      pushNotifications: preferences?.pushNotifications ?? true,
      marketingEmails: preferences?.marketingEmails ?? false,
      weeklyDigest: preferences?.weeklyDigest ?? true,
      profileVisibility: preferences?.profileVisibility || 'public',
      showEmail: preferences?.showEmail ?? false,
      showActivity: preferences?.showActivity ?? true,
      allowFollow: preferences?.allowFollow ?? true,
      allowComment: preferences?.allowComment ?? true,
      allowMessage: preferences?.allowMessage ?? true,
    },
    values: {
      theme: preferences?.theme || 'system',
      language: preferences?.language || 'zh-CN',
      emailNotifications: preferences?.emailNotifications ?? true,
      pushNotifications: preferences?.pushNotifications ?? true,
      marketingEmails: preferences?.marketingEmails ?? false,
      weeklyDigest: preferences?.weeklyDigest ?? true,
      profileVisibility: preferences?.profileVisibility || 'public',
      showEmail: preferences?.showEmail ?? false,
      showActivity: preferences?.showActivity ?? true,
      allowFollow: preferences?.allowFollow ?? true,
      allowComment: preferences?.allowComment ?? true,
      allowMessage: preferences?.allowMessage ?? true,
    },
  });

  const onSubmit = async (data: PreferencesFormValues) => {
    try {
      await updatePreferences.mutateAsync(data);
      toast({
        title: '成功',
        description: '偏好设置更新成功',
      });
    } catch (error) {
      toast({
        title: '错误',
        description: '偏好设置更新失败',
        variant: 'destructive',
      });
    }
  };

  if (preferencesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">偏好设置</h2>
        <p className="text-muted-foreground mt-1">自定义你的使用体验</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 外观设置 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Palette className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>外观</CardTitle>
                  <CardDescription>自定义界面外观</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>主题</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择主题" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">浅色</SelectItem>
                        <SelectItem value="dark">深色</SelectItem>
                        <SelectItem value="system">跟随系统</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>选择你喜欢的界面主题</FormDescription>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 语言设置 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>语言</CardTitle>
                  <CardDescription>选择界面语言</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>界面语言</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择语言" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="zh-CN">简体中文</SelectItem>
                        <SelectItem value="en-US">English</SelectItem>
                        <SelectItem value="ja-JP">日本語</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>选择你偏好的界面语言</FormDescription>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 通知设置 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>通知</CardTitle>
                  <CardDescription>管理你接收的通知</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="emailNotifications"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">邮件通知</FormLabel>
                      <FormDescription>接收重要活动的邮件通知</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pushNotifications"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">推送通知</FormLabel>
                      <FormDescription>接收浏览器推送通知</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marketingEmails"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">营销邮件</FormLabel>
                      <FormDescription>接收产品更新和优惠信息</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weeklyDigest"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">每周摘要</FormLabel>
                      <FormDescription>接收每周活动摘要邮件</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 隐私设置 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>隐私</CardTitle>
                  <CardDescription>控制谁可以看到你的信息和与你互动</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 个人资料可见性 */}
              <FormField
                control={form.control}
                name="profileVisibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>个人资料可见性</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="space-y-3"
                      >
                        <div className="flex items-start space-x-3 rounded-lg border p-4">
                          <RadioGroupItem value="public" id="public" className="mt-0.5" />
                          <div className="flex-1">
                            <Label htmlFor="public" className="font-medium cursor-pointer">
                              公开
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              所有人都可以查看你的个人资料
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 rounded-lg border p-4">
                          <RadioGroupItem value="followers" id="followers" className="mt-0.5" />
                          <div className="flex-1">
                            <Label htmlFor="followers" className="font-medium cursor-pointer">
                              仅关注者
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              只有你的关注者可以查看你的个人资料
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 rounded-lg border p-4">
                          <RadioGroupItem value="private" id="private" className="mt-0.5" />
                          <div className="flex-1">
                            <Label htmlFor="private" className="font-medium cursor-pointer">
                              私密
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              只有你自己可以查看你的个人资料
                            </p>
                          </div>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      设置谁可以查看你的个人资料和发布的内容
                    </FormDescription>
                  </FormItem>
                )}
              />

              {/* 显示邮箱 */}
              <FormField
                control={form.control}
                name="showEmail"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <FormLabel className="text-base">显示邮箱地址</FormLabel>
                      </div>
                      <FormDescription>在个人资料中公开显示你的邮箱地址</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 显示活动 */}
              <FormField
                control={form.control}
                name="showActivity"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-muted-foreground" />
                        <FormLabel className="text-base">显示活动记录</FormLabel>
                      </div>
                      <FormDescription>允许他人查看你的点赞、收藏等活动</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 允许关注 */}
              <FormField
                control={form.control}
                name="allowFollow"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <FormLabel className="text-base">允许关注</FormLabel>
                      </div>
                      <FormDescription>允许其他用户关注你</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 允许评论 */}
              <FormField
                control={form.control}
                name="allowComment"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <FormLabel className="text-base">允许评论</FormLabel>
                      </div>
                      <FormDescription>允许其他用户评论你的帖子</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 允许私信 */}
              <FormField
                control={form.control}
                name="allowMessage"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        <FormLabel className="text-base">允许私信</FormLabel>
                      </div>
                      <FormDescription>允许其他用户给你发送私信</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={updatePreferences.isPending}>
              {updatePreferences.isPending ? '保存中...' : '保存更改'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

