/**
 * TTSSettings 组件
 * TTS 参数设置（语速、音调、音量）
 */

'use client';

import React from 'react';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/components/ui/card';
import { Play, RotateCcw } from 'lucide-react';
import { cn } from '@/shared/utils';

export interface TTSSettingsProps {
  /** 语速 (0.5-2.0) */
  speechRate: number;
  /** 音调 (0.5-2.0) */
  pitch: number;
  /** 音量 (0.0-1.0) */
  volume: number;
  /** 语速变化回调 */
  onSpeechRateChange: (value: number) => void;
  /** 音调变化回调 */
  onPitchChange: (value: number) => void;
  /** 音量变化回调 */
  onVolumeChange: (value: number) => void;
  /** 重置为默认值回调 */
  onReset?: () => void;
  /** 测试语音回调 */
  onTest?: () => void;
  /** 是否正在测试 */
  isTesting?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

const DEFAULT_VALUES = {
  speechRate: 1.0,
  pitch: 1.0,
  volume: 0.8,
};

export const TTSSettings: React.FC<TTSSettingsProps> = ({
  speechRate,
  pitch,
  volume,
  onSpeechRateChange,
  onPitchChange,
  onVolumeChange,
  onReset,
  onTest,
  isTesting = false,
  disabled = false,
  className,
}) => {
  // 格式化显示值
  const formatPercentage = (value: number, multiplier: number = 100): string => {
    return `${Math.round(value * multiplier)}%`;
  };

  const formatMultiplier = (value: number): string => {
    return `${value.toFixed(1)}x`;
  };

  // 判断是否使用默认值
  const isDefault =
    speechRate === DEFAULT_VALUES.speechRate &&
    pitch === DEFAULT_VALUES.pitch &&
    volume === DEFAULT_VALUES.volume;

  const handleReset = () => {
    onSpeechRateChange(DEFAULT_VALUES.speechRate);
    onPitchChange(DEFAULT_VALUES.pitch);
    onVolumeChange(DEFAULT_VALUES.volume);
    onReset?.();
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>TTS 参数设置</CardTitle>
            <CardDescription>调整语音的语速、音调和音量参数</CardDescription>
          </div>
          <div className="flex gap-2">
            {onTest && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTest}
                disabled={disabled || isTesting}
              >
                <Play className="w-4 h-4 mr-2" />
                {isTesting ? '测试中...' : '测试语音'}
              </Button>
            )}
            {onReset && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={disabled || isDefault}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                重置
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 语速 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="speech-rate" className="text-sm font-medium">
              语速 (Speech Rate)
            </Label>
            <span className="text-sm text-muted-foreground">
              {formatMultiplier(speechRate)}
            </span>
          </div>
          <Slider
            id="speech-rate"
            min={0.5}
            max={2.0}
            step={0.1}
            value={[speechRate]}
            onValueChange={([value]) => onSpeechRateChange(value)}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>慢速 (0.5x)</span>
            <span>正常 (1.0x)</span>
            <span>快速 (2.0x)</span>
          </div>
        </div>

        {/* 音调 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="pitch" className="text-sm font-medium">
              音调 (Pitch)
            </Label>
            <span className="text-sm text-muted-foreground">
              {formatMultiplier(pitch)}
            </span>
          </div>
          <Slider
            id="pitch"
            min={0.5}
            max={2.0}
            step={0.1}
            value={[pitch]}
            onValueChange={([value]) => onPitchChange(value)}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>低音 (0.5x)</span>
            <span>正常 (1.0x)</span>
            <span>高音 (2.0x)</span>
          </div>
        </div>

        {/* 音量 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="volume" className="text-sm font-medium">
              音量 (Volume)
            </Label>
            <span className="text-sm text-muted-foreground">
              {formatPercentage(volume)}
            </span>
          </div>
          <Slider
            id="volume"
            min={0.0}
            max={1.0}
            step={0.05}
            value={[volume]}
            onValueChange={([value]) => onVolumeChange(value)}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>静音 (0%)</span>
            <span>标准 (80%)</span>
            <span>最大 (100%)</span>
          </div>
        </div>

        {/* 参数说明 */}
        <div className="rounded-lg bg-muted/50 p-4">
          <h4 className="text-sm font-medium mb-2">参数说明</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• <strong>语速</strong>: 控制说话的快慢，建议范围 0.8-1.2</li>
            <li>• <strong>音调</strong>: 控制声音的高低，建议范围 0.8-1.2</li>
            <li>• <strong>音量</strong>: 控制声音的大小，建议范围 0.6-1.0</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

TTSSettings.displayName = 'TTSSettings';

