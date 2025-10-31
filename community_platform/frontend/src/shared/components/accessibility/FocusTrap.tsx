/**
 * 焦点陷阱组件
 * Focus Trap Component
 * 
 * 限制焦点在特定容器内，用于 Modal、Dialog 等
 */

'use client';

import React from 'react';
import { useFocusTrap } from '@/shared/hooks/useFocusManagement';

interface FocusTrapProps {
  /** 是否启用焦点陷阱 */
  enabled?: boolean;
  /** 是否自动聚焦 */
  autoFocus?: boolean;
  /** 是否恢复焦点 */
  restoreFocus?: boolean;
  /** 初始聚焦元素选择器 */
  initialFocusSelector?: string;
  /** 子元素 */
  children: React.ReactNode;
  /** 容器元素类型 */
  as?: React.ElementType;
  /** 自定义类名 */
  className?: string;
}

export function FocusTrap({
  enabled = true,
  autoFocus = true,
  restoreFocus = true,
  initialFocusSelector,
  children,
  as: Component = 'div',
  className,
  ...props
}: FocusTrapProps) {
  const trapRef = useFocusTrap({
    enabled,
    autoFocus,
    restoreFocus,
    initialFocusSelector,
  });

  return (
    <Component ref={trapRef} className={className} {...props}>
      {children}
    </Component>
  );
}

