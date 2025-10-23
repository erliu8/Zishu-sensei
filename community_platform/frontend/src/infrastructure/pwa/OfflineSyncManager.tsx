'use client'

import { useEffect } from 'react'
import { useOfflineSync } from './useOfflineSync'
import { useToast } from '@/shared/hooks/useToast'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'

interface OfflineSyncManagerProps {
  /**
   * 是否显示完整的同步状态面板
   */
  showPanel?: boolean
  
  /**
   * 是否自动显示同步通知
   */
  showNotifications?: boolean
}

/**
 * 离线数据同步管理器
 * 管理离线数据的同步和显示同步状态
 */
export default function OfflineSyncManager({
  showPanel = false,
  showNotifications = true,
}: OfflineSyncManagerProps) {
  const { toast } = useToast()
  const {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    sync,
    clearPending,
  } = useOfflineSync()

  // 显示同步通知
  useEffect(() => {
    if (!showNotifications) return

    if (isOnline && pendingCount > 0) {
      toast({
        title: '数据同步',
        description: `正在同步 ${pendingCount} 个待处理操作...`,
        icon: <RefreshCw className="h-4 w-4 animate-spin" />,
      })
    }
  }, [isOnline, pendingCount, showNotifications, toast])

  // 手动触发同步
  const handleSync = async () => {
    if (!isOnline) {
      toast({
        title: '同步失败',
        description: '请检查网络连接后重试',
        variant: 'destructive',
        icon: <CloudOff className="h-4 w-4" />,
      })
      return
    }

    await sync()

    toast({
      title: '同步完成',
      description: '所有数据已同步',
      icon: <Cloud className="h-4 w-4" />,
    })
  }

  // 清空待同步队列
  const handleClear = async () => {
    if (
      !confirm(
        `确定要清空 ${pendingCount} 个待同步操作吗？此操作不可恢复。`
      )
    ) {
      return
    }

    await clearPending()

    toast({
      title: '队列已清空',
      description: '所有待同步操作已删除',
    })
  }

  if (!showPanel) {
    return null
  }

  return (
    <AnimatePresence>
      {pendingCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 right-4 z-40 max-w-sm"
        >
          <Card className="shadow-lg border-2">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {isSyncing ? (
                    <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                  ) : isOnline ? (
                    <Cloud className="h-5 w-5 text-green-500" />
                  ) : (
                    <CloudOff className="h-5 w-5 text-orange-500" />
                  )}
                  <CardTitle className="text-lg">离线数据同步</CardTitle>
                </div>
                <Badge variant={isOnline ? 'default' : 'secondary'}>
                  {isOnline ? '在线' : '离线'}
                </Badge>
              </div>
              <CardDescription>
                {isSyncing
                  ? '正在同步数据...'
                  : `${pendingCount} 个操作待同步`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 同步状态信息 */}
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>待同步操作：</span>
                  <span className="font-medium text-foreground">
                    {pendingCount}
                  </span>
                </div>
                {lastSyncTime && (
                  <div className="flex justify-between">
                    <span>上次同步：</span>
                    <span className="font-medium text-foreground">
                      {formatSyncTime(lastSyncTime)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>网络状态：</span>
                  <span
                    className={`font-medium ${
                      isOnline ? 'text-green-600' : 'text-orange-600'
                    }`}
                  >
                    {isOnline ? '已连接' : '未连接'}
                  </span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex space-x-2">
                <Button
                  onClick={handleSync}
                  disabled={!isOnline || isSyncing || pendingCount === 0}
                  className="flex-1"
                  size="sm"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      同步中...
                    </>
                  ) : (
                    <>
                      <Cloud className="h-4 w-4 mr-2" />
                      立即同步
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleClear}
                  variant="outline"
                  size="sm"
                  disabled={isSyncing || pendingCount === 0}
                >
                  清空
                </Button>
              </div>

              {/* 提示信息 */}
              {!isOnline && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  网络恢复后将自动同步数据
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * 格式化同步时间
 */
function formatSyncTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)

  if (diffMinutes < 1) {
    return '刚刚'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`
  } else if (diffMinutes < 1440) {
    const hours = Math.floor(diffMinutes / 60)
    return `${hours} 小时前`
  } else {
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
}

