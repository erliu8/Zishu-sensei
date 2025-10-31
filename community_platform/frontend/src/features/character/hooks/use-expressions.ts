/**
 * 表情相关的 TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expressionApi } from '../api';
import type {
  Expression,
  CreateExpressionDto,
  UpdateExpressionDto,
} from '../domain';
import { characterKeys } from './use-characters';

/**
 * Query Keys
 */
export const expressionKeys = {
  all: ['expressions'] as const,
  byCharacter: (characterId: string) =>
    [...expressionKeys.all, 'character', characterId] as const,
  detail: (id: string) => [...expressionKeys.all, 'detail', id] as const,
};

/**
 * 获取角色的所有表情
 */
export function useExpressions(characterId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: expressionKeys.byCharacter(characterId),
    queryFn: () => expressionApi.getExpressions(characterId),
    enabled: enabled && !!characterId,
    staleTime: 1000 * 60 * 5, // 5分钟
  });
}

/**
 * 获取单个表情
 */
export function useExpression(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: expressionKeys.detail(id),
    queryFn: () => expressionApi.getExpression(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5, // 5分钟
  });
}

/**
 * 创建表情
 */
export function useCreateExpression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpressionDto) =>
      expressionApi.createExpression(input),
    onSuccess: (newExpression) => {
      // 更新表情列表缓存
      queryClient.invalidateQueries({
        queryKey: expressionKeys.byCharacter(newExpression.characterId),
      });

      // 更新角色详情缓存
      queryClient.invalidateQueries({
        queryKey: characterKeys.detail(newExpression.characterId),
      });
    },
  });
}

/**
 * 批量创建表情
 */
export function useBatchCreateExpressions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inputs: CreateExpressionDto[]) =>
      expressionApi.batchCreateExpressions(inputs),
    onSuccess: (newExpressions) => {
      if (newExpressions.length > 0) {
        const characterId = newExpressions[0]?.characterId;
        
        if (characterId) {
          // 更新表情列表缓存
          queryClient.invalidateQueries({
            queryKey: expressionKeys.byCharacter(characterId),
          });

          // 更新角色详情缓存
          queryClient.invalidateQueries({
            queryKey: characterKeys.detail(characterId),
          });
        }
      }
    },
  });
}

/**
 * 更新表情
 */
export function useUpdateExpression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateExpressionDto;
    }) => expressionApi.updateExpression(id, input),
    onSuccess: (updatedExpression) => {
      // 更新单个表情缓存
      queryClient.setQueryData(
        expressionKeys.detail(updatedExpression.id),
        updatedExpression
      );

      // 更新表情列表缓存
      queryClient.invalidateQueries({
        queryKey: expressionKeys.byCharacter(updatedExpression.characterId),
      });

      // 更新角色详情缓存
      queryClient.invalidateQueries({
        queryKey: characterKeys.detail(updatedExpression.characterId),
      });
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
    onSuccess: (_, deletedId, context: any) => {
      // 从context中获取characterId（在调用mutation时传入）
      const { characterId } = context || {};

      // 移除单个表情缓存
      queryClient.removeQueries({ queryKey: expressionKeys.detail(deletedId) });

      if (characterId) {
        // 更新表情列表缓存
        queryClient.invalidateQueries({
          queryKey: expressionKeys.byCharacter(characterId),
        });

        // 更新角色详情缓存
        queryClient.invalidateQueries({
          queryKey: characterKeys.detail(characterId),
        });
      }
    },
  });
}

/**
 * 切换表情启用状态
 */
export function useToggleExpression() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => expressionApi.toggleExpression(id),
    onSuccess: (updatedExpression) => {
      // 更新单个表情缓存
      queryClient.setQueryData(
        expressionKeys.detail(updatedExpression.id),
        updatedExpression
      );

      // 更新表情列表缓存
      queryClient.invalidateQueries({
        queryKey: expressionKeys.byCharacter(updatedExpression.characterId),
      });
    },
  });
}

/**
 * 批量更新表情优先级
 */
export function useUpdateExpressionPriorities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Array<{ id: string; priority: number }>) =>
      expressionApi.updatePriorities(updates),
    onSuccess: (updatedExpressions) => {
      if (updatedExpressions.length > 0) {
        const characterId = updatedExpressions[0]?.characterId;
        
        if (characterId) {
          // 更新表情列表缓存
          queryClient.invalidateQueries({
            queryKey: expressionKeys.byCharacter(characterId),
          });
        }
      }
    },
  });
}

/**
 * 上传表情图片
 */
export function useUploadExpressionImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      expressionApi.uploadExpressionImage(id, file),
    onSuccess: (_, { id }) => {
      // 刷新表情详情
      queryClient.invalidateQueries({ queryKey: expressionKeys.detail(id) });

      // 获取表情所属的角色ID并刷新
      const expression = queryClient.getQueryData<Expression>(
        expressionKeys.detail(id)
      );
      if (expression) {
        queryClient.invalidateQueries({
          queryKey: expressionKeys.byCharacter(expression.characterId),
        });
      }
    },
  });
}

