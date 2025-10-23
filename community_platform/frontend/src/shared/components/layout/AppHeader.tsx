'use client';

import React from 'react';
import Link from 'next/link';
import { Bell, Search, Menu, User } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { NotificationDropdown } from '@/features/notification/components';
import { cn } from '@/shared/utils';

interface AppHeaderProps {
  className?: string;
}

/**
 * 应用头部导航组件
 * 包含 Logo、搜索框、通知中心和用户菜单
 */
export function AppHeader({ className }: AppHeaderProps) {
  // TODO: 从认证上下文获取用户信息
  const user = {
    name: 'Demo User',
    email: 'demo@example.com',
    avatar: '',
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2">
          <span className="font-bold text-xl">Zishu</span>
        </Link>

        {/* 导航菜单 */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link
            href="/characters"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            角色
          </Link>
          <Link
            href="/posts"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            帖子
          </Link>
          <Link
            href="/packaging"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            打包
          </Link>
          <Link
            href="/adapters"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            适配器
          </Link>
        </nav>

        {/* 搜索框 */}
        <div className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="搜索角色、帖子..."
              className="pl-8"
            />
          </div>
        </div>

        {/* 右侧操作区 */}
        <div className="flex items-center gap-2">
          {/* 移动端搜索按钮 */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Search className="h-5 w-5" />
            <span className="sr-only">搜索</span>
          </Button>

          {/* 通知中心 */}
          <NotificationDropdown />

          {/* 用户菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center justify-start gap-2 p-2">
                <div className="flex flex-col space-y-1 leading-none">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">个人主页</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile/settings">设置</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/notifications">通知</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 移动端菜单 */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">菜单</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

