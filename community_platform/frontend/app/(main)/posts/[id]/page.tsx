/**
 * 帖子详情页
 * @route /posts/[id]
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { PostDetail, PostActions, PostStats } from '@/features/post/components';
import { usePost, useDeletePost } from '@/features/post/hooks';
import { useAuth } from '@/features/auth/hooks';
import {
  Button,
  Badge,
  Separator,
  Alert,
  AlertDescription,
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
import { LoadingSpinner, EmptyState, Avatar } from '@/shared/components/common';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Share2,
  Flag,
  Clock,
  Calendar,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 帖子详情页面组件
 */
export default function PostDetailPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;
  const { toast } = useToast();

  // 获取当前用户
  const { user } = useAuth();

  // 获取帖子详情
  const { data: post, isLoading, error } = usePost(postId);

  // 删除帖子 mutation
  const deletePostMutation = useDeletePost();

  // 增加浏览量（仅在首次加载时）
  useEffect(() => {
    if (post) {
      // 这里可以调用 incrementViewCount API
      // postApiClient.incrementViewCount(postId);
    }
  }, [post, postId]);

  // 处理返回
  const handleBack = () => {
    router.back();
  };

  // 处理编辑
  const handleEdit = () => {
    router.push(`/posts/${postId}/edit`);
  };

  // 处理删除
  const handleDelete = async () => {
    try {
      await deletePostMutation.mutateAsync(postId);
      toast({
        title: '成功',
        description: '帖子已删除',
      });
      router.push('/posts');
    } catch (error) {
      toast({
        title: '错误',
        description: '删除失败，请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // 处理分享
  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title,
          text: post?.summary || post?.content.substring(0, 100),
          url,
        });
      } catch (error) {
        // 用户取消分享
      }
    } else {
      // 复制链接到剪贴板
      try {
        await navigator.clipboard.writeText(url);
        toast({
          title: '成功',
          description: '链接已复制到剪贴板',
        });
      } catch (error) {
        toast({
          title: '错误',
          description: '复制失败',
          variant: 'destructive',
        });
      }
    }
  };

  // 处理举报
  const handleReport = () => {
    toast({
      title: '提示',
      description: '举报功能开发中...',
    });
  };

  // 检查是否是作者
  const isAuthor = user?.id === post?.author.id;

  // 加载状态
  if (isLoading) {
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

  // 错误状态
  if (error || !post) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col items-center justify-center py-20">
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
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 面包屑导航 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        </div>

        {/* 帖子内容 */}
        <article className="bg-card rounded-lg border p-6 md:p-8">
          {/* 头部信息 */}
          <header className="mb-6">
            {/* 分类和状态 */}
            <div className="flex items-center gap-2 mb-4">
              {post.category && (
                <Badge
                  variant="secondary"
                  style={{ backgroundColor: post.category.color }}
                >
                  {post.category.name}
                </Badge>
              )}
              {post.status === 'draft' && (
                <Badge variant="outline">草稿</Badge>
              )}
            </div>

            {/* 标题 */}
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              {post.title}
            </h1>

            {/* 作者信息 */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Avatar
                  src={post.author.avatar}
                  alt={post.author.name}
                  size="md"
                  fallback={post.author.name.charAt(0)}
                />
                <div>
                  <div className="font-medium">{post.author.name}</div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(post.createdAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                    {post.updatedAt !== post.createdAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        已编辑
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleShare}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  分享
                </Button>

                {isAuthor ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleEdit}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      编辑
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
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
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReport}
                  >
                    <Flag className="mr-2 h-4 w-4" />
                    举报
                  </Button>
                )}
              </div>
            </div>
          </header>

          <Separator className="my-6" />

          {/* 统计信息 */}
          <PostStats stats={post.stats} className="mb-6" />

          <Separator className="my-6" />

          {/* 封面图片 */}
          {post.coverImage && (
            <div className="mb-8 rounded-lg overflow-hidden">
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* 摘要 */}
          {post.summary && (
            <Alert className="mb-6">
              <AlertDescription className="text-base">
                {post.summary}
              </AlertDescription>
            </Alert>
          )}

          {/* 正文内容 */}
          <PostDetail post={post} />

          {/* 标签 */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-8 pt-6 border-t">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">标签:</span>
                {post.tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-secondary"
                    onClick={() => router.push(`/posts?search=${tag.name}`)}
                  >
                    #{tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 互动操作 */}
          <div className="mt-8 pt-6 border-t">
            <PostActions postId={post.id} />
          </div>
        </article>

        {/* 评论区域 */}
        <div className="mt-8">
          <div className="bg-card rounded-lg border p-6">
            <h2 className="text-2xl font-bold mb-6">
              评论 ({post.stats.comments})
            </h2>
            {/* 这里应该集成评论组件 */}
            <div className="text-center text-muted-foreground py-8">
              评论功能开发中...
            </div>
          </div>
        </div>

        {/* 相关推荐 */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6">相关推荐</h2>
          <div className="text-center text-muted-foreground py-8 bg-card rounded-lg border">
            推荐功能开发中...
          </div>
        </div>
      </div>
    </div>
  );
}

