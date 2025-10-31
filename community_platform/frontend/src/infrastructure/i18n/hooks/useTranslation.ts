/**
 * useTranslation Hook
 * 提供命名空间的翻译功能
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useI18n, type TranslateFn } from './useI18n';

/**
 * 命名空间类型
 */
export type Namespace =
  | 'common'
  | 'auth'
  | 'user'
  | 'post'
  | 'adapter'
  | 'character'
  | 'comment'
  | 'social'
  | 'settings'
  | 'error'
  | 'validation'
  | 'notification'
  | 'packaging'
  | 'profile'
  | 'search';

/**
 * useTranslation Hook 返回值
 */
export interface UseTranslationReturn {
  /** 翻译函数 */
  t: TranslateFn;
  /** 当前语言 */
  locale: string;
}

/**
 * useTranslation Hook
 * 
 * @param namespace - 命名空间
 * @returns 翻译函数和当前语言
 * 
 * @example
 * ```tsx
 * const { t } = useTranslation('common');
 * return <div>{t('actions.submit')}</div>;
 * ```
 */
export function useTranslation(
  namespace?: Namespace
): UseTranslationReturn {
  const { locale, t: globalT } = useI18n();

  /**
   * 带命名空间的翻译函数
   */
  const t: TranslateFn = useCallback(
    (key: string, values?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return globalT(fullKey, values);
    },
    [namespace, globalT]
  );

  return useMemo(
    () => ({
      t,
      locale,
    }),
    [t, locale]
  );
}

export default useTranslation;
