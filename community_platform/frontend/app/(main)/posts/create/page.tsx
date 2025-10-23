/**
 * 创建帖子页
 * @route /posts/create
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PostEditor } from '@/features/post/components';
import { useCreatePost } from '@/features/post/hooks';
import { useAuth } from '@/features/auth/hooks';
import { PostStatus } from '@/features/post/domain';
import type { CreatePostInput } from '@/features/post/domain';
import {
  Button,
  Alert,
  AlertDescription,
  Separator,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  useToast,
} from '@/shared/components';
import { LoadingSpinner } from '@/shared/components/common';
import { ArrowLeft, FileText } from 'lucide-react';

/**
 * 创建帖子页面组件
 */
export default function CreatePostPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  // 表单数据状态
  const [formData] = useState<CreatePostInput>({
    title: '',
    content: '',
    summary: '',
    coverImage: '',
    categoryId: undefined,
    tagIds: [],
    status: PostStatus.DRAFT,
  });

  // 创建帖子 mutation
  const createPostMutation = useCreatePost();

  // 处理返回
  const handleBack = () => {
    router.back();
  };

  // 处理保存 - 由 PostEditor 调用
  const handleSave = async (data: CreatePostInput) => {
    try {
      const post = await createPostMutation.mutateAsync(data as any);

      toast({
        title: '成功',
        description: data.status === PostStatus.PUBLISHED ? '帖子发布成功！' : '草稿已保存',
      });

      if (data.status === PostStatus.PUBLISHED) {
        router.push(`/posts/${post.id}`);
      } else {
        router.push(`/posts/${post.id}/edit`);
      }
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '保存失败，请稍后重试',
        variant: 'destructive',
      });
      throw error; // 让 PostEditor 知道保存失败了
    }
  };

  // 处理取消
  const handleCancel = () => {
    router.back();
  };

  // 认证加载中
  if (isAuthLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  // 未登录
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>需要登录</CardTitle>
              <CardDescription>
                发布帖子需要先登录账号
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button onClick={() => router.push('/login')}>
                  去登录
                </Button>
                <Button variant="outline" onClick={() => router.back()}>
                  返回
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 页面头部 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>

          <div>
            <h1 className="text-3xl font-bold mb-2">发布新帖子</h1>
            <p className="text-muted-foreground">
              分享你的想法、教程或问题
            </p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* 提示信息 */}
        <Alert className="mb-6">
          <FileText className="h-4 w-4" />
          <AlertDescription>
            发布前请确保内容符合社区规范。支持 Markdown 格式，可以插入代码、图片和链接。
          </AlertDescription>
        </Alert>

        {/* 编辑器 */}
        <PostEditor
          initialData={formData as any}
          onSave={handleSave as any}
          onCancel={handleCancel}
          mode="create"
        />

        {/* 发布提示 */}
        <div className="mt-6 text-sm text-muted-foreground text-center">
          <p>
            发布即表示你同意
            <Button variant="link" className="px-1 h-auto">
              社区规范
            </Button>
            和
            <Button variant="link" className="px-1 h-auto">
              服务条款
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
}

