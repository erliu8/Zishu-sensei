/**
 * 帖子数据层 - usePosts Hook
 * @module features/post/hooks
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { postApiClient } from '../api';
import type { PostListResponse, PostQueryParams } from '../domain';
import { POST_QUERY_KEYS } from './query-keys';

/**
 * 获取帖子列表 Hook
 * @param params - 查询参数
 * @param enabled - 是否启用查询
 * @returns 帖子列表查询结果
 */
export function usePosts(
  params?: PostQueryParams,
  enabled: boolean = true
): UseQueryResult<PostListResponse, Error> {
  return useQuery({
    queryKey: POST_QUERY_KEYS.list(params),
    queryFn: () => postApiClient.getPosts(params),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 分钟
    gcTime: 1000 * 60 * 30, // 30 分钟
  });
}

/**
 * 获取用户帖子列表 Hook
 * @param userId - 用户 ID
 * @param params - 查询参数
 * @param enabled - 是否启用查询
 * @returns 用户帖子列表查询结果
 */
export function useUserPosts(
  userId: string,
  params?: PostQueryParams,
  enabled: boolean = true
): UseQueryResult<PostListResponse, Error> {
  return useQuery({
    queryKey: POST_QUERY_KEYS.userPosts(userId, params),
    queryFn: () => postApiClient.getUserPosts(userId, params),
    enabled: enabled && !!userId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}

/**
 * 获取推荐帖子列表 Hook
 * @param limit - 限制数量
 * @param enabled - 是否启用查询
 * @returns 推荐帖子列表查询结果
 */
export function useFeaturedPosts(
  limit: number = 10,
  enabled: boolean = true
): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: POST_QUERY_KEYS.featured(limit),
    queryFn: () => postApiClient.getFeaturedPosts(limit),
    enabled,
    staleTime: 1000 * 60 * 10, // 10 分钟
    gcTime: 1000 * 60 * 30,
  });
}

/**
 * 获取热门帖子列表 Hook
 * @param limit - 限制数量
 * @param enabled - 是否启用查询
 * @returns 热门帖子列表查询结果
 */
export function useTrendingPosts(
  limit: number = 10,
  enabled: boolean = true
): UseQueryResult<any[], Error> {
  return useQuery({
    queryKey: POST_QUERY_KEYS.trending(limit),
    queryFn: () => postApiClient.getTrendingPosts(limit),
    enabled,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

