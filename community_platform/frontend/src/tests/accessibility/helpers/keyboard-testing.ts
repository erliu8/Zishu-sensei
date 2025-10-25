/**
 * 键盘导航测试辅助函数
 */

import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';

/**
 * 键盘按键常量
 */
export const Keys = {
  TAB: 'Tab',
  SHIFT_TAB: '{Shift>}{Tab}{/Shift}',
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
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
 * 测试键盘导航序列
 */
export async function testKeyboardNavigation(
  elements: HTMLElement[],
  key: string = Keys.TAB
): Promise<void> {
  const user = userEvent.setup();
  
  for (const element of elements) {
    await user.keyboard(key);
    expect(document.activeElement).toBe(element);
  }
}

/**
 * 测试 Tab 键循环导航
 */
export async function testTabNavigation(
  expectedOrder: (HTMLElement | (() => HTMLElement))[]
): Promise<void> {
  const user = userEvent.setup();
  
  for (const elementOrGetter of expectedOrder) {
    const element = typeof elementOrGetter === 'function' 
      ? elementOrGetter() 
      : elementOrGetter;
    
    await user.tab();
    expect(document.activeElement).toBe(element);
  }
}

/**
 * 测试 Shift+Tab 反向导航
 */
export async function testShiftTabNavigation(
  expectedOrder: (HTMLElement | (() => HTMLElement))[]
): Promise<void> {
  const user = userEvent.setup();
  
  for (const elementOrGetter of expectedOrder) {
    const element = typeof elementOrGetter === 'function' 
      ? elementOrGetter() 
      : elementOrGetter;
    
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(element);
  }
}

/**
 * 测试 Enter 键激活
 */
export async function testEnterKeyActivation(
  element: HTMLElement,
  onActivate: () => void | Promise<void>
): Promise<void> {
  const user = userEvent.setup();
  
  element.focus();
  expect(document.activeElement).toBe(element);
  
  await user.keyboard(Keys.ENTER);
  await onActivate();
}

/**
 * 测试 Space 键激活
 */
export async function testSpaceKeyActivation(
  element: HTMLElement,
  onActivate: () => void | Promise<void>
): Promise<void> {
  const user = userEvent.setup();
  
  element.focus();
  expect(document.activeElement).toBe(element);
  
  await user.keyboard(Keys.SPACE);
  await onActivate();
}

/**
 * 测试 Escape 键关闭
 */
export async function testEscapeKeyClose(
  element: HTMLElement,
  onClose: () => void | Promise<void>
): Promise<void> {
  const user = userEvent.setup();
  
  await user.keyboard(Keys.ESCAPE);
  await onClose();
}

/**
 * 测试箭头键导航（用于列表、菜单等）
 */
export async function testArrowKeyNavigation(
  items: HTMLElement[],
  orientation: 'vertical' | 'horizontal' = 'vertical'
): Promise<void> {
  const user = userEvent.setup();
  const nextKey = orientation === 'vertical' ? Keys.ARROW_DOWN : Keys.ARROW_RIGHT;
  const prevKey = orientation === 'vertical' ? Keys.ARROW_UP : Keys.ARROW_LEFT;
  
  // 测试向下/向右导航
  items[0].focus();
  for (let i = 1; i < items.length; i++) {
    await user.keyboard(nextKey);
    expect(document.activeElement).toBe(items[i]);
  }
  
  // 测试向上/向左导航
  for (let i = items.length - 2; i >= 0; i--) {
    await user.keyboard(prevKey);
    expect(document.activeElement).toBe(items[i]);
  }
}

/**
 * 测试 Home/End 键导航
 */
export async function testHomeEndNavigation(
  firstElement: HTMLElement,
  lastElement: HTMLElement
): Promise<void> {
  const user = userEvent.setup();
  
  // 测试 Home 键跳转到第一个元素
  lastElement.focus();
  await user.keyboard(Keys.HOME);
  expect(document.activeElement).toBe(firstElement);
  
  // 测试 End 键跳转到最后一个元素
  firstElement.focus();
  await user.keyboard(Keys.END);
  expect(document.activeElement).toBe(lastElement);
}

/**
 * 测试焦点陷阱（用于模态框、对话框等）
 */
export async function testFocusTrap(
  container: HTMLElement,
  firstFocusableElement: HTMLElement,
  lastFocusableElement: HTMLElement
): Promise<void> {
  const user = userEvent.setup();
  
  // 聚焦到第一个元素
  firstFocusableElement.focus();
  expect(document.activeElement).toBe(firstFocusableElement);
  
  // Tab 到最后一个元素
  await user.tab();
  // ... 可能需要多次 tab
  lastFocusableElement.focus();
  expect(document.activeElement).toBe(lastFocusableElement);
  
  // 再按 Tab 应该回到第一个元素（焦点陷阱）
  await user.tab();
  expect(document.activeElement).toBe(firstFocusableElement);
  
  // Shift+Tab 应该到最后一个元素
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(lastFocusableElement);
}

/**
 * 获取所有可聚焦元素
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'details',
    'summary',
  ].join(', ');
  
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/**
 * 检查元素是否可聚焦
 */
export function isFocusable(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute('tabindex');
  const isDisabled = element.hasAttribute('disabled') || 
    element.getAttribute('aria-disabled') === 'true';
  
  if (isDisabled) return false;
  
  const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'DETAILS', 'SUMMARY'];
  const isFocusableTag = focusableTags.includes(element.tagName);
  
  return isFocusableTag || (tabIndex !== null && parseInt(tabIndex) >= 0);
}

/**
 * 测试焦点可见性（focus visible）
 */
export function hasFocusIndicator(element: HTMLElement): boolean {
  const styles = window.getComputedStyle(element);
  
  // 检查是否有明显的焦点样式
  return !!(
    styles.outline !== 'none' ||
    styles.outlineWidth !== '0px' ||
    styles.boxShadow !== 'none' ||
    styles.border !== styles.border // 检查 :focus 是否改变了 border
  );
}

/**
 * 模拟键盘事件
 */
export function createKeyboardEvent(
  type: 'keydown' | 'keyup' | 'keypress',
  key: string,
  options?: Partial<KeyboardEventInit>
): KeyboardEvent {
  return new KeyboardEvent(type, {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

/**
 * 测试快捷键
 */
export async function testShortcut(
  key: string,
  modifiers: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  } = {},
  onTrigger: () => void | Promise<void>
): Promise<void> {
  const user = userEvent.setup();
  
  let keySequence = '';
  if (modifiers.ctrl) keySequence += '{Control>}';
  if (modifiers.shift) keySequence += '{Shift>}';
  if (modifiers.alt) keySequence += '{Alt>}';
  if (modifiers.meta) keySequence += '{Meta>}';
  
  keySequence += key;
  
  if (modifiers.meta) keySequence += '{/Meta}';
  if (modifiers.alt) keySequence += '{/Alt}';
  if (modifiers.shift) keySequence += '{/Shift}';
  if (modifiers.ctrl) keySequence += '{/Control}';
  
  await user.keyboard(keySequence);
  await onTrigger();
}

