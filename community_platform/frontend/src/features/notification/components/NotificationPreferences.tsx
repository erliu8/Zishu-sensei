'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Switch } from '@/shared/components/ui/switch';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { useToast } from '@/shared/hooks/use-toast';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '../hooks/useNotifications';

// 表单验证模式
const preferencesSchema = z.object({
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  
  // 通知类型启用设置
  likeEnabled: z.boolean(),
  commentEnabled: z.boolean(),
  followEnabled: z.boolean(),
  mentionEnabled: z.boolean(),
  replyEnabled: z.boolean(),
  shareEnabled: z.boolean(),
  systemEnabled: z.boolean(),
  achievementEnabled: z.boolean(),
  trendingEnabled: z.boolean(),
  
  // 静音设置
  muteAll: z.boolean(),
  muteDuringNight: z.boolean(),
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

/**
 * 通知偏好设置组件
 */
export function NotificationPreferences() {
  const { toast } = useToast();
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferencesMutation = useUpdateNotificationPreferences();

  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      emailEnabled: preferences?.emailEnabled ?? true,
      pushEnabled: preferences?.pushEnabled ?? true,
      
      likeEnabled: preferences?.notificationTypes?.like ?? true,
      commentEnabled: preferences?.notificationTypes?.comment ?? true,
      followEnabled: preferences?.notificationTypes?.follow ?? true,
      mentionEnabled: preferences?.notificationTypes?.mention ?? true,
      replyEnabled: preferences?.notificationTypes?.reply ?? true,
      shareEnabled: preferences?.notificationTypes?.share ?? true,
      systemEnabled: preferences?.notificationTypes?.system ?? true,
      achievementEnabled: preferences?.notificationTypes?.achievement ?? true,
      trendingEnabled: preferences?.notificationTypes?.trending ?? false,
      
      muteAll: preferences?.muteAll ?? false,
      muteDuringNight: preferences?.muteDuringNight ?? false,
    },
    values: preferences
      ? {
          emailEnabled: preferences.emailEnabled,
          pushEnabled: preferences.pushEnabled,
          
          likeEnabled: preferences.notificationTypes.like,
          commentEnabled: preferences.notificationTypes.comment,
          followEnabled: preferences.notificationTypes.follow,
          mentionEnabled: preferences.notificationTypes.mention,
          replyEnabled: preferences.notificationTypes.reply,
          shareEnabled: preferences.notificationTypes.share,
          systemEnabled: preferences.notificationTypes.system,
          achievementEnabled: preferences.notificationTypes.achievement,
          trendingEnabled: preferences.notificationTypes.trending,
          
          muteAll: preferences.muteAll,
          muteDuringNight: preferences.muteDuringNight,
        }
      : undefined,
  });

  const onSubmit = async (data: PreferencesFormData) => {
    try {
      await updatePreferencesMutation.mutateAsync({
        emailEnabled: data.emailEnabled,
        pushEnabled: data.pushEnabled,
        notificationTypes: {
          like: data.likeEnabled,
          comment: data.commentEnabled,
          follow: data.followEnabled,
          mention: data.mentionEnabled,
          reply: data.replyEnabled,
          share: data.shareEnabled,
          system: data.systemEnabled,
          achievement: data.achievementEnabled,
          trending: data.trendingEnabled,
        },
        muteAll: data.muteAll,
        muteDuringNight: data.muteDuringNight,
      });

      toast({
        title: '设置已保存',
        description: '您的通知偏好设置已更新',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description: '无法保存设置，请稍后重试',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 通知渠道 */}
        <Card>
          <CardHeader>
            <CardTitle>通知渠道</CardTitle>
            <CardDescription>
              选择您希望接收通知的方式
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="emailEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">邮件通知</FormLabel>
                    <FormDescription>
                      通过邮件接收重要通知
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pushEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">推送通知</FormLabel>
                    <FormDescription>
                      通过浏览器或移动设备接收推送通知
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 通知类型 */}
        <Card>
          <CardHeader>
            <CardTitle>通知类型</CardTitle>
            <CardDescription>
              选择您希望接收的通知类型
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="likeEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>点赞</FormLabel>
                    <FormDescription className="text-xs">
                      当有人点赞您的内容时通知您
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="commentEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>评论</FormLabel>
                    <FormDescription className="text-xs">
                      当有人评论您的内容时通知您
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="followEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>关注</FormLabel>
                    <FormDescription className="text-xs">
                      当有人关注您时通知您
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="mentionEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>提及</FormLabel>
                    <FormDescription className="text-xs">
                      当有人在内容中提及您时通知您
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="replyEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>回复</FormLabel>
                    <FormDescription className="text-xs">
                      当有人回复您的评论时通知您
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="shareEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>分享</FormLabel>
                    <FormDescription className="text-xs">
                      当有人分享您的内容时通知您
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="systemEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>系统通知</FormLabel>
                    <FormDescription className="text-xs">
                      接收系统相关的重要通知
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="achievementEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>成就</FormLabel>
                    <FormDescription className="text-xs">
                      当您获得成就或徽章时通知您
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="trendingEnabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>热门推荐</FormLabel>
                    <FormDescription className="text-xs">
                      接收热门内容和趋势推荐
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 静音设置 */}
        <Card>
          <CardHeader>
            <CardTitle>静音设置</CardTitle>
            <CardDescription>
              控制何时接收通知
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="muteAll"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">全部静音</FormLabel>
                    <FormDescription>
                      暂时关闭所有通知
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="muteDuringNight"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">夜间勿扰</FormLabel>
                    <FormDescription>
                      晚上 10 点到早上 8 点之间静音通知
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updatePreferencesMutation.isPending}
          >
            {updatePreferencesMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            保存设置
          </Button>
        </div>
      </form>
    </Form>
  );
}

