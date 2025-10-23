'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { usePWA } from './usePWA'

/**
 * 网络状态指示器组件
 */
export default function NetworkStatus() {
  const { isOnline } = usePWA()
  const [showOffline, setShowOffline] = useState(false)
  const [showOnline, setShowOnline] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setShowOffline(true)
      setShowOnline(false)
    } else {
      // 从离线恢复时显示在线提示
      if (showOffline) {
        setShowOnline(true)
        setShowOffline(false)
        
        // 3秒后自动隐藏在线提示
        const timer = setTimeout(() => {
          setShowOnline(false)
        }, 3000)
        
        return () => clearTimeout(timer)
      }
    }
  }, [isOnline, showOffline])

  // 离线提示
  if (showOffline) {
    return (
      <div className="fixed left-0 right-0 top-0 z-50 animate-in slide-in-from-top">
        <div className="bg-yellow-500 px-4 py-2 text-center text-sm font-medium text-white dark:bg-yellow-600">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" />
            <span>您当前处于离线状态</span>
          </div>
        </div>
      </div>
    )
  }

  // 在线恢复提示
  if (showOnline) {
    return (
      <div className="fixed left-0 right-0 top-0 z-50 animate-in slide-in-from-top">
        <div className="bg-green-500 px-4 py-2 text-center text-sm font-medium text-white dark:bg-green-600">
          <div className="flex items-center justify-center gap-2">
            <Wifi className="h-4 w-4" />
            <span>网络连接已恢复</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}

