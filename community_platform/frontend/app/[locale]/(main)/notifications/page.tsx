'use client';

import React, { useState } from 'react';
import { Trash2, CheckCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Checkbox } from '@/shared/components/ui/checkbox';
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
import {
  NotificationList,
  NotificationCategories,
  NotificationBulkActions,
} from '@/features/notification/components';
import {
  useNotifications,
  useMarkAsRead,
  useMarkAsUnread,
  useMarkAllAsRead,
  useDeleteNotification,
  useArchiveNotification,
  useClearReadNotifications,
} from '@/features/notification/hooks';
import type { NotificationType } from '@/features/notification/domain/notification';
import { NotificationStatus } from '@/features/notification/domain/notification';
import { Pagination } from '@/shared/components/common/Pagination';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all');
  const [page, setPage] = useState(1);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const pageSize = 20;

  // 查询参数
  const queryParams = {
    page,
    pageSize,
    status: activeTab === 'unread' ? NotificationStatus.UNREAD : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
  };

  // 获取通知列表
  const { data, isLoading } = useNotifications(queryParams);

  // Mutations
  const markAsReadMutation = useMarkAsRead();
  const markAsUnreadMutation = useMarkAsUnread();
  const markAllAsReadMutation = useMarkAllAsRead();
  const deleteNotificationMutation = useDeleteNotification();
  const archiveNotificationMutation = useArchiveNotification();
  const clearReadMutation = useClearReadNotifications();

  const handleMarkAsRead = (id: string) => {
    markAsReadMutation.mutate(id);
  };

  const handleMarkAsUnread = (id: string) => {
    markAsUnreadMutation.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (id: string) => {
    deleteNotificationMutation.mutate(id);
  };

  const handleArchive = (id: string) => {
    archiveNotificationMutation.mutate(id);
  };

  const handleClearRead = () => {
    clearReadMutation.mutate();
    setShowClearDialog(false);
  };

  // 批量操作处理
  const handleToggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedIds(new Set());
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map((n: { id: string }) => n.id)));
    }
  };

  const handleBulkMarkAsRead = () => {
    selectedIds.forEach((id) => {
      markAsReadMutation.mutate(id);
    });
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => {
      deleteNotificationMutation.mutate(id);
    });
    setSelectedIds(new Set());
  };

  const handleBulkArchive = () => {
    selectedIds.forEach((id) => {
      archiveNotificationMutation.mutate(id);
    });
    setSelectedIds(new Set());
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const notifications = data?.items || [];
  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div className="container max-w-4xl py-8">
      {/* 头部 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">通知</h1>
        <p className="text-muted-foreground mt-2">
          管理您的通知和消息
        </p>
      </div>

      {/* 分类筛选 */}
      <div className="mb-6">
        <NotificationCategories
          selectedCategory={typeFilter}
          onCategoryChange={(category) => {
            setTypeFilter(category);
            setPage(1);
          }}
        />
      </div>

      {/* 操作栏 */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {selectMode && (
            <Checkbox
              checked={
                notifications.length > 0 &&
                selectedIds.size === notifications.length
              }
              onCheckedChange={handleSelectAll}
              aria-label="全选"
            />
          )}
          <Button
            variant={selectMode ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleSelectMode}
          >
            {selectMode ? '取消选择' : '批量管理'}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markAllAsReadMutation.isPending}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            全部已读
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClearDialog(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            清空已读
          </Button>
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectMode && selectedIds.size > 0 && (
        <div className="mb-6">
          <NotificationBulkActions
            selectedCount={selectedIds.size}
            onMarkAllAsRead={handleBulkMarkAsRead}
            onDeleteSelected={handleBulkDelete}
            onArchiveSelected={handleBulkArchive}
            onClearSelection={handleClearSelection}
            loading={
              markAsReadMutation.isPending ||
              deleteNotificationMutation.isPending ||
              archiveNotificationMutation.isPending
            }
          />
        </div>
      )}

      {/* 标签页 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">全部通知</TabsTrigger>
          <TabsTrigger value="unread">未读</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <NotificationList
            notifications={notifications}
            loading={isLoading}
            onMarkAsRead={handleMarkAsRead}
            onMarkAsUnread={handleMarkAsUnread}
            onDelete={handleDelete}
            onArchive={handleArchive}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        </TabsContent>

        <TabsContent value="unread">
          <NotificationList
            notifications={notifications}
            loading={isLoading}
            onMarkAsRead={handleMarkAsRead}
            onMarkAsUnread={handleMarkAsUnread}
            onDelete={handleDelete}
            onArchive={handleArchive}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
          />
        </TabsContent>
      </Tabs>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* 清空已读确认对话框 */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空已读通知？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除所有已读的通知，且无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearRead}
              disabled={clearReadMutation.isPending}
            >
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

