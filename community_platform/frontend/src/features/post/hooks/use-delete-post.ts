/**
 * 帖子数据层 - useDeletePost Hook
 * @module features/post/hooks
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from '@/shared/components/ui/use-toast';
import { postApiClient } from '../api';
import { POST_QUERY_KEYS } from './query-keys';

/**
 * 删除帖子 Hook
 * @returns 删除帖子 mutation 结果
 */
export function useDeletePost(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => postApiClient.deletePost(id),
    onSuccess: (_, deletedId) => {
      // 移除缓存中的帖子数据
      queryClient.removeQueries({ queryKey: POST_QUERY_KEYS.detail(deletedId) });
      
      // 使帖子列表缓存失效
      queryClient.invalidateQueries({ queryKey: POST_QUERY_KEYS.lists() });
      
      toast({
        title: '帖子删除成功！',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('删除帖子失败:', error);
      toast({
        title: '删除帖子失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

