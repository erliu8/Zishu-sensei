/**
 * 帖子数据层 - usePost Hook
 * @module features/post/hooks
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { postApiClient } from '../api';
import type { Post } from '../domain';
import { POST_QUERY_KEYS } from './query-keys';

/**
 * 获取单个帖子详情 Hook
 * @param id - 帖子 ID
 * @param enabled - 是否启用查询
 * @returns 帖子详情查询结果
 */
export function usePost(id: string, enabled: boolean = true): UseQueryResult<Post, Error> {
  return useQuery({
    queryKey: POST_QUERY_KEYS.detail(id),
    queryFn: async () => {
      const post = await postApiClient.getPost(id);
      // 增加浏览量（在后台执行，不阻塞主流程）
      postApiClient.incrementViewCount(id).catch(() => {
        // 忽略错误，浏览量不是关键功能
      });
      return post;
    },
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 2, // 2 分钟
    gcTime: 1000 * 60 * 10, // 10 分钟
  });
}

