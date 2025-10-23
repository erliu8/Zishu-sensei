'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { cn } from '@/shared/utils/cn';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import {
  type BigFiveTraits,
  type BehaviorSettings,
  BIG_FIVE_TRAIT_DESCRIPTIONS,
} from '../../types/personality';

interface PersonalityRadarChartProps {
  bigFive: BigFiveTraits;
  behavior?: BehaviorSettings;
  showBehavior?: boolean;
  className?: string;
}

export function PersonalityRadarChart({
  bigFive,
  behavior,
  showBehavior = false,
  className,
}: PersonalityRadarChartProps) {
  // 大五人格数据
  const bigFiveData = [
    {
      trait: '开放性',
      fullName: BIG_FIVE_TRAIT_DESCRIPTIONS.openness.name,
      value: bigFive.openness,
      fullMark: 100,
    },
    {
      trait: '尽责性',
      fullName: BIG_FIVE_TRAIT_DESCRIPTIONS.conscientiousness.name,
      value: bigFive.conscientiousness,
      fullMark: 100,
    },
    {
      trait: '外向性',
      fullName: BIG_FIVE_TRAIT_DESCRIPTIONS.extraversion.name,
      value: bigFive.extraversion,
      fullMark: 100,
    },
    {
      trait: '宜人性',
      fullName: BIG_FIVE_TRAIT_DESCRIPTIONS.agreeableness.name,
      value: bigFive.agreeableness,
      fullMark: 100,
    },
    {
      trait: '神经质',
      fullName: BIG_FIVE_TRAIT_DESCRIPTIONS.neuroticism.name,
      value: bigFive.neuroticism,
      fullMark: 100,
    },
  ];

  // 行为特质数据（可选）
  const behaviorData = behavior
    ? [
        { trait: '正式', value: behavior.formality, fullMark: 100 },
        { trait: '热情', value: behavior.enthusiasm, fullMark: 100 },
        { trait: '创造', value: behavior.creativity, fullMark: 100 },
        { trait: '共情', value: behavior.empathy, fullMark: 100 },
        { trait: '自信', value: behavior.assertiveness, fullMark: 100 },
        { trait: '幽默', value: behavior.humor, fullMark: 100 },
        { trait: '耐心', value: behavior.patience, fullMark: 100 },
        { trait: '直接', value: behavior.directness, fullMark: 100 },
      ]
    : [];

  const chartData = showBehavior && behavior ? behaviorData : bigFiveData;

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold">{data.fullName || data.trait}</p>
          <p className="text-sm text-muted-foreground">
            数值: <span className="font-bold text-foreground">{data.value}</span> / 100
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>人格可视化</CardTitle>
        <CardDescription>
          {showBehavior ? '行为特质雷达图' : '大五人格特质雷达图'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={chartData}>
            <PolarGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="trait"
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            />
            <Radar
              name={showBehavior ? '行为特质' : '人格特质'}
              dataKey="value"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.6}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: '20px',
              }}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* 统计摘要 */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="最高特质"
            value={getHighestTrait(chartData)}
            variant="success"
          />
          <StatCard
            label="最低特质"
            value={getLowestTrait(chartData)}
            variant="warning"
          />
          <StatCard
            label="平均值"
            value={getAverageTrait(chartData)}
            variant="info"
          />
          <StatCard
            label="平衡度"
            value={getBalanceScore(chartData)}
            variant="default"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// 统计卡片组件
interface StatCardProps {
  label: string;
  value: string;
  variant?: 'default' | 'success' | 'warning' | 'info';
}

function StatCard({ label, value, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: 'bg-muted/50 border-border',
    success: 'bg-green-500/10 border-green-500/20',
    warning: 'bg-yellow-500/10 border-yellow-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div className={cn('p-3 rounded-lg border', variantStyles[variant])}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

// 辅助函数
function getHighestTrait(data: any[]): string {
  if (!data.length) return 'N/A';
  const highest = data.reduce((prev, current) =>
    prev.value > current.value ? prev : current
  );
  return `${highest.trait} (${highest.value})`;
}

function getLowestTrait(data: any[]): string {
  if (!data.length) return 'N/A';
  const lowest = data.reduce((prev, current) =>
    prev.value < current.value ? prev : current
  );
  return `${lowest.trait} (${lowest.value})`;
}

function getAverageTrait(data: any[]): string {
  if (!data.length) return 'N/A';
  const average = data.reduce((sum, item) => sum + item.value, 0) / data.length;
  return average.toFixed(1);
}

function getBalanceScore(data: any[]): string {
  if (!data.length) return 'N/A';
  
  const values = data.map((item) => item.value);
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // 平衡度: 标准差越小越平衡 (0-100 scale)
  const balance = Math.max(0, Math.min(100, 100 - stdDev));
  
  return balance.toFixed(1);
}

