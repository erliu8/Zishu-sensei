'use client'

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAState {
  isInstalled: boolean
  isUpdateAvailable: boolean
  isOnline: boolean
  canInstall: boolean
  registration: ServiceWorkerRegistration | null
  installPromptEvent: BeforeInstallPromptEvent | null
}

/**
 * PWA Hook
 * 管理 PWA 相关状态和功能
 */
export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstalled: false,
    isUpdateAvailable: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    canInstall: false,
    registration: null,
    installPromptEvent: null,
  })

  // 注册 Service Worker
  const register = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('[PWA] Service Worker not supported')
      return null
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })

      console.log('[PWA] Service Worker registered:', registration)

      setState((prev) => ({ ...prev, registration }))

      // 检查更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing

        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            console.log('[PWA] New version available')
            setState((prev) => ({ ...prev, isUpdateAvailable: true }))
          }
        })
      })

      // 定期检查更新（每小时）
      setInterval(
        () => {
          registration.update()
        },
        60 * 60 * 1000
      )

      return registration
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error)
      return null
    }
  }, [])

  // 卸载 Service Worker
  const unregister = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return false
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const success = await registration.unregister()
      console.log('[PWA] Service Worker unregistered:', success)
      setState((prev) => ({ ...prev, registration: null }))
      return success
    } catch (error) {
      console.error('[PWA] Service Worker unregister failed:', error)
      return false
    }
  }, [])

  // 更新 Service Worker
  const update = useCallback(() => {
    if (!state.registration) {
      console.warn('[PWA] No registration found')
      return
    }

    const waitingWorker = state.registration.waiting

    if (!waitingWorker) {
      console.warn('[PWA] No waiting worker found')
      return
    }

    // 告诉 waiting worker 跳过等待
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })

    // 监听控制器变化
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[PWA] Controller changed, reloading...')
      window.location.reload()
    })
  }, [state.registration])

  // 安装 PWA
  const install = useCallback(async () => {
    if (!state.installPromptEvent) {
      console.warn('[PWA] No install prompt event')
      return { outcome: 'dismissed' as const }
    }

    try {
      // 显示安装提示
      await state.installPromptEvent.prompt()

      // 等待用户响应
      const choiceResult = await state.installPromptEvent.userChoice

      console.log('[PWA] User choice:', choiceResult.outcome)

      if (choiceResult.outcome === 'accepted') {
        setState((prev) => ({
          ...prev,
          canInstall: false,
          installPromptEvent: null,
        }))
      }

      return choiceResult
    } catch (error) {
      console.error('[PWA] Install prompt failed:', error)
      return { outcome: 'dismissed' as const }
    }
  }, [state.installPromptEvent])

  // 缓存 URLs
  const cacheURLs = useCallback(
    async (urls: string[]) => {
      if (!state.registration) {
        console.warn('[PWA] No registration found')
        return false
      }

      try {
        state.registration.active?.postMessage({
          type: 'CACHE_URLS',
          urls,
        })
        return true
      } catch (error) {
        console.error('[PWA] Cache URLs failed:', error)
        return false
      }
    },
    [state.registration]
  )

  // 清除缓存
  const clearCache = useCallback(async () => {
    if (!state.registration) {
      console.warn('[PWA] No registration found')
      return false
    }

    try {
      state.registration.active?.postMessage({
        type: 'CLEAR_CACHE',
      })
      return true
    } catch (error) {
      console.error('[PWA] Clear cache failed:', error)
      return false
    }
  }, [state.registration])

  // 请求推送通知权限
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('[PWA] Notifications not supported')
      return 'denied'
    }

    try {
      const permission = await Notification.requestPermission()
      console.log('[PWA] Notification permission:', permission)
      return permission
    } catch (error) {
      console.error('[PWA] Notification permission failed:', error)
      return 'denied'
    }
  }, [])

  // 订阅推送通知
  const subscribePush = useCallback(
    async (vapidPublicKey: string) => {
      if (!state.registration) {
        console.warn('[PWA] No registration found')
        return null
      }

      try {
        const subscription = await state.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })

        console.log('[PWA] Push subscription:', subscription)
        return subscription
      } catch (error) {
        console.error('[PWA] Push subscription failed:', error)
        return null
      }
    },
    [state.registration]
  )

  // 取消推送通知订阅
  const unsubscribePush = useCallback(async () => {
    if (!state.registration) {
      console.warn('[PWA] No registration found')
      return false
    }

    try {
      const subscription = await state.registration.pushManager.getSubscription()

      if (!subscription) {
        console.warn('[PWA] No push subscription found')
        return false
      }

      const success = await subscription.unsubscribe()
      console.log('[PWA] Push unsubscribed:', success)
      return success
    } catch (error) {
      console.error('[PWA] Push unsubscribe failed:', error)
      return false
    }
  }, [state.registration])

  useEffect(() => {
    // 检查是否已安装
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true

      setState((prev) => ({ ...prev, isInstalled: isStandalone }))
    }

    // 监听安装提示事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      console.log('[PWA] Install prompt available')
      setState((prev) => ({
        ...prev,
        canInstall: true,
        installPromptEvent: e as BeforeInstallPromptEvent,
      }))
    }

    // 监听应用已安装事件
    const handleAppInstalled = () => {
      console.log('[PWA] App installed')
      setState((prev) => ({
        ...prev,
        isInstalled: true,
        canInstall: false,
        installPromptEvent: null,
      }))
    }

    // 监听网络状态
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }))
    }

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      )
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    ...state,
    register,
    unregister,
    update,
    install,
    cacheURLs,
    clearCache,
    requestNotificationPermission,
    subscribePush,
    unsubscribePush,
  }
}

// 辅助函数：将 Base64 字符串转换为 Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

