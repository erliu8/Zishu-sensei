/**
 * usePackagingStatus Hook
 * 获取打包任务状态的 Hook
 */

import { useQuery } from '@tanstack/react-query';
import { packagingApiClient } from '../api/PackagingApiClient';
import { packagingKeys } from './query-keys';
import { useEffect, useState } from 'react';
import { 
  packagingWebSocketService, 
  PackagingWebSocketEvent 
} from '../services/PackagingWebSocketService';
import type { PackagingProgressUpdate, PackagingTask } from '../domain/packaging.types';

/**
 * 获取打包任务状态（包含 WebSocket 实时更新）
 */
export function usePackagingStatus(taskId: string, enableWebSocket: boolean = true) {
  const [realtimeProgress, setRealtimeProgress] = useState<PackagingProgressUpdate | null>(null);

  // 使用 React Query 获取任务状态
  const query = useQuery({
    queryKey: packagingKeys.task(taskId),
    queryFn: async () => {
      const response = await packagingApiClient.getTask(taskId);
      return response.data;
    },
    enabled: !!taskId,
    refetchInterval: (query) => {
      // 如果任务正在进行中且未启用 WebSocket，则每 2 秒轮询一次
      const data = query?.state?.data;
      if (!enableWebSocket && data && (data.status === 'packaging' || data.status === 'queued')) {
        return 2000;
      }
      return false;
    },
    staleTime: 1000, // 1 秒
  });

  // WebSocket 实时更新
  useEffect(() => {
    if (!enableWebSocket || !taskId) return;

    // 连接并订阅任务
    packagingWebSocketService.connect(taskId);

    // 监听进度更新
    const unsubscribeProgress = packagingWebSocketService.on(
      PackagingWebSocketEvent.PROGRESS_UPDATE,
      (update: PackagingProgressUpdate) => {
        if (update.taskId === taskId) {
          setRealtimeProgress(update);
        }
      }
    );

    // 监听任务完成
    const unsubscribeCompleted = packagingWebSocketService.on(
      PackagingWebSocketEvent.TASK_COMPLETED,
      (task: PackagingTask) => {
        if (task.id === taskId) {
          query.refetch();
        }
      }
    );

    // 监听任务失败
    const unsubscribeFailed = packagingWebSocketService.on(
      PackagingWebSocketEvent.TASK_FAILED,
      (task: PackagingTask) => {
        if (task.id === taskId) {
          query.refetch();
        }
      }
    );

    // 监听任务取消
    const unsubscribeCancelled = packagingWebSocketService.on(
      PackagingWebSocketEvent.TASK_CANCELLED,
      (task: PackagingTask) => {
        if (task.id === taskId) {
          query.refetch();
        }
      }
    );

    // 清理
    return () => {
      packagingWebSocketService.unsubscribeFromTask(taskId);
      unsubscribeProgress();
      unsubscribeCompleted();
      unsubscribeFailed();
      unsubscribeCancelled();
    };
  }, [taskId, enableWebSocket, query]);

  return {
    ...query,
    realtimeProgress,
    // 合并实时进度和任务数据
    data: query.data
      ? {
          ...query.data,
          progress: realtimeProgress?.progress ?? query.data.progress,
          currentStep: realtimeProgress?.currentStep ?? query.data.currentStep,
          status: realtimeProgress?.status ?? query.data.status,
        }
      : undefined,
  };
}

