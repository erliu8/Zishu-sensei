/**
 * TaskStatsCard Component
 * 任务统计卡片组件
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Package, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { PackagingTaskStats } from '../domain/packaging.types';

/**
 * TaskStatsCard Props
 */
export interface TaskStatsCardProps {
  /** 统计数据 */
  stats: PackagingTaskStats;
  /** 自定义类名 */
  className?: string;
}

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
};

/**
 * 格式化时间
 */
const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes} 分 ${remainingSeconds} 秒`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} 小时 ${remainingMinutes} 分`;
};

/**
 * TaskStatsCard Component
 */
export const TaskStatsCard: React.FC<TaskStatsCardProps> = ({ stats, className }) => {
  return (
    <div className={className}>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 总任务数 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总任务数</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">
              进行中 {stats.inProgressTasks + stats.pendingTasks} 个
            </p>
          </CardContent>
        </Card>

        {/* 已完成 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已完成</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">
              成功率 {stats.successRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* 失败任务 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">失败任务</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failedTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">
              失败率 {((stats.failedTasks / Math.max(stats.totalTasks, 1)) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* 平均耗时 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均耗时</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(Math.round(stats.avgCompletionTime))}</div>
            <p className="text-xs text-muted-foreground mt-1">
              总文件大小 {formatFileSize(stats.totalFileSize)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

