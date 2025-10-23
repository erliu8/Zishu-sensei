/**
 * 编辑帖子页
 * @route /posts/[id]/edit
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PostEditor } from '@/features/post/components';
import { usePost, useUpdatePost, useDeletePost } from '@/features/post/hooks';
import { useAuth } from '@/features/auth/hooks';
import type { UpdatePostDto, PostStatus } from '@/features/post/domain';
import {
  Button,
  Alert,
  AlertDescription,
  Separator,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  useToast,
} from '@/shared/components';
import { LoadingSpinner, EmptyState } from '@/shared/components/common';
import { ArrowLeft, Trash2, AlertTriangle } from 'lucide-react';

/**
 * 编辑帖子页面组件
 */
export default function EditPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;
  const { toast } = useToast();

  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // 获取帖子详情
  const { data: post, isLoading: isPostLoading, error } = usePost(postId);

  // 表单数据状态
  const [formData, setFormData] = useState<UpdatePostDto>({
    title: '',
    content: '',
    summary: '',
    coverImage: '',
    categoryId: undefined,
    tagIds: [],
  });

  // Mutations
  const updatePostMutation = useUpdatePost();
  const deletePostMutation = useDeletePost();

  // 初始化表单数据
  useEffect(() => {
    if (post) {
      setFormData({
        title: post.title,
        content: post.content,
        summary: post.summary,
        coverImage: post.coverImage,
        categoryId: post.category?.id,
        tagIds: post.tags?.map((tag) => tag.id),
      });
    }
  }, [post]);

  // 处理返回
  const handleBack = () => {
    router.back();
  };

  // 处理保存 - 由 PostEditor 调用
  const handleSave = async (data: UpdatePostDto) => {
    try {
      await updatePostMutation.mutateAsync({
        id: postId,
        data,
      });

      toast({
        title: '成功',
        description: '保存成功',
      });

      // 如果发布了，跳转到详情页
      if (data.status === 'published') {
        router.push(`/posts/${postId}`);
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
    router.push(`/posts/${postId}`);
  };

  // 删除帖子
  const handleDelete = async () => {
    try {
      await deletePostMutation.mutateAsync(postId);
      toast({
        title: '成功',
        description: '帖子已删除',
      });
      router.push('/posts');
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '删除失败，请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // 认证加载中
  if (isAuthLoading || isPostLoading) {
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
          <EmptyState
            title="需要登录"
            description="编辑帖子需要先登录账号"
            action={{
              label: '去登录',
              onClick: () => router.push('/login'),
            }}
          />
        </div>
      </div>
    );
  }

  // 帖子不存在
  if (error || !post) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <EmptyState
            title="帖子不存在"
            description={error?.message || '该帖子可能已被删除或不存在'}
            action={{
              label: '返回列表',
              onClick: () => router.push('/posts'),
            }}
          />
        </div>
      </div>
    );
  }

  // 权限检查
  if (post.author.id !== user?.id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <EmptyState
            title="无权访问"
            description="你没有权限编辑这篇帖子"
            action={{
              label: '查看帖子',
              onClick: () => router.push(`/posts/${postId}`),
            }}
          />
        </div>
      </div>
    );
  }

  const isDraft = post.status === 'draft';

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

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                编辑帖子
              </h1>
              <p className="text-muted-foreground">
                {isDraft ? '完善草稿并发布' : '修改已发布的帖子'}
              </p>
            </div>

            {/* 删除按钮 */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认删除</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作无法撤销。删除后，这篇帖子将永久消失。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deletePostMutation.isPending ? '删除中...' : '确认删除'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Separator className="my-6" />

        {/* 草稿提示 */}
        {isDraft && (
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              这是一篇草稿。编辑完成后记得点击「立即发布」让更多人看到你的内容。
            </AlertDescription>
          </Alert>
        )}

        {/* 编辑器 */}
        <PostEditor
          initialData={formData}
          onSave={handleSave}
          onCancel={handleCancel}
          mode="edit"
        />
      </div>
    </div>
  );
}

