/**
 * PWA 相关类型定义
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface PWAState {
  isInstalled: boolean
  isUpdateAvailable: boolean
  isOnline: boolean
  canInstall: boolean
  registration: ServiceWorkerRegistration | null
  installPromptEvent: BeforeInstallPromptEvent | null
}

export interface PushNotificationState {
  permission: NotificationPermission
  subscription: PushSubscription | null
  isSupported: boolean
}

export interface SendNotificationOptions {
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

export interface CacheStrategy {
  name: string
  handler: (request: Request) => Promise<Response>
}

export interface PWAConfig {
  enableInstallPrompt?: boolean
  enableUpdatePrompt?: boolean
  enableNetworkStatus?: boolean
  enablePushNotifications?: boolean
  vapidPublicKey?: string
  cacheStrategy?: 'network-first' | 'cache-first' | 'stale-while-revalidate'
  cacheName?: string
  cacheVersion?: string
}

