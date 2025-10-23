/**
 * 表情相关的React Query Hooks
 * @module features/character/hooks/useExpressions
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expressionApi } from '../api/expressionApi';
import type {
  Expression,
  ExpressionQueryParams,
  CreateExpressionDto,
  UpdateExpressionDto,
} from '../domain/expression';
import { toast } from 'sonner';

/**
 * Query Keys
 */
export const expressionKeys = {
  all: ['expressions'] as const,
  lists: () => [...expressionKeys.all, 'list'] as const,
  list: (params: ExpressionQueryParams) => [...expressionKeys.lists(), params] as const,
  byCharacter: (characterId: string) => [...expressionKeys.all, 'character', characterId] as const,
  details: () => [...expressionKeys.all, 'detail'] as const,
  detail: (id: string) => [...expressionKeys.details(), id] as const,
};

/**
 * 获取表情列表
 */
export function useExpressions(params: ExpressionQueryParams) {
  return useQuery({
    queryKey: expressionKeys.list(params),
    queryFn: () => expressionApi.getExpressions(params),
    staleTime: 5 * 60 * 1000, // 5分钟
    gcTime: 10 * 60 * 1000, // 10分钟
  });
}

/**
 * 根据角色ID获取表情列表
 */
export function useCharacterExpressions(characterId: string) {
  return useQuery({
    queryKey: expressionKeys.byCharacter(characterId),
    queryFn: () => expressionApi.getExpressionsByCharacter(characterId),
    enabled: !!characterId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 获取单个表情详情
 */
export function useExpression(id: string) {
  return useQuery({
    queryKey: expressionKeys.detail(id),
    queryFn: () => expressionApi.getExpression(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 创建表情
 */
export function useCreateExpression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExpressionDto) => expressionApi.createExpression(data),
    onSuccess: (data) => {
      // 使表情列表缓存失效
      queryClient.invalidateQueries({ queryKey: expressionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expressionKeys.byCharacter(data.characterId) });
      
      toast.success('表情创建成功');
    },
    onError: (error: Error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });
}

/**
 * 更新表情
 */
export function useUpdateExpression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpressionDto }) =>
      expressionApi.updateExpression(id, data),
    onSuccess: (data, variables) => {
      // 更新缓存
      queryClient.setQueryData(expressionKeys.detail(variables.id), data);
      queryClient.invalidateQueries({ queryKey: expressionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expressionKeys.byCharacter(data.characterId) });
      
      toast.success('表情更新成功');
    },
    onError: (error: Error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });
}

/**
 * 删除表情
 */
export function useDeleteExpression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expressionApi.deleteExpression(id),
    onSuccess: (_, id) => {
      // 使缓存失效
      queryClient.invalidateQueries({ queryKey: expressionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expressionKeys.all });
      queryClient.removeQueries({ queryKey: expressionKeys.detail(id) });
      
      toast.success('表情删除成功');
    },
    onError: (error: Error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });
}

/**
 * 批量删除表情
 */
export function useDeleteExpressions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => expressionApi.deleteExpressions(ids),
    onSuccess: (_, ids) => {
      // 使缓存失效
      queryClient.invalidateQueries({ queryKey: expressionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expressionKeys.all });
      ids.forEach((id) => {
        queryClient.removeQueries({ queryKey: expressionKeys.detail(id) });
      });
      
      toast.success('批量删除成功');
    },
    onError: (error: Error) => {
      toast.error(`批量删除失败: ${error.message}`);
    },
  });
}

/**
 * 切换表情启用状态
 */
export function useToggleExpressionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      expressionApi.toggleExpressionStatus(id, isActive),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(expressionKeys.detail(variables.id), data);
      queryClient.invalidateQueries({ queryKey: expressionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expressionKeys.byCharacter(data.characterId) });
      
      toast.success(`表情已${variables.isActive ? '启用' : '禁用'}`);
    },
    onError: (error: Error) => {
      toast.error(`操作失败: ${error.message}`);
    },
  });
}

/**
 * 设置默认表情
 */
export function useSetDefaultExpression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, expressionId }: { characterId: string; expressionId: string }) =>
      expressionApi.setDefaultExpression(characterId, expressionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expressionKeys.byCharacter(variables.characterId) });
      queryClient.invalidateQueries({ queryKey: expressionKeys.lists() });
      
      toast.success('默认表情设置成功');
    },
    onError: (error: Error) => {
      toast.error(`设置失败: ${error.message}`);
    },
  });
}

/**
 * 复制表情
 */
export function useDuplicateExpression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expressionApi.duplicateExpression(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: expressionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: expressionKeys.byCharacter(data.characterId) });
      
      toast.success('表情复制成功');
    },
    onError: (error: Error) => {
      toast.error(`复制失败: ${error.message}`);
    },
  });
}

/**
 * 重新排序表情
 */
export function useReorderExpressions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, expressionIds }: { characterId: string; expressionIds: string[] }) =>
      expressionApi.reorderExpressions(characterId, expressionIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expressionKeys.byCharacter(variables.characterId) });
      queryClient.invalidateQueries({ queryKey: expressionKeys.lists() });
      
      toast.success('排序更新成功');
    },
    onError: (error: Error) => {
      toast.error(`排序失败: ${error.message}`);
    },
  });
}

/**
 * 上传表情文件
 */
export function useUploadExpressionFile() {
  return useMutation({
    mutationFn: (file: File) => expressionApi.uploadExpressionFile(file),
    onError: (error: Error) => {
      toast.error(`上传失败: ${error.message}`);
    },
  });
}

/**
 * 乐观更新辅助函数
 */
export function useOptimisticExpression() {
  const queryClient = useQueryClient();

  const optimisticUpdate = (id: string, updater: (old: Expression) => Expression) => {
    const previousData = queryClient.getQueryData<Expression>(expressionKeys.detail(id));

    if (previousData) {
      queryClient.setQueryData(expressionKeys.detail(id), updater(previousData));
    }

    return { previousData };
  };

  const rollback = (id: string, previousData?: Expression) => {
    if (previousData) {
      queryClient.setQueryData(expressionKeys.detail(id), previousData);
    }
  };

  return { optimisticUpdate, rollback };
}

