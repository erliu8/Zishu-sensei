/**
 * 国际化配置
 */

import type { Locale, LocaleInfo } from './types';

/**
 * 默认语言
 */
export const DEFAULT_LOCALE: Locale = 'zh-CN';

/**
 * 支持的语言列表
 */
export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en-US', 'ja-JP'];

/**
 * 语言信息配置
 */
export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  'zh-CN': {
    code: 'zh-CN',
    name: '简体中文',
    nameEn: 'Simplified Chinese',
    flag: '🇨🇳',
    rtl: false,
  },
  'en-US': {
    code: 'en-US',
    name: 'English',
    nameEn: 'English',
    flag: '🇺🇸',
    rtl: false,
  },
  'ja-JP': {
    code: 'ja-JP',
    name: '日本語',
    nameEn: 'Japanese',
    flag: '🇯🇵',
    rtl: false,
  },
};

/**
 * Cookie/LocalStorage 键名
 */
export const LOCALE_STORAGE_KEY = 'zishu-locale';

/**
 * Cookie 配置
 */
export const LOCALE_COOKIE_CONFIG = {
  name: LOCALE_STORAGE_KEY,
  maxAge: 365 * 24 * 60 * 60, // 1 年
  path: '/',
  sameSite: 'lax' as const,
};

/**
 * 翻译文件路径配置
 */
export const TRANSLATION_FILES_PATH = '/locales';

/**
 * 验证语言代码是否有效
 */
export function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}

/**
 * 获取语言信息
 */
export function getLocaleInfo(locale: Locale): LocaleInfo {
  return LOCALE_INFO[locale];
}

/**
 * 获取所有语言信息
 */
export function getAllLocalesInfo(): LocaleInfo[] {
  return SUPPORTED_LOCALES.map((locale) => LOCALE_INFO[locale]);
}

/**
 * 从浏览器获取首选语言
 */
export function getBrowserLocale(): Locale {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  const browserLang = navigator.language || (navigator as any).userLanguage;

  // 尝试精确匹配
  if (isValidLocale(browserLang)) {
    return browserLang;
  }

  // 尝试语言前缀匹配
  const langPrefix = browserLang.split('-')[0];
  const matchedLocale = SUPPORTED_LOCALES.find((locale) =>
    locale.startsWith(langPrefix)
  );

  return matchedLocale || DEFAULT_LOCALE;
}

/**
 * Next.js i18n 配置
 */
export const nextI18nConfig = {
  defaultLocale: DEFAULT_LOCALE,
  locales: SUPPORTED_LOCALES,
};

