/**
 * 日期时间相关工具函数
 */

/**
 * 格式化日期
 * @param date - 日期对象、时间戳或日期字符串
 * @param format - 格式字符串，默认为 'YYYY-MM-DD HH:mm:ss'
 * @returns 格式化后的日期字符串
 * @example
 * formatDate(new Date(), 'YYYY-MM-DD') // '2024-01-01'
 * formatDate(Date.now(), 'YYYY年MM月DD日') // '2024年01月01日'
 */
export function formatDate(
  date: Date | string | number,
  format: string = 'YYYY-MM-DD HH:mm:ss'
): string {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 获取两个日期之间的天数差
 * @param date1 - 日期1
 * @param date2 - 日期2
 * @returns 天数差（绝对值）
 */
export function getDaysBetween(
  date1: Date | string | number,
  date2: Date | string | number
): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 判断是否为今天
 * @param date - 日期
 * @returns 是否为今天
 */
export function isToday(date: Date | string | number): boolean {
  const d = new Date(date);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * 判断是否为昨天
 * @param date - 日期
 * @returns 是否为昨天
 */
export function isYesterday(date: Date | string | number): boolean {
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  );
}

/**
 * 判断是否为本周
 * @param date - 日期
 * @returns 是否为本周
 */
export function isThisWeek(date: Date | string | number): boolean {
  const d = new Date(date);
  const today = new Date();
  const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
  const lastDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));

  return d >= firstDayOfWeek && d <= lastDayOfWeek;
}

/**
 * 判断是否为本月
 * @param date - 日期
 * @returns 是否为本月
 */
export function isThisMonth(date: Date | string | number): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

/**
 * 判断是否为本年
 * @param date - 日期
 * @returns 是否为本年
 */
export function isThisYear(date: Date | string | number): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.getFullYear() === today.getFullYear();
}

/**
 * 获取日期的开始时间（00:00:00）
 * @param date - 日期
 * @returns 该日期的开始时间
 */
export function startOfDay(date: Date | string | number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 获取日期的结束时间（23:59:59）
 * @param date - 日期
 * @returns 该日期的结束时间
 */
export function endOfDay(date: Date | string | number): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * 添加天数
 * @param date - 日期
 * @param days - 要添加的天数（可以为负数）
 * @returns 新的日期
 */
export function addDays(date: Date | string | number, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * 添加月份
 * @param date - 日期
 * @param months - 要添加的月份（可以为负数）
 * @returns 新的日期
 */
export function addMonths(date: Date | string | number, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * 添加年份
 * @param date - 日期
 * @param years - 要添加的年份（可以为负数）
 * @returns 新的日期
 */
export function addYears(date: Date | string | number, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/**
 * 判断是否为闰年
 * @param year - 年份
 * @returns 是否为闰年
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * 获取某月的天数
 * @param year - 年份
 * @param month - 月份（1-12）
 * @returns 天数
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

