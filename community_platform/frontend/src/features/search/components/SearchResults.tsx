/**
 * 搜索模块 - SearchResults 组件
 * 显示搜索结果列表
 */

'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  FileText,
  Package,
  Heart,
  MessageSquare,
  Eye,
  Download,
  Star,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import {
  SearchType,
  type SearchResultItem,
  type SearchResultPost,
  type SearchResultAdapter,
  type SearchResultCharacter,
  type SearchResultUser,
} from '../domain';

export interface SearchResultsProps {
  /** 搜索结果列表 */
  items: SearchResultItem[];
  /** 是否加载中 */
  isLoading?: boolean;
  /** 类名 */
  className?: string;
}

/**
 * SearchResults 组件
 */
export function SearchResults({ items, isLoading, className }: SearchResultsProps) {
  if (isLoading) {
    return <SearchResultsSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 rounded-full bg-muted p-6">
          <FileText className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-medium">未找到相关结果</h3>
        <p className="text-sm text-muted-foreground">
          请尝试使用其他关键词或调整筛选条件
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {items.map((item) => (
        <Fragment key={`${item.type}-${item.id}`}>
          {item.type === SearchType.POST && <PostResultItem item={item} />}
          {item.type === SearchType.ADAPTER && <AdapterResultItem item={item} />}
          {item.type === SearchType.CHARACTER && <CharacterResultItem item={item} />}
          {item.type === SearchType.USER && <UserResultItem item={item} />}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * 帖子结果项
 */
function PostResultItem({ item }: { item: SearchResultPost }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <Link href={`/posts/${item.id}`} className="group block">
          <div className="mb-2 flex items-start gap-3">
            <FileText className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="flex-1 space-y-2">
              <h3 className="font-medium leading-tight group-hover:text-primary">
                {item.highlight?.title?.[0] ? (
                  <span dangerouslySetInnerHTML={{ __html: item.highlight.title[0] }} />
                ) : (
                  item.title
                )}
              </h3>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {item.highlight?.content?.[0] ? (
                  <span dangerouslySetInnerHTML={{ __html: item.highlight.content[0] }} />
                ) : (
                  item.excerpt
                )}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={item.author.avatar} />
                    <AvatarFallback>{item.author.username[0]}</AvatarFallback>
                  </Avatar>
                  <span>{item.author.username}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {item.viewCount}
                </div>
                <div className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {item.likeCount}
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {item.commentCount}
                </div>
                <span>
                  {formatDistanceToNow(item.createdAt, { addSuffix: true, locale: zhCN })}
                </span>
              </div>
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * 适配器结果项
 */
function AdapterResultItem({ item }: { item: SearchResultAdapter }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <Link href={`/adapters/${item.id}`} className="group block">
          <div className="mb-2 flex items-start gap-3">
            <Package className="mt-1 h-5 w-5 flex-shrink-0 text-purple-600" />
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium leading-tight group-hover:text-primary">
                  {item.highlight?.name?.[0] ? (
                    <span dangerouslySetInnerHTML={{ __html: item.highlight.name[0] }} />
                  ) : (
                    item.name
                  )}
                </h3>
                <div className="flex items-center gap-1">
                  {item.verified && (
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  )}
                  {item.featured && (
                    <Star className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {item.highlight?.description?.[0] ? (
                  <span dangerouslySetInnerHTML={{ __html: item.highlight.description[0] }} />
                ) : (
                  item.description
                )}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={item.author.avatar} />
                    <AvatarFallback>{item.author.username[0]}</AvatarFallback>
                  </Avatar>
                  <span>{item.author.username}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {item.category.name}
                </Badge>
                <span>v{item.version}</span>
                <div className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  {item.downloadCount}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {item.rating.toFixed(1)} ({item.ratingCount})
                </div>
              </div>
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * 角色结果项
 */
function CharacterResultItem({ item }: { item: SearchResultCharacter }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <Link href={`/characters/${item.id}`} className="group block">
          <div className="mb-2 flex items-start gap-3">
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarImage src={item.avatar} />
              <AvatarFallback>{item.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium leading-tight group-hover:text-primary">
                  {item.highlight?.name?.[0] ? (
                    <span dangerouslySetInnerHTML={{ __html: item.highlight.name[0] }} />
                  ) : (
                    item.name
                  )}
                </h3>
                <div className="flex items-center gap-1">
                  {item.verified && (
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  )}
                  {item.featured && (
                    <Star className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {item.highlight?.description?.[0] ? (
                  <span dangerouslySetInnerHTML={{ __html: item.highlight.description[0] }} />
                ) : (
                  item.description
                )}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={item.author.avatar} />
                    <AvatarFallback>{item.author.username[0]}</AvatarFallback>
                  </Avatar>
                  <span>{item.author.username}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  {item.downloadCount}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {item.rating.toFixed(1)} ({item.ratingCount})
                </div>
              </div>
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * 用户结果项
 */
function UserResultItem({ item }: { item: SearchResultUser }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <Link href={`/users/${item.id}`} className="group block">
          <div className="mb-2 flex items-start gap-3">
            <Avatar className="h-12 w-12 flex-shrink-0">
              <AvatarImage src={item.avatar} />
              <AvatarFallback>{item.username[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium leading-tight group-hover:text-primary">
                    {item.highlight?.username?.[0] ? (
                      <span dangerouslySetInnerHTML={{ __html: item.highlight.username[0] }} />
                    ) : (
                      item.username
                    )}
                  </h3>
                  {item.displayName && (
                    <p className="text-sm text-muted-foreground">{item.displayName}</p>
                  )}
                </div>
                {item.verified && (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                )}
              </div>
              {item.bio && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {item.highlight?.bio?.[0] ? (
                    <span dangerouslySetInnerHTML={{ __html: item.highlight.bio[0] }} />
                  ) : (
                    item.bio
                  )}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {item.followerCount} 粉丝
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {item.postCount} 帖子
                </div>
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {item.adapterCount} 适配器
                </div>
              </div>
            </div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

/**
 * 加载骨架屏
 */
function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

