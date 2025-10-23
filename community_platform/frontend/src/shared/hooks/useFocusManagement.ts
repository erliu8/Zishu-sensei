/**
 * 焦点管理 Hooks
 */

import { useEffect, useRef, useCallback, RefObject } from 'react';
import { trapFocus, getFocusableElements, scrollIntoViewIfNeeded } from '@/shared/utils/accessibility';

/**
 * 焦点陷阱 Hook
 * 用于 Modal、Dialog 等需要限制焦点在内部的组件
 */
interface UseFocusTrapOptions {
  /** 是否启用焦点陷阱 */
  enabled?: boolean;
  /** 是否自动聚焦第一个可聚焦元素 */
  autoFocus?: boolean;
  /** 是否在禁用时恢复之前的焦点 */
  restoreFocus?: boolean;
  /** 初始聚焦的元素选择器 */
  initialFocusSelector?: string;
}

export function useFocusTrap(options: UseFocusTrapOptions = {}) {
  const { enabled = true, autoFocus = true, restoreFocus = true, initialFocusSelector } = options;

  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    // 保存当前活动元素
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    // 自动聚焦
    if (autoFocus) {
      let elementToFocus: HTMLElement | null = null;

      if (initialFocusSelector) {
        elementToFocus = container.querySelector<HTMLElement>(initialFocusSelector);
      }

      if (!elementToFocus) {
        const focusableElements = getFocusableElements(container);
        elementToFocus = focusableElements[0] || container;
      }

      elementToFocus?.focus();
    }

    // 焦点陷阱处理
    const handleKeyDown = (event: KeyboardEvent) => {
      trapFocus(container, event);
    };

    container.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      container.removeEventListener('keydown', handleKeyDown as EventListener);

      // 恢复之前的焦点
      if (restoreFocus && previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [enabled, autoFocus, restoreFocus, initialFocusSelector]);

  return containerRef;
}

/**
 * 焦点可见性 Hook
 * 检测用户是否通过键盘导航，并添加相应的样式类
 */
export function useFocusVisible() {
  useEffect(() => {
    let hadKeyboardEvent = false;
    let isHandlingKeydown = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isHandlingKeydown) return;
      isHandlingKeydown = true;

      if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') {
        hadKeyboardEvent = true;
        document.body.classList.add('keyboard-nav');
      }

      isHandlingKeydown = false;
    };

    const handleMouseDown = () => {
      hadKeyboardEvent = false;
      document.body.classList.remove('keyboard-nav');
    };

    const handleFocus = (e: FocusEvent) => {
      if (hadKeyboardEvent) {
        (e.target as HTMLElement)?.classList.add('focus-visible');
      }
    };

    const handleBlur = (e: FocusEvent) => {
      (e.target as HTMLElement)?.classList.remove('focus-visible');
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('focus', handleFocus, true);
    document.addEventListener('blur', handleBlur, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('focus', handleFocus, true);
      document.removeEventListener('blur', handleBlur, true);
      document.body.classList.remove('keyboard-nav');
    };
  }, []);
}

/**
 * 自动聚焦 Hook
 * 在组件挂载时自动聚焦指定元素
 */
interface UseAutoFocusOptions {
  /** 是否启用 */
  enabled?: boolean;
  /** 延迟时间（ms） */
  delay?: number;
  /** 是否滚动到视图内 */
  scrollIntoView?: boolean;
}

export function useAutoFocus(options: UseAutoFocusOptions = {}) {
  const { enabled = true, delay = 0, scrollIntoView = true } = options;
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const timeout = setTimeout(() => {
      if (elementRef.current) {
        elementRef.current.focus();
        if (scrollIntoView) {
          scrollIntoViewIfNeeded(elementRef.current);
        }
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [enabled, delay, scrollIntoView]);

  return elementRef;
}

/**
 * 焦点返回 Hook
 * 用于在元素被移除时将焦点返回到指定元素
 */
export function useFocusReturn(returnToRef?: RefObject<HTMLElement>) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // 保存当前焦点
    previousFocusRef.current = document.activeElement as HTMLElement;

    return () => {
      // 组件卸载时恢复焦点
      const returnElement = returnToRef?.current || previousFocusRef.current;
      if (returnElement && returnElement !== document.body) {
        // 使用 requestAnimationFrame 确保 DOM 更新完成
        requestAnimationFrame(() => {
          returnElement.focus();
        });
      }
    };
  }, [returnToRef]);
}

/**
 * 焦点锁定 Hook
 * 防止焦点移出指定容器
 */
export function useFocusLock(enabled = true) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!container.contains(target)) {
        event.preventDefault();
        const focusableElements = getFocusableElements(container);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [enabled]);

  return containerRef;
}

/**
 * 焦点边界 Hook
 * 管理焦点在列表边界的行为
 */
interface UseFocusBoundaryOptions {
  /** 容器引用 */
  containerRef: RefObject<HTMLElement>;
  /** 项目选择器 */
  itemSelector: string;
  /** 到达边界时的回调 */
  onBoundary?: (direction: 'start' | 'end') => void;
}

export function useFocusBoundary(options: UseFocusBoundaryOptions) {
  const { containerRef, itemSelector, onBoundary } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!containerRef.current) return;

      const items = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(itemSelector)
      );
      const currentElement = document.activeElement as HTMLElement;
      const currentIndex = items.indexOf(currentElement);

      if (currentIndex === -1) return;

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        if (currentIndex === 0) {
          onBoundary?.('start');
        }
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        if (currentIndex === items.length - 1) {
          onBoundary?.('end');
        }
      }
    },
    [containerRef, itemSelector, onBoundary]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      container.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [containerRef, handleKeyDown]);
}

/**
 * 延迟聚焦 Hook
 * 在指定条件满足后聚焦元素
 */
export function useDeferredFocus(shouldFocus: boolean, delay = 0) {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!shouldFocus || !elementRef.current) return;

    const timeout = setTimeout(() => {
      elementRef.current?.focus();
    }, delay);

    return () => clearTimeout(timeout);
  }, [shouldFocus, delay]);

  return elementRef;
}

