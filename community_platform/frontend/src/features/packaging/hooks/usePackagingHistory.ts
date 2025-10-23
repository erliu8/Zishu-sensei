/**
 * usePackagingHistory Hook
 * 获取打包历史的 Hook
 */

import { useQuery } from '@tanstack/react-query';
import { packagingApiClient } from '../api/PackagingApiClient';
import type { PackagingTaskQueryParams } from '../domain/packaging.types';
import { packagingKeys } from './query-keys';

/**
 * 获取打包任务列表
 */
export function usePackagingHistory(params: PackagingTaskQueryParams) {
  return useQuery({
    queryKey: packagingKeys.list(params),
    queryFn: async () => {
      const response = await packagingApiClient.getTasks(params);
      return response.data;
    },
    staleTime: 30 * 1000, // 30 秒
    placeholderData: (previousData) => previousData,
  });
}

/**
 * 获取打包任务统计
 */
export function usePackagingStats(userId?: string) {
  return useQuery({
    queryKey: packagingKeys.stats(userId),
    queryFn: async () => {
      const response = await packagingApiClient.getTaskStats(userId);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 分钟
  });
}

