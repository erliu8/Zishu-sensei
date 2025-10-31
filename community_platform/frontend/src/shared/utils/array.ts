/**
 * 数组操作相关工具函数
 */

/**
 * 数组去重
 * @param arr - 数组
 * @returns 去重后的数组
 * @example
 * unique([1, 2, 2, 3, 3, 3]) // [1, 2, 3]
 */
export function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * 根据对象属性去重
 * @param arr - 对象数组
 * @param key - 属性名
 * @returns 去重后的数组
 * @example
 * uniqueBy([{ id: 1 }, { id: 2 }, { id: 1 }], 'id') // [{ id: 1 }, { id: 2 }]
 */
export function uniqueBy<T>(arr: T[], key: keyof T): T[] {
  const seen = new Set();
  return arr.filter((item) => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

/**
 * 数组分组
 * @param arr - 数组
 * @param key - 分组依据的属性名或函数
 * @returns 分组后的对象
 * @example
 * groupBy([{ type: 'a', value: 1 }, { type: 'b', value: 2 }], 'type')
 * // { a: [{ type: 'a', value: 1 }], b: [{ type: 'b', value: 2 }] }
 */
export function groupBy<T>(
  arr: T[],
  key: keyof T | ((item: T) => string | number)
): Record<string, T[]> {
  return arr.reduce((result, item) => {
    const groupKey = typeof key === 'function' ? String(key(item)) : String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * 数组分块
 * @param arr - 数组
 * @param size - 每块大小
 * @returns 分块后的二维数组
 * @example
 * chunk([1, 2, 3, 4, 5], 2) // [[1, 2], [3, 4], [5]]
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * 打乱数组
 * @param arr - 数组
 * @returns 打乱后的新数组
 * @example
 * shuffle([1, 2, 3, 4, 5]) // [3, 1, 5, 2, 4] (随机)
 */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * 随机获取数组中的一个元素
 * @param arr - 数组
 * @returns 随机元素
 */
export function sample<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 随机获取数组中的多个元素
 * @param arr - 数组
 * @param count - 数量
 * @returns 随机元素数组
 */
export function sampleSize<T>(arr: T[], count: number): T[] {
  const shuffled = shuffle(arr);
  return shuffled.slice(0, Math.min(count, arr.length));
}

/**
 * 数组求交集
 * @param arrays - 多个数组
 * @returns 交集数组
 * @example
 * intersection([1, 2, 3], [2, 3, 4], [3, 4, 5]) // [3]
 */
export function intersection<T>(...arrays: T[][]): T[] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0] || [];

  return arrays.reduce((acc, arr) => {
    return acc.filter((item) => arr.includes(item));
  });
}

/**
 * 数组求并集
 * @param arrays - 多个数组
 * @returns 并集数组
 * @example
 * union([1, 2], [2, 3], [3, 4]) // [1, 2, 3, 4]
 */
export function union<T>(...arrays: T[][]): T[] {
  return unique(arrays.flat());
}

/**
 * 数组求差集（第一个数组中有但其他数组中没有的元素）
 * @param arr - 主数组
 * @param others - 其他数组
 * @returns 差集数组
 * @example
 * difference([1, 2, 3], [2, 3, 4]) // [1]
 */
export function difference<T>(arr: T[], ...others: T[][]): T[] {
  const otherItems = new Set(others.flat());
  return arr.filter((item) => !otherItems.has(item));
}

/**
 * 移除数组中的假值（false, null, 0, "", undefined, NaN）
 * @param arr - 数组
 * @returns 移除假值后的数组
 * @example
 * compact([0, 1, false, 2, '', 3, null, undefined]) // [1, 2, 3]
 */
export function compact<T>(arr: T[]): NonNullable<T>[] {
  return arr.filter(Boolean) as NonNullable<T>[];
}

/**
 * 扁平化数组
 * @param arr - 数组
 * @param depth - 扁平化深度，默认为 1
 * @returns 扁平化后的数组
 * @example
 * flatten([1, [2, [3, [4]]]]) // [1, 2, [3, [4]]]
 * flatten([1, [2, [3, [4]]]], Infinity) // [1, 2, 3, 4]
 */
export function flatten<T>(arr: any[], depth: number = 1): T[] {
  if (depth === 0) return arr;
  return arr.reduce((acc, val) => {
    return Array.isArray(val)
      ? acc.concat(flatten(val, depth - 1))
      : acc.concat(val);
  }, []);
}

/**
 * 根据条件将数组分成两组
 * @param arr - 数组
 * @param predicate - 判断函数
 * @returns [满足条件的数组, 不满足条件的数组]
 * @example
 * partition([1, 2, 3, 4, 5], x => x % 2 === 0) // [[2, 4], [1, 3, 5]]
 */
export function partition<T>(
  arr: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];

  arr.forEach((item) => {
    if (predicate(item)) {
      pass.push(item);
    } else {
      fail.push(item);
    }
  });

  return [pass, fail];
}

/**
 * 对数组进行排序（不修改原数组）
 * @param arr - 数组
 * @param compareFn - 比较函数
 * @returns 排序后的新数组
 */
export function sortBy<T>(
  arr: T[],
  compareFn?: (a: T, b: T) => number
): T[] {
  return [...arr].sort(compareFn);
}

/**
 * 根据属性对对象数组排序
 * @param arr - 对象数组
 * @param key - 属性名
 * @param order - 排序顺序，'asc' 或 'desc'
 * @returns 排序后的新数组
 */
export function sortByKey<T>(
  arr: T[],
  key: keyof T,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return sortBy(arr, (a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * 移动数组元素
 * @param arr - 数组
 * @param from - 源索引
 * @param to - 目标索引
 * @returns 移动后的新数组
 */
export function move<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [item] = result.splice(from, 1);
  if (item !== undefined) {
    result.splice(to, 0, item);
  }
  return result;
}

/**
 * 统计数组中各元素出现的次数
 * @param arr - 数组
 * @returns 统计对象
 * @example
 * countBy([1, 2, 2, 3, 3, 3]) // { '1': 1, '2': 2, '3': 3 }
 */
export function countBy<T>(arr: T[]): Record<string, number> {
  return arr.reduce((acc, item) => {
    const key = String(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * 创建指定范围的数字数组
 * @param start - 起始值
 * @param end - 结束值（不包含）
 * @param step - 步长，默认为 1
 * @returns 数字数组
 * @example
 * range(1, 5) // [1, 2, 3, 4]
 * range(0, 10, 2) // [0, 2, 4, 6, 8]
 */
export function range(start: number, end: number, step: number = 1): number[] {
  const result: number[] = [];
  for (let i = start; i < end; i += step) {
    result.push(i);
  }
  return result;
}

