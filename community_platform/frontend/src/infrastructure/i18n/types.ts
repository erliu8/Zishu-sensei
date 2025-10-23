/**
 * 国际化类型定义
 */

/**
 * 支持的语言类型
 */
export type Locale = 'zh-CN' | 'en-US' | 'ja-JP';

/**
 * 语言信息
 */
export interface LocaleInfo {
  /** 语言代码 */
  code: Locale;
  /** 语言名称（本地化） */
  name: string;
  /** 语言名称（英文） */
  nameEn: string;
  /** 语言图标/旗帜 */
  flag: string;
  /** 是否为 RTL（从右到左）语言 */
  rtl?: boolean;
}

/**
 * 翻译命名空间
 */
export type TranslationNamespace =
  | 'common'
  | 'auth'
  | 'post'
  | 'adapter'
  | 'character'
  | 'comment'
  | 'social'
  | 'search'
  | 'notification'
  | 'packaging'
  | 'profile'
  | 'settings'
  | 'validation'
  | 'error';

/**
 * 翻译函数类型
 */
export type TranslationFunction = (
  key: string,
  values?: Record<string, string | number>
) => string;

/**
 * 翻译上下文
 */
export interface I18nContext {
  /** 当前语言 */
  locale: Locale;
  /** 翻译函数 */
  t: TranslationFunction;
  /** 切换语言 */
  setLocale: (locale: Locale) => void;
  /** 所有可用语言 */
  locales: LocaleInfo[];
}

