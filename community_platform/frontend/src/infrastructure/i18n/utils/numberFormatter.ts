/**
 * 数字格式化工具
 */

import type { Locale } from '../types';

/**
 * 数字格式化选项
 */
export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  locale?: Locale;
}

/**
 * 货币格式化选项
 */
export interface CurrencyFormatOptions extends NumberFormatOptions {
  /** 货币代码 (如: CNY, USD, JPY) */
  currency?: string;
}

/**
 * 百分比格式化选项
 */
export interface PercentFormatOptions extends NumberFormatOptions {
  /** 小数位数 */
  decimals?: number;
}

/**
 * 获取数字格式化器
 */
function getNumberFormatter(
  locale: Locale,
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, options);
}

/**
 * 格式化数字
 * 
 * @param value - 数字值
 * @param options - 格式化选项
 * @returns 格式化后的数字字符串
 * 
 * @example
 * ```ts
 * formatNumber(1234567.89, { locale: 'zh-CN' }) // "1,234,567.89"
 * formatNumber(1234567.89, { locale: 'en-US' }) // "1,234,567.89"
 * formatNumber(1234567.89, { locale: 'ja-JP' }) // "1,234,567.89"
 * ```
 */
export function formatNumber(
  value: number,
  options: NumberFormatOptions = {}
): string {
  const { locale = 'zh-CN', ...formatOptions } = options;
  const formatter = getNumberFormatter(locale, formatOptions);
  return formatter.format(value);
}

/**
 * 格式化货币
 * 
 * @param value - 金额
 * @param options - 格式化选项
 * @returns 格式化后的货币字符串
 * 
 * @example
 * ```ts
 * formatCurrency(1234.56, { locale: 'zh-CN', currency: 'CNY' }) // "¥1,234.56"
 * formatCurrency(1234.56, { locale: 'en-US', currency: 'USD' }) // "$1,234.56"
 * formatCurrency(1234.56, { locale: 'ja-JP', currency: 'JPY' }) // "¥1,235"
 * ```
 */
export function formatCurrency(
  value: number,
  options: CurrencyFormatOptions = {}
): string {
  const { locale = 'zh-CN', currency = 'CNY', ...formatOptions } = options;
  return formatNumber(value, {
    locale,
    style: 'currency',
    currency,
    ...formatOptions,
  });
}

/**
 * 格式化百分比
 * 
 * @param value - 数值 (0-1 或 0-100)
 * @param options - 格式化选项
 * @returns 格式化后的百分比字符串
 * 
 * @example
 * ```ts
 * formatPercent(0.1234) // "12.34%"
 * formatPercent(12.34, { decimals: 1 }) // "12.3%"
 * ```
 */
export function formatPercent(
  value: number,
  options: PercentFormatOptions = {}
): string {
  const { locale = 'zh-CN', decimals = 2, ...formatOptions } = options;
  
  // 如果值大于 1，假设是百分比形式 (0-100)
  const normalizedValue = value > 1 ? value / 100 : value;
  
  return formatNumber(normalizedValue, {
    locale,
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...formatOptions,
  });
}

/**
 * 格式化文件大小
 * 
 * @param bytes - 字节数
 * @param options - 格式化选项
 * @returns 格式化后的文件大小字符串
 * 
 * @example
 * ```ts
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1048576) // "1 MB"
 * formatFileSize(1073741824) // "1 GB"
 * ```
 */
export function formatFileSize(
  bytes: number,
  options: NumberFormatOptions = {}
): string {
  const { locale = 'zh-CN' } = options;
  
  if (bytes === 0) {
    return '0 B';
  }
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  
  const formatted = formatNumber(value, {
    locale,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  
  return `${formatted} ${units[i]}`;
}

/**
 * 格式化紧凑数字（使用 K, M, B 等单位）
 * 
 * @param value - 数字值
 * @param options - 格式化选项
 * @returns 格式化后的紧凑数字字符串
 * 
 * @example
 * ```ts
 * formatCompactNumber(1234) // "1.2K"
 * formatCompactNumber(1234567) // "1.2M"
 * formatCompactNumber(1234567890) // "1.2B"
 * ```
 */
export function formatCompactNumber(
  value: number,
  options: NumberFormatOptions = {}
): string {
  const { locale = 'zh-CN', ...formatOptions } = options;
  
  return formatNumber(value, {
    locale,
    notation: 'compact',
    compactDisplay: 'short',
    ...formatOptions,
  });
}

/**
 * 格式化序数（第一、第二等）
 * 
 * @param value - 数字值
 * @param locale - 语言环境
 * @returns 格式化后的序数字符串
 * 
 * @example
 * ```ts
 * formatOrdinal(1, 'en-US') // "1st"
 * formatOrdinal(2, 'en-US') // "2nd"
 * formatOrdinal(3, 'en-US') // "3rd"
 * formatOrdinal(1, 'zh-CN') // "第1"
 * ```
 */
export function formatOrdinal(value: number, locale: Locale = 'zh-CN'): string {
  if (locale === 'zh-CN') {
    return `第${value}`;
  }
  
  if (locale === 'ja-JP') {
    return `${value}番目`;
  }
  
  // 英文序数
  const pr = new Intl.PluralRules(locale, { type: 'ordinal' });
  const suffixes: Record<string, string> = {
    one: 'st',
    two: 'nd',
    few: 'rd',
    other: 'th',
  };
  const rule = pr.select(value);
  const suffix = suffixes[rule];
  
  return `${value}${suffix}`;
}

/**
 * 格式化范围
 * 
 * @param start - 开始值
 * @param end - 结束值
 * @param options - 格式化选项
 * @returns 格式化后的范围字符串
 * 
 * @example
 * ```ts
 * formatRange(10, 20) // "10-20"
 * formatRange(1000, 5000, { locale: 'zh-CN' }) // "1,000-5,000"
 * ```
 */
export function formatRange(
  start: number,
  end: number,
  options: NumberFormatOptions = {}
): string {
  const { locale = 'zh-CN', ...formatOptions } = options;
  const formatter = getNumberFormatter(locale, formatOptions);
  
  // @ts-ignore - formatRange 在较新版本的 TypeScript 中支持
  if (formatter.formatRange) {
    // @ts-ignore
    return formatter.formatRange(start, end);
  }
  
  // 降级方案
  return `${formatter.format(start)}-${formatter.format(end)}`;
}

/**
 * 缩写大数字（中文习惯）
 * 
 * @param value - 数字值
 * @returns 缩写后的字符串
 * 
 * @example
 * ```ts
 * abbreviateNumber(1234) // "1.2千"
 * abbreviateNumber(12345) // "1.2万"
 * abbreviateNumber(123456789) // "1.2亿"
 * ```
 */
export function abbreviateNumber(value: number): string {
  if (value < 1000) {
    return value.toString();
  }
  
  if (value < 10000) {
    return `${(value / 1000).toFixed(1)}千`;
  }
  
  if (value < 100000000) {
    return `${(value / 10000).toFixed(1)}万`;
  }
  
  return `${(value / 100000000).toFixed(1)}亿`;
}

/**
 * 格式化持续时间（秒数转为时分秒）
 * 
 * @param seconds - 秒数
 * @param locale - 语言环境
 * @returns 格式化后的持续时间字符串
 * 
 * @example
 * ```ts
 * formatDuration(125) // "2分5秒"
 * formatDuration(3725) // "1小时2分5秒"
 * ```
 */
export function formatDuration(seconds: number, locale: Locale = 'zh-CN'): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  
  if (locale === 'zh-CN') {
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);
  } else if (locale === 'ja-JP') {
    if (hours > 0) parts.push(`${hours}時間`);
    if (minutes > 0) parts.push(`${minutes}分`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);
  } else {
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  }
  
  return parts.join(' ');
}

