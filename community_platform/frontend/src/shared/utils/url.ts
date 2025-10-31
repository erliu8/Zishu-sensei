/**
 * URL 处理相关工具函数
 */

/**
 * 解析 URL 查询参数
 * @param url - URL 字符串，默认为当前页面 URL
 * @returns 查询参数对象
 * @example
 * parseQueryString('?name=John&age=30') // { name: 'John', age: '30' }
 */
export function parseQueryString(url?: string): Record<string, string> {
  const queryString = url || (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(queryString);
  const result: Record<string, string> = {};

  params.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

/**
 * 将对象转换为查询参数字符串
 * @param params - 参数对象
 * @returns 查询参数字符串
 * @example
 * stringifyQueryString({ name: 'John', age: '30' }) // 'name=John&age=30'
 */
export function stringifyQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((item) => searchParams.append(key, String(item)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  return searchParams.toString();
}

/**
 * 为 URL 添加查询参数
 * @param url - 原始 URL
 * @param params - 要添加的参数对象
 * @returns 带参数的 URL
 * @example
 * addQueryParams('/api/users', { page: 1, limit: 10 }) // '/api/users?page=1&limit=10'
 */
export function addQueryParams(url: string, params: Record<string, any>): string {
  const queryString = stringifyQueryString(params);
  if (!queryString) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${queryString}`;
}

/**
 * 从 URL 中移除指定的查询参数
 * @param url - 原始 URL
 * @param keys - 要移除的参数名数组
 * @returns 移除参数后的 URL
 */
export function removeQueryParams(url: string, keys: string[]): string {
  const urlObj = new URL(url, 'http://dummy.com');
  keys.forEach((key) => urlObj.searchParams.delete(key));

  const newSearch = urlObj.search;
  const baseUrl = url.split('?')[0] || '';

  return newSearch ? `${baseUrl}${newSearch}` : baseUrl;
}

/**
 * 获取 URL 中的指定查询参数
 * @param key - 参数名
 * @param url - URL 字符串，默认为当前页面 URL
 * @returns 参数值
 */
export function getQueryParam(key: string, url?: string): string | null {
  const queryString = url || (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(queryString);
  return params.get(key);
}

/**
 * 判断是否为绝对 URL
 * @param url - URL 字符串
 * @returns 是否为绝对 URL
 * @example
 * isAbsoluteUrl('https://example.com') // true
 * isAbsoluteUrl('/path/to/page') // false
 */
export function isAbsoluteUrl(url: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/.test(url);
}

/**
 * 拼接 URL 路径
 * @param parts - 路径片段
 * @returns 拼接后的路径
 * @example
 * joinPaths('/api', 'users', '123') // '/api/users/123'
 */
export function joinPaths(...parts: string[]): string {
  return parts
    .map((part, index) => {
      if (index === 0) {
        return part.replace(/\/+$/, '');
      }
      return part.replace(/^\/+|\/+$/g, '');
    })
    .filter((part) => part.length > 0)
    .join('/');
}

/**
 * 规范化 URL（移除重复的斜杠等）
 * @param url - URL 字符串
 * @returns 规范化后的 URL
 */
export function normalizeUrl(url: string): string {
  return url.replace(/([^:]\/)\/+/g, '$1');
}

/**
 * 获取 URL 的基础路径（不含查询参数和哈希）
 * @param url - URL 字符串
 * @returns 基础路径
 * @example
 * getBasePath('https://example.com/path?query=1#hash') // 'https://example.com/path'
 */
export function getBasePath(url: string): string {
  return url.split(/[?#]/)[0] || '';
}

/**
 * 判断两个 URL 是否为同源
 * @param url1 - URL 1
 * @param url2 - URL 2
 * @returns 是否同源
 */
export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const u1 = new URL(url1);
    const u2 = new URL(url2);
    return u1.origin === u2.origin;
  } catch {
    return false;
  }
}

/**
 * 从 URL 中提取文件名
 * @param url - URL 字符串
 * @returns 文件名
 * @example
 * getFilenameFromUrl('https://example.com/images/photo.jpg') // 'photo.jpg'
 */
export function getFilenameFromUrl(url: string): string {
  const pathname = getBasePath(url);
  const parts = pathname.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * 构建完整的 URL
 * @param base - 基础 URL
 * @param path - 路径
 * @param params - 查询参数
 * @returns 完整的 URL
 * @example
 * buildUrl('https://api.example.com', '/users', { page: 1 })
 * // 'https://api.example.com/users?page=1'
 */
export function buildUrl(
  base: string,
  path: string = '',
  params?: Record<string, any>
): string {
  let url = base.endsWith('/') ? base.slice(0, -1) : base;
  if (path) {
    url += path.startsWith('/') ? path : `/${path}`;
  }
  if (params) {
    url = addQueryParams(url, params);
  }
  return url;
}

