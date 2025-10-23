/**
 * Packaging Task Detail Page
 * 打包任务详情页
 */

'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PackagingProgress } from '@/features/packaging/components/PackagingProgress';
import { usePackagingStatus } from '@/features/packaging/hooks/usePackagingStatus';
import {
  useCancelPackage,
  useDeletePackage,
  useRetryPackage,
  useGetDownloadUrl,
} from '@/features/packaging/hooks/usePackagingActions';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Badge } from '@/shared/components/ui/badge';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { ArrowLeft, FileText, Activity, Settings, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { useToast } from '@/shared/components/ui/use-toast';

/**
 * Packaging Task Detail Page Component
 */
export default function PackagingTaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params?.taskId as string;
  const { toast } = useToast();

  // Hooks
  const { data: task, isLoading, error, refetch } = usePackagingStatus(taskId, true);
  const cancelMutation = useCancelPackage();
  const deleteMutation = useDeletePackage();
  const retryMutation = useRetryPackage();
  const downloadMutation = useGetDownloadUrl();

  // 处理下载
  const handleDownload = async () => {
    try {
      await downloadMutation.mutateAsync(taskId);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // 处理取消
  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(taskId);
      await refetch();
    } catch (error) {
      console.error('Cancel failed:', error);
    }
  };

  // 处理删除
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(taskId);
      toast({
        title: '删除成功',
        description: '任务已删除，即将返回历史页面',
      });
      setTimeout(() => {
        router.push('/packaging/history');
      }, 1000);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // 处理重试
  const handleRetry = async () => {
    try {
      const response = await retryMutation.mutateAsync(taskId);
      toast({
        title: '重试成功',
        description: '任务已重新启动',
      });
      await refetch();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // 错误状态
  if (error || !task) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>
            无法加载任务详情，请稍后重试
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/packaging/history">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回历史页面
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/packaging/history">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">打包任务详情</h1>
            <p className="text-muted-foreground mt-1">
              任务 ID: {taskId}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Card */}
      <div className="mb-6">
        <PackagingProgress
          task={task}
          onDownload={handleDownload}
          onCancel={handleCancel}
          onRetry={handleRetry}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">
            <FileText className="h-4 w-4 mr-2" />
            详细信息
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            配置信息
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Activity className="h-4 w-4 mr-2" />
            日志
          </TabsTrigger>
        </TabsList>

        {/* 详细信息 */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>任务信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">应用名称</p>
                  <p className="font-medium">{task.config.appName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">版本</p>
                  <p className="font-medium">{task.config.version}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">创建时间</p>
                  <p className="font-medium">
                    {format(new Date(task.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </p>
                </div>
                {task.startedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">开始时间</p>
                    <p className="font-medium">
                      {format(new Date(task.startedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                    </p>
                  </div>
                )}
                {task.completedAt && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">完成时间</p>
                    <p className="font-medium">
                      {format(new Date(task.completedAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                    </p>
                  </div>
                )}
                {task.expiresAt && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">过期时间</p>
                    <p className="font-medium">
                      {format(new Date(task.expiresAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                    </p>
                  </div>
                )}
              </div>

              {task.config.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">描述</p>
                  <p className="text-sm">{task.config.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 配置信息 */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>打包配置</CardTitle>
              <CardDescription>本次打包使用的配置信息</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">平台配置</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">平台</p>
                      <Badge variant="secondary" className="mt-1">
                        {task.config.platform.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">架构</p>
                      <Badge variant="secondary" className="mt-1">
                        {task.config.architecture.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">格式</p>
                      <Badge variant="secondary" className="mt-1">
                        {task.config.format.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">高级选项</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">包含资源文件</span>
                      <Badge variant={task.config.includeAssets ? 'default' : 'secondary'}>
                        {task.config.includeAssets ? '是' : '否'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">启用压缩</span>
                      <Badge variant={task.config.compress ? 'default' : 'secondary'}>
                        {task.config.compress ? '是' : '否'}
                      </Badge>
                    </div>
                    {task.config.compress && task.config.compressionLevel !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">压缩级别</span>
                        <Badge variant="secondary">{task.config.compressionLevel}</Badge>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">代码混淆</span>
                      <Badge variant={task.config.obfuscate ? 'default' : 'secondary'}>
                        {task.config.obfuscate ? '是' : '否'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">角色与适配器</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">角色 ID</p>
                      <p className="font-mono">{task.config.characterId}</p>
                    </div>
                    {task.config.adapterIds.length > 0 && (
                      <div>
                        <p className="text-muted-foreground">适配器列表</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {task.config.adapterIds.map((id) => (
                            <Badge key={id} variant="outline">
                              {id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 日志 */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>打包日志</CardTitle>
              <CardDescription>实时显示打包过程中的日志信息</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>日志功能即将上线</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 操作区域 */}
      <div className="mt-6 flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
        >
          删除任务
        </Button>
      </div>
    </div>
  );
}

