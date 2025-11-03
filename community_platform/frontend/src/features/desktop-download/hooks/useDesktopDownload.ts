/**
 * 桌面应用下载相关 Hooks
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { desktopDownloadApiClient } from '../api/client';
import type {
  CreatePackagingTaskRequest,
} from '../api/types';
import { useToast } from '@/shared/hooks/use-toast';

/**
 * 创建打包任务
 */
export function useCreatePackagingTask() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (request: CreatePackagingTaskRequest) => {
      return await desktopDownloadApiClient.createPackagingTask(request);
    },
    onSuccess: () => {
      toast({
        title: '打包任务已创建',
        description: '正在为你打包桌面应用，请稍候...',
      });
    },
    onError: (error: any) => {
      toast({
        title: '创建打包任务失败',
        description: error?.message || '请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 获取打包任务详情
 */
export function usePackagingTask(taskId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['packaging-task', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      return await desktopDownloadApiClient.getTask(taskId);
    },
    enabled: enabled && !!taskId,
    refetchInterval: (query) => {
      // 如果任务还在进行中，每2秒轮询一次
      const status = query.state.data?.data?.status;
      if (status === 'pending' || status === 'packaging') {
        return 2000;
      }
      return false;
    },
  });
}

/**
 * 获取打包任务状态（轻量级轮询）
 */
export function usePackagingTaskStatus(taskId: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['packaging-task-status', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      return await desktopDownloadApiClient.getTaskStatus(taskId);
    },
    enabled: enabled && !!taskId,
    refetchInterval: (query) => {
      // 如果任务还在进行中，每2秒轮询一次
      const status = query.state.data?.data?.status;
      if (status === 'pending' || status === 'packaging') {
        return 2000;
      }
      return false;
    },
  });
}

/**
 * 取消打包任务
 */
export function useCancelPackagingTask() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskId: string) => {
      return await desktopDownloadApiClient.cancelTask(taskId);
    },
    onSuccess: () => {
      toast({
        title: '已取消打包任务',
      });
    },
    onError: (error: any) => {
      toast({
        title: '取消任务失败',
        description: error?.message || '请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 获取用户的打包任务列表
 */
export function useUserPackagingTasks(page: number = 1, size: number = 20) {
  return useQuery({
    queryKey: ['user-packaging-tasks', page, size],
    queryFn: async () => {
      return await desktopDownloadApiClient.getUserTasks(page, size);
    },
  });
}

