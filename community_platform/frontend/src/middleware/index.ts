/**
 * 中间件导出和组合
 */

import { NextRequest, NextResponse } from 'next/server';
import { i18nMiddleware } from './i18n.middleware';
import { authMiddleware } from './auth.middleware';
import type { Locale } from '@/infrastructure/i18n/types';
import { isValidLocale } from '@/infrastructure/i18n/config';

/**
 * 从路径中提取语言前缀
 */
function extractLocaleFromPath(pathname: string): {
  locale: Locale | null;
  pathnameWithoutLocale: string;
} {
  const segments = pathname.split('/');
  const potentialLocale = segments[1];
  
  if (potentialLocale && isValidLocale(potentialLocale)) {
    const pathnameWithoutLocale = '/' + segments.slice(2).join('/') || '/';
    return {
      locale: potentialLocale as Locale,
      pathnameWithoutLocale,
    };
  }
  
  return {
    locale: null,
    pathnameWithoutLocale: pathname,
  };
}

/**
 * 组合中间件
 * 先执行 i18n 中间件，再执行认证中间件
 */
export async function combinedMiddleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  
  // 跳过特殊路径
  const shouldSkip =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml';
  
  if (shouldSkip) {
    return NextResponse.next();
  }
  
  // 1. 先执行 i18n 中间件
  const i18nResponse = i18nMiddleware(request);
  
  // 如果 i18n 中间件返回重定向，直接返回
  if (i18nResponse.status === 307 || i18nResponse.status === 308) {
    return i18nResponse;
  }
  
  // 2. 提取语言前缀，为认证中间件准备正确的路径
  const { locale, pathnameWithoutLocale } = extractLocaleFromPath(pathname);
  
  // 创建一个新的请求对象，路径不包含语言前缀（用于认证检查）
  const modifiedRequest = new NextRequest(request.url, request);
  if (locale) {
    const newUrl = new URL(request.url);
    newUrl.pathname = pathnameWithoutLocale;
    // 更新 nextUrl 以便认证中间件使用
    Object.defineProperty(modifiedRequest, 'nextUrl', {
      value: new URL(newUrl),
      writable: true,
    });
  }
  
  // 3. 执行认证中间件
  const authResponse = await authMiddleware(modifiedRequest);
  
  // 如果认证中间件返回重定向，需要添加语言前缀
  if (authResponse.status === 307 || authResponse.status === 308) {
    const redirectUrl = new URL(authResponse.headers.get('location') || '', request.url);
    
    // 如果重定向 URL 不包含语言前缀，添加当前语言
    if (locale && !extractLocaleFromPath(redirectUrl.pathname).locale) {
      redirectUrl.pathname = `/${locale}${redirectUrl.pathname}`;
    }
    
    return NextResponse.redirect(redirectUrl);
  }
  
  // 4. 合并响应（保留 i18n 的 Cookie 设置）
  const finalResponse = authResponse;
  
  // 复制 i18n 响应的 Cookie
  i18nResponse.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  
  return finalResponse;
}

/**
 * 导出单独的中间件
 */
export { i18nMiddleware } from './i18n.middleware';
export { authMiddleware } from './auth.middleware';

