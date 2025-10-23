/**
 * 个人资料头部组件
 * @module features/user/components
 */

'use client';

import { useState } from 'react';
import { Camera, MapPin, Link as LinkIcon, Github, Twitter, Mail, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import type { UserProfile } from '../types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ProfileHeaderProps {
  user: UserProfile;
  isCurrentUser?: boolean;
  isFollowing?: boolean;
  onFollow?: () => void;
  onUnfollow?: () => void;
  onEditProfile?: () => void;
  onChangeAvatar?: (file: File) => void;
}

export function ProfileHeader({
  user,
  isCurrentUser = false,
  isFollowing = false,
  onFollow,
  onUnfollow,
  onEditProfile,
  onChangeAvatar,
}: ProfileHeaderProps) {
  const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onChangeAvatar) {
      onChangeAvatar(file);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'moderator':
        return 'default';
      default:
        return 'secondary';
    }
  };

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
    <div className="relative">
      {/* 背景横幅 */}
      <div className="h-48 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-t-lg" />

      <div className="max-w-5xl mx-auto px-6 pb-6">
        <div className="relative">
          {/* 头像 */}
          <div className="flex items-end gap-6 -mt-20">
            <div
              className="relative"
              onMouseEnter={() => setIsHoveringAvatar(true)}
              onMouseLeave={() => setIsHoveringAvatar(false)}
            >
              <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                <AvatarImage src={user.avatar} alt={user.name || user.username} />
                <AvatarFallback className="text-3xl">
                  {(user.name || user.username).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {isCurrentUser && (
                <>
                  <label
                    htmlFor="avatar-upload"
                    className={`absolute inset-0 flex items-center justify-center bg-black/60 rounded-full cursor-pointer transition-opacity ${
                      isHoveringAvatar ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <Camera className="h-8 w-8 text-white" />
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </>
              )}
            </div>

            {/* 用户信息 */}
            <div className="flex-1 pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold">{user.name || user.username}</h1>
                    <Badge variant={getRoleColor(user.role)}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1">@{user.username}</p>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  {isCurrentUser ? (
                    <Button onClick={onEditProfile}>编辑资料</Button>
                  ) : (
                    <>
                      {isFollowing ? (
                        <Button variant="outline" onClick={onUnfollow}>
                          取消关注
                        </Button>
                      ) : (
                        <Button onClick={onFollow}>关注</Button>
                      )}
                      <Button variant="outline" size="icon">
                        <Mail className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* 简介 */}
              {user.bio && <p className="mt-4 text-lg">{user.bio}</p>}

              {/* 元信息 */}
              <div className="flex flex-wrap gap-4 mt-4 text-muted-foreground">
                {user.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{user.location}</span>
                  </div>
                )}
                {user.website && (
                  <a
                    href={user.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <LinkIcon className="h-4 w-4" />
                    <span>{user.website}</span>
                  </a>
                )}
                {user.github && (
                  <a
                    href={`https://github.com/${user.github}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <Github className="h-4 w-4" />
                    <span>{user.github}</span>
                  </a>
                )}
                {user.twitter && (
                  <a
                    href={`https://twitter.com/${user.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <Twitter className="h-4 w-4" />
                    <span>{user.twitter}</span>
                  </a>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>
                    加入于 {format(new Date(user.createdAt), 'yyyy年MM月', { locale: zhCN })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

