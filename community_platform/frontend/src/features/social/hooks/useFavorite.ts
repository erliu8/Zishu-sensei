/**
 * Favorite Hooks
 * 收藏相关的 React Query Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { favoriteApiClient } from '../api/FavoriteApiClient';
import type {
  CreateFavoriteInput,
  UpdateFavoriteInput,
  FavoriteQueryParams,
  FavoriteTargetType,
  CreateCollectionInput,
} from '../domain/Favorite';
import { useToast } from '@/shared/components/ui/use-toast';

/**
 * Query Keys
 */
export const favoriteKeys = {
  all: ['favorites'] as const,
  lists: () => [...favoriteKeys.all, 'list'] as const,
  list: (params: FavoriteQueryParams) => [...favoriteKeys.lists(), params] as const,
  stats: (targetType: FavoriteTargetType, targetId: string) => 
    [...favoriteKeys.all, 'stats', targetType, targetId] as const,
  check: (targetType: FavoriteTargetType, targetId: string) => 
    [...favoriteKeys.all, 'check', targetType, targetId] as const,
  userFavorites: (userId: string, targetType?: FavoriteTargetType) => 
    [...favoriteKeys.all, 'user', userId, targetType] as const,
  collections: (userId?: string) => 
    [...favoriteKeys.all, 'collections', userId] as const,
  collection: (id: string) => 
    [...favoriteKeys.all, 'collection', id] as const,
  collectionItems: (collectionId: string) => 
    [...favoriteKeys.all, 'collectionItems', collectionId] as const,
};

/**
 * 添加收藏
 */
export function useAddFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: CreateFavoriteInput) => favoriteApiClient.addFavorite(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: favoriteKeys.check(variables.targetType, variables.targetId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: favoriteKeys.stats(variables.targetType, variables.targetId) 
      });
      queryClient.invalidateQueries({ queryKey: favoriteKeys.userFavorites('current') });
      
      toast({
        title: '收藏成功',
        description: '已添加到收藏',
      });
    },
    onError: (error: any) => {
      toast({
        title: '收藏失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 移除收藏
 */
export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: FavoriteTargetType; targetId: string }) => 
      favoriteApiClient.removeFavorite(targetType, targetId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: favoriteKeys.check(variables.targetType, variables.targetId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: favoriteKeys.stats(variables.targetType, variables.targetId) 
      });
      queryClient.invalidateQueries({ queryKey: favoriteKeys.userFavorites('current') });
      
      toast({
        title: '已取消收藏',
        description: '已从收藏中移除',
      });
    },
    onError: (error: any) => {
      toast({
        title: '操作失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 更新收藏
 */
export function useUpdateFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: UpdateFavoriteInput) => favoriteApiClient.updateFavorite(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.lists() });
      
      toast({
        title: '更新成功',
        description: '收藏信息已更新',
      });
    },
    onError: (error: any) => {
      toast({
        title: '更新失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 检查是否已收藏
 */
export function useCheckFavorited(
  targetType: FavoriteTargetType,
  targetId: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: favoriteKeys.check(targetType, targetId),
    queryFn: async () => {
      const response = await favoriteApiClient.checkFavorited(targetType, targetId);
      return response.data;
    },
    enabled: enabled && !!targetType && !!targetId,
    staleTime: 30 * 1000,
  });
}

/**
 * 获取收藏统计
 */
export function useFavoriteStats(
  targetType: FavoriteTargetType,
  targetId: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: favoriteKeys.stats(targetType, targetId),
    queryFn: async () => {
      const response = await favoriteApiClient.getFavoriteStats(targetType, targetId);
      return response.data;
    },
    enabled: enabled && !!targetType && !!targetId,
    staleTime: 30 * 1000,
  });
}

/**
 * 获取收藏列表
 */
export function useFavorites(params: FavoriteQueryParams) {
  return useQuery({
    queryKey: favoriteKeys.list(params),
    queryFn: async () => {
      const response = await favoriteApiClient.getFavorites(params);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 获取用户的收藏列表
 */
export function useUserFavorites(
  userId: string,
  targetType?: FavoriteTargetType,
  page: number = 1,
  pageSize: number = 20
) {
  return useQuery({
    queryKey: favoriteKeys.userFavorites(userId, targetType),
    queryFn: async () => {
      const response = await favoriteApiClient.getUserFavorites(userId, targetType, page, pageSize);
      return response.data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 切换收藏状态
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: CreateFavoriteInput) => favoriteApiClient.toggleFavorite(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ 
        queryKey: favoriteKeys.stats(input.targetType, input.targetId) 
      });

      const previousStats = queryClient.getQueryData(
        favoriteKeys.stats(input.targetType, input.targetId)
      );

      queryClient.setQueryData(
        favoriteKeys.stats(input.targetType, input.targetId),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            isFavorited: !old.isFavorited,
            favoriteCount: old.isFavorited ? old.favoriteCount - 1 : old.favoriteCount + 1,
          };
        }
      );

      return { previousStats };
    },
    onError: (error: any, input, context) => {
      if (context?.previousStats) {
        queryClient.setQueryData(
          favoriteKeys.stats(input.targetType, input.targetId),
          context.previousStats
        );
      }
      
      toast({
        title: '操作失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: favoriteKeys.stats(variables.targetType, variables.targetId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: favoriteKeys.check(variables.targetType, variables.targetId) 
      });
    },
  });
}

/**
 * 移动收藏到其他收藏夹
 */
export function useMoveFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ favoriteId, collectionId }: { favoriteId: string; collectionId: string }) => 
      favoriteApiClient.moveFavorite(favoriteId, collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: favoriteKeys.collections() });
      
      toast({
        title: '移动成功',
        description: '已移动到指定收藏夹',
      });
    },
    onError: (error: any) => {
      toast({
        title: '移动失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

// ==================== 收藏夹相关 Hooks ====================

/**
 * 创建收藏夹
 */
export function useCreateCollection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (input: CreateCollectionInput) => favoriteApiClient.createCollection(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.collections() });
      
      toast({
        title: '创建成功',
        description: '收藏夹已创建',
      });
    },
    onError: (error: any) => {
      toast({
        title: '创建失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 更新收藏夹
 */
export function useUpdateCollection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateCollectionInput> }) => 
      favoriteApiClient.updateCollection(id, input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.collections() });
      queryClient.invalidateQueries({ queryKey: favoriteKeys.collection(variables.id) });
      
      toast({
        title: '更新成功',
        description: '收藏夹信息已更新',
      });
    },
    onError: (error: any) => {
      toast({
        title: '更新失败',
        description: error?.message || '操作失败，请稍后重试',
        variant: 'destructive',
      });
    },
  });
}

/**
 * 删除收藏夹
 */
export function useDeleteCollection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => favoriteApiClient.deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.collections() });
      
      toast({
        title: '删除成功',
        description: '收藏夹已删除',
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
 * 获取收藏夹列表
 */
export function useCollections(userId?: string) {
  return useQuery({
    queryKey: favoriteKeys.collections(userId),
    queryFn: async () => {
      const response = await favoriteApiClient.getCollections(userId);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 获取收藏夹详情
 */
export function useCollection(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: favoriteKeys.collection(id),
    queryFn: async () => {
      const response = await favoriteApiClient.getCollection(id);
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 获取收藏夹中的收藏项
 */
export function useCollectionItems(
  collectionId: string,
  page: number = 1,
  pageSize: number = 20,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: favoriteKeys.collectionItems(collectionId),
    queryFn: async () => {
      const response = await favoriteApiClient.getCollectionItems(collectionId, page, pageSize);
      return response.data;
    },
    enabled: enabled && !!collectionId,
    staleTime: 5 * 60 * 1000,
  });
}

