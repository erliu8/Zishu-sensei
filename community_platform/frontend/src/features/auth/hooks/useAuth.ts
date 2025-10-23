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

        // 使用 NextAuth 登录
        const result = await signIn('credentials', {
          email: credentials.email,
          password: credentials.password,
          redirect: false,
        });

        if (result?.error) {
          setError(result.error);
          return { success: false, error: result.error };
        }

        if (result?.ok) {
          // 登录成功，获取用户信息并更新 store
          const session = await AuthApiClient.login(credentials);
          setSession(session);

          // 重定向
          router.push(redirectTo || '/');
          return { success: true };
        }

        return { success: false, error: '登录失败' };
      } catch (err: any) {
        const errorMessage = err.message || '登录失败';
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

        const session = await AuthApiClient.register(input);
        setSession(session);

        // 注册成功后自动登录
        await signIn('credentials', {
          email: input.email,
          password: input.password,
          redirect: false,
        });

        // 重定向
        router.push(redirectTo || '/');
        return { success: true };
      } catch (err: any) {
        const errorMessage = err.message || '注册失败';
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

      const userLevel = roleHierarchy[user.role] || 0;
      const requiredLevel = roleHierarchy[role] || 0;

      return userLevel >= requiredLevel;
    },
    [user]
  );

  const canAccess = requiredRole ? hasPermission(requiredRole) : true;

  return { hasPermission, canAccess };
}

