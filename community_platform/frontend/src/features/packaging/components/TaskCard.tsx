/**
 * TaskCard Component
 * 打包任务卡片组件
 */

'use client';

import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Download,
  MoreVertical,
  Trash2,
  RefreshCw,
  X,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import type { PackagingTask } from '../domain/packaging.types';
import { PackagingTaskDomain } from '../domain/PackagingTask';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * TaskCard Props
 */
export interface TaskCardProps {
  /** 任务 */
  task: PackagingTask;
  /** 点击查看详情 */
  onViewDetails?: () => void;
  /** 下载回调 */
  onDownload?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 删除回调 */
  onDelete?: () => void;
  /** 重试回调 */
  onRetry?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * TaskCard Component
 */
export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onViewDetails,
  onDownload,
  onCancel,
  onDelete,
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

  const getStatusIcon = () => {
    if (isCompleted) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (isFailed) return <XCircle className="h-4 w-4 text-red-500" />;
    if (isInProgress) return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    return <Clock className="h-4 w-4 text-gray-500" />;
  };

  return (
    <Card className={cn('group hover:shadow-md transition-all', className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <h3
                  className="font-semibold line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                  onClick={onViewDetails}
                >
                  {task.config.appName}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">
                v{task.config.version} · {task.config.platform.toUpperCase()} · {task.config.architecture.toUpperCase()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  'shrink-0',
                  statusColor === 'green' && 'bg-green-100 text-green-800',
                  statusColor === 'red' && 'bg-red-100 text-red-800',
                  statusColor === 'blue' && 'bg-blue-100 text-blue-800',
                  statusColor === 'yellow' && 'bg-yellow-100 text-yellow-800',
                  statusColor === 'gray' && 'bg-gray-100 text-gray-800'
                )}
              >
                {statusText}
              </Badge>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onViewDetails && (
                    <DropdownMenuItem onClick={onViewDetails}>
                      <Eye className="h-4 w-4 mr-2" />
                      查看详情
                    </DropdownMenuItem>
                  )}
                  {isDownloadable && onDownload && (
                    <DropdownMenuItem onClick={onDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      下载
                    </DropdownMenuItem>
                  )}
                  {isCancellable && onCancel && (
                    <DropdownMenuItem onClick={onCancel}>
                      <X className="h-4 w-4 mr-2" />
                      取消任务
                    </DropdownMenuItem>
                  )}
                  {canRetry && onRetry && (
                    <DropdownMenuItem onClick={onRetry}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      重试
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Progress */}
          {isInProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground text-xs">
                  {task.currentStep || '准备中...'}
                </span>
                <span className="text-xs font-medium">{task.progress}%</span>
              </div>
              <Progress value={task.progress} className="h-1.5" />
            </div>
          )}

          {/* Error Message */}
          {isFailed && task.error && (
            <p className="text-sm text-red-600 line-clamp-2">{task.error}</p>
          )}

          {/* Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              {task.completedAt && (
                <span>
                  完成时间: {format(new Date(task.completedAt), 'MM-dd HH:mm', { locale: zhCN })}
                </span>
              )}
              {!task.completedAt && task.createdAt && (
                <span>
                  创建时间: {format(new Date(task.createdAt), 'MM-dd HH:mm', { locale: zhCN })}
                </span>
              )}
            </div>
            {task.fileSize && (
              <span>{PackagingTaskDomain.formatFileSize(task.fileSize)}</span>
            )}
          </div>

          {/* Download Info */}
          {isDownloadable && task.expiresAt && (
            <div className="flex items-center justify-between text-xs pt-2 border-t">
              <span className="text-muted-foreground">
                有效期: {PackagingTaskDomain.formatRemainingTime(task)}
              </span>
              {onDownload && (
                <Button size="sm" variant="outline" onClick={onDownload}>
                  <Download className="h-3 w-3 mr-1" />
                  下载
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

