/**
 * 数字处理相关工具函数
 */

/**
 * 限制数字在指定范围内
 * @param num - 数字
 * @param min - 最小值
 * @param max - 最大值
 * @returns 限制后的数字
 * @example
 * clamp(15, 0, 10) // 10
 * clamp(-5, 0, 10) // 0
 * clamp(5, 0, 10) // 5
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * 生成指定范围的随机整数
 * @param min - 最小值（包含）
 * @param max - 最大值（包含）
 * @returns 随机整数
 * @example
 * randomInt(1, 10) // 5 (随机)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成指定范围的随机浮点数
 * @param min - 最小值
 * @param max - 最大值
 * @param decimals - 小数位数，默认为 2
 * @returns 随机浮点数
 */
export function randomFloat(min: number, max: number, decimals: number = 2): number {
  const num = Math.random() * (max - min) + min;
  return parseFloat(num.toFixed(decimals));
}

/**
 * 四舍五入到指定小数位数
 * @param num - 数字
 * @param decimals - 小数位数
 * @returns 四舍五入后的数字
 * @example
 * round(3.14159, 2) // 3.14
 */
export function round(num: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * 判断是否为偶数
 * @param num - 数字
 * @returns 是否为偶数
 */
export function isEven(num: number): boolean {
  return num % 2 === 0;
}

/**
 * 判断是否为奇数
 * @param num - 数字
 * @returns 是否为奇数
 */
export function isOdd(num: number): boolean {
  return num % 2 !== 0;
}

/**
 * 求和
 * @param numbers - 数字数组
 * @returns 总和
 * @example
 * sum([1, 2, 3, 4, 5]) // 15
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((acc, num) => acc + num, 0);
}

/**
 * 求平均值
 * @param numbers - 数字数组
 * @returns 平均值
 * @example
 * average([1, 2, 3, 4, 5]) // 3
 */
export function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

/**
 * 求最大值
 * @param numbers - 数字数组
 * @returns 最大值
 */
export function max(numbers: number[]): number {
  return Math.max(...numbers);
}

/**
 * 求最小值
 * @param numbers - 数字数组
 * @returns 最小值
 */
export function min(numbers: number[]): number {
  return Math.min(...numbers);
}

/**
 * 线性插值
 * @param start - 起始值
 * @param end - 结束值
 * @param t - 插值参数 (0-1)
 * @returns 插值结果
 * @example
 * lerp(0, 100, 0.5) // 50
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * 将数字映射到新的范围
 * @param value - 原始值
 * @param inMin - 原始范围最小值
 * @param inMax - 原始范围最大值
 * @param outMin - 目标范围最小值
 * @param outMax - 目标范围最大值
 * @returns 映射后的值
 * @example
 * mapRange(50, 0, 100, 0, 1) // 0.5
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * 判断数字是否在范围内
 * @param num - 数字
 * @param min - 最小值
 * @param max - 最大值
 * @param inclusive - 是否包含边界，默认为 true
 * @returns 是否在范围内
 */
export function inRange(
  num: number,
  min: number,
  max: number,
  inclusive: boolean = true
): boolean {
  if (inclusive) {
    return num >= min && num <= max;
  }
  return num > min && num < max;
}

/**
 * 格式化为 K/M/B 格式（1000 -> 1K）
 * @param num - 数字
 * @param decimals - 小数位数，默认为 1
 * @returns 格式化后的字符串
 * @example
 * formatCompact(1234) // '1.2K'
 * formatCompact(1234567) // '1.2M'
 */
export function formatCompact(num: number, decimals: number = 1): string {
  if (num < 1000) return String(num);

  const units = ['K', 'M', 'B', 'T'];
  const order = Math.floor(Math.log10(num) / 3);
  const unitIndex = Math.min(order - 1, units.length - 1);

  const value = num / Math.pow(1000, unitIndex + 1);
  return `${value.toFixed(decimals)}${units[unitIndex]}`;
}

/**
 * 转换为罗马数字
 * @param num - 数字 (1-3999)
 * @returns 罗马数字
 * @example
 * toRoman(9) // 'IX'
 * toRoman(2024) // 'MMXXIV'
 */
export function toRoman(num: number): string {
  if (num < 1 || num > 3999) {
    throw new Error('Number must be between 1 and 3999');
  }

  const romanNumerals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let result = '';
  let remaining = num;

  for (const [value, symbol] of romanNumerals) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }

  return result;
}

