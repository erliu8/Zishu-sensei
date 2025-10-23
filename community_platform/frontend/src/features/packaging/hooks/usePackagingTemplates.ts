/**
 * usePackagingTemplates Hook
 * 打包模板相关的 Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { packagingApiClient } from '../api/PackagingApiClient';
import type { PackagingTemplate } from '../domain/packaging.types';
import { useToast } from '@/shared/components/ui/use-toast';
import { packagingKeys } from './query-keys';

/**
 * 获取打包模板列表
 */
export function usePackagingTemplates(params?: {
  page?: number;
  pageSize?: number;
  isPublic?: boolean;
}) {
  return useQuery({
    queryKey: packagingKeys.templates(),
    queryFn: async () => {
      const response = await packagingApiClient.getTemplates(params);
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 分钟
  });
}

/**
 * 获取打包模板详情
 */
export function usePackagingTemplate(templateId: string) {
  return useQuery({
    queryKey: packagingKeys.template(templateId),
    queryFn: async () => {
      const response = await packagingApiClient.getTemplate(templateId);
      return response.data;
    },
    enabled: !!templateId,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * 创建打包模板
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (
      input: Omit<PackagingTemplate, 'id' | 'creatorId' | 'usageCount' | 'createdAt' | 'updatedAt'>
    ) => packagingApiClient.createTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: packagingKeys.templates() });

      toast({
        title: '模板创建成功',
        description: '打包模板已成功创建',
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
 * 更新打包模板
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ templateId, input }: { templateId: string; input: Partial<PackagingTemplate> }) =>
      packagingApiClient.updateTemplate(templateId, input),
    onSuccess: (_, { templateId }) => {
      queryClient.invalidateQueries({ queryKey: packagingKeys.template(templateId) });
      queryClient.invalidateQueries({ queryKey: packagingKeys.templates() });

      toast({
        title: '模板更新成功',
        description: '打包模板已成功更新',
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
 * 删除打包模板
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (templateId: string) => packagingApiClient.deleteTemplate(templateId),
    onSuccess: (_, templateId) => {
      queryClient.invalidateQueries({ queryKey: packagingKeys.template(templateId) });
      queryClient.invalidateQueries({ queryKey: packagingKeys.templates() });

      toast({
        title: '模板已删除',
        description: '打包模板已成功删除',
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
 * 获取打包预设
 */
export function usePackagingPresets() {
  return useQuery({
    queryKey: packagingKeys.presets(),
    queryFn: async () => {
      const response = await packagingApiClient.getPresets();
      return response.data;
    },
    staleTime: 30 * 60 * 1000, // 30 分钟
  });
}

