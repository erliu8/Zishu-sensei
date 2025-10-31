/**
 * NextAuth 类型扩展
 * 扩展默认的 session 和 user 类型以包含自定义属性
 */

import { DefaultSession } from 'next-auth';
import { UserRole } from '@/features/auth/types';

declare module 'next-auth' {
  /**
   * 扩展 Session 接口
   */
  interface Session {
    user: {
      id: string;
      email: string;
      username?: string;
      name?: string | null;
      image?: string | null;
      role?: UserRole;
    } & DefaultSession['user'];
    accessToken?: string;
    refreshToken?: string;
  }

  /**
   * 扩展 User 接口
   */
  interface User {
    id: string;
    email: string;
    username?: string;
    name?: string | null;
    image?: string | null;
    role?: UserRole;
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module 'next-auth/jwt' {
  /**
   * 扩展 JWT 接口
   */
  interface JWT {
    id: string;
    email: string;
    username?: string;
    role?: UserRole;
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    providerAccountId?: string;
  }
}
