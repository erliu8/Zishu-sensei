/**
 * PackagingProgress Component
 * 打包进度组件
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Download,
  AlertCircle,
  X,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import type { PackagingTask, PackagingStatus } from '../domain/packaging.types';
import { PackagingTaskDomain } from '../domain/PackagingTask';

/**
 * PackagingProgress Props
 */
export interface PackagingProgressProps {
  /** 打包任务 */
  task: PackagingTask;
  /** 下载回调 */
  onDownload?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 重试回调 */
  onRetry?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * 获取状态图标
 */
const getStatusIcon = (status: PackagingStatus) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'cancelled':
      return <X className="h-5 w-5 text-gray-500" />;
    case 'packaging':
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case 'queued':
      return <Clock className="h-5 w-5 text-yellow-500" />;
    default:
      return <Clock className="h-5 w-5 text-gray-500" />;
  }
};

/**
 * PackagingProgress Component
 */
export const PackagingProgress: React.FC<PackagingProgressProps> = ({
  task,
  onDownload,
  onCancel,
  onRetry,
  className,
}) => {
  const isInProgress = PackagingTaskDomain.isInProgress(task);
  const isCompleted = PackagingTaskDomain.isCompleted(task);
  const isFailed = PackagingTaskDomain.isFailed(task);
  const isCancellable = PackagingTaskDomain.isCancellable(task);
  const isDownloadable = PackagingTaskDomain.isDownloadable(task);
  const canRetry = PackagingTaskDomain.canRetry(task);

  const statusColor = PackagingTaskDomain.getStatusColor(task.status);
  const statusText = PackagingTaskDomain.getStatusText(task.status);
  const duration = PackagingTaskDomain.formatDuration(task);
  const estimatedRemaining = PackagingTaskDomain.formatEstimatedRemaining(task);

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(task.status)}
            <div>
              <CardTitle className="text-lg">
                {PackagingTaskDomain.getSummary(task)}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className={cn(
                  statusColor === 'green' && 'bg-green-100 text-green-800',
                  statusColor === 'red' && 'bg-red-100 text-red-800',
                  statusColor === 'blue' && 'bg-blue-100 text-blue-800',
                  statusColor === 'yellow' && 'bg-yellow-100 text-yellow-800',
                  statusColor === 'gray' && 'bg-gray-100 text-gray-800',
                )}>
                  {statusText}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  任务 ID: {task.id}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {isCancellable && onCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCancel}
              >
                取消
              </Button>
            )}
            {canRetry && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
              >
                重试
              </Button>
            )}
            {isDownloadable && onDownload && (
              <Button
                size="sm"
                onClick={onDownload}
              >
                <Download className="h-4 w-4 mr-1" />
                下载
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 进度条 */}
        {isInProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {task.currentStep || '准备中...'}
              </span>
              <span className="font-medium">{task.progress}%</span>
            </div>
            <Progress value={task.progress} className="h-2" />
            {task.totalSteps && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  步骤 {task.currentStep ? `${task.currentStep} / ${task.totalSteps}` : '...'}
                </span>
                <span>预计剩余: {estimatedRemaining}</span>
              </div>
            )}
          </div>
        )}

        {/* 已完成进度 */}
        {isCompleted && (
          <div className="space-y-2">
            <Progress value={100} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="text-green-600 font-medium">打包完成</span>
              <span className="text-muted-foreground">耗时: {duration}</span>
            </div>
          </div>
        )}

        {/* 统计信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">平台</p>
            <p className="text-sm font-medium">
              {task.config.platform.toUpperCase()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">架构</p>
            <p className="text-sm font-medium">
              {task.config.architecture.toUpperCase()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">格式</p>
            <p className="text-sm font-medium">
              {task.config.format.toUpperCase()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {isCompleted ? '文件大小' : '预计大小'}
            </p>
            <p className="text-sm font-medium">
              {PackagingTaskDomain.formatFileSize(task.fileSize)}
            </p>
          </div>
        </div>

        {/* 错误信息 */}
        {isFailed && task.error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-900">错误信息</p>
              <p className="text-sm text-red-700 mt-1">{task.error}</p>
            </div>
          </div>
        )}

        {/* 警告信息 */}
        {task.warnings && task.warnings.length > 0 && (
          <div className="space-y-2">
            {task.warnings.map((warning, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md"
              >
                <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">{warning}</p>
              </div>
            ))}
          </div>
        )}

        {/* 下载信息 */}
        {isDownloadable && task.expiresAt && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-900">
                文件可下载
              </span>
            </div>
            <span className="text-xs text-blue-700">
              有效期: {PackagingTaskDomain.formatRemainingTime(task)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

