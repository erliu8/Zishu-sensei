/**
 * 模型相关的 TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modelApi, type UploadProgressCallback } from '../api';
import type { Model, CreateModelInput, UpdateModelInput } from '../domain';
import { characterKeys } from './use-characters';

/**
 * Query Keys
 */
export const modelKeys = {
  all: ['models'] as const,
  byCharacter: (characterId: string) =>
    [...modelKeys.all, 'character', characterId] as const,
  detail: (id: string) => [...modelKeys.all, 'detail', id] as const,
  preview: (id: string) => [...modelKeys.all, 'preview', id] as const,
};

/**
 * 获取角色的所有模型
 */
export function useModels(characterId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: modelKeys.byCharacter(characterId),
    queryFn: () => modelApi.getModels(characterId),
    enabled: enabled && !!characterId,
    staleTime: 1000 * 60 * 5, // 5分钟
  });
}

/**
 * 获取单个模型
 */
export function useModel(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: modelKeys.detail(id),
    queryFn: () => modelApi.getModel(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5, // 5分钟
  });
}

/**
 * 获取模型预览数据
 */
export function useModelPreview(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: modelKeys.preview(id),
    queryFn: () => modelApi.getModelPreview(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 10, // 10分钟
  });
}

/**
 * 创建模型配置
 */
export function useCreateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateModelInput) => modelApi.createModel(input),
    onSuccess: (newModel) => {
      // 更新模型列表缓存
      queryClient.invalidateQueries({
        queryKey: modelKeys.byCharacter(newModel.characterId),
      });

      // 更新角色详情缓存
      queryClient.invalidateQueries({
        queryKey: characterKeys.detail(newModel.characterId),
      });
    },
  });
}

/**
 * 更新模型配置
 */
export function useUpdateModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateModelInput }) =>
      modelApi.updateModel(id, input),
    onSuccess: (updatedModel) => {
      // 更新单个模型缓存
      queryClient.setQueryData(modelKeys.detail(updatedModel.id), updatedModel);

      // 更新模型列表缓存
      queryClient.invalidateQueries({
        queryKey: modelKeys.byCharacter(updatedModel.characterId),
      });

      // 更新角色详情缓存
      queryClient.invalidateQueries({
        queryKey: characterKeys.detail(updatedModel.characterId),
      });
    },
  });
}

/**
 * 删除模型
 */
export function useDeleteModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => modelApi.deleteModel(id),
    onSuccess: (_, deletedId, context: any) => {
      // 从context中获取characterId（在调用mutation时传入）
      const { characterId } = context || {};

      // 移除单个模型缓存
      queryClient.removeQueries({ queryKey: modelKeys.detail(deletedId) });
      queryClient.removeQueries({ queryKey: modelKeys.preview(deletedId) });

      if (characterId) {
        // 更新模型列表缓存
        queryClient.invalidateQueries({
          queryKey: modelKeys.byCharacter(characterId),
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
 * 设置默认模型
 */
export function useSetDefaultModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => modelApi.setDefaultModel(id),
    onSuccess: (updatedModel) => {
      // 更新单个模型缓存
      queryClient.setQueryData(modelKeys.detail(updatedModel.id), updatedModel);

      // 更新模型列表缓存（需要更新所有模型的isDefault状态）
      queryClient.invalidateQueries({
        queryKey: modelKeys.byCharacter(updatedModel.characterId),
      });

      // 更新角色详情缓存
      queryClient.invalidateQueries({
        queryKey: characterKeys.detail(updatedModel.characterId),
      });
    },
  });
}

/**
 * 上传模型文件（带进度）
 */
export function useUploadModelFile() {
  return useMutation({
    mutationFn: ({
      file,
      characterId,
      onProgress,
    }: {
      file: File;
      characterId: string;
      onProgress?: UploadProgressCallback;
    }) => modelApi.uploadModelFile(file, characterId, onProgress),
  });
}

/**
 * 上传缩略图
 */
export function useUploadModelThumbnail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      modelApi.uploadThumbnail(id, file),
    onSuccess: (_, { id }) => {
      // 刷新模型详情
      queryClient.invalidateQueries({ queryKey: modelKeys.detail(id) });

      // 获取模型所属的角色ID并刷新
      const model = queryClient.getQueryData<Model>(modelKeys.detail(id));
      if (model) {
        queryClient.invalidateQueries({
          queryKey: modelKeys.byCharacter(model.characterId),
        });
      }
    },
  });
}

/**
 * 验证模型文件
 */
export function useValidateModel() {
  return useMutation({
    mutationFn: (file: File) => modelApi.validateModel(file),
  });
}

/**
 * 优化模型文件
 */
export function useOptimizeModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => modelApi.optimizeModel(id),
    onSuccess: (optimizedModel) => {
      // 更新单个模型缓存
      queryClient.setQueryData(
        modelKeys.detail(optimizedModel.id),
        optimizedModel
      );

      // 更新模型列表缓存
      queryClient.invalidateQueries({
        queryKey: modelKeys.byCharacter(optimizedModel.characterId),
      });

      // 清除预览缓存（可能已改变）
      queryClient.invalidateQueries({
        queryKey: modelKeys.preview(optimizedModel.id),
      });
    },
  });
}

