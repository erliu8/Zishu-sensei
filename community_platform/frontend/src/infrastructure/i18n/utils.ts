/**
 * 国际化工具函数
 */

import type { Locale } from './types';
import { LOCALE_STORAGE_KEY } from './config';

// 导出日期和数字格式化工具
export * from './utils/dateFormatter';
export * from './utils/numberFormatter';

/**
 * 从 LocalStorage 获取保存的语言
 */
export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored as Locale | null;
  } catch {
    return null;
  }
}

/**
 * 保存语言到 LocalStorage
 */
export function setStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch (error) {
    console.error('Failed to store locale:', error);
  }
}

/**
 * 从 Cookie 获取语言
 */
export function getLocaleFromCookie(): Locale | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  const localeCookie = cookies.find((cookie) =>
    cookie.trim().startsWith(`${LOCALE_STORAGE_KEY}=`)
  );

  if (localeCookie) {
    return localeCookie.split('=')[1] as Locale;
  }

  return null;
}

/**
 * 设置 Cookie 语言
 */
export function setLocaleToCookie(locale: Locale): void {
  if (typeof document === 'undefined') {
    return;
  }

  const maxAge = 365 * 24 * 60 * 60; // 1 year
  document.cookie = `${LOCALE_STORAGE_KEY}=${locale}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * 格式化翻译键的值
 */
export function formatMessage(
  template: string,
  values?: Record<string, string | number>
): string {
  if (!values) {
    return template;
  }

  return Object.entries(values).reduce((result, [key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    return result.replace(regex, String(value));
  }, template);
}

/**
 * 获取嵌套对象的值
 */
export function getNestedValue(
  obj: Record<string, any>,
  path: string
): string | undefined {
  const keys = path.split('.');
  let result: any = obj;

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return undefined;
    }
  }

  return typeof result === 'string' ? result : undefined;
}

/**
 * 检测 RTL（从右到左）语言
 */
export function isRTL(locale: Locale): boolean {
  const rtlLocales: Locale[] = [];
  return rtlLocales.includes(locale);
}

/**
 * 获取语言方向
 */
export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return isRTL(locale) ? 'rtl' : 'ltr';
}

