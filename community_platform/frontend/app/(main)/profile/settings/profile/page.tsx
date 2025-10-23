/**
 * 个人资料设置页面
 * @route /profile/settings/profile
 */

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCurrentUser, useUpdateProfile, useUploadAvatar, useDeleteAvatar } from '@/features/user/hooks/useUser';
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
import { Textarea } from '@/shared/components/ui/textarea';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { toast } from '@/shared/components/ui/use-toast';
import { AvatarUpload } from '@/features/user/components/AvatarUpload';
import { Separator } from '@/shared/components/ui/separator';

const profileFormSchema = z.object({
  name: z.string().min(2, '姓名至少2个字符').max(50, '姓名最多50个字符').optional(),
  bio: z.string().max(500, '简介最多500个字符').optional(),
  location: z.string().max(100, '地区最多100个字符').optional(),
  website: z.string().url('请输入有效的网址').or(z.literal('')).optional(),
  github: z.string().max(50, 'GitHub用户名最多50个字符').optional(),
  twitter: z.string().max(50, 'Twitter用户名最多50个字符').optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfileSettingsPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || '',
      bio: user?.bio || '',
      location: user?.location || '',
      website: user?.website || '',
      github: user?.github || '',
      twitter: user?.twitter || '',
    },
    values: {
      name: user?.name || '',
      bio: user?.bio || '',
      location: user?.location || '',
      website: user?.website || '',
      github: user?.github || '',
      twitter: user?.twitter || '',
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      await updateProfile.mutateAsync(data);
      toast({
        title: '成功',
        description: '个人资料更新成功',
      });
    } catch (error) {
      toast({
        title: '错误',
        description: '个人资料更新失败',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      await uploadAvatar.mutateAsync(file);
      toast({
        title: '成功',
        description: '头像上传成功',
      });
    } catch (error) {
      toast({
        title: '错误',
        description: '头像上传失败',
        variant: 'destructive',
      });
    }
  };

  const handleAvatarDelete = async () => {
    try {
      await deleteAvatar.mutateAsync();
      toast({
        title: '成功',
        description: '头像已删除',
      });
    } catch (error) {
      toast({
        title: '错误',
        description: '删除头像失败',
        variant: 'destructive',
      });
    }
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">个人资料</h2>
        <p className="text-muted-foreground mt-1">更新你的个人信息</p>
      </div>

      {/* 头像上传 */}
      <div className="flex justify-center py-4">
        <AvatarUpload
          currentAvatar={user?.avatar}
          username={user?.username}
          onUpload={handleAvatarUpload}
          onDelete={handleAvatarDelete}
          isUploading={uploadAvatar.isPending || deleteAvatar.isPending}
        />
      </div>

      <Separator />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>姓名</FormLabel>
                <FormControl>
                  <Input placeholder="你的姓名" {...field} />
                </FormControl>
                <FormDescription>这是你在平台上显示的名称</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>简介</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="介绍一下你自己..."
                    className="min-h-[100px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormDescription>简短的个人介绍（最多500字符）</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>地区</FormLabel>
                <FormControl>
                  <Input placeholder="北京, 中国" {...field} />
                </FormControl>
                <FormDescription>你所在的城市或地区</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>个人网站</FormLabel>
                <FormControl>
                  <Input placeholder="https://example.com" type="url" {...field} />
                </FormControl>
                <FormDescription>你的个人网站或博客</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="github"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GitHub</FormLabel>
                <FormControl>
                  <Input placeholder="username" {...field} />
                </FormControl>
                <FormDescription>你的GitHub用户名</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="twitter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Twitter</FormLabel>
                <FormControl>
                  <Input placeholder="username" {...field} />
                </FormControl>
                <FormDescription>你的Twitter用户名</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? '保存中...' : '保存更改'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

