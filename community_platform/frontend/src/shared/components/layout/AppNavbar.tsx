/**
 * AppNavbar - 应用导航栏组件
 * 包含Logo、导航菜单、搜索、通知和用户菜单
 */

'use client';

import { FC, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  FileText, 
  Package, 
  Users, 
  Search,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { Container } from './Container';
import { UserMenu } from './UserMenu';
import { NotificationDropdown } from './NotificationDropdown';
import { SearchBar } from './SearchBar';

export interface AppNavbarProps {
  className?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: '首页',
    href: '/',
    icon: <Home className="h-4 w-4" />,
  },
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

export const AppNavbar: FC<AppNavbarProps> = ({ className }) => {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <header 
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className
      )}
    >
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">Z</span>
            </div>
            <span className="font-bold text-xl hidden sm:inline-block">Zishu</span>
          </Link>

          {/* 桌面导航 */}
          <nav className="hidden md:flex items-center gap-1 flex-1 mx-6">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive(item.href) ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'gap-2',
                    isActive(item.href) && 'bg-secondary'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>

          {/* 搜索、通知、用户菜单 */}
          <div className="flex items-center gap-2">
            {/* 搜索按钮（桌面） */}
            <div className="hidden md:block">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSearchOpen(true)}
                className="gap-2 min-w-[200px] justify-start text-muted-foreground"
              >
                <Search className="h-4 w-4" />
                <span>搜索...</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
            </div>

            {/* 搜索按钮（移动端） */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-9 w-9 p-0"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* 通知 */}
            <NotificationDropdown />

            {/* 用户菜单 */}
            <UserMenu />

            {/* 移动端菜单按钮 */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-9 w-9 p-0"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* 移动端菜单 */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Button
                    variant={isActive(item.href) ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'w-full justify-start gap-2',
                      isActive(item.href) && 'bg-secondary'
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </Container>

      {/* 搜索对话框 */}
      <SearchBar open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </header>
  );
};

