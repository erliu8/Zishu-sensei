'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePWA } from './usePWA'

interface PushNotificationState {
  permission: NotificationPermission
  subscription: PushSubscription | null
  isSupported: boolean
}

interface SendNotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
  requireInteraction?: boolean
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

/**
 * 推送通知 Hook
 */
export function usePushNotification(vapidPublicKey?: string) {
  const { registration, subscribePush, unsubscribePush } = usePWA()

  const [state, setState] = useState<PushNotificationState>({
    permission: typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied',
    subscription: null,
    isSupported: typeof window !== 'undefined' && 'Notification' in window && 'PushManager' in window,
  })

  // 请求通知权限
  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      console.warn('[Push] Notifications not supported')
      return 'denied'
    }

    try {
      const permission = await Notification.requestPermission()
      setState((prev) => ({ ...prev, permission }))
      return permission
    } catch (error) {
      console.error('[Push] Request permission failed:', error)
      return 'denied'
    }
  }, [state.isSupported])

  // 订阅推送
  const subscribe = useCallback(async () => {
    if (!state.isSupported || state.permission !== 'granted') {
      console.warn('[Push] Cannot subscribe: not supported or permission denied')
      return null
    }

    if (!vapidPublicKey) {
      console.warn('[Push] VAPID public key not provided')
      return null
    }

    try {
      const subscription = await subscribePush(vapidPublicKey)
      setState((prev) => ({ ...prev, subscription }))
      
      // 将订阅信息发送到服务器
      if (subscription) {
        await sendSubscriptionToServer(subscription)
      }
      
      return subscription
    } catch (error) {
      console.error('[Push] Subscribe failed:', error)
      return null
    }
  }, [state.isSupported, state.permission, vapidPublicKey, subscribePush])

  // 取消订阅
  const unsubscribe = useCallback(async () => {
    if (!state.subscription) {
      console.warn('[Push] No subscription found')
      return false
    }

    try {
      // 从服务器删除订阅
      await removeSubscriptionFromServer(state.subscription)
      
      // 取消浏览器订阅
      const success = await unsubscribePush()
      
      if (success) {
        setState((prev) => ({ ...prev, subscription: null }))
      }
      
      return success
    } catch (error) {
      console.error('[Push] Unsubscribe failed:', error)
      return false
    }
  }, [state.subscription, unsubscribePush])

  // 发送本地通知（不需要服务器）
  const sendLocalNotification = useCallback(
    async (options: SendNotificationOptions) => {
      if (!state.isSupported || state.permission !== 'granted') {
        console.warn('[Push] Cannot send notification: not supported or permission denied')
        return null
      }

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/icons/icon-192x192.png',
          badge: options.badge || '/icons/badge-72x72.png',
          tag: options.tag,
          data: options.data,
          requireInteraction: options.requireInteraction,
          actions: options.actions,
        })

        return notification
      } catch (error) {
        console.error('[Push] Send local notification failed:', error)
        return null
      }
    },
    [state.isSupported, state.permission]
  )

  // 测试通知
  const testNotification = useCallback(async () => {
    return sendLocalNotification({
      title: '测试通知',
      body: '这是一条测试通知，用于确认通知功能正常工作',
      tag: 'test-notification',
      requireInteraction: false,
    })
  }, [sendLocalNotification])

  useEffect(() => {
    // 获取现有订阅
    if (registration && state.isSupported) {
      registration.pushManager
        .getSubscription()
        .then((subscription) => {
          setState((prev) => ({ ...prev, subscription }))
        })
        .catch((error) => {
          console.error('[Push] Get subscription failed:', error)
        })
    }
  }, [registration, state.isSupported])

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    sendLocalNotification,
    testNotification,
  }
}

// 将订阅信息发送到服务器
async function sendSubscriptionToServer(
  subscription: PushSubscription
): Promise<void> {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    })

    if (!response.ok) {
      throw new Error('Failed to send subscription to server')
    }

    console.log('[Push] Subscription sent to server')
  } catch (error) {
    console.error('[Push] Send subscription to server failed:', error)
    throw error
  }
}

// 从服务器删除订阅
async function removeSubscriptionFromServer(
  subscription: PushSubscription
): Promise<void> {
  try {
    const response = await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    })

    if (!response.ok) {
      throw new Error('Failed to remove subscription from server')
    }

    console.log('[Push] Subscription removed from server')
  } catch (error) {
    console.error('[Push] Remove subscription from server failed:', error)
    throw error
  }
}

