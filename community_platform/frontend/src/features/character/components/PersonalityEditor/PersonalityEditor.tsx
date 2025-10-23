'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { cn } from '@/shared/utils/cn';
import { Brain, Heart, Target, BarChart3, Save, RotateCcw } from 'lucide-react';
import { MBTISelector } from './MBTISelector';
import { BigFiveTraits } from './BigFiveTraits';
import { BehaviorSettings } from './BehaviorSettings';
import { PersonalityRadarChart } from './PersonalityRadarChart';
import {
  type Personality,
  DEFAULT_PERSONALITY,
  MBTI_TYPE_DESCRIPTIONS,
} from '../../types/personality';

interface PersonalityEditorProps {
  value: Personality;
  onChange: (value: Personality) => void;
  onSave?: (value: Personality) => void;
  onReset?: () => void;
  className?: string;
  showActions?: boolean;
}

export function PersonalityEditor({
  value,
  onChange,
  onSave,
  onReset,
  className,
  showActions = true,
}: PersonalityEditorProps) {
  const [activeTab, setActiveTab] = useState('mbti');
  const [isSaving, setIsSaving] = useState(false);

  // 处理保存
  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(value);
    } finally {
      setIsSaving(false);
    }
  };

  // 处理重置
  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onChange(DEFAULT_PERSONALITY);
    }
  };

  // 处理描述变化
  const handleDescriptionChange = (description: string) => {
    onChange({ ...value, description });
  };

  // 检查是否已修改
  const hasChanges = JSON.stringify(value) !== JSON.stringify(DEFAULT_PERSONALITY);

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* 顶部摘要卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>人格编辑器</CardTitle>
              <CardDescription>
                配置角色的人格特质和行为模式，塑造独特的AI人格
              </CardDescription>
            </div>
            {showActions && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={!hasChanges}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  重置
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? '保存中...' : '保存'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* 当前人格摘要 */}
          <div className="flex flex-wrap gap-4">
            {value.mbtiType && (
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">MBTI:</span>
                <Badge variant="default">{value.mbtiType}</Badge>
                <span className="text-sm">
                  {MBTI_TYPE_DESCRIPTIONS[value.mbtiType].name}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 主编辑区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mbti" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">MBTI</span>
          </TabsTrigger>
          <TabsTrigger value="bigfive" className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            <span className="hidden sm:inline">大五人格</span>
          </TabsTrigger>
          <TabsTrigger value="behavior" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span className="hidden sm:inline">行为设定</span>
          </TabsTrigger>
          <TabsTrigger value="visualization" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">可视化</span>
          </TabsTrigger>
        </TabsList>

        {/* MBTI 选择器 */}
        <TabsContent value="mbti" className="space-y-6 mt-6">
          <MBTISelector
            value={value.mbtiType}
            onChange={(mbtiType) => onChange({ ...value, mbtiType })}
          />
        </TabsContent>

        {/* 大五人格特质 */}
        <TabsContent value="bigfive" className="space-y-6 mt-6">
          <BigFiveTraits
            value={value.bigFive}
            onChange={(bigFive) => onChange({ ...value, bigFive })}
          />
        </TabsContent>

        {/* 行为设定 */}
        <TabsContent value="behavior" className="space-y-6 mt-6">
          <BehaviorSettings
            value={value.behavior}
            onChange={(behavior) => onChange({ ...value, behavior })}
          />
        </TabsContent>

        {/* 可视化 */}
        <TabsContent value="visualization" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <PersonalityRadarChart
              bigFive={value.bigFive}
              showBehavior={false}
            />
            <PersonalityRadarChart
              bigFive={value.bigFive}
              behavior={value.behavior}
              showBehavior={true}
            />
          </div>

          {/* AI 生成的人格描述建议 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">人格洞察</CardTitle>
              <CardDescription>
                基于当前配置的人格特质分析
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PersonalityInsights personality={value} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 人格描述 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">人格描述</CardTitle>
          <CardDescription>
            用文字描述角色的人格特点，这将帮助AI更好地理解角色
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={value.description || ''}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="例如: 这是一个充满好奇心和创造力的角色，喜欢探索新事物，对人友善但也保持独立思考..."
            className="min-h-[120px]"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {value.description?.length || 0} / 1000 字符
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// 人格洞察组件
interface PersonalityInsightsProps {
  personality: Personality;
}

function PersonalityInsights({ personality }: PersonalityInsightsProps) {
  const { mbtiType, bigFive, behavior } = personality;

  // 生成洞察
  const insights: Array<{ type: 'strength' | 'challenge' | 'suggestion'; content: string }> = [];

  // MBTI 相关洞察
  if (mbtiType) {
    const mbtiInfo = MBTI_TYPE_DESCRIPTIONS[mbtiType];
    insights.push({
      type: 'strength',
      content: `作为 ${mbtiType} (${mbtiInfo.name})，该角色具有 ${mbtiInfo.keywords.join('、')} 的特质。`,
    });
  }

  // 大五人格洞察
  if (bigFive.openness >= 70) {
    insights.push({
      type: 'strength',
      content: '高开放性使角色富有想象力和创造力，善于接受新想法。',
    });
  } else if (bigFive.openness <= 30) {
    insights.push({
      type: 'challenge',
      content: '较低的开放性可能使角色更倾向于传统和常规，对新事物较为保守。',
    });
  }

  if (bigFive.extraversion >= 70) {
    insights.push({
      type: 'strength',
      content: '高外向性使角色充满活力，善于社交和表达。',
    });
  } else if (bigFive.extraversion <= 30) {
    insights.push({
      type: 'suggestion',
      content: '内向性格可能需要更多独处时间，在深度对话中表现更好。',
    });
  }

  if (bigFive.conscientiousness >= 70) {
    insights.push({
      type: 'strength',
      content: '高尽责性体现了角色的可靠、有组织和自律特质。',
    });
  }

  // 行为特质洞察
  if (behavior.empathy >= 70 && behavior.patience >= 70) {
    insights.push({
      type: 'strength',
      content: '高共情力和耐心使角色成为优秀的倾听者和支持者。',
    });
  }

  if (behavior.creativity >= 70 && behavior.humor >= 70) {
    insights.push({
      type: 'strength',
      content: '创造力和幽默感的结合让角色在交流中富有趣味性和独特性。',
    });
  }

  // 如果没有生成洞察，提供默认信息
  if (insights.length === 0) {
    insights.push({
      type: 'suggestion',
      content: '继续配置人格特质以获取更详细的洞察分析。',
    });
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, idx) => (
        <div
          key={idx}
          className={cn(
            'p-3 rounded-lg border-l-4',
            insight.type === 'strength' && 'bg-green-500/10 border-green-500',
            insight.type === 'challenge' && 'bg-yellow-500/10 border-yellow-500',
            insight.type === 'suggestion' && 'bg-blue-500/10 border-blue-500'
          )}
        >
          <p className="text-sm">{insight.content}</p>
        </div>
      ))}
    </div>
  );
}

