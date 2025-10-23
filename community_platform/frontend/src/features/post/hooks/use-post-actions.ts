/**
 * 帖子数据层 - usePostActions Hooks (点赞、收藏等)
 * @module features/post/hooks
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';
import { postApiClient } from '../api';
import type { Post } from '../domain';
import { POST_QUERY_KEYS } from './query-keys';

/**
 * 点赞帖子 Hook
 * @returns 点赞帖子 mutation 结果
 */
export function useLikePost(): UseMutationResult<Post, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => postApiClient.likePost(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: POST_QUERY_KEYS.detail(id) });
      
      const previousPost = queryClient.getQueryData<Post>(POST_QUERY_KEYS.detail(id));
      
      if (previousPost) {
        queryClient.setQueryData<Post>(POST_QUERY_KEYS.detail(id), {
          ...previousPost,
          isLikedByCurrentUser: true,
          stats: {
            ...previousPost.stats,
            likeCount: previousPost.stats.likeCount + 1,
          },
        });
      }
      
      return { previousPost };
    },
    onError: (error, id, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(POST_QUERY_KEYS.detail(id), context.previousPost);
      }
      toast.error('点赞失败');
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: POST_QUERY_KEYS.detail(id) });
    },
  });
}

/**
 * 取消点赞帖子 Hook
 * @returns 取消点赞帖子 mutation 结果
 */
export function useUnlikePost(): UseMutationResult<Post, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => postApiClient.unlikePost(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: POST_QUERY_KEYS.detail(id) });
      
      const previousPost = queryClient.getQueryData<Post>(POST_QUERY_KEYS.detail(id));
      
      if (previousPost) {
        queryClient.setQueryData<Post>(POST_QUERY_KEYS.detail(id), {
          ...previousPost,
          isLikedByCurrentUser: false,
          stats: {
            ...previousPost.stats,
            likeCount: Math.max(0, previousPost.stats.likeCount - 1),
          },
        });
      }
      
      return { previousPost };
    },
    onError: (error, id, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(POST_QUERY_KEYS.detail(id), context.previousPost);
      }
      toast.error('取消点赞失败');
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: POST_QUERY_KEYS.detail(id) });
    },
  });
}

/**
 * 收藏帖子 Hook
 * @returns 收藏帖子 mutation 结果
 */
export function useFavoritePost(): UseMutationResult<Post, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => postApiClient.favoritePost(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: POST_QUERY_KEYS.detail(id) });
      
      const previousPost = queryClient.getQueryData<Post>(POST_QUERY_KEYS.detail(id));
      
      if (previousPost) {
        queryClient.setQueryData<Post>(POST_QUERY_KEYS.detail(id), {
          ...previousPost,
          isFavoritedByCurrentUser: true,
          stats: {
            ...previousPost.stats,
            favoriteCount: previousPost.stats.favoriteCount + 1,
          },
        });
      }
      
      return { previousPost };
    },
    onSuccess: () => {
      toast.success('收藏成功');
    },
    onError: (error, id, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(POST_QUERY_KEYS.detail(id), context.previousPost);
      }
      toast.error('收藏失败');
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: POST_QUERY_KEYS.detail(id) });
    },
  });
}

/**
 * 取消收藏帖子 Hook
 * @returns 取消收藏帖子 mutation 结果
 */
export function useUnfavoritePost(): UseMutationResult<Post, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => postApiClient.unfavoritePost(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: POST_QUERY_KEYS.detail(id) });
      
      const previousPost = queryClient.getQueryData<Post>(POST_QUERY_KEYS.detail(id));
      
      if (previousPost) {
        queryClient.setQueryData<Post>(POST_QUERY_KEYS.detail(id), {
          ...previousPost,
          isFavoritedByCurrentUser: false,
          stats: {
            ...previousPost.stats,
            favoriteCount: Math.max(0, previousPost.stats.favoriteCount - 1),
          },
        });
      }
      
      return { previousPost };
    },
    onSuccess: () => {
      toast.success('取消收藏成功');
    },
    onError: (error, id, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(POST_QUERY_KEYS.detail(id), context.previousPost);
      }
      toast.error('取消收藏失败');
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: POST_QUERY_KEYS.detail(id) });
    },
  });
}

/**
 * 切换点赞状态 Hook
 * @returns 切换点赞状态函数
 */
export function useToggleLike() {
  const likePost = useLikePost();
  const unlikePost = useUnlikePost();

  return {
    toggle: (id: string, isLiked: boolean) => {
      if (isLiked) {
        return unlikePost.mutateAsync(id);
      } else {
        return likePost.mutateAsync(id);
      }
    },
    isLoading: likePost.isPending || unlikePost.isPending,
  };
}

/**
 * 切换收藏状态 Hook
 * @returns 切换收藏状态函数
 */
export function useToggleFavorite() {
  const favoritePost = useFavoritePost();
  const unfavoritePost = useUnfavoritePost();

  return {
    toggle: (id: string, isFavorited: boolean) => {
      if (isFavorited) {
        return unfavoritePost.mutateAsync(id);
      } else {
        return favoritePost.mutateAsync(id);
      }
    },
    isLoading: favoritePost.isPending || unfavoritePost.isPending,
  };
}

