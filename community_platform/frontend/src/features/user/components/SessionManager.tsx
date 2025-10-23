/**
 * 会话管理组件
 * 显示和管理用户的活动会话
 */

'use client';

import { useState } from 'react';
import { useSessions, useDeleteSession, useDeleteOtherSessions } from '../hooks/useUser';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { toast } from '@/shared/components/ui/use-toast';
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
import { Monitor, Smartphone, Tablet, MapPin, Clock, CheckCircle2, X } from 'lucide-react';
import type { UserSession } from '../types';

// 格式化时间距离现在的相对时间
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

const deviceIcons = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: Monitor,
};

interface SessionItemProps {
  session: UserSession;
  onDelete: (sessionId: string) => void;
  isDeleting: boolean;
}

function SessionItem({ session, onDelete, isDeleting }: SessionItemProps) {
  const DeviceIcon = deviceIcons[session.deviceType] || deviceIcons.unknown;

  return (
    <Card className={session.isCurrent ? 'border-primary' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 bg-muted rounded-lg mt-1">
              <DeviceIcon className="h-5 w-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium truncate">{session.deviceName}</h4>
                {session.isCurrent && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                    <CheckCircle2 className="h-3 w-3" />
                    当前会话
                  </span>
                )}
              </div>
              
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>{session.browser} • {session.os}</div>
                
                {session.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{session.location}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    最后活动: {formatTimeAgo(new Date(session.lastActiveAt))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {!session.isCurrent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(session.id)}
              disabled={isDeleting}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SessionManager() {
  const [page, setPage] = useState(1);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const { sessions, total, hasMore, isLoading, refetch } = useSessions(page);
  const deleteSession = useDeleteSession();
  const deleteOtherSessions = useDeleteOtherSessions();

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession.mutateAsync(sessionId);
      toast({
        title: '成功',
        description: '会话已删除',
      });
      setSessionToDelete(null);
      refetch();
    } catch (error) {
      toast({
        title: '错误',
        description: '删除会话失败',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteOtherSessions = async () => {
    try {
      await deleteOtherSessions.mutateAsync();
      toast({
        title: '成功',
        description: '已删除所有其他会话',
      });
      setShowDeleteAllDialog(false);
      refetch();
    } catch (error) {
      toast({
        title: '错误',
        description: '删除会话失败',
        variant: 'destructive',
      });
    }
  };

  if (isLoading && page === 1) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const otherSessionsCount = sessions.filter(s => !s.isCurrent).length;

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            共 {total} 个活动会话
          </p>
        </div>
        
        {otherSessionsCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteAllDialog(true)}
            disabled={deleteOtherSessions.isPending}
          >
            删除其他会话
          </Button>
        )}
      </div>

      {/* 会话列表 */}
      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无活动会话
          </div>
        ) : (
          sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              onDelete={setSessionToDelete}
              isDeleting={deleteSession.isPending}
            />
          ))
        )}
      </div>

      {/* 加载更多 */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => setPage(prev => prev + 1)}
            disabled={isLoading}
          >
            {isLoading ? '加载中...' : '加载更多'}
          </Button>
        </div>
      )}

      {/* 删除单个会话确认对话框 */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除会话？</AlertDialogTitle>
            <AlertDialogDescription>
              删除此会话将注销该设备的登录状态。该操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sessionToDelete && handleDeleteSession(sessionToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除所有其他会话确认对话框 */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除所有其他会话？</AlertDialogTitle>
            <AlertDialogDescription>
              这将注销除当前设备外的所有其他设备。如果有人未经授权访问了你的账号，这个操作很有用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOtherSessions}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              全部删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

