/**
 * 无障碍性工具函数
 * Accessibility Utilities
 */

/**
 * ARIA 角色类型
 */
export type AriaRole =
  | 'alert'
  | 'alertdialog'
  | 'button'
  | 'checkbox'
  | 'dialog'
  | 'gridcell'
  | 'link'
  | 'log'
  | 'marquee'
  | 'menuitem'
  | 'menuitemcheckbox'
  | 'menuitemradio'
  | 'option'
  | 'progressbar'
  | 'radio'
  | 'scrollbar'
  | 'searchbox'
  | 'slider'
  | 'spinbutton'
  | 'status'
  | 'switch'
  | 'tab'
  | 'tabpanel'
  | 'textbox'
  | 'timer'
  | 'tooltip'
  | 'tree'
  | 'treeitem';

/**
 * 键盘快捷键定义
 */
export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

/**
 * 生成唯一的 ID 用于 ARIA 标签关联
 */
let idCounter = 0;
export function generateAriaId(prefix = 'aria'): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

/**
 * 获取 ARIA 标签属性
 */
export interface AriaLabelProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

export function getAriaLabel(
  label?: string,
  labelledBy?: string,
  describedBy?: string
): AriaLabelProps {
  const props: AriaLabelProps = {};

  if (label) props['aria-label'] = label;
  if (labelledBy) props['aria-labelledby'] = labelledBy;
  if (describedBy) props['aria-describedby'] = describedBy;

  return props;
}

/**
 * 颜色对比度计算
 * 根据 WCAG 2.1 标准
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);

  if (!rgb1 || !rgb2) return null;

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 检查颜色对比度是否符合 WCAG 标准
 * AA 级别: 正常文本 4.5:1, 大文本 3:1
 * AAA 级别: 正常文本 7:1, 大文本 4.5:1
 */
export type WCAGLevel = 'AA' | 'AAA';
export type TextSize = 'normal' | 'large';

export interface ContrastCheckResult {
  ratio: number;
  passes: boolean;
  level: WCAGLevel;
  requiredRatio: number;
}

export function checkContrast(
  foreground: string,
  background: string,
  level: WCAGLevel = 'AA',
  textSize: TextSize = 'normal'
): ContrastCheckResult | null {
  const ratio = getContrastRatio(foreground, background);
  if (ratio === null) return null;

  const requiredRatio =
    level === 'AAA'
      ? textSize === 'large'
        ? 4.5
        : 7
      : textSize === 'large'
        ? 3
        : 4.5;

  return {
    ratio: Math.round(ratio * 100) / 100,
    passes: ratio >= requiredRatio,
    level,
    requiredRatio,
  };
}

/**
 * 获取可聚焦元素的选择器
 */
export const FOCUSABLE_ELEMENTS_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(', ');

/**
 * 获取元素内所有可聚焦的子元素
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS_SELECTOR)
  ).filter((el) => {
    // 过滤掉不可见的元素
    return (
      el.offsetWidth > 0 &&
      el.offsetHeight > 0 &&
      window.getComputedStyle(el).visibility !== 'hidden'
    );
  });
}

/**
 * 捕获焦点在指定容器内
 */
export function trapFocus(container: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== KEYBOARD_KEYS.TAB) return;

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement as HTMLElement;

  // Shift + Tab
  if (event.shiftKey) {
    if (activeElement === firstElement || !container.contains(activeElement)) {
      event.preventDefault();
      lastElement.focus();
    }
  }
  // Tab
  else {
    if (activeElement === lastElement || !container.contains(activeElement)) {
      event.preventDefault();
      firstElement.focus();
    }
  }
}

/**
 * 创建实时通知区域的公告
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // 3秒后移除
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 3000);
}

/**
 * 检查元素是否在视口内
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * 滚动元素到视口内（无障碍友好）
 */
export function scrollIntoViewIfNeeded(element: HTMLElement, smooth = true): void {
  if (!isInViewport(element)) {
    element.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'nearest',
      inline: 'nearest',
    });
  }
}

/**
 * 获取 ARIA 展开/折叠属性
 */
export function getAriaExpanded(isExpanded: boolean) {
  return {
    'aria-expanded': isExpanded,
  };
}

/**
 * 获取 ARIA 选中状态属性
 */
export function getAriaSelected(isSelected: boolean) {
  return {
    'aria-selected': isSelected,
  };
}

/**
 * 获取 ARIA 禁用状态属性
 */
export function getAriaDisabled(isDisabled: boolean) {
  return {
    'aria-disabled': isDisabled,
  };
}

/**
 * 获取 ARIA 加载状态属性
 */
export function getAriaBusy(isBusy: boolean) {
  return {
    'aria-busy': isBusy,
  };
}

/**
 * 创建键盘事件处理器
 */
export function createKeyboardHandler(handlers: {
  [key: string]: (event: KeyboardEvent) => void;
}) {
  return (event: KeyboardEvent) => {
    const handler = handlers[event.key];
    if (handler) {
      handler(event);
    }
  };
}

/**
 * 获取 Roving Tabindex 属性
 * 用于管理组件组内的键盘导航
 */
export function getRovingTabIndex(isActive: boolean) {
  return {
    tabIndex: isActive ? 0 : -1,
  };
}

