/**
 * PostCard 组件 - 帖子卡片
 * 用于在列表中展示帖子摘要信息
 */

'use client';

import { FC, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS, ja } from 'date-fns/locale';
import { Heart, MessageCircle, Eye, Share2, Bookmark } from 'lucide-react';

import { Post } from '../domain/post.types';
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';

export interface PostCardProps {
  post: Post;
  locale?: 'zh-CN' | 'en-US' | 'ja-JP';
  onLike?: (postId: string) => void;
  onFavorite?: (postId: string) => void;
  onShare?: (postId: string) => void;
  className?: string;
  variant?: 'default' | 'compact' | 'featured';
}

const localeMap = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': ja,
};

export const PostCard: FC<PostCardProps> = memo(({
  post,
  locale = 'zh-CN',
  onLike,
  onFavorite,
  onShare,
  className,
  variant = 'default',
}) => {
  const dateLocale = localeMap[locale];

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onLike?.(post.id);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFavorite?.(post.id);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onShare?.(post.id);
  };

  const formatDate = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { 
        addSuffix: true,
        locale: dateLocale,
      });
    } catch {
      return date;
    }
  };

  return (
    <Link href={`/posts/${post.id}`} className="block">
      <Card 
        className={cn(
          'group hover:shadow-lg transition-all duration-300 cursor-pointer',
          variant === 'featured' && 'border-primary',
          className
        )}
      >
        {/* 封面图片 */}
        {post.coverImage && variant !== 'compact' && (
          <div className="relative w-full h-48 overflow-hidden rounded-t-lg">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            {variant === 'featured' && (
              <div className="absolute top-4 left-4">
                <Badge variant="destructive" className="text-xs">推荐</Badge>
              </div>
            )}
          </div>
        )}

        <CardHeader className={cn(variant === 'compact' && 'pb-2')}>
          {/* 作者信息 */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={post.author.avatar} alt={post.author.name} />
              <AvatarFallback>{post.author.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {post.author.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(post.publishedAt || post.createdAt)}
              </p>
            </div>
            {post.category && (
              <Badge 
                variant="secondary" 
                className="text-xs"
                style={{ 
                  backgroundColor: post.category.color ? `${post.category.color}20` : undefined,
                  color: post.category.color,
                }}
              >
                {post.category.name}
              </Badge>
            )}
          </div>

          {/* 标题 */}
          <h3 className={cn(
            'font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2',
            variant === 'compact' ? 'text-base' : 'text-lg'
          )}>
            {post.title}
          </h3>
        </CardHeader>

        <CardContent className={cn(variant === 'compact' && 'py-2')}>
          {/* 摘要 */}
          {post.summary && variant !== 'compact' && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
              {post.summary}
            </p>
          )}

          {/* 标签 */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.slice(0, 3).map((tag) => (
                <Badge 
                  key={tag.id} 
                  variant="outline" 
                  className="text-xs"
                >
                  #{tag.name}
                </Badge>
              ))}
              {post.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{post.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between pt-4 border-t">
          {/* 统计信息 */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>{post.stats.views.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="h-4 w-4" />
              <span>{post.stats.likes.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              <span>{post.stats.comments.toLocaleString()}</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className="h-8 w-8 p-0"
            >
              <Heart className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFavorite}
              className="h-8 w-8 p-0"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="h-8 w-8 p-0"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
});

PostCard.displayName = 'PostCard';

