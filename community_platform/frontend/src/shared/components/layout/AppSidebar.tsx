/**
 * AppSidebar - 应用侧边栏组件
 * 提供快速导航和分类导航
 */

'use client';

import { FC } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  TrendingUp,
  Clock,
  Star,
  FileText,
  Package,
  Users,
  Tag,
  Bookmark,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { cn } from '@/shared/utils/cn';

export interface AppSidebarProps {
  className?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  count?: number;
}

interface CategoryItem {
  id: string;
  name: string;
  count: number;
  color?: string;
}

const quickNavItems: NavItem[] = [
  {
    label: '首页',
    href: '/',
    icon: <Home className="h-4 w-4" />,
  },
  {
    label: '热门',
    href: '/trending',
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    label: '最新',
    href: '/latest',
    icon: <Clock className="h-4 w-4" />,
  },
  {
    label: '精选',
    href: '/featured',
    icon: <Star className="h-4 w-4" />,
  },
];

const contentNavItems: NavItem[] = [
  {
    label: '帖子',
    href: '/posts',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    label: '适配器',
    href: '/adapters',
    icon: <Package className="h-4 w-4" />,
  },
  {
    label: '角色',
    href: '/characters',
    icon: <Users className="h-4 w-4" />,
  },
];

const userNavItems: NavItem[] = [
  {
    label: '我的收藏',
    href: '/profile/favorites',
    icon: <Bookmark className="h-4 w-4" />,
  },
  {
    label: '设置',
    href: '/profile/settings',
    icon: <Settings className="h-4 w-4" />,
  },
];

// 模拟分类数据
const mockCategories: CategoryItem[] = [
  { id: '1', name: '教程指南', count: 128, color: '#3b82f6' },
  { id: '2', name: '技术讨论', count: 256, color: '#8b5cf6' },
  { id: '3', name: '作品展示', count: 89, color: '#ec4899' },
  { id: '4', name: '问题求助', count: 64, color: '#f59e0b' },
  { id: '5', name: '资源分享', count: 156, color: '#10b981' },
];

export const AppSidebar: FC<AppSidebarProps> = ({ className }) => {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside className={cn('w-64 shrink-0 space-y-4', className)}>
      {/* 快速导航 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">快速导航</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {quickNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive(item.href) ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start gap-2"
              >
                {item.icon}
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <Badge variant="secondary" className="ml-auto">
                    {item.count}
                  </Badge>
                )}
              </Button>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* 内容分类 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">浏览内容</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {contentNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive(item.href) ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start gap-2"
              >
                {item.icon}
                <span>{item.label}</span>
              </Button>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* 分类标签 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4" />
              热门分类
            </CardTitle>
            <Link href="/categories">
              <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                查看全部
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {mockCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categories/${category.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-2 rounded-md hover:bg-accent transition-colors cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm group-hover:text-primary transition-colors">
                        {category.name}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {category.count}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* 个人中心 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">个人中心</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {userNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive(item.href) ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start gap-2"
              >
                {item.icon}
                <span>{item.label}</span>
              </Button>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* 帮助中心 */}
      <Card>
        <CardContent className="pt-6">
          <Link href="/help">
            <Button variant="outline" size="sm" className="w-full gap-2">
              <HelpCircle className="h-4 w-4" />
              <span>帮助中心</span>
            </Button>
          </Link>
        </CardContent>
      </Card>
    </aside>
  );
};

