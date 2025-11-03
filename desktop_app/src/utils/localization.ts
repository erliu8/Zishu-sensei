import { getCurrentLanguage, SupportedLanguage } from '../locales';

// Type declaration for Intl.ListFormat (may not be available in all environments)
declare namespace Intl {
  interface ListFormat {
    format(items: string[]): string;
  }
  interface ListFormatConstructor {
    new (locale?: string | string[], options?: {
      style?: 'long' | 'short' | 'narrow';
      type?: 'conjunction' | 'disjunction' | 'unit';
    }): ListFormat;
  }
  var ListFormat: ListFormatConstructor | undefined;
}

// 数字格式化选项
interface NumberFormatOptions {
  locale?: SupportedLanguage;
  style?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumIntegerDigits?: number;
  useGrouping?: boolean;
}

// 日期格式化选项
interface DateFormatOptions {
  locale?: SupportedLanguage;
  year?: 'numeric' | '2-digit';
  month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
  day?: 'numeric' | '2-digit';
  hour?: 'numeric' | '2-digit';
  minute?: 'numeric' | '2-digit';
  second?: 'numeric' | '2-digit';
  weekday?: 'long' | 'short' | 'narrow';
  era?: 'long' | 'short' | 'narrow';
  timeZoneName?: 'long' | 'short';
}

// 货币格式化选项
interface CurrencyFormatOptions {
  locale?: SupportedLanguage;
  currency?: string;
  style?: 'currency';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

// 相对时间格式化选项
interface RelativeTimeFormatOptions {
  locale?: SupportedLanguage;
  numeric?: 'always' | 'auto';
  style?: 'long' | 'short' | 'narrow';
}

/**
 * 格式化数字
 */
export const formatNumber = (
  value: number,
  options: NumberFormatOptions = {}
): string => {
  const { locale = getCurrentLanguage(), ...formatOptions } = options;
  
  try {
    // 检查是否支持Intl.NumberFormat
    if (typeof Intl !== 'undefined' && (Intl as any).NumberFormat) {
      return new (Intl as any).NumberFormat(locale, formatOptions).format(value);
    } else {
      return value.toString();
    }
  } catch (error) {
    console.warn('Number formatting failed:', error);
    return value.toString();
  }
};

/**
 * 格式化百分比
 */
export const formatPercent = (
  value: number,
  options: NumberFormatOptions = {}
): string => {
  return formatNumber(value, {
    ...options,
    style: 'percent'
  });
};

/**
 * 格式化货币
 */
export const formatCurrency = (
  value: number,
  options: CurrencyFormatOptions = {}
): string => {
  const { 
    locale = getCurrentLanguage(), 
    currency = getCurrencyForLocale(locale),
    ...formatOptions 
  } = options;
  
  try {
    return new (Intl as any).NumberFormat(locale, {
      style: 'currency',
      currency,
      ...formatOptions
    }).format(value);
  } catch (error) {
    console.warn('Currency formatting failed:', error);
    return `${currency} ${value}`;
  }
};

/**
 * 格式化日期
 */
export const formatDate = (
  date: Date | string | number,
  options: DateFormatOptions = {}
): string => {
  const { locale = getCurrentLanguage(), ...formatOptions } = options;
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    console.warn('Invalid date provided to formatDate:', date);
    return String(date);
  }
  
  try {
    return new (Intl as any).DateTimeFormat(locale, formatOptions).format(dateObj);
  } catch (error) {
    console.warn('Date formatting failed:', error);
    return dateObj.toLocaleDateString();
  }
};

/**
 * 格式化时间
 */
export const formatTime = (
  date: Date | string | number,
  options: DateFormatOptions = {}
): string => {
  return formatDate(date, {
    ...options,
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 格式化日期时间
 */
export const formatDateTime = (
  date: Date | string | number,
  options: DateFormatOptions = {}
): string => {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  });
};

/**
 * 格式化相对时间
 */
export const formatRelativeTime = (
  date: Date | string | number,
  options: RelativeTimeFormatOptions = {}
): string => {
  const { locale = getCurrentLanguage(), ...formatOptions } = options;
  const dateObj = new Date(date);
  const now = new Date();
  
  if (isNaN(dateObj.getTime())) {
    console.warn('Invalid date provided to formatRelativeTime:', date);
    return String(date);
  }
  
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  try {
    const rtf = new (Intl as any).RelativeTimeFormat(locale, {
      numeric: 'auto',
      ...formatOptions
    });
    
    if (Math.abs(diffYears) >= 1) {
      return rtf.format(-diffYears, 'year');
    } else if (Math.abs(diffMonths) >= 1) {
      return rtf.format(-diffMonths, 'month');
    } else if (Math.abs(diffWeeks) >= 1) {
      return rtf.format(-diffWeeks, 'week');
    } else if (Math.abs(diffDays) >= 1) {
      return rtf.format(-diffDays, 'day');
    } else if (Math.abs(diffHours) >= 1) {
      return rtf.format(-diffHours, 'hour');
    } else if (Math.abs(diffMinutes) >= 1) {
      return rtf.format(-diffMinutes, 'minute');
    } else {
      return rtf.format(-diffSeconds, 'second');
    }
  } catch (error) {
    console.warn('Relative time formatting failed:', error);
    return formatDate(dateObj);
  }
};

/**
 * 格式化文件大小
 */
export const formatFileSize = (
  bytes: number,
  options: { locale?: SupportedLanguage; binary?: boolean } = {}
): string => {
  const { locale = getCurrentLanguage(), binary = false } = options;
  const base = binary ? 1024 : 1000;
  const units = binary 
    ? ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    : ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  if (bytes === 0) return '0 B';
  
  const exponent = Math.floor(Math.log(bytes) / Math.log(base));
  const value = bytes / Math.pow(base, exponent);
  const unit = units[Math.min(exponent, units.length - 1)];
  
  const formattedValue = formatNumber(value, {
    locale,
    maximumFractionDigits: exponent === 0 ? 0 : 1
  });
  
  return `${formattedValue} ${unit}`;
};

/**
 * 格式化列表
 */
export const formatList = (
  items: string[],
  options: { 
    locale?: SupportedLanguage;
    style?: 'long' | 'short' | 'narrow';
    type?: 'conjunction' | 'disjunction' | 'unit';
  } = {}
): string => {
  const { 
    locale = getCurrentLanguage(), 
    style = 'long',
    type = 'conjunction'
  } = options;
  
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  
  try {
    // Check if Intl.ListFormat is available
    if (typeof Intl.ListFormat !== 'undefined') {
      const listFormatter = new (Intl as any).ListFormat(locale, { style, type });
      return listFormatter.format(items);
    } else {
      // Fallback for environments without Intl.ListFormat support
      if (type === 'disjunction') {
        return items.join(' or ');
      } else {
        return items.join(', ');
      }
    }
  } catch (error) {
    console.warn('List formatting failed:', error);
    return items.join(', ');
  }
};

/**
 * 获取语言对应的货币代码
 */
export const getCurrencyForLocale = (locale: SupportedLanguage): string => {
  const currencyMap: Record<SupportedLanguage, string> = {
    zh: 'CNY',
    en: 'USD',
    ja: 'JPY',
    ko: 'KRW'
  };
  
  return currencyMap[locale] || 'USD';
};

/**
 * 获取语言对应的时区
 */
export const getTimezoneForLocale = (locale: SupportedLanguage): string => {
  const timezoneMap: Record<SupportedLanguage, string> = {
    zh: 'Asia/Shanghai',
    en: 'America/New_York',
    ja: 'Asia/Tokyo',
    ko: 'Asia/Seoul'
  };
  
  return timezoneMap[locale] || 'UTC';
};

/**
 * 检查是否为 RTL 语言
 */
export const isRTL = (locale: SupportedLanguage): boolean => {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  return rtlLanguages.includes(locale);
};

/**
 * 获取语言的文本方向
 */
export const getTextDirection = (locale: SupportedLanguage): 'ltr' | 'rtl' => {
  return isRTL(locale) ? 'rtl' : 'ltr';
};

/**
 * 格式化复数
 */
export const formatPlural = (
  count: number,
  options: {
    locale?: SupportedLanguage;
    type?: 'cardinal' | 'ordinal';
  } = {}
): string => {
  const { locale = getCurrentLanguage(), type = 'cardinal' } = options;
  
  try {
    const pluralRules = new (Intl as any).PluralRules(locale, { type });
    return pluralRules.select(count);
  } catch (error) {
    console.warn('Plural formatting failed:', error);
    return 'other';
  }
};

/**
 * 本地化排序
 */
export const localizedSort = <T>(
  items: T[],
  keyExtractor: (item: T) => string,
  options: {
    locale?: SupportedLanguage;
    sensitivity?: 'base' | 'accent' | 'case' | 'variant';
    numeric?: boolean;
  } = {}
): T[] => {
  const { 
    locale = getCurrentLanguage(),
    sensitivity = 'base',
    numeric = false
  } = options;
  
  try {
    const collator = new (Intl as any).Collator(locale, { sensitivity, numeric });
    return [...items].sort((a, b) => 
      collator.compare(keyExtractor(a), keyExtractor(b))
    );
  } catch (error) {
    console.warn('Localized sorting failed:', error);
    return [...items].sort((a, b) => 
      keyExtractor(a).localeCompare(keyExtractor(b))
    );
  }
};

/**
 * 获取本地化的星期几名称
 */
export const getWeekdayNames = (
  locale: SupportedLanguage = getCurrentLanguage(),
  format: 'long' | 'short' | 'narrow' = 'long'
): string[] => {
  const formatter = new (Intl as any).DateTimeFormat(locale, { weekday: format });
  const names: string[] = [];
  
  // 从周日开始
  for (let i = 0; i < 7; i++) {
    const date = new Date(2023, 0, i + 1); // 2023年1月1日是周日
    names.push(formatter.format(date));
  }
  
  return names;
};

/**
 * 获取本地化的月份名称
 */
export const getMonthNames = (
  locale: SupportedLanguage = getCurrentLanguage(),
  format: 'long' | 'short' | 'narrow' = 'long'
): string[] => {
  const formatter = new (Intl as any).DateTimeFormat(locale, { month: format });
  const names: string[] = [];
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(2023, i, 1);
    names.push(formatter.format(date));
  }
  
  return names;
};

/**
 * 本地化工具类
 */
export class LocalizationUtils {
  private locale: SupportedLanguage;
  
  constructor(locale?: SupportedLanguage) {
    this.locale = locale || getCurrentLanguage();
  }
  
  setLocale(locale: SupportedLanguage) {
    this.locale = locale;
  }
  
  formatNumber(value: number, options?: NumberFormatOptions) {
    return formatNumber(value, { ...options, locale: this.locale });
  }
  
  formatCurrency(value: number, options?: CurrencyFormatOptions) {
    return formatCurrency(value, { ...options, locale: this.locale });
  }
  
  formatDate(date: Date | string | number, options?: DateFormatOptions) {
    return formatDate(date, { ...options, locale: this.locale });
  }
  
  formatRelativeTime(date: Date | string | number, options?: RelativeTimeFormatOptions) {
    return formatRelativeTime(date, { ...options, locale: this.locale });
  }
  
  formatList(items: string[], options?: Parameters<typeof formatList>[1]) {
    return formatList(items, { ...options, locale: this.locale });
  }
}

// 默认实例
export const localizationUtils = new LocalizationUtils();
