/**
 * 认证相关 Hooks
 * @module features/auth/hooks
 */

'use client';

import { useCallback } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store';
import { AuthApiClient } from '../api';
import type { LoginCredentials, RegisterInput } from '../types';

/**
 * 使用认证 Hook
 */
export function useAuth() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const {
    user,
    isAuthenticated,
    isLoading: storeLoading,
    error,
    setSession,
    setLoading,
    setError,
    logout: storeLogout,
  } = useAuthStore();

  const isLoading = status === 'loading' || storeLoading;

  /**
   * 登录
   */
  const login = useCallback(
    async (credentials: LoginCredentials, redirectTo?: string) => {
      try {
        setLoading(true);
        setError(null);

        // 直接调用后端API登录
        const session = await AuthApiClient.login(credentials);
        setSession(session);

        // 同时使用NextAuth登录（用于SSR和OAuth场景）
        await signIn('credentials', {
          email: credentials.email,
          password: credentials.password,
          redirect: false,
        });

        // 重定向
        router.push(redirectTo || '/');
        return { success: true };
      } catch (err: any) {
        // 改进错误消息提取逻辑
        let errorMessage = '登录失败';
        
        if (err.response?.data) {
          const data = err.response.data;
          
          // FastAPI 标准错误格式: { "detail": "错误消息" }
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } 
          // 自定义错误格式: { "error": { "message": "错误消息" } }
          else if (data.error?.message) {
            errorMessage = data.error.message;
          }
          // 其他格式: { "message": "错误消息" }
          else if (data.message) {
            errorMessage = data.message;
          }
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [router, setSession, setLoading, setError]
  );

  /**
   * 注册
   */
  const register = useCallback(
    async (input: RegisterInput, redirectTo?: string) => {
      try {
        setLoading(true);
        setError(null);

        // 调用后端API注册
        const session = await AuthApiClient.register(input);
        setSession(session);

        // 注册成功后自动使用NextAuth登录（用于SSR和OAuth场景）
        await signIn('credentials', {
          email: input.email,
          password: input.password,
          redirect: false,
        });

        // 重定向
        router.push(redirectTo || '/');
        return { success: true };
      } catch (err: any) {
        // 改进错误消息提取逻辑
        let errorMessage = '注册失败';
        
        if (err.response?.data) {
          // 处理不同的错误响应格式
          const data = err.response.data;
          
          // FastAPI 标准错误格式: { "detail": "错误消息" }
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } 
          // 自定义错误格式: { "error": { "message": "错误消息" } }
          else if (data.error?.message) {
            errorMessage = data.error.message;
          }
          // 其他格式: { "message": "错误消息" }
          else if (data.message) {
            errorMessage = data.message;
          }
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [router, setSession, setLoading, setError]
  );

  /**
   * 登出
   */
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await storeLogout();
      await signOut({ redirect: false });
      router.push('/');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoading(false);
    }
  }, [router, storeLogout, setLoading]);

  /**
   * 使用 OAuth 登录
   */
  const loginWithOAuth = useCallback(
    async (provider: 'github' | 'google', redirectTo?: string) => {
      try {
        setLoading(true);
        setError(null);

        await signIn(provider, {
          callbackUrl: redirectTo || '/',
        });
      } catch (err: any) {
        const errorMessage = err.message || 'OAuth 登录失败';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError]
  );

  return {
    // 状态
    user: user || session?.user,
    isAuthenticated: isAuthenticated || !!session,
    isLoading,
    error,
    session,

    // 方法
    login,
    register,
    logout,
    loginWithOAuth,
  };
}

/**
 * 要求认证 Hook
 * 如果用户未登录，重定向到登录页
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  if (!isLoading && !isAuthenticated) {
    router.push('/login');
  }

  return { isAuthenticated, isLoading };
}

/**
 * 检查权限 Hook
 */
export function usePermission(requiredRole?: string) {
  const { user } = useAuth();

  const hasPermission = useCallback(
    (role: string) => {
      if (!user) return false;

      const roleHierarchy: Record<string, number> = {
        guest: 0,
        user: 1,
        moderator: 2,
        admin: 3,
      };

      const userLevel = roleHierarchy[user.role as keyof typeof roleHierarchy] || 0;
      const requiredLevel = roleHierarchy[role as keyof typeof roleHierarchy] || 0;

      return userLevel >= requiredLevel;
    },
    [user]
  );

  const canAccess = requiredRole ? hasPermission(requiredRole) : true;

  return { hasPermission, canAccess };
}

