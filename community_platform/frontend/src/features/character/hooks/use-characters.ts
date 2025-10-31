/**
 * 角色相关的 TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { characterApi } from '../api';
import type {
  CreateCharacterInput,
  UpdateCharacterInput,
  PublishCharacterInput,
  CharacterFilters,
} from '../domain';

/**
 * Query Keys
 */
export const characterKeys = {
  all: ['characters'] as const,
  lists: () => [...characterKeys.all, 'list'] as const,
  list: (filters?: CharacterFilters) =>
    [...characterKeys.lists(), filters] as const,
  details: () => [...characterKeys.all, 'detail'] as const,
  detail: (id: number) => [...characterKeys.details(), id] as const,
  my: () => [...characterKeys.all, 'my'] as const,
  featured: () => [...characterKeys.all, 'featured'] as const,
  trending: () => [...characterKeys.all, 'trending'] as const,
};

/**
 * 获取角色列表
 */
export function useCharacters(filters?: CharacterFilters) {
  return useQuery({
    queryKey: characterKeys.list(filters),
    queryFn: () => characterApi.getCharacters(filters),
    staleTime: 1000 * 60 * 5, // 5分钟
  });
}

/**
 * 获取单个角色详情
 */
export function useCharacter(id: number, enabled: boolean = true) {
  return useQuery({
    queryKey: characterKeys.detail(id),
    queryFn: () => characterApi.getCharacter(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5, // 5分钟
  });
}

/**
 * 获取我的角色列表
 */
export function useMyCharacters(filters?: CharacterFilters) {
  return useQuery({
    queryKey: characterKeys.my(),
    queryFn: () => characterApi.getMyCharacters(filters),
    staleTime: 1000 * 60 * 2, // 2分钟
  });
}

/**
 * 获取推荐角色
 */
export function useFeaturedCharacters(limit: number = 10) {
  return useQuery({
    queryKey: characterKeys.featured(),
    queryFn: () => characterApi.getFeaturedCharacters(limit),
    staleTime: 1000 * 60 * 10, // 10分钟
  });
}

/**
 * 获取热门角色
 */
export function useTrendingCharacters(limit: number = 10) {
  return useQuery({
    queryKey: characterKeys.trending(),
    queryFn: () => characterApi.getTrendingCharacters(limit),
    staleTime: 1000 * 60 * 10, // 10分钟
  });
}

/**
 * 创建角色
 */
export function useCreateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCharacterInput) =>
      characterApi.createCharacter(input),
    onSuccess: (newCharacter) => {
      // 更新角色列表缓存
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.my() });

      // 设置新角色详情缓存
      queryClient.setQueryData(
        characterKeys.detail(newCharacter.id),
        newCharacter
      );
    },
  });
}

/**
 * 更新角色
 */
export function useUpdateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: UpdateCharacterInput;
    }) => characterApi.updateCharacter(id, input),
    onSuccess: (updatedCharacter) => {
      // 更新角色详情缓存
      queryClient.setQueryData(
        characterKeys.detail(updatedCharacter.id),
        updatedCharacter
      );

      // 更新列表缓存
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.my() });
    },
  });
}

/**
 * 删除角色
 */
export function useDeleteCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => characterApi.deleteCharacter(id),
    onSuccess: (_, deletedId) => {
      // 移除角色详情缓存
      queryClient.removeQueries({ queryKey: characterKeys.detail(deletedId) });

      // 更新列表缓存
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.my() });
    },
  });
}

/**
 * 发布角色
 */
export function usePublishCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input?: PublishCharacterInput;
    }) => characterApi.publishCharacter(id, input),
    onSuccess: (publishedCharacter) => {
      // 更新角色详情缓存
      queryClient.setQueryData(
        characterKeys.detail(publishedCharacter.id),
        publishedCharacter
      );

      // 更新列表缓存
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.my() });
      queryClient.invalidateQueries({ queryKey: characterKeys.featured() });
    },
  });
}

/**
 * 取消发布角色
 */
export function useUnpublishCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => characterApi.unpublishCharacter(id),
    onSuccess: (unpublishedCharacter) => {
      // 更新角色详情缓存
      queryClient.setQueryData(
        characterKeys.detail(unpublishedCharacter.id),
        unpublishedCharacter
      );

      // 更新列表缓存
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.my() });
    },
  });
}

/**
 * 归档角色
 */
export function useArchiveCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => characterApi.archiveCharacter(id),
    onSuccess: (archivedCharacter) => {
      // 更新角色详情缓存
      queryClient.setQueryData(
        characterKeys.detail(archivedCharacter.id),
        archivedCharacter
      );

      // 更新列表缓存
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.my() });
    },
  });
}

/**
 * 克隆角色
 */
export function useCloneCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => characterApi.cloneCharacter(id),
    onSuccess: (clonedCharacter) => {
      // 设置克隆角色详情缓存
      queryClient.setQueryData(
        characterKeys.detail(clonedCharacter.id),
        clonedCharacter
      );

      // 更新列表缓存
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
      queryClient.invalidateQueries({ queryKey: characterKeys.my() });
    },
  });
}

