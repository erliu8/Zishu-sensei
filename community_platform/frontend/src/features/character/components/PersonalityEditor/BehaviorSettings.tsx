'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { cn } from '@/shared/utils/cn';
import {
  type BehaviorSettings as BehaviorSettingsType,
  BEHAVIOR_TRAIT_DESCRIPTIONS,
} from '../../types/personality';

interface BehaviorSettingsProps {
  value: BehaviorSettingsType;
  onChange: (value: BehaviorSettingsType) => void;
  className?: string;
}

export function BehaviorSettings({ value, onChange, className }: BehaviorSettingsProps) {
  const handleBehaviorChange = (behavior: keyof BehaviorSettingsType, newValue: number[]) => {
    onChange({
      ...value,
      [behavior]: newValue[0],
    });
  };

  // 将行为特质分组
  const communicationTraits: Array<keyof BehaviorSettingsType> = [
    'formality',
    'directness',
    'humor',
  ];

  const emotionalTraits: Array<keyof BehaviorSettingsType> = [
    'enthusiasm',
    'empathy',
    'patience',
  ];

  const cognitiveTraits: Array<keyof BehaviorSettingsType> = [
    'creativity',
    'assertiveness',
  ];

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>行为设定</CardTitle>
        <CardDescription>
          配置角色的具体行为特征和交互风格
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="communication" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="communication">沟通方式</TabsTrigger>
            <TabsTrigger value="emotional">情感表达</TabsTrigger>
            <TabsTrigger value="cognitive">认知风格</TabsTrigger>
          </TabsList>

          <TabsContent value="communication" className="space-y-6 mt-6">
            {communicationTraits.map((trait) => (
              <BehaviorSlider
                key={trait}
                trait={trait}
                value={value[trait]}
                onChange={(newValue) => handleBehaviorChange(trait, newValue)}
              />
            ))}
          </TabsContent>

          <TabsContent value="emotional" className="space-y-6 mt-6">
            {emotionalTraits.map((trait) => (
              <BehaviorSlider
                key={trait}
                trait={trait}
                value={value[trait]}
                onChange={(newValue) => handleBehaviorChange(trait, newValue)}
              />
            ))}
          </TabsContent>

          <TabsContent value="cognitive" className="space-y-6 mt-6">
            {cognitiveTraits.map((trait) => (
              <BehaviorSlider
                key={trait}
                trait={trait}
                value={value[trait]}
                onChange={(newValue) => handleBehaviorChange(trait, newValue)}
              />
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// 行为滑块子组件
interface BehaviorSliderProps {
  trait: keyof BehaviorSettingsType;
  value: number;
  onChange: (value: number[]) => void;
}

function BehaviorSlider({ trait, value, onChange }: BehaviorSliderProps) {
  const traitInfo = BEHAVIOR_TRAIT_DESCRIPTIONS[trait];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <Label className="text-base font-semibold">
            {traitInfo.name}
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            {traitInfo.description}
          </p>
        </div>
        <div className="ml-4 text-right min-w-[80px]">
          <span className="text-2xl font-bold tabular-nums">
            {value}
          </span>
          <span className="text-muted-foreground">/100</span>
        </div>
      </div>

      <div className="space-y-2">
        <Slider
          value={[value]}
          onValueChange={onChange}
          min={0}
          max={100}
          step={1}
          className="w-full"
        />

        <div className="flex justify-between text-xs">
          <span className={cn(
            'text-muted-foreground transition-colors px-2 py-1 rounded',
            value <= 30 && 'bg-primary/10 text-foreground font-medium'
          )}>
            {traitInfo.low}
          </span>
          <span className={cn(
            'text-muted-foreground transition-colors px-2 py-1 rounded',
            value >= 70 && 'bg-primary/10 text-foreground font-medium'
          )}>
            {traitInfo.high}
          </span>
        </div>
      </div>

      {/* 进度条可视化 */}
      <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

