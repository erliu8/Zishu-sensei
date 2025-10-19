/**
 * API 服务 React Hook
 * 
 * 提供便捷的 React Hook 访问 API 服务
 */

import { useEffect, useState, useCallback } from 'react'
import type {
  ApiServices,
  ApiServicesConfig,
} from '@/services/api/factory'
import {
  getApiServiceFactory,
  initializeApiServices,
  apiServices,
} from '@/services/api/factory'

/**
 * 使用 API 服务工厂
 */
export function useApiServiceFactory() {
  const [services, setServices] = useState<ApiServices | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const initialize = useCallback(async (config?: ApiServicesConfig) => {
    try {
      setError(null)
      const initialized = await initializeApiServices(config)
      setServices(initialized)
      setIsInitialized(true)
      return initialized
    } catch (err) {
      const error = err as Error
      setError(error)
      throw error
    }
  }, [])

  const destroy = useCallback(() => {
    getApiServiceFactory().destroy()
    setServices(null)
    setIsInitialized(false)
  }, [])

  useEffect(() => {
    // 组件卸载时清理
    return () => {
      // 注意：通常不应在这里销毁服务，因为它们是全局单例
      // 只有在确实需要时才调用
    }
  }, [])

  return {
    services,
    isInitialized,
    error,
    initialize,
    destroy,
  }
}

/**
 * 使用认证服务
 */
export function useAuthService() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      setIsChecking(true)
      const authenticated = await apiServices.auth.isAuthenticated()
      setIsAuthenticated(authenticated)
    } catch (error) {
      console.error('Failed to check authentication:', error)
      setIsAuthenticated(false)
    } finally {
      setIsChecking(false)
    }
  }

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiServices.auth.login({ username, password })
    if (response.success) {
      setIsAuthenticated(true)
    }
    return response
  }, [])

  const logout = useCallback(async () => {
    await apiServices.auth.logout()
    setIsAuthenticated(false)
  }, [])

  return {
    isAuthenticated,
    isChecking,
    login,
    logout,
    checkAuth,
    authService: apiServices.auth,
  }
}

/**
 * 使用用户服务
 */
export function useUserService() {
  return {
    userService: apiServices.user,
  }
}

/**
 * 使用对话服务
 */
export function useConversationService() {
  return {
    conversationService: apiServices.conversation,
  }
}

/**
 * 使用 WebSocket
 */
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionState, setConnectionState] = useState<string>('DISCONNECTED')

  useEffect(() => {
    const ws = apiServices.websocket

    const handleConnected = () => {
      setIsConnected(true)
      setConnectionState('CONNECTED')
    }

    const handleDisconnected = () => {
      setIsConnected(false)
      setConnectionState('DISCONNECTED')
    }

    const handleConnecting = () => {
      setConnectionState('CONNECTING')
    }

    const handleError = (error: Error) => {
      console.error('WebSocket error:', error)
      setConnectionState('ERROR')
    }

    ws.on('connected', handleConnected)
    ws.on('disconnected', handleDisconnected)
    ws.on('connecting', handleConnecting)
    ws.on('error', handleError)

    // 初始状态
    setIsConnected(ws.isConnected())
    setConnectionState(ws.getState())

    return () => {
      ws.off('connected', handleConnected)
      ws.off('disconnected', handleDisconnected)
      ws.off('connecting', handleConnecting)
      ws.off('error', handleError)
    }
  }, [])

  const send = useCallback(async (type: string, data: any, requiresAck: boolean = false) => {
    return apiServices.websocket.send(type, data, requiresAck)
  }, [])

  return {
    isConnected,
    connectionState,
    send,
    websocket: apiServices.websocket,
  }
}

/**
 * 使用同步管理器
 */
export function useSyncManager() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState(0)
  const [syncStatus, setSyncStatus] = useState<string>('IDLE')

  useEffect(() => {
    const syncManager = apiServices.sync

    const handleSyncStart = () => {
      setIsSyncing(true)
      setSyncStatus('SYNCING')
    }

    const handleSyncComplete = () => {
      setIsSyncing(false)
      setSyncStatus('IDLE')
      setLastSyncTime(syncManager.getLastSyncTime())
    }

    const handleSyncError = (error: Error) => {
      console.error('Sync error:', error)
      setIsSyncing(false)
      setSyncStatus('ERROR')
    }

    syncManager.on('sync:start', handleSyncStart)
    syncManager.on('sync:complete', handleSyncComplete)
    syncManager.on('sync:error', handleSyncError)

    // 初始状态
    setIsSyncing(syncManager.isSyncInProgress())
    setSyncStatus(syncManager.getStatus())
    setLastSyncTime(syncManager.getLastSyncTime())

    return () => {
      syncManager.off('sync:start', handleSyncStart)
      syncManager.off('sync:complete', handleSyncComplete)
      syncManager.off('sync:error', handleSyncError)
    }
  }, [])

  const sync = useCallback(async (entities?: string[]) => {
    return apiServices.sync.sync(entities)
  }, [])

  return {
    isSyncing,
    lastSyncTime,
    syncStatus,
    sync,
    syncManager: apiServices.sync,
  }
}

/**
 * 使用网络状态
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const checkStatus = () => {
      setIsOnline(apiServices.client.getNetworkStatus())
    }

    // 初始检查
    checkStatus()

    // 定期检查
    const interval = setInterval(checkStatus, 5000)

    // 监听浏览器在线/离线事件
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return {
    isOnline,
  }
}

/**
 * 使用 API 版本
 */
export function useApiVersion() {
  const [currentVersion, setCurrentVersion] = useState('')
  const [serverVersion, setServerVersion] = useState<string | null>(null)

  useEffect(() => {
    const versionManager = apiServices.version
    setCurrentVersion(versionManager.getCurrentVersion())
    setServerVersion(versionManager.getServerVersion())
  }, [])

  const negotiateVersion = useCallback(async () => {
    const version = await apiServices.version.negotiateVersion()
    setServerVersion(version)
    return version
  }, [])

  return {
    currentVersion,
    serverVersion,
    negotiateVersion,
    versionManager: apiServices.version,
  }
}

