/**
 * 帖子数据层 - useCreatePost Hook
 * @module features/post/hooks
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from '@/shared/components/ui/use-toast';
import { postApiClient } from '../api';
import type { Post, CreatePostDto } from '../domain';
import { createPostSchema } from '../domain';
import { POST_QUERY_KEYS } from './query-keys';

/**
 * 创建帖子 Hook
 * @returns 创建帖子 mutation 结果
 */
export function useCreatePost(): UseMutationResult<Post, Error, CreatePostDto> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePostDto) => {
      // 验证数据
      const validatedData = createPostSchema.parse(data);
      return postApiClient.createPost(validatedData);
    },
    onSuccess: (newPost) => {
      // 使帖子列表缓存失效
      queryClient.invalidateQueries({ queryKey: POST_QUERY_KEYS.all });
      
      // 乐观更新：将新帖子添加到缓存中
      queryClient.setQueryData(POST_QUERY_KEYS.detail(newPost.id), newPost);
      
      toast({
        title: '帖子创建成功！',
        variant: 'default',
      });
    },
    onError: (error) => {
      console.error('创建帖子失败:', error);
      toast({
        title: '创建帖子失败',
        description: error.message || '请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

