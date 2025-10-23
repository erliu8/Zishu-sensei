/**
 * 评论列表组件
 * @module features/adapter/components/detail
 */

'use client';

import { useState } from 'react';
import { Star, ThumbsUp, Flag, CheckCircle, MoreHorizontal } from 'lucide-react';
import {
  Card,
  Avatar,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  EmptyState,
  LoadingSpinner,
  Pagination,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components';
import type { AdapterRating } from '../../domain';
import { cn } from '@/shared/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 评论列表组件属性
 */
export interface ReviewListProps {
  /** 适配器ID */
  adapterId: string;
  /** 评论列表（如果提供，则使用此数据而不是从API加载） */
  reviews?: AdapterRating[];
  /** 是否加载中 */
  isLoading?: boolean;
  /** 点赞处理函数 */
  onLike?: (reviewId: string) => void;
  /** 举报处理函数 */
  onReport?: (reviewId: string) => void;
  /** 删除处理函数（仅对自己的评论） */
  onDelete?: (reviewId: string) => void;
  /** 类名 */
  className?: string;
}

/**
 * 排序选项
 */
type SortOption = 'recent' | 'helpful' | 'rating_high' | 'rating_low';

/**
 * 筛选选项
 */
type FilterOption = 'all' | '5' | '4' | '3' | '2' | '1' | 'verified';

/**
 * 单条评论组件
 */
interface ReviewItemProps {
  review: AdapterRating;
  onLike?: (reviewId: string) => void;
  onReport?: (reviewId: string) => void;
  onDelete?: (reviewId: string) => void;
  isOwner?: boolean;
}

function ReviewItem({ review, onLike, onReport, onDelete, isOwner }: ReviewItemProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(review.likes);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
    onLike?.(review.id);
  };

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        {/* 头像 */}
        <Avatar
          src={review.userAvatar}
          alt={review.username}
          fallback={review.username[0]}
          size="md"
        />

        {/* 评论内容 */}
        <div className="flex-1 min-w-0">
          {/* 用户信息和评分 */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold">{review.username}</span>
                {review.verified && (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    已验证
                  </Badge>
                )}
              </div>

              {/* 星级和时间 */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-4 w-4',
                        i < review.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-none text-muted-foreground'
                      )}
                    />
                  ))}
                </div>
                <span>·</span>
                <span>
                  {formatDistanceToNow(new Date(review.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </div>
            </div>

            {/* 操作菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwner ? (
                  <DropdownMenuItem onClick={() => onDelete?.(review.id)} className="text-destructive">
                    删除评论
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onReport?.(review.id)}>
                    <Flag className="mr-2 h-4 w-4" />
                    举报
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* 评论文本 */}
          {review.comment && (
            <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap">{review.comment}</p>
          )}

          {/* 更新时间（如果有编辑） */}
          {review.updatedAt !== review.createdAt && (
            <p className="text-xs text-muted-foreground mb-3">
              已编辑于 {new Date(review.updatedAt).toLocaleDateString('zh-CN')}
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={cn(isLiked && 'text-primary')}
            >
              <ThumbsUp className={cn('mr-2 h-4 w-4', isLiked && 'fill-current')} />
              有帮助 {likeCount > 0 && `(${likeCount})`}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * 评论列表组件
 */
export function ReviewList({
  adapterId,
  reviews: initialReviews,
  isLoading: initialLoading,
  onLike,
  onReport,
  onDelete,
  className,
}: ReviewListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 模拟数据（实际应从API获取）
  const [reviews] = useState<AdapterRating[]>(
    initialReviews || [
      {
        id: '1',
        adapterId,
        userId: 'user1',
        username: 'AI开发者',
        userAvatar: undefined,
        rating: 5,
        comment: '非常优秀的适配器！作为一个智能硬适配器，它的代码生成能力令人印象深刻。使用它处理数据分析任务时，不仅准确度高，而且生成的代码质量也很好。强烈推荐！',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-01-15T10:30:00Z',
        likes: 42,
        verified: true,
      },
      {
        id: '2',
        adapterId,
        userId: 'user2',
        username: '数据分析师',
        userAvatar: undefined,
        rating: 4,
        comment: '总体很满意，能够快速完成复杂的数据分析任务。唯一的小建议是希望能支持更多的图表类型。',
        createdAt: '2024-01-14T15:20:00Z',
        updatedAt: '2024-01-14T15:20:00Z',
        likes: 28,
        verified: true,
      },
      {
        id: '3',
        adapterId,
        userId: 'user3',
        username: '前端工程师',
        userAvatar: undefined,
        rating: 5,
        comment: '作为软适配器的典范，RAG能力非常强大。知识检索准确，回答专业。',
        createdAt: '2024-01-13T09:15:00Z',
        updatedAt: '2024-01-13T09:15:00Z',
        likes: 35,
        verified: false,
      },
    ]
  );

  const [isLoading] = useState(initialLoading || false);

  // 筛选和排序评论
  const filteredAndSortedReviews = reviews
    .filter((review) => {
      if (filterBy === 'all') return true;
      if (filterBy === 'verified') return review.verified;
      return review.rating === parseInt(filterBy);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'helpful':
          return b.likes - a.likes;
        case 'rating_high':
          return b.rating - a.rating;
        case 'rating_low':
          return a.rating - b.rating;
        default:
          return 0;
      }
    });

  // 分页
  const totalPages = Math.ceil(filteredAndSortedReviews.length / pageSize);
  const paginatedReviews = filteredAndSortedReviews.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<Star className="h-12 w-12" />}
        title="暂无评价"
        description="成为第一个评价此适配器的用户"
      />
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* 筛选和排序控件 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">筛选:</span>
          <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterOption)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部评价</SelectItem>
              <SelectItem value="5">5星</SelectItem>
              <SelectItem value="4">4星</SelectItem>
              <SelectItem value="3">3星</SelectItem>
              <SelectItem value="2">2星</SelectItem>
              <SelectItem value="1">1星</SelectItem>
              <SelectItem value="verified">已验证</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">排序:</span>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">最新</SelectItem>
              <SelectItem value="helpful">最有帮助</SelectItem>
              <SelectItem value="rating_high">评分从高到低</SelectItem>
              <SelectItem value="rating_low">评分从低到高</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 评论列表 */}
      {paginatedReviews.length > 0 ? (
        <div className="space-y-4">
          {paginatedReviews.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              onLike={onLike}
              onReport={onReport}
              onDelete={onDelete}
              isOwner={review.userId === 'current_user'} // 实际应从用户上下文获取
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Star className="h-12 w-12" />}
          title="没有符合条件的评价"
          description="尝试调整筛选条件"
        />
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}

