/**
 * 语音相关的 TanStack Query Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { voiceApi, type AvailableVoice } from '../api';
import type { Voice, CreateVoiceInput, UpdateVoiceInput } from '../domain';
import { characterKeys } from './use-characters';

/**
 * Query Keys
 */
export const voiceKeys = {
  all: ['voices'] as const,
  byCharacter: (characterId: string) =>
    [...voiceKeys.all, 'character', characterId] as const,
  detail: (id: string) => [...voiceKeys.all, 'detail', id] as const,
  available: (engine: string, languageCode?: string) =>
    [...voiceKeys.all, 'available', engine, languageCode] as const,
};

/**
 * 获取角色的所有语音配置
 */
export function useVoices(characterId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: voiceKeys.byCharacter(characterId),
    queryFn: () => voiceApi.getVoices(characterId),
    enabled: enabled && !!characterId,
    staleTime: 1000 * 60 * 5, // 5分钟
  });
}

/**
 * 获取单个语音配置
 */
export function useVoice(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: voiceKeys.detail(id),
    queryFn: () => voiceApi.getVoice(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5, // 5分钟
  });
}

/**
 * 获取可用的TTS语音列表
 */
export function useAvailableVoices(
  engine: string,
  languageCode?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: voiceKeys.available(engine, languageCode),
    queryFn: () => voiceApi.getAvailableVoices(engine, languageCode),
    enabled: enabled && !!engine,
    staleTime: 1000 * 60 * 60, // 1小时（可用语音列表基本不变）
  });
}

/**
 * 创建语音配置
 */
export function useCreateVoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateVoiceInput) => voiceApi.createVoice(input),
    onSuccess: (newVoice) => {
      // 更新语音列表缓存
      queryClient.invalidateQueries({
        queryKey: voiceKeys.byCharacter(newVoice.characterId),
      });

      // 更新角色详情缓存
      queryClient.invalidateQueries({
        queryKey: characterKeys.detail(newVoice.characterId),
      });
    },
  });
}

/**
 * 更新语音配置
 */
export function useUpdateVoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVoiceInput }) =>
      voiceApi.updateVoice(id, input),
    onSuccess: (updatedVoice) => {
      // 更新单个语音缓存
      queryClient.setQueryData(voiceKeys.detail(updatedVoice.id), updatedVoice);

      // 更新语音列表缓存
      queryClient.invalidateQueries({
        queryKey: voiceKeys.byCharacter(updatedVoice.characterId),
      });

      // 更新角色详情缓存
      queryClient.invalidateQueries({
        queryKey: characterKeys.detail(updatedVoice.characterId),
      });
    },
  });
}

/**
 * 删除语音配置
 */
export function useDeleteVoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => voiceApi.deleteVoice(id),
    onSuccess: (_, deletedId, context: any) => {
      // 从context中获取characterId（在调用mutation时传入）
      const { characterId } = context || {};

      // 移除单个语音缓存
      queryClient.removeQueries({ queryKey: voiceKeys.detail(deletedId) });

      if (characterId) {
        // 更新语音列表缓存
        queryClient.invalidateQueries({
          queryKey: voiceKeys.byCharacter(characterId),
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
 * 设置默认语音
 */
export function useSetDefaultVoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => voiceApi.setDefaultVoice(id),
    onSuccess: (updatedVoice) => {
      // 更新单个语音缓存
      queryClient.setQueryData(voiceKeys.detail(updatedVoice.id), updatedVoice);

      // 更新语音列表缓存（需要更新所有语音的isDefault状态）
      queryClient.invalidateQueries({
        queryKey: voiceKeys.byCharacter(updatedVoice.characterId),
      });

      // 更新角色详情缓存
      queryClient.invalidateQueries({
        queryKey: characterKeys.detail(updatedVoice.characterId),
      });
    },
  });
}

/**
 * 生成语音样本
 */
export function useGenerateVoiceSample() {
  return useMutation({
    mutationFn: ({
      voiceId,
      text,
      engine,
    }: {
      voiceId: string;
      text: string;
      engine: string;
    }) => voiceApi.generateSample(voiceId, text, engine),
  });
}

/**
 * 测试语音配置
 */
export function useTestVoice() {
  return useMutation({
    mutationFn: ({ id, testText }: { id: string; testText?: string }) =>
      voiceApi.testVoice(id, testText),
  });
}

/**
 * 上传语音样本
 */
export function useUploadVoiceSample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      voiceApi.uploadSample(id, file),
    onSuccess: (result, { id }) => {
      // 刷新语音详情
      queryClient.invalidateQueries({ queryKey: voiceKeys.detail(id) });

      // 获取语音所属的角色ID并刷新
      const voice = queryClient.getQueryData<Voice>(voiceKeys.detail(id));
      if (voice) {
        queryClient.invalidateQueries({
          queryKey: voiceKeys.byCharacter(voice.characterId),
        });
      }
    },
  });
}

