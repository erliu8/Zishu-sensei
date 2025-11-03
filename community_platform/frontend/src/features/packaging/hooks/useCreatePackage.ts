/**
 * useCreatePackage Hook
 * 创建打包任务的 Hook
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { packagingApiClient } from '../api/PackagingApiClient';
import type { CreatePackageInput } from '../domain/packaging.types';
import { useToast } from '@/shared/components/ui/use-toast';
import { packagingKeys } from './query-keys';

/**
 * 创建打包任务
 */
export function useCreatePackage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: CreatePackageInput) => packagingApiClient.createPackage(input),
    onSuccess: (response) => {
      // 使任务列表失效
      queryClient.invalidateQueries({ queryKey: packagingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: packagingKeys.stats() });

      toast({
        title: '打包任务创建成功',
        description: `任务 ID: ${response.data.id}`,
      });

      return response.data;
    },
    onError: (error: any) => {
      console.error('Packaging error:', error);
      
      // 提取错误信息
      let errorMessage = '操作失败，请稍后重试';
      
      if (error?.response?.data?.error?.message) {
        // 后端返回的具体错误信息
        errorMessage = error.response.data.error.message;
      } else if (error?.response?.status === 401) {
        // 401认证错误
        errorMessage = '请先登录后再使用打包功能';
      } else if (error?.message) {
        // axios错误信息
        errorMessage = error.message;
      }
      
      toast({
        title: '创建打包任务失败',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });
}

