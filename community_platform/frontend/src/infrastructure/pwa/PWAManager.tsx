'use client'

import { useEffect } from 'react'
import { usePWA } from './usePWA'
import PWAInstallPrompt from './PWAInstallPrompt'
import PWAUpdatePrompt from './PWAUpdatePrompt'
import NetworkStatus from './NetworkStatus'

interface PWAManagerProps {
  enableInstallPrompt?: boolean
  enableUpdatePrompt?: boolean
  enableNetworkStatus?: boolean
}

/**
 * PWA Manager Component
 * 管理所有 PWA 相关功能
 */
export default function PWAManager({
  enableInstallPrompt = true,
  enableUpdatePrompt = true,
  enableNetworkStatus = true,
}: PWAManagerProps) {
  const { register } = usePWA()

  useEffect(() => {
    // 注册 Service Worker
    register()

    // 监听网络状态变化
    const handleOnline = () => {
      console.log('[PWA] Back online')
      // 可以在这里触发数据同步
    }

    const handleOffline = () => {
      console.log('[PWA] Gone offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [register])

  return (
    <>
      {enableInstallPrompt && <PWAInstallPrompt />}
      {enableUpdatePrompt && <PWAUpdatePrompt />}
      {enableNetworkStatus && <NetworkStatus />}
    </>
  )
}

