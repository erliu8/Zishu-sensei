/**
 * 适配器版本相关 Hooks
 * @module features/adapter/hooks
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { adapterVersionApiClient } from '../api';
import type { AdapterVersion, CreateVersionInput } from '../domain';

/**
 * 适配器版本查询键工厂
 */
export const adapterVersionKeys = {
  all: ['adapter-versions'] as const,
  lists: (adapterId: string) => [...adapterVersionKeys.all, 'list', adapterId] as const,
  details: () => [...adapterVersionKeys.all, 'detail'] as const,
  detail: (adapterId: string, versionId: string) => [...adapterVersionKeys.details(), adapterId, versionId] as const,
  byNumber: (adapterId: string, versionNumber: string) => [...adapterVersionKeys.all, 'by-number', adapterId, versionNumber] as const,
  latest: (adapterId: string) => [...adapterVersionKeys.all, 'latest', adapterId] as const,
  compare: (adapterId: string, from: string, to: string) => [...adapterVersionKeys.all, 'compare', adapterId, from, to] as const,
};

/**
 * 获取适配器的所有版本
 */
export function useAdapterVersions(
  adapterId: string,
  options?: Omit<UseQueryOptions<AdapterVersion[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterVersionKeys.lists(adapterId),
    queryFn: () => adapterVersionApiClient.getVersions(adapterId),
    enabled: !!adapterId,
    ...options,
  });
}

/**
 * 获取单个版本详情
 */
export function useAdapterVersion(
  adapterId: string,
  versionId: string,
  options?: Omit<UseQueryOptions<AdapterVersion>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterVersionKeys.detail(adapterId, versionId),
    queryFn: () => adapterVersionApiClient.getVersion(adapterId, versionId),
    enabled: !!adapterId && !!versionId,
    ...options,
  });
}

/**
 * 根据版本号获取版本详情
 */
export function useAdapterVersionByNumber(
  adapterId: string,
  versionNumber: string,
  options?: Omit<UseQueryOptions<AdapterVersion>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterVersionKeys.byNumber(adapterId, versionNumber),
    queryFn: () => adapterVersionApiClient.getVersionByNumber(adapterId, versionNumber),
    enabled: !!adapterId && !!versionNumber,
    ...options,
  });
}

/**
 * 获取最新版本
 */
export function useLatestAdapterVersion(
  adapterId: string,
  options?: Omit<UseQueryOptions<AdapterVersion>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterVersionKeys.latest(adapterId),
    queryFn: () => adapterVersionApiClient.getLatestVersion(adapterId),
    enabled: !!adapterId,
    ...options,
  });
}

/**
 * 创建新版本
 */
export function useCreateAdapterVersion(
  options?: UseMutationOptions<AdapterVersion, Error, CreateVersionInput>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVersionInput) => adapterVersionApiClient.createVersion(data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterVersionKeys.lists(variables.adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterVersionKeys.latest(variables.adapterId) 
      });
      queryClient.setQueryData(
        adapterVersionKeys.detail(variables.adapterId, data.id),
        data
      );
    },
    ...options,
  });
}

/**
 * 删除版本
 */
export function useDeleteAdapterVersion(
  options?: UseMutationOptions<void, Error, { adapterId: string; versionId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, versionId }) =>
      adapterVersionApiClient.deleteVersion(adapterId, versionId),
    onSuccess: (_, { adapterId, versionId }) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterVersionKeys.lists(adapterId) 
      });
      queryClient.removeQueries({ 
        queryKey: adapterVersionKeys.detail(adapterId, versionId) 
      });
    },
    ...options,
  });
}

/**
 * 设置为稳定版本
 */
export function useMarkVersionAsStable(
  options?: UseMutationOptions<AdapterVersion, Error, { adapterId: string; versionId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, versionId }) =>
      adapterVersionApiClient.markAsStable(adapterId, versionId),
    onSuccess: (data, { adapterId }) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterVersionKeys.lists(adapterId) 
      });
      queryClient.setQueryData(
        adapterVersionKeys.detail(adapterId, data.id),
        data
      );
    },
    ...options,
  });
}

/**
 * 设置为最新版本
 */
export function useMarkVersionAsLatest(
  options?: UseMutationOptions<AdapterVersion, Error, { adapterId: string; versionId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, versionId }) =>
      adapterVersionApiClient.markAsLatest(adapterId, versionId),
    onSuccess: (data, { adapterId }) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterVersionKeys.lists(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterVersionKeys.latest(adapterId) 
      });
      queryClient.setQueryData(
        adapterVersionKeys.detail(adapterId, data.id),
        data
      );
    },
    ...options,
  });
}

/**
 * 下载版本文件
 */
export function useDownloadAdapterVersion(
  options?: UseMutationOptions<string, Error, { adapterId: string; versionId: string }>
) {
  return useMutation({
    mutationFn: ({ adapterId, versionId }) =>
      adapterVersionApiClient.downloadVersion(adapterId, versionId),
    ...options,
  });
}

/**
 * 验证版本文件
 */
export function useVerifyAdapterVersion(
  options?: UseMutationOptions<
    { valid: boolean; message?: string },
    Error,
    { adapterId: string; versionId: string; fileHash: string }
  >
) {
  return useMutation({
    mutationFn: ({ adapterId, versionId, fileHash }) =>
      adapterVersionApiClient.verifyVersion(adapterId, versionId, fileHash),
    ...options,
  });
}

/**
 * 比较版本
 */
export function useCompareAdapterVersions(
  adapterId: string,
  fromVersion: string,
  toVersion: string,
  options?: Omit<
    UseQueryOptions<{
      from: AdapterVersion;
      to: AdapterVersion;
      changes: string[];
      breaking: boolean;
    }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: adapterVersionKeys.compare(adapterId, fromVersion, toVersion),
    queryFn: () =>
      adapterVersionApiClient.compareVersions(adapterId, fromVersion, toVersion),
    enabled: !!adapterId && !!fromVersion && !!toVersion,
    ...options,
  });
}

