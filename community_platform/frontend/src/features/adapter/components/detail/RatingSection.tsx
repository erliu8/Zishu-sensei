/**
 * 评分区组件
 * @module features/adapter/components/detail
 */

'use client';

import { useState } from 'react';
import { Star, TrendingUp } from 'lucide-react';
import {
  Card,
  Button,
  Progress,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Textarea,
  Label,
} from '@/shared/components';
import { cn } from '@/shared/utils';

/**
 * 评分区组件属性
 */
export interface RatingSectionProps {
  /** 适配器ID */
  adapterId: string;
  /** 当前平均评分 */
  currentRating: number;
  /** 评分总数 */
  ratingCount: number;
  /** 用户当前评分 */
  userRating?: number;
  /** 提交评分回调 */
  onSubmitRating?: (rating: number, comment?: string) => Promise<void>;
  /** 类名 */
  className?: string;
}

/**
 * 星级评分组件
 */
interface StarRatingProps {
  /** 当前评分 */
  rating: number;
  /** 改变评分回调 */
  onChange?: (rating: number) => void;
  /** 是否只读 */
  readonly?: boolean;
  /** 大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 类名 */
  className?: string;
}

function StarRating({ rating, onChange, readonly = false, size = 'md', className }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const displayRating = hoverRating || rating;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHoverRating(star)}
          onMouseLeave={() => !readonly && setHoverRating(0)}
          className={cn(
            'transition-all',
            !readonly && 'cursor-pointer hover:scale-110',
            readonly && 'cursor-default'
          )}
          aria-label={`${star} 星`}
        >
          <Star
            className={cn(
              sizeClasses[size],
              star <= displayRating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-muted-foreground'
            )}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * 评分分布数据
 */
interface RatingDistribution {
  stars: number;
  count: number;
  percentage: number;
}

/**
 * 评分区组件
 */
export function RatingSection({
  currentRating,
  ratingCount,
  userRating,
  onSubmitRating,
  className,
}: RatingSectionProps) {
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(userRating || 0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 模拟评分分布数据（实际应从API获取）
  const ratingDistribution: RatingDistribution[] = [
    { stars: 5, count: Math.floor(ratingCount * 0.6), percentage: 60 },
    { stars: 4, count: Math.floor(ratingCount * 0.25), percentage: 25 },
    { stars: 3, count: Math.floor(ratingCount * 0.1), percentage: 10 },
    { stars: 2, count: Math.floor(ratingCount * 0.03), percentage: 3 },
    { stars: 1, count: Math.floor(ratingCount * 0.02), percentage: 2 },
  ];

  const handleSubmit = async () => {
    if (selectedRating === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmitRating?.(selectedRating, comment);
      setIsRatingDialogOpen(false);
      setComment('');
    } catch (error) {
      console.error('Failed to submit rating:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">用户评价</h3>
        <Button
          onClick={() => setIsRatingDialogOpen(true)}
          variant={userRating ? 'outline' : 'default'}
        >
          <Star className="mr-2 h-4 w-4" />
          {userRating ? '修改评分' : '评分'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 左侧 - 总体评分 */}
        <Card className="p-6">
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">{currentRating.toFixed(1)}</div>
            <StarRating rating={currentRating} readonly size="lg" className="justify-center mb-2" />
            <div className="text-sm text-muted-foreground">
              基于 {ratingCount.toLocaleString()} 条评价
            </div>
          </div>

          {userRating && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">您的评分</span>
                <StarRating rating={userRating} readonly size="sm" />
              </div>
              <div className="text-sm text-muted-foreground">
                感谢您的反馈！
              </div>
            </div>
          )}
        </Card>

        {/* 右侧 - 评分分布 */}
        <Card className="p-6">
          <div className="space-y-3">
            {ratingDistribution.map((item) => (
              <div key={item.stars} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-16">
                  <span className="text-sm font-medium">{item.stars}</span>
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                </div>
                <Progress value={item.percentage} className="flex-1" />
                <div className="w-16 text-right">
                  <span className="text-sm text-muted-foreground">{item.count}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span>评分趋势稳定增长</span>
            </div>
          </div>
        </Card>
      </div>

      {/* 评分对话框 */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{userRating ? '修改评分' : '为此适配器评分'}</DialogTitle>
            <DialogDescription>
              分享您的使用体验，帮助其他用户做出更好的选择
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 星级选择 */}
            <div className="space-y-2">
              <Label>评分</Label>
              <div className="flex items-center gap-4">
                <StarRating
                  rating={selectedRating}
                  onChange={setSelectedRating}
                  size="lg"
                />
                <span className="text-2xl font-bold">
                  {selectedRating > 0 ? selectedRating.toFixed(1) : '--'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedRating === 5 && '非常满意！'}
                {selectedRating === 4 && '很好，推荐使用'}
                {selectedRating === 3 && '还不错'}
                {selectedRating === 2 && '有待改进'}
                {selectedRating === 1 && '不推荐'}
              </p>
            </div>

            {/* 评论文本 */}
            <div className="space-y-2">
              <Label htmlFor="comment">评论（可选）</Label>
              <Textarea
                id="comment"
                placeholder="分享您的使用感受、优点或建议..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {comment.length}/500 字符
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRatingDialogOpen(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedRating === 0 || isSubmitting}
            >
              {isSubmitting ? '提交中...' : '提交评分'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

