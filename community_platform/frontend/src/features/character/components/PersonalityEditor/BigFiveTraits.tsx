'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { cn } from '@/shared/utils/cn';
import {
  type BigFiveTraits as BigFiveTraitsType,
  BIG_FIVE_TRAIT_DESCRIPTIONS,
} from '../../types/personality';

interface BigFiveTraitsProps {
  value: BigFiveTraitsType;
  onChange: (value: BigFiveTraitsType) => void;
  className?: string;
}

export function BigFiveTraits({ value, onChange, className }: BigFiveTraitsProps) {
  const handleTraitChange = (trait: keyof BigFiveTraitsType, newValue: number[]) => {
    onChange({
      ...value,
      [trait]: newValue[0],
    });
  };

  const traits: Array<keyof BigFiveTraitsType> = [
    'openness',
    'conscientiousness',
    'extraversion',
    'agreeableness',
    'neuroticism',
  ];

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>大五人格特质</CardTitle>
        <CardDescription>
          调整五大核心人格维度，塑造角色的性格基础
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {traits.map((trait) => {
          const traitInfo = BIG_FIVE_TRAIT_DESCRIPTIONS[trait];
          const traitValue = value[trait];

          return (
            <div key={trait} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">
                    {traitInfo.name}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {traitInfo.description}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold tabular-nums">
                    {traitValue}
                  </span>
                  <span className="text-muted-foreground">/100</span>
                </div>
              </div>

              <div className="space-y-2">
                <Slider
                  value={[traitValue]}
                  onValueChange={(newValue) => handleTraitChange(trait, newValue)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className={cn(
                    'transition-colors',
                    traitValue <= 30 && 'text-foreground font-medium'
                  )}>
                    {traitInfo.low}
                  </span>
                  <span className={cn(
                    'transition-colors',
                    traitValue >= 70 && 'text-foreground font-medium'
                  )}>
                    {traitInfo.high}
                  </span>
                </div>
              </div>

              {/* 视觉化指示器 */}
              <div className="flex gap-1 h-2">
                {Array.from({ length: 10 }).map((_, idx) => {
                  const segmentValue = (idx + 1) * 10;
                  const isActive = traitValue >= segmentValue;
                  
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex-1 rounded-sm transition-all',
                        isActive
                          ? 'bg-primary'
                          : 'bg-muted'
                      )}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

