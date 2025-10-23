/**
 * 适配器分类相关 Hooks
 * @module features/adapter/hooks
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { adapterCategoryApiClient, type CreateCategoryInput, type UpdateCategoryInput } from '../api';
import type { AdapterCategory } from '../domain';

/**
 * 适配器分类查询键工厂
 */
export const adapterCategoryKeys = {
  all: ['adapter-categories'] as const,
  lists: () => [...adapterCategoryKeys.all, 'list'] as const,
  list: (includeCount?: boolean) => [...adapterCategoryKeys.lists(), includeCount] as const,
  tree: () => [...adapterCategoryKeys.all, 'tree'] as const,
  details: () => [...adapterCategoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...adapterCategoryKeys.details(), id] as const,
  bySlug: (slug: string) => [...adapterCategoryKeys.all, 'by-slug', slug] as const,
  children: (parentId: string) => [...adapterCategoryKeys.all, 'children', parentId] as const,
  root: () => [...adapterCategoryKeys.all, 'root'] as const,
  popular: (limit?: number) => [...adapterCategoryKeys.all, 'popular', limit] as const,
};

/**
 * 获取所有分类
 */
export function useAdapterCategories(
  includeCount: boolean = true,
  options?: Omit<UseQueryOptions<AdapterCategory[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterCategoryKeys.list(includeCount),
    queryFn: () => adapterCategoryApiClient.getCategories(includeCount),
    ...options,
  });
}

/**
 * 获取分类树
 */
export function useAdapterCategoryTree(
  options?: Omit<UseQueryOptions<AdapterCategory[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterCategoryKeys.tree(),
    queryFn: () => adapterCategoryApiClient.getCategoryTree(),
    ...options,
  });
}

/**
 * 获取单个分类详情
 */
export function useAdapterCategory(
  id: string,
  options?: Omit<UseQueryOptions<AdapterCategory>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterCategoryKeys.detail(id),
    queryFn: () => adapterCategoryApiClient.getCategory(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * 根据slug获取分类
 */
export function useAdapterCategoryBySlug(
  slug: string,
  options?: Omit<UseQueryOptions<AdapterCategory>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterCategoryKeys.bySlug(slug),
    queryFn: () => adapterCategoryApiClient.getCategoryBySlug(slug),
    enabled: !!slug,
    ...options,
  });
}

/**
 * 创建分类
 */
export function useCreateAdapterCategory(
  options?: UseMutationOptions<AdapterCategory, Error, CreateCategoryInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryInput) => adapterCategoryApiClient.createCategory(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adapterCategoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adapterCategoryKeys.tree() });
      queryClient.setQueryData(adapterCategoryKeys.detail(data.id), data);
    },
    ...options,
  });
}

/**
 * 更新分类
 */
export function useUpdateAdapterCategory(
  options?: UseMutationOptions<AdapterCategory, Error, UpdateCategoryInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCategoryInput) =>
      adapterCategoryApiClient.updateCategory(data.id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adapterCategoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adapterCategoryKeys.tree() });
      queryClient.setQueryData(adapterCategoryKeys.detail(data.id), data);
    },
    ...options,
  });
}

/**
 * 删除分类
 */
export function useDeleteAdapterCategory(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adapterCategoryApiClient.deleteCategory(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: adapterCategoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adapterCategoryKeys.tree() });
      queryClient.removeQueries({ queryKey: adapterCategoryKeys.detail(id) });
    },
    ...options,
  });
}

/**
 * 获取子分类
 */
export function useChildCategories(
  parentId: string,
  options?: Omit<UseQueryOptions<AdapterCategory[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterCategoryKeys.children(parentId),
    queryFn: () => adapterCategoryApiClient.getChildCategories(parentId),
    enabled: !!parentId,
    ...options,
  });
}

/**
 * 获取顶级分类
 */
export function useRootCategories(
  options?: Omit<UseQueryOptions<AdapterCategory[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterCategoryKeys.root(),
    queryFn: () => adapterCategoryApiClient.getRootCategories(),
    ...options,
  });
}

/**
 * 更新分类排序
 */
export function useUpdateCategoryOrder(
  options?: UseMutationOptions<void, Error, string[]>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryIds: string[]) =>
      adapterCategoryApiClient.updateCategoryOrder(categoryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adapterCategoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adapterCategoryKeys.tree() });
    },
    ...options,
  });
}

/**
 * 获取热门分类
 */
export function usePopularCategories(
  limit: number = 10,
  options?: Omit<UseQueryOptions<AdapterCategory[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterCategoryKeys.popular(limit),
    queryFn: () => adapterCategoryApiClient.getPopularCategories(limit),
    ...options,
  });
}

