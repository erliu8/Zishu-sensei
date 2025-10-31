/**
 * FollowingList Component
 * 关注列表组件
 */

'use client';

import React, { useState } from 'react';
import { UserCheck, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { EmptyState } from '@/shared/components/common/EmptyState';
import { LoadingSpinner } from '@/shared/components/common/LoadingSpinner';
import { Pagination } from '@/shared/components/common/Pagination';
import { useFollowing } from '../hooks/useFollow';
import { FollowButton } from './FollowButton';
import type { Follow } from '../domain/Follow';

/**
 * FollowingList Props
 */
export interface FollowingListProps {
  /** 用户ID */
  userId: string;
  /** 当前用户ID */
  currentUserId?: string;
  /** 自定义类名 */
  className?: string;
  /** 每页显示数量 */
  pageSize?: number;
  /** 是否显示搜索框 */
  showSearch?: boolean;
  /** 是否显示卡片标题 */
  showHeader?: boolean;
  /** 自定义标题 */
  title?: string;
  /** 自定义描述 */
  description?: string;
  /** 点击用户回调 */
  onUserClick?: (userId: string) => void;
}

/**
 * FollowingItem 子组件
 */
interface FollowingItemProps {
  following: Follow;
  currentUserId?: string;
  onUserClick?: (userId: string) => void;
}

const FollowingItem: React.FC<FollowingItemProps> = ({
  following,
  currentUserId,
  onUserClick,
}) => {
  const user = following.followee;
  if (!user) return null;

  const initials = user.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user.username.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center justify-between gap-4 p-4 hover:bg-accent/50 rounded-lg transition-colors">
      <div
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={() => onUserClick?.(user.id)}
      >
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.avatar} alt={user.displayName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{user.displayName}</p>
          <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
          {user.bio && (
            <p className="text-xs text-muted-foreground truncate mt-1">{user.bio}</p>
          )}
        </div>
      </div>
      <FollowButton
        userId={user.id}
        currentUserId={currentUserId}
        size="sm"
        variant="outline"
      />
    </div>
  );
};

/**
 * FollowingList 组件
 */
export const FollowingList: React.FC<FollowingListProps> = ({
  userId,
  currentUserId,
  className,
  pageSize = 20,
  showSearch = true,
  showHeader = true,
  title = '关注列表',
  description,
  onUserClick,
}) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const {
    data: followingData,
    isLoading,
    error,
  } = useFollowing({
    userId,
    page,
    pageSize,
    search: search || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const following = (followingData as any)?.data?.items || (followingData as any)?.items || [];
  const pagination = (followingData as any)?.data?.pagination || (followingData as any)?.pagination;
  const totalPages = pagination?.totalPages || 1;

  if (isLoading) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              {title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent>
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              {title}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <EmptyState
            icon={<UserCheck className="h-8 w-8" />}
            title="加载失败"
            description="无法加载关注列表，请稍后重试"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {title}
            {pagination && (
              <span className="text-sm font-normal text-muted-foreground">
                ({pagination.total})
              </span>
            )}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索关注的用户..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        )}

        {following.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="h-8 w-8" />}
            title={search ? '未找到用户' : '暂无关注'}
            description={search ? '尝试其他搜索词' : '快去关注感兴趣的用户吧'}
          />
        ) : (
          <div className="space-y-2">
            {following.map((item: any) => (
              <FollowingItem
                key={item.id}
                following={item}
                currentUserId={currentUserId}
                onUserClick={onUserClick}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FollowingList;

