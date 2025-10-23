/**
 * 用户信息卡片组件
 * @module features/user/components
 */

'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import type { UserBasic } from '../types';
import Link from 'next/link';

interface UserInfoCardProps {
  user: UserBasic;
  isFollowing?: boolean;
  onFollow?: () => void;
  onUnfollow?: () => void;
}

export function UserInfoCard({
  user,
  isFollowing = false,
  onFollow,
  onUnfollow,
}: UserInfoCardProps) {
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return '管理员';
      case 'moderator':
        return '版主';
      default:
        return '用户';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <Link href={`/users/${user.id}`} className="flex items-center gap-3 group">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar} alt={user.name || user.username} />
            <AvatarFallback>
              {(user.name || user.username).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                {user.name || user.username}
              </h3>
              {user.role !== 'user' && (
                <Badge variant="secondary" className="text-xs">
                  {getRoleLabel(user.role)}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
          </div>
        </Link>
      </CardHeader>
      <CardContent>
        {user.bio && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{user.bio}</p>
        )}
        {isFollowing ? (
          <Button variant="outline" size="sm" className="w-full" onClick={onUnfollow}>
            取消关注
          </Button>
        ) : (
          <Button size="sm" className="w-full" onClick={onFollow}>
            关注
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

