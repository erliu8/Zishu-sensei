/**
 * Follow Hooks
 * 关注相关的 React Query Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followApiClient } from '../api/FollowApiClient';
import type {
  CreateFollowInput,
  FollowQueryParams,
  BulkFollowInput,
} from '../domain/Follow';
import { useToast } from '@/shared/components/ui/use-toast';

/**
 * Query Keys
 */
export const followKeys = {
  all: ['follows'] as const,
  lists: () => [...followKeys.all, 'list'] as const,
  list: (params: FollowQueryParams) => [...followKeys.lists(), params] as const,
  followers: (userId: string) => [...followKeys.all, 'followers', userId] as const,
  following: (userId: string) => [...followKeys.all, 'following', userId] as const,
  stats: (userId: string) => [...followKeys.all, 'stats', userId] as const,
  check: (followeeId: string) => [...followKeys.all, 'check', followeeId] as const,
  mutual: () => [...followKeys.all, 'mutual'] as const,
  recommendations: () => [...followKeys.all, 'recommendations'] as const,
};

/**
 * 关注用户
 */
export function useFollow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: CreateFollowInput) => followApiClient.follow(input),
    onSuccess: (data, variables) => {
      // 使相关查询失效
      queryClient.invalidateQueries({ queryKey: followKeys.check(variables.followeeId) });
      queryClient.invalidateQueries({ queryKey: followKeys.stats(variables.followeeId) });
      queryClient.invalidateQueries({ queryKey: followKeys.following('current') });
      
      toast({
        title: '关注成功',
        description: '你已成功关注该用户',
      });
    },
    onError: (error: any) => {
      toast({
        title: '关注失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 取消关注
 */
export function useUnfollow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (followeeId: string) => followApiClient.unfollow(followeeId),
    onSuccess: (data, followeeId) => {
      queryClient.invalidateQueries({ queryKey: followKeys.check(followeeId) });
      queryClient.invalidateQueries({ queryKey: followKeys.stats(followeeId) });
      queryClient.invalidateQueries({ queryKey: followKeys.following('current') });
      
      toast({
        title: '取消关注',
        description: '你已取消关注该用户',
      });
    },
    onError: (error: any) => {
      toast({
        title: '操作失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 检查是否关注
 */
export function useCheckFollowing(followeeId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: followKeys.check(followeeId),
    queryFn: async () => {
      const response = await followApiClient.checkFollowing(followeeId);
      return response.data;
    },
    enabled: enabled && !!followeeId,
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}

/**
 * 获取关注统计
 */
export function useFollowStats(userId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: followKeys.stats(userId),
    queryFn: async () => {
      const response = await followApiClient.getFollowStats(userId);
      return response.data;
    },
    enabled: enabled && !!userId,
    staleTime: 2 * 60 * 1000, // 2分钟
  });
}

/**
 * 获取粉丝列表
 */
export function useFollowers(params: FollowQueryParams) {
  return useQuery({
    queryKey: followKeys.list({ ...params, type: 'followers' }),
    queryFn: async () => {
      const response = await followApiClient.getFollowers(params);
      return response.data;
    },
    enabled: !!params.userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 获取关注列表
 */
export function useFollowing(params: FollowQueryParams) {
  return useQuery({
    queryKey: followKeys.list({ ...params, type: 'following' }),
    queryFn: async () => {
      const response = await followApiClient.getFollowing(params);
      return response.data;
    },
    enabled: !!params.userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 批量关注
 */
export function useBulkFollow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: BulkFollowInput) => followApiClient.bulkFollow(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: followKeys.following('current') });
      
      toast({
        title: '批量关注成功',
        description: `成功关注 ${data.data.successCount} 个用户`,
      });
    },
    onError: (error: any) => {
      toast({
        title: '批量关注失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 批量取消关注
 */
export function useBulkUnfollow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (userIds: string[]) => followApiClient.bulkUnfollow(userIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: followKeys.following('current') });
      
      toast({
        title: '批量取消关注成功',
        description: `成功取消关注 ${data.data.successCount} 个用户`,
      });
    },
    onError: (error: any) => {
      toast({
        title: '操作失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 获取互相关注的用户
 */
export function useMutualFollows(params: FollowQueryParams) {
  return useQuery({
    queryKey: followKeys.mutual(),
    queryFn: async () => {
      const response = await followApiClient.getMutualFollows(params);
      return response.data;
    },
    enabled: !!params.userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 获取推荐关注用户
 */
export function useRecommendedUsers(limit: number = 10) {
  return useQuery({
    queryKey: followKeys.recommendations(),
    queryFn: async () => {
      const response = await followApiClient.getRecommendedUsers(limit);
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10分钟
  });
}

/**
 * 切换关注状态（关注/取消关注）
 */
export function useToggleFollow() {
  const queryClient = useQueryClient();
  const followMutation = useFollow();
  const unfollowMutation = useUnfollow();

  return {
    toggle: async (followeeId: string, isFollowing: boolean) => {
      if (isFollowing) {
        await unfollowMutation.mutateAsync(followeeId);
      } else {
        await followMutation.mutateAsync({ followeeId });
      }
    },
    isLoading: followMutation.isPending || unfollowMutation.isPending,
  };
}

