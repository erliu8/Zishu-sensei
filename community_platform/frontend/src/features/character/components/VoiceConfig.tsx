/**
 * VoiceConfig 主组件
 * 语音配置的顶层容器组件，整合语音选择和TTS参数设置
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { LoadingSpinner } from '@/shared/components/common';
import { useToast } from '@/shared/components/ui/use-toast';
import { Save, AlertCircle, Plus } from 'lucide-react';
import { cn } from '@/shared/utils';
import { VoiceSelector } from './VoiceConfig/VoiceSelector';
import { TTSSettings } from './VoiceConfig/TTSSettings';
import {
  useVoices,
  useUpdateVoice,
  useSetDefaultVoice,
  useTestVoice,
  useGenerateVoiceSample,
} from '../hooks';
import type { Voice, UpdateVoiceInput } from '../domain';

export interface VoiceConfigProps {
  /** 角色ID */
  characterId: string;
  /** 当前选中的语音ID（受控） */
  selectedVoiceId?: string;
  /** 选中语音变化回调 */
  onVoiceChange?: (voiceId: string) => void;
  /** 保存成功回调 */
  onSaveSuccess?: (voice: Voice) => void;
  /** 添加新语音回调 */
  onAddVoice?: () => void;
  /** 是否显示添加按钮 */
  showAddButton?: boolean;
  /** 自定义类名 */
  className?: string;
}

export const VoiceConfig: React.FC<VoiceConfigProps> = ({
  characterId,
  selectedVoiceId: controlledVoiceId,
  onVoiceChange,
  onSaveSuccess,
  onAddVoice,
  showAddButton = true,
  className,
}) => {
  const { toast } = useToast();

  // 获取语音列表
  const {
    data: voices = [],
    isLoading,
    error,
  } = useVoices(characterId);

  // 内部状态：选中的语音
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | undefined>(
    controlledVoiceId
  );

  // 内部状态：TTS参数（临时值，未保存）
  const [ttsParams, setTtsParams] = useState({
    speechRate: 1.0,
    pitch: 1.0,
    volume: 0.8,
  });

  // 内部状态：是否有未保存的更改
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 播放中的语音ID
  const [playingVoiceId, setPlayingVoiceId] = useState<string | undefined>();

  // Mutations
  const updateVoiceMutation = useUpdateVoice();
  const setDefaultVoiceMutation = useSetDefaultVoice();
  const testVoiceMutation = useTestVoice();
  const generateSampleMutation = useGenerateVoiceSample();

  // 获取当前选中的语音
  const selectedVoice = voices.find((v) => v.id === selectedVoiceId);

  // 同步受控值
  useEffect(() => {
    if (controlledVoiceId !== undefined) {
      setSelectedVoiceId(controlledVoiceId);
    }
  }, [controlledVoiceId]);

  // 当选中的语音改变时，更新TTS参数
  useEffect(() => {
    if (selectedVoice) {
      setTtsParams({
        speechRate: selectedVoice.speechRate,
        pitch: selectedVoice.pitch,
        volume: selectedVoice.volume,
      });
      setHasUnsavedChanges(false);
    }
  }, [selectedVoice]);

  // 如果没有语音且不在加载中，默认选中第一个或默认语音
  useEffect(() => {
    if (!isLoading && voices.length > 0 && !selectedVoiceId) {
      const defaultVoice = voices.find((v) => v.isDefault) || voices[0];
      setSelectedVoiceId(defaultVoice.id);
    }
  }, [voices, isLoading, selectedVoiceId]);

  // 处理语音选择
  const handleVoiceSelect = (voiceId: string) => {
    if (hasUnsavedChanges) {
      // 可以添加确认对话框
      const confirmed = window.confirm('有未保存的更改，确定要切换语音吗？');
      if (!confirmed) return;
    }

    setSelectedVoiceId(voiceId);
    onVoiceChange?.(voiceId);
  };

  // 处理TTS参数变化
  const handleTtsParamChange = (
    param: 'speechRate' | 'pitch' | 'volume',
    value: number
  ) => {
    setTtsParams((prev) => ({ ...prev, [param]: value }));
    setHasUnsavedChanges(true);
  };

  // 处理保存
  const handleSave = async () => {
    if (!selectedVoice) {
      toast({
        title: '保存失败',
        description: '请先选择一个语音',
        variant: 'destructive',
      });
      return;
    }

    try {
      const input: UpdateVoiceInput = {
        speechRate: ttsParams.speechRate,
        pitch: ttsParams.pitch,
        volume: ttsParams.volume,
      };

      const updatedVoice = await updateVoiceMutation.mutateAsync({
        id: selectedVoice.id,
        input,
      });

      setHasUnsavedChanges(false);

      toast({
        title: '保存成功',
        description: '语音配置已更新',
      });

      onSaveSuccess?.(updatedVoice);
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  // 处理设置默认语音
  const handleSetDefault = async (voiceId: string) => {
    try {
      await setDefaultVoiceMutation.mutateAsync(voiceId);

      toast({
        title: '设置成功',
        description: '已设置为默认语音',
      });
    } catch (error) {
      toast({
        title: '设置失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  // 处理播放预览
  const handlePlayPreview = async (voiceId: string) => {
    const voice = voices.find((v) => v.id === voiceId);
    if (!voice?.sampleUrl) {
      toast({
        title: '无法预览',
        description: '该语音没有可用的预览样本',
        variant: 'destructive',
      });
      return;
    }

    try {
      setPlayingVoiceId(voiceId);

      // 播放音频
      const audio = new Audio(voice.sampleUrl);
      audio.onended = () => setPlayingVoiceId(undefined);
      audio.onerror = () => {
        setPlayingVoiceId(undefined);
        toast({
          title: '播放失败',
          description: '无法播放语音样本',
          variant: 'destructive',
        });
      };

      await audio.play();
    } catch (error) {
      setPlayingVoiceId(undefined);
      toast({
        title: '播放失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  // 处理测试语音
  const handleTestVoice = async () => {
    if (!selectedVoice) return;

    try {
      await testVoiceMutation.mutateAsync({
        id: selectedVoice.id,
        testText: '你好，这是一个测试语音。',
      });

      toast({
        title: '测试成功',
        description: '请查看控制台输出',
      });
    } catch (error) {
      toast({
        title: '测试失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  // 处理重置TTS参数
  const handleReset = () => {
    if (selectedVoice) {
      setTtsParams({
        speechRate: selectedVoice.speechRate,
        pitch: selectedVoice.pitch,
        volume: selectedVoice.volume,
      });
      setHasUnsavedChanges(false);
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-12 flex items-center justify-center">
          <LoadingSpinner size="lg" text="加载语音配置中..." />
        </CardContent>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              加载语音配置失败: {error instanceof Error ? error.message : '未知错误'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>语音配置</CardTitle>
            <CardDescription>
              选择语音并调整 TTS 参数，为角色打造独特的声音
            </CardDescription>
          </div>
          {showAddButton && onAddVoice && (
            <Button onClick={onAddVoice} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              添加语音
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {voices.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              还没有配置语音。请点击"添加语音"按钮开始配置。
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs defaultValue="selector" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="selector">选择语音</TabsTrigger>
              <TabsTrigger value="settings" disabled={!selectedVoice}>
                TTS 参数
              </TabsTrigger>
            </TabsList>

            <TabsContent value="selector" className="mt-6">
              <VoiceSelector
                voices={voices}
                selectedVoiceId={selectedVoiceId}
                onVoiceSelect={handleVoiceSelect}
                onPlayPreview={handlePlayPreview}
                onSetDefault={handleSetDefault}
                playingVoiceId={playingVoiceId}
              />
            </TabsContent>

            <TabsContent value="settings" className="mt-6">
              {selectedVoice && (
                <TTSSettings
                  speechRate={ttsParams.speechRate}
                  pitch={ttsParams.pitch}
                  volume={ttsParams.volume}
                  onSpeechRateChange={(value) =>
                    handleTtsParamChange('speechRate', value)
                  }
                  onPitchChange={(value) => handleTtsParamChange('pitch', value)}
                  onVolumeChange={(value) => handleTtsParamChange('volume', value)}
                  onReset={handleReset}
                  onTest={handleTestVoice}
                  isTesting={testVoiceMutation.isPending}
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      {selectedVoice && hasUnsavedChanges && (
        <CardFooter className="border-t bg-muted/50 flex justify-between items-center">
          <div className="flex items-center text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 mr-2" />
            有未保存的更改
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={updateVoiceMutation.isPending}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={updateVoiceMutation.isPending}>
              {updateVoiceMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存更改
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

VoiceConfig.displayName = 'VoiceConfig';

