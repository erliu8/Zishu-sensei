/**
 * Like Hooks
 * 点赞相关的 React Query Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { likeApiClient } from '../api/LikeApiClient';
import type {
  CreateLikeInput,
  LikeQueryParams,
  LikeTargetType,
} from '../domain/Like';
import { useToast } from '@/shared/components/ui/use-toast';

/**
 * Query Keys
 */
export const likeKeys = {
  all: ['likes'] as const,
  lists: () => [...likeKeys.all, 'list'] as const,
  list: (params: LikeQueryParams) => [...likeKeys.lists(), params] as const,
  stats: (targetType: LikeTargetType, targetId: string) => 
    [...likeKeys.all, 'stats', targetType, targetId] as const,
  bulkStats: (targetType: LikeTargetType, targetIds: string[]) => 
    [...likeKeys.all, 'bulkStats', targetType, targetIds] as const,
  check: (targetType: LikeTargetType, targetId: string) => 
    [...likeKeys.all, 'check', targetType, targetId] as const,
  userLikes: (userId: string, targetType?: LikeTargetType) => 
    [...likeKeys.all, 'user', userId, targetType] as const,
  targetLikers: (targetType: LikeTargetType, targetId: string) => 
    [...likeKeys.all, 'likers', targetType, targetId] as const,
};

/**
 * 点赞
 */
export function useLike() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: CreateLikeInput) => likeApiClient.like(input),
    onSuccess: (data, variables) => {
      // 使相关查询失效
      queryClient.invalidateQueries({ 
        queryKey: likeKeys.check(variables.targetType, variables.targetId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: likeKeys.stats(variables.targetType, variables.targetId) 
      });
      
      toast({
        title: '点赞成功',
        description: '已点赞',
      });
    },
    onError: (error: any) => {
      toast({
        title: '点赞失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 取消点赞
 */
export function useUnlike() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: LikeTargetType; targetId: string }) => 
      likeApiClient.unlike(targetType, targetId),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: likeKeys.check(variables.targetType, variables.targetId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: likeKeys.stats(variables.targetType, variables.targetId) 
      });
      
      toast({
        title: '已取消点赞',
        description: '已取消点赞',
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
 * 检查是否已点赞
 */
export function useCheckLiked(
  targetType: LikeTargetType,
  targetId: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: likeKeys.check(targetType, targetId),
    queryFn: async () => {
      const response = await likeApiClient.checkLiked(targetType, targetId);
      return response.data;
    },
    enabled: enabled && !!targetType && !!targetId,
    staleTime: 30 * 1000, // 30秒
  });
}

/**
 * 获取点赞统计
 */
export function useLikeStats(
  targetType: LikeTargetType,
  targetId: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: likeKeys.stats(targetType, targetId),
    queryFn: async () => {
      const response = await likeApiClient.getLikeStats(targetType, targetId);
      return response.data;
    },
    enabled: enabled && !!targetType && !!targetId,
    staleTime: 30 * 1000,
  });
}

/**
 * 批量获取点赞统计
 */
export function useBulkLikeStats(
  targetType: LikeTargetType,
  targetIds: string[],
  enabled: boolean = true
) {
  return useQuery({
    queryKey: likeKeys.bulkStats(targetType, targetIds),
    queryFn: async () => {
      const response = await likeApiClient.getBulkLikeStats(targetType, targetIds);
      return response.data;
    },
    enabled: enabled && !!targetType && targetIds.length > 0,
    staleTime: 30 * 1000,
  });
}

/**
 * 获取点赞列表
 */
export function useLikes(params: LikeQueryParams) {
  return useQuery({
    queryKey: likeKeys.list(params),
    queryFn: async () => {
      const response = await likeApiClient.getLikes(params);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 获取用户的点赞列表
 */
export function useUserLikes(
  userId: string,
  targetType?: LikeTargetType,
  page: number = 1,
  pageSize: number = 20
) {
  return useQuery({
    queryKey: likeKeys.userLikes(userId, targetType),
    queryFn: async () => {
      const response = await likeApiClient.getUserLikes(userId, targetType, page, pageSize);
      return response.data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 获取目标的点赞用户列表
 */
export function useTargetLikers(
  targetType: LikeTargetType,
  targetId: string,
  page: number = 1,
  pageSize: number = 20
) {
  return useQuery({
    queryKey: likeKeys.targetLikers(targetType, targetId),
    queryFn: async () => {
      const response = await likeApiClient.getTargetLikers(targetType, targetId, page, pageSize);
      return response.data;
    },
    enabled: !!targetType && !!targetId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 切换点赞状态（点赞/取消点赞）
 */
export function useToggleLike() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: CreateLikeInput) => likeApiClient.toggleLike(input),
    onMutate: async (input) => {
      // 取消相关的查询以避免覆盖我们的乐观更新
      await queryClient.cancelQueries({ 
        queryKey: likeKeys.stats(input.targetType, input.targetId) 
      });

      // 获取之前的值
      const previousStats = queryClient.getQueryData(
        likeKeys.stats(input.targetType, input.targetId)
      );

      // 乐观更新
      queryClient.setQueryData(
        likeKeys.stats(input.targetType, input.targetId),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            isLiked: !old.isLiked,
            likeCount: old.isLiked ? old.likeCount - 1 : old.likeCount + 1,
          };
        }
      );

      return { previousStats };
    },
    onError: (error: any, input, context) => {
      // 回滚乐观更新
      if (context?.previousStats) {
        queryClient.setQueryData(
          likeKeys.stats(input.targetType, input.targetId),
          context.previousStats
        );
      }
      
      toast({
        title: '操作失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
    onSettled: (data, error, variables) => {
      // 无论成功还是失败，都重新获取数据
      queryClient.invalidateQueries({ 
        queryKey: likeKeys.stats(variables.targetType, variables.targetId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: likeKeys.check(variables.targetType, variables.targetId) 
      });
    },
  });
}

