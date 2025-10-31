/**
 * 用户相关 Hooks
 * @module features/user/hooks
 */

'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserApiClient } from '../api/UserApiClient';
import { useUserStore } from '../store/user.store';
import type {
  UpdateProfileRequest,
  UpdatePasswordRequest,
  UpdateEmailRequest,
  UpdatePreferencesRequest,
} from '../types';
import { useAuthStore } from '@/features/auth/store';

/**
 * 用户查询键
 */
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params?: any) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  current: () => [...userKeys.all, 'current'] as const,
  stats: (id?: string) => [...userKeys.all, 'stats', id] as const,
  activities: (id?: string) => [...userKeys.all, 'activities', id] as const,
  preferences: () => [...userKeys.all, 'preferences'] as const,
  sessions: () => [...userKeys.all, 'sessions'] as const,
  loginHistory: () => [...userKeys.all, 'loginHistory'] as const,
};

/**
 * 使用当前用户信息
 */
export function useCurrentUser() {
  const { user: authUser } = useAuthStore();
  const { setCurrentUserProfile } = useUserStore();

  const query = useQuery({
    queryKey: userKeys.current(),
    queryFn: UserApiClient.getCurrentUser,
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // 使用 useEffect 处理成功回调
  React.useEffect(() => {
    if (query.data) {
      setCurrentUserProfile(query.data);
    }
  }, [query.data, setCurrentUserProfile]);

  return {
    user: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 使用用户资料
 */
export function useUserProfile(userId: string) {
  const query = useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => UserApiClient.getUserById(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 使用用户统计
 */
export function useUserStats(userId?: string) {
  const query = useQuery({
    queryKey: userKeys.stats(userId),
    queryFn: () => UserApiClient.getUserStats(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 使用用户活动
 */
export function useUserActivities(userId?: string, page: number = 1) {
  const query = useQuery<{
    activities: any[];
    total: number;
    hasMore: boolean;
  }>({
    queryKey: [...userKeys.activities(userId), page],
    queryFn: () => UserApiClient.getUserActivities(userId, page),
    placeholderData: (prevData) => prevData,
  });

  return {
    activities: query.data?.activities || [],
    total: query.data?.total || 0,
    hasMore: query.data?.hasMore || false,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 使用更新个人资料
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { setCurrentUserProfile } = useUserStore();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => UserApiClient.updateProfile(data),
    onSuccess: (updatedProfile) => {
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
      queryClient.invalidateQueries({ queryKey: userKeys.detail(updatedProfile.id) });
      setCurrentUserProfile(updatedProfile);
    },
  });
}

/**
 * 使用上传头像
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => UserApiClient.uploadAvatar(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
    },
  });
}

/**
 * 使用删除头像
 */
export function useDeleteAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => UserApiClient.deleteAvatar(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
    },
  });
}

/**
 * 使用更新密码
 */
export function useUpdatePassword() {
  return useMutation({
    mutationFn: (data: UpdatePasswordRequest) => UserApiClient.updatePassword(data),
  });
}

/**
 * 使用更新邮箱
 */
export function useUpdateEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateEmailRequest) => UserApiClient.updateEmail(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
    },
  });
}

/**
 * 使用用户偏好设置
 */
export function usePreferences() {
  const { preferences, setPreferences } = useUserStore();

  const query = useQuery({
    queryKey: userKeys.preferences(),
    queryFn: UserApiClient.getPreferences,
    initialData: preferences || undefined,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // 使用 useEffect 处理成功回调
  React.useEffect(() => {
    if (query.data) {
      setPreferences(query.data);
    }
  }, [query.data, setPreferences]);

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 使用更新偏好设置
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const { updatePreferences } = useUserStore();

  return useMutation({
    mutationFn: (data: UpdatePreferencesRequest) => 
      UserApiClient.updatePreferences(data),
    onSuccess: (updatedPreferences) => {
      queryClient.invalidateQueries({ queryKey: userKeys.preferences() });
      updatePreferences(updatedPreferences);
    },
  });
}

/**
 * 使用删除账号
 */
export function useDeleteAccount() {
  const { clearSession } = useAuthStore();
  const { clearUserData } = useUserStore();

  return useMutation({
    mutationFn: (password: string) => UserApiClient.deleteAccount(password),
    onSuccess: () => {
      clearSession();
      clearUserData();
      // Redirect to home page
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    },
  });
}

/**
 * 使用用户会话列表
 */
export function useSessions(page: number = 1) {
  const query = useQuery({
    queryKey: [...userKeys.sessions(), page],
    queryFn: () => UserApiClient.getSessions(page),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    sessions: query.data?.sessions || [],
    total: query.data?.total || 0,
    hasMore: query.data?.hasMore || false,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * 使用删除会话
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => UserApiClient.deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.sessions() });
    },
  });
}

/**
 * 使用删除其他会话
 */
export function useDeleteOtherSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => UserApiClient.deleteOtherSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.sessions() });
    },
  });
}

/**
 * 使用登录历史
 */
export function useLoginHistory(page: number = 1) {
  const query = useQuery({
    queryKey: [...userKeys.loginHistory(), page],
    queryFn: () => UserApiClient.getLoginHistory(page),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    history: query.data?.history || [],
    total: query.data?.total || 0,
    hasMore: query.data?.hasMore || false,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

