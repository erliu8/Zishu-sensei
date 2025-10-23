/**
 * 仅屏幕阅读器可见组件
 * Screen Reader Only Component
 * 
 * 内容仅对屏幕阅读器可见，视觉上隐藏
 */

import React from 'react';
import { cn } from '@/shared/utils/cn';

interface ScreenReaderOnlyProps {
  children: React.ReactNode;
  /** 是否作为内联元素 */
  inline?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 是否可聚焦 */
  focusable?: boolean;
  as?: React.ElementType;
}

export function ScreenReaderOnly({
  children,
  inline = false,
  className,
  focusable = false,
  as: Component = inline ? 'span' : 'div',
}: ScreenReaderOnlyProps) {
  return (
    <Component
      className={cn(
        'sr-only',
        // 如果需要聚焦时显示
        focusable && 'focus:not-sr-only focus:absolute focus:left-0 focus:top-0 focus:z-50 focus:p-4 focus:bg-background focus:text-foreground',
        className
      )}
      {...(focusable && { tabIndex: 0 })}
    >
      {children}
    </Component>
  );
}

/**
 * 为装饰性图片添加说明
 */
interface VisuallyHiddenTextProps {
  children: React.ReactNode;
}

export function VisuallyHiddenText({ children }: VisuallyHiddenTextProps) {
  return <ScreenReaderOnly inline>{children}</ScreenReaderOnly>;
}

