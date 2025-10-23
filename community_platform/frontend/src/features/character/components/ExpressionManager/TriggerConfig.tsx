/**
 * 触发条件配置组件
 * @module features/character/components/ExpressionManager/TriggerConfig
 */

'use client';

import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Slider } from '@/shared/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import type { TriggerCondition, TriggerType } from '../../domain/expression';
import { ExpressionUtils } from '../../domain/expression';
import { TriggerType as TriggerTypeEnum } from '../../domain/expression';
import { cn } from '@/shared/utils/cn';

interface TriggerConfigProps {
  triggers: TriggerCondition[];
  onChange: (triggers: TriggerCondition[]) => void;
  className?: string;
}

export function TriggerConfig({ triggers, onChange, className }: TriggerConfigProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAddTrigger = () => {
    const newTrigger = ExpressionUtils.createDefaultTrigger(TriggerTypeEnum.EMOTION);
    onChange([...triggers, newTrigger]);
    setExpandedId(newTrigger.id);
  };

  const handleRemoveTrigger = (id: string) => {
    onChange(triggers.filter((t) => t.id !== id));
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  const handleUpdateTrigger = (id: string, updates: Partial<TriggerCondition>) => {
    onChange(
      triggers.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const handleDuplicateTrigger = (trigger: TriggerCondition) => {
    const newTrigger = {
      ...trigger,
      id: ExpressionUtils.generateTriggerId(),
    };
    onChange([...triggers, newTrigger]);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">触发条件</h3>
          <p className="text-sm text-muted-foreground">
            配置表情触发的条件和规则
          </p>
        </div>
        <Button onClick={handleAddTrigger} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          添加条件
        </Button>
      </div>

      {triggers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              暂无触发条件
              <br />
              <span className="text-sm">点击上方按钮添加触发条件</span>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {triggers.map((trigger, index) => (
            <TriggerItem
              key={trigger.id}
              trigger={trigger}
              index={index}
              isExpanded={expandedId === trigger.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === trigger.id ? null : trigger.id)
              }
              onUpdate={(updates) => handleUpdateTrigger(trigger.id, updates)}
              onRemove={() => handleRemoveTrigger(trigger.id)}
              onDuplicate={() => handleDuplicateTrigger(trigger)}
            />
          ))}
        </div>
      )}

      {triggers.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            优先级数字越大，触发优先级越高。阈值范围为 0-1，表示触发的置信度要求。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface TriggerItemProps {
  trigger: TriggerCondition;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<TriggerCondition>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

function TriggerItem({
  trigger,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onRemove,
  onDuplicate,
}: TriggerItemProps) {
  const validation = ExpressionUtils.validateTrigger(trigger);

  return (
    <Card
      className={cn(
        'transition-all',
        isExpanded && 'ring-2 ring-primary',
        !validation.isValid && 'border-destructive'
      )}
    >
      <CardHeader className="cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
            <div>
              <CardTitle className="text-base">
                触发条件 {index + 1}
                {!validation.isValid && (
                  <Badge variant="destructive" className="ml-2">
                    错误
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {ExpressionUtils.getTriggerTypeDisplayName(trigger.type)}
                {trigger.value && ` · ${String(trigger.value).substring(0, 30)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              复制
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {!validation.isValid && validation.errors && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {validation.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.warnings && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {validation.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4">
            {/* 触发类型 */}
            <div className="space-y-2">
              <Label>触发类型</Label>
              <Select
                value={trigger.type}
                onValueChange={(value: TriggerType) => onUpdate({ type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TriggerTypeEnum).map((type) => (
                    <SelectItem key={type} value={type}>
                      {ExpressionUtils.getTriggerTypeDisplayName(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 触发值 */}
            <div className="space-y-2">
              <Label>
                触发值
                {trigger.type === TriggerTypeEnum.KEYWORD && (
                  <span className="text-xs text-muted-foreground ml-2">
                    （多个关键词用逗号分隔）
                  </span>
                )}
              </Label>
              {trigger.type === TriggerTypeEnum.KEYWORD ? (
                <Input
                  value={Array.isArray(trigger.value) ? trigger.value.join(', ') : trigger.value}
                  onChange={(e) => {
                    const keywords = e.target.value.split(',').map((k) => k.trim());
                    onUpdate({ value: keywords });
                  }}
                  placeholder="例如：你好, 早安, 晚安"
                />
              ) : (
                <Input
                  value={String(trigger.value)}
                  onChange={(e) => onUpdate({ value: e.target.value })}
                  placeholder={getTriggerValuePlaceholder(trigger.type)}
                />
              )}
            </div>

            {/* 触发阈值 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>触发阈值</Label>
                <span className="text-sm text-muted-foreground">
                  {((trigger.threshold || 0.5) * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[trigger.threshold || 0.5]}
                onValueChange={([value]) => onUpdate({ threshold: value })}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                触发此表情需要的最低置信度
              </p>
            </div>

            {/* 优先级 */}
            <div className="space-y-2">
              <Label>优先级</Label>
              <Input
                type="number"
                value={trigger.priority || 1}
                onChange={(e) => onUpdate({ priority: parseInt(e.target.value) || 1 })}
                min={1}
                max={100}
              />
              <p className="text-xs text-muted-foreground">
                数字越大优先级越高（1-100）
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function getTriggerValuePlaceholder(type: TriggerType): string {
  const placeholders: Record<TriggerType, string> = {
    [TriggerTypeEnum.EMOTION]: '例如：happy, sad, angry',
    [TriggerTypeEnum.KEYWORD]: '例如：你好, 早安',
    [TriggerTypeEnum.CONTEXT]: '例如：conversation_start, conversation_end',
    [TriggerTypeEnum.RANDOM]: '触发概率 (0-1)',
    [TriggerTypeEnum.TIME]: '时间范围（如：09:00-12:00）',
    [TriggerTypeEnum.USER_ACTION]: '例如：click, hover, long_press',
  };

  return placeholders[type] || '请输入触发值';
}

