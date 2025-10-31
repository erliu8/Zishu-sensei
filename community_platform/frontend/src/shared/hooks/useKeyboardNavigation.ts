/**
 * 键盘导航 Hook
 */

import { useEffect, useRef, useCallback } from 'react';
import { KEYBOARD_KEYS } from '@/shared/utils/accessibility';

/**
 * 使用键盘导航（上下左右箭头键）
 * 适用于列表、菜单等组件
 */
interface UseKeyboardNavigationOptions {
  /** 可导航元素的选择器 */
  itemSelector?: string;
  /** 导航方向 */
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** 是否循环导航 */
  loop?: boolean;
  /** 是否启用 */
  enabled?: boolean;
  /** 焦点变化时的回调 */
  onFocusChange?: (index: number, element: HTMLElement) => void;
}

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions = {}) {
  const {
    itemSelector = '[role="option"], [role="menuitem"], button, a',
    orientation = 'vertical',
    loop = true,
    enabled = true,
    onFocusChange,
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const currentIndexRef = useRef<number>(0);

  const getNavigableItems = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(itemSelector)
    ).filter((el) => {
      return (
        !el.hasAttribute('disabled') &&
        !el.getAttribute('aria-disabled') &&
        el.offsetWidth > 0 &&
        el.offsetHeight > 0
      );
    });
  }, [itemSelector]);

  const focusItem = useCallback(
    (index: number) => {
      const items = getNavigableItems();
      if (items.length === 0) return;

      let targetIndex = index;
      if (loop) {
        targetIndex = ((index % items.length) + items.length) % items.length;
      } else {
        targetIndex = Math.max(0, Math.min(index, items.length - 1));
      }

      const targetElement = items[targetIndex];
      if (targetElement) {
        targetElement.focus();
        currentIndexRef.current = targetIndex;
        onFocusChange?.(targetIndex, targetElement);
      }
    },
    [getNavigableItems, loop, onFocusChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const items = getNavigableItems();
      if (items.length === 0) return;

      const currentElement = document.activeElement as HTMLElement;
      const currentIndex = items.indexOf(currentElement);
      if (currentIndex === -1) return;

      let handled = false;

      if (orientation === 'vertical' || orientation === 'both') {
        if (event.key === KEYBOARD_KEYS.ARROW_DOWN) {
          event.preventDefault();
          focusItem(currentIndex + 1);
          handled = true;
        } else if (event.key === KEYBOARD_KEYS.ARROW_UP) {
          event.preventDefault();
          focusItem(currentIndex - 1);
          handled = true;
        }
      }

      if (orientation === 'horizontal' || orientation === 'both') {
        if (event.key === KEYBOARD_KEYS.ARROW_RIGHT) {
          event.preventDefault();
          focusItem(currentIndex + 1);
          handled = true;
        } else if (event.key === KEYBOARD_KEYS.ARROW_LEFT) {
          event.preventDefault();
          focusItem(currentIndex - 1);
          handled = true;
        }
      }

      if (event.key === KEYBOARD_KEYS.HOME) {
        event.preventDefault();
        focusItem(0);
        handled = true;
      } else if (event.key === KEYBOARD_KEYS.END) {
        event.preventDefault();
        focusItem(items.length - 1);
        handled = true;
      }

      return handled;
    },
    [enabled, getNavigableItems, orientation, focusItem]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      container.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [handleKeyDown, enabled]);

  return {
    containerRef,
    focusItem,
    currentIndex: currentIndexRef.current,
    getNavigableItems,
  };
}

/**
 * 使用 Roving Tabindex
 * 用于管理组件组内的键盘导航，只有一个项目可以被 Tab 聚焦
 */
interface UseRovingTabIndexOptions {
  /** 初始活动索引 */
  defaultActiveIndex?: number;
  /** 外部控制的活动索引 */
  activeIndex?: number;
  /** 索引变化回调 */
  onActiveIndexChange?: (index: number) => void;
}

export function useRovingTabIndex(options: UseRovingTabIndexOptions = {}) {
  const { defaultActiveIndex = 0, activeIndex: controlledIndex, onActiveIndexChange } = options;

  const internalIndexRef = useRef(defaultActiveIndex);
  const isControlled = controlledIndex !== undefined;
  const activeIndex = isControlled ? controlledIndex : internalIndexRef.current;

  const setActiveIndex = useCallback(
    (index: number) => {
      if (!isControlled) {
        internalIndexRef.current = index;
      }
      onActiveIndexChange?.(index);
    },
    [isControlled, onActiveIndexChange]
  );

  const getItemProps = useCallback(
    (index: number) => {
      const isActive = index === activeIndex;
      return {
        tabIndex: isActive ? 0 : -1,
        'data-active': isActive,
        onFocus: () => setActiveIndex(index),
      };
    },
    [activeIndex, setActiveIndex]
  );

  return {
    activeIndex,
    setActiveIndex,
    getItemProps,
  };
}

/**
 * 使用快捷键
 */
interface UseShortcutOptions {
  /** 快捷键定义 */
  shortcuts: {
    /** 键值 */
    key: string;
    /** 是否需要 Ctrl/Cmd */
    ctrl?: boolean;
    /** 是否需要 Shift */
    shift?: boolean;
    /** 是否需要 Alt */
    alt?: boolean;
    /** 回调函数 */
    handler: (event: KeyboardEvent) => void;
    /** 描述（用于帮助文档） */
    description?: string;
  }[];
  /** 是否启用 */
  enabled?: boolean;
  /** 是否阻止默认行为 */
  preventDefault?: boolean;
}

export function useShortcut(options: UseShortcutOptions) {
  const { shortcuts, enabled = true, preventDefault = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          if (preventDefault) {
            event.preventDefault();
          }
          shortcut.handler(event);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled, preventDefault]);

  return shortcuts;
}

