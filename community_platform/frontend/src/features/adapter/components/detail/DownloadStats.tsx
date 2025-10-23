/**
 * 下载统计组件
 * @module features/adapter/components/detail
 */

'use client';

import { useState, useMemo } from 'react';
import { 
  Download, 
  TrendingUp, 
  Users, 
  Calendar, 
  Globe,
  BarChart3,
} from 'lucide-react';
import {
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components';
import type { AdapterStats } from '../../domain';
import { cn } from '@/shared/utils';

/**
 * 下载统计组件属性
 */
export interface DownloadStatsProps {
  /** 适配器ID */
  adapterId: string;
  /** 统计数据 */
  stats: AdapterStats;
  /** 类名 */
  className?: string;
}

/**
 * 时间范围选项
 */
type TimeRange = '7d' | '30d' | '90d' | 'all';

/**
 * 统计卡片组件
 */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  className?: string;
}

function StatCard({ icon, label, value, trend, description, className }: StatCardProps) {
  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold">{value}</div>
          </div>
        </div>
        {trend && (
          <Badge variant={trend.isPositive ? 'default' : 'secondary'} className="gap-1">
            <TrendingUp className={cn('h-3 w-3', !trend.isPositive && 'rotate-180')} />
            {Math.abs(trend.value)}%
          </Badge>
        )}
      </div>
      {description && (
        <div className="text-xs text-muted-foreground">{description}</div>
      )}
    </Card>
  );
}

/**
 * 简单条形图组件
 */
interface SimpleBarChartProps {
  data: { label: string; value: number }[];
  maxValue?: number;
}

function SimpleBarChart({ data, maxValue }: SimpleBarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value));

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{item.label}</span>
            <span className="text-muted-foreground">{item.value.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 格式化数字
 */
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

/**
 * 下载统计组件
 */
export function DownloadStats({ adapterId, stats, className }: DownloadStatsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // 模拟趋势数据
  const trendData = useMemo(() => ({
    downloads: { value: 15.3, isPositive: true },
    views: { value: 23.7, isPositive: true },
    favorites: { value: 8.2, isPositive: true },
    likes: { value: 12.5, isPositive: true },
  }), []);

  // 模拟地区分布数据
  const regionData = useMemo(() => [
    { label: '中国', value: Math.floor(stats.downloads * 0.45) },
    { label: '美国', value: Math.floor(stats.downloads * 0.25) },
    { label: '日本', value: Math.floor(stats.downloads * 0.15) },
    { label: '欧洲', value: Math.floor(stats.downloads * 0.10) },
    { label: '其他', value: Math.floor(stats.downloads * 0.05) },
  ], [stats.downloads]);

  // 模拟版本分布数据
  const versionData = useMemo(() => [
    { label: 'v2.0.0 (最新)', value: Math.floor(stats.downloads * 0.60) },
    { label: 'v1.9.0', value: Math.floor(stats.downloads * 0.25) },
    { label: 'v1.8.0', value: Math.floor(stats.downloads * 0.10) },
    { label: '其他版本', value: Math.floor(stats.downloads * 0.05) },
  ], [stats.downloads]);

  // 模拟每日下载趋势（简化的折线数据）
  const dailyDownloads = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const data: { label: string; value: number }[] = [];
    const baseValue = stats.downloads / days;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const variation = 0.8 + Math.random() * 0.4; // 0.8-1.2倍的随机变化
      data.push({
        label: i === 0 ? '今天' : i === 1 ? '昨天' : `${i}天前`,
        value: Math.floor(baseValue * variation),
      });
    }
    
    return data;
  }, [stats.downloads, timeRange]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* 时间范围选择器 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">统计数据</h3>
        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">最近7天</SelectItem>
            <SelectItem value="30d">最近30天</SelectItem>
            <SelectItem value="90d">最近90天</SelectItem>
            <SelectItem value="all">全部时间</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Download className="h-5 w-5 text-primary" />}
          label="总下载量"
          value={formatNumber(stats.downloads)}
          trend={trendData.downloads}
          description={`${timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : timeRange === '90d' ? '90' : ''}天内增长`}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-500" />}
          label="浏览量"
          value={formatNumber(stats.views)}
          trend={trendData.views}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-green-500" />}
          label="收藏数"
          value={formatNumber(stats.favorites)}
          trend={trendData.favorites}
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-purple-500" />}
          label="点赞数"
          value={formatNumber(stats.likes)}
          trend={trendData.likes}
        />
      </div>

      {/* 详细统计标签页 */}
      <Card className="p-6">
        <Tabs defaultValue="daily">
          <TabsList className="mb-6">
            <TabsTrigger value="daily">
              <Calendar className="mr-2 h-4 w-4" />
              每日趋势
            </TabsTrigger>
            <TabsTrigger value="region">
              <Globe className="mr-2 h-4 w-4" />
              地区分布
            </TabsTrigger>
            <TabsTrigger value="version">
              <Download className="mr-2 h-4 w-4" />
              版本分布
            </TabsTrigger>
          </TabsList>

          {/* 每日趋势 */}
          <TabsContent value="daily" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">每日下载趋势</h4>
              <div className="text-sm text-muted-foreground">
                显示最近 {timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : timeRange === '90d' ? '90' : '365'} 天
              </div>
            </div>

            {/* 简化的趋势可视化 */}
            <div className="space-y-3">
              {dailyDownloads.slice(-10).map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-muted-foreground">{item.value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                      style={{
                        width: `${(item.value / Math.max(...dailyDownloads.map(d => d.value))) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">平均每日</div>
                  <div className="font-semibold">
                    {Math.floor(stats.downloads / (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365))}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">峰值</div>
                  <div className="font-semibold">{Math.max(...dailyDownloads.map(d => d.value)).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">谷值</div>
                  <div className="font-semibold">{Math.min(...dailyDownloads.map(d => d.value)).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">增长率</div>
                  <div className="font-semibold text-green-500">+{trendData.downloads.value}%</div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 地区分布 */}
          <TabsContent value="region" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">下载地区分布</h4>
              <div className="text-sm text-muted-foreground">
                总计 {stats.downloads.toLocaleString()} 次下载
              </div>
            </div>

            <SimpleBarChart data={regionData} />

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4" />
                  <span className="font-medium">地区分析</span>
                </div>
                <p>您的适配器在{regionData[0].label}最受欢迎，占总下载量的 {((regionData[0].value / stats.downloads) * 100).toFixed(1)}%</p>
              </div>
            </div>
          </TabsContent>

          {/* 版本分布 */}
          <TabsContent value="version" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">版本下载分布</h4>
              <Badge variant="outline">4 个版本</Badge>
            </div>

            <SimpleBarChart data={versionData} />

            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-4 w-4" />
                  <span className="font-medium">版本采用率</span>
                </div>
                <p>
                  最新版本 (v2.0.0) 的采用率为 {((versionData[0].value / stats.downloads) * 100).toFixed(1)}%，
                  表明用户积极升级到新版本
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* 其他统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h4 className="font-semibold mb-4">用户互动</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">评论数</span>
              <span className="font-medium">{stats.comments.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">分享数</span>
              <span className="font-medium">{stats.shares.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">评分人数</span>
              <span className="font-medium">{stats.ratingCount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">平均评分</span>
              <span className="font-medium">{stats.rating.toFixed(1)} / 5.0</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold mb-4">转化率</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">浏览转下载</span>
              <span className="font-medium">{((stats.downloads / stats.views) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">下载转收藏</span>
              <span className="font-medium">{((stats.favorites / stats.downloads) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">浏览转评分</span>
              <span className="font-medium">{((stats.ratingCount / stats.views) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">下载转评论</span>
              <span className="font-medium">{((stats.comments / stats.downloads) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

