/**
 * FollowerList Component
 * 粉丝列表组件
 */

'use client';

import React, { useState } from 'react';
import { Users, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/common/EmptyState';
import { LoadingSpinner } from '@/shared/components/common/LoadingSpinner';
import { Pagination } from '@/shared/components/common/Pagination';
import { cn } from '@/shared/utils/cn';
import { useFollowers } from '../hooks/useFollow';
import { FollowButton } from './FollowButton';
import type { Follow } from '../domain/Follow';

/**
 * FollowerList Props
 */
export interface FollowerListProps {
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
 * FollowerItem 子组件
 */
interface FollowerItemProps {
  follower: Follow;
  currentUserId?: string;
  onUserClick?: (userId: string) => void;
}

const FollowerItem: React.FC<FollowerItemProps> = ({ follower, currentUserId, onUserClick }) => {
  const user = follower.follower;
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
 * FollowerList 组件
 */
export const FollowerList: React.FC<FollowerListProps> = ({
  userId,
  currentUserId,
  className,
  pageSize = 20,
  showSearch = true,
  showHeader = true,
  title = '粉丝列表',
  description,
  onUserClick,
}) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const {
    data: followersData,
    isLoading,
    error,
  } = useFollowers({
    userId,
    page,
    pageSize,
    search: search || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const followers = followersData?.data?.items || [];
  const pagination = followersData?.data?.pagination;
  const totalPages = pagination?.totalPages || 1;

  if (isLoading) {
    return (
      <Card className={className}>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
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
              <Users className="h-5 w-5" />
              {title}
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <EmptyState
            icon={Users}
            title="加载失败"
            description="无法加载粉丝列表，请稍后重试"
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
            <Users className="h-5 w-5" />
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
              placeholder="搜索粉丝..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1); // 重置到第一页
              }}
              className="pl-9"
            />
          </div>
        )}

        {followers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? '未找到粉丝' : '暂无粉丝'}
            description={search ? '尝试其他搜索词' : '还没有人关注你'}
          />
        ) : (
          <div className="space-y-2">
            {followers.map((follower) => (
              <FollowerItem
                key={follower.id}
                follower={follower}
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

export default FollowerList;

