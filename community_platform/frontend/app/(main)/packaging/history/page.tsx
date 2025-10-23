/**
 * Packaging History Page
 * 打包历史页面
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TaskCard } from '@/features/packaging/components/TaskCard';
import { TaskStatsCard } from '@/features/packaging/components/TaskStatsCard';
import { usePackagingHistory, usePackagingStats } from '@/features/packaging/hooks/usePackagingHistory';
import {
  useCancelPackage,
  useDeletePackage,
  useRetryPackage,
  useGetDownloadUrl,
  useBulkDeletePackages,
} from '@/features/packaging/hooks/usePackagingActions';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Card } from '@/shared/components/ui/card';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Trash2, 
  Package,
  Download,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { PackagingStatus, PackagingPlatform } from '@/features/packaging/domain/packaging.types';
import { useToast } from '@/shared/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';

/**
 * Packaging History Page Component
 */
export default function PackagingHistoryPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PackagingStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<PackagingPlatform | 'all'>('all');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Hooks
  const { data, isLoading, refetch } = usePackagingHistory({
    page,
    pageSize,
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    platform: platformFilter !== 'all' ? platformFilter : undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const { data: stats } = usePackagingStats();
  const cancelMutation = useCancelPackage();
  const deleteMutation = useDeletePackage();
  const retryMutation = useRetryPackage();
  const downloadMutation = useGetDownloadUrl();
  const bulkDeleteMutation = useBulkDeletePackages();

  // 处理操作
  const handleViewDetails = (taskId: string) => {
    router.push(`/packaging/${taskId}`);
  };

  const handleDownload = async (taskId: string) => {
    try {
      await downloadMutation.mutateAsync(taskId);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleCancel = async (taskId: string) => {
    try {
      await cancelMutation.mutateAsync(taskId);
      await refetch();
    } catch (error) {
      console.error('Cancel failed:', error);
    }
  };

  const handleDelete = async (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!taskToDelete) return;

    try {
      await deleteMutation.mutateAsync(taskToDelete);
      await refetch();
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      toast({
        title: '删除成功',
        description: '任务已成功删除',
      });
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleRetry = async (taskId: string) => {
    try {
      await retryMutation.mutateAsync(taskId);
      await refetch();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) return;

    try {
      await bulkDeleteMutation.mutateAsync(selectedTasks);
      setSelectedTasks([]);
      await refetch();
    } catch (error) {
      console.error('Bulk delete failed:', error);
    }
  };

  const handleSelectTask = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTasks([...selectedTasks, taskId]);
    } else {
      setSelectedTasks(selectedTasks.filter((id) => id !== taskId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.items) {
      setSelectedTasks(data.items.map((task: any) => task.id));
    } else {
      setSelectedTasks([]);
    }
  };

  const tasks = data?.items || [];
  const totalPages = data?.totalPages || 1;
  const hasSelected = selectedTasks.length > 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/packaging">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" />
              打包历史
            </h1>
            <p className="text-muted-foreground mt-1">
              查看和管理你的打包任务
            </p>
          </div>
          <Button asChild>
            <Link href="/packaging">
              <Package className="h-4 w-4 mr-2" />
              新建打包
            </Link>
          </Button>
        </div>

        {/* Stats */}
        {stats && <TaskStatsCard stats={stats} className="mb-6" />}
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索应用名称或任务 ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="pending">等待中</SelectItem>
              <SelectItem value="queued">队列中</SelectItem>
              <SelectItem value="packaging">打包中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="failed">失败</SelectItem>
              <SelectItem value="cancelled">已取消</SelectItem>
            </SelectContent>
          </Select>

          {/* Platform Filter */}
          <Select value={platformFilter} onValueChange={(value: any) => setPlatformFilter(value)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部平台</SelectItem>
              {Object.values(PackagingPlatform).map((platform) => (
                <SelectItem key={platform} value={platform}>
                  {platform.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Bulk Actions */}
      {hasSelected && (
        <div className="bg-muted/50 border rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectedTasks.length === tasks.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm font-medium">
              已选择 {selectedTasks.length} 个任务
            </span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            批量删除
          </Button>
        </div>
      )}

      {/* Task List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={Package}
          title="暂无打包任务"
          description="还没有创建任何打包任务，点击上方按钮开始创建"
          action={
            <Button asChild>
              <Link href="/packaging">
                <Package className="h-4 w-4 mr-2" />
                新建打包
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 mb-6">
            {tasks.map((task: any) => (
              <div key={task.id} className="flex items-start gap-3">
                <Checkbox
                  checked={selectedTasks.includes(task.id)}
                  onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)}
                  className="mt-4"
                />
                <div className="flex-1">
                  <TaskCard
                    task={task}
                    onViewDetails={() => handleViewDetails(task.id)}
                    onDownload={() => handleDownload(task.id)}
                    onCancel={() => handleCancel(task.id)}
                    onDelete={() => handleDelete(task.id)}
                    onRetry={() => handleRetry(task.id)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                第 {page} / {totalPages} 页
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。删除后，该任务的所有数据都将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTaskToDelete(null)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

