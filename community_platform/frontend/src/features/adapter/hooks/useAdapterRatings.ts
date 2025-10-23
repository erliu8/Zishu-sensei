/**
 * 适配器评分相关 Hooks
 * @module features/adapter/hooks
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { adapterRatingApiClient, type RatingQueryParams, type RatingListResponse } from '../api';
import type { AdapterRating, CreateRatingInput, UpdateRatingInput } from '../domain';

/**
 * 适配器评分查询键工厂
 */
export const adapterRatingKeys = {
  all: ['adapter-ratings'] as const,
  lists: (adapterId: string) => [...adapterRatingKeys.all, 'list', adapterId] as const,
  list: (adapterId: string, params?: RatingQueryParams) => [...adapterRatingKeys.lists(adapterId), params] as const,
  details: () => [...adapterRatingKeys.all, 'detail'] as const,
  detail: (adapterId: string, ratingId: string) => [...adapterRatingKeys.details(), adapterId, ratingId] as const,
  myRating: (adapterId: string) => [...adapterRatingKeys.all, 'my-rating', adapterId] as const,
  stats: (adapterId: string) => [...adapterRatingKeys.all, 'stats', adapterId] as const,
};

/**
 * 获取适配器的评分列表
 */
export function useAdapterRatings(
  adapterId: string,
  params?: RatingQueryParams,
  options?: Omit<UseQueryOptions<RatingListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterRatingKeys.list(adapterId, params),
    queryFn: () => adapterRatingApiClient.getRatings(adapterId, params),
    enabled: !!adapterId,
    ...options,
  });
}

/**
 * 获取单个评分详情
 */
export function useAdapterRating(
  adapterId: string,
  ratingId: string,
  options?: Omit<UseQueryOptions<AdapterRating>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterRatingKeys.detail(adapterId, ratingId),
    queryFn: () => adapterRatingApiClient.getRating(adapterId, ratingId),
    enabled: !!adapterId && !!ratingId,
    ...options,
  });
}

/**
 * 获取用户对适配器的评分
 */
export function useMyAdapterRating(
  adapterId: string,
  options?: Omit<UseQueryOptions<AdapterRating | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterRatingKeys.myRating(adapterId),
    queryFn: () => adapterRatingApiClient.getMyRating(adapterId),
    enabled: !!adapterId,
    ...options,
  });
}

/**
 * 创建评分
 */
export function useCreateAdapterRating(
  options?: UseMutationOptions<AdapterRating, Error, CreateRatingInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRatingInput) => adapterRatingApiClient.createRating(data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterRatingKeys.lists(variables.adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterRatingKeys.stats(variables.adapterId) 
      });
      queryClient.setQueryData(
        adapterRatingKeys.myRating(variables.adapterId),
        data
      );
    },
    ...options,
  });
}

/**
 * 更新评分
 */
export function useUpdateAdapterRating(
  options?: UseMutationOptions<
    AdapterRating,
    Error,
    { adapterId: string; ratingId: string; data: UpdateRatingInput }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, ratingId, data }) =>
      adapterRatingApiClient.updateRating(adapterId, ratingId, data),
    onSuccess: (data, { adapterId }) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterRatingKeys.lists(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterRatingKeys.stats(adapterId) 
      });
      queryClient.setQueryData(
        adapterRatingKeys.detail(adapterId, data.id),
        data
      );
      queryClient.setQueryData(
        adapterRatingKeys.myRating(adapterId),
        data
      );
    },
    ...options,
  });
}

/**
 * 删除评分
 */
export function useDeleteAdapterRating(
  options?: UseMutationOptions<void, Error, { adapterId: string; ratingId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, ratingId }) =>
      adapterRatingApiClient.deleteRating(adapterId, ratingId),
    onSuccess: (_, { adapterId, ratingId }) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterRatingKeys.lists(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterRatingKeys.stats(adapterId) 
      });
      queryClient.removeQueries({ 
        queryKey: adapterRatingKeys.detail(adapterId, ratingId) 
      });
      queryClient.setQueryData(
        adapterRatingKeys.myRating(adapterId),
        null
      );
    },
    ...options,
  });
}

/**
 * 点赞评分
 */
export function useLikeAdapterRating(
  options?: UseMutationOptions<AdapterRating, Error, { adapterId: string; ratingId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, ratingId }) =>
      adapterRatingApiClient.likeRating(adapterId, ratingId),
    onSuccess: (data, { adapterId }) => {
      queryClient.setQueryData(
        adapterRatingKeys.detail(adapterId, data.id),
        data
      );
      // 局部更新列表中的数据
      queryClient.invalidateQueries({ 
        queryKey: adapterRatingKeys.lists(adapterId) 
      });
    },
    ...options,
  });
}

/**
 * 取消点赞评分
 */
export function useUnlikeAdapterRating(
  options?: UseMutationOptions<AdapterRating, Error, { adapterId: string; ratingId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, ratingId }) =>
      adapterRatingApiClient.unlikeRating(adapterId, ratingId),
    onSuccess: (data, { adapterId }) => {
      queryClient.setQueryData(
        adapterRatingKeys.detail(adapterId, data.id),
        data
      );
      // 局部更新列表中的数据
      queryClient.invalidateQueries({ 
        queryKey: adapterRatingKeys.lists(adapterId) 
      });
    },
    ...options,
  });
}

/**
 * 获取评分统计
 */
export function useAdapterRatingStats(
  adapterId: string,
  options?: Omit<
    UseQueryOptions<{
      averageRating: number;
      totalRatings: number;
      distribution: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
      };
    }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: adapterRatingKeys.stats(adapterId),
    queryFn: () => adapterRatingApiClient.getRatingStats(adapterId),
    enabled: !!adapterId,
    ...options,
  });
}

/**
 * 举报评分
 */
export function useReportAdapterRating(
  options?: UseMutationOptions<
    void,
    Error,
    { adapterId: string; ratingId: string; reason: string }
  >
) {
  return useMutation({
    mutationFn: ({ adapterId, ratingId, reason }) =>
      adapterRatingApiClient.reportRating(adapterId, ratingId, reason),
    ...options,
  });
}

