/**
 * 国际化 Hook
 */

'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Locale } from '../types';
import { formatMessage, getNestedValue } from '../utils';
import { setStoredLocale, setLocaleToCookie } from '../utils';

/**
 * 翻译函数类型
 */
export type TranslateFn = (
  key: string,
  values?: Record<string, string | number>
) => string;

/**
 * useI18n Hook 返回值
 */
export interface UseI18nReturn {
  /** 当前语言 */
  locale: Locale;
  /** 翻译函数 */
  t: TranslateFn;
  /** 切换语言 */
  changeLocale: (newLocale: Locale) => void;
  /** 格式化消息 */
  formatMessage: typeof formatMessage;
}

/**
 * 从上下文或路径获取当前语言
 */
function getCurrentLocale(): Locale {
  // 这里应该从 context 或路由中获取
  // 暂时返回默认值
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    const localeMatch = pathname.match(/^\/(zh-CN|en-US|ja-JP)/);
    if (localeMatch) {
      return localeMatch[1] as Locale;
    }
  }
  return 'zh-CN';
}

/**
 * 获取翻译资源
 */
async function getTranslations(locale: Locale): Promise<Record<string, any>> {
  try {
    const translations = await import(`../locales/${locale}/index.ts`);
    return translations.default;
  } catch (error) {
    console.error(`Failed to load translations for ${locale}:`, error);
    // 回退到中文
    const fallback = await import('../locales/zh-CN/index.ts');
    return fallback.default;
  }
}

/**
 * useI18n Hook
 * 提供国际化功能
 */
export function useI18n(): UseI18nReturn {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getCurrentLocale();

  /**
   * 翻译函数
   */
  const t: TranslateFn = useCallback(
    (key: string, values?: Record<string, string | number>) => {
      // 这里应该使用实际的翻译资源
      // 为了性能，应该在组件外部加载翻译资源
      // 这里简化处理，实际应该配合 I18nProvider 使用
      
      // 临时返回 key，实际应该查找翻译
      return values ? formatMessage(key, values) : key;
    },
    [locale]
  );

  /**
   * 切换语言
   */
  const changeLocale = useCallback(
    (newLocale: Locale) => {
      // 保存到 localStorage 和 Cookie
      setStoredLocale(newLocale);
      setLocaleToCookie(newLocale);

      // 更新路由
      if (pathname) {
        const newPathname = pathname.replace(
          /^\/(zh-CN|en-US|ja-JP)/,
          `/${newLocale}`
        );
        router.push(newPathname || `/${newLocale}`);
      }
    },
    [pathname, router]
  );

  return {
    locale,
    t,
    changeLocale,
    formatMessage,
  };
}

export default useI18n;

