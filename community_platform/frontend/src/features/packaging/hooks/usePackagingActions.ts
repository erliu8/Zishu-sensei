/**
 * usePackagingActions Hook
 * 打包任务操作的 Hooks
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { packagingApiClient } from '../api/PackagingApiClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { packagingKeys } from './query-keys';
import { isDesktopApp, downloadCharacterToDesktop } from '@/shared/utils/desktop';

/**
 * 取消打包任务
 */
export function useCancelPackage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (taskId: string) => packagingApiClient.cancelTask(taskId),
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: packagingKeys.task(taskId) });
      queryClient.invalidateQueries({ queryKey: packagingKeys.lists() });

      toast({
        title: '任务已取消',
        description: '打包任务已成功取消',
      });
    },
    onError: (error: any) => {
      toast({
        title: '取消失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 删除打包任务
 */
export function useDeletePackage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (taskId: string) => packagingApiClient.deleteTask(taskId),
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: packagingKeys.task(taskId) });
      queryClient.invalidateQueries({ queryKey: packagingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: packagingKeys.stats() });

      toast({
        title: '任务已删除',
        description: '打包任务已成功删除',
      });
    },
    onError: (error: any) => {
      toast({
        title: '删除失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 重试打包任务
 */
export function useRetryPackage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (taskId: string) => packagingApiClient.retryTask(taskId),
    onSuccess: (response, taskId) => {
      queryClient.invalidateQueries({ queryKey: packagingKeys.task(taskId) });
      queryClient.invalidateQueries({ queryKey: packagingKeys.lists() });

      toast({
        title: '任务重试成功',
        description: '打包任务已重新启动',
      });

      return response.data;
    },
    onError: (error: any) => {
      toast({
        title: '重试失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 批量删除打包任务
 */
export function useBulkDeletePackages() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (taskIds: string[]) => packagingApiClient.bulkDeleteTasks(taskIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: packagingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: packagingKeys.stats() });

      const { successCount, failedIds } = response.data;
      
      if (failedIds.length === 0) {
        toast({
          title: '批量删除成功',
          description: `成功删除 ${successCount} 个任务`,
        });
      } else {
        toast({
          title: '部分删除成功',
          description: `成功删除 ${successCount} 个任务，${failedIds.length} 个失败`,
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: '批量删除失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 获取下载链接
 */
export function useGetDownloadUrl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, characterName }: { taskId: string; characterName?: string }) => {
      const response = await packagingApiClient.getDownloadUrl(taskId);
      return { ...response, taskId, characterName };
    },
    onSuccess: (response) => {
      const { downloadUrl } = response.data;
      const taskId = response.taskId;
      const characterName = response.characterName || 'character';
      
      // 检测是否在桌面应用中
      if (isDesktopApp()) {
        console.log('[Desktop] 使用深度链接下载到桌面应用');
        
        // 使用深度链接调用桌面应用
        downloadCharacterToDesktop(taskId, characterName, downloadUrl);
        
        // 显示提示
        toast({
          title: '开始下载',
          description: `正在将 ${characterName} 下载到桌面应用...`,
        });
      } else {
        // 浏览器环境，使用传统下载方式
        console.log('[Browser] 使用浏览器下载');
        window.open(downloadUrl, '_blank');
        
        toast({
          title: '开始下载',
          description: '文件开始下载，请查看浏览器下载管理器',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: '获取下载链接失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

