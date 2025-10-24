/**
 * 组件测试辅助工具
 * 提供常用的测试辅助函数和工具
 */

import { ReactElement } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * 创建用户事件实例（推荐方式）
 */
export function setupUser() {
  return userEvent.setup();
}

/**
 * 渲染组件并返回用户事件实例
 */
export function renderWithUser(
  ui: ReactElement,
  options?: RenderOptions
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const user = userEvent.setup();
  return {
    ...render(ui, options),
    user,
  };
}

/**
 * 等待指定毫秒数
 */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 等待动画完成（通常是300ms）
 */
export const waitForAnimation = () => sleep(300);

/**
 * 查找元素并等待它出现
 */
export async function waitForElement(
  getElement: () => HTMLElement | null,
  timeout = 3000
): Promise<HTMLElement> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const element = getElement();
    if (element) return element;
    await sleep(50);
  }
  throw new Error('Element not found within timeout');
}

/**
 * 模拟文件上传
 */
export function createMockFile(
  name: string,
  size: number,
  type: string,
  content: string = 'mock file content'
): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

/**
 * 模拟图片文件
 */
export function createMockImageFile(
  name: string = 'test-image.jpg',
  size: number = 1024
): File {
  return createMockFile(name, size, 'image/jpeg');
}

/**
 * 模拟多个文件
 */
export function createMockFiles(count: number, namePrefix: string = 'file'): File[] {
  return Array.from({ length: count }, (_, i) =>
    createMockFile(`${namePrefix}-${i + 1}.txt`, 1024, 'text/plain')
  );
}

/**
 * 检查元素是否可见
 */
export function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

/**
 * 触发表单提交
 */
export async function submitForm(
  form: HTMLFormElement,
  user?: ReturnType<typeof userEvent.setup>
): Promise<void> {
  if (user) {
    const submitButton = form.querySelector('[type="submit"]') as HTMLElement;
    if (submitButton) {
      await user.click(submitButton);
    }
  } else {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
}

/**
 * 填充表单字段
 */
export async function fillFormField(
  input: HTMLElement,
  value: string,
  user: ReturnType<typeof userEvent.setup>
): Promise<void> {
  await user.clear(input);
  await user.type(input, value);
}

/**
 * 填充整个表单
 */
export async function fillForm(
  fields: Record<string, { element: HTMLElement; value: string }>,
  user: ReturnType<typeof userEvent.setup>
): Promise<void> {
  for (const [, { element, value }] of Object.entries(fields)) {
    await fillFormField(element, value, user);
  }
}

/**
 * 模拟拖放操作
 */
export function createDragEvent(type: string, dataTransfer?: DataTransfer): DragEvent {
  const event = new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    dataTransfer: dataTransfer || new DataTransfer(),
  });
  return event;
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
    bubbles: true,
    cancelable: true,
    key,
    ...options,
  });
}

/**
 * 模拟鼠标事件
 */
export function createMouseEvent(
  type: string,
  options?: Partial<MouseEventInit>
): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

/**
 * 模拟触摸事件
 */
export function createTouchEvent(
  type: string,
  touches: Touch[] = []
): TouchEvent {
  return new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches,
  });
}

/**
 * 检查元素是否有特定的 CSS 类
 */
export function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * 检查元素是否有多个 CSS 类
 */
export function hasClasses(element: HTMLElement, classNames: string[]): boolean {
  return classNames.every((className) => hasClass(element, className));
}

/**
 * 获取元素的计算样式
 */
export function getComputedStyle(
  element: HTMLElement,
  property: string
): string {
  return window.getComputedStyle(element).getPropertyValue(property);
}

/**
 * 模拟窗口大小变化
 */
export function resizeWindow(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

/**
 * 模拟媒体查询匹配
 */
export function mockMatchMedia(query: string, matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({
      matches: q === query ? matches : false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

/**
 * 模拟滚动到元素
 */
export function scrollIntoView(element: HTMLElement): void {
  element.scrollIntoView = vi.fn();
  element.scrollIntoView();
}

/**
 * 模拟元素聚焦
 */
export function focusElement(element: HTMLElement): void {
  element.focus();
  element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
}

/**
 * 模拟元素失焦
 */
export function blurElement(element: HTMLElement): void {
  element.blur();
  element.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

/**
 * 获取元素的边界矩形（用于测试）
 */
export function mockGetBoundingClientRect(
  element: HTMLElement,
  rect: Partial<DOMRect>
): void {
  element.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => {},
    ...rect,
  }));
}

/**
 * 清理所有 Mock
 */
export function clearAllMocks(): void {
  vi.clearAllMocks();
  vi.clearAllTimers();
}

/**
 * 快照测试辅助函数
 */
export function toMatchSnapshot(container: HTMLElement, name?: string): void {
  expect(container).toMatchSnapshot(name);
}

/**
 * 断言元素在文档中
 */
export function assertInDocument(element: HTMLElement | null): asserts element {
  expect(element).toBeInTheDocument();
}

/**
 * 断言元素不在文档中
 */
export function assertNotInDocument(element: HTMLElement | null): void {
  expect(element).not.toBeInTheDocument();
}

/**
 * 断言元素可见
 */
export function assertVisible(element: HTMLElement): void {
  expect(element).toBeVisible();
}

/**
 * 断言元素隐藏
 */
export function assertHidden(element: HTMLElement | null): void {
  if (element) {
    expect(element).not.toBeVisible();
  } else {
    expect(element).not.toBeInTheDocument();
  }
}

/**
 * 创建测试 ID 选择器
 */
export function getByTestId(testId: string): string {
  return `[data-testid="${testId}"]`;
}

/**
 * 调试辅助：打印元素树
 */
export function debugElement(element: HTMLElement, maxDepth: number = 3): void {
  console.log(element.outerHTML.slice(0, 500));
}

/**
 * 性能测试辅助
 */
export function measureRenderTime(callback: () => void): number {
  const start = performance.now();
  callback();
  return performance.now() - start;
}

/**
 * 批量断言辅助
 */
export function expectAll<T>(
  items: T[],
  assertion: (item: T) => void
): void {
  items.forEach(assertion);
}

