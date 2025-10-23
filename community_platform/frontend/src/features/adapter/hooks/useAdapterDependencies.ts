/**
 * 适配器依赖相关 Hooks
 * @module features/adapter/hooks
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { adapterDependencyApiClient, type DependencyTreeNode, type DependencyCheckResult } from '../api';
import type { AdapterDependency } from '../domain';

/**
 * 适配器依赖查询键工厂
 */
export const adapterDependencyKeys = {
  all: ['adapter-dependencies'] as const,
  lists: (adapterId: string) => [...adapterDependencyKeys.all, 'list', adapterId] as const,
  list: (adapterId: string, versionId?: string) => [...adapterDependencyKeys.lists(adapterId), versionId] as const,
  tree: (adapterId: string, versionId?: string, depth?: number) => [...adapterDependencyKeys.all, 'tree', adapterId, versionId, depth] as const,
  reverse: (adapterId: string) => [...adapterDependencyKeys.all, 'reverse', adapterId] as const,
  check: (adapterId: string, versionId?: string) => [...adapterDependencyKeys.all, 'check', adapterId, versionId] as const,
  suggestedVersion: (adapterId: string, dependencyId: string) => [...adapterDependencyKeys.all, 'suggested-version', adapterId, dependencyId] as const,
};

/**
 * 获取适配器的依赖列表
 */
export function useAdapterDependencies(
  adapterId: string,
  versionId?: string,
  options?: Omit<UseQueryOptions<AdapterDependency[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterDependencyKeys.list(adapterId, versionId),
    queryFn: () => adapterDependencyApiClient.getDependencies(adapterId, versionId),
    enabled: !!adapterId,
    ...options,
  });
}

/**
 * 获取依赖树
 */
export function useAdapterDependencyTree(
  adapterId: string,
  versionId?: string,
  depth: number = -1,
  options?: Omit<UseQueryOptions<DependencyTreeNode>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterDependencyKeys.tree(adapterId, versionId, depth),
    queryFn: () => adapterDependencyApiClient.getDependencyTree(adapterId, versionId, depth),
    enabled: !!adapterId,
    ...options,
  });
}

/**
 * 获取反向依赖
 */
export function useAdapterReverseDependencies(
  adapterId: string,
  options?: Omit<
    UseQueryOptions<
      Array<{
        adapterId: string;
        adapterName: string;
        versionRequirement: string;
      }>
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: adapterDependencyKeys.reverse(adapterId),
    queryFn: () => adapterDependencyApiClient.getReverseDependencies(adapterId),
    enabled: !!adapterId,
    ...options,
  });
}

/**
 * 检查依赖是否满足
 */
export function useCheckAdapterDependencies(
  adapterId: string,
  versionId?: string,
  options?: Omit<UseQueryOptions<DependencyCheckResult>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterDependencyKeys.check(adapterId, versionId),
    queryFn: () => adapterDependencyApiClient.checkDependencies(adapterId, versionId),
    enabled: !!adapterId,
    ...options,
  });
}

/**
 * 解析依赖冲突
 */
export function useResolveDependencyConflicts(
  options?: UseMutationOptions<
    {
      resolvable: boolean;
      resolution?: Record<string, string>;
      conflicts: Array<{
        adapterId: string;
        adapterName: string;
        conflictingVersions: string[];
        reason: string;
      }>;
    },
    Error,
    string[]
  >
) {
  return useMutation({
    mutationFn: (adapterIds: string[]) =>
      adapterDependencyApiClient.resolveDependencyConflicts(adapterIds),
    ...options,
  });
}

/**
 * 添加依赖
 */
export function useAddAdapterDependency(
  options?: UseMutationOptions<
    AdapterDependency,
    Error,
    {
      adapterId: string;
      dependency: {
        dependencyId: string;
        versionRequirement: string;
        required: boolean;
        type: 'runtime' | 'development' | 'peer' | 'optional';
        description?: string;
      };
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, dependency }) =>
      adapterDependencyApiClient.addDependency(adapterId, dependency),
    onSuccess: (_, { adapterId }) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.lists(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.tree(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.check(adapterId) 
      });
    },
    ...options,
  });
}

/**
 * 更新依赖
 */
export function useUpdateAdapterDependency(
  options?: UseMutationOptions<
    AdapterDependency,
    Error,
    {
      adapterId: string;
      dependencyId: string;
      data: {
        versionRequirement?: string;
        required?: boolean;
        type?: 'runtime' | 'development' | 'peer' | 'optional';
        description?: string;
      };
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, dependencyId, data }) =>
      adapterDependencyApiClient.updateDependency(adapterId, dependencyId, data),
    onSuccess: (_, { adapterId }) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.lists(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.tree(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.check(adapterId) 
      });
    },
    ...options,
  });
}

/**
 * 删除依赖
 */
export function useRemoveAdapterDependency(
  options?: UseMutationOptions<void, Error, { adapterId: string; dependencyId: string }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, dependencyId }) =>
      adapterDependencyApiClient.removeDependency(adapterId, dependencyId),
    onSuccess: (_, { adapterId }) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.lists(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.tree(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.check(adapterId) 
      });
    },
    ...options,
  });
}

/**
 * 批量添加依赖
 */
export function useAddAdapterDependencies(
  options?: UseMutationOptions<
    AdapterDependency[],
    Error,
    {
      adapterId: string;
      dependencies: Array<{
        dependencyId: string;
        versionRequirement: string;
        required: boolean;
        type: 'runtime' | 'development' | 'peer' | 'optional';
        description?: string;
      }>;
    }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ adapterId, dependencies }) =>
      adapterDependencyApiClient.addDependencies(adapterId, dependencies),
    onSuccess: (_, { adapterId }) => {
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.lists(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.tree(adapterId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: adapterDependencyKeys.check(adapterId) 
      });
    },
    ...options,
  });
}

/**
 * 获取建议的依赖版本
 */
export function useSuggestedDependencyVersion(
  adapterId: string,
  dependencyId: string,
  options?: Omit<UseQueryOptions<string>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: adapterDependencyKeys.suggestedVersion(adapterId, dependencyId),
    queryFn: () => adapterDependencyApiClient.getSuggestedVersion(adapterId, dependencyId),
    enabled: !!adapterId && !!dependencyId,
    ...options,
  });
}

