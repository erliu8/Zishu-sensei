/**
 * PostList 组件 - 帖子列表
 * 支持虚拟滚动以优化性能
 */

'use client';

import { FC, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { Post } from '../domain/post.types';
import { PostCard } from './PostCard';
import { EmptyState } from '@/shared/components/common/EmptyState';
import { LoadingSpinner } from '@/shared/components/common/LoadingSpinner';
import { cn } from '@/shared/utils/cn';

export interface PostListProps {
  posts: Post[];
  locale?: 'zh-CN' | 'en-US' | 'ja-JP';
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onLike?: (postId: string) => void;
  onFavorite?: (postId: string) => void;
  onShare?: (postId: string) => void;
  className?: string;
  variant?: 'default' | 'compact' | 'grid';
  enableVirtualization?: boolean;
}

export const PostList: FC<PostListProps> = ({
  posts,
  locale = 'zh-CN',
  loading = false,
  hasMore = false,
  onLoadMore,
  onLike,
  onFavorite,
  onShare,
  className,
  variant = 'default',
  enableVirtualization = true,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // 虚拟滚动配置
  const virtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (variant === 'compact' ? 150 : 400),
    overscan: 5,
    enabled: enableVirtualization && posts.length > 20,
  });

  // 无限滚动处理
  const handleScroll = useCallback(() => {
    if (!parentRef.current || !hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

    if (scrollPercentage > 0.8) {
      onLoadMore?.();
    }
  }, [hasMore, loading, onLoadMore]);

  // 空状态
  if (!loading && posts.length === 0) {
    return (
      <EmptyState
        title="暂无帖子"
        description="还没有发布任何帖子，快去创建第一篇吧！"
        action={{
          label: '创建帖子',
          onClick: () => window.location.href = '/posts/create',
        }}
      />
    );
  }

  // 网格布局
  if (variant === 'grid') {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              locale={locale}
              onLike={onLike}
              onFavorite={onFavorite}
              onShare={onShare}
            />
          ))}
        </div>
        {loading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        )}
      </div>
    );
  }

  // 虚拟滚动列表
  if (enableVirtualization && posts.length > 20) {
    return (
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className={cn('h-full overflow-auto', className)}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const post = posts[virtualItem.index];
            if (!post) return null;
            
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div className="px-4 pb-4">
                  <PostCard
                    post={post}
                    locale={locale}
                    onLike={onLike}
                    onFavorite={onFavorite}
                    onShare={onShare}
                    variant={variant}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {loading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        )}
      </div>
    );
  }

  // 普通列表
  return (
    <div className={cn('space-y-6', className)}>
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          locale={locale}
          onLike={onLike}
          onFavorite={onFavorite}
          onShare={onShare}
          variant={variant}
        />
      ))}
      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      )}
    </div>
  );
};

