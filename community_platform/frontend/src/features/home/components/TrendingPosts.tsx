/**
 * TrendingPosts - 热门帖子组件
 * 展示热门和最新的帖子列表
 */

'use client';

import { FC } from 'react';
import { TrendingUp, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { PostCard } from '@/features/post/components/PostCard';
import { usePosts } from '@/features/post/hooks/use-posts';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Button } from '@/shared/components/ui/button';
import Link from 'next/link';
import { cn } from '@/shared/utils/cn';

export interface TrendingPostsProps {
  className?: string;
}

export const TrendingPosts: FC<TrendingPostsProps> = ({ className }) => {
  const { data: hotPosts, isLoading: isLoadingHot, isError: isErrorHot, error: errorHot } = usePosts({
    page: 1,
    pageSize: 6,
    sortBy: 'viewCount',
    sortOrder: 'desc',
  });

  const { data: latestPosts, isLoading: isLoadingLatest, isError: isErrorLatest, error: errorLatest } = usePosts({
    page: 1,
    pageSize: 6,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">社区动态</h2>
        <Button variant="ghost" asChild>
          <Link href="/posts">查看全部</Link>
        </Button>
      </div>

      <Tabs defaultValue="hot" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="hot" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            热门帖子
          </TabsTrigger>
          <TabsTrigger value="latest" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            最新发布
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hot" className="mt-6">
          {isLoadingHot ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : isErrorHot ? (
            <EmptyState
              title="加载失败"
              description={errorHot?.message || '无法加载热门帖子，请稍后重试'}
            />
          ) : hotPosts?.data && hotPosts.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hotPosts.data.map((post) => (
                <PostCard key={post.id} post={post} variant="default" />
              ))}
            </div>
          ) : (
            <EmptyState
              title="暂无热门帖子"
              description="快来发布第一篇帖子吧！"
              action={{
                label: '发布帖子',
                onClick: () => window.location.href = '/posts/create'
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="latest" className="mt-6">
          {isLoadingLatest ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : isErrorLatest ? (
            <EmptyState
              title="加载失败"
              description={errorLatest?.message || '无法加载最新帖子，请稍后重试'}
            />
          ) : latestPosts?.data && latestPosts.data.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestPosts.data.map((post) => (
                <PostCard key={post.id} post={post} variant="default" />
              ))}
            </div>
          ) : (
            <EmptyState
              title="暂无帖子"
              description="快来发布第一篇帖子吧！"
              action={{
                label: '发布帖子',
                onClick: () => window.location.href = '/posts/create'
              }}  
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

