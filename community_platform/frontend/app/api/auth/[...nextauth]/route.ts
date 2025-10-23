/**
 * NextAuth API 路由处理器
 * @module app/api/auth
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/infrastructure/config/auth.config';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

