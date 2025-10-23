/**
 * PostDetail 组件 - 帖子详情
 * 完整展示帖子的所有信息
 */

'use client';

import { FC, memo } from 'react';
import Image from 'next/image';
import { formatDistanceToNow, format } from 'date-fns';
import { zhCN, enUS, ja } from 'date-fns/locale';
import { Clock, Calendar, User } from 'lucide-react';

import { Post } from '../domain/post.types';
import { PostStats } from './PostStats';
import { PostActions } from './PostActions';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { MarkdownViewer } from '@/shared/components/common/MarkdownViewer';
import { cn } from '@/shared/utils/cn';

export interface PostDetailProps {
  post: Post;
  locale?: 'zh-CN' | 'en-US' | 'ja-JP';
  isLiked?: boolean;
  isFavorited?: boolean;
  isAuthor?: boolean;
  onLike?: (postId: string) => void;
  onFavorite?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onReport?: (postId: string) => void;
  className?: string;
}

const localeMap = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': ja,
};

export const PostDetail: FC<PostDetailProps> = memo(({
  post,
  locale = 'zh-CN',
  isLiked = false,
  isFavorited = false,
  isAuthor = false,
  onLike,
  onFavorite,
  onShare,
  onEdit,
  onDelete,
  onReport,
  className,
}) => {
  const dateLocale = localeMap[locale];

  const formatRelativeDate = (date: string) => {
    try {
      return formatDistanceToNow(new Date(date), { 
        addSuffix: true,
        locale: dateLocale,
      });
    } catch {
      return date;
    }
  };

  const formatAbsoluteDate = (date: string) => {
    try {
      return format(new Date(date), 'PPP', { locale: dateLocale });
    } catch {
      return date;
    }
  };

  return (
    <article className={cn('space-y-8', className)}>
      {/* 头部区域 */}
      <header className="space-y-6">
        {/* 分类和标签 */}
        <div className="flex flex-wrap items-center gap-3">
          {post.category && (
            <Badge 
              variant="secondary" 
              className="text-sm px-3 py-1"
              style={{ 
                backgroundColor: post.category.color ? `${post.category.color}20` : undefined,
                color: post.category.color,
              }}
            >
              {post.category.name}
            </Badge>
          )}
          {post.tags?.map((tag) => (
            <Badge 
              key={tag.id} 
              variant="outline"
              className="text-sm"
            >
              #{tag.name}
            </Badge>
          ))}
        </div>

        {/* 标题 */}
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {post.title}
        </h1>

        {/* 作者和时间信息 */}
        <div className="flex flex-wrap items-center gap-6">
          {/* 作者信息 */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={post.author.avatar} alt={post.author.name} />
              <AvatarFallback>{post.author.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="font-semibold text-foreground">{post.author.name}</span>
              <span className="text-sm text-muted-foreground">@{post.author.username}</span>
            </div>
          </div>

          <Separator orientation="vertical" className="h-12" />

          {/* 时间信息 */}
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{formatRelativeDate(post.publishedAt || post.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatAbsoluteDate(post.publishedAt || post.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* 统计信息 */}
        <PostStats stats={post.stats} variant="compact" />

        <Separator />
      </header>

      {/* 封面图片 */}
      {post.coverImage && (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
          />
        </div>
      )}

      {/* 摘要 */}
      {post.summary && (
        <div className="bg-muted/50 border-l-4 border-primary p-6 rounded-r-lg">
          <p className="text-lg text-muted-foreground italic">
            {post.summary}
          </p>
        </div>
      )}

      {/* 正文内容 */}
      <div className="prose prose-lg dark:prose-invert max-w-none">
        <MarkdownViewer content={post.content} />
      </div>

      <Separator />

      {/* 操作按钮 */}
      <PostActions
        postId={post.id}
        isLiked={isLiked}
        isFavorited={isFavorited}
        isAuthor={isAuthor}
        likesCount={post.stats.likes}
        onLike={onLike}
        onFavorite={onFavorite}
        onShare={onShare}
        onEdit={onEdit}
        onDelete={onDelete}
        onReport={onReport}
      />

      <Separator />

      {/* 详细统计 */}
      <PostStats stats={post.stats} variant="detailed" showLabels />

      {/* 作者简介 */}
      {post.author.bio && (
        <div className="bg-muted/30 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={post.author.avatar} alt={post.author.name} />
              <AvatarFallback>{post.author.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-foreground">关于作者</span>
              </div>
              <h4 className="font-semibold text-lg">{post.author.name}</h4>
              <p className="text-muted-foreground">{post.author.bio}</p>
            </div>
          </div>
        </div>
      )}

      {/* 元数据（用于SEO） */}
      <div className="text-xs text-muted-foreground space-y-1">
        {post.updatedAt !== post.createdAt && (
          <p>最后更新: {formatAbsoluteDate(post.updatedAt)}</p>
        )}
        <p>帖子ID: {post.id}</p>
      </div>
    </article>
  );
});

PostDetail.displayName = 'PostDetail';

