/**
 * CharacterCard - 角色卡片组件
 * 用于在列表、网格视图中展示角色基本信息
 */

import React from 'react';
import Link from 'next/link';
import { cn } from '@/shared/utils';
import { Avatar } from '@/shared/components/common/Avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import type { Character } from '../domain';
import {
  Heart,
  Download,
  Eye,
  Star,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Archive,
  Share2,
  ExternalLink,
} from 'lucide-react';

export interface CharacterCardProps {
  /** 角色数据 */
  character: Character;
  /** 卡片尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 布局模式 */
  variant?: 'grid' | 'list';
  /** 是否显示操作按钮 */
  showActions?: boolean;
  /** 是否可编辑（用户是创建者） */
  isEditable?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 点击回调 */
  onClick?: (character: Character) => void;
  /** 操作回调 */
  onEdit?: (character: Character) => void;
  onDelete?: (character: Character) => void;
  onClone?: (character: Character) => void;
  onArchive?: (character: Character) => void;
  onShare?: (character: Character) => void;
}

/**
 * CharacterCard 组件
 */
export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  size = 'md',
  variant = 'grid',
  showActions = false,
  isEditable = false,
  className,
  onClick,
  onEdit,
  onDelete,
  onClone,
  onArchive,
  onShare,
}) => {
  const {
    id,
    name,
    displayName,
    description,
    avatarUrl,
    coverUrl,
    tags,
    status,
    creatorName,
    stats,
    adapters,
    published,
  } = character;

  // 处理点击事件
  const handleClick = (e: React.MouseEvent) => {
    // 如果点击的是按钮或下拉菜单，不触发卡片点击
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('[role="menuitem"]')
    ) {
      return;
    }
    onClick?.(character);
  };

  // 获取状态标签配置
  const getStatusBadge = () => {
    if (!published) {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-700">
          草稿
        </Badge>
      );
    }
    switch (status) {
      case 'published':
        return (
          <Badge variant="default" className="bg-green-100 text-green-700">
            已发布
          </Badge>
        );
      case 'archived':
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
            已归档
          </Badge>
        );
      default:
        return null;
    }
  };

  // 网格视图（默认）
  if (variant === 'grid') {
    return (
      <Card
        className={cn(
          'group relative overflow-hidden transition-all hover:shadow-lg cursor-pointer',
          size === 'sm' && 'max-w-xs',
          size === 'md' && 'max-w-sm',
          size === 'lg' && 'max-w-md',
          className
        )}
        onClick={handleClick}
      >
        {/* 封面图 */}
        {coverUrl && (
          <div className="relative w-full h-40 overflow-hidden bg-gray-200">
            <img
              src={coverUrl}
              alt={displayName || name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              {getStatusBadge()}
            </div>
          </div>
        )}

        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            {/* 头像 */}
            <Link href={`/characters/${id}`} onClick={(e) => e.stopPropagation()}>
              <Avatar
                src={avatarUrl}
                alt={displayName || name}
                fallback={name}
                size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'}
                className="ring-2 ring-white shadow-md"
              />
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <CardTitle
                  className={cn(
                    'truncate',
                    size === 'sm' && 'text-base',
                    size === 'md' && 'text-lg',
                    size === 'lg' && 'text-xl'
                  )}
                >
                  {displayName || name}
                </CardTitle>

                {/* 操作菜单 */}
                {(showActions || isEditable) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/characters/${id}`}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          查看详情
                        </Link>
                      </DropdownMenuItem>

                      {isEditable && (
                        <>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit?.(character);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onClone?.(character);
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            克隆
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onArchive?.(character);
                            }}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            归档
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete?.(character);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </>
                      )}

                      {!isEditable && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onShare?.(character);
                          }}
                        >
                          <Share2 className="mr-2 h-4 w-4" />
                          分享
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {creatorName && (
                <CardDescription className="text-xs mt-1">
                  by {creatorName}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          {/* 描述 */}
          <p
            className={cn(
              'text-sm text-muted-foreground line-clamp-2 mb-3',
              size === 'sm' && 'text-xs'
            )}
          >
            {description}
          </p>

          {/* 标签 */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs px-2 py-0"
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <Badge variant="secondary" className="text-xs px-2 py-0">
                  +{tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* 适配器信息 */}
          {adapters.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">{adapters.length} 个适配器</span>
              {adapters.some((a) => a.type === 'intelligent') && (
                <Badge variant="default" className="text-xs h-5">
                  智能
                </Badge>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0 border-t flex items-center justify-between text-xs text-muted-foreground">
          {/* 统计信息 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              <span>{stats.downloads >= 1000 ? `${(stats.downloads / 1000).toFixed(1)}k` : stats.downloads}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              <span>{stats.favorites >= 1000 ? `${(stats.favorites / 1000).toFixed(1)}k` : stats.favorites}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              <span>{stats.rating.toFixed(1)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            <span>{stats.views >= 1000 ? `${(stats.views / 1000).toFixed(1)}k` : stats.views}</span>
          </div>
        </CardFooter>
      </Card>
    );
  }

  // 列表视图
  return (
    <Card
      className={cn(
        'group hover:shadow-md transition-all cursor-pointer',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-4 p-4">
        {/* 封面或头像 */}
        <div className="flex-shrink-0">
          {coverUrl ? (
            <div className="relative w-32 h-24 overflow-hidden rounded-lg bg-gray-200">
              <img
                src={coverUrl}
                alt={displayName || name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <Avatar
              src={avatarUrl}
              alt={displayName || name}
              fallback={name}
              size="xl"
              className="ring-2 ring-white shadow"
            />
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold truncate">
                  {displayName || name}
                </h3>
                {getStatusBadge()}
              </div>
              {creatorName && (
                <p className="text-xs text-muted-foreground">
                  by {creatorName}
                </p>
              )}
            </div>

            {/* 操作菜单 */}
            {(showActions || isEditable) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/characters/${id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      查看详情
                    </Link>
                  </DropdownMenuItem>

                  {isEditable && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(character);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onClone?.(character);
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        克隆
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchive?.(character);
                        }}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        归档
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete?.(character);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </>
                  )}

                  {!isEditable && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare?.(character);
                      }}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      分享
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {description}
          </p>

          {/* 标签和适配器 */}
          <div className="flex items-center gap-3 mb-3">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.slice(0, 5).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs px-2 py-0"
                  >
                    {tag}
                  </Badge>
                ))}
                {tags.length > 5 && (
                  <Badge variant="secondary" className="text-xs px-2 py-0">
                    +{tags.length - 5}
                  </Badge>
                )}
              </div>
            )}

            {adapters.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-medium">{adapters.length} 个适配器</span>
                {adapters.some((a) => a.type === 'intelligent') && (
                  <Badge variant="default" className="text-xs h-5">
                    智能
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* 统计信息 */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              <span>{stats.downloads >= 1000 ? `${(stats.downloads / 1000).toFixed(1)}k` : stats.downloads}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              <span>{stats.favorites >= 1000 ? `${(stats.favorites / 1000).toFixed(1)}k` : stats.favorites}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              <span>{stats.rating.toFixed(1)} ({stats.ratingCount})</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              <span>{stats.views >= 1000 ? `${(stats.views / 1000).toFixed(1)}k` : stats.views}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

/**
 * CharacterCardSkeleton - 骨架屏
 */
export const CharacterCardSkeleton: React.FC<{
  variant?: 'grid' | 'list';
  className?: string;
}> = ({ variant = 'grid', className }) => {
  if (variant === 'grid') {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="w-full h-40 bg-gray-200 animate-pulse" />
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-2 mb-3">
            <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-3 bg-gray-200 rounded animate-pulse w-5/6" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 bg-gray-200 rounded animate-pulse w-16" />
            <div className="h-5 bg-gray-200 rounded animate-pulse w-16" />
          </div>
        </CardContent>
        <CardFooter className="pt-0 border-t">
          <div className="flex justify-between w-full">
            <div className="flex gap-3">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-12" />
              <div className="h-4 bg-gray-200 rounded animate-pulse w-12" />
            </div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-12" />
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start gap-4">
        <div className="w-32 h-24 bg-gray-200 rounded-lg animate-pulse" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-gray-200 rounded animate-pulse w-1/2" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-1/4" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 bg-gray-200 rounded animate-pulse w-16" />
            <div className="h-5 bg-gray-200 rounded animate-pulse w-16" />
            <div className="h-5 bg-gray-200 rounded animate-pulse w-16" />
          </div>
        </div>
      </div>
    </Card>
  );
};

