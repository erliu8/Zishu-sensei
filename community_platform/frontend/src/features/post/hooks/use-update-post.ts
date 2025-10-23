/**
 * 帖子数据层 - useUpdatePost Hook
 * @module features/post/hooks
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { postApiClient } from '../api';
import type { Post, UpdatePostDto } from '../domain';
import { updatePostSchema } from '../domain';
import { POST_QUERY_KEYS } from './query-keys';

interface UpdatePostParams {
  id: string;
  data: UpdatePostDto;
}

/**
 * 更新帖子 Hook
 * @returns 更新帖子 mutation 结果
 */
export function useUpdatePost(): UseMutationResult<Post, Error, UpdatePostParams> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdatePostParams) => {
      // 验证数据
      const validatedData = updatePostSchema.parse(data);
      return postApiClient.updatePost(id, validatedData);
    },
    onMutate: async ({ id, data }) => {
      // 取消正在进行的查询，避免覆盖我们的乐观更新
      await queryClient.cancelQueries({ queryKey: POST_QUERY_KEYS.detail(id) });

      // 保存之前的数据用于回滚
      const previousPost = queryClient.getQueryData<Post>(POST_QUERY_KEYS.detail(id));

      // 乐观更新
      if (previousPost) {
        queryClient.setQueryData<Post>(POST_QUERY_KEYS.detail(id), {
          ...previousPost,
          ...data,
          updatedAt: new Date().toISOString(),
        });
      }

      return { previousPost };
    },
    onSuccess: (updatedPost) => {
      // 更新缓存中的帖子数据
      queryClient.setQueryData(POST_QUERY_KEYS.detail(updatedPost.id), updatedPost);
      
      // 使帖子列表缓存失效
      queryClient.invalidateQueries({ queryKey: POST_QUERY_KEYS.lists() });
      
      toast.success('帖子更新成功！');
    },
    onError: (error, { id }, context) => {
      // 回滚到之前的数据
      if (context?.previousPost) {
        queryClient.setQueryData(POST_QUERY_KEYS.detail(id), context.previousPost);
      }
      
      console.error('更新帖子失败:', error);
      toast.error(error.message || '更新帖子失败，请稍后重试');
    },
    onSettled: (_, __, { id }) => {
      // 确保数据是最新的
      queryClient.invalidateQueries({ queryKey: POST_QUERY_KEYS.detail(id) });
    },
  });
}

