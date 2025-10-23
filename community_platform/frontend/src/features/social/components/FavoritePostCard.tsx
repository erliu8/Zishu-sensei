/**
 * FavoritePostCard Component
 * 收藏的帖子卡片组件
 */

'use client';

import React from 'react';
import { Heart, MessageCircle, Eye, Trash2, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Favorite } from '../domain/Favorite';

/**
 * FavoritePostCard Props
 */
export interface FavoritePostCardProps {
  /** 收藏项 */
  favorite: Favorite;
  /** 点击卡片回调 */
  onClick?: () => void;
  /** 删除回调 */
  onRemove?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * FavoritePostCard Component
 */
export const FavoritePostCard: React.FC<FavoritePostCardProps> = ({
  favorite,
  onClick,
  onRemove,
  className,
}) => {
  const post = favorite.targetPost;

  if (!post) {
    return null;
  }

  const author = post.author;
  const initials = author?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || author?.username?.slice(0, 2).toUpperCase() || 'U';

  return (
    <Card className={cn('group hover:shadow-md transition-all', className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Author Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={author?.avatar} alt={author?.displayName} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-medium truncate">
                  {author?.displayName || '未知用户'}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{author?.username || 'unknown'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.();
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          {/* Post Content */}
          <div
            className="cursor-pointer space-y-2"
            onClick={onClick}
          >
            <h3 className="font-semibold line-clamp-2 hover:text-primary transition-colors">
              {post.title}
            </h3>
            {post.content && (
              <p className="text-sm text-muted-foreground line-clamp-3">
                {post.content}
              </p>
            )}
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {post.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {post.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{post.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Stats & Date */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {post.likeCount || 0}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {post.commentCount || 0}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {post.viewCount || 0}
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(favorite.createdAt), 'MM/dd', { locale: zhCN })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FavoritePostCard;

