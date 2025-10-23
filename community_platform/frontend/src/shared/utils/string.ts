/**
 * 字符串处理相关工具函数
 */

/**
 * 首字母大写
 * @param str - 字符串
 * @returns 首字母大写的字符串
 * @example
 * capitalize('hello') // 'Hello'
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * 驼峰命名转换为短横线命名
 * @param str - 驼峰命名字符串
 * @returns 短横线命名字符串
 * @example
 * camelToKebab('helloWorld') // 'hello-world'
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * 短横线命名转换为驼峰命名
 * @param str - 短横线命名字符串
 * @returns 驼峰命名字符串
 * @example
 * kebabToCamel('hello-world') // 'helloWorld'
 */
export function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 下划线命名转换为驼峰命名
 * @param str - 下划线命名字符串
 * @returns 驼峰命名字符串
 * @example
 * snakeToCamel('hello_world') // 'helloWorld'
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 驼峰命名转换为下划线命名
 * @param str - 驼峰命名字符串
 * @returns 下划线命名字符串
 * @example
 * camelToSnake('helloWorld') // 'hello_world'
 */
export function camelToSnake(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * 生成随机字符串
 * @param length - 字符串长度
 * @param chars - 可选的字符集
 * @returns 随机字符串
 * @example
 * randomString(10) // 'a3Bc4Def5G'
 */
export function randomString(
  length: number,
  chars: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 移除字符串中的 HTML 标签
 * @param html - HTML 字符串
 * @returns 纯文本
 * @example
 * stripHtml('<p>Hello <b>World</b></p>') // 'Hello World'
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * 转义 HTML 特殊字符
 * @param str - 字符串
 * @returns 转义后的字符串
 * @example
 * escapeHtml('<script>alert("XSS")</script>') // '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * 反转义 HTML 特殊字符
 * @param str - 转义后的字符串
 * @returns 原始字符串
 */
export function unescapeHtml(str: string): string {
  const htmlUnescapes: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
  };
  return str.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => htmlUnescapes[entity]);
}

/**
 * 计算字符串的字节长度（中文算2个字节）
 * @param str - 字符串
 * @returns 字节长度
 */
export function getByteLength(str: string): number {
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0 && code <= 128) {
      length += 1;
    } else {
      length += 2;
    }
  }
  return length;
}

/**
 * 高亮搜索关键词
 * @param text - 原始文本
 * @param keyword - 关键词
 * @param highlightClass - 高亮样式类名
 * @returns 高亮后的 HTML
 * @example
 * highlightKeyword('Hello World', 'World') // 'Hello <mark>World</mark>'
 */
export function highlightKeyword(
  text: string,
  keyword: string,
  highlightClass: string = 'mark'
): string {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword})`, 'gi');
  return text.replace(regex, `<${highlightClass}>$1</${highlightClass}>`);
}

/**
 * 提取 URL 中的域名
 * @param url - URL 字符串
 * @returns 域名
 * @example
 * extractDomain('https://www.example.com/path') // 'www.example.com'
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * 生成 slug（URL 友好的字符串）
 * @param str - 原始字符串
 * @returns slug
 * @example
 * slugify('Hello World!') // 'hello-world'
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 统计字符串中某个子串出现的次数
 * @param str - 原始字符串
 * @param substr - 子串
 * @returns 出现次数
 */
export function countOccurrences(str: string, substr: string): number {
  if (!substr) return 0;
  return (str.match(new RegExp(substr, 'g')) || []).length;
}

