/**
 * 验证相关工具函数
 */

/**
 * 验证邮箱格式
 * @param email - 邮箱地址
 * @returns 是否有效
 * @example
 * isEmail('user@example.com') // true
 * isEmail('invalid-email') // false
 */
export function isEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证 URL 格式
 * @param url - URL 字符串
 * @returns 是否有效
 * @example
 * isUrl('https://example.com') // true
 * isUrl('not-a-url') // false
 */
export function isUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证手机号（中国大陆）
 * @param phone - 手机号
 * @returns 是否有效
 * @example
 * isPhone('13812345678') // true
 * isPhone('12345678901') // false
 */
export function isPhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * 验证身份证号（中国大陆）
 * @param idCard - 身份证号
 * @returns 是否有效
 */
export function isIdCard(idCard: string): boolean {
  const idCardRegex = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
  return idCardRegex.test(idCard);
}

/**
 * 验证密码强度
 * @param password - 密码
 * @param minLength - 最小长度，默认为 8
 * @returns 强度等级: 'weak' | 'medium' | 'strong'
 * @example
 * getPasswordStrength('12345678') // 'weak'
 * getPasswordStrength('Abc123456') // 'medium'
 * getPasswordStrength('Abc@123456') // 'strong'
 */
export function getPasswordStrength(
  password: string,
  minLength: number = 8
): 'weak' | 'medium' | 'strong' {
  if (password.length < minLength) return 'weak';

  let strength = 0;

  // 包含小写字母
  if (/[a-z]/.test(password)) strength++;
  // 包含大写字母
  if (/[A-Z]/.test(password)) strength++;
  // 包含数字
  if (/\d/.test(password)) strength++;
  // 包含特殊字符
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

  if (strength <= 2) return 'weak';
  if (strength === 3) return 'medium';
  return 'strong';
}

/**
 * 验证是否为空
 * @param value - 要验证的值
 * @returns 是否为空
 * @example
 * isEmpty('') // true
 * isEmpty('  ') // true
 * isEmpty(null) // true
 * isEmpty('hello') // false
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * 验证用户名格式（3-20位，字母数字下划线）
 * @param username - 用户名
 * @returns 是否有效
 */
export function isUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * 验证是否为正整数
 * @param value - 要验证的值
 * @returns 是否为正整数
 */
export function isPositiveInteger(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0;
  }
  if (typeof value === 'string') {
    const num = Number(value);
    return Number.isInteger(num) && num > 0;
  }
  return false;
}

/**
 * 验证 IPv4 地址
 * @param ip - IP 地址
 * @returns 是否有效
 */
export function isIPv4(ip: string): boolean {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

/**
 * 验证十六进制颜色值
 * @param color - 颜色值
 * @returns 是否有效
 * @example
 * isHexColor('#fff') // true
 * isHexColor('#ffffff') // true
 * isHexColor('fff') // false
 */
export function isHexColor(color: string): boolean {
  const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexColorRegex.test(color);
}

