/**
 * 适配器相关 Hooks
 * @module features/adapter/hooks
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { adapterApiClient } from '../api';
import type {
  Adapter,
  AdapterListResponse,
  AdapterQueryParams,
  CreateAdapterInput,
  UpdateAdapterInput,
  AdapterInstallStatus,
  AdapterSearchSuggestion,
} from '../domain';

/**
 * 适配器查询键工厂
 */
export const adapterKeys = {
  all: ['adapters'] as const,
  lists: () => [...adapterKeys.all, 'list'] as const,
  list: (params?: AdapterQueryParams) => [...adapterKeys.lists(), params] as const,
  details: () => [...adapterKeys.all, 'detail'] as const,
  detail: (id: string) => [...adapterKeys.details(), id] as const,
  featured: (limit?: number) => [...adapterKeys.all, 'featured', limit] as const,
  trending: (limit?: number) => [...adapterKeys.all, 'trending', limit] as const,
  latest: (limit?: number) => [...adapterKeys.all, 'latest', limit] as const,
  related: (id: string, limit?: number) => [...adapterKeys.all, 'related', id, limit] as const,
  search: (query: string, params?: AdapterQueryParams) => [...adapterKeys.all, 'search', query, params] as const,
  suggestions: (query: string, limit?: number) => [...adapterKeys.all, 'suggestions', query, limit] as const,
  userAdapters: (userId: string, params?: AdapterQueryParams) => [...adapterKeys.all, 'user', userId, params] as const,
  favorites: (params?: AdapterQueryParams) => [...adapterKeys.all, 'favorites', params] as const,
  installed: (params?: AdapterQueryParams) => [...adapterKeys.all, 'installed', params] as const,
  installStatus: (id: string) => [...adapterKeys.all, 'install-status', id] as const,
};

/**
 * 获取适配器列表
 */
export function useAdapters(
  params?: AdapterQueryParams,
  options?: Omit<UseQueryOptions<AdapterListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.list(params),
    queryFn: () => adapterApiClient.getAdapters(params),
    ...options,
  });
}

/**
 * 获取单个适配器详情
 */
export function useAdapter(
  id: string,
  options?: Omit<UseQueryOptions<Adapter>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.detail(id),
    queryFn: () => adapterApiClient.getAdapter(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * 创建适配器
 */
export function useCreateAdapter(
  options?: UseMutationOptions<Adapter, Error, CreateAdapterInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateAdapterInput) => adapterApiClient.createAdapter(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adapterKeys.lists() });
      queryClient.setQueryData(adapterKeys.detail(data.id), data);
    },
    ...options,
  });
}

/**
 * 更新适配器
 */
export function useUpdateAdapter(
  options?: UseMutationOptions<Adapter, Error, UpdateAdapterInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateAdapterInput) =>
      adapterApiClient.updateAdapter(data.id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adapterKeys.lists() });
      queryClient.setQueryData(adapterKeys.detail(data.id), data);
    },
    ...options,
  });
}

/**
 * 删除适配器
 */
export function useDeleteAdapter(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adapterApiClient.deleteAdapter(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: adapterKeys.lists() });
      queryClient.removeQueries({ queryKey: adapterKeys.detail(id) });
    },
    ...options,
  });
}

/**
 * 发布适配器
 */
export function usePublishAdapter(
  options?: UseMutationOptions<Adapter, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adapterApiClient.publishAdapter(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adapterKeys.lists() });
      queryClient.setQueryData(adapterKeys.detail(data.id), data);
    },
    ...options,
  });
}

/**
 * 下架适配器
 */
export function useArchiveAdapter(
  options?: UseMutationOptions<Adapter, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adapterApiClient.archiveAdapter(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adapterKeys.lists() });
      queryClient.setQueryData(adapterKeys.detail(data.id), data);
    },
    ...options,
  });
}

/**
 * 点赞适配器
 */
export function useLikeAdapter(
  options?: UseMutationOptions<Adapter, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adapterApiClient.likeAdapter(id),
    onSuccess: (data) => {
      queryClient.setQueryData(adapterKeys.detail(data.id), data);
    },
    ...options,
  });
}

/**
 * 取消点赞适配器
 */
export function useUnlikeAdapter(
  options?: UseMutationOptions<Adapter, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adapterApiClient.unlikeAdapter(id),
    onSuccess: (data) => {
      queryClient.setQueryData(adapterKeys.detail(data.id), data);
    },
    ...options,
  });
}

/**
 * 收藏适配器
 */
export function useFavoriteAdapter(
  options?: UseMutationOptions<Adapter, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adapterApiClient.favoriteAdapter(id),
    onSuccess: (data) => {
      queryClient.setQueryData(adapterKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: adapterKeys.favorites() });
    },
    ...options,
  });
}

/**
 * 取消收藏适配器
 */
export function useUnfavoriteAdapter(
  options?: UseMutationOptions<Adapter, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adapterApiClient.unfavoriteAdapter(id),
    onSuccess: (data) => {
      queryClient.setQueryData(adapterKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: adapterKeys.favorites() });
    },
    ...options,
  });
}

/**
 * 下载适配器
 */
export function useDownloadAdapter(
  options?: UseMutationOptions<string, Error, { id: string; version?: string }>
) {
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version?: string }) =>
      adapterApiClient.downloadAdapter(id, version),
    ...options,
  });
}

/**
 * 安装适配器
 */
export function useInstallAdapter(
  options?: UseMutationOptions<AdapterInstallStatus, Error, { id: string; version?: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version }: { id: string; version?: string }) =>
      adapterApiClient.installAdapter(id, version),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: adapterKeys.installStatus(id) });
      queryClient.invalidateQueries({ queryKey: adapterKeys.installed() });
    },
    ...options,
  });
}

/**
 * 卸载适配器
 */
export function useUninstallAdapter(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => adapterApiClient.uninstallAdapter(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: adapterKeys.installStatus(id) });
      queryClient.invalidateQueries({ queryKey: adapterKeys.installed() });
    },
    ...options,
  });
}

/**
 * 获取适配器安装状态
 */
export function useAdapterInstallStatus(
  id: string,
  options?: Omit<UseQueryOptions<AdapterInstallStatus>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.installStatus(id),
    queryFn: () => adapterApiClient.getInstallStatus(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * 增加浏览量
 */
export function useIncrementAdapterView(
  options?: UseMutationOptions<void, Error, string>
) {
  return useMutation({
    mutationFn: (id: string) => adapterApiClient.incrementViewCount(id),
    ...options,
  });
}

/**
 * 获取用户的适配器列表
 */
export function useUserAdapters(
  userId: string,
  params?: AdapterQueryParams,
  options?: Omit<UseQueryOptions<AdapterListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.userAdapters(userId, params),
    queryFn: () => adapterApiClient.getUserAdapters(userId, params),
    enabled: !!userId,
    ...options,
  });
}

/**
 * 获取推荐适配器
 */
export function useFeaturedAdapters(
  limit: number = 10,
  options?: Omit<UseQueryOptions<Adapter[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.featured(limit),
    queryFn: () => adapterApiClient.getFeaturedAdapters(limit),
    ...options,
  });
}

/**
 * 获取热门适配器
 */
export function useTrendingAdapters(
  limit: number = 10,
  options?: Omit<UseQueryOptions<Adapter[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.trending(limit),
    queryFn: () => adapterApiClient.getTrendingAdapters(limit),
    ...options,
  });
}

/**
 * 获取最新适配器
 */
export function useLatestAdapters(
  limit: number = 10,
  options?: Omit<UseQueryOptions<Adapter[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.latest(limit),
    queryFn: () => adapterApiClient.getLatestAdapters(limit),
    ...options,
  });
}

/**
 * 获取相关适配器
 */
export function useRelatedAdapters(
  id: string,
  limit: number = 5,
  options?: Omit<UseQueryOptions<Adapter[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.related(id, limit),
    queryFn: () => adapterApiClient.getRelatedAdapters(id, limit),
    enabled: !!id,
    ...options,
  });
}

/**
 * 搜索适配器
 */
export function useSearchAdapters(
  query: string,
  params?: Omit<AdapterQueryParams, 'search'>,
  options?: Omit<UseQueryOptions<AdapterListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.search(query, params),
    queryFn: () => adapterApiClient.searchAdapters(query, params),
    enabled: !!query && query.length >= 2,
    ...options,
  });
}

/**
 * 获取搜索建议
 */
export function useAdapterSearchSuggestions(
  query: string,
  limit: number = 10,
  options?: Omit<UseQueryOptions<AdapterSearchSuggestion[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.suggestions(query, limit),
    queryFn: () => adapterApiClient.getSearchSuggestions(query, limit),
    enabled: !!query && query.length >= 1,
    ...options,
  });
}

/**
 * 获取我收藏的适配器
 */
export function useMyFavoriteAdapters(
  params?: AdapterQueryParams,
  options?: Omit<UseQueryOptions<AdapterListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.favorites(params),
    queryFn: () => adapterApiClient.getMyFavoriteAdapters(params),
    ...options,
  });
}

/**
 * 获取我安装的适配器
 */
export function useMyInstalledAdapters(
  params?: AdapterQueryParams,
  options?: Omit<UseQueryOptions<AdapterListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterKeys.installed(params),
    queryFn: () => adapterApiClient.getMyInstalledAdapters(params),
    ...options,
  });
}

