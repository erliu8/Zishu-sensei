/**
 * PhysicsConfig 组件
 * 物理参数配置（重力、风力、弹性、阻尼）
 */

'use client';

import React from 'react';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';
import { RotateCcw, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/utils';
import type { PhysicsConfig as PhysicsConfigType } from '../../domain';

export interface PhysicsConfigProps {
  /** 物理参数配置 */
  config: PhysicsConfigType;
  /** 配置变化回调 */
  onChange: (config: PhysicsConfigType) => void;
  /** 重置为默认值回调 */
  onReset?: () => void;
  /** 是否启用物理效果 */
  enabled?: boolean;
  /** 启用状态变化回调 */
  onEnabledChange?: (enabled: boolean) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
}

const DEFAULT_PHYSICS: PhysicsConfigType = {
  gravity: 1.0,
  wind: 0.0,
  elasticity: 0.5,
  damping: 0.5,
};

export const PhysicsConfig: React.FC<PhysicsConfigProps> = ({
  config,
  onChange,
  onReset,
  enabled = true,
  onEnabledChange,
  disabled = false,
  className,
}) => {
  // 判断是否使用默认值
  const isDefault =
    config.gravity === DEFAULT_PHYSICS.gravity &&
    config.wind === DEFAULT_PHYSICS.wind &&
    config.elasticity === DEFAULT_PHYSICS.elasticity &&
    config.damping === DEFAULT_PHYSICS.damping;

  const handleReset = () => {
    onChange(DEFAULT_PHYSICS);
    onReset?.();
  };

  const handleChange = (key: keyof PhysicsConfigType, value: number) => {
    onChange({
      ...config,
      [key]: value,
    });
  };

  const isControlDisabled = disabled || !enabled;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle>物理参数配置</CardTitle>
              {onEnabledChange && (
                <div className="flex items-center gap-2 ml-4">
                  <Switch
                    id="physics-enabled"
                    checked={enabled}
                    onCheckedChange={onEnabledChange}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor="physics-enabled"
                    className="text-sm font-normal cursor-pointer"
                  >
                    启用物理效果
                  </Label>
                </div>
              )}
            </div>
            <CardDescription>
              调整模型的物理参数，控制头发、衣物等部件的运动效果
            </CardDescription>
          </div>
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isControlDisabled || isDefault}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              重置
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 重力 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="gravity" className="text-sm font-medium">
                重力 (Gravity)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>控制下垂效果的强度，值越大下垂越明显</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm text-muted-foreground">
              {config.gravity.toFixed(1)}
            </span>
          </div>
          <Slider
            id="gravity"
            min={0}
            max={10}
            step={0.1}
            value={[config.gravity || 0]}
            onValueChange={([value]) => handleChange('gravity', value ?? 0)}
            disabled={isControlDisabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>无重力 (0)</span>
            <span>标准 (1.0)</span>
            <span>强重力 (10)</span>
          </div>
        </div>

        {/* 风力 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="wind" className="text-sm font-medium">
                风力 (Wind)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>模拟风吹效果，值越大摆动越明显</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm text-muted-foreground">
              {config.wind.toFixed(1)}
            </span>
          </div>
          <Slider
            id="wind"
            min={0}
            max={10}
            step={0.1}
            value={[config.wind || 0]}
            onValueChange={([value]) => handleChange('wind', value ?? 0)}
            disabled={isControlDisabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>无风 (0)</span>
            <span>微风 (2.0)</span>
            <span>强风 (10)</span>
          </div>
        </div>

        {/* 弹性 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="elasticity" className="text-sm font-medium">
                弹性 (Elasticity)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>控制回弹效果，值越大回弹越强</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm text-muted-foreground">
              {(config.elasticity * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            id="elasticity"
            min={0}
            max={1}
            step={0.01}
            value={[config.elasticity || 0]}
            onValueChange={([value]) => handleChange('elasticity', value ?? 0)}
            disabled={isControlDisabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>无弹性 (0%)</span>
            <span>中等 (50%)</span>
            <span>高弹性 (100%)</span>
          </div>
        </div>

        {/* 阻尼 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="damping" className="text-sm font-medium">
                阻尼 (Damping)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>控制运动衰减速度，值越大停止越快</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm text-muted-foreground">
              {(config.damping * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            id="damping"
            min={0}
            max={1}
            step={0.01}
            value={[config.damping || 0]}
            onValueChange={([value]) => handleChange('damping', value ?? 0)}
            disabled={isControlDisabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>无阻尼 (0%)</span>
            <span>中等 (50%)</span>
            <span>高阻尼 (100%)</span>
          </div>
        </div>

        {/* 参数说明 */}
        <div className="rounded-lg bg-muted/50 p-4">
          <h4 className="text-sm font-medium mb-2">参数说明</h4>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>• <strong>重力</strong>: 影响头发、衣物等部件的下垂程度</li>
            <li>• <strong>风力</strong>: 模拟环境风力对可动部件的影响</li>
            <li>• <strong>弹性</strong>: 部件受力后的回弹效果，值越大越有弹性</li>
            <li>• <strong>阻尼</strong>: 运动的衰减速度，值越大运动停止越快</li>
          </ul>
        </div>

        {/* 预设方案 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">快速预设</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  gravity: 0.5,
                  wind: 0.5,
                  elasticity: 0.8,
                  damping: 0.3,
                })
              }
              disabled={isControlDisabled}
              className="text-xs"
            >
              轻盈
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  gravity: 1.0,
                  wind: 0.0,
                  elasticity: 0.5,
                  damping: 0.5,
                })
              }
              disabled={isControlDisabled}
              className="text-xs"
            >
              标准
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  gravity: 1.5,
                  wind: 0.0,
                  elasticity: 0.3,
                  damping: 0.7,
                })
              }
              disabled={isControlDisabled}
              className="text-xs"
            >
              厚重
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  gravity: 0.3,
                  wind: 3.0,
                  elasticity: 0.9,
                  damping: 0.2,
                })
              }
              disabled={isControlDisabled}
              className="text-xs"
            >
              飘逸
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

PhysicsConfig.displayName = 'PhysicsConfig';

