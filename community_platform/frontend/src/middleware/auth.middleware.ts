/**
 * 认证中间件
 * @module middleware/auth
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * 受保护的路径配置
 */
const PROTECTED_PATHS = [
  '/profile',
  '/posts/create',
  '/posts/:path*/edit',
  '/characters/create',
  '/characters/:path*/edit',
  '/adapters/upload',
  '/packaging',
  '/notifications',
  '/settings',
];

/**
 * 认证路径（已登录用户不应访问）
 */
const AUTH_PATHS = ['/login', '/register', '/forgot-password'];

/**
 * 管理员专用路径
 */
const ADMIN_PATHS = ['/admin'];

/**
 * 版主及以上权限路径
 */
const MODERATOR_PATHS = ['/moderate'];


/**
 * 检查路径是否匹配模式
 */
function matchPath(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // 转换路径模式为正则表达式
    const regexPattern = pattern
      .replace(/:[^/]+/g, '[^/]+') // :path -> [^/]+
      .replace(/\*/g, '.*'); // * -> .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  });
}

/**
 * 从请求中获取认证状态
 * 中间件在服务器端运行，从 cookies 获取 token
 */
function getAuthFromRequest(request: NextRequest) {
  try {
    // 从 cookie 获取 access_token
    const accessTokenCookie = request.cookies.get('access_token');
    const userDataCookie = request.cookies.get('user_data');
    
    if (accessTokenCookie && accessTokenCookie.value) {
      // 如果有用户数据，解析并返回
      if (userDataCookie && userDataCookie.value) {
        try {
          const userData = JSON.parse(userDataCookie.value);
          return {
            isAuthenticated: true,
            token: accessTokenCookie.value,
            user: userData,
            role: userData.role || 'user',
          };
        } catch (e) {
          // 用户数据解析失败，仍然返回已认证状态
          return {
            isAuthenticated: true,
            token: accessTokenCookie.value,
            role: 'user',
          };
        }
      }
      
      // 只有 token，没有用户数据
      return {
        isAuthenticated: true,
        token: accessTokenCookie.value,
        role: 'user',
      };
    }

    return { isAuthenticated: false };
  } catch (error) {
    console.error('[Auth Middleware] Error getting auth:', error);
    return { isAuthenticated: false };
  }
}

/**
 * 认证中间件函数
 */
export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API 路由不进行认证检查
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 静态资源不进行认证检查
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // 文件扩展名
  ) {
    return NextResponse.next();
  }

  // 获取认证状态
  const auth = getAuthFromRequest(request);
  const isAuthenticated = auth.isAuthenticated;
  const userRole = auth.role || 'guest';
  
  // 调试日志
  if (process.env.NODE_ENV === 'development') {
    console.log('[Auth Middleware]', {
      pathname,
      isAuthenticated,
      userRole,
      hasToken: !!auth.token,
      cookies: {
        hasAuthStorage: !!request.cookies.get('auth-storage'),
        hasAccessToken: !!request.cookies.get('access_token'),
      },
    });
  }

  // 如果用户已登录且访问认证页面，重定向到首页
  if (isAuthenticated && matchPath(pathname, AUTH_PATHS)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 检查是否是受保护的路径
  if (matchPath(pathname, PROTECTED_PATHS)) {
    if (!isAuthenticated) {
      // 未登录，重定向到登录页，并保存原始 URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 检查管理员路径
  if (matchPath(pathname, ADMIN_PATHS)) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (userRole !== 'admin') {
      // 没有管理员权限，重定向到 403 页面
      return NextResponse.redirect(new URL('/403', request.url));
    }
  }

  // 检查版主路径
  if (matchPath(pathname, MODERATOR_PATHS)) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (userRole !== 'admin' && userRole !== 'moderator') {
      // 没有版主权限，重定向到 403 页面
      return NextResponse.redirect(new URL('/403', request.url));
    }
  }

  // 允许访问
  return NextResponse.next();
}

/**
 * 中间件配置
 */
export const authMiddlewareConfig = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
