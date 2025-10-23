/**
 * 国际化中间件
 * 处理语言路由和重定向
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isValidLocale,
  getBrowserLocale,
} from '@/infrastructure/i18n/config';
import type { Locale } from '@/infrastructure/i18n/types';

/**
 * 从请求路径中获取语言
 */
function getLocaleFromPathname(pathname: string): Locale | null {
  const segments = pathname.split('/');
  const potentialLocale = segments[1];
  
  if (potentialLocale && isValidLocale(potentialLocale)) {
    return potentialLocale as Locale;
  }
  
  return null;
}

/**
 * 从 Cookie 中获取语言
 */
function getLocaleFromCookie(request: NextRequest): Locale | null {
  const localeCookie = request.cookies.get('zishu-locale');
  
  if (localeCookie && isValidLocale(localeCookie.value)) {
    return localeCookie.value as Locale;
  }
  
  return null;
}

/**
 * 从 Accept-Language 头获取语言
 */
function getLocaleFromHeaders(request: NextRequest): Locale | null {
  const acceptLanguage = request.headers.get('accept-language');
  
  if (!acceptLanguage) {
    return null;
  }
  
  // 解析 Accept-Language 头
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const [locale, q = '1'] = lang.trim().split(';q=');
      return {
        locale: locale.trim(),
        quality: parseFloat(q),
      };
    })
    .sort((a, b) => b.quality - a.quality);
  
  // 查找匹配的语言
  for (const { locale } of languages) {
    // 精确匹配
    if (isValidLocale(locale)) {
      return locale as Locale;
    }
    
    // 前缀匹配 (如 'en' 匹配 'en-US')
    const prefix = locale.split('-')[0];
    const match = SUPPORTED_LOCALES.find((l) => l.startsWith(prefix));
    if (match) {
      return match;
    }
  }
  
  return null;
}

/**
 * 检测用户的首选语言
 */
function detectLocale(request: NextRequest): Locale {
  // 1. 从 Cookie 中获取
  const cookieLocale = getLocaleFromCookie(request);
  if (cookieLocale) {
    return cookieLocale;
  }
  
  // 2. 从 Accept-Language 头获取
  const headerLocale = getLocaleFromHeaders(request);
  if (headerLocale) {
    return headerLocale;
  }
  
  // 3. 返回默认语言
  return DEFAULT_LOCALE;
}

/**
 * 国际化中间件
 * 
 * 功能:
 * - 检测用户语言偏好
 * - 重定向到带语言前缀的路径
 * - 处理语言切换
 */
export function i18nMiddleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  
  // 跳过以下路径
  const shouldSkip =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') || // 静态文件
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml';
  
  if (shouldSkip) {
    return NextResponse.next();
  }
  
  // 检查路径是否已包含语言前缀
  const localeInPath = getLocaleFromPathname(pathname);
  
  if (localeInPath) {
    // 路径已包含有效的语言前缀，继续处理
    const response = NextResponse.next();
    
    // 更新 Cookie 以保存当前语言
    response.cookies.set('zishu-locale', localeInPath, {
      maxAge: 365 * 24 * 60 * 60, // 1 年
      path: '/',
      sameSite: 'lax',
    });
    
    return response;
  }
  
  // 检测用户首选语言
  const detectedLocale = detectLocale(request);
  
  // 重定向到带语言前缀的路径
  const newUrl = request.nextUrl.clone();
  newUrl.pathname = `/${detectedLocale}${pathname}`;
  
  const response = NextResponse.redirect(newUrl);
  
  // 设置语言 Cookie
  response.cookies.set('zishu-locale', detectedLocale, {
    maxAge: 365 * 24 * 60 * 60, // 1 年
    path: '/',
    sameSite: 'lax',
  });
  
  return response;
}

/**
 * 中间件配置
 */
export const i18nMiddlewareConfig = {
  matcher: [
    /*
     * 匹配所有路径，除了:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

