/**
 * 跳转到主内容链接
 * Skip to Content Link
 * 
 * 为键盘用户提供快速跳转到主内容的能力
 */

'use client';

import React from 'react';
import { cn } from '@/shared/utils/cn';

interface SkipToContentProps {
  /** 目标内容区域的 ID */
  targetId?: string;
  /** 链接文本 */
  children?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
}

export function SkipToContent({
  targetId = 'main-content',
  children = '跳转到主内容',
  className,
}: SkipToContentProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className={cn(
        'skip-to-content',
        // 默认隐藏，获得焦点时显示
        'fixed left-4 top-4 z-[9999]',
        'translate-y-[-200%] focus:translate-y-0',
        'transition-transform duration-200',
        // 样式
        'inline-block rounded-md bg-primary px-4 py-2',
        'text-sm font-medium text-primary-foreground',
        'shadow-lg outline-none ring-2 ring-ring ring-offset-2',
        'focus:ring-offset-background',
        className
      )}
    >
      {children}
    </a>
  );
}

/**
 * 跳转链接列表
 * 提供多个快速跳转选项
 */
interface SkipLink {
  id: string;
  label: string;
  targetId: string;
}

interface SkipLinksProps {
  links: SkipLink[];
  className?: string;
}

export function SkipLinks({ links, className }: SkipLinksProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav
      aria-label="快速导航"
      className={cn(
        'fixed left-4 top-4 z-[9999]',
        'flex flex-col gap-2',
        'translate-y-[-200%] focus-within:translate-y-0',
        'transition-transform duration-200',
        className
      )}
    >
      {links.map((link) => (
        <a
          key={link.id}
          href={`#${link.targetId}`}
          onClick={(e) => handleClick(e, link.targetId)}
          className={cn(
            'inline-block rounded-md bg-primary px-4 py-2',
            'text-sm font-medium text-primary-foreground',
            'shadow-lg outline-none ring-2 ring-ring ring-offset-2',
            'focus:ring-offset-background',
            'hover:bg-primary/90'
          )}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}

