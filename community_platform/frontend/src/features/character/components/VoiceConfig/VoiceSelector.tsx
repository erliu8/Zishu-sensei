/**
 * VoiceSelector 组件
 * 语音选择器，支持预览和切换
 */

'use client';

import React, { useState } from 'react';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Play, Pause, Star, Check } from 'lucide-react';
import { cn } from '@/shared/utils';
import { TTSEngine, VoiceGender } from '../../types';
import type { Voice } from '../../domain';

export interface VoiceSelectorProps {
  /** 可用的语音列表 */
  voices: Voice[];
  /** 当前选中的语音ID */
  selectedVoiceId?: string;
  /** 选择语音回调 */
  onVoiceSelect: (voiceId: string) => void;
  /** 播放预览回调 */
  onPlayPreview?: (voiceId: string) => void;
  /** 设置为默认语音回调 */
  onSetDefault?: (voiceId: string) => void;
  /** 是否正在播放（用于显示播放状态） */
  playingVoiceId?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示筛选器 */
  showFilters?: boolean;
  /** 自定义类名 */
  className?: string;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  voices,
  selectedVoiceId,
  onVoiceSelect,
  onPlayPreview,
  onSetDefault,
  playingVoiceId,
  disabled = false,
  showFilters = true,
  className,
}) => {
  const [filterEngine, setFilterEngine] = useState<string>('all');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterLanguage, setFilterLanguage] = useState<string>('all');

  // 获取唯一的引擎列表
  const engines = Array.from(new Set(voices.map((v) => v.engine)));

  // 获取唯一的性别列表
  const genders = Array.from(new Set(voices.map((v) => v.gender)));

  // 获取唯一的语言列表
  const languages = Array.from(new Set(voices.map((v) => v.languageCode)));

  // 筛选语音
  const filteredVoices = voices.filter((voice) => {
    if (filterEngine !== 'all' && voice.engine !== filterEngine) return false;
    if (filterGender !== 'all' && voice.gender !== filterGender) return false;
    if (filterLanguage !== 'all' && voice.languageCode !== filterLanguage) return false;
    return true;
  });

  // 获取引擎显示名称
  const getEngineDisplayName = (engine: TTSEngine): string => {
    const engineMap: Record<TTSEngine, string> = {
      [TTSEngine.AZURE]: 'Azure TTS',
      [TTSEngine.GOOGLE]: 'Google Cloud TTS',
      [TTSEngine.AMAZON]: 'Amazon Polly',
      [TTSEngine.OPENAI]: 'OpenAI TTS',
      [TTSEngine.CUSTOM]: 'Custom',
    };
    return engineMap[engine] || engine;
  };

  // 获取性别显示名称
  const getGenderDisplayName = (gender: VoiceGender): string => {
    const genderMap: Record<VoiceGender, string> = {
      [VoiceGender.MALE]: '男性',
      [VoiceGender.FEMALE]: '女性',
      [VoiceGender.NEUTRAL]: '中性',
    };
    return genderMap[gender] || gender;
  };

  // 获取语言显示名称
  const getLanguageDisplayName = (languageCode: string): string => {
    const languageMap: Record<string, string> = {
      'zh-CN': '中文（简体）',
      'zh-TW': '中文（繁体）',
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'ja-JP': '日本語',
      'ko-KR': '한국어',
      'fr-FR': 'Français',
      'de-DE': 'Deutsch',
      'es-ES': 'Español',
      'it-IT': 'Italiano',
      'ru-RU': 'Русский',
    };
    return languageMap[languageCode] || languageCode;
  };

  const handlePlayPreview = (e: React.MouseEvent, voiceId: string) => {
    e.stopPropagation();
    onPlayPreview?.(voiceId);
  };

  const handleSetDefault = (e: React.MouseEvent, voiceId: string) => {
    e.stopPropagation();
    onSetDefault?.(voiceId);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 筛选器 */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">TTS 引擎</Label>
            <Select value={filterEngine} onValueChange={setFilterEngine} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="选择引擎" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部引擎</SelectItem>
                {engines.map((engine) => (
                  <SelectItem key={engine} value={engine}>
                    {getEngineDisplayName(engine as TTSEngine)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">性别</Label>
            <Select value={filterGender} onValueChange={setFilterGender} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="选择性别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部性别</SelectItem>
                {genders.map((gender) => (
                  <SelectItem key={gender} value={gender}>
                    {getGenderDisplayName(gender as VoiceGender)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">语言</Label>
            <Select value={filterLanguage} onValueChange={setFilterLanguage} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="选择语言" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部语言</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {getLanguageDisplayName(lang)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 语音列表 */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          选择语音
          <span className="ml-2 text-xs text-muted-foreground">
            ({filteredVoices.length} 个可用语音)
          </span>
        </Label>

        {filteredVoices.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              没有找到符合条件的语音
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredVoices.map((voice) => {
              const isSelected = voice.id === selectedVoiceId;
              const isPlaying = voice.id === playingVoiceId;

              return (
                <Card
                  key={voice.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    isSelected && 'ring-2 ring-primary',
                    disabled && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => !disabled && onVoiceSelect(voice.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* 语音名称 */}
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-sm truncate">{voice.name}</h4>
                          {voice.isDefault && (
                            <Badge variant="secondary" className="h-5 px-1.5">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            </Badge>
                          )}
                          {isSelected && (
                            <Badge variant="default" className="h-5 px-1.5">
                              <Check className="w-3 h-3" />
                            </Badge>
                          )}
                        </div>

                        {/* 语音信息 */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="outline" className="text-xs">
                            {getEngineDisplayName(voice.engine)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getGenderDisplayName(voice.gender)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getLanguageDisplayName(voice.languageCode)}
                          </Badge>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex gap-2">
                          {onPlayPreview && voice.sampleUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handlePlayPreview(e, voice.id)}
                              disabled={disabled}
                              className="h-7 px-2 text-xs"
                            >
                              {isPlaying ? (
                                <>
                                  <Pause className="w-3 h-3 mr-1" />
                                  播放中
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 mr-1" />
                                  预览
                                </>
                              )}
                            </Button>
                          )}
                          {onSetDefault && !voice.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleSetDefault(e, voice.id)}
                              disabled={disabled}
                              className="h-7 px-2 text-xs"
                            >
                              <Star className="w-3 h-3 mr-1" />
                              设为默认
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

VoiceSelector.displayName = 'VoiceSelector';

