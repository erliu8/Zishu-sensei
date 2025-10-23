/**
 * 认证状态管理 Store
 * @module features/auth/store
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, AuthSession } from '../types';
import { TokenService } from '../services/token.service';
import { AuthApiClient } from '../api/auth.client';

/**
 * 认证状态接口
 */
interface AuthState {
  // 状态
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSession: (session: AuthSession) => void;
  setUser: (user: User | null) => void;
  clearSession: () => void;
  updateToken: (accessToken: string, expiresAt: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 异步操作
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
}

/**
 * 创建认证 Store
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      /**
       * 设置会话信息
       */
      setSession: (session: AuthSession) => {
        // 保存 Token 到本地存储
        TokenService.saveTokens(
          session.accessToken,
          session.refreshToken,
          session.expiresAt
        );

        set({
          user: session.user,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          isAuthenticated: true,
          error: null,
        });
      },

      /**
       * 设置用户信息
       */
      setUser: (user: User | null) => {
        set({ user });
      },

      /**
       * 清除会话信息
       */
      clearSession: () => {
        // 清除本地存储的 Token
        TokenService.clearTokens();

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          isAuthenticated: false,
          error: null,
        });
      },

      /**
       * 更新访问令牌
       */
      updateToken: (accessToken: string, expiresAt: number) => {
        TokenService.saveTokens(accessToken, get().refreshToken || undefined, expiresAt);

        set({
          accessToken,
          expiresAt,
        });
      },

      /**
       * 设置加载状态
       */
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      /**
       * 设置错误信息
       */
      setError: (error: string | null) => {
        set({ error });
      },

      /**
       * 初始化认证状态
       * 从本地存储恢复会话，并验证 Token 是否有效
       */
      initialize: async () => {
        set({ isLoading: true });

        try {
          const accessToken = TokenService.getAccessToken();
          
          if (!accessToken) {
            get().clearSession();
            return;
          }

          // 检查 Token 是否过期
          if (TokenService.isTokenExpired(accessToken)) {
            // 尝试刷新 Token
            const refreshed = await get().refreshAccessToken();
            if (!refreshed) {
              get().clearSession();
              return;
            }
          }

          // 获取用户信息
          const user = await AuthApiClient.getCurrentUser();
          set({
            user,
            accessToken: TokenService.getAccessToken(),
            refreshToken: TokenService.getRefreshToken(),
            expiresAt: TokenService.getExpiresAt(),
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          get().clearSession();
        } finally {
          set({ isLoading: false });
        }
      },

      /**
       * 登出
       */
      logout: async () => {
        try {
          await AuthApiClient.logout();
        } catch (error) {
          console.error('Logout failed:', error);
        } finally {
          get().clearSession();
        }
      },

      /**
       * 刷新访问令牌
       */
      refreshAccessToken: async (): Promise<boolean> => {
        try {
          const refreshToken = get().refreshToken;
          
          if (!refreshToken) {
            return false;
          }

          const response = await AuthApiClient.refreshToken(refreshToken);
          
          get().updateToken(response.accessToken, response.expiresAt);
          
          // 如果返回了新的刷新令牌，也更新它
          if (response.refreshToken) {
            set({ refreshToken: response.refreshToken });
            TokenService.saveTokens(
              response.accessToken,
              response.refreshToken,
              response.expiresAt
            );
          }

          return true;
        } catch (error) {
          console.error('Token refresh failed:', error);
          return false;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // 只持久化必要的字段
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * 选择器 Hooks
 */
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAccessToken = () => useAuthStore((state) => state.accessToken);

