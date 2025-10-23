/**
 * Comment Hooks - TanStack Query
 * 评论相关 Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentApiClient } from '../api/comment.client';
import type {
  CommentListParams,
  CreateCommentDto,
  UpdateCommentDto,
} from '../domain/comment.types';
import { useToast } from '@/shared/hooks/use-toast';

// Query Keys
export const commentKeys = {
  all: ['comments'] as const,
  lists: () => [...commentKeys.all, 'list'] as const,
  list: (params: CommentListParams) =>
    [...commentKeys.lists(), params] as const,
  details: () => [...commentKeys.all, 'detail'] as const,
  detail: (id: string) => [...commentKeys.details(), id] as const,
  replies: (commentId: string) =>
    [...commentKeys.all, 'replies', commentId] as const,
  stats: (targetType: string, targetId: string) =>
    [...commentKeys.all, 'stats', targetType, targetId] as const,
};

/**
 * 获取评论列表
 */
export function useComments(params: CommentListParams) {
  return useQuery({
    queryKey: commentKeys.list(params),
    queryFn: () => commentApiClient.getComments(params),
    staleTime: 30000, // 30 seconds
  });
}

/**
 * 获取单个评论
 */
export function useComment(commentId: string) {
  return useQuery({
    queryKey: commentKeys.detail(commentId),
    queryFn: () => commentApiClient.getComment(commentId),
    enabled: !!commentId,
  });
}

/**
 * 获取评论的回复
 */
export function useCommentReplies(commentId: string, page = 1, pageSize = 10) {
  return useQuery({
    queryKey: [...commentKeys.replies(commentId), page, pageSize],
    queryFn: () => commentApiClient.getReplies(commentId, page, pageSize),
    enabled: !!commentId,
  });
}

/**
 * 获取评论统计
 */
export function useCommentStats(targetType: string, targetId: string) {
  return useQuery({
    queryKey: commentKeys.stats(targetType, targetId),
    queryFn: () => commentApiClient.getCommentStats(targetType, targetId),
    enabled: !!targetType && !!targetId,
  });
}

/**
 * 创建评论
 */
export function useCreateComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (dto: CreateCommentDto) => commentApiClient.createComment(dto),
    onSuccess: (_, variables) => {
      // 使评论列表缓存失效
      queryClient.invalidateQueries({
        queryKey: commentKeys.lists(),
      });

      // 如果是回复，使父评论的回复列表失效
      if (variables.parentId) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.replies(variables.parentId),
        });
      }

      // 使统计信息失效
      queryClient.invalidateQueries({
        queryKey: commentKeys.stats(variables.targetType, variables.targetId),
      });

      toast({
        title: '评论成功',
        description: '你的评论已发布',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: '评论失败',
        description: error.message || '发布评论时出错，请重试',
      });
    },
  });
}

/**
 * 更新评论
 */
export function useUpdateComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      commentId,
      dto,
    }: {
      commentId: string;
      dto: UpdateCommentDto;
    }) => commentApiClient.updateComment(commentId, dto),
    onSuccess: (data) => {
      // 更新评论详情缓存
      queryClient.setQueryData(commentKeys.detail(data.id), data);

      // 使评论列表缓存失效
      queryClient.invalidateQueries({
        queryKey: commentKeys.lists(),
      });

      toast({
        title: '更新成功',
        description: '评论已更新',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: '更新失败',
        description: error.message || '更新评论时出错，请重试',
      });
    },
  });
}

/**
 * 删除评论
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (commentId: string) => commentApiClient.deleteComment(commentId),
    onSuccess: () => {
      // 使所有评论相关缓存失效
      queryClient.invalidateQueries({
        queryKey: commentKeys.all,
      });

      toast({
        title: '删除成功',
        description: '评论已删除',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: error.message || '删除评论时出错，请重试',
      });
    },
  });
}

/**
 * 点赞评论
 */
export function useLikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => commentApiClient.likeComment(commentId),
    onSuccess: () => {
      // 使评论列表缓存失效以更新点赞数
      queryClient.invalidateQueries({
        queryKey: commentKeys.lists(),
      });
    },
  });
}

/**
 * 取消点赞
 */
export function useUnlikeComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) =>
      commentApiClient.unlikeComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: commentKeys.lists(),
      });
    },
  });
}

/**
 * 举报评论
 */
export function useReportComment() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      commentId,
      reason,
    }: {
      commentId: string;
      reason: string;
    }) => commentApiClient.reportComment(commentId, reason),
    onSuccess: () => {
      toast({
        title: '举报成功',
        description: '我们会尽快处理你的举报',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: '举报失败',
        description: error.message || '提交举报时出错，请重试',
      });
    },
  });
}

