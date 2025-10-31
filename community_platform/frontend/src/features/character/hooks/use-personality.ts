/**
 * 人格相关的 TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personalityApi } from '../api';
import type {
  CreatePersonalityInput,
  UpdatePersonalityInput,
} from '../domain';
import { characterKeys } from './use-characters';

/**
 * Query Keys
 */
export const personalityKeys = {
  all: ['personalities'] as const,
  byCharacter: (characterId: string) =>
    [...personalityKeys.all, 'character', characterId] as const,
  mbtiRecommendation: (mbtiType: string) =>
    [...personalityKeys.all, 'mbti-recommendation', mbtiType] as const,
};

/**
 * 获取角色的人格配置
 */
export function usePersonality(characterId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: personalityKeys.byCharacter(characterId),
    queryFn: () => personalityApi.getPersonality(characterId),
    enabled: enabled && !!characterId,
    staleTime: 1000 * 60 * 5, // 5分钟
  });
}

/**
 * 获取MBTI类型的推荐配置
 */
export function useMBTIRecommendation(mbtiType: string) {
  return useQuery({
    queryKey: personalityKeys.mbtiRecommendation(mbtiType),
    queryFn: () => personalityApi.getMBTIRecommendation(mbtiType),
    enabled: !!mbtiType,
    staleTime: 1000 * 60 * 60, // 1小时（这个数据基本不变）
  });
}

/**
 * 创建人格配置
 */
export function useCreatePersonality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePersonalityInput) =>
      personalityApi.createPersonality(input),
    onSuccess: (newPersonality) => {
      // 更新人格缓存
      queryClient.setQueryData(
        personalityKeys.byCharacter(newPersonality.characterId),
        newPersonality
      );

      // 更新角色详情缓存（包含人格信息）
      queryClient.invalidateQueries({
        queryKey: characterKeys.detail(newPersonality.characterId),
      });
    },
  });
}

/**
 * 更新人格配置
 */
export function useUpdatePersonality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdatePersonalityInput;
    }) => personalityApi.updatePersonality(id, input),
    onSuccess: (updatedPersonality) => {
      // 更新人格缓存
      queryClient.setQueryData(
        personalityKeys.byCharacter(updatedPersonality.characterId),
        updatedPersonality
      );

      // 更新角色详情缓存
      queryClient.invalidateQueries({
        queryKey: characterKeys.detail(updatedPersonality.characterId),
      });
    },
  });
}

/**
 * 删除人格配置
 */
export function useDeletePersonality() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => personalityApi.deletePersonality(id),
    onSuccess: (_, __, context: any) => {
      // 从context中获取characterId（在调用mutation时传入）
      const { characterId } = context || {};

      if (characterId) {
        // 移除人格缓存
        queryClient.removeQueries({
          queryKey: personalityKeys.byCharacter(characterId),
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
 * 分析人格相似度
 */
export function usePersonalitySimilarity(
  personalityId: string,
  targetPersonalityId: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: [
      ...personalityKeys.all,
      'similarity',
      personalityId,
      targetPersonalityId,
    ],
    queryFn: () =>
      personalityApi.analyzeSimilarity(personalityId, targetPersonalityId),
    enabled: enabled && !!personalityId && !!targetPersonalityId,
    staleTime: 1000 * 60 * 30, // 30分钟
  });
}

