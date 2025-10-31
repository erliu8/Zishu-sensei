/**
 * NextAuth 配置
 * @module infrastructure/config/auth
 * 
 * ⚠️ DEPRECATED - 此配置当前未被使用 ⚠️
 * 
 * 项目目前使用自定义 JWT 认证系统：
 * - 后端：FastAPI JWT 认证
 * - 前端：localStorage + httpOnly Cookie
 * - 工具：/app/api/lib/auth.utils.ts
 * 
 * NextAuth 配置保留用于未来可能的 OAuth 集成（GitHub/Google）
 * 如需使用 NextAuth，需要：
 * 1. 配置环境变量（GITHUB_CLIENT_ID, GOOGLE_CLIENT_ID 等）
 * 2. 更新所有 API 路由使用 getServerSession
 * 3. 更新前端使用 next-auth/react
 */

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import { AuthApiClient } from '@/features/auth/api';

/**
 * NextAuth 配置选项
 * @deprecated 当前未使用，项目使用自定义 JWT 认证
 */
export const authOptions: NextAuthOptions = {
  // 配置认证提供者
  providers: [
    // 凭证登录
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const session = await AuthApiClient.login({
            email: credentials.email,
            password: credentials.password,
          });

          if (session && session.user) {
            return {
              id: session.user.id,
              email: session.user.email,
              username: session.user.username,
              name: session.user.name,
              image: session.user.avatar,
              accessToken: session.accessToken,
              refreshToken: session.refreshToken,
            } as any;
          }

          return null;
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),

    // GitHub OAuth
    GitHubProvider({
      clientId: process.env['GITHUB_CLIENT_ID'] || '',
      clientSecret: process.env['GITHUB_CLIENT_SECRET'] || '',
      authorization: {
        params: {
          scope: 'read:user user:email',
        },
      },
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env['GOOGLE_CLIENT_ID'] || '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],

  // 会话配置
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 天
  },

  // JWT 配置
  jwt: {
    secret: process.env['NEXTAUTH_SECRET'],
    maxAge: 7 * 24 * 60 * 60, // 7 天
  },

  // 页面路由
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },

  // 回调函数
  callbacks: {
    // JWT 回调
    async jwt({ token, user, account }) {
      // 初次登录时，将用户信息添加到 token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.username = (user as any).username;
        token.name = user.name;
        token.picture = user.image;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
      }

      // OAuth 登录时
      if (account) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
      }

      return token;
    },

    // Session 回调
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.username = token.username as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        (session as any).accessToken = token.accessToken;
        (session as any).refreshToken = token.refreshToken;
      }

      return session;
    },

    // 登录回调
    async signIn({ user: _user, account, profile: _profile }) {
      // OAuth 登录时，可以在这里处理用户信息
      if (account?.provider === 'github' || account?.provider === 'google') {
        // 可以调用后端API创建或更新用户
        try {
          // 这里可以调用后端API
          // await createOrUpdateOAuthUser({ user, account, profile });
          return true;
        } catch (error) {
          console.error('OAuth sign in error:', error);
          return false;
        }
      }

      return true;
    },

    // 重定向回调
    async redirect({ url, baseUrl }) {
      // 允许相对路径回调
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // 允许同域名回调
      else if (new URL(url).origin === baseUrl) {
        return url;
      }
      return baseUrl;
    },
  },

  // 事件监听
  events: {
    async signIn(message) {
      console.log('User signed in:', message.user?.email);
    },
    async signOut(_message) {
      console.log('User signed out');
    },
    async createUser(message) {
      console.log('User created:', message.user?.email);
    },
    async updateUser(message) {
      console.log('User updated:', message.user?.email);
    },
    async linkAccount(message) {
      console.log('Account linked:', message.user?.email);
    },
    async session(_message) {
      // console.log('Session active:', message.session);
    },
  },

  // 调试模式（仅开发环境）
  debug: process.env['NODE_ENV'] === 'development',
};

