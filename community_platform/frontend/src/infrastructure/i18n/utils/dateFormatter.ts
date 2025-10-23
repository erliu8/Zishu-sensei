/**
 * 日期格式化工具
 */

import type { Locale } from '../types';

/**
 * 日期格式化选项
 */
export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  locale?: Locale;
}

/**
 * 相对时间格式化选项
 */
export interface RelativeTimeOptions {
  locale?: Locale;
  /** 是否使用缩写形式 */
  short?: boolean;
  /** 是否总是显示数值 */
  numeric?: 'always' | 'auto';
}

/**
 * 获取语言环境的 Intl.DateTimeFormat
 */
function getDateFormatter(
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, options);
}

/**
 * 获取语言环境的 Intl.RelativeTimeFormat
 */
function getRelativeTimeFormatter(
  locale: Locale,
  options?: Intl.RelativeTimeFormatOptions
): Intl.RelativeTimeFormat {
  return new Intl.RelativeTimeFormat(locale, options);
}

/**
 * 格式化日期
 * 
 * @param date - 日期对象、时间戳或日期字符串
 * @param options - 格式化选项
 * @returns 格式化后的日期字符串
 * 
 * @example
 * ```ts
 * formatDate(new Date(), { locale: 'zh-CN', dateStyle: 'long' })
 * // "2025年10月23日"
 * 
 * formatDate(new Date(), { locale: 'en-US', dateStyle: 'long' })
 * // "October 23, 2025"
 * ```
 */
export function formatDate(
  date: Date | number | string,
  options: DateFormatOptions = {}
): string {
  const { locale = 'zh-CN', ...formatOptions } = options;
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const formatter = getDateFormatter(locale, formatOptions);
  return formatter.format(dateObj);
}

/**
 * 格式化日期时间
 * 
 * @param date - 日期对象、时间戳或日期字符串
 * @param options - 格式化选项
 * @returns 格式化后的日期时间字符串
 */
export function formatDateTime(
  date: Date | number | string,
  options: DateFormatOptions = {}
): string {
  const { locale = 'zh-CN', ...formatOptions } = options;
  return formatDate(date, {
    locale,
    dateStyle: 'medium',
    timeStyle: 'short',
    ...formatOptions,
  });
}

/**
 * 格式化时间
 * 
 * @param date - 日期对象、时间戳或日期字符串
 * @param options - 格式化选项
 * @returns 格式化后的时间字符串
 */
export function formatTime(
  date: Date | number | string,
  options: DateFormatOptions = {}
): string {
  const { locale = 'zh-CN', ...formatOptions } = options;
  return formatDate(date, {
    locale,
    timeStyle: 'short',
    ...formatOptions,
  });
}

/**
 * 格式化相对时间
 * 
 * @param date - 日期对象、时间戳或日期字符串
 * @param options - 格式化选项
 * @returns 相对时间字符串
 * 
 * @example
 * ```ts
 * formatRelativeTime(Date.now() - 1000 * 60 * 5) // "5分钟前"
 * formatRelativeTime(Date.now() - 1000 * 60 * 60 * 2) // "2小时前"
 * formatRelativeTime(Date.now() - 1000 * 60 * 60 * 24 * 3) // "3天前"
 * ```
 */
export function formatRelativeTime(
  date: Date | number | string,
  options: RelativeTimeOptions = {}
): string {
  const { locale = 'zh-CN', numeric = 'auto' } = options;
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  // 时间单位配置（秒数）
  const units: Array<{
    unit: Intl.RelativeTimeFormatUnit;
    seconds: number;
  }> = [
    { unit: 'year', seconds: 31536000 },
    { unit: 'month', seconds: 2592000 },
    { unit: 'week', seconds: 604800 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ];

  // 找到合适的单位
  for (const { unit, seconds } of units) {
    const value = Math.floor(diffInSeconds / seconds);
    
    if (Math.abs(value) >= 1) {
      const formatter = getRelativeTimeFormatter(locale, {
        numeric,
        style: options.short ? 'short' : 'long',
      });
      return formatter.format(-value, unit);
    }
  }

  // 刚刚
  return locale === 'zh-CN' ? '刚刚' : 'just now';
}

/**
 * 格式化日期范围
 * 
 * @param startDate - 开始日期
 * @param endDate - 结束日期
 * @param options - 格式化选项
 * @returns 格式化后的日期范围字符串
 */
export function formatDateRange(
  startDate: Date | number | string,
  endDate: Date | number | string,
  options: DateFormatOptions = {}
): string {
  const { locale = 'zh-CN', ...formatOptions } = options;
  const startObj = typeof startDate === 'string' || typeof startDate === 'number'
    ? new Date(startDate)
    : startDate;
  const endObj = typeof endDate === 'string' || typeof endDate === 'number'
    ? new Date(endDate)
    : endDate;

  const formatter = getDateFormatter(locale, formatOptions);
  
  // @ts-ignore - formatRange 在较新版本的 TypeScript 中支持
  if (formatter.formatRange) {
    // @ts-ignore
    return formatter.formatRange(startObj, endObj);
  }

  // 降级方案
  return `${formatter.format(startObj)} - ${formatter.format(endObj)}`;
}

/**
 * 判断是否是今天
 */
export function isToday(date: Date | number | string): boolean {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;
  const today = new Date();
  
  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

/**
 * 判断是否是昨天
 */
export function isYesterday(date: Date | number | string): boolean {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  return (
    dateObj.getDate() === yesterday.getDate() &&
    dateObj.getMonth() === yesterday.getMonth() &&
    dateObj.getFullYear() === yesterday.getFullYear()
  );
}

/**
 * 判断是否是本周
 */
export function isThisWeek(date: Date | number | string): boolean {
  const dateObj = typeof date === 'string' || typeof date === 'number'
    ? new Date(date)
    : date;
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  
  return dateObj >= weekStart && dateObj < weekEnd;
}

/**
 * 获取友好的时间描述
 * 
 * @param date - 日期对象、时间戳或日期字符串
 * @param locale - 语言环境
 * @returns 友好的时间描述
 * 
 * @example
 * ```ts
 * getFriendlyDate(new Date()) // "今天"
 * getFriendlyDate(Date.now() - 86400000) // "昨天"
 * getFriendlyDate(Date.now() - 86400000 * 3) // "3天前"
 * ```
 */
export function getFriendlyDate(
  date: Date | number | string,
  locale: Locale = 'zh-CN'
): string {
  if (isToday(date)) {
    return locale === 'zh-CN' ? '今天' : locale === 'ja-JP' ? '今日' : 'Today';
  }
  
  if (isYesterday(date)) {
    return locale === 'zh-CN' ? '昨天' : locale === 'ja-JP' ? '昨日' : 'Yesterday';
  }
  
  if (isThisWeek(date)) {
    return formatRelativeTime(date, { locale });
  }
  
  return formatDate(date, { locale, dateStyle: 'medium' });
}

