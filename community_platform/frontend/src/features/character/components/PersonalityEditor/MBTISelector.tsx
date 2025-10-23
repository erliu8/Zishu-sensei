'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import {
  type MBTIType,
  type MBTIDimension,
  MBTI_DIMENSIONS,
  MBTI_TYPE_DESCRIPTIONS,
} from '../../types/personality';

interface MBTISelectorProps {
  value: MBTIType | null;
  onChange: (value: MBTIType | null) => void;
  className?: string;
}

export function MBTISelector({ value, onChange, className }: MBTISelectorProps) {
  // 解析当前 MBTI 类型为各个维度
  const currentDimensions = {
    EI: value?.[0] as MBTIDimension | null,
    SN: value?.[1] as MBTIDimension | null,
    TF: value?.[2] as MBTIDimension | null,
    JP: value?.[3] as MBTIDimension | null,
  };

  // 处理维度变化
  const handleDimensionChange = (dimension: 'EI' | 'SN' | 'TF' | 'JP', selected: MBTIDimension) => {
    const dimensions = { ...currentDimensions };
    dimensions[dimension] = selected;

    // 检查是否所有维度都已选择
    if (dimensions.EI && dimensions.SN && dimensions.TF && dimensions.JP) {
      const mbtiType = `${dimensions.EI}${dimensions.SN}${dimensions.TF}${dimensions.JP}` as MBTIType;
      onChange(mbtiType);
    } else {
      onChange(null);
    }
  };

  // 清除选择
  const handleClear = () => {
    onChange(null);
  };

  const currentTypeInfo = value ? MBTI_TYPE_DESCRIPTIONS[value] : null;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>MBTI 人格类型</CardTitle>
            <CardDescription>
              选择角色的 MBTI 人格类型，这将影响角色的基本性格特征
            </CardDescription>
          </div>
          {value && (
            <button
              onClick={handleClear}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              清除
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 当前选择的 MBTI 类型 */}
        {currentTypeInfo && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="text-lg px-3 py-1">
                  {value}
                </Badge>
                <div>
                  <h4 className="font-semibold">{currentTypeInfo.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {currentTypeInfo.description}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {currentTypeInfo.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 四个维度选择 */}
        <div className="space-y-6">
          {/* E/I - 外向/内向 */}
          <DimensionSelector
            dimension="EI"
            label={MBTI_DIMENSIONS.EI.fullName}
            options={[
              { value: 'E', ...MBTI_DIMENSIONS.EI.E },
              { value: 'I', ...MBTI_DIMENSIONS.EI.I },
            ]}
            selected={currentDimensions.EI}
            onChange={(val) => handleDimensionChange('EI', val)}
          />

          {/* S/N - 实感/直觉 */}
          <DimensionSelector
            dimension="SN"
            label={MBTI_DIMENSIONS.SN.fullName}
            options={[
              { value: 'S', ...MBTI_DIMENSIONS.SN.S },
              { value: 'N', ...MBTI_DIMENSIONS.SN.N },
            ]}
            selected={currentDimensions.SN}
            onChange={(val) => handleDimensionChange('SN', val)}
          />

          {/* T/F - 思考/情感 */}
          <DimensionSelector
            dimension="TF"
            label={MBTI_DIMENSIONS.TF.fullName}
            options={[
              { value: 'T', ...MBTI_DIMENSIONS.TF.T },
              { value: 'F', ...MBTI_DIMENSIONS.TF.F },
            ]}
            selected={currentDimensions.TF}
            onChange={(val) => handleDimensionChange('TF', val)}
          />

          {/* J/P - 判断/感知 */}
          <DimensionSelector
            dimension="JP"
            label={MBTI_DIMENSIONS.JP.fullName}
            options={[
              { value: 'J', ...MBTI_DIMENSIONS.JP.J },
              { value: 'P', ...MBTI_DIMENSIONS.JP.P },
            ]}
            selected={currentDimensions.JP}
            onChange={(val) => handleDimensionChange('JP', val)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// 维度选择器子组件
interface DimensionSelectorProps {
  dimension: string;
  label: string;
  options: Array<{ value: MBTIDimension; name: string; description: string }>;
  selected: MBTIDimension | null;
  onChange: (value: MBTIDimension) => void;
}

function DimensionSelector({ dimension, label, options, selected, onChange }: DimensionSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">{label}</Label>
      <RadioGroup
        value={selected || ''}
        onValueChange={(val) => onChange(val as MBTIDimension)}
        className="grid grid-cols-2 gap-4"
      >
        {options.map((option) => (
          <div key={option.value}>
            <RadioGroupItem
              value={option.value}
              id={`${dimension}-${option.value}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`${dimension}-${option.value}`}
              className={cn(
                'flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all',
                'hover:border-primary/50 hover:bg-accent/50',
                selected === option.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background'
              )}
            >
              <span className="font-semibold mb-1">{option.name}</span>
              <span className="text-sm text-muted-foreground">
                {option.description}
              </span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

