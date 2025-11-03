/**
 * 打包进度组件
 */

'use client';

import { FC } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Progress,
} from '@/shared/components';
import { 
  Download, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  X,
} from 'lucide-react';
import type { PackagingTask, PackagingStatus } from '../api/types';

export interface PackagingProgressProps {
  task: PackagingTask;
  onCancel?: () => void;
  onDownload?: (url: string) => void;
}

/**
 * 获取状态显示信息
 */
function getStatusInfo(status: PackagingStatus) {
  switch (status) {
    case 'pending':
      return {
        label: '等待中',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50',
        icon: <Clock className="h-5 w-5" />,
      };
    case 'packaging':
      return {
        label: '打包中',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        icon: <Loader2 className="h-5 w-5 animate-spin" />,
      };
    case 'completed':
      return {
        label: '已完成',
        color: 'text-green-500',
        bgColor: 'bg-green-50',
        icon: <CheckCircle2 className="h-5 w-5" />,
      };
    case 'failed':
      return {
        label: '失败',
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        icon: <XCircle className="h-5 w-5" />,
      };
    default:
      return {
        label: '未知',
        color: 'text-gray-500',
        bgColor: 'bg-gray-50',
        icon: <Clock className="h-5 w-5" />,
      };
  }
}

/**
 * 打包进度组件
 */
export const PackagingProgress: FC<PackagingProgressProps> = ({
  task,
  onCancel,
  onDownload,
}) => {
  const statusInfo = getStatusInfo(task.status);
  const canCancel = task.status === 'pending' || task.status === 'packaging';
  const canDownload = task.status === 'completed' && task.download_url;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${statusInfo.bgColor} p-2 rounded-lg ${statusInfo.color}`}>
              {statusInfo.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{task.config.app_name}</CardTitle>
              <CardDescription>
                {task.platform.toUpperCase()} - v{task.config.version}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary">{statusInfo.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 进度条 */}
        {(task.status === 'pending' || task.status === 'packaging') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">打包进度</span>
              <span className="font-medium">{task.progress}%</span>
            </div>
            <Progress value={task.progress} className="h-2" />
          </div>
        )}

        {/* 错误信息 */}
        {task.status === 'failed' && task.error_message && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <p className="font-medium mb-1">错误信息：</p>
            <p>{task.error_message}</p>
          </div>
        )}

        {/* 文件信息 */}
        {canDownload && task.file_size && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>文件大小</span>
            <span className="font-medium">
              {(task.file_size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3 pt-2">
          {canDownload && (
            <Button
              className="flex-1"
              onClick={() => onDownload?.(task.download_url!)}
            >
              <Download className="mr-2 h-4 w-4" />
              下载应用
            </Button>
          )}

          {canCancel && onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
            >
              <X className="mr-2 h-4 w-4" />
              取消
            </Button>
          )}
        </div>

        {/* 时间信息 */}
        <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <span>创建时间</span>
            <span>{new Date(task.created_at).toLocaleString()}</span>
          </div>
          {task.completed_at && (
            <div className="flex items-center justify-between">
              <span>完成时间</span>
              <span>{new Date(task.completed_at).toLocaleString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

