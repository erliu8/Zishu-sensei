/**
 * UserMenu - 用户菜单组件
 * 显示用户信息和操作菜单
 */

'use client';

import { FC } from 'react';
import Link from 'next/link';
import {
  User,
  Settings,
  FileText,
  Package,
  Users,
  Heart,
  LogOut,
  LogIn,
  UserPlus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { useAuth } from '@/features/auth/hooks';
import type { User as AuthUser } from '@/features/auth/types';

export interface UserMenuProps {
  className?: string;
}

export const UserMenu: FC<UserMenuProps> = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const authUser = user as AuthUser | null;

  const handleLogout = async () => {
    await logout();
  };

  if (!isAuthenticated || !authUser) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login">
          <Button variant="ghost" size="sm" className="gap-2">
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">登录</span>
          </Button>
        </Link>
        <Link href="/register">
          <Button size="sm" className="gap-2">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">注册</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-9 w-9 rounded-full p-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={authUser.avatar || ''} alt={authUser.username || 'User'} />
            <AvatarFallback>
              {authUser.username?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{authUser.username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {authUser.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link href={`/users/${authUser.id}`} className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>个人主页</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/profile/posts" className="cursor-pointer">
            <FileText className="mr-2 h-4 w-4" />
            <span>我的帖子</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/profile/adapters" className="cursor-pointer">
            <Package className="mr-2 h-4 w-4" />
            <span>我的技能包</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/profile/characters" className="cursor-pointer">
            <Users className="mr-2 h-4 w-4" />
            <span>我的角色</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/profile/favorites" className="cursor-pointer">
            <Heart className="mr-2 h-4 w-4" />
            <span>我的收藏</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link href="/profile/settings" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>设置</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>退出登录</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

