'use client'

import { useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw, Home, ArrowLeft } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/**
 * 离线页面
 * 当用户离线访问未缓存的页面时显示
 */
export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // 检查初始在线状态
    setIsOnline(navigator.onLine)

    // 监听网络状态变化
    const handleOnline = () => {
      setIsOnline(true)
      console.log('[Offline] Network connection restored')
    }

    const handleOffline = () => {
      setIsOnline(false)
      console.log('[Offline] Network connection lost')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 重试加载页面
  const handleRetry = async () => {
    setIsRetrying(true)

    try {
      // 尝试重新加载当前页面
      await new Promise((resolve) => setTimeout(resolve, 500))
      window.location.reload()
    } catch (error) {
      console.error('[Offline] Retry failed:', error)
      setIsRetrying(false)
    }
  }

  // 返回上一页
  const handleGoBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md w-full">
        {/* 离线图标动画 */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 blur-2xl opacity-20 animate-pulse" />
            <div className="relative bg-white dark:bg-gray-800 rounded-full p-8 shadow-2xl">
              {isOnline ? (
                <Wifi className="w-16 h-16 text-green-500" />
              ) : (
                <WifiOff className="w-16 h-16 text-gray-400 dark:text-gray-500" />
              )}
            </div>
          </div>
        </div>

        {/* 状态信息 */}
        <div className="text-center mb-8">
          {isOnline ? (
            <>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                网络已恢复
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                您可以继续浏览了
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                您当前处于离线状态
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                请检查您的网络连接
              </p>
            </>
          )}
        </div>

        {/* 离线提示卡片 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                您可以继续浏览已缓存的页面
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                网络恢复后，您的操作将自动同步
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                已缓存的内容可能不是最新的
              </p>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="space-y-3">
          <Button
            onClick={handleRetry}
            disabled={!isOnline || isRetrying}
            className="w-full h-12 text-base"
            size="lg"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                重试中...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5 mr-2" />
                重新加载
              </>
            )}
          </Button>

          <Button
            onClick={handleGoBack}
            variant="outline"
            className="w-full h-12 text-base"
            size="lg"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            返回上一页
          </Button>

          <Link href="/" className="block">
            <Button
              variant="ghost"
              className="w-full h-12 text-base"
              size="lg"
            >
              <Home className="w-5 h-5 mr-2" />
              回到首页
            </Button>
          </Link>
        </div>

        {/* 网络状态指示器 */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className={`w-2 h-2 rounded-full ${
                isOnline
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isOnline ? '在线' : '离线'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
