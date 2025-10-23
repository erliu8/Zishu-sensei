/**
 * PWA Infrastructure Module
 * 提供 Progressive Web App 功能支持
 * 
 * @version 2.0.0
 * @updated 2025-10-23
 */

// Hooks
export { usePWA } from './usePWA'
export { usePushNotification } from './usePushNotification'
export { useOfflineSync } from './useOfflineSync'

// Components
export { default as PWAManager } from './PWAManager'
export { default as PWAInstallPrompt } from './PWAInstallPrompt'
export { default as PWAUpdatePrompt } from './PWAUpdatePrompt'
export { default as PWASettings } from './PWASettings'
export { default as NetworkStatus } from './NetworkStatus'
export { default as OfflineSyncManager } from './OfflineSyncManager'
export { default as PushNotificationManager } from './PushNotificationManager'

// Offline API Client
export {
  offlineFetch,
  createOfflineApiClient,
  offlineApi,
} from './offlineApiClient'

// Types
export type {
  BeforeInstallPromptEvent,
  PWAState,
  PushNotificationState,
  SendNotificationOptions,
} from './types'

