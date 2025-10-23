'use client';

import React from 'react';
import { CheckCheck, Trash2, Archive, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
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
import { cn } from '@/shared/utils';

interface NotificationBulkActionsProps {
  selectedCount: number;
  onMarkAllAsRead?: () => void;
  onDeleteSelected?: () => void;
  onArchiveSelected?: () => void;
  onClearSelection?: () => void;
  className?: string;
  loading?: boolean;
}

/**
 * 通知批量操作组件
 * 提供批量标记已读、删除、归档等操作
 */
export function NotificationBulkActions({
  selectedCount,
  onMarkAllAsRead,
  onDeleteSelected,
  onArchiveSelected,
  onClearSelection,
  className,
  loading = false,
}: NotificationBulkActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleDelete = () => {
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    onDeleteSelected?.();
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between gap-4 rounded-lg border bg-muted/50 p-4',
          className
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            已选择 {selectedCount} 条通知
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={loading}
          >
            <X className="mr-1 h-3 w-3" />
            取消选择
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {onMarkAllAsRead && (
            <Button
              variant="outline"
              size="sm"
              onClick={onMarkAllAsRead}
              disabled={loading}
            >
              <CheckCheck className="mr-2 h-4 w-4" />
              全部已读
            </Button>
          )}

          {onArchiveSelected && (
            <Button
              variant="outline"
              size="sm"
              onClick={onArchiveSelected}
              disabled={loading}
            >
              <Archive className="mr-2 h-4 w-4" />
              归档
            </Button>
          )}

          {onDeleteSelected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={loading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除选中的 {selectedCount} 条通知吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

