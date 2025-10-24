/**
 * 自定义断言辅助函数
 */

import { expect } from 'vitest';

/**
 * 断言元素是否可见
 */
export function assertElementVisible(element: HTMLElement | null) {
  expect(element).toBeInTheDocument();
  expect(element).toBeVisible();
}

/**
 * 断言元素是否隐藏
 */
export function assertElementHidden(element: HTMLElement | null) {
  if (element) {
    expect(element).not.toBeVisible();
  }
}

/**
 * 断言元素是否禁用
 */
export function assertElementDisabled(element: HTMLElement | null) {
  expect(element).toBeInTheDocument();
  expect(element).toBeDisabled();
}

/**
 * 断言元素是否启用
 */
export function assertElementEnabled(element: HTMLElement | null) {
  expect(element).toBeInTheDocument();
  expect(element).not.toBeDisabled();
}

/**
 * 断言元素包含文本
 */
export function assertElementHasText(element: HTMLElement | null, text: string) {
  expect(element).toBeInTheDocument();
  expect(element).toHaveTextContent(text);
}

/**
 * 断言数组长度
 */
export function assertArrayLength<T>(array: T[], expectedLength: number) {
  expect(array).toHaveLength(expectedLength);
}

/**
 * 断言对象包含属性
 */
export function assertObjectHasProperty(obj: any, property: string) {
  expect(obj).toHaveProperty(property);
}

/**
 * 断言是否为有效的日期字符串
 */
export function assertValidDateString(dateString: string) {
  const date = new Date(dateString);
  expect(date.toString()).not.toBe('Invalid Date');
}

/**
 * 断言是否为有效的 Email
 */
export function assertValidEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  expect(emailRegex.test(email)).toBe(true);
}

/**
 * 断言是否为有效的 URL
 */
export function assertValidUrl(url: string) {
  expect(() => new URL(url)).not.toThrow();
}

