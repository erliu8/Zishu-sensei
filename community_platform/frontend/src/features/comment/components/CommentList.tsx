/**
 * CommentList Component
 * 评论列表组件（支持树形结构和虚拟滚动）
 */

'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { MessageSquare, Loader2 } from 'lucide-react';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import { useComments } from '../hooks/useComments';
import {
  CommentTargetType,
  CommentSortBy,
  type CommentListParams,
} from '../domain/comment.types';
import { buildCommentTree } from '../domain/comment.model';
import { cn } from '@/shared/utils/cn';

interface CommentListProps {
  targetType: CommentTargetType;
  targetId: string;
  currentUserId?: string;
  currentUser?: {
    id: string;
    username: string;
    avatar?: string;
  };
  className?: string;
  showForm?: boolean;
  defaultSortBy?: CommentSortBy;
  pageSize?: number;
}

export function CommentList({
  targetType,
  targetId,
  currentUserId,
  currentUser,
  className,
  showForm = true,
  defaultSortBy = CommentSortBy.NEWEST,
  pageSize = 20,
}: CommentListProps) {
  const [sortBy, setSortBy] = useState<CommentSortBy>(defaultSortBy);
  const [page, setPage] = useState(1);

  const params: CommentListParams = {
    targetType,
    targetId,
    page,
    pageSize,
    sortBy,
    parentId: null, // 只获取根评论
  };

  const { data, isLoading, isError, error } = useComments(params);

  // 构建树形结构
  const commentTree = useMemo(() => {
    if (!data?.data) return [];
    return buildCommentTree(data.data);
  }, [data?.data]);

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
  };

  if (isError) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-destructive">
          加载评论失败: {error?.message || '未知错误'}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* 评论头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h3 className="text-lg font-semibold">
            评论 {data?.total ? `(${data.total})` : ''}
          </h3>
        </div>

        {/* 排序选择器 */}
        <Select
          value={sortBy}
          onValueChange={(value) => {
            setSortBy(value as CommentSortBy);
            setPage(1); // 重置页码
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CommentSortBy.NEWEST}>最新</SelectItem>
            <SelectItem value={CommentSortBy.OLDEST}>最早</SelectItem>
            <SelectItem value={CommentSortBy.POPULAR}>最热</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 评论表单 */}
      {showForm && currentUser && (
        <CommentForm
          targetType={targetType}
          targetId={targetId}
          currentUser={currentUser}
        />
      )}

      {/* 评论列表 */}
      {isLoading && page === 1 ? (
        <CommentListSkeleton />
      ) : commentTree.length === 0 ? (
        <EmptyComments />
      ) : (
        <>
          <div className="space-y-6">
            {commentTree.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
              />
            ))}
          </div>

          {/* 加载更多 */}
          {data?.hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    加载中...
                  </>
                ) : (
                  '加载更多'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 骨架屏
 */
function CommentListSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-16 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 空状态
 */
function EmptyComments() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium mb-2">暂无评论</h3>
      <p className="text-sm text-muted-foreground">
        成为第一个发表评论的人吧
      </p>
    </div>
  );
}

