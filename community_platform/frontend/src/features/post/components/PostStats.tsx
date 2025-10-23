/**
 * PostStats 组件 - 帖子统计信息
 * 显示浏览量、点赞数、评论数等统计数据
 */

'use client';

import { FC, memo } from 'react';
import { Eye, Heart, MessageCircle, Share2, Bookmark, TrendingUp } from 'lucide-react';

import { PostStats as PostStatsType } from '../domain/post.types';
import { Card, CardContent } from '@/shared/components/ui/card';
import { cn } from '@/shared/utils/cn';

export interface PostStatsProps {
  stats: PostStatsType;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
  showLabels?: boolean;
}

const StatItem: FC<{
  icon: React.ReactNode;
  value: number;
  label?: string;
  color?: string;
}> = ({ icon, value, label, color }) => (
  <div className="flex items-center gap-2">
    <div className={cn('text-muted-foreground', color)}>
      {icon}
    </div>
    <div className="flex flex-col">
      <span className="text-lg font-semibold">{value.toLocaleString()}</span>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  </div>
);

export const PostStats: FC<PostStatsProps> = memo(({
  stats,
  className,
  variant = 'default',
  showLabels = false,
}) => {
  // 紧凑模式
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-4 text-sm text-muted-foreground', className)}>
        <div className="flex items-center gap-1">
          <Eye className="h-4 w-4" />
          <span>{stats.views.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Heart className="h-4 w-4" />
          <span>{stats.likes.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageCircle className="h-4 w-4" />
          <span>{stats.comments.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Bookmark className="h-4 w-4" />
          <span>{stats.favorites.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Share2 className="h-4 w-4" />
          <span>{stats.shares.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  // 详细模式
  if (variant === 'detailed') {
    const totalEngagement = stats.likes + stats.comments + stats.favorites + stats.shares;
    const engagementRate = stats.views > 0 
      ? ((totalEngagement / stats.views) * 100).toFixed(2) 
      : '0';

    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* 标题 */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">帖子数据</h3>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span>{engagementRate}% 互动率</span>
              </div>
            </div>

            {/* 统计网格 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <StatItem
                icon={<Eye className="h-5 w-5" />}
                value={stats.views}
                label={showLabels ? '浏览量' : undefined}
              />
              <StatItem
                icon={<Heart className="h-5 w-5" />}
                value={stats.likes}
                label={showLabels ? '点赞数' : undefined}
                color="text-red-500"
              />
              <StatItem
                icon={<MessageCircle className="h-5 w-5" />}
                value={stats.comments}
                label={showLabels ? '评论数' : undefined}
                color="text-blue-500"
              />
              <StatItem
                icon={<Bookmark className="h-5 w-5" />}
                value={stats.favorites}
                label={showLabels ? '收藏数' : undefined}
                color="text-yellow-500"
              />
              <StatItem
                icon={<Share2 className="h-5 w-5" />}
                value={stats.shares}
                label={showLabels ? '分享数' : undefined}
                color="text-purple-500"
              />
            </div>

            {/* 总互动数 */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">总互动数</span>
                <span className="text-2xl font-bold">{totalEngagement.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 默认模式
  return (
    <div className={cn('flex items-center gap-6', className)}>
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm font-medium">{stats.views.toLocaleString()}</span>
        {showLabels && <span className="text-xs text-muted-foreground">浏览</span>}
      </div>
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-red-500" />
        <span className="text-sm font-medium">{stats.likes.toLocaleString()}</span>
        {showLabels && <span className="text-xs text-muted-foreground">点赞</span>}
      </div>
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-blue-500" />
        <span className="text-sm font-medium">{stats.comments.toLocaleString()}</span>
        {showLabels && <span className="text-xs text-muted-foreground">评论</span>}
      </div>
      <div className="flex items-center gap-2">
        <Bookmark className="h-5 w-5 text-yellow-500" />
        <span className="text-sm font-medium">{stats.favorites.toLocaleString()}</span>
        {showLabels && <span className="text-xs text-muted-foreground">收藏</span>}
      </div>
      <div className="flex items-center gap-2">
        <Share2 className="h-5 w-5 text-purple-500" />
        <span className="text-sm font-medium">{stats.shares.toLocaleString()}</span>
        {showLabels && <span className="text-xs text-muted-foreground">分享</span>}
      </div>
    </div>
  );
});

PostStats.displayName = 'PostStats';

