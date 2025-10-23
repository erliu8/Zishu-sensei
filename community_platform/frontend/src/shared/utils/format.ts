/**
 * 格式化相关工具函数
 */

/**
 * 格式化数字，添加千分位分隔符
 * @param num - 要格式化的数字
 * @param decimals - 小数位数，默认为 0
 * @returns 格式化后的字符串
 * @example
 * formatNumber(1234567.89) // '1,234,568'
 * formatNumber(1234567.89, 2) // '1,234,567.89'
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的字符串
 * @example
 * formatFileSize(1024) // '1.00 KB'
 * formatFileSize(1234567) // '1.18 MB'
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * 格式化百分比
 * @param value - 数值 (0-1 或 0-100)
 * @param total - 总数，如果提供则 value 为分子
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的百分比字符串
 * @example
 * formatPercent(0.1234) // '12.34%'
 * formatPercent(50, 200) // '25.00%'
 */
export function formatPercent(
  value: number,
  total?: number,
  decimals: number = 2
): string {
  const percent = total ? (value / total) * 100 : value > 1 ? value : value * 100;
  return `${percent.toFixed(decimals)}%`;
}

/**
 * 格式化货币
 * @param amount - 金额
 * @param currency - 货币符号，默认为 '¥'
 * @param decimals - 小数位数，默认为 2
 * @returns 格式化后的货币字符串
 * @example
 * formatCurrency(1234.56) // '¥1,234.56'
 * formatCurrency(1234.56, '$') // '$1,234.56'
 */
export function formatCurrency(
  amount: number,
  currency: string = '¥',
  decimals: number = 2
): string {
  return `${currency}${formatNumber(amount, decimals)}`;
}

/**
 * 格式化时长（秒转时分秒）
 * @param seconds - 秒数
 * @returns 格式化后的时长字符串
 * @example
 * formatDuration(65) // '01:05'
 * formatDuration(3665) // '01:01:05'
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * 截断文本并添加省略号
 * @param text - 原始文本
 * @param maxLength - 最大长度
 * @param suffix - 后缀，默认为 '...'
 * @returns 截断后的文本
 * @example
 * truncate('Hello World', 5) // 'Hello...'
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 格式化日期
 * @param date - 日期
 * @param format - 格式类型，默认为 'full'
 * @param locale - 语言，默认为 'zh-CN'
 * @returns 格式化后的日期字符串
 * @example
 * formatDate('2024-01-01', 'full') // '2024年1月1日'
 * formatDate('2024-01-01', 'short') // '2024/01/01'
 */
export function formatDate(
  date: Date | string | number,
  format: 'full' | 'short' | 'medium' | 'long' = 'medium',
  locale: string = 'zh-CN'
): string {
  const d = new Date(date);
  
  const options: Intl.DateTimeFormatOptions = {
    full: { year: 'numeric', month: 'long', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    medium: { year: 'numeric', month: '2-digit', day: '2-digit' },
    short: { year: '2-digit', month: '2-digit', day: '2-digit' },
  }[format];

  return d.toLocaleDateString(locale, options);
}

/**
 * 格式化日期时间
 * @param date - 日期
 * @param locale - 语言，默认为 'zh-CN'
 * @returns 格式化后的日期时间字符串
 * @example
 * formatDateTime('2024-01-01T12:00:00') // '2024年1月1日 12:00:00'
 */
export function formatDateTime(
  date: Date | string | number,
  locale: string = 'zh-CN'
): string {
  const d = new Date(date);
  return d.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 格式化相对时间（多久之前）
 * @param date - 日期
 * @param locale - 语言，默认为 'zh-CN'
 * @returns 相对时间字符串
 * @example
 * formatRelativeTime(new Date(Date.now() - 60000)) // '1分钟前'
 */
export function formatRelativeTime(date: Date | string | number, locale: string = 'zh-CN'): string {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const intervals = [
    { seconds: 31536000, unit: 'year' as Intl.RelativeTimeFormatUnit },
    { seconds: 2592000, unit: 'month' as Intl.RelativeTimeFormatUnit },
    { seconds: 86400, unit: 'day' as Intl.RelativeTimeFormatUnit },
    { seconds: 3600, unit: 'hour' as Intl.RelativeTimeFormatUnit },
    { seconds: 60, unit: 'minute' as Intl.RelativeTimeFormatUnit },
    { seconds: 1, unit: 'second' as Intl.RelativeTimeFormatUnit },
  ];

  for (const interval of intervals) {
    const count = Math.floor(diffInSeconds / interval.seconds);
    if (count >= 1) {
      return rtf.format(-count, interval.unit);
    }
  }

  return rtf.format(0, 'second');
}

