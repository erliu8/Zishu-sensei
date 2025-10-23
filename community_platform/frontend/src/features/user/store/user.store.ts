/**
 * 用户状态管理 Store
 * @module features/user/store
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserProfile, UserPreferences } from '../types';

/**
 * 用户状态接口
 */
interface UserState {
  // 状态
  currentUserProfile: UserProfile | null;
  preferences: UserPreferences | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentUserProfile: (profile: UserProfile | null) => void;
  setPreferences: (preferences: UserPreferences) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearUserData: () => void;
}

/**
 * 默认偏好设置
 */
const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'zh-CN',
  emailNotifications: true,
  pushNotifications: true,
  marketingEmails: false,
  weeklyDigest: true,
};

/**
 * 创建用户 Store
 */
export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // 初始状态
      currentUserProfile: null,
      preferences: defaultPreferences,
      isLoading: false,
      error: null,

      /**
       * 设置当前用户资料
       */
      setCurrentUserProfile: (profile: UserProfile | null) => {
        set({ currentUserProfile: profile });
      },

      /**
       * 设置偏好设置
       */
      setPreferences: (preferences: UserPreferences) => {
        set({ preferences });
      },

      /**
       * 更新偏好设置（部分更新）
       */
      updatePreferences: (newPreferences: Partial<UserPreferences>) => {
        const currentPreferences = get().preferences || defaultPreferences;
        set({
          preferences: {
            ...currentPreferences,
            ...newPreferences,
          },
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
       * 清除用户数据
       */
      clearUserData: () => {
        set({
          currentUserProfile: null,
          preferences: defaultPreferences,
          error: null,
        });
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);

export default useUserStore;

