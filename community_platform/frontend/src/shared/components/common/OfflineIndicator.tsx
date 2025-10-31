'use client'

import { useEffect, useState } from 'react'
import { WifiOff, Wifi, Cloud, CloudOff } from 'lucide-react'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * 离线指示器组件
 * 显示网络连接状态和同步状态
 */
export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [showNotification, setShowNotification] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    // 检查初始状态
    setIsOnline(navigator.onLine)

    // 监听网络状态变化
    const handleOnline = () => {
      console.log('[OfflineIndicator] Online')
      setIsOnline(true)
      setShowNotification(true)
      setIsSyncing(true)

      // 触发后台同步
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          // 检查是否支持 Background Sync
          if ('sync' in window.ServiceWorkerRegistration.prototype) {
            return (registration as any).sync.register('sync-data')
          } else {
            console.log('[OfflineIndicator] Background sync not supported')
            return Promise.resolve()
          }
        }).then(() => {
          console.log('[OfflineIndicator] Background sync registered')
          setTimeout(() => setIsSyncing(false), 2000)
        }).catch((error) => {
          console.error('[OfflineIndicator] Background sync failed:', error)
          setIsSyncing(false)
        })
      } else {
        setTimeout(() => setIsSyncing(false), 2000)
      }

      // 3秒后隐藏通知
      setTimeout(() => setShowNotification(false), 3000)
    }

    const handleOffline = () => {
      console.log('[OfflineIndicator] Offline')
      setIsOnline(false)
      setShowNotification(true)
      setIsSyncing(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 如果在线且没有显示通知，不渲染
  if (isOnline && !showNotification) {
    return null
  }

  return (
    <AnimatePresence>
      {showNotification && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
        >
          <Alert
            variant={isOnline ? 'default' : 'warning'}
            className="shadow-lg border-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {isOnline ? (
                  <>
                    {isSyncing ? (
                      <Cloud className="h-5 w-5 text-blue-500 animate-pulse" />
                    ) : (
                      <Wifi className="h-5 w-5 text-green-500" />
                    )}
                  </>
                ) : (
                  <WifiOff className="h-5 w-5 text-orange-500" />
                )}
                <AlertDescription className="text-sm font-medium">
                  {isOnline ? (
                    isSyncing ? (
                      '正在同步数据...'
                    ) : (
                      '网络已恢复，您已重新上线'
                    )
                  ) : (
                    '您已离线，某些功能可能无法使用'
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * 简洁版离线指示器
 * 用于导航栏显示
 */
export function OfflineBadge() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) {
    return null
  }

  return (
    <div className="flex items-center space-x-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
      <CloudOff className="h-3.5 w-3.5" />
      <span>离线模式</span>
    </div>
  )
}

