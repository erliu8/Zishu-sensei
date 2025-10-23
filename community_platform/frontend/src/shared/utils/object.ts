/**
 * 对象操作相关工具函数
 */

/**
 * 深拷贝对象
 * @param obj - 要拷贝的对象
 * @returns 深拷贝后的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as T;
  }

  if (obj instanceof Object) {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  return obj;
}

/**
 * 深度合并对象
 * @param target - 目标对象
 * @param sources - 源对象
 * @returns 合并后的对象
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  if (!sources.length) return target;

  const source = sources.shift();
  if (!source) return target;

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * 判断是否为普通对象
 * @param obj - 要判断的值
 * @returns 是否为普通对象
 */
export function isObject(obj: any): obj is Record<string, any> {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

/**
 * 获取对象指定路径的值
 * @param obj - 对象
 * @param path - 路径（支持点号和数组索引）
 * @param defaultValue - 默认值
 * @returns 路径对应的值
 * @example
 * get({ a: { b: { c: 1 } } }, 'a.b.c') // 1
 * get({ a: [{ b: 1 }] }, 'a[0].b') // 1
 */
export function get<T = any>(
  obj: any,
  path: string | string[],
  defaultValue?: T
): T {
  const keys = Array.isArray(path)
    ? path
    : path.replace(/\[(\d+)\]/g, '.$1').split('.');

  let result = obj;

  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue as T;
    }
    result = result[key];
  }

  return result === undefined ? (defaultValue as T) : result;
}

/**
 * 设置对象指定路径的值
 * @param obj - 对象
 * @param path - 路径
 * @param value - 值
 * @returns 修改后的对象
 * @example
 * set({}, 'a.b.c', 1) // { a: { b: { c: 1 } } }
 */
export function set<T extends Record<string, any>>(
  obj: T,
  path: string | string[],
  value: any
): T {
  const keys = Array.isArray(path) ? path : path.split('.');
  const lastKey = keys.pop();

  if (!lastKey) return obj;

  let current = obj;

  for (const key of keys) {
    if (!(key in current) || !isObject(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
  return obj;
}

/**
 * 删除对象中的指定键
 * @param obj - 对象
 * @param keys - 要删除的键
 * @returns 删除后的新对象
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

/**
 * 只保留对象中的指定键
 * @param obj - 对象
 * @param keys - 要保留的键
 * @returns 新对象
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

/**
 * 判断对象是否有指定路径
 * @param obj - 对象
 * @param path - 路径
 * @returns 是否有该路径
 */
export function has(obj: any, path: string | string[]): boolean {
  const keys = Array.isArray(path) ? path : path.split('.');
  let current = obj;

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(current, key)) {
      return false;
    }
    current = current[key];
  }

  return true;
}

/**
 * 反转对象的键值
 * @param obj - 对象
 * @returns 键值反转后的对象
 * @example
 * invert({ a: '1', b: '2' }) // { '1': 'a', '2': 'b' }
 */
export function invert<T extends Record<string, string | number>>(
  obj: T
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[String(obj[key])] = key;
    }
  }
  return result;
}

/**
 * 移除对象中的 null 和 undefined 值
 * @param obj - 对象
 * @returns 清理后的对象
 */
export function compact<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== null && value !== undefined) {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * 将对象转换为 FormData
 * @param obj - 对象
 * @returns FormData 对象
 */
export function toFormData(obj: Record<string, any>): FormData {
  const formData = new FormData();

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          formData.append(`${key}[${index}]`, String(item));
        });
      } else if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    }
  }

  return formData;
}

/**
 * 冻结对象（深度冻结）
 * @param obj - 对象
 * @returns 冻结后的对象
 */
export function deepFreeze<T>(obj: T): Readonly<T> {
  Object.freeze(obj);

  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const value = (obj as any)[prop];
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });

  return obj;
}

/**
 * 判断两个对象是否相等（深度比较）
 * @param obj1 - 对象1
 * @param obj2 - 对象2
 * @returns 是否相等
 */
export function isEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;

  if (
    obj1 == null ||
    obj2 == null ||
    typeof obj1 !== 'object' ||
    typeof obj2 !== 'object'
  ) {
    return obj1 === obj2;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key) || !isEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

/**
 * 获取对象的所有键路径
 * @param obj - 对象
 * @param prefix - 前缀
 * @returns 所有键路径数组
 * @example
 * getPaths({ a: { b: 1, c: 2 } }) // ['a.b', 'a.c']
 */
export function getPaths(obj: any, prefix: string = ''): string[] {
  const paths: string[] = [];

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];

      if (isObject(value)) {
        paths.push(...getPaths(value, path));
      } else {
        paths.push(path);
      }
    }
  }

  return paths;
}

