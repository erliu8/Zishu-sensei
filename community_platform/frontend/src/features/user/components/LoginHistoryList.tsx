/**
 * 登录历史列表组件
 * 显示用户的登录历史记录
 */

'use client';

import { useState } from 'react';
import { useLoginHistory } from '../hooks/useUser';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { Badge } from '@/shared/components/ui/badge';
import { Monitor, Smartphone, Tablet, MapPin, Calendar, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { LoginHistory } from '../types';

// 格式化日期时间
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function getDeviceIcon(deviceName: string) {
  if (deviceName.includes('Mobile') || deviceName.includes('iPhone') || deviceName.includes('Android')) {
    return Smartphone;
  }
  if (deviceName.includes('Tablet') || deviceName.includes('iPad')) {
    return Tablet;
  }
  return Monitor;
}

interface LoginHistoryItemProps {
  record: LoginHistory;
}

function LoginHistoryItem({ record }: LoginHistoryItemProps) {
  const DeviceIcon = getDeviceIcon(record.deviceName);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* 设备图标 */}
          <div className={`p-2 rounded-lg mt-1 ${
            record.success 
              ? 'bg-green-100 dark:bg-green-900/20' 
              : 'bg-red-100 dark:bg-red-900/20'
          }`}>
            <DeviceIcon className={`h-5 w-5 ${
              record.success 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`} />
          </div>

          <div className="flex-1 min-w-0">
            {/* 头部 */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-medium">{record.deviceName}</h4>
                {record.success ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    成功
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                    <XCircle className="h-3 w-3 mr-1" />
                    失败
                  </Badge>
                )}
              </div>
            </div>

            {/* 详细信息 */}
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>{record.browser} • {record.os}</div>
              
              {record.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{record.location}</span>
                  <span className="text-muted-foreground/60">({record.ip})</span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  {formatDateTime(new Date(record.createdAt))}
                </span>
              </div>

              {!record.success && record.failReason && (
                <div className="flex items-start gap-1 text-red-600 dark:text-red-400 mt-2">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">{record.failReason}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LoginHistoryList() {
  const [page, setPage] = useState(1);
  const { history, total, hasMore, isLoading } = useLoginHistory(page);

  if (isLoading && page === 1) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const successCount = history.filter(h => h.success).length;
  const failCount = history.filter(h => !h.success).length;

  return (
    <div className="space-y-4">
      {/* 统计信息 */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">总计:</span>
          <span className="font-medium">{total}</span>
        </div>
        {page === 1 && (
          <>
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>{successCount}</span>
            </div>
            {failCount > 0 && (
              <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                <span>{failCount}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 历史记录列表 */}
      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无登录历史
          </div>
        ) : (
          history.map((record) => (
            <LoginHistoryItem key={record.id} record={record} />
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
    </div>
  );
}

