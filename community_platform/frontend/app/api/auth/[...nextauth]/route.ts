/**
 * NextAuth API 路由处理器
 * @module app/api/auth
 * 
 * ⚠️ DEPRECATED - 此路由当前未被使用 ⚠️
 * 
 * 项目使用自定义 JWT 认证系统：
 * - 登录：/api/auth/login
 * - 登出：/api/auth/logout
 * - 注册：/api/auth/register
 * 
 * 此 NextAuth 路由保留用于未来可能的 OAuth 集成
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/infrastructure/config/auth.config';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

