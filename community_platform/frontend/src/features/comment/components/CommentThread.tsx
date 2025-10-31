/**
 * CommentThread Component
 * 评论线程组件 - 用于展示特定评论及其上下文
 */

'use client';

import { useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { CommentItem } from './CommentItem';
import { useComment } from '../hooks/useComments';
import { cn } from '@/shared/utils/cn';

interface CommentThreadProps {
  commentId: string;
  currentUserId?: string;
  onBack?: () => void;
  showFullThread?: boolean;
  className?: string;
}

/**
 * 评论线程组件
 * 用于展示单个评论及其完整上下文（父评论链 + 回复）
 */
export function CommentThread({
  commentId,
  currentUserId,
  onBack,
  showFullThread = true,
  className,
}: CommentThreadProps) {
  const { data: comment, isLoading, isError, error } = useComment(commentId);

  // 构建评论路径（从根到当前评论）
  const commentPath = useMemo(() => {
    if (!comment) return [];
    // TODO: 需要获取完整的评论树才能构建路径
    // 这里简化处理，只显示当前评论
    return [comment];
  }, [comment]);

  if (isLoading) {
    return <CommentThreadSkeleton className={className} />;
  }

  if (isError || !comment) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-destructive">
          {error?.message || '评论不存在或已被删除'}
        </p>
        {onBack && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onBack}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 头部操作栏 */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          )}
          <h3 className="text-lg font-semibold">评论详情</h3>
        </div>

        <Button variant="ghost" size="sm" asChild>
          <a
            href={`#comment-${commentId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            在原文查看
          </a>
        </Button>
      </div>

      {/* 评论路径（面包屑） */}
      {showFullThread && commentPath.length > 1 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">评论上下文:</div>
          {commentPath.slice(0, -1).map((parentComment, index) => (
            <div
              key={parentComment.id}
              className={cn(
                'opacity-60',
                index < commentPath.length - 2 && 'ml-4'
              )}
            >
              <CommentItem
                comment={parentComment}
                currentUserId={currentUserId}
                showReplies={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* 目标评论（高亮） */}
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
        <CommentItem comment={comment} currentUserId={currentUserId} />
      </div>
    </div>
  );
}

/**
 * 骨架屏
 */
function CommentThreadSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2 pb-4 border-b">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

