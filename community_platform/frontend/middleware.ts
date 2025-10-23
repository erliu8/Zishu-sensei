/**
 * Next.js 中间件
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */

import { combinedMiddleware } from './src/middleware';

// 导出组合中间件（i18n + auth）
export default combinedMiddleware;

// 导出配置
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - 其他静态资源
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*|public).*)',
  ],
};

